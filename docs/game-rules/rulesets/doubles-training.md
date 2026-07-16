# Doubles Training

## Features

Use this table to declare what ships when. Edit the **Version** column (`V1`, `V2+`, `Deferred`, etc.).

| Feature                                                      | Version |
| ------------------------------------------------------------ | ------- |
| Single player                                                | v1      |
| Multiplayer                                                  | TBD     |
| Config screen (presets shown)                                | v1      |
| Easy mode (advance after visit even on miss)                 | v1      |
| Hard mode (stay until hit)                                   | TBD     |
| Challenge mode (miss all 3 → step back; D1 miss → game over) | TBD     |
| Order: low → high (ending on bull)                           | v1      |
| Order: high → low (ending on bull)                           | TBD     |
| Order: randomized                                            | TBD     |
| 3 darts per double                                           | v1      |
| Hit ends visit early                                         | v1      |
| Track overall hit/miss ratio                                 | v1      |
| Track per-target hit/miss ratio                              | v1      |
| Track which dart hit (1st / 2nd / 3rd)                       | v1      |
| Standard dartboard (assumed)                                 | v1      |

## Identity

Doubles practice: work through each double (and bull) with three darts per target. Modes range from “keep moving” easy practice to stay-until-hit and step-back challenge. Standard dartboard is assumed; only the **double** (or bull as double-bull / bull target) counts as a hit.

## Objective

- **Target:** hit the current double within the visit rules for the active mode.
- **Session (V1 easy):** visit every double once in order (1…20, then bull), whether or not you hit.

## Config & presets (V1)

Before play, a **config screen** shows the session presets.

| Setting | V1 preset                   | On config screen (V1) |
| ------- | --------------------------- | --------------------- |
| Players | Single player               | Shown, locked         |
| Mode    | Easy                        | Shown, locked         |
| Order   | Low → high (ending on bull) | Shown, locked         |

## How to play (V1) — Easy mode

### Visit

Three darts at the current double. A **miss** is anything that is not that double (for bull: not the required bull/double-bull as defined for the path).

If the player **hits** the double on the first or second dart, the visit **ends immediately** — collect darts and move to the next target.

If all three miss, still **move on** to the next double.

### Progress

Order: **D1 → D2 → … → D20 → bull**. Complete the path once.

### Finishing

Session ends after the bull visit.

### Bust

N/A.

## Later versions (V2+)

### Variants — Hard mode

Same three darts per target and early end on hit, but the player **stays on the double until it is hit**. Missed visits repeat the same target.

### Variants — Challenge mode

Same as hard for hits, but if the player **misses with all three darts**, they **move back** one double. On **D1**, missing all three is **game over**.

### Config (all modes, when unlocked)

- Order: low → high (end bull), high → low (end bull), randomized

### Other — Tracks

- Overall hit/miss ratio
- Per-target hit/miss ratio
- Which dart of the visit scored the hit (1st / 2nd / 3rd)

## Glossary

| Term          | Version | Meaning                                                |
| ------------- | ------- | ------------------------------------------------------ |
| **Easy**      | V1      | One visit per double; advance even after three misses. |
| **Hard**      | V2+     | Remain on a double until hit.                          |
| **Challenge** | V2+     | Three misses → previous double; D1 wipe → game over.   |
| **Hit**       | V1      | Dart in the required double (or bull target).          |

## Open questions

- Whether “bull” means double bull only or outer/inner both count in this trainer.
