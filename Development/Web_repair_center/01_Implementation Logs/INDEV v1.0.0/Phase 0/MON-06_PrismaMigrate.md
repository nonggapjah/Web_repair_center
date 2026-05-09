# MON-06 — Run prisma migrate dev

**Phase:** 0.5
**Team:** Monolith
**Status:** [x] Complete
**Complexity:** Simple
**Depends on:** MON-05
**Blocks:** SYN-02 testing, SYN-03

## Scope
รัน `npx prisma migrate dev --name add_password_hash` จาก `ticket-system/` directory เพื่อ:
1. Generate migration SQL ใน `prisma/migrations/`
2. Apply migration to DB (เพิ่ม column `PasswordHash` ใน table `User`)
3. Regenerate Prisma Client

## Acceptance Criteria
- [x] `prisma/migrations/<timestamp>_add_password_hash/migration.sql` exists with `ALTER TABLE "User" ADD COLUMN "PasswordHash" TEXT`
- [x] Migration applied to remote DB (Supabase) สำเร็จ
- [x] `User` table มี column `PasswordHash` (nullable)
- [x] `_prisma_migrations` table มี entry ใหม่
- [x] `npx prisma generate` ทำงาน (Prisma Client มี `passwordHash`)
- [x] เว็บยัง query User ได้ (existing user records ยังครบ — column ใหม่ NULL)

## Boundaries
- Do NOT use: `prisma db push` (skip migration history) — ต้องใช้ `migrate dev` เพื่อ track history
- Do NOT use: `--create-only` flag (ต้องการ apply ทันที)

## Notes
ต้องการ env: `DATABASE_URL` + `DIRECT_URL` (อยู่ใน `ticket-system/.env`)

ถ้า migrate fail → ตรวจ:
1. .env values ถูกต้อง
2. Network เชื่อม Supabase ได้
3. DIRECT_URL connection allowed (Supabase pooler vs direct)
