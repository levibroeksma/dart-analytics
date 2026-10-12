# Follow the Leader

Current version: none (V1 in design)
Entry points: standalone

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Multiplayer (2–4 seats) | V1 | 2+ | |
| More than four seats | Deferred | 2+ | Blocked on: a session seats at most four (`app/src/services/session-seats.service.ts:7`); the source allows up to ten |
| Team play | Deferred | 2+ | Blocked on: a session allows one seat per side; teams are rejected (`app/src/services/session-seats.service.ts:87-88`) |
| Config screen (presets shown) | V1 | All | |
| Opening dart: seat 1 throws one off-hand dart that sets the first target | V1 | All | |
| First thrower by a throw at the bull | Deferred | 2+ | Blocked on: darts thrown at a target belonging to no leg are a separate capture problem (`501.md` §Features, multiplayer note); V1 opens on seat 1 |
| Setting dart: a dart that sets the target; if it lands off the board it is thrown again | V1 | All | |
| Exact bed: a match needs the same number, the same ring, and for the bull the same bull | V1 | All | |
| Match visit: a seat other than the leader throws up to three darts at the target | V1 | 2+ | |
| Spare dart: a matcher may use the darts left after a match to set a new target; the last dart thrown counts | V1 | 2+ | |
| Off-board last dart: the matcher loses a life and the previous target stands | V1 | 2+ | |
| Leader: the seat whose dart set the current target | V1 | 2+ | |
| Leader's turn: one normal-hand dart sets the new target | V1 | 2+ | |
| Keep: if every other seat failed, the leader may leave the target as it is without throwing | V1 | 2+ | |
| Three lives; a failed match costs one | V1 | 2+ | |
| Out at zero lives; last seat standing wins | V1 | 2+ | |
| Standard dartboard scoring (assumed) | V1 | All | |
| Number-Only Matching | V2+ | 2+ | Wanted, unscheduled: a second match rule — any ring of the number counts — V1 does not need to play the game |
| Five Lives | V2+ | 2+ | Wanted, unscheduled: a life count is a setting V1 locks at three |
| Off-Hand Target Setting Throughout | V2+ | 2+ | Wanted, unscheduled: the app records no hand (see Capture), so it can only be an on-screen instruction; V1 asks for the off hand on the opening dart only |
| HORSE | V2+ | 2+ | Wanted, unscheduled: five letters in place of three lives, a third-dart match that earns a fresh set of darts to set with, and six bed types that tell the inner single from the outer; telling the singles apart needs coordinate capture, because the keypad records an unbanded `SINGLE` (`app/src/modules/game/types.ts:390-394`) |
| Loop | V2+ | 2+ | Wanted, unscheduled: targets restricted to the numbers with a looped digit, setting darts re-thrown until they qualify, a match by number, and a tie clause of its own (see Open questions); a second target set and a second match rule |
| Big 6 | V2+ | 2+ | Wanted, unscheduled: a different hand-off — the seat that has just thrown always sets the next target with one dart, hit or miss — so there is no leader, no keep and no spare-dart set; V1 would have to carry two hand-off rules |

## Identity

- A chase: one seat sets a target on the board, every other seat must hit
  that exact bed or lose a life, and three lives is all anyone has. The last
  seat with a life left wins. Source: dolfdarts.com, "Follow the Leader"
  (https://dolfdarts.com/games/follow-the-leader, scraped copy read
  2026-10-12).
- Standard dartboard geometry. No score is kept: the board only decides
  whether a dart matched.
- Where the source is silent, the rule below is marked "user decision
  2026-10-12".

## Objective

**2+:** be the last seat with a life left. The source says any number of
players but lists three as its minimum and "most enjoyable with 3 or more";
this ruleset seats two to four (see Open questions). A session seats at most
four (`app/src/services/session-seats.service.ts:7`).

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 2 seats (min 2, max 4) | Editable |
| Lives per seat | 3 | Shown, locked |
| Match rule | Exact bed | Shown, locked |
| Opening dart | Seat 1, off hand | Shown, locked |
| Variant | Follow the Leader; Number-Only Matching, Five Lives, Off-Hand Target Setting Throughout, HORSE, Loop, Big 6 (V2+) | Editable (V2+) |

Seat order is fixed at setup, as 501 (`501.md` §Features); seat 1 opens and
the order never changes. A new ruleset allows one seat until it gets an entry
in `SEAT_CAPS` (`app/src/services/session-seats.service.ts:19`, default of 1 at
`:91`), so V1 multiplayer needs that entry.

## How to play

### The target and the leader

The **target** is an **exact bed**: a number and a ring (single, double,
treble) or one of the two bulls. A dart matches only if it lands in that same
bed: if the target is treble 18, single 18 and double 18 do not match; if it is
the outer bull, the inner bull does not match, and the other way round. Both
single beds of a number are the one "single" ring here (see Open questions).

The **leader** is the seat whose dart set the current target. A matcher who
stops after a match without setting a new target does not become leader: the
leader stays what they were (user decision 2026-10-12; the source is
silent).

A dart that lands off the board scores no bed. A **setting dart** is any dart
that is thrown to set the target. A setting dart that lands off the board
does not set a target; what follows depends on which setting dart it is, below.

### Opening

Seat 1 throws one dart with the off hand (left hand for a right-handed
thrower, right for a left-handed one). Where it lands is the first target and
seat 1 is the first leader. If it lands off the board it is thrown again,
until it lands on the board (user decision 2026-10-12; the source is silent).
The off hand applies to this dart only. Play then passes to seat 2.

### Match visit

Seats rotate in seat order, skipping any seat that is out. A seat that is not
the leader throws up to three darts at the target and may stop after a match.

- **Fail:** none of its darts matched. It loses one life. The target and the
  leader do not change.
- **Match, then stop:** a dart matched and the seat throws no more. It loses
  nothing. The target and the leader do not change.
- **Match, then spare darts:** after the matching dart the seat may throw some
  or all of the darts it has left — **spare darts** — to set a new target. It
  may stop after any spare dart; the last dart it threw is the setting dart.
  If that dart lands on the board its bed is the new target and this seat is
  the new leader. A match on the third dart leaves no spare dart.
- **Last dart off the board:** if the last dart the seat threw lands off the
  board, it loses one life whatever its other darts did, and the previous
  target and the previous leader stand. This holds whether the seat never hit
  the target or hit it and then threw spare darts (source).

### Leader's turn

When the rotation reaches the leader, the leader does not match: it sets.
It throws **one** dart with the normal hand. Where it lands is the new target,
and the leader stays leader (user decision 2026-10-12; the source is silent).
If the dart lands off the board it is thrown again until it lands on the board
(user decision 2026-10-12; the source is silent).

**Keep:** if every other seat still in the game failed since the leader's
setting dart — or since the leader's last keep — the leader may instead leave
the target as it is and throw nothing (source, "Leader's privilege"). It may
do this again after the next pass, if again every seat failed. If even one
other seat matched, the leader cannot keep and must throw its one dart.

After the leader's turn play passes to the next seat in order, which
matches against the (new or kept) target.

### Out

A seat that loses its third life is out. It takes no more turns and play
skips it. A leader never loses a life while it is leader, because it only sets,
so a seat going out is always a matcher. The last seat with a life left wins at
once; no further visit is thrown.

### Ends when

Exactly one seat has a life left. Nothing else bounds the game.

### Result

The winner, the order seats went out, and each seat's lives left (the winner's
count included). **2+:** a lone survivor is guaranteed by the elimination
format, so no tie occurs.

## Later versions

### Variants

- **Number-Only Matching** — a dart matches if it lands anywhere in the
  target's number, single, double or treble; it is a much easier game, meant
  for newer or younger players. Selectable on the config screen once it ships.
- **Five Lives** — every seat starts on five lives instead of three, meant to
  give a long game for a large group. Selectable on the config screen.
- **Off-Hand Target Setting Throughout** — every setting dart, not only the
  opening one, is thrown with the off hand. An on-screen instruction, as the
  app does not see the hand.
- **HORSE** — the same chase with the lives replaced by the five letters
  H-O-R-S-E: a fail costs the next letter, and the fifth letter is out. The
  setting rules differ: a setter may throw up to three darts (a matcher, the
  darts it has left), and the last dart thrown is the target; a seat that
  matches on its third dart gets a fresh set of three to set the new target. A target is one of six bed types: small single, large single, double,
  treble, outer bull, inner bull. Shorter words (PIG or CAT for three letters,
  DART for four) shrink the letter count. A "Called Shot" form requires the
  setter to call the bed before throwing and sets no target if it is missed.
  Source: dolfdarts.com, "HORSE" (https://dolfdarts.com/games/horse, scraped
  copy read 2026-10-12).
- **Loop** — the same chase, with every target restricted to a number with a
  looped digit (4, 6, 8, 9, 10, 14, 16, 18, 19, 20). The opening dart and every
  setting dart is thrown with the off hand and re-thrown until it lands on such
  a number. A match is by number unless ring-specific targeting is chosen. A
  leader whose every opponent failed may keep the target, or set a new one with
  the off hand. Source: dolfdarts.com, "Loop"
  (https://dolfdarts.com/games/loop, scraped copy read 2026-10-12).
- **Big 6** — the seat that has just thrown always sets the next target with
  one dart, whether or not it matched: a match with at least one of up to three
  darts costs nothing, a miss costs a life, and either way the seat then
  throws one dart that sets the target for the next seat. There is no leader and
  no keep. The source's optional restriction to the six premium beds (treble
  and double 20, 19, 18) is a further switch. Source: dolfdarts.com, "Big 6"
  (https://dolfdarts.com/games/big-6, scraped copy read 2026-10-12).

**2+:** every variant above needs at least two seats; HORSE, Loop and Big 6
each have the same seat count as the base game.

### Match structure

- More than four seats, once a session can hold them.
- Team play, once a session accepts more than one seat per side.
- First thrower decided by a throw at the bull, deferred as 501's.

## Capture

Follow the Leader is unbuilt; this is the capture shape its V1 is designed for.

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS and
  ANALYTICS + VISUAL_BOARD — whether a dart matched is read off its number and
  ring, so QUICK_SCORE visit totals cannot carry this game. The keypad is
  enough: the exact bed needs the number, the ring and, for the bull, which
  bull (`OUTER_BULL` or `INNER_BULL`), and V1 treats both single beds as one
  ring so the keypad's unbanded `SINGLE` is sufficient
  (`app/src/modules/game/types.ts:390-403`). HORSE (V2+) does not have that
  luxury.
- **One dart's fact:** intended = **nothing stored** — a setting dart is free
  aim, and a matching dart aims at the current target, which is recoverable
  from the earlier darts. Hit = the number and zone where it landed, including
  `MISS` for a dart off the board, so a re-thrown setting dart keeps its dart
  row; `score` = the dart's **board** score (T18 = 54, outer bull = 25) —
  never lives, never a match flag. The dart rows carry no hand, so the off-hand
  opening dart is an instruction the players keep, not a fact the record holds.
- **Turn facts:** the leader's decision to keep is a decision, not a dart. A
  keep is a turn with no dart rows, and `turns` has no column to say so
  (`database/migrations/0006_runtime_events.sql:24-34`) and neither has `darts`
  (`:43-65`), so a build would add one in the configuration snapshot or a
  new column (a schema change needs a numbered migration). The spec must settle
  how a keep is recorded before implementation.
- **Stage type:** one shared stage for the game — every seat's darts decide a
  target the others face, as 501's `SHARED` leg
  (`app/src/modules/game/five-oh-one.engine.module.ts:428`).
- **Derived, never stored:** the current target, the leader, lives per seat,
  who is out, whether the leader may keep, the winner — folded from the dart
  facts in order: darts before a seat's first match are match darts; darts
  after it are spare darts.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Target** | V1 | The bed every seat but the leader must hit; set by a setting dart |
| **Exact bed** | V1 | A match needs the same number and the same ring; at the bull, the same bull |
| **Setting dart** | V1 | A dart thrown to set the target: the opening dart, a leader's one dart, or a matcher's last spare dart; thrown again while off the board for the first two |
| **Spare dart** | V1 | A dart a matcher has left after a match; may be thrown to set a new target |
| **Leader** | V1 | The seat whose dart set the current target |
| **Keep** | V1 | The leader leaves the target unchanged without throwing, allowed only if every other seat failed |
| **Out** | V1 | Zero lives; no more turns |
| **Number-Only Matching** | V2+ | Any ring of the target's number matches |
| **Five Lives** | V2+ | Five lives per seat instead of three |
| **Off-Hand Target Setting Throughout** | V2+ | Every setting dart thrown with the off hand |
| **HORSE** | V2+ | Letters H-O-R-S-E instead of lives; a setter may throw up to three darts (a matcher, those it has left), last dart is the target; third-dart match earns a fresh set |
| **Loop** | V2+ | Targets limited to numbers with a looped digit; setting darts off-handed and re-thrown until valid |
| **Big 6** | V2+ | The seat that has just thrown always sets the next target with one dart; no leader |

## Open questions

- Player count: the source metadata lists a minimum of three and its setup says
  any number is possible but three or more is "strongly recommended". V1
  allows two seats. Is that the right minimum?
- Single beds: the source says a target is "the exact ring (single, double, or
  triple)", with no mention of the inner and outer single beds. V1 reads
  "single" as one ring, so either single bed matches. HORSE tells them apart.
  Is that reading right?
- Off the board: does a dart that sticks in the rim or the surround, scoring
  nothing, count as "off the board"? V1 reads it as yes, as a bounce-out or a
  miss of the board.
- A matcher who throws a spare dart that lands in the same bed as the current
  target: V1 reads it as a new setting, so the matcher becomes the leader of the
  same target. The source does not say.
- A matcher who matched and then threw spare darts whose last dart lands off the
  board loses a life, as the source says "regardless of earlier throws". V1
  reads this as covering a seat that had already matched. Is that intended?
- Loop: the source says if two seats remain and both lose their last life in
  the same round, the one who threw earlier is out first. Sequential play makes
  that unreachable; what was meant?
