# SYN-01 — Add bcryptjs dependency

**Phase:** 0.5
**Team:** Syndicate
**Status:** [x] Complete
**Complexity:** Simple
**Depends on:** None
**Blocks:** SYN-02

## Scope
เพิ่ม `bcryptjs` (pure-JS bcrypt) เป็น runtime dependency + `@types/bcryptjs` เป็น dev dependency ใน `ticket-system/package.json`

## Acceptance Criteria
- [x] `bcryptjs` ใน `dependencies` (latest stable, ^2.x)
- [x] `@types/bcryptjs` ใน `devDependencies` (latest)
- [x] `npm install` สำเร็จ — package-lock.json updated
- [x] `import bcrypt from "bcryptjs"` ใน TS file ไม่ error
- [x] ไม่ break existing dependencies

## Boundaries
- Do NOT install: native `bcrypt` (ต้องการ Visual Studio Build Tools, แตกง่ายบน Windows)
- Do NOT modify: source code (เฉพาะ package.json + lock)

## Notes
เลือก bcryptjs ตามเหตุผลใน Phase0.5_SecurityMigration.md §7
