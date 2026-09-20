<?php
/**
 * API JSON do site. Todas as rotas ficam em /api/...
 * A tabela api_routes() é o "índice" de tudo o que a API faz.
 * Acesso: public (qualquer pessoa), auth (qualquer usuário logado),
 *         editor (conteudista ou admin), admin (somente administrador).
 */

function api_routes()
{
    return [
        ['GET',    'site',                          'h_site',                'public'],
        ['POST',   'prayer',                        'h_prayer_create',       'public'],
        ['POST',   'members',                       'h_member_create',       'public'],
        ['GET',    'auth/me',                       'h_auth_me',             'public'],
        ['POST',   'auth/login',                    'h_auth_login',          'public'],
        ['POST',   'auth/logout',                   'h_auth_logout',         'auth'],
        ['PUT',    'account/password',              'h_account_password',    'auth'],
        ['GET',    'admin/dashboard',               'h_dashboard',           'editor'],
        ['GET',    'admin/content',                 'h_content_get',         'editor'],
        ['PUT',    'admin/content',                 'h_content_save',        'editor'],
        ['POST',   'admin/upload',                  'h_upload',              'editor'],
        ['GET',    'admin/collections',             'h_coll_defs',           'editor'],
        ['GET',    'admin/collections/{c}',         'h_coll_list',           'editor'],
        ['POST',   'admin/collections/{c}',         'h_coll_create',         'editor'],
        ['POST',   'admin/collections/{c}/reorder', 'h_coll_reorder',        'editor'],
        ['PUT',    'admin/collections/{c}/{id}',    'h_coll_update',         'editor'],
        ['DELETE', 'admin/collections/{c}/{id}',    'h_coll_delete',         'editor'],
        ['GET',    'admin/members',                 'h_members_list',        'admin'],
        ['GET',    'admin/members/export',          'h_members_export',      'admin'],
        ['DELETE', 'admin/members/{id}',            'h_members_delete',      'admin'],
        ['GET',    'admin/prayers',                 'h_prayers_list',        'admin'],
        ['PUT',    'admin/prayers/{id}',            'h_prayers_update',      'admin'],
        ['DELETE', 'admin/prayers/{id}',            'h_prayers_delete',      'admin'],
        ['GET',    'admin/users',                   'h_users_list',          'admin'],
        ['POST',   'admin/users',                   'h_users_create',        'admin'],
        ['PUT',    'admin/users/{id}',              'h_users_update',        'admin'],
        ['DELETE', 'admin/users/{id}',              'h_users_delete',        'admin'],
        ['GET',    'admin/settings',                'h_settings_get',        'admin'],
        ['PUT',    'admin/settings',                'h_settings_save',       'admin'],
        ['POST',   'admin/settings/test-email',     'h_settings_test_email', 'admin'],
    ];
}

function api_dispatch()
{
    if (!is_installed()) {
        fail('O site ainda não foi instalado. Abra /install.php', 503);
    }
    $path = (string) parse_url(isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '/', PHP_URL_PATH);
    $path = trim($path, '/');
    if (strpos($path, 'api/') === 0) {
        $path = substr($path, 4);
    } elseif ($path === 'api') {
        $path = '';
    }
    $path = trim($path, '/');
    $method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper((string) $_SERVER['REQUEST_METHOD']) : 'GET';

    $pathMatched = false;
    foreach (api_routes() as $route) {
        list($m, $pattern, $handler, $access) = $route;
        $regex = '#^' . preg_replace('#\{[a-z]+\}#', '([^/]+)', $pattern) . '$#';
        if (!preg_match($regex, $path, $found)) {
            continue;
        }
        $pathMatched = true;
        if ($m !== $method) {
            continue;
        }
        array_shift($found);
        $names = [];
        preg_match_all('#\{([a-z]+)\}#', $pattern, $names);
        $params = [];
        foreach ($names[1] as $i => $n) {
            $params[$n] = rawurldecode($found[$i]);
        }
        $user = null;
        if ($access !== 'public') {
            $user = require_role($access === 'admin' ? 'admin' : 'auth');
            if ($method !== 'GET') {
                csrf_check();
            }
        }
        $handler($params, $user);
        return;
    }
    if ($pathMatched) {
        fail('Método não permitido.', 405);
    }
    fail('Rota não encontrada.', 404);
}

/* =====================================================================
 * Público
 * ===================================================================== */

function site_payload()
{
    $s = settings_all();
    $payload = [
        'content' => content_all(),
        'brand' => [
            'navy' => valid_hex_color($s['color_navy']) ? $s['color_navy'] : '#081B3F',
            'green' => valid_hex_color($s['color_green']) ? $s['color_green'] : '#8DB84A',
        ],
        'events' => [],
        'pastors' => [],
        'highlights' => [],
    ];
    foreach (['events', 'pastors', 'highlights'] as $name) {
        try {
            $payload[$name] = coll_list($name, true);
        } catch (Throwable $ex) {
            log_error('site_payload ' . $name . ': ' . $ex->getMessage());
        }
    }
    return $payload;
}

function h_site($p, $u)
{
    header('Cache-Control: public, max-age=60');
    http_response_code(200);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(site_payload(), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}

function h_prayer_create($p, $u)
{
    origin_check();
    $in = json_body();
    if (!empty($in['website'])) { // campo-armadilha para robôs
        json_out(['ok' => true]);
    }
    $ip = client_ip();
    if (throttle_count('prayer:' . $ip, 3600) >= 6) {
        fail('Você enviou vários pedidos em pouco tempo. Tente novamente mais tarde.', 429);
    }
    $name = clean_line(isset($in['name']) ? $in['name'] : '', 120);
    $contact = clean_line(isset($in['contact']) ? $in['contact'] : '', 160);
    $message = clean_text(isset($in['message']) ? $in['message'] : '', 2000);
    if (str_len($message) < 5) {
        fail('Escreva o seu pedido de oração.');
    }
    throttle_hit('prayer:' . $ip);
    db_insert('prayer_requests', [
        'name' => $name,
        'contact' => $contact,
        'message' => $message,
        'handled' => 0,
        'created_at' => now(),
    ]);
    // Aviso por e-mail (se estiver configurado). Falha no e-mail não impede o pedido.
    $s = settings_all();
    $to = valid_email($s['mail_prayer_to']) ? $s['mail_prayer_to'] : $s['mail_from_email'];
    if (valid_email($to)) {
        $body = "Novo pedido de oração recebido pelo site.\n\n"
            . 'Nome: ' . ($name !== '' ? $name : '(não informado)') . "\n"
            . 'Contato: ' . ($contact !== '' ? $contact : '(não informado)') . "\n\n"
            . "Pedido:\n" . $message . "\n";
        $res = send_mail($to, 'Pedido de oração' . ($name !== '' ? ' - ' . $name : ''), $body, $contact);
        if (!$res[0]) {
            log_error('E-mail de pedido de oração não enviado: ' . $res[1]);
        }
    }
    json_out(['ok' => true]);
}

function h_member_create($p, $u)
{
    origin_check();
    $in = json_body();
    if (!empty($in['website'])) {
        json_out(['ok' => true]);
    }
    $ip = client_ip();
    if (throttle_count('member:' . $ip, 3600) >= 6) {
        fail('Muitos cadastros em pouco tempo. Tente novamente mais tarde.', 429);
    }
    $name = clean_line(isset($in['name']) ? $in['name'] : '', 120);
    $email = strtolower(clean_line(isset($in['email']) ? $in['email'] : '', 190));
    $phone = preg_replace('/\D+/', '', (string) (isset($in['phone']) ? $in['phone'] : ''));
    $birth = clean_line(isset($in['birthdate']) ? $in['birthdate'] : '', 10);
    if (str_len($name) < 3) {
        fail('Informe o seu nome completo.');
    }
    if (!valid_email($email)) {
        fail('Informe um e-mail válido.');
    }
    if (strlen($phone) < 10 || strlen($phone) > 13) {
        fail('Informe um telefone com DDD.');
    }
    if (!valid_date($birth) || $birth > date('Y-m-d') || $birth < '1900-01-01') {
        fail('Informe uma data de nascimento válida.');
    }
    if (empty($in['consent'])) {
        fail('Para se cadastrar, é preciso autorizar o uso dos dados.');
    }
    if (q_one('SELECT id FROM members WHERE email = ?', [$email]) !== null) {
        fail('Este e-mail já está cadastrado. Obrigado!', 409);
    }
    throttle_hit('member:' . $ip);
    db_insert('members', [
        'name' => $name,
        'email' => $email,
        'phone' => $phone,
        'birthdate' => $birth,
        'consent_at' => now(),
        'created_at' => now(),
    ]);
    $s = settings_all();
    if ($s['mail_welcome'] === '1') {
        $first = explode(' ', $name)[0];
        $res = send_mail(
            $email,
            'Bem-vindo(a) à Comunidade Entre Nações',
            'Olá, ' . $first . "!\n\nRecebemos o seu cadastro. Que alegria ter você com a gente!\n\n"
            . "Em breve nossa equipe entra em contato.\n\nComunidade Entre Nações\n"
        );
        if (!$res[0]) {
            log_error('E-mail de boas-vindas não enviado: ' . $res[1]);
        }
    }
    json_out(['ok' => true]);
}

/* =====================================================================
 * Login
 * ===================================================================== */

function h_auth_me($p, $u)
{
    $user = current_user();
    if ($user === null) {
        json_out(['ok' => true, 'user' => null]);
    }
    json_out(['ok' => true, 'user' => public_user($user), 'csrf' => csrf_token()]);
}

function h_auth_login($p, $u)
{
    origin_check();
    $in = json_body();
    $email = strtolower(clean_line(isset($in['email']) ? $in['email'] : '', 190));
    $pass = (string) (isset($in['password']) ? $in['password'] : '');
    $ip = client_ip();
    $mailBucket = 'lm:' . md5($email);
    if (throttle_count('li:' . $ip, 900) >= 10 || throttle_count($mailBucket, 900) >= 6) {
        fail('Muitas tentativas de login. Aguarde 15 minutos e tente de novo.', 429);
    }
    $row = q_one('SELECT * FROM users WHERE email = ? AND active = 1', [$email]);
    if ($row === null || !password_verify($pass, $row['password_hash'])) {
        throttle_hit('li:' . $ip);
        throttle_hit($mailBucket);
        fail('E-mail ou senha incorretos.', 401);
    }
    session_boot(true);
    session_regenerate_id(true);
    $_SESSION['uid'] = (int) $row['id'];
    $_SESSION['t'] = time();
    $_SESSION['csrf'] = bin2hex(random_bytes(16));
    q('UPDATE users SET last_login = ? WHERE id = ?', [now(), (int) $row['id']]);
    json_out(['ok' => true, 'user' => public_user($row), 'csrf' => $_SESSION['csrf']]);
}

function h_auth_logout($p, $u)
{
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $c = session_get_cookie_params();
        setcookie(session_name(), '', time() - 3600, $c['path'], $c['domain'], (bool) $c['secure'], (bool) $c['httponly']);
    }
    session_destroy();
    json_out(['ok' => true]);
}

function h_account_password($p, $u)
{
    $in = json_body();
    $current = (string) (isset($in['current']) ? $in['current'] : '');
    $new = (string) (isset($in['new']) ? $in['new'] : '');
    $row = q_one('SELECT password_hash FROM users WHERE id = ?', [(int) $u['id']]);
    if ($row === null || !password_verify($current, $row['password_hash'])) {
        fail('A senha atual está incorreta.', 400);
    }
    if (strlen($new) < 10) {
        fail('A nova senha precisa ter pelo menos 10 caracteres.');
    }
    q('UPDATE users SET password_hash = ? WHERE id = ?', [password_hash($new, PASSWORD_DEFAULT), (int) $u['id']]);
    json_out(['ok' => true]);
}

/* =====================================================================
 * Painel: resumo, conteúdo, imagens, listas
 * ===================================================================== */

function h_dashboard($p, $u)
{
    $out = [
        'ok' => true,
        'counts' => [
            'events' => (int) q_val('SELECT COUNT(*) FROM events WHERE published = 1'),
            'pastors' => (int) q_val('SELECT COUNT(*) FROM pastors WHERE published = 1'),
            'highlights' => (int) q_val('SELECT COUNT(*) FROM highlights WHERE published = 1'),
        ],
    ];
    if (is_admin($u)) {
        $out['counts']['members'] = (int) q_val('SELECT COUNT(*) FROM members');
        $out['counts']['members_month'] = (int) q_val('SELECT COUNT(*) FROM members WHERE created_at >= ?', [date('Y-m-01 00:00:00')]);
        $out['counts']['prayers_new'] = (int) q_val('SELECT COUNT(*) FROM prayer_requests WHERE handled = 0');
        $out['recent_members'] = q_all('SELECT id, name, email, created_at FROM members ORDER BY id DESC LIMIT 5');
    }
    json_out($out);
}

function h_content_get($p, $u)
{
    $groups = [];
    foreach (content_schema()['groups'] as $g) {
        $fields = [];
        foreach ($g['fields'] as $f) {
            if (!empty($f['admin_only']) && !is_admin($u)) {
                continue;
            }
            $fields[] = $f;
        }
        if ($fields) {
            $groups[] = ['id' => $g['id'], 'label' => $g['label'], 'fields' => $fields];
        }
    }
    json_out(['ok' => true, 'groups' => $groups, 'values' => content_all()]);
}

function h_content_save($p, $u)
{
    $in = json_body();
    $values = isset($in['values']) && is_array($in['values']) ? $in['values'] : [];
    $n = content_save($values, $u);
    json_out(['ok' => true, 'saved' => $n, 'values' => content_all()]);
}

function h_upload($p, $u)
{
    if (!isset($_FILES['file'])) {
        fail('Nenhuma imagem enviada.');
    }
    $url = handle_image_upload($_FILES['file']);
    json_out(['ok' => true, 'url' => $url]);
}

function h_coll_defs($p, $u)
{
    json_out(['ok' => true, 'collections' => collections_def()]);
}

function h_coll_list($p, $u)
{
    json_out(['ok' => true, 'items' => coll_list($p['c'], false)]);
}

function h_coll_create($p, $u)
{
    $id = coll_create($p['c'], json_body());
    json_out(['ok' => true, 'id' => $id, 'items' => coll_list($p['c'], false)]);
}

function h_coll_update($p, $u)
{
    coll_update($p['c'], (int) $p['id'], json_body());
    json_out(['ok' => true, 'items' => coll_list($p['c'], false)]);
}

function h_coll_delete($p, $u)
{
    coll_delete($p['c'], (int) $p['id']);
    json_out(['ok' => true, 'items' => coll_list($p['c'], false)]);
}

function h_coll_reorder($p, $u)
{
    $in = json_body();
    $ids = isset($in['ids']) && is_array($in['ids']) ? $in['ids'] : [];
    coll_reorder($p['c'], $ids);
    json_out(['ok' => true, 'items' => coll_list($p['c'], false)]);
}

/* =====================================================================
 * Administrador: membros, pedidos de oração, usuários, configurações
 * ===================================================================== */

function like_escape($s)
{
    return str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $s);
}

function h_members_list($p, $u)
{
    $q = clean_line(isset($_GET['q']) ? $_GET['q'] : '', 80);
    $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 50;
    $limit = max(1, min(200, $limit));
    $offset = max(0, isset($_GET['offset']) ? (int) $_GET['offset'] : 0);
    $where = '';
    $params = [];
    if ($q !== '') {
        $like = '%' . like_escape($q) . '%';
        $where = ' WHERE name LIKE ? OR email LIKE ? OR phone LIKE ?';
        $params = [$like, $like, $like];
    }
    $total = (int) q_val('SELECT COUNT(*) FROM members' . $where, $params);
    $rows = q_all(
        'SELECT id, name, email, phone, birthdate, created_at FROM members' . $where
        . ' ORDER BY id DESC LIMIT ' . $limit . ' OFFSET ' . $offset,
        $params
    );
    json_out(['ok' => true, 'total' => $total, 'members' => $rows]);
}

function csv_cell($v)
{
    $s = (string) $v;
    if ($s !== '' && strpos('=+-@', $s[0]) !== false) {
        $s = "'" . $s; // evita que o Excel execute fórmulas
    }
    return '"' . str_replace('"', '""', $s) . '"';
}

function h_members_export($p, $u)
{
    $rows = q_all('SELECT name, email, phone, birthdate, created_at FROM members ORDER BY name ASC');
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="membros-cen-' . date('Y-m-d') . '.csv"');
    header('Cache-Control: no-store');
    echo "\xEF\xBB\xBF";
    echo "Nome;E-mail;Telefone;Nascimento;Cadastro em\r\n";
    foreach ($rows as $r) {
        $line = [];
        foreach (['name', 'email', 'phone', 'birthdate', 'created_at'] as $k) {
            $line[] = csv_cell($r[$k]);
        }
        echo implode(';', $line) . "\r\n";
    }
    exit;
}

function h_members_delete($p, $u)
{
    q('DELETE FROM members WHERE id = ?', [(int) $p['id']]);
    json_out(['ok' => true]);
}

function h_prayers_list($p, $u)
{
    $limit = isset($_GET['limit']) ? max(1, min(200, (int) $_GET['limit'])) : 100;
    $rows = q_all('SELECT id, name, contact, message, handled, created_at FROM prayer_requests ORDER BY handled ASC, id DESC LIMIT ' . $limit);
    foreach ($rows as $i => $r) {
        $rows[$i]['handled'] = (int) $r['handled'] === 1;
    }
    json_out(['ok' => true, 'prayers' => $rows]);
}

function h_prayers_update($p, $u)
{
    $in = json_body();
    q('UPDATE prayer_requests SET handled = ? WHERE id = ?', [!empty($in['handled']) ? 1 : 0, (int) $p['id']]);
    json_out(['ok' => true]);
}

function h_prayers_delete($p, $u)
{
    q('DELETE FROM prayer_requests WHERE id = ?', [(int) $p['id']]);
    json_out(['ok' => true]);
}

function users_payload()
{
    $rows = q_all('SELECT id, name, email, role, active, last_login, created_at FROM users ORDER BY id ASC');
    foreach ($rows as $i => $r) {
        $rows[$i]['id'] = (int) $r['id'];
        $rows[$i]['active'] = (int) $r['active'] === 1;
    }
    return $rows;
}

function active_admin_count($exceptId = 0)
{
    return (int) q_val("SELECT COUNT(*) FROM users WHERE role = 'admin' AND active = 1 AND id <> ?", [$exceptId]);
}

function h_users_list($p, $u)
{
    json_out(['ok' => true, 'users' => users_payload()]);
}

function h_users_create($p, $u)
{
    $in = json_body();
    $name = clean_line(isset($in['name']) ? $in['name'] : '', 120);
    $email = strtolower(clean_line(isset($in['email']) ? $in['email'] : '', 190));
    $role = (isset($in['role']) && $in['role'] === 'admin') ? 'admin' : 'editor';
    $pass = (string) (isset($in['password']) ? $in['password'] : '');
    if (str_len($name) < 2) {
        fail('Informe o nome.');
    }
    if (!valid_email($email)) {
        fail('Informe um e-mail válido.');
    }
    if (strlen($pass) < 10) {
        fail('A senha precisa ter pelo menos 10 caracteres.');
    }
    if (q_one('SELECT id FROM users WHERE email = ?', [$email]) !== null) {
        fail('Já existe um usuário com este e-mail.', 409);
    }
    db_insert('users', [
        'name' => $name,
        'email' => $email,
        'password_hash' => password_hash($pass, PASSWORD_DEFAULT),
        'role' => $role,
        'active' => 1,
        'created_at' => now(),
    ]);
    json_out(['ok' => true, 'users' => users_payload()]);
}

function h_users_update($p, $u)
{
    $id = (int) $p['id'];
    $target = q_one('SELECT * FROM users WHERE id = ?', [$id]);
    if ($target === null) {
        fail('Usuário não encontrado.', 404);
    }
    $in = json_body();
    $data = [];
    if (array_key_exists('name', $in)) {
        $name = clean_line($in['name'], 120);
        if (str_len($name) < 2) {
            fail('Informe o nome.');
        }
        $data['name'] = $name;
    }
    if (array_key_exists('email', $in)) {
        $email = strtolower(clean_line($in['email'], 190));
        if (!valid_email($email)) {
            fail('Informe um e-mail válido.');
        }
        $dup = q_one('SELECT id FROM users WHERE email = ? AND id <> ?', [$email, $id]);
        if ($dup !== null) {
            fail('Já existe um usuário com este e-mail.', 409);
        }
        $data['email'] = $email;
    }
    if (array_key_exists('role', $in)) {
        $data['role'] = $in['role'] === 'admin' ? 'admin' : 'editor';
    }
    if (array_key_exists('active', $in)) {
        $data['active'] = $in['active'] ? 1 : 0;
    }
    if (!empty($in['password'])) {
        if (strlen((string) $in['password']) < 10) {
            fail('A senha precisa ter pelo menos 10 caracteres.');
        }
        $data['password_hash'] = password_hash((string) $in['password'], PASSWORD_DEFAULT);
    }
    $newRole = isset($data['role']) ? $data['role'] : $target['role'];
    $newActive = isset($data['active']) ? $data['active'] : (int) $target['active'];
    if ($id === (int) $u['id'] && ($newRole !== 'admin' || $newActive !== 1)) {
        fail('Você não pode remover o seu próprio acesso de administrador.');
    }
    if (($newRole !== 'admin' || $newActive !== 1) && active_admin_count($id) < 1) {
        fail('O site precisa ter pelo menos um administrador ativo.');
    }
    if ($data) {
        db_update('users', $id, $data);
    }
    json_out(['ok' => true, 'users' => users_payload()]);
}

function h_users_delete($p, $u)
{
    $id = (int) $p['id'];
    if ($id === (int) $u['id']) {
        fail('Você não pode excluir o seu próprio usuário.');
    }
    $target = q_one('SELECT role, active FROM users WHERE id = ?', [$id]);
    if ($target === null) {
        fail('Usuário não encontrado.', 404);
    }
    if ($target['role'] === 'admin' && active_admin_count($id) < 1) {
        fail('O site precisa ter pelo menos um administrador ativo.');
    }
    q('DELETE FROM users WHERE id = ?', [$id]);
    json_out(['ok' => true, 'users' => users_payload()]);
}

function settings_payload()
{
    $s = settings_all();
    $s['smtp_pass_set'] = $s['smtp_pass'] !== '';
    unset($s['smtp_pass']);
    return $s;
}

function h_settings_get($p, $u)
{
    json_out([
        'ok' => true,
        'settings' => settings_payload(),
        'diagnostics' => [
            'php' => PHP_VERSION,
            'openssl' => function_exists('openssl_encrypt'),
            'gd' => function_exists('imagecreatetruecolor'),
            'mbstring' => function_exists('mb_strlen'),
            'uploads_writable' => is_writable(APP_ROOT . '/uploads'),
            'storage_writable' => is_writable(APP_ROOT . '/storage'),
            'https' => is_https(),
        ],
    ]);
}

function h_settings_save($p, $u)
{
    $body = json_body();
    $in = isset($body['settings']) && is_array($body['settings']) ? $body['settings'] : [];
    $allowed = array_keys(settings_defaults());
    foreach ($in as $key => $val) {
        if (!in_array($key, $allowed, true) || $key === 'smtp_pass' || !is_scalar($val)) {
            continue;
        }
        $val = clean_line($val, 190);
        if (in_array($key, ['color_navy', 'color_green'], true)) {
            if (!valid_hex_color($val)) {
                fail('Cor inválida. Use o formato #RRGGBB.');
            }
        } elseif (in_array($key, ['mail_from_email', 'mail_reply_to', 'mail_prayer_to'], true)) {
            if ($val !== '' && !valid_email($val)) {
                fail('E-mail inválido: ' . $val);
            }
        } elseif ($key === 'mail_transport') {
            $val = $val === 'smtp' ? 'smtp' : 'mail';
        } elseif ($key === 'smtp_secure') {
            $val = in_array($val, ['ssl', 'tls', 'none'], true) ? $val : 'ssl';
        } elseif ($key === 'smtp_port') {
            $val = (string) max(1, min(65535, (int) $val));
        } elseif ($key === 'mail_welcome') {
            $val = $val === '1' ? '1' : '0';
        }
        setting_set($key, $val);
    }
    if (!empty($in['smtp_pass_clear'])) {
        setting_set('smtp_pass', '');
    } elseif (isset($in['smtp_pass']) && is_string($in['smtp_pass']) && $in['smtp_pass'] !== '') {
        setting_set('smtp_pass', secret_encrypt($in['smtp_pass']));
    }
    json_out(['ok' => true, 'settings' => settings_payload()]);
}

function h_settings_test_email($p, $u)
{
    $in = json_body();
    $to = strtolower(clean_line(isset($in['to']) ? $in['to'] : '', 190));
    if ($to === '') {
        $to = strtolower($u['email']);
    }
    if (!valid_email($to)) {
        fail('Informe um e-mail de destino válido.');
    }
    $res = send_mail(
        $to,
        'Teste de e-mail do site da CEN',
        "Este é um e-mail de teste enviado pelo painel do site.\n\nSe você recebeu esta mensagem, o envio está funcionando.\n"
    );
    if ($res[0]) {
        json_out(['ok' => true, 'message' => 'E-mail de teste enviado para ' . $to . '. Confira a caixa de entrada e o spam.']);
    }
    json_out(['ok' => false, 'error' => $res[1]], 200);
}
