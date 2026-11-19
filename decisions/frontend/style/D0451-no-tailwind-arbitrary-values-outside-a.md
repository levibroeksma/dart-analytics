---
id: D0451
status: accepted
date: 2026-10-12
origin: contemporaneous
original-date:
tags: [frontend/style, style, CSS, token, Tailwind, font]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# No Tailwind arbitrary values outside a reviewed allowlist; role-named type bundles

## Context and Problem Statement
the audit found 190 arbitrary values in 72 files, many re-spelling existing tokens. D428 ("a token before any component uses it") was not enforced, so agents copied neighbours' literals.

## Decision Drivers
* The audit found 190 `.astro` hits in 72 files, and arbitrary values also appear in `.ts` class strings and `@apply` lines (spec "Goal", "Evidence").
* D428 says a new value enters `global.css` as a token before any component uses it, and the audit shows this is not enforced (spec "Evidence").
* Agents copy neighbours' literals (existing Context).

## Considered Options
* Ban every arbitrary value, modifier and variant, with exceptions only through an allowlist (chosen; spec "Decisions" 1).
* Add `--tracking-*` and `--leading-*` tokens. The spec rejects them: tracking lives in `--text-*` bundles or stock steps (spec "Decisions" 15).

## Decision Outcome
Chosen option: "`app/src` markup, `.ts` class strings and `@apply` carry no Tailwind arbitrary value, modifier, property or variant (`prop-[…]`, `/[…]`, `[prop:value]`, `[&…]`). The fix ladder is: stock v4 class → existing `@theme` token → new `global.css` token (D428) → `@utility` for a repeated composite → an `ARBITRARY_ALLOW` row (`path|match` plus a reason) in `scripts/check-style-tokens.sh`, which fails on any unlisted hit and on any row that no longer matches. New font sizes are role-named `--text-*` bundles (size, line-height, tracking): `body-sm`, `caption`, `micro`, `key`, `key-label`, `stat`, `summary`, `summary-lg`, and `numeral-1…6` (the D432 cqw clamps, now tokens). `text-button` is renamed `text-control`, the 15px control-text size. No `--tracking-*` or `--leading-*` tokens: tracking lives in a bundle or a stock step. Composites: `grid-cols-mirror`/`-scoreboard`, `stack-slab-1/2`, `border-medium`, `pt-safe`/`pb-safe`, `bottom-nav`/`bottom-above-nav`/`pb-nav` (via `--nav-bottom`, `--nav-clearance`), `input-number-plain`.", because the audit found 190 arbitrary values in 72 files, many re-spelling existing tokens. D428 ("a token before any component uses it") was not enforced, so agents copied neighbours' literals.

### Consequences
sub-pixel line-height shifts where `/[normal]` gave way to explicit values; 11→12px and 10→12px "IN PROGRESS" eyebrows; `Stepper` 32→30px; tracking snaps of ≤0.02em; transitions also animate opacity/filter. Visual check per screen, not byte-verifiable. `cn()` learns every brand `@theme` token and `@utility` from `app/src/lib/client/merge-tokens.ts`, which `cn.test.ts` holds in lockstep with `global.css`. The gate also bans v4 variable shorthand (`prop-(--x)`, `/(--x)`). Source: `docs/superpowers/specs/2026-10-12-tailwind-arbitrary-values-design.md`.
* Bad, because sub-pixel line-height shifts and a few size snaps follow, and they need a visual check per screen; they are not byte-verifiable (record Consequences; spec "Goal" limits the change to the snaps it lists).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`scripts/check-style-tokens.sh` carries the `ARBITRARY_ALLOW` allowlist and fails on any unlisted hit. `app/tests/lib/client/cn.test.ts` holds `merge-tokens.ts` in lockstep with `global.css` (record Consequences).

## Pros and Cons of the Options
* Role-named `--text-*` bundles, credited to the chosen option: each bundles size, line-height and tracking, so line-height is explicit instead of `normal` (spec "Decisions" 4 and 6).

## Evidence / More Information
Decided: 2026-10-12
* `docs/superpowers/specs/2026-10-12-tailwind-arbitrary-values-design.md`: rebuilt Decision Drivers, Considered Options, Pros and Cons ("Goal", "Evidence", "Decisions" 1, 3, 4, 6, 15, 17).
* Commit `4ee420cd` (2026-10-12, "refactor(style): ban Tailwind arbitrary values, cn() merge registry (D451) (#936)"): adds the D451 row; rebuilt Confirmation.
* Applied in: `docs/superpowers/plans/2026-10-12-tailwind-arbitrary-values.md`, `docs/superpowers/plans/2026-10-13-exercise-play-restyle.md`, `docs/superpowers/plans/2026-10-21-routine-detail-redesign.md`.
