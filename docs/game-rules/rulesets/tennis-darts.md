# Tennis Darts

Current version: none (V1 in design)
Entry points: standalone

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Two-seat match (1v1) | V1 | 1v1 | |
| Doubles (2v2) | Deferred | 2+ | Blocked on: teams are unsupported — "Only one seat per side is supported; 2v2 is not implemented yet" (`app/src/services/session-seats.service.ts:87-88`); the source also plays 2 or 4 players, never 3 |
| Config screen (presets shown) | V1 | All | |
| Opening throw: highest single dart serves first | V1 | 1v1 | |
| Point: server's visit, then receiver's visit | V1 | 1v1 | |
| Ace: server's first dart in any double wins the point | V1 | 1v1 | |
| Half: Left or Right set of numbers, alternating every point | V1 | All | |
| Only darts in the current half score | V1 | All | |
| Receiver must beat the server's total; a tie goes to the server | V1 | 1v1 | |
| Game: Love, 15, 30, 40, Game | V1 | All | |
| Deuce and Advantage: win by two points | V1 | All | |
| Serve passes to the other seat after each game | V1 | 1v1 | |
| Set: first to 4 games | V1 | All | |
| Tiebreak at 3–3 in games: first to 7 points, win by 2 | V1 | All | |
| Match of 1, 3 or 5 sets (default 1) | V1 | All | |
| No-Ace Variant | V2+ | All | Wanted, unscheduled: the source's softer serve (a first-dart double scores like any dart); V1 plays the source default |
| Standard dartboard scoring (assumed) | V1 | All | |

## Identity

- Tennis scoring on the dartboard: the server posts a total, the receiver has
  to beat it, and points build into games, sets and a match. Source:
  dolfdarts.com, "Tennis Darts" (https://dolfdarts.com/games/tennis-darts,
  read 2026-10-12).
- Standard dartboard scoring, except that only darts in the current half of
  the board score.
- Where the source is silent, the rule below says "user decision 2026-10-12".
  Those rules are the user's, not the source's.

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
| Ace | On | Shown, locked |
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
one of that half's numbers. The source's own sides are described only as the
"left-hand" and "right-hand" halves; the lists above are the ones the Aces
source names (`aces.md`), adopted here by user decision 2026-10-12.

The first point of every service game is on the Left, and the half switches
after every point (user decision 2026-10-12). In a tiebreak the half also
switches after every point, starting Left (reading; see Open questions).

### A point

Two visits, server first. Each is up to three darts at the current half.

1. **Server.** If the server's **first** dart lands in any double (any
   number, in or out of the current half), that is an **Ace**: the server wins
   the point at once and the receiver does not throw. The bulls are not
   doubles of a number; see Open questions.
2. Otherwise the server throws all three darts. The server's total is the sum
   of the darts that are in the current half, at standard values (single face
   value, double twice, treble three times). Any dart not in the half scores
   0: a dart on 20, 3 or the bull, on the other half, or a miss (user decision
   2026-10-12).
3. **Receiver.** Throws three darts at the same half, totalled the same way.
   The receiver cannot score an Ace.
4. **Winner.** The receiver wins the point with a total **higher** than the
   server's. An equal or lower total wins it for the server, so a server total
   of 0 is beaten by any scoring dart, and 0–0 goes to the server.

Example: Left half, the server throws S14, T11, S20 — the 20 is off-half, so
the total is 14 + 33 + 0 = 47. The receiver needs 48 or more from Left
numbers.

### Game

A game is won by the first seat to **four points**, provided it leads by two.
Points read Love (0), 15, 30, 40, Game. At 40–40 the game is at **Deuce**.
The seat that wins the next point has **Advantage**; if it wins the following
point it takes the game, and if it loses it the game is back at Deuce. The
half keeps alternating through Deuce and Advantage points.

The **serve** passes to the other seat after each game. The seat serving
first in the opening game is the winner of the opening throw.

### Set and tiebreak

A set is won by the first seat to four games. At 3–3 in games the set is
decided by a **tiebreak** and ends 4–3.

In the tiebreak:

- points are counted 1, 2, 3, … (not Love, 15, 30);
- the first seat to **7** points wins it, but must lead by **2** (user
  decision 2026-10-12);
- each point is a single serve, and the server alternates every point (source:
  "alternating single serves (one point per service turn, alternating server
  each point)");
- the first server is the seat that was due to serve the next game
  (reading; see Open questions).

The tiebreak counts as one game for the serve: the seat that did not serve its
first point serves the first game of the next set (reading; see Open
questions).

### Match

1, 3 or 5 sets by config; the first seat to take the majority wins.

### Opening throw

Before play each seat throws one dart at the board; the higher single-dart
board score serves first. A tie on that throw is thrown again (reading; see
Open questions). The throw is made off the record and its winner is picked as
the **First server** on the config screen.

### Ends when

A seat has won the configured majority of sets; the match ends immediately.

### Result

Winner, set score (and each set's games), games and points won per seat,
aces, and each seat's points won on serve and on return.

## Later versions

### Variants

- **No-Ace Variant** — "a double on the server's first dart does not
  automatically win the point"; all three darts are thrown and totalled as
  usual.

### Match structure

- **Doubles (2v2)** — four players in two teams; "Teammates alternate as the
  thrower within their team's turn". Blocked on teams being unsupported
  (`app/src/services/session-seats.service.ts:87-88`). The source has no
  3-player form.
- The source calls best-of-3 "recommended for competitive pub play" and
  best-of-5 "suited to tournament finals"; both are selectable in V1.

## Capture

Tennis Darts is unbuilt; this is the capture shape its V1 is designed for.

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS or
  ANALYTICS + VISUAL_BOARD — an Ace is judged on the first dart's ring and a
  dart scores only if its number is in the half, neither of which a visit
  total can express, so QUICK_SCORE cannot carry this game.
- **One dart's fact:** intended = **nothing stored** — the aim is free (a
  double for an Ace, or any number in the half), and the half is recoverable
  from the point's position in the game. Hit = number and ring where it
  landed; `score` = the dart's **board** score (S14 = 14, T11 = 33, outer bull
  = 25, miss = 0), never the half-restricted point value. An off-half dart
  keeps its board score and simply does not count.
- **Stage type:** a shared stage, as 501's `SHARED` leg
  (`app/src/modules/game/five-oh-one.engine.module.ts:428`) — each seat's
  visit is judged against the other's total. A new stage would open for each
  game, a tiebreak being one (see Open questions).
- **Derived, never stored:** each visit's half-restricted total, who won the
  point, the game, set and match score, the current half, the server, Deuce
  and Advantage, aces, and the winner. The opening-throw darts are not
  recorded and the config carries only the First server.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Half** | V1 | The Left or Right set of nine numbers; 20, 3 and the bull are in neither |
| **Ace** | V1 | The server's first dart in any double: the server wins the point at once |
| **Deuce** | V1 | 40–40 in a game; win by two points from here |
| **Advantage** | V1 | The seat that won the point after Deuce; one more point wins the game |
| **Tiebreak** | V1 | The decider at 3–3 in games: first to 7 points, win by 2 |
| **Opening throw** | V1 | One dart each; the higher board score serves first |
| **No-Ace Variant** | V2+ | A first-dart double scores like any dart; no instant point |

## Open questions

- Opening throw tie: the source gives no tie rule. Proposed reading: both
  throw again.
- Opening throw capture: the throw belongs to no game, the same capture
  problem `501.md` (§Features, multiplayer note) and `gotcha.md` defer. V1
  here reads it as played off the record, with the winner entered as First
  server (accepted by controller ruling 2026-10-12; differs from
  `gotcha.md`, which defers the throw).
- Are the bulls doubles for the Ace? The source lists "any double segment" and
  scores the inner bull separately. Proposed reading: no — an Ace is a double
  ring of a number 1–20.
- First tiebreak server: the source gives the alternation but not who starts.
  Proposed reading: the seat due to serve the next game.
- Who serves the first game after a tiebreak? The source rotates service
  "after each completed game". Proposed reading: the tiebreak counts as one
  game, so the seat that did not serve its first point serves next.
- Halves in a tiebreak: the source alternates "for each new point" but names no
  start. Proposed reading: alternate every point, starting Left.
- The halves are named in the Aces source, not this one. Adopted by user
  decision; confirm that Tennis Darts's "left-hand" and "right-hand" halves
  are meant to be the same nine numbers each.
- Stage granularity: one shared stage per game, or one for the whole match? A
  design choice for the spec, not a rule.
