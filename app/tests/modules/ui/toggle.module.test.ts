import { describe, it, expect } from "vitest";
import { Toggle } from "@modules/ui/toggle.module";

describe("Toggle", () => {
  const options = [
    { value: "bestOf", label: "Best of" },
    { value: "firstTo", label: "First to" },
  ];

  it("defaults value to first option when initial omitted", () => {
    const t = new Toggle({ options, orientation: "vertical" });
    expect(t.value).toBe("bestOf");
  });

  it("uses initial when it matches an option", () => {
    const t = new Toggle({
      options,
      orientation: "vertical",
      initial: "firstTo",
    });
    expect(t.value).toBe("firstTo");
  });

  it("falls back to first option when initial is unknown", () => {
    const t = new Toggle({
      options,
      orientation: "vertical",
      initial: "nope",
    });
    expect(t.value).toBe("bestOf");
  });

  it("setValue ignores unknown values", () => {
    const t = new Toggle({
      options,
      orientation: "horizontal",
      initial: "bestOf",
    });
    t.setValue("nope");
    expect(t.value).toBe("bestOf");
    t.setValue("firstTo");
    expect(t.value).toBe("firstTo");
  });

  it("throws when options is empty", () => {
    expect(
      () => new Toggle({ options: [], orientation: "horizontal" }),
    ).toThrow(/at least one option/);
  });

  it("throws when methods run through a Proxy (Alpine must not wrap Toggle)", () => {
    const t = new Toggle({ options, orientation: "horizontal" });
    const proxied = new Proxy(t, {});
    expect(() => proxied.unmount()).toThrow(/private/);
  });
});
