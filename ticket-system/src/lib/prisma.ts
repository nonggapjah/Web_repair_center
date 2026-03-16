import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined
}

if (!process.env.DATABASE_URL) {
    console.error('CRITICAL: DATABASE_URL is missing in process.env');
} else {
    console.log('DATABASE_URL is present, length:', process.env.DATABASE_URL.length);
}

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log: ['query', 'error', 'warn'],
    })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
