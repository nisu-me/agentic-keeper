# Gotchas

Traps, quirks, and "don't fix this, it's intentional." Entry format: **the fact in bold**, the why in one sentence, a code anchor, a date — all on ONE unwrapped line (see rule 6 in [docs/README.md](../README.md)). Filed via `/capture`. The example below is fictional — replace it with your first real gotcha and delete this sentence.

## Runtime behavior (intentional — do not "fix")

- **The 90-second timeout on report export is intentional.** Acme's PDF service cold-starts in up to 70s on the free tier; the generous timeout is cheaper than the retry storm a short one caused. Confirmed with the team 2026-01. `src/reports/export.service.ts:42`. *(2026-01)*
