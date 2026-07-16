# Tactics

## Features

Use this table to declare what ships when. Edit the **Version** column (`V1`, `V2+`, `Deferred`, etc.).

| Feature                                                    | Version |
| ---------------------------------------------------------- | ------- |
| Single player (practice / vs bot later)                    | v1      |
| Multiplayer (2+ players)                                   | TBD     |
| Config screen (presets shown)                              | v1      |
| Objectives: 20–15 + bull                                   | v1      |
| Extra objectives: Doubles + Triples categories             | TBD     |
| 3 marks to close a number / bull                           | v1      |
| Single = 1 mark, double = 2, treble = 3 on a number        | v1      |
| Bull: outer = 1 mark, inner = 2 marks                      | v1      |
| Points on closed-but-opponent-open numbers                 | v1      |
| Dead number when all players have closed it                | v1      |
| Win: all objectives closed + score ≥ opponent(s)           | v1      |
| Slop: any double/treble counts for D/T categories          | TBD     |
| Strict: only doubles/trebles on 15–20 count for D/T        | TBD     |
| Dual-purpose choice (apply dart to number vs D/T category) | TBD     |
| Cut-throat / other cricket variants                        | TBD     |
| Visit = up to 3 darts                                      | v1      |
| Standard dartboard scoring (assumed)                       | v1      |

## Identity

**Tactics** is the common UK/European cricket-style game: close **20–15** and **bull**, plus separate **Doubles** and **Triples** objectives, while scoring points on numbers you own that opponents have not closed. Standard dartboard scoring is assumed. (Empty source file — rules filled from standard Tactics/Cricket practice.)

## Objective

- **Close** all nine objectives: **20, 19, 18, 17, 16, 15, Bull, Doubles, Triples**.
- Hold a **point total ≥ every opponent** when you finish closing.
- **Session (V1):** one game under these rules (multiplayer is the natural form; single-player may be practice-only until opponents/bots exist).

## Config & presets (V1)

Before play, a **config screen** shows the session presets.

| Setting    | V1 preset                                                   | On config screen (V1) |
| ---------- | ----------------------------------------------------------- | --------------------- |
| Players    | 2 (when multiplayer available); else single-player practice | Shown, locked         |
| Objectives | 20–15, Bull, Doubles, Triples                               | Shown, locked         |
| D/T rule   | Slop (any double/treble marks the D/T category)             | Shown, locked         |

## How to play (V1)

### Visit

Up to **three darts**, then play passes.

### Marks and closing (numbers & bull)

Each of **20–15** needs **three marks** to close:

- Single → 1 mark
- Double → 2 marks
- Treble → 3 marks

**Bull:** outer bull → 1 mark, inner (double) bull → 2 marks; three marks close bull.

### Points

Once you have **closed** a number and an opponent has **not**, further hits on that number score **points** equal to the segment value (as in Cricket). When **all** players have closed a number, it is **dead** — no more points there.

### Doubles & Triples categories

Each category also needs **three marks**. Qualifying hits depend on Slop vs Strict (see Glossary).

**Dual-purpose choice:** a double or treble on 15–20 may be applied either toward closing/scoring that **number** or toward the **Doubles/Triples** category (player chooses when it matters).

### Finishing

First player to close **all** objectives with a score **≥** every opponent wins. If you are closed-out but behind on points, keep scoring on numbers opponents have not closed until you catch up or they close out ahead.

### Bust

N/A in the X01 sense.

## Later versions (V2+)

### Variants

- **Strict** Tactics (only 15–20 doubles/trebles count for D/T categories)
- Standard **Cricket** without Doubles/Triples categories
- **Cut-throat** and other cricket family variants

### Match structure

- First to N games / best of N
- More than two players

### Other

- Vs DartBot / guest

## Glossary

| Term               | Version | Meaning                                                                  |
| ------------------ | ------- | ------------------------------------------------------------------------ |
| **Close**          | V1      | Reach three marks on an objective.                                       |
| **Own / score on** | V1      | Closed by you, not yet by opponent → further hits add points.            |
| **Dead**           | V1      | Closed by all players → no further scoring.                              |
| **Slop**           | V1      | Any double/treble on the board marks the Doubles/Triples category.       |
| **Strict**         | V2+     | Only doubles/trebles among 15–20 mark those categories.                  |
| **Dual-purpose**   | V1      | Choose whether a D/T on 15–20 counts for the number or the D/T category. |

## Open questions

- Exact single-player practice win condition before multiplayer ships.
- Whether V1 ships Slop or Strict as the locked preset.
