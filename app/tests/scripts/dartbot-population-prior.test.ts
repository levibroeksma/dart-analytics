import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { toMissMarginInputs } from "../../scripts/dartbot-population-prior";

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
