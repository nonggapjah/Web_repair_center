# SYN-11 — Audit logging helper + apply to admin actions

**Phase:** 2A
**Team:** Syndicate
**Status:** [x] Complete
**Complexity:** Medium
**Depends on:** MON-10 (AuditLog table)
**Blocks:** None

## Scope
1. Create `ticket-system/src/lib/audit.ts` — helper function สำหรับเขียน audit log
2. Apply ≥ 3 admin actions ใน `tickets.ts` (status update, technician assign, role change)

## Helper Spec
```typescript
// src/lib/audit.ts
import { prisma } from "./prisma";

export interface AuditEntry {
    userId?: string;
    action: string;           // e.g. "ticket.status.update"
    entityType?: string;      // e.g. "RepairTicket"
    entityId?: string;        // e.g. ticketId
    before?: unknown;         // JSON-serializable
    after?: unknown;          // JSON-serializable
    ipAddress?: string;
    userAgent?: string;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
    try {
        await prisma.auditLog.create({
            data: {
                UserID: entry.userId,
                Action: entry.action,
                EntityType: entry.entityType,
                EntityID: entry.entityId,
                Before: entry.before ? JSON.stringify(entry.before) : null,
                After: entry.after ? JSON.stringify(entry.after) : null,
                IPAddress: entry.ipAddress,
                UserAgent: entry.userAgent,
            },
        });
    } catch (e) {
        // Never break main flow because audit log failed — log to console
        console.error("[audit] failed to write log entry", { action: entry.action, error: e });
    }
}
```

## Actions to Apply (in `tickets.ts`)
Must wrap at least 3 admin/state-changing actions. Likely candidates:
- `updateTicketStatus()` or similar — `action: "ticket.status.update"`
- `assignTechnician()` or similar — `action: "ticket.technician.assign"`
- `updateTicketDetails()` if exists — `action: "ticket.update"`

(L2 scan of tickets.ts needed to identify exact function names — Syndicate Technologist will inventory)

## Acceptance Criteria
- [ ] `ticket-system/src/lib/audit.ts` exists with logAudit() exported
- [ ] At least 3 admin-action wrappers added in `tickets.ts`:
  - Each logs Before snapshot + After snapshot + action name + entityType/ID + userId from session
- [ ] Error code added to `ErrorCatalog.md`:
  - (ไม่ต้องเพิ่ม — logAudit ตั้งใจไม่ throw เพื่อไม่ break main flow; error logged to console เท่านั้น)
- [ ] `npm run build` PASS
- [ ] `tsc --noEmit` clean
- [ ] Manual smoke: admin update ticket status → row appears ใน AuditLog ผ่าน Supabase SQL
- [ ] Regression spec: `09_TestCase/_regression/audit_log_writes.spec.md`
  - TC: ticket status update → AuditLog row created
  - TC: logAudit fail (e.g., DB unreachable) does NOT break main action
  - TC: Before/After snapshots match the actual row state

## Boundaries
- Do NOT block main action: audit log fail ต้องไม่ throw → log to console only
- Do NOT log: passwords, password hashes, sensitive fields (sanitize Before/After)
- Do NOT add: read UI (Phase 2D)
- Do NOT replace: existing console.log/error — audit log เป็นชั้นใหม่

## Notes
- Best-effort IP/UserAgent capture จาก headers — Next.js Server Actions getRequestHeaders() ถ้าได้ — ถ้าไม่ skip
- Future-proof: ถ้า audit-log read UI ตอน Phase 2D → query ตาม action/entityType/timestamp ได้ทันที (indexes มาแล้วจาก MON-10)
