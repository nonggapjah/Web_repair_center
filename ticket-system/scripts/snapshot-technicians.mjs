// MON-13 verification helper — snapshot Technician column BEFORE migration.
// Output: stdout JSON of all RepairTicket rows with non-null Technician.
// Used to compute "expected" counts and to allow eyeball-comparison post-migration.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
try {
    const rows = await prisma.repairTicket.findMany({
        where: { Technician: { not: null } },
        select: { TicketID: true, Technician: true, JobCategory: true, CurrentStatus: true }
    });
    const byTech = rows.reduce((acc, r) => {
        const k = r.Technician ?? "(null)";
        acc[k] = (acc[k] ?? 0) + 1;
        return acc;
    }, {});
    console.log(JSON.stringify({
        totalNonNullTechnician: rows.length,
        breakdownByTechnician: byTech,
        sampleRows: rows.slice(0, 10)
    }, null, 2));
} finally {
    await prisma.$disconnect();
}
