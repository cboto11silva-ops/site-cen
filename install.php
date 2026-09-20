<?php
/**
 * Instalador do site (rode uma vez).
 * 1) testa a conexão com o banco e cria o config.php
 * 2) cria as tabelas, os textos iniciais e o primeiro administrador
 * Depois de instalar, o arquivo se bloqueia sozinho. Apague-o do servidor.
 */
define('APP_ROOT', __DIR__);
define('APP_DIR', __DIR__ . '/app');
require APP_DIR . '/bootstrap.php';

session_name('cen_install');
session_start();
if (empty($_SESSION['tok'])) {
    $_SESSION['tok'] = bin2hex(random_bytes(16));
}

function page($title, $body)
{
    header('Content-Type: text/html; charset=utf-8');
    header('X-Robots-Tag: noindex');
    echo '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">';
    echo '<title>' . e($title) . '</title><style>
    body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#eef2f9;color:#081b3f;margin:0;padding:24px}
    main{max-width:620px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;box-shadow:0 8px 30px rgba(8,27,63,.08)}
    h1{font-size:1.5rem;margin:0 0 4px} p.sub{margin:0 0 24px;color:#4a5878}
    label{display:block;font-weight:600;margin-top:14px;font-size:.92rem}
    input{width:100%;box-sizing:border-box;padding:11px 12px;border:1px solid #c5cee0;border-radius:10px;font-size:1rem;margin-top:6px}
    button,.btn{display:inline-block;margin-top:22px;background:#081b3f;color:#fff;border:0;border-radius:999px;padding:12px 26px;font-size:1rem;font-weight:600;cursor:pointer;text-decoration:none}
    ul{padding-left:0;list-style:none;margin:0 0 8px} li{padding:6px 0;border-bottom:1px solid #eef2f9}
    .ok{color:#2f7a1f;font-weight:700}.bad{color:#b3261e;font-weight:700}.err{background:#fdecea;color:#8a1c14;padding:12px 14px;border-radius:10px;margin:0 0 16px}
    small{color:#5b6a8c}
    </style></head><body><main>' . $body . '</main></body></html>';
    exit;
}

function requirements()
{
    return [
        ['PHP 7.4 ou superior (versão atual: ' . PHP_VERSION . ')', PHP_VERSION_ID >= 70400, true],
        ['Extensão PDO MySQL', extension_loaded('pdo_mysql'), true],
        ['Extensão JSON', extension_loaded('json'), true],
        ['Extensão OpenSSL (senha do SMTP)', extension_loaded('openssl'), false],
        ['Extensão mbstring', extension_loaded('mbstring'), false],
        ['Extensão GD (redimensionar imagens)', extension_loaded('gd'), false],
        ['Pasta "uploads" com permissão de escrita', is_writable(APP_ROOT . '/uploads'), true],
        ['Pasta "storage" com permissão de escrita', is_writable(APP_ROOT . '/storage'), true],
        ['Pasta do site com permissão para criar o config.php', is_file(APP_ROOT . '/config.php') || is_writable(APP_ROOT), true],
    ];
}

function requirements_ok()
{
    foreach (requirements() as $r) {
        if ($r[2] && !$r[1]) {
            return false;
        }
    }
    return true;
}

function try_db()
{
    try {
        $pdo = new PDO(
            'mysql:host=' . cfg('db_host', 'localhost') . ';dbname=' . cfg('db_name', '') . ';charset=utf8mb4',
            (string) cfg('db_user', ''),
            (string) cfg('db_pass', ''),
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
        );
        return [true, ''];
    } catch (Throwable $ex) {
        return [false, $ex->getMessage()];
    }
}

// Já instalado: só informa.
if (is_installed()) {
    page('Site já instalado', '<h1>Site já instalado</h1><p class="sub">Por segurança, apague o arquivo <b>install.php</b> do servidor.</p><a class="btn" href="/admin/">Entrar no painel</a>');
}

$error = '';
$post = $_SERVER['REQUEST_METHOD'] === 'POST';
if ($post) {
    if (!hash_equals($_SESSION['tok'], (string) ($_POST['tok'] ?? ''))) {
        $error = 'Sessão expirada. Recarregue a página e tente de novo.';
        $post = false;
    }
}

// Passo 1: gravar config.php
if ($post && ($_POST['action'] ?? '') === 'db') {
    if (!requirements_ok()) {
        $error = 'Resolva os itens marcados em vermelho antes de continuar.';
    } else {
        $cfg = [
            'db_host' => trim((string) $_POST['db_host']),
            'db_name' => trim((string) $_POST['db_name']),
            'db_user' => trim((string) $_POST['db_user']),
            'db_pass' => (string) $_POST['db_pass'],
            'app_key' => bin2hex(random_bytes(24)),
            'debug' => false,
        ];
        try {
            new PDO(
                'mysql:host=' . $cfg['db_host'] . ';dbname=' . $cfg['db_name'] . ';charset=utf8mb4',
                $cfg['db_user'],
                $cfg['db_pass'],
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
            );
            $code = "<?php\n// Gerado pelo instalador. Não compartilhe este arquivo.\nreturn " . var_export($cfg, true) . ";\n";
            if (@file_put_contents(APP_ROOT . '/config.php', $code, LOCK_EX) === false) {
                $error = 'Não foi possível criar o config.php. Verifique a permissão de escrita da pasta do site.';
            } else {
                @chmod(APP_ROOT . '/config.php', 0640);
                header('Location: /install.php');
                exit;
            }
        } catch (Throwable $ex) {
            $error = 'Não foi possível conectar ao banco. Confira os dados. (' . $ex->getMessage() . ')';
        }
    }
}

// Passo 2: criar tabelas, dados iniciais e o primeiro administrador
if ($post && ($_POST['action'] ?? '') === 'admin') {
    $name = clean_line($_POST['name'] ?? '', 120);
    $email = strtolower(clean_line($_POST['email'] ?? '', 190));
    $pass = (string) ($_POST['password'] ?? '');
    if (str_len($name) < 2) {
        $error = 'Informe o seu nome.';
    } elseif (!valid_email($email)) {
        $error = 'Informe um e-mail válido.';
    } elseif (strlen($pass) < 10) {
        $error = 'A senha precisa ter pelo menos 10 caracteres.';
    } elseif ($pass !== (string) ($_POST['password2'] ?? '')) {
        $error = 'As senhas não são iguais.';
    } else {
        try {
            $sql = (string) file_get_contents(APP_DIR . '/schema.sql');
            foreach (preg_split('/;\s*\n/', $sql) as $stmt) {
                if (trim($stmt) !== '') {
                    db()->exec($stmt);
                }
            }
            $admins = (int) q_val("SELECT COUNT(*) FROM users WHERE role = 'admin'");
            if ($admins === 0) {
                coll_seed();
                foreach (settings_defaults() as $k => $v) {
                    if ($k !== 'smtp_pass') {
                        q('INSERT IGNORE INTO settings (k, v) VALUES (?, ?)', [$k, $v]);
                    }
                }
                db_insert('users', [
                    'name' => $name,
                    'email' => $email,
                    'password_hash' => password_hash($pass, PASSWORD_DEFAULT),
                    'role' => 'admin',
                    'active' => 1,
                    'created_at' => now(),
                ]);
            }
            if (@file_put_contents(APP_ROOT . '/storage/installed.lock', date('c'), LOCK_EX) === false) {
                $error = 'Instalado, mas não foi possível criar storage/installed.lock. Crie esse arquivo vazio manualmente.';
            } else {
                page(
                    'Instalação concluída',
                    '<h1>Tudo pronto!</h1><p class="sub">O site foi instalado com sucesso.</p>'
                    . '<ul><li>1. Apague o arquivo <b>install.php</b> do servidor (Gerenciador de Arquivos da Hostinger).</li>'
                    . '<li>2. Entre no painel e confira <b>Configurações &gt; E-mail</b>.</li></ul>'
                    . '<a class="btn" href="/admin/">Entrar no painel</a>'
                );
            }
        } catch (Throwable $ex) {
            log_error('install: ' . $ex->getMessage());
            $error = 'Não foi possível criar as tabelas: ' . $ex->getMessage();
        }
    }
}

// Telas
$html = '<h1>Instalação do site</h1><p class="sub">Comunidade Entre Nações</p>';
if ($error !== '') {
    $html .= '<p class="err">' . e($error) . '</p>';
}
$html .= '<ul>';
foreach (requirements() as $r) {
    $mark = $r[1] ? '<span class="ok">OK</span>' : ($r[2] ? '<span class="bad">Falta</span>' : '<span class="bad">Opcional</span>');
    $html .= '<li>' . $mark . ' ' . e($r[0]) . '</li>';
}
$html .= '</ul>';

$tok = '<input type="hidden" name="tok" value="' . e($_SESSION['tok']) . '">';
$configReady = is_file(APP_ROOT . '/config.php');
$dbState = $configReady ? try_db() : [false, ''];

if (!$configReady || !$dbState[0]) {
    if ($configReady && !$dbState[0]) {
        $html .= '<p class="err">O config.php existe, mas a conexão falhou: ' . e($dbState[1]) . '<br>Apague o config.php e refaça este passo.</p>';
    }
    $html .= '<h2 style="font-size:1.1rem;margin-top:24px">Passo 1: banco de dados</h2>'
        . '<small>Crie o banco em hPanel &gt; Bancos de Dados &gt; Gerenciamento e copie os dados aqui.</small>'
        . '<form method="post">' . $tok . '<input type="hidden" name="action" value="db">'
        . '<label>Servidor<input name="db_host" value="localhost" required></label>'
        . '<label>Nome do banco<input name="db_name" required></label>'
        . '<label>Usuário do banco<input name="db_user" required></label>'
        . '<label>Senha do banco<input name="db_pass" type="password"></label>'
        . '<button type="submit">Testar e continuar</button></form>';
} else {
    $html .= '<h2 style="font-size:1.1rem;margin-top:24px">Passo 2: primeiro administrador</h2>'
        . '<small>Conexão com o banco OK. Crie a conta que vai gerenciar o site.</small>'
        . '<form method="post">' . $tok . '<input type="hidden" name="action" value="admin">'
        . '<label>Seu nome<input name="name" required></label>'
        . '<label>E-mail (será o seu login)<input name="email" type="email" required></label>'
        . '<label>Senha (mínimo 10 caracteres)<input name="password" type="password" minlength="10" required></label>'
        . '<label>Repita a senha<input name="password2" type="password" minlength="10" required></label>'
        . '<button type="submit">Instalar o site</button></form>';
}
page('Instalação do site', $html);
