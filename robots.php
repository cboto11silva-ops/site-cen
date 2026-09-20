<?php
require __DIR__ . '/app/bootstrap.php';
header('Content-Type: text/plain; charset=utf-8');
echo "User-agent: *\nDisallow: /admin/\nDisallow: /api/\nDisallow: /app/\nDisallow: /install.php\nAllow: /\n\n";
echo 'Sitemap: ' . base_url() . "/sitemap.xml\n";
