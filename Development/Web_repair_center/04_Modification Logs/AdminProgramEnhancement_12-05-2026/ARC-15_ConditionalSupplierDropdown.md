# ARC-15 — Conditional Supplier Dropdown

**Phase:** 2B — Admin Program Enhancement (Modification)
**Team:** Arcade
**Status:** [x] COMPLETE (12-05-2026, executed in main context after subagent failures)
**Complexity:** Medium
**Depends on:** MON-12, ARC-12 (mock-first per ZCB Rule 4)
**Blocks:** None

## Scope

เพิ่ม Supplier dropdown ที่ปรากฏแบบ conditional — เฉพาะเมื่อ JobCategory = "ช่างรับเหมา":
1. Component `<SupplierDropdown />` ที่ render ใต้ JobCategory editor (ARC-12) เมื่อ JobCategory = "ช่างรับเหมา"
2. Options: `SUPPLIERS = ["24fis", "123", "อื่นๆ"]` (จาก MON-12 constant)
3. เลือก "อื่นๆ" → text input ปรากฏให้กรอกชื่อ supplier custom
4. Save → call `updateTicketSupplier(ticketId, value)` (MON-12 action)
5. Validation: JobCategory = "ช่างรับเหมา" + Supplier ว่าง → save disabled + warning "ต้องระบุ supplier"
6. แสดง SupplierName ใน ticket card (list view) เป็น sub-label ใต้ JobCategory เมื่อมีค่า

## Acceptance Criteria

- [ ] Dropdown ปรากฏ**เฉพาะ**เมื่อ JobCategory = "ช่างรับเหมา" — JobCategory อื่นๆ → ไม่แสดง
- [ ] เปลี่ยน JobCategory จาก "ช่างรับเหมา" → อื่น → dropdown ซ่อน + SupplierName ใน DB **คงไว้** (ไม่ลบ — ตาม ARC-12 spec keep-value-hide-UI)
- [ ] เลือก "อื่นๆ" → text input ปรากฏพร้อม placeholder "ระบุชื่อ supplier"
- [ ] Free text input → POST → SupplierName = "AC Pro Service" (ค่า custom, ไม่ใช่ "อื่นๆ")
- [ ] Save disabled + warning toast เมื่อ category = "ช่างรับเหมา" + supplier ว่าง
- [ ] List view: ticket card แสดง "ช่างรับเหมา → 24fis" เป็น 2 บรรทัด (compact)
- [ ] Mock-first: ใช้ mock `updateTicketSupplier` ก่อน MON-12 complete
- [ ] UX Smoke Test (AS):
      | Step | Action | Expected | Actual | PASS/FAIL |
      | 1 | Admin เปลี่ยน category → "ช่างรับเหมา" | Supplier dropdown ปรากฏ + ค่าเดิม null → placeholder "เลือก supplier" | | |
      | 2 | เลือก "24fis" | Save → ticket update + list view แสดง "ช่างรับเหมา → 24fis" | | |
      | 3 | เลือก "อื่นๆ" | Text input ปรากฏ | | |
      | 4 | กรอก "AC Pro Service" → save | SupplierName = "AC Pro Service" ใน DB | | |
      | 5 | Save โดย supplier ว่าง | Disabled + warning | | |
      | 6 | เปลี่ยน category → "ไฟฟ้า" | Supplier dropdown หาย, ค่าใน DB คงเดิม | | |

## Boundaries

- Do NOT add supplier master CRUD (admin จัดการ list 24fis/123/อื่นๆ ผ่าน UI) — out of scope, list คงที่
- Do NOT touch JobCategory dropdown — ARC-12 scope
- Do NOT validate supplier ที่ server เอง — MON-12 owns validation logic
- Do NOT cascade delete SupplierName เมื่อเปลี่ยน category — keep value, hide UI

## Notes

- Hook pattern: subscribe ต่อ JobCategory state จาก ARC-12 component — เมื่อ value = "ช่างรับเหมา" → mount dropdown
- "อื่นๆ" เป็น special value: เมื่อ select "อื่นๆ" → state ยังเป็น "อื่นๆ" จนกว่ากรอก text — กรอกแล้ว state = text จริง
- Component: เสนอ `<SupplierDropdown category={jobCategory} value={supplierName} onChange={...} />` standalone
- ในอนาคต supplier master จะถูกเพิ่มเป็น separate feature — ใน scope นี้ใช้ predefined list ก่อน
