import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
    const branches = [
        { id: '1000', name: 'SUKHUMVIT 33' },
        { id: '1003', name: 'NICHADA' },
        { id: '1005', name: 'SUKHUMVIT 49' },
        { id: '1006', name: 'PLOENCHIT' },
        { id: '1007', name: 'SILOM' },
        { id: '1011', name: 'THONGLOR' },
        { id: '1014', name: 'AREE' },
        { id: '1015', name: 'PATTAYA' },
        { id: '1016', name: 'HUAHIN' },
        { id: '1017', name: 'CHAENG WATTHANA' },
        { id: '1019', name: 'RATCHAYOTHIN' },
        { id: '1020', name: 'RATCHAPRUEK' },
        { id: '1021', name: 'PHUKET' },
        { id: '1022', name: 'KASET-NAWAMIN' },
        { id: '1023', name: 'PARADISE' },
        { id: '1024', name: 'SAMMAKORN' },
        { id: '1026', name: 'SENA' },
        { id: '1030', name: 'K-VILLAGE' },
        { id: '1032', name: 'LAGUNA PHUKET' },
        { id: '1033', name: 'PESEO-RAM' },
        { id: '1034', name: 'PESEO-LAT' },
        { id: '1036', name: 'RAMA3' },
        { id: '1038', name: 'PESEO KAN' },
        { id: '1039', name: 'BOAT LAGOON' },
        { id: '1040', name: 'INDEX HUAHIN' },
        { id: '1041', name: 'THE CIRCLE' },
        { id: '1042', name: 'UD TOWN UDON' },
        { id: '1044', name: 'BANGNA' },
        { id: '1046', name: 'SUKHUMVIT 11' },
        { id: '1047', name: 'LASALLE' },
        { id: '1048', name: 'LITTLE WALK PATTAYA' },
        { id: '1049', name: 'LUNGSUAN' },
        { id: '1050', name: 'BUKIS PHUKET' },
        { id: '1051', name: 'CHIC REPUBLIC' },
        { id: '1052', name: 'LITTLE WALKLAT-KRABANG' },
        { id: '1053', name: 'VILLA KRUNGTHEP-KRITHA' },
        { id: '1054', name: 'VILLA GAYSORN AMARIN' },
        { id: '1055', name: 'VILLA NANG LINCHI' },
        { id: '1056', name: 'HOMEPRO CHERNGTALAY' },
        { id: '1057', name: 'KAMALA PHUKET' },
        { id: '1058', name: 'LTTLE - RATTANATIBETH' },
        { id: '1059', name: 'VILLA KINGSQUARE' },
    ]

    console.log('Start seeding branches...')
    for (const b of branches) {
        await prisma.branch.upsert({
            where: { BranchID: b.id },
            update: {},
            create: {
                BranchID: b.id,
                BranchName: b.name,
            },
        })
    }

    console.log('Start seeding users...')
    // Admin user
    await prisma.user.upsert({
        where: { Username: 'admin' },
        update: {},
        create: {
            Username: 'admin',
            Password: 'Villamarket@2022',
            Role: 'Admin',
            BranchID: '1000',
        },
    })

    // Sample regular user for first branch
    await prisma.user.upsert({
        where: { Username: '1000' },
        update: {},
        create: {
            Username: '1000',
            Password: '1234',
            Role: 'User',
            BranchID: '1000',
        },
    })

    console.log('Seeding finished successfully!')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
