<!--
status: canonical
scope: database/platform
read-when: Neon environment and tooling work
updated: 2026-09-17
-->

# Neon Integration Guide

> **Version:** 1.3.0 (`db:drift` guards the shared `dev` branch against an unlanded branch's migration, D333, 2026-09-19)
>
> **Version:** 1.2.0 (CI applies production migrations behind a Neon-branch rehearsal, D288, 2026-09-17)
>
> **Version:** 1.1.0 (per-branch trusted origins required by the same-origin auth proxy, D172, 2026-07-29)
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
npm run env:dev    # neon checkout dev + pull into .env + mirror PUBLIC_NEON_AUTH_BASE_URL
```

`env:dev` pins its target with `--file .env` rather than letting the CLI choose. `neon env pull` writes an existing `.env` but falls back to `.env.local` when none exists, so on a fresh clone or worktree an unpinned pull lands in a file `env:mirror`, dbmate and `npm run dev` never read — the dev server then fails before Astro starts (issue #398, 2026-09-17).

Production secrets for deploy scripts go in a separate file — never overwrite `.env`:

```sh
npm run env:prod   # neon env pull --branch main + mirror PUBLIC_NEON_AUTH_BASE_URL
```

`astro dev` loads `.env` / `.env.development`, not `.env.production`. Keep `.neon` on `dev` for local work.

Neon CLI env pull writes server-side keys only (`NEON_AUTH_BASE_URL`, …). Mirror writes `PUBLIC_NEON_AUTH_BASE_URL` (retained pending cleanup, out of scope). Browser auth proxies through `/api/auth` (D172) — app code no longer consumes client-side auth variables.

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

Migrations remain in `database/migrations/` (`0001`–`0040`).

Migration files must use dbmate section markers (`-- migrate:up` / `-- migrate:down`). See [`03-Migrations.md`](03-Migrations.md#dbmate-format).

Execution runs from `app/` via `package.json` scripts using `DATABASE_URL`.

Provision a fresh branch: `npm run db:migrate && npm run db:seed`.
Validate changes: `npm run validate:app` (sole definition: `app/CLAUDE.md`). <!-- 2026-07-14 -->

---

## Schema Drift on the Shared `dev` Branch

`dev` is one database shared by every task branch, while migrations live per git branch. Working a branch that adds a migration and running `npm run db:migrate` applies it to `dev` for everyone — and switching back to `main` does not undo it. `dev` then carries schema no committed migration describes, until that branch lands.

`dbmate status` does not report this. It enumerates the files under `database/migrations/` and prints each one's applied flag, so a `schema_migrations` row with no matching file produces no output at all and the summary still reads `Pending: 0`. On 2026-09-19 `dev` held migration `0039` (then numbered `0038`) from the never-pushed branch `fix/x01-checkout-percentage` — `v_double_out_checkout_darts` dropped, `v_x01_checkout_darts` created — while `db:status` reported `Applied: 37 / Pending: 0` (issue #503).

`npm run db:drift` (`app/scripts/check-migration-drift.ts`) is the check that sees it, and `validate:app` runs it between `db:migrate` and `db:introspect`:

| Comparison | Catches |
| --- | --- |
| `schema_migrations` → files | A migration applied from a branch this checkout does not have — the #503 case, invisible to `dbmate status` |
| files → `schema_migrations` | A migration never applied (`dbmate status` reports this one too) |
| live `v_*` views → the chain | A view created outside the migration chain, or left behind by a rollback |
| the chain → live `v_*` views | A view the chain creates that the database does not have; every read through it resolves to nothing |

The expected view set is replayed from each migration's `migrate:up` region in order — never `migrate:down`, which describes a schema deliberately not current. View *bodies* are out of scope: `app/tests/db/schema-view-drift.test.ts` compares bodies in `schema.ts` to the migrations, and nothing compares live bodies to either.

Position in the chain is the point. `db:introspect` regenerates `app/src/db/schema.ts` from whatever `dev` happens to be, and the unit suite mocks the query builder, so a committed schema missing a view the repositories read stays green. Stopping before introspect is what keeps that state out of the repo.

Resolving a finding: roll the foreign migration back (`npx dbmate --migrations-dir ../database/migrations rollback` with that branch's file present in the tree), or land the branch. Never write a new migration to reconcile `dev` — that encodes another branch's unlanded work as chain history. (2026-09-19, D333)

See also [`../../../database/README.md`](../../../database/README.md).

---

## Applying Migrations in CI (production)

Merging to `main` applies the pending chain to production before the Worker ships. `.github/workflows/deploy.yml` runs `quality` -> `rehearse` -> `migrate` -> `deploy`, inside the existing `deploy-production` concurrency group, so two merges cannot race the same migration and the Worker never runs ahead of its schema (D288, issue #293). <!-- 2026-09-17 -->

| Job | What it does | Against |
| --- | --- | --- |
| `rehearse` (`db-rehearsal.yml`) | Creates a throwaway Neon branch from `main`, applies migrations + seeds, confirms nothing is left pending, deletes the branch in an `always()` step | Ephemeral child of production |
| `migrate` | `db:status:ci` (into the run summary) -> `db:migrate:ci` -> `db:seed:ci` -> `db:status:ci` again | Production |
| `deploy` | Build + `wrangler deploy`, only after `migrate` succeeds | Production |

`db-rehearsal.yml` also runs on its own on any PR touching `database/migrations/**`, `database/seeds/**`, `database/verification/**`, the seed/verify runners, or `app/package.json`, so a faulty migration surfaces at review time rather than at merge time.

The `:ci` script variants (`db:status:ci`, `db:migrate:ci`, `db:seed:ci`, `db:verify:ci`) read `DATABASE_URL` straight from the environment instead of an `.env` file, which is what makes them runnable headless; dbmate is invoked with `--no-dump-schema` there because CI has no `pg_dump`. The `:prod` variants stay as they are for local, deliberate use.

Required secrets (values are set in GitHub's UI, never in a file, a log, or a PR):

| Secret | Scope | Used by |
| --- | --- | --- |
| `DATABASE_URL` | `production` environment | `migrate` — the production pooled connection string |
| `NEON_API_KEY` | Repository | `rehearse` — `neonctl` branch create/delete |

The Neon project id is not a secret and is read from committed `app/.neon`. Both jobs fail with an explicit message when their credential is missing, rather than failing opaquely further down.

`db:verify` is not part of the rehearsal. Its scripts assert on live data as well as on their own fixtures, and three open defects (#383, #384, #304) mean the suite cannot pass against production's rows at all; it stays a local, deliberate command until those are resolved (D288).

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
- Browser auth client: targets same-origin `/api/auth` proxy (never import `lib/env.ts` in browser code); proxy forwards server-side to `NEON_AUTH_BASE_URL`
- Identity mapping: JWT `sub` -> `players.auth_user_id`
- Unprovisioned users receive `403 PLAYER_NOT_PROVISIONED`

### Trusted origins (required per branch)

Browser auth traffic is proxied same-origin through `/api/auth/*` (D172), so every request Neon Auth receives carries the **app's** origin in its `Origin` header. Better Auth origin-checks that value against the branch's trusted-origins list on every non-GET request, so each deployed origin must be registered or sign-in returns `403 FORBIDDEN`:

| Branch | Origin to register |
| ------ | ------------------ |
| `dev` | `http://localhost:4321` |
| `main` | The deployed Worker URL (`https://<worker-name>.<subdomain>.workers.dev`, or the custom domain once configured) |

Registered in the Neon console under the project's Auth section — there is no committed file for this list.

### Dev auth user (out of band)

Sign-up UI is out of scope for v1. Provision the dev branch user once per environment:

| Step | Action |
| ---- | ------ |
| 1 | Enable email/password on the dev Neon Auth branch; disable email verification for local dev |
| 2 | Add trusted origin `http://localhost:4321` (see Trusted origins above) |
| 3 | Run `npm run env:dev` (checkout `dev` + pull into `.env` + mirror `PUBLIC_NEON_AUTH_BASE_URL`) |
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
