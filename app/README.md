# Dart Analytics App

**Astro frontend + Worker API for long-term darts progression tracking, backed by Neon Postgres.**

```sh
cp .env.example .env
npm install
npm run dev
```

## Prerequisites

- Node.js `>=22.12.0`
- Neon CLI (`npx -y neon@latest`)
- Access to the Neon project/branches described in architecture docs

## Quick Start

1. Copy environment template:

```sh
cp .env.example .env
```

2. Authenticate and pull dev environment values:

```sh
neon auth
npm run env:dev
```

(`env:dev` checks out Neon `dev`, pulls vars into `.env`, and mirrors `PUBLIC_NEON_AUTH_BASE_URL`. Use `npm run env:prod` for `.env.production` — never pull `main` into `.env`.)

3. Install dependencies:

```sh
npm install
```

Hooks: `npm install` runs `prepare`, which installs repo-root husky hooks (Prettier on commit).

4. Start local development:

```sh
astro dev --background
```

Use:

```sh
astro dev status
astro dev logs
astro dev stop
```

## Production Deployment

Production deploys are **CI-only** (GitHub Actions). There is no local `npm run deploy`.

**Happy path**

1. Open a PR to `main` — workflow `checks` runs the shared `quality` suite (structure scripts, format, `astro check`, fallow, `npm test`).
2. Merge when green.
3. Push to `main` runs workflow `deploy`: the same `quality` suite again, then job `deploy` waits on GitHub Environment **`production`** approval.
4. After Approve: `npm run build` + `npx wrangler deploy` (Worker + assets via `wrangler.jsonc`).

**Formatting**

- Local: husky pre-commit runs Prettier on staged files after `npm install` in `app/`.
- Before PR: `npm run format` then `npm run format:check` (agents: mandatory).
- CI: `format:check` only — does not auto-write.

**One-time operator setup**

| Item                                  | Where                                                           |
| ------------------------------------- | --------------------------------------------------------------- |
| Cloudflare API token (Workers deploy) | Create in Cloudflare dashboard                                  |
| `CLOUDFLARE_API_TOKEN`                | GitHub secret (repo or Environment `production`)                |
| `CLOUDFLARE_ACCOUNT_ID`               | GitHub secret (same)                                            |
| Environment `production`              | GitHub → Settings → Environments → required reviewers           |
| Branch protection on `main`           | Require status checks `quality / structure` and `quality / app` |

Worker runtime secrets (`DATABASE_URL`, `DATABASE_URL_UNPOOLED`, auth JWKS, etc.) stay in Cloudflare (`wrangler secret` / dashboard). Neon schema migrate is **not** part of deploy — run locally against prod when needed.

First-time Neon + Worker secret bootstrap notes (historical): `docs/superpowers/specs/2026-07-24-cloudflare-deployment-specs.md`.

## Validation Standard Procedure

Run this before closing an `app/` task:

```sh
npm run db:status
npm run db:migrate
drizzle-kit introspect
npx fallow
astro check
```

## Knowledge graph (optional but recommended)

`graphify-out/graph.json` is committed — no rebuild needed to browse the map. For auto-refresh on commit:

```sh
uv tool install graphifyy    # or: pipx install graphifyy
pip install "graphifyy[sql]" # SQL migration parsing
graphify hook install
```

See root `CLAUDE.md` and `app/CLAUDE.md` for query commands and the completion-gate refresh step.

## Architecture References

- `../docs/architecture/README.md`
- `../docs/architecture/06-API/00-Overview.md`
- `../docs/architecture/05-Database/11-Neon-Integration.md`
- `./CLAUDE.md`
