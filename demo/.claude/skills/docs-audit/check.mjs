#!/usr/bin/env node
// docs-audit deterministic checks — READ-ONLY, no edits. The /docs-audit skill runs
// this first and reasons about its output; judgment checks (dedup, anchor liveness,
// CLAUDE.md honesty) stay with Claude. Exit 0 = clean, non-zero = findings.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve, relative } from 'node:path';

const ROOT = process.cwd();
let findings = 0;
const log = (m) => console.log('  ' + m);
const fail = (m) => { console.log('  ✗ ' + m); findings++; };

// recursively list *.md under a dir
function mdFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...mdFiles(p));
    else if (e.name.endsWith('.md')) out.push(p);
  }
  return out;
}

console.log('docs-audit deterministic checks:');

// ---- 1. Index completeness: every docs/**/*.md is mentioned in docs/README.md ----
const readme = join(ROOT, 'docs/README.md');
const readmeText = readFileSync(readme, 'utf8');
const docs = mdFiles(join(ROOT, 'docs'));
const unindexed = docs.filter((f) => {
  if (f === readme) return false;
  const rel = relative(join(ROOT, 'docs'), f); // e.g. knowledge/gotchas.md
  const base = rel.split('/').pop();
  if (base === 'template.md') return false; // scaffolds (e.g. adr/template.md) aren't indexed content
  return !readmeText.includes(rel) && !readmeText.includes(base);
});
if (unindexed.length) unindexed.forEach((f) => fail('unindexed (not in docs/README.md): ' + relative(ROOT, f)));
else log('✓ index completeness: all ' + (docs.length - 1) + ' docs reachable from README');

// ---- 2. Relative links resolve (docs/**/*.md + CLAUDE.md + CONTRIBUTING.md) ----
const linkScope = [...docs, join(ROOT, 'CLAUDE.md'), join(ROOT, 'CONTRIBUTING.md')].filter(existsSync);
let broken = 0;
const linkRe = /\[[^\]]*\]\(([^)]+)\)/g;
for (const f of linkScope) {
  const text = readFileSync(f, 'utf8');
  let m;
  while ((m = linkRe.exec(text))) {
    let target = m[1].trim();
    if (/^(https?:|mailto:|#)/.test(target)) continue; // external or pure anchor
    target = target.split('#')[0]; // strip anchor
    if (!target) continue;
    const abs = resolve(dirname(f), target);
    if (!existsSync(abs)) { fail('broken link in ' + relative(ROOT, f) + ' → ' + m[1]); broken++; }
  }
}
if (!broken) log('✓ links resolve: every relative link in docs/ + CLAUDE.md + CONTRIBUTING.md points at a real file');

// ---- 3. ADR health: numbering, Status line, README table coverage ----
const adrDir = join(ROOT, 'docs/adr');
const adrs = readdirSync(adrDir).filter((f) => /^\d{4}-.+\.md$/.test(f)).sort();
const nums = adrs.map((f) => parseInt(f.slice(0, 4), 10));
for (let i = 0; i < nums.length; i++) {
  if (nums[i] !== i + 1) { fail('ADR numbering gap/dup at ' + adrs[i] + ' (expected ' + String(i + 1).padStart(4, '0') + ')'); break; }
}
const adrBefore = findings;
for (const f of adrs) {
  if (!/\*\*\s*status\s*:?/i.test(readFileSync(join(adrDir, f), 'utf8'))) fail('ADR missing a **Status:** line: ' + f);
  if (!readmeText.includes(f.slice(0, 4))) fail('ADR not in README ADR table: ' + f);
}
if (findings === adrBefore && nums.length && nums[nums.length - 1] === nums.length) {
  log('✓ ADRs: ' + nums.length + ' sequential (0001–' + String(nums.length).padStart(4, '0') + '), each with Status + a README row');
}

console.log('DOCS-AUDIT: findings=' + findings);
process.exit(findings ? 1 : 0);
