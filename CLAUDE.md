# Agent Operating Manual — Dart Analytics

> Router file — auto-loaded every session. Every rule lives in exactly one place; this file tells you where. (2026-07-15)

---

# Project

Personal darts scoring app with long-term progression tracking. Architecture-first: design before implementation.

**Stack:** Astro.js, TypeScript, Alpine.js, PostgreSQL (Neon), Cloudflare Workers API (in `app/`).

**Principle:** Store what happened. Derive what it means.

---

# Behaviour Constraints

- Extreme concision: all interactions, commits, plans.
- Sacrifice grammar & pleasantries for brevity.
- Prefer short words; avoid polysyllabic synonyms.
- No recaps; go straight to the point.

---

# Output Acknowledgment

- No acknowledgment sentences on initial responses.
- Reply "On it." or "Starting search." then execute immediately.
- Forbidden: transitional phrases ("I can help...", "Let me...", etc.).

---

# Context Loading Protocol

1. Open `docs/architecture/00-Context-Map.md` — the router.
2. Find your task type in its Context Packs table and load exactly those files.
3. Do not preload anything else. Escalate to `docs/architecture/00-File-Inventory.md` only when the pack demonstrably lacks the answer.

The authority order for conflicts is defined once, in the context map. Docs win over code.

---

# Knowledge Graph (graphify)

A committed codebase knowledge graph lives at `graphify-out/graph.json` (AST-only; built with the `graphifyy` CLI — PyPI package `graphifyy`, repo `Graphify-Labs/graphify`).

- **Consult before broad grep/exploration:** `graphify query "<question>"`, `graphify path "<A>" "<B>"`, `graphify explain "<entity>"`. Use it to orient across app code + SQL schema + docs, then read the specific files it points to.
- **The graph is a map, not authority.** On any conflict, the authority order in `00-Context-Map.md` wins; verify a graph answer against the cited file before acting.
- **Freshness is CI-owned**: `.github/workflows/graph.yml` rebuilds the graph on every merge to `main` and opens a PR; it is no longer a local completion-report item. A local CLI install is optional, for querying the graph while working — see `app/CLAUDE.md`.
- **Scope caveat:** `.astro` files are only partially parsed (no tree-sitter grammar); TS/JS/SQL/Markdown are fully covered.

---

# Hard Invariants

- Completed gameplay is immutable; corrections create new records.
- Store facts; statistics live in views (`v_*`) only — never persisted.
- An engine-only task must still prove its state shape can be persisted: name the capture/input mode, the stage type, and the `turns`/`darts` mapping in the spec before implementation. Deferring persistence is allowed; choosing a state shape that cannot express it is not. (2026-07-26)
- IDs: UUIDv7 for domain entities (app/Worker generated), SMALLINT for seeded lookups. The database never generates ids.
- Runtime tables never FK-reference templates; configuration is copied as a snapshot.
- Never modify applied migrations (`0001`–`0022`); new schema change = new numbered migration + spec update.
- Reads via views, writes to runtime tables in transactions; gameplay is uploaded in batches.
- Every task uses a dedicated branch; never merge to `main` directly; do not commit unless the user asks. A completed task's branch is integrated into `main` via PR promptly — long-lived divergence from `main` is a defect.
- At most one open task branch may target another task branch. A third stacked branch means the first must land, or the work merges into one branch. Mechanically enforced on every PR by the `branch-stack-cap` job in `.github/workflows/pr-gates.yml`. (2026-07-26; gate added 2026-07-28)
- No git worktrees: check out task branches directly in the main working copy (`git checkout -b <branch>`), never under `.worktrees/`. Declared preference — skills that offer worktree isolation should skip it without asking.
- Minimal diffs; validate and fix docs with targeted edits — never regenerate them.
- When a test's subject is removed or migrated, the test must be deleted or re-pointed at the same guarantee — never re-pointed at a different input so it keeps passing. A green suite after a constraint is removed is a failure to detect, not evidence of safety. (2026-07-26)

---

# Context Maintenance (mandatory, every task)

The context system is part of every deliverable. Before claiming any task done, run the `context-maintenance` skill.

A change that leaves the context map, CLAUDE.md files, decision ledger, or knowledge graph stale is incomplete, even if the code works. (procedure moved to `.claude/skills/context-maintenance/SKILL.md`, 2026-07-28)

Decisions are append-only and domain-scoped: never edit or delete an existing block in `decisions/**`; a reversal is a new decision citing `Supersedes:` in the domain file it belongs to, per `DECISIONS.md`'s routing table. (2026-08-02)

---

# Forbidden Actions

(These are the standalone prohibitions; the Hard Invariants above are equally binding.)

- Expose raw database tables through the API
- Generic EAV / polymorphic FK patterns for gameplay
- Force-push to main/master; commit secrets (`.env`, credentials)

---

# Where Everything Lives

| Need | File |
| ---- | ---- |
| Context packs, authority order | `docs/architecture/00-Context-Map.md` |
| File inventory (escalation only) | `docs/architecture/00-File-Inventory.md` |
| Why a decision was made | `DECISIONS.md` (router); domain files live in `decisions/**` |
| App implementation rules + validation procedure | `app/CLAUDE.md` |
| Condensed database rules | `docs/architecture/05-Database/10-Database-Agent-Guide.md` |
| Raw, pre-spec game/routine/trivia rule notes (non-canonical) | `docs/game-rules/README.md` |

---
