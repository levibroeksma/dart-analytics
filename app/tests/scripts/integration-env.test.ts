import { describe, expect, it } from "vitest";
import { databaseUrlEnv } from "../../scripts/integration-env";

describe("databaseUrlEnv", () => {
  it("takes DATABASE_URL from the env file when the shell has none", () => {
    expect(
      databaseUrlEnv({ DATABASE_URL: "postgres://file", OTHER: "x" }, {}),
    ).toEqual({ DATABASE_URL: "postgres://file" });
  });

  it("leaves the shell's DATABASE_URL in charge", () => {
    expect(
      databaseUrlEnv(
        { DATABASE_URL: "postgres://file" },
        { DATABASE_URL: "postgres://shell" },
      ),
    ).toEqual({});
  });

  it("passes nothing else from the env file", () => {
    expect(databaseUrlEnv({ SECRET: "x" }, {})).toEqual({});
  });

  it("ignores an empty DATABASE_URL in the env file", () => {
    expect(databaseUrlEnv({ DATABASE_URL: "" }, {})).toEqual({});
  });

  it("ignores a DATABASE_URL that parsed to undefined", () => {
    expect(databaseUrlEnv({ DATABASE_URL: undefined }, {})).toEqual({});
  });
});
