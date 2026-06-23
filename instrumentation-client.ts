import * as Sentry from '@sentry/nextjs';
import { createClientSentryOptions } from '@/lib/monitoring/sentry-options';

Sentry.init(createClientSentryOptions());

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
