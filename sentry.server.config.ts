import * as Sentry from '@sentry/nextjs';
import { createServerSentryOptions } from '@/lib/monitoring/sentry-options';

Sentry.init(createServerSentryOptions());
