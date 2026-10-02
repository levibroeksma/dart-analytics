# Score Training — Score Trend Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When Score Training is picked on `/statistics`, render a dedicated layout whose first section, the score trend, fetches its own data on mount. It shows a range picker, the 3-dart and first-9 averages with deltas, and a trend chart.

**Architecture:** An `x-if` on the Games tab mounts `ScoreTrainingStatsOverview.astro` only for `SCORE_TRAINING_V1`. Each section owns an Alpine factory (`*.data.ts`) that fetches in `init()` through a shared cached loader, `loadGameSection`, taken out of `game-stats.store.ts`. Range math, period split, folding and chart building are pure functions. The backend's first-9 clause is fixed so it counts the owner's first 3 visits per `LEG` or `EXERCISE_BLOCK` stage.

**Tech Stack:** Astro, Alpine.js v3, TypeScript, Vitest, Drizzle (query builder only), Chart.js through `Chart.astro`, IndexedDB section cache.

**Spec:** `docs/superpowers/specs/2026-10-01-score-training-trend-section-design.md`

## Global Constraints

- Branch: `feat/score-training-trend-section`. Never commit to `main`. Integrate through a PR.
- TDD per `app/CLAUDE.md`: write the failing test, run `npm test` from `app/` and see it fail for the right reason, implement, run `npm test` again.
- Tests live under `app/tests/`, mirroring `app/src/`. Never colocate them.
- No `//` or `/* */` comments inside function bodies. JSDoc above declarations only. Never narrate decision history in comments.
- No `.ts` file directly under `components/` or `pages/`.
- Alpine: no `x-init`. Every `x-show` needs `x-cloak`. No HTML comments (`<!-- -->`) in `.astro` templates.
- Styles: semantic tokens only (`text-foreground`, `text-muted-foreground`, `text-success`, `text-error`), `cn()` for composition, never `font-medium`.
- Range options, verbatim: `Last 30 Days`, `Last 90 Days`, `Last Year`, `All Time`. Default is `Last 30 Days`.
- Bucket per range:
  - 30d → `day`
  - 90d → `week`
  - 1y and All → `month`, unless the data spans under 4 months, then `week`
- Requests stay within 120 buckets. All Time goes 119 months back.
- Buckets with 0 darts are dropped from the chart at every granularity.
- The section does not show the chart "Table view" or the 100+/140+/180 band counts.
- Fetch only on mount. The default page state fetches only `scoring-trend` for `SCORE_TRAINING`: no session list and no other section.
- Never modify applied migrations. This plan needs none.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

1. **Fast range switching:** picking 30d → All → 90d quickly must show 90d data and never a late All response. Pinned in Task 5, "ignores a superseded response".
2. **A player with no Score Training sessions at all:** All Time must show the empty state, not an error. The week fallback must not fire on zero data. Pinned in Task 4, "weekFallbackWindow returns null when no bucket has darts", and Task 5, "shows empty state when no data".
3. **Data only in the previous period:** the current averages are `null`, the delta is `null` (not `-avg`), and the empty state shows. Pinned in Task 4, "delta is null when either side is null".
4. **Month bucket starts at local midnight, which is the previous day in UTC:** the span and the labels must use the browser zone, or Sep reads as Aug. Pinned in Task 4, "counts span in the zone, not UTC" and "labels a month bucket in the zone".
5. **1v1 Score Training with interleaved seats:** first-9 must use the owner's own first 3 visits. Pinned in Task 1 by SQL shape (`row_number() … partition by stage_id`). An executed check needs fixtures the itest suite doesn't seed, so the PR body must call this out for manual verification.

---

### Task 0: Unblock commits and land the spec

The untracked stub `ScoreTrentSection.astro` contains an HTML comment, which fails `check-astro-conventions.sh`. Every commit is blocked until it's fixed.

**Files:**
- Delete: `app/src/components/layout/games/statistics/ScoreTrentSection.astro`
- Create: `app/src/components/layout/games/statistics/ScoreTrendSection.astro`
- Modify: `app/src/components/layout/games/statistics/ScoreTrainingStatsOverview.astro`
- Commit: `docs/superpowers/specs/2026-10-01-score-training-trend-section-design.md` (already staged), this plan

- [ ] **Step 1: Replace the stub with a placeholder that passes the gate**

`ScoreTrendSection.astro`:

```astro
---
---

<section class="glass rounded-2xl p-4"></section>
```

`ScoreTrainingStatsOverview.astro`:

```astro
---
import ScoreTrendSection from "./ScoreTrendSection.astro";
---

<div class="flex flex-col gap-2">
  <ScoreTrendSection />
</div>
```

Then `rm app/src/components/layout/games/statistics/ScoreTrentSection.astro`.

- [ ] **Step 2: Run the gate**

Run from the repo root: `bash scripts/check-astro-conventions.sh`
Expected: no `FAIL` line.

- [ ] **Step 3: Commit**

```bash
git add app/src/components/layout/games/statistics docs/superpowers/specs/2026-10-01-score-training-trend-section-design.md docs/superpowers/plans/2026-10-01-score-training-trend-section.md
git commit -m "docs(spec): score training trend section design and plan

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 1: First-9 counts the owner's first 3 visits per stage

**Files:**
- Modify: `app/src/repositories/statistics.repository.ts` (`findVisitScoring`, around lines 565–635)
- Test: `app/tests/repositories/statistics.repository.test.ts` (`describe("findVisitScoring")`, around lines 1086–1198)

**Interfaces:**
- Consumes: `sessionScopeWhere`, `bucketExprs(completedAt: Column, unit, tz)`, `mapVisitScoringRow`, `vPlayerVisitFacts`, `vStatsSessionFacts`. All exist already.
- Produces: the same `findVisitScoring(db, q): Promise<VisitScoringRow[]>` signature. Only the SQL changes.

- [ ] **Step 1: Replace the LEG-only test with failing tests for the new clause**

Replace the test `"filters the first-nine sums to LEG stages at turn_sequence <= 3"` with:

```ts
  it("ranks the owner's visits per stage inside the scoped subquery", async () => {
    const { db, statements } = renderingDb([]);
    await findVisitScoring(db, {
      ...sessionScope,
      bucket: "none",
      tz: undefined,
      bands,
    });
    const sql = onlyStatement(statements);
    expect(sql).toMatch(
      /row_number\(\) over \(partition by "v_player_visit_facts"\."stage_id" order by "v_player_visit_facts"\."turn_sequence"\)/i,
    );
    expect(sql).toMatch(/\) "scoped_visits"/);
  });

  it("filters the first-nine sums to the first 3 ranked visits of LEG or EXERCISE_BLOCK stages", async () => {
    const { db, statements } = renderingDb([]);
    await findVisitScoring(db, {
      ...sessionScope,
      bucket: "month",
      tz: "Europe/Amsterdam",
      bands,
    });
    const sql = onlyStatement(statements);
    expect(sql).toMatch(
      /filter \(where "scoped_visits"\."stage_type_key" in \('LEG', 'EXERCISE_BLOCK'\) and "scoped_visits"\."visit_rank" <= 3\)/i,
    );
    expect(sql).not.toMatch(/"turn_sequence" <= 3/);
  });
```

Re-point the coalesce test at the same guarantee (sums coalesce to 0), now read from the subquery alias:

```ts
    expect(sql).toMatch(
      /coalesce\(sum\("scoped_visits"\."total_score"\), 0\)/,
    );
    expect(sql).toMatch(
      /coalesce\(sum\("scoped_visits"\."dart_count"\), 0\)/,
    );
```

In `"parses every sum from a string"`, the chain now builds an inner subquery and an outer select. Replace its `chain` and `db` with:

```ts
    const row = {
      bucketStart: sessionScope.from,
      bucketEnd: sessionScope.to,
      points: "180",
      darts: "9",
      firstNinePoints: "180",
      firstNineDarts: "9",
      ton: "1",
      tonForty: "0",
      oneEighty: "1",
    };
    const inner = {
      from: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      as: vi.fn(() => ({
        completedAt: {},
        totalScore: {},
        dartCount: {},
        stageTypeKey: {},
        visitRank: {},
      })),
    };
    const outer = { from: vi.fn().mockResolvedValue([row]) };
    const db = {
      select: vi.fn().mockReturnValueOnce(inner).mockReturnValueOnce(outer),
    } as any;
```

- [ ] **Step 2: Run to see it fail**

Run from `app/`: `npx vitest run tests/repositories/statistics.repository.test.ts -t findVisitScoring`
Expected: the two new tests and the coalesce test FAIL, because there's no `row_number` or `scoped_visits` yet.

- [ ] **Step 3: Implement**

In `findVisitScoring`, replace the body from `const whereClause = …` through the end of the function with:

```ts
  const whereClause = sessionScopeWhere(q);
  const scoped = db
    .select({
      completedAt: vStatsSessionFacts.completedAt,
      totalScore: vPlayerVisitFacts.totalScore,
      dartCount: vPlayerVisitFacts.dartCount,
      stageTypeKey: vPlayerVisitFacts.stageTypeKey,
      visitRank:
        sql<number>`row_number() over (partition by ${vPlayerVisitFacts.stageId} order by ${vPlayerVisitFacts.turnSequence})`.as(
          "visit_rank",
        ),
    })
    .from(vPlayerVisitFacts)
    .innerJoin(
      vStatsSessionFacts,
      eq(vPlayerVisitFacts.sessionId, vStatsSessionFacts.sessionId),
    )
    .where(whereClause)
    .as("scoped_visits");
  const firstNineClause = sql`${scoped.stageTypeKey} in ('LEG', 'EXERCISE_BLOCK') and ${scoped.visitRank} <= 3`;
  const pointsExpr = sql<string>`coalesce(sum(${scoped.totalScore}), 0)`;
  const dartsExpr = sql<string>`coalesce(sum(${scoped.dartCount}), 0)`;
  const firstNinePointsExpr = sql<string>`coalesce(sum(${scoped.totalScore}) filter (where ${firstNineClause}), 0)`;
  const firstNineDartsExpr = sql<string>`coalesce(sum(${scoped.dartCount}) filter (where ${firstNineClause}), 0)`;
  const tonExpr = sql<string>`count(*) filter (where ${scoped.totalScore} >= ${q.bands[0]} and ${scoped.totalScore} < ${q.bands[1]})`;
  const tonFortyExpr = sql<string>`count(*) filter (where ${scoped.totalScore} >= ${q.bands[1]} and ${scoped.totalScore} < ${q.bands[2]})`;
  const oneEightyExpr = sql<string>`count(*) filter (where ${scoped.totalScore} >= ${q.bands[2]})`;
  const sums = {
    points: pointsExpr,
    darts: dartsExpr,
    firstNinePoints: firstNinePointsExpr,
    firstNineDarts: firstNineDartsExpr,
    ton: tonExpr,
    tonForty: tonFortyExpr,
    oneEighty: oneEightyExpr,
  };

  if (q.bucket === "none") {
    const rows = await db
      .select({
        bucketStart: sql<string>`${q.from}::timestamptz`,
        bucketEnd: sql<string>`${q.to}::timestamptz`,
        ...sums,
      })
      .from(scoped);
    return rows.map(mapVisitScoringRow);
  }

  const tz = nonNull(q.tz ?? null, "tz");
  const { bucketStartExpr, bucketEndExpr } = bucketExprs(
    scoped.completedAt,
    q.bucket,
    tz,
  );

  const rows = await db
    .select({
      bucketStart: bucketStartExpr,
      bucketEnd: bucketEndExpr,
      ...sums,
    })
    .from(scoped)
    .groupBy(bucketStartExpr, bucketEndExpr);
  return rows.map(mapVisitScoringRow);
```

If TypeScript rejects `scoped.completedAt` as `Column`, widen the `bucketExprs` parameter from `completedAt: Column` to `completedAt: Column | SQL | SQL.Aliased` (import `SQL` from `drizzle-orm`). Change nothing else.

Update the JSDoc above `findVisitScoring`: add one line, `First-nine sums take the owner's first three visits of each LEG or EXERCISE_BLOCK stage, ranked by turn_sequence.`

- [ ] **Step 4: Run the tests**

Run from `app/`: `npx vitest run tests/repositories/statistics.repository.test.ts tests/services/statistics.service.test.ts`
Expected: PASS. The tz-literal group-by and band-param tests must stay green without edits.

- [ ] **Step 5: Run the SQL itest if a database is reachable**

Run from `app/`, only if `DATABASE_URL` is set: `npx vitest run tests/integration/statistics-sql.itest.ts`
Expected: PASS. `SCORE_TRAINING` is already in `GAMES`, so `scoring-trend` executes against Postgres. If there's no `DATABASE_URL`, record "itest not run: no DATABASE_URL" for the PR body.

- [ ] **Step 6: Commit**

```bash
git add app/src/repositories/statistics.repository.ts app/tests/repositories/statistics.repository.test.ts
git commit -m "fix(stats): first nine ranks owner visits per LEG or EXERCISE_BLOCK stage

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Shared cached section loader

**Files:**
- Create: `app/src/lib/stats/load-game-section.ts`
- Modify: `app/src/stores/game-stats.store.ts`, in `load()` (around 272–326), `loadHeatmap()` (around 362–385) and the `CACHE_PLAYER_ID` const (around 63)
- Test: `app/tests/lib/stats/load-game-section.test.ts`

**Interfaces:**
- Produces:

```ts
export const CACHE_PLAYER_ID = "me";
export type GameSectionRange = {
  from: string;
  to: string;
  bucket: Bucket;
  tz?: string;
  target?: string;
};
export function loadGameSection<M>(
  gameTypeKey: GameTypeKey,
  sectionId: SectionId,
  range: GameSectionRange,
): Promise<CachedSeries<M>>;
```

- [ ] **Step 1: Write the failing test**

`app/tests/lib/stats/load-game-section.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const readSection = vi.fn();
const fetchGameSection = vi.fn();

vi.mock("@client/stats-cache/cache", () => ({
  readSection: (...args: unknown[]) => readSection(...args),
}));
vi.mock("@client/api/statistics", () => ({
  fetchGameSection: (...args: unknown[]) => fetchGameSection(...args),
}));

const { loadGameSection, CACHE_PLAYER_ID } = await import(
  "@lib/stats/load-game-section"
);
const { SECTIONS } = await import("@lib/stats/section-registry");

const range = {
  from: "2026-09-01T00:00:00.000Z",
  to: "2026-10-01T00:01:00.000Z",
  bucket: "day" as const,
  tz: "Europe/Amsterdam",
};

beforeEach(() => {
  readSection.mockReset();
  fetchGameSection.mockReset();
  readSection.mockResolvedValue({ buckets: [] });
});

describe("loadGameSection", () => {
  it("reads through the cache under the game scope, the section meta and the VISUAL_BOARD all-context query", async () => {
    await loadGameSection("SCORE_TRAINING", "scoring-trend", range);
    expect(readSection).toHaveBeenCalledWith(
      CACHE_PLAYER_ID,
      { key: expect.any(String), gameTypeKey: "SCORE_TRAINING" },
      SECTIONS["scoring-trend"],
      { ...range, context: "all", inputMode: "VISUAL_BOARD" },
      expect.any(Function),
    );
  });

  it("fetches the section with the range merged over the cache's span", async () => {
    await loadGameSection("SCORE_TRAINING", "scoring-trend", range);
    const fetcher = readSection.mock.calls[0][4] as (span: unknown) => unknown;
    const span = { from: "2026-09-15T00:00:00.000Z", to: range.to };
    fetcher(span);
    expect(fetchGameSection).toHaveBeenCalledWith(
      "SCORE_TRAINING",
      "scoring-trend",
      { ...range, ...span },
    );
  });

  it("returns the cache's series", async () => {
    readSection.mockResolvedValue({ buckets: [{ start: "x" }] });
    await expect(
      loadGameSection("SCORE_TRAINING", "scoring-trend", range),
    ).resolves.toEqual({ buckets: [{ start: "x" }] });
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run from `app/`: `npx vitest run tests/lib/stats/load-game-section.test.ts`
Expected: FAIL, because `@lib/stats/load-game-section` can't be resolved.

- [ ] **Step 3: Implement**

`app/src/lib/stats/load-game-section.ts`:

```ts
import { fetchGameSection } from "@client/api/statistics";
import { readSection } from "@client/stats-cache/cache";
import { gameScopeKey } from "@modules/stats/routine-scope.module";
import { SECTIONS } from "@lib/stats/section-registry";
import type { Bucket, GameTypeKey, SectionId } from "@lib/types";
import type { CachedSeries } from "@client/types";

/**
 * A synthetic, browser-scoped player identity for the IndexedDB cache's keys.
 * Requests are scoped server-side to `auth.playerId` and the cache is wiped on
 * sign-out, so a constant key is safe (`10-Statistics/00-Overview.md` §7).
 */
export const CACHE_PLAYER_ID = "me";

/** The range part of a game section request; `target` only for `heatmap`. */
export type GameSectionRange = {
  from: string;
  to: string;
  bucket: Bucket;
  tz?: string;
  target?: string;
};

/** One game section, read through the IndexedDB cache under the all-context VISUAL_BOARD query. */
export function loadGameSection<M>(
  gameTypeKey: GameTypeKey,
  sectionId: SectionId,
  range: GameSectionRange,
): Promise<CachedSeries<M>> {
  return readSection<M>(
    CACHE_PLAYER_ID,
    { key: gameScopeKey(gameTypeKey), gameTypeKey },
    SECTIONS[sectionId],
    { ...range, context: "all", inputMode: "VISUAL_BOARD" },
    (span) =>
      fetchGameSection(gameTypeKey, sectionId, {
        ...range,
        ...span,
      }) as Promise<CachedSeries<M>>,
  );
}
```

- [ ] **Step 4: Point the store at the loader**

In `app/src/stores/game-stats.store.ts`:
- Delete the `CACHE_PLAYER_ID` const and its JSDoc (around lines 56–63). Add `import { CACHE_PLAYER_ID, loadGameSection } from "@lib/stats/load-game-section";`.
- In `load()`, replace the `readSection<unknown>(…)` call inside `ids.map` with:

```ts
          const range = sectionRange(SECTIONS[id], this.range);
          return loadGameSection<unknown>(gameTypeKey, id, range);
```

- In `loadHeatmap()`, replace the `query` const and the `readSection<HeatmapMetrics>(…)` call with:

```ts
      const result = await loadGameSection<HeatmapMetrics>(
        gameTypeKey,
        "heatmap",
        { ...range, target },
      );
```

- Leave `fetchCheckoutPath` and `readSessionPage` alone. `readSection` and `fetchGameSection` stay imported only if something still uses them; otherwise remove those imports.

- [ ] **Step 5: Run the tests**

Run from `app/`: `npx vitest run tests/lib/stats/load-game-section.test.ts tests/stores/game-stats.store.test.ts`
Expected: PASS. The existing store tests mock `@client/stats-cache/cache`, which the loader imports, so their `readSection` call assertions still hold. If one asserts a query key the loader doesn't send, such as `status`, stop and report it. Don't edit the assertion.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/stats/load-game-section.ts app/tests/lib/stats/load-game-section.test.ts app/src/stores/game-stats.store.ts
git commit -m "refactor(stats): shared cached game section loader

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: The store skips games with a dedicated layout

**Files:**
- Modify: `app/src/lib/stats/constants.ts`
- Modify: `app/src/stores/game-stats.store.ts` (`selectGame`, around 252–258)
- Test: `app/tests/stores/game-stats.store.test.ts`, `app/tests/lib/stats/constants.test.ts`

**Interfaces:**
- Produces: `export const DEDICATED_STATS_LAYOUTS: ReadonlySet<string>` in `@lib/stats/constants`, containing `"SCORE_TRAINING_V1"`.

- [ ] **Step 1: Write the failing tests**

Append to `app/tests/stores/game-stats.store.test.ts`:

```ts
describe("selectGame with a dedicated layout", () => {
  it("fetches no section and no session list for SCORE_TRAINING_V1", async () => {
    const store = gameStatsStore();
    store.selectGame("SCORE_TRAINING_V1");
    await Promise.resolve();
    expect(readSection).not.toHaveBeenCalled();
    expect(readSessionPage).not.toHaveBeenCalled();
    expect(store.loading).toBe(false);
  });
});
```

Append to `app/tests/lib/stats/constants.test.ts`, adding `DEDICATED_STATS_LAYOUTS` to its existing import from `@lib/stats/constants`:

```ts
describe("DEDICATED_STATS_LAYOUTS", () => {
  it("holds SCORE_TRAINING_V1 only", () => {
    expect([...DEDICATED_STATS_LAYOUTS]).toEqual(["SCORE_TRAINING_V1"]);
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run from `app/`: `npx vitest run tests/stores/game-stats.store.test.ts tests/lib/stats/constants.test.ts`
Expected: FAIL. The store calls `readSection`, and the constant is undefined.

- [ ] **Step 3: Implement**

`app/src/lib/stats/constants.ts`, appended:

```ts
/** Ruleset versions whose `/statistics` view is a dedicated layout of self-fetching sections, not the `gameStats` store's generic cards. */
export const DEDICATED_STATS_LAYOUTS: ReadonlySet<string> = new Set([
  "SCORE_TRAINING_V1",
]);
```

In the store, import it alongside `MIN_TARGET_SAMPLE` and change `selectGame`:

```ts
    /** Resolves the picked ruleset version to its game type, then reloads; a dedicated-layout game loads its own sections. */
    selectGame(rulesetVersionKey: string) {
      if (DEDICATED_STATS_LAYOUTS.has(rulesetVersionKey)) return;
      const gameTypeKey =
        GAME_TYPE_BY_RULESET[rulesetVersionKey as RulesetVersionKey];
      if (gameTypeKey === undefined) return;
      this.gameTypeKey = gameTypeKey;
      void this.load();
    },
```

- [ ] **Step 4: Run the tests**

Run from `app/`: `npx vitest run tests/stores/game-stats.store.test.ts tests/lib/stats/constants.test.ts`
Expected: PASS. Any existing test that called `selectGame("SCORE_TRAINING_V1")` and expected a load is testing a guarantee this task removes on purpose. Re-point it to `"FIVE_OH_ONE_V1"` (or whichever 501 ruleset key `GAME_TYPE_BY_RULESET` holds) only if what it asserts is generic store loading, not anything specific to Score Training. Otherwise delete it.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/stats/constants.ts app/src/stores/game-stats.store.ts app/tests/stores/game-stats.store.test.ts app/tests/lib/stats/constants.test.ts
git commit -m "feat(stats): gameStats skips dedicated-layout games

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Pure score-trend window math

**Files:**
- Create: `app/src/lib/stats/sections/score-trend-window.ts`
- Test: `app/tests/lib/stats/sections/score-trend-window.test.ts`

**Interfaces:**
- Consumes: `SeriesBucket`, `Bucket` from `@lib/types`; `ChartSpec`, `ChartSeries`, `ScoringTrendMetrics` from `@modules/types`.
- Produces:

```ts
export type TrendRangeKey = "30d" | "90d" | "1y" | "all";
export type TrendBucket = Exclude<Bucket, "none">;
export type TrendWindow = { from: string; to: string; bucket: TrendBucket; tz: string; boundary: string | null };
export type TrendAverages = { threeDart: number | null; firstNine: number | null };
export type TrendPeriods = { previous: SeriesBucket<ScoringTrendMetrics>[]; current: SeriesBucket<ScoringTrendMetrics>[] };
export const TREND_RANGE_OPTIONS: readonly { value: TrendRangeKey; label: string }[];
export function trendWindow(key: TrendRangeKey, now: Date, tz: string): TrendWindow;
export function weekFallbackWindow(buckets: readonly SeriesBucket<ScoringTrendMetrics>[], now: Date, tz: string): TrendWindow | null;
export function splitPeriods(buckets: readonly SeriesBucket<ScoringTrendMetrics>[], boundary: string | null): TrendPeriods;
export function foldAverages(buckets: readonly SeriesBucket<ScoringTrendMetrics>[]): TrendAverages;
export function averageDelta(current: number | null, previous: number | null): number | null;
export function bucketLabel(start: string, bucket: TrendBucket, tz: string, locale?: string): string;
export function trendChart(buckets: readonly SeriesBucket<ScoringTrendMetrics>[], bucket: TrendBucket, tz: string, locale?: string): ChartSpec;
```

- [ ] **Step 1: Write the failing tests**

`app/tests/lib/stats/sections/score-trend-window.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  TREND_RANGE_OPTIONS,
  averageDelta,
  bucketLabel,
  foldAverages,
  splitPeriods,
  trendChart,
  trendWindow,
  weekFallbackWindow,
} from "@lib/stats/sections/score-trend-window";

const TZ = "Europe/Amsterdam";
const NOW = new Date("2026-10-01T10:00:00.000Z");
const DAY = 86_400_000;

function bucket(
  start: string,
  end: string,
  points: number,
  darts: number,
  firstNinePoints = 0,
  firstNineDarts = 0,
) {
  return {
    start,
    end,
    closed: true,
    sampleSize: darts > 0 ? 1 : 0,
    metrics: {
      points,
      darts,
      firstNinePoints,
      firstNineDarts,
      bands: { ton: 0, tonForty: 0, oneEighty: 0 },
    },
  };
}

describe("TREND_RANGE_OPTIONS", () => {
  it("lists the four ranges in order with their labels", () => {
    expect(TREND_RANGE_OPTIONS).toEqual([
      { value: "30d", label: "Last 30 Days" },
      { value: "90d", label: "Last 90 Days" },
      { value: "1y", label: "Last Year" },
      { value: "all", label: "All Time" },
    ]);
  });
});

describe("trendWindow", () => {
  it("30d reads 60 days of day buckets with the boundary 30 days back", () => {
    const w = trendWindow("30d", NOW, TZ);
    expect(w.bucket).toBe("day");
    expect(w.tz).toBe(TZ);
    expect(w.from).toBe(new Date(NOW.getTime() - 60 * DAY).toISOString());
    expect(w.boundary).toBe(new Date(NOW.getTime() - 30 * DAY).toISOString());
    expect(w.to).toBe(new Date(NOW.getTime() + 60_000).toISOString());
  });

  it("90d reads 26 weeks of week buckets with the boundary 13 weeks back", () => {
    const w = trendWindow("90d", NOW, TZ);
    expect(w.bucket).toBe("week");
    expect(w.from).toBe(new Date(NOW.getTime() - 182 * DAY).toISOString());
    expect(w.boundary).toBe(new Date(NOW.getTime() - 91 * DAY).toISOString());
  });

  it("1y reads 24 months of month buckets with the boundary 12 months back", () => {
    const w = trendWindow("1y", NOW, TZ);
    expect(w.bucket).toBe("month");
    expect(w.from).toBe("2024-10-01T10:00:00.000Z");
    expect(w.boundary).toBe("2025-10-01T10:00:00.000Z");
  });

  it("all reads 119 months of month buckets with no previous period", () => {
    const w = trendWindow("all", NOW, TZ);
    expect(w.bucket).toBe("month");
    expect(w.from).toBe("2016-11-01T10:00:00.000Z");
    expect(w.boundary).toBeNull();
  });
});

describe("weekFallbackWindow", () => {
  const sep = bucket("2026-08-31T22:00:00.000Z", "2026-09-30T22:00:00.000Z", 300, 9);
  const aug = bucket("2026-07-31T22:00:00.000Z", "2026-08-31T22:00:00.000Z", 300, 9);
  const jul = bucket("2026-06-30T22:00:00.000Z", "2026-07-31T22:00:00.000Z", 300, 9);
  const emptyMay = bucket("2026-04-30T22:00:00.000Z", "2026-05-31T22:00:00.000Z", 0, 0);

  it("returns null when no bucket has darts", () => {
    expect(weekFallbackWindow([emptyMay], NOW, TZ)).toBeNull();
  });

  it("returns a week window from the first data month when the span is under 4 months", () => {
    expect(weekFallbackWindow([emptyMay, aug, sep], NOW, TZ)).toEqual({
      from: aug.start,
      to: new Date(NOW.getTime() + 60_000).toISOString(),
      bucket: "week",
      tz: TZ,
      boundary: null,
    });
  });

  it("returns null when the span reaches 4 months (Jul..Oct)", () => {
    expect(weekFallbackWindow([jul, sep], NOW, TZ)).toBeNull();
  });

  it("counts span in the zone, not UTC", () => {
    expect(weekFallbackWindow([aug], NOW, TZ)).not.toBeNull();
  });
});

describe("splitPeriods", () => {
  const a = bucket("2026-08-01T00:00:00.000Z", "2026-08-02T00:00:00.000Z", 60, 3);
  const b = bucket("2026-09-01T00:00:00.000Z", "2026-09-02T00:00:00.000Z", 90, 3);

  it("puts buckets ending after the boundary in current, the rest in previous", () => {
    expect(splitPeriods([a, b], "2026-08-15T00:00:00.000Z")).toEqual({
      previous: [a],
      current: [b],
    });
  });

  it("puts every bucket in current when there is no boundary", () => {
    expect(splitPeriods([a, b], null)).toEqual({ previous: [], current: [a, b] });
  });
});

describe("foldAverages", () => {
  it("sums the additive parts before dividing", () => {
    const buckets = [
      bucket("a", "b", 180, 3, 180, 3),
      bucket("c", "d", 60, 6, 30, 3),
    ];
    expect(foldAverages(buckets)).toEqual({ threeDart: 80, firstNine: 105 });
  });

  it("is null when there are no darts", () => {
    expect(foldAverages([bucket("a", "b", 0, 0)])).toEqual({
      threeDart: null,
      firstNine: null,
    });
    expect(foldAverages([])).toEqual({ threeDart: null, firstNine: null });
  });
});

describe("averageDelta", () => {
  it("is current minus previous", () => {
    expect(averageDelta(52.4, 50)).toBeCloseTo(2.4);
    expect(averageDelta(48, 50)).toBe(-2);
  });

  it("is null when either side is null", () => {
    expect(averageDelta(null, 50)).toBeNull();
    expect(averageDelta(50, null)).toBeNull();
  });
});

describe("bucketLabel", () => {
  it("labels a day bucket as day and short month in the zone", () => {
    expect(bucketLabel("2026-09-02T22:00:00.000Z", "day", TZ, "en-GB")).toBe("3 Sept");
  });

  it("labels a week bucket by its ISO week number in the zone", () => {
    expect(bucketLabel("2026-08-30T22:00:00.000Z", "week", TZ, "en-GB")).toBe("w36");
  });

  it("labels a month bucket in the zone", () => {
    expect(bucketLabel("2026-08-31T22:00:00.000Z", "month", TZ, "en-GB")).toBe("Sept 26");
  });
});

describe("trendChart", () => {
  it("drops buckets with no darts and plots both averages", () => {
    const spec = trendChart(
      [
        bucket("2026-09-01T22:00:00.000Z", "2026-09-02T22:00:00.000Z", 150, 9, 150, 9),
        bucket("2026-09-02T22:00:00.000Z", "2026-09-03T22:00:00.000Z", 0, 0),
        bucket("2026-09-03T22:00:00.000Z", "2026-09-04T22:00:00.000Z", 120, 6, 60, 3),
      ],
      "day",
      TZ,
      "en-GB",
    );
    expect(spec.kind).toBe("line");
    expect(spec.labels).toEqual(["2 Sept", "4 Sept"]);
    expect(spec.series).toEqual([
      { key: "three-dart-average", label: "3-dart average", data: [50, 60], color: "sky" },
      { key: "first-nine-average", label: "First nine", data: [50, 60], color: "orange" },
    ]);
    expect(spec.ariaLabel).toBe("3-dart average trend");
  });

  it("omits the first-nine series when no bucket has first-nine darts", () => {
    const spec = trendChart(
      [bucket("2026-09-01T22:00:00.000Z", "2026-09-02T22:00:00.000Z", 150, 9)],
      "day",
      TZ,
      "en-GB",
    );
    expect(spec.series.map((s) => s.key)).toEqual(["three-dart-average"]);
  });
});
```

Note on labels: `en-GB` short September renders as `Sept` in current ICU. If the Node ICU in CI renders `Sep`, change only the expected strings, never the format options.

- [ ] **Step 2: Run to see it fail**

Run from `app/`: `npx vitest run tests/lib/stats/sections/score-trend-window.test.ts`
Expected: FAIL, because the module can't be resolved.

- [ ] **Step 3: Implement**

`app/src/lib/stats/sections/score-trend-window.ts`:

```ts
import type { Bucket, SeriesBucket } from "@lib/types";
import type { ChartSeries, ChartSpec, ScoringTrendMetrics } from "@modules/types";

export type TrendRangeKey = "30d" | "90d" | "1y" | "all";
export type TrendBucket = Exclude<Bucket, "none">;

/** A score-trend request; `boundary` starts the current period, `null` when there is no previous period. */
export type TrendWindow = {
  from: string;
  to: string;
  bucket: TrendBucket;
  tz: string;
  boundary: string | null;
};

export type TrendAverages = {
  threeDart: number | null;
  firstNine: number | null;
};

type TrendSeriesBucket = SeriesBucket<ScoringTrendMetrics>;

export type TrendPeriods = {
  previous: TrendSeriesBucket[];
  current: TrendSeriesBucket[];
};

export const TREND_RANGE_OPTIONS: readonly {
  value: TrendRangeKey;
  label: string;
}[] = [
  { value: "30d", label: "Last 30 Days" },
  { value: "90d", label: "Last 90 Days" },
  { value: "1y", label: "Last Year" },
  { value: "all", label: "All Time" },
];

const DAY_MS = 86_400_000;
const ALL_TIME_MONTHS = 119;
const MIN_MONTH_SPAN = 4;

function daysBack(now: Date, days: number): string {
  return new Date(now.getTime() - days * DAY_MS).toISOString();
}

function monthsBack(now: Date, months: number): string {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() - months);
  return d.toISOString();
}

function upTo(now: Date): string {
  return new Date(now.getTime() + 60_000).toISOString();
}

/** The doubled request window per range (current + previous period), bucketed per the spec's range table. */
export function trendWindow(
  key: TrendRangeKey,
  now: Date,
  tz: string,
): TrendWindow {
  const to = upTo(now);
  switch (key) {
    case "30d":
      return { from: daysBack(now, 60), to, bucket: "day", tz, boundary: daysBack(now, 30) };
    case "90d":
      return { from: daysBack(now, 182), to, bucket: "week", tz, boundary: daysBack(now, 91) };
    case "1y":
      return { from: monthsBack(now, 24), to, bucket: "month", tz, boundary: monthsBack(now, 12) };
    case "all":
      return { from: monthsBack(now, ALL_TIME_MONTHS), to, bucket: "month", tz, boundary: null };
  }
}

function zonedParts(iso: string, tz: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(iso));
  const value = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day") };
}

/**
 * A week window from the first month bucket with darts when the data spans
 * fewer than four calendar months in `tz`; `null` when month buckets suffice
 * or there is no data.
 */
export function weekFallbackWindow(
  buckets: readonly TrendSeriesBucket[],
  now: Date,
  tz: string,
): TrendWindow | null {
  const first = buckets.find((b) => b.metrics.darts > 0);
  if (first === undefined) return null;
  const start = zonedParts(first.start, tz);
  const end = zonedParts(now.toISOString(), tz);
  const span = end.year * 12 + end.month - (start.year * 12 + start.month) + 1;
  if (span >= MIN_MONTH_SPAN) return null;
  return { from: first.start, to: upTo(now), bucket: "week", tz, boundary: null };
}

/** Buckets ending after `boundary` are current; with no boundary every bucket is current. */
export function splitPeriods(
  buckets: readonly TrendSeriesBucket[],
  boundary: string | null,
): TrendPeriods {
  if (boundary === null) return { previous: [], current: [...buckets] };
  const edge = Date.parse(boundary);
  return {
    previous: buckets.filter((b) => Date.parse(b.end) <= edge),
    current: buckets.filter((b) => Date.parse(b.end) > edge),
  };
}

function threeDartAverage(points: number, darts: number): number | null {
  return darts === 0 ? null : (points / darts) * 3;
}

/** 3-dart and first-nine averages from the summed additive components. */
export function foldAverages(
  buckets: readonly TrendSeriesBucket[],
): TrendAverages {
  const sum = buckets.reduce(
    (acc, b) => ({
      points: acc.points + b.metrics.points,
      darts: acc.darts + b.metrics.darts,
      firstNinePoints: acc.firstNinePoints + b.metrics.firstNinePoints,
      firstNineDarts: acc.firstNineDarts + b.metrics.firstNineDarts,
    }),
    { points: 0, darts: 0, firstNinePoints: 0, firstNineDarts: 0 },
  );
  return {
    threeDart: threeDartAverage(sum.points, sum.darts),
    firstNine: threeDartAverage(sum.firstNinePoints, sum.firstNineDarts),
  };
}

export function averageDelta(
  current: number | null,
  previous: number | null,
): number | null {
  return current === null || previous === null ? null : current - previous;
}

function isoWeek(year: number, month: number, day: number): number {
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7) + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  return (
    1 +
    Math.round(
      ((date.getTime() - firstThursday.getTime()) / DAY_MS -
        3 +
        ((firstThursday.getUTCDay() + 6) % 7)) /
        7,
    )
  );
}

/** Axis label for a bucket start in `tz`: `3 Sep`, `w36`, or `Sep 26`. */
export function bucketLabel(
  start: string,
  bucket: TrendBucket,
  tz: string,
  locale?: string,
): string {
  if (bucket === "week") {
    const { year, month, day } = zonedParts(start, tz);
    return `w${isoWeek(year, month, day)}`;
  }
  const options: Intl.DateTimeFormatOptions =
    bucket === "day"
      ? { day: "numeric", month: "short", timeZone: tz }
      : { month: "short", year: "2-digit", timeZone: tz };
  return new Date(start).toLocaleDateString(locale, options);
}

/** Line chart of the 3-dart and first-nine averages per bucket, skipping buckets with no darts. */
export function trendChart(
  buckets: readonly TrendSeriesBucket[],
  bucket: TrendBucket,
  tz: string,
  locale?: string,
): ChartSpec {
  const thrown = buckets.filter((b) => b.metrics.darts > 0);
  const firstNine = thrown.map((b) =>
    threeDartAverage(b.metrics.firstNinePoints, b.metrics.firstNineDarts),
  );
  const series: ChartSeries[] = [
    {
      key: "three-dart-average",
      label: "3-dart average",
      data: thrown.map((b) => threeDartAverage(b.metrics.points, b.metrics.darts)),
      color: "sky",
    },
  ];
  if (firstNine.some((value) => value !== null)) {
    series.push({
      key: "first-nine-average",
      label: "First nine",
      data: firstNine,
      color: "orange",
    });
  }
  return {
    kind: "line",
    labels: thrown.map((b) => bucketLabel(b.start, bucket, tz, locale)),
    series,
    ariaLabel: "3-dart average trend",
  };
}
```

- [ ] **Step 4: Run the tests**

Run from `app/`: `npx vitest run tests/lib/stats/sections/score-trend-window.test.ts`
Expected: PASS. If only the `Sept`/`Sep` strings differ, apply the label note from Step 1.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/stats/sections/score-trend-window.ts app/tests/lib/stats/sections/score-trend-window.test.ts
git commit -m "feat(stats): score trend window, split, fold and chart

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: `scoreTrendSection()` Alpine factory

**Files:**
- Create: `app/src/lib/stats/sections/score-trend.data.ts`
- Modify: `app/src/lib/client/alpine/register-route-data.ts`
- Test: `app/tests/lib/stats/sections/score-trend.data.test.ts`, `app/tests/lib/client/alpine/register-route-data.test.ts`

**Interfaces:**
- Consumes: `loadGameSection<ScoringTrendMetrics>` (Task 2), and everything Task 4 exports.
- Produces: `scoreTrendSection()`, an Alpine factory with this state:
  - `rangeKey: TrendRangeKey`
  - `loading: boolean`
  - `error: string | null`
  - `bucket: TrendBucket`
  - `tz: string`
  - `current`, `previous`, both `SeriesBucket<ScoringTrendMetrics>[]`
  - `hasPrevious: boolean`

  Methods: `init()`, `load(now?: Date)`.

  Getters:
  - `averages: TrendAverages`
  - `threeDartDelta: number | null`
  - `firstNineDelta: number | null`
  - `isEmpty: boolean`
  - `chart: ChartSpec`

  Registered as `Alpine.data("scoreTrendSection", scoreTrendSection)`.

- [ ] **Step 1: Write the failing tests**

`app/tests/lib/stats/sections/score-trend.data.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const loadGameSection = vi.fn();

vi.mock("@lib/stats/load-game-section", () => ({
  loadGameSection: (...args: unknown[]) => loadGameSection(...args),
}));

const { scoreTrendSection } = await import(
  "@lib/stats/sections/score-trend.data"
);

const NOW = new Date("2026-10-01T10:00:00.000Z");

function bucket(start: string, end: string, points: number, darts: number) {
  return {
    start,
    end,
    closed: true,
    sampleSize: darts > 0 ? 1 : 0,
    metrics: {
      points,
      darts,
      firstNinePoints: points,
      firstNineDarts: darts,
      bands: { ton: 0, tonForty: 0, oneEighty: 0 },
    },
  };
}

function series(buckets: unknown[]) {
  return { buckets };
}

function section() {
  const s = scoreTrendSection();
  const watchers: Record<string, () => void> = {};
  Object.assign(s, {
    $watch: (key: string, cb: () => void) => {
      watchers[key] = cb;
    },
  });
  return { s, watchers };
}

beforeEach(() => {
  loadGameSection.mockReset();
  loadGameSection.mockResolvedValue(series([]));
});

describe("scoreTrendSection", () => {
  it("starts on Last 30 Days and loading", () => {
    const { s } = section();
    expect(s.rangeKey).toBe("30d");
    expect(s.loading).toBe(true);
  });

  it("init loads scoring-trend for SCORE_TRAINING with a day window", async () => {
    const { s } = section();
    s.init();
    await vi.waitFor(() => expect(s.loading).toBe(false));
    expect(loadGameSection).toHaveBeenCalledTimes(1);
    const [game, id, range] = loadGameSection.mock.calls[0];
    expect(game).toBe("SCORE_TRAINING");
    expect(id).toBe("scoring-trend");
    expect(range.bucket).toBe("day");
    expect(range).not.toHaveProperty("boundary");
  });

  it("reloads when rangeKey changes", async () => {
    const { s, watchers } = section();
    s.init();
    await vi.waitFor(() => expect(s.loading).toBe(false));
    s.rangeKey = "90d";
    watchers.rangeKey();
    await vi.waitFor(() => expect(loadGameSection).toHaveBeenCalledTimes(2));
    expect(loadGameSection.mock.calls[1][2].bucket).toBe("week");
  });

  it("splits current and previous and derives averages and deltas", async () => {
    loadGameSection.mockResolvedValue(
      series([
        bucket("2026-08-10T00:00:00.000Z", "2026-08-11T00:00:00.000Z", 150, 9),
        bucket("2026-09-20T00:00:00.000Z", "2026-09-21T00:00:00.000Z", 180, 9),
      ]),
    );
    const { s } = section();
    await s.load(NOW);
    expect(s.averages).toEqual({ threeDart: 60, firstNine: 60 });
    expect(s.threeDartDelta).toBe(10);
    expect(s.firstNineDelta).toBe(10);
    expect(s.isEmpty).toBe(false);
  });

  it("shows empty state when no data", async () => {
    const { s } = section();
    s.rangeKey = "all";
    await s.load(NOW);
    expect(loadGameSection).toHaveBeenCalledTimes(1);
    expect(s.isEmpty).toBe(true);
    expect(s.error).toBeNull();
  });

  it("refetches week buckets for All Time when data spans under 4 months", async () => {
    loadGameSection
      .mockResolvedValueOnce(
        series([bucket("2026-08-31T22:00:00.000Z", "2026-09-30T22:00:00.000Z", 300, 9)]),
      )
      .mockResolvedValueOnce(
        series([bucket("2026-09-06T22:00:00.000Z", "2026-09-13T22:00:00.000Z", 300, 9)]),
      );
    const { s } = section();
    s.rangeKey = "all";
    await s.load(NOW);
    expect(loadGameSection).toHaveBeenCalledTimes(2);
    expect(loadGameSection.mock.calls[1][2]).toMatchObject({
      bucket: "week",
      from: "2026-08-31T22:00:00.000Z",
    });
    expect(s.bucket).toBe("week");
    expect(s.hasPrevious).toBe(false);
    expect(s.threeDartDelta).toBeNull();
  });

  it("does not refetch for Last 30 Days", async () => {
    loadGameSection.mockResolvedValue(
      series([bucket("2026-09-20T00:00:00.000Z", "2026-09-21T00:00:00.000Z", 180, 9)]),
    );
    const { s } = section();
    await s.load(NOW);
    expect(loadGameSection).toHaveBeenCalledTimes(1);
  });

  it("records an error and clears loading", async () => {
    loadGameSection.mockRejectedValue(new Error("boom"));
    const { s } = section();
    await s.load(NOW);
    expect(s.error).toBe("boom");
    expect(s.loading).toBe(false);
  });

  it("ignores a superseded response", async () => {
    let resolveSlow: (v: unknown) => void = () => {};
    loadGameSection
      .mockImplementationOnce(() => new Promise((r) => (resolveSlow = r)))
      .mockResolvedValueOnce(
        series([bucket("2026-09-20T00:00:00.000Z", "2026-09-21T00:00:00.000Z", 180, 9)]),
      );
    const { s } = section();
    const slow = s.load(NOW);
    s.rangeKey = "90d";
    await s.load(NOW);
    resolveSlow(
      series([bucket("2026-09-20T00:00:00.000Z", "2026-09-21T00:00:00.000Z", 30, 9)]),
    );
    await slow;
    expect(s.averages.threeDart).toBe(60);
    expect(s.bucket).toBe("week");
    expect(s.loading).toBe(false);
  });
});
```

Append to `app/tests/lib/client/alpine/register-route-data.test.ts`, importing `scoreTrendSection` from `@lib/stats/sections/score-trend.data` next to the other imports:

```ts
  it("registers scoreTrendSection as an Alpine data factory", () => {
    const data = vi.fn();
    registerRouteData({ data } as unknown as Alpine);
    expect(data).toHaveBeenCalledWith("scoreTrendSection", scoreTrendSection);
  });
```

- [ ] **Step 2: Run to see it fail**

Run from `app/`: `npx vitest run tests/lib/stats/sections/score-trend.data.test.ts tests/lib/client/alpine/register-route-data.test.ts`
Expected: FAIL, because the module can't be resolved and the factory isn't registered.

- [ ] **Step 3: Implement the factory**

`app/src/lib/stats/sections/score-trend.data.ts`:

```ts
import { loadGameSection } from "@lib/stats/load-game-section";
import {
  averageDelta,
  foldAverages,
  splitPeriods,
  trendChart,
  trendWindow,
  weekFallbackWindow,
} from "@lib/stats/sections/score-trend-window";
import type {
  TrendAverages,
  TrendBucket,
  TrendRangeKey,
  TrendWindow,
} from "@lib/stats/sections/score-trend-window";
import type { SeriesBucket } from "@lib/types";
import type { ChartSpec, ScoringTrendMetrics } from "@modules/types";

type TrendSeriesBucket = SeriesBucket<ScoringTrendMetrics>;

type WatchesRange = {
  $watch(key: "rangeKey", callback: () => void): void;
  load(): Promise<void>;
};

function fetchTrend(window: TrendWindow) {
  const { boundary: _boundary, ...range } = window;
  return loadGameSection<ScoringTrendMetrics>(
    "SCORE_TRAINING",
    "scoring-trend",
    range,
  );
}

/**
 * Score Training's score-trend section: fetches `scoring-trend` on mount and
 * on every range change, through the IndexedDB cache, and derives the period
 * averages, deltas and chart (`2026-10-01-score-training-trend-section-design.md`).
 */
export function scoreTrendSection() {
  let ticket = 0;
  return {
    rangeKey: "30d" as TrendRangeKey,
    loading: true,
    error: null as string | null,
    bucket: "day" as TrendBucket,
    tz: "",
    current: [] as TrendSeriesBucket[],
    previous: [] as TrendSeriesBucket[],
    hasPrevious: false,

    init(this: WatchesRange) {
      this.$watch("rangeKey", () => void this.load());
      void this.load();
    },

    async load(now: Date = new Date()) {
      const mine = ++ticket;
      this.loading = true;
      this.error = null;
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      try {
        let window = trendWindow(this.rangeKey, now, tz);
        let series = await fetchTrend(window);
        const fallback =
          window.bucket === "month"
            ? weekFallbackWindow(series.buckets, now, tz)
            : null;
        if (fallback !== null) {
          window = fallback;
          series = await fetchTrend(window);
        }
        if (mine !== ticket) return;
        const periods = splitPeriods(series.buckets, window.boundary);
        this.bucket = window.bucket;
        this.tz = tz;
        this.current = periods.current;
        this.previous = periods.previous;
        this.hasPrevious = window.boundary !== null;
      } catch (cause) {
        if (mine !== ticket) return;
        this.error = cause instanceof Error ? cause.message : "load failed";
      } finally {
        if (mine === ticket) this.loading = false;
      }
    },

    get averages(): TrendAverages {
      return foldAverages(this.current);
    },

    get previousAverages(): TrendAverages | null {
      return this.hasPrevious ? foldAverages(this.previous) : null;
    },

    get threeDartDelta(): number | null {
      return averageDelta(
        this.averages.threeDart,
        this.previousAverages?.threeDart ?? null,
      );
    },

    get firstNineDelta(): number | null {
      return averageDelta(
        this.averages.firstNine,
        this.previousAverages?.firstNine ?? null,
      );
    },

    get isEmpty(): boolean {
      return this.averages.threeDart === null;
    },

    get chart(): ChartSpec {
      return trendChart(this.current, this.bucket, this.tz);
    },
  };
}
```

If the `_boundary` destructure trips the fallow or unused-var gate, replace `fetchTrend`'s body with an explicit `{ from: window.from, to: window.to, bucket: window.bucket, tz: window.tz }`.

- [ ] **Step 4: Register it**

In `app/src/lib/client/alpine/register-route-data.ts`, add `import { scoreTrendSection } from "@lib/stats/sections/score-trend.data";` with the other imports, and `Alpine.data("scoreTrendSection", scoreTrendSection);` directly after `Alpine.data("statisticsRoutines", statisticsRoutines);`.

- [ ] **Step 5: Run the tests**

Run from `app/`: `npx vitest run tests/lib/stats/sections tests/lib/client/alpine/register-route-data.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/stats/sections/score-trend.data.ts app/tests/lib/stats/sections/score-trend.data.test.ts app/src/lib/client/alpine/register-route-data.ts app/tests/lib/client/alpine/register-route-data.test.ts
git commit -m "feat(stats): scoreTrendSection Alpine factory

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Section markup, Chart `table` prop, page wiring

There's no Astro test runner (D101). This task is verified by `astro check`, the gates and a manual run.

**Files:**
- Modify: `app/src/components/ui/Chart.astro`
- Modify: `app/src/components/layout/games/statistics/ScoreTrendSection.astro`
- Modify: `app/src/pages/statistics/index.astro` (Games tab, around 44–122)

**Interfaces:**
- Consumes: `scoreTrendSection()` (Task 5) and `TREND_RANGE_OPTIONS` (Task 4).

- [ ] **Step 1: Add the `table` prop to Chart**

In `Chart.astro`:
- Add the JSDoc line `@param {boolean} [table] Render the "Table view" disclosure (default true)`.
- Add `table?: boolean;` to `Props`.
- Add `table = true,` to the destructure.
- Wrap the `<details>…</details>` block in `{table && ( … )}`.

- [ ] **Step 2: Write the section**

`ScoreTrendSection.astro`:

```astro
---
/**
 * Score Training score-trend section: range picker, period 3-dart and
 * first-nine averages with deltas, and the trend chart. Self-fetching via
 * `scoreTrendSection()`.
 */
import Select from "@components/forms/Select.astro";
import ErrorAlert from "@components/ui/ErrorAlert.astro";
import Chart from "@components/ui/Chart.astro";
import { TREND_RANGE_OPTIONS } from "@lib/stats/sections/score-trend-window";

const tiles = [
  { label: "3-dart average", value: "averages.threeDart", delta: "threeDartDelta" },
  { label: "First nine", value: "averages.firstNine", delta: "firstNineDelta" },
];
---

<section
  class="glass space-y-3 rounded-2xl p-4"
  x-data="scoreTrendSection()"
>
  <h2 class="text-sm text-foreground">Score trend</h2>
  <Select
    options={TREND_RANGE_OPTIONS}
    model="rangeKey"
    ariaLabel="Range"
  />
  <ErrorAlert
    showExpr="error"
    textExpr="error"
  />
  <div
    class="space-y-2"
    x-show="loading"
    x-cloak
  >
    <div class="h-12 animate-pulse rounded bg-muted-foreground/20"></div>
    <div class="h-48 animate-pulse rounded bg-muted-foreground/20"></div>
  </div>
  <div
    class="space-y-3"
    x-show="!loading && !error"
    x-cloak
  >
    <div class="grid grid-cols-2 gap-2 text-center text-sm text-muted-foreground">
      {
        tiles.map((tile) => (
          <div>
            <span
              class="block text-lg text-foreground"
              x-text={`${tile.value} !== null ? ${tile.value}.toFixed(1) : '—'`}
            />
            <span
              class="block text-xs"
              x-show={`${tile.delta} !== null`}
              x-cloak
              :class={`${tile.delta} >= 0 ? 'text-success' : 'text-error'`}
              x-text={`${tile.delta} !== null ? (${tile.delta} >= 0 ? '+' : '') + ${tile.delta}.toFixed(1) : ''`}
            />
            {tile.label}
          </div>
        ))
      }
    </div>
    <p
      class="text-sm text-muted-foreground"
      x-show="isEmpty"
      x-cloak
    >
      No sessions in range.
    </p>
    <div
      x-show="!isEmpty"
      x-cloak
    >
      <Chart
        flat
        table={false}
        specExpr="chart"
        formatter="one-decimal"
      />
    </div>
  </div>
</section>
```

If `check-style-tokens.sh` rejects `bg-muted-foreground/20`, use the exact skeleton classes from `components/layout/games/StatRowSkeleton.astro` (`bg-muted-foreground/80 animate-pulse rounded`).

- [ ] **Step 3: Wire the page**

In `app/src/pages/statistics/index.astro`:
- Add `import ScoreTrainingStatsOverview from "@components/layout/games/statistics/ScoreTrainingStatsOverview.astro";`.
- Inside the Games tab `div`, keep the `Select`. Wrap everything after it in two templates: the two `ErrorAlert`s and the `x-show="!$store.gameStats.loading"` block.

```astro
        <template x-if="game === 'SCORE_TRAINING_V1'">
          <ScoreTrainingStatsOverview />
        </template>
        <template x-if="game !== 'SCORE_TRAINING_V1'">
          <div class="space-y-4">
            {/* existing two ErrorAlerts + the !$store.gameStats.loading block, unchanged */}
          </div>
        </template>
```

The `{/* … */}` line above is a plan marker, not code to paste. Move the existing markup there verbatim. An `x-if` template needs exactly one root element, which is why there's a wrapper `div`.

- [ ] **Step 4: Type-check and gates**

Run from `app/`: `npx astro check --minimumFailingSeverity hint`
Expected: 0 errors, 0 warnings, 0 hints.

Run from the repo root: `bash scripts/check-astro-conventions.sh && bash scripts/check-style-tokens.sh && bash scripts/check-astro-class-composition.sh`
Expected: no `FAIL`.

- [ ] **Step 5: Manual check in the running app**

Run from `app/`: `astro dev --background`, sign in, open `/statistics`.

Expected:
- The browser Network tab shows exactly one `/api/statistics/games/SCORE_TRAINING/sections/scoring-trend` request (two only for 1y/All with under 4 data months), and no `/sessions` request.
- Switching to 501 loads the generic cards. Switching back remounts the section.
- The range picker reloads.
- There's no "Table view" disclosure in the section.

Stop the server afterwards with `astro dev stop`.

- [ ] **Step 6: Commit**

```bash
git add app/src/components/ui/Chart.astro app/src/components/layout/games/statistics/ScoreTrendSection.astro app/src/pages/statistics/index.astro
git commit -m "feat(stats): score training score trend section on /statistics

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Docs, decision, gates, PR

**Files:**
- Modify: `docs/architecture/10-Statistics/01-Section-Catalog.md` (Score Training row and the section after the table, around line 154)
- Modify: `docs/architecture/10-Statistics/00-Overview.md` §7 (line 258 onwards)
- Modify: `decisions/frontend/alpine.md` (append)

- [ ] **Step 1: Section catalog**

After the per-game table in `01-Section-Catalog.md`, add this paragraph:

```markdown
Score Training renders a dedicated layout on `/statistics` (`ScoreTrainingStatsOverview.astro`) instead of the generic cards: an ordered list of self-fetching section components. Built so far: `scoring-trend` as the score-trend section (range picker Last 30 Days / Last 90 Days / Last Year / All Time; period 3-dart and first-nine averages with delta vs the preceding equal period; no band counts). First nine is the owner's first three visits of each `LEG` or `EXERCISE_BLOCK` stage. The remaining listed sections are not yet rendered for Score Training (D380).
```

- [ ] **Step 2: Overview §7**

Append to §7 of `00-Overview.md`:

```markdown
**Dedicated layouts.** A game in `DEDICATED_STATS_LAYOUTS` (`lib/stats/constants.ts`) is not loaded by the `gameStats` store. Its layout is mounted with `x-if` only while selected, and each section's own Alpine factory (`lib/stats/sections/*.data.ts`) fetches in `init()` through `loadGameSection` (`lib/stats/load-game-section.ts`), which is the same cached read path the store uses. A section owns its range, loading and error state, so a failure stays in its card (D380).
```

- [ ] **Step 3: Decision**

Before writing, confirm the id is free: `grep -rn "D380" decisions DECISIONS.md`. If it's taken, use the next free id and update Steps 1–2. Then append to `decisions/frontend/alpine.md`:

```markdown
### D380 — Dedicated statistics layouts: one self-fetching Alpine factory per section
Status: Accepted · Date: 2026-10-01
Decision: A game listed in `DEDICATED_STATS_LAYOUTS` renders its own layout on `/statistics`, mounted by `x-if` only while selected; `gameStats.selectGame` returns without fetching for it. Each section is its own component with its own `*.data.ts` factory that fetches in `init()` and on its own range change through the shared cached `loadGameSection`. Score Training is first, with the score-trend section.
Reason: one store loading every section couples unrelated cards and fetches cards that aren't shown; per-section factories keep fetch, state and failure local and let sections be added one at a time.
Consequences: the default `/statistics` state fetches only the score-trend section; Score Training has no session list or other cards until they are built as sections. Remounting refetches through the IndexedDB cache.
Supersedes: none (refines D379).
```

- [ ] **Step 4: Run every gate**

Load the `run-all-gates` and `validate-app` skills and follow them. At minimum, from `app/`:

```bash
npm run format
npm run validate:app
```

Expected: every step exits 0, and `astro check` reports 0 errors, 0 warnings, 0 hints. Commit any formatting diff.

- [ ] **Step 5: Context maintenance**

Load the `context-maintenance` skill and do every step it lists: CLAUDE.md sync, context-map registration of the new `lib/stats/sections/` path if the map lists stats files, the decision entry above, and discovered-work issues. File follow-up issues for:
- the remaining Score Training sections (treble rate, heatmap, session result, completion, volume);
- the Score Training session list;
- an executed 1v1 first-9 fixture test (Review Focus 5).

- [ ] **Step 6: Commit and open the PR**

```bash
git add docs/architecture/10-Statistics decisions/frontend/alpine.md
git commit -m "docs(stats): dedicated score training layout and D380

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Then follow `superpowers:finishing-a-development-branch` together with the `finishing-a-dart-branch` skill (Option 2: push and open a PR). The PR body must include:
- the itest status from Task 1 Step 5;
- the manual check from Task 6 Step 5;
- the Review Focus 5 note;
- this line at the end: `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.
