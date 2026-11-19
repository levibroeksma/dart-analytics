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

# `Button.astro` takes a default slot for runtime labels; its ambient `loading` default stays

## Context and Problem Statement
a label known only at runtime (an `x-for` item's name) could not be expressed: `title` resolves at build time and the HTML `title` attribute is a tooltip, so `ExercisePicker.astro` hand-rolled a `<button>` (#502). Changing the `loadingExpr` default to `"false"` (#516) would break every caller that relies on a page scope's `loading` flag without passing the prop, and nothing can list those callers mechanically; documenting the default removes the surprise without that risk.

## Decision Drivers
* A label known only at runtime (an `x-for` item's name) cannot be expressed: `title` resolves at build time and the HTML `title` attribute is a tooltip. `ExercisePicker.astro` hand-rolled a `<button>` (#502).
* Changing the `loadingExpr` default to `"false"` (#516) would break every caller that relies on a page scope's `loading` flag without passing the prop. Nothing can list those callers mechanically.

## Considered Options
* Keep `title` as the only label source.
* Add a default slot and change the `loadingExpr` default to `"false"`.
* Add a default slot, keep the `loadingExpr` default and document it (chosen).

## Decision Outcome
Chosen option: "`Button.astro` gains an unnamed `<slot />`. When the caller passes default-slot content (`Astro.slots.has("default")`) it renders inside the label `<span>` in place of `title`, under the same `x-show="!(loadingExpr)"` guard, so the spinner swap and `iconBefore`/`iconAfter` slots behave as before. `title` and the slot are mutually exclusive: the slot wins. `loadingExpr`'s default (`typeof loading !== 'undefined' && loading`) is kept and now documented on the prop and in the Component Inventory row.".

### Consequences
no existing call site changes. `ExercisePicker.astro`'s tile is a multi-part control (name plus description with its own tile styling) and stays under the CLAUDE.md exemption; the slot is for the next single-label case. `.astro` carries no unit test (D101).

* Good, because no existing call site changes.
* Neutral, because the `ExercisePicker.astro` tile is a multi-part control (name plus description with its own tile styling) and stays under the CLAUDE.md exemption. The slot is for the next single-label case.
* Neutral, because D101 applies and `.astro` carries no unit test.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### `title` only
* Bad, because a runtime label cannot be expressed, so a caller hand-rolls a `<button>`.

### Default slot with the `loadingExpr` default changed to `"false"`
* Bad, because it breaks every caller that relies on a page scope's `loading` flag, and no tool can list them.

### Default slot with the `loadingExpr` default kept and documented
* Good, because a runtime label renders inside the label `<span>` under the same `x-show="!(loadingExpr)"` guard, so the spinner swap and `iconBefore`/`iconAfter` slots behave as before.
* Good, because documenting the default removes the surprise without the breakage risk.

## Evidence / More Information
Decided: 2026-10-03

* Commit `09151a23` (PR #726, 2026-10-03; adds the D394 row, the `Button.astro` slot and the Component Inventory update): rebuilt Decision Drivers, Considered Options, Consequences and Pros and Cons.
