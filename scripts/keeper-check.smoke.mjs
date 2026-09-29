#!/usr/bin/env node
// Smoke test for .claude/hooks/keeper-check.mjs
// Usage: node scripts/keeper-check.smoke.mjs <path-to-hook> [transcript.jsonl ...]
// Part 1 (only when transcript paths are passed): replay the hook's exact
//         parsing logic against REAL transcripts → does the current transcript
//         format still yield edits + user texts? (format-drift check)
// Part 2 (always): synthetic fixtures through the real hook via stdin → all
//         three signals block; the fail-safe guards and silence cases stay
//         silent; the PostToolUse edit log, root-anchored KB matching, fenced-
//         code filtering, the on-disk KB check (knowledge filed via shell)
//         and the single explicit-"no" follow-up behave.
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync, utimesSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HOOK = process.argv[2];
const TRANSCRIPTS = process.argv.slice(3);
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

// ---- Part 1: format-drift check (mirrors the hook's parse loop exactly) ----
console.log('── Part 1: parse real transcripts with the hook\'s logic ──');
if (TRANSCRIPTS.length === 0) console.log('  (no transcript paths passed — skipped; append .jsonl paths as extra args to run)');
for (const t of TRANSCRIPTS) {
  const edited = new Set();
  const toolNamesSeen = new Set();
  let userTexts = 0, lines = 0, parsed = 0;
  for (const line of readFileSync(t, 'utf8').split('\n')) {
    if (!line) continue;
    lines++;
    let entry;
    try { entry = JSON.parse(line); parsed++; } catch { continue; }
    const content = entry?.message?.content;
    if (!Array.isArray(content)) {
      if (entry?.type === 'user' && typeof content === 'string') userTexts++;
      continue;
    }
    for (const block of content) {
      if (block?.type === 'tool_use') {
        toolNamesSeen.add(block.name);
        if (EDIT_TOOLS.has(block.name)) {
          const p = block.input?.file_path || block.input?.notebook_path;
          if (typeof p === 'string') edited.add(p);
        }
      } else if (entry?.type === 'user' && block?.type === 'text' && typeof block.text === 'string') {
        userTexts++;
      }
    }
  }
  const editToolsPresent = [...toolNamesSeen].filter((n) => EDIT_TOOLS.has(n));
  console.log(`${t.split('/').pop()}`);
  console.log(`  lines=${lines} parsed=${parsed} editedFiles=${edited.size} userTexts=${userTexts}`);
  console.log(`  edit-tools seen: [${editToolsPresent.join(', ')}] | all tools: ${toolNamesSeen.size}`);
  if (parsed === 0) console.log('  ✗ DRIFT: nothing parsed');
  else if (edited.size === 0 && editToolsPresent.length === 0) console.log('  (no edit calls in this session — inconclusive for edits)');
  else console.log('  ✓ format still yields edits/texts');
}

// ---- Part 2: synthetic fixtures through the real hook ----
console.log('\n── Part 2: synthetic fixtures through the real hook ──');
const dir = mkdtempSync(join(tmpdir(), 'keeper-smoke-'));
const ROOT = '/repo';
const mkTranscript = (name, entries) => {
  const p = join(dir, name + '.jsonl');
  writeFileSync(p, entries.map((e) => JSON.stringify(e)).join('\n') + '\n');
  return p;
};
const editEntry = (path) => ({
  type: 'assistant',
  message: { content: [{ type: 'tool_use', name: 'Edit', input: { file_path: path } }] },
});
const userEntry = (text) => ({ type: 'user', message: { content: [{ type: 'text', text }] } });
// A first transcript entry carrying a timestamp — the baseline for the on-disk KB check.
const startedAt = (msAgo) => ({ type: 'user', timestamp: new Date(Date.now() - msAgo).toISOString(), message: { content: 'start' } });
// A real temp repo whose KB file was written `ageMs` ago (as if by a shell command).
const diskRepo = (ageMs) => {
  const root = mkdtempSync(join(tmpdir(), 'keeper-disk-'));
  mkdirSync(join(root, 'docs', 'knowledge'), { recursive: true });
  const f = join(root, 'docs', 'knowledge', 'gotchas.md');
  writeFileSync(f, '- a fact filed with cat > ...\n');
  const t = (Date.now() - ageMs) / 1000;
  utimesSync(f, t, t);
  return root;
};
const KNOWLEDGE_FILE = `${ROOT}/src/orders/schema/order.schema.ts`; // must match a KNOWLEDGE_HINTS entry
const DOC_FILE = `${ROOT}/docs/knowledge/gotchas.md`; // must be under a KB_PATHS directory

// A case is a sequence of hook invocations sharing one session; `expect` is
// checked on each step. Single-step cases use `entries` + `expectBlock`.
const cases = [
  { name: 'signal-1 knowledge-path edit, no docs', entries: [editEntry(KNOWLEDGE_FILE)], expectBlock: true },
  {
    name: 'signal-2 decision language in user msg',
    entries: [userEntry('ok we decided to always use the job queue for this going forward')],
    expectBlock: true,
  },
  {
    name: 'signal-3 bulk: 8 files, no docs',
    entries: Array.from({ length: 8 }, (_, i) => editEntry(`${ROOT}/src/lib/file${i}.ts`)),
    expectBlock: true,
  },
  { name: 'docs touched → silenced', entries: [editEntry(KNOWLEDGE_FILE), editEntry(DOC_FILE)], expectBlock: false },
  {
    name: 'nested docs/ (node_modules) does NOT silence',
    entries: [editEntry(KNOWLEDGE_FILE), editEntry(`${ROOT}/node_modules/some-lib/docs/README.md`)],
    expectBlock: true,
  },
  {
    name: 'system-reminder text excluded',
    entries: [userEntry('<system-reminder>we decided to do things</system-reminder>')],
    expectBlock: false,
  },
  {
    name: 'pasted log in a code fence excluded',
    entries: [userEntry('why does this crash?\n```\n[info] payment confirmed id=42\n[warn] deprecated API used\n```')],
    expectBlock: false,
  },
  {
    name: 'PostToolUse log catches an edit the transcript lags on',
    steps: [
      { post: KNOWLEDGE_FILE, expectBlock: false },
      { entries: [], expectBlock: true },
    ],
  },
  {
    name: 'PostToolUse log: late docs edit silences',
    steps: [
      { post: DOC_FILE, expectBlock: false },
      { entries: [editEntry(KNOWLEDGE_FILE)], expectBlock: false },
    ],
  },
  {
    name: 'explicit no: missing "Knowledge check:" → one final block, never twice',
    steps: [
      { entries: [editEntry(KNOWLEDGE_FILE)], expectBlock: true },
      { entries: [editEntry(KNOWLEDGE_FILE)], stopHookActive: true, last: 'Done — added the field.', expectBlock: true },
      { entries: [editEntry(KNOWLEDGE_FILE)], stopHookActive: true, last: 'Done.', expectBlock: false },
    ],
  },
  {
    name: 'explicit no: "Knowledge check:" line present → silent',
    steps: [
      { entries: [editEntry(KNOWLEDGE_FILE)], expectBlock: true },
      {
        entries: [editEntry(KNOWLEDGE_FILE)],
        stopHookActive: true,
        last: 'Knowledge check: nothing to record — comment-only change.',
        expectBlock: false,
      },
    ],
  },
  {
    name: 'KB filed via shell (on disk, after session start) silences',
    root: diskRepo(1000),
    entries: [startedAt(60_000), editEntry(KNOWLEDGE_FILE)],
    expectBlock: false,
  },
  {
    name: 'KB file on disk but older than the session does NOT silence',
    root: diskRepo(3_600_000),
    entries: [startedAt(60_000), editEntry(KNOWLEDGE_FILE)],
    expectBlock: true,
  },
  {
    name: 'already declared: reply has "Knowledge check:" → quiet; a NEW signal later still nudges',
    steps: [
      { entries: [editEntry(KNOWLEDGE_FILE)], last: 'Done.\n\nKnowledge check: nothing to record — comment only.', expectBlock: false },
      { entries: [editEntry(KNOWLEDGE_FILE), editEntry(KNOWLEDGE_FILE.replace(/(\.\w+)$/, '2$1'))], last: 'Done again.', expectBlock: true },
    ],
  },
  { name: 'guard: stop_hook_active (no keeper block pending)', entries: [editEntry(KNOWLEDGE_FILE)], stopHookActive: true, expectBlock: false },
  { name: 'guard: KEEPER_OFF=1 escape hatch', entries: [editEntry(KNOWLEDGE_FILE)], keeperOff: true, expectBlock: false },
  {
    name: 'guard: unreadable transcript → silent exit 0',
    entries: [],
    transcriptPath: join(dir, 'does-not-exist.jsonl'),
    expectBlock: false,
  },
];

const run = (payload, keeperOff, root = ROOT) =>
  execFileSync('node', [HOOK], {
    input: JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, KEEPER_OFF: keeperOff ? '1' : '0', CLAUDE_PROJECT_DIR: root },
  }).trim();

let pass = 0, fail = 0;
for (const [i, c] of cases.entries()) {
  const session = `smoke-${i}-${process.pid}-${Date.now()}`;
  const steps = c.steps ?? [{ ...c }];
  const results = [];
  let ok = true;
  for (const [j, st] of steps.entries()) {
    let out;
    if (st.post) {
      out = run({ hook_event_name: 'PostToolUse', session_id: session, cwd: ROOT, tool_name: 'Edit', tool_input: { file_path: st.post } }, c.keeperOff, c.root);
    } else {
      const transcript = st.transcriptPath ?? c.transcriptPath ?? mkTranscript(`case${i}-${j}`, st.entries ?? c.entries ?? []);
      out = run(
        {
          hook_event_name: 'Stop',
          session_id: session,
          cwd: ROOT,
          transcript_path: transcript,
          stop_hook_active: !!st.stopHookActive,
          ...(st.last !== undefined && { last_assistant_message: st.last }),
        },
        c.keeperOff,
        c.root,
      );
    }
    // A nudge is either style: {"decision":"block"} or Stop-hook feedback (additionalContext).
    const blocked = /"decision":\s*"block"|"additionalContext"/.test(out);
    const expect = st.expectBlock ?? c.expectBlock;
    results.push(blocked ? 'BLOCK' : 'silent');
    if (blocked !== expect) {
      ok = false;
      if (out) console.log('    output: ' + out.slice(0, 300));
    }
  }
  ok ? pass++ : fail++;
  const want = steps.map((st) => ((st.expectBlock ?? c.expectBlock) ? 'BLOCK' : 'silent')).join(' → ');
  console.log(`  ${ok ? '✓' : '✗'} ${c.name} → ${results.join(' → ')}${ok ? '' : ` (expected ${want})`}`);
}
console.log(`\n${fail === 0 ? '✓ ALL PASS' : '✗ FAILURES'}: ${pass} pass, ${fail} fail`);
process.exit(fail === 0 ? 0 : 1);
