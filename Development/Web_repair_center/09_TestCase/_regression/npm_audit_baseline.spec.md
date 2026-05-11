# Regression Test — npm audit baseline must not regress

**Source ticket:** SYN-05 (Phase 1)
**Date added:** 11-05-2026
**Permanent:** YES — never delete (Hotfix Regression Gate)

## Why this test exists

SYN-05 reduced `ticket-system/` vulnerability count from 7 to 2 by running
`npm audit fix` (no `--force`). The two remaining vulnerabilities are
documented in `07_TechnicalDebt/TD-002_NextPostcssAuditForce.md` and
require Commander approval to bump `next` to 16.2.6 (outside stated range).

This regression test guarantees the audit floor does not climb back.

## Test Cases

### TC-AUDIT-01 — Zero CRITICAL advisories
**Action:**
```
cd ticket-system && npm audit --audit-level=critical
```
**Expected:** Exit 0 — no critical vulnerabilities.
**Failure mode:** Critical advisory introduced — investigate and patch immediately.

### TC-AUDIT-02 — High vulnerability count must not exceed 1
**Action:**
```
cd ticket-system && npm audit --json | jq '.metadata.vulnerabilities.high'
```
**Expected:** `1` (the documented `next` advisory) or `0` if the Commander-approved force-fix has been applied.
**Failure mode:** > 1 = a new high-severity issue surfaced. Investigate.

### TC-AUDIT-03 — Moderate vulnerability count must not exceed 1
**Action:**
```
cd ticket-system && npm audit --json | jq '.metadata.vulnerabilities.moderate'
```
**Expected:** `1` (the documented `postcss` advisory) or `0` if force-fix applied.
**Failure mode:** > 1 = a new moderate issue. Investigate.

### TC-AUDIT-04 — `npm audit fix` must not require `--force` for new fixes
**Action:**
```
cd ticket-system && npm audit fix --dry-run 2>&1 | grep -i "audit fix --force"
```
**Expected:** Either no output (clean), or only references to the documented `next`/`postcss` advisories.
**Failure mode:** A new advisory demanding `--force` = breaking-range bump required, refer to Commander.

### TC-AUDIT-05 — Build must remain green
**Action:**
```
cd ticket-system && npx next build
```
**Expected:** Build succeeds, all 6 user-facing routes + `/_not-found` listed. No `/api/webhook`.
**Failure mode:** Build broken after dependency change — revert and investigate.

## Manual sign-off

| Date | Tester | Result | Notes |
|------|--------|--------|-------|
| 11-05-2026 | Syndicate (WT) | PASS | Vuln count 7 → 5 (LINE removed) → 2 (audit fix). `next build` PASS. Remaining 2 vulns documented in TD-002 awaiting Commander approval. |
