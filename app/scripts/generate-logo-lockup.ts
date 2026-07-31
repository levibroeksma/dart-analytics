/**
 * Build logo-lockup.svg: bg-dartboard mark + outlined Michroma "Darts"/"Analytics".
 * Spec: docs/superpowers/specs/2026-07-31-logo-lockup-svg-design.md
 *
 * Run: npm run logo:generate
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import opentype from "opentype.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const appRoot = resolve(__dirname, "..");
const boardPath = resolve(appRoot, "src/assets/bg-dartboard.svg");
const fontPath = resolve(__dirname, "assets/Michroma-Regular.ttf");
const outPath = resolve(appRoot, "src/assets/logo-lockup.svg");

const ACCENT = "oklch(68.5% 0.169 237.323)";
const BOARD_PX = 80;
const FONT_SIZE = 24;
const GAP = 4;
const LINE_GAP = 4;

type OpenTypeFont = ReturnType<typeof opentype.parse>;

/**
 * Strip the source SVG wrapper while preserving its mark geometry and fills.
 *
 * @param svgText - Complete dartboard SVG source.
 * @returns Inner SVG markup.
 */
function boardInner(svgText: string): string {
  return svgText
    .replace(/^[\s\S]*?<svg[^>]*>/i, "")
    .replace(/<\/svg>\s*$/i, "")
    .trim();
}

/**
 * Outline simple Latin text without invoking unsupported GSUB substitutions.
 *
 * @param font - Parsed Michroma font.
 * @param text - Text to outline.
 * @param fontSize - Font size in output units.
 * @param x - Starting x coordinate.
 * @param y - Baseline y coordinate.
 * @returns Combined SVG path data.
 */
function pathFromGlyphs(
  font: OpenTypeFont,
  text: string,
  fontSize: number,
  x: number,
  y: number,
): string {
  const scale = fontSize / font.unitsPerEm;
  let cursorX = x;

  return Array.from(text)
    .map((character, index, characters) => {
      const glyph = font.charToGlyph(character);
      const pathData = glyph.getPath(cursorX, y, fontSize).toPathData(2);
      const nextCharacter = characters[index + 1];

      cursorX += (glyph.advanceWidth ?? 0) * scale;
      if (nextCharacter) {
        cursorX +=
          font.getKerningValue(glyph, font.charToGlyph(nextCharacter)) * scale;
      }

      return pathData;
    })
    .join("");
}

/**
 * Measure simple Latin text using the same glyph advances as the outline path.
 *
 * @param font - Parsed Michroma font.
 * @param text - Text to measure.
 * @param fontSize - Font size in output units.
 * @returns Text width in output units.
 */
function textWidth(font: OpenTypeFont, text: string, fontSize: number): number {
  const scale = fontSize / font.unitsPerEm;
  const characters = Array.from(text);

  return characters.reduce((width, character, index) => {
    const glyph = font.charToGlyph(character);
    const nextCharacter = characters[index + 1];
    const kerning = nextCharacter
      ? font.getKerningValue(glyph, font.charToGlyph(nextCharacter))
      : 0;

    return width + ((glyph.advanceWidth ?? 0) + kerning) * scale;
  }, 0);
}

function main(): void {
  const boardSvg = readFileSync(boardPath, "utf8");
  const font = opentype.parse(readFileSync(fontPath).buffer);
  // Board source viewBox is 440×440 centered on 0; scale into 80×80 box at origin.
  const boardScale = BOARD_PX / 440;
  const markX = BOARD_PX / 2;
  const markY = BOARD_PX / 2;

  const textX = BOARD_PX + GAP;
  const line1 = "Darts";
  const line2 = "Analytics";
  // Baseline: roughly center stack against 80px mark (Michroma metrics ~0.8 em).
  const stackHeight = FONT_SIZE * 2 + LINE_GAP;
  const firstBaseline = (BOARD_PX - stackHeight) / 2 + FONT_SIZE * 0.8;
  const secondBaseline = firstBaseline + FONT_SIZE + LINE_GAP;

  const d1 = pathFromGlyphs(font, line1, FONT_SIZE, textX, firstBaseline);
  const d2 = pathFromGlyphs(font, line2, FONT_SIZE, textX, secondBaseline);

  const wordmarkWidth = Math.max(
    textWidth(font, line1, FONT_SIZE),
    textWidth(font, line2, FONT_SIZE),
  );
  const width = Math.ceil(textX + wordmarkWidth);
  const height = BOARD_PX;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 ${width} ${height}" style="max-width:100%;height:auto;display:block">
  <g id="mark" transform="translate(${markX} ${markY}) scale(${boardScale})">
    ${boardInner(boardSvg)}
  </g>
  <g id="wordmark" fill="${ACCENT}">
    <path d="${d1}"/>
    <path d="${d2}"/>
  </g>
</svg>
`;

  writeFileSync(outPath, svg);
  console.log(`Wrote ${outPath} (${width}×${height})`);
}

main();
