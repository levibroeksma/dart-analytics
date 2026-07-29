# Alpine Loading State & Button Misusage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix issues #50 (two broken loading spinners) and #49 (a blank Retry button caused by a stale pre-`title`-prop `Button.astro` usage), plus two accessibility/consistency gaps found by a full-codebase button audit, and standardize a `loading` field across `auth.store.ts`/`game.store.ts`.

**Architecture:** `Button.astro` gains a built-in spinner and an optional `loadingExpr` prop (default `"loading"`) so any call site — including ones nested inside an Alpine scope that can't see a page-local `loading` variable — can point it at the right expression (e.g. `$store.game.loading`). The exit-modal bug is fixed by routing its confirm action's in-flight state through the newly-added `game.store.ts` field, which is reachable from any DOM scope via `$store`, unlike a page-local `x-data` property.

**Tech Stack:** Astro, Alpine.js, TypeScript, Vitest.

## Global Constraints

- `.astro` files carry no unit-test coverage in this repo (D101 — no Astro component test runner); all template/component changes are verified by running the dev server, not Vitest.
- `Button.astro`'s `:disabled` stays entirely caller-controlled via its existing `{...props}` passthrough — never bind `disabled` to `loadingExpr` inside `Button.astro` itself.
- When a test's subject is removed or migrated, re-point it at the same guarantee — never delete it or point it at a different input just to stay green (root `CLAUDE.md` Hard Invariant).
- Every store's `loading` field is a plain reactive field, never wrapped in `persist()` — it is transient in-flight UI state, not gameplay data.

---

### Task 1: `game.store.ts` gains a `loading` field

**Files:**
- Modify: `app/src/stores/game.store.ts`
- Test: `app/tests/stores/game.store.test.ts`

**Interfaces:**
- Produces: `gameStore()`'s returned object gains `loading: boolean` (starts `false`), and `reset()` sets it back to `false`. Later tasks (`score-training-play.data.ts`, `ExitModal.astro`) read/write this via `this.$store.game.loading` / `$store.game.loading`.

- [ ] **Step 1: Write the failing test**

In `app/tests/stores/game.store.test.ts`, add this test right after the `"clears every field on reset"` test (which ends just before the `describe("D91 store version", ...)` block):

```ts
  it("defaults loading to false and clears it on reset", () => {
    const store = gameStore(stubPersistFactory());
    expect(store.loading).toBe(false);
    store.loading = true;
    store.reset();
    expect(store.loading).toBe(false);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd app && npx vitest run tests/stores/game.store.test.ts -t "defaults loading to false"`
Expected: FAIL — `store.loading` is `undefined`, not `false` (TypeScript will also flag `store.loading = true` as an error on the property not existing, once you run `npm run check`; for this Vitest-only step the runtime assertion failure is what to look for).

- [ ] **Step 3: Add the field**

In `app/src/stores/game.store.ts`, find:

```ts
    idempotencyKey: persist()<string | null>(null).as("game.idempotencyKey"),

    /** Called by Alpine once this store's `$persist` fields have resolved. */
    init() {
```

Replace with:

```ts
    idempotencyKey: persist()<string | null>(null).as("game.idempotencyKey"),
    loading: false,

    /** Called by Alpine once this store's `$persist` fields have resolved. */
    init() {
```

- [ ] **Step 4: Clear it on reset**

In the same file, find:

```ts
    reset() {
      this.gameTypeKey = null;
      this.rulesetVersionKey = null;
      this.sessionId = null;
      this.participantRef = null;
      this.configSnapshot = null;
      this.templateRef = null;
      this.stages = [];
      this.turns = [];
      this.timerRemainingMs = null;
      this.timerStartedAt = null;
      this.timerExpired = false;
      this.idempotencyKey = null;
    },
```

Replace with:

```ts
    reset() {
      this.gameTypeKey = null;
      this.rulesetVersionKey = null;
      this.sessionId = null;
      this.participantRef = null;
      this.configSnapshot = null;
      this.templateRef = null;
      this.stages = [];
      this.turns = [];
      this.timerRemainingMs = null;
      this.timerStartedAt = null;
      this.timerExpired = false;
      this.idempotencyKey = null;
      this.loading = false;
    },
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd app && npx vitest run tests/stores/game.store.test.ts`
Expected: PASS — all tests in the file, including the new one and the existing `"obtains a fresh persist() per field"` test (still expects exactly 13 `persist()` calls — `loading` is a plain field and must NOT change that count).

- [ ] **Step 6: Commit**

```bash
git add app/src/stores/game.store.ts app/tests/stores/game.store.test.ts
git commit -m "feat: add loading field to game.store.ts"
```

---

### Task 2: `auth.store.ts` gains a `loading` field

**Files:**
- Modify: `app/src/stores/auth.store.ts`
- Test: `app/tests/stores/auth.store.test.ts`

**Interfaces:**
- Produces: `authStore()`'s returned object gains `loading: boolean` (starts `false`), set `true` on entry to `init()`/`signIn()`/`signOut()` and `false` on exit (success or throw).

- [ ] **Step 1: Write the failing tests**

In `app/tests/stores/auth.store.test.ts`, add to the `describe("authStore.init", ...)` block (after the existing `it("treats getSession failure as anonymous on a public page", ...)`  test):

```ts
  it("sets loading true while init is in flight, false once it settles", async () => {
    vi.mocked(authClient.getSession).mockResolvedValue({
      data: { session: { id: "s1" } },
    });
    vi.stubGlobal("location", { pathname: "/", replace: vi.fn() });
    const store = authStore();

    const promise = store.init();
    expect(store.loading).toBe(true);
    await promise;

    expect(store.loading).toBe(false);
  });
```

Add to `describe("authStore.signIn", ...)`:

```ts
  it("sets loading true while signIn is in flight, false after success", async () => {
    let resolveSignIn!: (
      v: Awaited<ReturnType<typeof authClient.signIn.email>>,
    ) => void;
    vi.mocked(authClient.signIn.email).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSignIn = resolve;
        }),
    );
    const store = authStore();

    const promise = store.signIn("a@b.nl", "secret");
    expect(store.loading).toBe(true);
    resolveSignIn({ data: {}, error: null });
    await promise;

    expect(store.loading).toBe(false);
  });

  it("clears loading even when signIn throws", async () => {
    vi.mocked(authClient.signIn.email).mockResolvedValue({
      data: null,
      error: { message: "Invalid credentials" },
    });
    const store = authStore();

    await expect(store.signIn("a@b.nl", "wrong")).rejects.toThrow(
      "Invalid credentials",
    );

    expect(store.loading).toBe(false);
  });
```

Add to `describe("authStore.signOut", ...)`:

```ts
  it("sets loading true while signOut is in flight, false after", async () => {
    let resolveSignOut!: () => void;
    vi.mocked(authClient.signOut).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSignOut = resolve;
        }),
    );
    const store = authStore();

    const promise = store.signOut();
    expect(store.loading).toBe(true);
    resolveSignOut();
    await promise;

    expect(store.loading).toBe(false);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd app && npx vitest run tests/stores/auth.store.test.ts`
Expected: the 4 new tests FAIL (`store.loading` is `undefined`); the 3 pre-existing tests still PASS.

- [ ] **Step 3: Implement**

In `app/src/stores/auth.store.ts`, find:

```ts
export function authStore() {
  return {
    status: "checking" as AuthStatus,
    ready: false,

    async init() {
      const hasSession = await hasActiveSession();
      const path = normalizePath(globalThis.location.pathname);

      if (isPublicPage(path) && hasSession) {
        globalThis.location.replace("/");
        return;
      }

      if (!isPublicPage(path) && !hasSession) {
        globalThis.location.replace("/login");
        return;
      }

      this.status = hasSession ? "authenticated" : "anonymous";
      this.ready = true;
    },

    async signIn(email: string, password: string) {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) {
        throw new Error(result.error.message ?? "Sign in failed");
      }
      this.status = "authenticated";
    },

    async signOut() {
      await authClient.signOut();
      this.status = "anonymous";
    },
  };
}
```

Replace with:

```ts
export function authStore() {
  return {
    status: "checking" as AuthStatus,
    ready: false,
    loading: false,

    async init() {
      this.loading = true;
      const hasSession = await hasActiveSession();
      const path = normalizePath(globalThis.location.pathname);

      if (isPublicPage(path) && hasSession) {
        globalThis.location.replace("/");
        return;
      }

      if (!isPublicPage(path) && !hasSession) {
        globalThis.location.replace("/login");
        return;
      }

      this.status = hasSession ? "authenticated" : "anonymous";
      this.ready = true;
      this.loading = false;
    },

    async signIn(email: string, password: string) {
      this.loading = true;
      try {
        const result = await authClient.signIn.email({ email, password });
        if (result.error) {
          throw new Error(result.error.message ?? "Sign in failed");
        }
        this.status = "authenticated";
      } finally {
        this.loading = false;
      }
    },

    async signOut() {
      this.loading = true;
      try {
        await authClient.signOut();
        this.status = "anonymous";
      } finally {
        this.loading = false;
      }
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd app && npx vitest run tests/stores/auth.store.test.ts`
Expected: PASS — all 7 tests (3 pre-existing + 4 new).

- [ ] **Step 5: Commit**

```bash
git add app/src/stores/auth.store.ts app/tests/stores/auth.store.test.ts
git commit -m "feat: add loading field to auth.store.ts"
```

---

### Task 3: Retire `abandonLoading`, use `$store.game.loading` (closes half of #50)

**Files:**
- Modify: `app/src/lib/game/types.ts`
- Modify: `app/src/lib/game/score-training-play.data.ts`
- Test: `app/tests/lib/game/score-training-play.data.test.ts`

**Interfaces:**
- Consumes: `game.store.ts`'s `loading: boolean` field (Task 1).
- Produces: `ScoreTrainingPlayContext["$store"]["game"]` gains `loading: boolean`; `abandonAndExit()` reads/writes `this.$store.game.loading` instead of the removed `this.abandonLoading`.

- [ ] **Step 1: Update the type**

In `app/src/lib/game/types.ts`, find:

```ts
  playAgainLoading: boolean;
  abandonLoading: boolean;
  resultsSnapshot: { total: number; visits: number; average: number } | null;
```

Replace with:

```ts
  playAgainLoading: boolean;
  resultsSnapshot: { total: number; visits: number; average: number } | null;
```

Then find the `$store.game` block:

```ts
      idempotencyKey?: string | null;
      recordFacts(facts: EngineFacts): void;
      reset(): void;
    };
  };
```

Replace with:

```ts
      idempotencyKey?: string | null;
      loading: boolean;
      recordFacts(facts: EngineFacts): void;
      reset(): void;
    };
  };
```

- [ ] **Step 2: Update the test file's `gameStub()` to satisfy the new type**

In `app/tests/lib/game/score-training-play.data.test.ts`, find:

```ts
function gameStub(overrides: Partial<GameStub> = {}): GameStub {
  return {
    rulesetVersionKey: "SCORE_TRAINING_V1",
    sessionId: "s1",
    participantRef: "p1",
    templateRef: "tpl-1",
    configSnapshot: rounds(2),
    stages: [BLOCK],
    turns: [],
    timerRemainingMs: null,
    timerStartedAt: null,
    timerExpired: false,
    idempotencyKey: null,
    recordFacts: vi.fn(function (this: GameStub, facts: EngineFacts) {
      this.stages = [...facts.stages];
      this.turns = [...facts.turns];
    }),
    reset: vi.fn(),
    ...overrides,
  };
}
```

Replace with:

```ts
function gameStub(overrides: Partial<GameStub> = {}): GameStub {
  return {
    rulesetVersionKey: "SCORE_TRAINING_V1",
    sessionId: "s1",
    participantRef: "p1",
    templateRef: "tpl-1",
    configSnapshot: rounds(2),
    stages: [BLOCK],
    turns: [],
    timerRemainingMs: null,
    timerStartedAt: null,
    timerExpired: false,
    idempotencyKey: null,
    loading: false,
    recordFacts: vi.fn(function (this: GameStub, facts: EngineFacts) {
      this.stages = [...facts.stages];
      this.turns = [...facts.turns];
    }),
    reset: vi.fn(function (this: GameStub) {
      this.loading = false;
    }),
    ...overrides,
  };
}
```

(`reset` now clears `loading`, mirroring the real `game.store.ts` behavior from Task 1 — the "with turns" and "with zero turns" `abandonAndExit` tests call `$store.game.reset()` on their success path, and a stub that doesn't clear `loading` would let it leak `true` into any later use of the same stub instance within a test.)

- [ ] **Step 3: Run the existing abandonAndExit tests to see them fail**

Run: `cd app && npx vitest run tests/lib/game/score-training-play.data.test.ts -t "abandonAndExit"`
Expected: FAIL — `app/src/lib/game/score-training-play.data.ts` still references `this.abandonLoading`, which no longer exists on the `ScoreTrainingPlayContext` type (TypeScript error surfaces via `npm run check`; at the Vitest level the "sets error on PATCH failure" test's `expect(play.abandonLoading).toBe(false)` assertion reads `undefined`, not `false`, so it fails).

- [ ] **Step 4: Implement — retire `abandonLoading`, use `$store.game.loading`**

In `app/src/lib/game/score-training-play.data.ts`, find:

```ts
    playAgainError: "",
    playAgainLoading: false,
    abandonLoading: false,
    resultsSnapshot: null as {
```

Replace with:

```ts
    playAgainError: "",
    playAgainLoading: false,
    resultsSnapshot: null as {
```

Then find:

```ts
    async abandonAndExit(this: ScoreTrainingPlayContext) {
      if (this.abandonLoading) return;
      const sessionId = this.$store.game.sessionId;
      if (!sessionId) {
        this.$store.game.reset();
        globalThis.location.href = "/games";
        return;
      }
      this.abandonLoading = true;
      this.error = "";
      try {
        const facts = currentFacts(this);
        if (facts.turns.length > 0) {
          if (!this.$store.game.idempotencyKey) {
            this.$store.game.idempotencyKey = crypto.randomUUID();
          }
          const batch = buildEventsBatch(
            this.$store.game.participantRef!,
            facts,
          );
          await appendBatch(sessionId, this.$store.game.idempotencyKey, batch);
        }
        await completeSession(sessionId, "ABANDONED");
        this.timer?.stop();
        this.$store.game.reset();
        globalThis.location.href = "/games";
      } catch {
        this.error = "Could not abandon session. Try again.";
        this.abandonLoading = false;
      }
    },
```

Replace with:

```ts
    async abandonAndExit(this: ScoreTrainingPlayContext) {
      if (this.$store.game.loading) return;
      const sessionId = this.$store.game.sessionId;
      if (!sessionId) {
        this.$store.game.reset();
        globalThis.location.href = "/games";
        return;
      }
      this.$store.game.loading = true;
      this.error = "";
      try {
        const facts = currentFacts(this);
        if (facts.turns.length > 0) {
          if (!this.$store.game.idempotencyKey) {
            this.$store.game.idempotencyKey = crypto.randomUUID();
          }
          const batch = buildEventsBatch(
            this.$store.game.participantRef!,
            facts,
          );
          await appendBatch(sessionId, this.$store.game.idempotencyKey, batch);
        }
        await completeSession(sessionId, "ABANDONED");
        this.timer?.stop();
        this.$store.game.reset();
        globalThis.location.href = "/games";
      } catch {
        this.error = "Could not abandon session. Try again.";
        this.$store.game.loading = false;
      }
    },
```

- [ ] **Step 5: Re-point the two `abandonLoading`-specific tests at the same guarantee**

In `app/tests/lib/game/score-training-play.data.test.ts`, find:

```ts
    it("ignores a second call while abandonLoading is true", async () => {
```

Replace with:

```ts
    it("ignores a second call while $store.game.loading is true", async () => {
```

Then find:

```ts
      expect(play.error).toBe("Could not abandon session. Try again.");
      expect(play.abandonLoading).toBe(false);
      expect(play.$store.game.reset).not.toHaveBeenCalled();
```

Replace with:

```ts
      expect(play.error).toBe("Could not abandon session. Try again.");
      expect(play.$store.game.loading).toBe(false);
      expect(play.$store.game.reset).not.toHaveBeenCalled();
```

(Both re-point at the exact same guarantee the original tests checked — the guard fires on the in-flight flag, and the flag is cleared after a failed abandon — just via the new field, per the root `CLAUDE.md` rule against re-pointing a test at a different input to keep it green.)

- [ ] **Step 6: Run the full file to verify it passes**

Run: `cd app && npx vitest run tests/lib/game/score-training-play.data.test.ts`
Expected: PASS — all tests in the file.

- [ ] **Step 7: Type-check**

Run: `cd app && npm run check`
Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add app/src/lib/game/types.ts app/src/lib/game/score-training-play.data.ts app/tests/lib/game/score-training-play.data.test.ts
git commit -m "fix: retire dead abandonLoading, use \$store.game.loading"
```

---

### Task 4: `Button.astro` gets a built-in spinner and a configurable `loadingExpr`

**Files:**
- Modify: `app/src/components/forms/Button.astro`

**Interfaces:**
- Produces: `Button.astro` accepts an optional `loadingExpr?: string` prop (default `"loading"`); its title span's visibility and its new built-in spinner both key off that expression instead of the hardcoded `loading` identifier. Task 5 (`ConfirmDialog.astro`) forwards this prop.

- [ ] **Step 1: Implement**

In `app/src/components/forms/Button.astro`, find:

```astro
interface Props {
  type?: "button" | "submit" | "reset";
  title?: string;
  variant?: "primary" | "secondary" | "ghost" | "error";
  icon?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  class?: string;
  [key: string]: unknown;
}

// Props
const {
  type = "button",
  title,
  variant = "primary",
  icon = false,
  disabled = false,
  ariaLabel,
  class: classNameProp = "",
  ...props
}: Props = Astro.props;

// Lib
import { cn } from "@client/cn";
```

Replace with:

```astro
interface Props {
  type?: "button" | "submit" | "reset";
  title?: string;
  variant?: "primary" | "secondary" | "ghost" | "error";
  icon?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  class?: string;
  /** Alpine expression evaluating to a boolean; controls the built-in spinner. */
  loadingExpr?: string;
  [key: string]: unknown;
}

// Props
const {
  type = "button",
  title,
  variant = "primary",
  icon = false,
  disabled = false,
  ariaLabel,
  class: classNameProp = "",
  loadingExpr = "loading",
  ...props
}: Props = Astro.props;

// Lib
import { cn } from "@client/cn";

// Icons
import LoadingIcon from "@icons/loading.svg";
```

Then find:

```astro
<button
  type={type}
  disabled={disabled}
  aria-label={ariaLabel}
  class={className}
  {...props}
>
  <slot name="iconBefore" />
  <span
    x-show="!loading"
    x-cloak
  >
    {title}
  </span>
  <slot name="iconAfter" />
</button>
```

Replace with:

```astro
<button
  type={type}
  disabled={disabled}
  aria-label={ariaLabel}
  class={className}
  {...props}
>
  <slot name="iconBefore" />
  <span
    x-show={`!(${loadingExpr})`}
    x-cloak
  >
    {title}
  </span>
  <LoadingIcon
    x-show={loadingExpr}
    x-cloak
    class="size-5 animate-spin"
  />
  <slot name="iconAfter" />
</button>
```

- [ ] **Step 2: Verify no existing gate scripts flag the change**

Run: `bash scripts/check-astro-conventions.sh`
Expected: `OK: Astro x-show/x-cloak pairing and no template HTML comments.` (the new `LoadingIcon` element carries both `x-show` and `x-cloak`, matching the existing convention this script enforces).

Run: `cd app && npm run check`
Expected: 0 errors — `LoadingIcon` imports the same way `IsLoading.astro`/`LogoutButton.astro`/`login/index.astro` already import it (`@icons/loading.svg`, default export).

- [ ] **Step 3: Commit**

```bash
git add app/src/components/forms/Button.astro
git commit -m "feat: give Button.astro a built-in spinner and configurable loadingExpr"
```

---

### Task 5: Wire the exit-modal confirm button to `$store.game.loading` (closes the other half of #50)

**Files:**
- Modify: `app/src/components/ui/ConfirmDialog.astro`
- Modify: `app/src/components/layout/games/ExitModal.astro`

**Interfaces:**
- Consumes: `Button.astro`'s `loadingExpr` prop (Task 4); `game.store.ts`'s `loading` field (Task 1).
- Produces: `ConfirmDialog.astro` accepts an optional `loadingExpr?: string`, forwarded only to its Confirm button.

- [ ] **Step 1: Add `loadingExpr` to `ConfirmDialog.astro`**

In `app/src/components/ui/ConfirmDialog.astro`, find:

```ts
interface Props {
  title: string;
  titleId: string;
  description: string;
  cancelLabel?: string;
  confirmLabel?: string;
  onCancel: string;
  onConfirm: string;
  dismissible?: boolean;
  confirmVariant?: "primary" | "secondary" | "ghost";
  class?: string;
}

// Props
const {
  title,
  titleId,
  description,
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
  onCancel,
  onConfirm,
  dismissible = true,
  confirmVariant = "primary",
  class: classNameProp,
}: Props = Astro.props;
```

Replace with:

```ts
interface Props {
  title: string;
  titleId: string;
  description: string;
  cancelLabel?: string;
  confirmLabel?: string;
  onCancel: string;
  onConfirm: string;
  dismissible?: boolean;
  confirmVariant?: "primary" | "secondary" | "ghost";
  class?: string;
  /** Forwarded to the Confirm button's Button.astro loadingExpr prop. */
  loadingExpr?: string;
}

// Props
const {
  title,
  titleId,
  description,
  cancelLabel = "Cancel",
  confirmLabel = "Confirm",
  onCancel,
  onConfirm,
  dismissible = true,
  confirmVariant = "primary",
  class: classNameProp,
  loadingExpr,
}: Props = Astro.props;
```

Then find:

```astro
    <Button
      variant={confirmVariant}
      class="w-1/3"
      title={confirmLabel}
      x-on:click={onConfirm}
    />
```

Replace with:

```astro
    <Button
      variant={confirmVariant}
      class="w-1/3"
      title={confirmLabel}
      x-on:click={onConfirm}
      loadingExpr={loadingExpr}
    />
```

(The Cancel `Button` above it is untouched — cancelling is never in-flight, so it never needs a spinner.)

- [ ] **Step 2: Point `ExitModal.astro` at `$store.game.loading`**

In `app/src/components/layout/games/ExitModal.astro`, find:

```astro
<ConfirmDialog
  titleId="exit-modal-title"
  title="Leave game?"
  description="This session will be recorded as abandoned."
  cancelLabel="Cancel"
  confirmLabel="Leave"
  onCancel="showExitModal = false"
  onConfirm="$dispatch('confirm-exit')"
/>
```

Replace with:

```astro
<ConfirmDialog
  titleId="exit-modal-title"
  title="Leave game?"
  description="This session will be recorded as abandoned."
  cancelLabel="Cancel"
  confirmLabel="Leave"
  onCancel="showExitModal = false"
  onConfirm="$dispatch('confirm-exit')"
  loadingExpr="$store.game.loading"
/>
```

- [ ] **Step 3: Verify gates pass**

Run: `bash scripts/check-astro-class-composition.sh && bash scripts/check-astro-conventions.sh`
Expected: both `OK:`.

Run: `cd app && npm run check`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/ui/ConfirmDialog.astro app/src/components/layout/games/ExitModal.astro
git commit -m "fix: wire the exit-modal confirm button to \$store.game.loading"
```

---

### Task 6: Button misusage fixes (closes #49, fixes two consistency/accessibility gaps)

**Files:**
- Modify: `app/src/pages/games/score-training/play/index.astro`
- Modify: `app/src/components/ui/LogoutButton.astro`
- Modify: `app/src/layouts/GameLayout.astro`

**Interfaces:**
- Consumes: `Button.astro`'s existing `icon`/`ariaLabel` props (unchanged by this plan, already present before Task 4).

- [ ] **Step 1: Fix the blank Retry button (#49)**

In `app/src/pages/games/score-training/play/index.astro`, find:

```astro
        <Button
          type="button"
          class="mt-4"
          @click="retryReconciliation()"
        >
          Retry
        </Button>
```

Replace with:

```astro
        <Button
          type="button"
          class="mt-4"
          @click="retryReconciliation()"
          title="Retry"
        />
```

- [ ] **Step 2: Give `LogoutButton.astro` a correct accessible name**

In `app/src/components/ui/LogoutButton.astro`, find:

```astro
<Button
  type="button"
  variant="ghost"
  x-data="logoutButton()"
  @click="submit"
  :disabled="loading"
>
```

Replace with:

```astro
<Button
  type="button"
  variant="ghost"
  icon
  ariaLabel="Log out"
  x-data="logoutButton()"
  @click="submit"
  :disabled="loading"
>
```

- [ ] **Step 3: Replace `GameLayout.astro`'s raw exit button with `Button.astro`**

In `app/src/layouts/GameLayout.astro`, find:

```astro
      <button
        type="button"
        class="relative z-10 btn btn-ghost p-2"
        aria-label="Exit game"
        @click="showExitModal = true"
      >
        <ExitIcon class="size-6 text-muted" />
      </button>
```

Replace with:

```astro
      <Button
        type="button"
        variant="ghost"
        icon
        ariaLabel="Exit game"
        class="relative z-10"
        @click="showExitModal = true"
      >
        <ExitIcon
          class="size-6 text-muted"
          slot="iconBefore"
        />
      </Button>
```

Then find the import block at the top of the same file:

```astro
import BaseLayout from "@layouts/BaseLayout.astro";
import ExitModal from "@components/layout/games/ExitModal.astro";
import ExitIcon from "@icons/exit.svg";
```

Replace with:

```astro
import BaseLayout from "@layouts/BaseLayout.astro";
import ExitModal from "@components/layout/games/ExitModal.astro";
import Button from "@components/forms/Button.astro";
import ExitIcon from "@icons/exit.svg";
```

- [ ] **Step 4: Verify gates pass**

Run: `bash scripts/check-astro-class-composition.sh && bash scripts/check-astro-conventions.sh && bash scripts/check-file-locations.sh`
Expected: all three `OK:`.

Run: `cd app && npm run check`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add app/src/pages/games/score-training/play/index.astro app/src/components/ui/LogoutButton.astro app/src/layouts/GameLayout.astro
git commit -m "fix: close #49 blank Retry button, fix 2 Button.astro misusages"
```

---

### Task 7: Manual verification and full validation pass

**Files:** none — this task only runs the app and the full validation suite.

**Interfaces:** none — this is the plan's completion gate.

- [ ] **Step 1: Start the dev server**

Run: `cd app && astro dev --background`
Expected: server starts; confirm with `astro dev status`.

- [ ] **Step 2: Verify the #50 fixes**

- Navigate to `/games/score-training/setup`, select a preset, click "Let's play." Expected: the button shows a spinner (not a blank button) until the page navigates to `/games/score-training/play`.
- Start a session, then click the exit icon in the header and confirm "Leave." Expected: the "Leave" button in the confirm modal shows a spinner until the session is abandoned and the page navigates to `/games`.
- Log in and log out. Expected: unchanged from before this plan — both already showed spinners correctly.

- [ ] **Step 3: Verify the #49 / button-audit fixes**

- Trigger a failed session-reconciliation on the play page (e.g. by simulating a network failure during `fetchActiveSessions`/`completeSession`, or by inspecting the DOM directly if reproducing the failure live is impractical in this environment) and confirm the Retry button now shows visible "Retry" text instead of rendering blank.
- Inspect the logout button and the in-game exit button in devtools; confirm each renders `aria-label="Log out"` / `aria-label="Exit game"` respectively, and that both now use `Button.astro`'s `icon`-sized padding.

- [ ] **Step 4: Stop the dev server**

Run: `cd app && astro dev stop`

- [ ] **Step 5: Run the full validation suite**

Run: `cd app && npm test`
Expected: all tests pass (the pre-existing suite plus every new/updated test from Tasks 1-3).

Run: `cd app && npm run check`
Expected: 0 errors.

Run: `for s in ../scripts/check-*.sh; do bash "$s" || echo "FAILED: $s"; done` (from `app/`, or `for s in scripts/check-*.sh; do bash "$s" || echo "FAILED: $s"; done` from the repo root)
Expected: zero `FAILED:` lines across all 14 gate scripts.

- [ ] **Step 6: Report**

Confirm in the completion report: which manual checks were actually exercised in this environment (a full click-through requires a running browser; if devtools/browser access isn't available in this session, say so explicitly rather than claiming an unverified click was tested) and the full test/gate output.
