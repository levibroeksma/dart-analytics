# Shanghai

## Features

Use this table to declare what ships when. Edit the **Version** column (`V1`, `V2+`, `Deferred`, etc.).

| Feature                                         | Version |
| ----------------------------------------------- | ------- |
| Single player                                   | v1      |
| Multiplayer                                     | TBD     |
| Config screen (presets shown)                   | v1      |
| Rounds 1–7                                      | TBD     |
| Rounds 1–20                                     | v1      |
| Other round ranges                              | TBD     |
| Only active number scores                       | TBD     |
| Single / double / treble of active number count | v1      |
| Shanghai instant win (S+D+T in one visit)       | v1      |
| Highest total wins if no Shanghai               | v1      |
| Disable instant-win (score only)                | TBD     |
| Visit = 3 darts per round                       | v1      |
| Track per-round score                           | v1      |
| Standard dartboard scoring (assumed)            | v1      |

## Identity

Round-by-round target game: each round has one **active number** (1, then 2, then 3, …). Score only on that number; chase the high total — or win instantly with a **Shanghai** (single, double, and treble of the active number in one three-dart visit). Standard dartboard scoring is assumed. (Empty source file — rules filled from common Shanghai practice.)

## Objective

- **Round:** with three darts, score as much as possible on the active number only.
- **Session (V1):** complete the round range (default **1–7**). Highest cumulative score wins, unless someone hits a **Shanghai** for an instant win.

## Config & presets (V1)

Before play, a **config screen** shows the session presets.

| Setting              | V1 preset                              | On config screen (V1) |
| -------------------- | -------------------------------------- | --------------------- |
| Players              | Single player                          | Shown, locked         |
| Rounds               | **1–7**                                | Shown, locked         |
| Shanghai instant win | On                                     | Shown, locked         |
| Scoring              | Only active number (S/D/T face values) | Shown, locked         |

## How to play (V1)

### Visit

Each round, the player throws **three darts** at the **active number** for that round (round 1 → number 1, round 2 → number 2, …).

### Progress / scoring

Only darts in the active number’s single, double, or treble score:

- Single → face value
- Double → 2× face value
- Treble → 3× face value

Anything else (wrong number, bull, miss) scores **0** for that dart. Add the visit total to the running score, then advance to the next number.

### Shanghai (instant win)

If one visit contains the **single, double, and treble** of the active number (**any order**), that is a **Shanghai** — the player **wins immediately**, regardless of totals.

### Finishing

If no Shanghai occurs, after the last round the **highest total** wins (solo: personal best / complete the run).

### Bust

N/A.

## Later versions (V2+)

### Variants

- Round ranges: **1–20**, custom start/end
- **Score-only** mode (no instant-win Shanghai)
- Multiplayer: all players take each round; first Shanghai in throwing order wins that path; else highest total

### Match structure

- First to N Shanghai wins; best of N full boards

## Glossary

| Term              | Version | Meaning                                                                                  |
| ----------------- | ------- | ---------------------------------------------------------------------------------------- |
| **Active number** | V1      | The only scoring segment for the current round.                                          |
| **Shanghai**      | V1      | Single + double + treble of the active number in one visit → instant win (when enabled). |

## Open questions

- Default round length for product (7 vs 20).
- Multiplayer tie if two Shanghais in the same round (usually first in order).
