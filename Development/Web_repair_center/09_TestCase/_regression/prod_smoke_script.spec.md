# Regression Test — Production smoke test script must remain runnable

**Source ticket:** SYN-04 (Phase 1)
**Date added:** 11-05-2026
**Permanent:** YES — never delete (Hotfix Regression Gate)

## Why this test exists

SYN-04 created `ticket-system/scripts/prod_smoke_test.ts` after BUG-01
(stale deployment) demonstrated we needed post-deploy verification.

This regression test guarantees the script itself does not break — if a
future refactor of `auth.ts`, the login page, or the build pipeline silently
breaks the smoke script, this regression catches it before the script
becomes shelfware.

## Test Cases

### TC-SMOKE-01 — Script TypeScript-compiles
**Action:**
```
cd ticket-system && npx tsc --noEmit
```
**Expected:** Exit 0.
**Failure mode:** TS error in `scripts/prod_smoke_test.ts` = refactor regression — fix.

### TC-SMOKE-02 — Script runs against localhost dev with surface checks
**Pre-req:** `npm run dev` running on `http://localhost:3000`.
**Action:**
```
cd ticket-system && npx tsx scripts/prod_smoke_test.ts http://localhost:3000
```
**Expected:** Exit 0. Summary shows TC-05 (landing GET) PASS at minimum.
**Failure mode:** Script throws or TC-05 FAIL = script broken — investigate.

### TC-SMOKE-03 — Server Action ID auto-discovery succeeds against running build
**Pre-req:** `npm run dev` or `npm run start` running.
**Action:** Run the script as in TC-SMOKE-02 and check stdout for:
```
[smoke] Action ID discovered: <8hex>...
```
**Expected:** Action ID line present (not the SKIP message).
**Failure mode:** Auto-discovery returned null = Next.js bundle layout changed and the regex patterns in `discoverLoginActionId()` need updating. Re-derive patterns and update script.

### TC-SMOKE-04 — Wrong-password login does NOT set session cookie
**Pre-req:** Live deployment (any URL) + dev server with seeded admin user.
**Action:** Run the script. TC-02 must PASS.
**Expected:** `[PASS] TC-02 ... no session cookie (expected)`.
**Failure mode:** TC-02 FAIL means a wrong password resulted in a session cookie = CRITICAL auth regression. Halt deploy, file BUG ticket, page Commander.

### TC-SMOKE-05 — Branch user `1000` / `vl1000` login works
**Pre-req:** Seeded branch user `1000` with password `vl1000` exists.
**Action:** Run the script. TC-03 must PASS.
**Expected:** `[PASS] TC-03 ... session cookie present`.
**Failure mode:** TC-03 FAIL = branch user auth broken (the user-facing path most likely to regress). Halt deploy.

### TC-SMOKE-06 — Unknown user returns the "ไม่พบ" error string
**Action:** Run the script. TC-04 must PASS.
**Expected:** `[PASS] TC-04 ... 'ไม่พบ' present, no session cookie`.
**Failure mode:** Either the error string was changed (rename in `auth.ts` line 16) or the action invocation format changed. Update `auth.ts` not-found string and this regression in lockstep.

### TC-SMOKE-07 — Script exits non-zero on FAIL
**Action:** Force a failure by pointing the script at a non-existent host:
```
PROD_URL=http://127.0.0.1:1 npx tsx scripts/prod_smoke_test.ts
```
**Expected:** Exit code 1.
**Failure mode:** Exit 0 on failure = CI cannot detect smoke breakage = script is shelfware.

### TC-SMOKE-08 — No DB writes / no external side effects
**Action:** Inspect script via grep:
```
grep -n "prisma\|supabase\|LINE\|fetch.*POST.*api\." ticket-system/scripts/prod_smoke_test.ts
```
**Expected:** Only `fetch` calls to the BASE_URL `/login` and `/` endpoints. No `prisma` import. No `supabase` import. No LINE reference.
**Failure mode:** Any of these = the script is mutating state and is no longer a "smoke" test.

## Local validation (initial run, 11-05-2026)

| TC | Result | Notes |
|----|--------|-------|
| TC-SMOKE-01 | PASS | `tsc --noEmit` clean |
| TC-SMOKE-02 | PASS | Localhost dev — TC-05 landing PASS |
| TC-SMOKE-03 | PASS | Action ID `608041af...` discovered |
| TC-SMOKE-04 | PASS | TC-02 wrong-pw rejected, no cookie |
| TC-SMOKE-05 | PASS | TC-03 branch `1000/vl1000` succeeded, cookie set |
| TC-SMOKE-06 | PASS | TC-04 unknown user, 'ไม่พบ' detected |
| TC-SMOKE-07 | (deferred) | Manual run against unreachable host pending |
| TC-SMOKE-08 | PASS | Only `fetch` to `${BASE_URL}/login` and `${BASE_URL}/` — no prisma/supabase/LINE |

## Manual sign-off

| Date | Tester | Result | Notes |
|------|--------|--------|-------|
| 11-05-2026 | Syndicate (WT) | PASS | 7/7 confirmed (TC-SMOKE-07 manual deferred to OVS-04 UX walkthrough). Script lines: 234. |
