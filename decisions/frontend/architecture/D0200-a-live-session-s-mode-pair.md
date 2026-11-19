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
<!-- backfill: pending -->

# A live session's mode pair is read from the session, never from settings

## Context and Problem Statement
App mode is changeable from the settings screen at any time, including mid-match, and `AppModeForm` has no active-session guard. Gating the board on the settings store therefore renders the board over a RECREATIONAL + QUICK_SCORE session; the darts it captures are refused by `validateQuickScoreTurns` for the entire batch at completion, and a batch is all-or-nothing, so the whole session is lost. The settings store answers "how does this player like to score", which is not the same question as "how is this session being scored".

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "The active session's `captureModeKey`/`inputModeKey` are persisted on `game.store.ts` — written from the resolved pair when a session is created and adopted from the server's `activeSession` on every reconcile — and every play-time consumer reads them from there: which shape the engine is built for, and whether the board renders. `$store.settings` is the authority for exactly one thing: the pair a NEW session is created with, via `resolveSessionModePair`.".

### Consequences
This was the fourth appearance of the same defect on one branch — setup pages hardcoding the pair, `playAgain()` rebuilding an engine with the factory default in 501 and again in Score Training, and this. Each was fixed where it was found; the recurrence is what made a single authority necessary rather than a fourth local fix. Reads tolerate `null` (a store predating this field, or a session whose mode has not been fetched yet) by resolving to `QUICK_SCORE`, the engine's own default, and reconcile overwrites it from the server on the next init.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-09
