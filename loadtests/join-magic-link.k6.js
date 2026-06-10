/**
 * k6 load test for public join magic-link endpoint.
 *
 * Prerequisites:
 *   - k6 installed (https://k6.io/docs/get-started/installation/)
 *   - App running and reachable (staging or local `pnpm dev`)
 *   - Target org exists with allowed domain matching generated emails
 *
 * Usage:
 *   k6 run loadtests/join-magic-link.k6.js \
 *     -e BASE_URL=https://your-staging.example.com \
 *     -e ORG_SLUG=demo-company \
 *     -e EMAIL_DOMAIN=example.com \
 *     -e VUS=50 \
 *     -e DURATION=30s
 */
import http from 'k6/http';
import { check, sleep } from 'k6';

const baseUrl = __ENV.BASE_URL ?? 'http://localhost:3000';
const orgSlug = __ENV.ORG_SLUG ?? 'demo-company';
const emailDomain = __ENV.EMAIL_DOMAIN ?? 'example.com';
const vus = Number(__ENV.VUS ?? 50);
const duration = __ENV.DURATION ?? '30s';

export const options = {
  vus,
  duration,
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
  },
};

export default function joinMagicLinkLoad() {
  const vu = __VU;
  const email = `k6-load-${vu}-${__ITER}@` + emailDomain;

  const response = http.post(
    `${baseUrl}/api/join/request-magic-link`,
    JSON.stringify({ email, orgSlug }),
    {
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'request-magic-link' },
    }
  );

  check(response, {
    'status is 200 or expected 4xx': (res) =>
      res.status === 200 || res.status === 403 || res.status === 404,
    'response has success field': (res) => {
      try {
        const body = res.json();
        return typeof body.success === 'boolean';
      } catch {
        return false;
      }
    },
  });

  sleep(0.1);
}
