# Site da Comunidade Entre Nações (CEN)

Site institucional com painel de gestão (CMS), feito para **hospedagem compartilhada da Hostinger (PHP + MySQL)** e para ser versionado no **GitHub**. Não precisa de Node, Composer nem etapa de build no servidor: o que está no repositório é o que roda.

## O que o site tem

| Área | O que faz |
|---|---|
| **Site público** | Início, Eventos, Pastores, Ofertas e Dízimos, Pedido de Oração e Área do Membro, com heróis, botões flutuantes (WhatsApp, pedido de oração, voltar ao topo) e as cores do logo (azul-marinho e verde). |
| **Próximo encontro** | A home calcula sozinha o próximo encontro da semana (horário de Petrolina). |
| **Painel** (`/admin`) | Edita textos, fotos, contatos, redes sociais, eventos, pastores e novidades, sem mexer em código. |
| **Perfis** | **Administrador** (tudo) e **Conteudista** (só conteúdo do site). |
| **Membros** | Cadastro público (com autorização LGPD). Só o **administrador** vê a lista, busca e exporta CSV, inclusive dentro da própria Área do Membro depois de entrar. |
| **Pedidos de oração** | Ficam salvos no painel (só administrador) e podem chegar por e-mail. |
| **E-mail** | Remetente, destinatário dos pedidos, SMTP e teste de envio ficam em Configurações. |
| **Identidade** | As duas cores principais podem ser trocadas em Configurações. |

## Perfis e permissões

| | Administrador | Conteudista |
|---|:---:|:---:|
| Editar textos, fotos, contatos e redes | sim | sim |
| Eventos, pastores e novidades | sim | sim |
| Chave PIX e dados bancários | sim | não |
| Ver/exportar membros e pedidos de oração | sim | não |
| Usuários, e-mail remetente/SMTP, cores | sim | não |

As regras são aplicadas **no servidor** (não só escondidas no menu).

## Como colocar no ar

Passo a passo completo (GitHub e depois Hostinger, para quem nunca fez): **[docs/PASSO-A-PASSO-GITHUB-E-HOSTINGER.md](docs/PASSO-A-PASSO-GITHUB-E-HOSTINGER.md)**. Resumo:

1. Suba esta pasta para um repositório no GitHub (branch `main`).
2. Confira se o check "Conferir código" ficou verde (ele valida a sintaxe do PHP).
3. Na Hostinger: crie o banco MySQL, conecte o repositório em **Avançado > Git** (pasta `public_html`).
4. Abra `https://seudominio.com.br/install.php`, informe os dados do banco e crie o primeiro administrador.
5. Apague o `install.php` e configure o e-mail em **/admin > Configurações**.

## Documentação

| Documento | Para quem | Conteúdo |
|---|---|---|
| [PASSO-A-PASSO-GITHUB-E-HOSTINGER.md](docs/PASSO-A-PASSO-GITHUB-E-HOSTINGER.md) | Quem vai publicar | Conta no GitHub, envio do projeto, banco, Git na Hostinger, instalação, e-mail, HTTPS, testes, backup e problemas comuns |
| [MANUAL-DO-PAINEL.md](docs/MANUAL-DO-PAINEL.md) | Equipe da igreja | Como usar o painel: textos, fotos, eventos, membros, usuários, configurações |
| [DOCUMENTACAO-TECNICA.md](docs/DOCUMENTACAO-TECNICA.md) | Quem mantém o código | Arquitetura, banco, API, permissões, segurança, design system, testes e como estender |
| [dev/README.md](dev/README.md) | Quem desenvolve | Pré-visualização sem PHP e testes |

## Estrutura

```
index.php            página pública (SEO + dados embutidos)
install.php          instalador (rode uma vez e apague)
admin/               painel (casca HTML; a lógica está em assets/js/admin.js)
api/index.php        API JSON
app/                 código PHP interno (bloqueado na web)
  api.php            rotas e regras de permissão
  content-schema.json  todos os campos editáveis + textos e dados iniciais
  schema.sql         tabelas do MySQL
assets/              CSS, JavaScript e imagens
uploads/             imagens enviadas pelo painel (não vai para o Git)
storage/             logs e trava de instalação (não vai para o Git)
dev/                 pré-visualização e testes (só desenvolvimento)
```

## Segurança (resumo)

- Senhas com `password_hash`; sessão `HttpOnly` + `SameSite`; token CSRF em toda ação do painel.
- Consultas SQL sempre com parâmetros; todo texto exibido é escapado.
- Login com limite de tentativas; formulários públicos com limite por IP e campo-armadilha contra robôs.
- Uploads validados (tipo real da imagem, tamanho) e reprocessados; a pasta `uploads/` não executa scripts.
- Senha do SMTP guardada criptografada (AES-256-GCM) com a chave do `config.php`.
- `config.php`, `storage/` e `app/` não são acessíveis pela web e não vão para o GitHub.

## LGPD

O site coleta nome, e-mail, telefone e data de nascimento de membros e textos de pedidos de oração. Há caixa de autorização no cadastro e aviso de privacidade editável. Recomenda-se publicar uma política de privacidade completa e limitar o perfil de administrador a poucas pessoas de confiança. (Este projeto não substitui orientação jurídica.)

## Desenvolvimento local

Não é preciso PHP para ver o visual: `node dev/mock-server.mjs` abre uma versão de pré-visualização em `http://localhost:8080` (veja `dev/README.md`).
