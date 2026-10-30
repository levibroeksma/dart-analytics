---
paths: ["app/src/**"]
---

# Rule of three (D512)

Writing the same markup shape, type, or logic block a third time: stop. Extract a shared component, helper, or type first, then migrate the other two copies to it.

- Find existing ones before writing new:
  - Markup: `docs/architecture/07-Frontend/08-Component-Inventory.md`.
  - TS: the graph (`graph-lookup` skill) or `git grep`.
- Two copies are tolerated; the third is the trigger.
- `bash scripts/check-dupes.sh` fails on any new clone group, and on a baseline row that can be lowered (ratchet). Lower with `--update` only when duplication went down.
- Do not hide a clone by editing the baseline upward.
