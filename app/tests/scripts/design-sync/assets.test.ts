import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { assetItems, normaliseSvg } from "../../../scripts/design-sync/assets";

const put = (root: string, rel: string, text: string): void => {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
};

const CHECK_DESIGN =
  '<?xml version="1.0"?>\r\n<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">\r\n  <path stroke="currentColor" d="M1 1L2 2"/>\r\n</svg>\r\n';
const CHECK_CODE =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M1 1L2 2" stroke="currentColor" /></svg>\n';

describe("design-sync assets", () => {
  it("ignores attribute order, whitespace, CRLF and the xml prologue", () => {
    expect(normaliseSvg(CHECK_DESIGN)).toBe(normaliseSvg(CHECK_CODE));
  });

  it("ignores hex colour case", () => {
    expect(normaliseSvg('<svg><path fill="#FFF" d="M0 0"/></svg>')).toBe(
      normaliseSvg('<svg><path fill="#fff" d="M0 0"/></svg>'),
    );
  });

  it("keeps a changed path as a difference", () => {
    expect(normaliseSvg(CHECK_CODE)).not.toBe(
      normaliseSvg(CHECK_CODE.replace("M1 1", "M1 3")),
    );
  });

  it("pairs icons and brand files; one-sided files stay one-sided", () => {
    const design = mkdtempSync(join(tmpdir(), "ds-design-"));
    const repo = mkdtempSync(join(tmpdir(), "ds-repo-"));
    put(design, "assets/icons/check.svg", CHECK_DESIGN);
    put(repo, "app/src/icons/check.svg", CHECK_CODE);
    put(
      design,
      "assets/icons/nav/home-accent.svg",
      '<svg><path d="M0 0"/></svg>',
    );
    put(repo, "app/src/icons/trash.svg", '<svg><path d="M9 9"/></svg>');
    put(design, "assets/brand/icon-192.png", "PNG-A");
    put(repo, "app/public/icon-192.png", "PNG-B");

    const items = assetItems(design, repo);
    const byId = Object.fromEntries(items.map((i) => [i.id, i]));

    expect(Object.keys(byId).sort()).toEqual([
      "brand:icon-192.png",
      "icon:check.svg",
      "icon:nav/home-accent.svg",
      "icon:trash.svg",
    ]);
    expect(items.every((i) => i.comparable && i.area === "assets")).toBe(true);
    expect(byId["icon:check.svg"].design?.hash).toBe(
      byId["icon:check.svg"].code?.hash,
    );
    expect(byId["icon:check.svg"].code?.path).toBe("app/src/icons/check.svg");
    expect(byId["icon:nav/home-accent.svg"].code).toBeNull();
    expect(byId["icon:trash.svg"].design).toBeNull();
    expect(byId["brand:icon-192.png"].design?.hash).not.toBe(
      byId["brand:icon-192.png"].code?.hash,
    );
    expect(byId["brand:icon-192.png"].code?.path).toBe(
      "app/public/icon-192.png",
    );
  });
});
