# Phase 2A — Security Hardening

**Project:** Web_repair_center
**Phase:** 2A (sub-phase of Phase 2 master plan)
**Date:** 11-05-2026
**Authorized by:** Commander ท่านผู้บัญชาการ (Workflow 1 — Sequenced sub-phases)
**Mode:** A — AM Direct Orchestration
**Teams:** Syndicate (lead) + Monolith + Overseer AS

## 1. Context

Phase 2 master plan = ทำทั้ง 4 themes (A Security + B Operations + C UX + D Features) แบบ sequenced sub-phases:
- 2A Security → 2B Operations → 2C UX → 2D Features+Cleanup
- Phase 0.5d cleanup (drop Password column) จะอยู่ใน 2D หลัง observation period 1-2 สัปดาห์

Phase 2A เป็นจุดเริ่ม — ต่อยอด momentum จาก Phase 0.5 security work + เคลียร์ open tech debt

## 2. Goals

1. **TD-002 resolution** — Next.js force-bump เพื่อเคลียร์ 2 vulns ค้าง (or defer ถ้า breaking)
2. **Brute-force protection** — ป้องกัน password guessing บน login (รหัสจริงของ user เป็น telex สั้น vl1000 → guessable)
3. **Session hygiene** — role-based timeout + cookie SameSite hardening
4. **CSRF audit** — verify Next.js Server Actions built-in CSRF + cookie config
5. **Audit log foundation** — record admin actions สำหรับ accountability + future investigation

## 3. Non-Goals

- ❌ Audit log read UI — Phase 2D (Features) จะทำ
- ❌ MFA / 2FA — defer to future phase
- ❌ External rate limiting (Cloudflare/Upstash) — Phase 2B Operations จะพิจารณา
- ❌ Drop plaintext Password column — Phase 2D (after observation)
- ❌ admin/dashboard refactor — Phase 2C UX

## 4. Tickets

| ID | Title | Team | Complexity | Depends |
|----|-------|------|------------|---------|
| SYN-07 | TD-002 Next.js force-bump (fail-fast) | Syndicate | Simple | None |
| MON-10 | Schema: `AuditLog` + `FailedLoginAttempt` tables | Monolith | Simple | None |
| SYN-08 | Brute-force rate limit on login | Syndicate | Medium | MON-10 |
| SYN-09 | Role-based session timeout | Syndicate | Simple | None |
| SYN-10 | CSRF audit + cookie SameSite | Syndicate | Simple | None |
| SYN-11 | Audit logging helper + apply to admin actions | Syndicate | Medium | MON-10 |
| OVS-05 | Phase 2A UX smoke + User Journey | Overseer (AS) | Medium | All above |

## 5. ZCB / Dependencies

```
SYN-07 ──→ (fail-fast)
MON-10 ──→ (independent)
SYN-09 ──→ (independent)
SYN-10 ──→ (independent)
SYN-08 ──→ MON-10 (one-hop)
SYN-11 ──→ MON-10 (one-hop)
OVS-05 ──→ all (one-hop)
```

ZCB: **PASS** — all one-hop dependencies within sub-phase

## 6. Execution Waves

**Wave 1 — Fail-fast (main session):** SYN-07 force-bump
- If breaks build → halt, mark SYN-07 [>] DEFERRED, continue without it
- If passes → continue

**Wave 2 — Parallel (2 subagents):**
- Monolith subagent: MON-10 (schema only, no auth code)
- Syndicate subagent A: SYN-09 + SYN-10 (auth.ts changes that don't need MON-10)

**Wave 3 — Sequential (1 subagent, after Wave 2):**
- Syndicate subagent B: SYN-08 + SYN-11 (need MON-10 schema)
- Same agent does both ทำต่อใน auth.ts + tickets.ts

**Wave 4 — UX (main session):**
- OVS-05 manual UX smoke + Commander User Journey Walkthrough

**Wave 5 — Ship (main session):**
- /git commit + push → Vercel auto-deploy

## 7. Acceptance Criteria (Phase-level)

- [ ] TD-002 resolved or marked DEFERRED with reason
- [ ] DB: `AuditLog` + `FailedLoginAttempt` tables exist
- [ ] Login flow: 10 failed attempts ใน 15 นาที → lockout 15 นาที (configurable)
- [ ] Session timeout: Admin 4hr, Technician 8hr, User 24hr (env-driven override)
- [ ] Cookie: `SameSite=Lax` set (verify in Set-Cookie response header)
- [ ] CSRF Audit doc exists in `08_AuditReport/CSRF_Audit_Phase2A.md`
- [ ] Audit log: ≥3 admin actions wrapped (status update, technician assign, role change)
- [ ] `npm run build` PASS, 7 routes (no change to routes)
- [ ] `tsc --noEmit` clean
- [ ] Branch user 1000/vl1000 + admin login still works
- [ ] Rate limit triggers correctly when tested
- [ ] OVS-05 sign-off + Commander manual UX accept

## 8. Risk Matrix

| Risk | Lik | Imp | Mitigation |
|------|-----|-----|-----------|
| TD-002 force-bump breaks build/runtime | M | H | Wave 1 fail-fast halts immediately |
| Rate limit locks out admin accidentally | L | M | Audit log records failed attempts; admin can reset via direct DB |
| Session timeout invalidates active users | L | L | Only new logins use new timeout; existing cookies until natural expiry |
| Schema change breaks Prisma client | L | H | Prisma generate post-schema-change verified before code merges |
| CSRF tweak breaks legitimate POST | L | H | Test admin/tech ticket actions ก่อน commit |

## 9. Boundaries

- Do NOT touch: branch user passwords, admin password (BUG-03 ใหม่ rotated)
- Do NOT touch: ticket schema, notification system (out of scope)
- Do NOT add: MFA/2FA (defer)
- Do NOT add: audit log READ UI (Phase 2D)
- Do NOT migrate: existing rows for any column change
- Do NOT commit: .env or secrets

## 10. Notes

- Rate limit storage = Prisma table (decision logged in RoundTable Session 3 MT note)
- SameSite=Lax decision (not Strict) — preserves cross-site link UX
- Audit log: write-only Phase 2A; read UI Phase 2D
