import { prisma } from './prisma';

async function main() {
    console.log('Seeding data...');

    // 1. Create Branches
    const b1 = await prisma.branch.upsert({
        where: { BranchID: 'V-PHROM' },
        update: {},
        create: {
            BranchID: 'V-PHROM',
            BranchName: 'Phrom Phong Branch (024)',
        },
    });

    const b2 = await prisma.branch.upsert({
        where: { BranchID: 'V-THONGLO' },
        update: {},
        create: {
            BranchID: 'V-THONGLO',
            BranchName: 'Thong Lo Branch (032)',
        },
    });

    // 2. Create Users
    const user1 = await prisma.user.upsert({
        where: { Username: 'user_phrom' },
        update: {},
        create: {
            Username: 'user_phrom',
            Role: 'User',
            BranchID: b1.BranchID,
        },
    });

    const admin1 = await prisma.user.upsert({
        where: { Username: 'admin_it' },
        update: {},
        create: {
            Username: 'admin_it',
            Role: 'Admin',
            BranchID: b1.BranchID,
        },
    });

    // 3. Create initial tickets
    await prisma.repairTicket.create({
        data: {
            UserID: user1.UserID,
            BranchID: b1.BranchID,
            Product: 'POS Cashier 04',
            Symptom: 'Hardware Failure',
            Description: 'Credit card terminal connection lost.',
            CurrentStatus: 'Open',
            Priority: 'High',
        }
    });

    console.log('Seeding finished.');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
