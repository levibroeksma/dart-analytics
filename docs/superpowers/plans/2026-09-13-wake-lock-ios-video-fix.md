# Fix iOS Standalone Video Fallback Implementation Plan

**Goal:** Replace the non-functional `canvas.captureStream()` fallback mechanism with an embedded silent MP4 (NoSleep.js's proven technique), per `docs/superpowers/specs/2026-09-13-wake-lock-ios-video-fix-design.md`.

**Architecture:** `app/src/modules/ui/wake-lock.module.ts` — swap `createFallbackVideo()`'s canvas/`captureStream` source for a `data:video/mp4;base64,...` string (reused from `richtr/NoSleep.js`, MIT), and swap the native `loop` attribute expectation for the `timeupdate`-based re-seek loop NoSleep.js uses for its mp4 asset. Standalone-mode gating, `acquire()`/`release()`/`destroy()`/`visibilitychange` wiring stay the same.

**Tech Stack:** TypeScript, Vitest (`@vitest-environment jsdom`).

## Global Constraints

- No `//`/`/* */` comments inside function bodies in `app/src/**/*.ts` (`app/CLAUDE.md`).
- Every changed runtime `.ts` file needs its covering test changed alongside it (`scripts/check-test-coverage.sh`).
- `modules/ui/` classes: no Alpine/`@stores`/`@client/api` import.

---

### Task 1: Swap the fallback video source

**Files:**
- Modify: `app/src/modules/ui/wake-lock.module.ts`
- Test: `app/tests/modules/ui/wake-lock.module.test.ts`

**Interfaces:** No change to `WakeLockController`'s public surface.

- [ ] **Step 1: Update the test's fallback stub**

In `stubVideoFallback()`, remove the `HTMLCanvasElement.prototype.captureStream` mock and `tracks`/`stream` setup entirely — keep only the `HTMLMediaElement.prototype.play` mock (unchanged logic: sets `paused` to `false`). Return `{ playSpy }`.

Update the two tests that assert on `captureStream`/`tracks`:
- "starts a video fallback when navigator.standalone is true": drop the `captureStream` expectation, keep `playSpy` and the `document.querySelector("video")` checks.
- "stops the video fallback and its tracks on release" → rename to "stops the video fallback on release"; replace `expect(tracks[0].stop).toHaveBeenCalled()` with asserting the video is paused (spy a `pause` method, or just assert `document.querySelector("video")` is null, which already proves teardown removed the element).
- "stops the video fallback on destroy": same swap as above.

Remove the `afterEach` cleanup line that deletes `HTMLCanvasElement.prototype.captureStream` (no longer patched).

- [ ] **Step 2: Run tests, confirm failures**

`cd app && npx vitest run tests/modules/ui/wake-lock.module.test.ts` — expect failures only in the tests touching the now-removed canvas mock / renamed assertions (the module still uses `captureStream`, so `stubVideoFallback` no longer stubbing it means `createFallbackVideo()` throws — expected red).

- [ ] **Step 3: Replace `createFallbackVideo()` and fallback lifecycle in the module**

In `app/src/modules/ui/wake-lock.module.ts`:
- Add a module-level constant with the embedded MP4 data URI (from NoSleep.js `src/media.js`, `mp4` export — copy verbatim).
- Rewrite `createFallbackVideo()`: no `<canvas>`; set `video.src = FALLBACK_VIDEO_SRC`; add a `timeupdate` listener that resets `video.currentTime` to a small random value once `video.currentTime > 0.5` (mirrors NoSleep.js's loop workaround for its mp4 asset — the native `loop` attribute is not used for this asset).
- `stopFallbackVideo()`: no `MediaStream`/track teardown — just `video.pause()` and `video.remove()`.
- Everything else (`isStandaloneDisplayMode`, `acquire`, `requestSentinel`, `startFallbackVideo` call site, `release`, `destroy`, `handleVisibilityChange`) is unchanged.

- [ ] **Step 4: Run tests, confirm pass**

`cd app && npx vitest run tests/modules/ui/wake-lock.module.test.ts` — all green.

- [ ] **Step 5: Commit**

```bash
git add app/src/modules/ui/wake-lock.module.ts app/tests/modules/ui/wake-lock.module.test.ts docs/superpowers/specs/2026-09-13-wake-lock-ios-video-fix-design.md docs/superpowers/plans/2026-09-13-wake-lock-ios-video-fix.md
git commit -m "fix: replace broken canvas captureStream fallback with embedded video"
```

---

### Task 2: Full validation + context maintenance

- [ ] **Step 1:** `cd app && npx fallow && npx vitest run && rm -rf .astro && npx astro check --minimumFailingSeverity hint` — 0 errors/warnings/hints, all tests pass. (`db:status`/`db:migrate`/`db:introspect` skipped — no Neon/DATABASE_URL in this sandbox; no schema touched.)
- [ ] **Step 2:** `npm run format:check` clean.
- [ ] **Step 3:** `run-all-gates` skill — all applicable `check-*.sh` scripts pass.
- [ ] **Step 4:** `context-maintenance` skill — confirm nothing stale (no new decision, no doc-location change, no shared component).
- [ ] **Step 5:** Push, open PR, subscribe to PR activity.
