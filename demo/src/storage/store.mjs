// JSON-file persistence. No database on purpose: `npm i && npm start` must
// work with zero setup. Writes are synchronous and whole-file — fine for a
// demo, deliberately naive for anything else.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const DATA_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'data', 'todos.json');

function load() {
  try {
    return JSON.parse(readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function save(todos) {
  mkdirSync(dirname(DATA_FILE), { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(todos, null, 2));
}

export function listTodos() {
  return load();
}

export function createTodo(title) {
  const todos = load();
  const todo = {
    id: randomBytes(6).toString('hex'),
    title: title.trim(),
    done: false,
    created_at: new Date().toISOString(),
  };
  todos.push(todo);
  save(todos);
  return todo;
}

export function toggleTodo(id) {
  const todos = load();
  const todo = todos.find((t) => t.id === id);
  if (!todo) return null;
  todo.done = !todo.done;
  save(todos);
  return todo;
}

export function deleteTodo(id) {
  const todos = load();
  const next = todos.filter((t) => t.id !== id);
  if (next.length === todos.length) return false;
  save(next);
  return true;
}
