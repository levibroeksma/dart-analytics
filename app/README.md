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

## Architecture References

- `../architecture/docs/architecture/README.md`
- `../architecture/docs/architecture/06-API/00-Overview.md`
- `../architecture/docs/architecture/05-Database/11-Neon-Integration.md`
- `./CLAUDE.md`
