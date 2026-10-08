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
    "button",
    "eyebrow",
    "eyebrow-lg",
  ])("keeps the %s type-scale size beside a text colour", (name) => {
    expect(cn(`text-${name}`, "text-foreground")).toBe(
      `text-${name} text-foreground`,
    );
  });

  it("still lets a later type-scale size replace an earlier one", () => {
    expect(cn("text-sm", "text-button")).toBe("text-button");
    expect(cn("text-eyebrow", "text-eyebrow-lg")).toBe("text-eyebrow-lg");
  });
});
