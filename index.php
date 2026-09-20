<?php
/**
 * Página pública. Entrega o "esqueleto" HTML com título, descrição e imagem de
 * compartilhamento já preenchidos (bom para Google e WhatsApp) e embute os
 * dados do site para a página abrir sem espera.
 */
require __DIR__ . '/app/bootstrap.php';

if (!is_installed()) {
    header('Location: /install.php');
    exit;
}
require APP_DIR . '/api.php';

$routes = [
    '/' => ['title' => null, 'text' => 'home.hero.text'],
    '/eventos' => ['title' => 'events.hero.title', 'text' => 'events.hero.text'],
    '/pastores' => ['title' => 'pastors.hero.title', 'text' => 'pastors.hero.text'],
    '/ofertas-e-dizimos' => ['title' => 'giving.hero.title', 'text' => 'giving.hero.text'],
    '/pedido-de-oracao' => ['title' => 'prayer.hero.title', 'text' => 'prayer.hero.text'],
    '/area-do-membro' => ['title' => 'member.hero.title', 'text' => 'member.hero.text'],
];

$path = (string) parse_url(isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '/', PHP_URL_PATH);
$path = '/' . trim(rawurldecode($path), '/');
if ($path === '/index.php') {
    $path = '/';
}
$known = isset($routes[$path]);
if (!$known) {
    http_response_code(404);
}

try {
    $data = site_payload();
} catch (Throwable $ex) {
    log_error('index: ' . $ex->getMessage());
    $defaults = [];
    foreach (content_fields() as $k => $f) {
        $defaults[$k] = (string) $f['default'];
    }
    $data = ['content' => $defaults, 'brand' => ['navy' => '#081B3F', 'green' => '#8DB84A'], 'events' => [], 'pastors' => [], 'highlights' => []];
}
$c = $data['content'];
$siteName = $c['site.name'];
if ($known && $routes[$path]['title'] !== null) {
    $title = $c[$routes[$path]['title']] . ' – ' . $siteName;
    $desc = $c[$routes[$path]['text']];
} elseif ($known) {
    $title = $c['seo.title'];
    $desc = $c['seo.description'];
} else {
    $title = 'Página não encontrada – ' . $siteName;
    $desc = $c['seo.description'];
}
$desc = str_cut(preg_replace('/\s+/', ' ', $desc), 160);
$img = $c['seo.image'];
if (strpos($img, 'http') !== 0) {
    $img = base_url() . $img;
}
$url = base_url() . ($path === '/' ? '/' : $path);

$ld = [
    '@context' => 'https://schema.org',
    '@type' => 'Church',
    'name' => $siteName,
    'url' => base_url() . '/',
    'image' => $img,
    'address' => ['@type' => 'PostalAddress', 'addressLocality' => 'Petrolina', 'addressRegion' => 'PE', 'addressCountry' => 'BR'],
    'sameAs' => array_values(array_filter([$c['social.instagram'], $c['social.youtube'], $c['social.facebook']])),
];
$flags = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT | JSON_INVALID_UTF8_SUBSTITUTE;
$v = function ($file) {
    $t = @filemtime(__DIR__ . $file);
    return $t ? (string) $t : '1';
};
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-cache');
?>
<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title><?= e($title) ?></title>
<meta name="description" content="<?= e($desc) ?>">
<meta name="theme-color" content="<?= e($data['brand']['navy']) ?>">
<link rel="canonical" href="<?= e($url) ?>">
<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="<?= e($siteName) ?>">
<meta property="og:title" content="<?= e($title) ?>">
<meta property="og:description" content="<?= e($desc) ?>">
<meta property="og:url" content="<?= e($url) ?>">
<meta property="og:image" content="<?= e($img) ?>">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,700;12..96,800&family=Figtree:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="/assets/css/site.css?v=<?= e($v('/assets/css/site.css')) ?>">
<style>:root{--navy:<?= e($data['brand']['navy']) ?>;--green:<?= e($data['brand']['green']) ?>}</style>
<script type="application/ld+json"><?= json_encode($ld, $flags) ?></script>
</head>
<body>
<div id="app"></div>
<noscript><p style="padding:2rem;font-family:sans-serif">Este site precisa do JavaScript ativado para funcionar. Fale conosco: <?= e($c['contact.email']) ?></p></noscript>
<script id="cen-data" type="application/json"><?= json_encode($data, $flags) ?></script>
<script type="module" src="/assets/js/site.js?v=<?= e($v('/assets/js/site.js')) ?>"></script>
</body>
</html>
