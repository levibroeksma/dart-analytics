# Cricket

## Features

Use this table to declare what ships when. Edit the **Version** column (`V1`, `V2+`, `Deferred`, etc.).

| Feature                                     | Version |
| ------------------------------------------- | ------- |
| Single player (practice / vs bot later)     | v1      |
| Multiplayer (2+ players)                    | TBD     |
| Config screen (presets shown)               | v1      |
| Objectives: 20–15 + bull                    | v1      |
| 3 marks to close a number / bull            | v1      |
| Single = 1 mark, double = 2, treble = 3     | v1      |
| Bull: outer = 1 mark, inner = 2 marks       | v1      |
| Points on closed-but-opponent-open numbers  | v1      |
| Dead number when all players have closed it | v1      |
| Win: all closed + score ≥ opponent(s)       | v1      |
| Cut-throat variant                          | TBD     |
| No Doubles/Triples categories (see Tactics) | TBD     |
| Visit = up to 3 darts                       | v1      |
| Standard dartboard scoring (assumed)        | v1      |

## Identity

Standard (American) **Cricket**: close **20–15** and the **bull**, and score points on numbers you own that opponents have not closed yet. Standard dartboard scoring is assumed. For the UK variant that also closes **Doubles** and **Triples** as separate objectives, see `tactics.md`.

## Objective

- **Close** all seven objectives: **20, 19, 18, 17, 16, 15, Bull**.
- Hold a **point total ≥ every opponent** when you finish closing.
- **Session (V1):** one game under these rules (multiplayer is the natural form; single-player may be practice-only until opponents/bots exist).

## Config & presets (V1)

Before play, a **config screen** shows the session presets.

| Setting    | V1 preset                                                   | On config screen (V1) |
| ---------- | ----------------------------------------------------------- | --------------------- |
| Players    | 2 (when multiplayer available); else single-player practice | Shown, locked         |
| Objectives | 20–15 + Bull                                                | Shown, locked         |
| Variant    | Classic (highest score wins with all closed)                | Shown, locked         |

## How to play (V1)

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

## Later versions (V2+)

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

## Open questions

- Exact single-player practice win condition before multiplayer ships.
- Cut-throat win/score rules when that variant is added.
