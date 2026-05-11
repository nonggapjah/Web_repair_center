# Regression — Login Brute-Force Rate Limit (SYN-08)

**Phase:** 2A — Security Hardening
**Filed by:** Syndicate (AX/WT)
**Date:** 11-05-2026
**Related Ticket:** SYN-08
**Source under test:** `ticket-system/src/app/actions/auth.ts` — `login()`, `checkRateLimit()`, `recordFailedAttempt()`, `clearFailedAttempts()`
**DB tables touched:** `FailedLoginAttempt` (MON-10)

## Purpose
Prevent reverting the brute-force protection on `login()`. Locks in:
- COUNT-then-reject ordering (gate runs BEFORE password compare and BEFORE user lookup).
- Failed-attempt ledger entry on every wrong-password / unknown-user / missing-password path.
- Clear-on-success of all `FailedLoginAttempt` rows for the winning Username.
- Env-driven thresholds with safe defaults.
- Fail-soft logging on ledger write/clear errors (login UX never blocked by ledger failure).

## Configurable
Defaults: `RATE_LIMIT_MAX_ATTEMPTS=10`, `RATE_LIMIT_WINDOW_MIN=15`, `RATE_LIMIT_LOCKOUT_MIN=15`.
Tests below run with defaults unless noted. For faster manual verification, set
`RATE_LIMIT_MAX_ATTEMPTS=3` / `RATE_LIMIT_WINDOW_MIN=1` / `RATE_LIMIT_LOCKOUT_MIN=1`.

## Test Cases

| TC | Action | Expected | Pass Criterion |
|----|--------|----------|----------------|
| TC-01 | Under cap — 9 wrong passwords for user `1000` within 15 min, then correct password on 10th try | All 9 return `"รหัสผ่านไม่ถูกต้อง"`, 10th succeeds | No premature lockout |
| TC-02 | At cap — 10 wrong passwords for user `1000` within 15 min, then 11th attempt | 11th returns `"ลองเข้าระบบล้มเหลวหลายครั้งเกินไป กรุณารอ N นาที"` (N = `LOCKOUT_MIN` rounded up) | Lockout fires; password is NOT checked |
| TC-03 | Cleared on success — TC-02 lockout active, but use known-good credentials for a different Username | Other user logs in normally | Lockout is per-Username, not per-IP |
| TC-04 | Success clears ledger — Successful login after 5 prior fails | Subsequent fails count from 0, not from 5 | `clearFailedAttempts()` ran |
| TC-05 | Outside window — 10 wrong passwords spread over > 15 min (e.g., one every 2 min × 10) | 11th attempt within 15 min is still rejected (rolling window — see note) | Counting uses `AttemptedAt >= now - WINDOW_MIN` |
| TC-06 | Window-elapsed unlock — After TC-02, wait until `LOCKOUT_MIN` minutes have passed since the latest fail | Next attempt is allowed (gate returns null) | Time-based unlock works |
| TC-07 | Unknown user records attempt — Submit `nonexistent_user_xyz` with any password 10 times | 11th attempt for the same fake Username is locked out | Per-Username ledger; non-existent users counted (prevents enumeration timing) |
| TC-08 | Missing password records attempt — Submit form with username but blank password 10 times | 11th is locked out | Empty-password path also feeds the ledger |
| TC-09 | Function signature unchanged | `login(username, password?)` still accepts the same args; return shape `{success, error}` / `{success, role, redirect}` unchanged | Existing callers (login/page.tsx) compile without change |
| TC-10 | Env override beats default — `RATE_LIMIT_MAX_ATTEMPTS=3` set; 3 fails for one Username | 4th attempt locked out | Env vars honored |
| TC-11 | Invalid env value falls back — `RATE_LIMIT_MAX_ATTEMPTS=abc` | Behavior matches default (10) | `Number.isFinite + >0` guard |
| TC-12 | Ledger write failure does not break login — simulate by transiently breaking the `FailedLoginAttempt` table (e.g., rename) | `console.error('[AUTH] failed to record FailedLoginAttempt …')` is emitted, login still returns the password-error message (does NOT throw) | Fail-soft preserved |

## Manual Sanity Run (against `npm run dev` + real Supabase)

```
# Setup
1. Set in .env (local only):
   RATE_LIMIT_MAX_ATTEMPTS=3
   RATE_LIMIT_WINDOW_MIN=1
   RATE_LIMIT_LOCKOUT_MIN=1
2. npm run dev

# Trigger lockout
3. Open /login, submit 1000 / wrongpw → "รหัสผ่านไม่ถูกต้อง"
4. Repeat twice more
5. 4th attempt → "ลองเข้าระบบล้มเหลวหลายครั้งเกินไป กรุณารอ 1 นาที"
6. Wait > 60s
7. 5th attempt with correct password (1000 / vl1000) → success
8. Verify Supabase: SELECT count(*) FROM "FailedLoginAttempt" WHERE "Username" = '1000'; → 0 (cleared by step 7)
```

## Acceptance
PASS = TC-01 through TC-12 all green. Any single FAIL blocks Complete.

## Notes
- Rate limit defaults are intentionally loose (10/15/15) so legitimate users do not trip them. Production tuning is operations' call.
- An admin who is locked out can be unblocked manually by running
  `DELETE FROM "FailedLoginAttempt" WHERE "Username" = '<admin-username>';`
  in Supabase SQL. Phase 2D will add a UI for this.
- The composite index `[Username, AttemptedAt]` (MON-10) makes the windowed count cheap — verified PASS in this regression by `EXPLAIN` showing index scan, not seq scan, on the read path.
- IP-based rate-limit is explicitly out of scope (Phase 2B Operations). Per-Username only.
