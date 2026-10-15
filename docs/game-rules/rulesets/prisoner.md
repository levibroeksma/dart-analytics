# Prisoner

Current version: none (V1 in design)
Entry points: standalone

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Multiplayer (2–4 seats) | V1 | 2+ | |
| More than four seats | Deferred | 2+ | Blocked on: a session seats at most four (`app/src/services/session-seats.service.ts:7`); the source scales to ten and suggests 4–8 or more |
| Teams | Deferred | 2+ | Blocked on: a session allows one seat per side; 2v2 is rejected (`app/src/services/session-seats.service.ts:87-88`). The source lists Prisoner as a team game but gives no team rule |
| Config screen (presets shown) | V1 | All | |
| Target order 1 → 20, one number at a time | V1 | All | |
| Darts held: three each to start | V1 | All | |
| Valid hit: outer single, double or treble of a number | V1 | All | |
| Prison: inner single, outer bull, inner bull | V1 | All | |
| Prisoner: a dart in prison stays on the board and leaves the thrower's arsenal | V1 | All | |
| Bull prisoners are out of play for good | V1 | All | |
| Capture: a valid hit on a number holding a prisoner takes one prisoner | V1 | All | |
| Captured darts join the arsenal from the next visit | V1 | All | |
| Bounce-out or miss: the dart sits out the thrower's next visit | V1 | All | |
| Out at zero darts held | V1 | All | |
| Win: complete 20, or be the last seat holding darts | V1 | 2+ | |
| Doubles Only | V2+ | 2+ | Wanted, unscheduled: a second rule for what advances a seat; V1 plays one. Outer singles and trebles would still capture |
| Round limit | V2+ | 2+ | Wanted, unscheduled: the source suggests a time or round cap for large groups so the game ends; V1 ends only on a win |
| First thrower by a throw at the bull | Deferred | 2+ | Blocked on: darts thrown at a target belonging to no leg are a separate capture problem (`501.md` §Features, multiplayer note) |
| Clockwise board order as the target order | Dropped | 2+ | The source's objective says clockwise, its setup and examples play 1, 2, 3; the user decision of 2026-10-12 is numerical order. Clockwise order (1, 20, 5, 12 …) is not played |
| Standard dartboard scoring (assumed) | V1 | All | |

## Identity

- Go around the clock from 1 to 20, but a dart that lands in the thin inner
  single, or the bull, is **imprisoned**: it stays in the board and you lose
  it, and an opponent's hit on that number can take it from the board for
  their own arsenal. Source: dolfdarts.com, "Prisoner"
  (https://dolfdarts.com/games/prisoner, read 2026-10-12).
- Board scores play no part. Only the number and the **zone** each dart hits
  matter, and the zone includes the inner and outer single bands.
- It needs at least two seats: capture and last-seat-standing have no
  meaning alone.

## Tags

| Axis | Tags |
| --- | --- |
| Skill | ACCURACY (primary) |
| Session role | RECREATIONAL |
| Format | ONE_V_ONE, MULTIPLAYER, TEAMS |
| Difficulty | INTERMEDIATE |
| Mechanic | SEQUENTIAL, ELIMINATION |
| Pressure | PENALTY |
| Family | PUB |

## Objective

**2+:** be the first seat to hit a valid segment on every number from 1
through 20 in order, or be the last seat still holding darts.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 2 seats (min 2, max 4) | Editable |
| Target order | 1 → 20, numerical | Shown, locked |
| Darts each at the start | 3 | Shown, locked |
| What advances a seat | Outer single, double or treble; Doubles Only (V2+) | Editable (V2+) |

Seat order is fixed at setup, as 501 (`501.md` §Features); seat 1 throws
first. The source has players "throw one dart at the bullseye" to pick the
order; V1 does not (see Features). The source asks for "two or more"; the
repo's session cap is four seats (`app/src/services/session-seats.service.ts:7`),
and a ruleset with no `SEAT_CAPS` entry defaults to one seat until it is
added (`app/src/services/session-seats.service.ts:91`).

Target order is numerical, 1, then 2, up to 20: user decision 2026-10-12. The
source objective says "clockwise board order" while its setup and example
play 1, 2, 3.

## How to play

### Seat state

Each seat has a **target number** (starting at 1) and **darts held** (starting
at 3). Darts held counts every dart the seat owns: those it can throw and any
sitting out after a miss (see Bounce-outs and misses). A seat is **in** while
it holds at least one dart.

### Visit

On its turn a seat throws all the darts it can throw — the darts held, less
those sitting out. This number is fixed when the visit starts. A dart
captured during the visit does not add a throw until the seat's next visit:
user decision 2026-10-12. Play then passes to the next seat still in.

### Where a dart lands

Let the target be the thrower's current target number, and let a number
**hold a prisoner** when at least one imprisoned dart is lodged in it.

**Valid hit.** A dart in the outer single, double or treble of a number
(1–20). It can do two things, both at once:

- **Advance:** if the number is the thrower's target, the target moves to the
  next number, and any darts still to throw this visit go at the new target.
- **Capture:** if the number holds a prisoner — whoever's dart it is, and
  whether or not the number is the thrower's target — the thrower takes
  **one** prisoner: it leaves the board and joins the thrower's darts held.
  One valid hit takes only one prisoner, even if several are lodged there.
  User decision 2026-10-12: capture works on any number, not only the target.

A valid hit on a number that is not the target and holds no prisoner is a
plain miss, with no penalty. The dart is retrieved and kept.

**Prison.** A dart in the inner single of any number, or in the outer or inner
bull, is imprisoned. It stays in the board and leaves the thrower's darts
held; the thrower gets no advance and no capture from it.

- A dart in the inner single is lodged in that number, and can be captured
  by a valid hit on that number.
- A dart in either bull is out of play for good: nothing can capture it.
  User decision 2026-10-12.

**Bounce-outs and misses.** A dart that bounces out or lands off the board is
kept by the thrower but sits out the thrower's **next visit**, and returns the
visit after. It still counts in darts held.

### Out

A seat that holds no darts is **out**: it throws no more, and play goes on
among the seats still in. A seat can only lose darts on its own visits (by
prison), so the game never removes two seats at once.

### Ends when

A seat completes number 20 by a valid hit on 20 when its target is 20, and
wins at once, even partway through its visit; or, all other seats being out,
the last seat in wins, wherever its target is.

### Result

Winner, how they won (completed 20, or last seat in), each seat's final
target and darts held, the order seats went out, and prisoners captured and
imprisoned per seat.

## Later versions

### Variants

- **Doubles Only** — a seat advances only by hitting the double of its target.
  Outer singles and trebles do not advance, but still capture prisoners. It
  slows progress and imprisons more darts.

### Match structure

- A round or time limit for large groups, as the source suggests.
- More than four seats, and teams, once a session can hold them.
- First thrower decided by a throw at the bull; deferred as 501's.

## Capture

Prisoner is unbuilt; this is the capture shape its V1 is designed for.

- **Capture / input mode:** ANALYTICS + VISUAL_BOARD only. The inner single is
  a prison and the outer single a valid hit, so every dart's band decides the
  outcome. Keypad capture writes the unbanded `SINGLE` and cannot tell the
  two apart (`app/src/modules/game/types.ts:390-394`), so RECREATIONAL +
  QUICK_SCORE and keypad DETAILED_DARTS cannot carry this game.
- **One dart's fact:** intended = **nothing stored** (any number may be
  hit and captured from); hit = number and zone where it landed
  (`INNER_SINGLE`, `OUTER_SINGLE`, `DOUBLE`, `TREBLE`, `OUTER_BULL`,
  `INNER_BULL` or `MISS`); `score` = the dart's **board** score.
- **Stage type:** one shared stage for the game — a dart in one seat's visit
  changes another seat's darts, as 501's `SHARED` leg
  (`app/src/modules/game/five-oh-one.engine.module.ts:428`).
- **Derived, never stored:** each seat's target number, darts held and darts
  sitting out; which numbers hold prisoners and how many; who is out and the
  winner. The prisoners on the board are a fold over every seat's darts in
  throw order, imprisoned minus captured.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Prison** | V1 | The inner single of any number, and either bull; a dart there is imprisoned |
| **Prisoner** | V1 | A dart in prison: it stays in the board and leaves its thrower's arsenal |
| **Capture** | V1 | A valid hit on a number holding a prisoner takes one prisoner into the thrower's darts held |
| **Valid hit** | V1 | A dart in the outer single, double or treble of a number |
| **Darts held** | V1 | Every dart a seat owns, including any sitting out |
| **Out** | V1 | A seat holding no darts |
| **Doubles Only** | V2+ | Only the double of the target advances a seat |

## Open questions

- A valid hit on the thrower's own target that also holds a prisoner is read
  here as both advancing and capturing. The source says each is a valid hit
  but never combines them; its tips ("advance and capture in the same
  action") support this reading.
- Prison in a number other than the target: the source's clarification only
  exempts non-target darts "not in a prison zone", so an inner single on any
  number is read here as imprisoned. Confirm: should a non-target inner
  single instead be a plain miss?
- A seat all of whose darts are sitting out has no dart to throw on its next
  visit; read here as skipping it, not as being out. The source's
  elimination line ("none due to return from bounce-out penalties") agrees.
- The game has no bound beyond a win: if every seat keeps missing, play
  continues. A round limit is a V2+ row.
