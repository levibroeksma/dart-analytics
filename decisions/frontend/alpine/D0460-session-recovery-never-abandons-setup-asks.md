---
id: D0460
status: accepted
date: 2026-10-13
origin: contemporaneous
original-date:
tags: [frontend/alpine, recovery, session recovery]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes: D0088
superseded-by:
---

# Session recovery never abandons; setup asks before ending a session held elsewhere

## Context and Problem Statement
opening a game's setup on a second device, or after the single-slot `game` store was reused for another game, silently abandoned an in-progress game and lost its turns (#897). Only the player ends a session — the rule D285 already applied to routine blocking games.

## Decision Drivers
* Silently abandoning an in-progress game on another device loses its turns (#897).
* Only the player ends a session (D285 for routine blocking games).

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`reconcileActiveSession` no longer calls `completeSession`. A server ACTIVE session this device does not hold (local id missing or different) returns `"elsewhere"` with the session and leaves the store untouched; `"abandon_failed"` is removed. Setup shows the active-session modal with `activeSessionLocal` false: "in progress on another device", Start new (abandons it, store untouched) or Back (`leaveSetup()` → `/games`); the picker stays hidden while it is ACTIVE. Play treats `"elsewhere"` as no session. `abandonSession()` resets the store only when the session was local.".

### Consequences
no API or schema change. Setup's `reconciliationFailed`/Retry path is no longer reached (a fetch failure surfaces as `error`). Cross-device resume still needs incremental fact upload (#815).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The commit changes `session-recovery.test.ts` and `setup-session.test.ts` and adds cases to the play-lifecycle and play data tests.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-10-13

* Commit `beb76755` (PR #964, 2026-10-14; the `decisions/frontend/alpine.md` row): rebuilt Decision Drivers and Confirmation.
