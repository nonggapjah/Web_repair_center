// Phase 3 / DBM-05 (14-05-2026) — Azure Postgres mirror client.
// Lazily instantiated singleton — only created when AZURE_DATABASE_URL is set, so dev
// environments without the env var pay zero cost.
//
// Used by the dual-write extension in `prisma.ts` to mirror every mutation that hits
// Supabase (the current primary). Reads continue to come from Supabase until DBM-07
// flips DATABASE_URL to Azure.

import { PrismaClient } from '@prisma/client';

const globalForAzure = globalThis as unknown as { prismaAzure?: PrismaClient | null };

export function getAzurePrisma(): PrismaClient | null {
    if (globalForAzure.prismaAzure !== undefined) return globalForAzure.prismaAzure;

    const url = process.env.AZURE_DATABASE_URL;
    if (!url) {
        // Cache the null so we don't re-read env on every call.
        globalForAzure.prismaAzure = null;
        return null;
    }

    globalForAzure.prismaAzure = new PrismaClient({
        datasources: { db: { url } },
        log: ['error']
    });
    return globalForAzure.prismaAzure;
}

// Convenience flag for the dual-write extension. Defaults to OFF — Commander must set
// `DUAL_WRITE_AZURE=true` in Vercel env to activate mirroring once Azure is verified.
export function isDualWriteEnabled(): boolean {
    return process.env.DUAL_WRITE_AZURE === 'true' && !!process.env.AZURE_DATABASE_URL;
}
