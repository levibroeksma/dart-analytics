# Cricket

Current version: none (V1 in design)
Entry points: standalone

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player (practice / vs bot later) | V1 | Single | |
| Multiplayer (2+ players) | V2+ | 2+ | Wanted, unscheduled: Cricket has no engine, no `game_types` row and no seeded ruleset version, so nothing seats an opponent yet |
| Config screen (presets shown) | V1 | All | |
| Objectives: 20–15 + bull (Classic Cricket) | V1 | All | |
| Close: 3 marks on a number or the bull | V1 | All | |
| Single = 1 mark, double = 2, treble = 3 | V1 | All | |
| Bull: outer = 1 mark, inner = 2 marks | V1 | All | |
| Own / score on: points on closed-but-opponent-open numbers | V2+ | 2+ | Wanted, unscheduled: depends on Multiplayer — with one seat there is no opponent for a number to stay open against |
| Dead number when all players have closed it | V2+ | 2+ | Wanted, unscheduled: depends on Multiplayer, for the same reason as Own / score on |
| Win: all closed + score ≥ opponent(s) | V2+ | 2+ | Wanted, unscheduled: depends on Multiplayer; the solo practice win condition is still an open question below |
| Cut-throat variant | V2+ | All | Wanted, unscheduled: depends on Multiplayer, and its own win and scoring rules are an open question below |
| No Doubles/Triples categories (see Tactics) | Dropped | All | Not a feature of this ruleset: Classic Cricket has no Doubles/Triples objectives by definition, and the UK variant that adds them is its own ruleset, `tactics.md` |
| Visit = up to 3 darts | V1 | All | |
| Standard dartboard scoring (assumed) | V1 | All | |

## Identity

Standard (American) **Cricket**: close **20–15** and the **bull**, and score points on numbers you own that opponents have not closed yet. Standard dartboard scoring is assumed. For the UK variant that also closes **Doubles** and **Triples** as separate objectives, see `tactics.md`.

## Objective

- **Close** all seven objectives: **20, 19, 18, 17, 16, 15, Bull**.
- Hold a **point total ≥ every opponent** when you finish closing.
- **Session (V1):** one game under these rules (multiplayer is the natural form; single-player may be practice-only until opponents/bots exist).

## Config & presets

Before play, a **config screen** shows the session presets.

| Setting    | V1 preset                                                   | On config screen (V1) |
| ---------- | ----------------------------------------------------------- | --------------------- |
| Players    | 1 seat, solo practice; a second seat follows with Multiplayer | Shown, locked         |
| Objectives | 20–15 + Bull                                                | Shown, locked         |
| Variant    | Classic (highest score wins with all closed)                | Shown, locked         |

## How to play

### Visit

Up to **three darts**, then play passes.

### Marks and closing

Each of **20–15** needs **three marks** to close:

- Single → 1 mark
- Double → 2 marks
- Treble → 3 marks

**Bull:** outer bull → 1 mark, inner (double) bull → 2 marks; three marks close bull.

Extra marks in the same dart that closes a number can spill into **points** if the opponent has not closed that number yet (e.g. needing one mark and hitting a treble closes and scores leftover value).

### Points

Once you have **closed** a number and an opponent has **not**, further hits on that number score **points** equal to the segment value. When **all** players have closed a number, it is **dead** — no more points there.

### Finishing

First player to close **all** objectives with a score **≥** every opponent wins. If you are fully closed but behind on points, keep scoring on numbers opponents have not closed until you catch up or they close out ahead.

### Bust

N/A in the X01 sense.

### Ends when

**Single:** all seven objectives — 20, 19, 18, 17, 16, 15 and the bull — are
closed. Nothing else bounds a run: no clock, no visit budget. What a solo run
counts as a *win* rather than merely a completed run is still an open question
below.

Once Multiplayer ships, the session instead ends when one player is closed out
with a point total at least equal to every opponent's.

### Result

Darts thrown, and per objective the marks it took to close. Points appear
alongside them once Multiplayer ships and a number can be open against an
opponent.

## Later versions

### Variants

- **Cut-throat:** scoring hits add points to opponents who have not closed that number; lowest score wins among those who have closed everything (house rules vary — lock details when shipping)
- Team / more than two players

### Match structure

- First to N games / best of N

### Other

- Vs DartBot / guest
- Cross-link / optional switch to **Tactics** (adds Doubles + Triples objectives)

## Glossary

| Term                | Version | Meaning                                                       |
| ------------------- | ------- | ------------------------------------------------------------- |
| **Close**           | V1      | Reach three marks on an objective.                            |
| **Own / score on**  | V1      | Closed by you, not yet by opponent → further hits add points. |
| **Dead**            | V1      | Closed by all players → no further scoring.                   |
| **Classic Cricket** | V1      | 20–15 + bull only (no separate D/T categories).               |
| **Cut-throat**      | V2+     | Alternate scoring/win logic; see Variants.                    |

## Capture

Cricket is unbuilt; this is the capture shape its V1 is designed for, not an
as-built description.

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS — a mark is read off
  the dart's number and ring, so the visit total alone cannot express it and
  QUICK_SCORE cannot carry this game.
- **One dart's fact:** intended = **nothing stored** — both the target number
  and the ring are null. A visit has no single required target: any of the seven
  objectives is a legitimate aim, and the player may switch mid-visit, so any
  stored intent would be invented. Hit = whatever landed; `score` = the
  **board** score of that dart (S20 = 20, T20 = 60, outer bull = 25, miss = 0) —
  never the marks it produced and never the Cricket points it scored.
- **Stage type:** one `EXERCISE_BLOCK` for the whole game. No stage opens per
  objective; the objectives are all live at once.
- **Derived, never stored:** marks per objective, which objectives are closed or
  dead, and the point total — all folded from the dart facts against the fixed
  20–15 + bull objective set.

## Open questions

- Exact single-player practice win condition before multiplayer ships.
- Cut-throat win/score rules when that variant is added.
