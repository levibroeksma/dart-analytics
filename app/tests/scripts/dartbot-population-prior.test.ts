import { describe, expect, it } from "vitest";
import {
  extractRowsFromMarkdown,
  toMissMarginInputs,
} from "../../scripts/dartbot-population-prior";

const markdown = `# Extracted data

\`\`\`sql
SELECT d.intended_target_number, d.intended_zone_id, d.location_x, d.location_y
FROM darts d;
\`\`\`

**Result:**

\`\`\`json
[
  { "intended_target_number": 20, "intended_zone_id": 4, "location_x": "1.5", "location_y": "-2.5" }
]
\`\`\`

\`\`\`sql
SELECT d.intended_target_number, dz.implementation_key AS intended_zone_key, d.location_x, d.location_y
FROM darts d JOIN dart_zones dz ON dz.id = d.intended_zone_id;
\`\`\`

**Result:**

\`\`\`json
[
  { "intended_target_number": 20, "intended_zone_key": "DOUBLE", "location_x": "1.5", "location_y": "-2.5" },
  { "intended_target_number": null, "intended_zone_key": null, "location_x": null, "location_y": null }
]
\`\`\`
`;

describe("extractRowsFromMarkdown", () => {
  it("reads the last fenced json block, skipping the raw zone_id block", () => {
    const rows = extractRowsFromMarkdown(markdown);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.intended_zone_key).toBe("DOUBLE");
  });

  it("throws when the file has no json block", () => {
    expect(() => extractRowsFromMarkdown("# no code fences here")).toThrow(
      "No ```json block found",
    );
  });
});

describe("toMissMarginInputs", () => {
  it("camel-cases fields and coerces stringly numeric locations", () => {
    const [row] = toMissMarginInputs(extractRowsFromMarkdown(markdown));
    expect(row).toEqual({
      intendedTargetNumber: 20,
      intendedZoneKey: "DOUBLE",
      locationX: 1.5,
      locationY: -2.5,
    });
  });

  it("keeps a null location null rather than coercing it to zero", () => {
    const [, secondRow] = toMissMarginInputs(extractRowsFromMarkdown(markdown));
    expect(secondRow).toEqual({
      intendedTargetNumber: null,
      intendedZoneKey: null,
      locationX: null,
      locationY: null,
    });
  });
});
