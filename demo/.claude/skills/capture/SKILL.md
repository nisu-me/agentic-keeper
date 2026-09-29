---
name: capture
description: Files a discovered fact, gotcha, or external-service behavior into the docs/ knowledge base in the right place and keeps the index current. Use whenever a non-obvious fact about the codebase, infra, or an integration is learned, stated by the user, or discovered while debugging.
---

# Capture a fact

1. **Pick the destination from the placement-rules table in [`docs/README.md`](../../../docs/README.md)** — the canonical map (don't reproduce it here; it routes facts to the right knowledge file or a `runbooks/<task>.md`). One capture-specific redirect: if it's actually a *decision* with rationale → stop and use `/adr` instead. New runbook file ⇒ add an index row in `docs/README.md`.
2. **Dedupe first**: grep the destination file for the key terms. If an entry already covers it, update that entry in place (append new detail, refresh the date) — never add a near-duplicate.
3. **Write the entry** matching the file's existing format: the fact in bold or as a row, the why/context in one sentence, a code anchor (`path/to/file.ext` or env key), and a date `*(YYYY-MM)*`. **One fact = one unwrapped line** (no hard wraps): `grep` then returns whole facts, and exact-string edits replace whole facts (rule 6 in `docs/README.md`).
4. **No secrets** — env var names yes, values never (make sure your secret scanner covers docs/ too).
5. Confirm to the user: file + section where it landed, and quote the entry.
