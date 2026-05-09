# Phase 0 — Foundation Reset & Audit Remediation

**Project:** Web_repair_center
**Phase:** 0 (Foundation)
**Date:** 09-05-2026
**Authorized by:** Commander ท่านผู้บัญชาการ
**Owning Team:** Overseer (lead) + Monolith (docs/scan)

---

## 1. Context

โปรเจกต์ Web_repair_center มี source code production-ready อยู่ใน `ticket-system/` ก่อนการ install RoundTable Framework (commit `f38d42b install UniPOS and claude code`) ทำให้เกิด:
- **No-Code-Before-Ticket Backlog** — feature ทั้งหมดไม่มี ticket รองรับ
- **Missing PreExisting TechStack** — ไม่มี L1/L2 scan ตาม §5
- **Multiple compliance gaps** ในไฟล์โครงสร้าง

Commander ตัดสินแนวทาง **(B) Reset Baseline** — ประกาศ codebase ปัจจุบันเป็น "PreExisting Codebase" และเริ่มกฎ ticket workflow ตั้งแต่งานถัดไป

## 2. Goals

1. ทำให้โปรเจกต์ compliance ครบตามมาตรฐาน RoundTable Framework
2. เอกสาร codebase ที่มีอยู่ผ่าน L1 PreExisting TechStack scan
3. แก้ไข metadata/config files ที่ผิด
4. รักษาเว็บให้ทำงานได้ปกติตลอดกระบวนการ — Phase 0 จะไม่แตะ source code เลย
5. ตั้ง baseline สำหรับ Phase 0.5 (Security) ที่จะทำต่อ

## 3. Non-Goals

- **ไม่แก้ source code ของ ticket-system/ ใน Phase 0** — Phase 0 เป็น docs/config เท่านั้น
- **ไม่ migrate database** — Phase 0.5 จะรับผิดชอบ
- **ไม่เปลี่ยน feature** — รักษาพฤติกรรมเว็บเดิม

## 4. Tickets

| ID | Title | Team | Complexity | Touches Code? |
|----|-------|------|------------|---------------|
| OVS-01 | ProjectEnvironment.md typo fix (KP→AM, footer) | Overseer | Simple | No |
| OVS-02 | Hook prompt scope fix (settings.json line 49) | Overseer | Simple | No |
| MON-01 | L1 PreExisting TechStack scan + document | Monolith | Medium | No (read-only) |
| MON-02 | Update root README.md with project description | Monolith | Simple | No |
| MON-03 | Create ticket-system/.env.example | Monolith | Simple | No (new file only) |
| MON-04 | Create ErrorCatalog.md baseline | Monolith | Simple | No |

**ZCB Status:** PASS — ทุก ticket independent ไม่มีรอใครๆ

## 5. Phase 0.5 — Security (Separate Phase)

หลัง Phase 0 จบ จะเข้า Phase 0.5 ซึ่งเป็น critical security work:

| ID (planned) | Title | Team | Complexity | Touches Code? |
|--------------|-------|------|------------|---------------|
| SYN-01 | Plan password hashing migration strategy | Syndicate | Medium | No (planning only) |
| MON-05 | Prisma schema: add PasswordHash field, deprecate plaintext | Monolith | Medium | Yes (schema + migration) |
| SYN-02 | Implement bcrypt hashing in auth.ts | Syndicate | Medium | Yes (auth flow) |
| SYN-03 | Migrate existing user passwords to hash format | Syndicate | Complex | Yes (data migration) |
| OVS-03 | UX smoke test — login still works after migration | Overseer (AS) | Medium | No (testing) |

Phase 0.5 จะถูก plan ละเอียดอีกครั้งใน `Phase0.5_SecurityMigration.md` ก่อนแตะ code

## 6. Acceptance Criteria

- [x] Development/Web_repair_center/ canonical structure created
- [ ] All Phase 0 tickets ([x] Complete)
- [ ] PreExisting TechStack/Web_repair_center.md exists with L1 data
- [ ] ProjectEnvironment.md compliant
- [ ] Hook prompt in settings.json fixed
- [ ] No source code in ticket-system/ modified during Phase 0
- [ ] Manual verification: `npm run build` ใน ticket-system ยังสำเร็จ (Phase 0 closeout check)

## 7. Boundaries — Do NOT Touch

- **ticket-system/src/** — source code ห้ามแตะ
- **ticket-system/prisma/schema.prisma** — Phase 0.5 จะดูแล (แต่ Phase 0 อย่ายุ่ง)
- **Database** — ห้าม migrate
- **Existing git commits** — ห้าม rebase/rewrite history

## 8. Notes

- Phase 0 ทำใน Mode A — AM ประสานงาน, สรุปผลให้ Commander หลังแต่ละ ticket
- ไม่มี subagent spawn สำหรับ Phase 0 เพราะแต่ละ ticket simple/medium ทำได้ใน main session
- Tone: Expressive (Commander preference) — emojis OK ใน reports
