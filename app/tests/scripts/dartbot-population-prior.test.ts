import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { toMissMarginInputs } from "../../scripts/dartbot-population-prior";
import { foldPopulationPrior } from "@modules/dartbot/population-prior.module";

describe("toMissMarginInputs", () => {
  it("camel-cases fields and coerces stringly numeric locations", () => {
    const [row] = toMissMarginInputs([
      {
        intended_target_number: 20,
        intended_zone_key: "DOUBLE",
        location_x: "1.5",
        location_y: "-2.5",
      },
    ]);
    expect(row).toEqual({
      intendedTargetNumber: 20,
      intendedZoneKey: "DOUBLE",
      locationX: 1.5,
      locationY: -2.5,
    });
  });

  it("passes through an already-numeric location unchanged", () => {
    const [row] = toMissMarginInputs([
      {
        intended_target_number: 20,
        intended_zone_key: "DOUBLE",
        location_x: 1.5,
        location_y: -2.5,
      },
    ]);
    expect(row).toEqual({
      intendedTargetNumber: 20,
      intendedZoneKey: "DOUBLE",
      locationX: 1.5,
      locationY: -2.5,
    });
  });

  it("keeps a null location null rather than coercing it to zero", () => {
    const [row] = toMissMarginInputs([
      {
        intended_target_number: null,
        intended_zone_key: null,
        location_x: null,
        location_y: null,
      },
    ]);
    expect(row).toEqual({
      intendedTargetNumber: null,
      intendedZoneKey: null,
      locationX: null,
      locationY: null,
    });
  });
});

describe("D-E-extract.json", () => {
  const path = fileURLToPath(
    new URL("../../../D-E-extract.json", import.meta.url),
  );
  const rows = JSON.parse(readFileSync(path, "utf8")) as unknown[];

  it("holds the 328-row PLAYER-only extract, already zone-key-joined", () => {
    expect(rows).toHaveLength(328);
    expect(rows[0]).toMatchObject({
      intended_target_number: expect.any(Number),
      intended_zone_key: expect.any(String),
      location_x: expect.any(Number),
      location_y: expect.any(Number),
    });
  });
});

describe("D-E-extract-v2-doubles-trebles.json", () => {
  const path = fileURLToPath(
    new URL("../../../D-E-extract-v2-doubles-trebles.json", import.meta.url),
  );
  const rows = JSON.parse(readFileSync(path, "utf8")) as Parameters<
    typeof toMissMarginInputs
  >[0];
  const prior = foldPopulationPrior(toMissMarginInputs(rows));
  const within = (actual: number, expected: number, tolerance: number) =>
    Math.abs(actual - expected) <= tolerance;

  it("folds 2,230 located darts into the v2 clipped pooled fit", () => {
    expect(rows).toHaveLength(2230);
    expect(prior.sampleSize).toBe(2230);
    expect(within(prior.sigmaAlongMm, 29.5, 0.1)).toBe(true);
    expect(within(prior.sigmaAcrossMm, 23.5, 0.1)).toBe(true);
    expect(within(prior.biasXMm, -1.2, 0.1)).toBe(true);
    expect(within(prior.biasYMm, -1.6, 0.1)).toBe(true);
    expect(within(prior.outlierRate, 41 / 2230, 0.001)).toBe(true);
  });
});
