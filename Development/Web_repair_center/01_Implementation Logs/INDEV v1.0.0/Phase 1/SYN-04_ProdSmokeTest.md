# SYN-04 — Production smoke test script

**Phase:** 1
**Team:** Syndicate
**Status:** [x] Complete
**Complexity:** Medium
**Depends on:** None
**Blocks:** None

## Scope
สร้าง `ticket-system/scripts/prod_smoke_test.ts` — automated post-deploy verification script ที่:
1. Test 3 login flows ผ่าน HTTP (ไม่ใช่ DB query) — verify deployed code ตอบสนองถูก
2. Test create ticket endpoint
3. Test session cookie persistence
4. Output PASS/FAIL summary + non-zero exit on failure (CI-friendly)

## Acceptance Criteria
- [ ] Script ที่ `ticket-system/scripts/prod_smoke_test.ts`
- [ ] รับ BASE_URL จาก env (`PROD_URL` หรือ argv) — default `http://localhost:3000`
- [ ] 5 test cases ทำงานผ่าน HTTP fetch + parse Server Action response:
  - TC-01: POST /login admin / **read from env `SMOKE_ADMIN_PW`** → expect success + Set-Cookie
  - TC-02: POST /login admin / `wrong_pw` → expect failure
  - TC-03: POST /login `1000` / `vl1000` → expect success
  - TC-04: POST /login `nonexistent_user` / `any` → expect "ไม่พบ"
  - TC-05: GET / (landing page) → expect 200
- [ ] Summary output: total/pass/fail/duration
- [ ] Non-zero exit code on any failure (for CI)
- [ ] Documented usage in script header

## Boundaries
- Do NOT include: real admin password ใน script (ต้องอ่านจาก env)
- Do NOT: write/modify DB state
- Do NOT: depend on local dev server — script ทำงานกับ deployed URL
- Do NOT: trigger LINE Notify หรือ external side effects

## Notes
Server Actions ใน Next.js 16 รับ POST request ที่ specific endpoint format — ต้อง POST ไปที่ `/login` หน้าเพจ + parse multipart/form-data response. Alternative: ใช้ Playwright ถ้า server action format ยุ่งยากเกิน — flag เป็น sub-task ถ้าเลือกใช้

Linked to BUG-01 (stale deployment) — เป็นบทเรียนที่ trigger ticket นี้
