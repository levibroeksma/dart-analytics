<!--
status: canonical
scope: decisions/frontend/style
read-when: why a CSS token/primitive/typography/spacing choice was made
load-when: style, CSS, token, Tailwind, primitive, typography, spacing, glass, surface, PWA, manifest, icon, safe-area, font, colour, dark mode, motion, accessibility
depends-on: decisions/frontend/architecture.md
related: decisions/frontend/astro.md
updated: 2026-08-03
-->

| # | Source | Decision | Rationale |
| - | ------ | -------- | --------- |
| D108 | 2026-07-16 | Canonical style guide introduced (`07-Frontend/07-Style-Guide.md`) documenting the dark-only token/primitive/typography/motion contract already implemented in `global.css`; audit fixed three `font-medium` violations (`.btn`/`.badge`/`.nav-item` → `font-semibold`), added `--color-accent-muted` (`.badge-accent` had been borrowing `success-muted`), and replaced `NavBtn.astro`'s manual class-merge with `cn()` | Token/primitive system existed only as unregistered tribal knowledge in one CSS file; writing the canonical doc surfaced concrete, fixable drift |
| D126 | 2026-07-22 | Style guide rewritten to sky/glass/`surface`/`foreground` vocabulary matching finalized Score Training UI; legacy `fg`/`bg-bg`/old `.surface`/`.nav-item`/`.badge` doc contract retired; `font-medium` ban retained | Docs had drifted from `global.css` and live UI |
| D129 | 2026-07-22 | Fallow `ignorePatterns` for unwired design-system Astro primitives under `src/components/ui/` (and `CustomTabs.astro`) until PR2 route adoption; health `thresholdOverrides` for `CardWrapper`/`ScoreInput` templates | PR1 ships the kit + gates without deleting unused primitives fallow would flag |
| D130 | 2026-07-22 | Retire D129: delete unwired `components/ui` primitives + `CustomTabs`; keep only route-wired Modal/ConfirmDialog/LogoutButton/IsLoading/Link/CardWrapper; CSS primitives remain in `global.css` | Fallow ignore was temporary until PR2 adoption-or-delete |
| D161 | 2026-07-28 | New `scripts/check-style-tokens.sh` bans `font-medium`, `{...rest}`, and raw `bg-bg*`/`text-fg*` palette utilities across `app/src/**/*.{astro,css}` | Mechanizes the Style non-negotiables in app/CLAUDE.md (D108/D126/D128), previously enforced only by human review of the diff |
| D174 | 2026-07-29 | `body` in `global.css` pads `padding-top: env(safe-area-inset-top)` alongside its existing `h-dvh max-h-dvh overflow-hidden` | `black-translucent` status bar style + `viewport-fit=cover` (D173) already draw content edge-to-edge; with no safe-area inset anywhere in the codebase, header/title content collided with the iOS status bar's clock/battery/signal icons in a standalone-launched web app |
| D175 | 2026-07-31 | `scripts/check-style-tokens.sh` also bans Tailwind v3 prefix-important (`!utility`) and leading-dash arbitrary negatives (`-prop-[…]`) in favor of v4 `utility!` / `prop-[-…]` | Agents repeatedly landed deprecated forms; prose in the Style Guide was not enough — same latency pattern as D161. Shipped id is D175, not D174 — D174 was already taken by the 2026-07-29 safe-area-inset decision |
| D176 | 2026-07-31 | Brand icon and lockup generators are checked in with their generated app assets; icon rasterization converts `oklch()` to sRGB for Resvg; `favicon.ico` remains a browser fallback but is omitted from the web manifest after its entry was mistyped as PNG | Deterministic regeneration keeps source and committed outputs reviewable; Resvg otherwise renders the board black; manifest metadata must describe each asset truthfully |
