# 501 Statistics — Inferred Aim and Page Design

Date: 2026-11-11, hardened 2026-11-12 · Status: design, awaiting owner approval · Scope: 501 only

> **Status note (2026-11-12, D555):** built by
> `docs/superpowers/plans/2026-11-12-x01-inferred-aim-statistics-backend.md`
> (backend only; the page UI is a follow-up plan). The canonical record is
> `docs/architecture/10-Statistics/00-Overview.md` §3 and
> `01-Section-Catalog.md` §1–§2.1. Where this text and the build differ, the
> build wins:
>
> 1. **§3 "No migration":** one view migration, `0055`, adds `location_x`,
>    `location_y` to `v_x01_checkout_darts`. Still no table, column or stored
>    aim.
> 2. **§5, §6 rows 3 and 5:** no existing section gains `intent-inferred`.
>    Row 3 is the new `aim-drift`, row 5 the new `double-accuracy`
>    (`target-accuracy`, `miss-direction` and `grouping` cannot carry basis,
>    resolution or a wire key).
> 3. **§4.2 footnote:** a single aim is the new zone key `SINGLE:n`;
>    `NUMBER:n` keeps its "any ring" meaning.
> 4. **§3 skip rule:** a session is skipped when its snapshot does not decode
>    or any dart lacks coordinates. The `dart_count` comparison is dropped:
>    the fold view does not filter darts.
> 5. `AMBIGUITY_RATIO` is exported from `x01-aim-resolution.module.ts`, not
>    with the rules and leave rank (`x01-aim-candidates.module.ts`), against
>    §4.8's "one module".
> 6. An ambiguous dart is counted under each section's `AMBIGUOUS` row, and
>    a bucket holding only that row is kept (`aimCountBuckets`), so chunk
>    merges stay lossless.

First of a series, in the owner's order: 501 → 121 → Cricket & Tactics → Score
Training → Singles Training → Doubles Training. Each later game gets its own
spec; 121 is expected to reuse §4.

---

## 1. Intent

The 501 statistics page shows **progression over time** and **patterns that
tell the owner what to train**. The owner's examples:

- "My first dart drifts left of the target."
- "When I aim at a double I land inside more often than outside."
- "I turn towards D16/D20, but I might hit D12 or D6 better", to make better
  setup decisions in real games.

Each needs the dart's **aim**. 501 stores none (`darts.intended_*` is `NULL`).
The owner's decision: **infer the aim** from game state plus landing point.
V1 covers whole beds and conventional checkout play, and is built to be
refined (§4.8).

## 2. Goals, non-goals, anti-goals

**Goals**

- A pure, deterministic aim resolver (§4), extensible without type changes.
- The eleven-section 501 page (§6), every aim metric additive and bucketable.
- Every inferred aim carries its **basis** (which rule) and **resolution**
  (how it was chosen), and every aim metric is keyed by both (§5).

**Non-goals (V1)**

- Opponent score, pressure or personal preference as inputs (hook: §4.8).
- Treble wires, bull/25 wires, inner-vs-outer single aims.
- Games other than 501; capture modes other than `VISUAL_BOARD`.
- Persisting inferred aims.

**Anti-goals** (a failure even when it runs)

- **Circular accuracy.** The landing point only chooses between candidates the
  game state already produced (§4.5). It never produces one.
- **Forced guesses.** An ambiguous dart leaves every aim metric (§4.6).
- **Silent bias.** A card states the size of any known bias (§4.6).

## 3. Constraints

- **Read-time only.** No migration, no table, no stored aim.
- **Persistence shape, unchanged:** capture `ANALYTICS` + `VISUAL_BOARD`; stage
  type `LEG`; one `turns` row per visit; one `darts` row per dart with
  `location_x/y`.
- **Population:** the owner's own darts (`v_stats_dart_facts`) in completed
  sessions of the 501 game pair, both play contexts, all ruleset versions
  pooled (fact-shaped, D369 decision 9). 501 is double-out only.
- **Compute site `server`** for every section that uses the resolver: it needs
  the remaining-score fold. Bounded by `MAX_FOLD_DARTS`, fetched in chunk
  windows, like the checkout family (`x01-checkout-sessions.module.ts`).
- **Additive components only** (`10-Statistics/00-Overview.md` §5.1).
- **Honest replay** (D370 decision 4). A session is skipped whole and counted
  in `skippedSessions` when its snapshot does not decode, its fold row count
  differs from `dart_count`, or any dart lacks coordinates.
- **Single sources:**
  - Routes: `checkoutPathFor` / `checkoutPathWithin`
    (`modules/game/checkout-path.module.ts`).
  - Remaining before each dart: `checkoutDarts`
    (`modules/game/double-attempt.module.ts`).
  - Geometry: `lib/game/board/board-geometry.module.ts` (`SECTOR_ORDER`,
    `BOARD_RADII_MM`, `zoneCentroid`).
- **Docs to change at implementation.** This design adds a third intent family
  and narrows `00-Overview.md` §3's "inferring an aim would fabricate a fact".
  Record a new decision citing what it supersedes; update `00-Overview.md` §3
  (tag table) and `01-Section-Catalog.md` §1–§2 (library, 501 page list).

---

## 4. The aim model

### 4.1 Inputs per dart

| Input | Source |
| ----- | ------ |
| `r` — remaining before the dart | `checkoutDarts`; always `r ≥ 2` |
| `dartsLeft` — darts left in the visit, this one included | `4 − dart_number` (3, 2 or 1) |
| landing point | `location_x`, `location_y` |

The dart that busts a visit is resolved like any other; a bust ends the visit,
so no dart follows it.

### 4.2 Aim kinds

| Kind | `TargetKey` | Hit region | Aim point |
| ---- | ----------- | ---------- | --------- |
| Treble | `TREBLE:n` | `TREBLE` of n | `zoneCentroid(n, "TREBLE")` |
| Single | `NUMBER:n`¹ | both single rings of n | `zoneCentroid(n, "OUTER_SINGLE")` |
| Double | `DOUBLE:n` | `DOUBLE` of n | `zoneCentroid(n, "DOUBLE")` |
| Bull | `INNER_BULL:25` | `INNER_BULL` | `{0, 0}` |
| Outer bull | `OUTER_BULL:25` | `OUTER_BULL` | `{0, 0}` |
| Wire | `WIRE:a-b` | both single rings of a and of b | on the shared sector edge at radius `(trebleOuter + doubleInner) / 2` |

¹ Open naming point for the builder: `NUMBER:n` already means "any ring of n"
for `intent-derived` games (`isAimHit`). A single aim hits single rings only,
so it needs its own zone key (e.g. `SINGLE:n`) or `isAimHit` must branch on
the tag. Pick one; the hit region above is fixed.

- **Hit** = the landing zone is in the hit region. Everything else is a miss,
  including the treble or double of a single aim's number.
- **Wire:** `a`, `b` are board-adjacent (`SECTOR_ORDER`, wrapping 5–20),
  written `a < b`. `targetLabel` renders `6/10`.
- A route label maps to a kind: `T20` → Treble, `20` → Single, `D20` → Double,
  `BULL` → Bull, `25` → Outer bull.

### 4.3 Definitions

- **`conv`** = `checkoutPathFor(r)`; `null` above 170 and on bogey numbers.
- **`fit`** = `checkoutPathWithin(r, dartsLeft)`.
- **`finishable(r)`**: `r` even with `2 ≤ r ≤ 40`, or `r = 50`.
- **Good leave**: `L` with `4 ≤ L ≤ 40` and `L % 4 = 0`. An inside miss into
  the single still leaves an even number.
- **Leave rank**: the count of times `L` halves evenly; ties go to the higher
  `L`. Order: 32 > 16 > 40 > 24 > 8 > 36 > 28 > 20 > 12 > 4. One exported data
  table; §4.8 replaces it later.
- **Wire merge** of a single candidate `s`: among the two board neighbours `n`
  of `s` with `r − n` a good leave, take the best-ranked. If one exists, the
  candidate becomes `WIRE` of `s` and `n`; otherwise it stays `NUMBER:s`.
  A wire replaces its single: the two cannot be told apart by landing.

### 4.4 Candidate rules

Exactly one **case** applies per dart; a case can yield several candidates.
All candidates carry weight 1 in V1.

| Case | Condition | Candidates → basis |
| ---- | --------- | ------------------ |
| A | `conv = null` | `TREBLE:20`, `TREBLE:19`, `TREBLE:18` → `LARGE_TARGET` |
| B | `finishable(r)`, `r ≠ 50` | `DOUBLE:(r/2)` → `FINISH`; plus the split candidate below → `SPLIT` |
| C | `r = 50` | `INNER_BULL:25` → `FINISH`; plus `NUMBER:10` (`conv[0]`) → `ROUTE` when `dartsLeft ≥ 2`, `SETUP` when 1 |
| D | otherwise, `fit ≠ null` | `fit[0]`, wire-merged when a single → `ROUTE` |
| E | otherwise (`fit = null`) | `conv[0]`, wire-merged when a single → `SETUP` |

**Split candidate (case B):** exists when `r` is not a good leave and some
single `s` (1–20, `s < r`) leaves a good leave. Take the `s` whose leave ranks
best, then wire-merge it.

Consequences, stated so they are not rediscovered:

- Splits are offered whatever `dartsLeft` is. The owner sometimes goes
  straight for D11 and sometimes splits the same score; the landing decides.
- A good-leave double (32, 36, 40, 16, …) has one candidate: the double.
- Switching to 19s or 18s (blocked 20, or the 20 not landing) is case A plus
  resolution. It needs no rule.
- A route or setup whose first dart is a treble has that treble as its only
  candidate. 120 with three darts is `TREBLE:20`; a 19 thrown there counts as
  a T20 miss (§9).

### 4.5 Resolution

`distance(candidate)` = distance in mm from the landing point to the nearest
point of the candidate's **hit region** (§4.2); 0 inside it. Hit regions of one
dart's candidates never overlap. A dart off the board resolves like any other.

1. One candidate → `resolution = SOLE`. The landing point is not read.
2. Else order candidates by `distance / weight`, nearest first, as `d1`, `d2`.
3. `d1 / d2 > AMBIGUITY_RATIO` → `resolution = AMBIGUOUS`, no aim.
4. Otherwise the nearest is the aim, `resolution = NEAREST`.

`AMBIGUITY_RATIO = 0.75`, one exported constant. It must satisfy both
calibration fixtures in §7; tune it only within them.

### 4.6 Ambiguous darts (owner's decision)

- **In** every figure that needs no aim: unfiltered heatmap, scoring, checkout
  rate, bust rate, leg stats.
- **Out** of every aim metric, and counted per section as `ambiguous`.
- **Known bias:** an ambiguous dart is always a miss, so T20 and T18 hit rates
  read slightly high, mostly from darts in the middle of the 1. The
  large-target card shows that count.

### 4.7 Acceptance fixtures

Owner-confirmed. Each row is a resolver test. "Lands" names a bed; the fixture
coordinate is that bed's `zoneCentroid`. "–" = the landing does not matter
(sole candidate): assert the result for at least two far-apart landings.

| # | `r` | `dartsLeft` | Lands | Aim | Basis | Resolution |
| - | --- | ----------- | ----- | --- | ----- | ---------- |
| 1 | 501 | 3 | T20 | `TREBLE:20`, hit | `LARGE_TARGET` | `NEAREST` |
| 2 | 402 | 3 | outer single 19 | `TREBLE:19`, miss | `LARGE_TARGET` | `NEAREST` |
| 3 | 501 | 3 | outer single 5 | `TREBLE:20`, miss | `LARGE_TARGET` | `NEAREST` |
| 4 | 496 | 2 | T7 | `TREBLE:19`, miss | `LARGE_TARGET` | `NEAREST` |
| 5 | 402 | 3 | T1 | none | `LARGE_TARGET` | `AMBIGUOUS` |
| 6 | 169 | 3 | T18 | `TREBLE:18`, hit | `LARGE_TARGET` | `NEAREST` |
| 7 | 100 | 3 | – | `TREBLE:20` | `ROUTE` | `SOLE` |
| 8 | 81 | 3 | – | `TREBLE:15` | `ROUTE` | `SOLE` |
| 9 | 41 | 2 | – | `NUMBER:9` | `ROUTE` | `SOLE` |
| 10 | 41 | 1 | – | `NUMBER:9` | `SETUP` | `SOLE` |
| 11 | 60 | 1 | – | `NUMBER:20` | `SETUP` | `SOLE` |
| 12 | 99 | 2 | – | `TREBLE:19` | `SETUP` | `SOLE` |
| 13 | 120 | 3 | – | `TREBLE:20` | `ROUTE` | `SOLE` |
| 14 | 36 | 1 | – | `DOUBLE:18` | `FINISH` | `SOLE` |
| 15 | 16 | 2 | – | `DOUBLE:8` | `FINISH` | `SOLE` |
| 16 | 20 | 2 | – | `DOUBLE:10` | `FINISH` | `SOLE` |
| 17 | 18 | 3 | outer single 14 | `DOUBLE:9`, miss | `FINISH` | `NEAREST` |
| 18 | 18 | 3 | outer single 2 | `NUMBER:2`, hit | `SPLIT` | `NEAREST` |
| 19 | 18 | 3 | outer single 15 | `NUMBER:2`, miss | `SPLIT` | `NEAREST` |
| 20 | 18 | 3 | outer single 10 | `NUMBER:2`, miss | `SPLIT` | `NEAREST` |
| 21 | 34 | 1 | outer single 2 | `NUMBER:2`, hit | `SPLIT` | `NEAREST` |
| 22 | 22 | 2 | outer single 10 | `WIRE:6-10`, hit | `SPLIT` | `NEAREST` |
| 23 | 22 | 2 | D11 | `DOUBLE:11`, hit | `FINISH` | `NEAREST` |
| 24 | 14 | 2 | outer single 6 | `WIRE:6-10`, hit | `SPLIT` | `NEAREST` |
| 25 | 39 | 3 | – | `WIRE:7-19` | `ROUTE` | `SOLE` |
| 26 | 42 | 3 | – | `WIRE:6-10` | `ROUTE` | `SOLE` |
| 27 | 46 | 3 | – | `WIRE:6-10` | `ROUTE` | `SOLE` |
| 28 | 48 | 3 | – | `WIRE:8-16` | `ROUTE` | `SOLE` |
| 29 | 50 | 3 | inner bull | `INNER_BULL:25`, hit | `FINISH` | `NEAREST` |
| 30 | 50 | 3 | outer single 10 | `NUMBER:10`, hit | `ROUTE` | `NEAREST` |

**Rule output the owner has not confirmed.** Implement the rules, then report
every row below that the rules do not reproduce; do not bend the rules to
match:

| `r` | Candidates |
| --- | ---------- |
| 6 | `DOUBLE:3`, `NUMBER:2` |
| 10 | `DOUBLE:5`, `NUMBER:2` |
| 23 | `WIRE:7-19` |
| 26 | `DOUBLE:13`, `WIRE:6-10` |
| 28 | `DOUBLE:14` |
| 30 | `DOUBLE:15`, `NUMBER:14` |
| 35 | `WIRE:3-19` |
| 38 | `DOUBLE:19`, `WIRE:6-10` |
| 43 | `WIRE:3-19` |
| 51–60 | the route single, never a wire |

### 4.8 Extension points (designed in, not built)

| Refinement | Plugs in at |
| ---------- | ----------- |
| Per-player route preference (81 → T19, D12) | a route table consulted before `conv`/`fit` |
| Leave rank from the player's own double hit rates | the leave-rank table |
| Opponent on a finish, pressure, preference; stickiness after a switch | candidate `weight` (§4.5 step 2) |
| Treble wires, bull/25 options, inner/outer single aims | a new aim kind plus a candidate rule |

Required shape (names are the builder's):

- `InferredAim`: a discriminated union over §4.2's kinds.
- `AimCandidate = { aim, basis, weight }`.
- `AimContext = { remaining, dartsLeft, earlierDartsInVisit }`.
  `earlierDartsInVisit` is unused in V1 and present for the weight refinements.
- `candidatesFor(ctx) → readonly AimCandidate[]`: reads no landing point.
- `resolveAim(candidates, landing) → { aim | null, basis, resolution }`.
- Rules, leave rank and `AMBIGUITY_RATIO` are exported from one module so 121
  can reuse or swap them.

---

## 5. Statistics layer integration

- **Tag:** `intent-inferred`, declared for 501 beside `RULESET_CAPABILITIES`.
  Kept apart from `intent-derived`: there the engine knows the aim.
- **Site:** `siteByTag["intent-inferred"] = "server"`.
- **Existing sections that gain the tag:** `target-accuracy`,
  `miss-direction`, `grouping`, and `heatmap`'s `target` param. `grouping` is
  valid here: every inferred aim has an aim point (D370 decision 6 excludes
  only whole-number aims). `confusion` and `loose-darts` stay off 501.
- **Target keys:** `TargetKey` gains `WIRE:a-b` (§4.2) in `parseTargetKey`,
  `targetLabel` and `isAimHit`.
- **Contract, every aim metric:** counts are keyed by `basis` and by
  `resolution` (`SOLE` | `NEAREST`); the client sums them by default. The
  result also carries `ambiguous` and `skippedSessions`. V1 adds no `basis`
  query parameter.
- **Versioning:** a change to the rules, the leave rank or `AMBIGUITY_RATIO`
  bumps the `version` of every section that reads the resolver.

## 6. The 501 page

Owner-approved, in page order. Every new section is bucketable and returns the
components listed.

| # | Section | Components | Darts counted |
| - | ------- | ---------- | ------------- |
| 1 | `scoring-trend` (exists) | unchanged | all |
| 2 | `large-target-accuracy` (new) | per aim (`TREBLE:20/19/18`): `darts`, `trebles`, `singles` (same number), `neighbourLeft`, `neighbourRight` (any ring of the adjacent number), `other` | basis `LARGE_TARGET` |
| 3 | `drift` (new, or `grouping` extended) | per aim × `dart_number` (1–3): `n`, `Σdx`, `Σdy`, `Σdx²`, `Σdy²`, `Σdxdy`, with `(dx, dy)` = landing − aim point, mm | every resolved dart, hits included |
| 4 | `checkout-rate` (exists) | unchanged | fold |
| 5 | `target-accuracy` + `miss-direction` | per double: `attempts`, `hits`, and `miss-direction`'s existing inside / within / outside and angle-sector classes | basis `FINISH` |
| 6 | `double-preference` (new) | per double: `left` (visits whose first dart had that double as its `FINISH` candidate), `attempts`, `hits`, `splitAway` (darts at that score resolved to `SPLIT`) | cases B and C |
| 7 | `setup-success` (new) | per basis (`ROUTE`, `SETUP`, `SPLIT`) × kind (treble, single, wire, outer bull): `attempts`, `hits`; and `visits`, `goodLeaves` over visits that end unfinished and unbusted with the last dart not `LARGE_TARGET`, `goodLeaves` counting those ending on a good leave | bases `ROUTE`, `SETUP`, `SPLIT` |
| 8 | `bust-rate` (exists) | unchanged | fold |
| 9 | `leg-stats` (exists) | unchanged | fold |
| 10 | `heatmap` (exists) | unchanged; with `target` = any inferred-aim key, only darts resolved to that aim | all / resolved |
| 11 | `completion` + session list (exist) | unchanged | – |

Card reading, fixed by the owner's intent:

- Row 2 shows hit % per target and the **switch count** (`darts` on
  `TREBLE:19` + `TREBLE:18`).
- Row 3 defaults to `TREBLE:20` and compares dart 1, 2 and 3.
- Row 6 puts "how often I leave it" beside "how well I hit it" per double.

**Off 501's page:** `treble-rate` (counts landed trebles, so a T19 while
aiming T20 scores as a treble; row 2 replaces it), `volume`, `checkout-path`,
and `double-performance` (row 5 replaces it; rendering both would show two
definitions of a double attempt). The live in-game checkout % keeps
`classifyDart` unchanged.

## 7. Testing

- **Resolver:** every row of §4.7's fixture table.
- **Calibration of `AMBIGUITY_RATIO`**, case A, landing at the treble mid
  radius:
  - bearing 18° (centre of the 1) → `AMBIGUOUS`;
  - bearing 10° (in the 1, 1° from the 20 wire) → `TREBLE:20`, `NEAREST`.
- **Sweep** `r` 2–501 × `dartsLeft` 1–3:
  - the candidate list is non-empty;
  - every wire pair is board-adjacent;
  - no candidate's hit busts (`r − value ≥ 2`, or `= 0` on a double or bull);
  - hit regions within one list are disjoint.
- **Purity:** `candidatesFor` takes no landing argument (type-level).
- **Sections:** fixture sessions, following the existing
  `app/tests/modules/stats/sections` tests; one fixture holds an ambiguous
  dart and asserts it is in rows 1 and 10 (unfiltered) and absent from rows 2,
  3, 5, 6, 7.
- **Skip:** a session with one coordinate-less dart lands in
  `skippedSessions`.

## 8. Left to the builder

- File and symbol names; the single-aim zone key (§4.2 footnote).
- Whether row 3 extends `grouping` or is a new section.
- Card layout, following the existing statistics overview components and the
  Design System artifact (`syncing-design-system` §11–12).
- The wording of the `ambiguous` and `skippedSessions` counts on cards.

## 9. Calls made without the owner

Check these while reading; each is stated where it applies.

1. Wire aim point: on the shared edge, mid outer single (§4.2).
2. A single aim hits either single ring; its aim point is the outer single
   (§4.2).
3. T19/T18 are candidates only in case A. A treble-first route or setup has
   one candidate, so a deliberate 19 at 120 counts as a T20 miss (§4.4).
4. At 50, both the bull and S10 are candidates (§4.4 case C).
5. `AMBIGUITY_RATIO = 0.75`, and resolution measures distance to the hit
   region, not to the aim point (§4.5).
6. Leave-rank tie-break: the higher leave (§4.3).
7. A session with any coordinate-less dart is skipped whole (§3).
8. `double-performance` leaves the 501 page; the in-game checkout % keeps its
   own attempt rule, so the two can differ (§6).
9. Aim metrics are keyed by basis and resolution; no `basis` query parameter
   in V1 (§5).
