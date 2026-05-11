# OverseerReport — 11-05-2026

## Syndicate

### SYN-06 — Remove LINE integration entirely
**Filed by:** DR (Director)
**Date:** 11-05-2026
**Status:** COMPLETE

**Summary**
LINE integration fully removed from `ticket-system/`. Deleted 3 files (`src/components/LiffProvider.tsx`, `src/lib/lineNotify.ts`, `src/app/api/webhook/route.ts`) and the now-empty `src/app/api/webhook/` directory. Modified 6 files to strip LIFF imports / handlers / UI surface (`login/page.tsx`), unwrap `<LiffProvider>` (`layout.tsx`), remove 3 LINE comment blocks (`actions/tickets.ts`), drop `@line/liff` dep (`package.json`), and clean LINE env vars (`.env.example`). PreExisting TechStack updated to mark Notifications/LIFF/Webhook subsystems as REMOVED 11-05-2026. `npm install` regenerated lockfile (61 transitive packages dropped). `npx next build` PASS — 6 user-facing routes intact, `/api/webhook` absent. `npx tsc --noEmit` clean. Grep of `liff|lineNotify|@line|LINE_|LIFF|sendLineNotify` against `src/` returns zero matches.

**Acceptance Criteria**
- [x] 3 files deleted, empty webhook dir removed
- [x] 6 files modified (login page, layout, tickets.ts, package.json, .env.example, PreExisting TechStack)
- [x] grep verification passes (0 LINE refs in src/)
- [x] `npm install` regenerates lockfile without `@line/liff`
- [x] `npx next build` PASS (6 routes, no /api/webhook)
- [x] `npx tsc --noEmit` clean
- [x] Regression test added: `09_TestCase/_regression/login_no_line.spec.md` (6 TCs)

**Blockers:** None.

**Next Step for AM:** Signal MON-09 (createTicket silent user-creation fix) unblocked — `tickets.ts` LINE comment blocks cleared, ready for Monolith to modify createTicket logic.

---

### SYN-05 — npm audit fix
**Filed by:** DR (Director)
**Date:** 11-05-2026
**Status:** COMPLETE (partial fix, TD-002 filed for Commander decision)

**Summary**
Ran `npm audit fix` (without `--force`) on `ticket-system/`. Vulnerability count reduced from 7 (Phase 1 baseline) → 5 (after SYN-06 removed `@line/liff`) → **2** (after audit fix resolved picomatch + flatted advisories). Two vulnerabilities remain: 1 high (`next`) and 1 moderate (`postcss`, transient of `next`). Both require `--force` to fix, which bumps `next` from 16.1.6 to 16.2.6 — outside the stated dependency range. Per ticket directive ("ถ้าต้อง `--force` (breaking change) → STOP + ขออนุญาต Commander ก่อน"), halted and filed `07_TechnicalDebt/TD-002_NextPostcssAuditForce.md` with full advisory list, practical exposure assessment per advisory, and a recommended action (Option A: approve force-fix; Option B: hold and monitor). `npx next build` PASS post-fix.

**Acceptance Criteria**
- [x] Baseline `npm audit` recorded (5 vulns post-SYN-06: 2 moderate / 3 high)
- [x] `npm audit fix` (no `--force`) run successfully — 3 advisories resolved
- [x] Post-fix `npm audit`: 0 critical, 1 high remaining (`next`)
- [x] `npx next build` PASS
- [x] Force-required fixes documented in `07_TechnicalDebt/TD-002` (acceptable per ticket boundary)
- [x] `--force` NOT used
- [x] Regression test added: `09_TestCase/_regression/npm_audit_baseline.spec.md` (5 TCs — caps audit floor)

**Blockers:** None. Outstanding Commander decision needed for the remaining 2 vulns (TD-002).

**Next Step for AM:** Surface TD-002 to Commander during Phase 1 acceptance — Option A (approve `--force` bump to next 16.2.6) recommended given Server Action CSRF advisory is the most relevant exposure.

---

### SYN-04 — Production smoke test script
**Filed by:** DR (Director)
**Date:** 11-05-2026
**Status:** COMPLETE

**Summary**
Created `ticket-system/scripts/prod_smoke_test.ts` (304 lines) — a tsx script that runs 5 post-deploy smoke tests against any BASE_URL (env `PROD_URL` or positional argv, defaults to `http://localhost:3000`). Tests: TC-01 admin login (uses `SMOKE_ADMIN_PW` env, never embedded), TC-02 admin wrong-password (must NOT set cookie), TC-03 branch user `1000/vl1000` (must set cookie), TC-04 unknown user (must return 'ไม่พบ'), TC-05 landing page GET (must 200). Server Action ID is auto-discovered by walking the JS chunk graph from `/login` and matching the `__next_internal_action_entry_do_not_use__ [{"<hex>":"login"}...]` marker — resilient to Next.js bundle layout changes (falls back to SKIP, not FAIL). Local validation against `npm run dev`: 4 PASS, 1 SKIP (TC-01 — no admin pw in env, as designed). No DB writes, no external side effects, no LINE refs, no `.env` reads. Non-zero exit on FAIL for CI-friendliness.

**Acceptance Criteria**
- [x] Script at `ticket-system/scripts/prod_smoke_test.ts`
- [x] BASE_URL from `PROD_URL` env / argv / localhost default
- [x] SMOKE_ADMIN_PW from env (never in script)
- [x] 5 TCs implemented per ticket spec
- [x] Summary output (total/pass/fail/skip/duration)
- [x] Non-zero exit on failure
- [x] Usage documented in script header
- [x] Local smoke run: 4/5 PASS, 1/5 SKIP (TC-01 no pw)
- [x] `npx tsc --noEmit` clean
- [x] `npx next build` PASS
- [x] Regression test added: `09_TestCase/_regression/prod_smoke_script.spec.md` (8 TCs)

**Blockers:** None.

**Next Step for AM:** Hand script to OVS-04 (AS) for inclusion in User Journey Walkthrough. Recommend documenting in MON-07 DeploymentRunbook how to run the script post-deploy with the real production URL + admin password from a secrets manager.

---

### Syndicate Phase 1 Closeout

| Ticket | Status | Build | Force | Regression |
|--------|--------|-------|-------|------------|
| SYN-06 | [x] Complete | PASS | NO | login_no_line.spec.md |
| SYN-05 | [x] Complete | PASS | NO | npm_audit_baseline.spec.md |
| SYN-04 | [x] Complete | PASS | NO | prod_smoke_script.spec.md |

**Final build state:** `npx next build` PASS — routes `/`, `/admin/dashboard`, `/api/proxy-image`, `/login`, `/technician/dashboard`, `/user/dashboard`, `/user/new-ticket` + `/_not-found`. `/api/webhook` removed.

**Final audit state:** 2 vulnerabilities (1 high `next`, 1 moderate `postcss`) — both require `--force` bump documented in TD-002. Down from 7 at Phase 1 baseline.

**Hold for Commander accept on Phase 1.** Do not advance to Phase 2.

---

## Monolith

### MON-08 — Schema CurrentStatus typo fix + default sync
**Filed by:** AT (Atlas, Conductor)
**Date:** 11-05-2026
**Status:** COMPLETE

**Summary**
`ticket-system/prisma/schema.prisma` line 42: `CurrentStatus String @default("Planed")` → `@default("Open")`. `npx prisma format` clean. `npx prisma validate` reports valid. `npx prisma db push` succeeded — "Your database is now in sync with your Prisma schema. Done in 1.50s". Read-only probe (`scripts/mon08_probe.ts`, prefixed `[DBG]`) verified via `information_schema.columns` that the live PostgreSQL column default is now `'Open'::text`. Pre-existing data preserved per Phase 1 scope: probe found 0 rows with `CurrentStatus = "Planed"` and 20 rows = `"Open"` out of 94 total — historical `createTicket()` always set `'Open'` explicitly, so no row ever inherited the typo. Probe deleted post-verification per §6 RELEASE rule. `npx next build` PASS — 7 routes compiled. (Note: `npm run build`'s chained `prisma generate` step hit `EPERM` on `query_engine-windows.dll.node` due to a running `next dev` server holding the DLL; bypassed cleanly via direct `npx next build`. Not a code defect — Windows file-lock tooling quirk; documented in MON-07 §3.2.)

**Acceptance Criteria**
- [x] Schema edited at line 42
- [x] `prisma format` + `prisma validate` PASS
- [x] `prisma db push` synced live DB column default
- [x] Read-only probe confirmed `'Open'::text` default + zero `"Planed"` rows (no data migration)
- [x] PreExisting TechStack updated — 3 entries struck-through, Critical Issues Summary row #4 RESOLVED
- [x] `npx next build` PASS — 7 routes
- [x] Probe deleted (§6 RELEASE)

**Blockers:** None.

**Next Step for AM:** Hand schema-fix evidence to OVS-04 walkthrough — new-ticket creation flow should observe `'Open'` status default in both code and DB.

---

### MON-09 — createTicket() silent user creation fix
**Filed by:** AT (Atlas, Conductor)
**Date:** 11-05-2026
**Status:** COMPLETE

**Summary**
Removed the silent user-creation block (`if (!user) { user = await prisma.user.create({...}) }`) from `ticket-system/src/app/actions/tickets.ts` `createTicket()`. Replaced with an explicit error return that emits an observable failure on both sides:
- **Server:** `console.error("[createTicket] ERR_TICKET_NO_USER_FOR_BRANCH (-2001): no User row found for branchId=<id> — refusing to auto-create. Provision via seed_production.mjs.")`.
- **Client:** `{ success: false, error: "ไม่พบผู้ใช้งานของสาขานี้ในระบบ กรุณาติดต่อแอดมิน" }` — Thai, polite, actionable.

`user` declaration tightened from `let` to `const` (no reassignment after the early return). Inline comment block documents the §2 Silent Failure Rule rationale and cross-references both the ErrorCatalog and the seed contract. New error code `ERR_TICKET_NO_USER_FOR_BRANCH = -2001` registered in `Development/Web_repair_center/ErrorCatalog.md` under the `-2xxx` Data range with full Cause + Remediation columns; audit-trail entry appended. `npx tsc --noEmit` clean (zero output). `npx next build` PASS — 7 routes. Static guard verified: `Grep` for `prisma\.user\.create|user\.create` across `src/` returns zero matches. Seed alignment verified at `seed_production.mjs:72-83` — every branch in the 45-branch array is provisioned with a Role='User' upsert, so the happy path is preserved for all production branches. Regression test `Development/Web_repair_center/09_TestCase/_regression/createTicket_no_silent_user.spec.md` planted (6 TCs, PERMANENT per Hotfix Regression Gate).

**Acceptance Criteria**
- [x] Silent user-create block removed from `createTicket()`
- [x] Replaced with explicit error return + `console.error` containing code `-2001`
- [x] Error code added to ErrorCatalog.md (-2xxx Data range)
- [x] `npx tsc --noEmit` clean
- [x] `npx next build` PASS — 7 routes
- [x] Static guard: zero `user.create` calls anywhere under `src/`
- [x] Seed alignment confirmed (45/45 branches have Role='User' upsert)
- [x] Regression test added with 6 TCs (happy, failure, static guard, error string, ErrorCatalog row, seed alignment)
- [x] PreExisting TechStack updated — Tickets quirk + Critical Issues Summary row #6 struck-through

**Blockers:** None.

**Next Step for AM:** OVS-04 should include both happy-path (branch 1000 creates ticket → success) and failure-path (verify the new Thai error message renders if a User row is missing) in the User Journey Walkthrough.

---

### MON-07 — DeploymentRunbook.md
**Filed by:** AT (Atlas, Conductor)
**Date:** 11-05-2026
**Status:** COMPLETE

**Summary**
Created `Development/Web_repair_center/06_InstallationGuide/DeploymentRunbook.md` — 416 lines, 10 §-sections. All 7 mandatory sections from the ticket spec covered (§1 Initial Setup, §2 Routine Redeploy, §3 Schema Change, §4 Seed Execution, §5 Rollback, §6 Post-Deploy Smoke Test, §7 Env Vars Reference) plus 3 supporting sections (§8 Forbidden Actions, §9 First-Deploy Checklist, §10 Audit Trail). Content reflects the **post-Phase-1 state**: post-LINE-removal (no `@line/liff`, no LINE env vars, no `/api/webhook`), post-schema-sync (MON-08 `'Open'` default + Supabase SQL verification example), post-silent-user-fix (MON-09 contract documented under §4 Seed Execution — createTicket no longer auto-creates User rows, all branches must be in seed). Documents the **ephemeral env var pattern** for admin password rotation: `$env:ADMIN_INITIAL_PASSWORD = "..."` → `node seed_production.mjs` → `Remove-Item Env:\ADMIN_INITIAL_PASSWORD`, with an explicit "DO NOT add to Vercel" rule in §7 and §8. References the SYN-04 smoke test script (`ticket-system/scripts/prod_smoke_test.ts`) in §1.6, §2.4, and §6, with full invocation syntax for `PROD_URL` + `SMOKE_ADMIN_PW`. §8 Forbidden Actions includes the `npm audit fix --force` prohibition with a direct link to TD-002 (Commander decision pending).

**Acceptance Criteria**
- [x] File exists at `Development/Web_repair_center/06_InstallationGuide/DeploymentRunbook.md`
- [x] All 7 mandatory sections present and content-verified (PF section-coverage audit, 8/8 in ticket criteria)
- [x] Reflects post-LINE state (no LIFF/LINE refs; removed-vars list in §7)
- [x] Ephemeral admin password env-var pattern documented
- [x] SYN-04 smoke test script referenced with usage
- [x] Forbidden Actions section (§8) with 8 entries including TD-002 reference
- [x] No real credentials, no Phase 0.5d prescription, no Phase 2 hint

**Blockers:** None.

**Next Step for AM:** Surface the runbook to Commander during Phase 1 acceptance — it doubles as the deployment SOP for any future redeploy or successor handoff.

---

### Monolith Phase 1 Closeout

| Ticket | Status | Build | tsc | Regression / Verification |
|--------|--------|-------|-----|---------------------------|
| MON-08 | [x] Complete | PASS (7 routes) | (Prisma client unchanged) | Probe verified DB default `'Open'::text`, 0 "Planed" rows; probe deleted (§6) |
| MON-09 | [x] Complete | PASS (7 routes) | clean | `createTicket_no_silent_user.spec.md` (6 TCs); static guard PASS (0 `user.create` in src/) |
| MON-07 | [x] Complete | (doc only) | (doc only) | 7/7 mandatory sections present; SYN-04 referenced; ephemeral env pattern documented |

**Source changes (this wave):**
- `ticket-system/prisma/schema.prisma` — 1 line (default value sync)
- `ticket-system/src/app/actions/tickets.ts` — `createTicket()` body, lines 14-33 (silent block → explicit error)

**Doc changes (this wave):**
- `Development/Web_repair_center/06_InstallationGuide/DeploymentRunbook.md` (new, 416 lines)
- `Development/Web_repair_center/ErrorCatalog.md` (first `-2xxx` entry: `ERR_TICKET_NO_USER_FOR_BRANCH = -2001`)
- `Development/Web_repair_center/PreExisting TechStack/Web_repair_center.md` (Tickets + Database subsystems updated; Critical Issues Summary rows #4 and #6 RESOLVED)
- `Development/Web_repair_center/09_TestCase/_regression/createTicket_no_silent_user.spec.md` (new, 6 TCs)

**DB changes (this wave):**
- `RepairTicket.CurrentStatus` column default: `'Planed'::text` → `'Open'::text` (no data migration, existing rows preserved — 0 rows held the old typo value anyway)

**Probes created + deleted (§6 RELEASE compliance):**
- `ticket-system/scripts/mon08_probe.ts` — created, run, results captured in ticket closure, deleted in same wave

**Constraints honored:**
- No branch-user password touched (verified — seed contract preserved, no change to `Password` / `PasswordHash` columns or seed flow)
- No `npm run build` regression (verified — `npx next build` PASS after each ticket)
- No `.env` committed, no real secrets surfaced
- No edits to admin/dashboard/page.tsx, auth.ts, seed_production.mjs (read-only references only)
- No data migration on existing rows
- No LINE feature restoration
- §6 Instrument-First Rule + RELEASE probe deletion enforced
- Hotfix Regression Gate satisfied (MON-09 regression test planted)

**Final state:** 3/3 Monolith tickets COMPLETE. Build PASS. Static + DB checks PASS. Holding for Commander Phase 1 acceptance after OVS-04 walkthrough.

**Hold for Commander accept on Phase 1.** Do NOT advance to Phase 2. Auth: hold.

---

## Phase 2A — Monolith

### MON-10 — Schema: AuditLog + FailedLoginAttempt tables
**Filed by:** AT (Atlas, Conductor)
**Date:** 11-05-2026
**Status:** COMPLETE
**Phase:** 2A — Security Hardening
**Wave:** 2 (parallel with Syndicate subagent A)

**Summary**
Appended two security-domain models to `ticket-system/prisma/schema.prisma` (lines 92-127). `AuditLog` — 10 columns (`LogID` cuid PK, `UserID?`, `Action`, `EntityType?`, `EntityID?`, `Before?`, `After?`, `IPAddress?`, `UserAgent?`, `Timestamp` defaulting `now()`), 4 declared `@@index` directives (`UserID`, `Action`, composite `EntityType+EntityID`, `Timestamp`) — total 5 indexes including PK. `FailedLoginAttempt` — 4 columns (`AttemptID` cuid PK, `Username`, `IPAddress?`, `AttemptedAt` defaulting `now()`), 1 composite `@@index([Username, AttemptedAt])` — total 2 indexes including PK. Both models commented with the no-FK rationale: AuditLog must survive User deletion to preserve trail; FailedLoginAttempt.Username may refer to non-existent accounts (attempts recorded before auth resolves); User schema is in flux pending Phase 2D Password column drop.

`npx prisma format` clean. `npx prisma validate` reports valid. `npx prisma db push` synced cleanly in 1.93s ("Your database is now in sync with your Prisma schema") and auto-ran `prisma generate` (102ms) — no Windows DLL EPERM (no stale `next dev` process holding the DLL). `npx tsc --noEmit` clean. `npm run build` PASS — Next.js 16.2.6 Turbopack, compiled in 4.4s, TypeScript phase clean, 7 user-facing routes intact (`/`, `/admin/dashboard`, `/api/proxy-image`, `/login`, `/technician/dashboard`, `/user/dashboard`, `/user/new-ticket`) + `/_not-found` — identical signature to Phase 1 closeout.

Read-only probe `scripts/mon10_probe.ts` verified via `information_schema` + `pg_indexes` + Prisma Client introspection: both tables exist in `public` schema with correct quoted casing, exact column counts (10 + 4), exact index counts including PK (5 + 2), both tables empty (no data migration), and `prisma.auditLog` / `prisma.failedLoginAttempt` model namespaces present on the Prisma Client. Probe deleted post-verification per §6 RELEASE rule.

**Acceptance Criteria**
- [x] Schema edited — 2 new models appended (no existing model touched)
- [x] `npx prisma format` clean
- [x] `npx prisma validate` valid
- [x] `npx prisma db push` synced — DB has 2 new tables + 7 new indexes (5 on AuditLog incl. PK + 2 on FailedLoginAttempt incl. PK)
- [x] `npx prisma generate` — Prisma Client knows both new models (auto-run by `db push`; re-verified during `npm run build`)
- [x] Supabase introspection: AuditLog (10 cols / 5 indexes) + FailedLoginAttempt (4 cols / 2 indexes) exist, both empty
- [x] `npm run build` PASS — 7 routes (no regression from Phase 1)
- [x] `npx tsc --noEmit` clean — typecheck satisfied
- [x] No regression on existing models (Branch, User, RepairTicket, TicketHistory, TicketComment, Notification untouched)
- [x] No foreign keys to User (per ticket Notes — design decision logged)
- [x] No data migration

**Blockers:** None.

**Dependency Signal**
Ticket MON-10 is COMPLETE. Teams waiting may now proceed:
- **Syndicate SYN-08** (brute-force rate limit on login) — can read/write `FailedLoginAttempt` via `prisma.failedLoginAttempt`
- **Syndicate SYN-11** (audit logging helper + apply to admin actions) — can write `AuditLog` via `prisma.auditLog`

**Next Step for AM:** Signal Wave 3 (Syndicate subagent B — SYN-08 + SYN-11) unblocked. MON-10 delivery is schema-only; the consuming code lives in Syndicate's domain (rate-limit helper in `auth.ts`, audit-log helper in `lib/` + admin action wrappers in `actions/tickets.ts`). Verification at OVS-05 (Phase 2A UX smoke + User Journey) will confirm the live tables receive writes from the new consumers.

---

### Monolith Phase 2A Closeout

| Ticket | Status | Build | DB push | Verification |
|---|---|---|---|---|
| MON-10 | [x] Complete | PASS — Next.js 16.2.6, 7 routes | OK, 1.93s | Probe PASS — 2 tables, 14 cols, 7 indexes, both empty, Prisma Client knows models; probe deleted (§6) |

**Source changes (this phase):**
- `ticket-system/prisma/schema.prisma` — append-only, 36 lines added (2 new models + design-rationale comment block)

**DB changes (this phase):**
- New table `public."AuditLog"` (10 cols, 5 indexes incl. PK)
- New table `public."FailedLoginAttempt"` (4 cols, 2 indexes incl. PK)
- Zero existing rows touched

**Probes created + deleted (§6 RELEASE compliance):**
- `ticket-system/scripts/mon10_probe.ts` — created, run, results captured, deleted in same wave

**Constraints honored:**
- No edits to other models (Branch, User, RepairTicket, TicketHistory, TicketComment, Notification)
- No foreign keys to User (per ticket Notes — string refs only)
- No data migration on existing rows
- No build break (7 routes intact)
- No source code outside `prisma/schema.prisma`

**Hold for Wave 3 — do NOT advance.** Monolith's Phase 2A work is complete. Awaiting AM's Wave 3 dispatch to Syndicate subagent B (SYN-08 + SYN-11).

---

## Phase 2A — Syndicate

### SYN-09 — Role-based session timeout
**Filed by:** DR (Director)
**Date:** 11-05-2026
**Status:** COMPLETE
**Phase:** 2A — Security Hardening
**Wave:** 3 (sequential — single subagent, all four Syndicate tickets share auth.ts/tickets.ts)

**Summary**
Replaced hardcoded `maxAge: 60 * 60 * 24` in `auth.ts` cookie-set with a role-driven `getSessionTimeoutForRole(role)` helper. Defaults: Admin 14400s (4h), Technician 28800s (8h), User 86400s (24h). Env override via `SESSION_TIMEOUT_ADMIN_SEC` / `SESSION_TIMEOUT_TECHNICIAN_SEC` / `SESSION_TIMEOUT_USER_SEC` with defensive `Number.isFinite && >0` parse — invalid env falls back to default. Cookie name, `httpOnly`, `secure`, `path` unchanged per Boundaries. `login()` / `logout()` / `getSession()` function signatures preserved. `.env.example` updated with placeholders + comments (`.env` untouched).

**Acceptance Criteria**
- [x] `auth.ts` modified — helper + role-driven maxAge wired into `login()`
- [x] `.env.example` placeholders added with explanation comments
- [x] `npx tsc --noEmit` clean
- [x] `npx next build` PASS — 7 routes intact (`/`, `/admin/dashboard`, `/api/proxy-image`, `/login`, `/_not-found`, `/technician/dashboard`, `/user/dashboard`, `/user/new-ticket`)
- [x] Cookie shape preserved (httpOnly, secure-when-prod, path=/)
- [x] Regression test added: `09_TestCase/_regression/session_timeout.spec.md` (7 TCs — defaults per role, env override, invalid-env fallback, cookie attribute integrity, function signature preservation)

**Blockers:** None.

**Next Step for AM:** Surface to OVS-05 walkthrough — manually verify `Set-Cookie: Max-Age` per role during admin/tech/branch login paths.

---

### SYN-10 — CSRF audit + cookie SameSite
**Filed by:** DR (Director)
**Date:** 11-05-2026
**Status:** COMPLETE

**Summary**
Added `sameSite: "lax"` to `cookies().set("user_session", ...)` in `auth.ts` — single-line diff, all other cookie options preserved. Produced full CSRF audit in `Development/Web_repair_center/08_AuditReport/CSRF_Audit_Phase2A.md` (169 lines, 9 sections). Audit confirmed: every state-changing mutation in the codebase flows through Next.js Server Actions (`"use server"` directive in `auth.ts` + `tickets.ts`); the only custom REST route (`/api/proxy-image/route.ts`) is GET-only and CSRF-irrelevant. Built-in Next 16 CSRF defense (signed action IDs + Origin header check) plus `SameSite=Lax` cookie provide full coverage for the current surface. Two out-of-scope observations filed as Phase 2B follow-up recommendations: (F-03) Server Actions do not internally verify caller role, (F-04) `/api/proxy-image` accepts arbitrary URLs (SSRF, not CSRF).

**Acceptance Criteria**
- [x] `auth.ts` — `sameSite: "lax"` added
- [x] `/api/proxy-image/route.ts` audited (GET-only, no state mutation, no session read — CSRF n/a documented)
- [x] All 13 server-action exports catalogued (3 in auth.ts, 10 in tickets.ts) with state-change classification
- [x] `08_AuditReport/CSRF_Audit_Phase2A.md` created — Executive Summary, Server Actions table, REST route audit, cookie before/after, Findings, Verification steps, Sign-off, Follow-ups, Audit Trail
- [x] Cookie name + `httpOnly` + `secure` + `path` unchanged
- [x] `npx tsc --noEmit` clean
- [x] `npx next build` PASS — 7 routes
- [x] Zero CSRF vulnerabilities in current surface (per audit §1)

**Blockers:** None.

**Next Step for AM:** Surface F-03 (role gate) and F-04 (proxy SSRF allow-list) for Phase 2B Operations triage. SYN-10 itself is closed.

---

### SYN-08 — Brute-force rate limit on login
**Filed by:** DR (Director)
**Date:** 11-05-2026
**Status:** COMPLETE

**Summary**
Brute-force protection wired into `auth.ts` `login()`. Three helpers added: `checkRateLimit(username)` runs as the FIRST DB op (before user lookup — closes the enumeration-by-timing gap and forces unknown-user attempts to also count); `recordFailedAttempt(username)` inserts a `FailedLoginAttempt` row on every failure branch (no user, no password, bcrypt mismatch, plaintext mismatch); `clearFailedAttempts(username)` wipes the ledger for the winning Username immediately before cookie set. Defaults: 10 attempts / 15 min window / 15 min lockout. Env overrides: `RATE_LIMIT_MAX_ATTEMPTS` / `RATE_LIMIT_WINDOW_MIN` / `RATE_LIMIT_LOCKOUT_MIN` with defensive parsing. Lockout-remaining time is rendered into the Thai user-facing message (`"ลองเข้าระบบล้มเหลวหลายครั้งเกินไป กรุณารอ N นาที"`). Lockout self-expires naturally — once `latest_attempt + LOCKOUT_MIN` is in the past, the gate allows the next attempt; no cron job required. Ledger writes/clears are fail-soft (`try/catch` with `console.error` reason — State Transparency Rule honored). New error code `ERR_AUTH_RATE_LIMITED = -1010` registered in `ErrorCatalog.md` (-1xxx Auth range, first entry) with user message + cause + remediation. Composite index `[Username, AttemptedAt]` from MON-10 makes the windowed COUNT cheap.

**Acceptance Criteria**
- [x] `auth.ts` — gate runs BEFORE user lookup; failed attempts recorded on every failure path; ledger cleared on success
- [x] `ERR_AUTH_RATE_LIMITED = -1010` added to ErrorCatalog.md with Thai user message + audit-trail entry
- [x] `.env.example` updated with `RATE_LIMIT_*` placeholders + comments
- [x] `login()` / `logout()` / `getSession()` signatures unchanged
- [x] `npx tsc --noEmit` clean
- [x] `npx next build` PASS — 7 routes
- [x] Regression test added: `09_TestCase/_regression/login_rate_limit.spec.md` (12 TCs — under-cap pass, at-cap lockout, cleared-on-success, outside-window rolling count, time-elapsed unlock, unknown-user counted, missing-password counted, signature preservation, env override, invalid-env fallback, fail-soft ledger errors)

**Blockers:** None.

**Next Step for AM:** OVS-05 should include: (1) login flow still works for `1000/vl1000` and admin; (2) lockout triggers after configured attempts (recommend tuning down to 3 attempts in `.env` for the smoke session, then resetting to 10).

---

### SYN-11 — Audit logging helper + apply to admin actions
**Filed by:** DR (Director)
**Date:** 11-05-2026
**Status:** COMPLETE

**Summary**
Created `ticket-system/src/lib/audit.ts` — `logAudit(entry: AuditEntry): Promise<void>` plus a `safeStringify()` helper. Full try/catch wrap; never throws by construction; ledger write failure emits `console.error('[audit] failed to write log entry', { action, error })` and returns. Applied to 3 admin/state-changing actions in `actions/tickets.ts`:
1. `updateTicketStatus()` → `action: "ticket.status.update"`, Before/After snapshots `{ CurrentStatus, Technician, ActualDate }` (signatures explicitly excluded — sensitive)
2. `addTicketComment()` → `action: "ticket.comment.add"`, After payload includes `hasImage` flag + 80-char message preview, `userId` from already-resolved `actualUserId`
3. `markAllNotificationsRead()` → `action: "notification.bulkClear"`, pre-counts via `prisma.notification.count` for the Before snapshot, captures destructive bulk delete

`userId` resolution: `getSession()` is awaited inside `updateTicketStatus` and `markAllNotificationsRead` (best-effort; null-safe). All audited writes are `await logAudit(...)` — entry into the helper's try/catch is guaranteed even on path divergence. No new error code needed (helper is fail-soft by design per ticket spec). Composite indexes from MON-10 (`UserID`, `Action`, `[EntityType, EntityID]`, `Timestamp`) align with the anticipated read patterns for the Phase 2D admin read UI.

**Acceptance Criteria**
- [x] `src/lib/audit.ts` exists, exports `logAudit()` + `AuditEntry` interface (56 LOC)
- [x] 3 admin actions wrapped (status update / comment add / bulk-clear notifications)
- [x] All wrappers log: Before snapshot (where applicable), After snapshot, action name, entityType, entityId, userId from session
- [x] Sensitive fields scrubbed: no Password, PasswordHash, AdminSignature, UserSignature in any snapshot
- [x] `logAudit()` never throws — try/catch wrap verified by code inspection
- [x] `npx tsc --noEmit` clean
- [x] `npx next build` PASS — 7 routes
- [x] Regression test added: `09_TestCase/_regression/audit_log_writes.spec.md` (10 TCs — 3 happy-path writes, fail-soft, circular-ref handling, no-throw boundary, sanitization audit, return-shape preservation, action-name convention, userId resolution)

**Blockers:** None.

**Next Step for AM:** OVS-05 walkthrough — admin updates a ticket status → query Supabase `SELECT * FROM "AuditLog" ORDER BY "Timestamp" DESC LIMIT 5;` and confirm the new row's UserID, Action, EntityID, Before, After fields. Phase 2D will add the read UI.

---

### Syndicate Phase 2A Closeout

| Ticket | Status | Build | tsc | Force | Regression |
|--------|--------|-------|-----|-------|------------|
| SYN-09 | [x] Complete | PASS (7 routes) | clean | NO | session_timeout.spec.md (7 TCs) |
| SYN-10 | [x] Complete | PASS (7 routes) | clean | NO | CSRF_Audit_Phase2A.md (audit doc; no separate spec per Briefing) |
| SYN-08 | [x] Complete | PASS (7 routes) | clean | NO | login_rate_limit.spec.md (12 TCs) |
| SYN-11 | [x] Complete | PASS (7 routes) | clean | NO | audit_log_writes.spec.md (10 TCs) |

**Source changes (this phase):**
- `ticket-system/src/app/actions/auth.ts` — ~80 lines added (rate-limit helpers + session timeout helper + gate/record/clear wiring); function signatures preserved
- `ticket-system/src/app/actions/tickets.ts` — ~50 lines added (audit imports + 3 wrapped call sites + pre-count for bulk-clear); function signatures preserved
- `ticket-system/src/lib/audit.ts` — created, 56 lines (helper + safeStringify)
- `ticket-system/.env.example` — 2 new env blocks (RATE_LIMIT_*, SESSION_TIMEOUT_*) with comments; `.env` untouched

**Doc changes (this phase):**
- `Development/Web_repair_center/08_AuditReport/CSRF_Audit_Phase2A.md` (new, 169 lines)
- `Development/Web_repair_center/ErrorCatalog.md` (new entry `ERR_AUTH_RATE_LIMITED = -1010`; audit-trail row appended)
- `Development/Web_repair_center/09_TestCase/_regression/session_timeout.spec.md` (new)
- `Development/Web_repair_center/09_TestCase/_regression/login_rate_limit.spec.md` (new)
- `Development/Web_repair_center/09_TestCase/_regression/audit_log_writes.spec.md` (new)
- All 4 ticket files: `[ ] PENDING` → `[x] Complete`

**DB changes (this phase):**
- None (consumed MON-10 schema only — no new tables, no migrations)

**Probes created + deleted:**
- None this phase (no debugging required — clean build/typecheck on all 4 tickets)

**Constraints honored:**
- No branch user passwords touched
- No admin password touched
- `login()` / `logout()` / `getSession()` signatures unchanged
- Cookie name `user_session` unchanged; only `sameSite` ADDED and `maxAge` made role-driven
- No external rate-limiting service added (Phase 2B scope)
- No audit log read UI added (Phase 2D scope)
- No raw git; no `--force`; no `.env` writes
- No UI/frontend code touched (Arcade's domain)
- No DB schema changes (Monolith's domain)

**Two Phase 2B follow-up recommendations (filed as observations in CSRF audit doc):**
- F-03: Server-action role gate — every mutating action verifies caller role inside the function body
- F-04: `/api/proxy-image` SSRF allow-list — restrict outbound fetch to known hosts

**Hold for Wave 4 — do NOT advance to Phase 2B.** Syndicate's Phase 2A work is complete. Awaiting OVS-05 UX smoke + User Journey Walkthrough, then Commander Phase 2A acceptance.
