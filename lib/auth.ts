import { betterAuth } from 'better-auth/minimal';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { magicLink } from 'better-auth/plugins';
import { organization } from 'better-auth/plugins';
import { APIError } from 'better-auth/api';
import { prisma } from '@/lib/db/prisma';
import {
  assertUserCreationAllowed,
  registrationGatePlugin,
} from '@/lib/auth/registration-gate-plugin';
import { consumeRegistrationPermit } from '@/lib/auth/registration-permit';
import { sendMagicLinkEmail } from '@/lib/email/send';
import { magicLinkEmail } from '@/lib/email/templates';

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
      disableImplicitSignUp: true,
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user, context) => {
          const email = user.email?.trim().toLowerCase();
          if (!email) {
            throw new APIError('FORBIDDEN', {
              message: 'A valid email address is required to register.',
            });
          }

          await assertUserCreationAllowed(email, context?.path);

          if (!consumeRegistrationPermit(email)) {
            return;
          }
        },
      },
    },
  },
  plugins: [
    magicLink({
      async sendMagicLink(data) {
        const metadata = data.metadata as Record<string, unknown> | undefined;
        const orgName =
          typeof metadata?.organizationName === 'string'
            ? metadata.organizationName
            : undefined;

        const html = magicLinkEmail({ url: data.url, orgName });
        const subject = orgName
          ? `Join ${orgName} on OmniShift`
          : 'Your OmniShift sign-in link';

        await sendMagicLinkEmail(data.email, subject, html);
      },
    }),
    organization({
      allowUserToCreateOrganization: async (user) => {
        const membershipCount = await prisma.member.count({
          where: { userId: user.id },
        });

        return membershipCount === 0;
      },
    }),
    registrationGatePlugin(),
  ],
});

export type Session = typeof auth.$Infer.Session;
