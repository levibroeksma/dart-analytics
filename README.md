# Dart Analytics

Personal darts scoring and long-term progression tracking. Architecture-first: every change is designed in the docs before it is implemented — the docs are the source of truth, and **"store what happened, derive what it means"** governs the data model.

**Stack:** Astro.js · TypeScript · Alpine.js · PostgreSQL (Neon) · Cloudflare Workers

## Layout

| Folder | Contents |
| ------ | -------- |
| `app/` | The application — Astro frontend + Worker API |
| `database/` | Executable schema: dbmate migrations (`0001`–`0016`) and seeds |
| `docs/` | Architecture documentation (`docs/architecture/`) and point-in-time design records (`docs/superpowers/`) |
| `scripts/` | Repo checks (`scripts/check-context-map.sh`, `scripts/refresh-graph.sh`) |
| `graphify-out/` | Committed AST-only codebase knowledge graph |

## Getting started

1. `cd app && cp .env.example .env` — fill in Neon values (see `app/README.md`)
2. `npm install && npm run db:status`
3. `npm run dev`
4. Before finishing any change: `npm run validate:app`

## Where to read next

- Architecture & documentation philosophy: `docs/architecture/README.md`
- Why decisions were made: `DECISIONS.md`
- Agent operating rules: `CLAUDE.md`
