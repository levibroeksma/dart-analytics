<!--
status: canonical
scope: decisions/architecture
read-when: why a domain-model/session/stage/turn/dart choice was made
load-when: domain model, activity, session, stage, turn, dart, ruleset, platform
depends-on: none
related: decisions/database.md, decisions/game-engine.md
updated: 2026-08-02
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
