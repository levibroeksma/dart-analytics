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

# Mid-game sheets show a context row derived from the persisted fact log

## Context and Problem Statement
the design's context row had no data source on the sheets that need it; deriving it from the log keeps facts stored and meaning derived, and needs no server or store-shape change.

## Decision Drivers
* Let the player confirm leave, finish or continue without closing the sheet to check where they are (spec, Intent).
* Show no wrong or stale number: a missing part beats a wrong one (spec, Anti-goals).
* Make no server or API change (spec, Non-goals).

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "the Exit sheet, the four finish confirms (501, 121, TUOD, Score training), the routine finish confirms and the Continue-session sheet carry an `InlayRow` with game, stage and round on the left and the throwing seat's value on the right (#822). `modules/game/session-context.module.ts` folds the stored stages, turns and config snapshot through each game's existing `fold*State`; `$store.game.contextRow(expectedSessionId?, fallbackTitle?)` exposes it, so every sheet reads one derivation. `InlayRow` gains `rowExpr`: a part with no data is dropped with its dot, and the row hides when nothing is left. Continue reads the local log only and falls back to the game name. On a routine, Exit shows the step game's line; finish confirms add `<routine name> · Step n of N` over the game's round and value. A stale persisted log never renders: sites pass the session in play, and routines guard with the non-persisted `trainingSession.gameSessionId`, set by the game adapter's `open` and cleared by `close`/`reset`. Spec: `docs/superpowers/specs/2026-10-10-modal-context-rows-design.md`.", because the design's context row had no data source on the sheets that need it; deriving it from the log keeps facts stored and meaning derived, and needs no server or store-shape change.

### Consequences
no API, `SessionActive` or migration change. Games outside the four mapped get no Exit row. TUOD's play header reads `ATTEMPT n OF N` while the row reads `Round n of N`. `.astro` carries no unit test (D101); the module, store method, adapter guard and `stepContextRow` are tested.

* Neutral, because on a routine the Exit sheet shows the step game's line: `$store.game` holds no routine name or step count, and the owner chose no store change on 2026-10-10 (spec, Sites).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Spec § Builder's calls: the derivation module is unit-tested per game, including the empty and partial cases. `app/tests/modules/game/session-context.module.test.ts` exists in the repo.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-10-10

* Commit `acca7677` (PR #887, 2026-10-10): origin of the existing Context, Decision Outcome and Consequences text. It rebuilt no section here.
* `docs/superpowers/specs/2026-10-10-modal-context-rows-design.md` (Intent, Goals, Non-goals, Anti-goals, Sites, Builder's calls): rebuilt Decision Drivers, Consequences and Confirmation.
