/**
 * Gera a PRÉ-VISUALIZAÇÃO em HTML único (site e painel) com dados de exemplo.
 * Cada arquivo abre com duplo clique, sem servidor, PHP ou banco. Nada é salvo de verdade.
 *
 * Uso:  node dev/build-preview.mjs [pasta-de-saida] [--site-url URL] [--admin-url URL]
 * Saída: <pasta>/site.html e <pasta>/painel.html  (padrão: ./previa)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const outDir = path.resolve(args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--'))) || path.join(ROOT, 'previa'));
const SITE_URL = opt('--site-url') || 'site.html';
const ADMIN_URL = opt('--admin-url') || 'painel.html';

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const b64 = (p) => fs.readFileSync(path.join(ROOT, p)).toString('base64');
const mime = (p) => (p.endsWith('.png') ? 'image/png' : 'image/jpeg');

// Imagens padrão -> data URI (um único mapa; a API simulada troca os caminhos por elas)
const IMAGES = {};
for (const f of fs.readdirSync(path.join(ROOT, 'assets/img'))) {
  if (f === 'logo-ceen.png') continue;
  const rel = 'assets/img/' + f;
  IMAGES['/' + rel] = `data:${mime(f)};base64,${b64(rel)}`;
}
const LOGO = `data:image/png;base64,${b64('assets/img/logo-ceen.png')}`;

// Junta os módulos em um só (remove import/export)
const common = read('assets/js/common.js').replace(/^export\s+(?=(class|const|function|async function)\b)/gm, '');
const stripImport = (src) => src.replace(/^import\s[\s\S]*?from\s+'\.\/common\.js';\s*$/m, '');
const core = read('dev/mock-core.mjs').replace(/^export\s+function createApi/m, 'function createApi');
const withLogo = (src) => src.replaceAll('src="/assets/img/logo-ceen.png"', 'src="${__PV_LOGO}"');

const shim = `
const __PV = ${JSON.stringify({ site: SITE_URL, admin: ADMIN_URL })};
const __PV_LOGO = ${JSON.stringify(LOGO)};
const __PV_IMAGES = ${JSON.stringify(IMAGES)};
const __pvApi = createApi(${JSON.stringify(JSON.parse(read('app/content-schema.json')))}, {
  saveUpload: (file) => new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(file); }),
});
let __pvSid = '';
const __pvSwap = (v) => (typeof v === 'string' ? (__PV_IMAGES[v] || v)
  : Array.isArray(v) ? v.map(__pvSwap)
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, __pvSwap(x)])) : v);
const __pvFetch = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  if (!url.startsWith('/api/')) return __pvFetch(input, init);
  const u = new URL(url, 'http://demo.local');
  const h = init.headers || {};
  let body = {}; let file = null;
  if (init.body instanceof FormData) file = init.body.get('file');
  else if (init.body) body = JSON.parse(init.body);
  const r = await __pvApi.handle((init.method || 'GET').toUpperCase(), u.pathname, { sid: __pvSid, csrf: h['X-CSRF-Token'] || '', body, file, query: u.searchParams });
  if ('sid' in r) __pvSid = r.sid;
  return new Response(r.text !== undefined ? r.text : JSON.stringify(__pvSwap(r.json)), { status: r.status, headers: { 'Content-Type': r.mime || 'application/json' } });
};
// Links que, no site real, levam a outras áreas: aqui abrem a outra pré-visualização ou baixam o CSV.
document.addEventListener('click', async (e) => {
  const a = e.target.closest && e.target.closest('a[href]');
  if (!a) return;
  const href = a.getAttribute('href');
  if (href.startsWith('/api/')) {
    e.preventDefault(); e.stopPropagation();
    const res = await window.fetch(href);
    const blob = new Blob([await res.text()], { type: 'text/csv;charset=utf-8' });
    const l = document.createElement('a'); l.href = URL.createObjectURL(blob); l.download = 'membros-cen-exemplo.csv'; l.click();
  } else if (href.startsWith('/admin')) {
    e.preventDefault(); e.stopPropagation(); location.href = __PV.admin;
  } else if (window.__CEN_PREVIEW__.mode === 'admin' && href === '/') {
    e.preventDefault(); e.stopPropagation(); window.open(__PV.site, '_blank', 'noopener');
  }
}, true);
// Faixa no topo com atalhos de login
function __pvLogin(email) {
  const go = () => {
    const f = document.getElementById('loginForm');
    if (!f) return false;
    f.elements.email.value = email; f.elements.password.value = 'senhaforte123'; f.requestSubmit(); return true;
  };
  if (go()) return;
  if (window.__CEN_PREVIEW__.mode === 'site') {
    location.hash = '#/area-do-membro';
    let n = 0; const t = setInterval(() => { if (go() || ++n > 30) { clearInterval(t); setTimeout(() => document.getElementById('equipe') && document.getElementById('equipe').scrollIntoView(), 300); } }, 100);
  } else alert('Você já está logado. Use "Sair" no menu lateral para trocar de perfil.');
}
window.__pvLogin = __pvLogin;
document.getElementById('pv-ribbon').addEventListener('click', (e) => {
  const b = e.target.closest('[data-login]'); if (b) __pvLogin(b.dataset.login);
});
`;

const fonts = '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Figtree:wght@400;500;600;700&display=swap">';
const ribbonCss = `
:root { padding-top: env(safe-area-inset-top, 0px); padding-bottom: env(safe-area-inset-bottom, 0px); }
html { scroll-padding-top: env(safe-area-inset-top, 0px); }
#pv-ribbon { display: flex; flex-wrap: wrap; gap: .5rem 1rem; align-items: center; justify-content: center; padding: .55rem 1rem; background: #fff7d6; color: #5a4300; font: 600 .85rem/1.35 system-ui, -apple-system, "Segoe UI", sans-serif; border-bottom: 1px solid #ecd98a; }
#pv-ribbon button, #pv-ribbon a { font: 700 .8rem/1 system-ui, sans-serif; padding: .45rem .8rem; border-radius: 999px; border: 1.5px solid #5a4300; background: #fff; color: #5a4300; cursor: pointer; text-decoration: none; }
#pv-ribbon button:hover, #pv-ribbon a:hover { background: #5a4300; color: #fff; }
.header { top: env(safe-area-inset-top, 0px); }
`;

function page({ title, css, extraCss = '', bodyRoot, mode, js, ribbon }) {
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${title}</title>${fonts}
<style>${css}\n${ribbonCss}${extraCss}</style></head>
<body>
<div id="pv-ribbon" role="note">${ribbon}</div>
<div id="${bodyRoot}"></div>
<script>window.__CEN_PREVIEW__ = { mode: '${mode}' };</script>
<script type="module">
${js}
</script></body></html>`;
}

const logins = '<button type="button" data-login="admin@cen.test">Entrar como administrador</button><button type="button" data-login="editor@cen.test">Entrar como conteudista</button>';
const siteJs = [common, core, shim, withLogo(stripImport(read('assets/js/site.js')))].join('\n');
const adminJs = [common, core, shim, withLogo(stripImport(read('assets/js/admin.js')))].join('\n');

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'site.html'), page({
  title: 'Prévia do site – Comunidade Entre Nações', css: read('assets/css/site.css'), bodyRoot: 'app', mode: 'site', js: siteJs,
  ribbon: `<span>PRÉ-VISUALIZAÇÃO com dados de exemplo. Nada é salvo de verdade.</span>${logins}<a href="${ADMIN_URL}">Abrir prévia do painel</a>`,
}));
fs.writeFileSync(path.join(outDir, 'painel.html'), page({
  title: 'Prévia do painel – Comunidade Entre Nações', css: read('assets/css/admin.css'), bodyRoot: 'admin', mode: 'admin', js: adminJs,
  extraCss: '.app{min-height:calc(100vh - 44px)}',
  ribbon: `<span>PRÉ-VISUALIZAÇÃO com dados de exemplo. Nada é salvo de verdade.</span>${logins}<a href="${SITE_URL}">Abrir prévia do site</a>`,
}));
for (const f of ['site.html', 'painel.html']) console.log(f, Math.round(fs.statSync(path.join(outDir, f)).size / 1024) + ' KB');
