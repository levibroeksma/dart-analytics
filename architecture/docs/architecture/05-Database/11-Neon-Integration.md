<!--
status: canonical
scope: database/platform
read-when: Neon environment and tooling work
updated: 2026-07-11
-->

# Neon Integration Guide

> **Version:** 1.0.0
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
neon checkout dev
```

---

## Connection String Rules

| Use case | Variable | Notes |
| --- | --- | --- |
| Worker runtime (`getDb()`) | `DATABASE_URL` | Neon-pulled; used by `@neondatabase/serverless` |
| Migrations / seeds / introspection | `DATABASE_URL_POOLED` | Local alias — set to Neon’s pooled `DATABASE_URL` value |
| Reference only | `DATABASE_URL_UNPOOLED` | Pulled by Neon CLI; not used by dbmate scripts |

Neon CLI (`neon checkout`, `neon env pull`) writes `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, and auth vars. Copy the pooled `DATABASE_URL` into `DATABASE_URL_POOLED` for dbmate and Drizzle introspection (see `app/.env.example`).

---

## Environment Variables

Source template: `app/.env.example`

Neon-pulled keys:

- `DATABASE_URL`
- `DATABASE_URL_UNPOOLED`
- `NEON_AUTH_BASE_URL`
- `NEON_AUTH_JWKS_URL`

Local alias (manual):

- `DATABASE_URL_POOLED` — same value as Neon’s pooled `DATABASE_URL`

Never commit `.env`.

---

## Migration Workflow (`dbmate`)

Migrations remain in `architecture/docs/database/migrations/` (`0001`–`0014`).

Migration files must use dbmate section markers (`-- migrate:up` / `-- migrate:down`). See [`03-Migrations.md`](03-Migrations.md#dbmate-format).

Execution runs from `app/` via `package.json` scripts using `DATABASE_URL_POOLED`.

Standard workflow:

```sh
npm run db:status
npm run db:migrate
npm run db:seed
drizzle-kit introspect
npx fallow
astro check
```

See also [`../../database/README.md`](../../database/README.md).

---

## Drizzle Workflow (Introspect-Only)

- Allowed: `drizzle-kit introspect`
- Not allowed: `drizzle-kit generate`, `drizzle-kit push`

`app/src/db/schema.ts` is generated from the live schema; architecture SQL remains source of truth.

---

## Neon Auth and Identity

- Authentication provider: Neon Auth
- API boundary verifies JWT claims (`sub`, `exp`) via `NEON_AUTH_JWKS_URL`
- Frontend/auth client uses `NEON_AUTH_BASE_URL`
- Identity mapping: JWT `sub` -> `players.auth_user_id`
- Unprovisioned users receive `403 PLAYER_NOT_PROVISIONED`

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
- [`../../database/README.md`](../../database/README.md)
- [`../../../../app/CLAUDE.md`](../../../../app/CLAUDE.md)
