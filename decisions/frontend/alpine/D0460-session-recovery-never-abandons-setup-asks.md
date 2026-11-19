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
<!-- backfill: pending -->

# Session recovery never abandons; setup asks before ending a session held elsewhere

## Context and Problem Statement
opening a game's setup on a second device, or after the single-slot `game` store was reused for another game, silently abandoned an in-progress game and lost its turns (#897). Only the player ends a session — the rule D285 already applied to routine blocking games.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`reconcileActiveSession` no longer calls `completeSession`. A server ACTIVE session this device does not hold (local id missing or different) returns `"elsewhere"` with the session and leaves the store untouched; `"abandon_failed"` is removed. Setup shows the active-session modal with `activeSessionLocal` false: "in progress on another device", Start new (abandons it, store untouched) or Back (`leaveSetup()` → `/games`); the picker stays hidden while it is ACTIVE. Play treats `"elsewhere"` as no session. `abandonSession()` resets the store only when the session was local.".

### Consequences
no API or schema change. Setup's `reconciliationFailed`/Retry path is no longer reached (a fetch failure surfaces as `error`). Cross-device resume still needs incremental fact upload (#815).

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
