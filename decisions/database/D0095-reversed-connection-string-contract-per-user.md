---
id: D0095
status: accepted
date: 2026-07-15
origin: contemporaneous
original-date:
tags: [database, Neon]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Reversed connection-string contract per user-verified `neonctl link` output

## Context and Problem Statement
Matches Neon's real 5-variable output exactly; supersedes commit `a2be0eb`'s unverified reverse assumption

## Decision Drivers
* The earlier contract came from commit `a2be0eb`, whose contract the commit message says it "assumed".
* A real `neonctl link` run confirmed that the `DATABASE_URL` hostname contains `-pooler`, so it is the pooled string, the opposite of that assumption.

## Considered Options
* Keep Neon's own variable names: `DATABASE_URL` pooled, `DATABASE_URL_UNPOOLED` direct, and drop `DATABASE_URL_POOLED` (chosen).
* Keep a manually maintained `DATABASE_URL_POOLED` alias. The commit's doc text names it as the root cause of the earlier contradiction.

## Decision Outcome
Chosen option: "Reversed connection-string contract per user-verified `neonctl link` output: `DATABASE_URL` = pooled (tooling: dbmate, drizzle-kit), `DATABASE_URL_UNPOOLED` = direct (Worker runtime `getDb()`); `DATABASE_URL_POOLED` eliminated entirely, no manually-maintained alias", because Matches Neon's real 5-variable output exactly; supersedes commit `a2be0eb`'s unverified reverse assumption.

### Consequences
* Good, because the contract matches the 5 variables `neonctl link` writes, so no manually maintained duplicate of `DATABASE_URL` exists.
* Neutral, because the commit renames the variable in the dbmate npm scripts, `drizzle.config.ts`, `seed.ts` and `smoke.ts`, and the Worker runtime `getDb()` now reads `DATABASE_URL_UNPOOLED`.
* Neutral, because the Neon integration doc (`11-Neon-Integration.md` § Connection String Rules) remains the sole owner of the variable semantics.

### Confidence
High — the hostname was verified against a real `neonctl link` run on 2026-07-15 (commit `9f91e69a`).

### Revisit When
Rationale unknown — no source found.

### Confirmation
The commit records the verification in `11-Neon-Integration.md` § Connection String Rules ("Verified 2026-07-15" against a real `neonctl link`).

## Pros and Cons of the Options
Neon's names with `DATABASE_URL_POOLED` removed:

* Good, because it matches Neon's real output exactly.

Manually maintained `DATABASE_URL_POOLED` alias:

* Bad, because requiring a duplicate of `DATABASE_URL` was the root cause of the earlier contradiction (commit `9f91e69a`, `11-Neon-Integration.md`).

## Evidence / More Information
Decided: 2026-07-15

* Commit `9f91e69a` (2026-07-15, "fix(db): reverse pooled/direct contract per user-verified neonctl output; eliminate DATABASE_URL_POOLED"): adds the decision row; rebuilt Decision Drivers, Considered Options, Consequences, Confidence, Pros and Cons and Confirmation from the commit message and diff.
* Commit `a2be0eb`, named by the row, is not in the local repository, so it was not read.
