import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Deleting 90xx users and branches...');
  await prisma.user.deleteMany({
    where: {
      Username: {
        startsWith: '90'
      }
    }
  });
  await prisma.branch.deleteMany({
    where: {
      BranchID: {
        startsWith: '90'
      }
    }
  });
  console.log('Deleted successfully.');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
