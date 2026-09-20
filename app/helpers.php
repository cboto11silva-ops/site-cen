<?php
/** Funções utilitárias gerais. */

function cfg($key = null, $default = null)
{
    static $c = null;
    if ($c === null) {
        $file = APP_ROOT . '/config.php';
        $c = is_file($file) ? require $file : [];
        if (!is_array($c)) {
            $c = [];
        }
    }
    if ($key === null) {
        return $c;
    }
    return array_key_exists($key, $c) ? $c[$key] : $default;
}

function is_installed()
{
    return is_file(APP_ROOT . '/config.php') && is_file(APP_ROOT . '/storage/installed.lock');
}

function e($s)
{
    return htmlspecialchars((string) $s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

function now()
{
    return date('Y-m-d H:i:s');
}

function starts_with($haystack, $needle)
{
    return $needle === '' || strncmp($haystack, $needle, strlen($needle)) === 0;
}

function str_len($s)
{
    return function_exists('mb_strlen') ? mb_strlen($s, 'UTF-8') : strlen($s);
}

function str_cut($s, $n)
{
    return function_exists('mb_substr') ? mb_substr($s, 0, $n, 'UTF-8') : substr($s, 0, $n);
}

/** Texto de uma linha: remove controles e espaços repetidos. */
function clean_line($v, $max = 200)
{
    $s = trim((string) $v);
    $s = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $s);
    if ($s === null) {
        return '';
    }
    $s = trim(preg_replace('/\s+/u', ' ', $s) ?? '');
    return str_cut($s, $max);
}

/** Texto de várias linhas: mantém quebras de linha. */
function clean_text($v, $max = 5000)
{
    $s = str_replace(["\r\n", "\r"], "\n", (string) $v);
    $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $s);
    if ($s === null) {
        return '';
    }
    return str_cut(trim($s), $max);
}

function valid_email($s)
{
    return is_string($s) && strlen($s) <= 190 && filter_var($s, FILTER_VALIDATE_EMAIL) !== false;
}

function valid_hex_color($s)
{
    return is_string($s) && preg_match('/^#[0-9a-fA-F]{6}$/', $s) === 1;
}

function valid_date($s)
{
    if (!is_string($s) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $s)) {
        return false;
    }
    $p = explode('-', $s);
    return checkdate((int) $p[1], (int) $p[2], (int) $p[0]);
}

function client_ip()
{
    return isset($_SERVER['REMOTE_ADDR']) ? (string) $_SERVER['REMOTE_ADDR'] : '0.0.0.0';
}

function is_https()
{
    if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
        return true;
    }
    return isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https';
}

function site_host()
{
    $h = isset($_SERVER['HTTP_HOST']) ? (string) $_SERVER['HTTP_HOST'] : 'localhost';
    return preg_replace('/[^A-Za-z0-9.\-:]/', '', $h);
}

function base_url()
{
    return (is_https() ? 'https://' : 'http://') . site_host();
}

function log_error($message)
{
    $dir = APP_ROOT . '/storage/logs';
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }
    @file_put_contents($dir . '/error.log', '[' . date('Y-m-d H:i:s') . '] ' . $message . "\n", FILE_APPEND | LOCK_EX);
}

function json_out($data, $code = 200)
{
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function fail($message, $code = 400, $extra = [])
{
    json_out(array_merge(['ok' => false, 'error' => $message], $extra), $code);
}

function json_body()
{
    static $body = null;
    if ($body !== null) {
        return $body;
    }
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        $body = [];
        return $body;
    }
    if (strlen($raw) > 2000000) {
        fail('Requisição muito grande.', 413);
    }
    $d = json_decode($raw, true);
    if (!is_array($d)) {
        fail('Dados inválidos.');
    }
    $body = $d;
    return $body;
}

function handle_uncaught($ex)
{
    log_error(get_class($ex) . ': ' . $ex->getMessage() . ' em ' . $ex->getFile() . ':' . $ex->getLine());
    $isApi = isset($_SERVER['REQUEST_URI']) && strpos((string) $_SERVER['REQUEST_URI'], '/api/') === 0;
    $detail = cfg('debug') ? $ex->getMessage() : null;
    if ($isApi) {
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
        }
        echo json_encode(['ok' => false, 'error' => 'Erro interno. Tente novamente em instantes.', 'detail' => $detail], JSON_UNESCAPED_UNICODE);
        return;
    }
    if (!headers_sent()) {
        http_response_code(500);
        header('Content-Type: text/html; charset=utf-8');
    }
    echo '<!doctype html><meta charset="utf-8"><title>Erro</title><body style="font-family:sans-serif;padding:2rem">';
    echo '<h1>Algo deu errado</h1><p>Tente novamente em instantes. Se o problema continuar, avise quem cuida do site.</p>';
    if ($detail) {
        echo '<pre>' . e($detail) . '</pre>';
    }
    echo '</body>';
}
