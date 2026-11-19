---
id: D0226
status: accepted
date: 2026-08-21
origin: contemporaneous
original-date:
tags: [frontend/style, style, CSS, Tailwind, primitive, surface]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes: D0175
superseded-by:
---

# Ban the Tailwind important modifier entirely, both forms

## Context and Problem Statement
Auditing every `!`-suffixed class in the repo (`GameCard.astro`, `SetupShell.astro`, `FiveOhOneSetupForm.astro`, `ScoreTrainingSetupForm.astro`, `pages/games/index.astro`, `AddGuestButton.astro`, `GuestSection.astro`) found every single usage was a same-category Tailwind utility conflict (`rounded-md` vs `rounded-full`, `bg-white` vs `bg-accent`, `flex-col` vs `flex-row`, …) that `cn()`'s `twMerge` already resolves by class order — confirmed by reading `global.css`'s `.btn`/`.btn-*` rules, which set only transitions/shadows/hover backgrounds, never padding/radius/border-color. The `!` modifier was never structurally necessary anywhere it was used.

## Decision Drivers
* Every audited `!`-suffixed class was a same-category utility conflict that `cn()`'s `twMerge` already resolves by class order.
* D175 had endorsed the suffix form `utility!` as the v4 syntax.

## Considered Options
* Ban both forms of the important modifier and compose overrides through `cn()` (chosen).
* Keep the suffix form `utility!` as the sanctioned v4 form, as D175 did.

## Decision Outcome
Chosen option: "`scripts/check-style-tokens.sh` now bans the Tailwind important modifier in both forms — prefix (`!utility`, already banned by D175) and suffix (`utility!`, D175's own sanctioned v4 form). Overrides are composed as plain classes through `cn()`'s merge ordering (`classNameProp` is always merged last in every component's `cn()` call, so a plain conflicting utility already wins); when a primitive's own defaults are too far from what a screen needs, the primitive's variant/prop surface is extended instead (e.g. `Button.astro`'s new `dashed` variant), rather than layering an override on top of it.".

### Consequences
All 7 files migrated to plain classes in the same change. `scripts/check-style-tokens.sh`'s `IMPORTANT_MODIFIER` check now flags both forms; `07-Frontend/07-Style-Guide.md` and `app/CLAUDE.md`'s Style non-negotiables no longer present suffix-`!` as the correct v4 form.
* Neutral, because the gate only passes once every existing `!` usage is gone, so migrating the 7 files is part of the same change.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`scripts/check-style-tokens.sh` flags both forms in `app/src`. Commit `011ca5a1` updates the script, `app/CLAUDE.md` and the Style Guide together.

## Pros and Cons of the Options
### Ban both forms
* Good, because overrides compose through `cn()` ordering, and a primitive whose defaults are too far off gets a new variant, such as `Button.astro`'s `dashed`.

### Keep the suffix form
* Bad, because the audit found `!` was never structurally necessary where it was used.

## Evidence / More Information
Decided: 2026-08-21

* `docs/superpowers/specs/2026-08-21-guest-play-ui-fixes-and-split-scoreboard-design.md` (§ 1, § 2): rebuilt Decision Drivers, Considered Options, Consequences and Pros and Cons.
* `docs/superpowers/plans/2026-08-21-guest-play-ui-fixes-and-split-scoreboard.md` (the check-script task and the decision-block step): rebuilt Confirmation.
* Commit `011ca5a1` (2026-08-21; edits the gate, `app/CLAUDE.md`, the Style Guide and the 7 files): confirmed Confirmation.
* Supersedes D175's endorsement of the suffix form.
