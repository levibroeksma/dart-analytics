---
id: D0206
status: accepted
date: 2026-08-11
origin: contemporaneous
original-date:
tags: [frontend/alpine, Alpine, stores, persist]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Throwing-hand preference is a local `$persist` store, not `player_settings`

## Context and Problem Statement
Which side the magnifier opens on is a per-device rendering preference — it does not describe gameplay, need not sync across devices, and has no server read path today. Routing it through `player_settings` would mean a new migration, endpoint contract bump, service/repository change and view column for a value only the client ever consumes, for no behavioural gain over `$persist`.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "The player's throwing hand (`Handedness`, already a `boardInput()` option per D199) is read from a new `boardInput` Alpine store (`stores/board-input.store.ts`, one `$persist` field, `PersistFactory` per D120) rather than added to the server-backed `player_settings`/`v_player_settings` pair. `board-input.data.ts`'s `freshController` now passes `$store.boardInput.handedness` into `boardInput()` instead of relying on its `"RIGHT"` default, and a new `HandednessForm.astro` on the profile page writes the store directly.".

### Consequences
Handedness does not follow a player across devices (matches D77/D86's `forms/`-as-substitute precedent for pre-`player_settings` local prefs). If a future need for cross-device sync emerges, migrating this one field into `player_settings` is a small, isolated change against an established pattern (`settings.store.ts`/`AppModeForm.astro`) — not a reason to default there now.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-11
