# Statistics Phase 4 — Derived Intent and Game-Specific Sections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship rollout phase 4 of the detailed statistics pages.
- **Derived intent:** `target-accuracy`, `confusion`, `miss-direction` and `loose-darts` reach Singles Training, Shanghai and Around the Clock. The aimed target is recovered by folding each session through its engine's own reducer.
- **Game-specific:** `bobs27-survival`, `shanghai-count`, `atc-darts-per-target`.

**Architecture:** No migration planned.
- One reader returns a session's darts in play order from phase 1's `v_stats_dart_facts`, joined to `v_stats_session_facts` for the snapshot, the dart count and the bucket.
- One walker (`foldSeatSteps`) replays the owner's darts through the engine's per-seat reducer and yields the seat state before and after each dart. Each engine exports its active target, so the aim is the engine's own answer, never a copy.
- Derived sections are site `server` on derived games and stay site `sql` on stored games. The derived path turns aims into phase 2's row shapes (`IntentCellRow`, `MissSectorRow`), so phase 2's shape modules serve both.
- Server sections use phase 3's bound: `MAX_FOLD_DARTS`, client month chunks, `mergeMetrics`.

**Tech Stack:** TypeScript, Astro, Alpine, Vitest, Drizzle ORM, PostgreSQL (Neon), zod, IndexedDB.

**Spec:** `docs/architecture/10-Statistics/00-Overview.md`, `01-Section-Catalog.md` (canonical). Earlier plans own what this one extends:
- phase 1 (`2026-09-26-statistics-phase-1-foundation.md`): registry, `STATS_TAGS`, route, series helpers, cache
- phase 2 (`2026-09-26-statistics-phase-2-board-sections.md`): `SectionHandler`, `dartScopeWhere`, `TargetKey`, the intent shape modules, `missReferences`, `MIN_TARGET_SAMPLE`
- phase 3 (`2026-09-26-statistics-phase-3-checkout-sections.md`): `MAX_FOLD_DARTS`, `findScopeDartCount`, `sessionScopeWhere`, `chunkWindows`, `mergeMetrics`

**Game rules:** `docs/game-rules/rulesets/{singles-training,shanghai,around-the-clock,bobs-27}.md`. Engines win over these notes on any conflict.

**Prerequisite:** Phases 1–3 are merged. If a name differs from what this plan says, follow the code and note the difference in the PR body.

## Plan-level decisions

Each is written into the canonical docs in Task 10 under decision **D370** (confirm with `bash scripts/next-decision-id.sh`; D367–D369 belong to phases 1–3).

1. **The aim is the engine's active target before the dart.**
   - Singles, Shanghai and Around the Clock each export `activeTargetOf(state, config): BoardTarget`, and their own reducers call it. No stats code rebuilds a path.
   - The target maps to an aim key:

     | Game | `NUMBER` target | `BULL` target |
     | ---- | --------------- | ------------- |
     | Singles (V1–V3) | `NUMBER:n` (any ring) | `BULL:25` (either ring) |
     | Shanghai (V1/V2) | `NUMBER:n` | never reached |
     | Around the Clock, `segmentRule = ANY` | `NUMBER:n` | `BULL:25` |
     | Around the Clock, `segmentRule = OUTER_SINGLE` | `OUTER_SINGLE:n` | `BULL:25` |

   - It is never written back as stored intent (catalog §1.2).
2. **`TargetKey` gains two aim zones.** `NUMBER` (every ring of number 1–20) and `BULL` (either bull ring, number 25). A hit is `isAimHit(aim, observation)`:
   - `NUMBER:n`: `hitTargetNumber = n` and zone ≠ `MISS`
   - `BULL:25`: `OUTER_BULL` or `INNER_BULL`
   - any stored zone: exact pair equality (phase 2 rule, unchanged)

   Parity tests pin `isAimHit` against each engine's own hit rule, so the section never disagrees with the play page.
3. **The fold is single-seat over the owner's darts.** Every reducer in scope is per seat (`foldSeatStates`), and `v_stats_dart_facts` carries only the owner's darts. The walker therefore builds a one-seat config from the decoded snapshot with a synthetic seat, and never reads the stored `seats`. Seatless historical snapshots fold fine.
4. **A session the fold cannot replay contributes nothing.** It is skipped, never guessed, when:
   - it has no snapshot, or the snapshot does not decode (phase 3's `snapshotOf` rule)
   - the fold row count differs from `v_stats_session_facts.dart_count`, because a dart without coordinates would shift every later aim
   - the reducer throws (a dart after a terminal state)

   Skips are counted in the result as `skippedSessions`, so a card can say "N sessions could not be replayed" rather than hiding them.
5. **`requires` gains OR; the site is resolved per game.**
   - A requirement is `StatsTag | { anyOf: readonly StatsTag[] }`, and all requirements must hold. The four widened sections require `{ anyOf: ["intent-stored", "intent-derived"] }` (+ `board` where phase 2 had it).
   - `SectionMeta.siteByTag: Partial<Record<StatsTag, ComputeSite>>` overrides `computeSite` when the game has that tag. The widened sections set `{ "intent-derived": "server" }`.
   - `sectionSite(meta, gameTypeKey)` is the one resolver. The service picks its handler by it, and the client picks chunking by it.
6. **Grouping stays stored-only; Singles drops it.** A whole-number aim has no aim point: a spread around the wedge measures ring choice, not skill. The catalog's Singles row loses `grouping`.
7. **Miss direction for whole-number and bull aims.**
   - `NUMBER:n`: the reference is the nearest point of the number's wedge (angles from `SECTOR_ORDER`, radius from `outerBull` to `doubleOuter`). A new `wedgeNearestPoint(n, point)` in `board-geometry.module.ts` holds it. Radial class: `INSIDE` below `outerBull`, `OUTSIDE` at or beyond `doubleOuter`, else `WITHIN`.
   - `BULL:25`: the reference is the centre, with the band `0` to `outerBull`.
   - Stored-zone aims (`OUTER_SINGLE:n`) use phase 2's `missReferences` row.
   - The bearing is phase 2's `missSector`, so the output is phase 2's `MissSectorRow` shape, and the SQL path and TS path share one contract.
8. **Loose darts for the new aim zones** (constants in `loose-darts.module.ts`; changing them bumps `version`):
   - `NUMBER:n`: on = `isAimHit`; near = any ring of a neighbouring number (`SECTOR_ORDER`); loose = anything else, bull and `MISS` included.
   - `BULL:25`: on = either bull ring; near = `INNER_SINGLE` of any number; loose = anything else.
   - Stored zones keep phase 2's rule.
9. **Per-ring accuracy is read from `confusion`.** Catalog §2 asks for Singles "per ring" and Shanghai "per number and ring". Under a `NUMBER:n` aim, `confusion` already counts `INNER_SINGLE:n`, `OUTER_SINGLE:n`, `DOUBLE:n` and `TREBLE:n`, so the ring split is a client getter. There is no extra metric, and no trend (confusion is not bucketable).
10. **Game-specific sections are gated by game.** `SectionMeta.games?: readonly GameTypeKey[]` narrows a section to named games on top of its tags.
11. **Page order may be overridden per game.** `PAGE_ORDER_OVERRIDES: Partial<Record<GameTypeKey, readonly SectionId[]>>` holds Shanghai only, where catalog §2 puts `session-result` right after `shanghai-count`. A test asserts every override is a permutation of the tag-derived set, so an override can reorder but never add or drop a section.
12. **`shanghai-count` moves from site `sql` to `server`.** A Shanghai is S+D+T of the *active* number in one visit, and the active number is a fold. A SQL pattern over three darts would put a game rule in SQL and count S+D+T of the wrong number. It is the engine's `SHANGHAI` seat status, read from the same fold.
    - Metrics: `{ sessions, shanghais, byRound: Record<round, count> }`.
    - Versions pool: V2's Hard mode changes scoring, not the Shanghai rule.
13. **Game-specific metrics are grouped by config.** `configGroupKey(fields, session)` builds a stable key from `ruleset_version_key` plus the named snapshot fields, in declared order (`AROUND_THE_CLOCK_V2|difficulty=HARD|segment_rule=OUTER_SINGLE`). Configs that change difficulty are never blended (catalog §2.2).
    - `atc-darts-per-target`: `configSensitive: ["ruleset_version_key", "difficulty", "segment_rule"]`.
    - `bobs27-survival`: `configSensitive: ["ruleset_version_key", "start_score", "miss_penalty_multiplier", "bull_hit_value"]`.

    If phase 3 built a grouping for `ladder-progress`, extend that one into `configGroupKey`. That extraction is required work, not discovered work.
14. **`atc-darts-per-target`:** a dart counts against the aim before it. A target is *cleared* when the fold moves past it (next index, a lap or `COMPLETE`); a V2 step back is not a clear.
    - Metrics per group and aim: `{ darts, cleared }`. Darts per target = `darts / cleared`, and the slowest targets are sorted by it client-side.
    - Darts on a target never cleared stay in `darts`: they are the true cost of that target.
15. **`bobs27-survival`** (all additive, per config group):
    - `runs`, `completed` (seat `WON`)
    - `reached: Record<TargetKey, runs>`: runs that threw at the target
    - `died: Record<TargetKey, runs>`: the target whose visit resolved at or below zero (seat `LOST`)
    - `scoreAfter: Record<TargetKey, { runs, sum, min, max }>`: the score once that target's visit resolved

    The survival curve is `reached`, and the average running score is `sum / runs`. A single session's own curve is the replay's job (phase 5).
16. **Bounds, status and context follow phase 3.** Server sections check `MAX_FOLD_DARTS` first and are fetched in month chunks. Only `status=completed` is accepted. The `target` parameter stays limited to `heatmap` on `intent-stored` games: a derived heatmap filter would need the fold for a SQL-site section.

## Global Constraints

- TDD: write the failing test, run it, watch it fail, then implement (`app/CLAUDE.md` §Test-Driven Development).
- `cd app && npm test` runs the whole suite. Finish every task with the full suite.
- No migration is planned. Task 5 Step 4 measures the query plans. If it fails, add migration `0044` (+ verification + spec update) as its own task first, never by editing `0001`–`0043`.
- Reads go through views only: `vStatsDartFacts`, `vStatsSessionFacts`.
- No game rules in SQL. Active target, hit rule, Shanghai, clears and Bob's 27 score all stay in TS.
- Engine refactors (`activeTargetOf`) leave every existing engine test unedited and green.
- Phase 2 stored-intent results must not move: its section tests stay unedited and green, and `version` stays `1`.
- NUMERIC arrives as a string: wrap every sum in `Number(nonNull(…))`.
- JSDoc only (`check-no-inline-comments.sh`). Exported types go in the barrels (`check-type-barrels.sh`). No `x-init`.
- `npm run format` before every commit.
- Branch: `feat/statistics-derived-intent-sections` from `main` after phase 3 has merged.
- Anything noticed that this plan does not ask for → GitHub issue via `capturing-discovered-work`, never fixed in the same pass.

## File map

| Action | Path | Responsibility |
| ------ | ---- | -------------- |
| Modify | `app/src/lib/stats/types.ts`, `section-registry.ts` | `Requirement`, `siteByTag`, `games`, `sectionSite`, overrides, three ids |
| Modify | `app/src/lib/stats/target-key.ts` | `NUMBER`/`BULL` aim zones, `isAimHit` |
| Create | `app/src/lib/stats/config-group.ts` | `configGroupKey` |
| Modify | `app/src/lib/game/board/board-geometry.module.ts` | `wedgeNearestPoint` |
| Modify | `app/src/modules/game/{singles-training,shanghai,around-the-clock}.engine.module.ts` | export `activeTargetOf` |
| Modify | `app/src/modules/game/seat-state.module.ts` | `foldSeatSteps` |
| Create | `app/src/modules/stats/derived-aims.module.ts` | rows → sessions → aimed darts |
| Modify | `app/src/modules/stats/sections/{intent-cells,loose-darts,miss-direction}.module.ts` | new aim zones; TS miss rows |
| Create | `app/src/modules/stats/sections/{shanghai-count,atc-darts-per-target,bobs27-survival}.module.ts` | fold → metrics |
| Modify | `app/src/pages/api/statistics/types.ts` | three metric schemas, `skippedSessions` |
| Modify | `app/src/repositories/statistics.repository.ts`, `app/src/modules/types.ts` | `findDartFoldRows` |
| Modify | `app/src/services/statistics.service.ts` | site-resolved handlers, derived load |
| Modify | `app/src/lib/stats/merge-metrics.ts`, `app/src/stores/game-stats.store.ts`, `app/src/pages/statistics/index.astro` | merges, getters, cards |
| Tests | mirror each path under `app/tests/` | |
| Docs | Task 10 list | |

---

### Task 1: Registry: OR requirements, per-game site, game gate, page order

**Files:**
- Modify: `app/src/lib/stats/types.ts`, `app/src/lib/stats/section-registry.ts`
- Test: `app/tests/lib/stats/section-registry.test.ts` (extend)

**Interfaces:**
- `type Requirement = StatsTag | { anyOf: readonly StatsTag[] }`; `SectionMeta.requires: readonly Requirement[]`.
- `SectionMeta.siteByTag?: Partial<Record<StatsTag, ComputeSite>>`, `SectionMeta.games?: readonly GameTypeKey[]`.
- `sectionSite(meta, gameTypeKey): ComputeSite`: the first `siteByTag` entry whose tag the game has, else `computeSite`.
- `PAGE_ORDER_OVERRIDES` (decision 11); `sectionsForGame` applies it after the tag filter.
- `SectionId` gains `"atc-darts-per-target" | "bobs27-survival" | "shanghai-count"`.

- [ ] **Step 1: Failing tests.**
  - Widened entries (`version` stays `1`):

    | id | requires | siteByTag |
    | -- | -------- | --------- |
    | `target-accuracy` | `[{anyOf: [intent-stored, intent-derived]}]` | `{intent-derived: server}` |
    | `confusion` | same | same |
    | `miss-direction` | `[board, {anyOf: …}]` | same |
    | `loose-darts` | `[board, {anyOf: …}]` | same |
    | `grouping` | unchanged `[board, intent-stored]` | none |

  - New entries, all `computeSite: "server"`, `includesAbandoned: false`, `params: []`, `version: 1`:

    | id | requires | games | bucketable | configSensitive |
    | -- | -------- | ----- | ---------- | --------------- |
    | `atc-darts-per-target` | `[intent-derived]` | `[AROUND_THE_CLOCK]` | true | decision 13 |
    | `bobs27-survival` | `[intent-stored]` | `[BOBS27]` | true | decision 13 |
    | `shanghai-count` | `[intent-derived]` | `[SHANGHAI]` | true | `[]` |

  - Page order (catalog §2, decision 6):
    - `SINGLES_TRAINING`: `target-accuracy, confusion, miss-direction, loose-darts, heatmap, session-result, completion, volume`.
    - `SHANGHAI`: `target-accuracy, shanghai-count, session-result, confusion, miss-direction, loose-darts, heatmap, completion, volume`.
    - `AROUND_THE_CLOCK`: `atc-darts-per-target, target-accuracy, confusion, miss-direction, loose-darts, heatmap, session-result, completion, volume`.
    - `BOBS27`: `target-accuracy, bobs27-survival, confusion, grouping, miss-direction, loose-darts, heatmap, session-result, completion, volume`.
    - `DOUBLES_TRAINING`, `501`, `ONE_TWENTY_ONE`, `TUOD`, `SCORE_TRAINING`: phase 3's lists, unchanged.
  - `sectionSite(SECTIONS["target-accuracy"], "SHANGHAI")` is `server`; for `DOUBLES_TRAINING` it is `sql`.
  - Every override is a permutation of the tag-derived set for its game.

- [ ] **Step 2: Implement.** Declaration order: `scoring-trend, ladder-progress, checkout-rate, double-performance, checkout-path, bust-rate, leg-stats, treble-rate, atc-darts-per-target, target-accuracy, bobs27-survival, shanghai-count, confusion, grouping, miss-direction, loose-darts, heatmap, session-result, completion, volume`. Update the `SECTIONS` JSDoc: declaration order is page order unless `PAGE_ORDER_OVERRIDES` names the game.

- [ ] **Step 3:** Green, full suite. Commit: `feat(stats): OR requirements, per-game site and derived section entries`

---

### Task 2: Aim keys and contracts

**Files:**
- Modify: `app/src/lib/stats/target-key.ts`, `app/src/pages/api/statistics/types.ts`
- Create: `app/src/lib/stats/config-group.ts`
- Tests: `app/tests/lib/stats/target-key.test.ts`, `config-group.test.ts`, `app/tests/pages/api/statistics/types.test.ts` (extend)

**Interfaces:**
- `IntentZoneKey` gains `"NUMBER" | "BULL"`. `parseTargetKey` accepts `NUMBER:1..20` and `BULL:25` only.
- `isAimHit(aim: { number; zone }, hit: { number: number | null; zone: DartZoneKey }): boolean` (decision 2).
- `configGroupKey(fields: readonly string[], session: { rulesetVersionKey: string; configuration: Record<string, unknown> | null }): string` (decision 13). A missing field renders as `field=`, never throws.
- Metric schemas (additive; `TargetRecord`, `ValueRecord` from phases 2–3):

```ts
const GroupRecord = <T extends z.ZodTypeAny>(inner: T) => z.record(z.string(), inner);
const AtcDartsPerTargetMetrics = GroupRecord(TargetRecord(z.object({ darts: z.number().int(), cleared: z.number().int() })));
const Bobs27SurvivalMetrics = GroupRecord(z.object({
  runs: z.number().int(), completed: z.number().int(),
  reached: TargetRecord(z.number().int()),
  died: TargetRecord(z.number().int()),
  scoreAfter: TargetRecord(z.object({ runs: z.number().int(), sum: z.number().int(), min: z.number().int(), max: z.number().int() })),
}));
const ShanghaiCountMetrics = z.object({
  sessions: z.number().int(), shanghais: z.number().int(),
  byRound: ValueRecord(z.number().int()),
});
```

- Every server-site `Series` response gains `skippedSessions: z.number().int()` (decision 4). It is optional in the schema so phase 3 results stay valid.

- [ ] **Step 1: Failing tests.**
  - `parseTargetKey` accepts `NUMBER:20` and `BULL:25`; it rejects `NUMBER:25`, `BULL:20` and `NUMBER:0`.
  - `isAimHit`:
    - `NUMBER:20` vs `TREBLE:20` is true; vs `OUTER_SINGLE:1` false; vs `MISS` false.
    - `BULL:25` vs `OUTER_BULL:25` is true.
    - `DOUBLE:16` vs `DOUBLE:16` is true; vs `OUTER_SINGLE:16` false.
  - `configGroupKey(["ruleset_version_key", "difficulty"], …)` gives `AROUND_THE_CLOCK_V2|difficulty=HARD`, and `AROUND_THE_CLOCK_V1|difficulty=` for a V1 snapshot.
  - One valid sample of each schema parses.
- [ ] **Step 2: Implement.** Green, full suite. Commit: `feat(stats): derived aim keys, config groups and contracts`

---

### Task 3: Engines expose the active target; one step walker

**Files:**
- Modify: `app/src/modules/game/{singles-training,shanghai,around-the-clock}.engine.module.ts`, `app/src/modules/game/seat-state.module.ts`
- Tests: the three engine tests and `seat-state.module.test.ts` (extend only)

**Interfaces:**
- `activeTargetOf(state, config): BoardTarget` in each engine:
  - Singles: `targetAt(numbersPath(config.targetOrder), state.targetIndex)`.
  - Shanghai: `targetAt(numbersPath(), state.targetIndex)`. `activeNumberAt` is rewritten on it.
  - Around the Clock: `targetAt(rulesOf(config).path, state.targetIndex)`.

  Each reducer is rewritten to call it. Existing engine tests stay unedited and green.
- `foldSeatSteps<TSeat>(darts: readonly DartObservation[], initial: TSeat, applyDart): { before: TSeat; observation: DartObservation; after: TSeat }[]`. `foldSeatStates` is rewritten to take the last `after` per seat, and its tests stay unedited.

- [ ] **Step 1: Failing tests.**
  - Singles V2 with a High→Low `target_order`: the first `activeTargetOf` is `NUMBER 20`.
  - Around the Clock V2 `HIGH_TO_LOW`, odds first: the first target is `19`.
  - Shanghai after three darts: target `2`.
  - `foldSeatSteps` over three darts returns three steps, and each `after` equals the next `before`.
- [ ] **Step 2: Implement.** Full suite. Commit: `refactor(game): export active target and seat step walker`

---

### Task 4: Derived aims fold

**Files:**
- Create: `app/src/modules/stats/derived-aims.module.ts`
- Test: `app/tests/modules/stats/derived-aims.module.test.ts`

**Interfaces:**
- Input `DartFoldRow` (Task 5): `sessionId, gameTypeKey, rulesetVersionKey, configuration, sessionDartCount, bucketStart, bucketEnd, turnSequence, dartNumber, hitTargetNumber, hitZoneKey, intendedTargetNumber, intendedZoneKey, locationX, locationY`.
- `AimedDart = { aim: TargetKey; hit: boolean; hitNumber: number | null; hitZone: DartZoneKey; x: number; y: number }`.
- `SessionSteps<TSeat> = { sessionId; rulesetVersionKey; configuration; bucketStart; bucketEnd; steps: { before: TSeat; observation: DartObservation; after: TSeat }[] }`.
- `sessionSteps(rows): { sessions: SessionSteps<unknown>[]; skippedSessions: number }`:
  - groups rows by session in first-row order, sorts by `(turnSequence, dartNumber)` (these games play one `EXERCISE_BLOCK` stage)
  - decodes the snapshot with phase 3's `snapshotOf` (export it from `x01-checkout-sessions.module.ts`; no copy)
  - builds a one-seat config (decision 3) and walks `foldSeatSteps` with the game's reducer: `applySinglesTrainingDart`, `applyShanghaiDart` (with the snapshot's difficulty), `applyAroundTheClockDart` (with `rulesOf`) or `applyBobs27Dart`
  - applies the skip rules (decision 4)
- `aimedDarts(session): AimedDart[]` for the three derived games: `aim` from `activeTargetOf(step.before, config)` and decision 1's map; `hit` from `isAimHit`.

- [ ] **Step 1: Failing tests.**
  - A Singles session with random `target_order` `[7, …]` aims its first three darts at `NUMBER:7`.
  - Shanghai: darts 4–6 aim at `NUMBER:2`.
  - Around the Clock V1: a hit on dart 1 moves dart 2's aim from `NUMBER:1` to `NUMBER:2` mid-visit.
  - Around the Clock V2 `OUTER_SINGLE`: the aim is `OUTER_SINGLE:1`, and an inner single on 1 is not a hit.
  - The path end aims at `BULL:25`.
  - `isAimHit` parity with each engine:
    - Singles: the `hitsThisVisit` delta of `applySinglesTrainingDart`
    - Shanghai: `zoneBucketOf(zone) !== null` on the active number
    - Around the Clock: `isClockHit`

    Checked for every ring of the active number, both neighbours, both bulls and `MISS`.
  - Skips (decision 4): a session with `sessionDartCount` one above its rows, a null snapshot, and a dart after `COMPLETE` are each skipped and counted.
- [ ] **Step 2: Implement.** Pure, isomorphic. Green, full suite. Commit: `feat(stats): derived aims fold`

---

### Task 5: Repository: dart fold rows

**Files:**
- Modify: `app/src/repositories/statistics.repository.ts`, `app/src/modules/types.ts`
- Test: `app/tests/repositories/statistics.repository.test.ts` (extend; `render-sql.ts`)

**Interfaces:**
- `findDartFoldRows(db, q: SessionScope & { bucket; tz }): Promise<DartFoldRow[]>`:
  - `vStatsDartFacts` inner-joined to `vStatsSessionFacts` on `session_id`, filtered by phase 3's `sessionScopeWhere`
  - selects the `DartFoldRow` columns; `sessionDartCount` is `v_stats_session_facts.dart_count`
  - bucket bounds from phase 1's whitelisted bucket expressions over `vStatsSessionFacts.completedAt`; `bucket = none` echoes `from`/`to`
  - `ORDER BY session_id, turn_sequence, dart_number`

- [ ] **Step 1: Failing tests** (rendered SQL + fake chain): the reader joins both views, filters `status_key` and `completed_at`, orders by the three columns, and maps `configuration` untouched. `nonNull` throws on a null `turn_sequence`.
- [ ] **Step 2: Implement.**
- [ ] **Step 3:** Green, full suite.
- [ ] **Step 4: Measure** (needs `DATABASE_URL`; without it, ask the owner to run it and paste the plans). Run `EXPLAIN (ANALYZE, BUFFERS)` of `findDartFoldRows` for the heaviest real Around the Clock player over one month.
  - **Pass:** entry through `idx_exercise_sessions_player_game_completed`; no seq scan on `darts` or `turns`.
  - **On fail:** stop, and add migration `0044` as its own task first (+ verification + spec).

  Record the plan summary in the PR body.
- [ ] **Step 5:** Commit: `feat(stats): dart fold reader`

---

### Task 6: Phase 2 modules take derived aims

**Files:**
- Modify: `app/src/lib/game/board/board-geometry.module.ts`, `app/src/modules/stats/sections/{intent-cells,loose-darts,miss-direction}.module.ts`
- Tests: `app/tests/lib/game/board/board-geometry.module.test.ts`, the three section tests (extend only)

**Interfaces:**
- `wedgeNearestPoint(number: number, point: BoardPoint): BoardPoint` (decision 7). Inside the wedge's angles, the point on the dart's own bearing with its radius clamped to `[outerBull, doubleOuter]`; outside them, the projection onto the nearer edge ray, clamped the same way.
- `intent-cells.module.ts`: `isHit(row)` goes through `isAimHit`. `aimCellRows(sessions): IntentCellRow[]` aggregates `aimedDarts` per bucket × aim × hit pair. The `intended_zone_key` column carries `NUMBER`/`BULL`.
- `loose-darts.module.ts`: `classifyLanding` handles `NUMBER` and `BULL` (decision 8).
- `miss-direction.module.ts`:
  - `radialClass(r, rInner, rOuter)` is the TS twin of phase 2's SQL `CASE`
  - `aimMissRows(sessions): MissSectorRow[]` covers the missed aimed darts only, with the reference per decision 7 and the sector from `missSector`

- [ ] **Step 1: Failing tests.**
  - `wedgeNearestPoint(20, …)`:
    - a point on the 20 wedge's centre line off the board clamps to radius `doubleOuter`
    - a point in the 1 wedge projects onto the 20/1 edge
    - a point in the bull clamps to `outerBull`
  - `classifyLanding`:

    | Aim | Landing | Class |
    | --- | ------- | ----- |
    | `NUMBER:20` | `TREBLE:20` | on |
    | `NUMBER:20` | `DOUBLE:5` | near |
    | `NUMBER:20` | `INNER_BULL:25` | loose |
    | `BULL:25` | `INNER_SINGLE:3` | near |
    | `BULL:25` | `TREBLE:20` | loose |

  - `radialClass` agrees with the SQL `CASE` at each boundary (`>=` on `rOuter`).
  - A dart aimed at `NUMBER:20` landing in the 1 wedge is sector 2 or 3, and `WITHIN`.
  - `aimCellRows` fed to phase 2's `targetAccuracyBuckets` gives `NUMBER:20` 2/3 for T20, S20, S1.
  - The phase 2 stored-intent tests stay unedited and green.
- [ ] **Step 2: Implement.** Green, full suite. Commit: `feat(stats): derived aims in accuracy, confusion, miss-direction and loose-darts`

---

### Task 7: Game-specific modules

**Files:**
- Create: `app/src/modules/stats/sections/{shanghai-count,atc-darts-per-target,bobs27-survival}.module.ts`
- Tests: the three matching `*.module.test.ts`

**Interfaces** (pure, `now` injected, `(sessions: SessionSteps[], ctx) => Bucket<M>[]`; `sampleSize` = sessions folded; empty buckets not emitted):
- **shanghai-count** (decision 12): per session `sessions += 1`. When some step's `after.status === "SHANGHAI"`, `shanghais += 1` and `byRound[before.targetIndex + 1] += 1`.
- **atc-darts-per-target** (decision 14): per step, `darts += 1` under the `before` aim. `cleared += 1` when `after` moved past it:
  - `after.targetIndex === before.targetIndex + 1`
  - `after.laps > before.laps`
  - or `after.status === "COMPLETE"`

  Grouped by `configGroupKey`.
- **bobs27-survival** (decision 15): visits resolve on steps where `after.dartsThisVisit.length === 0`. Per resolved visit at target `t`, `reached[t] += 1`, `scoreAfter[t]` adds `after.score`, and `died[t] += 1` if `after.status === "LOST"`. Per session, `runs += 1`, and `completed += 1` on `WON`. The aim key comes from `doublesPath()` at `before.targetIndex` (`DOUBLE:n`, or `INNER_BULL:25` for BULL, matching Bob's 27's stored intent). Grouped by `configGroupKey`.

- [ ] **Step 1: Failing tests.**
  - Shanghai: a session with S3, D3, T3 in round 3 gives `{ sessions: 1, shanghais: 1, byRound: { "3": 1 } }`; a session ending `COMPLETE` gives `shanghais: 0`.
  - Around the Clock:
    - V1: 1 hit on dart 2 gives `NUMBER:1` `{ darts: 2, cleared: 1 }`.
    - V2 Hard: a failed visit on 3 steps back, so `NUMBER:3` gets 3 darts and 0 clears.
    - Timed: a lap on BULL counts a clear.
    - V1 and V2 sessions land in different group keys.
  - Bob's 27:
    - A run lost on D4 gives `died: { "DOUBLE:4": 1 }`, `reached` D1–D4, and `completed: 0`.
    - A won run reaches `INNER_BULL:25`.
    - `scoreAfter` min/max across two runs.
    - Different `start_score` → different groups.
- [ ] **Step 2: Implement.** Green, full suite. Commit: `feat(stats): shanghai-count, atc-darts-per-target and bobs27-survival modules`

---

### Task 8: Service dispatch

**Files:**
- Modify: `app/src/services/statistics.service.ts`
- Test: `app/tests/services/statistics.service.test.ts` (extend)

**Change:**
- `HANDLERS: Record<SectionId, Partial<Record<ComputeSite, SectionHandler>>>`, looked up by `sectionSite(meta, gameTypeKey)`. Phase 1–3 entries move under their single site.
- One shared `stepsLoad`:
  1. `findScopeDartCount` → above `MAX_FOLD_DARTS`: phase 3's `VALIDATION_FAILED`
  2. `findDartFoldRows`
  3. `sessionSteps` → `{ sessions, skippedSessions }`
- Derived handlers (`server` site of the four widened sections) reuse `stepsLoad`. Their `shape` feeds `aimCellRows` or `aimMissRows` into the phase 2 shape functions.
- The three game-specific handlers reuse `stepsLoad` with their Task 7 module.
- `skippedSessions` is set on every server-site response.

- [ ] **Step 1: Failing tests.**
  - Every `(game, section)` pair from `sectionsForGame`, over all game types, resolves to a handler. This test is exhaustive, so a later section or game cannot miss one.
  - `target-accuracy` on `DOUBLES_TRAINING` calls `findIntentCells`; on `SHANGHAI` it calls `findDartFoldRows`.
  - A scope count of `MAX_FOLD_DARTS + 1` on `AROUND_THE_CLOCK` → `VALIDATION_FAILED`, and `findDartFoldRows` is never called.
  - `grouping` on `SINGLES_TRAINING` → `NOT_FOUND`; `bobs27-survival` on `DOUBLES_TRAINING` → `NOT_FOUND`.
  - `heatmap` + `target=NUMBER:20` on `SHANGHAI` → `VALIDATION_FAILED` (decision 16).
  - The phase 1–3 section tests are still green without edits.
- [ ] **Step 2: Implement.** Green, full suite. Add one route test for `shanghai-count`, then run `npm run validate:app`.
- [ ] **Step 3: Measure the fold** (local, not a test). Time `sessionSteps` + `aimCellRows` over a synthetic Around the Clock log of `MAX_FOLD_DARTS` darts with `performance.now()`, and record it in the PR body. Target: under 50 ms. The walk is linear, so it should be well below phase 3's TUOD case; if not, stop and report.
- [ ] **Step 4:** Commit: `feat(stats): dispatch derived and game-specific sections`

---

### Task 9: Client merge, store and page

**Files:**
- Modify: `app/src/lib/stats/merge-metrics.ts`, `app/src/lib/client/stats-cache/*` (the `readSection` server path), `app/src/stores/game-stats.store.ts`, `app/src/pages/statistics/index.astro`
- Tests: `app/tests/lib/stats/merge-metrics.test.ts`, the cache and store tests (extend)

**Change:**
- `readSection` picks chunking by `sectionSite(meta, gameTypeKey)`, not by `meta.computeSite`.
- `mergeMetrics` gains mergers for every section that can be site `server`:
  - `target-accuracy`, `confusion`, `loose-darts`: sums by key
  - `miss-direction`: merge by `(target, sector, radial)`
  - `shanghai-count`, `atc-darts-per-target`: sums
  - `bobs27-survival`: sums, with `min`/`max` by min and max
  - `skippedSessions`: sum

  The merger table stays exhaustive over the server-capable ids.
- **Store getters:**
  - `ringSplit(aim)` (decision 9): hits under a `NUMBER:n` aim by ring, from `confusion`.
  - `slowestTargets(group, 3)`: `darts / cleared`, among targets with `cleared ≥ 1`.
  - `survivalCurve(group)`: `reached` per target along `doublesPath()`, plus average score `sum / runs`.
  - `shanghaiRate`: `shanghais / sessions` per bucket, plus the round histogram.
  - `pointsPerRound` for Shanghai: phase 1's `session-result` counted score / turn count.
- **Page cards:**

  | Section | Card |
  | ------- | ---- |
  | `atc-darts-per-target` | darts per target along the path, slowest three called out; one tab per config group |
  | `bobs27-survival` | survival curve across D1–BULL, the double where runs die most, average running score; one tab per config group |
  | `shanghai-count` | Shanghai rate trend, rounds where they land |
  | `target-accuracy` (derived) | as phase 2, plus the ring split on Singles and Shanghai |

  Every server card shows "N sessions could not be replayed" when `skippedSessions > 0`. Sparse samples show "not enough data yet" below `MIN_TARGET_SAMPLE`.

- [ ] **Step 1: Load the `dataviz` skill** before any chart code or colour choice. Then read `07-Frontend/10-Frontend-Agent-Guide.md`. Colours come from style tokens (`check-style-tokens.sh`).
- [ ] **Step 2: Verify `pointsPerRound`.** Read what Shanghai's `record` writes to `turns.total_score` under V2 Hard. If the halving is not in the turn total, label the card "before Hard-mode halving" and file a `discovered-work` issue; do not change the engine.
- [ ] **Step 3: Failing tests.**
  - `mergeMetrics` for `miss-direction` merges two chunks with overlapping `(target, sector, radial)` keys.
  - `bobs27-survival` keeps the min of mins.
  - `readSection` for `target-accuracy` on `SHANGHAI` chunks by month; on `DOUBLES_TRAINING` it does not.
  - `ringSplit("NUMBER:20")` reads `TREBLE:20` from confusion.
  - `slowestTargets` ignores uncleared targets.
- [ ] **Step 4: Implement the cache path, then the store, then the page.**
- [ ] **Step 5:** Full suite, `npm run validate:app`, then the full `app/` gate set from `run-all-gates`. Commit: `feat(stats): derived and game-specific cards`

---

### Task 10: Docs, decision, gates

**Files:**
- `decisions/api.md`: **D370** covering decisions 1–16. Confirm the id with `bash scripts/next-decision-id.sh`.
- `docs/architecture/10-Statistics/01-Section-Catalog.md`:
  - §1 table:
    - `target-accuracy`, `confusion`, `miss-direction`, `loose-darts`: requires `intent-stored` OR `intent-derived`; site `sql` / `server` (derived)
    - `loose-darts`: the stored path is `sql` (phase 2)
  - §1.1: the `NUMBER`/`BULL` adjacency (decision 8).
  - §1.2: the aim map (decision 1), the single-seat fold, the skip rules and `skippedSessions`.
  - §2: Singles drops `grouping` (decision 6).
  - §2.1: `shanghai-count` site `server` with the reason (decision 12); the metric definitions of all three sections; their `configSensitive`.
  - Status line: phase 4 sections built.
- `docs/architecture/10-Statistics/00-Overview.md`:
  - §2: `requires` with `anyOf`, and the `siteByTag`, `games` and page-order override fields.
  - §3: the `NUMBER` and `BULL` aim zones.
  - §12: phase 4 is done.
  - Version bump 1.4.0, citing D370.
- `docs/architecture/06-API/04-Endpoint-Contracts.md`: the three section ids with their metric shapes, `skippedSessions`, and per-game site.
- If Task 5 Step 4 added `0044`: the views/spec rationale, and the migration range in `docs/CLAUDE.md`, root `CLAUDE.md` and `database/CLAUDE.md`.

- [ ] **Step 1:** Make the doc edits: minimal diffs, canonical doc first.
- [ ] **Step 2:** Run the `context-maintenance` skill.
- [ ] **Step 3:** Run the `run-all-gates` skill: the Always-run set, the `app/` set and `check-decision-ids.sh` (plus `check-constraint-mirror.sh` if `0044` exists). Report each result. `check-doc-sync.sh` is satisfied by the Step 1 edits, since `modules/game` and `modules/stats` changed.
- [ ] **Step 4:** Commit `docs(stats): phase 4 derived intent sections and D370`, then run `superpowers:finishing-a-development-branch` with `finishing-a-dart-branch` (push + PR).

---

## Out of scope (later phases)

- Replay route and per-session curves (phase 5).
- Routine statistics (phase 6).
- `grouping` for any derived game (decision 6).
- A derived `heatmap` target filter (decision 16).
- Career-wide doubles across Doubles Training, Bob's 27 and X01 (catalog §3).
- A per-session materialized aim cache: only if Task 8 Step 3 or production shows the fold is too slow (`00-Overview.md` §4 escalation).
