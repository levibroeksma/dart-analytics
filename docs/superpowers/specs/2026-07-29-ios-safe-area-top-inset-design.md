# iOS Standalone Web App Top Safe-Area Fix — Design Spec

> **Date:** 2026-07-29
> **Status:** approved (brainstorming consensus)
> **Scope:** top safe-area inset only, single `global.css` edit.
> **Prerequisite:** `apple-mobile-web-app-status-bar-style: black-translucent` + `viewport-fit=cover` (D173).

---

## Problem

Saved to iOS Home Screen, the app draws content edge-to-edge under the translucent status bar (clock/battery/signal icons) — nothing pads for `env(safe-area-inset-top)` anywhere in the codebase. `html`/`body` already use `h-dvh max-h-dvh overflow-hidden` (`global.css:94,108`) — `dvh` sizing was never the bug; the missing safe-area inset is.

## Fix

One line on the `body` rule in `app/src/styles/global.css`:

```css
body {
  @apply relative h-dvh max-h-dvh overflow-hidden bg-surface font-sans text-foreground antialiased;
  padding-top: env(safe-area-inset-top);
}
```

- Tailwind preflight sets `border-box`, so the padding shrinks body's content box inside the existing `h-dvh` bound — no overflow, no `calc()`.
- `body::before`/`::after` (ambient gradient backdrop) stay `position: fixed; inset: 0` — the backdrop still bleeds edge-to-edge under the translucent status bar; only real content (AppLayout/GameLayout's flex wrapper, header, bottom nav) shifts down by the inset.
- `env()` resolves to `0` on unsupported browsers — no-op, no fallback branch needed.

## Scope

Top inset only (matches the reported bug). Bottom safe-area (home-indicator gesture bar) is not addressed — out of scope, not reported broken.

## File Plan

| Path | Change |
| ---- | ------ |
| `app/src/styles/global.css` | Add `padding-top: env(safe-area-inset-top);` to the `body` rule |
| `docs/architecture/07-Frontend/07-Style-Guide.md` | Note the safe-area inset next to the existing `h-dvh`/`overflow-hidden` mobile-first-shell bullet |
| `DECISIONS.md` | D174 |
| `docs/architecture/00-Context-Map.md` | Register this spec |

## Testing

CSS-only, no unit-testable logic — consistent with the existing "no visual regression harness" reality (`.astro` variant logic is likewise untested per D101). Verification is manual on a real iOS device.

## Verification Plan

| # | Check | Expected |
| --- | ----- | -------- |
| 1 | `npm run validate:app` | Pass |
| 2 | Desktop browser | No visible change (`env()` inactive without a notch/Dynamic Island) |
| 3 | iOS: installed Home Screen app, any page with a header (e.g. a game screen) | Header/title no longer collides with clock/battery/signal icons |
| 4 | iOS Safari tab (not installed) | No regression — `black-translucent` only applies in standalone display |

**Not covered by the automated suite** (no iOS device available): actual rendered overlap fix. Must be manually verified on a real iOS device before closing the issue, called out explicitly rather than assumed from `validate:app` passing.

## Anti-Patterns (explicit)

| Do not | Reason |
| ------ | ------ |
| Add safe-area padding to `body::before`/`::after` | Ambient backdrop must stay full-bleed behind the translucent status bar — only real content insets |
| Duplicate the padding rule per layout (`AppLayout.astro`, `GameLayout.astro`) | `body` is the single point that already owns `h-dvh`/`overflow-hidden`; adding it there covers every page including bare `BaseLayout` consumers (e.g. `/login`) |
| Add a bottom safe-area inset in this change | Not reported broken; scope creep beyond the fix in hand |

## Next Step

After spec approval: invoke **writing-plans** skill to produce implementation plan.
