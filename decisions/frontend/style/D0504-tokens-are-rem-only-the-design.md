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
<!-- backfill: pending -->

# Tokens are rem only; the design system's tokens all live in `global.css`

## Context and Problem Statement
the owner wants every value in tokens, identical on both sides, so a change is made once; rem keeps sizes tied to the root font size.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "every token value in `global.css` `:root` and `@theme inline`, and in the Claude Design project's `tokens/*.css`, is rem (16px base), never px; `brand-tokens.test.ts` fails on a px value in either code block. The first tokens-area sync (D499) took the design system's design-only tokens into `:root` (materials, rings, `--space-*`, `--type-*`, `--tracking-*`, `--dur-*`, progress/status/dartboard-accent colours, `skpulse`) and the five radii into `@theme` (`rounded-pill`, `-card`, `-tile`, `-inlay`, `-button`), and pushed the code's own variables (Tailwind `--text-*` scale, `--animate-*`, `--meter-*`, `--tag-*-h`, background images, layout) to the design system. Where both sides had a value, code won (`--nav-bottom`, `--dartboard-segment-hover`, `--vignette`, `sheet-in`). The design's colour aliases `--text-title/-caption/-body/-accent` are renamed `--title-foreground`, `--caption-foreground`, `--body-foreground`, `--accent-text-foreground` on both sides, because `--text-*` is Tailwind's font-size namespace. `@utility` rules and code-only keyframes stay code-only (accepted divergence in the lock).", because the owner wants every value in tokens, identical on both sides, so a change is made once; rem keeps sizes tied to the root font size.

### Consequences
utilities still hard-code values that now have tokens (`glass*`, `inset-well*`, rings) and px inside `@utility` bodies; wiring them to the tokens is a follow-up. Existing px tables in the Style Guide read as 16px-base equivalents.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-28
