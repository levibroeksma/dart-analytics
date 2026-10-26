# Nine Lives

Current version: V2 (shipped 2026-10-26)
Entry points: standalone
Card ruleset: `AROUND_THE_CLOCK_V3`
Kernel: TRACK

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Multiplayer (1v1): first to finish, or last standing, wins | V2 | 1v1 | Scheduled for V2 (2026-10-26): a second seat adds the race and elimination result and lifts `AROUND_THE_CLOCK_V3` from one seat to two in `SEAT_CAPS` (`app/src/services/session-seats.service.ts:29`). It ships in place: the config and snapshot do not change, so there is no new ruleset version |
| More than two seats | Deferred | 2+ | Blocked on: the seat model supports one opponent (1v1) per ruleset (`app/src/services/session-seats.service.ts:11-18`); the source allows up to eight |
| Config screen (presets shown) | V1 | All | |
| Three lives | V1 | All | |
| Targets 1 up to 20, then the bull, in order | V1 | All | |
| Any ring of the target counts; at the bull, outer or inner | V1 | All | |
| Advance on a hit; spare darts go at the next target | V1 | All | |
| Lose a life: a visit with no hit | V1 | All | |
| Out at zero lives | V1 | All | |
| Run ends on the bull or at zero lives | V1 | All | |
| Lives variant | V2+ | All | Wanted, unscheduled: a different starting count is a configuration V1 locks |
| Finish at 20 variant | V2+ | All | Wanted, unscheduled: a shorter path is a configuration V1 locks |
| Reverse sequence variant | V2+ | All | Wanted, unscheduled: 20 down to 1 is a configuration of the path |
| Doubles or trebles only variant | V2+ | All | Wanted, unscheduled: a ring lock is a rule switch V1 does not need |
| Grand National variant | V2+ | All | Wanted, unscheduled: a path-order and end-point switch V1 locks (Path 1 → 20 → bull); lives, hit and advance rules are Nine Lives' own |
| Grand National advanced course | Deferred | All | Blocked on: the source loses a life on any dart that misses the narrow bed, and does not say which darts of a visit that covers; see Open questions |
| Standard dartboard scoring (assumed) | V1 | All | |

## Identity

- Around the Clock with lives: hit 1 to 20 then the bull in order; a visit
  that hits nothing costs a life, and three lost lives end your game. Source:
  dolfdarts.com, "Nine Lives" (https://dolfdarts.com/games/nine-lives, read
  2026-10-07).
- Same path and "any ring counts" rule as Around the Clock
  (`around-the-clock.md` §Features); the lives and the failure end are new.
- Board scores play no part; only the number hit matters.

## Tags

| Axis | Tags |
| --- | --- |
| Skill | ACCURACY (primary) |
| Session role | WARM_UP, RECREATIONAL |
| Format | SOLO, ONE_V_ONE |
| Difficulty | BEGINNER |
| Mechanic | SEQUENTIAL, ELIMINATION |
| Pressure | LIVES |
| Family | PUB |

## Objective

**Single:** reach and hit the bull before losing three lives.

**1v1:** the first seat to hit the bull wins outright; otherwise the last seat
with a life left wins (V2).

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 1 seat; 1v1 (V2) | Shown |
| Lives | 3 | Shown, locked |
| Path | 1 → 20 → bull | Shown, locked |

## How to play

### Visit

Up to **three darts**, then play passes.

### Progress

- Any ring of the current number — single, double or treble — is a hit. At
  the bull, outer or inner counts.
- A hit **advances** to the next target at once; the visit's remaining darts
  go at the new target.

### Lives

- **Lose a life:** "If a player fails to hit the target number with any of
  their three darts during a visit, that player loses one life." V1 reads
  this literally — a visit with no hit costs one life; a visit with any hit
  costs none. See Open questions.
- **Out** at zero lives: the seat throws no more darts.

### Ends when

**Single:** the bull is hit (finished), or the third life is lost.

**1v1:** seats alternate visits, and the match ends at once on the first of
two events: a seat hits the bull and wins, or a seat is out and the other
seat wins without playing on. Both seats cannot go out on one visit, so there
is always one winner. This replaces Around the Clock's fewest-darts finish
for Nine Lives only (`around-the-clock.md` §Variants) (V2).

### Result

Finished or not, the furthest target reached, lives left, darts thrown.

**1v1:** the winning seat beside both seats' furthest target, lives left and
darts thrown (V2).

## Later versions

### Variants

- **Lives variant** — a starting count other than three.
- **Finish at 20 variant** — no bull; 20 is the last target.
- **Reverse sequence variant** — 20 down to 1.
- **Doubles or trebles only variant** — only that ring of the target counts.
- **Grand National variant** — the path runs anticlockwise round the board
  from 20: 20, 5, 12, 9, 14, 11, 8, 16, 7, 19, 3, 17, 2, 15, 10, 6, 13, 4, 18,
  1 (the board's own order, not 1 to 20). Any ring counts; there is no bull;
  hitting 1 finishes the course. Lives, advance and the visit with no hit
  are as Nine Lives V1. Source: dolfdarts.com, "Grand National"
  (https://dolfdarts.com/games/grand-national, read 2026-10-12), its novice
  course. Capture is unchanged: the target is still recoverable from the
  path position. The source also names a Horse Racing Darts alias.
  **2+:** if every seat is out, the seat that got furthest along the course
  wins; this extends the V2 multiplayer result and waits on it.
- **Grand National advanced course** (Deferred) — two circuits of the same
  path. The first circuit counts only the outer single of each number, the
  second only the inner single, and the course ends with the bull. A life
  is lost per dart that misses the required bed, not per empty visit. It
  needs ANALYTICS + VISUAL_BOARD: keypad capture records an unbanded `SINGLE`
  (`app/src/modules/game/types.ts:391-394`). It stacks a bed lock, a second
  circuit, a bull finish and a per-dart life rule on the Grand National
  variant, and cannot be written until the per-dart rule is settled.

### Match structure

- Multiplayer: 2–4 seats in seat order fixed at setup, as 501
  (`501.md` §Features). V2 plays two seats (1v1); more is Deferred. The source decides the first thrower by a throw at the
  bull; that waits on the same capture problem 501 defers.

## Capture

V1's capture shape, as built (2026-10-22), taken from Around the Clock's.
Ruleset `AROUND_THE_CLOCK_V3`.

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS and
  ANALYTICS + VISUAL_BOARD (`around-the-clock.md` §Capture).
- **One dart's fact:** intended = **nothing stored** — any ring of the current
  number is a valid aim, and the target is recoverable from the path position.
  Hit = whatever landed; `score` = the dart's **board** score.
- **Stage type:** one `EXERCISE_BLOCK` per seat for the whole game
  (`PER_SEAT`), as Around the Clock.
- **Derived, never stored:** current target, lives left, out, furthest target,
  darts thrown.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Advance** | V1 | Move to the next target after a hit |
| **Lose a life** | V1 | The cost of a visit with no hit |
| **Out** | V1 | No lives left; the seat stops throwing |
| **Lives variant** | V2+ | A starting count other than three |
| **Finish at 20 variant** | V2+ | No bull at the end |
| **Reverse sequence variant** | V2+ | 20 down to 1 |
| **Doubles or trebles only variant** | V2+ | Only one ring of the target counts |
| **Grand National variant** | V2+ | Path in the board's anticlockwise order from 20, ending on 1 |
| **Grand National advanced course** | Deferred | Two circuits on outer then inner single, bull finish, a life lost per missed dart |

## Open questions

- ~~A visit that advances on dart 1, then misses the new target with darts 2
  and 3: no life lost (V1's literal reading), or a life lost because the
  current target ended the visit unhit? The source's sentence does not settle
  it.~~ **Resolved (2026-10-21, user):** no life lost — the literal reading.
- ~~Keep Nine Lives as its own ruleset, or add lives as an Around the Clock
  variant?~~ **Resolved (2026-10-21, user):** an Around the Clock setting,
  shipped as a new ATC ruleset version (`around-the-clock.md` §Features, Nine
  Lives row). Single only; it combines with the ATC path settings (high →
  low, odds first, outer single only), with Easy difficulty and no timer. This
  file stays the rules source.
- Grand National advanced course: when a dart misses the required bed, is a
  life lost for every missed dart in the visit, or only for a miss after a
  hit? Can one visit cost all three lives? The source says only that "a life
  may be lost when any individual dart misses".
- Grand National variant, 2+: when seats are eliminated on the same target,
  the source gives "more lives remaining when eliminated at that position — or
  who reached that position first". Which applies, and in which order?
- Grand National variant: the source seats two to eight players. The `All`
  applicability (a solo run ending on the Nine Lives V1 rule) is this file's
  reading, not the source's; confirm before scheduling.
