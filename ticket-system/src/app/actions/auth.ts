"use server";
import { prisma } from "@/lib/prisma";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";

const BCRYPT_SALT_ROUNDS = 10;

// SYN-08 (11-05-2026): brute-force rate limit on login.
// Defaults loose enough that legitimate users do not hit the cap.
// Storage: FailedLoginAttempt table (MON-10). Composite index [Username, AttemptedAt]
// makes the windowed COUNT cheap.
const RATE_LIMIT_DEFAULTS = {
    MAX_ATTEMPTS: 10,
    WINDOW_MIN: 15,
    LOCKOUT_MIN: 15
} as const;

function rateLimitConfig() {
    const num = (k: string, d: number) => {
        const raw = process.env[k];
        const p = raw ? parseInt(raw, 10) : NaN;
        return Number.isFinite(p) && p > 0 ? p : d;
    };
    return {
        maxAttempts: num("RATE_LIMIT_MAX_ATTEMPTS", RATE_LIMIT_DEFAULTS.MAX_ATTEMPTS),
        windowMin:   num("RATE_LIMIT_WINDOW_MIN",   RATE_LIMIT_DEFAULTS.WINDOW_MIN),
        lockoutMin:  num("RATE_LIMIT_LOCKOUT_MIN",  RATE_LIMIT_DEFAULTS.LOCKOUT_MIN)
    };
}

// Returns null if request may proceed; otherwise returns the user-facing lockout error.
async function checkRateLimit(username: string): Promise<{ locked: true; error: string } | null> {
    const { maxAttempts, windowMin, lockoutMin } = rateLimitConfig();
    const windowStart = new Date(Date.now() - windowMin * 60_000);
    const recent = await prisma.failedLoginAttempt.findMany({
        where: { Username: username, AttemptedAt: { gte: windowStart } },
        orderBy: { AttemptedAt: "desc" },
        take: maxAttempts
    });
    if (recent.length < maxAttempts) return null;
    const latest = recent[0].AttemptedAt.getTime();
    const lockoutEnds = latest + lockoutMin * 60_000;
    if (Date.now() >= lockoutEnds) return null; // lockout window elapsed since last fail
    const minutesRemaining = Math.max(1, Math.ceil((lockoutEnds - Date.now()) / 60_000));
    // ERR_AUTH_RATE_LIMITED = -1010 (see ErrorCatalog.md)
    return {
        locked: true,
        error: `ลองเข้าระบบล้มเหลวหลายครั้งเกินไป กรุณารอ ${minutesRemaining} นาที`
    };
}

async function recordFailedAttempt(username: string): Promise<void> {
    try {
        await prisma.failedLoginAttempt.create({ data: { Username: username } });
    } catch (e) {
        // Never break login UX because the rate-limit ledger could not be written.
        // State Transparency Rule — emit a reason; do not silently no-op.
        console.error(`[AUTH] failed to record FailedLoginAttempt for ${username}:`, e);
    }
}

async function clearFailedAttempts(username: string): Promise<void> {
    try {
        await prisma.failedLoginAttempt.deleteMany({ where: { Username: username } });
    } catch (e) {
        console.error(`[AUTH] failed to clear FailedLoginAttempt for ${username}:`, e);
    }
}

// SYN-09 (11-05-2026): role-based session timeout.
// Defaults conservative — Admin shortest (privilege), User longest (flow UX).
// Env override allows ops tuning without redeploy.
const SESSION_TIMEOUT_DEFAULTS = {
    Admin: 60 * 60 * 4,        // 4 hours
    Technician: 60 * 60 * 8,   // 8 hours
    User: 60 * 60 * 24         // 24 hours (preserves prior behavior)
} as const;

function getSessionTimeoutForRole(role: string): number {
    const envKey =
        role === "Admin" ? "SESSION_TIMEOUT_ADMIN_SEC"
        : role === "Technician" ? "SESSION_TIMEOUT_TECHNICIAN_SEC"
        : "SESSION_TIMEOUT_USER_SEC";
    const raw = process.env[envKey];
    const parsed = raw ? parseInt(raw, 10) : NaN;
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
    return SESSION_TIMEOUT_DEFAULTS[role as keyof typeof SESSION_TIMEOUT_DEFAULTS]
        ?? SESSION_TIMEOUT_DEFAULTS.User;
}

export async function login(username: string, password?: string) {
    try {
        // SYN-08: rate-limit gate — runs BEFORE user lookup so that account
        // enumeration via timing or per-user lockout signals stays bounded.
        const limited = await checkRateLimit(username);
        if (limited) return { success: false, error: limited.error };

        const user = await prisma.user.findFirst({
            where: { Username: username },
            include: { Branch: true }
        });

        if (!user) {
            await recordFailedAttempt(username);
            return { success: false, error: "ไม่พบชื่อผู้ใช้งานนี้ในระบบ" };
        }

        if (!password) {
            await recordFailedAttempt(username);
            return { success: false, error: "รหัสผ่านไม่ถูกต้อง" };
        }

        const u = user as typeof user & { Password: string; PasswordHash: string | null };

        if (u.PasswordHash) {
            const ok = await bcrypt.compare(password, u.PasswordHash);
            if (!ok) {
                await recordFailedAttempt(username);
                return { success: false, error: "รหัสผ่านไม่ถูกต้อง" };
            }
        } else {
            if (u.Password !== password) {
                await recordFailedAttempt(username);
                return { success: false, error: "รหัสผ่านไม่ถูกต้อง" };
            }
            // Lazy migration: hash this plaintext password and persist for next login
            try {
                const hash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
                await prisma.user.update({
                    where: { UserID: u.UserID },
                    data: { PasswordHash: hash } as any
                });
            } catch (migrationError) {
                console.error(`[AUTH] Lazy migration failed for user ${u.Username}:`, migrationError);
                // Non-fatal — user already authenticated; backfill script will catch this row
            }
        }

        const techMapping: Record<string, string> = {
            "yot": "ช่างยศ",
            "cha": "ช่างชา",
            "ton": "ช่างต้น",
            "pat": "ช่างปาด",
            "sakol": "ช่างสกล",
            "kiat": "ช่างเขียด",
            "prawit": "ช่างประวิท",
            "deaw": "ช่างเดี่ยว",
            "team": "ทีมช่างรับเหมา"
        };

        // SYN-08: auth succeeded — wipe the failed-attempts ledger for this Username.
        await clearFailedAttempts(username);

        const sessionData = JSON.stringify({
            userId: user.UserID,
            username: user.Username,
            displayName: techMapping[user.Username.toLowerCase()] || user.Username,
            role: user.Role,
            branchId: user.BranchID,
            branchName: user.Branch?.BranchName || ""
        });

        const cookieStore = await cookies();
        cookieStore.set("user_session", sessionData, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax", // SYN-10 (11-05-2026): CSRF hardening — Lax allows top-level GETs (deep links) while blocking cross-site POST
            maxAge: getSessionTimeoutForRole(user.Role),
            path: "/"
        });

        return {
            success: true,
            role: user.Role,
            redirect: user.Role === 'Admin' ? '/admin/dashboard' : user.Role === 'Technician' ? '/technician/dashboard' : '/user/dashboard'
        };
    } catch (error) {
        console.error("Login error:", error);
        return { success: false, error: "เกิดข้อผิดพลาดในการเชื่อมต่อฐานข้อมูล" };
    }
}

export async function logout() {
    const cookieStore = await cookies();
    cookieStore.delete("user_session");
}

export async function getSession() {
    const cookieStore = await cookies();
    const session = cookieStore.get("user_session");
    if (!session) return null;
    try {
        return JSON.parse(session.value);
    } catch {
        return null;
    }
}
