# MON-07 — DeploymentRunbook.md

**Phase:** 1
**Team:** Monolith
**Status:** [x] Complete
**Completed:** 11-05-2026 by Monolith (SC drafted, AT structural review, PF section-coverage audit)
**Complexity:** Simple
**Depends on:** SYN-06 (เพื่อเขียน runbook ที่สะท้อน state หลัง LINE removal)
**Blocks:** None

## Scope
สร้าง `Development/Web_repair_center/06_InstallationGuide/DeploymentRunbook.md` — เอกสาร step-by-step สำหรับ:
1. Initial deployment (Vercel + Supabase setup จาก scratch)
2. Routine redeploy (after push to main)
3. Database migration / schema change
4. Seed script execution (with ephemeral admin password pattern)
5. Rollback procedure (revert Vercel deploy + git revert)
6. Smoke test after deploy (link ไป SYN-04 script)
7. Environment variable reference (Vercel dashboard fields)

## Acceptance Criteria
- [x] ไฟล์ `Development/Web_repair_center/06_InstallationGuide/DeploymentRunbook.md` exists — 416 lines, 10 §-sections (7 mandatory + §8 Forbidden Actions + §9 First-Deploy Checklist + §10 Audit Trail)
- [x] Section 1: Initial Setup — Supabase project + region + storage bucket + local DB init (`prisma db push` + `generate`) + first seed (with ephemeral `ADMIN_INITIAL_PASSWORD`) + Vercel link with all env vars + 5-step sanity check
- [x] Section 2: Routine Redeploy — pre-flight, mandatory build verification (`tsc --noEmit` + `next build` with expected 7-route output), `/git commit` / `/git pr` governed flow (no raw git), post-deploy smoke test handoff
- [x] Section 3: Schema Change — `db push` (not `migrate dev`) rationale documented, format → validate → push → generate sequence, destructive-prompt warning, Supabase SQL verification example (MON-08 reference), known Windows `EPERM` quirk + workaround
- [x] Section 4: Seed Execution — ephemeral env var pattern (set in PowerShell session → run → `Remove-Item`), idempotent upsert contract, MON-09 contract reference (createTicket no longer auto-creates), BUG-02 dual-write contract (`Password` + `PasswordHash` both written)
- [x] Section 5: Rollback — Fast path (Vercel "Promote to Production") + Permanent path (git revert via `/git` skill) + Database rollback note (schema reverts require manual `prisma db push` + Supabase backup)
- [x] Section 6: Post-Deploy Smoke Test — SYN-04 script reference (`ticket-system/scripts/prod_smoke_test.ts`, 5 TCs), invocation syntax with ephemeral `SMOKE_ADMIN_PW` + `PROD_URL`, TC table (what each verifies, FAIL action), manual 3-flow fallback
- [x] Section 7: Env Vars Reference — 11-row table (`DATABASE_URL`, `DIRECT_URL`, 2 `NEXT_PUBLIC_*`, `ADMIN_INITIAL_PASSWORD` LOCAL-ONLY, `PROD_URL` LOCAL-ONLY, `SMOKE_*` LOCAL-ONLY, `NODE_ENV`) + explicit list of removed LINE vars
- [x] Forbidden actions section — 8 entries (§8): no raw `git push`, no `.env` commits, no `ADMIN_INITIAL_PASSWORD` in Vercel, no LINE reintroduction, no `prisma migrate dev`, no Password-only writes, no main force-push, no `npm audit fix --force` (TD-002 reference)
- [x] Reflects post-LINE state — no LIFF / LINE Notify / webhook references; removed-vars section explicitly lists what was dropped by SYN-06
- [x] References SYN-04 smoke test script throughout §1.6, §2.4, §6
- [x] Documents ephemeral env var pattern for admin password rotation (§1.4, §4)
- [x] Out-of-scope boundaries respected: no Phase 0.5d (drop Password column) prescription, no real credentials, no Phase 2 admin-dashboard refactor mention

## Boundaries
- Do NOT include: real credentials, real Supabase URLs, real LINE tokens (already removed by SYN-06)
- Do NOT prescribe: features Phase 1 didn't ship (Phase 0.5d cleanup is future, don't document yet)

## Notes
ผู้อ่าน: dev/ops คนต่อไป + future Commander หลังจาก context loss
ระดับความละเอียด: ตามขั้นที่ Commander ทำจริงใน session ที่ผ่านมา (commit, push, Vercel deploy, seed, rotate admin)
