<!--
status: canonical
scope: architecture/training-routines
read-when: training routines, exercises, exercise engines, configurable/adaptive training
updated: 2026-09-20
-->

# Training, Exercise and Exercise Engine Architecture

> Scope: Training routines, exercises, exercise engines, configurable training, adaptive training
> Applies to: Domain model, frontend runtime architecture, configuration model, future analytics/coaching
> Relationship: Extends the existing GameEngine, ruleset, configuration snapshot and runtime-session architecture

---

## 1. Purpose

This document defines the architectural model for introducing structured training routines and exercises into Dart Analytics.

The design must support:

* predefined training routines supplied by the application;
* reusable exercise types;
* configurable exercise instances within routines;
* existing game engines being used as exercises;
* exercises that do not require a game engine;
* stateful `ExerciseEngine` implementations;
* detailed analytics-mode dart input;
* future user-created routines;
* future adaptive routines based on player weaknesses;
* future algorithmic or AI-assisted coaching;
* immutable historical training data;
* continued expansion without redesigning existing game engines.

The design extends the existing architecture rather than introducing a separate architectural paradigm.

The core principle is:

> **Definitions describe, configuration specializes, orchestration composes, engines execute, facts measure, analytics interprets, and coaching influences future configuration.**

---

# 2. Architectural Context

The existing application already distinguishes between:

* definitions/templates;
* configuration;
* runtime sessions;
* stateful game engines;
* rulesets;
* immutable historical facts;
* derived analytics.

The training architecture follows the same philosophy.

The existing `GameEngine` remains responsible for game-specific execution and state. An `ExerciseEngine` is introduced as a parallel first-class execution abstraction for training-specific behaviour.

An exercise may optionally use a `GameEngine`, but an exercise is not intrinsically a game.

The dependency direction is:

```text
Training
    ↓
ExerciseEngine
    ↓
optional GameEngine
```

A `GameEngine` must remain independent of the exercise system.

---

# 3. Domain Terminology

## 3.1 Routine

A **Routine** is a reusable definition of a complete training.

A routine:

* contains an ordered set of exercises;
* defines the intended structure of a training;
* contains exercise configurations;
* determines the duration of each exercise;
* has a total duration derived from its exercises.

A routine is not itself the runtime execution.

Examples:

```text
45 Minute Accuracy
    Warm-up       10m
    Switching     10m
    Double Work   10m
    501           15m
```

---

## 3.2 Training

A **Training** is the runtime execution of a routine.

It is responsible for orchestration at the highest training level.

Training owns:

* the active exercise;
* exercise ordering;
* exercise transitions;
* training lifecycle;
* overall elapsed time;
* progression through the routine;
* creation/activation of exercise runtime instances.

Training does not implement exercise-specific rules.

Conceptually:

```text
Routine Definition
        ↓
     Training
        ↓
Exercise Session 1
Exercise Session 2
Exercise Session 3
...
```

The distinction is therefore:

```text
Routine  = what should happen
Training = what actually happened
```

---

## 3.3 Exercise

An **Exercise** is a focused subsection of a training.

An exercise has a specific training objective and is executed for a fixed duration.

An exercise is not necessarily a game.

Examples include:

* warm-up;
* switching between trebles;
* double patterns;
* accuracy exercises;
* checkout exercises;
* game-based exercises;
* future specialised training exercises.

Every exercise is time-bound when used in a training.

---

## 3.4 Exercise Type

An **Exercise Type** identifies the kind of exercise being used.

Examples:

```text
WARM_UP
SWITCHING
DOUBLE_PATTERN
TARGET_SCORING
SWITCHING_TARGET_SCORING
SCORE_THRESHOLD
GAME
CHECKOUT
ACCURACY
```

The exercise type determines which `ExerciseEngine` and ruleset are responsible for execution.

The type does not determine every contextual property of an exercise occurrence.

For example, `SWITCHING` can be configured differently in different routines.

---

## 3.5 Exercise Configuration

An **Exercise Configuration** describes how an exercise type is used in a particular routine.

Configuration may contain:

* duration;
* targets;
* target sequences;
* patterns;
* game selection;
* game configuration;
* exercise-specific parameters;
* future exercise-specific options.

Example:

```text
Exercise Type:
    SWITCHING

Configuration:
    duration: 10 minutes
    targets:
        T20
        T19
        T18
```

The same exercise type can therefore be used differently:

```text
Routine A
    SWITCHING
    duration: 10m
    targets: T20 → T19 → T18

Routine B
    SWITCHING
    duration: 15m
    targets: T19 → T18 → T17
```

The exercise type and engine are reusable; the configuration is contextual.

---

# 4. Routine Composition

A routine is an ordered composition of configured exercises.

```text
Routine
    │
    ├── Routine Exercise
    │      ├── Exercise Type
    │      ├── Configuration
    │      └── Duration
    │
    ├── Routine Exercise
    │      ├── Exercise Type
    │      ├── Configuration
    │      └── Duration
    │
    └── Routine Exercise
           ├── Exercise Type
           ├── Configuration
           └── Duration
```

The routine does not contain exercise implementation logic.

It only composes exercises.

This allows the routine system to remain unaware of whether an exercise is:

* game-backed;
* target-based;
* sequence-based;
* time-driven;
* or implemented through another future execution model.

---

# 5. Exercise Duration

Every exercise used in a routine has a duration.

Duration is part of the routine-specific exercise configuration rather than necessarily being an immutable property of the reusable exercise type.

An exercise type may provide:

* a default duration;
* minimum duration;
* maximum duration;
* recommended duration;

but the actual routine exercise configuration determines the duration for that routine.

Example:

```text
Exercise Type:
    DOUBLE_PATTERN

Routine A:
    duration = 5 minutes

Routine B:
    duration = 10 minutes

Routine C:
    duration = 15 minutes
```

This allows exercises to remain reusable without forcing every routine to allocate the same amount of time.

---

# 6. Routine Duration

Routine duration is derived from its exercise durations.

```text
Routine Duration
    = sum(all exercise durations)
```

The routine should not maintain an independently editable duration that can conflict with its exercises.

For example, this is invalid:

```text
Routine duration = 45m

Exercises:
10m + 10m + 10m + 20m = 50m
```

The effective routine duration is always determined by its composition.

---

# 7. Maximum Routine Duration

A routine represents one focused training block.

The initial architecture establishes:

> **A routine may not exceed 60 minutes of active training time.**

This is an intentional product and architectural constraint intended to preserve focus and training quality.

A routine therefore satisfies:

```text
0 < routine.duration <= 60 minutes
```

The first version should not silently extend routines beyond this limit through automatic breaks.

If longer training experiences become necessary in the future, they should be modelled explicitly as multiple training blocks separated by a break rather than making a routine itself exceed its maximum.

This leaves room for a future higher-level concept such as:

```text
Training Plan
    │
    ├── Training Block
    │      ≤ 60m
    │
    ├── Break
    │      10–15m
    │
    └── Training Block
           ≤ 60m
```

Such a concept is intentionally outside the current scope.

### User-Created Routine Floor (shipped, migration `0038`)

A player-authored routine additionally satisfies a floor:

```text
30 minutes <= user routine.duration <= 60 minutes
```

The floor applies only when `routine_templates.is_system_template = FALSE`. It
does not apply to system routines — the seeded "Warm-Up" routine
(`database/seeds/0015_warm_up_routine.sql`) is 5 minutes total by design, used
both standalone and as a step inside Balanced Training. Scoping the floor to
user-authored routines preserves that without a special case. See D305 and
`docs/superpowers/specs/2026-09-17-configurable-training-routines-roadmap-design.md`
§3.2-3.3 for the design; the enforcement mechanism — deferred constraint
triggers on both `routine_steps` and `routine_templates` — is
`database/migrations/0038_custom_routines.sql` (D336). The routine builder
(`app/src/lib/training/routines/routine-builder.data.ts`,
`app/src/modules/training/routines/routine-duration.module.ts`) and
`routine.service.ts` pre-check the same floor client- and server-side before
the trigger gets the final word at commit; migration `0038` is committed but
applied to no database (D336), so today only the pre-checks run in practice.
<!-- 2026-09-19 -->

### Schedule vs. Training Plan (shipped, migration `0041`)

A weekly **schedule** (`training_schedules`/`training_schedule_days`,
migration `0041`) is not the multi-block "Training Plan" this section
reserves above — it assigns one existing, unmodified ≤60-minute routine (or
rest) to each ISO weekday. A schedule composes across a week; it never
extends a single training block past its 60-minute ceiling, and a scheduled
day is still exactly one routine. See `05-Database/06-Spec/02-Template-Layer.md`
and D342. <!-- 2026-09-20 -->

---

# 8. Training Orchestration

Training owns the highest level of runtime progression.

Its responsibilities include:

```text
Training
    │
    ├── current exercise
    ├── completed exercises
    ├── upcoming exercises
    ├── overall elapsed time
    ├── exercise transitions
    └── lifecycle
```

Training does not know how an individual exercise evaluates darts.

For example:

```text
Training
    "Exercise 2 is active."
```

The active `ExerciseEngine` determines what happens inside Exercise 2.

This creates a strict separation:

```text
Training
    = orchestration

ExerciseEngine
    = exercise execution
```

---

# 9. ExerciseEngine

`ExerciseEngine` is a first-class stateful domain engine.

It is conceptually parallel to the existing `GameEngine`.

An `ExerciseEngine` owns:

* exercise state;
* exercise ruleset;
* resolved exercise configuration;
* progress;
* exercise-specific transitions;
* evaluation of relevant input;
* completion state;
* exercise facts/events.

The engine must be deterministic with respect to its inputs, configuration and ruleset.

Conceptually:

```text
ExerciseEngine
    │
    ├── Ruleset
    ├── Configuration
    ├── State
    ├── Input
    └── Facts
```

This follows the same architectural philosophy as `GameEngine`.

---

# 10. ExerciseEngine vs GameEngine

`GameEngine` and `ExerciseEngine` have different responsibilities.

## GameEngine

Answers:

> How does this game behave?

Examples:

* 501;
* TUOD;
* singles training;
* score training.

It owns game-specific state transitions and rules.

## ExerciseEngine

Answers:

> How does this training exercise behave?

Examples:

* switching;
* double patterns;
* warm-up;
* accuracy exercises.

It owns exercise-specific state transitions and evaluation.

A game may be used by an exercise, but the game engine does not know that it is being used by an exercise.

The relationship is:

```text
ExerciseEngine
      │
      │ optional dependency
      ▼
GameEngine
```

Never:

```text
GameEngine
      │
      ▼
ExerciseEngine
```

This preserves the independence and reusability of existing game engines.

---

# 11. Game-Based Exercises

A game can be used as an exercise.

For example:

```text
Exercise Type:
    GAME

Configuration:
    game:
        type: 501
        ...
    duration:
        15 minutes
```

The conceptual execution path becomes:

```text
Training
    ↓
ExerciseEngine
    ↓
GameEngine
    ↓
Game Ruleset
```

The exercise remains responsible for the exercise lifecycle and duration, while the game engine remains responsible for game mechanics.

**Delegation boundary (implemented, migration `0040`; 2026-09-20):** a GAME step's own duration *is* the game's native timed-mode clock — not a separate step timer running alongside it — so the step's `ExerciseEngine` layer never wraps or races the `GameEngine`'s own expiry; the game ends the way its standalone timer would, and that end is the step's end. The server resolves this per step from a small eligibility table (`ROUTINE_GAME_STEPS`, `app/src/services/routines/game-step.ts`), keyed by the game ruleset version the step's template pins (`exercise_templates.game_ruleset_version_id`, §7's Template Layer chapter); the client mirrors it with its own adapter table (`STEP_ADAPTERS`, `app/src/lib/training/routines/adapters/step-adapter.registry.ts`, `07-Frontend/04-Modules-And-OOP.md`). The two tables are hand-mirrored, never a shared import — the client may never import server code — and are kept in agreement only by `step-adapter.registry.test.ts`, not by the type system.

A game is routine-eligible only when all of the following hold at once:

- it has a native timed mode, so a step's minutes translate into that mode's own duration keys rather than a bolt-on clock;
- its ruleset version declares both `ANALYTICS` and `VISUAL_BOARD` in `RULESET_CAPABILITIES` (§13);
- the ruleset version key is listed in **both** `ROUTINE_GAME_STEPS` (server) and `STEP_ADAPTERS` (client).

Currently eligible: `TUOD_V1`, `SCORE_TRAINING_V1`, `121_V2`. `121_V1` (TARGET-only, no timed mode) is not eligible. A template pins exactly one eligible ruleset version; the pin is copied onto the session's configuration snapshot at Training start, the same as every other template value (§18) — it is never resolved independently on the session.

---

# 12. Non-Game Exercises

An exercise does not require a game engine.

For example:

```text
Warm-up
    ↓
ExerciseEngine
    ↓
Warm-up Ruleset
```

No scoring or game state is required.

This is intentional.

The architecture must not force all training activities into a game abstraction merely because darts are involved.

---

# 13. Analytics-Mode Input

Exercise engines operate in analytics mode whenever an exercise requires dart input.

A dart observation may include:

```text
Dart Observation
    ├── target / segment
    ├── coordinates
    ├── multiplier
    ├── sequence information
    ├── timestamp
    └── other measured properties
```

The `ExerciseEngine` interprets these observations according to its ruleset.

The engine does not need to assume that every exercise produces a conventional score.

---

# 14. Exercise Evaluation

An exercise defines how observed player actions contribute to exercise progress.

For example, a switching exercise may define:

```text
Target:
    T20

Observed:
    T20 → 2 points
    S20 → 1 point
    D20 → 0 points
    outside → 0 points
```

The same dart observation can therefore have different meanings in different domains.

For example:

```text
T20 in 501
    = 60 game points

T20 in Switching
    = 2 exercise points
```

The `GameEngine` must not be responsible for exercise-specific scoring.

The `ExerciseEngine` evaluates the observation according to its own ruleset.

---

# 15. Exercise Facts

Exercise engines should produce facts rather than assuming that every exercise produces a score.

Possible facts include:

```text
ExerciseStarted
ExerciseCompleted
TargetChanged
TargetHit
TargetMissed
SequenceAdvanced
SequenceCompleted
PhaseChanged
EvaluationRecorded
```

The exact fact model is exercise-specific and should be defined by the relevant ruleset.

Facts should contain sufficient information for later analytics without embedding coaching decisions.

---

# 16. Warm-Up Exercise

The warm-up is a deliberate example of a non-analytical exercise.

A warm-up may consist of five timed sections:

```text
1. Upper:
   5 / 20 / 1

2. Lower:
   19 / 3 / 17

3. Right:
   13 / 6 / 10

4. Left:
   8 / 11 / 14

5. Bull:
   single / double
```

The purpose is to loosen the wrist and arm and prepare the player.

It does not require dart input.

The engine primarily tracks:

```text
current phase
phase duration
elapsed time
completion
```

At section transitions, the engine may emit an event such as:

```text
ExerciseSectionChanged
```

The frontend can respond by playing the configured ping sound.

**Implemented** (`WARM_UP_V1`, `app/src/modules/training/exercises/warm-up.engine.module.ts`): each phase's configuration carries a `weight`, not a fixed `durationSeconds` — the engine splits the routine step's own total duration proportionally to weight at construction time, so the same template serves both this routine (5 phases, 5 minutes) and Balanced Training's Warm-Up step (same 5 phases, 10 minutes) without a second template. Its step session still carries no capture pair (D277) and records no dart, but its `EXERCISE_SECTION` stages — one per phase entered — upload through the same `POST /api/sessions/:id/events/batch` route as any dart-carrying step: `appendBatch` admits a turn-less batch unconditionally, since a batch with no turn has no dart to validate and needs no capture pair (D281, 2026-09-15).

The warm-up should not invent artificial performance metrics simply to conform to analytics exercises.

---

# 17. Stateful Exercise Examples

## Switching

Configuration:

```text
duration: 10m

sequence:
    T20
    T19
    T18

evaluation:
    treble: 2
    single: 1
    double: 0
    outside: 0
```

Runtime state may include:

```text
current target
sequence position
darts thrown
exercise score
progress
```

**Implemented** (`SWITCHING_V1`, `app/src/modules/training/exercises/switching.engine.module.ts`): `targets: number[]` (board numbers, e.g. `[20, 19, 18]`) and `scoring: { single, double, treble }` replace this section's `T20`/`evaluation` notation one-for-one. There is no `outside` config key — a dart landing on any number other than the visit's own current target always scores 0, by omission rather than by a configured value. Its play screen renders total points as the primary readout with target/darts/remaining-time stat rows and a three-dart visit preview, the same shape a board-input game uses (D275, 2026-09-14). Each dart is stored with the visit's current target as `intended_target_number` and `TREBLE` as `intended_zone_key` — the sequence's own aim, and what `chk_dart_target_consistency` requires once a target is set (D276, 2026-09-14). Targets run `1`–`20` only: the bull has no treble, so it cannot carry that aim, and a configuration naming `25` is rejected by `switchingValidator` rather than scored 0 in silence (D297, 2026-09-17). Its step session is created under the `ANALYTICS` + `VISUAL_BOARD` capture pair with no game pair, and uploads its darts through `POST /api/sessions/:id/events/batch` like any board-input game (D277, 2026-09-14).

---

## Double Patterns

Configuration:

```text
duration: 10m

patterns:
    D20 → D10 → D5
    D16 → D8 → D4
    D12 → D6 → D3
```

The engine tracks the current pattern and evaluates each observed dart against the intended target.

**Implemented** (`DOUBLE_PATTERN_V1`, `app/src/modules/training/exercises/double-pattern.engine.module.ts`): `patterns: number[][]` (e.g. `[[20, 10, 5], [16, 8, 4], [12, 6, 3]]`) replaces the `D20 → D10 → D5` notation — each element is a board number whose double counts. One turn is one pattern, whatever its own length: a turn stays open until it holds as many darts as the pattern it was created for, so patterns of unequal length still group their darts correctly. One point per hit double; nothing else scores. Its play screen uses the same shape as Switching's, labelling the current target `D20` and counting only a hit double as a preview hit (D275, 2026-09-14).

---

## Target Scoring

Configuration:

```text
duration: 10m

targets:
    20
    19
    18
    Bull
```

Each dart that hits the current target adds to a running chain — single 1, treble 3 on a number (the double is a miss), outer bull 1, bullseye 3 on the bull. A miss resets the chain; a miss that ends a chain holding a hit moves to the next target, and the list cycles. Rules: `docs/game-rules/training/exercises/target-scoring.md`.

**Implemented** (`TARGET_SCORING_V1`, `app/src/modules/training/exercises/target-scoring.engine.module.ts`, seed `0023`): `targets: number[]` — distinct, `1`–`20` or `25` — is the whole configuration; scoring is locked in the engine. Unlike Switching (D297) the bull is a legal target: each dart's intended zone is `TREBLE` on a number and `INNER_BULL` on `25`. One turn is one three-dart visit, whatever the target does inside it. State carries the live chain, the best chain (a chain live at timer expiry counts) and the best finished chain on the current target this run as the "to beat" mark. Capture pair and upload path match Switching (D277). Routine step only in V1 (D356).

---

## Switching Target Scoring

Configuration:

```text
duration: 10m

targets:
    20
    19
    18
```

Target Scoring's points on a three-target sequence: each hit adds to the chain and moves the aim to the next target; after the last the sequence starts again and the chain keeps growing. A miss resets the chain and restarts the sequence at the first target, even mid-visit; the sequence carries across visits. Rules: `docs/game-rules/training/exercises/switching-target-scoring.md`.

**Implemented** (`SWITCHING_TARGET_SCORING_V1`, `app/src/modules/training/exercises/switching-target-scoring.engine.module.ts`, seed `0024`): `targets` — exactly three, distinct, `1`–`20` or `25` — is the whole configuration; scoring reuses Target Scoring's `targetScoringPoints`. Intended zone, turn shape, capture pair and upload path match Target Scoring. State carries the live chain, the best chain (live at expiry counts), the best finished chain as the one "to beat" mark per run, and the count of completed sequences. Routine step only in V1 (D357).

---

## 65 or More (Score Threshold)

Configuration:

```text
duration: 10m

threshold: 65
```

Three darts, free aim: a visit beats when its board total is 65 or more. How many times can you beat it before the time runs out? Rules: `docs/game-rules/training/exercises/score-threshold.md`.

**Implemented** (`SCORE_THRESHOLD_V1`, `app/src/modules/training/exercises/score-threshold.engine.module.ts`, seed `0025`): `threshold` is the whole configuration and V1 accepts only `65`. Darts carry no intended target; `score` is the board score and the visit total its sum. A visit is judged after its third dart; one unfinished at expiry is not judged. State carries beats, judged visits, the last and running visit totals. Capture pair and upload path match Target Scoring. Routine step only in V1 (D358).

---

## Game Exercise

Configuration:

```text
duration: 15m

game:
    type: 501
    ...
```

The exercise engine orchestrates the exercise while delegating game mechanics to the 501 `GameEngine`.

**Implemented (seed `0022`; 2026-09-20):** three GAME templates are seeded, each pinning one routine-eligible ruleset version (§11) — Finishing, pinned to `TUOD_V1` (seed `0021`); Score Training (timed), pinned to `SCORE_TRAINING_V1`; and 121 (timed), pinned to game type `ONE_TWENTY_ONE`'s `121_V2`. See §11 for the eligibility rule these three satisfy and `05-Database/06-Spec/02-Template-Layer.md` for the schema.

---

# 18. Configuration Lifecycle

The training architecture follows the existing template-to-snapshot philosophy.

Conceptually:

```text
Exercise Type
        ↓
Exercise Definition
        ↓
Routine Exercise Configuration
        ↓
Resolved Training Configuration
        ↓
Exercise Session
```

For runtime correctness, the actual configuration used during a training must be snapshotted.

A completed training must not depend on a mutable routine or exercise definition.

This follows the existing architecture's Template → Snapshot lifecycle.

---

# 19. Preset Routines

A preset is not a separate runtime abstraction.

A preset is simply a predefined routine supplied by the application.

Conceptually:

```text
Routine
    ├── source = SYSTEM
    └── source = USER
```

The same routine architecture must support both.

This avoids creating separate concepts such as:

```text
PresetRoutine
UserRoutine
PresetExercise
UserExercise
```

unless a future requirement proves that they need different domain behaviour.

The important distinction is ownership and origin, not execution architecture.

---

# 20. User-Created Routines

Future users may create their own routines by composing reusable exercise types.

For example:

```text
My 45 Minute Training

    Warm-up
        10m

    Switching
        10m
        T20 → T19 → T18

    Double Pattern
        10m
        D16 → D8 → D4

    501
        15m
```

The routine builder should operate on exercise configurations rather than duplicating exercise implementations.

A user therefore selects:

```text
Exercise Type
    +
Configuration
    +
Duration
```

rather than creating a new engine.

**Status (shipped 2026-09-19, migration `0038`):** Phase 1 of
`docs/superpowers/specs/2026-09-17-configurable-training-routines-roadmap-design.md`
is built. The ownership columns this section anticipates
(`routine_templates.player_id`, `is_system_template`, migration `0004`) are
now enforced by `chk_routine_templates_player_ownership` and read through the
owner-aware `v_routine_execution`; the CRUD API (`GET`/`POST /api/routines`,
`GET`/`PUT`/`DELETE /api/routines/:routineId`, `GET /api/exercise-templates`)
and the builder UI (`/training/routines/{new,detail,edit,play}`,
`RoutineBuilder.astro`) are both built. See D305/D306, refined by D321, for
the duration-bound and endpoint-contract decisions, and D336 for the
migration itself — committed but applied to no database. <!-- 2026-09-19 -->

---

# 21. Adaptive Training

The architecture must support routines being adjusted before execution based on player performance.

A routine may begin as:

```text
45 Minute Accuracy

Warm-up       10m
Switching     10m
Doubles       10m
501           15m
```

A future adaptive system may resolve this into:

```text
Warm-up
    10m

Switching
    10m
    targets: T19/T18/T17

Doubles
    10m
    targets: D16/D8/D4

501
    15m
```

The underlying routine definition does not need to be mutated.

Instead:

```text
Routine
    ↓
Resolution
    ↓
Resolved Training Configuration
    ↓
Exercise Engines
```

Resolution may eventually be performed by:

* static configuration;
* user customization;
* deterministic algorithms;
* analytics-driven adaptation;
* AI coaching.

These are different sources of configuration, not different exercise execution architectures.

---

# 22. Coaching Boundary

Exercise and game engines must remain independent of coaching.

Engines:

> **produce facts.**

Analytics:

> **interprets historical facts.**

Coaching:

> **uses analytics to influence future training configuration.**

The intended direction is:

```text
Exercise/Game Engines
        ↓
Runtime Facts
        ↓
Analytics
        ↓
Weaknesses / Trends
        ↓
Coaching
        ↓
Training Resolution
        ↓
Exercise Configuration
        ↓
ExerciseEngine
```

An AI or coaching component must not directly modify the internal state or rules of an active engine.

This preserves determinism, testability and replaceability.

---

# 23. Runtime Immutability

Once a training has been completed, its runtime configuration and measured facts are historical truth.

Changes to:

* routine definitions;
* exercise definitions;
* exercise defaults;
* rulesets;
* adaptive algorithms;
* coaching algorithms;
* AI behaviour;

must not change historical training results.

The runtime must retain the configuration and ruleset information required to understand what was actually executed.

This follows the existing immutable runtime-data principle.

---

# 24. Separation of Concerns

The resulting architecture has the following responsibilities:

| Component              | Responsibility                                     |
| ---------------------- | -------------------------------------------------- |
| Routine                | Defines ordered training composition               |
| Training               | Orchestrates runtime progression                   |
| Exercise Type          | Identifies reusable exercise capability            |
| Exercise Definition    | Defines reusable exercise defaults and constraints |
| Exercise Configuration | Specializes an exercise for a routine              |
| ExerciseEngine         | Executes exercise-specific state and rules         |
| ExerciseRuleset        | Defines exercise behaviour                         |
| GameEngine             | Executes game-specific state and rules             |
| GameRuleset            | Defines game behaviour                             |
| Runtime Snapshot       | Preserves actual historical configuration          |
| Analytics              | Interprets historical facts                        |
| Coaching               | Generates or recommends future configuration       |

No component should absorb responsibilities belonging to another layer.

---

# 25. Architectural Dependency Direction

The preferred dependency direction is:

```text
Routine Definition
        ↓
Training
        ↓
Exercise Configuration
        ↓
ExerciseEngine
        ↓
optional GameEngine
        ↓
Domain Facts
        ↓
Analytics
        ↓
Coaching
        ↓
future Training Configuration
```

The following dependencies should be avoided:

```text
GameEngine → ExerciseEngine
GameEngine → Routine
ExerciseEngine → Analytics
ExerciseEngine → Coaching
Analytics → active ExerciseEngine state
AI → active GameEngine state
```

Engines execute domain behaviour. They do not become orchestration, analytics or coaching services.

---

# 26. Extensibility Requirements

Adding a new exercise should not require modification of existing exercise engines.

A new exercise should conceptually require:

```text
New Exercise Type
        +
New Ruleset
        +
New ExerciseEngine implementation
        +
Configuration schema
```

Existing routines must remain unaffected.

Adding a new game should continue to follow the existing GameEngine architecture.

A game-backed exercise should compose the existing game engine rather than duplicating its mechanics.

A new game does not automatically become a routine step: §11's eligibility rule — native timed mode, `ANALYTICS`+`VISUAL_BOARD` capabilities, and an entry in both `ROUTINE_GAME_STEPS` and `STEP_ADAPTERS` — is what a game must additionally satisfy, and both tables are a deliberate manual step, not something the game-wiring pipeline (`07-Frontend/09-Adding-A-Game.md`) does for it. <!-- 2026-09-20 -->

---

# 27. Avoiding Premature Abstraction

The architecture intentionally defines stable boundaries without prescribing every future implementation.

The following should not be introduced until a concrete requirement exists:

* generic mega-engines;
* generic exercise orchestration frameworks;
* arbitrary plugin systems;
* generic key/value configuration tables;
* AI-specific engine abstractions;
* complex strategy hierarchies for adaptive training;
* multiple levels of routine planning.

The initial architecture should implement the smallest stable model capable of supporting:

1. one or more system routines;
2. configurable exercises;
3. game-backed exercises;
4. non-game exercises;
5. stateful exercise engines;
6. analytics-mode dart observations;
7. immutable runtime history.

Future abstractions should be introduced only when concrete requirements justify them.

---

# 28. Core Architectural Principles

The training architecture establishes the following principles.

### Principle 1 — Exercise is not synonymous with game

An exercise may use a game engine, but an exercise does not require one.

### Principle 2 — Exercises are reusable capabilities

Exercise types and definitions are reusable. Their configuration belongs to the context in which they are used.

### Principle 3 — Routine composition is declarative

A routine describes which exercises occur, in what order, and for how long.

### Principle 4 — Training orchestrates

Training controls the active exercise and transitions between exercises.

### Principle 5 — ExerciseEngine executes

ExerciseEngine owns exercise-specific state, rules and evaluation.

### Principle 6 — GameEngine remains independent

GameEngine owns game mechanics and does not know about training.

### Principle 7 — Engines produce facts

Engines measure and report what happened. They do not make coaching decisions.

### Principle 8 — Coaching operates before execution

Adaptive algorithms and AI influence future exercise configuration rather than mutating active engines.

### Principle 9 — Runtime is immutable

Historical training must remain reproducible and independent of future definition changes.

### Principle 10 — Training is bounded

A routine represents a focused training block and may not exceed 60 minutes in the initial architecture.

---

# 29. Canonical Conceptual Model

The resulting model can be summarized as:

```text
                         ROUTINE
                    reusable definition
                           │
                           │ contains
                           ▼
                  ROUTINE EXERCISES
                           │
                    ┌──────┴──────┐
                    │             │
              Exercise Type   Configuration
                    │             │
                    └──────┬──────┘
                           │
                           ▼
                       TRAINING
                  runtime orchestration
                           │
                           ▼
                  EXERCISE ENGINE
                    state + rules
                           │
                 ┌─────────┴─────────┐
                 │                   │
          Exercise Ruleset      optional
                                GameEngine
                                    │
                              Game Ruleset
                 │                   │
                 └─────────┬─────────┘
                           ▼
                      DOMAIN FACTS
                           │
                           ▼
                       ANALYTICS
                           │
                           ▼
                       COACHING
                           │
                           ▼
                  FUTURE CONFIGURATION
```

The architecture therefore creates a clear separation between **what the player should train**, **how the training is composed**, **how an exercise executes**, **how a game executes**, and **how historical performance influences future training**.

This model is intended to provide the foundation for system-provided routines first, additional routines later, user-created routines subsequently, and eventually adaptive and AI-assisted training without requiring a fundamental redesign of the game-engine architecture.
