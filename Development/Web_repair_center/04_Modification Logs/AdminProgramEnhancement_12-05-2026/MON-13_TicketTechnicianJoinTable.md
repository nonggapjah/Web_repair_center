# MON-13 — TicketTechnician Join Table + Data Migration

**Phase:** 2B — Admin Program Enhancement (Modification)
**Team:** Monolith
**Status:** [x] COMPLETE (12-05-2026 — table created + data migrated + dual-write live; **column drop DEFERRED to MON-13b** per Phase 0.5d 2-phase pattern)
**Complexity:** Complex
**Depends on:** None (independent foundation)
**Blocks:** ARC-14 (live wire), SYN-12

## Scope

เปลี่ยน technician assignment จาก single `String?` field → many-to-many join table:
1. เพิ่ม model `TicketTechnician` ใน `prisma/schema.prisma`
2. Data migration script: copy ทุก `RepairTicket.Technician != null` → row ใน `TicketTechnician` (zero data loss)
3. อัปเดต `getAllTickets` ใน `src/app/actions/tickets.ts` ให้ include `Technicians` relation
4. สร้าง server action ใหม่:
   - `assignTechnicians(ticketId, technicianNames[])` — replace all assignees
   - `addTechnician(ticketId, technicianName)` — append one
   - `removeTechnician(ticketId, technicianName)` — remove one
5. Drop `RepairTicket.Technician String?` column **หลัง verify** migration ครบ
6. อัปเดต `src/lib/technicians.ts` (สร้างใหม่) — ลบ `"ทีมช่างรับเหมา"` ออก (กลายเป็น JobCategory value ใน MON-11)
7. รัน `prisma db push` 2 ครั้ง (add table → migrate data → drop column)

## Acceptance Criteria

- [ ] `prisma/schema.prisma` มี model:
      ```
      model TicketTechnician {
        id             String   @id @default(cuid())
        TicketID       String
        Ticket         RepairTicket @relation(fields: [TicketID], references: [TicketID], onDelete: Cascade)
        TechnicianName String
        AssignedAt     DateTime @default(now())
        @@index([TicketID])
        @@index([TechnicianName])
        @@unique([TicketID, TechnicianName])
      }
      ```
- [ ] Migration script `scripts/migrate-technicians.mjs` runs idempotently — re-running doesn't duplicate
- [ ] All existing tickets with `Technician` value have matching `TicketTechnician` row (verify count: `SELECT COUNT(*) WHERE Technician IS NOT NULL` == `TicketTechnician` rows for those ticket IDs)
- [ ] `RepairTicket.Technician` field DROPPED after migration verified
- [ ] `RepairTicket` model has `Technicians TicketTechnician[]` relation
- [ ] `src/lib/technicians.ts` exports `TECHNICIANS = ["ช่างยศ","ช่างชา","ช่างต้น","ช่างปาด","ช่างสกล","ช่างเขียด","ช่างประวิท","ช่างเดี่ยว"]` — **"ทีมช่างรับเหมา" REMOVED**
- [ ] All 3 server actions return updated ticket with `Technicians` array populated
- [ ] Regression test R-01 (zero data loss migration) — `09_TestCase/_regression/`
- [ ] State Transparency: assign action logs `[ASSIGN] ticket=X tech=Y by=admin` + remove action logs `[REMOVE] ticket=X tech=Y by=admin`

## Boundaries

- Do NOT touch UI — ARC-14 scope
- Do NOT add JobCategory or SupplierName references in this ticket — MON-11/12 own those
- Do NOT migrate data in same `prisma db push` as schema change — separate steps to avoid partial state on failure
- Do NOT delete old Technician column until migration verified by AS via row count

## Notes

- Migration order CRITICAL (per Verify-Existing-Users-Before-Claiming-Success feedback memory):
  1. Add `TicketTechnician` table (push)
  2. Run migration script → populate from `RepairTicket.Technician`
  3. AS verifies row counts match
  4. Update server actions to read from new table (still keeping old column readable as fallback during transition)
  5. Drop `RepairTicket.Technician` (push)
  6. Final verification
- ใช้ ephemeral env vars สำหรับ DB connection ใน migration script (feedback memory pattern)
- Migration script ใช้ PowerShell pattern: `$env:DATABASE_URL=...; node scripts/migrate-technicians.mjs; Remove-Item Env:\DATABASE_URL`
- "ทีมช่างรับเหมา" ใน data เก่า: ถ้าเจอ ticket ที่ `Technician == "ทีมช่างรับเหมา"` → migration script ต้อง **set ticket.JobCategory = "ช่างรับเหมา"** + ไม่สร้าง TicketTechnician row (เพราะมันไม่ใช่คน) — log warning ทุก row ที่ทำแบบนี้
