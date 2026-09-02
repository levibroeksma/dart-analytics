# DartBot & 1v1 Setup-Wiring Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close FINDINGS.md F54, F45, F55, F56, F57 — five independent participant/seat-wiring defects around DartBot and 1v1 setup that share three code paths (`session-mode-resolution.ts`, `session-seats.service.ts`, `setup-controller.ts`).

**Architecture:** No new modules. Each task is a targeted fix inside an existing file: two setup-data controllers gain the bot/guest state their sibling controllers already carry (F54, half of F45), the shared preset-setup factory gains a per-context ruleset-key resolver (the other half of F45), a bot QUICK_SCORE fold loop gains a second stop condition (F55), two seat-fact composers narrow a fallback into a thrown error (F56), and one doc paragraph is reworded (F57, no code).

**Tech Stack:** Astro.js, TypeScript, Alpine.js (`.data.ts` factories), Vitest.

## Global Constraints

- Every changed runtime `.ts` file under `app/src/` must have its own test file touched in the same task (D224, `scripts/check-test-coverage.sh`) — each task below already pairs one.
- No `//`/`/* */` comments inside TypeScript function/method bodies (`app/CLAUDE.md`); JSDoc above the declaration only.
- Semantic tokens / existing UI components only for any markup — this plan touches no `.astro` files, so this does not apply, but note it if a task is later found to need one.
- `npm run validate:app` (via the `validate-app` skill) must be run before any task is claimed done; `context-maintenance` and `run-all-gates` run once at the end of the whole plan (Task 7).
- Specs are historical once written (`docs/CLAUDE.md`) — do not edit `docs/superpowers/specs/2026-09-02-dartbot-setup-wiring-fixes-design.md` while implementing this plan.
- Commit after every task; never bundle two tasks into one commit.

---

## Task 1: F54 — seat a DartBot from the 501 setup screen

**Files:**

- Modify: `app/src/lib/game/types.ts` (`FiveOhOneSetupContext`, ~line 502-541)
- Modify: `app/src/lib/game/five-oh-one-setup.data.ts`
- Test: `app/tests/lib/game/five-oh-one-setup.data.test.ts`

**Interfaces:**

- Consumes: `addBotOpponent(context: GuestListContext): boolean` (`@lib/game/guest-list`, already exported); `participantsFromGuests(guests, bot?)` (`@lib/game/session-mode-resolution`, already accepts an optional `bot` — no change needed).
- Produces: `FiveOhOneSetupContext.bot: { level: number } | null`, `.showOpponentChooser: boolean`, `.addBot()`, `.removeBot()` — the same shape `PresetSetupContext` already carries, so `AddGuestButton.astro`/`OpponentChooserModal.astro` (already rendered on the 501 setup page via `UserSection allowDartbot={supportsDartbot("501_V1")}`) work unchanged.

- [ ] **Step 1: Write the failing tests**

Add to `app/tests/lib/game/five-oh-one-setup.data.test.ts`, inside the existing top-level `describe("fiveOhOneSetup", ...)` block (after the `createSetup` helper, alongside the other `it(...)` blocks):

```ts
describe("bot wiring", () => {
  it("addBot seats a level-8 DartBot and start() sends a 2-seat DARTBOT participants array", async () => {
    const setup = createSetup();
    setup.presets = [QUICK_PLAY_PRESET];
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

  it("addBot refuses when a guest is already seated, and vice versa", () => {
    const setup = createSetup();

    setup.newGuestName = "Guest 1";
    setup.addGuest();
    setup.addBot();
    expect(setup.bot).toBeNull();

    setup.removeGuest(0);
    setup.addBot();
    setup.newGuestName = "Guest 2";
    setup.addGuest();
    expect(setup.guests).toEqual([]);
  });

  it("removeBot clears the seated bot", () => {
    const setup = createSetup();
    setup.addBot();

    setup.removeBot();

    expect(setup.bot).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/five-oh-one-setup.data.test.ts`
Expected: FAIL — `setup.addBot is not a function` (and the type-check on `createSetup`'s return would separately fail once `types.ts` is edited out of step with the data file, so do Step 3 immediately after confirming this red).

- [ ] **Step 3: Add the fields to `FiveOhOneSetupContext`**

In `app/src/lib/game/types.ts`, extend the type (currently lines 502-541):

```ts
export type FiveOhOneSetupContext = {
  presets: ConfigurationPresetData[];
  startingScoreOption: FiveOhOneStartingScoreOption;
  startingScoreValue: number | string | null;
  scoreClampNotice: string;
  legsToWin: number | string | null;
  legsClampNotice: string;
  guests: { displayName: string }[];
  showAddGuestModal: boolean;
  newGuestName: string;
  bot: { level: number } | null;
  showOpponentChooser: boolean;
  loading: boolean;
  error: string;
  activeSession: SessionActiveData | null;
  showActiveSessionModal: boolean;
  loadingReconciliation: boolean;
  reconciliationFailed: boolean;
  $store: {
    game: {
      sessionId: string | null;
      startSession(input: unknown): void;
      reset(): void;
    };
    settings: {
      captureModeKey: string;
      inputModeKey: string;
    };
  };
  init(this: FiveOhOneSetupContext): Promise<void>;
  reconcile(
    this: FiveOhOneSetupContext,
    activeSessions: SessionActiveData[],
  ): Promise<void>;
  retryReconciliation(this: FiveOhOneSetupContext): Promise<void>;
  continueSession(this: FiveOhOneSetupContext): void;
  abandonSession(this: FiveOhOneSetupContext): Promise<void>;
  basePreset(this: FiveOhOneSetupContext): ConfigurationPresetData | undefined;
  addGuest(this: FiveOhOneSetupContext): void;
  addBot(this: FiveOhOneSetupContext): void;
  removeGuest(this: FiveOhOneSetupContext, index: number): void;
  removeBot(this: FiveOhOneSetupContext): void;
  start(this: FiveOhOneSetupContext): Promise<void>;
};
```

- [ ] **Step 4: Wire the fields into `fiveOhOneSetup()`**

In `app/src/lib/game/five-oh-one-setup.data.ts`:

Change the import:

```ts
import { addBotOpponent, addTypedGuest } from "@lib/game/guest-list";
```

Add state fields (after `newGuestName: "",`):

```ts
    guests: [] as { displayName: string }[],
    showAddGuestModal: false,
    newGuestName: "",
    bot: null as { level: number } | null,
    showOpponentChooser: false,
    loading: false,
```

Add methods (after `addGuest`/before `removeGuest`, matching `setup-controller.ts`'s own ordering):

```ts
    addGuest(this: FiveOhOneSetupContext) {
      addTypedGuest(this);
    },

    addBot(this: FiveOhOneSetupContext) {
      addBotOpponent(this);
    },

    removeGuest(this: FiveOhOneSetupContext, index: number) {
      this.guests.splice(index, 1);
    },

    removeBot(this: FiveOhOneSetupContext) {
      this.bot = null;
    },
```

Change the one line in `start()`:

```ts
      const participants = participantsFromGuests(this.guests, this.bot);
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/five-oh-one-setup.data.test.ts`
Expected: PASS, all tests including the three new ones.

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/game/types.ts app/src/lib/game/five-oh-one-setup.data.ts app/tests/lib/game/five-oh-one-setup.data.test.ts
git commit -m "$(cat <<'EOF'
feat: seat a DartBot opponent from the 501 setup screen

Closes FINDINGS.md F54.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VG66ujdLWdoG7zBeddAGj9
EOF
)"
```

---

## Task 2: F45 (121) — 121 resolves 121_V1 once guested, with no duration overrides

**Files:**

- Modify: `app/src/lib/game/one-twenty-one-setup.data.ts`
- Test: `app/tests/lib/game/one-twenty-one-setup.data.test.ts`

**Interfaces:**

- Consumes: nothing new — `RulesetVersionKey` (`@lib/types`), `participantsFromGuests` (unchanged, no `bot` arg needed here), `toSnapshot`, `resolveSessionModePair`, `startSessionInput`, all already imported.
- Produces: no exported symbol changes — `start()`'s internal ruleset-key/preset resolution becomes guest-count-aware. `oneTwentyOneSetup()`'s public shape is unchanged.

- [ ] **Step 1: Write the failing test**

Add to `app/tests/lib/game/one-twenty-one-setup.data.test.ts`, after the `describe("session creation", ...)` block closes (before the file's second top-level `describe("oneTwentyOneSetup — guests", ...)`):

```ts
describe("guested 1v1 resolves 121_V1", () => {
  const V1_PRESET = {
    configurationTemplateId: "tmpl-v1-standard",
    name: "121 — Standard",
    configuration: {},
  } as any;

  it("resolves the 121_V1 ruleset key and its duration-type-less preset once a guest is added, with no duration overrides", async () => {
    const setup = createSetup({
      presets: [V1_PRESET, TARGET_PRESET, ROUNDS_PRESET, MINUTES_PRESET],
      durationType: "ROUNDS",
      durationValue: 20,
    });
    setup.newGuestName = "Guest 1";
    setup.addGuest();
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
          displayName: "Guest 1",
          participantTypeKey: "GUEST",
        },
      ],
    } as any);
    vi.stubGlobal("location", { href: "" });

    await setup.start();

    expect(sessionsApi.createSession).toHaveBeenCalledWith(
      expect.objectContaining({
        rulesetVersionKey: "121_V1",
        config: {
          source: "template",
          templateRef: "tmpl-v1-standard",
        },
      }),
    );
    expect(store.game.startSession).toHaveBeenCalledWith(
      expect.objectContaining({
        configSnapshot: expect.objectContaining({}),
      }),
    );
    expect(location.href).toBe("/games/121/play");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/one-twenty-one-setup.data.test.ts -t "resolves the 121_V1"`
Expected: FAIL — `createSession` was called with `rulesetVersionKey: "121_V2"` and a `config.overrides` key present, not the expected `121_V1`/no-overrides shape.

- [ ] **Step 3: Make `start()` guest-count-aware**

In `app/src/lib/game/one-twenty-one-setup.data.ts`, replace `async start(this: OneTwentyOneSetupContext) { ... }` in full:

```ts
    async start(this: OneTwentyOneSetupContext) {
      if (this.loading) return;
      const guested = this.guests.length > 0;
      const rulesetVersionKey: RulesetVersionKey = guested ? "121_V1" : "121_V2";

      const preset = guested
        ? this.presets.find(
            (p) =>
              !(
                "duration_type" in (p.configuration as Record<string, unknown>)
              ),
          )
        : this.presetForMode(this.durationType);
      if (!preset) {
        this.error = "Could not find a preset for this mode.";
        return;
      }

      let overrides: Record<string, unknown> = {};
      if (!guested) {
        overrides = { duration_type: this.durationType };
        if (this.durationType !== "TARGET") {
          const { value, clamped } = clampOneTwentyOneDuration(
            this.durationType,
            this.durationValue,
          );
          this.durationValue = value;
          this.clampNotice = clamped
            ? oneTwentyOneDurationClampNotice(this.durationType)
            : "";
          overrides = { ...overrides, duration_value: value };
        } else {
          this.clampNotice = "";
        }
      }

      this.loading = true;
      this.error = "";
      try {
        const wire = {
          ...(preset.configuration as Record<string, unknown>),
          ...overrides,
        };
        const configSnapshot = toSnapshot(rulesetVersionKey, wire);
        const modePair = resolveSessionModePair(
          rulesetVersionKey,
          this.$store.settings,
        );
        const participants = participantsFromGuests(this.guests);
        const session = await createSession({
          gameTypeKey: GAME_TYPE_KEY,
          rulesetVersionKey,
          captureModeKey: modePair.captureModeKey,
          inputModeKey: modePair.inputModeKey,
          config: {
            source: "template",
            templateRef: preset.configurationTemplateId,
            ...(guested ? {} : { overrides }),
          },
          participants,
        });
        this.$store.game.startSession(
          startSessionInput({
            gameTypeKey: GAME_TYPE_KEY,
            rulesetVersionKey,
            session,
            templateRef: preset.configurationTemplateId,
            configSnapshot,
            modePair,
          }),
        );
        globalThis.location.href = "/games/121/play";
      } catch (err: unknown) {
        const code = (err as { code?: string }).code;
        if (code === "SESSION_ALREADY_ACTIVE") {
          await this.retryReconciliation();
          return;
        }
        this.error = "Could not start the session. Try again.";
      } finally {
        this.loading = false;
      }
    },
```

Remove the now-unused top-level `const RULESET_VERSION_KEY: RulesetVersionKey = "121_V2";` — every use inside `start()` above reads the locally computed `rulesetVersionKey` instead. (No other function in the file references the old constant — `presetForMode`, `selectMode`, `forceTargetIfGuested` never did.)

- [ ] **Step 4: Run the full setup test file to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/one-twenty-one-setup.data.test.ts`
Expected: PASS — the new test and every pre-existing test in the file (the solo-mode `session creation` tests are untouched by the `guested` branch).

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/one-twenty-one-setup.data.ts app/tests/lib/game/one-twenty-one-setup.data.test.ts
git commit -m "$(cat <<'EOF'
fix: resolve 121_V1 for a guested 121 session

Closes FINDINGS.md F45 (121 half).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VG66ujdLWdoG7zBeddAGj9
EOF
)"
```

---

## Task 3: F45 (Singles Training) — dynamic ruleset key in the shared controller + Singles Training's guested SINGLES_V1

**Files:**

- Modify: `app/src/lib/game/types.ts` (`PresetSetupControllerOptions`, ~line 613-619)
- Modify: `app/src/lib/game/setup-controller.ts`
- Modify: `app/src/lib/game/singles-training-setup.data.ts`
- Test: `app/tests/lib/game/setup-controller.test.ts`
- Test: `app/tests/lib/game/singles-training-setup.data.test.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces: `PresetSetupControllerOptions<Ctx>.rulesetVersionKey` now accepts `RulesetVersionKey | ((ctx: Ctx) => RulesetVersionKey)` — a **backward-compatible widening**; every other adopter (Bob's 27, Shanghai, Around the Clock, Doubles Training) keeps passing a plain string and is unaffected.

- [ ] **Step 1: Write the failing test for the shared controller**

Add to `app/tests/lib/game/setup-controller.test.ts`, as a new top-level `describe` block after the existing `describe("guest wiring", ...)` block closes (i.e. as a sibling inside the outer `describe("createPresetSetupController", ...)`, after line ~349's closing, before the outer block's own closing `});`):

```ts
  describe("dynamic rulesetVersionKey", () => {
    function dynamicRuleset(): OrderCtx {
      return {
        ...createPresetSetupController<OrderCtx>({
          gameTypeKey: "SINGLES_TRAINING",
          rulesetVersionKey: (ctx) =>
            ctx.guests.length > 0 ? "SINGLES_V1" : "SINGLES_V2",
          playHref: "/games/singles-training/play",
          label: "Singles Training",
        }),
        orderMode: "LOW_TO_HIGH",
        $store: store,
      } as OrderCtx;
    }

    it("resolves the ruleset key from a function of the current context, evaluated fresh on every start() call", async () => {
      const setup = dynamicRuleset();
      setup.presets = [SINGLES_PRESET];
      vi.mocked(sessionsApi.createSession).mockResolvedValue(SESSION);

      await setup.start();
      expect(sessionsApi.createSession).toHaveBeenCalledWith(
        expect.objectContaining({ rulesetVersionKey: "SINGLES_V2" }),
      );

      setup.guests = [{ displayName: "Guest 1" }];
      await setup.start();
      expect(sessionsApi.createSession).toHaveBeenLastCalledWith(
        expect.objectContaining({ rulesetVersionKey: "SINGLES_V1" }),
      );
    });
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/setup-controller.test.ts -t "resolves the ruleset key from a function"`
Expected: FAIL — a TypeScript error (`rulesetVersionKey` does not accept a function) surfaces as a test-run failure, since `createPresetSetupController` currently types and destructures it as a plain `RulesetVersionKey`.

- [ ] **Step 3: Widen `PresetSetupControllerOptions`**

In `app/src/lib/game/types.ts`, change (currently lines 613-619):

```ts
export type PresetSetupControllerOptions<Ctx extends PresetSetupContext> = {
  gameTypeKey: string;
  rulesetVersionKey: RulesetVersionKey | ((ctx: Ctx) => RulesetVersionKey);
  playHref: string;
  label: string;
  configOverrides?: (ctx: Ctx) => Record<string, unknown>;
};
```

- [ ] **Step 4: Resolve the ruleset key dynamically inside `start()`**

In `app/src/lib/game/setup-controller.ts`:

Change the destructure at the top of `createPresetSetupController`:

```ts
export function createPresetSetupController<Ctx extends PresetSetupContext>(
  options: PresetSetupControllerOptions<Ctx>,
) {
  const { gameTypeKey, playHref, label, configOverrides } = options;
```

Change `start()` (the `preset`/`overrides` lines through the `createSession`/`startSession` calls):

```ts
    async start(this: Ctx) {
      const preset = this.presets[0];
      if (!preset) {
        this.error = `Could not find a preset for ${label}.`;
        return;
      }

      const rulesetVersionKey =
        typeof options.rulesetVersionKey === "function"
          ? options.rulesetVersionKey(this)
          : options.rulesetVersionKey;
      const overrides = configOverrides?.(this);

      this.loading = true;
      this.error = "";
      try {
        const configSnapshot = toSnapshot(
          rulesetVersionKey,
          overrides
            ? {
                ...(preset.configuration as Record<string, unknown>),
                ...overrides,
              }
            : preset.configuration,
        );
        const modePair = resolveSessionModePair(
          rulesetVersionKey,
          this.$store.settings,
        );
        const participants = participantsFromGuests(this.guests, this.bot);
        const session = await createSession({
          gameTypeKey,
          rulesetVersionKey,
          captureModeKey: modePair.captureModeKey,
          inputModeKey: modePair.inputModeKey,
          config: {
            source: "template",
            templateRef: preset.configurationTemplateId,
            ...(overrides ? { overrides } : {}),
          },
          participants,
        });
        this.$store.game.startSession(
          startSessionInput({
            gameTypeKey,
            rulesetVersionKey,
            session,
            templateRef: preset.configurationTemplateId,
            configSnapshot,
            modePair,
          }),
        );
        globalThis.location.href = playHref;
      } catch (err: unknown) {
        const code = (err as { code?: string }).code;
        if (code === "SESSION_ALREADY_ACTIVE") {
          await this.retryReconciliation();
          return;
        }
        this.error = "Could not start the session. Try again.";
      } finally {
        this.loading = false;
      }
    },
```

- [ ] **Step 5: Run the controller test to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/setup-controller.test.ts`
Expected: PASS — the new test, and every existing test (all pass a plain string `rulesetVersionKey`, still handled by the `typeof ... === "function"` branch's `false` arm).

- [ ] **Step 6: Write the failing test for Singles Training's guest wiring**

Add to `app/tests/lib/game/singles-training-setup.data.test.ts`, inside `describe("start", ...)` after the `"sends the selected difficulty override"` test:

```ts
    it("resolves SINGLES_V1 and forces difficulty back to EASY once a guest is added", async () => {
      const setup = createSetup({
        presets: [STANDARD_PRESET],
        difficulty: "HARD",
      });
      setup.newGuestName = "Guest 1";
      setup.addGuest();
      expect(setup.difficulty).toBe("EASY");

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
            displayName: "Guest 1",
            participantTypeKey: "GUEST",
          },
        ],
      } as any);
      vi.stubGlobal("location", { href: "" });

      await setup.start();

      expect(sessionsApi.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          rulesetVersionKey: "SINGLES_V1",
          config: expect.objectContaining({
            overrides: expect.objectContaining({ difficulty: "EASY" }),
          }),
        }),
      );
    });
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/singles-training-setup.data.test.ts -t "resolves SINGLES_V1"`
Expected: FAIL — `createSession` is called with `rulesetVersionKey: "SINGLES_V2"` (hardcoded) and `setup.difficulty` is still `"HARD"`.

- [ ] **Step 8: Make Singles Training guest-aware**

Replace `app/src/lib/game/singles-training-setup.data.ts` in full:

```ts
import { createPresetSetupController } from "@lib/game/setup-controller";
import { addTypedGuest } from "@lib/game/guest-list";
import { targetOrderFor } from "@lib/game/target-order";
import type { SinglesTrainingSetupContext } from "./types";

export function singlesTrainingSetup() {
  return {
    orderMode: "LOW_TO_HIGH" as SinglesTrainingSetupContext["orderMode"],
    difficulty: "EASY" as SinglesTrainingSetupContext["difficulty"],
    ...createPresetSetupController<SinglesTrainingSetupContext>({
      gameTypeKey: "SINGLES_TRAINING",
      rulesetVersionKey: (ctx) =>
        ctx.guests.length > 0 ? "SINGLES_V1" : "SINGLES_V2",
      playHref: "/games/singles-training/play",
      label: "Singles Training",
      configOverrides: (ctx) => ({
        order_mode: ctx.orderMode,
        target_order: targetOrderFor(ctx.orderMode),
        difficulty: ctx.difficulty,
      }),
    }),
    addGuest(this: SinglesTrainingSetupContext) {
      if (addTypedGuest(this)) this.difficulty = "EASY";
    },
  };
}
```

(`SINGLES_V1`'s config schema — `SinglesConfig`, `app/src/lib/game/rulesets/types.ts:72-91` — only allows `difficulty: "EASY"`; forcing it here on every successful guest add is what keeps a HARD/EXTREME selection from reaching `toSnapshot` and failing validation once guested.)

- [ ] **Step 9: Run the Singles Training test file to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/singles-training-setup.data.test.ts`
Expected: PASS — the new test and every pre-existing test (solo-mode tests never add a guest, so `difficulty`/ruleset key resolve exactly as before).

- [ ] **Step 10: Commit**

```bash
git add app/src/lib/game/types.ts app/src/lib/game/setup-controller.ts app/src/lib/game/singles-training-setup.data.ts app/tests/lib/game/setup-controller.test.ts app/tests/lib/game/singles-training-setup.data.test.ts
git commit -m "$(cat <<'EOF'
feat: resolve SINGLES_V1 for a guested Singles Training session

Widens createPresetSetupController's rulesetVersionKey to accept a
per-context resolver function, needed because Singles Training (unlike
Bob's 27/Shanghai/Around the Clock/Doubles Training) plays a different
ruleset version once guested.

Closes FINDINGS.md F45 (Singles Training half).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VG66ujdLWdoG7zBeddAGj9
EOF
)"
```

---

## Task 4: F55 — QUICK_SCORE bot-visit fold stops when the visit it just recorded closes

**Files:**

- Modify: `app/src/lib/game/play-lifecycle.ts`
- Test: `app/tests/lib/game/play-lifecycle.test.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces: `playFoldBotQuickScoreVisit`'s exported signature is unchanged; only its loop's stop condition changes.

- [ ] **Step 1: Write the failing test**

Add to `app/tests/lib/game/play-lifecycle.test.ts`. First, add a purpose-built engine/factory near the existing `SCORE_TRAINING_CONFIG`/`TREBLE_TWENTY`/`MISS_DART` constants (after `const MISS_DART: DartObservation = { ... };`, before `describe("playFoldBotQuickScoreVisit", ...)`):

```ts
type BustableState = { tally: number };

/**
 * A GameEngine whose visit can close on its second dart — like a 501 bust or
 * a non-final-leg checkout — so playFoldBotQuickScoreVisit's early-stop fix
 * (F55) has a case to prove itself against. Score Training's engine, used by
 * this suite's other playFoldBotQuickScoreVisit tests, always takes exactly
 * 3 darts per visit and cannot exercise this path.
 */
class BustableVisitEngine
  implements GameEngine<DartObservation, BustableState>
{
  readonly rulesetVersionKey: RulesetVersionKey = "501_V1";
  readonly stageOwnership = "PER_SEAT" as const;
  private turns: TurnFact[];

  constructor(prior?: EngineFacts) {
    this.turns = prior ? [...prior.turns] : [];
  }

  record(input: DartObservation): BustableState {
    const open = this.turns.at(-1);
    const isNewVisit = !open || open.completedAt !== null;
    const darts = isNewVisit ? [] : [...open!.darts];
    darts.push({
      sequence: darts.length + 1,
      intendedTargetNumber: 20,
      intendedZoneKey: "TREBLE",
      hitTargetNumber: input.hitTargetNumber,
      hitZoneKey: input.hitZoneKey,
      score: input.hitTargetNumber === null ? 0 : 60,
      locationX: null,
      locationY: null,
    });
    const busts = input.hitTargetNumber === null;
    const turn: TurnFact = {
      clientKey: isNewVisit ? `t${this.turns.length + 1}` : open!.clientKey,
      stageClientKey: "leg-1",
      participantRef: "bot-1",
      sequence: isNewVisit ? this.turns.length + 1 : open!.sequence,
      completedAt:
        busts || darts.length === 3 ? "2026-09-02T00:00:00.000Z" : null,
      totalScore: darts.reduce((sum, d) => sum + d.score, 0),
      darts,
    };
    if (isNewVisit) {
      this.turns.push(turn);
    } else {
      this.turns[this.turns.length - 1] = turn;
    }
    return this.state();
  }

  undo(): boolean {
    if (this.turns.length === 0) return false;
    this.turns.pop();
    return true;
  }

  wouldComplete(): boolean {
    return false;
  }

  isComplete(): boolean {
    return false;
  }

  state(): BustableState {
    return { tally: this.turns.length };
  }

  facts(): EngineFacts {
    return {
      stages: [
        {
          clientKey: "leg-1",
          stageTypeKey: "EXERCISE_BLOCK",
          parentClientKey: null,
          sequence: 1,
        },
      ],
      turns: [...this.turns],
    };
  }
}

const bustableEngineFactory: GameEngineFactory<
  Record<string, never>,
  DartObservation,
  BustableState
> = {
  rulesetVersionKey: "501_V1",
  stageOwnership: "PER_SEAT",
  create(_config, prior) {
    return new BustableVisitEngine(prior);
  },
};
```

Then add the test itself, inside `describe("playFoldBotQuickScoreVisit", ...)` as the last test before its closing `});` (after the `"passes the scratch engine's own live state..."` test):

```ts
  it("stops recording once the visit it just recorded into closes, even though the match itself is not complete (F55)", () => {
    let calls = 0;
    const darts = [TREBLE_TWENTY, MISS_DART, TREBLE_TWENTY];

    const fold = playFoldBotQuickScoreVisit(
      bustableEngineFactory,
      {},
      { stages: [], turns: [] },
      () => darts[calls++]!,
      3,
    );

    expect(calls).toBe(2);
    expect(fold).toEqual({ totalScore: 60, dartsThrown: 2 });
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd app && npx vitest run tests/lib/game/play-lifecycle.test.ts -t "stops recording once the visit"`
Expected: FAIL — `calls` is `3` (the loop opens a fabricated third visit instead of stopping), and `fold` does not equal `{ totalScore: 60, dartsThrown: 2 }`.

- [ ] **Step 3: Fix the loop's stop condition**

In `app/src/lib/game/play-lifecycle.ts`, replace `playFoldBotQuickScoreVisit`'s body:

```ts
export function playFoldBotQuickScoreVisit<TConfig, TInput, TState>(
  factory: GameEngineFactory<TConfig, TInput, TState>,
  config: TConfig,
  facts: EngineFacts,
  throwDart: BotQuickScoreThrower<TState>,
  dartsPerVisit: number,
): BotQuickScoreFold {
  const scratch = factory.create(config, facts);
  for (let i = 0; i < dartsPerVisit && !scratch.isComplete(); i++) {
    scratch.record(throwDart(scratch.state()) as TInput);
    if (scratch.facts().turns.at(-1)?.completedAt) break;
  }
  const visitTurn = scratch.facts().turns.at(-1)!;
  return {
    totalScore: visitTurn.totalScore,
    dartsThrown: visitTurn.darts.length,
  };
}
```

- [ ] **Step 4: Run the full test file to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/play-lifecycle.test.ts`
Expected: PASS — the new test, and every pre-existing `playFoldBotQuickScoreVisit` test (Score Training's engine always closes its visit exactly on the 3rd dart, so `completedAt` is `null` for the first two iterations there regardless, and the existing "stops early once the scratch engine reports the visit complete" test is about whole-match completion, a different — and still intact — condition in the same loop).

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/play-lifecycle.ts app/tests/lib/game/play-lifecycle.test.ts
git commit -m "$(cat <<'EOF'
fix: stop a QUICK_SCORE bot-visit fold once its visit closes

playFoldBotQuickScoreVisit looped on isComplete() (whole-match) alone, so
a bust or a non-final-leg checkout that closed the current visit before
the 3rd dart went unnoticed — the loop opened a new, fabricated visit and
returned that instead of the bot's real one.

Closes FINDINGS.md F55.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VG66ujdLWdoG7zBeddAGj9
EOF
)"
```

---

## Task 5: F56 — seat-fact fallbacks stop mislabeling a bare DARTBOT seat

**Files:**

- Modify: `app/src/lib/game/session-mode-resolution.ts`
- Modify: `app/src/services/session-seats.service.ts`
- Test: `app/tests/lib/game/session-mode-resolution.test.ts`
- Test: `app/tests/services/session-seats.service.test.ts`

**Interfaces:**

- Consumes: nothing new.
- Produces: `toSeatFacts` (private) and `composeSeatFacts` (exported, unchanged signature) now throw instead of silently mislabeling a `DARTBOT`-typed input whose `dartbot` payload is absent.

- [ ] **Step 1: Write the failing tests**

Add to `app/tests/lib/game/session-mode-resolution.test.ts`, inside `describe("startSessionInput", ...)` after the `"carries a DARTBOT participant's dartbot payload..."` test:

```ts
  it("throws when a DARTBOT participant's dartbot payload is unexpectedly absent", () => {
    expect(() =>
      startSessionInput({
        gameTypeKey: "BOBS27",
        rulesetVersionKey: "BOBS27_V1",
        session: {
          sessionId: "s1",
          participants: [
            { ref: "a", participantTypeKey: "PLAYER", displayName: "Levi" },
            { ref: "b", participantTypeKey: "DARTBOT", displayName: "DartBot" },
          ],
        },
        templateRef: "tpl-1",
        configSnapshot: {},
        modePair: {
          captureModeKey: "RECREATIONAL",
          inputModeKey: "DETAILED_DARTS",
        },
      }),
    ).toThrow();
  });
```

Add to `app/tests/services/session-seats.service.test.ts`, inside `describe("composeSeatFacts", ...)` after the `"projects a DARTBOT seat's level/seed/levelSource..."` test:

```ts
  it("throws when a DARTBOT-typed seat's dartbot payload is unexpectedly absent", () => {
    expect(() =>
      composeSeatFacts([
        {
          participantId: "id-b",
          participantTypeId: 3,
          playerId: null,
          displayName: "DartBot",
          sideKey: "B",
        },
      ]),
    ).toThrow();
  });
```

- [ ] **Step 2: Run both tests to verify they fail**

Run: `cd app && npx vitest run tests/lib/game/session-mode-resolution.test.ts tests/services/session-seats.service.test.ts -t "unexpectedly absent"`
Expected: FAIL for both — today's code falls through to `PLAYER`/`GUEST` instead of throwing.

- [ ] **Step 3: Narrow `toSeatFacts`**

In `app/src/lib/game/session-mode-resolution.ts`, replace the `toSeatFacts` function body:

```ts
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
    if (participant.participantTypeKey === "DARTBOT") {
      if (!participant.dartbot) {
        throw new Error("DARTBOT participant is missing its dartbot payload");
      }
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

- [ ] **Step 4: Narrow `composeSeatFacts`**

In `app/src/services/session-seats.service.ts`, add the constant beside the existing one and replace the function body:

```ts
const MIN_SEATS = 1;
const MAX_SEATS = 4;
const PLAYER_PARTICIPANT_TYPE_ID = 1;
const DARTBOT_PARTICIPANT_TYPE_ID = 3;
```

```ts
export function composeSeatFacts(plan: readonly SeatPlan[]): SeatFact[] {
  return plan.map((seat) => {
    if (seat.participantTypeId === DARTBOT_PARTICIPANT_TYPE_ID) {
      if (!seat.dartbot) {
        throw new Error("DARTBOT seat is missing its dartbot payload");
      }
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

(`3` is `participant_types.id` for the seeded `DARTBOT` row — `database/seeds/0001_reference_data.sql:334` — a fixed SMALLINT seeded lookup id, the same category `PLAYER_PARTICIPANT_TYPE_ID = 1` beside it already hardcodes.)

- [ ] **Step 5: Run both test files to verify they pass**

Run: `cd app && npx vitest run tests/lib/game/session-mode-resolution.test.ts tests/services/session-seats.service.test.ts`
Expected: PASS — the two new tests, and every pre-existing test in both files (every existing DARTBOT fixture already carries a `dartbot` payload, and every PLAYER/GUEST fixture never carries `participantTypeId: 3`).

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/game/session-mode-resolution.ts app/src/services/session-seats.service.ts app/tests/lib/game/session-mode-resolution.test.ts app/tests/services/session-seats.service.test.ts
git commit -m "$(cat <<'EOF'
fix: throw instead of mislabeling a bare DARTBOT seat's participant type

toSeatFacts and composeSeatFacts each guarded their DARTBOT branch on
type-plus-payload, silently falling through to PLAYER/GUEST when the
payload was absent — the two-collapses-in-opposite-directions failure
mode 08-DartBot.md names as actively dangerous. Unreachable today
(buildSeatPlan always attaches the payload), but nothing enforced it.

Closes FINDINGS.md F56.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VG66ujdLWdoG7zBeddAGj9
EOF
)"
```

---

## Task 6: F57 — reword the scatter-model doc paragraph (no code change)

**Decision already made in the spec: (b)** — reword `08-DartBot.md` to describe `covarianceRotationDegrees` as a fixed per-player technique bias, not a wire-relative rotation. `LEVEL_SKILL_TABLE` seeds it `0` for all 15 levels today, so this is latent and not observably wrong yet; the doc's own illustration currently overclaims what the field does.

**Files:**

- Modify: `docs/architecture/08-DartBot.md` (§The scatter model, line 248)
- Test: none — doc-only, per the spec's own Testing section.

**Interfaces:** none — no code changes.

- [ ] **Step 1: Edit the paragraph**

In `docs/architecture/08-DartBot.md`, replace the paragraph at line 248 (immediately under the `landing = aim + ...` code block, in `## The scatter model`):

Old:

```
A rotatable covariance is what separates a strong player from a weak one in the way the brief requires: a strong player's misses stay on the 20 wire (T5 / T1), a weak player's spray into 12 and 18. A shrinking circle cannot express that difference; an ellipse can.
```

New:

```
A rotatable covariance is what separates a strong player from a weak one in the way the brief requires: a strong player's scatter narrows along a fixed, per-player technique axis, a weak player's stays circular. `covarianceRotationDegrees` (`SkillProfile`) is that fixed per-player bias — it does not (yet) rotate to the aim point's own polar angle, so it cannot yet reproduce a wire-relative pattern for an arbitrary target; `LEVEL_SKILL_TABLE` seeds it `0` for every level pending D-E's population fit (`FINDINGS.md` F57). A shrinking circle cannot express the per-player difference; an ellipse can.
```

- [ ] **Step 2: Confirm the doc still reads consistently**

Run: `grep -n "covarianceRotationDegrees\|wire" docs/architecture/08-DartBot.md`
Expected: the new paragraph appears once; no other paragraph in the file still claims wire-relative rotation for the current implementation.

- [ ] **Step 3: Commit**

```bash
git add docs/architecture/08-DartBot.md
git commit -m "$(cat <<'EOF'
docs: describe covarianceRotationDegrees as a per-player bias, not wire-relative

Closes FINDINGS.md F57 (decision b — doc reword, no code change; the
constant is 0 for every level today, so this was latent, not observable).

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VG66ujdLWdoG7zBeddAGj9
EOF
)"
```

---

## Task 7: Context maintenance and gates

**Files:** none — skill invocations only, plus whatever doc-sync files those skills touch.

- [ ] **Step 1: Run `npm run validate:app`**

Run: `cd app && npm run validate:app`
Expected: every step exits zero; the type gate reports 0 errors/warnings/hints.

- [ ] **Step 2: Run the `context-maintenance` skill**

Follow its procedure in full (CLAUDE.md sync, context-map registration, `decisions/**` entry if any decision was made beyond what the spec already recorded, gate scripts, branch/PR check, findings gate). This plan closes F54, F45, F55, F56, F57 in `FINDINGS.md` — delete those five entries per the findings-log convention (append-only-until-fixed; closed findings are deleted, not marked "Resolved").

- [ ] **Step 3: Run the `run-all-gates` skill**

Dispatches the changed-area `check-*.sh` scripts and the `validate:app` checklist; confirm every gate reports pass, in particular `check-test-coverage.sh` (D224) and `check-findings-log.sh`.

- [ ] **Step 4: Commit any resulting doc-sync changes**

```bash
git add -A
git commit -m "$(cat <<'EOF'
docs: context maintenance for DartBot setup-wiring fixes

Closes FINDINGS.md F54, F45, F55, F56, F57.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VG66ujdLWdoG7zBeddAGj9
EOF
)"
```

(Skip this step if `context-maintenance`/`run-all-gates` made no file changes beyond the five commits already made.)
