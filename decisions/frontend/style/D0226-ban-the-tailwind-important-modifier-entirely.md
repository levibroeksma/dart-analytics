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
<!-- backfill: pending -->

# Ban the Tailwind important modifier entirely, both forms

## Context and Problem Statement
Auditing every `!`-suffixed class in the repo (`GameCard.astro`, `SetupShell.astro`, `FiveOhOneSetupForm.astro`, `ScoreTrainingSetupForm.astro`, `pages/games/index.astro`, `AddGuestButton.astro`, `GuestSection.astro`) found every single usage was a same-category Tailwind utility conflict (`rounded-md` vs `rounded-full`, `bg-white` vs `bg-accent`, `flex-col` vs `flex-row`, …) that `cn()`'s `twMerge` already resolves by class order — confirmed by reading `global.css`'s `.btn`/`.btn-*` rules, which set only transitions/shadows/hover backgrounds, never padding/radius/border-color. The `!` modifier was never structurally necessary anywhere it was used.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`scripts/check-style-tokens.sh` now bans the Tailwind important modifier in both forms — prefix (`!utility`, already banned by D175) and suffix (`utility!`, D175's own sanctioned v4 form). Overrides are composed as plain classes through `cn()`'s merge ordering (`classNameProp` is always merged last in every component's `cn()` call, so a plain conflicting utility already wins); when a primitive's own defaults are too far from what a screen needs, the primitive's variant/prop surface is extended instead (e.g. `Button.astro`'s new `dashed` variant), rather than layering an override on top of it.".

### Consequences
All 7 files migrated to plain classes in the same change. `scripts/check-style-tokens.sh`'s `IMPORTANT_MODIFIER` check now flags both forms; `07-Frontend/07-Style-Guide.md` and `app/CLAUDE.md`'s Style non-negotiables no longer present suffix-`!` as the correct v4 form.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-21
