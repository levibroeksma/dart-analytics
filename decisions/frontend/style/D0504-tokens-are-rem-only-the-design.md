---
id: D0504
status: accepted
date: 2026-10-28
origin: contemporaneous
original-date:
tags: [frontend/style, style, CSS, token, Tailwind, glass, font, colour]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Tokens are rem only; the design system's tokens all live in `global.css`

## Context and Problem Statement
the owner wants every value in tokens, identical on both sides, so a change is made once; rem keeps sizes tied to the root font size.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "every token value in `global.css` `:root` and `@theme inline`, and in the Claude Design project's `tokens/*.css`, is rem (16px base), never px; `brand-tokens.test.ts` fails on a px value in either code block. The first tokens-area sync (D499) took the design system's design-only tokens into `:root` (materials, rings, `--space-*`, `--type-*`, `--tracking-*`, `--dur-*`, progress/status/dartboard-accent colours, `skpulse`) and the five radii into `@theme` (`rounded-pill`, `-card`, `-tile`, `-inlay`, `-button`), and pushed the code's own variables (Tailwind `--text-*` scale, `--animate-*`, `--meter-*`, `--tag-*-h`, background images, layout) to the design system. Where both sides had a value, code won (`--nav-bottom`, `--dartboard-segment-hover`, `--vignette`, `sheet-in`). The design's colour aliases `--text-title/-caption/-body/-accent` are renamed `--title-foreground`, `--caption-foreground`, `--body-foreground`, `--accent-text-foreground` on both sides, because `--text-*` is Tailwind's font-size namespace. `@utility` rules and code-only keyframes stay code-only (accepted divergence in the lock).", because the owner wants every value in tokens, identical on both sides, so a change is made once; rem keeps sizes tied to the root font size.

### Consequences
utilities still hard-code values that now have tokens (`glass*`, `inset-well*`, rings) and px inside `@utility` bodies; wiring them to the tokens is a follow-up. Existing px tables in the Style Guide read as 16px-base equivalents.
* Neutral, because the tokens-area reconciliation recorded 119 code-wins, 109 design-wins and 120 accepted divergences in the lock (commit `0ca01471` message).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/lib/ui/brand-tokens.test.ts` fails on a px value in `:root` or `@theme inline`; commit `0ca01471` changed it, and it exists today.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-10-28
* Commit `0ca01471` (2026-10-28, "chore(design-sync): tokens area reconciled, rem-only tokens (D504)"): adds the D504 row and the first tokens-area sync; rebuilt Confirmation.
* Applied in: `docs/superpowers/specs/2026-11-04-design-system-artifact-sync-design.md` ("Areas and their design side", Tokens: D504's "identical on both sides" holds for every token the format can hold) and `docs/superpowers/plans/2026-11-04-design-system-artifact-sync.md`.
