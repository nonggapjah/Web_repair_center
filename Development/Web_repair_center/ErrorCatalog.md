# ErrorCatalog — Web_repair_center

**Maintained by:** Monolith (AT/SC/EN/PF)
**Last reviewed:** 09-05-2026
**Status:** Living document — เพิ่ม entry ทุกครั้งที่เพิ่ม error code ใน source code

---

## Conventions

### Naming Pattern
```
ERR_<SUBSYSTEM>_<DESCRIPTION>
```
- `<SUBSYSTEM>` — UPPER_SNAKE_CASE ของ subsystem (AUTH, TICKET, NOTIF, LIFF, IMAGE, DB, ฯลฯ)
- `<DESCRIPTION>` — UPPER_SNAKE_CASE สั้นๆ บอกสาเหตุ
- ตัวอย่าง: `ERR_AUTH_INVALID_CREDENTIALS`, `ERR_TICKET_NOT_FOUND`, `ERR_NOTIF_LINE_TOKEN_MISSING`

### Code Range Allocation (negative integers)

| Range | Subsystem | Description |
|-------|-----------|-------------|
| `-1xxx` | **Auth** | Login, session, authorization, role-based access |
| `-2xxx` | **Data** | Database, Prisma, schema validation, ORM errors |
| `-3xxx` | **Network** | HTTP, fetch, external API (LINE, Supabase Storage), webhook |
| `-4xxx` | **UI** | Frontend validation, render errors, client-side state |
| `-5xxx` | **System** | Runtime, env config, file I/O, process-level |

### Rules
1. ทุก code = **integer ลบ** (เช่น `-1001`)
2. **ห้าม reuse** code ที่เคยใช้ — แม้จะลบ entry ออก code นั้น "burned" แล้ว
3. ทุกครั้งที่ throw/return error → ใช้ code จาก catalog นี้ ไม่งั้นต้องเพิ่ม entry ก่อน
4. Error message ต้องมี:
   - Code (integer)
   - Constant name (`ERR_*`)
   - User-facing message (Thai/English)
   - Developer note (cause + remediation)
5. **Silent failure ห้ามเด็ดขาด** ตาม §2 — ทุก error path ต้อง emit code

---

## -1xxx — Auth

| Code | Constant | User Message (TH) | Cause | Remediation |
|------|----------|-------------------|-------|-------------|
| _(none yet — see Phase 0.5 to add ERR_AUTH_*)_ | | | | |

**Reserved for Phase 0.5:**
- `ERR_AUTH_USER_NOT_FOUND` — username ไม่มีใน DB
- `ERR_AUTH_INVALID_CREDENTIALS` — password ผิด
- `ERR_AUTH_HASH_MISMATCH` — password hash compare failed (post-migration)
- `ERR_AUTH_LEGACY_PLAINTEXT` — เจอ plaintext password (during migration window)
- `ERR_AUTH_SESSION_EXPIRED` — cookie หมดอายุ
- `ERR_AUTH_ROLE_FORBIDDEN` — user role ไม่มีสิทธิ

---

## -2xxx — Data (Database / Prisma)

| Code | Constant | User Message (TH) | Cause | Remediation |
|------|----------|-------------------|-------|-------------|
| `-2001` | `ERR_TICKET_NO_USER_FOR_BRANCH` | "ไม่พบผู้ใช้งานของสาขานี้ในระบบ กรุณาติดต่อแอดมิน" | `createTicket()` ไม่พบ User row (Role='User') สำหรับ `branchId` ที่ส่งมา ก่อนหน้านี้ระบบสร้าง User เงียบๆ ด้วย username = `staff_<branchId>` (no password) → security risk + silent state corruption | ใช้ `seed_production.mjs` provision User row ทุกสาขาก่อน rerun seed ถ้ามี branch ใหม่เพิ่ม **ห้าม** auto-create User ใน server action |

**Examples for future use:**
- `ERR_DATA_TICKET_NOT_FOUND` — ticketId ไม่มีใน DB
- `ERR_DATA_BRANCH_NOT_FOUND` — branchId ไม่มีใน DB
- `ERR_DATA_DUPLICATE_USERNAME` — สร้าง user ที่ username ซ้ำ
- `ERR_DATA_FK_VIOLATION` — foreign key constraint failed
- `ERR_DATA_CONNECTION_FAILED` — DATABASE_URL ใช้ไม่ได้

---

## -3xxx — Network (External APIs)

| Code | Constant | User Message (TH) | Cause | Remediation |
|------|----------|-------------------|-------|-------------|
| _(none yet)_ | | | | |

**Examples for future use:**
- `ERR_NETWORK_LINE_TOKEN_MISSING` — LINE_CHANNEL_ACCESS_TOKEN env missing
- `ERR_NETWORK_LINE_API_FAILED` — LINE Messaging API non-2xx response
- `ERR_NETWORK_SUPABASE_STORAGE_FAILED` — upload/fetch image failed
- `ERR_NETWORK_WEBHOOK_INVALID_PAYLOAD` — webhook payload schema invalid

---

## -4xxx — UI (Client-side)

| Code | Constant | User Message (TH) | Cause | Remediation |
|------|----------|-------------------|-------|-------------|
| _(none yet)_ | | | | |

**Examples for future use:**
- `ERR_UI_FORM_VALIDATION_FAILED` — form input ไม่ผ่าน validation
- `ERR_UI_HEIC_CONVERSION_FAILED` — heic2any error
- `ERR_UI_SIGNATURE_EMPTY` — signature canvas ว่าง

---

## -5xxx — System

| Code | Constant | User Message (TH) | Cause | Remediation |
|------|----------|-------------------|-------|-------------|
| _(none yet)_ | | | | |

**Examples for future use:**
- `ERR_SYSTEM_ENV_MISSING` — required env var ไม่ตั้งค่า
- `ERR_SYSTEM_FILE_IO` — file read/write error
- `ERR_SYSTEM_UNCAUGHT` — fallback for unhandled exceptions

---

## Audit Trail

| Date | Change | By |
|------|--------|----|
| 09-05-2026 | Catalog created (skeleton, no entries yet) | MT (Phase 0 baseline) |
| 11-05-2026 | Added `ERR_TICKET_NO_USER_FOR_BRANCH = -2001` — MON-09 createTicket() silent user creation fix | SC (Monolith) |
