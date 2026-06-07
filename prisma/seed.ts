import { PrismaClient, UserRole } from '@prisma/client';

const prisma = new PrismaClient();

const DEMO_COMPANY_ID = '00000000-0000-4000-8000-000000000010';
const DEMO_USER_ID = '00000000-0000-4000-8000-000000000001';

const BASELINE_STATUSES = [
  {
    id: '00000000-0000-4000-8000-000000000104',
    name: 'On Call',
    isProductive: true,
  },
  {
    id: '00000000-0000-4000-8000-000000000105',
    name: 'Live Chat',
    isProductive: true,
  },
  {
    id: '00000000-0000-4000-8000-000000000106',
    name: 'After Call Work',
    isProductive: true,
  },
  {
    id: '00000000-0000-4000-8000-000000000103',
    name: 'Meeting',
    isProductive: true,
  },
  {
    id: '00000000-0000-4000-8000-000000000102',
    name: 'Short Break',
    isProductive: false,
  },
  {
    id: '00000000-0000-4000-8000-000000000101',
    name: 'Lunch',
    isProductive: false,
  },
] as const;

async function main() {
  const company = await prisma.company.upsert({
    where: { id: DEMO_COMPANY_ID },
    update: { name: 'Demo Company' },
    create: {
      id: DEMO_COMPANY_ID,
      name: 'Demo Company',
    },
  });

  await prisma.user.upsert({
    where: { id: DEMO_USER_ID },
    update: {
      name: 'Demo Employee',
      email: 'demo@example.com',
      role: UserRole.EMPLOYEE,
      isActive: true,
      companyId: company.id,
    },
    create: {
      id: DEMO_USER_ID,
      companyId: company.id,
      email: 'demo@example.com',
      name: 'Demo Employee',
      role: UserRole.EMPLOYEE,
      isActive: true,
    },
  });

  for (const status of BASELINE_STATUSES) {
    await prisma.activityStatus.upsert({
      where: {
        companyId_name: {
          companyId: company.id,
          name: status.name,
        },
      },
      update: {
        isProductive: status.isProductive,
      },
      create: {
        id: status.id,
        companyId: company.id,
        name: status.name,
        isProductive: status.isProductive,
      },
    });
  }

  console.log('Seed complete:', {
    companyId: company.id,
    userId: DEMO_USER_ID,
    activityStatuses: BASELINE_STATUSES.map((status) => status.name),
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
