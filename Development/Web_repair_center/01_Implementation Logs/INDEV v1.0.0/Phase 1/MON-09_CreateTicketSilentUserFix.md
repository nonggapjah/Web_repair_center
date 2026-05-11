# MON-09 — createTicket() silent user creation fix

**Phase:** 1
**Team:** Monolith
**Status:** [x] Complete
**Completed:** 11-05-2026 by Monolith (SC implementation, PF verification)
**Complexity:** Medium
**Depends on:** SYN-06 (LINE comments ใน tickets.ts ลบไปก่อน เพื่อลด merge conflict)
**Blocks:** None

## Scope
[ticket-system/src/app/actions/tickets.ts](../../../../../ticket-system/src/app/actions/tickets.ts) `createTicket()`:
- ปัจจุบันเมื่อไม่มี user สำหรับ branchId → **silent create user** ด้วย username pattern `staff_${branchId}`, role 'User', no password set
- นี่เป็น silent side effect ที่ละเมิด §2 Silent Failure Rule

## ปัญหา
1. user ที่ถูกสร้างด้วย "staff_xxxx" ไม่มีรหัส (Password default = "1234") → security risk
2. ไม่มี audit trail — ใครสร้าง user, เมื่อไหร่, ทำไม
3. ถ้าเกิด data inconsistency (เช่น user ถูกลบ) — UX จะดู "ปกติ" แต่ที่จริง state corrupt

## Decision: Replace silent create → explicit error
ถ้า branch ไม่มี user → return error ที่บอกชัดเจน + log ที่ฝั่ง server การสร้าง user เป็นงานของ admin/seed script ไม่ใช่ side effect ของ createTicket

## Acceptance Criteria
- [x] Modify `ticket-system/src/app/actions/tickets.ts` `createTicket()`:
  - Silent `prisma.user.create({...})` block removed (was tickets.ts:18-26) ✓
  - Replaced with explicit error return + `console.error` containing code `-2001` ✓ (tickets.ts:18-33)
  - `user` changed from `let` to `const` — type narrowed by early return, no reassignment needed ✓
- [x] เพิ่ม error code entry ใน `Development/.../ErrorCatalog.md`:
  - `ERR_TICKET_NO_USER_FOR_BRANCH = -2001` (Data range) ✓ — row added under -2xxx section, audit trail entry appended
- [x] Verify: ทุก branch ใน seed_production.mjs สร้าง user ด้วย Role='User' อยู่แล้ว — confirmed at seed_production.mjs:72-83 (`prisma.user.upsert({...Role: 'User'...})`) — flow ปกติไม่กระทบ ✓
- [x] `npx next build` PASS → 7 routes compiled (used `npx next build` directly — `npm run build`'s `prisma generate &&` prefix blocked by running `next dev` server DLL lock; not a code issue, schema types unchanged from MON-08)
- [x] `npx tsc --noEmit` clean (zero output = zero TS errors) ✓
- [x] Regression test added: `Development/Web_repair_center/09_TestCase/_regression/createTicket_no_silent_user.spec.md` ✓
  - 6 TCs: happy path, failure path, static guard (zero `user.create` calls), error message exact-match, ErrorCatalog row presence, seed alignment
  - Static guard TC-MON-09-03 PASS verified at ticket closure: grep `prisma\.user\.create|user\.create` against `src/` returns zero matches

## Boundaries
- Do NOT touch: createComment, updateStatus, getBranchTickets, getAllTickets (Phase 1 จัดการเฉพาะ createTicket silent user creation)
- Do NOT change: LINE Notify call (ไม่มีอยู่แล้วหลัง SYN-06)
- Do NOT change: ticket schema, notification creation logic
- Do NOT modify: User auto-create logic ใน auth.ts (Phase 0.5 ดูแล)

## Notes
- หลัง fix นี้: admin/seed script ต้องสร้าง User row สำหรับทุก branch ก่อน (ทำอยู่แล้วใน seed_production.mjs)
- ถ้ามี branch ใหม่เพิ่มในอนาคต → ต้องอัปเดต seed_production.mjs branches[] + rerun seed
- error message ภาษาไทย "ไม่พบผู้ใช้งานของสาขานี้ในระบบ กรุณาติดต่อแอดมิน" ให้ user-facing ดูสุภาพ
