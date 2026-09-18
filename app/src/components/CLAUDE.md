# Agent Rules — `app/src/components/`

Scope: Astro components — `ui/`, `forms/`, `layout/`. Load the "Frontend page / component work" or "New portable UI primitive" context pack from `docs/architecture/00-Context-Map.md` before changing anything here. Global app rules and the validation procedure live in `app/CLAUDE.md`. (2026-09-18)

## Style non-negotiables

- Semantic tokens only — `surface` / `foreground` / `muted*` / `accent*` / states; never `bg-bg*` / `text-fg*` or raw palette utilities
- Reuse primitives from `app/src/styles/global.css`; do not reinvent per screen
- **Reuse existing UI components before hand-rolling markup.** A standalone action always renders through `components/forms/Button.astro` (`variant`/`icon`/`ariaLabel`/`loadingExpr`) — never a raw `<button>` with manually composed classes. Check `components/ui/` and `components/forms/` for a fitting component before writing new markup for any recurring UI shape (buttons, modals, form controls). If nothing fits, say so and propose a new component rather than hand-rolling one inline. Exempt: multi-part custom controls a shared primitive cannot express as-is — e.g. roving-tabindex `role="radio"` options carrying a label + checkmark (`AppModeForm.astro`, `HandednessForm.astro`) — which stay raw markup by established precedent. (2026-08-11; AppModeForm's caption dropped 2026-08-26)
- Build-time class composition via `cn()` only — never `class:list` (enforced by `scripts/check-astro-class-composition.sh`)
- Forward leftover attributes as `{...props}` — never `{...rest}`
- Never `font-medium` — use `font-normal` / `font-semibold` / `font-bold`
- Tailwind v4 utilities only — no important modifier at all, neither prefix (`!utility`) nor suffix (`utility!`); compose overrides through `cn()`'s merge ordering, or extend the primitive's own variant/prop surface when its defaults conflict; arbitrary negatives as `left-[-45%]`, never `-left-[45%]`
- Full rules: `docs/architecture/07-Frontend/07-Style-Guide.md` (visual) and `07-Frontend/05-Astro-Components.md` (class composition / props); `font-medium`/`{...rest}`/raw palette utilities/Tailwind important modifier (either form) + `-prop-[…]` mechanically enforced by `scripts/check-style-tokens.sh` (2026-07-31; important-modifier ban widened to suffix form 2026-08-21)

## Alpine

- Alpine v3 shorthand: `:attr`, `@event` — not `x-bind`/`x-on`, except the Astro `{}` linter escape.
- No `x-init`. Use `x-data="factory()"`.
- Every `x-show` needs `x-cloak` (`scripts/check-astro-conventions.sh`); no HTML comments in template regions.
- Keep variant/branching logic inline in the component's own frontmatter — do not extract a helper file solely to make it testable; there is no Astro-component test runner here (D101).
- No `.ts` file lives directly under `components/` (`scripts/check-file-locations.sh`). Shared logic goes to `app/src/lib/<domain>/`.
