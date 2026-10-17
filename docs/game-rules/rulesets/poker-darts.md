# Poker Darts

Current version: none (V1 in design)
Entry points: standalone
Kernel: HAND_WRITTEN

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Multiplayer (2–4 seats) | V1 | 2+ | |
| More than four seats | Deferred | 2+ | Blocked on: a session seats at most four (`app/src/services/session-seats.service.ts:7`); the source allows up to six |
| Config screen (presets shown) | V1 | All | |
| Stud Poker Darts: one visit of 3 darts per round, no re-throw | V1 | All | |
| Cards: a dart in a 1–20 segment is that number once (single), twice (double) or three times (treble) | V1 | All | |
| Dead card: a bull or an off-board dart adds nothing | V1 | All | |
| Group: the cards of one number in a hand, with a count | V1 | All | |
| Hand ranking: ten categories, best category taken | V1 | All | |
| Straight and flush judged on the three darts | V1 | All | |
| Tie within a category broken by group numbers | V1 | All | |
| Round won by the best hand: 1 point; equal best hands: draw | V1 | All | |
| Rounds (default 5, 1–20) | V1 | All | |
| Most points wins | V1 | 2+ | |
| Sudden-death: tied seats play extra rounds | V1 | 2+ | |
| Draw Poker Darts | V2+ | 2+ | Wanted, unscheduled: after the first visit a player picks darts to pull and re-throw. That choice is a decision no dart records, so it has no home in the per-dart facts, and a second visit per round changes the round shape V1 locks |
| Chip betting (ante 5 from 20 chips, winner takes the pot) | V2+ | 2+ | Wanted, unscheduled: wagers and a carried pot are state no dart records, and the chip game needs its own elimination and end rule; V1 scores points only |
| Texas Hold'em Darts | V2+ | 2+ | Wanted, unscheduled: a rotating player throws two community darts that count for every seat, so a seat's hand is no longer its own three darts, which V1's ranking and straight/flush rules assume |
| Playing-card board (Specialized Poker Dartboard) | Dropped | All | The app scores a standard dartboard; card-face boards (suits and ranks) are a non-standard board, and suits cannot be derived from a dart on the standard layout |
| First thrower by a throw at the bull | Deferred | 2+ | Blocked on: darts thrown at a target belonging to no leg are a separate capture problem (`501.md` §Features, multiplayer note) |
| Standard dartboard scoring (assumed) | V1 | All | |

## Identity

- Three darts, one poker hand. Each dart in a number collects that number as
  a "card" — a double counts twice, a treble three times — and the seat with
  the best hand takes the round. Source: dolfdarts.com, "Poker Darts"
  (https://dolfdarts.com/games/poker-darts, read 2026-10-12).
- V1 plays the **Stud** format only. Board scores play no part: only which
  number, and which ring, each dart landed in.
- It needs at least two seats and has no single-player mode.

## Tags

| Axis | Tags |
| --- | --- |
| Skill | ACCURACY (primary) |
| Session role | RECREATIONAL |
| Format | ONE_V_ONE, MULTIPLAYER |
| Difficulty | INTERMEDIATE |
| Mechanic | SIMULATION, ACCUMULATION |
| Pressure | NONE |
| Family | NOVELTY |

## Objective

**2+:** win the most rounds. Each round the seat with the best hand scores 1
point; after the last round the most points wins, with sudden-death rounds
between seats tied on points.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 2 seats (min 2, max 4) | Editable |
| Rounds | 5 (min 1, max 20) | Editable |
| Format | Stud (3 darts, no re-throw) | Shown, locked |
| Chips | Off | Shown, locked |

Seat order is fixed at setup, as 501 (`501.md` §Features); seat 1 throws
first in every round. Rounds: the source suggests "a typical session is 5–10
rounds" and leaves the number to the players; the 1–20 range and the default
of 5 are the user decision of 2026-10-12.

## How to play

### Visit

Each round, every seat throws one visit of exactly **three darts**, in seat
order. A visit never ends early. A dart that bounces out counts as off the
board.

### Cards

- A dart in a numbered segment (1–20) gives that number **once** in the
  single, **twice** in the double and **three times** in the treble.
- A dart in either bull, or off the board, is a **dead card**: it adds
  nothing. This is the user decision of 2026-10-12; the source does not say
  what a bull is.
- So three darts can give up to nine cards. Treble 17, double 17 and single
  5 gives 17 five times and 5 once.

### Hands

A hand is judged on the cards of the three darts, and on the three darts
themselves for straights and flushes. Group the cards by number: each number
that appears is a **group** with a count.

- **Straight:** the three darts land on three consecutive numbers (for
  example 6, 7, 8), in any order. All three must be live. There is no
  wrap from 20 to 1, so 19, 20, 1 is not a straight.
- **Flush:** all three darts are live and in the same ring type: all
  singles, all doubles or all trebles.
- **Straight flush:** both at once, such as double 5, double 6, double 7.

These are judged on **darts**, not on the card count: treble 20, treble 19
and treble 18 is three darts on consecutive numbers, all trebles.

A hand takes the best category it qualifies for. From highest to lowest:

1. **Five or more of a kind** — one number with five or more cards. More
   cards beats fewer; equal counts go to the higher number.
2. **Straight flush**
3. **Four of a kind** — one number with exactly four cards.
4. **Full house** — one number with exactly three cards, and a different
   number with two or three cards (3+2 or 3+3).
5. **Flush**
6. **Straight**
7. **Three of a kind** — one number with exactly three cards, and no other
   number with two or more.
8. **Two pair** — two different numbers with two cards each, and no group
   of three or more.
9. **Pair** — one number with exactly two cards, and no group of three or
   more.
10. **High card** — everything else; the hand is its highest number. A hand
    with no live dart ranks below every other hand.

Examples: three trebles on different numbers that are not consecutive are a
full house (3+3) and beat a flush; single 20, single 20, single 20 is a flush
(all singles) and beats the three of a kind it also is; double 5, double 6
and a dead dart is two pair, since a dead dart rules out a flush or
straight.

### Ties within a category

Order each hand's groups from the larger count to the smaller, equal counts
going to the higher number. Compare the hands group by group, on the group's
**number**: the higher main (first) group wins; if equal, the second group;
then the next. A hand that has no group left to compare ranks below one that
does. The exception is the five-or-more category, where the count decides
first, as above. Hands equal on every group are tied.

### Scoring a round

- The seat with the best hand scores **1 point**.
- If the best hand is held by more than one seat with every group equal, the
  round is a **draw**: nobody scores. Seats with worse hands are not
  involved.

### Ends when

All configured rounds have been played and one seat has the most points. If
two or more seats share the most points, those seats play **sudden-death**
rounds, one visit each. The first sudden-death round with a single best hand
wins the game for that seat; a sudden-death round whose best hand is shared
is a draw and is replayed among the same seats. The replay is among every seat
still tied on points: a shared best hand in a sudden-death round never knocks
a seat out, and a seat with a worse hand stays in until a single best hand
wins.

### Result

Winner, points per seat, each round's winning hand (category and groups),
and the number of drawn rounds.

## Later versions

### Variants

- **Draw Poker Darts** — after the first visit a seat may pull one, two or
  all three of its darts and re-throw them; kept darts stay locked, and the
  re-thrown darts replace the pulled values. The source's recommended
  format.
- **Chip betting** — each seat starts with 20 chips and antes 5 per round;
  the round's winner takes the pot, and a drawn round carries the pot to the
  next. The match runs until one seat holds all the chips, or until an
  agreed round count, when the most chips wins. Options the source offers
  instead of points play.
- **Texas Hold'em Darts** — a seat, rotating each round, throws two
  "community" darts that count towards every seat's hand; each seat then
  throws its own darts and builds the best five-card hand.
- **Playing-card board** — a board printed with card faces and suits, ranked
  as card poker including suits. Dropped (see Features).

### Match structure

- More than four seats, once a session can hold them.
- First thrower decided by a throw at the bull; deferred as 501's.

## Capture

Poker Darts is unbuilt; this is the capture shape its V1 is designed for.

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS (a row per dart)
  or ANALYTICS + VISUAL_BOARD. Number and ring decide every card, so
  QUICK_SCORE (visit totals) cannot carry this game. Keypad capture is
  enough: the game needs single, double or treble, never the inner and
  outer single band (`app/src/modules/game/types.ts:390-394`).
- **One dart's fact:** intended = **nothing stored** (free aim); hit = number
  and ring (or bull, or miss) where it landed; `score` = the dart's **board**
  score — never the cards it gave.
- **Stage type:** one shared stage for the game, since a round's result
  compares seats, as 501's `SHARED` leg
  (`app/src/modules/game/five-oh-one.engine.module.ts:428`). A round is the
  visit each seat throws in turn.
- **Derived, never stored:** cards per dart, groups, hand category, each
  round's best hand and winner, drawn rounds, points per seat, sudden-death
  rounds and the winner.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Stud Poker Darts** | V1 | The V1 format: three darts, the hand stands |
| **Dead card** | V1 | A bull or off-board dart; adds nothing to a hand |
| **Group** | V1 | The cards of one number in a hand, with a count |
| **Sudden-death** | V1 | Extra rounds between seats tied on points, until one best hand stands |
| **Draw Poker Darts** | V2+ | Pull and re-throw one to three darts after the first visit |
| **Chip betting** | V2+ | Ante and pot instead of points |
| **Texas Hold'em Darts** | V2+ | Two shared community darts count for every seat |
| **Playing-card board** | Dropped | A card-faced board; not a standard dartboard |

## Open questions

- Sudden-death: the source says "additional sudden-death rounds" without
  saying who throws. Read here as only the seats tied on points, each
  round one visit each. Do all seats throw instead? Likewise the source is
  silent on a sudden-death round whose best hand is shared by only some of
  three or four tied seats: read here as a replay among every seat still
  tied, with no seat knocked out by a shared round (controller ruling).
- Draw: "fully equal → draw" is read here as the **best** hand being shared
  exactly, with nobody scoring; ties between worse hands are ignored. The
  source only says the round is a draw when "hands are completely identical".
- Ties by group number ignore the count (a 3+3 and a 3+2 on the same numbers
  are tied, and a draw if best). Should the higher count break it?
- Hands above five cards: the source says "standard poker rankings typically
  cap at four-of-a-kind" and never says what Five-or-more does. The user
  decision of 2026-10-12 ranks it highest; should a treble 17, treble 17,
  treble 17 (nine 17s) really be rated against a straight flush by count
  alone?
- Straight length: the source's examples show five consecutive numbers and
  three. The user decision of 2026-10-12 reads three darts, three consecutive
  numbers; confirm it still holds if Draw Poker Darts or Hold'em later give a
  seat more than three darts.
