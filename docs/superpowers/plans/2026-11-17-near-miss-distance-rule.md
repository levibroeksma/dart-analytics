# Near-miss Distance Rule Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `loose-darts` classifies a missed dart as a near miss when it lands within 20 mm of the aimed bed, for every game that uses the section.

**Architecture:** One pure function, `distanceToAim`, measures a landing point to the aimed bed using the existing geometry. `classifyLanding` takes the landing point and uses it. The stored-aim (SQL) path reads per-dart rows instead of intended-by-hit cell counts; the fold path already carries `x`, `y` per dart. Both feed one `looseDartsBuckets`. The response shape is unchanged.

**Tech Stack:** TypeScript, Vitest, Drizzle (`sql` template for the view read). All paths are under `app/` unless stated.

**Spec:** `docs/superpowers/specs/2026-11-17-near-miss-distance-rule-design.md`

## Global Constraints

- No migration, endpoint, section id, or response field. `LooseDartsMetrics` stays `{ onTarget, nearMiss, loose }`.
- Threshold: `NEAR_MISS_MM = 20`, inclusive (exactly 20.00 mm is a near miss), one constant in `lib/stats/constants.ts`.
- Distance is measured to the nearest point of the bed (`distanceToBed` / `distanceToDisc`), never to its centre. Off-board darts are measured like any other.
- Geometry stays in TypeScript (D368); no distance expression in SQL.
- A hit with no landing point is `onTarget`. A miss with no landing point is in none of the three counts; the bucket's `sampleSize` still counts it, so unmeasured = `sampleSize` minus the sum of the three counts.
- `loose-darts` section `version` goes from 1 to 2.
- No inline comments in function bodies; doc comments say what, not decision history. Types live in `modules/stats/types.ts` and are imported via `@modules/types`.
- Repo gates that bite (per slice experience): a changed runtime `.ts` needs its covering test changed; File Inventory `~Nk` within 20% of chars/4 (use `bash scripts/check-context-budget.sh --update`); `bash scripts/check-dupes.sh` 0 new clones; quality ratchet `mi_average` floor 91.05, `large_functions_src` ceiling 55 (a function over 60 lines counts), so keep functions short and files small.
- Run from `app/`: single file `npx vitest run <path>`; full `npm test`; `npm run validate:app` before the PR; `npm run format` and `npm run format:check`.

## Review Focus

1. **Threshold edge:** 19.99, 20.00 and 20.01 mm for every aim kind (Task 2, Task 3).
2. **Off-board dart just beyond the double** (15 mm out) is a near miss; 40 mm out is loose (Task 3).
3. **Bull aims:** a dart in the inner single within 20 mm of the outer bull is a near miss; `BULL:25` counts either bull ring as on target (Task 2, Task 3).
4. **Missing landing point:** hit stays `onTarget`; miss is uncounted but present in `sampleSize` (Task 3, Task 5).
5. **Neighbouring double beyond 20 mm** is now loose, where the old rule called it a near miss (Task 3).

---

### Task 1: Constants and the landing row type

**Files:**
- Modify: `src/lib/stats/constants.ts`
- Modify: `src/modules/stats/types.ts`
- Test: `tests/lib/stats/constants.test.ts` (add one assertion; create the file if absent)

**Interfaces:**
- Produces: `NEAR_MISS_MM: number` (= 20) and `MAX_LANDING_DARTS: number` (= 50_000, provisional until Task 5 step 5), both exported from `@lib/stats/constants`.
- Produces: `type AimLanding = IntentCellRow & { x: number | null; y: number | null }` exported from `@modules/types`. A landing row is one dart: `darts` is always 1.

- [ ] **Step 1: Write the failing test** asserting `NEAR_MISS_MM === 20` and `MAX_LANDING_DARTS === 50_000`.
- [ ] **Step 2: Run it** — `npx vitest run tests/lib/stats/constants.test.ts` — expect FAIL (missing exports).
- [ ] **Step 3: Add both constants** with one-line doc comments; add `AimLanding` beside `IntentCellRow`.
- [ ] **Step 4: Run it** — expect PASS.
- [ ] **Step 5: Commit** — `feat(stats): near-miss threshold constant and landing row type`.

### Task 2: `distanceToAim`

**Files:**
- Create: `src/lib/game/board/aim-distance.module.ts`
- Test: `tests/lib/game/board/aim-distance.module.test.ts`

**Interfaces:**
- Consumes: `distanceToBed(point: BoardPoint, number: number, rInner: number, rOuter: number): number`, `distanceToDisc(point, rInner, rOuter): number`, `BOARD_RADII_MM` (`lib/game/board/board-geometry.module.ts`); `IntentZoneKey` from `@lib/types`.
- Produces: `distanceToAim(point: BoardPoint, aim: { number: number; zone: IntentZoneKey }): number` — millimetres to the nearest point of the aimed bed, 0 inside it.

Bed table for the signature to honour:

| Aim zone | Measured to |
| -------- | ----------- |
| `DOUBLE` | wedge of `number`, `doubleInner`..`doubleOuter` |
| `TREBLE` | wedge, `trebleInner`..`trebleOuter` |
| `INNER_SINGLE` | wedge, `outerBull`..`trebleInner` |
| `OUTER_SINGLE` | wedge, `trebleOuter`..`doubleInner` |
| `NUMBER` | wedge of `number` across all rings, `0`..`doubleOuter` |
| `INNER_BULL` | disc `0`..`innerBull` |
| `OUTER_BULL` | disc `innerBull`..`outerBull` |
| `BULL` | disc `0`..`outerBull` |

- [ ] **Step 1: Write failing tests.** Names and assertions:
  - `returns 0 for a point inside the aimed double`: point at radius 166 on the bearing of 16 → `0`.
  - `measures radially past the outer edge`: point 15 mm beyond `doubleOuter` on the bearing of 20 → `toBeCloseTo(15, 2)`.
  - `measures to the wedge edge for a neighbouring sector`: point inside the neighbouring double of 20 (the 1 double, radius 166) → equals `distanceToBed` for the 20 double (assert `> 0` and `toBeCloseTo` the same call).
  - `NUMBER aim measures the whole wedge`: point in the treble of 20 → `0` for `{ number: 20, zone: "NUMBER" }`.
  - `BULL aim`: point at radius 25 → `toBeCloseTo(25 - 15.9, 2)`; point at radius 10 → `0`.
  - `INNER_BULL aim`: point at radius 10 → `toBeCloseTo(10 - 6.35, 2)`.
- [ ] **Step 2: Run** — `npx vitest run tests/lib/game/board/aim-distance.module.test.ts` — expect FAIL (module missing).
- [ ] **Step 3: Implement `distanceToAim`** as a lookup of `{ rInner, rOuter }` per zone and a branch between `distanceToDisc` (bull zones) and `distanceToBed` (the rest). Keep it under 30 lines.
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Commit** — `feat(board): distance from a point to an aimed bed`.

### Task 3: Classifier and `looseDartsBuckets`

**Files:**
- Modify: `src/modules/stats/sections/loose-darts.module.ts`
- Modify: `src/modules/stats/sections/intent-cells.module.ts` (`intentCellBuckets` becomes generic over its row type)
- Test: `tests/modules/stats/sections/loose-darts.module.test.ts` (rewrite the adjacency cases to the distance rule)

**Interfaces:**
- Consumes: `distanceToAim` (Task 2), `NEAR_MISS_MM` and `AimLanding` (Task 1), `isAimHit` (`@lib/stats/target-key`).
- Produces: `classifyLanding(aim: { number: number; zone: IntentZoneKey }, hit: { number: number | null; zone: DartZoneKey }, point: { x: number; y: number } | null): "onTarget" | "nearMiss" | "loose" | "unmeasured"`.
  - `onTarget` when `isAimHit(aim, hit)`; this holds with or without a point.
  - `unmeasured` when not a hit and `point === null`.
  - `nearMiss` when `distanceToAim(point, aim) <= NEAR_MISS_MM`, else `loose`.
- Produces: `looseDartsBuckets(rows: readonly AimLanding[], ctx: { to: string; now: Date }): SeriesBucket<LooseDartsMetrics>[]`. `unmeasured` rows add to the bucket `sampleSize` but to none of the three counts.
- Produces: `intentCellBuckets<M, R extends IntentCellRow = IntentCellRow>(rows: readonly R[], ctx, empty: () => M, add: (entry: M, row: R) => void)`.

- [ ] **Step 1: Rewrite the tests.** The old adjacency cases are re-pointed at the same guarantee, not deleted; each keeps its aim and hit and gains a landing point so the expected class follows the new rule:
  - For each aim kind in the spec table, three darts missing by 19.99, 20.00 and 20.01 mm → `nearMiss`, `nearMiss`, `loose`. Build the point with the geometry helpers (a point at the bed's outer edge plus the offset on its bearing).
  - `off-board dart 15 mm beyond the double is a near miss`; `40 mm beyond is loose`.
  - `neighbouring double more than 20 mm from the aimed double is loose` (aim `DOUBLE:20`, hit `DOUBLE:1` at the centre of that bed).
  - `hit with no landing point is onTarget`; `miss with no landing point is unmeasured`.
  - `looseDartsBuckets` case: three rows (hit, near, unmeasured) → counts `{ onTarget: 1, nearMiss: 1, loose: 0 }` and `sampleSize` 3.
- [ ] **Step 2: Run** — `npx vitest run tests/modules/stats/sections/loose-darts.module.test.ts` — expect FAIL.
- [ ] **Step 3: Implement.** Delete `RING_ORDER`, `neighborSectors`, `ringAdjacent`, `classifyNumberAim`, `classifyBullAim`, `nearMissOnStoredBull`, `nearMissOnStoredRing` and `classifyStoredAim`. Write `classifyLanding` per the interface. `looseDartsBuckets` calls `intentCellBuckets` and increments the matching counter; `unmeasured` only contributes to `sampleSize`.
- [ ] **Step 4: Run** — expect PASS; then `npx vitest run tests/modules/stats` to confirm no other section depended on the removed helpers.
- [ ] **Step 5: Commit** — `feat(stats): classify near misses by distance to the aimed bed`.

### Task 4: Fold path carries landing points

**Files:**
- Modify: `src/modules/stats/sections/intent-cells.module.ts` (add `aimLandingRows`)
- Modify: `src/services/statistics.service.ts` (`looseDartsFromSessions` uses it)
- Test: `tests/modules/stats/sections/intent-cells.module.test.ts`, `tests/services/statistics.service.test.ts`

**Interfaces:**
- Consumes: `aimedDarts(session)` (each `AimedDart` has `aim`, `hitNumber`, `hitZone`, `x`, `y`), `parseTargetKey`.
- Produces: `aimLandingRows(sessions: readonly SessionSteps<unknown>[]): AimLanding[]` — one row per aimed dart with `darts: 1`, `x`, `y` from the dart, `intendedTargetNumber`/`intendedZoneKey` from the parsed aim, and the session's `bucketStart`/`bucketEnd`. Darts whose aim fails `parseTargetKey` are skipped as in `aimCellRows`.

- [ ] **Step 1: Write failing tests.** In `intent-cells.module.test.ts`: `aimLandingRows returns one row per dart carrying x and y` (two darts in one session, same aim → two rows, `darts` 1 each). In the service test: a Singles Training server-site `loose-darts` request where one miss lies 10 mm from the aimed number's wedge and another 50 mm away → `nearMiss` 1, `loose` 1.
- [ ] **Step 2: Run both** — expect FAIL.
- [ ] **Step 3: Implement `aimLandingRows`** beside `aimCellRows`; switch `looseDartsFromSessions` to it.
- [ ] **Step 4: Run both** — expect PASS.
- [ ] **Step 5: Commit** — `feat(stats): derived-aim loose darts read landing points`.

### Task 5: Stored path reads per-dart rows

**Files:**
- Modify: `src/repositories/statistics.repository.ts` (add `findIntentLandings`)
- Modify: `src/services/statistics.service.ts` (loader, bound check, `HANDLERS["loose-darts"].sql`)
- Modify: `src/lib/stats/section-registry.ts` (`version: 2` for `loose-darts`)
- Test: `tests/repositories/statistics.repository.test.ts`, `tests/services/statistics.service.test.ts`, `tests/lib/stats/section-registry.test.ts`

**Interfaces:**
- Consumes: `dartScope(ctx)`, `dartScopeWhere`, `bucketWindow`, `mapIntentCellRow`'s column conventions, `MAX_LANDING_DARTS` (Task 1), `looseDartsBuckets` (Task 3).
- Produces: `findIntentLandings(db: Db, q: DartScope & { bucket: Bucket; tz: string | undefined }): Promise<AimLanding[]>` — the same `where` as `findIntentCells` (stored intended number and zone present), selecting per dart: the bucket window columns, `intendedTargetNumber`, `intendedZoneKey`, `hitTargetNumber`, `hitZoneKey`, `locationX`, `locationY`; no `group by`. `locationX`/`locationY` arrive as strings and map to `number | null`; `darts` is 1.
- Produces: the `loose-darts` `sql` handler loads landings, and a request whose scope holds more than `MAX_LANDING_DARTS` darts returns `VALIDATION_FAILED` with a reason naming the cap, reusing `findScopeDartCount(db, sectionScope(ctx))`.

- [ ] **Step 1: Write failing tests.**
  - Repository: `findIntentLandings maps string coordinates to numbers and null to null` (mock rows with `"166.00"` and `null`).
  - Service: stored-aim Doubles Training `loose-darts` request → a dart 15 mm outside the aimed double counts as `nearMiss`; a dart with a null coordinate pair that missed is in `sampleSize` and in none of the counts.
  - Service: a scope above `MAX_LANDING_DARTS` (mock the count at `MAX_LANDING_DARTS + 1`) → `VALIDATION_FAILED` naming the cap; at the cap → served.
  - Registry: `loose-darts` is at `version` 2.
- [ ] **Step 2: Run** — `npx vitest run tests/repositories/statistics.repository.test.ts tests/services/statistics.service.test.ts tests/lib/stats/section-registry.test.ts` — expect FAIL.
- [ ] **Step 3: Implement** the repository function, the loader and bound check (a short function beside `foldBoundReason`), the handler entry, and the version bump.
- [ ] **Step 4: Run** — expect PASS.
- [ ] **Step 5: Measure the cap.** Seed the largest realistic scope (the owner's all-time Doubles Training darts, or a synthetic 50,000-row mock through `findIntentLandings` plus `looseDartsBuckets`), time the shape step, and record the figure in the decision block (Task 6). If it exceeds 50 ms at 50,000, lower `MAX_LANDING_DARTS` until it fits and update the Task 1 assertion.
- [ ] **Step 6: Commit** — `feat(stats): stored-aim loose darts read per-dart landings`.

### Task 6: Decision, docs and gates

**Files:**
- Modify: `decisions/api.md` (append a new block; supersedes D368 decision 9 and D370 decision 8; cite the measured cap)
- Modify: `docs/architecture/10-Statistics/01-Section-Catalog.md` (§1.1 rewritten to the distance rule; the `loose-darts` table row; the 181 row text stays)
- Modify: `docs/architecture/06-API/04-Endpoint-Contracts.md` only if it states the adjacency rule (grep `near` first; the schema lines need no change)
- Modify: `docs/architecture/00-File-Inventory.md` (row for `aim-distance.module.ts` and its test; size claims via `bash scripts/check-context-budget.sh --update`)

- [ ] **Step 1: Append the decision block** in the format of its neighbours: the 20 mm inclusive rule, edge-based distance, no-point handling, version 2, the cap and its measurement. Never edit D368 or D370.
- [ ] **Step 2: Rewrite catalog §1.1** (both tables) to the distance rule; keep section order and numbering.
- [ ] **Step 3: Register the new files** in the File Inventory; run `bash scripts/check-context-budget.sh --update` then without the flag, expect OK.
- [ ] **Step 4: Run every gate** — `bash scripts/check-dupes.sh`, `bash scripts/check-test-coverage.sh`, `cd app && npm run validate:app`, `npm run format`, `npm run format:check`, `cd .. && bash scripts/check-quality-benchmarks.sh` (expect no `regressed:` line; the floor is not to be changed, #1327).
- [ ] **Step 5: Run the `context-maintenance` skill**, then commit — `docs(stats): near-miss distance rule decision and catalog`.
