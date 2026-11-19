---
id: D0197
status: accepted
date: 2026-08-08
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset, 501, Score Training, turns]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `validateConfig` must admit every mode pair its `validateBatch` handles

## Context and Problem Statement
`validateConfig` runs at session creation, before any batch exists. D189 wired the batch path only, so the visual capture path could be validated but never entered — every attempt to start a 501 or Score Training session in `ANALYTICS + VISUAL_BOARD` was rejected before the engine was reached. Nothing in the branch's original plan covered this; it was found by the session-creation guard's implementer and confirmed by the controller. Widening `validateConfig` is what makes the capability declaration (D196) and the app-mode setting (D195) usable end to end rather than a switch that turns everything off.

## Decision Drivers
* `validateConfig` for 501 and Score Training rejected `ANALYTICS + VISUAL_BOARD` outright, although `validateBatch` already handled it through `validateVisualBoardTurns` (commit message, PR #75).
* Nothing compared `RULESET_CAPABILITIES` with each ruleset's `validateConfig`. That seam is where the 501 and Score Training visual-board bug lived (commit message, PR #75).

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`fiveOhOneValidator.validateConfig` and `scoreTrainingValidator.validateConfig` accept `ANALYTICS + VISUAL_BOARD` as well as `RECREATIONAL + QUICK_SCORE`, via the shared `isQuickScoreOrVisualBoardCapture` predicate in `services/rulesets/quick-score.validator.ts`. Both had hard-rejected anything but quick score while their own `validateBatch` already routed visual-board turns to `validateVisualBoardTurns`. A ruleset validator's config gate and its batch gate must admit the same set of mode pairs; the two halves are one statement of what the engine supports, not two independent checks.".

### Consequences
the predicate is deliberately decoupled from `RULESET_CAPABILITIES` — the validators keep their own mode statement and the capability constant mirrors it, so the two can be cross-checked instead of one silently defining the other. The pair remains asymmetric by design for the other four rulesets: `TUOD_V1` is quick-score only and `SINGLES_V1` / `BOBS27_V1` / `DOUBLES_TRAINING_V1` are `RECREATIONAL + DETAILED_DARTS`, none of which have a visual path. A future ruleset gaining a mode must change both halves and the capability declaration in the same edit, or a parity test fails: `capability-seed-parity.test.ts` covers `RULESET_CAPABILITIES` against seed `0007`, and `capability-validator-parity.test.ts` covers it against every ruleset's `validateConfig` in both directions — a declared pair its validator refuses, and an undeclared pair its validator accepts. (`scripts/check-game-engines.sh` is not a third: it asserts only that a registered engine's ruleset key appears in `RULESET_CAPABILITIES`, and its own header disclaims pair-level parity.)

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/lib/game/rulesets/capability-seed-parity.test.ts` compares `RULESET_CAPABILITIES` with seed `0007`. `app/tests/lib/game/rulesets/capability-validator-parity.test.ts` compares it with every ruleset's `validateConfig`. The Bob's 27 plan says each test fails as soon as one side declares a pair the other does not.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-08-08

* Commit `70d5b5e7` (PR #75, 2026-08-09; adds the D197 row, `isQuickScoreOrVisualBoardCapture` and `capability-validator-parity.test.ts`): rebuilt Decision Drivers.
* `docs/superpowers/plans/2026-08-12-bobs27-phase2-visual-board-capability.md` (Global Constraints): rebuilt Confirmation.
* Applied in: `docs/superpowers/specs/2026-08-12-bobs27-frontend-design.md`, `docs/superpowers/plans/2026-08-12-bobs27-phase2-visual-board-capability.md`.
