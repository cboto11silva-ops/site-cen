<?php
/** Sessão, login, permissões, proteção contra abuso e criptografia simples. */

const SESSION_LIFETIME = 43200; // 12 horas

function session_boot($create = false)
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    if (!$create && !isset($_COOKIE['cen_sess'])) {
        return;
    }
    session_name('cen_sess');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'secure' => is_https(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

/** Usuário logado (array) ou null. */
function current_user()
{
    session_boot(false);
    if (session_status() !== PHP_SESSION_ACTIVE || empty($_SESSION['uid'])) {
        return null;
    }
    if (time() - (int) ($_SESSION['t'] ?? 0) > SESSION_LIFETIME) {
        $_SESSION = [];
        return null;
    }
    $u = q_one('SELECT id, name, email, role, active FROM users WHERE id = ?', [(int) $_SESSION['uid']]);
    if ($u === null || (int) $u['active'] !== 1) {
        return null;
    }
    return $u;
}

function public_user($u)
{
    return ['id' => (int) $u['id'], 'name' => $u['name'], 'email' => $u['email'], 'role' => $u['role']];
}

function csrf_token()
{
    session_boot(true);
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(16));
    }
    return $_SESSION['csrf'];
}

function csrf_check()
{
    $sent = isset($_SERVER['HTTP_X_CSRF_TOKEN']) ? (string) $_SERVER['HTTP_X_CSRF_TOKEN'] : '';
    $real = isset($_SESSION['csrf']) ? (string) $_SESSION['csrf'] : '';
    if ($real === '' || !hash_equals($real, $sent)) {
        fail('Sessão expirada. Recarregue a página e tente de novo.', 403);
    }
}

/** Formulários públicos: aceita apenas requisições vindas do próprio site. */
function origin_check()
{
    $origin = isset($_SERVER['HTTP_ORIGIN']) ? (string) $_SERVER['HTTP_ORIGIN'] : '';
    if ($origin === '') {
        return;
    }
    $host = parse_url($origin, PHP_URL_HOST);
    $port = parse_url($origin, PHP_URL_PORT);
    $originHost = $host . ($port ? ':' . $port : '');
    if (strcasecmp((string) $originHost, site_host()) !== 0) {
        fail('Origem não permitida.', 403);
    }
}

/**
 * Exige login. $role: 'auth' (qualquer usuário), 'editor' (editor ou admin), 'admin'.
 */
function require_role($role)
{
    $u = current_user();
    if ($u === null) {
        fail('Faça login para continuar.', 401);
    }
    if ($role === 'admin' && $u['role'] !== 'admin') {
        fail('Você não tem permissão para acessar esta área.', 403);
    }
    return $u;
}

function is_admin($u)
{
    return is_array($u) && $u['role'] === 'admin';
}

/* ---------- Limite de tentativas (guardado no banco) ---------- */

function throttle_hit($bucket)
{
    q('INSERT INTO throttle (bucket, created_at) VALUES (?, ?)', [substr($bucket, 0, 120), now()]);
    if (mt_rand(1, 40) === 1) {
        q('DELETE FROM throttle WHERE created_at < ?', [date('Y-m-d H:i:s', time() - 86400)]);
    }
}

function throttle_count($bucket, $seconds)
{
    return (int) q_val(
        'SELECT COUNT(*) FROM throttle WHERE bucket = ? AND created_at >= ?',
        [substr($bucket, 0, 120), date('Y-m-d H:i:s', time() - $seconds)]
    );
}

/* ---------- Criptografia da senha do SMTP ---------- */

function secret_key()
{
    return hash('sha256', (string) cfg('app_key', 'sem-chave'), true);
}

function secret_encrypt($plain)
{
    if ($plain === '' || !function_exists('openssl_encrypt')) {
        return $plain === '' ? '' : 'plain:' . base64_encode($plain);
    }
    $iv = random_bytes(12);
    $tag = '';
    $cipher = openssl_encrypt($plain, 'aes-256-gcm', secret_key(), OPENSSL_RAW_DATA, $iv, $tag);
    if ($cipher === false) {
        return 'plain:' . base64_encode($plain);
    }
    return 'gcm:' . base64_encode($iv . $tag . $cipher);
}

function secret_decrypt($stored)
{
    if ($stored === '' || $stored === null) {
        return '';
    }
    if (starts_with($stored, 'plain:')) {
        return (string) base64_decode(substr($stored, 6));
    }
    if (!starts_with($stored, 'gcm:') || !function_exists('openssl_decrypt')) {
        return '';
    }
    $raw = base64_decode(substr($stored, 4), true);
    if ($raw === false || strlen($raw) < 29) {
        return '';
    }
    $iv = substr($raw, 0, 12);
    $tag = substr($raw, 12, 16);
    $cipher = substr($raw, 28);
    $plain = openssl_decrypt($cipher, 'aes-256-gcm', secret_key(), OPENSSL_RAW_DATA, $iv, $tag);
    return $plain === false ? '' : $plain;
}
