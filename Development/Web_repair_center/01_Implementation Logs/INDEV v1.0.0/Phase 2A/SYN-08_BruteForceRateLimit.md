# SYN-08 — Brute-force rate limit on login

**Phase:** 2A
**Team:** Syndicate
**Status:** [x] Complete
**Complexity:** Medium
**Depends on:** MON-10 (FailedLoginAttempt table)
**Blocks:** None

## Scope
เพิ่ม brute-force protection ใน `ticket-system/src/app/actions/auth.ts` `login()`:
- track failed attempts per `Username` ใน `FailedLoginAttempt` table
- ถ้า ≥ N failed ใน window M minutes → lockout L minutes (return error, ไม่ check password)
- ทำความสะอาด attempts ของ user หลัง login สำเร็จ

## Configurable Thresholds (env-driven with defaults)
```
RATE_LIMIT_MAX_ATTEMPTS=10    # default 10 fails
RATE_LIMIT_WINDOW_MIN=15      # within 15 min
RATE_LIMIT_LOCKOUT_MIN=15     # locked for 15 min
```

## Acceptance Criteria
- [ ] Modify `auth.ts` `login()`:
  - Before existing user lookup → check `FailedLoginAttempt` count for `Username` in last `WINDOW_MIN`
  - If count >= `MAX_ATTEMPTS` AND latest attempt within `LOCKOUT_MIN`:
    - Return `{ success: false, error: "ลองเข้าระบบล้มเหลวหลายครั้งเกินไป กรุณารอ <N> นาที" }`
  - On failed password compare (both bcrypt path + legacy path):
    - INSERT into `FailedLoginAttempt`
  - On successful login:
    - DELETE `FailedLoginAttempt` WHERE `Username = ?` (clear slate)
- [ ] Add error code `ERR_AUTH_RATE_LIMITED = -1010` to `ErrorCatalog.md`
- [ ] `.env.example` add 3 RATE_LIMIT_* placeholder vars + comments
- [ ] `npm run build` PASS
- [ ] `tsc --noEmit` clean
- [ ] Regression test added: `09_TestCase/_regression/login_rate_limit.spec.md`
  - TC: failed attempts < MAX → still allow attempt
  - TC: failed attempts >= MAX within window → lockout
  - TC: success clears attempts
  - TC: attempt outside window → no lockout

## Performance Note
- COUNT query per login = 1 extra DB roundtrip — acceptable for login flow
- Index `[Username, AttemptedAt]` (MON-10) makes count efficient

## Boundaries
- Do NOT change: function signature ของ login()
- Do NOT change: session cookie format
- Do NOT block by IP (use Username — IP block is Phase 2B Operations concern)
- Do NOT delete: existing `FailedLoginAttempt` rows of other users on user X's success

## Notes
- Rate limit ตั้ง defaults loose พอ — admin/user ทั่วไปจะไม่โดน lockout (10 attempts/15min generous)
- ถ้า user โดน lockout ผิดพลาด → admin ลบ row ใน FailedLoginAttempt ผ่าน Supabase SQL ได้
- ตอนนี้ Phase 2A ยังไม่มี admin UI สำหรับ unlock — Phase 2D จะมี
