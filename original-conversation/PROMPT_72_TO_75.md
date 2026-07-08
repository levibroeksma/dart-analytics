## Prompt

your repsonses are fragmatized due to markdown in markdown in markdown. This makes it almost impossible to extract the correct changes. Please draft the entire 00-Overview including changes

## Response

Understood. For document reviews, I will avoid nested markdown formatting and provide a single complete replacement document when changes are required. This makes it directly copyable into the repository.

Below is the complete revised `05-Database/00-Overview.md`.

```md
# Database Architecture Overview

> **Version:** 1.0.0
>
> This document defines the database architecture philosophy, structure and operating principles of the PostgreSQL database.
>
> It describes how persistent data is modelled, stored, accessed and evolved throughout the lifetime of the application.
>
> Individual table definitions, migrations and SQL implementation details are documented separately.

---

# Purpose

The database is the foundation of the application.

Its primary responsibilities are:

- storing authoritative domain data
- preserving historical gameplay
- enforcing data integrity
- enabling reliable analytics
- supporting deterministic replay
- providing efficient access patterns

The database is not merely a storage layer.

It is the authoritative representation of the application's domain.

---

# Database Philosophy

The database follows a relational-first approach.

The design prioritizes:

- correctness
- consistency
- data integrity
- explainability
- long-term maintainability

The default approach is:
```

Normalize first.

Denormalize only with evidence.

```

---

# Database Layers

The database is separated into logical layers.

---

## Reference Layer

Contains controlled application definitions.

Examples:

- game types
- ruleset versions
- statuses
- features
- dart zones
- participant types
- stage types

Reference data changes infrequently and uses SMALLINT identifiers.

Reference data should not contain user-specific information.

---

## Template Layer

Contains reusable definitions.

Examples:

- exercise templates
- routine templates
- routine steps

Templates define possible exercises, not executed gameplay.

Templates may evolve over time.

---

## Runtime Layer

Contains actual user activity.

Examples:

- activities
- exercise sessions
- exercise configurations
- participants
- exercise stages
- turns
- darts

Runtime data represents actual gameplay and training history.

Active runtime sessions may be updated while gameplay is in progress.

Completed runtime sessions represent historical truth and should not be modified.

---

## Read Model Layer

Contains database views used by the API.

The API should query views instead of directly depending on tables.

Views provide:

- stable application contracts
- centralized query logic
- reduced coupling between API and database structure

---

## Analytics Layer

Contains derived insights.

Examples:

- statistics
- progression metrics
- accuracy calculations
- performance analysis

Analytics are derived from stored facts.

The analytics layer must never become a second source of truth.

---

# Technology

The database platform is:

```

PostgreSQL

```

The database is hosted using:

```

Neon PostgreSQL

```

The application communicates with PostgreSQL exclusively through the API layer.

The frontend must never directly access the database.

---

# Database Responsibilities

The database owns:

---

## Domain Data

Examples:

- players
- games
- exercises
- routines
- configurations
- darts

---

## Historical Truth

Completed gameplay is stored as immutable historical data.

The database must always be able to answer:

- What happened?
- When did it happen?
- Under which configuration?
- What rules were active?
- What did the player throw?

Historical records must contain enough information to reproduce gameplay without relying on mutable templates or definitions.

---

## Integrity

The database enforces:

- relationships
- valid references
- allowed values
- uniqueness
- consistency rules

Application validation complements database validation.

It does not replace it.

---

## Analytics Foundation

The database provides the foundation for:

- statistics
- progression tracking
- performance analysis
- training insights

Analytics are derived from stored facts.

---

# Database Layer Architecture

The logical architecture is:

```

Reference Layer

↓

Template Layer

↓

Runtime Layer

↓

Read Model Layer

↓

Analytics Layer

```

---

# Runtime Event Model

Gameplay is represented as an event hierarchy.

```

Exercise Session

```
    ↓
```

Exercise Stage

```
    ↓
```

Turn

```
    ↓
```

Dart

```

The dart is the smallest recorded gameplay event.

A dart stores:

- intended target
- intended dart zone
- actual target
- actual dart zone
- score

This enables:

- deterministic replay
- detailed analytics
- future coaching features
- performance analysis

Analytics should be derived from these stored events.

---

# Schema Organization

The database currently uses:

```

public

```

The public schema contains:

- domain tables
- reference tables
- views
- database functions

Future separation into additional PostgreSQL schemas should only be introduced when it improves architecture.

Examples:

- ownership boundaries become unclear
- security isolation is required
- deployment independence is required

Schema separation should not be introduced prematurely.

---

# Data Ownership Model

Every piece of data has exactly one owner.

Examples:

| Data | Owner |
| --- | --- |
| Authentication identity | Authentication provider |
| Player profile | Database |
| Gameplay history | Runtime tables |
| Game definitions | Reference tables |
| Statistics | Views |

The application database never stores authentication credentials.

Authentication identity is referenced only through external identifiers.

Duplicated ownership creates inconsistency.

---

# Identifier Strategy

Identifiers follow the type of entity.

---

## Domain Entities

Domain entities use:

```

UUIDv7

```

Examples:

- players
- activities
- exercise sessions
- turns
- darts
- templates

UUIDv7 provides:

- global uniqueness
- time ordering
- improved index locality
- distributed generation capability

UUIDs should be generated at creation time.

---

## Reference Entities

Reference entities use:

```

SMALLINT

```

Examples:

- game statuses
- dart zones
- participant types
- stage types
- feature definitions

Reference entities are controlled, small datasets and do not require globally unique identifiers.

---

# Timestamp Strategy

All timestamps use:

```

TIMESTAMPTZ

````

No exceptions.

---

## Required Timestamp Columns

Persistent entities should generally contain:

```sql
created_at TIMESTAMPTZ NOT NULL
````

Entities with lifecycle changes may additionally contain:

```sql
updated_at TIMESTAMPTZ
```

---

# Historical Data Strategy

The database distinguishes between:

## Mutable Configuration

Examples:

- templates
- user preferences
- future settings

and:

## Immutable Runtime Records

Examples:

- completed games
- thrown darts
- finished sessions

Historical records should never depend on mutable data.

---

# Configuration Strategy

Configuration follows the pattern:

```
Template

↓

Snapshot

↓

Runtime
```

Example:

```
TUOD Training Template

↓

TUOD Configuration Snapshot

↓

Exercise Session
```

---

## Ruleset Versioning

Rulesets follow the same principle.

A runtime session references the exact ruleset version that was active when the session started.

Rulesets are immutable after publication.

Historical gameplay must never depend on the latest ruleset definition.

A ruleset change creates a new version instead of modifying an existing one.

---

# Query Philosophy

The database supports two primary workloads.

---

## Transactional Workload

Responsible for:

- creating sessions
- storing gameplay
- updating active state

Optimized through:

- correct indexes
- constraints
- efficient writes

---

## Analytical Workload

Responsible for:

- statistics
- progression
- insights

Optimized through:

- views
- materialized views when justified
- aggregation strategies

---

# Views as Data Contracts

The application should prefer consuming database views instead of raw tables.

Pattern:

```
Tables

↓

Views

↓

API

↓

Frontend
```

Benefits:

- stable contracts
- optimized queries
- reduced coupling
- easier evolution

---

# Materialized Views

Materialized views should only be introduced when:

- calculations are expensive
- data changes infrequently
- performance measurements justify caching

They should never replace proper indexing or schema design.

---

# Constraints Philosophy

The database should prevent invalid states whenever possible.

Use:

- foreign keys
- unique constraints
- check constraints
- exclusion constraints
- not-null constraints

A valid state should be representable.

An invalid state should be difficult or impossible to create.

---

# Migration Philosophy

Database changes are managed through versioned migrations.

Every migration:

- has one responsibility
- is deterministic
- is reviewable
- can recreate the database from scratch

Migration strategy is documented separately.

---

# Database Design Goals

The database should support:

## Current Requirements

- personal darts tracking
- training routines
- game history
- progression analytics
- replay functionality

---

## Future Expansion

Without redesign:

- multiple users
- teams
- tournaments
- online games
- AI opponents
- coaching tools
- advanced analytics

---

# Database Anti-Goals

The database should not become:

- a frontend state store
- a business workflow engine
- an analytics cache containing duplicated truth
- a generic key-value storage system

The database should not store:

- transient UI state
- frontend interaction state
- calculated statistics that can be derived from stored events

---

# Final Principle

The database represents reality.

The API represents application behaviour and business workflows.

The frontend represents interaction.

Keeping these responsibilities separate is the foundation of a maintainable system.

```

This version can directly replace the current file. It now matches the frozen schema decisions:

- UUIDv7 + SMALLINT distinction
- runtime event model
- immutable historical records
- ruleset versioning
- views as API contracts
- Neon/PostgreSQL architecture
- AI-agent-friendly principles

Next we can review `05-Database/01-Naming-Conventions.md` using the same full-document replacement approach if changes are needed.
```

---

## Prompt

Do it exactly the same, draft 01-naming-convetions.md completely with applied changes

## Response

Below is the complete revised `05-Database/01-Naming-Conventions.md`.

I have aligned it with the frozen database decisions:

- UUIDv7 for domain entities
- SMALLINT for reference entities
- implementation keys as stable contracts
- PostgreSQL naming conventions
- snake_case naming
- migration and view conventions
- AI-agent-friendly consistency rules

This should replace the existing document completely.

```md
# Database Naming Conventions

> **Version:** 1.0.0
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

````

Examples:

Correct:

```sql
exercise_session
created_at
implementation_key
````

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
game_rulesets
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
exercise_configuration.configuration
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
chk_darts_score_positive

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

    game_type_id SMALLINT NOT NULL,

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

```

```

---

## Prompt

Great do the same for the next file that needs updating. draft the entire file again with applied changes

## Response

The next file in order is `05-Database/02-Design-Rules.md`.

I have rewritten it completely and aligned it with the frozen architecture decisions:

- relational-first approach
- facts vs derived data
- immutable runtime model
- ruleset versioning
- configuration snapshots
- controlled denormalisation
- views as read contracts
- reference tables instead of enums
- AI-agent-safe database evolution principles

Replace the existing file completely with the following:

```md
# Database Design Rules

> **Version:** 1.0.0
>
> This document defines the mandatory design rules for PostgreSQL database development.
>
> These rules ensure consistency, maintainability and predictable evolution of the database architecture.
>
> All database changes must comply with these principles.

---

# Core Principle

The database represents reality.

The database is responsible for storing:

- authoritative domain data
- historical events
- relationships
- constraints
- persistent configuration

The database is not responsible for:

- frontend state
- temporary application state
- workflow orchestration
- business process execution

Responsibility boundaries:
```

Database

```
↓
```

API

```
↓
```

Frontend

```

The database stores facts.

The API applies behaviour.

The frontend manages interaction.

---

# Relational First Design

The default database design approach is:

```

Normalize first.

Denormalize only with evidence.

```

Normalization is preferred because it provides:

- data consistency
- clear ownership
- reduced duplication
- easier maintenance

Denormalisation is allowed only when:

- query performance requires it
- the duplicated value has a clear owner
- consistency can be guaranteed

---

# Single Source of Truth

Every piece of information must have exactly one authoritative owner.

Examples:

| Data | Owner |
| --- | --- |
| Authentication identity | Authentication provider |
| Player profile | Database |
| Game definitions | Reference tables |
| Gameplay events | Runtime tables |
| Statistics | Derived views |

Duplicating ownership creates inconsistency.

---

# Entity Design Rules

## Tables Represent Domain Concepts

Tables must represent meaningful domain entities.

Good examples:

```

players

exercise_sessions

turns

darts

```

Avoid tables that represent implementation details:

```

frontend_states

temporary_objects

ui_cache

```

---

# Primary Key Rules

All domain entities use:

```

UUIDv7

```

Examples:

- players
- activities
- sessions
- turns
- darts
- templates

Reference entities use:

```

SMALLINT

````

Examples:

- statuses
- dart zones
- participant types
- stage types

Reference tables are controlled datasets and do not require globally unique identifiers.

---

# Foreign Key Rules

Relationships must always be represented using foreign keys.

Do not store relationships as:

- text values
- duplicated identifiers
- JSON references

Example:

Preferred:

```sql
player_id UUID NOT NULL
````

Avoid:

```sql
player_name TEXT
```

Foreign keys protect data integrity.

---

# Reference Data Rules

Reference data describes controlled application concepts.

Examples:

- game types
- rulesets
- statuses
- features
- dart zones

Reference tables should:

- use SMALLINT identifiers
- contain implementation keys
- contain human-readable names
- be managed through migrations and seeds

---

# Implementation Key Rules

Implementation keys are stable application contracts.

Examples:

```
501

TUOD

ACTIVE

DOUBLE

INNER_BULL
```

Rules:

- implementation keys are unique
- implementation keys must not change after publication
- display names may change
- APIs should prefer implementation keys over database identifiers

Example:

Database:

```
id = 5

implementation_key = DOUBLE
```

The application should depend on:

```
DOUBLE
```

not:

```
5
```

---

# Runtime Data Rules

Runtime data represents actual user activity.

Examples:

- sessions
- stages
- turns
- darts

Runtime data must preserve historical truth.

---

## Active Runtime Data

Active gameplay may be updated.

Examples:

- current session state
- unfinished turns
- temporary progress

---

## Completed Runtime Data

Completed gameplay is immutable.

After completion:

- do not overwrite events
- do not modify historical results
- do not change referenced rules

Corrections should be represented explicitly.

---

# Runtime Event Model

Gameplay follows an event hierarchy:

```
Exercise Session

        ↓

Exercise Stage

        ↓

Turn

        ↓

Dart
```

The dart is the smallest gameplay event.

A dart stores facts:

- intended target
- intended zone
- actual target
- actual zone
- score

The database should store what happened.

Interpretation belongs to derived queries.

---

# Facts Versus Derived Data

The database stores facts.

Examples:

Stored:

```
intended_zone = DOUBLE

hit_zone = SINGLE

score = 20
```

Derived:

```
double_accuracy = 43%

miss_direction = outside

average_checkout_percentage
```

Derived values should normally be calculated through:

- views
- queries
- analytical processes

Do not store calculated values unless there is a proven performance reason.

---

# Controlled Denormalisation

Some duplication is intentionally allowed.

Example:

A turn stores:

```
total_score
```

Although it can be calculated from darts.

Reason:

- turns are frequently queried
- score retrieval is common
- recalculation would add unnecessary overhead

This is controlled denormalisation.

Every denormalised value must document:

- source of truth
- update responsibility
- reason for duplication

---

# Configuration Rules

Configuration follows:

```
Template

↓

Snapshot

↓

Runtime
```

Templates define reusable possibilities.

Snapshots capture the configuration used during execution.

Runtime records reference the snapshot.

---

## Historical Stability Rule

Historical gameplay must never depend on mutable configuration.

Example:

Incorrect:

```
Finished Game

    ↓

Current TUOD Ruleset
```

Correct:

```
Finished Game

    ↓

TUOD Ruleset Version 3
```

Rulesets are immutable after publication.

Changes create new versions.

---

# Ruleset Design Rules

Rulesets:

- belong to game types
- are versioned
- are immutable after publication
- define allowed configuration options

Never modify a published ruleset.

Instead:

```
Ruleset v1

↓

Ruleset v2
```

Historical sessions continue referencing v1.

---

# JSONB Usage Rules

JSONB is allowed for flexible configuration.

Examples:

```
exercise_configuration.configuration
```

JSONB should be used for:

- variable configuration
- extensible metadata
- future options

JSONB should not replace relational modelling.

Do not store:

- relationships
- core domain entities
- frequently queried fields

inside JSON.

---

# View Rules

Views are the preferred read interface for the API.

Pattern:

```
Tables

↓

Views

↓

API

↓

Frontend
```

Views should:

- simplify complex queries
- hide internal schema complexity
- provide stable contracts

The API should avoid directly depending on table structures.

---

# Index Rules

Indexes must be created based on query patterns.

Do not automatically index:

- every foreign key
- every column
- every searchable field

Every index must justify:

- expected query
- performance improvement
- write overhead

---

# Constraint Rules

The database should prevent invalid states whenever possible.

Use:

- primary keys
- foreign keys
- unique constraints
- check constraints
- not-null constraints

Application validation complements database validation.

It does not replace database integrity.

---

# Migration Rules

Every migration must:

- have one responsibility
- be deterministic
- be reversible where practical
- be reviewable
- follow naming conventions

Avoid:

- large migrations containing unrelated changes
- mixing schema changes and data changes without reason
- modifying previous migrations after deployment

---

# Seed Rules

Seeds contain controlled reference data.

Seeds must:

- use stable identifiers
- be deterministic
- be environment independent

Examples:

```
dart_zones

game_statuses

duration_types
```

Seeds should not contain:

- user data
- runtime data
- test sessions

---

# Naming Rules

All database objects must follow:

- lowercase
- snake_case
- descriptive terminology

Avoid:

- abbreviations
- generic names
- implementation-specific terminology

See:

```
01-Naming-Conventions.md
```

for detailed rules.

---

# Schema Evolution Rules

Before adding a new table ask:

1. Is this a real domain concept?
2. Does it have a clear owner?
3. Is it persistent data?
4. Can it be derived instead?
5. Does an existing entity already represent this?

Avoid adding tables to solve temporary problems.

---

# AI Development Rules

AI-generated database changes must follow the same standards as human-created changes.

Before creating or modifying database structures, the AI agent must:

1. Review existing entities.
2. Check ownership boundaries.
3. Determine whether the data is a fact or derived value.
4. Determine whether a table, view or reference entry is appropriate.
5. Create migrations instead of modifying production structures directly.

---

# Final Principle

A good database design makes invalid states difficult to create and valid states easy to understand.

Every table, column, constraint and relationship must have a clear purpose.

The database should remain understandable years after its initial creation.

```

This version now matches the current implementation direction and can serve as the governing rule set for future migrations and AI-assisted development.
```

---
