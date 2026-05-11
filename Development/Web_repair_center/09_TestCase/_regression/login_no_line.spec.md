# Regression Test — Login page works without LINE/LIFF

**Source ticket:** SYN-06 (Phase 1)
**Date added:** 11-05-2026
**Permanent:** YES — never delete (Hotfix Regression Gate)

## Why this test exists

SYN-06 removed all LINE Messaging API + LIFF surface from the codebase.
This regression test guarantees that:
1. The login page still loads with NO `@line/liff` dependency on disk.
2. Username/password authentication continues to work for admin and branch users.
3. `next build` succeeds with 6 user-facing routes (no `/api/webhook` route).
4. No file under `ticket-system/src/` references `liff`, `lineNotify`, `@line`, `LINE_`, `LIFF`, or `sendLineNotify`.

If any of these regress, LINE has crept back into the surface.

## Test Cases

### TC-LINE-01 — Static grep returns zero LINE refs in src/
**Action:**
```
grep -rn -i "liff\|lineNotify\|@line\|LINE_" ticket-system/src/
```
**Expected:** Zero matches.
**Failure mode:** Any match = LINE reintroduced — investigate immediately.

### TC-LINE-02 — package.json has no `@line/liff`
**Action:**
```
grep "@line/liff" ticket-system/package.json
```
**Expected:** Zero matches.
**Failure mode:** Package re-added — verify intent, otherwise remove.

### TC-LINE-03 — Login page TS compile + render
**Action:**
```
cd ticket-system && npx tsc --noEmit
```
**Expected:** Exit code 0, no output.
**Failure mode:** Compile error referencing LIFF / useLiff = stale import — fix.

### TC-LINE-04 — Build produces 6 routes (no /api/webhook)
**Action:**
```
cd ticket-system && npx next build
```
**Expected:** Routes printed include `/`, `/admin/dashboard`, `/api/proxy-image`, `/login`, `/technician/dashboard`, `/user/dashboard`, `/user/new-ticket`. **`/api/webhook` MUST NOT appear.**
**Failure mode:** `/api/webhook` reappears = webhook re-added — verify intent.

### TC-LINE-05 — Admin login HTTP flow (username/password)
**Action:** Run `prod_smoke_test.ts` (SYN-04) against deployed URL with valid admin pw env.
**Expected:** TC-01 (admin login) PASS, session cookie set, redirect to `/admin/dashboard`.
**Failure mode:** Login broken = LINE removal collateral damage on auth flow — rollback and investigate.

### TC-LINE-06 — Branch user login HTTP flow
**Action:** Same as TC-LINE-05 but with branch credentials (e.g., `1000` / `vl1000`).
**Expected:** Success, redirect to `/user/dashboard`.
**Failure mode:** Same as TC-LINE-05.

## Manual sign-off

| Date | Tester | Result | Notes |
|------|--------|--------|-------|
| 11-05-2026 | Syndicate (WT) | PASS | TC-LINE-01 to 04 verified post-implementation. TC-LINE-05/06 deferred to OVS-04 (AS owns UX smoke test). |
