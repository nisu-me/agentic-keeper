# keeper demo — watch it work in ten minutes

A deliberately tiny todo app with the keeper pre-installed. It exists so you can watch the keeper
operate during **real agent work** — not a staged file edit. It's a todo app on purpose: every AI
tool already knows the domain, so zero context needs explaining and your attention stays on the keeper.

Everything under `demo/.claude/` and `demo/docs/` was generated **by an agent following
[REPLICATE.md](../REPLICATE.md)** — the same thing your agent will do to your repo. This directory
is the proof the distillation works.

## Run it

```bash
cd demo
npm i && npm start        # zero dependencies — instant
# → http://localhost:3000
```

## The demo

```bash
cd demo && claude         # demo/ must be the project root (its own .claude/ applies)
```

Approve the hooks in the trust dialog — [read them first](.claude/hooks/) if you like; ~340
dependency-free lines. Then notice the session already knows the repo: the `[demo knowledge base]`
block was injected at startup. Ask: *"where do gotchas go here, and what are the recent ADRs?"* —
it answers without exploring.

Now paste the feature request. It trips both keeper signals: the agent has to edit a `/schema/`
path (signal 1), and your message states a decision, "from now on" (signal 2):

> Add due dates to tasks, with overdue highlighting. From now on, store every date as an ISO 8601
> string.

Then one of two things happens:

- The agent captures the knowledge on its own before finishing, or declines with a
  `Knowledge check: nothing to record — <why>` line (the mandate in `CLAUDE.md` asks for one or the
  other). The hook sees that and stays quiet.
- The agent tries to end its turn without capturing anything. The hook holds the turn open, naming
  both signals, and the agent must either file the knowledge (`/capture` / `/adr`) or end with the
  literal line `Knowledge check: nothing to record — <why>`.

If the agent captured the decision, start one more session and ask about due dates: it answers from
the KB it just wrote, without re-reading the code.

## Verify the machinery yourself

```bash
node .claude/skills/docs-audit/check.mjs                          # index/links/ADRs → findings=0
node scripts/keeper-check.smoke.mjs .claude/hooks/keeper-check.mjs # 17/17: signals nudge, guards stay silent
```

The seeded KB is real, not lorem: the three entries in [`docs/knowledge/gotchas.md`](docs/knowledge/gotchas.md)
are genuine, code-anchored facts about this app (try disproving one), and
[ADR-0002](docs/adr/0002-zero-dependency-demo-on-purpose.md) records an actual decision.
