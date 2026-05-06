import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    // วันที่ 6 พฤษภาคม 2026 (2569) เวลาไทย (+07:00)
    const targetDateStr = '2026-05-06';
    const startOfDay = new Date(`${targetDateStr}T00:00:00.000+07:00`);
    const endOfDay = new Date(`${targetDateStr}T23:59:59.999+07:00`);

    console.log("Keeping tickets between:");
    console.log("Start:", startOfDay.toISOString());
    console.log("End:", endOfDay.toISOString());

    // ค้นหา Ticket ที่ไม่ได้อยู่ในช่วงวันที่ 6/5/2569
    const ticketsToDelete = await prisma.repairTicket.findMany({
        where: {
            OR: [
                { CreatedAt: { lt: startOfDay } },
                { CreatedAt: { gt: endOfDay } }
            ]
        },
        select: { TicketID: true }
    });

    const ticketIds = ticketsToDelete.map(t => t.TicketID);

    if (ticketIds.length === 0) {
        console.log("ไม่มีข้อมูลที่ต้องลบ (เหลือแค่ข้อมูลของวันที่ 6/5/2569 แล้ว)");
        return;
    }

    console.log(`พบข้อมูลที่ต้องลบจำนวน ${ticketIds.length} รายการ...`);

    // ลบข้อมูลที่เกี่ยวข้อง (Comments และ History)
    const delComments = await prisma.ticketComment.deleteMany({
        where: { TicketID: { in: ticketIds } }
    });
    console.log(`ลบ Comments ไปแล้ว ${delComments.count} รายการ`);
    
    const delHistory = await prisma.ticketHistory.deleteMany({
        where: { TicketID: { in: ticketIds } }
    });
    console.log(`ลบ History ไปแล้ว ${delHistory.count} รายการ`);

    // ลบ Tickets
    const delTickets = await prisma.repairTicket.deleteMany({
        where: { TicketID: { in: ticketIds } }
    });
    console.log(`ลบ Tickets ออกแล้ว ${delTickets.count} รายการ`);

    console.log("ล้างข้อมูลเรียบร้อยแล้ว!");
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
