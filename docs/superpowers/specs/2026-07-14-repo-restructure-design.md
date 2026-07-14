# Repository Restructure Design — Single `docs/` Tree, Top-Level `database/`

> **Date:** 2026-07-14
> **Status:** approved design (brainstorming consensus with user)
> **Scope:** eliminate the `architecture/docs/architecture/` path stutter and the duplicate doc roots by consolidating documentation under one top-level `docs/`, promoting executable SQL to a top-level `database/`, retiring the legacy master context, and adding a human-facing root `README.md`.
> **Branch:** `claude/darts-analytics-arch-review-nvyboi`

---

## Problem

Documentation lives in two sibling roots: `architecture/` (which itself contains a `docs/` containing another `architecture/`) and a top-level `docs/` (superpowers). Consequences:

- The canonical path `architecture/docs/architecture/05-Database/...` stutters twice.
- "Where do docs go?" has two answers — the exact ambiguity the context system exists to remove.
- SQL migrations/seeds are filed under a *docs* path (`architecture/docs/database/`) despite being executable schema artifacts.
- The repo has no top-level `README.md`; the root is agent-facing only.

## Decisions (user-approved 2026-07-14)

### D-A — Target layout

```
dart-analytics/
├── CLAUDE.md                    # router (role unchanged)
├── README.md                    # NEW — human orientation page
├── DECISIONS.md                 # moved from architecture/
├── app/
├── database/                    # moved from architecture/docs/database/
│   ├── CLAUDE.md
│   ├── README.md
│   ├── migrations/0001–0016     # git mv only; contents byte-identical
│   └── seeds/0001–0002
├── docs/
│   ├── CLAUDE.md                # merged from architecture/CLAUDE.md + architecture/docs/CLAUDE.md
│   ├── architecture/            # moved from architecture/docs/architecture/ (incl. 00-Context-Map.md, 05-Database/, 06-API/, 07-Frontend/)
│   └── superpowers/             # unchanged
├── graphify-out/
└── scripts/
```

`architecture/` ceases to exist.

### D-B — SQL is not documentation

Migrations and seeds move to top-level `database/`. Rationale: docs/ becomes purely documentation; the schema is a first-class executable artifact. Moving applied migration **files** does not violate the never-modify invariant — contents stay byte-identical and dbmate tracks applied versions by number, not path (verify with `db:status` post-move).

### D-C — Ledger to repo root; master context retired

- `DECISIONS.md` → repo root (maximum visibility, changelog-style).
- `architecture/000_master_context.md` is **deleted** (user decision). `DECISIONS.md` is its distillation; git history preserves the file. The "deeper lineage" pointer in the DECISIONS.md header is replaced with a git-history note. The context map's "Why was X decided?" pack drops its escalation target.

### D-D — Merge the two nested CLAUDE.md files

`architecture/CLAUDE.md` and `architecture/docs/CLAUDE.md` overlap ~60% (both are "how to edit docs" rules). They merge into one `docs/CLAUDE.md` (~1 page) covering: task routing per layer, historical-documents policy, SQL safety pointers (now referencing `database/CLAUDE.md`), editing workflow, consistency checks, definition of done.

### D-E — New root `README.md` (thin by design)

Contents: one-paragraph project description; stack line; five top-level folders with one line each; getting-started pointers (`app/README.md`, `.env.example`, `npm run validate:app`); pointers (not copies) to `docs/architecture/README.md`, `DECISIONS.md`, `CLAUDE.md`. It must not become a second registry — the context map owns the inventory. `check-context-map.sh` scans every README for backticked paths, so it is link-checked from day one.

### D-F — Atomic mechanics

One commit performs the moves **and** every reference rewrite, so `scripts/check-context-map.sh` passes at that commit:

1. `git mv` (preserves blame): `architecture/docs/architecture/` → `docs/architecture/`; `architecture/docs/database/` → `database/`; `architecture/DECISIONS.md` → `DECISIONS.md`; delete `architecture/000_master_context.md`; merge the two CLAUDE.md files into `docs/CLAUDE.md`.
2. Rewrite path references in: root `CLAUDE.md` (router table, context protocol, graphify section), merged `docs/CLAUDE.md`, `app/CLAUDE.md`, `app/src/db/CLAUDE.md`, `app/src/pages/api/CLAUDE.md`, `00-Context-Map.md` (packs, inventory, path-convention note, version bump), `scripts/check-context-map.sh` (hardcoded resolver bases and glob roots), `app/package.json` (dbmate `--migrations-dir ../database/migrations`), `app/.env.example` (DBMATE override comments), `.github/pull_request_template.md` if it names paths, and front-matter `read-when`/scope lines naming old paths.
3. **Historical docs stay untouched**: `docs/superpowers/**`, `05-Database/07`–`09`. Old-path text inside them is expected; the checker exempts `status: historical`.
4. New `DECISIONS.md` entry (D94): single docs tree, top-level `database/`, master context retired, root README added.
5. Add root `README.md` (D-E).

### D-G — Sequencing constraint (graphify)

The move invalidates every `source_file` in `graphify-out/graph.json`, requiring a **full** graph rebuild — which currently collides with the non-reproducible refresh command (see `2026-07-14-graphify-signal-hardening-design.md`). Therefore: the graphify hardening spec's Decision 4 (canonical build command) lands **before or together with** this restructure, or the rebuild is executed in the environment that produced the original graph. The restructure must not commit a collapsed graph.

## Rejected alternative

Flatten only the inner nesting (`architecture/05-Database/...`, keep `architecture/` top-level). Fixes the stutter but preserves two sibling doc roots — the core complaint.

## Success criteria

1. `architecture/` no longer exists; layout matches D-A.
2. `scripts/check-context-map.sh` passes at the restructure commit.
3. `cd app && npm run db:status` shows all 16 migrations applied (path move invisible to dbmate).
4. Root `README.md` exists and all its backticked references resolve.
5. `graphify-out/graph.json` reflects the new paths without corpus collapse.
