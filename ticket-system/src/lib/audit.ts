// src/lib/audit.ts
// SYN-11 (11-05-2026): Audit log helper.
// Fail-soft by design — audit failures MUST NEVER break the main action.
// Writes go to the `AuditLog` table (MON-10).
//
// Boundaries:
// - Never throw. Always log to console on failure.
// - Never log sensitive fields. Callers are responsible for sanitizing Before/After.
// - JSON serialization handles non-string snapshots; failures here also fail soft.

import { prisma } from "./prisma";

export interface AuditEntry {
    userId?: string;          // session.userId of the actor (nullable for system events)
    action: string;           // dotted convention: "ticket.status.update", "ticket.comment.add", …
    entityType?: string;      // e.g. "RepairTicket", "User", "Notification"
    entityId?: string;        // primary key of the affected row
    before?: unknown;         // snapshot before mutation (JSON-serializable subset)
    after?: unknown;          // snapshot after mutation (JSON-serializable subset)
    ipAddress?: string;       // best-effort, from Next request headers
    userAgent?: string;       // best-effort, from Next request headers
}

function safeStringify(v: unknown): string | null {
    if (v === undefined || v === null) return null;
    try {
        return JSON.stringify(v);
    } catch (e) {
        // Circular refs, BigInt, etc. — record the failure and move on.
        console.error("[audit] failed to stringify snapshot", { error: e });
        return null;
    }
}

export async function logAudit(entry: AuditEntry): Promise<void> {
    try {
        await prisma.auditLog.create({
            data: {
                UserID:     entry.userId,
                Action:     entry.action,
                EntityType: entry.entityType,
                EntityID:   entry.entityId,
                Before:     safeStringify(entry.before),
                After:      safeStringify(entry.after),
                IPAddress:  entry.ipAddress,
                UserAgent:  entry.userAgent
            }
        });
    } catch (e) {
        // Audit must never block the main flow. Emit to server logs so ops can spot it.
        console.error("[audit] failed to write log entry", { action: entry.action, error: e });
    }
}
