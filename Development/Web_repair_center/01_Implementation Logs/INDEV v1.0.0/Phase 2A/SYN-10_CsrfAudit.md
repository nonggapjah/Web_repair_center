# SYN-10 — CSRF audit + cookie SameSite

**Phase:** 2A
**Team:** Syndicate
**Status:** [x] Complete
**Complexity:** Simple
**Depends on:** None
**Blocks:** None

## Scope
1. Audit CSRF protection ของระบบ:
   - Next.js 16 Server Actions มี built-in CSRF (signed action IDs, Origin check)
   - Cookie: เพิ่ม `sameSite: "lax"` ใน auth.ts (currently ไม่ set explicit)
   - Custom POST routes: `/api/proxy-image` — เช็คว่ามี CSRF risk หรือไม่
2. Write audit report ที่ `Development/.../08_AuditReport/CSRF_Audit_Phase2A.md`

## Acceptance Criteria
- [ ] Modify `auth.ts` `cookies().set("user_session", ...)`:
  - Add `sameSite: "lax"` to cookie options
- [ ] Audit `/api/proxy-image/route.ts`:
  - ดู method (GET/POST), origin check ไหม, user input ที่ไหน
  - ถ้า GET เท่านั้น + ไม่มี state mutation → safe (just proxy)
  - บันทึกใน audit report
- [ ] Audit Server Actions (`auth.ts`, `tickets.ts`):
  - Verify ใช้ `"use server"` directive
  - Verify ไม่มี endpoints ที่ skip Next.js Server Action framework
  - Verify built-in CSRF active
- [ ] Create `Development/Web_repair_center/08_AuditReport/CSRF_Audit_Phase2A.md`:
  - Section: Server Actions audit table
  - Section: Custom routes audit (/api/proxy-image)
  - Section: Cookie config (before/after)
  - Section: Findings + recommendations
  - Section: Sign-off
- [ ] `npm run build` PASS
- [ ] `tsc --noEmit` clean
- [ ] Manual test: Login + ดู `Set-Cookie` header — มี `SameSite=Lax`

## Decision: SameSite=Lax (not Strict)
**Why:** Strict block cross-site link navigation (เช่น email link → site). Lax + httpOnly + secure = CSRF safe + UX safe สำหรับ ticket system ที่อาจ receive deep links

## Boundaries
- Do NOT change: cookie name, httpOnly, secure (already set), path
- Do NOT add: custom CSRF token middleware (Next.js Server Actions handle built-in)
- Do NOT modify: tickets.ts (separate ticket)

## Notes
- Audit report = living doc, จะ append เมื่อ Phase 2B/2C ทำ security review ครั้งต่อ
- ถ้า audit เจอ gap จริง → file follow-up bug ticket, ไม่แก้ใน scope นี้
