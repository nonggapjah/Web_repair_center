# Modification Log — Admin Program Enhancement

**Created:** 12-05-2026
**Project:** Web_repair_center
**Phase Label:** 2B — Admin Program Enhancement (Modification)
**Mode:** A — AM Direct Orchestration
**Status:** COMPLETE (12-05-2026 — all 9 tickets shipped + MON-13b spinoff filed for follow-up)

---

## 1. Origin

Commander request (12-05-2026):
> ต้องการแก้ไขหน้า โปรแกรมเพิ่มเติม — 7 รายการ

7 items consolidated into 9 tickets across Monolith, Arcade, Syndicate.
Full intake conversation logged in `RoundTable/12-05-2026_RoundTable_Vol1.md` Sessions 1-3.

## 2. Goal

ขยายความสามารถของหน้า `/admin/dashboard` และ admin workflow ให้:
1. รับมือกับงานที่สาขากรอกประเภทผิด (out-of-scope IT work, etc.)
2. แก้ไขหมวดหมู่งานได้ภายหลัง (admin-only)
3. รองรับการมอบหมายช่างหลายคนต่องาน (multi-tech assignment)
4. รองรับงานช่างรับเหมา + ระบุ supplier (24fis, 123, อื่นๆ + free text)
5. แสดงสาขาในหน้ารายละเอียดงาน (popup จาก "จัดการ")

## 3. Scope Summary (7 Items → 9 Tickets)

| Commander Item | Resolved By |
|----------------|-------------|
| 1. ปุ่ม "แจ้งงานผิดประเภท" | MON-11 (status enum), ARC-11 (UI) |
| 2. Admin แก้หมวดหมู่ได้ | MON-11 (JobCategory field), ARC-12 (UI) |
| 3. เพิ่ม "Request" ใน หมวดหมู่ | MON-11 (seed list includes "Request") |
| 4. เพิ่ม "Supplier" ใน หมวดหมู่ | MON-11 (seed list includes "Supplier") |
| 5. ดูสาขาในหน้ารายงาน (popup จัดการ) | ARC-13 |
| 6. ช่างรับเหมา → ระบุ supplier (24fis/123/อื่น) | MON-12 (SupplierName field), ARC-15 (conditional UI) |
| 7. เลือกช่างหลายคน | MON-13 (join table), ARC-14 (multi-select UI) |
| (transverse) Audit accountability | SYN-12 |

## 4. Schema Deltas (Monolith — final)

```
RepairTicket:
  + JobCategory       String?   // predefined list (admin-editable per ticket)
  + SupplierName      String?   // visible only when JobCategory = "ช่างรับเหมา"
  - Technician        String?   // DROP after data migration
  ~ CurrentStatus     String    // existing field, accept new value "WrongCategory"

NEW MODEL TicketTechnician:
  id              String   @id @default(cuid())
  TicketID        String
  Ticket          RepairTicket @relation(...)
  TechnicianName  String
  AssignedAt      DateTime @default(now())
  @@index([TicketID])
  @@index([TechnicianName])
  @@unique([TicketID, TechnicianName])  // no duplicate assignment
```

### JobCategory predefined list (constants file)
```ts
export const JOB_CATEGORIES = [
  "ไฟฟ้า",
  "ประปา",
  "แอร์",
  "ตู้แช่",
  "ช่างรับเหมา",  // triggers SupplierName field
  "Request",
  "Supplier",
  "อื่นๆ"
] as const;
```

### Technicians list (after MON-13 migration — "ทีมช่างรับเหมา" REMOVED)
```ts
export const TECHNICIANS = [
  "ช่างยศ", "ช่างชา", "ช่างต้น", "ช่างปาด",
  "ช่างสกล", "ช่างเขียด", "ช่างประวิท", "ช่างเดี่ยว"
  // "ทีมช่างรับเหมา" removed — now a JobCategory value
];
```

### Status list (frontend constant)
```ts
const statuses = ["Open", "On Process", "Repairing", "Waiting Parts", "Completed", "Closed", "WrongCategory"];
// "WrongCategory" = ไม่ใช่งานช่าง (out of scope, e.g., IT)
```

## 5. Ticket Index

| ID | Title | Team | Complexity | Depends on |
|----|-------|------|------------|------------|
| **MON-11** | JobCategory Field + WrongCategory Status | Monolith | Medium | None |
| **MON-12** | SupplierName Field + Conditional Validation | Monolith | Medium | None |
| **MON-13** | TicketTechnician Join Table + Migration | Monolith | Complex | None |
| **ARC-11** | Wrong Category Status Button | Arcade | Simple | MON-11 (mock-first) |
| **ARC-12** | Inline JobCategory Editor (Modal) | Arcade | Medium | MON-11 (mock-first) |
| **ARC-13** | Branch Display in Ticket Detail Modal | Arcade | Simple | None |
| **ARC-14** | Multi-Technician Selector | Arcade | Medium | MON-13 (mock-first) |
| **ARC-15** | Conditional Supplier Dropdown | Arcade | Medium | MON-12, ARC-12 (mock-first) |
| **SYN-12** | Audit Log Hooks for JobCategory/Supplier/Tech | Syndicate | Simple | MON-11, MON-12, MON-13 |

## 6. ZCB Validation

✅ **PASS** — All teams unblocked at dispatch:
- **Monolith** — MON-11, MON-12, MON-13 all independent foundations (start in parallel)
- **Arcade** — ARC-13 fully independent (start immediately). ARC-11/12/14/15 scaffold UI with **mock-first** (Rule 4), wire live data after Monolith signals via OverseerReport
- **Syndicate** — SYN-12 starts after MON-11/12/13 signal (one-hop max — Rule 6 compliant)

No team blocked on another team's output within phase.

## 7. Test Plan (Verification Scholar — AS)

### Regression (mandatory per Hotfix Regression Gate)
- **R-01:** Ticket with existing `Technician` value migrates intact to `TicketTechnician` (zero data loss)
- **R-02:** Ticket with no JobCategory renders "ไม่ระบุ" placeholder — UI doesn't break
- **R-03:** Existing status workflow (Open→On Process→…→Closed) unaffected
- **R-04:** Branch users still log in with telex passwords (no auth touched)

### Acceptance per Ticket
Each ticket file lists its own acceptance criteria. AS verifies before COMPLETE.

### UX Smoke Test Gate (manual, per user-facing ticket)
ARC-11, ARC-12, ARC-13, ARC-14, ARC-15 require manual UX smoke test by AS before COMPLETE.

### User Journey Walkthrough (before phase complete)
End-to-end scenario chaining all 9 tickets — see Q-J below.

#### Master Q-J Scenario
1. สาขาเปิด ticket ใหม่ Symptom = "งานติดตั้งคอม" Product = "PC"
2. Admin เปิด popup "จัดการ" → เห็น **สาขา** (ARC-13)
3. Admin เห็นว่าไม่ใช่งานช่าง → กดปุ่ม "แจ้งงานผิดประเภท" (ARC-11) → status → WrongCategory (MON-11)
4. สาขาเปิด ticket ที่ 2 Symptom = "แอร์เสีย" — Admin เปิด popup → เปลี่ยน JobCategory เป็น "ช่างรับเหมา" (ARC-12) → Supplier dropdown ปรากฏ (ARC-15) → เลือก "อื่นๆ" → กรอก "AC Pro Service"
5. Admin เลือกช่าง 2 คน (ช่างยศ + ช่างเขียด) (ARC-14) → save → ticket แสดง 2 ช่างใน timeline
6. ทุก action ใน 2-5 บันทึกใน AuditLog (SYN-12) — verify ผ่าน `prisma studio` หรือ admin audit page (Phase 2A)

## 8. Deployment

Single migration step (Vercel auto-deploy on push to `main`):
1. `prisma db push` — adds JobCategory, SupplierName, TicketTechnician
2. Data migration script — populate TicketTechnician from Technician column
3. (After verification) — drop `RepairTicket.Technician` column

**Pattern reuse:** Phase 0.5d 2-phase drop (data migrate first, drop in followup) — but unified into single Mod since project doesn't maintain migration history (per project memory).

## 9. Open Risks

1. **JobCategory backfill for existing tickets** — null safe? Yes (field is `String?`), but UI must handle gracefully
2. **TicketTechnician unique constraint** — verify no existing duplicate-tech tickets before migration
3. **Status "WrongCategory" filter** — should it appear in default filter? AS recommends hide-by-default + dedicated chip

## 10. Acceptance / Phase Closure

- All 9 tickets `[x]` Complete
- Master Q-J Scenario passes
- 4 regression tests pass (R-01..R-04)
- AS sign-off + AM files consolidated OverseerReport
- Commander Phase Acceptance Gate is OFF (per UserProfile) — phase advances on internal sign-off, but AM still presents result

---

*Status flow: PLANNED → (COO Vision Gate approval) → IN PROGRESS → COMPLETE*
