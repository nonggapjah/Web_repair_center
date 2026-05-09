# Phase 0.5 — Password Security Migration

**Project:** Web_repair_center
**Phase:** 0.5 (Security)
**Date:** 09-05-2026
**Authorized by:** Commander ท่านผู้บัญชาการ
**Owning Team:** Syndicate (lead, security domain) + Monolith (DB schema/migration)
**Verification:** Overseer AS (UX smoke test)

---

## 1. Context

จาก [PreExisting TechStack/Web_repair_center.md](../../PreExisting%20TechStack/Web_repair_center.md) Critical Issues #1 และ #2:

- **Plaintext password storage** — `User.Password` เก็บแบบ plaintext, compare ด้วย `!==` ใน [actions/auth.ts:18](../../../../ticket-system/src/app/actions/auth.ts#L18)
- **Default password "1234"** — ใน [prisma/schema.prisma:21](../../../../ticket-system/prisma/schema.prisma#L21) ทุก user ใหม่จะได้ password = "1234"
- ผลกระทบ: ถ้า DB leak → ทุกรหัสรั่วทันที, brute-force trivial เพราะไม่มี hashing

## 2. Goals

1. เปลี่ยน password storage เป็น bcrypt hash (industry standard, salt-builtin)
2. Migrate password ของ user ที่มีอยู่ทั้งหมด → hash ในที่
3. เปลี่ยน default password schema → ปลอดภัยขึ้น
4. **รักษาเว็บให้ login ได้ปกติตลอดกระบวนการ** — ทุก user เดิมต้อง login ด้วย password เดิมได้
5. ไม่ต้องบังคับ user reset password (ตอนนี้ — อาจทำ Phase ถัดไป)

## 3. Non-Goals

- ไม่เพิ่ม MFA/2FA (อาจ Phase ถัดไป)
- ไม่เพิ่ม password complexity policy (อาจ Phase ถัดไป)
- ไม่ migrate ไป NextAuth/Auth.js (rewrite ที่ใหญ่เกิน scope นี้)
- ไม่บังคับ password reset

---

## 4. Strategy — Dual-Mode Migration (Zero Downtime)

แนวทางนี้รับประกันเว็บไม่ down และ user ไม่ต้อง reset password:

### Phase 0.5a — Add new field, keep old field
1. เพิ่ม `PasswordHash String?` ใน Prisma schema (nullable ก่อน — ไม่ break existing data)
2. Run `prisma migrate dev` — เพิ่ม column `PasswordHash` ใน DB ด้วย default NULL
3. **เก่า `Password` ยังอยู่** — เว็บยังทำงานปกติ

### Phase 0.5b — Update auth logic (dual-read)
1. ใน `auth.ts` login flow:
   - **ถ้า `user.PasswordHash` มีค่า** → ใช้ `bcrypt.compare(password, user.PasswordHash)` (path ใหม่)
   - **ถ้า `user.PasswordHash` เป็น null** → ใช้ plaintext compare เดิม (legacy fallback) **และ** hash password นั้นทันที + เก็บใน PasswordHash (lazy migration)
2. หลังจากนี้ user ที่ login ครั้งต่อไป → password ของเขาจะถูก hash อัตโนมัติ

### Phase 0.5c — Backfill migration script
1. รัน script (`scripts/migrate_passwords.ts`) — loop user ทั้งหมดที่ `PasswordHash` เป็น null และ Password ไม่ null:
   - hash Password → เก็บใน PasswordHash
   - **ยังไม่ลบ Password** (กันพลาด)
2. ตรวจสอบ: ทุก user ควรมี PasswordHash หลัง script รันเสร็จ

### Phase 0.5d — (Future cleanup, not this phase)
1. หลังจาก 1-2 สัปดาห์ที่ทุก user ได้ login อย่างน้อย 1 ครั้ง:
2. Migrate Password column ออก (drop column หรือ set null ทั้งหมด)
3. แก้ default ใน schema → `PasswordHash String?` no default

**Phase 0.5 นี้จะทำแค่ a, b, c — ไม่ทำ d เพราะเป็น cleanup ที่ต้องรอเวลา observe**

---

## 5. Tickets

| ID | Title | Team | Complexity | Touches Code? |
|----|-------|------|------------|---------------|
| SYN-01 | Add bcrypt dependency to package.json | Syndicate | Simple | Yes (package.json + lock) |
| MON-05 | Prisma schema: add PasswordHash field | Monolith | Simple | Yes (schema only) |
| MON-06 | Run prisma migrate dev — generate + apply migration | Monolith | Simple | Yes (DB structure) |
| SYN-02 | Implement bcrypt dual-mode in auth.ts (login + lazy migrate) | Syndicate | Medium | Yes (auth.ts) |
| SYN-03 | Backfill migration script (scripts/migrate_passwords.ts) | Syndicate | Medium | Yes (new script) |
| OVS-03 | UX smoke test — login flows for Admin/Tech/Branch | Overseer (AS) | Medium | No (testing only) |

**ZCB Status:**
- SYN-01 → Independent (just package.json)
- MON-05 → Independent (just schema)
- MON-06 → Depends on MON-05
- SYN-02 → Depends on SYN-01 + MON-05 (needs both bcrypt installed AND PasswordHash field exists)
- SYN-03 → Depends on SYN-02 (uses same hashing helper)
- OVS-03 → Depends on SYN-02 (testing the new logic)

Linear chain: `SYN-01 + MON-05 → MON-06 → SYN-02 → SYN-03 → OVS-03`

## 6. Risk Analysis

| Risk | Mitigation |
|------|-----------|
| bcrypt install fails on Windows (native compile) | Use `bcryptjs` (pure JS, slower but no native deps) — recommended for this project |
| Migration breaks login for existing users | Dual-mode design — legacy plaintext path remains as fallback until backfill complete |
| Backfill script crashes mid-run | Idempotent — re-runnable. Each iteration only updates rows where PasswordHash IS NULL |
| Prisma migration fails on production DB | Run on dev/staging first. `DIRECT_URL` required for migrate. |
| User logs in during migration window | Lazy migration in auth.ts handles their record on-the-fly |
| TypeScript build fails after schema change | Run `prisma generate` before any TS compile |

## 7. Recommendation: bcryptjs over bcrypt

**bcryptjs** (pure JS) — เหตุผล:
- ไม่มี native compile dependency → install ง่ายบนทุก OS
- compatible API กับ bcrypt
- speed difference ไม่สำคัญสำหรับโปรเจกต์ขนาดนี้ (พนักงาน Villa Market ไม่ใช่ million users)
- Next.js Server Actions รัน Node.js — ไม่มีปัญหา
- ไม่ต้อง config build extras

หากท่านต้องการ native bcrypt (faster) → ต้องมี Visual Studio Build Tools บน dev machines ทุกเครื่อง — ไม่แนะนำสำหรับ team ที่ใช้ Windows

## 8. Acceptance Criteria

- [ ] `bcryptjs` ติดตั้งและ import ได้
- [ ] `User.PasswordHash` field มีใน schema และ DB
- [ ] `auth.ts` login flow รองรับทั้ง legacy + new hash
- [ ] User เดิมทุกคน login ด้วย password เดิมได้ (manual smoke test)
- [ ] Lazy migration ทำงาน — login 1 ครั้งแล้ว PasswordHash ถูก populate
- [ ] Backfill script รันสำเร็จ — ทุก user ใน DB มี PasswordHash != null
- [ ] No regression: createTicket/getBranchTickets/dashboards ทั้งหมดยังทำงาน
- [ ] `npm run build` ใน ticket-system ยังสำเร็จ
- [ ] Phase 0.5 logged ใน RoundTable Session 2

## 9. Boundaries — Do NOT Touch

- **Do NOT** drop Password column ใน Phase 0.5 (Phase 0.5d เท่านั้น)
- **Do NOT** force password reset
- **Do NOT** เปลี่ยน auth API signatures (login/logout/getSession ต้องเหมือนเดิม)
- **Do NOT** แก้ default `"1234"` ใน schema ใน phase นี้ (Phase 0.5d)
- **Do NOT** rebase/squash commits — Phase 0.5 commits ตรงๆ ปกติ

## 10. Rollback Plan

ถ้าเจอปัญหา critical:
1. Revert auth.ts change → กลับไป plaintext compare (1 commit)
2. PasswordHash field สามารถปล่อยว่างไว้ใน DB ได้ (nullable)
3. Backfill script ไม่ destructive — reversible

ไม่ต้อง rollback DB migration เพราะ field nullable + ไม่มีอะไร depend on it

---

## 11. Implementation Order (this session)

1. ✅ Phase 0.5 plan document (this file)
2. SYN-01 — Add bcryptjs to package.json (manual edit, npm install)
3. MON-05 — Add PasswordHash to Prisma schema
4. MON-06 — Run `npx prisma generate` + `npx prisma migrate dev --name add_password_hash` — **CRITICAL: ต้องมี DATABASE_URL/DIRECT_URL ที่ถูกต้องก่อน**
5. SYN-02 — Implement dual-mode in auth.ts
6. SYN-03 — Write `scripts/migrate_passwords.ts`
7. OVS-03 — Build verify (`npm run build`) — verify ไม่ break (full E2E login test ต้องการ DB จริง — แจ้ง Commander)

**Note ถึง Commander:** Step 4 (MON-06) ต้องการ DB connection จริง — ถ้าตอนนี้ไม่มี DB เชื่อม จะ migrate ไม่ได้ ต้องดูว่าท่านมี Supabase project พร้อม DATABASE_URL/DIRECT_URL ตอนนี้หรือไม่ ถ้าไม่ ผมจะหยุดที่ step 5 (เปลี่ยน schema + auth.ts code only — ไม่รัน migrate จริง) แล้วเตรียมให้ท่านรัน migrate เองตอนพร้อม
