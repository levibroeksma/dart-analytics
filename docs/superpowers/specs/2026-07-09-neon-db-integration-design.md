# Neon DB Integration — Design

> **Status:** Approved (brainstorming session 2026-07-09)
>
> **Scope:** Neon project provisioning, migration execution, Drizzle query layer, Neon Auth, and Worker connection patterns for `app/`.
>
> **Authority:** Architecture SQL in `architecture/docs/database/` remains the sole schema source of truth.

---

## Goal

Stand up a new Neon PostgreSQL project (Frankfurt) with `dev` / `preview` / `prod` branches, apply the frozen migration chain (`0001`–`0012`) and seeds, provision Neon Auth, and wire a typed Drizzle query layer into Cloudflare Workers — without changing the architecture's schema ownership model.

## Non-goals (phase 1)

- Implementing API route handlers (covered by `06-API/` docs; separate implementation plan)
- PostgreSQL RLS (deferred post-v1 per `00-Overview.md`)
- Neon Data API (Worker uses `@neondatabase/serverless` directly)
- Drizzle-owned migrations (`drizzle-kit generate`)
- Local Docker Postgres (shared Neon `dev` branch instead)
- Read replicas or materialized views
- Always-on production compute (`main` min 1.0 CU) — deferred until Launch plan or latency needs it

---

## Approved Decisions

| Decision            | Choice                                                             |
| ------------------- | ------------------------------------------------------------------ |
| Schema authority    | `architecture/docs/database/migrations/` + seeds                   |
| ORM role            | Drizzle for queries/types only (hybrid)                            |
| Migration runner    | `dbmate`                                                           |
| Neon project        | New project, Frankfurt region                                      |
| Branches            | `main` (prod), `preview`, `dev`                                    |
| Compute (v1)        | Scale-to-zero **on** all branches (personal use; Free-tier friendly) |
| Always-on `main`    | **Deferred** — min 1.0 CU, scale-to-zero off when on Launch plan     |
| Local dev           | Shared persistent `dev` branch                                     |
| Auth                | Neon Auth in phase 1                                               |
| API runtime         | Astro REST server endpoints on Cloudflare Workers                  |
| Player provisioning | Explicit `POST /api/players/provision` after first login           |
| Documentation       | Update architecture docs, READMEs, AGENT files; add `.env.example` |

---

## Section 1 — Neon Project Topology

### Project

- **Name:** `dart-analytics`
- **Region:** `aws-eu-central-1` (Frankfurt) — minimizes latency to European Cloudflare Workers edge

### Branch model

| Branch    | Role                       | Compute (v1)           |
| --------- | -------------------------- | ---------------------- |
| `main`    | Production                 | Scale-to-zero **on**   |
| `preview` | Cloudflare preview deploys | Scale-to-zero **on**   |
| `dev`     | Shared local development   | Scale-to-zero **on**   |

**Deferred (post-v1 / Launch plan):** `main` always-on with min 1.0 CU and scale-to-zero disabled — when production latency or traffic justifies paid compute.

- Neon's default `main` branch serves as production.
- `dev` and `preview` are child branches created from `main`.
- Local development always targets `dev` via `.env` / `neon env`.

### Infrastructure as code

`app/neon.ts` via `@neon/config`:

```typescript
auth: true;
// dataApi: false — deferred; Worker uses serverless driver
```

Per-branch compute policy declared in `neon.ts` (v1: scale-to-zero on all branches). Provisioning flow:

```
neon init → neon config apply → branches inherit policy
```

### Connection strings

| Context                         | String type                                 |
| ------------------------------- | ------------------------------------------- |
| Workers (runtime)               | Direct (non-pooler) — HTTP/WebSocket driver |
| Migrations / seeds (local + CI) | Pooled (`-pooler` hostname)                 |

### Environment variables

```
DATABASE_URL          # Worker runtime (direct)
DATABASE_URL_POOLED   # dbmate migrate/seed
NEON_AUTH_*           # from neon.ts / Neon Auth provisioning
```

See **Section 7** for the committed `.env.example` template.

### Security (v1)

- Credentials in environment only — never committed.
- `.env` in `.gitignore`.
- Worker uses trusted service-role DB access (no client-side DB access).
- PostgreSQL RLS deferred post-v1.

---

## Section 2 — Migration & Schema Layer

### Source of truth

```
architecture/docs/database/
├── migrations/0001–0012.sql   ← schema authority
└── seeds/0001–0002.sql        ← reference + system templates
```

New schema changes: write `0013_<description>.sql` in architecture, update `03-Migrations.md` and `06-Database-Specification.md`. Drizzle never generates migrations.

### dbmate configuration

Runner lives in `app/`; SQL files stay in `architecture/`:

```
DATABASE_URL=<pooled connection to target branch>
DBMATE_MIGRATIONS_DIR=../architecture/docs/database/migrations
DBMATE_SCHEMA_FILE=../architecture/docs/database/schema.sql
```

### npm scripts (`app/package.json`)

| Script        | Action                               |
| ------------- | ------------------------------------ |
| `db:migrate`  | Apply pending migrations             |
| `db:rollback` | Roll back last migration             |
| `db:seed`     | Run seeds in order (custom script)   |
| `db:reset`    | Drop + migrate + seed (**dev only**) |
| `db:status`   | Show applied vs pending              |

**Seeds:** dbmate handles migrations only. `app/scripts/seed.ts` runs `0001_reference_data.sql` then `0002_default_templates.sql` in order against the pooled URL.

**Tracking:** dbmate `schema_migrations` table.

### Drizzle role (query layer only)

```
architecture SQL → dbmate apply → Neon DB
                                      ↓
                              drizzle-kit introspect
                                      ↓
                         app/src/db/schema.ts (generated, read-only)
```

- `drizzle-kit introspect` after migrations to regenerate `schema.ts`.
- **No `drizzle-kit generate`.**
- Repositories import from `schema.ts` + `drizzle-orm/neon-http`.
- Re-introspect whenever a new architecture migration lands.

### Ongoing schema change workflow

1. Write `0013_<description>.sql` in `architecture/docs/database/migrations/`.
2. Update `06-Database-Specification.md` + `03-Migrations.md`.
3. `db:migrate` on `dev`.
4. `drizzle-kit introspect` → commit updated `schema.ts`.
5. Promote: `dev` → `preview` → `main` (migration applied per branch).

### Phase 1 migration scope

Apply full chain `0001`–`0012` + both seeds on `dev` during initial setup.

---

## Section 3 — Connection Layer & Repository Pattern

### Runtime stack

```
Astro endpoint → Middleware → Service → Repository → Drizzle → @neondatabase/serverless
```

| Package                                 | Role                                           |
| --------------------------------------- | ---------------------------------------------- |
| `@neondatabase/serverless`              | HTTP/WebSocket driver (no TCP pool on Workers) |
| `drizzle-orm` + `drizzle-orm/neon-http` | Typed queries                                  |
| `app/src/db/schema.ts`                  | Introspected mirror (read-only)                |

### DB client (`app/src/db/client.ts`)

- `neon(DATABASE_URL)` per request — stateless, correct for isolated Workers.
- `drizzle({ client: sql, schema })`.
- Exported as `getDb()` factory — no module-scope pool.
- Runtime uses direct (non-pooler) `DATABASE_URL`.

### Repository pattern (CQRS-lite)

| Operation | Target         | Examples                                  |
| --------- | -------------- | ----------------------------------------- |
| Writes    | Runtime tables | `exercise_sessions`, `turns`, `darts`     |
| Reads     | Views (`v_*`)  | `v_active_sessions`, `v_session_overview` |

### Folder structure

```
app/src/
├── db/
│   ├── client.ts
│   └── schema.ts          # introspected (generated)
├── repositories/
│   ├── session.repository.ts
│   ├── session-read.repository.ts
│   └── player.repository.ts
└── services/
    └── session.service.ts
```

**Rules:**

- Repositories never parse JWT.
- Services own transactions and UUIDv7 generation.
- API never exposes raw table names — views are read contracts.

### Transactions

Batch write uses WebSocket `transaction()` for atomicity:

```
db.transaction(async (tx) => {
  // 1. Check idempotency key (0012 table)
  // 2. Insert turns + darts
  // 3. Update session state
  // 4. Store idempotency result
})
```

| Query type                 | Driver mode           |
| -------------------------- | --------------------- |
| Simple `GET` reads         | HTTP                  |
| Batch writes / multi-table | WebSocket transaction |

### DB error mapping

| Failure                         | API response                                   |
| ------------------------------- | ---------------------------------------------- |
| Connection timeout / cold start | `503`, `retryable: true`                       |
| Unique constraint violation     | Domain code (e.g. `SESSION_ALREADY_COMPLETED`) |
| FK violation                    | `BATCH_REFERENCE_MISSING`                      |
| Unexpected DB error             | `INTERNAL_ERROR` + log `requestId`             |

---

## Section 4 — Neon Auth & Identity

### Provisioning

- Enabled via `neon.ts` (`auth: true`) + `neon config apply`.
- Auth active on all branches.
- Env vars from `@neon/env` / Neon Auth provisioning.

### Identity flow

```
User login → Neon Auth → JWT
    ↓
Frontend: Authorization: Bearer <JWT>
    ↓
middleware.ts → verify JWT (sub, exp) → resolve playerId
    ↓
locals.auth { authUserId, playerId } → handlers
```

### Player provisioning

After first Neon Auth signup, frontend calls `POST /api/players/provision` to create the `players` row (`auth_user_id = JWT sub`). Until provisioned, middleware returns `403 PLAYER_NOT_PROVISIONED` per frozen API contract.

### Middleware vs service ownership

| Middleware                         | Service              |
| ---------------------------------- | -------------------- |
| JWT verify (`sub`, `exp`)          | Session ownership    |
| `requestId` generation             | Business validation  |
| `auth_user_id` → `playerId` lookup | Domain authorization |

See `06-API/02-Middleware-And-Layering.md` for full contract.

---

## Section 5 — Environment & CI

### Local development

```
1. neon auth (if needed)
2. neon env dev → writes .env with dev branch credentials
3. npm run db:migrate && npm run db:seed
4. drizzle-kit introspect
5. npx fallow
6. npm run dev (Astro + Workers via wrangler)
```

### Environment mapping

| Environment    | Neon branch | Cloudflare            |
| -------------- | ----------- | --------------------- |
| Local dev      | `dev`       | `wrangler dev`        |
| Preview deploy | `preview`   | CF preview Workers    |
| Production     | `main`      | CF production Workers |

### Secrets management

| Secret                | Where                                      |
| --------------------- | ------------------------------------------ |
| `DATABASE_URL`        | CF Worker secrets (per env) + local `.env` |
| `DATABASE_URL_POOLED` | Local `.env` + CI only (not Worker)        |
| `NEON_AUTH_*`         | CF Worker secrets + local `.env`           |

### CI (future, documented now)

```
on push to main:
  1. dbmate migrate against preview branch (smoke)
  2. astro build + astro check
on release:
  1. dbmate migrate against main branch
```

Migration CI uses pooled `DATABASE_URL` with Neon API key or branch connection string stored in GitHub secrets.

---

## Section 6 — Verification & Success Criteria

Phase 1 is complete when:

- [ ] Neon project `dart-analytics` exists in `aws-eu-central-1`
- [ ] Branches `main`, `preview`, `dev` configured with scale-to-zero on (v1)
- [ ] Neon Auth provisioned; JWKS URL available
- [ ] Migrations `0001`–`0012` applied on `dev`
- [ ] Seeds `0001` + `0002` applied on `dev`
- [ ] `app/src/db/schema.ts` introspected and committed
- [ ] `getDb()` connects from `wrangler dev` and executes a test query against `v_active_sessions`
- [ ] Middleware verifies a Neon Auth JWT and resolves `locals.auth`
- [ ] `POST /api/players/provision` creates a player row linked to `auth_user_id`
- [ ] `app/.env.example` committed with documented variables
- [ ] Documentation and AGENT files updated per **Section 8**

### Validation commands

```
npm run db:status          # all migrations applied
npm run db:migrate         # idempotent re-run
drizzle-kit introspect     # schema.ts matches DB
npx fallow                 # detect stale types/usages
astro check                # types compile
```

### Testing approach

| Layer        | Method                                                         |
| ------------ | -------------------------------------------------------------- |
| Migrations   | Clean `dev` branch reset → migrate → seed → verify constraints |
| DB client    | Integration test: query `v_active_sessions` via `getDb()`      |
| Auth         | Manual: login → provision → protected route returns 200        |
| Repositories | Unit tests with mocked Drizzle (post-API implementation)       |

---

## Dependencies to add (`app/`)

| Package                    | Purpose                                            |
| -------------------------- | -------------------------------------------------- |
| `@neondatabase/serverless` | Worker DB driver                                   |
| `drizzle-orm`              | Typed queries                                      |
| `drizzle-kit`              | Introspect only                                    |
| `dbmate`                   | SQL migration runner (devDependency or global CLI) |
| `@neon/config`             | `neon.ts` IaC                                      |
| `@neon/env`                | Typed env parsing                                  |

---

## Section 7 — `.env.example`

Committed at `app/.env.example`. Documents every variable future maintainers need. **No real secrets** — placeholders only.

```dotenv
# =============================================================================
# Dart Analytics — Environment Variables
# =============================================================================
# Copy to .env and fill in values:
#   cp .env.example .env
#
# Generate dev-branch values:
#   neon auth
#   neon env dev
#
# Never commit .env. DATABASE_URL_* contain credentials.
# =============================================================================

# --- Neon Postgres (dev branch) -----------------------------------------------

# Direct connection — Cloudflare Worker runtime (@neondatabase/serverless HTTP/WS)
# Hostname does NOT include "-pooler"
DATABASE_URL=postgresql://user:password@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require

# Pooled connection — local migrations, seeds, dbmate, drizzle-kit introspect
# Hostname includes "-pooler"
DATABASE_URL_POOLED=postgresql://user:password@ep-xxx-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require

# --- Neon Auth ----------------------------------------------------------------

# JWKS URL for JWT signature verification in middleware
NEON_AUTH_JWKS_URL=https://ep-xxx.neonauth.eu-central-1.aws.neon.tech/neondb/auth/.well-known/jwks.json

# Auth base URL (login, token refresh — frontend / Neon Auth SDK)
NEON_AUTH_URL=https://ep-xxx.neonauth.eu-central-1.aws.neon.tech/neondb/auth

# --- dbmate (optional overrides) ----------------------------------------------

# Defaults are set in package.json scripts; override only if needed
# DBMATE_MIGRATIONS_DIR=../architecture/docs/database/migrations
# DBMATE_SCHEMA_FILE=../architecture/docs/database/schema.sql

# --- Local development --------------------------------------------------------

# Astro dev server (optional — defaults in astro.config.mjs)
# HOST=0.0.0.0
# PORT=4321
```

### Variable reference

| Variable              | Required by                                       | Connection type     | Notes                                      |
| --------------------- | ------------------------------------------------- | ------------------- | ------------------------------------------ |
| `DATABASE_URL`        | Worker (`getDb()`), `wrangler dev`                | Direct (non-pooler) | HTTP for reads; WebSocket for transactions |
| `DATABASE_URL_POOLED` | `db:migrate`, `db:seed`, `drizzle-kit introspect` | Pooled (`-pooler`)  | Local + CI only — not deployed to Worker   |
| `NEON_AUTH_JWKS_URL`  | `src/middleware.ts`                               | HTTPS               | Verify JWT `sub` + `exp`                   |
| `NEON_AUTH_URL`       | Frontend auth client                              | HTTPS               | Login and token refresh                    |

### Per-environment values

| Environment | How to obtain                                                        |
| ----------- | -------------------------------------------------------------------- |
| Local `dev` | `neon env dev` → writes `.env`                                       |
| Preview     | Cloudflare Worker secrets + Neon `preview` branch connection strings |
| Production  | Cloudflare Worker secrets + Neon `main` branch connection strings    |

### `.gitignore` verification

Ensure `app/.gitignore` includes:

```
.env
.env.*
!.env.example
```

---

## Section 8 — Documentation & Agent Files

Implementation includes updating architecture docs, installation guides, and AGENT files so AI agents and maintainers follow the architecture strictly.

### Principle

- **Architecture docs** own platform integration, migration process, and Neon topology.
- **`app/` AGENT files** own application-layer rules (DB client, repositories, API handlers).
- **Root `AGENT.md`** routes agents to the correct scope-specific guide.
- All doc updates include ISO dates (`YYYY-MM-DD`) on changed row entries per project convention.

### Files to create

| File                                                                | Purpose                                                                                         |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `app/.env.example`                                                  | Committed env template (Section 7)                                                              |
| `app/AGENT.md`                                                      | App-scope agent operating manual — authority order, folder rules, forbidden actions             |
| `app/src/db/AGENT.md`                                               | DB layer rules — `getDb()`, Drizzle introspect-only, no `drizzle-kit generate`                  |
| `app/src/pages/api/AGENT.md`                                        | API handler rules — thin controllers, envelope mapping, no JWT parsing                          |
| `architecture/docs/database/README.md`                              | SQL artifacts index, dbmate workflow, seed order, link to migrations checklist                  |
| `architecture/docs/architecture/05-Database/11-Neon-Integration.md` | Canonical Neon platform guide — project topology, branches, Auth, connection strings, `neon.ts` |

### Files to update

| File                                                                    | Changes                                                                                                                     |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `app/README.md`                                                         | Replace Astro starter content with: prerequisites, Neon CLI setup, env copy, migrate/seed/introspect, dev server, doc links |
| `app/AGENTS.md`                                                         | Keep Astro dev-server rules; add pointer to `app/AGENT.md` and architecture read order                                      |
| `AGENT.md` (repo root)                                                  | Add Neon integration task routing; migration chain `0001`–`0012`; link `app/AGENT.md`; update implementation state table    |
| `architecture/AGENT.md`                                                 | Add `11-Neon-Integration.md` to read order; dbmate task routing; Neon branch rules                                          |
| `architecture/docs/AGENT.md`                                            | Reference `11-Neon-Integration.md` as canonical Neon source                                                                 |
| `architecture/docs/architecture/AGENT.md`                               | Same Neon routing additions for architecture-scope work                                                                     |
| `architecture/docs/architecture/README.md`                              | Add `11-Neon-Integration.md` to document index; bump version                                                                |
| `architecture/docs/database/AGENT.md`                                   | dbmate runner rules; pooled URL for migrations; link `app/.env.example`                                                     |
| `architecture/docs/architecture/03-Engineering-Workflow.md`             | Add local environment setup phase (Neon auth → env → migrate → seed → dev)                                                  |
| `architecture/docs/architecture/05-Database/03-Migrations.md`           | Add **Migration Execution** section: dbmate, `DBMATE_MIGRATIONS_DIR`, npm scripts, introspect step                          |
| `architecture/docs/architecture/05-Database/00-OVERVIEW.md`             | Cross-link to `11-Neon-Integration.md` under Technology section                                                             |
| `architecture/docs/architecture/05-Database/10-Database-Agent-Guide.md` | Add dbmate + Drizzle introspect workflow to safe change patterns                                                            |
| `architecture/docs/architecture/06-API/01-Implementation-Strategy.md`   | Already updated (v0.2.0 REST-only); verify Neon env vars referenced                                                         |
| `architecture/000_master_context.md`                                    | Record Neon integration decisions (see below)                                                                               |

### `app/AGENT.md` — required content outline

```
# Agent Rules — app/

## Authority order
1. User request
2. architecture/docs/architecture/01-Principles.md
3. architecture/docs/architecture/02-System-Architecture.md
4. architecture/docs/architecture/06-API/00-Overview.md
5. architecture/docs/architecture/05-Database/06-Database-Specification.md
6. Scope-specific AGENT.md (db/, pages/api/)
7. Application code

## Required reading (by task)
- DB work: 05-Database/10-Database-Agent-Guide.md + 11-Neon-Integration.md
- API work: 06-API/00-Overview.md + 01 + 02
- Neon setup: 11-Neon-Integration.md + app/.env.example

## Non-negotiable rules
- Schema authority: architecture/docs/database/migrations/ (never drizzle-kit generate)
- Reads from v_* views; writes to runtime tables
- Controller → Service → Repository
- UUIDv7 generated in service layer
- No secrets in code; use .env (see .env.example)
- Re-introspect schema.ts after architecture migration changes

## Forbidden
- drizzle-kit generate / push
- Raw table reads in API handlers
- JWT parsing outside middleware
- Modifying applied architecture migrations
- Committing .env
```

### `architecture/docs/architecture/05-Database/11-Neon-Integration.md` — required sections

1. Purpose and relationship to `00-OVERVIEW.md`
2. Neon project topology (branches, region, compute policy)
3. `neon.ts` / `@neon/config` declaration
4. Connection string rules (direct vs pooled)
5. Environment variables (reference `app/.env.example`)
6. dbmate migration workflow
7. Drizzle introspect workflow
8. Neon Auth provisioning and identity mapping
9. Branch promotion: dev → preview → main
10. Security model (v1 service-role Worker)
11. Related documents and agent files

### `architecture/000_master_context.md` — additions

Add a **Neon integration session (2026-07-09)** block recording:

- Migration tooling resolved: **dbmate** (SQL-first) + **Drizzle introspect** (query layer only)
- Neon project: new `dart-analytics`, `aws-eu-central-1`, branches `main`/`preview`/`dev`
- v1 compute: scale-to-zero **on** all branches (always-on `main` deferred)
- Local dev: shared `dev` branch (not Docker Postgres)
- Neon Auth in phase 1; explicit `POST /api/players/provision`
- API implementation: REST server endpoints only (`01-Implementation-Strategy.md` v0.2.0)
- Design spec: `docs/superpowers/specs/2026-07-09-neon-db-integration-design.md`
- Remove `Migration tooling selection` from Unresolved / Deferred table

### Documentation workflow (implementation order)

```
1. Write 11-Neon-Integration.md (canonical Neon guide)
2. Update 03-Migrations.md + database/README.md
3. Create app/.env.example
4. Create app/AGENT.md + scoped AGENT files (db/, pages/api/)
5. Rewrite app/README.md (installation guide)
6. Cascade updates to root + architecture AGENT.md files
7. Update 000_master_context.md
8. Cross-link verify (no broken references)
```

---

## Related Documents

| Document                                                                | Purpose                                     |
| ----------------------------------------------------------------------- | ------------------------------------------- |
| `architecture/docs/architecture/05-Database/00-OVERVIEW.md`             | DB philosophy                               |
| `architecture/docs/architecture/05-Database/03-Migrations.md`           | Migration process                           |
| `architecture/docs/architecture/05-Database/10-Database-Agent-Guide.md` | Agent rules                                 |
| `architecture/docs/architecture/06-API/00-Overview.md`                  | Frozen API contract                         |
| `architecture/docs/architecture/06-API/01-Implementation-Strategy.md`   | REST endpoints on Workers                   |
| `architecture/docs/architecture/06-API/02-Middleware-And-Layering.md`   | Middleware contract                         |
| `architecture/docs/architecture/05-Database/11-Neon-Integration.md`     | Neon platform guide (to create)             |
| `architecture/docs/database/README.md`                                  | SQL artifacts + dbmate workflow (to create) |
| `app/AGENT.md`                                                          | App-scope agent rules (to create)           |
| `app/.env.example`                                                      | Environment variable template (to create)   |
| `docs/superpowers/specs/2026-07-09-neon-db-integration-design.md`       | This design spec                            |

---

## Next Step

Invoke `writing-plans` skill to produce a step-by-step implementation plan from this spec.
