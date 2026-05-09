# MON-04 — Create ErrorCatalog.md baseline

**Phase:** 0
**Team:** Monolith
**Status:** [x] Complete
**Complexity:** Simple
**Depends on:** None
**Blocks:** None

## Scope
สร้าง `Development/Web_repair_center/ErrorCatalog.md` baseline ตาม §4 — โครง catalog พร้อม prefix ranges แต่ยังไม่ต้องเติม code จริงทุกตัว เป็น living document ที่จะเพิ่มเรื่อยๆ

## Acceptance Criteria
- [x] ไฟล์ `Development/Web_repair_center/ErrorCatalog.md` exists
- [x] Section: Prefix Range Conventions (-1xxx auth, -2xxx data, -3xxx network, -4xxx UI, -5xxx system)
- [x] Naming pattern: `ERR_SUBSYSTEM_DESC` documented
- [x] Empty starter tables for each range (ready to fill)
- [x] Note: Living document — devs ต้องเพิ่ม entry ทุกครั้งที่เพิ่ม error code

## Boundaries
- Do NOT define: error codes ใน source code (Phase 0 เป็นแค่ catalog skeleton)
- Do NOT modify: any source code

## Notes
Phase ถัดไปจะเริ่มทยอย populate codes ตามที่ใช้จริง (อาจจะตอนทำ password security migration จะมี ERR_AUTH_*)
