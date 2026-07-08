# Context Summary — Prompts 16–20

**Handoff note:** This phase introduces training routines, abandons over-abstraction, stabilizes the domain model, and transitions from chat brainstorming into formal architecture documentation. Builds on `001_context.md` and `002_context.md`.

**Formal outputs:** The logical ERD, physical schema, migrations, indexes, views, and design rules produced from this phase live in `architecture/docs/`. This file captures only the conversational history and decisions that led to those documents — not their contents.

---

## New Requirements (Prompt 16)

Two features surfaced that were not in the original scope:

1. **Pre-configured training routines** — timed sequences of multiple exercises (e.g. 15 min warm-up → 15 min singles → scoring → doubles).
2. **User-defined routines** — custom compositions of multiple game modes with their own configurations.

**Game engine location confirmed:** TypeScript in the frontend. Backend as persistence/query layer for now. Structured API payloads (not arbitrary SQL-like data) to keep the door open for future server-side validation. Engine can move to backend later if needed.

---

## Major Architectural Pivot: Activity Session

Training routines revealed that **game session was not the top-level concept**.

```
Player → Activity Session → Exercise Session(s)
```

An activity session is one continuous play period: casual evening, predefined routine, custom routine, or (future) league/tournament night. Enables training duration, routine effectiveness, and daily activity analytics that isolated game rows cannot support.

**Template → Instance pattern** identified as recurring:

| Template | Instance |
|----------|----------|
| Routine Template | Activity Session |
| Game Configuration Template | Exercise Configuration |

---

## Major Architectural Pivot: Game → Exercise

Singles Training, Score Training, and TUOD are **exercises**, not competitive games. 501 is both. Modeling everything as an **Exercise Session** makes all engines equal and routines natural.

**Renamed:** `Game Session` → `Exercise Session` (confirmed by client).

**Separated:** "Game" (competitive) vs "Exercise" (training activity implemented by a game engine).

---

## Abandoned: Universal `game_progress`

Prompt 15 favored a generic `game_progress` parent with game-specific children. Prompt 16–17 challenged the smallest meaningful progress unit per game type:

| Engine | Smallest unit of progress |
|--------|---------------------------|
| 501 | Dart (within leg/set hierarchy) |
| TUOD | Target |
| Singles | Dart |
| Score Training | Dart |

Conclusion: "Progress" is not a shared domain concept — leg, target, and round are **different semantics**, not one abstraction. Forcing them into one table was over-abstraction.

**Adopted:** Game-specific hierarchy tables linked directly to exercise session. No shared progress parent.

```
exercise_session
    ├── x01_sets → x01_legs → turns
    ├── tuod_targets → turns
    ├── singles_targets → turns
    └── score_training_rounds → turns
```

**Removed:** `Exercise Structure` as an ERD entity. It remains a design concept only — the physical model uses explicit per-game tables.

---

## Stabilized Domain Hierarchy

After prompts 17–20, the model was considered stable (~95% complete):

```
User (Neon Auth — not designed here)
    ↓
Player
    ↓
Activity Session
    ↓
Exercise Session (+ Configuration, Participants)
    ↓
[Game-specific structure tables]
    ↓
Turn
    ↓
Dart
```

**Three universal concepts** at the core:

1. **Activity** — why is the player playing?
2. **Exercise Session** — which engine is active?
3. **Dart** — what actually happened?

Everything else is scaffolding or game-specific context.

**Dart reframed** as an **observation** (intended, actual, conditions, context, outcome) — not merely a score child of a turn.

---

## Turn: Physical Action, Not Game Mechanic

Client clarified a domain rule that resolved lingering doubt about the Turn entity:

> A player always walks to the oche, throws up to three darts, retrieves them.

This applies universally — 501, TUOD, Singles, Score Training, and future games (Cricket, precision training). Even when one turn spans multiple targets (e.g. precision training: 3 darts at 3 different targets), it is still one turn.

**Renamed:** Visit → Turn (carried forward from Prompt 15).

Turn stores game state (`score_before`, `score_after`, `bust`). Early checkout: no placeholder third dart.

---

## Routine Steps: Completion Conditions

Client asked whether routine steps need `duration_type` / `duration_unit` for rounds vs timed modes.

**Generalized to:**

```
completion_type  +  completion_value
```

Examples: `ROUNDS/10`, `MINUTES/15`, `LEGS/5`, `TARGETS/20`, `UNTIL_SUCCESS/NULL`.

"Duration" was too narrow — steps define **completion conditions**, not just time. Extensible to future conditions (e.g. until 10 checkouts, until average > 60) without schema redesign.

---

## Activity Session: Always Created

Client agreed every exercise should belong to an activity — even a standalone 501 where the user opens and closes the app. Rationale:

- Uniform lifecycle for standalone games and routines
- App usage monitoring (development statistics)
- Foundation for future cloud sync and coaching

Analogous to a "workout" in fitness apps.

---

## Physical Design Decisions (Confirmed)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Primary keys | UUIDv7 everywhere | Offline sync, distributed IDs, time-ordered to avoid v4 index fragmentation |
| Timestamps | `TIMESTAMPTZ NOT NULL` everywhere | PostgreSQL best practice; store UTC |
| Immutability | Writes only in CREATED / IN_PROGRESS / PAUSED | Once COMPLETED: no edits to darts, turns, or configuration. Corrections via admin revision, not mutation |
| Reference data | Lookup tables (`game_types`, etc.) | DB owns referential integrity and metadata; not hardcoded TypeScript enums |
| Auth | Neon Auth | `users` table not designed; never reference outside identity layer |

**Three table categories** introduced before physical schema:

1. **Reference** — near-static (`game_types`, `capture_modes`, `input_methods`, `participant_types`, `completion_types`)
2. **Transaction** — immutable history (`activity_sessions`, `exercise_sessions`, `turns`, `darts`, `participants`)
3. **Template** — reusable definitions (`routine_templates`, `routine_steps`, configuration templates)

---

## Transition: Chat → Formal Documentation

Prompt 18 requested a full ERD with all tables, columns, keys, and indexes. Assessed as too large for chat (~20–30 tables, 250+ columns).

**Agreed staged deliverable:**

1. Complete logical ERD
2. Physical PostgreSQL schema
3. Performance design (indexes, materialized views)
4. Statistics layer (views → API mapping)
5. Future expansion review

Prompt 19 began **Phase 1 — Logical ERD** in chat. Prompt 20 refined it with client confirmations. The conversation then formalized into `architecture/docs/`:

| Doc area | Path |
|----------|------|
| Principles, system architecture, patterns | `architecture/docs/architecture/01–04-*.md` |
| Database design rules, data model, physical mapping | `architecture/docs/architecture/05-Database/` |
| SQL migrations and seeds | `architecture/docs/database/migrations/`, `seeds/` |

---

## Client Confirmations (Prompt 20)

Explicit agreement on all core entities:

- Player, Activity Session, Routine Template, Routine Step
- Exercise Session, Exercise Configuration, Participants
- Turn, Dart
- Game-specific structure tables (not a shared abstraction)
- Users isolated to auth layer
- UUIDv7, TIMESTAMPTZ, immutable completed data

---

## Open at End of Phase

**Exercise configuration** identified as the most complex remaining design topic before physical schema — key to extensible game types and configurable routines without frequent migrations. Physical schema, constraints, and indexes were deferred to the next phase (now captured in `architecture/docs/architecture/05-Database/` and migration files).

**Unresolved in chat (addressed in later prompts/docs):**

- Exact exercise configuration table structure per game type
- Session lifecycle events table
- Dart outcome classification (board miss, bounce-out, not thrown)
- Where game logic validation boundaries sit given frontend-owned engine

---

## Supersedes from Earlier Context

| Earlier (001/002) | Revised (003) |
|-------------------|---------------|
| `game_sessions` | `exercise_sessions` |
| Generic `game_progress` | Per-game structure tables |
| `Exercise Structure` entity | Design concept only |
| `Visit` | `Turn` |
| Top level = game session | Top level = activity session |
| Game types only | Routines + exercises + games |
