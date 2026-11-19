---
id: D0294
status: accepted
date: 2026-09-17
origin: contemporaneous
original-date:
tags: [testing, test, suite]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# A verification script that transcribes a code constant is gated by the same parity test as the seed

## Context and Problem Statement
the constant had three transcriptions, and only two of them were gated. The seed and `capabilities.ts` were held together by this test; the verification script was held together by nothing, and drifted six triples behind across three ruleset versions (`SINGLES_V2` D247, `SHANGHAI_V2` D245, `SINGLES_V3`) without a single gate objecting — issue #304, filed when the drift was noticed by hand. It was invisible because no `DATABASE_URL` reaches the authoring container (D193), so the script that would have reported the mismatch is the one thing nobody runs. A script only executed in an environment the author cannot reach needs its correctness proved somewhere the author can: statically, in the suite. Parsing the two lists separately rather than as one set is deliberate — a combined parse passes whenever either list is current, which is exactly the state #304 was in.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`app/tests/lib/game/rulesets/capability-seed-parity.test.ts` now asserts `database/verification/0007_capability_seed_checks.sql` against `RULESET_CAPABILITIES` as well as the seed. Its two `VALUES` lists (Step 2's per-triple resolution, Step 4's nothing-else-in-the-table parity) are parsed as separate lists and compared independently, and the triple count the script hardcodes in its Step 1 and Step 2 assertions is derived from the constant rather than read. The generalisation is the rule, not the file: any `database/verification/**` script that restates a TypeScript constant is gated by the test that already owns that constant.".

### Consequences
adding a ruleset version now fails `npm test` until the verification script is updated alongside the seed and the constant, which is one more file per ruleset and is the point. The test parses SQL with regexes and is coupled to the script's present shape: the `VALUES … ) AS declared` framing, and four assertion strings matched literally. Reformatting the script breaks the test rather than silently passing, which is the right failure direction but is a real maintenance cost, and a third `VALUES` list added to the script would fail the two-list assertion until the test is taught about it. The gate proves the script's text agrees with the constant; it still proves nothing about whether the script passes against a live database — `npm run db:verify` remains unrunnable here and currently fails for reasons tracked in #383 and #384.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-17
