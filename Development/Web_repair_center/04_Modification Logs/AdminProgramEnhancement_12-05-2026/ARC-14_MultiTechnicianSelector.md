# ARC-14 — Multi-Technician Selector

**Phase:** 2B — Admin Program Enhancement (Modification)
**Team:** Arcade
**Status:** [x] COMPLETE (12-05-2026, executed in main context after subagent failures)
**Complexity:** Medium
**Depends on:** MON-13 (live wire — mock-first per ZCB Rule 4)
**Blocks:** None

## Scope

เปลี่ยน single-select Technician dropdown → multi-select component สำหรับมอบหมายช่างหลายคนต่อ ticket:
1. Replace `<select>` + `selectedTech` state ใน modal → multi-select component (checkbox list หรือ tag input)
2. ใช้ data จาก `TICHNICIANS` constant ใน `src/lib/technicians.ts` (สร้างใน MON-13 — "ทีมช่างรับเหมา" REMOVED)
3. State `selectedTechs: string[]` แทน `selectedTech: string`
4. Save → call `assignTechnicians(ticketId, selectedTechs)` (server action จาก MON-13)
5. แสดงรายชื่อช่าง assigned ใน ticket card (list view) + modal header
6. Timeline log entry สำหรับ assign/remove ช่างคนใดคนหนึ่ง

## Acceptance Criteria

- [ ] Component: tag-input หรือ checkbox-grid — เลือกได้หลายคน, deselect ได้
- [ ] Modal: แสดง assigned techs เป็น chips ที่มี "×" ลบได้ทันที (optimistic update)
- [ ] List view: ticket card แสดง "ช่าง: ช่างยศ, ช่างเขียด" (truncate ถ้า > 3 คน)
- [ ] Save → server action → success → ticket state อัปเดตทันที (ไม่ต้อง refresh)
- [ ] "ทีมช่างรับเหมา" ไม่อยู่ใน list (เป็น JobCategory แล้ว ไม่ใช่ technician)
- [ ] Mock-first: ใช้ mock `assignTechnicians` ก่อน MON-13 complete
- [ ] UX Smoke Test (AS):
      | Step | Action | Expected | Actual | PASS/FAIL |
      | 1 | Admin เปิด modal | Multi-select แสดง techs ปัจจุบัน (1 คน จาก legacy) | | |
      | 2 | เลือกเพิ่มช่างที่ 2 | Save → chips 2 ใบใน modal + list view | | |
      | 3 | กด × ที่ chip | ช่างคนนั้นถูก remove → log entry ใน timeline | | |
      | 4 | (Edge) Save 0 ช่าง | Acceptable — ticket แสดง "ไม่มีช่างมอบหมาย" | | |
      | 5 | (Edge) Ticket เก่าที่มีช่างเดียวจาก migration | แสดง 1 chip + เลือกเพิ่มได้ | | |

## Boundaries

- Do NOT remove `Technician` field reference ใน UI ทันที — ต้อง wait MON-13 confirm drop column (graceful)
- Do NOT touch JobCategory — ARC-12 scope
- Do NOT add tech CRUD (เพิ่ม/ลบช่างจาก master list) — out of scope
- Do NOT change list view filter `filterTechnician` semantics — ยังคงทำงาน (filter ตามชื่อช่างคนใดคนหนึ่ง)

## Notes

- Component: เสนอ `<TechMultiSelect value={...} onChange={...} options={TECHNICIANS} />` แยกเป็น standalone
- Pattern: tag-input ดีกว่า checkbox-grid สำหรับ 8 options (compact + scan ง่าย)
- ใช้ optimistic update — กด chip × → ลบทันที, rollback ถ้า server fail
- `filterTechnician` ปัจจุบันใช้ exact match — หลัง MON-13 ต้องเป็น "contains in TicketTechnician relation"
- Timeline format: "Admin มอบหมาย ช่างยศ" / "Admin ปลดช่างเขียด"
