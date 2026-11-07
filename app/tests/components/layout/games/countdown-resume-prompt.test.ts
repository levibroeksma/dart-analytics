import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * `CountdownResumePrompt` is the paused rest screen (#1210): a full-viewport
 * overlay with a glass play symbol at the centre and a rotating tip card
 * above it. `.astro` carries no render test (D101), so this pins the source.
 */
const source = readFileSync(
  new URL(
    "../../../../src/components/layout/games/CountdownResumePrompt.astro",
    import.meta.url,
  ),
  "utf8",
);

const PLAY_PATH =
  "M7.5 5.147c0-.909 1.008-1.457 1.771-.964l10.157 6.553c.792.511.755 1.677-.066 2.137L9.34 19.4c-.797.446-1.777-.13-1.777-1.043z";

describe("CountdownResumePrompt", () => {
  it("covers the viewport", () => expect(source).toContain("fixed inset-0"));
  it("caps the tip card width and centres it", () =>
    expect(source).toMatch(/glass deck-card mx-auto w-full max-w-md/));
  it("slides the tip card out and in like the card deck", () => {
    expect(source).toContain("deck-card");
    expect(source).toContain("'tip-slide-out': slide === 'out'");
    expect(source).toContain("'tip-slide-in': slide === 'in'");
    expect(source).not.toContain("opacity-0");
  });
  it("keeps the resume label", () =>
    expect(source).toContain('ariaLabel="Resume timer"'));
  it("renders the action through Button.astro", () => {
    expect(source).toContain(
      'import Button from "@components/forms/Button.astro"',
    );
    expect(source).not.toMatch(/<button\b/);
  });
  it("draws the glass play path", () => expect(source).toContain(PLAY_PATH));
  it("gives each instance its own gradient ids", () => {
    expect(source).not.toMatch(/id="paused-play-/);
    expect(source).not.toMatch(/url\(#paused-play-/);
    expect(source).toMatch(/id=\{fillId\}/);
    expect(source).toMatch(/id=\{edgeId\}/);
  });
  it("shows no hover fill behind the symbol", () =>
    expect(source).toContain("hover:bg-transparent"));
  it("drops the old icon, circle and blue", () => {
    expect(source).not.toContain("play-solid.svg");
    expect(source).not.toContain("text-accent ");
    expect(source).not.toContain("rounded-full");
  });
  it("rotates tips while paused", () => {
    expect(source).toContain("pausedTips(");
    expect(source).toMatch(
      /x-effect=\{`\(\$\{pausedExpr\}\) \? start\(\) : stop\(\)`\}/,
    );
  });
  it("uses the play glass tokens", () => {
    for (const name of [
      "--play-glass-fill-top",
      "--play-glass-fill-bottom",
      "--play-glass-edge-top",
      "--play-glass-edge-mid",
      "--play-glass-edge-bottom",
      "--play-glass-shadow",
    ])
      expect(source, name).toContain(`var(${name})`);
  });
});
