import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { DOMAINS, listRecords, validateRecord } from "./lib.mjs";

function listFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...listFiles(p));
    else out.push(p);
  }
  return out;
}

const asList = (v) =>
  (Array.isArray(v) ? v : [v]).filter((s) => typeof s === "string" && s !== "");

export function parseBaseline(text) {
  return text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^D\d{4}$/.test(l));
}

export function checkLedger(root, baselineIds) {
  const errs = [];
  const stray = new Set();
  for (const p of listFiles(root)) {
    const rel = relative(root, p);
    if (rel === "TEMPLATE.md") continue;
    if (!DOMAINS.includes(dirname(rel))) {
      stray.add(p);
      errs.push(
        `${p}: file outside the domain directories (only TEMPLATE.md is allowed at the root)`,
      );
    }
  }
  const maxBaselineId = Math.max(0, ...baselineIds.map((i) => Number(i.slice(1))));
  const records = listRecords(root).filter((r) => !stray.has(r.path));
  const byId = new Map();
  for (const { path, record } of records) {
    errs.push(...validateRecord(record, path, { maxBaselineId }));
    const id = record.fm.id;
    if (id === "pending" || typeof id !== "string") continue;
    if (byId.has(id)) {
      errs.push(`${path}: duplicate id ${id} (also ${byId.get(id).path})`);
    } else {
      byId.set(id, { path, record });
    }
  }
  for (const [id, { path, record }] of byId) {
    for (const s of asList(record.fm.supersedes)) {
      const t = byId.get(s);
      if (!t) errs.push(`${path}: supersedes ${s}, which does not exist`);
      else if (!asList(t.record.fm["superseded-by"]).includes(id)) {
        errs.push(`${path}: supersedes ${s}, but ${t.path} lacks superseded-by ${id}`);
      }
    }
    for (const s of asList(record.fm["superseded-by"])) {
      const t = byId.get(s);
      if (!t) errs.push(`${path}: superseded-by ${s}, which does not exist`);
      else if (!asList(t.record.fm.supersedes).includes(id)) {
        errs.push(`${path}: superseded-by ${s}, but ${t.path} lacks supersedes ${id}`);
      }
    }
  }
  for (const id of baselineIds) {
    if (!byId.has(id)) errs.push(`${root}: baseline id ${id} is missing`);
  }
  return errs;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const opt = (name, def) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : def;
  };
  const root = opt("--root", "decisions");
  const baselinePath = opt("--baseline", "scripts/decisions/baseline-ids.txt");
  const baseline = existsSync(baselinePath)
    ? parseBaseline(readFileSync(baselinePath, "utf8"))
    : [];
  const errs = checkLedger(root, baseline);
  if (errs.length) {
    console.error(errs.join("\n"));
    process.exit(1);
  }
  console.log(`PASS: ${listRecords(root).length} records`);
}
