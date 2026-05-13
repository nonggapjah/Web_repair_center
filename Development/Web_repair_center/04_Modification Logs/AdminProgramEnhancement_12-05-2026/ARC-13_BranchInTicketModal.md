# ARC-13 — Branch Display in Ticket Detail Modal

**Phase:** 2B — Admin Program Enhancement (Modification)
**Team:** Arcade
**Status:** [x] COMPLETE (12-05-2026, executed in main context after subagent failures)
**Complexity:** Simple
**Depends on:** None (data already included)
**Blocks:** None

## Scope

แสดงชื่อสาขาใน admin "จัดการ" modal — ปัจจุบัน modal แสดง Product + Symptom แต่ไม่มีสาขา ทำให้ admin ต้องกลับไปดูจาก list:
1. เพิ่มบรรทัด "สาขา: {selectedTicket.Branch.BranchName}" ใน modal header area (ใต้ Product หรือข้างๆ Symptom)
2. Styling: badge/chip รูปแบบเดียวกับ status (เพื่อ visual hierarchy)
3. Verify `getAllTickets` ปัจจุบัน include Branch relation แล้ว — ถ้าไม่ ให้ Monolith เพิ่ม (แต่คาดว่ามีอยู่แล้วเพราะ filterBranch state ใช้ได้)

## Acceptance Criteria

- [ ] Modal แสดง "สาขา: {BranchName}" ใน header section บนสุดของ ticket details
- [ ] Visual: ใช้ badge component หรือ inline ตามสไตล์ปัจจุบัน — สอดคล้องกับ status badge ที่มีอยู่
- [ ] ถ้า `selectedTicket.Branch?.BranchName` undefined (defensive) → render "ไม่ระบุสาขา" placeholder
- [ ] Branch user เปิด modal ของ ticket ตัวเอง → เห็นสาขาตัวเองด้วย (ไม่ admin-only)
- [ ] ไม่กระทบ filter / search / status update flows ที่มีอยู่
- [ ] UX Smoke Test (AS):
      | Step | Action | Expected | Actual | PASS/FAIL |
      | 1 | กด "จัดการ" จาก ticket | Modal เปิด, "สาขา: VM01" หรือชื่อสาขาจริงปรากฏ | | |
      | 2 | (Edge) Mock ticket Branch undefined | "ไม่ระบุสาขา" placeholder | | |
      | 3 | Branch user เปิด ticket ตัวเอง | สาขาแสดงเช่นกัน | | |

## Boundaries

- Do NOT add branch editing — read-only display
- Do NOT touch Branch model — schema ไม่เปลี่ยน
- Do NOT touch list view branch column (ถ้ามี) — focus เฉพาะ modal
- Do NOT add filter — `filterBranch` state มีอยู่แล้วใน dashboard

## Notes

- Ticket นี้เป็น isolated UI change ไม่ขึ้นกับทีมอื่น → start แรกสุดได้ตอน Mode A dispatch
- Verify `getAllTickets` ใน [tickets.ts](ticket-system/src/app/actions/tickets.ts) include `Branch: { select: { BranchName: true } }` — ถ้าไม่มีต้องเพิ่ม (Monolith อาจต้องช่วย แต่คาดมีอยู่)
- ตำแหน่งใน modal: เสนอใต้ Product (line ~590), ก่อน Symptom — เพราะ "ใคร" (สาขา) มาก่อน "อะไร" (ปัญหา) ใน user mental model
