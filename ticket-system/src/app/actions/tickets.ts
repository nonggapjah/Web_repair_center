"use server";
import { prisma } from "@/lib/prisma";
import { revalidatePath, unstable_noStore as noStore } from "next/cache";
import { logAudit } from "@/lib/audit";
import { getSession } from "./auth";
import { CONTRACTOR_CATEGORY, isJobCategory, JOB_CATEGORIES } from "@/lib/jobCategories";
import { requiresSupplier } from "@/lib/suppliers";

// MON-13 (12-05-2026): Technician column kept TEMPORARILY for back-compat with the
// existing single-tech dashboard. New TicketTechnician join table is dual-written
// on every assignment via syncTicketTechnicians(). Column drop deferred to MON-13b
// after 1-2 week observation period (mirrors Phase 0.5d Password column pattern).
//
// Special case: legacy value "ทีมช่างรับเหมา" is a JobCategory, NOT a person —
// when seen, set JobCategory and DO NOT create a TicketTechnician row.
const CONTRACTOR_LEGACY_TECH_VALUE = "ทีมช่างรับเหมา";

function normalizeTechnicianNames(input: string | string[] | null | undefined): {
    personNames: string[];
    isContractor: boolean;
} {
    const raw = Array.isArray(input)
        ? input
        : (typeof input === "string" ? input.split(",") : []);
    const cleaned = raw.map(s => s.trim()).filter(s => s.length > 0);
    const isContractor = cleaned.includes(CONTRACTOR_LEGACY_TECH_VALUE);
    const personNames = cleaned.filter(s => s !== CONTRACTOR_LEGACY_TECH_VALUE);
    return { personNames, isContractor };
}

// MON-13: replace-mode sync — clears all rows for ticketId, inserts the new set.
// Caller is responsible for transactional consistency (caller wraps in $transaction
// alongside the RepairTicket.update if needed).
async function syncTicketTechnicians(ticketId: string, personNames: string[]): Promise<void> {
    await prisma.ticketTechnician.deleteMany({ where: { TicketID: ticketId } });
    if (personNames.length === 0) return;
    // Dedupe in-memory before insert to satisfy @@unique([TicketID, TechnicianName])
    const unique = Array.from(new Set(personNames));
    await prisma.ticketTechnician.createMany({
        data: unique.map(TechnicianName => ({ TicketID: ticketId, TechnicianName })),
        skipDuplicates: true
    });
}

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
            Technicians: true, // MON-13: include join-table assignments
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
    // MON-13: prefer the join table; fall back to legacy Technician column for any
    // ticket that was assigned BEFORE the migration AND somehow missed the dual-write
    // (defensive — should be empty under normal operation).
    return await prisma.repairTicket.findMany({
        where: {
            OR: [
                { Technicians: { some: { TechnicianName: technicianName } } },
                { Technician: technicianName }
            ]
        },
        include: {
            Branch: true,
            User: true,
            Technicians: true,
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
            Technicians: true, // MON-13
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

// MON-11/13: `technician` accepts either a single name (legacy dashboard) or a comma-
// separated list / array (new multi-tech dashboard once ARC-14 lands). The function
// dual-writes to RepairTicket.Technician (back-compat string) AND TicketTechnician
// (canonical join table) so both old and new UIs see consistent data.
//
// Special case: if technician contains "ทีมช่างรับเหมา" we treat it as a JobCategory
// signal (sets JobCategory = "ช่างรับเหมา") and exclude it from the TicketTechnician
// rows. This keeps the legacy dashboard's hardcoded "ทีมช่างรับเหมา" option
// functional during the Arcade rewire window without leaking ghost-person rows.
export async function updateTicketStatus(
    ticketId: string,
    status: string,
    note?: string,
    technician?: string | string[],
    actualDate?: string,
    signatureBase64?: string
) {
    try {
        const ticket = await prisma.repairTicket.findUnique({ where: { TicketID: ticketId } });
        if (!ticket) throw new Error("Ticket not found");

        // MON-13: normalise to {personNames, isContractor} so we can dual-write cleanly.
        const techProvided = technician !== undefined; // distinguish "not passed" from "passed empty"
        const { personNames, isContractor } = normalizeTechnicianNames(technician);
        const legacyString = Array.isArray(technician)
            ? technician.filter(s => typeof s === "string" && s.trim().length > 0).join(", ")
            : (typeof technician === "string" ? technician : ticket.Technician);

        const updateData: any = {
            CurrentStatus: status,
            ActualDate: actualDate ? new Date(actualDate) : undefined
        };
        if (techProvided) {
            updateData.Technician = legacyString; // back-compat string column
        }
        if (techProvided && isContractor) {
            updateData.JobCategory = CONTRACTOR_CATEGORY; // MON-11 reclassification
        }

        if (status === 'Completed' && signatureBase64) {
            updateData.AdminSignature = signatureBase64;
        } else if (status === 'Closed' && signatureBase64) {
            updateData.UserSignature = signatureBase64;
        }

        // SYN-11: capture Before snapshot for audit (sanitized — no signatures, no PII beyond status/assignment)
        const beforeSnap = {
            CurrentStatus: ticket.CurrentStatus,
            Technician: ticket.Technician,
            JobCategory: ticket.JobCategory,
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

        // MON-13: sync the join table. Done outside the $transaction above because
        // TicketTechnician rows are managed via deleteMany+createMany (two ops) and
        // running them inside the same transaction would still serialise correctly,
        // but separating keeps the audit log + notification atomic with the status
        // change even if the join sync fails (which it shouldn't under normal load).
        if (techProvided) {
            await syncTicketTechnicians(ticketId, personNames);
        }

        // SYN-11: audit. logAudit() is fail-soft — never throws, never blocks.
        const session = await getSession();
        await logAudit({
            userId: session?.userId,
            action: "ticket.status.update",
            entityType: "RepairTicket",
            entityId: ticketId,
            before: beforeSnap,
            after: {
                CurrentStatus: status,
                Technician: techProvided ? legacyString : ticket.Technician,
                Technicians: techProvided ? personNames : undefined,
                JobCategory: (techProvided && isContractor) ? CONTRACTOR_CATEGORY : ticket.JobCategory,
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

// MON-11 (12-05-2026): admin-only category edit. Pass `category=null` (or empty string)
// to clear the field. Validates against JOB_CATEGORIES whitelist; unknown values are
// rejected with a structured error (no silent fallthrough).
export async function updateTicketCategory(ticketId: string, category: string | null) {
    try {
        const session = await getSession();
        if (!session?.role || session.role !== "Admin") {
            return { success: false, error: "ต้องเป็นผู้ดูแลระบบเท่านั้น" };
        }

        const normalized = (category ?? "").trim();
        const value: string | null = normalized.length === 0 ? null : normalized;
        if (value !== null && !isJobCategory(value)) {
            return { success: false, error: `หมวดหมู่ไม่ถูกต้อง (รับเฉพาะ: ${JOB_CATEGORIES.join(", ")})` };
        }

        const ticket = await prisma.repairTicket.findUnique({ where: { TicketID: ticketId } });
        if (!ticket) return { success: false, error: "ไม่พบใบงาน" };

        await prisma.$transaction([
            prisma.repairTicket.update({
                where: { TicketID: ticketId },
                data: { JobCategory: value }
            }),
            prisma.ticketHistory.create({
                data: {
                    TicketID: ticketId,
                    Status: ticket.CurrentStatus,
                    Note: `อัปเดตหมวดหมู่งาน: ${ticket.JobCategory ?? "(ไม่ระบุ)"} → ${value ?? "(ไม่ระบุ)"}`,
                    UpdatedBy: "Admin"
                }
            })
        ]);

        await logAudit({
            userId: session.userId,
            action: "ticket.category.update",
            entityType: "RepairTicket",
            entityId: ticketId,
            before: { JobCategory: ticket.JobCategory },
            after: { JobCategory: value }
        });

        return { success: true };
    } catch (error) {
        console.error("Update category error:", error);
        return { success: false, error: "ไม่สามารถอัปเดตหมวดหมู่ได้" };
    }
}

// MON-12 (12-05-2026): admin-only supplier edit, with conditional validation —
// rejected when JobCategory != "ช่างรับเหมา" but a non-empty supplier is supplied
// (defensive: prevents stray supplier values on non-contractor jobs). Empty string
// or null is always accepted (clears the field).
export async function updateTicketSupplier(ticketId: string, supplierName: string | null) {
    try {
        const session = await getSession();
        if (!session?.role || session.role !== "Admin") {
            return { success: false, error: "ต้องเป็นผู้ดูแลระบบเท่านั้น" };
        }

        const ticket = await prisma.repairTicket.findUnique({ where: { TicketID: ticketId } });
        if (!ticket) return { success: false, error: "ไม่พบใบงาน" };

        const normalized = (supplierName ?? "").trim();
        const value: string | null = normalized.length === 0 ? null : normalized;

        if (value !== null && !requiresSupplier(ticket.JobCategory)) {
            // ERR_TICKET_SUPPLIER_NOT_APPLICABLE = -2401
            console.error(
                `[updateTicketSupplier] ERR_TICKET_SUPPLIER_NOT_APPLICABLE (-2401): ticket=${ticketId} JobCategory=${ticket.JobCategory ?? "null"} cannot accept supplier="${value}"`
            );
            return { success: false, error: "ระบุ supplier ได้เฉพาะหมวด 'ช่างรับเหมา' เท่านั้น" };
        }
        // If the category requires a supplier and the caller is clearing it, also reject.
        if (value === null && requiresSupplier(ticket.JobCategory)) {
            return { success: false, error: "หมวด 'ช่างรับเหมา' ต้องระบุ supplier" };
        }

        await prisma.$transaction([
            prisma.repairTicket.update({
                where: { TicketID: ticketId },
                data: { SupplierName: value }
            }),
            prisma.ticketHistory.create({
                data: {
                    TicketID: ticketId,
                    Status: ticket.CurrentStatus,
                    Note: `อัปเดต supplier: ${ticket.SupplierName ?? "(ไม่ระบุ)"} → ${value ?? "(ไม่ระบุ)"}`,
                    UpdatedBy: "Admin"
                }
            })
        ]);

        await logAudit({
            userId: session.userId,
            action: "ticket.supplier.update",
            entityType: "RepairTicket",
            entityId: ticketId,
            before: { SupplierName: ticket.SupplierName },
            after: { SupplierName: value }
        });

        return { success: true };
    } catch (error) {
        console.error("Update supplier error:", error);
        return { success: false, error: "ไม่สามารถอัปเดต supplier ได้" };
    }
}

// MON-13 (12-05-2026): replace the entire technician set for a ticket.
// Pass [] to unassign everyone. Special value "ทีมช่างรับเหมา" inside the array is
// reclassified to JobCategory (NOT inserted as a person), mirroring updateTicketStatus.
export async function assignTechnicians(ticketId: string, technicianNames: string[]) {
    try {
        const session = await getSession();
        if (!session?.role || session.role !== "Admin") {
            return { success: false, error: "ต้องเป็นผู้ดูแลระบบเท่านั้น" };
        }

        const ticket = await prisma.repairTicket.findUnique({
            where: { TicketID: ticketId },
            include: { Technicians: true }
        });
        if (!ticket) return { success: false, error: "ไม่พบใบงาน" };

        const { personNames, isContractor } = normalizeTechnicianNames(technicianNames);
        const beforeNames = ticket.Technicians.map(t => t.TechnicianName).sort();

        const updateData: any = { Technician: personNames.join(", ") };
        if (isContractor) updateData.JobCategory = CONTRACTOR_CATEGORY;

        await prisma.repairTicket.update({
            where: { TicketID: ticketId },
            data: updateData
        });
        await syncTicketTechnicians(ticketId, personNames);

        const noteText = personNames.length > 0
            ? `มอบหมายช่าง: ${personNames.join(", ")}`
            : "ยกเลิกการมอบหมายช่างทั้งหมด";
        await prisma.ticketHistory.create({
            data: {
                TicketID: ticketId,
                Status: ticket.CurrentStatus,
                Note: noteText,
                UpdatedBy: "Admin"
            }
        });

        await logAudit({
            userId: session.userId,
            action: "ticket.technician.assign",
            entityType: "RepairTicket",
            entityId: ticketId,
            before: { Technicians: beforeNames },
            after: { Technicians: personNames.sort(), JobCategory: isContractor ? CONTRACTOR_CATEGORY : ticket.JobCategory }
        });

        return { success: true };
    } catch (error) {
        console.error("Assign technicians error:", error);
        return { success: false, error: "ไม่สามารถมอบหมายช่างได้" };
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
