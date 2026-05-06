const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const technicians = [
  { username: "yot", password: "yot1234", oldUsername: "ช่างยศ" },
  { username: "cha", password: "cha1234", oldUsername: "ช่างชา" },
  { username: "ton", password: "ton1234", oldUsername: "ช่างต้น" },
  { username: "pat", password: "pat1234", oldUsername: "ช่างปาด" },
  { username: "sakol", password: "sakol1234", oldUsername: "ช่างสกล" },
  { username: "kiat", password: "kiat1234", oldUsername: "ช่างเขียด" },
  { username: "prawit", password: "prawit1234", oldUsername: "ช่างประวิท" },
  { username: "deaw", password: "deaw1234", oldUsername: "ช่างเดี่ยว" },
  { username: "team", password: "team1234", oldUsername: "ทีมช่างรับเหมา" }
];

async function seedTechnicians() {
  console.log('Start updating technician to English usernames...');

  // Ensure TECH branch exists
  const techBranch = await prisma.branch.upsert({
      where: { BranchID: 'TECH' },
      update: { BranchName: 'Technician Team' },
      create: { BranchID: 'TECH', BranchName: 'Technician Team' },
  });

  for (const tech of technicians) {
    try {
      // 1. Delete old Thai username account if it exists to avoid duplicates
      await prisma.user.deleteMany({
        where: { Username: tech.oldUsername }
      });

      // 2. Create/Update new English username account
      await prisma.user.upsert({
        where: { Username: tech.username },
        update: { Password: tech.password, Role: 'Technician', BranchID: techBranch.BranchID },
        create: {
          Username: tech.username,
          Password: tech.password,
          Role: 'Technician',
          BranchID: techBranch.BranchID,
        },
      });
      console.log(`✅ Updated technician: ${tech.username} (Password: ${tech.password})`);
    } catch (err) {
      console.error(`❌ Failed to update technician ${tech.username}:`, err);
    }
  }

  console.log('Username and password update finished.');
}

seedTechnicians()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
