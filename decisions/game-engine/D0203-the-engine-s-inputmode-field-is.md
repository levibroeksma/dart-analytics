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

# The engine's `inputMode` field is removed, not merely unused

## Context and Problem Statement
D198 left the field on the constructor for persistence and capability code and recorded that it "is dead and should be removed under its own decision". It governed nothing, and `astro check` reported it as unused on every run, so the branch shipped two permanent warnings that trained everyone to read a non-empty diagnostic list as clean. Removing the parameter without removing its call sites is what actually broke the build (`ts(2554)`, expected 1-2 arguments but got 3), which is the failure mode of a half-dead field: it stays cheap to keep and expensive to touch.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
* Leave the unused `inputMode` field on the constructor (the state D198 left).
* Remove it with all call sites (chosen).

## Decision Outcome
Chosen option: "`EngineInputMode` and every trace of it are gone: the third constructor parameter on `FiveOhOneEngine` and `ScoreTrainingEngine`, the third parameter on `GameEngineFactory.create` and both factories, `engineInputMode()` in `session-mode-resolution.ts`, and the `EngineInputMode` type itself. `create(config, prior?)` is the whole contract. D198's shape-dispatch rule is unchanged and is now structural rather than conventional — there is no mode on an engine for a future method to disagree with.".

### Consequences
Four tests were DELETED rather than re-pointed — one in `five-oh-one-play.data.test.ts`, three in `score-training-play.data.test.ts` — because their sole assertion was which mode reached `factory.create`, and that argument no longer exists. Per D148 the alternative would have been re-pointing them at a different input to keep them green, which is exactly the failure that rule exists to catch. This drops the only executable guard on D200 at the engine-construction seam; D200's live surface is now the board gate in `BoardInputPanel.astro`, which is `.astro` markup and unit-tested by nothing (D101). The 35 engine tests that passed `"VISUAL_BOARD"` as a third argument kept their bodies and assertions — only the now-nonexistent argument was dropped — and two `undo()` describe titles naming `inputMode` were re-pointed at the same guarantee they always tested, the fact log's shape.

* Bad, because commit `b8eaa424` drops the last executable guard on D200 at the engine-construction seam; D200 now lives only in `BoardInputPanel.astro`, which no unit test covers (D101).
* Good, because `astro check` went from 2 hints to 0 errors, 0 warnings, 0 hints.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### Leave the unused `inputMode` field
* Bad, because `astro check` reported it unused on every run, so the branch shipped two permanent hints.
* Bad, because a future method keyed on it could disagree with `record()`.

### Remove the field with all call sites
* Good, because shape dispatch becomes structural: no engine carries a mode a future method could disagree with.

## Evidence / More Information
Decided: 2026-08-10

* Commit `b8eaa424` (2026-08-10; adds D203): rebuilt Considered Options, Pros and Cons and Consequences.
* Supersedes D198 (the field D198 left as dead).
