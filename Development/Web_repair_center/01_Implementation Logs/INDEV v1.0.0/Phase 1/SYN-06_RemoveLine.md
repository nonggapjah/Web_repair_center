# SYN-06 — Remove LINE integration entirely

**Phase:** 1
**Team:** Syndicate
**Status:** [x] Complete
**Complexity:** Medium
**Depends on:** None
**Blocks:** MON-09 (both touch tickets.ts; SYN-06 cleans LINE comments first)

## Scope
Commander directive: LINE ไม่ใช้แล้ว — ลบทุก surface ของ LINE จาก codebase

## Acceptance Criteria

### Files to DELETE
- [ ] `ticket-system/src/components/LiffProvider.tsx`
- [ ] `ticket-system/src/lib/lineNotify.ts`
- [ ] `ticket-system/src/app/api/webhook/route.ts` (LINE-only — just logs LINE IDs)

### Files to MODIFY
- [ ] `ticket-system/src/app/login/page.tsx`:
  - Remove import `useLiff`
  - Remove `useLiff()` call
  - Remove `handleLiffLogin` handler
  - Remove LIFF login button section
  - Remove profile display section (lines 60-67 area)
  - Login form (username/password) MUST still work — unchanged
- [ ] `ticket-system/src/app/layout.tsx`:
  - Remove import `LiffProvider`
  - Unwrap `<LiffProvider>` from JSX
- [ ] `ticket-system/src/app/actions/tickets.ts`:
  - Line 4: remove `// import { sendLineNotify } from "@/lib/lineNotify";`
  - Lines 43-44: remove LINE Notify commented block
  - Lines 188-190: remove second LINE Notify commented block
- [ ] `ticket-system/package.json`:
  - Remove `"@line/liff": "^2.27.3"` from dependencies
- [ ] `ticket-system/.env.example`:
  - Remove `NEXT_PUBLIC_LIFF_ID` line + comment
  - Remove `LINE_CHANNEL_ACCESS_TOKEN` line + comment
  - Remove `LINE_TARGET_ID` line + comment
  - Remove "LINE LIFF Configuration" + "LINE Messaging API Configuration" section headers
- [ ] `Development/Web_repair_center/PreExisting TechStack/Web_repair_center.md`:
  - Mark "Notifications", "LIFF Integration", "Webhook" subsystems as **REMOVED 11-05-2026**
  - Update "Critical Issues Summary" — remove issues #3, #5 (LINE-related)

### Verifications
- [ ] `grep -rn -i "liff\|lineNotify\|@line\|LINE_" ticket-system/src/` returns 0 matches
- [ ] `npm install` regenerates package-lock without `@line/liff`
- [ ] `npm run build` PASS — 6 routes (no /api/webhook)
- [ ] `npx tsc --noEmit` clean
- [ ] Login page renders without error in dev server
- [ ] Login form (username/password) still works (manual smoke test by AS in OVS-04)

### Regression Test
- [ ] เพิ่ม section ใน `09_TestCase/_regression/auth_dualmode.spec.md` หรือสร้างไฟล์ใหม่ `09_TestCase/_regression/login_no_line.spec.md`:
  - TC: Login page โหลดได้โดยไม่มี LIFF dependency
  - TC: Username/password form submit ทำงาน (admin + branch user)

## Boundaries
- Do NOT remove: admin/technician/user dashboard pages (no LINE coupling)
- Do NOT remove: signature feature, HEIC viewer, proxy-image, notifications in-app (Notification model in Prisma)
- Do NOT modify: Prisma schema (notification table stays — it's in-app, not LINE-specific)
- Do NOT touch: createTicket() user-creation logic (MON-09 owns that)

## Notes
- LINE Messaging API (`lineNotify.ts`) ถูก disabled อยู่แล้ว (commented out) → ไม่มี runtime impact
- LIFF profile display ใน login page เป็น UI optional → ไม่มี user data dependency
- Webhook endpoint แค่ log IDs ไป console — ไม่มี state/DB side effect ที่จะ lose
- หลัง remove: env vars `NEXT_PUBLIC_LIFF_ID`, `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_TARGET_ID` ใน `.env` ของ Commander ยังอยู่แต่ไม่ถูกใช้ — ปลอดภัยที่จะปล่อยไว้ หรือลบเองภายหลัง
- Vercel env vars ก็เช่นกัน — ถ้า set ไว้ก็ไม่ break, ลบเองได้ภายหลัง
