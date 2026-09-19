# Around the Clock

Current version: V1 (shipped 2026-08-15)
Entry points: standalone

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Multiplayer (1v1) | V1 | 1v1 | |
| Config screen (presets shown) | V1 | All | |
| Clock path: low → high (1…20, then bull) | V1 | All | |
| Clock path: high → low | V2+ | All | Wanted, unscheduled: `AroundTheClockConfig` is an empty `.strict()` object, so the path is fixed and a direction toggle is a schema change |
| Other directions / paths | V2+ | All | Wanted, unscheduled: same fixed-path schema gap as high → low, and no path other than 1…20 + bull has been defined |
| Any segment counts (single/double/treble of the number) | V1 | All | |
| Doubles-only / trebles-only path | V2+ | All | Wanted, unscheduled: a segment lock is a second fixed rule the empty config cannot express |
| Bull once (single or double bull) | V1 | All | |
| Easy: advance on any hit in the visit | V1 | All | |
| Intermediate: at least 1 dart on target per visit | V2+ | All | Wanted, unscheduled: no difficulty key exists, and the fail behaviour for the harder modes is still an open question below |
| Hard: at least 2 of 3 darts on target | V2+ | All | Wanted, unscheduled: same missing difficulty key and same open fail behaviour |
| Pro: all 3 darts on target | V2+ | All | Wanted, unscheduled: same missing difficulty key and same open fail behaviour |
| Fail / lose the game on missed visit (harder modes) | V2+ | All | Wanted, unscheduled: depends on Intermediate/Hard/Pro, and the open question below is exactly which fail behaviour it takes |
| Track turns to completion | V1 | All | |
| Track hit ratio | V1 | All | |
| Track what was hit per target (S/D/T) | V1 | All | |
| Visit = up to 3 darts | V1 | All | |
| Standard dartboard scoring (assumed) | V1 | All | |
| Entry type per dart (e.g. target = 1, d1=miss, d2=s1, d3=s2) | V1 | All | |

## Identity

Traditional pub game that also works as training: hit every segment “around” the board in order. Standard dartboard scoring is assumed. Directions and difficulty can be configured.

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

### Result

Darts thrown to complete the circuit, the hit ratio, and what was hit on each
target (single / double / treble). In 1v1, the winning seat beside both seats'
dart counts, or a tie.

## Later versions

### Variants

- **Directions:** high → low; other configurable paths
- **Segment locks:** doubles-only or trebles-only (same difficulty ladder)
- **Difficulty:**
  - **Intermediate:** at least **1** dart of the visit must hit the current target (or the player fails that requirement)
  - **Hard:** at least **2 of 3** darts on the current target
  - **Pro:** all **3** darts on the current target
- Harder modes can make the player **lose** the game on failure (not only stall)

### Match structure

- Multiplayer races / shared clock sessions

### Other

- **Tracks:** turns to completion; hit ratio; per-target hit type (single / double / treble)

## Glossary

| Term                                 | Version  | Meaning                                                           |
| ------------------------------------ | -------- | ----------------------------------------------------------------- |
| **Clock path**                       | V1       | Ordered list of targets (default 1…20, bull).                     |
| **Any segment**                      | V1       | Single, double, or treble of the current number counts.           |
| **Doubles-only / trebles-only**      | V2+      | Only that ring of the current number counts.                      |
| **Easy**                             | V1       | Any dart of the visit that hits the current target advances it.   |
| **Intermediate**                     | V2+      | At least 1 dart of the visit must hit the current target.         |
| **Hard**                             | V2+      | At least 2 of the visit's 3 darts must hit the current target.    |
| **Pro**                              | V2+      | All 3 darts of the visit must hit the current target.             |

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

## Open questions

- Exact fail behaviour for Intermediate/Hard/Pro (retry visit vs game over) when those modes ship.
