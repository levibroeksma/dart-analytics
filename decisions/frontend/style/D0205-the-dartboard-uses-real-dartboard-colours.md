---
id: D0205
status: accepted
date: 2026-08-10
origin: contemporaneous
original-date:
tags: [frontend/style, CSS, token, glass, surface, colour]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# The dartboard uses real dartboard colours, not the sky-blue theme

## Context and Problem Statement
Owner direction after using the shipped board — the sky theme reads as an app skin, not a dartboard, on the one surface meant to look like the real object being scored against.

## Decision Drivers
* Owner direction after using the shipped board: the sky theme read as an app skin on the one surface meant to look like a real dartboard.
* The white label token `--dartboard-label` was defined but unused, so numbers rendered accent-blue.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`--dartboard-single-dark`/`--dartboard-single-light`/`--dartboard-wire-red`/`--dartboard-wire-green` in `global.css` are recoloured to a real dartboard's black/cream single beds and red/green multiplier rings (`--dartboard-single-dark: oklch(16% 0 0)`, `--dartboard-single-light: oklch(90% 0.045 90)`, `--dartboard-wire-red: oklch(50% 0.19 25)`, `--dartboard-wire-green: oklch(46% 0.14 150)`), replacing values that resolved to the app's sky-blue accent and a near-transparent white. `.dartboard-group .segment text` now reads `var(--dartboard-label)` instead of `var(--accent)`, fixing a pre-existing mismatch where the already-defined white label token went unused and numbers rendered accent-blue. No class or token *name* changed — `DartBoard.astro`'s `.segment.dark`/`.segment.light`/`.bullSegment .single`/`.bullSegment .double` rules already mapped dark beds to the red-named token and light beds to the green-named token, matching a real board's per-wedge convention; only the colour values were wrong.", because Owner direction after using the shipped board — the sky theme reads as an app skin, not a dartboard, on the one surface meant to look like the real object being scored against.

### Consequences
`--accent`, `--error`, `--success` and the rest of the app's sky/glass theme are untouched — this is scoped to the four `--dartboard-*` tokens plus the label-fill fix. Verified by rendering the compiled component in a headless browser (its own `:root`/`@theme inline` tokens and `.dartboard-group` rules, not a hand-approximation) and reading each zone's computed `fill` back: dark beds/bullseye resolve to the red hue, light beds/outer bull to the green hue, both single beds to the intended near-black/cream, and label text to white.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-08-10

* Commit `af3c4424` (2026-08-10; edits `global.css`, adds the D205 row): rebuilt Decision Drivers.
