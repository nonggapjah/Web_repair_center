"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createTicket(formData: {
    product: string;
    symptom: string;
    description: string;
    branchId: string;
}) {
    try {
        // ในระบบจริงต้องดึง UserID จาก Session นะครับ
        // สำหรับตอนนี้ดึง User คนแรกจากสาขามาเป็นคนแจ้งก่อนครับ
        let user = await prisma.user.findFirst({
            where: { BranchID: formData.branchId }
        });

        if (!user) {
            // ถ้าไม่มี User ในสาขาเลย ให้สร้างขึ้นมา 1 คน (เพื่อการทดสอบ)
            user = await prisma.user.create({
                data: {
                    Username: `staff_${formData.branchId.toLowerCase()}`,
                    BranchID: formData.branchId,
                    Role: 'User'
                }
            });
        }

        const ticket = await prisma.repairTicket.create({
            data: {
                Product: formData.product,
                Symptom: formData.symptom,
                Description: formData.description,
                BranchID: formData.branchId,
                UserID: user.UserID,
                CurrentStatus: 'Planed',
                Priority: 'Medium'
            }
        });

        revalidatePath('/user/dashboard');
        revalidatePath('/admin/dashboard');

        return { success: true, ticketId: ticket.TicketID };
    } catch (error) {
        console.error("Create ticket error:", error);
        return { success: false, error: "ไม่สามารถส่งข้อมูลแจ้งซ่อมได้ โปรดตรวจสอบการเชื่อมต่อฐานข้อมูล" };
    }
}

export async function getBranchTickets(branchId: string) {
    return await prisma.repairTicket.findMany({
        where: { BranchID: branchId },
        orderBy: { CreatedAt: 'desc' }
    });
}

export async function getAllTickets() {
    return await prisma.repairTicket.findMany({
        include: { Branch: true },
        orderBy: { CreatedAt: 'desc' }
    });
}
