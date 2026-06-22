import { isTestDatabaseReady, TEST_DATABASE_URL } from '../helpers/test-db';

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.BETTER_AUTH_SECRET ??= 'test-better-auth-secret-32chars-min!!';
process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
process.env.NEXT_PUBLIC_APP_URL ??= 'http://localhost:3000';

if (process.env.CI) {
  const ready = await isTestDatabaseReady();
  if (!ready) {
    throw new Error(
      `[integration] Test database not reachable at ${TEST_DATABASE_URL}. ` +
        'Ensure docker-compose.test.yml is up (pnpm test:db:up) and migrations have run (pnpm test:db:migrate).'
    );
  }
}
