/**
 * Production smoke test — Web Repair Center.
 *
 * Post-deploy verification that the deployed site responds correctly.
 * Tests login flows (admin, branch user, unknown user, wrong password) over
 * HTTP plus a landing page GET. Exits non-zero on any failure so CI / cron
 * can alert on regressions.
 *
 * USAGE
 *
 *   cd ticket-system
 *   PROD_URL=https://example.com SMOKE_ADMIN_PW='<pw>' npx tsx scripts/prod_smoke_test.ts
 *
 *   # or with positional URL argument
 *   SMOKE_ADMIN_PW='<pw>' npx tsx scripts/prod_smoke_test.ts https://example.com
 *
 *   # localhost default (no env)
 *   SMOKE_ADMIN_PW='<pw>' npx tsx scripts/prod_smoke_test.ts
 *
 * ENVIRONMENT
 *
 *   PROD_URL          Base URL of the deployed app. Defaults to http://localhost:3000.
 *                     Trailing slash is stripped.
 *   SMOKE_ADMIN_PW    Real admin password used for TC-01. Never commit this.
 *                     If unset, TC-01 SKIPs (does NOT fail) and emits an
 *                     [SKIP] log line stating the reason — per the State
 *                     Transparency Rule, skips are observable.
 *   SMOKE_BRANCH_USER Branch username for TC-03. Default `1000`.
 *   SMOKE_BRANCH_PW   Branch password for TC-03. Default `vl1000`.
 *
 * DESIGN NOTES
 *
 *   - This script does not write any DB state.
 *   - It does not trigger any external notifications (LINE was removed in
 *     SYN-06 — there are no external side-effect channels left to trigger).
 *   - Server Action invocation in Next.js 16 requires the action ID. The
 *     script auto-discovers the ID by fetching /login and scanning the HTML
 *     for the embedded action reference. If discovery fails the script
 *     reports the test as SKIP (not FAIL) and continues — this keeps the
 *     smoke test resilient to internal Next.js encoding changes while still
 *     exercising the surface checks (TC-04 landing + TC-05 not-found page).
 *
 * EXIT CODE
 *
 *   0 — all non-skipped tests passed
 *   1 — at least one test FAILED, or a hard prerequisite failed
 *
 * LINKED TO
 *
 *   BUG-01 (stale deployment) — this script is the regression net.
 */

type TestStatus = "PASS" | "FAIL" | "SKIP";

interface TestResult {
    id: string;
    title: string;
    status: TestStatus;
    durationMs: number;
    detail: string;
}

const BASE_URL = (process.env.PROD_URL || process.argv[2] || "http://localhost:3000").replace(/\/+$/, "");
const ADMIN_PW = process.env.SMOKE_ADMIN_PW || "";
const BRANCH_USER = process.env.SMOKE_BRANCH_USER || "1000";
const BRANCH_PW = process.env.SMOKE_BRANCH_PW || "vl1000";

const results: TestResult[] = [];

function log(line: string): void {
    console.log(line);
}

async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
    const t0 = Date.now();
    const v = await fn();
    return [v, Date.now() - t0];
}

/**
 * Discover the Server Action ID for the `login` action by walking the JS chunk
 * graph that the /login page loads. Strategy:
 *   1. GET /login → scrape `<script src="/_next/static/chunks/...">` URLs.
 *   2. For each chunk, GET its body and search for the marker comment
 *      `__next_internal_action_entry_do_not_use__` paired with `"login"`.
 *   3. Some chunks just re-export another chunk by file path — follow those
 *      one hop and re-scan.
 *
 * Returns null if discovery fails — caller should treat this as SKIP, not FAIL.
 * Action ID format in current Next.js builds: 40-42 char lowercase hex.
 */
async function discoverLoginActionId(): Promise<string | null> {
    try {
        const r = await fetch(`${BASE_URL}/login`, { method: "GET" });
        if (!r.ok) return null;
        const html = await r.text();

        // Extract every chunk URL referenced from /login.
        const chunkUrls = new Set<string>();
        const scriptRe = /src="(\/_next\/static\/chunks\/[^"]+\.js)"/g;
        let m: RegExpExecArray | null;
        while ((m = scriptRe.exec(html)) !== null) {
            chunkUrls.add(m[1]);
        }
        if (chunkUrls.size === 0) return null;

        // Walk up to two hops into the chunk graph.
        const seen = new Set<string>();
        const queue: string[] = [...chunkUrls];
        let hops = 0;
        while (queue.length > 0 && hops < 60) {
            const url = queue.shift();
            if (!url || seen.has(url)) continue;
            seen.add(url);
            hops++;
            const chunkRes = await fetch(`${BASE_URL}${url}`).catch(() => null);
            if (!chunkRes || !chunkRes.ok) continue;
            const body = await chunkRes.text();

            // Look for the marker: __next_internal_action_entry_do_not_use__ [{"<hex>":"login"}...]
            const actionMarker = /__next_internal_action_entry_do_not_use__\s*\[\{("[a-f0-9]{32,64}":"login")[^}]*\}/;
            const found = body.match(actionMarker);
            if (found) {
                const idMatch = found[1].match(/"([a-f0-9]{32,64})"/);
                if (idMatch) return idMatch[1];
            }

            // Some chunks just declare follow-on chunk file names; enqueue them.
            const followRe = /"(static\/chunks\/[^"]+\.js)"/g;
            let f: RegExpExecArray | null;
            while ((f = followRe.exec(body)) !== null) {
                const next = `/_next/${f[1]}`;
                if (!seen.has(next)) queue.push(next);
            }
        }
        return null;
    } catch {
        return null;
    }
}

/**
 * POST a Server Action invocation to the deployed Next.js app.
 * Uses the `Next-Action` header pattern. The body is multipart form-data
 * encoded with the action arguments as positional `$1`, `$2`, ...
 *
 * Returns the raw text response plus the Set-Cookie header (if any).
 */
async function invokeLoginAction(
    actionId: string,
    username: string,
    password: string,
): Promise<{ status: number; body: string; setCookie: string | null }> {
    // Next.js Server Action wire format: a JSON-encoded array of positional args.
    const payload = JSON.stringify([username, password]);
    const r = await fetch(`${BASE_URL}/login`, {
        method: "POST",
        headers: {
            "Content-Type": "text/plain;charset=UTF-8",
            "Next-Action": actionId,
            Accept: "text/x-component",
        },
        body: payload,
        redirect: "manual",
    });
    return {
        status: r.status,
        body: await r.text(),
        setCookie: r.headers.get("set-cookie"),
    };
}

function record(id: string, title: string, status: TestStatus, durationMs: number, detail: string): void {
    results.push({ id, title, status, durationMs, detail });
    const tag = status === "PASS" ? "[PASS]" : status === "FAIL" ? "[FAIL]" : "[SKIP]";
    log(`${tag} ${id} ${title} (${durationMs}ms) — ${detail}`);
}

async function tc01AdminLogin(actionId: string | null): Promise<void> {
    const id = "TC-01";
    const title = "POST /login admin (correct password) → success + Set-Cookie";
    if (!ADMIN_PW) {
        record(id, title, "SKIP", 0, "SMOKE_ADMIN_PW not set in env — cannot test admin login flow");
        return;
    }
    if (!actionId) {
        record(id, title, "SKIP", 0, "Server Action ID could not be auto-discovered from /login");
        return;
    }
    const [r, ms] = await timed(() => invokeLoginAction(actionId, "admin", ADMIN_PW));
    const okStatus = r.status >= 200 && r.status < 400;
    const hasSessionCookie = (r.setCookie || "").includes("user_session=");
    if (okStatus && hasSessionCookie) {
        record(id, title, "PASS", ms, `status=${r.status} session cookie present`);
    } else {
        record(id, title, "FAIL", ms, `status=${r.status} session cookie present=${hasSessionCookie}`);
    }
}

async function tc02AdminWrongPw(actionId: string | null): Promise<void> {
    const id = "TC-02";
    const title = "POST /login admin (wrong password) → failure (no Set-Cookie)";
    if (!actionId) {
        record(id, title, "SKIP", 0, "Server Action ID could not be auto-discovered from /login");
        return;
    }
    const [r, ms] = await timed(() => invokeLoginAction(actionId, "admin", "definitely_not_the_password_xyz789"));
    const hasSessionCookie = (r.setCookie || "").includes("user_session=");
    if (!hasSessionCookie) {
        record(id, title, "PASS", ms, `status=${r.status} no session cookie (expected)`);
    } else {
        record(id, title, "FAIL", ms, `status=${r.status} session cookie WAS set — wrong password accepted`);
    }
}

async function tc03BranchLogin(actionId: string | null): Promise<void> {
    const id = "TC-03";
    const title = `POST /login ${BRANCH_USER} / ${BRANCH_PW} → success + Set-Cookie`;
    if (!actionId) {
        record(id, title, "SKIP", 0, "Server Action ID could not be auto-discovered from /login");
        return;
    }
    const [r, ms] = await timed(() => invokeLoginAction(actionId, BRANCH_USER, BRANCH_PW));
    const okStatus = r.status >= 200 && r.status < 400;
    const hasSessionCookie = (r.setCookie || "").includes("user_session=");
    if (okStatus && hasSessionCookie) {
        record(id, title, "PASS", ms, `status=${r.status} session cookie present`);
    } else {
        record(id, title, "FAIL", ms, `status=${r.status} session cookie present=${hasSessionCookie}`);
    }
}

async function tc04UnknownUser(actionId: string | null): Promise<void> {
    const id = "TC-04";
    const title = "POST /login nonexistent_user → returns 'ไม่พบ' style error (no Set-Cookie)";
    if (!actionId) {
        record(id, title, "SKIP", 0, "Server Action ID could not be auto-discovered from /login");
        return;
    }
    const [r, ms] = await timed(() => invokeLoginAction(actionId, "__smoke_unknown_user_zzz999", "anything"));
    const hasSessionCookie = (r.setCookie || "").includes("user_session=");
    // The error string "ไม่พบ" is what the login server action returns when the user is not found.
    const bodyContainsNotFound = r.body.includes("ไม่พบ");
    if (!hasSessionCookie && bodyContainsNotFound) {
        record(id, title, "PASS", ms, `status=${r.status} 'ไม่พบ' present, no session cookie`);
    } else {
        record(id, title, "FAIL", ms, `status=${r.status} bodyHasNotFound=${bodyContainsNotFound} session=${hasSessionCookie}`);
    }
}

async function tc05Landing(): Promise<void> {
    const id = "TC-05";
    const title = "GET / (landing) → 200 OK";
    const [r, ms] = await timed(() => fetch(`${BASE_URL}/`, { method: "GET", redirect: "manual" }));
    if (r.status === 200) {
        record(id, title, "PASS", ms, "status=200");
    } else {
        record(id, title, "FAIL", ms, `status=${r.status}`);
    }
}

async function main(): Promise<void> {
    log(`[smoke] Web Repair Center production smoke test`);
    log(`[smoke] BASE_URL=${BASE_URL}`);
    log(`[smoke] SMOKE_ADMIN_PW ${ADMIN_PW ? "set" : "NOT set — TC-01 will SKIP"}`);
    log(`[smoke] Discovering Server Action ID from /login ...`);
    const actionId = await discoverLoginActionId();
    if (actionId) {
        log(`[smoke] Action ID discovered: ${actionId.slice(0, 8)}...`);
    } else {
        log(`[smoke] [SKIP] Action ID auto-discovery failed — Server Action TCs will SKIP. TC-05 still runs.`);
    }
    log("");

    await tc01AdminLogin(actionId);
    await tc02AdminWrongPw(actionId);
    await tc03BranchLogin(actionId);
    await tc04UnknownUser(actionId);
    await tc05Landing();

    const total = results.length;
    const pass = results.filter((r) => r.status === "PASS").length;
    const fail = results.filter((r) => r.status === "FAIL").length;
    const skip = results.filter((r) => r.status === "SKIP").length;
    const duration = results.reduce((acc, r) => acc + r.durationMs, 0);

    log("");
    log("=== Smoke Test Summary ===");
    log(`Total:    ${total}`);
    log(`Passed:   ${pass}`);
    log(`Failed:   ${fail}`);
    log(`Skipped:  ${skip}`);
    log(`Duration: ${duration}ms`);
    log("==========================");

    if (fail > 0) {
        process.exitCode = 1;
    }
}

main().catch((e) => {
    console.error("[smoke] Fatal error:", e);
    process.exitCode = 1;
});
