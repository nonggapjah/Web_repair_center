# MON-13b — Drop legacy `RepairTicket.Technician` column (FOLLOW-UP)

**Phase:** 2B-followup — Admin Program Enhancement (Modification)
**Team:** Monolith
**Status:** [>] DEFERRED → target Phase 2C (1-2 weeks after MON-13)
**Complexity:** Simple
**Depends on:** MON-13 (complete) + ARC-14 (multi-tech UI shipped + observed in production)
**Blocks:** None

## Origin

Created during MON-13 execution on 12-05-2026. Original MON-13 specified a single-session
"add table → migrate data → drop column" flow, but applying it without an observation
window violates Commander's documented stability preference (Phase 0.5d Password column
pattern: dual-write first, drop after 1-2 weeks of incident-free observation).

## Scope

After ARC-14 ships and the multi-tech selector replaces the single-tech dropdown in
production, monitor for 1-2 weeks. Then:

1. Edit `prisma/schema.prisma` — remove `Technician String?` line from `RepairTicket`
2. Edit `src/app/actions/tickets.ts` — remove all dual-write paths to `Technician` field
   (`syncTicketTechnicians` keeps doing its work; `updateTicketStatus` stops setting
   `updateData.Technician`; `getTechnicianTickets` drops the legacy `Technician` OR clause)
3. `npx prisma db push` — Postgres drops the column
4. `npx prisma generate` — regenerate client without the column
5. Run `npx tsc --noEmit` to confirm no callsites left referencing `t.Technician`
6. Spot-check: query 5 random tickets, verify `Technicians` relation remains populated

## Acceptance Criteria

- [ ] No code path reads or writes `RepairTicket.Technician` anywhere in source tree
      (verify with `grep -rn "\.Technician\b" src/ scripts/`)
- [ ] `prisma db push` reports column dropped with no data warning
- [ ] `prisma db push --diff` shows no schema drift
- [ ] All existing tests pass + new regression test asserting column absence (introspection)
- [ ] `Current TechStack.md` updated — `RepairTicket` no longer lists `Technician`

## Boundaries

- Do NOT drop until ARC-14 has been live in production for ≥7 days with no rollback
- Do NOT drop the `TicketTechnician` table — it is the new system of record
- Do NOT touch JobCategory / SupplierName / WrongCategory (those are MON-11/12 deliverables, untouched here)

## Notes

- Pattern: this mirrors **Phase 0.5d** (User.Password drop after Phase 0.5 password
  hashing migration) — established Commander preference for staged drops
- Observation gates worth checking before dropping:
  - Vercel logs: zero "Technician" undefined / null TypeError
  - DB: `SELECT COUNT(*) FROM "RepairTicket" WHERE "Technician" IS NOT NULL AND id NOT IN (SELECT "TicketID" FROM "TicketTechnician");` returns 0 (no rows present in legacy without join-table backing)
  - User reports: zero complaints about missing technician assignments
- Estimated work: ≤30 min (the hard part was MON-13; this is just the cleanup)
