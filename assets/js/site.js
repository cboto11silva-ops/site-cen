/**
 * Site público da Comunidade Entre Nações.
 * Sem etapa de build: o navegador carrega este arquivo diretamente.
 * Os textos vêm do painel (CMS) através da API.
 */
import {
  html, raw, esc, safeUrl, paragraphs, lines, icon, api, setCsrf, ApiError, $, $$, debounce,
  WEEKDAYS, nowRecife, parseTime, dayNumber, formatDateLong, formatDateShort, ageFrom, formatPhone,
} from './common.js';

const state = { data: null, user: null, path: '/', firstLoad: true };
const C = (k) => (state.data && state.data.content[k]) || '';
const app = document.getElementById('app');

const NAV = [
  { path: '/', label: 'Início' },
  { path: '/eventos', label: 'Eventos' },
  { path: '/pastores', label: 'Pastores' },
  { path: '/ofertas-e-dizimos', label: 'Ofertas e Dízimos' },
  { path: '/pedido-de-oracao', label: 'Pedido de Oração' },
];

/* =====================================================================
 * Eventos: cálculo do "próximo encontro"
 * ===================================================================== */

function weekdayLabel(n) {
  const name = WEEKDAYS[n].toLowerCase();
  return (n === 0 || n === 6 ? 'Todo ' : 'Toda ') + name;
}

function eventDayLabel(ev) {
  if (ev.day_label) return ev.day_label;
  if (ev.event_date) return capitalize(formatDateLong(ev.event_date));
  if (ev.weekday != null) return weekdayLabel(ev.weekday);
  return '';
}

function capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

/** Próximo encontro a partir de agora (horário de Petrolina). */
function nextEvent() {
  const now = nowRecife();
  const today = dayNumber(now.ymd);
  let best = null;
  for (const ev of state.data.events) {
    const mins = parseTime(ev.time_label);
    let days;
    if (ev.event_date) {
      days = dayNumber(ev.event_date) - today;
      if (days < 0) continue;
    } else if (ev.weekday != null) {
      days = (ev.weekday - now.dow + 7) % 7;
    } else {
      continue;
    }
    // Se o encontro de hoje já terminou (1h30 depois do início), o próximo é o da semana seguinte.
    if (days === 0 && mins != null && now.minutes > mins + 90) {
      if (ev.event_date) continue;
      days = 7;
    }
    const score = days * 1440 + (mins == null ? 0 : mins);
    if (!best || score < best.score) best = { ev, days, score };
  }
  if (!best) return null;
  const { ev, days } = best;
  let when;
  if (days === 0) when = 'Hoje';
  else if (days === 1) when = 'Amanhã';
  else if (ev.event_date) when = capitalize(formatDateLong(ev.event_date));
  else when = WEEKDAYS[ev.weekday];
  return { ev, when };
}

function weeklyEvents() {
  const list = state.data.events.filter((e) => e.weekday != null && !e.event_date);
  const order = (n) => (n + 6) % 7; // segunda primeiro, domingo por último
  return list.sort((a, b) => order(a.weekday) - order(b.weekday) || (parseTime(a.time_label) || 0) - (parseTime(b.time_label) || 0));
}

function specialEvents() {
  return state.data.events
    .filter((e) => e.event_date || e.weekday == null)
    .sort((a, b) => String(a.event_date || '9999').localeCompare(String(b.event_date || '9999')));
}

/* =====================================================================
 * Peças reutilizáveis
 * ===================================================================== */

const instagramUrl = () => safeUrl(C('social.instagram'));
const whatsappNumber = () => C('contact.whatsapp').replace(/\D/g, '');
const whatsappUrl = () => 'https://wa.me/' + whatsappNumber() + '?text=' + encodeURIComponent(C('contact.whatsapp_text'));

function link(path, label, cls = 'btn btn--green') {
  return html`<a class="${cls}" href="${path}">${label}</a>`;
}

function initials(name) {
  const parts = String(name).replace(/^(Pr\.|Pra\.|Pastor|Pastora)\s+/i, '').trim().split(/\s+/);
  return ((parts[0] || '')[0] || '') + ((parts.length > 1 ? parts[parts.length - 1][0] : '') || '');
}

function pageHero({ title, text, image, imageAlt }) {
  return html`
    <section class="phero">
      <div class="wrap phero__grid ${image ? 'has-image' : ''}">
        <div class="phero__text">
          <h1>${title}</h1>
          <p class="lead">${text}</p>
        </div>
        ${image ? html`<figure class="frame"><img src="${image}" alt="${imageAlt}" loading="eager"></figure>` : ''}
      </div>
    </section>`;
}

function header() {
  return html`
    <a class="skip" href="#main">Pular para o conteúdo</a>
    <header class="header" id="header">
      <div class="wrap header__bar">
        <a class="brand" href="/" aria-label="${C('site.name')}: página inicial">
          <img src="/assets/img/logo-ceen.png" alt="${C('site.name')}" width="104" height="46">
        </a>
        <nav class="nav" id="nav" aria-label="Principal">
          ${NAV.map((n) => html`<a href="${n.path}" data-nav="${n.path}">${n.label}</a>`)}
          <a class="btn btn--navy nav__cta" href="/area-do-membro" data-nav="/area-do-membro">Área do Membro</a>
        </nav>
        <button class="menu-btn" id="menuBtn" type="button" aria-expanded="false" aria-controls="nav" aria-label="Abrir menu">
          <span class="menu-btn__open">${icon('menu', 26)}</span><span class="menu-btn__close">${icon('close', 26)}</span>
        </button>
      </div>
    </header>`;
}

function footer() {
  const socials = [
    ['instagram', C('social.instagram'), 'Instagram'],
    ['youtube', C('social.youtube'), 'YouTube'],
    ['facebook', C('social.facebook'), 'Facebook'],
  ].filter((s) => safeUrl(s[1]));
  return html`
    <footer class="footer">
      <div class="wrap footer__grid">
        <div class="footer__brand">
          <a class="footer__logo" href="/" aria-label="${C('site.name')}"><img src="/assets/img/logo-ceen.png" alt="${C('site.name')}" width="104" height="46"></a>
          <p>${C('footer.about')}</p>
        </div>
        <div>
          <h2 class="footer__title">Navegue</h2>
          <ul class="footer__list">
            ${NAV.map((n) => html`<li><a href="${n.path}">${n.label}</a></li>`)}
            <li><a href="/area-do-membro">Área do Membro</a></li>
          </ul>
        </div>
        <div>
          <h2 class="footer__title">Fale conosco</h2>
          <ul class="footer__list footer__contact">
            ${C('contact.service_time') ? html`<li>${icon('clock', 18)}<span>${C('contact.service_time')}</span></li>` : ''}
            ${C('contact.address') ? html`<li>${icon('pin', 18)}<span>${C('contact.address')}</span></li>` : html`<li>${icon('pin', 18)}<span>${C('contact.city')}</span></li>`}
            ${C('contact.email') ? html`<li>${icon('mail', 18)}<a href="mailto:${C('contact.email')}">${C('contact.email')}</a></li>` : ''}
          </ul>
          ${socials.length ? html`<div class="social">${socials.map((s) => html`<a href="${safeUrl(s[1])}" target="_blank" rel="noopener noreferrer" aria-label="${s[2]}">${icon(s[0], 20)}</a>`)}</div>` : ''}
        </div>
      </div>
      <div class="wrap footer__bar">
        <span>© ${new Date().getFullYear()} ${C('site.name')}${C('site.short') ? ' (' + C('site.short') + ')' : ''}</span>
        <a href="/admin/">Acesso da equipe</a>
      </div>
    </footer>`;
}

function floating() {
  const wa = whatsappNumber();
  return html`
    <div class="fabs" id="fabs">
      <button class="fab fab--top" id="toTop" type="button" aria-label="Voltar ao topo">${icon('up', 20)}</button>
      <a class="fab fab--pray" id="fabPray" href="/pedido-de-oracao">${icon('heart', 22)}<span>Pedido de oração</span></a>
      ${wa.length >= 10 ? html`<a class="fab fab--wa" href="${whatsappUrl()}" target="_blank" rel="noopener noreferrer" aria-label="Falar pelo WhatsApp">${icon('chat', 26)}</a>` : ''}
    </div>`;
}

/* =====================================================================
 * Páginas
 * ===================================================================== */

function pageHome() {
  const next = nextEvent();
  const weekly = weeklyEvents();
  const highlights = state.data.highlights;
  const week = weekly.length || C('home.week.image');
  return html`
    <section class="hero ${next ? '' : 'hero--nobar'} ${state.firstLoad ? 'is-intro' : ''}">
      <div class="wrap hero__grid">
        <div class="hero__text">
          ${C('home.hero.badge') ? html`<p class="badge">${C('home.hero.badge')}</p>` : ''}
          <h1>${C('home.hero.title')}</h1>
          <p class="lead">${C('home.hero.text')}</p>
          <div class="hero__cta">
            ${link('/eventos', C('home.hero.cta1'), 'btn btn--green btn--lg')}
            ${link('/pedido-de-oracao', C('home.hero.cta2'), 'btn btn--ghost btn--lg')}
          </div>
        </div>
        <div class="collage" aria-hidden="${C('home.hero.image') ? 'false' : 'true'}">
          ${C('home.hero.image') ? html`<img class="collage__main" src="${C('home.hero.image')}" alt="${C('home.hero.image_alt')}" fetchpriority="high">` : ''}
          ${C('home.hero.image2') ? html`<img class="collage__small" src="${C('home.hero.image2')}" alt="${C('home.hero.image2_alt')}" loading="lazy">` : ''}
        </div>
      </div>
    </section>

    ${next ? html`
    <div class="wrap nextbar-wrap">
      <aside class="nextbar" aria-label="Próximo encontro">
        <div class="nextbar__label">Próximo encontro</div>
        <div class="nextbar__main">
          <strong class="nextbar__when">${next.when}${next.ev.time_label ? html`, ${next.ev.time_label}` : ''}</strong>
          <span class="nextbar__what">${next.ev.title}${next.ev.location ? html` <span class="muted">em ${next.ev.location}</span>` : ''}</span>
        </div>
        ${link('/eventos', 'Ver programação', 'btn btn--navy')}
      </aside>
    </div>` : ''}

    <section class="section">
      <div class="wrap about">
        <div class="about__lead">
          <h2>${C('home.about.title')}</h2>
          <div class="prose">${paragraphs(C('home.about.text'))}</div>
        </div>
        <ul class="pillars">
          ${[['sun', 1], ['heart', 2], ['globe', 3]].map(([ic, n]) => html`
            <li class="pillar">
              <span class="pillar__icon">${icon(ic, 24)}</span>
              <div><h3>${C('home.pillar' + n + '.title')}</h3><p>${C('home.pillar' + n + '.text')}</p></div>
            </li>`)}
        </ul>
      </div>
    </section>

    ${week ? html`
    <section class="section section--mist" id="programacao">
      <div class="wrap week">
        ${C('home.week.image') ? html`<figure class="poster-frame"><img src="${C('home.week.image')}" alt="${C('home.week.image_alt')}" loading="lazy"></figure>` : ''}
        <div>
          <h2>${C('home.week.title')}</h2>
          <p class="section-text">${C('home.week.text')}</p>
          ${scheduleList(weekly)}
          <p class="more">${link('/eventos', C('home.week.cta'), 'btn btn--outline')}</p>
        </div>
      </div>
    </section>` : ''}

    ${highlights.length ? html`
    <section class="section">
      <div class="wrap">
        <div class="section-head">
          <div><h2>${C('home.news.title')}</h2><p class="section-text">${C('home.news.text')}</p></div>
          ${instagramUrl() ? html`<a class="btn btn--outline" href="${instagramUrl()}" target="_blank" rel="noopener noreferrer">${icon('instagram', 18)} ${C('home.news.cta')}</a>` : ''}
        </div>
        <ul class="posters">
          ${highlights.map((h) => {
            const href = safeUrl(h.link) || instagramUrl();
            const inner = html`
              <span class="poster__img"><img src="${h.image}" alt="${h.title}" loading="lazy"></span>
              <span class="poster__title">${h.title}</span>
              ${h.caption ? html`<span class="poster__caption">${h.caption}</span>` : ''}`;
            return html`<li>${href
              ? html`<a class="poster" href="${href}" ${href.startsWith('/') ? '' : raw('target="_blank" rel="noopener noreferrer"')}>${inner}</a>`
              : html`<div class="poster">${inner}</div>`}</li>`;
          })}
        </ul>
      </div>
    </section>` : ''}

    <section class="section section--navy visit">
      <div class="wrap visit__grid">
        <div>
          <h2>${C('home.visit.title')}</h2>
          <p class="lead">${C('home.visit.text')}</p>
          <div class="visit__cta">
            ${safeUrl(C('contact.map_url')) ? html`<a class="btn btn--green" href="${safeUrl(C('contact.map_url'))}" target="_blank" rel="noopener noreferrer">${icon('pin', 18)} Como chegar</a>` : ''}
            ${whatsappNumber().length >= 10 ? html`<a class="btn btn--ghost" href="${whatsappUrl()}" target="_blank" rel="noopener noreferrer">${icon('chat', 18)} Falar no WhatsApp</a>` : ''}
          </div>
        </div>
        <ul class="visit__info">
          ${C('contact.service_time') ? html`<li>${icon('clock', 22)}<div><strong>Horário</strong><span>${C('contact.service_time')}</span></div></li>` : ''}
          <li>${icon('pin', 22)}<div><strong>Onde</strong><span>${C('contact.address') || C('contact.city')}</span></div></li>
          ${C('contact.email') ? html`<li>${icon('mail', 22)}<div><strong>E-mail</strong><a href="mailto:${C('contact.email')}">${C('contact.email')}</a></div></li>` : ''}
        </ul>
      </div>
    </section>

    <section class="section">
      <div class="wrap">
        <h2 class="center">${C('home.steps.title')}</h2>
        <div class="tiles">
          <a class="tile tile--navy" href="/ofertas-e-dizimos"><span class="tile__icon">${icon('gift', 26)}</span><h3>${C('home.step1.title')}</h3><p>${C('home.step1.text')}</p><span class="tile__go">Saiba mais ${icon('chevron', 18)}</span></a>
          <a class="tile tile--green" href="/area-do-membro"><span class="tile__icon">${icon('userplus', 26)}</span><h3>${C('home.step2.title')}</h3><p>${C('home.step2.text')}</p><span class="tile__go">Cadastre-se ${icon('chevron', 18)}</span></a>
          <a class="tile tile--line" href="/pedido-de-oracao"><span class="tile__icon">${icon('heart', 26)}</span><h3>${C('home.step3.title')}</h3><p>${C('home.step3.text')}</p><span class="tile__go">Enviar pedido ${icon('chevron', 18)}</span></a>
        </div>
      </div>
    </section>`;
}

function scheduleList(list) {
  if (!list.length) return '';
  const today = nowRecife().dow;
  return html`
    <ul class="sched">
      ${list.map((ev) => html`
        <li class="sched__row ${ev.weekday === today ? 'is-today' : ''}">
          <span class="sched__day">${WEEKDAYS[ev.weekday]}${ev.weekday === today ? html`<em class="pill">Hoje</em>` : ''}</span>
          <span class="sched__what"><strong>${ev.title}</strong>${ev.location ? html`<small>${ev.location}</small>` : ''}</span>
          <span class="sched__time">${ev.time_label}</span>
        </li>`)}
    </ul>`;
}

function pageEvents() {
  const weekly = weeklyEvents();
  const special = specialEvents();
  return html`
    ${pageHero({ title: C('events.hero.title'), text: C('events.hero.text'), image: C('events.hero.image'), imageAlt: C('events.hero.image_alt') })}
    <section class="section">
      <div class="wrap week week--page">
        ${C('home.week.image') ? html`<figure class="poster-frame"><img src="${C('home.week.image')}" alt="${C('home.week.image_alt')}" loading="lazy"></figure>` : ''}
        <div>
          <h2>${C('events.week.title')}</h2>
          ${weekly.length ? html`
            <ul class="sched sched--detail">
              ${weekly.map((ev) => html`
                <li class="sched__row ${ev.weekday === nowRecife().dow ? 'is-today' : ''}">
                  <span class="sched__day">${WEEKDAYS[ev.weekday]}${ev.weekday === nowRecife().dow ? html`<em class="pill">Hoje</em>` : ''}</span>
                  <span class="sched__what"><strong>${ev.title}</strong>${ev.description ? html`<small>${ev.description}</small>` : ''}${ev.location ? html`<small class="loc">${icon('pin', 14)} ${ev.location}</small>` : ''}</span>
                  <span class="sched__time">${ev.time_label}</span>
                </li>`)}
            </ul>` : html`<p class="section-text">A programação semanal será divulgada em breve.</p>`}
        </div>
      </div>
    </section>
    <section class="section section--mist">
      <div class="wrap">
        <h2>${C('events.special.title')}</h2>
        ${special.length ? html`
          <div class="evcards">
            ${special.map((ev) => html`
              <article class="evcard">
                ${ev.image ? html`<img src="${ev.image}" alt="" loading="lazy">` : html`<div class="evcard__ph">${icon('calendar', 34)}</div>`}
                <div class="evcard__body">
                  <p class="evcard__when">${eventDayLabel(ev)}${ev.time_label ? html`, ${ev.time_label}` : ''}</p>
                  <h3>${ev.title}</h3>
                  ${ev.description ? html`<p>${ev.description}</p>` : ''}
                  ${ev.location ? html`<p class="evcard__loc">${icon('pin', 16)} ${ev.location}</p>` : ''}
                </div>
              </article>`)}
          </div>` : html`<p class="section-text">${C('events.special.empty')}</p>`}
        ${C('events.note') ? html`<p class="note">${C('events.note')}</p>` : ''}
      </div>
    </section>`;
}

function pagePastors() {
  const list = state.data.pastors;
  return html`
    ${pageHero({ title: C('pastors.hero.title'), text: C('pastors.hero.text') })}
    <section class="section">
      <div class="wrap">
        ${list.length ? html`
          <div class="pastors">
            ${list.map((p) => html`
              <article class="pastor">
                ${p.photo ? html`<img class="pastor__photo" src="${p.photo}" alt="${p.name}" loading="lazy">` : html`<div class="pastor__avatar" aria-hidden="true">${initials(p.name)}</div>`}
                <h2>${p.name}</h2>
                ${p.role ? html`<p class="pastor__role">${p.role}</p>` : ''}
                ${p.bio ? html`<p>${p.bio}</p>` : ''}
              </article>`)}
          </div>` : html`<p class="section-text">Em breve apresentaremos a nossa liderança.</p>`}
        ${C('pastors.note') ? html`<p class="note">${C('pastors.note')}</p>` : ''}
      </div>
    </section>`;
}

function pageGiving() {
  const pix = C('giving.pix.key');
  const bank = [
    ['Banco', C('giving.bank.bank')], ['Agência', C('giving.bank.agency')], ['Conta', C('giving.bank.account')],
    ['Favorecido', C('giving.bank.holder')], ['CNPJ', C('giving.bank.doc')],
  ].filter((r) => r[1]);
  const hasBank = C('giving.bank.bank') || C('giving.bank.account');
  return html`
    ${pageHero({ title: C('giving.hero.title'), text: C('giving.hero.text'), image: C('giving.hero.image'), imageAlt: C('giving.hero.image_alt') })}
    <section class="section">
      <div class="wrap">
        <div class="giving3">
          <div><span class="pillar__icon">${icon('heart', 24)}</span><h3>${C('giving.tithe.title')}</h3><p>${C('giving.tithe.text')}</p></div>
          <div><span class="pillar__icon">${icon('gift', 24)}</span><h3>${C('giving.offering.title')}</h3><p>${C('giving.offering.text')}</p></div>
          <div><span class="pillar__icon">${icon('users', 24)}</span><h3>${C('giving.presential.title')}</h3><p>${C('giving.presential.text')}</p></div>
        </div>
      </div>
    </section>
    <section class="section section--mist">
      <div class="wrap pay">
        <div class="pix">
          <h2>${C('giving.pix.title')}</h2>
          <p>${C('giving.pix.text')}</p>
          ${pix
            ? html`<div class="pix__key"><code id="pixKey">${pix}</code><button type="button" class="btn btn--green" id="copyPix">${icon('copy', 18)} <span>Copiar chave</span></button></div>`
            : html`<p class="pix__empty">${C('giving.pix.empty')}</p>`}
        </div>
        ${hasBank ? html`
        <div class="bank">
          <h2>${C('giving.bank.title')}</h2>
          <dl>${bank.map((r) => html`<div><dt>${r[0]}</dt><dd>${r[1]}</dd></div>`)}</dl>
        </div>` : ''}
      </div>
    </section>`;
}

function formAlert() { return html`<div class="alert alert--err" role="alert" hidden></div>`; }

function pagePrayer() {
  return html`
    ${pageHero({ title: C('prayer.hero.title'), text: C('prayer.hero.text'), image: C('prayer.hero.image'), imageAlt: C('prayer.hero.image_alt') })}
    <section class="section">
      <div class="wrap narrow">
        <div id="prayerBox" class="formcard">
          <form id="prayerForm" class="form" novalidate>
            <label>Seu nome <small>(opcional)</small><input name="name" maxlength="120" autocomplete="name"></label>
            <label>E-mail ou WhatsApp <small>(opcional, se quiser retorno)</small><input name="contact" maxlength="160" autocomplete="email"></label>
            <label>Seu pedido de oração<textarea name="message" rows="6" maxlength="2000" required></textarea></label>
            <div class="hp" aria-hidden="true"><label>Não preencha<input name="website" tabindex="-1" autocomplete="off"></label></div>
            ${formAlert()}
            <button class="btn btn--navy btn--lg" type="submit">${icon('heart', 18)} Enviar pedido de oração</button>
            <p class="fine">${C('prayer.privacy')}</p>
          </form>
        </div>
      </div>
    </section>`;
}

function pageMember() {
  const benefits = lines(C('member.benefits'));
  return html`
    ${pageHero({ title: C('member.hero.title'), text: C('member.hero.text'), image: C('member.hero.image'), imageAlt: C('member.hero.image_alt') })}
    <section class="section">
      <div class="wrap member">
        <div class="member__side">
          <h2>Faça parte da nossa família</h2>
          <ul class="checks">${benefits.map((b) => html`<li>${icon('check', 20)}<span>${b}</span></li>`)}</ul>
          <p class="fine">${C('member.privacy')}</p>
        </div>
        <div id="memberBox" class="formcard">
          <form id="memberForm" class="form" novalidate>
            <label>Nome completo<input name="name" maxlength="120" autocomplete="name" required></label>
            <label>E-mail<input name="email" type="email" maxlength="190" autocomplete="email" required></label>
            <div class="form__row">
              <label>Telefone com DDD<input name="phone" inputmode="tel" maxlength="16" autocomplete="tel" placeholder="(87) 99999-9999" required></label>
              <label>Data de nascimento<input name="birthdate" type="date" autocomplete="bday" required></label>
            </div>
            <label class="check"><input type="checkbox" name="consent" value="1" required><span>${C('member.consent')}</span></label>
            <div class="hp" aria-hidden="true"><label>Não preencha<input name="website" tabindex="-1" autocomplete="off"></label></div>
            ${formAlert()}
            <button class="btn btn--navy btn--lg" type="submit">Enviar cadastro</button>
          </form>
        </div>
      </div>
    </section>
    <section class="section section--mist" id="equipe">
      <div class="wrap"><div id="team" class="team"><p class="section-text">Carregando…</p></div></div>
    </section>`;
}

function pageNotFound() {
  return html`
    <section class="phero"><div class="wrap phero__grid"><div class="phero__text">
      <h1>Página não encontrada</h1>
      <p class="lead">O endereço que você abriu não existe ou foi movido.</p>
      <p>${link('/', 'Voltar para o início')}</p>
    </div></div></section>`;
}

/* =====================================================================
 * Comportamentos de cada página (formulários, cópia do PIX, área da equipe)
 * ===================================================================== */

function showError(form, msg) {
  const box = $('.alert', form);
  box.textContent = msg;
  box.hidden = false;
  box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function successCard(title, text) {
  return html`<div class="success" role="status"><span class="success__icon">${icon('check', 30)}</span><h2>${title}</h2><p>${text}</p>${link('/', 'Voltar ao início', 'btn btn--outline')}</div>`;
}

function mountPrayer() {
  const form = $('#prayerForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    $('.alert', form).hidden = true;
    const fd = Object.fromEntries(new FormData(form));
    if (String(fd.message || '').trim().length < 5) return showError(form, 'Escreva o seu pedido de oração.');
    const btn = $('button[type=submit]', form);
    btn.disabled = true;
    try {
      await api('prayer', { method: 'POST', body: fd });
      $('#prayerBox').innerHTML = successCard(C('prayer.success.title'), C('prayer.success.text')).s;
    } catch (err) {
      showError(form, err.message);
      btn.disabled = false;
    }
  });
}

function mountMemberForm() {
  const form = $('#memberForm');
  if (!form) return;
  const phone = form.elements.phone;
  phone.addEventListener('input', () => { phone.value = formatPhone(phone.value); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    $('.alert', form).hidden = true;
    const fd = Object.fromEntries(new FormData(form));
    fd.consent = form.elements.consent.checked;
    if (String(fd.name || '').trim().length < 3) return showError(form, 'Informe o seu nome completo.');
    if (!/^\S+@\S+\.\S+$/.test(String(fd.email || ''))) return showError(form, 'Informe um e-mail válido.');
    if (String(fd.phone || '').replace(/\D/g, '').length < 10) return showError(form, 'Informe um telefone com DDD.');
    if (!fd.birthdate) return showError(form, 'Informe a data de nascimento.');
    if (!fd.consent) return showError(form, 'Para se cadastrar, é preciso autorizar o uso dos dados.');
    const btn = $('button[type=submit]', form);
    btn.disabled = true;
    try {
      await api('members', { method: 'POST', body: fd });
      $('#memberBox').innerHTML = successCard(C('member.success.title'), C('member.success.text')).s;
    } catch (err) {
      showError(form, err.message);
      btn.disabled = false;
    }
  });
}

function mountPix() {
  const btn = $('#copyPix');
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const key = $('#pixKey').textContent;
    try {
      await navigator.clipboard.writeText(key);
    } catch (e) {
      const range = document.createRange();
      range.selectNodeContents($('#pixKey'));
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('copy');
    }
    const span = $('span', btn);
    span.textContent = 'Chave copiada';
    setTimeout(() => { span.textContent = 'Copiar chave'; }, 2200);
  });
}

/** Área da equipe (login na própria Área do Membro). Administrador vê os dados dos membros. */
async function mountTeam() {
  const box = $('#team');
  if (!box) return;
  try {
    const me = await api('auth/me');
    state.user = me.user;
    setCsrf(me.csrf);
  } catch (e) { state.user = null; }
  renderTeam(box);
}

function renderTeam(box) {
  if (!state.user) {
    box.innerHTML = html`
      <div class="team__login">
        <div>
          <h2>Acesso da equipe</h2>
          <p class="section-text">Área para administradores e conteudistas. Entre para ver os dados dos membros ou editar o conteúdo do site.</p>
        </div>
        <form id="loginForm" class="form formcard" novalidate>
          <label>E-mail<input name="email" type="email" autocomplete="username" required></label>
          <label>Senha<input name="password" type="password" autocomplete="current-password" required></label>
          ${formAlert()}
          <button class="btn btn--navy" type="submit">Entrar</button>
        </form>
      </div>`.s;
    const form = $('#loginForm', box);
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      $('.alert', form).hidden = true;
      const btn = $('button', form);
      btn.disabled = true;
      try {
        const res = await api('auth/login', { method: 'POST', body: Object.fromEntries(new FormData(form)) });
        state.user = res.user;
        setCsrf(res.csrf);
        renderTeam(box);
      } catch (err) {
        showError(form, err.message);
        btn.disabled = false;
      }
    });
    return;
  }
  const isAdmin = state.user.role === 'admin';
  box.innerHTML = html`
    <div class="team__head">
      <div>
        <h2>${isAdmin ? 'Dados dos membros' : 'Acesso da equipe'}</h2>
        <p class="section-text">Você entrou como <strong>${state.user.name}</strong> (${isAdmin ? 'administrador' : 'conteudista'}).</p>
      </div>
      <div class="team__actions">
        <a class="btn btn--navy" href="/admin/">Abrir painel completo</a>
        <button class="btn btn--outline" id="logoutBtn" type="button">Sair</button>
      </div>
    </div>
    ${isAdmin ? html`
      <div class="team__tools">
        <input id="memberSearch" type="search" placeholder="Buscar por nome, e-mail ou telefone" aria-label="Buscar membros">
        <a class="btn btn--green" href="/api/admin/members/export">${icon('download', 18)} Exportar CSV</a>
      </div>
      <p class="fine" id="memberCount"></p>
      <div class="table-wrap"><table class="table"><thead><tr><th>Nome</th><th>E-mail</th><th>Telefone</th><th>Idade</th><th>Cadastro</th></tr></thead><tbody id="memberRows"></tbody></table></div>
      <p><button class="btn btn--outline" id="moreMembers" type="button" hidden>Carregar mais</button></p>` :
      html`<p class="fine">Os dados dos membros ficam visíveis somente para administradores.</p>`}`.s;
  $('#logoutBtn', box).addEventListener('click', async () => {
    try { await api('auth/logout', { method: 'POST' }); } catch (e) { /* segue mesmo assim */ }
    state.user = null;
    setCsrf('');
    renderTeam(box);
  });
  if (isAdmin) mountMembers(box);
}

function mountMembers(box) {
  let offset = 0;
  const limit = 50;
  let query = '';
  const rows = $('#memberRows', box);
  const more = $('#moreMembers', box);
  async function load(reset) {
    if (reset) { offset = 0; rows.innerHTML = ''; }
    try {
      const res = await api('admin/members?limit=' + limit + '&offset=' + offset + '&q=' + encodeURIComponent(query));
      rows.insertAdjacentHTML('beforeend', res.members.map((m) => html`
        <tr><td>${m.name}</td><td>${m.email}</td><td>${formatPhone(m.phone)}</td><td>${ageFrom(m.birthdate)}</td><td>${formatDateShort(String(m.created_at).slice(0, 10))}</td></tr>`.s).join(''));
      offset += res.members.length;
      $('#memberCount', box).textContent = res.total + (res.total === 1 ? ' membro cadastrado' : ' membros cadastrados') + (query ? ' nesta busca' : '');
      more.hidden = offset >= res.total;
      if (!res.total) rows.innerHTML = '<tr><td colspan="5" class="empty">Nenhum membro encontrado.</td></tr>';
    } catch (err) {
      $('#memberCount', box).textContent = err.message;
    }
  }
  $('#memberSearch', box).addEventListener('input', debounce((e) => { query = e.target.value.trim(); load(true); }, 300));
  more.addEventListener('click', () => load(false));
  load(true);
}

/* =====================================================================
 * Roteador
 * ===================================================================== */

const PAGES = {
  '/': { view: pageHome, title: null, text: 'home.hero.text', mount: () => {} },
  '/eventos': { view: pageEvents, title: 'events.hero.title', text: 'events.hero.text', mount: () => {} },
  '/pastores': { view: pagePastors, title: 'pastors.hero.title', text: 'pastors.hero.text', mount: () => {} },
  '/ofertas-e-dizimos': { view: pageGiving, title: 'giving.hero.title', text: 'giving.hero.text', mount: mountPix },
  '/pedido-de-oracao': { view: pagePrayer, title: 'prayer.hero.title', text: 'prayer.hero.text', mount: mountPrayer },
  '/area-do-membro': { view: pageMember, title: 'member.hero.title', text: 'member.hero.text', mount: () => { mountMemberForm(); mountTeam(); } },
};

function setMeta(title, desc) {
  document.title = title;
  const set = (sel, attr, val) => { const el = $(sel); if (el) el.setAttribute(attr, val); };
  set('meta[name="description"]', 'content', desc);
  set('meta[property="og:title"]', 'content', title);
  set('meta[property="og:description"]', 'content', desc);
  set('meta[property="og:url"]', 'content', location.origin + state.path);
  set('link[rel="canonical"]', 'href', location.origin + state.path);
}

function normalize(p) {
  const clean = '/' + String(p || '/').replace(/^\/+|\/+$/g, '');
  return clean === '/index.php' ? '/' : clean;
}

function renderPage() {
  const path = normalize(location.pathname);
  state.path = path;
  const page = PAGES[path];
  const main = $('#main');
  if (!page) {
    main.innerHTML = pageNotFound().s;
    setMeta('Página não encontrada – ' + C('site.name'), C('seo.description'));
  } else {
    main.innerHTML = page.view().s;
    const title = page.title ? C(page.title) + ' – ' + C('site.name') : C('seo.title');
    setMeta(title, (page.title ? C(page.text) : C('seo.description')).replace(/\s+/g, ' ').slice(0, 160));
    page.mount();
  }
  $$('#nav a[data-nav]').forEach((a) => {
    const on = a.getAttribute('data-nav') === path;
    a.classList.toggle('is-active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  const fab = $('#fabPray');
  if (fab) fab.hidden = path === '/pedido-de-oracao';
  closeMenu();
}

function go(path, { replace = false } = {}) {
  if (replace) history.replaceState({}, '', path); else history.pushState({}, '', path);
  const [p, hash] = path.split('#');
  renderPage();
  state.firstLoad = false;
  if (hash) { const t = document.getElementById(hash); if (t) { t.scrollIntoView(); return; } }
  window.scrollTo(0, 0);
  const main = $('#main');
  main.focus({ preventScroll: true });
}

function isInternalLink(a) {
  if (!a || a.target === '_blank' || a.hasAttribute('download')) return false;
  const href = a.getAttribute('href') || '';
  if (!href.startsWith('/') || href.startsWith('//')) return false;
  if (/^\/(admin|api|uploads|assets)(\/|$)/.test(href)) return false;
  if (/\.[a-z0-9]{2,5}($|\?)/i.test(href.split('#')[0])) return false;
  return true;
}

function closeMenu() {
  const nav = $('#nav');
  if (!nav) return;
  nav.classList.remove('is-open');
  const btn = $('#menuBtn');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-label', 'Abrir menu');
  document.body.classList.remove('menu-open');
}

function boot() {
  let data = null;
  const inline = $('#cen-data');
  if (inline) { try { data = JSON.parse(inline.textContent); } catch (e) { data = null; } }
  const start = (d) => {
    state.data = d;
    app.innerHTML = (html`${header()}<main id="main" tabindex="-1"></main>${footer()}${floating()}`).s;
    wireShell();
    renderPage();
    state.firstLoad = false;
  };
  if (data) start(data);
  else api('site').then(start).catch((e) => { app.innerHTML = '<p style="padding:2rem">Não foi possível carregar o site. Tente novamente em instantes.</p>'; });
}

function wireShell() {
  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a');
    if (!isInternalLink(a)) return;
    e.preventDefault();
    go(a.getAttribute('href'));
  });
  window.addEventListener('popstate', () => { renderPage(); window.scrollTo(0, 0); });
  $('#menuBtn').addEventListener('click', () => {
    const nav = $('#nav');
    const open = !nav.classList.contains('is-open');
    nav.classList.toggle('is-open', open);
    $('#menuBtn').setAttribute('aria-expanded', String(open));
    $('#menuBtn').setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
    document.body.classList.toggle('menu-open', open);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
  const toTop = $('#toTop');
  const onScroll = () => {
    $('#header').classList.toggle('is-stuck', window.scrollY > 8);
    toTop.classList.toggle('is-visible', window.scrollY > 700);
  };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  toTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

boot();
