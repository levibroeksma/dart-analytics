# DartBot Phase 4: Seat Admission Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admit `DARTBOT` as a third participant type through the seat-creation path — wire request, seat composition, response and setup UI — so a session is creatable with a bot seat that round-trips as `DARTBOT` (never collapsed to `GUEST` or `PLAYER`) in both the write and read directions.

**Architecture:** `08-DartBot.md` §Persistence §The participant-type gap names nine call sites that each hardcode a `PLAYER`/`GUEST` union or a two-way collapse; every one widens by exactly one member (D-I). The wire contract (`ParticipantInput`) gains an optional `level` (1–15) for a bot seat; the server mints the seed (`generateBotSeed()`, Web Crypto, mirroring `generateId()`'s own RNG pattern) and returns a `dartbot: { level, seed, levelSource }` payload on the created participant so the client's own copy of `SeatFact` round-trips the same data the server persisted into the configuration snapshot (D-C). The setup screen's existing add-opponent button becomes a two-step chooser — Guest or DartBot (D-J) — reusing the single-opponent-slot mechanics `guest-list.ts` already enforces, with no new screen and no level picker (phase 4 ships the default level only; `08-DartBot.md` §Skill Model names 8 the default).

**Tech Stack:** Astro, TypeScript, Zod, Alpine.js, Vitest.

## Global Constraints

- No database migration: `DARTBOT` (`participant_type_id = 3`) and its `chk_participants_dartbot_display_name` CHECK are already seeded (`database/seeds/0001_reference_data.sql`, `database/migrations/0005_runtime_core.sql`) — this phase is application-layer only.
- `level` is an integer **1–15**, default **8** (`08-DartBot.md` §Skill Model). `levelSource` is always the literal `"MANUAL"` this phase (D-K, auto level, is future work).
- A bot's `display_name` is always the literal `"DartBot"`, set server-side — a client-supplied value is ignored, mirroring how the `PLAYER` seat's name is already copied server-side.
- `seatsFromParticipants()` is deleted (delivery design's own `Delivers` column) — replaced by a private, non-exported mapper (`toSeatFacts`) shared by its two former call sites, since the corrected three-way mapping is no longer a "coerce to two values" function.
- **Scope decision — only 3 of the 5 dictated-strategy rulesets get a DartBot chooser this phase.** `FINDINGS.md` F45 (already logged, explicitly deferred, not this plan's to fix) documents that Shanghai V2 and Singles Training V2 can never create *any* 2-seat session today — their setup screens hardcode the V2 ruleset key with no seat-count branch, so a guest add already 422s at `createSession`. Wiring a DartBot chooser onto those two screens would ship a second button with the identical, already-known failure. `RULESET_DARTBOT` therefore admits only `AROUND_THE_CLOCK_V1`, `BOBS27_V1`, `DOUBLES_TRAINING_V1` — the three dictated rulesets whose `SEAT_CAPS` entry and setup screen already support a working 2-seat session today. Raise this scope decision in the completion report; it is not a silent narrowing.
- `RULESET_DARTBOT`/`DEFAULT_BOT_LEVEL` live in `app/src/lib/game/rulesets/capabilities.ts`, not literally beside `SEAT_CAPS` in `session-seats.service.ts` as `08-DartBot.md` phrases it — `session-seats.service.ts` is backend-only (`services/`, no `.astro` file imports from it, confirmed by search), while the setup screens need to read this map too, to gate the chooser (D-J: "renders only where `RULESET_DARTBOT` is true"). `capabilities.ts` already carries the identical shape of precedent (`RULESET_CAPABILITIES`, read by both `session.service.ts` and `session-mode-resolution.ts`), so this follows the established pattern rather than inventing a new one. `session-seats.service.ts` imports the map from there for `rejectSeatRequest`'s server-side gate.

---

## File Structure

| File | Responsibility |
|---|---|
| `app/src/lib/id.ts` | + `generateBotSeed()` — Web Crypto RNG for a bot's persisted seed |
| `app/src/lib/game/rulesets/capabilities.ts` | + `RULESET_DARTBOT`, `supportsDartbot()`, `DEFAULT_BOT_LEVEL` — the shared, frontend-and-backend-readable admission policy |
| `app/src/pages/api/sessions/types.ts` | `ParticipantInput`/`ParticipantRef` widen to admit `DARTBOT` + `level`/`dartbot` |
| `app/src/lib/game/rulesets/types.ts` | `SeatFact` becomes a discriminated union with a `DARTBOT` branch carrying `dartbot: {...}` |
| `app/src/services/types.ts` | `SeatPlan`/`CreateSessionResult` carry the same `dartbot` payload server-side |
| `app/src/services/session-seats.service.ts` | `rejectSeatRequest` gates a bot seat on `supportsDartbot`; `composeSeatFacts` gains the `DARTBOT` branch |
| `app/src/services/session.service.ts` | `loadCreateSessionLookups` resolves the `DARTBOT` type id; `buildSeatPlan` mints level+seed; `createSession`'s response carries `dartbot` |
| `app/src/lib/game/session-mode-resolution.ts` | `seatsFromParticipants()` deleted → private `toSeatFacts()`; `participantsFromSeats()`/`participantsFromGuests()` gain a `DARTBOT` branch |
| `app/src/lib/game/guest-list.ts` | + `addBotOpponent()`; `addTypedGuest()`'s single-opponent-slot guard widens to also refuse when a bot is seated |
| `app/src/lib/game/types.ts` | `GuestListContext`/`PresetSetupContext` carry `bot`/`showOpponentChooser`/`addBot`/`removeBot` |
| `app/src/lib/game/setup-controller.ts` | `bot` state + `addBot`/`removeBot`; `start()` sends `participantsFromGuests(this.guests, this.bot)` |
| `app/src/components/layout/games/setup/AddGuestButton.astro` | `allowDartbot` prop; opens the chooser instead of the guest-name modal directly |
| `app/src/components/layout/games/setup/OpponentChooserModal.astro` | **New.** The Guest/DartBot chooser (D-J) |
| `app/src/components/layout/games/setup/GuestSection.astro` | Renders the bot avatar/remove badge; wires the chooser modal |
| `app/src/components/layout/games/setup/UserSection.astro` | `allowDartbot` prop, forwarded to `GuestSection` |
| `AroundTheClockSetupForm.astro`, `Bobs27SetupForm.astro`, `DoublesTrainingSetupForm.astro` | Pass `allowDartbot={supportsDartbot("...")}` |

Every source file above has a mirrored test file already (per `app/CLAUDE.md`'s D224 coverage gate) — each task extends the existing suite rather than creating a new one, except Task 1 (`id.ts` has none yet) and Task 11 (`.astro` markup logic is untested per D101).

---

## Task 1: `generateBotSeed()`

**Files:**
- Modify: `app/src/lib/id.ts`
- Test: `app/tests/lib/id.test.ts` (new)

**Interfaces:**
- Produces: `generateBotSeed(): number` — a `Uint32`-range integer, consumed by Task 7's `buildSeatPlan`.

- [ ] **Step 1: Write the failing test**

```ts
// app/tests/lib/id.test.ts
import { describe, expect, it, vi } from "vitest";
import { generateBotSeed } from "@lib/id";

describe("generateBotSeed", () => {
  it("returns an integer seed in the Uint32 range", () => {
    const seed = generateBotSeed();
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThanOrEqual(0xffffffff);
  });

  it("draws from crypto.getRandomValues, not Math.random", () => {
    const spy = vi.spyOn(crypto, "getRandomValues");
    generateBotSeed();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("returns different values across calls", () => {
    const seeds = new Set(Array.from({ length: 20 }, () => generateBotSeed()));
    expect(seeds.size).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/id.test.ts`
Expected: FAIL — `generateBotSeed is not a function` (does not exist yet)

- [ ] **Step 3: Write minimal implementation**

Add to `app/src/lib/id.ts`, after `generateId()`:

```ts
/**
 * Generates a 32-bit unsigned integer seed for a DartBot's per-session
 * deterministic PRNG (`08-DartBot.md` §Determinism and Replay). Uses the
 * same Web Crypto RNG `generateId()` draws from — never `Math.random()`.
 */
export function generateBotSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/lib/id.test.ts`
Expected: PASS — 3/3

- [ ] **Step 5: Commit**

```bash
cd app && git add src/lib/id.ts tests/lib/id.test.ts
git commit -m "feat: add generateBotSeed for DartBot seat admission"
```

---

## Task 2: `RULESET_DARTBOT`, `supportsDartbot`, `DEFAULT_BOT_LEVEL`

**Files:**
- Modify: `app/src/lib/game/rulesets/capabilities.ts`
- Test: `app/tests/lib/game/rulesets/capabilities.test.ts`

**Interfaces:**
- Produces: `RULESET_DARTBOT: Readonly<Partial<Record<RulesetVersionKey, boolean>>>`, `supportsDartbot(rulesetVersionKey: RulesetVersionKey): boolean`, `DEFAULT_BOT_LEVEL = 8`. Consumed by Task 6 (`rejectSeatRequest`), Task 9 (`addBotOpponent`), Task 7 (`buildSeatPlan`'s level fallback), Task 12 (the three setup forms).

- [ ] **Step 1: Write the failing tests**

Add to `app/tests/lib/game/rulesets/capabilities.test.ts`, widening the import at the top:

```ts
import {
  RULESET_CAPABILITIES,
  capableRulesets,
  supportsMode,
  supportsCaptureMode,
  RULESET_DARTBOT,
  supportsDartbot,
  DEFAULT_BOT_LEVEL,
} from "@lib/game/rulesets/capabilities";
```

Append at the end of the file:

```ts
describe("RULESET_DARTBOT", () => {
  it("admits exactly the three rulesets whose 1v1 seating works today", () => {
    expect(
      (Object.keys(RULESET_DARTBOT) as (keyof typeof RULESET_DARTBOT)[])
        .filter((key) => RULESET_DARTBOT[key])
        .sort(),
    ).toEqual(["AROUND_THE_CLOCK_V1", "BOBS27_V1", "DOUBLES_TRAINING_V1"]);
  });
});

describe("supportsDartbot", () => {
  it("accepts Bob's 27", () => {
    expect(supportsDartbot("BOBS27_V1")).toBe(true);
  });

  it("accepts Around the Clock", () => {
    expect(supportsDartbot("AROUND_THE_CLOCK_V1")).toBe(true);
  });

  it("accepts Doubles Training", () => {
    expect(supportsDartbot("DOUBLES_TRAINING_V1")).toBe(true);
  });

  it("rejects 501, which has no bot strategy until phase 7", () => {
    expect(supportsDartbot("501_V1")).toBe(false);
  });

  it("rejects Shanghai V2 and Singles V2 (F45 — 1v1 seating is already broken there)", () => {
    expect(supportsDartbot("SHANGHAI_V2")).toBe(false);
    expect(supportsDartbot("SINGLES_V2")).toBe(false);
  });

  it("rejects a ruleset absent from the map", () => {
    expect(supportsDartbot("SCORE_TRAINING_V1")).toBe(false);
  });
});

describe("DEFAULT_BOT_LEVEL", () => {
  it("is 8, the level curve's own documented default", () => {
    expect(DEFAULT_BOT_LEVEL).toBe(8);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/rulesets/capabilities.test.ts`
Expected: FAIL — `RULESET_DARTBOT`/`supportsDartbot`/`DEFAULT_BOT_LEVEL` are not exported

- [ ] **Step 3: Write minimal implementation**

Add to `app/src/lib/game/rulesets/capabilities.ts`, after `RULESET_CAPABILITIES`'s closing `};`:

```ts
/**
 * Which ruleset versions currently admit a DartBot opponent seat. `08-DartBot.md`
 * §Delivery Phases names the five rulesets `DictatedStrategy` (phase 3) already
 * plays: Around the Clock, Bob's 27, Doubles Training, Shanghai, Singles
 * Training. Only three are listed here — Shanghai V2 and Singles Training V2
 * can never create *any* 2-seat session today (`FINDINGS.md` F45: both setup
 * screens hardcode their V2 ruleset key with no seat-count branch, so a guest
 * add already 422s at `createSession`), and that gap is explicitly deferred,
 * not this map's to route around. 501, 121 and Score Training have no bot
 * strategy at all yet — `X01Strategy` lands phase 7. Absent keys read as
 * unsupported, exactly like `SEAT_CAPS`'s own "no entry" default in
 * `session-seats.service.ts`.
 */
export const RULESET_DARTBOT: Readonly<
  Partial<Record<RulesetVersionKey, boolean>>
> = {
  AROUND_THE_CLOCK_V1: true,
  BOBS27_V1: true,
  DOUBLES_TRAINING_V1: true,
};

/** Whether this ruleset version currently admits a DartBot opponent seat. */
export function supportsDartbot(rulesetVersionKey: RulesetVersionKey): boolean {
  return RULESET_DARTBOT[rulesetVersionKey] === true;
}

/**
 * The bot level (1–15, D-D's public knob) a new DartBot seat gets when the
 * setup screen's chooser offers no picker — `08-DartBot.md` §Skill Model
 * names 8 the default. Both the client (`guest-list.ts`'s `addBotOpponent`)
 * and the server (`session.service.ts`'s `buildSeatPlan`, the fallback for a
 * request that omits `level`) read this one constant.
 */
export const DEFAULT_BOT_LEVEL = 8;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/rulesets/capabilities.test.ts`
Expected: PASS — all tests green

- [ ] **Step 5: Commit**

```bash
cd app && git add src/lib/game/rulesets/capabilities.ts tests/lib/game/rulesets/capabilities.test.ts
git commit -m "feat: declare which rulesets admit a DartBot opponent seat"
```

---

## Task 3: Wire contract — `ParticipantInput` / `ParticipantRef`

**Files:**
- Modify: `app/src/pages/api/sessions/types.ts`
- Test: `app/tests/pages/api/sessions/types.test.ts`

**Interfaces:**
- Produces: `ParticipantInputData.participantTypeKey: "PLAYER" | "GUEST" | "DARTBOT"`, `.level?: number`; `ParticipantRef`'s inferred shape gains `dartbot?: { level; seed; levelSource: "MANUAL" }`. Consumed by every task downstream.

- [ ] **Step 1: Write the failing tests**

In `app/tests/pages/api/sessions/types.test.ts`, replace the existing inverted test:

```ts
  it("rejects a participant type outside PLAYER and GUEST", () => {
    expect(
      ParticipantInput.safeParse({
        participantTypeKey: "DARTBOT",
        sideKey: "A",
      }).success,
    ).toBe(false);
  });
```

with:

```ts
  it("accepts a DARTBOT seat with no displayName", () => {
    expect(
      ParticipantInput.safeParse({
        participantTypeKey: "DARTBOT",
        sideKey: "B",
      }).success,
    ).toBe(true);
  });

  it("accepts a DARTBOT seat carrying a level between 1 and 15", () => {
    expect(
      ParticipantInput.safeParse({
        participantTypeKey: "DARTBOT",
        level: 12,
        sideKey: "B",
      }).success,
    ).toBe(true);
  });

  it("rejects a DARTBOT level below 1", () => {
    expect(
      ParticipantInput.safeParse({
        participantTypeKey: "DARTBOT",
        level: 0,
        sideKey: "B",
      }).success,
    ).toBe(false);
  });

  it("rejects a DARTBOT level above 15", () => {
    expect(
      ParticipantInput.safeParse({
        participantTypeKey: "DARTBOT",
        level: 16,
        sideKey: "B",
      }).success,
    ).toBe(false);
  });

  it("rejects a non-integer DARTBOT level", () => {
    expect(
      ParticipantInput.safeParse({
        participantTypeKey: "DARTBOT",
        level: 8.5,
        sideKey: "B",
      }).success,
    ).toBe(false);
  });

  it("still rejects a participant type outside PLAYER, GUEST and DARTBOT", () => {
    expect(
      ParticipantInput.safeParse({
        participantTypeKey: "GHOST",
        sideKey: "A",
      }).success,
    ).toBe(false);
  });
```

Also append a new describe block at the end of the file, after `describe("CreateSessionRequest participants", ...)`:

```ts
describe("ParticipantRef", () => {
  it("accepts a PLAYER/GUEST ref with no dartbot payload", () => {
    expect(
      ParticipantRef.safeParse({
        ref: "p1",
        participantTypeKey: "PLAYER",
        displayName: "Levi",
      }).success,
    ).toBe(true);
  });

  it("accepts a DARTBOT ref carrying its level/seed/levelSource", () => {
    expect(
      ParticipantRef.safeParse({
        ref: "p2",
        participantTypeKey: "DARTBOT",
        displayName: "DartBot",
        dartbot: { level: 8, seed: 123456, levelSource: "MANUAL" },
      }).success,
    ).toBe(true);
  });

  it("rejects a levelSource other than MANUAL", () => {
    expect(
      ParticipantRef.safeParse({
        ref: "p2",
        participantTypeKey: "DARTBOT",
        displayName: "DartBot",
        dartbot: { level: 8, seed: 123456, levelSource: "AUTO" },
      }).success,
    ).toBe(false);
  });
});
```

Update the `import` line at the top of the file to include `ParticipantRef`:

```ts
import { CreateSessionRequest, ParticipantInput, ParticipantRef } from "@routes/sessions/types";
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/pages/api/sessions/types.test.ts`
Expected: FAIL — DARTBOT rejected by the current enum; `dartbot` key not recognized

- [ ] **Step 3: Write minimal implementation**

In `app/src/pages/api/sessions/types.ts`, replace the `ParticipantInput` block and its doc comment:

```ts
/**
 * One requested seat. Array order IS seat order, so the setup screen decides
 * who throws first in leg 1 by the order it sends. `displayName` is required
 * for a GUEST and ignored for the PLAYER and DARTBOT, whose names are copied
 * server-side (`players.display_name`, and the literal `"DartBot"` — migration
 * `0005`'s CHECK requires exactly that) — a client-supplied value is never
 * trusted. `level` (1–15, `08-DartBot.md` §Skill Model) is read only for a
 * DARTBOT seat; when omitted the server defaults it (`DEFAULT_BOT_LEVEL`).
 * Cross-field agreement (one PLAYER, one seat per side, seat count, ruleset
 * support — including whether the ruleset admits a bot at all) is asserted
 * once in `session-seats.service.ts` rather than here, because it depends on
 * the ruleset being created.
 */
export const ParticipantInput = z.object({
  participantTypeKey: z.enum(["PLAYER", "GUEST", "DARTBOT"]),
  displayName: z.string().optional(),
  level: z.number().int().min(1).max(15).optional(),
  sideKey: z.string().min(1),
});
export type ParticipantInputData = z.infer<typeof ParticipantInput>;
```

Replace the `ParticipantRef` block:

```ts
/**
 * One minted participant, as `createSession` returns it. `dartbot` is
 * present only on a `DARTBOT` participant — the same `{ level, seed,
 * levelSource }` shape `SeatFact`'s DARTBOT branch carries (D-C), returned so
 * the client's own copy of the seat round-trips the exact data the server
 * persisted into the configuration snapshot, rather than the client having to
 * re-derive or guess it.
 */
export const ParticipantRef = z.object({
  ref: z.string(),
  participantTypeKey: z.enum(["PLAYER", "GUEST", "DARTBOT"]),
  displayName: z.string(),
  dartbot: z
    .object({
      level: z.number().int().min(1).max(15),
      seed: z.number().int(),
      levelSource: z.literal("MANUAL"),
    })
    .optional(),
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/pages/api/sessions/types.test.ts`
Expected: PASS — all tests green

- [ ] **Step 5: Commit**

```bash
cd app && git add src/pages/api/sessions/types.ts tests/pages/api/sessions/types.test.ts
git commit -m "feat: admit DARTBOT at the session-create wire contract"
```

---

## Task 4: `SeatFact` discriminated union

**Files:**
- Modify: `app/src/lib/game/rulesets/types.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `SeatFact` is now `{ participantRef; displayName; sideKey; participantTypeKey: "PLAYER" | "GUEST" }` **or** `{ participantRef; displayName; sideKey; participantTypeKey: "DARTBOT"; dartbot: { level: number; seed: number; levelSource: "MANUAL" } }`. Consumed by Task 6 (`composeSeatFacts`), Task 8 (`toSeatFacts`, `participantsFromSeats`).

Type-only change — exempt from the test-coverage gate (D224). Verified indirectly by Tasks 6 and 8's tests, which construct and destructure both branches.

- [ ] **Step 1: Edit the type**

In `app/src/lib/game/rulesets/types.ts`, replace the `SeatFact` type and its doc comment:

```ts
/**
 * One ordered position in a session's throw rota, as written into the
 * session's configuration snapshot at create time. `sideKey` groups seats:
 * v1 writes exactly one seat per side, and a future 2v2 writes two. Seat
 * order is gameplay-relevant and therefore stored; the ACTIVE seat is derived
 * from the fact log and never stored.
 *
 * `participantTypeKey` is carried so read-time statistics can restrict
 * themselves to the owning player's own turns — a guest's or bot's visits
 * land in the same `turns` table.
 *
 * A discriminated union rather than one flat type (D-C): `dartbot` exists
 * only on the `DARTBOT` branch, so a PLAYER/GUEST seat can never carry it and
 * a DARTBOT seat can never be missing it — the level/seed/levelSource a bot
 * throws with is not optional data once the branch is known.
 */
export type SeatFact =
  | {
      participantRef: string;
      displayName: string;
      sideKey: string;
      participantTypeKey: "PLAYER" | "GUEST";
    }
  | {
      participantRef: string;
      displayName: string;
      sideKey: string;
      participantTypeKey: "DARTBOT";
      dartbot: { level: number; seed: number; levelSource: "MANUAL" };
    };
```

- [ ] **Step 2: Typecheck**

Run: `cd app && npx tsc --noEmit`
Expected: New errors in `session-seats.service.ts` and `session-mode-resolution.ts` (their current code assigns a plain `"PLAYER" | "GUEST"` literal without the union's second branch) — this is expected; Tasks 6 and 8 fix them. Confirm the error locations are exactly those two files and nowhere else.

- [ ] **Step 3: Commit**

```bash
cd app && git add src/lib/game/rulesets/types.ts
git commit -m "feat: make SeatFact a discriminated union admitting DARTBOT"
```

---

## Task 5: `SeatPlan` / `CreateSessionResult` service types

**Files:**
- Modify: `app/src/services/types.ts`

**Interfaces:**
- Produces: `SeatPlan.dartbot?: { level: number; seed: number; levelSource: "MANUAL" }`; `CreateSessionResult.participants[].participantTypeKey: "PLAYER" | "GUEST" | "DARTBOT"` and `.dartbot?: {...}`. Consumed by Task 7.

Type-only change — exempt from the coverage gate, verified by Task 7's tests.

- [ ] **Step 1: Edit the types**

In `app/src/services/types.ts`, replace `CreateSessionResult` and `SeatPlan`:

```ts
export type CreateSessionResult = {
  sessionId: string;
  participants: {
    ref: string;
    participantTypeKey: "PLAYER" | "GUEST" | "DARTBOT";
    displayName: string;
    dartbot?: { level: number; seed: number; levelSource: "MANUAL" };
  }[];
};
```

```ts
/**
 * One seat as it will be persisted: the participant row to insert plus the
 * side it plays for. Built before the write so participants and the
 * configuration snapshot are composed from the same ids in one transaction.
 * `dartbot` is populated only for a `DARTBOT` seat — `buildSeatPlan`
 * (`session.service.ts`) mints it, `composeSeatFacts`
 * (`session-seats.service.ts`) carries it straight into the snapshot's
 * `SeatFact`.
 */
export type SeatPlan = {
  participantId: string;
  participantTypeId: number;
  playerId: string | null;
  displayName: string;
  sideKey: string;
  dartbot?: { level: number; seed: number; levelSource: "MANUAL" };
};
```

- [ ] **Step 2: Typecheck**

Run: `cd app && npx tsc --noEmit`
Expected: Errors in `session.service.ts` (still returns a plain `string` for `participantTypeKey`, and `buildSeatPlan` doesn't yet populate `dartbot`) — expected, fixed by Task 7.

- [ ] **Step 3: Commit**

```bash
cd app && git add src/services/types.ts
git commit -m "feat: widen SeatPlan and CreateSessionResult for a DARTBOT seat"
```

---

## Task 6: `session-seats.service.ts` — admission gate + seat composition

**Files:**
- Modify: `app/src/services/session-seats.service.ts`
- Test: `app/tests/services/session-seats.service.test.ts`

**Interfaces:**
- Consumes: `supportsDartbot` (Task 2), `SeatFact`/`SeatPlan` (Tasks 4–5).
- Produces: `rejectSeatRequest` refuses a DARTBOT seat when `supportsDartbot(rulesetVersionKey)` is false; `composeSeatFacts` emits the DARTBOT branch of `SeatFact` for a seat carrying `dartbot`.

- [ ] **Step 1: Write the failing tests**

Add to `app/tests/services/session-seats.service.test.ts`, after the existing `import`:

```ts
const bot = {
  participantTypeKey: "DARTBOT" as const,
  sideKey: "B",
};
```

Append inside the existing `describe("rejectSeatRequest with the seven new rulesets", ...)` block, or as a new top-level block right after it:

```ts
describe("rejectSeatRequest with a DARTBOT seat", () => {
  it("accepts a DARTBOT seat for a ruleset RULESET_DARTBOT admits", () => {
    expect(rejectSeatRequest([player, bot], "BOBS27_V1")).toBeNull();
  });

  it("rejects a DARTBOT seat for a ruleset RULESET_DARTBOT does not admit", () => {
    expect(rejectSeatRequest([player, bot], "501_V1")).toMatch(
      /does not support a DartBot opponent/,
    );
  });

  it("rejects a DARTBOT seat for Shanghai V2, whose 1v1 seating is already broken (F45)", () => {
    expect(rejectSeatRequest([player, bot], "SHANGHAI_V2")).toMatch(
      /does not support a DartBot opponent/,
    );
  });

  it("counts a DARTBOT seat toward the ruleset's own SEAT_CAPS entry", () => {
    const threeSeats = [
      player,
      bot,
      { ...guest, sideKey: "C" },
    ];
    expect(rejectSeatRequest(threeSeats, "BOBS27_V1")).toContain(
      "supports at most 2 seat",
    );
  });
});
```

Append to `describe("composeSeatFacts", ...)`:

```ts
  it("projects a DARTBOT seat's level/seed/levelSource into the snapshot seat", () => {
    expect(
      composeSeatFacts([
        {
          participantId: "id-a",
          participantTypeId: 1,
          playerId: "player-1",
          displayName: "Levi",
          sideKey: "A",
        },
        {
          participantId: "id-b",
          participantTypeId: 3,
          playerId: null,
          displayName: "DartBot",
          sideKey: "B",
          dartbot: { level: 8, seed: 424242, levelSource: "MANUAL" },
        },
      ]),
    ).toEqual([
      {
        participantRef: "id-a",
        displayName: "Levi",
        sideKey: "A",
        participantTypeKey: "PLAYER",
      },
      {
        participantRef: "id-b",
        displayName: "DartBot",
        sideKey: "B",
        participantTypeKey: "DARTBOT",
        dartbot: { level: 8, seed: 424242, levelSource: "MANUAL" },
      },
    ]);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/services/session-seats.service.test.ts`
Expected: FAIL — `rejectSeatRequest` never mentions DartBot support; `composeSeatFacts` collapses the bot seat to `"GUEST"`

- [ ] **Step 3: Write minimal implementation**

In `app/src/services/session-seats.service.ts`, widen the imports at the top:

```ts
import type { SeatFact } from "@lib/types";
import type { ParticipantInputData } from "@routes/types";
import { supportsDartbot } from "@lib/game/rulesets/capabilities";
import type { SeatPlan } from "./types";

const MIN_SEATS = 1;
const MAX_SEATS = 4;
const PLAYER_PARTICIPANT_TYPE_ID = 1;
```

Add the DARTBOT gate to `rejectSeatRequest`, right after the `unnamedGuest` check and before the `sides` check:

```ts
  const unsupportedDartbot = participants.some(
    (participant) =>
      participant.participantTypeKey === "DARTBOT" &&
      !supportsDartbot(rulesetVersionKey as never),
  );
  if (unsupportedDartbot) {
    return `${rulesetVersionKey} does not support a DartBot opponent yet.`;
  }
```

> Note: `supportsDartbot` types its parameter as `RulesetVersionKey`, while `rejectSeatRequest` accepts a plain `string` (it validates rulesets the type system hasn't narrowed yet, matching how `SEAT_CAPS`'s own lookup below already does `SEAT_CAPS[rulesetVersionKey]` against a `Record<string, number>`). Cast at the call site rather than widening `supportsDartbot`'s own signature, which every other caller (the three setup forms) calls with a real `RulesetVersionKey` literal.

Replace `composeSeatFacts`:

```ts
export function composeSeatFacts(plan: readonly SeatPlan[]): SeatFact[] {
  return plan.map((seat) => {
    if (seat.dartbot) {
      return {
        participantRef: seat.participantId,
        displayName: seat.displayName,
        sideKey: seat.sideKey,
        participantTypeKey: "DARTBOT",
        dartbot: seat.dartbot,
      };
    }
    return {
      participantRef: seat.participantId,
      displayName: seat.displayName,
      sideKey: seat.sideKey,
      participantTypeKey:
        seat.participantTypeId === PLAYER_PARTICIPANT_TYPE_ID
          ? "PLAYER"
          : "GUEST",
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/services/session-seats.service.test.ts`
Expected: PASS — all tests green

- [ ] **Step 5: Commit**

```bash
cd app && git add src/services/session-seats.service.ts tests/services/session-seats.service.test.ts
git commit -m "feat: gate and compose a DARTBOT seat in session-seats.service"
```

---

## Task 7: `session.service.ts` — mint the seat, return it

**Files:**
- Modify: `app/src/services/session.service.ts`
- Test: `app/tests/services/session.service.test.ts`

**Interfaces:**
- Consumes: `generateBotSeed` (Task 1), `DEFAULT_BOT_LEVEL` (Task 2), the widened `SeatPlan`/`CreateSessionResult` (Task 5).
- Produces: `createSession()`'s response carries a `DARTBOT` participant with `displayName: "DartBot"` and a `dartbot` payload; the same payload is written into the configuration snapshot's seat.

- [ ] **Step 1: Write the failing tests**

In `app/tests/services/session.service.test.ts`, widen the `@lib/id` mock:

```ts
vi.mock("@lib/id", () => ({
  generateId: vi.fn(() => "generated-id"),
  generateBotSeed: vi.fn(() => 424242),
}));
```

Widen the `findParticipantTypeId` mock inside `beforeEach` to a three-way branch:

```ts
    vi.mocked(repo.findParticipantTypeId).mockImplementation(
      async (_db: unknown, key: string) =>
        key === "PLAYER" ? 1 : key === "GUEST" ? 2 : 3,
    );
```

Add a new fixture near `fiveOhOneRequest`, for a ruleset `RULESET_DARTBOT` admits:

```ts
const bobs27Request = {
  gameTypeKey: "BOBS27",
  rulesetVersionKey: "BOBS27_V1",
  captureModeKey: "RECREATIONAL",
  inputModeKey: "DETAILED_DARTS",
  config: { source: "inline" as const, config: {} },
};
```

Append a new `describe` block after the existing `createSession` tests (inside the same top-level `describe("createSession", ...)`, or as a sibling — place it right after the `"writes the seats into the configuration snapshot..."` test):

```ts
  describe("a DARTBOT seat", () => {
    it("mints a DARTBOT participant with display name DartBot, ignoring a spoofed displayName", async () => {
      const result = await createSession("player-1", {
        ...bobs27Request,
        participants: [
          { participantTypeKey: "PLAYER", sideKey: "A" },
          {
            participantTypeKey: "DARTBOT",
            displayName: "Spoofed",
            sideKey: "B",
          },
        ],
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.participants[1]).toEqual({
        ref: "generated-id",
        participantTypeKey: "DARTBOT",
        displayName: "DartBot",
        dartbot: { level: 8, seed: 424242, levelSource: "MANUAL" },
      });
    });

    it("defaults the level to 8 when the request omits it", async () => {
      const result = await createSession("player-1", {
        ...bobs27Request,
        participants: [
          { participantTypeKey: "PLAYER", sideKey: "A" },
          { participantTypeKey: "DARTBOT", sideKey: "B" },
        ],
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.participants[1].dartbot?.level).toBe(8);
    });

    it("uses the requested level when one is given", async () => {
      const result = await createSession("player-1", {
        ...bobs27Request,
        participants: [
          { participantTypeKey: "PLAYER", sideKey: "A" },
          { participantTypeKey: "DARTBOT", level: 13, sideKey: "B" },
        ],
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.data.participants[1].dartbot?.level).toBe(13);
    });

    it("writes the same dartbot payload into the configuration snapshot's seat", async () => {
      const result = await createSession("player-1", {
        ...bobs27Request,
        participants: [
          { participantTypeKey: "PLAYER", sideKey: "A" },
          { participantTypeKey: "DARTBOT", sideKey: "B" },
        ],
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const written = vi.mocked(repo.insertSessionRecords).mock.calls[0][0];
      expect(written.configuration.seats[1]).toEqual({
        participantRef: "generated-id",
        displayName: "DartBot",
        sideKey: "B",
        participantTypeKey: "DARTBOT",
        dartbot: { level: 8, seed: 424242, levelSource: "MANUAL" },
      });
    });

    it("rejects a DARTBOT seat for a ruleset that does not admit one", async () => {
      const result = await createSession("player-1", {
        ...fiveOhOneRequest,
        participants: [
          { participantTypeKey: "PLAYER", sideKey: "A" },
          { participantTypeKey: "DARTBOT", sideKey: "B" },
        ],
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.code).toBe("VALIDATION_FAILED");
      expect(repo.insertSessionRecords).not.toHaveBeenCalled();
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/services/session.service.test.ts`
Expected: FAIL — `dartbotParticipantTypeId` unresolved, `buildSeatPlan` never mints `dartbot`, the response never carries it

- [ ] **Step 3: Write minimal implementation**

In `app/src/services/session.service.ts`, widen the `@lib/id` import:

```ts
import { generateBotSeed, generateId } from "@lib/id";
```

Add the `DEFAULT_BOT_LEVEL` import alongside the existing `supportsMode` import:

```ts
import { DEFAULT_BOT_LEVEL, supportsMode } from "@lib/game/rulesets/capabilities";
```

Replace `loadCreateSessionLookups`:

```ts
/** Loads lookup ids and player display metadata required to create a session. */
async function loadCreateSessionLookups(
  db: ReturnType<typeof getDb>,
  playerId: string,
  input: CreateSessionRequestInput,
): Promise<
  ServiceResult<{
    captureModeId: number;
    inputModeId: number;
    activeStatusId: number;
    playerParticipantTypeId: number;
    guestParticipantTypeId: number;
    dartbotParticipantTypeId: number;
    displayName: string;
  }>
> {
  const [
    captureModeId,
    inputModeId,
    activeStatusId,
    playerParticipantTypeId,
    guestParticipantTypeId,
    dartbotParticipantTypeId,
    displayName,
  ] = await Promise.all([
    findCaptureModeId(db, input.captureModeKey),
    findInputModeId(db, input.inputModeKey),
    findGameStatusId(db, "ACTIVE"),
    findParticipantTypeId(db, "PLAYER"),
    findParticipantTypeId(db, "GUEST"),
    findParticipantTypeId(db, "DARTBOT"),
    findPlayerDisplayName(db, playerId),
  ]);
  if (!captureModeId)
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "unknown captureModeKey" },
    };
  if (!inputModeId)
    return {
      ok: false,
      code: "VALIDATION_FAILED",
      details: { reason: "unknown inputModeKey" },
    };
  if (
    !activeStatusId ||
    !playerParticipantTypeId ||
    !guestParticipantTypeId ||
    !dartbotParticipantTypeId ||
    !displayName
  ) {
    return {
      ok: false,
      code: "INTERNAL_ERROR",
      details: { reason: "reference data missing" },
    };
  }

  return {
    ok: true,
    data: {
      captureModeId,
      inputModeId,
      activeStatusId,
      playerParticipantTypeId,
      guestParticipantTypeId,
      dartbotParticipantTypeId,
      displayName,
    },
  };
}
```

Replace `buildSeatPlan`:

```ts
/**
 * The participant rows this session will own, in seat order. An omitted
 * `participants` field produces exactly one PLAYER seat — today's behaviour,
 * which is what keeps D61's "additive participants[]" promise literal and
 * leaves every un-wired engine working untouched.
 *
 * The PLAYER seat's display name is always the player's own row, and the
 * DARTBOT seat's is always the literal `"DartBot"` — never the request's:
 * migration `0005`'s CHECKs require exactly that for both. A DARTBOT seat
 * mints its own `seed` (`generateBotSeed`) and defaults its `level` to
 * `DEFAULT_BOT_LEVEL` when the request omits one.
 */
function buildSeatPlan(
  input: CreateSessionRequestInput,
  playerId: string,
  lookups: {
    playerParticipantTypeId: number;
    guestParticipantTypeId: number;
    dartbotParticipantTypeId: number;
    displayName: string;
  },
): SeatPlan[] {
  const requested = input.participants ?? [
    { participantTypeKey: "PLAYER" as const, sideKey: "A" },
  ];

  return requested.map((participant, index) => {
    const isPlayer = participant.participantTypeKey === "PLAYER";
    const isDartbot = participant.participantTypeKey === "DARTBOT";
    return {
      participantId: generateId(),
      participantTypeId: isPlayer
        ? lookups.playerParticipantTypeId
        : isDartbot
          ? lookups.dartbotParticipantTypeId
          : lookups.guestParticipantTypeId,
      playerId: isPlayer ? playerId : null,
      displayName: isPlayer
        ? lookups.displayName
        : isDartbot
          ? "DartBot"
          : (participant.displayName ?? "").trim(),
      sideKey: participant.sideKey || String.fromCharCode(65 + index),
      ...(isDartbot
        ? {
            dartbot: {
              level: participant.level ?? DEFAULT_BOT_LEVEL,
              seed: generateBotSeed(),
              levelSource: "MANUAL" as const,
            },
          }
        : {}),
    };
  });
}
```

In `createSession`, widen the destructure of `lookups.data`:

```ts
  const {
    captureModeId,
    inputModeId,
    activeStatusId,
    playerParticipantTypeId,
    guestParticipantTypeId,
    dartbotParticipantTypeId,
    displayName,
  } = lookups.data;
```

Widen the `buildSeatPlan` call:

```ts
  const seatPlan = buildSeatPlan(input, playerId, {
    playerParticipantTypeId,
    guestParticipantTypeId,
    dartbotParticipantTypeId,
    displayName,
  });
```

Replace the final response mapping:

```ts
  return {
    ok: true,
    data: {
      sessionId: inserted.data.sessionId,
      participants: seats.map((seat) => ({
        ref: seat.participantRef,
        participantTypeKey: seat.participantTypeKey,
        displayName: seat.displayName,
        ...(seat.participantTypeKey === "DARTBOT"
          ? { dartbot: seat.dartbot }
          : {}),
      })),
    },
  };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/services/session.service.test.ts`
Expected: PASS — all tests green, including the pre-existing ones (the three-way `findParticipantTypeId` mock still returns `1`/`2` for `PLAYER`/`GUEST`)

- [ ] **Step 5: Commit**

```bash
cd app && git add src/services/session.service.ts tests/services/session.service.test.ts
git commit -m "feat: mint and return a DARTBOT seat from createSession"
```

---

## Task 8: `session-mode-resolution.ts` — delete the collapse, widen the round trip

**Files:**
- Modify: `app/src/lib/game/session-mode-resolution.ts`
- Test: `app/tests/lib/game/session-mode-resolution.test.ts`

**Interfaces:**
- Consumes: the widened `SeatFact` (Task 4).
- Produces: `seatsFromParticipants` is **deleted**. `startSessionInput`/`reseatSnapshot` build seats through a new private `toSeatFacts`. `participantsFromSeats` gains a `DARTBOT` branch. `participantsFromGuests(guests, bot?)` gains an optional second parameter, consumed by Task 10.

- [ ] **Step 1: Write the failing tests**

In `app/tests/lib/game/session-mode-resolution.test.ts`, replace the import line:

```ts
import {
  participantsFromGuests,
  participantsFromSeats,
  resolveSessionModePair,
  startSessionInput,
} from "@lib/game/session-mode-resolution";
```

Delete the whole `describe("seatsFromParticipants", ...)` block (lines 87–109 in the current file) — the function no longer exists.

Append a new test to the existing `describe("startSessionInput", ...)` block:

```ts
  it("carries a DARTBOT participant's dartbot payload into the composed seat", () => {
    const input = startSessionInput({
      gameTypeKey: "BOBS27",
      rulesetVersionKey: "BOBS27_V1",
      session: {
        sessionId: "s1",
        participants: [
          { ref: "a", participantTypeKey: "PLAYER", displayName: "Levi" },
          {
            ref: "b",
            participantTypeKey: "DARTBOT",
            displayName: "DartBot",
            dartbot: { level: 8, seed: 42, levelSource: "MANUAL" },
          },
        ],
      },
      templateRef: "tpl-1",
      configSnapshot: {},
      modePair: {
        captureModeKey: "RECREATIONAL",
        inputModeKey: "DETAILED_DARTS",
      },
    });

    expect(input.configSnapshot).toEqual({
      seats: [
        {
          participantRef: "a",
          displayName: "Levi",
          sideKey: "A",
          participantTypeKey: "PLAYER",
        },
        {
          participantRef: "b",
          displayName: "DartBot",
          sideKey: "B",
          participantTypeKey: "DARTBOT",
          dartbot: { level: 8, seed: 42, levelSource: "MANUAL" },
        },
      ],
    });
  });
```

Append to `describe("participantsFromSeats", ...)`:

```ts
  it("returns a DARTBOT participant carrying its level, never a displayName", () => {
    expect(
      participantsFromSeats([
        {
          participantRef: "p1",
          displayName: "Levi",
          sideKey: "A",
          participantTypeKey: "PLAYER",
        },
        {
          participantRef: "p2",
          displayName: "DartBot",
          sideKey: "B",
          participantTypeKey: "DARTBOT",
          dartbot: { level: 11, seed: 42, levelSource: "MANUAL" },
        },
      ]),
    ).toEqual([
      { participantTypeKey: "PLAYER", sideKey: "A" },
      { participantTypeKey: "DARTBOT", level: 11, sideKey: "B" },
    ]);
  });
```

Append to `describe("participantsFromGuests", ...)`:

```ts
  it("seats a DARTBOT opponent at level when a bot is given, ignoring any guests", () => {
    expect(
      participantsFromGuests([{ displayName: "Rosa" }], { level: 12 }),
    ).toEqual([
      { participantTypeKey: "PLAYER", sideKey: "A" },
      { participantTypeKey: "DARTBOT", level: 12, sideKey: "B" },
    ]);
  });

  it("omits the field entirely when there is no guest and no bot", () => {
    expect(participantsFromGuests([], null)).toBeUndefined();
    expect(participantsFromGuests([], undefined)).toBeUndefined();
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/session-mode-resolution.test.ts`
Expected: FAIL — `seatsFromParticipants` still exported (or the deleted-block test file fails to compile once Step 3 removes it); `participantsFromSeats`/`participantsFromGuests` don't yet know DARTBOT

- [ ] **Step 3: Write minimal implementation**

In `app/src/lib/game/session-mode-resolution.ts`, delete `seatsFromParticipants` entirely and replace it with a private helper placed where it was:

```ts
/**
 * Maps the participants a session-create call minted or a finished session
 * played with into `SeatFact[]` — the shape the configuration snapshot
 * carries. Private: both `startSessionInput` and `reseatSnapshot` need the
 * identical mapping, and it is no longer the "coerce anything-not-GUEST to
 * PLAYER" function `seatsFromParticipants` used to be (the anti-pattern
 * `08-DartBot.md` names — a bot seat silently held as the human player).
 * Every participant type round-trips as itself.
 */
function toSeatFacts(
  participants: {
    ref: string;
    participantTypeKey: "PLAYER" | "GUEST" | "DARTBOT";
    displayName: string;
    dartbot?: { level: number; seed: number; levelSource: "MANUAL" };
  }[],
): SeatFact[] {
  return participants.map((participant, index) => {
    const sideKey = String.fromCharCode(65 + index);
    if (participant.participantTypeKey === "DARTBOT" && participant.dartbot) {
      return {
        participantRef: participant.ref,
        displayName: participant.displayName,
        sideKey,
        participantTypeKey: "DARTBOT",
        dartbot: participant.dartbot,
      };
    }
    return {
      participantRef: participant.ref,
      displayName: participant.displayName,
      sideKey,
      participantTypeKey:
        participant.participantTypeKey === "GUEST" ? "GUEST" : "PLAYER",
    };
  });
}
```

Update `startSessionInput`'s parameter type and body — replace its `session.participants` field type and the `seats:` line:

```ts
export function startSessionInput<TConfig extends object>(input: {
  gameTypeKey: string;
  rulesetVersionKey: RulesetVersionKey;
  session: {
    sessionId: string;
    participants: {
      ref: string;
      participantTypeKey: "PLAYER" | "GUEST" | "DARTBOT";
      displayName: string;
      dartbot?: { level: number; seed: number; levelSource: "MANUAL" };
    }[];
  };
  templateRef: string;
  configSnapshot: TConfig;
  modePair: ModePair;
}) {
  return {
    gameTypeKey: input.gameTypeKey,
    rulesetVersionKey: input.rulesetVersionKey,
    sessionId: input.session.sessionId,
    templateRef: input.templateRef,
    configSnapshot: {
      ...input.configSnapshot,
      seats: toSeatFacts(input.session.participants),
    } as Seated<TConfig>,
    captureModeKey: input.modePair.captureModeKey,
    inputModeKey: input.modePair.inputModeKey,
  };
}
```

Replace `participantsFromSeats`:

```ts
export function participantsFromSeats(seats: readonly SeatFact[]):
  | {
      participantTypeKey: "PLAYER" | "GUEST" | "DARTBOT";
      displayName?: string;
      level?: number;
      sideKey: string;
    }[]
  | undefined {
  if (seats.length < 2) return undefined;
  return seats.map((seat) => {
    if (seat.participantTypeKey === "DARTBOT") {
      return {
        participantTypeKey: "DARTBOT" as const,
        level: seat.dartbot.level,
        sideKey: seat.sideKey,
      };
    }
    return {
      participantTypeKey: seat.participantTypeKey,
      ...(seat.participantTypeKey === "GUEST"
        ? { displayName: seat.displayName }
        : {}),
      sideKey: seat.sideKey,
    };
  });
}
```

Replace `participantsFromGuests`:

```ts
/**
 * The `participants` a setup screen's `createSession` must request, given
 * either the guests the player added or the DartBot opponent they chose — the
 * start-time twin of `participantsFromSeats`, which derives the same shape
 * from a finished session's seats. `bot` and `guests` are mutually exclusive
 * — `guest-list.ts`'s `addTypedGuest`/`addBotOpponent` enforce the single
 * opponent-slot rule that makes this true — and a bot, when present, always
 * wins, matching that same single-slot invariant.
 *
 * Neither given returns `undefined` — the field's own "omit me" value — so a
 * solo session sends exactly the request it always did. The owning player is
 * always seat 0 on side `A`; the opponent takes `B`. `displayName` is carried
 * for a guest only, `level` for a bot only — the player's name is copied
 * server-side from `players.display_name`.
 */
export function participantsFromGuests(
  guests: readonly { displayName: string }[],
  bot?: { level: number } | null,
):
  | {
      participantTypeKey: "PLAYER" | "GUEST" | "DARTBOT";
      displayName?: string;
      level?: number;
      sideKey: string;
    }[]
  | undefined {
  if (guests.length === 0 && !bot) return undefined;
  if (bot) {
    return [
      { participantTypeKey: "PLAYER" as const, sideKey: "A" },
      { participantTypeKey: "DARTBOT" as const, level: bot.level, sideKey: "B" },
    ];
  }
  return [
    { participantTypeKey: "PLAYER" as const, sideKey: "A" },
    ...guests.map((guest, index) => ({
      participantTypeKey: "GUEST" as const,
      displayName: guest.displayName,
      sideKey: String.fromCharCode(66 + index),
    })),
  ];
}
```

`reseatSnapshot`'s body already calls the function under the name `seatsFromParticipants` — update its call and parameter type to match `toSeatFacts`:

```ts
export function reseatSnapshot<TConfig extends object>(
  configSnapshot: TConfig,
  participants: {
    ref: string;
    participantTypeKey: "PLAYER" | "GUEST" | "DARTBOT";
    displayName: string;
    dartbot?: { level: number; seed: number; levelSource: "MANUAL" };
  }[],
): Seated<TConfig> {
  return {
    ...configSnapshot,
    seats: toSeatFacts(participants),
  } as Seated<TConfig>;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/session-mode-resolution.test.ts`
Expected: PASS — all tests green

- [ ] **Step 5: Typecheck the whole app**

Run: `cd app && npx tsc --noEmit`
Expected: 0 errors — this closes out the type errors Tasks 4–5 deliberately left open

- [ ] **Step 6: Commit**

```bash
cd app && git add src/lib/game/session-mode-resolution.ts tests/lib/game/session-mode-resolution.test.ts
git commit -m "feat: delete seatsFromParticipants' PLAYER fallback, admit DARTBOT everywhere it collapsed"
```

---

## Task 9: `guest-list.ts` — the single-opponent-slot bot path

**Files:**
- Modify: `app/src/lib/game/guest-list.ts`
- Modify: `app/src/lib/game/types.ts`
- Test: `app/tests/lib/game/guest-list.test.ts`

**Interfaces:**
- Consumes: `DEFAULT_BOT_LEVEL` (Task 2).
- Produces: `addBotOpponent(context: GuestListContext): boolean`. `GuestListContext` gains `bot?: { level: number } | null` and `showOpponentChooser?: boolean`. `addTypedGuest`'s refusal widens.
- Consumed by: Task 10 (`setup-controller.ts`), Task 11 (the chooser modal's `@click`).

- [ ] **Step 1: Write the failing tests**

In `app/tests/lib/game/guest-list.test.ts`, widen the `context()` helper and import:

```ts
import { describe, it, expect } from "vitest";
import { addBotOpponent, addTypedGuest } from "@lib/game/guest-list";
import type { GuestListContext } from "@lib/types";

function context(overrides: Partial<GuestListContext> = {}): GuestListContext {
  return {
    guests: [],
    newGuestName: "",
    showAddGuestModal: true,
    bot: null,
    showOpponentChooser: true,
    ...overrides,
  };
}
```

Add a new test to the existing `describe("addTypedGuest", ...)` block:

```ts
  it("refuses when a bot already occupies the opponent slot", () => {
    const state = context({ bot: { level: 8 }, newGuestName: "Rosa" });

    expect(addTypedGuest(state)).toBe(false);
    expect(state.guests).toEqual([]);
  });
```

Append a new describe block:

```ts
describe("addBotOpponent", () => {
  it("seats a level-8 DartBot and closes the chooser", () => {
    const state = context();

    expect(addBotOpponent(state)).toBe(true);
    expect(state.bot).toEqual({ level: 8 });
    expect(state.showOpponentChooser).toBe(false);
  });

  it("refuses a second bot", () => {
    const state = context({ bot: { level: 8 } });

    expect(addBotOpponent(state)).toBe(false);
    expect(state.bot).toEqual({ level: 8 });
  });

  it("refuses when a guest already occupies the opponent slot", () => {
    const state = context({ guests: [{ displayName: "Rosa" }] });

    expect(addBotOpponent(state)).toBe(false);
    expect(state.bot).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/guest-list.test.ts`
Expected: FAIL — `addBotOpponent` is not exported; `GuestListContext` has no `bot`/`showOpponentChooser`

- [ ] **Step 3: Write minimal implementation**

In `app/src/lib/game/types.ts`, replace the `GuestListContext` type (the file's last block):

```ts
/**
 * The opponent-slot state every setup screen's add-a-guest modal drives.
 * `bot` occupies the same single slot a guest would — `addTypedGuest` and
 * `addBotOpponent` (`guest-list.ts`) each refuse when the other is already
 * seated, so the two are mutually exclusive by construction, not by a type
 * that forbids both. Both fields are optional because only the three
 * DartBot-enabled setup screens (`createPresetSetupController`) ever
 * populate them — the other six never set `bot`/`showOpponentChooser`, so
 * they read as `undefined`/falsy and the guest-only flow is unchanged.
 */
export type GuestListContext = {
  guests: { displayName: string }[];
  newGuestName: string;
  showAddGuestModal: boolean;
  bot?: { level: number } | null;
  showOpponentChooser?: boolean;
};
```

Also widen `PresetSetupContext` (around line 519) — add these fields/methods to its object type, alongside the existing `guests`/`addGuest`/`removeGuest`:

```ts
export type PresetSetupContext = {
  presets: ConfigurationPresetData[];
  loading: boolean;
  error: string;
  guests: { displayName: string }[];
  showAddGuestModal: boolean;
  newGuestName: string;
  bot: { level: number } | null;
  showOpponentChooser: boolean;
  activeSession: SessionActiveData | null;
  showActiveSessionModal: boolean;
  loadingReconciliation: boolean;
  reconciliationFailed: boolean;
  $store: {
    game: {
      sessionId: string | null;
      reset: () => void;
      startSession: (input: unknown) => void;
    };
    settings: {
      captureModeKey: string;
      inputModeKey: string;
    };
  };
  init(this: PresetSetupContext): Promise<void>;
  reconcile(
    this: PresetSetupContext,
    activeSessions: SessionActiveData[],
  ): Promise<void>;
  retryReconciliation(this: PresetSetupContext): Promise<void>;
  continueSession(this: PresetSetupContext): void;
  abandonSession(this: PresetSetupContext): Promise<void>;
  addGuest(this: PresetSetupContext): void;
  addBot(this: PresetSetupContext): void;
  removeGuest(this: PresetSetupContext, index: number): void;
  removeBot(this: PresetSetupContext): void;
  start(this: PresetSetupContext): Promise<void>;
};
```

> Note: read the current block first (`app/src/lib/game/types.ts:519-552`) and edit it in place — reproduce every existing field exactly as it is today (including the `$store`/`presets`/etc. shapes and the trailing fields after `start`, if any exist beyond what's shown above), adding only `bot`, `addBot`, `showOpponentChooser` and `removeBot`. Do not drop or reorder any existing field.

In `app/src/lib/game/guest-list.ts`, widen the import and add `DEFAULT_BOT_LEVEL`:

```ts
import { DEFAULT_BOT_LEVEL } from "@lib/game/rulesets/capabilities";
import type { GuestListContext } from "./types";
```

Widen `addTypedGuest`'s guard:

```ts
export function addTypedGuest(context: GuestListContext): boolean {
  if (context.guests.length >= 1 || context.bot) return false;
  const name = context.newGuestName.trim();
  if (!name) return false;

  context.guests.push({ displayName: name });
  context.newGuestName = "";
  context.showAddGuestModal = false;
  return true;
}
```

Append `addBotOpponent`:

```ts
/**
 * Seats a DartBot opponent from the setup screen's chooser (D-J), mirroring
 * `addTypedGuest`'s single-opponent-slot refusal — a bot and a guest can
 * never both be seated. `level` is fixed at `DEFAULT_BOT_LEVEL`: phase 4
 * ships the admission path only, no level picker (`08-DartBot.md` §Delivery
 * Phases).
 * @returns whether a bot was actually seated, mirroring `addTypedGuest`'s
 *   own boolean contract.
 */
export function addBotOpponent(context: GuestListContext): boolean {
  if (context.guests.length >= 1 || context.bot) return false;
  context.bot = { level: DEFAULT_BOT_LEVEL };
  context.showOpponentChooser = false;
  return true;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/guest-list.test.ts`
Expected: PASS — all tests green

- [ ] **Step 5: Commit**

```bash
cd app && git add src/lib/game/guest-list.ts src/lib/game/types.ts tests/lib/game/guest-list.test.ts
git commit -m "feat: seat a DartBot opponent from the single opponent slot"
```

---

## Task 10: `setup-controller.ts` — bot state and `start()` wiring

**Files:**
- Modify: `app/src/lib/game/setup-controller.ts`
- Test: `app/tests/lib/game/setup-controller.test.ts`

**Interfaces:**
- Consumes: `addBotOpponent` (Task 9), the widened `participantsFromGuests` (Task 8).
- Produces: every `createPresetSetupController` instance gains `bot`, `showOpponentChooser`, `addBot()`, `removeBot()`; `start()` sends `participantsFromGuests(this.guests, this.bot)`.

- [ ] **Step 1: Write the failing tests**

Append to `app/tests/lib/game/setup-controller.test.ts`, as a sibling to the existing `describe("guest wiring", ...)` block (reuse its `bobs27()`/`BOBS27_PRESET` helpers, defined in that block — place this new block right after it, inside the outer `describe("createPresetSetupController", ...)`):

```ts
  describe("bot wiring", () => {
    const BOBS27_PRESET = {
      configurationTemplateId: "tmpl-1",
      gameTypeKey: "BOBS27",
      name: "Bob's 27 — Standard",
      description: null,
      configuration: {},
      isSystemTemplate: true,
    } as any;

    function bobs27(): PresetSetupContext {
      return {
        ...createPresetSetupController<PresetSetupContext>({
          gameTypeKey: "BOBS27",
          rulesetVersionKey: "BOBS27_V1",
          playHref: "/games/bobs27/play",
          label: "Bob's 27",
        }),
        $store: store,
      } as PresetSetupContext;
    }

    it("addBot seats a level-8 DartBot and start() sends a 2-seat DARTBOT participants array", async () => {
      const setup = bobs27();
      setup.presets = [BOBS27_PRESET];
      vi.mocked(sessionsApi.createSession).mockResolvedValue(SESSION);

      setup.addBot();
      expect(setup.bot).toEqual({ level: 8 });

      await setup.start();

      expect(sessionsApi.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          participants: [
            { participantTypeKey: "PLAYER", sideKey: "A" },
            { participantTypeKey: "DARTBOT", level: 8, sideKey: "B" },
          ],
        }),
      );
    });

    it("addBot refuses when a guest is already seated", () => {
      const setup = bobs27();
      setup.newGuestName = "Guest 1";
      setup.addGuest();

      setup.addBot();

      expect(setup.bot).toBeNull();
    });

    it("addGuest refuses when a bot is already seated", () => {
      const setup = bobs27();
      setup.addBot();

      setup.newGuestName = "Guest 1";
      setup.addGuest();

      expect(setup.guests).toEqual([]);
    });

    it("removeBot clears the seated bot", () => {
      const setup = bobs27();
      setup.addBot();

      setup.removeBot();

      expect(setup.bot).toBeNull();
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/setup-controller.test.ts`
Expected: FAIL — `setup.addBot`/`setup.bot`/`setup.removeBot` do not exist

- [ ] **Step 3: Write minimal implementation**

In `app/src/lib/game/setup-controller.ts`, widen the import:

```ts
import { addBotOpponent, addTypedGuest } from "@lib/game/guest-list";
```

Add `bot`/`showOpponentChooser` to the returned object's state, alongside the existing `guests`:

```ts
    guests: [] as { displayName: string }[],
    showAddGuestModal: false,
    newGuestName: "",
    bot: null as { level: number } | null,
    showOpponentChooser: false,
```

Add `addBot`/`removeBot`, alongside the existing `addGuest`/`removeGuest`:

```ts
    addGuest(this: Ctx) {
      addTypedGuest(this);
    },

    addBot(this: Ctx) {
      addBotOpponent(this);
    },

    removeGuest(this: Ctx, index: number) {
      this.guests.splice(index, 1);
    },

    removeBot(this: Ctx) {
      this.bot = null;
    },
```

In `start()`, replace the `participantsFromGuests` call:

```ts
        const participants = participantsFromGuests(this.guests, this.bot);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/setup-controller.test.ts`
Expected: PASS — all tests green

- [ ] **Step 5: Typecheck the whole app**

Run: `cd app && npx tsc --noEmit`
Expected: 0 errors

- [ ] **Step 6: Commit**

```bash
cd app && git add src/lib/game/setup-controller.ts tests/lib/game/setup-controller.test.ts
git commit -m "feat: wire a DartBot opponent through createPresetSetupController"
```

---

## Task 11: The setup-screen chooser (D-J)

**Files:**
- Modify: `app/src/components/layout/games/setup/AddGuestButton.astro`
- Create: `app/src/components/layout/games/setup/OpponentChooserModal.astro`
- Modify: `app/src/components/layout/games/setup/GuestSection.astro`
- Modify: `app/src/components/layout/games/setup/UserSection.astro`

**Interfaces:**
- Consumes: `addBot()`/`removeBot()`/`bot`/`showOpponentChooser` (Task 10), `showAddGuestModal` (existing).

Astro markup logic is not unit-tested (D101, `app/CLAUDE.md`) — this task's verification is a manual dev-server check (Step 4) rather than a Vitest run, and is exempt from the D224 coverage gate.

- [ ] **Step 1: `AddGuestButton.astro`**

Replace the file:

```astro
---
/**
 * @param {boolean} [allowDartbot=false] When true, the button opens the
 * Guest/DartBot chooser (`OpponentChooserModal.astro`, D-J) instead of
 * jumping straight to the guest-name modal. `GuestSection.astro` only sets
 * this true from a setup screen `supportsDartbot()` admits.
 */
interface Props {
  allowDartbot?: boolean;
}

// Props
const { allowDartbot = false }: Props = Astro.props;

// Components
import IconBtn from "@components/forms/IconBtn.astro";

// Icons
import PlusIcon from "@icons/plus.svg";
---

<div
  class="flex flex-col gap-1 items-center justify-center"
  x-show="guests.length < 1 && !bot"
  x-cloak
>
  <IconBtn
    type="button"
    variant="dashed"
    ariaLabel="Add opponent"
    @click={
      allowDartbot
        ? "showOpponentChooser = true"
        : "showAddGuestModal = true"
    }
    class="p-3 border-2"
  >
    <PlusIcon class="size-8" />
  </IconBtn>
  <span
    class="text-sm invisible"
    aria-hidden="true"
  >
    &nbsp;
  </span>
</div>
```

- [ ] **Step 2: New `OpponentChooserModal.astro`**

```astro
---
/**
 * D-J's two-step chooser: the add-opponent button (`AddGuestButton.astro`)
 * opens this first when the setup screen supports a bot (`allowDartbot`),
 * offering Guest or DartBot. Choosing Guest falls through to the existing
 * `GuestNameModal`; choosing DartBot seats one directly — `addBot()` needs no
 * typed input, unlike a guest's name. Parent (`GuestSection.astro`) owns
 * `showOpponentChooser`, mirroring `GuestNameModal.astro`'s ownership split.
 */

// Components
import Modal from "@components/ui/Modal.astro";
import Button from "@components/forms/Button.astro";
---

<Modal
  titleId="opponent-chooser-title"
  onDismiss="showOpponentChooser = false"
>
  <h2
    id="opponent-chooser-title"
    class="text-lg font-semibold text-foreground"
  >
    Add Opponent
  </h2>

  <div
    slot="footer"
    class="mt-6 flex gap-3"
  >
    <Button
      type="button"
      variant="secondary"
      class="flex-1"
      title="Guest"
      @click="showOpponentChooser = false; showAddGuestModal = true"
    />
    <Button
      type="button"
      class="flex-1"
      title="DartBot"
      @click="addBot()"
    />
  </div>
</Modal>
```

- [ ] **Step 3: `GuestSection.astro`**

Replace the file:

```astro
---
// Components
import AddGuestButton from "./AddGuestButton.astro";
import GuestNameModal from "./GuestNameModal.astro";
import OpponentChooserModal from "./OpponentChooserModal.astro";
import IconBtn from "@components/forms/IconBtn.astro";

// Icons
import UserIcon from "@icons/user.svg";
import TargetIcon from "@icons/target.svg";
import CrossIcon from "@icons/cross.svg";

interface Props {
  allowDartbot?: boolean;
}

// Props
const { allowDartbot = false }: Props = Astro.props;
---

<template
  x-for="(g, i) in guests"
  :key="i"
>
  <div class="relative">
    <div class="flex flex-col gap-1 items-center justify-center">
      <div
        class="p-3 border-x border-t w-fit border-sky-500/70 rounded-full bg-tab-active"
      >
        <UserIcon
          class="size-8 drop-shadow-lg drop-shadow-sky-700/40 text-sky-500"
        />
      </div>
      <span
        class="text-sm text-accent font-semibold"
        x-text="g.displayName"
      ></span>
    </div>
    <IconBtn
      type="button"
      variant="ghost"
      ariaLabel="Remove guest"
      :aria-label="`Remove ${g.displayName}`"
      @click="removeGuest(i)"
      class="absolute -top-1 -right-1 p-0.5 bg-tab-card text-accent flex justify-center items-center"
    >
      <CrossIcon class="size-4" />
    </IconBtn>
  </div>
</template>

<template x-if="bot">
  <div class="relative">
    <div class="flex flex-col gap-1 items-center justify-center">
      <div
        class="p-3 border-x border-t w-fit border-sky-500/70 rounded-full bg-tab-active"
      >
        <TargetIcon
          class="size-8 drop-shadow-lg drop-shadow-sky-700/40 text-sky-500"
        />
      </div>
      <span class="text-sm text-accent font-semibold">DartBot</span>
    </div>
    <IconBtn
      type="button"
      variant="ghost"
      ariaLabel="Remove DartBot"
      @click="removeBot()"
      class="absolute -top-1 -right-1 p-0.5 bg-tab-card text-accent flex justify-center items-center"
    >
      <CrossIcon class="size-4" />
    </IconBtn>
  </div>
</template>

<AddGuestButton allowDartbot={allowDartbot} />

<template x-if="showAddGuestModal">
  <GuestNameModal />
</template>

<template x-if="showOpponentChooser">
  <OpponentChooserModal />
</template>
```

- [ ] **Step 4: `UserSection.astro`**

Replace the file:

```astro
---
/**
 * @param {boolean} [allowGuests=false] Renders `GuestSection` (add-guest
 * button, guest avatars, name modal) beside the owner icon. Every ruleset
 * this session's own `session-seats.service.ts` caps at 1 seat still 400s a
 * 2nd participant regardless of what this prop renders — the prop only
 * controls the setup screen's own markup, never the server-side cap.
 * @param {boolean} [allowDartbot=false] Forwarded to `GuestSection` — offers
 * the DartBot branch of its opponent chooser (D-J). Meaningless without
 * `allowGuests`, since the chooser only renders inside `GuestSection`.
 */
interface Props {
  allowGuests?: boolean;
  allowDartbot?: boolean;
}

// Props
const { allowGuests = false, allowDartbot = false }: Props = Astro.props;

// Components
import UserIconDisplay from "./UserIconDisplay.astro";
import GuestSection from "./GuestSection.astro";
---

<div
  class="bg-tab-card border-tab-border rounded-3xl p-4 border flex flex-col items-start justify-start gap-4"
>
  <h2 class="text-base text-center w-full">Players</h2>
  {
    allowGuests ? (
      <div class="flex flex-row items-start gap-4">
        <UserIconDisplay
          name="User"
          nameExpr="$store.profile.displayName || 'User'"
        />
        <GuestSection allowDartbot={allowDartbot} />
      </div>
    ) : (
      <UserIconDisplay
        name="User"
        nameExpr="$store.profile.displayName || 'User'"
      />
    )
  }
</div>
```

- [ ] **Step 5: Manual verification**

Run: `cd app && astro dev --background`, then confirm it started with `astro dev status`.

Load `http://localhost:<port>/games/bobs27/setup` (or the dev port `astro dev status` reports) in a browser (or via a Playwright script, per the `run` skill's fallback pattern for this project). Confirm:
- The add-opponent button opens the Guest/DartBot chooser (not the guest-name modal directly).
- Choosing "Guest" opens the existing guest-name modal exactly as before.
- Choosing "DartBot" seats a DartBot avatar (target icon) with a working remove badge, and hides the add-opponent button while it's seated.
- Load `http://localhost:<port>/games/501/setup` and confirm the add-opponent button still opens the guest-name modal directly (unchanged — `allowDartbot` is not passed there).

Session *creation* cannot be exercised end-to-end without `DATABASE_URL`/Neon credentials in this sandbox (the established D193 precedent) — note this explicitly in the completion report rather than claiming a full click-through was verified.

Stop the dev server: `cd app && astro dev stop`.

- [ ] **Step 6: Commit**

```bash
cd app && git add src/components/layout/games/setup/AddGuestButton.astro src/components/layout/games/setup/OpponentChooserModal.astro src/components/layout/games/setup/GuestSection.astro src/components/layout/games/setup/UserSection.astro
git commit -m "feat: add the Guest/DartBot opponent chooser to the setup screen"
```

---

## Task 12: Wire the three DartBot-enabled setup forms

**Files:**
- Modify: `app/src/components/layout/games/setup/AroundTheClockSetupForm.astro`
- Modify: `app/src/components/layout/games/setup/Bobs27SetupForm.astro`
- Modify: `app/src/components/layout/games/setup/DoublesTrainingSetupForm.astro`

**Interfaces:**
- Consumes: `supportsDartbot` (Task 2), `allowDartbot` (Task 11).

No test — mirrors the other setup forms' untested `.astro` frontmatter (D101).

- [ ] **Step 1: `AroundTheClockSetupForm.astro`**

Add the import and widen the `UserSection` line:

```astro
---
// Components
import InfoSection from "@components/ui/InfoSection.astro";
import SetupShell from "./SetupShell.astro";
import UserSection from "./UserSection.astro";
import { supportsDartbot } from "@lib/game/rulesets/capabilities";

// Data
const infoSection = {
  title: "Around the Clock rules",
  description:
    "Hit every number from 1 through 20 in order, then finish on the bull. Any single, double, or treble of the current number counts — a hit advances immediately, so a great turn can clear several numbers in three darts. The bull needs one hit, outer or inner, and ends the session the moment it lands.",
};
---

<SetupShell title="Around the Clock">
  <UserSection
    allowGuests
    allowDartbot={supportsDartbot("AROUND_THE_CLOCK_V1")}
  />
  <InfoSection
    title={infoSection.title}
    description={infoSection.description}
  />
</SetupShell>
```

- [ ] **Step 2: `Bobs27SetupForm.astro`**

```astro
---
// Components
import InfoSection from "@components/ui/InfoSection.astro";
import SetupShell from "./SetupShell.astro";
import UserSection from "./UserSection.astro";
import { supportsDartbot } from "@lib/game/rulesets/capabilities";

// Data
const infoSection = {
  title: "Bob's 27 rules",
  description:
    "3 targets at the designated double, for each double hit, add the double's board value to your total. For each three darts missed, deduct the target double's board value from your total. E.g. miss all three darts at D18 → deduct 36; hit two D16 → add 2 × 32 = 64.",
};
---

<SetupShell title="Bob's 27">
  <UserSection
    allowGuests
    allowDartbot={supportsDartbot("BOBS27_V1")}
  />
  <InfoSection
    title={infoSection.title}
    description={infoSection.description}
  />
</SetupShell>
```

- [ ] **Step 3: `DoublesTrainingSetupForm.astro`**

```astro
---
// Components
import InfoSection from "@components/ui/InfoSection.astro";
import SetupShell from "./SetupShell.astro";
import SettingSectionShell from "./SettingSectionShell.astro";
import Toggle from "./Toggle.astro";
import UserSection from "./UserSection.astro";
import { supportsDartbot } from "@lib/game/rulesets/capabilities";

// Data
const infoSection = {
  title: "Doubles training rules",
  description:
    "Work through every double and the bull, in the order you choose below. Three darts per target — hit the double and move on immediately; miss all three and you still move on. On the bull, only the inner bull (double bull) counts.",
};

const orderModeOpts = [
  { value: "LOW_TO_HIGH", label: "Low → High" },
  { value: "HIGH_TO_LOW", label: "High → Low" },
  { value: "RANDOM", label: "Random" },
];

const labelClass = "text-xs text-muted-foreground italic ml-2 ";
---

<SetupShell title="Doubles training">
  <UserSection
    allowGuests
    allowDartbot={supportsDartbot("DOUBLES_TRAINING_V1")}
  />
  <InfoSection
    title={infoSection.title}
    description={infoSection.description}
  />
  <SettingSectionShell>
    <label class={labelClass}>Target order</label>
    <Toggle
      orientation="horizontal"
      options={orderModeOpts}
      x-model="orderMode"
      class="w-full"
    />
  </SettingSectionShell>
</SetupShell>
```

- [ ] **Step 4: Run the full suite**

Run: `cd app && npm test`
Expected: all suites pass, no regressions in the untouched six setup forms

- [ ] **Step 5: Commit**

```bash
cd app && git add src/components/layout/games/setup/AroundTheClockSetupForm.astro src/components/layout/games/setup/Bobs27SetupForm.astro src/components/layout/games/setup/DoublesTrainingSetupForm.astro
git commit -m "feat: offer a DartBot opponent on the three rulesets that admit one"
```

---

## Task 13: Context maintenance and full validation

**Files:** `docs/architecture/00-Context-Map-History.md`, `decisions/**` (only if a real alternative was weighed — see below), `FINDINGS.md` (no change expected — F45 is cited, not touched), `00-File-Inventory.md` (only if any file's char/token estimate materially shifts).

- [ ] **Step 1: Run `run-all-gates`**

Invoke the `run-all-gates` skill (dispatches the changed-area `check-*.sh` scripts and `validate:app`). Confirm every gate passes, including:
- `npm test` — full suite green
- `npx fallow` — exits 0, maintainability/duplication within threshold
- `astro check --minimumFailingSeverity hint` — 0 errors/0 warnings/0 hints
- `scripts/check-test-coverage.sh` — every touched runtime `.ts` file has a covering test (Tasks 1–10 each added one; Tasks 11–12 are `.astro`-only, exempt)
- `scripts/check-findings-log.sh` — passes; this plan cites F45 but does not close it (still open, still someone else's to fix)
- `db:status`/`db:migrate`/`db:introspect` — expected to be unable to run in this sandbox (no `DATABASE_URL`, the established D193 precedent); this phase added no migration, so nothing here should differ from that precedent

- [ ] **Step 2: Invoke `context-maintenance`**

Follow its procedure exactly. Expected updates:
- `docs/architecture/00-Context-Map-History.md` — new version entry summarizing this phase (seat admission, the three-ruleset scope decision, F45 citation, validation results).
- `decisions/**` — **only** if a real alternative was weighed and rejected during implementation (e.g., if the executor reconsiders the `RULESET_DARTBOT` placement in `capabilities.ts` vs. literally beside `SEAT_CAPS`, that choice — with its rationale — is exactly the kind of thing `decisions/game-engine.md` or `decisions/api.md` records). If nothing beyond what this plan already decided came up, no new decision block is needed — this plan's own rationale sections are not decisions on their own.
- `00-File-Inventory.md` — update char/4 token estimates for every file this phase touched by more than a trivial amount.

- [ ] **Step 3: Confirm the branch is ready to integrate**

Confirm: no uncommitted changes (`git status`), all 12 preceding commits present, branch is a single hop off `main` (not stacked on the recovered `claude/dartbot-3-dictated-strategy` branch — this plan's branch and that one are independent, both single hops off `main`, satisfying the branch-stacking cap).

Per `finishing-a-development-branch`, present merge/PR/cleanup options to the user rather than deciding unilaterally.

---

## Self-Review

**Spec coverage** (against `08-DartBot.md`'s persistence-gap table, `08-DartBot.md` Delivery Phases row 4, and the delivery design's phase-4 inheritance list):

| Named item | Task |
|---|---|
| `ParticipantInput.participantTypeKey` widened | 3 |
| `app/tests/pages/api/sessions/types.test.ts:38`'s inverted test rewritten (not deleted) | 3 |
| `SeatFact.participantTypeKey` widened, third member holds `level`/`seed` | 4 |
| `composeSeatFacts()` third branch | 6 |
| `seatsFromParticipants()` third branch → **deleted**, replaced by corrected private mapping | 8 |
| `participantsFromSeats()` third branch carrying `level` | 8 |
| `buildSeatPlan()`/`loadCreateSessionLookups()` resolve `DARTBOT` type id, set `displayName: "DartBot"` server-side | 7 |
| `display_name = 'DartBot'` CHECK respected (server never trusts a client value) | 7 |
| `SEAT_CAPS` — "nothing for the count" (no change needed); the new `dartbot` flag | 2, 6 (gate only, no cap edit) |
| One seat per side; a bot is its own side and not a `PLAYER` | 6 (generic side-uniqueness check already covers this; no bot-specific code needed) |
| D-J: existing add-opponent button opens a two-step chooser, no new screen | 9, 11 |
| D-J: DartBot branch renders only where `RULESET_DARTBOT` is true | 2, 11, 12 |
| Anti-pattern: bot seat reaching the snapshot through `seatsFromParticipants()`'s `PLAYER` fallback | 8 (function deleted) |
| Anti-pattern: bot seat persisted through `composeSeatFacts()`'s `GUEST` fallback | 6 |
| Anti-pattern: admitting DARTBOT at the wire before both collapses are fixed | 3 lands after 6 and 8 are designed together in this same plan — both collapses are fixed in the same branch before merge |
| Gate: session creatable with a bot seat | 7 |
| Gate: `display_name` copied server-side | 7 |
| Gate: seat round-trips as DARTBOT in both directions | 6 (write), 8 (read) |
| Gate: inverted test rewritten rather than deleted | 3 |

**Placeholder scan:** none found — every step carries complete code, exact file paths, and exact commands.

**Type consistency:** `SeatFact`'s DARTBOT branch (`{ participantRef; displayName; sideKey; participantTypeKey: "DARTBOT"; dartbot: {level; seed; levelSource} }`, Task 4) is the single shape every other file's `dartbot` field matches — `SeatPlan.dartbot` (Task 5), `ParticipantRef.dartbot`/`CreateSessionResult.participants[].dartbot` (Tasks 3, 5, 7), and every function signature that carries a `dartbot` parameter (Task 8's `toSeatFacts`, `startSessionInput`, `reseatSnapshot`) all use the identical `{ level: number; seed: number; levelSource: "MANUAL" }` literal.

**Scope:** confined to seat admission — no play-loop, no write-path persistence beyond the participant row (`participants` insert only; `turns`/`darts` are untouched, phase 5's own deferral), no DartBot-module code. The three-ruleset narrowing (vs. the doc's five) is a deliberate, disclosed scope decision driven by an already-logged, already-deferred finding (F45) — not a silent cut.

**Ambiguity:** none left open. The one genuine design gap the architecture doc left unstated — where `RULESET_DARTBOT` physically lives — is resolved by precedent (`RULESET_CAPABILITIES`'s existing frontend/backend-shared placement) and stated explicitly in Global Constraints, not left for the executor to guess.
