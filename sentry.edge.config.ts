import * as Sentry from '@sentry/nextjs';
import { createEdgeSentryOptions } from '@/lib/monitoring/sentry-options';

Sentry.init(createEdgeSentryOptions());
