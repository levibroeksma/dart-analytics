## Prompt

ok, let's review before moving on

## Response

Good. This is the correct point to stop and review.

The **runtime event model is the foundation of the entire analytics capability**. Changes here become expensive later because every statistic, view, API endpoint and frontend flow depends on these facts.

I will review this as a senior data architect would: **what is correct, what is missing, what risks exist, and what I recommend changing before freezing.**

---

# Runtime Event Model Review

Current model:

```text
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

Current tables:

```
exercise_sessions
exercise_configurations
participants
exercise_stages
turns
darts

```

Overall assessment:

**8.8/10 currently**

The foundation is strong, but there are several improvements needed to reach the 9.8+ target we established.

---

# 1. The `turns` model is correct ✅

Current:

```sql
turns

id
exercise_stage_id
participant_id
sequence_number
total_score

```

This is good.

A turn represents:

> A single player visit to the oche.

This works for:

### 501

```
Leg

Turn 1
    Dart
    Dart
    Dart

Turn 2
    Dart
    Dart
    Dart

```

### TUOD

```
Round

Turn
    Dart
    Dart
    Dart

```

### Singles training

```
Target attempt

Turn
    Dart
    Dart
    Dart

```

No change required.

---

# 2. The `darts` table is too minimal ⚠️

Current:

```sql
darts

target_number
multiplier
score

```

This stores:

> What happened

But analytics requires knowing:

> What was intended?

This is the biggest issue.

---

## Example

A player throws at double 20.

The dart lands:

- single 20

Current database:

```
target_number = 20
multiplier = 1
score = 20

```

We know:

```
hit single 20

```

But we do NOT know:

```
attempted double 20

```

Therefore we cannot calculate:

- double accuracy
- worst doubles
- inside vs outside double misses
- recovery after failed double attempts

---

## Recommendation

Add intended target information.

Modify darts:

```sql
darts

id

turn_id

dart_number


intended_target_number

intended_multiplier


hit_target_number

hit_multiplier


score

```

---

Example:

Player aims D16:

```
intended_target_number = 16
intended_multiplier = 2

hit_target_number = 16
hit_multiplier = 1

score = 16

```

Now analytics become possible.

---

# 3. Do not overload darts with training-only metadata

A concern:

You mentioned:

- left/right misses
- recovery
- inside/outside

A tempting design:

```sql
darts

miss_direction
inside_outside

```

I would NOT do this.

Why?

Because these are derived concepts.

Example:

```
intended D16
hit S16

```

Automatically gives:

```
miss_type = OUTSIDE

```

No need to store it.

---

Rule:

Store:

```
facts

```

Derive:

```
interpretations

```

---

# 4. Add dart position information? ⚠️

Question:

Do we want:

```
x_coordinate
y_coordinate

```

?

For example:

```
D16 hit:

x = -10
y = 5

```

This enables:

- scatter plots
- grouping misses
- advanced coaching

However:

Your current UI does not capture this.

Therefore:

Do not add now.

But reserve the possibility.

Recommendation:

Create:

```sql
darts

```

with future compatibility:

```sql
location_x NUMERIC

location_y NUMERIC

```

nullable.

---

# 5. Dart count assumption ⚠️

Currently:

```sql
dart_number BETWEEN 1 AND 3

```

This is correct today.

But:

TUOD easy mode:

> 6 darts instead of 3

You already mentioned this future possibility.

Therefore this constraint is dangerous.

A better model:

Move dart limits to configuration.

Remove:

```sql
CHECK dart_number <= 3

```

Replace with:

No database restriction.

Why?

Because:

```
ruleset says max darts

```

not:

```
database says max darts

```

---

# 6. Add turn completion state

Current:

```
turn

```

only exists.

But with:

- browser refresh
- interrupted games
- network failures

we need:

```
turn started

turn completed

```

Add:

```sql
completed_at TIMESTAMPTZ

```

Why?

Because:

A user may throw:

```
Dart 1
Dart 2

close browser

```

The system needs to know:

unfinished turn.

---

# 7. Score should be derived? ⚠️

Current:

```sql
turns.total_score

```

and:

```sql
darts.score

```

Potential duplication.

Example:

Darts:

```
20
60
19

```

Turn:

```
total_score = 99

```

What if incorrect?

---

Options:

## Option A

Only store darts.

Calculate turns.

Pros:

- perfect consistency

Cons:

- slower queries

---

## Option B (recommended)

Keep:

```sql
turns.total_score

```

but enforce:

Application calculates.

Reason:

Turn scores are queried constantly.

A stored aggregate is acceptable.

---

# 8. Missing dart result classification

A dart has:

```
target
multiplier
score

```

But some cases:

Bull:

```
25
50

```

Need distinction.

Currently:

```sql
target_number BETWEEN 1 AND 25

```

doesn't clearly represent:

```
outer bull
inner bull

```

Recommendation:

Add:

```sql
dart_zone

```

Reference table:

```
SINGLE

DOUBLE

TREBLE

OUTER_BULL

INNER_BULL

MISS

```

Then:

```
target_number nullable

```

becomes cleaner.

---

# Recommended revised dart model

I would change:

```sql
darts

```

to:

```text
darts

id

turn_id

dart_number


intended_target_number
intended_zone_id


hit_target_number
hit_zone_id


score


created_at

```

---

Supporting lookup:

```text
dart_zones

id SMALLINT

implementation_key

name

```

---

Example:

Throw:

"I aim D20 and hit S20"

Database:

```
intended_target_number:
20

intended_zone:
DOUBLE


hit_target_number:
20

hit_zone:
SINGLE


score:
20

```

---

# Final recommendation before freezing

I recommend the following changes:

## Add reference table

```
dart_zones

```

to `0002_reference_tables.sql`

---

## Modify darts

Add:

```
intended_target_number
intended_zone_id

hit_target_number
hit_zone_id

```

Remove:

```
target_number
multiplier

```

---

## Modify turns

Add:

```
completed_at

```

---

## Remove dart limit constraint

Because rules determine dart count.

---

# Revised score

After these changes:

**9.8/10**

The model supports:

✅ recreational scoring  
✅ training analytics  
✅ replay  
✅ future AI coaching  
✅ additional game types  
✅ future commercialisation

without forcing unnecessary complexity.

---

Before modifying migrations, I have one final question that affects the dart model:

## Question

When the user is in **analytics mode**, do you want to capture only:

### A. Target intention

Example:

```
"I aimed D16"
"I hit S16"

```

or:

### B. Actual physical placement

Example:

```
"I aimed D16"

Dart landed 8mm below-left of D16

```

Option B requires a different capture strategy (coordinates / board mapping).

Given your current UI plans, I suspect A is the intended approach, but I want to freeze this before changing the schema.

---

## Prompt

Agreed, us recommendations, give a clear overview of what I need to change

## Response

Agreed. We will apply the recommended model changes.

The goal is to keep the database **fact-based**, while ensuring that all currently envisioned analytics remain derivable.

The changes are concentrated in three areas:

1. Add `dart_zones` reference data.
2. Improve the `darts` event model.
3. Improve `turns` lifecycle handling.

---

# 1. Update `0002_reference_tables.sql`

Add a new reference table:

## `dart_zones`

Purpose:

Defines the possible dart regions.

This replaces implicit interpretation through:

```text
multiplier
score

```

with explicit domain meaning.

Add:

```sql
-- ============================================================
-- dart_zones
--
-- Defines dart board scoring regions.
--
-- Examples:
-- SINGLE
-- DOUBLE
-- TREBLE
-- OUTER_BULL
-- INNER_BULL
-- MISS
--
-- ============================================================

CREATE TABLE dart_zones (

    id SMALLINT PRIMARY KEY,

    implementation_key TEXT NOT NULL,

    name TEXT NOT NULL,

    description TEXT,

    created_at TIMESTAMPTZ NOT NULL,


    CONSTRAINT uq_dart_zones_implementation_key
        UNIQUE (implementation_key)

);


COMMENT ON TABLE dart_zones IS
'Defines dart board scoring zones.';

```

---

Add seed data to:

`database/seeds/0001_reference_data.sql`

```sql
INSERT INTO dart_zones (
    id,
    implementation_key,
    name,
    description,
    created_at
)
VALUES
(
    1,
    'SINGLE',
    'Single',
    'Single segment hit.',
    now()
),
(
    2,
    'DOUBLE',
    'Double',
    'Double segment hit.',
    now()
),
(
    3,
    'TREBLE',
    'Treble',
    'Treble segment hit.',
    now()
),
(
    4,
    'OUTER_BULL',
    'Outer Bull',
    'Outer bullseye hit.',
    now()
),
(
    5,
    'INNER_BULL',
    'Inner Bull',
    'Inner bullseye hit.',
    now()
),
(
    6,
    'MISS',
    'Miss',
    'Missed scoring area.',
    now()
)
ON CONFLICT (id) DO NOTHING;

```

---

# 2. Update `0005_runtime_core.sql`

No structural change needed to:

- activities
- sessions
- configurations
- participants
- stages

Only confirm that `stage_type_id` and `participant_type_id` are used.

---

# 3. Update `0006_runtime_events.sql`

## A. Update `turns`

### Current

```sql
turns

id
exercise_stage_id
participant_id
sequence_number
total_score
created_at

```

---

### Change to:

```sql
CREATE TABLE turns (

    id UUID PRIMARY KEY,


    exercise_stage_id UUID NOT NULL,


    participant_id UUID NOT NULL,


    sequence_number INTEGER NOT NULL,


    total_score INTEGER NOT NULL DEFAULT 0,


    completed_at TIMESTAMPTZ,


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

```

---

## Why add `completed_at`?

Because this supports:

### Interrupted sessions

Example:

```
Turn started

Dart 1 entered

Dart 2 entered

Browser closed

```

Database state:

```
completed_at = NULL

```

The application knows:

> unfinished turn

---

# 4. Replace the `darts` table

## Remove

The old model:

```sql
target_number

multiplier

score

```

is too limited.

It only describes:

> What happened.

It cannot answer:

> What was attempted?

---

## New model

```sql
CREATE TABLE darts (

    id UUID PRIMARY KEY,


    turn_id UUID NOT NULL,


    dart_number SMALLINT NOT NULL,


    intended_target_number SMALLINT,

    intended_zone_id SMALLINT,


    hit_target_number SMALLINT,

    hit_zone_id SMALLINT,


    score INTEGER NOT NULL DEFAULT 0,


    created_at TIMESTAMPTZ NOT NULL,


    CONSTRAINT fk_darts_turn
        FOREIGN KEY(turn_id)
        REFERENCES turns(id)
        ON DELETE CASCADE,


    CONSTRAINT fk_darts_intended_zone
        FOREIGN KEY(intended_zone_id)
        REFERENCES dart_zones(id)
        ON DELETE RESTRICT,


    CONSTRAINT fk_darts_hit_zone
        FOREIGN KEY(hit_zone_id)
        REFERENCES dart_zones(id)
        ON DELETE RESTRICT,


    CONSTRAINT chk_dart_number
        CHECK (
            dart_number > 0
        ),


    CONSTRAINT chk_intended_target
        CHECK (
            intended_target_number IS NULL
            OR intended_target_number BETWEEN 1 AND 25
        ),


    CONSTRAINT chk_hit_target
        CHECK (
            hit_target_number IS NULL
            OR hit_target_number BETWEEN 1 AND 25
        )

);

```

---

# Example data

## Recreational 501

Input:

```
76

```

No analytics.

Stored:

```
turn

total_score = 76

```

No darts required.

---

## Analytics mode

User throws:

> Aim D20, hit S20

Stored:

```
dart_number:
1

intended_target_number:
20

intended_zone:
DOUBLE


hit_target_number:
20

hit_zone:
SINGLE


score:
20

```

Now the system can calculate:

```
Double 20 accuracy
=
successful D20 attempts /
all D20 attempts

```

---

# 5. Remove from previous design

Delete:

```sql
multiplier

```

Reason:

It is derived from:

```
dart_zone

```

---

Delete:

```sql
CHECK dart_number BETWEEN 1 AND 3

```

Reason:

The ruleset defines dart count.

Future example:

TUOD Easy:

```
6 darts allowed

```

should not require schema changes.

---

# Final runtime event model

After changes:

```text
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

        |
        |
dart_zone

```

---

# Analytics capability after changes

Supported:

✅ single accuracy  
✅ double accuracy  
✅ treble accuracy  
✅ worst doubles  
✅ worst singles  
✅ inside/outside misses  
✅ left/right misses (if future UI captures position)  
✅ recovery after bad darts  
✅ finish dart number  
✅ target progression  
✅ game replay

---

## Remaining decision before continuing

One final consideration before moving to `0007_constraints.sql`:

We currently store:

```sql
turn.total_score
dart.score

```

This duplicates information.

I recommend keeping both because:

- `turns` are queried constantly,
- dashboards usually aggregate visits, not individual darts,
- the application controls writes.

But we should explicitly document this as a **controlled denormalisation**.

Next step after this review should be:

1. Update the architecture document with this decision.
2. Freeze `0006_runtime_events.sql`.
3. Continue with `0007_constraints.sql`.

---

## Prompt

great, I updated the files. Let's move on to 0007

## Response

Good. With the runtime event model frozen, `0007_constraints.sql` becomes the **integrity hardening layer**.

A design decision we should keep explicit:

> Migrations create tables and basic foreign keys. Constraint migrations enforce cross-table business integrity.

This separation gives us:

- easier debugging,
- smaller migration responsibilities,
- safer future changes,
- clearer AI-agent execution.

The responsibility of `0007_constraints.sql`:

- add missing `CHECK` constraints,
- add uniqueness rules,
- prevent impossible states,
- enforce domain invariants.

It should **not** contain indexes yet. Those belong in `0008_indexes.sql`.

---

# `database/migrations/0007_constraints.sql`

```sql
-- ============================================================
-- Migration: 0007_constraints.sql
--
-- Purpose:
-- Add database integrity constraints.
--
-- This migration protects domain rules that cannot
-- be guaranteed by table structure alone.
--
-- ============================================================


BEGIN;


-- ============================================================
-- GAME DEFINITIONS
-- ============================================================


-- Game implementations must have stable keys

ALTER TABLE game_types

ADD CONSTRAINT chk_game_types_implementation_key_not_empty

CHECK (
    length(trim(implementation_key)) > 0
);



-- Names cannot be empty

ALTER TABLE game_types

ADD CONSTRAINT chk_game_types_name_not_empty

CHECK (
    length(trim(name)) > 0
);



-- ============================================================
-- FEATURES
-- ============================================================


ALTER TABLE game_features

ADD CONSTRAINT chk_game_features_key_not_empty

CHECK (
    length(trim(implementation_key)) > 0
);



ALTER TABLE game_type_features

ADD CONSTRAINT uq_game_type_feature

UNIQUE (
    game_type_id,
    game_feature_id
);



-- ============================================================
-- RULESETS
-- ============================================================


ALTER TABLE ruleset_versions

ADD CONSTRAINT chk_ruleset_version_positive

CHECK (
    version_number > 0
);



-- ============================================================
-- PLAYERS
-- ============================================================


ALTER TABLE players

ADD CONSTRAINT chk_players_display_name_not_empty

CHECK (
    display_name IS NULL
    OR length(trim(display_name)) > 0
);



-- ============================================================
-- ACTIVITIES
-- ============================================================


ALTER TABLE activities

ADD CONSTRAINT chk_activity_completed_after_start

CHECK (
    completed_at IS NULL
    OR completed_at >= started_at
);



-- ============================================================
-- EXERCISE SESSIONS
-- ============================================================


ALTER TABLE exercise_sessions

ADD CONSTRAINT chk_session_completed_after_start

CHECK (
    completed_at IS NULL
    OR completed_at >= started_at
);



-- ============================================================
-- EXERCISE CONFIGURATIONS
-- ============================================================


ALTER TABLE exercise_configurations

ADD CONSTRAINT chk_configuration_not_empty

CHECK (
    jsonb_typeof(configuration) = 'object'
);



-- ============================================================
-- PARTICIPANTS
-- ============================================================


-- A participant must either reference
-- an existing player OR have a display name.
--
-- Example:
--
-- Player:
-- player_id = UUID
--
-- Guest:
-- player_id = NULL
-- display_name = "John"
--

ALTER TABLE participants

ADD CONSTRAINT chk_participant_identity

CHECK (
    player_id IS NOT NULL
    OR display_name IS NOT NULL
);



-- ============================================================
-- EXERCISE STAGES
-- ============================================================


ALTER TABLE exercise_stages

ADD CONSTRAINT chk_stage_sequence_positive

CHECK (
    sequence_number > 0
);



ALTER TABLE exercise_stages

ADD CONSTRAINT chk_stage_not_self_parent

CHECK (
    parent_stage_id IS NULL
    OR parent_stage_id <> id
);



-- ============================================================
-- ROUTINES
-- ============================================================


ALTER TABLE routine_steps

ADD CONSTRAINT chk_routine_step_sequence_positive

CHECK (
    sequence_number > 0
);



ALTER TABLE routine_steps

ADD CONSTRAINT chk_routine_duration_positive

CHECK (
    duration_value > 0
);



-- ============================================================
-- TURNS
-- ============================================================


ALTER TABLE turns

ADD CONSTRAINT chk_turn_sequence_positive

CHECK (
    sequence_number > 0
);



ALTER TABLE turns

ADD CONSTRAINT chk_turn_completed_after_created

CHECK (
    completed_at IS NULL
    OR completed_at >= created_at
);



-- ============================================================
-- DARTS
-- ============================================================


ALTER TABLE darts

ADD CONSTRAINT chk_dart_number_positive

CHECK (
    dart_number > 0
);



ALTER TABLE darts

ADD CONSTRAINT chk_dart_score_positive

CHECK (
    score >= 0
);



ALTER TABLE darts

ADD CONSTRAINT chk_dart_target_consistency

CHECK (
    (
        intended_zone_id IS NULL
        AND intended_target_number IS NULL
    )
    OR
    (
        intended_zone_id IS NOT NULL
    )
);



ALTER TABLE darts

ADD CONSTRAINT chk_hit_consistency

CHECK (
    (
        hit_zone_id IS NULL
        AND hit_target_number IS NULL
    )
    OR
    (
        hit_zone_id IS NOT NULL
    )
);



COMMIT;

```

---

# Review of these constraints

## Good protections added

### Impossible session timing

Prevents:

```text
started:
10:00

completed:
09:00

```

---

### Invalid participant state

Prevents:

```text
participant:

player_id = NULL

display_name = NULL

```

The database cannot identify the participant.

---

### Invalid dart data

Prevents:

```text
intended_zone = DOUBLE

intended_target = NULL

```

because a double without a target is meaningless.

---

### Invalid routine configuration

Prevents:

```text
duration_value = -10

```

---

# One important design discussion

There are two constraints I intentionally **did not add**:

---

## 1. Maximum darts per turn

Not added:

```sql
CHECK dart_number <= 3

```

Reason:

The database should not know:

- TUOD easy mode = 6 darts
- future training modes = 9 darts
- special exercises

The ruleset owns this.

---

## 2. Score validation

Not added:

Example:

```sql
score <= 180

```

Reason:

Different games have different limits.

A future game might allow:

- bonus darts,
- multipliers,
- special scoring.

Again:

Ruleset owns this.

---

# Current migration progress

We now have:

```text
0001_extensions.sql
        ↓
0002_reference_tables.sql
        ↓
0003_players.sql
        ↓
0004_templates.sql
        ↓
0005_runtime_core.sql
        ↓
0006_runtime_events.sql
        ↓
0007_constraints.sql   ✅
        ↓
0008_indexes.sql
        ↓
0009_views.sql

```

---

Before moving to `0008_indexes.sql`, the next review should focus on **query patterns**, because indexes should follow actual access paths.

For this application I expect the critical paths will be:

1. Resume active game after browser refresh.
2. Load routine progress.
3. Load match replay.
4. Analytics dashboards.
5. Player statistics.
6. Historical sessions.

`0008_indexes.sql` should be designed from those flows, not blindly indexed on every foreign key.

---

## Prompt

let's draft 0008

## Response

Good. We now move to `0008_indexes.sql`.

This migration is important because indexing is where many otherwise well-designed databases become inefficient. The goal is **not** "index every foreign key". The goal is:

> Create indexes based on real application access patterns and expected analytical queries.

The database is currently designed around these primary flows:

---

# Critical query patterns

## 1. Resume interrupted sessions

User opens the app:

> "Do I have an active game?"

Query pattern:

```sql
WHERE player_id = ?
AND status_id = ACTIVE
ORDER BY started_at DESC

```

Needs:

- player lookup
- active session filtering

---

## 2. Load a completed game replay

Example:

> "Show my last 501 game"

Query:

```sql
exercise_session
    ↓
exercise_stage
    ↓
turn
    ↓
dart

```

Needs:

- chronological retrieval
- efficient hierarchy traversal

---

## 3. Player statistics

Examples:

- average score
- double percentage
- scoring progression
- training history

Query pattern:

```sql
WHERE player_id = ?
AND completed_at IS NOT NULL
ORDER BY completed_at DESC

```

---

## 4. Routine execution

Example:

> Start a training routine

Needs:

```text
routine_template

    ↓

routine_steps

    ↓

exercise_template

```

---

## 5. Analytics

Examples:

"How accurate am I on D16?"

Needs:

```sql
darts

WHERE intended_target_number = 16
AND intended_zone = DOUBLE

```

---

# `database/migrations/0008_indexes.sql`

```sql
-- ============================================================
-- Migration: 0008_indexes.sql
--
-- Purpose:
-- Add performance indexes based on application
-- query patterns.
--
-- Index strategy:
-- - optimize reads
-- - avoid unnecessary write overhead
-- - support analytical queries
--
-- ============================================================


BEGIN;



-- ============================================================
-- GAME DEFINITIONS
-- ============================================================


CREATE INDEX idx_game_types_published

ON game_types (
    is_published
)

WHERE is_published = TRUE;



CREATE INDEX idx_game_type_features_game_type

ON game_type_features (
    game_type_id
);



-- ============================================================
-- ROUTINES
-- ============================================================


CREATE INDEX idx_routine_steps_template_sequence

ON routine_steps (
    routine_template_id,
    sequence_number
);



CREATE INDEX idx_exercise_templates_game_type

ON exercise_templates (
    game_type_id
);



-- ============================================================
-- ACTIVITIES
-- ============================================================


CREATE INDEX idx_activities_player_status

ON activities (
    player_id,
    status_id
);



-- ============================================================
-- EXERCISE SESSIONS
-- ============================================================


CREATE INDEX idx_sessions_player_created

ON exercise_sessions (
    player_id,
    created_at DESC
);



CREATE INDEX idx_sessions_player_completed

ON exercise_sessions (
    player_id,
    completed_at DESC
)

WHERE completed_at IS NOT NULL;



CREATE INDEX idx_sessions_active

ON exercise_sessions (
    player_id,
    status_id
)

WHERE completed_at IS NULL;



CREATE INDEX idx_sessions_activity

ON exercise_sessions (
    activity_id
);



-- ============================================================
-- CONFIGURATION
-- ============================================================


CREATE INDEX idx_configuration_session

ON exercise_configurations (
    exercise_session_id
);



-- ============================================================
-- PARTICIPANTS
-- ============================================================


CREATE INDEX idx_participants_session

ON participants (
    exercise_session_id
);



-- ============================================================
-- STAGES
-- ============================================================


CREATE INDEX idx_stages_session_sequence

ON exercise_stages (
    exercise_session_id,
    sequence_number
);



CREATE INDEX idx_stages_parent

ON exercise_stages (
    parent_stage_id
);



-- ============================================================
-- TURNS
-- ============================================================


CREATE INDEX idx_turns_stage_sequence

ON turns (
    exercise_stage_id,
    sequence_number
);



CREATE INDEX idx_turns_participant

ON turns (
    participant_id
);



-- ============================================================
-- DARTS
-- ============================================================


CREATE INDEX idx_darts_turn_number

ON darts (
    turn_id,
    dart_number
);



CREATE INDEX idx_darts_intended_target

ON darts (
    intended_target_number,
    intended_zone_id
);



CREATE INDEX idx_darts_hit_target

ON darts (
    hit_target_number,
    hit_zone_id
);



CREATE INDEX idx_darts_zone_accuracy

ON darts (
    intended_zone_id,
    hit_zone_id
);



COMMIT;

```

---

# Review of index choices

## Partial index: active sessions

This is important:

```sql
WHERE completed_at IS NULL

```

Why?

A user normally has:

```
1000 completed games

1 active game

```

Without partial indexing:

Postgres scans thousands of historical rows.

With:

```sql
idx_sessions_active

```

it immediately finds active sessions.

---

# Why no indexes on UUID primary keys?

Because PostgreSQL automatically creates:

```sql
PRIMARY KEY

```

indexes.

Example:

```sql
exercise_sessions(id)

```

already has an index.

Adding:

```sql
CREATE INDEX ON exercise_sessions(id);

```

would be wasteful.

---

# Why no indexes on every foreign key?

Example:

```sql
participants.player_id

```

is not indexed.

Reason:

The dominant query is:

```sql
WHERE exercise_session_id = ?

```

not:

```sql
WHERE player_id = ?

```

Adding unnecessary indexes creates:

- slower inserts,
- more storage,
- more vacuum work.

---

# One important future consideration

Analytics queries may eventually become expensive.

Example:

> "Show my double accuracy over 2 years"

This query:

```sql
darts
JOIN sessions
JOIN players

```

will grow.

However, do **not** prematurely add:

- materialized views,
- aggregation tables,
- data warehouses.

The current approach is correct:

1. Normalize event data.
2. Add views.
3. Measure performance.
4. Add derived tables only when needed.

---

# Current architecture status

After `0008_indexes.sql`:

```text
Reference Layer
        ✅

Template Layer
        ✅

Runtime Layer
        ✅

Integrity Layer
        ✅

Performance Layer
        ✅

```

Next:

`0009_views.sql`

This is where we define the analytical interface.

Important principle:

> The API should query views, not raw tables.

The views will become the stable contract between:

```
PostgreSQL
      ↓
API
      ↓
Frontend

```

Next we should design the initial analytical views.

---
