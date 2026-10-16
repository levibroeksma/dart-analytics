import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { cn } from "@client/cn";
import {
  MERGE_TOKENS,
  SELF_MERGING,
  UTILITY_GROUPS,
} from "@client/merge-tokens";

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

  it("lets a later deck depth or motion state replace an earlier one", () => {
    expect(
      cn("deck-card deck-depth-0 deck-rest", "deck-depth-2 deck-parked"),
    ).toBe("deck-card deck-depth-2 deck-parked");
  });

  it("lets a later seat layer fade replace an earlier one", () => {
    expect(cn("seat-layer-out", "seat-layer-in")).toBe("seat-layer-in");
  });

  it("lets a later dart animation replace an earlier one", () => {
    expect(cn("animate-dart-fly", "animate-dart-stick")).toBe(
      "animate-dart-stick",
    );
  });

  it("lets the coin's lift state replace the other", () => {
    expect(cn("coin-up", "coin-down")).toBe("coin-down");
  });

  it("lets bull-crop-board replace a component's own relative position", () => {
    expect(cn("relative touch-none", "bull-crop-board")).toBe(
      "touch-none bull-crop-board",
    );
  });

  it("no longer registers the retired card-stack slabs", () => {
    expect(UTILITY_GROUPS).not.toHaveProperty("stack-slab-1");
    expect(UTILITY_GROUPS).not.toHaveProperty("stack-slab-2");
  });

  it("lets section-ring-inset replace stock inset and composes highlight-glow freely", () => {
    expect(cn("inset-0", "section-ring-inset")).toBe("section-ring-inset");
    expect(cn("fill-none", "highlight-glow")).toBe("fill-none highlight-glow");
  });

  it("lets section-ring-square replace stock size and composes section-ring-frame freely", () => {
    expect(cn("size-full", "section-ring-square")).toBe("section-ring-square");
    expect(cn("flex", "section-ring-frame")).toBe("flex section-ring-frame");
  });
});

describe("cn token registry stays in lockstep with global.css", () => {
  const css = readFileSync(
    new URL("../../../src/styles/global.css", import.meta.url),
    "utf8",
  );
  const theme = [...css.matchAll(/@theme[^{]*\{([\s\S]*?)\n\}/g)]
    .map((m) => m[1])
    .join("\n");
  const namespaces = Object.keys(MERGE_TOKENS).sort(
    (a, b) => b.length - a.length,
  );
  const namespaceOf = (name: string) =>
    namespaces.find((ns) => name.startsWith(`${ns}-`));

  function cssTokens(namespace: string): string[] {
    return [...theme.matchAll(/^\s*--([a-z0-9-]+):/gm)]
      .map((m) => m[1])
      .filter((name) => !name.includes("--"))
      .filter((name) => namespaceOf(name) === namespace)
      .map((name) => name.slice(namespace.length + 1))
      .sort();
  }

  const namespaceCases = Object.keys(MERGE_TOKENS) as Array<
    keyof typeof MERGE_TOKENS
  >;

  it.each(namespaceCases)(
    "registers exactly the --%s-* tokens global.css declares",
    (namespace) => {
      expect([...MERGE_TOKENS[namespace]].sort()).toEqual(cssTokens(namespace));
    },
  );

  it("leaves no Tailwind theme namespace unregistered", () => {
    const tailwindNamespaces = [
      "color",
      "font",
      "text",
      "font-weight",
      "tracking",
      "leading",
      "breakpoint",
      "container",
      "spacing",
      "radius",
      "shadow",
      "inset-shadow",
      "drop-shadow",
      "text-shadow",
      "blur",
      "perspective",
      "aspect",
      "ease",
      "animate",
      "background-image",
      "grid-template-columns",
      "grid-template-rows",
    ].sort((a, b) => b.length - a.length);
    const unregistered = [...theme.matchAll(/^\s*--([a-z0-9-]+):/gm)]
      .map((m) => m[1])
      .filter((name) => !name.includes("--"))
      .filter((name) => {
        const ns = tailwindNamespaces.find((n) => name.startsWith(`${n}-`));
        return ns && !SELF_MERGING.includes(ns) && namespaceOf(name) !== ns;
      });
    expect(unregistered).toEqual([]);
  });

  it.each([
    ...[...theme.matchAll(/^\s*--color-([a-z0-9-]+):/gm)].map((m) => [
      `text-${m[1]}`,
      "text-sm",
      "text-sky-500",
    ]),
    ["font-display", "text-sm", "font-sans"],
    ["font-mono", "text-sm", "font-sans"],
  ])(
    "self-merges %s: keeps it beside %s, lets %s replace it",
    (cls, other, rival) => {
      expect(cn(cls, other)).toBe(`${cls} ${other}`);
      expect(cn(cls, rival)).toBe(rival);
    },
  );

  it("classifies exactly the @utility names global.css declares", () => {
    const declared = [...css.matchAll(/^@utility ([a-z0-9-]+)/gm)]
      .map((m) => m[1])
      .sort();
    expect(Object.keys(UTILITY_GROUPS).sort()).toEqual(declared);
  });

  const usage: Record<
    keyof typeof MERGE_TOKENS,
    { prefix: string; stock: string; colour?: string }
  > = {
    text: { prefix: "text", stock: "text-sm", colour: "text-foreground" },
    radius: { prefix: "rounded", stock: "rounded-lg" },
    shadow: { prefix: "shadow", stock: "shadow-lg", colour: "shadow-sky-500" },
    "text-shadow": {
      prefix: "text-shadow",
      stock: "text-shadow-lg",
      colour: "text-shadow-sky-500",
    },
    spacing: { prefix: "h", stock: "h-4" },
    animate: { prefix: "animate", stock: "animate-spin" },
    "grid-template-columns": { prefix: "grid-cols", stock: "grid-cols-2" },
    "background-image": {
      prefix: "bg",
      stock: "bg-linear-to-b",
      colour: "bg-surface",
    },
  };

  it.each(namespaceCases)(
    "lets each --%s-* token replace its stock sibling and keep its colour",
    (namespace) => {
      const { prefix, stock, colour } = usage[namespace];
      for (const token of MERGE_TOKENS[namespace]) {
        const cls = `${prefix}-${token}`;
        expect(cn(stock, cls)).toBe(cls);
        if (colour) expect(cn(cls, colour)).toBe(`${cls} ${colour}`);
      }
    },
  );

  const groupSibling: Record<string, string> = {
    "border-w": "border-2",
    pt: "pt-2",
    pb: "pb-2",
    bottom: "bottom-0",
  };
  const grouped = Object.entries(UTILITY_GROUPS).filter(
    (entry): entry is [string, string] => entry[1] !== null,
  );

  it.each(grouped)(
    "lets @utility %s replace the rest of its %s group",
    (utility, group) => {
      const sibling = groupSibling[group];
      if (sibling) expect(cn(sibling, utility)).toBe(utility);
      for (const [other, otherGroup] of grouped) {
        if (other !== utility && otherGroup === group) {
          expect(cn(other, utility)).toBe(utility);
        }
      }
    },
  );

  it.each(
    Object.entries(UTILITY_GROUPS)
      .filter(([, group]) => group === null)
      .map(([utility]) => utility),
  )("keeps standalone @utility %s beside stock classes", (utility) => {
    const stock = [
      "inset-0",
      "p-2",
      "text-foreground",
      "bg-surface",
      "border-border",
      "shadow-sky-500",
      "rounded-lg",
    ];
    expect(cn(utility, ...stock)).toBe([utility, ...stock].join(" "));
  });
});
