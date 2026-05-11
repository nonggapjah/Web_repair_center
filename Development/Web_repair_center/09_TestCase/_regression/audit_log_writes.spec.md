# Regression — Audit Log Writes (SYN-11)

**Phase:** 2A — Security Hardening
**Filed by:** Syndicate (AX/WT)
**Date:** 11-05-2026
**Related Ticket:** SYN-11
**Source under test:**
- `ticket-system/src/lib/audit.ts` — `logAudit()`, `safeStringify()`
- `ticket-system/src/app/actions/tickets.ts` — call sites: `updateTicketStatus()`, `addTicketComment()`, `markAllNotificationsRead()`
**DB table touched:** `AuditLog` (MON-10)

## Purpose
Lock in the SYN-11 audit pipeline:
- 3+ admin/state-changing actions write to `AuditLog` on success.
- `logAudit()` is fail-soft — a DB error inside the audit write MUST NOT throw, MUST NOT rollback the main action, MUST emit `[audit] failed to write log entry` on the server log.
- Before/After snapshots reflect the actual row state (sanitized — no signatures, no plaintext passwords).
- Existing return shapes of audited actions are unchanged.

## Test Cases

| TC | Action | Expected | Pass Criterion |
|----|--------|----------|----------------|
| TC-01 | Admin calls `updateTicketStatus(t1, "InProgress", "...", "ช่างยศ")` on a ticket currently `Open` with `Technician=null` | `RepairTicket.CurrentStatus` → `"InProgress"`, `TicketHistory` row appended, `Notification` row created, **AND** new `AuditLog` row with `Action="ticket.status.update"`, `EntityType="RepairTicket"`, `EntityID=t1`, `Before` JSON contains `{"CurrentStatus":"Open","Technician":null,...}`, `After` JSON contains `{"CurrentStatus":"InProgress","Technician":"ช่างยศ",...}`, `UserID` matches the admin session | All assertions pass |
| TC-02 | Admin posts a comment on ticket t1 with message "ผมเช็คแล้วครับ" | `TicketComment` row created **AND** `AuditLog` row with `Action="ticket.comment.add"`, `EntityType="RepairTicket"`, `EntityID=t1`, `After` JSON contains `messagePreview` + `hasImage:false`, `UserID` matches caller | All assertions pass |
| TC-03 | Admin calls `markAllNotificationsRead(null, "Admin")` when there are 5 Admin notifications | All 5 `Notification` rows deleted **AND** `AuditLog` row with `Action="notification.bulkClear"`, `Before.count=5`, `After.count=0`, `EntityID="Admin:*"` | All assertions pass |
| TC-04 | logAudit fail-soft — temporarily rename `AuditLog` table (or drop write permission), then call `updateTicketStatus` | Main action returns `{ success: true }`, `RepairTicket.CurrentStatus` is updated, `console.error('[audit] failed to write log entry', ...)` appears in server logs, NO exception bubbles to the client | Main flow uninterrupted |
| TC-05 | safeStringify handles circular ref — pass a Before/After value containing a circular reference (cannot happen via normal call paths; force via direct logAudit invocation) | `AuditLog` row is created with `Before` or `After` set to `null`, `console.error('[audit] failed to stringify snapshot', ...)` logged | safeStringify returns null on JSON failure |
| TC-06 | logAudit signature & boundary — never throws | Inspect: `logAudit()` has try/catch wrapping the entire body; no `throw` statements outside the catch | Static check |
| TC-07 | Sensitive fields not captured — inspect Before/After snapshots in all 3 call sites | No `Password`, no `PasswordHash`, no `AdminSignature`, no `UserSignature` strings appear in any Before/After payload | Manual code review |
| TC-08 | Return shapes preserved — `updateTicketStatus`, `addTicketComment`, `markAllNotificationsRead` return the same `{success: …}` envelope as before SYN-11 | Existing UI callers (admin dashboard, technician dashboard) compile without change | `tsc --noEmit` clean |
| TC-09 | Action names follow dotted convention — `ticket.status.update`, `ticket.comment.add`, `notification.bulkClear` | grep `Action: "` in `tickets.ts` returns 3 dotted-lower-case names | Naming consistency for future read UI (Phase 2D) |
| TC-10 | UserID populated from session for state mutations | TC-01 and TC-03 audit rows have `UserID = session.userId`; TC-02 uses the resolved `actualUserId` from the comment flow | Verified via Supabase SQL after each test |

## Manual Sanity Run (against `npm run dev` + real Supabase)

```
# Setup
1. Log in as admin → /admin/dashboard

# TC-01
2. Pick an Open ticket → assign technician + change status to InProgress
3. SELECT * FROM "AuditLog" WHERE "Action" = 'ticket.status.update' ORDER BY "Timestamp" DESC LIMIT 1;
   → confirm UserID, EntityID, Before, After fields

# TC-02
4. Open ticket detail → post a comment as admin
5. SELECT * FROM "AuditLog" WHERE "Action" = 'ticket.comment.add' ORDER BY "Timestamp" DESC LIMIT 1;

# TC-03
6. Click "ล้างทั้งหมด" on Admin notification panel
7. SELECT * FROM "AuditLog" WHERE "Action" = 'notification.bulkClear' ORDER BY "Timestamp" DESC LIMIT 1;

# TC-04 (fail-soft)
8. In Supabase SQL: ALTER TABLE "AuditLog" RENAME TO "AuditLog_disabled";
9. Trigger TC-01 again → main action still succeeds, server console shows [audit] failed to write log entry
10. ALTER TABLE "AuditLog_disabled" RENAME TO "AuditLog"; -- restore
```

## Acceptance
PASS = TC-01 through TC-10 all green. TC-04 (fail-soft) is the most important regression — protects the user from audit infrastructure regressions cascading into the main flow.

## Notes
- SYN-11 does NOT add a read UI for `AuditLog` — that is Phase 2D scope. Verification uses direct Supabase SQL.
- `logAudit()` is intentionally async-fire-and-await (not fire-and-forget). The `try/catch` guarantees no propagation, but awaiting ensures ordering in case future call sites depend on it. Performance cost: ~1 extra DB roundtrip per audited mutation, acceptable per ticket Performance Note.
- The `revalidatePath` import in `tickets.ts` was already unused before SYN-11 — out of scope to remove. Filed as a cleanup observation for a future maintenance ticket.
