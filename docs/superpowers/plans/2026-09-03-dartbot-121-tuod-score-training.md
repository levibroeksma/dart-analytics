# DartBot opponent for 121, TUOD, Score Training Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a player seat a DartBot opponent on 121, Ten Up One Down (TUOD), and Score Training — currently guest-only — and have that bot actually throw.

**Architecture:** 121 and TUOD reuse the already-shipped `x01.strategy.module.ts` checkout router unchanged (both are checkout-ladder games with the identical `{ remaining, checkoutPath }` decision shape 501 already has); Score Training gets a new, trivial `scoring.strategy.module.ts` that always aims treble 20 (it has no checkout/decision at all). Each of the three play-data files gets the same `maybeRunBotVisit`/`throwBotDart`/`throwBotQuickScoreDart`/`undoVisit` wiring `five-oh-one-play.data.ts` and `shanghai-play.data.ts` already carry. Each of the three setup-data files gets the same `addBot`/`removeBot`/`guested()` wiring `five-oh-one-setup.data.ts` and `singles-training-setup.data.ts` already carry.

**Tech Stack:** Astro, TypeScript, Alpine.js, Vitest.

## Global Constraints

- Never put `//` or `/* */` comments inside function/method bodies (`app/CLAUDE.md`).
- A doc comment documents the declaration, never the decision history — cite `(08-DartBot.md)` / `(D-G)` in parentheses, never narrate it.
- Every runtime `.ts` source change needs a covering test in the same commit (D224) — `scripts/check-test-coverage.sh` enforces this.
- `npm run format` before every commit that touches `.astro`/`.ts` files; `npm run validate:app` must be clean (0 errors/warnings/hints) before the branch is done.
- Semantic Tailwind tokens only; no `class:list`; reuse existing components — none of this plan touches markup beyond one `allowDartbot` prop and two `x-if` guards per `.astro` file, so this mostly doesn't apply, but don't hand-roll anything new.
- Tests live under `app/tests/`, mirroring `app/src/`'s structure — never colocated.
- Run each task's tests with `cd app && npx vitest run <path>` before moving on; run the full suite (`cd app && npx vitest run`) before the final commit of the branch.

---

### Task 1: `scoring.strategy.module.ts` — Score Training's bot target

**Files:**
- Create: `app/src/modules/dartbot/strategy/scoring.strategy.module.ts`
- Test: `app/tests/modules/dartbot/strategy/scoring.strategy.module.test.ts`

**Interfaces:**
- Produces: `chooseTarget(): ThrowIntent` — always `{ targetNumber: 20, zoneKey: "TREBLE" }`. No `GameView` parameter; Score Training has no checkout, no decision axis, nothing to route on (`08-DartBot.md` §Guiding Principle: "a weak bot still aims at T20 like everyone else"). Consumed by Task 8.

- [ ] **Step 1: Write the failing test**

```ts
// app/tests/modules/dartbot/strategy/scoring.strategy.module.test.ts
import { describe, expect, it } from "vitest";
import { chooseTarget } from "@modules/dartbot/strategy/scoring.strategy.module";

describe("chooseTarget", () => {
  it("always aims at treble 20 — Score Training has no checkout or decision to route on", () => {
    expect(chooseTarget()).toEqual({ targetNumber: 20, zoneKey: "TREBLE" });
  });

  it("is deterministic across repeated calls, since it reads no state", () => {
    expect(chooseTarget()).toEqual(chooseTarget());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/modules/dartbot/strategy/scoring.strategy.module.test.ts`
Expected: FAIL — `Cannot find module '@modules/dartbot/strategy/scoring.strategy.module'`

- [ ] **Step 3: Write the module**

```ts
// app/src/modules/dartbot/strategy/scoring.strategy.module.ts
import type { ThrowIntent } from "@modules/types";

/**
 * Score Training's whole target: always treble 20. There is no checkout, no
 * double, and no decision axis to route on (D-G, `08-DartBot.md` §Guiding
 * Principle) — a weak bot still aims here, it just can't back it up.
 */
export function chooseTarget(): ThrowIntent {
  return { targetNumber: 20, zoneKey: "TREBLE" };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd app && npx vitest run tests/modules/dartbot/strategy/scoring.strategy.module.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/dartbot/strategy/scoring.strategy.module.ts \
        app/tests/modules/dartbot/strategy/scoring.strategy.module.test.ts
git commit -m "feat: add DartBot's Score Training target strategy (D-G)"
```

---

### Task 2: Admit 121_V1, TUOD_V1, SCORE_TRAINING_V1 into `RULESET_DARTBOT`

**Files:**
- Modify: `app/src/lib/game/rulesets/capabilities.ts:113-122`
- Modify: `app/tests/lib/game/rulesets/capabilities.test.ts:151-165`
- Modify: `app/tests/services/session-seats.service.test.ts:174-178`

**Interfaces:**
- Produces: `supportsDartbot("121_V1")`, `supportsDartbot("TUOD_V1")`, `supportsDartbot("SCORE_TRAINING_V1")` all return `true`. Consumed by Task 3, 4, 5 (setup forms) and by `session-seats.service.ts`'s already-generic `rejectSeatRequest`.

- [ ] **Step 1: Write the failing tests**

Edit `app/tests/lib/game/rulesets/capabilities.test.ts`, replacing the `RULESET_DARTBOT` describe block (lines 151-165):

```ts
describe("RULESET_DARTBOT", () => {
  it("admits the nine rulesets whose bot strategy exists today", () => {
    expect(
      (Object.keys(RULESET_DARTBOT) as (keyof typeof RULESET_DARTBOT)[])
        .filter((key) => RULESET_DARTBOT[key])
        .sort(),
    ).toEqual([
      "121_V1",
      "501_V1",
      "AROUND_THE_CLOCK_V1",
      "BOBS27_V1",
      "DOUBLES_TRAINING_V1",
      "SCORE_TRAINING_V1",
      "SHANGHAI_V1",
      "SINGLES_V1",
      "TUOD_V1",
    ]);
  });
});
```

Edit `app/tests/services/session-seats.service.test.ts`, replacing the "does not admit" test (lines 174-178) — `SCORE_TRAINING_V1` is about to start admitting a bot, so this inverse-guarantee test retargets to a ruleset version that still does not (D255/`app/CLAUDE.md`: re-pointed at the same guarantee, never a different one — the guarantee here is "some ruleset RULESET_DARTBOT still refuses", and `121_V2` is exactly that, unaffected by this task's `121_V1`-only change):

```ts
  it("rejects a DARTBOT seat for a ruleset RULESET_DARTBOT does not admit", () => {
    expect(rejectSeatRequest([player, bot], "121_V2")).toMatch(
      /does not support a DartBot opponent/,
    );
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/rulesets/capabilities.test.ts tests/services/session-seats.service.test.ts`
Expected: FAIL — the `RULESET_DARTBOT` test lists 6 keys, not 9; the retargeted seat test still passes today (121_V2 already isn't admitted) but the removed `SCORE_TRAINING_V1` case is gone, so run it once now only to confirm the `RULESET_DARTBOT` count assertion fails.

- [ ] **Step 3: Widen `RULESET_DARTBOT`**

In `app/src/lib/game/rulesets/capabilities.ts`, replace the `RULESET_DARTBOT` object (lines 113-122) and its doc comment (lines 100-112):

```ts
/**
 * Which ruleset versions currently admit a DartBot opponent seat. `08-DartBot.md`
 * §Delivery Phases names the five rulesets `DictatedStrategy` (phase 3) plays:
 * Around the Clock, Bob's 27, Doubles Training, Shanghai, Singles Training —
 * all five are listed here. `501_V1`, `121_V1` and `TUOD_V1` are on
 * `X01Strategy` (`x01.strategy.module.ts`, reused unchanged — both are
 * checkout-ladder games with 501's identical `{ remaining, checkoutPath }`
 * decision shape). `SCORE_TRAINING_V1` is on `ScoringStrategy`
 * (`scoring.strategy.module.ts`, D-G) — no checkout to route on, so it
 * always aims treble 20. Shanghai V2 and Singles Training V2 can never
 * create *any* 2-seat session today (`FINDINGS.md` F45: both setup screens
 * hardcode their V2 ruleset key with no seat-count branch, so a guest add
 * already 422s at `createSession`), and that gap is explicitly deferred, not
 * this map's to route around. `121_V2` is solo-only by the same reasoning —
 * it never gains a bot seat, only `121_V1` does. Absent keys read as
 * unsupported, exactly like `SEAT_CAPS`'s own "no entry" default in
 * `session-seats.service.ts`.
 */
export const RULESET_DARTBOT: Readonly<
  Partial<Record<RulesetVersionKey, boolean>>
> = {
  AROUND_THE_CLOCK_V1: true,
  BOBS27_V1: true,
  DOUBLES_TRAINING_V1: true,
  SHANGHAI_V1: true,
  SINGLES_V1: true,
  "501_V1": true,
  "121_V1": true,
  TUOD_V1: true,
  SCORE_TRAINING_V1: true,
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/rulesets/capabilities.test.ts tests/services/session-seats.service.test.ts`
Expected: PASS (all tests in both files)

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/rulesets/capabilities.ts \
        app/tests/lib/game/rulesets/capabilities.test.ts \
        app/tests/services/session-seats.service.test.ts
git commit -m "feat: admit 121_V1, TUOD_V1, SCORE_TRAINING_V1 into RULESET_DARTBOT"
```

---

### Task 3: 121 setup — offer and seat a DartBot

**Files:**
- Modify: `app/src/lib/game/types.ts` (`OneTwentyOneSetupContext`, lines 1002-1053)
- Modify: `app/src/lib/game/one-twenty-one-setup.data.ts`
- Modify: `app/src/components/layout/games/setup/OneTwentyOneSetupForm.astro`
- Test: `app/tests/lib/game/one-twenty-one-setup.data.test.ts`

**Interfaces:**
- Consumes: `addBotOpponent`, `DEFAULT_BOT_LEVEL` (already imported elsewhere — `@lib/game/guest-list`, `@lib/game/rulesets/capabilities`), `supportsDartbot` (`@lib/game/rulesets/capabilities`, Task 2).
- Produces: `OneTwentyOneSetupContext.addBot()`, `.removeBot()`, `.pendingBotLevel`, `.showBotLevelPicker` — same shape `FiveOhOneSetupContext` already has. `guested(ctx)` local helper (module-private, mirrors `singles-training-setup.data.ts`).

- [ ] **Step 1: Write the failing tests**

Append to `app/tests/lib/game/one-twenty-one-setup.data.test.ts` (inside the existing top-level `describe("oneTwentyOneSetup", ...)`, after the `forceTargetIfGuested` block):

```ts
  describe("bot wiring", () => {
    it("initializes the level picker to DEFAULT_BOT_LEVEL and no picker shown", () => {
      const setup = oneTwentyOneSetup() as unknown as {
        pendingBotLevel: number;
        showBotLevelPicker: boolean;
      };
      expect(setup.pendingBotLevel).toBe(8);
      expect(setup.showBotLevelPicker).toBe(false);
    });

    it("addBot seats a level-8 DartBot and locks duration to TARGET, like a guest does", () => {
      const ctx = oneTwentyOneSetup() as unknown as {
        durationType: string;
        bot: { level: number } | null;
        addBot: () => void;
      };
      ctx.durationType = "ROUNDS";

      ctx.addBot();

      expect(ctx.bot).toEqual({ level: 8 });
      expect(ctx.durationType).toBe("TARGET");
    });

    it("addBot refuses when a guest is already seated, and vice versa", () => {
      const ctx = oneTwentyOneSetup() as unknown as {
        guests: { displayName: string }[];
        newGuestName: string;
        bot: { level: number } | null;
        addGuest: () => void;
        addBot: () => void;
        removeGuest: (index: number) => void;
      };

      ctx.newGuestName = "Guest 1";
      ctx.addGuest();
      ctx.addBot();
      expect(ctx.bot).toBeNull();

      ctx.removeGuest(0);
      ctx.addBot();
      ctx.newGuestName = "Guest 2";
      ctx.addGuest();
      expect(ctx.guests).toEqual([]);
    });

    it("removeBot clears the seated bot", () => {
      const ctx = oneTwentyOneSetup() as unknown as {
        bot: { level: number } | null;
        addBot: () => void;
        removeBot: () => void;
      };
      ctx.addBot();

      ctx.removeBot();

      expect(ctx.bot).toBeNull();
    });
  });
```

Then locate the `describe("session creation", ...)` block's `createSetup` helper in this same test file (mirrors `five-oh-one-setup.data.test.ts`'s `createSetup`) and add one test alongside its existing guested-121_V1 case:

```ts
    it("a seated bot starts a 121_V1 session with a 2-seat DARTBOT participants array", async () => {
      const setup = createSetup({
        presets: [TARGET_PRESET, ROUNDS_PRESET, MINUTES_PRESET, GUESTED_PRESET],
      });
      (setup as unknown as { bot: { level: number } | null }).bot = {
        level: 8,
      };
      vi.mocked(sessionsApi.createSession).mockResolvedValue({
        sessionId: "new-session-id",
        participants: [
          {
            ref: "participant-1",
            displayName: "Player",
            participantTypeKey: "PLAYER",
          },
          {
            ref: "participant-2",
            displayName: "DartBot",
            participantTypeKey: "DARTBOT",
            dartbot: { level: 8, seed: 1, levelSource: "MANUAL" },
          },
        ],
      } as any);
      vi.stubGlobal("location", { href: "" });

      await setup.start();

      expect(sessionsApi.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          rulesetVersionKey: "121_V1",
          participants: [
            { participantTypeKey: "PLAYER", sideKey: "A" },
            { participantTypeKey: "DARTBOT", level: 8, sideKey: "B" },
          ],
        }),
      );
    });
```

If this test file's `session creation` block has no preset named `GUESTED_PRESET` (the one whose `configuration` carries no `duration_type` key — `resolveStartPreset`'s guested branch), reuse whichever preset fixture the file's own existing guested-121_V1 test already reads (its 121_V1 test in `session creation` proves this branch works; copy that test's preset list verbatim into this new test rather than inventing a name).

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/one-twenty-one-setup.data.test.ts`
Expected: FAIL — `pendingBotLevel`/`showBotLevelPicker`/`addBot`/`removeBot` don't exist yet; the bot participants test sends only `[{ participantTypeKey: "PLAYER", ... }]`.

- [ ] **Step 3: Add the type fields**

In `app/src/lib/game/types.ts`, `OneTwentyOneSetupContext` (starts line 1002): after `showOpponentChooser: boolean;` (line 1017) add:

```ts
  pendingBotLevel: number;
  showBotLevelPicker: boolean;
```

After `addGuest(this: OneTwentyOneSetupContext): void;` (line 1049) add:

```ts
  addBot(this: OneTwentyOneSetupContext): void;
```

After `removeGuest(this: OneTwentyOneSetupContext, index: number): void;` (line 1050) add:

```ts
  removeBot(this: OneTwentyOneSetupContext): void;
```

- [ ] **Step 4: Wire the setup data**

In `app/src/lib/game/one-twenty-one-setup.data.ts`:

Add to the import block (alongside the existing `addTypedGuest` import):

```ts
import { addBotOpponent, addTypedGuest } from "@lib/game/guest-list";
import { DEFAULT_BOT_LEVEL } from "@lib/game/rulesets/capabilities";
```

(replacing the existing `import { addTypedGuest } from "@lib/game/guest-list";` line)

Add a module-level helper right after `resolveStartOverrides` (before `export function oneTwentyOneSetup()`):

```ts
/** Whether this session will seat a second player — guest or DartBot. */
function guested(ctx: OneTwentyOneSetupContext): boolean {
  return ctx.guests.length > 0 || ctx.bot !== null;
}
```

Add two fields after `showOpponentChooser: false,`:

```ts
    pendingBotLevel: DEFAULT_BOT_LEVEL as number,
    showBotLevelPicker: false,
```

Replace `addGuest`:

```ts
    addGuest(this: OneTwentyOneSetupContext) {
      if (addTypedGuest(this)) this.forceTargetIfGuested();
    },

    addBot(this: OneTwentyOneSetupContext) {
      if (addBotOpponent(this)) this.forceTargetIfGuested();
    },
```

Add `removeBot` right after `removeGuest`:

```ts
    removeGuest(this: OneTwentyOneSetupContext, index: number) {
      this.guests.splice(index, 1);
    },

    removeBot(this: OneTwentyOneSetupContext) {
      this.bot = null;
    },
```

Replace `forceTargetIfGuested`'s body to read the widened `guested()` helper:

```ts
    forceTargetIfGuested(this: OneTwentyOneSetupContext) {
      if (guested(this)) this.durationType = "TARGET";
    },
```

In `start()`, replace the `guested` local (currently `const guested = this.guests.length > 0;`) with a differently-named local so it doesn't shadow the module-level `guested` function:

```ts
    async start(this: OneTwentyOneSetupContext) {
      if (this.loading) return;
      const isGuested = guested(this);
      const rulesetVersionKey: RulesetVersionKey = isGuested
        ? "121_V1"
        : "121_V2";

      const preset = resolveStartPreset(this, isGuested);
      if (!preset) {
        this.error = "Could not find a preset for this mode.";
        return;
      }

      const overrides = resolveStartOverrides(this, isGuested);
```

and change `const participants = participantsFromGuests(this.guests);` to:

```ts
      const participants = participantsFromGuests(this.guests, this.bot);
```

- [ ] **Step 5: Widen the setup form's opponent-triggered UI branches**

In `app/src/components/layout/games/setup/OneTwentyOneSetupForm.astro`:

Add the import (alongside the existing component imports):

```ts
import { supportsDartbot } from "@lib/game/rulesets/capabilities";
```

Change:

```astro
  <UserSection allowGuests />
```

to:

```astro
  <UserSection
    allowGuests
    allowDartbot={supportsDartbot("121_V1")}
  />
```

Change the two `x-if` guards (a bot is a second seat exactly like a guest — `forceTargetIfGuested` above already treats it that way, and the UI branch that shows "Rounds and Time modes are solo only" must switch the same moment a bot is seated, or it keeps showing a toggle whose value the engine has already locked underneath):

```astro
    <template x-if="guests.length === 0 && !bot">
```

and

```astro
    <template x-if="guests.length > 0 || bot">
```

(replacing `x-if="guests.length === 0"` and `x-if="guests.length > 0"` respectively)

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/one-twenty-one-setup.data.test.ts`
Expected: PASS (all tests, including the 4 new ones)

- [ ] **Step 7: Format and commit**

```bash
cd app && npm run format
git add app/src/lib/game/types.ts \
        app/src/lib/game/one-twenty-one-setup.data.ts \
        app/src/components/layout/games/setup/OneTwentyOneSetupForm.astro \
        app/tests/lib/game/one-twenty-one-setup.data.test.ts
git commit -m "feat: offer a DartBot opponent on the 121 setup screen"
```

---

### Task 4: TUOD setup — offer and seat a DartBot

**Files:**
- Modify: `app/src/lib/game/types.ts` (`TuodSetupContext`, lines 65-113)
- Modify: `app/src/lib/game/tuod-setup.data.ts`
- Modify: `app/src/components/layout/games/setup/TuodSetupForm.astro`
- Test: `app/tests/lib/game/tuod-setup.data.test.ts`

**Interfaces:**
- Consumes: same as Task 3.
- Produces: `TuodSetupContext.addBot()`, `.removeBot()`, `.pendingBotLevel`, `.showBotLevelPicker`.

- [ ] **Step 1: Write the failing tests**

Append to `app/tests/lib/game/tuod-setup.data.test.ts` (inside `describe("tuodSetup", ...)`, mirroring Task 3's four tests exactly, with TUOD's own imports/context type):

```ts
  describe("bot wiring", () => {
    it("initializes the level picker to DEFAULT_BOT_LEVEL and no picker shown", () => {
      const setup = tuodSetup() as unknown as {
        pendingBotLevel: number;
        showBotLevelPicker: boolean;
      };
      expect(setup.pendingBotLevel).toBe(8);
      expect(setup.showBotLevelPicker).toBe(false);
    });

    it("addBot seats a level-8 DartBot and locks duration to ROUNDS, like a guest does", () => {
      const ctx = tuodSetup() as unknown as {
        durationType: string;
        bot: { level: number } | null;
        addBot: () => void;
      };
      ctx.durationType = "MINUTES";

      ctx.addBot();

      expect(ctx.bot).toEqual({ level: 8 });
      expect(ctx.durationType).toBe("ROUNDS");
    });

    it("addBot refuses when a guest is already seated, and vice versa", () => {
      const ctx = tuodSetup() as unknown as {
        guests: { displayName: string }[];
        newGuestName: string;
        bot: { level: number } | null;
        addGuest: () => void;
        addBot: () => void;
        removeGuest: (index: number) => void;
      };

      ctx.newGuestName = "Guest 1";
      ctx.addGuest();
      ctx.addBot();
      expect(ctx.bot).toBeNull();

      ctx.removeGuest(0);
      ctx.addBot();
      ctx.newGuestName = "Guest 2";
      ctx.addGuest();
      expect(ctx.guests).toEqual([]);
    });

    it("removeBot clears the seated bot", () => {
      const ctx = tuodSetup() as unknown as {
        bot: { level: number } | null;
        addBot: () => void;
        removeBot: () => void;
      };
      ctx.addBot();

      ctx.removeBot();

      expect(ctx.bot).toBeNull();
    });
  });
```

Then add one `start()` test alongside this file's existing `session creation`/`start` tests, seating a bot and asserting `createSession` receives a 2-seat `DARTBOT` participants array with `rulesetVersionKey: "TUOD_V1"` (TUOD has only one ruleset version, unlike 121 — no guested/solo key split) — mirror Task 3's Step 1 bot-participants test, swapping in whichever preset fixture this file's own existing passing `start()` test already uses.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/tuod-setup.data.test.ts`
Expected: FAIL — `pendingBotLevel`/`showBotLevelPicker`/`addBot`/`removeBot` don't exist yet.

- [ ] **Step 3: Add the type fields**

In `app/src/lib/game/types.ts`, `TuodSetupContext` (starts line 65): after `showOpponentChooser: boolean;` (line 80) add:

```ts
  pendingBotLevel: number;
  showBotLevelPicker: boolean;
```

After `addGuest(this: TuodSetupContext): void;` (line 109) add:

```ts
  addBot(this: TuodSetupContext): void;
```

After `removeGuest(this: TuodSetupContext, index: number): void;` (line 110) add:

```ts
  removeBot(this: TuodSetupContext): void;
```

- [ ] **Step 4: Wire the setup data**

In `app/src/lib/game/tuod-setup.data.ts`:

Replace `import { addTypedGuest } from "@lib/game/guest-list";` with:

```ts
import { addBotOpponent, addTypedGuest } from "@lib/game/guest-list";
import { DEFAULT_BOT_LEVEL } from "@lib/game/rulesets/capabilities";
```

Add a module-level helper after `durationValueOf`:

```ts
/** Whether this session will seat a second player — guest or DartBot. */
function guested(ctx: TuodSetupContext): boolean {
  return ctx.guests.length > 0 || ctx.bot !== null;
}
```

Add two fields after `showOpponentChooser: false,`:

```ts
    pendingBotLevel: DEFAULT_BOT_LEVEL as number,
    showBotLevelPicker: false,
```

Replace `addGuest`:

```ts
    addGuest(this: TuodSetupContext) {
      if (addTypedGuest(this)) this.forceRoundsIfGuested();
    },

    addBot(this: TuodSetupContext) {
      if (addBotOpponent(this)) this.forceRoundsIfGuested();
    },
```

Add `removeBot` right after `removeGuest`:

```ts
    removeGuest(this: TuodSetupContext, index: number) {
      this.guests.splice(index, 1);
    },

    removeBot(this: TuodSetupContext) {
      this.bot = null;
    },
```

Replace `forceRoundsIfGuested`'s body:

```ts
    forceRoundsIfGuested(this: TuodSetupContext) {
      if (guested(this)) this.durationType = "ROUNDS";
    },
```

In `start()`, change `const participants = participantsFromGuests(this.guests);` to:

```ts
      const participants = participantsFromGuests(this.guests, this.bot);
```

- [ ] **Step 5: Widen the setup form's opponent-triggered UI branches**

In `app/src/components/layout/games/setup/TuodSetupForm.astro`:

Add the import:

```ts
import { supportsDartbot } from "@lib/game/rulesets/capabilities";
```

Change:

```astro
  <UserSection allowGuests />
```

to:

```astro
  <UserSection
    allowGuests
    allowDartbot={supportsDartbot("TUOD_V1")}
  />
```

Change the two `x-if` guards:

```astro
    <template x-if="guests.length === 0 && !bot">
```

and

```astro
    <template x-if="guests.length > 0 || bot">
```

(replacing `x-if="guests.length === 0"` and `x-if="guests.length > 0"` respectively — TUOD's two `template x-if` blocks both key off this pair, so both change)

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/tuod-setup.data.test.ts`
Expected: PASS (all tests, including the 4 new ones)

- [ ] **Step 7: Format and commit**

```bash
cd app && npm run format
git add app/src/lib/game/types.ts \
        app/src/lib/game/tuod-setup.data.ts \
        app/src/components/layout/games/setup/TuodSetupForm.astro \
        app/tests/lib/game/tuod-setup.data.test.ts
git commit -m "feat: offer a DartBot opponent on the TUOD setup screen"
```

---

### Task 5: Score Training setup — offer and seat a DartBot

**Files:**
- Modify: `app/src/lib/game/types.ts` (`ScoreTrainingSetupContext`, lines 451-502)
- Modify: `app/src/lib/game/score-training-setup.data.ts`
- Modify: `app/src/components/layout/games/setup/ScoreTrainingSetupForm.astro`
- Test: `app/tests/lib/game/score-training-setup.data.test.ts`

**Interfaces:**
- Consumes: same as Task 3.
- Produces: `ScoreTrainingSetupContext.addBot()`, `.removeBot()`, `.pendingBotLevel`, `.showBotLevelPicker`.

- [ ] **Step 1: Write the failing tests**

Append to `app/tests/lib/game/score-training-setup.data.test.ts` (inside `describe("scoreTrainingSetup", ...)`), mirroring Task 3's four tests, swapping in `scoreTrainingSetup` and this game's own default durationType (`ROUNDS`, so the lock-test starts from `MINUTES` like Task 4's):

```ts
  describe("bot wiring", () => {
    it("initializes the level picker to DEFAULT_BOT_LEVEL and no picker shown", () => {
      const setup = scoreTrainingSetup() as unknown as {
        pendingBotLevel: number;
        showBotLevelPicker: boolean;
      };
      expect(setup.pendingBotLevel).toBe(8);
      expect(setup.showBotLevelPicker).toBe(false);
    });

    it("addBot seats a level-8 DartBot and locks duration to ROUNDS, like a guest does", () => {
      const ctx = scoreTrainingSetup() as unknown as {
        durationType: string;
        bot: { level: number } | null;
        addBot: () => void;
      };
      ctx.durationType = "MINUTES";

      ctx.addBot();

      expect(ctx.bot).toEqual({ level: 8 });
      expect(ctx.durationType).toBe("ROUNDS");
    });

    it("addBot refuses when a guest is already seated, and vice versa", () => {
      const ctx = scoreTrainingSetup() as unknown as {
        guests: { displayName: string }[];
        newGuestName: string;
        bot: { level: number } | null;
        addGuest: () => void;
        addBot: () => void;
        removeGuest: (index: number) => void;
      };

      ctx.newGuestName = "Guest 1";
      ctx.addGuest();
      ctx.addBot();
      expect(ctx.bot).toBeNull();

      ctx.removeGuest(0);
      ctx.addBot();
      ctx.newGuestName = "Guest 2";
      ctx.addGuest();
      expect(ctx.guests).toEqual([]);
    });

    it("removeBot clears the seated bot", () => {
      const ctx = scoreTrainingSetup() as unknown as {
        bot: { level: number } | null;
        addBot: () => void;
        removeBot: () => void;
      };
      ctx.addBot();

      ctx.removeBot();

      expect(ctx.bot).toBeNull();
    });
  });
```

Then add one `start()` test alongside this file's existing `session creation`/`start` tests, seating a bot and asserting `createSession` receives a 2-seat `DARTBOT` participants array with `rulesetVersionKey: "SCORE_TRAINING_V1"` — mirror Task 3's Step 1 bot-participants test.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/score-training-setup.data.test.ts`
Expected: FAIL — `pendingBotLevel`/`showBotLevelPicker`/`addBot`/`removeBot` don't exist yet.

- [ ] **Step 3: Add the type fields**

In `app/src/lib/game/types.ts`, `ScoreTrainingSetupContext` (starts line 451): after `showOpponentChooser: boolean;` (line 466) add:

```ts
  pendingBotLevel: number;
  showBotLevelPicker: boolean;
```

After `addGuest(this: ScoreTrainingSetupContext): void;` (line 498) add:

```ts
  addBot(this: ScoreTrainingSetupContext): void;
```

After `removeGuest(this: ScoreTrainingSetupContext, index: number): void;` (line 499) add:

```ts
  removeBot(this: ScoreTrainingSetupContext): void;
```

- [ ] **Step 4: Wire the setup data**

In `app/src/lib/game/score-training-setup.data.ts`:

Replace `import { addTypedGuest } from "@lib/game/guest-list";` with:

```ts
import { addBotOpponent, addTypedGuest } from "@lib/game/guest-list";
import { DEFAULT_BOT_LEVEL } from "@lib/game/rulesets/capabilities";
```

Add a module-level helper after `durationValueOf`:

```ts
/** Whether this session will seat a second player — guest or DartBot. */
function guested(ctx: ScoreTrainingSetupContext): boolean {
  return ctx.guests.length > 0 || ctx.bot !== null;
}
```

Add two fields after `showOpponentChooser: false,`:

```ts
    pendingBotLevel: DEFAULT_BOT_LEVEL as number,
    showBotLevelPicker: false,
```

Replace `addGuest`:

```ts
    addGuest(this: ScoreTrainingSetupContext) {
      if (addTypedGuest(this)) this.forceRoundsIfGuested();
    },

    addBot(this: ScoreTrainingSetupContext) {
      if (addBotOpponent(this)) this.forceRoundsIfGuested();
    },
```

Add `removeBot` right after `removeGuest`:

```ts
    removeGuest(this: ScoreTrainingSetupContext, index: number) {
      this.guests.splice(index, 1);
    },

    removeBot(this: ScoreTrainingSetupContext) {
      this.bot = null;
    },
```

Replace `forceRoundsIfGuested`'s body:

```ts
    forceRoundsIfGuested(this: ScoreTrainingSetupContext) {
      if (guested(this)) this.durationType = "ROUNDS";
    },
```

In `start()`, change `const participants = participantsFromGuests(this.guests);` to:

```ts
      const participants = participantsFromGuests(this.guests, this.bot);
```

- [ ] **Step 5: Widen the setup form's opponent-triggered UI branches**

In `app/src/components/layout/games/setup/ScoreTrainingSetupForm.astro`:

Add the import:

```ts
import { supportsDartbot } from "@lib/game/rulesets/capabilities";
```

Change:

```astro
  <UserSection allowGuests />
```

to:

```astro
  <UserSection
    allowGuests
    allowDartbot={supportsDartbot("SCORE_TRAINING_V1")}
  />
```

Change the two `x-if` guards:

```astro
    <template x-if="guests.length === 0 && !bot">
```

and

```astro
    <template x-if="guests.length > 0 || bot">
```

(replacing `x-if="guests.length === 0"` and `x-if="guests.length > 0"` respectively)

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/score-training-setup.data.test.ts`
Expected: PASS (all tests, including the 4 new ones)

- [ ] **Step 7: Format and commit**

```bash
cd app && npm run format
git add app/src/lib/game/types.ts \
        app/src/lib/game/score-training-setup.data.ts \
        app/src/components/layout/games/setup/ScoreTrainingSetupForm.astro \
        app/tests/lib/game/score-training-setup.data.test.ts
git commit -m "feat: offer a DartBot opponent on the Score Training setup screen"
```

---

### Task 6: 121 play loop — a seated DartBot actually throws

**Files:**
- Modify: `app/src/lib/game/types.ts` (`OneTwentyOnePlayContext`, lines 766-833)
- Modify: `app/src/lib/game/one-twenty-one-play.data.ts`
- Test: `app/tests/lib/game/one-twenty-one-play.data.test.ts`

**Interfaces:**
- Consumes: `chooseTarget` from `@modules/dartbot/strategy/x01.strategy.module` (unchanged, shipped for 501 — Task 1's own `chooseTarget` is Score Training's, not this one), `skillProfileForLevel` (`@modules/dartbot/skill-profile.module`), `createDartRng` (`@modules/dartbot/rng.module`), `throwDart as botThrowDart` (`@modules/dartbot/throw-engine.module`), `checkoutPathFor` (already imported), `playFoldBotQuickScoreVisit`/`playRunBotVisualBoardVisit`/`undoToActiveSeat` (`@lib/game/play-lifecycle`), `oneTwentyOneEngineFactory` (value export from `@modules/game/one-twenty-one.engine.module`).
- Produces: `OneTwentyOnePlayContext.maybeRunBotVisit()`, `.botThrowing`. `undoVisit()` now branches on a seated bot.

- [ ] **Step 1: Write the failing tests**

Append to `app/tests/lib/game/one-twenty-one-play.data.test.ts` (top-level, alongside the file's existing `describe` blocks — check the file's own imports for its `makePlay`/config-builder helpers and reuse them; do not invent new ones):

```ts
describe("DartBot opponent", () => {
  const BOT_REF = "bot-1";
  const HUMAN_REF = "human-1";

  function seatsWithBot() {
    return [
      {
        participantRef: HUMAN_REF,
        displayName: "Levi",
        sideKey: "A",
        participantTypeKey: "PLAYER" as const,
      },
      {
        participantRef: BOT_REF,
        displayName: "DartBot",
        sideKey: "B",
        participantTypeKey: "DARTBOT" as const,
        dartbot: { level: 8, seed: 424242, levelSource: "MANUAL" as const },
      },
    ];
  }

  it("under VISUAL_BOARD, the bot throws its own visit once it becomes active", async () => {
    // Build a play context whose configSnapshot.seats is seatsWithBot() and
    // whose $store.game.inputModeKey is "VISUAL_BOARD" — mirror this file's
    // own makePlay()/config-builder helper exactly as
    // five-oh-one-play.data.test.ts's "DartBot opponent" suite does, since
    // this file already has an equivalent 1v1-guest config builder to widen.
    const play = makePlay({ configSnapshot: botConfig() });
    await play.init.call(play);

    await play.recordVisit.call(play, 26, false);

    const botTurns = play.$store.game.turns.filter(
      (turn) => turn.participantRef === BOT_REF,
    );
    expect(botTurns.length).toBeGreaterThan(0);
    expect(play.state()!.activeParticipantRef).toBe(HUMAN_REF);
  });

  it("under QUICK_SCORE, the bot's visit uploads as one turn with darts: []", async () => {
    const play = makePlay({ configSnapshot: botConfig() });
    await play.init.call(play);

    await play.recordVisit.call(play, 26, false);

    const botTurn = play.$store.game.turns.find(
      (turn) => turn.participantRef === BOT_REF,
    );
    expect(botTurn).toBeDefined();
    expect(botTurn!.darts).toEqual([]);
  });

  it("undoVisit crosses the seat boundary back to the human", async () => {
    const play = makePlay({ configSnapshot: botConfig() });
    await play.init.call(play);
    await play.recordVisit.call(play, 26, false);
    expect(play.state()!.activeParticipantRef).toBe(HUMAN_REF);

    play.undoVisit.call(play);

    expect(play.state()!.activeParticipantRef).toBe(HUMAN_REF);
  });
});
```

Adjust this skeleton once the file's real helpers are visible: replace `botConfig()` with a local function returning `{ ...<this file's own base 121_V1 config builder>(), seats: seatsWithBot() }`, and drop the `seatsWithBot` duplication if the file already has a 1v1 seats builder to extend (check for a `guestSeats`/`twoSeats` helper near this file's existing 1v1 tests first — 121 already has 1v1-with-guest tests, since guest opponents shipped earlier).

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/one-twenty-one-play.data.test.ts`
Expected: FAIL — `maybeRunBotVisit` doesn't exist; a bot seat never throws, so `botTurns` stays empty and `activeParticipantRef` stays `BOT_REF` after the human's own visit.

- [ ] **Step 3: Add the type fields**

In `app/src/lib/game/types.ts`, `OneTwentyOnePlayContext` (starts line 766): after `showSessionFinishConfirm: boolean;` (line 784) add:

```ts
  botThrowing: boolean;
```

After `undoVisit(this: OneTwentyOnePlayContext): void;` (line 826) add:

```ts
  maybeRunBotVisit(this: OneTwentyOnePlayContext): Promise<void>;
```

- [ ] **Step 4: Wire the play data**

In `app/src/lib/game/one-twenty-one-play.data.ts`:

Add to the import blocks:

```ts
import {
  clearHiddenTimer,
  playAbandonAndExit,
  playBack,
  playCommitDart,
  playFoldBotQuickScoreVisit,
  playRunBotVisualBoardVisit,
  playUploadAndCompleteSession,
  playVisitMarkers,
  runPlayAgain,
  undoToActiveSeat,
} from "@lib/game/play-lifecycle";
import { skillProfileForLevel } from "@modules/dartbot/skill-profile.module";
import { createDartRng } from "@modules/dartbot/rng.module";
import { throwDart as botThrowDart } from "@modules/dartbot/throw-engine.module";
import { chooseTarget } from "@modules/dartbot/strategy/x01.strategy.module";
```

(replacing the existing, shorter `playAbandonAndExit`/... import block with the widened one above)

Change `import type { RulesetVersionKey } from "@lib/types";` to:

```ts
import type { RulesetVersionKey, SeatFact } from "@lib/types";
```

Add `BotDartThrower`, `BotPacing` to the `./types` type import block:

```ts
import type {
  BoardMarker,
  BotDartThrower,
  BotPacing,
  OneTwentyOneDurationType,
  OneTwentyOnePlayContext,
  OneTwentyOneResultsSnapshot,
  OneTwentyOneSeatResult,
} from "./types";
```

Replace the value import of the engine so `oneTwentyOneEngineFactory` is also available (needed by `playFoldBotQuickScoreVisit`'s `TState` inference, same reasoning `five-oh-one-play.data.ts` documents):

```ts
// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// oneTwentyOneEngineFactory so the registry can resolve either ruleset
// version this shared play page might be resuming.
import {
  OneTwentyOneEngine,
  oneTwentyOneEngineFactory,
} from "@modules/game/one-twenty-one.engine.module";
```

Add, right after `const DARTS_PER_VISIT = 3;`:

```ts
const BOT_PRE_THROW_MS = 900;
const BOT_POST_THROW_MS = 250;

type DartbotSeat = Extract<SeatFact, { participantTypeKey: "DARTBOT" }>;

function findBotSeat(seats: readonly SeatFact[]): DartbotSeat | undefined {
  return seats.find(
    (seat): seat is DartbotSeat => seat.participantTypeKey === "DARTBOT",
  );
}

function botDartIndex(turns: readonly TurnFact[], botRef: string): number {
  return turns
    .filter((turn) => turn.participantRef === botRef)
    .reduce((sum, turn) => sum + turn.darts.length, 0);
}

function throwOneDart(
  remaining: number,
  botSeat: DartbotSeat,
  dartIndex: number,
): DartObservation {
  const profile = skillProfileForLevel(botSeat.dartbot.level);
  const rng = createDartRng(botSeat.dartbot.seed, dartIndex);
  const intent = chooseTarget(
    { remaining, checkoutPath: checkoutPathFor(remaining) },
    profile.decisionQuality,
  );
  const thrown = botThrowDart(intent, profile, rng);
  return {
    hitTargetNumber: thrown.hit.targetNumber,
    hitZoneKey: thrown.hit.zoneKey,
    locationX: thrown.landing.x,
    locationY: thrown.landing.y,
  };
}

/** VISUAL_BOARD thrower: reads the real engine's own live `state()` —
 * `remainingInAttemptFor` already folds an open visit's running total. */
function throwBotDart(
  context: OneTwentyOnePlayContext,
  botSeat: DartbotSeat,
): { observation: DartObservation; pacing: BotPacing } {
  const remaining = context.remainingInAttemptFor(botSeat.participantRef);
  const dartIndex = botDartIndex(
    context.$store.game.turns,
    botSeat.participantRef,
  );
  return {
    observation: throwOneDart(remaining, botSeat, dartIndex),
    pacing: { preThrowMs: BOT_PRE_THROW_MS, postThrowMs: BOT_POST_THROW_MS },
  };
}

/** QUICK_SCORE thrower: `state` is the scratch engine's own live state,
 * never the real engine's — mirrors `five-oh-one-play.data.ts`. */
function throwBotQuickScoreDart(
  state: OneTwentyOneState,
  botSeat: DartbotSeat,
  dartIndex: number,
): DartObservation {
  const remaining = state.seats.find(
    (seat) => seat.participantRef === botSeat.participantRef,
  )!.remainingInAttempt;
  return throwOneDart(remaining, botSeat, dartIndex);
}
```

Add `botThrowing: false,` to the returned state object, right after `showSessionFinishConfirm: false,`:

```ts
    showSessionFinishConfirm: false,
    botThrowing: false,
```

At the end of `init()`, right after `this.hasActiveSession = true;`, add:

```ts
        this.hasActiveSession = true;
        await this.maybeRunBotVisit();
```

(replacing the bare `this.hasActiveSession = true;` line)

At the end of `recordVisit()`, replace the tail:

```ts
      if (this.engine.isComplete()) {
        this.finished = true;
        this.completionStatus = "pending";
        await this.uploadAndCompleteSession();
      }
    },
```

with:

```ts
      if (this.engine.isComplete()) {
        this.finished = true;
        this.completionStatus = "pending";
        await this.uploadAndCompleteSession();
        return;
      }
      await this.maybeRunBotVisit();
    },
```

Add `maybeRunBotVisit` right after `recordVisit`:

```ts
    async maybeRunBotVisit(this: OneTwentyOnePlayContext) {
      const botSeat = findBotSeat(this.$store.game.seats);
      if (!botSeat || !this.engine || this.finished) return;
      const state = this.state();
      if (!state || state.activeParticipantRef !== botSeat.participantRef)
        return;

      if (this.$store.game.inputModeKey === "QUICK_SCORE") {
        const remainingBefore = this.remainingInAttemptFor(
          botSeat.participantRef,
        );
        let dartIndex = botDartIndex(
          this.$store.game.turns,
          botSeat.participantRef,
        );
        const fold = playFoldBotQuickScoreVisit(
          oneTwentyOneEngineFactory,
          this.$store.game.configSnapshot!,
          this.engine.facts(),
          (scratchState) =>
            throwBotQuickScoreDart(scratchState, botSeat, dartIndex++),
          DARTS_PER_VISIT,
        );
        await this.recordVisit(
          fold.totalScore,
          fold.totalScore === remainingBefore,
        );
        return;
      }

      const thrower: BotDartThrower = () => throwBotDart(this, botSeat);
      await playRunBotVisualBoardVisit(this, botSeat.participantRef, thrower);
    },
```

Replace `commitDart` so a VISUAL_BOARD human dart also triggers the bot afterward:

```ts
    async commitDart(
      this: OneTwentyOnePlayContext,
      observation: DartObservation,
    ) {
      await playCommitDart(this, observation);
      await this.maybeRunBotVisit();
    },
```

Replace `undoVisit`:

```ts
    undoVisit(this: OneTwentyOnePlayContext) {
      if (
        this.finished ||
        this.showDoubleConfirm ||
        this.showSessionFinishConfirm
      )
        return;
      if (!this.engine) return;
      const botSeat = findBotSeat(this.$store.game.seats);
      if (botSeat) {
        const humanSeat = this.$store.game.seats.find(
          (seat) => seat.participantTypeKey === "PLAYER",
        )!;
        undoToActiveSeat(this, humanSeat.participantRef);
      } else {
        if (!this.engine.undo()) return;
        clearHiddenTimer(this);
        this.$store.game.recordFacts(this.engine.facts());
      }
      this.scoreInput.clear();
      this.error = "";
      void this.maybeRunBotVisit();
    },
```

`OneTwentyOneState` is already imported as a type (line 30) — the added `throwBotQuickScoreDart` reuses it, no new type import needed there.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/one-twenty-one-play.data.test.ts`
Expected: PASS (all tests, including the 3 new ones)

- [ ] **Step 6: Format, run the full suite, and commit**

```bash
cd app && npm run format && npx vitest run
```

Expected: full suite green.

```bash
git add app/src/lib/game/types.ts \
        app/src/lib/game/one-twenty-one-play.data.ts \
        app/tests/lib/game/one-twenty-one-play.data.test.ts
git commit -m "feat: wire 121 onto the DartBot play loop"
```

---

### Task 7: TUOD play loop — a seated DartBot actually throws

**Files:**
- Modify: `app/src/lib/game/types.ts` (`TuodPlayContext`, lines 391-449)
- Modify: `app/src/lib/game/tuod-play.data.ts`
- Test: `app/tests/lib/game/tuod-play.data.test.ts`

**Interfaces:**
- Consumes: same as Task 6, plus `tuodEngineFactory` (value export from `@modules/game/tuod.engine.module`). TUOD's per-attempt "remaining" is `seat.currentTarget`, not a visit-scoped remainder — a TUOD attempt always starts fresh at the seat's current ladder target.
- Produces: `TuodPlayContext.maybeRunBotVisit()`, `.botThrowing`.

- [ ] **Step 1: Write the failing tests**

Append to `app/tests/lib/game/tuod-play.data.test.ts`, mirroring Task 6's three tests exactly (same `seatsWithBot`/`BOT_REF`/`HUMAN_REF` shape), swapping `play.recordVisit.call(play, 26, false)` for `play.recordAttempt.call(play, { checkedOut: false })` — TUOD's own record path — and reusing this file's own `makePlay`/config-builder helper for a bot-seated `Seated<TuodSnapshot>`:

```ts
describe("DartBot opponent", () => {
  const BOT_REF = "bot-1";
  const HUMAN_REF = "human-1";

  function seatsWithBot() {
    return [
      {
        participantRef: HUMAN_REF,
        displayName: "Levi",
        sideKey: "A",
        participantTypeKey: "PLAYER" as const,
      },
      {
        participantRef: BOT_REF,
        displayName: "DartBot",
        sideKey: "B",
        participantTypeKey: "DARTBOT" as const,
        dartbot: { level: 8, seed: 424242, levelSource: "MANUAL" as const },
      },
    ];
  }

  it("under VISUAL_BOARD, the bot throws its own attempt once it becomes active", async () => {
    const play = makePlay({ configSnapshot: botConfig() });
    await play.init.call(play);

    await play.recordAttempt.call(play, { checkedOut: false });

    const botTurns = play.$store.game.turns.filter(
      (turn) => turn.participantRef === BOT_REF,
    );
    expect(botTurns.length).toBeGreaterThan(0);
    expect(play.state()!.activeParticipantRef).toBe(HUMAN_REF);
  });

  it("under QUICK_SCORE, the bot's attempt uploads as one turn with darts: []", async () => {
    const play = makePlay({ configSnapshot: botConfig() });
    await play.init.call(play);

    await play.recordAttempt.call(play, { checkedOut: false });

    const botTurn = play.$store.game.turns.find(
      (turn) => turn.participantRef === BOT_REF,
    );
    expect(botTurn).toBeDefined();
    expect(botTurn!.darts).toEqual([]);
  });

  it("undoVisit crosses the seat boundary back to the human", async () => {
    const play = makePlay({ configSnapshot: botConfig() });
    await play.init.call(play);
    await play.recordAttempt.call(play, { checkedOut: false });
    expect(play.state()!.activeParticipantRef).toBe(HUMAN_REF);

    play.undoVisit.call(play);

    expect(play.state()!.activeParticipantRef).toBe(HUMAN_REF);
  });
});
```

Replace `botConfig()` with `{ ...<this file's own base TUOD_V1 1v1 config builder>(), seats: seatsWithBot() }`, reusing whichever ROUNDS-duration 1v1 config this file's existing guest tests already build (1v1 is ROUNDS-only for TUOD — `08-DartBot.md` §Two presentation roles).

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/tuod-play.data.test.ts`
Expected: FAIL — `maybeRunBotVisit` doesn't exist.

- [ ] **Step 3: Add the type fields**

In `app/src/lib/game/types.ts`, `TuodPlayContext` (starts line 391): after `showFinishConfirm: boolean;` (line 410) add:

```ts
  botThrowing: boolean;
```

After `undoVisit(this: TuodPlayContext): void;` (line 442) add:

```ts
  maybeRunBotVisit(this: TuodPlayContext): Promise<void>;
```

- [ ] **Step 4: Wire the play data**

In `app/src/lib/game/tuod-play.data.ts`:

Replace the `play-lifecycle` import block:

```ts
import {
  clearHiddenTimer,
  playAbandonAndExit,
  playBack,
  playCommitDart,
  playFoldBotQuickScoreVisit,
  playRunBotVisualBoardVisit,
  playUploadAndCompleteSession,
  playVisitMarkers,
  runPlayAgain,
  undoToActiveSeat,
} from "@lib/game/play-lifecycle";
import { skillProfileForLevel } from "@modules/dartbot/skill-profile.module";
import { createDartRng } from "@modules/dartbot/rng.module";
import { throwDart as botThrowDart } from "@modules/dartbot/throw-engine.module";
import { chooseTarget } from "@modules/dartbot/strategy/x01.strategy.module";
```

Change `import type { RulesetVersionKey } from "@lib/types";` to:

```ts
import type { RulesetVersionKey, SeatFact } from "@lib/types";
```

Add `BotDartThrower`, `BotPacing` to the `./types` type import block:

```ts
import type {
  BoardMarker,
  BotDartThrower,
  BotPacing,
  TuodPlayContext,
  TuodResultsSnapshot,
  TuodSeatResult,
} from "./types";
```

Replace the value import so `tuodEngineFactory` is also available:

```ts
// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// tuodEngineFactory so the registry can resolve this page's own
// RULESET_VERSION_KEY. `tuodEngineFactory` is imported directly (not via the
// type-erased registry) so `playFoldBotQuickScoreVisit`'s `TState` infers as
// `TuodState` with no cast at the call site.
import {
  TuodEngine,
  foldTuodState,
  tuodEngineFactory,
} from "@modules/game/tuod.engine.module";
```

Add, right after `const RULESET_VERSION_KEY: RulesetVersionKey = "TUOD_V1";`:

```ts
const BOT_PRE_THROW_MS = 900;
const BOT_POST_THROW_MS = 250;
const DARTS_PER_VISIT = 3;

type DartbotSeat = Extract<SeatFact, { participantTypeKey: "DARTBOT" }>;

function findBotSeat(seats: readonly SeatFact[]): DartbotSeat | undefined {
  return seats.find(
    (seat): seat is DartbotSeat => seat.participantTypeKey === "DARTBOT",
  );
}

function botDartIndex(turns: readonly TurnFact[], botRef: string): number {
  return turns
    .filter((turn) => turn.participantRef === botRef)
    .reduce((sum, turn) => sum + turn.darts.length, 0);
}

function throwOneDart(
  remaining: number,
  botSeat: DartbotSeat,
  dartIndex: number,
): DartObservation {
  const profile = skillProfileForLevel(botSeat.dartbot.level);
  const rng = createDartRng(botSeat.dartbot.seed, dartIndex);
  const intent = chooseTarget(
    { remaining, checkoutPath: checkoutPathFor(remaining) },
    profile.decisionQuality,
  );
  const thrown = botThrowDart(intent, profile, rng);
  return {
    hitTargetNumber: thrown.hit.targetNumber,
    hitZoneKey: thrown.hit.zoneKey,
    locationX: thrown.landing.x,
    locationY: thrown.landing.y,
  };
}

/** VISUAL_BOARD thrower: TUOD's "remaining" for a fresh attempt is the
 * seat's own `currentTarget` — an attempt always starts at the ladder
 * target, unlike 121/501's visit-to-visit carry. Reads the typed state
 * directly (never the formatted `currentTargetLabelFor` display helper). */
function throwBotDart(
  context: TuodPlayContext,
  botSeat: DartbotSeat,
): { observation: DartObservation; pacing: BotPacing } {
  const seat = context.state()?.seats.find(
    (candidate) => candidate.participantRef === botSeat.participantRef,
  );
  const dartIndex = botDartIndex(
    context.$store.game.turns,
    botSeat.participantRef,
  );
  return {
    observation: throwOneDart(seat?.currentTarget ?? 0, botSeat, dartIndex),
    pacing: { preThrowMs: BOT_PRE_THROW_MS, postThrowMs: BOT_POST_THROW_MS },
  };
}

/** QUICK_SCORE thrower: `state` is the scratch engine's own live state,
 * never the real engine's — mirrors `five-oh-one-play.data.ts`. */
function throwBotQuickScoreDart(
  state: TuodState,
  botSeat: DartbotSeat,
  dartIndex: number,
): DartObservation {
  const remaining = state.seats.find(
    (seat) => seat.participantRef === botSeat.participantRef,
  )!.currentTarget;
  return throwOneDart(remaining, botSeat, dartIndex);
}
```

Add `botThrowing: false,` to the returned state object, right after `showFinishConfirm: false,`:

```ts
    showFinishConfirm: false,
    botThrowing: false,
```

At the end of `init()`, right after `this.hasActiveSession = true;`, add:

```ts
        this.hasActiveSession = true;
        await this.maybeRunBotVisit();
```

In `recordAttempt()`, after the successful `this.$store.game.recordFacts(this.engine.facts());` line at the end of the function, add:

```ts
      this.$store.game.recordFacts(this.engine.facts());
      await this.maybeRunBotVisit();
    },
```

(replacing the function's existing closing `this.$store.game.recordFacts(this.engine.facts());\n    },`)

Add `maybeRunBotVisit` right after `recordAttempt`:

```ts
    async maybeRunBotVisit(this: TuodPlayContext) {
      const botSeat = findBotSeat(this.$store.game.seats);
      if (!botSeat || !this.engine || this.finished) return;
      const state = this.state();
      if (!state || state.activeParticipantRef !== botSeat.participantRef)
        return;

      if (this.$store.game.inputModeKey === "QUICK_SCORE") {
        const target = state.seats.find(
          (seat) => seat.participantRef === botSeat.participantRef,
        )!.currentTarget;
        let dartIndex = botDartIndex(
          this.$store.game.turns,
          botSeat.participantRef,
        );
        const fold = playFoldBotQuickScoreVisit(
          tuodEngineFactory,
          this.$store.game.configSnapshot!,
          this.engine.facts(),
          (scratchState) =>
            throwBotQuickScoreDart(scratchState, botSeat, dartIndex++),
          DARTS_PER_VISIT,
        );
        await this.recordAttempt({
          checkedOut: fold.totalScore === target,
          finishedOnDouble: fold.totalScore === target,
        });
        return;
      }

      const thrower: BotDartThrower = () => throwBotDart(this, botSeat);
      await playRunBotVisualBoardVisit(this, botSeat.participantRef, thrower);
    },
```

Replace `commitDart` so a VISUAL_BOARD human dart also triggers the bot afterward:

```ts
    async commitDart(
      this: TuodPlayContext,
      observation: DartObservation,
    ): Promise<void> {
      await playCommitDart(this, observation);
      await this.maybeRunBotVisit();
    },
```

Replace `undoVisit`:

```ts
    undoVisit(this: TuodPlayContext) {
      if (this.finished || this.showDoubleConfirm || this.showFinishConfirm)
        return;
      if (!this.engine) return;
      const botSeat = findBotSeat(this.$store.game.seats);
      if (botSeat) {
        const humanSeat = this.$store.game.seats.find(
          (seat) => seat.participantTypeKey === "PLAYER",
        )!;
        undoToActiveSeat(this, humanSeat.participantRef);
      } else {
        if (!this.engine.undo()) return;
        clearHiddenTimer(this);
        this.$store.game.recordFacts(this.engine.facts());
      }
      this.scoreInput.clear();
      this.error = "";
      void this.maybeRunBotVisit();
    },
```

Add `TurnFact` to the `@modules/types` type import block — `botDartIndex` needs it and it is not currently imported by this file (`TuodState` already is, since `computeStats` already uses it):

```ts
import type {
  CheckoutDartOptions,
  DartCount,
  DartObservation,
  TuodAttemptInput,
  TuodSeatState,
  TuodState,
  TurnFact,
} from "@modules/types";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/tuod-play.data.test.ts`
Expected: PASS (all tests, including the 3 new ones)

- [ ] **Step 6: Format, run the full suite, and commit**

```bash
cd app && npm run format && npx vitest run
```

```bash
git add app/src/lib/game/types.ts \
        app/src/lib/game/tuod-play.data.ts \
        app/tests/lib/game/tuod-play.data.test.ts
git commit -m "feat: wire TUOD onto the DartBot play loop"
```

---

### Task 8: Score Training play loop — a seated DartBot actually throws

**Files:**
- Modify: `app/src/lib/game/types.ts` (`ScoreTrainingPlayContext`, lines 313-366)
- Modify: `app/src/lib/game/score-training-play.data.ts`
- Test: `app/tests/lib/game/score-training-play.data.test.ts`

**Interfaces:**
- Consumes: Task 1's `chooseTarget` from `@modules/dartbot/strategy/scoring.strategy.module` (no arguments — Score Training has no remaining/checkout view), `skillProfileForLevel`, `createDartRng`, `throwDart as botThrowDart`, `playFoldBotQuickScoreVisit`/`playRunBotVisualBoardVisit`/`undoToActiveSeat`, `scoreTrainingEngineFactory` (value export from `@modules/game/score-training.engine.module`).
- Produces: `ScoreTrainingPlayContext.maybeRunBotVisit()`, `.botThrowing`.

- [ ] **Step 1: Write the failing tests**

Append to `app/tests/lib/game/score-training-play.data.test.ts`, mirroring Task 6's three tests, swapping `play.recordVisit.call(play, 26, false)` for `play.submitVisit.call(play)` after setting `play.scoreInput.setValue("26")` — Score Training's own quick-score entry path — and reusing this file's own `makePlay`/config-builder helper:

```ts
describe("DartBot opponent", () => {
  const BOT_REF = "bot-1";
  const HUMAN_REF = "human-1";

  function seatsWithBot() {
    return [
      {
        participantRef: HUMAN_REF,
        displayName: "Levi",
        sideKey: "A",
        participantTypeKey: "PLAYER" as const,
      },
      {
        participantRef: BOT_REF,
        displayName: "DartBot",
        sideKey: "B",
        participantTypeKey: "DARTBOT" as const,
        dartbot: { level: 8, seed: 424242, levelSource: "MANUAL" as const },
      },
    ];
  }

  it("under VISUAL_BOARD, the bot throws its own visit once it becomes active", async () => {
    const play = makePlay({ configSnapshot: botConfig() });
    await play.init.call(play);
    play.scoreInput.setValue("26");

    await play.submitVisit.call(play);

    const botTurns = play.$store.game.turns.filter(
      (turn) => turn.participantRef === BOT_REF,
    );
    expect(botTurns.length).toBeGreaterThan(0);
    expect(play.state()!.activeParticipantRef).toBe(HUMAN_REF);
  });

  it("under QUICK_SCORE, the bot's visit uploads as one turn with darts: []", async () => {
    const play = makePlay({ configSnapshot: botConfig() });
    await play.init.call(play);
    play.scoreInput.setValue("26");

    await play.submitVisit.call(play);

    const botTurn = play.$store.game.turns.find(
      (turn) => turn.participantRef === BOT_REF,
    );
    expect(botTurn).toBeDefined();
    expect(botTurn!.darts).toEqual([]);
  });

  it("undoVisit crosses the seat boundary back to the human", async () => {
    const play = makePlay({ configSnapshot: botConfig() });
    await play.init.call(play);
    play.scoreInput.setValue("26");
    await play.submitVisit.call(play);
    expect(play.state()!.activeParticipantRef).toBe(HUMAN_REF);

    play.undoVisit.call(play);

    expect(play.state()!.activeParticipantRef).toBe(HUMAN_REF);
  });
});
```

Replace `botConfig()` with `{ ...<this file's own base ROUNDS-duration 1v1 config builder>(), seats: seatsWithBot() }`, reusing whichever config this file's existing guest tests already build.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/score-training-play.data.test.ts`
Expected: FAIL — `maybeRunBotVisit` doesn't exist.

- [ ] **Step 3: Add the type fields**

In `app/src/lib/game/types.ts`, `ScoreTrainingPlayContext` (starts line 313): after `showFinishConfirm: boolean;` (line 328) add:

```ts
  botThrowing: boolean;
```

After `undoVisit(this: ScoreTrainingPlayContext): void;` (line 359) add:

```ts
  maybeRunBotVisit(this: ScoreTrainingPlayContext): Promise<void>;
```

- [ ] **Step 4: Wire the play data**

In `app/src/lib/game/score-training-play.data.ts`:

Replace the `play-lifecycle` import block:

```ts
import {
  armHiddenTimer,
  clearHiddenTimer,
  playAbandonAndExit,
  playBack,
  playFoldBotQuickScoreVisit,
  playRunBotVisualBoardVisit,
  playUploadAndCompleteSession,
  playVisitMarkers,
  runPlayAgain,
  undoToActiveSeat,
} from "@lib/game/play-lifecycle";
import { skillProfileForLevel } from "@modules/dartbot/skill-profile.module";
import { createDartRng } from "@modules/dartbot/rng.module";
import { throwDart as botThrowDart } from "@modules/dartbot/throw-engine.module";
import { chooseTarget } from "@modules/dartbot/strategy/scoring.strategy.module";
```

Change `import type { RulesetVersionKey } from "@lib/types";` to:

```ts
import type { RulesetVersionKey, SeatFact } from "@lib/types";
```

Add `BotDartThrower`, `BotPacing` to the `./types` type import block:

```ts
import type {
  BoardMarker,
  BotDartThrower,
  BotPacing,
  ScoreTrainingPlayContext,
  ScoreTrainingResultsSnapshot,
  ScoreTrainingSeatResult,
} from "./types";
```

Replace the value import so `scoreTrainingEngineFactory` is also available:

```ts
// Value import, not `import type`: the class is the narrowing target below,
// and importing it also runs the module's side effect, which registers
// scoreTrainingEngineFactory so the registry can resolve this page's own
// RULESET_VERSION_KEY. `scoreTrainingEngineFactory` is imported directly
// (not via the type-erased registry) so `playFoldBotQuickScoreVisit`'s
// `TState` infers as `ScoreTrainingState` with no cast at the call site.
import {
  ScoreTrainingEngine,
  foldScoreTrainingState,
  scoreTrainingEngineFactory,
} from "@modules/game/score-training.engine.module";
```

Add, right after `const RULESET_VERSION_KEY: RulesetVersionKey = "SCORE_TRAINING_V1";`:

```ts
const BOT_PRE_THROW_MS = 900;
const BOT_POST_THROW_MS = 250;
const DARTS_PER_VISIT = 3;

type DartbotSeat = Extract<SeatFact, { participantTypeKey: "DARTBOT" }>;

function findBotSeat(seats: readonly SeatFact[]): DartbotSeat | undefined {
  return seats.find(
    (seat): seat is DartbotSeat => seat.participantTypeKey === "DARTBOT",
  );
}

function botDartIndex(turns: readonly TurnFact[], botRef: string): number {
  return turns
    .filter((turn) => turn.participantRef === botRef)
    .reduce((sum, turn) => sum + turn.darts.length, 0);
}

/** No `remaining`/checkout view — `chooseTarget()` always fires treble 20
 * (Task 1, D-G). */
function throwOneDart(botSeat: DartbotSeat, dartIndex: number): DartObservation {
  const profile = skillProfileForLevel(botSeat.dartbot.level);
  const rng = createDartRng(botSeat.dartbot.seed, dartIndex);
  const intent = chooseTarget();
  const thrown = botThrowDart(intent, profile, rng);
  return {
    hitTargetNumber: thrown.hit.targetNumber,
    hitZoneKey: thrown.hit.zoneKey,
    locationX: thrown.landing.x,
    locationY: thrown.landing.y,
  };
}

function throwBotDart(
  context: ScoreTrainingPlayContext,
  botSeat: DartbotSeat,
): { observation: DartObservation; pacing: BotPacing } {
  const dartIndex = botDartIndex(
    context.$store.game.turns,
    botSeat.participantRef,
  );
  return {
    observation: throwOneDart(botSeat, dartIndex),
    pacing: { preThrowMs: BOT_PRE_THROW_MS, postThrowMs: BOT_POST_THROW_MS },
  };
}
```

(the QUICK_SCORE thrower needs no state parameter at all here, unlike Task 6/7 — `throwOneDart` never reads `remaining`, so `maybeRunBotVisit`'s fold callback below calls it directly)

Add `botThrowing: false,` to the returned state object, right after `showFinishConfirm: false,`:

```ts
    showFinishConfirm: false,
    botThrowing: false,
```

At the end of `init()`, right after `this.hasActiveSession = true;`, add:

```ts
        this.hasActiveSession = true;
        await this.maybeRunBotVisit();
```

At the end of `submitVisit()`, replace the tail:

```ts
      this.error = "";
      this.scoreInput.clear();
      this.$store.game.recordFacts(this.engine.facts());
      this.loading = false;
    },
```

with:

```ts
      this.error = "";
      this.scoreInput.clear();
      this.$store.game.recordFacts(this.engine.facts());
      this.loading = false;
      await this.maybeRunBotVisit();
    },
```

In `recordDart()`, after `this.$store.game.recordFacts(this.engine.facts());` add a bot trigger — but `recordDart` here is synchronous (`recordDart(this: ScoreTrainingPlayContext, observation: DartObservation)`, no `async`); widen its signature to `async` and `void`-fire the bot the same way `armHiddenTimer` already fires as a side effect:

```ts
    async recordDart(
      this: ScoreTrainingPlayContext,
      observation: DartObservation,
    ) {
      if (!this.engine || this.finished || this.showFinishConfirm) return;

      if (this.engine.wouldComplete(observation)) {
        this.pendingDartObservation = observation;
        this.showFinishConfirm = true;
        return;
      }

      this.engine.record(observation);
      this.error = "";
      this.$store.game.recordFacts(this.engine.facts());
      armHiddenTimer(this, this.$store.game.turns);
      await this.maybeRunBotVisit();
    },
```

Update `boardInputData`'s `onCommit` callback, which currently calls `self.recordDart(observation)` expecting no return value — this now returns a `Promise<void>`, which an unawaited call still fires-and-forgets correctly (the callback type itself is `(observation: DartObservation) => void`, and a fire-and-forget `Promise` return from an arrow function assigned to a `void`-returning slot is allowed by TypeScript); no change needed at the `...boardInputData(...)` call site.

Add `maybeRunBotVisit` right after `recordDart`:

```ts
    async maybeRunBotVisit(this: ScoreTrainingPlayContext) {
      const botSeat = findBotSeat(this.$store.game.seats);
      if (!botSeat || !this.engine || this.finished) return;
      const state = this.state();
      if (!state || state.activeParticipantRef !== botSeat.participantRef)
        return;

      if (this.$store.game.inputModeKey === "QUICK_SCORE") {
        let dartIndex = botDartIndex(
          this.$store.game.turns,
          botSeat.participantRef,
        );
        const fold = playFoldBotQuickScoreVisit(
          scoreTrainingEngineFactory,
          this.$store.game.configSnapshot!,
          this.engine.facts(),
          () => throwOneDart(botSeat, dartIndex++),
          DARTS_PER_VISIT,
        );
        if (this.engine.wouldComplete(fold.totalScore)) {
          this.engine.record(fold.totalScore);
          this.$store.game.recordFacts(this.engine.facts());
          this.finished = true;
          this.completionStatus = "pending";
          await this.uploadAndCompleteSession();
          return;
        }
        this.engine.record(fold.totalScore);
        this.$store.game.recordFacts(this.engine.facts());
        return;
      }

      const thrower: BotDartThrower = () => throwBotDart(this, botSeat);
      await playRunBotVisualBoardVisit(this, botSeat.participantRef, thrower);
    },
```

Replace `undoVisit`:

```ts
    undoVisit(this: ScoreTrainingPlayContext) {
      if (this.finished || this.showFinishConfirm) return;
      if (!this.engine) return;
      const botSeat = findBotSeat(this.$store.game.seats);
      if (botSeat) {
        const humanSeat = this.$store.game.seats.find(
          (seat) => seat.participantTypeKey === "PLAYER",
        )!;
        undoToActiveSeat(this, humanSeat.participantRef);
      } else {
        if (!this.engine.undo()) return;
        clearHiddenTimer(this);
        this.$store.game.recordFacts(this.engine.facts());
      }
      this.scoreInput.clear();
      this.error = "";
      void this.maybeRunBotVisit();
    },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/score-training-play.data.test.ts`
Expected: PASS (all tests, including the 3 new ones)

- [ ] **Step 6: Format, run the full suite, and commit**

```bash
cd app && npm run format && npx vitest run
```

```bash
git add app/src/lib/game/types.ts \
        app/src/lib/game/score-training-play.data.ts \
        app/tests/lib/game/score-training-play.data.test.ts
git commit -m "feat: wire Score Training onto the DartBot play loop"
```

---

### Task 9: Docs, gates, context maintenance

**Files:**
- Modify: `docs/architecture/08-DartBot.md` (version header + Strategy Layer table + dependency table row)
- Modify: `FINDINGS.md` (only if any new finding surfaces — none is expected; do not invent one)

**Interfaces:** none — this task is documentation and validation only.

- [ ] **Step 1: Update `08-DartBot.md`**

Bump the version header (top of the file) with a new entry, following the file's own changelog convention exactly (see the existing 0.8.1/0.8.2 entries for Shanghai/Singles Training as the template): state that `RULESET_DARTBOT` now also admits `121_V1`, `TUOD_V1`, `SCORE_TRAINING_V1`; that 121/TUOD reuse `x01.strategy.module.ts` unchanged; that Score Training uses the new `scoring.strategy.module.ts` (D-G, Score-Training-only scope — 501 was not refactored); and that the play loop is now wired on `one-twenty-one-play.data.ts`, `tuod-play.data.ts`, `score-training-play.data.ts`.

In the §Strategy Layer and Game Coverage table (`121_V1`/`TUOD_V1`/`SCORE_TRAINING_V1` rows), no column values change — the table already predicted this shape ("X01 ladder" / "Score Training" strategy names, `QUICK_SCORE`/`VISUAL_BOARD`). Add one sentence under the table noting the "X01 ladder" label for 121/TUOD resolved to reusing `x01.strategy.module.ts` rather than a separate module, and "Score Training" resolved to the new `scoring.strategy.module.ts`.

In the dependency table's "The play loop" row (currently reads "shipped on Bob's 27, Shanghai and Singles Training"), widen it to also name 121, TUOD, and Score Training, and drop `app/src/lib/game/bobs27-play.data.ts` from "Location" in favor of listing all six wired play-data files, mirroring how the 0.8.1/0.8.2 entries updated this same row.

- [ ] **Step 2: Run the context-maintenance skill**

Invoke the `context-maintenance` skill now, per root `CLAUDE.md`'s mandatory rule — it covers the context-map registration check, decision-ledger entry (none expected here — this is an implementation of an already-recorded D-G/D-I/D-J, not a new decision), and the findings gate.

- [ ] **Step 3: Run the full gate suite**

```bash
cd app && npm run validate:app
```

Expected: every step exits 0; the type gate reports 0 errors, 0 warnings, 0 hints.

Also run, from repo root:

```bash
bash scripts/check-context-map.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-budget.sh
```

Expected: all three pass.

- [ ] **Step 4: Format and commit**

```bash
cd app && npm run format
git add docs/architecture/08-DartBot.md
git commit -m "docs: DartBot on 121, TUOD, Score Training"
```

- [ ] **Step 5: Push**

```bash
git push -u origin claude/score-training-debug-121-tuod-me46ko
```

---

## Self-Review Notes

- **Spec coverage:** Task 1 covers "New `scoring.strategy.module.ts`"; Task 2 covers `RULESET_DARTBOT`; Tasks 3-5 cover "Setup UI + seat admission" per game; Tasks 6-8 cover "Play-loop wiring" per game; Task 9 covers docs/context-maintenance and the spec's Testing section's live-verify step (folded into Task 9's manual check before calling the branch done — added as an explicit note below since the spec called it out and no automated task exercises a real browser).
- **Live-verify reminder (not a task — do this once Tasks 1-8 are green):** start the dev server (`astro dev --background`, per `app/CLAUDE.md`) and manually seat a DartBot at `/games/121/setup`, `/games/tuod/setup`, and `/games/score-training/setup`, then play one visit through to confirm the bot actually throws under both QUICK_SCORE and VISUAL_BOARD, exactly as the design spec's Testing section asks.
- **Placeholder scan:** none found — every step carries real code or an exact command.
- **Type consistency:** `maybeRunBotVisit`, `botThrowing`, `DartbotSeat`, `findBotSeat`, `botDartIndex`, `throwBotDart`, `throwBotQuickScoreDart`/`throwOneDart` are named identically to their `five-oh-one-play.data.ts` counterparts across Tasks 6-8, and each task's own type additions in `types.ts` match the method names its own play-data/setup-data task adds.
