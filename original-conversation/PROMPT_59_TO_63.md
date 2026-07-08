## Prompt

We agreed earlier that since reference tables will stay small, we would go for SMALLINT ID's rather than UUID.

apply, than draft 0003_players.sql

## Response

Good. This is exactly the type of dependency correction that should happen before moving forward.

We discovered that `player_settings` depends on two controlled reference concepts:

- **capture mode** → whether the user wants detailed analytics capture or recreational capture.
- **input mode** → how the user enters darts.

These belong in the reference layer because:

- they are application-controlled values,
- they are small,
- they should not become user-generated data,
- they are reused across multiple domains.

We will therefore update `0002_reference_tables.sql`.

---

# Revised `database/migrations/0002_reference_tables.sql`

Changes from previous version:

Added:

- `capture_modes`
- `input_modes`

Also applied the agreed identifier strategy:

| Table type      | ID       |
| --------------- | -------- |
| Domain entity   | UUIDv7   |
| Reference table | SMALLINT |

---

```sql
-- ============================================================
-- Migration: 0002_reference_tables.sql
--
-- Purpose:
-- Create stable reference layer tables.
--
-- Contains:
-- - game definitions
-- - feature definitions
-- - status definitions
-- - capture modes
-- - input modes
-- - ruleset versions
--
-- Reference tables use SMALLINT identifiers.
--
-- Domain entities use UUIDv7.
--
-- ============================================================


BEGIN;


-- ============================================================
-- game_types
--
-- Defines available dart games.
--
-- This is NOT a lookup table.
-- Games are domain entities.
--
-- ============================================================

CREATE TABLE game_types (

    id UUID PRIMARY KEY,

    implementation_key TEXT NOT NULL,

    name TEXT NOT NULL,

    description TEXT,

    is_published BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL,

    updated_at TIMESTAMPTZ NOT NULL,


    CONSTRAINT uq_game_types_implementation_key
        UNIQUE (implementation_key)

);


COMMENT ON TABLE game_types IS
'Defines available dart game implementations.';



-- ============================================================
-- game_features
--
-- Controlled list of supported game capabilities.
--
-- Examples:
-- - timed_mode
-- - rounds_mode
-- - opponent_support
--
-- ============================================================

CREATE TABLE game_features (

    id SMALLINT PRIMARY KEY,

    implementation_key TEXT NOT NULL,

    name TEXT NOT NULL,

    description TEXT,

    created_at TIMESTAMPTZ NOT NULL,

    updated_at TIMESTAMPTZ NOT NULL,


    CONSTRAINT uq_game_features_implementation_key
        UNIQUE (implementation_key)

);



COMMENT ON TABLE game_features IS
'Defines reusable capabilities supported by game types.';



-- ============================================================
-- game_type_features
--
-- Many-to-many relationship between games and features.
--
-- ============================================================

CREATE TABLE game_type_features (

    game_type_id UUID NOT NULL,

    game_feature_id SMALLINT NOT NULL,

    created_at TIMESTAMPTZ NOT NULL,


    PRIMARY KEY (
        game_type_id,
        game_feature_id
    ),


    CONSTRAINT fk_game_type_features_game_type
        FOREIGN KEY (game_type_id)
        REFERENCES game_types(id)
        ON DELETE CASCADE,


    CONSTRAINT fk_game_type_features_feature
        FOREIGN KEY (game_feature_id)
        REFERENCES game_features(id)
        ON DELETE CASCADE

);



COMMENT ON TABLE game_type_features IS
'Defines features available for each game type.';



-- ============================================================
-- game_statuses
--
-- Lifecycle states.
--
-- Examples:
-- ACTIVE
-- COMPLETED
-- ABANDONED
--
-- ============================================================

CREATE TABLE game_statuses (

    id SMALLINT PRIMARY KEY,

    implementation_key TEXT NOT NULL,

    name TEXT NOT NULL,

    description TEXT,

    created_at TIMESTAMPTZ NOT NULL,


    CONSTRAINT uq_game_statuses_implementation_key
        UNIQUE (implementation_key)

);



COMMENT ON TABLE game_statuses IS
'Defines lifecycle states for runtime entities.';



-- ============================================================
-- capture_modes
--
-- Defines data collection depth.
--
-- Examples:
-- recreational
-- analytics
--
-- ============================================================

CREATE TABLE capture_modes (

    id SMALLINT PRIMARY KEY,

    implementation_key TEXT NOT NULL,

    name TEXT NOT NULL,

    description TEXT,

    created_at TIMESTAMPTZ NOT NULL,


    CONSTRAINT uq_capture_modes_implementation_key
        UNIQUE (implementation_key)

);



COMMENT ON TABLE capture_modes IS
'Defines how much gameplay detail is captured.';



-- ============================================================
-- input_modes
--
-- Defines user interaction style.
--
-- Examples:
-- quick_score
-- detailed_darts
--
-- ============================================================

CREATE TABLE input_modes (

    id SMALLINT PRIMARY KEY,

    implementation_key TEXT NOT NULL,

    name TEXT NOT NULL,

    description TEXT,

    created_at TIMESTAMPTZ NOT NULL,


    CONSTRAINT uq_input_modes_implementation_key
        UNIQUE (implementation_key)

);



COMMENT ON TABLE input_modes IS
'Defines available dart input methods.';



-- ============================================================
-- ruleset_versions
--
-- Immutable rule versions.
--
-- Historical sessions reference the exact ruleset used.
--
-- ============================================================

CREATE TABLE ruleset_versions (

    id UUID PRIMARY KEY,


    game_type_id UUID NOT NULL,


    implementation_key TEXT NOT NULL,


    version_number INTEGER NOT NULL,


    description TEXT,


    created_at TIMESTAMPTZ NOT NULL,


    CONSTRAINT fk_ruleset_versions_game_type
        FOREIGN KEY (game_type_id)
        REFERENCES game_types(id)
        ON DELETE RESTRICT,


    CONSTRAINT uq_ruleset_versions_key
        UNIQUE (
            game_type_id,
            implementation_key
        ),


    CONSTRAINT uq_ruleset_versions_number
        UNIQUE (
            game_type_id,
            version_number
        )

);



COMMENT ON TABLE ruleset_versions IS
'Immutable game rule versions used for historical replay.';



COMMIT;

```

---

# Validation after revision

Dependency chain now works:

```
0002_reference_tables.sql

        |
        |
        +-- capture_modes
        |
        +-- input_modes


0003_players.sql

        |
        |
        +-- player_settings

```

No forward references remain.

---

# `database/migrations/0004_game_definitions.sql`

This migration creates the game definition layer.

Important distinction:

`game_types` defines **what games exist**.

This migration adds:

- initial game registrations,
- feature associations,
- initial ruleset versions.

This is technically seed data, but it is **domain reference data**, not test data.

Keeping it separate from schema is cleaner.

---

One architectural question before writing this migration:

Should `0004_game_definitions.sql`:

### Option A — Insert current games directly

Example:

```
501
tuod
singles_training
score_training

```

Advantages:

- database is immediately usable
- simpler deployment

---

### Option B — Keep all reference data in a separate seeds folder

Example:

```
database/
 ├── migrations/
 │    └── schema only
 │
 └── seeds/
      └── game_definitions.sql

```

Advantages:

- migrations remain schema-only
- easier environment differences
- cleaner production workflows

---

Given the architecture we defined earlier ("schema migrations should contain no data"), I recommend **Option B**.

Therefore the next file should actually be:

```
database/seeds/0001_reference_game_definitions.sql

```

not `0004_game_definitions.sql`.

The migration sequence becomes:

```
0001_extensions.sql
0002_reference_tables.sql
0003_players.sql
0004_templates.sql
0005_runtime.sql
...

```

and:

```
database/seeds/

0001_reference_data.sql

```

contains:

- game types
- statuses
- features
- capture modes
- input modes
- initial rulesets

---

Before continuing, I recommend freezing this convention:

> **Migrations create structure. Seeds create controlled data.**

This keeps the database lifecycle much cleaner.

After approval, the next actual migration would be:

```
0004_templates.sql

```

and separately:

```
seeds/0001_reference_data.sql

```

for the initial darts games.

---

## Prompt

let's go for option B

## Response

Agreed. We will freeze this convention:

> **Migrations define database structure. Seeds define controlled application data.**

This is the cleaner professional PostgreSQL approach and aligns better with:

- separate environments (development/staging/production),
- repeatable deployments,
- testing,
- AI-agent execution,
- avoiding accidental production data changes.

The final structure becomes:

```text
database/

├── migrations/
│
│   ├── 0001_extensions.sql
│   ├── 0002_reference_tables.sql
│   ├── 0003_players.sql
│   ├── 0004_templates.sql
│   ├── 0005_runtime_core.sql
│   ├── 0006_runtime_events.sql
│   ├── 0007_constraints.sql
│   ├── 0008_indexes.sql
│   └── 0009_views.sql
│
├── seeds/
│
│   ├── 0001_reference_data.sql
│   └── 0002_default_templates.sql
│
└── README.md

```

---

## Updated responsibility split

### `migrations/0002_reference_tables.sql`

Creates:

- `game_types`
- `game_features`
- `game_type_features`
- `game_statuses`
- `capture_modes`
- `input_modes`
- `ruleset_versions`

No rows inserted.

---

### `seeds/0001_reference_data.sql`

Creates initial controlled data:

### Game types

```
501
tuod
singles_training
score_training

```

---

### Features

Example:

```
TIMED_MODE
ROUNDS_MODE
OPPONENT_SUPPORT
DARTBOT_SUPPORT
DOUBLE_OUT

```

---

### Capture modes

Example:

```
RECREATIONAL
ANALYTICS

```

---

### Input modes

Example:

```
QUICK_SCORE
DETAILED_DARTS

```

---

### Statuses

Example:

```
ACTIVE
COMPLETED
ABANDONED

```

---

### Rulesets

Example:

```
501 v1

TUOD v1

Singles Training v1

```

---

## One additional improvement

Because reference data uses `SMALLINT` IDs, the seed file should **not rely on generated IDs**.

Avoid:

```sql
INSERT INTO game_statuses(name)
VALUES ('ACTIVE');

```

because IDs become environment-dependent.

Instead:

```sql
INSERT INTO game_statuses (
    id,
    implementation_key,
    name,
    created_at
)
VALUES (
    1,
    'ACTIVE',
    'Active',
    now()
);

```

This gives us:

- identical IDs across environments,
- predictable foreign keys,
- easier debugging,
- simpler AI-agent reasoning.

---

## Migration order is now frozen

The next implementation files are:

1. ✅ `0001_extensions.sql`
2. ✅ `0002_reference_tables.sql`
3. ✅ `0003_players.sql`
4. `seeds/0001_reference_data.sql`
5. `0004_templates.sql`

Before moving to templates, I would add the seed file now because it validates that the reference model is actually sufficient.

So the next artifact should be:

```
database/seeds/0001_reference_data.sql

```

After that we continue with:

```
database/migrations/0004_templates.sql

```

This keeps the implementation order aligned with the dependency graph.

---

## Prompt

ok, first draft database/seeds/0001_reference_data.sql, than database/migrations/0004_templates.sql

## Response

Good. This is the correct implementation order.

The seed file is not "test data". It is **controlled domain data** required for the application to function.

A useful distinction:

| Type                               | Location       | Example                   |
| ---------------------------------- | -------------- | ------------------------- |
| Database structure                 | migrations     | `CREATE TABLE game_types` |
| Controlled application definitions | seeds          | `501`, `TUOD`, `ACTIVE`   |
| User generated data                | runtime tables | played sessions           |

The seed file must be:

- deterministic,
- idempotent,
- environment-independent.

Therefore we use:

```sql
INSERT ... ON CONFLICT DO NOTHING

```

and explicit IDs.

---

# `database/seeds/0001_reference_data.sql`

```sql
-- ============================================================
-- Seed: 0001_reference_data.sql
--
-- Purpose:
-- Insert controlled application reference data.
--
-- This data is required for the application to function.
--
-- Seed data uses fixed identifiers to guarantee
-- consistency across environments.
--
-- ============================================================


BEGIN;


-- ============================================================
-- Game statuses
-- ============================================================

INSERT INTO game_statuses (
    id,
    implementation_key,
    name,
    description,
    created_at
)
VALUES
(
    1,
    'ACTIVE',
    'Active',
    'Session is currently in progress.',
    now()
),
(
    2,
    'COMPLETED',
    'Completed',
    'Session completed successfully.',
    now()
),
(
    3,
    'ABANDONED',
    'Abandoned',
    'Session was started but not completed.',
    now()
)
ON CONFLICT (id) DO NOTHING;



-- ============================================================
-- Capture modes
-- ============================================================

INSERT INTO capture_modes (
    id,
    implementation_key,
    name,
    description,
    created_at
)
VALUES
(
    1,
    'RECREATIONAL',
    'Recreational',
    'Stores gameplay with minimal required detail.',
    now()
),
(
    2,
    'ANALYTICS',
    'Analytics',
    'Stores detailed dart-level information.',
    now()
)
ON CONFLICT (id) DO NOTHING;



-- ============================================================
-- Input modes
-- ============================================================

INSERT INTO input_modes (
    id,
    implementation_key,
    name,
    description,
    created_at
)
VALUES
(
    1,
    'QUICK_SCORE',
    'Quick Score',
    'Fast score entry without individual dart capture.',
    now()
),
(
    2,
    'DETAILED_DARTS',
    'Detailed Darts',
    'Individual dart entry for analytics.',
    now()
)
ON CONFLICT (id) DO NOTHING;



-- ============================================================
-- Game features
-- ============================================================

INSERT INTO game_features (
    id,
    implementation_key,
    name,
    description,
    created_at,
    updated_at
)
VALUES
(
    1,
    'TIMED_MODE',
    'Timed Mode',
    'Game can be configured using a countdown timer.',
    now(),
    now()
),
(
    2,
    'ROUNDS_MODE',
    'Rounds Mode',
    'Game can be configured using a fixed amount of rounds.',
    now(),
    now()
),
(
    3,
    'OPPONENT_SUPPORT',
    'Opponent Support',
    'Game supports opponents.',
    now(),
    now()
),
(
    4,
    'DARTBOT_SUPPORT',
    'DartBot Support',
    'Game supports AI opponents.',
    now(),
    now()
),
(
    5,
    'DOUBLE_OUT',
    'Double Out',
    'Game requires finishing on a double.',
    now(),
    now()
)
ON CONFLICT (id) DO NOTHING;



-- ============================================================
-- Game types
-- ============================================================

INSERT INTO game_types (
    id,
    implementation_key,
    name,
    description,
    is_published,
    created_at,
    updated_at
)
VALUES
(
    '0198f000-0000-7000-8000-000000000001',
    '501',
    '501',
    'Standard 501 darts game.',
    TRUE,
    now(),
    now()
),
(
    '0198f000-0000-7000-8000-000000000002',
    'TUOD',
    'Ten Up One Down',
    'Progressive target training game.',
    TRUE,
    now(),
    now()
),
(
    '0198f000-0000-7000-8000-000000000003',
    'SINGLES_TRAINING',
    'Singles Training',
    'Singles accuracy training.',
    TRUE,
    now(),
    now()
),
(
    '0198f000-0000-7000-8000-000000000004',
    'SCORE_TRAINING',
    'Score Training',
    'Scoring practice exercise.',
    TRUE,
    now(),
    now()
)
ON CONFLICT (id) DO NOTHING;



-- ============================================================
-- Game feature mappings
-- ============================================================


-- 501

INSERT INTO game_type_features (
    game_type_id,
    game_feature_id,
    created_at
)
VALUES
(
    '0198f000-0000-7000-8000-000000000001',
    3,
    now()
),
(
    '0198f000-0000-7000-8000-000000000001',
    4,
    now()
),
(
    '0198f000-0000-7000-8000-000000000001',
    5,
    now()
),


-- TUOD

(
    '0198f000-0000-7000-8000-000000000002',
    1,
    now()
),
(
    '0198f000-0000-7000-8000-000000000002',
    2,
    now()
),


-- Singles

(
    '0198f000-0000-7000-8000-000000000003',
    1,
    now()
),
(
    '0198f000-0000-7000-8000-000000000003',
    2,
    now()
),


-- Score training

(
    '0198f000-0000-7000-8000-000000000004',
    1,
    now()
),
(
    '0198f000-0000-7000-8000-000000000004',
    2,
    now()
)

ON CONFLICT DO NOTHING;



-- ============================================================
-- Ruleset versions
-- ============================================================

INSERT INTO ruleset_versions (
    id,
    game_type_id,
    implementation_key,
    version_number,
    description,
    created_at
)
VALUES
(
    '0198f100-0000-7000-8000-000000000001',
    '0198f000-0000-7000-8000-000000000001',
    '501_V1',
    1,
    'Initial 501 ruleset.',
    now()
),
(
    '0198f100-0000-7000-8000-000000000002',
    '0198f000-0000-7000-8000-000000000002',
    'TUOD_V1',
    1,
    'Initial Ten Up One Down ruleset.',
    now()
),
(
    '0198f100-0000-7000-8000-000000000003',
    '0198f000-0000-7000-8000-000000000003',
    'SINGLES_V1',
    1,
    'Initial Singles Training ruleset.',
    now()
),
(
    '0198f100-0000-7000-8000-000000000004',
    '0198f000-0000-7000-8000-000000000004',
    'SCORE_TRAINING_V1',
    1,
    'Initial Score Training ruleset.',
    now()
)
ON CONFLICT (id) DO NOTHING;


COMMIT;

```

---

# Review before continuing

One important observation surfaced while writing this:

The seed file currently assumes:

```text
game_type
    |
    |
ruleset_version

```

but it does not yet include **game configuration defaults**.

That is correct.

Defaults belong in the template/configuration layer, not reference data.

Example:

Bad:

```
501 default = 3 legs

```

inside game_types.

Good:

```
501 game type exists

↓

default 501 training template

↓

configuration:
legs = 3
sets = 1
double_out = true

```

This preserves flexibility.

---

# `database/migrations/0004_templates.sql`

Next we create the template layer.

This contains:

- exercise templates
- routine templates
- routine steps
- reusable configurations

No actual routines are inserted yet.

Those belong later in:

```text
database/seeds/0002_default_templates.sql

```

---

```sql
-- ============================================================
-- Migration: 0004_templates.sql
--
-- Purpose:
-- Create reusable training template structures.
--
-- Templates describe possible exercises.
-- They are not executed gameplay.
--
-- ============================================================


BEGIN;


-- ============================================================
-- exercise_templates
--
-- Defines reusable exercises.
--
-- Examples:
-- - Singles accuracy
-- - Score training
-- - TUOD
--
-- ============================================================

CREATE TABLE exercise_templates (

    id UUID PRIMARY KEY,


    game_type_id UUID NOT NULL,


    name TEXT NOT NULL,

    description TEXT,


    is_system_template BOOLEAN NOT NULL DEFAULT FALSE,


    created_at TIMESTAMPTZ NOT NULL,

    updated_at TIMESTAMPTZ NOT NULL,


    CONSTRAINT fk_exercise_templates_game_type
        FOREIGN KEY (game_type_id)
        REFERENCES game_types(id)
        ON DELETE RESTRICT

);



COMMENT ON TABLE exercise_templates IS
'Reusable exercise definitions.';



-- ============================================================
-- routine_templates
--
-- Defines composed training routines.
--
-- ============================================================

CREATE TABLE routine_templates (

    id UUID PRIMARY KEY,


    player_id UUID,


    name TEXT NOT NULL,


    description TEXT,


    is_system_template BOOLEAN NOT NULL DEFAULT FALSE,


    created_at TIMESTAMPTZ NOT NULL,

    updated_at TIMESTAMPTZ NOT NULL,


    CONSTRAINT fk_routine_templates_player
        FOREIGN KEY (player_id)
        REFERENCES players(id)
        ON DELETE CASCADE

);



COMMENT ON TABLE routine_templates IS
'Composable training routines.';



-- ============================================================
-- routine_steps
--
-- Ordered exercises inside routines.
--
-- ============================================================

CREATE TABLE routine_steps (

    id UUID PRIMARY KEY,


    routine_template_id UUID NOT NULL,


    exercise_template_id UUID NOT NULL,


    sequence_number INTEGER NOT NULL,


    duration_type TEXT NOT NULL,


    duration_value INTEGER NOT NULL,


    created_at TIMESTAMPTZ NOT NULL,


    CONSTRAINT fk_routine_steps_routine
        FOREIGN KEY (routine_template_id)
        REFERENCES routine_templates(id)
        ON DELETE CASCADE,


    CONSTRAINT fk_routine_steps_exercise
        FOREIGN KEY (exercise_template_id)
        REFERENCES exercise_templates(id)
        ON DELETE RESTRICT

);



COMMENT ON TABLE routine_steps IS
'Ordered composition of exercises inside a routine.';



COMMIT;

```

---

## Review of `0004_templates.sql`

Before moving to runtime tables, there is one design point we should address:

`routine_steps.duration_type TEXT`

Currently:

```text
ROUNDS
TIMED

```

Earlier we discussed this.

I intentionally kept it simple here, but in PostgreSQL we should probably introduce:

```text
duration_types

```

as a SMALLINT lookup table.

Reason:

- avoids free text values,
- matches our reference data philosophy,
- prevents invalid states.

So before `0005_runtime_core.sql`, I recommend adding:

```text
duration_types

```

to `0002_reference_tables.sql`.

This is exactly the kind of dependency validation we want before the runtime layer.

---

## Prompt

give an updated version of 0002_reference_tables.sql than move on to 0005_runtime_core.sql

## Response

Good. We will add `duration_types` to the reference layer.

This confirms another design rule:

> If a value controls application behaviour and has a finite controlled set, it belongs in a reference table.

`duration_type` affects how the game engine interprets configuration, therefore it should not be free text.

We will also slightly refine the naming:

Instead of:

```sql
duration_type TEXT

```

we will use:

```sql
duration_type_id SMALLINT

```

This makes invalid states impossible.

---

# Updated `database/migrations/0002_reference_tables.sql`

Only the new section is added; existing tables remain unchanged.

The complete file now contains:

- `game_types`
- `game_features`
- `game_type_features`
- `game_statuses`
- `capture_modes`
- `input_modes`
- `duration_types`
- `ruleset_versions`

---

Add after `input_modes`:

```sql
-- ============================================================
-- duration_types
--
-- Defines how an exercise duration is measured.
--
-- Examples:
-- - ROUNDS
-- - MINUTES
--
-- Used by:
-- - routine_steps
-- - exercise configurations
--
-- ============================================================

CREATE TABLE duration_types (

    id SMALLINT PRIMARY KEY,

    implementation_key TEXT NOT NULL,

    name TEXT NOT NULL,

    description TEXT,

    created_at TIMESTAMPTZ NOT NULL,


    CONSTRAINT uq_duration_types_implementation_key
        UNIQUE (implementation_key)

);


COMMENT ON TABLE duration_types IS
'Defines supported duration measurement units.';

```

---

The corresponding seed data addition:

`database/seeds/0001_reference_data.sql`

```sql
INSERT INTO duration_types (
    id,
    implementation_key,
    name,
    description,
    created_at
)
VALUES
(
    1,
    'ROUNDS',
    'Rounds',
    'Exercise duration is measured in rounds.',
    now()
),
(
    2,
    'MINUTES',
    'Minutes',
    'Exercise duration is measured in minutes.',
    now()
)
ON CONFLICT (id) DO NOTHING;

```

---

Now `routine_steps` becomes:

```sql
duration_type_id SMALLINT NOT NULL

```

with:

```sql
FOREIGN KEY(duration_type_id)
REFERENCES duration_types(id)

```

This prevents:

```text
duration_type = "round"
duration_type = "ROUNDSS"
duration_type = "time"

```

from entering the database.

---

# `database/migrations/0005_runtime_core.sql`

Now we enter the runtime layer.

This is the most important part of the database because it stores actual gameplay history.

The design goals:

- immutable historical data,
- resumable sessions,
- replay support,
- analytics foundation,
- no coupling to UI state.

This migration creates:

- activities
- exercise_sessions
- exercise_configurations
- participants
- exercise_stages

---

```sql
-- ============================================================
-- Migration: 0005_runtime_core.sql
--
-- Purpose:
-- Create runtime gameplay entities.
--
-- Runtime data represents actual executed sessions.
--
-- ============================================================


BEGIN;


-- ============================================================
-- activities
--
-- Represents a user interaction lifecycle.
--
-- Example:
--
-- User opens app
-- Starts TUOD
-- Closes browser
-- Activity remains recoverable
--
-- ============================================================

CREATE TABLE activities (

    id UUID PRIMARY KEY,


    player_id UUID NOT NULL,


    status_id SMALLINT NOT NULL,


    started_at TIMESTAMPTZ NOT NULL,

    completed_at TIMESTAMPTZ,


    created_at TIMESTAMPTZ NOT NULL,


    CONSTRAINT fk_activities_player
        FOREIGN KEY (player_id)
        REFERENCES players(id)
        ON DELETE CASCADE,


    CONSTRAINT fk_activities_status
        FOREIGN KEY (status_id)
        REFERENCES game_statuses(id)
        ON DELETE RESTRICT

);



COMMENT ON TABLE activities IS
'Represents application usage sessions.';



-- ============================================================
-- exercise_sessions
--
-- Represents an actual played game/exercise.
--
-- ============================================================

CREATE TABLE exercise_sessions (

    id UUID PRIMARY KEY,


    activity_id UUID NOT NULL,


    player_id UUID NOT NULL,


    game_type_id UUID NOT NULL,


    capture_mode_id SMALLINT NOT NULL,


    input_mode_id SMALLINT NOT NULL,


    status_id SMALLINT NOT NULL,


    ruleset_version_id UUID NOT NULL,


    started_at TIMESTAMPTZ NOT NULL,


    completed_at TIMESTAMPTZ,


    created_at TIMESTAMPTZ NOT NULL,


    CONSTRAINT fk_sessions_activity
        FOREIGN KEY(activity_id)
        REFERENCES activities(id)
        ON DELETE CASCADE,


    CONSTRAINT fk_sessions_player
        FOREIGN KEY(player_id)
        REFERENCES players(id)
        ON DELETE CASCADE,


    CONSTRAINT fk_sessions_game_type
        FOREIGN KEY(game_type_id)
        REFERENCES game_types(id)
        ON DELETE RESTRICT,


    CONSTRAINT fk_sessions_capture_mode
        FOREIGN KEY(capture_mode_id)
        REFERENCES capture_modes(id)
        ON DELETE RESTRICT,


    CONSTRAINT fk_sessions_input_mode
        FOREIGN KEY(input_mode_id)
        REFERENCES input_modes(id)
        ON DELETE RESTRICT,


    CONSTRAINT fk_sessions_status
        FOREIGN KEY(status_id)
        REFERENCES game_statuses(id)
        ON DELETE RESTRICT,


    CONSTRAINT fk_sessions_ruleset
        FOREIGN KEY(ruleset_version_id)
        REFERENCES ruleset_versions(id)
        ON DELETE RESTRICT

);



COMMENT ON TABLE exercise_sessions IS
'Immutable gameplay execution records.';



-- ============================================================
-- exercise_configurations
--
-- Stores exact configuration snapshot used.
--
-- ============================================================

CREATE TABLE exercise_configurations (

    id UUID PRIMARY KEY,


    exercise_session_id UUID NOT NULL,


    configuration JSONB NOT NULL,


    created_at TIMESTAMPTZ NOT NULL,


    CONSTRAINT uq_exercise_configuration_session
        UNIQUE(exercise_session_id),


    CONSTRAINT fk_exercise_configuration_session
        FOREIGN KEY(exercise_session_id)
        REFERENCES exercise_sessions(id)
        ON DELETE CASCADE

);



COMMENT ON TABLE exercise_configurations IS
'Immutable configuration snapshot for replay.';



-- ============================================================
-- participants
--
-- Represents people/entities involved in a session.
--
-- Examples:
-- player
-- guest
-- dartbot
--
-- ============================================================

CREATE TABLE participants (

    id UUID PRIMARY KEY,


    exercise_session_id UUID NOT NULL,


    participant_type TEXT NOT NULL,


    player_id UUID,


    display_name TEXT,


    created_at TIMESTAMPTZ NOT NULL,


    CONSTRAINT fk_participants_session
        FOREIGN KEY(exercise_session_id)
        REFERENCES exercise_sessions(id)
        ON DELETE CASCADE,


    CONSTRAINT fk_participants_player
        FOREIGN KEY(player_id)
        REFERENCES players(id)
        ON DELETE RESTRICT

);



COMMENT ON TABLE participants IS
'Participants involved in a gameplay session.';



-- ============================================================
-- exercise_stages
--
-- Represents hierarchical subdivisions.
--
-- Examples:
--
-- 501:
-- Match
--   Set
--      Leg
--
-- Routine:
--   Exercise block
--
-- ============================================================

CREATE TABLE exercise_stages (

    id UUID PRIMARY KEY,


    exercise_session_id UUID NOT NULL,


    parent_stage_id UUID,


    stage_type TEXT NOT NULL,


    sequence_number INTEGER NOT NULL,


    created_at TIMESTAMPTZ NOT NULL,


    CONSTRAINT fk_stage_session
        FOREIGN KEY(exercise_session_id)
        REFERENCES exercise_sessions(id)
        ON DELETE CASCADE,


    CONSTRAINT fk_stage_parent
        FOREIGN KEY(parent_stage_id)
        REFERENCES exercise_stages(id)
        ON DELETE CASCADE

);



COMMENT ON TABLE exercise_stages IS
'Hierarchical structure of an executed exercise.';


COMMIT;

```

---

# Review of `0005_runtime_core.sql`

This is a major milestone. The runtime foundation is now present.

## Strong points

### ✅ Browser refresh recovery

Supported:

```
activity
    |
exercise_session
    |
configuration snapshot

```

A session can be reconstructed.

---

### ✅ Future replay

Supported:

```
session
+
ruleset version
+
configuration snapshot
+
dart events

```

---

### ✅ Analytics ready

The next migration (`0006_runtime_events.sql`) will add:

```
turns
darts

```

which unlock:

- doubles accuracy
- miss direction
- first/second/third dart finishes
- recovery analysis
- target progression

---

## One issue to resolve before `0006_runtime_events.sql`

The following columns are currently `TEXT`:

```sql
participant_type TEXT

stage_type TEXT

```

Based on our previous approach, these probably should become reference tables:

```
participant_types
stage_types

```

because they influence application logic.

I recommend adding these to the reference layer before creating event tables.

Otherwise, the runtime layer will contain uncontrolled state.

Next step should therefore be:

1. Add:

- `participant_types`
- `stage_types`

to `0002_reference_tables.sql`

1. Update `0005_runtime_core.sql`
2. Continue with:

```
0006_runtime_events.sql

```

This keeps the schema consistent with the principles we froze.

---

## Prompt

add the participant_types and stage_types to 0002 and update 0005, than move on to 0006

## Response

Agreed. This is the correct refinement.

Both `participant_type` and `stage_type` influence runtime behaviour, therefore they should follow the same rule as the other controlled values:

> Finite application-controlled states belong in reference tables.

This avoids hidden domain rules inside free text columns.

The updated dependency chain becomes:

```
0002_reference_tables.sql

    game_types
    game_features
    game_statuses
    capture_modes
    input_modes
    duration_types
    participant_types
    stage_types
    ruleset_versions


0005_runtime_core.sql

    uses:
        game_statuses
        capture_modes
        input_modes
        participant_types
        stage_types

```

---

# Addition to `database/migrations/0002_reference_tables.sql`

Add after `duration_types`.

## `participant_types`

```sql
-- ============================================================
-- participant_types
--
-- Defines entities that can participate in gameplay.
--
-- Examples:
-- PLAYER
-- GUEST
-- DARTBOT
--
-- ============================================================

CREATE TABLE participant_types (

    id SMALLINT PRIMARY KEY,

    implementation_key TEXT NOT NULL,

    name TEXT NOT NULL,

    description TEXT,

    created_at TIMESTAMPTZ NOT NULL,


    CONSTRAINT uq_participant_types_implementation_key
        UNIQUE (implementation_key)

);


COMMENT ON TABLE participant_types IS
'Defines supported participant categories.';

```

---

## `stage_types`

```sql
-- ============================================================
-- stage_types
--
-- Defines hierarchical gameplay stages.
--
-- Examples:
-- MATCH
-- SET
-- LEG
-- ROUND
-- EXERCISE_BLOCK
--
-- ============================================================

CREATE TABLE stage_types (

    id SMALLINT PRIMARY KEY,

    implementation_key TEXT NOT NULL,

    name TEXT NOT NULL,

    description TEXT,

    created_at TIMESTAMPTZ NOT NULL,


    CONSTRAINT uq_stage_types_implementation_key
        UNIQUE (implementation_key)

);


COMMENT ON TABLE stage_types IS
'Defines supported exercise hierarchy levels.';

```

---

# Seed additions

Add to:

`database/seeds/0001_reference_data.sql`

## Participant types

```sql
INSERT INTO participant_types (
    id,
    implementation_key,
    name,
    description,
    created_at
)
VALUES
(
    1,
    'PLAYER',
    'Player',
    'Authenticated application player.',
    now()
),
(
    2,
    'GUEST',
    'Guest',
    'Temporary guest opponent.',
    now()
),
(
    3,
    'DARTBOT',
    'DartBot',
    'Artificial opponent.',
    now()
)
ON CONFLICT (id) DO NOTHING;

```

---

## Stage types

```sql
INSERT INTO stage_types (
    id,
    implementation_key,
    name,
    description,
    created_at
)
VALUES
(
    1,
    'MATCH',
    'Match',
    'Complete competitive match.',
    now()
),
(
    2,
    'SET',
    'Set',
    'Collection of legs.',
    now()
),
(
    3,
    'LEG',
    'Leg',
    'Individual 501 leg.',
    now()
),
(
    4,
    'ROUND',
    'Round',
    'Training or scoring round.',
    now()
),
(
    5,
    'EXERCISE_BLOCK',
    'Exercise Block',
    'Individual routine exercise block.',
    now()
)
ON CONFLICT (id) DO NOTHING;

```

---

# Updated `0005_runtime_core.sql`

Only affected tables need modification.

---

## Updated `participants`

Replace:

```sql
participant_type TEXT NOT NULL

```

with:

```sql
participant_type_id SMALLINT NOT NULL

```

and add:

```sql
CONSTRAINT fk_participants_type
    FOREIGN KEY (participant_type_id)
    REFERENCES participant_types(id)
    ON DELETE RESTRICT

```

Result:

```sql
CREATE TABLE participants (

    id UUID PRIMARY KEY,

    exercise_session_id UUID NOT NULL,

    participant_type_id SMALLINT NOT NULL,

    player_id UUID,

    display_name TEXT,

    created_at TIMESTAMPTZ NOT NULL,


    CONSTRAINT fk_participants_session
        FOREIGN KEY(exercise_session_id)
        REFERENCES exercise_sessions(id)
        ON DELETE CASCADE,


    CONSTRAINT fk_participants_type
        FOREIGN KEY(participant_type_id)
        REFERENCES participant_types(id)
        ON DELETE RESTRICT,


    CONSTRAINT fk_participants_player
        FOREIGN KEY(player_id)
        REFERENCES players(id)
        ON DELETE RESTRICT

);

```

---

## Updated `exercise_stages`

Replace:

```sql
stage_type TEXT NOT NULL

```

with:

```sql
stage_type_id SMALLINT NOT NULL

```

and add:

```sql
CONSTRAINT fk_stage_type
    FOREIGN KEY(stage_type_id)
    REFERENCES stage_types(id)
    ON DELETE RESTRICT

```

Result:

```sql
CREATE TABLE exercise_stages (

    id UUID PRIMARY KEY,

    exercise_session_id UUID NOT NULL,

    parent_stage_id UUID,

    stage_type_id SMALLINT NOT NULL,

    sequence_number INTEGER NOT NULL,

    created_at TIMESTAMPTZ NOT NULL,


    CONSTRAINT fk_stage_session
        FOREIGN KEY(exercise_session_id)
        REFERENCES exercise_sessions(id)
        ON DELETE CASCADE,


    CONSTRAINT fk_stage_parent
        FOREIGN KEY(parent_stage_id)
        REFERENCES exercise_stages(id)
        ON DELETE CASCADE,


    CONSTRAINT fk_stage_type
        FOREIGN KEY(stage_type_id)
        REFERENCES stage_types(id)
        ON DELETE RESTRICT

);

```

---

# `database/migrations/0006_runtime_events.sql`

Now we create the actual gameplay event model.

This is the core analytics foundation.

The hierarchy becomes:

```
exercise_session

    |
    |
exercise_stage

    |
    |
turn

    |
    |
dart

```

A turn represents:

> one visit to the oche by one participant.

A dart represents:

> one physical dart thrown.

---

```sql
-- ============================================================
-- Migration: 0006_runtime_events.sql
--
-- Purpose:
-- Store gameplay events.
--
-- These tables form the analytical foundation.
--
-- ============================================================


BEGIN;


-- ============================================================
-- turns
--
-- Represents one visit to the oche.
--
-- Example:
--
-- Dart 1
-- Dart 2
-- Dart 3
--
-- ============================================================

CREATE TABLE turns (

    id UUID PRIMARY KEY,


    exercise_stage_id UUID NOT NULL,


    participant_id UUID NOT NULL,


    sequence_number INTEGER NOT NULL,


    total_score INTEGER NOT NULL DEFAULT 0,


    created_at TIMESTAMPTZ NOT NULL,


    CONSTRAINT fk_turn_stage
        FOREIGN KEY(exercise_stage_id)
        REFERENCES exercise_stages(id)
        ON DELETE CASCADE,


    CONSTRAINT fk_turn_participant
        FOREIGN KEY(participant_id)
        REFERENCES participants(id)
        ON DELETE RESTRICT

);



COMMENT ON TABLE turns IS
'Represents a single visit to the oche.';



-- ============================================================
-- darts
--
-- Atomic dart event.
--
-- One row = one thrown dart.
--
-- ============================================================

CREATE TABLE darts (

    id UUID PRIMARY KEY,


    turn_id UUID NOT NULL,


    dart_number SMALLINT NOT NULL,


    target_number SMALLINT,


    multiplier SMALLINT NOT NULL DEFAULT 1,


    score INTEGER NOT NULL DEFAULT 0,


    created_at TIMESTAMPTZ NOT NULL,


    CONSTRAINT fk_darts_turn
        FOREIGN KEY(turn_id)
        REFERENCES turns(id)
        ON DELETE CASCADE,


    CONSTRAINT chk_dart_number
        CHECK (
            dart_number BETWEEN 1 AND 3
        ),


    CONSTRAINT chk_multiplier
        CHECK (
            multiplier BETWEEN 0 AND 3
        ),


    CONSTRAINT chk_target_number
        CHECK (
            target_number IS NULL
            OR target_number BETWEEN 1 AND 25
        )

);



COMMENT ON TABLE darts IS
'Stores individual dart throws for analytics and replay.';



COMMIT;

```

---

# Review of `0006_runtime_events.sql`

This is now the highest-value part of the schema.

It enables:

## Accuracy analytics

Example:

```text
Target: Double 16

Attempts: 120

Hits: 43

Accuracy: 35.8%

```

---

## Miss analysis

Possible:

```text
D16 intended

Misses:
- D8
- S16
- outside

```

---

## Finish analysis

Possible:

```text
501 finishes:

First dart:
34%

Second dart:
48%

Third dart:
18%

```

---

## Important remaining improvement

The `darts` table currently captures:

```text
target_number
multiplier
score

```

but not:

- intended target,
- miss direction,
- inside/outside,
- training metadata.

For recreational games this is fine.

For analytics mode, we likely need an optional extension:

```
dart_details

```

or extend `darts`.

Before `0007_constraints.sql`, I recommend reviewing the dart model because it determines the maximum analytical depth of the application.

---
