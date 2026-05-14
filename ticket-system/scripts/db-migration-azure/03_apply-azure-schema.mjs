// Phase 3 / DBM-02 (14-05-2026) — apply CREATE TABLE / INDEX / FK statements to Azure.
// Coexists with pre-existing tables in Azure's `public` schema (user_tenants etc. that
// belong to another project sharing this DB). We do NOT use `prisma db push` because
// that would attempt to drop unknown tables. Instead we execute the script generated
// by `prisma migrate diff --from-empty` which only emits CREATE statements — no drops.
//
// Idempotent: parses statements one-by-one and skips ones whose target object already
// exists (Postgres errors 42P07 = duplicate_table, 42P06 = duplicate_schema,
// 42710 = duplicate_object — used by indexes/constraints).
//
// Run with EPHEMERAL Azure URL:
//   $env:AZURE_DATABASE_URL='postgresql://...azure...?sslmode=require'
//   node scripts/db-migration-azure/03_apply-azure-schema.mjs
//   Remove-Item Env:\AZURE_DATABASE_URL

import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SQL_PATH = join(__dirname, "02_create-azure-schema.sql");

const prisma = new PrismaClient({
    datasources: { db: { url: process.env.AZURE_DATABASE_URL } }
});

// Postgres SQLSTATE codes considered "already exists" (skip is OK).
const DUPLICATE_CODES = new Set(["42P07", "42P06", "42710"]);

function splitStatements(sql) {
    // Strip Prisma migrate diff comments + blank lines, then split on `;` boundaries.
    // The DDL has no embedded semicolons in string literals (it's all schema), so this is safe.
    const cleaned = sql
        .split("\n")
        .filter(l => !l.trim().startsWith("--"))
        .join("\n");
    return cleaned
        .split(";")
        .map(s => s.trim())
        .filter(s => s.length > 0);
}

function summarise(stmt) {
    // First two words as a label (e.g. "CREATE TABLE", "ALTER TABLE", "CREATE INDEX")
    // plus the first quoted identifier so logs are scan-friendly.
    const words = stmt.replace(/\s+/g, " ").split(" ").slice(0, 6).join(" ");
    return words.length > 100 ? words.slice(0, 100) + "…" : words;
}

async function main() {
    console.log("[apply-azure-schema] start");
    const sql = readFileSync(SQL_PATH, "utf8");
    const stmts = splitStatements(sql);
    console.log(`[apply-azure-schema] ${stmts.length} statements parsed`);

    let applied = 0;
    let skipped = 0;
    let failed = 0;

    for (const [i, stmt] of stmts.entries()) {
        const label = summarise(stmt);
        try {
            await prisma.$executeRawUnsafe(stmt);
            applied++;
            console.log(`  ✓ [${i + 1}/${stmts.length}] ${label}`);
        } catch (e) {
            const code = e?.meta?.code || e?.code || "";
            if (DUPLICATE_CODES.has(code)) {
                skipped++;
                console.log(`  · [${i + 1}/${stmts.length}] ${label}  (already exists — skipped)`);
            } else {
                failed++;
                console.error(`  ✗ [${i + 1}/${stmts.length}] ${label}  (code=${code})`);
                console.error(`     msg: ${e.message?.split("\n")[0]}`);
            }
        }
    }

    console.log(`[apply-azure-schema] applied=${applied} skipped=${skipped} failed=${failed}`);

    // Post-verify: list our 9 expected tables.
    const expected = [
        "repair_branch", "repair_user", "repair_repairticket", "repair_tickethistory",
        "repair_ticketcomment", "repair_notification", "repair_auditlog",
        "repair_failedloginattempt", "repair_tickettechnician"
    ];
    const rows = await prisma.$queryRawUnsafe(
        `SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname = ANY($1::text[])
         ORDER BY relname`,
        expected
    );
    const found = rows.map(r => r.relname);
    const missing = expected.filter(t => !found.includes(t));

    console.log("[apply-azure-schema] post-verify:");
    for (const t of expected) {
        console.log(`  ${found.includes(t) ? "✓" : "✗"} ${t}`);
    }

    if (missing.length === 0 && failed === 0) {
        console.log("[apply-azure-schema] ALL OK — Azure has all 9 repair_* tables");
    } else {
        console.error(`[apply-azure-schema] FAIL: missing=[${missing.join(", ")}] failed=${failed}`);
        process.exitCode = 1;
    }
}

main()
    .catch(e => {
        console.error("[apply-azure-schema] ERROR:", e);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
        console.log("[apply-azure-schema] done");
    });
