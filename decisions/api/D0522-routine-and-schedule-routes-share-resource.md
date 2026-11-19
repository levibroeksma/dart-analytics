---
id: D0522
status: accepted
date: 2026-11-04
origin: contemporaneous
original-date:
tags: [api, session]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Routine and schedule routes share resource factories; repositories, services and ruleset validators share small helpers

## Context and Problem Statement
the CRUD route files, schedule/session/routine repositories and the ruleset validators were the clone groups left after D521. Each helper takes data (a schema, a predicate, an issue string), so no flags.

## Decision Drivers
* Remove as much duplication as possible, so a rule change is made once (`docs/superpowers/specs/2026-10-31-duplication-backlog-design.md`, Intent).
* Every phase lowers `scripts/dupes-baseline.txt` (spec, Goals 4).
* No behaviour change: HTTP status, envelope and body of every route stay the same, and existing test assertions are never weakened (plan, Global Constraints).
* No per-caller boolean flags: variation goes through parameters that carry data (plan, Global Constraints).

## Considered Options
* Resource route factories and shared repository, service and validator helpers (chosen).
* Merge the remaining groups with per-caller boolean flags.
* Leave the clone groups in the baseline, which is the state the D513 ratchet leaves.

## Decision Outcome
Chosen option: "`collectionRoutes({ list, create, createSchema })` and `itemRoutes({ param, get, replace, remove, updateSchema })` in `lib/server/resource-routes.ts` build the `GET`/`POST` and `GET`/`PUT`/`DELETE` handlers of the four routine and schedule routes (`POST` answers 201, `DELETE` 204 with no body and `X-Request-Id`). Repository and service helpers: `ownedSchedule`, `findActiveSessionWhere`, `mapRoutineStepRow` (`row-helpers.ts`), `prepareRoutineWrite`, and `SessionParticipantRecord` with the `insertSessionWithActiveGuard` param derived from `CreateSessionRecordsInput` (`repositories/interfaces.ts`). `validateModeGatedConfig(schema, config, modeSupported, unsupportedIssue)` in `rulesets/mode-gated-config.ts` backs `validateConfig` of Score Training, TUOD, 121, 501 and the three-dart factory; `BatchValidationInput` and `ModedBatchValidationInput` in `rulesets/types.ts` replace the inline `validateBatch` param literals.".

### Consequences
no HTTP, SQL or issue-string change. `mapRoutineStepRow` sits after `exerciseDescription` in `findRoutineExecutionRows`, so the internal row's `sequenceNumber` key moves; SQL column order and JSON bodies are unchanged, and when several step columns are null at once the thrown `nonNull` error may name a different column (view-invariant breach only). Skipped: `prisoner.validator.ts` (two-stage gate). Residual: the `validateBatch` copy shared by Score Training and TUOD. Baseline 30 → 22 rows. Plan: `docs/superpowers/plans/2026-11-04-duplication-backlog-phase-3b-3c.md`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`tests/lib/server/resource-routes.test.ts` covers the route factories and `tests/services/rulesets/mode-gated-config.test.ts` covers `validateModeGatedConfig`. `scripts/check-dupes.sh` fails when a clone group count rises and when a baseline row is stale.

## Pros and Cons of the Options
### Resource route factories and shared helpers
* Good, because a fix no longer lands in one copy and not the others (spec, Intent).
* Bad, because a thrown `nonNull` error may name a different column when several step columns are null at once. That breach of a view invariant is an accepted difference (plan, Task G2).

### Merge with per-caller boolean flags
* Bad, because the plan's Global Constraints forbid per-caller boolean flags.

### Leave the clone groups in the baseline
* Bad, because each copy is a place where a fix lands in one game and not the others (spec, Intent).

## Evidence / More Information
Decided: 2026-11-04
Supersedes: none. Extends D513, D521.

* `docs/superpowers/plans/2026-11-04-duplication-backlog-phase-3b-3c.md` (Global Constraints, Review Focus, PR G Tasks G1–G4; names D521, not D522): rebuilt Decision Drivers, Considered Options, Confirmation and Pros and Cons.
* `docs/superpowers/specs/2026-10-31-duplication-backlog-design.md` (Intent, Goals, Phase 3): rebuilt Decision Drivers and Pros and Cons.
* Commit `9b44a950` (2026-11-04, "docs: D522, inventory rows, history 1.204.0, dupes baseline 30 -> 22"): source of the Context and Decision Outcome text.
