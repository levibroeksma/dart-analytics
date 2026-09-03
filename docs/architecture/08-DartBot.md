<!--
status: canonical
scope: architecture/dartbot
read-when: simulated opponent, bot difficulty, skill model, virtual dart input, the bot as a seat
updated: 2026-09-03
-->

# DartBot Architecture

> **Version:** 0.8.3 (2026-09-03 — 121, TUOD and Score Training wired onto the play loop, closing the last of the nine rulesets' opponent-mode gap: `RULESET_DARTBOT` gains `121_V1`, `TUOD_V1` and `SCORE_TRAINING_V1`; `OneTwentyOneSetupForm.astro`/`TuodSetupForm.astro`/`ScoreTrainingSetupForm.astro` pass `allowDartbot`, widening their `x-if` opponent-mode guards to key off `bot` alongside `guests`; and `oneTwentyOnePlay()`/`tuodPlay()`/`scoreTrainingPlay()` gain `maybeRunBotVisit`/`throwBotDart`/`throwBotQuickScoreDart`/`undoVisit` exactly as `five-oh-one-play.data.ts` and `shanghai-play.data.ts` already do. 121 and TUOD reuse `x01.strategy.module.ts` unchanged — both are checkout-ladder games sharing 501's `{ remaining, checkoutPath }` decision shape, so no new strategy module was needed for either. Score Training gets a new, trivial `scoring.strategy.module.ts` (D-G) that always aims treble 20, since it has no checkout or decision axis to route on; 501 was **not** refactored onto it, narrower than D-G's original "501 uses it plus a checkout branch" framing — `x01.strategy.module.ts` already covers 501/121/TUOD without a shared module, and widening scope to touch 501 was explicitly declined for this task.) 0.8.2 (2026-09-03 — Singles Training wired onto the play loop, closing `FINDINGS.md` F62: `RULESET_DARTBOT` gains `SINGLES_V1`, `SinglesTrainingSetupForm.astro` passes `allowDartbot`, and `singlesTrainingPlay()`'s `maybeRunBotVisit`/`throwBotDart`/`undoVisit` fold in `DictatedStrategy` exactly as `shanghaiPlay()` does — `throwBotDart`'s target path reads `config.targetOrder` rather than the default ascending path, since Singles Training's order mode (and its BULL-terminated path) is itself configurable. `singlesTrainingSetup()`'s existing guest-triggered `SINGLES_V1` resolver widens to a `guested()` helper covering `ctx.bot !== null` too; no `configOverrides` branch was needed — unlike Shanghai, `SinglesConfig` and `SinglesV2Config` already share the same field shape, so `addBot()` mirrors `addGuest()` exactly, resetting `difficulty` back to `EASY`. `RULESET_DARTBOT` now admits all five `DictatedStrategy` rulesets its own docstring already claimed. `FINDINGS.md` F61 (Around the Clock, Doubles Training still unwired) is unaffected — out of this task's scope.) 0.8.1 (2026-09-03 — Shanghai wired onto the play loop, mirroring Bob's 27 exactly: `RULESET_DARTBOT` gains `SHANGHAI_V1`, `ShanghaiSetupForm.astro` passes `allowDartbot`, and `shanghaiPlay()`'s `maybeRunBotVisit`/`throwBotDart`/`undoVisit` fold in `DictatedStrategy` the same way `bobs27Play()` already does. `shanghai-setup.data.ts`'s `rulesetVersionKey` widens to a resolver — `SHANGHAI_V1` once guested or DartBot-seated, `SHANGHAI_V2` for solo play — since `ShanghaiConfig` (V1) carries no `difficulty` field to send; `singlesTrainingSetup()`'s own guest/V1 resolver is the precedent. `RULESET_DARTBOT` had already admitted Around the Clock and Doubles Training alongside Bob's 27 (the dartbot-setup-wiring-fixes plan, 2026-09-02) without either's play page ever gaining the play-loop wiring this version gives Shanghai — logged as `FINDINGS.md` F61 rather than fixed here, since only Shanghai was in scope.) 0.8.0 (2026-09-02 — phase 7 ships `X01Strategy` (`app/src/modules/dartbot/strategy/x01.strategy.module.ts`): a self-correcting checkout router that re-derives `checkoutPathFor(remaining)` fresh before every dart and falls back to treble 20 below a `decisionQuality` threshold (D-D's decision axis, now a real field on `SkillProfile`, populated 7→100 across the fifteen levels) or when no route exists. `RULESET_DARTBOT.501_V1` flips to `true`; `501_V1` is opponent-mode playable end to end under both capture modes. The QUICK_SCORE scratch-engine fold gets its first live consumer: `playFoldBotQuickScoreVisit`'s `throwDart` callback widened from `() => DartObservation` to `(state: TState) => DartObservation` so the strategy can read the scratch engine's own live remaining between darts — the change `decisions/game-engine.md` records. `five-oh-one-play.data.ts` wires `maybeRunBotVisit` onto `init`, the VISUAL_BOARD commit tail and `recordVisit`'s tail, and `undoVisit` branches to `undoToActiveSeat` when a bot seat exists.) 0.7.0 (2026-09-01 — phase 6 builds the play loop `08-DartBot.md` §The Play Loop specified: the trigger, the `botThrowing` and post-delay re-entrancy guards, `undoToActiveSeat()`, and the QUICK_SCORE scratch-engine fold, all generic in `play-lifecycle.ts`. Wired onto Bob's 27, the mechanism's first live consumer. No `DartBot` class was needed — the shipped phase 1–3 functions compose directly, exactly as the test harness already showed for a solo bot. The QUICK_SCORE fold has no live consumer yet; phase 7's `501_V1` opponent mode is next in line for it.) 0.6.0 (2026-09-01 — phase 5 closes the write-path deferral this document's own dependency table named. The row previously read "still deferred" and "`DARTBOT` is explicitly refused at the create contract" — both true on 2026-08-28, both false since phase 4 shipped 2026-09-01. Phase 5 proved the already-generic write path (D220, D222) holds for a real `DARTBOT`-typed seat rather than changing it, and closed `DECISIONS.md`'s "DartBot participants" deferral. Nothing else in this document changed — the play loop, ghost mode and 501 opponent mode remain exactly as phases 6–8 describe them.) 0.5.0 (2026-08-28 — correction pass over §The Play Loop and §Delivery Phases, from walking both specs against the repo task by task. Three claims were wrong: `undoToActiveSeat`'s stated rule pops nothing at all in a solo session, where the named seat is already active; phase 6's dependency on phases 1–3 is narrower than the table implies, since only mounting the trigger needs a bot that throws; and phase 4's row listed `seatsFromParticipants()` among what it delivers, when the seat-admission design deletes it. 0.4.0 2026-08-28 gap-closing pass. New §The Play Loop resolves four holes the document never stated: undo livelocking against the bot's own re-throw, the QUICK_SCORE visit fold, trigger re-entrancy, and which ghost reads actually work. Five contradictions introduced by the 0.3.0 resolutions are reconciled — the public `level` is 1–15 throughout, tier names leave the UI, precomputed ghost runs are gone. D-J closed; D-E and D-K remain, both blocked on one aggregate a human must run. 0.3.0 2026-08-28 reconciled against 1v1 across all nine engines. 0.2.0 2026-08-21 seat layer. 0.1.0 2026-08-20 initial architecture. Design only — no DartBot code exists yet.)
>
> The simulated opponent: what it owns, where it sits in the stack, and the contracts it may not cross.
>
> Board geometry it reuses: `app/src/lib/game/board/board-geometry.module.ts`. Engine contract it feeds: `04-Architecture-patterns.md` Pattern 18. Seat layer it plugs into: `app/src/modules/game/seat-rota.module.ts` (D220). Module rules it obeys: `07-Frontend/04-Modules-And-OOP.md`.

---

# Purpose

DartBot is a simulated opponent that throws darts a human could have thrown.

This document defines its responsibilities, its boundary against the game engines, its skill model, and the contracts that keep a bot dart indistinguishable from a human dart at the fact layer while remaining separable at the analytics layer.

`02-System-Architecture.md` lists "AI opponents" under Scalability. This document is the design that claim resolves to.

---

# Scope and Status

Nothing described here is implemented. The document exists first, per `01-Principles.md` §Architecture First.

What it depends on **is** shipped and is treated as fixed:

| Dependency                                                                                                                                                              | State                                                                                                                                                                                          | Location                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Regulation board geometry, `classify()`, `zoneCentroid()`                                                                                                               | shipped                                                                                                                                                                                        | `app/src/lib/game/board/board-geometry.module.ts`                                                      |
| `DartObservation` — the per-dart input every VISUAL_BOARD engine accepts                                                                                                | shipped                                                                                                                                                                                        | `app/src/modules/game/types.ts`                                                                        |
| `GameEngine` contract (Pattern 18)                                                                                                                                      | shipped                                                                                                                                                                                        | `app/src/modules/game/interfaces.ts`                                                                   |
| Landing coordinates `location_x` / `location_y`                                                                                                                         | shipped, migration `0017_dart_locations.sql`                                                                                                                                                   | `05-Database/06-Spec/04-Runtime-Layer.md`                                                              |
| `v_dart_locations` spatial read model                                                                                                                                   | shipped, migrations `0018_dart_location_read_model.sql` + `0023_owner_scoped_dart_views.sql`                                                                                                   | `05-Database/06-Spec/05-Read-Model-Layer.md`                                                           |
| `DARTBOT` participant type (id `3`, `display_name = 'DartBot'`)                                                                                                         | type row seeded in `database/seeds/0001_reference_data.sql`; the display-name CHECK is in `database/migrations/0005_runtime_core.sql`                                                          | `05-Database/06-Spec/04-Runtime-Layer.md`                                                              |
| **Seat layer** — `TurnFact.participantRef`, `stageOwnership`, `MultiSeatState`, `SeatFact`, `seats[]` in the configuration snapshot                                     | shipped 2026-08-21, D220                                                                                                                                                                       | `app/src/modules/game/types.ts`, `interfaces.ts`                                                       |
| **Active-seat derivation** — `activeSeat()`, `startingSeatFor()`, `seatOf()`                                                                                            | shipped, D220; `activeSeat()` gained a 4th `isSeatComplete` parameter 2026-08-22, D230                                                                                                         | `app/src/modules/game/seat-rota.module.ts`                                                             |
| **1v1 across all nine engines** — every engine folds `MultiSeatState` per `participantRef` and calls `activeSeat()`; none hardcodes `seats[0]` for attribution any more | **shipped 2026-08-22**, D230–D232                                                                                                                                                              | all nine `app/src/modules/game/*.engine.module.ts`                                                     |
| **Win-condition helpers** — `eliminationWinner()`, `raceWinner()`, `scoreCompareWinner()`                                                                               | shipped, D230                                                                                                                                                                                  | `app/src/modules/game/match-outcome.module.ts`                                                         |
| **Per-seat state folding** — `foldSeatStates()`, `durationSeatComplete()`, `completedByIndex()`, `otherSeatsComplete()`                                                 | shipped, D232, D240                                                                                                                                                                            | `app/src/modules/game/seat-state.module.ts`                                                            |
| **`SEAT_CAPS`** — per-ruleset seat ceiling; `501_V1` 4, the other eight 2, an absent ruleset 1                                                                          | shipped, D230                                                                                                                                                                                  | `app/src/services/session-seats.service.ts`                                                            |
| **`participants[]` on session create** — optional, ordered, array order _is_ seat order                                                                                 | shipped, D221                                                                                                                                                                                  | `app/src/pages/api/sessions/types.ts`, `app/src/services/session-seats.service.ts`                     |
| **Owner-scoped analytics views**                                                                                                                                        | shipped, migration `0023`, D222; verification script `0023_owner_scoped_dart_view_checks.sql` now exists                                                                                       | `v_dart_analytics`, `v_dart_locations`                                                                 |
| Guest participants — the human half of the deferral                                                                                                                     | **shipped end to end**, engine through UI: all nine `*SetupForm.astro` pass `allowGuests`, capped at one guest by `AddGuestButton.astro`                                                       | `2026-08-20-guest-player-x01-design.md`, `2026-08-22-single-opponent-seat-remaining-engines-design.md` |
| The DartBot **write path**                                                                                                                                              | **shipped** — phase 4 admitted `DARTBOT` at the create contract; phase 5 (2026-09-01) drove a real `DARTBOT`-typed seat through a real engine and the real events-batch write path, and extended migration 0023's verification script to prove a bot's dart is excluded from both dart views. No source change was needed: attribution (D220) and owner-scoping (D222) were already type-agnostic. `DECISIONS.md` §Deferred no longer lists "DartBot participants" | `app/src/modules/game/events.payload.module.ts`, `app/src/services/session.service.ts`, `database/verification/0023_owner_scoped_dart_view_checks.sql` |
| **The play loop** — trigger, `botThrowing` guard, post-delay re-check, `undoToActiveSeat()`, QUICK_SCORE scratch-engine fold | **shipped on Bob's 27, Shanghai, Singles Training, 121, TUOD and Score Training** — phase 6 (2026-09-01) built the mechanism generically in `play-lifecycle.ts` and wired it onto Bob's 27, the one `VISUAL_BOARD`-only ruleset `RULESET_DARTBOT` admitted at the time; Shanghai and Singles Training followed the identical wiring 2026-09-03, then 121, TUOD and Score Training the same day. A seated `DARTBOT` opponent now actually throws in all six; one undo press returns to the human across any number of consecutive bot turns. `501_V1` gets the same mechanism through its own `SHARED`-stage `X01Strategy` row below. Around the Clock and Doubles Training are admitted in `RULESET_DARTBOT` but their play pages never received this wiring — `FINDINGS.md` F61. | `app/src/lib/game/play-lifecycle.ts`, `app/src/lib/game/bobs27-play.data.ts`, `app/src/lib/game/shanghai-play.data.ts`, `app/src/lib/game/singles-training-play.data.ts`, `app/src/lib/game/one-twenty-one-play.data.ts`, `app/src/lib/game/tuod-play.data.ts`, `app/src/lib/game/score-training-play.data.ts` |
| **`X01Strategy` + opponent mode on `501_V1`** — checkout routing, the `decisionQuality` skill axis, the play loop's QUICK_SCORE fold's first live consumer | **shipped** — phase 7 (2026-09-02). `RULESET_DARTBOT.501_V1` is `true`; a bot seat plays a full alternating-turn 501 leg to a decided outcome under both `VISUAL_BOARD` and `QUICK_SCORE` | `app/src/modules/dartbot/strategy/x01.strategy.module.ts`, `app/src/lib/game/five-oh-one-play.data.ts` |

The seat layer landed for guests, and it landed generically: a session already carries several throwers, and a bot is a third participant type in a model that does not care which type a seat holds. Everything above the line is work DartBot no longer has to do.

Since 0.2.0 the second half landed too. 1v1 is playable in **every** ruleset, not just 501 — engines, win conditions, setup UI and Play Again all carry a second seat today. A human opponent is a solved problem end to end.

What is left is a **participant-type gap**: three unions and two collapse expressions still say a seat is either a human player or a human guest. Nothing about turn order, state folding, attribution, persistence or presentation is missing — see §Persistence. Each prior version's analysis has been replaced rather than amended.

---

# Guiding Principle

> The bot never targets an outcome. It declares an intent, resolves an aim point, and throws.

Every statistic — three-dart average, checkout percentage, treble rate — is an **emergent consequence** of spatial error around a real aim point, exactly as it is for a human.

Skill level changes only how the dart scatters around the point it was aimed at. It never changes what the dart is worth.

**Rule:** no code inside the DartBot module may read, compute, or steer toward a score. A module that knows what a dart scored has already broken the model.

This is a direct application of `01-Principles.md` §Statistics are Derived, moved one layer earlier: statistics are derived not only from stored facts, but from simulated ones.

---

# Position in the System

DartBot is a **second implementation of the board-input contract** — not a second implementation of a game.

```
Human path                          Bot path

pointer gesture                     GameView (adapter)
      ↓                                   ↓
BoardInputController                 DartBot.throwDart()
(board-input.module.ts)             (dartbot.module.ts)
      ↓                                   ↓
      └────────── DartObservation ────────┘
                        ↓
              engine.record(observation)
                        ↓
                     facts()
                        ↓
              buildEventsBatch()
                        ↓
        POST /api/sessions/:id/events/batch
                        ↓
                   PostgreSQL
```

`BoardInputOptions.onCommit` already has the signature `(observation: DartObservation) => void`. DartBot produces the same value from a simulation instead of from a pointer.

Everything downstream of that join point is untouched: the ruleset engine scores it, the payload builder batches it, the API validates it, the database stores it.

**Attribution is downstream too, and that part is new.** `record()` takes no seat: the engine stamps the derived active seat's `participantRef` onto the turn it mints, and `buildEventsBatch(facts)` reads that ref per turn rather than stamping one identity across the batch. A bot dart is therefore attributed to the bot without DartBot saying anything at all about who threw it.

**Rule:** DartBot never enters the pipeline lower than the engine's `record()`. It has no API client, no payload builder, and no knowledge of persistence.

**Rule:** DartBot never states whose turn it is. The page compares `state().activeParticipantRef` against the bot's seat ref and calls `throwDart()` when they match. `seat-rota.module.ts` owns that derivation for every engine and both stage shapes; a second copy inside DartBot could disagree with the fact log about whose throw it is.

---

# Ownership

| Responsibility                             | Owner                                                                                      |
| ------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Which target to aim at                     | DartBot strategy                                                                           |
| Where inside that target to aim            | DartBot aim resolver                                                                       |
| Spatial error around the aim point         | DartBot throw engine                                                                       |
| Bounce-outs and deflections                | DartBot collision resolver                                                                 |
| Landing point → target number, zone, score | `board-geometry.module.ts` `classify()`                                                    |
| Game rules, completion, undo, fact log     | the ruleset's `*.engine.module.ts`                                                         |
| Persisted `intended_*` columns             | the ruleset engine — never DartBot                                                         |
| Whose throw it is                          | `seat-rota.module.ts` — one derivation shared by every engine                              |
| Whether a seat has finished                | the ruleset engine's own predicate, passed into `activeSeat()` (D230, D231)                |
| Who won a 1v1 match                        | `match-outcome.module.ts` — never DartBot                                                  |
| Seat order, sides, the persisted `seats[]` | `session.service.ts` + `session-seats.service.ts`, written into the configuration snapshot |
| Per-turn `participantRef`                  | the ruleset engine — never DartBot                                                         |
| Turn/stage assembly, batching              | `events.payload.module.ts`                                                                 |
| Validation, idempotency, persistence       | API and PostgreSQL                                                                         |
| Triggering a bot visit; re-entrancy; undo depth | `play-lifecycle.ts` — never DartBot                                                    |
| Folding three bot darts into a QUICK_SCORE visit | a throwaway engine of the same ruleset — never DartBot, never the adapter             |
| Animation, delays, turn pacing             | the page / `game.store.ts`                                                                 |

Ownership does not overlap. Every row above is a responsibility that already has exactly one home; DartBot adds four and takes none away.

---

# Module Boundary

## Location

Classes are permitted only under `app/src/modules/` (`07-Frontend/04-Modules-And-OOP.md` §OOP Boundary). `new DartBot()` is a class, so the module is a sibling of `modules/game/` and `modules/ui/`:

```
app/src/modules/dartbot/
├── interfaces.ts                  # DartBot, ThrowEngine, Strategy, GameView contracts
├── types.ts                       # SkillProfile, ThrowContext, BotThrow, Pacing
├── dartbot.module.ts              # the class — owns seed, context, strategy
├── throw-engine.module.ts         # aim + scatter + collision → BoardPoint  [pure]
├── aim-resolver.module.ts         # declared intent + profile → aim point in mm
├── skill-profile.module.ts         # level curve, decision tiers, overrides
├── fit-profile.module.ts          # (intent, landing) pairs → SkillProfile
├── pressure.module.ts             # situation → spread multipliers + pacing hints
├── rng.module.ts                  # seeded PRNG
└── strategy/
    ├── dictated.strategy.module.ts
    ├── scoring.strategy.module.ts      # Score Training only (D-G) — 501/121/TUOD stay on x01.strategy.module.ts
    └── x01.strategy.module.ts
```

The calibration harness is test-only and lives at `app/tests/modules/dartbot/harness/`, so it can never reach an app bundle.

Type and interface declarations go in the folder's `types.ts` / `interfaces.ts` barrels — inline `export type` in a `.module.ts` is the registered anti-pattern.

## Suffix registration

`07-Frontend/02-Folder-Structure.md` §File Suffix Conventions carries `.module.ts`, `.engine.module.ts` and `.payload.module.ts` as separate rows. Two edits are needed before the first DartBot file lands:

| Suffix                | Responsibility                                                                   | `$persist`    |
| --------------------- | -------------------------------------------------------------------------------- | ------------- |
| `.module.ts`          | Portable UI OOP class (`modules/ui/`) **or DartBot module (`modules/dartbot/`)** | **Forbidden** |
| `.strategy.module.ts` | DartBot target selection per ruleset (`modules/dartbot/strategy/`)               | **Forbidden** |

The precedent for a `.module.ts` holding pure functions rather than a class is no longer one unregistered file — it is the majority. Eleven of `modules/game/`'s `.module.ts` files export only functions (`seat-rota`, `seat-state`, `match-outcome`, `turn-log`, `checkout-bust`, `checkout-darts`, `checkout-path`, `board-progression`, `board-input`, `client-key`, `events.payload`), and none matches a row of that table. The edit above should widen the `.module.ts` row honestly rather than imply the suffix means "class"; DartBot is not the exception that forces it, only the next arrival.

## Import direction

```
modules/dartbot/*  →  @lib/game/board/*, @modules/game/types, @utils
modules/dartbot/*  ↛  @client/api, @stores, @forms, Alpine, services/, repositories/,
                      @lib/game/rulesets/*, @modules/game/seat-rota.module
```

The module imports **types** from `@modules/game/types` (`DartObservation`, `DartZoneKey`, `BoardTarget`) and **geometry** from `@lib/game/board`. It imports no engine, and no engine imports it — the page wires the two together.

It imports neither `SeatFact` — which lives in `@lib/game/rulesets/types`, a ruleset concern — nor the seat rota. A participant ref crosses into DartBot as a plain `string` on a declared view, so a bot seat is an opaque identifier the module carries and never interprets.

That is also how `level` and `seed` reach the constructor. Both live on the bot's own `SeatFact.dartbot` entry inside the configuration snapshot (D-C), and the **page** destructures them into primitives before calling `new DartBot({ level, seed })`. DartBot never sees the seat object, so the import ban and the persisted shape stay compatible rather than in tension.

## Geometry is reused, never duplicated

`BOARD_RADII_MM`, `SECTOR_ORDER`, `classify()` and `zoneCentroid()` already exist once, and `dartboard.svg` is proven to match them by parity tests (`app/tests/lib/game/board/svg-geometry-parity.test.ts`).

A private copy inside DartBot would produce a bot that aims at a board the app does not draw and scores against a classifier the app does not use — silent, and invisible until the numbers are already wrong.

**Rule:** DartBot imports the shared board geometry. It never re-declares a radius, a sector order, or a classifier.

---

# The Throw Pipeline

```
page: state().activeParticipantRef === botSeatRef?   [not DartBot code]
      ↓
GameView                          adapter over the engine's state()
      ↓
strategy.chooseTarget(view)       → declared intent { targetNumber, zoneKey }
      ↓
aimResolver(intent, profile)      → BoardPoint (mm) — where in the bed this player aims
      ↓
pressure(situation, profile)      → σ multipliers + pacing hints
      ↓
scatter(aim, σ, bias, outlier, rng)   → landing BoardPoint
      ↓
collision(landing, previousDarts)     → landing + 'stuck' | 'bounced' | 'deflected'
      ↓
classify(landing.x, landing.y)    → BoardHit                    [shared geometry]
      ↓
DartObservation { hitTargetNumber, hitZoneKey, locationX, locationY }
      ↓
engine.record(observation)        → the ruleset scores it and logs the fact
```

| Stage          | Pure?            | Notes                                                           |
| -------------- | ---------------- | --------------------------------------------------------------- |
| `chooseTarget` | yes              | Reads a read-only view; never the engine itself                 |
| `aimResolver`  | yes              | Intent → mm. The only place "where in the bed" is decided       |
| `pressure`     | yes              | Situation → multipliers. Also the single source of pacing hints |
| `scatter`      | yes, given `rng` | Anisotropic Gaussian + bias + heavy-tail outlier draw           |
| `collision`    | yes              | v1: wire bounce-out. v2: dart-on-dart deflection                |
| `classify`     | yes              | Shared module, not DartBot code                                 |

Every stage is a pure function. The `DartBot` instance owns the mutable `ThrowContext` and passes it in; nothing below `dartbot.module.ts` holds state.

The gate above the pipeline is deliberately outside it. Whether it is the bot's turn is a one-line comparison in the page against the engine's own `state().activeParticipantRef`, which the shared rota already derived — DartBot does not compute it, and does not learn the answer when it is `false`.

## The scatter model

```
landing = aim
        + bias                    systematic pull, level-dependent
        + N(0, Σ)                 Σ rotatable — elongated along or across the wire
        + rare wild draw          probability outlierRate, much wider Σ
```

A rotatable covariance is what separates a strong player from a weak one in the way the brief requires: a strong player's scatter narrows along a fixed, per-player technique axis, a weak player's stays circular. `covarianceRotationDegrees` (`SkillProfile`) is that fixed per-player bias — it does not (yet) rotate to the aim point's own polar angle, so it cannot yet reproduce a wire-relative pattern for an arbitrary target; `LEVEL_SKILL_TABLE` seeds it `0` for every level pending D-E's population fit (`FINDINGS.md` F57). A shrinking circle cannot express the per-player difference; an ellipse can.

The outlier component is separate so the core σ stays honest — the occasional wild dart must not be produced by inflating normal scatter.

---

# The Play Loop

The pipeline above describes one dart. This section describes who asks for it, how often, and what happens when the user intervenes — none of which is DartBot's to decide, and all of which lives in `play-lifecycle.ts` rather than in nine copies.

These four contracts are one mechanism seen from four angles, which is why they are specified and built together (phase 6, below): undo must pop more than one turn *because* the trigger re-throws immediately; the trigger needs a post-delay re-check *because* undo can land inside the pacing window; and the visit fold needs a second engine *because* the strategy re-targets between darts. Resolved separately they would be four plausible local decisions that do not compose.

## Who triggers a throw

The page compares `state().activeParticipantRef` against the bot's seat ref. When they match it drives the bot's visit; when they do not it does nothing. That comparison is the whole trigger.

## Two record paths, decided by capture mode

`record()` accepts a union — a `DartObservation` or a whole visit — discriminated at runtime by `isDartObservationInput()` (D241). The engine would therefore accept per-dart input in any session. **The persistence layer would not.** `quick-score.validator.ts` rejects any turn arriving with `darts.length > 0`, and `buildEventsBatch()` passes `turn.darts` through unfiltered, so a QUICK_SCORE session fed per-dart bot input builds a batch the API refuses.

| Capture mode   | How the bot's visit is recorded                                                                                                                                                                                                                                            |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VISUAL_BOARD` | Each dart goes straight into the real engine. Progression, bust and completion come back through `state()` between darts, exactly as they do for a human dart                                                                                                              |
| `QUICK_SCORE`  | The adapter builds a throwaway engine — `factory.create(config, engine.facts())`, the contract's own rehydrate path — feeds it the three darts, reads the resulting visit total, and records **one** visit input into the real engine. The scratch engine is then discarded |

The scratch engine exists so the strategy can re-target between darts without anything outside the ruleset computing a score. A 501 bot that has just thrown T20 must see the new remaining before choosing dart 2; under QUICK_SCORE the real engine cannot be told, so a second instance of the same ruleset is asked instead. It is the ruleset's own arithmetic either way, never a copy of it — which is what keeps the "bot computes a dart's score" anti-pattern intact through a mode that persists no darts.

**Rule:** a scratch engine's facts are never uploaded. It lives for one bot visit, and its `facts()` are read for a visit total and nothing else.

**Rule:** the bot never feeds per-dart input to a QUICK_SCORE session's engine. The engine accepts it; the batch upload does not, and the failure surfaces at upload time far from its cause.

## Re-entrancy

The trigger is a reactive comparison, so it can fire more than once for one turn — a re-render, a resumed session, a batch upload settling. A duplicate fire is not a harmless repeat: `dartIndex` counts the bot's darts in the fact log, so a second fire for the same turn appends a *new* turn carrying the same values.

Two guards, both on the page:

1. **A `botThrowing` flag** held for the duration of a visit, matching the `loading` / `playAgainLoading` / `loadingReconciliation` shape those files already use.
2. **A re-check after the pacing delay.** `pacing.preThrowMs` elapses before the dart is recorded, and the user can act inside that window. Before recording, the page re-derives the active seat and abandons the throw if it is no longer the bot's.

Guard 2 is the load-bearing one. Without it, a user who presses undo while the bot is "thinking" gets the rewound turn written straight back.

## Undo rewinds to the user's own visit

`undo()` pops exactly one turn — the engine's contract, unchanged. But one press of the button has to return the user to *their* turn, or the trigger above simply re-throws the bot's visit and the user can never reach their own. Two individually correct rules, jointly a livelock.

`undoToActiveSeat(engine, participantRef)` in `play-lifecycle.ts` pops **once unconditionally**, then keeps popping until the named seat is active or the log is empty. Three cases it must survive:

- **The session may be solo.** Then the named seat is already active before the press, so a loop that only popped *while* it was not active would pop nothing and the undo button would go dead in every game in the app. The unconditional first pop is what keeps solo behaviour byte-identical to today, and it is the regression anchor the tests lead with.
- **The bot can hold consecutive turns.** Under score-compare, once the human's seat completes, `activeSeat()` hands every remaining turn to the bot. The loop is "pop until the human is active", never "pop twice".
- **The bot may have opened the leg.** Then the loop empties the log, the leg restarts, and the bot re-throws its first visit identically from the seed. That is correct, not a special case.

**Rule:** the undo button means "take back my visit". A bot turn is never a step the user pauses on.

---

# Declared Intent vs Persisted Intent

DartBot always knows what it aimed at. The database does not always record it, and DartBot does not get a vote.

Intention capture is a **per-ruleset** decision already made and documented in `05-Database/06-Spec/04-Runtime-Layer.md` §darts:

| Ruleset behaviour                     | Examples                           | Bot consequence                                                                      |
| ------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------ |
| Records a genuine `DOUBLE` intent     | Bob's 27, Doubles Training         | Bot intent and persisted intent agree; `missMargin()` is computable                  |
| Records no intent (both columns NULL) | Singles Training, Around the Clock | Target is recoverable by replaying `facts()`; residuals computable in the read layer |
| Declares no intent at all             | 501, Score Training                | No per-dart intent exists for humans or bots                                         |

**Rule:** DartBot's internal intent is an input to the aim resolver, not a fact. The engine writes `intended_target_number` / `intended_zone_id` by its own ruleset's rule, exactly as it does for a human dart. A bot that forced its intent into the fact log would fabricate intent for rulesets that deliberately record none (D06) and corrupt the intended-vs-hit analysis those columns exist for.

---

# Skill Model

## One public knob

```ts
new DartBot({ level: 8 });
new DartBot({ level: 12, overrides: { decision: 30 } }); // big scorer, cannot finish
```

`level` is an integer **1–15** — the same scale the wire contract validates and the setup slider offers, with 8 the default. It expands to a full `SkillProfile` through a replaceable curve, which is the primary **optimizable seam**: it can be re-fitted from production data without changing a single call site.

Fifteen stops is a UI scale, not a resolution limit. The curve maps them onto continuous profile values, so re-fitting changes what level 8 plays like without changing that there are fifteen of them.

## SkillProfile axes

| Group       | Fields                                                                                             | Source                   |
| ----------- | -------------------------------------------------------------------------------------------------- | ------------------------ |
| execution   | `sigmaAlong`, `sigmaAcross` (mm), `covarianceRotation`, `bias{x,y}`, `outlierRate`, `outlierSigma` | fitted / level curve     |
| aim         | `bedOffset` — where inside the intended bed the player aims                                        | fitted / level curve     |
| decision    | `0..100` — checkout routing, setup shots, bogey avoidance. **Not** the public `level`, which is 1–15                                          | level curve, overridable |
| pressure    | multipliers per situation: on-double, on-finish, opponent-on-finish, leg/match point               | level curve              |
| form        | `amplitude`, `driftRate` — hot and cold spells across a session                                    | level curve              |
| correlation | `groupingWeight`, `correctionWeight` — intra-visit dart interaction                                | level curve              |
| collision   | `bounceOutRate`, `deflectionRadius`                                                                | constants (v1)           |

## Decision degrades too

Aim quality and decision quality are separate axes, defaulted together from `level` and independently overridable:

| Tier | Behaviour                                                                             |
| ---- | ------------------------------------------------------------------------------------- |
| low  | Always the biggest number; no setup shots; takes a double only if one happens to land |
| mid  | Basic checkout table; avoids bogey numbers                                            |
| high | Full checkout routing, setup shots, leaves a preferred double                         |

This is **not** "optimal aim given your own wobble". A weak bot still aims at T20 like everyone else; it is weak because it cannot back that up, not because it aims somewhere clever.

---

# Determinism and Replay

The app is stateless with idempotency keys and reconciles sessions on resume (`07-Frontend/03-Alpine-Patterns.md`). A user must never see different bot darts on a reconcile than the ones they watched land.

```ts
new DartBot({ level: 8, seed: botSeat.dartbot.seed });
// dart n is a pure function of (seed, dartIndex, context)
```

| Requirement               | Mechanism                                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------------------------- |
| Identical darts on replay | Seeded PRNG shipped in the module; seed persisted with the session                                    |
| Rehydrate after refresh   | Reconstruct from `(seed, facts)` — `dartIndex` is derived by counting the bot's darts in the fact log |
| Forced outcomes in tests  | `rng` is injectable                                                                                   |
| Mid-session resume        | The bot's next dart is re-derived from `(seed, dartIndex)`, so a refresh mid-visit resumes the same visit — nothing about the pending throw is stored |

**Rule:** `Math.random()` never appears in `modules/dartbot/`.

**Rule:** DartBot must be fully reconstructible from `(seed, facts)`. Any bot state that cannot be re-derived from those two is the same defect as an engine that cannot be rebuilt from persisted facts — the registered Pattern 18 anti-pattern.

**Rule:** an undone bot visit must re-throw identically. `undo()` crosses the seat boundary by design, so `dartIndex` has to stay a count over the bot's own turns in the fact log. An instance-held counter would survive the undo, and the bot would answer the same situation with a different dart.

That identical re-throw is exactly why undo cannot pop one turn at a time in a bot session — the rewound visit would be rebuilt before the user saw anything change. `undoToActiveSeat()` is the consequence, not a separate feature; see §The Play Loop.

---

# Strategy Layer and Game Coverage

The throw engine is mode-agnostic. Adding a game means adding a strategy; the skill model is never touched.

The simulation always runs in millimetres. **Capture mode decides how much of it survives into the fact log** — the same capture-depth rule that already governs human darts.

| Ruleset version       | Declared pairs (`capabilities.ts`) | `stageOwnership` | Strategy       | What the bot emits                                                         |
| --------------------- | ---------------------------------- | ---------------- | -------------- | -------------------------------------------------------------------------- |
| `AROUND_THE_CLOCK_V1` | DETAILED_DARTS · VISUAL_BOARD      | `PER_SEAT`       | Dictated       | `DartObservation` per dart                                                 |
| `BOBS27_V1`           | DETAILED_DARTS · VISUAL_BOARD      | `PER_SEAT`       | Dictated       | `DartObservation` per dart                                                 |
| `DOUBLES_TRAINING_V1` | DETAILED_DARTS · VISUAL_BOARD      | `PER_SEAT`       | Dictated       | `DartObservation` per dart                                                 |
| `SHANGHAI_V1`         | DETAILED_DARTS · VISUAL_BOARD      | `PER_SEAT`       | Dictated       | `DartObservation` per dart                                                 |
| `SINGLES_V1`          | DETAILED_DARTS · VISUAL_BOARD      | `PER_SEAT`       | Dictated       | `DartObservation` per dart                                                 |
| `SCORE_TRAINING_V1`   | QUICK_SCORE · VISUAL_BOARD         | `PER_SEAT`       | Score Training | `DartObservation`, or a visit total under QUICK_SCORE                      |
| `501_V1`              | QUICK_SCORE · VISUAL_BOARD         | **`SHARED`**     | X01            | `DartObservation`, or `FiveOhOneVisitInput` under QUICK_SCORE              |
| `121_V1`              | QUICK_SCORE · VISUAL_BOARD         | `PER_SEAT`       | X01 ladder     | `DartObservation`, or `OneTwentyOneVisitInput` under QUICK_SCORE           |
| `TUOD_V1`             | QUICK_SCORE · VISUAL_BOARD (D219)  | `PER_SEAT`       | X01 ladder     | `DartObservation`, or `TuodAttemptInput` folded from three simulated darts |

Under QUICK_SCORE the bot still throws three darts internally; it reports only the visit total and discards the coordinates, because that capture mode omits dart rows entirely. How those three darts are folded into one visit without DartBot scoring them is §The Play Loop — the answer is a throwaway engine, not arithmetic in the adapter.

"X01 ladder" for `121_V1`/`TUOD_V1` resolved to reusing `x01.strategy.module.ts` unchanged, not a separate module — both are checkout-ladder games with 501's own `{ remaining, checkoutPath }` decision shape. "Score Training" resolved to the new `scoring.strategy.module.ts` (D-G), which takes no `GameView` at all since there is no checkout or decision axis to route on.

Five of nine rulesets dictate their own target, so `DictatedStrategy` is near-free once the engine exists. Depth is spent only where a decision genuinely exists: 501, 121 and Ten Up One Down.

The `stageOwnership` column is not DartBot's business — no strategy reads it, and it no longer gates anything either. At 0.2.0 it decided which mode a bot could play against a human first, because `501_V1` was the only rotation-wired engine. D230–D232 wired the other eight: every engine now folds `MultiSeatState` per `participantRef` and derives its active seat through `activeSeat()`. `SHARED` versus `PER_SEAT` is once again only a statement about stage shape.

The consequence is that **no engine work stands between DartBot and any of the nine rulesets**. A bot seat is playable wherever a guest seat is, which is everywhere.

## GameView contracts

The module declares small, read-only view interfaces; the app implements thin adapters from engine state to them.

```ts
// modules/dartbot/interfaces.ts — the module declares (shipped, phase 7)
export interface X01View {
  remaining: number;
  checkoutPath: readonly string[] | null;
}
```

`checkoutPath` is the caller's own `checkoutPathFor(remaining)` result (`@modules/game/checkout-path.module`, which `modules/dartbot/*` may not import) — the adapter computes it fresh before every dart and hands it in flattened, `null` when no route exists. Phase 7's gate needed no `opponentRemaining` or `dartsLeftInTurn`: `chooseTarget` never reads the opponent's score or a dart count, only the current remaining and its route, re-derived on every call so a miss is self-correcting with no state held anywhere. A field for "leave a preferred setup double" or opponent-aware play is added if a later phase needs one — see §Decision degrades too's high tier, deliberately out of scope for phase 7.

The view stays flat regardless. DartBot wants _the number it is playing against_, not a seat array — flattening in the adapter is what keeps a 2v2 state shape from reaching the strategy layer at all.

**Rule:** DartBot never imports an engine, an engine state type, or a ruleset snapshot. The dependency points inward — the app adapts to the bot's view, not the reverse. This is what keeps the module testable standalone and liftable to `packages/dartbot` later as a move rather than a refactor.

---

# Pressure, Form and Pacing

```
effectiveSigma = baseSigma
               × pressure(situation)   always on — human realism
               × form(sessionDrift)    slow hot/cold drift
               × dda(userState)        opt-in, default 1.0
```

Three independent multiplicative terms, each tunable and testable on its own.

| Term                 | Default               | Rationale                                                                                                             |
| -------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Base level           | fixed for the session | The bot never silently gets stronger or weaker mid-match                                                              |
| Pressure             | always on             | Modulated by game situation — on a double, on a finish, opponent on a finish, leg point. This is nerves, not cheating |
| Form                 | always on             | Slow drift produces hot and cold spells across a session                                                              |
| DDA (rubber-banding) | **off**               | Explicitly enabled per mode                                                                                           |

**Rule:** DDA is forbidden in `ANALYTICS` capture. Those darts are the calibration corpus and a difficulty-adjusted opponent poisons both the user's statistics and the bot's own future fit.

## Pacing

```ts
const { dart, pacing } = bot.throwDart(view);
// pacing -> { preThrowMs: 1400, postThrowMs: 300 }
```

`pacing` is derived from the same situation state the pressure model reads — longer before a double, quick on routine scoring darts — so realism is modelled where the state lives rather than reinvented in the UI.

**Rule:** the module owns no timers and reads no clock. The page honours or ignores `pacing`. Tests need no fake clock, and the harness can run ten thousand legs at full speed.

---

# Calibration

## The corpus already exists

`v_dart_locations` returns every dart with both coordinates present, plus `radius_mm` and `angle_degrees`, alongside the intended target and zone. `missMargin()` turns that into `{ distanceMm, bearingDegrees }` — the residual vector in polar form, measured from `zoneCentroid()`.

That is exactly the sample the scatter model is parameterised by. Fitting σ, bias, rotation and outlier rate per player is a read of existing production data — no new capture, no synthetic guessing.

Reading it has two shipped caveats. `location_x`, `location_y`, `radius_mm` and `angle_degrees` are `NUMERIC` and arrive as **strings** through Drizzle, so they must be parsed before reaching `missMargin()`. And since migration `0023` the view returns only the session owner's own darts — see below.

## Bot darts are already excluded

Migration `0023_owner_scoped_dart_views.sql` (D222) joins `participants` and filters both `v_dart_analytics` and `v_dart_locations` on `p.player_id = es.player_id`. A `DARTBOT` participant has `player_id IS NULL` — `chk_participants_non_player_type_has_null_player_id` guarantees it — so a bot dart can never satisfy that predicate.

The prerequisite the 0.1.0 version of this document called blocking is therefore already met, and met for a reason that had nothing to do with DartBot: guests forced the same fix, because multiplayer is what made the omission wrong. Two consequences follow.

**The exclusion is structural, not a filter to remember.** No read path opts into it, so no read path can forget it. Any _new_ analytics view that projects `es.player_id` without joining `turns.participant_id` re-opens the hole, which is why the rule below stays written down.

**Bot darts are invisible through those views, not labelled.** Neither view exposes `participant_id` or `participant_type_key`. Nothing can read a bot's own darts back — exactly what the "never fit a profile from a corpus containing bot darts" rule wants, and also why a bot-vs-human comparison read would need a new view. That is a feature request, not a prerequisite.

`v_game_replay` is deliberately left unfiltered: it exists to replay a session as it was played, every participant included. A bot's visits will appear there under the participant's persisted `display_name`.

**Three read paths, and only one of them is missing.** The distinction matters for ghost mode, whose entire purpose is a comparison the owner-scoped views cannot express:

| Read | Works today? |
| ---- | ------------ |
| Live comparison during play | Yes — the page folds `$store.game.turns`, which carries every seat |
| The results modal at session end | Yes — same fact log, same fold |
| Cross-session ghost history | **No** — needs a view that labels `participant_type_key` rather than filtering the bot out |

Only the third needs new work, and it is genuinely a feature request rather than a prerequisite: a ghost is a live pace-setter, and both live paths are already served. A labelled view would not re-open the calibration hole either, provided `fitProfile()` keeps reading the owner-scoped views — the anti-pattern is a view that projects `es.player_id` *without* joining `turns.participant_id`, which a labelled view by definition does not.

The verification gap 0.2.0 logged here — `FINDINGS.md` F13, neither dart view having a `database/verification/*.sql` script — is **closed**. `database/verification/0023_owner_scoped_dart_view_checks.sql` exists and F13 is no longer in `FINDINGS.md`; the participant filter is proved against a real database.

## What each ruleset contributes

| Source                                                          | Residual available?                                                                  |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Bob's 27, Doubles Training under VISUAL_BOARD                   | Yes — persisted intent, measured directly                                            |
| Singles Training, Shanghai, Around the Clock under VISUAL_BOARD | Yes — target recovered by replaying `facts()`, then measured in the read layer       |
| 501, Score Training under VISUAL_BOARD                          | Landing points only; usable for grouping and bias, not for intent-relative residuals |
| Anything under QUICK_SCORE                                      | No dart rows at all                                                                  |

## Cold start

```
profile = w · individualFit + (1 − w) · prior
w = n / (n + k)

n = 0    → pure prior (tier average)
n = 50   → mostly prior, nudged
n = 500  → essentially the individual
```

`fitProfile()` always returns a usable profile. There is no threshold, no "not enough data" branch, and no visible jump in bot strength at dart _N_. The shrinkage weight `w` doubles as a `confidence` value the UI can surface.

The population prior is itself re-fittable from aggregate data — a second optimizable seam alongside the level curve.

## Choosing the opponent's level

```ts
const mine = fitProfile(myDarts);
const bot = new DartBot({ level: levelOf(mine) + offset });
```

The default opponent mirrors the user's own fitted profile plus a chosen challenge offset, presented as **a level number on the same 1–15 scale the setup slider uses** (D-D). No tier name and no expected average is shown: a three-dart average is meaningless in Around the Clock, and a tier name invented before D-E fits the curve would have to be renamed once it is.

## The prerequisite, and why it stays written down

**No bot dart may be written until bot darts can be excluded from the calibration corpus.** Migration `0023` met it before the first bot existed. The rule stays because it is a rule about _every_ analytics view, not about the two that happen to be correct today.

---

# Persistence

## The DartBot participant

`participants` already models a non-human thrower:

- `participant_type_id = 3` is `DARTBOT`.
- `chk_participants_dartbot_display_name` forces `display_name = 'DartBot'`.
- `chk_participants_non_player_type_has_null_player_id` forces `player_id IS NULL`.
- `turns.participant_id` records who threw each visit.

A bot dart is therefore already separable from a human dart at the table level, with no schema change. Since 2026-08-21 the application layer above it carries the same dimension end to end: the engine mints `TurnFact.participantRef`, `buildEventsBatch(facts)` reads it per turn, and the API writes it to `turns.participant_id`.

## Where the seed and level live

The bot's `seed`, `level` and any overrides are configuration of a specific session and must survive replay. The configuration snapshot (`exercise_configurations`, Pattern 5) is now confirmed as the home rather than presumed: D220 put `seats[]` there for exactly this reason — the snapshot is what the engine is constructed from, so a second copy of anything seat-shaped is a second thing that can drift from it.

Two constraints come with that placement. Seat entries stay camelCase inside the otherwise snake_case configuration document, because `config-codec.ts`'s key mapper is shallow. And `Seated<TConfig>` is a conditional type, since three rulesets' snapshots are `Record<string, never>` and intersecting one with a seat array narrows `seats` to `never`.

The shape is settled (D-C): `SeatFact` becomes a discriminated union and `dartbot: { level, seed, levelSource }` exists only on the `DARTBOT` branch, so the eight rulesets that never seat a bot carry no optional key for one. `levelSource` ships from day one even though it is always `"MANUAL"` until D-K — the snapshot is persisted history, and a field added after sessions exist reads as absent on every old row.

## The head-to-head gap closed, then the wiring gap closed

Everything 0.1.0 recorded here was true on 2026-08-20 and false on 2026-08-21. D220 delivered:

- `TurnFact.participantRef` — required, minted by the engine exactly as it mints `clientKey`, `sequence` and `completedAt`.
- `buildEventsBatch(facts)` — the parameter is gone; the builder reads the ref per turn, and refs may vary within one batch, which `validateBatchReferences` always allowed.
- `activeSeat(facts, seats, stageOwnership)` — the active seat derived from the fact log, never stored, for both stage shapes.
- `seats[]` in the configuration snapshot: `{ participantRef, displayName, sideKey, participantTypeKey }`, written in the same transaction as the participant rows so both come from the same minted ids.
- `record()` takes no seat, and `undo()` crosses the seat boundary with no seat logic of its own.

D230–D232 then closed the gap D220 left behind. Alternating-turn play was expressible for `501_V1` alone on 2026-08-21; since 2026-08-22 it is expressible for all nine, each engine folding `MultiSeatState` per `participantRef`, deriving its active seat through `activeSeat()`, and resolving a winner through `match-outcome.module.ts`. Nothing in either layer asks what kind of participant holds a seat.

## The participant-type gap

What is left sits entirely at the participant-type boundary. Each row is a deliberate guard or a deliberate simplification, not an oversight, and each has to admit a third member:

| Guard                                                                             | Where                                         | What a bot seat needs                                                                                                                                                                               |
| --------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ParticipantInput.participantTypeKey` is `z.enum(["PLAYER", "GUEST"])`            | `app/src/pages/api/sessions/types.ts`         | widen to admit `DARTBOT`. `app/tests/pages/api/sessions/types.test.ts:38` currently asserts `DARTBOT` is **rejected**, so that test states the inverse guarantee and is rewritten, never re-pointed |
| `SeatFact.participantTypeKey` is `"PLAYER" \| "GUEST"`                            | `app/src/lib/game/rulesets/types.ts`          | a third member, plus somewhere to hold `level` and `seed`                                                                                                                                           |
| `composeSeatFacts()` maps anything not `PLAYER` to `GUEST`                        | `app/src/services/session-seats.service.ts`   | a third branch. Server-side, a bot seat would otherwise **persist** as a guest                                                                                                                      |
| `seatsFromParticipants()` maps anything not `GUEST` to `PLAYER`                   | `app/src/lib/game/session-mode-resolution.ts` | a third branch. Client-side, a bot seat would otherwise be **held** as the human player                                                                                                             |
| `participantsFromSeats()` returns `"PLAYER" \| "GUEST"`                           | `app/src/lib/game/session-mode-resolution.ts` | a third branch carrying `level` — otherwise Play Again reseats the bot as a guest                                                                                                                   |
| `buildSeatPlan()` / `loadCreateSessionLookups()` resolve two participant type ids | `app/src/services/session.service.ts`         | the `DARTBOT` type id, and `displayName: "DartBot"` set server-side                                                                                                                                 |
| `display_name = 'DartBot'` is a DB CHECK on participant type `3`                  | `database/migrations/0005_runtime_core.sql`   | the server copies the label, exactly as it copies the `PLAYER`'s from `players.display_name`; a client-supplied value is ignored                                                                    |
| `SEAT_CAPS` admits 2 seats for eight rulesets and 4 for `501_V1`                  | `session-seats.service.ts`                    | nothing for the count — but a per-ruleset "may this seat be a **bot**" flag, which a cap cannot express                                                                                             |
| One seat per `sideKey`; exactly one `PLAYER`                                      | `session-seats.service.ts`                    | nothing — a bot is its own side and is not a `PLAYER`                                                                                                                                               |

None of these is a contract change. All of them are the same shape of edit: a union with one more member, applied consistently.

**The two collapses point in opposite directions**, which is the one row here that is actively dangerous rather than merely absent. `composeSeatFacts()` writes non-`PLAYER` → `GUEST`; `seatsFromParticipants()` reads non-`GUEST` → `PLAYER`. Admit `DARTBOT` at the wire without fixing both and the same bot seat is a guest in the persisted snapshot and the human player in the client's copy of it — a disagreement no test currently looks for, because today no participant type can reach either expression.

**A setup surface already exists.** All nine `*SetupForm.astro` pass `allowGuests`, and `AddGuestButton.astro` caps the list at one (`x-show="guests.length < 1"`). A bot seat does not need a screen built for it; it needs the existing add-opponent affordance to offer a second kind of opponent. See D-J.

## Two presentation roles, one engine

| Role     | Modes                                          | Shape                                                                                                                      | Blocked by            |
| -------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| Opponent | `501_V1`, `121_V1`, `SHANGHAI_V1`, `BOBS27_V1` | Alternating turns; the pressure model reads the live game situation, and `match-outcome.module.ts` already decides who won | participant type only |
| Ghost    | Every training mode                            | The bot takes the second seat and runs the same exercise alongside the user as a live pace-setter                          | participant type only |

Both roles are the same shape: **one engine, several seats**. `undo()` rewinding across the seat boundary and a leg resetting every seat's score are behaviours of that one engine, not something a coordinator above two engines would have to reproduce.

The ordering has now inverted twice, and the third state is that there is no ordering left. 0.1.0 made ghost mode cheap and opponent mode expensive, because the fact log had no participant dimension. 0.2.0 reversed it, because only 501 rotated. D230 removed the distinction: both roles cost exactly the participant-type gap above and nothing else. Which ships first is a product choice, not an architectural one.

One behaviour a bot inherits rather than chooses: **TUOD and Score Training force `ROUNDS` the moment a second seat exists** (`forceRoundsIfGuested()`, `score-training-setup.data.ts:129`), because a single wall clock spanning two seats' turns changes what "M minutes" means per seat. A bot seat is a second seat, so it inherits that lock unchanged — which is also why a bot needs no notion of throwing _pace_ in a timed exercise. There is no timed 1v1 to pace.

---

# Test Strategy

Tests live under `app/tests/` mirroring `app/src/`, per `07-Frontend/06-Test-Strategy.md`.

| Level                  | Asserts                                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit — geometry reuse  | The module resolves landing points through the shared `classify()`, with no private constants                                                                       |
| Unit — determinism     | The same `(seed, level, context)` produces a byte-identical dart stream; snapshot-tested                                                                            |
| Unit — injected `rng`  | Forced outlier draws, forced bounce-outs, forced grouping                                                                                                           |
| Contract               | Every emitted `DartObservation` is accepted by the target engine's `record()`                                                                                       |
| Contract — attribution | A bot visit lands on the bot's own `participantRef`, and `buildEventsBatch(facts)` emits that ref unchanged                                                         |
| Contract — undo        | One undo press returns the turn to the human, across a single bot turn and across consecutive bot turns; undoing into an empty log restarts the leg and the bot re-throws identically |
| Contract — visit fold  | A QUICK_SCORE bot visit records exactly one turn carrying `darts: []`; the scratch engine's facts never reach `buildEventsBatch()`; the visit total equals the three darts the scratch engine scored |
| Contract — re-entrancy | Two trigger fires for one turn append one turn; a throw whose active seat changed during `preThrowMs` records nothing                                               |
| Tier bands             | Per tier, within tolerance: three-dart average, first-nine, checkout %, T20 rate per visit, 100+/140+/180 frequency, segment hit distribution                       |
| **Distributional**     | Simulated `MissMargin{distanceMm, bearingDegrees}` versus the distribution fitted from real human darts at that tier — histogram distance / KS test under threshold |

The rota itself is not DartBot's to test: `app/tests/modules/game/seat-rota.module.test.ts` already proves `activeSeat` under both stage shapes, under a completion predicate that skips a finished seat, and that a one-seat session reproduces solo behaviour exactly. DartBot's seat tests assert only that a bot turn is attributed to the bot — never that the derivation works.

The distributional test is the one that actually enforces the brief. Every aggregate metric can pass while the bot sprays into 12 and 18 like a beginner; the distributional test cannot. It is only runnable because the app stores intent alongside landing.

CI fails on drift, so every re-tune of the level curve has to prove itself. That ratchet is what makes "optimizable over time" real rather than aspirational.

---

# Extension Points

The seams that are expected to change, and what they must not break:

| Seam                                   | Change without breaking                                               | Guard                                                         |
| -------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------- |
| `level → SkillProfile` curve           | Every call site — the public knob is unchanged                        | Tier band tests                                               |
| Population prior                       | Cold-start behaviour only                                             | Distributional test                                           |
| A new ruleset                          | Add one strategy; engine untouched                                    | Contract test                                                 |
| Collision resolver v2                  | Pipeline shape already accommodates it                                | Deterministic snapshot                                        |
| Pressure situations                    | Add a multiplier; other terms unaffected                              | Term isolation tests                                          |
| A new win condition or completion rule | DartBot untouched — `match-outcome.module.ts` and the engine own both | Existing per-engine suite plus `match-outcome.module.test.ts` |
| Lifting to `packages/dartbot`          | A move, not a refactor                                                | Import-direction lint                                         |

---

# Anti-Patterns

| Anti-pattern                                                                           | Reason                                                                                                                          |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Bot aims to produce a target average or checkout rate                                  | Inverts the guiding principle — statistics are emergent, never steered                                                          |
| Board geometry re-declared inside `modules/dartbot/`                                   | Two boards, one drawn and one aimed at; drifts silently from the SVG parity tests                                               |
| Bot computes a dart's score                                                            | Scoring belongs to `classify()` and the ruleset engine                                                                          |
| Bot writes `intended_*` for a ruleset that records no intent                           | Fabricates intent the model deliberately omits (D06)                                                                            |
| `Math.random()` in the module                                                          | Breaks replay, reconciliation and snapshot tests                                                                                |
| Bot state that cannot be derived from `(seed, facts)`                                  | Same defect as an engine that cannot be rebuilt from facts (Pattern 18)                                                         |
| Timers or `Date.now()` inside the module                                               | Forces fake clocks into tests and stalls the calibration harness                                                                |
| `@client/api`, `@stores` or Alpine imported by the module                              | Breaks the standalone boundary and the OOP layering rule                                                                        |
| Importing an engine or a ruleset snapshot type                                         | Dependency must point inward through a declared `GameView`                                                                      |
| A per-ruleset throw engine                                                             | Skill is ruleset-independent; only target selection varies                                                                      |
| DDA enabled under `ANALYTICS` capture                                                  | Poisons the statistics and the calibration corpus                                                                               |
| Fitting a profile from a corpus containing bot darts                                   | Feedback loop — the bot converges on itself                                                                                     |
| A second copy of the active-seat derivation inside `modules/dartbot/`                  | `seat-rota.module.ts` owns it for every engine; a private copy can disagree with the fact log about whose throw it is           |
| A bot seat reaching the snapshot through `seatsFromParticipants()`'s `PLAYER` fallback | Silently labels the bot a human player in the object the engine is constructed from                                             |
| A bot seat persisted through `composeSeatFacts()`'s `GUEST` fallback                   | Silently labels the bot a human guest in the row the snapshot is written from — the mirror-image defect, pointing the other way |
| Admitting `DARTBOT` at the wire before both collapses are fixed                        | The same seat becomes a `GUEST` server-side and a `PLAYER` client-side; nothing currently tests the disagreement                |
| A bot pace model for timed exercises                                                   | TUOD and Score Training force `ROUNDS` for any second seat; a timed 1v1 does not exist to pace                                  |
| Per-dart `record()` in a QUICK_SCORE session                                           | The engine's input union accepts it, but `quick-score.validator.ts` rejects the batch — the session plays fine and fails at upload |
| A scratch engine's `facts()` reaching `buildEventsBatch()`                             | Uploads a duplicate of the visit the real engine already holds                                                                  |
| Folding a QUICK_SCORE visit with arithmetic in the adapter                             | Re-implements ruleset scoring outside the ruleset; the same defect as re-declaring board geometry, one layer up                 |
| `undo()` popping a single turn in a bot session                                        | Hands the turn straight back to the bot, which re-throws identically — the user can never reach their own visit                 |
| Recording a bot dart without re-deriving the active seat after the pacing delay        | An undo pressed while the bot is "thinking" is silently overwritten                                                             |
| A `dartIndex` counter held on the `DartBot` instance                                   | `undo()` crosses the seat boundary, so an undone visit would re-throw a different dart                                          |
| Bot configuration persisted anywhere but the snapshot                                  | Replay would depend on something the runtime layer does not carry (Pattern 5, D220)                                             |
| A new analytics view projecting `es.player_id` without joining `turns.participant_id`  | Re-opens the hole migration `0023` closed; bot darts re-enter the human's statistics                                            |

One row was **removed** at 0.2.0: "one engine instance shared by two participants". It described the pre-seat-layer contract, and one engine holding several seats is now the supported — and only — shape.

---

# Open Decisions

Speculative until decided. None is a decision record; see `DECISIONS.md` for how one is added.

## Closed upstream since 0.1.0

Both were closed by work that was not about DartBot. Neither needs a DartBot decision.

| Was                                                      | Closed by                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **D-A** — participant attribution in the analytics views | Migration `0023_owner_scoped_dart_views.sql` (D222). Both dart views join `participants` and filter to the owning player; a `DARTBOT` participant has `player_id IS NULL` and cannot appear. The new migration this decision asked for is not needed, and neither is a filter in every read path — the exclusion is structural. |
| **D-B** — multi-participant fact logs                    | D220 took the second option: a participant dimension on `TurnFact`, `buildEventsBatch(facts)` reading it per turn, one shared rota deriving the active seat. Composing N single-seat engines was weighed and rejected — under `SHARED` each sub-engine mints its own leg. Opponent mode is no longer contract-blocked.          |

## Resolved by the seat-admission design

The seat-admission design (2026-08-24, revised 2026-08-28) resolves six. They are recorded there with rationale; summarised here so this document reads alone.

| Was                                            | Resolution                                                                                                                                                                                                                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **D-C** — shape of persisted bot configuration | `SeatFact` becomes a discriminated union; `dartbot: { level, seed, levelSource }` exists only on the `DARTBOT` branch. Costs two construction sites, against a sibling snapshot key's optional field on all nine ruleset config types plus an unenforced cross-reference |
| **D-D** — tier ladder                          | No ladder. A 1–15 integer with no tier names and no stated average, because an average band cannot be claimed before D-E fits the level curve                                                                                                                            |
| **D-F** — ghost-mode presentation              | Live, not precomputed. The ghost throws when the rota hands it the turn — same engine, same `participantRef`, same `activeSeat()`. Precomputing needs a reveal cursor and its own undo semantics: a second mechanism for what the seat layer already does                |
| **D-G** — Score Training target selection      | A false dichotomy. Extract `scoring.strategy.module.ts` — "which bed maximises expected score at this level" — so 501 uses it plus a checkout branch and Score Training uses it alone. 501 needs the extraction regardless                                               |
| **D-H** — which engine is seat-wired first     | Closed by the repo rather than by a choice: D230–D232 wired all nine. Restated as _which engine shows the first ghost_ and answered Around the Clock — dictated target, `DETAILED_DARTS · VISUAL_BOARD`, no clock, and progress is one number climbing 1→20              |
| **D-I** — how `DARTBOT` is admitted            | A per-ruleset `dartbot` flag declared beside `SEAT_CAPS`. The cap answers "how many seats", which is not the question "may one of them be a bot"                                                                                                                         |
| **D-J** — where the bot enters the setup surface | The existing add-opponent button opens a two-step chooser (Guest · DartBot). No new screen: all nine `*SetupForm.astro` already carry the affordance, and the DartBot branch renders only where `RULESET_DARTBOT` is true. A separate bot control beside the guest one was rejected — two buttons for one seat, on screens that admit exactly one opponent |

## Still open

Two, both blocked on the same thing, and neither blocking the build.

**D-E — Population prior values.** `fitProfile()` needs a population prior to shrink toward at `n = 0`. That prior has to be measured, and measuring it reads real player darts, so **a human runs this, not an agent**.

Two constraints shape how:

- **Not through `v_dart_locations`.** Migration `0023` scopes that view to one owning player, and a population prior is cross-player by definition. The extract reads the base tables with the same participant join, filtered to `participant_type_id = 1` so guests and bots are excluded exactly as the views exclude them.
- **Not in SQL.** The residual is measured from `zoneCentroid()`, which is TypeScript. Reimplementing board geometry in a query would re-declare the board in a third place — the registered anti-pattern, one layer further out. The query extracts four columns; the shipped `missMargin()` does the maths.

```sql
-- Extract only. Aggregate in TypeScript through the shipped missMargin().
-- PLAYER seats only: guests and DartBot are excluded here for the same
-- reason migration 0023 excludes them from the dart views.
SELECT d.intended_target_number,
       d.intended_zone_id,
       d.location_x,
       d.location_y
FROM   darts d
JOIN   turns t        ON t.id = d.turn_id
JOIN   participants p ON p.id = t.participant_id
WHERE  p.participant_type_id = 1
  AND  d.intended_target_number IS NOT NULL
  AND  d.location_x IS NOT NULL;
```

The fold is a `scripts/` one-off, not an app read path: parse the `NUMERIC` columns (they arrive as strings), run each row through `missMargin()`, then take `stddev` along and across the bed axis, the mean as bias, and the tail beyond 3σ as `outlierRate`. Output is aggregate only — no row survives the script.

Blocks the level curve, and so blocks any claim about what a given level *plays* like. It does not block phases 1–7: a hand-set prior throws perfectly good darts, it just cannot be called calibrated.

**D-K — Auto level.** A bot mirroring the player's own stored skill, resolved server-side at session start. D-E's machinery aimed at one player instead of the population, and blocked on the same aggregate. The contract is already shaped for it: the wire gains `levelMode?: "AUTO"`, the server resolves a concrete `level`, and the snapshot records `levelSource: "AUTO"` — no snapshot change when it lands.

---

# Delivery Phases

| Phase | Delivers                                                                                                                                                                                                       | Gate                                                                                                                                                                                     |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Geometry reuse + throw engine + level curve — throwing at a fixed target                                                                                                                                       | Deterministic snapshot tests green                                                                                                                                                       |
| 2     | Harness + tier calibration                                                                                                                                                                                     | Tier bands green in CI                                                                                                                                                                   |
| 3     | `DictatedStrategy`                                                                                                                                                                                             | Five rulesets playable in memory, nothing persisted                                                                                                                                      |
| 4     | Seat admission (D-I): `DARTBOT` through `ParticipantInput`, `SeatFact`, `composeSeatFacts()`, `participantsFromSeats()`, `buildSeatPlan()`, a `dartbot` flag beside `SEAT_CAPS`, and `seatsFromParticipants()` **deleted** | A session is creatable with a bot seat, `display_name` copied server-side, the seat round-trips as `DARTBOT` in **both** directions, and the inverted test rewritten rather than deleted |
| 5     | DartBot participant write path (closes the `DECISIONS.md` deferral)                                                                                                                                            | A bot turn persists on its own `participantRef` and is absent from both dart views                                                                                                       |
| 6     | The play loop: trigger, `botThrowing` guard, post-delay seat re-check, `undoToActiveSeat()`, the QUICK_SCORE scratch-engine fold                                                                               | One undo press returns the turn to the human; a QUICK_SCORE bot visit uploads one turn with no darts                                                                                     |
| 7     | `X01Strategy` + decision axis → opponent mode on `501_V1`                                                                                                                                                      | Alternating-turn play in one `SHARED` leg                                                                                                                                                |
| 8     | Ghost mode on Around the Clock (D-H)                                                                                                                                                                           | The ghost persists alongside the user in one session — no engine work, the seat is already there                                                                                         |
| 9     | Pressure + form + intra-visit correlation                                                                                                                                                                      | The "feels human" layer                                                                                                                                                                  |
| 10    | `fitProfile` from production darts                                                                                                                                                                             | Curve and prior re-fitted against real players                                                                                                                                           |
| 11    | Collision resolver v2; DDA layer (opt-in, casual only)                                                                                                                                                         | Distributional test still green                                                                                                                                                          |

**Phase 6 does not need phases 1–3 in full** — only its last task, mounting the trigger on a play page, constructs a `DartBot`. The page composes the bot and hands it to the loop, so `undoToActiveSeat`, the scratch-engine fold and both re-entrancy guards are specifiable and testable against a stub thrower before any real one exists. The phase order below still reads correctly as a *shipping* order; it overstates what blocks the *building*.

Phase 4 was "participant-scoped views" at 0.1.0. Migration `0023` did that, so it became seat admission — the work actually between a simulated dart and a persisted one. Nothing writes a bot dart before it.

Ghost mode lost its engine work at 0.3.0. It read "seat-wire the first training engine + ghost mode"; D230–D232 wired all nine, so only the ghost remains. Opponent mode and ghost mode no longer differ in cost, and either can go first.

Phase 6 is new at 0.4.0 and is **not** optional scaffolding: without `undoToActiveSeat()` the undo button is inert in any bot session, and without the scratch-engine fold a QUICK_SCORE bot session plays correctly and then fails at upload. Both are the kind of defect that only appears once a bot actually takes a turn, which is why the phase sits immediately before the first one that does.

D-J is deliberately not a phase. The chooser that offers a bot has to land _with_ phase 4, because every phase after it is otherwise reachable only from a test.

---

# Related Documents

| Document                                                                             | Purpose                                                                                                                                      |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `01-Principles.md`                                                                   | Correctness, derived statistics, extensibility                                                                                               |
| `02-System-Architecture.md`                                                          | Layer ownership; lists AI opponents under Scalability                                                                                        |
| `04-Architecture-patterns.md`                                                        | Pattern 5 configuration snapshot, Pattern 9 derived analytics, Pattern 18 game engine contract — including the seat clauses added 2026-08-21 |
| `05-Database/06-Spec/04-Runtime-Layer.md`                                            | participants, turns, darts, capture depth, intention rules; `seats[]` in the configuration snapshot                                          |
| `05-Database/06-Spec/05-Read-Model-Layer.md`                                         | `v_dart_locations` contract, owner scoping, NUMERIC parsing caveat                                                                           |
| `06-API/04-Endpoint-Contracts.md`                                                    | `EventsBatchRequest`, `DartFact`, `participants[]` on session create                                                                         |
| `07-Frontend/02-Folder-Structure.md`                                                 | Suffix table, aliases, import direction                                                                                                      |
| `07-Frontend/04-Modules-And-OOP.md`                                                  | OOP boundary, `GameEngine` contract, engine anti-patterns                                                                                    |
| `07-Frontend/06-Test-Strategy.md`                                                    | Test location and suite policy                                                                                                               |
| `07-Frontend/09-Adding-A-Game.md`                                                    | The fan-out a new game requires, for strategy authors                                                                                        |
| `DECISIONS.md`                                                                       | Deferred list — now reads "DartBot participants" alone; the guest half was struck when it shipped                                            |
| `decisions/game-engine.md` D220                                                      | Seat layer: `participantRef` on `TurnFact`, `stageOwnership`, derived active seat, why composition was rejected                              |
| `decisions/game-engine.md` D230                                                      | Three win-condition categories, `SEAT_CAPS`, `activeSeat()`'s completion predicate — 1v1 across the eight non-501 engines                    |
| `decisions/game-engine.md` D231, D232, D240, D241                                    | Which engines pass a real completion predicate; the shared pure modules engine boilerplate was extracted into                                |
| `decisions/api.md` D221                                                              | `participants[]` on session create; every seat-admission guard and why it exists                                                             |
| `decisions/api.md` D239                                                              | `ROUNDS` is a per-seat budget, validated per participant                                                                                     |
| `decisions/database.md` D222                                                         | Owner-scoped dart analytics views                                                                                                            |
| `decisions/frontend/astro.md` D225                                                   | Guest setup UI; the Astro/Alpine escaping boundary that justifies a separate list component                                                  |
| `docs/superpowers/specs/2026-08-20-guest-player-x01-design.md`                       | The seat design in full, including what it deferred — DartBot among it                                                                       |
| `docs/superpowers/specs/2026-08-22-single-opponent-seat-remaining-engines-design.md` | 1v1 for the other eight engines — the document that closed D-H                                                                               |
| `app/src/modules/game/seat-rota.module.ts`                                           | The active-seat derivation DartBot must never duplicate                                                                                      |
| `app/src/modules/game/seat-state.module.ts`, `match-outcome.module.ts`               | Per-seat folding and win conditions — both already generic over participant type                                                             |
