'use client';

import { createAuthClient } from 'better-auth/react';
import { magicLinkClient } from 'better-auth/client/plugins';
import { organizationClient } from 'better-auth/client/plugins';

// Social sign-in (signIn.social) is built into the base client; no extra plugin required.
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
  plugins: [magicLinkClient(), organizationClient()],
});
