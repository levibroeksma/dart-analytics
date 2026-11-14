# 501 Statistics Page — Design

Date: 2026-11-14. Status: draft for owner review.

## Intent

The 501 statistics page today shows completion, the heatmap and the session
list. The backend serves far more: checkout, bust, leg and scoring sections
and the five inferred-aim sections (D555). This page makes that data
readable: headline numbers first, detail one tap away. It answers "how am I
throwing at 501 lately, and where do I leak points".

## Goals

- Show every 501 section the API serves, except completion, in homepage-style
  components.
- Each aim section is a headline card; the breakdown opens on tap.
- Every period-based value compares with the preceding equal period where a
  comparison makes sense.
- Respect the variations dropdown on every section. D556 applies the
  `variation` parameter to every 501 section, the heatmap and the session
  list (`01-Section-Catalog.md` §2.1), so no section is exempt. Best leg
  respects it too.

## Non-goals and anti-goals

- No new endpoints, sections, migrations or metrics. The page reads what
  exists. A missing number is an issue, not a same-pass backend change.
- No completion donut and no abandon rate on 501 (owner: irrelevant).
- No design-sync artifact work in this spec (sync is unavailable; the owner
  is asked before the PR, D524).
- Anti-goal: a wall of numbers. Anything beyond the headline lives behind the
  tap.
- Anti-goal: silent under-counting. Skipped sessions and ambiguous darts are
  always disclosed.

## Page, top to bottom

Components are the homepage and statistics ones that exist
(`CareerTiles` pattern, `ScoreAverageCard`, `DailyAverageCard` card style,
`GrowingCard`, `GameVariationSelect`, `Select`).

1. **Controls.** Page-level Period select (existing; 30 / 90 / 365 days / all)
   and the variations dropdown. Default variation is 501; the Period keeps
   its existing default (the builder confirms it is 30 days; the owner's
   darts-per-leg ask is 30 days).
2. **Data-quality line.** One muted line under the controls when
   `skippedSessions > 0` on any loaded aim section: "N sessions could not be
   analysed", N the largest `skippedSessions` among the loaded sections
   (their skip sets overlap, so a sum would double count; my call). It
   appears as sections load and is absent on error.
3. **Averages row** (`ScoreAverageCard` squares, three across; my call): 3-dart
   average (`points / darts × 3`), first-nine average (`firstNinePoints /
   firstNineDarts × 3`) from `scoring-trend`, and darts per leg (period mean
   from the `leg-stats` histogram, `sum(darts × legs) / sum(legs)`). Each
   shows the percent change against the preceding period. Darts per leg is
   lower-is-better, so `ScoreAverageCard` gains an invert flag: a fall is
   green.
4. **Tiles row** (`CareerTiles` style, three tiles: mono key, display value,
   muted hint):
   - Checkout %: `finished / chances` over `checkout-rate`; hint is the change
     in percentage points against the preceding period.
   - Bust %: `busts / visits` over `bust-rate`; hint likewise. A fall is green.
   - Best leg: all time, fewest darts, from `leg-stats.bestLeg` (`{ darts,
     sessionId }`); hint is the date; tap opens that session's replay via the
     existing replay route (`02-Replay.md`, `replay-route.ts`; the session,
     not the leg). Ignores the Period select (owner: "of all time"), not the
     variation.
5. **Aim cards** (`GrowingCard`, headline on the card, breakdown in the
   overlay; owner-confirmed headlines):

   | Card | Headline | Overlay |
   | ---- | -------- | ------- |
   | Treble accuracy (`large-target-accuracy`) | Treble hit % on T20 | One row per aim T20/T19/T18: treble, single, left neighbour, right neighbour, elsewhere; the switch-off-T20 count |
   | Aim drift (`aim-drift`) | 1st-dart drift as "4 mm left, 2 mm low" | All three darts of the visit, mean offset and spread, per basis |
   | Doubles (`double-accuracy`) | Overall double hit % with best and worst double named | Every double and the bull: hit %, misses by band (inside / within / outside) and direction sector |
   | Double preference (`double-preference`) | The most-left double and its split-away rate | Every double: left, split away, attempts, hits |
   | Setup (`setup-success`) | Setup-dart hit % and good-leave share | Rates per basis and aim kind |

   Headline definitions (my calls; terms `basis`, `aim`, `resolution` are
   defined in `01-Section-Catalog.md` §2.1):
   - Treble hit %: `trebles / darts` over the `TREBLE:20` rows, all resolutions.
   - Drift: dart 1 of the visit, pooled over bases and aims, mean offset
     `sumDx / n`, `sumDy / n` in mm (the API gives mm, landing minus
     `aimPoint`). The plan fixes the left/right and low/high signs against
     `aimPoint` and the board's y direction before any copy is written.
   - Doubles: `HIT / (HIT + MISS)` over all `DOUBLE:n` rows plus the inner
     bull. Best and worst double: highest and lowest hit % among doubles with
     at least 10 darts (ties: more darts wins).
   - Double preference: the double with the highest `left` count in its
     `STATE` row; the rate is `splitAway / left`.
   - Setup: `hits / attempts` over all `ROUTE`, `SETUP` and `SPLIT` rows;
     good-leave share is `goodLeaves / visits` from `VISITS`.

   Every overlay ends with the card's own ambiguous-dart count and its
   sample size. Minimum sample: a card shows "—" as headline under 30 darts
   (card level); an overlay row under 10 darts shows its count and no rate.
   Both are one constant each.
6. **Heatmap** with an aim picker: all aims, then the inferred aim keys
   seen in the data, `WIRE:a-b` included (D555). Reuses `GameHeatmapSection`.
7. **Session list** unchanged.

Headlines compare with no preceding period: aim cards show the period only
(my call; a delta on a rate over few darts misleads).

## Data flow

- Previous-period values: `checkout-rate`, `bust-rate`, `leg-stats` and
  `scoring-trend` are all bucketable. Reuse the `trendWindow` doubled window:
  one bucketed request per section, split into the current and preceding
  bucket. With Period "All Time" there is no preceding period: the hint is
  blank and no delta shows.
- All reads use the existing `loadGameSection` path and the Period select
  `rangeKey`, with `variation` from `statsVariation`. The preceding-period
  values reuse the score-trend window logic (`score-trend-window.ts`), which
  already derives the preceding span.
- Best leg: one all-time un-bucketed `leg-stats` request on mount, re-sent on
  variation change.
- Derived values (rates, means, drift in mm and its direction words) are
  computed client-side from the additive metrics; no server change.
- Left/right/low/high wording follows the aim point's frame: negative `dx` is
  left, positive `dy` is low (board y grows downward). Verified in the plan
  against `aimPoint`.

## Constraints and facts the builder needs

- Page store getters for 501 return null/empty today (#1325); this work
  replaces them with real state.
- Ratchets apply: `mi_average` floor 91.05 (#1327). Keep new modules small
  and split by section.
- The aim sections read only darts with coordinates; sessions that cannot be
  analysed are counted in `skippedSessions`.
- Ambiguous counting stays as served per section (D555). Uniform counting is
  an open owner decision and out of scope; the overlay shows each section's
  own count.
- Empty states: a period with no sessions shows "—" values and no overlay
  data, never zeros.
- Errors: a section that fails shows its error alert in place of its
  value; other sections still render (existing `ErrorAlert` pattern).

## Slices (my call, each independently shippable)

1. Controls, tiles (checkout, bust, best leg, darts per leg, both averages),
   data-quality line; completion removed from the 501 layout.
2. Treble accuracy and aim drift cards with overlays.
3. Doubles, double preference and setup cards with overlays.
4. Heatmap aim picker.

Each slice is its own plan task group and may ship as its own PR.

## Left to the builder

Component file split, Alpine factory names, overlay table markup,
accessible labels, the exact formatting helpers (reuse `format-statistics-
overview.ts` where it fits), and the tile key labels.

## Documentation owed

Statistics Overview, Section Catalog §2 (501 layout row), Endpoint Contracts
only if a response shape changes (none planned), File Inventory rows, one
decision entry in `decisions/` for the layout and the minimum-sample rule.
