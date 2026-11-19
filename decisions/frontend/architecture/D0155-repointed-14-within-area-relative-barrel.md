---
id: D0155
status: accepted
date: 2026-07-26
origin: contemporaneous
original-date:
tags: [frontend/architecture, barrel, types, interfaces]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Repointed 14 within-area relative barrel imports at the area-root alias

## Context and Problem Statement
Owner found the previously-documented blind spot in the wild: rule 3 only inspected aliased (`@`-prefixed) imports, so a validator or route handler could dodge the area-barrel rule with a relative path instead

## Decision Drivers
* Rule 3 of `scripts/check-type-barrels.sh` inspects only aliased (`@`-prefixed) imports, so a relative path dodges the area-barrel rule.
* The script header documented the 14 within-area relative imports as a blind spot, not flagged.

## Considered Options
* Leave the 14 relative imports unflagged, as the script header documented.
* Repoint the 14 imports at the area-root alias and add a fourth gate rule for relative barrel imports (chosen).

## Decision Outcome
Chosen option: "Repointed 14 within-area relative barrel imports at the area-root alias — six `rulesets/*/*.validator.ts` (`../interfaces`→`@services/interfaces`, `../types`→`@services/types`) and two `pages/api/sessions/[sessionId]/**` route handlers (`../types`, `../../types`→`@routes/types`); extended `scripts/check-type-barrels.sh` with a fourth rule failing any relative barrel import that doesn't resolve to the importing file's own folder, closing the gap its own header had documented as uncatchable".

### Consequences
* Good, because rule 4 of `scripts/check-type-barrels.sh` fails any relative barrel import that does not resolve to the importing file's own folder.
* Good, because the repoint changes no behaviour: `pages/api/types.ts` already re-exports both `sessions/types.ts` value exports via `export *`, so the route handlers resolve to the same runtime bindings.
* Bad, because rule 4 skips any line starting with `export` using a line-start check, not a word-boundary check. The script header calls this a theoretical gap, not an observed one.
* Neutral, because barrel files (`types.ts`, `interfaces.ts`) stay exempt from rule 4: raising a direct child and composing a parent's own types are legitimate raising-chain mechanics.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`scripts/check-type-barrels.sh` rule 4 (relative consumption) fails any relative barrel import that does not resolve to the importing file's own folder. The commit records the repoint as a no-behaviour-change edit.

## Pros and Cons of the Options
### Leave the relative imports unflagged
* Good, because the old script header judged within-area relative imports to cross no area boundary, the case the convention cares least about.
* Bad, because a consumer could dodge rule 3 by using a relative path instead of an alias.

### Repoint the imports and add rule 4
* Good, because the gate now catches the relative spelling of the same violation that rule 3 catches for aliases.
* Bad, because of the line-start check in rule 4, which leaves a theoretical gap.

## Evidence / More Information
Decided: 2026-07-26

* Commit `4c258afe` (2026-07-26; adds the D155 row, repoints the 14 imports and extends `scripts/check-type-barrels.sh`): rebuilt every filled section.
