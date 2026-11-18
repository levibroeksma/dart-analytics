import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

export const UNKNOWN = "Rationale unknown — backfill pending.";
export const THIN_MARKER = "<!-- backfill: pending -->";

export const FM_KEYS = [
  "id",
  "status",
  "date",
  "origin",
  "original-date",
  "tags",
  "scope",
  "decision-makers",
  "consulted",
  "informed",
  "supersedes",
  "superseded-by",
];

export const DOMAINS = [
  "architecture",
  "database",
  "api",
  "game-engine",
  "testing",
  "context-system",
  "frontend/architecture",
  "frontend/astro",
  "frontend/alpine",
  "frontend/style",
];

const SECTIONS = [
  ["Context and Problem Statement", 2],
  ["Decision Drivers", 2],
  ["Considered Options", 2],
  ["Decision Outcome", 2],
  ["Consequences", 3],
  ["Confidence", 3],
  ["Revisit When", 3],
  ["Confirmation", 3],
  ["Pros and Cons of the Options", 2],
  ["Evidence / More Information", 2],
];

export const HEADINGS = SECTIONS.map(([name]) => name);

const STATUSES = [
  "proposed",
  "accepted",
  "rejected",
  "deprecated",
  "superseded",
];
const ORIGINS = ["contemporaneous", "backfilled"];

export function slugify(title) {
  const words = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  return words.slice(0, 6).join("-");
}

function parseValue(raw) {
  const v = raw.replace(/\s+#.*$/, "").trim();
  if (v.startsWith("[") && v.endsWith("]")) {
    const inner = v.slice(1, -1).trim();
    return inner === "" ? [] : inner.split(",").map((s) => s.trim());
  }
  return v;
}

function trimBlank(lines) {
  let a = 0;
  let b = lines.length;
  while (a < b && lines[a].trim() === "") a++;
  while (b > a && lines[b - 1].trim() === "") b--;
  return lines.slice(a, b).join("\n");
}

export function parseRecord(text) {
  const thin = text.includes(THIN_MARKER);
  const lines = text.split("\n");
  const fm = {};
  let i = 0;
  if (lines[0] === "---") {
    i = 1;
    for (; i < lines.length && lines[i] !== "---"; i++) {
      const m = /^([A-Za-z0-9-]+):(.*)$/.exec(lines[i]);
      if (m) fm[m[1]] = parseValue(m[2]);
    }
    i++;
  }
  let title = "";
  for (; i < lines.length; i++) {
    const m = /^# (.+)$/.exec(lines[i]);
    if (m) {
      title = m[1].trim();
      i++;
      break;
    }
  }
  const sections = new Map();
  const dupes = [];
  const stray = [];
  let current = null;
  let buf = [];
  const flush = () => {
    if (current === null) return;
    const body = trimBlank(buf);
    sections.set(
      current,
      sections.has(current) ? `${sections.get(current)}\n${body}` : body,
    );
  };
  for (; i < lines.length; i++) {
    const m = /^(?:##|###) (.+?)\s*$/.exec(lines[i]);
    if (m && HEADINGS.includes(m[1])) {
      flush();
      current = m[1];
      if (sections.has(current)) dupes.push(current);
      buf = [];
    } else if (current !== null) {
      buf.push(lines[i]);
    } else {
      stray.push(lines[i]);
    }
  }
  flush();
  return { fm, title, sections, thin, extra: trimBlank(stray), dupes };
}

function renderValue(v) {
  return Array.isArray(v) ? `[${v.join(", ")}]` : String(v);
}

export function renderRecord(r) {
  const out = ["---"];
  for (const k of FM_KEYS) {
    if (!(k in r.fm)) continue;
    const v = renderValue(r.fm[k]);
    out.push(v === "" ? `${k}:` : `${k}: ${v}`);
  }
  out.push("---");
  if (r.thin) out.push(THIN_MARKER);
  out.push("", `# ${r.title}`);
  for (const [name, level] of SECTIONS) {
    if (!r.sections.has(name)) continue;
    out.push("", `${"#".repeat(level)} ${name}`);
    const body = r.sections.get(name);
    if (body !== "") out.push(body);
  }
  return `${out.join("\n")}\n`;
}

export function validateRecord(r, path, opts) {
  const errs = [];
  const err = (msg) => errs.push(`${path}: ${msg}`);
  const keys = Object.keys(r.fm);
  if (keys.join(",") !== FM_KEYS.join(",")) {
    err(`frontmatter keys must be exactly, in order: ${FM_KEYS.join(", ")}`);
  }
  const id = r.fm.id;
  const file = basename(path);
  if (id === "pending") {
    if (!/^pending-[a-z0-9-]+\.md$/.test(file)) {
      err("pending record file name must be pending-<slug>.md");
    }
  } else if (typeof id === "string" && /^D\d{4}$/.test(id)) {
    if (!new RegExp(`^${id}-[a-z0-9-]+\\.md$`).test(file)) {
      err(`file name must be ${id}-<slug>.md`);
    }
  } else {
    err(`id must be D<4 digits> or pending, got "${id}"`);
  }
  if (!STATUSES.includes(r.fm.status)) {
    err(`status must be one of ${STATUSES.join(", ")}`);
  }
  if (!ORIGINS.includes(r.fm.origin)) {
    err(`origin must be one of ${ORIGINS.join(", ")}`);
  }
  const date = r.fm.date;
  if (date === "" || date === undefined) {
    const n =
      typeof id === "string" && /^D\d{4}$/.test(id)
        ? Number(id.slice(1))
        : Infinity;
    if (n > opts.maxBaselineId) {
      err(`date may be empty only for ids up to D${opts.maxBaselineId}`);
    }
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    err("date must be YYYY-MM-DD");
  }
  if (!r.title) err("missing level-1 title");
  if (r.extra)
    err("text between the title and the first heading is not allowed");
  for (const h of r.dupes ?? []) err(`duplicate heading "${h}"`);
  const present = HEADINGS.filter((h) => r.sections.has(h));
  for (const h of HEADINGS) {
    if (!r.sections.has(h)) err(`missing heading "${h}"`);
  }
  const seen = [...r.sections.keys()].filter((h) => HEADINGS.includes(h));
  if (present.join("|") !== seen.join("|")) {
    err("headings out of template order");
  }
  for (const [h, body] of r.sections) {
    if (body.trim() === "") err(`empty section "${h}" must hold: ${UNKNOWN}`);
  }
  return errs;
}

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.endsWith(".md") && e.name !== "TEMPLATE.md") out.push(p);
  }
  return out;
}

export function listRecords(root = "decisions") {
  return walk(root)
    .sort()
    .map((path) => ({ path, record: parseRecord(readFileSync(path, "utf8")) }));
}
