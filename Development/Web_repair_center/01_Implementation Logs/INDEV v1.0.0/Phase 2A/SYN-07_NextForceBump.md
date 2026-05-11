# SYN-07 — TD-002 Next.js force-bump (resolve npm audit)

**Phase:** 2A
**Team:** Syndicate
**Status:** [x] Complete
**Completed:** 11-05-2026 — bumped Next.js 16.1.6 → 16.2.6, 1 high + 1 moderate → 0 high + 2 moderate (postcss-chain, refuses downgrade to Next.js 9)
**Complexity:** Simple
**Depends on:** None
**Blocks:** Phase 2A overall — if this fails, halt; if passes, others proceed

## Scope
Resolve TD-002 — รัน `npm audit fix --force` ใน `ticket-system/` เพื่อปิด 2 vulns ที่เหลือ (1 high + 1 moderate น่าจะ transitive ของ Next.js 16.1.6)

## Acceptance Criteria
- [x] Baseline: รัน `npm audit` → record output
- [x] รัน `npm audit fix --force` → ดูว่า bump ตัวไหน
- [x] หลัง force: verify Next.js version, build script ยังทำงาน
- [x] `npx tsc --noEmit` clean
- [x] `npm run build` PASS — 7 routes ครบ
- [x] Manual smoke (dev server): landing + login page โหลด, login admin ยังทำงาน
- [x] หลัง: รัน `npm audit` → 0 high/critical (moderate ยอมรับได้)
- [x] Update TD-002 ใน `07_TechnicalDebt/` → status RESOLVED + record bump version

## Fail-fast Decision
- ถ้า build PASS → ticket [x] Complete, Phase 2A ดำเนินต่อ
- ถ้า build FAIL → revert via `git checkout -- package.json package-lock.json` หรือ `git restore`, mark ticket [>] DEFERRED, update TD-002 ว่า force-bump ยัง breaking — Phase 2A อื่นๆ ทำต่อโดยไม่มี SYN-07

## Boundaries
- Do NOT use additional `--force` flags
- Do NOT manually edit package.json version pins
- Do NOT push commits with broken build

## Notes
- ปัจจุบัน Next.js = 16.1.6, น่าจะ bump → 16.2.x หรือสูงกว่า
- Vulns ปัจจุบัน (Phase 1 SYN-05 baseline): 2 รายการ — ดู `09_TestCase/_regression/npm_audit_baseline.spec.md`
- ถ้า fail-fast → revert + continue Phase 2A อื่นๆ — TD-002 จะถูก revisit ใน Phase 2B
