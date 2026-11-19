---
id: D0115
status: accepted
date: 2026-07-17
origin: contemporaneous
original-date:
tags: [frontend/architecture, types, interfaces]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Relocated inline `export type`/`export interface` declarations out of implementation

## Context and Problem Statement
PR review found the doc's own worked example was ambiguous enough to be repeatedly misapplied once a shortcut was set as precedent early in the plan and copied forward into every later task; user explicitly approved the doc hardening

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Relocated inline `export type`/`export interface` declarations out of implementation files into folder-level `types.ts`/`interfaces.ts` barrels: `services/session.service.ts` → `services/types.ts` (`ServiceResult`, `CreateSessionResult`, `AppendBatchResult`); `services/rulesets/score-training/score-training.config.schema.ts` deleted, its Zod schema + inferred type folded into `services/rulesets/score-training/types.ts` (`ScoreTrainingConfig`, `ScoreTrainingConfigData`); `stores/game.store.ts` → new `stores/types.ts` (`GameConfigSnapshot`, `RecordedTurn`); `lib/game/score-training-play.data.ts` + `lib/game/score-training-setup.data.ts` → new `lib/game/types.ts` (`ScoreTrainingPlayContext`, `ScoreTrainingSetupContext`), plus new area-root `lib/types.ts`; `modules/game/score-training.engine.module.ts` → new `modules/game/types.ts` (`ScoreTrainingEngineOptions`, `RecordedVisit`); `modules/ui/segment-timer.module.ts` → new `modules/ui/interfaces.ts` (`SegmentTimerOptions`); plus new area-root barrels `modules/types.ts` and `modules/interfaces.ts`. Hardened `06-API/03-Shared-Conventions.md` (v1.5.0), `07-Frontend/04-Modules-And-OOP.md` (v0.1.2), `07-Frontend/10-Frontend-Agent-Guide.md` (v0.1.2) with an explicit hard-rule against inline declarations and a browser-side worked example".

### Consequences
Rationale unknown — backfill pending.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-07-17
