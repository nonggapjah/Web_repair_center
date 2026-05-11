# SYN-09 — Role-based session timeout

**Phase:** 2A
**Team:** Syndicate
**Status:** [x] Complete
**Complexity:** Simple
**Depends on:** None
**Blocks:** None

## Scope
ปัจจุบัน `auth.ts:46` hardcode `maxAge: 60 * 60 * 24` (1 day) ทุก role เปลี่ยนเป็น role-based:
- **Admin** — 4 ชม. (3600 * 4)
- **Technician** — 8 ชม. (3600 * 8)
- **User (Branch)** — 24 ชม. (3600 * 24) — ตาม current behavior

## Configurable (env-driven defaults)
```
SESSION_TIMEOUT_ADMIN_SEC=14400      # 4 hours
SESSION_TIMEOUT_TECHNICIAN_SEC=28800 # 8 hours
SESSION_TIMEOUT_USER_SEC=86400       # 24 hours
```

## Acceptance Criteria
- [ ] Modify `auth.ts` `login()`:
  - Add helper `getSessionTimeoutForRole(role: string): number`
  - In `cookies().set(...)` → use `maxAge: getSessionTimeoutForRole(user.Role)`
- [ ] `.env.example` add 3 SESSION_TIMEOUT_* placeholder vars + comments
- [ ] `npm run build` PASS
- [ ] `tsc --noEmit` clean
- [ ] Manual test (or regression spec):
  - Login admin → check Set-Cookie Max-Age = 14400
  - Login technician → 28800
  - Login user → 86400
- [ ] Regression spec: `09_TestCase/_regression/session_timeout.spec.md`

## Boundaries
- Do NOT change: cookie name, httpOnly, secure, path
- Do NOT modify: existing logged-in sessions (only NEW logins affected — existing cookies natural expiry)
- Do NOT add: session refresh / extend on activity (Phase 2B+ scope)

## Notes
- Independent of MON-10 — ทำ parallel กับ MON-10 ได้ (no shared file with MON-10)
- Independent of SYN-08 (rate limit) — แต่ทั้งคู่แก้ auth.ts → ทำใน subagent เดียวกัน sequential เพื่อเลี่ยง merge
- ค่า defaults conservative: Admin ตัดสั้นเพราะ privilege สูง, User ยาวสุดเพราะ flow แจ้งซ่อมอาจขาดสาย
