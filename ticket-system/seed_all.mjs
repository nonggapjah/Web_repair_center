import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const BCRYPT_SALT_ROUNDS = 10;

// 1. ข้อมูลสาขาและ User สาขา
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

// 2. ข้อมูลรายชื่อช่างทั้งหมด
const technicians = [
  { username: "yot", password: "yot1234", displayName: "ช่างยศ" },
  { username: "cha", password: "cha1234", displayName: "ช่างชา" },
  { username: "ton", password: "ton1234", displayName: "ช่างต้น" },
  { username: "pat", password: "pat1234", displayName: "ช่างปาด" },
  { username: "sakol", password: "sakol1234", displayName: "ช่างสกล" },
  { username: "kiat", password: "kiat1234", displayName: "ช่างเขียด" },
  { username: "prawit", password: "prawit1234", displayName: "ช่างประวิท" },
  { username: "deaw", password: "deaw1234", displayName: "ช่างเดี่ยว" },
  { username: "team", password: "team1234", displayName: "ทีมช่างรับเหมา" },
  { username: "aod", password: "aod1234", displayName: "ช่างอ๊อด" },
  { username: "tom", password: "tom1234", displayName: "ช่างต้อม" },
  { username: "nimit", password: "nimit1234", displayName: "ช่างนิมิต" }
];

async function main() {
  console.log('🚀 Starting Master Seed Process...');

  // --- PART 1: SEED BRANCHES & USERS ---
  console.log('\n--- Seeding Branches & Branch Users ---');
  for (const b of branches) {
    try {
      const branch = await prisma.branch.upsert({
        where: { BranchID: b.code },
        update: { BranchName: b.name },
        create: { BranchID: b.code, BranchName: b.name },
      });

      const hash = await bcrypt.hash(b.telex, BCRYPT_SALT_ROUNDS);
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
    } catch (err) {
      console.error(`❌ Failed to seed branch ${b.code}:`, err);
    }
  }

  // --- PART 2: SEED TECHNICIANS ---
  console.log('\n--- Seeding Technicians ---');
  const techBranch = await prisma.branch.upsert({
    where: { BranchID: 'TECH' },
    update: { BranchName: 'Technician Team' },
    create: { BranchID: 'TECH', BranchName: 'Technician Team' },
  });

  for (const tech of technicians) {
    try {
      const techHash = await bcrypt.hash(tech.password, BCRYPT_SALT_ROUNDS);
      await prisma.user.upsert({
        where: { Username: tech.username },
        update: { 
            Password: tech.password, 
            PasswordHash: techHash,
            Role: 'Technician', 
            BranchID: techBranch.BranchID 
        },
        create: {
          Username: tech.username,
          Password: tech.password,
          PasswordHash: techHash,
          Role: 'Technician',
          BranchID: techBranch.BranchID,
        },
      });
      console.log(`✅ Seeded technician: ${tech.displayName} (User: ${tech.username})`);
    } catch (err) {
      console.error(`❌ Failed to seed technician ${tech.username}:`, err);
    }
  }

  // --- PART 3: SEED ADMIN ---
  console.log('\n--- Seeding Admin ---');
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD || "villa@admin2026"; // ใช้รหัสที่คุณระบุมา
  try {
    const hqBranch = await prisma.branch.upsert({
      where: { BranchID: 'HQ' },
      update: { BranchName: 'Headquarters' },
      create: { BranchID: 'HQ', BranchName: 'Headquarters' },
    });

    const adminHash = await bcrypt.hash(adminPassword, BCRYPT_SALT_ROUNDS);
    await prisma.user.upsert({
      where: { Username: 'admin' },
      update: {
        Password: adminPassword,
        PasswordHash: adminHash,
        Role: 'Admin',
        BranchID: hqBranch.BranchID,
      },
      create: {
        Username: 'admin',
        Password: adminPassword,
        PasswordHash: adminHash,
        Role: 'Admin',
        BranchID: hqBranch.BranchID,
      },
    });
    console.log(`✅ Seeded admin user (Password: ${adminPassword})`);
  } catch (err) {
    console.error('❌ Failed to seed admin:', err);
  }

  console.log('\n✨ Master Seeding finished! All data is ready.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
