# English Cricket

Current version: none (V1 in design)
Entry points: standalone

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Two seats (1v1) | V1 | 1v1 | |
| Teams | Deferred | 1v1 | Blocked on: a session allows one seat per side (`app/src/services/session-seats.service.ts:87-88`); the source plays two players or two teams |
| Config screen (presets shown) | V1 | All | |
| Innings: two, and the seats swap batting and bowling roles | V1 | 1v1 | |
| Seat 1 bats first | V1 | 1v1 | |
| Runs: a batter visit total above 40 scores the excess | V1 | 1v1 | |
| Wicket: a bowler's outer bull takes 1, inner bull 2 | V1 | 1v1 | |
| Innings ends at 10 wickets; excess wickets are ignored | V1 | 1v1 | |
| Higher run total wins; equal totals are a draw | V1 | 1v1 | |
| Standard dartboard scoring (assumed) | V1 | All | |
| Early finish: the chaser passes the target | V2+ | 1v1 | Wanted, unscheduled: the source leaves it to agreement; V1 plays every innings to ten wickets (see Open questions) |
| Tiebreaker innings | V2+ | 1v1 | Wanted, unscheduled: the source offers one more innings each by prior agreement; V1 ends a level game as a draw |
| Beginner's Threshold | V2+ | 1v1 | Wanted, unscheduled: the source lowers the 40 threshold to 30 "or another agreed-upon value"; V1 locks 40 |
| Bullseye Bonus | V2+ | 1v1 | Wanted, unscheduled: a house rule awarding the batter bonus runs for a bull; V1 does not need it |
| Expanded Wicket Targets | Deferred | 1v1 | Blocked on: the source says the segments and wicket values "should be agreed upon before play" and names none |
| First batter and role by a throw at the bull | Deferred | 1v1 | Blocked on: darts thrown at a target belonging to no leg are a separate capture problem (`501.md` §Features, multiplayer note) |

## Identity

- One seat bats, one bowls. The batter scores runs from any visit worth more
  than 40; the bowler takes wickets by hitting the bull. After ten wickets the
  seats swap, and the higher run total wins. Source: dolfdarts.com, "English
  Cricket" (https://dolfdarts.com/games/english-cricket, read 2026-10-12).
- **Aliases:** Bowlers and Batters, British Cricket, Wickets and Runs.
- Not the game in `cricket.md`: that is American Cricket, closing 20–15 and the
  bull. English Cricket uses the whole board and shares only the name.
- Standard dartboard scoring is assumed.

## Objective

**1v1:** score more runs in your batting innings than the other seat does in
theirs.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 2 seats | Shown, locked |
| Wickets per innings | 10 | Shown, locked |
| Run threshold | 40 | Shown, locked |
| First batter | Seat 1 | Shown, locked |

Seat order is fixed at setup, as 501 (`501.md` §Features). A new ruleset has no
entry in `SEAT_CAPS` and defaults to one seat
(`app/src/services/session-seats.service.ts:91`), so V1 needs an entry of 2.

## How to play

**1v1:** the game is two **innings**. In the first, seat 1 bats and seat 2
bowls; in the second they swap. Within an innings the visits alternate, the
batter first: a batter visit, a bowler visit, a batter visit, and so on.

### Batter visit

Three darts, scored at board value. If the visit total is above 40, the
batter scores the **excess** as runs (total − 40); a total of 40 or less
scores no runs. A visit of 41 scores 1; three treble 20s total 180 and score
140, the most a visit can score. Runs add up across the innings.

### Bowler visit

Three darts at the bull. An outer bull takes 1 wicket and an inner bull takes
2. Any other dart is wasted and counts for nothing, as does an off-board dart.
A visit of inner bull, outer bull and single 20 takes 3 wickets.

### End of an innings

When the wickets reach 10 the innings ends at once. Wickets beyond ten are
ignored: an inner bull with one wicket left takes that wicket and the innings
ends. Darts left in the bowler's visit are not thrown. The second innings plays
to 10 wickets in the same way, whatever the first innings' score.

### Ends when

The second innings ends at its tenth wicket.

### Result

The winner is the seat with the higher run total; equal totals are a draw.
Shown: both run totals, each seat's batting visits, the best batting visit,
and each seat's wickets taken per bowling visit.

## Later versions

### Variants

- **Early finish** — the second innings ends the moment the chaser's runs pass
  the target. The source says only that the innings "may continue to establish
  a final score, or the game may be called at that point by agreement".
- **Tiebreaker innings** — after equal run totals, one more full innings each.
- **Beginner's Threshold** — the run threshold lowered from 40 to 30, or to
  another agreed value.
- **Bullseye Bonus** — extra runs for a bull in the batter's visit, e.g. 25
  for an outer bull and 50 for an inner one, on top of the normal score.
- **Expanded Wicket Targets** — the bowler may also take wickets on other
  agreed segments, at agreed values.

### Match structure

- Teams, whose members alternate visits; waits on teams.
- The source decides who bats first, and who may choose, by a throw at the
  bull; deferred, as 501's.

## Capture

English Cricket is unbuilt; this is the capture shape its V1 is designed for.

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS (a row per dart);
  also ANALYTICS + VISUAL_BOARD, the same darts with landing coordinates.
  QUICK_SCORE is not offered: the bowler's wickets come from which darts hit
  a bull, which a visit total cannot show.
- **One dart's fact:** batter's dart: intended = **nothing stored** (free aim);
  bowler's dart: intended = the bull (target 25, no ring stored — both rings
  are valid aims). Hit = the number and zone where it landed. `score` = the
  dart's **board** score for both roles — never runs or wickets.
- **Stage type:** one shared `LEG` per innings, two in all — a visit's result
  (runs, wickets) belongs to the innings of both seats, as 501's `SHARED` leg
  (`app/src/modules/game/five-oh-one.engine.module.ts:428`). A new stage opens
  when the first innings ends. One `turns` row per visit, one `darts` row per
  dart.
- **Derived, never stored:** runs per visit (total − 40, floored at 0), wickets
  per visit, each innings' run total, whether an innings is over, the winner.
  The role of a seat follows from the innings.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Innings** | V1 | One batter against one bowler until ten wickets fall |
| **Runs** | V1 | The excess of a batter's visit total over 40 |
| **Wicket** | V1 | One bowler hit: outer bull 1, inner bull 2 |
| **Early finish** | V2+ | The second innings ends when the chaser passes the target |
| **Tiebreaker innings** | V2+ | One more full innings each after a draw |
| **Beginner's Threshold** | V2+ | The 40 threshold lowered to 30 or another value |
| **Bullseye Bonus** | V2+ | Extra batter runs for a bull |
| **Expanded Wicket Targets** | Deferred | Other segments that take wickets |

## Open questions

- The chase innings: does it run to ten wickets, or stop when the chaser
  passes the target? The source allows both. V1 reads: ten wickets, so a
  winning chaser keeps batting until the innings is over.
