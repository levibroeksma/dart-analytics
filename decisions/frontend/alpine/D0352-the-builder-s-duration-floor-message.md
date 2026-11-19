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

# The builder's duration-floor message shows only after a save attempt; the Save button no longer disables on it

## Context and Problem Statement
D305's 30–60 minute floor pre-check ran live through `durationIssues()` on every render, so a brand-new or still-growing draft (0 steps, 0 minutes) showed "a routine must hold at least one step" and "routine is 0 minutes; the minimum is 30" before the player had done anything wrong — the floor is a save-time rule, not a typing-time one. Simply hiding the list behind a flag was not enough on its own: the Save button was already disabled by the same `canSave()` the message reported, so a player under the floor had no click that could ever flip the flag.

## Decision Drivers
* The 30–60 minute floor (D305) is a save-time rule, not a typing-time one, so a fresh or still-growing draft must not show it.
* The Save button was disabled by the same `canSave()` the message reported, so a player under the floor had no click that could flip a flag.

## Considered Options
* Gate the issue list behind `attemptedSave` and let the click set it, with a new `saveDisabled()` for the Save button (chosen).
* Hide the list behind a flag but keep disabling Save on `canSave()`, which the Context says is not enough on its own.
* Show the list live through `durationIssues()` on every render (the behaviour before this record).

## Decision Outcome
Chosen option: "`routineBuilder()` gains `attemptedSave` (false until `save()` first runs; `resetForm()` clears it back to false). `RoutineBuilder.astro`'s issue list (`durationIssues()`/`serverIssues`) is now shown behind `attemptedSave &&`. A new `saveDisabled()` replaces `!canSave()` as the Save button's `:disabled` expression — it disables only for `saving`/`loading`, a missing `routineId` in edit mode, or an empty name, leaving the button clickable while a duration or GAME-step violation exists, so the click itself is what sets `attemptedSave` and surfaces the message. `canSave()` is unchanged and still gates whether `save()` actually calls the API.".

### Consequences
once a player has attempted one save, the list keeps updating live as they keep editing (matching the existing GAME-step and server-issue behaviour) — only the first display is gated, not every subsequent one. The name-empty case is untouched: `saveDisabled()` still requires `nameValid()`, so that path shows no message either, same as before this change. `.astro` markup carries no test of its own (D101); coverage is `routine-builder.data.test.ts`'s new cases on `attemptedSave` and `saveDisabled()`'s existence, not a rendered assertion of the list's visibility.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Commit `6ee14828` adds 3 cases to `app/tests/lib/training/routines/routine-builder.data.test.ts`: "does not flag a save attempt until save() is called", "flags a save attempt even when canSave() blocks the actual save" and "resetForm clears a prior save attempt".

## Pros and Cons of the Options
### `attemptedSave` gate and `saveDisabled()`
* Good, because the floor message appears only after the player tries to save.
* Good, because the Save button stays clickable under a duration or GAME-step violation, so the click itself surfaces the message. `canSave()` still gates the API call.

### Flag only, Save still disabled by `canSave()`
* Bad, because the click that sets the flag can never happen for a player under the floor.

### Live `durationIssues()`
* Bad, because a brand-new draft (0 steps, 0 minutes) shows "a routine must hold at least one step" and "routine is 0 minutes; the minimum is 30" before the player has done anything wrong.

## Evidence / More Information
Decided: 2026-09-22

* Commit `6ee14828` (2026-09-22, adds the D352 row): rebuilt Decision Drivers, Considered Options, Confirmation and Pros and Cons from the commit message and the row's Reason.
* No spec or plan in `docs/superpowers/` cites D352.
