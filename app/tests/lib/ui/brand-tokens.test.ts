import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  new URL("../../../src/styles/global.css", import.meta.url),
  "utf8",
);

function decl(name: string): string | undefined {
  return css.match(new RegExp(`^\\s*--${name}:\\s*([^;]+);`, "m"))?.[1].trim();
}

describe("brand colour tokens", () => {
  it("uses coral as the error hue", () => {
    expect(decl("error")).toBe("oklch(68% 0.15 30)");
    expect(decl("error-hover")).toBe("oklch(63% 0.15 30)");
    expect(decl("error-muted")).toBe("oklch(68% 0.15 30 / 0.12)");
    expect(decl("error-foreground")).toBe("oklch(96% 0.01 30)");
  });

  it("aliases missed to error", () => {
    expect(decl("missed")).toBe("var(--error)");
    expect(decl("missed-muted")).toBe("var(--error-muted)");
  });

  it.each([
    ["placeholder", "oklch(48% 0 0)"],
    ["accent-deep-blue", "oklch(44.3% 0.11 240.79)"],
    ["scrim", "oklch(0% 0 0 / 0.6)"],
  ])("defines --%s", (name, value) => {
    expect(decl(name)).toBe(value);
  });

  it("defines the blue glass gradient", () => {
    expect(decl("gradient-blue-glass")).toMatch(
      /^linear-gradient\(\s*138deg,\s*oklch\(47% 0\.13 238 \/ 0\.95\) 22%,\s*oklch\(18% 0\.06 245 \/ 0\.95\) 82%\s*\)$/,
    );
  });

  it.each([
    ["color-placeholder", "var(--placeholder)"],
    ["color-accent-deep-blue", "var(--accent-deep-blue)"],
    ["color-scrim", "var(--scrim)"],
    ["background-image-blue-glass", "var(--gradient-blue-glass)"],
  ])("maps --%s in @theme", (name, value) => {
    expect(decl(name)).toBe(value);
  });

  it("vignette reads the deep-blue token", () => {
    expect(css).not.toMatch(/oklch\(44\.3% 0\.11 240\.79 \/ 0\.3\)/);
    expect(css).toMatch(
      /color-mix\(in oklch, var\(--accent-deep-blue\) 30%, transparent\)/,
    );
  });
});

describe("brand type scale", () => {
  it.each([
    ["hero", "4.5rem", "1", "-0.02em"],
    ["title", "1.625rem", "1.2", "0.02em"],
    ["value", "1.875rem", "1", "0"],
    ["tile", "1.25rem", "1.2", "0"],
    ["card-title", "0.8125rem", "1.3", "0.06em"],
    ["button", "0.9375rem", "1.3", "0"],
    ["eyebrow", "0.625rem", "1.2", "0.12em"],
    ["eyebrow-lg", "0.75rem", "1.2", "0.14em"],
  ])("defines text-%s", (name, size, lh, ls) => {
    expect(decl(`text-${name}`)).toBe(size);
    expect(decl(`text-${name}--line-height`)).toBe(lh);
    expect(decl(`text-${name}--letter-spacing`)).toBe(ls);
  });
});

describe("brand radius and spacing", () => {
  it.each([
    ["radius-row", "0.875rem"],
    ["radius-key", "1.375rem"],
    ["radius-switch", "1.625rem"],
    ["radius-board", "1.75rem"],
    ["radius-sheet", "2rem"],
    ["spacing-hit", "2.75rem"],
  ])("defines --%s", (name, value) => {
    expect(decl(name)).toBe(value);
  });
});

function block(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`${selector} not found`);
  return css.slice(start, css.indexOf("\n}", start) + 2);
}

describe("brand surfaces", () => {
  it("glass has no drop shadow", () => {
    expect(block("@utility glass")).not.toMatch(/shadow-sm/);
  });

  it.each([
    "@utility glass-blue",
    "@utility glass-info",
    "@utility inset-well",
    "@utility inset-well-muted",
    "@utility glass-sheet",
  ])("defines %s", (selector) => {
    expect(() => block(selector)).not.toThrow();
  });

  it("glass-blue and accent-orb read the gradient token", () => {
    expect(block("@utility glass-blue")).toMatch(
      /var\(--gradient-blue-glass\)/,
    );
    expect(css).toMatch(
      /\.accent-orb \{\s*background: var\(--gradient-blue-glass\);/,
    );
  });

  it("inset-well is black 35% with inner shadow", () => {
    const b = block("@utility inset-well");
    expect(b).toMatch(/background: oklch\(0% 0 0 \/ 0\.35\)/);
    expect(b).toMatch(/inset 0 1px 2px oklch\(0% 0 0 \/ 0\.4\)/);
  });

  it("inset-well has no backdrop blur, so it stays dark inside a blurred glass parent", () => {
    expect(block("@utility inset-well")).not.toMatch(/backdrop-blur/);
  });

  it("inset-well-muted is black 20%", () => {
    expect(block("@utility inset-well-muted")).toMatch(
      /oklch\(0% 0 0 \/ 0\.2\)/,
    );
  });

  it("glass-sheet uses the sheet radius and 16px blur", () => {
    const b = block("@utility glass-sheet");
    expect(b).toMatch(/rounded-sheet/);
    expect(b).toMatch(/backdrop-blur-lg/);
  });

  it("field-inset rests on inset-well and keeps its focus ring", () => {
    expect(css).toMatch(/\.field-inset \{\s*@apply inset-well;\s*\}/);
    expect(css).toMatch(/\.field-inset:focus \{/);
  });
});

function oklchContrast(a: string, b: string): number {
  const luminance = (value: string): number => {
    const m = value.match(/oklch\(([\d.]+)% ([\d.]+) ([\d.]+)\)/);
    if (!m) throw new Error(`not an opaque oklch: ${value}`);
    const L = Number(m[1]) / 100;
    const C = Number(m[2]);
    const h = (Number(m[3]) * Math.PI) / 180;
    const A = C * Math.cos(h);
    const B = C * Math.sin(h);
    const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
    const mm = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
    const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
    const clamp = (x: number) => Math.min(Math.max(x, 0), 1);
    const r = clamp(4.0767416621 * l - 3.3077115913 * mm + 0.2309699292 * s);
    const g = clamp(-1.2684380046 * l + 2.6097574011 * mm - 0.3413193965 * s);
    const bl = clamp(-0.0041960863 * l - 0.7034186147 * mm + 1.707614701 * s);
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [lo, hi] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (hi + 0.05) / (lo + 0.05);
}

describe("solid error fill", () => {
  const button = readFileSync(
    new URL("../../../src/components/forms/Button.astro", import.meta.url),
    "utf8",
  );
  const iconBtn = readFileSync(
    new URL("../../../src/components/forms/IconBtn.astro", import.meta.url),
    "utf8",
  );

  it.each(["error-strong", "error-strong-hover"])(
    "--%s keeps error-foreground at AA (4.5:1)",
    (name) => {
      const fill = decl(name);
      const text = decl("error-foreground");
      if (!fill || !text)
        throw new Error(`missing --${name} or --error-foreground`);
      expect(oklchContrast(fill, text)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("Button and IconBtn error variants fill with error-strong", () => {
    expect(button).toMatch(
      /error: "bg-error-strong text-error-foreground btn-error"/,
    );
    expect(iconBtn).toMatch(
      /error: "border-transparent bg-error-strong text-error-foreground btn-error"/,
    );
  });
});

describe("sheet motion", () => {
  it("defines the sheet entrance animation on the ease-out curve", () => {
    expect(decl("animate-sheet-in")).toBe("sheet-in 200ms var(--ease-out)");
  });

  it("slides the sheet up from a faded, offset start", () => {
    expect(css).toMatch(
      /@keyframes sheet-in\s*\{\s*from\s*\{\s*opacity:\s*0;\s*transform:\s*translateY\(1\.5rem\);\s*\}\s*\}/,
    );
  });
});

describe("hero glow", () => {
  it("tints the hero text glow with the accent", () => {
    expect(decl("text-shadow-glow")).toBe(
      "0 4px 30px oklch(68.5% 0.169 237.323 / 0.35)",
    );
  });
});

describe("login surfaces", () => {
  it("defines the card drop shadow", () => {
    expect(decl("shadow-card")).toBe("0 24px 60px oklch(0% 0 0 / 0.4)");
  });

  it("draws a coral inset ring on an errored inset field", () => {
    expect(css).toMatch(
      /\.field-inset-error \{\s*box-shadow:\s*inset 0 1px 2px oklch\(0% 0 0 \/ 0\.4\),\s*inset 0 0 0 1px var\(--error\);\s*\}/,
    );
  });

  it("keeps the focus ring above the error ring", () => {
    expect(css.indexOf(".field-inset-error {")).toBeGreaterThan(-1);
    expect(css).not.toMatch(/\.field-inset-error:focus/);
  });
});

describe("game play surfaces", () => {
  it.each([
    "@utility glass-active-seat",
    "@utility input-well",
    "@utility key-press",
    "@utility next-dart-ring",
    "@utility target-key-ring",
    "@utility pip-on",
    "@utility board-dim",
    "@utility glass-pill",
  ])("defines %s", (selector) => {
    expect(() => block(selector)).not.toThrow();
  });

  it("tints the active seat card accent 18% to 4% over the glass wash, with a glow", () => {
    const b = block("@utility glass-active-seat");
    expect(b).toMatch(
      /color-mix\(in oklch, var\(--accent\) 18%, transparent\)/,
    );
    expect(b).toMatch(/color-mix\(in oklch, var\(--accent\) 4%, transparent\)/);
    expect(b).toMatch(/border-white\/25/);
    expect(b).toMatch(
      /box-shadow:\s*0 0 18px 2px color-mix\(in oklch, var\(--accent\) 30%, transparent\)/,
    );
  });

  it("input-well is a glass board-radius well that fills the column", () => {
    expect(block("@utility input-well")).toMatch(
      /@apply glass rounded-board flex-1 min-h-0 gap-2 p-2\.5;/,
    );
  });

  it("key-press rings the key in accent on :active, with no scale", () => {
    const b = block("@utility key-press");
    expect(b).toMatch(/transition: box-shadow 120ms var\(--ease-out\)/);
    expect(b).toMatch(/&:active:not\(:disabled\)/);
    expect(b).toMatch(
      /inset 0 0 0 1px color-mix\(in oklch, var\(--accent\) 60%, transparent\)/,
    );
    expect(b).not.toMatch(/scale/);
  });

  it("next-dart-ring is an accent/70 inset ring with an accent/30 glow on a well", () => {
    const b = block("@utility next-dart-ring");
    expect(b).toMatch(/background: oklch\(0% 0 0 \/ 0\.35\)/);
    expect(b).toMatch(
      /inset 0 0 0 1px color-mix\(in oklch, var\(--accent\) 70%, transparent\)/,
    );
    expect(b).toMatch(
      /0 0 10px color-mix\(in oklch, var\(--accent\) 30%, transparent\)/,
    );
  });

  it("target-key-ring keeps the accent ring but drops the glow", () => {
    const b = block("@utility target-key-ring");
    expect(b).toMatch(
      /inset 0 0 0 1px color-mix\(in oklch, var\(--accent\) 70%, transparent\)/,
    );
    expect(b).not.toMatch(/0 0 10px/);
  });

  it("glass-pill is the glass-button wash over a dark base, blurred", () => {
    const b = block("@utility glass-pill");
    expect(b).toMatch(
      /oklch\(100% 0 0 \/ 0\.16\) 85%\s*\),\s*oklch\(4% 0\.01 245 \/ 0\.6\)/,
    );
    expect(b).toMatch(/border-top-color: oklch\(100% 0 0 \/ 0\.35\)/);
    expect(b).toMatch(/border-bottom-color: oklch\(100% 0 0 \/ 0\.15\)/);
    expect(b).toMatch(/box-shadow: 0 2px 8px oklch\(0% 0 0 \/ 0\.35\)/);
    expect(b).toMatch(/backdrop-blur-sm/);
  });

  it("pip-on is accent with an accent/40 glow", () => {
    const b = block("@utility pip-on");
    expect(b).toMatch(/background: var\(--accent\)/);
    expect(b).toMatch(
      /box-shadow:\s*0 0 6px color-mix\(in oklch, var\(--accent\) 40%, transparent\)/,
    );
  });

  it("board-dim desaturates and darkens the board", () => {
    expect(block("@utility board-dim")).toMatch(
      /filter: saturate\(0\.55\) brightness\(0\.75\)/,
    );
  });

  it("defines the magnifier drop shadow", () => {
    expect(decl("shadow-magnifier")).toBe("0 8px 24px oklch(0% 0 0 / 0.6)");
  });
});
