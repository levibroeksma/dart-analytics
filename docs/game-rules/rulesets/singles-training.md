# Singles Training

## Features

Use this table to declare what ships when. Edit the **Version** column (`V1`, `V2+`, `Deferred`, etc.).

| Feature                                       | Version |
| --------------------------------------------- | ------- |
| Single player                                 | v1      |
| Multiplayer                                   | TBD     |
| Online multiplayer                            | TBD     |
| Config screen (presets shown)                 | v1      |
| Order: low → high (1…20, bull)                | v1      |
| Order: high → low (bull…1)                    | v1      |
| Order: randomized (each target once)          | v1      |
| Points: S=1, D=2, T=3 per dart on target      | v1      |
| Easy: score whatever you hit (misses allowed) | v1      |
| Hard: at least 1 dart must hit the target     | TBD     |
| Extreme: at least 2 darts must hit            | TBD     |
| Professional: all 3 darts must hit            | TBD     |
| Visit = 3 darts per target                    | v1      |
| Track score / hit quality                     | v1      |
| Standard dartboard layout (assumed)           | v1      |

## Identity

Section training: one target at a time, three darts each, scoring by ring quality (single / double / treble) rather than face value. Builds consistency around the board. Standard board layout is assumed; point values here are **training points**, not X01 points.

## Objective

- **Target:** throw three darts at the current section; earn training points for hits on that section.
- **Session (V1):** complete the full order (all numbers and bull once) and total the points.

## Config & presets (V1)

Before play, a **config screen** shows the session presets. In V1 most values are visible but locked; order may be the editable knob later.

| Setting    | V1 preset                                                       | On config screen (V1) |
| ---------- | --------------------------------------------------------------- | --------------------- |
| Players    | Single player                                                   | Shown, locked         |
| Order      | Low → high, high → low, or randomized — player's choice         | Editable              |
| Difficulty | Easy — score hits; misses just score 0 for that dart            | Shown, locked         |
| Points     | Single = 1, Double = 2, Treble = 3 (only on the current target) | Shown, locked         |

## How to play (V1)

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

## Later versions (V2+)

### Variants

- **Hard:** at least 1 dart must hit the target each visit
- **Extreme:** at least 2 darts must hit
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
