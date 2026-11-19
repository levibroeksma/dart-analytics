---
id: D0174
status: accepted
date: 2026-07-29
origin: contemporaneous
original-date:
tags: [frontend/style, style, CSS, safe-area]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `body` in `global.css` pads `padding-top

## Context and Problem Statement
`black-translucent` status bar style + `viewport-fit=cover` (D173) already draw content edge-to-edge; with no safe-area inset anywhere in the codebase, header/title content collided with the iOS status bar's clock/battery/signal icons in a standalone-launched web app

## Decision Drivers
* Nothing in the codebase padded for `env(safe-area-inset-top)`, so content drew under the translucent iOS status bar.
* `html` and `body` already used `h-dvh max-h-dvh overflow-hidden`, so `dvh` sizing was not the bug.

## Considered Options
* Pad `body` once with `padding-top: env(safe-area-inset-top)` (chosen).
* Repeat the padding in `AppLayout.astro` and `GameLayout.astro`.
* Pad `body::before` and `body::after`.
* Add a bottom safe-area inset in the same change.

## Decision Outcome
Chosen option: "`body` in `global.css` pads `padding-top: env(safe-area-inset-top)` alongside its existing `h-dvh max-h-dvh overflow-hidden`".

### Consequences
* Good, because Tailwind preflight sets `border-box`, so the padding shrinks the content box inside the `h-dvh` bound with no overflow and no `calc()`.
* Good, because `env()` resolves to `0` on browsers without support, so no fallback branch is needed.
* Neutral, because the change covers the top inset only. The bottom inset (home-indicator bar) is not addressed, since it was not reported broken.
* Bad, because the automated suite does not cover the rendered fix. The spec requires a manual check on a real iOS device.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The spec's Verification Plan: `npm run validate:app` passes; desktop shows no change; on an installed iOS Home Screen app the header no longer collides with the status bar icons; an iOS Safari tab shows no regression. The iOS checks are manual.

## Pros and Cons of the Options
### Pad `body` once
* Good, because `body` already owns `h-dvh` and `overflow-hidden`, so one rule covers every page, including bare `BaseLayout` consumers such as `/login`.

### Repeat the padding per layout
* Bad, because it duplicates a rule that `body` can hold once and leaves pages outside those layouts uncovered.

### Pad `body::before` and `body::after`
* Bad, because the ambient backdrop must stay full-bleed behind the translucent status bar; only real content insets.

### Add a bottom inset in this change
* Bad, because it goes beyond the reported bug.

## Evidence / More Information
Decided: 2026-07-29

* `docs/superpowers/specs/2026-07-29-ios-safe-area-top-inset-design.md` (Problem, Fix, Scope, Verification Plan, Anti-Patterns): rebuilt Context, Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
* Commit `3151dc42` (PR #60, 2026-07-30; edits `global.css`, adds the D174 row): confirmed the one-line CSS change.
