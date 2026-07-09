# Agent Rules — `app/`

Scope: everything under `app/`.

## Authority Order

1. User request in current chat
2. `architecture/docs/architecture/01-Principles.md`
3. `architecture/docs/architecture/02-System-Architecture.md`
4. `architecture/docs/architecture/06-API/00-Overview.md`
5. `architecture/docs/architecture/05-Database/06-Database-Specification.md`
6. Scope guides: `app/src/db/AGENT.md`, `app/src/pages/api/AGENT.md`
7. Application code

## Required Reading By Task

- DB integration: `architecture/docs/architecture/05-Database/10-Database-Agent-Guide.md`, `architecture/docs/architecture/05-Database/11-Neon-Integration.md`
- API implementation: `architecture/docs/architecture/06-API/00-Overview.md`, `01-Implementation-Strategy.md`, `02-Middleware-And-Layering.md`
- Local setup: `app/.env.example`, `app/README.md`

## Development

Default git worktree location: `.worktrees/<branch-name>/` (repo root, ignored by git).

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)

## Workspace Isolation

- Default git worktree directory for this project is `.worktrees/` at repository root.
- Create isolated branches as `.worktrees/<branch-name>/`.
- Keep `.worktrees/` git-ignored.

## Non-Negotiable Rules

- Schema authority is `architecture/docs/database/migrations/` and seeds.
- Never use Drizzle to generate or own migrations.
- Read endpoints are view-backed (`v_*`); writes target runtime tables.
- Use Controller -> Service -> Repository layering.
- Middleware verifies JWT; handlers/services never parse JWT directly.
- Service layer generates UUIDv7 for runtime persistence records.
- Keep secrets in `.env` / worker secrets; never in source files.
- Re-run `drizzle-kit introspect` after architecture migration changes.

## Validation Standard Procedure

Run this sequence for `app/` changes:

1. `npm run db:status`
2. `npm run db:migrate`
3. `drizzle-kit introspect`
4. `npx fallow`
5. `astro check`

## Forbidden

- `drizzle-kit generate`
- `drizzle-kit push`
- Raw table reads directly in API handlers
- JWT parsing outside middleware
- Editing applied architecture migrations
- Committing `.env` or connection strings
