# Context Summary — Prompts 21–25

**Handoff note:** This phase finalizes the configuration model, introduces the Ruleset entity, resolves ruleset–game-type coupling, and produces the first visual Mermaid ERD. Builds on `001_context.md` through `003_context.md`.

**Formal outputs:** The canonical data model, physical schema, and migrations in `architecture/docs/` incorporate refinements made after this ERD review. This file captures the conversational decisions and pivots — not the final schema definitions.

---

## Phase Objective

Close the last major conceptual gap before physical PostgreSQL design: **how configuration is modeled, versioned, and snapshotted per session**.

---

## Configuration Purpose (Established)

A configuration answers one question only:

> "How was this exercise supposed to be played?"

It must **not** contain: current score, progress, statistics, or results. Those live elsewhere. Configuration is an **immutable snapshot of rules chosen at session start**.

---

## Design Options Evaluated

| Option | Approach | Outcome |
|--------|----------|---------|
| **A** | One configuration table per game type | Strong typing; new table per game |
| **B** | Generic EAV key/value | **Rejected** — weak constraints, poor SQL, hard to validate |
| **C** | Hybrid: common parent + game-specific child tables | Initial favorite |

Configuration was later split into a **three-layer hierarchy** (see below), superseding the simple hybrid parent.

---

## Client Answers (Prompt 22)

| Topic | Decision |
|-------|----------|
| Rule changes | Fixed rulesets once defined; expansion via new modes (e.g. TUOD Beginner with 6 darts), not mutation of existing rules |
| 501 configurability | Current options (starting player, legs/sets) will grow (301/701, master out, double in, etc.) |
| Ruleset immutability | Game types extensible; **defined rulesets never change** |
| Routines | System-defined fixed routines + user-composable custom routines chaining any available game/config |
| Statistics | Derivable from darts; should work without per-game API plumbing |
| API endpoints | Undecided middle ground — per-game endpoints add coupling complexity but aid scaling |
| Capture mode | Not a formal question; addressed in Prompt 23 |

**Governing principle confirmed:**

> **Games are extensible. Rulesets are immutable.**

Not a generic game builder — a platform where the developer introduces new games/modes; historical sessions remain reproducible.

---

## Three-Layer Configuration Model (Final)

```
Game Type (what exists — engine, structure tables, derivable stats)
    ↓
Ruleset (how the engine behaves — immutable once published)
    ↓
Session Configuration (player's choices for this specific exercise)
```

**Distinction that drove the model:**

| Layer | Mutability | Example |
|-------|------------|---------|
| Game Type | Rarely | 501, TUOD, Singles — defines engine |
| Ruleset | Immutable once published; new version = new row | TUOD Classic (3 darts) vs TUOD Beginner (6 darts) |
| Session | Never (historical truth) | Timed 15 min, analytics enabled, 3 legs |

**Ruleset** was the missing piece. "Easier TUOD" is a new ruleset, not a change to TUOD.

**Session configuration** captures variable player choices within a ruleset's boundaries (timed vs rounds, capture mode, leg count).

---

## Configuration Decomposed into Three Aspects

Independent concerns within session configuration:

1. **Rule Configuration** — how the exercise is played (501 vs 301, double out)
2. **Capture Configuration** — how data is recorded (quick score vs dart-by-dart, analytics fidelity)
3. **Completion Configuration** — when the exercise ends (10 rounds, 15 minutes, first to 3 legs)

---

## Entity Decisions (Prompts 23–24)

### `game_types` — capability registry

- `is_published` for staging/dev environments (client request)
- `engine_key` decouples DB from TypeScript implementation
- `analytics_level` for future ML/AI without schema changes

### `rulesets`

- FK to `game_type_id` — **tightly coupled, 1:\***
- Immutable once published; new behavior = new ruleset/version
- `is_default`, `is_published` flags

### `player_game_preferences`

- Per-player, per-game-type defaults (preferred ruleset, capture mode, input mode)
- **UI pre-selection only** — never affects historical data
- Session stores the actual values used

### Capture mode flow (confirmed)

1. UI loads player preferences as defaults
2. User can override before starting
3. Session stores final snapshot only

Rulesets do **not** dictate capture mode.

### `exercise_session_overrides`

- Key/value with JSONB for rare per-session overrides
- Initially the **only approved JSONB use** in the system (ruleset is strictly typed; overrides are infrequent and not query-heavy)

### Routine steps

Reference `ruleset` + optional overrides — not full embedded configuration.

A routine is a **generator of sessions**, not configuration itself:

```
routine_template → routine_step(s) → activity_session → exercise_session(s)
```

### Lightweight capabilities (kept)

`game_type_capability` or column flags — backend as source of truth for what each game supports (timed, rounds, legs, analytics). **Not** a full metadata-driven configuration engine.

### Metadata-driven UI (considered, rejected)

`configuration_schema` describing dynamic form fields per game type was explored. Rejected as enterprise-level complexity unjustified for current scope. Hardcoded per-game configuration UI with DB capability validation is sufficient.

---

## Ruleset ↔ Game Type Coupling (Resolved, Prompt 24)

Initial concern: should rulesets be independent for hybrid/cross-game/AI-generated exercises?

**Resolution:** Keep rulesets strictly tied to game types. No polymorphism.

| Concept | Is it a Game Type? | Why |
|---------|-------------------|-----|
| Multi-game routine ("Pro Warm-up") | No | Orchestrates — no engine, no scoring |
| AI-generated mixed exercise sequence | No | Routine, not engine |
| TUOD Classic vs Beginner | No — these are **Rulesets** under TUOD | Same engine, different behavior |

Routines and game types remain **separate trees** that must never merge.

**Terminology locked:**

- **Ruleset** — immutable, developer-defined gameplay rules
- **Session Configuration** — player's runtime choices allowed by that ruleset

---

## API Architecture (Tentative)

Database: specialized persistence per exercise type, shared `exercise_sessions` parent.

API: **single endpoint initially**, internal dispatch to per-game services. Stable public contract; split internals later if one game grows complex. Client had no firm preference — acknowledged as app architecture, not DB design.

---

## First Visual ERD — Mermaid (Prompt 25)

First Mermaid diagram produced in chat. Backbone entities:

```
Identity:     PLAYER, PLAYER_GAME_PREFERENCE
Reference:    GAME_TYPE, GAME_TYPE_CAPABILITY, RULESET
Templates:    ROUTINE_TEMPLATE, ROUTINE_STEP
Runtime:      ACTIVITY_SESSION, EXERCISE_SESSION, EXERCISE_CONFIGURATION, PARTICIPANT
Gameplay:     TURN, DART
Structures:   X01_SET, X01_LEG, TUOD_TARGET, SINGLES_TARGET, SCORE_ROUND
```

Self-review rated **8.5/10**. Four gaps identified before physical schema:

### 1. `EXERCISE_CONFIGURATION` — revert JSONB

Initial approval of JSONB for overrides; full ERD review reversed this for the main config. Adopt per-game child tables (`x01_configuration`, `tuod_configuration`, etc.) — same pattern as game structures. Proper types, CHECK constraints, no JSON parsing.

### 2. `TURN.structure_id` — too polymorphic

Turn parent differs per game (leg, target, round). Nullable polymorphic FK rejected. Proposed `exercise_stage` abstraction table mapping game-specific structures — to be designed in physical model.

### 3. Missing resume enforcement

Requirement from earlier phase: one active session per game type per player. Proposed dedicated concept (e.g. `ACTIVITY_RESUME_STATE`) with partial unique index — not bolted onto `exercise_session` alone.

### 4. Missing `ROUTINE_RUN`

Insert between template and activity session for routine execution metrics (completion %, personal best, abandoned routines, duration). Supports pausing/resuming routines independently of activity.

**Next stated goal:** Eliminate remaining generic/polymorphic relationships; reach 9.8+/10 before PostgreSQL DDL.

---

## Change Log vs 003_context.md

| Earlier | Revised in 21–25 |
|---------|----------------|
| Exercise configuration as split child tables only | Three-layer: game_type → ruleset → session config |
| `completion_type` on routine steps | Routine steps reference ruleset + overrides |
| Capture mode on session only | Player preferences as default + per-session override |
| Ruleset concept absent | Ruleset as first-class immutable entity |
| `exercise_session_overrides` JSONB | Main config → typed tables; JSONB only for rare overrides (then main config also moved to typed tables in ERD review) |

---

## Open at End of Phase

- `exercise_stage` abstraction for turn parent linkage
- `ROUTINE_RUN` entity design
- `ACTIVITY_RESUME_STATE` / resume model
- Physical ERD: UUIDv7 generation strategy, ENUM vs lookup tables, FK cascade rules, partial indexes
- API endpoint strategy still unsettled

---

## Next Phase (agreed)

Physical ERD / PostgreSQL schema — table definitions, constraints, indexes, migration plan. Visual ERD refinements and Neon-ready DDL (addressed in subsequent prompts and `architecture/docs/`).
