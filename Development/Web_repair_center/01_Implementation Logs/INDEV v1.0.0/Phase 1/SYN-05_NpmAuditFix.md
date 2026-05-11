# SYN-05 — npm audit fix

**Phase:** 1
**Team:** Syndicate
**Status:** [x] Complete
**Complexity:** Simple
**Depends on:** SYN-06 (LINE removal — เผื่อ @line/liff มี vuln, ลบก่อนจะลด surface)
**Blocks:** None

## Scope
รัน `npm audit fix` ใน `ticket-system/` เพื่อแก้ 7 vulnerabilities (3 moderate + 4 high) ที่เจอตอน Phase 0.5 install

## Acceptance Criteria
- [ ] รัน `npm audit` ก่อน → record baseline
- [ ] รัน `npm audit fix` (ไม่ใช้ `--force`) → ดูผล
- [ ] รัน `npm audit` หลัง → ต้องไม่มี high/critical
- [ ] `npm run build` หลัง fix → ผ่าน
- [ ] ถ้า moderate ยังเหลือ → document ใน 07_TechnicalDebt/ ว่า acceptable
- [ ] ถ้าต้อง `--force` (breaking change) → STOP + ขออนุญาต Commander ก่อน

## Boundaries
- Do NOT use `--force` without Commander approval
- Do NOT downgrade packages without Tech Debt entry
- Do NOT break existing functionality — build + UX smoke test must pass

## Notes
ดำเนินการหลัง SYN-06 (LINE removal) เพื่อลด attack surface ก่อน — ถ้า @line/liff หรือ deps มี vuln, ลบไปจะแก้บางส่วนทันที
