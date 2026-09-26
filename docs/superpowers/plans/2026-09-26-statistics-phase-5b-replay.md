# Statistics Phase 5b — Game Replay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the app half of rollout phase 5 of the detailed statistics pages: a paginated, owner-scoped replay of one finished game session, served by `GET /api/statistics/sessions/:sessionId/replay` and shown on a `/statistics/replay` page. The game page's session list and personal-best line link to it.

**Architecture:**
- Phase 5a's migration is on `main` and applied to production: `v_game_replay` carries `participant_id`, `participant_type_key`, `location_x`, `location_y`, and `schema.ts` declares them. This plan adds no migration.
- Every page is gated by phase 1's `v_stats_session_facts`, which is owner-scoped and holds only terminal game sessions. The first page carries a header with the snapshot, `context_key`, `activity_id`, the participants and the stage tree.
- Pages hold whole turns in play order. The cursor encodes the last turn's `(stageId, turnSequence)`.
- Pages are immutable. The server sends them with `Cache-Control: immutable`, and the client keeps them forever in a new `replayPages` IndexedDB store.
- The client derives per-turn values (remaining score, active target, Bob's 27 running score) by rebuilding the ruleset's engine from the loaded facts through the play pages' existing rehydrate path. No game rule is added to the server.

**Tech Stack:** TypeScript, Astro, Alpine, Vitest, Drizzle ORM, PostgreSQL (Neon), zod, IndexedDB (`fake-indexeddb` in tests).

**Spec:** `docs/architecture/10-Statistics/02-Replay.md` and `00-Overview.md` §5–§7, §10 (canonical). Earlier plans own what this one extends:
- phase 1a (`2026-09-26-statistics-phase-1a-database.md`): `v_stats_session_facts`
- phase 5a (`2026-09-26-statistics-phase-5a-replay-database.md`): the widened `v_game_replay`
- phase 1b (`2026-09-26-statistics-phase-1b-foundation.md`): the cursor codec in `series.module.ts`, the stats cache (`db.ts`, `cache.ts`), `game-stats.store.ts`, the session list, `RESULT_DIRECTION`
- phase 3 (`2026-09-26-statistics-phase-3-checkout-sections.md`): `snapshotOf`
- phase 4 (`2026-09-26-statistics-phase-4-derived-intent-sections.md`): defers the per-session Bob's 27 curve to this phase

**Prerequisite:** Phases 1–4 and 5a are merged, and the `deploy` run for 5a's merge commit is green. Check `grep -n "locationX\|participantTypeKey" app/src/db/schema.ts` inside `vGameReplay` before Task 1. If a name differs from what this plan says, follow the code and note the difference in the PR body.

## Plan-level decisions

Each is written into the canonical docs in Task 8 under decision **D371** (confirm with `bash scripts/next-decision-id.sh`; D367–D370 belong to phases 1–4).

1. **Widen `v_game_replay`; no sibling view.**
   - No `app/` code reads the view. Its only other consumers are the verification script `0023_owner_scoped_dart_view_checks.sql`, which counts rows per participant, and the documented but unbuilt `ReplayEntry` contract. Neither is broken by appended columns.
   - `CREATE OR REPLACE VIEW` appends `participant_id`, `participant_type_key` (a join to `participant_types`), `location_x` and `location_y`. Existing columns keep their names, types and order, so no `DROP` is needed.
   - `context_key` is **not** added per row. It is a session fact, and the header reads it from `v_stats_session_facts`, which already derives it. Repeating it on every dart row would be a second derivation of the same fact. This refines `02-Replay.md` §3 and `00-Overview.md` §10.
   - The view stays unfiltered by participant (`0023`'s rule): a replay shows every seat, guests and DartBot included.
2. **One gate for every page.** `v_stats_session_facts` filtered by `player_id` and `session_id` must return a row. Otherwise the response is `NOT_FOUND`. This covers another player's session, an active session, a training (non-game) session and an unknown id, and none of them reveals whether the id exists. The gate runs on every page, not only the first, because a cursor is not a credential.
3. **Play order.**
   - Stages are ordered in pre-order: roots by `sequence_number`, each followed by its children in the same order, at any depth. `stageOrder(stages)` is a pure TS function, so there is no recursive SQL. Today every engine writes root stages only (`EXERCISE_BLOCK`, `LEG`, `ROUND`), but the schema allows nesting and replay must not assume otherwise.
   - Within a stage, turns are ordered by `turn_sequence`. The sequence is stage-wide across seats (`openOrCreateTurn` in `turn-log.module.ts`, and 501's `turnCountIn`), so it is a total order of play. Darts are ordered by `dart_number`.
4. **Pages count turns, not rows.**
   - `limit` defaults to 30 turns and is capped at 120. Out of range → `VALIDATION_FAILED`.
   - The page query ranks turns with `dense_rank() OVER (ORDER BY array_position($stageIds, stage_id), turn_sequence)` and keeps ranks `≤ limit + 1`. That is one query for whole turns, and the extra turn sets `nextCursor`. `$stageIds` is the ordered stage id array from decision 3, bounded by the session.
   - The cursor is base64url of `v1:<stageId>:<turnSequence>` and is decoded with phase 1's cursor codec pattern. It is valid only when its `stageId` belongs to the session. A cursor from another session → `VALIDATION_FAILED`.
5. **The header is on the first page only.** `ReplayHeader`:
   - from `v_stats_session_facts`: `sessionId`, `gameTypeKey`, `rulesetVersionKey`, `inputModeKey`, `statusKey`, `contextKey`, `activityId`, `routineStepSequenceNumber`, `configuration`, `startedAt`, `completedAt`, `durationSeconds`, `turnCount`, `dartCount`
   - `participants`: `{ participantId, displayName, participantTypeKey }[]`, distinct over the session's replay rows, ordered by first turn
   - `stages`: `{ stageId, parentStageId, stageTypeKey, sequence }[]` in play order

   `02-Replay.md` asks for an "outcome". None is stored (phase 1 decision 3), so the header carries the stored facts, and the client derives the outcome from the fold (decision 8).
6. **Other statistics parameters are rejected.** Only `cursor` and `limit` are accepted. `from`, `to`, `tz`, `bucket`, `status`, `context`, `inputMode` or any other parameter → `VALIDATION_FAILED`, following `00-Overview.md` §5's "never silently ignored" rule.
7. **Caching.**
   - Every successful page is sent with `Cache-Control: private, max-age=31536000, immutable`. The gate guarantees a terminal session, and completed gameplay is immutable. Errors keep `private, no-store`.
   - The client's `replayPages` store is keyed by `(sessionId, cursor ?? "")`. It holds no `dataVersion` and is never invalidated. It is wiped with the rest of the cache on sign-out and on a schema bump.
   - Adding the store bumps `STATS_SCHEMA_VERSION` by one from whatever phases 1–4 left. The bump wipes every store, which the phase 1 contract already accepts.
   - When corrections ship, the header gains `supersededBy` (`00-Overview.md` §11). That is out of scope here.
8. **The client derives per-turn values from the engine; the server never does.**
   - The snapshot is decoded with phase 3's `snapshotOf`. If it is still private to `x01-checkout-sessions.module.ts`, it moves to `modules/stats/snapshot.module.ts` and both callers import it. That extraction is required work, not discovered work.
   - The loaded pages map to `EngineFacts`. Stage `clientKey` = `stageId`. Turn `clientKey` = `stageId:turnSequence`. `participantRef` = `participantId`, which is what `composeSeatFacts` stores as the seat's `participantRef`.
   - The state after turn *k* is `getEngineFactory(rulesetVersionKey).create(config, factsUpTo(k)).state()`, the same rehydrate path `resumeGameEngine` uses. It is memoized per turn. The cost is quadratic in the session's turns but bounded by one session; Task 5 pins a ceiling.
   - Per-game **presenters** turn a state into what the page shows. Each presenter reads the state the same way that game's `*-play.data.ts` already does, and never re-derives a rule:

     | Game | Per turn | Session line |
     | ---- | -------- | ------------ |
     | 501 | remaining after the visit, bust flag | leg winner per leg |
     | 121, TUOD | target and remaining | final target |
     | Score Training | running total | total |
     | Singles, Doubles, Shanghai, ATC | active target, hit marks | final progress |
     | Bob's 27 | running score | the score curve per visit (phase 4 deferral) |

   - Derived values are shown only when **every** earlier turn is loaded. Pages load in order, so this is the normal case.
   - The fold is **skipped, never guessed**, and the page shows stored facts only with the note "Derived values unavailable for this session" when:
     - there is no snapshot, or it does not decode
     - no engine factory is registered for the ruleset
     - `create` throws
     - the snapshot has no `seats` and the session has more than one participant

     A seatless single-participant snapshot gets one seat synthesized from that participant, as phase 4's walker does.
9. **Page URL: `/statistics/replay?session=<id>`.** It is a prerendered shell (`07-Frontend/01-Rendering-Strategy.md`, D97) that reads the id client-side, following the `?routine=` precedent (`lib/training/routines/routine-route.ts`). A dynamic segment would force on-demand rendering for no gain, because the shell carries no data.
10. **Scope: every terminal game session in any input mode.**
    - A turn-total-only turn (recreational quick score) replays at turn resolution: `turnTotalScore` and no darts, which is `v_game_replay`'s existing `LEFT JOIN` behaviour.
    - Training (non-game) sessions are absent from `v_stats_session_facts`, so they return `NOT_FOUND`. Routine replay belongs to phase 6.
11. **The frozen `GET /api/sessions/:sessionId/replay` stays untouched.** It is documented (`04-Endpoint-Contracts.md`, `ReplayEntry[]`) but was never built, and the route surface is frozen (`06-API/00-Overview.md`). This phase neither builds it nor drops it. Task 8 files a `discovered-work` issue so the owner can choose between retiring it (a D321-style drop) and pointing it at the same service.
12. **Links from the game page.**
    - Every session-list row links to its replay.
    - The session-result PB line links to the session id that phase 1 already returns with `min`/`max`.
    - A phase 2–4 metric that already carries a session id (for example a best leg) links too. None gains a new field for it; missing ids are a follow-up issue, not a contract change here.

## Global Constraints

- TDD: write the failing test, run it, watch it fail, then implement (`app/CLAUDE.md` §Test-Driven Development).
- `cd app && npm test` runs the whole suite. Finish every task with the full suite.
- No migration in this plan. Never edit an applied migration. A needed index follows Task 2 Step 3's on-fail rule.
- `app/src/db/schema.ts` is generated and already carries the widened view. Never hand-edit it.
- Reads go through views only: `vGameReplay` and `vStatsSessionFacts`.
- No game rules on the server. The server returns stored facts in stored order; the engine runs only on the client.
- NUMERIC arrives as a string: `locationX`/`locationY` are `Number(…)` when non-null.
- Engine modules stay unedited. The replay consumes `create(config, prior)` exactly as the play pages do.
- JSDoc only (`check-no-inline-comments.sh`). Exported types go in the barrels (`check-type-barrels.sh`). No `x-init`.
- `npm run format` before every commit.
- Branch: `feat/statistics-replay` from `main` after the Prerequisite holds; never stacked on the 5a branch.
- Anything noticed that this plan does not ask for → GitHub issue via `capturing-discovered-work`, never fixed in the same pass.

## File map

| Action | Path | Responsibility |
| ------ | ---- | -------------- |
| Create | `app/src/modules/stats/replay.module.ts` | `stageOrder`, replay cursor codec, rows → turns |
| Create or move | `app/src/modules/stats/snapshot.module.ts` | `snapshotOf` (decision 8), if still private |
| Modify | `app/src/repositories/statistics.repository.ts`, `app/src/modules/types.ts` | gate, stages, participants, turn page |
| Modify | `app/src/services/statistics.service.ts`, `app/src/services/types.ts` | `getSessionReplay` |
| Modify | `app/src/pages/api/statistics/types.ts` | zod: replay query, header, page |
| Create | `app/src/pages/api/statistics/sessions/[sessionId]/replay.ts` | route |
| Modify | `app/src/lib/client/api/statistics.ts`, `api/types.ts` | `fetchSessionReplay` |
| Modify | `app/src/lib/client/stats-cache/db.ts`, `cache.ts` | `replayPages` store, schema bump, `readReplayPage` |
| Create | `app/src/lib/stats/replay-fold.ts` | pages → `EngineFacts`, per-turn state, skip rules |
| Create | `app/src/lib/stats/replay-presenters.ts` | per-game state → view rows |
| Create | `app/src/lib/stats/replay-route.ts` | `replayPath`, `replaySessionIdFromLocation` |
| Create | `app/src/stores/replay.store.ts` | page state, sequential page loading |
| Create | `app/src/pages/statistics/replay.astro` | the replay page |
| Modify | `app/src/pages/statistics/index.astro` | replay links |
| Tests | mirror each path under `app/tests/` | |
| Docs | Task 8 list | |

---

### Task 1: Replay module — stage order, cursor, rows → turns

**Files:**
- Create: `app/src/modules/stats/replay.module.ts`
- Modify: `app/src/modules/types.ts`
- Test: `app/tests/modules/stats/replay.module.test.ts`

**Interfaces:**
- `ReplayStageRow = { stageId; parentStageId: string | null; stageTypeKey; sequence }`
- `ReplayRow = { stageId; turnSequence; participantId; participantName; participantTypeKey; turnTotalScore; dartNumber: number | null; intendedTargetNumber; intendedZoneKey; hitTargetNumber; hitZoneKey; score: number | null; locationX: number | null; locationY: number | null }`
- `ReplayTurn = { stageId; turnSequence; participantId; turnTotalScore; darts: ReplayDart[] }`, where `ReplayDart` is the dart half of `ReplayRow` with `dartNumber` and `score` non-null.
- `stageOrder(stages: readonly ReplayStageRow[]): ReplayStageRow[]`: pre-order (decision 3). It throws on a cycle or an unknown parent, both of which are impossible under the FKs, so a throw means corrupt input.
- `encodeReplayCursor({ stageId, turnSequence })` and `decodeReplayCursor(s): { stageId; turnSequence } | null`: `v1:` prefix, base64url, `null` on any malformation.
- `rowsToTurns(rows: readonly ReplayRow[]): ReplayTurn[]`: groups consecutive rows by `(stageId, turnSequence)` in input order. A row with `dartNumber === null` yields a turn with `darts: []`.

- [ ] **Step 1: Failing tests.**
  - `stageOrder`: three roots out of order → sorted by sequence; a root with two children → root, child 1, child 2, next root; depth 3 is preserved; a cycle throws.
  - Cursor round-trip; `null` for a bad prefix, bad base64, a non-integer sequence or a missing part.
  - `rowsToTurns`: two turns of three darts; a turn-total-only row → `darts: []`; darts keep row order; a NULL `dartNumber` mixed with real darts in one turn throws (the view cannot produce it).
- [ ] **Step 2: Implement.** Green, full suite. Commit: `feat(stats): replay stage order, cursor and turn grouping`

---

### Task 2: Repository readers

**Files:**
- Modify: `app/src/repositories/statistics.repository.ts`, `app/src/modules/types.ts`
- Test: `app/tests/repositories/statistics.repository.test.ts` (extend; rendered SQL via `tests/repositories/render-sql.ts`, plus fake-chain row mapping)

**Interfaces:**
- `findReplaySession(db, playerId, sessionId): Promise<ReplaySessionRow | null>`: one row from `vStatsSessionFacts` with the decision 5 fields. `configuration` is passed through untouched.
- `findReplayStages(db, playerId, sessionId): Promise<ReplayStageRow[]>`: `SELECT DISTINCT stage_id, parent_stage_id, stage_type_key, stage_sequence FROM v_game_replay WHERE player_id = … AND session_id = …`. Unordered; the service applies `stageOrder`.
- `findReplayParticipants(db, playerId, sessionId, stageIds: readonly string[]): Promise<ReplayParticipantRow[]>`: distinct participants, ordered by `MIN(array_position($stageIds, stage_id), turn_sequence)`.
- `findReplayTurnPage(db, q: { playerId; sessionId; stageIds: readonly string[]; after: { position: number; turnSequence: number } | null; limit: number }): Promise<ReplayRow[]>`: the decision 4 query. `position` is 1-based in `stageIds`. The keyset `(pos, turn_sequence) > ($position, $turnSequence)` applies inside the ranked subquery. The query keeps `turn_rank <= limit + 1` and orders by `pos, turn_sequence, dart_number`.

Every reader filters `player_id` **and** `session_id`, and `nonNull` guards the columns the view guarantees.

- [ ] **Step 1: Failing tests.**
  - The rendered SQL of each reader: the view name, both filters, and for the page: `dense_rank`, `array_position`, the row-comparison keyset, `limit + 1`, and the three-column order.
  - Mapping: NUMERIC `"12.50"` → `12.5`; NULL coordinates stay `null`; `nonNull` throws on a null `stage_id` or `participant_id`.
  - `after: null` renders no keyset predicate.
- [ ] **Step 2: Implement.** Green, full suite.
- [ ] **Step 3: Measure** (needs `DATABASE_URL`; without it, ask the owner to run it and paste the plans). `EXPLAIN (ANALYZE, BUFFERS)` of `findReplayTurnPage` for the largest session in the dev database. It must use `idx_stages_session_sequence`, `idx_turns_stage_sequence` and `idx_darts_turn_number`, with no sequential scan on `turns` or `darts`. **On fail:** stop. The index is added as its own migration on a database branch run the phase 1a way (verification script, local introspection, PR, deploy), and this plan's PR merges only after that deploy is green. Either way, record the plan summary in the PR body.
- [ ] **Step 4:** Commit: `feat(stats): replay repository readers`

---

### Task 3: Service `getSessionReplay`

**Files:**
- Modify: `app/src/services/statistics.service.ts`, `app/src/services/types.ts`
- Test: `app/tests/services/statistics.service.test.ts` (extend; mock the repository)

**Interfaces:**
- `getSessionReplay(playerId, sessionId, q: { cursor: string | null; limit: number }): Promise<ServiceResult<ReplayPage>>`
- `ReplayPage = { header: ReplayHeader | null; turns: ReplayTurn[]; nextCursor: string | null }`

Behaviour:
1. `findReplaySession` returns null → `NOT_FOUND`, and no other reader runs.
2. `findReplayStages`, then `stageOrder`.
3. Decode the cursor. It is malformed, or its `stageId` is not in the order → `VALIDATION_FAILED`.
4. `findReplayTurnPage`, then `rowsToTurns`. More than `limit` turns → drop the last and set `nextCursor` from the last kept turn.
5. With no cursor, `header` is built from the session row, the ordered stages and `findReplayParticipants`. Later pages carry `header: null`.
6. A session with no stages (never started) returns `header` with `stages: []`, `turns: []` and `nextCursor: null`.

- [ ] **Step 1: Failing tests** for each behaviour, plus:
  - Exactly `limit` turns → `nextCursor: null`.
  - `limit + 1` turns → `limit` turns and a cursor pointing at the last kept turn.
  - Following that cursor passes `position` = that stage's 1-based index.
  - A two-leg 501 fixture pages across the leg boundary without losing or repeating a turn.
- [ ] **Step 2: Implement.** Green, full suite. Commit: `feat(stats): session replay service`

---

### Task 4: Route and contract

**Files:**
- Modify: `app/src/pages/api/statistics/types.ts`
- Create: `app/src/pages/api/statistics/sessions/[sessionId]/replay.ts`
- Test: `app/tests/pages/api/statistics/session-replay.test.ts` (pattern: phase 1's `games-sessions.test.ts`)

**Interfaces:**
- `ReplayQuery`: a zod `.strict()` object over the search params: `cursor` optional; `limit` an optional integer 1–120, default 30. Any other key fails (decision 6).
- `ReplayHeaderSchema`, `ReplayTurnSchema`, `ReplayPageSchema` mirror Task 3's types. The types are `z.infer`'d into the barrels.
- `sessionId` must be a UUID, else `VALIDATION_FAILED`.

- [ ] **Step 1: Failing tests.**
  - The happy path calls the service with `auth.playerId`, the id and the parsed query. The body parses against `ReplayPageSchema`, and the response has `Cache-Control: private, max-age=31536000, immutable`.
  - `from=…`, `bucket=month` or `foo=1` → 400 `VALIDATION_FAILED`.
  - `limit=0` or `limit=121` → 400.
  - A non-UUID id → 400.
  - A service `NOT_FOUND` → 404 with `Cache-Control: private, no-store`.
  - Confirm from `middleware.ts` that `/api/statistics/*` is protected (phase 1 did); add a test only if the middleware tests cover per-prefix cases.
- [ ] **Step 2: Implement** following the phase 1 routes (`fail("VALIDATION_FAILED", requestId, { reason })`, `ok()`). Only the success path sets the immutable header.
- [ ] **Step 3:** Green, full suite, `cd app && npm run validate:app`. Commit: `feat(api): statistics session replay route`

---

### Task 5: Client fold and presenters

**Files:**
- Create or move: `app/src/modules/stats/snapshot.module.ts` (decision 8), updating the phase 3/4 import sites
- Create: `app/src/lib/stats/replay-fold.ts`, `app/src/lib/stats/replay-presenters.ts`
- Tests: `app/tests/lib/stats/replay-fold.test.ts`, `replay-presenters.test.ts`; the existing `snapshotOf` tests move with the function, unedited

**Interfaces:**
- `replayFacts(stages: ReplayHeader["stages"], turns: readonly ReplayTurn[]): EngineFacts`: decision 8's key mapping. Darts map to `DartFact` with `sequence = dartNumber`. `completedAt` is `null`: engines do not read it for state.
- `foldReplay(header: ReplayHeader, turns: readonly ReplayTurn[]): ReplayFold`
  - `ReplayFold = { ok: true; stateAfter: (turnIndex: number) => unknown } | { ok: false; reason: "NO_SNAPSHOT" | "NO_ENGINE" | "SEATLESS_MULTI" | "ENGINE_THREW" }`
  - `stateAfter(k)` memoizes `factory.create(config, factsUpTo(k)).state()`. A throw at any `k` turns the whole fold into `ENGINE_THREW`; there is no partial fold.
  - A seatless snapshot with one participant gets a synthesized seat: `{ participantRef, displayName, sideKey: "A", participantTypeKey }`. `"A"` is the solo seat's side (`session.service.ts`).
- `REPLAY_PRESENTERS: Record<GameTypeKey, ReplayPresenter>` with `ReplayPresenter = { turn(state, participantId): ReplayCell[]; session(states: readonly unknown[]): ReplaySessionLine }`. Each reads state exactly as its `*-play.data.ts` does (decision 8 table). `Record` over `GameTypeKey` makes a missing game a type error.

- [ ] **Step 1: Failing tests.**
  - `replayFacts` round-trip: facts from a real engine run (drive each engine through a scripted game in the test), converted to replay turns and back, rebuild an engine whose `state()` deep-equals the original. One case per ruleset family: 501, 121, TUOD, Score Training, Singles, Doubles, Bob's 27, Shanghai, ATC.
  - Each skip reason with a minimal header.
  - Presenters, from the same scripted games:
    - 501: remaining after the visit, and a bust visit flagged.
    - Bob's 27: the running score per visit equals the engine's seat score, and the curve length equals the visit count.
    - ATC: the active target advances on a hit.
  - **Cost ceiling:** a 600-turn Score Training session folds `stateAfter` for every turn in under 1 s in Vitest. If it fails, switch `stateAfter` to incremental creation at page boundaries plus `record()` replay within a page. That is the same result by the engine's own API; keep the round-trip tests unedited.
- [ ] **Step 2: Implement.** Green, full suite. Commit: `feat(stats): client replay fold and per-game presenters`

---

### Task 6: Client API and `replayPages` cache

**Files:**
- Modify: `app/src/lib/client/api/statistics.ts`, `app/src/lib/client/api/types.ts`
- Modify: `app/src/lib/client/stats-cache/db.ts`, `cache.ts`
- Tests: `app/tests/lib/client/api/statistics.test.ts`, `app/tests/lib/client/stats-cache/*.test.ts` (extend)

**Interfaces:**
- `fetchSessionReplay(sessionId, { cursor?, limit? })`: builds `?cursor=&limit=` (omitting absent keys), calls `apiRequest`, throws `StatisticsApiError` on failure.
- `db.ts`: adds object store `replayPages` and bumps `STATS_SCHEMA_VERSION` by one (decision 7).
- `cache.ts`: `readReplayPage(sessionId, cursor, fetcher)` reads `(sessionId, cursor ?? "")`. On a miss it fetches, stores and returns. It stores only successful pages. The phase 1 `safe()` wrapper gives network-only on any IndexedDB failure.

- [ ] **Step 1: Failing tests.**
  - The API omits absent params.
  - The first read fetches; the second identical read does not call the fetcher.
  - A different cursor misses.
  - A fetcher throw is not cached.
  - `clearStatsCache` empties `replayPages`.
  - The schema bump wipes a v(n−1) database.
  - A null DB calls the fetcher every time.
- [ ] **Step 2: Implement.** Green, full suite. Commit: `feat(client): replay page cache`

---

### Task 7: Store, page and links

**Files:**
- Create: `app/src/lib/stats/replay-route.ts`, `app/src/stores/replay.store.ts` (register beside `gameStats`), `app/src/pages/statistics/replay.astro`
- Modify: `app/src/pages/statistics/index.astro`, `app/src/stores/game-stats.store.ts` (link getters only)
- Tests: `app/tests/lib/stats/replay-route.test.ts`, `app/tests/stores/replay.store.test.ts`

**Interfaces:**
- `replayPath(sessionId)` → `/statistics/replay?session=<encoded>`. `replaySessionIdFromLocation(): string | null`, following `routine-route.ts`.
- Store fields: `sessionId`, `header`, `turns: ReplayTurn[]`, `nextCursor`, `fold: ReplayFold | null`, `loading`, `error: "NOT_FOUND" | "FAILED" | null`.
- Store methods:
  - `init()` reads the id; with no id it sets `error: "NOT_FOUND"`.
  - `loadNext()` reads the next page through `readReplayPage`, appends, and refolds.
  - `turnView(index)` returns the stored darts plus presenter cells, or stored darts only when `fold.ok` is false.
  - Getters give the stage groups (leg/round headings from `stages`) and the session line.

- [ ] **Step 1: Failing tests.**
  - Route helpers round-trip an id; an empty `?session=` → `null`.
  - The store loads the header plus the first page from a mocked cache.
  - `loadNext` appends in order and stops at `nextCursor: null`.
  - A 404 sets `error: "NOT_FOUND"`.
  - With `fold.ok = false`, `turnView` returns the stored darts and no cells.
  - Page loads are serialized: two quick `loadNext` calls fetch each cursor once.
- [ ] **Step 2: Implement the store, then the page.** `prerender = true`, the stats layout and the client auth gate. The page shows:
  - a header card: game, ruleset, date, duration, status and context badges, participants
  - stages as sections (Leg 1, Round 3, …) with turn rows: seat, stored darts (zone labels), visit total, presenter cells
  - the existing board component with the selected turn's dart markers (coordinates), none for turn-total-only turns
  - for Bob's 27, the running-score curve from the session line
  - "Load more" while `nextCursor` is set, and the "Derived values unavailable" note when the fold is skipped

  Reuse existing components. For a new visual pattern, read `07-Frontend/10-Frontend-Agent-Guide.md` first.
- [ ] **Step 3: Links.** Session-list rows and the PB line in `index.astro` link via `replayPath` (decision 12). Links from phase 2–4 cards are added only where the metric already carries a session id.
- [ ] **Step 4:** Full suite, `npm run validate:app`, then the `app/` gate scripts from `run-all-gates`. Commit: `feat(stats): replay page and links from the game page`

---

### Task 8: Docs, decision, gates

**Files:**
- `decisions/api.md`: **D371**, covering plan-level decisions 1–12. Get the id from `bash scripts/next-decision-id.sh`.
- `docs/architecture/10-Statistics/02-Replay.md`:
  - §1: the URL (decision 9) and the links (decision 12)
  - §2: the gate, the order, turn-count pages with default 30 and cap 120, the cursor, the header fields, rejected params, scope (decision 10)
  - §3: the widened view without `context_key`, the cache header and the schema bump
  - new §4: client derivation, presenters and skip rules
  - version 1.1.0 citing D371; status **built**
- `docs/architecture/10-Statistics/00-Overview.md`: §6 replay row **built**; §7 `replayPages` built; §12 phase 5 done (§10 is 5a's); version 1.5.0 citing D371.
- `docs/architecture/06-API/04-Endpoint-Contracts.md`: the full replay contract (params, errors, headers, `ReplayPage`). The frozen `ReplayEntry` row stays; add one line that this phase does not build it and that the issue from Step 3 tracks it.
- `docs/architecture/06-API/00-Overview.md`: the planned replay route marked built.
- `04-Indexes.md` and `03-Migrations.md` only if Task 2 Step 3 required an index (landed by its own database branch).
- `docs/architecture/07-Frontend/01-Rendering-Strategy.md`: add `/statistics/replay` (`?session=`, prerendered) to the route table.
- Root `CLAUDE.md`: the never-modify range moves to 5a's migration, citing its green deploy run. `docs/CLAUDE.md` and `database/CLAUDE.md` were moved by 5a.

- [ ] **Step 1:** Make the doc edits: minimal diffs, canonical doc first.
- [ ] **Step 2:** Run the `context-maintenance` skill: the context map, File Inventory rows (new route and page) and a history entry.
- [ ] **Step 3:** File the decision 11 issue (`discovered-work`) through `capturing-discovered-work`: "frozen `GET /api/sessions/:sessionId/replay` overlaps the built statistics replay — retire or alias". Name it in the PR body.
- [ ] **Step 4:** Run the `run-all-gates` skill: the Always-run set, the `app/` set, `check-constraint-mirror.sh` and `check-decision-ids.sh`. Report each result.
- [ ] **Step 5:** Commit `docs(stats): phase 5 replay contract and D371`. Then run `superpowers:finishing-a-development-branch` with `finishing-a-dart-branch` (push + PR).

---

## Out of scope

- The `v_game_replay` migration, its verification script, `schema.ts` regeneration and its database docs (phase 5a).
- Routine statistics and the replay of training (non-game) sessions (phase 6).
- The `supersededBy` header field, which lands with corrections.
- Building, aliasing or retiring the frozen `GET /api/sessions/:sessionId/replay` (the decision 11 issue).
- New session-id fields on phase 2–4 metrics purely to add replay links.
- Server-side derived values of any kind in the replay response.
