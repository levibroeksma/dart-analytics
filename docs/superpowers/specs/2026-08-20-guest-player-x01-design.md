# Guest Player & Multi-Seat X01 — Architecture Design

> **Date:** 2026-08-20
> **Status:** approved (brainstorming consensus)
> **Scope:** The generic seat layer every game engine will eventually adopt, plus its first wiring into X01 (`501_V1`) under both mode pairs — RECREATIONAL + QUICK_SCORE and ANALYTICS + VISUAL_BOARD. Covers the engine contract, the fact model, the session-create contract, the store, error handling and tests. Architecture first: this is the design, the drawing specs follow.
> **Out of scope:** frontend page/component drawing specs (next task), DartBot, 2v2 pairing, bull-up, reusable guest rosters, per-participant capture depth, wiring the seven non-X01 engines.

---

## Context

The database is already multiplayer-ready and has been since P26–30 (D08). `participants` hangs off `exercise_sessions` with `participant_type_id` ∈ {`PLAYER`, `GUEST`, `DARTBOT`}, a frozen `display_name`, and a nullable `player_id`; `turns.participant_id` is a real FK; and `validateBatchReferences` in `session.service.ts` already rejects a `participantRef` that is not a participant of the session it is uploaded to.

What is not multiplayer-ready is everything above the schema:

- `session.service.ts` mints exactly one `PLAYER` participant per session and `CreateSessionRequest` has no way to ask for more — the additive `participants[]` D61 deferred.
- `TurnFact` carries no participant. `buildEventsBatch(participantRef, facts)` takes one ref and stamps it onto every turn in the batch, so a session's whole log necessarily belongs to one identity.
- No engine has a concept of whose throw it is. `FiveOhOneState` mixes three scopes in one flat object: `remainingScore` (per player), `legsWon` (per side), `status` (per session).
- Nothing anywhere models a side, a seat, or a throw rota.

So this design changes the application layer and leaves the schema alone. **No migration is required.**

**Decisions made during brainstorming:**

- **Scope:** design the seat layer generically now, wire `501_V1` first (Q1/C). Every game reaches 1v1 eventually; only X01 reaches 2v2.
- **Guest identity:** ephemeral (Q2/A). A guest is a `participants` row with a typed name and nothing else — no cross-session identity, no new table. This is what the DB spec already says a guest is: "only outcome relevance is required, not account creation."
- **Throw order:** fixed seat order chosen at setup; the *starting* seat rotates each leg, over seats rather than sides (Q3/B). Bull-up is noted as a later, separate capture problem.
- **Capture depth:** uniform across participants — the session's one capture mode applies to everybody (Q4/A). Per-participant depth (one-sided capture, e.g. tracking only yourself during a tournament) is a plausible future variant and is deliberately not hooked for.
- **Seat count:** 1–4 seats, sized so 2v2 slots in with no state change (Q5/C).
- **Device model:** pass-and-play on one device. No realtime sync, no second client.

---

## Domain Model

### Participant

Unchanged. A `participants` row owned by the exercise session, typed `PLAYER` / `GUEST` / `DARTBOT`, carrying a `display_name` frozen at write time so replay labels never depend on later profile edits. Server-minted at session create.

### Seat

The ordered position a participant occupies in the throw rota. **Not a new table.** A seat is an entry in the session's configuration snapshot, written at create time from the participant ids the server has just minted:

```jsonc
"seats": [
  { "participantRef": "…", "displayName": "Levi", "sideKey": "A" }, // seat 0
  { "participantRef": "…", "displayName": "Dad",  "sideKey": "B" }  // seat 1
]
```

`exercise_configurations.configuration` is already the immutable "how this game was configured" record, already written in the same transaction as the participants. Putting seats there keeps the session self-describing — replay needs nothing outside the runtime layer — at zero schema cost.

Seat *order* is gameplay-relevant and therefore stored. The *active* seat is derived and never stored, per the runtime layer's existing rule that the current stage is never stored.

### Side

What wins a leg and the match. `sideKey` groups seats. v1 writes one side per seat (`"A"`, `"B"`, …); a future 2v2 writes two seats per side. Every X01 win condition folds per side from day one, so 2v2 requires no state change — only a setup screen that assigns two seats to one side, and the removal of the guard in §Error Handling that currently rejects that shape.

Non-X01 games always write exactly one seat per side.

### Rota

`app/src/modules/game/seat-rota.module.ts` — a new shared module of pure functions over the fact log plus the seat list. It stores nothing:

- `activeSeat(facts, seats, stageOwnership)` — whose throw it is
- `startingSeatFor(legIndex, seatCount)` — `legIndex % seatCount`
- `seatOf(turn, seats)` — resolves a turn's `participantRef` to its seat

### Stage ownership

Two stage shapes exist across the roster, and the rota must serve both. The engine declares which it has:

- **`SHARED`** — one stage instance holds every seat's turns, interleaved. A leg in X01: one `LEG` stage, and a checkout ends it for all seats at once.
- **`PER_SEAT`** — one stage instance per seat per round. Everything else: seat 2's round 4 is not seat 1's round 4.

This declaration is the reason a composition design (a wrapper delegating to N single-seat engines) was rejected: under `SHARED`, each sub-engine would mint its own `leg-N` stage, producing N legs in the merged log where the board saw one, and a checkout in one sub-engine could not reset another's remaining score.

### Identifier

Facts carry `participantRef` — not a separate seat id. One identifier, matching the existing API field name and the `turns.participant_id` column it lands in. Seat index is derived by position in `seats[]`.

---

## Engine Contract

Pattern 18 survives intact. `record · undo · wouldComplete · isComplete · state · facts` all keep their signatures. Three changes to the shared layer:

### 1. `TurnFact` gains `participantRef: string`

The engine mints it, exactly as it already mints `clientKey`, `sequence` and `completedAt`. `buildEventsBatch` loses its `participantRef` parameter and reads the fact instead.

### 2. Engines declare stage ownership

Statically, beside `rulesetVersionKey`:

```ts
readonly stageOwnership: "SHARED" | "PER_SEAT";
```

`501_V1` declares `SHARED`. Every other engine declares `PER_SEAT` when it is wired for 1v1; until then the declaration is inert, because a one-seat session behaves identically under either value.

### 3. A `MultiSeatState` base interface

```ts
type MultiSeatState = {
  activeParticipantRef: string;
  seats: readonly { participantRef: string; sideKey: string }[];
};
```

Any seat-aware `TState` extends it. This is what lets one generic scoreboard component render any game. `state()` still returns `TState` — no new contract method, no per-seat accessor, no second source of truth.

### `FiveOhOneState`

Multiplayer forces the three mixed scopes apart, which is a correctness fix as much as a feature:

```ts
type FiveOhOneState = MultiSeatState & {
  status: "IN_PROGRESS" | "WON";
  winningSideKey: string | null;
  sides: readonly { sideKey: string; legsWon: number }[];
  seats: readonly {
    participantRef: string;
    sideKey: string;
    remainingScore: number;
  }[];
};
```

A solo session is `seats.length === 1` with one side — no branch anywhere in the engine.

### Behaviour that falls out

These are consequences of the model, not features added on top:

- **`record(input)` takes no seat.** It applies to the active seat, which the engine derives from its own log. A caller that could pass a seat is a caller that can disagree with the engine.
- **`undo()` needs no seat logic.** It pops the last turn in log order; the active seat is derived, so it rewinds across the seat boundary for free — undoing an opponent's visit hands the turn back to them. Undo depth stays unbounded, one `record()` per call.
- **Turn sequence stays per-stage, not per-seat.** Interleaved visits in one `LEG` share a single `1..N` run, which is what `turns.sequence_number` and the batch validator's per-stage uniqueness check already assume. No validator change.
- **A won leg closes the shared stage for everyone** and opens the next with `startingSeatFor(legIndex + 1, seatCount)`. Every seat's `remainingScore` returns to `startingScore` because it is folded from that leg's turns, and the new leg has none.
- **`wouldComplete(input)`** now asks whether the visit takes a *side* to `legsToWin`. It remains a pure predicate that never mutates.
- **Rehydration is unchanged in kind.** `create(config, prior)` replays the facts; the active seat re-derives from them, so a refresh mid-leg restores whose throw it is with nothing extra persisted.

### Configuration snapshot

Each ruleset's config schema picks up `seats[]` from one shared Zod block, so the server validates seat/participant agreement in a single place rather than once per game.

---

## Data Flow

### Setup → create

`CreateSessionRequest` gains one optional, ordered field:

```ts
participants?: {
  participantTypeKey: "PLAYER" | "GUEST";
  displayName?: string;   // required for GUEST; ignored for PLAYER
  sideKey: string;
}[]
```

Array order **is** seat order, so the setup screen decides who throws first in leg 1.

Omitting the field entirely produces today's exact behaviour: one `PLAYER` seat, one side. That is what keeps D61's "additive `participants[]`" promise literal, and what leaves the seven un-wired engines working untouched.

In one transaction the server mints the participant ids, inserts the rows, and composes `seats[]` into the configuration snapshot from those same ids. `CreateSessionResponse` already returns `participants: ParticipantRef[]`; it simply stops being a one-element array.

### Play

```
setup screen  →  POST /api/sessions  →  { sessionId, participants[] }
                                              ↓
                          store: seats[] (mirrors snapshot order)
                                              ↓
     factory.create(config, prior)  →  engine (owns rota + fact log)
                                              ↓
        record(input)  →  turn stamped with the active participantRef
                                              ↓
                     store.recordFacts(engine.facts())
                                              ↓
                    scoreboard reads state().seats / .sides
```

`game.store.ts`'s `participantRef: string | null` becomes `seats: SeatFact[]`, and `STORE_VERSION` goes to **3**. A v2 fact log holds turns with no `participantRef`, which would upload as turns belonging to nobody — discarded exactly as D91 discarded v1.

### Upload

`POST /api/sessions/:sessionId/events/batch` is **unchanged**. Turns already carry `participantRef` in the wire contract; `validateBatchReferences` already rejects a ref that is not a session participant. The only difference is that refs now vary within one batch — which that validator was written to allow. Idempotency, payload hashing and the write transaction are untouched.

### Resume

`resumeEngine` rebuilds from `configSnapshot` (now carrying `seats[]`) plus the persisted facts. `reconcileActiveSession` is unchanged. `uq_sessions_single_active` is unchanged: the session is still owned by the one player, whoever else is throwing.

### Complete

Fires when a side reaches `legsToWin`. `completeSession` is unchanged. The results view folds per-seat stats by `participantRef` and leg wins by `sideKey` — all derived at read time, so statistics stay in views and are never persisted.

### Read-model consequence

Guest turns land in `turns` under a `GUEST` participant. Any `v_*` view computing the owner's own statistics must filter on participant type, or an opponent's visits enter the player's averages. Auditing the existing views for that filter is **part of this work**, not a finding: multiplayer is what makes the omission wrong, and this design is what introduces multiplayer.

---

## Error Handling

### Setup-time (server, `VALIDATION_FAILED`)

The session is never created — participants, snapshot and session share one transaction, so there is no half-built session with orphan participants.

| Case | Why rejected |
| --- | --- |
| Zero or 2+ `PLAYER` entries | exactly one, and it must be the session owner |
| `GUEST` with blank or whitespace `displayName` | guests must be named (app-enforced, per the DB spec) |
| `DARTBOT` entry | no engine plays it yet; accepting it persists a participant nothing can throw for |
| A `sideKey` with no seats | every declared side must be throwable |
| Fewer than 1 or more than 4 seats | agreed seat bound |
| **X01**: 2+ seats sharing a `sideKey` | 2v2 is not implemented — the field exists, the pairing does not. This guard is what stops the preparation from silently half-working. |
| Non-X01 ruleset with 2+ seats per side | sides are X01-only |

Duplicate guest display names are **allowed**. Two people called Jan is a real Friday night; seats are identified by ref, not name, and the scoreboard disambiguates visually rather than by rejecting valid input.

The `PLAYER` entry's `display_name` is copied server-side from `players.display_name` — migration `0005`'s CHECK requires exactly that, so a client-supplied value is ignored rather than trusted.

### Play-time (engine, throws, fact log untouched)

Unchanged in kind from today, now evaluated against the active seat:

- a visit recorded into a completed session
- a keypad total while a board visit is open
- an invalid score, or a checkout the checkout chart contradicts

There is deliberately **no** "wrong player" error. The UI never offers a seat choice, so it cannot be wrong: `record()` always applies to the derived active seat. Scoring a visit for the wrong person is prevented structurally rather than validated.

### Play-time (recoverable)

- **Mis-attributed visit** — someone threw out of order. `undo()` rewinds across the seat boundary and hands the turn back. No correction record and no mutation, consistent with the immutability invariant.
- **Upload failure** — unchanged. The batch retries under the same idempotency key; the fact log survives reload.
- **Abandoned mid-match** — unchanged. Guest participants are persisted, so a resumed session restores the same seats and names.

### Assertion boundary

Seat membership is asserted in exactly two places: the server at create (against the participants it minted) and the batch validator at upload. The engine asserts nothing about seats — it only ever emits refs it was handed in the snapshot.

---

## Testing

TDD per `app/CLAUDE.md`, full suite on every run.

**`app/tests/modules/game/seat-rota.module.test.ts`** (new — the generic layer, tested once for every game that will use it):

- `startingSeatFor` rotates over seats and wraps at `seatCount`, for 2, 3 and 4 seats
- `activeSeat` under `SHARED`: derived from the open stage's turn count plus that stage's starting seat
- `activeSeat` under `PER_SEAT`: each seat's own stage progression
- `seatCount === 1` reproduces solo behaviour exactly — the no-regression anchor

**`app/tests/modules/game/five-oh-one.engine.module.test.ts`** (extended):

- a leg won by seat 0 resets **every** seat's `remainingScore` and opens exactly one shared next leg
- leg 2 starts with seat 1; leg 3 with seat 0
- a bust by one seat leaves every other seat's score untouched
- `legsWon` folds per **side**, not per seat
- `wouldComplete` is true only for the visit that takes a side to `legsToWin`
- `undo()` across the seat boundary restores the previous active seat, and `facts()` returns to its exact prior value
- interleaved turns within one leg carry a single `1..N` sequence run
- every emitted turn carries a `participantRef` present in `seats[]`
- rehydration: `create(config, prior)` on a 3-seat mid-leg log restores the same active seat

**`app/tests/services/session.service.test.ts`** (extended): every setup rejection above; the omitted-`participants` path producing today's exact single-seat session; snapshot `seats[]` agreeing with the minted participant ids.

**`app/tests/modules/game/events.payload.module.test.ts`** (extended): a multi-seat log builds one batch with per-turn refs.

**Regression net.** Every existing 501 test runs unmodified against a one-seat session. Per the root invariant, no test is re-pointed at a different input to keep it green; where a test's guarantee genuinely changes shape (the flattened `FiveOhOneState` fields), it is rewritten against the same guarantee.

**Not tested here:** 2v2 pairing (the only test is that setup rejects it), DartBot, bull-up.

---

## Deferred

Named so a later task does not have to rediscover them:

- **2v2 pairing** — the `sideKey` field and per-side folding exist; the setup UI and the removal of the same-side guard do not.
- **Bull-up** — deciding leg 1's starter by a throw at the bull. A genuinely different capture problem: darts thrown at a target belonging to no leg.
- **Per-participant capture depth** — capturing one side at analytics depth and the rest at visit-total depth (one-sided tournament tracking). Requires moving `capture_mode_id` off the session, so it is a schema change and its own spec.
- **Reusable guest rosters** — named guests persisting across sessions, so opponent history aggregates. Additive: a new table plus a setup-screen picker.
- **DartBot** — an artificial participant. The seat layer already accommodates it; nothing plays it.
- **Wiring the other seven engines for 1v1** — each declares `PER_SEAT` and grows a `seats` array in its `TState`. Mechanical once this lands.

---

## Touch List

| Area | File | Change |
| --- | --- | --- |
| Engine | `app/src/modules/game/types.ts` | `TurnFact.participantRef`; `MultiSeatState`; reshaped `FiveOhOneState` |
| Engine | `app/src/modules/game/interfaces.ts` | `stageOwnership` declaration |
| Engine | `app/src/modules/game/seat-rota.module.ts` | new |
| Engine | `app/src/modules/game/five-oh-one.engine.module.ts` | per-seat fold, per-side legs, shared-leg lifecycle |
| Engine | `app/src/modules/game/events.payload.module.ts` | drop the `participantRef` parameter |
| API | `app/src/pages/api/sessions/types.ts` | `participants[]` on `CreateSessionRequest` |
| Service | `app/src/services/session.service.ts` | mint N participants; compose `seats[]` into the snapshot; setup validation |
| Validators | `app/src/services/rulesets/*` | shared `seats` config block |
| Store | `app/src/stores/game.store.ts` | `seats[]` replaces `participantRef`; `STORE_VERSION` → 3 |
| Frontend | `app/src/lib/game/five-oh-one-*.data.ts` | seat-aware setup/play/results (drawing specs follow) |
| Views | `database/**` `v_*` | audit owner-scoped statistics for a participant-type filter |
| Docs | `docs/architecture/04-Architecture-patterns.md` | Pattern 18: seats, stage ownership |
| Docs | `docs/architecture/05-Database/06-Spec/04-Runtime-Layer.md` | seats live in the configuration snapshot |
| Docs | `docs/architecture/06-API/04-Endpoint-Contracts.md` | `participants[]` on create |
| Docs | `docs/game-rules/rulesets/501.md` | multiplayer feature rows |
| Decisions | `decisions/game-engine.md`, `decisions/api.md` | seat layer; D61 superseded on the create contract |
