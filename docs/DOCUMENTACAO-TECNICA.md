# Documentação técnica

Site institucional da **Comunidade Entre Nações (CEN)**, Petrolina-PE, com painel de gestão (CMS). Feito para **hospedagem compartilhada da Hostinger (PHP + MySQL)**, versionado no **GitHub**.

> Público deste documento: quem for manter ou evoluir o código. Para publicar o site, veja [PASSO-A-PASSO-GITHUB-E-HOSTINGER.md](PASSO-A-PASSO-GITHUB-E-HOSTINGER.md). Para usar o painel, veja [MANUAL-DO-PAINEL.md](MANUAL-DO-PAINEL.md).

## Sumário

1. [Decisões de arquitetura](#1-decisões-de-arquitetura)
2. [Requisitos](#2-requisitos)
3. [Estrutura de pastas](#3-estrutura-de-pastas)
4. [Como uma página é entregue](#4-como-uma-página-é-entregue)
5. [Banco de dados](#5-banco-de-dados)
6. [Modelo de conteúdo (CMS)](#6-modelo-de-conteúdo-cms)
7. [API](#7-api)
8. [Perfis e permissões](#8-perfis-e-permissões)
9. [Segurança](#9-segurança)
10. [E-mail](#10-e-mail)
11. [Front-end público](#11-front-end-público)
12. [Painel de gestão](#12-painel-de-gestão)
13. [Design system](#13-design-system)
14. [SEO e compartilhamento](#14-seo-e-compartilhamento)
15. [Testes e verificação](#15-testes-e-verificação)
16. [Como estender](#16-como-estender)
17. [Limitações e próximos passos](#17-limitações-e-próximos-passos)

---

## 1. Decisões de arquitetura

| Decisão | Motivo |
|---|---|
| **PHP + MySQL**, sem framework e sem Composer | A hospedagem compartilhada da Hostinger roda PHP/MySQL e não roda Node. Sem dependências, o que está no Git é o que roda. |
| **Front-end em JavaScript puro (módulos ES), sem build** | Não há etapa de compilação no servidor; qualquer pessoa edita e publica. O projeto original era React/TanStack Start (Netlify), incompatível com esse plano. |
| **PHP entrega o "esqueleto" e a API; o navegador monta a página** | O `index.php` já embute título, descrição, imagem de compartilhamento e todos os dados (JSON) no HTML. O site abre sem espera e o WhatsApp/Google leem os metadados. |
| **Conteúdo editável definido em um único JSON** (`app/content-schema.json`) | Um só lugar gera os campos do painel, os textos padrão e as validações. Adicionar um campo não exige tocar no banco. |
| **Sem login de membros** | Decisão do projeto: só administradores e conteudistas entram; membros apenas se cadastram. |
| **Cores do logo** (azul-marinho `#081B3F` e verde `#8DB84A`) | Identidade visual da igreja, ajustável em Configurações. |

## 2. Requisitos

- **PHP 7.4+** (testado apenas por revisão; recomenda-se 8.2/8.3), com `pdo_mysql`, `json`. Recomendadas: `openssl` (senha do SMTP), `mbstring`, `gd` (redimensiona uploads).
- **MySQL 5.7+ / MariaDB 10.3+**, charset `utf8mb4`.
- Apache/LiteSpeed com `mod_rewrite` e `.htaccess` (padrão da Hostinger).
- Site na **raiz do domínio** (`public_html`) ou de um subdomínio. Instalar em subpasta não é suportado.

## 3. Estrutura de pastas

```
/
├─ index.php               Página pública (SEO + JSON embutido). Todas as URLs do site caem aqui.
├─ install.php             Instalador de uso único (cria config.php, tabelas e o 1º admin).
├─ robots.php, sitemap.php Servidos como /robots.txt e /sitemap.xml (montam a URL do domínio).
├─ site.webmanifest        Ícones/tema do site instalável.
├─ favicon.ico, favicon-*.png, apple-touch-icon.png, icon-192.png, icon-512.png
├─ .htaccess               Rotas, bloqueios, cabeçalhos de segurança (CSP), cache.
├─ config.sample.php       Modelo. O config.php real é gerado pelo instalador (não vai ao Git).
│
├─ admin/index.php         Casca HTML do painel (a lógica é assets/js/admin.js).
├─ api/index.php           Ponto de entrada da API JSON.
│
├─ app/                    Código PHP interno (bloqueado na web)
│   ├─ bootstrap.php       Carrega tudo; define fuso America/Recife; registra o tratador de erros.
│   ├─ helpers.php         cfg(), e(), json_out(), fail(), clean_line(), valid_*(), log_error()…
│   ├─ db.php              PDO (utf8mb4, exceções) + atalhos q(), q_all(), q_one(), q_val(), db_insert().
│   ├─ security.php        Sessão, login, CSRF, origem, limitador, criptografia do SMTP.
│   ├─ content.php         Campos editáveis (defaults + banco) e configurações.
│   ├─ collections.php     Listas: eventos, pastores, novidades (CRUD genérico).
│   ├─ mail.php            E-mail via mail() ou SMTP próprio.
│   ├─ upload.php          Upload e reprocessamento de imagens.
│   ├─ api.php             Tabela de rotas e todos os handlers.
│   ├─ content-schema.json Campos do CMS + textos padrão + dados iniciais.
│   ├─ schema.sql          Tabelas do MySQL.
│   └─ .htaccess           Nega acesso web.
│
├─ assets/
│   ├─ css/site.css        Estilos do site público.
│   ├─ css/admin.css       Estilos do painel.
│   ├─ js/common.js        html``, esc(), api(), ícones, datas (fuso de Petrolina).
│   ├─ js/site.js          Roteador, páginas, formulários, área da equipe.
│   ├─ js/admin.js         Painel (CMS).
│   └─ img/                Logo e imagens padrão.
│
├─ uploads/                Imagens enviadas pelo painel (fora do Git; .htaccess bloqueia scripts).
├─ storage/                logs/error.log e installed.lock (fora do Git; acesso web negado).
├─ dev/                    Simulador da API e testes (não usado em produção).
├─ docs/                   Esta documentação.
└─ .github/workflows/      check.yml (valida sintaxe) e deploy-ftp.yml.exemplo (opcional).
```

## 4. Como uma página é entregue

1. O navegador pede `/eventos`. O `.htaccess` não encontra arquivo com esse nome e reescreve para `index.php`.
2. `index.php` monta `site_payload()` (conteúdo + cores + eventos + pastores + novidades), calcula `<title>`, descrição, Open Graph e JSON-LD (`Church`) e devolve o HTML com:
   - `<style>:root{--navy:…;--green:…}</style>` (cores das Configurações)
   - `<script id="cen-data" type="application/json">…</script>` (dados, com `JSON_HEX_*` para não quebrar o HTML)
   - `<script type="module" src="/assets/js/site.js?v=<mtime>">`
3. `site.js` lê o JSON embutido, desenha cabeçalho/rodapé/botões flutuantes uma única vez e a página atual dentro de `<main>`. Cliques em links internos usam `history.pushState` (sem recarregar).
4. Formulários e a área da equipe conversam com `/api/...` (JSON).
5. Se o JSON embutido faltar, o site busca `/api/site`. Se o banco falhar, `index.php` cai nos textos padrão do `content-schema.json` (o site continua abrindo).

`/admin/` entrega `admin/index.php` (casca) e o restante roda em `admin.js`, com rotas por hash (`#/conteudo/inicio`).

## 5. Banco de dados

Todas as tabelas: `ENGINE=InnoDB`, `utf8mb4_unicode_ci`. Definidas em `app/schema.sql` (`CREATE TABLE IF NOT EXISTS`).

| Tabela | Finalidade | Colunas principais |
|---|---|---|
| `users` | Contas do painel | `id`, `name`, `email` (único), `password_hash`, `role` (`admin`/`editor`), `active`, `last_login`, `created_at` |
| `settings` | Configurações (só admin) | `k` (PK), `v` |
| `content` | Textos/imagens editados no painel (sobrescrevem o padrão) | `k` (PK), `v`, `updated_at`, `updated_by` |
| `events` | Eventos | `title`, `weekday` (0=dom…6=sáb, nulo se especial), `event_date`, `day_label`, `time_label`, `location`, `description`, `image`, `sort_order`, `published` |
| `pastors` | Pastores | `name`, `role`, `bio`, `photo`, `sort_order`, `published` |
| `highlights` | Novidades da home | `title`, `caption`, `image`, `link`, `sort_order`, `published` |
| `members` | Membros cadastrados | `name`, `email` (único), `phone` (só dígitos), `birthdate`, `consent_at`, `created_at` |
| `prayer_requests` | Pedidos de oração | `name`, `contact`, `message`, `handled`, `created_at` |
| `throttle` | Limitador de tentativas | `bucket`, `created_at` (limpo automaticamente após 24 h) |

Chaves usadas em `settings`: `color_navy`, `color_green`, `mail_from_email`, `mail_from_name`, `mail_reply_to`, `mail_prayer_to`, `mail_welcome`, `mail_transport` (`mail`/`smtp`), `smtp_host`, `smtp_port`, `smtp_secure` (`ssl`/`tls`/`none`), `smtp_user`, `smtp_pass` (criptografada).

## 6. Modelo de conteúdo (CMS)

### 6.1 Campos de texto/imagem (`content-schema.json` > `groups`)

Cada campo tem: `key` (ex.: `home.hero.title`), `label`, `type`, `default`, e opcionais `help`, `max`, `admin_only`.

| `type` | No painel | Validação no servidor |
|---|---|---|
| `text` | Linha única | Até 300 caracteres, sem quebras |
| `textarea` | Várias linhas | Até 4000 caracteres |
| `url` | Link | `http(s)://`, `mailto:` ou `tel:` |
| `image` | Prévia + enviar/remover/usar padrão | Caminho `/assets/img/…`, `/uploads/…` ou `https://…` |

- **Valor em uso = padrão + alteração salva** (`content_all()`): o banco só guarda o que foi editado.
- `admin_only`: só administrador lê/edita (usado para PIX e dados bancários). O servidor recusa com 403 mesmo se o conteudista tentar por fora do painel.
- `contact.whatsapp` é normalizado para só dígitos ao salvar.
- Campo vazio é permitido: o site esconde o bloco correspondente (endereço, PIX, aviso dos pastores…).

Grupos atuais (97 campos):

| Grupo | id | Campos | Exemplos |
|---|---|---|---|
| Identidade e compartilhamento | `geral` | 5 | `site.name`, `site.short`, `seo.title`, `seo.description`, … |
| Contato, endereço e redes sociais | `contato` | 11 | `contact.email`, `contact.whatsapp`, `contact.whatsapp_text`, `contact.city`, … |
| Página inicial | `inicio` | 34 | `home.hero.badge`, `home.hero.title`, `home.hero.text`, `home.hero.cta1`, … |
| Página Eventos | `eventos` | 8 | `events.hero.title`, `events.hero.text`, `events.hero.image`, `events.hero.image_alt`, … |
| Página Pastores | `pastores` | 3 | `pastors.hero.title`, `pastors.hero.text`, `pastors.note`, … |
| Página Ofertas e Dízimos | `ofertas` | 20 (6 só admin) | `giving.hero.title`, `giving.hero.text`, `giving.hero.image`, `giving.hero.image_alt`, … |
| Página Pedido de Oração | `oracao` | 7 | `prayer.hero.title`, `prayer.hero.text`, `prayer.hero.image`, `prayer.hero.image_alt`, … |
| Página Área do Membro | `membro` | 9 | `member.hero.title`, `member.hero.text`, `member.hero.image`, `member.hero.image_alt`, … |

### 6.2 Listas (`app/collections.php`)

`events`, `pastors` e `highlights` compartilham o mesmo CRUD genérico: definição de campos em `collections_def()` (tipos `text`, `textarea`, `image`, `url`, `date`, `weekday`), ordenação por `sort_order`, ocultar por `published`, dados iniciais em `content-schema.json > collections` (inseridos pelo instalador quando a tabela está vazia).

Regras de eventos:

- **Encontro semanal:** `weekday` preenchido. Aparece na programação; a home calcula o **próximo encontro** no fuso de Petrolina (`America/Recife`): se o de hoje já passou de 1h30 do início, vale o da semana seguinte. O horário é lido de `time_label` ("19h30", "18h", "19:30").
- **Evento especial:** `event_date` preenchida. Some sozinho da API pública depois da data.
- `day_label` substitui o texto do dia (ex.: "3ª sexta do mês"); nesse caso deixe `weekday` vazio.

## 7. API

Base: `/api/`. Respostas JSON com `ok: true|false`; erros trazem `error` (texto para o usuário). Roteamento e permissões: `api_routes()` em `app/api.php`.

| Método | Rota | Quem acessa | O que faz |
|---|---|---|---|
| `GET` | `/api/site` | Público | Conteúdo, cores, eventos, pastores e novidades publicados (o mesmo JSON embutido no index.php). |
| `POST` | `/api/prayer` | Público | Cria pedido de oração. Corpo: name, contact, message, website (armadilha). Limite: 6/hora por IP. Avisa por e-mail se configurado. |
| `POST` | `/api/members` | Público | Cadastro público de membro. Corpo: name, email, phone, birthdate, consent, website. Limite: 6/hora por IP. E-mail único. |
| `GET` | `/api/auth/me` | Público | Usuário da sessão e token CSRF (ou user: null). |
| `POST` | `/api/auth/login` | Público | Login. Corpo: email, password. Limite: 10 falhas/15 min por IP e 6 por e-mail. |
| `POST` | `/api/auth/logout` | Qualquer usuário logado | Encerra a sessão. |
| `PUT` | `/api/account/password` | Qualquer usuário logado | Troca a própria senha. Corpo: current, new (mín. 10). |
| `GET` | `/api/admin/dashboard` | Conteudista ou administrador | Contagens e últimos membros (membros só para admin). |
| `GET` | `/api/admin/content` | Conteudista ou administrador | GET: grupos, campos e valores (campos admin_only omitidos para conteudista). PUT: {values:{chave:valor}}. |
| `PUT` | `/api/admin/content` | Conteudista ou administrador | GET: grupos, campos e valores (campos admin_only omitidos para conteudista). PUT: {values:{chave:valor}}. |
| `POST` | `/api/admin/upload` | Conteudista ou administrador | Envio de imagem (multipart, campo file). Devolve {url}. |
| `GET` | `/api/admin/collections` | Conteudista ou administrador | Definição dos campos das listas (events, pastors, highlights). |
| `GET` | `/api/admin/collections/{c}` | Conteudista ou administrador | GET lista todos os itens; POST cria um item. |
| `POST` | `/api/admin/collections/{c}` | Conteudista ou administrador | GET lista todos os itens; POST cria um item. |
| `POST` | `/api/admin/collections/{c}/reorder` | Conteudista ou administrador | Reordena. Corpo: {ids:[...]}. |
| `PUT` | `/api/admin/collections/{c}/{id}` | Conteudista ou administrador | PUT atualiza; DELETE exclui. |
| `DELETE` | `/api/admin/collections/{c}/{id}` | Conteudista ou administrador | PUT atualiza; DELETE exclui. |
| `GET` | `/api/admin/members` | Somente administrador | Lista paginada. Parâmetros: q, limit (máx. 200), offset. |
| `GET` | `/api/admin/members/export` | Somente administrador | Baixa CSV (UTF-8 com BOM, separador ";", protegido contra injeção de fórmulas). |
| `DELETE` | `/api/admin/members/{id}` | Somente administrador | Exclui o cadastro. |
| `GET` | `/api/admin/prayers` | Somente administrador | Lista pedidos (não atendidos primeiro). |
| `PUT` | `/api/admin/prayers/{id}` | Somente administrador | PUT {handled} marca atendido; DELETE exclui. |
| `DELETE` | `/api/admin/prayers/{id}` | Somente administrador | PUT {handled} marca atendido; DELETE exclui. |
| `GET` | `/api/admin/users` | Somente administrador | GET lista; POST cria {name,email,role,password}. |
| `POST` | `/api/admin/users` | Somente administrador | GET lista; POST cria {name,email,role,password}. |
| `PUT` | `/api/admin/users/{id}` | Somente administrador | PUT edita (name,email,role,active,password); DELETE exclui. Protege o último admin e o próprio usuário. |
| `DELETE` | `/api/admin/users/{id}` | Somente administrador | PUT edita (name,email,role,active,password); DELETE exclui. Protege o último admin e o próprio usuário. |
| `GET` | `/api/admin/settings` | Somente administrador | GET configurações (sem a senha do SMTP) e diagnóstico; PUT salva {settings:{...}}. |
| `PUT` | `/api/admin/settings` | Somente administrador | GET configurações (sem a senha do SMTP) e diagnóstico; PUT salva {settings:{...}}. |
| `POST` | `/api/admin/settings/test-email` | Somente administrador | Envia e-mail de teste. Corpo: {to} (opcional). |

Códigos: `400` validação · `401` sem login · `403` sem permissão/CSRF/origem · `404` rota · `405` método · `409` duplicado · `413` arquivo grande · `429` limite de tentativas · `500` erro interno (detalhe em `storage/logs/error.log`).

Ações que alteram dados no painel exigem o cabeçalho `X-CSRF-Token` (valor devolvido por `auth/me` e `auth/login`).

## 8. Perfis e permissões

| Recurso | Administrador | Conteudista |
|---|:---:|:---:|
| Conteúdo do site (campos comuns) | ✔ | ✔ |
| Eventos, pastores, novidades | ✔ | ✔ |
| Upload de imagens | ✔ | ✔ |
| PIX e dados bancários | ✔ | ✘ |
| Membros (ver, buscar, excluir, exportar) | ✔ | ✘ |
| Pedidos de oração | ✔ | ✘ |
| Usuários | ✔ | ✘ |
| Configurações (e-mail, cores, diagnóstico) | ✔ | ✘ |
| Trocar a própria senha | ✔ | ✔ |

Regras extras: não é possível desativar/rebaixar/excluir o **último administrador** nem o **próprio** usuário.

Na **Área do Membro** do site público, quem entra como administrador vê a lista de membros; o conteudista vê apenas um aviso.

## 9. Segurança

- **Senhas:** `password_hash` (bcrypt/argon padrão do PHP), mínimo de 10 caracteres.
- **Sessão:** cookie `cen_sess`, `HttpOnly`, `SameSite=Lax`, `Secure` em HTTPS, regeneração do id no login, expira em 12 h. Só é criada no login (visitante anônimo não recebe sessão).
- **CSRF:** token por sessão exigido em toda requisição não-GET do painel.
- **Formulários públicos:** verificação de `Origin`, campo-armadilha (`website`), limite de 6 envios/hora por IP.
- **Login:** limite de 10 falhas/15 min por IP e 6 por e-mail (tabela `throttle`); mensagem genérica.
- **SQL:** sempre com parâmetros (PDO com prepares nativos).
- **XSS:** o front-end usa a função `html` (template com escape), que escapa todo valor; links passam por `safeUrl()`; o JSON embutido usa `JSON_HEX_TAG|AMP|APOS|QUOT`.
- **Uploads:** valida tamanho (8 MB), tipo real via `getimagesize` (JPG/PNG/WEBP/GIF), dimensão (8000 px); reprocessa com GD (limite 1800 px, remove metadados); nome aleatório; `uploads/.htaccess` nega execução de scripts.
- **Segredos:** `config.php` fora do Git; `app/`, `storage/`, `dev/`, `docs/` negados pelo `.htaccess`; senha do SMTP criptografada com AES-256-GCM usando `app_key`.
- **Cabeçalhos:** CSP restritiva (só o próprio site + Google Fonts), `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`.
- **CSV:** células iniciadas por `= + - @` recebem apóstrofo (evita injeção de fórmulas no Excel).
- **LGPD:** cadastro com autorização explícita (`consent_at`), aviso de privacidade editável, exclusão de membro pelo administrador. Falta (recomendado) uma política de privacidade publicada.

## 10. E-mail

`send_mail()` em `app/mail.php` envia **texto simples** (UTF-8, base64), com remetente das Configurações.

- **`mail`** (padrão do servidor): usa `mail()` com `-f`. Simples, mas pode cair no spam.
- **`smtp`** (recomendado): cliente SMTP próprio (`ssl` porta 465, `tls`/STARTTLS porta 587, ou sem criptografia), autenticação `AUTH LOGIN`. Hostinger: `smtp.hostinger.com`, 465/SSL, usuário = e-mail completo.

Envios: aviso de novo **pedido de oração** (para `mail_prayer_to`, ou o remetente se vazio), **boas-vindas** a novos membros (se `mail_welcome=1`) e **e-mail de teste** (Configurações). Falha de e-mail nunca impede a gravação do pedido/cadastro; o erro vai para `storage/logs/error.log`.

## 11. Front-end público

- `common.js`: função `html` (template com escape), `esc`, `safeUrl`, `api()`, ícones SVG, fuso e formatação de datas/telefone.
- `site.js`: dados em `state.data`; helper `C('chave')` lê o conteúdo; `PAGES` mapeia URL → função de página → `mount()` (comportamentos); `renderPage()` troca o `<main>`, atualiza título/meta e o item ativo do menu.
- Rotas: `/`, `/eventos`, `/pastores`, `/ofertas-e-dizimos`, `/pedido-de-oracao`, `/area-do-membro`; outras dão página 404 amigável.
- Acessibilidade: link "Pular para o conteúdo", foco visível, `aria-current`, `aria-expanded` no menu, textos alternativos editáveis, `prefers-reduced-motion`.
- Botões flutuantes: WhatsApp (só se houver número), pedido de oração (some na própria página) e voltar ao topo.

Para acrescentar uma página, veja [16.3](#163-nova-página-pública).

## 12. Painel de gestão

- Rotas por hash: `#/painel`, `#/conteudo/<grupo>`, `#/eventos`, `#/pastores`, `#/novidades`, `#/membros`, `#/oracao`, `#/usuarios`, `#/configuracoes`, `#/conta`.
- **Conteúdo:** formulário gerado do schema; guarda só os campos alterados (`S.dirty`), barra "N alterações não salvas", aviso ao sair e ao fechar a aba.
- **Listas:** linhas com subir/descer, editar (diálogo `<dialog>`), excluir e ocultar.
- O menu esconde áreas por perfil, e o servidor **também** bloqueia (nunca confie só no menu).

## 13. Design system

**Cores** (variáveis CSS em `:root`, base do logo; `--navy` e `--green` são substituídas por Configurações):

| Token | Valor padrão | Uso |
|---|---|---|
| `--navy` | `#081B3F` | Texto forte, botões, faixas |
| `--navy-deep` | 80% navy + preto | Heróis e rodapé |
| `--green` | `#8DB84A` | Botões de destaque, marcações |
| `--green-deep` | 60% green + preto | Texto verde sobre fundo claro (contraste) |
| `--green-tint` | 15% green + branco | Realces suaves |
| `--mist` | 5% navy + branco | Seções alternadas |

**Tipografia:** *Bricolage Grotesque* (títulos) e *Figtree* (texto), via Google Fonts, com fontes do sistema como reserva.

**Componentes:** botões (`btn--green|navy|ghost|outline`), herói da home (colagem de 2 fotos) e herói interno, barra "Próximo encontro", lista de programação, pôsteres, blocos de passos, cartão de formulário, tabelas, botões flutuantes. Quebras: 980 px e 640 px.

## 14. SEO e compartilhamento

Título e descrição por página, `canonical`, Open Graph (`og:image` editável em Conteúdo > Identidade), `twitter:card`, JSON-LD `Church`, `robots.txt` (bloqueia `/admin/`, `/api/`, `/app/`, `/install.php`) e `sitemap.xml`. Metadados são gerados no servidor; o corpo da página é montado no navegador.

## 15. Testes e verificação

| O quê | Como | O que cobre |
|---|---|---|
| **CI no GitHub** (`check.yml`) | Automático a cada push/PR | `php -l` no PHP 7.4/8.2/8.3, JSON válido, sintaxe JS |
| **Simulador** (`dev/mock-server.mjs`) | `node dev/mock-server.mjs` | Reimplementa a API em memória para ver/testar o front-end sem PHP |
| **E2E** (`dev/e2e.mjs`) | Playwright contra o simulador | 50 verificações: navegação, formulários, login, permissões, edição, upload, eventos, configurações, usuários |
| **Verificação estática** (`dev/check_project.py`) | `python3 dev/check_project.py .` (roda também no CI) | Estrutura do PHP, funções duplicadas, compatibilidade com PHP 7.4, campos do schema × uso no código, rotas PHP × simulador × chamadas do JS, sintaxe JS, segredos na pasta |

**Limite importante:** o PHP foi escrito e revisado sem poder ser executado no ambiente de desenvolvimento. O simulador prova o front-end e o contrato da API, **não** o PHP real. Antes de divulgar o site, execute o checklist da seção 3.11 do passo a passo e observe `storage/logs/error.log`.

## 16. Como estender

### 16.1 Novo campo de texto/imagem em uma página existente
1. Adicione o campo em `app/content-schema.json` no grupo certo (`key`, `label`, `type`, `default`).
2. Use no `site.js` com `C('grupo.nome')` dentro da função da página.
3. Pronto: o painel mostra o campo sozinho; não há migração de banco.

### 16.2 Nova lista editável (ex.: "Ministérios")
1. Tabela em `app/schema.sql` (`id`, campos, `sort_order`, `published`) e, para sites já instalados, execute o `CREATE TABLE` no phpMyAdmin.
2. Entrada em `collections_def()` (`app/collections.php`) e, se quiser dados iniciais, em `content-schema.json > collections`.
3. Inclua `'ministries'` no laço de `site_payload()` (`app/api.php`) e no `PAGES`/página do `site.js`.
4. Painel: item em `NAV` (`admin.js`) com `coll: 'ministries'`. Nada mais é necessário: rotas e formulário são genéricos.
5. Espelhe em `dev/mock-server.mjs` (`COLLECTIONS`, `db`).

### 16.3 Nova página pública
1. Campos do herói e textos no `content-schema.json`.
2. Função `pageNova()` e entrada em `PAGES` (`site.js`); link em `NAV` (menu/rodapé).
3. Adicione a rota em `$routes` (`index.php`), em `sitemap.php` e na lista do `mock-server.mjs`.

### 16.4 Nova configuração (somente admin)
Adicione a chave em `settings_defaults()` (`app/content.php`), o tratamento em `h_settings_save()` e o campo em `viewSettings()` (`admin.js`).

### 16.5 Nova rota de API
Linha em `api_routes()` (método, padrão com `{param}`, handler `h_*`, acesso) + função `h_*($p, $u)` + espelho em `ROUTES`/`HANDLERS` do simulador. O CI e o script de verificação acusam divergência.

### 16.6 Mudar a paleta
Pelo painel (Configurações) para as duas cores principais; para derivadas, ajuste as fórmulas `color-mix` no topo de `site.css` e `admin.css`.

## 17. Limitações e próximos passos

- **PHP sem execução prévia** (ver seção 15). O CI e o checklist reduzem, mas não eliminam, o risco de um erro de execução.
- **Deploys da Hostinger e arquivos do servidor:** confirmar (segundo deploy) que `config.php`, `uploads/` e `storage/` são preservados.
- **Sem login de membros**, sem recuperação de senha por e-mail, sem 2FA no painel.
- **Sem política de privacidade** publicada e sem rotina automática de exclusão/retenção de dados.
- **E-mails só em texto simples**, sem fila (envio é síncrono e limitado a 12 s de conexão).
- **Fotos do Instagram** têm baixa resolução; o ideal é receber fotos originais horizontais.
- **Ideias:** aniversariantes do mês (tarefa cron da Hostinger + e-mail), galeria de fotos, transmissão ao vivo, biblioteca de mídia no painel, log de auditoria de edições, backup automático do banco.
