// Tiny zero-dependency todo server: JSON API + a one-page UI.
// Run: npm start → http://localhost:3000
import { createServer } from 'node:http';
import { validateTodoInput } from './todos/schema/todo.schema.mjs';
import { listTodos, createTodo, toggleTodo, deleteTodo } from './storage/store.mjs';

const PORT = process.env.PORT || 3000;

const PAGE = `<!doctype html>
<meta charset="utf-8"><title>keeper demo — todos</title>
<style>
  body{font:16px/1.5 system-ui;max-width:32rem;margin:3rem auto;padding:0 1rem}
  li{display:flex;gap:.5rem;align-items:center;padding:.25rem 0}
  li.done span{text-decoration:line-through;opacity:.5}
  form{display:flex;gap:.5rem;margin-bottom:1rem} input{flex:1;padding:.4rem}
</style>
<h1>todos</h1>
<form id="f"><input id="t" placeholder="What needs doing?" autofocus><button>Add</button></form>
<ul id="list"></ul>
<script>
  async function refresh(){
    const todos = await (await fetch('/api/todos')).json();
    list.innerHTML = todos.map(t =>
      '<li class="'+(t.done?'done':'')+'"><input type="checkbox" '+(t.done?'checked':'')+
      ' onchange="toggle(\\''+t.id+'\\')"><span>'+t.title.replace(/</g,'&lt;')+'</span>'+
      '<button onclick="del(\\''+t.id+'\\')">×</button></li>').join('');
  }
  async function toggle(id){ await fetch('/api/todos/'+id, {method:'PATCH'}); refresh(); }
  async function del(id){ await fetch('/api/todos/'+id, {method:'DELETE'}); refresh(); }
  f.onsubmit = async (e) => { e.preventDefault();
    await fetch('/api/todos', {method:'POST', headers:{'content-type':'application/json'},
      body: JSON.stringify({title: t.value})}); t.value=''; refresh(); };
  refresh();
</script>`;

function json(res, code, body) {
  res.writeHead(code, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

createServer(async (req, res) => {
  const { method } = req;
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const idMatch = url.pathname.match(/^\/api\/todos\/([a-f0-9]+)$/);

  if (method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end(PAGE);
  }
  if (method === 'GET' && url.pathname === '/api/todos') return json(res, 200, listTodos());
  if (method === 'POST' && url.pathname === '/api/todos') {
    let raw = '';
    for await (const chunk of req) raw += chunk;
    let body;
    try {
      body = JSON.parse(raw || '{}');
    } catch {
      return json(res, 400, { errors: ['invalid JSON'] });
    }
    const errors = validateTodoInput(body);
    if (errors.length) return json(res, 400, { errors });
    return json(res, 201, createTodo(body.title));
  }
  if (method === 'PATCH' && idMatch) {
    const todo = toggleTodo(idMatch[1]);
    return todo ? json(res, 200, todo) : json(res, 404, { errors: ['not found'] });
  }
  if (method === 'DELETE' && idMatch) {
    return deleteTodo(idMatch[1]) ? json(res, 204, {}) : json(res, 404, { errors: ['not found'] });
  }
  json(res, 404, { errors: ['no such route'] });
}).listen(PORT, () => console.log(`keeper demo todos → http://localhost:${PORT}`));
