#!/usr/bin/env node
/**
 * SessionStart hook — injects the knowledge-base index + keeper mandate
 * into every fresh/resumed/post-compaction agent session.
 *
 * Contract: stdout becomes session context. Must NEVER fail a session:
 * any error exits 0 silently. Keep output under ~25 lines.
 */
import { readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

try {
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const label = basename(root);

  const adrDir = join(root, 'docs', 'adr');
  let recentAdrs = [];
  if (existsSync(adrDir)) {
    recentAdrs = readdirSync(adrDir)
      .filter((f) => /^\d{4}-.+\.md$/.test(f))
      .sort()
      .slice(-3)
      .reverse();
  }

  const knowledgeDir = join(root, 'docs', 'knowledge');
  const knowledgeFiles = existsSync(knowledgeDir)
    ? readdirSync(knowledgeDir).filter((f) => f.endsWith('.md'))
    : [];

  console.log(
    [
      `[${label} knowledge base]`,
      'Index + placement rules: docs/README.md',
      `Facts: docs/knowledge/{${knowledgeFiles.map((f) => f.replace('.md', '')).join(',')}} | Conventions: docs/conventions/ | Runbooks: docs/runbooks/`,
      `Recent ADRs: ${recentAdrs.join(', ') || '(none yet)'}`,
      'Keeper mandate (non-optional): unfiled knowledge dies with the session. ' +
        'Non-obvious fact -> /capture. Decision -> /adr. Convention change -> docs/conventions/ + tell the user. ' +
        'Knowledge stated in conversation (user corrections, decisions, rationale) counts as much as code — ' +
        'file it the turn it lands, not at session end.',
      'Close every substantial session with an explicit "Knowledge check:" line — what was filed where, ' +
        'or "nothing to record — <why>".',
    ].join('\n'),
  );
} catch {
  // A broken hook must never break a session.
}
process.exit(0);
