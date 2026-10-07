# Nine Lives

Current version: none (V1 in design)
Entry points: standalone

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Multiplayer (2–4 seats): first to finish, or last standing, wins | V2+ | 2+ | Wanted, unscheduled: a solo run is playable without it; a second seat adds the race and elimination result and a `SEAT_CAPS` entry (`app/src/services/session-seats.service.ts:19`) |
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
| Standard dartboard scoring (assumed) | V1 | All | |

## Identity

- Around the Clock with lives: hit 1 to 20 then the bull in order; a visit
  that hits nothing costs a life, and three lost lives end your game. Source:
  dolfdarts.com, "Nine Lives" (https://dolfdarts.com/games/nine-lives, read
  2026-10-07).
- Same path and "any ring counts" rule as Around the Clock
  (`around-the-clock.md` §Features); the lives and the failure end are new.
- Board scores play no part; only the number hit matters.

## Objective

**Single:** reach and hit the bull before losing three lives.

**2+:** the first seat to hit the bull wins outright; otherwise the last seat
with a life left wins (V2+).

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 1 seat | Shown, locked |
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

### Result

Finished or not, the furthest target reached, lives left, darts thrown.

## Later versions

### Variants

- **Lives variant** — a starting count other than three.
- **Finish at 20 variant** — no bull; 20 is the last target.
- **Reverse sequence variant** — 20 down to 1.
- **Doubles or trebles only variant** — only that ring of the target counts.

### Match structure

- Multiplayer: 2–4 seats in seat order fixed at setup, as 501
  (`501.md` §Features). The source decides the first thrower by a throw at the
  bull; that waits on the same capture problem 501 defers.

## Capture

Nine Lives is unbuilt; this is the capture shape its V1 is designed for,
taken from Around the Clock's.

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

## Open questions

- A visit that advances on dart 1, then misses the new target with darts 2
  and 3: no life lost (V1's literal reading), or a life lost because the
  current target ended the visit unhit? The source's sentence does not settle
  it.
- Keep Nine Lives as its own ruleset, or add lives as an Around the Clock
  variant?
