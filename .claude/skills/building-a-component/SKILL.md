---
name: building-a-component
description: Use when creating or changing a shared .astro component or page markup under app/src/components or app/src/pages — a new button, modal, form control, card, or any recurring UI shape.
paths: ["app/src/components/**", "app/src/pages/**"]
---

# Building a Component

Guide only. Enforcement lives elsewhere; this skill points, never restates.

## Steps

1. **Look up.** Grep `docs/architecture/07-Frontend/08-Component-Inventory.md` for the UI shape (never read whole). Also check `components/ui/` and `components/forms/`.
2. **Reuse, or say why not.** A fitting component is used as-is. If none fits, state in one line why, then propose a new shared component rather than inline markup. Third copy of a shape triggers extraction: `.claude/rules/reuse.md` (D512).
3. **Apply the checklist** (pointers, not rules):

| Concern | Canonical source |
| ------- | ---------------- |
| Alpine shorthand, spread bind for `{}` expressions, expression props | `docs/architecture/07-Frontend/03-Alpine-Patterns.md` §Binding Rules |
| `x-show` + `x-cloak` pairing | `07-Frontend/05-Astro-Components.md` §Anti-Patterns; `07-Style-Guide.md` §Interactivity |
| Class composition with `cn()` | `07-Frontend/05-Astro-Components.md` §Class Composition |
| Colour, spacing, surfaces, motion tokens | `07-Frontend/07-Style-Guide.md` §Tokens |
| Standalone actions via `Button.astro` | `app/src/components/CLAUDE.md` |

4. **Register.** A new shared component gets a row in `08-Component-Inventory.md` in the same change.

## What enforces

- `.claude/hooks/edit-gate.py` refuses edits that introduce gate violations (e.g. `x-bind:`).
- `.claude/hooks/reuse-lookup.py` lists existing matches before a new file under components/lib/modules/types.
- `scripts/check-dupes.sh` fails CI on a new clone group.
