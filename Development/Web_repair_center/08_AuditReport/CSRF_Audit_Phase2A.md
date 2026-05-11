# CSRF Audit — Phase 2A

**Project:** Web_repair_center
**Phase:** 2A — Security Hardening
**Date:** 11-05-2026
**Auditor:** Syndicate (WT/AX)
**Ticket:** SYN-10
**Status:** Initial baseline — living document, append on subsequent security reviews

---

## 1. Executive Summary

| Aspect | Posture | Evidence |
|--------|---------|----------|
| Session cookie cross-site flow | **Hardened (Lax)** | `auth.ts:69` adds `sameSite: "lax"` (SYN-10) |
| State-mutating endpoints | **All Server Actions** | 100% of mutations routed through Next.js Server Actions (`"use server"` directive at top of `auth.ts` + `tickets.ts`) |
| Custom REST routes with side effects | **None** | Only custom route is `/api/proxy-image/route.ts` — read-only GET, no DB writes, no session mutation |
| Built-in CSRF (Next.js 16 Server Actions) | **Active** | Action IDs are signed + opaque; Next 16.2.6 enforces Origin/Host header check on POST |
| Cookie flags | `HttpOnly` + `Secure` (prod) + `Path=/` + `SameSite=Lax` | `auth.ts:69-75` |
| Overall residual CSRF risk | **Low** | See findings — no GET-mutates, no token-less POSTs, no SameSite=None |

---

## 2. Server Actions Audit

All state-changing operations live in two `"use server"` modules. Next.js Server Actions are POST-only, carry a per-build signed action ID, and Next 16 rejects requests when the `Origin` header does not match the deployment host (built-in CSRF defense). No bespoke CSRF token middleware is required for this surface.

### 2.1 `src/app/actions/auth.ts`

| Function | Type | State Change | Session-aware | CSRF Coverage |
|----------|------|--------------|---------------|---------------|
| `login(username, password?)` | Server Action | sets `user_session` cookie; lazy-rehashes plaintext password | sets session | Built-in (signed action ID + Origin) + new `SameSite=Lax` |
| `logout()` | Server Action | deletes `user_session` cookie | clears session | Built-in (signed action ID + Origin) |
| `getSession()` | Server Action | none (read-only) | reads session | Read-only; CSRF n/a |

Verdict: PASS. Module starts with `"use server"` on line 1 — every export is forced through the Next.js action runtime.

### 2.2 `src/app/actions/tickets.ts`

| Function | Type | State Change | CSRF Coverage |
|----------|------|--------------|---------------|
| `createTicket(formData)` | Server Action | INSERT `RepairTicket` + `Notification` | Built-in |
| `getBranchTickets(branchId)` | Server Action | read-only (`noStore()`) | n/a (no mutation) |
| `getTechnicianTickets(name)` | Server Action | read-only | n/a |
| `getAllTickets()` | Server Action | read-only | n/a |
| `updateTicketStatus(...)` | Server Action | UPDATE `RepairTicket` + INSERT `TicketHistory` + INSERT `Notification` | Built-in |
| `addTicketComment(...)` | Server Action | INSERT `TicketComment` + `Notification` | Built-in |
| `getUserNotifications(...)` | Server Action | read-only | n/a |
| `markNotificationRead(notifId)` | Server Action | UPDATE `Notification.IsRead` | Built-in |
| `markAllNotificationsAsViewed(...)` | Server Action | UPDATE many `Notification.IsRead` | Built-in |
| `markAllNotificationsRead(...)` | Server Action | DELETE many `Notification` | Built-in |

Verdict: PASS. All 6 mutating exports flow through the Server Action pipeline.

### 2.3 Server Action authorization gap (out-of-scope flag)

CSRF defense (proving the request came from our origin) is in place. Server Actions in this codebase do **not** yet verify the caller's role inside the action body — `updateTicketStatus()` will execute its mutation regardless of which authenticated role calls it. This is **authorization**, not CSRF, and is therefore explicitly out of scope for SYN-10. Recommend follow-up ticket in Phase 2B Operations to add role gates inside each admin/technician-only action.

---

## 3. Custom REST Route Audit

### 3.1 `src/app/api/proxy-image/route.ts`

| Aspect | Detail |
|--------|--------|
| HTTP methods exported | `GET` only (no `POST/PUT/PATCH/DELETE`) |
| State mutation | **None** — pure passthrough fetch of an external URL |
| Cookie/session read | **None** — does not read `user_session` |
| User-controlled input | `?url=` query string |
| Output | Streams the upstream image bytes |
| CSRF relevance | **n/a — GET-only, idempotent, session-independent** |

A CSRF attack against a route that performs no state change against the authenticated user is not a CSRF concern (it is at worst an SSRF concern — flagged below as a separate audit item).

### 3.2 SSRF advisory (flagged for a separate ticket — not in SYN-10 scope)

The proxy-image GET fetches an arbitrary attacker-supplied URL with no allow-list, no scheme check, no private-IP guard. A user (or any unauthenticated caller — the route does not check session) can ask the server to issue a GET to `http://169.254.169.254/`, `http://localhost:5432/`, or internal Supabase URLs. Risk depends on what the server can reach from the deployment network.

Mitigation suggestion (for follow-up ticket, not SYN-10):
- restrict to `https://` only
- allow-list known image hosts (Supabase Storage, LINE CDN — though LINE removed in Phase 1)
- short-circuit `127.0.0.1`, `localhost`, `169.254.0.0/16`, RFC1918 ranges

This is filed here as an **observation**, not a fix. SYN-10 scope is CSRF posture, and CSRF posture for this route is fine.

---

## 4. Cookie Configuration — Before / After SYN-10

### Before
```ts
cookieStore.set("user_session", sessionData, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24,
    path: "/"
});
```
Note: with `sameSite` not explicit, Chromium defaults to `Lax` for first-party cookies, but Safari and Firefox have historically had inconsistent defaults. Explicit `Lax` removes browser-default ambiguity.

### After (SYN-10 + SYN-09)
```ts
cookieStore.set("user_session", sessionData, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: getSessionTimeoutForRole(user.Role),
    path: "/"
});
```

| Flag | Value | Justification |
|------|-------|---------------|
| `httpOnly: true` | unchanged | blocks JS read (XSS-stolen-session resistance) |
| `secure: prod` | unchanged | prevents plaintext transmission outside localhost dev |
| `sameSite: "lax"` | **new (SYN-10)** | blocks cross-site POST/PUT/DELETE; allows top-level GET navigation (preserves deep-link UX for branch users) |
| `maxAge` | role-driven (SYN-09) | Admin 4h / Tech 8h / User 24h with env override |
| `path: "/"` | unchanged | cookie scope unchanged |

### Decision rationale — Lax not Strict

`SameSite=Strict` would block the cookie on any cross-site top-level navigation — meaning if an admin opens the dashboard from an email link, a chat message, or any external page, they would be silently logged out and forced to re-authenticate. For a small ticket system with no observed sensitive GET-mutates, `Lax` provides full CSRF protection on the POST surface (where all mutations live) while keeping branch-user link-clicking workflows intact.

---

## 5. Findings

| ID | Severity | Finding | Action |
|----|----------|---------|--------|
| F-01 | Resolved (SYN-10) | Session cookie did not set `sameSite` explicitly | `sameSite: "lax"` added in `auth.ts:73` |
| F-02 | Informational | No GET-mutates in any route — all state changes are POST Server Actions | None — confirms CSRF surface is bounded |
| F-03 | Out of scope (Phase 2B) | Server Actions do not verify caller role inside the function body — relies on UI gating only | File follow-up ticket: "Role gate in mutating Server Actions" |
| F-04 | Out of scope (Phase 2B) | `/api/proxy-image` accepts any URL with no allow-list (SSRF, not CSRF) | File follow-up ticket: "Proxy image SSRF allow-list" |
| F-05 | Informational | Lazy plaintext→bcrypt rehash in `login()` writes inside the action — re-evaluate post-Phase 2D when Password column is dropped | None this phase |

---

## 6. Verification Steps Performed

1. Grep `"use server"` across `src/` — confirmed only `auth.ts` and `tickets.ts` declare it. No stray server actions in components.
2. Glob `src/app/api/**/route.ts` — only `proxy-image/route.ts` exists.
3. `export async function` count in `actions/` = 13. Each catalogued in §2.
4. Cookie shape inspected before/after edit. `httpOnly`, `secure`, `path` unchanged.
5. `npx tsc --noEmit` — clean.
6. `npx next build` — PASS, 7 routes preserved.

---

## 7. Sign-Off

| Role | Name | Verdict | Date |
|------|------|---------|------|
| Technologist | AX (Axon, Syndicate) | PASS | 11-05-2026 |
| Verification Scholar | WT (Watcher, Syndicate) | PASS — zero CSRF vulnerabilities found in current surface; SSRF and authorization gaps deferred to Phase 2B with explicit follow-up tickets recommended | 11-05-2026 |

---

## 8. Follow-ups Filed

- (Recommend) Phase 2B ticket: server-action role gate — every mutating action verifies caller role from `getSession()` matches the action's required role.
- (Recommend) Phase 2B ticket: proxy-image SSRF allow-list — restrict outbound fetch targets.

## 9. Audit Trail

| Date | Change | By |
|------|--------|----|
| 11-05-2026 | Initial baseline at Phase 2A — SYN-10 | WT (Syndicate) |
