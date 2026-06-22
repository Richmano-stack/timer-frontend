import path from 'node:path';
import { defineConfig } from 'vitest/config';

const alias = {
  '@': path.resolve(__dirname, '.'),
};

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          environment: 'node',
          include: ['**/*.test.ts'],
          exclude: [
            'node_modules',
            '.next',
            '**/*.integration.test.ts',
            '**/request-magic-link/**/route.test.ts',
            '**/organization/invitations/**/route.test.ts',
          ],
        },
      },
      {
        resolve: { alias },
        test: {
          name: 'integration',
          environment: 'node',
          include: [
            '**/*.integration.test.ts',
            '**/request-magic-link/**/route.test.ts',
            '**/organization/invitations/**/route.test.ts',
            'src/tests/integration/**/*.test.ts',
          ],
          exclude: ['node_modules', '.next'],
          setupFiles: ['test/setup/integration-env.ts'],
          fileParallelism: false,
        },
      },
    ],
  },
});
