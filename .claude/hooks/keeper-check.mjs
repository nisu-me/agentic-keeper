#!/usr/bin/env node
/**
 * Stop hook — the "keeper check" (also registered as a PostToolUse hook).
 *
 * Premise: unfiled knowledge dies with the session. When the agent tries to
 * end its turn, this hook checks what the session edited and what the user
 * said, and BLOCKS the stop if knowledge likely went unfiled. Three signals,
 * each nudging at most once per occurrence (per-session state in tmpdir):
 *
 *  1. code — knowledge-bearing paths edited (see CONFIG) while the KB was
 *     never touched. Re-nudges only if MORE such files were edited since
 *     the last nudge.
 *  2. conversation — the user's own messages contain decision/fact language
 *     ("decided", "confirmed", "from now on", "turns out", ...). Knowledge
 *     arriving in chat counts as much as knowledge in code. Fenced code
 *     blocks (pasted logs, stack traces) are ignored. Re-nudges only on new
 *     hits since the last nudge.
 *  3. bulk — a substantial editing session (>= BULK_THRESHOLD files) with
 *     zero KB impact recorded. Nudges once per session.
 *
 * Edited paths come from two sources, unioned: the session transcript, and a
 * per-session log this same script appends to when run as a PostToolUse hook
 * (the transcript is written asynchronously and can lag at Stop time — the
 * log cannot). KB edits are additionally detected ON DISK: any KB file whose
 * mtime is newer than the session's first transcript entry counts, so an
 * agent that files knowledge with shell commands (cat > docs/..., sed -i) is
 * not falsely nagged.
 *
 * Nudges are delivered as Stop-hook feedback (hookSpecificOutput.
 * additionalContext) by default: the agent keeps going exactly as with a
 * block, but Claude Code shows it as feedback, not as a hook error. Set
 * NUDGE_STYLE = 'block' for tools/versions that only honour
 * {"decision":"block"} (Codex CLI, older Claude Code).
 *
 * The explicit "no": if the agent's reply already carries a "Knowledge check:"
 * line, the keeper stays quiet — that line is what a nudge would ask for.
 * Otherwise, after a nudge the follow-up stop is checked once more — if the KB
 * is still untouched and the reply still lacks the line, the keeper nudges ONE
 * more time. Never twice.
 *
 * Any KB or CLAUDE.md edit silences the hook for the rest of the session
 * (the session is demonstrably docs-aware). KB directories are matched
 * relative to the project root, so a docs/ folder inside node_modules or a
 * sub-package does not count.
 *
 * Guards (invariant — never remove):
 *  - stop_hook_active true  -> exit 0, except the single explicit-"no"
 *    follow-up above (the platform also force-ends the turn after 8
 *    consecutive blocks; the keeper never exceeds 2)
 *  - KEEPER_OFF=1           -> exit 0 (per-session escape hatch)
 *  - any parse/read error   -> exit 0 (never wedge a session)
 */
import { readFileSync, writeFileSync, appendFileSync, readdirSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename, relative, isAbsolute, sep } from 'node:path';

/* ═══════════════ CONFIG — adapt this block to your repo (see REPLICATE.md) ═══════════════ */

// Path substrings that mark "knowledge-bearing" code: the directories where a
// change usually implies something worth filing (data model, auth, money,
// external boundaries). EXAMPLES below — replace with YOUR load-bearing paths.
const KNOWLEDGE_HINTS = [
  '/schema/', // data model                 (e.g. Django: '/models/', '/migrations/')
  '/auth/', //   authn/authz                (e.g. '/permissions/', '/policies/')
  '/webhook/', // external callbacks        (e.g. '/callbacks/', '/integrations/')
  '/payments/', // money                    (e.g. '/billing/', '/invoicing/')
  '.env.example', // configuration surface
];

// Where filed knowledge lives. An edit under any of these silences the keeper
// for the session. Entries ending in '/' are directories relative to the
// project root; entries without a '/' are file names matched at any depth.
const KB_PATHS = ['docs/', 'CLAUDE.md'];

// A session that edits at least this many files with zero KB impact gets one nudge.
const BULK_THRESHOLD = 8;

// Decision/fact language in USER messages only (assistant prose would
// self-trigger). Phrases chosen for precision over recall — a missed nudge is
// cheaper than nudge fatigue. ENGLISH-ONLY: if your team chats with the agent
// in another language, adapt these or signal 2 silently never fires.
const CONV_MARKERS =
  /\b(we (decided|agreed)|decided (to|on|that)|agreed (to|on|that)|confirmed|let'?s go with|we'?ll go with|from now on|going forward|deprecated?\b|turns out|the (actual |real )?reason (is|was)|always (use|do)|never (use|do)|rule of thumb)\b/i;

// Escape hatch: set this env var to 1 to silence the keeper for a session.
const KEEPER_OFF_ENV = 'KEEPER_OFF';

// How a nudge reaches the agent. 'feedback' (default): Claude Code shows it as
// "Stop hook feedback" and the agent continues — no red error line. 'block':
// the classic {"decision":"block"} — use it for Codex CLI, or a Claude Code
// version whose Stop hooks don't accept additionalContext.
const NUDGE_STYLE = 'feedback';

/* ═══════════ END CONFIG — everything below is invariant; copy verbatim ═══════════ */

const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);
const KNOWLEDGE_CHECK_LINE = /knowledge check:/i;

// KB entries ending in '/' are directories anchored at the project root;
// entries without a '/' are file names matched at any depth (CLAUDE.md).
const makeIsDocPath = (root) => (p) => {
  const rel = (isAbsolute(p) ? relative(root, p) : p).split(sep).join('/');
  if (rel.startsWith('../')) return false;
  return KB_PATHS.some((k) =>
    k.endsWith('/') ? rel.startsWith(k) : rel === k || rel.endsWith('/' + k),
  );
};

// Pasted logs and stack traces are not decisions — ignore fenced code blocks.
const stripFences = (t) => t.replace(/```[\s\S]*?(```|$)/g, ' ');
const isHarnessText = (t) =>
  t.includes('<local-command') || t.includes('<system-reminder') || t.includes('<command-');

// Was any KB file written on disk since `since` (ms)? Catches knowledge filed
// with shell commands, which never appear as Edit/Write tool calls.
const kbTouchedOnDisk = (root, since) => {
  let budget = 5000; // bounded walk — a KB is small; never stall a stop
  const newer = (p) => {
    try {
      return statSync(p).mtimeMs >= since;
    } catch {
      return false;
    }
  };
  const walk = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return false;
    }
    for (const e of entries) {
      if (--budget < 0) return false;
      if (e.name === 'node_modules' || e.name === '.git') continue;
      const p = join(dir, e.name);
      if (e.isDirectory() ? walk(p) : newer(p)) return true;
    }
    return false;
  };
  return KB_PATHS.some((k) => (k.endsWith('/') ? walk(join(root, k)) : newer(join(root, k))));
};

const nudge = (reason) =>
  console.log(
    JSON.stringify(
      NUDGE_STYLE === 'block'
        ? { decision: 'block', reason }
        : { hookSpecificOutput: { hookEventName: 'Stop', additionalContext: reason } },
    ),
  );

try {
  if (process.env[KEEPER_OFF_ENV] === '1') process.exit(0);

  const input = JSON.parse(readFileSync(0, 'utf8'));
  const root = process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
  const isDocPath = makeIsDocPath(root);
  const sessionKey =
    input.session_id || (input.transcript_path ? basename(input.transcript_path, '.jsonl') : 'unknown');
  const stateFile = join(tmpdir(), `keeper-${sessionKey}.json`);
  const editLog = join(tmpdir(), `keeper-${sessionKey}.edits`);

  // ── PostToolUse mode: record the edited path, say nothing. ──
  if (input.hook_event_name === 'PostToolUse') {
    const p = input.tool_input?.file_path || input.tool_input?.notebook_path;
    if (EDIT_TOOLS.has(input.tool_name) && typeof p === 'string') appendFileSync(editLog, p + '\n');
    process.exit(0);
  }

  let state = { codeCount: 0, convCount: 0, bulkNudged: false, awaitingExplicitNo: false };
  try {
    state = { ...state, ...JSON.parse(readFileSync(stateFile, 'utf8')) };
  } catch {
    /* first stop of the session */
  }
  const saveState = (s) => {
    try {
      writeFileSync(stateFile, JSON.stringify(s));
    } catch {
      /* state is best-effort */
    }
  };

  const edited = new Set();
  try {
    for (const p of readFileSync(editLog, 'utf8').split('\n')) if (p) edited.add(p);
  } catch {
    /* no PostToolUse log (hook not wired, or no edits yet) */
  }

  const userTexts = [];
  let sessionStart = null; // first transcript timestamp — the on-disk check's baseline
  if (input.transcript_path) {
    for (const line of readFileSync(input.transcript_path, 'utf8').split('\n')) {
      if (!line) continue;
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      if (sessionStart === null && typeof entry?.timestamp === 'string') {
        const t = Date.parse(entry.timestamp);
        if (!Number.isNaN(t)) sessionStart = t;
      }
      const content = entry?.message?.content;
      if (!Array.isArray(content)) {
        // Plain-string user message
        if (entry?.type === 'user' && typeof content === 'string') userTexts.push(content);
        continue;
      }
      for (const block of content) {
        if (block?.type === 'tool_use' && EDIT_TOOLS.has(block.name)) {
          const p = block.input?.file_path || block.input?.notebook_path;
          if (typeof p === 'string') edited.add(p);
        } else if (entry?.type === 'user' && block?.type === 'text' && typeof block.text === 'string') {
          userTexts.push(block.text);
        }
      }
    }
  } else if (edited.size === 0) {
    process.exit(0); // nothing to judge
  }

  const paths = [...edited];
  if (paths.some(isDocPath)) process.exit(0); // session is docs-aware — keeper satisfied
  if (sessionStart !== null && kbTouchedOnDisk(root, sessionStart)) process.exit(0); // filed via shell

  // ── Follow-up stop after a keeper block: the one explicit-"no" check. ──
  if (input.stop_hook_active) {
    if (!state.awaitingExplicitNo) process.exit(0); // someone else's block, or already checked
    saveState({ ...state, awaitingExplicitNo: false });
    const last = input.last_assistant_message;
    if (typeof last === 'string' && !KNOWLEDGE_CHECK_LINE.test(last)) {
      nudge(
        'Keeper check (final) — nothing was filed and your reply has no "Knowledge check:" line. ' +
          'File it now (/capture or /adr), or end with "Knowledge check: nothing to record — <why>". ' +
          'This is the last reminder for this occurrence.',
      );
    }
    process.exit(0);
  }

  const knowledgeCount = paths.filter((p) => KNOWLEDGE_HINTS.some((h) => p.includes(h))).length;
  const convHits = userTexts.filter((t) => !isHarnessText(t) && CONV_MARKERS.test(stripFences(t))).length;

  // Once-per-occurrence: each signal re-fires only when its count grows.
  // Loss of the state file just means one extra nudge — fail-safe in the
  // annoying direction.
  const signals = [];
  if (knowledgeCount > state.codeCount)
    signals.push(`knowledge-bearing code edited (${knowledgeCount} file(s))`);
  if (convHits > state.convCount)
    signals.push(`decision/fact language in the user's messages (${convHits} hit(s) — "decided", "confirmed", "from now on", ...)`);
  if (paths.length >= BULK_THRESHOLD && !state.bulkNudged)
    signals.push(`${paths.length} files edited with zero docs impact recorded`);

  if (!signals.length) {
    if (state.awaitingExplicitNo) saveState({ ...state, awaitingExplicitNo: false });
    process.exit(0);
  }

  // Already declared: the reply carries the explicit "Knowledge check:" line the
  // nudge would demand. Record the occurrence as handled and stay quiet.
  if (typeof input.last_assistant_message === 'string' && KNOWLEDGE_CHECK_LINE.test(input.last_assistant_message)) {
    saveState({
      codeCount: knowledgeCount,
      convCount: convHits,
      bulkNudged: state.bulkNudged || paths.length >= BULK_THRESHOLD,
      awaitingExplicitNo: false,
    });
    process.exit(0);
  }

  saveState({
    codeCount: knowledgeCount,
    convCount: convHits,
    bulkNudged: state.bulkNudged || paths.length >= BULK_THRESHOLD,
    awaitingExplicitNo: true,
  });
  nudge(
    `Keeper check — likely-unfiled knowledge in this session: ${signals.join('; ')}. ` +
      'The knowledge base was never touched. Unfiled knowledge dies with the session — do not ' +
      'end on a polite mention. Either file it NOW (/capture for facts, /adr for decisions — ' +
      'placement rules in docs/README.md), or end your reply with the explicit line ' +
      '"Knowledge check: nothing to record — <why>". Knowledge stated in conversation (user ' +
      'corrections, decisions, rationale) counts exactly as much as knowledge in code.',
  );
} catch {
  // Never wedge a session on hook failure.
}
process.exit(0);
