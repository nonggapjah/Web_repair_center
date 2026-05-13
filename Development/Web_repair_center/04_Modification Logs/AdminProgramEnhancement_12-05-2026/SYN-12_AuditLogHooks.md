# SYN-12 — Audit Log Hooks for JobCategory / Supplier / Technician Changes

**Phase:** 2B — Admin Program Enhancement (Modification)
**Team:** Syndicate
**Status:** [x] COMPLETE (12-05-2026 — hooks landed inline alongside MON-11/12/13 server actions; no separate Syndicate session needed)
**Complexity:** Simple
**Depends on:** MON-11, MON-12, MON-13 (signal complete)
**Blocks:** None

## Scope

ขยาย Phase 2A AuditLog helper ให้รองรับ action ใหม่จาก Mod 2B:
1. ใช้ existing `src/lib/audit.ts` helper จาก SYN-11 (Phase 2A) — เพิ่ม action constants
2. Hook into 4 mutation points:
   - `updateTicketCategory` (MON-11) → action `"ticket.category.update"`
   - `updateTicketSupplier` (MON-12) → action `"ticket.supplier.update"`
   - `assignTechnicians` / `addTechnician` / `removeTechnician` (MON-13) → action `"ticket.technician.assign"`, `"ticket.technician.remove"`
   - status → "WrongCategory" (MON-11) → ใช้ existing `"ticket.status.update"` (no new action needed)
3. Capture Before/After snapshot (JSON) ใน `AuditLog.Before` / `After` columns
4. Capture IP + UserAgent จาก request headers (best-effort, ตาม Phase 2A pattern)

## Acceptance Criteria

- [ ] AuditLog entry สร้างทุกครั้งที่ admin ทำ 4 mutations ข้างต้น
- [ ] `AuditLog.Action` = constant string (e.g., `"ticket.category.update"`)
- [ ] `AuditLog.EntityType = "RepairTicket"`, `EntityID = ticketId`
- [ ] `Before` JSON มี field ที่เปลี่ยน + `After` มี value ใหม่ — ไม่ใช่ snapshot ทั้ง row (size optimization)
- [ ] `UserID` = admin ที่กระทำการ (จาก session)
- [ ] State Transparency: ถ้า audit log insertion fails → log `[AUDIT-FAIL] action=X reason=Y` แต่ไม่ block ticket mutation success (audit เป็น secondary concern)
- [ ] No regression on Phase 2A audit actions — existing `"ticket.status.update"`, `"user.role.change"` ฯลฯ ยังทำงาน
- [ ] Verification (AS): query `SELECT * FROM "AuditLog" WHERE "Action" LIKE 'ticket.%' ORDER BY "Timestamp" DESC LIMIT 20` หลัง test ARC-11..15 → เห็น entries ครบ

## Boundaries

- Do NOT modify `AuditLog` schema — MON-10 (Phase 2A) ได้ออกแบบไว้ครบแล้ว
- Do NOT add admin UI สำหรับ view audit log — out of scope (Phase 2A ปิดไปแล้ว, นี่เป็น hook layer เท่านั้น)
- Do NOT audit `getAllTickets` (read) — เฉพาะ mutations
- Do NOT block ticket mutation ถ้า audit insert fail — log แล้วต่อ

## Notes

- Pattern reuse จาก SYN-11 (Phase 2A AuditLog Helper) — น่าจะมี `recordAudit(action, entityType, entityId, before, after, ctx)` function อยู่แล้ว
- 4 action constants ใหม่:
  ```ts
  export const AUDIT_ACTIONS = {
    TICKET_CATEGORY_UPDATE: 'ticket.category.update',
    TICKET_SUPPLIER_UPDATE: 'ticket.supplier.update',
    TICKET_TECHNICIAN_ASSIGN: 'ticket.technician.assign',
    TICKET_TECHNICIAN_REMOVE: 'ticket.technician.remove',
  };
  ```
- IP / UserAgent capture: ใช้ pattern เดียวกับ SYN-08 (BruteForceRateLimit) — `headers().get('x-forwarded-for')`, `headers().get('user-agent')`
- SYN-12 ขึ้นต่อ 3 Monolith tickets — เป็น **one-hop max** (Rule 6 compliant) — ไม่ใช่ A→B→C chain
