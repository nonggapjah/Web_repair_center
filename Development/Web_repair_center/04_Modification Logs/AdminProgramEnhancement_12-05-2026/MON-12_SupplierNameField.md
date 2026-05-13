# MON-12 — SupplierName Field + Conditional Validation

**Phase:** 2B — Admin Program Enhancement (Modification)
**Team:** Monolith
**Status:** [x] COMPLETE (12-05-2026, executed in main context after Monolith subagent API failure)
**Complexity:** Medium
**Depends on:** None (independent schema)
**Blocks:** ARC-15 (live wire), SYN-12

## Scope

เพิ่ม field `SupplierName` ใน `RepairTicket` พร้อม validation rule ที่ผูกกับ JobCategory:
1. เพิ่ม `SupplierName String?` ใน `RepairTicket` model
2. สร้าง constants file `src/lib/suppliers.ts` ที่ export `SUPPLIERS` array
3. Server-side validation: ถ้า `JobCategory == "ช่างรับเหมา"` → `SupplierName` ต้องไม่เป็น `null` หรือ empty (reject mutation พร้อม error message)
4. Server action `updateTicketSupplier(ticketId, supplierName)` — admin-only
5. รันด้วย `prisma db push`

## Acceptance Criteria

- [ ] `prisma/schema.prisma` มี `SupplierName String?` ใน `RepairTicket` พร้อม `@@index([SupplierName])`
- [ ] `src/lib/suppliers.ts` มี `SUPPLIERS = ["24fis", "123", "อื่นๆ"]` พร้อม TypeScript type
- [ ] Validation function `validateTicketUpdate(input)` ใน `src/lib/validators/ticket.ts` — return error code `-2401` ถ้า JobCategory="ช่างรับเหมา" + SupplierName ว่าง
- [ ] Server action `updateTicketSupplier(ticketId, supplierName)` ใช้ getTicket + verify role + AuditLog hook (ผ่าน SYN-12 helper)
- [ ] State Transparency Rule: ถ้า skip validation (เช่น category ไม่ใช่ "ช่างรับเหมา") log `[SKIP] supplier validation: category != ช่างรับเหมา`
- [ ] Regression test: ticket เก่าที่ JobCategory = null → SupplierName = null → ไม่ break
- [ ] Error -2401 เพิ่มลง `Development/Web_repair_center/ErrorCatalog.md`

## Boundaries

- Do NOT enforce SupplierName ใน column-level constraint (Prisma `@db.Check`) — เก็บ validation ที่ application layer เพื่อ flexibility
- Do NOT touch UI — ARC-15 scope
- Do NOT define JobCategory list — MON-11 owns นั้น (อ่านจาก MON-11's constants)
- Do NOT add `SupplierMaster` table — Commander confirmed predefined list ก็พอ (24fis, 123, อื่นๆ + free text)

## Notes

- "อื่นๆ" ใน SUPPLIERS เป็น special value — frontend ARC-15 จะ render text input เมื่อเลือก "อื่นๆ" + เก็บค่า free-text ใน SupplierName เลย (ไม่ต้อง store "อื่นๆ" separately)
- หมายความว่า SupplierName ใน DB อาจเป็น "24fis", "123", หรือชื่อ custom เช่น "AC Pro Service" — ไม่ใช่ "อื่นๆ" ตามตัวอักษร
- ใช้ Error Catalog range `-2xxx` (data) ตาม CLAUDE.md §4
