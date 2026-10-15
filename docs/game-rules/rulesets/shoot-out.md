# Shoot Out

Current version: none (V1 in design)
Entry points: standalone

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Multiplayer (2–4 seats) | V1 | 2+ | |
| Config screen (presets shown) | V1 | All | |
| Twenty open numbers at the start; the bull is not in play | V1 | All | |
| Hit: a dart in any ring of an open number | V1 | All | |
| A number hit is closed for every seat | V1 | All | |
| A dart on a closed number, or a miss, is not a hit | V1 | All | |
| Visit score: hits times the open count at the start of the visit | V1 | All | |
| Ends when every number is closed | V1 | All | |
| Highest total wins | V1 | All | |
| Equal highest totals: reported as a tie, no winner | V1 | All | |
| Bull in play | V2+ | All | Wanted, unscheduled: the source says "numbered segments" and its examples open with 20 areas, so V1 leaves the bull out; whether it counts is an open question |
| Sudden-death tiebreak | Deferred | 2+ | Blocked on: the source leaves the tiebreak method for the players to agree before play, and its example needs a measured "closest to centre", which keypad capture cannot make |
| Solo play | V2+ | Single | Wanted, unscheduled: the source's setup text says one to four players, its listing says two to four, so V1 plays 2–4 |
| Doubles (teams) | Deferred | 2+ | Blocked on: a session allows one seat per side; 2v2 is rejected (`app/src/services/session-seats.service.ts:87-88`); the source allows 2–8 players in doubles |
| More than four seats | Deferred | 2+ | Blocked on: a session seats at most four (`app/src/services/session-seats.service.ts:7`) |

## Identity

- A shared-board race to close numbers. Each visit scores the number of open
  numbers you hit, multiplied by how many numbers are still open, and a number
  you hit is closed for everyone. Source: dolfdarts.com, "Shoot Out"
  (https://dolfdarts.com/games/shoot-out, read 2026-10-12). The source
  describes a DARTSLIVE electronic-board game and says the scoring can be done
  by hand ("for manual scoring, carefully track which segments are still
  open"); V1 plays it by hand.
- Which number you hit never matters, only whether it was open. Board scores
  play no part.

## Tags

| Axis | Tags |
| --- | --- |
| Skill | ACCURACY (primary) |
| Session role | RECREATIONAL |
| Format | SOLO, ONE_V_ONE, MULTIPLAYER, TEAMS |
| Difficulty | BEGINNER |
| Mechanic | TERRITORIAL, ACCUMULATION |
| Pressure | NONE |
| Family | PUB |

## Objective

**2+:** have the highest total once every number is closed.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 2 seats (min 2, max 4) | Editable |
| Open numbers at the start | 1–20 | Shown, locked |
| Multiplier | Open numbers at the start of the visit | Shown, locked |

Seat order is fixed at setup, as 501 (`501.md` §Features); seat 1 throws
first. A new ruleset has no entry in `SEAT_CAPS` and defaults to one seat
(`app/src/services/session-seats.service.ts:91`), so Shoot Out needs an entry
of 4.

## How to play

### Visit

Up to **three darts**, then play passes to the next seat. Let **N** be the
number of numbers still open when the visit starts.

### Hits and closing

- A dart in any ring of an open number is a **hit**, and that number is
  **closed** at once, for every seat.
- A dart on a number already closed, on the bull, or off the board is not a
  hit and does nothing.
- Two darts at the same open number in one visit: the first is a hit and
  closes it; the second lands on a closed number and is not a hit.

### Scoring a visit

Visit score = **hits in the visit × N**. N is fixed at the start of the visit,
so numbers a seat closes during its own visit do not lower its own multiplier,
only the next seat's. A visit with no hit scores 0.

Example: 20 numbers open, two hit: 2 × 20 = 40. Then 18 open, one hit: 18.
Then 3 open, three hit: 9.

### Ends when

The last open number is closed; the visit that closes it is the last visit.
Nothing else bounds the game, and there is no visit limit.

### Result

The winner, or a tie, with each seat's total, its visit scores in order,
and the numbers it closed.

**2+:** the highest total wins. Equal highest totals are reported as a tie
with no winner; V1 has no tiebreak.

## Later versions

### Variants

- **Bull in play** — the bull is a 21st target; N and the opening count rise
  to 21.
- **Sudden-death tiebreak** — the source's example: tied seats throw three
  darts at any number still open, or if none is, at the bull for the one
  closest to the centre.
- **Solo play** — one seat closing the board alone.

### Match structure

- **Doubles** — teams of two, per the source's 2–8 player doubles format.
- More than four seats, once a session can hold them.

## Capture

Shoot Out is unbuilt; this is the capture shape its V1 is designed for.

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS or
  ANALYTICS + VISUAL_BOARD — which number each dart landed in decides every
  hit, so a visit total cannot carry the game and QUICK_SCORE cannot.
- **One dart's fact:** intended = **nothing stored** — any open number is a
  legitimate aim. Hit = number and ring where it landed; `score` = the dart's
  **board** score (S20 = 20, T20 = 60, miss = 0) — never the visit points.
- **Stage type:** one shared `LEG` for the game — a dart closes a number for
  every seat, as 501's `SHARED` leg
  (`app/src/modules/game/five-oh-one.engine.module.ts:428`). The `LEG` opens at
  the first visit and no second one opens; the game ends when the last number
  closes. One `turns` row per visit, one `darts` row per dart.
- **Derived, never stored:** which numbers are closed, N at the start of each
  visit, hits, visit scores, totals, the winner.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Hit** | V1 | A dart in any ring of an open number; it closes the number |
| **open count** | V1 | N: the numbers still open when a visit starts; the multiplier |
| **Bull in play** | V2+ | The bull counts as a 21st open target |
| **Sudden-death tiebreak** | Deferred | A further throw to break a tie |
| **Solo play** | V2+ | One seat alone |
| **Doubles (teams)** | Deferred | Teams of two |

## Open questions

- Is the bull in play? The source says "all numbered segments" and its
  early-game example has 20 open. V1 reads the bull as out.
- Is N fixed for the whole visit? The source says the multiplier is "the
  number of open areas remaining ... at the time of your throw" and that a
  seat's closures lower the count "for subsequent players". V1 fixes N at the
  start of the visit. The alternative lowers it dart by dart.
- Does a ring matter for a hit? The source never says. V1 counts any ring.
- Equal highest totals: V1 reports a tie with no winner and invents no
  tiebreak. The source says players "should agree on a tiebreak method before
  play begins" and gives sudden death as the common one, whose example needs
  "closest to centre" measured. Which method, if any, becomes the tiebreak, and
  should a tied game stay a tie?
- Solo play: the source's setup says one to four, its listing two to four.
- No visit limit: the last few numbers could take many visits. Cap the game,
  or accept as written?
