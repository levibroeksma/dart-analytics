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

# Throwing-hand preference is a local `$persist` store, not `player_settings`

## Context and Problem Statement
Which side the magnifier opens on is a per-device rendering preference — it does not describe gameplay, need not sync across devices, and has no server read path today. Routing it through `player_settings` would mean a new migration, endpoint contract bump, service/repository change and view column for a value only the client ever consumes, for no behavioural gain over `$persist`.

## Decision Drivers
* The value is a per-device rendering preference, not gameplay data.
* No server read path exists for it today.
* A `player_settings` route needs a migration, an endpoint contract bump, a service and repository change and a view column.

## Considered Options
* A new local `boardInput` Alpine store with one `$persist` field (chosen).
* A field on the server-backed `player_settings` and `v_player_settings` pair.

## Decision Outcome
Chosen option: "The player's throwing hand (`Handedness`, already a `boardInput()` option per D199) is read from a new `boardInput` Alpine store (`stores/board-input.store.ts`, one `$persist` field, `PersistFactory` per D120) rather than added to the server-backed `player_settings`/`v_player_settings` pair. `board-input.data.ts`'s `freshController` now passes `$store.boardInput.handedness` into `boardInput()` instead of relying on its `"RIGHT"` default, and a new `HandednessForm.astro` on the profile page writes the store directly.".

### Consequences
Handedness does not follow a player across devices (matches D77/D86's `forms/`-as-substitute precedent for pre-`player_settings` local prefs). If a future need for cross-device sync emerges, migrating this one field into `player_settings` is a small, isolated change against an established pattern (`settings.store.ts`/`AppModeForm.astro`) — not a reason to default there now.

* Bad, because handedness does not follow a player across devices.

### Confidence
Rationale unknown — no source found.

### Revisit When
A future need for cross-device sync of handedness. The record names this as the trigger for moving the field into `player_settings`.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### Local `$persist` store
* Good, because it avoids a migration, endpoint, service change and view column for a value only the client reads.

### `player_settings` field
* Bad, because it adds a migration, endpoint contract bump, service and repository change and a view column, for no behavioural gain over `$persist`.

## Evidence / More Information
Decided: 2026-08-11

* Commit `084f388e` (2026-08-11; closes #78, adds the D206 block in `decisions/frontend/alpine.md`): rebuilt Drivers, Considered Options, Consequences, Revisit When and Pros and Cons.
* Applied in: `docs/superpowers/specs/2026-08-31-checkout-hints-toggle-design.md` (reuses the same rationale).
