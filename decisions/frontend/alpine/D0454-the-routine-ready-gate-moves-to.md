---
id: D0454
status: accepted
date: 2026-10-13
origin: contemporaneous
original-date:
tags: [frontend/alpine, x-data]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# The routine ready gate moves to routine start; exercise screens reuse game primitives

## Context and Problem Statement
the gate lived on the Warm-Up step alone, yet since D278 one unlocked `AudioContext` serves every cue of the routine, so the unlock belongs to the routine's start rather than to one step kind; one gate also lists the whole session before it begins (`Exercise Play.dc.html` 2b). A second input panel duplicated `BoardInputPanel` apart from the `$store.game` gate; optional props with the old behaviour as default keep the 11 games' built `play` HTML byte-identical (parity diff passed) while the exercise screens follow `Exercise Play.dc.html`.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "a routine shows one `RoutineReadyGate` ("Are you ready?", one row per step) once per page load, before its first step, on a fresh start and on a resume alike. Its slide runs `confirmRoutineReady()`, which calls `unlockAudioCues()` inside the gesture and then starts the first step; no server step starts before it. Warm-Up's per-step gate (`warmUpReady`, `confirmWarmUpReady()`, "Let's play!") is removed and its timer starts with its step. The play page's `x-data="routinePlay()"` moves onto `GameLayout` (D432), so the header — title (Title Case step title), `STEP n OF m`, `HeaderClockPill` — reads page methods built by the pure `routineHeader()`; the store's `headerLabel` getter is removed (the adapter's `headerLabel` stays for stats and replay). Exercise screens reuse the game primitives through default-preserving optional props (`BoardInputPanel` `showExpr`/`undoDisabledExpr`, `VisitPreview` `labelled`, `PlayStatTile` `highlight`/`fit`, `RouteChips` `currentExpr`, `SlideToStart` `inline`, `DartBoard` `dimPathExpr`), and `ExerciseBoardInputPanel` is deleted.".

### Consequences
spec `docs/superpowers/specs/2026-10-13-exercise-play-restyle-design.md` (with its Amendments); `.astro` carries no unit test (D101), so the proof of "games unchanged" is the before/after built-HTML diff. The `Time` stat row of exercises is gone — the header pill carries the clock. The ready gate is per page load, not per routine run: a reload mid-routine shows it again before the open step resumes.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-13
Supersedes: D270 (the per-step Warm-Up gate; its audio-unlock reasoning stands and now applies once per routine); D452 in part (`ExercisePanelShell`'s `dl` of `StatRow`s, its appended `Time` row, its `rows` prop and its `ExerciseBoardInputPanel`; the shell itself stands, now with `caption`/`chip`/`tiles`); D275 in part (the panels' target/darts/remaining-time `StatRow`s and `ExerciseBoardInputPanel`, and "`playPreviewSegments` renders exactly three slots" — the labelled exercise strip has one column per segment; the `SinglePlayerDisplay`/`VisitPreview` shape and the countdown `SegmentTimer` stand).
Referenced by D0457's `Supersedes:` line.
