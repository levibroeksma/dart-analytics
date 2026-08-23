# Setup/Ruleset-Doc Sibling Consistency — Design

> **Scope:** close two open findings (F8, F26) — both are one sibling file
> in a family of near-identical files that drifted from its neighbors.
> Bundled because both are the same shape of finding (sibling-file drift),
> even though one touches a `.ts` JSDoc comment and the other a `.md`
> ruleset doc.
> **Out of scope:** every other open finding in `FINDINGS.md`.

## F8 — drop the redundant preset-count JSDoc line

Five of six preset-driven setup-data modules carry the line
`/** V1 seeds exactly one configuration preset; index 0 is always that
preset. */` above their exported factory function:
`around-the-clock-setup.data.ts`, `bobs27-setup.data.ts`,
`one-twenty-one-setup.data.ts`, `shanghai-setup.data.ts`,
`singles-training-setup.data.ts`. `doubles-training-setup.data.ts` carries
none. `createPresetSetupController` itself (`setup-controller.ts:27`, the
shared factory all six delegate to) already states the same fact once,
factory-side.

Per owner decision: drop the line from all five files rather than add it to
the sixth — the factory-level JSDoc is the single source now, per-file
repetition was made redundant when that factory was documented. Five
one-line deletions; `doubles-training-setup.data.ts` is already correct and
gets no edit.

## F26 — add singles-training's missing 1v1 win condition

`SINGLES_V1` ships a real score-compare 1v1 win condition (highest
`totalPoints`, `SEAT_CAPS.SINGLES_V1 = 2`), same as every other 1v1-capable
ruleset, but `singles-training.md` has no win-condition prose anywhere —
unlike `doubles-training.md`, which states its own under a "### Variants —
Multiplayer (1v1)" subsection.

Add the same subsection shape to `singles-training.md`, placed in "## Later
versions (V2+)" alongside its existing "### Match structure" subsection
(which currently only says "Multiplayer / online multiplayer"):

```markdown
### Variants — Multiplayer (1v1)

1v1 win condition: highest total points; ties possible, no tiebreak in this
version.
```

`doubles-training.md` is the reference wording and placement; no other
section of `singles-training.md` changes.

## Validation

`app/src/lib/game/*-setup.data.ts` edits are comment-only (no behavior
change) — `npx tsc --noEmit` and the existing setup-data test suites should
be unaffected; no test edits needed (JSDoc is exempt from
`scripts/check-test-coverage.sh`). `singles-training.md` lives under
`docs/game-rules/`, non-canonical per `docs/game-rules/README.md` — no
canonical-doc gate applies beyond `scripts/check-doc-links.sh`.
