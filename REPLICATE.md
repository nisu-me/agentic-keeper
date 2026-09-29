# REPLICATE.md — instructions for the agent performing this setup

You are an AI coding agent, and a user has pointed you here to set up the **keeper system** in
their repository. This file is your specification. Follow it in order. Do not improvise on the
invariants; adapt only what this file marks as adaptable.

**The model: distillation, not forking.** You are transferring the *machinery* for capturing
knowledge — never any knowledge content. The target repo earns its own gotchas and ADRs.

## 0. What you are installing (read these files first)

| File | Role |
|---|---|
| `.claude/hooks/session-start.mjs` | Injects the KB index + keeper mandate into every session |
| `.claude/hooks/keeper-check.mjs` | Stop hook: holds the turn open when knowledge likely went unfiled. Also registered as a PostToolUse hook, where it silently logs edited paths (the transcript can lag at Stop time); KB files written by shell commands are caught by an on-disk mtime check |
| `.claude/settings.json` | Hook wiring + `.env` read-deny |
| `.claude/skills/{capture,adr,docs-audit}/` | Filing verbs: facts, decisions, drift repair |
| `.claude/agents/docs-reviewer.md` | Read-only necessity-first KB review agent (judgment half of Repair; `/docs-audit` applies fixes) |
| `docs/` (README + adr/ + knowledge/ + conventions/ + runbooks/) | The KB skeleton: index, placement rules, ADR machinery, starter categories |
| `CLAUDE.md` (keeper section) | The mandate, loaded every session |
| `scripts/keeper-check.smoke.mjs` | Regression test for the hook — the keeper tests itself |
| `.prettierignore` + `.editorconfig` | Formatter protection for the KB (see §1.7) |

## 1. Questions to ask the user (ask ALL before writing anything)

1. **Load-bearing paths** — "Which directories, when edited, usually mean something worth
   documenting happened? (data model / migrations, auth, money, external boundaries...)" →
   becomes `KNOWLEDGE_HINTS` in the CONFIG block. Propose candidates from their tree; confirm.
2. **KB location** — default `docs/`; respect an existing docs tree if one exists → `KB_PATHS`.
3. **Domain → knowledge categories** — the starter set (architecture, domain-model, integrations,
   gotchas, deferred-work) is generic. Ask what their domain accumulates: a payments product grows
   `money-flows.md`; an ML product grows `pipelines.md`. Re-derive the category list and the
   placement-rules table with them.
4. **Chat language** — the `CONV_MARKERS` regex detects decision language in ENGLISH. If the team
   chats with the agent in another language, translate/extend the markers or signal 2 never fires.
5. **Existing agent config** — is there a CLAUDE.md / AGENTS.md / existing `.claude/settings.json`?
   You will MERGE into these, never clobber. **Check for symlinks first** (`ls -la CLAUDE.md
   AGENTS.md`): many templates ship `CLAUDE.md -> AGENTS.md`, and a naive append writes through the
   link into a file the user may not want touched. If one symlinks the other, ask the user which
   arrangement they want and name the trade-off: merging into the link target keeps one source of
   truth that every tool sees; breaking the link creates two copies that WILL drift (violating the
   KB's own one-fact-one-place rule) and hides the mandate from tools that read only the other file.
   If you keep the symlink, add the target filename (e.g. `AGENTS.md`) to `KB_PATHS` so edits to it
   count as docs-awareness. (Recent Claude Code versions read `AGENTS.md` natively when no CLAUDE.md
   exists, and Edit/Write refuse to write through a symlink — they redirect you to the target. Still
   ask: the question is which file the team treats as canonical, not whether the write succeeds.)
6. **Tool** — Claude Code is the reference target. Other tools: see §5 before promising anything.
7. **Formatter audit** — does the target repo run Prettier, markdownlint, or editor format-on-save
   over markdown? The one-unit-one-line rule (docs/README.md rule 6) dies silently under prose
   re-wrapping. If yes: add `docs/` to `.prettierignore` (or a `proseWrap: "preserve"` override for
   that path), disable markdownlint's line-length rule (MD013) for `docs/knowledge/`, and merge the
   scaffold's `.editorconfig` stanza. The scaffold ships `.prettierignore` + `.editorconfig` as templates.
   If the answer is NO (no formatter today), skip the templates but **file the decision as a
   `deferred-work.md` entry** ("before ever adopting a formatter, exempt `docs/` first") — so the
   trap is on record when someone adds Prettier next year.

## 2. Copy verbatim vs adapt

| Artifact | Verbatim? | Adaptation allowed |
|---|---|---|
| `keeper-check.mjs` below the `END CONFIG` line | **VERBATIM** | none |
| `keeper-check.mjs` CONFIG block | adapt | `KNOWLEDGE_HINTS`, `KB_PATHS` (entries ending in `/` are root-relative directories; bare names like `CLAUDE.md` match at any depth), `BULK_THRESHOLD`, `CONV_MARKERS` (language), `KEEPER_OFF_ENV`, `NUDGE_STYLE` (`'feedback'` default; `'block'` for Codex CLI or a Claude Code version whose Stop hooks reject `additionalContext`) |
| `session-start.mjs` | verbatim | only if KB lives somewhere other than `docs/` — then update EVERY `docs/` literal in the file: the `adrDir` and `knowledgeDir` joins, the printed `Index + placement rules:` pointer, the `Facts:`/`Conventions:`/`Runbooks:` line, and the `docs/conventions/` mention inside the mandate text (grep the file for `docs` — 7 occurrences) |
| `settings.json` | merge | add the three hook entries (SessionStart, Stop, PostToolUse — the last two run the same script) + `.env` denies into existing settings |
| Skills | **VERBATIM** | none — the skills deliberately defer to `docs/README.md` for categories, so §1.3 changes land there, not here |
| `.claude/agents/docs-reviewer.md` | **VERBATIM** | none — like the skills, it reads categories from `docs/README.md` at run time |
| `docs/` skeleton | adapt | categories per §1.3; keep the index + placement table + 6 rules + ADR machinery intact; delete the fictional examples (visible entries in `gotchas`/`integrations`, commented blocks in the other three); **replace the "Replicating this setup?" blockquote** with a repo-specific note (or delete it — it points at a REPLICATE.md the target repo doesn't have); **set ADR-0001's `Date:`** to today (the `YYYY-MM-DD` placeholder is easy to miss and `check.mjs` won't catch it) |
| `CLAUDE.md` keeper section | merge | append to their existing CLAUDE.md/AGENTS.md; keep the table + Knowledge-check rule intact |
| `scripts/keeper-check.smoke.mjs` | verbatim | except the two fixture constants near the top of Part 2: set `KNOWLEDGE_FILE` to a path that matches one of YOUR `KNOWLEDGE_HINTS`, and `DOC_FILE` to a path under one of your `KB_PATHS` directories. Every would-block fixture (including the guard cases) uses `KNOWLEDGE_FILE` — with a path that matches no hint, the guard fixtures pass **vacuously** (silent whether or not the guard works), so the suite goes green while verifying nothing |
| `.prettierignore` / `.editorconfig` | merge | per §1.7 — protect the KB from prose re-wrapping in the target repo's formatter setup |

## 3. Invariants — these MUST survive your adaptation

1. **Never wedge a session**: every error path in both hooks exits 0.
2. **`stop_hook_active` guard stays** (prevents infinite block loops). The only exception is the
   single explicit-"no" follow-up (invariant 6): at most two consecutive keeper blocks, ever. The
   platform force-ends the turn after 8 consecutive continuations anyway — raisable via
   `CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`.
3. **Precision over recall** in `CONV_MARKERS`: a missed nudge is cheaper than nudge fatigue. Do not
   "improve" recall with broad patterns.
4. **Once-per-occurrence nudging** via tmpdir state — do not remove the state file logic.
5. **A KB edit silences the whole session** — deliberate; do not make it per-signal.
6. **The forced explicit "no"**: the nudge text must require either filing NOW or the literal line
   `Knowledge check: nothing to record — <why>`. If the reply already carries the line, the keeper
   stays quiet; otherwise the follow-up stop checks `last_assistant_message` and nudges exactly once
   more if it's still missing. It is still a text marker — an agent
   can write it without meaning it — which is why the `<why>` must be stated and KB diffs go through
   code review.
7. **Edits are the union of transcript + PostToolUse log, and KB edits are also checked on disk.**
   Keep the PostToolUse registration (the transcript is written asynchronously and can miss the
   turn's last edits at Stop time) and the mtime check (agents often file docs with shell commands,
   which no tool log sees — without it, correct filing gets nagged).

## 4. Verification checklist — run ALL before telling the user you're done

> ⚠️ **Hooks installed mid-session are NOT active in the session that installed them** — they load
> at session start (and settings changes are gated behind user review). Steps 1–2 work immediately;
> steps 3–4 require a FRESH session. Never report a live-fire success you did not observe.

1. `node .claude/skills/docs-audit/check.mjs` → `DOCS-AUDIT: findings=0`.
2. `node scripts/keeper-check.smoke.mjs .claude/hooks/keeper-check.mjs` → `ALL PASS` (17/17). This
   exercises the hook script directly, so it works pre-restart. (If it fails after you changed
   CONFIG: set the `KNOWLEDGE_FILE` / `DOC_FILE` fixture constants — see the smoke-test row in §2.)
3. **Fresh session**: have the user start a new session and confirm the SessionStart injection
   appears (the `[<repo> knowledge base]` block).
4. **Live fire (in that fresh session)**: edit a file under a configured knowledge path (add a
   trivial comment), end the turn → the keeper must block. File a placeholder via `/capture` (then
   remove it) → next stop is silent. Revert the comment. If you cannot span sessions, hand the user
   these exact steps and expected outcomes instead of claiming success.
5. Report to the user: what you adapted (CONFIG values, categories), what you copied verbatim, the
   verification results, and which steps await the fresh session. If you touched anything §3
   protects — say so explicitly and why.

## 5. Other tools (port map — UNTESTED; be honest with your user)

The KB, skills-as-markdown, and CLAUDE.md mandate port anywhere (AGENTS.md-compatible tools
included). The enforcement layer varies. Hook contract is language-neutral (stdin JSON → stdout
JSON); the `.mjs` files are reference implementations — port them if the machine lacks Node.

| Tool | Session-start injection | Turn-end enforcement |
|---|---|---|
| Claude Code | `SessionStart` hook | `Stop` hook, `{"decision":"block","reason":…}` — reference implementation |
| Codex CLI | `SessionStart` | `Stop` — `{"decision":"block","reason":…}` continues the turn with `reason` as a new prompt; `stop_hook_active` and `last_assistant_message` are provided — set `NUDGE_STYLE = 'block'`; otherwise a near-mechanical port |
| Cursor | `sessionStart` | ⚠️ `stop` cannot block (fire-and-forget); degrade to `followup_message` — a nudge *after* the turn, not a gate. Tell the user the difference. |
| Gemini CLI | `SessionStart` | `AfterAgent` — `{"decision":"deny","reason":…}` rejects the response and forces a retry with `reason` as the prompt; `stop_hook_active` provided. A real gate, port untested |

If the user's tool has no blocking turn-end hook, install everything else and say plainly:
"you get the keeper's memory, without its teeth."
