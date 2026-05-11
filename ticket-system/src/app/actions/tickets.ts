"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { logAudit } from "@/lib/audit";
import { getSession } from "./auth";

export async function createTicket(formData: {
    product: string;
    symptom: string;
    description: string;
    branchId: string;
    imageURL?: string;
    requestDate?: string;
}) {
    try {
        const user = await prisma.user.findFirst({
            where: { BranchID: formData.branchId, Role: 'User' }
        });

        // MON-09 (11-05-2026): explicit error path replaces silent user-create side effect.
        // Error code: ERR_TICKET_NO_USER_FOR_BRANCH = -2001 (see ErrorCatalog.md).
        // Rationale: branch users are provisioned by seed_production.mjs / admin tooling,
        // never by a server action. Auto-creating a User row here masked data
        // inconsistencies (deleted/missing branch user) behind a "successful" UX while
        // leaving the new account password-less (default plaintext "1234"). §2 Silent
        // Failure Rule — fail loudly with an observable, user-facing reason.
        if (!user) {
            console.error(
                `[createTicket] ERR_TICKET_NO_USER_FOR_BRANCH (-2001): no User row found for branchId=${formData.branchId} — refusing to auto-create. Provision via seed_production.mjs.`
            );
            return {
                success: false,
                error: "ไม่พบผู้ใช้งานของสาขานี้ในระบบ กรุณาติดต่อแอดมิน"
            };
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

        // Create In-App Notification for Admin
        await prisma.notification.create({
            data: {
                TargetRole: 'Admin',
                Title: 'มีแจ้งซ่อมระบบใหม่',
                Message: `สาขา ${formData.branchId} เเจ้งซ่อม: ${formData.symptom} (${formData.product})`,
                TicketID: ticket.TicketID
            }
        });

        return { success: true, ticketId: ticket.TicketID };
    } catch (error) {
        console.error("Create ticket error:", error);
        return { success: false, error: "ไม่สามารถส่งข้อมูลแจ้งซ่อมได้" };
    }
}

export async function getBranchTickets(branchId: string, _t?: number) {
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

export async function getTechnicianTickets(technicianName: string, _t?: number) {
    noStore();
    return await prisma.repairTicket.findMany({
        where: { Technician: technicianName },
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

export async function getAllTickets(_t?: number) {
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

export async function updateTicketStatus(ticketId: string, status: string, note?: string, technician?: string, actualDate?: string, signatureBase64?: string) {
    try {
        const ticket = await prisma.repairTicket.findUnique({ where: { TicketID: ticketId } });
        if (!ticket) throw new Error("Ticket not found");

        const updateData: any = {
            CurrentStatus: status,
            Technician: technician,
            ActualDate: actualDate ? new Date(actualDate) : undefined
        };

        if (status === 'Completed' && signatureBase64) {
            updateData.AdminSignature = signatureBase64;
        } else if (status === 'Closed' && signatureBase64) {
            updateData.UserSignature = signatureBase64;
        }

        // SYN-11: capture Before snapshot for audit (sanitized — no signatures, no PII beyond status/assignment)
        const beforeSnap = {
            CurrentStatus: ticket.CurrentStatus,
            Technician: ticket.Technician,
            ActualDate: ticket.ActualDate
        };

        await prisma.$transaction([
            prisma.repairTicket.update({
                where: { TicketID: ticketId },
                data: updateData
            }),
            prisma.ticketHistory.create({
                data: {
                    TicketID: ticketId,
                    Status: status,
                    Note: note,
                    UpdatedBy: 'Admin'
                }
            }),
            prisma.notification.create({
                data: {
                    TargetRole: 'Branch',
                    TargetUser: ticket.BranchID,
                    Title: 'อัปเดตสถานะงานซ่อม',
                    Message: `ใบงาน #${ticketId.substring(0, 8).toUpperCase()} เปลี่ยนสถานะเป็น ${status}`,
                    TicketID: ticketId
                }
            })
        ]);

        // SYN-11: audit. logAudit() is fail-soft — never throws, never blocks.
        // Action `ticket.status.update` covers both status flips AND technician (re)assignment
        // since both flow through this single function; entityType+entityId identify the row.
        const session = await getSession();
        await logAudit({
            userId: session?.userId,
            action: "ticket.status.update",
            entityType: "RepairTicket",
            entityId: ticketId,
            before: beforeSnap,
            after: {
                CurrentStatus: status,
                Technician: technician,
                ActualDate: actualDate ?? null,
                Note: note ?? null
            }
        });

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
            const sender = isFromAdmin ? 'แอดมิน' : `สาขา ${ticket.BranchID}`;

            // In-App Notification to the OTHER party
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

        // SYN-11: audit. Record who posted what on which ticket. Message stored truncated
        // to mirror what the notification shows (avoids storing potentially sensitive long text twice).
        await logAudit({
            userId: actualUserId,
            action: "ticket.comment.add",
            entityType: "RepairTicket",
            entityId: ticketId,
            after: {
                hasImage: !!imageUrl,
                messagePreview: message.length > 80 ? message.substring(0, 80) + '...' : message
            }
        });

        return { success: true };
    } catch (error) {
        console.error("Add comment error:", error);
        return { success: false, error: "Unable to add comment" };
    }
}

// ---- Notifications Endpoints ----
export async function getUserNotifications(branchId: string, role: string, _t?: number) {
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
}

export async function markAllNotificationsAsViewed(branchId: string, role: string) {
    try {
        const dbRole = role === 'Admin' ? 'Admin' : 'Branch';
        await prisma.notification.updateMany({
            where: { TargetRole: dbRole, TargetUser: dbRole === 'Admin' ? null : branchId, IsRead: false },
            data: { IsRead: true }
        });
        return { success: true };
    } catch (err) {
        return { success: false };
    }
}

export async function markAllNotificationsRead(branchId: string, role: string) {
    try {
        const dbRole = role === 'Admin' ? 'Admin' : 'Branch';
        // SYN-11: capture row count for audit (Before snapshot)
        const targetWhere = { TargetRole: dbRole, TargetUser: dbRole === 'Admin' ? null : branchId };
        const beforeCount = await prisma.notification.count({ where: targetWhere });

        await prisma.notification.deleteMany({ where: targetWhere });

        // SYN-11: bulk delete is a destructive admin/branch action — audit it.
        const session = await getSession();
        await logAudit({
            userId: session?.userId,
            action: "notification.bulkClear",
            entityType: "Notification",
            entityId: dbRole === 'Admin' ? 'Admin:*' : `Branch:${branchId}`,
            before: { count: beforeCount, targetRole: dbRole, targetUser: targetWhere.TargetUser },
            after: { count: 0 }
        });

        return { success: true };
    } catch (err) {
        return { success: false };
    }
}
