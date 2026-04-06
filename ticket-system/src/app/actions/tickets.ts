"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function createTicket(formData: {
    product: string;
    symptom: string;
    description: string;
    branchId: string;
    imageURL?: string;
    requestDate?: string;
}) {
    try {
        // ในระบบจริงต้องดึง UserID จาก Session
        let user = await prisma.user.findFirst({
            where: { BranchID: formData.branchId, Role: 'User' }
        });

        if (!user) {
            user = await prisma.user.create({
                data: {
                    Username: `staff_${formData.branchId}`,
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
                ImageURL: formData.imageURL,
                BranchID: formData.branchId,
                UserID: user.UserID,
                CurrentStatus: 'Open',
                Priority: 'Medium',
                RequestDate: formData.requestDate ? new Date(formData.requestDate) : null
            }
        });

        revalidatePath('/user/dashboard');
        revalidatePath('/admin/dashboard');

        return { success: true, ticketId: ticket.TicketID };
    } catch (error) {
        console.error("Create ticket error:", error);
        return { success: false, error: "ไม่สามารถส่งข้อมูลแจ้งซ่อมได้" };
    }
}

export async function getBranchTickets(branchId: string) {
    return await prisma.repairTicket.findMany({
        where: { BranchID: branchId },
        include: {
            User: true,
            History: {
                orderBy: { Timestamp: 'desc' }
            },
            Comments: {
                include: { User: true },
                orderBy: { Timestamp: 'desc' }
            }
        },
        orderBy: { CreatedAt: 'desc' }
    });
}

export async function getAllTickets() {
    return await prisma.repairTicket.findMany({
        include: {
            Branch: true,
            User: true,
            History: {
                orderBy: { Timestamp: 'desc' }
            },
            Comments: {
                include: { User: true },
                orderBy: { Timestamp: 'desc' }
            }
        },
        orderBy: { CreatedAt: 'desc' }
    });
}

export async function updateTicketStatus(ticketId: string, status: string, note?: string, technician?: string, actualDate?: string) {
    try {
        await prisma.repairTicket.update({
            where: { TicketID: ticketId },
            data: {
                CurrentStatus: status,
                Technician: technician,
                ActualDate: actualDate ? new Date(actualDate) : undefined
            }
        });

        // บันทึกประวัติ
        await prisma.ticketHistory.create({
            data: {
                TicketID: ticketId,
                Status: status,
                Note: note,
                UpdatedBy: 'Admin' // ในระบบจริงใช้ UserID จาก Session
            }
        });

        revalidatePath('/user/dashboard');
        revalidatePath('/admin/dashboard');
        return { success: true };
    } catch (error) {
        console.error("Update ticket error:", error);
        return { success: false };
    }
}
