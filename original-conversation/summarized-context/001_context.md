# Context Summary — Prompts 1–10

**Handoff note:** This documents the architectural research and design decisions established during the initial brainstorming phase for a darts performance analytics platform backed by Neon (PostgreSQL).

---

## Project Scope

Personal darts scoring application in active development. Primary goal is **long-term player progression tracking** — not just storing game results, but enabling rich computed statistics over months and years.

**Current game engines (4):**

| Engine                  | Key configuration                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **501**                 | Legs/sets (default 3 legs; sets = 5 legs/set), double out; solo, vs guest, or vs DartBot                                              |
| **TUOD** (10-up-1-down) | Starting target 41; +10 on 3-dart finish, −1 on miss; fixed rounds (default 10) or timed (5–30 min)                                   |
| **Score training**      | Rounds or timed (same pattern as TUOD)                                                                                                |
| **Singles training**    | Order: high→low, low→high, random; modes: normal (3 darts/target), hard (1 mandatory hit, 3 misses = out), extreme (2 mandatory hits) |

Opponent detail is irrelevant for personal stats; only **won/lost** matters. More game types will be added.

**Tech stack:** Astro.js, TypeScript, Alpine.js. Proxy API (`src/pages/api`) communicates with Neon. Client-side API calls with skeleton-first hydration. Hosted on Netlify free tier; considering Cloudflare (DB in EU, Netlify US).

**Operator constraints:** Solo developer. Optimize for low operational complexity, PostgreSQL best practices, and extensibility without frequent migrations.

---

## Architectural Positioning

The application is a **performance analytics platform** where scoring generates data — not merely a scoring app. Design optimizes for analytical integrity first.

**Core design goals:**

- Historical correctness (old games never change)
- Extensibility (new game types without monthly migrations)
- Fast statistics via views, not raw-table queries
- Replayability from stored facts alone

---

## Data Model Philosophy

### Store facts, compute metrics

- **Facts:** individual darts, visits, legs/rounds, session events
- **State:** current game position (e.g. TUOD current target) — stored, not recalculated
- **Statistics:** averages, percentages, trends — derived via SQL views; never stored in transactional tables

### Granularity: every individual dart

Confirmed. A dart is the atomic immutable event. Enables first-9 average, bed accuracy, miss patterns, checkout routes, sequence analysis, heat maps, and future AI coaching. Storage cost is negligible at personal scale.

### Dart representation

Store **intended target** and **actual hit** (segment + multiplier), not just score. Score is derived. Analytical attributes (miss direction: inside/outside/left/right/high/low) are nullable — populated only when captured.

### Schema pattern: generic session + typed details

Rejected: one table per game type, pure JSONB primary model.

Adopted: central `game_sessions` table with game-specific detail tables where needed. Enables cross-game timeline, unified API endpoints, and simpler future game additions.

### Hierarchy

```
GameType → GameSession (+ immutable configuration snapshot) → Phase → Visit → Dart
```

**Phase** is intentionally generic: leg (501), round (TUOD/Score training), target/round (Singles training).

### Session lifecycle

Persist **all started sessions**, not only completed ones. Status: `IN_PROGRESS`, `COMPLETED`, `ABANDONED`, `CRASHED`. Supports resume, crash recovery, and optional exclusion from stats.

### Replayability

Confirmed requirement: given only the database, any recorded session must be fully reconstructible — every visit, score change, checkout attempt, bust, and state transition.

### Configuration immutability

Each session stores a **full configuration snapshot** at start. Rules are **expanded**, not versioned — new capabilities added for future sessions; production configurations remain unchanged. Sessions are self-contained for replay and analytics.

---

## Data Capture Model

**Data Capture Mode** (enum, independent of game type):

| Mode         | Use case    | Data captured                                               |
| ------------ | ----------- | ----------------------------------------------------------- |
| **Quick**    | Casual play | Minimum needed to score                                     |
| **Standard** | Default     | Every dart that hits the board                              |
| **Analysis** | Coaching    | Intended target, actual hit, miss direction, optional notes |

Not a boolean "training" flag — fidelity is decoupled from game type (e.g. serious league match may use Analysis; casual TUOD may use Quick).

**Input methods** (UI adapter layer, one canonical DB model):

- **Recreational:** current calculator-style visit score entry (e.g. `76`) — valid historical record with intentionally limited analytics
- **Analytics:** per-dart segment entry (single/double/treble + number); modal for miss direction on mismatches
- **Future:** board tap, camera recognition

Metadata per session: `input_method` (QUICK_SCORE | DART_ENTRY | BOARD | CAMERA), `capture_fidelity` (QUICK | STANDARD | ANALYSIS).

Unavailable metrics in low-fidelity sessions are **unknown**, not zero.

---

## Identity & Future Scale

**Today:** One account = one player. No multiple profiles per account.

**Schema separation:** `users` (auth) distinct from `players` (gameplay data) — 1:1 now, preserves clean boundaries for OAuth/subscriptions later.

**Future expansion (not in scope now):** Online multiplayer (D), clubs/teams (E), tournaments/leagues (F). Achieved via relationships between players, not multi-player data within one account.

---

## Statistics Requirements (confirmed wishlist)

Traditional: 3-dart average, first-9, checkout %, double hit %, 180s/140+/tons, highest checkout, win rate vs DartBot, rolling averages, monthly improvement.

Advanced / sequence-based: worst doubles/singles, recovery after bad dart, switch accuracy after hitting inside double, inside vs outside misses, left vs right misses, checkout dart position (1st/2nd/3rd), miss heatmaps, preferred checkout routes, clutch performance.

All derivable from dart-level facts + nullable analytical fields when captured.

---

## Layered Architecture

```
Level 1 — Immutable facts     sessions, darts, visits, legs/rounds, configuration
Level 2 — Derived views       averages, checkout %, miss tendencies, progression
Level 3 — Materialized views  dashboard summaries, leaderboards (optional, for expensive queries)
```

API sits above views. Raw tables are never queried directly for stats in production paths.

**Entity layers:**

```
Identity:   users, players
Catalog:    game_types, game_modes, capture_modes
Gameplay:   game_sessions, session_configurations, legs, rounds, visits, darts
Analysis:   views, materialized views
Future:     clubs, teams, matches, tournaments
```

---

## UI Gap (current → target)

**Current:** Calculator-style visit score entry (e.g. `76` for S20+Bull+D3). Loses dart order, individual throws, miss data, and sequence analytics.

**Target:** Dart as primary input unit. UI computes visit score and remaining automatically. Quick entry retained for recreational sessions via input translator → canonical dart records (with appropriate fidelity).

---

## Next Design Phase (agreed sequence)

1. Conceptual ERD
2. Logical schema (3NF, selective denormalization where justified)
3. Physical schema for Neon/PostgreSQL (types, indexes, views)
4. Analytics layer specification
5. API contract (Astro proxy ↔ Neon)
