# SYN-03 — Password backfill script

**Phase:** 0.5
**Team:** Syndicate
**Status:** [x] Complete
**Complexity:** Medium
**Depends on:** SYN-02
**Blocks:** OVS-03 (final verification)

## Scope
สร้าง `ticket-system/scripts/migrate_passwords.ts` — one-shot migration script ที่ hash plaintext password ของ user ทุกคนที่ยังไม่มี PasswordHash ลง column ใหม่

## Acceptance Criteria
- [x] Script ที่ `ticket-system/scripts/migrate_passwords.ts`
- [x] Idempotent — รันซ้ำได้ ปลอดภัย (skip user ที่มี PasswordHash อยู่แล้ว)
- [x] Logic:
  1. Connect ผ่าน Prisma client
  2. `findMany` user ที่ `PasswordHash IS NULL`
  3. สำหรับแต่ละ user: hash `Password` ด้วย bcrypt rounds=10 → update `PasswordHash`
  4. Print progress: `Migrated: <username> (X/Y)`
  5. Print summary: total migrated, total skipped, total errors
  6. Disconnect Prisma
- [x] ไม่ลบ Password column / ไม่ set Password เป็น null (Phase 0.5d ค่อยทำ)
- [x] Error handling: ถ้า user ไหน fail → log error, ทำต่อไป (ไม่หยุดทั้ง batch)
- [x] รันผ่าน `npx tsx scripts/migrate_passwords.ts` หรือ `node` หลัง compile
- [x] Verify: หลังรันเสร็จ `SELECT count(*) FROM "User" WHERE "PasswordHash" IS NULL` = 0

## Boundaries
- Do NOT delete: existing users
- Do NOT modify: Password column values
- Do NOT add: เป็น automated script ใน build/seed (manual run เท่านั้น)
- Do NOT auto-run on startup

## Notes
ต้องการ env เดียวกับ Prisma — script ควร `import "dotenv/config"` หรือ Node 20+ จะ auto-load .env

ถ้าไม่มี `tsx` ใน devDependencies → ใช้ `npx tsx` (จะใช้จาก npx cache) หรือเขียนเป็น `.js` แทน
