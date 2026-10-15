# Around the Clock

Current version: V2 (shipped 2026-09-24)
Entry points: standalone, routine step

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Multiplayer (1v1) | V1 | 1v1 | |
| Config screen (presets shown) | V1 | All | |
| Clock path: low → high (1…20, then bull) | V1 | All | |
| Clock path: high → low | V2 | All | Scheduled for V2 (2026-09-23): the training drill needs it, and `AroundTheClockConfig` is an empty `.strict()` object, so the toggle arrives as a new ruleset version |
| Clock path: Odds first (1, 3 … 19, then 2, 4 … 20, then bull) | V2 | All | Scheduled for V2 (2026-09-23), with high → low and for the same reason: the fixed 1…20 path cannot express it |
| Other directions / paths | V2+ | All | Wanted, unscheduled: same fixed-path schema gap as high → low, and no path other than 1…20 + bull has been defined |
| Any segment counts (single/double/treble of the number) | V1 | All | |
| Outer single only (segment lock) | V2 | All | Scheduled for V2 (2026-09-23): the training drill counts only the outer single. Needs ANALYTICS + VISUAL_BOARD — keypad capture records an unbanded `SINGLE` (`app/src/modules/game/types.ts:391-393`) |
| Doubles-only / trebles-only path | V2+ | All | Wanted, unscheduled: a segment lock is a second fixed rule the empty config cannot express |
| Bull once (single or double bull) | V1 | All | |
| Easy: advance on any hit in the visit | V1 | All | |
| Intermediate: at least 1 dart on target per visit | V2 | All | Scheduled for V2 (2026-09-23): no difficulty key exists in V1; the fail behaviour is now settled as a step back |
| Hard: at least 2 of 3 darts on target | V2 | All | Scheduled for V2 with Intermediate, same reason |
| Pro: all 3 darts on target | V2 | All | Scheduled for V2 with Intermediate, same reason |
| Step back one target on a failed visit | V2 | All | Scheduled for V2 (2026-09-23): the fail behaviour the harder modes take — answers the open question below |
| Fail / lose the game on missed visit (harder modes) | V2+ | All | Wanted, unscheduled: depends on Intermediate/Hard/Pro, and the open question below is exactly which fail behaviour it takes |
| Timed run (3–30 minutes) | V2 | Single | Scheduled for V2 (2026-09-23): the drill asks how far you get in a set time; V1 has no clock (see Ends when) |
| Timed run in 1v1 | V2+ | 1v1 | Wanted, unscheduled: one device alternates seats, and whether the clock is shared or per seat is undecided — Ten Up One Down keeps its timer single-player for the same reason (`ten-up-one-down.md` Ends when) |
| Clock restart when time remains | V2 | Single | Scheduled for V2 (2026-09-23), with the timed run: finishing the path early must not end a timed run |
| Runs as a routine step (timed) | V2 | Single | Scheduled for V2 (2026-09-23): the point of this version is use in training routines, via the `GAME` exercise type |
| Car Rally (player-set course, two-hit obstacles) | V2+ | 1v1 | Wanted, unscheduled (2026-10-12): the variant stacks three switches on the shipped clock, kept here as one variant because the path/hit-advance structure is unchanged. The path comes only from `clockPath(pathDirection, oddsFirst)` (`app/src/modules/game/around-the-clock.engine.module.ts:62`), so a player-set course, a per-target hit count and a first-to-finish end (the engine resolves by fewest darts, `:269-277`) have nowhere to live. The source plays 2–6 players, so no Single; the repo caps this ruleset at 2 seats (`app/src/services/session-seats.service.ts:24-25`) and rejects teams (`:87-88`), so the source's Team Relay is out |
| Three in a Bed (all 3 darts in one bed to advance) | V2+ | All | Wanted, unscheduled (2026-10-12): the variant stacks several switches, kept here as one variant because it is still a walk along an ordered list. It needs a stay-put fail (V2 only steps back), a strict same-ring bed, a 1…20 path with no bull, and a race end with a tiebreak — none of which `rulesOf` expresses (`around-the-clock.engine.module.ts:57-67`). The source plays 1–8 players; the repo caps this ruleset at 2 seats |
| Track turns to completion | V1 | All | |
| Track hit ratio | V1 | All | |
| Track what was hit per target (S/D/T) | V1 | All | |
| Visit = up to 3 darts | V1 | All | |
| Standard dartboard scoring (assumed) | V1 | All | |
| Entry type per dart (e.g. target = 1, d1=miss, d2=s1, d3=s2) | V1 | All | |
| Chase the Dragon: trebles 10–20, outer bull, inner bull; first seat to finish wins | V2+ | 1v1 | Wanted, unscheduled: four things the engine cannot express — a path other than 1…20 + bull (`AroundTheClockV2Config` has direction and odds-first only, `app/src/lib/game/rulesets/types.ts:406-407`), a treble-only rule (`segment_rule` is `ANY`/`OUTER_SINGLE`, `types.ts:408`; see the Doubles-only / trebles-only row), a bull split into outer then inner (either ring counts, `app/src/modules/game/around-the-clock.engine.module.ts:121-126`), and a race ending (the engine is score-compare, both seats play out, `around-the-clock.engine.module.ts:237-243`) |

## Identity

Traditional pub game that also works as training: hit every segment “around” the board in order. Standard dartboard scoring is assumed. Directions and difficulty can be configured.

## Tags

### Standalone

| Axis | Tags |
| --- | --- |
| Skill | ACCURACY (primary) |
| Session role | WARM_UP, RECREATIONAL |
| Format | SOLO, ONE_V_ONE |
| Difficulty | BEGINNER |
| Mechanic | SEQUENTIAL |
| Pressure | NONE |
| Family | STANDARD |

### Routine step

| Axis | Tags |
| --- | --- |
| Skill | ACCURACY (primary) |
| Session role | WARM_UP, CORE |
| Format | SOLO |
| Difficulty | INTERMEDIATE (1 dart), ADVANCED (2 darts), EXPERT (3 darts) |
| Mechanic | SEQUENTIAL |
| Pressure | SETBACK |

## Objective

- **Run:** hit every required target in sequence until the path is complete (typically **1 → 20 → bull**).
- **Session (V1):** complete one full clock. Optional later modes can fail the player for missing a visit’s hit requirement.
- **1v1:** both seats finish their own circuit; fewest darts wins (score-compare, ties possible). <!-- 2026-08-22 -->

## Config & presets

Before play, a **config screen** shows the session presets. In V1 most values are visible but locked; later versions unlock harder modes and path variants.

| Setting      | V1 preset                                             | On config screen (V1) |
| ------------ | ----------------------------------------------------- | --------------------- |
| Players      | 1 seat, or 2 (you + one guest)                        | Editable              |
| Path         | Low → high (1…20, bull)                               | Shown, locked         |
| Segment rule | Any (single, double, or treble of the current number) | Shown, locked         |
| Bull         | Hit once (single or double bull)                      | Shown, locked         |
| Difficulty   | Easy — any hit on the current target advances         | Shown, locked         |

From V2 (single player only for the timed settings), the player picks:

| Setting (V2)  | Preset                                                        | On config screen |
| ------------- | ------------------------------------------------------------- | ---------------- |
| Path          | Low → high (default), high → low, odds first; odds first combines with high → low | Editable |
| Segment rule  | Any (default) or outer single only                            | Editable         |
| Difficulty    | Easy (default), Intermediate, Hard or Pro                     | Editable         |
| Duration      | Untimed (default) or timed: **10** minutes (min **3**, max **30**) | Editable (Single) |
| Chase the Dragon (V2+) | Off (default) or on; on fixes the path, treble-only rule and race ending together | Editable (V2+) |

As a routine step the duration is the step's allocation and replaces this setting.

## How to play

### Visit

A **visit** is up to **three darts**. After the visit, play continues to the next visit (single-player: just the next throw).

### Progress

Start on **1**. Any dart in the **1** segment (single, double, or treble) counts as a hit and advances to **2**, then **3**, and so on through **20**. After 20, the player must hit the **bull** once (outer or inner). That completes the clock.

Misses do not move the player backward in V1 easy mode; the player simply stays on the current number until it is hit.

### Finishing

The run ends when the bull has been hit once after 1–20 are cleared.

### Bust

N/A — there is no X01-style bust. Harder modes (later) can fail a visit or the whole game instead.

### Ends when

The circuit is complete: 1 through 20 cleared in order, then the bull hit once.
The bull hit ends the visit and the session immediately — the remaining darts of
that visit are not thrown. Nothing else bounds a session: no clock, no visit
budget.

**Single:** the one seat plays until its own circuit is complete.

**1v1:** each seat runs its own circuit, and neither is cut short — the match
ends once both are complete. Fewest darts wins; equal darts is a tie, with no
tiebreak.

**Timed run (V2):** the run ends when the clock reaches 0, and nothing else;
the visit in progress finishes first. Completing the path does not end it — see
Clock restart.

### Result

Darts thrown to complete the circuit, the hit ratio, and what was hit on each
target (single / double / treble). In 1v1, the winning seat beside both seats'
dart counts, or a tie.

**Single:** a timed run (V2) shows how far the player got — laps completed and
the target stood on when the clock hit 0 — beside darts thrown and the hit
ratio.

## Later versions

### Variants

- **Directions:** high → low; other configurable paths
- **Clock path: high → low (V2):** 20 → 1, then bull.
- **Odds first (V2):** 1, 3 … 19, then 2, 4 … 20, then bull. With high → low:
  19, 17 … 1, then 20, 18 … 2, then bull.
- **Outer single only (V2):** on a number, only the outer single (between the
  treble and the double) counts; inner single, double and treble are misses. On
  the bull, either ring counts — the same bull rule as Singles Training's
  Accuracy mode (`singles-training.md`).
- **Step back (V2):** under Intermediate, Hard or Pro, all three darts are thrown
  at the current target and the visit then resolves once: enough hits → advance
  one target; too few → step back one target. On the first target of the path a
  failed visit stays put; the player never drops below it, restart or not. From
  the bull a step back returns to the path's last number. Easy is unchanged —
  it has no failed visit, so it never steps back.
- **Timed run (V2):** the session lasts a set number of minutes (3–30, default
  10); the result is how far the player got, not darts to finish.
- **Clock restart (V2):** in a timed run, hitting the bull with time left starts
  the path again from its first target (1 low → high, 20 high → low, 1 or 19 odds
  first) and counts one lap; the lap-closing dart ends that visit. An untimed
  run still ends on the bull.
- **Segment locks:** doubles-only or trebles-only (same difficulty ladder)
- **Difficulty:**
  - **Intermediate:** at least **1** dart of the visit must hit the current target (or the player fails that requirement)
  - **Hard:** at least **2 of 3** darts on the current target
  - **Pro:** all **3** darts on the current target
- Harder modes can make the player **lose** the game on failure (not only stall)
- **Car Rally (V2+):** a race along a **course** the players agree before play —
  an ordered list of board segments (source: typically 10–20, e.g. ending on the
  bull). A **normal** segment clears on one hit; an **obstacle**, marked before
  play, needs two hits, and a single hit is kept between visits. Any ring of the
  number is a hit; a dart on any other segment is a miss. Darts resolve one at a
  time as in Easy, so one visit can clear several segments; there is no bust and
  no step back. The dart that clears the last segment ends the visit and the
  game.
  **1v1:** the first seat to clear the course wins at once — no tie is
  possible, unlike the shipped clock's fewest-darts-after-both-finish. A seat
  never skips ahead: only the current segment counts.
- **Three in a Bed (V2+):** walk 1 → 20 (no bull). To clear a number, all three
  darts of the visit must land in the same **bed** of it; all three are always
  thrown. Fewer than three in the bed fails the visit and the player **stays**
  on that number — no step back (unlike V2's Step back). A dart on another
  number, or a miss, is not in any bed. Bed, picked before play:
  **relaxed wedge** — any ring of the number (the same test as Pro with Any
  segment); **strict** — all three in the same ring (all singles, all doubles or
  all trebles; inner and outer single count as one ring). The source's "Big
  Singles Only" is strict with the existing Outer single only lock (V2; needs
  ANALYTICS + VISUAL_BOARD, `app/src/modules/game/types.ts:391-393`). Clearing
  20 ends that seat's circuit.
  **Single:** the session ends when 20 is cleared; the result is darts and
  visits taken.
  **1v1:** the round is played out so both seats have equal visits; seats that
  clear 20 in the same round tie. The source breaks a tie with one sudden-death
  round of three-in-a-bed on an agreed target (the bull suggested) — see Open
  questions.
- **Chase the Dragon (V2+):** a race over thirteen fixed targets — the treble of
  10, 11 … 20 in order, then the outer bull, then the inner bull. Only the
  current target counts: the single or double of the number, or the other bull
  ring, is a miss. A hit advances at once and the visit's remaining darts go at
  the next target, as in Easy, so one visit can clear up to three. No points, no
  bust, no step back. **1v1:** the first seat to hit the inner bull wins on that
  dart and the match ends there, darts unthrown and the other seat's visits
  unequalised; this replaces the fewest-darts finish for this variant only.
  Seats are 1v1 only — the source allows up to eight, the cap is 2
  (`app/src/services/session-seats.service.ts:25`).

### Match structure

- Multiplayer races / shared clock sessions
- **Timed run in 1v1** (V2+): undecided whether one clock is shared or each seat
  has its own on a single device.

### Other

- **Tracks:** turns to completion; hit ratio; per-target hit type (single / double / treble)

## Glossary

| Term                                 | Version  | Meaning                                                           |
| ------------------------------------ | -------- | ----------------------------------------------------------------- |
| **Clock path**                       | V1       | Ordered list of targets (default 1…20, bull).                     |
| **Any segment**                      | V1       | Single, double, or treble of the current number counts.           |
| **Doubles-only / trebles-only**      | V2+      | Only that ring of the current number counts.                      |
| **Easy**                             | V1       | Any dart of the visit that hits the current target advances it.   |
| **Intermediate**                     | V2       | At least 1 dart of the visit must hit the current target.         |
| **Hard**                             | V2       | At least 2 of the visit's 3 darts must hit the current target.    |
| **Pro**                              | V2       | All 3 darts of the visit must hit the current target.             |
| **Clock path: high → low**           | V2       | 20 → 1, then bull.                                                |
| **Odds first**                       | V2       | Odd numbers, then even, then bull; combines with high → low.      |
| **Outer single only**                | V2       | Only the outer single of the number counts; either bull ring on bull. |
| **Step back**                        | V2       | A failed Intermediate/Hard/Pro visit moves back one target, never below the first. |
| **Timed run**                        | V2       | Session bounded by 3–30 minutes; result is how far the player got. |
| **Timed run in 1v1**                 | V2+      | A timed run with two seats on one device.                         |
| **Clock restart**                    | V2       | In a timed run, the bull with time left restarts the path; one lap. |
| **Runs as a routine step**           | V2       | Played as a `GAME` exercise step; the routine sets the duration.  |
| **Car Rally**                        | V2+      | Race along a player-set course; obstacle segments need two hits; first to clear it wins. |
| **Three in a Bed**                   | V2+      | Clear a number only when all 3 darts of the visit share a bed; a failed visit stays put. |
| **Chase the Dragon**                 | V2+      | Trebles 10–20, outer bull, inner bull in order; first seat to finish wins at once. |

## Capture

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS — every dart thrown is
  recorded. Also implemented: ANALYTICS + VISUAL_BOARD, the same darts with real
  landing coordinates.
- **One dart's fact:** intended = **nothing stored** — both the target number and
  the ring are null. Any ring of the current number advances the clock, so all
  three are valid intentional outcomes and recording one would fabricate an
  intent the player never held; the intended target is recoverable from the
  circuit position instead. Hit = whatever landed; `score` = the **board** score
  of that dart (S1 = 1, T20 = 60, inner bull = 50, miss = 0).
- **Stage type:** one `EXERCISE_BLOCK` per seat for the whole circuit — stage
  ownership is `PER_SEAT`, so a 1v1 match holds one block per seat, never a
  shared one. No stage opens per target.
- **Derived, never stored:** the current target, turns to completion, the hit
  ratio, and the per-target hit type — all folded from the dart facts against
  the fixed 1…20 + bull path.
- **V2:** the path, segment rule, difficulty and duration come from the
  configuration snapshot; darts stay facts as above. Current target, laps and
  step-backs are folded from the darts against the configured path. Only timer
  expiry cannot be derived from darts — it enters the engine the way Ten Up One
  Down's does (`TuodState.timerExpired`, `app/src/modules/game/types.ts`).
  Outer single only needs ANALYTICS + VISUAL_BOARD: keypad capture records an
  unbanded `SINGLE` and cannot tell an outer single from an inner one.
- **Chase the Dragon (V2+):** every dart has exactly one possible intent (the
  current treble, outer bull or inner bull), unlike the "nothing stored" answer
  above, so an intended target and ring could be recorded; whether to is open.
  `score` stays the board score. The current target is folded from the darts
  against the 13-target path in the config snapshot. The winner is the seat
  whose completing dart came first across seats — see Open questions. Stage type
  unchanged: one `EXERCISE_BLOCK` per seat.

## Open questions

- ~~Exact fail behaviour for Intermediate/Hard/Pro (retry visit vs game over) when those modes ship.~~
  **Resolved (2026-09-23):** step back one target — see Step back. Losing the
  game on a failed visit stays V2+.
- Timed run in 1v1: one shared clock or a clock per seat, on a single device?
- Car Rally: does the bull, as a course segment, take either ring as in the
  shipped clock? The source lists "Bull" in its example course with no ring rule.
- Car Rally: are courses presets or free lists — may a segment repeat, and what
  length bounds apply? The source says only "agree a course", typically 10–20
  segments.
- Car Rally: is the round played out after the first seat clears the course? The
  source's same-round sentence reads either way; the winner is the same (the
  earlier finisher), only the darts recorded differ.
- Three in a Bed: when the tiebreak round does not separate the seats (none or
  all land three in the bed), what happens next? The source says only "a single
  sudden-death round on a mutually agreed target".
- Three in a Bed: do inner and outer single count as one ring under Strict? The
  source's objective speaks of "the single 14 segment", its Strict variation of
  "all singles".
- Chase the Dragon: the source says only the current target counts, so a dart in
  the inner bull while the outer bull is needed reads as a miss here. Is that
  intended, or does the inner bull also clear the outer?
- Chase the Dragon: the seat that throws first has an edge in a race and the
  source offers no equalising visit. Accept it, or add one?
- Chase the Dragon: "first to finish" needs cross-seat order, but this file's
  stage ownership is `PER_SEAT` and `turns.sequence_number` is unique per stage
  and participant (`database/migrations/0011_ordering_and_uniqueness.sql:28`).
  How is the first finisher derived? Proposed reading: seat order is fixed and
  visits alternate, so the first finisher is the seat that completes in the
  fewest visits, the earlier seat winning on equal visits — the same per-seat
  turn count `activeSeat` already folds.
- Chase the Dragon is solo-unplayable as written (it is a race); a solo
  darts-to-complete run is not recorded. Source sub-variations (trebles 1–20,
  trebles 15–20, doubles) are not recorded.
