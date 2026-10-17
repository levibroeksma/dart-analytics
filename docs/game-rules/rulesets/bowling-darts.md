# Bowling Darts

Current version: none (V1 in design)
Entry points: standalone
Kernel: VISIT_POINTS

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Multiplayer (2–4 seats) | V1 | 2+ | |
| More than four seats | Deferred | 2+ | Blocked on: a session seats at most four (`app/src/services/session-seats.service.ts:7`); the source allows up to eight |
| Config screen (presets shown) | V1 | All | |
| Alley number: one number, 1–20, agreed before play | V1 | All | |
| Pin values: triple 10, double 9, inner single 7, outer single 3, any other dart a Gutter at 0 | V1 | All | |
| Rack: ten pins and at most two darts | V1 | All | |
| Strike: the first dart of a rack in the triple | V1 | All | |
| Spare: the two darts of a rack reach 10 pins | V1 | All | |
| Pin cap: the second dart of a rack knocks down only the pins still standing | V1 | All | |
| Same-single-segment ban within a rack | V1 | All | |
| Ten frames | V1 | All | |
| Tenth frame: bonus darts, each on a fresh rack | V1 | All | |
| Strike and spare bonus scoring | V1 | All | |
| Win: highest total after ten frames | V1 | 2+ | |
| Tie-break frame: tied leaders throw extra frames until one leads | V1 | 2+ | |
| Multi-game series | V2+ | 2+ | Wanted, unscheduled: the source leaves a series (best of three, or cumulative score) to agreement; V1 plays one game |
| First thrower by a throw at the bull | Deferred | 2+ | Blocked on: darts thrown at a target belonging to no game are a separate capture problem (`501.md` §Multiplayer, as implemented) |

## Identity

- Ten-pin bowling on a dartboard: ten frames, strikes, spares, a perfect game
  of 300. All scoring happens inside one agreed number's segments. Source:
  dolfdarts.com, "Bowling Darts" (https://dolfdarts.com/games/bowling-darts,
  read 2026-10-12).
- Board scoring is **not** used. Each dart is worth a pin value, set by the
  zone of the alley number it lands in (below).
- Rulings the source does not make were settled by user decision 2026-10-12
  and are marked as such.

## Tags

| Axis | Tags |
| --- | --- |
| Skill | ACCURACY (primary) |
| Session role | RECREATIONAL |
| Format | ONE_V_ONE, MULTIPLAYER |
| Difficulty | INTERMEDIATE |
| Mechanic | SIMULATION, ACCUMULATION |
| Pressure | NONE |
| Family | NOVELTY |

## Objective

**2+:** have the highest total after ten frames. Every seat bowls all ten;
the highest total wins; a tie for the highest total is played off in extra
frames.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 2 seats (min 2, max 4) | Editable |
| Alley number | None; one must be picked (1–20) | Editable |
| Frames | 10 | Shown, locked |
| Pin values | T 10, D 9, inner single 7, outer single 3 | Shown, locked |

Seat order is fixed at setup; seat 1 throws first in every frame. The source
agrees the alley number "before play begins" and gives it no default, so V1
asks for a pick. The alley is one number for the whole game and for every seat.

A new ruleset has no entry in `SEAT_CAPS`, so a session seats one player until
one is added (`app/src/services/session-seats.service.ts:91`); the four-seat
cap above is the file-wide ceiling (`:7`).

## How to play

### Pin values

Only darts in the alley number score. The zone decides the pins:

| Dart lands in | Pins |
| --- | --- |
| Treble of the alley number | 10 |
| Double of the alley number | 9 |
| Inner single (between the treble ring and the bull) | 7 |
| Outer single (between the treble ring and the double ring) | 3 |
| Any other number, the bull, or off the board (a **gutter**) | 0 |

### Rack and frame

A **rack** is a set of ten pins that takes at most two darts. In frames 1 to 9
a frame is one rack. Seats bowl in order: each seat throws its whole frame,
then the next seat does, and every seat has bowled frame 1 before any seat
bowls frame 2.

- **First dart.** Pins knocked down = the dart's pin value. A treble is a
  **strike**: the frame ends at once, with no second dart.
- **Second dart** (any other first dart, gutters included). Its pin value is
  **capped** at the pins still standing: at most 10 minus the first dart's
  pins. User decision 2026-10-12: the source defines a spare only as exactly 10
  and leaves a total above 10 undefined. Example: a double (9) then an inner
  single (7) counts the second dart as 1 pin, and the rack totals 10.
- **Spare.** A rack whose two darts total 10 pins after the cap. Any second
  dart that reaches the cap makes the spare, a treble included (a gutter
  then a treble is a spare, not a strike: a strike is the first dart only).
- **Open frame.** Fewer than 10 pins after two darts.

### Same single segment

Within one rack a seat cannot score the same single band twice: if both darts
land in the inner single, or both in the outer single, the second counts 0
(source: "a player cannot score the same single segment twice in one frame").
The ban takes precedence over the cap, and it names single bands only: a
double followed by a double is not banned, and counts as capped. An inner
single and an outer single in one rack are fine and make a spare (7 + 3).
The ban runs per rack, not per frame (see the tenth frame).

### Scoring

- **Open frame:** the sum of its two darts' pins.
- **Strike:** 10 plus the pins of the seat's next two darts.
- **Spare:** 10 plus the pins of the seat's next dart.

"Pins of a dart" is the pin value as counted after the cap and the ban. The
next darts may fall in the following frame, so a strike or spare frame's score
is known only once those darts are thrown.

Worked example, alley 17: treble 17 is frame 1, a strike. Outer single (3)
then inner single (7) is frame 2, a spare. Outer single (3) then a gutter is
frame 3, an open frame of 3. Frame 1 scores 10 + 3 + 7 = 20, frame 2 scores
10 + 3 = 13, frame 3 scores 3: running total 36.

### Tenth frame

A seat's tenth frame keeps going while it keeps clearing racks. After a strike
or a spare a **fresh rack of ten** is set, and the cap and the same-single
ban start over on that rack.

- Dart 1 is the first dart of rack 1.
- **After a strike on dart 1:** dart 2 is the first dart of a fresh rack. If it
  is a treble (strike), dart 3 is again the first dart of a fresh rack.
  Otherwise dart 3 is the second dart of dart 2's rack: capped at 10 minus
  dart 2's pins, and banned from repeating dart 2's single band.
- **After a spare on darts 1 and 2:** dart 3 is the first dart of a fresh rack.
- **Open frame on darts 1 and 2:** the frame ends; no bonus dart.

The tenth frame is therefore two or three darts, and its score is the sum of
the pins its darts counted. Its strikes and spares need no later darts.

### Ends when

Every seat has finished its tenth frame, and the highest total is held by
one seat. If two or more seats share the highest total, the **tie-break
frame** rule below runs first. Highest possible total is 300 (twelve strikes).

### Tie-break frame

User decision 2026-10-12 (the source says "an additional tiebreaker frame (or
series of frames) until the tie is broken" and does not say how that frame
scores): only the seats tied for the highest total throw. Each throws one frame
as in frames 1 to 9 (a strike ends it; otherwise two darts, with the cap and
the ban), in seat order. Its score is the pins knocked down, at most 10, with
no bonus darts. The seat with the most pins in that frame leads. A strike and a
spare are both 10 pins. If two or more seats are level on the top frame score,
only those seats throw another frame, and so on until one seat leads. That
seat wins.

### Result

The winner, every seat's final total, each frame's marks (strike, spare, pins),
and the tie-break frames thrown, if any.

## Later versions

### Variants

- **Multi-game series** — several games in a row, "best of 3 games, or highest
  cumulative score across 3 games"; the source leaves the format to agreement.

### Match structure

- **First thrower by a throw at the bull** — the closest dart to the bull
  throws first, as the source has it. V1 uses seat order.
- **More than four seats** — the source allows eight.

## Capture

Bowling Darts is unbuilt; this is the capture shape its V1 is designed for.

- **Capture / input mode:** ANALYTICS + VISUAL_BOARD only. A pin value depends
  on the inner single against the outer single, and the keypad
  (RECREATIONAL + DETAILED_DARTS) writes the unbanded `SINGLE` zone because it
  has no coordinate and cannot know its band
  (`docs/architecture/05-Database/06-Spec/01-Reference-Layer.md:335`, `:336-337`;
  zones seeded in `database/seeds/0006_single_band_dart_zones.sql:23`, `:30`).
  QUICK_SCORE cannot carry the game either: a visit total says nothing of the
  racks inside it. `app/src/lib/game/rulesets/capabilities.ts` declares each
  ruleset's pairs; this one has no entry yet.
- **One dart's fact:** intended = **nothing stored** (free aim; the alley
  number is a game setting, not a per-dart choice). Hit = the number and zone
  where it landed (`INNER_SINGLE`, `OUTER_SINGLE`, `DOUBLE`, `TREBLE`, a bull,
  or `MISS`); `score` = the dart's **board** score (T17 = 51, outer single 17 =
  17, a miss = 0). The pin value is derived, never stored.
- **Stage type:** one `EXERCISE_BLOCK` per seat for the whole game
  (`PER_SEAT`, as `app/src/modules/game/cricket.engine.module.ts:134`): seats
  never affect each other's pins. A frame and a rack are derived from the dart
  order (a strike frame has one dart), not stages.
- **Derived, never stored:** each dart's pin value after the cap and the ban,
  rack boundaries, frame marks, bonus scoring, running totals, the highest
  total and the tie-break outcome.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Alley number** | V1 | The one number, 1–20, whose segments score for the whole game |
| **Gutter** | V1 | Any dart outside the alley number: 0 pins |
| **Rack** | V1 | Ten pins and at most two darts; a fresh one is set after a strike or spare in the tenth frame |
| **Strike** | V1 | The first dart of a rack in the treble; ends the frame |
| **Spare** | V1 | A rack whose two darts reach 10 pins after the cap |
| **Pin cap** | V1 | The second dart of a rack knocks down at most the pins still standing |
| **Same-single-segment ban** | V1 | A second dart in the same single band as the first, in one rack, counts 0 |
| **Tie-break frame** | V1 | An extra single frame thrown by the seats tied for the highest total |
| **Multi-game series** | V2+ | Several games in a row decided by wins or cumulative score |
| **First thrower by a throw at the bull** | Deferred | Closest dart to the bull throws first |

## Open questions

- Does the same-single-segment ban reach doubles? V1 reads the source's "same
  single segment" literally, so only the inner or outer single is banned and a
  double followed by a double is capped, not banned (D9 then D9 is a spare).
  The source's stated purpose, preventing "easily manufactured spares", could
  argue for banning it too.
- Is the alley number pre-selected on the config screen, or must the player
  pick one? The source gives no default.
- Solo play: the source's minimum is two players. A one-seat game (a score
  attack to 300) is not offered in V1. Wanted?
- The cap lowers a dart's counted pins, and strike and spare bonuses use the
  counted value (a strike followed by a double then an inner single bonuses
  9 + 1). The source never defines bonus darts under a cap; confirm this
  reading.
