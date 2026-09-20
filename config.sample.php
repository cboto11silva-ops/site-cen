<?php
/**
 * Configuração do site.
 *
 * Você NÃO precisa editar este arquivo à mão: o instalador (install.php)
 * cria o config.php para você depois de testar a conexão com o banco.
 * Este arquivo só serve de exemplo.
 */
return [
    // Dados do banco MySQL criado no hPanel da Hostinger (Bancos de Dados > Gerenciamento)
    'db_host' => 'localhost',
    'db_name' => 'u000000000_cen',
    'db_user' => 'u000000000_cen',
    'db_pass' => 'senha-do-banco',

    // Chave secreta usada para proteger a senha do SMTP guardada no painel.
    // O instalador gera uma automaticamente. Não compartilhe e não mude depois.
    'app_key' => 'troque-por-uma-frase-longa-e-aleatoria',

    // true mostra detalhes técnicos de erros (use só para diagnosticar).
    'debug' => false,
];
