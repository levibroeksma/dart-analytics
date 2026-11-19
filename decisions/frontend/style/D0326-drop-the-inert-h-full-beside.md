---
id: D0326
status: accepted
date: 2026-09-19
origin: contemporaneous
original-date:
tags: [frontend/style, style, spacing, glass]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Drop the inert `h-full` beside `flex-1`; keep the `max-h-2/5` clamp

## Context and Problem Statement
`SinglePlayerDisplay`'s root carries `flex-1 min-h-0` and sits in a `flex flex-col` parent, so `flex-basis: 0%` supplies its main size and the `height: 100%` is never consulted — the percentage resolves against a definite chain (`html`/`body` are `h-dvh max-h-dvh`, D174), so there is no indefinite-height case where `h-full` could act as a fallback. Keeping it implied a sizing contract the box model does not honour, and it was copied into twelve files. The alternative of folding the clamp into `SinglePlayerDisplay` itself was rejected: the same component renders inside `SplitScoreboardHalf.astro` at `size="sm"`, where a 40% cap must not apply, so a built-in default would need a new opt-out prop to undo it at the one call site that matters most.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "every `SinglePlayerDisplay` call site that passed `max-h-2/5 h-full` (or `min-h-2/5 max-h-2/5 h-full`) now passes the clamp alone — the nine game interfaces under `components/layout/games/interfaces/`, plus `QuickSubtract.astro`, `DoublePatternPanel.astro` and `SwitchingPanel.astro`, which repeat the same pair. `h-full` is banned beside `flex-1` generally (`07-Frontend/07-Style-Guide.md` §Spacing & layout). The `h-full` *inside* `SinglePlayerDisplay.astro`, on the inner card div, is load-bearing and stays: that div's parent is a plain block box, not a flex container.".

### Consequences
twelve markup files lose one class each; no class was added. The reasoning is spec-level, not measured — the change was made in an environment with no WebKit and no working headless Chromium, so it is unverified on device, exactly as GitHub issue #280 (migrated `FINDINGS.md` F15) warned when it asked for this audit. Issue #280's premise is settled by this: the pair was dead weight, not the cross-browser risk it was suspected of being — the reported iPhone overlap was the nested `glass` stack (D228). The rule is prose in the style guide, not a gate; `scripts/check-style-tokens.sh` has no notion of an element's flex context, so reintroduction is caught by review.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-19
