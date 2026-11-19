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

# Long service, repository, module and script functions are split by extraction only

## Context and Problem Statement
unit size was the health score's one capped penalty (10.0); these functions carried validation, record building and response shaping in one body.

## Decision Drivers
* Unit size was the health score's one capped penalty (10.0), and the audit's goal was a health score of 95.
* The audit's formula says 95 needs at most 5.2 large functions per 1 000.
* The audit's hard rule: nothing visible or functional changes, including the test count.

## Considered Options
* Leave the long functions as they are (the state described in Context).
* Split by extraction only: unexported helpers in the same file, with no new files, exports or cross-file shared helpers (chosen).
* Extract shared helpers across files (the plan rules this out by the rule of three, D513).

## Decision Outcome
Chosen option: "the 27 functions over 60 lines outside Alpine factories and Astro templates are split into unexported helpers in the same file: `session.service.ts`, `training-session.service.ts`, `statistics.service.ts`, `routine.service.ts`, `statistics.repository.ts`, `session.repository.ts`, `dart-engine-shell.module.ts`, `dart-exercise-shell.module.ts`, `board-input.module.ts`, `chart.module.ts`, `setup-session.ts`, `setup-controller.ts`, `play-lifecycle.ts`, `stats-cache/cache.ts`, `scripts/generate-tag-seed.ts`, `scripts/dartbot-level-curve-recalibration.ts`. Every exported name, signature and result is unchanged. Three shapes recur: a query's fixed select-column object becomes a module constant; a factory that returned a class now returns a three-line subclass of a module-level class; a factory that returned one object literal spreads module-level method groups in the original key order.", because unit size was the health score's one capped penalty (10.0); these functions carried validation, record building and response shaping in one body.

### Consequences
`large_functions_src` 114 → 87 and health score 87.6 → 88.7, both recorded in `scripts/quality-benchmarks.json`. The statistics SQL golden test, the tag-seed byte check and the integration suite pass unchanged. No file, export or shared helper was added (rule of three, D513).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The plan's per-task check counts `large_functions` for the touched files with `npx --no-install fallow health --format json` and expects `0`. `scripts/quality-benchmarks.json` records `large_functions_src`, and `scripts/check-quality-benchmarks.sh` and `scripts/fallow-gate.sh` exist today.

## Pros and Cons of the Options
### Leave the long functions as they are
* Bad, because the functions carry validation, record building and response shaping in one body, and unit size holds the health score down.

### Extract unexported helpers in the same file
* Good, because every exported name, signature and result stays unchanged.
* Good, because `large_functions_src` falls from 114 to 87 and the health score rises from 87.6 to 88.7.

### Extract shared helpers across files
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-11-10

* `docs/superpowers/plans/2026-11-10-quality-5-long-functions.md` (Goal, Architecture, Global Constraints, Task 1; cites spec § 2, § 4): rebuilt Decision Drivers, Considered Options, Confirmation and Pros and Cons.
* `docs/superpowers/specs/2026-11-10-codebase-quality-audit-design.md` (§ 1, § 2): rebuilt Decision Drivers.
* Commit `ec2cc30b` (2026-11-11; splits `generate-tag-seed.ts` and the recalibration script, adds the D552 row): source of the Context and Consequences text.
