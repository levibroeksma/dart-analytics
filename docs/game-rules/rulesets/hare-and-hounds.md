# Hare and Hounds

Current version: none (V1 in design)
Entry points: standalone

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Multiplayer (1v1) | V1 | 1v1 | |
| Config screen (presets shown) | V1 | All | |
| Roles: one seat is the Hare, the other the Hound, chosen at setup | V1 | 1v1 | |
| Ring: the twenty numbers in clockwise board order | V1 | All | |
| Starts: Hare on 20, Hound on 5, one step behind the Hare | V1 | 1v1 | |
| Visit = 3 darts; the Hare throws first | V1 | 1v1 | |
| Advance: each Hit on the number a visit started on moves a seat one step | V1 | All | |
| Hare wins on arriving back at 20 | V1 | 1v1 | |
| Catch: the Hound wins on reaching the Hare's number or beyond, checked after every dart | V1 | 1v1 | |
| Hare wins only on a further hit on 20 | Dropped | 1v1 | Decided against, user decision 2026-10-12: the source says both "returning to 20" and "then hit 20 once more to finish the circuit"; arriving back at 20, the lap's 20th advance, wins. The "one more hit on 20" reading would make the Hare's lap 21 hits and tilt an already asymmetric game |
| Handicap Start: the Hound starts further back, on 9 or 12 | V2+ | 1v1 | Wanted, unscheduled: a balancing switch for mixed ability that V1 does not need |
| Head-Start Hare: the Hare throws two or three visits before the Hound | V2+ | 1v1 | Wanted, unscheduled: a second way to balance the game |
| Doubles-Only Advancement: only a double moves a seat on | V2+ | All | Wanted, unscheduled: a stricter hit rule V1 does not need |
| Multi-Player Hounds: one Hare chased by two or more Hounds | V2+ | 2+ | Wanted, unscheduled: needs rules for the Hounds' turn order and which Hound's catch ends the game, which the source does not give |
| First thrower by a throw at the bull | Deferred | 1v1 | Blocked on: darts thrown at a target belonging to no game are a separate capture problem (`501.md` §Multiplayer, as implemented); the source uses the throw to pick roles, which V1 sets up directly |

## Identity

- An asymmetric chase around the board's physical order. The Hare runs a full
  lap from 20; the Hound starts one step behind it and tries to catch it.
  Source: dolfdarts.com, "Hare and Hounds"
  (https://dolfdarts.com/games/hare-and-hounds, read 2026-10-12).
- There is no score and no bust. Only a seat's position on the ring matters.
  Rulings the source does not make, or makes twice, were settled by user
  decision 2026-10-12 and are marked as such.

## Tags

| Axis | Tags |
| --- | --- |
| Skill | ACCURACY (primary), SWITCHING |
| Session role | RECREATIONAL |
| Format | ONE_V_ONE, MULTIPLAYER |
| Difficulty | INTERMEDIATE |
| Mechanic | CHASE, ADJACENCY, SEQUENTIAL |
| Pressure | NONE |
| Family | PUB |

## Objective

**1v1:** the Hare wins by arriving back on 20 after a full lap; the Hound wins
by catching the Hare first.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 2 seats (1v1) | Shown, locked |
| Roles | One Hare, one Hound | Editable |
| Hare's start | 20 | Shown, locked |
| Hound's start | 5, one step behind the Hare | Shown, locked |
| Darts per visit | 3 | Shown, locked |

Roles are chosen at setup: the players pick who is the Hare. The source
suggests a coin flip or a bull throw for this; the app does not run either,
and the bull throw is deferred. Seat order follows the roles: the Hare is
first, because the Hare always throws first.

## How to play

### The ring

Seats move clockwise through the board's physical order, not numerical order.
Position 0 is the number 20:

20 – 1 – 18 – 4 – 13 – 6 – 10 – 15 – 2 – 17 – 3 – 19 – 7 – 16 – 8 – 11 – 14 –
9 – 12 – 5, then back to 20.

The Hare starts on 20. The Hound starts on 5, which in this ring is the number
**before** 20: one step **behind** the Hare, at position −1. User decision
2026-10-12: the source says 5 is "one position clockwise from 20", which
contradicts its own ring (and its later "one step behind"); the ring wins.

### Visit

Each seat throws three darts, then play passes. The Hare throws first, then
the Hound, alternately. A seat aims at the number it stands on.

### Advancing

A dart in any ring of the number a seat stood on at the start of its visit
(single, double or treble) is a **hit** and moves the seat one step along the
ring; a double or treble is still one step. Each hit in the visit is one step,
so a visit moves a seat 0, 1, 2 or 3 steps. A dart in any other number, the
bull or off the board does nothing; there is no penalty and no bust.

User decision 2026-10-12: every hit on the number the visit started on
advances one step, as the source's worked examples show (the Hare on 18 with
two darts in 18 moves 18 to 4 to 13; three darts in 20 from 20 move it 20 to 1
to 18 to 4). A dart must hit the number the visit started on, not the number
newly reached, so a seat is never held to the next number inside one visit.

### Winning

Let the Hare's steps taken be *h* (0 to 20) and the Hound's be *k*. The Hare's
ring position is *h*; the Hound's is *k* − 1.

- **Hare:** wins on its 20th step, arriving back on 20 (user decision
  2026-10-12). It has then passed through all twenty numbers once. The game
  ends at once, so any darts left in the visit are not thrown.
- **Hound:** wins as soon as it stands on the Hare's number or has moved
  beyond it: its position is the Hare's or further, *k* − 1 at least *h*, so
  it needs one more step than the Hare has taken (user decision 2026-10-12,
  reading the source's "occupies the same number as the Hare or has moved
  beyond" by ring position). This is checked after every dart, and the game
  ends at once ("immediately", per the source).

Only the throwing seat's own steps change in a dart, and the Hare's steps
never close the gap, so the two wins cannot happen on the same dart.

### Ends when

One seat wins: the Hare on its 20th step, or the Hound on catching it.

### Result

The winner and their role, each seat's steps and ring position, and the visits
thrown.

## Later versions

### Variants

- **Handicap Start** — the Hound starts further back on the ring, on 9 or 12
  instead of 5; the greater the skill gap, the further back.
- **Head-Start Hare** — the Hare throws two or three visits before the Hound
  begins.
- **Doubles-Only Advancement** — a seat moves on only with a double of its
  number; singles and trebles do nothing.
- **Multi-Player Hounds** — one Hare chased by two or more Hounds, each
  starting on 5 or on staggered positions; the Hare must outrun all of them,
  and the Hounds take turns in rotation with the Hare. **2+:** needs more than
  two seats, which a new ruleset does not allow until it has a `SEAT_CAPS`
  entry (`app/src/services/session-seats.service.ts:91`).

### Match structure

- **First thrower by a throw at the bull** — the source decides roles by a coin
  flip or a bull throw. Roles are a setup choice in V1.

## Capture

Hare and Hounds is unbuilt; this is the capture shape its V1 is designed for.

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS (a row per dart) or
  ANALYTICS + VISUAL_BOARD, as other dart-row games
  (`app/src/lib/game/rulesets/capabilities.ts:47`, `:55`). QUICK_SCORE cannot
  play it: a visit total cannot say how many darts hit the number, and the
  catch is checked after every dart.
- **One dart's fact:** intended = **nothing stored** (the number is the seat's
  ring position at the start of the visit, recoverable from earlier darts).
  Hit = the number and zone where it landed; `score` = the dart's **board**
  score (D18 = 36). Steps and position are derived.
- **Stage type:** one shared stage for the game, since each seat's win depends
  on the other's position, as 501's `SHARED` leg
  (`app/src/modules/game/five-oh-one.engine.module.ts:428`). A visit is
  derived from the throw order, not stored.
- **Derived, never stored:** each seat's steps and ring position, the gap
  between them, which seat is ahead and the winner.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Ring** | V1 | The twenty numbers in clockwise board order, starting at 20 |
| **Roles** | V1 | Hare or Hound, chosen at setup; the Hare throws first |
| **Starts** | V1 | Hare on 20, Hound on 5, one step behind the Hare |
| **Advance** | V1 | One step along the ring for each hit on the number a visit started on |
| **Hit** | V1 | A dart in the single, double or treble of the number the seat stood on at the start of its visit |
| **Catch** | V1 | The Hound standing on the Hare's number or beyond it; ends the game |
| **Handicap Start** | V2+ | The Hound starts on 9 or 12 instead of 5 |
| **Head-Start Hare** | V2+ | The Hare throws two or three visits first |
| **Doubles-Only Advancement** | V2+ | Only a double moves a seat on |
| **Multi-Player Hounds** | V2+ | One Hare chased by two or more Hounds |
| **First thrower by a throw at the bull** | Deferred | Closest dart to the bull throws first |

## Open questions

- Solo play: the source is two players only; there is no one-seat game.
