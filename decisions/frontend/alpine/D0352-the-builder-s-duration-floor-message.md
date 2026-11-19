---
id: D0352
status: accepted
date: 2026-09-22
origin: contemporaneous
original-date:
tags: [frontend/alpine]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# The builder's duration-floor message shows only after a save attempt; the Save button no longer disables on it

## Context and Problem Statement
D305's 30–60 minute floor pre-check ran live through `durationIssues()` on every render, so a brand-new or still-growing draft (0 steps, 0 minutes) showed "a routine must hold at least one step" and "routine is 0 minutes; the minimum is 30" before the player had done anything wrong — the floor is a save-time rule, not a typing-time one. Simply hiding the list behind a flag was not enough on its own: the Save button was already disabled by the same `canSave()` the message reported, so a player under the floor had no click that could ever flip the flag.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`routineBuilder()` gains `attemptedSave` (false until `save()` first runs; `resetForm()` clears it back to false). `RoutineBuilder.astro`'s issue list (`durationIssues()`/`serverIssues`) is now shown behind `attemptedSave &&`. A new `saveDisabled()` replaces `!canSave()` as the Save button's `:disabled` expression — it disables only for `saving`/`loading`, a missing `routineId` in edit mode, or an empty name, leaving the button clickable while a duration or GAME-step violation exists, so the click itself is what sets `attemptedSave` and surfaces the message. `canSave()` is unchanged and still gates whether `save()` actually calls the API.".

### Consequences
once a player has attempted one save, the list keeps updating live as they keep editing (matching the existing GAME-step and server-issue behaviour) — only the first display is gated, not every subsequent one. The name-empty case is untouched: `saveDisabled()` still requires `nameValid()`, so that path shows no message either, same as before this change. `.astro` markup carries no test of its own (D101); coverage is `routine-builder.data.test.ts`'s new cases on `attemptedSave` and `saveDisabled()`'s existence, not a rendered assertion of the list's visibility.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-22
