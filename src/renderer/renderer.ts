interface Api {
  vaultExists(): Promise<boolean>;
  isLocked(): Promise<boolean>;
  setup(pw: string): Promise<{ ok: boolean; error?: string }>;
  unlock(pw: string): Promise<{ ok: boolean; error?: string }>;
  lock(): Promise<void>;
  list(): Promise<{ id: number; name: string; username: string }[]>;
  add(input: { name: string; username: string; password: string }): Promise<number>;
  see(id: number): Promise<{ id: number; name: string; username: string; password: string } | null>;
  edit(id: number, input: { name: string; username: string; password: string }): Promise<boolean>;
  remove(id: number): Promise<boolean>;
  copy(id: number, field: 'password' | 'username'): Promise<boolean>;
  onLocked(cb: () => void): void;
}

const api = (window as unknown as { api: Api }).api;
const app = document.getElementById('app')!;

let attemptsRemaining = 3;

function el(html: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

function toast(message: string): void {
  const t = el(`<div class="toast">${escape(message)}</div>`);
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1800);
}

async function start(): Promise<void> {
  const exists = await api.vaultExists();
  if (!exists) renderSetup();
  else renderUnlock();
}

function renderSetup(): void {
  app.innerHTML = '';
  const card = el(`
    <div class="center">
      <div class="card">
        <h1>Create vault</h1>
        <p class="subtitle">Set a master password. It cannot be recovered.</p>
        <label>Master password</label>
        <input type="password" id="pw1" autofocus />
        <label>Confirm password</label>
        <input type="password" id="pw2" />
        <div class="error" id="err"></div>
        <div class="btn-row">
          <button id="create">Create vault</button>
        </div>
      </div>
    </div>
  `);
  app.appendChild(card);

  const pw1 = card.querySelector<HTMLInputElement>('#pw1')!;
  const pw2 = card.querySelector<HTMLInputElement>('#pw2')!;
  const err = card.querySelector<HTMLElement>('#err')!;
  const btn = card.querySelector<HTMLButtonElement>('#create')!;

  async function submit(): Promise<void> {
    err.textContent = '';
    if (!pw1.value) { err.textContent = 'Password required.'; return; }
    if (pw1.value !== pw2.value) { err.textContent = 'Passwords do not match.'; return; }
    btn.disabled = true;
    const result = await api.setup(pw1.value);
    btn.disabled = false;
    if (!result.ok) { err.textContent = result.error ?? 'Setup failed.'; return; }
    renderList();
  }

  btn.addEventListener('click', submit);
  pw2.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
}

function renderUnlock(): void {
  app.innerHTML = '';
  const card = el(`
    <div class="center">
      <div class="card">
        <h1>Unlock vault</h1>
        <p class="subtitle">Enter your master password to continue.</p>
        <label>Master password</label>
        <input type="password" id="pw" autofocus />
        <div class="error" id="err"></div>
        <div class="btn-row">
          <button id="unlock">Unlock</button>
        </div>
      </div>
    </div>
  `);
  app.appendChild(card);

  const pw = card.querySelector<HTMLInputElement>('#pw')!;
  const err = card.querySelector<HTMLElement>('#err')!;
  const btn = card.querySelector<HTMLButtonElement>('#unlock')!;

  async function submit(): Promise<void> {
    err.textContent = '';
    if (!pw.value) return;
    btn.disabled = true;
    const result = await api.unlock(pw.value);
    btn.disabled = false;
    if (!result.ok) {
      attemptsRemaining -= 1;
      if (attemptsRemaining <= 0) {
        err.textContent = 'Too many failed attempts.';
        btn.disabled = true;
        return;
      }
      err.textContent = `Wrong password. ${attemptsRemaining} attempt(s) remaining.`;
      pw.value = '';
      pw.focus();
      return;
    }
    attemptsRemaining = 3;
    renderList();
  }

  btn.addEventListener('click', submit);
  pw.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
}

async function renderList(): Promise<void> {
  app.innerHTML = '';
  const layout = el(`
    <div style="display:flex;flex-direction:column;height:100%;">
      <header>
        <h1>Password Manager</h1>
        <div class="actions">
          <button id="add">+ Add credential</button>
          <button id="lock" class="secondary">Lock</button>
        </div>
      </header>
      <main id="list-body"></main>
    </div>
  `);
  app.appendChild(layout);

  layout.querySelector<HTMLButtonElement>('#add')!.addEventListener('click', () => renderAddModal());
  layout.querySelector<HTMLButtonElement>('#lock')!.addEventListener('click', async () => {
    await api.lock();
    renderUnlock();
  });

  await refreshList();
}

async function refreshList(): Promise<void> {
  const body = document.getElementById('list-body')!;
  let rows: { id: number; name: string; username: string }[];
  try {
    rows = await api.list();
  } catch {
    renderUnlock();
    return;
  }

  if (rows.length === 0) {
    body.innerHTML = '<div class="empty">No credentials yet. Click + Add credential to get started.</div>';
    return;
  }

  body.innerHTML = '';
  const table = el(`
    <table>
      <thead>
        <tr><th style="width:60px">ID</th><th>Name</th><th>Username</th><th></th></tr>
      </thead>
      <tbody></tbody>
    </table>
  `);
  const tbody = table.querySelector('tbody')!;
  for (const r of rows) {
    const tr = el(`
      <tr>
        <td>${r.id}</td>
        <td>${escape(r.name)}</td>
        <td>${escape(r.username)}</td>
        <td class="actions">
          <button data-act="see" data-id="${r.id}" class="secondary">See</button>
          <button data-act="copy" data-id="${r.id}" class="secondary">Copy</button>
          <button data-act="edit" data-id="${r.id}" class="secondary">Edit</button>
          <button data-act="remove" data-id="${r.id}" class="danger">Delete</button>
        </td>
      </tr>
    `);
    tbody.appendChild(tr);
  }
  body.appendChild(table);

  body.addEventListener('click', async (e) => {
    const target = (e.target as HTMLElement).closest('button[data-act]') as HTMLButtonElement | null;
    if (!target) return;
    const id = Number(target.dataset.id);
    const act = target.dataset.act;
    if (act === 'see') await renderSeeModal(id);
    else if (act === 'copy') await copyPassword(id);
    else if (act === 'edit') await renderEditModal(id);
    else if (act === 'remove') await removeCredential(id);
  });
}

async function copyPassword(id: number): Promise<void> {
  try {
    const ok = await api.copy(id, 'password');
    if (ok) toast('Password copied');
  } catch {
    renderUnlock();
  }
}

async function removeCredential(id: number): Promise<void> {
  if (!confirm(`Delete credential ${id}?`)) return;
  try {
    await api.remove(id);
    await refreshList();
  } catch {
    renderUnlock();
  }
}

function modal(content: string): { root: HTMLElement; close: () => void } {
  const root = el(`<div class="modal-bg"><div class="modal">${content}</div></div>`);
  document.body.appendChild(root);
  const close = (): void => root.remove();
  root.addEventListener('click', (e) => { if (e.target === root) close(); });
  return { root, close };
}

function renderAddModal(): void {
  const { root, close } = modal(`
    <h2>Add credential</h2>
    <label>Name</label>
    <input type="text" id="name" autofocus />
    <label>Username / email</label>
    <input type="text" id="username" />
    <label>Password</label>
    <input type="password" id="password" />
    <div class="error" id="err"></div>
    <div class="btn-row">
      <button id="cancel" class="secondary">Cancel</button>
      <button id="save">Save</button>
    </div>
  `);

  root.querySelector<HTMLButtonElement>('#cancel')!.addEventListener('click', close);
  root.querySelector<HTMLButtonElement>('#save')!.addEventListener('click', async () => {
    const name = root.querySelector<HTMLInputElement>('#name')!.value.trim();
    const username = root.querySelector<HTMLInputElement>('#username')!.value.trim();
    const password = root.querySelector<HTMLInputElement>('#password')!.value;
    const err = root.querySelector<HTMLElement>('#err')!;
    if (!name || !username || !password) { err.textContent = 'All fields required.'; return; }
    try {
      await api.add({ name, username, password });
      close();
      await refreshList();
    } catch {
      renderUnlock();
    }
  });
}

async function renderSeeModal(id: number): Promise<void> {
  let cred;
  try {
    cred = await api.see(id);
  } catch {
    renderUnlock();
    return;
  }
  if (!cred) return;

  const { root, close } = modal(`
    <h2>${escape(cred.name)}</h2>
    <label>Username</label>
    <div class="value">${escape(cred.username)}</div>
    <label>Password</label>
    <div class="field-row">
      <div class="value" id="pwval" style="flex:1">••••••••</div>
      <button id="reveal" class="secondary">Show</button>
      <button id="copy" class="secondary">Copy</button>
    </div>
    <div class="btn-row">
      <button id="close" class="secondary">Close</button>
    </div>
  `);

  let revealed = false;
  const pwval = root.querySelector<HTMLElement>('#pwval')!;
  const revealBtn = root.querySelector<HTMLButtonElement>('#reveal')!;
  revealBtn.addEventListener('click', () => {
    revealed = !revealed;
    pwval.textContent = revealed ? cred!.password : '••••••••';
    revealBtn.textContent = revealed ? 'Hide' : 'Show';
  });
  root.querySelector<HTMLButtonElement>('#copy')!.addEventListener('click', async () => {
    await api.copy(id, 'password');
    toast('Password copied');
  });
  root.querySelector<HTMLButtonElement>('#close')!.addEventListener('click', close);
}

async function renderEditModal(id: number): Promise<void> {
  let cred;
  try {
    cred = await api.see(id);
  } catch {
    renderUnlock();
    return;
  }
  if (!cred) return;

  const { root, close } = modal(`
    <h2>Edit credential</h2>
    <label>Name</label>
    <input type="text" id="name" value="${escape(cred.name)}" autofocus />
    <label>Username / email</label>
    <input type="text" id="username" value="${escape(cred.username)}" />
    <label>New password (blank to keep existing)</label>
    <input type="password" id="password" />
    <div class="error" id="err"></div>
    <div class="btn-row">
      <button id="cancel" class="secondary">Cancel</button>
      <button id="save">Save</button>
    </div>
  `);

  root.querySelector<HTMLButtonElement>('#cancel')!.addEventListener('click', close);
  root.querySelector<HTMLButtonElement>('#save')!.addEventListener('click', async () => {
    const name = root.querySelector<HTMLInputElement>('#name')!.value.trim();
    const username = root.querySelector<HTMLInputElement>('#username')!.value.trim();
    const password = root.querySelector<HTMLInputElement>('#password')!.value;
    const err = root.querySelector<HTMLElement>('#err')!;
    if (!name || !username) { err.textContent = 'Name and username required.'; return; }
    try {
      await api.edit(id, { name, username, password });
      close();
      await refreshList();
    } catch {
      renderUnlock();
    }
  });
}

api.onLocked(() => {
  toast('Session timed out');
  renderUnlock();
});

start();
