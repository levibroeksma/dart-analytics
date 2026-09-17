# Cloudflare Deployment Guide

**For:** Production deployment to Cloudflare (single Worker with Assets — frontend + API combined).
**Status:** Automated via GitHub Actions (`.github/workflows/deploy.yml`) on push to `main` — schema rehearsal, production migrations + seeds, then the Worker (D288). Worker secrets and the two database credentials are one-time manual setup.
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

npm run db:migrate     # expected to STOP at 0020 — see below
npm run db:seed        # 0007 fills the capability table
npm run db:migrate     # 0020 and 0021 now apply
```

`0020` adds a composite foreign key from `exercise_sessions` to `ruleset_version_capabilities` and requires seed `0007` to have already run — applying `0020` before `0007` (or against a populated database whose sessions use a combination `0007` does not declare) fails on constraint validation.

**The first `db:migrate` failing at `0020` is expected on a populated database.** `db:migrate` is `dbmate up`, which takes no target version and applies everything pending in one run: it commits `0019`, then stops at `0020` because the capability table is not yet seeded. Seed, then re-run to apply `0020` and `0021`. Against an empty `exercise_sessions` the first run goes straight through, so the stop is data-dependent — production will hit it, a fresh environment will not.

Before the second `db:migrate`, run `npm run db:verify 0007` and read check 3's `undeclared` / `total` detail rather than the summary line: it is the precondition `0020` validates against, and it passes trivially when `exercise_sessions` is empty.

Verify:

```bash
npm run db:status
# Expected: all migrations applied
```

**This phase is one-time for a fresh environment.** Since 2026-09-17 (D288, issues #293/#354) every merge to `main` applies the pending chain to production itself: `deploy.yml` runs `quality → rehearse → migrate → deploy`, where `rehearse` replays migrations + seeds + `db:verify` on a throwaway Neon branch cut from production, and `migrate` then applies them to production before the Worker ships. A PR that adds a migration or edits `database/seeds/**` no longer needs a manual production step, and a migration that fails blocks the deploy instead of shipping a Worker onto a schema it does not have.

That path requires the two credentials in Phase 3.2. Until they are set, the `migrate` job fails with an explicit message and nothing deploys.

The manual commands below remain correct for provisioning a new branch, or for recovering when CI cannot run:

```bash
set -a
source .env.production
set +a

npm run db:status    # what is pending
npm run db:migrate   # only if a migration is pending
npm run db:seed      # if the PR touched database/seeds/** at all — always safe, idempotent
```

Seeds are idempotent (`ON CONFLICT DO NOTHING`), so re-running `db:seed` is cheap insurance even when unsure whether it already ran — which is also why the `migrate` job runs them on every deploy.

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

### 3.2 Database credentials for the `migrate` and `rehearse` jobs

`deploy.yml`'s `migrate` job and `db-rehearsal.yml`'s `rehearse` job need database access CI did not previously hold (D288). Neither value may ever be written into a file, a log, an issue or a PR — enter them in GitHub's UI only.

| Secret         | Where it goes                                                   | Value                                                                                                                                    | Used by                                       |
| -------------- | --------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| `DATABASE_URL` | Settings → Environments → `production` → secrets                | Production (`main` branch) **pooled** connection string — the `DATABASE_URL` line from `.env.production`, produced by `npm run env:prod` | `migrate` (dbmate + seeds against production) |
| `NEON_API_KEY` | Settings → Secrets and variables → Actions → repository secrets | Neon console → your profile → **API keys** → create a key scoped to this project                                                         | `rehearse` (`neonctl` branch create/delete)   |

`NEON_API_KEY` is repo-level rather than environment-scoped because `db-rehearsal.yml` also runs on PRs, where the `production` environment is not in play. The Neon project id is _not_ a secret — it is read from committed `app/.neon`.

Verify after adding both: merge any change to `main` and confirm `deploy.yml`'s run shows `rehearse` and `migrate` green with the pending list in the run summary.

**Rotation:** rotating either value is a GitHub-UI edit only; no workflow change is needed. If the Neon key is revoked, `rehearse` fails closed and the deploy is blocked — which is the intended direction.

### `PUBLIC_NEON_AUTH_BASE_URL` build variable (not a secret, no longer required by app code)

Browser auth traffic now goes through the same-origin `/api/auth` proxy (D172): `app/src/lib/client/auth/client.ts` builds its base URL from `globalThis.location.origin` and no longer reads `PUBLIC_NEON_AUTH_BASE_URL` at all — the throw-on-missing guard is gone with it. The server-side `NEON_AUTH_BASE_URL` Worker secret (Phase 2) is what the proxy forwards to and remains required.

`.github/workflows/deploy.yml`'s build step still forwards `vars.PUBLIC_NEON_AUTH_BASE_URL` into `npm run build`, but no application code consumes it anymore, so leaving it unset no longer breaks anything. Setting it is optional — kept here so the build step's env has a value instead of silently going unset:

- GitHub repo → Settings → Environments → `production` → Variables → `PUBLIC_NEON_AUTH_BASE_URL`
- Value: same as `NEON_AUTH_BASE_URL` in `.env.production` — this is project-specific, not a shared Neon domain (shape: `https://ep-<branch-id>.neonauth.<region>.aws.neon.tech/<database>/auth`); find it in the Neon console under your project's Auth section, or from a prior `neon env main` pull

---

## Phase 4: Deploy

Deploys are automatic: every push to `main` triggers `.github/workflows/deploy.yml`, which runs quality checks, rehearses the schema change on a throwaway Neon branch, applies migrations and seeds to production, then builds and deploys via `wrangler deploy` (no `--env` flag — targets the single Worker). The whole run is inside the `deploy-production` concurrency group, so two merges cannot race the same migration.

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
