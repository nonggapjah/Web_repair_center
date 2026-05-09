# MON-05 — Prisma schema: add PasswordHash field

**Phase:** 0.5
**Team:** Monolith
**Status:** [x] Complete
**Complexity:** Simple
**Depends on:** None
**Blocks:** MON-06, SYN-02

## Scope
เพิ่ม `PasswordHash String?` ใน Prisma `User` model — nullable เพื่อรักษา backward compat (existing rows ยังไม่มีค่า)

## Acceptance Criteria
- [x] `prisma/schema.prisma` `User` model มี field `PasswordHash String?` หลัง field `Password`
- [x] `Password` field ยังคงอยู่ (Phase 0.5d ค่อยลบ)
- [x] `npx prisma generate` สำเร็จ — Prisma Client type มี `passwordHash` (camelCase by Prisma convention)
- [x] ไม่แก้ default ของ `Password` (ยังคง `"1234"` ไว้ Phase 0.5d ค่อยจัดการ)
- [x] schema เป็น valid Prisma DSL — `npx prisma format` ไม่บ่น

## Boundaries
- Do NOT remove: existing `Password` field
- Do NOT change: other fields, indexes, or relations
- Do NOT migrate DB ใน ticket นี้ (MON-06 จะรัน migrate)

## Notes
หลัง schema เปลี่ยน → ต้อง `npx prisma generate` ทุกครั้งก่อน TS compile (script `build` ทำให้แล้ว)
