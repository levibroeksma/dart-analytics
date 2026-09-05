# Double-Out Checkout Accuracy — Architecture Design

> **Date:** 2026-09-05
> **Status:** approved (brainstorming consensus)
> **Branch:** `claude/x01-doubles-accuracy-ljbk6c`
> **Scope:** Replace the broken leg/round-level "checkout" stats in 501, TUOD, and 121 with a genuine dart-level double-attempt accuracy, derived from board hits — no engine, schema, or capture-time change.
> **Out of scope:** QUICK_SCORE capture (no dart facts exist there — stays unavailable, same as today); Bob's 27 / Doubles Training (already have genuine dart-level intent via `doubleTargetIntent`, unaffected); any change to checkout-hint UI, bust rules, or the `checkout-bust.module.ts` bust/checkout logic itself.

---

## Context — the bug

`five-oh-one-play.data.ts` (`statsFor`, lines 191-194):

```ts
checkoutPercentage:
  inputModeKey === "VISUAL_BOARD"
    ? accuracyDisplay(legsWon, legsWon + checkoutAttemptCount(seatTurns))
    : null,
```

`legsWon / (legsWon + checkoutAttemptCount)` is a **leg**-level ratio (legs finished vs. legs where a finishing visit busted). One won leg with zero busted checkout visits reads as 100%, regardless of how many individual darts missed the double along the way — it can only move in whole-leg increments. `tuod-play.data.ts`'s `attempts`/`successes`/`failures` (`statsFor`, lines 160-167) is the identical bug one level up: per-round, not per-dart. 121 has no checkout-shaped stat at all today (`OneTwentyOneResults.astro` shows only `Visits`/`Average`).

None of the three currently report anything about individual darts thrown at a double.

## Why a naive per-dart heuristic is dangerous (precedent)

`04-Runtime-Layer.md` (`darts` table): Singles Training deliberately stores **no** dart intent (D06) — "naming a minimum ring would fabricate an intent the player never held and corrupt the intended-vs-hit accuracy analysis." X01's split/lay-up darts are the same trap: a player who is one dart from a finish routinely chooses a scoring dart over a wild swing at the double, and counting that as a "miss" would corrupt the stat in exactly the way D06 warns against. Whatever derivation ships here must be provably correct from board geometry, not a guess.

## The classification rule

Per dart, using only facts already stored (`hitTargetNumber`, `hitZoneKey`, `score`) plus one arithmetic derivation (remaining score before the dart):

1. **Eligibility** — a dart is checkout-attempt-eligible iff the remaining score *before it* could be finished by that single dart alone: even and `2 ≤ remaining ≤ 40`, or exactly `50` (bull). No route/chart lookup — this sidesteps `checkout-path.module.ts`'s single-canonical-route table, which e.g. never lists the direct-bull option for 50 even though it's a live choice. Every dart that actually finishes a leg satisfies this test by construction, so it is the exact right set of "this could have been the last dart" states.
2. **Not eligible** (remaining odd, or >40 and ≠50) → never counted, whatever it hits. Unambiguous setup/scoring dart.
3. **Eligible, hits the required double or inner bull, and scores exactly `remaining`** → **hit** (already known — this is what `resolveCheckoutAttempt` calls a checkout).
4. **Eligible, hits `DOUBLE`/`INNER_BULL`/`OUTER_BULL` but doesn't check out** (wrong number, or outer bull instead of inner bull at 50) → **miss**. They went for a finish and hit the ring, just not the needed one.
5. **Eligible, hits `SINGLE`/`TREBLE`, and the hit segment is the same as or board-adjacent (immediate neighbour, per the segment order already in `board-geometry.module.ts`) to the segment the required double sits on** → **miss** (a plausible errant shot at that double — e.g. single 18 while needing D18, or single 7 while needing D16, since 7 and 16 are neighbouring segments).
6. **Eligible, hits `SINGLE`/`TREBLE` elsewhere, or a coordinate-less bounce-out** → **not an attempt**, excluded from both hit and attempt counts (a deliberate lay-up/reroute, or genuinely unprovable).

Verified against the three worked examples from the brainstorm (50 left/large single 18 → excluded; 50 left/near-bull or outer bull → miss; 36→18 near-double → miss; 18 left/single 2 → excluded, reroute to D16; 32 left/single 7 → miss, matches neighbour-segment 16). `doubleAccuracy = hits / (hits + misses)`, formatted with the existing `accuracyDisplay` (Pattern 20) — not-an-attempt darts never enter either side of the ratio.

Only meaningful for `ANALYTICS` + `VISUAL_BOARD` sessions — `QUICK_SCORE` has no dart rows, so the field stays `null` there, same gating `checkoutAttemptCount` already uses.

---

## Where the logic lives

`05-Views.md` forbids "game engine logic" in views. `v_dart_locations`' own doc hit this exact tension for `missMargin` — computing miss geometry twice (SQL and `board-geometry.module.ts`) would drift from the one classifier that owns it, so it's computed in the app layer off the view's raw columns instead. Same split here:

- **View — `v_double_out_darts`** (Analytics category, scoped to the owning participant like `v_dart_analytics`/`v_dart_locations`). Sources: `darts → turns → exercise_stages → exercise_sessions → participants, game_types`, filtered to `game_type_key IN ('501', 'ONE_TWENTY_ONE', 'TUOD')` and `input_mode_key = 'VISUAL_BOARD'`. Exposes only facts + arithmetic: `session_id`, `player_id`, `game_type_key`, `stage_id`, turn sequence, dart sequence, `hit_target_number`, `hit_zone_key`, `score`, and a derived `remaining_before_dart` (window-function subtraction of that seat's prior dart scores within the stage from the stage's starting score — plain arithmetic, the same class of derivation as `v_session_overview`'s `duration_seconds`). No attempt/hit/miss judgment happens in SQL. New migration, one responsibility (Pattern 10).
- **App module — `modules/game/double-attempt.module.ts`** (sibling to `checkout-bust.module.ts`). One pure function, generic over turn/dart facts and a starting score (not 501-specific), implementing steps 1-6 above and reusing the segment order already in `board-geometry.module.ts` rather than a second copy. Same function serves the live in-session result (over `TurnFact[]`, matching the shape `checkoutAttemptCount` already consumes) and, later, any persisted/history read over `v_double_out_darts` rows — one classifier, two callers, never duplicated.

## Per-game wiring

| Game | File | Change |
| --- | --- | --- |
| 501 | `five-oh-one-play.data.ts` `statsFor` | Drop `checkoutAttemptCount` import/call and the `checkoutPercentage` field; add `doubleAccuracy` via the new module. `FiveOhOneResults.astro`: label `"Checkout %"` → `"Double Accuracy"`, key `checkoutPercentage` → `doubleAccuracy`. |
| TUOD | `tuod-play.data.ts` `statsFor` | Drop `attempts`/`successes`/`failures` from `TuodSeatResult`; add `doubleAccuracy`. `TenUpOneDownResults.astro`: replace those 3 `STAT_ROWS` entries with one `doubleAccuracy` row. |
| 121 | `one-twenty-one-play.data.ts` `statsFor` | Add `doubleAccuracy` to `OneTwentyOneSeatResult` (new field, nothing replaced). `OneTwentyOneResults.astro`: add a `doubleAccuracy` row alongside `Visits`/`Average`. |

`types.ts`: `FiveOhOneSeatResult`, `TuodSeatResult`, `OneTwentyOneSeatResult` each gain/lose the fields above.

121's final-visit unreachable-remainder rule and TUOD's odd-remainder-with-one-dart-left rule (both in `checkout-bust.module.ts`'s per-ruleset escalation) are orthogonal to this classification — they decide *busts*, not whether a dart's remaining-before was itself finishable by one dart, so no special-casing is needed per game.

---

## Docs & decisions

- `docs/architecture/05-Database/06-Spec/05-Read-Model-Layer.md` and `05-Views.md` — register `v_double_out_darts` (category, sources, exposes, design rationale citing the `missMargin` precedent for keeping classification out of SQL).
- `docs/architecture/04-Architecture-patterns.md` — note under Pattern 9 (Derived Analytics) or a cross-reference near Pattern 18's `checkout-bust.module.ts` paragraph: double-attempt classification is a shared derivation across 501/121/TUOD, living once in `double-attempt.module.ts`.
- Append-only entry in `decisions/game-engine.md` (routed via `DECISIONS.md`) recording: the leg/round-level "checkout" stats were replaced because they measured the wrong unit (legs/rounds, not darts), and why the classification stays a heuristic bounded by board adjacency rather than stored intent (citing D06 precedent).
- `context-maintenance` skill once, after implementation.

---

## Testing

Per `app/CLAUDE.md`: TDD, full suite every run, `npm run validate:app` before done, `npm run format`/`format:check` clean.

- `double-attempt.module.ts` — new unit tests covering all 6 classification steps, including the three worked examples verbatim (50/large-single-18, 50/near-bull, 50/outer-bull, 36→18-inner, 18→single-2, 32→single-7) plus boundary cases (remaining=2, remaining=40, remaining=50, odd remaining, bounce-out miss).
- `v_double_out_darts` — migration test asserting shape and the owning-participant scope, mirroring `v_dart_analytics`'/`v_dart_locations`' existing migration tests.
- Each touched `*-play.data.ts` — updated/new tests for the new `statsFor` field per `scripts/check-test-coverage.sh`; `FiveOhOneResults.astro`/`TenUpOneDownResults.astro`/`OneTwentyOneResults.astro` are `.astro` markup, exempt from unit tests (D101), verified visually via the `run` skill instead.

---

## Rollout order

1. `double-attempt.module.ts` + its unit tests (no consumers yet — provable correct in isolation first).
2. `v_double_out_darts` migration + test.
3. Wire 501 (`statsFor` + `FiveOhOneResults.astro`) — proves the module against the existing, already-battle-tested game first.
4. Wire TUOD, then 121, same pattern.
5. Docs/decisions update, `context-maintenance` skill, full `validate:app` pass.

One plan, task-grouped per step above, on the current branch.
