---
id: D0551
status: accepted
date: 2026-11-10
origin: contemporaneous
original-date:
tags: [context-system, docs, skill, gate, CI, husky, pre-commit, PR]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Pre-commit gates are path-scoped from one table; a wiring gate keeps the gate lists in step

## Context and Problem Statement
every commit ran 25 gates in about 110 s, 100 s of it in five gates that read only a few trees; four hand-kept lists (pre-commit, `quality.yml`, the skill, `edit-gate.py`) had nothing checking them, and `check-engine-kernels.sh` was missing from the skill.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`.husky/pre-commit` runs `scripts/run-precommit-gates.sh`, which reads `scripts/precommit-gates.tsv` (`<script><TAB><regex>`). A row with a regex runs only when a staged path matches: `check-type-barrels.sh` on `app/src`, `app/tests`, `app/tsconfig.json`; the two game-rules gates on `docs/game-rules/`; the two tag-seed gates on `docs/game-rules/`, `database/seeds/`, `app/scripts/tags/`. Each regex includes the gate's own script. `scripts/check-gate-wiring.sh` fails when a `check-*.sh` or `test-*.sh` is missing from CI or from the `run-all-gates` skill, when a table row names a missing script, and when a `check-*.sh` is in neither the table nor the script's `NOT_IN_PRECOMMIT` list, which states a reason per entry.".

### Consequences
`quality.yml` still runs every gate on every PR, so scoping delays a failure to CI and never hides one. A docs-only commit takes about 4 s. A new gate script fails pre-commit and CI until it is wired in all three places.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-11-10
