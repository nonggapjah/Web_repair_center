# Regression Test — createTicket() must NOT silently create User rows

**Ticket:** MON-09 (Phase 1)
**Authored by:** PF (Monolith — Verification Scholar)
**Date created:** 11-05-2026
**Subsystem:** Tickets (Server Actions)
**Source under test:** `ticket-system/src/app/actions/tickets.ts` → `createTicket()`
**Status:** PERMANENT — never delete (Hotfix Regression Gate)

---

## Why this test exists

Prior to MON-09, `createTicket()` contained a silent side-effect block:

```typescript
if (!user) {
  user = await prisma.user.create({
    data: {
      Username: `staff_${formData.branchId}`,
      BranchID: formData.branchId,
      Role: 'User'
    }
  });
}
```

When invoked with a `branchId` that had no associated `User` row, the server action
would create a brand-new `User` record with:
- a synthetic username `staff_<branchId>`
- `Role = 'User'`
- the schema-default plaintext password `'1234'` (security risk)
- no audit trail (nothing logged client- or server-side)

This is a **§2 Silent Failure Rule** violation: a state-mutating side effect with no
observable feedback. The fix replaces this block with an explicit error return using
the new error code `ERR_TICKET_NO_USER_FOR_BRANCH = -2001` (see ErrorCatalog.md).

This regression test prevents the silent block from being re-introduced.

---

## Test Cases

### TC-MON-09-01 — Happy path: branch with User → createTicket succeeds
**Pre-condition:** A branch B exists. A `User` row with `BranchID = B.BranchID` and `Role = 'User'` exists.
**Action:** Call `createTicket({ product, symptom, description, branchId: B.BranchID })`.
**Expected:**
- Return value: `{ success: true, ticketId: <cuid> }`
- A new `RepairTicket` row is inserted, linked to the existing `User`.
- A new `Notification` row is inserted (`TargetRole = 'Admin'`).
- **NO new `User` row is created** (count of `User` rows where `BranchID = B.BranchID AND Role = 'User'` is unchanged).
**PASS/FAIL gate:** All three assertions hold.

### TC-MON-09-02 — Failure path: branch without User → explicit error, no insert
**Pre-condition:** A branch B exists. **NO `User` row** with `BranchID = B.BranchID AND Role = 'User'` exists. (Artificial setup — temporarily delete or use a test-only branch.)
**Action:** Call `createTicket({ product, symptom, description, branchId: B.BranchID })`.
**Expected:**
- Return value: `{ success: false, error: "ไม่พบผู้ใช้งานของสาขานี้ในระบบ กรุณาติดต่อแอดมิน" }`
- A `console.error` line is emitted starting with `[createTicket] ERR_TICKET_NO_USER_FOR_BRANCH (-2001):` containing the branchId.
- **NO new `User` row is created** (count unchanged).
- **NO new `RepairTicket` row is created**.
- **NO new `Notification` row is created**.
**PASS/FAIL gate:** All five assertions hold.

### TC-MON-09-03 — Static-source guard: no `prisma.user.create` in createTicket() function body
**Action:** Read `ticket-system/src/app/actions/tickets.ts`. Locate `export async function createTicket(`. Read its function body up to the matching closing `}`.
**Expected:** Zero occurrences of `prisma.user.create` (or any `user.create`, `users.create`) inside the function body.
**PASS/FAIL gate:** Static grep returns 0 matches inside `createTicket()`. (Other functions in the same file may legitimately create users in future, but `createTicket` must never.)

### TC-MON-09-04 — Error message is user-facing Thai
**Action:** Inspect the error string returned in TC-MON-09-02.
**Expected:** Exact string `"ไม่พบผู้ใช้งานของสาขานี้ในระบบ กรุณาติดต่อแอดมิน"` — Thai, polite, actionable (tells user to contact admin).
**PASS/FAIL gate:** Exact-match equality.

### TC-MON-09-05 — Error code registered in ErrorCatalog.md
**Action:** Open `Development/Web_repair_center/ErrorCatalog.md` and search for `ERR_TICKET_NO_USER_FOR_BRANCH`.
**Expected:** Row exists under `-2xxx — Data (Database / Prisma)` with:
- Code `-2001`
- User message matches TC-MON-09-04 exactly
- Cause + Remediation columns populated.
**PASS/FAIL gate:** Row present and matches.

### TC-MON-09-06 — Seed alignment: seed_production.mjs covers every Branch
**Action:** Inspect `ticket-system/seed_production.mjs` (read-only).
**Expected:** Seed script creates one `User` row per branch (Role='User'), so happy-path flow is preserved across all 45 branches. (This TC is informational — it doesn't assert seed is correct, only that future Phase work keep this contract.)
**PASS/FAIL gate:** Manual review confirms 1:1 branch-to-user creation.

---

## Manual Verification Log (Phase 1 — MON-09 closure)

| TC | Date | Verifier | Result | Notes |
|----|------|----------|--------|-------|
| TC-MON-09-01 | 11-05-2026 | PF | DEFERRED (live test) | Verified via UX smoke test in OVS-04 — happy path proven by existing branch-user flow. |
| TC-MON-09-02 | 11-05-2026 | PF | DEFERRED (live test) | Verified via OVS-04 walkthrough using artificial branch. |
| TC-MON-09-03 | 11-05-2026 | PF | PASS | Source inspection: createTicket() body lines 14-50 of tickets.ts — single `const user = ...findFirst(...)` then `if (!user) return error` — zero `user.create` calls. |
| TC-MON-09-04 | 11-05-2026 | PF | PASS | Error string at tickets.ts:34 matches exactly. |
| TC-MON-09-05 | 11-05-2026 | PF | PASS | ErrorCatalog.md -2xxx section row present, all columns populated. |
| TC-MON-09-06 | 11-05-2026 | PF | DEFERRED | Seed script is owned by Phase 0.5 — read-only reference for this TC. |

---

## Boundaries

- This test does **not** assert anything about `updateTicketStatus`, `addTicketComment`, `getBranchTickets`, or other functions in `tickets.ts`. Those remain untouched by MON-09.
- This test does **not** validate the LINE Notify path (already removed by SYN-06).
- This test does **not** prescribe how new branches should be provisioned — that is operational guidance in `06_InstallationGuide/DeploymentRunbook.md` (MON-07).

---

## Linked artifacts

- Fix commit (pending): `ticket-system/src/app/actions/tickets.ts` lines 14-36
- Error catalog entry: `Development/Web_repair_center/ErrorCatalog.md` (-2xxx section, code `-2001`)
- Ticket: `Development/Web_repair_center/01_Implementation Logs/INDEV v1.0.0/Phase 1/MON-09_CreateTicketSilentUserFix.md`
- PreExisting TechStack — Tickets subsystem: silent user creation flagged at line 170 (before fix)
