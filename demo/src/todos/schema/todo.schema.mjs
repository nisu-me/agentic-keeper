// The todo data shape. This file lives under a /schema/ path on purpose:
// it is the demo's "knowledge-bearing" code — edit it and end your agent's
// turn, and the keeper should block (signal 1).
export const TODO_FIELDS = {
  id: 'string', // nanoid-style opaque id, assigned by the store
  title: 'string', // required, 1..200 chars
  done: 'boolean',
  created_at: 'string', // ISO timestamp
};

export function validateTodoInput(body) {
  const errors = [];
  if (typeof body?.title !== 'string' || !body.title.trim()) errors.push('title: required non-empty string');
  if (body.title && body.title.length > 200) errors.push('title: max 200 chars');
  return errors;
}
