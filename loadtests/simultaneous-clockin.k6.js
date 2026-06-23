/**
 * k6 load test for authenticated POST /api/time/clock-in under concurrency.
 *
 * Surfaces DB contention and duplicate open-shift handling enforced by the
 * partial unique index on time_log (one open segment per user + organization).
 *
 * Prerequisites:
 *   - k6 installed (https://k6.io/docs/get-started/installation/)
 *   - App running and reachable (staging or local `pnpm dev`)
 *   - Agents exist as org members with email/password credentials
 *
 * Usage (race — many VUs, one user, simultaneous clock-in):
 *   k6 run loadtests/simultaneous-clockin.k6.js \
 *     -e BASE_URL=http://localhost:3000 \
 *     -e MODE=race \
 *     -e AGENT_EMAIL=demo@example.com \
 *     -e AGENT_PASSWORD=DemoPassword1! \
 *     -e ORG_SLUG=demo-company \
 *     -e VUS=100 \
 *     -e DURATION=30s
 *
 * Usage (multi-agent — one distinct agent per VU):
 *   k6 run loadtests/simultaneous-clockin.k6.js \
 *     -e BASE_URL=http://localhost:3000 \
 *     -e MODE=multi-agent \
 *     -e AGENT_EMAIL_PREFIX=loadtest-agent \
 *     -e EMAIL_DOMAIN=example.com \
 *     -e AGENT_PASSWORD=DemoPassword1! \
 *     -e ORG_SLUG=demo-company \
 *     -e VUS=100 \
 *     -e DURATION=30s
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

const baseUrl = (__ENV.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '');
const mode = (__ENV.MODE ?? 'race').toLowerCase();
const vus = Number(__ENV.VUS ?? 100);
const duration = __ENV.DURATION ?? '30s';
const orgSlug = __ENV.ORG_SLUG ?? 'demo-company';
const orgId = __ENV.ORGANIZATION_ID ?? '';
const agentEmail = __ENV.AGENT_EMAIL ?? 'demo@example.com';
const agentPassword = __ENV.AGENT_PASSWORD ?? 'DemoPassword1!';
const agentEmailPrefix = __ENV.AGENT_EMAIL_PREFIX ?? 'loadtest-agent';
const emailDomain = __ENV.EMAIL_DOMAIN ?? 'example.com';
const resetBeforeRun = (__ENV.RESET_BEFORE_RUN ?? 'true').toLowerCase() !== 'false';
const notesTag = __ENV.NOTES_TAG ?? `k6-${mode}`;

const clockInOk = new Counter('clock_in_success');
const clockInConflict = new Counter('clock_in_already_clocked_in');
const clockInOtherError = new Counter('clock_in_other_error');
const authFailure = new Counter('auth_failure');
const clockInSuccessRate = new Rate('clock_in_success_rate');

export const options =
  mode === 'race'
    ? {
        scenarios: {
          simultaneous_race: {
            executor: 'shared-iterations',
            vus,
            iterations: vus,
            maxDuration: duration,
          },
        },
        thresholds: {
          http_req_failed: ['rate<0.05'],
          clock_in_success: ['count>=1'],
          ...(vus > 1
            ? { clock_in_already_clocked_in: [`count>=${vus - 1}`] }
            : {}),
        },
      }
    : {
        vus,
        duration,
        thresholds: {
          http_req_failed: ['rate<0.1'],
          clock_in_success_rate: ['rate>0.9'],
          http_req_duration: ['p(95)<3000'],
        },
      };

function jsonHeaders(jar) {
  return {
    headers: { 'Content-Type': 'application/json' },
    jar,
  };
}

function sessionTokenFromJar(jar) {
  const cookies = jar.cookiesForURL(baseUrl);
  const entries = cookies['better-auth.session_token'];
  if (!entries || entries.length === 0) {
    return null;
  }
  return entries[0].value;
}

function jarFromSessionToken(token) {
  const jar = http.cookieJar();
  const parsed = new URL(baseUrl);
  jar.set(baseUrl, 'better-auth.session_token', token, {
    domain: parsed.hostname,
    path: '/',
    secure: parsed.protocol === 'https:',
  });
  return jar;
}

function signIn(email, password) {
  const jar = http.cookieJar();
  const signInRes = http.post(
    `${baseUrl}/api/auth/sign-in/email`,
    JSON.stringify({ email, password }),
    jsonHeaders(jar)
  );

  if (signInRes.status !== 200) {
    authFailure.add(1);
    return null;
  }

  const activeBody = orgId
    ? JSON.stringify({ organizationId: orgId })
    : JSON.stringify({ organizationSlug: orgSlug });

  const activeRes = http.post(
    `${baseUrl}/api/auth/organization/set-active`,
    activeBody,
    jsonHeaders(jar)
  );

  if (activeRes.status !== 200) {
    authFailure.add(1);
    return null;
  }

  return sessionTokenFromJar(jar);
}

function clockOut(sessionToken) {
  const jar = jarFromSessionToken(sessionToken);
  http.post(`${baseUrl}/api/time/clock-out`, null, jsonHeaders(jar));
}

function agentEmailForVu(vu) {
  if (mode === 'race') {
    return agentEmail;
  }
  return `${agentEmailPrefix}-${vu}@${emailDomain}`;
}

function recordClockIn(response) {
  let body;
  try {
    body = response.json();
  } catch {
    clockInOtherError.add(1);
    clockInSuccessRate.add(false);
    return;
  }

  if (response.status === 200 && body.success === true) {
    clockInOk.add(1);
    clockInSuccessRate.add(true);
    return;
  }

  const code = body?.error?.code;
  if (response.status === 409 && code === 'USER_ALREADY_CLOCKED_IN') {
    clockInConflict.add(1);
    clockInSuccessRate.add(false);
    return;
  }

  clockInOtherError.add(1);
  clockInSuccessRate.add(false);
}

export function setup() {
  const sessionTokens = [];

  if (mode === 'race') {
    const token = signIn(agentEmail, agentPassword);
    if (!token) {
      throw new Error(
        `Failed to sign in race agent (${agentEmail}). Check credentials and ORG_SLUG.`
      );
    }
    if (resetBeforeRun) {
      clockOut(token);
    }
    for (let i = 0; i < vus; i += 1) {
      sessionTokens.push(token);
    }
    return { sessionTokens };
  }

  for (let vu = 1; vu <= vus; vu += 1) {
    const email = agentEmailForVu(vu);
    const token = signIn(email, agentPassword);
    if (!token) {
      throw new Error(
        `Failed to sign in agent ${email}. Seed load-test members first (see loadtests/README.md).`
      );
    }
    if (resetBeforeRun) {
      clockOut(token);
    }
    sessionTokens.push(token);
  }

  return { sessionTokens };
}

export default function clockInLoad(data) {
  const vuIndex = __VU - 1;
  const sessionToken = data.sessionTokens[vuIndex];
  if (!sessionToken) {
    authFailure.add(1);
    return;
  }

  const jar = jarFromSessionToken(sessionToken);

  const expectedStatuses =
    mode === 'race' ? http.expectedStatuses(200, 409) : http.expectedStatuses(200);

  const response = http.post(
    `${baseUrl}/api/time/clock-in`,
    JSON.stringify({ notes: `${notesTag}-vu${__VU}-iter${__ITER}` }),
    {
      ...jsonHeaders(jar),
      tags: { name: 'clock-in' },
      responseCallback: expectedStatuses,
    }
  );

  check(response, {
    'clock-in returns envelope': (res) => {
      try {
        return typeof res.json().success === 'boolean';
      } catch {
        return false;
      }
    },
  });

  recordClockIn(response);

  if (mode !== 'race') {
    sleep(0.05);
  }
}
