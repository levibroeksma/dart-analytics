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
<!-- backfill: pending -->

# Guest-adding UI ships for 501 only; the runtime guest list is its own component

## Context and Problem Statement
`rejectSeatRequest` 400s a second seat for every ruleset but `501_V1` (D08/D220-era seat work), so wiring the button into `UserSection` unconditionally would let a player build a request every other engine rejects; the prop keeps the other eight setup screens byte-identical rather than adding a guard the button itself would never need for 501. The `GuestSection` split exists because of an Astro/Alpine boundary, not a stylistic preference: content written directly inside a `{}` Astro JS expression (a `.map()`/ternary body) must escape Alpine directives as `x-on:click` per this repo's linter exception (`07-Frontend/03-Alpine-Patterns.md`), but a genuinely separate child component's own top-level markup — including its own `<template x-for>` — is not inside that `{}` boundary and can use plain `@click`/`:attr` shorthand. Inlining the guest list's `x-for`/`@click`/`:aria-label` markup into `UserSection`'s ternary would have forced every one of those directives into the escaped form for no reason other than where the file happened to end.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`UserSection.astro` gains an `allowGuests?: boolean = false` prop. Every setup screen except `FiveOhOneSetupForm.astro` calls `<UserSection />` with no prop and renders exactly today's single-owner markup; only 501 passes `allowGuests`. The add-guest button caps the guest list at 3 (`AddGuestButton.astro`'s `x-show="guests.length < 3"`) — 3 guests plus the 1 owner equals the server's `MAX_SEATS = 4` (`services/session-seats.service.ts`). The runtime guest list (avatar, name, remove badge) is its own component, `GuestSection.astro`, rather than markup inlined into `UserSection.astro`'s `allowGuests` conditional.".

### Consequences
adding guest support to a second multi-seat engine is a one-line change at that engine's own `*SetupForm.astro` (pass `allowGuests`), not a `UserSection` edit. `GuestSection.astro`, `AddGuestButton.astro` and `GuestNameModal.astro` are listed in `docs/architecture/07-Frontend/08-Component-Inventory.md` under shared setup shells even though only one caller exists today, because `UserSection`'s prop makes them reusable by construction, not per-game components under the inventory's per-game exclusion. Guest data model (`participantTypeKey: "GUEST"`, side keys `B`/`C`/`D` in add order) is UI-side only in this task — no schema or validator change — composed into `POST /api/sessions`'s existing `participants` array from PR #152's seat work.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-21
