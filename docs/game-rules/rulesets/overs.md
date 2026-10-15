# Overs

Current version: none (V1 in design)
Entry points: standalone

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Multiplayer (2–4 seats) | V1 | 2+ | |
| More than four seats | Deferred | 2+ | Blocked on: a session seats at most four (`app/src/services/session-seats.service.ts:7`); the source allows up to eight |
| Config screen (presets shown) | V1 | All | |
| Visit = 3 darts, scored as the board total | V1 | All | |
| Opening visit: sets the seat's first target, no life lost | V1 | All | |
| Beat: total above the seat's own target; it becomes the new target | V1 | All | |
| Fail: total at or below the target; lose a life, the failed total becomes the target | V1 | All | |
| Out at no lives | V1 | All | |
| Last seat with a life wins | V1 | 2+ | |
| Simultaneous out: every seat left loses its last life in one round, each gets one life back | V1 | 2+ | |
| Standard dartboard scoring (assumed) | V1 | All | |
| Unders | V2+ | 2+ | Wanted, unscheduled: the same game with the direction reversed; V1 does not need it, and two of its rules are unsettled (deliberate zero visits, the simultaneous-out tiebreak — see Open questions) |
| Random Target | V2+ | 2+ | Wanted, unscheduled: one shared random number a round replaces every seat's own target. The number is a fact of the round that `turns` and `darts` cannot hold (`database/migrations/0006_runtime_events.sql:24-34`), so it needs a home first |
| Adjusted Lives | V2+ | All | Wanted, unscheduled: V1 locks 3 lives; the source offers 2 or 5, and as a handicap more for a weaker player, which needs lives per seat |
| Overs and Unders Combined | V2+ | 2+ | Wanted, unscheduled: needs Unders first |
| First thrower by a throw at the bull | Deferred | 2+ | Blocked on: darts thrown at a target belonging to no game are a separate capture problem (`501.md:17`) |
| Best-of-N games | V2+ | 2+ | Wanted, unscheduled: the source leaves a series to agreement (it names it for Unders); V1 plays one game |

## Identity

- Beat your own last visit or lose a life. Each visit must total more than the
  seat's previous one; fail three times and you are out. Source: dolfdarts.com,
  "Overs" (https://dolfdarts.com/games/overs, read 2026-10-12); Unders is its
  companion game, "Unders" (https://dolfdarts.com/games/unders), kept here as a
  variant.
- Standard dartboard scoring: a visit is the sum of its three darts' board
  scores, at most 180.

## Tags

| Axis | Tags |
| --- | --- |
| Skill | SCORING (primary) |
| Session role | RECREATIONAL |
| Format | ONE_V_ONE, MULTIPLAYER |
| Difficulty | INTERMEDIATE |
| Mechanic | ELIMINATION |
| Pressure | PENALTY |
| Family | PUB |

## Objective

**2+:** be the last seat with a life left. The game needs at least two seats;
a session seats at most four.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 2 seats (min 2, max 4) | Editable |
| Lives | 3 | Shown, locked |
| Target | The seat's own last visit | Shown, locked |
| Direction | Over (strictly higher) | Shown, locked |

Seat order is fixed at setup; seat 1 throws first. Adjusted Lives and Unders
become choices here when they ship.

## How to play

### Visit

Three darts; the visit's total is the sum of their board scores. A dart that
misses the board scores 0.

### Round

A round is one visit from every seat that still has a life, in seat order. A
seat that goes out is skipped from the next round. Whether the game is over is
judged at the end of a round, not mid-round.

### Opening visit

A seat's first visit has no target to beat. Whatever it totals becomes the
seat's **target**, and no life is lost.

### Each later visit

- **Beat:** total strictly above the target. The total becomes the new target.
- **Fail:** total equal to or below the target. The seat loses one life, and
  the failed total, not the old target, becomes the new target. A 42 against a
  target of 85 costs a life and leaves a target of 42.
- A total of 0 always fails.

Targets are per seat; no seat is judged against another's.

### Out

A seat with no lives left is **out**. It takes no more turns.

### Ends when

At the end of a round, exactly one seat has a life left; it wins.

**2+:** if every seat still in at the start of a round lost its last life in it,
each of those seats gets one life back, keeps its target and the game goes on.
Seats that went out in earlier rounds stay out.

### Result

Winner, the order seats went out, each seat's lives left, visit average and
highest visit.

## Later versions

### Variants

- **Unders** — the same game reversed. A visit must total strictly below the
  seat's own target; the opening visit is free and sets it. A visit equal to or
  above the target loses a life, and the failed total becomes the target. The
  source calls it the harder half, since the target only shrinks. A target of 0
  can never be beaten. Misses: a dart off the board scores 0, so three misses
  total 0; the source says whether deliberate misses are allowed "varies by
  house rule". If two seats lose their last life in one round, the source has
  the seat that threw later win, which differs from Overs.
- **Random Target** — no seat keeps a target. At the start of every round one
  random whole number from 4 to 179 is drawn, the same for all seats, and every
  seat must total strictly over it (in Unders, strictly under it) or lose a
  life. A new number is drawn each round. There is no opening visit, since the
  target exists from round 1. The source describes it for both Overs and
  Unders.
- **Adjusted Lives** — start with another number of lives: the source gives 2
  for a shorter game and 5 for a longer one, and as a handicap a weaker seat
  can have more.
- **Overs and Unders Combined** — odd rounds are played as Overs, even rounds
  as Unders. Round 1 is the free opening visit. The source calls it Overs/Unders
  or Yo-Yo.
- **Best-of-N games** — a series of games, "best of 3 or best of 5" in the
  source's words.

### Match structure

- More than four seats, once a session can hold them.
- First thrower by a throw at the bull: the closest dart throws first, the rest
  by closeness.

## Capture

Overs is unbuilt; this is the capture shape its V1 is designed for.

- **Capture / input mode:** RECREATIONAL + QUICK_SCORE (visit totals) or
  ANALYTICS + VISUAL_BOARD (one dart row each), the pair Score Training offers
  (`app/src/lib/game/rulesets/capabilities.ts:42`). Only the visit total
  decides anything.
- **One dart's fact:** QUICK_SCORE: none; the unit of capture is the visit.
  VISUAL_BOARD: intended = **nothing stored** (free aim); hit = where it
  landed; `score` = the dart's **board** score.
- **Stage type:** one shared stage for the game, since a round's end decides
  who is out for all seats, as 501's `SHARED` leg
  (`app/src/modules/game/five-oh-one.engine.module.ts:380`, `:428`). A round is
  derived from the throw order, not stored.
- **Derived, never stored:** each seat's target, lives, who is out, rounds
  played and the winner.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Target** | V1 | The total a seat must beat: its own last visit, including a failed one |
| **Opening visit** | V1 | A seat's first visit; its total is its first target |
| **Beat** | V1 | A total strictly above the target; it becomes the target |
| **Fail** | V1 | A total at or below the target; a life is lost and the failed total becomes the target |
| **Out** | V1 | No lives left; no more turns |
| **Unders** | V2+ | The same game reversed: each visit must total strictly below the target |
| **Random Target** | V2+ | One shared random number from 4 to 179 each round replaces every seat's own target |
| **Adjusted Lives** | V2+ | A starting life count other than 3 |
| **Overs and Unders Combined** | V2+ | Odd rounds as Overs, even rounds as Unders |
| **Best-of-N games** | V2+ | A series of games |
| **First thrower by a throw at the bull** | Deferred | Closest dart to the bull throws first |

## Open questions

- Does a seat that is already out end the round for the others? Proposed
  reading, V1's rule: no, a round always completes. The source says "Eliminated
  players no longer throw" and the game runs "until only one player remains",
  but also gives a tiebreak for "all remaining players" losing their last life
  "on the same round", which only makes sense if the round completes. Unders'
  text agrees ("if two players lose their final life in the same round, the
  player who threw later … wins").
- Unders: two seats losing their last life in one round — the source's Unders
  has the later thrower win, its Overs gives each seat a life back. Which holds
  in Unders and in Overs and Unders Combined?
- Unders: are deliberate misses allowed (a 0 total)? "Varies by house rule".
- Random Target: does a visit that equals the number lose? The source says
  "score over" and "score under"; the reading here is strictly.
