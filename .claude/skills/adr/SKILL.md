---
name: adr
description: Creates an Architecture Decision Record (ADR) in docs/adr/ and indexes it. Use when an architectural or convention-level decision is made, reversed, or found undocumented — choosing a library, changing a pattern, setting a team rule.
---

# Record an ADR

1. **Confirm it's ADR-worthy**: reversing it would touch multiple modules, change a team convention, or surprise a competent reader. Plain facts/gotchas go to `/capture` instead.
2. **Next number**: list `docs/adr/`, take the highest `NNNN` + 1 (4 digits, zero-padded). Never reuse or renumber.
3. **Create** `docs/adr/NNNN-kebab-title.md` from `docs/adr/template.md`. Fill every section; "Consequences" must contain explicit, mechanical rules for agents/devs (must / must never). Status:
   - decided in this conversation → `Accepted`, author = the user
   - reconstructed from existing code → `Accepted (documented retroactively, YYYY-MM)`; add `— needs owner review` if the *rationale* is inferred rather than confirmed.
4. **Superseding?** Set the old ADR's status to `Superseded by ADR-NNNN` (status line only — never rewrite its content) and link back to it from the new ADR's Context.
5. **Index**: add a row to the ADR table in `docs/README.md` (keep numeric order).
6. **Ripple**: if the decision changes a convention stated in `CLAUDE.md` (or your conventions docs), update those to *link* to the new ADR (one fact, one place).
7. Report the created path and summarize the new rules in one or two sentences.
