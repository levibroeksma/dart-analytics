# Golf Darts

Current version: none (V1 in design)
Entry points: standalone
Kernel: VISIT_POINTS

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Multiplayer (2–4 seats) | V1 | 2+ | |
| More than four seats | Deferred | 2+ | Blocked on: a session seats at most four (`app/src/services/session-seats.service.ts:7`); the source allows up to eight |
| Config screen (presets shown) | V1 | All | |
| Nine holes: hole n targets number n | V1 | All | |
| Visit = one hole: one to three darts, stop after any | V1 | All | |
| Counting dart: the last dart thrown decides the hole | V1 | All | |
| Strokes by the counting dart: double 1, treble 2, single 3, other number or bull 4, off the scoring area 5 | V1 | All | |
| Lowest stroke total after nine holes wins | V1 | All | |
| Tie playoff: seats level on the lowest total replay hole 1 until one posts a single lowest count | V1 | 2+ | |
| Sequential tie playoff | V2+ | 2+ | Wanted, unscheduled: the source's second form carries on with hole 10, 11 and so on, and runs out of numbers after 20 (see Open questions); V1 uses the replay form |
| 18-Hole Golf Darts | V2+ | All | Wanted, unscheduled: a longer round is a length V1 locks |
| 20-Hole Golf Darts | V2+ | All | Wanted, unscheduled: a longer round is a length V1 locks |
| Fat and Thin Singles | V2+ | All | Wanted, unscheduled: a scoring switch V1 does not need; V1 gives both single beds 3 strokes |
| Team/Scramble | Deferred | 2+ | Blocked on: a session allows one seat per side; teams are rejected (`app/src/services/session-seats.service.ts:87-88`) |
| First thrower by a throw at the bull | Deferred | 2+ | Blocked on: darts thrown at a target belonging to no leg are a separate capture problem (`501.md` §Features, multiplayer note) |
| Standard dartboard scoring (assumed) | V1 | All | |

## Identity

- A round of golf on the board: hole n is number n, fewer strokes is better,
  and after each dart you choose to bank it or throw again — only the last
  dart counts. Source: dolfdarts.com, "Golf Darts"
  (https://dolfdarts.com/games/golf-darts, scraped copy read 2026-10-12).
- Hole n targets number n, as Baseball Darts (`baseball-darts.md`), but the
  score here is strokes by ring, lower is better, and one dart decides the
  hole.
- Standard dartboard geometry. Strokes, not board scores, rank the seats.

## Tags

| Axis | Tags |
| --- | --- |
| Skill | ACCURACY (primary), DOUBLES |
| Session role | RECREATIONAL |
| Format | ONE_V_ONE, MULTIPLAYER, TEAMS |
| Difficulty | INTERMEDIATE |
| Mechanic | SIMULATION, SEQUENTIAL |
| Pressure | PENALTY |
| Family | NOVELTY |

## Objective

**2+:** finish nine holes with the fewest total strokes. The source needs two
or more players; a session seats at most four.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 2 seats (min 2, max 4) | Editable |
| Holes | 9 | Shown, locked |
| Single beds | Both worth 3 strokes | Shown, locked |
| Tie playoff | Replay hole 1 | Shown, locked |

Seat order is fixed at setup, as 501 (`501.md` §Features); seat 1 throws first
on every hole and the order never changes. A new ruleset allows one seat until
it gets an entry in `SEAT_CAPS`
(`app/src/services/session-seats.service.ts:19`, default of 1 at `:91`), so
V1 multiplayer needs that entry.

## How to play

### Visit

One visit per seat per hole, at that hole's number. Every seat takes its visit
on hole n before any seat starts hole n+1. A seat throws at least one dart and
at most three. After any dart it may stop; it cannot stop before the first.
It may keep throwing even after a double.

### Counting dart

Only the last dart thrown in the visit counts. Earlier darts score nothing;
they only let the seat see how the hole is going. Stopping on a treble banks
2 strokes; throwing again risks 4 or 5 for the chance of 1.

### Strokes

By where the counting dart landed, against the hole's number:

| Counting dart | Strokes |
| --- | --- |
| Double of the hole's number | 1 |
| Treble of the hole's number | 2 |
| Single of the hole's number (either bed) | 3 |
| Any other number | 4 |
| Bull, outer or inner | 4 (see Open questions) |
| Off the scoring area (missed the board, bounced out) | 5 |

Only a dart in the hole's own number scores 1, 2 or 3; a double or treble of a
different number is still "any other number" and scores 4.

### Ends when

Every seat has taken its visit on hole 9, and, if two or more seats are level
on the lowest total, the tie playoff has produced a winner. The playoff repeats
until it does, and nothing else bounds the game.

### Result

Each seat's total strokes and its strokes per hole, lowest total first. The
lowest total wins. **2+:** seats level on the lowest total play the tie
playoff below, and the winner of the playoff wins the game. A seat's playoff
strokes are shown apart from its nine-hole total and do not change it.

### Tie playoff

Only the seats level on the lowest total play it. Each playoff round is one
more visit at **hole 1** (number 1) for every tied seat, in seat order, played
as any hole: one to three darts, the last dart counts, strokes as in the table
above. If exactly one tied seat has the lowest strokes in that round, it wins
the game. Otherwise another round follows with the same tied seats. Seats not
level on the lowest total never play it.

## Later versions

### Variants

- **18-Hole Golf Darts** — holes 1 to 18, a full round. All else the same.
- **20-Hole Golf Darts** — holes 1 to 20, every number once. All else the
  same.
- **Fat and Thin Singles** — the large single bed (outside the treble) is 3
  strokes; the thin single (between treble and bull) is 4.

### Match structure

- **Sequential tie playoff** — the source's second form of the playoff: the
  tied seats carry on with the next number in sequence (hole 10, 11 and so on)
  instead of replaying hole 1. V1 plays the replay form (§How to play).
- **Team/Scramble** — teammates throw the same hole and the team records its
  best single result; the source also mentions per-hole par values for
  handicap play, without giving any.
- More than four seats, once a session can hold them.
- First thrower decided by a throw at the bull, deferred as 501's.

## Capture

Golf Darts is unbuilt; this is the capture shape its V1 is designed for,
taken from Baseball Darts' and Shanghai's.

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS and
  ANALYTICS + VISUAL_BOARD — strokes are read off the counting dart's number
  and ring, and a visit may be shorter than three darts, so QUICK_SCORE visit
  totals cannot carry this game.
- **One dart's fact:** intended = **nothing stored** — double, treble and
  single of the hole's number are all legitimate aims, and the number is
  recoverable from the hole index (`shanghai.md` §Capture). Hit = whatever
  landed, including off the scoring area; `score` = the dart's **board**
  score (S7 = 7, T7 = 21) — never its strokes.
- **Stage type:** one `EXERCISE_BLOCK` per seat for the whole game — stage
  ownership `PER_SEAT`, as Shanghai
  (`app/src/modules/game/shanghai.engine.module.ts:262`). Seats do not touch
  each other's totals. A hole is a turn inside that block, not a stage. A tie
  playoff adds turns to the tied seats' blocks only: a turn from position 10 on
  is a visit at number 1, so the number stays recoverable from the turn's
  position and no new capture fact is needed.
- **Derived, never stored:** each hole's strokes, the running and final
  totals, the ranking and any tie — folded from the dart facts against the
  hole number, taking the last dart of each hole's visit. Which seats are tied,
  each playoff round's lowest count and the winner are folded the same way.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Counting dart** | V1 | The last dart thrown on a hole; the only one scored |
| **Strokes** | V1 | The 1 to 5 a counting dart is worth by ring; lower is better |
| **Tie playoff** | V1 | Seats level on the lowest total replay hole 1 until one posts a single lowest count |
| **Sequential tie playoff** | V2+ | The playoff carried on with hole 10, 11 and so on |
| **18-Hole Golf Darts** | V2+ | Holes 1 to 18 |
| **20-Hole Golf Darts** | V2+ | Holes 1 to 20 |
| **Fat and Thin Singles** | V2+ | Large single 3 strokes, thin single 4 |
| **Team/Scramble** | Deferred | Teammates pool a hole; the team keeps its best result |

## Open questions

- Is a bull (outer or inner) 4 strokes ("any segment … other than the target
  number") or 5 ("missing the scoring area")? Proposed reading: 4 — the bull
  is on the scoring area, and the miss is off it.
- A dart that sticks in the board outside the scoring area (the rim): 5, as a
  miss? The source does not say.
- Tie playoff form: the source allows carrying on in sequence (what happens
  after hole 20?) or replaying hole 1. V1 picks the replay form because it
  never runs out of holes; is that the right pick?
- Tie playoff with three or more tied seats: if two of them share the lowest
  count in a playoff round, V1 keeps every tied seat throwing, since the source
  says only "until one player records a lower score". Should the seats that
  scored higher drop out of later rounds?
- The source says two or more players. Allow a solo round (a plain stroke
  total, no opponent to beat)?
