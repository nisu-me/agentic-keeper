# Gotchas

Traps, quirks, and "don't fix this, it's intentional." Entry format: **the fact in bold**, the why in one sentence, a code anchor, a date — all on ONE unwrapped line (see rule 6 in [docs/README.md](../README.md)). Filed via `/capture`.

## Persistence (intentional — do not "fix")

- **Every mutation rewrites the entire `data/todos.json` synchronously — no locking, no atomic rename.** Deliberately naive so `npm start` needs zero setup (see ADR-0002); overlapping requests each do load→mutate→save on the whole file, so concurrent writes can be lost — don't "fix" it with a database. `src/storage/store.mjs:19-22`. *(2026-07)*
- **`data/` is gitignored, so all todo state vanishes on a fresh clone — and a corrupt `todos.json` is silently discarded, not reported.** `load()` swallows every read/parse error and returns `[]`, and the next mutation overwrites the file; a reset to empty is expected behavior, not data-loss to debug. `.gitignore:1`, `src/storage/store.mjs:11-17`. *(2026-07)*

## UI

- **`title` is the only HTML-escaped field in the inline UI — and only the `<` character is escaped.** Todo `id`s are interpolated raw into `onchange`/`onclick` attributes, safe today only because the store emits hex ids and the route regex enforces `[a-f0-9]+` — changing the id scheme breaks both the routes and the escaping assumption. `src/server.mjs:25-26`, `src/server.mjs:44`, `src/storage/store.mjs:31`. *(2026-07)*
