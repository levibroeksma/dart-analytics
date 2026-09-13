<!--
status: historical
scope: implementation plan
read-when: never (executed)
updated: 2026-09-13
-->

# Plan: Self-Healing Wake Lock, Native-Only

Spec: `docs/superpowers/specs/2026-09-13-wake-lock-self-healing-design.md`.
Branch: `claude/ios-wpa-wake-lock-6gzp1b`.

## Task 1 — Rewrite `WakeLockController`

Files: `app/src/modules/ui/wake-lock.module.ts`,
`app/tests/modules/ui/wake-lock.module.test.ts`.

Drop `FALLBACK_VIDEO_SRC`, `createFallbackVideo`, `isStandaloneDisplayMode`
and the one-shot gesture gate. Add `WakeLockStatus`/`WakeLockEvent`, the
idempotent `ensureHeld()`, the six re-entry points, the watchdog
(`watchdogIntervalMs`, default 15000, `0` disables it in tests) and deduped
`emit()`. Rewrite the test file against the new contract.

## Task 2 — Surface status on the device

Files: `app/src/lib/ui/game-layout.data.ts`,
`app/src/layouts/GameLayout.astro`,
`app/tests/lib/ui/game-layout.data.test.ts`.

`gameLayoutData()` gains `wakeLockDebug` (from `?wakelock=debug`, persisted
in `sessionStorage`, cleared by `?wakelock=off`) and `wakeLockLog` (last 8
formatted events, fed by the controller's `onEvent`). `GameLayout.astro`
renders them in a `<template x-if="wakeLockDebug">` fixed overlay — `x-if`,
not `x-show`, so no `x-cloak` is required.

## Task 3 — Context maintenance

D274 in `decisions/frontend/architecture.md`; version entry in
`docs/architecture/00-Context-Map-History.md`; `npm run validate:app` and
the gate scripts.

## Verification bar

Unit tests are the ceiling here — no iOS device or BrowserStack access in
this session, and a wake lock has no observable effect in jsdom or a desktop
browser. On-device confirmation is the `?wakelock=debug` overlay, which the
user runs; the task is not "fixed" until that overlay reads `held` on the
device through a full match.
