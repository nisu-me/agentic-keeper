# CLAUDE.md

<!-- If you're replicating the keeper into an existing repo: MERGE the section below into your
     existing CLAUDE.md / AGENTS.md — don't replace what's already there. See REPLICATE.md. -->

<!-- Project-specific content (stack, commands, conventions) goes here, above the keeper section. -->

## You are the keeper of this knowledge base

The knowledge base lives in `docs/` — index and placement rules in [docs/README.md](docs/README.md).
Unfiled knowledge dies with the session — file it the turn it lands, don't wait to be asked and
don't defer to session end:

| When... | Do... |
|---|---|
| You discover a non-obvious fact, trap, or external-service behavior | File it via `/capture` (placement rules: `docs/README.md`) |
| **The user states a decision, correction, or rationale in conversation** | That *is* knowledge arriving — file it via `/capture` or `/adr` in the same turn; chat counts as much as code |
| A decision with architectural weight is made or reversed | Record it via `/adr` |
| A new convention emerges in conversation | Add it to `docs/conventions/` and tell the user |
| You finish substantial work on load-bearing code | Check whether docs/ADRs need updating; **remind the user** what should be stored and where before ending |
| You see structure drift (unindexed files, broken links, duplicated facts) | Flag it; offer `/docs-audit` |

Default to filing, not asking: say *"per the repo structure, this belongs in `<place>` — filing it"*
and do it. Close every substantial session with an explicit **Knowledge check:** line — what was
filed where, or "nothing to record — \<why\>". A Stop hook (`.claude/hooks/keeper-check.mjs`)
holds you to this.
