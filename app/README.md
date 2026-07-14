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
neon env dev
```

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
