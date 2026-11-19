---
id: D0552
status: accepted
date: 2026-11-10
origin: contemporaneous
original-date:
tags: [context-system]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Long service, repository, module and script functions are split by extraction only

## Context and Problem Statement
unit size was the health score's one capped penalty (10.0); these functions carried validation, record building and response shaping in one body.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "the 27 functions over 60 lines outside Alpine factories and Astro templates are split into unexported helpers in the same file: `session.service.ts`, `training-session.service.ts`, `statistics.service.ts`, `routine.service.ts`, `statistics.repository.ts`, `session.repository.ts`, `dart-engine-shell.module.ts`, `dart-exercise-shell.module.ts`, `board-input.module.ts`, `chart.module.ts`, `setup-session.ts`, `setup-controller.ts`, `play-lifecycle.ts`, `stats-cache/cache.ts`, `scripts/generate-tag-seed.ts`, `scripts/dartbot-level-curve-recalibration.ts`. Every exported name, signature and result is unchanged. Three shapes recur: a query's fixed select-column object becomes a module constant; a factory that returned a class now returns a three-line subclass of a module-level class; a factory that returned one object literal spreads module-level method groups in the original key order.", because unit size was the health score's one capped penalty (10.0); these functions carried validation, record building and response shaping in one body.

### Consequences
`large_functions_src` 114 → 87 and health score 87.6 → 88.7, both recorded in `scripts/quality-benchmarks.json`. The statistics SQL golden test, the tag-seed byte check and the integration suite pass unchanged. No file, export or shared helper was added (rule of three, D513).

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
