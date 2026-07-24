# Agent Rules — `app/`

Scope: everything under `app/`. Authority order and per-task context packs live in `docs/architecture/00-Context-Map.md`; schema authority is `database/` migrations and seeds. Scope guides: `app/src/db/CLAUDE.md`, `app/src/pages/api/CLAUDE.md`. (2026-07-15)

## Development

Local setup: `app/.env.example`, `app/README.md`. Neon local env: `npm run env:dev` (checkout `dev` + mirror `PUBLIC_NEON_AUTH_BASE_URL`); production file via `npm run env:prod` — never pull `main` into `.env`. `npm run dev` runs `env:dev` first. (2026-07-24)

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
- `tsconfig.json`'s `compilerOptions.paths` and `vitest.config.ts`'s `resolve.alias` must stay in sync: every path alias declared in one must exist in the other. A new alias used only inside `vi.mock(...)` factories can silently pass tests without ever needing real resolution — verify the alias resolves for a genuine (non-mocked) import before considering it wired. (2026-07-16)

## TypeScript comments (`app/src/**/*.ts`)

- Never put `//` or `/* */` comments inside function/method bodies.
- Prefer names that read naturally; put necessary detail in JSDoc above the declaration.
- Exempt: `// fallow-ignore-next-line ...` tool directives; `///` triple-slash references.
- Out of scope: `app/tests/`, `app/scripts/`.

## Formatting

- Prettier + `prettier-plugin-astro` (`singleAttributePerLine: true`).
- `npm run format` (write) · `npm run format:check` (CI Format gate — not part of `validate:app`).
- Format on save via `app/.vscode/settings.json`.
- **pre-commit:** husky + lint-staged run Prettier `--write` on staged files (`cd app && npx lint-staged`). Hooks install via `npm install` (`prepare` → repo-root `.husky/`).
- **Before every PR create or update (mandatory):** run `cd app && npm run format`, commit any formatting diffs, and confirm `npm run format:check` is clean. Applies to all app work — not only multi-task plan completion. Skipping this fails the CI Format gate. (2026-07-24)

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

Ground rules beyond the command sequence above (shared-mock promotion threshold, full-suite-always-runs policy): `docs/architecture/07-Frontend/06-Test-Strategy.md`.

## Validation Standard Procedure (sole definition)

Run for `app/` changes before claiming completion:

```
npm run validate:app
```

This executes, in order: `db:status` → `db:migrate` → `db:introspect` → `npx fallow` → `npm test` → `npm run check` (`rm -rf .astro && astro check`) → `bash scripts/refresh-graph.sh` (graph refresh warns instead of failing when the graphify CLI is absent — record that warning in the completion report). Stage `graphify-out/graph.json` when it changed. Seeding (`npm run db:seed`) is environment provisioning, not validation — see `docs/architecture/05-Database/11-Neon-Integration.md`. (2026-07-22)

**Mid-task gate (multi-step / multi-commit work):** a focused vitest file going green is not enough to claim a task done when the change touches services, repositories, middleware, or shared client API code. Before that claim, also run `npx fallow` and `npm run check` and fix any new failures they surface — plan-faithful code can still leave type or maintainability gates red. The full `validate:app` remains the completion bar for the whole change set. (2026-07-22)

## Forbidden

- `drizzle-kit generate`
- `drizzle-kit push`
- Raw table reads directly in API handlers
- JWT parsing outside middleware
- Editing applied architecture migrations
- Committing `.env` or connection strings

## Frontend Rules

For page/component/session work, load `docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md` and the tiered pack from `00-Context-Map.md`.

Handbook 0.1.0 non-negotiables: file suffix conventions (`.store.ts`, `.form.ts`, `.data.ts`, `*.module.ts`); Alpine v3 shorthand (`:attr`, `@event` — not `x-bind`/`x-on` except Astro `{}` linter escape); no `x-init`; `x-data="factory()"`; modules never import `@client/api`; `$persist` only in stores/forms; `PersistFactory` once per field (D120) — never reuse one `persist()` across store fields. (2026-07-17)

**TypeScript file organization:** No `.ts` file lives directly under `components/` or `pages/` — except `pages/api/**` (Worker route handlers) — regardless of single- or multi-consumer use; mechanically enforced by `scripts/check-file-locations.sh`. All other `.ts` files live in `app/src/lib/` (except stores/forms, which live at `stores/`, `forms/`):

- Auth-related: `lib/auth/` (e.g., `login.data.ts`, `logout.data.ts`) — imported via `@auth/` alias
- Domain-specific: organize by domain folder (e.g., `lib/game/`, `lib/players/`) — imported via `@lib/<domain>/`
- Utilities: `lib/utils/` (migrating from legacy `utils/` folder) — imported via `@utils/`

Full rules: `07-Frontend/01`–`04`, `02-Folder-Structure.md`.

**Style non-negotiables:**

- Semantic tokens only — `surface` / `foreground` / `muted*` / `accent*` / states; never `bg-bg*` / `text-fg*` or raw palette utilities
- Reuse primitives from `app/src/styles/global.css`; do not reinvent per screen
- Build-time class composition via `cn()` only — never `class:list` (enforced by `scripts/check-astro-class-composition.sh`)
- Forward leftover attributes as `{...props}` — never `{...rest}`
- Never `font-medium` — use `font-normal` / `font-semibold` / `font-bold`
- Full rules: `docs/architecture/07-Frontend/07-Style-Guide.md` (visual) and `07-Frontend/05-Astro-Components.md` (class composition / props)

## Tool Allowances & Restrictions (2026-07-23)

App layer is full-stack implementation: Astro, TypeScript, tests, frontend components. Work requires local validation gates and test-driven development.

### Allow

- **Read** — load source files, tests, docs, existing implementation
- **Edit/Write** — modify components, services, tests, configuration
- **Bash** — run npm commands (`test`, `validate:app`, `format`, dev server), git commands
- **Glob** — find files by pattern (tests, components, etc.)
- **Grep** — search code for patterns, verify naming conventions

### Restrict

Scoped to this layer's own work; skill-driven workflows use restricted tools as designed — see root `CLAUDE.md`.

- GitHub MCP tools (mcp__github__*) — app changes don't require PR/issue interaction
- WebFetch, WebSearch — no external lookups needed for local development
- Agent spawning — focused implementation work with clear scope
