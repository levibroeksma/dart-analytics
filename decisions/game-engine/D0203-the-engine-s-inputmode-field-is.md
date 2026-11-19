---
id: D0203
status: accepted
date: 2026-08-10
origin: contemporaneous
original-date:
tags: [game-engine, engine, fact log, undo]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes: D0198
superseded-by:
---
<!-- backfill: pending -->

# The engine's `inputMode` field is removed, not merely unused

## Context and Problem Statement
D198 left the field on the constructor for persistence and capability code and recorded that it "is dead and should be removed under its own decision". It governed nothing, and `astro check` reported it as unused on every run, so the branch shipped two permanent warnings that trained everyone to read a non-empty diagnostic list as clean. Removing the parameter without removing its call sites is what actually broke the build (`ts(2554)`, expected 1-2 arguments but got 3), which is the failure mode of a half-dead field: it stays cheap to keep and expensive to touch.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`EngineInputMode` and every trace of it are gone: the third constructor parameter on `FiveOhOneEngine` and `ScoreTrainingEngine`, the third parameter on `GameEngineFactory.create` and both factories, `engineInputMode()` in `session-mode-resolution.ts`, and the `EngineInputMode` type itself. `create(config, prior?)` is the whole contract. D198's shape-dispatch rule is unchanged and is now structural rather than conventional — there is no mode on an engine for a future method to disagree with.".

### Consequences
Four tests were DELETED rather than re-pointed — one in `five-oh-one-play.data.test.ts`, three in `score-training-play.data.test.ts` — because their sole assertion was which mode reached `factory.create`, and that argument no longer exists. Per D148 the alternative would have been re-pointing them at a different input to keep them green, which is exactly the failure that rule exists to catch. This drops the only executable guard on D200 at the engine-construction seam; D200's live surface is now the board gate in `BoardInputPanel.astro`, which is `.astro` markup and unit-tested by nothing (D101). The 35 engine tests that passed `"VISUAL_BOARD"` as a third argument kept their bodies and assertions — only the now-nonexistent argument was dropped — and two `undo()` describe titles naming `inputMode` were re-pointed at the same guarantee they always tested, the fact log's shape.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-10
