<?php
/** Conexão com o MySQL e atalhos de consulta (sempre com parâmetros). */

function db()
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }
    $dsn = 'mysql:host=' . cfg('db_host', 'localhost') . ';dbname=' . cfg('db_name', '') . ';charset=utf8mb4';
    $pdo = new PDO($dsn, (string) cfg('db_user', ''), (string) cfg('db_pass', ''), [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
    return $pdo;
}

function q($sql, $params = [])
{
    $st = db()->prepare($sql);
    $st->execute($params);
    return $st;
}

function q_all($sql, $params = [])
{
    return q($sql, $params)->fetchAll();
}

function q_one($sql, $params = [])
{
    $row = q($sql, $params)->fetch();
    return $row === false ? null : $row;
}

function q_val($sql, $params = [])
{
    $v = q($sql, $params)->fetchColumn();
    return $v === false ? null : $v;
}

/** Insere uma linha e devolve o id. $data: coluna => valor. */
function db_insert($table, $data)
{
    $cols = array_keys($data);
    $marks = implode(', ', array_fill(0, count($cols), '?'));
    q('INSERT INTO ' . $table . ' (' . implode(', ', $cols) . ') VALUES (' . $marks . ')', array_values($data));
    return (int) db()->lastInsertId();
}

/** Atualiza linhas por id. */
function db_update($table, $id, $data)
{
    $sets = [];
    foreach (array_keys($data) as $col) {
        $sets[] = $col . ' = ?';
    }
    $params = array_values($data);
    $params[] = $id;
    q('UPDATE ' . $table . ' SET ' . implode(', ', $sets) . ' WHERE id = ?', $params);
}
