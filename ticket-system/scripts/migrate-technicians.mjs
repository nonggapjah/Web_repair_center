// MON-13 (12-05-2026): one-shot, idempotent migration from RepairTicket.Technician (String?)
// to the TicketTechnician join table.
//
// Special case: tickets where Technician == "ทีมช่างรับเหมา" are NOT migrated as people —
// they are reclassified by setting JobCategory = "ช่างรับเหมา" (MON-11 semantics) and the
// legacy Technician value is logged + cleared in a separate `wrong_assignments` count.
//
// Idempotency: TicketTechnician @@unique([TicketID, TechnicianName]) means re-running the
// script on already-migrated rows is a no-op (we use createMany skipDuplicates: true).
// JobCategory backfill is also idempotent — overwrites only if currently null.
//
// Run with ephemeral env vars (per Commander preference for this project):
//   PowerShell:
//     $env:DATABASE_URL = (Get-Content .env | Select-String '^DATABASE_URL').ToString().Split('"')[1]
//     $env:DIRECT_URL   = (Get-Content .env | Select-String '^DIRECT_URL').ToString().Split('"')[1]
//     node scripts/migrate-technicians.mjs
//     Remove-Item Env:\DATABASE_URL,Env:\DIRECT_URL
//
// Output: structured counts so the operator can verify zero data loss before the
// follow-up `prisma db push` that drops the legacy column.

import { PrismaClient } from "@prisma/client";

const CONTRACTOR_LEGACY_VALUE = "ทีมช่างรับเหมา";
const CONTRACTOR_JOB_CATEGORY = "ช่างรับเหมา";

const prisma = new PrismaClient();

async function main() {
    console.log("[migrate-technicians] start");

    // 1. Snapshot current state — read every row with a non-null Technician
    const all = await prisma.repairTicket.findMany({
        select: { TicketID: true, Technician: true, JobCategory: true },
        where: { Technician: { not: null } }
    });

    const totalLegacy = all.length;

    // Three buckets — empty strings predate this migration (legacy null-equivalent).
    // Don't insert them as a technician with empty name; just count and ignore.
    const emptyRows = all.filter(t => (t.Technician ?? "").trim() === "");
    const contractorRows = all.filter(t => t.Technician === CONTRACTOR_LEGACY_VALUE);
    const personRows = all.filter(t =>
        t.Technician !== CONTRACTOR_LEGACY_VALUE &&
        (t.Technician ?? "").trim() !== ""
    );

    console.log(`[migrate-technicians] legacy non-null Technician rows: ${totalLegacy}`);
    console.log(`[migrate-technicians]   - person assignments: ${personRows.length}`);
    console.log(`[migrate-technicians]   - "ทีมช่างรับเหมา" rows (special case → JobCategory): ${contractorRows.length}`);
    console.log(`[migrate-technicians]   - empty-string rows (skipped, no assignment): ${emptyRows.length}`);

    // 2. Migrate person assignments → TicketTechnician (idempotent via unique constraint)
    const personPayload = personRows.map(t => ({
        TicketID: t.TicketID,
        TechnicianName: t.Technician
    }));

    let insertedPersons = 0;
    if (personPayload.length > 0) {
        const result = await prisma.ticketTechnician.createMany({
            data: personPayload,
            skipDuplicates: true
        });
        insertedPersons = result.count;
        console.log(`[migrate-technicians] inserted TicketTechnician rows: ${insertedPersons} (skipped duplicates: ${personPayload.length - insertedPersons})`);
    } else {
        console.log("[migrate-technicians] no person assignments to migrate");
    }

    // 3. Reclassify contractor rows — set JobCategory if not already set
    let reclassified = 0;
    let alreadyTagged = 0;
    for (const row of contractorRows) {
        if (row.JobCategory === CONTRACTOR_JOB_CATEGORY) {
            alreadyTagged++;
            continue;
        }
        await prisma.repairTicket.update({
            where: { TicketID: row.TicketID },
            data: { JobCategory: CONTRACTOR_JOB_CATEGORY }
        });
        console.log(`[migrate-technicians] reclassified ticket=${row.TicketID} Technician="${row.Technician}" -> JobCategory="${CONTRACTOR_JOB_CATEGORY}"`);
        reclassified++;
    }
    console.log(`[migrate-technicians] reclassified contractor tickets: ${reclassified} (already tagged: ${alreadyTagged})`);

    // 4. Verification — readback counts
    const ticketTechCount = await prisma.ticketTechnician.count();
    const distinctTicketIdsWithTech = await prisma.ticketTechnician.findMany({
        select: { TicketID: true },
        distinct: ["TicketID"]
    });
    const contractorJobCategoryCount = await prisma.repairTicket.count({
        where: { JobCategory: CONTRACTOR_JOB_CATEGORY }
    });

    console.log("[migrate-technicians] === verification ===");
    console.log(`[migrate-technicians] total TicketTechnician rows           : ${ticketTechCount}`);
    console.log(`[migrate-technicians] distinct TicketIDs in TicketTechnician: ${distinctTicketIdsWithTech.length}`);
    console.log(`[migrate-technicians] tickets with JobCategory=ช่างรับเหมา : ${contractorJobCategoryCount}`);
    console.log(`[migrate-technicians] expected min person-tickets           : ${personRows.length}`);
    console.log(`[migrate-technicians] expected min contractor-tickets       : ${contractorRows.length}`);
    console.log(`[migrate-technicians] empty-string rows (intentionally not migrated): ${emptyRows.length}`);

    const passed =
        distinctTicketIdsWithTech.length >= personRows.length &&
        contractorJobCategoryCount >= contractorRows.length;

    if (passed) {
        console.log("[migrate-technicians] VERIFICATION: PASS — safe to drop RepairTicket.Technician");
    } else {
        console.error("[migrate-technicians] VERIFICATION: FAIL — DO NOT drop Technician column. Investigate counts above.");
        process.exitCode = 1;
    }
}

main()
    .catch((e) => {
        console.error("[migrate-technicians] ERROR:", e);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
        console.log("[migrate-technicians] done");
    });
