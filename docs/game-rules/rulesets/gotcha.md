# Gotcha

Current version: none (V1 in design)
Entry points: standalone

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Multiplayer (2–4 seats) | V1 | 2+ | |
| More than four seats | Deferred | 2+ | Blocked on: a session seats at most four (`app/src/services/session-seats.service.ts:7`) |
| Config screen (presets shown) | V1 | All | |
| Count up from 0 to exactly 301 | V1 | All | |
| Visit = 3 darts, judged on its total | V1 | All | |
| Bust: a visit that would pass 301 is void | V1 | All | |
| Kill: a visit ending on an opponent's total resets that opponent to 0 | V1 | All | |
| One visit can kill several opponents | V1 | All | |
| A bust kills nobody | V1 | All | |
| Win: first to exactly 301 | V1 | All | |
| Adjustable Target | V2+ | All | Wanted, unscheduled: 100 or 501 is a configuration V1 locks |
| Double-Out | V2+ | All | Wanted, unscheduled: a finishing rule switch V1 does not need |
| Freeze | V2+ | 2+ | Wanted, unscheduled: a second kill effect — skip a turn instead of reset — V1 does not need |
| No-Bust | V2+ | All | Wanted, unscheduled: a second overshoot rule V1 does not need |
| First thrower by a throw at the bull | Deferred | 2+ | Blocked on: darts thrown at a target belonging to no leg are a separate capture problem (`501.md` §Features, multiplayer note) |
| Standard dartboard scoring (assumed) | V1 | All | |

## Identity

- 301 counted **up**, with a sting: end your visit on an opponent's total and
  they go back to zero. Source: dolfdarts.com, "Gotcha"
  (https://dolfdarts.com/games/gotcha, read 2026-10-07).
- Standard dartboard scoring. No double-out by default.

## Objective

**2+:** be the first seat to a running total of exactly 301.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 2 seats (min 2, max 4) | Editable |
| Target | 301 | Shown, locked |
| Finish | Any dart | Shown, locked |

Seat order is fixed at setup, as 501 (`501.md` §Features); seat 1 throws
first.

## How to play

### Visit

Three darts. The visit is judged on its **total**: "The combined total of all
three darts is added to the throwing player's running score."

### Bust

"If a player's three-dart total for the turn would cause their running score
to exceed the target of 301, the entire turn is void." The score reverts to
what it was before the visit.

### Kill

- "If, after adding the current turn's points, your running total exactly
  matches any opponent's running total, that opponent's score is immediately
  reset to 0."
- Only the end-of-visit total counts, not a dart mid-visit.
- One visit can **kill** several opponents at once.
- A bust is void, so it kills nobody.

### Ends when

A seat's running total is exactly 301; it wins at once.

### Result

Winner, each seat's final total, kills made and suffered, busts.

## Later versions

### Variants

- **Adjustable Target** — another target, e.g. 100 or 501; all else the same.
- **Double-Out** — "The winning dart must land in a double segment (or the
  inner bullseye)."
- **Freeze** — a killed opponent skips their next turn instead of resetting.
- **No-Bust** — an overshooting visit leaves the score unchanged, with no
  other penalty.

### Match structure

- The source decides the first thrower by a throw at the bull; deferred, as
  501's.

## Capture

Gotcha is unbuilt; this is the capture shape its V1 is designed for.

- **Capture / input mode:** RECREATIONAL + QUICK_SCORE (visit totals) or
  VISUAL_BOARD (one dart row each), as Score Training (`score-training.md`
  §Capture). Bust and kill are decided by the visit total alone.
- **One dart's fact:** QUICK_SCORE: none; the unit of capture is the visit.
  VISUAL_BOARD: intended = **nothing stored** (free aim); hit = where it
  landed; `score` = the dart's **board** score.
- **Stage type:** one shared stage for the game — a kill changes another
  seat's total, as 501's `SHARED` leg
  (`app/src/modules/game/five-oh-one.engine.module.ts:286`).
- **Derived, never stored:** running totals — a fold over visit totals in
  throw order, with busts voided and kills resetting — plus kills, busts and
  the winner.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Bust** | V1 | A visit that would pass the target; void |
| **Kill** | V1 | Ending a visit on an opponent's total, resetting them to 0 |
| **Adjustable Target** | V2+ | A target other than 301 |
| **Double-Out** | V2+ | Winning dart in a double or the inner bull |
| **Freeze** | V2+ | A killed opponent skips a turn instead |
| **No-Bust** | V2+ | Overshoot leaves the score unchanged |

## Open questions

- Does reaching exactly 301 mid-visit end the visit? The source judges the
  turn total, so as written dart 3 can bust a visit that touched 301.
- A solo mode: with no one to kill it is a race to exactly 301, close to Nine
  Dart Century (`../training/exercises/nine-dart-century.md`). Wanted?
