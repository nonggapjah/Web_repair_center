// Phase 3 / DBM-03 (14-05-2026) — bulk data migration Supabase → Azure.
// Two Prisma client instances (one per datasource URL), iterate every model in
// FK-dependency order, copy rows in batches with createMany skipDuplicates so the
// script is idempotent (re-run is a noop if data already migrated).
//
// FK order matters — Postgres rejects child rows whose parent FK target doesn't yet
// exist on the destination side.
//
// Run with BOTH URLs as ephemeral env vars (DATABASE_URL = Supabase reader, AZURE_DATABASE_URL = Azure writer):
//   $env:DATABASE_URL='postgresql://...supabase...:6543/postgres?pgbouncer=true'
//   $env:AZURE_DATABASE_URL='postgresql://...azure...?sslmode=require'
//   node scripts/db-migration-azure/04_migrate-data.mjs
//   Remove-Item Env:\DATABASE_URL,Env:\AZURE_DATABASE_URL

import { PrismaClient } from "@prisma/client";

const supabase = new PrismaClient({
    datasources: { db: { url: process.env.DATABASE_URL } }
});
const azure = new PrismaClient({
    datasources: { db: { url: process.env.AZURE_DATABASE_URL } }
});

// (modelKey, label, pkField) — modelKey = Prisma client property, pkField = unique
// PK column used for cursor pagination. Hardcoded per-model so we never confuse a
// foreign-key column (e.g. TicketHistory.TicketID is FK, NOT PK; HistoryID is PK).
// Order = FK-safe insertion sequence.
const ORDER = [
    ["branch",             "Branch",             "BranchID"],
    ["user",               "User",               "UserID"],
    ["repairTicket",       "RepairTicket",       "TicketID"],
    ["ticketTechnician",   "TicketTechnician",   "id"],
    ["ticketHistory",      "TicketHistory",      "HistoryID"],
    ["ticketComment",      "TicketComment",      "CommentID"],
    ["notification",       "Notification",       "NotifID"],
    ["auditLog",           "AuditLog",           "LogID"],
    ["failedLoginAttempt", "FailedLoginAttempt", "AttemptID"]
];

const BATCH_SIZE = 200;

async function migrateTable(modelKey, label, pkField) {
    const srcCount = await supabase[modelKey].count();
    const dstCountBefore = await azure[modelKey].count();
    console.log(`[migrate] ${label.padEnd(20)} src=${srcCount}, dst-before=${dstCountBefore}`);

    if (srcCount === 0) {
        console.log(`  · ${label}: source empty — nothing to migrate`);
        return { srcCount, dstCountAfter: dstCountBefore, inserted: 0, skipped: 0 };
    }

    let cursor = undefined;
    let totalInserted = 0;
    let totalSeen = 0;

    while (true) {
        const findArgs = {
            take: BATCH_SIZE,
            orderBy: { [pkField]: "asc" }, // deterministic order so cursor pagination is correct
            ...(cursor ? { skip: 1, cursor } : {})
        };
        const rows = await supabase[modelKey].findMany(findArgs);
        if (rows.length === 0) break;

        // createMany on Azure with skipDuplicates so re-runs are noop.
        const result = await azure[modelKey].createMany({
            data: rows,
            skipDuplicates: true
        });
        totalInserted += result.count;
        totalSeen += rows.length;

        // Advance cursor to last row's PK.
        const lastPK = rows[rows.length - 1][pkField];
        cursor = { [pkField]: lastPK };

        if (rows.length < BATCH_SIZE) break;
    }

    const dstCountAfter = await azure[modelKey].count();
    const skipped = totalSeen - totalInserted;
    console.log(`  ✓ ${label}: inserted=${totalInserted}, skipped(duplicates)=${skipped}, dst-after=${dstCountAfter}`);
    return { srcCount, dstCountAfter, inserted: totalInserted, skipped };
}

async function main() {
    console.log("[migrate] start");
    if (!process.env.DATABASE_URL || !process.env.AZURE_DATABASE_URL) {
        console.error("[migrate] FAIL: both DATABASE_URL and AZURE_DATABASE_URL must be set");
        process.exitCode = 1;
        return;
    }

    const results = [];
    for (const [modelKey, label, pkField] of ORDER) {
        try {
            const r = await migrateTable(modelKey, label, pkField);
            results.push({ label, ...r });
        } catch (e) {
            console.error(`[migrate] ${label} FAILED:`, e.message);
            results.push({ label, error: e.message });
            // FK ordering means downstream tables will probably fail too — but keep going so
            // we get the full diagnostic picture in one run.
        }
    }

    // Final parity report
    console.log("\n[migrate] === parity report ===");
    let allMatch = true;
    for (const r of results) {
        if (r.error) {
            console.log(`  ✗ ${r.label.padEnd(20)} ERROR: ${r.error.split("\n")[0]}`);
            allMatch = false;
            continue;
        }
        const match = r.srcCount === r.dstCountAfter;
        if (!match) allMatch = false;
        console.log(`  ${match ? "✓" : "✗"} ${r.label.padEnd(20)} src=${r.srcCount} dst=${r.dstCountAfter}` +
                    (match ? "" : `  ← MISMATCH (delta ${r.dstCountAfter - r.srcCount})`));
    }

    if (allMatch) {
        console.log("[migrate] PARITY PASS — every table src count equals dst count");
    } else {
        console.error("[migrate] PARITY FAIL — see mismatches above");
        process.exitCode = 1;
    }
}

main()
    .catch(e => {
        console.error("[migrate] ERROR:", e);
        process.exitCode = 1;
    })
    .finally(async () => {
        await supabase.$disconnect();
        await azure.$disconnect();
        console.log("[migrate] done");
    });
