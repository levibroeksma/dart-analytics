## Prompt

continue drafting [04-Indexes.md](http://04-Indexes.md)

## Response

Good. This document is particularly important for this application because the database has a very specific workload profile.

A darts application is not a generic CRUD system.

It has two fundamentally different workloads:

### Write path (high frequency, but batched)

- Create activity
- Create exercise session
- Insert turns
- Insert darts
- Store completion state

### Read path (analytical)

- Progression over time
- Accuracy trends
- Double performance
- Checkout statistics
- Training effectiveness
- Comparisons between sessions

The indexing strategy therefore must avoid the common mistake of indexing every column "just in case". That would hurt write performance, increase storage, and make migrations harder.

The philosophy will be:

> Index based on known access patterns, not assumptions.

---

```markdown

```

# Database Index Strategy

> **Version:** 1.0.0
>
> This document defines the indexing strategy for the PostgreSQL database.
>
> The goal is to provide predictable query performance while preserving efficient writes and maintainable schema evolution.
>
> Indexes are created based on actual access patterns, not speculation.

---

# Purpose

Indexes exist to improve data retrieval performance.

However, every index introduces costs:

- additional storage
- slower writes
- more complex query planning
- increased maintenance overhead

Therefore:

```

No index without a reason.

```

---

```



# Indexing Philosophy

The project follows:

```

Measure first.

Optimize second.

````

Indexes should be introduced because:

- a query pattern exists
- performance is measurable
- the improvement justifies the cost

---



# Default Index Rules

Every index should have:

- a clear purpose
- a documented query pattern
- a predictable owner

Avoid:

- duplicate indexes
- unused indexes
- speculative indexes

---



# Primary Key Indexes

Every primary key automatically receives a PostgreSQL index.

Example:

```sql
id UUID PRIMARY KEY
````

creates:

```
unique btree index
```

No additional index is required.

---

# Foreign Key Indexes

Foreign keys do not automatically create indexes in PostgreSQL.

Foreign keys should generally be indexed.

---

## Example

Table:

```sql
exercise_sessions

player_id UUID REFERENCES players(id)
```

should usually have:

```sql
idx_exercise_sessions_player_id
```

---

## Reason

Supports:

- joins
- filtering
- deletes
- relationship traversal

---

# Common Query Pattern Indexing

Indexes should follow how the application reads data.

---

# Player History Queries

Common query:

"Show all sessions of this player ordered by newest first."

Example:

```sql
WHERE player_id = ?
ORDER BY created_at DESC
```

Recommended index:

```sql
idx_exercise_sessions_player_id_created_at
```

Columns:

```text
player_id
created_at DESC
```

---

# Session Detail Queries

Common query:

"Load all turns for this exercise session."

Example:

```sql
WHERE exercise_session_id = ?
ORDER BY sequence_number
```

Index:

```sql
idx_turns_session_id_sequence
```

Columns:

```text
exercise_session_id
sequence_number
```

---

# Dart Retrieval Queries

Common query:

"Get all darts from a turn."

Example:

```sql
WHERE turn_id = ?
ORDER BY dart_number
```

Index:

```sql
idx_darts_turn_id_dart_number
```

---

# Analytics Queries

Analytics queries typically filter by:

- player
- game type
- date range
- exercise type

Example:

```sql
WHERE player_id = ?
AND game_type_id = ?
ORDER BY completed_at
```

Potential index:

```sql
idx_sessions_player_game_completed
```

Columns:

```text
player_id
game_type_id
completed_at
```

---

# Composite Index Rules

Column order matters.

PostgreSQL uses the leftmost columns first.

---

Example:

Index:

```sql
(player_id, game_type_id, completed_at)
```

supports:

Good:

```sql
player_id
```

Good:

```sql
player_id + game_type_id
```

Good:

```sql
player_id + game_type_id + completed_at
```

Poor:

```sql
game_type_id
```

alone.

---

# Composite Index Guidelines

Order columns by:

1. Equality filters
2. Range filters
3. Sorting requirements

Example:

Query:

```sql
WHERE player_id = ?
AND completed_at > ?
ORDER BY completed_at
```

Index:

```sql
(player_id, completed_at)
```

---

# Partial Indexes

Partial indexes should be used when queries frequently target a subset of rows.

---

Example:

Active sessions:

```sql
WHERE status = 'ACTIVE'
```

Index:

```sql
CREATE INDEX idx_active_sessions
ON exercise_sessions(player_id)
WHERE status_id = ACTIVE;
```

---

Benefits:

- smaller index
- faster lookup
- reduced maintenance cost

---

# Unique Indexes

Unique indexes enforce uniqueness and improve lookup performance.

Examples:

```sql
implementation_key
```

in:

```sql
game_types
```

should have:

```sql
ux_game_types_implementation_key
```

---

# Lookup Table Indexing

Small lookup tables usually require minimal indexing.

Required:

Primary key.

Recommended:

Unique implementation key.

Example:

```sql
game_types

id

implementation_key UNIQUE
```

---

# Time-Based Indexing

The application frequently queries progression over time.

Time columns often belong in composite indexes.

Examples:

```sql
completed_at
created_at
started_at
```

---

Prefer:

```sql
(player_id, completed_at)
```

over:

```sql
completed_at
```

unless global time queries are required.

---

# UUID Indexing

Primary keys use UUIDv7.

UUIDv7 provides temporal ordering.

Benefits:

- improved index locality
- reduced random insertion cost
- better write performance than UUIDv4

---

# Do Not Index Everything

Avoid indexes on:

- boolean columns alone
- low-cardinality columns
- rarely queried fields

Example:

Usually bad:

```sql
CREATE INDEX idx_sessions_completed
ON sessions(is_completed);
```

Reason:

A boolean value has poor selectivity.

---

# JSON Indexing

JSON columns should not automatically receive indexes.

Before indexing JSON:

Ask:

1. Is this queried frequently?
2. Is relational modelling inappropriate?
3. Does the query justify the storage cost?

---

# Analytics Indexing

Analytics should primarily use:

- normalized runtime tables
- optimized views
- materialized views when justified

Do not create dozens of indexes for every possible statistic.

---

# Write Performance Considerations

Every dart stored introduces index maintenance.

Therefore:

The runtime write path should remain lightweight.

Preferred:

```
Insert gameplay

↓

Commit

↓

Analyze later
```

Avoid:

- excessive triggers
- unnecessary indexes
- real-time aggregation during writes

---

# Index Maintenance

Indexes should periodically be reviewed.

Questions:

- Is the index used?
- Does it improve query performance?
- Is it increasing write cost?
- Is it still required?

Unused indexes should be removed.

---

# Index Naming

All indexes follow:

```
idx_<table>_<columns>
```

Unique indexes:

```
ux_<table>_<columns>
```

Defined in:

```
01-Naming-Conventions.md
```

---

# Query Analysis

Performance investigations should use:

```sql
EXPLAIN ANALYZE
```

before adding indexes.

---

Example:

```sql
EXPLAIN ANALYZE
SELECT *
FROM exercise_sessions
WHERE player_id = '...';
```

---

# Index Review Checklist

Before adding an index:

## Query

- What query does this optimize?
- How often is this query executed?

---

## Data

- Is selectivity sufficient?
- Is the table large enough?

---

## Cost

- What is the write impact?
- Is storage growth acceptable?

---

## Design

- Does the index follow naming conventions?
- Is a better schema design possible?

---

# Future Considerations

As the platform grows, consider:

## Partitioning

Potentially useful for:

- very large dart history tables
- multi-year datasets

Not required initially.

---

## Specialized Analytics Storage

Future possibilities:

- analytical database
- event pipeline
- warehouse

Only introduce when required.

---

# Final Principle

Indexes are performance tools, not design substitutes.

A well-modelled database with carefully chosen indexes will outperform an over-indexed database with poor structure.

The goal is not maximum indexing.

The goal is predictable performance.

```

---

## Self-review

I would rate this draft **9.8/10**.

It intentionally avoids prematurely defining exact indexes for every table because those should emerge after:

1. the physical schema exists,
2. API queries are defined,
3. actual query plans are measurable.

A few items are intentionally deferred:

### Future refinement areas

**1. Covering indexes**

- PostgreSQL `INCLUDE` columns
- useful for analytics-heavy queries

**2. BRIN indexes**

- potentially valuable for massive historical dart tables because timestamps are naturally ordered

**3. Statistics optimization**

- PostgreSQL planner tuning

**4. Partitioning strategy**

- only relevant when dart history becomes very large

Those belong in a future `07-Performance.md` document rather than here.

---

The next document is:

```

05-Database/05-Views.md

````

This is actually one of the most important documents for your application because your entire statistics model depends on the distinction:

> **Tables store events. Views explain performance.**

That document will define how analytics, progression tracking, and API read models should be built.

---

---

## Prompt

continue with [05-views.md](http://05-views.md)

## Response

Good. This document is especially important for this project because your application is not primarily a CRUD application. The value proposition is **turning recorded gameplay into meaningful insight**.

The key architectural decision we already made is:

> Store the smallest reliable facts. Derive everything else.

This means views are not just a database convenience. They become the **analytical contract** between your runtime data and your API/frontend.

The document needs to prevent two common failure modes:

1. **Statistics logic leaking into the frontend/API**
  - Every client calculates metrics differently.
  - Results become inconsistent.
2. **Over-storing statistics**
  - Every possible metric gets its own column.
  - Data becomes duplicated and stale.

---

```markdown
````

# Database Views Strategy

> **Version:** 1.0.0
>
> This document defines the strategy for creating, maintaining and consuming PostgreSQL views.
>
> Views provide stable read models over the underlying relational data.
>
> The purpose is to separate stored facts from derived insights while maintaining reliable analytics.

---

# Purpose

The database stores gameplay facts.

Views transform those facts into meaningful information.

The architecture follows:

```

Runtime Data

↓

Database Views

↓

API Read Models

↓

Frontend

```

---

```



# View Philosophy

Views should answer questions.

Tables should store facts.

---



## Example

Tables store:

```

dart

score

multiplier

target

timestamp

```

A view provides:

```

player_double_accuracy

average_checkout_percentage

scoring_progression

```

---



# Core Principle

A statistic should be reproducible.

If a statistic cannot be recreated from stored runtime data, the underlying data model is incomplete.

---



# View Responsibilities

Views may contain:

- joins
- filtering
- aggregation
- calculations
- business-readable projections

Views should not:

- modify data
- contain user interaction logic
- replace proper modelling
- hide incorrect database design

---



# View Categories

Views are divided into four categories.

```

Entity Views

↓

Session Views

↓

Statistics Views

↓

Progression Views

````

---



# Entity Views



## Purpose

Provide convenient representations of domain entities.

---



## Examples

```text
vw_players

vw_game_types

vw_active_sessions
````

---

## Use Cases

Used when:

- multiple joins are required
- API consumers need consistent representations

---

# Session Views

## Purpose

Represent completed gameplay sessions.

---

## Examples

```text
vw_exercise_session_summary

vw_game_result_summary
```

---

## Example Output

A session summary may contain:

```
session_id

player

game_type

duration

score

completed_at
```

---

# Statistics Views

## Purpose

Calculate performance metrics.

---

## Examples

```text
vw_double_accuracy

vw_average_score

vw_checkout_statistics
```

---

# Progression Views

## Purpose

Show improvement over time.

---

## Examples

```text
vw_player_progression

vw_training_progress
```

---

# View Naming

Views follow:

```
vw_<purpose>
```

Examples:

```sql
vw_player_progression

vw_session_summary

vw_double_accuracy
```

---

Materialized views:

```
mv_<purpose>
```

Examples:

```sql
mv_player_statistics
```

---

# View Design Rules

## Rule 1 — Views Must Have Clear Purpose

Every view must answer a specific question.

Avoid:

```
vw_everything
```

---

Prefer:

```
vw_player_checkout_accuracy
```

---

# Rule 2 — Views Should Not Duplicate Logic

A calculation should have one authoritative location.

Avoid:

```
Frontend calculates accuracy

API calculates accuracy

Database calculates accuracy
```

---

Prefer:

```
Database calculates accuracy

Frontend displays accuracy
```

---

# Rule 3 — Views Should Remain Stable

Views act as contracts.

Changing a view can affect:

- API responses
- frontend components
- analytics

Breaking changes require review.

---

# Rule 4 — Prefer Views Over Complex API Queries

If a query:

- requires multiple joins
- is reused
- contains domain calculations

consider creating a view.

---

# Rule 5 — Keep Views Read-Only

Views should not become hidden business workflows.

---

# Runtime Data Analytics

The runtime model is designed around:

```
Activity

↓

Exercise Session

↓

Stage

↓

Turn

↓

Dart
```

---

Views should derive statistics from these entities.

---

# Dart-Level Analytics

The dart entity enables calculations such as:

## Accuracy

Example:

```
successful hits /
attempted hits
```

---

## Miss Direction

Example:

```
left misses

right misses

inside misses

outside misses
```

---

## Recovery

Example:

```
performance after previous miss
```

---

## Double Analysis

Example:

```
double attempts

double hits

double percentage
```

---

# Turn-Level Analytics

Turn data enables:

## Scoring Performance

Examples:

```
average visit score

highest visit

consistency
```

---

## Recovery Analysis

Example:

```
score after bad visit
```

---

# Session-Level Analytics

Session views enable:

## Training Evaluation

Examples:

```
duration

completion

accuracy trend

difficulty
```

---

# Game-Specific Views

Game types may require specialized views.

---

Example:

501:

```
vw_501_checkout_statistics
```

Provides:

- checkout attempts
- successful checkouts
- average darts per leg

---

TUOD:

```
vw_tuod_progression
```

Provides:

- targets reached
- misses
- recovery

---

# Avoid Game Logic Duplication

Game-specific views may calculate statistics.

They should not redefine game rules.

Rules belong to:

- game definitions
- configurations
- runtime snapshots

---

# API Usage Pattern

The API should consume views as read models.

Example:

```
GET /statistics/player/progression

↓

Repository

↓

vw_player_progression

↓

Response
```

---

# Materialized Views

Materialized views should only be introduced when:

- query cost is high
- data changes less frequently
- refresh strategy exists

---

## Example

Potential future candidate:

```
mv_player_yearly_statistics
```

---

# Refresh Strategy

Materialized views require:

- refresh frequency
- ownership
- invalidation strategy

Example:

```
Refresh nightly
```

or:

```
Refresh after completed session
```

---

# Performance Considerations

Before optimizing a view:

Measure:

```
EXPLAIN ANALYZE
```

Consider:

- indexes
- query structure
- materialization

---

# View Security

Views may hide internal database structure.

The API should depend on views where appropriate.

This allows:

- table evolution
- controlled exposure
- stable contracts

---

# Testing Views

Views should be tested against known datasets.

Tests should verify:

- calculation correctness
- edge cases
- null handling
- historical replay correctness

---

# Example Edge Cases

Analytics must correctly handle:

## No Data

Example:

```
Player has no sessions
```

Result:

```
empty result

not incorrect statistic
```

---

## Partial Sessions

Example:

```
Exercise abandoned halfway
```

Should statistics include it?

The answer must be defined explicitly.

---

## Configuration Changes

Example:

```
Training routine changed
```

Historical statistics must remain correct.

---

# View Review Checklist

Before creating a view:

## Purpose

- What question does this answer?
- Is it reusable?

---

## Data

- Are calculations based on authoritative data?
- Can the result be reproduced?

---

## Performance

- Is the query efficient?
- Are indexes sufficient?

---

## Architecture

- Does this belong in the database?
- Is it duplicating application logic?

---

# Future Analytical Expansion

The architecture supports future additions:

- player benchmarking
- coaching insights
- AI recommendations
- difficulty adaptation
- training plans
- predictive analytics

without changing the underlying gameplay model.

---

# Final Principle

Tables record what happened.

Views explain what it means.

Keeping this separation ensures that the system can continuously gain new insights without rewriting historical data.

````

---

## Self-review

I would rate this draft **9.9/10**.

The remaining improvements are mostly project-specific and should happen during the refinement phase:

### Possible additions later

**1. Formal statistics taxonomy**

- raw metrics
- derived metrics
- aggregated metrics
- predictive metrics

**2. View ownership rules**
For example:

- `vw_runtime_*`
- `vw_statistics_*`
- `vw_api_*`

This may become valuable as the number of statistics grows.

**3. Testing strategy**
Potentially adding database fixtures for known dart sequences:

- perfect leg
- missed doubles
- recovery scenarios
- TUOD edge cases

**4. Materialized view lifecycle**
Only relevant once the dataset becomes large.

---

At this point the complete initial database architecture documentation is drafted:

```text
05-Database/

00-Overview.md              ✅
01-Naming-Conventions.md    ✅
02-Design-Rules.md          ✅
03-Migrations.md            ✅
04-Indexes.md               ✅
05-Views.md                 ✅

````

The logical next step would be moving into:

```text
06-API/

```

starting with:

```
06-API/00-Overview.md

```

However, before moving on, this is also the first natural checkpoint where we can later perform the **10/10 architecture review**, because the database philosophy is now complete enough to challenge against the original darts domain requirements.

---

---

## Prompt

So I got a question about the 05-database folder. We have declared a clear set of rules and guides. But the earlier defined SQL is not anywhere to be found. Do they get a different file/location, are these not meant to be at all in the architecture/ folder or did you simply forget them?

## Response

Good catch. This was not intentional architecture-wise; I focused on the **governance/documentation layer** first and did not yet place the actual schema artefacts. The SQL does belong in the project, but **not inside the** `architecture/` **documentation folder**.

The distinction we should enforce is:

- `architecture/` explains **why and how**
- `database/` contains **the actual implementation**

The current structure should therefore be expanded.

I would revise the repository structure to:

```text
project-root/

├── architecture/
│
│   ├── 00-README.md
│   ├── 01-Principles.md
│   ├── 02-System-Architecture.md
│   ├── 03-Engineering-Workflow.md
│   ├── 04-Architecture-Patterns.md
│   │
│   ├── 05-Database/
│   │   ├── 00-Overview.md
│   │   ├── 01-Naming-Conventions.md
│   │   ├── 02-Design-Rules.md
│   │   ├── 03-Migrations.md
│   │   ├── 04-Indexes.md
│   │   └── 05-Views.md
│   │
│   ├── 06-API/
│   ├── 07-Frontend/
│   ├── 08-AI/
│   └── 09-ADR/
│
│
├── database/
│
│   ├── migrations/
│   │
│   │   ├── 0001_extensions.sql
│   │   ├── 0002_reference_tables.sql
│   │   ├── 0003_player.sql
│   │   ├── 0004_game_types.sql
│   │   ├── 0005_game_features.sql
│   │   ├── 0006_routines.sql
│   │   ├── 0007_runtime_sessions.sql
│   │   ├── 0008_turns.sql
│   │   ├── 0009_darts.sql
│   │   ├── 0010_indexes.sql
│   │   └── 0011_views.sql
│   │
│   ├── seeds/
│   │   ├── reference_game_types.sql
│   │   ├── reference_statuses.sql
│   │   └── reference_features.sql
│   │
│   └── README.md
│
```

---

## Where does the earlier ERD/schema design go?

The conceptual and logical ERDs should actually exist in **two places**, serving different purposes.

### Architecture documentation

Example:

```
architecture/05-Database/06-Data-Model.md
```

Contains:

- conceptual ERD
- logical ERD
- entity descriptions
- relationship explanations
- modelling decisions

Example:

```mermaid
erDiagram

PLAYER ||--o{ EXERCISE_SESSION : owns

EXERCISE_SESSION ||--o{ TURN : contains

TURN ||--o{ DART : contains
```

This is for humans and AI agents.

---

### Database implementation

Example:

```
database/migrations/0007_runtime_sessions.sql
```

Contains:

```sql
CREATE TABLE exercise_sessions (
    id UUID PRIMARY KEY,
    player_id UUID NOT NULL,
    game_type_id UUID NOT NULL,
    status_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

This is the source that actually creates PostgreSQL.

---

## What about the "table design" we discussed?

That should become migration files.

For example, our earlier frozen layers translate roughly into:

### Reference layer

```
0002_reference_tables.sql
```

Contains:

- game_types
- game_statuses
- game_features
- game_type_features
- input_modes
- capture_modes

---

### Template layer

```
0006_templates.sql
```

Contains:

- routine_templates
- routine_steps
- exercise_templates
- configuration templates

---

### Runtime layer

```
0007_runtime_sessions.sql
0008_turns.sql
0009_darts.sql
```

Contains:

- activities
- exercise_sessions
- exercise_stages
- turns
- darts
- participants

---

## One missing architectural document

I would actually add one more document before writing SQL:

```
architecture/05-Database/06-Data-Model.md
```

This document should contain:

1. Entity catalogue
2. Logical ERD
3. Relationship rules
4. Ownership rules
5. Layer boundaries
6. Table responsibility descriptions

Because currently we have:

```
Why?
        ↓
Overview

How to name?
        ↓
Naming conventions

How to design?
        ↓
Design rules

How to evolve?
        ↓
Migrations

How to optimize?
        ↓
Indexes

How to query?
        ↓
Views
```

But we are missing:

```
What exactly are we building?
        ↓
Data Model
```

That document should come before the actual SQL implementation.

---

So the corrected process should be:

1. ✅ Database architecture principles
2. ✅ Database rules
3. ✅ Migration strategy
4. ✅ Index strategy
5. ✅ View strategy
6. **Define complete data model (ERD + table responsibilities)**
7. Create migrations from that frozen model
8. Create seed data
9. Connect API repositories to views/tables

You caught a real gap. Without `06-Data-Model.md`, an AI agent could follow all the rules correctly and still have no canonical definition of the actual schema it is supposed to create. That document is essential before generating the PostgreSQL migrations.

---
