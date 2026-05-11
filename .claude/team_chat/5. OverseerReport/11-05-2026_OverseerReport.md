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
