---
id: D0094
status: accepted
date: 2026-07-14
origin: contemporaneous
original-date:
tags: [context-system, docs]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Repository restructure

## Context and Problem Statement
Kill the `architecture/docs/architecture` stutter and the duplicate doc roots

Per the spec, canonical paths stuttered twice (`architecture/docs/architecture/05-Database/...`). "Where do docs go?" had two answers. SQL migrations and seeds sat under a docs path, and the repo had no top-level `README.md`.

## Decision Drivers
* Remove the `architecture/docs/architecture/` path stutter.
* Give "where do docs go?" one answer by removing the duplicate doc roots.
* Treat executable schema artifacts (migrations, seeds) as code, not documentation.

## Considered Options
* Keep two sibling doc roots, `architecture/` (with its nested `docs/`) and the top-level `docs/` (the layout before this record).
* Flatten only the inner nesting and keep `architecture/` at top level (rejected).
* Single top-level `docs/` tree, top-level `database/`, ledger at the root, master context retired (chosen).

## Decision Outcome
Chosen option: "Repository restructure: single `docs/` tree (`docs/architecture/`, `docs/superpowers/`), executable SQL promoted to top-level `database/`, ledger at repo root, master context retired (git history only), root `README.md` added", because Kill the `architecture/docs/architecture` stutter and the duplicate doc roots.

### Consequences
* Good, because `docs/` becomes purely documentation and the schema becomes a first-class executable artifact.
* Bad, because the move invalidates every `source_file` in `graphify-out/graph.json` and forces a full graph rebuild.
* Neutral, because the migration files move byte-identical and dbmate tracks applied versions by number, so the move does not touch them.
* Neutral, because `000_master_context.md` is deleted and stays recoverable from git history. `docs/superpowers/**` and `05-Database/07`–`09` stay untouched.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The spec's success criteria require that `architecture/` no longer exists, that `scripts/check-context-map.sh` passes at the restructure commit, and that `cd app && npm run db:status` shows all 16 migrations applied. They also require that every backticked reference in the new root `README.md` resolves and that the rebuilt graph reflects the new paths. `scripts/check-context-map.sh` exists today and scans every README for backticked paths.

## Pros and Cons of the Options
### Keep two sibling doc roots
* Bad, because the stutter and the ambiguity over where docs go remain.

### Flatten only the inner nesting
* Good, because it fixes the stutter.
* Bad, because it preserves two sibling doc roots, which the spec calls the core complaint.

### Single `docs/` tree with top-level `database/`
* Good, because it removes the stutter and the duplicate doc roots.
* Good, because executable SQL leaves the documentation tree.
* Bad, because the move forces a full graph rebuild and a rewrite of path references across canonical docs and scripts.

## Evidence / More Information
Decided: 2026-07-14

* `docs/superpowers/specs/2026-07-14-repo-restructure-design.md` (Problem, D-A to D-G, Rejected alternative, Success criteria): rebuilt Context, Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
* `docs/superpowers/plans/2026-07-14-repo-restructure.md` (the `DECISIONS.md` step): confirmed the D94 row text.
* Commit `3cc3423c` (2026-07-14): performed the moves and reference rewrites, and rebuilt the knowledge graph on the new paths.
