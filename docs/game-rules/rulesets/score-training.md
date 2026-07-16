# Score Training

## Features

Use this table to declare what ships when. Edit the **Version** column (`V1`, `V2+`, `Deferred`, etc.).

| Feature                                | Version         |
| -------------------------------------- | --------------- |
| Single player                          | v1              |
| Multiplayer                            | TBD             |
| Config screen (presets shown)          | v1              |
| Fixed number of visits (N turns)       | v1 (default 10) |
| N editable                             | v1              |
| Score as high as possible (face value) | v1              |
| All board segments count               | v1              |
| Bulls count (25 / 50)                  | v1              |
| Visit = 3 darts                        | v1              |
| Track total score                      | v1              |
| Track 3-dart average                   | v1              |
| Target score / challenge goal          | v1              |
| Standard dartboard scoring (assumed)   | v1              |

## Identity

Simple scoring practice: throw for **N** visits and pile up as many points as you can. No checkout, no bust — pure scoring volume. Standard dartboard scoring is assumed. (Source note: “n turns, score as high as you can.”)

## Objective

- **Visit:** score the sum of three darts (face values, including doubles/trebles/bulls).
- **Session (V1):** complete **N** visits; highest total wins (solo: beat your own total / chase a personal best).

## Config & presets (V1)

Before play, a **config screen** shows the session presets.

| Setting    | V1 preset                              | On config screen (V1) |
| ---------- | -------------------------------------- | --------------------- |
| Players    | Single player                          | Shown, locked         |
| Visits (N) | Default **10** (min **1**, max **50**) | Editable              |
| Scoring    | Full board, standard values            | Shown, locked         |

## How to play (V1)

### Visit

Exactly **three darts** (or up to three — all count toward the visit total). Sum their standard values and add to the running session score.

### Progress

Repeat until **N** visits are done. Every dart that scores on the board counts; there is no “wrong” target.

### Finishing

Session ends after visit N. Report total points (and optionally 3-dart average = total ÷ N).

### Bust

N/A.

## Later versions (V2+)

### Variants

- Challenge: beat a **target total**
- Restricted scoring (e.g. only trebles, only 20s) as optional modes
- Multiplayer: highest total after N visits wins

### Match structure

- Best of / first to across multiple score-training blocks

### Other

- Track history / personal bests

## Glossary

| Term      | Version | Meaning                                         |
| --------- | ------- | ----------------------------------------------- |
| **Visit** | V1      | Three darts; sum is added to the session total. |
| **N**     | V1      | How many visits in the session.                 |

## Open questions

- Default N (10 suggested) and max N when product locks ranges.
- Whether missed board / bounce-outs are entered as 0 only or have a separate miss track.
