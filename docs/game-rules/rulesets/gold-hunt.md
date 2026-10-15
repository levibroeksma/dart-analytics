# Gold Hunt

Current version: none (V1 in design)
Entry points: standalone

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Multiplayer (2–4 seats) | V1 | 2+ | |
| More than four seats | Deferred | 2+ | Blocked on: a session seats at most four (`app/src/services/session-seats.service.ts:7`); the source allows six |
| Config screen (round count editable) | V1 | All | |
| Running score from 0, each dart added as it lands | V1 | All | |
| Gold: exactly 181 earns +3, score resets to 0, remaining darts continue | V1 | All | |
| Wrap: an overshoot, new score = total − 181, no gold | V1 | All | |
| Round: one visit per seat, a fixed number of them (5–20, default 10) | V1 | All | |
| Win: most gold after the last round | V1 | All | |
| Equal top gold is a draw | V1 | 2+ | |
| Standard dartboard scoring (assumed) | V1 | All | |
| Extra-round tiebreak | V2+ | 2+ | Wanted, unscheduled: the source suggests an additional round to split equal gold; V1 declares a draw instead |
| Gold stealing | Deferred | 2+ | Blocked on: the stealing rules are unpublished; on the source's electronic board the machine defines them |
| Team play | Deferred | 2+ | Blocked on: a session allows one seat per side; teams are rejected (`app/src/services/session-seats.service.ts:87-88`); the source names no team format |
| First thrower by a throw at the bull | Deferred | 2+ | Blocked on: darts thrown at a target belonging to no leg are a separate capture problem (`501.md` §Features, multiplayer note) |

## Identity

- Chase exactly 181, one more than the best three-dart visit, for three gold;
  overshoot and the score wraps round instead of busting. Most gold after the
  last round wins. Source: dolfdarts.com, "Gold Hunt"
  (https://dolfdarts.com/games/gold-hunt, read 2026-10-12).
- The game comes from electronic boards (the source names the Phoenix), which
  keep score and set the game length. The rules are hand-scorable, and the
  source says the game can be played on a standard board with agreed round
  limits. V1 plays on a standard board with the app keeping score.
- Standard dartboard scoring: a dart's board score is its face value times its
  ring, the outer bull 25 and the inner bull 50.
- The source gives no round count, and no equal-gold rule beyond "consult the
  machine"; V1's round range and its draw rule are recorded decisions of
  2026-10-12 and are marked as such where they appear.

## Tags

| Axis | Tags |
| --- | --- |
| Skill | CONTROL (primary), SCORING |
| Session role | RECREATIONAL |
| Format | ONE_V_ONE, MULTIPLAYER, TEAMS |
| Difficulty | INTERMEDIATE |
| Mechanic | ACCUMULATION |
| Pressure | NONE |
| Family | PUB |

## Objective

**2+:** hold the most gold when the last round ends.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 2 seats (min 2, max 4) | Editable |
| Rounds | 10 (min 5, max 20) | Editable |
| Target | 181 | Shown, locked |
| Gold per hit | 3 | Shown, locked |

The round range and default are a user decision of 2026-10-12; the source
leaves game length to the machine. Seat order is fixed at setup, as 501
(`501.md` §Features); seat 1 throws first. A new ruleset defaults to one seat
until it has an entry in `SEAT_CAPS`
(`app/src/services/session-seats.service.ts:91`), so two or more seats need
that entry.

## How to play

### Visit

Three darts, always all three. A **round** is one visit for every seat in seat
order.

### Scoring / progress

Each seat has a running score, starting at 0. Every dart adds its board value
to it as it lands, so a dart is judged against the total at that moment:

- **Exactly 181.** The seat earns **3 gold**, its running score resets to 0,
  and the rest of the visit continues from 0 (the source's example: 121 plus a
  treble 20 reaches 181, and the darts left in the visit start again from 0).
- **Over 181.** The score **wraps**: the new running score is the dart's total
  minus 181, and no gold is earned. The visit goes on from the wrapped score
  (the source's example: 160 plus a treble 20 is 220, which wraps to 39, and
  the other two darts are thrown from 39).
- **Under 181.** The total simply stands.

There is no bust. A visit can earn at most one gold, since after a reset the
remaining darts cannot add up to another 181. Gold is only ever earned, never
lost, in V1. A running score still short of 181 when the game ends earns
nothing.

### Ends when

The last seat has thrown its visit of the final round (the number of rounds on
the config screen).

### Result

Most gold wins. Each seat's gold, final running score, and the number of times
it wrapped, with the winner or the draw named.

**2+:** if two or more seats are level on the most gold, those seats draw: the
game has no single winner (user decision 2026-10-12). Seats with less gold lose
as normal.

## Later versions

### Variants

- **Extra-round tiebreak** — when seats are level on the most gold after the
  last round, play one more round among them; repeat while still level. The
  source suggests "an additional round of play".

- **Gold stealing** — the source gives players an offensive way to take gold
  from opponents, with conditions the Phoenix board manages and the source
  does not publish. It cannot be described until those rules are known. It
  would put a seat's gold in another seat's hands, so it would also need a
  shared stage.

### Match structure

- **Team play** — the source describes no team format; its rules would need
  defining if wanted.
- More than four seats, once a session can hold them.
- The source decides the first thrower by a throw at the bull; deferred, as
  501's.

## Capture

Gold Hunt is unbuilt; this is the capture shape its V1 is designed for.

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS (a row per dart) or
  ANALYTICS + VISUAL_BOARD. A reset mid-visit changes what the next dart adds
  to, and a visit total cannot show it (from 121, a treble 20 then a 20 earns gold
  and ends on 20; judged as one visit total of 80 it would reach 201, wrap to
  20 and earn none), so
  QUICK_SCORE cannot carry this game. Inner versus outer single is
  irrelevant to the rules, so keypad capture is enough.
- **One dart's fact:** intended = **nothing stored** (free aim: no number is
  required, and the best aim depends on the running score). Hit = the number
  and ring that landed. `score` = the dart's **board** score (single 20 = 20,
  treble 20 = 60, outer bull = 25), never a running total or gold.
- **Stage type:** one `EXERCISE_BLOCK` per seat for the whole game; stage
  ownership `PER_SEAT`, as Around the Clock's
  (`app/src/modules/game/around-the-clock.engine.module.ts:322`). V1 seats
  never touch one another's score or gold, so nothing is shared. A new turn
  row opens for each visit; the round is that turn's position.
- **Derived, never stored:** running scores, gold, wraps, the current round,
  the winner or the draw: all folded from the darts in throwing order. The
  round count is setup configuration, copied into the session's configuration
  snapshot.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Gold** | V1 | The 3 points a seat earns each time its running score lands exactly on 181 |
| **Wrap** | V1 | An overshoot of 181: the score becomes the total minus 181, with no gold |
| **Round** | V1 | One visit for every seat, in seat order |
| **Extra-round tiebreak** | V2+ | One more round among seats level on the most gold |
| **Gold stealing** | Deferred | A seat taking gold from an opponent, under rules the source does not publish |

## Open questions

- A round is read as one visit per seat, so every seat throws equally often
  and the game ends after the last seat's final visit. The source names no
  round unit.
- The draw rule (user decision 2026-10-12) names equal gold; with three or four
  seats level at the top, V1 reads it as those seats drawing and the rest
  losing. Should every seat tied at the top share the win, or is a draw only
  for the whole table?
- Solo play: the source asks for two or more players, so V1 does not claim one
  seat. Wanted as a gold-per-round personal best?
