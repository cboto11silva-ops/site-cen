<?php
require __DIR__ . '/app/bootstrap.php';
header('Content-Type: application/xml; charset=utf-8');
$paths = ['/', '/eventos', '/pastores', '/ofertas-e-dizimos', '/pedido-de-oracao', '/area-do-membro'];
echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n";
foreach ($paths as $p) {
    echo '  <url><loc>' . e(base_url() . $p) . '</loc></url>' . "\n";
}
echo '</urlset>' . "\n";
