import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const appRoot = fileURLToPath(new URL("../../../", import.meta.url));
const read = (path: string) => readFileSync(join(appRoot, path), "utf8");

describe("catalog primitives (static source)", () => {
  it("Tag uses the tag class and no inline colour literals", () => {
    const src = read("src/components/ui/Tag.astro");
    expect(src).toMatch(/\btag\b/);
    expect(src).not.toMatch(/oklch\(|#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/);
    expect(src).not.toMatch(/style=/);
  });

  it("DifficultyMeter emits four bars and an accessible root", () => {
    const src = read("src/components/ui/DifficultyMeter.astro");
    expect(src).toMatch(/\[1, 2, 3, 4\]/);
    expect(src).toMatch(/meter-bar/);
    expect(src).toMatch(/role="img"/);
    expect(src).toMatch(/aria-label/);
    expect(src).toMatch(/title/);
    expect(src).toMatch(/aria-hidden="true"/);
  });

  it("DifficultyLegend labels the four levels", () => {
    const src = read("src/components/ui/DifficultyLegend.astro");
    for (const label of ["BEGINNER", "INTERMEDIATE", "ADVANCED", "EXPERT"]) {
      expect(src).toContain(label);
    }
  });

  it("global.css disables card-dart transitions under reduced motion", () => {
    const css = read("src/styles/global.css");
    const block = css.match(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[^@]*?\.card-dart\b[^@]*?\}/,
    );
    expect(block).not.toBeNull();
    expect(block?.[0]).toMatch(/transition:\s*none/);
    expect(block?.[0]).toMatch(/transform:\s*rotate\(-45deg\)/);
    expect(block?.[0]).toMatch(/opacity:\s*0\.45/);
  });

  it("global.css applies card-dart-hover only inside hover: hover", () => {
    const css = read("src/styles/global.css");
    const index = css.indexOf(".card-dart-hover");
    expect(index).toBeGreaterThan(-1);
    const before = css.slice(0, index);
    const open = before.lastIndexOf("@media (hover: hover)");
    expect(open).toBeGreaterThan(-1);
    const between = before.slice(open);
    const opens = (between.match(/\{/g) ?? []).length;
    const closes = (between.match(/\}/g) ?? []).length;
    expect(opens).toBeGreaterThan(closes);
  });

  it("CatalogCard game variant is a link and the exercise variant a div", () => {
    const src = read("src/components/ui/CatalogCard.astro");
    expect(src).toMatch(/<a\b/);
    expect(src).toMatch(/<div\b/);
    expect(src).toContain("cardThrow()");
  });

  it("CatalogCard requires href for the game variant", () => {
    const src = read("src/components/ui/CatalogCard.astro");
    expect(src).toMatch(/variant:\s*"game";\s*href:\s*string/);
  });

  it("only motion.ts under lib/ui mentions prefers-reduced-motion", () => {
    const dir = join(appRoot, "src/lib/ui");
    const offenders = readdirSync(dir)
      .filter((f) => f.endsWith(".ts") && f !== "motion.ts")
      .filter((f) =>
        readFileSync(join(dir, f), "utf8").includes("prefers-reduced-motion"),
      );
    expect(offenders).toEqual([]);
  });
});
