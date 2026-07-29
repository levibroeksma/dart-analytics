# iOS Safe-Area Top Inset — Pre-Merge Verification Checklist

> **Date:** 2026-07-29
> **Related:** D174, `docs/superpowers/specs/2026-07-29-ios-safe-area-top-inset-design.md`
> **Why this exists:** no iOS device is available in this environment; the fix cannot be visually confirmed by the automated suite (`npm run validate:app` only proves the CSS doesn't break the build).

## Manual checks required before closing the issue

1. Install the app to an iOS Home Screen ("Add to Home Screen") on a real device with a notch/Dynamic Island.
2. Launch the installed (standalone) app and open any screen with a header (e.g. a game's play screen via `GameLayout.astro`).
3. Confirm the header/title no longer renders under the clock/battery/signal icons.
4. Open the same app in a normal Safari tab (not installed) and confirm no regression — `black-translucent` only applies in standalone display mode, so this should be visually identical to before.
