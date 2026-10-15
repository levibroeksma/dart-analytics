# Brag

Current version: none (V1 in design)
Entry points: standalone

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Head-to-head (1v1) | V1 | 1v1 | |
| More than two seats | V2+ | 2+ | Wanted, unscheduled: the source does not say which seat is the Stopper once three or four play, and a new ruleset seats one until it has an entry in `SEAT_CAPS` (`app/src/services/session-seats.service.ts:91`) |
| Config screen (presets shown) | V1 | All | |
| Wagering version: the Scorer gives a Nomination, the Stopper accepts or passes | V1 | 1v1 | |
| Scorer and Stopper swap every round | V1 | 1v1 | |
| Accepted: the Scorer throws three darts; total at or above the nomination wins the chip | V1 | 1v1 | |
| Stopper passes: the Scorer wins the round and takes the 1-chip stake without throwing | V1 | 1v1 | |
| Fixed stake of 1 chip | V1 | All | |
| First to N chips won wins, N set by the players at setup | V1 | All | |
| Standard dartboard scoring (assumed) | V1 | All | |
| Negotiated stake | V2+ | All | Wanted, unscheduled: the source lets a round's stake be agreed before the throw, which needs an agreement step V1 does not have |
| Fixed number of rounds | Deferred | All | Blocked on: the source breaks a chip tie after the last round with a sudden-death margin comparison, and it does not say what happens on equal margins or when neither player meets their nomination |
| Poker-Hand version | Deferred | All | Blocked on: the source ranks hands but not how to compare two Flushes, two Pairs or two High Cards of one rank, whether numbers run 20 to 1, how a bull or a miss counts in a hand, or what a drawn tie-break hand does |
| Scram Brag | V2+ | All | Wanted, unscheduled: rides on Scram (`scram.md`), itself in design |
| Blind Brag | V2+ | All | Wanted, unscheduled: throwing without looking cannot be checked by the app; at most an on-screen instruction |
| Multi-Hand Brag | V2+ | All | Wanted, unscheduled: forms the best three-dart hand from six or nine darts, so it rides on the Poker-Hand version |

## Identity

- Bluff and bet on your own scoring: the Scorer names a three-dart total, the
  Stopper bets on whether they reach it. Part darts, part card game. Source:
  dolfdarts.com, "Brag" (https://dolfdarts.com/games/brag, read 2026-10-12).
- The source describes two formats, a Wagering version and a Poker-Hand
  version. V1 plays the Wagering version; the Poker-Hand version is Deferred.
- Standard dartboard scoring: a visit's total is the sum of its darts' board
  scores.

## Tags

| Axis | Tags |
| --- | --- |
| Skill | SCORING (primary) |
| Session role | RECREATIONAL |
| Format | ONE_V_ONE, MULTIPLAYER |
| Difficulty | INTERMEDIATE |
| Mechanic | SIMULATION, THRESHOLD |
| Pressure | NONE |
| Family | NOVELTY |

## Objective

**1v1:** win more wagers than the other seat: be first to collect N chips.
Chips are won one at a time; the seat that reaches N first wins.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 2 seats | Shown, locked |
| Version | Wagering | Shown, locked |
| Stake per round | 1 chip | Shown, locked |
| Chips to win (N) | Set by the players at setup | Editable |

The source calls N an agreed target chip count and gives no value; V1 claims
no default and no range (see Open questions). Seat order is fixed at setup, as 501 (`501.md` §Features); seat 1 is
the Scorer in round 1. The source sets the first Scorer by a closest-to-bull
throw; V1 does not.

## How to play

### Round

A round is one wager between the **Scorer** and the **Stopper**.

1. The Scorer names a **nomination**: a whole total of 1 to 180, "this or
   more".
2. The Stopper either **accepts** or **passes**.
3. Accepted: the Scorer throws three darts. A total equal to or above the
   nomination wins the wager for the Scorer; a total below it wins the wager
   for the Stopper. The winner takes 1 chip.
4. Passed: no darts are thrown. The Scorer wins the round and takes the
   1 chip stake.
5. Roles swap. The next round has the other seat as Scorer, whether the last
   round was thrown or passed.

A visit is always three darts; a miss scores 0. The total counts every dart,
so a nomination of 80 is met by 80 exactly.

### Ends when

A seat's chip count reaches N. The game ends when that round resolves, whether
it was thrown or passed.

### Result

The winner, each seat's chips, rounds played, wagers accepted and passed by
each seat, and each Scorer's hit rate against their nominations.

## Later versions

### Variants

- **Poker-Hand version** — every seat throws three darts each round and the
  darts form a hand, ranked high to low: Prial (all three darts in the same
  number), Running Flush (three consecutive numbers, all in one ring), Run
  (three consecutive numbers), Flush (all in one ring, not consecutive), Pair
  (two darts in the same number), High Card (nothing else; valued by the best
  dart). The best hand wins the pot of 1 chip from each other seat; equal
  hands draw and nothing moves. Higher numbers beat lower ones within a rank.
- **Negotiated stake** — the stake of a round is agreed before the throw
  instead of fixed at 1 chip.
- **Fixed number of rounds** — play a set number of rounds (the source
  suggests 10 or 20); most chips wins, and a tie goes to one sudden-death
  round. In the Wagering version each tied seat is Scorer once and the seat
  that beats their own nomination by more wins.
- **Scram Brag** — the Stopper throws first to close segments of the board
  before the Scorer's visit, making the nomination harder to reach.
- **Blind Brag** — the thrower does not look at the board, so nominations
  rest on feel alone.
- **Multi-Hand Brag** — each seat throws six or nine darts and keeps the best
  three-dart hand.

### Match structure

- More than two seats, once the Stopper's role is defined for them.

## Capture

Brag is unbuilt; this is the capture shape its V1 is designed for.

- **Capture / input mode:** RECREATIONAL + QUICK_SCORE (visit total only):
  the outcome of a round needs only the Scorer's total against the
  nomination. DETAILED_DARTS or VISUAL_BOARD would also work; nothing in the
  rules depends on a dart's ring.
- **One dart's fact:** QUICK_SCORE: none; the unit of capture is the visit.
  With dart rows: intended = **nothing stored** (free aim), hit = where it
  landed, `score` = the dart's **board** score.
- **Round facts:** the nomination and the Stopper's accept or pass are
  decisions of the round, not darts and not a visit total. `turns` has no
  column for them (`database/migrations/0006_runtime_events.sql:24-34`) and
  neither has `darts` (`:43-65`), so a Brag build would add them, either as
  new columns or in the configuration snapshot (a schema change needs a new
  numbered migration and a spec update). A passed round has no darts and
  needs a representation of its own. The spec must settle both before
  implementation.
- **Stage type:** one `ROUND` stage per round, opened when the Scorer
  nominates; at most one `turns` row (the Scorer's visit) with up to three
  `darts` rows.
- **Derived, never stored:** whether a wager was won, each seat's chips, who
  is Scorer, the winner, hit rate against nominations.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Wagering version** | V1 | The format where the Scorer names a total and the Stopper bets on it |
| **Scorer** | V1 | The seat that nominates and throws; swaps every round |
| **Stopper** | V1 | The seat that accepts or passes the nomination; swaps every round |
| **Nomination** | V1 | The total the Scorer names, "this or more" |
| **Accepted** | V1 | The Stopper takes the wager; the Scorer throws |
| **Stopper passes** | V1 | The Stopper declines; no darts, and the Scorer takes the chip |
| **Poker-Hand version** | Deferred | The format where each seat's three darts form a ranked hand |
| **Negotiated stake** | V2+ | A round's stake agreed before the throw |
| **Fixed number of rounds** | Deferred | A set number of rounds, most chips wins, sudden-death tie-break |
| **Scram Brag** | V2+ | The Stopper closes segments before the Scorer throws |
| **Blind Brag** | V2+ | The thrower does not look at the board |
| **Multi-Hand Brag** | V2+ | Six or nine darts, best three-dart hand kept |

## Open questions

- Passing: the source says the Stopper "concedes the round without a wager",
  and the tips say the Scorer "wins the round without throwing". V1 reads that
  as a chip for the Scorer, the same 1-chip stake a won wager pays. Is a passed
  round instead worth nothing?
- Chips: V1 counts chips won (first to N). Does the loser pay the winner
  from a starting stack? The source says winners "take the agreed stake" and
  that chips "accumulate" but gives no starting stack.
- N: the source says only "a target chip count" the players agree. V1 lets the
  players set N at setup. What default and what minimum and maximum should the
  config screen offer? None is sourced; a spec decision is needed.
- Nomination range: V1 allows 1 to 180, the board maximum; the minimum of 1 is
  a draft value. Is a nomination above what three darts can score (above 180)
  or an unreachable total such as 179 allowed? The source sets no limit.
- Poker-Hand version: do numbers wrap from 20 to 1 for a Run? Do the bulls
  have a number or a ring for a Flush?
