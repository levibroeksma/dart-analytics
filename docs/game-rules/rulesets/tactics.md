# Tactics

Current version: none (V1 in design)
Entry points: standalone

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player (practice / vs bot later) | V1 | Single | |
| Multiplayer (2+ players) | V2+ | 2+ | Wanted, unscheduled: Tactics has no engine, no `game_types` row and no seeded ruleset version, so nothing seats an opponent yet |
| Config screen (presets shown) | V1 | All | |
| Objectives: 20–15 + bull | V1 | All | |
| Extra objectives: Doubles + Triples categories | V1 | All | |
| Close: 3 marks on a number or the bull | V1 | All | |
| Single = 1 mark, double = 2, treble = 3 on a number | V1 | All | |
| Bull: outer = 1 mark, inner = 2 marks | V1 | All | |
| Own / score on: points on closed-but-opponent-open numbers | V2+ | 2+ | Wanted, unscheduled: depends on Multiplayer — with one seat there is no opponent for a number to stay open against |
| Dead number when all players have closed it | V2+ | 2+ | Wanted, unscheduled: depends on Multiplayer, for the same reason as Own / score on |
| Win: all objectives closed + score ≥ opponent(s) | V2+ | 2+ | Wanted, unscheduled: depends on Multiplayer; the solo practice win condition is still an open question below |
| Slop: any double/treble counts for D/T categories | V1 | All | |
| Strict: only doubles/trebles on 15–20 count for D/T | V2+ | All | Wanted, unscheduled: V1 locks the D/T rule to Slop (see Config & presets), so a second rule is a config field that does not exist yet |
| Dual-purpose choice (apply dart to number vs D/T category) | V1 | All | |
| Cut-throat / other cricket variants | V2+ | All | Wanted, unscheduled: depends on Multiplayer, and each variant's win and scoring rules are undecided |
| Visit = up to 3 darts | V1 | All | |
| Standard dartboard scoring (assumed) | V1 | All | |

## Identity

**Tactics** is the common UK/European cricket-style game: close **20–15** and **bull**, plus separate **Doubles** and **Triples** objectives, while scoring points on numbers you own that opponents have not closed. Standard dartboard scoring is assumed. (Empty source file — rules filled from standard Tactics/Cricket practice.)

## Objective

- **Close** all nine objectives: **20, 19, 18, 17, 16, 15, Bull, Doubles, Triples**.
- Hold a **point total ≥ every opponent** when you finish closing.
- **Session (V1):** one game under these rules (multiplayer is the natural form; single-player may be practice-only until opponents/bots exist).

## Config & presets

Before play, a **config screen** shows the session presets.

| Setting    | V1 preset                                                   | On config screen (V1) |
| ---------- | ----------------------------------------------------------- | --------------------- |
| Players    | 1 seat, solo practice; a second seat follows with Multiplayer | Shown, locked         |
| Objectives | 20–15, Bull, Doubles, Triples                               | Shown, locked         |
| D/T rule   | Slop (any double/treble marks the D/T category)             | Shown, locked         |

## How to play

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

### Ends when

**Single:** all nine objectives — 20, 19, 18, 17, 16, 15, the bull, Doubles and
Triples — are closed. Nothing else bounds a run: no clock, no visit budget. What
a solo run counts as a *win* rather than merely a completed run is still an open
question below.

Once Multiplayer ships, the session instead ends when one player is closed out
with a point total at least equal to every opponent's.

### Result

Darts thrown, and per objective the marks it took to close. Points appear
alongside them once Multiplayer ships and a number can be open against an
opponent.

## Later versions

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

## Capture

Tactics is unbuilt; this is the capture shape its V1 is designed for, not an
as-built description.

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS — a mark is read off
  the dart's number and ring, so the visit total alone cannot express it and
  QUICK_SCORE cannot carry this game.
- **One dart's fact:** intended = **nothing stored** — both the target number
  and the ring are null. A visit has no single required target: any of the nine
  objectives is a legitimate aim, and the player may switch mid-visit, so any
  stored intent would be invented. Hit = whatever landed; `score` = the
  **board** score of that dart (S20 = 20, T20 = 60, outer bull = 25, miss = 0) —
  never the marks it produced and never the Tactics points it scored.
- **Dual-purpose is a player choice, not a dart fact.** Which objective a
  qualifying double or treble was applied to is a decision taken after the dart
  landed, so it is recorded alongside the visit rather than inferred from the
  dart; the fact log alone cannot recover it.
- **Stage type:** one `EXERCISE_BLOCK` for the whole game. No stage opens per
  objective; the objectives are all live at once.
- **Derived, never stored:** marks per objective, which objectives are closed or
  dead, and the point total — all folded from the dart facts and the
  dual-purpose choices against the fixed nine-objective set.

## Open questions

- Exact single-player practice win condition before multiplayer ships.
- ~~Whether V1 ships Slop or Strict as the locked preset.~~ **Resolved:** Slop —
  Config & presets locks the D/T rule to Slop and the Glossary already carries
  Strict as V2+.
