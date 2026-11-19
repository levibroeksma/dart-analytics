---
id: D0227
status: accepted
date: 2026-08-21
origin: contemporaneous
original-date:
tags: [frontend/astro, .astro, component, icon, slot]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `IconBtn.astro` is a new component, not a `Button.astro` prop, and is always a true circle

## Context and Problem Statement
extending `Button.astro`'s `icon` boolean would have kept every icon-only call site paying for `Button.astro`'s text-oriented base classes (`gap-2`, `text-sm font-semibold`, `px-4 py-2.5` conditionally swapped for `p-2.5`) and manual per-call-site `rounded-full`/border overrides — exactly the pattern `AddGuestButton.astro` used before this decision (`variant="dashed" icon class="rounded-full p-3 border-4"`). A new component bakes the icon-only shape in once instead of asking every caller to reassemble it.

## Decision Drivers
* Extending the `Button.astro` `icon` boolean keeps every icon-only call site paying for text-oriented base classes (`gap-2`, `text-sm font-semibold`, `px-4 py-2.5` swapped for `p-2.5`).
* Call sites override `rounded-full` and the border by hand, as `AddGuestButton.astro` did with `variant="dashed" icon class="rounded-full p-3 border-4"`.
* An icon-only control has no visible text, so its accessible name needs a required prop.

## Considered Options
* Extend `Button.astro`'s existing `icon` prop.
* A standalone `IconBtn.astro` component (chosen).

## Decision Outcome
Chosen option: "`app/src/components/forms/IconBtn.astro` is a standalone component, not an extension of `Button.astro`'s existing `icon` prop. Its base classes always include `aspect-square rounded-full border-3` — `aspect-square` guarantees the button is a perfect circle regardless of what padding the caller passes via `class` (its only sizing input; the component itself applies none), which `rounded-full` alone cannot guarantee once width and height can differ. `border-3` is the base border width for every variant (`primary`/`secondary`/`ghost`/`error`/`dashed`), wider than `Button.astro`'s 1px default, applied uniformly rather than only on `dashed`. `ariaLabel` is a required prop, unlike `Button.astro`'s optional one — an icon-only control has no visible text to fall back to, so omitting it would ship an unlabeled button. One default slot only; no `iconBefore`/`iconAfter`, no `loadingExpr`, no `title`.".

### Consequences
migrating existing icon-only `Button.astro` call sites (`AddGuestButton.astro`, `GameLayout.astro`'s exit button, `BoardInputPanel.astro`'s undo/bounce-out, `LogoutButton.astro`, `GuestSection.astro`'s remove badge) to `IconBtn.astro` is a separate, explicit follow-up per call site, not automatic — `AddGuestButton.astro` and `GuestSection.astro`'s remove badge migrated the same day this decision shipped (D227's own PR #157, migration in #158), the rest remain on `Button.astro icon` until asked for. `IconBtn.astro` reuses `Button.astro`'s existing `.btn-primary`/`.btn-secondary`/`.btn-ghost`/`.btn-error` CSS from `global.css` — no new CSS rules. D101 (markup-only `.astro` components are test-exempt) applies; no unit test exists for it.

* Neutral, because migrating existing icon-only `Button.astro` call sites to `IconBtn.astro` is a separate, explicit follow-up per call site, not automatic.
* Neutral, because `AddGuestButton.astro` and the `GuestSection.astro` remove badge migrated the same day (D227's own PR #157, migration in #158). The other call sites stay on `Button.astro icon` until asked for.
* Good, because `IconBtn.astro` reuses the `.btn-primary`/`.btn-secondary`/`.btn-ghost`/`.btn-error` CSS from `global.css`, so it adds no new CSS rules.
* Neutral, because D101 applies and no unit test exists for the component.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The plan verifies the component by a manual visual check, not a red/green test cycle. D101 exempts a markup-only `.astro` component from a Vitest file.

## Pros and Cons of the Options
### Extend the `Button.astro` `icon` prop
* Bad, because every icon-only call site keeps paying for the text-oriented base classes.
* Bad, because every call site keeps overriding `rounded-full` and the border by hand.

### Standalone `IconBtn.astro`
* Good, because the icon-only shape is built in once, so no caller reassembles it.
* Good, because `aspect-square` keeps the button a true circle whatever padding the caller passes, which `rounded-full` alone cannot guarantee.
* Good, because the required `ariaLabel` prevents an unlabeled icon-only button.

## Evidence / More Information
Decided: 2026-08-21

* `docs/superpowers/specs/2026-08-21-iconbtn-design.md` (Purpose, Props, Classes): rebuilt Decision Drivers, Considered Options and Pros and Cons.
* `docs/superpowers/plans/2026-08-21-iconbtn.md` (Task 1 verification note): rebuilt Confirmation.
* Commit `d16edd54` (2026-08-22; adds the D227 row): rebuilt Consequences.
