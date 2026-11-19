---
id: D0175
status: superseded
date: 2026-08-21
origin: contemporaneous
original-date:
tags: [frontend/style, style, Tailwind, safe-area]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by: D0226
---

# `scripts/check-style-tokens.sh` also bans Tailwind v3 prefix-important (`!utility`) and

## Context and Problem Statement
Agents repeatedly landed deprecated forms; prose in the Style Guide was not enough — same latency pattern as D161. Shipped id is D175, not D174 — D174 was already taken by the 2026-07-29 safe-area-inset decision

## Decision Drivers
* Agents repeatedly emitted Tailwind v3-era forms such as `!max-w-none` and `-left-[45%]`.
* Prose guidance in the Style Guide was not enough under attention load.
* The existing style gate already owned style bans, so the spec extends it instead of adding a parallel script.

## Considered Options
* Extend `scripts/check-style-tokens.sh` (chosen).
* Add a new parallel gate script.
* Ban only leading-dash arbitrary negatives and keep scale negatives such as `-mt-4` (the spec's option A, chosen).
* Also ban scale negatives (option B, deferred).

## Decision Outcome
Chosen option: "`scripts/check-style-tokens.sh` also bans Tailwind v3 prefix-important (`!utility`) and leading-dash arbitrary negatives (`-prop-[…]`) in favor of v4 `utility!` / `prop-[-…]`".

### Consequences
* Good, because the gate already runs in the husky pre-commit hook and `.github/workflows/quality.yml`, so the new bans need no new wiring.
* Neutral, because the spec accepts gaps: a prefix-important string held in a variable, a bare `:class={`!flex`}`, and `@apply !utility` are not scanned.
* Neutral, because scale negatives (`-mt-4`, `-rotate-45`, `-translate-x-1/2`) stay allowed.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The spec's § 6: temporary fixtures make the script exit non-zero for each ban family and zero for the must-pass cases, and the current `app/src` tree must be clean. Afterwards `check-style-tokens.sh`, `check-agent-mirrors.sh`, `check-doc-links.sh`, `check-context-map.sh` and `check-context-budget.sh` run.

## Pros and Cons of the Options
### Extend `scripts/check-style-tokens.sh`
* Good, because the existing style gate already owns style bans and runs in pre-commit and CI.

### Ban only leading-dash arbitrary negatives
* Good, because scale negatives (`-mt-4`) stay legal while the deprecated `-left-[45%]` form fails.

## Evidence / More Information
Decided: 2026-07-31

* `docs/superpowers/specs/2026-07-31-tailwind-v4-utility-syntax-gate-design.md` (§ 1–6, § 7): rebuilt Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
* `docs/superpowers/plans/2026-07-31-tailwind-v4-utility-syntax-gate.md`: the implementation plan; it numbers the decision D174, and the Context records that it shipped as D175.
* Commit `4d9e323e` (PR #61, 2026-07-31; adds the gate patterns and the D175 row): confirmed the gate extension.
* Superseded by D226, which bans the suffix form `utility!` as well.
