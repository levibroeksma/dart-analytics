# 501 Statistics — Inferred Aim and Page Design

Date: 2026-11-11 · Status: design, awaiting owner approval · Scope: 501 only

First of a series. Order agreed with the owner: 501 → 121 → Cricket & Tactics →
Score Training → Singles Training → Doubles Training. Every other game is out of
scope. 121 is expected to reuse this document's aim model; each later game gets
its own brainstorm and spec.

---

## 1. Intent

The owner wants the 501 statistics page to show **progression over time** and
**patterns that tell them what to train**. Their examples:

- "My first dart drifts left of the target."
- "When I aim at a double I land inside more often than outside."
- "I turn towards D16/D20 because they're said to be better, but I might hit
  D12 or D6 better." The answer should feed better setup decisions in real
  games.

Every one of these needs to know **what the dart was aimed at**. 501 stores no
aim (`darts.intended_*` is `NULL`; `10-Statistics/00-Overview.md` §3). The
owner's decision: **derive the aim**. It will never be airtight, but it can get
close. V1 covers whole beds and conventional checkout play, and is designed to
be refined.

## 2. Goals, non-goals, anti-goals

**Goals**

- A pure, deterministic aim resolver for 501 darts. It is built as a set of
  rules that can be extended without type changes (§4.7).
- A 501 statistics page with the eleven sections in §6, each bucketable for
  month-over-month progression where its metric is additive.
- Every inferred aim carries *how* it was inferred, so a figure can be filtered
  by basis and the owner can judge how far to trust it.

**Non-goals (V1)**

- Opponent score, match pressure or personal preference as inputs (§4.6
  reserves the hook).
- Treble wires, bull/25 wires, bull-finish alternatives beyond the chart route.
- Any game other than 501. Capture modes other than `VISUAL_BOARD`.
- Persisting inferred aims.

**Anti-goals (a failure even if it "works")**

- **Circular accuracy:** a dart must never be counted as "aimed where it
  landed". The landing point may only *choose between* candidates the
  situation already produced (§4.4).
- **Forced guesses:** a dart that cannot be assigned honestly is left out of
  every aim-based figure, never assigned anyway (§4.5).
- **Silent bias:** where a known bias exists (§4.5), the card shows its size.

## 3. Constraints

- **Store facts, derive meaning:** inferred aims are computed at read time and
  never written. No migration, no new table, `darts.intended_*` stays `NULL`
  for 501.
- **Hard invariant, persistence shape:** capture mode `ANALYTICS` +
  `VISUAL_BOARD`; stage type `LEG`; one `turns` row per visit, one `darts` row
  per dart with `location_x/y`. No change to any of these.
- **Compute site:** the resolver needs the remaining-score fold, so every
  section that uses it is a `server` section. It is bounded by
  `MAX_FOLD_DARTS` and fetched in chunk windows (`00-Overview.md` §4), the same
  as the existing checkout family (`x01-checkout-sessions.module.ts`).
- **Additive components only** (`00-Overview.md` §5.1).
- **Honest replay** (`01-Section-Catalog.md` §1.2, D370 decision 4). A session
  is skipped and counted in `skippedSessions` when:
  - its snapshot doesn't decode, or its fold row count disagrees with
    `dart_count`; or
  - any dart lacks coordinates, because the landing point is needed to resolve
    candidates.
- **Rule source:** the conventional route table is `checkoutPathFor` /
  `checkoutPathWithin` (`modules/game/checkout-path.module.ts`), never a second
  copy. Board geometry is `lib/game/board/board-geometry.module.ts`
  (`SECTOR_ORDER`, `BOARD_RADII_MM`, `zoneCentroid`).
- **Docs authority:** this design adds a third intent family beside
  `intent-stored` and `intent-derived` (§5). The statement in `00-Overview.md`
  §3 that inferring an aim "would fabricate a fact" is narrowed, not ignored.
  Implementation records a new decision that cites what it supersedes, and
  updates `00-Overview.md` §3 and `01-Section-Catalog.md` §1–§2.

---

## 4. The aim model (decided with the owner)

### 4.1 Inputs per dart

The aim for a dart is worked out from:

- the **remaining score before the dart**, from `checkoutDarts`
  (`double-attempt.module.ts`);
- the **darts left in the visit**, counting this one (3, 2 or 1);
- the **landing point** (`location_x`, `location_y`).

The landing point is used **only** to choose between candidates (§4.4).

### 4.2 Aim kinds

| Kind | Example | Hit when the dart lands in | Aim point (for drift) |
| ---- | ------- | -------------------------- | --------------------- |
| Treble bed | T20 | `TREBLE` of n | `zoneCentroid(n, "TREBLE")` |
| Single bed | S9 | any single ring of n (inner or outer) | `zoneCentroid(n, "OUTER_SINGLE")`, the "large" single |
| Double bed | D16 | `DOUBLE` of n | `zoneCentroid(n, "DOUBLE")` |
| Bull | BULL | `INNER_BULL` | `{0,0}` |
| Wire | 6/10 | any single ring of either number | on the shared sector edge, at the outer-single mid radius (`(trebleOuter + doubleInner) / 2`) |

A wire is always two **board-adjacent** numbers, single rings only, in V1.

### 4.3 Candidate rules

For each dart, produce candidates from the rules below. The rules are not "first
match wins": a dart can collect candidates from several rules (finish + split).

Definitions:

- `finishable(r)`: `r` is even with `2 ≤ r ≤ 40`, or `r = 50`.
- **Good leave:** an even `L` with `4 ≤ L ≤ 40` and `L % 4 = 0`. A dart that
  misses inside into the single still leaves an even number, so another double.
  The owner's V1 list (D20, D16, D18, D8, D10, D12) is a subset; D14, D6, D4
  and D2 qualify too.
- **Leave rank:** how many clean halvings the leave allows (2-adic valuation),
  ties broken by the higher leave: 32 (5) > 16 (4) > 40, 24, 8 (3) > 36, 28,
  20, 12, 4 (2). "D16/D8 outranks D20/D10/D5" — owner. Held as a data table so it
  can be overridden later (§4.7).

| Rule | When | Candidates | Basis tag |
| ---- | ---- | ---------- | --------- |
| **Large target** | no route fits the darts left (`checkoutPathWithin(r, dartsLeft) = null`) and `r > 170`, or `r` is a bogey number | T20, T19, T18 (equal weight) | `LARGE_TARGET` |
| **Route** | a route fits the darts left and its first dart is not a one-dart finish | the route's first dart; if it is a single, merged into a wire when a board neighbour also leaves a good leave (best-ranked neighbour) | `ROUTE` |
| **Setup** | `r ≤ 170`, not a bogey, but no route fits the darts left | the conventional route's first dart (`checkoutPathFor(r)[0]`), with the same wire merge | `SETUP` |
| **Finish** | `finishable(r)` | the double for `r` (or BULL for 50) | `FINISH` |
| **Split** | `finishable(r)`, `r` is not a good leave, and some single `s < r` leaves a good leave | the single leaving the best-ranked good leave; merged into a wire when a board neighbour also leaves a good leave | `SPLIT` |

Notes from the owner conversation:

- **No situational filtering.** Splits are offered whatever the darts left,
  opponent or pressure: "I might go straight for D11, in another scenario
  split the same score". The landing point decides.
- **A wire replaces its two single candidates**, because aiming at S16 alone
  and aiming at the 8/16 wire cannot be told apart from where the dart landed.
- **At 50**, the chart route (S10 → D20) and BULL are both candidates. They are
  far apart on the board.
- **Switching** (blocked 20, or "the 20 just ain't landing") needs no rule of
  its own. The large-target candidate set plus landing resolution detects it.

### 4.4 Resolution

1. One candidate → that is the aim (`resolution: "SOLE"`). The landing point
   plays no part.
2. Several candidates → measure the distance from the landing point to each
   candidate's aim point. For a bed this means the nearest point of the bed;
   for a wire, the nearest point of the two-bed union. Divide each distance by
   the candidate's weight; V1 weights are all 1. The nearest wins
   (`resolution: "NEAREST"`).
3. If the runner-up is nearly as close, the dart is `AMBIGUOUS` (§4.5): the
   test is `nearest / runnerUp > AMBIGUITY_RATIO`.

`AMBIGUITY_RATIO` is a section-module constant; changing it bumps the
section `version`. Default **0.75** (my call). It is calibrated by the fixtures
in §7: a dart in the middle of the 1 at 402 is ambiguous; a dart in the 1 right
against the 20 wire resolves to T20.

### 4.5 Ambiguous darts (owner's decision)

- **Kept** in the heatmap (unfiltered), scoring, checkout %, bust rate and leg
  stats, which do not depend on aim.
- **Left out** of every aim-based figure: accuracy per target, drift,
  inside/outside, split and wire success, and heatmap filtered by aim.
- Every aim-based card shows the count it left out.
- **Known bias:** ambiguous darts are always misses, so T20 and T18 hit rates
  read slightly high, mostly from darts in the middle of the 1. The T20 card
  names that count ("N darts in the 1 not assigned").

### 4.6 Worked scenarios (owner-confirmed)

These double as the resolver's acceptance tests.

| # | Remaining | Darts left | Landing / context | Derived aim | Basis |
| - | --------- | ---------- | ----------------- | ----------- | ----- |
| 1 | 501 | 3 | in or around T20 | T20 | LARGE_TARGET |
| 2 | 402 | 3 | in or around the 19 bed | T19 (a switch) | LARGE_TARGET |
| 3 | 501 | 3 → 2 | dart 1 in the 5, dart 2 in T7 close to T19 | T20 (missed), then T19 (a switch) | LARGE_TARGET |
| 4 | any > 170 | – | middle of the 1 | AMBIGUOUS (T20 vs T18) | LARGE_TARGET |
| 5 | 100 | 3 | any | T20 | ROUTE |
| 6 | 81 | 3 | any | T15 | ROUTE |
| 7 | 41 | 2 | any | S9 | ROUTE |
| 8 | 41 | 1 | any | S9 (leaves 32) | SETUP |
| 9 | 60 | 1 | any | S20 (leaves 40) | SETUP |
| 10 | 99 | 2 | any | T19 | SETUP |
| 11 | 169 | 3 | any | T20 / T19 / T18 by landing | LARGE_TARGET |
| 12 | 36 | 1 | any | D18 | FINISH (36 is a good leave → no split) |
| 13 | 16 | 2 | after D16 missed inside (S16) | D8 | FINISH |
| 14 | 20 | 2 | after D20 missed inside (S20) | D10 | FINISH |
| 15 | 18 | any | near D9 / in 14 or 12 | D9 | FINISH |
| 16 | 18 | any | in S2, or in 15 or 10 | S2 (hit, or a missed split) | SPLIT |
| 17 | 34 | any | in S2 | S2 → leaves 32 (avoids the odd 17 after an inside miss) | SPLIT |
| 18 | 22 | any | in 6 or 10 | wire 6/10 (leaves 16 or 12) | SPLIT |
| 19 | 22 | any | near D11 | D11 | FINISH |
| 20 | 14 | any | in 6 or 10 | wire 6/10 (leaves 8 or 4) | SPLIT |
| 21 | 39 | any | in 7 or 19 | wire 7/19 (leaves 32 or 20) | ROUTE |
| 22 | 42 | any | in 6 or 10 | wire 6/10 (leaves 36 or 32) | ROUTE |
| 23 | 46 | any | in 6 or 10 | wire 6/10 (leaves 40 or 36) | ROUTE |
| 24 | 48 | any | in 8 or 16 | wire 8/16 (leaves 40 or 32) | ROUTE |

**Generated, not yet confirmed by the owner.** These come out of the rules
mechanically. The builder implements the rules, not this list, and flags any
row the rules don't produce:

| Remaining | Generated |
| --------- | --------- |
| 6 | D3 or split S2 → 4 |
| 10 | D5 or split S2 → 8 |
| 23 | route, wire 7/19 → 16 or 4 |
| 26 | D13 or split wire 10/6 → 16 or 20 |
| 28 | D14 only (28 is a good leave) |
| 30 | D15 or split S14 → 16 |
| 35 | route, wire 3/19 → 32 or 16 |
| 38 | D19 or split wire 6/10 → 32 or 28 |
| 43 | route, wire 3/19 → 40 or 24 |
| 50–60 | route single → 40, no wire |

### 4.7 Extension points (designed in, not built)

| Refinement | Where it plugs in |
| ---------- | ----------------- |
| Per-player route preference ("81 → T19, D12") | a candidate rule ahead of `ROUTE`, or an override table consulted by `ROUTE` |
| Per-player leave ranking from their own hit rates (the D12/D6 point) | replaces the leave-rank table |
| Opponent on a finish, pressure, personal preference | candidate `weight` (§4.4 step 2) |
| Treble wires, bull/25 options, inner/outer single aims | new aim kinds in the union and a new candidate rule |
| Stickiness after a switch | weight adjustment from earlier resolved darts in the leg |

Shape (illustrative, the builder names files):

- `InferredAim`: a discriminated union over the kinds in §4.2.
- `AimCandidate = { aim, basis, weight }`.
- `CandidateRule = (ctx: AimContext) => readonly AimCandidate[]`, where
  `AimContext` holds `{ remaining, dartsLeft, earlierDartsInVisit }`.
- `resolveAim(candidates, landing) → { aim, basis, resolution }`, with
  `resolution` one of `SOLE`, `NEAREST` or `AMBIGUOUS`.
- The rule list is an ordered array exported from one module, so 121 can reuse
  or swap rules.

---

## 5. Statistics layer integration

- **New capability tag:** `intent-inferred` ("aim inferred from game state
  plus landing"), declared for 501 beside `RULESET_CAPABILITIES`.
- **Requirements:** sections that require `intent-*` gain it in their `anyOf`
  only where the section is meaningful for inferred aims (see §6).
- **Site:** `siteByTag["intent-inferred"] = "server"`.
- **Target keys:** `TargetKey` (`lib/stats/types.ts`) gains a wire form,
  `WIRE:<a>-<b>` with `a`, `b` board-adjacent and written in `SECTOR_ORDER`
  order. `parseTargetKey`, `targetLabel` (`6/10`) and `isAimHit` handle it.
  The existing zones cover single, treble, double and bull.
- **Resolution data:** every inferred-aim result carries
  `{ ambiguous: number }` beside `skippedSessions`.
- **`grouping` on 501:** allowed. D370 decision 6 forbids it only for
  whole-number aims, which have no aim point; every inferred aim has one.

## 6. The 501 page (owner-approved section list, in page order)

| # | Section | Shows | Basis | Status |
| - | ------- | ----- | ----- | ------ |
| 1 | `scoring-trend` | 3-dart average, first-nine average, 100+/140+/180 | facts | exists |
| 2 | Large-target accuracy (new, e.g. `large-target-accuracy`) | per T20/T19/T18: treble %, any-segment %, miss neighbours; switch count (darts resolved to T19/T18); ambiguous count | `LARGE_TARGET` | new |
| 3 | Drift by dart number (new, or `grouping` with a `dartNumber` split) | mean offset and spread from the aim point for dart 1/2/3, per aim (T20 first) — "dart 1 drifts left" | any resolved aim | new |
| 4 | `checkout-rate` | checkout % by remaining band, darts at double | facts + fold | exists |
| 5 | Doubles (`target-accuracy` + `miss-direction` on `FINISH` aims) | hit % per double; inside / outside / left / right of the wire | `FINISH` | partly new |
| 6 | Preferred vs best double (new) | per double: how often you leave it (visits starting on its finish) vs your hit % on it | `FINISH` | new |
| 7 | Setups and splits (new) | split, route-single and wire hit %; how often a setup visit ends on a good leave | `ROUTE`, `SETUP`, `SPLIT` | new |
| 8 | `bust-rate` | busts per remaining band | fold | exists |
| 9 | `leg-stats` | darts per leg, best leg, distribution | fold | exists |
| 10 | `heatmap` | density; with a `target` filter by inferred aim (T20, D16, `WIRE:6-10`, …) | any resolved aim | partly new |
| 11 | `completion` + session list | finished vs abandoned; replay links | facts | exists |

**Leaving 501's page:** `treble-rate`, because it counts landed trebles and a
T19 hit while aiming T20 is not a treble on the aim (row 2 replaces it);
`volume`, which is low value; and `checkout-path` as a card (row 7 covers
setups). The existing `double-performance` either becomes row 5 or is retired
for 501; that is the builder's call. Do not render both.

**Progression:** every new metric is returned as additive components (`hits`,
`attempts`; `Σx, Σy, Σx², Σy², Σxy, n` for drift, as `grouping` already does)
and is bucketable.

## 7. Testing

- The resolver is a pure function tested against every row of §4.6, using
  coordinates built from `zoneCentroid` / edge points, plus:
  - the mid-1 ambiguity case and the 1-near-20-wire case (calibrates
    `AMBIGUITY_RATIO`);
  - a sweep over 2–170 × darts-left 1–3 asserting: every candidate set is
    non-empty; wire numbers are board-adjacent; no candidate is a bust;
  - the property that the landing point never *creates* a candidate.
- Section modules are tested with fixture sessions, following the existing
  `modules/stats/sections` tests.

## 8. Left to the builder

- Module/file names, and whether rows 3 and 5 extend existing sections or are
  new ones.
- `AMBIGUITY_RATIO` fine-tuning within the fixtures.
- Card layout. It follows the existing statistics overview components and, where
  the spec is silent, the Design System artifact (`syncing-design-system`
  §11–12).
- How the "left out" counts read on each card.

## 9. Calls I made (not discussed with the owner)

- Wire aim point at the outer-single mid radius on the shared edge.
- Single aim hits on either single ring; its drift point is the outer single.
- Large target applies only where no route or setup applies. Routes and setups
  whose first dart is a treble have that treble as their sole candidate (no
  T19/T18 alternative). For example, 120 with 3 darts → T20 only.
- `AMBIGUITY_RATIO = 0.75` default.
- New tag `intent-inferred` rather than widening `intent-derived`. The meanings
  differ: engine-known aim vs inferred aim.
- Sessions with any coordinate-less dart are skipped whole.
