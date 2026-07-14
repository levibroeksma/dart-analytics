<!--
status: canonical
scope: database/naming
read-when: naming tables, views, indexes, constraints
updated: 2026-07-13
-->

# Database Naming Conventions

> **Version:** 1.3.0
>
> This document defines naming standards for the PostgreSQL database.
>
> Consistent naming is required to maintain readability, predictability and long-term maintainability.
>
> All database objects must follow these conventions.

---

# General Principles

The database uses:

- PostgreSQL naming conventions
- lowercase identifiers
- snake_case formatting
- descriptive names
- explicit terminology

Avoid:

- abbreviations
- ambiguous names
- inconsistent terminology
- frontend-specific naming

Database naming should describe the domain, not the implementation.

---

# General Formatting Rules

All database identifiers use:

```
snake_case
```

Examples:

Correct:

```sql
exercise_session
created_at
implementation_key
```

Incorrect:

```sql
exerciseSession
CreatedAt
implementationKey
```

---

# Table Naming

Tables use:

```
plural nouns
```

Examples:

Correct:

```text
players
game_types
exercise_sessions
darts
```

Incorrect:

```text
player
gameType
dartEvent
```

A table represents a collection of records.

---

# Junction Tables

Many-to-many relationship tables use both entity names.

Format:

```
<entity>_<entity>
```

Examples:

```text
game_type_features
```

Relationship:

```
game_types

+

game_features
```

---

# Avoid Generic Table Names

Avoid names without domain meaning.

Incorrect:

```text
data
records
items
objects
values
configuration
```

Prefer:

```text
exercise_configurations
ruleset_versions
configuration_templates
player_settings
```

---

# Primary Keys

Primary keys use:

```
id
```

Example:

```sql
CREATE TABLE players (

    id UUID PRIMARY KEY

);
```

Do not use:

```text
player_id
player_uuid
player_key
```

inside the table itself.

The table context already defines the entity.

---

# Foreign Keys

Foreign keys use:

```
<referenced_table_singular>_id
```

Examples:

```sql
player_id

game_type_id

exercise_session_id
```

Examples:

```sql
CREATE TABLE exercise_sessions (

    id UUID PRIMARY KEY,

    player_id UUID NOT NULL

);
```

---

# UUID Naming

UUID columns use the suffix:

```
_id
```

Examples:

```sql
player_id UUID

session_id UUID

turn_id UUID
```

Do not use:

```sql
player_uuid
player_identifier
```

---

# Reference Identifiers

Reference tables use:

```
id SMALLINT
```

Examples:

```text
game_statuses
dart_zones
participant_types
stage_types
```

Reference identifiers are not UUIDs because:

- datasets are small
- values are controlled
- identifiers are stable
- joins remain efficient

---

# Implementation Keys

Reference and configurable domain definitions use:

```
implementation_key
```

Purpose:

Provide a stable application-level identifier.

Examples:

```text
501

TUOD

ACTIVE

DOUBLE

INNER_BULL
```

Example:

```sql
implementation_key TEXT NOT NULL UNIQUE
```

Uniqueness may be composite where the key is scoped (e.g. `ruleset_versions` is unique per `(game_type_id, implementation_key)`). <!-- 2026-07-13 -->

Rules:

- must be lowercase or uppercase consistently within the domain
- must never be renamed after publication
- must be stable across environments

Implementation keys are used by:

- API contracts
- frontend logic
- migrations
- seed data
- AI agents

---

# Display Names

Human-readable names use:

```
name
```

Example:

```sql
name TEXT NOT NULL
```

Examples:

```text
"501 Double Out"

"Ten Up One Down"
```

The display name may change.

The implementation key may not.

---

# Boolean Columns

Boolean columns use descriptive prefixes.

Preferred:

```text
is_
has_
can_
should_
```

Examples:

```sql
is_published

is_active

has_completed
```

Avoid:

```text
published
active
completed
```

unless the meaning is unambiguous.

---

# Timestamp Columns

All timestamps use:

```
TIMESTAMPTZ
```

Naming:

## Creation

```sql
created_at
```

## Modification

```sql
updated_at
```

## Lifecycle events

Use descriptive names:

Examples:

```sql
started_at

completed_at

published_at

archived_at
```

Avoid:

```sql
date
time
timestamp
```

---

# Status Columns

Status values are represented through reference tables.

Preferred:

```sql
status_id
```

Example:

```sql
game_status_id
```

Avoid:

```sql
status TEXT
```

or:

```sql
is_finished BOOLEAN
```

when multiple lifecycle states exist.

---

# Configuration Naming

Configuration data uses explicit naming.

Examples:

```text
exercise_configurations

ruleset_versions

player_settings
```

Avoid generic:

```text
settings
config
options
metadata
```

unless the scope is clear.

---

# JSON Columns

JSON columns must describe their purpose.

Preferred:

```sql
configuration JSONB
```

Example:

```text
exercise_configurations.configuration
configuration_templates.configuration
```

Avoid:

```sql
data JSONB

payload JSONB

object JSONB
```

unless the purpose is generic by design.

---

# View Naming

Views use:

```
v_<purpose>
```

Examples:

```text
v_active_sessions

v_session_overview

v_game_replay

v_dart_analytics
```

Purpose:

Clearly distinguish read models from source tables.

---

# View Column Key And Label Naming

View columns follow the table conventions, with one read-model rule that keeps every view consistent:

- **Implementation keys** are exposed as `<concept>_key` (e.g. `game_type_key`, `capture_mode_key`, `input_mode_key`, `status_key`, `stage_type_key`, `intended_zone_key`, `hit_zone_key`, `duration_type_key`, `ruleset_version_key`).
- **Human labels** are exposed as `<concept>_name`, and only where a screen renders the label directly (`game_type_name`, plus entity names such as `routine_name` / `exercise_name`). Enum-like lookups (capture/input mode, status, dart zones, stage types) are key-only.
- **Internal lookup `*_id` columns are never exposed** by a read model. Keep entity UUIDs for two purposes only: ids a client addresses in a later request (`session_id`, `routine_id`, `exercise_template_id`, `configuration_template_id`, `player_id` for scoping) and structural identity needed to reconstruct hierarchies (`stage_id`, `parent_stage_id`). <!-- 2026-07-13 -->

This standard is applied by migration `0013_normalize_read_model_views.sql`. (2026-07-12)

---

# Index Naming

Indexes use:

```
idx_<table>_<columns>
```

Examples:

```text
idx_sessions_player_created

idx_darts_turn_number
```

Partial indexes should still follow this pattern.

Example:

```text
idx_sessions_active
```

---

# Constraint Naming

Constraints use descriptive prefixes.

---

## Primary Keys

PostgreSQL default naming is acceptable.

Example:

```text
players_pkey
```

---

## Foreign Keys

Format:

```
fk_<table>_<reference>
```

Example:

```text
fk_turns_participant
```

---

## Unique Constraints

Format:

```
uq_<table>_<columns>
```

Example:

```text
uq_game_type_feature
```

---

## Check Constraints

Format:

```
chk_<table>_<rule>
```

Examples:

```text
chk_dart_score_positive

chk_sessions_completed_after_start
```

---

# Enum Naming

PostgreSQL native enums should not be used for domain concepts.

Instead use reference tables.

Preferred:

```text
game_statuses
dart_zones
duration_types
```

Reason:

Reference tables support:

- versioning
- metadata
- publishing
- expansion

---

# Migration File Naming

Migration files use:

```
<number>_<description>.sql
```

Examples:

```text
0001_extensions.sql

0002_reference_tables.sql

0006_runtime_events.sql

0010_configuration_templates.sql

0011_ordering_and_uniqueness.sql
```

Rules:

- numbers are sequential
- one responsibility per migration
- names describe purpose

---

# Seed File Naming

Seed files use:

```
<number>_<description>.sql
```

Examples:

```text
0001_reference_data.sql
```

Seeds contain:

- deterministic reference data
- stable identifiers
- environment-independent values

---

# Column Ordering

Tables should follow this order:

```sql
id

foreign_keys

domain_columns

configuration_columns

timestamps
```

Example:

```sql
CREATE TABLE exercise_sessions (

    id UUID PRIMARY KEY,

    player_id UUID NOT NULL,

    game_type_id UUID NOT NULL,

    configuration JSONB,

    created_at TIMESTAMPTZ NOT NULL,

    updated_at TIMESTAMPTZ

);
```

---

# Naming Anti-Patterns

Avoid:

## Abbreviations

Incorrect:

```text
usr_id
sess_id
cfg
```

Correct:

```text
user_id
session_id
configuration
```

---

## Generic Names

Incorrect:

```text
type
value
data
object
```

Correct:

```text
game_type_id
duration_value
configuration
```

---

## Implementation Leakage

Incorrect:

```text
react_state
frontend_config
component_data
```

The database should represent domain concepts, not UI implementation.

---

# Final Principle

Database names are part of the architecture.

A well-named database allows developers and AI agents to understand:

- what data represents
- how entities relate
- where responsibilities belong

Consistency is more important than personal preference.
