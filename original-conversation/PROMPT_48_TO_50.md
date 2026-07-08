## Prompt

let's draft [01-Naming-Conventions.md](http://01-Naming-Conventions.md)

## Response

Good. This is one of the documents where being strict pays off the most.

Naming inconsistencies are one of the fastest ways for a database to become difficult to maintain. A schema can be technically correct while still becoming painful to work with because every developer makes slightly different choices.

This document will become the **SQL vocabulary contract**.

A developer or AI agent should be able to answer questions like:

- Should this table be singular or plural?
- Should this column be `userId`, `user_id`, or `fk_user_id`?
- Should this be an enum or lookup table?
- How should indexes be named?
- How should foreign keys be named?
- What naming pattern should a new game-specific table follow?

before writing any SQL.

---

```markdown

```

# Database Naming Conventions

> **Version:** 1.0.0
>
> This document defines the naming conventions used throughout the PostgreSQL database.
>
> The purpose is to ensure consistency, readability and predictability across all database objects.
>
> All migrations, tables, columns, constraints, indexes, views and functions must follow these conventions.

---

# General Naming Philosophy

Database naming should optimize for:

1. Readability
2. Explicit meaning
3. Consistency
4. Discoverability
5. Long-term maintainability

Names should describe the domain concept, not the implementation detail.

---

# General Rules

## Language

All database identifiers use English.

Examples:

Good:

```sql
exercise_session
player_statistics
game_configuration
```

Avoid:

```sql
training_sessie
speler_data
```

---

## Case

All database identifiers use:

```
snake_case
```

Examples:

Good:

```sql
created_at
exercise_session_id
ruleset_version
```

Avoid:

```sql
createdAt
ExerciseSession
Created_Date
```

---

## Abbreviations

Avoid abbreviations unless they are universally understood.

Allowed examples:

```sql
id
url
api
sql
uuid
```

Avoid:

```sql
usr
cfg
sess
stat
```

Prefer:

```sql
user
configuration
session
statistics
```

---

# Table Naming

## General Rule

Tables use:

```
plural nouns
```

Examples:

```sql
players
games
exercise_sessions
darts
game_types
```

---

## Reason

A table represents a collection of records.

Example:

```sql
SELECT *
FROM players;
```

reads naturally.

---

# Junction Tables

Many-to-many relationship tables use both entity names.

Pattern:

```
entity1_entity2
```

Examples:

```sql
game_type_features

routine_steps

user_roles
```

---

## Ordering

Use the most natural reading order.

Example:

```sql
game_type_features
```

is preferred over:

```sql
features_game_types
```

because:

"A game type has features."

---

# Primary Keys

All tables use:

```sql
id
```

as the primary key column name.

Example:

```sql
CREATE TABLE players (
    id UUID PRIMARY KEY
);
```

---

## Exception

Shared primary key relationships.

Example:

```sql
exercise_configurations

id UUID PRIMARY KEY REFERENCES exercise_sessions(id)
```

The name remains:

```sql
id
```

---

# Foreign Keys

Foreign keys follow:

```
<referenced_table_singular>_id
```

Examples:

```sql
player_id

exercise_session_id

game_type_id

routine_template_id
```

---

## Avoid

```sql
fk_player
user
player_reference
```

The column name should explain the relationship without requiring a prefix.

---

# Timestamps

All timestamps use descriptive names.

Required:

```sql
created_at TIMESTAMPTZ
```

Optional:

```sql
updated_at TIMESTAMPTZ
started_at TIMESTAMPTZ
completed_at TIMESTAMPTZ
deleted_at TIMESTAMPTZ
```

---

# Boolean Columns

Boolean columns should describe a state.

Use prefixes:

```
is_
has_
can_
should_
```

Examples:

```sql
is_active
is_completed
has_won
can_replay
```

---

Avoid:

```sql
active
completed
winner
```

because they are ambiguous.

---

# Status Columns

Statuses should not be stored as free text.

Avoid:

```sql
status VARCHAR(50)
```

Prefer:

```sql
status_id UUID
```

referencing a lookup table.

Example:

```sql
game_status_id
```

---

# Lookup Tables

Lookup tables should use:

```
<domain>_<concept>
```

Examples:

```sql
game_statuses
game_types
input_modes
capture_modes
```

---

# Implementation Keys

System-managed lookup data should contain:

```sql
implementation_key
```

Example:

```sql
implementation_key VARCHAR(100) NOT NULL UNIQUE
```

Values:

```text
501_STANDARD
TUOD_CLASSIC
SINGLES_HARD
```

---

## Purpose

Implementation keys provide stable references between:

- database
- API
- frontend
- documentation

They must not change after publication.

---

# Enum Naming

PostgreSQL enums should only be used for:

- extremely stable values
- internal technical states

They should not represent business concepts expected to evolve.

---

Preferred:

```sql
game_statuses
```

instead of:

```sql
CREATE TYPE game_status AS ENUM(...)
```

---

# Configuration Tables

Configuration tables follow:

```
<game>_configurations
```

Examples:

```sql
tuod_configurations

501_configurations

singles_configurations
```

---

# Snapshot Tables

Runtime snapshots use:

```
<concept>_snapshots
```

Examples:

```sql
configuration_snapshots
ruleset_snapshots
```

---

# Runtime Tables

Runtime entities should use explicit domain names.

Examples:

```sql
activities

exercise_sessions

exercise_stages

turns

darts
```

Avoid generic names:

```sql
events

records

entries
```

unless the concept is truly generic.

---

# View Naming

Views use:

```
vw_<purpose>
```

or:

```
<purpose>_view
```

The preferred convention is:

```sql
vw_player_progression
vw_double_accuracy
vw_recent_sessions
```

---

## Reason

Views should be immediately recognizable.

---

# Materialized View Naming

Materialized views use:

```sql
mv_<purpose>
```

Examples:

```sql
mv_monthly_progression
mv_player_statistics
```

---

# Index Naming

Indexes use:

```
idx_<table>_<columns>
```

Examples:

```sql
idx_turns_session_id

idx_darts_turn_id

idx_exercise_sessions_player_id_created_at
```

---

# Unique Index Naming

Unique indexes use:

```
ux_<table>_<columns>
```

Examples:

```sql
ux_players_username
ux_game_types_implementation_key
```

---

# Constraint Naming

## Primary Key

Pattern:

```
pk_<table>
```

Example:

```sql
pk_players
```

---

## Foreign Key

Pattern:

```
fk_<table>_<referenced_table>
```

Example:

```sql
fk_exercise_sessions_players
```

---

## Unique Constraint

Pattern:

```
uq_<table>_<columns>
```

Example:

```sql
uq_game_types_implementation_key
```

---

## Check Constraint

Pattern:

```
ck_<table>_<condition>
```

Example:

```sql
ck_darts_score_positive
```

---

# Function Naming

Functions use:

```
verb_noun
```

Examples:

```sql
calculate_player_progression

update_updated_at_timestamp
```

---

# Trigger Naming

Triggers use:

```
trg_<table>_<action>
```

Examples:

```sql
trg_players_update_timestamp
```

---

# Column Ordering

Columns should appear in the following order:

```sql
id

foreign_keys

domain_columns

status_columns

timestamps
```

Example:

```sql
CREATE TABLE exercise_sessions (

    id UUID PRIMARY KEY,

    player_id UUID NOT NULL,

    game_type_id UUID NOT NULL,

    status_id UUID NOT NULL,

    started_at TIMESTAMPTZ,

    completed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL
);
```

---

# Reserved Words

Avoid PostgreSQL reserved keywords.

Avoid:

```sql
user
order
group
type
```

Prefer:

```sql
player
sequence_number
game_type
```

---

# Naming Review Checklist

Before adding a database object verify:

- Does it use snake_case?
- Does it describe the domain concept?
- Is the meaning obvious without documentation?
- Does it follow existing patterns?
- Does it avoid unnecessary abbreviations?
- Would another developer predict this name?

---

# Final Principle

A consistent naming system reduces cognitive load.

The database should feel predictable.

A developer should be able to understand the structure of the system by reading the schema without needing additional explanation.

```

---

## Self-review

I would rate this draft **9.8/10**.

The naming rules are intentionally strict, but I think there are still a few decisions we should defer until `02-Design-Rules.md`, because they are not purely naming questions:

- soft delete vs hard delete (`deleted_at` policy)
- audit columns
- tenant isolation strategy for future commercialization
- whether all tables receive `created_at`
- whether all lookup tables receive `version`
- whether schemas should be split (`reference`, `runtime`, `analytics`)
- whether PostgreSQL domains should be used

Those belong in the design rules document because they affect **data modelling**, not only naming.

The next document:

```

05-Database/02-Design-Rules.md

````

will be one of the most important database documents because it turns these conventions into actual modelling constraints. It will define the "do and don't" rules for designing tables.

---

---

## Prompt

move on to [Design-Rule.md](http://Design-Rule.md)

## Response

Good. This is arguably the most important database document so far.

`01-Naming-Conventions.md` tells us **how things are called**.

`02-Design-Rules.md` tells us **how things are allowed to exist**.

This document will become the guardrail against common relational database mistakes:

- over-normalization
- premature denormalization
- storing derived values
- mutable historical data
- generic JSON abuse
- weak constraints
- inconsistent relationships
- accidental coupling between templates and runtime data

Given the ambition of this project (progression tracking, replayability, future commercialization), these rules are what keep the database from becoming a collection of tables that happen to work.

---

```markdown
````

# Database Design Rules

> **Version:** 1.0.0
>
> This document defines the mandatory database design rules used throughout the project.
>
> These rules describe how data models should be created, structured and evolved.
>
> All database changes must comply with these rules unless an exception is documented through an ADR.

---

# Purpose

The database is responsible for representing domain truth.

A good database design should:

- prevent invalid states
- preserve historical correctness
- support reliable analytics
- enable future expansion
- remain understandable

The database should model the domain, not merely store application objects.

---

# Core Design Philosophy

The default approach is:

```

Model reality first.

Optimize later.

```

The database should accurately represent the domain before performance optimizations are introduced.

---

```



# Rule 1 — Normalize by Default



## Principle

The database follows relational normalization principles.

The default expectation is:

- avoid unnecessary duplication
- represent relationships explicitly
- maintain one source of truth

---



## Example

Preferred:

```

players

id
display_name

games

id
game_type_id

game_types

id
name

```

Avoid:

```

games

id
game_type_name

```

---



## Exception

Denormalization is allowed when:

- measurable performance improvement exists
- query complexity is significantly reduced
- consistency risks are controlled

The reason must be documented.

---



# Rule 2 — Persistent Truth vs Derived Data



## Principle

Only store facts.

Compute conclusions.

---



## Store

Examples:

```

dart_position

dart_value

target

score

timestamp

```

---



## Calculate

Examples:

```

accuracy_percentage

average_score

checkout_percentage

progression

```

---



## Exception

Derived data may be stored when:

- calculations become expensive
- the data is frequently requested
- consistency can be guaranteed

Prefer:

```

materialized view

```

before duplicating data.

---



# Rule 3 — Immutable Gameplay History



## Principle

Completed gameplay is historical data.

Historical records must not change.

---



## Applies To

Examples:

- completed activities
- exercise sessions
- turns
- darts
- results

---



## Reason

The system must support:

- replay
- auditing
- accurate statistics
- future analysis

---



## Correction Strategy

Incorrect data should be corrected by:

- new records
- correction events
- replacement sessions

Never by silently editing history.

---



# Rule 4 — Template and Runtime Separation



## Principle

Definitions and historical execution are separate concepts.

---



## Template Layer

Defines:

"What should happen?"

Examples:

- routine templates
- game configurations
- training programs

---



## Runtime Layer

Defines:

"What happened?"

Examples:

- completed exercises
- thrown darts
- scores

---



## Rule

Runtime data must never depend on mutable templates.

---



# Rule 5 — Snapshot Mutable Configuration



## Principle

Configuration must be copied when runtime execution begins.

---



## Pattern

```

Template

↓

Configuration Snapshot

↓

Exercise Session

```

---



## Reason

Future changes must not alter historical interpretation.

---



## Example

A TUOD routine changes from:

```

3 darts allowed

```

to:

```

6 darts allowed

```

Old sessions must still represent:

```

3 darts allowed

```

---



# Rule 6 — Explicit Domain Models



## Principle

Important concepts receive dedicated entities.

---



## Prefer

```

exercise_sessions

turns

darts

game_configurations

```

---



## Avoid

Generic structures:

```

events

metadata

properties

attributes

````

---



## Exception

Metadata tables may exist for genuinely dynamic information.

They must not replace core domain modelling.

---



# Rule 7 — Use JSON Only for Flexible Data



## Principle

JSON is allowed only where relational modelling is inappropriate.

---



## Good Usage

Examples:

- external API payload storage
- optional metadata
- experimental features

---



## Bad Usage

Avoid:

```json
{
 "game_type": "501",
 "legs": 3,
 "double_out": true
}
````

when these values affect:

- rules
- validation
- statistics

---

## Reason

Important domain information should remain queryable.

---

# Rule 8 — Database Enforces Integrity

## Principle

Invalid states should be prevented at the database level.

---

## Required Usage

Use:

- foreign keys
- NOT NULL constraints
- CHECK constraints
- UNIQUE constraints

---

## Example

Avoid:

```sql
score INTEGER
```

Prefer:

```sql
score INTEGER CHECK(score >= 0)
```

---

# Rule 9 — Prefer Lookup Tables for Domain States

## Principle

Business states should be data-driven.

---

## Prefer

```
game_statuses

id

implementation_key

name
```

---

## Avoid

```sql
status VARCHAR
```

with application-defined values.

---

## Reason

Lookup tables provide:

- extensibility
- validation
- metadata
- localization support

---

# Rule 10 — Shared Primary Key Relationships

## Principle

Use shared primary keys when two entities have a strict one-to-one relationship.

---

## Example

```
exercise_sessions

id


501_configurations

id REFERENCES exercise_sessions(id)
```

---

## Benefits

- guaranteed relationship
- efficient joins
- clear ownership

---

# Rule 11 — Avoid Nullable Columns as a Default

## Principle

Nullable columns represent optional data.

They should not compensate for poor modelling.

---

## Avoid

```
games

501_specific_field

tuod_specific_field

singles_specific_field
```

with many NULL values.

---

## Prefer

Separate configuration entities.

---

# Rule 12 — Time Is Always Explicit

## Principle

Temporal information is important.

---

## Required

Use:

```
TIMESTAMPTZ
```

---

## Store Meaningful Events

Examples:

```
created_at

started_at

completed_at

ended_at
```

---

Avoid relying on implicit ordering.

---

# Rule 13 — Deletion Strategy

## Principle

Historical data should normally not be deleted.

---

## Runtime Data

Hard deletion is discouraged.

---

## Reference Data

Should generally be:

- unpublished
- deprecated
- archived

---

## User Data

Deletion strategy must consider:

- privacy requirements
- historical integrity
- future commercialization

---

# Rule 14 — Version Important Definitions

## Principle

Anything that influences gameplay interpretation should support versioning.

---

## Examples

- rulesets
- game definitions
- scoring algorithms

---

## Reason

Historical data requires historical definitions.

---

# Rule 15 — Design for Replayability

## Principle

The database must preserve enough information to reconstruct past sessions.

---

A replay should not require:

- current configuration
- current game rules
- current frontend logic

---

Required information should exist in runtime records.

---

# Rule 16 — Avoid Premature Multi-Tenancy

## Principle

Design for future expansion without introducing unnecessary complexity.

---

## Current State

Personal usage.

---

## Future

Potential:

- multiple users
- teams
- organizations

---

## Rule

Do not introduce tenant_id columns everywhere until a real multi-tenant requirement exists.

The architecture should allow it later.

---

# Rule 17 — Prefer Explicit Relationships

## Principle

Relationships should be visible.

---

Prefer:

```
exercise_session_id
```

over:

```
parent_id
```

---

Reason:

Explicit relationships improve:

- readability
- maintainability
- tooling support

---

# Rule 18 — Migration Compatibility

## Principle

Database changes must consider existing data.

---

Before changing schema:

Consider:

- old records
- API compatibility
- replay behaviour
- statistics correctness

---

# Database Design Review Checklist

Before approving a schema change:

## Modelling

- Is the domain represented correctly?
- Are relationships explicit?
- Is duplication justified?

---

## Integrity

- Can invalid data enter the database?
- Are constraints sufficient?

---

## Historical Data

- Does replay remain possible?
- Is runtime data immutable?

---

## Analytics

- Can required statistics be derived?

---

## Future Growth

- Can new game types and routines be added?

---

## Complexity

- Is this the simplest correct design?

---

# Final Principle

A database is not a passive storage mechanism.

It is the foundation that protects the correctness, history and future evolution of the application.

Good database design makes future features easier.

Bad database design makes every future feature more expensive.

````

---

## Self-review

I would rate this draft **9.9/10**.

The remaining improvements are intentionally postponed because they deserve dedicated documents:

### Next document: `03-Migrations.md`

That will define:

- migration folder structure
- naming
- ordering
- transactional rules
- rollback strategy
- seed data handling
- environment strategy
- development workflow

### Later documents will cover:

`04-Indexes.md`

- indexing strategy
- partial indexes
- composite indexes
- query-driven optimization

`05-Views.md`

- analytics views
- API read models
- materialized views
- statistics architecture

At this point the database philosophy is fully aligned with the earlier architectural decisions:

- immutable runtime data
- replayability
- extensible game types
- routine composition
- future multi-user expansion
- AI-agent friendly development rules

The next logical step is therefore **05-Database/03-Migrations.md**.

---

---

## Prompt

now draft [03-Migrations.md](http://03-Migrations.md)

## Response

Good. This document is particularly important because migrations are where otherwise clean database architectures often degrade.

A well-designed schema can still become chaotic if migrations are:

- too large,
- unclear,
- environment-dependent,
- irreversible,
- mixed with business logic,
- or manually modified after deployment.

This document defines the **database evolution process**.

The goal is:

> Any developer or AI agent should be able to recreate the database from zero, understand every change, and safely evolve the schema.

---

```markdown
````

# Database Migration Strategy

> **Version:** 1.0.0
>
> This document defines the rules and workflow for creating, reviewing and applying PostgreSQL database migrations.
>
> Migrations are the controlled history of database evolution.
>
> Every schema change must be represented through migrations.

---

# Purpose

The migration system ensures:

- reproducible database environments
- traceable schema evolution
- safe deployments
- easier debugging
- reliable collaboration between developers and AI agents

The database should always be reproducible from:

```

Initial migration

-

Migration history

=

Current database state

```

---

```



# Migration Principles



## Principle 1 — Database Changes Are Code

Database changes are treated with the same discipline as application code.

A migration must be:

- version controlled
- reviewed
- documented
- reproducible

Manual production changes are prohibited.

---



# Principle 2 — Small Single-Purpose Migrations

Each migration should have one clear responsibility.

---



## Good

```

001_create_extensions.sql

002_create_reference_tables.sql

003_create_players.sql

004_create_game_types.sql

```

---



## Avoid

```

001_initial_database.sql

```

containing:

- all tables
- indexes
- views
- seed data
- functions

---



## Reason

Small migrations provide:

- easier debugging
- clearer history
- safer rollback
- easier code review

---



# Principle 3 — Migration Order Represents Dependency Order

Migrations must follow the dependency graph.

General order:

```

Extensions

↓

Types / Domains

↓

Reference Tables

↓

Core Entities

↓

Dependent Entities

↓

Indexes

↓

Views

↓

Functions / Triggers

↓

Seed Data

```

---



# Migration Folder Structure

The database repository should use:

```

database/

migrations/

    0001_extensions.sql

    0002_reference_tables.sql

    0003_player.sql

    0004_game_types.sql

    0005_runtime_tables.sql

    0006_indexes.sql

    0007_views.sql

```

---



# Migration Naming

Pattern:

```

<sequence>\_<description>.sql

```

Example:

```

0012_add_game_status_lookup.sql

```

---

Rules:

- sequence numbers are incremental
- names are descriptive
- names use snake_case
- names describe the change, not the ticket number

---



# Migration Immutability

Once a migration has been applied to a shared environment:

```

DO NOT MODIFY IT

```

---



## Reason

The migration history represents reality.

Changing old migrations creates:

- inconsistent environments
- deployment problems
- unreliable history

---



## Correction

Create a new migration.

Example:

```

0015_fix_game_status_constraint.sql

```

not:

```

0012_add_game_status_lookup.sql

````

modified afterwards.

---



# Transaction Rules

Migrations should run inside transactions whenever possible.

---

Preferred:

```sql
BEGIN;

CREATE TABLE example (...);

COMMIT;
````

---

## Exception

Operations that cannot run inside transactions may be separated.

Example:

- certain PostgreSQL index operations

These exceptions should be documented.

---

# Migration Responsibilities

A migration may contain:

## Allowed

- tables
- columns
- constraints
- indexes
- views
- functions
- triggers
- seed reference data

---

## Not Allowed

Avoid:

- application logic
- temporary data fixes
- environment-specific values
- user-generated data

---

# Schema Creation Rules

Every table creation migration should include:

- primary key
- foreign keys
- required constraints
- timestamps
- indexes where required

A table should not be created incomplete and fixed later without reason.

---

# Adding Columns

Adding columns requires considering:

- existing records
- nullability
- default values
- API compatibility

---

## Safe Addition

Example:

```sql
ALTER TABLE players
ADD COLUMN nickname TEXT;
```

nullable first if existing data exists.

---

## Dangerous

```sql
ALTER TABLE players
ADD COLUMN level INTEGER NOT NULL;
```

without a migration strategy.

---

# Removing Columns

Columns should not be removed immediately.

Use a deprecation strategy.

---

Recommended:

```
Release 1

Column still exists

↓

Release 2

Application stops using column

↓

Release 3

Column removed
```

---

# Renaming Columns

Avoid direct renames when compatibility matters.

Preferred approach:

```
Add new column

↓

Copy data

↓

Update application

↓

Remove old column
```

---

# Foreign Key Changes

Foreign key changes must consider:

- existing invalid data
- migration ordering
- application compatibility

---

# Index Migrations

Indexes should usually be created separately from table creation.

Reason:

- clearer ownership
- easier performance review
- easier optimization

---

Example:

```
0010_create_turns.sql

0011_add_turn_indexes.sql
```

---

# View Migrations

Views should be created after all required tables exist.

---

Order:

```
Tables

↓

Constraints

↓

Indexes

↓

Views
```

---

# Seed Data Strategy

Seed data is divided into:

## Reference Data

Allowed.

Examples:

- game types
- statuses
- features

---

## User Data

Not allowed.

Examples:

- players
- games
- sessions

---

# Reference Data Rules

Reference data should:

- have stable implementation keys
- be idempotent
- be version controlled

---

Example:

```sql
INSERT INTO game_statuses (...)
VALUES (...)
ON CONFLICT DO NOTHING;
```

---

# Environment Strategy

The database exists in multiple environments.

Example:

```
Development

↓

Testing

↓

Production
```

---

Rules:

All environments must be reproducible from:

```
base migrations

+

seed migrations
```

---

# Development Workflow

When changing the database:

1. Update design documentation if required.
2. Create migration.
3. Apply migration locally.
4. Verify schema.
5. Update API code.
6. Test behaviour.
7. Commit migration.

---

# AI Migration Workflow

AI-generated migrations must be reviewed before use.

AI must verify:

- dependency order
- naming conventions
- constraints
- rollback implications
- existing architecture

AI should never:

- modify existing migrations
- invent table structures without documentation
- bypass constraints

---

# Migration Review Checklist

Before merging a migration:

## Structure

- Does the filename follow conventions?
- Is the migration single-purpose?

---

## Safety

- Does it preserve existing data?
- Are destructive operations justified?

---

## Integrity

- Are constraints present?
- Are relationships correct?

---

## Compatibility

- Does the API still work?
- Does replay remain possible?

---

## Documentation

- Are relevant architecture documents updated?

---

# Rollback Strategy

Rollback support should be considered.

However, production rollback is not always safe.

For destructive changes prefer:

```
forward migration
```

instead of:

```
rollback migration
```

---

# Database Reset Strategy

A clean environment should always be reproducible.

The expected process:

```
Drop database

↓

Run all migrations

↓

Run seed data

↓

Ready environment
```

---

# Final Principle

Migrations are the historical record of the database.

They should be:

- small
- explicit
- immutable
- understandable

A future developer should be able to reconstruct not only what the database looks like, but why it became that way.

```

---

## Self-review

I would rate this **9.8/10**.

The document is intentionally strict, but there are two areas I would refine later during the global review:

### 1. Migration tooling

We haven't decided yet whether the project will use:

- Neon migrations,
- Prisma migrations,
- Drizzle migrations,
- Flyway,
- Liquibase,
- raw SQL migrations,
- another tool.

I deliberately kept this tool-agnostic.

### 2. Roll-forward strategy

For a production-grade system, we may want a stronger policy around:

- expand/contract migrations,
- zero-downtime deployments,
- backwards-compatible API versions.

That becomes more important when moving from personal use toward commercialization.

---

The next document should therefore be:

```

05-Database/04-Indexes.md

```

This will be very relevant for this specific darts application because your workload has two very different access patterns:

1. **Write-heavy gameplay capture**
  - activities
  - sessions
  - turns
  - darts
2. **Read-heavy analytics**
  - progression
  - accuracy
  - averages
  - historical comparisons

The indexing strategy needs to support both without slowing down dart ingestion.

---
```
