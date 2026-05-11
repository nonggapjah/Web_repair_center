# Regression Test — Auth Dual-Mode Login

**Created:** 09-05-2026
**Linked Bug:** [BUG-01](../../05_BugFixesLog/AuthLoginBroken_Phase0.5/BUG-01_LoginBroken.md)
**Owner:** Syndicate (auth flow) + Overseer AS (verification sign-off)
**Status:** Permanent — never delete (per §2 Hotfix Regression Gate)

## Purpose
ป้องกันการ regress ของ Phase 0.5 password security migration — ยืนยันว่า:
1. Login ทำงานสำหรับ user ที่มี PasswordHash (post-migration path)
2. Login ทำงานสำหรับ user ที่ยังเป็น legacy plaintext (pre-migration path)
3. Lazy migration ทำงาน — user legacy login 1 ครั้ง → PasswordHash ถูก populate
4. Login ผิด password ต้อง reject (ทั้ง 2 paths)

## Test Cases

### TC-01 — Existing user with PasswordHash (post-backfill)
**Setup:**
- User row: Username="1000", Password="vl1000" (plaintext column ยังอยู่), PasswordHash=valid bcrypt of "vl1000"

**Steps:**
1. Open `/login`
2. Username: `1000`
3. Password: `vl1000`
4. Click "เข้าสู่ระบบ"

**Expected:**
- Server action `login()` enters PasswordHash branch
- `bcrypt.compare("vl1000", hash)` returns true
- `user_session` cookie set
- Redirect to `/user/dashboard`

**Pass criteria:** Login succeeds, session cookie present, dashboard loads

---

### TC-02 — Wrong password rejected (PasswordHash path)
**Setup:** Same user as TC-01

**Steps:**
1. Username: `1000`, Password: `wrong_pw_xyz`
2. Submit

**Expected:**
- `bcrypt.compare` returns false
- Response: `{ success: false, error: "รหัสผ่านไม่ถูกต้อง" }`
- No cookie set, no redirect

**Pass criteria:** UI shows "รหัสผ่านไม่ถูกต้อง", remains on `/login`

---

### TC-03 — Legacy user (PasswordHash NULL) — fallback + lazy migration
**Setup:**
- Create test user: Username="legacy_test", Password="legacy_pw_123", PasswordHash=NULL

```sql
INSERT INTO "User" ("UserID", "Username", "Password", "PasswordHash", "Role", "BranchID")
VALUES ('test-uuid-001', 'legacy_test', 'legacy_pw_123', NULL, 'User', '<existing-branch-id>');
```

**Steps:**
1. Username: `legacy_test`, Password: `legacy_pw_123`
2. Submit

**Expected:**
- Server enters legacy branch (`u.PasswordHash` is null)
- Plaintext compare succeeds
- Lazy migration triggers: `bcrypt.hash` + `prisma.user.update({ PasswordHash })`
- Login succeeds, redirect

**Pass criteria:**
- Login succeeds
- After login, query DB: `SELECT "PasswordHash" FROM "User" WHERE "Username"='legacy_test'`  → not null, valid bcrypt format

**Cleanup:** `DELETE FROM "User" WHERE "Username"='legacy_test'`

---

### TC-04 — Wrong password rejected (Legacy path)
**Setup:** legacy_test user (or recreate if TC-03 cleanup done)

**Steps:**
1. Username: `legacy_test`, Password: `wrong_legacy`
2. Submit

**Expected:**
- Plaintext compare fails
- No lazy migration triggered (PasswordHash stays NULL)
- Response: error

**Pass criteria:** UI shows error, no cookie, PasswordHash still NULL after fail attempt

---

### TC-05 — Username not found
**Steps:**
1. Username: `nonexistent_user_zzz`, Password: anything
2. Submit

**Expected:** `{ success: false, error: "ไม่พบชื่อผู้ใช้งานนี้ในระบบ" }`

---

### TC-06 — Empty password
**Steps:**
1. Username: `1000`, Password: (empty)
2. Submit

**Expected:** Client-side validation blocks submit (form requires both fields) OR server returns error

---

## Frequency
- ✅ Manual: ก่อนทุก deploy ของ auth flow
- ✅ Manual: ก่อน Phase 0.5d cleanup (drop Password column)
- 📋 Automated: TODO — Phase 1 ticket จะแปลงเป็น Playwright/Vitest test

## Last Run
| Date | Tester | Result | Notes |
|------|--------|--------|-------|
| 09-05-2026 | Commander (manual on localhost:3000) | TC-01 PASS | Confirmed via `inspect_user.ts` + manual login |
| 09-05-2026 | TC-02..TC-06 | NOT YET RUN | Manual run needed before next deploy |

## Boundaries
- This test SHALL NOT be deleted, even when Password column is dropped (Phase 0.5d) — TC-03/TC-04 จะถูกอัปเดตให้สะท้อน new schema (drop legacy path) แต่ test file คงอยู่
