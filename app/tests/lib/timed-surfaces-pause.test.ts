import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const LIB = join(__dirname, "../../src/lib");
const TIMER_START = /new SegmentTimer\(|startCountdown\(/;
const HELPER = "game/play-countdown.ts";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return path.endsWith(".ts") ? [path] : [];
  });
}

describe("timed surfaces pause", () => {
  const timed = sourceFiles(LIB)
    .map((path) => ({
      file: relative(LIB, path),
      source: readFileSync(path, "utf8"),
    }))
    .filter(({ file, source }) => file !== HELPER && TIMER_START.test(source));

  it("finds the known timed play files", () => {
    expect(timed.map(({ file }) => file).sort()).toEqual([
      "game/around-the-clock-play.data.ts",
      "game/one-twenty-one-play.data.ts",
      "game/score-training-play.data.ts",
      "game/tuod-play.data.ts",
      "training/routines/routine-play.data.ts",
      "training/trivia/quick-subtract-play.data.ts",
    ]);
  });

  it.each(timed.map(({ file, source }) => [file, source]))(
    "%s owns a togglePause for the timer it starts",
    (_file, source) => {
      expect(source).toMatch(/togglePause\s*[(:]/);
    },
  );
});
