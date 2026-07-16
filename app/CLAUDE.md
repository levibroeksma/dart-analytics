# Agent Rules — `app/`

Scope: everything under `app/`. Authority order and per-task context packs live in `docs/architecture/00-Context-Map.md`; schema authority is `database/` migrations and seeds. Scope guides: `app/src/db/CLAUDE.md`, `app/src/pages/api/CLAUDE.md`. (2026-07-15)

## Development

Local setup: `app/.env.example`, `app/README.md`.

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

Worktrees are not used in this repo — task branches are checked out directly in the main working copy (`git checkout -b <branch-name>`), never under `.worktrees/` (see root `CLAUDE.md`).

## Knowledge Graph (graphify)

One-time per clone (hooks are local, not committed):

```
uv tool install graphifyy    # or: pipx install graphifyy
pip install "graphifyy[sql]" # REQUIRED — without it all SQL migrations vanish from the graph
graphify hook install         # AST-only rebuild on commit
```

- Rebuilds go through `scripts/refresh-graph.sh` (canonical flags; warns instead of failing when the CLI is absent). Record graph-not-refreshed in the completion report when it warns.
- `graphify-out/graph.json` is committed; `graphify-out/graph.html` and the regenerable report are git-ignored.
- Extraction is AST-only — never configure an LLM API key for graphify (keeps it free/deterministic). Use `--code-only` so doc files do not trigger semantic extraction.
- Query the graph to orient before searching: `graphify query/path/explain` (see root `CLAUDE.md`).

## Astro Documentation

Full documentation: https://docs.astro.build

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

## Non-Negotiable Rules

- Never use Drizzle to generate or own migrations.
- Read endpoints are view-backed (`v_*`); writes target runtime tables.
- Use Controller → Service → Repository layering.
- Middleware verifies JWT; handlers/services never parse JWT directly.
- Service layer generates UUIDv7 for runtime persistence records.
- Keep secrets in `.env` / worker secrets; never in source files.
- Re-run `drizzle-kit introspect` after architecture migration changes.

## Test-Driven Development (mandatory)

Every `app/` behavior change follows **red → green → refactor**:

1. Write a failing test that names the expected behavior.
2. Run `npm test` — confirm the **new** test fails for the right reason.
3. Implement the minimal code to pass.
4. Run `npm test` — all tests pass.
5. Refactor only with tests green.

Rules:

- Place tests under `app/tests/`, mirroring `app/src/`'s (and `app/scripts/`'s) directory structure — never colocated beside the module under test.
- Test pure functions, stores, clients, and utilities with Vitest mocks — no real network or Neon calls in unit tests.
- `.astro` markup: keep variant/branching logic inline in the component's own frontmatter. This logic is not unit-tested — there is no Astro-component test runner in this project — so do not extract a separate helper file solely to make it testable (D101).
- Do not commit production code without its failing test written first (except greenfield scaffold commits that only add test infrastructure).

Framework: **Vitest** (`vitest.config.ts` at `app/` root). Commands: `npm test` (CI), `npm run test:watch` (local).

## Validation Standard Procedure (sole definition)

Run for `app/` changes before claiming completion:

```
npm run validate:app
```

This executes, in order: `db:status` → `db:migrate` → `db:introspect` → `npx fallow` → `npm test` → `astro check` → `bash scripts/refresh-graph.sh` (graph refresh warns instead of failing when the graphify CLI is absent — record that warning in the completion report). Stage `graphify-out/graph.json` when it changed. Seeding (`npm run db:seed`) is environment provisioning, not validation — see `docs/architecture/05-Database/11-Neon-Integration.md`. (2026-07-15)

## Forbidden

- `drizzle-kit generate`
- `drizzle-kit push`
- Raw table reads directly in API handlers
- JWT parsing outside middleware
- Editing applied architecture migrations
- Committing `.env` or connection strings

## Frontend Rules

For page/component/session work, load `docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md` and the tiered pack from `00-Context-Map.md`.

Handbook 0.1.0 non-negotiables: file suffix conventions (`.store.ts`, `.form.ts`, `.data.ts`, `*.module.ts`); Alpine v3 shorthand (`:attr`, `@event` — not `x-bind`/`x-on` except Astro `{}` linter escape); no `x-init`; `x-data="factory()"`; modules never import `@client/api`; `$persist` only in stores/forms.

**TypeScript file organization:** All `.ts` files in `app/src/lib/` (except stores/forms, which live at `stores/`, `forms/`):
- Auth-related: `lib/auth/` (e.g., `login.data.ts`, `logout.data.ts`) — imported via `@auth/` alias
- Domain-specific: organize by domain folder (e.g., `lib/game/`, `lib/players/`) — imported via `@lib/<domain>/`
- Utilities: `lib/utils/` (migrating from legacy `utils/` folder) — imported via `@utils/`

Full rules: `07-Frontend/01`–`04`, `02-Folder-Structure.md`.
