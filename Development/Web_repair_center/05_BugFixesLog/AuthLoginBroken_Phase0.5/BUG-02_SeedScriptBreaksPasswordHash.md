# BUG-02 — seed_production.mjs writes Password but skips PasswordHash sync

**Project:** Web_repair_center
**Phase:** 0.5 (Hotfix follow-up)
**Team:** Syndicate (auth/security) + Monolith (seed script ownership)
**Status:** [x] Complete
**Severity:** 🟡 HIGH — timing bomb. ปัจจุบันยังไม่ trigger เพราะค่า telex ไม่ได้เปลี่ยน แต่จะระเบิดถ้า:
- มี admin/dev เปลี่ยนค่า telex ใน seed_production.mjs แล้ว rerun
- ทุก branch user ที่ telex เปลี่ยน → login พังทันที
**Discovered:** 09-05-2026 ระหว่าง investigate BUG-01

## Symptom (Predicted)
ถ้าใครเปลี่ยน telex ของสาขา "1000" จาก `"vl1000"` → `"newpass2026"` ใน [seed_production.mjs](../../../../../ticket-system/seed_production.mjs) แล้วรัน `node seed_production.mjs`:
1. DB row "1000" จะมี `Password = "newpass2026"` (อัปเดตแล้ว) แต่ `PasswordHash` ยังเป็น `bcrypt("vl1000")`
2. User login ด้วย `"newpass2026"` → `bcrypt.compare("newpass2026", bcrypt("vl1000"))` = `false` → reject
3. User login ด้วย `"vl1000"` (รหัสเก่า) → `bcrypt.compare("vl1000", bcrypt("vl1000"))` = `true` → login สำเร็จด้วยรหัสที่ admin คิดว่ายกเลิกไปแล้ว 😱

นี่เป็น **silent security issue** — ระบบดู intent คือเปลี่ยน password แต่ค่าเก่ายังใช้งานได้

## Root Cause
[seed_production.mjs:67-76](../../../../../ticket-system/seed_production.mjs#L67) ใช้ `prisma.user.upsert`:
```javascript
await prisma.user.upsert({
  where: { Username: b.code },
  update: { Password: b.telex, BranchID: branch.BranchID },  // ❌ ไม่ touch PasswordHash
  create: {
    Username: b.code,
    Password: b.telex,                                       // ❌ create ก็ไม่ hash
    Role: 'User',
    BranchID: branch.BranchID,
  },
});
```

`update` clause เขียน `Password` แต่ไม่ touch `PasswordHash` → PasswordHash ค้างจากการ hash ครั้งก่อน
`create` clause สร้าง user ใหม่โดยไม่ hash password → user ใหม่จะมีแค่ Password (plaintext) ไม่มี PasswordHash → login ครั้งแรกจะใช้ legacy path + lazy migrate (ปลอดภัยใน Phase 0.5 a-c)

Admin user upsert (line 86-105) มีปัญหาเดียวกัน + ปัญหาเพิ่มเติม: password = `"password123"` hardcoded (ดู BUG-03)

## Hypotheses (verified by code reading)
1. ✅ ยืนยัน — `update` clause เขียน Password อย่างเดียว
2. ✅ ยืนยัน — `create` clause ไม่ hash
3. ✅ ยืนยัน — bcryptjs ไม่ถูก import ใน seed_production.mjs

## Fix Plan

### Option A — Hash ภายใน seed_production.mjs (recommended)
1. `import bcrypt from "bcryptjs"`
2. คำนวณ `hash = await bcrypt.hash(b.telex, 10)` ก่อน upsert
3. ใน `update` + `create`: เขียน **ทั้ง** `Password` (ยังคงไว้สำหรับ Phase 0.5d cleanup) + `PasswordHash` (hash ของ telex ปัจจุบัน)
4. Idempotent — seed ซ้ำจะ overwrite ทั้งสอง column ให้ sync

### Option B — Seed เขียน Password อย่างเดียว, ให้ migrate script รัน
1. Seed ทำเหมือนเดิม (เขียน Password)
2. หลัง seed → ต้องรัน `migrate_passwords.ts` เสมอ
3. ❌ ปัญหา: migrate_passwords.ts ปัจจุบัน skip user ที่มี PasswordHash อยู่แล้ว — ไม่ overwrite
4. ต้องแก้ migrate_passwords.ts ให้รองรับ "re-hash mode" หรือเพิ่ม flag

แนะนำ **Option A** ครับ — ลด step, atomic, ไม่ต้อง maintain 2 scripts

## Acceptance Criteria
- [x] [seed_production.mjs](../../../../../ticket-system/seed_production.mjs) import bcryptjs
- [x] ทั้ง branch user upsert + admin user upsert: hash telex/password ก่อน → เขียน `PasswordHash` ใน `update` และ `create`
- [ ] Run script จริง: ทุก row ใน User table ที่ถูก seed มี `PasswordHash` ที่ match กับ telex ปัจจุบัน
- [ ] Idempotency check: run ซ้ำ 2 ครั้ง → state DB ไม่เปลี่ยน
- [ ] Login test: ทดสอบ branch user ที่ผ่าน seed → login ด้วย telex ปัจจุบันได้
- [ ] Regression test added (เพิ่มใน `auth_dualmode.spec.md` ที่มีอยู่)
- [ ] Document ใน DeploymentRunbook (เมื่อสร้าง) ว่า seed_production.mjs ตอนนี้รับผิดชอบ PasswordHash sync แล้ว

## Boundaries
- Do NOT modify: branches[] data (รักษาข้อมูลสาขาเดิม)
- Do NOT remove: Password column write (รักษา compat กับ legacy path ใน auth.ts จนกว่า Phase 0.5d)
- Do NOT touch: migrate_passwords.ts logic (ยังคงเป็น one-shot backfill)

## Notes
- Phase 0.5d ตอนลบ Password column → seed_production.mjs จะเขียนแค่ PasswordHash อย่างเดียว
- ตอนนั้น script ใหม่อาจรับ telex จาก env หรือ argv แทน hardcode ใน array
