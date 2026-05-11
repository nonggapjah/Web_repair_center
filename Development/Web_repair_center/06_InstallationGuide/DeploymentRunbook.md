# Deployment Runbook — Web_repair_center

**Maintained by:** Monolith (AT/SC/EN/PF)
**Project:** Web_repair_center
**Source root:** `c:/Web_repair_center/ticket-system/`
**Hosting:** Vercel (frontend + Next.js Server Actions) + Supabase (PostgreSQL + Storage)
**Reflects state after:** SYN-06 (LINE removal), SYN-05 (npm audit), SYN-04 (smoke test), MON-08 (schema sync), MON-09 (silent user fix) — all dated 11-05-2026
**Audience:** dev/ops engineer (current or successor) + future Commander after context loss
**Status:** Living document — update on every deployment change

---

## At-a-Glance

| Task | Section | Time |
|------|---------|------|
| First-ever deployment from scratch | §1 Initial Setup | ~45 min |
| Routine redeploy after code change | §2 Routine Redeploy | ~10 min |
| Database schema change | §3 Schema Change | ~5 min |
| Re-seed branches + admin | §4 Seed Execution | ~5 min |
| Roll back a bad deploy | §5 Rollback | ~3 min |
| Post-deploy verification | §6 Post-Deploy Smoke Test | ~2 min |
| Env var reference | §7 Environment Variables | — |

---

## §1 — Initial Setup (greenfield deploy)

This section is run **once**, when standing up the project for the first time on a fresh Vercel + Supabase pair.

### 1.1 Supabase project

1. Create a new Supabase project (free tier sufficient for current scale of 45 branches).
2. Region recommendation: **ap-southeast-1** (matches current production for latency).
3. From the Supabase dashboard, copy these values into a local `.env` (in `ticket-system/`):
   - `DATABASE_URL` — pooled connection string (port 6543, `?pgbouncer=true`).
   - `DIRECT_URL` — direct connection string (port 5432). Used by Prisma for `db push`.
   - `NEXT_PUBLIC_SUPABASE_URL` — REST API URL (`https://<project-ref>.supabase.co`).
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — anon JWT.
4. Reference template: `ticket-system/.env.example`. Never commit the real `.env`.

### 1.2 Supabase Storage bucket (for ticket images)

1. Supabase dashboard → Storage → create a public bucket named (per current code) for ticket image uploads.
2. Image proxy logic is in `src/app/api/proxy-image/route.ts` — verify it can read from the bucket.

### 1.3 Local DB initialization

From `c:/Web_repair_center/ticket-system/`:

```powershell
# 1. Install deps (first time only)
npm install

# 2. Push schema to the new Supabase DB
#    This project intentionally uses `db push` (not `migrate dev`) — no migration
#    history is maintained. See §3 below for rationale.
npx prisma db push

# 3. Generate Prisma client
npx prisma generate
```

Expected output: `Your database is now in sync with your Prisma schema.`

### 1.4 First seed (branches + admin)

Per the **ephemeral env var pattern** (BUG-03 fix), the admin password must never be embedded in source or committed config. It is supplied to the seed script through a short-lived environment variable that exists only for the duration of the seed run.

```powershell
# 1. Set the ephemeral env var in the current PowerShell session ONLY
$env:ADMIN_INITIAL_PASSWORD = "<choose-a-strong-12+char-password>"

# 2. Run the seed — creates 45 branches + branch users + 1 admin
node seed_production.mjs

# 3. CLEAR the env var immediately after — do not leave it in the shell history
Remove-Item Env:\ADMIN_INITIAL_PASSWORD
```

Expected console output (abridged):
```
Start seeding branches and users...
✅ Seeded branch 1000 - SUKHUMVIT 33
... (one line per branch)
✅ Seeded branch DC - DC LAT KRABANG
✅ Ensured admin user exists (password hashed from ADMIN_INITIAL_PASSWORD)
Seeding finished. Successfully processed 45/45 branches.
```

Validation:
- `ADMIN_INITIAL_PASSWORD` must be ≥ 12 characters. Shorter values are rejected (`❌ ADMIN_INITIAL_PASSWORD must be at least 12 characters. Skipping admin seed.`).
- If the env var is unset, seed runs but **skips admin** (`⚠️ ADMIN_INITIAL_PASSWORD env var not set — skipping admin user seed.`). Branches still seed normally.
- Seed script hashes the password with `bcryptjs` (10 salt rounds) and writes both `Password` (legacy plaintext column) and `PasswordHash` (current truth) — this is the BUG-02 dual-write contract.

### 1.5 Vercel project link

1. Vercel dashboard → "Add New" → "Project" → import the `Web_repair_center` GitHub repository.
2. Framework preset: **Next.js** (auto-detected).
3. Root directory: `ticket-system/` (project lives under this subfolder, not repo root).
4. Build command: leave default (`next build`) or explicit `npm run build` — both work since `package.json` defines `"build": "prisma generate && next build"`.
5. Output directory: leave default.
6. Add Environment Variables (see §7 for the full list):
   - `DATABASE_URL` — Supabase pooled URL (Production + Preview)
   - `DIRECT_URL` — Supabase direct URL (Production + Preview)
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **DO NOT** add `ADMIN_INITIAL_PASSWORD` to Vercel — it is local-only, used exactly once at seed time.
7. Click **Deploy**. First build typically takes 2–3 min.

### 1.6 Sanity check

After the first deploy succeeds:
1. Visit the production URL (e.g. `https://web-repair-center.vercel.app/`).
2. Confirm the landing page renders and shows the branch/admin selector.
3. Log in as `1000` / `vl1000` (branch user) — should land on `/user/dashboard`.
4. Log out, log in as `admin` / `<the password set in step 1.4>` — should land on `/admin/dashboard`.
5. Run the smoke test against the production URL (see §6).

---

## §2 — Routine Redeploy (after code change)

This is the common path: pull, change code, commit, push — Vercel auto-deploys.

### 2.1 Local pre-flight

```powershell
cd c:/Web_repair_center

# Sanity-check working tree is clean
/git status
```

If a `next dev` server is running, leave it — it does not block deployment. (It does block `npx prisma generate` standalone on Windows due to a DLL lock, but `npx next build` works regardless.)

### 2.2 Build verification (mandatory)

Before committing:

```powershell
cd c:/Web_repair_center/ticket-system
npx tsc --noEmit          # must be clean (zero output)
npx next build             # must PASS with 7 routes
```

Expected route list (post-LINE state, post-Phase 1):
```
┌ ○ /
├ ○ /admin/dashboard
├ ƒ /api/proxy-image
├ ○ /login
├ ○ /_not-found
├ ○ /technician/dashboard
├ ○ /user/dashboard
└ ○ /user/new-ticket
```

If `/api/webhook` reappears in the list, something has un-removed SYN-06 — investigate before pushing.

### 2.3 Commit and push

Use the governed `/git` skill — never raw `git push` / `git commit`. From the project root:

```
/git commit         # 2-pass review, ticket gate, sensitive-file scan, commit
/git pr             # OR push directly via this if PR not needed
```

Per Commander preference, the repo deploys from `main` directly. Pushing to `main` requires `--force` flag on `/git commit` (logged) — this is the documented "main-only" pattern.

Vercel watches the `main` branch and triggers an automatic build on push. Watch the Vercel dashboard for the new deployment status.

### 2.4 Post-deploy

Run §6 smoke test against the production URL. If any TC FAILs, run §5 rollback.

---

## §3 — Schema Change

This project uses `prisma db push`, not `prisma migrate dev`. Rationale: a 45-branch internal tool with one DB never needs migration history granular enough to roll forward; schema is treated as a single source-of-truth artifact, and changes are reviewed via PR diff. **Do not introduce `prisma migrate` without an explicit Commander + MT decision.**

Workflow:

```powershell
# 1. Edit prisma/schema.prisma in source
# 2. Format + validate before pushing
cd c:/Web_repair_center/ticket-system
npx prisma format          # auto-format
npx prisma validate        # must report "valid"

# 3. Push to the live Supabase DB (Production)
#    DATABASE_URL + DIRECT_URL in your local .env must point to PROD.
npx prisma db push

# 4. Regenerate Prisma client
npx prisma generate
```

**WARNING — destructive prompts.** If `db push` detects a column drop, a type narrowing, or any change that could lose data, it will prompt for confirmation. Read the prompt carefully. For non-destructive changes (adding columns, changing defaults like MON-08, adding indexes) the push runs without confirmation.

After pushing schema, verify in the Supabase SQL editor:

```sql
-- Example for verifying a default-value change (MON-08 reference)
SELECT column_name, column_default
FROM information_schema.columns
WHERE table_name = 'RepairTicket' AND column_name = 'CurrentStatus';
-- Expected: column_default = 'Open'::text
```

### 3.1 Schema change reaches Vercel

After pushing schema locally, commit the updated `prisma/schema.prisma` and push the change to GitHub. Vercel rebuilds, and its build command runs `prisma generate` so the deployed client matches the new schema. Skipping the commit means production code is out of sync with the live DB schema → silent type drift.

### 3.2 Known Windows quirk

If a `next dev` server is running locally while you `npx prisma generate`, you may get:

```
EPERM: operation not permitted, rename ...query_engine-windows.dll.node
```

This is a Windows file lock — the dev server has the Prisma query engine DLL open. Two options:
1. **Preferred:** Skip the standalone `prisma generate` step and run `npx next build` instead. Next's build pipeline regenerates the client without the DLL collision.
2. Stop the dev server (`Ctrl+C` in its terminal), run `npx prisma generate`, restart the dev server.

This is a tooling annoyance, not a deployment risk — Vercel's build environment never hits it.

---

## §4 — Seed Execution (re-seed branches or rotate admin password)

Run this when:
- Adding a new branch to the `branches[]` array in `seed_production.mjs`.
- Re-creating user rows after a DB reset.
- Rotating the admin password (set a new `ADMIN_INITIAL_PASSWORD` and re-run — `upsert` will overwrite both `Password` and `PasswordHash`).

```powershell
# 1. Open ticket-system/seed_production.mjs
#    - To add a branch: append to the `branches` array (line 7).
#    - The script will upsert User rows with Username = branch code (e.g. "1000")
#      and Password/PasswordHash = telex (e.g. "vl1000").

# 2. Set ephemeral admin password env var
cd c:/Web_repair_center/ticket-system
$env:ADMIN_INITIAL_PASSWORD = "<strong-12+char-password>"

# 3. Run the seed
node seed_production.mjs

# 4. CLEAR the env var
Remove-Item Env:\ADMIN_INITIAL_PASSWORD

# 5. (Optional) Verify in Supabase SQL editor
#    SELECT Username, Role, BranchID FROM "User" ORDER BY Role, Username;
```

**Important contracts:**
- `seed_production.mjs` is **idempotent** (uses `upsert`). Safe to re-run.
- It is the **single source of truth for branch User rows**. Per MON-09 (11-05-2026), `createTicket()` no longer auto-creates User rows — every branch must be represented in the seed.
- The script writes BOTH the legacy `Password` column AND the canonical `PasswordHash` column (BUG-02 dual-write contract). Auth checks the hash first, falls back to plaintext only when the hash is null.
- Never commit a real `ADMIN_INITIAL_PASSWORD` value in any file. If accidentally committed, rotate the admin password immediately via a re-seed.

---

## §5 — Rollback

Two rollback paths, depending on urgency.

### 5.1 Fast path — Vercel "Promote" (≈30 sec)

1. Vercel dashboard → **Deployments** tab.
2. Find the last known-good deployment (timestamp before the bad one).
3. Click the `…` menu → **Promote to Production**.
4. Vercel atomically swaps the production alias to the older build. No code change needed.
5. Run §6 smoke test to confirm.

Use this when the bad deploy is actively breaking production. Promotion is reversible — you can promote again.

### 5.2 Permanent path — git revert + redeploy

When you need the rollback to persist (i.e. main HEAD should not contain the bad commit):

```
/git status                # see what's deployed at HEAD
```

Then in the source tree, identify the commit SHA of the bad change (from `git log` or Vercel's commit reference). Use the governed `/git` skill flow to revert; do not run raw `git revert` or `git reset --hard`. After the revert commit lands on `main`, Vercel auto-deploys it.

### 5.3 Database rollback

Schema changes pushed via `prisma db push` are **NOT** automatically rolled back by a Vercel deploy revert. If a schema change was the root cause of the bad deploy, you must:

1. Manually revert the schema file in source.
2. Run `npx prisma db push` again to roll the column / table change back.
3. If data was lost (e.g. a column was dropped), restore from Supabase's point-in-time backup (Supabase dashboard → Database → Backups). Free tier retains 7 days.

Treat schema rollbacks as a controlled operation, not an emergency reflex — coordinate with Commander.

---

## §6 — Post-Deploy Smoke Test

Reference script: `ticket-system/scripts/prod_smoke_test.ts` — built in SYN-04 (11-05-2026), 304 LOC, 5 test cases.

### 6.1 Run the script

From a local machine with the production URL and the **real admin password** (kept in a secrets manager — never in source):

```powershell
cd c:/Web_repair_center/ticket-system
$env:SMOKE_ADMIN_PW = "<real-admin-pw-from-secrets-manager>"
$env:PROD_URL = "https://<your-prod-domain>"
npx tsx scripts/prod_smoke_test.ts
Remove-Item Env:\SMOKE_ADMIN_PW
Remove-Item Env:\PROD_URL
```

Or one-shot positional:

```powershell
$env:SMOKE_ADMIN_PW = "<pw>"; npx tsx scripts/prod_smoke_test.ts https://<your-prod-domain>; Remove-Item Env:\SMOKE_ADMIN_PW
```

### 6.2 What the 5 TCs verify

| TC | Verifies | If FAIL |
|----|----------|---------|
| TC-01 | Admin login with the real password sets a session cookie | Auth pipeline broken — block deploy |
| TC-02 | Admin login with wrong password does NOT set a cookie | Plaintext-fallback regression — block deploy |
| TC-03 | Branch user `1000` / `vl1000` (default seed credentials) sets a session cookie | Branch seed missing or password schema broken |
| TC-04 | Unknown username returns the Thai "ไม่พบ" message | Auth error handling regression |
| TC-05 | Landing page GET returns 200 | Site is offline |

Exit code 0 = all non-skipped PASS. Exit code 1 = at least one FAIL — investigate before declaring deploy successful. TC-01 SKIP (no `SMOKE_ADMIN_PW` set) is acceptable but logs the reason — per the State Transparency Rule.

### 6.3 Manual 3-flow check (alternative)

If you do not have access to the secrets manager, run a manual sanity check in a browser:

1. `https://<prod-url>/` → click "พนักงานสาขา" → login `1000` / `vl1000` → must reach `/user/dashboard`.
2. Logout → click "Admin" → login `admin` / `<real-pw>` → must reach `/admin/dashboard`.
3. Logout → return to landing → click any technician login → must reach `/technician/dashboard`.

All three flows must complete in under 60 seconds with no console errors.

---

## §7 — Environment Variables Reference

| Variable | Where set | Purpose | Notes |
|----------|-----------|---------|-------|
| `DATABASE_URL` | Vercel (Prod + Preview), local `.env` | Pooled Postgres connection used by app at runtime | `?pgbouncer=true` required for pooler; port 6543 |
| `DIRECT_URL` | Vercel (Prod + Preview), local `.env` | Direct Postgres connection used by Prisma `db push` and `generate` | Port 5432 |
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel (Prod + Preview), local `.env` | Supabase REST URL for client + storage | Exposed to browser (NEXT_PUBLIC_ prefix) — not a secret |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Vercel (Prod + Preview), local `.env` | Supabase anon JWT | Exposed to browser — RLS must be configured in Supabase |
| `ADMIN_INITIAL_PASSWORD` | **LOCAL ONLY**, ephemeral | Seed-time admin password (one-shot) | **NEVER** add to Vercel. Set in current PowerShell session only. `Remove-Item` immediately after seeding. Minimum 12 chars enforced by `seed_production.mjs:100`. |
| `PROD_URL` | **LOCAL ONLY**, ephemeral | Base URL for `prod_smoke_test.ts` | Set only when running smoke test against deployed prod |
| `SMOKE_ADMIN_PW` | **LOCAL ONLY**, ephemeral | Admin password for smoke test TC-01 | Set only when running smoke test. Never persisted. |
| `SMOKE_BRANCH_USER` | **LOCAL ONLY**, optional | Branch username for TC-03 | Defaults to `1000` |
| `SMOKE_BRANCH_PW` | **LOCAL ONLY**, optional | Branch password for TC-03 | Defaults to `vl1000` |
| `NODE_ENV` | Set by runtime (Vercel = `production`) | Controls Prisma client logging + cookie `secure` flag | Auto-managed, do not set manually |

Removed (formerly used, dropped by SYN-06 on 11-05-2026):
- `NEXT_PUBLIC_LIFF_ID` — LIFF SDK removed
- `LINE_CHANNEL_ACCESS_TOKEN` — LINE Messaging API removed
- `LINE_CHANNEL_SECRET` — webhook handler removed

If any of these reappear in source code or in Vercel's env panel, it is a regression — investigate before deploying.

---

## §8 — Forbidden Actions

Do NOT do any of these without explicit Commander authorization:

| Forbidden | Why |
|-----------|-----|
| `git push` directly to `main` without `/git commit` | Bypasses 2-pass review, sensitive-file scan, branch protection. Per the Git Workflow Rule. |
| Commit `.env`, `.env.local`, or any file containing `DATABASE_URL` with real credentials | One leaked Supabase DB URL = full data exfiltration risk. `.gitignore` should catch this — verify before pushing. |
| Set `ADMIN_INITIAL_PASSWORD` as a Vercel environment variable | The variable is meant to live for the duration of a single seed run, then be cleared. Persisting it in Vercel keeps a high-value credential in a shared dashboard indefinitely. |
| Re-introduce `@line/liff`, `LINE_*`, or `LIFF*` references | SYN-06 removed them per Commander directive. The regression test at `09_TestCase/_regression/login_no_line.spec.md` will catch this — never override. |
| Run `npx prisma migrate dev` against the production DB | Project deliberately uses `db push`. Mixing the two corrupts the `_prisma_migrations` table. If migration history is needed, schedule a Phase to introduce it cleanly. |
| Manually `UPDATE` the `Password` column in PostgreSQL without also writing `PasswordHash` | Violates the BUG-02 dual-write contract. Auth pipeline expects both columns in sync. Use the seed script. |
| Force-push `--force` to `main` without Commander approval | Rewrites history that Vercel and collaborators have already built against. |
| Run `npm audit fix --force` | Currently 2 vulnerabilities remain (1 high `next`, 1 moderate `postcss`) requiring `--force` to fix, which would bump `next` from 16.1.6 → 16.2.6 (breaking-change-range). Tracked in `07_TechnicalDebt/TD-002_NextPostcssAuditForce.md` — Commander decision pending. |

---

## §9 — Quick Reference: First-Deploy Checklist

```
[ ] Supabase project created in ap-southeast-1
[ ] Storage bucket created (public, for ticket images)
[ ] Local .env populated from .env.example with real values
[ ] `npm install` succeeded
[ ] `npx prisma db push` reports "in sync"
[ ] `ADMIN_INITIAL_PASSWORD` env var set (12+ chars), seed run, env var cleared
[ ] 45/45 branches seeded successfully
[ ] Admin user created with hashed password
[ ] Vercel project linked to GitHub repo, root dir = ticket-system/
[ ] All 4 NEXT_PUBLIC_* + DATABASE_URL + DIRECT_URL env vars set in Vercel
[ ] First Vercel build PASS
[ ] Smoke test script ran with PROD_URL set — all TCs PASS
[ ] Manual 3-flow login check PASS
```

---

## §10 — Audit Trail

| Date | Change | By |
|------|--------|----|
| 11-05-2026 | Runbook created (MON-07), reflects post-Phase-1 state: post-LINE-removal, post-schema-sync, post-silent-user-fix | SC (Monolith, AT review) |
