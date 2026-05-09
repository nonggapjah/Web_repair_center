# MON-03 — Create ticket-system/.env.example

**Phase:** 0
**Team:** Monolith
**Status:** [x] Complete
**Complexity:** Simple
**Depends on:** MON-01 (ให้รู้ว่าโค้ดอ้างอิง env var ตัวไหนบ้าง)
**Blocks:** None

## Scope
สร้างไฟล์ `ticket-system/.env.example` พร้อมรายการ env variables ทั้งหมดที่โค้ดอ้างอิง พร้อม comment อธิบาย ไม่มี value จริง

## Acceptance Criteria
- [x] ไฟล์ `ticket-system/.env.example` exists
- [x] รวม env vars จาก:
  - `DATABASE_URL`, `DIRECT_URL` (Prisma — Supabase Postgres)
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ถ้าใช้)
  - `SUPABASE_SERVICE_ROLE_KEY` (ถ้าใช้)
  - LINE LIFF: `NEXT_PUBLIC_LIFF_ID`
  - LINE Notify: token vars
  - อื่นๆ ที่เจอใน source code (ใช้ Grep `process.env`)
- [x] แต่ละ var มี comment สั้นๆ บอกว่าใช้ทำอะไร
- [x] ไม่มี actual secret/key — placeholder เท่านั้น (`your-key-here`, `<URL>`)
- [x] `.env.example` ไม่ถูก gitignore (ตรงข้ามกับ `.env*` rule — ตรวจ `.gitignore` ปัจจุบัน)

## Boundaries
- Do NOT include: real secrets, real Supabase URLs, real LINE tokens
- Do NOT modify: source code, `.gitignore` (ถ้า `.env.example` ถูก ignore ให้แจ้งเป็น sub-task ไม่แก้เอง)

## Notes
.gitignore line 34 ปัจจุบัน: `.env*` — block .env.example ด้วย ต้องเพิ่ม exception `!.env.example` ไม่งั้น file ใหม่จะไม่ถูก commit
ใน source code: ใช้ `Grep "process.env"` เพื่อรวบรวม env vars ที่อ้างถึงจริง
