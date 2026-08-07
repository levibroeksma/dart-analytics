<!--
status: canonical
scope: decisions/architecture
read-when: why a domain-model/session/stage/turn/dart choice was made
load-when: domain model, activity, session, stage, turn, dart, ruleset, platform, player, participant, configuration, snapshot, immutability
depends-on: none
related: decisions/database.md, decisions/game-engine.md
updated: 2026-08-05
-->

| # | Source | Decision | Rationale |
| - | ------ | -------- | --------- |
| D01 | P1–10 | Store what happened, derive what it means: dart-level facts are the source of all statistics | Analytics flexibility for years of progression tracking |
| D02 | P16–20 | `Activity` (why playing, resumable container) separated from `Exercise Session` (which engine, gameplay record) | Resume/interrupt semantics without polluting gameplay records |
| D03 | P16–20 | Platform framed as Exercise Execution Platform: games extensible, rulesets immutable | New games must never redesign existing ones |
| D04 | P36–40 | Runtime chain frozen: `Session → Stage → Turn → Dart`; Turn = physical oche action, Dart = atomic observation | Single event model for all game types |
| D05 | P36–40 | Generic `exercise_stages` with `stage_type_id` lookup (MATCH/SET/LEG/ROUND/EXERCISE_BLOCK), not per-game typed tables | Open/Closed extensibility without table sprawl |
| D06 | P67–71 | Dart records intention + result (`intended_*` + `hit_*` target/zone); no multiplier column; `dart_zones` lookup (6 zones) | Multiplier derivable; intention enables accuracy analytics |
| D07 | P67–71 | Recreational capture may store turn totals with no dart rows; analytics mode requires full rows | Low-friction casual play without corrupting analytics data |
| D08 | P26–30 | Participants (PLAYER/GUEST/DARTBOT) attach to exercise session, not activity | Guests/bots are per-game, not per-intent |
| D09 | Cont. session | One active session per game type per player, DB-enforced via partial unique index (migration `0011`) | Prevents orphaned active sessions |
| D10 | P36–40 | No `current_stage` pointer stored; derive from latest stage → turn → dart | No derivable state persisted |
| D11 | P21–25 | Completed gameplay immutable (application-enforced); corrections create new records; active sessions mutable during play | Historical truth; replayability |
| D12 | P59–63 | Hybrid IDs: UUIDv7 app/Worker-generated for domain entities, SMALLINT seeded for lookups; DB never generates ids | Sortable ids, deterministic seeds, no DB id coupling |
| D13 | P21–25 | Configuration chain `game_type → ruleset_version → snapshot`; runtime copies config, never FK-references templates | Template edits must not rewrite history |
| D14 | Cont. session | `configuration_templates` = JSONB preset table (migration `0010`); JSONB for preset + snapshot, application-validated, structure defined by ruleset version | Written once, read for replay, never queried relationally |
| D15 | P67–71 | Ruleset owns game limits (max darts per turn, score caps) — not DB CHECK constraints | Rules vary per ruleset version |
| D16 | P46–47 | Controlled denormalisation allowed when query-critical: `turns.total_score` + `darts.score` (app controls writes) | Measured pragmatism over purity |
| D17 | P59–63 | `display_name` lives on `players`; no separate `player_profiles` table | YAGNI for solo-operator v1 |

### D187 — A single is two stored bands, not one zone
Status: Accepted · Date: 2026-08-05
Decision: `dart_zones` gains two rows, `INNER_SINGLE` (id 7, 15.9–97mm) and `OUTER_SINGLE` (id 8, 107–162mm), on top of D06's original six. Coordinate capture (`classify(x, y)`) always resolves a single to one of these two bands and never returns the bare `SINGLE` value. `SINGLE` is retained, not removed: keypad capture has no coordinate and genuinely cannot know which band was hit, so it keeps recording the unbanded value rather than fabricating a band.
Reason: "Missed high/low/left/right of T20" is unanswerable without knowing which side of the treble ring a dart landed on, and `zoneCentroid` could not answer for `SINGLE` at all — it had no single centre to name across two disjoint bands. Storing the band as two zone rows (rather than deriving it ad hoc at query time) keeps the fact log the single source of truth for what happened, per D01.
Consequences: `zoneCentroid` now answers for `INNER_SINGLE` and `OUTER_SINGLE` (their band midpoints) and still returns `null` for bare `SINGLE`. Any engine that keys scoring logic on the literal `"SINGLE"` string (e.g. Singles Training) must also match `INNER_SINGLE`/`OUTER_SINGLE`, or a visual-capture dart in either band silently scores zero. `dart_zones` ids 1–6 are unchanged and still referenced by live `darts.hit_zone_id` values; 7 and 8 are additive only.

### D190 — `clientKey` is a transient token, not an entity id
Status: Accepted · Date: 2026-08-05
Decision: game engines mint stage/turn `clientKey`s with `crypto.randomUUID()` (UUIDv4) via the named `newClientKey()` helper in `app/src/modules/game/client-key.module.ts`, and this is correct. D12's "UUIDv7 for domain entities" governs `generateId()` in `app/src/lib/id.ts`, which mints every persisted id — activities, sessions, configurations, participants, stages, turns and darts. A `clientKey` is not an id: it exists only so a batch payload can point its turns at their stage before either is persisted, and `session.service.ts` maps each one to a real UUIDv7 at write time. It never reaches a database column.
Reason: the bare `crypto.randomUUID()` call sites read as a D12 violation to every reader who met them — during the visual-board branch's review it was flagged as one twice, by an implementer and by a reviewer, before being traced. Naming the helper and stating the distinction costs one file and removes a recurring false alarm. Reaching for `generateId()` here would be worse than the confusion: it would imply the value is an entity id and invite a future change to persist it.
Consequences: `app/tests/modules/game/client-key.module.test.ts` asserts `generateId()` carries version nibble 7 and sorts in creation order, and mechanically guards that no file under `src/services/` or `src/repositories/` calls `crypto.randomUUID()` — that is the path by which a v4 could reach `turns.id` or `darts.id`. Client-supplied `idempotencyKey`s remain UUIDv4 by API contract and are out of D12's scope for the same reason.
