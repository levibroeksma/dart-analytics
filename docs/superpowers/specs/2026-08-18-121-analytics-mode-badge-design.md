<!--
status: canonical
scope: games-index analytics-mode indicator
read-when: implementing issue #121
updated: 2026-08-18
-->

# Design: Analytics-mode badge (issue #121)

## Problem

`/games` currently shows a full-width explanatory text block when analytics mode is active ("Analytics mode — only games that support it are shown."). Redundant — replace with a small blue pill-tag reading "analytics", inline with the page title, top-right.

## Scope

- New reusable primitive: `app/src/components/ui/Badge.astro`.
- `app/src/pages/games/index.astro`: remove the text block, add the badge inline with the `<h1>`.

No engine/schema/API change — pure display-layer, matching the 1.7.42-precedent class of fix (no new `decisions/**` entry needed; this is straightforward component reuse per already-decided styling patterns).

## Design

### `Badge.astro`

New file, `components/ui/` (portable, app-agnostic primitive, paired conceptually with the style guide's own prescribed-but-never-built `Badge.astro` replacement for the retired `.badge`/`.badge-accent`/`.badge-muted` classes).

```astro
---
interface Props {
  variant?: "accent" | "error" | "neutral";
  class?: string;
}

// Props
const { variant = "accent", class: classNameProp }: Props = Astro.props;

// Lib
import { cn } from "@client/cn";

// Styles
const variantClasses = {
  accent: "border border-accent/25 bg-accent-muted text-accent",
  error: "border border-error/25 bg-error-muted text-error",
  neutral: "bg-surface-overlay text-muted-foreground",
}[variant];

const className = cn(
  "inline-flex items-center rounded-full px-2.5 py-0.5 font-semibold",
  variantClasses,
  classNameProp,
);
---

<span class={className}><slot /></span>
```

Deviations from a hand-rolled one-off: `cn()` instead of `class:list` (mechanically enforced by `scripts/check-astro-class-composition.sh`); `font-semibold` instead of `font-medium` (forbidden token, `07-Style-Guide.md`); no `"badge"` literal class token — no such primitive exists in `global.css` to key off, and this is the first consumer. Text size is deliberately not baked into the base classes — a badge's size varies by context (inline with a page title vs. inline with body text), so it's left to the caller's `class` prop, merged last via `cn()`.

Default `variant="accent"` renders the sky/blue treatment the issue asks for ("UI blue"), so the games-index call site passes no `variant` prop.

`cn()` lives at `app/src/lib/client/cn.ts`, imported everywhere else in `components/ui/` and `components/forms/` as `@client/cn` (confirmed against existing call sites, e.g. `Modal.astro`, `Link.astro`) — not `@utils/cn`.

### `games/index.astro`

Remove:

```astro
<p
  class="alert rounded-md border border-border px-4 py-3 text-sm text-muted-foreground"
  x-show="analyticsMode()"
  x-cloak
>
  Analytics mode — only games that support it are shown.
</p>
```

Replace the standalone `<h1>` with a flex row pairing it against the badge:

```astro
<div class="flex items-center justify-between">
  <h1 class="text-xl font-semibold text-foreground">Games</h1>
  <Badge
    class="text-xs"
    x-show="analyticsMode()"
    x-cloak
  >
    analytics
  </Badge>
</div>
```

- Badge text stays lowercase `analytics`, matching the issue's own wording.
- `x-show`/`x-cloak` pairing preserved exactly as the removed block had it (Non-Negotiable Rule #2, `10-Frontend-Agent-Guide.md`) — same `analyticsMode()` getter, no new Alpine wiring needed.
- Import `Badge` under the existing `// Components` frontmatter group in `games/index.astro`.

## Testing

No new `.ts` logic — `Badge.astro` is presentational only, and `.astro` markup/branching logic is untested per `app/CLAUDE.md`/D101 (no Astro-component test runner in this project). Verification is `astro check` (0 errors) + manual/browser confirmation that:

1. Analytics mode on: badge shows top-right inline with "Games", no text block.
2. Analytics mode off: neither renders.

## Out of scope

- No changes to `analyticsMode()`, `gamesIndex()`, or any store.
- No other consumer of `Badge.astro` in this task — it's built as the reusable primitive the style guide already names, but only games-index wires it up now.
