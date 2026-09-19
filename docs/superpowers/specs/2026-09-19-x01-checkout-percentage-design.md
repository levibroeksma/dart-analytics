# X01 Checkout Percentage — Architecture Design

> **Date:** 2026-09-19
> **Status:** approved (brainstorming consensus)
> **Branch:** `fix/x01-checkout-percentage`
> **Scope:** Redefine and correct the double/checkout statistic for the three X01 ladders (501, TUOD, 121) under `VISUAL_BOARD` capture — the per-dart classification rule, the remaining-score derivation that feeds it, the shared visit builder, the career read, and the labels.
> **Out of scope:** `QUICK_SCORE` capture (no dart rows — stays `null`); Bob's 27 and Doubles Training (they store real intended-dart data and measure hit rate on a named target, not a finish); checkout-hint UI; the bust/checkout rules in `checkout-bust.module.ts` themselves.
> **Supersedes:** `2026-09-05-double-out-checkout-accuracy-design.md` (the classification rule and the view it introduced).

---

## Context — what is wrong today

Three defects, two of them user-visible as "the percentages are off":

1. **The career read derives remaining-before-dart incorrectly.** `v_double_out_checkout_darts` (migrations `0024`, widened in `0036`) computes `prior_scored_in_stage` as `SUM(d.score)` over raw dart rows. A busted visit stores `turns.total_score = 0` while keeping its darts' real board scores — that divergence is deliberate (it is what makes bust rate computable, `five-oh-one.engine.module.ts`). So one bust anywhere in a leg shifts the derived remaining for every later dart in that leg, and darts are then classified against scores the player was never on. The live modal paths fold counted visit totals and are right, so the career number and the per-game numbers disagree by construction.
2. **The classification rule excludes darts that were genuine attempts.** A dart that bounces out or sails off the board carries `hitZoneKey = "MISS"` and falls through to "not an attempt", so a blown attempt at D20 never enters the denominator. A dart that busts the visit (a wild T20 from 32) is likewise treated as a setup dart. Both omissions inflate the percentage.
3. **The career stat covers 501 only.** TUOD and 121 are absent because their remaining depends on a ladder fold that `05-Views.md` forbids in SQL, so the career number is narrower than the sum of what the modals show.

`highestCheckout` reads the same visits as (1) and is wrong after a bust for the same reason.

---

## The statistic

One number, named **Checkout %**, per dart, aggregated over the whole session (all legs/rounds, not per leg):

```
checkoutPercentage = hits / (hits + misses)
```

Worked example (the definition's acceptance test). A game of 101:

| Visit | Dart | Remaining before | Hit | Verdict |
| --- | --- | --- | --- | --- |
| 1 | 1 | 101 | T20 (60) | excluded — 101 is not one-dart finishable |
| 1 | 2 | 41 | S9 | excluded — 41 is odd |
| 1 | 3 | 32 | S16 | **miss** — 16 is the required double's own segment |
| 2 | 1 | 16 | outside D8 | **miss** |
| 2 | 2 | 16 | outside D8 | **miss** |
| 2 | 3 | 16 | D8 | **hit** |

`1 / (1 + 3) = 25%`.

---

## Section 1 — The classifier

`modules/game/double-attempt.module.ts` keeps its place as the single classifier every caller shares. Its rule, per dart, evaluated in this order:

```
eligible = remaining is one-dart finishable (even, 2..40) or exactly 50

  not eligible                                        -> EXCLUDED
  scores exactly remaining on DOUBLE / INNER_BULL     -> HIT
  any other DOUBLE / OUTER_BULL / INNER_BULL hit      -> MISS
  no sector at all (off board, bounce-out, score 0)   -> MISS
  busts the visit (resolveCheckoutAttempt: remainder
      < 0, == 1, or == 0 off a double)                -> MISS
  remaining == 50, INNER_SINGLE (any number)          -> MISS
  remaining == 50, OUTER_SINGLE / TREBLE              -> EXCLUDED
  single/treble on the required double's own segment
      or an immediate neighbour segment               -> MISS
  single/treble anywhere else, legal remainder left   -> EXCLUDED
```

Three properties of this ordering carry the design:

- **Bust is checked before the reroute rules.** A dart that busts can never be a deliberate lay-up, so a T20 thrown from 32 is a blown attempt, while an S2 thrown from 18 (leaving a legal 16, setting up D8) stays a reroute and is excluded.
- **Bust is read from `resolveCheckoutAttempt`** in `checkout-bust.module.ts`, never restated. 121's unreachable-remainder rule and TUOD's odd-remainder-with-one-dart-left rule stay out of the classifier: they decide when a *visit* ends, not whether a dart was thrown at a double.
- **At 50, the inner single band is an attempt.** No one aims at the band between the outer bull and the treble ring, so a dart landing in inner S18, S10 or S12 from 50 is a missed bull. The outer single band and the trebles are ordinary setup shots (outer S18 from 50 to leave 32) and stay excluded.

This is `VISUAL_BOARD`-only, where every dart resolves to `INNER_SINGLE` or `OUTER_SINGLE` from its coordinate (`board-geometry.module.ts`), so the band is always known. The unbanded `SINGLE` key that keypad capture writes cannot prove its band and stays excluded; it never reaches this classifier in the first place.

### The ten reference darts

These are the agreed verdicts and become the module's test cases verbatim. All 501, double-out.

| # | Remaining before | Hit | Verdict |
| --- | --- | --- | --- |
| 1 | 40 | D20 (finishes) | hit |
| 2 | 40 | S20, same bed under the double wire | miss |
| 3 | 40 | S5, a segment bordering 20 | miss |
| 4 | 40 | off the board entirely | miss |
| 5 | 40 | T20 (60), busts | miss |
| 6 | 50 | outer bull (25) | miss |
| 7 | 50 | outer S18, leaves 32 | excluded |
| 7b | 50 | inner S18 | miss |
| 8 | 36 | D8 (16), wrong double | miss |
| 9 | 18 | S2, leaves 16 and sets up D8 | excluded |
| 10 | 60 | D20 (40) | excluded |

---

## Section 2 — Where "remaining before this dart" comes from

The classifier is only as good as the remaining handed to it, so the derivation gets exactly one definition, in the application layer.

**New migration `0038`** replaces `v_double_out_checkout_darts` with **`v_x01_checkout_darts`**: all three ladders (`501`, `TUOD`, `ONE_TWENTY_ONE`), `VISUAL_BOARD` only, scoped to the session's owning participant like `v_dart_analytics` and `v_dart_locations`. It exposes **facts only** — `session_id`, `player_id`, `game_type_key`, `ruleset_version_key`, `stage_id`, `turn_sequence`, `turn_total_score`, `dart_number`, `hit_target_number`, `hit_zone_key`, `score`, `starting_score`, and the session's configuration snapshot. No running-total arithmetic in SQL at all, so no second definition of "remaining" exists to drift from the engines'.

**New module `modules/game/checkout-visits.module.ts`** holds the three per-game visit builders that today live inside `five-oh-one-play.data.ts`, `tuod-play.data.ts` and `one-twenty-one-play.data.ts`, moved with their behaviour unchanged:

- 501 folds *counted* visit totals (`turns.total_score`, which is 0 for a bust) against the session's `starting_score`; within a visit, remaining drops by each dart's real board score.
- TUOD and 121 replay their ladders through `foldTuodState` / `foldOneTwentyOneState` over the turns strictly before each visit, as they already do.

The modals and the statistics service then call the same builder, so the career number is by construction the sum of the per-game ones.

**`statistics.service.ts` / `statistics.repository.ts`** rebuild `EngineFacts` plus the config snapshot per session from the new view and run them through the shared builder, replacing `findDoubleOutVisits`' hand-rolled reshape. `highestCheckout` rides along on the corrected visits.

The cost — the career read pulls each X01 session's fact log rather than a flat dart list, and the ladder replay runs server-side — is accepted. The cheaper alternative (keep the arithmetic in SQL, summing `turn_total_score` instead of dart scores) is correct only for 501 and would leave TUOD and 121 permanently out of the career stat.

---

## Section 3 — Consumers and display

- **Label `Checkout %`** everywhere the stat appears: `FiveOhOneResults.astro`, `TenUpOneDownResults.astro`, `OneTwentyOneResults.astro`, the routine summary's "Finishing" step, and `/statistics`. The field renames from `doubleAccuracy` to `checkoutPercentage` through `lib/game/types.ts`, `lib/stats/types.ts`, `pages/api/statistics/types.ts`, `services/types.ts` and `stats.store.ts`.
- **No attempts renders `—`, not `0.00%`.** `accuracyDisplay` returns `0.00%` for a zero denominator, which reads as total failure rather than no data. The routine summary already dashes this case; the modals and `/statistics` now match it.
- **`QUICK_SCORE` stays `null`** — no dart rows, nothing to classify.
- **Bob's 27 and Doubles Training are untouched** and stay out of the career checkout %.

---

## Section 4 — Testing

TDD per `app/CLAUDE.md`: a failing test first, full suite each run, `npm run validate:app` before done, `npm run format:check` clean.

- `double-attempt.module.test.ts` — the ten reference darts as ten named cases, `7b`, the 101 worked example asserting 25%, the amended 50-rule (inner vs outer single, treble, bust from 50), and boundaries: remaining 2, 40, 41, odd, leaves-1 bust, leaves-0-off-a-double bust.
- `checkout-visits.module.test.ts` — the extracted builders, with a **bust regression case per game**: a leg containing a busted visit must yield the same visit-start remaining as the unbusted equivalent. This is the test that would have caught the career bug.
- `statistics.service.test.ts` — career checkout % equals the sum of the per-session numbers over a fixture spanning 501, TUOD and 121, including a bust.
- `database/verification/0038_*.sql` — shape, the three game types, the `VISUAL_BOARD` filter, owning-participant scope; mirrors `0024`'s existing verification.
- The three `*-play.data.ts` suites updated for the renamed field. The `.astro` modals are markup, exempt from unit tests (D101), verified visually with the `run` skill.

---

## Docs and decisions

- `05-Views/00-Overview.md` and `06-Spec/05-Read-Model-Layer.md` — register `v_x01_checkout_darts`, retire `v_double_out_checkout_darts`.
- `decisions/game-engine.md` — one append-only entry superseding the 2026-09-05 rule: the unit is a dart at a double; bounce-outs and busts are misses; deliberate reroutes stay excluded; the inner single band at 50 is a missed bull; the ladder replay lives in the app because SQL cannot fold it.
- `04-Architecture-patterns.md` — the shared visit builder, noted beside Pattern 18's `checkout-bust.module.ts` paragraph.
- `context-maintenance` skill once, after implementation.

---

## Rollout

One branch off `main`, each step green before the next:

1. Classifier rewrite plus its tests — no consumers touched, provable in isolation.
2. Extract `checkout-visits.module.ts`; repoint the three modals. Per-game numbers correct from here.
3. Migration `0038` plus verification.
4. Repoint `statistics.service.ts` / `statistics.repository.ts` at the new view and the shared builder. Career number now agrees with the modals.
5. Labels, the `—` handling, docs, decisions, full `validate:app`.

No data migration: every number here is derived, so existing sessions recompute correctly the moment the code lands.
