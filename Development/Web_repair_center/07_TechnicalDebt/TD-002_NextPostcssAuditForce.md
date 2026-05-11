# TD-002 — Remaining npm audit vulnerabilities require `next` bump

**Filed by:** Syndicate (AX/WT)
**Date:** 11-05-2026
**Origin ticket:** SYN-05 — npm audit fix (Phase 1)
**Severity:** 1 high (next) + 1 moderate (postcss)
**Status:** RESOLVED 11-05-2026 (SYN-07, Phase 2A) — `npm audit fix --force` applied, Next.js bumped 16.1.6 → 16.2.6, build + tsc + 7 routes verified PASS. 2 postcss-chain moderates remain (further fix would downgrade Next.js to 9.x — refused). High CSRF-bypass vuln (GHSA-mq59-m269-xvcx) directly relevant to SYN-10 audit — now patched.

## Summary

`npm audit fix` (no `--force`) resolved 3 of 5 vulnerabilities in `ticket-system/`:

| Stage | Total | Moderate | High | Critical |
|-------|-------|----------|------|----------|
| Baseline (start of Phase 1) | 7 | 3 | 4 | 0 |
| After SYN-06 (LINE removed)  | 5 | 2 | 3 | 0 |
| After SYN-05 (audit fix)     | **2** | **1** | **1** | **0** |

The remaining 2 issues are all bundled with `next` and `postcss` (transitive of `next`). The fix npm proposes (`npm audit fix --force`) bumps `next` from `16.1.6` to `16.2.6`, which is **outside the stated dependency range**:

```
package.json (current):
  "next": "16.1.6"
```

Per SYN-05 ticket directive:

> ถ้าต้อง `--force` (breaking change) → STOP + ขออนุญาต Commander ก่อน

Halting and surfacing this for Commander decision rather than auto-applying the breaking change.

## Outstanding advisories

| Package | Severity | Advisory |
|---------|----------|----------|
| next | high | GHSA-ggv3-7p47-pfv8 — HTTP request smuggling in rewrites |
| next | high | GHSA-3x4c-7xq6-9pq8 — Unbounded next/image disk cache growth |
| next | high | GHSA-h27x-g6w4-24gq — Unbounded postponed resume buffering DoS |
| next | high | GHSA-mq59-m269-xvcx — null origin Server Actions CSRF bypass |
| next | high | GHSA-jcc7-9wpm-mj36 — null origin dev HMR websocket CSRF bypass |
| next | high | GHSA-q4gf-8mx6-v5v3 — DoS with Server Components |
| postcss | moderate | GHSA-qx2v-qp2m-jg93 — XSS via Unescaped `</style>` in Stringify output |

Severity is rolled up into 1 high (next) + 1 moderate (postcss). The high advisories listed above are all subsumed under the same `next` package row.

## Risk assessment (current production exposure)

| Advisory | Practical exposure in this app | Notes |
|----------|-------------------------------|-------|
| HTTP request smuggling in rewrites | LOW — no rewrites configured in `next.config.ts` | Verify `next.config.ts` has no rewrites/redirects |
| next/image disk cache growth | LOW — app uses `/api/proxy-image`, not `next/image` directly | Custom proxy route bypasses next image cache |
| Postponed resume buffering DoS | LOW — no Partial Prerendering in active routes | |
| Server Actions CSRF (null origin) | MEDIUM — auth login uses Server Action | Cookie httpOnly + Origin header normally present from browsers; risk is from non-browser clients with crafted null Origin |
| Dev HMR CSRF | NONE in prod — dev only | Not a production exposure |
| Server Components DoS | LOW — app render scope limited | |
| postcss XSS in Stringify | NONE — CSS not user-controlled | postcss runs at build time, not on user input |

**Net assessment:** The most relevant exposure is the Server Action CSRF (login). Mitigation: existing httpOnly cookie + same-site default reduces practical attack surface. Still, bumping `next` to 16.2.6 is the right action — just needs Commander sign-off on the breaking range bump.

## Recommended action (for Commander)

**Option A — Approve `npm audit fix --force`:**
- Bumps `next` to `16.2.6` (patch + minor changes within 16.x line — semver compatible)
- Update `package.json` `"next": "16.2.6"` to match installed version
- Re-run full smoke test + UX walkthrough
- Re-deploy to Vercel
- Recommended.

**Option B — Hold and monitor:**
- Accept current exposure with documented mitigations
- Re-evaluate when `next 16.2.x` becomes a stated dependency upgrade in a future ticket
- Acceptable short-term given the LOW practical exposure of most advisories, but the Server Action CSRF advisory is non-trivial.

## Build state at TD filing

- `npx next build` PASS, 6 user-facing routes intact (no `/api/webhook`).
- `npx tsc --noEmit` clean.
- `npm audit`: 2 vulnerabilities remain (documented above).
- No `--force` was used in SYN-05.

## Sign-off required

- [ ] Commander ท่านผู้บัญชาการ
