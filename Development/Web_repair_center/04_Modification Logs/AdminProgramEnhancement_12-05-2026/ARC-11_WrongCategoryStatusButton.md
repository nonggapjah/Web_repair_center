# ARC-11 — Wrong Category Status Button

**Phase:** 2B — Admin Program Enhancement (Modification)
**Team:** Arcade
**Status:** [x] COMPLETE (12-05-2026, executed in main context after subagent failures)
**Complexity:** Simple
**Depends on:** MON-11 (live wire — mock-first per ZCB Rule 4)
**Blocks:** None

## Scope

เพิ่มปุ่ม "แจ้งงานผิดประเภท" ใน admin "จัดการ" modal สำหรับ mark ticket ว่าไม่ใช่งานช่าง (IT, etc.):
1. ปุ่ม "แจ้งงานผิดประเภท" (สีแดง/orange) ใน selectedTicket modal — admin only
2. กดแล้ว popup confirm: "งานนี้ไม่ใช่งานช่าง — งานจะถูกปิดและแจ้งสาขา ใช่หรือไม่?"
3. Confirm → call `updateTicketStatus(ticketId, "WrongCategory", note?)` — note optional reason
4. เพิ่ม `"WrongCategory"` ใน frontend `statuses` array + `translateStatus` + `statusColor` mappings
5. เพิ่ม filter chip "แจ้งงานผิดประเภท" (color: #94a3b8 หรือ grey-purple)
6. ใน list/overview view, WrongCategory tickets ซ่อนจาก default filter — แสดงเมื่อกด chip นั้นเท่านั้น

## Acceptance Criteria

- [ ] ปุ่ม "แจ้งงานผิดประเภท" ปรากฏใน selectedTicket modal เฉพาะเมื่อ status != "WrongCategory" และ != "Closed"
- [ ] กดปุ่ม → confirm modal → confirm → status เปลี่ยน → modal ปิด + ticket หายจาก default list (filtered out)
- [ ] `translateStatus("WrongCategory")` returns "แจ้งงานผิดประเภท" / "ไม่ใช่งานช่าง"
- [ ] `statusColor("WrongCategory")` returns sensible color (เสนอ: `#94a3b8` slate-grey)
- [ ] Filter chip "ไม่ใช่งานช่าง" ทำงาน — เมื่อ active แสดงเฉพาะ WrongCategory tickets
- [ ] Mock-first: ใช้ mock `updateTicketStatus` ก่อน MON-11 complete แล้วสลับเป็น live เมื่อ Monolith signal
- [ ] UX Smoke Test (AS):
      | Step | Action | Expected | Actual | PASS/FAIL |
      | 1 | กด "จัดการ" จาก ticket ใดๆ | Modal เปิด, ปุ่ม "แจ้งงานผิดประเภท" ปรากฏ | | |
      | 2 | กดปุ่ม | Confirm modal ปรากฏ | | |
      | 3 | Confirm | Status → WrongCategory, ticket หายจาก list | | |
      | 4 | Toggle filter chip | Ticket นั้นกลับมาแสดง | | |
      | 5 | (Edge) เปิด ticket ที่ status = Closed | ปุ่มไม่ปรากฏ | | |

## Boundaries

- Do NOT touch schema — MON-11 owns
- Do NOT add backend validation — MON-11 owns server-side rule
- Do NOT touch JobCategory editor — ARC-12 scope
- Do NOT remove "Closed" status option — เป็นคนละ semantic (Closed = ทำเสร็จแล้ว, WrongCategory = ไม่ใช่งานนี้)

## Notes

- WrongCategory เป็น terminal — ไม่มี revert button (ตาม MON-11 spec). ถ้าสาขาแจ้งใหม่ต้องสร้าง ticket ใหม่
- ตำแหน่งปุ่ม: ใน modal action section ใกล้กับปุ่ม status update existing — ใช้ secondary style เพื่อไม่แข่งกับ primary action
- เสนอ icon: 🚫 หรือ ⚠️ ใน button label (per Tone: Expressive)
