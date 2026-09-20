/**
 * Núcleo da API SIMULADA (somente desenvolvimento e pré-visualização).
 * Não depende de Node nem do navegador: é usado pelo servidor de testes (mock-server.mjs)
 * e pela pré-visualização em HTML único (build-preview.mjs).
 * Mantém as mesmas rotas e regras de permissão de app/api.php.
 */
const hex = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('');

export function createApi(schema, host = {}) {
  const COLLECTIONS = {
    events: { label: 'Eventos', singular: 'evento', title_field: 'title', fields: [
      { key: 'title', label: 'Nome do evento', type: 'text', required: true },
      { key: 'weekday', label: 'Dia da semana (encontros que se repetem toda semana)', type: 'weekday', help: 'Escolha um dia para encontros semanais.' },
      { key: 'event_date', label: 'Data (evento especial, acontece uma vez)', type: 'date', help: 'Depois da data, o evento sai do site sozinho.' },
      { key: 'day_label', label: 'Texto do dia (opcional)', type: 'text' },
      { key: 'time_label', label: 'Horário', type: 'text', help: 'Exemplo: 19h30' },
      { key: 'location', label: 'Local', type: 'text' },
      { key: 'description', label: 'Descrição', type: 'textarea' },
      { key: 'image', label: 'Imagem (opcional)', type: 'image' }] },
    pastors: { label: 'Pastores', singular: 'pastor', title_field: 'name', fields: [
      { key: 'name', label: 'Nome', type: 'text', required: true },
      { key: 'role', label: 'Função', type: 'text' },
      { key: 'bio', label: 'Apresentação', type: 'textarea' },
      { key: 'photo', label: 'Foto (opcional)', type: 'image' }] },
    highlights: { label: 'Novidades', singular: 'novidade', title_field: 'title', fields: [
      { key: 'title', label: 'Título', type: 'text', required: true },
      { key: 'caption', label: 'Legenda (opcional)', type: 'text' },
      { key: 'image', label: 'Imagem', type: 'image', required: true },
      { key: 'link', label: 'Link ao clicar (opcional)', type: 'url' }] },
  };

  // ---- estado em memória ----
  const fields = {};
  schema.groups.forEach((g) => g.fields.forEach((f) => { fields[f.key] = { ...f, group: g.id }; }));
  const overrides = {};
  const db = { events: [], pastors: [], highlights: [] };
  let seq = 1;
  for (const [name, rows] of Object.entries(schema.collections)) {
    rows.forEach((r, i) => db[name].push({ id: seq++, ...r, sort_order: i + 1, published: true }));
  }
  const users = [
    { id: 1, name: 'Ana Admin', email: 'admin@cen.test', password: 'senhaforte123', role: 'admin', active: true, last_login: null, created_at: '2026-09-01 10:00:00' },
    { id: 2, name: 'Caio Conteudista', email: 'editor@cen.test', password: 'senhaforte123', role: 'editor', active: true, last_login: null, created_at: '2026-09-02 10:00:00' },
  ];
  const members = [
    ['Maria das Graças Silva', 'maria@exemplo.com', '87999991111', '1985-03-14'], ['João Pedro Alves', 'joao@exemplo.com', '87988882222', '1992-11-02'],
    ['Luciana Ferreira', 'lu.ferreira@exemplo.com', '87977773333', '2001-06-21'], ['Carlos Eduardo Lima', 'cadu@exemplo.com', '87966664444', '1978-09-30'],
    ['Beatriz Souza', 'bia@exemplo.com', '87955555555', '2008-01-09'], ['Rafael Nogueira', 'rafa@exemplo.com', '87944446666', '1995-12-25'],
  ].map((m, i) => ({ id: i + 1, name: m[0], email: m[1], phone: m[2], birthdate: m[3], created_at: `2026-09-${String(10 + i).padStart(2, '0')} 09:30:00` }));
  const prayers = [
    { id: 1, name: 'Ana', contact: 'ana@exemplo.com', message: 'Peço oração pela saúde da minha mãe.', handled: false, created_at: '2026-09-18 20:10:00' },
    { id: 2, name: '', contact: '', message: 'Oração pelo meu trabalho e pela minha família.', handled: true, created_at: '2026-09-17 08:00:00' },
  ];
  const settings = {
    color_navy: '#081B3F', color_green: '#8DB84A', mail_from_email: '', mail_from_name: 'Comunidade Entre Nações', mail_reply_to: '', mail_prayer_to: '',
    mail_welcome: '0', mail_transport: 'mail', smtp_host: '', smtp_port: '465', smtp_secure: 'ssl', smtp_user: '', smtp_pass: '',
  };
  const sessions = new Map();

  const contentAll = () => { const o = {}; for (const k in fields) o[k] = k in overrides ? overrides[k] : String(fields[k].default); return o; };
  const list = (name, onlyPub) => db[name].filter((r) => !onlyPub || r.published).sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);
  const sitePayload = () => ({ content: contentAll(), brand: { navy: settings.color_navy, green: settings.color_green }, events: list('events', true), pastors: list('pastors', true), highlights: list('highlights', true) });

  // ---- rotas (mesma tabela da API PHP: app/api.php) ----
  const ROUTES = [
    ['GET', 'site', 'public'], ['POST', 'prayer', 'public'], ['POST', 'members', 'public'], ['GET', 'auth/me', 'public'], ['POST', 'auth/login', 'public'],
    ['POST', 'auth/logout', 'auth'], ['PUT', 'account/password', 'auth'], ['GET', 'admin/dashboard', 'editor'], ['GET', 'admin/content', 'editor'], ['PUT', 'admin/content', 'editor'],
    ['POST', 'admin/upload', 'editor'], ['GET', 'admin/collections', 'editor'], ['GET', 'admin/collections/{c}', 'editor'], ['POST', 'admin/collections/{c}', 'editor'],
    ['POST', 'admin/collections/{c}/reorder', 'editor'], ['PUT', 'admin/collections/{c}/{id}', 'editor'], ['DELETE', 'admin/collections/{c}/{id}', 'editor'],
    ['GET', 'admin/members', 'admin'], ['GET', 'admin/members/export', 'admin'], ['DELETE', 'admin/members/{id}', 'admin'],
    ['GET', 'admin/prayers', 'admin'], ['PUT', 'admin/prayers/{id}', 'admin'], ['DELETE', 'admin/prayers/{id}', 'admin'],
    ['GET', 'admin/users', 'admin'], ['POST', 'admin/users', 'admin'], ['PUT', 'admin/users/{id}', 'admin'], ['DELETE', 'admin/users/{id}', 'admin'],
    ['GET', 'admin/settings', 'admin'], ['PUT', 'admin/settings', 'admin'], ['POST', 'admin/settings/test-email', 'admin'],
  ];
  const routeTable = ROUTES.map((r) => r[0] + ' ' + r[1]);

  class Fail extends Error { constructor(msg, code = 400) { super(msg); this.code = code; } }
  const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
  const pubUser = (u) => ({ id: u.id, name: u.name, email: u.email, role: u.role });
  const usersPayload = () => users.map(({ password, ...u }) => u);

  const HANDLERS = {
    'GET site': () => sitePayload(),
    'POST prayer': ({ body }) => { if (body.website) return {}; if (String(body.message || '').trim().length < 5) throw new Fail('Escreva o seu pedido de oração.'); prayers.unshift({ id: seq++, name: body.name || '', contact: body.contact || '', message: body.message, handled: false, created_at: new Date().toISOString().slice(0, 19).replace('T', ' ') }); return {}; },
    'POST members': ({ body }) => {
      if (body.website) return {};
      if (String(body.name || '').trim().length < 3) throw new Fail('Informe o seu nome completo.');
      if (!isEmail(String(body.email || ''))) throw new Fail('Informe um e-mail válido.');
      const phone = String(body.phone || '').replace(/\D/g, '');
      if (phone.length < 10) throw new Fail('Informe um telefone com DDD.');
      if (!body.birthdate) throw new Fail('Informe uma data de nascimento válida.');
      if (!body.consent) throw new Fail('Para se cadastrar, é preciso autorizar o uso dos dados.');
      if (members.some((m) => m.email === String(body.email).toLowerCase())) throw new Fail('Este e-mail já está cadastrado. Obrigado!', 409);
      members.unshift({ id: seq++, name: body.name, email: String(body.email).toLowerCase(), phone, birthdate: body.birthdate, created_at: new Date().toISOString().slice(0, 19).replace('T', ' ') });
      return {};
    },
    'GET auth/me': ({ sess }) => (sess ? { user: pubUser(sess.user), csrf: sess.csrf } : { user: null }),
    'POST auth/login': ({ body, out }) => {
      const u = users.find((x) => x.email === String(body.email || '').toLowerCase() && x.active && x.password === body.password);
      if (!u) throw new Fail('E-mail ou senha incorretos.', 401);
      const id = hex(12); const csrf = hex(8);
      sessions.set(id, { user: u, csrf }); out.sid = id;
      return { user: pubUser(u), csrf };
    },
    'POST auth/logout': ({ sid, out }) => { sessions.delete(sid); out.sid = ''; return {}; },
    'PUT account/password': ({ body, sess }) => { if (body.current !== sess.user.password) throw new Fail('A senha atual está incorreta.'); if (String(body.new || '').length < 10) throw new Fail('A nova senha precisa ter pelo menos 10 caracteres.'); sess.user.password = body.new; return {}; },
    'GET admin/dashboard': ({ sess }) => {
      const out = { counts: { events: list('events', true).length, pastors: list('pastors', true).length, highlights: list('highlights', true).length } };
      if (sess.user.role === 'admin') { out.counts.members = members.length; out.counts.members_month = members.length; out.counts.prayers_new = prayers.filter((p) => !p.handled).length; out.recent_members = members.slice(0, 5).map(({ id, name, email, created_at }) => ({ id, name, email, created_at })); }
      return out;
    },
    'GET admin/content': ({ sess }) => ({
      groups: schema.groups.map((g) => ({ id: g.id, label: g.label, fields: g.fields.filter((f) => !f.admin_only || sess.user.role === 'admin') })).filter((g) => g.fields.length), values: contentAll(),
    }),
    'PUT admin/content': ({ body, sess }) => {
      let n = 0;
      for (const [k, v] of Object.entries(body.values || {})) {
        const f = fields[k]; if (!f) continue;
        if (f.admin_only && sess.user.role !== 'admin') throw new Fail(`Apenas o administrador pode alterar "${f.label}".`, 403);
        overrides[k] = String(v); n++;
      }
      return { saved: n, values: contentAll() };
    },
    'POST admin/upload': async ({ file }) => { if (!file) throw new Fail('Nenhuma imagem enviada.'); return { url: await host.saveUpload(file) }; },
    'GET admin/collections': () => ({ collections: COLLECTIONS }),
    'GET admin/collections/{c}': ({ p }) => ({ items: list(need(p.c), false) }),
    'POST admin/collections/{c}': ({ p, body }) => {
      const name = need(p.c); const row = { id: seq++, sort_order: db[name].length + 1, published: true };
      COLLECTIONS[name].fields.forEach((f) => { row[f.key] = body[f.key] === undefined || body[f.key] === '' ? (f.type === 'weekday' || f.type === 'date' ? null : '') : body[f.key]; if (f.required && !row[f.key]) throw new Fail(`Preencha o campo "${f.label}".`); });
      db[name].push(row); return { id: row.id, items: list(name, false) };
    },
    'POST admin/collections/{c}/reorder': ({ p, body }) => { const name = need(p.c); body.ids.forEach((id, i) => { const r = db[name].find((x) => x.id === Number(id)); if (r) r.sort_order = i + 1; }); return { items: list(name, false) }; },
    'PUT admin/collections/{c}/{id}': ({ p, body }) => { const name = need(p.c); const r = db[name].find((x) => x.id === Number(p.id)); if (!r) throw new Fail('Item não encontrado.', 404); for (const f of COLLECTIONS[name].fields) if (f.key in body) { if (f.required && !body[f.key]) throw new Fail(`Preencha o campo "${f.label}".`); r[f.key] = body[f.key] === '' && (f.type === 'weekday' || f.type === 'date') ? null : body[f.key]; } if ('published' in body) r.published = !!body.published; return { items: list(name, false) }; },
    'DELETE admin/collections/{c}/{id}': ({ p }) => { const name = need(p.c); db[name] = db[name].filter((x) => x.id !== Number(p.id)); return { items: list(name, false) }; },
    'GET admin/members': ({ url }) => { const q = (url.searchParams.get('q') || '').toLowerCase(); const lim = Number(url.searchParams.get('limit') || 50); const off = Number(url.searchParams.get('offset') || 0); const rows = members.filter((m) => !q || `${m.name} ${m.email} ${m.phone}`.toLowerCase().includes(q)); return { total: rows.length, members: rows.slice(off, off + lim) }; },
    'GET admin/members/export': ({ out }) => { out.csv = true; return 'Nome;E-mail\r\n' + members.map((m) => `"${m.name}";"${m.email}"`).join('\r\n'); },
    'DELETE admin/members/{id}': ({ p }) => { const i = members.findIndex((m) => m.id === Number(p.id)); if (i >= 0) members.splice(i, 1); return {}; },
    'GET admin/prayers': () => ({ prayers }),
    'PUT admin/prayers/{id}': ({ p, body }) => { const r = prayers.find((x) => x.id === Number(p.id)); if (r) r.handled = !!body.handled; return {}; },
    'DELETE admin/prayers/{id}': ({ p }) => { const i = prayers.findIndex((x) => x.id === Number(p.id)); if (i >= 0) prayers.splice(i, 1); return {}; },
    'GET admin/users': () => ({ users: usersPayload() }),
    'POST admin/users': ({ body }) => { if (String(body.password || '').length < 10) throw new Fail('A senha precisa ter pelo menos 10 caracteres.'); if (!isEmail(String(body.email || ''))) throw new Fail('Informe um e-mail válido.'); if (users.some((u) => u.email === body.email)) throw new Fail('Já existe um usuário com este e-mail.', 409); users.push({ id: seq++, name: body.name, email: body.email.toLowerCase(), password: body.password, role: body.role === 'admin' ? 'admin' : 'editor', active: true, last_login: null, created_at: '2026-09-19 10:00:00' }); return { users: usersPayload() }; },
    'PUT admin/users/{id}': ({ p, body, sess }) => {
      const u = users.find((x) => x.id === Number(p.id)); if (!u) throw new Fail('Usuário não encontrado.', 404);
      const role = 'role' in body ? body.role : u.role; const active = 'active' in body ? !!body.active : u.active;
      if (u.id === sess.user.id && (role !== 'admin' || !active)) throw new Fail('Você não pode remover o seu próprio acesso de administrador.');
      ['name', 'email', 'role'].forEach((k) => { if (k in body) u[k] = body[k]; }); u.active = active; if (body.password) { if (body.password.length < 10) throw new Fail('A senha precisa ter pelo menos 10 caracteres.'); u.password = body.password; }
      return { users: usersPayload() };
    },
    'DELETE admin/users/{id}': ({ p, sess }) => { if (Number(p.id) === sess.user.id) throw new Fail('Você não pode excluir o seu próprio usuário.'); const i = users.findIndex((x) => x.id === Number(p.id)); if (i >= 0) users.splice(i, 1); return { users: usersPayload() }; },
    'GET admin/settings': () => { const { smtp_pass, ...s } = settings; return { settings: { ...s, smtp_pass_set: !!smtp_pass }, diagnostics: { php: '8.2 (simulado)', openssl: true, gd: true, mbstring: true, uploads_writable: true, storage_writable: true, https: false } }; },
    'PUT admin/settings': ({ body }) => { const inS = body.settings || {}; for (const k of Object.keys(settings)) if (k in inS && k !== 'smtp_pass') settings[k] = String(inS[k]); if (inS.smtp_pass_clear) settings.smtp_pass = ''; else if (inS.smtp_pass) settings.smtp_pass = 'enc'; const { smtp_pass, ...s } = settings; return { settings: { ...s, smtp_pass_set: !!smtp_pass } }; },
    'POST admin/settings/test-email': ({ body }) => (settings.mail_from_email ? { message: `E-mail de teste enviado para ${body.to || 'admin@cen.test'} (simulado).` } : (() => { throw new Fail('Configure o e-mail remetente em Configurações > E-mail.'); })()),
  };


  function need(name) { if (!COLLECTIONS[name]) throw new Fail('Lista não encontrada.', 404); return name; }

  function match(method, p) {
    for (const [m, pattern, access] of ROUTES) {
      if (m !== method) continue;
      const names = []; const re = new RegExp('^' + pattern.replace(/\{([a-z]+)\}/g, (_, n) => { names.push(n); return '([^/]+)'; }) + '$');
      const f = re.exec(p); if (!f) continue;
      const params = {}; names.forEach((n, i) => { params[n] = decodeURIComponent(f[i + 1]); });
      return { key: m + ' ' + pattern, params, access };
    }
    return null;
  }


  /** Trata uma chamada. Devolve { status, json | text, sid? } (sid = novo id de sessão; '' encerra). */
  async function handle(method, pathname, { sid = '', csrf = '', body = {}, file = null, query = new URLSearchParams() } = {}) {
    try {
      const p = pathname.replace(/^\/api\//, '').replace(/\/+$/, '');
      const m = match(method, p);
      if (!m) throw new Fail('Rota não encontrada.', 404);
      const sess = sessions.get(sid) || null;
      if (m.access !== 'public') {
        if (!sess) throw new Fail('Faça login para continuar.', 401);
        if (m.access === 'admin' && sess.user.role !== 'admin') throw new Fail('Você não tem permissão para acessar esta área.', 403);
        if (method !== 'GET' && csrf !== sess.csrf) throw new Fail('Sessão expirada. Recarregue a página e tente de novo.', 403);
      }
      const out = {};
      const res = await HANDLERS[m.key]({ url: { searchParams: query }, body, file, p: m.params, sess, sid, out });
      if (out.csv) return { status: 200, text: res, mime: 'text/csv; charset=utf-8' };
      const r = { status: 200, json: { ok: true, ...res } };
      if ('sid' in out) r.sid = out.sid;
      return r;
    } catch (e) {
      if (!(e instanceof Fail)) console.error(e);
      return { status: e instanceof Fail ? e.code : 500, json: { ok: false, error: e instanceof Fail ? e.message : 'Erro interno.' } };
    }
  }

  return { handle, routeTable, sitePayload };
}
