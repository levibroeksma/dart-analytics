---
id: D0225
status: accepted
date: 2026-08-21
origin: contemporaneous
original-date:
tags: [frontend/astro, component]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Guest-adding UI ships for 501 only; the runtime guest list is its own component

## Context and Problem Statement
`rejectSeatRequest` 400s a second seat for every ruleset but `501_V1` (D08/D220-era seat work), so wiring the button into `UserSection` unconditionally would let a player build a request every other engine rejects; the prop keeps the other eight setup screens byte-identical rather than adding a guard the button itself would never need for 501. The `GuestSection` split exists because of an Astro/Alpine boundary, not a stylistic preference: content written directly inside a `{}` Astro JS expression (a `.map()`/ternary body) must escape Alpine directives as `x-on:click` per this repo's linter exception (`07-Frontend/03-Alpine-Patterns.md`), but a genuinely separate child component's own top-level markup — including its own `<template x-for>` — is not inside that `{}` boundary and can use plain `@click`/`:attr` shorthand. Inlining the guest list's `x-for`/`@click`/`:aria-label` markup into `UserSection`'s ternary would have forced every one of those directives into the escaped form for no reason other than where the file happened to end.

## Decision Drivers
* `rejectSeatRequest` rejects a second seat for every ruleset but `501_V1`, and none of the other 8 engines declare `PER_SEAT` stage ownership. An add-guest button on their setup screens would render a control whose submission always 400s.
* Astro directives written directly inside a `{}` JS expression must use `x-on:click`, while a separate child component's top-level markup can use plain `@click`/`:attr`.
* The other 8 setup screens should stay byte-identical.

## Considered Options
* Wire the add-guest button into `UserSection` unconditionally.
* Gate it behind an `allowGuests` prop, with the guest list inlined in `UserSection`'s ternary.
* Gate it behind an `allowGuests` prop, with the guest list in its own `GuestSection.astro` (chosen).

## Decision Outcome
Chosen option: "`UserSection.astro` gains an `allowGuests?: boolean = false` prop. Every setup screen except `FiveOhOneSetupForm.astro` calls `<UserSection />` with no prop and renders exactly today's single-owner markup; only 501 passes `allowGuests`. The add-guest button caps the guest list at 3 (`AddGuestButton.astro`'s `x-show="guests.length < 3"`) — 3 guests plus the 1 owner equals the server's `MAX_SEATS = 4` (`services/session-seats.service.ts`). The runtime guest list (avatar, name, remove badge) is its own component, `GuestSection.astro`, rather than markup inlined into `UserSection.astro`'s `allowGuests` conditional.".

### Consequences
adding guest support to a second multi-seat engine is a one-line change at that engine's own `*SetupForm.astro` (pass `allowGuests`), not a `UserSection` edit. `GuestSection.astro`, `AddGuestButton.astro` and `GuestNameModal.astro` are listed in `docs/architecture/07-Frontend/08-Component-Inventory.md` under shared setup shells even though only one caller exists today, because `UserSection`'s prop makes them reusable by construction, not per-game components under the inventory's per-game exclusion. Guest data model (`participantTypeKey: "GUEST"`, side keys `B`/`C`/`D` in add order) is UI-side only in this task — no schema or validator change — composed into `POST /api/sessions`'s existing `participants` array from PR #152's seat work.

* Good, because adding guest support to a second multi-seat engine is a one-line change at that engine's `*SetupForm.astro` (pass `allowGuests`), not a `UserSection` edit.
* Neutral, because `GuestSection.astro`, `AddGuestButton.astro` and `GuestNameModal.astro` are listed in the Component Inventory under shared setup shells although only one caller exists. The `UserSection` prop makes them reusable by construction.
* Neutral, because the guest data model (`participantTypeKey: "GUEST"`, side keys `B`/`C`/`D` in add order) is UI-side only in this task, with no schema or validator change. It composes into the existing `participants` array of `POST /api/sessions` from PR #152's seat work.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### Unconditional button in `UserSection`
* Bad, because a player could build a request that every engine but 501 rejects.

### `allowGuests` prop with the list inlined
* Bad, because every `x-for`/`@click`/`:aria-label` directive in `UserSection`'s ternary would need the escaped `x-on:` form for no reason beyond where the file ended.

### `allowGuests` prop with a separate `GuestSection.astro`
* Good, because the other 8 setup screens render exactly today's single-owner markup.
* Good, because the child component's own markup, including its `<template x-for>`, can use the `@click` shorthand.
* Good, because the guest cap of 3 plus the owner equals the server's `MAX_SEATS = 4`.

## Evidence / More Information
Decided: 2026-08-21

* `docs/superpowers/specs/2026-08-21-guest-player-501-setup-ui-design.md` (Why only 501, Components): rebuilt Decision Drivers, Considered Options and Pros and Cons.
* `docs/superpowers/plans/2026-08-21-guest-player-501-setup-ui.md` (Architecture note on the `x-on:click` exception, Task 4): rebuilt Pros and Cons.
* Commit `bf77b6cd` (2026-08-21; adds the D225 row and the Component Inventory update): rebuilt Consequences.
* Applied in: `docs/superpowers/plans/2026-09-01-dartbot-5-participant-write-path.md` (deferred list names guest-adding UI for the other 8 setup screens).
