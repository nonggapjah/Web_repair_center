/**
 * One-shot password backfill script.
 *
 * Hashes plaintext `Password` values into `PasswordHash` for all users where
 * `PasswordHash IS NULL`. Idempotent — safe to re-run.
 *
 * Run from ticket-system/ root:
 *   npx tsx scripts/migrate_passwords.ts
 *
 * After this script completes successfully:
 *   - Every user has PasswordHash populated
 *   - The `Password` plaintext column is NOT touched (Phase 0.5d cleanup)
 *   - Login flow uses the hashed path going forward
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const SALT_ROUNDS = 10;
const prisma = new PrismaClient();

async function main() {
    console.log("[migrate_passwords] Starting password backfill...");

    const users = (await prisma.user.findMany({
        where: { PasswordHash: null } as any,
        select: { UserID: true, Username: true, Password: true } as any,
    })) as unknown as Array<{ UserID: string; Username: string; Password: string }>;

    console.log(`[migrate_passwords] Found ${users.length} user(s) needing migration.`);

    let migrated = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < users.length; i++) {
        const user = users[i];
        const progress = `(${i + 1}/${users.length})`;

        if (!user.Password || user.Password.length === 0) {
            console.warn(`[migrate_passwords] ${progress} SKIP ${user.Username} — empty Password`);
            skipped++;
            continue;
        }

        try {
            const hash = await bcrypt.hash(user.Password, SALT_ROUNDS);
            await prisma.user.update({
                where: { UserID: user.UserID },
                data: { PasswordHash: hash } as any,
            });
            console.log(`[migrate_passwords] ${progress} OK ${user.Username}`);
            migrated++;
        } catch (e) {
            console.error(`[migrate_passwords] ${progress} FAIL ${user.Username}:`, e);
            failed++;
        }
    }

    const remaining = await prisma.user.count({
        where: { PasswordHash: null } as any,
    });

    console.log("\n[migrate_passwords] === Summary ===");
    console.log(`  Migrated: ${migrated}`);
    console.log(`  Skipped:  ${skipped}`);
    console.log(`  Failed:   ${failed}`);
    console.log(`  Remaining users without PasswordHash: ${remaining}`);

    if (remaining > 0) {
        console.warn("[migrate_passwords] WARNING: some users still have null PasswordHash. Review skipped/failed entries.");
        process.exitCode = 1;
    } else {
        console.log("[migrate_passwords] All users migrated successfully.");
    }
}

main()
    .catch((e) => {
        console.error("[migrate_passwords] Fatal error:", e);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
