# BUG-03 — Admin password "password123" hardcoded in seed script

**Project:** Web_repair_center
**Phase:** 0.5 (Hotfix follow-up)
**Team:** Syndicate (security lead)
**Status:** [x] Complete — all 3 steps resolved on 09-05-2026
**Severity:** 🔴 CRITICAL — admin account has hardcoded weak password committed to git history
**Discovered:** 09-05-2026 ระหว่าง investigate BUG-01

## Progress (09-05-2026)
- ✅ Step 2 — Code fix: `seed_production.mjs` แก้แล้ว, อ่าน `ADMIN_INITIAL_PASSWORD` จาก env, skip admin seed ถ้าไม่ตั้ง, validate length >= 12 chars
- ✅ Step 2 — `.env.example` updated เพิ่ม `ADMIN_INITIAL_PASSWORD` placeholder + doc
- ⏳ Step 1 — DB rotation: **PENDING — Commander ต้อง generate strong password + rotate admin row ทันที** (instructions ใน Action Items ด้านล่าง)
- ⏳ Step 3 — Git history decision: pending Commander confirm rotate-only vs scrub

## Symptom
[seed_production.mjs:94,97](../../../../../ticket-system/seed_production.mjs#L94) สร้าง/อัปเดต admin user ด้วย:
```javascript
update: { Password: 'password123', Role: 'Admin', BranchID: adminBranch.BranchID },
create: {
  Username: 'admin',
  Password: 'password123',
  ...
}
```

**ปัญหา:**
1. Password = `"password123"` เป็นรหัสที่ติด top-100 ของ rockyou.txt และ HaveIBeenPwned breach lists — ใครเดาได้ใน 1 ลอง
2. รหัสนี้อยู่ใน git history (committed to public/private repo) — ใครเข้าถึง repo = รู้รหัส admin ทันที
3. หาก git history โดน leak (เช่น repo public, accidentally pushed) → full admin takeover

## Risk Profile
- **Pre-Phase 0.5:** admin login ด้วย "password123" plaintext compare → success ทันที
- **Post-Phase 0.5 backfill:** admin row มี PasswordHash = bcrypt("password123") → ใครรู้รหัสจาก git history ก็ยัง login ได้ผ่าน bcrypt path
- **Username "admin"** เดาได้ง่าย + รหัสติด rockyou = brute-force trivial แม้ไม่อ่าน git

## Fix Plan

### Step 1 — เปลี่ยน password admin ทันที (out-of-band)
1. สร้าง strong password 16+ chars (mix upper/lower/digit/symbol)
2. Hash ผ่าน bcrypt rounds=10
3. Update DB row admin: `UPDATE "User" SET "Password" = '<new_plaintext>', "PasswordHash" = '<new_hash>' WHERE "Username" = 'admin'`
4. แจ้ง Commander ผ่านช่อง secure (ไม่ผ่าน chat/git) — ผมแนะนำให้ Commander generate เอง

### Step 2 — แก้ seed_production.mjs ให้รับ password จาก env
1. `const adminPassword = process.env.ADMIN_INITIAL_PASSWORD`
2. ถ้า env ไม่ตั้ง → skip admin seed (ไม่สร้าง weak default)
3. ถ้า env ตั้งแล้ว → hash + seed + ลบ env ที่ rotate
4. Update `.env.example` เพิ่ม `ADMIN_INITIAL_PASSWORD` placeholder + comment ว่า rotate ทันทีหลัง seed

### Step 3 — Git history scrubbing (Decision needed)
Option A: Leave history alone, rotate password (current weak password becomes useless after fix)
Option B: BFG Repo-Cleaner หรือ git-filter-repo เพื่อลบ "password123" ออกจาก history
- ❗ จะ rewrite history → ทุกคนต้อง force-pull
- ❗ ถ้า repo เคย clone โดยใครก็ตาม รหัสยังหลุดอยู่ใน clone ของเขา

แนะนำ **Option A** (rotate + accept residual history exposure) — เพราะ practical และ password ใหม่จะ invalidate รหัสเก่าทันที

## Acceptance Criteria
- [x] Admin user ใน DB มี Password + PasswordHash ที่ตรงกับ new strong password
- [x] seed_production.mjs ไม่มี string `"password123"` ใน code
- [x] seed_production.mjs อ่าน admin password จาก env (`ADMIN_INITIAL_PASSWORD`)
- [x] seed_production.mjs skip admin seed ถ้า env ไม่ตั้ง (no silent default)
- [x] `.env.example` เพิ่ม `ADMIN_INITIAL_PASSWORD` placeholder
- [x] Verified: bcrypt(new) => true, bcrypt(old "password123") => false
- [x] Decision: rotate-only (Commander chose Option A — accept residual git exposure)
- [x] BUG-02 fix completed before this ticket

## Boundaries
- Do NOT commit: new admin password ใน plaintext (เก็บใน .env หรือ password manager เท่านั้น)
- Do NOT add: more hardcoded passwords ใน seed scripts
- Do NOT push: changes ก่อน Commander generate new strong password

## Dependencies
- **Blocks:** Phase 1 production hardening
- **Depends on:** BUG-02 fix (seed script must support PasswordHash sync first)

## Notes
- Password rotation reminder: schedule quarterly rotate cycle หลังจาก fix นี้
- หาก project มี multi-admin → ใช้ pattern เดียวกัน (env-driven, no hardcoded)
- Phase 1 อาจเพิ่ม MFA สำหรับ admin role

---

## Action Items for Commander (Step 1 — DB Rotation, URGENT)

ทำตามลำดับนี้ครับ ท่านผู้บัญชาการ:

### A. Generate new strong password
ใช้คำสั่งใน PowerShell (สุ่ม 20 chars):
```powershell
-join ((1..20) | ForEach-Object { [char]((33..126) | Get-Random) })
```
หรือใช้ password manager (1Password, Bitwarden) สุ่มให้ — เก็บไว้ในที่ปลอดภัย

### B. Rotate admin password ใน DB (เลือก 1 ใน 2)

**Option 1 — ผ่าน seed_production.mjs ที่แก้แล้ว:**
1. เปิด `ticket-system/.env` ของท่าน
2. เพิ่มบรรทัด: `ADMIN_INITIAL_PASSWORD="<new_strong_password_from_step_A>"`
3. รัน: `cd ticket-system; node seed_production.mjs`
4. ดู console: ต้องเห็น `✅ Ensured admin user exists (password hashed from ADMIN_INITIAL_PASSWORD)`
5. **ลบบรรทัด `ADMIN_INITIAL_PASSWORD` ออกจาก .env ทันที** หลังรันเสร็จ (ไม่ให้เก็บ plaintext อยู่ใน env)

**Option 2 — Update DB ตรง (ถ้าไม่อยาก rerun seed ของ 45 branches):**
ใช้ Supabase SQL Editor — รัน:
```sql
-- ขอให้ AI generate hash ใน step แยกก่อนรัน นี้
UPDATE "User"
SET "Password" = '<new_strong_password>',
    "PasswordHash" = '<bcrypt_hash_of_new_password>'
WHERE "Username" = 'admin';
```

### C. ทดสอบ login admin
1. เปิด `/login`
2. Username: `admin`, Password: `<new_strong_password>`
3. ต้อง redirect ไป `/admin/dashboard`
4. ทดสอบ password เก่า `password123` → ต้อง reject

### D. Mark this ticket Complete
หลัง Step C สำเร็จ → เปลี่ยน Status ใน ticket นี้เป็น `[x] Complete`

---

## ## Resolution (09-05-2026)

**Method:** Ephemeral env var via PowerShell session — set `ADMIN_INITIAL_PASSWORD` ใน session ปัจจุบัน → รัน `node seed_production.mjs` → `Remove-Item Env:\ADMIN_INITIAL_PASSWORD`. รหัสไม่เคยถูกเขียนลง `.env` ไฟล์.

**Verification results:**
- `Password` column updated to new value: PASS
- `PasswordHash` regenerated (bcrypt rounds=10): PASS
- `bcrypt.compare(new_password, hash)` returns `true`: PASS
- `bcrypt.compare("password123", hash)` returns `false`: PASS — old password no longer accepted
- Branch user sanity check (user 1000): unchanged, still works with `vl1000`: PASS
- Seed reran all 45 branches with re-generated hashes (functionally equivalent — bcrypt salt different, compare result same)

**Git history note:** Per Commander decision (Option A from Fix Plan Step 3), git history scrub NOT performed — old password `password123` is now invalidated in DB, so residual exposure in git history is harmless.

**Probe cleanup:** Created `scripts/check_admin.ts` + `scripts/verify_admin_rotation.ts` for debug/verification — both deleted per §6 RELEASE rule (remove-on-fix).