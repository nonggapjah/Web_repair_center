# Phase 1 — Stabilization & Tech Debt Sprint

**Project:** Web_repair_center
**Phase:** 1
**Date:** 11-05-2026
**Authorized by:** Commander ท่านผู้บัญชาการ
**Mode:** A — AM Direct Orchestration
**Teams:** Syndicate (lead) + Monolith + Overseer AS

---

## 1. Context

หลัง Phase 0 (Foundation) + Phase 0.5 (Security Migration) + 3 hotfixes (BUG-01/02/03) → ระบบมั่นคงและ pass production verification แล้ว Phase 1 เป็น tech debt sprint:
- เก็บกวาด LINE integration (Commander directive — ไม่ใช้แล้ว)
- เพิ่ม observability/safety nets ป้องกัน incident แบบ BUG-01 ซ้ำ
- ปิด tech debt ที่ flag ไว้ใน PreExisting TechStack scan

## 2. Goals

1. **Prevent stale-deploy bug recurrence** — production smoke test script ที่ตรวจหลังทุก deploy
2. **Remove LINE entirely** — ทุก surface (LIFF + Messaging API + webhook + env + comments)
3. **Document deployment** — DeploymentRunbook สำหรับ deploy/rollback/seed
4. **Fix schema/code mismatch** — `CurrentStatus` typo + default sync
5. **Fix silent failure** — `createTicket()` auto-create user side effect
6. **Address npm vulnerabilities** — 7 transitive deps

## 3. Non-Goals

- ❌ admin/dashboard refactor (765 LOC) — defer to Phase 2
- ❌ Phase 0.5d cleanup (drop Password column) — wait 1-2 weeks for observation
- ❌ MFA / 2FA — future enhancement
- ❌ Database migration history retrofit (continue using `db push`)

## 4. Tickets

| ID | Title | Team | Complexity | Touches Code? |
|----|-------|------|------------|---------------|
| SYN-04 | Production smoke test script | Syndicate | Medium | Yes (new file) |
| SYN-05 | npm audit fix | Syndicate | Simple | Yes (lockfile) |
| SYN-06 | Remove LINE integration entirely | Syndicate | Medium | Yes (delete + modify multiple) |
| MON-07 | DeploymentRunbook.md | Monolith | Simple | No (doc only) |
| MON-08 | Schema `Planed` → `Planned` + default `Open` | Monolith | Simple | Yes (schema + db push) |
| MON-09 | `createTicket()` silent user creation fix | Monolith | Medium | Yes (tickets.ts) |
| OVS-04 | UX smoke test + User Journey Walkthrough | Overseer (AS) | Medium | No (testing only) |

## 5. Dependencies / ZCB Check

```
SYN-06 ──blocks──→ MON-09  (both touch tickets.ts; SYN-06 first to clean LINE comments)
All others: independent ✓
```

ZCB Status: **PASS** — only one-hop dependency, within same phase OK

## 6. Cross-Package Change Manifest (LINE removal — SYN-06)

| File | Action | Interface Impact |
|------|--------|------------------|
| `src/components/LiffProvider.tsx` | DELETE | Login page imports — must update |
| `src/lib/lineNotify.ts` | DELETE | tickets.ts comments — must remove |
| `src/app/api/webhook/route.ts` | DELETE | No external callers — safe |
| `src/app/login/page.tsx` | MODIFY | Remove useLiff + LIFF button + profile display |
| `src/app/layout.tsx` | MODIFY | Unwrap LiffProvider |
| `src/app/actions/tickets.ts` | MODIFY | Remove LINE comments (lines 4, 44, 188-190) |
| `package.json` | MODIFY | Remove `@line/liff` dep |
| `package-lock.json` | MODIFY | Auto-regen via `npm install` |
| `.env.example` | MODIFY | Remove 3 LINE env vars |
| `Development/.../PreExisting TechStack/Web_repair_center.md` | MODIFY | Mark Notifications + LIFF + Webhook subsystems REMOVED |

**Breaking change?** NO — LIFF was optional UI, LINE Notify was already disabled. No user-facing feature loss.

## 7. Execution Order

1. **Wave 1 (Sequential):** Syndicate subagent — SYN-04 + SYN-05 + SYN-06 (LINE removal completes)
2. **Wave 2 (Sequential after Wave 1):** Monolith subagent — MON-07 + MON-08 + MON-09 (depends on cleaned tickets.ts)
3. **Wave 3 (Main session):** AS UX smoke test (OVS-04) — full E2E walkthrough
4. **Wave 4 (Main session):** Build verify + `/git commit` + push → Vercel auto-deploy
5. **Wave 5 (Commander):** Verify production after Vercel build (admin + branch login still works, ticket creation works)

## 8. Acceptance Criteria (Phase-level)

- [ ] ทุก ticket [x] Complete
- [ ] LINE refs ทุกที่ใน src/ + package.json + .env.example ถูกลบ (grep `liff\|line` returns 0 in src/)
- [ ] `npm audit` shows 0 high/critical vulnerabilities (moderate acceptable)
- [ ] `npm run build` PASS — 6 routes (เดิม 7 ลบ webhook) ครบ
- [ ] `DeploymentRunbook.md` exists ใน `06_InstallationGuide/`
- [ ] Schema default `CurrentStatus` = `Open` (sync กับ code)
- [ ] `createTicket()` ไม่สร้าง user เงียบๆ — แจ้ง error ถ้าไม่มี user
- [ ] Production smoke test script ทำงาน (manual run ผ่าน)
- [ ] OVS-04 User Journey Walkthrough: all steps PASS
- [ ] Branch user 1000/vl1000 + admin login ทำงานเหมือนเดิม (regression check)

## 9. Risk & Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| LINE removal break login page render | Low | High | Login page uses LIFF as optional — verify isolation in UX smoke test |
| npm audit fix bump breaking changes | Medium | Medium | Use `npm audit fix` without `--force`; if force needed → flag to Commander |
| Schema migrate breaks existing tickets | Low | High | Default change only affects NEW rows; existing `'Planed'` rows stay until manual update |
| createTicket() user-creation removal breaks form | Low | High | UX smoke test new-ticket form before close |

## 10. Boundaries

- Do NOT touch: admin/dashboard/page.tsx (Phase 2 scope)
- Do NOT touch: User.Password column (Phase 0.5d scope)
- Do NOT migrate existing `'Planed'` rows (Phase 1 only fixes default; data migration ตามมาภายหลัง)
- Do NOT add: new features (Phase 1 is cleanup only)
- Do NOT commit: `.env` or secrets

## 11. Notes

- Mode A subagent spawn order documented for audit trail
- After Phase 1: Phase 0.5d (cleanup) → Phase 2 (admin dashboard refactor + MFA?)
- Commander preference: main-only commits via `/git commit --force` (memory recorded)
