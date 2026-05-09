# MON-02 — Update root README.md with project description

**Phase:** 0
**Team:** Monolith
**Status:** [x] Complete
**Complexity:** Simple
**Depends on:** MON-01 (เพื่อให้ description ถูกต้องตามที่ scan ได้)
**Blocks:** None

## Scope
เขียน root `README.md` ใหม่ ปัจจุบันมีแค่ `# Web_repair_center` 1 บรรทัด

## Acceptance Criteria
- [x] Project name + 1-2 sentence description
- [x] Tech stack summary (จาก MON-01)
- [x] Project structure overview (Development/, ticket-system/, RoundTable/, .claude/)
- [x] Quick start: ไปที่ `ticket-system/` แล้ว `npm install && npm run dev`
- [x] Link ไปที่ `ticket-system/README.md` สำหรับรายละเอียด
- [x] Link ไปที่ `.claude/CLAUDE.md` สำหรับ governance framework

## Boundaries
- Do NOT delete: ticket-system/README.md (ของ Next.js — เป็นของ subapp)
- Do NOT add: deployment instructions ที่ไม่ verified

## Notes
ผู้อ่าน README นี้ = devs/ผู้ดูแลที่จะเข้ามาเจอ repo ครั้งแรก ต้องบอกครบว่าโปรเจกต์คืออะไร อยู่ตรงไหน เริ่มยังไง
