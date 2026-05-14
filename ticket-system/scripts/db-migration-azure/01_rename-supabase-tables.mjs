// Phase 3 / DBM-02 (14-05-2026) — atomic rename of Supabase tables to repair_* naming.
// Wraps the ALTER TABLE chain in a transaction; same transaction also CREATEs an
// updatable VIEW with the old name pointing at the new table. Until the VIEWs are
// dropped (DBM-08 follow-up), the currently-deployed Vercel build can keep reading
// and writing through the old name with zero downtime, while the next Vercel deploy
// (with @@map'd Prisma client) targets the new name directly.
//
// Run once, idempotent: detects already-renamed tables and skips the rename block
// while still ensuring the VIEWs exist.
//
// Run with the EXISTING Supabase DATABASE_URL/DIRECT_URL from .env (DDL must hit
// DIRECT_URL, not the pgbouncer pooler):
//   $env:DIRECT_URL='postgresql://...supabase...:5432/postgres'
//   node scripts/db-migration-azure/01_rename-supabase-tables.mjs
//   Remove-Item Env:\DIRECT_URL

import { PrismaClient } from "@prisma/client";

// Map: old PascalCase model-derived name → new lowercase repair_* @@map target.
const RENAME_PAIRS = [
    ["Branch", "repair_branch"],
    ["User", "repair_user"],
    ["RepairTicket", "repair_repairticket"],
    ["TicketHistory", "repair_tickethistory"],
    ["TicketComment", "repair_ticketcomment"],
    ["Notification", "repair_notification"],
    ["AuditLog", "repair_auditlog"],
    ["FailedLoginAttempt", "repair_failedloginattempt"],
    ["TicketTechnician", "repair_tickettechnician"]
];

const prisma = new PrismaClient({
    datasources: { db: { url: process.env.DIRECT_URL || process.env.DATABASE_URL } }
});

async function tableExists(name) {
    const rows = await prisma.$queryRawUnsafe(
        `SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = $1 AND c.relkind = 'r' LIMIT 1`,
        name
    );
    return rows.length > 0;
}

async function viewExists(name) {
    const rows = await prisma.$queryRawUnsafe(
        `SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relname = $1 AND c.relkind = 'v' LIMIT 1`,
        name
    );
    return rows.length > 0;
}

async function main() {
    console.log("[rename] start");

    // 1. Pre-flight: build action list per pair (rename / view-only / skip).
    const plan = [];
    for (const [oldName, newName] of RENAME_PAIRS) {
        const oldIsTable = await tableExists(oldName);
        const newIsTable = await tableExists(newName);
        const oldIsView = await viewExists(oldName);

        if (newIsTable && oldIsView) {
            plan.push({ oldName, newName, action: "ALREADY_DONE" });
        } else if (newIsTable && !oldIsTable && !oldIsView) {
            plan.push({ oldName, newName, action: "VIEW_ONLY" });
        } else if (oldIsTable && !newIsTable) {
            plan.push({ oldName, newName, action: "RENAME_AND_VIEW" });
        } else {
            plan.push({ oldName, newName, action: "UNEXPECTED", oldIsTable, newIsTable, oldIsView });
        }
    }

    console.log("[rename] preflight plan:");
    for (const p of plan) {
        console.log(`  ${p.oldName.padEnd(20)} -> ${p.newName.padEnd(28)} ${p.action}`);
    }

    const unexpected = plan.filter(p => p.action === "UNEXPECTED");
    if (unexpected.length > 0) {
        console.error("[rename] FAIL: unexpected state — refusing to proceed.");
        for (const u of unexpected) console.error("  ", u);
        process.exitCode = 1;
        return;
    }

    // 2. Build SQL — single transaction so partial state is impossible.
    const stmts = ["BEGIN;"];
    for (const p of plan) {
        if (p.action === "RENAME_AND_VIEW") {
            stmts.push(`ALTER TABLE "${p.oldName}" RENAME TO "${p.newName}";`);
            stmts.push(`CREATE VIEW "${p.oldName}" AS SELECT * FROM "${p.newName}";`);
        } else if (p.action === "VIEW_ONLY") {
            stmts.push(`CREATE VIEW "${p.oldName}" AS SELECT * FROM "${p.newName}";`);
        } else {
            // ALREADY_DONE: noop
        }
    }
    stmts.push("COMMIT;");

    const sql = stmts.join("\n");
    console.log("[rename] executing transaction:\n" + sql);

    // Prisma's $executeRawUnsafe runs in its own implicit tx per call; for a multi-stmt
    // tx we use $transaction with raw queries. Using a single $executeRawUnsafe with
    // BEGIN/COMMIT does NOT compose because Prisma wraps it. Use Prisma interactive tx.
    await prisma.$transaction(async (tx) => {
        for (const p of plan) {
            if (p.action === "RENAME_AND_VIEW") {
                await tx.$executeRawUnsafe(`ALTER TABLE "${p.oldName}" RENAME TO "${p.newName}"`);
                await tx.$executeRawUnsafe(`CREATE VIEW "${p.oldName}" AS SELECT * FROM "${p.newName}"`);
                console.log(`  ✓ ${p.oldName} -> ${p.newName} (renamed + view)`);
            } else if (p.action === "VIEW_ONLY") {
                await tx.$executeRawUnsafe(`CREATE VIEW "${p.oldName}" AS SELECT * FROM "${p.newName}"`);
                console.log(`  ✓ ${p.oldName} (view only — table already renamed)`);
            } else {
                console.log(`  · ${p.oldName} (already done)`);
            }
        }
    });

    // 3. Post-verify
    console.log("[rename] post-verify:");
    let allOk = true;
    for (const [oldName, newName] of RENAME_PAIRS) {
        const t = await tableExists(newName);
        const v = await viewExists(oldName);
        const ok = t && v;
        console.log(`  ${ok ? "✓" : "✗"} ${oldName} -> ${newName}: table=${t}, view=${v}`);
        if (!ok) allOk = false;
    }
    if (!allOk) {
        console.error("[rename] FAIL: post-verify mismatch");
        process.exitCode = 1;
    } else {
        console.log("[rename] ALL OK — Supabase has both new tables and old-name VIEWs");
    }
}

main()
    .catch(e => {
        console.error("[rename] ERROR:", e);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
        console.log("[rename] done");
    });
