# Regression — Role-based Session Timeout (SYN-09)

**Phase:** 2A — Security Hardening
**Filed by:** Syndicate (AX/WT)
**Date:** 11-05-2026
**Related Ticket:** SYN-09
**Source under test:** `ticket-system/src/app/actions/auth.ts` — `login()`, `getSessionTimeoutForRole()`

## Purpose
Lock in role-based session cookie `maxAge`: Admin 4h / Technician 8h / Branch User 24h.
Lock in env-driven override for ops tuning without redeploy.
Prevents reverting to the pre-SYN-09 hardcoded `60 * 60 * 24` for every role.

## Test Cases

| TC | Action | Expected | Pass Criterion |
|----|--------|----------|----------------|
| TC-01 | Login as Admin (any seeded admin row) with correct password | `Set-Cookie: user_session=...; Max-Age=14400; HttpOnly; Path=/` | `Max-Age` exactly `14400` |
| TC-02 | Login as Technician (Role = 'Technician') | `Set-Cookie: ...; Max-Age=28800` | `Max-Age` exactly `28800` |
| TC-03 | Login as branch User (e.g. `1000`/`vl1000`) | `Set-Cookie: ...; Max-Age=86400` | `Max-Age` exactly `86400` |
| TC-04 | Set `SESSION_TIMEOUT_ADMIN_SEC=900` in env, restart, login admin | Cookie `Max-Age=900` | Env override beats default |
| TC-05 | Set `SESSION_TIMEOUT_ADMIN_SEC=garbage` in env, restart, login admin | Cookie `Max-Age=14400` | Falls back to default on invalid env |
| TC-06 | Cookie attributes unchanged | `HttpOnly`, `Path=/`, `Secure` only when `NODE_ENV=production` | Cookie shape preserved |
| TC-07 | `login()` / `logout()` / `getSession()` function signatures unchanged | Callers (login/page.tsx) compile without change | TypeScript clean |

## Manual Run

```
# Admin path
1. Open DevTools → Network tab → preserve log
2. Visit /login → enter admin creds → submit
3. Inspect POST /login response → look for Set-Cookie header
4. Confirm Max-Age=14400 (4 * 3600)

# Branch user path
1. /login → 1000/vl1000 → submit
2. Confirm Max-Age=86400 (24 * 3600)

# Env override
1. Set SESSION_TIMEOUT_ADMIN_SEC=900 in .env
2. Restart dev server
3. Admin login → Max-Age=900
4. Unset env → restart → Max-Age=14400 again
```

## Acceptance
PASS = all 7 TCs green. Any one FAIL blocks ticket Complete.

## Notes
- Existing logged-in sessions retain their original cookie until natural expiry — SYN-09 only affects NEW logins (intentional per ticket Boundaries).
- Lockout (SYN-08) and audit (SYN-11) regressions live in separate spec files — this file scoped to session-timeout only.
- Lazy migration path in `login()` (plaintext → bcrypt rehash) untouched by SYN-09 — cookie set runs once after auth succeeds regardless of which branch handled the password check.
