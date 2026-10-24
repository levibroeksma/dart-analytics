# Cricket

Current version: V1 (shipped 2026-10-06)
Entry points: standalone
Game type: `CRICKET`
Kernel: MARKS

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player (practice / vs bot later) | V1 | Single | |
| 1v1 multiplayer (two seats) | V2 | 1v1 | Ruleset version `CRICKET_V2` (2026-10-24), against a guest; solo stays `CRICKET_V1`, which has no `SEAT_CAPS` entry (`app/src/services/session-seats.service.ts:19`), so its cap stays 1 |
| Multiplayer (2+ players) | V2+ | 2+ | Wanted, unscheduled: more than two seats — V2 caps a session at two seats, and the win and dead-number rules are written for one opponent |
| Vs DartBot | V2+ | 1v1 | Blocked on: no DartBot strategy can aim at an objective — `app/src/modules/dartbot/strategy/` holds only dictated, scoring and x01 strategies — so a marks strategy, its level calibration and its tests come first; `RULESET_DARTBOT` has no Cricket entry |
| Config screen (presets shown) | V1 | All | |
| Objectives: 20–15 + bull (Classic Cricket) | V1 | All | |
| Close: 3 marks on a number or the bull | V1 | All | |
| Single = 1 mark, double = 2, treble = 3 | V1 | All | |
| Bull: outer = 1 mark, inner = 2 marks | V1 | All | |
| Own / score on: points on closed-but-opponent-open numbers | V2 | 1v1 | Needs an opponent seat, so it applies only in 1v1; solo has none |
| Excess marks score on a number the opponent has open | V2 | 1v1 | A dart's marks beyond the third score as points while the opponent has not closed the number; V1 discards them because it has no opponent |
| Dead number when all players have closed it | V2 | 1v1 | Needs an opponent seat, as Own / score on |
| Win: all closed + score ≥ opponent(s) | V2 | 1v1 | The first dart that leaves a seat closed out with points at least equal to the opponent's ends the game; solo has no win condition (resolved below) |
| Cut-throat variant | V2+ | 2+ | Wanted, unscheduled: depends on Multiplayer, and its own win and scoring rules are an open question below |
| No-Score Cricket (race to close, points off) | V2+ | 2+ | Wanted, unscheduled: depends on Multiplayer — solo V1 already scores no points, so the variant only differs once a second seat exists; and it is a player-picked setting while `CricketConfig` is an empty strict schema (`app/src/lib/game/rulesets/types.ts:393`) |
| Single-Only Cricket (every dart on an objective = 1 mark) | V2+ | All | Wanted, unscheduled: the marking rule works solo, but its point rule depends on Multiplayer, like Own / score on; and it is a player-picked setting while `CricketConfig` is an empty strict schema (`app/src/lib/game/rulesets/types.ts:393`) |
| Low-Pitch Cricket (objectives 1–6 + bull) | V2+ | All | Wanted, unscheduled: swaps the objective set, and the engine fixes it at 20–15 + bull (`app/src/modules/game/cricket.engine.module.ts:34-43`) and marks nothing on 1–14 (`:47-66`); a solo run needs no Multiplayer (it ends on the V1 close-out rule), but its points rules depend on Multiplayer and Own / score on |
| Random Cricket (6 random numbers from 1–20 + bull) | V2+ | All | Wanted, unscheduled: same engine blocker as Low-Pitch Cricket, plus the app must draw the set once at session start; solo needs no Multiplayer, points rules depend on it |
| Wild Cricket (15–20 + bull + one random Wild number from 1–14) | V2+ | All | Wanted, unscheduled: same engine blocker, and an eighth objective the V1 set has no slot for; solo needs no Multiplayer, points rules depend on it |
| Hidden Cricket (secret targets, Discovery bonus) | V2+ | 2+ | Wanted, unscheduled: depends on Multiplayer (the bonus is a race against opponents; the source describes no solo form), and needs a concealed drawn set plus a reveal rule that V1 has no place for |
| Select-A-Cricket (each player picks own targets) | V2+ | 2+ | Wanted, unscheduled: depends on Multiplayer and Own / score on (the variant is about targets one player has and another lacks), and needs one objective set per seat; one seat per side only (`app/src/services/session-seats.service.ts:7`, `:87-88`) |
| Reverse Cricket (ascending order 15 to bull, lowest score wins) | V2+ | 2+ | Wanted, unscheduled: depends on Multiplayer and on the Cut-throat variant row (its points go to opponents; Cut-throat's own scoring and win rules are an open question below), and adds ordered closing, which V1 does not have |
| All Numbers Cricket (1–20 + bull) | V2+ | All | Wanted, unscheduled: an objective-set switch on the Classic rules; V1 needs only the one fixed set, and a solo close-out drill over 21 objectives is valid without Multiplayer |
| Spanish Cricket (11–20 + bull) | V2+ | All | Wanted, unscheduled: an objective-set switch (eleven objectives); V1 needs only the one fixed set, and the solo close-out drill carries over unchanged |
| Double-Only Cricket (only doubles mark) | V2+ | All | Wanted, unscheduled: a marking-rule switch; V1 needs only the single/double/treble mark values, and the solo close-out drill carries over unchanged |
| Double-Only Cricket tiebreak leg | Deferred | 2+ | Blocked on: the source leaves a simultaneous close-out to "a draw or an additional tiebreak leg agreed before the match", a judgement made by the players; the outcome is an open question |
| Killer Cricket (mark-stripping) | V2+ | 2+ | Wanted, unscheduled: depends on Multiplayer — there is no opponent to strip marks from with one seat — and its allocation, elimination and win rules are open questions below |
| No Doubles/Triples categories (see Tactics) | Dropped | All | Not a feature of this ruleset: Classic Cricket has no Doubles/Triples objectives by definition, and the UK variant that adds them is its own ruleset, `tactics.md` |
| Visit = up to 3 darts | V1 | All | |
| Cricket statistics section (MPR, darts-to-close trend) | V2+ | All | Wanted, unscheduled: needs a `v_cricket_*` view and so a new migration; V1 ships the board heatmap only |
| Standard dartboard scoring (assumed) | V1 | All | |

## Identity

Standard (American) **Cricket**: close **20–15** and the **bull**, and score points on numbers you own that opponents have not closed yet. Standard dartboard scoring is assumed. For the UK variant that also closes **Doubles** and **Triples** as separate objectives, see `tactics.md`.

## Tags

| Axis | Tags |
| --- | --- |
| Skill | SCORING (primary), BULL |
| Session role | CORE |
| Format | SOLO, ONE_V_ONE, MULTIPLAYER |
| Difficulty | ADVANCED |
| Mechanic | TERRITORIAL |
| Pressure | NONE |
| Family | STANDARD |

## Objective

- **Close** all seven objectives: **20, 19, 18, 17, 16, 15, Bull**.
- Hold a **point total ≥ every opponent** when you finish closing.
- **Session (V1):** one game under these rules (multiplayer is the natural form; single-player may be practice-only until opponents/bots exist).

## Config & presets

Before play, a **config screen** shows the session presets.

| Setting    | V1 preset                                                   | On config screen (V1) |
| ---------- | ----------------------------------------------------------- | --------------------- |
| Players    | 1 seat, solo practice; V2 adds a second seat (1v1)          | Shown, chosen by seat |
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

**Single:** there is no opponent, so spare marks are discarded as in V1.

### Points

Once you have **closed** a number and an opponent has **not**, further hits on that number score **points** equal to the segment value. When **all** players have closed a number, it is **dead** — no more points there.

**1v1:** points on a number are the marks beyond the third times the number's value (the bull is worth 25 a mark), scored while the opponent has not closed it. A dart that closes a number with marks to spare scores those spare marks the same way. Solo has no opponent, so nothing scores.

### Finishing

First player to close **all** objectives with a score **≥** every opponent wins. If you are fully closed but behind on points, keep scoring on numbers opponents have not closed until you catch up or they close out ahead.

**1v1:** the game ends on the first dart that leaves the throwing seat with all seven objectives closed and points at least equal to the opponent's, mid-visit if need be. It cannot end level: a closed-out seat that is behind keeps throwing, and the opponent can no longer score on any number that seat has closed, so the first seat to be closed out and level or ahead wins at that dart.

### Bust

N/A in the X01 sense.

### Ends when

**Single:** all seven objectives — 20, 19, 18, 17, 16, 15 and the bull — are
closed. Nothing else bounds a run: no clock, no visit budget. A solo run has no
win condition; it reports darts, MPR and darts to close (resolved below).

**1v1:** the session instead ends when one seat is closed out with a point
total at least equal to its opponent's (see Finishing). The winner is that
seat; there is no tie.

With more than two seats (V2+) the session ends when one player is closed out
with a point total at least equal to every opponent's.

### Result

Darts thrown, and per objective the marks it took to close.

**1v1:** each seat's points and darts, and the winner.

## Later versions

### Variants

- **Excess marks** (V2, 1v1) — marks beyond the third on a number the opponent
  has not closed score as points: a treble 20 on a number with two marks closes
  it and scores 40.
- **Vs DartBot** (V2+, 1v1) — a DartBot seat as the opponent; blocked on a marks
  strategy (see Features).
- **Cut-throat:** scoring hits add points to opponents who have not closed that number; lowest score wins among those who have closed everything (house rules vary — lock details when shipping)
- Team / more than two players
- **No-Score Cricket:** Classic marks (single 1, double 2, treble 3; outer bull 1, inner bull 2), but no points exist at all, so there is no Own / score on, no Dead and no point total. Extra marks past the third are discarded, and a dart on an already closed number or on a non-objective does nothing. **2+:** the first player to close all seven objectives wins at once, even mid-visit — the rest of that visit is not thrown. Seats alternate, so two players cannot finish together and no tiebreak is needed. Solo play is identical to V1.
- **Single-Only Cricket:** every dart on an objective is exactly **one** mark whatever its ring, and the inner and outer bull are one mark each, so closing always takes three darts and a dart never closes more than one number or spills into points. Once you have closed a number, each further dart on it scores that number's face value only — a double or treble 20 scores 20, never 40 or 60; outer bull scores 25 and inner bull 50 — while at least one opponent has it open. **2+:** a number all players have closed is Dead; you win by closing all seven with a point total at least equal to every opponent's, and if you are closed out but behind you keep scoring on numbers opponents have open. **Single:** solo play only needs the marking rule, with no points and the same end as V1.
- **Low-Pitch Cricket (V2+):** objectives are 1, 2, 3, 4, 5, 6 and the bull instead of 20–15 and the bull. Marks, closing and the bull's 25 / 50 are unchanged. A numbered dart tops out at 18 (treble 6) while the bull keeps 50, so the bull dominates the points. **Single:** a solo run ends on the V1 rule, all objectives closed.
- **Random Cricket (V2+):** six numbers drawn at random from 1–20, plus the bull always, replace 20–15. The app draws the set once at session start; the config snapshot would carry it, so a replay never re-draws. Everything else is classic. **Single:** a solo run ends on the V1 rule.
- **Wild Cricket (V2+):** classic 20–15 and the bull, plus one **Wild number** drawn at random from 1–14, so eight objectives. Every player shares the Wild number and it marks, closes and scores like any other number, however low. **Single:** a solo run ends on the V1 rule.
- **Hidden Cricket (V2+):** the app draws six target numbers and keeps them concealed; the bull is always visible, so there are seven objectives. A dart on a concealed target reveals it to everyone; darts on any other number do nothing. The first player to reveal a number gets a **Discovery bonus**: one extra mark on it, on top of the marks the dart itself earned. The bonus is a mark only, never points. **2+:** the bonus is a race, so it needs opponents. Winning is classic (all closed, score ≥ every opponent).
- **Select-A-Cricket (V2+):** before play each player picks their own seven targets (the bull is normally one). A player only marks and scores on their own list. A number is dead once every player who lists it has closed it. **2+:** the variant exists for targets one seat has and another lacks. Winning is classic over the player's own list.
- **Reverse Cricket (V2+):** cut-throat scoring (hits on a number you closed add their value to each opponent who has not closed it; lowest total wins) plus ordered closing. Each player works 15, 16, 17, 18, 19, 20, bull in that order; only the current target takes marks. Leftover marks on the closing dart count as points against open opponents. A player wins by closing all seven with a total ≤ every opponent's. **2+:** the points go to opponents. Cut-throat with free order is the existing Cut-throat row, not this one.
- **All Numbers Cricket (1–20 + bull):** the objective set is every number 1–20 plus the bull, 21 in all, closed in any order. Marks, points, dead numbers and the win condition (all closed and points ≥ every opponent) are as Classic. If several players finish closing on the same visit, the higher point total wins; if those tie, the player whose closing dart came first wins. Cut-throat, no-score, ordered-groups and round-limited forms exist in the source and stay unscheduled.
- **Spanish Cricket (11–20 + bull):** as All Numbers Cricket but the objective set is 11–20 plus the bull, eleven in all. A 10–20 + bull extension (twelve objectives) is a further setting of the same switch.
- **Double-Only Cricket (only doubles mark):** only the double ring marks. Each double on an objective is **1 mark**, three close it; the inner bull is the double bull and is **1 mark**; singles, trebles and the outer bull neither mark nor score. Once you have closed an objective an opponent has not, each further double on it scores its double value (D20 = 40, inner bull = 50). Objectives are 20–15 + bull; dead numbers and the win condition are as Classic.
- **Double-Only Cricket tiebreak leg:** when several players close out on the
  same visit with equal points, an extra leg played by agreement before the
  match. Deferred (see Features); the agreement is not derived.
- **Killer Cricket (mark-stripping):** objectives, mark values and closing are as Classic, but there are **no points**. Once you have closed an objective, each further mark you throw on it (1 for a single, 2 for a double, 3 for a treble) strips that many marks from opponents' tallies on that objective, floored at zero, and a stripped player must re-earn all three to close again. A player whose marks on all seven objectives are zero is eliminated and skipped from then on; the last player left wins. The source also allows first-to-close-all-seven while no opponent has — agreed before play. Not the same game as the Killer Cricket row in `killer.md` (see Open questions).

### Match structure

- First to N games / best of N

### Other

- Vs DartBot (V2+; see Features) / guest (V2, 1v1)
- Cross-link / optional switch to **Tactics** (adds Doubles + Triples objectives)

## Glossary

| Term                | Version | Meaning                                                       |
| ------------------- | ------- | ------------------------------------------------------------- |
| **Close**           | V1      | Reach three marks on an objective.                            |
| **Own / score on**  | V2      | Closed by you, not yet by opponent → further hits add points. |
| **Dead**            | V2      | Closed by all players → no further scoring.                   |
| **Classic Cricket** | V1      | 20–15 + bull only (no separate D/T categories).               |
| **Excess marks**    | V2      | Marks beyond the third on a number; they score while the opponent has it open. |
| **Vs DartBot**      | V2+     | A DartBot opponent; needs a marks strategy first.             |
| **Cut-throat**      | V2+     | Alternate scoring/win logic; see Variants.                    |
| **No-Score Cricket** | V2+ | Race to close all seven objectives with no points; see Variants. |
| **Single-Only Cricket** | V2+ | Every dart on an objective is one mark, whatever its ring; see Variants. |
| **Low-Pitch Cricket** | V2+   | Objectives 1–6 + bull instead of 20–15 + bull.                |
| **Random Cricket**  | V2+     | Six numbers drawn at random from 1–20 + bull replace 20–15.   |
| **Wild Cricket**    | V2+     | Classic objectives plus one random Wild number from 1–14.     |
| **Wild number**     | V2+     | The extra objective drawn from 1–14 in Wild Cricket.          |
| **Hidden Cricket**  | V2+     | Drawn targets stay concealed until a dart hits them.          |
| **Discovery bonus** | V2+     | One extra mark to the first player to reveal a hidden target. |
| **Select-A-Cricket** | V2+    | Each player picks their own seven targets.                    |
| **Reverse Cricket** | V2+     | Cut-throat points, targets closed in order 15 to bull.        |
| **All Numbers Cricket** | V2+ | Objective set 1–20 + bull (21); see Variants. |
| **Spanish Cricket** | V2+ | Objective set 11–20 + bull (11); see Variants. |
| **Double-Only Cricket** | V2+ | Only doubles mark: 1 mark per double, inner bull 1 mark; see Variants. |
| **Double-Only Cricket tiebreak leg** | Deferred | An extra leg agreed before the match when a simultaneous close-out ties on points. |
| **Killer Cricket (mark-stripping)** | V2+ | Marks past closing strip opponents' marks; no points; elimination. Not `killer.md`'s Killer Cricket. |

## Capture

This is the capture shape V1 ships with (engine:
`app/src/modules/game/cricket.engine.module.ts`, ruleset key `CRICKET_V1`).

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS or ANALYTICS + VISUAL_BOARD — a mark is read off
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
- **1v1 (V2):** no new stored fact and no schema change. Points, dead numbers and the winner are folded from the dart facts of both seats read in log order, because a dart's points depend on the opponent's marks at that moment; `score` stays the dart's board score. A V1 log still folds as it did.
- **Variant objective sets (V2+):** dart facts, the "nothing stored" intent and the single `EXERCISE_BLOCK` stage are unchanged. The objective set is a fixed constant today (`app/src/modules/game/cricket.engine.module.ts:34-43`), so each variant needs it to come from the session's config snapshot, which would carry the drawn set (Random, Wild, Hidden) or one set per seat (Select-A). A draw is a fact recorded once, never re-drawn on read. Which Hidden numbers are revealed, who earned the Discovery bonus (first dart on that number), and Reverse's per-seat current target are all derived from the dart facts and that set, never stored.

V2+ variants and capture (design intent only):

- **All Numbers / Spanish Cricket:** no change to what a dart is. The objective
  set becomes configuration the fold reads — the config snapshot would carry
  it — instead of the fixed 20–15 + bull set. Nothing about the intended-target
  rule changes: any live number is a legitimate aim, so still nothing stored.
- **Double-Only Cricket:** no change to the stored fact. The ring is already on
  the dart, and a double yielding 1 mark rather than 2, and a single or treble
  yielding none, is a different fold of the same facts.
- **Killer Cricket (mark-stripping):** marks can fall, so a tally is the fold of
  marks gained minus marks stripped by other players' darts, across all
  players' turns. With three or more players, which opponent a stripping mark
  lands on is a player choice a dart fact cannot express; see Open questions.
  In 1v1 there is one opponent, so a stripping mark always lands on them and
  the allocation is derivable; only three or more seats need a recorded
  allocation fact.

## Open questions

- ~~Exact single-player practice win condition before multiplayer ships.~~
  **Resolved:** none — solo V1 is a close-out efficiency drill; a run ends
  when all seven objectives are closed and reports darts thrown, MPR and
  darts to close per objective (D421).
- Cut-throat win/score rules when that variant is added.
- Whether Single-Only marking combines with Cut-throat (dolfdarts lists a Single-Only Cut-Throat Cricket) and whether one game may give each player a different marking rule as a handicap.
- Low-Pitch Cricket: the source says marks beyond the third never score points on the closing dart, but How to play above lets leftover marks spill into points. Which rule governs the variant?
- Random Cricket: whether the six numbers must be distinct (source does not say; reading: distinct). Whether match play redraws per leg (source says yes) waits on Match structure.
- Wild Cricket: source allows "one or more" Wild numbers; this file takes one. dolfdarts' Random Cricket page also uses "Wild Cricket" for a different game (each player gets their own random set); this file follows the wild-cricket page.
- Hidden Cricket: whether the Discovery bonus mark can itself spill into points (source says a discovered treble yields 4 marks with "the extra mark potentially scoring points", yet says the bonus never awards points). How a shared screen keeps targets concealed. The source's Individual-Reveal form (reveal only to the hitter) is not recorded.
- Select-A-Cricket: source says a number only one player lists can be scored on "indefinitely", yet also says a number closes once every player who lists it has closed it, which would make it dead the moment its only holder closes it. Which governs? Whether the bull is mandatory (source: "typically").
- Reverse Cricket: source says hits on numbers a player already closed "do not count", yet also that further hits on a closed number add points to open opponents; this file reads the first as marks only. Whether leftover marks on a closing dart carry on to the next number in order (source: they become points).
- Low-Pitch, Random and Wild Cricket: each source page seats 2–4 players. The `All` applicability (a solo run ending on the V1 close-out rule) is this file's reading, not the source's; confirm before scheduling.
- Name clash: `killer.md` already has a different **Killer Cricket** row
  (close your own number to become a Killer). The mark-stripping Cricket variant
  is called Killer Cricket on dolfdarts, so this file uses the Glossary term
  **Killer Cricket (mark-stripping)**. Whether either gets a distinct product
  name is undecided.
- Killer Cricket (mark-stripping), with two or more opponents: stripping marks
  go to one or more opponents at the thrower's choice (the source says
  "may"), so that allocation is not derivable from dart facts. It needs a
  recorded choice per stripping dart, or a fixed rule (for example, the
  leader). Not decided; blocks the state shape for three or more seats only —
  in 1v1 the sole opponent takes every stripping mark.
- Killer Cricket (mark-stripping): elimination is "all seven objectives at
  zero", but every player starts there. The source does not say whether a
  player must first have held a mark, or whether elimination is checked
  mid-visit or at visit end.
- Killer Cricket (mark-stripping): the source's tips imply a closing dart's
  surplus marks strip at once (a treble that closes also attacks); the rules
  text does not say so. The two win conditions (last player left, or first to
  close all seven with no opponent closed out) are per-game choices; whether
  that is a setting is undecided.
- Double-Only Cricket: if several players close out on the same visit and are
  tied on points, the source leaves it to "a draw or an additional tiebreak leg
  agreed before the match". Not decided.
- All Numbers Cricket allows teams of two, up to 8 players; the repo seats at
  most 4, one seat per side, with teams rejected
  (`app/src/services/session-seats.service.ts:7`, `:87-88`). Teams are already
  listed under Variants as Team / more than two players.
