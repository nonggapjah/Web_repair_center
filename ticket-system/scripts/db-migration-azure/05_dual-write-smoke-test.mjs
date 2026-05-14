// Phase 3 / DBM-05 (14-05-2026) — smoke test for the dual-write extension.
// Activates the extension, inserts ONE Notification row via the extended client,
// then queries both Supabase and Azure independently and asserts the row landed in
// both. Cleans up after itself (deletes the row from both).
//
// Run with all 3 env vars:
//   $env:DATABASE_URL='postgresql://...supabase...'
//   $env:AZURE_DATABASE_URL='postgresql://...azure...?sslmode=require'
//   $env:DUAL_WRITE_AZURE='true'
//   node scripts/db-migration-azure/05_dual-write-smoke-test.mjs
//   Remove-Item Env:\DATABASE_URL,Env:\AZURE_DATABASE_URL,Env:\DUAL_WRITE_AZURE

import { PrismaClient } from '@prisma/client';

// Re-implement the dual-write extension wiring inline (matches src/lib/prisma.ts).
const supabase = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
const azure = new PrismaClient({ datasources: { db: { url: process.env.AZURE_DATABASE_URL } } });

const MIRRORED = new Set(['create', 'update', 'delete', 'upsert', 'createMany', 'updateMany', 'deleteMany']);

const extended = supabase.$extends({
    name: 'azure-dual-write',
    query: {
        $allModels: {
            async $allOperations({ model, operation, args, query }) {
                const result = await query(args);
                if (process.env.DUAL_WRITE_AZURE === 'true' && MIRRORED.has(operation)) {
                    const k = model.charAt(0).toLowerCase() + model.slice(1);
                    azure[k][operation](args).catch(e => console.error(`[DUAL-WRITE] ${model}.${operation} failed:`, e.message));
                }
                return result;
            }
        }
    }
});

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
    const probeTitle = `__DBM05_SMOKE_${Date.now()}`;
    console.log(`[smoke] inserting probe Notification with Title="${probeTitle}"`);

    const created = await extended.notification.create({
        data: {
            TargetRole: 'Admin',
            Title: probeTitle,
            Message: 'DBM-05 dual-write smoke test — safe to delete'
        }
    });
    console.log(`[smoke] primary insert OK: NotifID=${created.NotifID}`);

    // Wait briefly for fire-and-forget mirror to complete
    await sleep(2000);

    // Query both DBs by the unique title
    const inSupabase = await supabase.notification.findFirst({ where: { Title: probeTitle } });
    const inAzure = await azure.notification.findFirst({ where: { Title: probeTitle } });

    console.log(`[smoke] Supabase has it? ${inSupabase ? '✓' : '✗'} (NotifID=${inSupabase?.NotifID})`);
    console.log(`[smoke] Azure    has it? ${inAzure ? '✓' : '✗'} (NotifID=${inAzure?.NotifID})`);

    const matched = inSupabase && inAzure && inSupabase.NotifID === inAzure.NotifID;
    if (matched) {
        console.log('[smoke] PASS — dual-write mirror lands the same row in both DBs');
    } else {
        console.error('[smoke] FAIL — dual-write did NOT mirror correctly');
        process.exitCode = 1;
    }

    // Cleanup
    console.log('[smoke] cleaning up probe row from both DBs');
    if (inSupabase) await supabase.notification.delete({ where: { NotifID: inSupabase.NotifID } }).catch(() => {});
    if (inAzure) await azure.notification.delete({ where: { NotifID: inAzure.NotifID } }).catch(() => {});
    console.log('[smoke] done');
}

main()
    .catch(e => {
        console.error('[smoke] ERROR:', e);
        process.exitCode = 1;
    })
    .finally(async () => {
        await supabase.$disconnect();
        await azure.$disconnect();
    });
