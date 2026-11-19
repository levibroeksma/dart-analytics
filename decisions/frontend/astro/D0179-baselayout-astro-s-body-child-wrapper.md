---
id: D0179
status: accepted
date: 2026-08-01
origin: contemporaneous
original-date:
tags: [frontend/astro, safe-area]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `BaseLayout.astro`'s body-child wrapper div uses `h-full max-h-full` (was `h-dvh

## Context and Problem Statement
D174's `padding-top: env(safe-area-inset-top)` on `body` shrinks `body`'s border-box content area, but this nested div re-asserted its own full `100dvh` height regardless, overflowing `body`'s clipped bottom edge by exactly the top inset — invisible in a Safari tab (inset resolves 0 outside standalone display) but clipping `BottomNav` off-screen on an installed iOS Home Screen app, where the inset is non-zero
The iOS safe-area spec (D174) adds `padding-top: env(safe-area-inset-top)` to `body`. Because Tailwind preflight sets `border-box`, the padding shrinks body's content box inside the existing `h-dvh` bound. The inset resolves to 0 in a Safari tab, so the clipping shows only in an installed Home Screen app.

## Decision Drivers
* `BottomNav` must stay on screen in the installed iOS Home Screen app.
* `AppLayout` and `GameLayout` already use `h-full` for their own wrappers.

## Considered Options
* `h-full max-h-full` on the wrapper (chosen).
* `h-dvh max-h-dvh`, the previous value. It re-asserts full viewport height and ignores body's padding.

## Decision Outcome
Chosen option: "`BaseLayout.astro`'s body-child wrapper div uses `h-full max-h-full` (was `h-dvh max-h-dvh`), matching the `h-full` pattern `AppLayout`/`GameLayout` already use for their own wrappers".

### Consequences
* Good, because `BottomNav` is no longer clipped off the bottom edge in standalone mode.
* Neutral, because Safari tabs are unaffected: the inset resolves to 0 there.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### `h-full max-h-full`
* Good, because the wrapper fits inside body's padded content box.
* Good, because it matches the `h-full` pattern `AppLayout` and `GameLayout` use.

### `h-dvh max-h-dvh`
* Bad, because it overflows body's content box by the top inset, and body's `overflow-hidden` clips `BottomNav`.

## Evidence / More Information
Decided: 2026-08-01

* Commit `896f0ae6` (2026-08-01; the `BaseLayout.astro` change and the D179 row): rebuilt Context, Decision Drivers, Considered Options, Consequences and Pros and Cons.
* `docs/superpowers/specs/2026-07-29-ios-safe-area-top-inset-design.md` (body padding and `border-box` note): rebuilt Context.
