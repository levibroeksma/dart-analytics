# Blackjack Darts

Current version: none (V1 in design)
Entry points: standalone

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Multiplayer (2–4 seats) | V1 | 2+ | |
| More than four seats | Deferred | 2+ | Blocked on: a session seats at most four (`app/src/services/session-seats.service.ts:7`); the source allows up to eight |
| Config screen (presets shown) | V1 | All | |
| One round: every seat throws one visit | V1 | All | |
| Visit = up to 3 darts | V1 | All | |
| Stick: stop after any dart and keep the total | V1 | All | |
| Round total: the sum of the visit's board scores | V1 | All | |
| Bust: a total above 21 scores zero and ends the visit | V1 | All | |
| Blackjack: exactly 21 within two darts | V1 | All | |
| Ranking: Blackjack, then 21, then higher totals, then a bust | V1 | All | |
| Win: the best-ranked seat | V1 | All | |
| Draw: the best rank and total is shared, so nobody wins | V1 | All | |
| Multi-round: most rounds won | V2+ | 2+ | Wanted, unscheduled: a single round is playable without it; a series adds a round count and a round-wins result |
| Cumulative Blackjack | V2+ | 2+ | Wanted, unscheduled: a second multi-round result — highest total after a set number of rounds — V1 does not need |
| Rotating throwing order | V2+ | 2+ | Wanted, unscheduled: only meaningful once there is more than one round |
| First thrower by a throw at the bull | Deferred | 2+ | Blocked on: darts thrown at a target belonging to no leg are a separate capture problem (`501.md` §Features, multiplayer note) |
| Casino Blackjack | V2+ | 2+ | Wanted, unscheduled: needs a casino-style board of card segments, Ace as 1 or 11 and a suit rule, none of which V1's standard board has |
| Skilled Casino Blackjack | V2+ | 2+ | Wanted, unscheduled: depends on Casino Blackjack |
| Standard dartboard scoring (assumed) | V1 | All | |

## Identity

- Build a round total toward exactly 21 in up to three darts, stop whenever
  you like, and go over and you score nothing. Reach 21 in two darts for a
  Blackjack, which beats any other 21. Source: dolfdarts.com, "Blackjack
  Darts" (https://dolfdarts.com/games/blackjack-darts, read 2026-10-12).
  Also played as "21 Darts" and "Twenty-One": the same game.
- Standard dartboard scoring: single, double and treble face values; outer
  bull 25; inner bull 50.
- Multiplayer only: the best result wins, so a round needs a rival.

## Objective

**2+:** finish the round with the best-ranked result. In V1 the game is one
round.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 2 seats (min 2, max 4) | Editable |
| Target | 21 | Shown, locked |
| Rounds | 1 | Shown, locked |

Seat order is fixed at setup, as 501 (`501.md` §Features); seat 1 throws
first. The last seat to throw sees every other result before it decides when
to stick; a single round gives no way to even that out (rotating order is
V2+).

## How to play

### Visit

Each seat throws one **visit** per round, in seat order. A visit is up to
three darts. After each dart the thrower adds its board score to the visit's
running total and may **stick**: stop throwing and keep that total. A visit
has at least one dart. It ends at the first of: the thrower sticks, the
total goes over 21, or three darts have been thrown. A miss scores 0 and
leaves the total as it was.

### Bust

A running total above 21, at any dart, is a **bust**: the visit scores
zero and ends at once. Darts not yet thrown are forfeited.

### Blackjack

A visit that totals exactly 21 within its first two darts is a
**Blackjack**. A one-dart 21 (treble 7) is a Blackjack too. A visit that
totals exactly 21 after using three darts is a plain **21**, even if two
darts had already made it.

### Ranking

From best to worst:

1. Blackjack.
2. Plain 21.
3. A total from 20 down to 0, higher beating lower. A total of 0 from
   three misses ranks here, above a bust.
4. Bust.

Two visits with the same total and the same rank tie; two Blackjacks tie.

### Ends when

Every seat has thrown its visit. The round, and in V1 the game, is over.

### Result

The seat with the best-ranked visit wins. If two or more seats share the best
rank and total, no seat wins and the round is a **draw** (this includes every
seat busting). Shown beside the outcome: each seat's total, rank (Blackjack,
21, total or bust) and darts thrown.

## Later versions

### Variants

- **Casino Blackjack** — played on a casino-style board whose segments are
  playing cards. An Ace counts 1 or 11, Jack, Queen and King count 10, other
  cards their face value. A true Blackjack is an Ace plus a ten-value card in
  the first two darts and beats any other 21. Scoring cards must be of
  different suits; two of the same suit void one of them.
- **Skilled Casino Blackjack** — Casino Blackjack where only double and
  treble segments score, and a Blackjack needs two trebles in the first two
  darts.

### Match structure

- **Multi-round: most rounds won** — a round is judged as in V1; the overall
  winner is the seat with the most rounds won over an agreed number (the
  source gives best of 5 or 7 as examples). A drawn round is won by nobody.
- **Cumulative Blackjack** — round totals are added across a set number of
  rounds; the highest cumulative total wins. A bust adds zero.
- **Rotating throwing order** — the seat order shifts each round so no seat
  always throws last.
- The source decides the first thrower by a throw at the bull; deferred, as
  501's.
- More than four seats (the source allows up to eight).

## Capture

Blackjack Darts is unbuilt; this is the capture shape its V1 is designed for.

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS or ANALYTICS +
  VISUAL_BOARD — a visit's total alone cannot say whether 21 took two darts
  or three, nor that the thrower stuck, so QUICK_SCORE cannot carry this
  game.
- **One dart's fact:** intended = **nothing stored** — free aim; any
  segment that keeps the total at or under 21 is a legitimate target. Hit =
  number and ring where it landed; `score` = the dart's **board** score
  (S11 = 11, T7 = 21, outer bull = 25, miss = 0) — never the round rank.
- **Stick** is not a dart. It is read from the visit: fewer than three darts
  and no bust means the thrower stuck.
- **Stage type:** one shared stage for the round (the whole game in V1) —
  every seat's visit is compared against the others, as 501's `SHARED` leg
  (`app/src/modules/game/five-oh-one.engine.module.ts:380`). Multi-round
  play would open one per round.
- **Derived, never stored:** each seat's running total, bust, rank, the
  round winner or draw.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Stick** | V1 | Stop throwing after any dart and keep the total |
| **Bust** | V1 | A running total above 21; the visit scores zero |
| **Blackjack** | V1 | Exactly 21 within the first two darts |
| **Draw** | V1 | The best rank and total is shared; nobody wins the round |
| **Multi-round** | V2+ | The series is won by most rounds won |
| **Cumulative Blackjack** | V2+ | The series is won by highest total across rounds |
| **Rotating throwing order** | V2+ | Seat order shifts each round |
| **Casino Blackjack** | V2+ | Casino-style card board with Ace 1 or 11 and a suit rule |
| **Skilled Casino Blackjack** | V2+ | Casino Blackjack with only doubles and trebles scoring |

## Open questions

- With 3 or 4 seats, does a tie that does not involve the best result
  matter? The source says a tie "draws the round" without separating the
  top from the rest. This file reads it as a tie for best only.
- A third dart thrown after two darts already made 21: this file ranks it a
  plain 21, not a Blackjack. The source does not address the case; the reading
  rests on its wording "with only the first two darts". Confirm.
- Single-seat play: not in the source, which needs "two or more players".
  Wanted?
