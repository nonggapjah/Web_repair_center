# RoundTable — 12-05-2026 (Vol 1)

**Date:** 12-05-2026
**Active Project:** Web_repair_center
**Active Teams:** Overseer, Monolith, Syndicate, Arcade

---

## Session 1 Web_repair_center — Admin Program Enhancement Intake (7 Modifications)

**Commander Request (verbatim, Thai):**
> ต้องการแก้ไขหน้า โปรแกรมเพิ่มเติม
> 1. เพิ่มปุ่มสถานะในหน้าของ admin ว่าเเจ้งงานผิดประเภท
> 2. admin สามารถแก้ไขหมวดหมูงานได้
> 3. เพิ่มงาน request
> 4. เพิ่มงาน supplier
> 5. (ลำดับซ้ำ "4") ต้องการดูสาขาด้วยในหน้ารายงาน
> 6. เวลากดช่างรับเหมาในหน้า admin ให้บอกว่ามี supplier เจ้าไหนด้วย ตอนนี้จะมี 24fis, 123, อื่น
> 7. หน้า admin ส่วนของการเลือกช่างอยากเพิ่มให้สามารถเลือกช่างได้มากกว่า 1 คน

### Voices

**AM (Conductor):**
รับโจทย์ครับท่านผู้บัญชาการ — เป็น **Modification request** ตรงตาม Planning-First Workflow → จะเข้าโฟลเดอร์ `04_Modification Logs/AdminProgramEnhancement_12-05-2026/` หลังจาก Commander อนุมัติ scope แล้วเท่านั้น
ขั้นนี้ยังอยู่ **Intake Phase** — รวบรวมความต้องการ + ระบุประเด็นกำกวม + นำเสนอแผนเพื่อ Commander อนุมัติ — **ยังไม่แก้ code แม้แต่บรรทัดเดียว** ตาม No-Code-Before-Ticket Rule ครับ

**MT (Technologist):**
สแกนแล้ว — 4 จาก 7 รายการแตะ **schema** (multi-tech, supplier field, category master, status enum) ส่วน 3 รายการเป็น **UI-only**
ที่กระทบ schema มากที่สุดคือ item 7 (multi-select ช่าง) เพราะ `RepairTicket.Technician` ปัจจุบันเป็น `String?` เดี่ยว — ต้องตัดสินใจระหว่าง CSV string vs. join table `TicketTechnician`
และต้องเคลียร์ความกำกวมของคำว่า "หมวดหมู่งาน", "งาน request", "งาน supplier" ก่อน ไม่งั้นออกแบบ schema ผิดทาง

**AS (Design & Verification Scholar):**
สังเกตว่า request นี้กระทบทั้ง 3 หน้าหลัก — `/admin/dashboard` (765 LOC, ใกล้ rewrite threshold), report page (ต้องระบุว่าหน้าไหน), และ user-side ticket submission (item 3-4 ถ้าเป็น ticket type ใหม่)
แนะนำให้ Commander ตอบ clarifying questions ก่อน เพื่อให้ UX flow ออกแบบได้ครบและเขียน acceptance criteria ได้ชัด — UX Smoke Test Gate จะต้อง pass ทั้ง happy path + edge case ของทั้ง 7 รายการ

### Pre-Existing Codebase Status
- PreExisting TechStack: มีอยู่แล้ว (Phase 0-2A ผ่านมา)
- Phase 1 + Phase 2A complete; Phase 2A tickets ปิดครบ 7 ใบ
- โปรเจกต์ Centralized mode, deploys via Vercel auto on push to `main`

### Actions Taken
- Read UserProfile.md, CLAUDE.md, overseer.md, ProjectEnvironment.md, project memory, feedback memory
- L1 scan: confirmed `/admin/dashboard` (765 LOC), `prisma/schema.prisma` (RepairTicket has single `Technician String?` field, no Supplier model, Symptom/Product are free-text strings)
- Identified 7 modification items + ambiguities

### Output Delivered
- **Clarifying questions presented to Commander** (see chat output) covering: หมวดหมู่งาน definition, งาน request/supplier scope, report page identification, supplier list editability, multi-tech schema strategy
- **No code, no tickets, no plan files created yet** — awaiting Commander answers per Planning-First Workflow
- **Reason:** Per CLAUDE.md §4 Plan-Before-Implementation + No-Code-Before-Ticket — Commander vision required before AM can write the Mod Log and dispatch teams

### Next Step
- Await Commander answers to clarifying questions
- Then: invoke `/mod-log Web_repair_center AdminProgramEnhancement` to scaffold mod log + ticket folders
- Then: present Mode A Execution Plan with team assignments + ZCB-validated ticket scope for Commander approval before subagent dispatch

---

## Session 2 Web_repair_center — Commander Clarifications Received & Scope Consolidation

**Commander Reply (verbatim, Thai):**
> Q1 — เอาไว้ให้ admin เป็นคนแก้ไขเวลาสาขากรอกเข้ามาผิดประเภท คืองานอื่นๆที่ไม่เกี่ยวกันกับระบบช่าง เช่น งานของไอที เป็นต้น
> Q2 — admin สามารถแก้ไขหมวดหมูงานได้ คืองานที่สาขากรอกเข้ามาผิดแต่ยังอยู่ในงานของช่าง
> Q3+Q4 — "งาน request", "งาน supplier" แค่เพิ่มเข้าไปที่หมวดหมู่เฉยๆ เพราะเป็นงานให้ที่ต้องทำ
> Q5 (Commander's numbering — answers AM's Q6 supplier flow) — เวลากดที่หมวดหมู่งานช่างรับเหมาแล้ว ให้มีตัวเลือกเพิ่มเติมขึ้นมาด้วยว่าเป็นของใคร ถ้าไม่มีให้กดอื่นๆแล้วกรอกเข้ามา
> Q7 — ทางเลือก B (join table)

### Voices

**AM (Conductor):**
สรุปทิศทางชัดขึ้นมากครับ — แต่มี 2 จุดต้องยืนยันก่อน scaffold mod log: (1) หน้า "รายงาน" ที่ท่านอ้างถึงในข้อ 5 (เดิม) คือ admin dashboard ใช่ไหม Commander ตอบ Q6 (supplier) เป็น Q5 ตามลำดับของท่าน ทำให้ Q5 (report page) ของ AM ยังไม่ได้คำตอบ (2) ขอยืนยันโมเดล JobCategory ว่าเป็น field ใหม่บน RepairTicket ที่มี predefined list + ย้าย "ทีมช่างรับเหมา" จาก technicians list มาเป็นค่าใน JobCategory

**MT (Technologist):**
การตีความใหม่ทำให้ schema สะอาดขึ้น — แยก 2 concerns ที่ตอนนี้ผสมกัน:
- **JobCategory** (ประเภทงาน): ไฟฟ้า, ประปา, แอร์, ตู้แช่, ช่างรับเหมา, Request, Supplier, อื่นๆ — admin แก้ได้
- **Technicians** (คนทำงานจริง): ช่างยศ, ช่างชา, ... (เอา "ทีมช่างรับเหมา" ออก เพราะมันเป็นประเภทงาน ไม่ใช่คน)
- **SupplierName** (sub-field): activates เฉพาะเมื่อ JobCategory = "ช่างรับเหมา"
- **WrongCategoryFlag / Status:** งานที่ไม่ใช่งานช่างเลย (IT, etc.) → ใช้ status ใหม่ เช่น `Out of Scope` / `Wrong Category` แยกจาก Closed
- **Technicians multi-select:** join table `TicketTechnician { TicketID, TechnicianName }` ตามทางเลือก B
- คาด migration: 2 field ใหม่ + 1 status ใหม่ + 1 join table + data migration จาก `Technician String?` ของเก่าไป join table

**AS (Design & Verification Scholar):**
UX flow ที่ต้องระวัง:
- **Item 1 (Wrong Category):** ปุ่มแยกจาก status dropdown ปกติ (ต่างจาก "Closed") เพื่อสื่อความหมาย "out of scope" ชัด — ไม่ปนกับการปิดงานที่ทำเสร็จ
- **Item 6 (Supplier conditional):** ต้องมี validation — เลือก JobCategory = ช่างรับเหมา แล้วต้องบังคับ supplier (หรือกรอก "อื่นๆ") ห้าม save ว่าง — กันงานช่างรับเหมาที่ไม่มี supplier
- **Item 7 (Multi-tech):** UI ที่รองรับการเลือกหลายช่าง — checkbox list / tag input ดีกว่า dropdown เพื่อ usability
- Acceptance criteria ทุก ticket ต้องครอบคลุม regression: ticket เก่าที่มี `Technician` string เดิม ต้อง migrate ไป join table โดยข้อมูลไม่หาย

### Actions Taken
- Received Commander answers Q1-Q7
- Re-interpreted scope: 4 schema items + 5 UI items + AuditLog hook
- Drafted tentative ticket breakdown (MON-11..13, ARC-XX, SYN-12)

### Output Delivered
- **Final 2 clarifications presented to Commander** (report page identification, JobCategory model confirmation)
- **Tentative Execution Plan draft** (not yet authorized — awaiting Commander confirmation per COO Vision Gate)
- **No tickets created, no code changes** — still in intake/planning per CLAUDE.md §4
- **Reason:** Commander reply resolved most ambiguity but 2 items remain. Mode A subagent dispatch requires zero-ambiguity scope to avoid mid-execution redesign.

### Next Step
- Commander confirms (or corrects) the 2 remaining items
- AM invokes `/mod-log` to scaffold mod log + ticket folders
- AM presents finalized Mode A Execution Plan for COO Vision Gate approval
- After approval: AM spawns Monolith + Arcade + Syndicate subagents in parallel

---

## Session 3 Web_repair_center — Scope Locked, Mod Log Scaffold Authorization

**Commander Reply (verbatim, Thai):**
> Q-A — คือหน้าที่ pop up ขึ้ยมาเวลา admin กด จัดการ ตอนนี้ไม่มีสาขาแสดง
> Q-B — ย้ายมันออกจากรายชื่อช่าง แล้วให้มันกลายเป็น JobCategory แทน

### Voices

**AM (Conductor):**
Scope ปิดครบครับ — ARC-13 ตอนนี้ specs ชัด: เพิ่ม "สาขา" ใน **ticket detail modal** (เมื่อ admin กด "จัดการ" จาก ticket card) ไม่ใช่ column ในรายการหลัก
"ทีมช่างรับเหมา" ย้ายออกจาก technicians[] → เป็นค่าใน JobCategory ตามที่ MT เสนอ — ไม่มี duplicate semantics
ดำเนินการต่อ: scaffold mod log + ticket files แล้วนำเสนอ Mode A Execution Plan สำหรับ COO Vision Gate

**MT (Technologist):**
Schema final 4 deltas:
1. `RepairTicket.JobCategory String?` + predefined list (in constants/seed)
2. `RepairTicket.SupplierName String?` (validation: required when JobCategory = "ช่างรับเหมา")
3. `RepairTicket.CurrentStatus` — เพิ่ม value "WrongCategory" ใน frontend status array + status color/translate mapping
4. New model `TicketTechnician { TicketID, TechnicianName, AssignedAt }` + drop `RepairTicket.Technician String?` หลัง migration

Data migration plan: read all `RepairTicket.Technician`, insert into `TicketTechnician` (split by `,` ถ้ามี — แต่ปัจจุบันเดี่ยว), จากนั้น drop column ใน step ต่อมาเหมือน Phase 0.5d pattern (sequential to avoid breakage) — แต่จะรวมเป็น single migration เพราะ Phase 2A migration history clean

**AS (Design & Verification Scholar):**
ARC-13 specs ตอนนี้ตรงเป้า — modal `selectedTicket` มีอยู่แล้วใน [page.tsx](ticket-system/src/app/admin/dashboard/page.tsx) ต้องเพิ่มบรรทัด "สาขา: {ticket.Branch.BranchName}"
Acceptance criteria ทุก ticket จะรวม regression test:
- ticket เก่าที่มี `Technician` ค่าเดียว ต้อง migrate ไป join table ครบ ไม่หาย
- ticket เก่าที่ `JobCategory` = null ต้องไม่ break UI (default แสดง "ไม่ระบุ")
- ticket เก่าที่ status เดิม ไม่กระทบ
UX Smoke Test Gate: 9 tickets × happy + edge path = ประมาณ 20 manual test scenarios ก่อน mark COMPLETE

### Actions Taken
- Confirmed scope ครบ 7 items
- Located admin "จัดการ" modal in dashboard page.tsx (selectedTicket state)
- Locked schema deltas (4 deltas)
- Ready to scaffold mod log

### Output Delivered
- **Scope locked** — 9 tickets, 3 teams, Phase 2B Modification
- **Mod log path:** `Development/Web_repair_center/04_Modification Logs/AdminProgramEnhancement_12-05-2026/`
- **Reason:** Commander confirmed all clarifications. AM can now scaffold under Planning-First Workflow without further ambiguity. No code changes yet — mod log + tickets first, then COO Vision Gate.

### Next Step
- Scaffold `04_Modification Logs/AdminProgramEnhancement_12-05-2026/` (mod log + 9 ticket folders)
- Create 9 ticket files per §2 standard
- Present finalized Mode A Execution Plan for COO Vision Gate
- After Commander approval → spawn Monolith + Arcade + Syndicate subagents in parallel

---

## Session 4 Web_repair_center — COO Vision Gate Approved + Dispatch

**Commander Direction:**
- **Timeline:** ต้องเสร็จในวันนี้ (12-05-2026)
- **Risk tolerance:** Stability
- **UI Style:** ใช้สีและสไตล์ปัจจุบันต่อ
- **Migration window:** พร้อม downtime สั้นๆ

### AM Decision — Sequential-Parallel Hybrid Dispatch
Per stability priority, AM chooses **sequential-parallel hybrid** over pure parallel:
1. **Phase 1 (Sequential):** Spawn **Monolith** subagent FIRST → schemas + migration land
2. **Phase 2 (Parallel):** After Monolith returns → spawn **Arcade + Syndicate** in parallel → wire to live (no mock-first double-pass)
3. **Phase 3 (Aggregate):** Manual UX Smoke + 4 regression tests → integration test → deploy
4. **Phase 4 (Deploy):** Single push to `main` → Vercel auto-deploy with brief downtime during `prisma db push`

**Rationale:** Mock-first → wire-live = 2 passes per Arcade ticket. Sequential-parallel avoids the rewire pass while still maximizing parallelism between Arcade and Syndicate (1-pass each on live schema).

### Voices

**AM (Conductor):**
Dispatching Monolith ก่อน — เป็น foundation layer ของทุกอย่าง 3 tickets ใน 1 subagent. หลัง Monolith signal complete (พร้อม verification ว่า data loss = 0) AM จะ spawn Arcade + Syndicate ขนานทันที. ทุกการตัดสินใจสำคัญ AM จะกลับมารายงาน Commander ก่อนปิด phase

**MT (Technologist):**
Schema final: 2 new fields + 1 new table + 1 column drop + 4 status value (existing field). Migration ใช้ Phase 0.5d pattern (data migrate ก่อน drop column). Stability ringfence — ห้าม subagent push to `main` เอง — AM รวมผลแล้วใช้ `/git commit --force` (per Commander's main-only preference)

**AS (Design & Verification Scholar):**
Acceptance gate per ticket — AM ต้องรอ Monolith ส่ง verification evidence (row count match, regression test pass) ก่อน dispatch Arcade. Stability = no skipping checks. UX Smoke test จะรันหลัง Arcade complete

### Actions Taken
- COO Vision Gate approved by Commander
- Constraints captured: today / stability / current UI style / brief downtime OK
- Selected sequential-parallel hybrid over pure parallel for stability

### Output Delivered
- **Dispatch Phase 1:** Monolith subagent spawned (foreground, awaiting result)
- **Reason:** Foundation schemas must land before UI/audit teams can build on stable contract — eliminates the mock-first rewire pass

### Next Step
- Await Monolith subagent return
- Verify data loss = 0 (row count check)
- Spawn Arcade + Syndicate parallel
- Aggregate + integration test + deploy

---
