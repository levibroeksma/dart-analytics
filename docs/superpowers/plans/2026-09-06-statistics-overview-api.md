# Statistics Overview API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `GET /api/statistics/overview`, filling the route `docs/architecture/06-API/00-Overview.md` already reserves (D63), by building the five pure stat modules the general-views design specified but never implemented, plus the repository/service/controller layers that expose them.

**Architecture:** Controller → Service → Repository, matching every other endpoint in this codebase. The repository reads four existing views (`v_session_overview`, `v_player_visit_facts`, `v_player_leg_facts`, `v_double_out_checkout_darts`) with no aggregation in SQL. The service composes those rows through five pure, DB-free TypeScript modules and assembles one flat response DTO. No new error codes, no request body, no query params.

**Tech Stack:** Astro server endpoints (Cloudflare Workers), Drizzle ORM over `@neondatabase/serverless`, Zod, Vitest.

## Global Constraints

- No new error codes — only the standard protected-route set (`401 UNAUTHORIZED`, `403 PLAYER_NOT_PROVISIONED`, `500`/`503` from the API error boundary).
- `export type`/`export interface` never appears in an implementation file (type-barrel rule 1) — all exported types live in the owning folder's `types.ts`/`interfaces.ts`, raised to the area-root barrel.
- No `//`/`/* */` comments inside function bodies; a doc comment goes above the declaration only.
- Tests live under `app/tests/`, mirroring `app/src/`'s structure — never colocated.
- `npm run validate:app` (0 errors/warnings/hints) must pass before any task is called done; `npm run format`/`format:check` clean before any commit.
- Every touched runtime `.ts` file needs a covering test (`scripts/check-test-coverage.sh`).
- Do not touch `v_double_out_checkout_darts`'s game-type filter or `double-attempt.module.ts`'s classification rules (steps 1–6 of `classifyDart`) — that scope belongs to `claude/x01-doubles-accuracy-ljbk6c`. The one permitted touch to that file is exporting its existing private `classifyDart`/`DartOutcome` (Task 6) — an additive export, zero behavior change.
- Win rate is not part of this response shape at all — separate future plan (needs session-replay-from-persisted-facts, which doesn't exist for any engine).
- No live database exists in this container. `app/src/db/schema.ts` is normally `drizzle-kit introspect` output and must never be hand-edited — Task 1 is a deliberate, flagged exception (the same one already made for `vPlayerSettings`), because three views already live on `main`'s migrations (`0024`, `0025`, `0026`) were never introspected. Diff Task 1's additions against a real `db:introspect` run before merging to `main`.

---

### Task 1: Add the three missing views to `app/src/db/schema.ts`

`v_double_out_checkout_darts` (migration `0024`), `v_player_visit_facts` (`0025`), and `v_player_leg_facts` (`0026`) are all already on `main`, but none were ever introspected into `schema.ts` — there's no live database in this container to run `drizzle-kit introspect` against. This is the same situation `vPlayerSettings` hit (see `docs/architecture/00-Context-Map-History.md`'s "Known deviation" row) — hand-write them, matching the migration SQL exactly, flagged for verification later.

**Files:**
- Modify: `app/src/db/schema.ts`
- Modify: `docs/architecture/00-Context-Map-History.md`

**Interfaces:**
- Produces: Drizzle view objects `vDoubleOutCheckoutDarts`, `vPlayerVisitFacts`, `vPlayerLegFacts`, exported from `@db/schema`, consumed by Task 7's repository.

- [ ] **Step 1: Add the `bigint` import**

In `app/src/db/schema.ts`, change:

```ts
import {
  pgTable,
  varchar,
  unique,
  check,
  smallint,
  text,
  timestamp,
  index,
  uuid,
  boolean,
  foreignKey,
  integer,
  uniqueIndex,
  jsonb,
  numeric,
  primaryKey,
  pgView,
} from "drizzle-orm/pg-core";
```

to:

```ts
import {
  pgTable,
  varchar,
  unique,
  check,
  smallint,
  text,
  timestamp,
  index,
  uuid,
  boolean,
  foreignKey,
  integer,
  uniqueIndex,
  jsonb,
  numeric,
  bigint,
  primaryKey,
  pgView,
} from "drizzle-orm/pg-core";
```

- [ ] **Step 2: Append the three view definitions**

At the end of `app/src/db/schema.ts` (after `vGameReplay`'s closing `);` — currently the last export), add:

```ts

/**
 * Hand-written, not `drizzle-kit introspect` output — no live database exists
 * in this container. Mirrors `database/migrations/0024_double_out_checkout_darts_view.sql`
 * column-for-column. Verify against a real `db:introspect` run before merge
 * (same caveat as `vPlayerSettings` above).
 */
export const vDoubleOutCheckoutDarts = pgView("v_double_out_checkout_darts", {
  sessionId: uuid("session_id"),
  playerId: uuid("player_id"),
  stageId: uuid("stage_id"),
  turnSequence: integer("turn_sequence"),
  dartNumber: smallint("dart_number"),
  hitTargetNumber: smallint("hit_target_number"),
  hitZoneKey: text("hit_zone_key"),
  score: integer(),
  priorScoredInStage: bigint("prior_scored_in_stage", { mode: "number" }),
}).as(
  sql`SELECT es.id AS session_id, es.player_id, st.id AS stage_id, t.sequence_number AS turn_sequence, d.dart_number, d.hit_target_number, hit_zone.implementation_key AS hit_zone_key, d.score, SUM(d.score) OVER (PARTITION BY st.id, t.participant_id ORDER BY t.sequence_number, d.dart_number ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS prior_scored_in_stage FROM darts d JOIN turns t ON t.id = d.turn_id JOIN participants p ON p.id = t.participant_id JOIN exercise_stages st ON st.id = t.exercise_stage_id JOIN exercise_sessions es ON es.id = st.exercise_session_id JOIN game_types gt ON gt.id = es.game_type_id JOIN input_modes im ON im.id = es.input_mode_id LEFT JOIN dart_zones hit_zone ON hit_zone.id = d.hit_zone_id WHERE gt.implementation_key = '501'::text AND im.implementation_key = 'VISUAL_BOARD'::text AND p.player_id = es.player_id`,
);

/**
 * Hand-written, not `drizzle-kit introspect` output — see the caveat above.
 * Mirrors `database/migrations/0025_player_visit_facts_view.sql`.
 */
export const vPlayerVisitFacts = pgView("v_player_visit_facts", {
  sessionId: uuid("session_id"),
  playerId: uuid("player_id"),
  gameTypeKey: text("game_type_key"),
  stageId: uuid("stage_id"),
  stageTypeKey: text("stage_type_key"),
  turnSequence: integer("turn_sequence"),
  totalScore: integer("total_score"),
  completedAt: timestamp("completed_at", {
    withTimezone: true,
    mode: "string",
  }),
  dartCount: bigint("dart_count", { mode: "number" }),
  configuredMaxDartsPerTurn: integer("configured_max_darts_per_turn"),
}).as(
  sql`SELECT es.id AS session_id, es.player_id, gt.implementation_key AS game_type_key, st.id AS stage_id, stype.implementation_key AS stage_type_key, t.sequence_number AS turn_sequence, t.total_score, t.completed_at, count(d.id) AS dart_count, (ec.configuration ->> 'max_darts_per_turn'::text)::integer AS configured_max_darts_per_turn FROM turns t JOIN participants p ON p.id = t.participant_id JOIN exercise_stages st ON st.id = t.exercise_stage_id JOIN exercise_sessions es ON es.id = st.exercise_session_id JOIN game_types gt ON gt.id = es.game_type_id JOIN stage_types stype ON stype.id = st.stage_type_id LEFT JOIN exercise_configurations ec ON ec.exercise_session_id = es.id LEFT JOIN darts d ON d.turn_id = t.id WHERE p.player_id = es.player_id AND t.completed_at IS NOT NULL GROUP BY es.id, es.player_id, gt.implementation_key, st.id, stype.implementation_key, t.sequence_number, t.total_score, t.completed_at, ec.configuration`,
);

/**
 * Hand-written, not `drizzle-kit introspect` output — see the caveat above.
 * Mirrors `database/migrations/0026_player_leg_facts_view.sql`. `total_darts_in_leg`
 * is `numeric`, not `bigint` — Postgres's `SUM()` over a `bigint` (the inner
 * `count(d.id)`) returns `numeric`, which arrives as a string through
 * Drizzle/node-postgres (same situation as `v_dart_locations`'s `radiusMm`/
 * `angleDegrees`) — the repository parses it to a number.
 */
export const vPlayerLegFacts = pgView("v_player_leg_facts", {
  sessionId: uuid("session_id"),
  playerId: uuid("player_id"),
  gameTypeKey: text("game_type_key"),
  stageId: uuid("stage_id"),
  totalDartsInLeg: numeric("total_darts_in_leg"),
}).as(
  sql`WITH leg_turns AS (SELECT t.id AS turn_id, t.exercise_stage_id, count(d.id) AS dart_count FROM turns t JOIN participants p ON p.id = t.participant_id JOIN exercise_stages st ON st.id = t.exercise_stage_id JOIN exercise_sessions es ON es.id = st.exercise_session_id LEFT JOIN darts d ON d.turn_id = t.id WHERE p.player_id = es.player_id AND t.completed_at IS NOT NULL GROUP BY t.id, t.exercise_stage_id) SELECT es.id AS session_id, es.player_id, gt.implementation_key AS game_type_key, st.id AS stage_id, sum(lt.dart_count) AS total_darts_in_leg FROM leg_turns lt JOIN exercise_stages st ON st.id = lt.exercise_stage_id JOIN stage_types stype ON stype.id = st.stage_type_id JOIN exercise_sessions es ON es.id = st.exercise_session_id JOIN game_types gt ON gt.id = es.game_type_id WHERE stype.implementation_key = 'LEG'::text GROUP BY es.id, es.player_id, gt.implementation_key, st.id HAVING bool_and(lt.dart_count > 0)`,
);
```

- [ ] **Step 3: Verify it type-checks**

```bash
cd app
npx astro check
```

Expected: 0 errors, 0 warnings, 0 hints.

- [ ] **Step 4: Extend the Known-deviation note**

In `docs/architecture/00-Context-Map-History.md`, find the "Current Implementation State" table row starting `| Drizzle schema (\`app/src/db/schema.ts\`) | **Known deviation, awaiting owner ratification (2026-08-08):**`. At the end of that row's text (before the closing `|`), change:

```
`0019`/`0020` were likewise never introspected |
```

to:

```
`0019`/`0020` were likewise never introspected. Migrations `0024`–`0026` (`vDoubleOutCheckoutDarts`, `vPlayerVisitFacts`, `vPlayerLegFacts`) hit the same gap and were hand-written the same way (2026-09-06) |
```

- [ ] **Step 5: Commit**

```bash
git add app/src/db/schema.ts docs/architecture/00-Context-Map-History.md
git commit -m "$(cat <<'EOF'
Hand-add v_double_out_checkout_darts/v_player_visit_facts/v_player_leg_facts to schema.ts

No live database exists in this container to run drizzle-kit introspect
against, so these three already-migrated views (0024-0026) were never
picked up. Same documented deviation as vPlayerSettings -- verify
against a real introspect run before merge.
EOF
)"
```

---

### Task 2: `career-summary.module.ts`

Pure functions over `v_session_overview`-shaped rows: total games played, total play time, favorite game type, longest/current play streak.

**Files:**
- Create: `app/src/modules/stats/types.ts`
- Modify: `app/src/modules/types.ts`
- Create: `app/src/modules/stats/career-summary.module.ts`
- Test: `app/tests/modules/stats/career-summary.module.test.ts`

**Interfaces:**
- Produces: type `PlayerSessionSummaryRow` (`app/src/modules/stats/types.ts`, raised into `@modules/types`); functions `totalGamesPlayed`, `totalPlayTimeSeconds`, `favoriteGameTypeKey`, `longestPlayStreakDays`, `currentPlayStreakDays` (`@modules/stats/career-summary.module`). Task 7's repository imports `PlayerSessionSummaryRow` from `@modules/types`.

- [ ] **Step 1: Write the failing test**

Create `app/tests/modules/stats/career-summary.module.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  currentPlayStreakDays,
  favoriteGameTypeKey,
  longestPlayStreakDays,
  totalGamesPlayed,
  totalPlayTimeSeconds,
} from "@modules/stats/career-summary.module";
import type { PlayerSessionSummaryRow } from "@modules/types";

function session(
  overrides: Partial<PlayerSessionSummaryRow> = {},
): PlayerSessionSummaryRow {
  return {
    gameTypeKey: "501",
    statusKey: "COMPLETED",
    startedAt: "2026-09-01T10:00:00.000Z",
    durationSeconds: 600,
    ...overrides,
  };
}

describe("totalGamesPlayed", () => {
  it("returns 0 for no sessions", () => {
    expect(totalGamesPlayed([])).toBe(0);
  });

  it("counts only COMPLETED sessions", () => {
    const rows = [
      session({ statusKey: "COMPLETED" }),
      session({ statusKey: "ABANDONED" }),
      session({ statusKey: "ACTIVE" }),
    ];
    expect(totalGamesPlayed(rows)).toBe(1);
  });
});

describe("totalPlayTimeSeconds", () => {
  it("sums duration across COMPLETED sessions only", () => {
    const rows = [
      session({ durationSeconds: 300 }),
      session({ durationSeconds: 700, statusKey: "ABANDONED" }),
      session({ durationSeconds: 200 }),
    ];
    expect(totalPlayTimeSeconds(rows)).toBe(500);
  });
});

describe("favoriteGameTypeKey", () => {
  it("returns null for no sessions", () => {
    expect(favoriteGameTypeKey([])).toBeNull();
  });

  it("returns the most-played COMPLETED game type", () => {
    const rows = [
      session({ gameTypeKey: "501" }),
      session({ gameTypeKey: "TUOD" }),
      session({ gameTypeKey: "501" }),
      session({ gameTypeKey: "501", statusKey: "ABANDONED" }),
    ];
    expect(favoriteGameTypeKey(rows)).toBe("501");
  });

  it("breaks ties by first-seen order", () => {
    const rows = [session({ gameTypeKey: "TUOD" }), session({ gameTypeKey: "501" })];
    expect(favoriteGameTypeKey(rows)).toBe("TUOD");
  });
});

describe("longestPlayStreakDays", () => {
  it("returns 0 for no sessions", () => {
    expect(longestPlayStreakDays([])).toBe(0);
  });

  it("counts a run of consecutive calendar days once per day", () => {
    const rows = [
      session({ startedAt: "2026-09-01T09:00:00.000Z" }),
      session({ startedAt: "2026-09-01T21:00:00.000Z" }),
      session({ startedAt: "2026-09-02T09:00:00.000Z" }),
      session({ startedAt: "2026-09-03T09:00:00.000Z" }),
    ];
    expect(longestPlayStreakDays(rows)).toBe(3);
  });

  it("finds the longest of several runs separated by gaps", () => {
    const rows = [
      session({ startedAt: "2026-09-01T09:00:00.000Z" }),
      session({ startedAt: "2026-09-05T09:00:00.000Z" }),
      session({ startedAt: "2026-09-06T09:00:00.000Z" }),
      session({ startedAt: "2026-09-07T09:00:00.000Z" }),
    ];
    expect(longestPlayStreakDays(rows)).toBe(3);
  });
});

describe("currentPlayStreakDays", () => {
  it("returns 0 for no sessions", () => {
    expect(currentPlayStreakDays([], new Date("2026-09-06T12:00:00.000Z"))).toBe(0);
  });

  it("counts the run ending today", () => {
    const rows = [
      session({ startedAt: "2026-09-04T09:00:00.000Z" }),
      session({ startedAt: "2026-09-05T09:00:00.000Z" }),
      session({ startedAt: "2026-09-06T09:00:00.000Z" }),
    ];
    expect(currentPlayStreakDays(rows, new Date("2026-09-06T18:00:00.000Z"))).toBe(3);
  });

  it("still counts the run when the reference date is the day after last play", () => {
    const rows = [
      session({ startedAt: "2026-09-04T09:00:00.000Z" }),
      session({ startedAt: "2026-09-05T09:00:00.000Z" }),
    ];
    expect(currentPlayStreakDays(rows, new Date("2026-09-06T08:00:00.000Z"))).toBe(2);
  });

  it("returns 0 when the last play is more than a day before the reference date", () => {
    const rows = [session({ startedAt: "2026-09-01T09:00:00.000Z" })];
    expect(currentPlayStreakDays(rows, new Date("2026-09-06T08:00:00.000Z"))).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd app
npx vitest run tests/modules/stats/career-summary.module.test.ts
```

Expected: FAIL — `Cannot find module '@modules/stats/career-summary.module'` (and `PlayerSessionSummaryRow` not exported from `@modules/types`).

- [ ] **Step 3: Create the types file**

Create `app/src/modules/stats/types.ts`:

```ts
/** Fields `career-summary.module.ts` needs from a `v_session_overview` row. */
export type PlayerSessionSummaryRow = {
  gameTypeKey: string;
  statusKey: string;
  startedAt: string;
  durationSeconds: number;
};
```

- [ ] **Step 4: Raise the new barrel into `app/src/modules/types.ts`**

In `app/src/modules/types.ts`, change:

```ts
export * from "./dartbot/types";
export * from "./game/types";
export * from "./ui/types";
```

to:

```ts
export * from "./dartbot/types";
export * from "./game/types";
export * from "./stats/types";
export * from "./ui/types";
```

- [ ] **Step 5: Write the implementation**

Create `app/src/modules/stats/career-summary.module.ts`:

```ts
import type { PlayerSessionSummaryRow } from "./types";

function completedRows(
  rows: readonly PlayerSessionSummaryRow[],
): PlayerSessionSummaryRow[] {
  return rows.filter((row) => row.statusKey === "COMPLETED");
}

export function totalGamesPlayed(rows: readonly PlayerSessionSummaryRow[]): number {
  return completedRows(rows).length;
}

export function totalPlayTimeSeconds(rows: readonly PlayerSessionSummaryRow[]): number {
  return completedRows(rows).reduce((sum, row) => sum + row.durationSeconds, 0);
}

export function favoriteGameTypeKey(
  rows: readonly PlayerSessionSummaryRow[],
): string | null {
  const counts = new Map<string, number>();
  for (const row of completedRows(rows)) {
    counts.set(row.gameTypeKey, (counts.get(row.gameTypeKey) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [gameTypeKey, count] of counts) {
    if (count > bestCount) {
      best = gameTypeKey;
      bestCount = count;
    }
  }
  return best;
}

function toDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

function daysBetween(earlier: string, later: string): number {
  const msPerDay = 86_400_000;
  return Math.round((Date.parse(later) - Date.parse(earlier)) / msPerDay);
}

function distinctSortedPlayDates(rows: readonly PlayerSessionSummaryRow[]): string[] {
  const dates = new Set(completedRows(rows).map((row) => toDateOnly(row.startedAt)));
  return Array.from(dates).sort();
}

export function longestPlayStreakDays(rows: readonly PlayerSessionSummaryRow[]): number {
  const dates = distinctSortedPlayDates(rows);
  if (dates.length === 0) return 0;
  let longest = 1;
  let current = 1;
  for (let i = 1; i < dates.length; i += 1) {
    current = daysBetween(dates[i - 1], dates[i]) === 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
  }
  return longest;
}

/** `referenceDate` defaults to now; pass an explicit date for deterministic tests. */
export function currentPlayStreakDays(
  rows: readonly PlayerSessionSummaryRow[],
  referenceDate: Date = new Date(),
): number {
  const dates = distinctSortedPlayDates(rows);
  if (dates.length === 0) return 0;
  const today = referenceDate.toISOString().slice(0, 10);
  const lastPlayed = dates[dates.length - 1];
  if (daysBetween(lastPlayed, today) > 1) return 0;
  let streak = 1;
  for (let i = dates.length - 1; i > 0; i -= 1) {
    if (daysBetween(dates[i - 1], dates[i]) === 1) streak += 1;
    else break;
  }
  return streak;
}
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
cd app
npx vitest run tests/modules/stats/career-summary.module.test.ts
```

Expected: PASS, all cases green.

- [ ] **Step 7: Run the full suite and format check**

```bash
cd app
npm test
npm run format:check
```

Expected: both clean.

- [ ] **Step 8: Commit**

```bash
git add app/src/modules/stats/types.ts app/src/modules/types.ts \
  app/src/modules/stats/career-summary.module.ts \
  app/tests/modules/stats/career-summary.module.test.ts
git commit -m "$(cat <<'EOF'
Add career-summary.module.ts: games played, play time, streaks

Pure functions over v_session_overview-shaped rows. Streak functions
use gap-and-islands over distinct play dates, not a SQL aggregate,
since finding consecutive-day runs is iterative logic.
EOF
)"
```

---

### Task 3: `visit-stats.module.ts`

Pure functions over `v_player_visit_facts`-shaped rows: total darts thrown, score-band counts (100/120/140+/180s), median visit score, highest game average, first-9 career average.

**Files:**
- Modify: `app/src/modules/stats/types.ts`
- Create: `app/src/modules/stats/visit-stats.module.ts`
- Test: `app/tests/modules/stats/visit-stats.module.test.ts`

**Interfaces:**
- Produces: type `PlayerVisitFactRow`, `ScoreBandCounts` (`@modules/types`); functions `effectiveDartsForVisit`, `totalDartsThrown`, `scoreBandCounts`, `medianVisitScore`, `highestGameAverage`, `firstNineCareerAverage` (`@modules/stats/visit-stats.module`). Tasks 6 and 7 import `effectiveDartsForVisit`/`PlayerVisitFactRow` from this module and `@modules/types` respectively.

- [ ] **Step 1: Write the failing test**

Create `app/tests/modules/stats/visit-stats.module.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  effectiveDartsForVisit,
  firstNineCareerAverage,
  highestGameAverage,
  medianVisitScore,
  scoreBandCounts,
  totalDartsThrown,
} from "@modules/stats/visit-stats.module";
import type { PlayerVisitFactRow } from "@modules/types";

function visit(overrides: Partial<PlayerVisitFactRow> = {}): PlayerVisitFactRow {
  return {
    sessionId: "session-1",
    gameTypeKey: "501",
    stageId: "stage-1",
    stageTypeKey: "LEG",
    turnSequence: 1,
    totalScore: 60,
    dartCount: 3,
    configuredMaxDartsPerTurn: 3,
    ...overrides,
  };
}

describe("effectiveDartsForVisit", () => {
  it("uses the real dart count when it is present", () => {
    expect(effectiveDartsForVisit(visit({ dartCount: 1 }))).toBe(1);
  });

  it("falls back to the configured max when dartCount is 0", () => {
    expect(
      effectiveDartsForVisit(visit({ dartCount: 0, configuredMaxDartsPerTurn: 3 })),
    ).toBe(3);
  });

  it("falls back to 3 when neither the real count nor the configured max is known", () => {
    expect(
      effectiveDartsForVisit(visit({ dartCount: 0, configuredMaxDartsPerTurn: null })),
    ).toBe(3);
  });
});

describe("totalDartsThrown", () => {
  it("returns 0 for no visits", () => {
    expect(totalDartsThrown([])).toBe(0);
  });

  it("sums effective darts across visits", () => {
    const rows = [visit({ dartCount: 3 }), visit({ dartCount: 0 })];
    expect(totalDartsThrown(rows)).toBe(6);
  });
});

describe("scoreBandCounts", () => {
  it("counts each visit in exactly its highest band", () => {
    const rows = [
      visit({ totalScore: 180 }),
      visit({ totalScore: 140 }),
      visit({ totalScore: 120 }),
      visit({ totalScore: 100 }),
      visit({ totalScore: 59 }),
    ];
    expect(scoreBandCounts(rows)).toEqual({
      hundredPlus: 1,
      oneTwentyPlus: 1,
      oneFortyPlus: 1,
      oneEighties: 1,
    });
  });

  it("returns all zeros for no visits", () => {
    expect(scoreBandCounts([])).toEqual({
      hundredPlus: 0,
      oneTwentyPlus: 0,
      oneFortyPlus: 0,
      oneEighties: 0,
    });
  });
});

describe("medianVisitScore", () => {
  it("returns 0 for no visits", () => {
    expect(medianVisitScore([])).toBe(0);
  });

  it("returns the middle value for an odd count", () => {
    const rows = [visit({ totalScore: 10 }), visit({ totalScore: 60 }), visit({ totalScore: 30 })];
    expect(medianVisitScore(rows)).toBe(30);
  });

  it("averages the two middle values for an even count", () => {
    const rows = [
      visit({ totalScore: 10 }),
      visit({ totalScore: 20 }),
      visit({ totalScore: 30 }),
      visit({ totalScore: 40 }),
    ];
    expect(medianVisitScore(rows)).toBe(25);
  });
});

describe("highestGameAverage", () => {
  it("returns 0 for no visits", () => {
    expect(highestGameAverage([])).toBe(0);
  });

  it("picks the session with the highest 3-dart average", () => {
    const rows = [
      visit({ sessionId: "a", totalScore: 60, dartCount: 3 }),
      visit({ sessionId: "a", totalScore: 60, dartCount: 3 }),
      visit({ sessionId: "b", totalScore: 20, dartCount: 3 }),
    ];
    expect(highestGameAverage(rows)).toBe(60);
  });
});

describe("firstNineCareerAverage", () => {
  it("returns 0 for no visits", () => {
    expect(firstNineCareerAverage([])).toBe(0);
  });

  it("pools only the first 3 turns of each session", () => {
    const rows = [
      visit({ sessionId: "a", turnSequence: 1, totalScore: 60 }),
      visit({ sessionId: "a", turnSequence: 2, totalScore: 60 }),
      visit({ sessionId: "a", turnSequence: 3, totalScore: 60 }),
      visit({ sessionId: "a", turnSequence: 4, totalScore: 0 }),
      visit({ sessionId: "b", turnSequence: 1, totalScore: 30 }),
    ];
    expect(firstNineCareerAverage(rows)).toBe(52.5);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd app
npx vitest run tests/modules/stats/visit-stats.module.test.ts
```

Expected: FAIL — module and types not found.

- [ ] **Step 3: Add the row/result types**

In `app/src/modules/stats/types.ts`, append:

```ts

/** One row of `v_player_visit_facts`. */
export type PlayerVisitFactRow = {
  sessionId: string;
  gameTypeKey: string;
  stageId: string;
  stageTypeKey: string;
  turnSequence: number;
  totalScore: number;
  dartCount: number;
  configuredMaxDartsPerTurn: number | null;
};

/**
 * Exclusive score-band tally (Pattern 21) over `v_player_visit_facts` rows —
 * kept independent of `play-visit-stats.ts`'s `visitScoreBandCounts` (the
 * live in-session helper): score-band thresholds are fixed darts convention,
 * not a heuristic subject to drift, so the duplication risk is negligible
 * and this avoids pulling every historical turn into the live-session module.
 */
export type ScoreBandCounts = {
  hundredPlus: number;
  oneTwentyPlus: number;
  oneFortyPlus: number;
  oneEighties: number;
};
```

- [ ] **Step 4: Write the implementation**

Create `app/src/modules/stats/visit-stats.module.ts`:

```ts
import type { PlayerVisitFactRow, ScoreBandCounts } from "./types";

/** The real dart count where it's known, else the visit's configured max, else 3. */
export function effectiveDartsForVisit(row: PlayerVisitFactRow): number {
  if (row.dartCount > 0) return row.dartCount;
  return row.configuredMaxDartsPerTurn ?? 3;
}

export function totalDartsThrown(rows: readonly PlayerVisitFactRow[]): number {
  return rows.reduce((sum, row) => sum + effectiveDartsForVisit(row), 0);
}

export function scoreBandCounts(rows: readonly PlayerVisitFactRow[]): ScoreBandCounts {
  const counts: ScoreBandCounts = {
    hundredPlus: 0,
    oneTwentyPlus: 0,
    oneFortyPlus: 0,
    oneEighties: 0,
  };
  for (const row of rows) {
    const score = row.totalScore;
    if (score >= 180) counts.oneEighties += 1;
    else if (score >= 140) counts.oneFortyPlus += 1;
    else if (score >= 120) counts.oneTwentyPlus += 1;
    else if (score >= 100) counts.hundredPlus += 1;
  }
  return counts;
}

export function medianVisitScore(rows: readonly PlayerVisitFactRow[]): number {
  if (rows.length === 0) return 0;
  const sorted = rows.map((row) => row.totalScore).sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function groupBySession(
  rows: readonly PlayerVisitFactRow[],
): Map<string, PlayerVisitFactRow[]> {
  const bySession = new Map<string, PlayerVisitFactRow[]>();
  for (const row of rows) {
    const list = bySession.get(row.sessionId) ?? [];
    list.push(row);
    bySession.set(row.sessionId, list);
  }
  return bySession;
}

export function highestGameAverage(rows: readonly PlayerVisitFactRow[]): number {
  let highest = 0;
  for (const sessionRows of groupBySession(rows).values()) {
    const totalScore = sessionRows.reduce((sum, row) => sum + row.totalScore, 0);
    const totalDarts = sessionRows.reduce(
      (sum, row) => sum + effectiveDartsForVisit(row),
      0,
    );
    if (totalDarts === 0) continue;
    highest = Math.max(highest, (totalScore / totalDarts) * 3);
  }
  return highest;
}

export function firstNineCareerAverage(rows: readonly PlayerVisitFactRow[]): number {
  const pooled: number[] = [];
  for (const sessionRows of groupBySession(rows).values()) {
    const firstThree = [...sessionRows]
      .sort((a, b) => a.turnSequence - b.turnSequence)
      .slice(0, 3);
    pooled.push(...firstThree.map((row) => row.totalScore));
  }
  if (pooled.length === 0) return 0;
  return pooled.reduce((sum, score) => sum + score, 0) / pooled.length;
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd app
npx vitest run tests/modules/stats/visit-stats.module.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run the full suite and format check**

```bash
cd app
npm test
npm run format:check
```

- [ ] **Step 7: Commit**

```bash
git add app/src/modules/stats/types.ts app/src/modules/stats/visit-stats.module.ts \
  app/tests/modules/stats/visit-stats.module.test.ts
git commit -m "$(cat <<'EOF'
Add visit-stats.module.ts: darts thrown, score bands, median, averages

Pure functions over v_player_visit_facts-shaped rows: total darts
thrown (best-effort), 100/120/140+/180 counts, median visit score,
highest single-game average, career first-9 average.
EOF
)"
```

---

### Task 4: `leg-stats.module.ts`

Pure functions over `v_player_leg_facts`-shaped rows: best leg (least darts), average darts per leg.

**Files:**
- Modify: `app/src/modules/stats/types.ts`
- Create: `app/src/modules/stats/leg-stats.module.ts`
- Test: `app/tests/modules/stats/leg-stats.module.test.ts`

**Interfaces:**
- Produces: type `PlayerLegFactRow` (`@modules/types`); functions `bestLegDarts`, `averageDartsPerLeg` (`@modules/stats/leg-stats.module`). Task 7's repository imports `PlayerLegFactRow` from `@modules/types`.

- [ ] **Step 1: Write the failing test**

Create `app/tests/modules/stats/leg-stats.module.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { averageDartsPerLeg, bestLegDarts } from "@modules/stats/leg-stats.module";
import type { PlayerLegFactRow } from "@modules/types";

function leg(overrides: Partial<PlayerLegFactRow> = {}): PlayerLegFactRow {
  return {
    sessionId: "session-1",
    gameTypeKey: "501",
    stageId: "stage-1",
    totalDartsInLeg: 15,
    ...overrides,
  };
}

describe("bestLegDarts", () => {
  it("returns null for no legs", () => {
    expect(bestLegDarts([])).toBeNull();
  });

  it("returns the fewest darts across legs", () => {
    const rows = [leg({ totalDartsInLeg: 15 }), leg({ totalDartsInLeg: 9 }), leg({ totalDartsInLeg: 12 })];
    expect(bestLegDarts(rows)).toBe(9);
  });
});

describe("averageDartsPerLeg", () => {
  it("returns null for no legs", () => {
    expect(averageDartsPerLeg([])).toBeNull();
  });

  it("averages darts across legs", () => {
    const rows = [leg({ totalDartsInLeg: 12 }), leg({ totalDartsInLeg: 18 })];
    expect(averageDartsPerLeg(rows)).toBe(15);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd app
npx vitest run tests/modules/stats/leg-stats.module.test.ts
```

Expected: FAIL — module and type not found.

- [ ] **Step 3: Add the row type**

In `app/src/modules/stats/types.ts`, append:

```ts

/** One row of `v_player_leg_facts`. */
export type PlayerLegFactRow = {
  sessionId: string;
  gameTypeKey: string;
  stageId: string;
  totalDartsInLeg: number;
};
```

- [ ] **Step 4: Write the implementation**

Create `app/src/modules/stats/leg-stats.module.ts`:

```ts
import type { PlayerLegFactRow } from "./types";

export function bestLegDarts(rows: readonly PlayerLegFactRow[]): number | null {
  if (rows.length === 0) return null;
  return Math.min(...rows.map((row) => row.totalDartsInLeg));
}

export function averageDartsPerLeg(rows: readonly PlayerLegFactRow[]): number | null {
  if (rows.length === 0) return null;
  const total = rows.reduce((sum, row) => sum + row.totalDartsInLeg, 0);
  return total / rows.length;
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd app
npx vitest run tests/modules/stats/leg-stats.module.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run the full suite and format check**

```bash
cd app
npm test
npm run format:check
```

- [ ] **Step 7: Commit**

```bash
git add app/src/modules/stats/types.ts app/src/modules/stats/leg-stats.module.ts \
  app/tests/modules/stats/leg-stats.module.test.ts
git commit -m "$(cat <<'EOF'
Add leg-stats.module.ts: best leg and average darts per leg

Pure functions over v_player_leg_facts-shaped rows, which already
excludes incomplete-capture legs -- null result when no leg qualifies.
EOF
)"
```

---

### Task 5: `highest-checkout.module.ts`

Highest successful checkout finish, with a repeat count (e.g. "170 ×3"). Reuses `CheckoutVisitDarts`/`DartFact` — the same shape `double-attempt.module.ts` already consumes — without touching that file.

**Files:**
- Modify: `app/src/modules/game/types.ts`
- Create: `app/src/modules/game/highest-checkout.module.ts`
- Test: `app/tests/modules/game/highest-checkout.module.test.ts`

**Interfaces:**
- Consumes: `CheckoutVisitDarts`, `DartFact` (already exported from `@modules/types` via `app/src/modules/types.ts`'s existing `export * from "./game/types"` — no barrel change needed here, `game/types` was already raised).
- Produces: type `HighestCheckout` (`@modules/types`); function `highestCheckout` (`@modules/game/highest-checkout.module`). Task 8's service imports `highestCheckout`.

- [ ] **Step 1: Write the failing test**

Create `app/tests/modules/game/highest-checkout.module.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { highestCheckout } from "@modules/game/highest-checkout.module";
import type { CheckoutVisitDarts, DartFact } from "@modules/types";

function dart(hitZoneKey: DartFact["hitZoneKey"], score: number): DartFact {
  return {
    sequence: 1,
    intendedTargetNumber: null,
    intendedZoneKey: null,
    hitTargetNumber: null,
    hitZoneKey,
    score,
    locationX: null,
    locationY: null,
  };
}

describe("highestCheckout", () => {
  it("returns null when no visit finishes", () => {
    const visits: CheckoutVisitDarts[] = [
      { startingRemaining: 40, darts: [dart("SINGLE", 20)] },
    ];
    expect(highestCheckout(visits)).toBeNull();
  });

  it("returns the finishing value and a repeat count of 1 for a single finish", () => {
    const visits: CheckoutVisitDarts[] = [
      { startingRemaining: 40, darts: [dart("DOUBLE", 40)] },
    ];
    expect(highestCheckout(visits)).toEqual({ value: 40, timesHit: 1 });
  });

  it("returns the highest finish across visits, ignoring lower ones", () => {
    const visits: CheckoutVisitDarts[] = [
      { startingRemaining: 40, darts: [dart("DOUBLE", 40)] },
      { startingRemaining: 50, darts: [dart("INNER_BULL", 50)] },
    ];
    expect(highestCheckout(visits)).toEqual({ value: 50, timesHit: 1 });
  });

  it("counts repeats of the same highest finish value", () => {
    const visits: CheckoutVisitDarts[] = [
      { startingRemaining: 40, darts: [dart("DOUBLE", 40)] },
      { startingRemaining: 40, darts: [dart("DOUBLE", 40)] },
      { startingRemaining: 32, darts: [dart("DOUBLE", 32)] },
    ];
    expect(highestCheckout(visits)).toEqual({ value: 40, timesHit: 2 });
  });

  it("only counts a dart that lands exactly on the remaining score's double or inner bull", () => {
    const visits: CheckoutVisitDarts[] = [
      { startingRemaining: 40, darts: [dart("OUTER_BULL", 25)] },
      { startingRemaining: 36, darts: [dart("DOUBLE", 32)] },
    ];
    expect(highestCheckout(visits)).toBeNull();
  });

  it("finds a finish that isn't the visit's last dart", () => {
    const visits: CheckoutVisitDarts[] = [
      {
        startingRemaining: 100,
        darts: [dart("TREBLE", 60), dart("DOUBLE", 40), dart("SINGLE", 5)],
      },
    ];
    expect(highestCheckout(visits)).toEqual({ value: 40, timesHit: 1 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd app
npx vitest run tests/modules/game/highest-checkout.module.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Add the result type**

In `app/src/modules/game/types.ts`, immediately after the existing `CheckoutVisitDarts` type (`/** One visit's darts, plus the remaining score it opened against. */` block), add:

```ts

/** The largest successful checkout finish, and how many times it was hit. */
export type HighestCheckout = {
  value: number;
  timesHit: number;
};
```

- [ ] **Step 4: Write the implementation**

Create `app/src/modules/game/highest-checkout.module.ts`:

```ts
import type { CheckoutVisitDarts, DartFact, HighestCheckout } from "./types";

const FINISHING_ZONES: ReadonlySet<DartFact["hitZoneKey"]> = new Set([
  "DOUBLE",
  "INNER_BULL",
]);

function isFinishingDart(remaining: number, dart: DartFact): boolean {
  return FINISHING_ZONES.has(dart.hitZoneKey) && dart.score === remaining;
}

/**
 * The largest remaining score any visit successfully finished, and how many
 * times that exact value was hit. Walks the same `CheckoutVisitDarts` shape
 * `double-attempt.module.ts` classifies, independently -- this measures the
 * finish value itself, not a hit/miss tally, so it does not share that
 * module's classifier.
 */
export function highestCheckout(
  visits: readonly CheckoutVisitDarts[],
): HighestCheckout | null {
  const finishes: number[] = [];
  for (const visit of visits) {
    let remaining = visit.startingRemaining;
    for (const dart of visit.darts) {
      if (isFinishingDart(remaining, dart)) finishes.push(remaining);
      remaining -= dart.score;
    }
  }
  if (finishes.length === 0) return null;
  const value = Math.max(...finishes);
  const timesHit = finishes.filter((finish) => finish === value).length;
  return { value, timesHit };
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd app
npx vitest run tests/modules/game/highest-checkout.module.test.ts
```

Expected: PASS.

- [ ] **Step 6: Run the full suite and format check**

```bash
cd app
npm test
npm run format:check
```

- [ ] **Step 7: Commit**

```bash
git add app/src/modules/game/types.ts app/src/modules/game/highest-checkout.module.ts \
  app/tests/modules/game/highest-checkout.module.test.ts
git commit -m "$(cat <<'EOF'
Add highest-checkout.module.ts: largest finish + repeat count

Walks the same CheckoutVisitDarts shape double-attempt.module.ts
classifies, independently -- reports the finish value and repeat
count (e.g. "170 x3"), not a hit/miss tally, so it needs no shared
classifier with that module.
EOF
)"
```

---

### Task 6: `scoring-average.module.ts`

Career scoring average, refined to exclude double-attempt darts where classifiable (X01 sessions with dart-level data). Requires exporting the existing private `classifyDart`/`DartOutcome` from `double-attempt.module.ts` — an additive export, no logic change, reused rather than duplicated per that module's own "one classifier, two callers" precedent.

**Files:**
- Modify: `app/src/modules/game/types.ts`
- Modify: `app/src/modules/game/double-attempt.module.ts`
- Modify: `app/tests/modules/game/double-attempt.module.test.ts`
- Create: `app/src/modules/stats/scoring-average.module.ts`
- Test: `app/tests/modules/stats/scoring-average.module.test.ts`

**Interfaces:**
- Consumes: `effectiveDartsForVisit`, `PlayerVisitFactRow` (Task 3); `CheckoutVisitDarts` (`@modules/types`); newly-exported `classifyDart`, `DartOutcome` (`@modules/types`, defined in `app/src/modules/game/types.ts`, function still lives in `double-attempt.module.ts`).
- Produces: function `scoringAverageExcludingDoubles` (`@modules/stats/scoring-average.module`). Task 8's service imports it.

- [ ] **Step 1: Write the failing test for the new export**

In `app/tests/modules/game/double-attempt.module.test.ts`, change the existing import:

```ts
import { classifyDoubleAttempts } from "@modules/game/double-attempt.module";
```

to:

```ts
import { classifyDart, classifyDoubleAttempts } from "@modules/game/double-attempt.module";
```

and add a new `describe` block at the end of the file:

```ts
describe("classifyDart", () => {
  it("is exported directly so other modules can reuse the classification rule", () => {
    expect(classifyDart(40, dart(20, "DOUBLE", 40))).toBe("HIT");
    expect(classifyDart(40, dart(20, "SINGLE", 20))).toBe("MISS");
    expect(classifyDart(121, dart(20, "TREBLE", 60))).toBe("NOT_ATTEMPT");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd app
npx vitest run tests/modules/game/double-attempt.module.test.ts
```

Expected: FAIL — `classifyDart` is not exported from `@modules/game/double-attempt.module`.

- [ ] **Step 3: Move `DartOutcome` into `types.ts` and export `classifyDart`**

In `app/src/modules/game/types.ts`, immediately after the `HighestCheckout` type added in Task 5, add:

```ts

/** One dart's classification against the remaining score it was thrown at. */
export type DartOutcome = "HIT" | "MISS" | "NOT_ATTEMPT";
```

In `app/src/modules/game/double-attempt.module.ts`, change:

```ts
import type { CheckoutVisitDarts, DartFact, DartZoneKey } from "./types";

export type { CheckoutVisitDarts };
```

to:

```ts
import type { CheckoutVisitDarts, DartFact, DartOutcome, DartZoneKey } from "./types";

export type { CheckoutVisitDarts };
```

and change:

```ts
type DartOutcome = "HIT" | "MISS" | "NOT_ATTEMPT";

/**
 * One dart's classification against the remaining score it was thrown at.
 * `remaining === 50` treats the inner bull as "the required double" and the
 * outer bull as its own near-miss zone; every other eligible remaining
 * treats `remaining / 2` as the required double's segment number.
 */
function classifyDart(remaining: number, dart: DartFact): DartOutcome {
```

to:

```ts
/**
 * One dart's classification against the remaining score it was thrown at.
 * `remaining === 50` treats the inner bull as "the required double" and the
 * outer bull as its own near-miss zone; every other eligible remaining
 * treats `remaining / 2` as the required double's segment number.
 */
export function classifyDart(remaining: number, dart: DartFact): DartOutcome {
```

(This drops the file's own private `DartOutcome` declaration in favor of the one now in `types.ts`, and adds `export` to the function — the classification logic itself is untouched.)

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd app
npx vitest run tests/modules/game/double-attempt.module.test.ts
```

Expected: PASS, including the new `classifyDart` block.

- [ ] **Step 5: Write the failing test for the new module**

Create `app/tests/modules/stats/scoring-average.module.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { scoringAverageExcludingDoubles } from "@modules/stats/scoring-average.module";
import type { CheckoutVisitDarts, DartFact, PlayerVisitFactRow } from "@modules/types";

function visit(overrides: Partial<PlayerVisitFactRow> = {}): PlayerVisitFactRow {
  return {
    sessionId: "session-1",
    gameTypeKey: "501",
    stageId: "stage-1",
    stageTypeKey: "LEG",
    turnSequence: 1,
    totalScore: 60,
    dartCount: 3,
    configuredMaxDartsPerTurn: 3,
    ...overrides,
  };
}

function dart(
  hitTargetNumber: number | null,
  hitZoneKey: DartFact["hitZoneKey"],
  score: number,
): DartFact {
  return {
    sequence: 1,
    intendedTargetNumber: null,
    intendedZoneKey: null,
    hitTargetNumber,
    hitZoneKey,
    score,
    locationX: null,
    locationY: null,
  };
}

describe("scoringAverageExcludingDoubles", () => {
  it("returns 0 for no visits", () => {
    expect(scoringAverageExcludingDoubles([], [])).toBe(0);
  });

  it("returns the plain 3-dart average when there is no dart-level double-out data", () => {
    const rows = [visit({ totalScore: 60, dartCount: 3 }), visit({ totalScore: 60, dartCount: 3 })];
    expect(scoringAverageExcludingDoubles(rows, [])).toBe(60);
  });

  it("excludes a successful double-attempt dart's score and count", () => {
    const rows = [visit({ totalScore: 140, dartCount: 3 })];
    const doubleOutVisits: CheckoutVisitDarts[] = [
      {
        // 140 -> 80 -> 20 remaining; the third dart opens at 20, an even
        // directly-finishable remaining, so it's a real double attempt.
        startingRemaining: 140,
        darts: [dart(20, "TREBLE", 60), dart(20, "TREBLE", 60), dart(20, "DOUBLE", 20)],
      },
    ];
    // 140 total over 3 darts, minus the 20-point double-attempt dart:
    // (140 - 20) / (3 - 1) * 3 = 180.
    expect(scoringAverageExcludingDoubles(rows, doubleOutVisits)).toBe(180);
  });

  it("excludes a missed double-attempt dart too, not just successful ones", () => {
    const rows = [visit({ totalScore: 60, dartCount: 3 })];
    const doubleOutVisits: CheckoutVisitDarts[] = [
      // 40 remaining, needs D20; single 20 is the same segment as the
      // required double -- a plausible errant shot at it (MISS), not a
      // lay-up (NOT_ATTEMPT).
      { startingRemaining: 40, darts: [dart(20, "SINGLE", 20)] },
    ];
    // 60 total over 3 darts, minus the 20-point miss: (60 - 20) / (3 - 1) * 3 = 60.
    expect(scoringAverageExcludingDoubles(rows, doubleOutVisits)).toBe(60);
  });

  it("returns 0 rather than dividing by zero when every dart is excluded", () => {
    const rows = [visit({ totalScore: 40, dartCount: 1 })];
    const doubleOutVisits: CheckoutVisitDarts[] = [
      { startingRemaining: 40, darts: [dart(20, "DOUBLE", 40)] },
    ];
    expect(scoringAverageExcludingDoubles(rows, doubleOutVisits)).toBe(0);
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

```bash
cd app
npx vitest run tests/modules/stats/scoring-average.module.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 7: Write the implementation**

Create `app/src/modules/stats/scoring-average.module.ts`:

```ts
import { classifyDart } from "@modules/game/double-attempt.module";
import type { CheckoutVisitDarts } from "@modules/types";
import { effectiveDartsForVisit } from "./visit-stats.module";
import type { PlayerVisitFactRow } from "./types";

function attemptDartsTotals(visits: readonly CheckoutVisitDarts[]): {
  score: number;
  count: number;
} {
  let score = 0;
  let count = 0;
  for (const visit of visits) {
    let remaining = visit.startingRemaining;
    for (const dart of visit.darts) {
      if (classifyDart(remaining, dart) !== "NOT_ATTEMPT") {
        score += dart.score;
        count += 1;
      }
      remaining -= dart.score;
    }
  }
  return { score, count };
}

/**
 * Career 3-dart average, excluding darts classified as double-out attempts
 * wherever that classification is available (X01 sessions with dart-level
 * capture). Sessions or darts without that data pass through unrefined --
 * every dart counts as scoring, since there's no basis to say otherwise.
 */
export function scoringAverageExcludingDoubles(
  visitRows: readonly PlayerVisitFactRow[],
  doubleOutVisits: readonly CheckoutVisitDarts[] = [],
): number {
  const totalScore = visitRows.reduce((sum, row) => sum + row.totalScore, 0);
  const totalDarts = visitRows.reduce(
    (sum, row) => sum + effectiveDartsForVisit(row),
    0,
  );
  const attempts = attemptDartsTotals(doubleOutVisits);
  const scoringScore = totalScore - attempts.score;
  const scoringDarts = totalDarts - attempts.count;
  return scoringDarts <= 0 ? 0 : (scoringScore / scoringDarts) * 3;
}
```

- [ ] **Step 8: Run the test to verify it passes**

```bash
cd app
npx vitest run tests/modules/stats/scoring-average.module.test.ts
```

Expected: PASS.

- [ ] **Step 9: Run the full suite and format check**

```bash
cd app
npm test
npm run format:check
```

- [ ] **Step 10: Commit**

```bash
git add app/src/modules/game/types.ts app/src/modules/game/double-attempt.module.ts \
  app/tests/modules/game/double-attempt.module.test.ts \
  app/src/modules/stats/scoring-average.module.ts \
  app/tests/modules/stats/scoring-average.module.test.ts
git commit -m "$(cat <<'EOF'
Add scoring-average.module.ts: career avg excluding double attempts

Exports double-attempt.module.ts's existing classifyDart/DartOutcome
(additive, no logic change) so the new module reuses the one
classification rule instead of forking it. Sessions without
dart-level double-out data pass through as the plain 3-dart average.
EOF
)"
```

---

### Task 7: `repositories/statistics.repository.ts`

Four read functions, one per view, player-scoped, no aggregation. `findDoubleOutVisits` reshapes `v_double_out_checkout_darts`' flat rows into the `CheckoutVisitDarts[]` shape the pure modules and `classifyDoubleAttempts` consume.

**Files:**
- Create: `app/src/repositories/statistics.repository.ts`
- Test: `app/tests/repositories/statistics.repository.test.ts`

**Interfaces:**
- Consumes: `PlayerSessionSummaryRow`, `PlayerVisitFactRow`, `PlayerLegFactRow`, `CheckoutVisitDarts`, `DartFact` (all `@modules/types`); `vSessionOverview`, `vPlayerVisitFacts`, `vPlayerLegFacts`, `vDoubleOutCheckoutDarts`, `exerciseConfigurations` (`@db/schema`, Task 1).
- Produces: functions `findSessionSummaries`, `findVisitFacts`, `findLegFacts`, `findDoubleOutVisits` (`@repositories/statistics.repository`). Task 8's service imports all four.

- [ ] **Step 1: Write the failing tests**

Create `app/tests/repositories/statistics.repository.test.ts`:

```ts
import { describe, it, expect, vi } from "vitest";

function fakeSelect(rows: unknown[]) {
  const fromCalls: unknown[] = [];
  const chain = {
    from: vi.fn((table: unknown) => {
      fromCalls.push(table);
      return chain;
    }),
    where: vi.fn().mockResolvedValue(rows),
  };
  return { chain, fromCalls };
}

describe("findSessionSummaries", () => {
  it("reads from v_session_overview", async () => {
    const row = {
      gameTypeKey: "501",
      statusKey: "COMPLETED",
      startedAt: "2026-09-01T10:00:00.000Z",
      durationSeconds: 600,
    };
    const { chain, fromCalls } = fakeSelect([row]);
    const db = { select: vi.fn(() => chain) } as any;
    const { vSessionOverview } = await import("@db/schema");
    const { findSessionSummaries } =
      await import("@repositories/statistics.repository");

    const result = await findSessionSummaries(db, "p1");

    expect(result).toEqual([row]);
    expect(fromCalls).toEqual([vSessionOverview]);
  });
});

describe("findVisitFacts", () => {
  it("reads from v_player_visit_facts", async () => {
    const row = {
      sessionId: "s1",
      gameTypeKey: "501",
      stageId: "stage-1",
      stageTypeKey: "LEG",
      turnSequence: 1,
      totalScore: 60,
      dartCount: 3,
      configuredMaxDartsPerTurn: 3,
    };
    const { chain, fromCalls } = fakeSelect([row]);
    const db = { select: vi.fn(() => chain) } as any;
    const { vPlayerVisitFacts } = await import("@db/schema");
    const { findVisitFacts } = await import("@repositories/statistics.repository");

    const result = await findVisitFacts(db, "p1");

    expect(result).toEqual([row]);
    expect(fromCalls).toEqual([vPlayerVisitFacts]);
  });
});

describe("findLegFacts", () => {
  it("reads from v_player_leg_facts and parses total_darts_in_leg to a number", async () => {
    const row = {
      sessionId: "s1",
      gameTypeKey: "501",
      stageId: "stage-1",
      totalDartsInLeg: "15",
    };
    const { chain, fromCalls } = fakeSelect([row]);
    const db = { select: vi.fn(() => chain) } as any;
    const { vPlayerLegFacts } = await import("@db/schema");
    const { findLegFacts } = await import("@repositories/statistics.repository");

    const result = await findLegFacts(db, "p1");

    expect(result).toEqual([
      { sessionId: "s1", gameTypeKey: "501", stageId: "stage-1", totalDartsInLeg: 15 },
    ]);
    expect(fromCalls).toEqual([vPlayerLegFacts]);
  });
});

function fakeDoubleOutQuery(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockResolvedValue(rows),
  };
}

function fakeConfigQuery(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue(rows),
  };
}

describe("findDoubleOutVisits", () => {
  it("returns an empty array when the player has no double-out darts", async () => {
    const db = { select: vi.fn(() => fakeDoubleOutQuery([])) } as any;
    const { findDoubleOutVisits } =
      await import("@repositories/statistics.repository");

    const result = await findDoubleOutVisits(db, "p1");

    expect(result).toEqual([]);
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it("groups darts by turn and computes startingRemaining from the session's starting_score", async () => {
    const dartRows = [
      {
        sessionId: "s1",
        stageId: "stage-1",
        turnSequence: 1,
        dartNumber: 1,
        hitTargetNumber: 20,
        hitZoneKey: "TREBLE",
        score: 60,
        priorScoredInStage: null,
      },
      {
        sessionId: "s1",
        stageId: "stage-1",
        turnSequence: 1,
        dartNumber: 2,
        hitTargetNumber: 20,
        hitZoneKey: "TREBLE",
        score: 60,
        priorScoredInStage: 60,
      },
      {
        sessionId: "s1",
        stageId: "stage-1",
        turnSequence: 2,
        dartNumber: 1,
        hitTargetNumber: 20,
        hitZoneKey: "DOUBLE",
        score: 40,
        priorScoredInStage: 120,
      },
    ];
    const configRows = [{ sessionId: "s1", configuration: { starting_score: 501 } }];
    const db = {
      select: vi
        .fn()
        .mockReturnValueOnce(fakeDoubleOutQuery(dartRows))
        .mockReturnValueOnce(fakeConfigQuery(configRows)),
    } as any;
    const { findDoubleOutVisits } =
      await import("@repositories/statistics.repository");

    const result = await findDoubleOutVisits(db, "p1");

    expect(result).toEqual([
      {
        startingRemaining: 501,
        darts: [
          {
            sequence: 1,
            intendedTargetNumber: null,
            intendedZoneKey: null,
            hitTargetNumber: 20,
            hitZoneKey: "TREBLE",
            score: 60,
            locationX: null,
            locationY: null,
          },
          {
            sequence: 2,
            intendedTargetNumber: null,
            intendedZoneKey: null,
            hitTargetNumber: 20,
            hitZoneKey: "TREBLE",
            score: 60,
            locationX: null,
            locationY: null,
          },
        ],
      },
      {
        startingRemaining: 381,
        darts: [
          {
            sequence: 1,
            intendedTargetNumber: null,
            intendedZoneKey: null,
            hitTargetNumber: 20,
            hitZoneKey: "DOUBLE",
            score: 40,
            locationX: null,
            locationY: null,
          },
        ],
      },
    ]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
cd app
npx vitest run tests/repositories/statistics.repository.test.ts
```

Expected: FAIL — `Cannot find module '@repositories/statistics.repository'`.

- [ ] **Step 3: Write the implementation**

Create `app/src/repositories/statistics.repository.ts`:

```ts
import { eq, inArray } from "drizzle-orm";
import {
  exerciseConfigurations,
  vDoubleOutCheckoutDarts,
  vPlayerLegFacts,
  vPlayerVisitFacts,
  vSessionOverview,
} from "@db/schema";
import type { getDb } from "@db/client";
import type {
  CheckoutVisitDarts,
  DartFact,
  PlayerLegFactRow,
  PlayerSessionSummaryRow,
  PlayerVisitFactRow,
} from "@modules/types";

type Db = ReturnType<typeof getDb>;

/** Reads career session summaries through `v_session_overview`. */
export async function findSessionSummaries(
  db: Db,
  playerId: string,
): Promise<PlayerSessionSummaryRow[]> {
  const rows = await db
    .select({
      gameTypeKey: vSessionOverview.gameTypeKey,
      statusKey: vSessionOverview.statusKey,
      startedAt: vSessionOverview.startedAt,
      durationSeconds: vSessionOverview.durationSeconds,
    })
    .from(vSessionOverview)
    .where(eq(vSessionOverview.playerId, playerId));

  return rows as PlayerSessionSummaryRow[];
}

/** Reads every completed turn through `v_player_visit_facts`. */
export async function findVisitFacts(
  db: Db,
  playerId: string,
): Promise<PlayerVisitFactRow[]> {
  const rows = await db
    .select({
      sessionId: vPlayerVisitFacts.sessionId,
      gameTypeKey: vPlayerVisitFacts.gameTypeKey,
      stageId: vPlayerVisitFacts.stageId,
      stageTypeKey: vPlayerVisitFacts.stageTypeKey,
      turnSequence: vPlayerVisitFacts.turnSequence,
      totalScore: vPlayerVisitFacts.totalScore,
      dartCount: vPlayerVisitFacts.dartCount,
      configuredMaxDartsPerTurn: vPlayerVisitFacts.configuredMaxDartsPerTurn,
    })
    .from(vPlayerVisitFacts)
    .where(eq(vPlayerVisitFacts.playerId, playerId));

  return rows as PlayerVisitFactRow[];
}

/**
 * Reads complete-capture legs through `v_player_leg_facts`.
 * `total_darts_in_leg` is a Postgres NUMERIC (SUM of a bigint COUNT), which
 * arrives as a string through Drizzle/node-postgres -- parsed to a number here.
 */
export async function findLegFacts(
  db: Db,
  playerId: string,
): Promise<PlayerLegFactRow[]> {
  const rows = await db
    .select({
      sessionId: vPlayerLegFacts.sessionId,
      gameTypeKey: vPlayerLegFacts.gameTypeKey,
      stageId: vPlayerLegFacts.stageId,
      totalDartsInLeg: vPlayerLegFacts.totalDartsInLeg,
    })
    .from(vPlayerLegFacts)
    .where(eq(vPlayerLegFacts.playerId, playerId));

  return rows.map((row) => ({
    ...row,
    totalDartsInLeg: Number(row.totalDartsInLeg),
  }));
}

async function findStartingScores(
  db: Db,
  sessionIds: string[],
): Promise<Map<string, number>> {
  const rows = await db
    .select({
      sessionId: exerciseConfigurations.exerciseSessionId,
      configuration: exerciseConfigurations.configuration,
    })
    .from(exerciseConfigurations)
    .where(inArray(exerciseConfigurations.exerciseSessionId, sessionIds));

  return new Map(
    rows.map((row) => [
      row.sessionId,
      (row.configuration as { starting_score: number }).starting_score,
    ]),
  );
}

type MutableCheckoutVisit = { startingRemaining: number; darts: DartFact[] };

/**
 * Reshapes `v_double_out_checkout_darts`' flat per-dart rows into
 * `CheckoutVisitDarts[]` (one entry per turn), the shape
 * `double-attempt.module.ts` classifies. `startingRemaining` for a turn is
 * the session's configured `starting_score` minus that turn's first dart's
 * `prior_scored_in_stage` (0 when null, meaning the stage's very first dart).
 */
export async function findDoubleOutVisits(
  db: Db,
  playerId: string,
): Promise<CheckoutVisitDarts[]> {
  const rows = await db
    .select({
      sessionId: vDoubleOutCheckoutDarts.sessionId,
      stageId: vDoubleOutCheckoutDarts.stageId,
      turnSequence: vDoubleOutCheckoutDarts.turnSequence,
      dartNumber: vDoubleOutCheckoutDarts.dartNumber,
      hitTargetNumber: vDoubleOutCheckoutDarts.hitTargetNumber,
      hitZoneKey: vDoubleOutCheckoutDarts.hitZoneKey,
      score: vDoubleOutCheckoutDarts.score,
      priorScoredInStage: vDoubleOutCheckoutDarts.priorScoredInStage,
    })
    .from(vDoubleOutCheckoutDarts)
    .where(eq(vDoubleOutCheckoutDarts.playerId, playerId))
    .orderBy(
      vDoubleOutCheckoutDarts.stageId,
      vDoubleOutCheckoutDarts.turnSequence,
      vDoubleOutCheckoutDarts.dartNumber,
    );

  if (rows.length === 0) return [];

  const sessionIds = [...new Set(rows.map((row) => row.sessionId))];
  const startingScores = await findStartingScores(db, sessionIds);

  const visitsByKey = new Map<string, MutableCheckoutVisit>();
  for (const row of rows) {
    const key = `${row.stageId}:${row.turnSequence}`;
    let visit = visitsByKey.get(key);
    if (!visit) {
      const startingScore = startingScores.get(row.sessionId) ?? 0;
      visit = {
        startingRemaining: startingScore - (row.priorScoredInStage ?? 0),
        darts: [],
      };
      visitsByKey.set(key, visit);
    }
    visit.darts.push({
      sequence: row.dartNumber,
      intendedTargetNumber: null,
      intendedZoneKey: null,
      hitTargetNumber: row.hitTargetNumber,
      hitZoneKey: row.hitZoneKey as DartFact["hitZoneKey"],
      score: row.score,
      locationX: null,
      locationY: null,
    });
  }

  return Array.from(visitsByKey.values());
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
cd app
npx vitest run tests/repositories/statistics.repository.test.ts
```

Expected: PASS, all cases green.

- [ ] **Step 5: Run the full suite and format check**

```bash
cd app
npm test
npm run format:check
```

- [ ] **Step 6: Commit**

```bash
git add app/src/repositories/statistics.repository.ts \
  app/tests/repositories/statistics.repository.test.ts
git commit -m "$(cat <<'EOF'
Add statistics.repository.ts: reads over the 4 statistics views

Four player-scoped reads, no aggregation. findDoubleOutVisits
reshapes the flat per-dart view into the CheckoutVisitDarts[] shape
double-attempt.module.ts and highest-checkout.module.ts consume.
EOF
)"
```

---

### Task 8: `services/statistics.service.ts`

Composes the four repository reads through the five pure modules into one flat result.

**Files:**
- Modify: `app/src/services/types.ts`
- Create: `app/src/services/statistics.service.ts`
- Test: `app/tests/services/statistics.service.test.ts`

**Interfaces:**
- Consumes: `findSessionSummaries`, `findVisitFacts`, `findLegFacts`, `findDoubleOutVisits` (Task 7); `totalGamesPlayed`, `totalPlayTimeSeconds`, `favoriteGameTypeKey`, `longestPlayStreakDays`, `currentPlayStreakDays` (Task 2); `totalDartsThrown`, `scoreBandCounts`, `medianVisitScore`, `highestGameAverage`, `firstNineCareerAverage` (Task 3); `bestLegDarts`, `averageDartsPerLeg` (Task 4); `highestCheckout` (Task 5); `scoringAverageExcludingDoubles` (Task 6); `classifyDoubleAttempts` (existing, `@modules/game/double-attempt.module`).
- Produces: type `StatisticsOverview` (`@services/types`); function `getStatisticsOverview(playerId: string): Promise<StatisticsOverview>` (`@services/statistics.service`). Task 9's controller imports it.

- [ ] **Step 1: Write the failing test**

Create `app/tests/services/statistics.service.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@db/client", () => ({ getDb: vi.fn(() => ({})) }));
vi.mock("@repositories/statistics.repository", () => ({
  findSessionSummaries: vi.fn(),
  findVisitFacts: vi.fn(),
  findLegFacts: vi.fn(),
  findDoubleOutVisits: vi.fn(),
}));

import * as repo from "@repositories/statistics.repository";
import { getStatisticsOverview } from "@services/statistics.service";

const playerId = "0198f200-0000-7000-8000-000000000001";

describe("getStatisticsOverview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns all-zero/null stats when the player has no history", async () => {
    vi.mocked(repo.findSessionSummaries).mockResolvedValue([]);
    vi.mocked(repo.findVisitFacts).mockResolvedValue([]);
    vi.mocked(repo.findLegFacts).mockResolvedValue([]);
    vi.mocked(repo.findDoubleOutVisits).mockResolvedValue([]);

    const result = await getStatisticsOverview(playerId);

    expect(result).toEqual({
      totalGamesPlayed: 0,
      totalPlayTimeSeconds: 0,
      favoriteGameTypeKey: null,
      longestPlayStreakDays: 0,
      currentPlayStreakDays: 0,
      totalDartsThrown: 0,
      hundredPlusCount: 0,
      oneTwentyPlusCount: 0,
      oneFortyPlusCount: 0,
      oneEightiesCount: 0,
      medianVisitScore: 0,
      highestGameAverage: 0,
      firstNineCareerAverage: 0,
      scoringAverageExcludingDoubles: 0,
      bestLegDarts: null,
      averageDartsPerLeg: null,
      doubleAccuracy: null,
      highestCheckout: null,
    });
  });

  it("composes real history through every module", async () => {
    vi.mocked(repo.findSessionSummaries).mockResolvedValue([
      {
        gameTypeKey: "501",
        statusKey: "COMPLETED",
        startedAt: "2026-09-01T10:00:00.000Z",
        durationSeconds: 600,
      },
    ]);
    vi.mocked(repo.findVisitFacts).mockResolvedValue([
      {
        sessionId: "s1",
        gameTypeKey: "501",
        stageId: "stage-1",
        stageTypeKey: "LEG",
        turnSequence: 1,
        totalScore: 180,
        dartCount: 3,
        configuredMaxDartsPerTurn: 3,
      },
    ]);
    vi.mocked(repo.findLegFacts).mockResolvedValue([
      { sessionId: "s1", gameTypeKey: "501", stageId: "stage-1", totalDartsInLeg: 9 },
    ]);
    vi.mocked(repo.findDoubleOutVisits).mockResolvedValue([]);

    const result = await getStatisticsOverview(playerId);

    expect(result.totalGamesPlayed).toBe(1);
    expect(result.favoriteGameTypeKey).toBe("501");
    expect(result.oneEightiesCount).toBe(1);
    expect(result.bestLegDarts).toBe(9);
    expect(result.doubleAccuracy).toBeNull();
    expect(result.highestCheckout).toBeNull();
  });

  it("computes doubleAccuracy from classified double-out visits", async () => {
    vi.mocked(repo.findSessionSummaries).mockResolvedValue([]);
    vi.mocked(repo.findVisitFacts).mockResolvedValue([]);
    vi.mocked(repo.findLegFacts).mockResolvedValue([]);
    vi.mocked(repo.findDoubleOutVisits).mockResolvedValue([
      {
        startingRemaining: 40,
        darts: [
          {
            sequence: 1,
            intendedTargetNumber: null,
            intendedZoneKey: null,
            hitTargetNumber: 20,
            hitZoneKey: "DOUBLE",
            score: 40,
            locationX: null,
            locationY: null,
          },
        ],
      },
    ]);

    const result = await getStatisticsOverview(playerId);

    expect(result.doubleAccuracy).toBe(1);
    expect(result.highestCheckout).toEqual({ value: 40, timesHit: 1 });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd app
npx vitest run tests/services/statistics.service.test.ts
```

Expected: FAIL — `Cannot find module '@services/statistics.service'`.

- [ ] **Step 3: Add the `StatisticsOverview` type**

In `app/src/services/types.ts`, append:

```ts

/** Career-wide stat overview — `null` means "not enough data," never "not implemented." */
export type StatisticsOverview = {
  totalGamesPlayed: number;
  totalPlayTimeSeconds: number;
  favoriteGameTypeKey: string | null;
  longestPlayStreakDays: number;
  currentPlayStreakDays: number;
  totalDartsThrown: number;
  hundredPlusCount: number;
  oneTwentyPlusCount: number;
  oneFortyPlusCount: number;
  oneEightiesCount: number;
  medianVisitScore: number;
  highestGameAverage: number;
  firstNineCareerAverage: number;
  scoringAverageExcludingDoubles: number;
  bestLegDarts: number | null;
  averageDartsPerLeg: number | null;
  doubleAccuracy: number | null;
  highestCheckout: { value: number; timesHit: number } | null;
};
```

- [ ] **Step 4: Write the implementation**

Create `app/src/services/statistics.service.ts`:

```ts
import { getDb } from "@db/client";
import { classifyDoubleAttempts } from "@modules/game/double-attempt.module";
import { highestCheckout } from "@modules/game/highest-checkout.module";
import {
  currentPlayStreakDays,
  favoriteGameTypeKey,
  longestPlayStreakDays,
  totalGamesPlayed,
  totalPlayTimeSeconds,
} from "@modules/stats/career-summary.module";
import { averageDartsPerLeg, bestLegDarts } from "@modules/stats/leg-stats.module";
import { scoringAverageExcludingDoubles } from "@modules/stats/scoring-average.module";
import {
  firstNineCareerAverage,
  highestGameAverage,
  medianVisitScore,
  scoreBandCounts,
  totalDartsThrown,
} from "@modules/stats/visit-stats.module";
import {
  findDoubleOutVisits,
  findLegFacts,
  findSessionSummaries,
  findVisitFacts,
} from "@repositories/statistics.repository";
import type { StatisticsOverview } from "./types";

/** Assembles the caller's career-wide stat overview from the 4 statistics views. */
export async function getStatisticsOverview(
  playerId: string,
): Promise<StatisticsOverview> {
  const db = getDb();
  const [sessions, visits, legs, doubleOutVisits] = await Promise.all([
    findSessionSummaries(db, playerId),
    findVisitFacts(db, playerId),
    findLegFacts(db, playerId),
    findDoubleOutVisits(db, playerId),
  ]);

  const bands = scoreBandCounts(visits);
  const { hits, misses } = classifyDoubleAttempts(doubleOutVisits);

  return {
    totalGamesPlayed: totalGamesPlayed(sessions),
    totalPlayTimeSeconds: totalPlayTimeSeconds(sessions),
    favoriteGameTypeKey: favoriteGameTypeKey(sessions),
    longestPlayStreakDays: longestPlayStreakDays(sessions),
    currentPlayStreakDays: currentPlayStreakDays(sessions),
    totalDartsThrown: totalDartsThrown(visits),
    hundredPlusCount: bands.hundredPlus,
    oneTwentyPlusCount: bands.oneTwentyPlus,
    oneFortyPlusCount: bands.oneFortyPlus,
    oneEightiesCount: bands.oneEighties,
    medianVisitScore: medianVisitScore(visits),
    highestGameAverage: highestGameAverage(visits),
    firstNineCareerAverage: firstNineCareerAverage(visits),
    scoringAverageExcludingDoubles: scoringAverageExcludingDoubles(
      visits,
      doubleOutVisits,
    ),
    bestLegDarts: bestLegDarts(legs),
    averageDartsPerLeg: averageDartsPerLeg(legs),
    doubleAccuracy: hits + misses === 0 ? null : hits / (hits + misses),
    highestCheckout: highestCheckout(doubleOutVisits),
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
cd app
npx vitest run tests/services/statistics.service.test.ts
```

Expected: PASS, all 3 cases green.

- [ ] **Step 6: Run the full suite and format check**

```bash
cd app
npm test
npm run format:check
```

- [ ] **Step 7: Commit**

```bash
git add app/src/services/types.ts app/src/services/statistics.service.ts \
  app/tests/services/statistics.service.test.ts
git commit -m "$(cat <<'EOF'
Add statistics.service.ts: composes the 4 views into one overview

Orchestration only -- every actual stat computation stays in the
pure modules (Tasks 2-6). doubleAccuracy is hits / (hits + misses)
from the existing classifyDoubleAttempts, computed here directly.
EOF
)"
```

---

### Task 9: `GET /api/statistics/overview` controller

**Files:**
- Create: `app/src/pages/api/statistics/types.ts`
- Modify: `app/src/pages/api/types.ts`
- Create: `app/src/pages/api/statistics/overview.ts`
- Test: `app/tests/pages/api/statistics/overview.test.ts`

**Interfaces:**
- Consumes: `getStatisticsOverview` (Task 8).
- Produces: `StatisticsOverviewResponse` Zod schema + `StatisticsOverviewResponseData` type (`@routes/types`); route handler `GET` at `/api/statistics/overview`.

- [ ] **Step 1: Write the failing test**

Create `app/tests/pages/api/statistics/overview.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@services/statistics.service", () => ({
  getStatisticsOverview: vi.fn(),
}));

import { getStatisticsOverview } from "@services/statistics.service";
import { GET } from "@routes/statistics/overview";

const locals = {
  requestId: "req-1",
  auth: { authUserId: "auth-1", playerId: "player-1" },
};

describe("GET /api/statistics/overview", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns the caller's statistics overview", async () => {
    const overview = {
      totalGamesPlayed: 12,
      totalPlayTimeSeconds: 3600,
      favoriteGameTypeKey: "501",
      longestPlayStreakDays: 3,
      currentPlayStreakDays: 1,
      totalDartsThrown: 300,
      hundredPlusCount: 10,
      oneTwentyPlusCount: 5,
      oneFortyPlusCount: 2,
      oneEightiesCount: 1,
      medianVisitScore: 45,
      highestGameAverage: 65.5,
      firstNineCareerAverage: 50.2,
      scoringAverageExcludingDoubles: 48.1,
      bestLegDarts: 15,
      averageDartsPerLeg: 18.5,
      doubleAccuracy: 0.4,
      highestCheckout: { value: 100, timesHit: 2 },
    };
    vi.mocked(getStatisticsOverview).mockResolvedValue(overview);

    const response = await GET({ locals } as never);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.data).toEqual(overview);
    expect(getStatisticsOverview).toHaveBeenCalledWith("player-1");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
cd app
npx vitest run tests/pages/api/statistics/overview.test.ts
```

Expected: FAIL — `Cannot find module '@routes/statistics/overview'`.

- [ ] **Step 3: Create the response contract**

Create `app/src/pages/api/statistics/types.ts`:

```ts
import { z } from "zod";

/** Contract: docs/architecture/06-API/04-Endpoint-Contracts.md §Statistics Overview. */
export const StatisticsOverviewResponse = z.object({
  totalGamesPlayed: z.number().int(),
  totalPlayTimeSeconds: z.number().int(),
  favoriteGameTypeKey: z.string().nullable(),
  longestPlayStreakDays: z.number().int(),
  currentPlayStreakDays: z.number().int(),
  totalDartsThrown: z.number().int(),
  hundredPlusCount: z.number().int(),
  oneTwentyPlusCount: z.number().int(),
  oneFortyPlusCount: z.number().int(),
  oneEightiesCount: z.number().int(),
  medianVisitScore: z.number(),
  highestGameAverage: z.number(),
  firstNineCareerAverage: z.number(),
  scoringAverageExcludingDoubles: z.number(),
  bestLegDarts: z.number().int().nullable(),
  averageDartsPerLeg: z.number().nullable(),
  doubleAccuracy: z.number().min(0).max(1).nullable(),
  highestCheckout: z
    .object({ value: z.number().int(), timesHit: z.number().int() })
    .nullable(),
});

export type StatisticsOverviewResponseData = z.infer<
  typeof StatisticsOverviewResponse
>;
```

- [ ] **Step 4: Raise the new barrel into `pages/api/types.ts`**

In `app/src/pages/api/types.ts`, change:

```ts
export * from "./players/types";
export * from "./sessions/types";
export * from "./configuration-templates/types";
export type { ErrorCode } from "@server/types";
```

to:

```ts
export * from "./players/types";
export * from "./sessions/types";
export * from "./configuration-templates/types";
export * from "./statistics/types";
export type { ErrorCode } from "@server/types";
```

- [ ] **Step 5: Write the route handler**

Create `app/src/pages/api/statistics/overview.ts`:

```ts
import type { APIRoute } from "astro";
import { getStatisticsOverview } from "@services/statistics.service";
import { ok } from "@server/envelope";

/**
 * Career-wide stat overview for the caller. Every field is always present;
 * null means "not enough data to compute," never "not implemented."
 */
export const GET: APIRoute = async ({ locals }) => {
  const auth = locals.auth!;
  const overview = await getStatisticsOverview(auth.playerId!);
  return ok(overview, locals.requestId);
};
```

- [ ] **Step 6: Run the test to verify it passes**

```bash
cd app
npx vitest run tests/pages/api/statistics/overview.test.ts
```

Expected: PASS.

- [ ] **Step 7: Run the full suite, type check, and format check**

```bash
cd app
npm test
npx astro check
npm run format:check
```

Expected: all clean; `astro check` reports 0 errors/0 warnings/0 hints.

- [ ] **Step 8: Commit**

```bash
git add app/src/pages/api/statistics app/src/pages/api/types.ts \
  app/tests/pages/api/statistics/overview.test.ts
git commit -m "$(cat <<'EOF'
Route GET /api/statistics/overview

Thin controller: no request input to parse, calls the service,
wraps the result in ok(). Fills the route D63 reserved.
EOF
)"
```

---

### Task 10: Docs, decision, and final validation

**Files:**
- Modify: `docs/architecture/06-API/00-Overview.md`
- Modify: `docs/architecture/06-API/02-Middleware-And-Layering.md`
- Modify: `docs/architecture/06-API/04-Endpoint-Contracts.md`
- Modify: `docs/architecture/00-File-Inventory.md`
- Modify: `decisions/api.md`
- Modify: `docs/architecture/00-Context-Map-History.md`

- [ ] **Step 1: Route the endpoint in `00-Overview.md`**

In `docs/architecture/06-API/00-Overview.md`, change the version header:

```
> **Version:** 1.7.0 (`GET`/`PATCH /api/players/me` routed, 2026-08-15; prior 1.6.0 — `GET`/`PATCH /api/players/me/settings` routed, 2026-08-08)
```

to:

```
> **Version:** 1.8.0 (`GET /api/statistics/overview` routed, 2026-09-06; prior 1.7.0 — `GET`/`PATCH /api/players/me` routed, 2026-08-15)
```

Then change the Statistics section:

```
### Statistics

Deferred (post-v1) — no statistics endpoints ship in v1:

- `GET /api/statistics/overview`
- `GET /api/statistics/trends`
- `GET /api/statistics/checkouts`

v1 captures the dart/turn/session facts statistics are derived from; the aggregated read endpoints are added post-v1 and must each be backed by a dedicated `v_*` view (e.g. `v_statistics_overview`). <!-- 2026-07-12 -->
```

to:

```
### Statistics

- `GET /api/statistics/overview` <!-- 2026-09-06 -->

Deferred (post-v1):

- `GET /api/statistics/trends`
- `GET /api/statistics/checkouts`

`GET /api/statistics/overview` reads through `v_session_overview`, `v_player_visit_facts`, `v_player_leg_facts`, and `v_double_out_checkout_darts`; aggregation happens in the service layer (`services/statistics.service.ts`), not a single dedicated `v_statistics_overview` view — see `decisions/api.md`. `trends`/`checkouts` remain deferred and, per the original scope note, must each be view-backed when built. <!-- 2026-09-06 -->
```

Then change the Read Contract table (add a row after the last one):

```
| `GET /api/players/me`                    | `v_player_profile`    |
```

to:

```
| `GET /api/players/me`                    | `v_player_profile`    |
| `GET /api/statistics/overview`           | `v_session_overview`, `v_player_visit_facts`, `v_player_leg_facts`, `v_double_out_checkout_darts` |
```

Then change the Frozen Decisions statistics bullet:

```
- Statistics scope (v1): no statistics endpoints; `overview`, `trends`, and `checkouts` are all deferred post-v1 and must be view-backed when built. <!-- 2026-07-12 -->
```

to:

```
- Statistics scope: `overview` shipped 2026-09-06, composing 4 views in the service layer (no dedicated aggregate view); `trends` and `checkouts` remain deferred post-v1 and must be view-backed when built. <!-- 2026-07-12; overview shipped 2026-09-06 -->
```

- [ ] **Step 2: Add the `statistics/` route folder to `02-Middleware-And-Layering.md`**

In `docs/architecture/06-API/02-Middleware-And-Layering.md`, change:

```
│   └── players/
│       └── provision.ts             # POST (authenticated-unprovisioned route)
```

to:

```
│   ├── players/
│   │   └── provision.ts             # POST (authenticated-unprovisioned route)
│   └── statistics/
│       ├── overview.ts              # GET
│       └── types.ts
```

Then change:

```
## Statistics (deferred)

No `statistics/` route folder exists in v1. Statistics endpoints
(`overview`, `trends`, `checkouts`) are deferred post-v1 and must each be
view-backed when built (see `00-Overview.md` and D63). <!-- 2026-07-13 -->
```

to:

```
## Statistics

`GET /api/statistics/overview` is routed (`pages/api/statistics/overview.ts`,
2026-09-06), filling the slot D63 reserved. `trends`/`checkouts` remain
deferred post-v1 and must each be view-backed when built (see
`00-Overview.md`). <!-- 2026-09-06 -->
```

- [ ] **Step 3: Add the full contract to `04-Endpoint-Contracts.md`**

In `docs/architecture/06-API/04-Endpoint-Contracts.md`, change the version header:

```
> **Version:** 1.4.0 (`GET`/`PATCH /api/players/me`, 2026-08-15; prior 1.3.0 — `GET`/`PATCH /api/players/me/settings`, 2026-08-08)
```

to:

```
> **Version:** 1.5.0 (Statistics Overview, 2026-09-06; prior 1.4.0 — `GET`/`PATCH /api/players/me`, 2026-08-15)
```

Then, immediately before the `## Read Contracts` heading, add a new section:

```markdown
## Statistics Overview — `GET /api/statistics/overview`

The caller's career-wide stat overview. Read-only, backed by `v_session_overview`, `v_player_visit_facts`, `v_player_leg_facts`, and `v_double_out_checkout_darts` (migrations `0009`, `0025`, `0026`, `0024`). Aggregation happens in `services/statistics.service.ts` over the four pure modules under `modules/stats/`/`modules/game/`, not a single dedicated view — see `decisions/api.md` for why.

**Auth:** standard protected route class — JWT-verified, player resolved by middleware. No path parameter, no query parameter, no request body.

Every response field is always present. `null` means "not enough data to compute" (e.g. no completed sessions, no legs with complete dart capture) — never "field not implemented." `doubleAccuracy` and `highestCheckout` are computed from whatever `v_double_out_checkout_darts` currently returns (501+`VISUAL_BOARD` only, as of this writing) and will widen automatically, with no contract change, once that view's game-type filter is extended.

Success → `200` with the standard `ok()` envelope carrying `StatisticsOverviewResponse`. No new error codes — only the standard protected-route failures (`401`, `403 PLAYER_NOT_PROVISIONED`, `500`/`503` from the API error boundary).

```typescript
const StatisticsOverviewResponse = z.object({
  totalGamesPlayed: z.number().int(),
  totalPlayTimeSeconds: z.number().int(),
  favoriteGameTypeKey: z.string().nullable(),
  longestPlayStreakDays: z.number().int(),
  currentPlayStreakDays: z.number().int(),
  totalDartsThrown: z.number().int(),
  hundredPlusCount: z.number().int(),
  oneTwentyPlusCount: z.number().int(),
  oneFortyPlusCount: z.number().int(),
  oneEightiesCount: z.number().int(),
  medianVisitScore: z.number(),
  highestGameAverage: z.number(),
  firstNineCareerAverage: z.number(),
  scoringAverageExcludingDoubles: z.number(),
  bestLegDarts: z.number().int().nullable(),
  averageDartsPerLeg: z.number().nullable(),
  doubleAccuracy: z.number().min(0).max(1).nullable(),
  highestCheckout: z
    .object({ value: z.number().int(), timesHit: z.number().int() })
    .nullable(),
});
type StatisticsOverviewResponse = z.infer<typeof StatisticsOverviewResponse>;
```

Win rate is deliberately absent from this shape, not a null field — it needs session-replay-from-persisted-facts, which doesn't exist for any game engine yet, and will be an additive field on a future plan rather than a breaking change to this one.

---

```

Then, in the `## Read Contracts` table, add a row after the last one:

```
| `GET /api/players/me` | `v_player_profile` | `PlayerProfileResponse` | 2026-08-15 |
```

to:

```
| `GET /api/players/me` | `v_player_profile` | `PlayerProfileResponse` | 2026-08-15 |
| `GET /api/statistics/overview` | `v_session_overview` + `v_player_visit_facts` + `v_player_leg_facts` + `v_double_out_checkout_darts` | `StatisticsOverviewResponse` | 2026-09-06 |
```

And change the "Deferred (post-v1)" line immediately below that table:

```
**Deferred (post-v1):** `GET /api/statistics/overview`, `GET /api/statistics/trends`, `GET /api/statistics/checkouts`. Statistics endpoints do not ship in v1; when built they must each be backed by a dedicated `v_*` view (e.g. `v_statistics_overview`) per the view-backed-reads rule. v1 stores all dart/turn/session facts these derive from. <!-- 2026-07-12 -->
```

to:

```
**Deferred (post-v1):** `GET /api/statistics/trends`, `GET /api/statistics/checkouts`. `GET /api/statistics/overview` shipped 2026-09-06 (see the Statistics Overview section above); the remaining two must each be view-backed when built per the view-backed-reads rule. <!-- 2026-07-12; overview shipped 2026-09-06 -->
```

Finally, add `StatisticsOverviewResponseData` to the Response DTOs closing paragraph — change:

```
`GET`/`PATCH /api/players/me/settings` return `PlayerSettingsResponse` (defined under Player Settings).
```

to:

```
`GET`/`PATCH /api/players/me/settings` return `PlayerSettingsResponse` (defined under Player Settings). `GET /api/statistics/overview` returns `StatisticsOverviewResponse` (defined under Statistics Overview).
```

- [ ] **Step 4: Update `00-File-Inventory.md`**

In `docs/architecture/00-File-Inventory.md`, change:

```
| `06-API/00-Overview.md` | Frozen v1 API baseline: runtime, routes, auth, envelopes; `/api/auth/*` same-origin proxy (D172, 2026-07-29); `/api/players/me/settings` routed (D195, 2026-08-08) | canonical | ~2.8k |
```

to:

```
| `06-API/00-Overview.md` | Frozen v1 API baseline: runtime, routes, auth, envelopes; `/api/auth/*` same-origin proxy (D172, 2026-07-29); `/api/players/me/settings` routed (D195, 2026-08-08); `GET /api/statistics/overview` routed (2026-09-06) | canonical | ~2.8k |
```

and change:

```
| `06-API/04-Endpoint-Contracts.md` | Per-domain endpoint contracts (2026-07-22); Player Settings `GET`/`PATCH /api/players/me/settings` incl. the uncapable-pair `VALIDATION_FAILED` case (D195, 2026-08-08); `POST /sessions`' `SEAT_CAPS` table (2026-08-22) | canonical | ~5.7k |
```

to:

```
| `06-API/04-Endpoint-Contracts.md` | Per-domain endpoint contracts (2026-07-22); Player Settings `GET`/`PATCH /api/players/me/settings` incl. the uncapable-pair `VALIDATION_FAILED` case (D195, 2026-08-08); `POST /sessions`' `SEAT_CAPS` table (2026-08-22); Statistics Overview contract (2026-09-06) | canonical | ~5.7k |
```

Recompute both `~Nk` figures with `wc -c <file> | awk '{print $1/4/1000}'`, rounded to one decimal, before committing — the values above are unchanged estimates and may need bumping given the added content.

- [ ] **Step 5: Append the decision**

Append to `decisions/api.md` (append-only — never edit an existing block). `D258` is the next id: the highest existing id across `decisions/*.md` is `D257` (verify with `grep -rhoE '^### D[0-9]+' decisions/*.md | sed 's/### D//' | sort -n | tail -1` immediately before committing, in case another decision landed first):

```markdown
### D258 — `GET /api/statistics/overview` composes 4 views in the service layer, not one dedicated aggregate view
Status: Accepted · Date: 2026-09-06
Decision: The endpoint D63 reserved is implemented reading `v_session_overview`, `v_player_visit_facts`, `v_player_leg_facts`, and `v_double_out_checkout_darts` through `repositories/statistics.repository.ts`, with all aggregation (streaks, score bands, averages, best leg, double accuracy) done in `services/statistics.service.ts` via five pure modules under `modules/stats/`/`modules/game/`, rather than a single `v_statistics_overview` view doing the aggregation in SQL.
Reason: D257's `v_player_visit_facts`/`v_player_leg_facts` were already designed to expose row-level facts, not pre-aggregated numbers — the approximation (best-effort darts-thrown) and exclusion (doubles-excluded scoring average) logic is application judgment a view can't safely encode (`05-Views.md` forbids workflow decisions in views), and duplicating it into a new aggregate view would fork the same logic the pure modules already hold. `00-Overview.md`'s original D63 note suggested "e.g. `v_statistics_overview`" as an example, not a requirement — "view-backed" is satisfied by reading existing views, not by inventing one new view per endpoint.
Consequences: Every response field's correctness depends on the pure modules' own tests, not a SQL assertion — `database/verification/` gains no new script for this endpoint. Win-rate is excluded from the response shape entirely, pending a separate session-replay design. If this composition is ever measured slow, `05-Views.md`'s own performance order applies (query structure, then indexes, then materialization) before reaching for a dedicated aggregate view.
Supersedes: none.
```

- [ ] **Step 6: Append the Context-Map-History entries**

In `docs/architecture/00-Context-Map-History.md`, immediately after the `# Version History` heading, prepend a new entry. Verify the current highest version with `grep -m1 '\*\*Version:\*\*' docs/architecture/00-Context-Map-History.md` immediately before committing (Task 1 did not bump it, so this should still be `1.51.0`, making this entry `1.52.0`):

```
> **Version:** 1.52.0 (2026-09-06 — statistics-overview-api: routed `GET /api/statistics/overview`, filling the slot D63 reserved. Hand-added `vDoubleOutCheckoutDarts`/`vPlayerVisitFacts`/`vPlayerLegFacts` to `schema.ts` (never introspected — no live database in this container). Built the five pure stat modules the general-statistics-views design specified but never implemented (`career-summary`, `visit-stats`, `leg-stats`, `highest-checkout`, `scoring-average`), plus `statistics.repository.ts` and `statistics.service.ts`. Win-rate remains excluded from the response shape entirely (D258).
```

And in the `# Task Records` table, add two rows:

```
| `docs/superpowers/specs/2026-09-06-statistics-overview-api-design.md` | Statistics overview API design: `GET /api/statistics/overview` composing the 4 general-statistics views through 5 pure modules never built by the earlier (SQL-only) general-views plan; win-rate excluded, doubleAccuracy/highestCheckout included as nullable fields that widen automatically once the other in-flight branch extends `v_double_out_checkout_darts` (2026-09-06) | historical |
| `docs/superpowers/plans/2026-09-06-statistics-overview-api.md` | The 10-task plan implementing that design: hand-added schema.ts views (Task 1), 5 pure stat modules (Tasks 2-6), repository (Task 7), service (Task 8), controller (Task 9), docs/decision (Task 10) (2026-09-06) | historical |
```

- [ ] **Step 7: Run the context-maintenance skill**

Invoke the `context-maintenance` skill and follow its procedure (CLAUDE.md sync, gate scripts, findings check).

- [ ] **Step 8: Run the run-all-gates skill**

Invoke the `run-all-gates` skill for the touched areas (`app/`, `docs/`).

- [ ] **Step 9: Final full validation**

```bash
cd app
npm run validate:app
npm run format:check
cd ..
bash scripts/check-context-map.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-budget.sh
```

Expected: every command exits 0; `validate:app`'s type gate reports 0 errors/0 warnings/0 hints.

- [ ] **Step 10: Commit**

```bash
git add docs/architecture/06-API/00-Overview.md \
  docs/architecture/06-API/02-Middleware-And-Layering.md \
  docs/architecture/06-API/04-Endpoint-Contracts.md \
  docs/architecture/00-File-Inventory.md \
  decisions/api.md docs/architecture/00-Context-Map-History.md
git commit -m "$(cat <<'EOF'
Route GET /api/statistics/overview in the API docs; append decision

00-Overview.md/02/04 updated with the shipped contract; decision
appended to decisions/api.md explaining the 4-views-composed-in-
service-layer choice over a single dedicated aggregate view.
EOF
)"
```

---

## Rollout order

Tasks 1–10 in the order written: Task 1 (schema.ts) first since every later task depends on the three view objects it adds. Tasks 2–6 (the five pure modules) are independent of each other and of Task 1, but Task 6 depends on Task 3's `effectiveDartsForVisit` and both Tasks 5/6 touch `modules/game/types.ts`, so do them in order. Task 7 (repository) depends on Task 1 and on the row/result types from Tasks 2–4. Task 8 (service) depends on Task 7 and all five modules. Task 9 (controller) depends on Task 8. Task 10 (docs/decision/validation) last, once the endpoint actually exists to document.
