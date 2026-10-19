# Baseball Darts

Current version: V1 (shipped 2026-10-18)
Entry points: standalone
Game type: `BASEBALL`
Kernel: TRACK

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player | V1 | Single | |
| Multiplayer (2–4 seats): most runs wins | V2+ | 2+ | Wanted, unscheduled: a solo run is playable without it; a second seat adds the compare-runs result and a `SEAT_CAPS` entry (`app/src/services/session-seats.service.ts:19`) |
| Config screen (presets shown) | V1 | All | |
| Innings: nine, inning n targets number n | V1 | All | |
| One visit per inning | V1 | All | |
| Runs: single 1, double 2, treble 3 on the inning's number | V1 | All | |
| Any other number, or the bull, scores no runs | V1 | All | |
| Run ends after inning 9 | V1 | All | |
| Extra innings | V2+ | 2+ | Wanted, unscheduled: depends on Multiplayer — a solo run has no tie |
| Bullseye Tiebreaker | V2+ | 2+ | Wanted, unscheduled: depends on Multiplayer, as Extra innings |
| 7th Inning Stretch | V2+ | All | Wanted, unscheduled: a scoring switch V1 does not need |
| Bullseye Baseball | V2+ | All | Wanted, unscheduled: a scoring gate V1 does not need; V1 already scores no runs on the bull, so the gate only adds the unlock rule |
| Team Play | Deferred | 2+ | Blocked on: a session allows one seat per side; 2v2 is rejected (`app/src/services/session-seats.service.ts:87-88`) |
| Standard dartboard scoring (assumed) | V1 | All | |

## Identity

- Nine innings, one number each: inning 1 is the 1, inning 9 the 9. Each dart
  in the inning's number scores runs by its ring. Source: dolfdarts.com,
  "Baseball Darts" (https://dolfdarts.com/games/baseball-darts, read
  2026-10-07).
- Close to Shanghai — round n targets number n — but runs count the ring, not
  the board score, and there is no instant win (`shanghai.md` §Capture).
- No bases or outs; runs only.

## Tags

| Axis | Tags |
| --- | --- |
| Skill | ACCURACY (primary) |
| Session role | WARM_UP, RECREATIONAL |
| Format | SOLO, ONE_V_ONE, MULTIPLAYER, TEAMS |
| Difficulty | BEGINNER |
| Mechanic | SIMULATION, SEQUENTIAL, ACCUMULATION, FIXED_COUNT |
| Pressure | NONE |
| Family | NOVELTY |

## Objective

**Single:** score as many runs as possible over nine innings. The maximum is
81 (three trebles every inning).

**2+:** most runs after nine innings wins (V2+).

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 1 seat | Shown, locked |
| Innings | 9 | Shown, locked |
| Scoring | Runs by ring | Shown, locked |

## How to play

### Visit

Three darts at the inning's number; one visit per inning.

### Runs

- Single of the inning's number: 1 run. Double: 2. Treble: 3.
- "A dart landing on any other number — including the bullseye — scores zero
  runs."

### Ends when

**Single:** after inning 9.

### Result

Total runs, and runs per inning.

## Later versions

### Variants

- **7th Inning Stretch** — "All runs scored during the 7th inning are
  doubled."
- **Bullseye Baseball** — runs in an inning count only if at least one of its
  three darts hit the bull (outer or inner); with no bull the inning scores 0,
  however well the number was hit. The bull dart scores no runs itself, so the
  maximum is 6 an inning. Source: dolfdarts.com, "Bullseye Baseball"
  (https://dolfdarts.com/games/bullseye-baseball, read 2026-10-12), which names
  it a variant of Baseball Darts. The gate reads the visit's darts, so
  Capture is unchanged.

### Match structure

- Multiplayer: 2–4 seats; "every player completes their turn before the group
  advances to the next inning."
- **Extra innings** — on a tie after nine, inning 10 targets 10, inning 11
  targets 11, and so on, "until one player or team holds the lead at the
  conclusion of a complete extra inning."
- **Bullseye Tiebreaker** — tied players throw three darts at the bull
  instead: outer bull 1 run, inner bull 2.
- **Team Play** — teammates pool runs into one total.

## Capture

V1's capture shape, as built (2026-10-18), taken from Shanghai's. Ruleset
`BASEBALL_V1` (seed `0041`).

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS and
  ANALYTICS + VISUAL_BOARD — runs are read off the ring, so QUICK_SCORE cannot
  carry this game.
- **One dart's fact:** intended = **nothing stored** — single, double and
  treble of the inning's number are all legitimate aims, and the number is
  recoverable from the visit index (`shanghai.md` §Capture). Hit = whatever
  landed; `score` = the dart's **board** score — never its runs.
- **Stage type:** one `EXERCISE_BLOCK` per seat for the whole game
  (`PER_SEAT`), as Shanghai. An inning is a turn, not a stage.
- **Derived, never stored:** runs per dart, per inning and in total.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Innings** | V1 | Nine visits, inning n at number n |
| **Runs** | V1 | 1, 2 or 3 per dart in the inning's number, by ring |
| **Bullseye Baseball** | V2+ | Runs count only if a dart in the inning hit the bull |
| **Extra innings** | V2+ | Innings 10, 11, … to break a tie |
| **Bullseye Tiebreaker** | V2+ | Three darts at the bull to break a tie |
| **7th Inning Stretch** | V2+ | Inning 7 runs doubled |
| **Team Play** | Deferred | Teammates pooling runs |

## Open questions

- Extra innings past 20: what does inning 21 target?
- Bullseye Baseball: do darts thrown before the bull dart score? The source
  says the bull "unlocks" the "remaining" darts, but also that an inning
  with no bull scores 0. One reading counts only darts after the first bull;
  the other counts the whole inning once any dart hit the bull.
- ~~Keep Baseball Darts as its own ruleset, or add it as a Shanghai variant
  (nine rounds, runs by ring, no instant win)?~~ **Resolved (2026-10-17,
  user):** its own ruleset, bound to the Track kernel.
- Bullseye Baseball: the source seats two to eight players. The `All`
  applicability (a solo run scoring as Baseball Darts' V1 does) is this file's
  reading, not the source's; confirm before scheduling.
