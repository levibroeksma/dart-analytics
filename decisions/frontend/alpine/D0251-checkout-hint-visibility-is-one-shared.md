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

# Checkout-hint visibility is one shared client-only `$persist` toggle, not a `player_settings` field or per-game config

## Context and Problem Statement
which side shows a checkout suggestion is a per-device display preference, not gameplay data to persist server-side — the same reasoning D206 already established for `boardInputStore`'s handedness field. A `player_settings` round-trip (migration, endpoint, service/repository, view column) buys no behavioural gain over `$persist` for a value only the client ever reads. One shared toggle rather than three per-game ones matches how the feature request (issue #203) was scoped, and avoids three near-identical settings rows for the same underlying concern. The field is optional rather than required on `PlayStoreContext` because roughly 90 existing test call sites across the three affected `*-play.data.test.ts` files (and, for TUOD, every inline `$store` object literal with no `as TuodPlayContext` cast) would otherwise need editing solely to add a field their own tests never exercise.

## Decision Drivers
* The preference is per-device display, not gameplay data.
* The feature request (issue #203) frames one personal preference, not a per-ruleset rule.
* 501 and 121 show the hint today, so a default of `true` preserves current behavior.

## Considered Options
* One shared `$persist` boolean in a new Alpine store (chosen).
* A `player_settings` field, rejected in the spec as too heavy.
* A per-game-type toggle, listed as out of scope.
* A session-config override, which the spec says stays out of `config_snapshot`.

## Decision Outcome
Chosen option: "Whether 501, 121, and Ten Up One Down show a suggested checkout route is controlled by a single boolean, `checkoutHints.enabled`, held in a new `checkoutHints` Alpine store (`stores/checkout-hints.store.ts`, one `$persist` field, `PersistFactory` per D120), defaulting to `true`. All three games' setup screens share the same `Switch.astro` control (`x-model="$store.checkoutHints.enabled"`); there is no per-game-type override. `FiveOhOnePlayContext["$store"]`, `OneTwentyOnePlayContext["$store"]`, and `TuodPlayContext["$store"]` widen to add an optional `checkoutHints?: { enabled: boolean }` field rather than making it required on the shared `PlayStoreContext<TConfig>` generic all 9 games use, so the other 6 rulesets' `$store` types and tests are untouched. Each game's `checkoutHint()`/`checkoutHintFor(seatRef)` getter gates on `this.$store.checkoutHints?.enabled === false` returning `""`; TUOD had no such getter before this decision and gains one (`checkoutPathFor` keyed off `currentTarget` instead of `remainingScore`).".

### Consequences
a player who wants hints off during 501 but on during TUOD cannot — the design's explicit rejected alternative — and gets one shared toggle instead. The preference is per-device, not per-account: it does not follow a player across devices, matching D206's precedent. `docs/superpowers/specs/2026-08-31-checkout-hints-toggle-design.md` documents the two other rejected storage locations (session-config override, `player_settings`) and their costs in full. `FINDINGS.md`'s F46, raised during this task, is unrelated (a stale style-guide/component-inventory reference to nonexistent `Checkbox.astro`/`Radio.astro` components) and not acted on here.

* Bad, because a player cannot have hints off in 501 and on in TUOD.
* Neutral, because the preference is per-device and does not follow a player across devices.
* Neutral, because TUOD gains a hint getter it lacked before this record.

### Confidence
Rationale unknown — no source found.

### Revisit When
A need to sync the preference across devices or to set it per game type. The spec lists both as out of scope; it names no trigger.

### Confirmation
The spec requires tests for the store and for the on and off branches of each game's hint getter. It notes no test runner exists for `.astro` markup (D101).

## Pros and Cons of the Options
### One shared `$persist` toggle
* Good, because it needs no migration, Zod config-schema change or API change.
* Good, because defaulting to `true` preserves existing 501 and 121 behavior.
* Bad, because it offers no per-game override.

### `player_settings` field
* Bad, because the spec rejects it as too heavy for the issue.

### Per-game-type toggles
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-08-31

* `docs/superpowers/specs/2026-08-31-checkout-hints-toggle-design.md` (Problem, Decision, Gating the hint, TUOD, Testing, Out of scope): rebuilt Drivers, Considered Options, Consequences, Revisit When, Confirmation and Pros and Cons.
* `docs/superpowers/plans/2026-08-31-checkout-hints-toggle.md` (Step 1, `CheckoutHintsStoreContext`): confirmed the optional-field detail already in Context.
* Commit `52115010` (PR #213, 2026-08-31): adds the D251 block.
* Builds on D206 (same per-device preference rationale).
