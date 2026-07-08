# Database Index Strategy

> **Version:** 1.1.0
>
> This document defines the indexing strategy for the PostgreSQL database.
>
> Indexes exist to support known access patterns while maintaining a healthy balance between read performance and write overhead.
>
> Indexes are an optimization mechanism, not a replacement for good data modelling.

---

# Index Philosophy

The default approach is:

```

Design the query patterns first.

Add indexes based on evidence.

```

Indexes improve:

- query performance
- sorting
- filtering
- joins

Indexes also introduce:

- additional storage usage
- slower writes
- maintenance overhead

Every index must have a clear purpose.

---

# Primary Key Indexes

Every primary key automatically receives a PostgreSQL index.

Domain entities use:

```

UUIDv7

```

UUIDv7 provides:

- global uniqueness
- chronological ordering
- improved B-tree locality compared to random UUIDs

No additional ordering indexes should be created on primary keys unless query analysis justifies it.

Example:

```sql
id UUID PRIMARY KEY
```

automatically creates:

```text
table_name_pkey
```

---

# Foreign Key Index Rules

Foreign keys do not automatically receive indexes in PostgreSQL.

However, foreign keys are frequently queried.

An index should be added when the relationship is used for:

- filtering
- joining
- ordering
- deleting related records
- retrieving child collections

Example:

Frequently queried:

```sql
SELECT *
FROM darts
WHERE turn_id = ?
```

Requires:

```sql
CREATE INDEX idx_darts_turn_id
ON darts(turn_id);
```

---

# Composite Index Rules

Composite indexes should follow the query pattern.

Column order matters.

PostgreSQL can efficiently use:

```sql
(first_column, second_column)
```

for:

```sql
WHERE first_column = ?
```

and:

```sql
WHERE first_column = ?
AND second_column = ?
```

but generally not:

```sql
WHERE second_column = ?
```

alone.

---

# Naming Convention

Indexes follow:

```
idx_<table>_<columns>
```

Examples:

```text
idx_darts_turn_id

idx_sessions_player_created_at

idx_turns_stage_sequence
```

Partial indexes describe their condition:

```text
idx_sessions_active
```

---

# Runtime Layer Index Strategy

Runtime tables represent gameplay history.

The most common access patterns are:

- retrieve active sessions
- replay completed games
- retrieve player history
- calculate statistics
- fetch turns and darts

---

# Activities

Common queries:

```sql
Find player activities ordered by newest first
```

Recommended (migration `0008`):

```sql
CREATE INDEX idx_activities_player_status
ON activities(player_id, status_id);
```

Purpose:

- player history
- activity overview screens

---

# Exercise Sessions

Common queries:

```sql
Find active sessions for a player
```

Applied in migration `0008` (non-unique lookup):

```sql
CREATE INDEX idx_sessions_active
ON exercise_sessions(player_id, status_id)
WHERE completed_at IS NULL;
```

Lifecycle enforcement (migration `0011` — unique partial index):

```sql
CREATE UNIQUE INDEX uq_sessions_single_active
ON exercise_sessions(player_id, game_type_id)
WHERE completed_at IS NULL;
```

---

Common query:

```sql
Retrieve completed sessions for analysis
```

Applied in migration `0008`:

```sql
CREATE INDEX idx_sessions_player_completed
ON exercise_sessions(player_id, completed_at DESC)
WHERE completed_at IS NOT NULL;
```

---

# Turns

Common queries:

```sql
Retrieve turns in order for a session
```

Recommended:

```sql
CREATE INDEX idx_turns_stage_sequence
ON turns(exercise_stage_id, sequence_number);
```

Purpose:

- replay
- rendering game history

---

# Darts

The dart table is the most important event table.

Common queries:

```sql
Retrieve all darts in a turn
```

Covered by the unique ordering index:

```sql
CREATE UNIQUE INDEX uq_darts_turn_number
ON darts(turn_id, dart_number);
```

Purpose:

- replay
- turn reconstruction
- integrity (no duplicate dart numbers within a turn)

A unique constraint doubles as the access-path index; a separate non-unique index would be redundant.

---

Common analytics queries:

```sql
Retrieve darts by player
```

Recommended only if required by workload:

```sql
CREATE INDEX idx_darts_player_created
ON darts(player_id, created_at);
```

Do not add this automatically.

Statistics should initially be derived through joins.

---

# Reference Layer Index Strategy

Reference tables are small.

Most tables require only:

- primary key index
- unique implementation_key index

Example:

```sql
CREATE UNIQUE INDEX uq_game_types_implementation_key
ON game_types(implementation_key);
```

No additional indexes should normally be required.

---

# Implementation Key Indexes

All published reference definitions require:

```sql
UNIQUE
```

on:

```sql
implementation_key
```

Reason:

Implementation keys are application contracts.

Example:

```sql
game_types
-------------
id
implementation_key
name
```

Index:

```text
uq_game_types_implementation_key
```

---

# Template Layer Index Strategy

Templates are queried by:

- owner
- visibility
- publication status
- game type

---

Example:

User templates:

```sql
CREATE INDEX idx_routine_templates_player
ON routine_templates(player_id);
```

---

Configuration presets (migration 0010):

```sql
CREATE INDEX idx_configuration_templates_game_type
ON configuration_templates(game_type_id);

CREATE INDEX idx_configuration_templates_player
ON configuration_templates(player_id)
WHERE player_id IS NOT NULL;
```

The partial player index skips system presets (NULL owner), which are the majority of rows a fresh install contains.

---

# Partial Index Strategy

Partial indexes should be used for lifecycle states.

Good candidates:

- active sessions
- published templates
- incomplete games

Example:

```sql
WHERE completed_at IS NULL
```

Benefits:

- smaller index
- faster lookup
- reduced maintenance

---

Avoid partial indexes when:

- most rows match the condition
- the condition changes frequently
- the query does not use the condition

---

# Unique Index Strategy

Unique indexes enforce business rules.

Examples:

Implementation keys:

```sql
implementation_key UNIQUE
```

---

## Ordering Uniqueness (migration 0011)

Event ordering must be unambiguous because replay depends on it.

Enforced:

```sql
uq_routine_steps_sequence          (routine_template_id, sequence_number)

uq_stages_sibling_sequence         (exercise_session_id, parent_stage_id, sequence_number)
                                   WHERE parent_stage_id IS NOT NULL

uq_stages_root_sequence            (exercise_session_id, sequence_number)
                                   WHERE parent_stage_id IS NULL

uq_turns_stage_participant_sequence (exercise_stage_id, participant_id, sequence_number)

uq_darts_turn_number               (turn_id, dart_number)
```

Stage ordering requires two partial indexes because `parent_stage_id` is nullable and NULL values are not comparable in a plain unique constraint.

---

## Lifecycle Uniqueness (migration 0011)

The single-active-session rule is enforced with a unique partial index:

```sql
CREATE UNIQUE INDEX uq_sessions_single_active
ON exercise_sessions(player_id, game_type_id)
WHERE completed_at IS NULL;
```

One player can have at most one uncompleted session per game type.

---

## Redundancy Rule

When a unique constraint covers an access path, the matching non-unique index must be dropped.

Applied in `0011`:

- `idx_routine_steps_template_sequence` (covered by `uq_routine_steps_sequence`)
- `idx_darts_turn_number` (covered by `uq_darts_turn_number`)

---

# Indexes and Views

Views do not store data.

Indexes belong to underlying tables.

A view performance problem should first be solved by:

1. Reviewing query structure.
2. Reviewing underlying indexes.
3. Adding indexes based on actual execution plans.

Do not create indexes specifically "for a view".

---

# JSONB Index Rules

JSONB indexes should only be added when JSON fields are queried frequently.

Example:

```sql
configuration @> '{"difficulty":"easy"}'
```

may justify:

```sql
GIN index
```

However:

Do not index every JSONB column.

Prefer relational columns for frequently queried values.

---

# Analytics Index Strategy

Analytics workloads may require additional indexes.

Examples:

- player progression queries
- historical comparisons
- aggregation filters

These should be introduced after:

- measuring query performance
- identifying bottlenecks
- confirming the query pattern

---

# Index Review Process

Before adding an index, answer:

## 1. What query does this support?

Example:

```
Resume active session for player
```

---

## 2. How frequently is this query executed?

High-frequency queries justify indexes sooner.

---

## 3. What is the write impact?

Every insert/update/delete must maintain indexes.

---

## 4. Could query restructuring solve the problem?

An unnecessary index should not hide inefficient queries.

---

# Index Anti-Patterns

## Index Every Foreign Key

Bad:

```
Every FK automatically gets an index
```

Reason:

Creates unnecessary write overhead.

---

## Duplicate Indexes

Bad:

```
(player_id)

(player_id, created_at)
```

when the second already supports the first.

---

## Index Low Selectivity Columns

Avoid standalone indexes on:

```text
is_active

status_id

boolean flags
```

unless query patterns justify them.

---

## Index Without Measurement

Bad:

```
Add index because it might be faster
```

Good:

```
Identify query

↓

Measure

↓

Add index

↓

Validate improvement
```

---

# AI Agent Index Rules

Before creating an index, an AI agent must:

1. Identify the exact query pattern.
2. Check existing indexes.
3. Confirm that the index does not duplicate another index.
4. Evaluate write impact.
5. Add migration documentation explaining the purpose.

An index without a documented purpose should not be created.

---

# Final Principle

Indexes optimize access to stored truth.

They should support the application's real usage patterns without compromising data integrity or maintainability.

Good indexing is deliberate, measurable and continuously reviewed.
