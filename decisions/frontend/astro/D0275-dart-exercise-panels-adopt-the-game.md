---
id: D0275
status: accepted
date: 2026-09-14
origin: contemporaneous
original-date:
tags: [frontend/astro, component, slot]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Dart exercise panels adopt the game play-screen shape; a timed step's clock is a countdown `SegmentTimer`

## Context and Problem Statement
the reported "the second game's scoring on 20's doesn't have an input" was not a capture defect — `classify()` resolves the 20 sector correctly and `SwitchingEngine` scores it like any other target. What the screen lacked was every confirmation a game gives: no score in the familiar shape, no per-dart hit/miss mark, no sense of how long the step had left. Reusing the game components rather than inventing panel-specific markup makes the exercise read as what it is. One clock rather than a timer plus a deadline removes the possibility of the display and the expiry disagreeing.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`SwitchingPanel.astro` and `DoublePatternPanel.astro` render the skeleton every board-input game already uses — `SinglePlayerDisplay` (`isTarget={false}`, total points as the big number) with target/darts/remaining-time `StatRow`s in its `progress` slot, `VisitPreview` beneath it, then the existing `ExerciseBoardInputPanel`. Neither passes `DartBoard`'s `highlightPathExpr`: that overlay stays Warm-Up-only. The step's hidden `setTimeout` deadline is replaced by one countdown `SegmentTimer` (`segmentDurationsSeconds: [durationSeconds]`, `direction: "countdown"`) whose `onTick` publishes `stepRemainingSeconds` and whose `onComplete` runs the engine's `expireTimer()` then `completeCurrentStep()` — the same expiry the `setTimeout` performed. The countdown is read-only; no pause/resume, no `timerPaused` for exercises.".

### Consequences
the step now ends with `SegmentTimer`'s completion beep (440 Hz, 0.6 s), where it previously ended silently mid-visit; no interim beeps fire, since `intervalMinutes` is not passed and `tickCountdown`'s `remaining % 0` never matches. `playPreviewSegments` renders exactly three slots, which matches a Switching visit (one pass through `config.targets`) and a Double Pattern visit (one pattern) in the seeded Balanced Training configuration — a future four-target configuration would show only its first three darts. `SwitchingEngine` and `DoublePatternEngine` remain `ExerciseEngine`s (D264): no `RulesetVersionKey`, no seats, no `game_types` row. D101 applies to both panels — markup only, no component test.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-14
Referenced by D0454's `Supersedes:` line.
Referenced by D0483's `Supersedes:` line.
