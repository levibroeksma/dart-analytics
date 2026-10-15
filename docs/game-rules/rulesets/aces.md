# Aces

Current version: none (V1 in design)
Entry points: standalone

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Two-seat match (1v1) | V1 | 1v1 | |
| Doubles or more than two seats | Deferred | 2+ | Blocked on: teams are unsupported — "Only one seat per side is supported; 2v2 is not implemented yet" (`app/src/services/session-seats.service.ts:87-88`); the source's setup says two players while its metadata says 2–4 |
| Config screen (presets shown) | V1 | All | |
| Opening throw: closest to the bull serves first | V1 | 1v1 | |
| Point: server's visit, then receiver's visit | V1 | 1v1 | |
| Ace: server's first dart in any double or either bull wins the point | V1 | 1v1 | |
| Half: Left or Right set of numbers, alternating every point | V1 | All | |
| Server must land a dart in the half with one of the first two darts | V1 | 1v1 | |
| Bull counts 2 in a total | V1 | All | |
| Receiver must beat the server's Target (the visit total) | V1 | 1v1 | |
| Tied totals: the server throws again for a new target | V1 | 1v1 | |
| Game: Love, 15, 30, 40, Game | V1 | All | |
| Deuce and Advantage: win by two points | V1 | All | |
| Serve passes to the other seat after each game | V1 | 1v1 | |
| Set: first to 4 games | V1 | All | |
| Tiebreak at 3–3 in games: first to 7 points, win by 2 | V1 | All | |
| Match of 1, 3 or 5 sets (default 1) | V1 | All | |
| Adjustable points per game and games per set | V2+ | All | Wanted, unscheduled: the source leaves match length to local agreement; V1 fixes 4 points and 4 games |
| Standard dartboard scoring (assumed, except the bull) | V1 | All | |

## Identity

- A tennis-style service game: the server needs a first-dart Ace or a total
  the receiver cannot beat, and every bull is worth 2 in the totals. Source:
  dolfdarts.com, "Aces" (https://dolfdarts.com/games/aces, read 2026-10-12).
- It is its own game, not a Tennis Darts variant. The source calls itself "a
  distinctive, standalone dart game", and it differs from `tennis-darts.md`
  in the Ace set (bulls count), the bull's value, the tied-total rule (a
  rethrow, not a server win), the server's duty to hit the half, and in
  totals that are not restricted to the half.
- Where the source is silent, the rule below says "user decision 2026-10-12".
  Those rules are the user's, not the source's. The source gives no match
  format ("players should agree on the match format"), so the whole of Game,
  Set, Tiebreak and Match is user decision 2026-10-12.

## Tags

| Axis | Tags |
| --- | --- |
| Skill | SCORING (primary), DOUBLES |
| Session role | RECREATIONAL |
| Format | ONE_V_ONE, MULTIPLAYER, TEAMS |
| Difficulty | INTERMEDIATE |
| Mechanic | SIMULATION |
| Pressure | NONE |
| Family | NOVELTY |

## Objective

**1v1:** win the set by taking four games (a tiebreak decides it at 3–3 in
games); win the match by taking the majority of the configured sets. A session
seats exactly two: the service allows at most four seats, one per side, and
rejects teams (`app/src/services/session-seats.service.ts:7`, `:87-88`).

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 2 seats (min 2, max 2) | Shown, locked |
| First server | Seat that won the opening throw | Editable |
| Sets | 1 (allowed: 1, 3, 5) | Editable |
| Games per set | First to 4 | Shown, locked |
| Tiebreak | At 3–3 in games; first to 7, win by 2 | Shown, locked |
| Bull value in a total | 2 | Shown, locked |
| Halves | Left: 5, 12, 9, 14, 11, 8, 16, 7, 19. Right: 1, 18, 4, 13, 6, 10, 15, 2, 17 | Shown, locked |

Sets default to 1 and may be 1, 3 or 5 (user decision 2026-10-12); a best-of-N
match is won by the first seat to take (N+1)/2 sets. A new ruleset seats one
player until it has an entry in `SEAT_CAPS`
(`app/src/services/session-seats.service.ts:19`, read at `:91` with `?? 1`),
and the service's own minimum is one seat (`:6`), so V1 needs an entry of 2
and a two-seat minimum enforced for this game.

## How to play

### The halves

The board is split into two **halves**. 20, 3 and the bull belong to neither.

- **Left:** 5, 12, 9, 14, 11, 8, 16, 7, 19.
- **Right:** 1, 18, 4, 13, 6, 10, 15, 2, 17.

A dart is *in* a half when it lands in any ring (single, double or treble) of
one of that half's numbers.

The first point of every service game is on the Left, and the half switches
after every point (source). In a tiebreak the half also switches after every
point, starting Left (reading; see Open questions). A tied point that is
thrown again (see below) stays on the same half; the half switches only once a
point is decided.

### A point

Two visits, server first. Each is up to three darts.

1. **Ace.** If the server's **first** dart lands in any double, the outer
   bull or the inner bull, the server wins the point at once and the receiver
   does not throw. Any double counts, in or out of the current half.
2. **Reaching the half.** Otherwise the server must land a dart in the current
   half with one of the **first two** darts. If neither is in it, the receiver
   wins the point without throwing. If one is, the server throws the rest of
   the visit.
3. **Server's total.** The sum of all the server's darts at standard values
   (single face value, double twice, treble three times), except that **any
   bull counts 2**, outer or inner. The source does not limit the total to the
   half: every dart counts, even one off-half (see Open questions). This is
   the **target**.
4. **Receiver.** Throws three darts anywhere on the board and totals them the
   same way, bull = 2. The receiver has no half to reach and cannot score an
   Ace.
5. **Winner.** A receiver total **higher** than the target wins the point for
   the receiver; a **lower** one wins it for the server.
6. **Tied totals.** The point is not decided. The server throws again for a
   new target and the receiver responds, as often as it takes to break the
   tie. The rethrow is a fresh point start: an Ace, the half rule and the
   totals all apply again (the source's tip says the server "get[s] another
   chance at an ace"; see Open questions).

Example: Left half, the server throws S14, T11, outer bull. The first dart is
in the half and no double, so no Ace; the target is 14 + 33 + 2 = 49. The
receiver needs 50 or more.

### Game

A game is won by the first seat to **four points**, provided it leads by two.
Points read Love (0), 15, 30, 40, Game. At 40–40 the game is at **Deuce**. The
seat that wins the next point has **Advantage**; if it wins the following
point it takes the game, and if it loses it the game is back at Deuce
(user decision 2026-10-12).

The **serve** passes to the other seat after each game.

### Set and tiebreak

A set is won by the first seat to four games. At 3–3 in games the set is
decided by a **tiebreak** and ends 4–3.

In the tiebreak:

- points are counted 1, 2, 3, … (not Love, 15, 30);
- the first seat to **7** points wins it, but must lead by **2**;
- each point is a single serve, and the server alternates every point;
- the first server is the seat that was due to serve the next game (reading;
  see Open questions).

The tiebreak counts as one game for the serve: the seat that did not serve its
first point serves the first game of the next set (reading; see Open
questions). All of this is user decision 2026-10-12.

### Match

1, 3 or 5 sets by config; the first seat to take the majority wins.

### Opening throw

Before play each seat throws one dart at the bull; the dart **closest to the
bull** earns the first serve. The throw is made off the record and its winner
is picked as the **First server** on the config screen. The source gives no
tie rule (see Open questions).

### Ends when

A seat has won the configured majority of sets; the match ends immediately.

### Result

Winner, set score (and each set's games), games and points won per seat,
aces, defaults (points lost by missing the half), and tied points thrown
again.

## Later versions

### Variants

- None. The source documents no named variation: "players may adjust the match
  length (number of points per game, games per set, or total sets)", which the
  V1 config covers for sets only.

### Match structure

- **Doubles or more than two seats** — the source's metadata says 2–4 players,
  its setup says two. Blocked on teams being unsupported
  (`app/src/services/session-seats.service.ts:87-88`).
- Games per set and points per game are fixed in V1; the source leaves both to
  local agreement.

## Capture

Aces is unbuilt; this is the capture shape its V1 is designed for.

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS or
  ANALYTICS + VISUAL_BOARD — an Ace is judged on the first dart's ring, the
  half rule on each of the first two darts' numbers, and the bull's value on
  its ring; none of that survives in a visit total, so QUICK_SCORE cannot
  carry this game.
- **One dart's fact:** intended = **nothing stored** — the aim is free (a
  double or the bull for an Ace, then any number in the half), and the half is
  recoverable from the point's position in the game. Hit = number and ring
  where it landed; `score` = the dart's **board** score (S14 = 14, T11 = 33,
  outer bull = 25, inner bull = 50, miss = 0), never the bull's value of 2.
- **Stage type:** a shared stage, as 501's `SHARED` leg
  (`app/src/modules/game/five-oh-one.engine.module.ts:428`) — the receiver's
  visit is judged against the server's target. A new stage would open for each
  game, a tiebreak being one (see Open questions).
- **Derived, never stored:** each visit's total (bull = 2), the target, who
  won the point, whether it was an Ace or a default, the game, set and match
  score, the current half, the server, Deuce and Advantage, and the winner.
  The opening-throw darts are not recorded and the config carries only the
  First server.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Half** | V1 | The Left or Right set of nine numbers; 20, 3 and the bull are in neither |
| **Ace** | V1 | The server's first dart in any double or either bull: the server wins the point at once |
| **Target** | V1 | The server's visit total, which the receiver must beat |
| **Deuce** | V1 | 40–40 in a game; win by two points from here |
| **Advantage** | V1 | The seat that won the point after Deuce; one more point wins the game |
| **Tiebreak** | V1 | The decider at 3–3 in games: first to 7 points, win by 2 |
| **Opening throw** | V1 | One dart each at the bull; the closest serves first |

## Open questions

- Do off-half darts count toward the totals? The source restricts only the
  server's first two darts to the half and tallies "all remaining darts", so V1
  counts every dart. Tennis Darts scores only in-half darts; the two games
  differ here on purpose, by user decision.
- Must an Ace double be in the current half? The rule text says any double; a
  tip says "a double in the active play area". V1 reads any double.
- If both of the server's first two darts miss the half, is the third dart
  thrown? Proposed reading: no — the point is lost at that moment.
- Does a rethrow after a tie restart the whole point (Ace, half rule, totals)?
  Proposed reading: yes, per the source's tip about another chance at an ace.
- Opening throw tie: the source gives no tie rule. Proposed reading: both
  throw again.
- Opening throw capture: "closest to the bull" is a distance, which a dart row
  (number, ring) cannot hold, and the throw belongs to no game — the capture
  problem `501.md` (§Features, multiplayer note) and `gotcha.md` defer. V1 reads
  it as played off the record, with the winner entered as First server
  (accepted by controller ruling 2026-10-12; differs from `gotcha.md`, which
  defers the throw).
- First tiebreak server: the user decision gives the alternation but not who
  starts. Proposed reading: the seat due to serve the next game.
- Who serves the first game after a tiebreak? Proposed reading: the tiebreak
  counts as one game, so the seat that did not serve its first point serves
  next.
- Halves in a tiebreak: proposed reading: alternate every point, starting Left.
- Receiver's darts: the source's tip says the half restriction "applies only to
  the server", so V1 lets the receiver throw anywhere. Confirm.
- Stage granularity: one shared stage per game, or one for the whole match? A
  design choice for the spec, not a rule.
