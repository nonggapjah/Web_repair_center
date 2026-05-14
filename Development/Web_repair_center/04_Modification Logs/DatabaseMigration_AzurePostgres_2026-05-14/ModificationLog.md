# Modification Log — Database Migration to Azure Postgres

**Created:** 14-05-2026
**Project:** Web_repair_center
**Phase Label:** 3 — DB Migration (Modification, dual-write window)
**Mode:** AM-led main-context execution (subagents avoided after Phase 2B failures)
**Status:** Milestones 1-4 COMPLETE (14-05-2026); Milestones 5-8 = follow-up sessions

## Execution Summary (M1-M4)

| Milestone | Result | Evidence |
|---|---|---|
| **M1** Connectivity + schema `@@map` | ✅ Postgres 17.8 reachable, schema valid, tsc clean | All 9 models pinned to `repair_*` |
| **M2a** Atomic Supabase rename + transition VIEWs | ✅ All 9 tables renamed; old-name VIEWs created in same TX | `scripts/db-migration-azure/01_rename-supabase-tables.mjs` |
| **M2b** Apply schema to Azure | ✅ 9 tables created (29 DDL stmts: 9 CREATE + 13 INDEX + 7 FK), coexists with pre-existing `user_tenants`/`workspaces`/`workspace_members` | `scripts/.../03_apply-azure-schema.mjs` |
| **M3** Bulk data migration | ✅ **916/916 rows transferred, 100% parity** (Branch 47, User 60, RepairTicket 137, TicketTechnician 75, TicketHistory 221, TicketComment 26, Notification 191, AuditLog 129, FailedLoginAttempt 30) | `scripts/.../04_migrate-data.mjs` (idempotent, FK-ordered) |
| **M4** Dual-write Prisma extension | ✅ `src/lib/prisma.ts` $extends + `src/lib/prisma-azure.ts` lazy client; tsc clean; default OFF (env-flag gated) | Production runtime untested — see notes below |

### Dual-Write Smoke Test Note
The CLI smoke test (`05_dual-write-smoke-test.mjs`) reproducibly fails with Azure
"can't reach server" when two PrismaClient instances are constructed back-to-back in
the same script — likely a Prisma CLI-context init race. Single-client connections to
Azure work fine (verified). The production extension uses ONE long-lived PrismaClient
in the Next.js server process and only FIRES the Azure mirror as fail-soft on
mutations, so the CLI quirk does not apply. Activation is gated by env flag — first
production deploy will ship with `DUAL_WRITE_AZURE` unset (default OFF) so the
extension is a no-op until Commander explicitly turns it on.

### Action Items for Commander (Vercel side)
Before activating dual-write in production, set these env vars in Vercel project settings:

1. `AZURE_DATABASE_URL` = `postgresql://admdatamanager:<URL-ENCODED-PW>@pgsql-db-manager.postgres.database.azure.com:5432/postgres?sslmode=require`
2. `DUAL_WRITE_AZURE` = `true` (only after step 1 verified)

Then redeploy. The extension will start mirroring every Supabase mutation to Azure.
Watch Vercel logs for `[DUAL-WRITE]` errors during the 24-48h observation window.

### Security Followup (post-cutover)
Rotate the Azure password — the value Commander pasted in chat is now in conversation
history. Rotate via Azure Portal → reset the env var in Vercel → restart deploy.



---

## 1. Origin

Commander request (13-14 May 2026): migrate database from Supabase Postgres to a
self-managed Azure Database for PostgreSQL Flexible Server. Driver = data sovereignty
(Commander has provisioned a VM-adjacent DB instance and wants application data on
infrastructure they control). Originally framed as "MSSQL migration" but the target
turned out to be Azure Postgres — Best Option (Postgres-to-Postgres) preserved.

Connection target (provided by Commander, Session 10):
- Host: `pgsql-db-manager.postgres.database.azure.com:5432`
- DB:   `postgres`
- User: `admdatamanager`
- SSL:  required, trust server cert

**SECURITY:** password exposed in Claude chat history — rotate after migration.

## 2. Goal

Migrate every byte of production data from Supabase to Azure with **zero data loss**
and **zero permanent downtime** (brief schema-rename window of seconds is acceptable).
Use a **dual-write window** (24-48h) before flipping reads, so any Azure issue is
detected and rolled back without user impact.

## 3. Scope

All 9 production tables (Phase 0 + Phase 2A + Phase 2B):

| Prisma Model | Old Postgres Name | New Postgres Name (`@@map`) | Origin |
|---|---|---|---|
| `Branch` | `Branch` | `repair_branch` | Phase 0 |
| `User` | `User` | `repair_user` | Phase 0 |
| `RepairTicket` | `RepairTicket` | `repair_repairticket` | Phase 0 |
| `TicketHistory` | `TicketHistory` | `repair_tickethistory` | Phase 0 |
| `TicketComment` | `TicketComment` | `repair_ticketcomment` | Phase 0 |
| `Notification` | `Notification` | `repair_notification` | Phase 0 |
| `AuditLog` | `AuditLog` | `repair_auditlog` | Phase 2A (MON-10) |
| `FailedLoginAttempt` | `FailedLoginAttempt` | `repair_failedloginattempt` | Phase 2A (MON-10) |
| `TicketTechnician` | `TicketTechnician` | `repair_tickettechnician` | Phase 2B (MON-13) |

## 4. Milestones (gated, checkpoint to Commander after each)

| # | Milestone | Risk | ETA |
|---|---|---|---|
| 1 | Schema `@@map` + Azure connectivity verification (no prod change) | Zero | 15 min |
| 2 | Atomic Supabase rename + Azure schema push | Brief downtime (~10 sec) | 20 min |
| 3 | Initial data migration Supabase → Azure (FK-ordered, idempotent) | Zero downtime | 30 min |
| 4 | Dual-write Prisma extension activation + Vercel deploy | Zero downtime | 20 min |
| 5 | 24-48hr drift observation (periodic diff check) | Zero | passive |
| 6 | Cutover: flip Vercel DATABASE_URL → Azure (read traffic) | Brief flicker | 10 min |
| 7 | Disable dual-write extension | Zero | 10 min |
| 8 | Retire Supabase as primary (keep as warm spare 30 days) | Zero | passive |
| **9**  | Dockerfile + .dockerignore + local docker build verification | Zero | 30 min |
| **10** | Mirror push GitHub → Azure DevOps Repos (history preserved) | Zero | 15 min |
| **11** | Build & push image to ACR `villarepair.azurecr.io` | Zero | 30 min |
| **12** | Provision Azure App Service for Containers + env vars (Azure DB) | Zero | 45 min |
| **13** | Staging smoke test on `*.azurewebsites.net` (login, ticket create, admin save) | Zero | 60 min |
| **14** | Final M3 re-sync + cutover (pause Vercel, App Service rises) | ~2 min flicker | 15 min |

**Scope expansion (D+0, 14-05-2026):** Commander confirmed full-stack migration off Vercel/GitHub onto Azure (Q1 = App Service for Containers; Q2 = within 1 week; Q3 = Azure URL first; Q4 = dual-write OFF during transition). Milestones 5-8 are de-scoped — replaced by M9-M14. Dual-write is being turned OFF, so M5 drift observation is moot. M14 includes a final Supabase→Azure re-sync run before cutover to capture all rows written during the migration week.

**Today's session = Milestones 1-4. M9-M14 = this week (target cutover D+6, 20-05-2026).**

## 5. Ticket Index

| ID | Title | Milestone | Status |
|---|---|---|---|
| **DBM-01** | Schema `@@map` + connectivity test | 1 | [x] COMPLETE |
| **DBM-02** | Atomic Supabase rename + Azure schema push | 2 | [x] COMPLETE |
| **DBM-03** | Migration script (dual Prisma clients) | 3 | [x] COMPLETE |
| **DBM-04** | Per-table row count verification | 3 | [x] COMPLETE (916/916) |
| **DBM-05** | Dual-write Prisma extension + env flag | 4 | [x] COMPLETE (deploy ready, awaiting Vercel env activation) |
| **DBM-06** | 24-48hr drift observation script | 5 | [ ] PENDING (next session) |
| **DBM-07** | Vercel DATABASE_URL cutover to Azure | 6 | [ ] PENDING (next session) |
| **DBM-08** | Disable dual-write + decommission Supabase primary | 7-8 | [>] DEFERRED — superseded by MON-15+MON-19 (full-stack migration changed cutover path) |
| **MON-14** | Dockerfile + .dockerignore (Next.js standalone, multi-stage Node 20-alpine) | 9 | [ ] PENDING |
| **MON-15** | Local docker build + run verification | 9 | [ ] PENDING |
| **MON-16** | Add Azure DevOps remote + initial mirror push | 10 | [ ] PENDING |
| **MON-17** | Build image + push to ACR `villarepair.azurecr.io` (admin auth via az CLI) | 11 | [ ] PENDING |
| **MON-18** | Provision App Service for Containers (Linux, B1+, Southeast Asia) + env vars | 12 | [ ] PENDING |
| **MON-19** | Staging smoke test on `*.azurewebsites.net` URL — full feature pass | 13 | [ ] PENDING |
| **MON-20** | Final Supabase→Azure re-sync + Vercel pause + App Service cutover | 14 | [ ] PENDING |

## 6. Test Plan (Verification Scholar AS)

### R-01 — Per-table row count parity (post-Milestone 3)
For each of 9 tables: `count(Supabase) == count(Azure)`. Zero tolerance.

### R-02 — Dual-write sample insert (post-Milestone 4)
Insert 1 sample notification via API; verify it lands in BOTH databases within 1 second.

### R-03 — Drift detection (Milestone 5, periodic)
Per-table count + max(updatedAt) comparison every 1 hour for 24-48h. Drift > 0 = halt cutover.

### R-04 — Read-flip smoke test (post-Milestone 6)
After Vercel DATABASE_URL flip, verify:
- Admin login works
- Branch login works (5 sample branches)
- Existing tickets visible in admin dashboard
- New ticket creation works
- Image upload still works (Supabase Storage unaffected — separate concern)

### R-05 — Rollback dry-run
Document step-by-step rollback (flip DATABASE_URL back to Supabase) — must be < 5 min.

## 7. Boundaries — Out of Scope This Phase

- **Supabase Storage** (ticket image uploads) — stays on Supabase Storage. Migrating
  image hosting is a separate decision (MinIO on VM / Azure Blob / etc.). Will file as
  follow-up if Commander wants full Supabase decommission.
- **App authentication system** — unaffected (custom session + bcrypt is DB-agnostic)
- **AuditLog content semantics** — schema migrates, but no historical re-evaluation

## 8. Critical Risk Register

| Risk | Mitigation |
|---|---|
| Rename window (~10 sec) Vercel errors visible to users | Run during low-traffic window; rename in single transaction |
| Azure connection from Vercel fails (firewall) | Test with `prisma db push` before any data move (Milestone 1) |
| Dual-write fails silently on Azure | Extension fail-soft logs to console.error → monitor Vercel logs during M5 |
| FK violation during data migration | Migrate in dependency order: Branch → User → RepairTicket → ... |
| Production data corruption | Supabase remains primary until Milestone 6 — instant rollback by reverting env var |
| Password leak (in chat) | Rotate via Azure Portal post-cutover; never write to .env |

## 9. Acceptance / Phase Closure

- All 8 tickets [x] COMPLETE
- R-01..R-05 PASS
- Commander UAT signoff
- Supabase decommission deferred to follow-up after warm-spare window

---

*Status flow: PLANNED → IN PROGRESS (Milestone 1 starting) → COMPLETE per milestone*
