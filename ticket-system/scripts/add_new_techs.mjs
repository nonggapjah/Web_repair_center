import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const newTechs = [
  { username: "aod", password: "aod1234", displayName: "ช่างอ๊อด" },
  { username: "tom", password: "tom1234", displayName: "ช่างต้อม" },
  { username: "nimit", password: "nimit1234", displayName: "ช่างนิมิต" }
];

async function main() {
  console.log('Adding new technicians to database...');

  // Ensure TECH branch exists
  const techBranch = await prisma.branch.upsert({
      where: { BranchID: 'TECH' },
      update: { BranchName: 'Technician Team' },
      create: { BranchID: 'TECH', BranchName: 'Technician Team' },
  });

  for (const tech of newTechs) {
    try {
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
      console.log(`✅ Added technician: ${tech.displayName} (Username: ${tech.username}, Password: ${tech.password})`);
    } catch (err) {
      console.error(`❌ Failed to add technician ${tech.username}:`, err);
    }
  }

  console.log('Done.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
