# SYN-02 — Implement bcrypt dual-mode in auth.ts

**Phase:** 0.5
**Team:** Syndicate
**Status:** [x] Complete
**Complexity:** Medium
**Depends on:** SYN-01, MON-05, MON-06
**Blocks:** SYN-03, OVS-03

## Scope
แก้ไข `ticket-system/src/app/actions/auth.ts` `login()` function ให้รองรับทั้ง legacy plaintext + new bcrypt hash (dual-mode) พร้อม **lazy migration** — user ที่ login ครั้งต่อไปจะได้ password hash อัตโนมัติ

## Acceptance Criteria
- [x] `import bcrypt from "bcryptjs"` ที่ top
- [x] login flow updated:
  ```
  if (user.PasswordHash) {
    // New path
    const ok = await bcrypt.compare(password, user.PasswordHash);
    if (!ok) return { success: false, error: "รหัสผ่านไม่ถูกต้อง" };
  } else {
    // Legacy path — plaintext compare
    if (user.Password !== password) {
      return { success: false, error: "รหัสผ่านไม่ถูกต้อง" };
    }
    // Lazy migrate — hash this password and persist
    const hash = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { UserID: user.UserID },
      data: { PasswordHash: hash }
    });
  }
  ```
- [x] Comment แก้ comment เก่า "MSSQL" ที่ stale
- [x] No regression: ทุก existing test (ถ้ามี) ผ่าน
- [x] Build (`npm run build`) สำเร็จ

## Boundaries
- Do NOT change: function signature ของ login/logout/getSession
- Do NOT change: cookie format / session structure
- Do NOT change: techMapping logic
- Do NOT remove: legacy plaintext path (ยังจำเป็นจนกว่า backfill ครบ)
- Do NOT add: new error messages ที่ user-facing different

## Notes
- bcrypt.compare เป็น constant-time → ป้องกัน timing attack
- salt rounds 10 — balance ระหว่าง security vs login latency (ปกติ 50-100ms ต่อ compare)
- lazy migrate ทำให้ user ทุกคนที่ active จะถูก migrate ภายใน login ครั้งหน้า
- Backfill script (SYN-03) จัดการ inactive users
