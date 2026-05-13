# BUG-04 — Admin Modal Right Column Overflows Viewport

**Phase:** 2B-hotfix — Admin Program Enhancement
**Team:** Arcade
**Status:** [x] COMPLETE (13-05-2026)
**Severity:** High (UI usability — bottom buttons clipped/scrolled offscreen)
**Reported by:** Commander ท่านผู้บัญชาการ (13-05-2026, post Phase 2B deploy `00c1344`)
**Depends on:** ARC-11..15 (introduced the new content)
**Blocks:** None

## Symptom

Screenshot from `https://web-repair-center.vercel.app/admin/dashboard` shows the
"จัดการ" (ticket detail) modal's right column extending beyond the viewport. The
"💾 อัปเดตงานแจ้งซ่อม" + "🚫 แจ้งงานผิดประเภท" buttons are pushed below the
visible area on a typical laptop screen.

## Root Cause

`modal-col-left` was already constrained with `maxHeight: '85vh', overflowY: 'auto'`
(present before Phase 2B). `modal-col-right` was NOT constrained — fine pre-2B because
the right column was short (single tech dropdown + date + status grid + note + save
button). Phase 2B (ARC-12/14/15/11) added 4 more sections (JobCategory editor,
conditional Supplier card, multi-tech chip selector, Wrong-Category button) that more
than doubled the right column height — but the missing scroll constraint means the
overflow propagates to the modal wrapper, which then exceeds the viewport.

This is a Phase 2B regression — the new admin features work but the layout breaks on
typical laptop screens.

## Fix

Mirror the `modal-col-left` constraints onto `modal-col-right`:
- `maxHeight: '85vh'`
- `overflowY: 'auto'`
- (optional) reduce padding from `2.5rem` → `2rem` to claw back a bit of vertical density

File: `ticket-system/src/app/admin/dashboard/page.tsx`
Line: modal-col-right opening `<div>` (search for `className="modal-col-right"`)

## Acceptance Criteria

- [ ] Modal fits within viewport on 1280×800 (typical laptop) — both columns scroll independently if content exceeds
- [ ] Mobile breakpoint already overrides via `@media (max-width: 768px)` rules — verify nothing breaks there
- [ ] Print mode (`@media print`) still hides modal-col-right — verify no regression
- [ ] All 5 ARC features still functional (chips clickable, dropdowns reachable, save button visible)

## Boundaries

- Do NOT redesign the modal layout — minimal CSS change
- Do NOT remove any of the new ARC features
- Do NOT touch modal-col-left (already correct)

## Notes

- This is a layout-only hotfix — no schema, server actions, or business logic change
- Regression test: open any ticket on production after deploy, confirm save button visible without scrolling page
