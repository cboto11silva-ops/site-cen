# Manual do painel

Endereço: `https://seudominio.com.br/admin/` (também há o link "Acesso da equipe" no rodapé do site e na Área do Membro).

## Perfis

- **Administrador**: faz tudo (conteúdo, membros, pedidos de oração, usuários, configurações, PIX).
- **Conteudista**: edita textos, fotos, eventos, pastores e novidades. Não vê dados de membros, pedidos de oração, usuários, e-mail nem dados financeiros.

## Editar textos e fotos

1. **Conteúdo do site** > escolha a página (Início, Eventos, Pastores, Ofertas, etc.).
2. Altere os campos. Para trocar uma foto, clique em **Enviar nova imagem**. **Usar imagem padrão** volta à foto original.
3. Clique em **Salvar alterações** (barra azul embaixo). A mudança aparece no site na hora.

Dicas: apague o texto de um campo opcional para escondê-lo (ex.: aviso na página Pastores, endereço). O botão flutuante de WhatsApp só aparece se o número estiver preenchido (com país e DDD, ex.: `5587999999999`).

**Fotos:** prefira fotos horizontais ou quadradas de boa qualidade (mín. 1200 px de largura). Imagens de Instagram com texto embutido ficam pequenas e cortadas; use-as apenas como cartaz ("Novidades").

## Eventos

- **Encontro semanal:** escolha o *dia da semana* e o horário (ex.: `19h30`). O site mostra a programação e destaca o **próximo encontro** na página inicial.
- **Evento especial:** preencha a *data*. Depois que a data passa, ele some do site sozinho.
- Use as setas para ordenar e **Mostrar no site** para esconder sem excluir.
- O cartaz da programação semanal é trocado em **Conteúdo > Página inicial > Programação da semana: cartaz**.

## Pastores e Novidades

- **Pastores:** nome, função, apresentação e foto (opcional; sem foto aparecem as iniciais).
- **Novidades:** cartazes da página inicial. Sem link, abrem o Instagram da igreja.

## Membros (administrador)

- **Membros:** lista, busca por nome/e-mail/telefone, exclusão e **Exportar CSV** (abre no Excel).
- Depois de entrar como administrador, a própria **Área do Membro** do site também mostra a lista.
- Trate esses dados com cuidado (LGPD): use só para o trabalho da igreja e exclua a pedido do titular.

## Pedidos de oração (administrador)

Cada pedido mostra nome/contato (se informados) e mensagem. Marque como **atendido** quando a intercessão orar.

## Usuários (administrador)

Crie contas para a equipe e escolha o perfil. É possível desativar ou redefinir a senha. O sistema não deixa remover o último administrador.

## Configurações (administrador)

- **Cores:** azul principal e verde de destaque (padrão: cores do logo).
- **E-mail:** remetente, quem recebe os pedidos de oração, SMTP e **e-mail de teste**.
- **Diagnóstico:** mostra se o servidor está com tudo o que o site precisa.

## Boas práticas

- Use senhas longas e diferentes para cada pessoa; não compartilhe o login.
- Dê o perfil de administrador a poucas pessoas.
- Faça cópia de segurança de vez em quando (pasta `uploads/` e exportação do banco no phpMyAdmin).
