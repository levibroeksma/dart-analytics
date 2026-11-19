---
id: D0027
status: accepted
date: 2026-07-12
origin: contemporaneous
original-date:
tags: [database, migration]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Read-model views normalized (migration `0013`)

## Context and Problem Statement
Consistent, key-based read contract; fixes inconsistency the freeze missed. The spec names the fix as migration `0013`, which does not edit the applied `0009`.

## Decision Drivers
* The v1 freeze validation covered the API contract and did not check the read-model views for internal consistency (spec § 1).
* The same concept had different names across views, views exposed internal lookup ids, and `v_active_sessions` had no ruleset key, so a resuming client could not name the ruleset without a second lookup (spec § 1).

## Considered Options
* Normalize at the source with a new view migration `0013` (chosen, spec K3).
* Absorb the inconsistency in the repository layer. The spec rejects it in favour of the source fix.

## Decision Outcome
Chosen option: "Read-model views normalized (migration `0013`): implementation keys as `*_key`, labels as `*_name`, no internal lookup ids exposed; `ruleset_version_key` added to `v_active_sessions`", because Consistent, key-based read contract; fixes inconsistency the freeze missed.

### Consequences
* Good, because later views and queries inherit one convention and a resuming client gets `ruleset_version_key` (spec K3, K4).
* Neutral, because the change only renames and re-projects columns: same rows, joins and filters (spec K5).
* Neutral, because columns are renamed and dropped, so each view is dropped and re-created, and the chain range quoted in docs moves from `0001`–`0012` to `0001`–`0013` (spec § 3, § 4).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The spec's definition of done requires `0013` to be created, `drizzle-kit introspect` to regenerate `schema.ts`, `scripts/check-context-map.sh` to print `OK`, and `npx fallow` plus `astro check` to run clean (spec § 8).

## Pros and Cons of the Options
Normalize in a new view migration:

* Good, because the convention lives in one place and future views inherit it (spec K3).
* Good, because behaviour is unchanged, so replay and analytics correctness is not at risk (spec K5).

Absorb in the repository:

Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-07-12

* `docs/superpowers/specs/2026-07-12-db-read-model-normalization-design.md` (§ 1, § 2, § 3, § 4, § 6 K2–K5, § 8): rebuilt Context, Decision Drivers, Considered Options, Consequences, Pros and Cons and Confirmation.
* `docs/superpowers/plans/2026-07-12-db-read-model-normalization.md` (D27 ledger task): shows the D27 row text added.
* Commit `5d2ea348` (PR #7, "Normalize read-model views & freeze v1 API response contracts"): adds the decision row.
