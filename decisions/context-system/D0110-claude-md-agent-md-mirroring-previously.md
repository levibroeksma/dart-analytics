---
id: D0110
status: accepted
date: 2026-07-16
origin: contemporaneous
original-date:
tags: [context-system, context map, CLAUDE.md, CI, PR, AGENT.md]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `CLAUDE.md`/`AGENT.md` mirroring, previously a documented-but-unenforced fact (Context

## Context and Problem Statement
User-directed: mirror drift should never be possible to land silently, matching the D105 precedent of converting discipline-only rules into enforced ones

Per the spec, the Context Map already documented that each `AGENT.md` mirrors its sibling `CLAUDE.md` ("edit both together", 2026-07-15). Nothing failed if a pair drifted.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`CLAUDE.md`/`AGENT.md` mirroring, previously a documented-but-unenforced fact (Context Map, 2026-07-15), made an explicit Context Maintenance protocol step and mechanically enforced via new `scripts/check-agent-mirrors.sh` (local + CI, alongside `check-context-map.sh`/`check-file-locations.sh`); the new script immediately caught a real pre-existing drift (`app/AGENT.md` had fallen behind `app/CLAUDE.md` since PR #25), fixed in the same change", because User-directed: mirror drift should never be possible to land silently, matching the D105 precedent of converting discipline-only rules into enforced ones.

### Consequences
* Neutral, because root `CLAUDE.md` Context Maintenance step 1 now requires the `AGENT.md` mirror, kept byte-for-byte identical. Step 5 gains the new script.
* Neutral, because the `structure` job in `checks.yml` gains an `AGENT.md mirror gate` step.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`scripts/check-agent-mirrors.sh` exists today. Commit `7e907d1f` added it as a `diff -q` check on each `CLAUDE.md`/`AGENT.md` pair. Its header now says it checks that each `AGENT.md` holds a pointer stub. `quality.yml` runs it, and `scripts/precommit-gates.tsv` lists it.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-16

* `docs/superpowers/specs/2026-07-16-game-rules-wiring-design.md` (§ 4, § 5): rebuilt Context, Consequences and Confirmation.
* `docs/superpowers/plans/2026-07-16-game-rules-wiring.md` (the `DECISIONS.md` step): confirmed the row text.
* Commit `7e907d1f` (PR #27, 2026-07-16): added the script and the protocol step.
* Applied in: `docs/superpowers/specs/2026-07-23-context-layer-hardening-design.md` (§ 1, cites D110 as a mechanization precedent).
