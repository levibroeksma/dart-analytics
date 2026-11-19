---
id: D0440
status: accepted
date: 2026-10-10
origin: contemporaneous
original-date:
tags: [frontend/style]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Mid-game sheets show a context row derived from the persisted fact log

## Context and Problem Statement
the design's context row had no data source on the sheets that need it; deriving it from the log keeps facts stored and meaning derived, and needs no server or store-shape change.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "the Exit sheet, the four finish confirms (501, 121, TUOD, Score training), the routine finish confirms and the Continue-session sheet carry an `InlayRow` with game, stage and round on the left and the throwing seat's value on the right (#822). `modules/game/session-context.module.ts` folds the stored stages, turns and config snapshot through each game's existing `fold*State`; `$store.game.contextRow(expectedSessionId?, fallbackTitle?)` exposes it, so every sheet reads one derivation. `InlayRow` gains `rowExpr`: a part with no data is dropped with its dot, and the row hides when nothing is left. Continue reads the local log only and falls back to the game name. On a routine, Exit shows the step game's line; finish confirms add `<routine name> · Step n of N` over the game's round and value. A stale persisted log never renders: sites pass the session in play, and routines guard with the non-persisted `trainingSession.gameSessionId`, set by the game adapter's `open` and cleared by `close`/`reset`. Spec: `docs/superpowers/specs/2026-10-10-modal-context-rows-design.md`.", because the design's context row had no data source on the sheets that need it; deriving it from the log keeps facts stored and meaning derived, and needs no server or store-shape change.

### Consequences
no API, `SessionActive` or migration change. Games outside the four mapped get no Exit row. TUOD's play header reads `ATTEMPT n OF N` while the row reads `Round n of N`. `.astro` carries no unit test (D101); the module, store method, adapter guard and `stepContextRow` are tested.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-10
