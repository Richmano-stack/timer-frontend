import { betterAuth } from 'better-auth/minimal';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { magicLink } from 'better-auth/plugins';
import { organization } from 'better-auth/plugins';
import { prisma } from '@/lib/db/prisma';

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    magicLink({
      async sendMagicLink(data) {
        console.info('[magic-link] Sign-in link stub', {
          to: data.email,
          url: data.url,
          metadata: data.metadata,
        });
      },
    }),
    organization({
      allowUserToCreateOrganization: true,
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
