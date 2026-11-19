---
id: D0200
status: accepted
date: 2026-08-09
origin: contemporaneous
original-date:
tags: [frontend/architecture]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# A live session's mode pair is read from the session, never from settings

## Context and Problem Statement
App mode is changeable from the settings screen at any time, including mid-match, and `AppModeForm` has no active-session guard. Gating the board on the settings store therefore renders the board over a RECREATIONAL + QUICK_SCORE session; the darts it captures are refused by `validateQuickScoreTurns` for the entire batch at completion, and a batch is all-or-nothing, so the whole session is lost. The settings store answers "how does this player like to score", which is not the same question as "how is this session being scored".

## Decision Drivers
* App mode changes from the settings screen at any time, mid-match included, and `AppModeForm` has no active-session guard.
* A batch is all-or-nothing, so one refused turn loses the whole session at completion.
* The settings store answers how the player likes to score, not how the session is being scored.
* The same defect had appeared 4 times on one branch.

## Considered Options
* Fix each appearance of the defect where it is found, as on this branch 3 times before.
* Persist the session's mode pair on `game.store.ts` and make it the single authority at play time (chosen).

## Decision Outcome
Chosen option: "The active session's `captureModeKey`/`inputModeKey` are persisted on `game.store.ts` — written from the resolved pair when a session is created and adopted from the server's `activeSession` on every reconcile — and every play-time consumer reads them from there: which shape the engine is built for, and whether the board renders. `$store.settings` is the authority for exactly one thing: the pair a NEW session is created with, via `resolveSessionModePair`.".

### Consequences
This was the fourth appearance of the same defect on one branch — setup pages hardcoding the pair, `playAgain()` rebuilding an engine with the factory default in 501 and again in Score Training, and this. Each was fixed where it was found; the recurrence is what made a single authority necessary rather than a fourth local fix. Reads tolerate `null` (a store predating this field, or a session whose mode has not been fetched yet) by resolving to `QUICK_SCORE`, the engine's own default, and reconcile overwrites it from the server on the next init.

* Good, because one authority replaces a fourth local fix for the same defect.
* Neutral, because reads tolerate `null` by resolving to `QUICK_SCORE`, the engine's own default, and reconcile overwrites the field from the server on the next init.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### Fix each appearance locally
* Bad, because the defect recurred 4 times on one branch: setup pages hardcoding the pair, `playAgain()` in 501 and in Score Training, and the board gate.

### One authority on the session
* Good, because the play-time consumers all read the pair from the session, so a mid-match settings change does not decide how the session is scored.
* Good, because `$store.settings` keeps exactly one job: the pair a new session is created with, via `resolveSessionModePair`.

## Evidence / More Information
Decided: 2026-08-09

* Commit `db390e7e` (2026-08-09; adds the D200 row): rebuilt Decision Drivers, Considered Options, Consequences and Pros and Cons.
