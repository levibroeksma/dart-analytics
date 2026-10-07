# Killer

Current version: none (V1 in design)
Entry points: standalone

## Features

Version and `Applies to` vocabulary: see `../templates/GAME_RULESET_TEMPLATE.md`.

| Feature | Version | Applies to | Reason |
| --- | --- | --- | --- |
| Multiplayer (2–4 seats) | V1 | 2+ | |
| More than four seats | Deferred | 2+ | Blocked on: a session seats at most four (`app/src/services/session-seats.service.ts:7`); the source calls 3–8 best and allows up to 20 |
| Config screen (presets shown) | V1 | All | |
| Seat numbers: one per seat, 1–20, no two alike, set at setup | V1 | All | |
| Number by a weak-hand throw | Deferred | 2+ | Blocked on: darts thrown at a target belonging to no leg are a separate capture problem (`501.md` §Features, multiplayer note), and the app cannot tell which hand threw |
| Three lives | V1 | All | |
| Only doubles count | V1 | All | |
| Become a Killer: hit your own double | V1 | All | |
| A Killer's hit on another seat's double takes one life | V1 | All | |
| Non-Killer hits on other doubles do nothing | V1 | All | |
| A Killer's hit on their own double loses Killer status | V1 | All | |
| Out at zero lives | V1 | All | |
| Last seat standing wins | V1 | All | |
| Self-hit life penalty | V2+ | All | Wanted, unscheduled: a house rule on top of the status loss, not needed to play |
| Blind Killer | V2+ | 2+ | Wanted, unscheduled: secret numbers need hidden information on one shared device |
| 5-Lives Killer | V2+ | All | Wanted, unscheduled: a starting count is a configuration V1 locks |
| Team Killer | Deferred | 2+ | Blocked on: a session allows one seat per side; 2v2 is rejected (`app/src/services/session-seats.service.ts:86`) |
| Killer Cricket | V2+ | All | Wanted, unscheduled: three hits on your own number to become a Killer is a rule switch V1 does not need |
| Standard dartboard scoring (assumed) | V1 | All | |

## Identity

- Each seat owns a number. Hit your own double to become a **Killer**, then
  hit other seats' doubles to take their lives. Source: dolfdarts.com,
  "Killer" (https://dolfdarts.com/games/killer, read 2026-10-07).
- The game uses the doubles ring only; singles, trebles and the bull do
  nothing. Board scores play no part.

## Objective

**2+:** be the last seat with a life left.

## Config & presets

| Setting | Preset | On config screen |
| --- | --- | --- |
| Players | 2 seats (min 2, max 4) | Editable |
| Seat numbers | Chosen per seat, 1–20, no two alike | Editable |
| Lives | 3 | Shown, locked |

Seat order is fixed at setup, as 501 (`501.md` §Features); seat 1 throws
first. The source draws numbers by a non-dominant-hand throw ("If two players
hit the same number, the second player re-throws"); V1 sets them on the config
screen instead.

## How to play

### Visit

Up to **three darts**, then play passes to the next seat still in.

### Becoming a Killer

- Hit **your own double** to become a Killer.
- "Players who haven't yet become Killers cannot eliminate anyone." A
  non-Killer's dart in another seat's double does nothing.

### Taking lives

- A Killer's dart in another seat's double takes one life: "Each hit on
  another player's double removes one of their three lives." Any seat still
  in is a target, Killer or not.
- A dart in the double of a seat already out does nothing.
- A Killer's dart in their own double loses Killer status; it is re-earned by
  hitting that double again.
- **Out** at zero lives: the seat throws no more darts.

### Ends when

One seat has a life left; it wins.

### Result

Winner, the order seats went out, lives each seat took, and the darts each
took to become a Killer.

## Later versions

### Variants

- **Self-hit life penalty** — a Killer hitting their own double also loses a
  life.
- **Blind Killer** — numbers drawn secretly, "from a hat".
- **5-Lives Killer** — five lives instead of three.
- **Killer Cricket** — "players must close their number (three hits) before
  becoming a Killer, rather than hitting a single double."

### Match structure

- **Team Killer** — teams compete; teammates' doubles are safe.
- More than four seats, once a session can hold them.

## Capture

Killer is unbuilt; this is the capture shape its V1 is designed for.

- **Capture / input mode:** RECREATIONAL + DETAILED_DARTS and
  ANALYTICS + VISUAL_BOARD — whose double a dart hit decides everything, so
  QUICK_SCORE cannot carry this game.
- **One dart's fact:** intended = **nothing stored** — any opponent's double,
  or your own, is a legitimate aim. Hit = number and zone where it landed;
  `score` = the dart's **board** score.
- **Seat numbers** are setup configuration, copied into the session's
  configuration snapshot with the seat list (`composeSeatFacts`,
  `app/src/services/session-seats.service.ts:106`).
- **Stage type:** one shared stage for the game — a dart changes another
  seat's lives, as 501's `SHARED` leg
  (`app/src/modules/game/five-oh-one.engine.module.ts:286`).
- **Derived, never stored:** Killer status, lives per seat, who is out, the
  winner.

## Glossary

| Term | Version | Meaning |
| --- | --- | --- |
| **Seat numbers** | V1 | The number each seat owns; its double is the seat's target |
| **Killer** | V1 | A seat that has hit its own double and may take lives |
| **Out** | V1 | Zero lives; no more darts |
| **Self-hit life penalty** | V2+ | A life lost for hitting your own double as a Killer |
| **Blind Killer** | V2+ | Secret numbers |
| **5-Lives Killer** | V2+ | Five lives each |
| **Team Killer** | Deferred | Teams; teammates' doubles safe |
| **Killer Cricket** | V2+ | Three hits on your own number to become a Killer |

## Open questions

- A seat that becomes a Killer on dart 1 or 2: may the visit's remaining
  darts take lives? The source does not say.
- A non-Killer hitting their own double twice in one visit: Killer on the
  first, status lost on the second? The source's two rules meet here.
- Seat numbers: player-chosen (V1 proposal) or a random draw on the config
  screen?
