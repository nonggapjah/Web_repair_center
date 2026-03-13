const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const branches = [
    { code: "1000", name: "VILLA MARKET SUKHUMVIT 33" },
    { code: "1003", name: "VILLA MARKET NICHADA" },
    { code: "1005", name: "VILLA MARKET SUKHUMVIT 49" },
    { code: "1006", name: "VILLA MARKET PLOENCHIT" },
    { code: "1007", name: "VILLA MARKET SILOM" },
    { code: "1011", name: "VILLA MARKET SUKHUMVIT 55" },
    { code: "1014", name: "VILLA MARKET AREE" },
    { code: "1015", name: "VILLA MARKET PATTAYA" },
    { code: "1016", name: "VILLA MARKET HUAHIN" },
    { code: "1017", name: "VILLA MARKET CHAENG WATTHANA" },
    { code: "1019", name: "VILLA MARKET RATCHAYOTHIN" },
    { code: "1020", name: "VILLA MARKET RATCHAPRUEK" },
    { code: "1021", name: "VILLA MARKET PHUKET" },
    { code: "1022", name: "VILLA MARKET KASET-NAWAMIN" },
    { code: "1023", name: "VILLA MARKET PARADISE" },
    { code: "1024", name: "VILLA MARKET SAMMAKORN" },
    { code: "1026", name: "VILLA MARKET SENA" },
    { code: "1030", name: "VILLA MARKET K-VILLAGE" },
    { code: "1032", name: "VILLA MARKET LAGUNA PHUKET" },
    { code: "1033", name: "VILLA MARKET PESEO RAMKHAMHAENG" },
    { code: "1034", name: "VILLA MARKET PESEO-LAT-KRABANG" },
    { code: "1036", name: "VILLA MARKET RAMA3" },
    { code: "1038", name: "VILLA MARKET PESEO KANCHANAPISEK" },
    { code: "1039", name: "VILLA MARKET BOAT LAGOON" },
    { code: "1040", name: "VILLA MARKET INDEX HUAHIN" },
    { code: "1041", name: "VILLA MARKET THE CIRCLE RATCHAPRUEK" },
    { code: "1042", name: "VILLA MARKET UD TOWN UDON" },
    { code: "1044", name: "VILLA MARKET BANGNA" },
    { code: "1046", name: "VILLA MARKET SUKHUMVIT 11" },
    { code: "1047", name: "VILLA MARKET LASALLE" },
    { code: "1048", name: "VILLA MARKET LITTLE WALK PATTAYA" },
    { code: "1049", name: "VILLA MARKET LUNGSUAN" },
    { code: "1050", name: "VILLA MARKET BUKIS PHUKET" },
    { code: "1051", name: "VILLA MARKET CHIC REPUBLIC" },
    { code: "1052", name: "VILLA MARKET LITTLE WALKLAT-KRABANG" },
    { code: "1053", name: "VILLA MARKET LITTLE KRUNGTHEP-KRITHA" },
    { code: "1054", name: "VILLA MARKET GAYSORN AMARIN" },
    { code: "1055", name: "VILLA MARKET NANG LINCHI" },
    { code: "1056", name: "VILLA MARKET HOMEPRO CHERNGTALAY" },
    { code: "1057", name: "VILLA MARKET KAMALA PHUKET" },
    { code: "1058", name: "VILLA MARKET LITTLE WALK-RATTANATIBETH" },
    { code: "1059", name: "VILLA MARKET KINGSQUARE" }
];

async function main() {
    console.log('--- Starting Seed Branches ---');

    for (const br of branches) {
        await prisma.branch.upsert({
            where: { BranchID: br.code },
            update: { BranchName: br.name },
            create: {
                BranchID: br.code,
                BranchName: br.name
            }
        });
        console.log(`Synced: ${br.code} - ${br.name}`);
    }

    // สร้าง Admin Account ไว้ใช้งานเบื้องต้น
    await prisma.user.upsert({
        where: { Username: 'admin' },
        update: {},
        create: {
            Username: 'admin',
            Role: 'Admin',
            BranchID: '1000'
        }
    });

    console.log('--- Seed Finished Successfully ---');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
