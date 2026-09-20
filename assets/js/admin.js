/**
 * Painel de gestão (CMS) da Comunidade Entre Nações.
 * Perfis: administrador (tudo) e conteudista (só conteúdo do site).
 */
import {
  html, raw, esc, icon, api, setCsrf, ApiError, $, $$, debounce,
  WEEKDAYS, ageFrom, formatPhone, formatDateShort,
} from './common.js';

const root = document.getElementById('admin');
const S = { user: null, content: null, dirty: {}, defs: null, hash: '' };

const NAV = [
  { id: 'painel', label: 'Painel', icon: 'home', role: 'editor' },
  { id: 'conteudo', label: 'Conteúdo do site', icon: 'layout', role: 'editor' },
  { id: 'eventos', label: 'Eventos', icon: 'calendar', role: 'editor', coll: 'events' },
  { id: 'pastores', label: 'Pastores', icon: 'users', role: 'editor', coll: 'pastors' },
  { id: 'novidades', label: 'Novidades', icon: 'image', role: 'editor', coll: 'highlights' },
  { id: 'membros', label: 'Membros', icon: 'userplus', role: 'admin' },
  { id: 'oracao', label: 'Pedidos de oração', icon: 'heart', role: 'admin' },
  { id: 'usuarios', label: 'Usuários', icon: 'key', role: 'admin' },
  { id: 'configuracoes', label: 'Configurações', icon: 'settings', role: 'admin' },
  { id: 'conta', label: 'Minha conta', icon: 'logout', role: 'editor' },
];

const isAdmin = () => S.user && S.user.role === 'admin';
const roleLabel = (r) => (r === 'admin' ? 'Administrador' : 'Conteudista');
const dirtyCount = () => Object.keys(S.dirty).length;

/* ---------- Avisos e diálogos ---------- */
let toastTimer;
function toast(msg, type = 'ok') {
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
  el.textContent = msg;
  el.className = 'toast toast--' + type + ' is-on';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), type === 'err' ? 6000 : 3200);
}

function openDialog(title, bodyHtml, onSubmit, { submitLabel = 'Salvar' } = {}) {
  const dlg = document.createElement('dialog');
  dlg.className = 'dlg';
  dlg.innerHTML = html`
    <form method="dialog" class="dlg__form" novalidate>
      <header class="dlg__head"><h2>${title}</h2><button type="button" class="iconbtn" data-close aria-label="Fechar">${icon('close', 20)}</button></header>
      <div class="dlg__body">${raw(bodyHtml)}<p class="err" role="alert" hidden></p></div>
      <footer class="dlg__foot"><button type="button" class="btn btn--line" data-close>Cancelar</button><button type="submit" class="btn btn--primary">${submitLabel}</button></footer>
    </form>`.s;
  document.body.appendChild(dlg);
  const close = () => { dlg.close(); dlg.remove(); };
  dlg.addEventListener('click', (e) => { if (e.target === dlg || e.target.closest('[data-close]')) close(); });
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  const form = $('form', dlg);
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('button[type=submit]', dlg);
    const err = $('.err', dlg);
    err.hidden = true;
    btn.disabled = true;
    try { await onSubmit(dlg); close(); } catch (ex) { err.textContent = ex.message; err.hidden = false; btn.disabled = false; }
  });
  dlg.showModal();
  const first = $('input:not([type=hidden]):not([type=file]), textarea, select', dlg);
  if (first) first.focus();
  return dlg;
}

/* ---------- Campos de formulário ---------- */
function fieldHtml(f, value, { showDefault = false } = {}) {
  const key = f.key;
  const v = value == null ? '' : value;
  const help = f.help ? html`<small class="help">${f.help}</small>` : '';
  const lock = f.admin_only ? html`<span class="tag">Somente administrador</span>` : '';
  let control;
  if (f.type === 'textarea') {
    control = html`<textarea data-fkey="${key}" rows="${(f.default && String(f.default).length > 140) || String(v).length > 140 ? 4 : 3}">${v}</textarea>`;
  } else if (f.type === 'image') {
    control = imageField(key, v, showDefault ? f.default : null);
  } else if (f.type === 'weekday') {
    control = html`<select data-fkey="${key}"><option value="">Nenhum (evento especial ou sem dia fixo)</option>${WEEKDAYS.map((d, i) => html`<option value="${i}" ${String(v) === String(i) && v !== '' && v !== null ? raw('selected') : ''}>${d}</option>`)}</select>`;
  } else if (f.type === 'date') {
    control = html`<input type="date" data-fkey="${key}" value="${v || ''}">`;
  } else if (f.type === 'url') {
    control = html`<input type="url" data-fkey="${key}" value="${v}" placeholder="https://">`;
  } else {
    control = html`<input type="text" data-fkey="${key}" value="${v}" ${f.max ? raw('maxlength="' + Number(f.max) + '"') : ''}>`;
  }
  const label = html`<span class="field__label">${f.label}${f.required ? html`<b class="req" title="Obrigatório">*</b>` : ''} ${lock}</span>`;
  if (f.type === 'image') return html`<div class="field field--image">${label}${control}${help}</div>`;
  return html`<div class="field"><label>${label}${control}</label>${help}</div>`;
}

function imageField(key, value, def) {
  return html`
    <div class="imgf" data-imgf="${key}" data-default="${def == null ? '' : def}">
      <div class="imgf__prev">${value ? html`<img src="${value}" alt="">` : html`<span>Sem imagem</span>`}</div>
      <div class="imgf__body">
        <input type="hidden" data-fkey="${key}" value="${value}">
        <code class="imgf__path">${value || 'nenhuma imagem selecionada'}</code>
        <div class="imgf__actions">
          <label class="btn btn--line btn--sm">${icon('image', 16)} Enviar nova imagem<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden data-upload></label>
          ${def != null && def !== '' ? html`<button type="button" class="btn btn--line btn--sm" data-act="img-default">Usar imagem padrão</button>` : ''}
          <button type="button" class="btn btn--ghost btn--sm" data-act="img-clear">Remover</button>
        </div>
      </div>
    </div>`;
}

function setImage(box, value) {
  const input = $('input[data-fkey]', box);
  input.value = value;
  $('.imgf__prev', box).innerHTML = value ? '<img src="' + esc(value) + '" alt="">' : '<span>Sem imagem</span>';
  $('.imgf__path', box).textContent = value || 'nenhuma imagem selecionada';
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function readFields(scope) {
  const out = {};
  $$('[data-fkey]', scope).forEach((el) => {
    out[el.getAttribute('data-fkey')] = el.type === 'checkbox' ? el.checked : el.value;
  });
  return out;
}

/* =====================================================================
 * Entrada e estrutura
 * ===================================================================== */

async function boot() {
  try {
    const me = await api('auth/me');
    if (me.user) { S.user = me.user; setCsrf(me.csrf); return startApp(); }
  } catch (e) { /* mostra login */ }
  renderLogin();
}

function renderLogin(message = '') {
  root.innerHTML = html`
    <main class="login">
      <form class="login__card" id="loginForm" novalidate>
        <img class="login__logo" src="/assets/img/logo-ceen.png" alt="Comunidade Entre Nações" width="150" height="66">
        <h1>Painel do site</h1>
        <p class="muted">Entre com o e-mail e a senha da sua conta.</p>
        <label>E-mail<input name="email" type="email" autocomplete="username" required autofocus></label>
        <label>Senha<input name="password" type="password" autocomplete="current-password" required></label>
        <p class="err" role="alert" ${message ? '' : raw('hidden')}>${message}</p>
        <button class="btn btn--primary btn--block" type="submit">Entrar</button>
        <a class="back" href="/">Voltar para o site</a>
      </form>
    </main>`.s;
  const form = $('#loginForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('button', form); const err = $('.err', form);
    err.hidden = true; btn.disabled = true;
    try {
      const res = await api('auth/login', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
      S.user = res.user; setCsrf(res.csrf);
      startApp();
    } catch (ex) { err.textContent = ex.message; err.hidden = false; btn.disabled = false; }
  });
}

function startApp() {
  root.innerHTML = html`
    <div class="app">
      <aside class="side" id="side">
        <div class="side__top">
          <a class="side__logo" href="/admin/" aria-label="Painel"><img src="/assets/img/logo-ceen.png" alt="Comunidade Entre Nações" width="104" height="46"></a>
          <button class="iconbtn side__close" type="button" data-act="menu" aria-label="Fechar menu">${icon('close', 22)}</button>
        </div>
        <nav class="side__nav" aria-label="Painel">
          ${NAV.filter((n) => n.role === 'editor' || isAdmin()).map((n) => html`<a href="#/${n.id}" data-route="${n.id}">${icon(n.icon, 20)}<span>${n.label}</span></a>`)}
        </nav>
        <div class="side__foot">
          <a class="side__site" href="/" target="_blank" rel="noopener">Ver o site ${icon('chevron', 16)}</a>
          <div class="who"><strong>${S.user.name}</strong><small>${roleLabel(S.user.role)}</small></div>
          <button class="btn btn--line btn--block btn--sm" type="button" data-act="logout">${icon('logout', 16)} Sair</button>
        </div>
      </aside>
      <div class="main">
        <header class="topbar"><button class="iconbtn" type="button" data-act="menu" aria-label="Abrir menu">${icon('menu', 24)}</button><strong>Painel do site</strong></header>
        <main id="view" tabindex="-1"></main>
      </div>
    </div>`.s;
  S.hash = '';
  window.addEventListener('hashchange', onHash);
  window.addEventListener('beforeunload', (e) => { if (dirtyCount()) { e.preventDefault(); e.returnValue = ''; } });
  if (!location.hash) location.hash = '#/painel'; else onHash();
}

async function onHash() {
  const next = location.hash || '#/painel';
  if (S.hash && next !== S.hash && dirtyCount() && S.hash.startsWith('#/conteudo') && !next.startsWith('#/conteudo')) {
    if (!confirm('Você tem alterações não salvas. Sair mesmo assim?')) { history.replaceState(null, '', S.hash); return; }
    S.dirty = {};
  }
  S.hash = next;
  const [, id, sub] = next.split('/');
  const route = NAV.find((n) => n.id === id && (n.role === 'editor' || isAdmin())) || NAV[0];
  $$('.side__nav a').forEach((a) => a.classList.toggle('is-active', a.dataset.route === route.id));
  $('#side').classList.remove('is-open');
  const view = $('#view');
  view.innerHTML = '<p class="loading">Carregando…</p>';
  try {
    if (route.id === 'painel') await viewDashboard(view);
    else if (route.id === 'conteudo') await viewContent(view, sub);
    else if (route.coll) await viewCollection(view, route);
    else if (route.id === 'membros') await viewMembers(view);
    else if (route.id === 'oracao') await viewPrayers(view);
    else if (route.id === 'usuarios') await viewUsers(view);
    else if (route.id === 'configuracoes') await viewSettings(view);
    else if (route.id === 'conta') viewAccount(view);
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) { S.user = null; renderLogin('Sua sessão expirou. Entre novamente.'); return; }
    view.innerHTML = html`<div class="panel"><p class="err">${e.message}</p></div>`.s;
  }
  window.scrollTo(0, 0);
}

function pageHead(title, sub, actions = '') {
  return html`<div class="pagehead"><div><h1>${title}</h1>${sub ? html`<p class="muted">${sub}</p>` : ''}</div><div class="pagehead__actions">${raw(actions)}</div></div>`;
}

/* =====================================================================
 * Painel inicial
 * ===================================================================== */
async function viewDashboard(view) {
  const d = await api('admin/dashboard');
  const c = d.counts;
  const cards = [
    ['Eventos publicados', c.events, '#/eventos', 'calendar'],
    ['Pastores', c.pastors, '#/pastores', 'users'],
    ['Novidades', c.highlights, '#/novidades', 'image'],
  ];
  if (isAdmin()) {
    cards.push(['Membros cadastrados', c.members, '#/membros', 'userplus'], ['Novos neste mês', c.members_month, '#/membros', 'userplus'], ['Pedidos de oração novos', c.prayers_new, '#/oracao', 'heart']);
  }
  view.innerHTML = html`
    ${pageHead('Olá, ' + S.user.name.split(' ')[0], 'Bem-vindo ao painel do site da ' + 'CEN. Aqui você edita textos, fotos, eventos e mais.')}
    <div class="stats">${cards.map((k) => html`<a class="stat" href="${k[2]}"><span class="stat__icon">${icon(k[3], 22)}</span><strong>${k[1]}</strong><span>${k[0]}</span></a>`)}</div>
    <div class="cols">
      <section class="panel">
        <h2>Por onde começar</h2>
        <ul class="tips">
          <li><a href="#/conteudo">Conteúdo do site</a>: troque textos, fotos, contatos e redes sociais de cada página.</li>
          <li><a href="#/eventos">Eventos</a>: atualize a programação semanal e crie eventos especiais com data.</li>
          <li><a href="#/novidades">Novidades</a>: destaque os cartazes e campanhas do momento na página inicial.</li>
          ${isAdmin() ? html`<li><a href="#/configuracoes">Configurações</a>: e-mail remetente, cores e envio de e-mails.</li>` : ''}
        </ul>
      </section>
      ${isAdmin() ? html`<section class="panel"><h2>Últimos membros</h2>
        ${d.recent_members.length ? html`<ul class="recent">${d.recent_members.map((m) => html`<li><strong>${m.name}</strong><span>${m.email}</span></li>`)}</ul><p><a href="#/membros">Ver todos os membros</a></p>` : html`<p class="muted">Nenhum cadastro ainda.</p>`}</section>` : ''}
    </div>`.s;
}

/* =====================================================================
 * Conteúdo do site
 * ===================================================================== */
async function viewContent(view, sub) {
  if (!S.content) S.content = await api('admin/content');
  const groups = S.content.groups;
  const active = groups.find((g) => g.id === sub) || groups[0];
  const val = (k) => (k in S.dirty ? S.dirty[k] : S.content.values[k]);
  view.innerHTML = html`
    ${pageHead('Conteúdo do site', 'Edite os textos e as imagens de cada página. Ao terminar, clique em Salvar alterações.')}
    <div class="tabs" role="tablist">${groups.map((g) => html`<a href="#/conteudo/${g.id}" role="tab" class="tab ${g.id === active.id ? 'is-active' : ''}" aria-selected="${g.id === active.id}">${g.label}</a>`)}</div>
    <div class="panel" id="contentForm">
      ${active.fields.map((f) => fieldHtml(f, val(f.key), { showDefault: true }))}
    </div>
    <div class="savebar" id="savebar" ${dirtyCount() ? '' : raw('hidden')}>
      <span id="dirtyText"></span>
      <button class="btn btn--line" type="button" data-act="discard">Descartar</button>
      <button class="btn btn--primary" type="button" data-act="save-content">Salvar alterações</button>
    </div>`.s;
  updateSavebar();
}

function updateSavebar() {
  const bar = $('#savebar'); if (!bar) return;
  const n = dirtyCount();
  bar.hidden = n === 0;
  $('#dirtyText').textContent = n === 1 ? '1 alteração não salva' : n + ' alterações não salvas';
}

function trackDirty(el) {
  if (!S.content || !$('#contentForm')) return;
  const key = el.getAttribute('data-fkey');
  const original = S.content.values[key];
  if (el.value !== original) S.dirty[key] = el.value; else delete S.dirty[key];
  updateSavebar();
}

async function saveContent(btn) {
  btn.disabled = true;
  try {
    const res = await api('admin/content', { method: 'PUT', body: { values: S.dirty } });
    S.content.values = res.values;
    S.dirty = {};
    updateSavebar();
    toast('Conteúdo salvo. As mudanças já estão no site.');
  } catch (e) { toast(e.message, 'err'); }
  btn.disabled = false;
}

/* =====================================================================
 * Listas: eventos, pastores, novidades
 * ===================================================================== */
function collSummary(name, it) {
  if (name === 'events') {
    const when = it.day_label || (it.event_date ? formatDateShort(it.event_date) : (it.weekday !== null && it.weekday !== undefined ? WEEKDAYS[it.weekday] : 'Sem dia definido'));
    return when + (it.time_label ? ', ' + it.time_label : '');
  }
  if (name === 'pastors') return it.role || '';
  return it.caption || '';
}

async function viewCollection(view, route) {
  const name = route.coll;
  if (!S.defs) S.defs = (await api('admin/collections')).collections;
  const def = S.defs[name];
  let items = (await api('admin/collections/' + name)).items;
  const thumb = (it) => it.image || it.photo || '';

  function draw() {
    view.innerHTML = html`
      ${pageHead(def.label, name === 'events' ? 'Encontros semanais aparecem na programação; eventos com data saem do site sozinhos depois que passam.' : 'Use as setas para mudar a ordem em que aparecem no site.',
        '<button class="btn btn--primary" type="button" data-act="coll-new">' + icon('plus', 18).s + ' Novo ' + esc(def.singular) + '</button>')}
      <div class="panel panel--flush">
        ${items.length ? html`<ul class="rows">${items.map((it, i) => html`
          <li class="row ${it.published ? '' : 'is-off'}" data-id="${it.id}">
            ${thumb(it) ? html`<img class="row__thumb" src="${thumb(it)}" alt="">` : html`<span class="row__thumb row__thumb--ph">${icon(name === 'pastors' ? 'users' : 'calendar', 20)}</span>`}
            <div class="row__main"><strong>${it[def.title_field]}</strong><span>${collSummary(name, it)}</span>${it.published ? '' : html`<em class="tag tag--warn">Oculto no site</em>`}</div>
            <div class="row__actions">
              <button class="iconbtn" type="button" data-act="coll-up" ${i === 0 ? raw('disabled') : ''} aria-label="Subir">${icon('arrowup', 18)}</button>
              <button class="iconbtn" type="button" data-act="coll-down" ${i === items.length - 1 ? raw('disabled') : ''} aria-label="Descer">${icon('arrowdown', 18)}</button>
              <button class="btn btn--line btn--sm" type="button" data-act="coll-edit">${icon('edit', 16)} Editar</button>
              <button class="iconbtn iconbtn--danger" type="button" data-act="coll-del" aria-label="Excluir">${icon('trash', 18)}</button>
            </div>
          </li>`)}</ul>` : html`<p class="empty">Nada cadastrado ainda. Clique em "Novo ${def.singular}" para começar.</p>`}
      </div>`.s;
  }
  draw();

  function form(it) {
    const body = def.fields.map((f) => fieldHtml(f, it ? it[f.key] : '')).join('') +
      html`<label class="check"><input type="checkbox" data-fkey="published" ${!it || it.published ? raw('checked') : ''}> Mostrar no site</label>`.s;
    return body;
  }
  async function save(dlg, it) {
    const data = readFields(dlg);
    const res = it
      ? await api('admin/collections/' + name + '/' + it.id, { method: 'PUT', body: data })
      : await api('admin/collections/' + name, { method: 'POST', body: data });
    items = res.items; draw(); toast('Salvo. A lista do site já foi atualizada.');
  }
  view.onclick = async (e) => {
    const btn = e.target.closest('[data-act]'); if (!btn) return;
    const li = btn.closest('.row'); const it = li ? items.find((x) => x.id === Number(li.dataset.id)) : null;
    const act = btn.dataset.act;
    if (act === 'coll-new') openDialog('Novo ' + def.singular, form(null), (dlg) => save(dlg, null));
    else if (act === 'coll-edit') openDialog('Editar ' + def.singular, form(it), (dlg) => save(dlg, it));
    else if (act === 'coll-del') {
      if (!confirm('Excluir "' + it[def.title_field] + '"? Esta ação não pode ser desfeita.')) return;
      try { items = (await api('admin/collections/' + name + '/' + it.id, { method: 'DELETE' })).items; draw(); toast('Excluído.'); } catch (ex) { toast(ex.message, 'err'); }
    } else if (act === 'coll-up' || act === 'coll-down') {
      const ids = items.map((x) => x.id); const i = ids.indexOf(it.id); const j = act === 'coll-up' ? i - 1 : i + 1;
      [ids[i], ids[j]] = [ids[j], ids[i]];
      try { items = (await api('admin/collections/' + name + '/reorder', { method: 'POST', body: { ids } })).items; draw(); } catch (ex) { toast(ex.message, 'err'); }
    }
  };
}

/* =====================================================================
 * Membros (administrador)
 * ===================================================================== */
async function viewMembers(view) {
  let q = ''; let offset = 0; const limit = 50; let total = 0; let rows = [];
  view.innerHTML = html`
    ${pageHead('Membros', 'Pessoas que se cadastraram pelo site. Estes dados são pessoais: use apenas para o trabalho da igreja.',
      '<a class="btn btn--primary" href="/api/admin/members/export">' + icon('download', 18).s + ' Exportar CSV</a>')}
    <div class="panel panel--flush">
      <div class="toolbar"><input type="search" id="mq" placeholder="Buscar por nome, e-mail ou telefone" aria-label="Buscar membros"><span class="muted" id="mcount"></span></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Nome</th><th>E-mail</th><th>Telefone</th><th>Idade</th><th>Cadastro</th><th></th></tr></thead><tbody id="mrows"></tbody></table></div>
      <p class="more"><button class="btn btn--line" id="mmore" type="button" hidden>Carregar mais</button></p>
    </div>`.s;
  async function load(reset) {
    if (reset) { offset = 0; rows = []; }
    const res = await api('admin/members?limit=' + limit + '&offset=' + offset + '&q=' + encodeURIComponent(q));
    rows = rows.concat(res.members); offset = rows.length; total = res.total;
    $('#mrows').innerHTML = rows.length ? rows.map((m) => html`<tr data-id="${m.id}"><td>${m.name}</td><td>${m.email}</td><td>${formatPhone(m.phone)}</td><td>${ageFrom(m.birthdate)}</td><td>${formatDateShort(String(m.created_at).slice(0, 10))}</td><td><button class="iconbtn iconbtn--danger" type="button" data-act="mem-del" aria-label="Excluir ${m.name}">${icon('trash', 18)}</button></td></tr>`.s).join('') : '<tr><td colspan="6" class="empty">Nenhum membro encontrado.</td></tr>';
    $('#mcount').textContent = total + (total === 1 ? ' membro' : ' membros');
    $('#mmore').hidden = offset >= total;
  }
  $('#mq').addEventListener('input', debounce((e) => { q = e.target.value.trim(); load(true); }, 300));
  $('#mmore').addEventListener('click', () => load(false));
  view.onclick = async (e) => {
    const btn = e.target.closest('[data-act="mem-del"]'); if (!btn) return;
    const id = btn.closest('tr').dataset.id; const m = rows.find((x) => String(x.id) === id);
    if (!confirm('Excluir o cadastro de ' + m.name + '? Esta ação não pode ser desfeita.')) return;
    try { await api('admin/members/' + id, { method: 'DELETE' }); toast('Cadastro excluído.'); load(true); } catch (ex) { toast(ex.message, 'err'); }
  };
  await load(true);
}

/* =====================================================================
 * Pedidos de oração (administrador)
 * ===================================================================== */
async function viewPrayers(view) {
  let list = (await api('admin/prayers')).prayers;
  function draw() {
    view.innerHTML = html`
      ${pageHead('Pedidos de oração', 'Pedidos enviados pelo site. Marque como atendido quando a equipe de intercessão já orou.')}
      ${list.length ? html`<ul class="prayers">${list.map((p) => html`
        <li class="prayer ${p.handled ? 'is-done' : ''}" data-id="${p.id}">
          <div class="prayer__meta"><strong>${p.name || 'Anônimo'}</strong>${p.contact ? html`<span>${p.contact}</span>` : ''}<time>${formatDateShort(String(p.created_at).slice(0, 10))}</time>${p.handled ? html`<em class="tag">Atendido</em>` : html`<em class="tag tag--new">Novo</em>`}</div>
          <p>${p.message}</p>
          <div class="prayer__actions">
            <button class="btn btn--line btn--sm" type="button" data-act="pr-toggle">${p.handled ? 'Marcar como novo' : 'Marcar como atendido'}</button>
            <button class="iconbtn iconbtn--danger" type="button" data-act="pr-del" aria-label="Excluir pedido">${icon('trash', 18)}</button>
          </div>
        </li>`)}</ul>` : html`<div class="panel"><p class="empty">Nenhum pedido de oração recebido ainda.</p></div>`}`.s;
  }
  draw();
  view.onclick = async (e) => {
    const btn = e.target.closest('[data-act]'); if (!btn) return;
    const li = btn.closest('.prayer'); const p = list.find((x) => x.id === Number(li.dataset.id));
    try {
      if (btn.dataset.act === 'pr-toggle') { await api('admin/prayers/' + p.id, { method: 'PUT', body: { handled: !p.handled } }); p.handled = !p.handled; }
      else if (btn.dataset.act === 'pr-del') { if (!confirm('Excluir este pedido de oração?')) return; await api('admin/prayers/' + p.id, { method: 'DELETE' }); list = list.filter((x) => x !== p); }
      draw();
    } catch (ex) { toast(ex.message, 'err'); }
  };
}

/* =====================================================================
 * Usuários (administrador)
 * ===================================================================== */
async function viewUsers(view) {
  let users = (await api('admin/users')).users;
  function draw() {
    view.innerHTML = html`
      ${pageHead('Usuários', 'Administrador: acesso total. Conteudista: edita textos, fotos, eventos e novidades, sem ver dados de membros nem configurações.',
        '<button class="btn btn--primary" type="button" data-act="u-new">' + icon('plus', 18).s + ' Novo usuário</button>')}
      <div class="panel panel--flush"><div class="table-wrap"><table class="table"><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Situação</th><th></th></tr></thead><tbody>
        ${users.map((u) => html`<tr data-id="${u.id}"><td>${u.name}${u.id === S.user.id ? html` <em class="tag">Você</em>` : ''}</td><td>${u.email}</td><td>${roleLabel(u.role)}</td><td>${u.active ? 'Ativo' : html`<em class="tag tag--warn">Desativado</em>`}</td>
          <td class="actions"><button class="btn btn--line btn--sm" type="button" data-act="u-edit">${icon('edit', 16)} Editar</button>${u.id === S.user.id ? '' : html`<button class="iconbtn iconbtn--danger" type="button" data-act="u-del" aria-label="Excluir ${u.name}">${icon('trash', 18)}</button>`}</td></tr>`)}
      </tbody></table></div></div>`.s;
  }
  draw();
  const form = (u) => html`
    <div class="field"><label><span class="field__label">Nome</span><input type="text" data-fkey="name" value="${u ? u.name : ''}" maxlength="120"></label></div>
    <div class="field"><label><span class="field__label">E-mail (login)</span><input type="email" data-fkey="email" value="${u ? u.email : ''}"></label></div>
    <div class="field"><label><span class="field__label">Perfil</span><select data-fkey="role"><option value="editor" ${u && u.role === 'editor' || !u ? raw('selected') : ''}>Conteudista</option><option value="admin" ${u && u.role === 'admin' ? raw('selected') : ''}>Administrador</option></select></label></div>
    <div class="field"><label><span class="field__label">${u ? 'Nova senha' : 'Senha'}</span><input type="password" data-fkey="password" autocomplete="new-password" minlength="10"></label><small class="help">${u ? 'Deixe em branco para manter a senha atual. ' : ''}Mínimo de 10 caracteres.</small></div>
    ${u ? html`<label class="check"><input type="checkbox" data-fkey="active" ${u.active ? raw('checked') : ''} ${u.id === S.user.id ? raw('disabled') : ''}> Usuário ativo</label>` : ''}`.s;
  view.onclick = (e) => {
    const btn = e.target.closest('[data-act]'); if (!btn) return;
    const tr = btn.closest('tr'); const u = tr ? users.find((x) => x.id === Number(tr.dataset.id)) : null;
    if (btn.dataset.act === 'u-new') {
      openDialog('Novo usuário', form(null), async (dlg) => { users = (await api('admin/users', { method: 'POST', body: readFields(dlg) })).users; draw(); toast('Usuário criado.'); });
    } else if (btn.dataset.act === 'u-edit') {
      openDialog('Editar usuário', form(u), async (dlg) => {
        const data = readFields(dlg); if (!data.password) delete data.password; if (u.id === S.user.id) delete data.active;
        users = (await api('admin/users/' + u.id, { method: 'PUT', body: data })).users; draw(); toast('Usuário atualizado.');
      });
    } else if (btn.dataset.act === 'u-del') {
      if (!confirm('Excluir o usuário ' + u.name + '?')) return;
      api('admin/users/' + u.id, { method: 'DELETE' }).then((r) => { users = r.users; draw(); toast('Usuário excluído.'); }).catch((ex) => toast(ex.message, 'err'));
    }
  };
}

/* =====================================================================
 * Configurações (administrador)
 * ===================================================================== */
async function viewSettings(view) {
  const res = await api('admin/settings');
  const s = res.settings; const dg = res.diagnostics;
  const yn = (b) => (b ? html`<em class="tag">OK</em>` : html`<em class="tag tag--warn">Indisponível</em>`);
  view.innerHTML = html`
    ${pageHead('Configurações', 'Aparência do site e envio de e-mails.')}
    <form id="settingsForm" class="stack" novalidate>
      <section class="panel">
        <h2>Cores da identidade</h2>
        <p class="muted">Padrão: azul-marinho e verde do logo. Mudar aqui altera botões, faixas e destaques do site inteiro.</p>
        <div class="colors">
          <label class="colorf"><span class="field__label">Azul principal</span><input type="color" data-fkey="color_navy" value="${s.color_navy}"><code>${s.color_navy}</code></label>
          <label class="colorf"><span class="field__label">Verde de destaque</span><input type="color" data-fkey="color_green" value="${s.color_green}"><code>${s.color_green}</code></label>
        </div>
      </section>
      <section class="panel">
        <h2>E-mail</h2>
        <p class="muted">Usado para avisar a equipe sobre novos pedidos de oração e, se quiser, dar boas-vindas a novos membros.</p>
        <div class="grid2">
          <div class="field"><label><span class="field__label">E-mail remetente</span><input type="email" data-fkey="mail_from_email" value="${s.mail_from_email}" placeholder="contato@seudominio.com.br"></label><small class="help">Use um e-mail do seu próprio domínio (criado na Hostinger).</small></div>
          <div class="field"><label><span class="field__label">Nome do remetente</span><input type="text" data-fkey="mail_from_name" value="${s.mail_from_name}" maxlength="120"></label></div>
          <div class="field"><label><span class="field__label">Receber pedidos de oração em</span><input type="email" data-fkey="mail_prayer_to" value="${s.mail_prayer_to}"></label><small class="help">Se ficar vazio, usa o e-mail remetente.</small></div>
          <div class="field"><label><span class="field__label">Responder para (opcional)</span><input type="email" data-fkey="mail_reply_to" value="${s.mail_reply_to}"></label></div>
        </div>
        <label class="check"><input type="checkbox" data-fkey="mail_welcome" ${s.mail_welcome === '1' ? raw('checked') : ''}> Enviar e-mail de boas-vindas para quem se cadastrar como membro</label>
        <div class="field"><label><span class="field__label">Como enviar</span><select data-fkey="mail_transport" id="transport"><option value="mail" ${s.mail_transport === 'mail' ? raw('selected') : ''}>Padrão do servidor (simples)</option><option value="smtp" ${s.mail_transport === 'smtp' ? raw('selected') : ''}>SMTP (recomendado, chega melhor na caixa de entrada)</option></select></label></div>
        <div id="smtpBox" ${s.mail_transport === 'smtp' ? '' : raw('hidden')}>
          <p class="hint">Na Hostinger: servidor <b>smtp.hostinger.com</b>, porta <b>465</b> com SSL, usuário e senha do e-mail criado em hPanel &gt; E-mails.</p>
          <div class="grid2">
            <div class="field"><label><span class="field__label">Servidor SMTP</span><input type="text" data-fkey="smtp_host" value="${s.smtp_host}" placeholder="smtp.hostinger.com"></label></div>
            <div class="field"><label><span class="field__label">Porta</span><input type="number" data-fkey="smtp_port" value="${s.smtp_port}"></label></div>
            <div class="field"><label><span class="field__label">Segurança</span><select data-fkey="smtp_secure"><option value="ssl" ${s.smtp_secure === 'ssl' ? raw('selected') : ''}>SSL (porta 465)</option><option value="tls" ${s.smtp_secure === 'tls' ? raw('selected') : ''}>TLS / STARTTLS (porta 587)</option><option value="none" ${s.smtp_secure === 'none' ? raw('selected') : ''}>Nenhuma</option></select></label></div>
            <div class="field"><label><span class="field__label">Usuário</span><input type="text" data-fkey="smtp_user" value="${s.smtp_user}" autocomplete="off"></label></div>
            <div class="field"><label><span class="field__label">Senha</span><input type="password" id="smtpPass" autocomplete="new-password" placeholder="${s.smtp_pass_set ? 'Senha salva (digite para trocar)' : 'Senha do e-mail'}"></label>${s.smtp_pass_set ? html`<label class="check check--sm"><input type="checkbox" id="smtpClear"> Remover a senha salva</label>` : ''}</div>
          </div>
        </div>
      </section>
      <div class="savebar savebar--static"><button class="btn btn--primary" type="submit">Salvar configurações</button></div>
    </form>
    <section class="panel">
      <h2>Testar envio</h2>
      <p class="muted">Salve as configurações e envie um e-mail de teste. Confira também a caixa de spam.</p>
      <div class="inline"><input type="email" id="testTo" placeholder="${S.user.email}" aria-label="Enviar teste para"><button class="btn btn--line" type="button" id="testBtn">Enviar e-mail de teste</button></div>
    </section>
    <section class="panel">
      <h2>Diagnóstico do servidor</h2>
      <ul class="diag">
        <li>PHP <strong>${dg.php}</strong></li>
        <li>OpenSSL (protege a senha do SMTP) ${yn(dg.openssl)}</li>
        <li>GD (reduz o tamanho das imagens enviadas) ${yn(dg.gd)}</li>
        <li>Pasta de imagens com permissão de escrita ${yn(dg.uploads_writable)}</li>
        <li>Pasta interna com permissão de escrita ${yn(dg.storage_writable)}</li>
        <li>Conexão segura (HTTPS) ${yn(dg.https)}</li>
      </ul>
    </section>`.s;
  const form = $('#settingsForm');
  $('#transport').addEventListener('change', (e) => { $('#smtpBox').hidden = e.target.value !== 'smtp'; });
  $$('input[type=color]', form).forEach((c) => c.addEventListener('input', () => { c.nextElementSibling.textContent = c.value.toUpperCase(); }));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = readFields(form);
    data.mail_welcome = data.mail_welcome ? '1' : '0';
    const pass = $('#smtpPass'); if (pass && pass.value) data.smtp_pass = pass.value;
    const clear = $('#smtpClear'); if (clear && clear.checked) data.smtp_pass_clear = true;
    const btn = $('button[type=submit]', form); btn.disabled = true;
    try { await api('admin/settings', { method: 'PUT', body: { settings: data } }); toast('Configurações salvas.'); await viewSettings(view); }
    catch (ex) { toast(ex.message, 'err'); btn.disabled = false; }
  });
  $('#testBtn').addEventListener('click', async (e) => {
    const btn = e.currentTarget; btn.disabled = true; btn.textContent = 'Enviando…';
    try { const r = await api('admin/settings/test-email', { method: 'POST', body: { to: $('#testTo').value.trim() } }); toast(r.message); }
    catch (ex) { toast(ex.message, 'err'); }
    btn.disabled = false; btn.textContent = 'Enviar e-mail de teste';
  });
}

/* =====================================================================
 * Minha conta
 * ===================================================================== */
function viewAccount(view) {
  view.innerHTML = html`
    ${pageHead('Minha conta', S.user.name + ' (' + roleLabel(S.user.role) + ')')}
    <section class="panel narrow">
      <h2>Trocar senha</h2>
      <form id="pwForm" class="stack" novalidate>
        <div class="field"><label><span class="field__label">Senha atual</span><input type="password" name="current" autocomplete="current-password"></label></div>
        <div class="field"><label><span class="field__label">Nova senha</span><input type="password" name="new" autocomplete="new-password" minlength="10"></label><small class="help">Mínimo de 10 caracteres.</small></div>
        <div class="field"><label><span class="field__label">Repita a nova senha</span><input type="password" name="again" autocomplete="new-password"></label></div>
        <p class="err" role="alert" hidden></p>
        <button class="btn btn--primary" type="submit">Salvar nova senha</button>
      </form>
    </section>`.s;
  const form = $('#pwForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = Object.fromEntries(new FormData(form)); const err = $('.err', form); err.hidden = true;
    if (d.new !== d.again) { err.textContent = 'As senhas novas não são iguais.'; err.hidden = false; return; }
    try { await api('account/password', { method: 'PUT', body: { current: d.current, new: d.new } }); form.reset(); toast('Senha alterada.'); }
    catch (ex) { err.textContent = ex.message; err.hidden = false; }
  });
}

/* =====================================================================
 * Eventos globais (cliques e digitação delegados)
 * ===================================================================== */
document.addEventListener('click', async (e) => {
  const act = e.target.closest('[data-act]');
  if (!act) return;
  const a = act.dataset.act;
  if (a === 'menu') $('#side').classList.toggle('is-open');
  else if (a === 'logout') {
    if (dirtyCount() && !confirm('Você tem alterações não salvas. Sair mesmo assim?')) return;
    try { await api('auth/logout', { method: 'POST' }); } catch (ex) { /* segue */ }
    S.user = null; S.content = null; S.dirty = {}; setCsrf(''); location.hash = ''; renderLogin();
  } else if (a === 'save-content') saveContent(act);
  else if (a === 'discard') { S.dirty = {}; onHash(); }
  else if (a === 'img-clear') { setImage(act.closest('.imgf'), ''); }
  else if (a === 'img-default') { const box = act.closest('.imgf'); setImage(box, box.dataset.default); }
});

document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-fkey]');
  if (el && $('#contentForm') && $('#contentForm').contains(el)) trackDirty(el);
});

document.addEventListener('change', async (e) => {
  const file = e.target.closest('[data-upload]');
  if (!file || !file.files[0]) return;
  const box = file.closest('.imgf');
  const label = file.closest('label');
  const original = label.firstChild ? label.innerHTML : '';
  label.classList.add('is-busy');
  try {
    const fd = new FormData(); fd.append('file', file.files[0]);
    const res = await api('admin/upload', { method: 'POST', body: fd });
    setImage(box, res.url);
    toast('Imagem enviada.');
  } catch (ex) { toast(ex.message, 'err'); }
  label.classList.remove('is-busy');
  file.value = '';
});

boot();
