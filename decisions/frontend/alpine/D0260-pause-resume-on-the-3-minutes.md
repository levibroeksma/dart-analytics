---
id: D0260
status: accepted
date: 2026-09-07
origin: contemporaneous
original-date:
tags: [frontend/alpine, state, persist, x-show]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Pause/resume on the 3 MINUTES-countdown rulesets is one persisted `timerPaused` flag plus one shared toggle in `play-lifecycle.ts`, never read by an engine

## Context and Problem Statement
Feature request to let a player step away mid-session without either losing progress (abandon) or having the countdown keep running unattended. `SegmentTimer.stop()`/`start()` already round-trips `remaining` correctly, so the whole feature is wiring a boolean through the existing choke points rather than any change to the timer primitive itself. Centralizing the toggle in `play-lifecycle.ts` (rather than three hand-rolled copies) and gating both shared choke points there means a fourth MINUTES-mode game only needs to pass its own `timer` field through, not re-derive the stop/resume/guard logic. `OneTwentyOnePlayContext` needed an explicit `togglePause(this: OneTwentyOnePlayContext): void` method signature added to its own hand-written type (not needed for `ScoreTrainingPlayContext`/`TuodPlayContext`, whose otherwise-identical `*.data.test.ts` files build their test doubles by spreading `{ ...xPlay() }` with no `as XPlayContext` cast at the call site) — a concrete instance of `FINDINGS.md`'s F29 (these three types hand-restate `PlayLifecycleContext`'s shape instead of reusing it) actually biting during this task.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Score Training, TUOD, and 121 (`_V2`) each gain a Pause/Resume icon toggle next to their existing MINUTES countdown label. `game.store.ts` gains `timerPaused: boolean` (own `persist()` call per D120, defaulting `false`, reset by both `startSession()` and `reset()`); `PlayStoreContext<TConfig>["game"]` widens with the matching optional field. `play-lifecycle.ts` gains one shared `playToggleTimerPause(context: PlayLifecycleContext<...> & { timer: SegmentTimer | null })`: a no-op without a live `timer` or once `finished`, otherwise `timer.stop()` + `timerPaused = true` when running, or `timer.start()` + `timerPaused = false` when already paused — `SegmentTimer.stop()`/`start()` already preserve `remaining`, so no `SegmentTimer` change was needed. The same module's two shared choke points, `playCommitDart` and `playRunBotVisualBoardVisit`, both become no-ops while `$store.game.timerPaused` is true (the latter re-checked mid-visit, both before and after the bot's pre-throw delay, so a pause mid-throw stops the bot cleanly rather than completing one more dart). Each of the three games' own `submitVisit`/`recordDart`/`undoVisit`/`maybeRunBotVisit` methods add the identical `|| this.$store.game.timerPaused` guard clause (TUOD's `recordAttempt` too), and each's `init()` stops a freshly-rebuilt timer immediately if the store says it was already paused before the reload — the field is ephemeral client state, `$persist`-ed for reload continuity only, never uploaded as part of the events batch and never read by any engine. `BoardInputPanel.astro`'s wrapping `x-show` gains `&& !$store.game.timerPaused` alongside its existing `!finished` clause, hiding the pointer surface, undo, and bounce-out together with the keypad. Two new icons (`icons/pause.svg`, `icons/play.svg`) render through the existing `Button` primitive, mirroring every other standalone action in these games' templates.".

### Consequences
adding the `timerPaused` guard inline to `init()`'s existing MINUTES branch pushed both Score Training's and TUOD's `init()` over `npx fallow`'s per-function complexity threshold (TUOD's `submitVisit` too, from its own added guard clause); both files' `init()` now delegate to a local `maybeResumeCountdown(game, config, engine)` helper 121 already had reason to use (its own `init()` was structured this way from D243 onward), and TUOD's `submitVisit` extracts its guard into a `canSubmitVisit(context)` predicate mirroring the existing `canReplay()` precedent in `one-twenty-one-play.data.ts` — no behavior change, confirmed by the full existing test suites passing unchanged plus the new pause/resume cases. `OneTwentyOne.astro` gained a standalone countdown-label block (identical in shape to Score Training's/TUOD's own) between its solo and split-view templates; the implementation plan described this block as already present for the 1v1 (`SplitScoreboard`) case pending only a button addition, but no such block existed in the file at execution time — the plan's assumption did not hold, so the block was added fresh rather than edited in place. Manually verified in a running dev server (browser-driven, network layer mocked for `/api/sessions/active` and `/api/auth/**` since this session's container has no live Neon connection): the countdown freezes exactly at pause, the keypad disables, resume continues from the same remaining time, and a reload while paused stays paused. Full design and implementation plan: `docs/superpowers/specs/2026-09-07-pause-resume-timed-modes-design.md`, `docs/superpowers/plans/2026-09-07-pause-resume-timed-modes.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-07
