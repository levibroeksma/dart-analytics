# Gesture-Gated Wake Lock Acquisition Implementation Plan

**Goal:** Defer wake-lock acquisition (native request + fallback video) to the first user gesture, since iOS Safari requires transient activation for both, per `docs/superpowers/specs/2026-09-13-wake-lock-gesture-gate-design.md`.

**Architecture:** `app/src/modules/ui/wake-lock.module.ts` — `acquire()` arms one-time listeners for `pointerdown`/`keydown` on `document` instead of acquiring immediately; the first to fire removes all and performs the existing native-request + standalone-fallback logic unchanged. `release()`/`destroy()` also clear pending listeners.

**Tech Stack:** TypeScript, Vitest (`@vitest-environment jsdom`).

## Global Constraints

- No `//`/`/* */` comments inside function bodies in `app/src/**/*.ts`.
- Every changed runtime `.ts` file needs its covering test changed alongside it.
- No new dependency (`nosleep.js` rejected — see spec).

---

### Task 1: Gate acquisition on first gesture

**Files:**
- Modify: `app/src/modules/ui/wake-lock.module.ts`
- Test: `app/tests/modules/ui/wake-lock.module.test.ts`

**Interfaces:** No change to `WakeLockController`'s public surface.

- [ ] **Step 1: Update the test file**

For every existing test that calls `await controller.acquire()` and then asserts the native request or fallback ran, insert `document.dispatchEvent(new Event("pointerdown"))` immediately after `acquire()` and before those assertions (`acquire()` itself no longer performs the work synchronously — it just arms the listeners). `acquire()` remains `async` (still returns a promise) but resolves once listeners are armed, not once the sentinel is requested.

Add new tests:
- "does not request the sentinel before a gesture": call `acquire()`, assert `request` not called.
- "requests the sentinel and starts the fallback on the first gesture": `acquire()`, dispatch `pointerdown`, assert both fire (mirrors updated existing tests — may fold into them instead of duplicating).
- "ignores a second gesture after the first": `acquire()`, dispatch `pointerdown` twice, assert `request` called exactly once.
- "cancels the pending gesture listeners on release": `acquire()`, `release()`, dispatch `pointerdown`, assert `request` never called.
- "cancels the pending gesture listeners on destroy": `acquire()`, `destroy()`, dispatch `pointerdown`, assert `request` never called.

The `visibilitychange` re-acquire tests are unaffected in shape but now need a gesture dispatched after the initial `acquire()` to get into the "held with a sentinel" state before exercising the visibilitychange path.

- [ ] **Step 2: Run tests, confirm expected failures**

`cd app && npx vitest run tests/modules/ui/wake-lock.module.test.ts` — the updated/new gesture-related tests fail against the current (immediate-acquire) implementation.

- [ ] **Step 3: Implement gesture gating**

In `app/src/modules/ui/wake-lock.module.ts`:
- Add `const GESTURE_EVENTS = ["pointerdown", "keydown"] as const;`.
- Add a bound `handleFirstGesture` method: removes the listeners for all `GESTURE_EVENTS`, then runs the existing acquisition body (`void this.requestSentinel(); if (isStandaloneDisplayMode()) this.startFallbackVideo();`) guarded by `if (!this.held) return;` (in case `release()`/`destroy()` already cleared `held` but a listener removal raced — defensive, matches existing `held` guard style).
- `acquire()`: sets `held = true`, then adds `handleFirstGesture` as a listener for each of `GESTURE_EVENTS` on `document`. No longer calls `requestSentinel`/`startFallbackVideo` directly, and no longer needs to be `async` internally beyond satisfying its existing `Promise<void>` return type (keep `async` for signature compatibility; the body just resolves after arming listeners).
- `release()`: before existing body, remove the `GESTURE_EVENTS` listeners (safe no-op if already fired/removed).
- `destroy()`: same listener removal alongside the existing `visibilitychange` listener removal.

- [ ] **Step 4: Run tests, confirm pass**

`cd app && npx vitest run tests/modules/ui/wake-lock.module.test.ts` — all green.

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/ui/wake-lock.module.ts app/tests/modules/ui/wake-lock.module.test.ts docs/superpowers/specs/2026-09-13-wake-lock-gesture-gate-design.md docs/superpowers/plans/2026-09-13-wake-lock-gesture-gate.md
git commit -m "fix: gate wake lock acquisition on first user gesture"
```

---

### Task 2: Full validation + context maintenance

- [ ] **Step 1:** `cd app && npx fallow && npx vitest run && rm -rf .astro && npx astro check --minimumFailingSeverity hint` — 0 errors/warnings/hints, all tests pass. (`db:status`/`db:migrate`/`db:introspect` skipped — no Neon/DATABASE_URL in this sandbox.)
- [ ] **Step 2:** `npm run format:check` clean.
- [ ] **Step 3:** `run-all-gates` skill — all applicable `check-*.sh` scripts pass.
- [ ] **Step 4:** `context-maintenance` skill.
- [ ] **Step 5:** Push, open PR, subscribe to PR activity.
