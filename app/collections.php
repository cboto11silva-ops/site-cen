<?php
/**
 * Listas editáveis do site: eventos, pastores e novidades.
 * Cada lista tem uma tabela e um conjunto de campos validados.
 */

function collections_def()
{
    return [
        'events' => [
            'label' => 'Eventos',
            'singular' => 'evento',
            'table' => 'events',
            'title_field' => 'title',
            'fields' => [
                ['key' => 'title', 'label' => 'Nome do evento', 'type' => 'text', 'max' => 160, 'required' => true],
                ['key' => 'weekday', 'label' => 'Dia da semana (encontros que se repetem toda semana)', 'type' => 'weekday',
                 'help' => 'Escolha um dia para encontros semanais. O site mostra automaticamente o próximo encontro.'],
                ['key' => 'event_date', 'label' => 'Data (evento especial, acontece uma vez)', 'type' => 'date',
                 'help' => 'Use para eventos com data marcada. Depois da data, o evento sai do site sozinho.'],
                ['key' => 'day_label', 'label' => 'Texto do dia (opcional)', 'type' => 'text', 'max' => 80,
                 'help' => 'Só se precisar de algo diferente, como "3ª sexta-feira do mês".'],
                ['key' => 'time_label', 'label' => 'Horário', 'type' => 'text', 'max' => 40, 'help' => 'Exemplo: 19h30'],
                ['key' => 'location', 'label' => 'Local', 'type' => 'text', 'max' => 160],
                ['key' => 'description', 'label' => 'Descrição', 'type' => 'textarea', 'max' => 1200],
                ['key' => 'image', 'label' => 'Imagem (opcional)', 'type' => 'image'],
            ],
        ],
        'pastors' => [
            'label' => 'Pastores',
            'singular' => 'pastor',
            'table' => 'pastors',
            'title_field' => 'name',
            'fields' => [
                ['key' => 'name', 'label' => 'Nome', 'type' => 'text', 'max' => 120, 'required' => true],
                ['key' => 'role', 'label' => 'Função', 'type' => 'text', 'max' => 120],
                ['key' => 'bio', 'label' => 'Apresentação', 'type' => 'textarea', 'max' => 1500],
                ['key' => 'photo', 'label' => 'Foto (opcional)', 'type' => 'image'],
            ],
        ],
        'highlights' => [
            'label' => 'Novidades',
            'singular' => 'novidade',
            'table' => 'highlights',
            'title_field' => 'title',
            'fields' => [
                ['key' => 'title', 'label' => 'Título', 'type' => 'text', 'max' => 160, 'required' => true],
                ['key' => 'caption', 'label' => 'Legenda (opcional)', 'type' => 'text', 'max' => 200],
                ['key' => 'image', 'label' => 'Imagem', 'type' => 'image', 'required' => true],
                ['key' => 'link', 'label' => 'Link ao clicar (opcional)', 'type' => 'url',
                 'help' => 'Se ficar vazio, abre o Instagram da igreja.'],
            ],
        ],
    ];
}

function coll_def($name)
{
    $defs = collections_def();
    if (!isset($defs[$name])) {
        fail('Lista não encontrada.', 404);
    }
    return $defs[$name];
}

/** Lista os itens. $onlyPublished = true para o site público. */
function coll_list($name, $onlyPublished = false)
{
    $def = coll_def($name);
    $sql = 'SELECT * FROM ' . $def['table'];
    if ($onlyPublished) {
        $sql .= ' WHERE published = 1';
    }
    $sql .= ' ORDER BY sort_order ASC, id ASC';
    $rows = q_all($sql);
    $today = date('Y-m-d');
    $out = [];
    foreach ($rows as $r) {
        if ($name === 'events' && $onlyPublished && !empty($r['event_date']) && $r['event_date'] < $today) {
            continue; // evento especial que já passou
        }
        $r['id'] = (int) $r['id'];
        $r['sort_order'] = (int) $r['sort_order'];
        $r['published'] = (int) $r['published'] === 1;
        if (array_key_exists('weekday', $r)) {
            $r['weekday'] = $r['weekday'] === null ? null : (int) $r['weekday'];
        }
        $out[] = $r;
    }
    return $out;
}

/** Valida os dados enviados e devolve coluna => valor pronta para o banco. */
function coll_clean($name, $in, $isNew)
{
    $def = coll_def($name);
    $data = [];
    foreach ($def['fields'] as $f) {
        $key = $f['key'];
        if (!$isNew && !array_key_exists($key, $in)) {
            continue;
        }
        $raw = array_key_exists($key, $in) ? $in[$key] : '';
        $type = $f['type'];
        if ($type === 'weekday') {
            if ($raw === null || $raw === '') {
                $val = null;
            } else {
                $n = (int) $raw;
                if ($n < 0 || $n > 6) {
                    fail('Dia da semana inválido.');
                }
                $val = $n;
            }
        } elseif ($type === 'date') {
            $s = clean_line($raw, 10);
            if ($s === '') {
                $val = null;
            } elseif (!valid_date($s)) {
                fail('Data inválida.');
            } else {
                $val = $s;
            }
        } elseif ($type === 'textarea') {
            $val = clean_text($raw, isset($f['max']) ? $f['max'] : 2000);
        } elseif ($type === 'image') {
            $val = clean_line($raw, 255);
            if (!valid_media_path($val)) {
                fail('Imagem inválida.');
            }
        } elseif ($type === 'url') {
            $val = clean_line($raw, 500);
            if (!valid_url_value($val)) {
                fail('Link inválido. Use um endereço começando com https://');
            }
        } else {
            $val = clean_line($raw, isset($f['max']) ? $f['max'] : 200);
        }
        if (!empty($f['required']) && ($val === '' || $val === null)) {
            fail('Preencha o campo "' . $f['label'] . '".');
        }
        $data[$key] = $val;
    }
    if (array_key_exists('published', $in)) {
        $data['published'] = $in['published'] ? 1 : 0;
    } elseif ($isNew) {
        $data['published'] = 1;
    }
    return $data;
}

function coll_create($name, $in)
{
    $def = coll_def($name);
    $data = coll_clean($name, $in, true);
    $max = (int) q_val('SELECT COALESCE(MAX(sort_order), 0) FROM ' . $def['table']);
    $data['sort_order'] = $max + 1;
    return db_insert($def['table'], $data);
}

function coll_update($name, $id, $in)
{
    $def = coll_def($name);
    $exists = q_one('SELECT id FROM ' . $def['table'] . ' WHERE id = ?', [$id]);
    if ($exists === null) {
        fail('Item não encontrado.', 404);
    }
    $data = coll_clean($name, $in, false);
    if ($data) {
        db_update($def['table'], $id, $data);
    }
}

function coll_delete($name, $id)
{
    $def = coll_def($name);
    q('DELETE FROM ' . $def['table'] . ' WHERE id = ?', [$id]);
}

/** Recebe a lista de ids na nova ordem. */
function coll_reorder($name, $ids)
{
    $def = coll_def($name);
    $pos = 1;
    foreach ($ids as $id) {
        q('UPDATE ' . $def['table'] . ' SET sort_order = ? WHERE id = ?', [$pos, (int) $id]);
        $pos++;
    }
}

/** Insere os dados iniciais (chamado pelo instalador quando as tabelas estão vazias). */
function coll_seed()
{
    $seed = content_schema()['collections'];
    foreach ($seed as $name => $rows) {
        $def = coll_def($name);
        $count = (int) q_val('SELECT COUNT(*) FROM ' . $def['table']);
        if ($count > 0) {
            continue;
        }
        $order = 1;
        foreach ($rows as $row) {
            $data = [];
            foreach ($row as $k => $v) {
                $data[$k] = $v;
            }
            $data['sort_order'] = $order++;
            $data['published'] = 1;
            db_insert($def['table'], $data);
        }
    }
}
