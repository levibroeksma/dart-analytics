# Statistics Phase 2 — Board Sections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship rollout phase 2 of the detailed statistics pages. `heatmap` goes on every game page. The `intent-stored` family (`target-accuracy`, `confusion`, `grouping`, `miss-direction`, `loose-darts`) goes on Doubles Training and Bob's 27. All six are `sql` site, served through phase 1's generic section route and client cache.

**Architecture:** No migration. Every section reads phase 1's `v_stats_dart_facts` through four repository aggregates:
- intent cells: (intended pair, hit pair) counts
- position moments: Σx, Σy, Σx², Σy², Σxy per intended pair
- miss sectors
- heatmap grid cells

Board geometry stays in TS (`lib/game/board/board-geometry.module.ts`). SQL gets reference points and ring radii as bound parameters, and TS classifies aggregated cells. A pure module per section shapes rows into phase 1's `Series` contract.

**Tech Stack:** TypeScript, Astro, Alpine, Vitest, Drizzle ORM, PostgreSQL (Neon), zod, IndexedDB.

**Spec:** `docs/architecture/10-Statistics/00-Overview.md`, `01-Section-Catalog.md` (canonical); phase 1 plan `docs/superpowers/plans/2026-09-26-statistics-phase-1-foundation.md` (the contracts, registry, repository, service, route and cache this plan extends).

**Prerequisite:** Phase 1 is merged. Every interface named "phase 1" below exists on `main`. If a phase 1 name differs from what this plan says, follow the code and note the difference in the PR body.

## Plan-level decisions

Each is written into the canonical docs in Task 9 under decision **D368** (confirm the id with `bash scripts/next-decision-id.sh`; D367 is phase 1's).

1. **Singles Training is out of the intent family here.** Phase 1 decision 7 re-tagged it `intent-derived`: its engine stores no intent. In phase 2 its page gains `heatmap` only. Its accuracy sections come with phase 4's derived-intent fold.
2. **One intent-cell aggregate serves three sections.** `target-accuracy`, `confusion` and `loose-darts` are all projections of one count grid: intended (number, zone) × hit (number, zone) per bucket.
   - `loose-darts` moves from site `server` to `sql`. SQL only counts; the TS module classifies each **aggregated cell** with the board geometry. So the geometry stays single-sourced (catalog §1.1), and the section works over unbounded ranges.
   - A hit is exact pair equality. This matches `isHitOn` (`board-progression.module.ts`) for every intent these engines store (`DOUBLE:n`, `INNER_BULL:25`), and a test pins that parity.
3. **`grouping` returns moment sums, not means.** Per intended pair it returns `{ n, sumX, sumY, sumXX, sumYY, sumXY }` in board millimetres. Sums re-aggregate exactly across buckets (`00-Overview.md` §5.1). Mean offset, spread and bias direction are derived in an isomorphic helper against `zoneCentroid`, so SQL never holds an aim point.
4. **`miss-direction` gets its reference points as a bound `VALUES` table.** The service builds rows `(target, zone, cx, cy, rInner, rOuter)` from `zoneCentroid` + `BOARD_RADII_MM` and passes them as parameters. SQL does only arithmetic:
   - bearing = `atan2(dx, −dy)`, the same formula as `missMargin`, split into 8 sectors of 45°, sector 0 centred on "up"
   - radial class = `INSIDE` / `WITHIN` / `OUTSIDE` the intended ring band. For a double, `INSIDE`/`OUTSIDE` is the "inside vs outside the wire" split the catalog asks for.

   Only missed darts count.
5. **Target key and the `target` parameter.** An intended target is written `<ZONE_KEY>:<number>` (`DOUBLE:16`, `INNER_BULL:25`). It is the record key in every intent metric, and the format of a new optional query parameter `target`.
   - Only a section that declares it in the registry (`params: ["target"]`) accepts `target`. In phase 2 that is `heatmap`, on a game tagged `intent-stored`.
   - Anything else → `VALIDATION_FAILED` (`00-Overview.md` §5: never silently ignored).
   - `target` joins the cache's `paramsKey`.
6. **Heatmap grid.** Square cells of `HEATMAP_CELL_MM = 5`, origin at the bull, `ix = floor(x / 5)`, `iy = floor(y / 5)`. Only non-empty cells are returned, as `[ix, iy, darts]` tuples. The cell size is echoed in the result. Changing it bumps the section `version`. `bucketable: false`.
7. **No `configSensitive` on the board sections.** A dart aimed at D16 is the same fact under any ruleset version, so versions are pooled. The two games in scope have one version each today.
8. **Status and context follow phase 1.** None of these sections has `includesAbandoned`, so only `status=completed` is accepted. `context` filters exactly as in phase 1.
9. **`loose-darts` adjacency** (a constant in the module; changing it bumps `version`):
   - **On-target:** the hit pair equals the intended pair.
   - **Near-miss:** the same ring in either neighbouring sector (`SECTOR_ORDER`), or the neighbouring ring in the same sector. Ring order: `INNER_SINGLE`, `TREBLE`, `OUTER_SINGLE`, `DOUBLE`. For `INNER_BULL` the near-miss is `OUTER_BULL`, and the reverse.
   - **Loose:** anything else. That includes `MISS`, even just outside the wire, per catalog §1.1 ("including off the board"); `miss-direction` is what shows those.

## Global Constraints

- TDD: write the failing test, run it, watch it fail, then implement (`app/CLAUDE.md` §Test-Driven Development).
- `cd app && npm test` runs the whole suite. Finish every task with the full suite.
- No migration is planned. The join path `exercise_sessions → exercise_stages → turns → darts` is already indexed (`idx_stages_session_sequence`, `idx_turns_stage_sequence`, `idx_darts_turn_number`), and phase 1 adds the date-range index. Task 3 Step 4 measures this. A new index is added only if the measurement fails, as migration `0044` + verification + spec update, never by editing `0001`–`0043`.
- Reads go through views: every new reader selects from `vStatsDartFacts` only.
- No game rules in SQL (`05-Views/00-Overview.md` §Business Logic). Geometry constants reach SQL only as bound parameters built from `board-geometry.module.ts`.
- Units and zone keys are whitelisted. User text is never interpolated; `sql.raw` is only for whitelisted literals.
- NUMERIC arrives as a string: map every sum through `Number(nonNull(…))`.
- JSDoc only; no inline comments (`check-no-inline-comments.sh`). Exported types go in the type barrels (`check-type-barrels.sh`). No `x-init`.
- `npm run format` before every commit.
- Branch: `feat/statistics-board-sections` from `main` after phase 1 has merged. The stack cap forbids a third level, so this branch is never cut from an unmerged phase 1 branch that itself targets another task branch.
- Anything noticed that this plan does not ask for → GitHub issue via `capturing-discovered-work`, never fixed in the same pass.

## File map

| Action | Path | Responsibility |
| ------ | ---- | -------------- |
| Modify | `app/src/lib/stats/types.ts` | `SectionId` gains six ids; `SectionMeta.params`; `TargetKey` |
| Modify | `app/src/lib/stats/section-registry.ts` | six entries, page order |
| Create | `app/src/lib/stats/target-key.ts` | `formatTargetKey`, `parseTargetKey` |
| Modify | `app/src/pages/api/statistics/types.ts` | `target` param; six metric schemas |
| Modify | `app/src/repositories/statistics.repository.ts`, `app/src/modules/types.ts` | four dart aggregates + row types |
| Create | `app/src/modules/stats/sections/{intent-cells,target-accuracy,confusion,loose-darts,grouping,miss-direction,heatmap}.module.ts` | row → metrics; classification; grouping summary |
| Modify | `app/src/services/statistics.service.ts` | handler map becomes `{ load, shape }`; `target` gate; reference table |
| Modify | `app/src/lib/client/stats-cache/keys.ts` | `target` in `paramsKey` |
| Modify | `app/src/stores/game-stats.store.ts`, `app/src/pages/statistics/index.astro` | six cards, target picker |
| Create | `app/src/components/ui/StatsHeatmap.astro` (name per the components README) | board + cell overlay |
| Tests | mirror each path under `app/tests/` | |
| Docs | Task 9 list | |

---

### Task 1: Target key and registry entries

**Files:**
- Create: `app/src/lib/stats/target-key.ts`
- Modify: `app/src/lib/stats/types.ts`, `app/src/lib/stats/section-registry.ts`
- Tests: `app/tests/lib/stats/target-key.test.ts`, `app/tests/lib/stats/section-registry.test.ts` (extend)

**Interfaces:**
- `type TargetKey = \`${IntentZoneKey}:${number}\``, where `IntentZoneKey = "DOUBLE" | "TREBLE" | "INNER_SINGLE" | "OUTER_SINGLE" | "INNER_BULL" | "OUTER_BULL"`.
- `formatTargetKey(number: number, zone: IntentZoneKey): TargetKey`.
- `parseTargetKey(value: string): { number: number; zone: IntentZoneKey } | null`. It accepts 1–20 on the numbered rings and only 25 on the bulls; anything else is `null`.
- `SectionMeta` gains `params: readonly "target"[]`, `[]` for every phase 1 entry.
- `SectionId` gains `"heatmap" | "target-accuracy" | "confusion" | "grouping" | "miss-direction" | "loose-darts"`.

- [ ] **Step 1: Failing tests.**
  - `target-key`:
    - It round-trips `DOUBLE:16` and `INNER_BULL:25`.
    - `parseTargetKey` returns `null` for `DOUBLE:21`, `INNER_BULL:20`, `MISS:0`, `double:16` and `DOUBLE:`.
  - The registry has these entries:

    | id | requires | bucketable | params |
    | -- | -------- | ---------- | ------ |
    | `heatmap` | `[board]` | false | `["target"]` |
    | `target-accuracy` | `[intent-stored]` | true | `[]` |
    | `confusion` | `[intent-stored]` | false | `[]` |
    | `grouping` | `[board, intent-stored]` | true | `[]` |
    | `miss-direction` | `[board, intent-stored]` | false | `[]` |
    | `loose-darts` | `[board, intent-stored]` | true | `[]` |

    Every entry has `computeSite: "sql"`, `includesAbandoned: false`, `configSensitive: []` and `version: 1`.
  - Page order:
    - `sectionsForGame("DOUBLES_TRAINING")` and `sectionsForGame("BOBS27")` return `target-accuracy, confusion, grouping, miss-direction, loose-darts, heatmap, session-result, completion, volume` (catalog §2).
    - `sectionsForGame("501")` ends `heatmap, session-result, completion, volume`.
    - `sectionsForGame("SINGLES_TRAINING")` contains `heatmap` and no intent section (decision 1).

- [ ] **Step 2: Implement.** Declare the new entries before `session-result` so that declaration order is page order. Add a JSDoc on `SECTIONS` stating that its declaration order is the page order, and that phase 4 revisits this for Shanghai (catalog §2 puts `session-result` before `confusion` there).

- [ ] **Step 3:** Green, full suite. Commit: `feat(stats): board section registry entries and target key`

---

### Task 2: Query and response contracts

**Files:**
- Modify: `app/src/pages/api/statistics/types.ts`
- Test: `app/tests/pages/api/statistics/types.test.ts` (extend)

**Interfaces:**
- `StatisticsRangeQuery` gains an optional `target`, refined with `parseTargetKey(...) !== null`.
- Metric schemas (additive, `00-Overview.md` §5.1); `TargetRecord<T> = z.record(z.string(), T)`, keyed by `TargetKey`:

```ts
const TargetAccuracyMetrics = TargetRecord(z.object({ attempts: z.number().int(), hits: z.number().int() }));
const ConfusionMetrics = TargetRecord(z.record(z.string(), z.number().int()));
const LooseDartsMetrics = TargetRecord(z.object({ onTarget: z.number().int(), nearMiss: z.number().int(), loose: z.number().int() }));
const GroupingMetrics = TargetRecord(z.object({
  n: z.number().int(), sumX: z.number(), sumY: z.number(),
  sumXX: z.number(), sumYY: z.number(), sumXY: z.number(),
}));
const MissDirectionMetrics = TargetRecord(z.array(z.object({
  sector: z.number().int().min(0).max(7),
  radial: z.enum(["INSIDE", "WITHIN", "OUTSIDE"]),
  darts: z.number().int(),
})));
const HeatmapMetrics = z.object({
  cellMm: z.number().positive(),
  target: z.string().nullable(),
  cells: z.array(z.tuple([z.number().int(), z.number().int(), z.number().int()])),
});
```

- `ConfusionMetrics`' inner key is a hit key: a `TargetKey`, or `MISS`. Inner and outer singles stay distinct (`INNER_SINGLE:n` / `OUTER_SINGLE:n`).
- Each metric is wrapped in phase 1's `Series` response schema, giving `TargetAccuracySeriesResponse` … `HeatmapSeriesResponse`, with inferred types exported through the barrel.

- [ ] **Step 1: Failing tests.**
  - `target=DOUBLE:16` is accepted; `target=DOUBLE:21` is rejected with a `reason` naming `target`.
  - One valid sample of each response schema parses.
  - A heatmap cell with a non-integer index is rejected.

- [ ] **Step 2: Implement.** Green, full suite. Commit: `feat(api): board section contracts and target parameter`

---

### Task 3: Repository dart aggregates

**Files:**
- Modify: `app/src/repositories/statistics.repository.ts`, `app/src/modules/types.ts`
- Test: `app/tests/repositories/statistics.repository.test.ts` (extend; `render-sql.ts`)

**Shared filter:** every reader takes `DartScope = { playerId; gameTypeKey; from; to; statuses; context }` and applies it to `vStatsDartFacts`: `player_id`, `game_type_key`, `completed_at` in `[from, to)`, `status_key IN (…)`, and `context_key` when it is not `all`. Factor this into one `dartScopeWhere(scope)` helper. Bucketed readers reuse phase 1's whitelisted bucket expressions, applied to `vStatsDartFacts.completedAt`. Extract them into a shared helper if phase 1 inlined them; that extraction is required work, not discovered work.

**Interfaces:**
- `findIntentCells(db, q: DartScope & { bucket; tz }): Promise<IntentCellRow[]>`: filters `intended_zone_key IS NOT NULL`. It groups by the bucket plus `intended_target_number`, `intended_zone_key`, `hit_target_number`, `hit_zone_key`, and returns those columns + `bucket_start`, `bucket_end` and `darts`.
- `findIntentMoments(db, q: DartScope & { bucket; tz }): Promise<IntentMomentRow[]>`: the same filter, grouped by the bucket plus the intended pair. It returns `n = COUNT(*)`, `sum_x = SUM(location_x)`, `sum_y`, `sum_xx = SUM(location_x * location_x)`, `sum_yy`, `sum_xy`.
- `findMissSectors(db, q: DartScope & { refs: MissReference[] }): Promise<MissSectorRow[]>`, where `MissReference = { targetNumber; zoneKey; cx; cy; rInner; rOuter }`. It joins `(VALUES …) AS ref(target_number, zone_key, cx, cy, r_inner, r_outer)` on the intended pair, built with `sql.join` over bound parameters. It keeps only missed darts: `NOT (hit_target_number IS NOT DISTINCT FROM intended_target_number AND hit_zone_key IS NOT DISTINCT FROM intended_zone_key)`. It computes:

```sql
MOD(FLOOR(MOD(DEGREES(ATAN2(location_x - ref.cx, -(location_y - ref.cy))) + 360 + 22.5, 360) / 45)::integer, 8) AS sector,
CASE
  WHEN SQRT(location_x * location_x + location_y * location_y) < ref.r_inner THEN 'INSIDE'
  WHEN SQRT(location_x * location_x + location_y * location_y) >= ref.r_outer THEN 'OUTSIDE'
  ELSE 'WITHIN'
END AS radial
```

  It groups by the intended pair, `sector` and `radial`, and returns `darts`. There is no bucket (`bucketable: false`). The `>=` on `r_outer` mirrors `classify`'s rule that a boundary belongs to the outer ring.
- `findHeatmapCells(db, q: DartScope & { cellMm: number; target: { number; zone } | null }): Promise<HeatmapCellRow[]>`: `FLOOR(location_x / $cell)::integer AS ix`, the same for `iy`, grouped, with `COUNT(*)::integer AS darts`. When `target` is set, it adds `intended_target_number = $n AND intended_zone_key = $zone`.

- [ ] **Step 1: Failing tests** (rendered SQL + fake chain):
  - All four readers select from `vStatsDartFacts`.
  - `context=standalone` adds `context_key = 'STANDALONE'`.
  - `findIntentCells` contains `intended_zone_key IS NOT NULL`.
  - `findMissSectors` binds every reference value as a parameter: the rendered SQL contains no literal `162`.
  - `findHeatmapCells` with a `target` binds both the number and the zone.
  - Sums parse from strings.
  - `nonNull` throws on a null `intended_zone_key` row.

- [ ] **Step 2: Implement** with Drizzle `sql` fragments.

- [ ] **Step 3:** Green, full suite.

- [ ] **Step 4: Measure** (needs `DATABASE_URL`; without it, ask the owner to run it and paste the plans). Run `EXPLAIN (ANALYZE, BUFFERS)` of `findIntentCells` and `findHeatmapCells` for the heaviest real player over an all-time range (`from = 2000-01-01`).
  - **Pass:** the plan enters through `idx_exercise_sessions_player_game_completed` and reaches darts via `idx_darts_turn_number`, with no seq scan on `darts` or `turns`.
  - **On fail:** stop. Add migration `0044` with the missing index (+ verification + spec index rationale) as its own task, before continuing.

  Record the plan summary in the PR body.

- [ ] **Step 5:** Commit: `feat(stats): dart aggregates for board sections`

---

### Task 4: Intent-cell sections: target-accuracy, confusion, loose-darts

**Files:**
- Create: `app/src/modules/stats/sections/intent-cells.module.ts` (shared key + fold), `target-accuracy.module.ts`, `confusion.module.ts`, `loose-darts.module.ts`
- Tests: `app/tests/modules/stats/sections/{intent-cells,target-accuracy,confusion,loose-darts}.module.test.ts`

**Interfaces:**
- `intent-cells.module.ts` provides:
  - `intendedKey(row): TargetKey`
  - `hitKey(row): string`, which gives `MISS` for a miss, else `formatTargetKey`
  - `isHit(row): boolean`
- `targetAccuracyBuckets(rows: IntentCellRow[], ctx): Bucket<TargetAccuracyMetrics>[]`
- `confusionBuckets(rows, ctx)`: a single `bucket = none` bucket.
- `classifyLanding(intended: { number; zone }, hit: { number: number | null; zone: DartZoneKey }): "onTarget" | "nearMiss" | "loose"`, following decision 9. It uses `SECTOR_ORDER` from `board-geometry.module.ts` for neighbours; no copy of the order.
- `looseDartsBuckets(rows, ctx): Bucket<LooseDartsMetrics>[]`.

`sampleSize` is the dart count in the bucket. Empty buckets are not emitted (phase 1 rule).

- [ ] **Step 1: Failing tests.**
  - `isHit` parity: for every intended pair in `{DOUBLE:1..20, INNER_BULL:25}` × a hit set covering the same bed, the neighbouring doubles, the outer single, `OUTER_BULL` and `MISS`, `isHit` equals `isHitOn(target, observation)` from `board-progression.module.ts`.
  - `classifyLanding` cases:

    | Aim | Landing | Class |
    | --- | ------- | ----- |
    | `DOUBLE:20` | `DOUBLE:20` | on |
    | `DOUBLE:20` | `DOUBLE:1` | near (sector wrap) |
    | `DOUBLE:20` | `DOUBLE:5` | near (sector wrap) |
    | `DOUBLE:20` | `OUTER_SINGLE:20` | near |
    | `DOUBLE:20` | `OUTER_SINGLE:1` | loose (diagonal) |
    | `DOUBLE:20` | `TREBLE:20` | loose |
    | `DOUBLE:20` | `MISS` | loose |
    | `INNER_BULL:25` | `OUTER_BULL:25` | near |
    | `INNER_BULL:25` | `INNER_SINGLE:20` | loose |

  - Target-accuracy sums attempts and hits per target across two rows of the same bucket.
  - Confusion builds `{ "DOUBLE:16": { "DOUBLE:16": 3, "DOUBLE:8": 2, MISS: 1 } }`.
  - Loose-darts partitions exactly: `onTarget + nearMiss + loose === attempts`.

- [ ] **Step 2: Implement.** Pure, isomorphic, `now` injected. Green, full suite. Commit: `feat(stats): target-accuracy, confusion and loose-darts modules`

---

### Task 5: Grouping, miss-direction and heatmap modules

**Files:**
- Create: `app/src/modules/stats/sections/grouping.module.ts`, `miss-direction.module.ts`, `heatmap.module.ts`
- Tests: the three matching `*.module.test.ts`

**Interfaces:**
- `groupingBuckets(rows: IntentMomentRow[], ctx): Bucket<GroupingMetrics>[]`.
- `groupingSummary(m: GroupingMoment, target: { number; zone }): { n; meanOffset: BoardPoint; spreadMm: number; bearingDegrees: number } | null`. It returns `null` when `n < 2` or `zoneCentroid` is null. `spreadMm = sqrt(varX + varY)` with the population variance `Σx²/n − (Σx/n)²`, and `meanOffset = (Σx/n − cx, Σy/n − cy)`. It is exported for the client, and lives here because it is a pure fold over additive components.
- `missReferences(): MissReference[]` holds one row per `(number, zone)` in `SECTOR_ORDER × {DOUBLE, TREBLE, INNER_SINGLE, OUTER_SINGLE}` plus `INNER_BULL:25` and `OUTER_BULL:25`. It is built from `zoneCentroid` and `BOARD_RADII_MM`:

  | Zone | `rInner` | `rOuter` |
  | ---- | -------- | -------- |
  | `DOUBLE` | `doubleInner` | `doubleOuter` |
  | `TREBLE` | `trebleInner` | `trebleOuter` |
  | `INNER_SINGLE` | `outerBull` | `trebleInner` |
  | `OUTER_SINGLE` | `trebleOuter` | `doubleInner` |
  | `OUTER_BULL` | `innerBull` | `outerBull` |
  | `INNER_BULL` | `0` | `innerBull` |

- `missSector(dx: number, dy: number): number` is the TS twin of the SQL sector expression, used by tests and the UI legend.
- `missDirectionBuckets(rows: MissSectorRow[], ctx)`.
- `HEATMAP_CELL_MM = 5`; `heatmapBuckets(rows: HeatmapCellRow[], ctx & { target: TargetKey | null })`.

- [ ] **Step 1: Failing tests.**
  - Grouping:
    - Four darts at `(cx±2, cy)` / `(cx, cy±2)` around `DOUBLE:16` give `meanOffset ≈ (0,0)` and `spreadMm = 2`.
    - Splitting the same darts over two buckets and summing the moments yields the same summary (additivity).
    - `n = 1` returns `null`.
  - `missSector` agrees with `missMargin(...).bearingDegrees`: at bearings 0, 22.4, 22.5, 180 and 337.5 it returns sectors 0, 0, 1, 4 and 0.
  - `missReferences` has 82 rows (20 × 4 + 2), and its `DOUBLE:20` row equals `zoneCentroid(20, "DOUBLE")` with radii 162/170.
  - Heatmap tuples keep the SQL order, and `target` is echoed.

- [ ] **Step 2: Implement.** Green, full suite. Commit: `feat(stats): grouping, miss-direction and heatmap modules`

---

### Task 6: Service dispatch

**Files:**
- Modify: `app/src/services/statistics.service.ts`, `app/src/services/types.ts`
- Test: `app/tests/services/statistics.service.test.ts` (extend)

**Change:** phase 1's `HANDLERS: Record<SectionId, (rows, ctx) => Bucket[]>` becomes `Record<SectionId, SectionHandler>` with `SectionHandler = { load(db, q): Promise<unknown[]>; shape(rows, ctx): Bucket<unknown>[] }`. The three phase 1 sections share one `load` (`findBucketedSessionAggregates`), so their behaviour is unchanged and their tests stay as they are. This is a refactor under green tests.

Behaviour added:
- **`target` gate (decision 5).** `target` set on a section whose `params` lacks it → `VALIDATION_FAILED`. It is also rejected when the game lacks `intent-stored` (`STATS_TAGS`), with the `reason` naming both.
- `miss-direction.load` passes `missReferences()`.
- `heatmap.load` passes `HEATMAP_CELL_MM` and the parsed target.
- Non-bucketable sections with `bucket ≠ none` → `VALIDATION_FAILED`. This is phase 1's check, now live.

- [ ] **Step 1: Failing tests.**
  - Each of the six sections dispatches to its reader and shapes the result.
  - `heatmap` + `target=DOUBLE:16` on `DOUBLES_TRAINING` passes `{ number: 16, zone: "DOUBLE" }`.
  - The same on `501` → `VALIDATION_FAILED`.
  - `target` on `grouping` → `VALIDATION_FAILED`.
  - `confusion` with `bucket=month` → `VALIDATION_FAILED`.
  - `target-accuracy` on `SINGLES_TRAINING` → `NOT_FOUND`.
  - The phase 1 section tests are still green without edits.

- [ ] **Step 2: Implement.** Green, full suite. The route needs no change: it already dispatches any `isSectionId`. Add one route test for `heatmap` with `target`, then run `npm run validate:app`. Commit: `feat(stats): dispatch board sections`

---

### Task 7: Cache key

**Files:**
- Modify: `app/src/lib/client/stats-cache/keys.ts`
- Test: `app/tests/lib/client/stats-cache/keys.test.ts` (extend)

- [ ] **Step 1: Failing test.**
  - `paramsKey` differs for `target=DOUBLE:16` vs `DOUBLE:8` vs absent.
  - The key for an absent `target` equals the phase 1 key, so existing cached entries survive without a schema bump.
- [ ] **Step 2: Implement.** Green, full suite. Commit: `feat(client): target in statistics cache key`

---

### Task 8: Store and page

**Files:**
- Modify: `app/src/lib/client/api/statistics.ts` (a `target` query param), `app/src/stores/game-stats.store.ts`, `app/src/pages/statistics/index.astro`
- Create: the heatmap component under `app/src/components/ui/`. Name and props follow `components/CLAUDE.md`; it reuses `DartBoard.astro`'s SVG rather than a second board drawing.
- Tests: `app/tests/stores/game-stats.store.test.ts` (extend), the API test (extend)

**Store:**
- `heatmapTarget: TargetKey | null`. Changing it reloads only `heatmap`.
- Getters, all derived client-side from components:
  - `accuracyRows`: rate per target, sorted weakest first.
  - `favoriteTarget` / `weakestTarget`: best and worst rate among targets with `attempts ≥ MIN_TARGET_SAMPLE` (constant `30` in `lib/stats/`; `null` when none qualify).
  - `confusionTop(target, 3)`: the three most frequent non-hit landings.
  - `groupingRows`: `groupingSummary` per target.
  - `missRose(target)`: 8 sector counts + the radial split.
  - `looseRate` per bucket.

**Page:** for each section in `sectionsForGame`:

| Section | Card |
| ------- | ---- |
| `target-accuracy` | a per-target list with a hit-rate bar, favourite and weakest called out |
| `confusion` | a target picker, then the top landings with counts |
| `grouping` | per target: spread (mm) and bias ("pulls 6 mm low-left") |
| `miss-direction` | an 8-sector rose + inside/outside split (inside/outside the wire for doubles) |
| `loose-darts` | on / near / loose shares + a month trend |
| `heatmap` | a board with the cell overlay; a target picker on intent-stored games |

Sparse samples show "not enough darts yet" below `MIN_TARGET_SAMPLE`, never a rate.

- [ ] **Step 1: Load the `dataviz` skill** before any chart code or colour choice. Then read `07-Frontend/10-Frontend-Agent-Guide.md`. Colours come from style tokens (`check-style-tokens.sh`), a sequential scale for the heatmap.
- [ ] **Step 2: Failing store tests.**
  - `favoriteTarget` ignores targets under the minimum sample.
  - `weakestTarget` picks the lowest qualifying rate.
  - Changing `heatmapTarget` calls `readSection` for `heatmap` only.
  - `missRose` returns 8 entries.
- [ ] **Step 3: Implement the store, then the page.**
- [ ] **Step 4:** Full suite, `npm run validate:app`, then the full `app/` gate set from `run-all-gates`. Commit: `feat(stats): board section cards and heatmap`

---

### Task 9: Docs, decision, gates

**Files:**
- `decisions/api.md`: **D368** covering decisions 1–9 above. Confirm the id with `bash scripts/next-decision-id.sh`.
- `docs/architecture/10-Statistics/01-Section-Catalog.md`:
  - `loose-darts` row: site `sql`, reason "SQL counts intended × hit cells; TS classifies cells with board geometry".
  - `miss-direction` row: reference points bound from TS.
  - `grouping` row: moment sums.
  - §1.1: the adjacency table from decision 9.
  - Status line: the six sections are built.
- `docs/architecture/10-Statistics/00-Overview.md`:
  - §5: the `target` parameter and the per-section `params` registry field (also in the §2 field table).
  - §12: phase 2 is done.
  - Version bump 1.2.0, citing D368.
- `docs/architecture/06-API/04-Endpoint-Contracts.md`: the six section ids with their metric shapes, and the `target` rule and errors.
- If Task 3 Step 4 added `0044`, also: `05-Database/05-Views` / spec index rationale and the migration range in `docs/CLAUDE.md`, root `CLAUDE.md` and `database/CLAUDE.md`.

- [ ] **Step 1:** Make the doc edits: minimal diffs, canonical doc first.
- [ ] **Step 2:** Run the `context-maintenance` skill.
- [ ] **Step 3:** Run the `run-all-gates` skill: the Always-run set, the `app/` set and `check-decision-ids.sh` (plus `check-constraint-mirror.sh` if `0044` exists). Report each result.
- [ ] **Step 4:** Commit `docs(stats): phase 2 board sections and D368`, then run `superpowers:finishing-a-development-branch` with `finishing-a-dart-branch` (push + PR).

---

## Out of scope (later phases)

- Singles Training, Shanghai and Around the Clock accuracy sections via the derived-intent fold (phase 4). Phase 4 also widens the intent sections' `requires` to "stored or derived", which the AND-only `requires` field cannot express today. Its spec decides how.
- `bobs27-survival` (phase 4, game-specific).
- `treble-rate` and checkout sections (phase 3).
- Career-wide doubles across Doubles Training, Bob's 27 and X01 (catalog §3).
- `client`-site recomputation and the `facts` store.
