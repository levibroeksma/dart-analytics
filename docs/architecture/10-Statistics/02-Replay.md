<!--
status: canonical
scope: architecture/statistics/replay
read-when: building or changing the per-session game replay route or its endpoint
updated: 2026-09-28
-->

# Statistics — Game Replay

> **Version:** 1.1.0 (2026-09-28, D371; prior 1.0.0 2026-09-26, D365)
>
> Full, paginated replay of one session. Shared query rules and caching:
> `00-Overview.md` §5/§7. Status: **built** (phase 5, D371).

---

# 1. Route

`/statistics/replay?session=<id>` (D371 decision 9): a prerendered shell
(`07-Frontend/01-Rendering-Strategy.md`, D97) that reads the id client-side,
following the `?routine=` precedent. A dynamic segment would force on-demand
rendering for a shell that carries no data. A missing or non-UUID `?session=`
shows the not-found state and sends no request.

Links (decision 12): every session-list row on a game page, and the
`session-result` PB line (its `bestLowSessionId`/`bestHighSessionId`). No
phase 2–4 metric carries a session id, so no section links yet; a section
that wants one (best leg, highest checkout) needs a new field first.

---

# 2. Endpoint

`GET /api/statistics/sessions/:sessionId/replay?cursor=&limit=`
(full contract: `06-API/04-Endpoint-Contracts.md` §Statistics Replay)

- **One gate, every page (decision 2):** the caller's `v_stats_session_facts`
  row for `(player_id, session_id)` must exist, else `NOT_FOUND`. Another
  player's session, an active session, a training (non-game) session and an
  unknown id all read the same; none reveals whether the id exists. The gate
  runs on every page, since a cursor is not a credential. A non-UUID
  `sessionId` is `VALIDATION_FAILED` before the gate.
- **Play order (decision 3):** stages in pre-order — roots by
  `sequence_number`, each followed by its own children in the same order, at
  any depth (`stageOrder`, `modules/stats/replay.module.ts`; pure TS, no
  recursive SQL). Turns by `turn_sequence` within a stage (stage-wide across
  seats, so a total order of play); darts by `dart_number`.
- **Pages of whole turns (decision 4):** `limit` defaults to 30 turns, capped
  at 120; out of range is `VALIDATION_FAILED`. One query ranks turns with
  `dense_rank() OVER (ORDER BY array_position($stageIds, stage_id),
  turn_sequence)` and keeps ranks `≤ limit + 1`; the extra turn is dropped
  and sets `nextCursor`, which is `null` after the last turn.
- **Cursor:** base64url of `v1:<stageId>:<turnSequence>` for the page's last
  turn, built on the session-list codec's base64url helpers
  (`modules/stats/sections/series.module.ts`). Malformed, or naming a stage outside this
  session: `VALIDATION_FAILED`.
- **Header, first page only (decision 5);** later pages carry `header: null`:
  - from `v_stats_session_facts`: `sessionId`, `gameTypeKey`,
    `rulesetVersionKey`, `inputModeKey`, `statusKey`, `contextKey`,
    `activityId` (links a routine-step game to its training run),
    `routineStepSequenceNumber`, `configuration` (the snapshot),
    `startedAt`, `completedAt`, `durationSeconds`, `turnCount`, `dartCount`
  - `participants`: `{ participantId, displayName, participantTypeKey }[]`,
    every seat (guests and DartBot included), ordered by first turn
  - `stages`: `{ stageId, parentStageId, stageTypeKey, sequence }[]` in play
    order — the stages holding at least one turn (read via `v_game_replay`)

  No outcome is stored (phase 1 decision 3), so none is sent; the client
  derives it (§4).
- **Turns:** `stageId`, `turnSequence`, `participantId`, `turnTotalScore`,
  `darts[]`. Each dart: dart number, hit target + zone, intended target + zone
  (when stored), score, `locationX`/`locationY` (when captured). A
  turn-total-only turn (recreational quick score) has `darts: []` and replays
  at turn resolution.
- **Rejected parameters (decision 6):** only `cursor` and `limit`. `from`,
  `to`, `tz`, `bucket`, `status`, `context`, `inputMode` or any other
  parameter is `VALIDATION_FAILED` (`00-Overview.md` §5, never silently
  ignored); the session id is the scope.
- **Scope (decision 10):** every terminal (completed or abandoned) game
  session, any input mode. Training sessions are absent from
  `v_stats_session_facts` (`NOT_FOUND`); routine replay is phase 6.

Replay reproduces the stored facts and the stored snapshot — never current
templates or rulesets (`05-Views/00-Overview.md` §Runtime Replay Rules).
The server applies no game rule; derived per-turn values are the client's
(§4).

---

# 3. Cost

- **Caching (decision 7):** the gate guarantees a terminal session and
  completed gameplay is immutable, so every successful page is sent with
  `Cache-Control: private, max-age=31536000, immutable`; errors keep
  `private, no-store`. The client keeps pages forever in the `replayPages`
  IndexedDB store, keyed `(sessionId, cursor ?? "")`, with no `dataVersion`
  and no invalidation — wiped only with the rest of the cache on sign-out or
  a schema bump. Adding the store bumped `STATS_SCHEMA_VERSION` 1 → 2.
  Corrections (unbuilt) will add `supersededBy` to the header
  (`00-Overview.md` §11).
- Only the pages the user asks for are fetched, one at a time and in order;
  a long timed session never loads in one payload.
- **View (decision 1):** `v_game_replay`, widened in place by `0044` with
  `participant_id`, `participant_type_key`, `location_x`, `location_y`; no
  sibling view. No per-row `context_key`: it is a session fact the header
  reads once from `v_stats_session_facts`. The view stays unfiltered by
  participant (`0023`).
- **Indexes:** the page query relies on `idx_stages_session_sequence`,
  `idx_turns_stage_sequence` and `idx_darts_turn_number` (`0008`). No index
  was added, and its query plan has not been measured against a database.

---

# 4. Client Derivation

Per-turn values (remaining score, active target, running score) come from
rebuilding the ruleset's engine over the loaded facts (decision 8).

- **Facts:** `foldReplay(header, turns)` (`lib/stats/replay-fold.ts`) decodes
  the snapshot with `snapshotOf` (`modules/stats/x01-checkout-sessions.module.ts`,
  reused in place) and maps the pages to `EngineFacts`: stage `clientKey` =
  `stageId`, turn `clientKey` = `stageId:turnSequence`, `participantRef` =
  `participantId`, dart `sequence` = `dartNumber`. The view carries no turn
  completion time, so every turn gets one fixed non-null `completedAt`
  placeholder: engines read it only as open or closed, and `null` would
  reopen a closed visit (121, TUOD, Score Training, the seat rota). An
  abandoned session's unfinished last visit therefore replays as closed. The
  placeholder is never shown.
- **States:** the state after turn *k* is
  `getEngineFactory(rulesetVersionKey).create(snapshot, factsUpTo(k)).state()`,
  the play pages' own rehydrate path. `factsUpTo(k)` holds turns up to *k*
  and only the stages up to turn *k*'s own stage — never a stage an engine
  opened ahead of the next turn, such as 501's next leg after a checkout.
  Cost is quadratic in the session's turns, bounded by one session; a test
  pins a 600-turn Score Training session under one second. The store refolds
  from page 1 each time a page loads, so every earlier turn is always loaded.
- **Presenters** (`REPLAY_PRESENTERS`, `lib/stats/replay-presenters.ts`), one
  per game type: `turn(step, snapshot)` gives a row's cells and
  `session(steps, snapshot)` the session line, where `step = { turn, before,
  after }` holds the states either side of the turn. Each reads state the way
  its game's `*-play.data.ts` does and never re-derives a rule:

  | Game | Per turn | Session line |
  | ---- | -------- | ------------ |
  | 501 | remaining after the visit, bust flag | leg winner per leg |
  | 121, TUOD | target and remaining | final target |
  | Score Training | running total | total |
  | Singles, Doubles, Shanghai, Around the Clock | active target, hit marks | final progress |
  | Bob's 27 | running score | final score, score curve per visit (phase 4 deferral) |

  The session line shows only once every page is loaded.
- **501 bust flag, limitation:** a bust is a visit its engine counted as zero
  though its darts scored (`checkoutAttemptCount`), so only board-captured
  turns are flagged. A keypad bust stores no darts and cannot be told from a
  0 visit; it is never flagged.
- **Skipped, never guessed:** the page shows stored facts only, noting
  "Derived values unavailable for this session", when (`ReplaySkipReason`):
  - `NO_SNAPSHOT`: no snapshot, or it does not decode
  - `NO_ENGINE`: no engine factory is registered for the ruleset
  - `SEATLESS_MULTI`: the snapshot has no `seats` and the session has more
    than one participant
  - `ENGINE_THREW`: `create` throws, or a turn's participant holds no seat or
    names a stage outside the session

  A game type with no presenter also shows stored facts only. A seatless
  one-participant snapshot gets one seat synthesized from that participant
  (`participantRef` = its id, `sideKey: "A"`).
- **Page:** `replay.store.ts` (`$store.replay`) loads pages sequentially
  through `readReplayPage`, groups rows under stage headings (`Set 1 · Leg
  2`), and marks the selected turn's located darts on the board.
