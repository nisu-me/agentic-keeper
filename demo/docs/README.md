# Knowledge Base

This directory is the team's committed knowledge base. Agent sessions load it via the SessionStart
hook and are mandated to keep it current (the "keeper" role — see [`/CLAUDE.md`](../CLAUDE.md)). The
same rules apply to humans: if you learned something the hard way, file it here so nobody learns it
the hard way twice.

## Index

| Area | Location | What lives there |
|---|---|---|
| Decisions | [`adr/`](adr/) | Architecture Decision Records — *why* things are built the way they are |
| Conventions | [`conventions/`](conventions/) | Team rules: how we write code, tests, docs — the *how* that ADRs decide |
| Facts | [`knowledge/architecture.md`](knowledge/architecture.md) | Structural knowledge: module map, request lifecycle, persistence topology |
| Facts | [`knowledge/gotchas.md`](knowledge/gotchas.md) | Traps, quirks, and "don't fix this, it's intentional" |
| Facts | [`knowledge/deferred-work.md`](knowledge/deferred-work.md) | Deferred-work register: deprecations, pending decisions, known debt |
| Runbooks | [`runbooks/`](runbooks/) | Steps to perform operational tasks (one file per task) |

> Categories are re-derived per repo: this demo has no third-party services and a trivial domain, so
> there is no `integrations.md` and no `domain-model.md`. If either ever stops being true, add the
> file back with an index row and a placement rule.

## Placement rules — "where does this go?"

| You have... | It goes to... | How |
|---|---|---|
| An architectural decision (chose X over Y, with reasons) | `adr/` | `/adr` skill |
| A non-obvious fact, trap, or quirk of this codebase | `knowledge/gotchas.md` | `/capture` skill |
| Structural knowledge (lifecycle, module map, persistence topology) | `knowledge/architecture.md` | `/capture` skill |
| Agreed-but-deferred work ("we'll come back to this") | `knowledge/deferred-work.md` | `/capture` skill |
| A new or changed team convention | `conventions/` | edit + announce to the team |
| Steps to perform an operational task | `runbooks/<task>.md` | new file + index row |

**Rules:**

1. **One fact, one place.** Link to it from elsewhere; never duplicate.
2. **Everything is reachable from this index.** New file ⇒ new index row.
3. **ADRs are append-only.** To change a decision, write a new ADR that supersedes the old one. Never renumber or rewrite history.
4. **Cite code.** A fact without a `path/to/file` anchor goes stale invisibly.
5. **No secrets, ever.** Env var *names* are fine; values are not. Point your secret scanner at this directory too.
6. **One unit of meaning, one line — never hard-wrap mid-sentence.** Fact entries in `knowledge/*.md` are strict: one fact = one unwrapped line. In other KB docs (ADRs, runbooks), keep each paragraph or bullet on its own single line too. Rationale: markdown rendering ignores source wrapping anyway, while `grep` returns whole thoughts instead of fragments, exact-string edits replace whole units safely, and diffs stay one-unit-per-line. Soft-wrap in your editor.

## ADR index

| # | Title | Status |
|---|---|---|
| [0001](adr/0001-record-architecture-decisions.md) | Record architecture decisions | Accepted |
| [0002](adr/0002-zero-dependency-demo-on-purpose.md) | Zero-dependency demo on purpose | Accepted |
