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
<!-- backfill: pending -->

# Routine and schedule routes share resource factories; repositories, services and ruleset validators share small helpers

## Context and Problem Statement
the CRUD route files, schedule/session/routine repositories and the ruleset validators were the clone groups left after D521. Each helper takes data (a schema, a predicate, an issue string), so no flags.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`collectionRoutes({ list, create, createSchema })` and `itemRoutes({ param, get, replace, remove, updateSchema })` in `lib/server/resource-routes.ts` build the `GET`/`POST` and `GET`/`PUT`/`DELETE` handlers of the four routine and schedule routes (`POST` answers 201, `DELETE` 204 with no body and `X-Request-Id`). Repository and service helpers: `ownedSchedule`, `findActiveSessionWhere`, `mapRoutineStepRow` (`row-helpers.ts`), `prepareRoutineWrite`, and `SessionParticipantRecord` with the `insertSessionWithActiveGuard` param derived from `CreateSessionRecordsInput` (`repositories/interfaces.ts`). `validateModeGatedConfig(schema, config, modeSupported, unsupportedIssue)` in `rulesets/mode-gated-config.ts` backs `validateConfig` of Score Training, TUOD, 121, 501 and the three-dart factory; `BatchValidationInput` and `ModedBatchValidationInput` in `rulesets/types.ts` replace the inline `validateBatch` param literals.".

### Consequences
no HTTP, SQL or issue-string change. `mapRoutineStepRow` sits after `exerciseDescription` in `findRoutineExecutionRows`, so the internal row's `sequenceNumber` key moves; SQL column order and JSON bodies are unchanged, and when several step columns are null at once the thrown `nonNull` error may name a different column (view-invariant breach only). Skipped: `prisoner.validator.ts` (two-stage gate). Residual: the `validateBatch` copy shared by Score Training and TUOD. Baseline 30 → 22 rows. Plan: `docs/superpowers/plans/2026-11-04-duplication-backlog-phase-3b-3c.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-11-04
Supersedes: none. Extends D513, D521.
