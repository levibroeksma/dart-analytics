# Mickey Mouse

Current version: none (V1 in design)
Entry points: standalone

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Multiplayer (2–4 seats): first to close all twelve wins | V2+ | 2+ | Wanted, unscheduled: a solo run is playable without it; with no points, seats never interact, so a second seat adds only a first-to-close result and a `SEAT_CAPS` entry (`app/src/services/session-seats.service.ts:19`) |
| Config screen (presets shown) | V1 | All | |
| Twelve categories: 20 down to 12, Doubles, Triples, Bull | V1 | All | |
| Close in any order | V1 | All | |
| Close: 3 marks on a category | V1 | All | |
| Number marks: single 1, double 2, treble 3 | V1 | All | |
| Doubles and Triples: any double or treble ring on 1–20, 1 mark each | V1 | All | |
| Bull: outer 1 mark, inner 2 marks | V1 | All | |
| Double-dip: one dart marks its number and its ring category | V1 | All | |
| Marks past three are lost | V1 | All | |
| No points | V1 | All | |
| Visit = up to 3 darts | V1 | All | |
| Run ends when all twelve are closed | V1 | All | |
| Scored Mickey Mouse | V2+ | 2+ | Wanted, unscheduled: depends on Multiplayer — points need an opponent who has not closed the number |
| Extended Range | V2+ | All | Wanted, unscheduled: 11 and 10 widen the number set, a configuration V1 locks |
| Standard dartboard scoring (assumed) | V1 | All | |

## Identity

- A cricket-style closing race over twelve categories: the numbers 20 down to
  12, any three doubles, any three trebles, and the bull. No points in the
  traditional British pub form: "The game is a pure closing race." Source:
  dolfdarts.com, "Mickey Mouse" (https://dolfdarts.com/games/mickey-mouse,
  read 2026-10-07).
- The source lists Coach and Horses, Beds and Bulls, The Game and Tactics as
  regional names. This repo's Tactics (`tactics.md`) is a different objective
  set — 20–15, Doubles, Triples and bull, with points and an auto rule instead
  of a double-dip — see Open questions.
- Standard dartboard scoring is assumed.

## Objective

**Single:** close all twelve categories in as few darts as possible. A solo
run has no win, as Cricket's solo run (`cricket.md` §Open questions, D421).

**2+:** the first seat to close all twelve wins (V2+).

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 1 seat | Shown, locked |
| Categories | 20–12, Doubles, Triples, Bull | Shown, locked |
| Scoring | No points | Shown, locked |

## How to play

### Visit

Up to **three darts**, then play passes.

### Marks

- Each category needs **three marks** to **close**. Categories close in any
  order.
- **20 down to 12:** single 1 mark, double 2, treble 3.
- **Doubles:** any double ring on 1–20, 1 mark each.
- **Triples:** any treble ring on 1–20, 1 mark each.
- **Bull:** outer bull 1 mark, inner bull 2. The bull never marks Doubles.
- **Double-dip:** "A single dart can count toward more than one category
  simultaneously" — a treble 20 closes 20 and marks Triples.
- Marks past three on a closed category are lost.

### Ends when

**Single:** all twelve categories are closed. Nothing else bounds a run.

### Result

Darts thrown, and per category the darts it took to close.

## Later versions

### Variants

- **Scored Mickey Mouse** — once a seat has closed a number its opponent has
  not, further hits score the dart's value; to win, a seat must close all
  twelve with points at least equal to every opponent's.
- **Extended Range** — the numbers run down to 10, adding 11 and 10.

### Match structure

- Multiplayer: 2–4 seats in seat order fixed at setup, as 501
  (`501.md` §Features). The source decides the first thrower by a throw at the
  bull; that waits on the same capture problem 501 defers.

## Capture

Mickey Mouse is unbuilt; this is the capture shape its V1 is designed for.

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS and
  ANALYTICS + VISUAL_BOARD — a mark is read off the dart's number and ring, so
  QUICK_SCORE cannot carry this game. Same pair as Tactics (`tactics.md`
  §Capture).
- **One dart's fact:** intended = **nothing stored** — target number and ring
  both null; any open category is a legitimate aim. Hit = whatever landed;
  `score` = the dart's **board** score — never its marks.
- **Stage type:** one `EXERCISE_BLOCK` per seat for the whole game
  (`PER_SEAT`, as `cricket.engine.module.ts:134`). No stage opens per category.
- **Derived, never stored:** marks per category, closed categories, darts to
  close, darts thrown.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Close** | V1 | Reach three marks on a category |
| **Doubles** | V1 | Category marked by any double ring on 1–20 |
| **Triples** | V1 | Category marked by any treble ring on 1–20 |
| **Double-dip** | V1 | One dart marking its number and its ring category at once |
| **Scored Mickey Mouse** | V2+ | Points on numbers a seat has closed and an opponent has not |
| **Extended Range** | V2+ | Numbers 20 down to 10 |

## Open questions

- A double or treble on an already closed number: does it still mark Doubles
  or Triples? The source states the double-dip but not this case.
- The source names Tactics as the same game. Keep Mickey Mouse as its own
  ruleset, or make it a Tactics variant (wider number set, double-dip, no
  points)?
