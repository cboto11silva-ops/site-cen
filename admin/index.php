<?php
/** Painel de gestão: entrega apenas o esqueleto; o restante roda em /assets/js/admin.js */
require dirname(__DIR__) . '/app/bootstrap.php';
if (!is_installed()) {
    header('Location: /install.php');
    exit;
}
$v = function ($file) {
    $t = @filemtime(dirname(__DIR__) . $file);
    return $t ? (string) $t : '1';
};
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');
?>
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Painel – Comunidade Entre Nações</title>
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Figtree:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="/assets/css/admin.css?v=<?= e($v('/assets/css/admin.css')) ?>">
</head>
<body>
<div id="admin"></div>
<noscript><p style="padding:2rem;font-family:sans-serif">O painel precisa do JavaScript ativado.</p></noscript>
<script type="module" src="/assets/js/admin.js?v=<?= e($v('/assets/js/admin.js')) ?>"></script>
</body>
</html>
