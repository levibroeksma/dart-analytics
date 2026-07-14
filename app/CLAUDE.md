# Agent Rules — `app/`

Scope: everything under `app/`. Authority order and per-task context packs live in `architecture/docs/architecture/00-Context-Map.md`; schema authority is `architecture/docs/database/` migrations and seeds. Scope guides: `app/src/db/CLAUDE.md`, `app/src/pages/api/CLAUDE.md`. (2026-07-11)

## Development

Local setup: `app/.env.example`, `app/README.md`.

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

Default git worktree location: `.worktrees/<branch-name>/` at repo root; keep `.worktrees/` git-ignored.

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

## Validation Standard Procedure (sole definition)

Run this sequence for `app/` changes before claiming completion:

1. `npm run db:status`
2. `npm run db:migrate`
3. `drizzle-kit introspect`
4. `npx fallow`
5. `astro check`
6. `bash scripts/refresh-graph.sh` — refresh the knowledge graph; stage `graphify-out/graph.json` (AST-only, no cost)

## Forbidden

- `drizzle-kit generate`
- `drizzle-kit push`
- Raw table reads directly in API handlers
- JWT parsing outside middleware
- Editing applied architecture migrations
- Committing `.env` or connection strings

## Frontend Rules

For page/component/session work, load `architecture/docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md` and the tiered pack from `00-Context-Map.md`.

Handbook 0.1.0 non-negotiables: file suffix conventions (`.store.ts`, `.form.ts`, `.data.ts`, `*.module.ts`); no `x-init`; `x-data="factory()"`; modules never import `@client/api`; `$persist` only in stores/forms. Full rules: `07-Frontend/01`–`04`.
