# Context Summary — Prompts 11–15

**Handoff note:** Continuation of architectural research. This phase moves from requirements into conceptual and logical ERD design, with iterative refinement based on client feedback. Builds on decisions documented in `001_context.md`.

---

## Phase Objective

Transition from brainstorming to production-grade schema design:

1. Conceptual ERD (business concepts, not PostgreSQL tables)
2. Logical ERD (tables, relationships, constraints)
3. Physical schema (deferred — next phase)

---

## Conceptual ERD (v1)

**Rejected:** Generic `Phase` entity — semantics differ too much across games (leg vs round vs target).

**Adopted hierarchy:**

```
User → Player → Game Session
                    ├── Session Configuration
                    ├── Participant
                    └── Visit → Dart
```

**Entity responsibilities:**

| Entity | Role |
|--------|------|
| **User** | Auth only (email, OAuth, subscription, preferences). No gameplay data. **Neon Auth** will be used — custom auth design not required. |
| **Player** | Dart player identity. All statistics belong here. 1:1 with user. |
| **Game Session** | Heart of the model. One played instance (501 match, TUOD session, etc.). Holds status, game type, capture mode, input method, timestamps. |
| **Session Configuration** | Immutable snapshot of rules/settings active at session start. One per session. |
| **Participant** | Future-proofing for opponents. Roles: SELF, GUEST, BOT, ONLINE_PLAYER. Guests need no user account. Replaces storing opponent directly on session. |
| **Visit** | One turn (up to 3 darts). Exists across all game types. |
| **Dart** | Atomic fact. Foundation of all analytics. |

**Intentionally excluded from ERD:** Statistics, averages, checkout %, win rate, progress graphs — all computed via views.

**Rejected patterns:** Separate table per game type (at core level); JSONB as primary configuration storage. Hybrid acceptable: relational columns for common config, JSONB only for genuinely game-specific extensions.

**Identified gap:** Game-specific progression layer above visits (e.g. `x01_legs`, `tuod_rounds`, `singles_targets`) — semantics differ, but all relate back to `game_session`.

---

## Logical ERD Evolution

### Removed: `game_events` table

Initially proposed for transitions (Leg Started, Bust, etc.). Removed — duplicate source of truth. Domain entities (darts, visits, progress units, session timestamps) already represent gameplay. Exception re-introduced later for **session lifecycle events only** (see below).

### Adopted: `game_progress` (generic progression unit)

Single parent table for ordered logical segments above turns:

| Game | Progress unit |
|------|---------------|
| 501 | Leg |
| TUOD | Round |
| Singles | Target |
| Cricket (future) | Turn |

Meaning determined by `game_type`; database stores sequence and kind, not game-specific semantics in the parent row.

**Preferred implementation (hybrid — Option C):**

```
game_progress (id, session_id, sequence, progress_kind)
    ├── x01_progress (leg_number, set_number)
    ├── tuod_progress (target_value)
    ├── singles_progress (required_target)
    └── [future game-specific child tables]
```

Avoids UNION queries across separate per-game tables while preserving strong domain constraints in child tables.

**Confidence:** 60/40 favoring generic parent + specialized children over fully separate or fully generic approaches.

### Renamed: Visit → Turn

"Visit" is 501-centric. **Turn** is the universal concept: a player's scoring opportunity (up to 3 darts). Applies to 501 alternation, Singles Training targets, and future game types.

**Revised hierarchy:**

```
Player → Game Session → Progress Unit → Turn → Dart
```

Only session and configuration levels are game-aware. Everything below is time-ordered facts.

### Split: Session configuration

Rejected single wide table with many nullable columns.

**Adopted:**

```
session_configuration (base: timed, duration_seconds, round_limit, …)
    ├── x01_configuration (starting_score, double_out, sets, legs)
    ├── tuod_configuration (starting_target, increment, decrement)
    ├── singles_configuration (…)
    └── score_training_configuration (…)
```

New game types add a child table, not nullable columns to a shared table.

**EAV pattern** (configuration_options + session_configuration_values) identified as future option if config options proliferate. Deferred — current set is small and stable.

### Participants table

```
participant (session_id, participant_role, participant_type, player_id?, display_name?, bot_difficulty?, won)
```

Supports solo, guest, bot today; online multiplayer, doubles, leagues later without redesign.

### Darts table (richest entity)

Core factual columns (most nullable for low-fidelity sessions):

```
visit_id, sequence, intended_segment, intended_multiplier,
actual_segment, actual_multiplier, score,
checkout_attempt, miss_direction, miss_distance,
entered_method, created_at
```

**Removed:** `checkout_success` — derivable from `checkout_attempt` + visit ending state.

**Open items:** Outcome classification for complete board miss, bounce-out, and dart-not-thrown (early checkout). Not yet modeled.

### Visits/Turns — stored game state

`starting_score` and `ending_score` stored on turn rows. These are **game state**, not analytics. Avoids recomputing on every replay/API read. Storage cost negligible.

**Early checkout / bust:** No placeholder third dart. Dart count per turn is authoritative.

### Catalog: lookup tables over enums

`game_types`, `capture_modes`, `input_methods` as reference tables with FK constraints — not PostgreSQL enums. Enables admin UI, translations, documentation.

### Session metadata

| Field | Decision |
|-------|----------|
| `app_version` | Include — aids replay/debug bug reports |
| `schema_version` | Include — zero overhead safety valve for future replay semantics changes. Client has no current plan to change replay logic. |

---

## Design Constitution (v1)

| Principle | Decision |
|-----------|----------|
| Source of truth | Individual darts |
| Statistics | SQL views / materialized views only |
| Replayability | Every recorded session reconstructible |
| Extensibility | New games = new data, not redesign |
| Normalization | 3NF; denormalize only when profiling proves benefit |
| Immutability | Finished sessions append-only (admin corrections excepted) |
| Performance | Indexes and views, not duplicated aggregate columns |

---

## Session Lifecycle (revised)

Session is a **lifecycle**, not just a final result.

**State machine:**

```
CREATED → IN_PROGRESS → PAUSED → COMPLETED
                              → ABANDONED
```

**Removed:** `CRASHED` — browser crash is not a business concept; session remains `IN_PROGRESS`.

**Resume requirement:**

- **Now:** Persist and resume after browser refresh
- **Future:** Resume after tab close, device restart, next day

**Constraint:** At most **one active session per game type per player**. Enforced in database via partial unique index:

```sql
UNIQUE (player_id, game_type_id)
WHERE status IN ('CREATED', 'IN_PROGRESS', 'PAUSED')
```

**Session lifecycle events** (narrow re-introduction): Session Created, Resumed, Paused, Completed — for debugging, sync, future features. Not a replacement for dart/turn/progress entities.

---

## Write Pattern (confirmed)

**Not** per-dart API calls during gameplay (tried previously — too slow).

```
Game start → Alpine.js in-memory state → Game finish → Single batch API upload → Persist full session
```

`starting_score`/`ending_score` storage is a **database replay optimization**, unrelated to API call frequency.

---

## Analytics Strategy (confirmed direction)

Client uncertain on exact future granularity but prefers **robust foundation now** over retrofitting later.

Design principle shift:

> "What facts can never be reconstructed later if we don't store them now?"

Treat `darts` as primary analytical entity (near-telemetry). Optimize schema, indexing, and constraints around dart-level facts. Enables session-, progress-, turn-, and dart-level analytics without schema changes.

**Planned views (non-exhaustive):** `vw_player_averages`, `vw_player_checkouts`, `vw_player_heatmap`, `vw_progression`, `vw_monthly_improvement`, `vw_target_accuracy`, `vw_doubles`, `vw_first9`, `vw_scoring_power`, `vw_finish_patterns`. API should query views for statistics, not raw tables.

---

## Unresolved Items (end of Prompt 15)

| Area | Status |
|------|--------|
| `game_progress` hybrid pattern | Favored; needs final validation |
| Dart outcome classification | Miss / bounce-out / not-thrown — not yet designed |
| EAV configuration | Deferred unless config options proliferate |
| Game logic location | Open question: frontend only, proxy API, shared TypeScript engine, or DB-computed rules. Affects how much validation/replay logic lives in schema vs application. |

---

## Next Design Phase (agreed)

1. One more logical design iteration — challenge every nullable column, FK, abstraction, cardinality, and migration path
2. Physical PostgreSQL schema: column types, PKs/FKs, check constraints, generated columns, indexes, view vs materialized view strategy
