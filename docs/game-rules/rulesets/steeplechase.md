# Steeplechase

Current version: none (V1 in design)
Entry points: standalone

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Multiplayer (2–4 seats) | V1 | 2+ | |
| More than four seats | Deferred | 2+ | Blocked on: a session seats at most four (`app/src/services/session-seats.service.ts:7`); the source allows up to eight |
| Config screen (presets shown) | V1 | All | |
| Course: the board's clockwise order, 20 then the bull | V1 | All | |
| One advance per visit | V1 | All | |
| Regular segment: only the inner single clears it | V1 | All | |
| Fences at 13, 17, 8 and 5: only the treble clears one | V1 | All | |
| Finish: the inner bull | V1 | All | |
| Out after three visits without clearing the current segment | V1 | All | |
| First seat to hit the finishing bull wins, at once | V1 | All | |
| Ranking by how far each seat got | V1 | All | |
| Adjusted Fences | V2+ | All | Wanted, unscheduled: another fence set is a configuration V1 locks |
| Relaxed Singles | V2+ | All | Wanted, unscheduled: a second clearing rule V1 does not need; it is also the version that keypad capture could play, since it needs no inner/outer single band |
| Adjusted Elimination Threshold | V2+ | All | Wanted, unscheduled: another visit limit is a configuration V1 locks |
| Outer Bull Finish | V2+ | All | Wanted, unscheduled: a second finishing rule V1 does not need |
| First thrower by a throw at the bull | Deferred | 2+ | Blocked on: darts thrown at a target belonging to no leg are a separate capture problem (`501.md` §Features, multiplayer note) |

## Identity

- A race round the board in clockwise order. Seats clear one segment per visit
  — the inner single on most, the treble on four "fences" — and drop out if
  they stall. Source: dolfdarts.com, "Steeplechase"
  (https://dolfdarts.com/games/steeplechase, read 2026-10-12).
- Board scores play no part: only where a dart landed matters. A double never
  clears a segment.
- Multiplayer only. The source lists two to eight players and no solo mode;
  a session seats at most four.

## Tags

| Axis | Tags |
| --- | --- |
| Skill | ACCURACY (primary) |
| Session role | RECREATIONAL |
| Format | ONE_V_ONE, MULTIPLAYER |
| Difficulty | ADVANCED |
| Mechanic | SIMULATION, SEQUENTIAL, ELIMINATION |
| Pressure | PENALTY |
| Family | NOVELTY |

## Objective

**2+:** be the first seat to clear the whole course and hit the inner bull. A
seat that stalls is out; if every seat falls, the one that got furthest ranks
first.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 2 seats (min 2, max 4) | Editable |
| Fences | 13, 17, 8, 5 | Shown, locked |
| Clearing a regular segment | Inner single | Shown, locked |
| Visits allowed per segment | 3 | Shown, locked |
| Finish | Inner bull | Shown, locked |

Seat order is fixed at setup, as 501 (`501.md` §Features); seat 1 throws
first. A new ruleset has no entry in `SEAT_CAPS` and defaults to one seat
(`app/src/services/session-seats.service.ts:91`), so Steeplechase needs an
entry of 4. V1 needs coordinate capture (see Capture).

## How to play

### Course

Every seat runs its own copy of the same course, in this order:
20 → 1 → 18 → 4 → 13 → 6 → 10 → 15 → 2 → 17 → 3 → 19 → 7 → 16 → 8 → 11 → 14 →
9 → 12 → 5, then the inner bull. Each seat's **position** is the segment it
must clear next. Everyone starts on 20.

### Visit

Up to **three darts**, then play passes to the next seat still in. Every dart
is thrown at the seat's current segment.

### Clearing a segment

- **Regular segment** (all but the four fences): a dart in the **inner
  single** clears it. The outer single, double and treble do not.
- **Fence** (13, 17, 8, 5): a dart in the **treble** clears it. No single and
  no double does.
- **Bull:** the inner bull only. The outer bull does not clear it.
- A dart anywhere else clears nothing, and has no other effect.

### One advance per visit

Clearing moves the seat on by one position, no more. The dart that clears ends
the seat's progress for the visit: later darts in that visit, if thrown, do
nothing, and the next segment is first attempted on the seat's next visit.

### Out

- Count each visit that ends without clearing the current segment. The third
  such visit in a row on the same segment puts the seat **out**: it takes no
  more visits, and its position is fixed where it fell.
- A segment cleared on any dart of a visit, the ninth dart included, is
  cleared. The count restarts at zero on the next segment.
- The same limit applies on the bull.

### Ends when

A seat's dart clears the finishing bull; that seat wins and the game ends at
once, with no equalising visits for the seats behind. Or every seat is out.

Play continues while any seat is still in, including a lone seat left after all
others fell: it keeps throwing until it finishes or goes out itself.

### Result

The winner, then every other seat in order of how far it got, with each seat's
position, whether it is out, and the visits it took.

**2+:** ranking is by position reached, furthest first. Two seats out on the
same segment: the one that went out later ranks higher. A winner who finished
ranks first of all. If every seat falls and nobody finishes, the first in that
ranking is the winner. Seats still in when the game ends at a finish rank by
position, with equal positions tied.

## Later versions

### Variants

- **Adjusted Fences** — other fence segments: more (the source suggests adding
  6, 15 and 19) or fewer (13 and 5 only). Agreed before play.
- **Relaxed Singles** — any single, inner or outer, clears a regular segment.
- **Adjusted Elimination Threshold** — a different number of visits before a
  seat is out: two (stricter) or four (more lenient).
- **Outer Bull Finish** — the outer bull also clears the finish.

### Match structure

- More than four seats, once a session can hold them.
- First thrower decided by a throw at the bull; deferred, as 501's.

## Capture

Steeplechase is unbuilt; this is the capture shape its V1 is designed for.

- **Capture / input mode:** ANALYTICS + VISUAL_BOARD, one dart row each. V1
  must tell the inner single from the outer single. Keypad capture records an
  unbanded `SINGLE` and cannot (`app/src/modules/game/types.ts:391-394`);
  coordinate capture always resolves a single to `INNER_SINGLE` or
  `OUTER_SINGLE`. So RECREATIONAL + DETAILED_DARTS (keypad) and QUICK_SCORE
  cannot carry V1; Relaxed Singles is the version that could use keypad.
- **One dart's fact:** intended = **nothing stored** — the target is always the
  seat's current segment, recoverable from its position, so storing it would
  only duplicate. Hit = number and zone where it landed; `score` = the dart's
  **board** score (S20 = 20, T13 = 39, inner bull = 50, miss = 0), never a
  course point.
- **Stage type:** one `EXERCISE_BLOCK` per seat for its whole run — no seat's
  position depends on another seat's darts; only turn order and the race end
  couple them. This is Around the Clock's per-seat ownership
  (`app/src/modules/game/around-the-clock.engine.module.ts:322`). No stage
  opens per segment. Fences, visit limit and finish become part of the
  configuration snapshot once V2+ makes them adjustable; in V1 they are fixed.
- **Derived, never stored:** each seat's position, visits spent on the current
  segment, who is out and when, the winner and the ranking — all folded from
  the dart facts and the turn order against the fixed course.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Course** | V1 | The 20 segments in the board's clockwise order, then the bull |
| **One advance per visit** | V1 | A clear moves a seat on one position; the rest of the visit does nothing |
| **Fences** | V1 | The four segments 13, 17, 8, 5; each cleared by a treble |
| **inner single** | V1 | The wide single bed between the treble ring and the bull rings |
| **Out** | V1 | Three visits in a row without clearing; no more visits |
| **Adjusted Fences** | V2+ | A different fence set |
| **Relaxed Singles** | V2+ | Any single clears a regular segment |
| **Adjusted Elimination Threshold** | V2+ | A different visit limit before a seat is out |
| **Outer Bull Finish** | V2+ | Outer bull also clears the finish |

## Open questions

- Darts after the clearing dart: the source says they are "wasted" yet its
  tips have the player throw them. Are they thrown and recorded as plain
  facts, or does the clearing dart end the visit? Play is identical either way;
  the capture is not.
- A lone seat left after every other seat is out: V1 reads the source as
  letting it play on until it finishes or goes out. Or does it win at once?
- Every seat out with no finisher: the source ranks by progress but names no
  winner. V1 takes the top of that ranking. Confirm.
- Seats still in when a finish ends the game: the source ranks only seats that
  fell. V1 ranks them by position, ties allowed. Confirm.
- The game ends at once on a finish, so seats later in the order get no reply
  visit and the first seat to throw has the edge. Accept as written, or give
  the later seats a closing visit?
- Does VISUAL_BOARD coordinate capture place a dart near the boundary between
  inner and outer single accurately enough to judge a clear? A V1 that leans on
  it needs that answered in the spec.
