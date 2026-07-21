# Score Training Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement automated session lifecycle, D88 reconciliation on both setup and play pages, results as a modal overlay with completion-sequence gating, and play-again flow with inline config.

**Architecture:** 
- Setup page fetches active sessions + presets on init, runs shared `reconcileActiveSession()` (auto-abandon mismatches synchronously, show modal only on `"match"`; block create on `"abandon_failed"`), creates session before navigating to play
- Play page runs identical reconciliation on init (no mismatch loop risk), handles gameplay, displays results as modal overlay on completion
- Completion sequence: mint `idempotencyKey` once, set `completionStatus = "saving"`, POST batch with that key, PATCH to COMPLETED, set `completionStatus = "succeeded"`; retry full sequence with same key, treat 409 as success
- Play-again creates new session with cloned inline config, stays on play page, resets turns but keeps `configSnapshot`; failures set `playAgainError` only, never touch `completionStatus`
- CI check prevents `fetchConnectionCache` regression

**Tech Stack:** Astro, Alpine.js, TypeScript, Vitest, existing session API client (`@client/api/sessions`: `createSession`, `appendBatch`, `completeSession`, `fetchActiveSessions`, `SessionApiError`)

## Global Constraints

- All session status changes use `PATCH`, never PUT or POST-to-status
- Completion buttons stay disabled until `completionStatus === "succeeded"` (both batch POST and PATCH COMPLETED have acked)
- `completionStatus` is set to `"pending"` in the same synchronous step as `finished = true` — never left implicitly derivable from other fields being falsy
- `idempotencyKey` minted once per finished game; never reminted; reuse on retry
- Play-again uses `{ source: "inline", config: {...} }` (already supported by API + validator); failures set `playAgainError`, a field distinct from `completionError`/`completionStatus`
- The shared reconciliation helper (`app/src/lib/game/session-recovery.ts`) is identical on setup and play (same decision table, same return-type literals: `"match" | "no_active" | "abandon_failed"`)
- `"abandon_failed"` blocks session creation and leaves the store untouched — never silently treated as `"no_active"`
- Active session modal is overlay, not conditional branch (prevents loop on re-render)
- Store persists to localStorage; Back clears via `store.reset()`
- All errors in setup keep user on setup (no navigation on failure)
- Results modal stays open if play-again fails; stats remain visible; buttons stay enabled (prior session `COMPLETED`) — driven by `playAgainError`, not `completionStatus`
- Reuse `app/src/lib/client/api/sessions.ts` as-is (`apiRequest`-based `appendBatch`/`completeSession`/`fetchActiveSessions`/`SessionApiError`); do not reintroduce raw `fetch` calls or a parallel error type

---

## File Structure

**Files to create:**
- `app/src/lib/game/session-recovery.ts` — Shared `reconcileActiveSession()` D88 helper (single implementation, used by both setup and play)
- `app/tests/lib/game/session-recovery.test.ts` — Shared helper unit tests (match / no_active / abandon_failed)

**Files to modify:**
- `.github/workflows/checks.yml` — Add CI check
- `app/src/lib/game/score-training-setup.data.ts` — Reconciliation via shared helper + modal state + methods
- `app/src/pages/games/score-training/setup/index.astro` — Add modal overlay, wire reconciliation init
- `app/src/lib/game/score-training-play.data.ts` — Reconciliation via shared helper + completion sequence + play-again + results modal
- `app/src/pages/games/score-training/play/index.astro` — Results modal overlay, remove results-page link
- `app/tests/lib/game/score-training-setup.data.test.ts` — Reconciliation tests, modal tests, create tests
- `app/tests/lib/game/score-training-play.data.test.ts` — Reconciliation tests, completion sequence tests, play-again tests, modal tests

**Files not touched:**
- `app/src/lib/client/api/sessions.ts` — Already has `apiRequest`-based `appendBatch`, `completeSession` (PATCH), `fetchActiveSessions`, `createSession`, `SessionApiError`. No new methods or raw-`fetch` rewrite needed.

**Files to delete or disable:**
- `app/src/pages/games/score-training/results/index.astro` — (Delete after play page fully migrated; users redirected via play page)

---

## Task Breakdown

### Task 1: CI Check for deprecated `fetchConnectionCache`

**Files:**
- Modify: `.github/workflows/checks.yml:70-80` (approx location; adjust to actual structure)

**Interfaces:**
- Consumes: Existing `.github/workflows/checks.yml` structure
- Produces: New CI step that fails if `fetchConnectionCache` found in `app/src/`

- [ ] **Step 1: Read the current checks.yml to find where to insert the step**

Run: `cat .github/workflows/checks.yml | head -100`

- [ ] **Step 2: Add the fetchConnectionCache check step**

Add this step to the checks workflow (after the existing linting steps, before or alongside `npm test`):

```yaml
      - name: Check for deprecated neonConfig.fetchConnectionCache
        run: |
          if grep -r "fetchConnectionCache" app/src --include="*.ts" --include="*.js"; then
            echo "❌ Error: fetchConnectionCache is deprecated and must not be used"
            exit 1
          fi
```

- [ ] **Step 3: Verify syntax by viewing the modified section**

Run: `grep -A 5 "Check for deprecated" .github/workflows/checks.yml`

Expected: Your new step appears with correct indentation

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/checks.yml
git commit -m "ci: add regression check for deprecated neonConfig.fetchConnectionCache"
```

---

### Task 2: Shared Session Recovery Helper (`session-recovery.ts`)

**Files:**
- Create: `app/src/lib/game/session-recovery.ts`
- Create: `app/tests/lib/game/session-recovery.test.ts`

**Interfaces:**
- Consumes: `completeSession()` from `@client/api/sessions` (existing, PATCH-based, exported from `app/src/lib/client/api/sessions.ts`)
- Produces: single exported `reconcileActiveSession()`, used unmodified by both setup and play (Tasks 3 and 4) — this is the **only** place the decision table is implemented

This is created first, standalone, so setup and play can never diverge on the return shape (the original draft of this plan had setup and play define two different helpers with two different return types — this task removes that risk by building the shared module before either caller).

- [ ] **Step 1: Write failing tests for the helper**

Create `app/tests/lib/game/session-recovery.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reconcileActiveSession } from '@lib/game/session-recovery';
import * as api from '@client/api/sessions';

vi.mock('@client/api/sessions');

describe('reconcileActiveSession', () => {
  let store: any;

  beforeEach(() => {
    store = { reset: vi.fn() };
  });

  it('returns "match" and does not touch the store when local sessionId matches server ACTIVE', async () => {
    const server = [{ sessionId: 'match-id', gameTypeKey: 'SCORE_TRAINING' }];

    const result = await reconcileActiveSession('match-id', server as any, store);

    expect(result).toEqual({ action: 'match', activeSession: server[0] });
    expect(store.reset).not.toHaveBeenCalled();
  });

  it('auto-abandons the orphan and returns "no_active" on mismatch', async () => {
    const server = [{ sessionId: 'server-id', gameTypeKey: 'SCORE_TRAINING' }];
    vi.mocked(api.completeSession).mockResolvedValue({
      sessionId: 'server-id',
      statusKey: 'ABANDONED',
      completedAt: '2026-07-17T10:00:00Z',
    });

    const result = await reconcileActiveSession('different-local-id', server as any, store);

    expect(api.completeSession).toHaveBeenCalledWith('server-id', 'ABANDONED');
    expect(store.reset).toHaveBeenCalled();
    expect(result).toEqual({ action: 'no_active', activeSession: null });
  });

  it('returns "abandon_failed" and does NOT reset the store when the auto-abandon PATCH fails', async () => {
    const server = [{ sessionId: 'server-id', gameTypeKey: 'SCORE_TRAINING' }];
    vi.mocked(api.completeSession).mockRejectedValue(new Error('Network error'));

    const result = await reconcileActiveSession('different-local-id', server as any, store);

    expect(store.reset).not.toHaveBeenCalled();
    expect(result).toEqual({ action: 'abandon_failed', activeSession: null });
  });

  it('resets and returns "no_active" when local is present but no server ACTIVE exists', async () => {
    const result = await reconcileActiveSession('stale-id', [], store);

    expect(store.reset).toHaveBeenCalled();
    expect(result).toEqual({ action: 'no_active', activeSession: null });
  });

  it('returns "no_active" with no store change when both are empty', async () => {
    const result = await reconcileActiveSession(null, [], store);

    expect(store.reset).not.toHaveBeenCalled();
    expect(result).toEqual({ action: 'no_active', activeSession: null });
  });
});
```

Run: `npm test app/tests/lib/game/session-recovery.test.ts`
Expected: **FAIL** — module doesn't exist yet

- [ ] **Step 2: Implement the helper**

Create `app/src/lib/game/session-recovery.ts`:

```typescript
import { completeSession, type SessionActiveData } from "@client/api/sessions";

interface StoreLike {
  reset(): void;
}

/**
 * Shared D88 reconciliation decision table (identical on setup and play).
 * The only implementation — setup and play both import this directly.
 *
 * "match": server ACTIVE session's sessionId equals local; caller resumes
 *   (setup: Continue/Abandon modal; play: keep store, hasActiveSession = true).
 *   Store is left untouched.
 * "no_active": no server ACTIVE session, or a mismatch that was successfully
 *   auto-abandoned. Store has already been reset by this function.
 * "abandon_failed": mismatch found but the auto-abandon PATCH failed. Store is
 *   NOT touched. Caller must block session creation and offer retry — never
 *   treat this the same as "no_active".
 */
export async function reconcileActiveSession(
  localSessionId: string | null,
  serverSessions: SessionActiveData[],
  store: StoreLike,
): Promise<{ action: "match" | "no_active" | "abandon_failed"; activeSession: SessionActiveData | null }> {
  const scoreTrainingActive = serverSessions.find((s) => s.gameTypeKey === "SCORE_TRAINING");

  // Case 1: Match — resume path, store untouched
  if (localSessionId && scoreTrainingActive && scoreTrainingActive.sessionId === localSessionId) {
    return { action: "match", activeSession: scoreTrainingActive };
  }

  // Case 2: Mismatch — auto-PATCH orphan to ABANDONED synchronously
  if (scoreTrainingActive && (!localSessionId || scoreTrainingActive.sessionId !== localSessionId)) {
    try {
      await completeSession(scoreTrainingActive.sessionId, "ABANDONED");
    } catch {
      // Abandon failed: do NOT reset the store or report "no_active" — the
      // orphan is still ACTIVE server-side, so creating a session now would
      // violate uq_sessions_single_active. Caller must block and retry.
      return { action: "abandon_failed", activeSession: null };
    }
    store.reset();
    return { action: "no_active", activeSession: null };
  }

  // Case 3: Local present, no server ACTIVE — local is stale, nothing to abandon
  if (localSessionId && !scoreTrainingActive) {
    store.reset();
    return { action: "no_active", activeSession: null };
  }

  // Case 4: Both empty
  return { action: "no_active", activeSession: null };
}
```

Run: `npm test app/tests/lib/game/session-recovery.test.ts`
Expected: **PASS**

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/game/session-recovery.ts app/tests/lib/game/session-recovery.test.ts
git commit -m "feat(game): add shared session-recovery D88 reconciliation helper"
```

---

### Task 3: Wire Setup Page to Session Recovery + Modal Overlay

**Files:**
- Modify: `app/src/lib/game/score-training-setup.data.ts:1-75`
- Modify: `app/src/pages/games/score-training/setup/index.astro`
- Test: `app/tests/lib/game/score-training-setup.data.test.ts`

**Interfaces:**
- Consumes: `reconcileActiveSession()` from `@lib/game/session-recovery` (Task 2), `fetchActiveSessions()`, `fetchConfigurationPresets()`, `createSession()` from `@client/api/sessions`
- Produces:
  - `scoreTrainingSetup()` context with new fields: `activeSession`, `showActiveSessionModal`, `loadingReconciliation`, `reconciliationFailed`
  - New method: `continueSession(): void` — closes modal, navigates to play
  - New method: `abandonSession(): Promise<void>` — PATCH session to ABANDONED, clear store, show preset picker
  - New method: `retryReconciliation(): Promise<void>` — re-runs reconciliation after an `"abandon_failed"` result
  - Updated `init()`: calls `fetchConfigurationPresets()` + `fetchActiveSessions()` in parallel, then `reconcileActiveSession()`

- [ ] **Step 1: Write failing tests**

Create `app/tests/lib/game/score-training-setup.data.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scoreTrainingSetup } from '@lib/game/score-training-setup.data';
import * as api from '@client/api/sessions';

vi.mock('@client/api/sessions');

describe('scoreTrainingSetup', () => {
  let store: any;

  beforeEach(() => {
    store = {
      game: {
        sessionId: null,
        reset: vi.fn(),
        startSession: vi.fn(),
      },
    };
  });

  describe('reconciliation on init', () => {
    it('shows modal on "match"', async () => {
      const setup = scoreTrainingSetup();
      setup.$store = store;

      vi.mocked(api.fetchConfigurationPresets).mockResolvedValue([]);
      vi.mocked(api.fetchActiveSessions).mockResolvedValue([
        { sessionId: 'match-id', gameTypeKey: 'SCORE_TRAINING' } as any,
      ]);
      store.game.sessionId = 'match-id';

      await setup.init?.();

      expect(setup.showActiveSessionModal).toBe(true);
      expect(setup.activeSession).toEqual({ sessionId: 'match-id', gameTypeKey: 'SCORE_TRAINING' });
    });

    it('shows preset picker on "no_active" (mismatch auto-abandoned)', async () => {
      const setup = scoreTrainingSetup();
      setup.$store = store;

      vi.mocked(api.fetchConfigurationPresets).mockResolvedValue([]);
      vi.mocked(api.fetchActiveSessions).mockResolvedValue([
        { sessionId: 'server-id', gameTypeKey: 'SCORE_TRAINING' } as any,
      ]);
      vi.mocked(api.completeSession).mockResolvedValue({
        sessionId: 'server-id', statusKey: 'ABANDONED', completedAt: '2026-07-17T10:00:00Z',
      });
      store.game.sessionId = 'different-local-id';

      await setup.init?.();

      expect(setup.showActiveSessionModal).toBe(false);
      expect(setup.reconciliationFailed).toBe(false);
    });

    it('blocks the picker and sets reconciliationFailed on "abandon_failed" — does not show picker as if clear', async () => {
      const setup = scoreTrainingSetup();
      setup.$store = store;

      vi.mocked(api.fetchConfigurationPresets).mockResolvedValue([]);
      vi.mocked(api.fetchActiveSessions).mockResolvedValue([
        { sessionId: 'server-id', gameTypeKey: 'SCORE_TRAINING' } as any,
      ]);
      vi.mocked(api.completeSession).mockRejectedValue(new Error('Network error'));
      store.game.sessionId = 'different-local-id';

      await setup.init?.();

      expect(setup.reconciliationFailed).toBe(true);
      expect(setup.showActiveSessionModal).toBe(false);
      expect(store.game.reset).not.toHaveBeenCalled();
    });
  });

  describe('continueSession / abandonSession', () => {
    it('continues matched session', async () => {
      const setup = scoreTrainingSetup();
      setup.$store = store;
      setup.activeSession = { sessionId: 'match-id', gameTypeKey: 'SCORE_TRAINING' } as any;

      vi.spyOn(globalThis.location, 'href', 'get').mockReturnValue('/games/score-training/setup');
      const hrefSpy = vi.spyOn(globalThis.location, 'href', 'set');

      setup.continueSession?.();

      expect(hrefSpy).toHaveBeenCalledWith('/games/score-training/play');
    });

    it('abandons session when user clicks Abandon', async () => {
      const setup = scoreTrainingSetup();
      setup.$store = store;
      setup.activeSession = { sessionId: 'match-id', gameTypeKey: 'SCORE_TRAINING' } as any;

      vi.mocked(api.completeSession).mockResolvedValue({
        sessionId: 'match-id', statusKey: 'ABANDONED', completedAt: '2026-07-17T10:00:00Z',
      });

      await setup.abandonSession?.();

      expect(api.completeSession).toHaveBeenCalledWith('match-id', 'ABANDONED');
      expect(store.game.reset).toHaveBeenCalled();
      expect(setup.showActiveSessionModal).toBe(false);
    });
  });

  describe('session creation', () => {
    it('creates session with template config before navigating', async () => {
      const setup = scoreTrainingSetup();
      setup.$store = store;
      setup.selectedTemplateId = 'template-1';
      setup.presets = [
        {
          configurationTemplateId: 'template-1',
          name: 'Standard',
          configuration: { duration_type: 'ROUNDS', duration_value: 20, max_darts_per_turn: 3 },
        } as any,
      ];

      const mockSession = {
        sessionId: 'new-session-id',
        participants: [{ ref: 'participant-1', displayName: 'Player', participantTypeKey: 'PLAYER' }],
      };

      vi.mocked(api.createSession).mockResolvedValue(mockSession as any);

      const hrefSpy = vi.spyOn(globalThis.location, 'href', 'set');

      await setup.start?.();

      expect(api.createSession).toHaveBeenCalledWith({
        gameTypeKey: 'SCORE_TRAINING',
        rulesetVersionKey: 'SCORE_TRAINING_V1',
        captureModeKey: 'RECREATIONAL',
        inputModeKey: 'QUICK_SCORE',
        config: { source: 'template', templateRef: 'template-1' },
      });
      expect(store.game.startSession).toHaveBeenCalled();
      expect(hrefSpy).toHaveBeenCalledWith('/games/score-training/play');
    });
  });
});
```

Run: `npm test app/tests/lib/game/score-training-setup.data.test.ts`
Expected: **FAIL** — methods don't exist yet

- [ ] **Step 2: Implement setup data factory using the shared helper**

Replace `app/src/lib/game/score-training-setup.data.ts`:

```typescript
import { fetchConfigurationPresets, type ConfigurationPresetData } from "@client/api/configuration-templates";
import { createSession, fetchActiveSessions, completeSession, type SessionActiveData } from "@client/api/sessions";
import { reconcileActiveSession } from "@lib/game/session-recovery";
import type { ScoreTrainingSetupContext } from "./types";

const GAME_TYPE_KEY = "SCORE_TRAINING";
const RULESET_VERSION_KEY = "SCORE_TRAINING_V1";

export function scoreTrainingSetup() {
  return {
    presets: [] as ConfigurationPresetData[],
    selectedTemplateId: "",
    loading: false,
    error: "",
    activeSession: null as SessionActiveData | null,
    showActiveSessionModal: false,
    loadingReconciliation: false,
    reconciliationFailed: false,

    async init(this: ScoreTrainingSetupContext) {
      this.loadingReconciliation = true;
      try {
        const [presets, activeSessions] = await Promise.all([
          fetchConfigurationPresets(GAME_TYPE_KEY),
          fetchActiveSessions(),
        ]);

        this.presets = presets;
        this.selectedTemplateId = presets[0]?.configurationTemplateId ?? "";

        await this.reconcile(activeSessions);
      } catch {
        // Preset/active-session fetch itself failed — degrade to picker per
        // spec's "Setup Page Errors" (fetch failures show toast + picker as
        // fallback; this is distinct from an abandon_failed reconciliation).
        this.showActiveSessionModal = false;
      } finally {
        this.loadingReconciliation = false;
      }
    },

    async reconcile(this: ScoreTrainingSetupContext, activeSessions: SessionActiveData[]) {
      const result = await reconcileActiveSession(this.$store.game.sessionId, activeSessions, this.$store.game);

      if (result.action === "match") {
        this.activeSession = result.activeSession;
        this.showActiveSessionModal = true;
        this.reconciliationFailed = false;
      } else if (result.action === "abandon_failed") {
        // Block: do not show the picker, do not allow session creation.
        this.showActiveSessionModal = false;
        this.reconciliationFailed = true;
      } else {
        this.showActiveSessionModal = false;
        this.reconciliationFailed = false;
      }
    },

    async retryReconciliation(this: ScoreTrainingSetupContext) {
      this.loadingReconciliation = true;
      try {
        const activeSessions = await fetchActiveSessions();
        await this.reconcile(activeSessions);
      } finally {
        this.loadingReconciliation = false;
      }
    },

    continueSession(this: ScoreTrainingSetupContext) {
      this.showActiveSessionModal = false;
      globalThis.location.href = "/games/score-training/play";
    },

    async abandonSession(this: ScoreTrainingSetupContext) {
      if (!this.activeSession) return;
      try {
        await completeSession(this.activeSession.sessionId, "ABANDONED");
        this.$store.game.reset();
        this.showActiveSessionModal = false;
        this.activeSession = null;
      } catch {
        this.error = "Could not abandon session. Try again.";
      }
    },

    async start(this: ScoreTrainingSetupContext) {
      const preset = this.presets.find((p) => p.configurationTemplateId === this.selectedTemplateId);
      if (!preset) {
        this.error = "Select a preset first.";
        return;
      }
      this.loading = true;
      try {
        const session = await createSession({
          gameTypeKey: GAME_TYPE_KEY,
          rulesetVersionKey: RULESET_VERSION_KEY,
          captureModeKey: "RECREATIONAL",
          inputModeKey: "QUICK_SCORE",
          config: { source: "template", templateRef: preset.configurationTemplateId },
        });
        const config = preset.configuration as {
          duration_type: "ROUNDS" | "MINUTES";
          duration_value: number;
          max_darts_per_turn: number;
        };
        this.$store.game.startSession({
          gameTypeKey: GAME_TYPE_KEY,
          sessionId: session.sessionId,
          participantRef: session.participants[0].ref,
          configSnapshot: {
            durationType: config.duration_type,
            durationValue: config.duration_value,
            maxDartsPerTurn: config.max_darts_per_turn,
          },
        });
        globalThis.location.href = "/games/score-training/play";
      } catch {
        this.error = "Could not start the session. Try again.";
      } finally {
        this.loading = false;
      }
    },
  };
}
```

Run: `npm test app/tests/lib/game/score-training-setup.data.test.ts`
Expected: **PASS**

- [ ] **Step 3: Update the setup page Astro component**

Replace `app/src/pages/games/score-training/setup/index.astro`:

```astro
---
export const prerender = true;
import AppLayout from "@layouts/AppLayout.astro";
import Button from "@components/forms/Button.astro";
---

<AppLayout title="Score Training — Setup">
  <div class="p-4" x-data="scoreTrainingSetup()">
    <!-- Active Session Modal Overlay (match case only) -->
    <template x-if="showActiveSessionModal && activeSession">
      <div class="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
        <div class="bg-bg rounded-lg shadow-lg p-6 max-w-sm">
          <h2 class="text-lg font-semibold text-fg">Active Session</h2>
          <p class="text-sm text-fg-muted mt-2">
            You have an active Score Training session. Continue playing or start a new one?
          </p>
          <div class="flex gap-3 mt-6">
            <Button type="button" variant="secondary" @click="abandonSession()" :disabled="loading">
              Start New
            </Button>
            <Button type="button" @click="continueSession()" :disabled="loading">
              Continue
            </Button>
          </div>
          <p class="text-sm text-red-500 mt-3" x-show="error" x-text="error"></p>
        </div>
      </div>
    </template>

    <!-- Reconciliation blocked: auto-abandon PATCH failed — do NOT show the picker.
         Guarded on !loadingReconciliation so this doesn't render alongside the
         loading block below during a retryReconciliation() call. -->
    <template x-if="reconciliationFailed && !loadingReconciliation">
      <div class="text-center py-8">
        <p class="text-sm text-red-500">Could not clean up a previous session. Retry to continue.</p>
        <Button type="button" class="mt-4" @click="retryReconciliation()">
          Retry
        </Button>
      </div>
    </template>

    <!-- Preset Picker (shown only when reconciliation is clear and not blocked) -->
    <template x-if="!showActiveSessionModal && !reconciliationFailed && !loadingReconciliation">
      <div>
        <h1 class="text-xl font-semibold text-fg">Score Training</h1>
        <p class="text-sm text-fg-muted">Pick a preset, then start.</p>

        <div class="mt-4 flex flex-col gap-2">
          <template x-for="preset in presets" :key="preset.configurationTemplateId">
            <label class="flex items-center gap-2">
              <input
                type="radio"
                name="preset"
                :value="preset.configurationTemplateId"
                x-model="selectedTemplateId"
              />
              <span x-text="preset.name"></span>
            </label>
          </template>
        </div>

        <p class="mt-2 text-sm text-red-500" x-show="error" x-text="error"></p>

        <div class="mt-4">
          <Button type="button" :disabled="loading" @click="start()">Start</Button>
        </div>
      </div>
    </template>

    <!-- Loading state during reconciliation -->
    <template x-if="loadingReconciliation">
      <div class="text-center py-8">
        <p class="text-sm text-fg-muted">Loading...</p>
      </div>
    </template>
  </div>
</AppLayout>
```

- [ ] **Step 4: Verify the page renders correctly**

Run the dev server and navigate to `/games/score-training/setup`:

```bash
astro dev
# Navigate to http://localhost:4321/games/score-training/setup
```

Expected: Modal appears only on a matched active session; preset picker appears when clear; a simulated abandon-PATCH failure shows the blocked/retry state, never the picker.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/game/score-training-setup.data.ts app/src/pages/games/score-training/setup/index.astro app/tests/lib/game/score-training-setup.data.test.ts
git commit -m "feat(setup): wire session-recovery reconciliation and active session modal"
```

---

### Task 4: Wire Play Page to Session Recovery

**Files:**
- Modify: `app/src/lib/game/score-training-play.data.ts` (`init()` method)
- Test: `app/tests/lib/game/score-training-play.data.test.ts`

**Interfaces:**
- Consumes: `reconcileActiveSession()` from `@lib/game/session-recovery` (same import as Task 3 — no second implementation)
- Produces:
  - Updated `init()`: on `"match"`, resume silently and continue existing engine/timer setup (no modal — see spec note on why the return literal is `"match"`, not `"show_modal"`); on `"no_active"`, `hasActiveSession = false`; on `"abandon_failed"`, stay in a blocked/loading state and expose `reconciliationFailed` + `retryReconciliation()`, mirroring Task 3's setup behavior
  - New fields: `loadingReconciliation`, `reconciliationFailed`

- [ ] **Step 1: Write failing tests**

Add to `app/tests/lib/game/score-training-play.data.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { scoreTrainingPlay } from '@lib/game/score-training-play.data';
import * as api from '@client/api/sessions';

vi.mock('@client/api/sessions');

describe('scoreTrainingPlay', () => {
  let store: any;

  beforeEach(() => {
    store = {
      game: {
        sessionId: null,
        configSnapshot: null,
        turns: [],
        timerRemainingMs: null,
        timerExpired: false,
        reset: vi.fn(),
      },
    };
  });

  describe('reconciliation on init', () => {
    it('resumes silently on "match" — no modal, hasActiveSession = true', async () => {
      const play = scoreTrainingPlay();
      play.$store = store;

      store.game.sessionId = 'match-id';
      store.game.configSnapshot = { durationType: 'ROUNDS', durationValue: 20, maxDartsPerTurn: 3 };

      vi.mocked(api.fetchActiveSessions).mockResolvedValue([
        { sessionId: 'match-id', gameTypeKey: 'SCORE_TRAINING' } as any,
      ]);

      await play.init?.();

      expect(play.hasActiveSession).toBe(true);
      expect(store.game.reset).not.toHaveBeenCalled();
    });

    it('shows no-active-session view on "no_active" (mismatch auto-abandoned)', async () => {
      const play = scoreTrainingPlay();
      play.$store = store;

      store.game.sessionId = 'different-id';

      vi.mocked(api.fetchActiveSessions).mockResolvedValue([
        { sessionId: 'server-id', gameTypeKey: 'SCORE_TRAINING' } as any,
      ]);
      vi.mocked(api.completeSession).mockResolvedValue({
        sessionId: 'server-id', statusKey: 'ABANDONED', completedAt: '2026-07-17T10:00:00Z',
      });

      await play.init?.();

      expect(api.completeSession).toHaveBeenCalledWith('server-id', 'ABANDONED');
      expect(store.game.reset).toHaveBeenCalled();
      expect(play.hasActiveSession).toBe(false);
    });

    it('blocks with reconciliationFailed on "abandon_failed" — does not flip to no-active-session as if cleaned', async () => {
      const play = scoreTrainingPlay();
      play.$store = store;

      store.game.sessionId = 'different-id';

      vi.mocked(api.fetchActiveSessions).mockResolvedValue([
        { sessionId: 'server-id', gameTypeKey: 'SCORE_TRAINING' } as any,
      ]);
      vi.mocked(api.completeSession).mockRejectedValue(new Error('Network error'));

      await play.init?.();

      expect(play.reconciliationFailed).toBe(true);
      expect(store.game.reset).not.toHaveBeenCalled();
    });

    it('preserves turns array on resume (no clear)', async () => {
      const play = scoreTrainingPlay();
      play.$store = store;

      store.game.sessionId = 'match-id';
      store.game.configSnapshot = { durationType: 'ROUNDS', durationValue: 20, maxDartsPerTurn: 3 };
      store.game.turns = [{ totalScore: 50, completedAt: '2026-07-17T10:00:00Z' }];

      vi.mocked(api.fetchActiveSessions).mockResolvedValue([
        { sessionId: 'match-id', gameTypeKey: 'SCORE_TRAINING' } as any,
      ]);

      await play.init?.();

      expect(play.hasActiveSession).toBe(true);
      expect(store.game.turns.length).toBe(1);
    });
  });
});
```

Run: `npm test app/tests/lib/game/score-training-play.data.test.ts`
Expected: **FAIL**

- [ ] **Step 2: Update play `init()` to use the shared helper**

In `app/src/lib/game/score-training-play.data.ts`, add the import and replace the existing reconciliation block at the top of `init()` (the current ad hoc match/orphan check — see current file) with a call to the shared helper, keeping the rest of the engine/timer setup that already exists:

```typescript
import { fetchActiveSessions } from "@client/api/sessions";
import { reconcileActiveSession } from "@lib/game/session-recovery";

// Inside scoreTrainingPlay(), add fields:
loadingReconciliation: false,
reconciliationFailed: false,

async init(this: ScoreTrainingPlayContext) {
  this.loadingReconciliation = true;
  const activeSessions = await fetchActiveSessions();
  const result = await reconcileActiveSession(this.$store.game.sessionId, activeSessions, this.$store.game);
  this.loadingReconciliation = false;

  if (result.action === "abandon_failed") {
    // Block: stay on loading/error, do not flip to "no active session" as if cleaned.
    this.reconciliationFailed = true;
    this.hasActiveSession = false;
    return;
  }
  this.reconciliationFailed = false;

  if (result.action === "no_active") {
    this.hasActiveSession = false;
    return;
  }

  // result.action === "match": resume silently, no modal on play.
  const config = this.$store.game.configSnapshot;
  if (!config) {
    this.hasActiveSession = false;
    return;
  }
  // ... existing engine + timer setup from current init() continues unchanged here
  // (ScoreTrainingEngine construction with startingSequence = turns.length,
  // MINUTES timer resume logic) — not reproduced here since it is untouched.

  this.hasActiveSession = true;
},

async retryReconciliation(this: ScoreTrainingPlayContext) {
  await this.init();
},
```

The existing `.astro` "no active session" view (`x-if="!finished && !hasActiveSession"`) needs one addition in Task 5's template pass: gate it on `!reconciliationFailed` too, and add a blocked/retry state, mirroring Task 3's setup UI.

- [ ] **Step 3: Run tests**

Run: `npm test app/tests/lib/game/score-training-play.data.test.ts`
Expected: **PASS**

- [ ] **Step 4: Commit**

```bash
git add app/src/lib/game/score-training-play.data.ts app/tests/lib/game/score-training-play.data.test.ts
git commit -m "feat(play): wire session-recovery reconciliation into play init"
```

---

### Task 5: Results Modal & Completion Sequence (Batch + PATCH)

**Files:**
- Modify: `app/src/lib/game/score-training-play.data.ts` (`submitVisit`, completion sequence, `back`, `playAgain`)
- Modify: `app/src/pages/games/score-training/play/index.astro` (results modal, blocked-reconciliation state)
- Test: `app/tests/lib/game/score-training-play.data.test.ts` (completion sequence tests)

**Interfaces:**
- Consumes: `ScoreTrainingEngine.recordVisit()`, `buildEventsBatch()`, existing `appendBatch`/`completeSession`/`createSession` from `@client/api/sessions` (no changes to that file — see Global Constraints)
- Produces:
  - New context fields: `completionStatus: "pending" | "saving" | "succeeded" | "failed"`, `completionError`, `playAgainError`, `resultsSnapshot`
  - `submitVisit()` sets `finished = true` **and** `completionStatus = "pending"` in the same step as completion, then immediately invokes the completion sequence — no separate `retryCompletion()` wrapper with different wiring
  - New method: `uploadAndCompleteSession(): Promise<void>` — runs batch POST + PATCH sequence, idempotency-key minting, drives `completionStatus`
  - `playAgain()` failures set `playAgainError` only — never touches `completionStatus`/`completionError`
  - Results modal reads `$store.game.turns` while saving, `resultsSnapshot` once `completionStatus === "succeeded"`
  - Removes the old query-param `/results` navigation (`buildResultsUrl` / `globalThis.location.href = resultsUrl`) — results now render in-page

This replaces the **existing** `retryCompletion()` in the current `score-training-play.data.ts`, which navigates to `/games/score-training/results?...` and calls `store.reset()` immediately after upload — that whole path is superseded by this task, not layered on top of it.

- [ ] **Step 1: Write failing tests for completion sequence**

Add to `app/tests/lib/game/score-training-play.data.test.ts`:

```typescript
describe('Completion sequence', () => {
  function makeStore(overrides: Partial<Record<string, unknown>> = {}) {
    return {
      game: {
        sessionId: 'session-1',
        participantRef: 'participant-1',
        configSnapshot: { durationType: 'ROUNDS', durationValue: 20, maxDartsPerTurn: 3 },
        turns: [{ totalScore: 50, completedAt: '2026-07-17T10:00:00Z' }],
        idempotencyKey: null,
        reset: vi.fn(),
        ...overrides,
      },
    };
  }

  it('sets completionStatus = "pending" synchronously when finished flips true, before the async sequence resolves', async () => {
    const play = scoreTrainingPlay();
    play.$store = makeStore();

    let sawPendingBeforeResolve = false;
    vi.mocked(api.appendBatch).mockImplementation(async () => {
      sawPendingBeforeResolve = play.completionStatus === 'saving' || play.completionStatus === 'pending';
      return { created: { stages: 1, turns: 1, darts: 3 } };
    });
    vi.mocked(api.completeSession).mockResolvedValue({
      sessionId: 'session-1', statusKey: 'COMPLETED', completedAt: '2026-07-17T10:00:00Z',
    });

    const promise = play.uploadAndCompleteSession();
    // Immediately after invocation (before await settles), status must already be non-idle.
    expect(play.completionStatus === 'pending' || play.completionStatus === 'saving').toBe(true);
    await promise;

    expect(sawPendingBeforeResolve).toBe(true);
    expect(play.completionStatus).toBe('succeeded');
  });

  it('mints idempotencyKey once and reuses on retry', async () => {
    const play = scoreTrainingPlay();
    play.$store = makeStore();

    vi.mocked(api.appendBatch).mockResolvedValue({ created: { stages: 1, turns: 1, darts: 3 } });
    vi.mocked(api.completeSession).mockResolvedValue({
      sessionId: 'session-1', statusKey: 'COMPLETED', completedAt: '2026-07-17T10:00:00Z',
    });

    await play.uploadAndCompleteSession();

    const firstKey = play.$store.game.idempotencyKey;
    expect(firstKey).toBeTruthy();
    expect(play.completionStatus).toBe('succeeded');
    expect(play.completionError).toBe('');

    vi.mocked(api.appendBatch).mockClear();
    await play.uploadAndCompleteSession();

    expect(play.$store.game.idempotencyKey).toBe(firstKey);
  });

  it('copies stats into resultsSnapshot on success and does not depend on turns surviving afterward', async () => {
    const play = scoreTrainingPlay();
    play.$store = makeStore();

    vi.mocked(api.appendBatch).mockResolvedValue({ created: { stages: 1, turns: 1, darts: 3 } });
    vi.mocked(api.completeSession).mockResolvedValue({
      sessionId: 'session-1', statusKey: 'COMPLETED', completedAt: '2026-07-17T10:00:00Z',
    });

    await play.uploadAndCompleteSession();

    expect(play.resultsSnapshot).toEqual({ total: 50, visits: 1, average: 50 });
  });

  it('treats SESSION_ALREADY_COMPLETED as success on the completion path', async () => {
    const play = scoreTrainingPlay();
    play.$store = makeStore();

    const error = new Error('SESSION_ALREADY_COMPLETED');
    (error as any).code = 'SESSION_ALREADY_COMPLETED';
    vi.mocked(api.completeSession).mockRejectedValue(error);
    vi.mocked(api.appendBatch).mockResolvedValue({ created: { stages: 1, turns: 1, darts: 3 } });

    await play.uploadAndCompleteSession();

    expect(play.completionError).toBe('');
    expect(play.completionStatus).toBe('succeeded');
  });

  it('sets completionStatus = "failed" and keeps buttons disabled on error', async () => {
    const play = scoreTrainingPlay();
    play.$store = makeStore();

    vi.mocked(api.appendBatch).mockRejectedValue(new Error('Network error'));

    await play.uploadAndCompleteSession();

    expect(play.completionError).toContain('connection');
    expect(play.completionStatus).toBe('failed');
  });

  it('playAgain failure sets playAgainError only, leaves completionStatus untouched', async () => {
    const play = scoreTrainingPlay();
    play.$store = makeStore();
    play.completionStatus = 'succeeded';

    vi.mocked(api.createSession).mockRejectedValue(new Error('Network error'));

    await play.playAgain();

    expect(play.playAgainError).toBeTruthy();
    expect(play.completionStatus).toBe('succeeded');
    expect(play.$store.game.turns.length).toBe(1); // store unchanged until create succeeds
  });
});
```

Run: `npm test app/tests/lib/game/score-training-play.data.test.ts`
Expected: **FAIL** — methods/fields don't exist yet

- [ ] **Step 2: Replace the completion sequence in the play data factory**

In `app/src/lib/game/score-training-play.data.ts`, remove `buildResultsUrl()` and the existing `retryCompletion()` (the query-param-navigation version) entirely. Replace `submitVisit()`'s completion branch and add the new methods:

```typescript
function computeStats(turns: RecordedTurn[]): { total: number; visits: number; average: number } {
  const visits = turns.length;
  const total = turns.reduce((sum, t) => sum + t.totalScore, 0);
  return { total, visits, average: visits === 0 ? 0 : total / visits };
}

// Inside scoreTrainingPlay(), fields:
completionStatus: "pending" as "pending" | "saving" | "succeeded" | "failed",
completionError: "",
playAgainError: "",
resultsSnapshot: null as { total: number; visits: number; average: number } | null,

// submitVisit(), completion branch (replaces the old `await this.retryCompletion()` call):
async submitVisit(this: ScoreTrainingPlayContext) {
  // ...existing score validation and this.engine.recordVisit(...) / this.$store.game.recordTurn(visit) unchanged...

  const timerExpired = this.$store.game.timerExpired ?? false;
  if (!this.engine!.isComplete(this.$store.game.turns.length, timerExpired)) return;

  // Modal appears and completion sequence starts in the same synchronous step.
  this.finished = true;
  this.completionStatus = "pending";
  await this.uploadAndCompleteSession();
},

async uploadAndCompleteSession(this: ScoreTrainingPlayContext): Promise<void> {
  const sessionId = this.$store.game.sessionId!;

  if (!this.$store.game.idempotencyKey) {
    this.$store.game.idempotencyKey = crypto.randomUUID();
  }
  const idempotencyKey = this.$store.game.idempotencyKey;

  this.completionStatus = "saving";
  this.completionError = "";

  try {
    const completedTurns = this.$store.game.turns.map((turn) => ({
      ...turn,
      completedAt: turn.completedAt ?? new Date().toISOString(),
    }));
    const batch = buildEventsBatch(this.$store.game.participantRef!, completedTurns);

    await appendBatch(sessionId, idempotencyKey, batch);
    await completeSession(sessionId, "COMPLETED");
  } catch (err: any) {
    // On the completion path only: SESSION_ALREADY_COMPLETED counts as success
    // (covers "PATCH OK, client never saw the response").
    const alreadyCompleted =
      err.code === "SESSION_ALREADY_COMPLETED" || err.message?.includes("SESSION_ALREADY_COMPLETED");
    if (!alreadyCompleted) {
      this.completionError = "Could not save your game. Check your connection and retry.";
      this.completionStatus = "failed";
      return;
    }
  }

  // Snapshot stats into a component-local field BEFORE any store mutation,
  // so the modal never depends on $store.game.turns surviving a later reset.
  this.resultsSnapshot = computeStats(this.$store.game.turns);
  this.completionStatus = "succeeded";
},
```

Retry from the modal calls `uploadAndCompleteSession()` directly (same `idempotencyKey`, same payload) — there is no separate `retryCompletion()` wrapper to keep in sync.

- [ ] **Step 3: Update play page component with results modal + blocked-reconciliation state**

Replace gameplay sections in `app/src/pages/games/score-training/play/index.astro`:

```astro
---
export const prerender = true;
import AppLayout from "@layouts/AppLayout.astro";
import Button from "@components/forms/Button.astro";
import Input from "@components/forms/Input.astro";
---

<AppLayout title="Score Training — Play">
  <div class="p-4" x-data="scoreTrainingPlay()">
    <!-- Reconciliation blocked: auto-abandon PATCH failed (Task 4).
         Guarded on !loadingReconciliation so this doesn't render alongside the
         loading block below during a retryReconciliation() call. -->
    <template x-if="reconciliationFailed && !loadingReconciliation">
      <div class="text-center py-8">
        <p class="text-sm text-red-500">Could not clean up a previous session. Retry to continue.</p>
        <Button type="button" class="mt-4" @click="retryReconciliation()">
          Retry
        </Button>
      </div>
    </template>

    <!-- Loading state during reconciliation (was missing in the initial draft
         of this task — without it, the page renders blank while
         fetchActiveSessions()/reconcileActiveSession() are in flight, since
         hasActiveSession/finished/reconciliationFailed all start false). -->
    <template x-if="loadingReconciliation">
      <div class="text-center py-8">
        <p class="text-sm text-fg-muted">Loading...</p>
      </div>
    </template>

    <!-- No active session view -->
    <template x-if="!finished && !hasActiveSession && !reconciliationFailed && !loadingReconciliation">
      <div>
        <p class="text-fg">No active session — start a new one.</p>
        <a class="btn-primary mt-4 inline-block" href="/games/score-training/setup">Start a new session</a>
      </div>
    </template>

    <!-- Gameplay view (existing, with live total) -->
    <template x-if="!finished && hasActiveSession">
      <form @submit.prevent="submitVisit()">
        <template x-if="$store.game.configSnapshot?.durationType === 'MINUTES'">
          <p class="text-sm text-fg-muted" x-text="`Time remaining: ${remainingLabel()}`"></p>
        </template>
        <template x-if="$store.game.configSnapshot?.durationType === 'ROUNDS'">
          <p class="text-sm text-fg-muted" x-text="`Visit ${$store.game.turns.length + 1}`"></p>
        </template>
        <Input label="Visit score (0-180)" name="visitScore" inputmode="numeric" pattern="[0-9]*" x-model="visitInput" />
        <p class="mt-2 text-sm text-red-500" x-show="error" x-text="error"></p>
        <Button type="submit" class="mt-4">Submit visit</Button>
      </form>

      <!-- Live total (always visible during play) -->
      <p class="mt-4 text-fg" x-show="$store.game.turns.length > 0" x-text="`Total: ${$store.game.turns.reduce((sum, t) => sum + t.totalScore, 0)}`"></p>
    </template>

    <!-- Results modal (overlay) -->
    <template x-if="finished">
      <div class="fixed inset-0 flex items-center justify-center bg-black/50 z-50">
        <div class="bg-bg rounded-lg shadow-lg p-6 max-w-sm">
          <h2 class="text-lg font-semibold text-fg">Game Summary</h2>

          <!-- Stats: live from store while saving, snapshot once succeeded -->
          <div class="mt-4 space-y-2 text-sm text-fg-muted" x-show="completionStatus !== 'succeeded'">
            <p><span class="font-semibold text-fg" x-text="`Total: ${$store.game.turns.reduce((sum, t) => sum + t.totalScore, 0)}`"></span></p>
            <p><span class="font-semibold text-fg" x-text="`Visits: ${$store.game.turns.length}`"></span></p>
            <p><span class="font-semibold text-fg" x-text="`Average: ${$store.game.turns.length > 0 ? ($store.game.turns.reduce((sum, t) => sum + t.totalScore, 0) / $store.game.turns.length).toFixed(1) : 0}`"></span></p>
          </div>
          <div class="mt-4 space-y-2 text-sm text-fg-muted" x-show="completionStatus === 'succeeded' && resultsSnapshot">
            <p><span class="font-semibold text-fg" x-text="`Total: ${resultsSnapshot?.total}`"></span></p>
            <p><span class="font-semibold text-fg" x-text="`Visits: ${resultsSnapshot?.visits}`"></span></p>
            <p><span class="font-semibold text-fg" x-text="`Average: ${resultsSnapshot?.average.toFixed(1)}`"></span></p>
          </div>

          <!-- Completion status -->
          <div class="mt-4">
            <template x-if="completionStatus === 'pending' || completionStatus === 'saving'">
              <p class="text-sm text-fg-muted">Saving...</p>
            </template>
            <template x-if="completionStatus === 'failed'">
              <p class="text-sm text-red-500" x-text="completionError"></p>
              <Button type="button" class="mt-2" @click="uploadAndCompleteSession()">Retry</Button>
            </template>
            <template x-if="completionStatus === 'succeeded'">
              <p class="text-sm text-green-500">Saved!</p>
            </template>
          </div>

          <!-- Play-again failure: separate from completion status, buttons stay enabled -->
          <p class="mt-2 text-sm text-red-500" x-show="playAgainError" x-text="playAgainError"></p>

          <!-- Action buttons: enabled only when completionStatus === 'succeeded' -->
          <div class="flex gap-3 mt-6">
            <Button type="button" variant="secondary" @click="back()" :disabled="completionStatus !== 'succeeded'">
              Back
            </Button>
            <Button type="button" @click="playAgain()" :disabled="completionStatus !== 'succeeded'">
              Play again?
            </Button>
          </div>
        </div>
      </div>
    </template>
  </div>
</AppLayout>
```

- [ ] **Step 4: Implement Back and Play Again button handlers**

Add to `scoreTrainingPlay()` return object:

```typescript
async back(this: ScoreTrainingPlayContext) {
  this.$store.game.reset();
  globalThis.location.href = "/games";
},

async playAgain(this: ScoreTrainingPlayContext) {
  if (!this.$store.game.configSnapshot) return;
  this.playAgainError = "";

  const config = this.$store.game.configSnapshot;
  const inlineConfig = {
    duration_type: config.durationType,
    duration_value: config.durationValue,
    max_darts_per_turn: config.maxDartsPerTurn,
  };

  let session;
  try {
    session = await createSession({
      gameTypeKey: "SCORE_TRAINING",
      rulesetVersionKey: "SCORE_TRAINING_V1",
      captureModeKey: "RECREATIONAL",
      inputModeKey: "QUICK_SCORE",
      config: { source: "inline", config: inlineConfig },
    });
  } catch {
    // Play-again failure: modal stays open, results visible, buttons stay
    // enabled (prior session is already COMPLETED). Store untouched.
    this.playAgainError = "Could not start a new session. Try again.";
    return;
  }

  // Only mutate store/UI on success.
  this.$store.game.sessionId = session.sessionId;
  this.$store.game.participantRef = session.participants[0].ref;
  this.$store.game.turns = [];
  this.$store.game.idempotencyKey = null;
  this.$store.game.timerRemainingMs = null;
  this.$store.game.timerStartedAt = null;
  this.$store.game.timerExpired = false;

  this.finished = false;
  this.completionStatus = "pending";
  this.completionError = "";
  this.resultsSnapshot = null;
  this.visitInput = "";
  this.error = "";

  this.engine = new ScoreTrainingEngine({
    durationType: config.durationType,
    durationValue: config.durationValue,
    maxDartsPerTurn: config.maxDartsPerTurn,
    startingSequence: 0,
  });

  if (config.durationType === "MINUTES") {
    this.$store.game.timerRemainingMs = config.durationValue * 60000;
    this.$store.game.timerStartedAt = new Date().toISOString();
    this.timer = new SegmentTimer({
      totalMinutes: config.durationValue,
      intervalMinutes: config.durationValue,
      onTick: (secondsRemaining) => {
        this.$store.game.timerRemainingMs = secondsRemaining * 1000;
      },
      onComplete: () => {
        this.$store.game.timerExpired = true;
      },
    });
    this.timer.start();
  }
},
```

- [ ] **Step 5: Run tests**

Run: `npm test`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add app/src/lib/game/score-training-play.data.ts app/src/pages/games/score-training/play/index.astro app/tests/lib/game/score-training-play.data.test.ts
git commit -m "feat(play): add results modal with completionStatus-gated completion sequence"
```

---

### Task 6: Test Suite Updates & Full Validation

**Files:**
- Modify: `app/tests/lib/game/score-training-setup.data.test.ts` (complete reconciliation + create tests)
- Modify: `app/tests/lib/game/score-training-play.data.test.ts` (complete reconciliation + completion + play-again tests)
- `app/tests/lib/game/session-recovery.test.ts` already covers the shared helper (Task 2); `app/src/lib/client/api/sessions.ts` is untouched (Global Constraints), so no new client tests are needed there

**Interfaces:**
- Consumes: All previous task implementations
- Produces: Passing test suite with coverage for shared reconciliation, modal, completion sequence, play-again

- [ ] **Step 1: Ensure all test files have complete coverage**

Run: `npm test`

Expected: All tests pass

- [ ] **Step 2: Run full app validation**

Run: `npm run validate:app`

Expected: All checks pass:
- DB status
- DB migrations
- DB introspection
- Fallow linting
- Tests
- Astro check
- Graph refresh

- [ ] **Step 3: Commit test updates**

```bash
git add app/tests/
git commit -m "test: complete coverage for D88, results modal, completion sequence"
```

---

### Task 7: Final Manual Testing & Results Page Cleanup

**Files:**
- Delete: `app/src/pages/games/score-training/results/index.astro` (or disable via redirect)

**Interfaces:**
- Consumes: Completed play page with results modal
- Produces: No broken links; results page gone or redirected

- [ ] **Step 1: Manual test the full flow**

1. Navigate to `/games/score-training/setup`
2. Test: No active session → preset picker shown
3. Click "Play" → session created, navigate to play
4. Verify: Play page shows "Visit 1", timer (if minutes), input field
5. Enter scores, complete game
6. Verify: Results modal appears with stats
7. Test: Retry if "Saving..." hangs
8. Once saved: "Back" and "Play again?" enabled
9. Click "Play again?" → new session, results modal closes, fresh game state
10. Play a few turns, verify `$store.game.turns` grew
11. Close browser, reopen → verify mid-game resume
12. Test: Active session modal on setup (create a session, don't play, return to setup)
13. Verify: Continue / Abandon options shown
14. Simulate an auto-abandon `PATCH` failure (e.g. block the request via devtools) on setup with a mismatched local session: verify the blocked/retry state shows, **not** the preset picker; verify no session can be created until Retry succeeds; repeat on play, verifying the blocked state shows without a loading/blocked double-render flash
15. Complete a game, let the completion ACK land, then refresh the browser before clicking Back: verify the app does not re-`PATCH` abandon the now-`COMPLETED` session (per spec's "Browser closed after completion ACK" edge case)

- [ ] **Step 2: Disable or delete results page**

Delete the dedicated results page:

```bash
rm app/src/pages/games/score-training/results/index.astro
```

Verify no links point to it:

```bash
grep -r "score-training/results" app/src --include="*.astro" --include="*.ts"
```

Expected: No results

- [ ] **Step 3: Commit cleanup**

```bash
git add --all
git commit -m "chore(play): remove dedicated results page (now modal on play page)"
```

---

### Task 8: Documentation & Context Maintenance (Mandatory Gate)

**Files:**
- Modify: `DECISIONS.md` (new decision entries)
- Modify: `docs/architecture/07-Frontend/03-Alpine-Patterns.md` (Recovery + Completed-Batch Outbox sections)
- Modify: `docs/architecture/07-Frontend/00-Overview.md` (completion/recovery paragraphs)
- Modify: `docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md` (§Recovery)
- Modify: `docs/architecture/05-Database/06-Spec/05-Read-Model-Layer.md` (`v_active_sessions` blurb, line ~56)
- Modify: `app/CLAUDE.md` (only if a rule beyond what the docs above cover changed — see Step 1)
- Verify: Script output from context/file-location/mirror checks
- Stage: `graphify-out/graph.json` (auto-generated; commit after refresh)

**Interfaces:**
- Consumes: All previous task implementations, completed spec + plan docs
- Produces: Updated frontend/database docs, decision ledger, validated project metadata, graph rebuild

**Context:** Per root `CLAUDE.md` Context Maintenance protocol, every completed task must validate and update documentation. This is a non-negotiable gate — no PR merge until this passes. The spec's "Documentation & rule enforcement" table names five artifacts as **required**, not optional: `DECISIONS.md`, `03-Alpine-Patterns.md`, `00-Overview.md`, `10-Frontend-Agent-Guide.md`, and `05-Read-Model-Layer.md`. All five must be edited in this task — this is broader than "update app/CLAUDE.md if needed."

- [ ] **Step 1: Update the four required frontend/database docs**

`docs/architecture/05-Database/06-Spec/05-Read-Model-Layer.md` (around line 56) currently reads: *"Used by application startup to detect an orphaned active session and offer resume (from client-local state) or abandon; the view itself does not reconstruct gameplay state."* This is stale — D88 mismatches are never offered to the user, they're auto-abandoned. Replace with: resume when local `sessionId` matches server `ACTIVE`; otherwise auto-abandon synchronously, no prompt.

`docs/architecture/07-Frontend/03-Alpine-Patterns.md`: add/update the Recovery section with the shared `session-recovery.ts` decision table (`"match"` / `"no_active"` / `"abandon_failed"`) — match shows the Continue/Abandon modal on setup only, mismatch never shows a dialog on either page. Update the Completed-Batch Outbox section to note Score Training uses a synchronous hard-gate instead of outbox enqueue for v1 play completion (see D119).

`docs/architecture/07-Frontend/00-Overview.md`: align the completion/recovery paragraphs with the hard-gate + match-vs-mismatch distinction; remove any implication that Score Training always navigates to a `/results` page — it doesn't anymore (Task 7).

`docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md` §Recovery: state the hard-gate exception and "no manual abandon UI on mismatch" (the match-case Continue/Abandon modal is still allowed).

- [ ] **Step 2: Check if `app/CLAUDE.md` needs anything beyond the above**

The four docs in Step 1 are the canonical homes for this logic per `docs/CLAUDE.md`'s task routing (Frontend → `07-Frontend/*`, Database model → `05-Database/*`). Only add to `app/CLAUDE.md` if something doesn't fit those docs — e.g., a one-line pointer to `app/src/lib/game/session-recovery.ts` as the single implementation, if not already discoverable via the Alpine Patterns doc. Do not duplicate the full decision table in `app/CLAUDE.md`; that recreates the two-sources-of-truth problem this plan is fixing.

- [ ] **Step 3: Record decisions in `DECISIONS.md`**

Add entries (next available IDs; confirm against the current end of `DECISIONS.md` before writing — do not assume D117 is still the latest):

```markdown
### D118: Shared Session Recovery Helper for Setup & Play (2026-07-17)

Setup and play run identical decision table (`app/src/lib/game/session-recovery.ts`, no page-specific variants) to reconcile local `sessionId` vs. server's active SCORE_TRAINING session. Returns "match" | "no_active" | "abandon_failed" — the latter blocks session creation instead of silently resetting, since the orphan is still ACTIVE server-side and a create would violate uq_sessions_single_active. Eliminates UX loop risk where setup might re-render and show the modal twice.

### D119: Score Training Hard-Gate Completion Sequence (2026-07-17)

Results modal gates Back / Play again buttons until both batch POST and PATCH COMPLETED succeed (completionStatus === "succeeded"; treats 409 SESSION_ALREADY_COMPLETED as success). Amends D90's passive-outbox pattern for Score Training to ensure terminal session state is reached before a new session can be created, preventing concurrent active sessions. Supersedes D112's results-via-query-params / dedicated `/results` page for this flow — results now render as a play-page modal from a component-local snapshot instead.
```

- [ ] **Step 4: Context Map — no new row needed**

`docs/architecture/00-Context-Map.md` already has a generic historical-folder row covering `docs/superpowers/{specs,plans,handoffs}/` — both this spec and this plan are already covered by it. Do **not** add a dedicated per-plan line; confirm the existing row is still present and move on. (If the row is missing or has been removed, that's a separate pre-existing gap — flag it rather than silently adding a one-off entry that only covers this plan.)

- [ ] **Step 5: Run context validation scripts**

Run each script in sequence and verify all pass:

```bash
bash scripts/check-context-map.sh
```
Expected: No errors; all docs in map are findable

```bash
bash scripts/check-file-locations.sh
```
Expected: No errors; all `.ts` files in app/ respect folder structure rules

```bash
bash scripts/check-agent-mirrors.sh
```
Expected: No errors; `CLAUDE.md` and `AGENT.md` files in same directory are byte-identical

If any script fails, fix the issue in-place (update the map, move files, sync mirrors). Re-run until all pass.

- [ ] **Step 6: Refresh knowledge graph**

Run the graph rebuild script:

```bash
bash scripts/refresh-graph.sh
```

Expected: Graph updates without warnings (if graphify CLI is not installed, note that in the completion report but do not fail)

- [ ] **Step 7: Stage docs and graph; commit**

```bash
git add DECISIONS.md \
  docs/architecture/07-Frontend/03-Alpine-Patterns.md \
  docs/architecture/07-Frontend/00-Overview.md \
  docs/architecture/07-Frontend/10-Frontend-Agent-Guide.md \
  docs/architecture/05-Database/06-Spec/05-Read-Model-Layer.md \
  app/CLAUDE.md \
  graphify-out/graph.json
git commit -m "docs: update recovery/completion docs and record D118/D119 decisions"
```

Expected: Commit succeeds; graph snapshot is fresh. (`app/CLAUDE.md` is only included if Step 2 made a change.)

- [ ] **Step 8: Verify all context gates pass**

Run the full validation one more time:

```bash
npm run validate:app
```

Expected: All checks pass (db, migrate, introspect, fallow, tests, astro check, graph refresh)

If any step fails during validation, fix the root cause (do not skip). Context validation is non-negotiable.

- [ ] **Step 9: Completion Report**

Summarize:
- ✅ `03-Alpine-Patterns.md`, `00-Overview.md`, `10-Frontend-Agent-Guide.md`, `05-Read-Model-Layer.md` updated
- ✅ `app/CLAUDE.md` updated (or: no changes needed beyond the four docs above)
- ✅ `DECISIONS.md` entries added: D118, D119 (D119 notes supersession of D112)
- ✅ `00-Context-Map.md` — confirmed existing historical-folder row already covers this spec/plan; no new row added
- ✅ All 3 context scripts pass
- ✅ Graph refreshed and staged
- ✅ `npm run validate:app` passes all checks

---

## Self-Review

**Spec Coverage:**

✅ Issue 1: CI check for `fetchConnectionCache` (Task 1)  
✅ Shared session-recovery helper, single implementation (Task 2)  
✅ Issue 2 Phase 1: Setup reconciliation + active session modal (Task 3)  
✅ Issue 2 Phase 2: Play reconciliation (Task 4)  
✅ Issue 2 Phase 2: Results modal with completion sequence (Task 5)  
✅ Issue 2 Phase 2: Play-again flow (Task 5)  
✅ Tests for all new behavior (Task 6)  
✅ Manual testing coverage (Task 7)  
✅ **Context Maintenance gate** — required docs, decisions, context map check, script validation (Task 8)  

**No Placeholders:** All steps have concrete code, exact commands, expected outputs. No "TBD" or "implement validation" without detail.

**Type Consistency:**
- `idempotencyKey: string | null` in store (minted once, reused)
- `completionStatus: "pending" | "saving" | "succeeded" | "failed"` is the single source of truth for button-enable state; `completionError` and `playAgainError` are separate fields so a play-again failure can never trigger the completion-retry UI
- `reconcileActiveSession()` — one implementation (`app/src/lib/game/session-recovery.ts`), imported unmodified by both setup (Task 3) and play (Task 4); return type `"match" | "no_active" | "abandon_failed"` cannot drift because there is only one definition
- API methods (`appendBatch`, `completeSession`, `fetchActiveSessions`, `createSession`) are the existing `apiRequest`-based ones in `app/src/lib/client/api/sessions.ts` — unmodified, not redefined

**Traceability:**
- Each success criterion from spec has at least one task
- Edge cases (partial failure, SESSION_ALREADY_COMPLETED, play-again failure, abandon-PATCH failure) addressed in tests
- Auto-abandon synchronous with clear loading state; `abandon_failed` blocks create rather than silently resetting (Tasks 2-4)
- Store never mutates until operations succeed (play-again, back)
- `finished = true` and `completionStatus = "pending"` set synchronously together (Task 5) — no window where buttons read as enabled before the upload starts
- **Context Maintenance mandatory** — Task 8 validates root CLAUDE.md protocol (five required doc updates, decision ledger with D112 supersession noted, context map already covered by the historical row, script checks, graph refresh)

---

## Execution

Plan complete and saved to `docs/superpowers/plans/2026-07-17-score-training-flow-implementation.md`.

**Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
