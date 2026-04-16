"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
// import { sendLineNotify } from "@/lib/lineNotify";

export async function createTicket(formData: {
    product: string;
    symptom: string;
    description: string;
    branchId: string;
    imageURL?: string;
    requestDate?: string;
}) {
    try {
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

        // 1. Send LINE Notify (Disabled for now)
        // await sendLineNotify(`🔔 แจ้งซ่อมใหม่!\nสาขา: ${formData.branchId}\nหมวดหมู่: ${formData.symptom}\nอุปกรณ์: ${formData.product}\nขอเข้าทำ: ${formData.requestDate || '-'}\nรายละเอียด: ${formData.description}`);

        // 2. Create In-App Notification for Admin
        await prisma.notification.create({
            data: {
                TargetRole: 'Admin',
                Title: 'มีแจ้งซ่อมระบบใหม่',
                Message: `สาขา ${formData.branchId} เเจ้งซ่อม: ${formData.symptom} (${formData.product})`,
                TicketID: ticket.TicketID
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
    noStore();
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
    noStore();
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
        const ticket = await prisma.repairTicket.findUnique({ where: { TicketID: ticketId } });
        if (!ticket) throw new Error("Ticket not found");

        await prisma.repairTicket.update({
            where: { TicketID: ticketId },
            data: {
                CurrentStatus: status,
                Technician: technician,
                ActualDate: actualDate ? new Date(actualDate) : undefined
            }
        });

        await prisma.ticketHistory.create({
            data: {
                TicketID: ticketId,
                Status: status,
                Note: note,
                UpdatedBy: 'Admin'
            }
        });

        // 1. Send LINE Notify (Disabled for now)
        // await sendLineNotify(`🛠️ อัปเดตงานซ่อม #${ticketId.substring(0, 8).toUpperCase()}\nสาขา: ${ticket.BranchID}\nสถานะใหม่: ${status}\nโน้ต: ${note || '-'}\nช่าง: ${technician || '-'}`);

        // 2. Create In-App Notification for Branch
        await prisma.notification.create({
            data: {
                TargetRole: 'Branch',
                TargetUser: ticket.BranchID,
                Title: 'อัปเดตสถานะงานซ่อม',
                Message: `ใบงาน #${ticketId.substring(0, 8).toUpperCase()} เปลี่ยนสถานะเป็น ${status}`,
                TicketID: ticketId
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

export async function addTicketComment(ticketId: string, message: string, imageUrl?: string, userId?: string) {
    try {
        let actualUserId = userId;
        const adminUser = await prisma.user.findFirst({ where: { Role: 'Admin' } });
        if (!actualUserId) {
            if (!adminUser) throw new Error("No admin user found to post comment");
            actualUserId = adminUser.UserID;
        }

        await prisma.ticketComment.create({
            data: {
                TicketID: ticketId,
                UserID: actualUserId,
                Message: message,
                ImageURL: imageUrl || null
            }
        });

        const ticket = await prisma.repairTicket.findUnique({ where: { TicketID: ticketId } });
        if (ticket) {
            const isFromAdmin = actualUserId === adminUser?.UserID;

            // 1. LINE Notify (Disabled for now)
            const sender = isFromAdmin ? 'แอดมิน' : `สาขา ${ticket.BranchID}`;
            // await sendLineNotify(`💬 แชทใหม่ในใบงาน #${ticketId.substring(0, 8).toUpperCase()}\nโดย: ${sender}\nข้อความ: ${message}`);

            // 2. In-App Notification to the OTHER party
            await prisma.notification.create({
                data: {
                    TargetRole: isFromAdmin ? 'Branch' : 'Admin',
                    TargetUser: isFromAdmin ? ticket.BranchID : null,
                    Title: 'มีข้อความใหม่ในไทม์ไลน์',
                    Message: `${sender}: ${message.length > 50 ? message.substring(0, 50) + '...' : message}`,
                    TicketID: ticketId
                }
            });
        }

        revalidatePath('/user/dashboard');
        revalidatePath('/admin/dashboard');
        return { success: true };
    } catch (error) {
        console.error("Add comment error:", error);
        return { success: false, error: "Unable to add comment" };
    }
}

// ---- Notifications Endpoints ----
export async function getUserNotifications(branchId: string, role: string) {
    noStore();
    if (role === 'Admin') {
        return await prisma.notification.findMany({
            where: { TargetRole: 'Admin' },
            orderBy: { CreatedAt: 'desc' },
            take: 20
        });
    } else {
        return await prisma.notification.findMany({
            where: { TargetRole: 'Branch', TargetUser: branchId },
            orderBy: { CreatedAt: 'desc' },
            take: 20
        });
    }
}

export async function markNotificationRead(notifId: string) {
    await prisma.notification.update({
        where: { NotifID: notifId },
        data: { IsRead: true }
    });
    revalidatePath('/user/dashboard');
    revalidatePath('/admin/dashboard');
}
