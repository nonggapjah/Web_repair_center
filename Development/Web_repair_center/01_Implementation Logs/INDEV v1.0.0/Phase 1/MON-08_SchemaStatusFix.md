# MON-08 — Schema CurrentStatus typo fix

**Phase:** 1
**Team:** Monolith
**Status:** [x] Complete
**Completed:** 11-05-2026 by Monolith (SC implementation, PF verification)
**Complexity:** Simple
**Depends on:** None
**Blocks:** None

## Scope
แก้ schema typo + sync default ระหว่าง schema กับ code:
- `CurrentStatus String @default("Planed")` ← typo (ขาดตัว n) + ไม่ตรง code
- `createTicket()` ใช้ `CurrentStatus: 'Open'` ตอน create

ปัญหา: ถ้าใครสร้าง user/row ผ่าน Prisma upsert/create โดยไม่ระบุ CurrentStatus → ได้ค่า "Planed" (typo) ไปทันที

## Acceptance Criteria
- [x] Update `ticket-system/prisma/schema.prisma`:
  - `CurrentStatus String @default("Planed")` → `CurrentStatus String @default("Open")`  ✓ line 42
- [x] Run `npx prisma format` → clean ✓
- [x] Run `npx prisma validate` → valid ✓ "The schema at prisma\schema.prisma is valid"
- [x] Run `npx prisma db push` → DB column default updated ✓ "Your database is now in sync with your Prisma schema. Done in 1.50s"
- [x] Run `npx prisma generate` → Prisma Client regenerate ✓ (note: chained inside `npx next build` PASS; standalone `prisma generate` hit Windows DLL lock from running `next dev` server — non-blocking since schema type-shape unchanged, only default value)
- [x] Sanity check via probe script (read-only) — `ticket-system/scripts/mon08_probe.ts`:
  - Postgres column default verified: `column_default = 'Open'::text` ✓
  - Existing rows: 0 rows = "Planed", 20 rows = "Open" out of 94 total — historical createTicket() always set `'Open'` explicitly, so no rows ever inherited the typo. Default change leaves all existing data untouched ✓
  - No data migration occurred (verified) ✓
- [x] Update PreExisting TechStack:
  - Tickets subsystem: Known Quirks — entry struck-through with "RESOLVED 11-05-2026 (MON-08)" ✓
  - Database subsystem: Known Quirks — struck-through + summary of probe verification ✓
  - Critical Issues Summary row #4 — marked RESOLVED ✓
- [x] `npm run build` PASS → 7 routes compiled (`/`, `/admin/dashboard`, `/api/proxy-image`, `/login`, `/technician/dashboard`, `/user/dashboard`, `/user/new-ticket` + `/_not-found`), no webhook (post-SYN-06 state intact)
- [x] Probe deleted post-verification (§6 RELEASE rule) ✓ `scripts/mon08_probe.ts` removed

## Boundaries
- Do NOT migrate existing rows: rows ที่มี CurrentStatus = "Planed" อยู่จะคงอยู่ (data migration คือ separate ticket ถ้าจำเป็น)
- Do NOT change: `createTicket()` (ใช้ 'Open' ถูกอยู่แล้ว) — MON-09 ดูแล createTicket function แยก
- Do NOT add: new status values (Planning, In Progress, etc.) — Phase 1 ไม่เปลี่ยน status state machine

## Notes
- Status state machine ปัจจุบัน: ['Open', 'Planed' (typo, existing rows), ...] — Phase 1 ไม่ละเอียดเรื่องนี้
- ถ้าต้องการมี Phase 2 ticket: "Status state machine normalization" — สร้าง enum + migrate existing rows
- Default change กระทบเฉพาะ row ใหม่ → backward compatible
