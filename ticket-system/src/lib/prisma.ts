import { PrismaClient } from '@prisma/client';
import { getAzurePrisma, isDualWriteEnabled } from './prisma-azure';

// Phase 3 / DBM-05 (14-05-2026): dual-write extension.
// Wraps every mutation on the primary (Supabase) Prisma client and mirrors it to the
// Azure mirror client. Mirror is FAIL-SOFT — a failed Azure write logs a [DUAL-WRITE]
// error to console and returns; it never throws and never blocks the primary write.
//
// Activation: `DUAL_WRITE_AZURE=true` AND `AZURE_DATABASE_URL` set. If either is
// missing, the extension's mirror call is a no-op and the primary client behaves
// identically to the pre-Phase-3 client.
//
// We mirror the FOUR write operations Prisma exposes via $extends.query.$allModels:
// create, update, delete, upsert. Aggregate ops (createMany / updateMany / deleteMany)
// are also covered. We deliberately skip raw queries — those are infrastructure-level
// (e.g. migration scripts) and should target a single DB explicitly.

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
};

const basePrisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log: ['query'],
    });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = basePrisma;

const MIRRORED_OPS = new Set([
    'create', 'update', 'delete', 'upsert',
    'createMany', 'updateMany', 'deleteMany'
]);

async function mirrorToAzure(model: string, operation: string, args: unknown): Promise<void> {
    const azure = getAzurePrisma();
    if (!azure) return;
    try {
        // Lowercase first letter — Prisma model name in extensions arrives as
        // PascalCase (e.g. "RepairTicket") but the client property is camelCase
        // (e.g. prisma.repairTicket). We can't introspect the client type at
        // runtime, so we accept the cast.
        const clientKey = model.charAt(0).toLowerCase() + model.slice(1);
        const target = (azure as unknown as Record<string, Record<string, (a: unknown) => Promise<unknown>>>)[clientKey];
        if (!target || typeof target[operation] !== 'function') {
            console.error(`[DUAL-WRITE] missing op on Azure mirror: ${clientKey}.${operation}`);
            return;
        }
        await target[operation](args);
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[DUAL-WRITE] Azure mirror failed for ${model}.${operation}: ${msg}`);
    }
}

export const prisma = basePrisma.$extends({
    name: 'azure-dual-write',
    query: {
        $allModels: {
            async $allOperations({ model, operation, args, query }) {
                // Always run the primary (Supabase) write first. Its return value is the
                // contract the application sees — Azure mirror is best-effort.
                const result = await query(args);
                if (isDualWriteEnabled() && MIRRORED_OPS.has(operation)) {
                    // Fire and forget — do not await on the hot path. Errors are logged
                    // inside mirrorToAzure(). This keeps p99 latency identical to the
                    // pre-Phase-3 baseline whether Azure is fast, slow, or down.
                    void mirrorToAzure(model, operation, args);
                }
                return result;
            }
        }
    }
});
