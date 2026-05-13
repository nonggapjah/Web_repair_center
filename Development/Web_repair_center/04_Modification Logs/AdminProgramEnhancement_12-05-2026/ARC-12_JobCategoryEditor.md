# ARC-12 — Inline JobCategory Editor (Admin Modal)

**Phase:** 2B — Admin Program Enhancement (Modification)
**Team:** Arcade
**Status:** [x] COMPLETE (12-05-2026, executed in main context after subagent failures)
**Complexity:** Medium
**Depends on:** MON-11 (live wire — mock-first per ZCB Rule 4)
**Blocks:** ARC-15 (UI sibling — supplier conditional depends on category editor existing)

## Scope

เพิ่ม inline JobCategory dropdown ใน selectedTicket modal สำหรับ admin แก้ไขหมวดหมู่งานเมื่อสาขากรอกผิด:
1. Dropdown component แสดงค่าจาก `JOB_CATEGORIES` constant (import จาก `src/lib/jobCategories.ts`)
2. ตำแหน่ง: แทนที่บรรทัด `<p>หมวดหมู่: {selectedTicket.Symptom}</p>` ใน modal (line ~591) → เปลี่ยนเป็น "หมวดหมู่: <dropdown editable>" + แสดง Symptom เป็นบรรทัดแยก
3. Admin-only — ถ้า user role != "Admin" → render เป็น read-only text
4. เปลี่ยนค่า → call `updateTicketCategory(ticketId, newCategory)` → optimistic update + refetch
5. แสดง original Symptom (จากสาขา) ใต้ JobCategory เป็น text ดีๆ — เพื่อ admin เห็นว่าสาขากรอกว่าอะไร
6. Toast notification "เปลี่ยนหมวดหมู่เป็น [X] เรียบร้อย" หลัง save success

## Acceptance Criteria

- [ ] Dropdown แสดงค่าทั้ง 8 จาก `JOB_CATEGORIES`: ไฟฟ้า, ประปา, แอร์, ตู้แช่, ช่างรับเหมา, Request, Supplier, อื่นๆ
- [ ] เปลี่ยน → POST → success → ticket state อัปเดต + modal still open (admin ทำงานต่อได้)
- [ ] Failure → toast error + revert dropdown ค่าเดิม + log to console
- [ ] User non-admin → render เป็น `<span>` ไม่ใช่ `<select>`
- [ ] Symptom เดิมยังแสดงให้ admin เห็น (ไม่ถูกทับด้วย JobCategory)
- [ ] Mock-first: dropdown ใช้ mock list ก่อน MON-11 complete
- [ ] UX Smoke Test (AS):
      | Step | Action | Expected | Actual | PASS/FAIL |
      | 1 | Admin เปิด modal | Dropdown ปรากฏ + ค่าปัจจุบัน selected | | |
      | 2 | เปลี่ยนเป็น "ช่างรับเหมา" | Toast success + JobCategory updated (ARC-15 supplier ขึ้น) | | |
      | 3 | เปลี่ยนเป็น "Request" | Toast success | | |
      | 4 | (Edge) Branch user เปิด ticket ของตัวเอง | Dropdown เป็น text read-only | | |
      | 5 | (Edge) JobCategory เดิม null | Dropdown แสดง placeholder "เลือกหมวดหมู่..." | | |

## Boundaries

- Do NOT touch Symptom field — เป็นข้อมูลจากสาขาที่ admin ไม่ควรลบ (เก็บไว้เพื่อ audit trail)
- Do NOT touch SupplierName UI — ARC-15 scope (แต่ต้อง emit event/state เมื่อ JobCategory = "ช่างรับเหมา" เพื่อให้ ARC-15 hook)
- Do NOT touch status — ARC-11 scope
- Do NOT add JobCategory creation UI — รายการ predefined, ไม่ใช่ master CRUD

## Notes

- เมื่อ JobCategory เปลี่ยนเป็น "ช่างรับเหมา" → ARC-15 รับช่วงต่อ render supplier dropdown
- เมื่อ JobCategory เปลี่ยนจาก "ช่างรับเหมา" → อื่นๆ → ควรเตือน admin ว่า SupplierName ที่บันทึกไว้จะถูก clear (หรือ keep แต่ hide UI) — สุดท้ายเลือก: **keep value, hide UI** (ไม่ทำลายข้อมูล)
- Component: เสนอแยกเป็น `<JobCategoryEditor ticket={selectedTicket} onUpdate={...} />` ใน `src/components/`
- ใช้ pattern เดียวกับ technician selector ปัจจุบัน (useState + server action call)
