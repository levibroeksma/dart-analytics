<!--
status: canonical
scope: architecture/patterns
read-when: solving recurring design problems
updated: 2026-08-27
-->

# Architecture Patterns

> **Version:** 1.7.0 (Pattern 20: shared accuracy/hit-rate formatting via `accuracyDisplay()` 2026-08-27; prior 1.6.1 Pattern 19: `armHiddenTimer`/`clearHiddenTimer` primitive extracted, all 9 board-input games covered 2026-08-26; 1.6.0 Pattern 19: shared reveal-then-clear preview 2026-08-26; 1.5.0 Pattern 18: seat layer — `participantRef`, `stageOwnership`, seat-less `record()` 2026-08-21; 1.4.1 Pattern 18: undo depth, derived-value returns, `completedAt` timing 2026-07-26; prior 1.4.0 Pattern 18 game engine contract 2026-07-26; 1.3.0 Pattern 17 frontend layering 2026-07-14)
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
Alpine.store / form (*.store.ts, *.form.ts)
    ↓
Module (*.module.ts, *.engine.module.ts, *.payload.module.ts)
    ↓
@client/api/ (orchestrated by pages/forms/stores only)
```

## Application

- Alpine boots only via `lib/client/alpine/app.factory.ts` (`@astrojs/alpinejs` entrypoint).
- Alpine v3 shorthand: `:attr` and `@event` — not `x-bind:*` / `x-on:*` (D100; Astro `{}` linter escape only).
- No `x-init`. Always `x-data="factory()"`.
- `$persist` only in `*.store.ts` and `*.form.ts`.
- Modules never import `@client/api` or Alpine.
- Client recovery auto-cleans on session mismatch (D88).

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

The mechanical half of an engine — everything with no ruleset content in it — is composed from two shared pure modules rather than copied per engine (D232). `modules/game/turn-log.module.ts` owns the `TurnFact`/`DartFact` log: `cloneTurns`, `sumDartScores`, `dartsThrownBy`, `openOrCreateTurn` (the caller supplies the reuse rule), `appendCompletedTurn`, `openVisit`, `resolveObservation`/`appendResolvedDart`, `appendObservedDart`/`doubleTargetIntent`, and the three undo shapes `undoLastDart` / `undoLastUnit` / `undoStagedTurn`. `modules/game/seat-state.module.ts` owns per-seat derivation: `foldSeatStates`, `activeSeatState`, `otherSeatsComplete`, `durationSeatComplete`, `completedByIndex`. A new engine composes these; what stays in the engine is what its ruleset actually decides.

`seat-rota.module.ts`'s `activeSeat()` takes an optional 4th parameter, a completion predicate `(seat: SeatFact) => boolean`, defaulting to `() => false`. Three engines pass a real one — Around the Clock, Ten Up One Down and Score Training — but only Around the Clock's does any work: its seats can finish their own circuit in a different number of visits (a miss costs an extra one), so once one seat is done, every remaining turn must go to whichever seat is not, and plain lockstep alternation cannot express that. TUOD's and Score Training's seats share one fixed round budget, so their predicates never change the answer; they are passed so the fold stays correct if that budget ever stops being uniform. Every other engine omits the argument, and the default reproduces the prior pure-alternation behavior unchanged. <!-- corrected 2026-08-22, D231 -->

See `decisions/game-engine.md` D231 — D230 originally claimed only Around the Clock passes a predicate at all.

See `docs/superpowers/specs/2026-08-22-single-opponent-seat-remaining-engines-design.md` for the full design. <!-- 2026-08-22 -->

---

## Rule

A new game adds a configuration schema, a validator, an engine and seeds.

It never adds a new engine API, a new fact model, or a per-game payload module.

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
