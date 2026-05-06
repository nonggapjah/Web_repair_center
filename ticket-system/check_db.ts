import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const tickets = await prisma.repairTicket.findMany({
        take: 5,
        orderBy: { CreatedAt: 'desc' },
        select: { TicketID: true, ImageURL: true }
    });

    console.log(tickets);
}

main().catch(console.error).finally(() => prisma.$disconnect());
