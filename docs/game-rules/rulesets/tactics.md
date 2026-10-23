# Tactics

Current version: V1 (shipped 2026-10-06)
Entry points: standalone
Game type: `TACTICS`
Kernel: MARKS

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player (practice / vs bot later) | V1 | Single | |
| 1v1 multiplayer (two seats) | V2 | 1v1 | Being built as ruleset version `TACTICS_V2` (2026-10-23); solo under V2 plays exactly as V1 |
| Multiplayer (2+ players) | V2+ | 2+ | Wanted, unscheduled: more than two seats — V2 caps a session at two seats, and the win and dead-number rules are written for one opponent (`database/seeds/0034_tactics_game_engine_reference.sql` holds V1's row) |
| Config screen (presets shown) | V1 | All | |
| Objectives: 20–15 + bull | V1 | All | |
| Extra objectives: Doubles + Triples categories | V1 | All | |
| Close: 3 marks on a number or the bull | V1 | All | |
| Single = 1 mark, double = 2, treble = 3 on a number | V1 | All | |
| Bull: outer = 1 mark, inner = 2 marks | V1 | All | |
| Own / score on: points on closed-but-opponent-open numbers | V2 | 1v1 | Needs an opponent seat, so it applies only in 1v1; solo has none |
| Excess marks score on a number the opponent has open | V2 | 1v1 | A dart's marks beyond the third score as points while the opponent has not closed the number; V1 discards them because it has no opponent |
| Dead number when all players have closed it | V2 | 1v1 | Needs an opponent seat, as Own / score on |
| Win: all objectives closed + score ≥ opponent(s) | V2 | 1v1 | The first dart that leaves a seat closed out with points at least equal to the opponent's ends the game; solo has no win condition (resolved below) |
| Slop: any double/treble counts for D/T categories | V1 | All | |
| Strict: only doubles/trebles on 15–20 count for D/T | V2+ | All | Wanted, unscheduled: V1 locks the D/T rule to Slop (see Config & presets), so a second rule is a config field that does not exist yet |
| Auto rule: dual-purpose (number while open, else D/T category) | V1 | All | |
| Points-first auto rule: a D/T on a number you own scores, it does not mark D/T | V2 | 1v1 | In 1v1 a double or treble on a 15–20 number you have closed and the opponent has not scores points on the number; it marks Doubles/Triples only once the number is dead. Solo has no opponent, so the V1 auto rule is unchanged |
| Dual-purpose choice (apply dart to number vs D/T category) | V2+ | 2+ | Wanted, unscheduled: V2 settles the overlap with the points-first auto rule, so a player choice is a separate stored fact and persistence change |
| Bull counts toward Doubles | Dropped | All | Bull is its own objective; D/T fed by rings on 1–20 only |
| Tactics statistics section (MPR, darts-to-close trend) | V2+ | All | Wanted, unscheduled: needs a `v_tactics_*` view and a migration, as Cricket's |
| Cut-throat / other cricket variants | V2+ | All | Wanted, unscheduled: each variant's win and scoring rules are undecided, and V2's 1v1 points fold would need a second scoring mode |
| Minnesota Cricket (a tenth objective, Three-in-a-bed) | V2+ | All | Wanted, unscheduled: the nine objectives are an engine constant (`TACTICS_OBJECTIVES`, `app/src/modules/game/tactics.engine.module.ts:36`), so a tenth is a new engine branch and a config field V1 does not have; the rules also leave gaps (see Open questions) |
| Three-in-a-bed bonus (points on closing) | V2+ | 2+ | Wanted, unscheduled: depends on Minnesota Cricket's tenth objective, and the source leaves open whether an opponent's closed state gates it |
| Visit = up to 3 darts | V1 | All | |
| Standard dartboard scoring (assumed) | V1 | All | |

## Identity

**Tactics** is the common UK/European cricket-style game: close **20–15** and **bull**, plus separate **Doubles** and **Triples** objectives, while scoring points on numbers you own that opponents have not closed. Standard dartboard scoring is assumed. (Empty source file — rules filled from standard Tactics/Cricket practice.)

## Tags

| Axis | Tags |
| --- | --- |
| Skill | SCORING (primary), DOUBLES, BULL |
| Session role | CORE |
| Format | SOLO, ONE_V_ONE, MULTIPLAYER |
| Difficulty | ADVANCED |
| Mechanic | TERRITORIAL |
| Pressure | NONE |
| Family | STANDARD |

## Objective

- **Close** all nine objectives: **20, 19, 18, 17, 16, 15, Bull, Doubles, Triples**.
- Hold a **point total ≥ every opponent** when you finish closing.
- **Session (V1):** one game under these rules (multiplayer is the natural form; single-player may be practice-only until opponents/bots exist).

## Config & presets

Before play, a **config screen** shows the session presets.

| Setting    | V1 preset                                                   | On config screen (V1) |
| ---------- | ----------------------------------------------------------- | --------------------- |
| Players    | 1 seat, solo practice; V2 adds a second seat (1v1)          | Shown, chosen by seat |
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

**1v1:** points on a number are the marks beyond the third times the number's value (the bull is worth 25 a mark), scored while the opponent has not closed it. A dart that closes a number with marks to spare scores those spare marks the same way. Doubles and Triples never score points. Solo has no opponent, so nothing scores and spare marks are discarded as in V1.

### Doubles & Triples categories

Each category also needs **three marks**. Qualifying hits depend on Slop vs Strict (see Glossary).

**Dual-purpose (V1 auto rule):** a double or treble on 15–20 marks that **number** while it is open; once it is closed it marks the **Doubles/Triples** category. A closing dart's spare marks are discarded. The bull never feeds Doubles/Triples. The player choice is V2+.

**1v1:** the auto rule is points first. A double or treble on a 15–20 number marks that number while it is open for you. Once you have closed it, the dart scores points on the number while the opponent has not closed it, and marks Doubles/Triples only when the number is dead. On 1–14 a double or treble marks its category as in V1. A single on a dead number does nothing.

### Finishing

First player to close **all** objectives with a score **≥** every opponent wins. If you are closed-out but behind on points, keep scoring on numbers opponents have not closed until you catch up or they close out ahead.

**1v1:** the game ends on the first dart that leaves the throwing seat with all nine objectives closed and points at least equal to the opponent's, mid-visit if need be. It cannot end level: a closed-out seat that is behind keeps throwing, and the opponent can no longer score on any number that seat has closed, so the first seat to be closed out and level or ahead wins at that dart.

### Bust

N/A in the X01 sense.

### Ends when

**Single:** all nine objectives — 20, 19, 18, 17, 16, 15, the bull, Doubles and
Triples — are closed. Nothing else bounds a run: no clock, no visit budget. What
a solo run counts as a *win* rather than merely a completed run is still an open
question below.

**1v1:** the session instead ends when one seat is closed out with a
point total at least equal to its opponent's (see Finishing). The winner is that
seat; there is no tie.

### Result

Darts thrown, and per objective the marks it took to close.

**1v1:** each seat's points and darts, and the winner.

## Later versions

### Variants

- **Excess marks** (V2, 1v1) — marks beyond the third on a number the opponent
  has not closed score as points: a treble 20 on a number with two marks closes
  it and scores 40.
- **Points-first** (V2, 1v1) — the auto rule once an opponent exists: a double or
  treble on an owned 15–20 number scores on it before it can mark Doubles or
  Triples.
- **Strict** Tactics (only 15–20 doubles/trebles count for D/T categories)
- Standard **Cricket** without Doubles/Triples categories
- **Cut-throat** and other cricket family variants
- **Minnesota Cricket** (V2+) — Tactics with a tenth objective, **Three-in-a-bed**:
  all three darts of one visit land in the same bed, and that closes it in one
  visit. There is no running count across visits; a visit that misses the
  pattern leaves it open. The other nine objectives, Slop for Doubles/Triples
  and the win test (all objectives closed, points at least equal to every
  opponent) are Tactics' own. Plain Tactics is the source's "Optional
  Three-in-a-Bed" form. The source also calls it Wild Mouse; its "Mickey Mouse"
  alias is not this repo's `mickey-mouse.md`, which is a different objective
  set. Routing verdict (2026-10-12): a rule switch — one added objective plus a
  bonus — not a distinct game, so it lives here rather than in its own file.
- **Three-in-a-bed bonus** (V2+, 2+) — when Three-in-a-bed closes, the face
  values of the three darts are added to the seat's points (three treble 20s =
  180; three single 18s = 54). It needs an opponent and so follows Multiplayer.

### Match structure

- First to N games / best of N
- More than two players

### Other

- Vs DartBot / guest

## Glossary

| Term               | Version | Meaning                                                                  |
| ------------------ | ------- | ------------------------------------------------------------------------ |
| **Close**          | V1      | Reach three marks on an objective.                                       |
| **Own / score on** | V2      | Closed by you, not yet by opponent → further hits add points.            |
| **Dead**           | V2      | Closed by all players → no further scoring.                              |
| **Excess marks**   | V2      | Marks beyond the third on a number; they score while the opponent has it open. |
| **Points-first**   | V2      | In 1v1 a D/T on an owned 15–20 number scores on it, marking D/T only once dead. |
| **Slop**           | V1      | Any double/treble on the board marks the Doubles/Triples category.       |
| **Strict**         | V2+     | Only doubles/trebles among 15–20 mark those categories.                  |
| **Auto rule**      | V1      | A D/T on 15–20 marks its number while open, else the D/T category.       |
| **Dual-purpose**   | V2+     | Choose whether a D/T on 15–20 counts for the number or the D/T category. |
| **Minnesota Cricket** | V2+  | Tactics plus a tenth objective, Three-in-a-bed.                          |
| **Three-in-a-bed** | V2+     | Objective closed by landing all three darts of one visit in the same bed. |
| **Three-in-a-bed bonus** | V2+ | Points added on closing it: the face values of the three darts.        |

## Capture

Tactics is unbuilt; this is the capture shape its V1 is designed for, not an
as-built description.

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS and
  ANALYTICS + VISUAL_BOARD — a mark is read off
  the dart's number and ring, so the visit total alone cannot express it and
  QUICK_SCORE cannot carry this game.
- **One dart's fact:** intended = **nothing stored** — both the target number
  and the ring are null. A visit has no single required target: any of the nine
  objectives is a legitimate aim, and the player may switch mid-visit, so any
  stored intent would be invented. Hit = whatever landed; `score` = the
  **board** score of that dart (S20 = 20, T20 = 60, outer bull = 25, miss = 0) —
  never the marks it produced and never the Tactics points it scored.
- **Dual-purpose:** V1 applies the auto rule, so which objective a dart marked
  is folded from the dart facts and the marks before it. The V2+ player choice
  will need its own storage.
- **Stage type:** one `EXERCISE_BLOCK` for the whole game. No stage opens per
  objective; the objectives are all live at once.
- **Derived, never stored:** marks per objective, which objectives are closed or
  dead, and the point total — all folded from the dart facts and the
  dual-purpose choices against the fixed nine-objective set.
- **1v1 (V2):** no new stored fact and no schema change. Points, dead numbers
  and the winner are folded from the dart facts of both seats read in log order,
  because a dart's points depend on the opponent's marks at that moment; `score`
  stays the dart's board score. The points-first auto rule is a fold of the same
  facts, so a V1 log still folds as it did.
- **Minnesota Cricket (V2+):** Three-in-a-bed is folded from the three dart
  facts of one visit — number and ring identical on all three; no new stored
  fact. Whether those darts also mark other objectives is an open question
  below, and a "yes" would change the auto rule's fold.

## Open questions

- ~~Exact single-player practice win condition before multiplayer ships.~~
  **Resolved:** none — solo is a close-out drill (D422).
- ~~Whether V1 ships Slop or Strict as the locked preset.~~ **Resolved:** Slop —
  Config & presets locks the D/T rule to Slop and the Glossary already carries
  Strict as V2+.
- Minnesota Cricket: do the three darts that close Three-in-a-bed also mark
  other objectives? The source's single-count rule says each dart serves one
  requirement, while its tips say a triple 20 bed also advances 20 and Triples.
- Minnesota Cricket: "same bed" or "same number"? The source's examples are
  exact beds (single 20, triple 19); a single and a treble of one number are
  not addressed. Proposed reading: exact bed.
- Minnesota Cricket: is the Three-in-a-bed bonus paid only while an opponent has
  not closed it, as for numbers, or always? The source states the general
  rule and, separately, that the bonus is awarded when achieved.
- Minnesota Cricket: two seats close out in the same round on equal points — who
  wins? The source settles only a points difference.
