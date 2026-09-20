<?php
/**
 * Conteúdo editável do site. Os textos padrão ficam em content-schema.json;
 * o que o painel salva fica na tabela `content` e tem prioridade.
 */

function content_schema()
{
    static $s = null;
    if ($s === null) {
        $raw = file_get_contents(APP_DIR . '/content-schema.json');
        $s = json_decode($raw === false ? '' : $raw, true);
        if (!is_array($s)) {
            $s = ['groups' => [], 'collections' => []];
        }
    }
    return $s;
}

/** chave => definição do campo (com o id do grupo). */
function content_fields()
{
    static $map = null;
    if ($map === null) {
        $map = [];
        foreach (content_schema()['groups'] as $g) {
            foreach ($g['fields'] as $f) {
                $f['group'] = $g['id'];
                $map[$f['key']] = $f;
            }
        }
    }
    return $map;
}

/** Valores em uso: padrão + alterações salvas no painel. */
function content_all()
{
    $out = [];
    foreach (content_fields() as $key => $f) {
        $out[$key] = (string) $f['default'];
    }
    try {
        foreach (q_all('SELECT k, v FROM content') as $row) {
            if (array_key_exists($row['k'], $out)) {
                $out[$row['k']] = (string) $row['v'];
            }
        }
    } catch (Throwable $ex) {
        log_error('content_all: ' . $ex->getMessage());
    }
    return $out;
}

function valid_media_path($v)
{
    if ($v === '') {
        return true;
    }
    if (preg_match('#^/(assets/img|uploads)/[A-Za-z0-9_./\-]+$#', $v) && strpos($v, '..') === false) {
        return true;
    }
    return preg_match('#^https://[^\s"\'<>]+$#i', $v) === 1;
}

function valid_url_value($v)
{
    if ($v === '') {
        return true;
    }
    return preg_match('#^(https?://[^\s"\'<>]+|mailto:[^\s"\'<>]+|tel:[+0-9 ()\-]+)$#i', $v) === 1;
}

/**
 * Salva campos de conteúdo. Retorna quantos foram gravados.
 * Campos "admin_only" só são gravados por administradores.
 */
function content_save($values, $user)
{
    $fields = content_fields();
    $saved = 0;
    foreach ($values as $key => $val) {
        if (!isset($fields[$key])) {
            continue;
        }
        $f = $fields[$key];
        if (!empty($f['admin_only']) && !is_admin($user)) {
            fail('Apenas o administrador pode alterar "' . $f['label'] . '".', 403);
        }
        $type = $f['type'];
        if ($type === 'textarea') {
            $v = clean_text($val, 4000);
        } elseif ($type === 'image') {
            $v = clean_line($val, 255);
            if (!valid_media_path($v)) {
                fail('Imagem inválida em "' . $f['label'] . '".');
            }
        } elseif ($type === 'url') {
            $v = clean_line($val, 500);
            if (!valid_url_value($v)) {
                fail('Link inválido em "' . $f['label'] . '". Use um endereço começando com https://');
            }
        } else {
            $v = clean_line($val, 300);
        }
        if ($key === 'contact.whatsapp') {
            $v = preg_replace('/\D+/', '', $v);
        }
        q(
            'INSERT INTO content (k, v, updated_at, updated_by) VALUES (?, ?, ?, ?) '
            . 'ON DUPLICATE KEY UPDATE v = VALUES(v), updated_at = VALUES(updated_at), updated_by = VALUES(updated_by)',
            [$key, $v, now(), (int) $user['id']]
        );
        $saved++;
    }
    return $saved;
}

/* ---------- Configurações (somente administrador) ---------- */

function settings_defaults()
{
    return [
        'color_navy' => '#081B3F',
        'color_green' => '#8DB84A',
        'mail_from_email' => '',
        'mail_from_name' => 'Comunidade Entre Nações',
        'mail_reply_to' => '',
        'mail_prayer_to' => '',
        'mail_welcome' => '0',
        'mail_transport' => 'mail',
        'smtp_host' => '',
        'smtp_port' => '465',
        'smtp_secure' => 'ssl',
        'smtp_user' => '',
        'smtp_pass' => '',
    ];
}

function settings_all()
{
    $out = settings_defaults();
    try {
        foreach (q_all('SELECT k, v FROM settings') as $row) {
            if (array_key_exists($row['k'], $out)) {
                $out[$row['k']] = (string) $row['v'];
            }
        }
    } catch (Throwable $ex) {
        log_error('settings_all: ' . $ex->getMessage());
    }
    return $out;
}

function setting_set($key, $value)
{
    q(
        'INSERT INTO settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)',
        [$key, (string) $value]
    );
}
