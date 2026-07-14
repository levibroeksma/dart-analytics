# Agent Operating Manual — Dart Analytics

> Router file — auto-loaded every session. Every rule lives in exactly one place; this file tells you where. (2026-07-11)

---

# Project

Personal darts scoring app with long-term progression tracking. Architecture-first: design before implementation.

**Stack:** Astro.js, TypeScript, Alpine.js, PostgreSQL (Neon), Cloudflare Workers API (in `app/`).

**Principle:** Store what happened. Derive what it means.

---

# Context Loading Protocol

1. Open `architecture/docs/architecture/00-Context-Map.md`.
2. Find your task type in its Context Packs table and load exactly those files.
3. Do not preload anything else. Escalate to additional files only when the pack demonstrably lacks the answer.

The authority order for conflicts is defined once, in the context map. Docs win over code.

---

# Knowledge Graph (graphify)

A committed codebase knowledge graph lives at `graphify-out/graph.json` (AST-only; built by `Graphify-Labs/graphify`).

- **Consult before broad grep/exploration:** `graphify query "<question>"`, `graphify path "<A>" "<B>"`, `graphify explain "<entity>"`. Use it to orient across app code + SQL schema + docs, then read the specific files it points to.
- **The graph is a map, not authority.** On any conflict, the authority order in `00-Context-Map.md` wins; verify a graph answer against the cited file before acting.
- **Freshness is a completion-gate item** (see Context Maintenance below): git hooks auto-rebuild the graph at commit; the gate step is the backstop when hooks are absent. Setup for a fresh clone: see `app/CLAUDE.md`.
- **Scope caveat:** `.astro` files are only partially parsed (no tree-sitter grammar); TS/JS/SQL/Markdown are fully covered.

---

# Hard Invariants

- Completed gameplay is immutable; corrections create new records.
- Store facts; statistics live in views (`v_*`) only — never persisted.
- IDs: UUIDv7 for domain entities (app/Worker generated), SMALLINT for seeded lookups. The database never generates ids.
- Runtime tables never FK-reference templates; configuration is copied as a snapshot.
- Never modify applied migrations (`0001`–`0016`); new schema change = new numbered migration + spec update.
- Reads via views, writes to runtime tables in transactions; gameplay is uploaded in batches.
- Every task uses a dedicated branch; never merge to `main` directly; do not commit unless the user asks.
- Minimal diffs; validate and fix docs with targeted edits — never regenerate them.

---

# Context Maintenance (mandatory, every task)

The context system is part of every deliverable. Before claiming any task done:

1. Update the `CLAUDE.md` nearest to what you changed if your change adds, alters, or invalidates a rule in it.
2. Register new, moved, renamed, or deleted docs in `00-Context-Map.md` in the same change.
3. Record new architectural decisions as one-line entries in `architecture/DECISIONS.md`.
4. Add an ISO date (`YYYY-MM-DD`) to every newly added or changed docs row entry.
5. Run `scripts/check-context-map.sh` — it must pass.
6. Refresh the knowledge graph: `graphify extract . --update --code-only`, then stage `graphify-out/graph.json` (AST-only — no API cost). Git hooks automate this at commit; this gate item is the backstop when hooks are not installed. If graphify is not set up in this environment, say so in the completion report rather than skipping silently.

A change that leaves the context map, CLAUDE.md files, decision ledger, **or knowledge graph** stale is incomplete, even if the code works.

---

# Forbidden Actions

- Modify applied migration files
- Expose raw database tables through the API
- Store derivable statistics in tables
- Add template foreign keys to runtime tables
- Use database-generated UUIDs or SERIAL ids
- Generic EAV / polymorphic FK patterns for gameplay
- Skip documentation/context updates when changing schema or repo structure
- Regenerate architecture docs instead of targeted fixes
- Force-push to main/master; commit secrets (`.env`, credentials)

---

# Where Everything Lives

| Need | File |
| ---- | ---- |
| Context packs, file inventory, authority order | `architecture/docs/architecture/00-Context-Map.md` |
| Why a decision was made | `architecture/DECISIONS.md` |
| App implementation rules + validation procedure | `app/CLAUDE.md` |
| Condensed database rules | `architecture/docs/architecture/05-Database/10-Database-Agent-Guide.md` |
| Historical handoff (context only, never authority) | `architecture/000_master_context.md` |
