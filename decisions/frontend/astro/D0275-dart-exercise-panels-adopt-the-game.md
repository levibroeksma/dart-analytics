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

# Dart exercise panels adopt the game play-screen shape; a timed step's clock is a countdown `SegmentTimer`

## Context and Problem Statement
the reported "the second game's scoring on 20's doesn't have an input" was not a capture defect — `classify()` resolves the 20 sector correctly and `SwitchingEngine` scores it like any other target. What the screen lacked was every confirmation a game gives: no score in the familiar shape, no per-dart hit/miss mark, no sense of how long the step had left. Reusing the game components rather than inventing panel-specific markup makes the exercise read as what it is. One clock rather than a timer plus a deadline removes the possibility of the display and the expiry disagreeing.

## Decision Drivers
* The reported "the second game's scoring on 20's doesn't have an input" was not a capture defect: `classify()` resolves the 20 sector and `SwitchingEngine` scores it like any other target.
* The screen lacked every confirmation a game gives: no score in the familiar shape, no per-dart hit/miss mark and no sense of how long the step had left.
* One clock rather than a timer plus a deadline removes the chance that the display and the expiry disagree.

## Considered Options
* Keep the two-`StatRow` panels with the hidden `setTimeout` deadline.
* Invent panel-specific markup for the exercise screens.
* Reuse the game play-screen components and replace the deadline with one countdown `SegmentTimer` (chosen).

## Decision Outcome
Chosen option: "`SwitchingPanel.astro` and `DoublePatternPanel.astro` render the skeleton every board-input game already uses — `SinglePlayerDisplay` (`isTarget={false}`, total points as the big number) with target/darts/remaining-time `StatRow`s in its `progress` slot, `VisitPreview` beneath it, then the existing `ExerciseBoardInputPanel`. Neither passes `DartBoard`'s `highlightPathExpr`: that overlay stays Warm-Up-only. The step's hidden `setTimeout` deadline is replaced by one countdown `SegmentTimer` (`segmentDurationsSeconds: [durationSeconds]`, `direction: "countdown"`) whose `onTick` publishes `stepRemainingSeconds` and whose `onComplete` runs the engine's `expireTimer()` then `completeCurrentStep()` — the same expiry the `setTimeout` performed. The countdown is read-only; no pause/resume, no `timerPaused` for exercises.".

### Consequences
the step now ends with `SegmentTimer`'s completion beep (440 Hz, 0.6 s), where it previously ended silently mid-visit; no interim beeps fire, since `intervalMinutes` is not passed and `tickCountdown`'s `remaining % 0` never matches. `playPreviewSegments` renders exactly three slots, which matches a Switching visit (one pass through `config.targets`) and a Double Pattern visit (one pattern) in the seeded Balanced Training configuration — a future four-target configuration would show only its first three darts. `SwitchingEngine` and `DoublePatternEngine` remain `ExerciseEngine`s (D264): no `RulesetVersionKey`, no seats, no `game_types` row. D101 applies to both panels — markup only, no component test.

* Neutral, because the step now ends with the `SegmentTimer` completion beep (440 Hz, 0.6 s), where it previously ended silently mid-visit. No interim beeps fire, since `intervalMinutes` is not passed and `tickCountdown`'s `remaining % 0` never matches.
* Bad, because `playPreviewSegments` renders exactly three slots. A future four-target configuration would show only its first three darts, which the spec accepts rather than works around.
* Neutral, because `SwitchingEngine` and `DoublePatternEngine` remain `ExerciseEngine`s (D264), with no `RulesetVersionKey`, no seats and no `game_types` row.
* Neutral, because D101 applies to both panels: markup only, no component test.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The spec (§ 6) specifies Vitest coverage of the step timer, its teardown, the `m:ss` formatting and the preview classification. Panel markup is not unit-tested, per D101.

## Pros and Cons of the Options
### Keep the two-`StatRow` panels
* Bad, because the screen shows no score in the familiar shape, no per-dart hit/miss mark and no time left.
* Bad, because the step ends on a hidden `setTimeout`, mid-visit and unannounced.

### Panel-specific markup
* Bad, because reusing the game components is what makes the exercise read as what it is.

### Game play-screen shape with a countdown `SegmentTimer`
* Good, because a recorded dart becomes visible through the visit preview and the points readout.
* Good, because one countdown clock drives both the display and the expiry.

## Evidence / More Information
Decided: 2026-09-14
Referenced by D0454's `Supersedes:` line.
Referenced by D0483's `Supersedes:` line.

* `docs/superpowers/specs/2026-09-14-switching-double-pattern-play-interface-design.md` (§ 1 Problem, § 2 Scope, § 3 Final interface, § 4.1 One clock, § 6 Testing): rebuilt Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
* `docs/superpowers/plans/2026-09-14-switching-double-pattern-play-interface.md` (Task 5): rebuilt Consequences.
* Commit `d325f651` (2026-09-14; adds the D275 row).
* `docs/superpowers/specs/2026-10-23-pause-all-timers-design.md` (line 37): proposes a new decision that supersedes D275's "no pause" line.
