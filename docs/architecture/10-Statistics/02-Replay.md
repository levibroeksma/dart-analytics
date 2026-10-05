<!--
status: canonical
scope: architecture/statistics/replay
read-when: building or changing the per-session game replay, its card or its endpoint
updated: 2026-10-05
-->

# Statistics — Game Replay

> **Version:** 1.3.0 (2026-10-05, D414: no route, the replay opens in a growing card; prior 1.2.2 2026-10-03, D398; prior 1.2.1 2026-10-03, D397; prior 1.2.0 2026-09-29, D372; prior 1.1.0 2026-09-28, D371; prior 1.0.0 2026-09-26, D365)
>
> Full, paginated replay of one session. Shared query rules and caching:
> `00-Overview.md` §5/§7. Status: **built** (phase 5, D371; training step
> sessions, phase 6, D372).

---

# 1. Entry point

No route (D414, superseding D371 decisions 9 and 12; 2026-10-05). A replay
opens in place: each row of a game page's replay section
(`GameSessionList.astro`) is a `ReplayCard.astro`, a `GrowingCard` that grows
into an overlay covering the viewport inset by 1rem and renders
`SessionReplay.astro` while open. Opening calls `$store.replay.open(id)`;
Escape or the card's close button collapses it. Open state lives in the page
only — no URL, no history entry. A non-UUID id shows the not-found state and
sends no request.

That card is the only entry point. Step session rows on the Routines tab,
the `session-result` PB line, the 501 `leg-stats` Best leg card and the
overview's `highestCheckoutSessionId` carry session ids but open no replay.

---

# 2. Endpoint

`GET /api/statistics/sessions/:sessionId/replay?cursor=&limit=`
(full contract: `06-API/04-Endpoint-Contracts.md` §Statistics Replay)

- **One gate, every page (decision 2):** the caller's `v_stats_session_facts`
  row for `(player_id, session_id)` must exist — or, failing that, the
  caller's `v_stats_routine_step_facts` row with a non-null
  `input_mode_key` (D372 decision 11) — else `NOT_FOUND`. Another player's
  session, an active session, a Warm-Up step (no capture pair, nothing to
  replay) and an unknown id all read the same; none reveals whether the id
  exists. The gate
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
  (`modules/stats/sections/series.module.ts`). Malformed (a turn sequence
  outside 1–2147483647 included), or naming a stage outside this session:
  `VALIDATION_FAILED`.
- **Header, first page only (decision 5);** later pages carry `header: null`:
  - from `v_stats_session_facts`: `sessionId`, `gameTypeKey`,
    `rulesetVersionKey`, `inputModeKey`, `statusKey`, `contextKey`,
    `activityId` (links a routine-step game to its training run),
    `routineStepSequenceNumber`, `configuration` (the snapshot),
    `startedAt`, `completedAt`, `durationSeconds`, `turnCount`, `dartCount`;
    a non-game step reads the same fields from `v_stats_routine_step_facts`
    instead (`contextKey` `ROUTINE`), with `gameTypeKey` **and**
    `rulesetVersionKey` `null` — `chk_exercise_sessions_game_pair` (`0029`)
    nulls the ruleset whenever the game type is null
  - from `v_stats_routine_step_facts` — left-joined on `session_id` for a
    game session, the fallback row itself for a non-game step (D372
    decision 11): `exerciseTypeKey`, `exerciseRulesetVersionKey`,
    `routineKey`, `stepKey`. A standalone game has no step row: its
    `exerciseTypeKey` is `GAME` and the other three are `null`
  - `participants`: `{ participantId, displayName, participantTypeKey }[]`,
    every participant with at least one stored turn (guests and DartBot
    included), in first-turn order
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
  session, any input mode, and — since phase 6 (D372) — every terminal
  non-game routine step session with an input mode. A Warm-Up step has
  none, so it stays `NOT_FOUND`.

Replay reproduces the stored facts and the stored snapshot — never current
templates or rulesets (`05-Views/00-Overview.md` §Runtime Replay Rules).
The server applies no game rule; derived per-turn values are the client's
(§4).

---

# 3. Cost

- **Caching (decision 7):** the gate guarantees a terminal session and
  completed gameplay is immutable, so the client keeps pages forever in the
  `replayPages` IndexedDB store, keyed `(sessionId, cursor ?? "")`, with no
  `dataVersion` and no invalidation — wiped only with the rest of the cache
  on sign-out or a schema bump. Adding the store bumped
  `STATS_SCHEMA_VERSION` 1 → 2. The header's phase 6 change is a contract
  change, so it rides the scope-key bump 2 → 3 (`00-Overview.md` §7, D372),
  which wipes `replayPages` too: no page cached under the old header shape
  survives. Every response, page or error, is
  `Cache-Control: private, no-store`: the browser's HTTP cache is keyed by
  URL alone and sign-out cannot wipe it, so a cached page could reach the
  next user of a shared browser (`00-Overview.md` §7).
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
  `idx_turns_stage_sequence` (`0008`) and `uq_darts_turn_number` (`0011`). No
  index was added, and its query plan has not been measured against a
  database.

---

# 4. Client Derivation

Per-turn values (remaining score, active target, running score) come from
rebuilding the ruleset's engine over the loaded facts (decision 8).

- **Facts:** `foldReplay(header, turns)` (`lib/stats/replay-fold.ts`) decodes
  the snapshot with `snapshotOf` (`modules/stats/x01-checkout-sessions.module.ts`,
  reused in place) and maps the pages to `EngineFacts` through `replayFacts`
  — moved to `modules/stats/replay.module.ts` in phase 6 so the server's
  `step-result` fold reuses it (D372): stage `clientKey` =
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
  A non-game step (`gameTypeKey` `null`) folds through its dart exercise
  engine instead, `getDartExerciseEngineFactory(exerciseRulesetVersionKey)`,
  over its own configuration (D372 decision 11). That engine reads no seat,
  so no seat is synthesized.
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
- **Step presenters** (`STEP_REPLAY_PRESENTERS`, D372 decision 11), one per
  dart exercise kind, are built from `STEP_METRIC_SPECS` and `stepMetrics`
  (`01-Section-Catalog.md` §3.1), not hand-written: a turn shows the kind's
  running headline and darts thrown; the session line shows every final
  metric. The store picks `REPLAY_PRESENTERS` by `gameTypeKey`, else
  `STEP_REPLAY_PRESENTERS` by `exerciseTypeKey`; the page heading falls back
  to the step's exercise label and exercise ruleset.
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
  - `NO_EXERCISE_ENGINE` (D372): a non-game step whose
    `exerciseRulesetVersionKey` is `null` or names no registered dart
    exercise engine

  For a non-game step, `NO_SNAPSHOT` means a `null` or non-object
  configuration. An exercise engine decodes its own configuration inside
  `create`, so a configuration that fails that decode is `ENGINE_THREW`, not
  `NO_SNAPSHOT`. `SEATLESS_MULTI` applies to game sessions only.

  A game type with no presenter also shows stored facts only, and a turn its
  presenter throws on shows no cells while every other row keeps its own. A seatless
  one-participant snapshot gets one seat synthesized from that participant
  (`participantRef` = its id, `sideKey: "A"`).
- **View:** `replay.store.ts` (`$store.replay`) holds one session at a
  time: `open(id)` clears the previous one and starts a new generation, so a
  page that lands after a later `open()` is dropped. It loads pages sequentially
  through `readReplayPage`, groups rows under stage headings (`Set 1 · Leg
  2`; none for a session's lone exercise block), and marks the selected
  turn's located darts on the board. Until the last page loads, "Load all
  turns to see the result" stands where the session line will show; a
  failed first page offers "Try again".
