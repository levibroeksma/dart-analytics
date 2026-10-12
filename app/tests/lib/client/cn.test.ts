import { describe, it, expect } from "vitest";
import { cn } from "@client/cn";

describe("cn", () => {
  it("merges conflicting tailwind classes", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("joins non-conflicting classes", () => {
    expect(cn("btn", "btn-primary")).toBe("btn btn-primary");
  });

  it.each([
    "hero",
    "title",
    "value",
    "tile",
    "card-title",
    "control",
    "eyebrow",
    "eyebrow-lg",
    "body-sm",
    "caption",
    "micro",
    "key",
    "key-label",
    "stat",
    "summary",
    "summary-lg",
    "numeral-1",
    "numeral-6",
  ])("keeps the %s type-scale size beside a text colour", (name) => {
    expect(cn(`text-${name}`, "text-foreground")).toBe(
      `text-${name} text-foreground`,
    );
  });

  it("still lets a later type-scale size replace an earlier one", () => {
    expect(cn("text-sm", "text-control")).toBe("text-control");
    expect(cn("text-eyebrow", "text-eyebrow-lg")).toBe("text-eyebrow-lg");
  });

  it("keeps D451 utilities beside the stock classes they sit with", () => {
    expect(cn("border-medium", "border-white/20")).toBe(
      "border-medium border-white/20",
    );
    expect(cn("px-4", "pt-safe", "pb-safe")).toBe("px-4 pt-safe pb-safe");
    expect(cn("fixed", "bottom-above-nav")).toBe("fixed bottom-above-nav");
  });
});
