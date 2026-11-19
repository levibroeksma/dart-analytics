---
id: D0251
status: accepted
date: 2026-08-31
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

# Checkout-hint visibility is one shared client-only `$persist` toggle, not a `player_settings` field or per-game config

## Context and Problem Statement
which side shows a checkout suggestion is a per-device display preference, not gameplay data to persist server-side — the same reasoning D206 already established for `boardInputStore`'s handedness field. A `player_settings` round-trip (migration, endpoint, service/repository, view column) buys no behavioural gain over `$persist` for a value only the client ever reads. One shared toggle rather than three per-game ones matches how the feature request (issue #203) was scoped, and avoids three near-identical settings rows for the same underlying concern. The field is optional rather than required on `PlayStoreContext` because roughly 90 existing test call sites across the three affected `*-play.data.test.ts` files (and, for TUOD, every inline `$store` object literal with no `as TuodPlayContext` cast) would otherwise need editing solely to add a field their own tests never exercise.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Whether 501, 121, and Ten Up One Down show a suggested checkout route is controlled by a single boolean, `checkoutHints.enabled`, held in a new `checkoutHints` Alpine store (`stores/checkout-hints.store.ts`, one `$persist` field, `PersistFactory` per D120), defaulting to `true`. All three games' setup screens share the same `Switch.astro` control (`x-model="$store.checkoutHints.enabled"`); there is no per-game-type override. `FiveOhOnePlayContext["$store"]`, `OneTwentyOnePlayContext["$store"]`, and `TuodPlayContext["$store"]` widen to add an optional `checkoutHints?: { enabled: boolean }` field rather than making it required on the shared `PlayStoreContext<TConfig>` generic all 9 games use, so the other 6 rulesets' `$store` types and tests are untouched. Each game's `checkoutHint()`/`checkoutHintFor(seatRef)` getter gates on `this.$store.checkoutHints?.enabled === false` returning `""`; TUOD had no such getter before this decision and gains one (`checkoutPathFor` keyed off `currentTarget` instead of `remainingScore`).".

### Consequences
a player who wants hints off during 501 but on during TUOD cannot — the design's explicit rejected alternative — and gets one shared toggle instead. The preference is per-device, not per-account: it does not follow a player across devices, matching D206's precedent. `docs/superpowers/specs/2026-08-31-checkout-hints-toggle-design.md` documents the two other rejected storage locations (session-config override, `player_settings`) and their costs in full. `FINDINGS.md`'s F46, raised during this task, is unrelated (a stale style-guide/component-inventory reference to nonexistent `Checkbox.astro`/`Radio.astro` components) and not acted on here.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-31
