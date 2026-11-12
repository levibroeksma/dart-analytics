# 501 Inferred-Aim Statistics — Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Serve the 501 statistics page's aim-based numbers: infer each 501 dart's aim from game state plus landing point, and expose five new sections and an aim-filtered heatmap through the existing statistics API.

**Architecture:** A pure candidate generator (`candidatesFor`) and resolver (`resolveAim`) run over the existing X01 checkout fold (`foldLoad` → `BucketedSession`). A walker turns each session into `InferredDart`s; five section modules fold those into flat count records that the existing chunk merger sums. No stored aim: one view migration only adds landing coordinates to the fold's source view.

**Tech Stack:** TypeScript, Vitest, zod, Drizzle (read-only views), PostgreSQL view migration (dbmate).

**Spec:** `docs/superpowers/specs/2026-11-11-x01-inferred-aim-statistics-design.md` — read §3–§7 before any task.

**Out of this plan:** the `/statistics` 501 page UI (cards, store, layout). It is the follow-up plan; this plan ends with every section reachable through `GET /api/statistics/games/…/sections/…`.

## Global Constraints

- Load `app/CLAUDE.md` (TDD procedure, comment rules, `validate:app`) and, for Task 1, `database/CLAUDE.md` plus the "New view / analytics query" context pack.
- Red → green → refactor for every `app/` change. Tests live under `app/tests/`, mirroring `app/src/`. Run one file with `cd app && npm test -- <path>`.
- No `//` or `/* */` comments inside function bodies; doc comments describe the declaration, cite decisions in parentheses.
- Inferred aims are never written. Reads go through `v_*` views.
- Single sources: routes from `checkoutPathFor` / `checkoutPathWithin` (`@modules/game/checkout-path.module`); remaining-before-dart from `checkoutDarts` (`@modules/game/double-attempt.module`); geometry from `@lib/game/board/board-geometry.module`.
- Every metric is additive (`{ hits, attempts }`, never a rate).
- `AMBIGUITY_RATIO = 0.75`. Good leave: `4 ≤ L ≤ 40` and `L % 4 = 0`. Leave rank, best first: `32, 16, 40, 24, 8, 36, 28, 20, 12, 4`.
- Incidental findings become `discovered-work` issues (`capturing-discovered-work`); they are not fixed in this branch.
- This plan has no UI task, so the Design System artifact is not consulted (`syncing-design-system` §11).
- Branch: `claude/game-stats-architecture-de4vok`. Commit after every task.

## Deviations from the spec (spec is amended in Task 12)

1. **One view migration.** `v_x01_checkout_darts` carries no coordinates; Task 1 adds `location_x`, `location_y`. Still no table, column or stored aim.
2. **New sections instead of widening `target-accuracy`, `miss-direction`, `grouping`.** Their metric shapes cannot carry basis, resolution or a wire key. Row 5 becomes `double-accuracy`; row 3 becomes `aim-drift`.
3. **Single aims use a new zone key `SINGLE:n`** (spec §4.2 footnote). `NUMBER:n` keeps its "any ring" meaning.
4. **Skip rule:** a session is skipped when its snapshot is undecodable (existing fold behaviour) or any dart has a null coordinate. The spec's `dart_count` comparison is dropped: the fold view does not filter darts, so a null coordinate is the only way the counts could differ.

## Review Focus

1. **A dart off the board** (zone `MISS`, coordinates outside the double ring) resolves by distance like any other; it never throws and never becomes a hit. → Task 4.
2. **One coordinate-less dart in a session** skips the whole session and raises `skippedSessions` by one; other sessions in the request are unaffected. → Task 5.
3. **Multi-leg and set sessions (`501_V2`)**: remaining restarts per leg, so the first dart of leg 2 is `LARGE_TARGET`, not a finish. → Task 5.
4. **A landing inside a candidate's hit region** (`d1 = 0`) resolves `NEAREST` without dividing by zero. → Task 4.
5. **Chunked requests**: two month chunks merged client-side equal one request over both months, including the `AMBIGUOUS` row. → Task 6.

---

## File Structure

| File | Responsibility |
| ---- | -------------- |
| `database/migrations/0055_x01_checkout_darts_coordinates.sql` | widen the fold view |
| `app/src/lib/stats/target-key.ts`, `app/src/lib/stats/types.ts` | `SINGLE` zone, `WIRE:a-b` key |
| `app/src/lib/game/board/board-geometry.module.ts` | distance to a bed, shared-edge point |
| `app/src/modules/stats/x01-aim-candidates.module.ts` | rules, leave rank, `candidatesFor` |
| `app/src/modules/stats/x01-aim-resolution.module.ts` | hit region, aim point, `resolveAim` |
| `app/src/modules/stats/x01-inferred-darts.module.ts` | session walker → `InferredDart`s |
| `app/src/modules/stats/sections/aim-count.module.ts` | shared key builder + bucket accumulator |
| `app/src/modules/stats/sections/{large-target-accuracy,aim-drift,double-accuracy,double-preference,setup-success}.module.ts` | one section each |
| `app/src/lib/stats/section-registry.ts`, `app/src/lib/stats/merge-metrics.ts`, `app/src/pages/api/statistics/types.ts`, `app/src/services/statistics.service.ts`, `app/src/lib/game/rulesets/capabilities.ts` | tag, registry, contracts, mergers, handlers |

---

### Task 1: Landing coordinates in the X01 fold

**Files:**
- Create: `database/migrations/0055_x01_checkout_darts_coordinates.sql`, `database/verification/0055_x01_checkout_darts_coordinates_checks.sql`
- Modify: `app/src/db/schema.ts` (`vX01CheckoutDarts`), `app/src/modules/stats/types.ts` (`X01CheckoutDartRow`), `app/src/repositories/statistics.repository.ts` (`findX01FoldRows`), `app/src/modules/stats/x01-checkout-sessions.module.ts` (`turnsOf`)
- Modify docs: `docs/architecture/05-Database/03-Migrations.md` (new `## 0055…` entry), `docs/architecture/05-Database/05-Views/00-Overview.md` (view columns), every `0001`–`0054` range in `CLAUDE.md` and `docs/architecture/00-Context-Map.md` → `0055`
- Test: `app/tests/modules/stats/x01-checkout-sessions.module.test.ts`, `app/tests/repositories/statistics.repository.test.ts`

**Interfaces:**
- Produces: `X01CheckoutDartRow.locationX: number | null`, `.locationY: number | null`; every `DartFact` inside `BucketedSession.visits[].darts` carries the stored `locationX`/`locationY` (today both are hard-coded `null`).

- [ ] **Step 1: Failing test** in `x01-checkout-sessions.module.test.ts`:

```ts
it("carries each dart's landing coordinates into the folded visit", () => {
  const rows = [foldRow({ dartNumber: 1, score: 60, locationX: 1.5, locationY: -103 })];
  const [session] = sessionCheckoutVisits(rows, new Map());
  expect(session!.visits[0]!.darts[0]).toMatchObject({ locationX: 1.5, locationY: -103 });
});
```

Use the file's existing row builder; add the two fields to it.

- [ ] **Step 2:** `cd app && npm test -- tests/modules/stats/x01-checkout-sessions.module.test.ts` → FAIL (`locationX` is `null`).
- [ ] **Step 3: Migration.** Follow `0044_replay_view_coordinates.sql`'s form. `migrate:up` recreates `v_x01_checkout_darts` exactly as `0039` defines it, with `d.location_x, d.location_y` appended after `d.score`; keep the view comment. `migrate:down` restores `0039`'s definition. The verification file asserts the two columns exist and the row count for a session is unchanged.
- [ ] **Step 4:** Add the two columns to `vX01CheckoutDarts` in `schema.ts`, select them in `findX01FoldRows` (convert `NUMERIC` strings with `Number`, as the `v_stats_dart_facts` reader at `statistics.repository.ts:484` does), add them to `X01CheckoutDartRow`, and pass them through `turnsOf` instead of `null`. Pin the new columns in `statistics.repository.test.ts` beside the existing `findX01FoldRows` assertions.
- [ ] **Step 5:** `npm test -- tests/modules/stats tests/repositories/statistics.repository.test.ts` → PASS.
- [ ] **Step 6:** Docs listed above. Then `npm run db:status`; if a `DATABASE_URL` exists run `npm run db:migrate && npm run db:drift`. Without one, say so in the completion report.
- [ ] **Step 7: Commit** `feat(db): landing coordinates on v_x01_checkout_darts (0055)`.

---

### Task 2: Aim keys — `SINGLE` zone and `WIRE:a-b`

**Files:**
- Modify: `app/src/lib/stats/types.ts`, `app/src/lib/stats/target-key.ts`
- Test: `app/tests/lib/stats/target-key.test.ts`

**Interfaces:**
- Produces:
  - `IntentZoneKey` gains `"SINGLE"`.
  - `type WireKey = \`WIRE:${number}-${number}\``; `type AimKey = TargetKey | WireKey`.
  - `formatWireKey(a: number, b: number): WireKey` — orders numerically; throws when `a`, `b` are not board-adjacent.
  - `parseWireKey(value: string): readonly [number, number] | null` — `null` unless two board-adjacent numbers written `a < b`.
  - `targetLabel` renders `WIRE:6-10` as `6/10` and `SINGLE:9` as `S9`.

- [ ] **Step 1: Failing tests:**

```ts
it("formats and parses a wire key", () => {
  expect(formatWireKey(10, 6)).toBe("WIRE:6-10");
  expect(formatWireKey(20, 5)).toBe("WIRE:5-20");
  expect(parseWireKey("WIRE:6-10")).toEqual([6, 10]);
  expect(parseWireKey("WIRE:10-6")).toBeNull();
  expect(parseWireKey("WIRE:6-11")).toBeNull();
  expect(() => formatWireKey(6, 11)).toThrow();
});
it("labels the new keys", () => {
  expect(targetLabel("WIRE:6-10")).toBe("6/10");
  expect(targetLabel("SINGLE:9")).toBe("S9");
});
it("parses a single key", () => {
  expect(parseTargetKey("SINGLE:9")).toEqual({ number: 9, zone: "SINGLE" });
});
```

- [ ] **Step 2:** `npm test -- tests/lib/stats/target-key.test.ts` → FAIL.
- [ ] **Step 3:** Implement. Adjacency reads `SECTOR_ORDER` (wraps 5–20). Fix any exhaustive `IntentZoneKey` switch `astro check` then reports.
- [ ] **Step 4:** Test → PASS; `npx astro check` → 0 errors.
- [ ] **Step 5: Commit** `feat(stats): SINGLE zone and WIRE aim keys`.

---

### Task 3: Geometry — distance to a bed, shared-edge point

**Files:**
- Modify: `app/src/lib/game/board/board-geometry.module.ts`
- Test: `app/tests/lib/game/board/board-geometry.module.test.ts`

**Interfaces:**
- Produces:
  - `distanceToBed(point: BoardPoint, number: number, rInner: number, rOuter: number): number` — mm from `point` to the nearest point of the annular sector of `number` between the two radii; `0` inside.
  - `distanceToDisc(point: BoardPoint, rInner: number, rOuter: number): number` — the same for a full ring (bulls).
  - `sharedEdgePoint(a: number, b: number, radius: number): BoardPoint` — the point at `radius` on the edge ray between adjacent sectors `a` and `b`; throws when not adjacent.

- [ ] **Step 1: Failing tests** (20 is centred on bearing 0°, sectors are 18° wide, `y` is negative upward, as `zoneCentroid` returns):

```ts
const T = BOARD_RADII_MM;
it("is 0 inside the bed", () => {
  expect(distanceToBed(zoneCentroid(20, "TREBLE")!, 20, T.trebleInner, T.trebleOuter)).toBe(0);
});
it("measures a purely radial gap", () => {
  expect(distanceToBed({ x: 0, y: -134.5 }, 20, T.trebleInner, T.trebleOuter)).toBeCloseTo(27.5, 5);
});
it("measures an angular gap to the edge ray", () => {
  const r = 103, deg = 18 * (Math.PI / 180);
  const point = { x: r * Math.sin(deg), y: -r * Math.cos(deg) };
  expect(distanceToBed(point, 20, T.trebleInner, T.trebleOuter)).toBeCloseTo(r * Math.sin(9 * Math.PI / 180), 3);
});
it("is symmetric between T20 and T18 from the centre of the 1", () => {
  const p = zoneCentroid(1, "TREBLE")!;
  expect(distanceToBed(p, 20, T.trebleInner, T.trebleOuter))
    .toBeCloseTo(distanceToBed(p, 18, T.trebleInner, T.trebleOuter), 6);
});
it("places the shared edge point between the sectors", () => {
  const p = sharedEdgePoint(20, 1, 134.5);
  expect(Math.hypot(p.x, p.y)).toBeCloseTo(134.5, 6);
  expect(Math.atan2(p.x, -p.y) * 180 / Math.PI).toBeCloseTo(9, 6);
});
it("measures to a disc", () => {
  expect(distanceToDisc({ x: 0, y: -20 }, 0, T.innerBull)).toBeCloseTo(20 - T.innerBull, 6);
});
```

- [ ] **Step 2:** `npm test -- tests/lib/game/board/board-geometry.module.test.ts` → FAIL.
- [ ] **Step 3:** Implement. Algorithm for `distanceToBed`: express `point` in polar form; if its bearing is within ±9° of the sector centre, the answer is the radial gap to `[rInner, rOuter]` (0 inside). Otherwise the nearest point lies on the nearer edge ray segment between the two radii: project `point` onto that ray, clamp the projection to `[rInner, rOuter]`, return the distance. Reuse the module's private `angleDelta` and `pointAtBearing`.
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5: Commit** `feat(board): bed distance and shared-edge point`.

---

### Task 4: Candidates and resolution

**Files:**
- Create: `app/src/modules/stats/x01-aim-candidates.module.ts`, `app/src/modules/stats/x01-aim-resolution.module.ts`
- Modify: `app/src/modules/stats/types.ts` (types below)
- Test: `app/tests/modules/stats/x01-aim-candidates.module.test.ts`, `app/tests/modules/stats/x01-aim-resolution.module.test.ts`

**Interfaces:**
- Consumes: Task 2 keys, Task 3 geometry, `checkoutPathFor`, `checkoutPathWithin`.
- Produces (types in `modules/stats/types.ts`):

```ts
export type AimBasis = "LARGE_TARGET" | "ROUTE" | "SETUP" | "FINISH" | "SPLIT";
export type AimResolution = "SOLE" | "NEAREST" | "AMBIGUOUS";
export type InferredAim =
  | { kind: "TREBLE" | "SINGLE" | "DOUBLE"; number: number; key: TargetKey }
  | { kind: "BULL" | "OUTER_BULL"; key: TargetKey }
  | { kind: "WIRE"; numbers: readonly [number, number]; key: WireKey };
export type AimCandidate = { aim: InferredAim; basis: AimBasis; weight: number };
export type AimContext = { remaining: number; dartsLeft: 1 | 2 | 3; earlierDartsInVisit: readonly DartFact[] };
export type ResolvedAim = { aim: InferredAim | null; basis: AimBasis; resolution: AimResolution };
```

  - `x01-aim-candidates.module.ts`: `LEAVE_RANK: readonly number[]`, `isGoodLeave(leave: number): boolean`, `candidatesFor(ctx: AimContext): readonly AimCandidate[]`.
  - `x01-aim-resolution.module.ts`: `AMBIGUITY_RATIO`, `aimPoint(aim: InferredAim): BoardPoint`, `aimDistance(aim: InferredAim, point: BoardPoint): number`, `isInferredAimHit(aim: InferredAim, hitNumber: number | null, hitZone: DartZoneKey): boolean`, `resolveAim(candidates: readonly AimCandidate[], landing: BoardPoint): ResolvedAim`.

Rules are spec §4.3–§4.5, cases A–E; implement them as written there. Keys: `TREBLE:n`, `SINGLE:n`, `DOUBLE:n`, `INNER_BULL:25`, `OUTER_BULL:25`, `WIRE:a-b`. An `AMBIGUOUS` result carries the nearest candidate's `basis` and `aim: null`.

- [ ] **Step 1: Failing candidate tests.** A helper `keys(r, dartsLeft)` returns `candidatesFor(...)` mapped to `` `${basis}:${aim.key}` ``.

```ts
it.each([
  [501, 3, ["LARGE_TARGET:TREBLE:20", "LARGE_TARGET:TREBLE:19", "LARGE_TARGET:TREBLE:18"]],
  [169, 3, ["LARGE_TARGET:TREBLE:20", "LARGE_TARGET:TREBLE:19", "LARGE_TARGET:TREBLE:18"]],
  [100, 3, ["ROUTE:TREBLE:20"]],
  [81, 3, ["ROUTE:TREBLE:15"]],
  [120, 3, ["ROUTE:TREBLE:20"]],
  [41, 2, ["ROUTE:SINGLE:9"]],
  [41, 1, ["SETUP:SINGLE:9"]],
  [60, 1, ["SETUP:SINGLE:20"]],
  [99, 2, ["SETUP:TREBLE:19"]],
  [36, 1, ["FINISH:DOUBLE:18"]],
  [16, 2, ["FINISH:DOUBLE:8"]],
  [20, 2, ["FINISH:DOUBLE:10"]],
  [28, 3, ["FINISH:DOUBLE:14"]],
  [18, 3, ["FINISH:DOUBLE:9", "SPLIT:SINGLE:2"]],
  [34, 1, ["FINISH:DOUBLE:17", "SPLIT:SINGLE:2"]],
  [22, 2, ["FINISH:DOUBLE:11", "SPLIT:WIRE:6-10"]],
  [14, 2, ["FINISH:DOUBLE:7", "SPLIT:WIRE:6-10"]],
  [6, 3, ["FINISH:DOUBLE:3", "SPLIT:SINGLE:2"]],
  [10, 3, ["FINISH:DOUBLE:5", "SPLIT:SINGLE:2"]],
  [26, 3, ["FINISH:DOUBLE:13", "SPLIT:WIRE:6-10"]],
  [30, 3, ["FINISH:DOUBLE:15", "SPLIT:SINGLE:14"]],
  [38, 3, ["FINISH:DOUBLE:19", "SPLIT:WIRE:6-10"]],
  [39, 3, ["ROUTE:WIRE:7-19"]],
  [42, 3, ["ROUTE:WIRE:6-10"]],
  [46, 3, ["ROUTE:WIRE:6-10"]],
  [48, 3, ["ROUTE:WIRE:8-16"]],
  [23, 3, ["ROUTE:WIRE:7-19"]],
  [35, 3, ["ROUTE:WIRE:3-19"]],
  [43, 3, ["ROUTE:WIRE:3-19"]],
  [50, 3, ["FINISH:INNER_BULL:25", "ROUTE:SINGLE:10"]],
  [50, 1, ["FINISH:INNER_BULL:25", "SETUP:SINGLE:10"]],
  [135, 3, ["ROUTE:OUTER_BULL:25"]],
  [132, 3, ["ROUTE:INNER_BULL:25"]],
])("candidates at %i with %i darts left", (r, dartsLeft, expected) => {
  expect(keys(r, dartsLeft)).toEqual(expected);
});

it.each([51, 52, 53, 54, 55, 56, 57, 58, 59, 60])("never wires %i", (r) => {
  expect(keys(r, 3).some((k) => k.includes("WIRE"))).toBe(false);
});

it("sweeps every state", () => {
  for (let r = 2; r <= 501; r++) for (const dartsLeft of [1, 2, 3] as const) {
    const list = candidatesFor({ remaining: r, dartsLeft, earlierDartsInVisit: [] });
    expect(list.length).toBeGreaterThan(0);
    for (const { aim, weight } of list) {
      expect(weight).toBe(1);
      if (aim.kind === "WIRE") expect(parseWireKey(aim.key)).toEqual(aim.numbers);
      expect(lowestLeaveOnHit(aim, r)).toSatisfy((leave: number) => leave === 0 || leave >= 2);
    }
  }
});

it("ranks leaves", () => {
  expect(LEAVE_RANK).toEqual([32, 16, 40, 24, 8, 36, 28, 20, 12, 4]);
  expect([4, 12, 40].every(isGoodLeave)).toBe(true);
  expect([2, 6, 34, 44, 50].some(isGoodLeave)).toBe(false);
});
```

`lowestLeaveOnHit(aim, r)` is a test helper: `r` minus the largest score a hit on that aim can make (treble `3n`, single `n`, double `2n`, bull 50, outer bull 25, wire `max(a, b)`).

Rows 6, 10, 23, 26, 28, 30, 35, 38, 43 and 51–60 are the spec's unconfirmed output. If the rules as written do not produce one, **stop and report it**; do not change the rules or the expectation.

- [ ] **Step 2:** `npm test -- tests/modules/stats/x01-aim-candidates.module.test.ts` → FAIL (module missing).
- [ ] **Step 3:** Implement `x01-aim-candidates.module.ts`. One private function per case; a `wireMerge(single, remaining)` helper shared by cases B, D and E.
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5: Failing resolution tests.** `at(zone, n)` = `zoneCentroid(n, zone)!`; `polar(deg, r)` builds a point at bearing `deg`. `resolve(r, dartsLeft, point)` = `resolveAim(candidatesFor(...), point)`.

```ts
const MID_TREBLE = (BOARD_RADII_MM.trebleInner + BOARD_RADII_MM.trebleOuter) / 2;
it.each([
  [501, 3, at("TREBLE", 20), "TREBLE:20", "LARGE_TARGET", "NEAREST"],
  [402, 3, at("OUTER_SINGLE", 19), "TREBLE:19", "LARGE_TARGET", "NEAREST"],
  [501, 3, at("OUTER_SINGLE", 5), "TREBLE:20", "LARGE_TARGET", "NEAREST"],
  [496, 2, at("TREBLE", 7), "TREBLE:19", "LARGE_TARGET", "NEAREST"],
  [169, 3, at("TREBLE", 18), "TREBLE:18", "LARGE_TARGET", "NEAREST"],
  [402, 3, polar(10, MID_TREBLE), "TREBLE:20", "LARGE_TARGET", "NEAREST"],
  [18, 3, at("OUTER_SINGLE", 14), "DOUBLE:9", "FINISH", "NEAREST"],
  [18, 3, at("OUTER_SINGLE", 2), "SINGLE:2", "SPLIT", "NEAREST"],
  [18, 3, at("OUTER_SINGLE", 15), "SINGLE:2", "SPLIT", "NEAREST"],
  [18, 3, at("OUTER_SINGLE", 10), "SINGLE:2", "SPLIT", "NEAREST"],
  [34, 1, at("OUTER_SINGLE", 2), "SINGLE:2", "SPLIT", "NEAREST"],
  [22, 2, at("OUTER_SINGLE", 10), "WIRE:6-10", "SPLIT", "NEAREST"],
  [22, 2, at("DOUBLE", 11), "DOUBLE:11", "FINISH", "NEAREST"],
  [14, 2, at("OUTER_SINGLE", 6), "WIRE:6-10", "SPLIT", "NEAREST"],
  [50, 3, { x: 0, y: 0 }, "INNER_BULL:25", "FINISH", "NEAREST"],
  [50, 3, at("OUTER_SINGLE", 10), "SINGLE:10", "ROUTE", "NEAREST"],
  [100, 3, at("TREBLE", 19), "TREBLE:20", "ROUTE", "SOLE"],
  [100, 3, at("DOUBLE", 3), "TREBLE:20", "ROUTE", "SOLE"],
  [39, 3, at("DOUBLE", 20), "WIRE:7-19", "ROUTE", "SOLE"],
])("resolves %i/%i", (r, dartsLeft, point, key, basis, resolution) => {
  const result = resolve(r, dartsLeft, point);
  expect([result.aim?.key, result.basis, result.resolution]).toEqual([key, basis, resolution]);
});

it("marks the centre of the 1 ambiguous", () => {
  expect(resolve(402, 3, at("TREBLE", 1))).toEqual({ aim: null, basis: "LARGE_TARGET", resolution: "AMBIGUOUS" });
  expect(resolve(402, 3, polar(18, 134.5)).resolution).toBe("AMBIGUOUS");
});
it("resolves a dart off the board without a hit", () => {
  const d9 = at("DOUBLE", 9);
  const result = resolve(18, 3, { x: d9.x * (185 / 166), y: d9.y * (185 / 166) });
  expect([result.aim?.key, result.resolution]).toEqual(["DOUBLE:9", "NEAREST"]);
  expect(isInferredAimHit(result.aim!, null, "MISS")).toBe(false);
});
it("judges hits per kind", () => {
  const single = candidatesFor({ remaining: 41, dartsLeft: 2, earlierDartsInVisit: [] })[0]!.aim;
  expect(isInferredAimHit(single, 9, "INNER_SINGLE")).toBe(true);
  expect(isInferredAimHit(single, 9, "OUTER_SINGLE")).toBe(true);
  expect(isInferredAimHit(single, 9, "TREBLE")).toBe(false);
  const wire = candidatesFor({ remaining: 48, dartsLeft: 3, earlierDartsInVisit: [] })[0]!.aim;
  expect(isInferredAimHit(wire, 16, "OUTER_SINGLE")).toBe(true);
  expect(isInferredAimHit(wire, 8, "INNER_SINGLE")).toBe(true);
  expect(isInferredAimHit(wire, 7, "OUTER_SINGLE")).toBe(false);
});
it("puts aim points where the spec says", () => {
  expect(aimPoint(candidatesFor({ remaining: 41, dartsLeft: 2, earlierDartsInVisit: [] })[0]!.aim))
    .toEqual(zoneCentroid(9, "OUTER_SINGLE"));
  const wirePoint = aimPoint(candidatesFor({ remaining: 48, dartsLeft: 3, earlierDartsInVisit: [] })[0]!.aim);
  expect(Math.hypot(wirePoint.x, wirePoint.y))
    .toBeCloseTo((BOARD_RADII_MM.trebleOuter + BOARD_RADII_MM.doubleInner) / 2, 6);
});
```

- [ ] **Step 6:** `npm test -- tests/modules/stats/x01-aim-resolution.module.test.ts` → FAIL.
- [ ] **Step 7:** Implement `x01-aim-resolution.module.ts`. Hit regions: treble band `[trebleInner, trebleOuter]`; double band `[doubleInner, doubleOuter]`; single = the minimum over the inner band `[outerBull, trebleInner]` and outer band `[trebleOuter, doubleInner]`; wire = the minimum over both numbers' single bands; bull `[0, innerBull]`; outer bull `[innerBull, outerBull]`. `resolveAim` follows spec §4.5 steps 1–4; with `d1 = 0` the dart is `NEAREST`. If the calibration tests fail, adjust nothing but `AMBIGUITY_RATIO`, and report the value.
- [ ] **Step 8:** Both test files → PASS.
- [ ] **Step 9: Commit** `feat(stats): 501 aim candidates and resolution`.

---

### Task 5: Session walker

**Files:**
- Create: `app/src/modules/stats/x01-inferred-darts.module.ts`
- Modify: `app/src/modules/stats/types.ts`
- Test: `app/tests/modules/stats/x01-inferred-darts.module.test.ts`

**Interfaces:**
- Consumes: `BucketedSession`, `checkoutDarts`, `resolveCheckoutAttempt` (`@modules/game/checkout-bust.module`, as `bust-rate.module.ts` calls it), Task 4.
- Produces:

```ts
export type InferredDart = {
  remaining: number; dartNumber: 1 | 2 | 3;
  basis: AimBasis; resolution: AimResolution; aim: InferredAim | null;
  hit: boolean; hitNumber: number | null; hitZone: DartZoneKey;
  x: number; y: number; score: number;
  candidateKeys: readonly AimKey[];
};
export type InferredVisit = {
  startingRemaining: number;
  outcome: "FINISHED" | "BUST" | "OPEN";
  remainingAfter: number;
  darts: readonly InferredDart[];
};
export type InferredSession = { sessionId: string; bucketStart: string; bucketEnd: string; visits: readonly InferredVisit[] };
export function inferredSessions(sessions: readonly BucketedSession[]): { sessions: InferredSession[]; skippedSessions: number };
```

`hit` is `false` when `aim` is `null`. `remainingAfter` equals `startingRemaining` for a `BUST`. `skippedSessions` counts sessions with `undecodable === true` plus sessions holding any dart with a null coordinate; neither kind appears in `sessions`.

- [ ] **Step 1: Failing tests** (build `BucketedSession`s by hand; `dart(zone, n, score)` sets coordinates to the bed centroid):

```ts
it("walks a visit, recomputing remaining and darts left per dart", () => {
  const { sessions } = inferredSessions([session([visit(40, [dart("OUTER_SINGLE", 20, 20), dart("DOUBLE", 10, 20)])])]);
  const [first, second] = sessions[0]!.visits[0]!.darts;
  expect([first!.remaining, first!.dartNumber, first!.aim?.key, first!.hit]).toEqual([40, 1, "DOUBLE:20", false]);
  expect([second!.remaining, second!.dartNumber, second!.aim?.key, second!.hit]).toEqual([20, 2, "DOUBLE:10", true]);
  expect(sessions[0]!.visits[0]).toMatchObject({ outcome: "FINISHED", remainingAfter: 0 });
});
it("resolves the busting dart and restores the remaining", () => {
  const { sessions } = inferredSessions([session([visit(16, [dart("OUTER_SINGLE", 16, 16)])])]);
  expect(sessions[0]!.visits[0]).toMatchObject({ outcome: "BUST", remainingAfter: 16 });
  expect(sessions[0]!.visits[0]!.darts[0]!.aim?.key).toBe("DOUBLE:8");
});
it("restarts at the leg's own starting remaining", () => {
  const { sessions } = inferredSessions([session([
    visit(40, [dart("DOUBLE", 20, 40)], "leg-1"),
    visit(501, [dart("TREBLE", 20, 60)], "leg-2"),
  ])]);
  expect(sessions[0]!.visits[1]!.darts[0]!.basis).toBe("LARGE_TARGET");
});
it("skips a session holding a dart without coordinates, and only that session", () => {
  const broken = session([visit(501, [{ ...dart("TREBLE", 20, 60), locationX: null }])], "s-broken");
  const fine = session([visit(501, [dart("TREBLE", 20, 60)])], "s-fine");
  const result = inferredSessions([broken, fine]);
  expect(result.skippedSessions).toBe(1);
  expect(result.sessions.map((s) => s.sessionId)).toEqual(["s-fine"]);
});
it("counts an undecodable session as skipped", () => {
  expect(inferredSessions([{ ...session([]), undecodable: true }])).toEqual({ sessions: [], skippedSessions: 1 });
});
it("records every candidate key on the dart", () => {
  const { sessions } = inferredSessions([session([visit(18, [dart("OUTER_SINGLE", 2, 2)])])]);
  expect(sessions[0]!.visits[0]!.darts[0]!.candidateKeys).toEqual(["DOUBLE:9", "SINGLE:2"]);
});
```

- [ ] **Step 2:** `npm test -- tests/modules/stats/x01-inferred-darts.module.test.ts` → FAIL.
- [ ] **Step 3:** Implement. `dartsLeft = 4 − dartNumber` where `dartNumber` is the dart's 1-based index in the visit.
- [ ] **Step 4:** Test → PASS.
- [ ] **Step 5: Commit** `feat(stats): walk 501 sessions into inferred darts`.

---

### Task 6: Tag, plumbing and `large-target-accuracy`

**Files:**
- Create: `app/src/modules/stats/sections/aim-count.module.ts`, `app/src/modules/stats/sections/large-target-accuracy.module.ts`
- Modify: `app/src/lib/game/rulesets/types.ts` (`StatsTag`), `app/src/lib/game/rulesets/capabilities.ts` (`STATS_TAGS`), `app/src/lib/stats/types.ts` (`SectionId`, `ServerSectionId`, `ServerSectionMetrics`), `app/src/lib/stats/section-registry.ts`, `app/src/lib/stats/merge-metrics.ts`, `app/src/modules/stats/types.ts`, `app/src/pages/api/statistics/types.ts`, `app/src/services/statistics.service.ts`
- Test: `app/tests/modules/stats/sections/large-target-accuracy.module.test.ts`, `app/tests/lib/stats/section-registry.test.ts`, `app/tests/lib/stats/merge-metrics.test.ts`, `app/tests/services/statistics.service.test.ts`

**Interfaces:**
- Consumes: `inferredSessions`, `bucketFor`, `closeBuckets` (`./series.module`).
- Produces:
  - `StatsTag` gains `"intent-inferred"`; `STATS_TAGS["501_V1"]` and `["501_V2"]` gain it.
  - `type AimCountMetrics = Record<string, Record<string, number>>` (`modules/stats/types.ts`) — the metrics shape of all five new sections.
  - `aim-count.module.ts`:
    - `AMBIGUOUS_KEY = "AMBIGUOUS"`; an ambiguous dart adds `{ darts: 1 }` under it.
    - `aimKey(...parts: readonly (string | number)[]): string` — joins with `|`.
    - `aimCountBuckets(sessions: readonly InferredSession[], ctx: { to: string; now: Date }, fold: (metrics: AimCountMetrics, session: InferredSession) => void): SeriesBucket<AimCountMetrics>[]` — one accumulator per bucket; `sampleSize` = the sum of every `darts`/`attempts`/`n` value the section names as its sample (pass it back from `fold` by returning the count); empty buckets dropped.
    - `addCounts(metrics: AimCountMetrics, key: string, counts: Record<string, number>): void`.
  - `largeTargetAccuracyBuckets(sessions: readonly InferredSession[], ctx: { to: string; now: Date }): SeriesBucket<AimCountMetrics>[]`.
  - Service: `aimHandler(shape)` — a `SectionHandler` whose `load` is `foldLoad` → `inferredSessions`, returning `skippedSessions` from `inferredSessions`.
  - Registry entry (the template for Tasks 7–10): `{ id, version: 1, requires: ["intent-inferred"], games: ["501"], computeSite: "server", bucketable: true, includesAbandoned: false, configSensitive: [], params: [] }`.
  - Zod: `AimCountMetrics = z.record(z.string(), z.record(z.string(), z.number()))` and one `…SeriesResponse` per section, following `DoublePerformanceSeriesResponse`.
  - `MERGERS[<each new id>] = mergeCountRecord`.

**`large-target-accuracy` metrics.** Darts with `basis === "LARGE_TARGET"`. Key `aimKey(aim.key, resolution)`; leaf `{ darts, trebles, singles, neighbourLeft, neighbourRight, other }`, exactly one of the last five incremented per dart:

| Landing | Field |
| ------- | ----- |
| `TREBLE` of the aim number | `trebles` |
| either single ring of the aim number | `singles` |
| any ring of the previous number in `SECTOR_ORDER` (for 20: 5) | `neighbourLeft` |
| any ring of the next number in `SECTOR_ORDER` (for 20: 1) | `neighbourRight` |
| anything else (its double, a bull, `MISS`, any other number) | `other` |

Ambiguous darts go to `AMBIGUOUS_KEY`. `sampleSize` = resolved darts.

- [ ] **Step 1: Failing section test:**

```ts
it("counts large-target darts per aim and resolution", () => {
  const sessions = inferred([visit(501, [
    dart("TREBLE", 20, 60), dart("OUTER_SINGLE", 5, 5), dart("TREBLE", 1, 3),
  ]), visit(433, [dart("OUTER_SINGLE", 19, 19), dart("TREBLE", 19, 57), dart("DOUBLE", 20, 40)])]);
  const [bucket] = largeTargetAccuracyBuckets(sessions, CTX);
  expect(bucket!.metrics).toEqual({
    "TREBLE:20|NEAREST": { darts: 3, trebles: 1, singles: 0, neighbourLeft: 1, neighbourRight: 0, other: 1 },
    "TREBLE:19|NEAREST": { darts: 2, trebles: 1, singles: 1, neighbourLeft: 0, neighbourRight: 0, other: 0 },
    AMBIGUOUS: { darts: 1 },
  });
  expect(bucket!.sampleSize).toBe(5);
});
it("ignores darts on any other basis", () => {
  expect(largeTargetAccuracyBuckets(inferred([visit(100, [dart("TREBLE", 20, 60)])]), CTX)).toEqual([]);
});
```

`inferred(visits)` = `inferredSessions([session(visits)]).sessions` (reuse Task 5's builders through a shared `app/tests/modules/stats/support/x01-inferred-fixtures.ts`).

- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement `aim-count.module.ts` and the section module.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5: Failing plumbing tests:**

```ts
// section-registry.test.ts
it("offers the inferred-aim section on 501 only", () => {
  expect(sectionsForGame("501")).toContain("large-target-accuracy");
  expect(sectionsForGame("ONE_TWENTY_ONE")).not.toContain("large-target-accuracy");
  expect(sectionSite(SECTIONS["large-target-accuracy"], "501")).toBe("server");
});
// merge-metrics.test.ts
it("merges two chunks of an aim-count section, AMBIGUOUS row included", () => {
  const a = { "TREBLE:20|NEAREST": { darts: 2, trebles: 1 }, AMBIGUOUS: { darts: 1 } };
  const b = { "TREBLE:20|NEAREST": { darts: 3, trebles: 0 }, AMBIGUOUS: { darts: 2 } };
  expect(mergeMetrics("large-target-accuracy", a, b)).toEqual({
    "TREBLE:20|NEAREST": { darts: 5, trebles: 1 }, AMBIGUOUS: { darts: 3 },
  });
});
```

In `statistics.service.test.ts`, following its existing `double-performance` case: a 501 request for `large-target-accuracy` returns buckets and a `skippedSessions` count that includes a session whose fold rows hold a null `locationX`; and the existing registry-coverage test (every `sectionsForGame` pair resolves a handler) passes with the new id.

- [ ] **Step 6:** Run the three files → FAIL.
- [ ] **Step 7:** Implement tag, registry entry, types, zod, merger, `aimHandler`, `HANDLERS` entry. The API route's section-id schema gains the id wherever `double-performance` is listed.
- [ ] **Step 8:** `npm test` → PASS; `npx astro check` → 0 errors, 0 warnings, 0 hints.
- [ ] **Step 9: Commit** `feat(stats): intent-inferred tag and large-target-accuracy section`.

---

### Task 7: `aim-drift`

**Files:**
- Create: `app/src/modules/stats/sections/aim-drift.module.ts`
- Modify: registry, types, zod, mergers, handlers (as Task 6 Step 7)
- Test: `app/tests/modules/stats/sections/aim-drift.module.test.ts`

**Interfaces:**
- Produces: `aimDriftBuckets(sessions, ctx): SeriesBucket<AimCountMetrics>[]`. Every resolved dart, hits included. Key `aimKey(basis, aim.key, dartNumber, resolution)`; leaf `{ n, sumDx, sumDy, sumDxDx, sumDyDy, sumDxDy }` with `(dx, dy) = (x, y) − aimPoint(aim)` in mm. Ambiguous darts → `AMBIGUOUS_KEY`. `sampleSize` = Σ `n`.

- [ ] **Step 1: Failing test:**

```ts
it("accumulates offset moments per basis, aim, dart number and resolution", () => {
  const centre = zoneCentroid(20, "TREBLE")!;
  const sessions = inferred([visit(501, [
    at(centre.x - 4, centre.y + 3, "TREBLE", 20, 60),
    at(centre.x - 2, centre.y, "TREBLE", 20, 60),
  ]), visit(381, [at(centre.x - 6, centre.y - 1, "TREBLE", 20, 60)])]);
  const [bucket] = aimDriftBuckets(sessions, CTX);
  expect(bucket!.metrics["LARGE_TARGET|TREBLE:20|1|NEAREST"]).toEqual({
    n: 2, sumDx: -10, sumDy: 2, sumDxDx: 52, sumDyDy: 10, sumDxDy: -6,
  });
  expect(bucket!.metrics["LARGE_TARGET|TREBLE:20|2|NEAREST"]).toMatchObject({ n: 1, sumDx: -2, sumDy: 0 });
});
it("measures a wire aim from its edge point and a SOLE route aim too", () => {
  const sessions = inferred([visit(48, [dart("OUTER_SINGLE", 16, 16)])]);
  const [bucket] = aimDriftBuckets(sessions, CTX);
  expect(Object.keys(bucket!.metrics)).toEqual(["ROUTE|WIRE:8-16|1|SOLE"]);
});
```

Use `toBeCloseTo` per field if float noise appears; the expected values stand.

- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS.
- [ ] **Step 5:** Wire as Task 6 Step 7; extend the registry test's `toContain` to `aim-drift`; `npm test` → PASS.
- [ ] **Step 6: Commit** `feat(stats): aim-drift section`.

---

### Task 8: `double-accuracy`

**Files:**
- Create: `app/src/modules/stats/sections/double-accuracy.module.ts`
- Modify: as Task 6 Step 7
- Test: `app/tests/modules/stats/sections/double-accuracy.module.test.ts`

**Interfaces:**
- Consumes: `missSector`, `radialClass` (`./miss-direction.module`).
- Produces: `doubleAccuracyBuckets(sessions, ctx)`. Darts with `basis === "FINISH"`.
  - Hit: key `aimKey(aim.key, resolution, "HIT")`, leaf `{ darts }`.
  - Miss: key `aimKey(aim.key, resolution, "MISS", radial, sector)`, leaf `{ darts }`, where `radial = radialClass(hypot(x, y), rInner, rOuter)` with the double band (`doubleInner`, `doubleOuter`) or, for the bull, `(0, innerBull)`; and `sector = missSector(x − aimPoint.x, y − aimPoint.y)`.
  - Ambiguous → `AMBIGUOUS_KEY`. `sampleSize` = resolved darts.

- [ ] **Step 1: Failing test:**

```ts
it("counts hits and classifies misses inside or outside the double", () => {
  const d16 = zoneCentroid(16, "DOUBLE")!;
  const inside = scale(d16, 150 / 166), outside = scale(d16, 180 / 166);
  const sessions = inferred([
    visit(32, [at(inside.x, inside.y, "OUTER_SINGLE", 16, 16)]),
    visit(32, [at(outside.x, outside.y, "MISS", null, 0), dart("DOUBLE", 16, 32)]),
  ]);
  const [bucket] = doubleAccuracyBuckets(sessions, CTX);
  const keys = Object.keys(bucket!.metrics).sort();
  expect(keys.filter((k) => k.startsWith("DOUBLE:16|SOLE|HIT"))).toHaveLength(1);
  expect(keys.some((k) => k.startsWith("DOUBLE:16|SOLE|MISS|OUTSIDE|"))).toBe(true);
  expect(keys.some((k) => k.startsWith("DOUBLE:16|SOLE|MISS|INSIDE|"))).toBe(true);
  expect(bucket!.sampleSize).toBe(3);
});
it("leaves split-resolved darts out", () => {
  const [bucket] = doubleAccuracyBuckets(inferred([visit(18, [dart("OUTER_SINGLE", 2, 2)])]), CTX);
  expect(bucket).toBeUndefined();
});
```

`scale(point, k)` multiplies both coordinates by `k`.

- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS.
- [ ] **Step 5:** Wire; registry test; `npm test` → PASS.
- [ ] **Step 6: Commit** `feat(stats): double-accuracy section`.

---

### Task 9: `double-preference`

**Files:**
- Create: `app/src/modules/stats/sections/double-preference.module.ts`
- Modify: as Task 6 Step 7
- Test: `app/tests/modules/stats/sections/double-preference.module.test.ts`

**Interfaces:**
- Produces: `doublePreferenceBuckets(sessions, ctx)`. For every dart whose `candidateKeys` holds a `FINISH` aim (cases B and C), with `D` = that finish key:
  - `aimKey(D, "STATE")` leaf `{ left, splitAway }`, written (with zeros) for every such dart: `left += 1` when the dart is the visit's first dart; `splitAway += 1` when the dart resolved to `SPLIT`, or to the non-finish candidate at 50.
  - `aimKey(D, resolution)` leaf `{ attempts, hits }` when the dart resolved to `FINISH`.
  - Ambiguous → `AMBIGUOUS_KEY`. `sampleSize` = Σ `attempts`.

The finish key of a dart is the candidate with basis `FINISH`; expose it from the walker as `InferredDart.finishKey: TargetKey | null` (add the field in this task, with a walker test asserting `"DOUBLE:9"` at 18 and `null` at 501).

- [ ] **Step 1: Failing test:**

```ts
it("sets how often a double is left beside how it is hit", () => {
  const sessions = inferred([
    visit(18, [dart("OUTER_SINGLE", 2, 2), dart("DOUBLE", 8, 16)]),
    visit(18, [dart("DOUBLE", 9, 18)]),
    visit(32, [dart("OUTER_SINGLE", 16, 16), dart("OUTER_SINGLE", 8, 8)]),
  ]);
  const [bucket] = doublePreferenceBuckets(sessions, CTX);
  expect(bucket!.metrics).toEqual({
    "DOUBLE:9|STATE": { left: 2, splitAway: 1 },
    "DOUBLE:9|NEAREST": { attempts: 1, hits: 1 },
    "DOUBLE:8|STATE": { left: 0, splitAway: 0 },
    "DOUBLE:8|SOLE": { attempts: 2, hits: 1 },
    "DOUBLE:16|STATE": { left: 1, splitAway: 0 },
    "DOUBLE:16|SOLE": { attempts: 1, hits: 0 },
  });
});
```

- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS.
- [ ] **Step 5:** Wire; registry test; `npm test` → PASS.
- [ ] **Step 6: Commit** `feat(stats): double-preference section`.

---

### Task 10: `setup-success`

**Files:**
- Create: `app/src/modules/stats/sections/setup-success.module.ts`
- Modify: as Task 6 Step 7
- Test: `app/tests/modules/stats/sections/setup-success.module.test.ts`

**Interfaces:**
- Produces: `setupSuccessBuckets(sessions, ctx)`.
  - Darts with basis `ROUTE`, `SETUP` or `SPLIT`: key `aimKey(basis, aim.kind, resolution)`, leaf `{ attempts, hits }`.
  - Visits: key `"VISITS"`, leaf `{ visits, goodLeaves }`. A visit counts when `outcome === "OPEN"` and its last dart's basis is not `LARGE_TARGET`; `goodLeaves += 1` when `isGoodLeave(remainingAfter)`.
  - Ambiguous → `AMBIGUOUS_KEY`. `sampleSize` = Σ `attempts`.

- [ ] **Step 1: Failing test:**

```ts
it("counts setup darts per basis and kind, and good leaves per visit", () => {
  const sessions = inferred([
    visit(48, [dart("OUTER_SINGLE", 16, 16), dart("OUTER_SINGLE", 16, 16), dart("OUTER_SINGLE", 8, 8)]),
    visit(100, [dart("OUTER_SINGLE", 20, 20), dart("OUTER_SINGLE", 20, 20), dart("OUTER_SINGLE", 20, 20)]),
    visit(501, [dart("TREBLE", 20, 60), dart("TREBLE", 20, 60), dart("TREBLE", 20, 60)]),
  ]);
  const [bucket] = setupSuccessBuckets(sessions, CTX);
  expect(bucket!.metrics["ROUTE|WIRE|SOLE"]).toEqual({ attempts: 1, hits: 1 });
  expect(bucket!.metrics["ROUTE|TREBLE|SOLE"]).toEqual({ attempts: 2, hits: 0 });
  expect(bucket!.metrics.VISITS).toEqual({ visits: 2, goodLeaves: 2 });
});
```

Visit 1 ends on 8 (32 → D16 missed inside → 16 → D8 missed inside): a good leave. Visit 2 runs 100 → 80 → 60 → 40: `ROUTE:TREBLE:20` missed, `ROUTE:TREBLE:16` missed (the chart's 80 is T16, D16), then `SETUP:SINGLE:20` hit; it ends on 40, a good leave. Also assert `SETUP|SINGLE|SOLE` equals `{ attempts: 1, hits: 1 }`. Visit 3 is all `LARGE_TARGET` and is not counted.

- [ ] **Step 2–4:** Run → FAIL; implement; run → PASS.
- [ ] **Step 5:** Wire; registry test; `npm test` → PASS.
- [ ] **Step 6: Commit** `feat(stats): setup-success section`.

---

### Task 11: Aim-filtered heatmap and the 501 page list

**Files:**
- Modify: `app/src/lib/stats/section-registry.ts`, `app/src/lib/stats/types.ts` (`SectionMeta`), `app/src/modules/stats/sections/heatmap.module.ts`, `app/src/services/statistics.service.ts`
- Test: `app/tests/modules/stats/sections/heatmap.module.test.ts`, `app/tests/lib/stats/section-registry.test.ts`, `app/tests/services/statistics.service.test.ts`

**Interfaces:**
- Produces:
  - `inferredHeatmapCellRows(sessions: readonly InferredSession[], aim: AimKey): HeatmapCellRow[]` — darts whose resolved `aim.key === aim`, binned exactly as `heatmapCellRowsFromAims` bins (extract the shared binning into one private helper; do not copy it).
  - `heatmap.siteByTagWhenFiltered` gains `"intent-inferred": "server"`.
  - `sectionTarget` accepts, on an `intent-inferred` game, any `TREBLE:n`, `SINGLE:n`, `DOUBLE:n`, `INNER_BULL:25`, `OUTER_BULL:25` or valid `WIRE:a-b`; anything else is `VALIDATION_FAILED` with reason `target must be an inferred aim key on this game`. The response's `target` echoes the key unchanged.
  - `SectionMeta.excludedGames?: readonly GameTypeKey[]`; `sectionsForGame` drops a section for a listed game. `treble-rate`, `volume`, `checkout-path` and `double-performance` list `["501"]`.
  - `PAGE_ORDER_OVERRIDES["501"]` = `scoring-trend`, `large-target-accuracy`, `aim-drift`, `checkout-rate`, `double-accuracy`, `double-preference`, `setup-success`, `bust-rate`, `leg-stats`, `heatmap`, then every remaining tag-derived id in its existing order.

- [ ] **Step 1: Failing tests:**

```ts
// heatmap.module.test.ts
it("bins only darts resolved to the requested inferred aim", () => {
  const sessions = inferred([visit(48, [dart("OUTER_SINGLE", 16, 16)]), visit(501, [dart("TREBLE", 20, 60)])]);
  expect(inferredHeatmapCellRows(sessions, "WIRE:8-16").reduce((n, c) => n + c.darts, 0)).toBe(1);
  expect(inferredHeatmapCellRows(sessions, "TREBLE:19")).toEqual([]);
});
// section-registry.test.ts
it("lays out the 501 page", () => {
  const page = sectionsForGame("501");
  expect(page.slice(0, 10)).toEqual([
    "scoring-trend", "large-target-accuracy", "aim-drift", "checkout-rate", "double-accuracy",
    "double-preference", "setup-success", "bust-rate", "leg-stats", "heatmap",
  ]);
  for (const gone of ["treble-rate", "volume", "checkout-path", "double-performance"]) {
    expect(page).not.toContain(gone);
  }
  expect(sectionsForGame("ONE_TWENTY_ONE")).toContain("double-performance");
  expect(sectionsForGame("SCORE_TRAINING")).toContain("treble-rate");
});
```

In `statistics.service.test.ts`: a 501 `heatmap` request with `target=WIRE:6-10` resolves the `server` site and returns `target: "WIRE:6-10"`; `target=NUMBER:20` fails `VALIDATION_FAILED`; a 501 `heatmap` request without `target` still resolves `sql`; a 501 request for `double-performance` fails the same way an unoffered section fails today.

- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. `SectionContext.target` is typed `{ number, zone } | null` and cannot hold a wire: carry the validated key as a string for `intent-inferred` games, and make the heatmap's `server` handler load through `foldLoad` → `inferredSessions` when the game carries `intent-inferred`, through `stepsLoad` otherwise. The existing override-is-a-permutation test must stay green; an excluded section is absent from both sides of that comparison.
- [ ] **Step 4:** `npm test` → PASS. Search `app/src` for readers of the four excluded sections on a 501 page (`game-stats.store.ts` reads `double-performance`); a reader that now breaks is fixed here only if a test fails, otherwise it is filed as `discovered-work` for the UI plan.
- [ ] **Step 5: Commit** `feat(stats): inferred-aim heatmap filter and 501 page list`.

---

### Task 12: Docs, decision, gates, PR

**Files:**
- Modify: `docs/architecture/10-Statistics/00-Overview.md` (§3 tag table and the "would fabricate a fact" paragraph; status block), `docs/architecture/10-Statistics/01-Section-Catalog.md` (§1 library rows for the five sections, §2 501 page row, §2.1 metrics in the key formats above), the spec (the four deviations at the top of this plan), `decisions/**` (new decision in the statistics domain file per `DECISIONS.md`'s routing table: inferred intent for 501; narrows the no-inference rule; cites the decisions it supersedes), `docs/architecture/00-File-Inventory.md` and `00-Context-Map-History.md` as `context-maintenance` requires.

- [ ] **Step 1:** Make the doc edits as targeted diffs. Each new catalog row states site `server` and its reason: "needs the remaining-score fold and the aim resolver".
- [ ] **Step 2:** Run the `context-maintenance` skill, then `run-all-gates`, then `cd app && npm run format && npm run validate:app`. Every script's pass or fail is reported by name. Without a `DATABASE_URL`, report which `validate:app` steps could not run.
- [ ] **Step 3: Commit** `docs: 501 inferred-aim statistics`.
- [ ] **Step 4:** Finish with `finishing-a-dart-branch` (push, open the PR, `subscribe_pr_activity`). The PR body lists the four spec deviations and every unconfirmed-row report from Task 4.
