# Team Syndicate — Daily Log 11-05-2026

## Session Start — Phase 1 Stabilization Sprint
**Date:** 11-05-2026
**Project:** Web_repair_center
**Phase:** 1 — Stabilization & Tech Debt Sprint
**Mode:** A — Spawned by AM as subagent
**Auth:** Hold for Commander after Phase 1 completes

**DR:** Time is money. Three tickets on deck — SYN-06 (LINE removal) first since it blocks MON-09, then SYN-05 (npm audit), then SYN-04 (smoke test script). Deploying solution now.

**AX:** Logic plan locked. SYN-06 is pure surgical deletion + import rewires. SYN-05 — no `--force`, halt and report if force required. SYN-04 — standalone tsx script, env-driven config, zero side effects.

**LX:** Structure note — login page must remain clean after LIFF strip. No orphan imports, no dead state. Smoke test script header documents usage cleanly.

**WT:** Verification gates queued. Build PASS after every ticket. Regression test files per Hotfix Regression Gate. Out-of-scope files locked: admin/dashboard/page.tsx, schema.prisma, auth.ts, seed_production.mjs, createTicket logic.

---

## SYN-06 — Remove LINE integration entirely [x] Complete

**DR:** First ticket cleared. LINE surface gone from src/. Build PASS, types clean. Blocks lifted for MON-09.

**AX:**
- Deleted: `src/components/LiffProvider.tsx`, `src/lib/lineNotify.ts`, `src/app/api/webhook/route.ts`. Empty `src/app/api/webhook/` directory removed.
- Modified: `src/app/login/page.tsx` (stripped `useLiff` import, `handleLiffLogin`, profile display block, LIFF button block; username/password form untouched). `src/app/layout.tsx` (LiffProvider unwrapped). `src/app/actions/tickets.ts` (3 LINE comment blocks removed at lines 4, 43-44, 188-190; preserved `sender` variable assignment used by in-app notification). `package.json` (dropped `@line/liff ^2.27.3`). `.env.example` (removed NEXT_PUBLIC_LIFF_ID, LINE_CHANNEL_ACCESS_TOKEN, LINE_TARGET_ID and section headers). PreExisting TechStack rewritten for Notifications/LIFF/Webhook subsystems.
- `npm install` regenerated lockfile, removed 61 transitive deps (the LIFF tree).
- Build hit Prisma engine EPERM (next dev server holds the dll). Bypassed via direct `npx next build` — engine on disk is current. Routes verified: `/`, `/admin/dashboard`, `/api/proxy-image`, `/login`, `/technician/dashboard`, `/user/dashboard`, `/user/new-ticket` + `/_not-found`. `/api/webhook` absent as required.

**LX:** Login page renders cleanly post-strip — no orphan state, no dead imports. `.env.example` reads as 2-section template now (DB + Supabase + Admin). PreExisting TechStack reflects removal with dated annotations.

**WT:** Grep `liff|lineNotify|@line|LINE_|LIFF|sendLineNotify` against `src/` returns zero. `npx tsc --noEmit` exits clean. Regression file added: `09_TestCase/_regression/login_no_line.spec.md` (6 TCs). Acceptance criteria satisfied.

### Dependency Signal
Ticket SYN-06 is COMPLETE. Teams waiting on this ticket may now proceed:
- Monolith: MON-09 (createTicket silent user-creation fix) — tickets.ts comments cleared

---

## SYN-05 — npm audit fix [x] Complete (partial fix, TD filed)

**DR:** Audit floor halved. Force-bump halted per ticket directive — Commander gate filed as TD-002.

**AX:**
- Baseline (after SYN-06): 5 vulns (2 moderate / 3 high).
- `npm audit fix` (no `--force`) resolved 3: picomatch + flatted transients gone.
- Final: 2 vulns (1 moderate / 1 high). Both bundled with `next 16.1.6` and its `postcss` transient. Fix demands bump to `next 16.2.6` — outside stated range, requires `--force`.
- Halted per ticket spec. Filed `07_TechnicalDebt/TD-002_NextPostcssAuditForce.md` with risk assessment + Commander recommendation.
- `npx next build` PASS post-fix. Routes identical to SYN-06 state.

**LX:** TD-002 written with clear before/after table, advisory list grouped by package, practical exposure assessment per advisory. Commander can decide in one read.

**WT:** Regression file added: `09_TestCase/_regression/npm_audit_baseline.spec.md` (5 TCs — caps high≤1, moderate≤1, no new force-required fixes, build green). Acceptance: ticket asked "0 high/critical, moderate acceptable" — 1 high remains (next) requiring force-bump per the documented halt condition. Force was NOT used.

### Output Delivered
- Vuln count: 7 (start) → 5 (after SYN-06) → **2 (after SYN-05)**
- Force used: **NO**
- Build: PASS
- Files created: TD-002, npm_audit_baseline.spec.md
- Reason: Commander preferences forbid `--force` without approval; ticket halts at force-required boundary.

---

## SYN-04 — Production smoke test script [x] Complete

**DR:** Smoke net deployed. BUG-01 has its regression gate.

**AX:**
- Created `ticket-system/scripts/prod_smoke_test.ts` (304 lines).
- BASE_URL from `PROD_URL` env or positional argv. Default `http://localhost:3000`.
- SMOKE_ADMIN_PW from env — never embedded in script. TC-01 SKIPs cleanly if absent (State Transparency Rule — visible skip with reason).
- Server Action ID auto-discovery: GET `/login` → enumerate `<script src=".../_next/static/chunks/*.js">` URLs → walk chunk graph (max 60 hops) looking for the marker `__next_internal_action_entry_do_not_use__ [{"<hex>":"login"}...]`. Resilient to Next.js layout changes — falls back to SKIP, not FAIL.
- Server Action invocation: POST to `/login` with `Next-Action: <id>` header and JSON body `["<username>","<password>"]`.
- 5 TCs: TC-01 admin success (needs pw), TC-02 admin wrong-pw, TC-03 branch user, TC-04 unknown user, TC-05 landing GET.
- Local validation run against `npm run dev`: 4 PASS, 1 SKIP (TC-01 — no pw env). Action ID auto-discovered (`608041af...`). Branch login `1000/vl1000` cookie set. Unknown user returns 'ไม่พบ' confirmed.

**LX:** Script header documents usage cleanly — env vars, exit codes, design notes (no DB writes, no external side effects). Output format reads at a glance: `[PASS|FAIL|SKIP] TC-NN title (ms) — detail`. Summary block tallies total/pass/fail/skip/duration.

**WT:**
- `npx tsc --noEmit` clean.
- `npx next build` PASS — 6 user-facing routes still present, `/api/webhook` still absent.
- Regression file: `09_TestCase/_regression/prod_smoke_script.spec.md` — 8 TCs (compile, run, ID discovery, wrong-pw, branch-user, unknown-user, exit-nonzero, side-effect-free).
- No `--force`, no `.env` reads, no real secrets in code, no LINE refs.

### Output Delivered
- Script: `ticket-system/scripts/prod_smoke_test.ts` (304 lines, 5 TCs)
- Localhost smoke run: 4/5 PASS, 1/5 SKIP (no admin pw)
- Build: PASS
- Force used: NO
- Regression: `09_TestCase/_regression/prod_smoke_script.spec.md`
- **Reason:** BUG-01 stale-deploy lesson — automated post-deploy verification prevents recurrence.

---

## Phase 1 Syndicate Closeout

**DR:** All three Syndicate tickets [x] Complete. Hand-off ready for AM aggregation. Hold position until Commander accepts Phase 1.

**Dependency Signal recap (filed at SYN-06 completion):**
- Monolith: MON-09 unblocked (createTicket silent user-creation fix) — tickets.ts LINE comments cleared.

**Outstanding Commander Decision:**
- TD-002 (npm audit `--force` for next 16.1.6 → 16.2.6 bump). Halted per ticket directive.

**Build state at handoff:**
- `npx next build` PASS — 6 routes (`/`, `/admin/dashboard`, `/api/proxy-image`, `/login`, `/technician/dashboard`, `/user/dashboard`, `/user/new-ticket`) + `/_not-found`.
- `npx tsc --noEmit` clean.
- `npm audit`: 1 high + 1 moderate remain (documented in TD-002).
- No `--force` used anywhere in Phase 1 Syndicate work.

---

## Session Start — Phase 2A Security Hardening Sprint
**Date:** 11-05-2026
**Project:** Web_repair_center
**Phase:** 2A — Security Hardening
**Mode:** A — Spawned by AM as subagent (Wave 3 — sequential)
**Auth:** Hold for Wave 4 (OVS-05 UX smoke). Do NOT advance to Phase 2B.

**DR:** Four tickets in order — SYN-09 first (simplest, no dep), SYN-10 (independent), SYN-08 (uses MON-10 FailedLoginAttempt), SYN-11 (uses MON-10 AuditLog). All sequential, all touch auth.ts/tickets.ts. Build gate after every ticket. Deploying solution now.

**AX:** Predecessor state confirmed — Next.js 16.2.6 (SYN-07 force-bump COMPLETE), `AuditLog` + `FailedLoginAttempt` models present in schema with proper indexes, prisma client knows both (camelCase `prisma.auditLog` / `prisma.failedLoginAttempt`). auth.ts L2 read complete: `login()` returns `{success, error}` on fail, `{success, role, redirect}` on success; cookie set at line 69 with hardcoded `maxAge: 60*60*24`. tickets.ts L2 read complete — admin-action candidates identified: `updateTicketStatus` (status mutation + AdminSignature/UserSignature side effect), `addTicketComment` (admin/branch dual path, message persisted + notification), and `createTicket` (already has error-code observability from MON-09).

**LX:** Pre-flight plan locked. Single-session execution justified — all 4 tickets within one file scope (auth.ts) or one helper module plus 1 surgical apply file (tickets.ts). No 10+ file scan, no 3+ independent tickets in parallel — sequential dependency on shared file mandates single agent.

**WT:** Verification gates queued — `tsc --noEmit` + `npm run build` after every ticket. Hard constraints noted: cookie name `user_session` unchanged, login/logout/getSession signatures unchanged, password fields untouched, no `--force`. Regression files queued: session_timeout, login_rate_limit, audit_log_writes. SYN-10 documented via 08_AuditReport/CSRF_Audit_Phase2A.md (no separate regression file per Phase Briefing).

---

## SYN-09 — Role-based session timeout [x] Complete

**DR:** First ticket cleared. Role-driven cookie max-age live. Build green.

**AX:**
- Added `SESSION_TIMEOUT_DEFAULTS` map + `getSessionTimeoutForRole()` helper in `auth.ts` (constants block, top of module — 16 LOC delta, zero impact on existing functions).
- Swapped `maxAge: 60 * 60 * 24` (line 72) → `maxAge: getSessionTimeoutForRole(user.Role)`. Cookie shape otherwise unchanged.
- Env override path: `SESSION_TIMEOUT_ADMIN_SEC` / `SESSION_TIMEOUT_TECHNICIAN_SEC` / `SESSION_TIMEOUT_USER_SEC`. Invalid env (NaN, ≤0) falls back to default — defensive parse via `Number.isFinite && >0`.
- Unknown role would fall through to `SESSION_TIMEOUT_DEFAULTS.User` (24h) — safe default, never zero.
- `.env.example` block appended with comments. `.env` untouched per Boundaries.
- Function signatures of `login` / `logout` / `getSession` unchanged.

**LX:** `.env.example` reads cleanly in two new sections (Login Rate Limit pending SYN-08; Session Timeout). Comment lines explain the "why" of each default.

**WT:** `npx tsc --noEmit` exit clean. `npx next build` PASS — 7 routes (`/`, `/admin/dashboard`, `/api/proxy-image`, `/login`, `/_not-found`, `/technician/dashboard`, `/user/dashboard`, `/user/new-ticket`). Regression file added: `09_TestCase/_regression/session_timeout.spec.md` (7 TCs — Admin/Tech/User defaults, env override, invalid-env fallback, cookie shape, function signature integrity).

---

## SYN-10 — CSRF audit + cookie SameSite [x] Complete

**DR:** CSRF posture documented end-to-end. SameSite=Lax live on session cookie.

**AX:**
- Added `sameSite: "lax"` to `cookieStore.set("user_session", ...)` in `auth.ts`. Single-line diff — `httpOnly`, `secure`, `path`, name unchanged per Boundaries.
- Audit confirmed: every state-mutating export across `auth.ts` (3) + `tickets.ts` (10, of which 6 mutate) flows through `"use server"`. Only custom REST route is `proxy-image` (GET-only, no DB write, no session read — CSRF n/a).
- Two out-of-scope observations filed in the audit doc as follow-ups for Phase 2B: (F-03) Server Actions do not verify caller role inside the function body, (F-04) `/api/proxy-image` accepts arbitrary URLs with no allow-list (SSRF, not CSRF). Filed as observations only — not actioned this phase.

**LX:** Audit report `Development/Web_repair_center/08_AuditReport/CSRF_Audit_Phase2A.md` reads as 9-section structured document — Executive Summary, Server Actions table, REST route audit, cookie before/after, Findings, Verification steps, Sign-off, Follow-ups, Audit Trail. Lives next to ErrorCatalog as project artifact.

**WT:** Audit doc length 169 lines. `npx tsc --noEmit` clean. `npx next build` PASS — 7 routes preserved. Sign-off recorded in §7 of audit doc. Zero CSRF vulnerabilities in current surface; SSRF + missing role gates flagged with explicit Phase 2B follow-up recommendations.

---

## SYN-08 — Brute-force rate limit on login [x] Complete

**DR:** Login attempt floor enforced. ERR_AUTH_RATE_LIMITED in catalog.

**AX:**
- Added `RATE_LIMIT_DEFAULTS` (10/15/15) + `rateLimitConfig()` env parser + 3 helpers: `checkRateLimit(username)` returns lockout decision; `recordFailedAttempt(username)` inserts ledger row; `clearFailedAttempts(username)` wipes on success.
- Wired into `login()`:
  1. **Gate** — `checkRateLimit()` runs as FIRST DB op, BEFORE user lookup. Prevents enumeration-via-timing because unknown users count toward lockout too.
  2. **Record** — `recordFailedAttempt()` called on every failure branch: `!user`, `!password`, bcrypt mismatch, plaintext mismatch.
  3. **Clear** — `clearFailedAttempts()` called immediately before cookie set, after auth succeeds on either bcrypt or plaintext path.
- Storage: `prisma.failedLoginAttempt.findMany` with `take: maxAttempts` (10) + `orderBy AttemptedAt desc` — composite index `[Username, AttemptedAt]` from MON-10 makes this an index range scan, not a seq scan.
- Lockout semantics: when count ≥ MAX, check whether `latest_attempt + LOCKOUT_MIN` is still in the future. If yes, deny with remaining-minutes message. If no (window elapsed since last fail), allow — gives natural reset without a cron job.
- Fail-soft: `recordFailedAttempt`/`clearFailedAttempts` wrap in try/catch — ledger DB error never blocks login UX, just emits `[AUTH] failed to record/clear …` to server log (State Transparency Rule honored — visible reason emitted, no silent skip).
- `login()` / `logout()` / `getSession()` signatures unchanged.
- Added `ERR_AUTH_RATE_LIMITED = -1010` to `ErrorCatalog.md` with Thai user message, cause, and remediation note. Audit Trail row appended.
- `.env.example` updated with `RATE_LIMIT_*` placeholder block + comments. `.env` untouched.

**LX:** Error catalog entry includes user-facing Thai message with placeholder for `N` minutes — frontend displays the server-resolved minutes directly. Audit Trail table now has 3 dated rows (catalog created, MON-09, SYN-08) — clean chronological record.

**WT:** `npx tsc --noEmit` clean. `npx next build` PASS — 7 routes. Regression file added: `09_TestCase/_regression/login_rate_limit.spec.md` (12 TCs covering under-cap pass, at-cap lockout, cleared-on-success, outside-window, time-elapsed unlock, unknown-user counting, missing-password counting, signature preservation, env override, invalid env fallback, fail-soft ledger errors).

### Dependency Signal
Ticket SYN-08 is COMPLETE. Consumes MON-10 `FailedLoginAttempt` schema. No team is currently waiting on SYN-08 outputs within Phase 2A.

---

## SYN-11 — Audit logging helper + apply to admin actions [x] Complete

**DR:** Audit pipeline online — 3 admin actions wrapped, fail-soft guarantee verified.

**AX:**
- Created `ticket-system/src/lib/audit.ts` — `logAudit(entry: AuditEntry): Promise<void>` + `safeStringify(v)` helper. Full try/catch wrap; never throws by construction.
- Public surface: `AuditEntry` interface (userId, action, entityType, entityId, before, after, ipAddress, userAgent). Snake-to-PascalCase mapping handled inside the helper so call sites stay clean.
- L2 scan of `tickets.ts` enumerated all 10 exports. Selected 3 admin/state-changing actions for wrapping:
  1. **`updateTicketStatus()`** → `action: "ticket.status.update"`. Captures `{ CurrentStatus, Technician, ActualDate }` Before snapshot pre-transaction; After snapshot includes status, technician, actualDate, and note. AdminSignature/UserSignature explicitly excluded from snapshots (sensitive — per Boundaries).
  2. **`addTicketComment()`** → `action: "ticket.comment.add"`. After payload includes `hasImage` flag + 80-char message preview (matches notification truncation pattern — avoids storing potentially long PII twice). Uses already-resolved `actualUserId` from the function for the audit `userId`.
  3. **`markAllNotificationsRead()`** → `action: "notification.bulkClear"`. Pre-count via `prisma.notification.count` BEFORE the destructive `deleteMany`; Before/After captures the row count. Caller's `userId` pulled from `getSession()`.
- `userId` resolution: `getSession()` is awaited inside each action — uses the existing server action; no new infra.
- Wrapped calls are `await logAudit(...)` (not fire-and-forget) — guarantees the call enters the helper's try/catch even on path divergence. Performance cost: ~1 extra DB roundtrip per audited mutation, acceptable.
- Sensitive fields scrubbed: no `Password`, `PasswordHash`, `AdminSignature`, `UserSignature` ever passed into `before` or `after`. Verified by code-level inspection of all 3 call sites.
- No `ErrorCatalog.md` entry needed for SYN-11 — helper is fail-soft by design (per ticket §63).

**LX:** Action naming convention dotted-lowercase: `ticket.status.update`, `ticket.comment.add`, `notification.bulkClear`. Future Phase 2D read UI can group/filter by `Action` prefix (`ticket.*` vs `notification.*`) without parser changes. Audit table indexes from MON-10 (`UserID`, `Action`, `[EntityType, EntityID]`, `Timestamp`) align with anticipated read patterns.

**WT:** `npx tsc --noEmit` clean. `npx next build` PASS — 7 routes. Regression file added: `09_TestCase/_regression/audit_log_writes.spec.md` (10 TCs — 3 happy-path writes, fail-soft on DB error, circular-ref handling, no-throw boundary, sanitization audit, return-shape preservation, action-name convention, userId resolution).

Pre-existing diagnostic: `revalidatePath` import in `tickets.ts` was already unused before SYN-11 touched the file. Out of scope to remove — flagged in the regression spec Notes as a future cleanup observation.

---

## Phase 2A Syndicate Closeout

**DR:** All four Syndicate tickets [x] Complete. Build PASS after each. Holding for Wave 4 (OVS-05 UX smoke) per Phase Briefing.

**Cross-cutting state:**
- `auth.ts` lines added: ~80 (timeout helper + rate-limit helpers + wired gate/record/clear); function signatures preserved.
- `tickets.ts` lines added: ~50 (imports + 3 audit call sites + 1 pre-count); function signatures preserved.
- `src/lib/audit.ts` created: 56 LOC.
- `.env` never touched. `.env.example` updated with two new env blocks (RATE_LIMIT_*, SESSION_TIMEOUT_*).
- ErrorCatalog gained 1 new code: `ERR_AUTH_RATE_LIMITED = -1010`.
- New artifact: `08_AuditReport/CSRF_Audit_Phase2A.md` (169 lines).
- 3 regression specs added: `session_timeout.spec.md`, `login_rate_limit.spec.md`, `audit_log_writes.spec.md`.

**Build state at handoff:**
- `npx next build` PASS — 7 routes preserved across all 4 tickets.
- `npx tsc --noEmit` clean.
- No `--force`, no raw git, no `.env` writes, no LINE refs, no UI changes.
- INDEV §6 debug probes: none added or removed this phase (no debugging session needed — clean implementation, no bugs surfaced during build/typecheck).

**Two follow-up tickets recommended for Phase 2B (filed as observations in CSRF audit doc, not actioned):**
- Server-action role gate (F-03)
- Proxy-image SSRF allow-list (F-04)

---
