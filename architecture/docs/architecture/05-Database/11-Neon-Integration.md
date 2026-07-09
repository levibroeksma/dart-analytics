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

---

## `neon.ts` Configuration

Use `@neon/config` to declare branch-level services and policy:

- `auth: true`
- Data API remains deferred for v1

Provisioning sequence:

```sh
neon init
neon config apply
```

---

## Connection String Rules

| Use case | Variable | Type |
| --- | --- | --- |
| Worker runtime | `DATABASE_URL` | Direct, non-pooler |
| Migrations / seeds / introspection | `DATABASE_URL_POOLED` | Pooled (`-pooler`) |

---

## Environment Variables

Source template: `app/.env.example`

Required keys:

- `DATABASE_URL`
- `DATABASE_URL_POOLED`
- `NEON_AUTH_JWKS_URL`
- `NEON_AUTH_URL`

Never commit `.env`.

---

## Migration Workflow (`dbmate`)

Migrations remain in `architecture/docs/database/migrations/`.

Execution runs from `app/` with:

- `DBMATE_MIGRATIONS_DIR=../architecture/docs/database/migrations`
- pooled connection URL

Standard workflow:

```sh
npm run db:status
npm run db:migrate
npm run db:seed
drizzle-kit introspect
npx fallow
astro check
```

---

## Drizzle Workflow (Introspect-Only)

- Allowed: `drizzle-kit introspect`
- Not allowed: `drizzle-kit generate`, `drizzle-kit push`

`app/src/db/schema.ts` is generated from the live schema; architecture SQL remains source of truth.

---

## Neon Auth and Identity

- Authentication provider: Neon Auth
- API boundary verifies JWT claims (`sub`, `exp`)
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
- `../../database/README.md`
- `../../../app/AGENT.md`
