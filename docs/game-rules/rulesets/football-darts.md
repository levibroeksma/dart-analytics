# Football Darts

Current version: none (V1 in design)
Entry points: standalone

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Two seats (1v1) | V1 | 1v1 | |
| Three or four seats | V2+ | 2+ | Wanted, unscheduled: the source metadata lists 2–4 players but its rules describe two players or two teams |
| Teams | Deferred | 2+ | Blocked on: a session allows one seat per side (`app/src/services/session-seats.service.ts:87-88`) |
| Config screen (presets shown) | V1 | All | |
| Visit = 3 darts | V1 | All | |
| Possession: a bull (outer or inner) gains it | V1 | All | |
| Goal: a double while in possession | V1 | All | |
| Several goals in one visit | V1 | All | |
| Possession lasts only to the end of the visit | V1 | All | |
| First to 10 goals wins; the match ends at once | V1 | All | |
| Standard dartboard scoring (assumed) | V1 | All | |
| Goal Target | V2+ | All | Wanted, unscheduled: the source also plays to 5 goals; V1 locks 10 |
| Match series | V2+ | All | Wanted, unscheduled: best of 3 games to 10 goals; V1 plays one game |
| Fixed-Round Format | V2+ | All | Wanted, unscheduled: a second end rule — most goals after a set number of rounds — with a draw possible, which V1 does not have |
| Penalty Shootout Tiebreaker | V2+ | All | Wanted, unscheduled: depends on Fixed-Round Format, the only way V1-style play ends level |
| Specific Doubles | V2+ | All | Wanted, unscheduled: a second goal rule — only an assigned double scores — V1 does not need |
| Offsides Penalty | V2+ | All | Wanted, unscheduled: a house rule — an off-board dart ends the visit and loses possession — V1 does not need |
| First thrower by a throw at the bull | Deferred | 1v1 | Blocked on: darts thrown at a target belonging to no leg are a separate capture problem (`501.md` §Features, multiplayer note) |
| American Football Darts | Dropped | All | A different game, not a rule switch: a field of segments, four downs, touchdowns of 6, extra points and field goals; it would be its own ruleset |

## Identity

- Win the ball with the bull, then score with doubles: a goal is any double
  thrown while you hold possession. First to 10 goals wins. Source:
  dolfdarts.com, "Football Darts" (https://dolfdarts.com/games/football-darts,
  read 2026-10-12).
- **Aliases:** Soccer Darts, Darts Football.
- Standard dartboard scoring is assumed, but only the zone a dart lands in
  matters here, never its points.

## Tags

| Axis | Tags |
| --- | --- |
| Skill | BULL (primary), DOUBLES |
| Session role | RECREATIONAL |
| Format | ONE_V_ONE, MULTIPLAYER, TEAMS |
| Difficulty | ADVANCED |
| Mechanic | SIMULATION, ACCUMULATION |
| Pressure | NONE |
| Family | NOVELTY |

## Objective

**1v1:** be the first seat to 10 goals. The source's objective is "a two-player
or two-team" game; V1 seats two.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 2 seats | Shown, locked |
| Goals to win | 10 | Shown, locked |
| Goal | Any double | Shown, locked |
| Possession | Outer or inner bull | Shown, locked |

Seat order is fixed at setup, as 501 (`501.md` §Features); seat 1 throws
first. Neither seat starts in possession. A new ruleset has no entry in
`SEAT_CAPS` and defaults to one seat
(`app/src/services/session-seats.service.ts:91`), so V1 needs an entry of 2.

## How to play

### Visit

Three darts. Every visit starts without possession.

### Possession

- A seat not in possession aims at the bull. Either ring, outer or inner, gains
  possession at once. The bull scores no goal.
- Darts left in the same visit may then go for a goal.
- Possession ends with the visit, however it went (see Open questions). A
  bull on the third dart gains possession with no dart left to use it.

### Goal

- While in possession, a dart in any double (the outer narrow ring) scores one
  goal. Which double and its face value do not matter.
- Each double scores its own goal: a seat that gains possession on dart 1 and
  doubles on darts 2 and 3 scores two.
- The inner bull is not a double. A bull thrown while already in possession,
  and every other dart, has no effect.
- A double thrown before possession scores nothing.
- A dart off the board is a dart with no effect.

### Ends when

A seat's goal total reaches 10; it wins at once. The other seat gets no reply
visit, and any darts left in the winning visit are not thrown.

### Result

Winner, the goals for each seat, visits, and visits in which each seat gained
possession.

## Later versions

### Variants

- **Goal Target** — another target; the source names 5 for a short game.
- **Fixed-Round Format** — play a set number of rounds (the source's example is
  20 per player); most goals wins. A level score is a draw.
- **Penalty Shootout Tiebreaker** — after a level Fixed-Round game each seat
  takes five penalty darts at the doubles; more doubles wins, and a tie goes to
  sudden-death rounds of one dart each.
- **Specific Doubles** — a goal needs a named double, e.g. only double 20, or
  one double assigned to each seat.
- **Offsides Penalty** — a dart that leaves the board ends the visit and loses
  possession.

### Match structure

- **Match series** — best of 3 games to 10 goals.
- Three or four seats, and teams, once the session and the rules allow them.
- The source decides the first thrower by a throw at the bull; deferred, as
  501's.

## Capture

Football Darts is unbuilt; this is the capture shape its V1 is designed for.

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS (a row per dart);
  also ANALYTICS + VISUAL_BOARD, the same darts with landing coordinates.
  QUICK_SCORE is not offered: a goal depends on which dart hit a double after
  which dart hit a bull, and a visit total cannot show that.
- **One dart's fact:** intended = **nothing stored** (free aim); what the dart
  is meant for follows from whether the seat holds possession. Hit = the
  number and zone where it landed (outer bull, inner bull, double, other).
  `score` = the dart's **board** score — never a goal.
- **Stage type:** one shared `LEG` for the game — a seat's goals end the game
  for the other, as 501's `SHARED` leg
  (`app/src/modules/game/five-oh-one.engine.module.ts:428`). One `turns` row per
  visit, one `darts` row per dart.
- **Derived, never stored:** possession, goals per seat, the winner — a fold
  over each visit's darts in order, starting each visit without possession.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Possession** | V1 | Gained by a bull; lets later darts in the same visit score |
| **Goal** | V1 | A double thrown while in possession; one goal each |
| **Goal Target** | V2+ | A goal total other than 10 |
| **Match series** | V2+ | Best of 3 games to 10 goals |
| **Fixed-Round Format** | V2+ | Play a set number of rounds; most goals wins |
| **Penalty Shootout Tiebreaker** | V2+ | Five darts each at the doubles, then sudden death |
| **Specific Doubles** | V2+ | Only a named double scores a goal |
| **Offsides Penalty** | V2+ | An off-board dart ends the visit and loses possession |
| **American Football Darts** | Dropped | A separate game; see Features |

## Open questions

- Does possession ever carry into the next visit? The source says a seat that
  has possession but hits no double "loses possession at the end of their turn",
  but its own example has a seat score with its last dart and then "must regain
  possession on their next visit". V1 reads: possession always ends with the
  visit, so every visit starts by finding the bull.
- Three or four seats: the metadata says 2–4 players, the rules say two. If
  allowed, how do goals and the first-to-10 end rule work across three or more
  seats?
