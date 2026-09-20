# Ferramentas de desenvolvimento

Nada desta pasta é usado no servidor (o `.htaccess` bloqueia `/dev`).

## Pré-visualização sem PHP

```bash
node dev/mock-server.mjs        # http://localhost:8080
```

Simula a API em memória para ver e testar o visual do site e do painel.
Logins de teste: `admin@cen.test` e `editor@cen.test`, senha `senhaforte123`.
Ele **não** executa o PHP: para testar o PHP de verdade use um servidor local com PHP 7.4+ e MySQL, ou publique num subdomínio de testes.

## Testes ponta a ponta

```bash
npm i -D playwright && npx playwright install chromium
node dev/mock-server.mjs &
node dev/e2e.mjs
```

Verificam navegação, formulários, login, permissões dos perfis, edição de conteúdo, upload, eventos, configurações e usuários contra o simulador.

## Manter simulador e PHP em sincronia

As rotas da API estão em `app/api.php` (função `api_routes`). Se criar ou mudar uma rota, ajuste também `ROUTES` e `HANDLERS` em `mock-server.mjs`.

## Verificação estática (sem PHP)

```bash
python3 dev/check_project.py .
```

Confere estrutura do PHP, compatibilidade com PHP 7.4, campos do `content-schema.json` × uso no `site.js`, rotas (PHP × simulador × JavaScript), sintaxe do JavaScript e se há segredos/uploads na pasta. Deve terminar com **0 erros** antes de cada publicação. Roda automaticamente no GitHub Actions.
