import { TEST_DATABASE_URL } from '../helpers/test-db';

process.env.DATABASE_URL = TEST_DATABASE_URL;
process.env.BETTER_AUTH_SECRET ??= 'test-better-auth-secret-32chars-min!!';
process.env.BETTER_AUTH_URL ??= 'http://localhost:3000';
process.env.NEXT_PUBLIC_APP_URL ??= 'http://localhost:3000';
