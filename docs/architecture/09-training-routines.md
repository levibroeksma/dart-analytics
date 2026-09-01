# Training, Exercise and Exercise Engine Architecture

> Status: Proposed architectural design
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

The exact delegation boundary between `ExerciseEngine` and `GameEngine` should be specified when the first game-backed exercise is implemented.

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
