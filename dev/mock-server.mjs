/**
 * Servidor de PRÉ-VISUALIZAÇÃO (somente desenvolvimento).
 * Imita a API PHP em memória para testar o visual do site e do painel sem PHP/MySQL.
 * Uso:  node dev/mock-server.mjs   -> http://localhost:8080
 * Login de teste: admin@cen.test / senhaforte123  |  editor@cen.test / senhaforte123
 * A lógica da API simulada fica em mock-core.mjs. Nada daqui vai para a hospedagem:
 * a pasta dev/ é bloqueada pelo .htaccess.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createApi } from './mock-core.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PORT = Number(process.env.PORT || 8080);
const schema = JSON.parse(fs.readFileSync(path.join(ROOT, 'app/content-schema.json'), 'utf8'));

const api = createApi(schema, {
  async saveUpload(bytes) {
    const name = `/uploads/2026/09/${crypto.randomBytes(6).toString('hex')}.png`;
    fs.mkdirSync(path.join(ROOT, 'uploads/2026/09'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, name), bytes);
    return name;
  },
});

const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
const PAGES = ['/', '/eventos', '/pastores', '/ofertas-e-dizimos', '/pedido-de-oracao', '/area-do-membro'];
const cookie = (req) => { const m = /(?:^|; )cen_sess=([^;]+)/.exec(req.headers.cookie || ''); return m ? m[1] : ''; };

function shell() {
  const d = api.sitePayload(); const c = d.content;
  const json = JSON.stringify(d).replace(/</g, '\\u003c').replace(/&/g, '\\u0026');
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${c['seo.title']}</title><meta name="description" content="${c['seo.description']}"><meta property="og:title" content=""><meta property="og:description" content=""><meta property="og:url" content=""><link rel="canonical" href=""><link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/assets/css/site.css"><style>:root{--navy:${d.brand.navy};--green:${d.brand.green}}</style></head><body><div id="app"></div><script id="cen-data" type="application/json">${json}</script><script type="module" src="/assets/js/site.js"></script></body></html>`;
}
const adminShell = () => '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Painel – Comunidade Entre Nações</title><link rel="icon" href="/favicon.ico"><link rel="stylesheet" href="/assets/css/admin.css"></head><body><div id="admin"></div><script type="module" src="/assets/js/admin.js"></script></body></html>';

const readBody = (req) => new Promise((r) => { const chunks = []; req.on('data', (c) => chunks.push(c)); req.on('end', () => r(Buffer.concat(chunks))); });

function parseMultipart(buf, ctype) {
  const b = /boundary=(.+)$/.exec(ctype); if (!b) return null;
  const sep = Buffer.from('--' + b[1]); const start = buf.indexOf(sep); if (start < 0) return null;
  const hdrEnd = buf.indexOf(Buffer.from('\r\n\r\n'), start); const next = buf.indexOf(sep, hdrEnd);
  return buf.subarray(hdrEnd + 4, next - 2);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const pathname = decodeURIComponent(url.pathname);
  try {
    if (pathname.startsWith('/api/')) {
      const sid = cookie(req);
      const buf = await readBody(req); let body = {}; let file = null;
      if ((req.headers['content-type'] || '').includes('multipart')) file = parseMultipart(buf, req.headers['content-type']);
      else if (buf.length) body = JSON.parse(buf.toString('utf8'));
      const r = await api.handle(req.method, pathname, { sid, csrf: req.headers['x-csrf-token'] || '', body, file, query: url.searchParams });
      const headers = { 'Content-Type': r.mime || 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
      if ('sid' in r) headers['Set-Cookie'] = r.sid ? `cen_sess=${r.sid}; Path=/; HttpOnly; SameSite=Lax` : 'cen_sess=; Path=/; Max-Age=0';
      res.writeHead(r.status, headers);
      return res.end(r.text !== undefined ? r.text : JSON.stringify(r.json));
    }
    if (pathname === '/admin' || pathname === '/admin/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(adminShell()); }
    const file = path.join(ROOT, pathname);
    const blocked = /^\/(app|storage|dev|docs|tests)(\/|$)|config\.php/.test(pathname);
    if (!blocked && file.startsWith(ROOT) && fs.existsSync(file) && fs.statSync(file).isFile() && !pathname.endsWith('.php')) {
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      return fs.createReadStream(file).pipe(res);
    }
    res.writeHead(PAGES.includes(pathname) ? 200 : 404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(shell());
  } catch (e) {
    console.error(e);
    res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: false, error: 'Erro interno.' }));
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(PORT, () => console.log('Pré-visualização em http://localhost:' + PORT));
}
export { server };
