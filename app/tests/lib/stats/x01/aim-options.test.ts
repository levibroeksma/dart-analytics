import { describe, expect, it } from "vitest";
import { aimOptionsFromDrift } from "@lib/stats/x01/aim-options";

const row = { n: 1 };

describe("aimOptionsFromDrift", () => {
  it("lists distinct aims by kind then number after All aims", () => {
    const options = aimOptionsFromDrift({
      "FINISH|DOUBLE:16|1|SOLE": row,
      "LARGE_TARGET|TREBLE:20|1|SOLE": row,
      "LARGE_TARGET|TREBLE:20|2|SOLE": row,
      "SETUP|WIRE:20-1|2|NEAREST": row,
    });
    expect(options.map((o) => o.label)).toEqual([
      "All aims",
      "T20",
      "D16",
      "20/1 wire",
    ]);
    expect(options[0].value).toBeNull();
    expect(options[1].value).toBe("TREBLE:20");
  });

  it("orders numbers within a kind and puts bulls before wires", () => {
    const options = aimOptionsFromDrift({
      "A|WIRE:5-20|1|SOLE": row,
      "A|INNER_BULL:25|1|SOLE": row,
      "A|DOUBLE:20|1|SOLE": row,
      "A|DOUBLE:3|1|SOLE": row,
    });
    expect(options.map((o) => o.label)).toEqual([
      "All aims",
      "D3",
      "D20",
      "Bull",
      "5/20 wire",
    ]);
  });

  it("empty rows give only All aims, AMBIGUOUS is not an aim", () => {
    expect(aimOptionsFromDrift({}).map((o) => o.label)).toEqual(["All aims"]);
    expect(
      aimOptionsFromDrift({ AMBIGUOUS: { darts: 3 } }).map((o) => o.label),
    ).toEqual(["All aims"]);
  });
});
