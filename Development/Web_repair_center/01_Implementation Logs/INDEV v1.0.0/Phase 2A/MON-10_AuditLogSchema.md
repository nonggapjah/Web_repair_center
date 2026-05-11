# MON-10 — Schema: AuditLog + FailedLoginAttempt tables

**Phase:** 2A
**Team:** Monolith
**Status:** [x] Complete
**Complexity:** Simple
**Depends on:** None
**Blocks:** SYN-08, SYN-11

## Scope
เพิ่ม 2 tables ใน Prisma schema สำหรับ Phase 2A security features:
1. `AuditLog` — บันทึก admin actions
2. `FailedLoginAttempt` — track brute-force protection state

## Schema Spec

### AuditLog
```prisma
model AuditLog {
  LogID       String   @id @default(cuid())
  UserID      String?  // who performed (nullable for system events)
  Action      String   // e.g. "ticket.status.update", "ticket.technician.assign", "user.role.change"
  EntityType  String?  // e.g. "RepairTicket", "User"
  EntityID    String?  // e.g. ticketId
  Before      String?  // JSON snapshot before (nullable for create actions)
  After       String?  // JSON snapshot after (nullable for delete actions)
  IPAddress   String?  // best-effort from request headers
  UserAgent   String?  // best-effort
  Timestamp   DateTime @default(now())

  @@index([UserID])
  @@index([Action])
  @@index([EntityType, EntityID])
  @@index([Timestamp])
}
```

### FailedLoginAttempt
```prisma
model FailedLoginAttempt {
  AttemptID    String   @id @default(cuid())
  Username     String   // username tried (case-preserved)
  IPAddress    String?  // best-effort
  AttemptedAt  DateTime @default(now())

  @@index([Username, AttemptedAt])  // for windowed-count queries
}
```

## Acceptance Criteria
- [x] Update `ticket-system/prisma/schema.prisma` — add 2 models above
- [x] Run `npx prisma format` → clean ("Formatted prisma\schema.prisma in 36ms")
- [x] Run `npx prisma validate` → valid ("The schema at prisma\schema.prisma is valid")
- [x] Run `npx prisma db push` → DB has 2 new tables + indexes ("Your database is now in sync with your Prisma schema. Done in 1.93s")
- [x] Run `npx prisma generate` → Prisma Client knows the new models (auto-run by `db push`; also re-verified during `npm run build`)
- [x] Verify via Supabase introspection: AuditLog (10 cols / 5 indexes incl. PK) + FailedLoginAttempt (4 cols / 2 indexes incl. PK) exist, both empty (count = 0)
- [x] `npm run build` PASS (Next.js 16.2.6 Turbopack — compiled in 4.4s, TypeScript clean, 9 pages generated)
- [x] No regression on existing models — 7 user-facing routes intact (`/`, `/admin/dashboard`, `/api/proxy-image`, `/login`, `/technician/dashboard`, `/user/dashboard`, `/user/new-ticket`) + `/_not-found`

## Boundaries
- Do NOT touch: existing models structure
- Do NOT add: foreign keys to User (FailedLoginAttempt — username may not exist, optional fk causes issues; AuditLog UserID — keep as string ref, not relation, to allow soft-delete of users without losing audit trail)
- Do NOT delete: any existing data

## Notes
- AuditLog.Before/After เก็บเป็น JSON string (Prisma `String?`) — flexible schema
- IPAddress + UserAgent best-effort — Next.js Server Actions รับ headers จาก context (request not always available)
- Index strategy: query patterns expected = "ที่ user X ทำอะไร", "ที่ entity Y ถูกแก้", "ในช่วงเวลา Z"
- ไม่ตั้ง relation กับ User เพราะ Phase 0.5d จะลบ Password column → User schema อาจเปลี่ยน, AuditLog ต้องไม่ภาษากระทบ
