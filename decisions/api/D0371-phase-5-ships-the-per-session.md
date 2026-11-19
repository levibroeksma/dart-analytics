---
id: D0371
status: accepted
date: 2026-09-28
origin: contemporaneous
original-date:
tags: [api, endpoint, auth, session, status]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Phase 5 ships the per-session replay: one gate on every page, whole-turn pages behind a stage-and-sequence cursor, a forever client cache, and per-turn values folded on the client by the engine

## Context and Problem Statement
a gate on every page, not only the first, is what stops an opaque cursor from becoming a way to read another player's turns, and reading it from `v_stats_session_facts` gives one "not yours, not terminal or not a game" answer that leaks nothing. Counting turns, not rows, keeps a visit whole across a page boundary and makes the default page about one leg. Completed gameplay is already immutable by invariant, so the client keeps a page forever with no version token; the HTTP cache is left out because sign-out cannot wipe it (decision 7). Folding on the client through the play pages' own rehydrate path keeps one rule per game — the replay cannot disagree with the play page about a remaining score, and the server stays free of game rules (`10-Statistics/00-Overview.md` §4). Skipping rather than guessing follows D370 decision 4.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "twelve decisions for the phase 5 build (`docs/superpowers/plans/2026-09-26-statistics-phase-5b-replay.md`; its database half, migration `0044`, shipped as phase 5a):
1. `v_game_replay` is widened in place (`0044`) with `participant_id`, `participant_type_key`, `location_x`, `location_y`; no sibling view. No per-row `context_key`: it is a session fact, which the header reads once from `v_stats_session_facts`. The view stays unfiltered by participant (`0023`), so a replay shows every seat, guests and DartBot included.
2. One gate for every page: the caller's `v_stats_session_facts` row for `(player_id, session_id)` must exist, else `NOT_FOUND` — another player's, an active, a training and an unknown session all read the same, and none reveals whether the id exists. The gate runs on every page because a cursor is not a credential. A non-UUID `sessionId` is `VALIDATION_FAILED` before the gate.
3. Play order: stages in pre-order (roots by `sequence_number`, each followed by its own children, any depth) through the pure `stageOrder` (`modules/stats/replay.module.ts`), no recursive SQL; turns by `turn_sequence`, which is stage-wide across seats; darts by `dart_number`.
4. Pages count whole turns: `limit` 1–120, default 30. One query ranks turns with `dense_rank() OVER (ORDER BY array_position($stageIds, stage_id), turn_sequence)` and keeps ranks `≤ limit + 1`; the extra turn sets `nextCursor`. The cursor is base64url of `v1:<stageId>:<turnSequence>`, built on `series.module.ts`'s now-exported `toBase64Url`/`fromBase64Url` rather than a second codec. A malformed cursor, or one naming a stage outside the session, is `VALIDATION_FAILED`.
5. The header rides the first page only: the session's `v_stats_session_facts` fields (`sessionId`, `gameTypeKey`, `rulesetVersionKey`, `inputModeKey`, `statusKey`, `contextKey`, `activityId`, `routineStepSequenceNumber`, `configuration`, `startedAt`, `completedAt`, `durationSeconds`, `turnCount`, `dartCount`), `participants` (every participant with at least one stored turn, in first-turn order) and `stages` (play order). No outcome is stored (D367 decision 3), so none is sent.
6. Only `cursor` and `limit` are accepted; every other parameter (`from`, `to`, `tz`, `bucket`, `status`, `context`, `inputMode`, …) is `VALIDATION_FAILED` through a `.strict()` query schema.
7. Caching: every response, page or error, is sent `Cache-Control: private, no-store`. The client's `replayPages` IndexedDB store is the only cache: it keys pages by `(sessionId, cursor ?? "")`, holds no `dataVersion` and is never invalidated — it is wiped only with the rest of the cache; adding it bumps `STATS_SCHEMA_VERSION` from 1 to 2. Amended in place before merge (the plan sent `private, max-age=31536000, immutable` on success): the browser's HTTP cache is keyed by URL alone and sign-out wipes only IndexedDB (`auth.store.ts`), so the next user of a shared browser could be served a cached page with no owner check. The sign-out wipe (`10-Statistics/00-Overview.md` §7) outranks a redundant HTTP cache.
8. The client derives per-turn values from the engine; the server never does. `foldReplay` (`lib/stats/replay-fold.ts`) decodes the snapshot with `snapshotOf`, which stays in `x01-checkout-sessions.module.ts` (already exported, so no `snapshot.module.ts` is extracted), maps the pages to `EngineFacts` (stage key = `stageId`, turn key = `stageId:turnSequence`, `participantRef` = `participantId`) and rebuilds the state after turn *k* as `create(snapshot, factsUpTo(k)).state()`, the play pages' rehydrate path. Three refinements of the plan text, each forced by a failing test against the real engines: (a) every turn's `completedAt` is one fixed non-null placeholder, since the view carries no turn completion time and `null` means an open visit to 121, TUOD, Score Training and the seat rota; (b) `factsUpTo(k)` holds only the stages up to turn *k*'s own, so the next leg 501 opens after a checkout never shows 501 remaining on the checkout turn; (c) presenters are `turn(step, snapshot)`/`session(steps, snapshot)` with `step = { turn, before, after }`, because a lone state and participant id cannot label targets, mark hits, flag busts or attribute leg winners. Skipped, never guessed: no or undecodable snapshot (`NO_SNAPSHOT`), no engine (`NO_ENGINE`), a seatless snapshot with more than one participant (`SEATLESS_MULTI`) or any rebuild throwing (`ENGINE_THREW`) leaves stored facts only, with "Derived values unavailable for this session"; a seatless one-participant snapshot gets one seat synthesized from that participant (`sideKey: "A"`).
9. The page is `/statistics/replay?session=<id>`, a prerendered shell that reads the id client-side (the `?routine=` precedent). A missing or non-UUID id shows not-found without a request, and the client encodes the id in the request path.
10. Scope: every terminal game session in any input mode; a turn-total-only turn replays at turn resolution (`darts: []`). Training sessions are `NOT_FOUND`; routine replay belongs to phase 6.
11. The frozen `GET /api/sessions/:sessionId/replay` (`ReplayEntry[]`) stays documented and unbuilt; this phase neither builds nor drops it. Issue #636 tracks the choice between retiring it (a D321-style drop) and pointing it at the same service.
12. Links: every session-list row and the `session-result` PB line link to the replay. No phase 2–4 metric carries a session id, so no section links yet, and none gains a field here.".

### Consequences
`10-Statistics/02-Replay.md` now states what was built (§1 route and links, §2 endpoint, §3 cost, new §4 client derivation; version 1.1.0, status built) and `00-Overview.md` §6/§7/§12 mark the replay built (version 1.5.0). `06-API/04-Endpoint-Contracts.md` gains a "Statistics Replay" section, `06-API/00-Overview.md` moves the route from planned to built, and `07-Frontend/01-Rendering-Strategy.md` classifies `/statistics/replay`. `VALIDATION_FAILED` answers HTTP 422, per the frozen `ERROR_HTTP` registry. Known limitations: 501's bust flag is set only for board-captured turns — a keypad bust stores no darts and reads as a 0 visit; an abandoned session's unfinished last visit replays as closed (decision 8a); the header's stage tree holds only stages with at least one turn, since it is read through `v_game_replay`. The page query relies on the existing `idx_stages_session_sequence`, `idx_turns_stage_sequence` (`0008`) and `uq_darts_turn_number` (`0011`); its `EXPLAIN` measurement did not run, because the implementing session was denied loading database credentials, so no measured plan is claimed and no index was added — the owner runs it. Root `CLAUDE.md`'s applied-migration range extends to `0044`, citing the green `deploy` run (36351454413) for PR #632's merge. Filed as `discovered-work`, not fixed here: #633 (the derived-aims synthetic solo seat uses `sideKey: "SOLO"` where real solo seats use `"A"`), #634 (the statistics heatmap board blocks touch scrolling), #635 (statistics cards show raw target keys such as `TREBLE:20` where the replay shows `T20`) and #636 (decision 11). The replay page was not exercised in a browser in the implementing session.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-28
Refines: D365
Referenced by D0414's `Supersedes:` line.
