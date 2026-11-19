// One-shot: split the 10 old decision-ledger domain files into 1 MADR file each.
// Usage: node scripts/decisions/split.mjs [--dry-run]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DOMAINS,
  HEADINGS,
  UNKNOWN,
  parseRecord,
  renderRecord,
  slugify,
  validateRecord,
} from "./lib.mjs";

const MAX_BASELINE_ID = 564;
const FIELD = /^(Status|Decision|Reason|Consequences|Supersedes):[ \t]?(.*)$/;
const BLOCK_HEAD = /^### D(\d+) — (.+?)\s*$/;
// Longer reasons stay in Context only; repeating them in the outcome would bloat it.
const BECAUSE_MAX = 200;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

const fail = (file, line, msg) => {
  throw new Error(`${file}:${line}: ${msg}`);
};
const pad = (n) => `D${String(n).padStart(4, "0")}`;
const trimBlank = (lines) => {
  let a = 0;
  let b = lines.length;
  while (a < b && lines[a].trim() === "") a++;
  while (b > a && lines[b - 1].trim() === "") b--;
  return lines.slice(a, b);
};
const idList = (v) =>
  Array.isArray(v) ? v : v ? v.split(",").map((s) => s.trim()) : [];
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function loadWhen(lines) {
  const l = lines.find((x) => x.startsWith("load-when:"));
  return l
    ? l
        .slice("load-when:".length)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
}

function tagsFor(domain, keywords, text) {
  const tags = [domain];
  for (const kw of keywords) {
    const re = new RegExp(`(?<![A-Za-z0-9_])${esc(kw)}(?![A-Za-z0-9_])`, "i");
    if (re.test(text) && !tags.includes(kw)) tags.push(kw);
  }
  return tags;
}

function titleFromDecision(text) {
  const first = text.split("\n")[0];
  let t = first.split(/;|: | — |\. /)[0].trim();
  if (t.length > 90) {
    t = t.slice(0, 90);
    t = t.slice(0, Math.max(t.lastIndexOf(" "), 1));
  }
  return t.replace(/[.,:]+$/, "");
}

const idsIn = (line) => [
  ...new Set([...line.matchAll(/\bD(\d+)\b/g)].map((m) => pad(Number(m[1])))),
];
const onlyIds = (line) =>
  line.replace(/\bD\d+\b/g, "").replace(/[\s,.;]+/g, "") === "";

// Supersedes body -> { ids, refs, evidence[] }. A purely-ids line links
// (ids); a line with extra words is partial: Evidence verbatim, ids go to refs.
function parseSupersedes(body) {
  if (body === null || body.trim() === "")
    return { ids: [], refs: [], evidence: [] };
  const lines = body.split("\n");
  const first = lines[0].trim();
  const evidence = [];
  let ids = [];
  let refs = [];
  if (/^none/i.test(first)) {
    if (!/^none\.?$/i.test(first)) evidence.push(`Supersedes: ${first}`);
  } else if (onlyIds(first)) {
    ids = idsIn(first);
  } else {
    refs = idsIn(first);
    evidence.push(`Supersedes: ${first}`);
  }
  for (const l of lines.slice(1)) if (l.trim() !== "") evidence.push(l);
  return { ids, refs, evidence };
}

function build({
  domain,
  keywords,
  id,
  title,
  date,
  source,
  decision,
  reason,
  consequences,
  supersedes,
  extras,
}) {
  const sup = parseSupersedes(supersedes);
  const ids = [...sup.ids];
  const refs = [...sup.refs];
  for (const x of extras) {
    const m = /^Supersedes:(.*)$/.exec(x);
    if (!m) continue;
    const found = idsIn(m[1]);
    const target = onlyIds(m[1]) ? ids : refs;
    for (const d of found) if (!target.includes(d)) target.push(d);
  }
  const text = [title, decision, reason, consequences, supersedes, ...extras]
    .filter(Boolean)
    .join("\n");
  const outcome =
    `Chosen option: "${decision}"` +
    (reason && !reason.includes("\n") && reason.length <= BECAUSE_MAX
      ? `, because ${reason}${/[.!?]$/.test(reason) ? "" : "."}`
      : ".");
  const evidence = [
    date ? `Decided: ${date}` : `Source: ${source}`,
    ...extras,
    ...sup.evidence,
  ];
  const sections = new Map(HEADINGS.map((h) => [h, UNKNOWN]));
  if (reason) sections.set("Context and Problem Statement", reason);
  sections.set("Decision Outcome", outcome);
  if (consequences) sections.set("Consequences", consequences);
  sections.set("Evidence / More Information", evidence.join("\n"));
  return {
    fm: {
      id: pad(id),
      status: "accepted",
      date: date ?? "",
      origin: "contemporaneous",
      "original-date": "",
      tags: tagsFor(domain, keywords, text),
      scope: "repository",
      "decision-makers": ["owner"],
      consulted: [],
      informed: [],
      supersedes: ids.length > 1 ? ids : ids.join(""),
      "superseded-by": "",
    },
    title,
    sections,
    thin: true,
    extra: "",
    dupes: [],
    refs,
  };
}

// Every non-empty source fragment must appear in the rendered record.
function assertLossless(rec, fragments, file, line) {
  const out = renderRecord(rec);
  for (const f of fragments) {
    if (f.trim() !== "" && !out.includes(f.trim()))
      fail(file, line, `text lost in split: "${f.trim().slice(0, 80)}"`);
  }
}

export function splitDomainFile(text, domain, opts = {}) {
  const file = opts.file ?? `decisions/${domain}.md`;
  const warn = opts.warn ?? (() => {});
  const lines = text.split("\n");
  const records = [];
  let i = 0;
  let keywords = [];
  if (lines[0]?.trim() === "<!--") {
    const end = lines.findIndex((l) => l.trim() === "-->");
    if (end < 0) fail(file, 1, "unterminated header comment");
    keywords = loadWhen(lines.slice(1, end));
    i = end + 1;
  }
  const row = /^\|\s*D(\d+)\s*\|/;
  for (; i < lines.length; i++) {
    const l = lines[i];
    if (BLOCK_HEAD.test(l)) break;
    if (/^### D\d/.test(l)) fail(file, i + 1, "malformed decision heading");
    if (l.trim() === "") continue;
    if (row.test(l)) {
      const cells = l
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split(/(?<!\\)\|/)
        .map((c) => c.trim().replace(/\\\|/g, "|"));
      if (cells.length !== 4)
        fail(file, i + 1, `table row has ${cells.length} cells, expected 4`);
      const [idCell, src, decision, rationale] = cells;
      if (decision === "") fail(file, i + 1, "empty Decision cell");
      const isDate = ISO.test(src);
      const rec = build({
        domain,
        keywords,
        id: Number(/D(\d+)/.exec(idCell)[1]),
        title: titleFromDecision(decision),
        date: isDate ? src : null,
        source: src,
        decision,
        reason: rationale || null,
        consequences: null,
        supersedes: null,
        extras: [],
      });
      assertLossless(rec, [src, decision, rationale], file, i + 1);
      records.push(rec);
    } else if (/^\|\s*(#|-+)\s*\|/.test(l)) {
      // table header / separator
    } else {
      warn(
        `${file}:${i + 1}: prose outside header/table/blocks: ${l.trim().slice(0, 100)}`,
      );
    }
  }
  while (i < lines.length) {
    const head = BLOCK_HEAD.exec(lines[i]);
    if (!head) {
      if (lines[i].trim() !== "")
        warn(
          `${file}:${i + 1}: prose outside header/table/blocks: ${lines[i].trim().slice(0, 100)}`,
        );
      i++;
      continue;
    }
    const startLine = i + 1;
    const id = Number(head[1]);
    const title = head[2];
    i++;
    const fields = new Map();
    let cur = null;
    for (; i < lines.length; i++) {
      const l = lines[i];
      if (/^### D\d/.test(l) || /^#{1,2} /.test(l)) break;
      const m = FIELD.exec(l);
      if (m) {
        if (fields.has(m[1]))
          fail(file, i + 1, `duplicate "${m[1]}:" field in D${id}`);
        cur = m[1];
        fields.set(cur, [m[2]]);
      } else if (cur === null) {
        if (l.trim() !== "")
          fail(file, i + 1, `text before first field in D${id}`);
      } else {
        fields.get(cur).push(l);
      }
    }
    const body = (name) => {
      const v = fields.get(name);
      if (!v) return null;
      const t = trimBlank(v).join("\n");
      return t === "" ? null : t;
    };
    const statusBody = body("Status");
    if (statusBody === null) fail(file, startLine, `D${id} has no Status`);
    if (statusBody.includes("\n"))
      fail(file, startLine, `D${id} Status spans several lines`);
    const parts = statusBody.split(" · ").map((p) => p.trim());
    if (parts[0].toLowerCase() !== "accepted")
      fail(file, startLine, `D${id} unexpected status "${parts[0]}"`);
    let date = null;
    const extras = [];
    for (const p of parts.slice(1)) {
      const d = /^Date:\s*(\d{4}-\d{2}-\d{2})$/.exec(p);
      if (d && date === null) date = d[1];
      else extras.push(p);
    }
    if (date === null) fail(file, startLine, `D${id} has no valid Date`);
    const decision = body("Decision");
    if (decision === null) fail(file, startLine, `D${id} has no Decision`);
    const rec = build({
      domain,
      keywords,
      id,
      title,
      date,
      source: null,
      decision,
      reason: body("Reason"),
      consequences: body("Consequences"),
      supersedes: body("Supersedes"),
      extras,
    });
    const frags = [title, ...extras];
    for (const n of ["Decision", "Reason", "Consequences", "Supersedes"]) {
      const b = body(n);
      if (!b) continue;
      let ls = b.split("\n");
      if (n === "Supersedes") {
        const first = ls[0].trim();
        const idsOnly =
          !/^none/i.test(first) &&
          first.replace(/\bD\d+\b/g, "").replace(/[\s,.;]+/g, "") === "";
        if (/^none\.?$/i.test(first)) ls = ls.slice(1);
        else if (idsOnly) {
          const want = [...first.matchAll(/\bD(\d+)\b/g)].map((m) =>
            pad(Number(m[1])),
          );
          for (const w of want)
            if (!rec.fm.supersedes.split(", ").includes(w))
              fail(file, startLine, `lost supersedes id ${w}`);
          ls = ls.slice(1);
        }
      }
      frags.push(...ls);
    }
    assertLossless(rec, frags, file, startLine);
    records.push(rec);
  }
  return records;
}

export function linkSupersedes(records) {
  const byId = new Map(records.map((r) => [r.fm.id, r]));
  for (const r of records) {
    const ids = idList(r.fm.supersedes);
    for (const id of ids) {
      const old = byId.get(id);
      if (!old)
        throw new Error(
          `${r.fm.id} supersedes ${id}, which is not in the ledger`,
        );
      old.fm.status = "superseded";
      const by = idList(old.fm["superseded-by"]);
      if (!by.includes(r.fm.id)) by.push(r.fm.id);
      // flat YAML: 1 id is a scalar, several are a [a, b] list.
      old.fm["superseded-by"] = by.length > 1 ? by : by[0];
      // spec § 5: the older record takes the superseder's date; an empty
      // superseder date leaves the older date as it was.
      if (r.fm.date) old.fm.date = r.fm.date;
    }
    for (const id of r.refs ?? []) {
      const old = byId.get(id);
      if (!old)
        throw new Error(`${r.fm.id} names ${id}, which is not in the ledger`);
      const ev = "Evidence / More Information";
      old.sections.set(
        ev,
        `${old.sections.get(ev)}\nReferenced by ${r.fm.id}'s \`Supersedes:\` line.`,
      );
    }
  }
}

function main() {
  const dry = process.argv.includes("--dry-run");
  const warnings = [];
  const all = [];
  const domainOf = new Map();
  for (const domain of DOMAINS) {
    const file = `decisions/${domain}.md`;
    if (!existsSync(file))
      throw new Error(`${file}: old domain file not found`);
    const recs = splitDomainFile(readFileSync(file, "utf8"), domain, {
      file,
      warn: (w) => warnings.push(w),
    });
    for (const r of recs) {
      if (domainOf.has(r.fm.id))
        throw new Error(
          `duplicate id ${r.fm.id} (${domainOf.get(r.fm.id)} and ${domain})`,
        );
      domainOf.set(r.fm.id, domain);
      all.push(r);
    }
  }
  linkSupersedes(all);
  const paths = new Map();
  const errors = [];
  for (const r of all) {
    const slug = slugify(r.title);
    if (slug === "") throw new Error(`${r.fm.id}: title yields empty slug`);
    const path = `decisions/${domainOf.get(r.fm.id)}/${r.fm.id}-${slug}.md`;
    if (paths.has(path))
      throw new Error(
        `file name clash: ${path} (${paths.get(path)} and ${r.fm.id})`,
      );
    paths.set(path, r.fm.id);
    errors.push(...validateRecord(r, path, { maxBaselineId: MAX_BASELINE_ID }));
    const back = parseRecord(renderRecord(r));
    for (const h of HEADINGS) {
      if (back.sections.get(h) !== r.sections.get(h))
        errors.push(`${path}: section "${h}" does not survive render/parse`);
    }
  }
  for (const w of warnings) console.warn(`warning: ${w}`);
  if (errors.length > 0) {
    for (const e of errors) console.error(e);
    throw new Error(`${errors.length} validation errors`);
  }
  if (dry) console.log("dry run: nothing written");
  else {
    for (const r of all) {
      const path = [...paths].find(([, id]) => id === r.fm.id)[0];
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, renderRecord(r));
    }
  }
  console.log(`wrote ${all.length} records`);
  console.log(`warnings: ${warnings.length}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    main();
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
