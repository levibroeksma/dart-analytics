---
id: D0394
status: accepted
date: 2026-10-03
origin: contemporaneous
original-date:
tags: [frontend/astro, .astro, component, page, slot]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# `Button.astro` takes a default slot for runtime labels; its ambient `loading` default stays

## Context and Problem Statement
a label known only at runtime (an `x-for` item's name) could not be expressed: `title` resolves at build time and the HTML `title` attribute is a tooltip, so `ExercisePicker.astro` hand-rolled a `<button>` (#502). Changing the `loadingExpr` default to `"false"` (#516) would break every caller that relies on a page scope's `loading` flag without passing the prop, and nothing can list those callers mechanically; documenting the default removes the surprise without that risk.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`Button.astro` gains an unnamed `<slot />`. When the caller passes default-slot content (`Astro.slots.has("default")`) it renders inside the label `<span>` in place of `title`, under the same `x-show="!(loadingExpr)"` guard, so the spinner swap and `iconBefore`/`iconAfter` slots behave as before. `title` and the slot are mutually exclusive: the slot wins. `loadingExpr`'s default (`typeof loading !== 'undefined' && loading`) is kept and now documented on the prop and in the Component Inventory row.".

### Consequences
no existing call site changes. `ExercisePicker.astro`'s tile is a multi-part control (name plus description with its own tile styling) and stays under the CLAUDE.md exemption; the slot is for the next single-label case. `.astro` carries no unit test (D101).

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-03
