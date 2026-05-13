# MON-11 — JobCategory Field + WrongCategory Status

**Phase:** 2B — Admin Program Enhancement (Modification)
**Team:** Monolith
**Status:** [x] COMPLETE (12-05-2026, executed in main context after Monolith subagent API failure)
**Complexity:** Medium
**Depends on:** None
**Blocks:** ARC-11 (live wire), ARC-12 (live wire), SYN-12

## Scope

ขยาย schema ของ `RepairTicket` เพื่อรองรับ JobCategory และ WrongCategory status:
1. เพิ่ม field `JobCategory String?` ใน `RepairTicket` model
2. ขยาย `CurrentStatus` ให้รองรับค่าใหม่ `"WrongCategory"` (ไม่ใช่งานช่าง / out-of-scope)
3. สร้าง constants file `src/lib/jobCategories.ts` ที่ export `JOB_CATEGORIES` array
4. อัปเดต server action `updateTicketStatus` + `updateTicketCategory` (ใหม่) ใน `src/app/actions/tickets.ts` ให้รองรับ JobCategory update + WrongCategory transition
5. รันด้วย `prisma db push` (โปรเจกต์ไม่ใช้ migrate history per memory)

## Acceptance Criteria

- [ ] `prisma/schema.prisma` มี `JobCategory String?` ใน `RepairTicket` พร้อม `@@index([JobCategory])`
- [ ] `src/lib/jobCategories.ts` มี `JOB_CATEGORIES = ["ไฟฟ้า","ประปา","แอร์","ตู้แช่","ช่างรับเหมา","Request","Supplier","อื่นๆ"]` พร้อม TypeScript type export
- [ ] Server action ใหม่ `updateTicketCategory(ticketId, category)` — admin-only (verify role)
- [ ] Server action `updateTicketStatus` ยอมรับ `"WrongCategory"` เป็น valid status value
- [ ] TicketHistory entry สร้างทุกครั้งที่ JobCategory เปลี่ยน + เมื่อ status → WrongCategory (audit trail)
- [ ] Verify: `prisma db push` รันสำเร็จไม่ break ticket เก่า (JobCategory = null)
- [ ] Regression test R-02 (ticket เก่า JobCategory = null render "ไม่ระบุ") writes assertion in `09_TestCase/_regression/`
- [ ] `Current TechStack.md` updated — JobCategory + WrongCategory documented

## Boundaries

- Do NOT touch: `User`, `Branch`, `TicketComment`, `Notification` models
- Do NOT remove existing `Technician String?` field — that's MON-13's scope
- Do NOT touch UI — that's ARC-11/12 scope
- Do NOT add `SupplierName` field — that's MON-12 scope

## Notes

- WrongCategory เป็น terminal status เหมือน Closed — ไม่สามารถ revert จาก WrongCategory กลับมา On Process ได้ (acceptance: ถ้า branch แจ้งใหม่ต้องสร้าง ticket ใหม่)
- JobCategory predefined แต่เก็บเป็น String (ไม่ใช่ enum) เพื่อ flexibility สำหรับ admin ที่อาจเพิ่มหมวดในอนาคต — frontend จำกัดด้วย JOB_CATEGORIES constant
- AuditLog hook (Phase 2A pattern) จะถูกเพิ่มใน SYN-12 — MON-11 แค่เปิด field, ยังไม่เรียก audit helper เอง
