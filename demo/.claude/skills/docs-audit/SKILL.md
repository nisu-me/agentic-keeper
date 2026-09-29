---
name: docs-audit
description: Audits the docs/ knowledge base for structural drift — unindexed files, broken links, ADR numbering gaps, stale anchors, duplicated facts — and fixes what it finds. Use periodically, or when the docs look out of sync, stale, or inconsistent.
---

# Docs audit (gardener)

Run the deterministic checks via the script, then the judgment checks, then fix (asking first only if a fix is destructive).

1. **Deterministic checks — scripted, don't do by eye**: run `node .claude/skills/docs-audit/check.mjs`. It verifies **index completeness** (every `docs/**/*.md` reachable from `docs/README.md`), **relative-link resolution** (across `docs/` + `CLAUDE.md` + `CONTRIBUTING.md`), and **ADR numbering + Status line + README-table coverage**, printing `DOCS-AUDIT: findings=N`. Address each finding.
2. **ADR cross-links** (judgment): `Superseded` ADRs are cross-linked both ways; the statuses in the README table match the files.
3. **Code anchors are alive**: spot-check file paths cited in `docs/knowledge/*.md` (`ls` them); mark dead anchors `(stale anchor — verify)` rather than silently deleting the fact.
4. **No duplication**: the same fact stated in two places → keep the canonical one per the placement table, replace the other with a link.
5. **CLAUDE.md honesty**: conventions stated there still match the docs and the ADRs (CLAUDE.md must summarize + link, never fork).
6. **No secrets**: scan docs/ diff-style for anything value-shaped (keys, tokens, connection strings).

Output: a short report — ✅ clean areas, 🔧 fixed items, ⚠️ items needing a human (e.g. "needs owner review" ADRs still unreviewed).
