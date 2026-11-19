---
id: D0549
status: accepted
date: 2026-11-10
origin: contemporaneous
original-date:
tags: [context-system, gate, CI, pre-commit, PR]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Eight fallow numbers are ratcheted benchmarks; the 95 target is the health score of production code

## Context and Problem Statement
the average maintainability index cannot reach 95 by its formula (the import term alone averages 5.2); 639 of 774 functions over 60 lines were `describe` callbacks; the hotspot penalty needs git history, so a shallow CI clone and a full clone disagreed.

## Decision Drivers
* The average maintainability index cannot reach 95 by its formula; the import term alone averages 5.2.
* 639 of 774 functions over 60 lines were `describe` callbacks.
* The hotspot penalty needs git history, so a shallow CI clone and a full clone disagreed.

## Considered Options
* Read the 95 target as the average maintainability index.
* Count test `describe` callbacks as long functions.
* Include fallow's hotspot penalty in the score.
* Record 8 ratcheted benchmark rows, with 95 as the health score of production code (chosen).

## Decision Outcome
Chosen option: "`scripts/quality-benchmarks.json` records eight rows, each with a direction, a current value and a target: `health_score` (87.6 → 95.0), `mi_average` (91.0, floor), `mi_lowest_file` (76.9 → 80), `large_functions_src` (114 → 20), `large_test_bodies` (19 → 0), `max_cyclomatic` (14), `dup_pct_weak` (2.2 → 1.0), `dup_pct_semantic` (18.3 → 12.0). `scripts/check-quality-benchmarks.sh` fails when a row is worse than recorded and when a row is better than recorded (float rows: by more than 0.5); a PR that improves a row runs `--update` in the same PR. The score is read with `app/.fallowrc.score.jsonc` (`tests/**` and generated `src/db/schema.ts` out of the score) and `--score` (no hotspot penalty). Owner choices, 2026-11-10: "95" is fallow's health score, not the average maintainability index; test `describe` blocks do not count as long functions.".

### Consequences
the gate runs in the `quality / app` CI job, not in pre-commit. Tests stay under the main fallow gate and are held by `large_test_bodies`. A new feature that adds a long function, or raises duplication above a recorded row, fails CI until it is split or folded.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`scripts/check-quality-benchmarks.sh` compares fallow output with `scripts/quality-benchmarks.json`. The `quality / app` job in `.github/workflows/quality.yml` runs it with `scripts/test-check-quality-benchmarks.sh`. `.husky/pre-push` also calls it, only when the pushed range touches `app/src/`.

## Pros and Cons of the Options
### Read the 95 target as the average maintainability index
* Bad, because the formula cannot reach 95; the import term alone averages 5.2.

### Count test `describe` callbacks as long functions
* Bad, because 639 of 774 functions over 60 lines were `describe` callbacks.

### Include the hotspot penalty in the score
* Bad, because the penalty needs git history, so a shallow CI clone and a full clone disagreed.

### Record 8 ratcheted benchmark rows
* Good, because the gate fails when a row is worse than recorded, and when it is better, so gains are locked in with `--update`.
* Bad, because a new long function or higher duplication fails CI until it is split or folded.

## Evidence / More Information
Decided: 2026-11-10

* Commit `8e4ae3e6` (adds the D549 row, `scripts/check-quality-benchmarks.sh`, `scripts/quality-benchmarks.json`, `app/.fallowrc.score.jsonc` and the `quality.yml` step): rebuilt Decision Drivers, Considered Options, Pros and Cons and Confirmation.
* Commit `752b5996` (adds the `.husky/pre-push` call that runs the check when `app/src/` changes): rebuilt Confirmation.
