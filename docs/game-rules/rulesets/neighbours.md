# Neighbours

Current version: none (V1 in design)
Entry points: standalone

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Single player (darts-to-finish personal best) | V1 | Single | |
| Multiplayer (2–4 seats) | V1 | 2+ | |
| More than four seats | Deferred | 2+ | Blocked on: a session seats at most four (`app/src/services/session-seats.service.ts:7`); the source allows six |
| Config screen (presets shown) | V1 | All | |
| Scorecard of 23 targets (1–20, Red Bull, Green Bull, Triple 20) | V1 | All | |
| Any order: a hit on an open number marks it | V1 | All | |
| Double bonus: a Double on an open number also marks one open neighbour of your choice | V1 | All | |
| Triple bonus: a Triple on an open number also marks both open neighbours | V1 | All | |
| Strict repeats: a hit on a marked number confers nothing | V1 | All | |
| Triple 20 target: any Triple 20 satisfies it | V1 | All | |
| Red Bull: retrieve the dart, 2 extra throws, mark 2 open numbers of your choice | V1 | All | |
| Green Bull: retrieve the dart, 1 extra throw, mark 1 open number of your choice | V1 | All | |
| Visit = 3 darts plus bull extra throws | V1 | All | |
| Win: first seat with all 23 targets | V1 | 2+ | |
| Finish: all 23 targets; the result is darts thrown | V1 | Single | |
| Handicap Mode | V2+ | 2+ | Wanted, unscheduled: a per-seat advantage set at config, and the source's relaxed-adjacency half is ambiguous (see Open questions) |
| Strict-Bull Mode | V2+ | All | Wanted, unscheduled: a second bull rule set V1 does not need |
| Team Mode | Deferred | 2+ | Blocked on: a session allows one seat per side (`app/src/services/session-seats.service.ts:87-88`) |
| First thrower by a throw at the bull | Deferred | 2+ | Blocked on: darts thrown at a target belonging to no leg are a separate capture problem (`501.md` §Features, multiplayer note) |
| Standard dartboard scoring (assumed) | V1 | All | |

## Identity

- Around the Clock with the order set free, plus a bonus for aiming at
  segments that sit beside open ones: Doubles and Triples spill onto the
  neighbours on the board. Source: dolfdarts.com, "Neighbours"
  (https://dolfdarts.com/games/neighbours, read 2026-10-12).
- Standard dartboard layout. Nothing here scores points: the scorecard is 23
  yes/no targets.

## Objective

**2+:** be the first seat to mark all **23** targets: the numbers 1–20, Red
Bull, Green Bull and Triple 20.

**Single:** mark all 23 targets in as few darts as you can.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 1 seat (min 1, max 4) | Editable |
| Targets | 23: 1–20, Red Bull, Green Bull, Triple 20 | Shown, locked |
| Repeats | Strict: a marked number confers nothing | Shown, locked |
| Bull rule | Retrieve the dart; Red Bull +2 throws and 2 picks, Green Bull +1 throw and 1 pick | Shown, locked |

Seat order is fixed at setup, as 501 (`501.md` §Features); seat 1 throws
first. Every seat keeps its own scorecard; nothing one seat throws changes
another's. No ruleset of this game is in the seat-cap table yet, so until it is
added (`app/src/services/session-seats.service.ts:19-33`; unlisted default `:91`)
a session seats one.

## How to play

Neighbours of a number are the two segments either side of it on the board.
Clockwise from the top: 20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8,
11, 14, 9, 12, 5, and back to 20 (5 and 20 are neighbours). A number is **open**
until it is marked.

### Visit

Three darts, thrown one at a time; each dart resolves before the next. A visit
may grow: a bull hit gives extra throws (below). The visit ends when its throws
are used up, or at once when the seat marks its last target.

### Each dart

A dart is judged by where it lands. Off the board or a miss: nothing.

- **Single** of a number: marks it if open; nothing if already marked.
- **Double** of an open number: marks it, then the player chooses one **open**
  neighbour and marks that too. If neither neighbour is open, no bonus. A
  Double of a marked number confers nothing: no mark, no bonus.
- **Triple** of an open number: marks it and marks each neighbour that is open.
  A Triple of a marked number confers nothing.
- **Triple 20** also satisfies the Triple 20 target, whether or not 20 is
  already marked. If 20 is open it behaves as a Triple of 20 (marks 20, and 1
  and 5 when open). If 20 is already marked it satisfies the target only, with
  no neighbour marks.
- **Red Bull** (inner bull): marks the Red Bull target. The dart is retrieved
  and the seat gets **2 extra throws** this visit; it also picks any 2 open
  numbers from 1–20 and marks them. If fewer than 2 are open it picks what
  remains.
- **Green Bull** (outer bull): marks the Green Bull target. The dart is
  retrieved and the seat gets **1 extra throw** this visit; it also picks any 1
  open number from 1–20 and marks it. If none is open, the extra throw still
  comes with no pick.

Bull picks come only from the numbers 1–20; they never mark the other bull or
the Triple 20 target. Those three targets are marked only by hitting them.

A bull hit whose target is already marked pays in the same way (see Open
questions). Extra throws are thrown like any other dart, so a bull among them
earns more.

### Ends when

A seat marks its 23rd target; it wins at once and any darts it has left are not
thrown. The other seats do not take the rest of that round.

**2+:** a seat that completes its card first by throwing order wins; no other
seat can have completed it, because play stops at the first.

**Single:** the one seat throws until all 23 are marked.

### Result

Winner (2+) or darts thrown (Single), beside each seat's targets marked.

## Later versions

### Variants

- **Handicap Mode** — the weaker seat starts with Red Bull, Green Bull and
  Triple 20 already marked. It may also claim a Double's or Triple's neighbour
  bonus when that neighbour is already marked (the "only if open" limit is
  lifted for it). A Double or Triple of an already-marked number still confers
  nothing for any seat.
- **Strict-Bull Mode** — the bulls still make their picks (2 for Red Bull, 1
  for Green Bull) but the dart is not retrieved, so no extra throw.

**2+:** Handicap Mode needs two or more seats to have a "weaker" seat.

### Match structure

- **Team Mode** — two teams alternate throws; targets and bonuses accrue to
  the team. Waits on teams.
- More than four seats, and the first thrower decided by a throw at the bull.

## Capture

Neighbours is unbuilt; this is the capture shape its V1 is designed for.

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS (a row per dart,
  including extra throws). The game needs the ring of each hit (Single, Double,
  Triple, outer bull, inner bull); inner versus outer single is irrelevant, so
  keypad capture is enough. ANALYTICS + VISUAL_BOARD records the same darts
  with coordinates.
- **One dart's fact:** intended = **nothing stored**: any open number is a
  valid aim, so recording one would invent an intent. Hit = the number and
  ring that landed; `score` = the dart's **board** score (S19 = 19, T14 = 42,
  outer bull = 25, inner bull = 50, miss = 0), never a game mark.
- **Stage type:** one `EXERCISE_BLOCK` per seat for the whole game; stage
  ownership `PER_SEAT`, as Around the Clock's
  (`app/src/modules/game/around-the-clock.engine.module.ts:322`). A card is
  per seat, so nothing is shared.
- **Derived, never stored:** which targets are marked, darts thrown, the
  throws left in a visit, and the winner, all folded from the darts in order.
- **The unstored choice:** a Double's neighbour pick and both bulls' number
  picks are player decisions, and no dart or turn row holds one: a dart row
  carries only its intended and hit target, zone and score
  (`database/migrations/0006_runtime_events.sql:43-57`) and a turn row only its
  sequence and total (`:24-33`). A pick cannot be folded from the darts. A Triple's
  marks and a Double with one open neighbour can; a Double with two open
  neighbours and any bull pick with more open numbers than picks cannot. V1
  is not playable until the spec names where a pick lives (see Open
  questions).

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Scorecard of 23 targets** | V1 | The 20 numbers, Red Bull, Green Bull and Triple 20; each marked or open |
| **Double bonus** | V1 | A Double on an open number also marks one open neighbour the player picks |
| **Triple bonus** | V1 | A Triple on an open number also marks both open neighbours |
| **Strict repeats** | V1 | A Single, Double or Triple of a marked number confers nothing |
| **Triple 20 target** | V1 | Satisfied by any Triple 20, whether or not 20 is marked |
| **Red Bull** | V1 | The inner bull: retrieve the dart, 2 extra throws, 2 picks |
| **Green Bull** | V1 | The outer bull: retrieve the dart, 1 extra throw, 1 pick |
| **Handicap Mode** | V2+ | The weaker seat starts with the bulls and Triple 20 marked, and may claim already-marked neighbours |
| **Strict-Bull Mode** | V2+ | Bulls make their picks but the dart is not retrieved |
| **Team Mode** | Deferred | Teams alternate and share one card; waits on teams |

## Open questions

- **Where does a pick live?** A Double's neighbour choice and the bulls'
  number picks have no `darts` or `turns` column (see Capture). The spec must
  name a home, or V1 cannot persist a card.
- **Does a bull pay when its target is already marked?** The source's table
  gives the bulls no "already marked" outcome; V1 reads it as paying every time
  (extra throws and picks), since the picks are the bulls' main use.
- **Do bonus throws earn bonus throws?** The source does not say a bull among
  the extra throws is excluded; V1 reads it as paying.
- **Red Bull "2 extra throws":** the source says one additional dart "so 2
  extra throws total counting the retrieved one", and its tip calls it a
  five-dart turn. V1 reads it as 2 more throws than the visit would have had.
- **Does the game stop at once when a seat completes?** The source also says
  that if two seats finish in the same round, the one who completed first
  within the turn wins. V1 stops play at the first completion, which gives the
  same winner.
- **Single: how are darts counted?** The source counts "darts required". V1
  reads it as every throw, so a retrieved bull dart that is thrown again counts
  twice.
- **Handicap Mode:** a Double or Triple marks neighbours "only if open", so a
  relaxed limit that lets the weaker seat "claim" an already-marked neighbour
  changes nothing on the card. What did the source intend?
