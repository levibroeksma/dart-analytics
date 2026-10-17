# Snooker Darts

Current version: none (V1 in design)
Entry points: standalone
Kernel: HAND_WRITTEN

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Two seats, head to head | V1 | 1v1 | |
| Config screen (presets shown) | V1 | All | |
| Reds: segments 1–15, each potted once | V1 | All | |
| Colours: 16–20 and the bull, worth 2–7 | V1 | All | |
| Break: pots in a row, one dart per attempt | V1 | All | |
| Red then called colour, alternating | V1 | All | |
| Called colour: announced before the dart, respotted when potted | V1 | All | |
| Foul: a miss pays the opponent the higher of 4 or the ball's value | V1 | 1v1 | |
| Final colours: 16 to bull in order, each removed once potted | V1 | All | |
| Frame ends when the black is potted; higher total wins | V1 | 1v1 | |
| Equal totals reported as a tie | V1 | 1v1 | |
| Standard dartboard scoring (assumed) | V1 | All | |
| Tiebreak: respot the black, one dart each at the bull | Deferred | 1v1 | Blocked on: "lands closer" needs a measured judgement the app cannot make from a dart's segment; V1 reports a tie |
| First thrower by a throw at the bull | Deferred | 1v1 | Blocked on: darts thrown at a target belonging to no leg are a separate capture problem (`501.md` §Features, multiplayer note); V1 seat 1 throws first |
| Match play (best of 3 or 5 frames) | V2+ | 1v1 | Wanted, unscheduled: needs a series above a single frame; V1 is one frame |
| Simplified Snooker | V2+ | 1v1 | Wanted, unscheduled: no colour call, which leaves a missed colour's foul value undefined; V1 requires the call |
| Short-Frame Snooker | V2+ | 1v1 | Wanted, unscheduled: reds are 1–6 only; a configuration V1 locks |
| Speed Snooker | Deferred | 1v1 | Blocked on: a per-throw timer and a foul for running it out; the app has no throw clock for a seat |
| Doubles and Trebles Count | V2+ | 1v1 | Wanted, unscheduled: a double or treble pots two or three reds in one dart, and the colour attempts that follow are undefined in the source |

## Identity

- A frame of snooker on a dartboard: pot a red, call a colour, pot it, repeat,
  then clear the colours in order; the higher total wins. Also known as Darts
  Snooker. Source: dolfdarts.com, "Snooker Darts"
  (https://dolfdarts.com/games/snooker-darts, read 2026-10-12).
- Standard dartboard scoring is assumed for where a dart lands, but the game
  counts **snooker points**, not board points.

## Tags

| Axis | Tags |
| --- | --- |
| Skill | ACCURACY (primary), SWITCHING |
| Session role | RECREATIONAL |
| Format | ONE_V_ONE |
| Difficulty | INTERMEDIATE |
| Mechanic | SIMULATION |
| Pressure | PENALTY |
| Family | NOVELTY |

## Objective

**1v1:** finish the frame with more points than the opponent. A seat can win
with fewer pots if the opponent's fouls outweigh them.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 2 seats (head to head) | Shown, locked |
| Reds | Segments 1–15, 15 reds | Shown, locked |
| Colours | 16 = 2, 17 = 3, 18 = 4, 19 = 5, 20 = 6, bull = 7 | Shown, locked |
| Colour call | Required | Shown, locked |
| Frames | 1 | Shown, locked |
| First thrower | Seat 1 | Shown, locked |

Seat order is fixed at setup, as 501 (`501.md` §Features); seat 1 throws first.

A new ruleset allows one seat until it is added to the seat caps
(`app/src/services/session-seats.service.ts:7` sets the maximum; the cap lookup
defaults an unlisted ruleset to 1 at line 91), so the two-seat game is a
requirement on that file, not something it does today.

## How to play

### Balls

- **Reds:** segments 1–15. A dart in any ring (single, double, treble) of an
  unpotted red segment pots that red: 1 point, and that segment is out for the
  rest of the frame.
- **Colours:** 16 = 2 points, 17 = 3, 18 = 4, 19 = 5, 20 = 6, and the bull
  (inner or outer) = 7. A dart in any ring of a colour's segment pots it.

### Turn and break

One dart at a time. A seat keeps the table for as long as it keeps potting;
this run is its **break**. There is no three-dart visit.

1. **Red:** the seat must aim at any unpotted red. Pot it for 1 point, then:
2. **Colour:** the seat **calls** one colour (16, 17, 18, 19, 20 or bull)
   before the dart. Pot the called colour for its value. The colour is
   **respotted**: it stays available. The break goes back to
   step 1.
3. **Miss:** any other result ends the break and is a foul (below). The
   opponent takes the table.

A dart at a potted red's segment, at a colour while a red is needed, at a
colour other than the called one, or off the scoring area, is a miss.

### Foul

A miss pays the opponent the higher of 4 points or the value of the ball the
dart was aimed at: a missed red or a missed yellow, green or brown costs 4; a
missed blue costs 5, pink 6, black 7. The points go straight onto the
opponent's total. The opponent then takes the table and starts at step 1 (a
red), or in the final colours, at the colour just missed.

### Last red

The colour after the 15th red is still called and potted as in step 2. A
miss there is a foul as usual. Either way, the final colours follow.

### Final colours

Once all 15 reds are gone and the colour after the last red has been played,
the six colours are potted in order: yellow (16), green (17), brown (18),
blue (19), pink (20), black (bull). Each is removed when potted; none is
respotted. The source states a call only after a red, and the target here is
fixed; V1 reads no call as needed (see Open questions).

- A seat that pots the target colour keeps the table and aims at the next.
- A miss is a foul (as above); the opponent takes the table and aims at the
  same colour.
- Black is the last ball: a miss on it pays 7 and passes the table, until a
  seat pots it.

### Ends when

The black is potted in the final colours. The frame ends at once.

### Result

Winner (the higher snooker total) beside both totals, or a tie when totals
are equal. Per seat: reds potted, colours potted, fouls conceded, and the
highest break (snooker points).

**1v1:** the frame is between two seats; there is no solo result.

## Later versions

### Variants

- **Simplified Snooker** — no colour call: after a red the seat aims at any
  colour. Faster, with fewer disputes. The foul for a miss would then need a
  rule, since there is no called ball.
- **Short-Frame Snooker** — only segments 1–6 are reds (six reds); everything
  else is unchanged.
- **Speed Snooker** — a strict time limit per throw (e.g. 10 or 15 seconds);
  running out is a foul that pays the opponent the minimum 4 points.
- **Doubles and Trebles Count** — a double or treble of a red pots two or
  three reds with one dart, and the seat then attempts a colour for each.

### Match structure

- **Match play** — best of 3 or 5 frames, agreed beforehand.
- **Tiebreak** — on equal totals the black is respotted and each seat throws
  one dart at the bull; the one who hits it, or lands closer, wins the frame.
- **First thrower by a throw at the bull** — one dart each; the closest throws
  first. Deferred as 501's.

## Capture

Snooker Darts is unbuilt; this is the capture shape its V1 is designed for.

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS or
  ANALYTICS + VISUAL_BOARD — a pot is read off the dart's number, and the
  break rule is per dart, so a visit total cannot express it and QUICK_SCORE
  cannot carry this game.
- **One dart's fact:** a red attempt has **nothing stored** as intended, since
  any unpotted red is a legitimate aim. A colour attempt records the called
  colour's number as the dart's intended target, because a missed dart cannot
  say what was called and the foul depends on it. No ring is stored with it,
  since any ring pots the colour, so a target number would sit with no intended
  zone — and `chk_dart_target_consistency`
  (`database/migrations/0007_constraints.sql:86-92`) rejects a dart that has a
  target number but no zone. As written, this capture cannot be stored today
  (see Open questions, **Blocked**). Hit = number and ring where it landed. `score` = the dart's **board** score (S16 = 16, T20 = 60, outer
  bull = 25, miss = 0), never the snooker points.
- **Stage type:** one shared stage for the frame — a miss changes the
  opponent's total, and the reds are one pool for both seats — as 501's
  `SHARED` leg (`app/src/modules/game/five-oh-one.engine.module.ts:428`).
  The config snapshot would carry the colour values and the red set.
- **Derived, never stored:** snooker points per seat, reds left, the colours
  left, the current phase, whose table it is, break length, the winner.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Break** | V1 | A seat's run of pots without a miss |
| **Called colour** | V1 | The colour announced before the dart after a red; once potted it is respotted: it stays available until the final colours |
| **Foul** | V1 | A miss; pays the opponent the higher of 4 or the ball's value |
| **Final colours** | V1 | Yellow to black in order once the reds are gone; none respotted |
| **Match play** | V2+ | A series of frames |
| **Simplified Snooker** | V2+ | No colour call |
| **Short-Frame Snooker** | V2+ | Six reds, segments 1–6 |
| **Speed Snooker** | Deferred | A timed throw; running out is a 4-point foul |
| **Doubles and Trebles Count** | V2+ | A double or treble pots two or three reds in one dart |
| **Tiebreak** | Deferred | Respotted black, closest to the bull wins |

## Open questions

- Which rings count for a colour? The source says any ring of a red counts and
  the bull's inner or outer counts; it is silent on colours 16–20. V1 reads
  every ring as a pot, as for reds.
- Is a dart off the board, or one that bounces out, a miss and a foul? The
  source calls a miss a dart "in a segment other than the one you need". V1
  reads it as a miss.
- Does a seat that pots a colour in the final colours keep the table? The
  source only says a miss passes it. V1 keeps the break going.
- What is a turn? The source says one dart at a time but keeps the table
  while potting. V1 reads a turn as a break, ending only on a miss.
- Colour after the last red: if it is missed, the opponent starts the final
  colours at yellow, as V1 reads it. Confirm.
- **Blocked (V1 capture):** the called colour must be recorded, because a
  missed colour's foul (4, 5, 6 or 7) depends on it. The only place for it is
  the dart's intended target number, and a target number with no intended zone
  is rejected by `chk_dart_target_consistency`
  (`database/migrations/0007_constraints.sql:86-92`). Needs a decision before
  V1 capture can be specified: a called-colour fact stored another way, or the
  constraint relaxed for this case. Same blocker as Singles Training's (see
  `singles-training.md` §Open questions). A UI to record the call is also
  needed.
- Is a call needed in the final colours? The source states a call only after a
  red ("After potting a red, you must nominate (call) your colour") and says the
  six colours "must now be potted in ascending order", so the target is fixed
  and the foul value follows from it. V1 reads the source literally: no call in
  the final colours. The source never says so outright.
- Tiebreak: "lands closer" is a measured judgement. Deferred; V1 ties.
