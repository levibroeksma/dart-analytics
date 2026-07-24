<!--
status: canonical
scope: database/platform
read-when: Neon environment and tooling work
updated: 2026-07-24
-->

# Neon Integration Guide

> **Version:** 1.0.1
>
> Canonical implementation guide for Neon project topology, environment setup, and migration/query tooling in this repository.

---

## Purpose

This document defines how the architecture maps to Neon for local development and deployment.

It complements:

- `00-OVERVIEW.md` (database philosophy)
- `03-Migrations.md` (migration strategy)
- `06-API/00-Overview.md` (API runtime and auth contract)

---

## Neon Project Topology (v1)

| Branch | Role | Compute |
| --- | --- | --- |
| `main` | Production | Scale-to-zero on |
| `preview` | Preview deploys | Scale-to-zero on |
| `dev` | Shared local development | Scale-to-zero on |

- Region: `aws-eu-central-1` (Frankfurt)
- Always-on production compute is deferred post-v1.
- Non-`main` branches are created as children of `main`.

---

## `neon.ts` Configuration

Use `@neon/config/v1` with a `branch` callback (not a static `branches` map):

```typescript
import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  auth: true,
  branch: (branch) => ({
    protected: branch.name === "main",
    ...(branch.name === "main" ? {} : { parent: "main" }),
    postgres: {
      computeSettings: {
        autoscalingLimitMinCu: 0.25,
        suspendTimeout: "5m",
      },
    },
  }),
});
```

- Data API remains deferred for v1.
- Typed env parsing: `parseEnv(config)` in `app/src/lib/env.ts` (requires all vars implied by config).

Provisioning sequence:

```sh
neon init
neon config apply
```

Branch workflow:

```sh
neon link
npm run env:dev    # neon checkout dev + mirror PUBLIC_NEON_AUTH_BASE_URL into .env
```

Production secrets for deploy scripts go in a separate file — never overwrite `.env`:

```sh
npm run env:prod   # neon env pull --branch main --file .env.production + PUBLIC_ mirror
```

`astro dev` loads `.env` / `.env.development`, not `.env.production`. Keep `.neon` on `dev` for local work.

Neon CLI env pull writes only Neon keys (`NEON_AUTH_BASE_URL`, …). Astro browser code needs `PUBLIC_NEON_AUTH_BASE_URL` — `npm run env:mirror` (and `env:dev` / `env:prod`) copies it. Manual copy is not required after those scripts.

---

## Connection String Rules

**Verified 2026-07-15** against a real `neonctl link` on the linked Neon project: `DATABASE_URL`'s hostname contains `-pooler`, confirming it is the pooled connection string. This reverses an earlier unverified assumption.

| Use case | Variable | Notes |
| --- | --- | --- |
| Migrations / seeds / introspection | `DATABASE_URL` | Pooled connection — hostname WITH `-pooler`; consumed directly by the dbmate npm scripts and `drizzle.config.ts` |
| Worker runtime (`getDb()`) | `DATABASE_URL_UNPOOLED` | Direct connection — hostname WITHOUT `-pooler` |

There is no separate `DATABASE_URL_POOLED` alias — `neonctl link` never produces one, and requiring a manually-maintained duplicate of `DATABASE_URL` was the root cause of the earlier contradiction. This table is the sole owner of connection-variable semantics; `app/.env.example` mirrors it.

---

## Environment Variables

Source template: `app/.env.example`

Neon-pulled keys (all 5, via `neonctl link` / `neon dev`):

- `NEON_BRANCH`
- `DATABASE_URL` (pooled)
- `DATABASE_URL_UNPOOLED` (direct)
- `NEON_AUTH_BASE_URL`
- `NEON_AUTH_JWKS_URL`

No manual aliasing required — every variable the app or tooling needs comes straight from `neonctl link`.

Never commit `.env`.

---

## Migration Workflow (`dbmate`)

Migrations remain in `database/migrations/` (`0001`–`0016`).

Migration files must use dbmate section markers (`-- migrate:up` / `-- migrate:down`). See [`03-Migrations.md`](03-Migrations.md#dbmate-format).

Execution runs from `app/` via `package.json` scripts using `DATABASE_URL`.

Provision a fresh branch: `npm run db:migrate && npm run db:seed`.
Validate changes: `npm run validate:app` (sole definition: `app/CLAUDE.md`). <!-- 2026-07-14 -->

See also [`../../../database/README.md`](../../../database/README.md).

---

## Drizzle Workflow (Introspect-Only)

- Allowed: `drizzle-kit introspect`
- Not allowed: `drizzle-kit generate`, `drizzle-kit push`

`app/src/db/schema.ts` is generated from the live schema; architecture SQL remains source of truth.

---

## Neon Auth and Identity

- Authentication provider: Neon Auth
- API boundary verifies JWT claims (`sub`, `exp`) via `NEON_AUTH_JWKS_URL`
- Server auth base URL: `NEON_AUTH_BASE_URL` (middleware, seeds)
- Browser auth client: `PUBLIC_NEON_AUTH_BASE_URL` (`import.meta.env` — never import `lib/env.ts` in browser code)
- Identity mapping: JWT `sub` -> `players.auth_user_id`
- Unprovisioned users receive `403 PLAYER_NOT_PROVISIONED`

### Dev auth user (out of band)

Sign-up UI is out of scope for v1. Provision the dev branch user once per environment:

| Step | Action |
| ---- | ------ |
| 1 | Enable email/password on the dev Neon Auth branch; disable email verification for local dev |
| 2 | Add trusted origin `http://localhost:4321` |
| 3 | Run `npm run env:dev` (checkout `dev` + mirror `PUBLIC_NEON_AUTH_BASE_URL`) |
| 4 | Run `npm run seed:dev-auth` from `app/` |

Default dev credentials are documented in `app/scripts/seed-dev-auth.ts` header only (`levi@broeksma.nl` / `admin`, name `Levi`).

Alpine templates use v3 shorthand (`:attr`, `@event`) per D100 — see `07-Frontend/03-Alpine-Patterns.md`.

---

## Branch Promotion

Promotion path:

`dev` -> `preview` -> `main`

Apply migrations per branch during promotion.

---

## Security Model (v1)

- Worker service-role connection only
- No direct database access from frontend
- PostgreSQL RLS deferred post-v1

---

## Related Documents

- `00-OVERVIEW.md`
- `03-Migrations.md`
- `10-Database-Agent-Guide.md`
- `../06-API/00-Overview.md`
- [`../../../database/README.md`](../../../database/README.md)
- [`../../../app/CLAUDE.md`](../../../app/CLAUDE.md)
