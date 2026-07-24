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

For manual Cloudflare deployment (Neon + Workers + Pages), see **[DEPLOYMENT.md](./DEPLOYMENT.md)**.

**First-time setup:** ~30 minutes (includes Neon auth, Wrangler secrets, Pages setup)  
**Repeat deploys:** merge to `main` — GitHub Actions deploys after Environment approval.

**Phases:**

1. Neon production database (schema migration, credentials)
2. Cloudflare Workers API (build, secrets, deploy)
3. Cloudflare Pages frontend (GitHub auto-deploy)
4. End-to-end validation (monitoring dashboards)

GitHub Actions automation (post-launch) will streamline steps 2–3 into one-click merges.

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
