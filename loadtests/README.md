# Load tests (k6)

Optional stress checks against a **running** deployment (staging or local dev).

## Join magic-link throughput

```bash
# Local (demo seed org)
k6 run loadtests/join-magic-link.k6.js \
  -e BASE_URL=http://localhost:3000 \
  -e ORG_SLUG=demo-company \
  -e EMAIL_DOMAIN=example.com \
  -e VUS=50 \
  -e DURATION=30s

# Staging
k6 run loadtests/join-magic-link.k6.js \
  -e BASE_URL=https://your-staging.example.com \
  -e ORG_SLUG=your-org-slug \
  -e EMAIL_DOMAIN=yourcompany.com \
  -e VUS=100 \
  -e DURATION=60s
```

**Note:** This exercises `POST /api/join/request-magic-link` only. Full join completion (magic-link verify + `completeOrganizationJoin`) requires email delivery and browser/cookie flow — use integration tests in Vitest for DB concurrency instead.

Install k6: https://k6.io/docs/get-started/installation/
