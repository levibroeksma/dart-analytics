# Statistics Phase 1b — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the app half of rollout phase 1 of the detailed statistics pages: the per-game session list, the `completion` / `volume` / `session-result` sections behind one generic section route, the section registry skeleton, capability tags, and the IndexedDB client cache. The Games tab renders them in place of "coming soon".

**Architecture:** Phase 1a's migration `0043` is on `main` and applied to production: `v_stats_session_facts` (one row per terminal game session, owner-scoped, with rule-free turn/dart/score counts and a derived `context_key`), `v_stats_dart_facts` (no consumer until phase 2), the date-range index, and their `schema.ts` declarations. This plan adds no migration. The three sections are `sql` site: the repository runs `date_trunc` bucket aggregates over the session view, and a pure module per section shapes rows into the `Series` contract. A registry maps section id → metadata + handler; one route dispatches through it. The client reads through an IndexedDB cache that never refetches a closed bucket.

**Tech Stack:** TypeScript, Astro, Alpine, Vitest, Drizzle ORM, PostgreSQL (Neon), zod, IndexedDB (`fake-indexeddb` in tests).

**Spec:** `docs/architecture/10-Statistics/00-Overview.md`, `01-Section-Catalog.md` (canonical); brainstorm record `docs/superpowers/specs/2026-09-26-statistics-pages-architecture-design.md`; phase 1a plan `2026-09-26-statistics-phase-1a-database.md` (the views this plan reads).

**Prerequisite:** Phase 1a is merged to `main`, and the `deploy` workflow run for its merge commit is green (`rehearse`, `migrate`, `deploy`). So `0043` is applied in production and `schema.ts` on `main` declares `vStatsSessionFacts` and `vStatsDartFacts`. Check both before Task 1: the run's status in GitHub Actions, and `grep -n "vStatsSessionFacts\|vStatsDartFacts" app/src/db/schema.ts`. If a column name in `schema.ts` differs from what this plan says, follow `schema.ts` and note it in the PR body.

## Plan-level decisions (resolve gaps the architecture left open)

Each is written into the canonical docs in Task 11 under decision **D367** (confirm the id with `bash scripts/next-decision-id.sh`).

1. **Route segment is the game type key.** `00-Overview.md` §6 says `:rulesetKey`; a game page spans ruleset versions (Singles V1–V3), so the segment is `:gameTypeKey` (`game_types.implementation_key`: `501`, `TUOD`, `ONE_TWENTY_ONE`, `SCORE_TRAINING`, `SINGLES_TRAINING`, `DOUBLES_TRAINING`, `BOBS27`, `SHANGHAI`, `AROUND_THE_CLOCK`). Versions stay separated through `configSensitive`.
2. **Bucketed requests are widened to whole buckets.** For `bucket ≠ none` the server floors `from` to the start of its bucket in `tz` and echoes the range it used as `range: { from, to }`. A bucket is `closed` iff `bucketEnd ≤ min(to, now)`. So the client never caches a partial bucket as closed, and needs no timezone arithmetic.
3. **`session-result` is rule-free in phase 1.** No per-session outcome is stored (`04-Runtime-Layer.md`). The view exposes `counted_score = SUM(turns.total_score)`, `turn_count`, `dart_count`, `duration_seconds` for the owner participant. Per bucket the section returns sums plus `min`/`max` counted score (both re-aggregate exactly). Which extreme is the personal best is declared per game in the registry (`resultDirection`), and the client picks it. A game whose headline result is not a pure function of these components gets `resultDirection: null`. Filing a `discovered-work` issue for it is owed in its own phase.
4. **Session list orders by `(completed_at DESC, session_id DESC)`.** It is range-filtered on `completed_at`, so the opaque cursor encodes both. This is a documented per-endpoint ordering key; `03-Shared-Conventions.md` §Pagination already treats the cursor as server-owned.
5. **Status default per section.** A section with `includesAbandoned = true` (`completion`) accepts only `status=all`, which is its default. Every other section accepts only `completed`, its default. The session list defaults to `all` (`00-Overview.md` §6). Anything else → `VALIDATION_FAILED`.
6. **`dataVersion`** = base64url of `v1:<count>:<max completed_at epoch ms>` over the player's terminal sessions of that game type (all statuses, all time). This is one index-backed query per request.
7. **Singles Training is `intent-derived`, not `intent-stored`.** `00-Overview.md` §3 lists it as stored. Its engine writes both intent columns `NULL` by design (`singles-training.engine.module.ts` `record` JSDoc): every ring on the current number is a valid aim, and `chk_dart_target_consistency` (`0007`) rejects a number without a zone. The aimed number comes from the visit index, like Shanghai and Around the Clock, so Singles joins the phase 4 derived-intent family.

## Global Constraints

- TDD: write the failing test, run it, watch it fail, then implement. No implementation before a red test (`app/CLAUDE.md` §Test-Driven Development).
- `cd app && npm test` runs the whole suite. Always finish a task with the full suite, never one file only.
- No migration in this plan. Never modify an applied migration (`0001`–`0043`). If a view turns out to need a change, stop: that is a new migration on its own 1a-style branch, not part of this one.
- `app/src/db/schema.ts` is generated and already carries the views. Never hand-edit it.
- Reads go through views. No repository selects a raw runtime table.
- Statistics are never persisted. The views compute, nothing stores.
- IDs are UUIDv7, app-generated. This phase writes no rows.
- Comments: JSDoc only; no inline comments inside function bodies (`check-no-inline-comments.sh`).
- Exported types live in type barrels (`lib/stats/types.ts`, `modules/types.ts`, `services/types.ts`, `lib/client/api/types.ts`), never inline in a module (`check-type-barrels.sh`).
- `x-init` is forbidden; stores hydrate in `init()`.
- `npm run format` before every commit; `npm run format:check` clean.
- Branch: `feat/statistics-foundation`, cut from `main` after the Prerequisite holds. Never stacked on the 1a branch: the point of the split is that 1b starts from the deployed `main`.
- Anything noticed that this plan does not ask for → GitHub issue via `capturing-discovered-work`, never fixed in the same pass.

## File map

| Action | Path | Responsibility |
| ------ | ---- | -------------- |
| Modify | `app/src/lib/game/rulesets/capabilities.ts` | `STATS_TAGS`, `GAME_TYPE_BY_RULESET` |
| Modify | `app/src/lib/game/rulesets/types.ts` | `GameTypeKey`, `StatsTag` |
| Create | `app/src/lib/stats/section-registry.ts` | registry of phase-1 sections, `resultDirection` per game |
| Modify | `app/src/lib/stats/types.ts` | `SectionId`, `SectionMeta`, `Series`, query types |
| Modify | `app/src/pages/api/statistics/types.ts` | zod: query, session list, section responses |
| Modify | `app/src/repositories/statistics.repository.ts` | session list page, data version, three bucket aggregates |
| Modify | `app/src/modules/types.ts` | row types |
| Create | `app/src/modules/stats/sections/series.module.ts` | shared: `closed` flag, cursor codec, data-version codec |
| Create | `app/src/modules/stats/sections/{completion,volume,session-result}.module.ts` | row → metrics |
| Modify | `app/src/services/statistics.service.ts`, `services/types.ts` | `listGameSessions`, `getGameSection` |
| Create | `app/src/pages/api/statistics/games/[gameTypeKey]/sessions.ts` | list route |
| Create | `app/src/pages/api/statistics/games/[gameTypeKey]/sections/[sectionId].ts` | generic section route |
| Create | `app/src/lib/client/stats-cache/{db,keys,cache}.ts` | IndexedDB wrapper + fetch rule |
| Modify | `app/src/lib/client/api/statistics.ts`, `api/types.ts` | `fetchGameSessions`, `fetchGameSection` |
| Create | `app/src/stores/game-stats.store.ts` | page state, reads through the cache |
| Modify | `app/src/stores/auth.store.ts` | wipe cache on sign-out |
| Modify | `app/src/pages/statistics/index.astro` | render the sections + session list |
| Tests | mirror each path under `app/tests/` | |
| Docs | Task 11 list | |

---

### Task 1: Capability tags and game-type map

**Files:**
- Modify: `app/src/lib/game/rulesets/types.ts`, `app/src/lib/game/rulesets/capabilities.ts`
- Test: `app/tests/lib/game/rulesets/stats-tags.test.ts`

**Interfaces:**
- Produces: `type GameTypeKey`, `type StatsTag`, `STATS_TAGS: Readonly<Record<RulesetVersionKey, readonly StatsTag[]>>`, `GAME_TYPE_BY_RULESET: Readonly<Record<RulesetVersionKey, GameTypeKey>>`, `rulesetsOfGameType(key: GameTypeKey): RulesetVersionKey[]`, `isGameTypeKey(value: string): value is GameTypeKey`.

- [ ] **Step 1: Check first.** `grep -rn "GameTypeKey" app/src/lib` for an existing union. Reuse it if present; otherwise add it to `lib/game/rulesets/types.ts` (re-exported through the barrel it already feeds).

- [ ] **Step 2: Failing test.**

```ts
import { describe, it, expect } from "vitest";
import {
  GAME_TYPE_BY_RULESET,
  RULESET_CAPABILITIES,
  STATS_TAGS,
  isGameTypeKey,
  rulesetsOfGameType,
} from "@lib/game/rulesets/capabilities";

describe("statistics capability tags", () => {
  it("tags and maps every ruleset that declares a mode", () => {
    const keys = Object.keys(RULESET_CAPABILITIES).sort();
    expect(Object.keys(STATS_TAGS).sort()).toEqual(keys);
    expect(Object.keys(GAME_TYPE_BY_RULESET).sort()).toEqual(keys);
  });

  it("gives every VISUAL_BOARD ruleset the board tag", () => {
    for (const tags of Object.values(STATS_TAGS)) expect(tags).toContain("board");
  });

  it("stores intent only for Doubles Training and Bob's 27", () => {
    const stored = Object.entries(STATS_TAGS)
      .filter(([, tags]) => tags.includes("intent-stored"))
      .map(([key]) => key)
      .sort();
    expect(stored).toEqual(
      ["BOBS27_V1", "DOUBLES_TRAINING_V1"].sort(),
    );
  });

  it("groups ruleset versions under their game type", () => {
    expect(rulesetsOfGameType("SINGLES_TRAINING").sort()).toEqual(
      ["SINGLES_V1", "SINGLES_V2", "SINGLES_V3"],
    );
    expect(isGameTypeKey("ONE_TWENTY_ONE")).toBe(true);
    expect(isGameTypeKey("121_V1")).toBe(false);
  });
});
```

Run `cd app && npx vitest run tests/lib/game/rulesets/stats-tags.test.ts`. It should fail because the exports are missing.

- [ ] **Step 3: Implement** in `capabilities.ts`, one entry per ruleset in `RULESET_CAPABILITIES`. Tags follow `10-Statistics/00-Overview.md` §3:

| Ruleset versions | Game type | Tags |
| ---------------- | --------- | ---- |
| `501_V1` | `501` | board, scoring, checkout, leg |
| `SCORE_TRAINING_V1` | `SCORE_TRAINING` | board, scoring |
| `TUOD_V1` | `TUOD` | board, checkout, ladder |
| `121_V1`, `121_V2` | `ONE_TWENTY_ONE` | board, checkout, ladder |
| `SINGLES_V1..V3` | `SINGLES_TRAINING` | board, intent-derived, target-sequence (decision 7) |
| `DOUBLES_TRAINING_V1` | `DOUBLES_TRAINING` | board, intent-stored, target-sequence |
| `BOBS27_V1` | `BOBS27` | board, intent-stored, target-sequence |
| `SHANGHAI_V1`, `SHANGHAI_V2` | `SHANGHAI` | board, intent-derived, target-sequence |
| `AROUND_THE_CLOCK_V1`, `_V2` | `AROUND_THE_CLOCK` | board, intent-derived, target-sequence |

Add a JSDoc on `STATS_TAGS` pointing to `00-Overview.md` §3. The map says which facts a ruleset produces; a section is offered where its `requires` ⊆ the game's tags.

- [ ] **Step 4:** Test green, then run the full suite. Commit: `feat(stats): capability tags and game-type map`

---

### Task 2: Registry skeleton and shared types

**Files:**
- Modify: `app/src/lib/stats/types.ts`
- Create: `app/src/lib/stats/section-registry.ts`
- Test: `app/tests/lib/stats/section-registry.test.ts`

**Interfaces:**
- Produces (types): `SectionId = "completion" | "volume" | "session-result"`, `ComputeSite`, `Bucket = "none" | "day" | "week" | "month" | "year"`, `StatusFilter`, `ContextFilter`, `SectionMeta { id; version; requires: readonly StatsTag[]; computeSite; bucketable; includesAbandoned; configSensitive: readonly string[] }`, `Series<M>` (`00-Overview.md` §5.2 plus `range: { from: string; to: string }`), `ResultDirection = "higher" | "lower" | null`.
- Produces (values): `SECTIONS: Readonly<Record<SectionId, SectionMeta>>`, `sectionsForGame(gameTypeKey): SectionMeta[]` (in page order), `isSectionId(value): value is SectionId`, `RESULT_DIRECTION: Readonly<Record<GameTypeKey, ResultDirection>>`.

The registry lives in `lib/` (isomorphic, imported by both service and client). Handlers are **not** in it: the service owns the id → handler map (Task 6), so no DB code reaches the client bundle.

- [ ] **Step 1: Failing test.** Cover these points:
  - Every `SECTIONS` key equals its `id`.
  - All three are `computeSite: "sql"` and `bucketable: true`.
  - Only `completion` has `includesAbandoned: true`.
  - `session-result` declares `configSensitive: ["ruleset_version_key"]`.
  - `sectionsForGame("501")` returns `["session-result", "completion", "volume"]` in that order (catalog order: session-result, completion, volume).
  - `isSectionId("heatmap")` is `false` in phase 1.
  - `RESULT_DIRECTION` has a key for every game type.

- [ ] **Step 2: Implement.** Set `version: 1` everywhere and `requires: []`, since the "any" tier needs no tag. For `RESULT_DIRECTION`, derive each game's value by reading its engine, and record the reasoning in a JSDoc table:
  - What does `turns.total_score` store for the game?
  - Is a higher or lower session `counted_score` better?
  - Is the headline result a pure function of `counted_score` / `dart_count` / `turn_count`?

  Where the answer is "no" or unclear, use `null`. The UI then shows sums without a PB line, and a `discovered-work` issue is filed naming the game and what its headline needs. Expected starting points to verify, not assume: 501 → `null` (the headline is darts per leg or average, not the counted sum), Score Training → `higher`, Bob's 27 → verify whether the session total is `27 + counted_score`.

- [ ] **Step 3:** Green, full suite. Commit: `feat(stats): section registry skeleton`

---

### Task 3: Query contract (zod)

**Files:**
- Modify: `app/src/pages/api/statistics/types.ts`
- Test: `app/tests/pages/api/statistics/types.test.ts` (existing; extend)

**Interfaces:**
- Produces:
  - `StatisticsRangeQuery` (zod): `from`, `to` as ISO datetimes with an offset, required, `from < to`; `tz` as an optional IANA zone, valid iff `new Intl.DateTimeFormat("en-US", { timeZone })` does not throw; `bucket` (default `none`), required `tz` when `bucket ≠ none`; `status` optional; `context` (default `all`); `inputMode` literal `VISUAL_BOARD` (default).
  - `SessionListQuery` = range + `limit` (1–100, default 25) + `cursor` (optional string).
  - `MAX_BUCKETS = 120`.
  - Response schemas: `GameSessionListResponse`, `CompletionSeriesResponse`, `VolumeSeriesResponse`, `SessionResultSeriesResponse`, with inferred types exported.

- [ ] **Step 1: Failing tests.** Accepted cases:
  - A valid month query.
  - A `bucket=none` query without `tz`.

  Rejected cases:
  - Missing `from`.
  - `from ≥ to`.
  - `tz=Mars/Base`.
  - `bucket=month` with no `tz`.
  - `inputMode=QUICK_SCORE`.
  - `limit=0`.

  Bucket-count cap: `bucket=day` over 200 days is rejected with a `reason` naming the cap; `bucket=month` over 10 years is accepted. The estimate is span ÷ nominal unit length (day 86 400 s, week ×7, month 31 days, year 366 days), rounded up, plus 1 for widening.

- [ ] **Step 2: Implement.** Metric shapes (all additive, `00-Overview.md` §5.1):

```ts
const BucketBase = z.object({
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true }),
  closed: z.boolean(),
  sampleSize: z.number().int(),
});
const CompletionMetrics = z.object({
  completed: z.number().int(),
  abandoned: z.number().int(),
  neverStarted: z.number().int(),
  abandonedTurns: z.number().int(),
});
const ContextSplit = z.object({ standalone: z.number().int(), routine: z.number().int() });
const VolumeMetrics = z.object({
  sessions: ContextSplit,
  darts: ContextSplit,
  durationSeconds: ContextSplit,
});
const SessionResultMetrics = z.record(
  z.string(),
  z.object({
    sessions: z.number().int(),
    countedScoreSum: z.number().int(),
    dartSum: z.number().int(),
    turnSum: z.number().int(),
    countedScoreMin: z.number().int(),
    countedScoreMax: z.number().int(),
    bestLowSessionId: z.string().uuid(),
    bestHighSessionId: z.string().uuid(),
  }),
);
```

- `SessionResultMetrics` is keyed by `ruleset_version_key` (`configSensitive`).
- `neverStarted` counts abandoned sessions with `turn_count = 0`; `abandoned` counts only those with turns, so the three counts partition the population.
- `abandonedTurns` is the turn sum over mid-game quits. Mean turns-at-quit = `abandonedTurns / abandoned`, which is additive.
- A `Series` wrapper adds `sectionId`, `sectionVersion`, `dataVersion`, `bucket`, `tz` (nullable when `bucket = none`) and `range`.
- A list item carries these fields: `sessionId`, `rulesetVersionKey`, `statusKey`, `contextKey`, `neverStarted`, `startedAt`, `completedAt`, `durationSeconds`, `turnCount`, `dartCount`, `countedScore`.
- The list response is `{ items, nextCursor, dataVersion }`.

- [ ] **Step 3:** Green, full suite. Commit: `feat(api): statistics query and response contracts`

---

### Task 4: Repository readers

**Files:**
- Modify: `app/src/repositories/statistics.repository.ts`, `app/src/modules/types.ts`
- Test: `app/tests/repositories/statistics.repository.test.ts` (extend; use `render-sql.ts` to assert generated SQL)

**Interfaces** (`Db` as today; every function reads `vStatsSessionFacts` only and filters `player_id`, `game_type_key` and `completed_at` in `[from, to)`):
- `findGameSessionsPage(db, q: { playerId; gameTypeKey; from; to; statuses: string[]; context: ContextFilter; limit; after?: { completedAt: string; sessionId: string } }): Promise<StatsSessionRow[]>`: orders `completed_at DESC, session_id DESC`, fetches `limit + 1`, and applies `(completed_at, session_id) < (after…)` when `after` is set.
- `findGameDataVersion(db, playerId, gameTypeKey): Promise<{ count: number; maxCompletedAt: string | null }>`.
- `findBucketedSessionAggregates(db, q: { playerId; gameTypeKey; from; to; bucket; tz; statuses; context }): Promise<StatsBucketRow[]>`: one query that serves all three sections. It groups by the bucket plus `status_key`, `context_key`, `ruleset_version_key`, `(turn_count = 0)` and returns these columns:
  - `bucket_start`, `bucket_end` (timestamptz)
  - `status_key`, `context_key`, `ruleset_version_key`, `never_started`
  - `sessions`, `turn_sum`, `dart_sum`, `duration_sum`, `score_sum`, `score_min`, `score_max`
  - `min_session_id`, `max_session_id`: the session id with the min and max score in its group (`(array_agg(session_id ORDER BY counted_score ASC, completed_at ASC))[1]` and the DESC twin).

  One shared query keeps it one index scan per request. Each section module projects what it needs.

- [ ] **Step 1: Failing tests.**
  - Each reader selects from `vStatsSessionFacts`.
  - Rendered SQL for a `bucket=month, tz=Europe/Amsterdam` call contains `date_trunc('month', … AT TIME ZONE $n)`, and the widening floor on `from` described below.
  - `context=routine` adds `context_key = 'ROUTINE'`.
  - `bucket=none` groups with no bucket expression and returns `bucket_start = from`, `bucket_end = to`.
  - `nonNull` throws on a null `status_key`.
  - `count` parses from string.

- [ ] **Step 2: Implement** with Drizzle `sql` fragments. Bucket expressions, with `unit` taken from a whitelist map (never interpolate user text) and `tz` passed as a bound parameter:

```ts
const start = sql`(date_trunc(${sql.raw(`'${unit}'`)}, ${vStatsSessionFacts.completedAt} AT TIME ZONE ${tz}) AT TIME ZONE ${tz})`;
const end = sql`((date_trunc(${sql.raw(`'${unit}'`)}, ${vStatsSessionFacts.completedAt} AT TIME ZONE ${tz}) + ${sql.raw(`interval '1 ${unit}'`)}) AT TIME ZONE ${tz})`;
```

Widening (decision 2): the lower bound is `completed_at >= (date_trunc(unit, $from::timestamptz AT TIME ZONE $tz) AT TIME ZONE $tz)`. The service computes the same expression once through `findBucketFloor(db, from, unit, tz): Promise<string>` (`SELECT … AS floor`, no table), so the echoed `range.from` equals what the query used. Add it to this task.

The numeric columns come back as strings, so every count and sum is mapped through `Number(nonNull(…))`.

- [ ] **Step 3:** Green, full suite. Commit: `feat(stats): statistics repository readers`

---

### Task 5: Section modules (pure)

**Files:**
- Create: `app/src/modules/stats/sections/series.module.ts`, `completion.module.ts`, `volume.module.ts`, `session-result.module.ts`
- Tests: `app/tests/modules/stats/sections/*.module.test.ts`

**Interfaces:**
- `series.module.ts`:
  - `isClosed(bucketEnd: string, to: string, now: Date): boolean` returns `end ≤ min(to, now)`.
  - `encodeCursor({ completedAt, sessionId }): string` / `decodeCursor(s): {…} | null` use base64url JSON. Decode returns null on any malformed input.
  - `encodeDataVersion({ count, maxCompletedAt }): string`.
- `completion.module.ts`: `completionBuckets(rows: StatsBucketRow[], ctx: { to; now }): Bucket<CompletionMetrics>[]`.
- `volume.module.ts`: `volumeBuckets(rows, ctx): Bucket<VolumeMetrics>[]`.
- `session-result.module.ts`: `sessionResultBuckets(rows, ctx): Bucket<SessionResultMetrics>[]`. Merging groups takes min/max across groups and keeps the matching session id. It never averages.

Each module folds rows by `bucket_start` in ascending order. `sampleSize` = total sessions in the bucket. Empty buckets are not emitted: a closed bucket absent from a response is known-empty for its range (the cache relies on this, Task 8).

- [ ] **Step 1: Failing tests**, one file per module:
  - Completion partitions `COMPLETED` / mid-quit / never-started from mixed rows.
  - Volume splits by context.
  - Session-result keys by version and picks the correct min/max ids across two groups.
  - `isClosed` covers the edges: end = now, end = to, and end after `to`.
  - The cursor round-trips, and `decodeCursor("%%%")` returns `null`.
  - The data version is stable for equal input and changes when the count changes.

- [ ] **Step 2: Implement.** These are pure functions: no I/O, no `Date.now()` (`now` is injected), isomorphic, so they can move to the `client` site later without a rewrite.

- [ ] **Step 3:** Green, full suite. Commit: `feat(stats): completion, volume and session-result section modules`

---

### Task 6: Service

**Files:**
- Modify: `app/src/services/statistics.service.ts`, `app/src/services/types.ts`
- Test: `app/tests/services/statistics.service.test.ts` (extend; mock the repository as the existing tests do)

**Interfaces:**
- `listGameSessions(playerId, gameTypeKey: GameTypeKey, q: SessionListQueryData): Promise<ServiceResult<GameSessionList>>`
- `getGameSection(playerId, gameTypeKey, sectionId: SectionId, q: StatisticsRangeQueryData, now?: Date): Promise<ServiceResult<SeriesResponse>>`

Behaviour:
- **Status resolution (decision 5).** `includesAbandoned` sections default to `["COMPLETED","ABANDONED"]` and accept only `all`. Other sections default to `["COMPLETED"]` and accept only `completed`. The list defaults to both and accepts all three values. A mismatch returns `{ ok: false, code: "VALIDATION_FAILED", details: { reason } }`.
- `bucket ≠ none` on a non-`bucketable` section → `VALIDATION_FAILED`. None exist in phase 1; the check is still tested with a stub meta.
- A section not in `sectionsForGame(gameTypeKey)` → `NOT_FOUND`.
- A bad cursor → `VALIDATION_FAILED`.
- The handler map is `const HANDLERS: Record<SectionId, (rows, ctx) => Bucket<unknown>[]>`. The service runs `findGameDataVersion` and `findBucketedSessionAggregates` in parallel after `findBucketFloor`.

- [ ] **Step 1: Failing tests** for each behaviour above, plus the happy path per section and pagination:
  - `limit + 1` rows → `nextCursor` is set and `items.length === limit`.
  - Exactly `limit` rows → `nextCursor: null`.

- [ ] **Step 2: Implement.** Green, full suite. Commit: `feat(stats): game session list and section dispatcher`

---

### Task 7: Routes

**Files:**
- Create: `app/src/pages/api/statistics/games/[gameTypeKey]/sessions.ts`, `app/src/pages/api/statistics/games/[gameTypeKey]/sections/[sectionId].ts`
- Tests: `app/tests/pages/api/statistics/games-sessions.test.ts`, `games-sections.test.ts` (pattern: `overview.test.ts`)

- [ ] **Step 1: Failing tests** per route:
  - An unknown `gameTypeKey` → 404 `NOT_FOUND`.
  - An unknown `sectionId` → 404.
  - Missing `from` → 400 `VALIDATION_FAILED`.
  - The happy path calls the service with the parsed query and `auth.playerId`, and returns `ok(...)`.
  - The response body parses against its zod response schema.
  - The route is protected. Confirm from `middleware.ts` that `/api/statistics/*` is behind auth (it already serves `overview`), and add a test only if the middleware test file covers per-prefix cases.

- [ ] **Step 2: Implement** following `training-sessions/completed.ts`: parse `url.searchParams` into the zod query, then `fail("VALIDATION_FAILED", requestId, { reason })` on error, validate params with `isGameTypeKey` / `isSectionId`, call the service, map `ServiceResult`. Set response header `Cache-Control: private, no-store`. The client cache, not HTTP, owns reuse.

- [ ] **Step 3:** Green, full suite, then `cd app && npm run validate:app`. Commit: `feat(api): statistics game sessions and section routes`

---

### Task 8: IndexedDB stats cache

**Files:**
- Create: `app/src/lib/client/stats-cache/db.ts`, `keys.ts`, `cache.ts` (types into `lib/client/api/types.ts` or a `stats-cache/types.ts` barrel; follow `check-type-barrels.sh`)
- Modify: `app/package.json`: devDependency `fake-indexeddb` (tests only)
- Tests: `app/tests/lib/client/stats-cache/*.test.ts` (`import "fake-indexeddb/auto"` at the top of each file)

**Interfaces:**
- `db.ts` exposes:
  - `openStatsDb(): Promise<IDBDatabase | null>`. It returns `null` when IndexedDB is missing or throws, which gives the network-only fallback.
  - `STATS_DB_NAME = "dart-stats"`, `STATS_SCHEMA_VERSION = 1`.
  - Object stores: `sectionResults`, `coverage`, `sessionLists`, `meta`.
  - A version upgrade deletes and recreates all stores (a schema bump wipes).
  - `replayPages` and `facts` are created in their own phases, each with a schema bump.
- `keys.ts` exposes `paramsKey(q)`: a stable string of `{ bucket, tz, status, context, inputMode }` (excludes `from`/`to`).
- `cache.ts` exposes:
  - `readSection(playerId, gameTypeKey, meta, q, fetcher, now)`: the fetch rule below.
  - `readSessionPage(playerId, gameTypeKey, q, fetcher)`: keyed by `(player, game, paramsKey, from, to, cursor)`; dropped when `dataVersion` changes.
  - `clearStatsCache(): Promise<void>`.

**Fetch rule (`readSection`, bucketed):**
1. Load `coverage[(player, section, version, paramsKey)]`, the contiguous closed span `[coveredFrom, coveredTo)` already stored.
2. Missing spans = the requested `[from, to)` minus the coverage. At most two: before and after.
3. Fetch only the missing spans; for the span after coverage, `from = coveredTo`. Store each returned **closed** bucket under `(player, section, version, paramsKey, bucketStart)`. Extend the coverage to the new contiguous closed span (from the response's `range.from` to the last closed bucket's `end`).
4. Open buckets are kept in memory only, and replaced on every fetch.
5. Assemble the result from the stored closed buckets in `[from, to)` plus the fresh open ones.
6. `bucket = none`: the whole result is stored under `(…, from, to)` together with its `dataVersion`. It is served from the cache only when the latest `dataVersion` for the game in `meta` matches. Every network response updates `meta.dataVersion[player:game]`.

Every IndexedDB call goes through one `safe<T>(fn, fallback)` helper, and any throw degrades to the fetcher.

- [ ] **Step 1: Failing tests.**
  - The first read fetches the whole range and stores the closed buckets.
  - A second identical read fetches only `[coveredTo, to)`.
  - Widening `from` earlier fetches only the earlier span.
  - A bumped section `version` misses the cache.
  - `bucket=none` is served from the cache on an equal `dataVersion` and refetched after it changes.
  - `openStatsDb` returning `null` makes `readSection` call the fetcher every time and still return data.
  - `clearStatsCache` empties all stores.
  - A schema version bump wipes the old data.

- [ ] **Step 2: Implement.** Raw IndexedDB with small promise wrappers; no runtime dependency.

- [ ] **Step 3:** Green, full suite. Commit: `feat(client): IndexedDB statistics cache`

---

### Task 9: Client API, store and page

**Files:**
- Modify: `app/src/lib/client/api/statistics.ts`, `app/src/lib/client/api/types.ts`
- Create: `app/src/stores/game-stats.store.ts`; register it where `stats` is registered (`grep -rn 'Alpine.store("stats"' app/src`)
- Modify: `app/src/pages/statistics/index.astro`
- Tests: `app/tests/lib/client/api/statistics.test.ts` (extend), `app/tests/stores/game-stats.store.test.ts`

**Interfaces:**
- `fetchGameSessions(gameTypeKey, q)` and `fetchGameSection(gameTypeKey, sectionId, q)` build the query string, call `apiRequest`, and throw `StatisticsApiError` on failure.
- The store has these fields:
  - `gameTypeKey`
  - `range`: default the last 12 months (`from` = now − 12 months, `to` = now + 1 minute), `bucket: "month"`, `tz` from `Intl.DateTimeFormat().resolvedOptions().timeZone`
  - `sections: Record<SectionId, SeriesView | null>`
  - `sessions: items[]`, `nextCursor`
  - `loading`, `error`
- Store methods:
  - `selectGame(rulesetVersionKey)` maps through `GAME_TYPE_BY_RULESET`, then reloads.
  - `load()` reads each `sectionsForGame` entry through `readSection`, plus the first session page.
  - `loadMoreSessions()`.
  - Derived getters take ratios client-side: abandon rate `= (abandoned + neverStarted) / sampleSize`, average counted score, and a PB line from `RESULT_DIRECTION`, shown only when it is non-null.

- [ ] **Step 1: Failing tests.**
  - The API builds `?from=…&to=…&bucket=month&tz=…`.
  - The store loads the three sections for `501` via a mocked cache.
  - `selectGame("SINGLES_V1")` resolves to `SINGLES_TRAINING`.
  - The abandon rate is `null` when `sampleSize` is 0.
  - `loadMoreSessions` appends and stops at `nextCursor: null`.

- [ ] **Step 2: Implement the store**, then the page. Replace the "coming soon" paragraph in the Games tab with:
  - A completion card: completed / abandoned / never started counts, abandon rate, and a month bar list.
  - A volume card: sessions, darts and play time, standalone vs routine.
  - A session-result card per ruleset version: sessions, average counted score, and the PB line when the direction is known.
  - A session list with a "Load more" button: date, status badge, context badge, turns, darts, score. Replay links arrive in phase 5.

  Reuse the existing components; for a new visual pattern, first read `07-Frontend/10-Frontend-Agent-Guide.md`. Wire `Select`'s `game` model to `$store.gameStats.selectGame(game)` via `x-effect`, or via the existing watch pattern if the page already has one; no `x-init`.

- [ ] **Step 3:** Full suite, `npm run validate:app`, then all the `app/` gate scripts from the `run-all-gates` skill (astro-class-composition, astro-conventions, style-tokens, …). Commit: `feat(stats): game statistics page sections and session list`

---

### Task 10: Wipe the cache on sign-out

**Files:**
- Modify: `app/src/stores/auth.store.ts` (`signOut`)
- Test: `app/tests/stores/auth.store.test.ts` (extend or create)

- [ ] **Step 1: Failing test.** `signOut` calls `clearStatsCache` before or alongside `authClient.signOut()`, and a rejected `clearStatsCache` never blocks the sign-out.
- [ ] **Step 2: Implement.** Green, full suite. Commit: `feat(stats): clear statistics cache on sign-out`

---

### Task 11: Docs, decision, gates

**Files:**
- `decisions/api.md`: **D367**, covering plan-level decisions 1–7 above. Get the id from `bash scripts/next-decision-id.sh`.
- `docs/architecture/10-Statistics/00-Overview.md`:
  - §5: the bucket-widening rule, the `range` echo, the `closed` definition, and the status default per section.
  - §6: `:gameTypeKey` in place of `:rulesetKey`, with rows marked **built**.
  - §12: phase 1 marked done.
  - §3: Singles moves from `intent-stored` to `intent-derived` (decision 7); §12 phase 2 drops Singles, phase 4 gains it.
  - Version bump 1.1.0, citing D367.
- `docs/architecture/10-Statistics/01-Section-Catalog.md`: §1.2 names Singles as derived (number only, any ring); the `session-result` row says "rule-free components; PB direction per game (`RESULT_DIRECTION`)"; status line updated for the three built sections.
- `docs/architecture/06-API/04-Endpoint-Contracts.md`: full contracts for the two routes (params, defaults, errors, response shapes).
- `docs/architecture/06-API/00-Overview.md`: the "Planned" list gets the two routes marked built.
- `docs/architecture/07-Frontend/*` handbook entry for the stats cache, if the handbook lists client modules. Check `00-File-Inventory.md` for the canonical file.
- Root `CLAUDE.md`: the "never modify applied migrations" range becomes `0001`–`0043`, citing the green 1a deploy run as the proof it is applied. `docs/CLAUDE.md` and `database/CLAUDE.md` already say `0043` (phase 1a); the views, index and §10 docs are 1a's too.

- [ ] **Step 1:** Make the doc edits: minimal diffs, canonical doc first.
- [ ] **Step 2:** Run the `context-maintenance` skill: the context map, the File Inventory rows and token claims, and a history entry.
- [ ] **Step 3:** Run the `run-all-gates` skill: the Always-run set, the `app/` set, `check-constraint-mirror.sh`, and `check-decision-ids.sh`. Report each result.
- [ ] **Step 4:** Commit `docs(stats): phase 1 contracts and D367`. Then run `superpowers:finishing-a-development-branch` with `finishing-a-dart-branch` (push + PR).

---

## Out of scope (later phases)

- The migration, verification script, `schema.ts` regeneration and database docs (phase 1a).
- Board and intent sections, the heatmap, and a `v_stats_dart_facts` reader (phase 2).
- Checkout folds (phase 3); derived intent and game-specific sections (phase 4).
- Replay and the `replayPages` store (phase 5); routine pages (phase 6).
- The `facts` store and `client`-site sections: none exist until a section needs them.
