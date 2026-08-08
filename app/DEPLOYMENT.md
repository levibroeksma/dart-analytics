# Cloudflare Deployment Guide

**For:** Production deployment to Cloudflare (single Worker with Assets — frontend + API combined).
**Status:** Automated via GitHub Actions (`.github/workflows/deploy.yml`) on push to `main`. Worker secrets are one-time manual setup.
**Time:** ~15 minutes first-time secret setup; deploys after that are automatic on merge to `main`.

---

## Architecture

This app deploys as a **single Cloudflare Worker** (`wrangler.jsonc`, `name: "app"`) using the Workers Assets model:

- `assets.directory: ./dist` — the built Astro static output, served directly by the Worker
- `main: @astrojs/cloudflare/entrypoints/server` — the SSR/API entrypoint
- No separate Cloudflare Pages project. No named environments (`env.production`) in `wrangler.jsonc` — everything targets the single top-level Worker.

This means: **never pass `--env production` to `wrangler` commands** in this repo — there is no such environment defined, and doing so silently targets a nonexistent environment instead of erroring, which leaves the real Worker without its secrets.

---

## Prerequisites

- Node.js `>=22.12.0`
- Cloudflare account (free tier)
- Neon account with linked project (setup in `../docs/architecture/05-Database/11-Neon-Integration.md`)
- GitHub repository push access

**Verify:** Run `neon auth` and `wrangler login` before starting.

---

## Phase 1: Neon Production Database Setup

### 1.1 Authenticate to Neon

```bash
neon auth
neon link
```

### 1.2 Pull production connection strings

```bash
npm run env:prod
# Runs: neon env pull --branch main --file .env.production
# Then mirrors PUBLIC_NEON_AUTH_BASE_URL into the same file automatically
```

Verify:

```bash
grep -E "^[A-Z_]+=.*" .env.production | wc -l
# Expected: 6 (5 Neon vars + PUBLIC_NEON_AUTH_BASE_URL mirror)
```

### 1.3 Migrate schema to Neon main branch

```bash
set -a
source .env.production
set +a

npm run db:migrate     # through 0019
npm run db:seed        # 0007 fills the capability table
npm run db:migrate     # 0020 adds the composite FK
```

`0020` adds a composite foreign key from `exercise_sessions` to `ruleset_version_capabilities` and requires seed `0007` to have already run — applying `0020` before `0007` (or against a populated database whose sessions use a combination `0007` does not declare) fails on constraint validation.

Verify:

```bash
npm run db:status
# Expected: all migrations applied
```

---

## Phase 2: Cloudflare Worker Secrets (one-time, manual)

Secrets are bound to the Worker on Cloudflare's side and **persist across every future `wrangler deploy`** — including automated CI deploys. You only need to do this once (or when a credential rotates).

### 2.1 Authenticate to Cloudflare

```bash
wrangler login
wrangler whoami
```

### 2.2 Set Worker secrets

```bash
set -a
source .env.production
set +a

wrangler secret put DATABASE_URL
wrangler secret put DATABASE_URL_UNPOOLED
wrangler secret put NEON_AUTH_JWKS_URL
wrangler secret put NEON_AUTH_BASE_URL
```

Each command prompts — paste the value, press Enter. **Do not add `--env production`.**

Verify:

```bash
wrangler secret list
# Expected: lists all 4 secret names (no values shown)
```

---

## Phase 3: GitHub Actions Deploy Secrets and Variables (one-time, manual)

`.github/workflows/deploy.yml` needs its own credentials to authenticate `wrangler deploy` from CI — separate from the Worker secrets above.

1. Cloudflare Account ID: https://dash.cloudflare.com → right sidebar → "Account ID"
2. Cloudflare API Token: https://dash.cloudflare.com/profile/api-tokens → "Create Token" → "Edit Cloudflare Workers" template
3. GitHub repo → Settings → Environments → `production` → add secrets:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`

**Must be under the `production` Environment**, not repo-level secrets or a different environment — `deploy.yml`'s `deploy` job runs with `environment: production`, so only secrets scoped there are visible to it.

### `PUBLIC_NEON_AUTH_BASE_URL` build variable (not a secret, no longer required by app code)

Browser auth traffic now goes through the same-origin `/api/auth` proxy (D172): `app/src/lib/client/auth/client.ts` builds its base URL from `globalThis.location.origin` and no longer reads `PUBLIC_NEON_AUTH_BASE_URL` at all — the throw-on-missing guard is gone with it. The server-side `NEON_AUTH_BASE_URL` Worker secret (Phase 2) is what the proxy forwards to and remains required.

`.github/workflows/deploy.yml`'s build step still forwards `vars.PUBLIC_NEON_AUTH_BASE_URL` into `npm run build`, but no application code consumes it anymore, so leaving it unset no longer breaks anything. Setting it is optional — kept here so the build step's env has a value instead of silently going unset:

- GitHub repo → Settings → Environments → `production` → Variables → `PUBLIC_NEON_AUTH_BASE_URL`
- Value: same as `NEON_AUTH_BASE_URL` in `.env.production` — this is project-specific, not a shared Neon domain (shape: `https://ep-<branch-id>.neonauth.<region>.aws.neon.tech/<database>/auth`); find it in the Neon console under your project's Auth section, or from a prior `neon env main` pull

---

## Phase 4: Deploy

Deploys are automatic: every push to `main` triggers `.github/workflows/deploy.yml`, which runs quality checks, builds, and deploys via `wrangler deploy` (no `--env` flag — targets the single Worker).

**Manual deploy (optional, e.g. for local testing):**

```bash
npm run build
wrangler deploy
```

### Verify deployment

```bash
wrangler deployments list
# Shows recent deployments and the live Worker URL
```

Test the live URL (get the exact URL from `wrangler deployments list` or the Cloudflare dashboard — it's `<worker-name>.<your-subdomain>.workers.dev` unless a custom domain is configured):

```bash
curl -X GET https://<your-worker-url>/api/sessions/active
# Expected: {"ok":false,"error":{"code":"UNAUTHORIZED",...}}
```

If this returns a 500 or a raw stack trace instead of the JSON envelope above, the Worker secrets from Phase 2 are missing or malformed — re-run Phase 2.

---

## Phase 5: Monitoring

**Neon dashboard:** https://console.neon.tech → main branch → Monitoring (query count, compute)

**Cloudflare dashboard:** https://dash.cloudflare.com → Workers & Pages → `app` → Logs / Analytics (request count, errors, CPU time)

**Live tail (real-time debugging):**

```bash
wrangler tail
```

Run this while reproducing an issue in the browser — it streams the Worker's real runtime logs and errors, which is the fastest way to diagnose a live failure.

---

## Rollback

```bash
wrangler deployments list
wrangler rollback [deployment-id]
```

---

## Troubleshooting

**`TypeError: Invalid header value` at runtime**

- Almost always means `DATABASE_URL_UNPOOLED` (or another secret) is unset/undefined on the live Worker, so `neon(undefined)` fails constructing its request headers.
- Fix: re-run Phase 2 **without** `--env production`. Confirm with `wrangler secret list` (no `--env` flag) that all 4 secrets exist.
- Confirm with `wrangler tail` while reproducing — the log will show which module/line throws.

**Deploy succeeds in CI but the secret fix doesn't take effect**

- CI's `wrangler deploy` only pushes code; it does not touch secrets. Worker secrets are bound independently via `wrangler secret put` and are not part of the deployed bundle.

**`wrangler: command not found`**

- Run from `app/` — it resolves via the local `node_modules/.bin` when run through `npm run` scripts, or `npx wrangler`.

**"Account ID mismatch" / auth errors**

- Run `wrangler whoami` to confirm which account is authenticated locally.
- For CI failures, confirm `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are set under the `production` GitHub Environment (Phase 3).

---

## References

- Spec: `../../docs/superpowers/specs/2026-07-24-cloudflare-deployment-specs.md`
- Neon setup: `../../docs/architecture/05-Database/11-Neon-Integration.md`
- API contract: `../../docs/architecture/06-API/00-Overview.md`
- Local dev: `./README.md`
- Deploy workflow: `../.github/workflows/deploy.yml`
