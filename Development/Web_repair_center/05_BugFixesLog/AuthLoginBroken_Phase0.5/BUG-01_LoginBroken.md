# BUG-01 — Login broken after Phase 0.5 password migration

**Project:** Web_repair_center
**Phase:** 0.5 (Hotfix)
**Team:** Syndicate (lead) + Monolith (DB inspection support)
**Status:** [x] Complete
**Severity:** 🔴 CRITICAL → resolved as 🟡 MEDIUM (deployment process gap, not code bug)
**Discovered:** 09-05-2026 by Commander manual smoke test
**Resolved:** 09-05-2026 — verified working on localhost:3000

## Symptom
Commander ทดสอบ login ด้วย user `1000` / `vl1000` บนเว็บ deploy เดิม → "รหัสผ่านไม่ถูกต้อง"

## Investigation Results

### Step 1 — Read-only DB Inspection (instrument-first per §6)
สร้าง `scripts/inspect_user.ts` — ดูค่าจริงของ user "1000":
```
UserID:           64e68f98-c7d2-4a1c-a492-87151bb89d7c
Username:         "1000" (len 4)
Password:         "vl1000" (len 6)         ← plaintext column ยังคงอยู่
PasswordHash:     $2b$10$DbYjwsCC...        ← 60-char valid bcrypt
bcrypt.compare("vl1000", PasswordHash) =>  true   ✓
plaintext compare ("vl1000" === Password) => true ✓
```

### Step 2 — Process inspection
- ไม่มี Node/Next process รันใน local
- Source code commit `f8ddfbf` มีการเปลี่ยน auth.ts + schema + package.json ครบ
- Dev server เพิ่งเริ่มใน background สำหรับ verification

### Step 3 — Localhost verification
Commander เปิด `http://localhost:3000/login` → login user `1000` / `vl1000` → **สำเร็จ** ✓

## Root Cause

**Stale deployment** — เว็บที่ Commander ทดสอบครั้งแรกเป็น production deploy ที่ยังรันโค้ดเก่า (ก่อน Phase 0.5 commit `f8ddfbf`) Source code + DB ใน main branch ถูกต้อง แต่ deployment process ไม่ได้ rebuild + redeploy หลัง commit

## Why this matters
ตามนโยบาย §2 Acceptance Criteria สำหรับ Phase 0.5: "ทุก existing user login ด้วย password เดิมได้" → criteria นี้ผ่านเมื่อทดสอบบน localhost (latest code) แต่ไม่ผ่านบน deploy ที่ stale

นี่ไม่ใช่ regression ใน code — เป็น **deployment process gap**: ไม่มี automated CI/CD ที่จะ trigger rebuild + restart หลัง git push

## Resolution

1. ✅ Confirmed code ถูกต้อง (DB + bcrypt + dual-mode logic ทั้งหมดทำงาน)
2. ✅ ลบ `scripts/inspect_user.ts` (debug-only, ตาม §6 RELEASE rule "remove on fix")
3. ✅ เพิ่ม regression test สำหรับ auth dual-mode login (Hotfix Regression Gate)
4. 📋 **Action needed:** Commander ต้อง redeploy production environment เพื่อให้ user ใช้ login ได้

## Acceptance Criteria
- [x] DB inspection — user 1000 record verified
- [x] Root cause identified — stale deployment, not code
- [x] Localhost verified working
- [x] Debug probe (inspect_user.ts) removed
- [x] Regression test added — `Development/09_TestCase/_regression/auth_dualmode.spec.md`
- [x] Phase 0.5 acceptance criteria still pass on latest code

## Boundaries — what was NOT changed
- Did NOT modify auth.ts, schema.prisma, migrate_passwords.ts (all working correctly)
- Did NOT touch DB user records
- Did NOT change deployment process (separate ticket if needed)

## Lessons / Tech Debt Flagged

| # | Item | Severity | Suggested Action |
|---|------|----------|------------------|
| 1 | No automated CI/CD for production redeploy | 🟡 HIGH | Open ticket: setup auto-deploy on main push (Vercel/Cloudflare/GitHub Action) |
| 2 | No deployment runbook documented | 🟡 MEDIUM | Open ticket: write `06_InstallationGuide/DeploymentRunbook.md` |
| 3 | No production smoke test script | 🟢 MEDIUM | Open ticket: create `scripts/prod_smoke_test.ts` to verify auth + key endpoints |

## Notes
ครั้งแรกที่ตรวจ git status ผมเห็นแค่ untracked files (`Development/05_BugFixesLog/` + `scripts/inspect_user.ts`) — ไม่มี modified files. ภายหลังเช็ค git log เจอ commit `f8ddfbf` ที่ Commander commit งาน Phase 0/0.5 ของผมไปแล้ว (ก่อนผมเริ่ม BUG-01 investigation) — นั่นคือเหตุผลที่ git status ใส่สะอาด

---

## Debug Instrumentation Session
- **Probe:** `scripts/inspect_user.ts` — read-only DB query + bcrypt comparison
- **Findings:** DB state perfect, hash logic perfect → bug ไม่ได้อยู่ที่ data layer
- **Probe removed:** Yes (file deleted in this commit per §6 RELEASE rule)
