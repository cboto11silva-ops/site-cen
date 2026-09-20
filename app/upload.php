<?php
/** Upload de imagens enviadas pelo painel. */

const UPLOAD_MAX_BYTES = 8388608; // 8 MB
const UPLOAD_MAX_WIDTH = 1800;

/**
 * Valida e salva a imagem em /uploads/AAAA/MM/. Devolve o caminho público (ex.: /uploads/2026/09/ab12.jpg).
 */
function handle_image_upload($file)
{
    if (!is_array($file) || !isset($file['error']) || $file['error'] !== UPLOAD_ERR_OK) {
        $code = is_array($file) && isset($file['error']) ? (int) $file['error'] : -1;
        if ($code === UPLOAD_ERR_INI_SIZE || $code === UPLOAD_ERR_FORM_SIZE) {
            fail('A imagem é grande demais. Envie um arquivo de até 8 MB.', 413);
        }
        fail('Não foi possível receber a imagem. Tente novamente.');
    }
    if ($file['size'] > UPLOAD_MAX_BYTES) {
        fail('A imagem é grande demais. Envie um arquivo de até 8 MB.', 413);
    }
    if (!is_uploaded_file($file['tmp_name'])) {
        fail('Envio inválido.');
    }
    $info = @getimagesize($file['tmp_name']);
    if ($info === false) {
        fail('O arquivo enviado não é uma imagem válida.');
    }
    $map = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];
    $mime = $info['mime'];
    if (!isset($map[$mime])) {
        fail('Formato não aceito. Envie JPG, PNG, WEBP ou GIF.');
    }
    if ($info[0] > 8000 || $info[1] > 8000) {
        fail('A imagem tem dimensões grandes demais (máximo 8000 pixels).');
    }
    $ext = $map[$mime];
    $sub = date('Y') . '/' . date('m');
    $dir = APP_ROOT . '/uploads/' . $sub;
    if (!is_dir($dir) && !@mkdir($dir, 0755, true)) {
        fail('Não foi possível criar a pasta de imagens no servidor. Verifique as permissões da pasta uploads.', 500);
    }
    $name = bin2hex(random_bytes(8)) . '.' . $ext;
    $target = $dir . '/' . $name;

    $done = false;
    if (function_exists('imagecreatetruecolor') && $mime !== 'image/gif') {
        $done = resize_and_save($file['tmp_name'], $mime, $info, $target);
    }
    if (!$done && !@move_uploaded_file($file['tmp_name'], $target)) {
        fail('Não foi possível salvar a imagem no servidor.', 500);
    }
    @chmod($target, 0644);
    return '/uploads/' . $sub . '/' . $name;
}

/** Reduz imagens muito largas e regrava o arquivo (remove metadados). */
function resize_and_save($tmp, $mime, $info, $target)
{
    if ($mime === 'image/jpeg' && function_exists('imagecreatefromjpeg')) {
        $src = @imagecreatefromjpeg($tmp);
    } elseif ($mime === 'image/png' && function_exists('imagecreatefrompng')) {
        $src = @imagecreatefrompng($tmp);
    } elseif ($mime === 'image/webp' && function_exists('imagecreatefromwebp')) {
        $src = @imagecreatefromwebp($tmp);
    } else {
        return false;
    }
    if (!$src) {
        return false;
    }
    $w = (int) $info[0];
    $h = (int) $info[1];
    $nw = $w;
    $nh = $h;
    if ($w > UPLOAD_MAX_WIDTH) {
        $nw = UPLOAD_MAX_WIDTH;
        $nh = (int) round($h * (UPLOAD_MAX_WIDTH / $w));
    }
    $dst = imagecreatetruecolor($nw, $nh);
    if ($mime !== 'image/jpeg') {
        imagealphablending($dst, false);
        imagesavealpha($dst, true);
    }
    imagecopyresampled($dst, $src, 0, 0, 0, 0, $nw, $nh, $w, $h);
    if ($mime === 'image/jpeg') {
        $ok = imagejpeg($dst, $target, 86);
    } elseif ($mime === 'image/png') {
        $ok = imagepng($dst, $target, 6);
    } else {
        $ok = function_exists('imagewebp') ? imagewebp($dst, $target, 86) : false;
    }
    imagedestroy($src);
    imagedestroy($dst);
    return (bool) $ok;
}
