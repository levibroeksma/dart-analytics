# Neon Project Correction — Design

> **Status:** Implemented (2026-07-09)
>
> **Scope:** Correct mistaken Neon provisioning (wrong project, polluted branches), provision a clean `dart-analytics` project, and deliver phased DB + Auth integration on `fix/neon-dart-analytics`.
>
> **Supersedes:** Provisioning steps in `2026-07-09-neon-db-integration-design.md` — architecture decisions there remain valid; this spec fixes execution mistakes only.
>
> **Authority:** Architecture SQL in `architecture/docs/database/` remains the sole schema source of truth.

---

## Problem Statement

The Neon integration implementation linked this repository to the wrong Neon project and applied migrations against a non-empty branch:

| Intended (approved design) | Actual state |
| --- | --- |
| New Neon project `dart-analytics` | Linked to `my-dart-counter` (`royal-math-16249645`) |
| Clean `main` / `preview` / `dev` branches | `production` + `dev` forked with **parent data** |
| Architecture-only schema on `dev` | Legacy tables (`game_catalog`, `game_sessions`, `user_preferences`, etc.) mixed with architecture tables |
| Fresh empty database | Existing database overwritten during migration |

The disbanded `my-dart-counter` application is no longer relevant. No data recovery is required. The fix is to provision a correct Neon project and re-apply the architecture migration chain on a clean `dev` branch.

---

## Goal

Deliver a correctly configured Neon environment for dart-analytics in three gated phases:

1. **Phase A** — Infrastructure: clean project, migrations, seeds, Neon Auth on `dev`
2. **Phase B** — Smoke test: verify DB connectivity and Auth JWKS from repo tooling
3. **Phase C** — Astro wiring: middleware, login stub, player provision endpoint

The `app/` shell (pages, layouts) remains placeholder beyond auth wiring. Full API implementation is out of scope.

---

## Approved Decisions

| Decision | Choice |
| --- | --- |
| Old Neon project | Delete `my-dart-counter` after Phase A gate passes |
| Git base branch | `neon-setup` |
| New fix branch | `fix/neon-dart-analytics` |
| Migration fixes | Cherry-pick dbmate conversion commits from `neon-db-integration-sdd` |
| App layer from worktree | Not carried over wholesale — rebuild per phase requirements |
| Neon project name | `dart-analytics` |
| Region | `aws-eu-central-1` |
| Branch model | `main` (prod), `preview`, `dev` — all scale-to-zero on (v1) |
| Local dev target | `dev` branch only (unmigrated `main`/`preview` until promotion) |
| Delivery | Phased A → B → C with explicit gates between phases |

---

## Section 1 — Git & Branch Strategy

### New branch

Create `fix/neon-dart-analytics` from `neon-setup`.

### Cherry-picks from `neon-db-integration-sdd`

| Commit | Purpose |
| --- | --- |
| `cd0e1a8` | Convert migrations 0001–0004 to dbmate format |
| `76f6b0a` | Convert migrations 0005–0008 to dbmate format |
| `d8a4050` | Convert migrations 0009–0012 to dbmate format |
| `d116262` | Add missing `stage_types` table to 0002 |
| `9e86842` | Document dbmate migration format requirements |

**Not cherry-picked in this correction:**

- Fallow fixes, introspected schema, middleware, API layer, player repository/service (added in Phases B/C as needed)
- Uncommitted worktree files

### Branch lifecycle

| Branch | Action |
| --- | --- |
| `fix/neon-dart-analytics` | Active implementation branch; opens PR to `main` when Gate C passes |
| `neon-setup` | Superseded by fix branch; close via PR merge |
| `neon-db-integration-sdd` | Archive after fix branch is green; remove worktree |

### Worktree cleanup (after Gate C)

```sh
git worktree remove .worktrees/neon-db-integration
# Delete branch neon-db-integration-sdd after PR merge
```

---

## Section 2 — Neon Infrastructure

### New project

| Property | Value |
| --- | --- |
| Name | `dart-analytics` |
| Region | `aws-eu-central-1` |
| PG version | 18 (org default) |
| Default branch | `main` (empty Postgres) |

### Provisioning sequence

```
1. create_project(name: "dart-analytics")
2. create_branch(name: "preview", parent: main)
3. create_branch(name: "dev", parent: main)
4. provision_neon_auth(projectId, branchId: dev)
5. neon link → dart-analytics
6. neon config apply (auth: true via neon.ts)
7. neon env dev → local .env
8. npm run db:migrate && npm run db:seed on dev
9. delete_project(my-dart-counter) — after Gate A passes
```

`main` and `preview` remain **unmigrated** until branch promotion. Only `dev` receives schema and seeds for local development.

### `app/neon.ts` (committed in Phase A)

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

### Local environment linking

```sh
neon auth
neon link          # target dart-analytics
neon env dev       # writes .env for dev branch
```

Required keys (documented in `app/.env.example`):

- `DATABASE_URL` — direct, non-pooler (Worker runtime)
- `DATABASE_URL_POOLED` — pooled (migrations, seeds, introspection)
- `NEON_AUTH_JWKS_URL`
- `NEON_AUTH_URL`

`.env` is gitignored. Never commit credentials.

### Teardown

Delete `my-dart-counter` (`royal-math-16249645`) only after Gate A passes. Requires explicit confirmation before `delete_project` runs.

### Expected `dev` schema after Phase A

- ~25 architecture tables + 5 views from migrations 0001–0012
- `neon_auth.*` tables from Auth provisioning
- `schema_migrations` (dbmate tracking)
- **No** legacy tables: `game_catalog`, `game_sessions`, `user_preferences`, `player_dart_stats`, etc.

---

## Section 3 — Phased Delivery

### Phase A — Infrastructure

**Goal:** Clean `dart-analytics` Neon project with schema + Auth on `dev`.

| Step | Action |
| --- | --- |
| A1 | Create branch `fix/neon-dart-analytics` from `neon-setup` |
| A2 | Cherry-pick migration commits (Section 1) |
| A3 | Add `app/neon.ts` and `package.json` db scripts |
| A4 | Provision Neon project + branches + Auth (Section 2) |
| A5 | Link repo, pull `.env`, run `db:migrate` + `db:seed` on `dev` |
| A6 | Delete `my-dart-counter` |

**Files added/modified:**

| File | Change |
| --- | --- |
| `architecture/docs/database/migrations/*.sql` | dbmate format (cherry-pick) |
| `architecture/docs/architecture/05-Database/03-Migrations.md` | dbmate format note (cherry-pick) |
| `architecture/docs/architecture/05-Database/11-Neon-Integration.md` | Cross-reference dbmate markers |
| `architecture/docs/database/README.md` | dbmate workflow note |
| `app/neon.ts` | New — Neon IaC config |
| `app/package.json` | Add `db:status`, `db:migrate`, `db:seed` scripts; add `postgres` devDependency |
| `app/scripts/seed.ts` | New — SQL seed runner for architecture seeds |

**`package.json` scripts (Phase A):**

```json
{
  "db:status": "dbmate --url \"$DATABASE_URL_POOLED\" --migrations-dir ../architecture/docs/database/migrations status",
  "db:migrate": "dbmate --url \"$DATABASE_URL_POOLED\" --migrations-dir ../architecture/docs/database/migrations up",
  "db:seed": "tsx scripts/seed.ts"
}
```

**`app/scripts/seed.ts` (Phase A):** Runs `0001_reference_data.sql` and `0002_default_templates.sql` from `architecture/docs/database/seeds/` via `postgres` + `DATABASE_URL_POOLED`. Requires `postgres` npm dependency.

**Gate A — must pass before Phase B:**

```sh
npm run db:status    # 12/12 applied, 0 pending
npm run db:migrate   # exit 0 (idempotent)
npm run db:seed      # exit 0
```

Manual verification: `dev` branch table list contains only architecture + `neon_auth` tables; no legacy tables.

---

### Phase B — Connectivity Smoke Test

**Goal:** Prove DB and Auth endpoints work from repo tooling.

| Step | Action |
| --- | --- |
| B1 | Add `app/scripts/smoke.ts` — `SELECT 1`, count `game_types`, fetch JWKS URL |
| B2 | Add `npm run smoke` script |
| B3 | Add `app/drizzle.config.ts` with `tablesFilter` excluding `pg_stat_statements` |
| B4 | Run `drizzle-kit introspect` → commit `app/src/db/schema.ts` |
| B5 | Add minimal `app/src/db/client.ts` + `app/src/lib/env.ts` (query-only) |

**Gate B — must pass before Phase C:**

```sh
npm run smoke              # DB query + JWKS fetch succeed
drizzle-kit introspect     # no drift vs committed schema.ts
```

---

### Phase C — Astro Auth Wiring

**Goal:** Shell app authenticates via Neon Auth; JWT flows through middleware.

| Step | Action |
| --- | --- |
| C1 | Add `app/src/middleware.ts` — verify JWT (`sub`, `exp`) via JWKS |
| C2 | Add `locals.auth` typing in `app/src/env.d.ts` |
| C3 | Add login page stub at `/login` using `NEON_AUTH_URL` |
| C4 | Protect `/profile` — redirect unauthenticated users to `/login` |
| C5 | Add `POST /api/players/provision` — creates `players` row linked to `auth_user_id` |
| C6 | Add `npm run validate:app` and `.fallowrc.jsonc` |

**Gate C — correction complete:**

```sh
npm run validate:app   # db:status + db:migrate + introspect + fallow + astro check
```

Manual verification:

1. Sign up / log in via Neon Auth
2. Call `POST /api/players/provision`
3. Access `/profile` with valid session

---

## Out of Scope

- Full API route implementation beyond player provision stub
- Frontend gameplay, statistics, or routine features
- CI pipeline wiring for Neon branches
- Migrations on `preview` or `main` (deferred to promotion workflow)
- PostgreSQL RLS
- Neon Data API
- Always-on production compute

---

## Non-goals

This correction does not revisit architecture schema decisions, migration content (beyond dbmate format), or API contract design. It fixes Neon project topology and delivers minimal auth wiring to validate the platform setup.

---

## Related Documents

| Document | Relationship |
| --- | --- |
| `2026-07-09-neon-db-integration-design.md` | Original integration design — architecture decisions still valid |
| `2026-07-09-validation-blockers-design.md` | dbmate format rationale — commits cherry-picked into this fix |
| `architecture/docs/architecture/05-Database/11-Neon-Integration.md` | Canonical Neon platform guide |
| `docs/superpowers/handoffs/2026-07-09-neon-db-integration-handoff.md` | Documents the mistakes this spec corrects |

---

## Success Criteria Summary

| Phase | Criteria |
| --- | --- |
| A | `dart-analytics` project exists; `dev` has clean architecture schema + seeds + Neon Auth; `my-dart-counter` deleted |
| B | `npm run smoke` green; `schema.ts` committed and matches DB |
| C | `npm run validate:app` green; manual auth + provision flow works |
