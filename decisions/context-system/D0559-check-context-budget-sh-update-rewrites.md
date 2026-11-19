---
id: D0559
status: accepted
date: 2026-11-16
origin: contemporaneous
original-date:
tags: [context-system, context map, pre-commit]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `check-context-budget.sh --update` rewrites File Inventory size claims only

## Context and Problem Statement
the failure message already printed the computed value, yet each fix was a manual `wc -c` and `sed` edit, repeated after every code simplification in the 501 statistics retro (at least seven failures).

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`scripts/check-context-budget.sh --update` rewrites the claimed `~Nk` of every File Inventory row (`FILE_ROW`) that fails the 20% test to the computed `chars/4/1000`, formatted by `fmt_k()`. Rows within tolerance are untouched. `00-Context-Map.md` pack totals are never rewritten; they stay human-authored. Without the flag the script behaves as before. `CONTEXT_BUDGET_ROOT` replaces the repo root for `scripts/test-check-context-budget.sh`.".

### Consequences
narrows D133's "never rewrites the map" to the Context Map; the inventory is now rewritable on request. The test runs in `quality / structure` and, scoped by path, in pre-commit.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`scripts/check-context-budget.sh` accepts `--update`. `scripts/test-check-context-budget.sh` runs in `.github/workflows/quality.yml` and, scoped by path, in `scripts/precommit-gates.tsv`.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-11-16

* Commit `595fafb7` (2026-11-16; adds `--update` to `scripts/check-context-budget.sh` and the D559 row): rebuilt Confirmation; source of the Context and Consequences text.
* Applied in: `docs/superpowers/plans/2026-11-17-near-miss-distance-rule.md`, `docs/superpowers/plans/2026-11-17-doubles-training-statistics-page.md`, `docs/superpowers/plans/2026-11-17-track-games-statistics-page.md`.
