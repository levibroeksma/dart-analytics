<!--
status: canonical
scope: architecture/patterns
read-when: solving recurring design problems
updated: 2026-10-17
-->

# Architecture Patterns

> **Version:** 1.11.18 (Pattern 18: Ten Up One Down bound through `foldCheckoutSeats` on the game shell; the shell gains visit-total input, coordinate capture, close-settled totals and a `complete` hook 2026-10-27, D500; prior 1.11.17: Pattern 18: MARKS row notes the shared `MarksEngine` shell 2026-10-27, #1111; prior 1.11.16: Pattern 18: Random Checkout bound through `foldCheckoutVisits` on the exercise shell; the Checkout kernel's `FAIL` verdict 2026-10-27, D500; prior 1.11.15: Pattern 18: Checkout kernel built, Checkout Sequence bound through `foldCheckoutVisits` on the exercise shell; an exercise spec's `isVisitOpen` sees the folded state 2026-10-27, D500; prior 1.11.14: Pattern 18: Around the Clock V3 on the Track kernel; `noteVisitHit`/`loseLifeOnBlank` lives policies, a seat may end `OUT` 2026-10-22, D481; prior 1.11.13: Pattern 18: Doubles Snakes & Ladders bound through `trackExerciseSpec`; a dart exercise may declare `ends(state)` and the shell completes it 2026-10-22, D479; prior 1.11.12: Pattern 18: Halve-It bound through `trackExerciseSpec`; zone targets via a defaulted `TrackRules` target type 2026-10-21, D478; prior 1.11.11: Pattern 18: Baseball Darts, the first new game on the Track kernel, bound through the game shell; `TargetGrid` titles 2026-10-18; prior 1.11.10: Pattern 18: Doubles Lock bound through `trackExerciseSpec`; `lockCheckpoint` visit-close policy 2026-10-18; prior 1.11.9: Pattern 18: SwitchBlade bound through `trackExerciseSpec`; per-dart intent changes mid-visit 2026-10-18; prior 1.11.8: Pattern 18: Hit Count, the first `trackExerciseSpec` exercise; `BoardTarget` gains TREBLE 2026-10-17, D469; prior 1.11.7: Pattern 18: the switching-sequence exercise bound to the Track kernel and moved onto the exercise shell; Track phase 1 complete 2026-10-17, D468; prior 1.11.6: Pattern 18: Target Scoring, the first exercise, bound to the Track kernel through `foldTrackDarts`; the kernel gate accepts the exercise import 2026-10-17, D468; prior 1.11.5: Pattern 18: Shanghai bound to the Track kernel; the game shell gains a closed-visit total hook 2026-10-17, D468; prior 1.11.4: Pattern 18: Around the Clock bound to the Track kernel; the game shell gains a timer and a state-aware visit close 2026-10-17, D468; prior 1.11.3: Pattern 18: Singles Training bound to the Track kernel; the game shell serves several ruleset keys per spec 2026-10-17, D468; prior 1.11.2: Pattern 18: Bob's 27 bound to the Track kernel 2026-10-17, D468; prior 1.11.1: Pattern 18: Track kernel built, Doubles Training bound 2026-10-17, D468; prior 1.11.0: Pattern 18: rule-kernel families are architecture — registry, two gates, Kernel: header 2026-10-17, D467; prior 1.10.0: Pattern 18: single-stage dart engines and clockless timed dart exercises are specs bound to a shared shell, `dart-engine-shell.module.ts` / `dart-exercise-shell.module.ts` 2026-10-16, D462; prior 1.9.3: Pattern 20: 501/TUOD/121 route their checkout rate
> through a second helper, `checkoutPercentageDisplay()`, that dashes a
> zero-attempt denominator instead of reporting `"0.00%"`; the result
> field these three rulesets expose is renamed `checkoutPercentage`
> throughout the stack, surfacing as `Checkout %` in the modals, the
> routine summary and `/statistics` 2026-09-19; prior 1.9.2: Pattern 18:
> `five-oh-one-play.data.ts`, `tuod-play.data.ts`, and `one-twenty-one-play.data.ts`'s private checkout-visit builders move into one shared `checkout-visits.module.ts` 2026-09-19; prior 1.9.1: Pattern 18: `double-attempt.module.ts`'s checkout-attempt classifier now counts a bounce-out/off-board dart and any bust-causing dart as a miss rather than excluding it, and treats the inner single band at 50 remaining as a missed bull 2026-09-19; prior 1.9.0: Pattern 18: all 9 rulesets' results snapshots now uniformly carry `seats: XSeatResult[]`, closing the gap the single-opponent-seat design's touch list left open 2026-08-30; prior 1.8.3: Pattern 21 gains a fifth band, Pattern 18's `checkout-bust.module.ts` gains `checkoutAttemptCount` 2026-08-28, D242; prior 1.8.2: Pattern 18: `isDartObservationInput`, `exerciseBlockStage()`, `turnsBeforeVisit` join `turn-log.module.ts`'s shared exports 2026-08-28, D241; prior 1.8.1 Pattern 18: `checkout-bust.module.ts` shared bust/checkout rule, `otherSeatsComplete`'s completion-predicate parameter 2026-08-27, D240; prior 1.8.0 Pattern 21: exclusive score-band tallying via `visitScoreBandCounts()` 2026-08-27; 1.7.0 Pattern 20: shared accuracy/hit-rate formatting via `accuracyDisplay()` 2026-08-27; 1.6.1 Pattern 19: `armHiddenTimer`/`clearHiddenTimer` primitive extracted, all 9 board-input games covered 2026-08-26; 1.6.0 Pattern 19: shared reveal-then-clear preview 2026-08-26; 1.5.0 Pattern 18: seat layer — `participantRef`, `stageOwnership`, seat-less `record()` 2026-08-21; 1.4.1 Pattern 18: undo depth, derived-value returns, `completedAt` timing 2026-07-26; prior 1.4.0 Pattern 18 game engine contract 2026-07-26; 1.3.0 Pattern 17 frontend layering 2026-07-14)
>
> This document defines the approved architectural patterns used throughout the project.
>
> These patterns provide consistent solutions for recurring design problems.
>
> Contributors should prefer existing patterns over introducing new approaches.
>
> If a new pattern is required, it should be reviewed and documented before adoption.

---

# Purpose

As the system grows, similar problems will appear repeatedly.

Without established patterns, different parts of the application may solve the same problem in different ways.

This creates:

- inconsistent architecture
- duplicated logic
- increased maintenance costs
- unpredictable behaviour

This document establishes reusable patterns to maintain architectural consistency.

---

# Pattern Selection Principles

When selecting an implementation approach, prefer solutions that maximize:

1. Correctness
2. Simplicity
3. Consistency
4. Maintainability
5. Extensibility
6. Performance

This order should guide architectural decisions.

---

# Pattern 1 — Single Responsibility

## Principle

Every component has exactly one primary responsibility.

A component should have one reason to change.

---

## Application

Applies to:

- database tables
- API endpoints
- services
- repositories
- frontend components
- documentation

---

## Example

Good:

```
UserController

Responsible for:
- user-related API requests
```

Bad:

```
UserController

Responsible for:
- users
- statistics
- notifications
- exports
- authentication
```

---

## Rule

When a component gains unrelated responsibilities, split it.

---

# Pattern 2 — Database as Source of Truth

## Principle

Persistent domain data has exactly one authoritative owner.

That owner is PostgreSQL.

---

## Application

The database owns:

- gameplay history
- configuration snapshots
- relationships
- constraints
- historical correctness

The API and frontend consume this data.

---

## Rule

Never duplicate persistent truth in another layer.

---

# Pattern 3 — Immutable Runtime Data

## Principle

Completed gameplay represents historical events and must never be modified.

---

## Application

Runtime entities:

- activity
- exercise session
- stage
- turn
- dart

become historical records.

---

## Rule

Corrections should be represented as new records.

Never rewrite history.

---

# Pattern 4 — Template → Snapshot Lifecycle

## Principle

Templates describe future behaviour.

Runtime sessions preserve historical behaviour.

---

## Pattern

```
Template

↓

Configuration Snapshot

↓

Runtime Session
```

---

## Application

Example:

A TUOD training routine changes in the future.

Existing sessions must still know exactly which rules were used.

Therefore:

Templates are copied into immutable session configurations.

---

## Rule

Runtime data must never depend on mutable templates.

---

# Pattern 5 — Configuration Snapshot

## Principle

Configuration is strongly modelled through a three-stage lifecycle:

```
configuration_templates (preset)

↓

exercise_configurations (immutable snapshot)

↓

exercise_session (runtime)
```

Avoid generic key-value tables for domain behaviour.

---

## Avoid

```
configuration_key

configuration_value
```

---

## Prefer

```
configuration_templates.configuration  (JSONB preset)

exercise_configurations.configuration  (JSONB snapshot, copied at session start)
```

The JSONB structure per game type is defined by the ruleset version's configuration schema. The application validates; the database guarantees the value is a JSON object.

---

## Reason

- presets and snapshots share one representation — copy is lossless
- written once, read for replay — never queried relationally
- ruleset version defines structure without per-game child tables
- database CHECK enforces JSON object type

See `05-Database/06-Database-Specification.md` — Configuration Snapshot Model.

---

# Pattern 6 — Repository Pattern

## Principle

Database access should be isolated behind repositories.

---

## Structure

```
Controller

↓

Service

↓

Repository

↓

Database
```

---

## Responsibilities

### Controller

Handles:

- HTTP communication
- request parsing

---

### Service

Handles:

- business workflows
- orchestration

---

### Repository

Handles:

- database communication
- SQL queries

---

## Rule

Business logic should not exist inside SQL queries or controllers.

---

# Pattern 7 — Views as Read Contracts

## Principle

The frontend should consume purpose-built read models instead of raw tables.

---

## Pattern

```
Tables

↓

Views

↓

API

↓

Frontend
```

---

## Benefits

- stable API contracts
- optimized queries
- easier analytics
- reduced coupling

---

## Rule

Do not expose internal table structures directly.

---

# Pattern 8 — API Contract Boundary

## Principle

The API contract is explicit, versioned in architecture docs, and owned by the Worker boundary.

---

## Application

Baseline contract is defined in:

`06-API/00-Overview.md`

Implementation guidance is defined in:

`06-API/01-Implementation-Strategy.md` and `06-API/02-Middleware-And-Layering.md` (2026-07-09)

Current baseline includes:

- Cloudflare Worker runtime for API endpoints
- Bearer JWT identity verification in middleware
- resource-first REST route surface by domain
- batch write endpoint (`POST /api/sessions/:sessionId/events/batch`)
- Worker-generated UUIDv7 for runtime persistence entities
- view-backed read endpoints from `v_*` contracts
- standard success/error envelope with domain codes and retry semantics

---

## Rule

Do not implement or change API behavior that is not reflected in `06-API/00-Overview.md` (or a superseding API architecture document).

Do not substitute Astro Actions for the v1 REST API surface. See `06-API/01-Implementation-Strategy.md` (2026-07-09).

---

# Pattern 9 — Derived Analytics

## Principle

Store facts.

Calculate insights.

---

## Example

Store:

```
dart thrown
intended_target_number + intended_zone_id
hit_target_number + hit_zone_id
score
```

Calculate:

```
checkout percentage
average score
double accuracy (from zone, not stored multiplier)
progression trend
```

---

## Rule

Never store values that can reliably be derived unless there is a proven performance reason.

---

# Pattern 10 — Migration Isolation

## Principle

Every database migration has exactly one responsibility.

---

## Example

Good:

```
0006_runtime_events.sql
```

Contains:

- turns table
- turn constraints

---

Bad:

```
040_everything.sql
```

Contains:

- tables
- indexes
- views
- seed data

---

## Rule

Small migrations are easier to debug, review and rollback.

---

# Pattern 11 — Explicit Domain Modeling

## Principle

Domain concepts should have explicit representation.

---

## Avoid

Combining unrelated concepts into generic tables.

---

## Prefer

Explicit entities:

```
Game Type

Rule Set

Configuration

Session

Stage

Turn

Dart
```

---

## Reason

Explicit models improve:

- readability
- validation
- extensibility

---

# Pattern 12 — Lookup Tables Over Hardcoded Values

## Principle

Values that represent domain concepts should be data-driven.

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

Hardcoded strings throughout the application.

---

## Benefits

- extensibility
- localization
- safer changes

---

# Pattern 13 — Stable Identifiers

## Principle

Internal identifiers and external identifiers have different purposes.

---

## Internal

Domain entities use:

```
UUIDv7 (application-generated)
```

Controlled lookup tables use:

```
SMALLINT (explicit seeded ids)
```

Purpose:

- database relations
- uniqueness
- indexing
- efficient joins on small controlled sets

---

## External

Use:

```
implementation_key
public_code
```

Purpose:

- API references
- documentation
- URLs

---

# Pattern 14 — Eventual Event Architecture

## Principle

The current architecture should allow future event-driven capabilities.

---

## Current Model

```
Exercise

↓

Turns

↓

Darts
```

---

## Future Extension

```
Exercise

↓

Events

↓

State Projection
```

---

## Rule

Do not implement event sourcing prematurely.

Preserve the ability to introduce it later.

---

# Pattern 15 — Feature Expansion Pattern

## Principle

New functionality should extend existing patterns.

---

## Adding a New Game Type

Required steps:

1. Add game type reference data.
2. Add supported features.
3. Add ruleset.
4. Add configuration model.
5. Add runtime interpretation.
6. Add statistics views.
7. Update documentation.

---

## Rule

A new game should not require redesigning existing games.

---

# Pattern 16 — Architecture Review Matrix

Every significant change must be evaluated against these quality attributes.

| Attribute      | Question                                        |
| -------------- | ----------------------------------------------- |
| Responsibility | Does each component have one clear purpose?     |
| Consistency    | Does this follow existing patterns?             |
| Replayability  | Can historical sessions still be reconstructed? |
| Integrity      | Is historical data protected?                   |
| Normalization  | Is duplication avoided?                         |
| Extensibility  | Can future requirements be added safely?        |
| Coupling       | Are dependencies minimized?                     |
| Cohesion       | Does functionality belong together?             |
| Performance    | Is optimization justified by evidence?          |
| Simplicity     | Is this the simplest sufficient solution?       |

---

# Pattern 17 — Frontend Layering

## Principle

The frontend uses Alpine-native layering with prerender-default shells, not API-style controllers.

## Pattern

```
Astro page (prerender + middleware)
    ↓
Alpine.data (*.data.ts) — x-data="componentState()"
    ↓
Alpine.store (*.store.ts)
    ↓
Module (*.module.ts, *.engine.module.ts, *.payload.module.ts)
    ↓
@client/api/ (orchestrated by pages/stores only)
```

## Application

- Alpine boots only via `lib/client/alpine/app.factory.ts` (`@astrojs/alpinejs` entrypoint).
- Alpine v3 shorthand: `:attr` and `@event` — not `x-bind:*` / `x-on:*` (D100; Astro `{}` linter escape only).
- No `x-init`. Always `x-data="factory()"`.
- `$persist` only in `*.store.ts`.
- Modules never import `@client/api` or Alpine.
- Client recovery never abandons on session mismatch; setup asks the player first (D460, supersedes D88). (2026-10-13)

## Rule

Detail lives in `07-Frontend/01`–`04` and `10-Frontend-Agent-Guide.md`. API integration boundary remains in `07-Frontend/00-Overview.md`.

---

# Pattern 18 — Game Engine Contract

## Principle

Every game engine implements one contract.

A game is a validated configuration plus a fact log — not a bespoke API.

---

## Pattern

```
ruleset version key + validated configuration snapshot

↓

GameEngine  (record · undo · wouldComplete · isComplete · state · facts)

↓

EngineFacts  →  exercise_stages / turns / darts
```

---

## Application

- **Construction is config-driven.** A `GameEngineFactory` builds the engine from a configuration snapshot validated against its ruleset version's schema (Pattern 5). Rules are never module constants; a new rule option is a config key, not engine surgery.
- **The engine owns the fact log.** `facts()` returns `EngineFacts` — stage, turn and dart records that map 1:1 onto the runtime tables. There is exactly one copy: the store persists what the engine returns and never accumulates a second.
- **The engine mints the persistence keys** — `clientKey`, `sequence`, `completedAt`, `participantRef`. `completedAt` is the client-observed *end* of a visit, so it is stamped when the visit resolves and stays NULL while it is still open. <!-- 2026-07-26 --> `participantRef` is the seat that threw the visit, minted the same way, which is what lets one session's log hold several throwers. <!-- 2026-08-21 -->
- **Nothing `state()` or `facts()` returns aliases engine internals.** Both hand back derived values — a freshly folded state object and detached stage/turn/dart records, never a live field or a shared module constant. A returned object is a snapshot: writing to it changes nothing, and callers that need to change engine state call a named method. <!-- 2026-07-26 -->
- **The engine rehydrates from its own facts.** `create(config, prior)` replays persisted facts to rebuild state, so a page refresh restores the game exactly.
- **Derived values are never stored in a fact.** Running score, training points, hit ratios and averages are folded from the fact log on read and belong in views (Pattern 9) — never in a field the engine accumulates.
- **`wouldComplete(input)` is a pure predicate.** Deciding completion by recording and then rolling back is unsafe for an engine whose `record()` opens a stage — 501's can append a `LEG` — so completion is asked, never simulated. It must not mutate.
- **`undo()` is an exact inverse of `record()` over `facts()`**, including any stage that `record()` opened. Popping only the turn leaves an orphan empty stage that the batch builder uploads silently.
- **Every engine declares `stageOwnership`** — `"SHARED"` (one stage instance holds every seat's interleaved turns, as an X01 leg does) or `"PER_SEAT"` (one stage instance per seat per round). It is static, not derived: a one-seat session behaves identically under either value, so an engine not yet wired for several seats declares the shape it WILL have. The shared `modules/game/seat-rota.module.ts` derives the active seat from the fact log for both shapes, so no engine carries its own rota. <!-- 2026-08-21 -->
- **`record()` takes no seat.** It applies to the derived active seat, so a caller can never disagree with the engine about whose throw it is, and `undo()` crosses the seat boundary with no seat logic of its own — popping the turn restores the previous active seat because that seat was never stored. <!-- 2026-08-21 -->
- **Undo depth is unbounded, one `record()` per call.** Every engine undoes back to an empty fact log, and `undo()` returns `false` once there is nothing left. Rehydrated facts are undoable too — `create(config, prior)` replays them into the same log, so the depth limit is the log, not the session. No engine caps it. <!-- 2026-07-26 -->

Registration is two-sided: `modules/game/engine.registry.ts` maps `rulesetVersionKey` to the engine factory, `services/rulesets/registry.ts` maps the same key to the server-side validator. `scripts/check-game-engines.sh` fails the build when an engine is absent from either.

### Win conditions (1v1 and beyond)

A multi-seat match ends via one of three win-condition categories, decided per ruleset:

- **Elimination** — the match ends the instant one seat fails; the surviving seat wins (Bob's 27).
- **Race-to-finish** — the match ends the instant one seat finishes; that seat wins (121).
- **Score-compare** — every seat plays out its own full session; once every seat has completed, the seat with the best derived metric wins, and a tie resolves to no winner (Around the Clock, Ten Up One Down, Shanghai, Score Training, Singles Training, Doubles Training — Shanghai layers a race-style instant win on top for whoever hits a Shanghai, falling back to score-compare otherwise).

`modules/game/match-outcome.module.ts` holds one pure function per category — `eliminationWinner`, `raceWinner`, `scoreCompareWinner` — each taking the seats' per-side facts (`{sideKey, failed}` / `{sideKey, finished}` / `{sideKey, completed, metric}`) and returning the winning `sideKey`, or `null` while undecided or tied. Engines fold their own state into the shape the category function expects and call it; none inlines winner-picking logic of its own.

A score-compare engine calls `scoreCompareOutcome(seats, direction, soloStatus)` rather than `scoreCompareWinner` directly: it returns the match `status` and `winningSideKey` together, since the two are one composition (nobody wins while a seat is still playing; the best metric wins once they all finish; an unbroken tie stays `TIE`).

The mechanical half of an engine — everything with no ruleset content in it — is composed from two shared pure modules rather than copied per engine (D232). `modules/game/turn-log.module.ts` owns the `TurnFact`/`DartFact` log: `cloneTurns`, `sumDartScores`, `dartsThrownBy`, `openOrCreateTurn` (the caller supplies the reuse rule), `appendCompletedTurn`, `openVisit`, `resolveObservation`/`appendResolvedDart`, `appendObservedDart`/`doubleTargetIntent`, and the three undo shapes `undoLastDart` / `undoLastUnit` / `undoStagedTurn`. `modules/game/seat-state.module.ts` owns per-seat derivation: `foldSeatStates`, `activeSeatState`, `otherSeatsComplete` (a completion predicate `(seat: TSeat) => boolean` as its 3rd argument — a `status` check for the dart-fed engines, `durationSeatComplete` for TUOD and Score Training), `durationSeatComplete`, `completedByIndex`. A new engine composes these; what stays in the engine is what its ruleset actually decides.

A single-stage, dart-input engine goes further: it is a `DartGameSpec` — `fold`, `refusal`, `intent`, `isVisitOpen`, `wouldComplete` — bound to the shell in `modules/game/dart-engine-shell.module.ts`, which owns the log, keys, `completedAt`, undo and rehydration. One spec may serve several ruleset versions (`rulesetVersionKeys`): one class, one factory per key, as Singles Training V1–V3 does. A timed spec reads `timerExpired`, the shell's `expireTimer()` flag, as `fold`'s third argument, and `isVisitOpen` sees the folded state, so a rule can close a visit short (Around the Clock). A spec may persist a closed visit's own total through `closedVisitTotal(opened, closed, participantRef, turn, config)`, given the state before the visit opened and after it closed (Shanghai). `visitInput` adds a whole-visit total beside darts (one closed dartless turn; `undo()` pops whole turns; `visitInput.refusal` replaces `refusal` for those totals), `coordinateCapture` resolves each dart from its coordinates, and `complete(state, config)` replaces the default `isComplete()` (Ten Up One Down). Clockless timed exercises do the same with `DartExerciseSpec` and `modules/training/exercises/dart-exercise-shell.module.ts`. A hand-written class is the opt-out for an engine the shell cannot express (multi-stage). (2026-10-16, D462)

### Rule-kernel families <!-- 2026-10-17, D467 -->

A dart engine is three layers: an **L1 rule kernel** (pure; everything a
ruleset decides), the **L2 engine shell** above, and an **L3 game
definition** (rulesetVersionKey + Zod config → the kernel's rules). Every
game and exercise engine belongs to exactly one family, or is a named
hand-written opt-out:

| Kernel | Decides | Kernel module | Status |
| --- | --- | --- | --- |
| `TRACK` | walk a target path; hit test, points, visit judgement, seat end | `modules/game/track-kernel.module.ts` (policies: `track-policies.ts`) | built — Doubles Training, Bob's 27, Singles Training, Around the Clock, Shanghai, Target Scoring bound (D468); Target Scoring, Hit Count, SwitchBlade, Doubles Lock, Halve-It, Doubles Snakes & Ladders bound through `trackExerciseSpec` (D469, D478, #993); a dart exercise may declare `ends(state)` to finish on its own state, which the shell then completes (D479, 2026-10-22); Baseball Darts bound through the game shell (2026-10-18). `TrackRules` takes an optional target type, defaulting to `BoardTarget`; a ruleset aiming at a zone (`ANY_DOUBLE`, `ANY_TREBLE`) passes `TrackTarget` (D478, 2026-10-21) |
| `CHECKOUT` | finish a target score under bust rules; attempt budget; ladder moves | `modules/game/checkout-kernel.module.ts` (policies: `checkout-policies.ts`) | built — Checkout Sequence, Random Checkout and Ten Up One Down bound (D500, 2026-10-27); 121 pending |
| `VISIT_POINTS` | points from a visit's darts; goal, bust, void, compare | `visit-points-kernel.module.ts` | designated, kernel pending |
| `MARKS` | marks on categories; close order; closed-number scoring | `marks-kernel.module.ts` | designated, kernel pending; Cricket and Tactics already share `MarksEngine` (`marks-engine.module.ts`, `marks-duel.module.ts`, `marks-close.module.ts`, D487, 2026-10-24) — the Marks family plan builds on that shell, never beside it (2026-10-27) |
| `ELIMINATION` | lives, cross-seat effects, last standing | `elimination-kernel.module.ts` | designated, kernel pending |
| `HAND_WRITTEN` | opt-out: 501 (match format), Warm-Up (dartless), Bull-Up (counting only), the simulations | — | — |

- `scripts/engine-kernels.txt` is the registry of every engine's kernel and
  status (`KERNEL_BOUND`, `PENDING`, `HAND_WRITTEN`).
  `scripts/check-engine-kernels.sh` holds it true against the code's imports
  (`./<kernel>-kernel.module` in `modules/game/`, `@modules/game/<kernel>-kernel.module` from an exercise)
  and the rules files' `Kernel:` header. `scripts/check-game-rules.sh`
  requires that header on every game and exercise rules file.
- **Fit rule:** a game needing more than two new kernel settings is
  `HAND_WRITTEN`.
- **Changing a family** — adding one, or moving a game between families or
  to `HAND_WRITTEN` — takes a decision entry and an edit to this table. It is
  never done in code or a rules file alone.
- A kernel's rules are a record of named policy functions built per read
  from the configuration snapshot; nothing about them is stored.

`modules/game/checkout-bust.module.ts` owns the double-out bust/checkout rule shared by every X01-style ladder game: `resolveCheckoutAttempt(remainingBefore, scored, endedOnDouble)` returns `{ remainingAfter, checkedOut, busted }` for an overshoot, leaving exactly 1, or reaching exactly 0 without a double. 501, 121, and TUOD each call it and OR their own ruleset-specific escalation (121's final-visit unreachable-remainder rule, TUOD's odd-remainder-with-one-dart-left rule) onto its result rather than folding that escalation into the shared function (D240). `checkout-bust.module.ts` also exports `checkoutAttemptCount(turns)` (D242), counting failed checkout attempts from a completed VISUAL_BOARD turn log.

`modules/game/double-attempt.module.ts` (D256) classifies whether each dart in a double-out session (501, TUOD, 121) was an eligible checkout-attempt dart and whether it hit or missed, from board hits alone -- no stored intent. A bounce-out or off-board dart is a miss, not an excluded dart, and so is any dart that busts the visit -- the bust test is evaluated before the reroute-exclusion rules, so no busting dart can read as a deliberate lay-up. At 50 remaining the inner single band is a missed bull, while the outer single band and the trebles there stay excluded as ordinary setup shots, and the unbanded `SINGLE` key keypad capture writes stays excluded because its band is unknowable. See `docs/superpowers/specs/2026-09-19-x01-checkout-percentage-design.md` for the full rule. <!-- 2026-09-19 --> `modules/game/checkout-visits.module.ts` is the single shared builder `five-oh-one-play.data.ts`, `tuod-play.data.ts`, and `one-twenty-one-play.data.ts` now call for this input (`CheckoutVisitDarts[]`, one entry per visit carrying the remaining score it opened against): 501 with a plain running-sum reduce over `totalScore` within a leg, TUOD/121 by refolding `turnsBeforeVisit` through their own already-exported `foldTuodState`/`foldOneTwentyOneState` -- the same "refold vs. plain reduce" choice documented two paragraphs down for `turnsBeforeVisit` itself. Replaced 501's leg-level `checkoutPercentage` and TUOD's round-level `attempts`/`successes`/`failures`, both of which measured legs/rounds, not darts; net-new for 121. The per-visit remaining for every X01 ladder is therefore built exactly once, in `checkout-visits.module.ts`, and consumed by both the live result modals (via the three `*-play.data.ts` files above) and the career statistics read (`statistics.service.ts`, via `modules/stats/x01-checkout-sessions.module.ts`'s `checkoutVisitsFromRows`), so the two can never disagree. <!-- 2026-09-19 -->

Resolving "the seat's state immediately before this visit" has two legitimate techniques, not one duplicated three times: `turnsBeforeVisit` (`turn-log.module.ts`) slices the log up to the visit and refolds it through the engine's own `foldXxxState`, for when the caller needs the seat's whole derived state (121's `seatBeforeVisit`, Checkout kernel's `foldCheckoutSeats`); a plain `.filter().reduce()` over `totalScore` is used instead when only a running total is needed and a full state fold would be wasted work (501's `remainingBeforeVisit`). Pick whichever the caller actually needs — do not force a scalar-only case through a full-state fold, or vice versa (D241).

`seat-rota.module.ts`'s `activeSeat()` takes an optional 4th parameter, a completion predicate `(seat: SeatFact) => boolean`, defaulting to `() => false`. Three engines pass a real one — Around the Clock, Ten Up One Down and Score Training — but only Around the Clock's does any work: its seats can finish their own circuit in a different number of visits (a miss costs an extra one), so once one seat is done, every remaining turn must go to whichever seat is not, and plain lockstep alternation cannot express that. TUOD's and Score Training's seats share one fixed round budget, so their predicates never change the answer; they are passed so the fold stays correct if that budget ever stops being uniform. Every other engine omits the argument, and the default reproduces the prior pure-alternation behavior unchanged. <!-- corrected 2026-08-22, D231 -->

See `decisions/game-engine.md` D231 — D230 originally claimed only Around the Clock passes a predicate at all.

See `docs/superpowers/specs/2026-08-22-single-opponent-seat-remaining-engines-design.md` for the full design. <!-- 2026-08-22 -->

### Results-snapshot shape (all 9 rulesets) <!-- 2026-08-30 -->

Every ruleset's `resultsSnapshot` uniformly carries `seats: XSeatResult[]` —
one stats entry per seat, computed for every seat in the match, not only the
owning player. Five Oh One, Score Training and Shanghai always had this
shape; Around the Clock, Bob's 27, Doubles Training, 121, Singles Training
and Ten Up One Down were promoted to it (`docs/superpowers/specs/2026-08-30-result-modal-consolidation-design.md`
Issue 3). The `2026-08-22-single-opponent-seat-remaining-engines-design.md`
design above wired 1v1 support into every engine but its own touch list
never named this snapshot-shape change, so those 6 games' results modals
kept computing stats for the owning player only, silently dropping the
opponent's data at the data layer — see `decisions/frontend/alpine.md` for
the correction record. Singles Training is the one ruleset whose `status` field
lives per-seat (`seats[N].status`) rather than at the top level, since its
HARD/EXTREME elimination can resolve one seat WON and the other LOST from
the same match.

---

## Rule

A new game adds a configuration schema, a validator, an engine and seeds.

It never adds a new engine API, a new fact model, or a per-game payload module.

Where the shell fits, a new engine is a spec bound to it, not a hand-written class.

Every engine belongs to one rule-kernel family or is `HAND_WRITTEN` (§Rule-kernel families); a family move needs a decision entry. (D467)

---

# Pattern 19 — Shared Reveal-Then-Clear Preview

## Principle

A per-dart game mode's visit preview is one shared mechanism, not a
per-ruleset reimplementation.

## Pattern

```
commitDart
    ↓
playCommitDart (play-lifecycle.ts) — uniform 1500ms reveal-then-clear
timer, regardless of input mode
    ↓
hiddenTurnKey
    ↓
playPreviewSegments(turns, hiddenTurnKey, classify) — gate + pad to 3
    ↓
VisitPreview.astro
```

## Application

- Timer duration and the hidden/empty gate live once in `play-lifecycle.ts`
  (`playCommitDart`, `playPreviewSegments`). A new per-dart game mode
  supplies only a `classify(dart, index) => "hit" | "miss"` callback — never
  its own timer or its own 3-empty-placeholder gate.
- The timer-arm/clear logic itself is a separate exported primitive —
  `armHiddenTimer(context, turns)` / `clearHiddenTimer(context)` —
  factored out of `playCommitDart` so a caller whose engine has different
  completion semantics can reuse just the timer without adopting the whole
  `playCommitDart` composite. Score Training's `recordDart` is this case:
  its engine can already be complete before a dart is thrown (MINUTES-mode
  timer expiry), so it must never run `playCommitDart`'s post-record
  `isComplete()` check — it calls `armHiddenTimer` directly instead. Every
  other per-dart game (501, 121, Ten Up One Down, and the 5 originally
  wired) delegates its whole `commitDart` to `playCommitDart`.
- All 9 board-input games (501, 121, Score Training, Ten Up One Down, Bob's
  27, Singles Training, Doubles Training, Shanghai, Around the Clock) clear
  their board markers via `playVisitMarkers`, whether or not they also
  render `VisitPreview.astro`'s 3-dart strip — 501/121/Score
  Training/TUOD score by visit total/checkout and correctly render no
  preview strip, but still show per-dart board markers under
  `ANALYTICS`+`VISUAL_BOARD` capture and clear them the same way.
- The mechanism is turn/seat-scoped, not player-count-scoped: single-player
  and 1v1 both read `$store.game.turns`/`hiddenTurnKey` identically, so a
  future 2v2 (once its `sideKey`-group work lands) needs no special case
  here either.
- `VisitPreview.astro` stays markup-only, reading `previewSegments()` off
  the page's own Alpine scope — it never depends on which classifier the
  page used.

## Rule

Detail lives in `app/src/lib/game/play-lifecycle.ts` and
`07-Frontend/04-Modules-And-OOP.md`.

---

# Pattern 20 — Shared Accuracy/Hit-Rate Formatting

## Principle

A hits/darts percentage is computed once, not reimplemented per ruleset.

## Pattern

```
hits, darts
    ↓
accuracyDisplay(hits, darts) (play-visit-stats.ts) — hits/darts * 100,
always 2 decimal places, "0.00%" when darts is 0
    ↓
resultsSnapshot.accuracy / .hitPercentage / .doubleHitRate
    ↓
result-modal .astro (renders the string directly)
```

## Application

- Every game whose result reports a hit-rate percentage — Around the
  Clock, Bob's 27, Doubles Training, Shanghai, Singles Training — calls
  `accuracyDisplay(hits, darts)` rather than its own `Math.round`/
  `toFixed` arithmetic. The field name a game exposes (`accuracy`,
  `hitPercentage`, `doubleHitRate`) is the game's own choice; the
  formatting behind it is not.
- Always exactly 2 decimal places, including the zero-darts case
  (`"0.00%"`) — never a bare `"0%"` fallback written separately from the
  helper.
- Result-modal `.astro` components render the field's string value
  directly; they never reformat or re-round it.
- 501, TUOD and 121 report their checkout rate through a second helper
  instead, `checkoutPercentageDisplay(hits, attempts)`: same two-decimal
  math as `accuracyDisplay`, but an em dash when `attempts === 0`. A
  checkout rate over no attempts is missing data, not a proven zero —
  unlike the dart-counted denominators above, where zero darts thrown
  genuinely is `"0.00%"`. `accuracyDisplay` itself is unchanged; the
  divergence lives entirely in the new helper. The field this exposes is
  named `checkoutPercentage` end to end — seat result, career DTO, store
  and UI label (`Checkout %`) alike (2026-09-19).

## Rule

Detail lives in `app/src/lib/game/play-visit-stats.ts`.

---

# Pattern 21 — Exclusive Score-Band Tallying

## Principle

A visit-score milestone count (60+/100+/120+/140+/180-style bands) is
computed once, not reimplemented per ruleset, and every band is mutually
exclusive: a visit counts toward its single highest qualifying band only,
never toward any lower band it also happens to clear.

## Pattern

```
completed visits
    ↓
visitScoreBandCounts(turns) (play-visit-stats.ts) — one pass, each visit
tallied into exactly one of sixtyPlus / hundredPlus / oneTwentyPlus /
oneFortyPlus / oneEighties (highest threshold met, e.g. 125 → oneTwentyPlus
only, never also hundredPlus; 180 → oneEighties only)
    ↓
resultsSnapshot.seats[].{sixtyPlus, hundredPlus, oneTwentyPlus, oneFortyPlus, oneEighties}
    ↓
result-modal .astro (renders each count directly)
```

## Application

- Any game whose result reports visit-score milestone counts calls
  `visitScoreBandCounts(turns)` rather than four independent
  threshold-or-above tallies.
- Bands are exclusive, not cumulative: a single visit increments exactly one
  counter (or none, below 60).
- Result-modal `.astro` components render each count directly; they never
  re-tally or re-bucket it.

## Rule

Detail lives in `app/src/lib/game/play-visit-stats.ts`.

---

# Pattern Adoption Process

A new pattern may only be introduced when:

1. Existing patterns cannot solve the problem.
2. The benefits are clearly explained.
3. Alternatives have been considered.
4. The decision is documented.
5. A new block is appended to the matching domain file under `decisions/**` (routed via `DECISIONS.md`) when the pattern is adopted.

---

# Anti-Patterns

The following approaches are discouraged.

---

## Generic Everything Tables

Example:

```
entity_properties

key

value
```

Reason:

- weak constraints
- poor discoverability
- difficult analytics

---

## Business Logic Duplication

Example:

Frontend calculates statistics.

API recalculates statistics.

Database calculates statistics.

Reason:

Creates inconsistent results.

---

## Direct Table Exposure

Example:

Frontend directly depends on table structure.

Reason:

Creates unnecessary coupling.

---

## Premature Abstraction

Example:

Creating complex frameworks before requirements exist.

Reason:

Adds complexity without value.

---

## Mutable Historical Data

Example:

Editing completed games.

Reason:

Breaks replayability and statistics.

---

# Final Principle

Patterns exist to reduce unnecessary decisions.

The goal is not to force every situation into a predefined solution.

The goal is to ensure that common problems are solved consistently, while preserving the flexibility required for future growth.
