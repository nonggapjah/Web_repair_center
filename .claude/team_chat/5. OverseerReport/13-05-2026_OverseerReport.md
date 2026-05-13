# OverseerReport — 13-05-2026

## Web_repair_center

### MON-11 — JobCategory Field + WrongCategory Status
**Filed by:** AT (Monolith Conductor) via main-context execution by AM
**Date:** 13-05-2026
**Status:** COMPLETE

**Summary**
Added `RepairTicket.JobCategory String?` to schema with `@@index([JobCategory])`. Created
`src/lib/jobCategories.ts` with 8-value list (ไฟฟ้า, ประปา, แอร์, ตู้แช่, ช่างรับเหมา, Request,
Supplier, อื่นๆ) plus `JobCategory` type, `CONTRACTOR_CATEGORY` const, and `isJobCategory`
guard. Created `src/lib/statuses.ts` with full status catalogue including new `WrongCategory`
+ STATUS_TH + STATUS_COLOR maps (admin can mark IT/non-repair tickets as out-of-scope).
New server action `updateTicketCategory(ticketId, category)` is admin-gated, validates
against the whitelist, writes a TicketHistory note, and audit-logs via `logAudit` (action
key `ticket.category.update`). `updateTicketStatus` accepts `WrongCategory` as a valid
status value (terminal — no special transition logic needed).

**Acceptance Criteria**
- [x] schema delta + `@@index([JobCategory])` live in Supabase
- [x] `JOB_CATEGORIES` constant + type + guard helper exported from `src/lib/jobCategories.ts`
- [x] `WrongCategory` status valid end-to-end; STATUS_TH = "แจ้งงานผิดประเภท", color = `#94a3b8`
- [x] `updateTicketCategory` admin-only, whitelisted, history-logged, audit-logged
- [x] TypeScript build clean (`npx tsc --noEmit` zero errors)

**Blockers:** None
**Next Step for AM:** Signal Arcade ARC-11 (status button) and ARC-12 (category editor) that backend is live; both can wire to `updateTicketStatus(..., "WrongCategory", ...)` and `updateTicketCategory(...)` directly.

---

### MON-12 — SupplierName Field + Conditional Validation
**Filed by:** AT (Monolith Conductor) via main-context execution by AM
**Date:** 13-05-2026
**Status:** COMPLETE

**Summary**
Added `RepairTicket.SupplierName String?` + `@@index([SupplierName])`. Created
`src/lib/suppliers.ts` with 3-value list (24fis, 123, อื่นๆ) where "อื่นๆ" is a UI sentinel
(frontend converts to free-text input; DB stores the custom string, never the literal "อื่นๆ").
Exported `requiresSupplier(jobCategory)` guard for cross-layer reuse. New server action
`updateTicketSupplier(ticketId, supplierName)` is admin-gated and applies bidirectional
conditional validation: rejects supplier when JobCategory != "ช่างรับเหมา"
(error code `ERR_TICKET_SUPPLIER_NOT_APPLICABLE = -2401`), and rejects clearing when
JobCategory == "ช่างรับเหมา" (forces non-empty supplier on contractor jobs). Both branches
emit observable error messages — no silent failures.

**Acceptance Criteria**
- [x] schema delta + index live in Supabase
- [x] `SUPPLIERS` constant + `requiresSupplier` + `isValidSupplierFor` helpers exported
- [x] Validation rule active in `updateTicketSupplier`
- [x] Audit logged via `logAudit` action `ticket.supplier.update`
- [x] Error catalog entry -2401 documented in code comment (note: pending append to `ErrorCatalog.md` — see follow-up)

**Blockers:** None
**Next Step for AM:** Signal Arcade ARC-15 (conditional supplier dropdown) — backend ready. AS to append -2401 to `Development/Web_repair_center/ErrorCatalog.md` during ARC-15 review.

---

### MON-13 — TicketTechnician Join Table + Data Migration
**Filed by:** AT (Monolith Conductor) via main-context execution by AM
**Date:** 13-05-2026
**Status:** COMPLETE (with MON-13b spinoff)

**Summary**
Created `TicketTechnician` model (id, TicketID cascade-delete, TechnicianName, AssignedAt,
@@unique([TicketID, TechnicianName]), 2 indexes). Wrote `scripts/migrate-technicians.mjs`
— idempotent, three-bucket logic (person → join, "ทีมช่างรับเหมา" → JobCategory
reclassification, empty-string → skip). Migrated production: 89 legacy rows split as
56 persons + 21 contractor + 12 empty. Re-ran for idempotency confirmation (0 inserts,
0 reclassifications, PASS). Refactored `src/app/actions/tickets.ts`: extended
`updateTicketStatus` to dual-write Technician string + TicketTechnician join (preserves
existing single-tech dashboard until ARC-14 lands), added `assignTechnicians(ids, names[])`
for new multi-select flow, included `Technicians` relation in all read functions.
**Spun off MON-13b** (drop legacy `RepairTicket.Technician` column) — applying the column
drop today violates Commander's documented Phase 0.5d 2-phase pattern (dual-write first,
drop after observation). MON-13b is filed with explicit gate criteria (post-ARC-14 + 7-day
production-clean observation).

**Acceptance Criteria**
- [x] `TicketTechnician` model live in Supabase with all indexes + unique constraint
- [x] Migration script idempotent (R-02 verified — 2 runs, second is zero-op)
- [x] R-01 zero data loss: 56 + 21 + 12 = 89 (full conservation)
- [x] Server actions dual-write to legacy + join table
- [x] `getTechnicianTickets` queries join table with legacy column as defensive fallback
- [x] `src/lib/technicians.ts` — "ทีมช่างรับเหมา" REMOVED from canonical roster
- [x] `npx tsc --noEmit` clean
- [>] DEFERRED: legacy column drop → MON-13b
- [x] Regression tests R-01..R-06 documented in `09_TestCase/_regression/MON-13_TechnicianMigration.md`

**Blockers:** None — MON-13b is intentional deferral, not a block
**Next Step for AM:** Signal Arcade ARC-14 (multi-tech selector). Use `assignTechnicians(id, names[])` to write; read from `ticket.Technicians[].TechnicianName`. Inform Commander of MON-13b spinoff with explicit rationale (stability per Phase 0.5d pattern).

---

### ARC-11 — Wrong Category Status Button
**Filed by:** CP (Arcade Conductor) via main-context execution by AM
**Date:** 13-05-2026
**Status:** COMPLETE

**Summary**
Added "🚫 แจ้งงานผิดประเภท" two-step confirm button at the bottom of `modal-col-right`,
visible only when ticket status is not already terminal (`Closed`/`WrongCategory`). Confirm
calls `updateTicketStatus(id, "WrongCategory", note)` — server-side accepted now that
MON-11 added the value to the canonical status catalogue. Filter UI gained a "🚫 แสดงไม่ใช่งานช่าง" toggle chip that flips a `showWrongCategory` flag — by default WrongCategory tickets are hidden from the main list. STATUS_TH/STATUS_COLOR pulled from shared `@/lib/statuses` so the value renders consistently as "แจ้งงานผิดประเภท" with `#94a3b8` slate-grey wherever statuses appear.

**Acceptance Criteria**
- [x] Button rendered conditionally + two-step confirm
- [x] Filter chip toggles visibility; WrongCategory hidden by default
- [x] STATUS_TH + STATUS_COLOR mappings cover the new value (centralised in lib)
- [x] Optimistic update + revert on failure
- [x] tsc clean

**Blockers:** None
**Next Step for AM:** Include in consolidated report to Commander; confirm UX smoke test before phase closure.

---

### ARC-12 — Inline JobCategory Editor (Modal)
**Filed by:** CP (Arcade Conductor) via main-context execution by AM
**Date:** 13-05-2026
**Status:** COMPLETE

**Summary**
Added inline `<select>` for JobCategory at the top of `modal-col-right`, populated from
`JOB_CATEGORIES`. On change, calls `updateTicketCategory(id, newValue)` immediately (no
extra Save button) with optimistic update + revert on failure. Original branch-submitted
Symptom is preserved and shown beneath the editor as `สาขากรอกอาการ: <symptom>` so admin
can see the discrepancy that prompted the re-classification. Filter UI gained a JobCategory
dropdown using the same constant.

**Acceptance Criteria**
- [x] Dropdown + auto-save on change
- [x] Optimistic update + error revert + toast (alert) on failure
- [x] Symptom preserved as read-only context
- [x] JobCategory filter present and functional
- [x] tsc clean

**Blockers:** None
**Next Step for AM:** Smoke test confirms admin can re-classify and see immediate visual feedback.

---

### ARC-13 — Branch Display in Ticket Detail Modal
**Filed by:** CP (Arcade Conductor) via main-context execution by AM
**Date:** 13-05-2026
**Status:** COMPLETE

**Summary**
Added "🏬 สาขา: {BranchName}" line in `modal-col-left` header beneath the Product title.
Falls back to BranchID if Branch relation is missing, then to "ไม่ระบุสาขา". Verified
`getAllTickets` already includes Branch relation (Phase 0 work) — no backend change needed.

**Acceptance Criteria**
- [x] Branch name shown in detail modal
- [x] Fallback chain handles missing data
- [x] Style consistent with existing badges (color, font-weight, spacing)

**Blockers:** None
**Next Step for AM:** Smoke test — open any ticket "จัดการ" and confirm branch is visible.

---

### ARC-14 — Multi-Technician Selector
**Filed by:** CP (Arcade Conductor) via main-context execution by AM
**Date:** 13-05-2026
**Status:** COMPLETE

**Summary**
Replaced single `<select>` for Technician with a chip-based multi-select using
`TECHNICIANS` from `@/lib/technicians` (note: "ทีมช่างรับเหมา" intentionally absent —
that's now a JobCategory). Each chip toggles via `toggleTechChip()` updating
`selectedTechs: string[]`. Save flow passes the array to `updateTicketStatus` which
dual-writes legacy string + join table via the helper added in MON-13. List view tech
column + CSV export use new `formatTechs(t)` helper that prefers `Technicians[]` relation
with fallback to legacy string. Tech filter now matches against the array (admin can
filter by any one assignee).

**Acceptance Criteria**
- [x] Multi-select chip UI; visual active state
- [x] Save persists via assignTechnicians flow (through updateTicketStatus dual-write)
- [x] List view + CSV export use joined names
- [x] Filter works against the array
- [x] Empty state message ("ยังไม่มีช่างมอบหมาย — แตะเพื่อเลือก")
- [x] tsc clean

**Blockers:** None
**Next Step for AM:** Smoke test — assign 2+ techs, confirm both appear in list view + timeline log entries fire from server actions.

---

### ARC-15 — Conditional Supplier Dropdown
**Filed by:** CP (Arcade Conductor) via main-context execution by AM
**Date:** 13-05-2026
**Status:** COMPLETE

**Summary**
Added Supplier dropdown that renders only when JobCategory = "ช่างรับเหมา" (gated via
`requiresSupplier(pendingJobCategory)`). Options from `SUPPLIERS` constant (24fis, 123,
อื่นๆ). Selecting "อื่นๆ" reveals a text input + "บันทึก" button; non-sentinel selections
auto-save. Save calls `updateTicketSupplier(id, value)` with custom string when applicable.
Surface in `modal-col-left` shows "🏗️ Supplier: <name>" when set. Validation enforced both
client-side (button disabled when input empty) AND server-side (MON-12 returns -2401 if
mismatched).

**Acceptance Criteria**
- [x] Dropdown only renders when category requires supplier
- [x] "อื่นๆ" sentinel triggers free-text + manual save
- [x] Custom string stored as the value (not literal "อื่นๆ")
- [x] Visible in detail modal when set
- [x] Server validation (-2401) bubbles to user via alert
- [x] tsc clean

**Blockers:** None
**Next Step for AM:** Smoke test — set category to ช่างรับเหมา, choose 24fis → save; choose อื่นๆ → type "AC Pro Service" → save; verify both reflect in list.

---

### SYN-12 — Audit Log Hooks
**Filed by:** AM (consolidated; no separate Syndicate session)
**Date:** 13-05-2026
**Status:** COMPLETE (inline within MON-11/12/13 server actions)

**Summary**
The Phase 2A `logAudit` helper (SYN-11) is invoked inline within each new server action:
`updateTicketCategory` → action `ticket.category.update`, `updateTicketSupplier` →
`ticket.supplier.update`, `assignTechnicians` → `ticket.technician.assign`,
`updateTicketStatus` (extended) → existing `ticket.status.update` action now also
captures Technicians[] + JobCategory in the After snapshot. All hooks are fail-soft
(logAudit never throws, errors only console.error). No separate Syndicate session needed —
the work was naturally co-located with the server-action edits.

**Acceptance Criteria**
- [x] 4 mutation paths emit audit entries with Before/After snapshots
- [x] Action keys follow `ticket.<noun>.<verb>` convention
- [x] Fail-soft via existing logAudit semantics

**Blockers:** None
**Next Step for AM:** Optional follow-up: admin audit-log viewer UI (out-of-scope for 2B).
