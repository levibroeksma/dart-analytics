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
<!-- backfill: pending -->

# Eight fallow numbers are ratcheted benchmarks; the 95 target is the health score of production code

## Context and Problem Statement
the average maintainability index cannot reach 95 by its formula (the import term alone averages 5.2); 639 of 774 functions over 60 lines were `describe` callbacks; the hotspot penalty needs git history, so a shallow CI clone and a full clone disagreed.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`scripts/quality-benchmarks.json` records eight rows, each with a direction, a current value and a target: `health_score` (87.6 → 95.0), `mi_average` (91.0, floor), `mi_lowest_file` (76.9 → 80), `large_functions_src` (114 → 20), `large_test_bodies` (19 → 0), `max_cyclomatic` (14), `dup_pct_weak` (2.2 → 1.0), `dup_pct_semantic` (18.3 → 12.0). `scripts/check-quality-benchmarks.sh` fails when a row is worse than recorded and when a row is better than recorded (float rows: by more than 0.5); a PR that improves a row runs `--update` in the same PR. The score is read with `app/.fallowrc.score.jsonc` (`tests/**` and generated `src/db/schema.ts` out of the score) and `--score` (no hotspot penalty). Owner choices, 2026-11-10: "95" is fallow's health score, not the average maintainability index; test `describe` blocks do not count as long functions.".

### Consequences
the gate runs in the `quality / app` CI job, not in pre-commit. Tests stay under the main fallow gate and are held by `large_test_bodies`. A new feature that adds a long function, or raises duplication above a recorded row, fails CI until it is split or folded.

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
