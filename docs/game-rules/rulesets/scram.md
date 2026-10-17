# Scram

Current version: none (V1 in design)
Entry points: standalone
Kernel: MARKS

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Two seats (1v1) | V1 | 1v1 | |
| Config screen (presets shown) | V1 | All | |
| Stopper and Scorer roles | V1 | All | |
| Twenty-one targets: 1–20 and the bull | V1 | All | |
| Stopper: one dart on a number, any ring, closes it | V1 | All | |
| Stopper: either bull ring closes the bull | V1 | All | |
| Scorer: a dart on an open target scores its board score | V1 | All | |
| Scorer: a dart on a closed target or a miss scores nothing | V1 | All | |
| Phase ends the moment the last target closes | V1 | All | |
| Two phases, roles swap, fresh board | V1 | All | |
| Higher Scorer total wins | V1 | All | |
| Equal Scorer totals: reported as a tie, no winner | V1 | All | |
| Standard dartboard scoring (assumed) | V1 | All | |
| Scram Cricket (dolfdarts' second page for this same game) | Dropped | All | Decided against as a separate game: its Stopper/Scorer rules, 21 targets and one-hit close are identical to Scram's; only its tiebreak differs (see Tiebreak by a bull throw). Kept so it is not re-proposed as its own file |
| Multi-Mark Scram | V2+ | All | Wanted, unscheduled: several marks to close is a rule switch V1 does not need, and the source gives "two or three" without choosing; its Scram Cricket page names the three-mark form Triple-Close Scram |
| Cricket-Numbers Scram | V2+ | All | Wanted, unscheduled: a shorter target set is a rule switch V1 does not need |
| Quick Scram | V2+ | All | Wanted, unscheduled: closing in ascending order is a rule switch V1 does not need |
| Three-Player Scram | V2+ | 2+ | Wanted, unscheduled: one Stopper and two Scorers needs three seats and a round-by-round winner rule the source states in one line (see Open questions) |
| Team Scram | Deferred | 2+ | Blocked on: a session allows one seat per side; 2v2 is rejected (`app/src/services/session-seats.service.ts:87-88`) |
| Tiebreak phase | Deferred | 1v1 | Blocked on: one extra phase yields one Scorer total, so the source leaves who wins it undefined (see Open questions) |
| Tiebreak by a bull throw | Deferred | 1v1 | Blocked on: "closest to the inner bull" is a measurement, which keypad capture cannot make, and a throw at a target belonging to no leg is a separate capture problem (`501.md` §Features, multiplayer note) |
| Best-of series | V2+ | 1v1 | Wanted, unscheduled: match structure over several full games; V1 plays one game |
| First Stopper by a throw at the bull | Deferred | 1v1 | Blocked on: darts thrown at a target belonging to no leg are a separate capture problem (`501.md` §Features, multiplayer note); V1 sets the first Stopper on the config screen |

## Identity

- Two roles, taken in turn. The **Stopper** shuts numbers; the **Scorer**
  collects points on whatever is still open. Swap roles and play again; the
  better Scorer total wins. Source: dolfdarts.com, "Scram"
  (https://dolfdarts.com/games/scram, read 2026-10-12); also dolfdarts.com,
  "Scram Cricket" (https://dolfdarts.com/games/scram-cricket), the same game
  under a second name.
- Standard dartboard scoring for the Scorer. The Stopper's darts score nothing.
- Close kin of Cricket in spirit (numbers close, closed numbers stop scoring),
  but the roles are separate and sequential, not shared.

## Tags

| Axis | Tags |
| --- | --- |
| Skill | SCORING (primary), ACCURACY |
| Session role | RECREATIONAL |
| Format | ONE_V_ONE, MULTIPLAYER, TEAMS |
| Difficulty | INTERMEDIATE |
| Mechanic | TERRITORIAL |
| Pressure | NONE |
| Family | PUB |

## Objective

**1v1:** post the higher total in your own Scorer phase. Each seat is Scorer
once; only Scorer points count.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 2 seats | Shown, locked |
| First Stopper | Seat 1 (or seat 2) | Editable |
| Targets | 1–20 and the bull | Shown, locked |
| Marks to close | 1 | Shown, locked |
| Phases | 2 | Shown, locked |

A new ruleset has no entry in `SEAT_CAPS` and defaults to one seat
(`app/src/services/session-seats.service.ts:91`); Scram needs an entry of 2
(`:7` holds the global ceiling of 4, one seat per side). The source lets the
player nearest the bull choose a role; V1 sets the first Stopper here instead,
because the bull throw is deferred.

## How to play

### Visit

Up to **three darts**, then play passes to the other seat. Within a phase the
**Stopper** throws a visit, then the **Scorer** throws a visit, and so on; the
Stopper always throws first.

### Stopper

- A dart in a number's segment — single, double or treble — **closes** that
  number at once. One dart is enough.
- Either bull ring closes the bull.
- A dart on an already-closed target, or a miss, does nothing.
- Stopper darts score nothing.

### Scorer

- A dart on a target that is still **open** scores its **board score**:
  single face value, double ×2, treble ×3, outer bull 25, inner bull 50.
- A dart on a closed target scores nothing, and so does a miss.
- Scorer darts never close anything.

### Phase

- A **phase** is one run of the board: all 21 targets start open.
- It ends the moment the Stopper's dart closes the last open target. The rest
  of that Stopper visit is not thrown, and the Scorer does not throw again.
- After phase 1 the seats swap roles, the board is wiped to all open, and
  phase 2 plays the same way.

### Ends when

Phase 2 ends. Nothing else bounds the game; a phase has no visit limit and
lasts until the Stopper has closed everything.

### Result

The winning seat, or a tie. Beside it: each seat's Scorer total, and for each
phase the visits it took and the order the targets closed in.

**1v1:** the seat with the higher Scorer total wins. Equal totals are reported as a
tie with no winner; V1 has no tiebreak.

## Later versions

### Variants

- **Scram Cricket** — not a variant: the source's second page describes the
  same game. Its "Cricket" is only a name; its target set is all 21, the same
  as Scram's. Its own variation "Cricket Scram" is **Cricket-Numbers Scram**.
- **Multi-Mark Scram** — the Stopper needs several marks to close a number
  (a double counts two, a treble three), as Cricket does. The source says "two
  or three" marks; the number is an open question. The source's Scram Cricket
  page names the three-mark form **Triple-Close Scram**.
- **Cricket-Numbers Scram** — only 15, 16, 17, 18, 19, 20 and the bull are in
  play. The phase ends when those seven are closed.
- **Quick Scram** — the Stopper must close in order 1, 2 … 20, then the bull;
  a dart on any other number closes nothing.
- **Three-Player Scram** — one Stopper, two Scorers who compete; three rounds,
  each seat Stopper once. The source's winner rule is "the Scorer with the
  highest single-round total across all rounds".
- **Team Scram** — teams of two or more; teammates alternate visits within a
  phase.

### Match structure

- **Best-of series** — best of three or five full games, alternating who is
  Stopper first.
- **Tiebreak phase** — on equal totals, one more phase, roles by coin flip
  (source: Scram).
- **Tiebreak by a bull throw** — on equal totals, each seat throws one dart at
  the bull; the closer wins, and equal throws repeat (source: Scram Cricket).
- **First Stopper by a throw at the bull** — the player nearest the bull
  chooses their role.

## Capture

Scram is unbuilt; this is the capture shape its V1 is designed for.

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS or
  ANALYTICS + VISUAL_BOARD — a dart's number decides closing and its ring
  decides the Scorer's points, so a visit total alone cannot carry this game
  and QUICK_SCORE cannot.
- **One dart's fact:** intended = **nothing stored** — a Stopper may aim at
  any open number, a Scorer at any open target, so stored intent would be
  invented. Hit = number and ring where it landed; `score` = the dart's
  **board** score (S20 = 20, T20 = 60, outer bull = 25, miss = 0) — a Scorer's
  scoring is that same value or zero, and never a stored points field.
- **Stage type:** one shared `LEG` per phase — a Stopper's dart changes what a
  Scorer's darts count, as 501's `SHARED` leg
  (`app/src/modules/game/five-oh-one.engine.module.ts:428`). A new `LEG` opens
  when a phase ends, so a game has two. One `turns` row per visit, one `darts`
  row per dart. The first Stopper is configuration, copied into the
  session's configuration snapshot.
- **Derived, never stored:** which targets are closed, whether a dart scored,
  each seat's Scorer total, the phase end, the winner.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Stopper and Scorer roles** | V1 | Stopper closes numbers; Scorer scores on open ones; each seat plays both, once |
| **Phase ends the moment the last target closes** | V1 | One run of the board, ending at once on the closing dart |
| **Scram Cricket** | Dropped | The source's second page for this same game; not a variant |
| **Multi-Mark Scram** | V2+ | Several marks to close a number; doubles count two, trebles three |
| **Cricket-Numbers Scram** | V2+ | Only 15–20 and the bull are in play |
| **Quick Scram** | V2+ | Numbers must be closed in ascending order |
| **Three-Player Scram** | V2+ | One Stopper, two competing Scorers |
| **Team Scram** | Deferred | Teams alternate visits |
| **Tiebreak phase** | Deferred | One extra phase on equal totals, roles by coin flip |
| **Tiebreak by a bull throw** | Deferred | One dart at the bull each; closer wins |
| **Best-of series** | V2+ | Several full games |
| **First Stopper by a throw at the bull** | Deferred | Nearest the bull picks the role |

## Open questions

- Equal Scorer totals: V1 reports a tie with no winner and invents no
  tiebreak. The source's first tiebreak, "a single tiebreak phase with a coin
  flip determining roles", leaves one Scorer total and so no comparison — who
  wins it? Its second, the closest dart to the bull (Scram Cricket page), needs
  a measurement. Which, if either, becomes the tiebreak, and should a tied game
  stay a tie?
- Does the phase end mid-visit when the Stopper's dart closes the last target?
  Proposed reading: yes, the remaining darts are not thrown ("The Scorer does
  not throw again once the final number is closed" only covers the Scorer).
- Multi-Mark Scram: two marks or three? The source says "two or three".
- Three-Player Scram: how is "the highest single-round total across all
  rounds" decided if two Scorers tie, and is it one total per round or per
  seat?
- Two dolfdarts pages describe this game. Is the second page's Cricket
  association a hint that the target set is Cricket numbers? Its own text uses
  all 21, so V1 reads the pages as one game.
