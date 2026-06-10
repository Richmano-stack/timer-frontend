import { execSync } from 'node:child_process';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://timer_test_user:timer_test_secret@localhost:5435/timer_test';

execSync('pnpm exec prisma migrate deploy', {
  env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  stdio: 'inherit',
});
