# OVS-05 — Phase 2A UX Smoke + User Journey Walkthrough

**Phase:** 2A
**Team:** Overseer (AS — Design & Verification Scholar)
**Status:** [x] Complete
**Completed:** 11-05-2026 by Overseer (AS verification + Commander manual sign-off)
**Complexity:** Medium
**Depends on:** SYN-07/08/09/10/11, MON-10 (all Phase 2A source-code tickets)
**Blocks:** Phase 2A closeout + commit

## Scope
ตาม §2 — UX Smoke Test + User Journey Walkthrough เพื่อ verify Phase 2A ไม่ทำให้ flow ใช้งานเดิมพัง

## Part 1 — Per-Ticket UX Smoke

### SYN-07 (force-bump)
| Step | Action | Expected | Actual | PASS/FAIL |
|------|--------|----------|--------|-----------|
| 1 | `npm audit` after | 0 high/critical | | |
| 2 | Verify Next.js version in `package.json` | bumped | | |
| 3 | `npm run build` | PASS, 7 routes | | |
| 4 | (or DEFERRED) — verify ticket marked [>] | yes if force broke | | |

### MON-10 (schema)
| Step | Action | Expected | Actual | PASS/FAIL |
|------|--------|----------|--------|-----------|
| 1 | Supabase SQL: `SELECT * FROM "AuditLog" LIMIT 0` | success (empty table) | | |
| 2 | Supabase SQL: `SELECT * FROM "FailedLoginAttempt" LIMIT 0` | success | | |
| 3 | Indexes present (Prisma applied) | yes via `\d` or info schema | | |

### SYN-08 (rate limit)
| Step | Action | Expected | Actual | PASS/FAIL |
|------|--------|----------|--------|-----------|
| 1 | Login admin wrong pw 1-9 times | each fails with "รหัสผ่านไม่ถูกต้อง" | | |
| 2 | Login admin wrong pw 10th time within 15 min | locked: "ลองเข้าระบบล้มเหลวหลายครั้งเกินไป กรุณารอ N นาที" | | |
| 3 | Wait 15 min OR delete rows manually | retry allowed | | |
| 4 | Successful login | clears FailedLoginAttempt for that username | | |
| 5 | Branch 1000 / vl1000 — login first try | success, no lockout | | |

### SYN-09 (session timeout)
| Step | Action | Expected | Actual | PASS/FAIL |
|------|--------|----------|--------|-----------|
| 1 | Login admin → check Set-Cookie header | Max-Age=14400 (4h) | | |
| 2 | Login `1000` (User) → check Set-Cookie | Max-Age=86400 (24h) | | |
| 3 | Existing logged-in session (before deploy) | continues until natural expiry | | |

### SYN-10 (CSRF)
| Step | Action | Expected | Actual | PASS/FAIL |
|------|--------|----------|--------|-----------|
| 1 | Login → Set-Cookie includes SameSite=Lax | yes | | |
| 2 | Cross-origin POST to login (e.g. curl from other origin) | rejected by Next.js Origin check | | |
| 3 | Audit report exists at `08_AuditReport/CSRF_Audit_Phase2A.md` | yes, signed | | |

### SYN-11 (audit log)
| Step | Action | Expected | Actual | PASS/FAIL |
|------|--------|----------|--------|-----------|
| 1 | Admin login → update ticket status | AuditLog row created with action="ticket.status.update" | | |
| 2 | Admin assign technician | AuditLog row created with action="ticket.technician.assign" | | |
| 3 | Verify Before/After snapshots in AuditLog | JSON valid, no password fields | | |
| 4 | (Negative) Force DB error during logAudit → main action ยังสำเร็จ | yes — fail-soft | | |

## Part 2 — User Journey Walkthrough (E2E)

ใช้ flow เหมือน OVS-04 (Phase 1) + เพิ่ม security checks

| Step | Persona | Action | Expected | Actual | PASS/FAIL |
|------|---------|--------|----------|--------|-----------|
| 1 | Branch | login `1000` / `vl1000` | success → /user/dashboard | | |
| 2 | Branch | create ticket | success | | |
| 3 | Admin | login `admin` / `villa@admin2026` | success → /admin/dashboard | | |
| 4 | Admin | open ticket from step 2 | view ticket detail | | |
| 5 | Admin | update status | save success + AuditLog entry | | |
| 6 | Admin | assign technician | save success + AuditLog entry | | |
| 7 | Tech | login → assigned ticket appears | yes | | |
| 8 | Tech | update progress | save success + AuditLog entry | | |
| 9 | All | logout | session clear | | |
| 10 | Admin | login old `password123` | reject "รหัสผ่านไม่ถูกต้อง" | | |
| 11 | Random | login `1000` wrong pw 10 times | lockout triggers | | |
| 12 | Random | clear FailedLoginAttempt manually → retry | success | | |

## Part 3 — Code Verification

- [x] `grep -rn "FailedLoginAttempt\|AuditLog" ticket-system/src/` — appears in expected places (auth, audit helper, tickets.ts wrappers)
- [x] `grep "RATE_LIMIT_\|SESSION_TIMEOUT_" ticket-system/.env.example` — 6 vars added
- [x] `npm run build` PASS, 7 routes
- [x] `tsc --noEmit` clean
- [x] No `.env` or secrets in staged files
- [x] All 7 Phase 2A tickets [x] Complete (or [>] DEFERRED with reason for SYN-07 if force-bump broke)

## Sign-off

- [x] AS sign-off
- [x] AM presents to Commander
- [x] Commander accept Phase 2A → permits commit + Vercel deploy

## Boundaries
- Do NOT skip: rate limit test (TC-1.SYN-08.2) — critical for security claim
- Do NOT auto-deploy: Commander accept ก่อน
- Do NOT close ticket: ถ้ามี step FAIL → file follow-up bug

## Notes
- Step 11 (lockout test) destructive — clean up FailedLoginAttempt rows หลัง test
- Step 4 (audit log fail-soft) ทดสอบยากใน manual — accept via code review หรือ unit test fallback
