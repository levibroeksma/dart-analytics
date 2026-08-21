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

Freshness is CI-owned: `.github/workflows/graph.yml` rebuilds `graphify-out/graph.json` on every merge to `main` and opens a PR with the delta. Installing the CLI locally is optional — only useful for querying the graph while working:

```
uv tool install graphifyy    # or: pipx install graphifyy
pip install "graphifyy[sql]" # REQUIRED — without it all SQL migrations vanish from the graph
graphify hook install         # AST-only rebuild on commit
```

- Rebuilds go through `scripts/refresh-graph.sh` (canonical flags; warns instead of failing when the CLI is absent locally — CI sets `GRAPH_REFRESH_STRICT=1`, where the same conditions are hard failures).
- `graphify-out/graph.json` is committed; `graphify-out/graph.html` and the regenerable report are git-ignored.
- If you install the commit hook, do not stage `graphify-out/graph.json` yourself — CI owns it (D185), and a local graph commit only creates a conflict against the `chore/graph-refresh` PR.
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
- **Game engines.** Every `*.engine.module.ts` implements the `GameEngine` contract (`docs/architecture/04-Architecture-patterns.md` Pattern 18): constructed from a validated config snapshot bound to a `rulesetVersionKey`, owns its `EngineFacts` log, mints `clientKey`/`sequence`/`completedAt`/`participantRef`, rehydrates from persisted facts via `create(config, prior)`, and exposes a pure `wouldComplete(input)`. Every engine also declares a static `stageOwnership` (`SHARED` | `PER_SEAT`) so the shared `modules/game/seat-rota.module.ts` can derive the active seat from the fact log; `record()` takes no seat — it applies to the derived active seat, and the active seat is never stored. (2026-08-21) `undo()` must be an exact inverse of `record()` over `facts()`, including any stage the record opened; undo depth is unbounded. `completedAt` is stamped when a visit resolves, never when it opens, and cleared when `undo()` reopens one. `state()` and `facts()` return derived copies — never a live field or a shared module constant. Anything a caller must change goes through a named method, not a write to a returned object. Never store a value the fact log can derive — no accumulated score, points, ratio or average fields. `bash scripts/check-game-engines.sh` must pass. (2026-07-26) A new engine's `rulesetVersionKey` and its server-side validator (`services/rulesets/registry.ts`) must land in the same commit — `scripts/check-game-engines.sh` runs pre-commit and rejects one without the other, so a plan that splits them into separate tasks/commits cannot land as drafted; combine them at commit time. (2026-08-14)

## TypeScript comments (`app/src/**/*.ts`)

- Never put `//` or `/* */` comments inside function/method bodies.
- Prefer names that read naturally; put necessary detail in JSDoc above the declaration.
- Exempt: `// fallow-ignore-next-line ...` tool directives; `///` triple-slash references.
- Out of scope: `app/tests/`, `app/scripts/`.

## Formatting

- Prettier + `prettier-plugin-astro` (`singleAttributePerLine: true`).
- `npm run format` (write) · `npm run format:check` (CI Format gate — not part of `validate:app`).
- Format on save via `app/.vscode/settings.json`.
- **pre-commit:** husky + lint-staged run Prettier `--write` on staged files (`cd app && npx lint-staged`), then all 14 structural gates (file-locations, agent-mirrors, astro-class-composition, astro-conventions, game-engines, refinement-coverage, type-barrels, alias-sync, constraint-mirror, no-inline-comments, style-tokens, findings-log, game-wiring, test-coverage) run from repo root under `set -e`. Hooks install via `npm install` (`prepare` → repo-root `.husky/`). (2026-07-28; test-coverage added 2026-08-21)
- **Before every PR create or update (mandatory):** run `cd app && npm run format`, commit any formatting diffs, and confirm `npm run format:check` is clean. Applies to all app work — not only multi-task plan completion. Skipping this fails the CI Format gate. (2026-07-24)

## Test-Driven Development (mandatory)

Full red→green→refactor procedure: `verification-before-completion` skill, "Dart Analytics" section.

Rules:

- Place tests under `app/tests/`, mirroring `app/src/`'s (and `app/scripts/`'s) directory structure — never colocated beside the module under test.
- Test pure functions, stores, clients, and utilities with Vitest mocks — no real network or Neon calls in unit tests.
- `.astro` markup: keep variant/branching logic inline in the component's own frontmatter. This logic is not unit-tested — there is no Astro-component test runner in this project — so do not extract a separate helper file solely to make it testable (D101).

Framework: **Vitest** (`vitest.config.ts` at `app/` root).

Ground rules beyond the `verification-before-completion` skill's procedure (shared-mock promotion threshold, full-suite-always-runs policy): `docs/architecture/07-Frontend/06-Test-Strategy.md`. (procedure moved to `verification-before-completion` skill, 2026-07-28)

## Validation Standard Procedure (sole definition)

Run for `app/` changes before claiming completion — full procedure and mid-task gate condition in the `validate-app` skill:

```
npm run validate:app
```

Done means every step of that chain exits zero, `npx fallow` included, and the type gate reports **0 errors, 0 warnings, 0 hints** — hint-level diagnostics fail the build (`--minimumFailingSeverity hint`).

A source edit with no test edit is not a completed task: `scripts/check-test-coverage.sh` fails any change set that touches a runtime `.ts` file under `app/src/` or `app/scripts/` without also touching a test that imports it. Type-only edits, pure re-export barrels and `drizzle-kit` output are exempt, derived rather than listed. There is no per-file silencer — if a changed file has no covering test, write one. (D224, 2026-08-21)

(2026-07-22; procedure moved to `.claude/skills/validate-app/SKILL.md`, 2026-07-28; zero-hint bar added 2026-08-21)

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
- **Reuse existing UI components before hand-rolling markup.** A standalone action always renders through `components/forms/Button.astro` (`variant`/`icon`/`ariaLabel`/`loadingExpr`) — never a raw `<button>` with manually composed classes. Check `components/ui/` and `components/forms/` for a fitting component before writing new markup for any recurring UI shape (buttons, modals, form controls). If nothing fits, say so and propose a new component rather than hand-rolling one inline. Exempt: multi-part custom controls a shared primitive cannot express as-is — e.g. `role="radio"` options carrying a label + description + checkmark (`AppModeForm.astro`, `HandednessForm.astro`) — which stay raw markup by established precedent. (2026-08-11)
- Build-time class composition via `cn()` only — never `class:list` (enforced by `scripts/check-astro-class-composition.sh`)
- Forward leftover attributes as `{...props}` — never `{...rest}`
- Never `font-medium` — use `font-normal` / `font-semibold` / `font-bold`
- Tailwind v4 utilities only — no important modifier at all, neither prefix (`!utility`) nor suffix (`utility!`); compose overrides through `cn()`'s merge ordering, or extend the primitive's own variant/prop surface when its defaults conflict; arbitrary negatives as `left-[-45%]`, never `-left-[45%]`
- Full rules: `docs/architecture/07-Frontend/07-Style-Guide.md` (visual) and `07-Frontend/05-Astro-Components.md` (class composition / props); `font-medium`/`{...rest}`/raw palette utilities/Tailwind important modifier (either form) + `-prop-[…]` mechanically enforced by `scripts/check-style-tokens.sh` (2026-07-31; important-modifier ban widened to suffix form 2026-08-21)
