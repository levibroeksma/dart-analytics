# Switching

Current version: V1 (shipped 2026-10-20)
Entry points: routine step
Kernel: TRACK

## Features

Version and `Applies to` vocabulary: see `../../templates/GAME_RULESET_TEMPLATE.md`.

Every row names the config it describes — **Standard** or **Chain** — except
the rows that hold for both.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Two configs under one exercise type | V1 | Single | |
| Target list of 1 to 20 entries, each a number 1–20 (Standard) | V1 | Single | |
| Default target list 20 → 19 → 18 (Standard) | V1 | Single | |
| One dart per target; the aim advances hit or miss (Standard) | V1 | Single | |
| Target list cycles (Standard) | V1 | Single | |
| Visit is one full pass through the target list (Standard) | V1 | Single | |
| Zone points: single 1, double 2, treble 3 (Standard) | V1 | Single | |
| Zone points configurable 0–100 each (Standard) | V1 | Single | |
| A dart off the target number scores nothing (Standard) | V1 | Single | |
| Bull rejected as a target (Standard) | V1 | Single | |
| Readout: points, darts, hit rate (Standard) | V1 | Single | |
| Target sequence of exactly three distinct targets, each 1–20 or the bull (Chain) | V1 | Single | |
| Default target sequence 20 → 19 → 18 (Chain) | V1 | Single | |
| Hit advances the aim and adds to the chain (Chain) | V1 | Single | |
| Points: single 1, treble 3, outer bull 1, bullseye 3 (Chain) | V1 | Single | |
| A double is a miss (Chain) | V1 | Single | |
| Miss wipes the chain and restarts the sequence at the first target (Chain) | V1 | Single | |
| Chain and sequence carry across visits (Chain) | V1 | Single | |
| Visit of three darts (Chain) | V1 | Single | |
| Completed sequence counted on each wrap to the first target (Chain) | V1 | Single | |
| Mark to beat: the best finished chain (Chain) | V1 | Single | |
| Readout: best chain, completed sequences, darts, hit rate (Chain) | V1 | Single | |
| Duplicate targets rejected (Chain) | V1 | Single | |
| Time-bound run | V1 | Single | |
| Standalone entry | V2+ | All | Wanted, unscheduled: no exercise has a standalone play page — `app/src/pages/training/` holds only `routines/`, `schedules/` and `quick-subtract/`. V1 is routine step only, by the author's choice |
| Per-dart-position targets (dart 1 → 20, dart 2 → 19, dart 3 → 18 regardless of misses) | Dropped | All | Decided against by the author (2026-09-23): a miss restarts the sequence at the first target, even mid-visit |
| Every visit restarts at the first target | Dropped | All | Decided against by the author (2026-09-23): the sequence and chain carry across visits |

## Identity

- Switching trains moving the aim between targets without losing rhythm.
  **Standard** builds the habit: one dart at each target in turn, every dart
  scores what it hits. **Chain** adds the cost of a miss: the hits have to
  come in an unbroken run, and one miss sends you back to the start.
- Standard dartboard layout. Point values are **exercise points**, not X01
  points (`docs/architecture/09-Training/01-Routines.md` §14).

## Tags

| Axis | Tags |
| --- | --- |
| Skill | SWITCHING (primary), ACCURACY |
| Session role | CORE |
| Format | SOLO |
| Difficulty | BEGINNER (Standard), INTERMEDIATE (Chain) |
| Mechanic | SEQUENTIAL, ACCUMULATION |
| Pressure | RESET |

## Exercise type

- Type constant: `SWITCHING` (seeded in
  `database/seeds/0016_switching_double_pattern_exercise_types.sql`).
- Wraps no game (§12).
- **Two configs, one type.** The type ships two ruleset versions:
  `SWITCHING_V1` is Standard, `SWITCHING_CHAIN_V1` is Chain
  (`database/seeds/0044_switching_chain.sql`). The config rides on the
  ruleset version key, never on the step's stored configuration, so the
  routine builder shows one Switching card with a row per config and
  Standard's step fingerprint — and the stats trend bucketed by it — is
  untouched by Chain existing.
- **The bull is a legal Chain target and an illegal Standard one.** Standard
  stamps every dart's intended zone `TREBLE` (`INTENDED_ZONE_KEY`,
  09-Training/01-Routines.md §17) and the bull has no treble, so Standard's
  targets stop at 20 (D297, `decisions/game-engine.md`). Chain aims at the
  treble on a number and at the bullseye on the bull, so it takes 1–20 and
  the bull alike. This asymmetry is deliberate and is the one rule the two
  configs do not share in spirit.
- **Kernel.** `Kernel: TRACK` matches both engines' rows in
  `scripts/engine-kernels.txt`. Chain's engine
  (`app/src/modules/training/exercises/switching-chain.engine.module.ts`) is
  `KERNEL_BOUND` on the Track kernel. **Standard's engine
  (`switching.engine.module.ts`) still folds its own state by hand and its
  Track migration is still `PENDING` in that manifest. This change does not
  perform that migration**; it only points both rows at this document.

## Objective

- **Standard:** score as many points as you can in the time, one dart at each
  target in turn. A good run is a high point total at a high hit rate.
- **Chain:** build the highest **chain** you can before a miss wipes it. A
  good run is a high best chain, with completed sequences as the secondary
  measure.
- What else is shown is derived (see Capture); no statistic is stored.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Duration (both configs) | 10 minutes | Routine step configuration |
| Targets (Standard) | 20, 19, 18 — 1 to 20 entries, each a number 1–20; entries may repeat | Routine step configuration |
| Points (Standard) | Single 1, double 2, treble 3 — each 0–100 | Routine step configuration |
| Targets (Chain) | 20, 19, 18 — exactly three targets, each of 1–20 or the bull (25), none repeated | Routine step configuration |
| Points (Chain) | Single 1, treble 3; outer bull 1, bullseye 3; a double is a miss | Shown, locked |

A routine step may override any of these
(`routine_steps.configuration`); the values here are the exercise type's own
defaults. Duration preset mirrors the `SWITCHING` example in
`09-Training/01-Routines.md` §3.5.

## How to practise

**Single:** one player per run. Exercise engines run a single solo seat
(`SOLO_PARTICIPANT_REF`, `app/src/modules/training/exercises/solo-participant.module.ts`).

### Visit

- **Standard:** a **visit** is one full pass through the **target list** —
  as many darts as the list is long. One dart is thrown at each target in
  turn.
- **Chain:** a **visit of three darts**. Every dart is thrown at the current
  target of the **target sequence**, which may change mid-visit (see
  Progress).

### Progress

**Standard**

- One dart at the current target, then the aim moves to the next entry —
  hit or miss alike. Nothing is ever repeated or restarted.
- **Zone points** are scored by the ring hit **on the target number**:
  single 1, double 2, treble 3 by default. Each of the three is configurable
  from 0 to 100, so a step may pay the double nothing, or pay every ring the
  same.
- A dart that lands on any other number, on the bull, or off the board
  scores nothing. There is no configurable value for it.
- **Target list cycles:** after the last entry the list starts again from the
  first, and a new visit begins.

**Chain**

- A **hit** is a scoring ring of the current target: the single or the treble
  of a number, or either ring of the bull.
- A hit scores — number: single **1**, treble **3**; bull: outer bull **1**,
  bullseye **3** — adds that to the **chain**, and advances the aim to the
  next target of the sequence.
- **A double is a miss.** So is any other number, the bull when aiming at a
  number, a number when aiming at the bull, and a dart off the board.
- A **miss** sets the chain back to 0 and restarts the sequence at the first
  target, **even mid-visit**. The chain it ended, if it held at least one
  hit, is kept as a finished chain.
- The **chain** and the sequence position **carry across visits**: the
  three-dart boundary is a record-keeping boundary, not a rule boundary.
- A **completed sequence** is counted every time a hit wraps the aim back to
  the first target — that is, every full pass through the three targets
  without a miss.
- **Mark to beat:** the best **finished** chain of this run is shown while
  the player builds the next one, simulating match pressure. It is this run
  only, never an all-time best, and there is none until the first chain has
  been broken.
- **Duplicate targets rejected:** a sequence naming the same target twice
  (e.g. 20, 20, 19) is invalid configuration.

### Bound

- **Time-bound run:** both configs last the step's duration (default 10
  minutes). Every exercise used in a routine is time-bound in that routine
  (§3.3, §5). Neither config can run out of targets: Standard's list cycles
  and Chain's sequence repeats.
- Chain: a chain still live when the timer expires counts toward **best
  chain** — it was reached. It is not counted as a finished chain, so it
  never becomes the mark to beat.

## Later versions

### Variants

- None scheduled. Standard and Chain are not variants of one another: each is
  its own ruleset version of the type, with its own configuration schema and
  its own engine.

### Other

- **Standalone entry** — play a run outside a routine. Blocked on the absence
  of any standalone exercise play surface; see the Features row.

## Capture

- **Capture / input mode:** analytics mode (§13), under the `ANALYTICS` +
  `VISUAL_BOARD` capture pair with no game pair — the pair every dart-input
  exercise step uses today (§17, D277). Both configs use it.
- **One dart's fact:** one `darts` row per throw, carrying the intended
  target and zone, the number and zone actually hit, and `score` as the
  dart's **board** score (T20 = 60, bullseye = 50) — never exercise points.
  - Standard: intended target = the current list entry (`1`–`20`); intended
    zone = `TREBLE` always. The zone is intent only — every ring on the
    target number scores, by the configured table — but it must be set,
    because `darts` requires an intended zone wherever an intended target is
    set (`chk_dart_target_consistency`,
    `database/migrations/0007_constraints.sql`).
  - Chain: intended target = the current sequence target (`1`–`20` or `25`);
    intended zone = `TREBLE` on a number, `INNER_BULL` on the bull. Both keys
    exist in `DartZoneKey` (`app/src/modules/game/types.ts`).
- **Stage type:** one `EXERCISE_BLOCK` stage per run
  (`exerciseBlockStage()`, `app/src/modules/game/turn-log.module.ts`). One
  `turns` row per visit — for Standard that is one full pass through the
  target list, for Chain it is three darts. Each dart carries its own
  intended target, so Chain's mid-visit restart is expressed per dart.
- **Derived, never stored:** Standard's points per dart, running total,
  current target and position in the cycle; Chain's points per dart, current
  chain, best chain, finished-chain mark to beat, completed sequences,
  current target and sequence position; and darts thrown and hit rate for
  both. All are folds over the ordered dart facts and the step's
  configuration; the target at any dart is itself derived by replaying the
  rules.
- Neither config produces a conventional game score: Standard's headline is
  an exercise point total, Chain's is the best chain. An exercise engine need
  not produce a conventional score (§13).

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Target list** | V1 | Standard's ordered entries, cycled one dart at a time; 1 to 20 of them, each a number 1–20 |
| **Target sequence** | V1 | Chain's three distinct targets, each of 1–20 or the bull, worked in order |
| **Zone points** | V1 | Standard's configurable points for the ring hit on the target number: single, double, treble, each 0–100 |
| **Visit** | V1 | Standard: one full pass through the target list. Chain: three darts |
| **Hit** | V1 | Chain: a dart in the single or treble of the current number, or either ring on the bull; a double is a miss |
| **Miss** | V1 | Chain: anything that is not a hit; it sets the chain to 0 and restarts the sequence at the first target |
| **Chain** | V1 | Chain: the summed points of consecutive hits since the last miss |
| **Completed sequence** | V1 | Chain: one full pass through the three targets without a miss |
| **Mark to beat** | V1 | Chain: the best finished chain of this run, shown while the next one is built |
| **Standalone entry** | V2+ | Playing a run outside a routine |

## Open questions

- **`Pressure | RESET` is imprecise, and knowingly so.** It is true of Chain,
  where a miss sends progress back to the start, and it overstates Standard,
  where a miss costs nothing beyond the dart and would read `NONE`. The
  Pressure axis cannot hold both: `NONE` is exclusive
  (`../../TAGS.md` §Axes), so it may not be combined with `RESET` on one
  row, and unlike Difficulty the axis has no per-config label grammar. The
  stricter of the two is tagged so the exercise is not understated. If
  per-config tagging is ever wanted beyond Difficulty, it is a TAGS.md change
  and a decision, not an edit here.
- **Standard's Track migration is open.** Its engine's fold is hand-written
  and its `scripts/engine-kernels.txt` row is `PENDING`; Chain's is
  `KERNEL_BOUND`. Until Standard migrates, the two configs of one exercise
  type are built two different ways. Nothing in these rules depends on which
  way, and this document does not schedule the migration.
