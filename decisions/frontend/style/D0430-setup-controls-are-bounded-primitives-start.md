---
id: D0430
status: accepted
date: 2026-10-08
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

# Setup controls are bounded primitives; start is a slide

## Context and Problem Statement
bounded controls make out-of-range input unreachable, so clamp notices drop from markup while the domain clamps stay as the `start()` guard; a slide guards against accidental starts.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "game setup screens follow Claude Design `Game Setup.dc.html`. Numeric settings use `Stepper` (501 legs) or `RangeSlider` (rounds/minutes) instead of free text inputs; slider bounds come from each game's `*DurationBounds` helper, never the mock's 5–30. Start is `SlideToStart`: release past 85% or press Enter/Space submits; a tap does nothing; a fired slide resets when loading ends or after 600ms if loading never began. `Toggle` options may be `disabled` (501 Best of / Sets render locked until supported). `InfoSection` clamps to two lines and gains `open` for setups without settings. No new icons: `chevron-down`, `plus`, `play-rounded`, `target` via `currentColor`.", because bounded controls make out-of-range input unreachable, so clamp notices drop from markup while the domain clamps stay as the `start()` guard; a slide guards against accidental starts.

### Consequences
the `Input` clamp notices for legs and duration are gone from markup. `Toggle` restyle also reaches `/statistics` and trivia. `.astro` carries no unit test (D101); pure helpers in `lib/ui/{stepper,range-slider,slide-to-start,initials}` are tested. Deferred (GitHub issues): 501 Best of, 501 Sets, DartBot level slider onto `RangeSlider`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-08
Referenced by D0435's `Supersedes:` line.
