# Passo a passo: do seu computador até o site no ar

Este guia leva você do zero até o site funcionando, **primeiro no GitHub e depois na Hostinger**. Não precisa saber programar. Reserve cerca de **1 hora** na primeira vez.

> Os nomes de botões e menus do GitHub e da hPanel (Hostinger) podem mudar de aparência com o tempo. Se algum nome for diferente, use a **busca** do próprio painel pelo termo em negrito de cada passo.

## Como tudo se conecta

```
1. Seu computador ──envia──▶ GitHub        guarda o código do site
2. GitHub ──publica sozinho──▶ Hostinger   site no ar, banco de dados e e-mails
3. Equipe ──painel /admin──▶ Hostinger     textos, fotos, eventos (sem GitHub)
```

- **GitHub** guarda o código do site (como um "Google Drive" para programas) e avisa a Hostinger quando algo muda.
- **Hostinger** é onde o site fica no ar e onde ficam o **banco de dados** e os **e-mails**.
- **Painel /admin** é onde a igreja edita textos, fotos, eventos e vê membros. Isso **não** passa pelo GitHub.

## O que você precisa antes de começar

- [ ] O arquivo **site-cen-hostinger.zip** (recebido neste projeto).
- [ ] Um **e-mail** seu para criar a conta no GitHub.
- [ ] Acesso à **Hostinger** (plano Premium ou Business, com PHP e MySQL) e o **domínio** já apontado para ela.
- [ ] Um bloco de notas para anotar **usuário, senhas e nomes do banco** (guarde em local seguro, nunca no WhatsApp aberto).

---

# PARTE 1: Preparar os arquivos

1. Clique com o botão direito no `site-cen-hostinger.zip` e **extraia** (Windows: "Extrair tudo"; Mac: duplo clique).
2. Entre na pasta **site-cen** que apareceu. Dentro dela devem existir, entre outros: `index.php`, `install.php`, `.htaccess`, `README.md` e as pastas `app`, `assets`, `admin`, `api`, `docs`.
3. **Arquivos que começam com ponto** (`.htaccess`, `.gitignore`, pasta `.github`) são importantes e às vezes ficam escondidos:

    - **Windows:** aba *Exibir* > marque *Itens ocultos*.
    - **Mac:** no Finder, pressione **Cmd + Shift + .** (ponto).

> Não edite nada agora. Os textos do site serão trocados depois, pelo painel.

---

# PARTE 2: Enviar para o GitHub

## 2.1 Criar a conta

1. Acesse **github.com** e clique em **Sign up**.
2. Informe e-mail, senha e nome de usuário. Confirme o e-mail que o GitHub enviar.
3. Ative a **verificação em duas etapas** (Settings > Password and authentication). É a sua proteção contra invasão do código.

## 2.2 Criar o repositório (a "pasta" do projeto no GitHub)

1. Já logado, clique no **+** no canto superior direito > **New repository**.
2. Preencha:

    - **Repository name:** `site-cen`
    - **Description:** Site da Comunidade Entre Nações
    - **Private** (recomendado: só você e quem você convidar vê o código)
    - **Não** marque *Add a README*, *.gitignore* nem *license* (o projeto já tem).
3. Clique em **Create repository**. Você verá uma página com instruções e um endereço parecido com `https://github.com/SEU-USUARIO/site-cen.git`.

## 2.3 Enviar os arquivos (escolha UMA das 3 opções)

### Opção A: GitHub Desktop (recomendada para quem não usa terminal)

1. Baixe e instale o **GitHub Desktop** (desktop.github.com) e entre com sua conta.
2. Menu **File > Add local repository** e escolha a pasta **site-cen**.
3. Ele dirá que ali ainda não é um repositório: clique em **create a repository** e confirme (mantenha o nome `site-cen`; **não** marque README nem .gitignore).
4. Na tela principal, na caixa **Summary**, escreva `Primeira versão` e clique em **Commit to main**.
5. Clique em **Publish repository**. **Desmarque** "Keep this code private" **somente se** quiser público; para privado deixe marcado. Confirme com **Publish repository**.
6. Abra `github.com/SEU-USUARIO/site-cen` e confira se os arquivos apareceram.

### Opção B: Terminal (Git instalado)

Dentro da pasta `site-cen`:

```bash
git init
git add .
git commit -m "Primeira versão"
git branch -M main
git remote add origin https://github.com/SEU-USUARIO/site-cen.git
git push -u origin main
```

Se pedir senha, use um **Personal Access Token** (GitHub > Settings > Developer settings > Personal access tokens) no lugar da senha.

### Opção C: Direto pelo navegador (sem instalar nada)

1. Na página do repositório vazio, clique em **uploading an existing file**.
2. Abra a pasta `site-cen` no seu computador, **selecione todo o conteúdo de dentro dela** (Ctrl+A / Cmd+A) e **arraste para a janela do GitHub**. Arraste o *conteúdo*, não a pasta `site-cen` em si.
3. Espere o envio terminar. Em **Commit changes**, escreva `Primeira versão` e clique no botão verde **Commit changes**.
4. **Confira** se aparecem `.htaccess`, `.gitignore` e a pasta `.github`. Se algum arquivo com ponto ficou de fora, clique em **Add file > Upload files** e envie só ele.

> O navegador aceita até **100 arquivos por envio**. O projeto tem cerca de 70, então cabe de uma vez.

## 2.4 Confirmar que o código está saudável (o "check verde")

1. No repositório, abra a aba **Actions**.
2. Deve existir uma execução chamada **Conferir código**. Espere ela terminar.
3. **Verde com ✓:** o PHP e o JavaScript estão sem erro de sintaxe. Pode seguir.
4. **Vermelho com ✗:** clique nela, abra o passo que falhou e veja o nome do arquivo e a linha com erro. **Não publique na Hostinger antes de corrigir** (envie o print do erro para quem faz a manutenção).

> Se a aba Actions perguntar se você quer habilitar *workflows*, clique em **I understand my workflows, go ahead and enable them**.

## 2.5 (Recomendado) Trabalhar com segurança daqui para frente

A Hostinger vai publicar **tudo o que entrar na branch `main`**. Por isso, para mudanças de código, o ideal é: criar outra branch, testar, e só então fazer o **merge** para `main` depois do check verde. Para quem só usa o painel, isso não é necessário.

---

# PARTE 3: Publicar na Hostinger

## 3.1 Confirmar plano, domínio e versão do PHP

1. Entre em **hpanel.hostinger.com**.
2. Clique em **Sites > Gerenciar** no domínio do site.
3. Procure **Configuração do PHP** (menu **Avançado** ou use a busca). Escolha **PHP 8.2** ou **8.3**. (O mínimo é 7.4.)
4. Na aba de **extensões**, confira se estão ativas: `pdo_mysql`, `mbstring`, `openssl`, `gd`, `json`. Normalmente já estão.

## 3.2 Criar o banco de dados (MySQL)

1. No hPanel, abra **Bancos de Dados > Gerenciamento**.
2. Em **Criar um novo banco de dados MySQL e usuário**, informe um nome (ex.: `cen`), um usuário e uma **senha forte**. Clique em **Criar**.
3. **Anote os 3 dados** exatamente como aparecem (normalmente têm um prefixo, como `u123456789_cen`):

    - Nome do banco: `__________`
    - Usuário do banco: `__________`
    - Senha do banco: `__________`
    - Servidor: `localhost`

## 3.3 Deixar a pasta do site vazia

A Hostinger só conecta o Git se a pasta de destino estiver vazia.

1. hPanel > **Arquivos > Gerenciador de Arquivos** > pasta **public_html**.
2. Se houver arquivos de exemplo (como `default.php`), **exclua-os**.

## 3.4 Conectar o GitHub à Hostinger (deploy automático)

1. No hPanel, do seu site, abra **Avançado > Git** (ou busque "Git").
2. Clique em **Connect with GitHub** (ou *Continuar com GitHub*) e autorize. Escolha dar acesso ao repositório `site-cen`.
3. Selecione o repositório **site-cen**.
4. Configure:

    - **Branch:** `main`
    - **Deploy directory / Pasta de destino:** `public_html` (padrão)
5. Clique em **Deploy** e aguarde o log terminar.
6. Confirme que o **auto-deploy** está ligado: a partir de agora, **cada mudança que entrar na branch `main` é publicada sozinha**.
7. Volte ao **Gerenciador de Arquivos** e veja se `index.php`, `.htaccess`, `app`, `assets` etc. estão dentro de `public_html`.

> Não aparece o `.htaccess`? No Gerenciador de Arquivos, ative **Mostrar arquivos ocultos** (engrenagem/configurações).

## 3.5 Instalar o site (feito uma única vez)

1. Abra `https://seudominio.com.br/install.php`.
2. Na lista de requisitos, tudo que é obrigatório deve estar **OK**.
3. **Passo 1: Banco de dados.** Preencha os dados que você anotou no 3.2 (servidor `localhost`). Clique em **Testar e continuar**. Se der erro, confira o prefixo do nome/usuário do banco.
4. **Passo 2: Primeiro administrador.** Informe seu nome, **e-mail** e **senha** (mínimo 10 caracteres; use uma frase longa). Clique em **Instalar o site**.
5. Aparecerá **"Tudo pronto!"**.

## 3.6 Apagar o instalador

O `install.php` se bloqueia sozinho depois de instalado, mas o ideal é removê-lo de vez, nos **dois** lugares:

1. **Hostinger:** Gerenciador de Arquivos > `public_html` > `install.php` > **Excluir**.
2. **GitHub:** no repositório, abra `install.php` > ícone da **lixeira** > **Commit changes**. Assim ele não volta em deploys futuros.

> Guarde uma cópia do `install.php` no seu computador, caso um dia precise reinstalar em outro servidor.

## 3.7 Entrar no painel

1. Acesse `https://seudominio.com.br/admin/` e entre com o e-mail e a senha do administrador.
2. Em **Configurações > Diagnóstico**, confira se os itens estão **OK** (PHP, OpenSSL, GD, pastas com permissão de escrita).

## 3.8 Configurar o e-mail do site

**Criar a caixa de e-mail**

1. hPanel > **E-mails** > crie, por exemplo, `contato@seudominio.com.br` e defina uma senha. Anote.

**Configurar no painel** (**/admin > Configurações > E-mail**)

| Campo | O que colocar |
|---|---|
| E-mail remetente | `contato@seudominio.com.br` |
| Nome do remetente | Comunidade Entre Nações |
| Receber pedidos de oração em | e-mail da equipe de intercessão (pode ser o mesmo) |
| Como enviar | **SMTP** |
| Servidor SMTP | `smtp.hostinger.com` |
| Porta / Segurança | `465` / **SSL** (se falhar: `587` / **TLS**) |
| Usuário | o e-mail completo da caixa |
| Senha | a senha da caixa |

1. Clique em **Salvar configurações**.
2. Em **Testar envio**, clique em **Enviar e-mail de teste**. Confira a caixa de entrada **e o spam**.

## 3.9 Ativar o HTTPS (cadeado)

1. hPanel > **Segurança > SSL**: ative o certificado gratuito do domínio (pode levar alguns minutos).
2. Para forçar o HTTPS, **edite pelo GitHub** (assim o deploy não desfaz):

    - No repositório, abra o arquivo **`.htaccess`** > ícone do **lápis**.
    - Procure o trecho "Para forçar HTTPS…" e **apague o `#`** do começo das 3 linhas seguintes.
    - **Commit changes**. Em instantes o site publica sozinho.
3. Abra `http://seudominio.com.br` (sem o "s"): deve ir para `https://`.

> Alternativa: a hPanel tem a opção **Forçar HTTPS** no menu de SSL. Se usar, não precisa mexer no `.htaccess`.

## 3.10 Colocar o conteúdo real (pelo painel)

Entre em **/admin > Conteúdo do site** e revise cada página. Itens que precisam da sua atenção:

- [ ] **WhatsApp** (Contato): país + DDD + número, só dígitos. Sem ele, o botão flutuante não aparece.
- [ ] **Endereço** e **link do Google Maps** (habilita "Como chegar").
- [ ] **Redes sociais** (Instagram, YouTube, Facebook).
- [ ] **Chave PIX** e **dados bancários** (Ofertas e Dízimos; somente administrador).
- [ ] **Pastores:** fotos e biografias reais (menu Pastores). Apague o aviso "em breve" na página quando terminar.
- [ ] **Eventos:** confira dias e horários da programação semanal e cadastre eventos especiais.
- [ ] **Fotos:** troque as imagens dos heróis por fotos horizontais de boa qualidade.
- [ ] **Usuários:** crie as contas dos **conteudistas** (perfil sem acesso a membros e finanças).

## 3.11 Testes finais (não pule)

- [ ] Abrir todas as páginas no **celular** e no computador.
- [ ] Enviar um **pedido de oração** de teste: aparece em **Pedidos de oração** e chega por e-mail?
- [ ] Fazer um **cadastro de membro** de teste: aparece em **Membros**? Exclua depois.
- [ ] Entrar como **conteudista**: ele **não** vê Membros, Usuários, Configurações nem PIX?
- [ ] Trocar uma **foto** pelo painel: aparece no site?
- [ ] **Segundo deploy:** faça uma pequena mudança no GitHub (ex.: edite uma linha do README), espere publicar e confirme que **login, fotos enviadas e configurações continuam funcionando**.
- [ ] Baixar uma **cópia de segurança** (veja a Parte 4).

---

# PARTE 4: Rotina depois de no ar

## O que muda onde

| Quero mudar… | Onde |
|---|---|
| Textos, fotos, contatos, eventos, pastores, novidades | **Painel /admin** |
| Chave PIX, e-mail, cores, usuários | **Painel /admin** (só administrador) |
| Ver/exportar membros e pedidos de oração | **Painel /admin** (só administrador) |
| Visual, layout, funcionamento do site | **Código no GitHub** (com ajuda técnica) |

## Atualizar o código

1. Altere o arquivo no GitHub (lápis > Commit) ou pelo GitHub Desktop (Commit + Push).
2. Confira o check verde em **Actions**.
3. Em instantes a Hostinger publica (**Git > Deployments** mostra o histórico e o status).
4. Deu problema? Em **Deployments**, ou no GitHub, volte ao commit anterior (**Revert**).

## Cópia de segurança (faça todo mês e antes de mudanças grandes)

1. **Banco de dados:** hPanel > **Bancos de Dados > phpMyAdmin** > selecione o banco > **Exportar** > *Executar*. Guarde o arquivo `.sql`.
2. **Imagens enviadas:** Gerenciador de Arquivos > pasta `uploads` > **Compactar** > baixe o `.zip`.
3. **`config.php`:** baixe uma cópia e guarde em local seguro (contém a senha do banco).
4. Se a hospedagem tiver **backups automáticos**, ative também.

## Segurança do dia a dia

- Cada pessoa com **seu próprio login**; nunca compartilhe senha.
- Perfil **administrador** só para poucas pessoas de confiança.
- Ao sair alguém da equipe: **Usuários > Editar > desmarcar "Usuário ativo"**.
- **Dados de membros são pessoais (LGPD):** use só para a igreja, exclua a pedido da pessoa e trate o CSV exportado com cuidado.

---

# PARTE 5: Problemas comuns

| O que aconteceu | O que fazer |
|---|---|
| Actions ficou **vermelho** | Abra o check, veja arquivo/linha do erro e corrija antes de publicar. |
| Hostinger diz que a pasta **não está vazia** | Exclua arquivos de exemplo em `public_html` (3.3) e tente de novo. |
| Site mostra **página em branco** ou "Algo deu errado" | Gerenciador de Arquivos > `storage/logs/error.log`. Confira PHP 7.4+ e se o `config.php` existe. |
| `install.php` diz que falta uma extensão | Ative em **Configuração do PHP > Extensões**. |
| **Erro 404** nas páginas internas (ex.: `/eventos`) | O `.htaccess` não foi publicado: mostre arquivos ocultos e confira se está em `public_html`. |
| **Erro 500** logo após um deploy | Versão do PHP incompatível ou erro de código: veja `error.log` e o check do GitHub; reverta o último commit. |
| **Não consigo enviar imagem** | Configurações > Diagnóstico: a pasta `uploads` precisa estar com permissão de escrita (755). |
| **E-mail não chega** | Use SMTP; confira usuário/senha; tente porta 587 + TLS; olhe o spam; a caixa precisa existir na Hostinger. |
| Depois de um deploy, **sumiram** fotos ou configurações | Restaure `uploads` e `config.php` do backup e avise a manutenção (veja a nota na Parte 3.11). |
| **Esqueci a senha** do administrador | Outro administrador redefine em **Usuários**. Se for o único, peça ajuda técnica (redefinição no phpMyAdmin). |

---

# Glossário rápido

- **Repositório:** a pasta do projeto no GitHub, com histórico de todas as mudanças.
- **Commit:** uma "foto" salva do projeto num momento, com uma mensagem.
- **Push:** enviar seus commits para o GitHub.
- **Branch `main`:** a versão principal (a que vai ao ar).
- **Deploy:** publicar a versão do GitHub no servidor da Hostinger.
- **Banco de dados (MySQL):** onde ficam membros, pedidos de oração, textos editados e usuários.
- **SMTP:** o "serviço de correio" que envia os e-mails do site.
- **SSL / HTTPS:** o cadeado do site; criptografa a conexão.
- **`.htaccess`:** arquivo de regras do servidor (páginas, segurança, HTTPS).
