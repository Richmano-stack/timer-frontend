import { PrismaClient } from '@prisma/client';
import { DEFAULT_ACTIVITY_STATUSES } from '../lib/constants/default-activity-statuses';
import { createDefaultJoinMetadata, serializeOrganizationMetadata } from '../lib/organization/metadata';
import { seedDefaultActivityStatuses } from '../lib/services/organization-bootstrap.service';
import { grantRegistrationPermit } from '@/lib/auth/registration-permit';
import { auth } from '@/lib/auth';

const prisma = new PrismaClient();

const DEMO_ORG_ID = '00000000-0000-4000-8000-000000000010';
const DEMO_EMAIL = 'demo@example.com';
const DEMO_PASSWORD = 'DemoPassword1!';

async function ensureDemoUser() {
  const existing = await prisma.user.findUnique({
    where: { email: DEMO_EMAIL },
    select: { id: true },
  });

  if (existing) return existing.id;

  grantRegistrationPermit(DEMO_EMAIL, 'owner_bootstrap');

  const signUpResult = await auth.api.signUpEmail({
    body: {
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      name: 'Demo Owner',
    },
  });

  if (signUpResult?.user?.id) {
    return signUpResult.user.id;
  }

  const created = await prisma.user.findUniqueOrThrow({
    where: { email: DEMO_EMAIL },
    select: { id: true },
  });

  return created.id;
}

async function main() {
  const userId = await ensureDemoUser();

  const joinMetadata = serializeOrganizationMetadata(createDefaultJoinMetadata(DEMO_EMAIL));

  const organization = await prisma.organization.upsert({
    where: { slug: 'demo-company' },
    update: {
      name: 'Demo Company',
      metadata: joinMetadata,
    },
    create: {
      id: DEMO_ORG_ID,
      name: 'Demo Company',
      slug: 'demo-company',
      metadata: joinMetadata,
    },
  });

  await prisma.member.upsert({
    where: {
      organizationId_userId: {
        organizationId: organization.id,
        userId,
      },
    },
    update: { role: 'owner' },
    create: {
      id: crypto.randomUUID(),
      organizationId: organization.id,
      userId,
      role: 'owner',
    },
  });

  const seedResult = await seedDefaultActivityStatuses(organization.id);
  if (!seedResult.success) {
    throw new Error(seedResult.error.message);
  }

  console.log('Seed complete:', {
    organizationId: organization.id,
    organizationSlug: organization.slug,
    joinUrl: `http://localhost:3000/join/${organization.slug}`,
    allowedDomains: ['example.com'],
    userId,
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    activityStatuses: DEFAULT_ACTIVITY_STATUSES.map((status) => status.name),
    seeded: seedResult.data.seeded,
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
