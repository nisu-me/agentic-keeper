# ADR-0001: Record architecture decisions

- **Status:** Accepted
- **Date:** 2026-07-04
- **Author(s):** the team

## Context

Decisions with architectural weight — library choices, patterns, team rules — get made in conversations and pull requests, then evaporate. Months later nobody remembers *why* the code looks the way it does, and both humans and AI agents re-litigate settled questions or "fix" deliberate choices. AI coding sessions make this worse: an agent that doesn't know a decision exists will happily reverse it.

## Decision

We will record architecture decisions as ADRs in `docs/adr/`, numbered sequentially, using [`template.md`](template.md). ADRs are created the moment a decision is made (the `/adr` skill), not in retrospective batches. Superseding a decision means a new ADR that links back — never editing history.

## Consequences

- Every ADR's **Consequences** section must contain explicit, mechanical rules (must / must never) — it is loaded into agent sessions and read literally.
- Agents and devs **must** check `docs/adr/` before reversing any pattern that looks deliberate.
- Agents and devs **must never** renumber, rewrite, or delete an accepted ADR.
- The ADR table in [`docs/README.md`](../README.md) must gain a row for every new ADR.
