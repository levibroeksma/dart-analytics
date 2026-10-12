# Bowls Darts

Current version: none (V1 in design)
Entry points: standalone

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Multiplayer (1v1) | V1 | 1v1 | |
| Team Play: teams of two or more a side | Deferred | 2+ | Blocked on: a session takes one seat per side, and a side of two seats is rejected (`app/src/services/session-seats.service.ts:87-88`); the source plays 2 players "or 2 teams" |
| Config screen (presets shown) | V1 | All | |
| Target score: first to reach it wins, default 21 | V1 | All | |
| End: one jack dart, then three darts a seat | V1 | All | |
| Jack: the number of the end's first dart | V1 | All | |
| Jack re-throw: a jack dart in the bull or off the board is thrown again | V1 | All | |
| Jack duty alternates each end | V1 | All | |
| Scoring order: the seat not throwing the jack throws first | V1 | All | |
| Distance: the difference between the dart's number and the jack | V1 | All | |
| Dead dart: a scoring dart in the bull or off the board never scores | V1 | All | |
| Bowls counting: one point for each dart closer than the opponent's best | V1 | All | |
| Tied closest darts are disregarded and the next are compared | V1 | All | |
| Scoreless end: nothing left to separate the seats | V1 | All | |
| Win: first to reach the target score, overshoot allowed | V1 | All | |
| Fixed ends with a sudden-death end | V2+ | All | Wanted, unscheduled: the source's alternative format (a set number of ends, highest score wins, one sudden-death end to break a tie); V1 plays to a target |
| Exact Number Only: only a dart on the jack number scores | V2+ | All | Wanted, unscheduled: a stricter scoring rule V1 does not need |
| Weighted Scoring: jack number 3 points, a neighbour on the board 1 | V2+ | All | Wanted, unscheduled: replaces bowls counting; V1 does not need it |
| Moving Jack: hitting the jack number moves the jack | V2+ | All | Wanted, unscheduled: the source does not say how the new jack is chosen (see Open questions) |
| First thrower by a throw at the bull | Deferred | 1v1 | Blocked on: darts thrown at a target belonging to no game are a separate capture problem (`501.md` §Multiplayer, as implemented) |

## Identity

- Lawn bowls on a dartboard: one dart sets a target number (the jack), then
  each seat throws three darts to land numerically closest to it. Source:
  dolfdarts.com, "Bowls Darts" (https://dolfdarts.com/games/bowls-darts, read
  2026-10-12).
- Only a dart's **number** matters, never its ring: single, double and treble
  of a number are the same distance from the jack. The bull and a miss have no
  number (below). Rulings the source does not make were settled by user
  decision 2026-10-12 and are marked as such.

## Objective

**1v1:** be the first seat to reach the target score (default 21) by winning
ends. The source's second format, two teams, is deferred.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 2 seats (1v1) | Shown, locked |
| Target score | 21 | Editable |
| Darts per seat per end | 3 | Shown, locked |
| Scoring | Bowls counting | Shown, locked |

Target score: default 21 (the source's "most common choice"), a whole number
of at least 1. The source states no upper bound; the config screen's maximum is
an open question.

Seat order is fixed at setup; seat 1 throws the first jack. Nothing else is
editable: Exact Number Only, Weighted Scoring and Moving Jack are the source's
alternative scoring rules and are deferred.

## How to play

### An end

Each end has two phases.

1. **The jack.** The jack thrower throws one dart. Its number is the **jack**
   for the end, whatever the ring (a dart in single, double or treble 14 makes
   the jack 14). If the dart lands in the **bull** (outer or inner) or **off
   the board**, it sets no jack: the same seat throws again, as often as it
   takes, until a dart lands in a segment 1–20. User decision 2026-10-12: the
   source does not say what a bull or a miss does to the jack.
2. **The scoring darts.** Each seat throws three darts. The seat **not**
   throwing the jack throws its three-dart visit first; the jack thrower then
   throws its visit (user decision 2026-10-12: the source gives no order). The
   order is per visit, not alternating darts.

The jack duty alternates every end, scoreless ends included. Seat 1 throws the
first jack.

### Distance and dead darts

A scoring dart in a segment 1–20 has a **distance**: the difference between
its number and the jack, ignoring the ring (jack 14: single, double or treble
15 are all distance 1; 11 is distance 3; the jack number itself is 0, the best
possible). Distance is arithmetic on numbers: 6 and 13 are neighbours on the
board but 7 apart.

A scoring dart in the bull or off the board is a **dead dart** (user decision
2026-10-12). It never scores. It never beats any dart, so every live dart is
closer than a dead dart. It is ignored when tied darts are compared, so two
dead darts never tie with each other.

### Scoring an end

After both visits, work out each seat's live darts by distance, nearest first.

1. Compare the two nearest live darts. If one is closer, that seat wins the end.
2. If they are the same distance, those two tied darts are **disregarded**, and
   the next-nearest are compared; repeat until one is closer, or until neither
   seat has a live dart left.
3. The end's winner scores one point for each of its remaining live darts that
   is closer than the loser's nearest remaining live dart. If the loser has no
   live dart left, every remaining live dart of the winner scores (a dead dart
   is farther than any live dart; user decision 2026-10-12).
4. If neither seat has a live dart left after the ties, the end is
   **scoreless**: no points, and the next end begins.

A seat can score 1, 2 or 3 points in an end; only one seat scores in an end.

Worked example: jack 14. Seat A lands 14, 15, 18 (distances 0, 1, 4). Seat B
lands 11, 17, 20 (3, 3, 6). B's nearest is 3. A has two darts closer than 3 (0
and 1), so A scores 2. A's third dart (4) is not closer than 3 and scores
nothing.

Tie example: jack 14. A lands 14, 12, 20 (0, 2, 6); B lands 14, 16, 3 (0, 2,
11). The two 0s are disregarded, then the two 2s; the 6 is closer than the 11,
so A wins the end and scores 1.

### Ends when

A seat's total reaches the target score after an end is scored; it wins. There
is no need to land on the target exactly: overshooting is allowed. Only one
seat can score in an end, so both cannot reach the target together.

### Result

The winner, both final totals, the ends played, and how many ends were
scoreless.

## Later versions

### Variants

- **Fixed ends with a sudden-death end** — the source's alternative format: a
  set number of ends (for example 10 or 15), highest total wins, and a tie is
  settled by one extra end.
- **Exact Number Only** — only a dart on the jack number scores a point;
  proximity does not matter.
- **Weighted Scoring** — instead of bowls counting, the jack number scores 3
  points and a number physically next to it on the board scores 1; every other
  dart scores nothing.
- **Moving Jack** — if a seat lands a dart on the jack number during the
  scoring darts, the jack moves to a new number, "typically determined by the
  next dart thrown or by a fresh jack throw".
- **Team Play** — teams of two or more a side, each throwing three darts; each
  dart closer than the other team's nearest earns a point. Needs a side of two
  or more seats, which a session rejects today.

### Match structure

- **First thrower by a throw at the bull** — the closest dart to the bull
  throws first the first jack, as the source has it. V1 uses seat order.

## Capture

Bowls Darts is unbuilt; this is the capture shape its V1 is designed for.

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS (a row per dart) or
  ANALYTICS + VISUAL_BOARD, as other dart-row games
  (`app/src/lib/game/rulesets/capabilities.ts:47`, `:55`). QUICK_SCORE cannot
  play it: a visit total says nothing of each dart's number or whether it was
  dead.
- **One dart's fact:** intended = **nothing stored** (free aim; the jack number
  is recoverable from the end's jack dart). Hit = the number and zone where it
  landed (a bull or miss makes it dead); `score` = the dart's **board** score
  (S15 = 15, T15 = 45, a miss = 0). Distance and points are derived. The jack
  dart, and any re-thrown jack dart, is a thrown dart like any other.
- **Stage type:** one shared stage for the game, since one seat's darts decide
  the other's points, as 501's `SHARED` leg
  (`app/src/modules/game/five-oh-one.engine.module.ts:428`). An end is derived
  from the throw order, not stored.
- **Derived, never stored:** each end's jack, every dart's distance and dead
  status, tied pairs disregarded, the end's winner and points, running totals,
  scoreless ends and the winner.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **End** | V1 | One jack dart followed by each seat's three darts |
| **Jack** | V1 | The number of the end's first dart (a segment 1–20) |
| **Jack re-throw** | V1 | A jack dart in the bull or off the board is thrown again by the same seat |
| **Distance** | V1 | The difference between a dart's number and the jack; ring ignored |
| **Dead dart** | V1 | A scoring dart in the bull or off the board; never scores, never beats a dart |
| **Bowls counting** | V1 | One point per dart closer than the opponent's best |
| **Scoreless end** | V1 | An end where nothing is left to separate the seats |
| **Target score** | V1 | The total that wins the match; default 21 |
| **Fixed ends with a sudden-death end** | V2+ | A set number of ends, highest total wins, one extra end on a tie |
| **Exact Number Only** | V2+ | Only a dart on the jack number scores |
| **Weighted Scoring** | V2+ | Jack number 3 points, a neighbouring number 1 |
| **Moving Jack** | V2+ | Hitting the jack number moves the jack |
| **Team Play** | Deferred | Teams of two or more a side |
| **First thrower by a throw at the bull** | Deferred | Closest dart to the bull throws first |

## Open questions

- After tied pairs are disregarded, V1 scores the winner's darts against the
  loser's nearest remaining live dart, and the disregarded darts score nothing
  for either seat. The source says only that the tied dart is "disregarded"
  and that points count against "the opponent's closest dart". Confirm.
- Is a jack dart a one-dart visit of its own in the throw log, or part of the
  jack thrower's visit? V1 only needs the order of darts.
- Target score: what is the config screen's maximum? The source gives only the
  default.
- Moving Jack: the source says the new jack is "typically determined by the
  next dart thrown or by a fresh jack throw", and does not say which, or
  whether the end's earlier darts are rescored.
- Solo play: the source's minimum is two players. A one-seat game is not
  offered in V1.
