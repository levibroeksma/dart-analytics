# Setup Session Mixin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Repo pairings (root `CLAUDE.md`): TDD procedure from `app/CLAUDE.md` §Test-Driven Development; incidental findings → `capturing-discovered-work`; completion → `run-all-gates` + `context-maintenance` + `finishing-a-dart-branch`.

**Goal:** Replace the setup state and session-recovery methods copy-pasted across five setup controllers, and the repeated fields in five context types, with one `createSetupSession` mixin and one `SetupSessionContext` type.

**Architecture:** `createSetupSession({ gameTypeKey, playHref })` returns the 13 shared state fields plus `reconcile`, `retryReconciliation`, `continueSession`, `abandonSession`, `removeGuest`, `removeBot`. Each controller spreads it into its returned literal. `SetupSessionContext` in `types.ts` is the matching type; the five context types intersect with it. `start()`, `init()`, `addGuest()`, `addBot()` and the opt-outs stay as they are.

**Tech Stack:** TypeScript, Alpine.js, Vitest, Prettier, fallow.

**Spec:** `docs/superpowers/specs/2026-10-11-setup-session-mixin-design.md` (#914 task C). The spec shows the factory as generic over `Ctx`; the plan makes it non-generic because every method touches only base fields and takes `this: SetupSessionContext`.

## Global Constraints

- No visible or behavioural change; no store, API, markup or migration change.
- `start()`, `init()`, `addGuest()`, `addBot()`, `forceRoundsIfGuested()` bodies are not edited. Only the object literal around them loses the moved members.
- 501, Score Training, 121, TUOD stay hand-written; `createPresetSetupController` keeps its options.
- Exported types live in `types.ts` only (`scripts/check-type-barrels.sh`); no inline comments (`scripts/check-no-inline-comments.sh`); JSDoc only.
- Tests import types from `@lib/types`, code from `@lib/game/...`; existing per-game `*-setup.data.test.ts` are not edited.
- Prettier formats everything (`npm --prefix app run format:check` clean).
- Run plain, separate shell commands; use `npm --prefix app ...` (worktree isolation guard).

## Review Focus

1. **Shared mutable state** — `guests` and `bot` must be fresh per `createSetupSession()` call; a module-level array would leak between instances. Pinned in Task 1 test "returns fresh state per call".
2. **Play URL per game** — 501 `/games/501/play`, 121 `/games/121/play`, Score Training `/games/score-training/play`, TUOD `/games/tuod/play`, preset games `playHref`. Pinned by the existing per-game continue tests (Tasks 2-3 Step runs) plus Task 1 `continueSession`.
3. **`abandonSession` guard** — no-op without `activeSession` and while `loading`. Pinned in Task 1.
4. **`retryReconciliation` resets `loadingReconciliation` when fetch throws.** Pinned in Task 1.
5. **Type intersection `this`** — methods typed `this: SetupSessionContext` must accept calls on the wider contexts (`this.reconcile(...)` inside `init`, `retryReconciliation()` inside `start`). Pinned by `npm --prefix app run check` after Tasks 2-3.

---

### Task 1: `createSetupSession` and `SetupSessionContext`

**Files:**
- Create: `app/src/lib/game/setup-session.ts`
- Create: `app/tests/lib/game/setup-session.test.ts`
- Modify: `app/src/lib/game/types.ts` (add `SetupSessionContext` above `TuodSetupContext`, ~line 74)

**Interfaces:**
- Consumes: `reconcileActiveSession(gameTypeKey, sessionId, activeSessions, game)` from `@lib/game/session-recovery`; `fetchActiveSessions`, `completeSession`, `SessionActiveData` from `@client/api/sessions`; `DEFAULT_BOT_LEVEL` from `@lib/game/rulesets/capabilities`.
- Produces: `createSetupSession(options: { gameTypeKey: string; playHref: string })` returning the state fields and six methods; `SetupSessionContext` type (13 fields, `$store`, six methods with `this: SetupSessionContext`).

- [ ] **Step 1: Add the type to `types.ts`**

Insert before `export type TuodSetupContext` (additive; nothing uses it yet):

```ts
/**
 * The setup-page contract every game's setup controller shares: the state the
 * continue-session modal, the reconciliation-failed alert and the guest/bot
 * chooser read, the Alpine `$store` slice setup touches, and the six methods
 * that never differ between games. `createSetupSession` supplies all of it;
 * each game's context type intersects this with its own fields.
 */
export type SetupSessionContext = {
  loading: boolean;
  error: string;
  activeSession: SessionActiveData | null;
  showActiveSessionModal: boolean;
  loadingReconciliation: boolean;
  reconciliationFailed: boolean;
  guests: { displayName: string }[];
  showAddGuestModal: boolean;
  newGuestName: string;
  bot: { level: number } | null;
  showOpponentChooser: boolean;
  pendingBotLevel: number;
  showBotLevelPicker: boolean;
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
  reconcile(
    this: SetupSessionContext,
    activeSessions: SessionActiveData[],
  ): Promise<void>;
  retryReconciliation(this: SetupSessionContext): Promise<void>;
  continueSession(this: SetupSessionContext): void;
  abandonSession(this: SetupSessionContext): Promise<void>;
  removeGuest(this: SetupSessionContext, index: number): void;
  removeBot(this: SetupSessionContext): void;
};
```

- [ ] **Step 2: Write the failing test**

`app/tests/lib/game/setup-session.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSetupSession } from "@lib/game/setup-session";
import type { SetupSessionContext } from "@lib/types";
import * as sessionsApi from "@client/api/sessions";
import * as recovery from "@lib/game/session-recovery";

vi.mock("@client/api/sessions");
vi.mock("@lib/game/session-recovery");

describe("createSetupSession", () => {
  let store: SetupSessionContext["$store"];

  beforeEach(() => {
    vi.clearAllMocks();
    store = {
      game: { sessionId: "local-id", reset: vi.fn(), startSession: vi.fn() },
      settings: { captureModeKey: "RECREATIONAL", inputModeKey: "QUICK_SCORE" },
    };
  });

  function create(): SetupSessionContext {
    return {
      ...createSetupSession({ gameTypeKey: "TEST", playHref: "/games/test/play" }),
      $store: store,
    } as SetupSessionContext;
  }

  it("returns fresh state per call", () => {
    const a = create();
    const b = create();
    a.guests.push({ displayName: "Sam" });
    a.bot = { level: 3 };
    expect(b.guests).toEqual([]);
    expect(b.bot).toBeNull();
  });

  it("starts idle", () => {
    const s = create();
    expect(s.loading).toBe(false);
    expect(s.error).toBe("");
    expect(s.activeSession).toBeNull();
    expect(s.showActiveSessionModal).toBe(false);
    expect(s.loadingReconciliation).toBe(false);
    expect(s.reconciliationFailed).toBe(false);
  });

  describe("reconcile", () => {
    it("passes the game key, local session id and store to recovery", async () => {
      vi.mocked(recovery.reconcileActiveSession).mockResolvedValue({
        action: "no_active",
      } as any);
      const s = create();
      const active = [{ sessionId: "x" } as any];
      await s.reconcile(active);
      expect(recovery.reconcileActiveSession).toHaveBeenCalledWith(
        "TEST",
        "local-id",
        active,
        store.game,
      );
    });

    it("shows the modal on match", async () => {
      const active = { sessionId: "x" } as any;
      vi.mocked(recovery.reconcileActiveSession).mockResolvedValue({
        action: "match",
        activeSession: active,
      } as any);
      const s = create();
      s.reconciliationFailed = true;
      await s.reconcile([active]);
      expect(s.activeSession).toBe(active);
      expect(s.showActiveSessionModal).toBe(true);
      expect(s.reconciliationFailed).toBe(false);
    });

    it("flags failure and hides the modal on abandon_failed", async () => {
      vi.mocked(recovery.reconcileActiveSession).mockResolvedValue({
        action: "abandon_failed",
      } as any);
      const s = create();
      s.showActiveSessionModal = true;
      await s.reconcile([]);
      expect(s.showActiveSessionModal).toBe(false);
      expect(s.reconciliationFailed).toBe(true);
    });

    it("clears both flags on no_active", async () => {
      vi.mocked(recovery.reconcileActiveSession).mockResolvedValue({
        action: "no_active",
      } as any);
      const s = create();
      s.showActiveSessionModal = true;
      s.reconciliationFailed = true;
      await s.reconcile([]);
      expect(s.showActiveSessionModal).toBe(false);
      expect(s.reconciliationFailed).toBe(false);
    });
  });

  describe("retryReconciliation", () => {
    it("refetches, reconciles and clears loading", async () => {
      vi.mocked(sessionsApi.fetchActiveSessions).mockResolvedValue([]);
      vi.mocked(recovery.reconcileActiveSession).mockResolvedValue({
        action: "no_active",
      } as any);
      const s = create();
      const pending = s.retryReconciliation();
      expect(s.loadingReconciliation).toBe(true);
      await pending;
      expect(s.loadingReconciliation).toBe(false);
      expect(sessionsApi.fetchActiveSessions).toHaveBeenCalledTimes(1);
    });

    it("clears loading when the fetch throws", async () => {
      vi.mocked(sessionsApi.fetchActiveSessions).mockRejectedValue(
        new Error("offline"),
      );
      const s = create();
      await expect(s.retryReconciliation()).rejects.toThrow("offline");
      expect(s.loadingReconciliation).toBe(false);
    });
  });

  describe("continueSession", () => {
    it("hides the modal and navigates to playHref", () => {
      const loc = { href: "/games/test/setup" };
      vi.stubGlobal("location", loc);
      const s = create();
      s.showActiveSessionModal = true;
      s.continueSession();
      expect(s.showActiveSessionModal).toBe(false);
      expect(loc.href).toBe("/games/test/play");
    });
  });

  describe("abandonSession", () => {
    it("completes as ABANDONED, resets the store and clears the session", async () => {
      vi.mocked(sessionsApi.completeSession).mockResolvedValue({} as any);
      const s = create();
      s.activeSession = { sessionId: "srv-id" } as any;
      s.showActiveSessionModal = true;
      await s.abandonSession();
      expect(sessionsApi.completeSession).toHaveBeenCalledWith(
        "srv-id",
        "ABANDONED",
      );
      expect(store.game.reset).toHaveBeenCalled();
      expect(s.showActiveSessionModal).toBe(false);
      expect(s.activeSession).toBeNull();
      expect(s.loading).toBe(false);
    });

    it("sets an error and keeps the session when completion fails", async () => {
      vi.mocked(sessionsApi.completeSession).mockRejectedValue(new Error("x"));
      const s = create();
      s.activeSession = { sessionId: "srv-id" } as any;
      s.showActiveSessionModal = true;
      await s.abandonSession();
      expect(s.error).toBe("Could not abandon session. Try again.");
      expect(s.activeSession).not.toBeNull();
      expect(s.showActiveSessionModal).toBe(true);
      expect(s.loading).toBe(false);
    });

    it("is a no-op without an active session", async () => {
      const s = create();
      await s.abandonSession();
      expect(sessionsApi.completeSession).not.toHaveBeenCalled();
    });

    it("is a no-op while loading", async () => {
      const s = create();
      s.activeSession = { sessionId: "srv-id" } as any;
      s.loading = true;
      await s.abandonSession();
      expect(sessionsApi.completeSession).not.toHaveBeenCalled();
    });
  });

  it("removeGuest drops the guest at the index", () => {
    const s = create();
    s.guests.push({ displayName: "A" }, { displayName: "B" });
    s.removeGuest(0);
    expect(s.guests).toEqual([{ displayName: "B" }]);
  });

  it("removeBot clears the bot", () => {
    const s = create();
    s.bot = { level: 2 };
    s.removeBot();
    expect(s.bot).toBeNull();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm --prefix app test -- tests/lib/game/setup-session.test.ts`
Expected: FAIL, cannot resolve `@lib/game/setup-session`.

- [ ] **Step 4: Implement**

`app/src/lib/game/setup-session.ts`:

```ts
import {
  fetchActiveSessions,
  completeSession,
  type SessionActiveData,
} from "@client/api/sessions";
import { reconcileActiveSession } from "@lib/game/session-recovery";
import { DEFAULT_BOT_LEVEL } from "@lib/game/rulesets/capabilities";
import type { SetupSessionContext } from "./types";

/**
 * The part of every setup controller that never varies by game: the modal,
 * alert and guest/bot chooser state, and the methods that reconcile a
 * recovered active session, retry that, continue or abandon it. Spread the
 * result into the controller's returned object. Each call returns fresh
 * state, so two controllers never share `guests` or `bot`.
 *
 * `abandon_failed` blocks session creation instead of silently resetting: the
 * orphan session is still ACTIVE server-side, so showing the picker would let
 * a new session violate the single-active-session constraint (D118).
 *
 * `start()`, `init()` and `addGuest()`/`addBot()` stay in each controller;
 * they differ per game.
 */
export function createSetupSession(options: {
  gameTypeKey: string;
  playHref: string;
}) {
  const { gameTypeKey, playHref } = options;

  return {
    loading: false,
    error: "",
    activeSession: null as SessionActiveData | null,
    showActiveSessionModal: false,
    loadingReconciliation: false,
    reconciliationFailed: false,
    guests: [] as { displayName: string }[],
    showAddGuestModal: false,
    newGuestName: "",
    bot: null as { level: number } | null,
    showOpponentChooser: false,
    pendingBotLevel: DEFAULT_BOT_LEVEL as number,
    showBotLevelPicker: false,

    async reconcile(
      this: SetupSessionContext,
      activeSessions: SessionActiveData[],
    ) {
      const result = await reconcileActiveSession(
        gameTypeKey,
        this.$store.game.sessionId,
        activeSessions,
        this.$store.game,
      );

      if (result.action === "match") {
        this.activeSession = result.activeSession;
        this.showActiveSessionModal = true;
        this.reconciliationFailed = false;
      } else if (result.action === "abandon_failed") {
        this.showActiveSessionModal = false;
        this.reconciliationFailed = true;
      } else {
        this.showActiveSessionModal = false;
        this.reconciliationFailed = false;
      }
    },

    async retryReconciliation(this: SetupSessionContext) {
      this.loadingReconciliation = true;
      try {
        const activeSessions = await fetchActiveSessions();
        await this.reconcile(activeSessions);
      } finally {
        this.loadingReconciliation = false;
      }
    },

    continueSession(this: SetupSessionContext) {
      this.showActiveSessionModal = false;
      globalThis.location.href = playHref;
    },

    async abandonSession(this: SetupSessionContext) {
      if (!this.activeSession || this.loading) return;
      this.loading = true;
      this.error = "";
      try {
        await completeSession(this.activeSession.sessionId, "ABANDONED");
        this.$store.game.reset();
        this.showActiveSessionModal = false;
        this.activeSession = null;
      } catch {
        this.error = "Could not abandon session. Try again.";
      } finally {
        this.loading = false;
      }
    },

    removeGuest(this: SetupSessionContext, index: number) {
      this.guests.splice(index, 1);
    },

    removeBot(this: SetupSessionContext) {
      this.bot = null;
    },
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm --prefix app test -- tests/lib/game/setup-session.test.ts`
Expected: PASS, all cases.

- [ ] **Step 6: Format and commit**

Run: `npm --prefix app run format` then `npm --prefix app run format:check` (expect clean).

```bash
git add app/src/lib/game/setup-session.ts app/src/lib/game/types.ts app/tests/lib/game/setup-session.test.ts
git commit -m "feat(setup): add createSetupSession mixin and SetupSessionContext"
```

(Trailers: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_018cTVRcXgBzb8NxpHbgMYhV`, as in every commit below.)

---

### Task 2: Adopt in `createPresetSetupController`

**Files:**
- Modify: `app/src/lib/game/setup-controller.ts`
- Modify: `app/src/lib/game/types.ts` (`PresetSetupContext`, ~line 614)

**Interfaces:**
- Consumes: `createSetupSession`, `SetupSessionContext` (Task 1).
- Produces: unchanged public shape of every preset controller; `PresetSetupContext = SetupSessionContext & {...}`.

- [ ] **Step 1: Rewrite `PresetSetupContext`**

Replace its body with:

```ts
export type PresetSetupContext = SetupSessionContext & {
  presets: ConfigurationPresetData[];
  init(this: PresetSetupContext): Promise<void>;
  addGuest(this: PresetSetupContext): void;
  addBot(this: PresetSetupContext): void;
  start(this: PresetSetupContext): Promise<void>;
};
```

Keep its JSDoc.

- [ ] **Step 2: Edit `setup-controller.ts`**

In the returned object: add `...createSetupSession({ gameTypeKey, playHref }),` as the first member; delete the `loading`, `error`, `activeSession`, `showActiveSessionModal`, `loadingReconciliation`, `reconciliationFailed`, `guests`, `showAddGuestModal`, `newGuestName`, `bot`, `showOpponentChooser`, `pendingBotLevel`, `showBotLevelPicker` fields and the `reconcile`, `retryReconciliation`, `continueSession`, `abandonSession`, `removeGuest`, `removeBot` methods. Keep `presets`, `init`, `addGuest`, `addBot`, `start`. Remove now-unused imports: `completeSession`, `reconcileActiveSession`, `DEFAULT_BOT_LEVEL`, `type SessionActiveData`. Add `import { createSetupSession } from "./setup-session";`.

- [ ] **Step 3: Run the preset-game tests and typecheck**

Run: `npm --prefix app test -- tests/lib/game/bobs27-setup.data.test.ts tests/lib/game/cricket-setup.data.test.ts tests/lib/game/tactics-setup.data.test.ts tests/lib/game/shanghai-setup.data.test.ts tests/lib/game/around-the-clock-setup.data.test.ts tests/lib/game/singles-training-setup.data.test.ts tests/lib/game/doubles-training-setup.data.test.ts`
Expected: PASS, unedited.

Run: `npm --prefix app run check`
Expected: 0 errors, 0 warnings, 0 hints.

- [ ] **Step 4: Format and commit**

Run `npm --prefix app run format`, then:

```bash
git add app/src/lib/game/setup-controller.ts app/src/lib/game/types.ts
git commit -m "refactor(setup): preset controller uses createSetupSession"
```

---

### Task 3: Adopt in 501, Score Training, 121, TUOD

**Files:**
- Modify: `app/src/lib/game/{five-oh-one,score-training,one-twenty-one,tuod}-setup.data.ts`
- Modify: `app/src/lib/game/types.ts` (`TuodSetupContext`, `ScoreTrainingSetupContext`, `FiveOhOneSetupContext`, `OneTwentyOneSetupContext`)

**Interfaces:**
- Consumes: `createSetupSession`, `SetupSessionContext`.
- Produces: unchanged controller shapes; each context type is `SetupSessionContext & {…its own fields/methods…}`.

- [ ] **Step 1: Rewrite the four context types**

For each, remove the 13 shared fields, `$store`, and `reconcile`, `retryReconciliation`, `continueSession`, `abandonSession`, `removeGuest`, `removeBot`; prefix with `SetupSessionContext &`. Everything else (including `presets`, duration/match fields, `$watch`, `init`, `selectMode`, `presetForMode`, `addGuest`, `addBot`, `forceRoundsIfGuested`/`forceTargetIfGuested`, `basePreset`, `capMin`, `syncCap`, `start`) stays verbatim. Example:

```ts
export type TuodSetupContext = SetupSessionContext & {
  presets: ConfigurationPresetData[];
  durationType: TuodDurationType;
  durationValue: number | string | null;
  clampNotice: string;
  $watch(
    key: "durationType",
    callback: (value: TuodDurationType) => void,
  ): void;
  init(this: TuodSetupContext): Promise<void>;
  selectMode(this: TuodSetupContext, type: TuodDurationType): void;
  presetForMode(
    this: TuodSetupContext,
    type: TuodDurationType,
  ): ConfigurationPresetData | undefined;
  addGuest(this: TuodSetupContext): void;
  addBot(this: TuodSetupContext): void;
  forceRoundsIfGuested(this: TuodSetupContext): void;
  start(this: TuodSetupContext): Promise<void>;
};
```

`FiveOhOneSetupContext` keeps its match fields (`startingScoreOption`, …, `capMin`, `syncCap`, `legsClampNotice`) and `basePreset`.

- [ ] **Step 2: Edit each controller**

In each returned literal: add the spread as the first member with that game's constants, and delete the moved fields and methods (`reconcile`, `retryReconciliation`, `continueSession`, `abandonSession`, `removeGuest`, `removeBot`):

| File | Spread |
| ---- | ------ |
| `five-oh-one-setup.data.ts` | `...createSetupSession({ gameTypeKey: GAME_TYPE_KEY, playHref: "/games/501/play" })` |
| `score-training-setup.data.ts` | `...createSetupSession({ gameTypeKey: GAME_TYPE_KEY, playHref: "/games/score-training/play" })` |
| `one-twenty-one-setup.data.ts` | `...createSetupSession({ gameTypeKey: GAME_TYPE_KEY, playHref: "/games/121/play" })` |
| `tuod-setup.data.ts` | `...createSetupSession({ gameTypeKey: GAME_TYPE_KEY, playHref: "/games/tuod/play" })` |

Keep the `abandon_failed` JSDoc only where it now lives (`setup-session.ts`); drop it from `score-training-setup.data.ts`. Remove imports left unused (typically `completeSession`, `reconcileActiveSession`, `DEFAULT_BOT_LEVEL`, `type SessionActiveData`; keep `fetchActiveSessions`, `addBotOpponent`, `addTypedGuest`). Add `import { createSetupSession } from "@lib/game/setup-session";`. Do not edit `start()`, `init()`, `addGuest()`, `addBot()`, `forceRoundsIfGuested()`/`forceTargetIfGuested()`.

- [ ] **Step 3: Run the four test files and typecheck**

Run: `npm --prefix app test -- tests/lib/game/five-oh-one-setup.data.test.ts tests/lib/game/score-training-setup.data.test.ts tests/lib/game/one-twenty-one-setup.data.test.ts tests/lib/game/tuod-setup.data.test.ts`
Expected: PASS, unedited.

Run: `npm --prefix app run check`
Expected: 0/0/0.

- [ ] **Step 4: Format and commit**

Run `npm --prefix app run format`, then:

```bash
git add app/src/lib/game app/src/lib/game/types.ts
git commit -m "refactor(setup): hand-written controllers use createSetupSession"
```

---

### Task 4: Duplication proof, docs, decision, gates

**Files:**
- Modify: `docs/architecture/00-File-Inventory.md` (rows for `setup-session.ts` and its test)
- Modify: `docs/architecture/07-Frontend/09-Adding-A-Game.md` (setup-controller section)
- Modify: `app/src/lib/game/setup-controller.ts` JSDoc (mention the mixin)
- Append: one decision to the domain file `DECISIONS.md` routes setup-controller decisions to (`decisions/frontend/astro.md` if no better match)

- [ ] **Step 1: Fallow proof**

Run: `bash scripts/fallow-gate.sh`
Expected: pass; the 5-instance reconciliation clone group is gone.

- [ ] **Step 2: Docs**

Add inventory rows. In `09-Adding-A-Game.md`, state that every setup controller (including the opt-outs) spreads `createSetupSession` for state and recovery methods, and that a new opt-out controller must too. Update the `setup-controller.ts` JSDoc paragraph to say the shared part lives in `setup-session.ts`.

- [ ] **Step 3: Decision**

Run `bash scripts/next-decision-id.sh`, verify the id is absent from `origin/main` with `git grep "### D<id>" origin/main -- decisions`, then append (format per neighbouring blocks): one `createSetupSession` mixin owns setup state and recovery methods; opt-outs keep `start()`/`init()`/`addGuest()`/`addBot()`; context types intersect `SetupSessionContext`. Re-check the id before the PR.

- [ ] **Step 4: Gates and commit**

Run the `run-all-gates` skill (app + docs areas): `npm --prefix app test`, `npm --prefix app run check`, `npm --prefix app run format:check`, `bash scripts/fallow-gate.sh`, `scripts/check-type-barrels.sh`, `check-no-inline-comments.sh`, `check-game-wiring.sh`, `check-alias-sync.sh`, `check-context-map.sh`, `check-doc-sync.sh`. `validate:app` needs `DATABASE_URL`; report it as not run.

```bash
git add docs decisions app/src/lib/game/setup-controller.ts
git commit -m "docs(setup): document createSetupSession mixin (D<id>)"
```

Then `finishing-a-dart-branch`: push, open the PR from `.github/pull_request_template.md`, subscribe to PR activity, close #914 task C in a comment.
