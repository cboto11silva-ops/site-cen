/**
 * Testes ponta a ponta do site e do painel (rodam contra dev/mock-server.mjs).
 * Precisam do Playwright:  npm i -D playwright && npx playwright install chromium
 * Uso:  node dev/mock-server.mjs &   node dev/e2e.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const { chromium } = await import('playwright');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const base = process.env.BASE_URL || 'http://localhost:8080';
let pass = 0, failN = 0;
const ok = (cond, name, extra = '') => { if (cond) { pass++; console.log('  ok  ', name); } else { failN++; console.log('  FAIL', name, extra); } };
const errors = [];
const browser = await chromium.launch();
async function fresh(vp = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ viewport: vp, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error' && !/status of 40[0-9]/.test(m.text())) errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  return { ctx, page };
}
const api = (page, path, opts = {}) => page.evaluate(async ([p, o]) => { const r = await fetch('/api/' + p, { credentials: 'same-origin', ...o }); return { status: r.status, body: await r.json().catch(() => null) }; }, [path, opts]);

/* ------------------------------ SITE PÚBLICO ------------------------------ */
console.log('Site público');
{
  const { ctx, page } = await fresh();
  await page.goto(base + '/');
  ok((await page.title()).includes('Comunidade Entre Nações'), 'título da home');
  await page.evaluate(() => { window.__marker = 1; });
  await page.click('#nav a[data-nav="/eventos"]');
  await page.waitForSelector('.sched');
  ok(page.url().endsWith('/eventos') && await page.evaluate(() => window.__marker === 1), 'navegação sem recarregar a página');
  ok((await page.title()).startsWith('Eventos'), 'título muda ao navegar');
  ok(await page.locator('#nav a.is-active').innerText() === 'Eventos', 'item de menu ativo');
  await page.goto(base + '/pagina-inexistente');
  ok(await page.locator('h1').innerText() === 'Página não encontrada', 'página 404 amigável');

  // Pedido de oração
  await page.goto(base + '/pedido-de-oracao');
  ok(await page.locator('#fabPray').isHidden(), 'botão flutuante de oração some na própria página');
  await page.click('#prayerForm button[type=submit]');
  ok(await page.locator('#prayerForm .alert').isVisible(), 'valida pedido vazio');
  await page.fill('#prayerForm textarea', 'Oração pela minha família, por favor.');
  await page.click('#prayerForm button[type=submit]');
  await page.waitForSelector('.success');
  ok((await page.locator('.success h2').innerText()) === 'Pedido enviado', 'pedido de oração enviado');

  // Cadastro de membro
  await page.goto(base + '/area-do-membro');
  await page.click('#memberForm button[type=submit]');
  ok(await page.locator('#memberForm .alert').innerText() === 'Informe o seu nome completo.', 'valida nome');
  await page.fill('#memberForm [name=name]', 'Teste da Silva');
  await page.fill('#memberForm [name=email]', 'teste@exemplo.com');
  await page.fill('#memberForm [name=phone]', '87999990000');
  ok(await page.inputValue('#memberForm [name=phone]') === '(87) 99999-0000', 'máscara de telefone');
  await page.fill('#memberForm [name=birthdate]', '1990-05-05');
  await page.click('#memberForm button[type=submit]');
  ok((await page.locator('#memberForm .alert').innerText()).includes('autorizar'), 'exige autorização (LGPD)');
  await page.check('#memberForm [name=consent]');
  await page.click('#memberForm button[type=submit]');
  await page.waitForSelector('.success');
  ok((await page.locator('.success h2').innerText()).startsWith('Cadastro recebido'), 'cadastro de membro salvo');
  await page.goto(base + '/area-do-membro');
  await page.fill('#memberForm [name=name]', 'Outra Pessoa');
  await page.fill('#memberForm [name=email]', 'teste@exemplo.com');
  await page.fill('#memberForm [name=phone]', '87999990001');
  await page.fill('#memberForm [name=birthdate]', '1991-01-01');
  await page.check('#memberForm [name=consent]');
  await page.click('#memberForm button[type=submit]');
  await page.waitForSelector('#memberForm .alert:not([hidden])');
  ok((await page.locator('#memberForm .alert').innerText()).includes('já está cadastrado'), 'bloqueia e-mail repetido');
  // Robô (campo-armadilha)
  const bot = await api(page, 'members', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ website: 'x' }) });
  ok(bot.status === 200, 'campo-armadilha é ignorado sem erro');

  // Área da equipe: login errado, conteudista, admin
  await page.waitForSelector('#loginForm');
  await page.fill('#loginForm [name=email]', 'admin@cen.test'); await page.fill('#loginForm [name=password]', 'errada');
  await page.click('#loginForm button');
  await page.waitForSelector('#loginForm .alert:not([hidden])');
  ok((await page.locator('#loginForm .alert').innerText()).includes('incorretos'), 'login com senha errada é recusado');
  await page.fill('#loginForm [name=email]', 'editor@cen.test'); await page.fill('#loginForm [name=password]', 'senhaforte123');
  await page.click('#loginForm button');
  await page.waitForSelector('#logoutBtn');
  ok(await page.locator('#memberRows').count() === 0 && (await page.locator('.team').innerText()).includes('somente para administradores'), 'conteudista NÃO vê dados de membros');
  const blocked = await api(page, 'admin/members');
  ok(blocked.status === 403, 'API bloqueia membros para conteudista (403)');
  await page.click('#logoutBtn'); await page.waitForSelector('#loginForm');
  await page.fill('#loginForm [name=email]', 'admin@cen.test'); await page.fill('#loginForm [name=password]', 'senhaforte123');
  await page.click('#loginForm button');
  await page.waitForSelector('#memberRows tr');
  const n = await page.locator('#memberRows tr').count();
  ok(n >= 6, 'administrador vê a tabela de membros (' + n + ' linhas)');
  await page.fill('#memberSearch', 'beatriz');
  await page.waitForFunction(() => document.querySelectorAll('#memberRows tr').length === 1);
  ok((await page.locator('#memberRows').innerText()).includes('Beatriz'), 'busca de membros funciona');
  ok((await page.locator('a[href="/api/admin/members/export"]').count()) === 1, 'link de exportar CSV presente');
  await ctx.close();
}

/* ------------------------------ PAINEL: CONTEUDISTA ------------------------------ */
console.log('Painel (conteudista)');
{
  const { ctx, page } = await fresh();
  await page.goto(base + '/admin/');
  await page.fill('#loginForm [name=email]', 'editor@cen.test'); await page.fill('#loginForm [name=password]', 'senhaforte123');
  await page.click('#loginForm button');
  await page.waitForSelector('.side__nav');
  const items = await page.locator('.side__nav a').allInnerTexts();
  ok(!items.some((t) => /Membros|Usuários|Configurações|Pedidos/.test(t)), 'menu do conteudista sem áreas restritas', items.join('|'));
  await page.goto(base + '/admin/#/membros');
  await page.waitForSelector('.stats');
  ok(await page.locator('.pagehead h1').innerText().then((t) => t.startsWith('Olá')), 'rota restrita cai no painel inicial');
  const r = await api(page, 'admin/users');
  ok(r.status === 403, 'API de usuários bloqueada (403)');

  await page.goto(base + '/admin/#/conteudo');
  await page.waitForSelector('#contentForm');
  const giving = await page.evaluate(async () => (await (await fetch('/api/admin/content')).json()).groups.find((g) => g.id === 'ofertas').fields.map((f) => f.key));
  ok(!giving.includes('giving.pix.key') && giving.includes('giving.hero.title'), 'campos financeiros ocultos para conteudista');
  const putPix = await api(page, 'admin/content', { method: 'PUT', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': await page.evaluate(async () => (await (await fetch('/api/auth/me')).json()).csrf) }, body: JSON.stringify({ values: { 'giving.pix.key': 'hack' } }) });
  ok(putPix.status === 403, 'API recusa conteudista alterando a chave PIX');

  // edita título da home
  await page.click('.tab:has-text("Página inicial")');
  await page.waitForSelector('[data-fkey="home.hero.title"]');
  ok(await page.locator('#savebar').isHidden(), 'barra de salvar escondida sem alterações');
  await page.fill('[data-fkey="home.hero.title"]', 'Igreja de Todas as Nações');
  ok(await page.locator('#savebar').isVisible(), 'barra de salvar aparece ao editar');
  await page.click('[data-act="save-content"]');
  await page.waitForSelector('.toast.is-on');
  const site = await api(page, 'site');
  ok(site.body.content['home.hero.title'] === 'Igreja de Todas as Nações', 'alteração publicada na API do site');

  // upload de imagem
  await page.setInputFiles('.imgf[data-imgf="home.hero.image"] [data-upload]', path.join(ROOT, 'apple-touch-icon.png'));
  await page.waitForFunction(() => /uploads\//.test(document.querySelector('.imgf[data-imgf="home.hero.image"] .imgf__path').textContent));
  ok(await page.locator('#savebar').isVisible(), 'upload de imagem marca alteração');
  await page.click('[data-act="save-content"]'); await page.waitForTimeout(300);
  const site2 = await api(page, 'site');
  ok(/^\/uploads\//.test(site2.body.content['home.hero.image']), 'nova imagem publicada');
  await page.click('.imgf[data-imgf="home.hero.image"] [data-act="img-default"]');
  await page.click('[data-act="save-content"]'); await page.waitForTimeout(300);
  ok((await api(page, 'site')).body.content['home.hero.image'] === '/assets/img/foto-culto.jpg', 'botão "usar imagem padrão" restaura a foto original');

  // eventos
  await page.goto(base + '/admin/#/eventos');
  await page.waitForSelector('.rows');
  const before = await page.locator('.row').count();
  await page.click('[data-act="coll-new"]');
  await page.fill('.dlg [data-fkey="title"]', 'Conferência de Jovens');
  await page.fill('.dlg [data-fkey="event_date"]', '2030-10-12');
  await page.fill('.dlg [data-fkey="time_label"]', '19h');
  await page.click('.dlg button[type=submit]');
  await page.waitForFunction((b) => document.querySelectorAll('.row').length === b + 1, before);
  ok(true, 'evento criado (' + before + ' -> ' + (before + 1) + ')');
  await page.click('[data-act="coll-new"]'); await page.click('.dlg button[type=submit]'); await page.waitForSelector('.dlg .err:not([hidden])');
  ok((await page.locator('.dlg .err').innerText()).includes('Preencha'), 'valida campo obrigatório no evento');
  await page.click('.dlg [data-close] >> nth=1');
  // reordenar: sobe o último
  const firstBefore = await page.locator('.row strong').first().innerText();
  await page.locator('.row').last().locator('[data-act="coll-up"]').click();
  await page.waitForTimeout(300);
  const lastNow = await page.locator('.row strong').last().innerText();
  ok(lastNow !== 'Conferência de Jovens', 'reordenar mover item');
  // publica no site
  await page.goto(base + '/eventos');
  await page.waitForSelector('.evcards');
  ok((await page.locator('.evcards').innerText()).includes('Conferência de Jovens'), 'evento especial aparece no site');
  await ctx.close();
}

/* ------------------------------ PAINEL: ADMINISTRADOR ------------------------------ */
console.log('Painel (administrador)');
{
  const { ctx, page } = await fresh();
  await page.goto(base + '/admin/');
  await page.fill('#loginForm [name=email]', 'admin@cen.test'); await page.fill('#loginForm [name=password]', 'senhaforte123');
  await page.click('#loginForm button'); await page.waitForSelector('.side__nav');
  const items = await page.locator('.side__nav a').allInnerTexts();
  ok(['Membros', 'Usuários', 'Configurações', 'Pedidos de oração'].every((t) => items.some((i) => i.includes(t))), 'admin vê todas as áreas');

  // PIX (só admin)
  await page.goto(base + '/admin/#/conteudo/ofertas');
  await page.waitForSelector('[data-fkey="giving.pix.key"]');
  await page.fill('[data-fkey="giving.pix.key"]', 'contato@cen.com.br');
  await page.click('[data-act="save-content"]'); await page.waitForSelector('.toast.is-on');
  await page.goto(base + '/ofertas-e-dizimos');
  await page.waitForSelector('#copyPix');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.click('#copyPix');
  await page.waitForFunction(() => document.querySelector('#copyPix span').textContent === 'Chave copiada');
  ok(true, 'botão copiar PIX confirma');
  ok((await page.evaluate(() => navigator.clipboard.readText())) === 'contato@cen.com.br', 'PIX copiado para a área de transferência');

  // WhatsApp flutuante
  await page.goto(base + '/admin/#/conteudo/contato'); await page.waitForSelector('[data-fkey="contact.whatsapp"]');
  await page.fill('[data-fkey="contact.whatsapp"]', '+55 (87) 99999-0000');
  await page.click('[data-act="save-content"]'); await page.waitForSelector('.toast.is-on');
  await page.goto(base + '/');
  ok((await page.locator('.fab--wa').getAttribute('href')).startsWith('https://wa.me/5587999990000'), 'botão flutuante do WhatsApp com número limpo');

  // Configurações
  await page.goto(base + '/admin/#/configuracoes'); await page.waitForSelector('#settingsForm');
  await page.click('#testBtn'); await page.waitForSelector('.toast--err');
  ok((await page.locator('.toast').innerText()).includes('e-mail remetente'), 'teste de e-mail explica o que falta');
  await page.fill('[data-fkey="mail_from_email"]', 'contato@cen.com.br');
  await page.selectOption('#transport', 'smtp'); await page.waitForSelector('#smtpBox', { state: 'visible' });
  await page.fill('[data-fkey="smtp_host"]', 'smtp.hostinger.com'); await page.fill('#smtpPass', 'segredo');
  await page.evaluate(() => { const c = document.querySelector('[data-fkey="color_green"]'); c.value = '#2e8b57'; c.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.click('#settingsForm button[type=submit]'); await page.waitForSelector('.toast.is-on');
  await page.waitForSelector('#smtpPass[placeholder*="salva"]');
  ok(true, 'configurações de e-mail salvas; senha SMTP vira "salva"');
  ok((await api(page, 'admin/settings')).body.settings.smtp_pass === undefined, 'API nunca devolve a senha do SMTP');
  await page.click('#testBtn'); await page.waitForFunction(() => /enviado/.test(document.querySelector('.toast').textContent));
  ok(true, 'e-mail de teste ok');
  await page.goto(base + '/');
  ok(await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--green').trim().toLowerCase() === '#2e8b57'), 'cor do site muda pelas Configurações');

  // Usuários
  await page.goto(base + '/admin/#/usuarios'); await page.waitForSelector('.table');
  await page.click('[data-act="u-new"]');
  await page.fill('.dlg [data-fkey="name"]', 'Novo Conteudista'); await page.fill('.dlg [data-fkey="email"]', 'novo@cen.test'); await page.fill('.dlg [data-fkey="password"]', 'curta');
  await page.click('.dlg button[type=submit]'); await page.waitForSelector('.dlg .err:not([hidden])');
  ok((await page.locator('.dlg .err').innerText()).includes('10 caracteres'), 'senha curta é recusada');
  await page.fill('.dlg [data-fkey="password"]', 'senhabemlonga1'); await page.click('.dlg button[type=submit]');
  await page.waitForFunction(() => document.body.innerText.includes('novo@cen.test'));
  ok(true, 'usuário criado');
  await page.locator('tr', { hasText: 'Ana Admin' }).locator('[data-act="u-edit"]').click();
  ok(await page.locator('.dlg [data-fkey="active"]').isDisabled(), 'admin não pode se desativar');
  await page.selectOption('.dlg [data-fkey="role"]', 'editor'); await page.click('.dlg button[type=submit]');
  await page.waitForSelector('.dlg .err:not([hidden])');
  ok((await page.locator('.dlg .err').innerText()).includes('próprio acesso'), 'admin não pode se rebaixar');
  await page.click('.dlg [data-close] >> nth=1');

  // Membros e pedidos de oração
  await page.goto(base + '/admin/#/membros'); await page.waitForSelector('#mrows tr');
  const cnt = await page.locator('#mrows tr').count();
  page.once('dialog', (d) => d.accept());
  await page.locator('#mrows tr').first().locator('[data-act="mem-del"]').click();
  await page.waitForFunction((c) => document.querySelectorAll('#mrows tr').length === c - 1, cnt);
  ok(true, 'membro excluído');
  await page.goto(base + '/admin/#/oracao'); await page.waitForSelector('.prayer');
  await page.locator('.prayer').first().locator('[data-act="pr-toggle"]').click();
  await page.waitForTimeout(200);
  ok((await page.locator('.prayer.is-done').count()) >= 1, 'pedido marcado como atendido');
  await ctx.close();
}

await browser.close();
console.log('\n' + (errors.length ? 'ERROS DE CONSOLE:\n' + [...new Set(errors)].join('\n') : 'Sem erros de console.'));
console.log(`\n${pass} testes ok, ${failN} falharam`);
process.exit(failN || errors.length ? 1 : 0);
