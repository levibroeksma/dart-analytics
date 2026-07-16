# Around the Clock

## Features

Use this table to declare what ships when. Edit the **Version** column (`V1`, `V2+`, `Deferred`, etc.).

| Feature                                                      | Version |
| ------------------------------------------------------------ | ------- |
| Single player                                                | v1      |
| Multiplayer                                                  | TBD     |
| Config screen (presets shown)                                | v1      |
| Sequence low → high (1…20, then bull)                        | v1      |
| Sequence high → low                                          | TBD     |
| Other directions / paths                                     | TBD     |
| Any segment counts (single/double/treble of the number)      | v1      |
| Doubles-only path                                            | TBD     |
| Trebles-only path                                            | TBD     |
| Bull once (single or double bull)                            | v1      |
| Easy: advance on any hit in the visit                        | v1      |
| Intermediate: at least 1 dart on target per visit            | TBD     |
| Hard: at least 2 of 3 darts on target                        | TBD     |
| Pro: all 3 darts on target                                   | TBD     |
| Fail / lose the game on missed visit (harder modes)          | TBD     |
| Track turns to completion                                    | v1      |
| Track hit ratio                                              | v1      |
| Track what was hit per target (S/D/T)                        | v1      |
| Visit = up to 3 darts                                        | v1      |
| Standard dartboard scoring (assumed)                         | v1      |
| Entry type per dart (e.g. target = 1, d1=miss, d2=s1, d3=s2) | v1      |

## Identity

Traditional pub game that also works as training: hit every segment “around” the board in order. Standard dartboard scoring is assumed. Directions and difficulty can be configured.

## Objective

- **Run:** hit every required target in sequence until the path is complete (typically **1 → 20 → bull**).
- **Session (V1):** complete one full clock. Optional later modes can fail the player for missing a visit’s hit requirement.

## Config & presets (V1)

Before play, a **config screen** shows the session presets. In V1 most values are visible but locked; later versions unlock harder modes and path variants.

| Setting      | V1 preset                                             | On config screen (V1) |
| ------------ | ----------------------------------------------------- | --------------------- |
| Players      | Single player                                         | Shown, locked         |
| Path         | Low → high (1…20, bull)                               | Shown, locked         |
| Segment rule | Any (single, double, or treble of the current number) | Shown, locked         |
| Bull         | Hit once (single or double bull)                      | Shown, locked         |
| Difficulty   | Easy — any hit on the current target advances         | Shown, locked         |

## How to play (V1)

### Visit

A **visit** is up to **three darts**. After the visit, play continues to the next visit (single-player: just the next throw).

### Progress

Start on **1**. Any dart in the **1** segment (single, double, or treble) counts as a hit and advances to **2**, then **3**, and so on through **20**. After 20, the player must hit the **bull** once (outer or inner). That completes the clock.

Misses do not move the player backward in V1 easy mode; the player simply stays on the current number until it is hit.

### Finishing

The run ends when the bull has been hit once after 1–20 are cleared.

### Bust

N/A — there is no X01-style bust. Harder modes (later) can fail a visit or the whole game instead.

## Later versions (V2+)

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
| **Easy / Intermediate / Hard / Pro** | V1 / V2+ | How many darts of a visit must hit before advancing (or failing). |

## Open questions

- Exact fail behaviour for Intermediate/Hard/Pro (retry visit vs game over) when those modes ship.
