import { describe, expect, it } from "vitest";
import { z } from "zod";
import { makeConfigValidator } from "@services/exercise-rulesets/config-validator";

const validator = makeConfigValidator(
  z.object({ minutes: z.number().int().min(1), label: z.string() }).strict(),
);

describe("makeConfigValidator", () => {
  it("returns the parsed config when the schema accepts it", () => {
    expect(
      validator.validateConfig({ config: { minutes: 5, label: "a" } }),
    ).toEqual({ ok: true, config: { minutes: 5, label: "a" } });
  });

  it("returns the schema's output, not the raw input", () => {
    const trimming = makeConfigValidator(z.object({ name: z.string().trim() }));

    expect(trimming.validateConfig({ config: { name: " a " } })).toEqual({
      ok: true,
      config: { name: "a" },
    });
  });

  it("reports one `path: message` issue per failure", () => {
    const result = validator.validateConfig({
      config: { minutes: 0, label: 3 },
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues).toHaveLength(2);
    expect(result.issues.map((issue) => issue.split(":")[0])).toEqual([
      "minutes",
      "label",
    ]);
  });

  it("rejects an unknown key under a strict schema", () => {
    const result = validator.validateConfig({
      config: { minutes: 5, label: "a", extra: true },
    });

    expect(result.ok).toBe(false);
  });
});
