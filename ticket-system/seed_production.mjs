import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const BCRYPT_SALT_ROUNDS = 10;

const branches = [
  { code: '1000', telex: 'vl1000', name: 'SUKHUMVIT 33' },
  { code: '1001', telex: 'vl1001', name: 'PHAHOLYOTHIN' },
  { code: '1002', telex: 'vl1002', name: 'OFFICE' },
  { code: '1003', telex: 'vl1003', name: 'NICHADA' },
  { code: '1005', telex: 'vl1005', name: 'SUKHUMVIT 49' },
  { code: '1006', telex: 'vl1006', name: 'PLOENCHIT' },
  { code: '1007', telex: 'vl1007', name: 'SILOM' },
  { code: '1011', telex: 'vl1011', name: 'THONGLOR' },
  { code: '1014', telex: 'vl1014', name: 'AREE' },
  { code: '1015', telex: 'vl1015', name: 'PATTAYA' },
  { code: '1016', telex: 'vl1016', name: 'HUAHIN' },
  { code: '1017', telex: 'vl1017', name: 'CHAENG WATTHANA' },
  { code: '1019', telex: 'vl1019', name: 'RATCHAYOTHIN' },
  { code: '1020', telex: 'vl1020', name: 'RATCHAPRUEK' },
  { code: '1021', telex: 'vl1021', name: 'PHUKET' },
  { code: '1022', telex: 'vl1022', name: 'KASET-NAWAMIN' },
  { code: '1023', telex: 'vl1023', name: 'PARADISE' },
  { code: '1024', telex: 'vl1024', name: 'SAMMAKORN' },
  { code: '1026', telex: 'vl1026', name: 'SENA' },
  { code: '1030', telex: 'vl1030', name: 'K-VILLAGE' },
  { code: '1032', telex: 'vl1032', name: 'LAGUNA PHUKET' },
  { code: '1033', telex: 'vl1033', name: 'PESEO-RAM' },
  { code: '1034', telex: 'vl1034', name: 'PESEO-LAT' },
  { code: '1036', telex: 'vl1036', name: 'RAMA3' },
  { code: '1038', telex: 'vl1038', name: 'PESEO KAN' },
  { code: '1039', telex: 'vl1039', name: 'BOAT LAGOON' },
  { code: '1040', telex: 'vl1040', name: 'INDEX HUAHIN' },
  { code: '1041', telex: 'vl1041', name: 'THE CIRCLE' },
  { code: '1042', telex: 'vl1042', name: 'UD TOWN UDON' },
  { code: '1044', telex: 'vl1044', name: 'BANGNA' },
  { code: '1046', telex: 'vl1046', name: 'SUKHUMVIT 11' },
  { code: '1047', telex: 'vl1047', name: 'LASALLE' },
  { code: '1048', telex: 'vl1048', name: 'LITTLE WALK PATTAYA' },
  { code: '1049', telex: 'vl1049', name: 'LUNGSUAN' },
  { code: '1050', telex: 'vl1050', name: 'BUKIS PHUKET' },
  { code: '1051', telex: 'vl1051', name: 'CHIC REPUBLIC' },
  { code: '1052', telex: 'vl1052', name: 'LITTLE WALKLAT-KRABANG' },
  { code: '1053', telex: 'vl1053', name: 'VILLA KRUNGTHEP-KRITHA' },
  { code: '1054', telex: 'vl1054', name: 'VILLA GAYSORN AMARIN' },
  { code: '1055', telex: 'vl1055', name: 'VILLA NANG LINCHI' },
  { code: '1056', telex: 'vl1056', name: 'HOMEPRO CHERNGTALAY' },
  { code: '1057', telex: 'vl1057', name: 'KAMALA PHUKET' },
  { code: '1058', telex: 'vl1058', name: 'LTTLE - RATTANATIBETH' },
  { code: '1059', telex: 'vl1059', name: 'VILLA KINGSQUARE' },
  { code: 'DC', telex: 'dclat', name: 'DC LAT KRABANG' }
];

async function main() {
  console.log('Start seeding branches and users...');
  let successCount = 0;

  for (const b of branches) {
    try {
      // 1. Upsert Branch
      const branch = await prisma.branch.upsert({
        where: { BranchID: b.code },
        update: { BranchName: b.name },
        create: { BranchID: b.code, BranchName: b.name },
      });

      // 2. Hash telex BEFORE upsert so Password + PasswordHash stay in sync (BUG-02 fix)
      const hash = await bcrypt.hash(b.telex, BCRYPT_SALT_ROUNDS);

      // 3. Upsert User — write BOTH Password (legacy) and PasswordHash (current truth)
      await prisma.user.upsert({
        where: { Username: b.code },
        update: {
          Password: b.telex,
          PasswordHash: hash,
          BranchID: branch.BranchID,
        },
        create: {
          Username: b.code,
          Password: b.telex,
          PasswordHash: hash,
          Role: 'User',
          BranchID: branch.BranchID,
        },
      });

      console.log(`✅ Seeded branch ${b.code} - ${b.name}`);
      successCount++;
    } catch (err) {
      console.error(`❌ Failed to seed branch ${b.code}:`, err);
    }
  }

  // Ensure Admin exists — password from env, no hardcoded default (BUG-03 fix)
  const adminInitialPassword = process.env.ADMIN_INITIAL_PASSWORD;
  if (!adminInitialPassword) {
    console.warn('⚠️  ADMIN_INITIAL_PASSWORD env var not set — skipping admin user seed.');
    console.warn('   To seed admin, set ADMIN_INITIAL_PASSWORD in .env and re-run.');
  } else if (adminInitialPassword.length < 12) {
    console.error('❌ ADMIN_INITIAL_PASSWORD must be at least 12 characters. Skipping admin seed.');
  } else {
    try {
      const adminBranch = await prisma.branch.upsert({
        where: { BranchID: 'HQ' },
        update: { BranchName: 'Headquarters' },
        create: { BranchID: 'HQ', BranchName: 'Headquarters' },
      });

      const adminHash = await bcrypt.hash(adminInitialPassword, BCRYPT_SALT_ROUNDS);

      await prisma.user.upsert({
        where: { Username: 'admin' },
        update: {
          Password: adminInitialPassword,
          PasswordHash: adminHash,
          Role: 'Admin',
          BranchID: adminBranch.BranchID,
        },
        create: {
          Username: 'admin',
          Password: adminInitialPassword,
          PasswordHash: adminHash,
          Role: 'Admin',
          BranchID: adminBranch.BranchID,
        },
      });
      console.log('✅ Ensured admin user exists (password hashed from ADMIN_INITIAL_PASSWORD)');
    } catch (err) {
      console.error('❌ Failed to seed admin:', err);
    }
  }

  console.log(`Seeding finished. Successfully processed ${successCount}/${branches.length} branches.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
