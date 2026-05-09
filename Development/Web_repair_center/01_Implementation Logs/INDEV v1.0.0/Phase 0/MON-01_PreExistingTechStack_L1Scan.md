# MON-01 — L1 PreExisting TechStack scan + document

**Phase:** 0
**Team:** Monolith
**Status:** [x] Complete
**Complexity:** Medium
**Depends on:** None
**Blocks:** Phase 0.5 work (Syndicate ต้องอ่าน TechStack ก่อน plan security migration)

## Scope
ทำ L1 scan (Tiered Scan Protocol §5) ของ codebase ที่มีอยู่ใน `ticket-system/` และเขียนเอกสารใน `Development/Web_repair_center/PreExisting TechStack/Web_repair_center.md`

## Acceptance Criteria
- [x] Directory tree depth 3 จาก ticket-system/ documented
- [x] Entry points identified: package.json, next.config.ts, prisma/schema.prisma
- [x] Subsystem list ครบ:
  - Auth (login, server actions)
  - Tickets (admin/technician/user dashboards, server actions)
  - Notifications (LINE Notify, NotificationBell, in-app)
  - LINE LIFF integration
  - Image handling (HEIC viewer, proxy-image)
  - Signature capture
  - Database (Prisma + PostgreSQL via Supabase)
  - Webhook
- [x] Tech stack listed: Next.js 16, React 19, Prisma 5, Supabase, LINE LIFF, TypeScript, lucide-react, dnd, react-signature-canvas, heic2any
- [x] Codebase size classified (S/M/L)
- [x] Each subsystem section: Source files, Scan tier=L1, Last reviewed, Purpose, Architecture, Key Functions table, Critical Invariants, Known Quirks
- [x] Recommendation flag: เสนอ L2 follow-up หรือ L3 ตามขนาด

## Boundaries
- Do NOT modify: source code (read-only L1 scan)
- Do NOT run: `npm install`, build, test, migrate (ไม่จำเป็นสำหรับ L1)

## Notes
File path: `c:/Web_repair_center/Development/Web_repair_center/PreExisting TechStack/Web_repair_center.md`
ตามมาตรฐาน §5 — ใช้ format ใน rules/codebase-scanning.md
