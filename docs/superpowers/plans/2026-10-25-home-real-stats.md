# Home real stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Home hero, daily-average and landing-heatmap fixtures with the player's real data from one new endpoint, `GET /api/statistics/home`.

**Architecture:** A pure module computes the local-day windows and shapes rows into the response. Two repository readers feed it: a day-bucketed visit-scoring read (the existing `findVisitScoring` body, extracted to take a `where` clause) and a heatmap cell read, both scoped to completed `501` and `SCORE_TRAINING` sessions. A service composes them, a route exposes them, and `homeSnapshot().init()` fetches the endpoint beside the overview call.

**Tech Stack:** Astro, Alpine.js, TypeScript, Drizzle on Neon Postgres views, Zod, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-25-home-real-stats-design.md`

## Global Constraints

- Scope: completed sessions of game types `501` and `SCORE_TRAINING`, `input_mode_key = VISUAL_BOARD`, any context. No abandoned sessions.
- Windows: current = last 30 local days including today; previous = the 30 before; daily = last 7 local days ending today; landing = the current 30 days. All local days are in the caller's `tz`.
- First-9 and daily averages are `3 × points / darts`; a window or day with no darts is `null`, never `0`.
- Bar scale stays 50–75 mapped to 0–100%, clamped.
- Read endpoints are view-backed (`v_*`); no migration, no new view.
- No `//` or `/* */` comments inside function bodies under `app/src/**/*.ts`. Doc comments describe the declaration, not decision history.
- Types live in `types.ts` files; type barrels are checked (`check-type-barrels`).
- `.astro` markup has no unit tests (D101); `x-show` needs `x-cloak`.
- Tailwind: semantic tokens only, no arbitrary values.
- TDD: failing test first, watched failing, then the minimal code (`app/CLAUDE.md` §Test-Driven Development). Commands run from `app/`.
- Pre-commit runs prettier plus the structural gates and takes minutes. Run `git commit` with `run_in_background: true` and wait for it.
- Export only what another file consumes (the fallow gate flags unused exports).

## Review Focus

- A DST transition day (25 hours) inside the window: window bounds and day keys must stay on local midnights. Pinned in Task 1.
- A player with no scoring sessions: all values `null`, hero `—`, cards hidden, no exception. Pinned in Tasks 1 and 4.
- Only one 30-day window has data: hero value shown, delta line hidden but its space kept (no layout jump). Pinned in Task 4.
- Darts with no stored location in the 30 days: they must not reach the heatmap grouping (`FLOOR(NULL)` would throw). Pinned in Task 2.
- A missing or invalid `tz` on the route: `VALIDATION_FAILED`, service not called. Pinned in Task 3.

---

### Task 1: Pure module `home-stats.module.ts`

**Files:**
- Create: `app/src/modules/stats/home-stats.module.ts`
- Modify: `app/src/modules/stats/types.ts` (append after `HeatmapMetrics`, ~line 576)
- Test: `app/tests/modules/stats/home-stats.module.test.ts`

**Interfaces:**
- Consumes: `VisitScoringRow`, `HeatmapCellRow`, `GameTypeKey` from `@modules/types` / `@lib/types`.
- Produces (`@modules/types`):
  - `HomeWindows = { today: string; currentStartDate: string; previousStartDate: string; dailyStartDate: string; currentFrom: string; previousFrom: string; to: string }` (dates `YYYY-MM-DD`, instants ISO UTC)
  - `HomeDay = { date: string; weekday: number; value: number | null }`
  - `HomeStats = { firstNine: { current: number | null; previous: number | null; delta: number | null }; daily: HomeDay[]; landing: { cellMm: number; cells: [number, number, number][] } }`
  - `HomeScope = { playerId: string; gameTypeKeys: GameTypeKey[]; from: string; to: string }`
- Produces (module): `HOME_GAME_TYPES: readonly ["501", "SCORE_TRAINING"]`, `HOME_CELL_MM = 4`, `homeWindows(now: Date, tz: string): HomeWindows`, `shapeHomeStats(input: { rows: readonly VisitScoringRow[]; cells: readonly HeatmapCellRow[]; windows: HomeWindows; tz: string }): HomeStats`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from "vitest";
import {
  HOME_CELL_MM,
  HOME_GAME_TYPES,
  homeWindows,
  shapeHomeStats,
} from "@modules/stats/home-stats.module";
import type { VisitScoringRow } from "@modules/types";

const TZ = "Europe/Amsterdam";
const NOW = new Date("2026-10-25T10:00:00.000Z");

function row(
  bucketStart: string,
  v: {
    points: number;
    darts: number;
    firstNinePoints: number;
    firstNineDarts: number;
  },
): VisitScoringRow {
  return {
    bucketStart,
    bucketEnd: bucketStart,
    ton: 0,
    tonForty: 0,
    oneEighty: 0,
    ...v,
  };
}

describe("homeWindows", () => {
  it("anchors every bound on a local midnight, across the autumn DST day", () => {
    expect(homeWindows(NOW, TZ)).toEqual({
      today: "2026-10-25",
      currentStartDate: "2026-09-26",
      previousStartDate: "2026-08-27",
      dailyStartDate: "2026-10-19",
      currentFrom: "2026-09-25T22:00:00.000Z",
      previousFrom: "2026-08-26T22:00:00.000Z",
      to: "2026-10-25T23:00:00.000Z",
    });
  });

  it("uses the caller's local date, not the UTC date", () => {
    const late = new Date("2026-10-25T23:30:00.000Z");
    expect(homeWindows(late, TZ).today).toBe("2026-10-26");
    expect(homeWindows(late, "America/New_York").today).toBe("2026-10-25");
  });
});

describe("shapeHomeStats", () => {
  const windows = homeWindows(NOW, TZ);

  it("averages first nine per window and takes the difference", () => {
    const stats = shapeHomeStats({
      rows: [
        row("2026-10-24T22:00:00.000Z", {
          points: 300,
          darts: 9,
          firstNinePoints: 270,
          firstNineDarts: 9,
        }),
        row("2026-09-19T22:00:00.000Z", {
          points: 200,
          darts: 9,
          firstNinePoints: 180,
          firstNineDarts: 9,
        }),
        row("2026-08-19T22:00:00.000Z", {
          points: 999,
          darts: 9,
          firstNinePoints: 999,
          firstNineDarts: 9,
        }),
      ],
      cells: [],
      windows,
      tz: TZ,
    });
    expect(stats.firstNine).toEqual({ current: 90, previous: 60, delta: 30 });
  });

  it("returns seven days ending today with null for empty days", () => {
    const stats = shapeHomeStats({
      rows: [
        row("2026-10-24T22:00:00.000Z", {
          points: 300,
          darts: 9,
          firstNinePoints: 270,
          firstNineDarts: 9,
        }),
        row("2026-10-22T22:00:00.000Z", {
          points: 150,
          darts: 6,
          firstNinePoints: 150,
          firstNineDarts: 6,
        }),
      ],
      cells: [],
      windows,
      tz: TZ,
    });
    expect(stats.daily).toHaveLength(7);
    expect(stats.daily[0]).toEqual({
      date: "2026-10-19",
      weekday: 1,
      value: null,
    });
    expect(stats.daily[4]).toEqual({
      date: "2026-10-23",
      weekday: 5,
      value: 75,
    });
    expect(stats.daily[6]).toEqual({
      date: "2026-10-25",
      weekday: 7,
      value: 100,
    });
  });

  it("is all null and empty with no data", () => {
    const stats = shapeHomeStats({ rows: [], cells: [], windows, tz: TZ });
    expect(stats.firstNine).toEqual({
      current: null,
      previous: null,
      delta: null,
    });
    expect(stats.daily.map((d) => d.value)).toEqual(Array(7).fill(null));
    expect(stats.landing).toEqual({ cellMm: HOME_CELL_MM, cells: [] });
  });

  it("has a null delta when only one window has darts", () => {
    const stats = shapeHomeStats({
      rows: [
        row("2026-10-24T22:00:00.000Z", {
          points: 300,
          darts: 9,
          firstNinePoints: 270,
          firstNineDarts: 9,
        }),
      ],
      cells: [],
      windows,
      tz: TZ,
    });
    expect(stats.firstNine).toEqual({ current: 90, previous: null, delta: null });
  });

  it("maps heatmap rows to [ix, iy, darts] cells", () => {
    const stats = shapeHomeStats({
      rows: [],
      cells: [
        { ix: -1, iy: -26, darts: 30 },
        { ix: 0, iy: 0, darts: 6 },
      ],
      windows,
      tz: TZ,
    });
    expect(stats.landing.cells).toEqual([
      [-1, -26, 30],
      [0, 0, 6],
    ]);
  });
});

describe("constants", () => {
  it("scopes home to the scoring games", () => {
    expect(HOME_GAME_TYPES).toEqual(["501", "SCORE_TRAINING"]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd app && npx vitest run tests/modules/stats/home-stats.module.test.ts`
Expected: FAIL, cannot resolve `@modules/stats/home-stats.module`.

- [ ] **Step 3: Add the types** to `app/src/modules/stats/types.ts` after `HeatmapMetrics`:

```ts
/** The local-day windows `GET /api/statistics/home` reads, in the caller's time zone. */
export type HomeWindows = {
  today: string;
  currentStartDate: string;
  previousStartDate: string;
  dailyStartDate: string;
  currentFrom: string;
  previousFrom: string;
  to: string;
};

/** One day of the Home daily-average card: ISO weekday 1 (Mon) to 7 (Sun), `null` with no darts. */
export type HomeDay = { date: string; weekday: number; value: number | null };

/** The `GET /api/statistics/home` payload. */
export type HomeStats = {
  firstNine: {
    current: number | null;
    previous: number | null;
    delta: number | null;
  };
  daily: HomeDay[];
  landing: { cellMm: number; cells: [number, number, number][] };
};

/** The shared filter of the Home readers: one player, several game types, completed board sessions in `[from, to)`. */
export type HomeScope = {
  playerId: string;
  gameTypeKeys: GameTypeKey[];
  from: string;
  to: string;
};
```

- [ ] **Step 4: Write the module** `app/src/modules/stats/home-stats.module.ts`:

```ts
import type {
  HeatmapCellRow,
  HomeDay,
  HomeStats,
  HomeWindows,
  VisitScoringRow,
} from "@modules/types";

export const HOME_GAME_TYPES = ["501", "SCORE_TRAINING"] as const;

export const HOME_CELL_MM = 4;

const WINDOW_DAYS = 30;
const DAILY_DAYS = 7;
const MINUTE_MS = 60_000;

type DayScoring = {
  date: string;
  points: number;
  darts: number;
  firstNinePoints: number;
  firstNineDarts: number;
};

function localDate(instant: Date, tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(instant);
}

function addDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

function isoWeekday(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return weekday === 0 ? 7 : weekday;
}

function offsetMinutes(instant: Date, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return (asUtc - Math.floor(instant.getTime() / 1000) * 1000) / MINUTE_MS;
}

function startOfLocalDay(date: string, tz: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  const guess = Date.UTC(year, month - 1, day);
  const first = guess - offsetMinutes(new Date(guess), tz) * MINUTE_MS;
  return new Date(guess - offsetMinutes(new Date(first), tz) * MINUTE_MS);
}

/**
 * The Home read windows for `now` in `tz`: the last 30 local days, the 30
 * before, and the last 7, each bound on a local midnight; `to` is the start of
 * tomorrow.
 */
export function homeWindows(now: Date, tz: string): HomeWindows {
  const today = localDate(now, tz);
  const currentStartDate = addDays(today, -(WINDOW_DAYS - 1));
  const previousStartDate = addDays(today, -(2 * WINDOW_DAYS - 1));
  return {
    today,
    currentStartDate,
    previousStartDate,
    dailyStartDate: addDays(today, -(DAILY_DAYS - 1)),
    currentFrom: startOfLocalDay(currentStartDate, tz).toISOString(),
    previousFrom: startOfLocalDay(previousStartDate, tz).toISOString(),
    to: startOfLocalDay(addDays(today, 1), tz).toISOString(),
  };
}

function dayScoring(rows: readonly VisitScoringRow[], tz: string): DayScoring[] {
  return rows.map((row) => ({
    date: localDate(new Date(row.bucketStart), tz),
    points: row.points,
    darts: row.darts,
    firstNinePoints: row.firstNinePoints,
    firstNineDarts: row.firstNineDarts,
  }));
}

function firstNineAverage(
  days: readonly DayScoring[],
  fromDate: string,
  toDate: string,
): number | null {
  let points = 0;
  let darts = 0;
  for (const day of days) {
    if (day.date >= fromDate && day.date <= toDate) {
      points += day.firstNinePoints;
      darts += day.firstNineDarts;
    }
  }
  return darts === 0 ? null : (3 * points) / darts;
}

function dailyAverages(
  days: readonly DayScoring[],
  windows: HomeWindows,
): HomeDay[] {
  return Array.from({ length: DAILY_DAYS }, (_, index) => {
    const date = addDays(windows.dailyStartDate, index);
    const day = days.find((candidate) => candidate.date === date);
    return {
      date,
      weekday: isoWeekday(date),
      value: day && day.darts > 0 ? (3 * day.points) / day.darts : null,
    };
  });
}

/**
 * Folds the day-bucketed scoring rows and heatmap cells into the Home
 * payload: first-9 average per window with their difference, seven daily
 * averages, and the landing cells. A window or day with no darts is `null`.
 */
export function shapeHomeStats(input: {
  rows: readonly VisitScoringRow[];
  cells: readonly HeatmapCellRow[];
  windows: HomeWindows;
  tz: string;
}): HomeStats {
  const { rows, cells, windows, tz } = input;
  const days = dayScoring(rows, tz);
  const current = firstNineAverage(days, windows.currentStartDate, windows.today);
  const previous = firstNineAverage(
    days,
    windows.previousStartDate,
    addDays(windows.currentStartDate, -1),
  );
  return {
    firstNine: {
      current,
      previous,
      delta: current === null || previous === null ? null : current - previous,
    },
    daily: dailyAverages(days, windows),
    landing: {
      cellMm: HOME_CELL_MM,
      cells: cells.map((cell) => [cell.ix, cell.iy, cell.darts]),
    },
  };
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd app && npx vitest run tests/modules/stats/home-stats.module.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 6: Format and commit**

```bash
cd app && npx prettier --write src/modules/stats/home-stats.module.ts src/modules/stats/types.ts tests/modules/stats/home-stats.module.test.ts && cd ..
git add app/src/modules/stats app/tests/modules/stats/home-stats.module.test.ts
git commit -m "feat(stats): home stats windows and shaping module (#808)"
```

---

### Task 2: Repository readers

**Files:**
- Modify: `app/src/repositories/statistics.repository.ts` (`findVisitScoring`, ~lines 593-665; add readers after `findHeatmapCells`, ~line 1014)
- Test: `app/tests/repositories/statistics.repository.test.ts`
- Test: `app/tests/integration/visit-scoring.itest.ts`

**Interfaces:**
- Consumes: `HomeScope` (Task 1), existing `Db`, `Bucket`, `bucketExprs`, `nonNull`, `mapVisitScoringRow`, `VisitScoringRow`, `HeatmapCellRow`.
- Produces:
  - `findHomeScoring(db: Db, q: HomeScope & { tz: string; bands: readonly [number, number, number] }): Promise<VisitScoringRow[]>` (day buckets)
  - `findHomeHeatmapCells(db: Db, q: HomeScope & { cellMm: number }): Promise<HeatmapCellRow[]>`
  - `findVisitScoring` unchanged signature and SQL.

- [ ] **Step 1: Write the failing tests.** Add to the import list of `statistics.repository.test.ts` `findHomeScoring` and `findHomeHeatmapCells`, then append:

```ts
const homeScope = {
  playerId: "p1",
  gameTypeKeys: ["501", "SCORE_TRAINING"] as ("501" | "SCORE_TRAINING")[],
  from: "2026-08-26T22:00:00.000Z",
  to: "2026-10-25T23:00:00.000Z",
};

describe("findHomeScoring", () => {
  const bands = [100, 140, 180] as const;

  it("scopes to completed board sessions of the listed game types", async () => {
    const { db, statements } = renderingDb([]);
    await findHomeScoring(db, { ...homeScope, tz: "Europe/Amsterdam", bands });
    const sql = onlyStatement(statements);
    expect(sql).toContain('"v_player_visit_facts"');
    expect(sql).toContain('"v_stats_session_facts"');
    expect(sql).toMatch(/"game_type_key" in \(/i);
    const params = statements[0].params;
    expect(params).toEqual(
      expect.arrayContaining(["p1", "501", "SCORE_TRAINING", "COMPLETED", "VISUAL_BOARD"]),
    );
  });

  it("buckets by local day with the tz as a literal, not a bind param", async () => {
    const { db, statements } = renderingDb([]);
    await findHomeScoring(db, { ...homeScope, tz: "Europe/Amsterdam", bands });
    expectLiteralTzGroupBy(onlyStatement(statements), "day");
  });
});

describe("findHomeHeatmapCells", () => {
  it("reads located darts of the listed game types from v_stats_dart_facts", async () => {
    const { db, statements } = renderingDb([]);
    await findHomeHeatmapCells(db, { ...homeScope, cellMm: 4 });
    const sql = onlyStatement(statements);
    expect(sql).toContain('"v_stats_dart_facts"');
    expect(sql).toMatch(/"game_type_key" in \(/i);
    expect(sql).toMatch(/"location_x" is not null/i);
    expect(sql).toMatch(/"location_y" is not null/i);
    expect(statements[0].params).toEqual(
      expect.arrayContaining(["p1", "501", "SCORE_TRAINING", "COMPLETED"]),
    );
  });

  it("maps rows to numeric cells", async () => {
    const { db } = renderingDb([[-1, -26, "30"]]);
    const cells = await findHomeHeatmapCells(db, { ...homeScope, cellMm: 4 });
    expect(cells).toEqual([{ ix: -1, iy: -26, darts: 30 }]);
  });
});
```

Also append to `visit-scoring.itest.ts` (imports `findHomeScoring` alongside `findVisitScoring`):

```ts
describe("findHomeScoring (#808)", () => {
  it("folds 501 and Score Training into one local-day row", async () => {
    const rows = await inRolledBackTx(async (db: Db) => {
      await seedWorld(db);
      await seedSession(db, {
        base: 0x80810,
        ruleset: "501_V1",
        stageType: "LEG",
        ownerScores: [10, 20, 30, 40],
        guestScores: [100, 100, 100, 100],
      });
      await seedSession(db, {
        base: 0x80820,
        ruleset: "SCORE_TRAINING_V1",
        stageType: "EXERCISE_BLOCK",
        ownerScores: [5, 6, 7, 8],
        guestScores: [90, 90, 90, 90],
      });
      return findHomeScoring(db, {
        playerId: OWNER,
        gameTypeKeys: ["501", "SCORE_TRAINING"],
        ...RANGE,
        tz: "Europe/Amsterdam",
        bands: BANDS,
      });
    });
    const totals = rows.reduce(
      (sum, r) => ({
        points: sum.points + r.points,
        firstNinePoints: sum.firstNinePoints + r.firstNinePoints,
      }),
      { points: 0, firstNinePoints: 0 },
    );
    expect(totals).toEqual({ points: 126, firstNinePoints: 78 });
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd app && npx vitest run tests/repositories/statistics.repository.test.ts -t "findHome"`
Expected: FAIL, `findHomeScoring is not a function` (import undefined).

- [ ] **Step 3: Extract the shared body.** In `statistics.repository.ts`, turn `findVisitScoring` into a thin wrapper over a private helper. The helper keeps the existing body byte for byte except its first line (`const whereClause = sessionScopeWhere(q);`) is replaced by a parameter:

```ts
type VisitScoringQuery = {
  from: string;
  to: string;
  bucket: Bucket;
  tz: string | undefined;
  bands: readonly [number, number, number];
};

async function selectVisitScoring(
  db: Db,
  whereClause: SQL | undefined,
  q: VisitScoringQuery,
): Promise<VisitScoringRow[]> {
  /* existing body of findVisitScoring from `const scoped = db` to the final `return rows.map(mapVisitScoringRow);`, unchanged */
}

export async function findVisitScoring(
  db: Db,
  q: SessionScope & {
    bucket: Bucket;
    tz: string | undefined;
    bands: readonly [number, number, number];
  },
): Promise<VisitScoringRow[]> {
  return selectVisitScoring(db, sessionScopeWhere(q), q);
}
```

Keep the existing JSDoc above `findVisitScoring`. Do not touch its tests.

- [ ] **Step 4: Add the home readers** (import `HomeScope` from `@modules/types` and `inArray` is already imported):

```ts
function homeSessionWhere(scope: HomeScope) {
  return and(
    eq(vStatsSessionFacts.playerId, scope.playerId),
    inArray(vStatsSessionFacts.gameTypeKey, scope.gameTypeKeys),
    gte(vStatsSessionFacts.completedAt, scope.from),
    lt(vStatsSessionFacts.completedAt, scope.to),
    eq(vStatsSessionFacts.statusKey, "COMPLETED"),
    eq(vStatsSessionFacts.inputModeKey, "VISUAL_BOARD"),
  );
}

/**
 * Day-bucketed visit-scoring sums for the Home page over the completed board
 * sessions of `scope.gameTypeKeys`; rows are the same shape as
 * `findVisitScoring`'s.
 */
export async function findHomeScoring(
  db: Db,
  q: HomeScope & {
    tz: string;
    bands: readonly [number, number, number];
  },
): Promise<VisitScoringRow[]> {
  return selectVisitScoring(db, homeSessionWhere(q), {
    from: q.from,
    to: q.to,
    bucket: "day",
    tz: q.tz,
    bands: q.bands,
  });
}

/**
 * Located-dart counts per `cellMm` grid cell for the Home landing heatmap,
 * over the completed darts of `scope.gameTypeKeys`.
 */
export async function findHomeHeatmapCells(
  db: Db,
  q: HomeScope & { cellMm: number },
): Promise<HeatmapCellRow[]> {
  const ixExpr = sql<number>`FLOOR(${vStatsDartFacts.locationX} / ${q.cellMm})::integer`;
  const iyExpr = sql<number>`FLOOR(${vStatsDartFacts.locationY} / ${q.cellMm})::integer`;

  const rows = await db
    .select({
      ix: ixExpr,
      iy: iyExpr,
      darts: sql<number>`count(*)::integer`,
    })
    .from(vStatsDartFacts)
    .where(
      and(
        eq(vStatsDartFacts.playerId, q.playerId),
        inArray(vStatsDartFacts.gameTypeKey, q.gameTypeKeys),
        gte(vStatsDartFacts.completedAt, q.from),
        lt(vStatsDartFacts.completedAt, q.to),
        eq(vStatsDartFacts.statusKey, "COMPLETED"),
        isNotNull(vStatsDartFacts.locationX),
        isNotNull(vStatsDartFacts.locationY),
      ),
    )
    .groupBy(sql`1`, sql`2`);

  return rows.map((row) => ({
    ix: Number(nonNull(row.ix, "ix")),
    iy: Number(nonNull(row.iy, "iy")),
    darts: Number(nonNull(row.darts, "darts")),
  }));
}
```

- [ ] **Step 5: Run to verify they pass, and the old ones still do**

Run: `cd app && npx vitest run tests/repositories/statistics.repository.test.ts`
Expected: PASS, including every pre-existing `findVisitScoring` test (the proof the extraction changed nothing). If the "maps rows" test's fake row shape does not match how `renderingDb` returns array rows, copy the row shape from the existing `findHeatmapCells` test in the same file.

Integration: if a migrated `DATABASE_URL` exists, run `cd app && npm run test:integration -- visit-scoring`; expected PASS. With no database (as in cloud sessions) it runs in CI via `.github/workflows/integration.yml`; say so in the PR.

- [ ] **Step 6: Commit**

```bash
cd app && npx prettier --write src/repositories/statistics.repository.ts tests/repositories/statistics.repository.test.ts tests/integration/visit-scoring.itest.ts && cd ..
git add app/src/repositories/statistics.repository.ts app/tests/repositories/statistics.repository.test.ts app/tests/integration/visit-scoring.itest.ts
git commit -m "feat(stats): home scoring and heatmap readers (#808)"
```

---

### Task 3: Service, schema and route

**Files:**
- Modify: `app/src/services/statistics.service.ts` (add `getHomeStats` after `getStatisticsOverview`; extend imports)
- Modify: `app/src/pages/api/statistics/types.ts` (append schemas)
- Create: `app/src/pages/api/statistics/home.ts`
- Test: `app/tests/services/statistics.service.test.ts`
- Test: `app/tests/pages/api/statistics/home.test.ts`

**Interfaces:**
- Consumes: `findHomeScoring`, `findHomeHeatmapCells` (Task 2), `homeWindows`, `shapeHomeStats`, `HOME_GAME_TYPES`, `HOME_CELL_MM` (Task 1), `SCORE_BANDS`, `isValidTimeZone` (private in `types.ts`).
- Produces:
  - `getHomeStats(playerId: string, q: { tz: string; now: Date }): Promise<ServiceResult<HomeStats>>`
  - `StatisticsHomeQuery` (`{ tz: string }`, strict), `StatisticsHomeResponse`, `type StatisticsHomeResponseData`, exported from `@routes/types`
  - `GET /api/statistics/home?tz=<IANA>` → `{ data: StatisticsHomeResponseData }`

- [ ] **Step 1: Write the failing tests.**

Service: add `findHomeScoring: vi.fn(), findHomeHeatmapCells: vi.fn(),` to the `vi.mock("@repositories/statistics.repository", …)` factory in `statistics.service.test.ts`, add `getHomeStats` to the service import list, and append:

```ts
describe("getHomeStats", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reads the 60-day scoring window and the 30-day heatmap in the caller's tz", async () => {
    vi.mocked(repo.findHomeScoring).mockResolvedValue([]);
    vi.mocked(repo.findHomeHeatmapCells).mockResolvedValue([
      { ix: 0, iy: 0, darts: 2 },
    ]);

    const result = await getHomeStats("player-1", {
      tz: "Europe/Amsterdam",
      now: new Date("2026-10-25T10:00:00.000Z"),
    });

    expect(repo.findHomeScoring).toHaveBeenCalledWith(
      {},
      {
        playerId: "player-1",
        gameTypeKeys: ["501", "SCORE_TRAINING"],
        from: "2026-08-26T22:00:00.000Z",
        to: "2026-10-25T23:00:00.000Z",
        tz: "Europe/Amsterdam",
        bands: SCORE_BANDS,
      },
    );
    expect(repo.findHomeHeatmapCells).toHaveBeenCalledWith(
      {},
      {
        playerId: "player-1",
        gameTypeKeys: ["501", "SCORE_TRAINING"],
        from: "2026-09-25T22:00:00.000Z",
        to: "2026-10-25T23:00:00.000Z",
        cellMm: 4,
      },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.landing.cells).toEqual([[0, 0, 2]]);
      expect(result.data.daily).toHaveLength(7);
    }
  });
});
```

Route test `app/tests/pages/api/statistics/home.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@services/statistics.service", () => ({ getHomeStats: vi.fn() }));

import { getHomeStats } from "@services/statistics.service";
import { GET } from "@routes/statistics/home";

const locals = {
  requestId: "req-1",
  auth: { authUserId: "auth-1", playerId: "player-1" },
};

function makeUrl(query: Record<string, string>) {
  const url = new URL("http://localhost/api/statistics/home");
  for (const [key, value] of Object.entries(query))
    url.searchParams.set(key, value);
  return url;
}

describe("GET /api/statistics/home", () => {
  beforeEach(() => vi.clearAllMocks());

  it("422s without a tz", async () => {
    const response = await GET({ locals, params: {}, url: makeUrl({}) } as never);
    expect(response.status).toBe(422);
    expect(getHomeStats).not.toHaveBeenCalled();
  });

  it("422s on an unknown tz", async () => {
    const response = await GET({
      locals,
      params: {},
      url: makeUrl({ tz: "Mars/Olympus" }),
    } as never);
    expect(response.status).toBe(422);
    expect(getHomeStats).not.toHaveBeenCalled();
  });

  it("422s on an unexpected param", async () => {
    const response = await GET({
      locals,
      params: {},
      url: makeUrl({ tz: "Europe/Amsterdam", from: "2026-01-01T00:00:00Z" }),
    } as never);
    expect(response.status).toBe(422);
  });

  it("returns the caller's home stats", async () => {
    const stats = {
      firstNine: { current: 90, previous: 60, delta: 30 },
      daily: [],
      landing: { cellMm: 4, cells: [] },
    };
    vi.mocked(getHomeStats).mockResolvedValue({ ok: true, data: stats });

    const response = await GET({
      locals,
      params: {},
      url: makeUrl({ tz: "Europe/Amsterdam" }),
    } as never);

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect((await response.json()).data).toEqual(stats);
    expect(getHomeStats).toHaveBeenCalledWith("player-1", {
      tz: "Europe/Amsterdam",
      now: expect.any(Date),
    });
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd app && npx vitest run tests/services/statistics.service.test.ts tests/pages/api/statistics/home.test.ts`
Expected: FAIL (`getHomeStats` undefined; route module not found).

- [ ] **Step 3: Add the schemas** to `app/src/pages/api/statistics/types.ts` (after `StatisticsOverviewResponseData`; `isValidTimeZone` is declared below in the same file, a hoisted function, so order is fine):

```ts
export const StatisticsHomeQuery = z
  .object({
    tz: z
      .string()
      .refine(isValidTimeZone, "tz must be a valid IANA time zone"),
  })
  .strict();

export const StatisticsHomeResponse = z.object({
  firstNine: z.object({
    current: z.number().nullable(),
    previous: z.number().nullable(),
    delta: z.number().nullable(),
  }),
  daily: z
    .array(
      z.object({
        date: z.string(),
        weekday: z.number().int().min(1).max(7),
        value: z.number().nullable(),
      }),
    )
    .length(7),
  landing: z.object({
    cellMm: z.number(),
    cells: z.array(z.tuple([z.number().int(), z.number().int(), z.number().int()])),
  }),
});

export type StatisticsHomeResponseData = z.infer<typeof StatisticsHomeResponse>;
```

- [ ] **Step 4: Add the service function** after `getStatisticsOverview`; extend the repository import with `findHomeScoring`, `findHomeHeatmapCells`, the module import with `HOME_CELL_MM, HOME_GAME_TYPES, homeWindows, shapeHomeStats` from `@modules/stats/home-stats.module`, and `HomeStats` to the `@modules/types` type import:

```ts
/**
 * The Home page's three stat blocks for `q.now` in `q.tz`: first-9 average
 * over the last 30 local days against the 30 before, the last 7 daily
 * averages, and the last 30 days' landing cells, over completed `501` and
 * Score Training sessions.
 */
export async function getHomeStats(
  playerId: string,
  q: { tz: string; now: Date },
): Promise<ServiceResult<HomeStats>> {
  const db = getDb();
  const windows = homeWindows(q.now, q.tz);
  const scope = {
    playerId,
    gameTypeKeys: [...HOME_GAME_TYPES],
    to: windows.to,
  };
  const [rows, cells] = await Promise.all([
    findHomeScoring(db, {
      ...scope,
      from: windows.previousFrom,
      tz: q.tz,
      bands: SCORE_BANDS,
    }),
    findHomeHeatmapCells(db, {
      ...scope,
      from: windows.currentFrom,
      cellMm: HOME_CELL_MM,
    }),
  ]);
  return {
    ok: true,
    data: shapeHomeStats({ rows, cells, windows, tz: q.tz }),
  };
}
```

- [ ] **Step 5: Add the route** `app/src/pages/api/statistics/home.ts`:

```ts
import { statisticsRoute } from "@server/statistics-route";
import { getHomeStats } from "@services/statistics.service";
import { StatisticsHomeQuery } from "@routes/types";

/** The caller's Home stat blocks: first-9 trend, daily averages, landing cells. */
export const GET = statisticsRoute({
  schema: StatisticsHomeQuery,
  run: ({ playerId }, query) =>
    getHomeStats(playerId, { tz: query.tz, now: new Date() }),
});
```

- [ ] **Step 6: Run to verify they pass**

Run: `cd app && npx vitest run tests/services/statistics.service.test.ts tests/pages/api/statistics/home.test.ts`
Expected: PASS. The `@routes/types` barrel re-exports `pages/api/statistics/types.ts`; if `StatisticsHomeQuery` does not resolve, add the export where `StatisticsOverviewResponse` is re-exported.

- [ ] **Step 7: Commit**

```bash
cd app && npx prettier --write src/services/statistics.service.ts src/pages/api/statistics/types.ts src/pages/api/statistics/home.ts tests/services/statistics.service.test.ts tests/pages/api/statistics/home.test.ts && cd ..
git add app/src/services/statistics.service.ts app/src/pages/api/statistics app/tests/services/statistics.service.test.ts app/tests/pages/api/statistics/home.test.ts
git commit -m "feat(api): GET /api/statistics/home (#808)"
```

---

### Task 4: Client wiring and Home markup

**Files:**
- Modify: `app/src/lib/client/api/statistics.ts`, `app/src/lib/client/api/types.ts` (add `type StatisticsHomeResponseData` beside `StatisticsOverviewResponseData`)
- Modify: `app/src/lib/home/types.ts`, `app/src/lib/home/home-snapshot.data.ts`
- Modify: `app/src/components/layout/home/HomeHero.astro`, `DailyAverageCard.astro`, `LandingHeatmapCard.astro`
- Test: `app/tests/lib/client/api/statistics.test.ts`, `app/tests/lib/home/home-snapshot.data.test.ts`

**Interfaces:**
- Consumes: `GET /api/statistics/home` (Task 3), `StatisticsHomeResponseData`, `heatStamps`, `BOARD_SPAN_MM`.
- Produces:
  - `fetchStatisticsHome(tz: string): Promise<StatisticsHomeResponseData>`
  - `HomeHero = { label: string; value: string; delta: string; direction: "Up" | "Down"; showDelta: boolean; window: string }`
  - `DailyAverage = { day: string; value: number | null }`
  - exported shapers `heroFromStats(home: StatisticsHomeResponseData | null): HomeHero`, `dailyFromStats(home: …| null): DailyAverage[]`, `landingFromStats(home: …| null): HomeLanding`

- [ ] **Step 1: Write the failing tests.**

In `statistics.test.ts` add `fetchStatisticsHome` to the import and append:

```ts
describe("fetchStatisticsHome", () => {
  beforeEach(() => vi.resetAllMocks());

  it("requests the endpoint with the tz and returns the data", async () => {
    const data = {
      firstNine: { current: null, previous: null, delta: null },
      daily: [],
      landing: { cellMm: 4, cells: [] },
    };
    vi.mocked(apiRequest).mockResolvedValue({ ok: true, data } as never);
    await expect(fetchStatisticsHome("Europe/Amsterdam")).resolves.toEqual(data);
    expect(apiRequest).toHaveBeenCalledWith(
      "/api/statistics/home?tz=Europe%2FAmsterdam",
    );
  });

  it("throws StatisticsApiError on an error envelope", async () => {
    vi.mocked(apiRequest).mockResolvedValue({
      ok: false,
      error: { code: "VALIDATION_FAILED", message: "bad tz" },
    } as never);
    await expect(fetchStatisticsHome("x")).rejects.toBeInstanceOf(
      StatisticsApiError,
    );
  });
});
```

In `home-snapshot.data.test.ts`: add `fetchStatisticsHome` mock beside `fetchStatisticsOverview` (`const fetchStatisticsHome = vi.fn();` and `fetchStatisticsHome: (tz: string) => fetchStatisticsHome(tz)` in the `vi.mock` factory, `fetchStatisticsHome.mockReset()` in `beforeEach`), import `heroFromStats, dailyFromStats, landingFromStats`, **delete** the tests "carries the design fixture", "highlights Friday in the fixture", and "keeps every heat stamp inside the board canvas", change the `dailyPeak`/`dailyBars` tests' inputs only where noted below, and add:

```ts
const HOME = {
  firstNine: { current: 72.43, previous: 70.6, delta: 1.83 },
  daily: [
    { date: "2026-10-19", weekday: 1, value: 61.2 },
    { date: "2026-10-20", weekday: 2, value: null },
    { date: "2026-10-21", weekday: 3, value: 74.1 },
    { date: "2026-10-22", weekday: 4, value: null },
    { date: "2026-10-23", weekday: 5, value: null },
    { date: "2026-10-24", weekday: 6, value: null },
    { date: "2026-10-25", weekday: 7, value: 70 },
  ],
  landing: {
    cellMm: 4,
    cells: [
      [0, -26, 38],
      [1, -26, 24],
    ] as [number, number, number][],
  },
};

describe("heroFromStats", () => {
  it("formats value and an upward delta", () => {
    expect(heroFromStats(HOME)).toEqual({
      label: "FIRST-9 AVERAGE",
      value: "72.4",
      delta: "1.8",
      direction: "Up",
      showDelta: true,
      window: "last 30 days",
    });
  });

  it("says Down with the absolute delta", () => {
    const hero = heroFromStats({
      ...HOME,
      firstNine: { current: 70, previous: 71.5, delta: -1.5 },
    });
    expect(hero).toMatchObject({ direction: "Down", delta: "1.5", showDelta: true });
  });

  it("hides the delta when it is null or rounds to 0.0", () => {
    const none = heroFromStats({
      ...HOME,
      firstNine: { current: 70, previous: null, delta: null },
    });
    expect(none).toMatchObject({ value: "70.0", showDelta: false });
    const flat = heroFromStats({
      ...HOME,
      firstNine: { current: 70, previous: 70.04, delta: -0.04 },
    });
    expect(flat.showDelta).toBe(false);
  });

  it("is a dash with no stats", () => {
    expect(heroFromStats(null)).toMatchObject({ value: "—", showDelta: false });
    expect(
      heroFromStats({ ...HOME, firstNine: { current: null, previous: null, delta: null } }).value,
    ).toBe("—");
  });
});

describe("dailyFromStats", () => {
  it("labels days by weekday letter and keeps empty days null", () => {
    const days = dailyFromStats(HOME);
    expect(days.map((d) => d.day).join("")).toBe("MTWTFSS");
    expect(days.map((d) => d.value)).toEqual([61.2, null, 74.1, null, null, null, 70]);
  });

  it("is empty with no stats", () => {
    expect(dailyFromStats(null)).toEqual([]);
  });
});

describe("daily bars with empty days", () => {
  it("skips empty days for the peak and gives them no height", () => {
    const days = dailyFromStats(HOME);
    expect(dailyPeak(days)).toBe("74.10");
    const bars = dailyBars(days);
    expect(bars.map((b) => b.peak)).toEqual([false, false, true, false, false, false, false]);
    expect(bars[1].height).toBe("0%");
  });

  it("has a dash peak and no peak bar when every day is empty", () => {
    const days = dailyFromStats({
      ...HOME,
      daily: HOME.daily.map((d) => ({ ...d, value: null })),
    });
    expect(dailyPeak(days)).toBe("—");
    expect(dailyBars(days).some((b) => b.peak)).toBe(false);
  });
});

describe("landingFromStats", () => {
  it("builds stamps from the cells", () => {
    const { stamps, window } = landingFromStats(HOME);
    expect(window).toBe("LAST 30 DAYS");
    expect(stamps.length).toBeGreaterThan(0);
    for (const s of stamps) {
      expect(s.x).toBeGreaterThanOrEqual(0);
      expect(s.x).toBeLessThanOrEqual(1);
      expect(s.y).toBeGreaterThanOrEqual(0);
      expect(s.y).toBeLessThanOrEqual(1);
    }
  });

  it("has no stamps with no cells or no stats", () => {
    expect(landingFromStats(null).stamps).toEqual([]);
    expect(landingFromStats({ ...HOME, landing: { cellMm: 4, cells: [] } }).stamps).toEqual([]);
  });
});

describe("homeSnapshot init", () => {
  it("starts empty: dash hero, no bars, no stamps", () => {
    const s = homeSnapshot();
    expect(s.hero.value).toBe("—");
    expect(s.bars).toEqual([]);
    expect(s.peak).toBe("—");
    expect(s.landing.stamps).toEqual([]);
  });

  it("fills hero, bars and landing from the home stats", async () => {
    fetchStatisticsOverview.mockResolvedValue(OVERVIEW);
    fetchStatisticsHome.mockResolvedValue(HOME);
    const s = homeSnapshot();
    await s.init();
    expect(s.hero.value).toBe("72.4");
    expect(s.bars).toHaveLength(7);
    expect(s.peak).toBe("74.10");
    expect(s.landing.stamps.length).toBeGreaterThan(0);
    expect(fetchStatisticsHome).toHaveBeenCalledWith(expect.any(String));
  });

  it("degrades each fetch independently", async () => {
    fetchStatisticsOverview.mockRejectedValue(new Error("down"));
    fetchStatisticsHome.mockResolvedValue(HOME);
    const s = homeSnapshot();
    await s.init();
    expect(s.careerTiles.map((t) => t.value)).toEqual(["—", "—", "—"]);
    expect(s.hero.value).toBe("72.4");

    fetchStatisticsOverview.mockResolvedValue(OVERVIEW);
    fetchStatisticsHome.mockRejectedValue(new Error("down"));
    const t = homeSnapshot();
    await t.init();
    expect(t.careerTiles[0].value).toBe("84.6");
    expect(t.hero.value).toBe("—");
    expect(t.bars).toEqual([]);
  });
});
```

Two existing tests need edits so the file compiles under the new types: the "keeps the dashes when the overview fails" and "fills career tiles from the overview on init" tests must also `fetchStatisticsHome.mockResolvedValue(HOME)` (otherwise `fetchStatisticsHome` returns `undefined` and the settled-promise path reads `.firstNine` of `undefined`). In `init` use `Promise.allSettled`, so a mock returning `undefined` resolves to a fulfilled `undefined`; guard in the implementation with `home.status === "fulfilled" && home.value ? home.value : null`.

- [ ] **Step 2: Run to verify they fail**

Run: `cd app && npx vitest run tests/lib/client/api/statistics.test.ts tests/lib/home/home-snapshot.data.test.ts`
Expected: FAIL (`fetchStatisticsHome` and the shapers are undefined).

- [ ] **Step 3: Client fetch.** Add to `app/src/lib/client/api/types.ts` the line `type StatisticsHomeResponseData,` next to `type StatisticsOverviewResponseData,` (in the re-export list from `@routes/types`). Add to `statistics.ts` (import the type):

```ts
export async function fetchStatisticsHome(
  tz: string,
): Promise<StatisticsHomeResponseData> {
  const result = await apiRequest<StatisticsHomeResponseData>(
    `/api/statistics/home?tz=${encodeURIComponent(tz)}`,
  );
  if (!result.ok)
    throw new StatisticsApiError(result.error.code, result.error.message);
  return result.data;
}
```

- [ ] **Step 4: Types** in `app/src/lib/home/types.ts`: change `HomeHero` to

```ts
export type HomeHero = {
  label: string;
  value: string;
  delta: string;
  direction: "Up" | "Down";
  showDelta: boolean;
  window: string;
};
```

and `DailyAverage` to `{ day: string; value: number | null }`. Update their doc comments to match (value is `null` for a day with no darts; `showDelta` false hides the change line).

- [ ] **Step 5: Snapshot logic** in `home-snapshot.data.ts`: delete `DAILY`, `LANDING`, and the hard-coded hero; import `fetchStatisticsHome` beside `fetchStatisticsOverview` and `StatisticsHomeResponseData` from `@routes/types`; import `HomeHero`, `HomeLanding` types from `@lib/types`. Replace `dailyPeak`, `dailyBars`, `homeSnapshot` and add the shapers:

```ts
const WEEKDAY_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

/** The hero stat: first-9 average and its change over 30 days; a dash and no change line without data. */
export function heroFromStats(
  home: StatisticsHomeResponseData | null,
): HomeHero {
  const current = home?.firstNine.current ?? null;
  const delta = home?.firstNine.delta ?? null;
  const text = delta === null ? null : Math.abs(delta).toFixed(1);
  const shown = text !== null && text !== "0.0" ? text : null;
  return {
    label: "FIRST-9 AVERAGE",
    value: current === null ? "—" : current.toFixed(1),
    delta: shown ?? "",
    direction: delta !== null && delta < 0 ? "Down" : "Up",
    showDelta: shown !== null,
    window: "last 30 days",
  };
}

/** The seven daily averages labelled by weekday letter; empty without stats. */
export function dailyFromStats(
  home: StatisticsHomeResponseData | null,
): DailyAverage[] {
  if (home === null) return [];
  return home.daily.map((day) => ({
    day: WEEKDAY_LETTERS[day.weekday - 1] ?? "",
    value: day.value,
  }));
}

/** The landing card: the last 30 days' cells as heat stamps; none without cells. */
export function landingFromStats(
  home: StatisticsHomeResponseData | null,
): HomeLanding {
  const cells = home?.landing.cells ?? [];
  return {
    window: "LAST 30 DAYS",
    stamps:
      home === null || cells.length === 0
        ? []
        : heatStamps(
            { cellMm: home.landing.cellMm, target: null, cells },
            BOARD_SPAN_MM,
          ),
  };
}

function peakValue(days: DailyAverage[]): number | null {
  const values = days.flatMap((d) => (d.value === null ? [] : [d.value]));
  return values.length === 0 ? null : Math.max(...values);
}

/** The highest daily average to two decimals, or a dash with no measured days. */
export function dailyPeak(days: DailyAverage[]): string {
  const peak = peakValue(days);
  return peak === null ? "—" : peak.toFixed(2);
}

/** A bar's CSS height: `value` mapped from 50–75 onto 0–100%, clamped; an empty day is 0%. */
export function barHeight(value: number | null): string {
  if (value === null) return "0%";
  const pct = ((value - BAR_FLOOR) / BAR_RANGE) * 100;
  return `${Math.round(Math.min(100, Math.max(0, pct)) * 10) / 10}%`;
}

/** One bar per day; every measured day sharing the highest value is a peak. */
export function dailyBars(days: DailyAverage[]): DailyBar[] {
  const max = peakValue(days);
  return days.map((d) => ({
    day: d.day,
    height: barHeight(d.value),
    peak: d.value !== null && d.value === max,
  }));
}

/**
 * Homepage stat sections. `init()` reads `GET /api/statistics/overview` for
 * the career tiles and `GET /api/statistics/home` for the hero, daily bars
 * and landing heatmap; each stays empty if its own read fails.
 */
export function homeSnapshot(): HomeSnapshotContext {
  return {
    hero: heroFromStats(null),
    careerTiles: careerTiles(null),
    dailyAverage: dailyFromStats(null),
    peak: dailyPeak([]),
    bars: dailyBars([]),
    landing: landingFromStats(null),

    async init(this: HomeSnapshotContext) {
      const [overview, home] = await Promise.allSettled([
        fetchStatisticsOverview(),
        fetchStatisticsHome(Intl.DateTimeFormat().resolvedOptions().timeZone),
      ]);
      this.careerTiles = careerTiles(
        overview.status === "fulfilled" && overview.value
          ? overview.value
          : null,
      );
      const stats =
        home.status === "fulfilled" && home.value ? home.value : null;
      this.hero = heroFromStats(stats);
      this.dailyAverage = dailyFromStats(stats);
      this.peak = dailyPeak(this.dailyAverage);
      this.bars = dailyBars(this.dailyAverage);
      this.landing = landingFromStats(stats);
    },
  };
}
```

Remove the now-unused `HomeSnapshotContext` fields? None change. Remove unused imports (`HeatmapMetrics`) if fallow/tsc flags them.

- [ ] **Step 6: Markup.**

`HomeHero.astro` (replace the delta `<span class="text-sm text-muted">` block; invisible keeps the line's space so the hero does not jump):

```astro
  <span
    class="text-sm text-muted"
    :class="hero.showDelta ? '' : 'invisible'"
  >
    <span x-text="hero.direction"></span> <span
      class="font-semibold text-accent-bright"
      x-text="hero.delta"
    ></span> in the <span x-text="hero.window"></span>
  </span>
```

`DailyAverageCard.astro`: on the root `<section>` add `x-show="peak !== '—'"` and `x-cloak` (after `class`). `LandingHeatmapCard.astro`: on the root `<section>` add `x-show="landing.stamps.length > 0"` and `x-cloak`. Update the three JSDoc headers: hero "hidden delta keeps its line", daily/landing "hidden until the stats load and have data".

- [ ] **Step 7: Run to verify they pass, then the astro gate**

Run: `cd app && npx vitest run tests/lib/client/api/statistics.test.ts tests/lib/home/home-snapshot.data.test.ts && cd .. && bash scripts/check-astro-conventions.sh`
Expected: PASS; `OK: Astro x-show/x-cloak pairing …`.

- [ ] **Step 8: Commit**

```bash
cd app && npx prettier --write src/lib/client/api src/lib/home src/components/layout/home tests/lib/client/api/statistics.test.ts tests/lib/home/home-snapshot.data.test.ts && cd ..
git add app/src/lib app/src/components/layout/home app/tests/lib
git commit -m "feat(home): real hero, daily average and landing heatmap (#808)"
```

---

### Task 5: Docs, decision, validation

**Files:**
- Modify: `docs/architecture/06-API/04-Endpoint-Contracts.md` (new `GET /api/statistics/home` section after the Statistics Overview section)
- Modify: `docs/architecture/06-API/00-Overview.md` (route list near line 111: add `- GET /api/statistics/home <!-- 2026-10-25 -->`)
- Modify: `docs/architecture/10-Statistics/00-Overview.md` §6 (add a route row)
- Modify: `docs/architecture/07-Frontend/08-Component-Inventory.md` (rows for `HomeHero`, `DailyAverageCard`, `LandingHeatmapCard`: now data-driven, hidden states; ISO date)
- Modify: `docs/superpowers/specs/2026-10-07-home-redesign-design.md` (status note under the header: data pass shipped, see the new spec)
- Modify: `docs/superpowers/specs/2026-10-25-home-real-stats-design.md` (`Status: implemented`)
- Modify: `decisions/api.md` (append one decision block)

- [ ] **Step 1: Route docs.** Write the contract section in `04-Endpoint-Contracts.md` using the response shape and behaviour table from the spec (`tz` required and validated, strict query, windows, `null` rules, scope: completed `501` and `SCORE_TRAINING`, `VISUAL_BOARD`). Add the route row to `10-Statistics/00-Overview.md` §6 with status `built (#808)` and the sentence that it is a fixed-window summary, so the §5 range contract does not apply. Add the line to `06-API/00-Overview.md`. Date every added row `2026-10-25`.

- [ ] **Step 2: Decision.** Follow `DECISIONS.md` "How to add a decision": run `bash scripts/next-decision-id.sh`; append a block to `decisions/api.md` with `Status: Accepted · Date: 2026-10-25`, a one-line context, `Reason:` (one fixed-window endpoint over per-game section calls; day-bucketed scoring read folded in the service; shared `selectVisitScoring` body), `Consequences:` (scope fixed to `501` + `SCORE_TRAINING`; client sends `tz`), the spec path, and `Supersedes: none.` Replace the provisional `D493` in the spec header with the derived id. Run `bash scripts/check-decision-ids.sh`; expected PASS.

- [ ] **Step 3: Component inventory and spec status** as listed above (targeted edits, ISO dates).

- [ ] **Step 4: Validate.** Invoke the `run-all-gates` skill. From `app/`: `npm test` (full suite, read the summary), `npm run format:check`, and, where `DATABASE_URL` exists, `npm run validate:app`. Without a database, say in the PR which steps (`db:*`, integration) did not run locally.

Expected: unit suite green; `format:check` clean; gates pass.

- [ ] **Step 5: Context maintenance.** Invoke the `context-maintenance` skill and complete its checklist (inventory rows, decision ids re-derived right before the PR, dates, discovered-work issues).

- [ ] **Step 6: Commit, push, PR.** Commit docs (`docs: home real stats contract and decision (#808)`), run `cd app && npm run format` and re-check `format:check`, push `feat/home-real-stats`, open the PR via `finishing-a-dart-branch` (PR body ends with `Closes #808`), call `subscribe_pr_activity`, and drive it to green.

---

## Self-review

- **Spec coverage:** scope and windows (Task 1 module, Task 3 service); repository readers and shared body (Task 2); route and `tz` validation (Task 3); client, hero/daily/landing behaviour table and hidden states (Task 4); docs, decision, testing list (Tasks 2–5). The spec's service test with a DST day is pinned in Task 1 (`homeWindows`) and Task 3 (window bounds passed through).
- **Placeholders:** none. The one non-literal block, "existing body unchanged" in Task 2 Step 3, names the exact lines to move.
- **Type consistency:** `HomeScope`, `HomeWindows`, `HomeStats`, `HomeDay` defined in Task 1 and used unchanged in Tasks 2–4; `findHomeScoring` takes `tz` and `bands`, and the service passes both; the client type `StatisticsHomeResponseData` equals `HomeStats` structurally.
- **Known risk:** the `renderingDb` fake-row shape in the heatmap "maps rows" test; Step 5 of Task 2 says where to copy the shape from.
