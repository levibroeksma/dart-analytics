<!--
status: historical
scope: database/design-gate
read-when: decision archaeology only
updated: 2026-07-11
-->

# Data Model Review

> **Version:** 1.0.1
>
> **Status: HISTORICAL RECORD.** This design-gate review (verdict: APPROVED WITH REVISIONS) validated the logical model before SQL implementation. It is preserved as-is; the canonical, current description of the database is `06-Database-Specification.md`.
>
> This document validates the proposed database model against expected use cases, edge cases and future expansion scenarios.
>
> The goal is to identify design weaknesses before PostgreSQL implementation begins.
>
> A model should only be frozen after passing this review.

---

# Superseded Decisions

The following details evolved after this review and differ in the final implementation:

| This review | Final implementation |
| ----------- | -------------------- |
| Dart captures `target_number`, `multiplier`, `result_type` | Intention + result model: `intended_target_number`/`intended_zone_id`, `hit_target_number`/`hit_zone_id`. No multiplier column (derived from zone); no result_type (derived by comparing intention and result) |
| Single generic dart capture | `dart_zones` reference table (SINGLE, DOUBLE, TREBLE, OUTER_BULL, INNER_BULL, MISS) |
| All entities UUIDv7 | Hybrid: UUIDv7 for domain entities, SMALLINT for lookup tables |
| Turn tracks running remainder | Turn stores `total_score` + `completed_at`; remainders derived |
| Configuration presets undecided | `configuration_templates` JSONB preset table (migration 0010) |

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

```
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
```

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
```

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
