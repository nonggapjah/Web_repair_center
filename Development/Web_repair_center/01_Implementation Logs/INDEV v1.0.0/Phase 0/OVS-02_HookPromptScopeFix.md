# OVS-02 — Hook prompt scope fix

**Phase:** 0
**Team:** Overseer
**Status:** [x] Complete
**Complexity:** Simple
**Depends on:** None
**Blocks:** None

## Scope
แก้ prompt ของ PreToolUse Edit|Write hook ใน `.claude/settings.json` ให้ตีความ path ได้แม่นยำ — ปัจจุบัน LLM ตีความ `.claude/` กว้างเกินไป ทำให้บล็อกไฟล์ legitimate (เช่น UserProfile.md)

## Acceptance Criteria
- [x] Hook prompt บล็อกเฉพาะ 3 path ตามนโยบายจริง:
  - `.claude/CLAUDE.md`
  - `.claude/policies/`
  - `.claude/agents/`
- [x] ไม่บล็อก: `UserProfile.md`, `ProjectEnvironment.md`, `template-version.json`, `settings.json`, `settings.local.json`, ไฟล์ใน `.claude/skills/`, `.claude/rules/`, `.claude/team_chat/`
- [x] Hook ยังคง require explicit authorization สำหรับ 3 protected path
- [x] ทดสอบ: เขียน UserProfile.md ใหม่ผ่าน Edit/Write tool ต้องไม่ถูกบล็อก

## Boundaries
- Do NOT touch: hook script files (`hooks/scripts/*.sh`), อื่นๆ ที่ไม่ใช่ prompt block ของ Edit|Write hook

## Notes
ปัจจุบัน prompt ที่ settings.json line 49:
```
"prompt": "The user is about to modify a file. Check if the file path contains '.claude/CLAUDE.md', '.claude/policies/', or '.claude/agents/'. If it matches any of these PROTECTED paths, respond 'yes' ONLY if the user has explicitly authorized policy modifications in this session. Otherwise respond 'no' to block. If the file is NOT protected, respond 'yes' to allow."
```
LLM ตีความ ".claude/" ส่วนหน้าของ ".claude/CLAUDE.md" แล้ว match ทุกไฟล์ใน .claude/ — ต้องเพิ่มเงื่อนไขเข้มกว่านี้ (exact match หรือ list of paths แม่นยำ)
