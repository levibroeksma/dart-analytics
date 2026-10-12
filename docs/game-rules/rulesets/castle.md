# Castle

Current version: none (V1 in design)
Entry points: standalone

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Multiplayer (2–4 seats) | V1 | 2+ | |
| More than four seats | Deferred | 2+ | Blocked on: a session seats at most four (`app/src/services/session-seats.service.ts:7`); the source's listing allows up to 8 and its text up to 20 |
| Config screen (presets shown) | V1 | All | |
| Seat numbers: one per seat, 1–20, no two alike, set at setup | V1 | All | |
| Visit = 3 darts, each free to build or attack | V1 | All | |
| Build: a dart in your own number adds bricks (single 1, double 2, treble 3) | V1 | All | |
| Castle capped at 15 bricks; the excess is ignored | V1 | All | |
| Attack: a dart in another seat's number removes bricks (single 1, double 2, treble 3) | V1 | All | |
| Castle floored at 0 bricks; a seat at 0 stays in | V1 | All | |
| Darts in no seat's number, the bulls and misses do nothing | V1 | All | |
| First seat to 15 bricks wins at once; the rest of its visit is not thrown | V1 | All | |
| Standard dartboard scoring (assumed) | V1 | All | |
| Short Castle | V2+ | All | Wanted, unscheduled: the brick target is a setting V1 locks at 15 (source: 10) |
| Grand Castle | V2+ | All | Wanted, unscheduled: the brick target is a setting V1 locks at 15 (source: 20) |
| Bullseye Finish | V2+ | All | Wanted, unscheduled: a second finishing rule (15 bricks, then a bull) with its own state; V1 wins on the 15th brick |
| Team Castle | Deferred | 2+ | Blocked on: a session allows one seat per side; teams are rejected (`app/src/services/session-seats.service.ts:87-88`) |
| Best of N match | V2+ | 2+ | Wanted, unscheduled: match structure above a single game is not needed to play one |
| Number by a weak-hand throw | Deferred | 2+ | Blocked on: the app cannot tell which hand threw, and a throw at a target that belongs to no leg yet is a separate capture problem (`501.md` §Features, multiplayer note); V1 sets numbers on the config screen |

## Identity

- Every seat owns a number and a castle of up to 15 bricks. Your own number
  builds your castle, other seats' numbers tear theirs down, and the first
  castle to reach 15 wins. Source: dolfdarts.com, "Castle"
  (https://dolfdarts.com/games/castle, read 2026-10-12).
- Standard dartboard scoring decides how many bricks a dart is worth: single
  1, double 2, treble 3. Face value plays no part.

## Objective

**2+:** be the first seat with a castle of 15 bricks.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 2 seats (min 2, max 4) | Editable |
| Seat numbers | Chosen per seat, 1–20, no two alike | Editable |
| Bricks to win | 15 | Shown, locked |

Seat order is fixed at setup, as 501 (`501.md` §Features); seat 1 throws
first. The source picks numbers by a closest-to-bull throw, a random draw, or
claiming the number a dart hit; V1 sets them on the config screen instead.
Short Castle and Grand Castle unlock the last row (see Later versions). A new
ruleset has no entry in `SEAT_CAPS` and defaults to one seat
(`app/src/services/session-seats.service.ts:91`), so V1 multiplayer needs an
entry of 4.

## How to play

### Visit

Three darts, always all three unless the game ends first. Each dart is judged
on its own, in the order thrown, and may be spent on building or on attacking:
there is no need to commit the visit to one.

### Building

A dart in your own number adds bricks: single 1, double 2, treble 3. A castle
holds at most 15, so bricks beyond 15 are lost.

### Attacking

A dart in another seat's number removes bricks from that seat's castle by the
same values. Any seat is a target, more than one in a visit. A castle never
drops below 0, so a double on a castle with 1 brick removes 1 brick, and a
dart on a castle with 0 bricks does nothing. A seat with 0 bricks is not out;
it keeps throwing and can rebuild.

### Nothing happens

A dart in a number that no seat owns, in either bull, or off the board, changes
no castle.

### Ends when

A seat's castle reaches 15 bricks. The game ends on that dart; any darts left
in the visit are not thrown. The 15th brick may come from any ring, and only a
seat's own dart can complete its own castle. Nothing else bounds the game.

### Result

The winner, each seat's final bricks, bricks built and bricks removed from
others, and the visits it took.

## Later versions

### Variants

- **Short Castle** — the target is 10 bricks, for a quicker game or a big
  group.
- **Grand Castle** — the target is 20 bricks, for a longer game.
- **Bullseye Finish** — 15 bricks is not enough: a seat must then hit a bull
  (inner or outer) to win. Until then its full castle can still be knocked
  down, and it must rebuild.
- **Team Castle** — teams share one castle; teammates' darts build it and
  opponents' darts shrink it.
- **Number by a weak-hand throw** — seat numbers are claimed by throwing one
  dart with the non-dominant hand, closest to the bull choosing first.

### Match structure

- **Best of N match** — the source suggests best of 3 or 5 games.
- More than four seats, once a session can hold them.

## Capture

Castle is unbuilt; this is the capture shape its V1 is designed for.

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS and ANALYTICS +
  VISUAL_BOARD. Which number and ring each dart hit decides everything, so
  QUICK_SCORE (visit totals) cannot carry this game.
- **One dart's fact:** intended = **nothing stored** — building or attacking
  any seat is a legitimate aim, chosen per dart. Hit = number and zone where
  it landed. `score` = the dart's **board** score; bricks are never stored.
- **Seat numbers** are setup configuration, copied into the session's
  configuration snapshot with the seat list.
- **Stage type:** one shared `LEG` for the game — a dart changes another
  seat's castle, as 501's `SHARED` leg
  (`app/src/modules/game/five-oh-one.engine.module.ts:428`). The `LEG` opens at
  the first visit and no second one opens; it closes on the 15th brick. One
  `turns` row per visit, one `darts` row per dart.
- **Derived, never stored:** every castle's bricks (a fold of the dart log in
  order, capped at 15 and floored at 0), bricks built and removed per seat,
  the winner.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Seat numbers** | V1 | The number each seat owns; it builds that seat's castle and is its target for others |
| **Build** | V1 | A dart in your own number; adds bricks |
| **Attack** | V1 | A dart in another seat's number; removes bricks |
| **Short Castle** | V2+ | Target of 10 bricks |
| **Grand Castle** | V2+ | Target of 20 bricks |
| **Bullseye Finish** | V2+ | After 15 bricks, a bull is needed to win |
| **Team Castle** | Deferred | Teams share one castle |
| **Best of N match** | V2+ | A match of several games |
| **Number by a weak-hand throw** | Deferred | Seat numbers claimed by a non-dominant-hand throw |

## Open questions

- Player count: the source's listing says 2–8, its text 2–20. V1 caps at four
  either way (the session seat limit).
- Does a bull count as a number that builds or attacks? The source speaks only
  of assigned numbers 1–20, so V1 reads a bull as doing nothing.
- A seat at 0 bricks: the source never calls it out. V1 reads it as still
  playing, since a castle "cannot be reduced below zero" and the win is
  reaching 15, not outlasting the rest.
- Seat numbers: player-chosen on the config screen (V1 proposal) or one of the
  source's draw methods?
