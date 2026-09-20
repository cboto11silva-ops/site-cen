<?php
/**
 * Carrega tudo o que o site precisa. Incluído por index.php, api/index.php,
 * admin/index.php e install.php.
 */
if (!defined('APP_ROOT')) {
    define('APP_ROOT', dirname(__DIR__));
}
if (!defined('APP_DIR')) {
    define('APP_DIR', __DIR__);
}

date_default_timezone_set('America/Recife');
if (function_exists('mb_internal_encoding')) {
    mb_internal_encoding('UTF-8');
}

require_once APP_DIR . '/helpers.php';
require_once APP_DIR . '/db.php';
require_once APP_DIR . '/security.php';
require_once APP_DIR . '/content.php';
require_once APP_DIR . '/collections.php';
require_once APP_DIR . '/mail.php';
require_once APP_DIR . '/upload.php';

set_exception_handler('handle_uncaught');
