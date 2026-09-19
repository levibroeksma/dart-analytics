# Singles Training

Current version: V3 (shipped 2026-09-12)
Entry points: standalone

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Multiplayer (1v1) | V1 | 1v1 | |
| Online multiplayer | V2+ | 1v1 | Wanted, unscheduled: every seat is local to one device — a remote seat needs a whole networked session layer that does not exist |
| Config screen (presets shown) | V1 | All | |
| Order: Low → high (1…20, bull) | V1 | All | |
| Order: High → low (bull…1) | V1 | All | |
| Order: Random (each target once) | V1 | All | |
| Training points: S=1, D=2, T=3 per dart on target | V1 | All | |
| Easy: score whatever you hit (misses allowed) | V1 | All | |
| Hard: at least 1 dart must hit the target | V2 | All | Shipped as `SinglesV2Config.difficulty = HARD`: V1 had no bust condition at all, so nothing made a visit cost anything |
| Extreme: at least 2 darts must hit | V2 | All | Shipped as `SinglesV2Config.difficulty = EXTREME`, alongside Hard and for the same reason |
| Accuracy mode: only outer single / either bull ring scores | V3 | All | Shipped as `SinglesV3Config`: it needs coordinate capture to tell an outer single from an inner one, which only arrived with ANALYTICS + VISUAL_BOARD |
| Professional: all 3 darts must hit | V2+ | All | Wanted, unscheduled: `SinglesV3Config.difficulty` admits `EASY`/`HARD`/`EXTREME` only, so a fourth level is a new ruleset version |
| Visit = 3 darts per target | V1 | All | |
| Track score / hit quality | V1 | All | |
| Standard dartboard layout (assumed) | V1 | All | |

## Identity

Section training: one target at a time, three darts each, scoring by ring quality (single / double / treble) rather than face value. Builds consistency around the board. Standard board layout is assumed; point values here are **training points**, not X01 points.

## Objective

- **Target:** throw three darts at the current section; earn training points for hits on that section.
- **Session (V1):** complete the full order (all numbers and bull once) and total the points.
- **1v1:** highest total training points wins; ties possible, no tiebreak in this version.

## Config & presets

Before play, a **config screen** shows the session presets. In V1 most values are visible but locked; order is the one editable knob.

| Setting    | V1 preset                                                       | On config screen (V1) |
| ---------- | --------------------------------------------------------------- | --------------------- |
| Players    | 1 seat; a guest or DartBot seat on V1 only                      | Editable on V1        |
| Order      | Low → high, high → low, or randomized — player's choice         | Editable              |
| Difficulty | Easy — score hits; misses just score 0 for that dart            | Shown, locked         |
| Points     | Single = 1, Double = 2, Treble = 3 (only on the current target) | Shown, locked         |
| Scoring    | Standard (default) or Accuracy — editable from V3 onward         | Editable (V3+)         |

## How to play

### Visit

Each **target** gets one visit of **exactly three darts** (or up to three — all three are thrown for scoring). Then move to the next target in the order.

### Progress / scoring

Only darts that land in the **current** section score:

- **Single** of that number → **1** training point
- **Double** → **2**
- **Treble** → **3**

Anything else is a miss for that dart (0). Sum points across the whole run.

Bull: treat as its own target at the end of low→high (or start of high→low).

**Bull training points (V1, resolved):** **outer bull = 1 point, inner bull = 2 points** — the same single/double ladder as every other target, with no treble on the bull. Anything that is not a bull is a miss for that dart.

### Finishing

Session ends when every target in the order has been visited once.

### Bust

N/A.

### Ends when

Every target in the order has been visited once — all 21, the numbers 1–20 and
the bull. Nothing else bounds a run: no clock, no visit budget. From V2, a Hard
or Extreme run can also end early, the moment a visit fails its mandatory-hit
requirement.

**Single:** the one seat plays its own order to the end, or ends early on a
failed mandatory hit under Hard/Extreme.

**1v1:** both seats play their full order and neither is cut short; the match
ends once both are done, and the higher training-point total wins, with equal
totals a tie and no tiebreak. Under Hard/Extreme a failed mandatory hit instead
ends the match immediately and the other seat wins, whatever the points. 1v1 is
a V1-only ruleset — a V2 or V3 session (Hard/Extreme, or Accuracy) seats one
player.

### Result

The total training points, with hit quality per target. In 1v1, the winning seat
beside both seats' totals, or a tie.

## Later versions

### Hard / Extreme difficulty

A difficulty toggle, **Easy** (default), **Hard**, or **Extreme**, editable on the config screen alongside order:

- **Easy:** identical to V1 — score whatever ring is hit; misses just score 0 for that dart. No bust condition.
- **Hard:** a visit must land at least 1 of its 3 darts on the current section (single, double, or treble on a NUMBER target; outer or inner on BULL) — independent of the ring's point value. Failing at the visit's 3rd dart ends the run immediately: solo, the session ends as a loss; 1v1, the match ends immediately and the other player wins, regardless of either player's own progress or points (Bob's 27-style elimination).
- **Extreme:** same rule, but at least 2 of the visit's 3 darts must land on the current section.

Available under both Recreational and Analytical capture modes, same as V1.

### Accuracy mode

A scoring-mode toggle, **Standard** (default, identical to V1/V2's ring-quality scoring) or **Accuracy**, editable on the config screen alongside order and difficulty:

- **Standard:** identical to V1/V2 — single = 1, double = 2, treble = 3 on a NUMBER target; outer bull = 1, inner bull = 2.
- **Accuracy:** only the outer (large) single ring on a NUMBER target scores — 1 point. A miss, a double, a treble, the inner single, or a hit on the wrong target all score 0 for that dart. On the BULL, either ring (outer or inner) scores 1 point — the bull has no "outer single" equivalent, so the whole segment counts.

Accuracy mode is combinable with Hard/Extreme: the mandatory-hit bust check still counts a dart as "hit" whenever it lands anywhere in the current section (any ring), independent of whether that ring actually scores under Accuracy.

Accuracy mode requires `ANALYTICS` + `VISUAL_BOARD` capture (coordinate capture is the only way to distinguish an outer single from an inner one) — the per-dart keypad (`RECREATIONAL` + `DETAILED_DARTS`) only ever records a generic single hit, so the setup screen hides the Accuracy toggle under keypad capture, and the toggle defaults to Standard.

### Variants

- **Professional:** all 3 darts must hit

### Match structure

- Multiplayer / online multiplayer

## Glossary

| Term                | Version | Meaning                                                                         |
| ------------------- | ------- | ------------------------------------------------------------------------------- |
| **Training points** | V1      | S/D/T quality score on the current section (1/2/3), not face-value X01 scoring. On the bull: outer 1, inner 2. |
| **Low → high**      | V1      | 1, 2, … 20, bull.                                                               |
| **High → low**      | V1      | Bull, 20, 19, … 1.                                                              |
| **Random**          | V1      | All 21 targets (1–20 and bull) shuffled together per session; bull can land anywhere. |

## Capture

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS — every dart thrown is recorded.
- **One dart's fact:** intended = **nothing stored** — both the target number and the ring are null; single, double and treble on the current segment are all valid intentional outcomes, so recording either half of the pair would fabricate an intent the player never held (and a target number with no ring is rejected by `chk_dart_target_consistency` regardless). The intended target is recoverable from the visit index instead, since Singles plays one fixed target per visit. Hit = whatever landed; `score` = the **board** score of that dart (T1 = 3, S20 = 20, inner bull = 50) — never the 1/2/3 training points.
- **Stage type:** one `EXERCISE_BLOCK` for the whole run.
- **Derived, never stored:** training points. They follow from the hit segment and ring against the visit's target.

## Open questions

- Training-point values for outer vs inner bull resolved 2026-07-26 (outer 1, inner 2).
- **Blocked:** a dart fact with a target number and no intended ring is currently rejected by `chk_dart_target_consistency` (migration `0007`). Needs a decision before Singles Training sessions can be uploaded — see `docs/architecture/05-Database/06-Spec/04-Runtime-Layer.md` § darts.
