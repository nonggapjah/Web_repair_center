# Regression — MON-13 Technician → TicketTechnician Migration

**Created:** 12-05-2026
**Owner:** Monolith (PF — Verification Scholar)
**Tickets covered:** MON-13 (data migration), MON-13b (future column drop)
**Trigger:** Re-run after any change to `scripts/migrate-technicians.mjs`,
            `src/app/actions/tickets.ts` technician handling, or before MON-13b column drop

## R-01 — Zero Data Loss (executed 12-05-2026, PASS)

**Pre-migration snapshot** (output of `node scripts/snapshot-technicians.mjs`):
```
totalNonNullTechnician: 89
breakdown:
  ทีมช่างรับเหมา : 21
  (empty string) : 12
  ช่างยศ        : 21
  ช่างเขียด     : 15
  ช่างสกล       :  6
  ช่างเดี่ยว    :  5
  ช่างต้น       :  4
  ช่างชา        :  3
  ช่างปาด       :  2
person assignments total: 56
```

**Post-migration counts** (output of `node scripts/migrate-technicians.mjs`):
```
inserted TicketTechnician rows: 56
distinct TicketIDs in TicketTechnician: 56
tickets with JobCategory=ช่างรับเหมา: 21
empty-string rows skipped: 12
VERIFICATION: PASS
```

**Conservation check:** 56 (persons) + 21 (contractor reclassified) + 12 (empty,
skipped intentionally) = 89 = totalNonNullTechnician. Zero data loss.

## R-02 — Idempotency

Re-running `node scripts/migrate-technicians.mjs` MUST report:
- `inserted TicketTechnician rows: 0 (skipped duplicates: 56)`
- `reclassified contractor tickets: 0 (already tagged: 21)`
- `VERIFICATION: PASS`

Run after any second execution of the migration to confirm no row duplication.

## R-03 — Dual-Write Sync Invariant

After ANY call to `updateTicketStatus` or `assignTechnicians` with non-empty technicians:
- `RepairTicket.Technician` field contains comma-joined names (back-compat)
- `TicketTechnician` rows for that TicketID == the set of names provided
- Counts match: `string.split(",").map(trim).filter(s=>s.length>0 && s!=="ทีมช่างรับเหมา").length` === count of TicketTechnician rows for that ticket

Manual verification SQL:
```sql
SELECT t."TicketID",
       t."Technician" AS legacy_string,
       COUNT(tt."id")  AS join_table_count,
       array_agg(tt."TechnicianName" ORDER BY tt."TechnicianName") AS join_names
FROM "RepairTicket" t
LEFT JOIN "TicketTechnician" tt ON tt."TicketID" = t."TicketID"
WHERE t."Technician" IS NOT NULL AND t."Technician" <> ''
GROUP BY t."TicketID", t."Technician"
HAVING (
  COALESCE(array_length(string_to_array(replace(t."Technician", 'ทีมช่างรับเหมา', ''), ','), 1), 0)
  - COUNT(CASE WHEN trim(s) = '' THEN 1 END)
) <> COUNT(tt."id");
```
Expected: zero rows returned (all tickets have matching legacy + join-table state).

## R-04 — Contractor Special Case

Setting Technician = "ทีมช่างรับเหมา" via any mutation MUST:
- Set RepairTicket.JobCategory = "ช่างรับเหมา"
- NOT create a TicketTechnician row with TechnicianName = "ทีมช่างรับเหมา"

Test fixture:
```ts
await updateTicketStatus(ticketId, "On Process", "test", "ทีมช่างรับเหมา");
// expect:
//   ticket.JobCategory === "ช่างรับเหมา"
//   prisma.ticketTechnician.count({ where: { TicketID: ticketId } }) === 0
//   ticket.Technician === "" (empty after stripping the contractor sentinel)
```

## R-05 — Null Safety

Tickets with `JobCategory = NULL`, `SupplierName = NULL`, or zero TicketTechnician rows
MUST render in the dashboard without TypeError. Sample 10 such legacy tickets:
```sql
SELECT "TicketID" FROM "RepairTicket"
WHERE "JobCategory" IS NULL AND "SupplierName" IS NULL
ORDER BY random() LIMIT 10;
```
Open each in `/admin/dashboard` → "จัดการ" modal → no console errors.

## R-06 — Pre-MON-13b Drop Gate

Before MON-13b drops the Technician column, this query MUST return 0:
```sql
SELECT COUNT(*) FROM "RepairTicket" t
WHERE t."Technician" IS NOT NULL
  AND t."Technician" <> ''
  AND t."Technician" <> 'ทีมช่างรับเหมา'
  AND NOT EXISTS (
    SELECT 1 FROM "TicketTechnician" tt
    WHERE tt."TicketID" = t."TicketID"
  );
```
Any non-zero result = orphaned legacy assignment = MUST investigate before dropping column.
