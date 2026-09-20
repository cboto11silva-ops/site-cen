<?php
/**
 * Envio de e-mails.
 * Usa SMTP (recomendado, ex.: smtp.hostinger.com) ou a função mail() do servidor.
 * Configurado no painel: Configurações > E-mail.
 */

function mail_header_encode($s)
{
    if (preg_match('/^[\x20-\x7E]*$/', $s)) {
        return $s;
    }
    return '=?UTF-8?B?' . base64_encode($s) . '?=';
}

function mail_clean_header($s)
{
    return trim(str_replace(["\r", "\n", "\0"], ' ', (string) $s));
}

/**
 * Envia um e-mail de texto simples.
 * Retorna [true, ''] em caso de sucesso ou [false, 'motivo'] em caso de falha.
 */
function send_mail($to, $subject, $body, $replyTo = '')
{
    $s = settings_all();
    $fromEmail = $s['mail_from_email'];
    if (!valid_email($fromEmail)) {
        return [false, 'Configure o e-mail remetente em Configurações > E-mail.'];
    }
    if (!valid_email($to)) {
        return [false, 'Endereço de destino inválido.'];
    }
    $fromName = mail_clean_header($s['mail_from_name']);
    if ($fromName === '') {
        $fromName = 'Comunidade Entre Nações';
    }
    $subject = mail_clean_header($subject);
    $replyTo = valid_email($replyTo) ? $replyTo : (valid_email($s['mail_reply_to']) ? $s['mail_reply_to'] : '');

    $headers = [
        'Date: ' . date('r'),
        'From: ' . mail_header_encode($fromName) . ' <' . $fromEmail . '>',
        'To: <' . $to . '>',
        'Subject: ' . mail_header_encode($subject),
        'Message-ID: <' . bin2hex(random_bytes(8)) . '@' . site_host() . '>',
        'MIME-Version: 1.0',
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
    ];
    if ($replyTo !== '') {
        $headers[] = 'Reply-To: <' . $replyTo . '>';
    }
    $encodedBody = chunk_split(base64_encode(str_replace("\r\n", "\n", $body)), 76, "\r\n");

    if ($s['mail_transport'] === 'smtp') {
        return smtp_send($s, $fromEmail, $to, $headers, $encodedBody);
    }

    // Função mail() do servidor: cabeçalhos To e Subject são montados por ela.
    $filtered = [];
    foreach ($headers as $h) {
        if (strpos($h, 'To:') === 0 || strpos($h, 'Subject:') === 0) {
            continue;
        }
        $filtered[] = $h;
    }
    $ok = @mail($to, mail_header_encode($subject), $encodedBody, implode("\r\n", $filtered), '-f' . $fromEmail);
    return $ok ? [true, ''] : [false, 'O servidor não conseguiu enviar pelo método padrão. Use SMTP em Configurações > E-mail.'];
}

/** Lê uma resposta SMTP (pode ter várias linhas). Retorna [código, texto]. */
function smtp_read($fp)
{
    $text = '';
    $code = 0;
    while (($line = fgets($fp, 1024)) !== false) {
        $text .= $line;
        $code = (int) substr($line, 0, 3);
        if (strlen($line) < 4 || $line[3] === ' ') {
            break;
        }
    }
    return [$code, trim($text)];
}

function smtp_cmd($fp, $cmd, $expect)
{
    fwrite($fp, $cmd . "\r\n");
    $r = smtp_read($fp);
    if (!in_array($r[0], (array) $expect, true)) {
        return [false, $r[1]];
    }
    return [true, $r[1]];
}

function smtp_send($s, $fromEmail, $to, $headers, $encodedBody)
{
    $host = trim($s['smtp_host']);
    $port = (int) $s['smtp_port'];
    if ($host === '' || $port < 1) {
        return [false, 'Preencha o servidor e a porta do SMTP.'];
    }
    $secure = $s['smtp_secure'];
    $remote = ($secure === 'ssl' ? 'ssl://' : 'tcp://') . $host . ':' . $port;
    $errno = 0;
    $errstr = '';
    $fp = @stream_socket_client($remote, $errno, $errstr, 12, STREAM_CLIENT_CONNECT);
    if (!$fp) {
        return [false, 'Não foi possível conectar ao servidor SMTP (' . $errstr . ').'];
    }
    stream_set_timeout($fp, 12);

    $greet = smtp_read($fp);
    if ($greet[0] !== 220) {
        fclose($fp);
        return [false, 'O servidor SMTP não respondeu como esperado: ' . $greet[1]];
    }
    $ehloName = site_host();
    $r = smtp_cmd($fp, 'EHLO ' . $ehloName, 250);
    if (!$r[0]) {
        fclose($fp);
        return [false, 'EHLO recusado: ' . $r[1]];
    }
    if ($secure === 'tls') {
        $r = smtp_cmd($fp, 'STARTTLS', 220);
        if (!$r[0]) {
            fclose($fp);
            return [false, 'STARTTLS recusado: ' . $r[1]];
        }
        if (!@stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            fclose($fp);
            return [false, 'Falha ao iniciar a conexão segura (TLS).'];
        }
        $r = smtp_cmd($fp, 'EHLO ' . $ehloName, 250);
        if (!$r[0]) {
            fclose($fp);
            return [false, 'EHLO recusado após TLS: ' . $r[1]];
        }
    }
    $user = $s['smtp_user'];
    if ($user !== '') {
        $pass = secret_decrypt($s['smtp_pass']);
        $r = smtp_cmd($fp, 'AUTH LOGIN', 334);
        if ($r[0]) {
            $r = smtp_cmd($fp, base64_encode($user), 334);
        }
        if ($r[0]) {
            $r = smtp_cmd($fp, base64_encode($pass), 235);
        }
        if (!$r[0]) {
            fclose($fp);
            return [false, 'Usuário ou senha do SMTP recusados.'];
        }
    }
    $r = smtp_cmd($fp, 'MAIL FROM:<' . $fromEmail . '>', 250);
    if (!$r[0]) {
        fclose($fp);
        return [false, 'Remetente recusado: ' . $r[1]];
    }
    $r = smtp_cmd($fp, 'RCPT TO:<' . $to . '>', [250, 251]);
    if (!$r[0]) {
        fclose($fp);
        return [false, 'Destinatário recusado: ' . $r[1]];
    }
    $r = smtp_cmd($fp, 'DATA', 354);
    if (!$r[0]) {
        fclose($fp);
        return [false, 'O servidor recusou o envio: ' . $r[1]];
    }
    $message = implode("\r\n", $headers) . "\r\n\r\n" . $encodedBody;
    // Regra do protocolo: linha que começa com "." precisa ser dobrada.
    $message = preg_replace('/^\./m', '..', $message);
    fwrite($fp, $message . "\r\n.\r\n");
    $r = smtp_read($fp);
    if ($r[0] !== 250) {
        fclose($fp);
        return [false, 'O servidor não aceitou a mensagem: ' . $r[1]];
    }
    fwrite($fp, "QUIT\r\n");
    fclose($fp);
    return [true, ''];
}
