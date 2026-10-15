# Battleship Darts

Current version: none (V1 in design)
Entry points: standalone

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Head-to-head (1v1) | V1 | 1v1 | |
| Config screen (presets shown) | V1 | All | |
| Paper fleet: each player hides an eight-ship fleet on paper, off the app | V1 | 1v1 | |
| Fleet of 19 segments: Carrier 5, Frigate 4, Cruiser 3, two Destroyers 2, three Submarines 1 | V1 | 1v1 | |
| Visit = 3 darts, then the Defender announces each dart | V1 | 1v1 | |
| Sunk: every segment of a ship has been hit | V1 | 1v1 | |
| Declared result per dart: miss, hit (ship type) or hit and sunk (ship type) | V1 | 1v1 | |
| App records each declaration and counts ships sunk | V1 | 1v1 | |
| A segment already hit is a miss; bulls and off-board darts are misses | V1 | 1v1 | |
| First seat to sink all eight ships wins; no reply visit for the other seat | V1 | 1v1 | |
| Standard dartboard scoring (assumed) | V1 | All | |
| On-device hidden fleet | Deferred | 1v1 | Blocked on: one shared device cannot hide a fleet from the opponent, so placement and automatic hit-or-miss need hidden information V1 keeps on paper |
| Radar | V2+ | 1v1 | Wanted, unscheduled: a once-a-game reveal triggered by the inner bull; a rule switch V1 does not need |
| Simplified Fleet | V2+ | 1v1 | Wanted, unscheduled: a smaller fleet is a configuration V1 locks to the full fleet |
| Reply visit | V2+ | 1v1 | Wanted, unscheduled: the source offers the trailing seat a final visit for a possible draw as an alternative ending; V1 plays the other one |
| Best of N match | V2+ | 1v1 | Wanted, unscheduled: match structure above one game is not needed to play one (source: best of 3 or 5, first thrower alternating) |
| More than two seats | Deferred | 2+ | Blocked on: the source states two players are required, and its listing's 2–4 has no rules for the extra seats; a session also seats one until the ruleset has an entry in `SEAT_CAPS` (`app/src/services/session-seats.service.ts:91`) |

## Identity

- Battleship on the dartboard: each player hides a fleet on the board's
  segments, then throws to find and sink the other's. Source: dolfdarts.com,
  "Battleship Darts" (https://dolfdarts.com/games/battleship-darts, read
  2026-10-12).
- V1 keeps the fleet on paper, as the source does. The app never learns where
  ships are; it records the darts and what each defender announces. Hidden
  information on one shared device is the reason (see On-device hidden
  fleet).
- Standard dartboard scoring is assumed, but board scores play no part: only
  which segment a dart hit counts.

## Tags

| Axis | Tags |
| --- | --- |
| Skill | ACCURACY (primary) |
| Session role | RECREATIONAL |
| Format | ONE_V_ONE, MULTIPLAYER |
| Difficulty | INTERMEDIATE |
| Mechanic | SIMULATION |
| Pressure | NONE |
| Family | NOVELTY |

## Objective

**1v1:** sink all eight of the other seat's ships before they sink yours.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 2 seats | Shown, locked |
| Fleet | Full fleet, eight ships | Shown, locked |
| Radar | Off | Not shown until a later version |
| Simplified Fleet | Off | Not shown until a later version |

Seat order is fixed at setup, as 501 (`501.md` §Features); seat 1 throws
first. The source decides the first thrower with a closest-to-bull dart; V1
does not.

## How to play

### The fleet

Each player records a fleet on a paper grid of the board's segments: for each
number 1–20, the double, the large single, the treble and the small single.
The bulls are not part of the grid. No segment holds two ships.

| Ship | Count | Segments each | Where |
| --- | --- | --- | --- |
| Aircraft Carrier | 1 | 5 | Large singles of five numbers next to each other around the board |
| Frigate | 1 | 4 | All four segments of one number |
| Cruiser | 1 | 3 | Trebles of three numbers next to each other |
| Destroyer | 2 | 2 | Doubles of two numbers next to each other |
| Submarine | 3 | 1 | One small single |

Together that is 19 segments. "Next to each other" means neighbouring numbers
on the board, so 20 and 1 are neighbours, as are 1 and 18. The app does not
check the paper fleet.

### Visit

**1v1:** the seats alternate, three darts per visit. After the third dart the
other seat, the defender, checks their paper fleet and announces each dart in
order:

- **Miss** — no ship on that segment.
- **Hit**, naming the ship type, for example "Hit, Cruiser".
- **Hit and sunk**, naming the ship type, when that hit takes the ship's last
  segment.

The thrower enters each announcement. A dart in a segment already hit before
is a miss; it harms no ship and is not a second hit. A dart in a bull, or off
the board, is a miss. A ship sinks once every one of its segments has been
hit.

### Ends when

**1v1:** a seat's eighth ship is announced sunk. The seat that sank all eight
wins, at the end of that visit's announcement. The other seat gets no reply
visit, even if it would have finished with its next one.

### Result

The winner, ships sunk by each seat, darts thrown by each seat, and each
seat's hit rate (hits out of darts).

## Later versions

### Variants

- **On-device hidden fleet** — each fleet is placed on the device and kept
  secret from the other player; the app adjudicates every dart. Needs a way
  to hide one player's screen from the other.
- **Radar** — once per game, an inner bull hit makes the defender reveal one
  area of the board that still holds part of an unsunk ship. A second inner
  bull gives nothing. Some groups let the outer bull trigger it too.
- **Simplified Fleet** — a smaller fleet, for example without the Carrier and
  one Destroyer: five ships and 12 hits to win.
- **Reply visit** — when the seat that threw second can still sink its last
  ship in the round the first seat finished, a final visit lets that seat
  reach a draw. The source asks the group to choose this or the V1 ending
  before play.

### Match structure

- **Best of N match** — a match of several games, the seat that throws first
  alternating game to game.
- More than two seats, once the rules say how they play.

## Capture

Battleship Darts is unbuilt; this is the capture shape its V1 is designed for.

- **Capture / input mode:** ANALYTICS + VISUAL_BOARD. The key pad records only
  an unbanded `SINGLE` (`database/seeds/0006_single_band_dart_zones.sql:9`);
  the large and small singles are the distinct `OUTER_SINGLE` and
  `INNER_SINGLE` zones (`:23`, `:30`), and the fleet tells them apart.
- **One dart's fact:** intended = **nothing stored** (free aim). Hit = number
  and zone where it landed. `score` = the dart's **board** score; no game
  value is stored.
- **Declared result:** miss, hit or hit and sunk, with the ship type, is the
  defender's announcement, not a board fact and not derivable from the darts
  without the fleet. `darts` has no column for it
  (`database/migrations/0006_runtime_events.sql:43-65`), so a build would add
  one or carry it in the snapshot (a schema change needs a new numbered
  migration and a spec update). The spec must settle this before
  implementation.
- **Stage type:** one shared `LEG` for the game — a dart resolves against the
  other seat's fleet, as 501's `SHARED` leg
  (`app/src/modules/game/five-oh-one.engine.module.ts:428`). The `LEG` opens at
  the first visit and no second one opens; it closes when the eighth ship
  sinks. One `turns` row per visit, one `darts` row per dart.
- **Derived, never stored:** ships sunk and left per seat, hits per ship, hit
  rate, shot map from the dart log, the winner.

## Known limitations

V1 trusts the defender: the app has no fleet to check an announcement
against, so a wrong announcement is not caught. The paper fleet is not
recorded, so a finished game cannot be replayed to confirm it. The On-device
hidden fleet removes both.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Paper fleet** | V1 | A fleet recorded on paper, never entered in the app |
| **Defender** | V1 | The seat that checks its fleet and announces the thrower's darts |
| **Declared result** | V1 | A defender's announcement for one dart: miss, hit or hit and sunk, with the ship type |
| **Sunk** | V1 | Every segment of a ship has been hit |
| **On-device hidden fleet** | Deferred | Fleets placed and hidden in the app, with automatic hit or miss |
| **Radar** | V2+ | One reveal per game, earned by hitting the inner bull |
| **Simplified Fleet** | V2+ | A smaller fleet |
| **Reply visit** | V2+ | A final visit for the trailing seat, allowing a draw |
| **Best of N match** | V2+ | A match of several games |

## Open questions

- Large and small single: the source does not say which band is which. V1
  reads the small single as the band between the outer bull and the treble
  (`INNER_SINGLE`) and the large single as the band between the treble and the
  double (`OUTER_SINGLE`), which has the larger area (radii in
  `0006_single_band_dart_zones.sql:25`, `:33`). The reading is contested
  across dolfdarts: the Golf Darts page calls the outer band (closer to the
  outside of the board) "large", while the Steeplechase page calls the inner
  band (between the treble and the bull) "the large single bed". Which band
  does this page mean?
- Player count: the source's text says two players are required, its listing
  says two to four. V1 plays two.
- A second dart into a segment hit earlier in the same visit: the source
  speaks only of segments "already hit on a previous turn". V1 treats it as
  already hit, a miss, so a ship never has more hits than segments.
- Does the first thrower still win outright when the other seat's reply visit
  would also finish? V1 picks the source's first-to-sink-wins ending; the
  Reply visit is the alternative.
