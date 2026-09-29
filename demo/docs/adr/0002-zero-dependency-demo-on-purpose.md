# ADR-0002: Zero-dependency demo on purpose

- **Status:** Accepted
- **Date:** 2026-07-04
- **Author(s):** the demo owner

## Context

This app exists to demonstrate the keeper system, not to be a production todo service. `npm i && npm start` must work on a bare Node install with zero setup, and the whole codebase must stay small enough to audit by reading it. Every dependency would add an install step, a lockfile, a supply-chain surface, and version churn — all distractions from what the demo is for. The intent is already stated in code (`package.json` description, the header comment in `src/storage/store.mjs`); this ADR makes it a recorded decision instead of a comment.

## Decision

We will keep the demo at zero runtime and dev dependencies: `node:` built-ins only — `node:http` for the server, `node:fs` whole-file JSON persistence, `node:crypto` for ids — with the UI served as one inline page from `src/server.mjs`. No framework, no database, no client-side libraries, no build step.

## Consequences

- Agents and devs **must never** add a `dependencies` or `devDependencies` entry to `package.json`; wanting a library is the signal the code belongs in a real project, not this demo. Reversing this requires a superseding ADR.
- Persistence **must** stay the naive whole-file JSON store (`src/storage/store.mjs`); its known limits are documented as gotchas in [`knowledge/gotchas.md`](../knowledge/gotchas.md), not fixed with a database.
- Any tooling this repo needs (tests, checks) **must** be plain `node` scripts, like `scripts/keeper-check.smoke.mjs`.

## Alternatives considered

A minimal framework + embedded DB (nicer code, but `npm i` grows a lockfile and the demo stops being copy-paste auditable); a pure in-memory store (even simpler, but state surviving restarts is needed to demonstrate persistence gotchas).
