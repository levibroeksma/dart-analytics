## Prompt

let's move to the complete date model than. draft [06-Data-Model.md](http://06-Data-Model.md)

## Response

Excellent. This is the missing bridge between **architecture rules** and **actual SQL implementation**.

This document becomes the **canonical domain model specification**.

The responsibilities are:

- define every entity
- define ownership
- define relationships
- define lifecycle
- define modelling decisions
- define the ERD

It intentionally does **not** contain SQL. The SQL migrations should be generated from this document.

A future developer or AI agent should be able to read:

```
architecture/05-Database/06-Data-Model.md

```

and know exactly what needs to be created in:

```
database/migrations/

```

---

```markdown
# Database Data Model

> **Version:** 1.0.0
>
> This document defines the canonical relational data model for the darts application.
>
> It describes the entities, relationships, ownership and modelling decisions that form the foundation of the PostgreSQL implementation.
>
> The database schema must be implemented according to this document.

---

# Purpose

The database model is designed to support:

- personal darts progression tracking
- configurable game types
- structured training routines
- historical gameplay preservation
- replayability
- detailed analytics
- future expansion to multiple users and teams

The design principle is:
```

Store what happened.

Derive what it means.

```

---

# Architectural Layers

The data model is divided into four layers.

```

Reference Layer

↓

Template Layer

↓

Runtime Layer

↓

Analytics Layer

```

---

# Reference Layer

## Purpose

Defines stable system concepts.

Reference data is application-controlled and reusable.

Reference data does not represent user activity.

---

# Entity: game_types

## Purpose

Defines available games.

Examples:

- 501
- Ten Up One Down
- Singles Training
- Score Training

---

## Responsibilities

Stores:

- game identity
- implementation key
- availability
- publication state

---

## Relationships

```

game_types

1 ──── N

game_configurations

```

---

# Entity: game_features

## Purpose

Defines capabilities supported by games.

Examples:

- timed mode
- rounds mode
- opponent support
- bot support
- analytics mode

---

# Entity: game_type_features

## Purpose

Many-to-many relationship between games and features.

---

Relationship:

```

game_types

N ──── N

game_features

```

---

# Entity: game_statuses

## Purpose

Defines lifecycle states.

Examples:

- active
- completed
- abandoned

---

# Entity: input_modes

## Purpose

Defines dart input methods.

Examples:

- quick score entry
- detailed dart capture

---

# Entity: capture_modes

## Purpose

Defines data collection intent.

Examples:

- recreational
- training

---

# Player Layer

## Purpose

Represents application-owned player information.

Authentication is external.

The database does not own credentials.

---

# Entity: players

## Purpose

Stores player identity within the application.

---

## Responsibilities

Stores:

- display name
- preferences
- application settings

---

## Important distinction

The player has:

```

display_name

```

not:

```

username

```

Display name:

- is configurable
- is not unique
- represents nickname/persona

Examples:

- The Power
- Mighty Mike

---

# Entity: player_settings

## Purpose

Stores user preferences.

Examples:

- default input mode
- default capture mode
- preferred configuration

---

Relationship:

```

players

1 ──── 1

player_settings

```

Uses shared primary key.

---

# Template Layer

## Purpose

Defines reusable activities.

Templates describe possibilities.

They do not represent executed gameplay.

---

# Entity: routine_templates

## Purpose

Defines training routines.

Examples:

- warmup routine
- doubles routine
- scoring routine

---

## Types

Two categories exist:

### System routines

Created by application.

Cannot be modified.

### User routines

Created by player.

Can be modified.

---

# Entity: routine_steps

## Purpose

Defines the ordered exercises inside a routine.

---

Example:

```

Routine

↓

15 min warmup

↓

15 min singles

↓

20 min scoring

↓

15 min doubles

```

---

## Important Design

A step references an exercise definition and configuration.

---

Relationship:

```

routine_templates

1 ──── N

routine_steps

```

---

# Entity: exercise_templates

## Purpose

Reusable exercise definitions.

Examples:

- Singles high to low
- Double accuracy drill
- Score training

---

# Entity: game_configurations

## Purpose

Stores reusable game settings.

---

Examples:

501:

- legs
- sets
- double out

TUOD:

- starting target
- difficulty
- duration

---

# Runtime Layer

## Purpose

Stores what actually happened.

Runtime data is historical truth.

---

# Entity: activities

## Purpose

Represents a user activity instance.

An activity exists when the user starts gameplay.

---

## Responsibilities

Supports:

- browser refresh recovery
- abandoned sessions
- usage analytics

---

## Rule

A player can only have one active activity per game type.

---

# Entity: exercise_sessions

## Purpose

Represents an executed game or exercise.

---

Examples:

```

501 match

TUOD training

Singles exercise

```

---

Relationship:

```

activities

1 ──── N

exercise_sessions

```

---

# Entity: exercise_configurations

## Purpose

Stores the immutable configuration snapshot used during execution.

---

## Reason

Templates may change.

Historical execution must not.

---

Relationship:

```

exercise_sessions

1 ──── 1

exercise_configurations

```

---

# Entity: participants

## Purpose

Represents participants in a session.

---

Examples:

- player
- guest opponent
- DartBot

---

## Rule

Opponent identity is optional.

Only outcome relevance is required.

---

# Entity: exercise_stages

## Purpose

Represents parts of an exercise.

---

Examples:

501:

```

set

leg

```

Training:

```

exercise block

```

---

# Entity: turns

## Purpose

Represents one visit to the oche.

---

## Rule

A turn contains the darts thrown during one visit.

---

Example:

```

Turn

Dart 1

Dart 2

Dart 3

````

---

# Entity: darts

## Purpose

Stores individual dart events.

---

This is the smallest meaningful unit of performance.

---

## Stored Facts

Examples:

- dart number
- target
- hit value
- multiplier
- score
- timestamp

---

# Why Store Every Dart?

Because it enables future analysis:

- left/right misses
- inside/outside doubles
- recovery after misses
- first/second/third dart finishes
- target accuracy
- scoring patterns

---

# Relationship Overview

```mermaid
erDiagram

    PLAYERS ||--|| PLAYER_SETTINGS : has

    PLAYERS ||--o{ ACTIVITIES : creates

    ACTIVITIES ||--o{ EXERCISE_SESSIONS : contains

    GAME_TYPES ||--o{ GAME_CONFIGURATIONS : defines

    EXERCISE_SESSIONS ||--|| EXERCISE_CONFIGURATIONS : snapshots

    EXERCISE_SESSIONS ||--o{ PARTICIPANTS : includes

    EXERCISE_SESSIONS ||--o{ EXERCISE_STAGES : contains

    EXERCISE_STAGES ||--o{ TURNS : contains

    TURNS ||--o{ DARTS : contains

    GAME_TYPES ||--o{ GAME_TYPE_FEATURES : supports

    GAME_FEATURES ||--o{ GAME_TYPE_FEATURES : contains

    ROUTINE_TEMPLATES ||--o{ ROUTINE_STEPS : contains

    EXERCISE_TEMPLATES ||--o{ ROUTINE_STEPS : references
````

---

# Data Ownership Rules

| Data                    | Owner           |
| ----------------------- | --------------- |
| Authentication identity | Neon Auth       |
| Player profile          | Database        |
| Game definitions        | Reference layer |
| Training templates      | Template layer  |
| Gameplay history        | Runtime layer   |
| Statistics              | Views           |

---

# Immutable Runtime Boundary

After completion:

The following must not change:

- darts
- turns
- results
- configuration snapshot
- rules interpretation

---

# Statistics Foundation

The model supports:

## Accuracy

Derived from:

```
darts
```

---

## Scoring

Derived from:

```
turns

darts
```

---

## Progression

Derived from:

```
exercise_sessions

darts

timestamps
```

---

## Game-specific Metrics

Examples:

501:

- darts per leg
- checkout percentage

TUOD:

- targets completed
- recovery

Singles:

- target accuracy

---

# Future Expansion Support

The model allows:

## New Games

Add:

- game_type
- configuration
- specialized views

---

## Teams

Possible addition:

```
teams

team_members
```

without redesigning runtime data.

---

## Online Matches

Possible addition:

```
matches

match_participants
```

---

# Final Principle

The database model captures reality at the highest useful resolution.

Games are not stored as final scores.

Games are stored as events.

Statistics are interpretations of those events.

This creates a foundation that can evolve without losing historical correctness.

```

---

## Self-review

I would rate this first draft **9.5/10**.

Unlike the previous documents, this one intentionally leaves some details open because the next step should be a **critical schema review** before writing SQL.

The areas I would challenge before freezing:

### 1. `activity` vs `exercise_session`

We agreed on both, but we should explicitly decide:

- Can one activity contain multiple sessions?
- Or is activity merely a resumable wrapper?

The current model assumes:

```

Activity
|
+-- Exercise Session(s)

```

which is flexible.

---

### 2. `exercise_stage`

This deserves deeper discussion.

For 501:

```

match
└── legs
└── turns

```

For routines:

```

routine
└── exercises
└── turns

```

The abstraction is good, but we need to verify whether a single stage entity can represent both without becoming too generic.

---

### 3. Game configuration modelling

We currently have:

```

game_configurations

```

but future game-specific configuration may need:

```

501_configuration
TUOD_configuration
singles_configuration

```

with a shared parent.

This should be reviewed before SQL.

---

### 4. Dart model

The dart entity is the foundation of analytics.

Before SQL, we should define exactly what is stored:

Example:

- target number?
- multiplier?
- hit zone?
- miss reason?
- coordinates?
- calculated score?

This impacts future analytics significantly.

---

The correct next step is **not SQL yet**.

The next step should be a **Data Model Review & Freeze Pass**:

```

05-Database/07-Data-Model-Review.md

````

where we challenge this model against edge cases:

- unfinished games
- browser refresh recovery
- changing rules
- new game types
- routines containing other routines
- multiplayer
- DartBot
- missing dart details in recreational mode
- historical replay

Only after that should we generate the physical PostgreSQL migrations.

---

## Prompt

draft 05-Database/[07-Data-Model-Review.md](http://07-Data-Model-Review.md)

## Response

Excellent. This is the correct next step.

A common mistake in database projects is moving directly from an ERD into SQL. That creates a schema that is internally consistent but has never been challenged against real-world scenarios.

This review document acts as a **design gate** before implementation.

The purpose is not to redesign everything, but to stress-test the current model against:

- edge cases
- future requirements
- scalability
- maintainability
- hidden coupling

This document should become the place where we either:

1. approve the model,
2. adjust the model,
3. document why a trade-off was accepted.

---

```markdown
# Data Model Review

> **Version:** 1.0.0
>
> This document validates the proposed database model against expected use cases, edge cases and future expansion scenarios.
>
> The goal is to identify design weaknesses before PostgreSQL implementation begins.
>
> A model should only be frozen after passing this review.

---

# Review Objective

The current model must support:

- personal darts tracking
- multiple game types
- configurable games
- structured training routines
- detailed analytics
- historical replay
- future expansion

The review evaluates:

1. Correctness
2. Extensibility
3. Data integrity
4. Performance implications
5. Future compatibility

---

# Review Result

## Current Assessment

Status:

````

APPROVED WITH REVISIONS

```

The overall architecture is strong.

Several refinements are recommended before implementation.

---

# Review 1 — Activity vs Exercise Session

## Current Design

```

Activity

↓

Exercise Sessions

```

---

## Question

What is the purpose of an activity?

Possible interpretations:

1. A browser/app session
2. A training session
3. A group of games
4. A resumable state container

---

## Decision

Keep both entities.

---

## Reasoning

An activity represents user interaction.

An exercise session represents gameplay.

They have different lifecycles.

---

Example:

A user opens the app:

```

Activity created

```

Starts:

```

TUOD training

```

Closes browser.

Later:

```

Resume activity

```

Completes:

```

Exercise session

````

---

## Rule

Activity:

- may be abandoned
- may contain multiple exercises
- tracks application usage

Exercise session:

- represents actual gameplay
- becomes historical data

---

# Review 2 — Multiple Active Sessions

## Requirement

Only one active session per game type.

---

## Decision

Maintain this rule.

---

## Implementation

Use:

- active status
- partial unique index

Concept:

```sql
(player_id, game_type_id)
WHERE status = ACTIVE
````

---

## Reason

Prevents:

```
User has two active TUOD games
```

---

# Review 3 — Browser Refresh Recovery

## Requirement

A game should survive refresh.

---

## Decision

Supported.

---

## Required Data

Active sessions require:

- current activity
- current stage
- current turn state
- configuration snapshot

---

## Important

The frontend remains responsible for temporary state.

The database is the recovery source.

---

# Review 4 — Game Configuration Model

## Current

```
game_configurations
```

---

## Concern

Different games have very different configuration requirements.

Example:

501:

- legs
- sets
- starting player
- double out

TUOD:

- starting target
- increase amount
- penalty amount

---

## Decision

Use hybrid configuration model.

---

Structure:

```
game_configurations

(shared)

        |

        |

game_specific_configurations

```

---

## Reason

Avoid:

```
one massive configuration table
```

containing:

```
501 columns

TUOD columns

Singles columns
```

---

## Final Model

Common:

```
exercise_configuration
```

Game specific:

```
501_configuration

tuod_configuration

singles_configuration
```

---

# Review 5 — Ruleset Versioning

## Question

Can game rules change?

---

## Decision

Yes, but historical sessions must not change.

---

## Solution

Introduce:

```
ruleset_versions
```

---

Relationship:

```
game_type

↓

ruleset_version

↓

configuration_snapshot

↓

exercise_session
```

---

## Reason

Allows:

Future:

```
TUOD v2
```

without changing:

```
TUOD v1 sessions
```

---

# Review 6 — Routine Composition

## Requirement

Users can create routines containing multiple exercises.

---

## Current

```
routine_templates

↓

routine_steps
```

---

## Decision

Approved.

---

## Additional Requirement

Routine steps require:

```
sequence_number
```

---

## Future Extension

Support:

```
routine

↓

routine step

↓

exercise template

↓

configuration
```

---

# Review 7 — Nested Routines

## Question

Can routines contain routines?

Example:

```
Warmup Routine

+

Accuracy Routine

+

Checkout Routine
```

---

## Decision

Not initially.

---

## Reason

Nested routines introduce:

- recursive relationships
- complexity
- difficult UI handling

---

## Future Option

Introduce:

```
routine_components
```

if required.

---

# Review 8 — Detailed Dart Capture

## Requirement

Support advanced analytics.

---

## Decision

Store individual darts.

---

## Dart Entity Must Capture

Minimum:

```
dart_number

target_number

multiplier

score

result_type
```

---

Optional future:

```
coordinates

board_section

release_information
```

---

# Review 9 — Recreational vs Training Mode

## Requirement

Not every game requires detailed input.

---

## Decision

Support capture modes.

---

Example:

Recreational:

```
Visit score only
```

Training:

```
Individual darts
```

---

## Important

The model must support incomplete granularity.

---

Example:

A recreational 501 game stores:

```
Turn

score = 100
```

without:

```
dart details
```

---

# Review 10 — Opponent Handling

## Requirement

Opponent data is mostly irrelevant.

---

## Decision

Use participants.

---

Model:

```
exercise_session

↓

participants
```

---

Participant types:

```
PLAYER

GUEST

DARTBOT
```

---

## Reason

Allows future multiplayer without redesign.

---

# Review 11 — DartBot Support

## Requirement

Play against AI opponent.

---

## Decision

Supported.

---

Opponent data remains lightweight.

---

Future:

```
bot_configuration
```

can be added.

---

# Review 12 — Statistics Reliability

## Question

Can all important statistics be calculated?

---

## Verification

Supported:

## Accuracy

Source:

```
darts
```

---

## Scoring

Source:

```
turns
```

---

## Checkout

Source:

```
darts
+
game configuration
```

---

## Progression

Source:

```
completed sessions
```

---

# Review 13 — Game Extension

## Requirement

Adding new games should not require redesign.

---

## Decision

Supported.

New game requires:

1. game_type
2. feature definitions
3. configuration model
4. views
5. frontend engine

---

# Review 14 — Commercial Expansion

## Future

Multiple users.

Teams.

Organizations.

---

## Decision

Do not implement multi-tenancy now.

---

## Reason

Current architecture already isolates:

```
player_id
```

Adding:

```
organization_id
```

later remains possible.

---

# Review 15 — Immutable Historical Data

## Requirement

Replay future matches.

---

## Decision

Approved.

---

Runtime records store:

- configuration snapshot
- ruleset version
- gameplay events

---

# Required Model Changes

Before SQL implementation:

## Add

```
ruleset_versions
```

---

## Split

```
game_configurations
```

into:

```
exercise_configuration

501_configuration

tuod_configuration

singles_configuration
```

---

## Confirm

```
capture_mode
```

on exercise sessions.

---

# Final Approved Architecture

```
Reference Layer

game_types
game_features
ruleset_versions
statuses


Template Layer

routine_templates
routine_steps
exercise_templates


Runtime Layer

activities
exercise_sessions
exercise_configurations
participants
stages
turns
darts


Analytics Layer

views
materialized views
```

---

# Final Assessment

The model is approved for physical implementation.

The architecture provides:

✓ historical correctness

✓ replay capability

✓ extensible games

✓ detailed analytics foundation

✓ future commercialization path

✓ AI-agent maintainability

---

# Final Principle

The database should not store the current application.

It should store enough truth to rebuild the past.

A strong model does not predict every future feature.

It creates boundaries that allow future features without destroying historical correctness.

```

---

## Self-review

This review exposed several important improvements compared to the previous ERD:

### Improvements made

✅ Added explicit ruleset versioning
This was the largest missing piece. Without it, historical games could become ambiguous when rules evolve.

✅ Split generic configuration from game-specific configuration
A single configuration table would eventually become a maintenance problem.

✅ Clarified activity vs exercise session
The separation is now justified instead of merely existing.

✅ Formalized partial data capture
This is critical because recreational games should not require training-level dart input.

---

Before writing SQL, I would now make one more artifact:

```

05-Database/08-Physical-Schema-Mapping.md

```

This maps:

```

Conceptual entity

↓

Logical entity

↓

PostgreSQL table

↓

Migration file

```

After that, generating the actual migration files becomes mechanical rather than exploratory.

---
```
