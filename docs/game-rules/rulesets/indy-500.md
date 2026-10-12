# Indy 500

Current version: none (V1 in design)
Entry points: standalone

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Multiplayer (2–4 seats) | V1 | 2+ | |
| More than four seats | Deferred | 2+ | Blocked on: a session seats at most four (`app/src/services/session-seats.service.ts:7`); the source allows six |
| Config screen (presets shown) | V1 | All | |
| Count up from 0 to exactly 500 | V1 | All | |
| Visit = 3 darts, each scored as it lands | V1 | All | |
| Pit stops at 100, 200, 300 and 400 | V1 | All | |
| Pit stop owed: one stop, however many thresholds a visit crossed | V1 | All | |
| Pit target: either bull | V1 | All | |
| While a stop is owed, darts off the bull score 0; the clearing bull scores 0 | V1 | All | |
| Bust: a visit that would pass 500 is void, and a stop cleared in it is owed again | V1 | All | |
| Win: first to exactly 500, at once | V1 | All | |
| Standard dartboard scoring (assumed) | V1 | All | |
| Short Track | V2+ | All | Wanted, unscheduled: a 250 target with a stop every 50 is a configuration V1 locks |
| Custom Pit Stops | V2+ | All | Wanted, unscheduled: the source leaves the interval and the target (a double, say) to house rules; V1 fixes both |
| Variable Pit Stops | V2+ | All | Wanted, unscheduled: thresholds drawn at random before the race need a draw the app would have to record, and V1 fixes them |
| Best-of series | V2+ | 2+ | Wanted, unscheduled: V1 is one race; a series of races needs match structure on top |
| Team Relay | Deferred | 2+ | Blocked on: a session allows one seat per side; teams are rejected (`app/src/services/session-seats.service.ts:87-88`) |
| First thrower by a throw at the bull | Deferred | 2+ | Blocked on: darts thrown at a target belonging to no leg are a separate capture problem (`501.md` §Features, multiplayer note) |

## Identity

- A race to exactly 500, with a pit stop to make at every hundred: cross a
  threshold and you must hit the bull before any more points count. Source:
  dolfdarts.com, "Indy 500" (https://dolfdarts.com/games/indy-500, read
  2026-10-12).
- Standard dartboard scoring: a dart's board score is its face value times its
  ring, the outer bull 25 and the inner bull 50.
- The source leaves the pit-stop interval and target to house rules. V1's
  fixed choices (every 100, either bull, one stop owed however many thresholds
  a visit crossed, the bust and exact-500 rulings below) are recorded
  decisions of 2026-10-12 and are marked as such where they appear.

## Objective

**2+:** be the first seat to a running total of exactly 500.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 2 seats (min 2, max 4) | Editable |
| Target | 500 | Shown, locked |
| Pit-stop thresholds | 100, 200, 300, 400 | Shown, locked |
| Pit target | Either bull (outer 25 or inner 50) | Shown, locked |
| Variant | Indy 500; Short Track, Custom Pit Stops, Variable Pit Stops (V2+) | Editable (V2+) |

Seat order is fixed at setup, as 501 (`501.md` §Features); seat 1 throws
first. A new ruleset defaults to one seat until it has an entry in `SEAT_CAPS`
(`app/src/services/session-seats.service.ts:91`), so two or more seats need
that entry.

## How to play

### Visit

Three darts, thrown one after another, and each is scored as it lands. A visit
ends early only when a dart busts the visit or wins the game (below); the
remaining darts are then not thrown.

### Scoring / progress

Each scoring dart adds its board value to the seat's running total, which
starts at 0. The total only goes up, except when a bust voids a visit.

### Pit stops

Every seat is either **not owed** a pit stop or **owed** one. Every seat starts
not owed.

- **Crossing.** The thresholds are 100, 200, 300 and 400. A threshold is
  crossed when the running total reaches or passes it (the source: "upon
  reaching or passing"). A visit that crosses one or more thresholds leaves the
  seat owed **one** pit stop, however many it crossed (user decision
  2026-10-12: a 99 to 279 visit crosses 100 and 200 and still owes one).
- **When it starts.** The stop is required from the seat's next visit. The
  darts left in the crossing visit score normally.
- **While owed.** A dart that is not a bull (outer or inner) scores 0. The
  first bull dart in the visit clears the stop; that bull dart itself scores 0
  (user decision 2026-10-12). Every dart after it in that visit scores normally,
  bulls included at 25 or 50.
- **A visit with no bull** scores 0 and the seat stays owed.
- **Cleared and crossed in one visit.** A seat that clears its stop and then
  crosses another threshold with the remaining darts is owed again from its
  next visit.

### Bust

A visit **busts** when a dart would take the running total past 500. The whole
visit is void (user decision 2026-10-12):

- the running total reverts to what it was at the start of the visit;
- the pit-stop state reverts too: a stop cleared in that visit is owed again,
  and a stop incurred in it is not owed.

The dart that caused the bust is the last one thrown; the rest of the visit is
forfeited (the source: "any remaining darts in that turn are forfeited"). A
bust is only possible once the stop, if owed, is cleared, since a seat that is
owed scores nothing until it hits the bull.

### Finishing

A dart that takes the running total to exactly 500 wins the game at once (user
decision 2026-10-12; the source asks that "the final dart of the winning visit
must bring the total to precisely 500"). Darts remaining in that visit are not
thrown. Because play stops at the winning dart, two seats can never both finish:
the seat first to 500 in throwing order wins, which is the source's tie rule
and needs no separate clause.

### Ends when

A seat's running total is exactly 500. Nothing else bounds the game: V1 has no
visit limit and no draw.

### Result

Winner, each seat's final running total, visits taken, pit stops made, busts.

## Later versions

### Variants

- **Short Track** — a 250 target with a pit stop every 50 points (so 50, 100,
  150, 200); all else the same.
- **Custom Pit Stops** — another interval, or another pit target such as a
  named double, agreed before the race. Whether the pit target's ring matters
  would then be a setting.
- **Variable Pit Stops** — the thresholds are drawn at random before the race
  rather than fixed.

### Match structure

- **Best-of series** — a race is one leg of a best-of-3 or best-of-5 series.
- **Team Relay** — teammates alternate visits on one shared total instead of
  each seat running its own.
- More than four seats, once a session can hold them.
- The source decides the first thrower by a throw at the bull; deferred, as
  501's.

## Capture

Indy 500 is unbuilt; this is the capture shape its V1 is designed for.

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS (a row per dart) or
  ANALYTICS + VISUAL_BOARD. Whether a dart scores depends on whether a bull
  came before it in the visit, which a visit total cannot show, so
  QUICK_SCORE cannot carry this game. Inner versus outer bull is irrelevant to
  the rules, so keypad capture is enough.
- **One dart's fact:** intended = the bull while the seat is owed a stop,
  nothing stored otherwise (free aim). Hit = the number and ring that landed.
  `score` = the dart's **board** score, so a treble 20 thrown while owed stores
  60 even though it is worth 0 game points, and the clearing bull stores 25 or
  50. Game points are derived, never stored.
- **Stage type:** one `EXERCISE_BLOCK` per seat for the whole race; stage
  ownership `PER_SEAT`, as Around the Clock's
  (`app/src/modules/game/around-the-clock.engine.module.ts:322`). Seats never
  affect one another's totals. A new turn row opens for each visit.
- **Derived, never stored:** whether a seat is owed a stop, each dart's game
  points, running totals, busts, pit stops made, the winner: all folded from
  the darts in throwing order, with a bust visit voided as a whole.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Pit stop** | V1 | A bull hit a seat owes after crossing a threshold, before points count again |
| **Pit stop owed** | V1 | The state of a seat that crossed a threshold and has not yet cleared its stop |
| **Bust** | V1 | A visit that would pass 500; void, and the pit-stop state reverts |
| **Short Track** | V2+ | A 250 target with a pit stop every 50 points |
| **Custom Pit Stops** | V2+ | Another pit-stop interval or target |
| **Variable Pit Stops** | V2+ | Thresholds drawn at random before the race |
| **Best-of series** | V2+ | A series of races, the first to a set number of wins taking it |
| **Team Relay** | Deferred | Teammates alternate visits on one shared total |

## Open questions

- Pit stop crossing is read as the running total reaching or passing a
  threshold during a visit; and a seat that clears its stop and crosses
  another threshold in the same visit is read as owed again next visit. The
  source speaks only of a single crossing.
- The source's pit-stop example names "the bullseye or a specified double". V1
  takes either bull (user decision 2026-10-12); does a later Custom Pit Stops
  need a per-threshold target?
- The source's note that a bust makes the visit void does not say what happens
  to a stop cleared in that visit; V1 reverts it (user decision 2026-10-12).
  Is that wanted at 400 and above, where a bust is likeliest?
- Solo play: the source asks for two or more players, so V1 does not claim one
  seat. A solo race to 500 would be close to Nine Dart Century
  (`../training/exercises/nine-dart-century.md`). Wanted?
