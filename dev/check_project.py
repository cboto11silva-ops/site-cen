#!/usr/bin/env python3
"""
Verificação estática do projeto do site da CEN (não precisa de PHP instalado).

Uso:  python3 check_project.py <pasta-do-projeto>

O que confere:
  1. PHP: parênteses/chaves/aspas balanceados, funções duplicadas, chamadas a funções
     que não existem no projeto e não são nativas conhecidas, recursos incompatíveis com PHP 7.4.
  2. content-schema.json: JSON válido, chaves únicas, tipos válidos, imagens padrão existentes,
     e todas as chaves C('...') usadas em site.js existem (e campos sem uso são avisados).
  3. Rotas: app/api.php x dev/mock-core.mjs (simulador) x chamadas api() do JavaScript.
  4. JavaScript: node --check em cada arquivo (se o Node existir).
  5. Segredos: config.php, installed.lock e uploads não podem estar na pasta a ser empacotada.

Saída: linhas ERRO (bloqueiam a entrega) e AVISO (revisar). Código de saída 1 se houver ERRO.
"""
import glob, json, os, re, shutil, subprocess, sys

if len(sys.argv) < 2:
    print(__doc__); sys.exit(2)
ROOT = os.path.abspath(sys.argv[1])
if not os.path.isfile(os.path.join(ROOT, 'app', 'api.php')):
    print(f'ERRO: {ROOT} não parece ser a raiz do projeto (falta app/api.php).'); sys.exit(2)

errors, warnings, oks = [], [], []
def err(m): errors.append(m)
def warn(m): warnings.append(m)
def ok(m): oks.append(m)
def rd(p): return open(os.path.join(ROOT, p), encoding='utf-8').read()

# ------------------------------------------------------------------ 1. PHP
NATIVE = set('''
PDO array_fill array_filter array_key_exists array_keys array_map array_merge array_shift array_slice array_unique array_values
base64_decode base64_encode bin2hex checkdate chmod chunk_split count date date_default_timezone_set define defined dirname
explode extension_loaded fclose fgets file_get_contents file_put_contents filemtime filter_var function_exists fwrite get_class
getimagesize hash hash_equals header headers_sent htmlspecialchars http_response_code imagealphablending imagecopyresampled
imagecreatefromjpeg imagecreatefrompng imagecreatefromwebp imagecreatetruecolor imagedestroy imagejpeg imagepng imagesavealpha
imagewebp implode in_array ini_get intval is_array is_dir is_file is_scalar is_string is_uploaded_file is_writable json_decode
json_encode mail max mb_internal_encoding mb_strlen mb_substr md5 min mkdir move_uploaded_file mt_rand openssl_decrypt
openssl_encrypt parse_url password_hash password_verify preg_match preg_match_all preg_replace preg_split random_bytes rawurldecode
rawurlencode round session_destroy session_get_cookie_params session_name session_regenerate_id session_set_cookie_params
session_start session_status set_exception_handler setcookie sprintf str_repeat str_replace strcasecmp stream_set_timeout
stream_socket_client stream_socket_enable_crypto strlen strncmp strpos strtolower strtoupper substr time trim ucfirst
unlink urlencode var_export usort sort ksort array_reverse array_search array_column array_flip is_numeric is_int is_bool
'''.split())
KW = set('if while foreach for switch function array list isset empty unset return catch elseif echo print exit die require '
         'require_once include include_once use declare and or not fn match'.split())
PHP74_BAD = [
    (r'\bmatch\s*\(', 'match() exige PHP 8.0'),
    (r'\bstr_contains\s*\(|\bstr_starts_with\s*\(|\bstr_ends_with\s*\(', 'str_contains/starts_with/ends_with exigem PHP 8.0 (use strpos ou starts_with() do projeto)'),
    (r'\?->', 'operador nullsafe ?-> exige PHP 8.0'),
    (r'\benum\s+\w+', 'enum exige PHP 8.1'),
    (r'\breadonly\b', 'readonly exige PHP 8.1/8.2'),
    (r'#\[', 'atributos #[...] exigem PHP 8.0'),
    (r'function\s+\w+\s*\([^)]*\b\w+\|\w+\s+\$', 'tipos união (A|B $x) exigem PHP 8.0'),
    (r':\s*mixed\b|\(\s*mixed\s+\$', 'tipo mixed exige PHP 8.0'),
]

def strip_php(src, fname):
    out, i, n, in_php, stack, line = [], 0, len(src), False, [], 1
    pairs = {')': '(', ']': '[', '}': '{'}
    while i < n:
        c = src[i]
        if not in_php:
            if src.startswith('<?php', i): in_php = True; i += 5; continue
            if src.startswith('<?=', i): in_php = True; i += 3; continue
            if c == '\n': line += 1
            i += 1; continue
        if src.startswith('?>', i): in_php = False; i += 2; continue
        if src.startswith('//', i) or c == '#':
            if c == '#' and src.startswith('#[', i): pass
            j = src.find('\n', i); i = n if j < 0 else j; continue
        if src.startswith('/*', i):
            j = src.find('*/', i + 2)
            if j < 0: err(f'{fname}:{line}: comentário /* sem fechar'); break
            line += src.count('\n', i, j); i = j + 2; continue
        if c in ('"', "'"):
            q, j, start = c, i + 1, line
            while j < n and src[j] != q:
                if src[j] == '\\': j += 1
                if j < n and src[j] == '\n': line += 1
                j += 1
            if j >= n: err(f'{fname}:{start}: string {q} sem fechar'); break
            out.append(' "" '); i = j + 1; continue
        if c == '\n': line += 1; out.append(c); i += 1; continue
        if c in '([{': stack.append((c, line))
        elif c in ')]}':
            if not stack or stack[-1][0] != pairs[c]:
                err(f'{fname}:{line}: "{c}" sem par correspondente')
            else: stack.pop()
        out.append(c); i += 1
    for c, l in stack: err(f'{fname}:{l}: "{c}" nunca foi fechado')
    return ''.join(out)

php_files = [f for f in glob.glob(ROOT + '/**/*.php', recursive=True) if '/dev/' not in f and '/docs/' not in f]
defined, called, defs_by_file = set(), {}, {}
codes = {}
for f in php_files:
    rel = os.path.relpath(f, ROOT)
    src = open(f, encoding='utf-8').read()
    for pat, why in PHP74_BAD:
        for m in re.finditer(pat, re.sub(r"(['\"]).*?\1", '""', src)):
            err(f'{rel}: incompatível com PHP 7.4 (mínimo do projeto): {why}')
            break
    codes[rel] = strip_php(src, rel)
    for m in re.finditer(r'^\s*function\s+&?(\w+)\s*\(', src, re.M):
        defs_by_file.setdefault(m.group(1), []).append(rel); defined.add(m.group(1))
for name, files in defs_by_file.items():
    if len(files) > 1: err(f'função duplicada "{name}" em {files}')
for rel, code in codes.items():
    for m in re.finditer(r'(?<![\w$>:\\])(\w+)\s*\(', code):
        nm = m.group(1)
        if nm in KW or nm in defined or nm in NATIVE: continue
        called.setdefault(nm, set()).add(rel)
for nm, files in sorted(called.items()):
    warn(f'chamada a "{nm}()" ({", ".join(sorted(files))}) não existe no projeto e não está na lista de nativas: confira se é função do PHP')
ok(f'PHP: {len(php_files)} arquivos, {len(defined)} funções analisadas')

# ------------------------------------------------------------------ 2. content-schema.json
try:
    schema = json.loads(rd('app/content-schema.json'))
    keys, valid_types = [], {'text', 'textarea', 'url', 'image'}
    for g in schema['groups']:
        for f in g['fields']:
            keys.append(f['key'])
            if f['type'] not in valid_types: err(f'schema: campo {f["key"]} com tipo inválido "{f["type"]}"')
            if f['type'] == 'image' and str(f['default']).startswith('/assets/'):
                if not os.path.isfile(ROOT + f['default']): err(f'schema: imagem padrão inexistente {f["default"]} (campo {f["key"]})')
    dup = {k for k in keys if keys.count(k) > 1}
    if dup: err(f'schema: chaves duplicadas {sorted(dup)}')
    for name, rows in schema.get('collections', {}).items():
        for r in rows:
            for k in ('image', 'photo'):
                if r.get(k, '').startswith('/assets/') and not os.path.isfile(ROOT + r[k]):
                    err(f'schema: imagem inexistente em collections.{name}: {r[k]}')
    js = rd('assets/js/site.js')
    used_exact = set(re.findall(r"\bC\('([^'+]+)'\)", js))
    used_prefix = set(re.findall(r"\bC\('([^']+)'\s*\+", js))
    for k in sorted(used_exact):
        if k not in keys: err(f'site.js usa C("{k}") mas o campo não existe no content-schema.json')
    for p in used_prefix:
        if re.match(r'^[a-z]+\.', p) and not any(k.startswith(p) for k in keys): err(f'site.js usa prefixo C("{p}"+…) sem campos correspondentes')
    page_keys_meta = re.findall(r"(?:title|text):\s*'([a-z]+\.[\w.]+)'", js)
    for k in page_keys_meta:
        if k not in keys: err(f'site.js (PAGES) referencia campo inexistente {k}')
    idx = rd('index.php')
    for k in re.findall(r"'((?:[a-z]+)\.[\w.]+)'", idx):
        if k not in keys and '.' in k and k.split('.')[0] in {'home', 'events', 'pastors', 'giving', 'prayer', 'member', 'seo', 'site', 'social', 'contact'}:
            err(f'index.php referencia campo inexistente {k}')
    unused = [k for k in keys if k not in used_exact and not any(k.startswith(p) for p in used_prefix) and k not in idx and k not in page_keys_meta]
    if unused: warn(f'schema: campos que nenhum código usa (aparecem no painel sem efeito no site): {unused}')
    ok(f'content-schema.json: {len(keys)} campos, {len(schema["groups"])} grupos')
except Exception as e:
    err(f'content-schema.json: {e}')

# ------------------------------------------------------------------ 3. rotas
api = rd('app/api.php')
php_routes = set(re.findall(r"\['(GET|POST|PUT|DELETE)',\s+'([^']+)',\s+'(h_\w+)',\s+'(\w+)'\]", api))
for m, p, h, a in php_routes:
    if h not in defined: err(f'api.php: handler {h} da rota {m} {p} não existe')
patterns = [(m, re.compile('^' + re.sub(r'\{[a-z]+\}', '[^/]+', p) + '$')) for m, p, h, a in php_routes]
mock_path = os.path.join(ROOT, 'dev', 'mock-core.mjs')
if not os.path.isfile(mock_path):
    mock_path = os.path.join(ROOT, 'dev', 'mock-server.mjs')
if os.path.isfile(mock_path):
    mock = open(mock_path, encoding='utf-8').read()
    block = mock.split('const ROUTES = [')[1].split('];')[0]
    mock_routes = set(re.findall(r"\['(GET|POST|PUT|DELETE)', '([^']+)', '(\w+)'\]", block))
    php_set = {(m, p, a) for m, p, h, a in php_routes}
    for r in sorted(php_set - mock_routes): err(f'rota só no PHP (falta no simulador dev/mock-core.mjs): {r}')
    for r in sorted(mock_routes - php_set): err(f'rota só no simulador (falta no PHP): {r}')
def first_arg(src, start):
    depth, i, q, buf = 0, start, None, ''
    while i < len(src):
        c = src[i]
        if q:
            buf += c
            if c == q and src[i - 1] != '\\': q = None
        elif c in '\'"`': q = c; buf += c
        elif c in '([{': depth += 1; buf += c
        elif c in ')]}':
            if depth == 0: break
            depth -= 1; buf += c
        elif c == ',' and depth == 0: break
        else: buf += c
        i += 1
    return buf.strip()
seen = 0
for f in ('assets/js/site.js', 'assets/js/admin.js'):
    src = rd(f)
    for m in re.finditer(r'\bapi\(', src):
        arg = first_arg(src, m.end())
        if not arg or arg == 'path' or arg.startswith('path,'): continue
        parts = re.findall(r"'([^']*)'|`([^`]*)`|([^+\s][^+]*)", arg)
        path = ''.join((a or b) if (a or b) else ('X' if c.strip() else '') for a, b, c in parts).split('?')[0]
        mm = re.search(r"method:\s*'(\w+)'", src[m.end():m.end() + len(arg) + 120])
        method = mm.group(1) if mm else 'GET'
        seen += 1
        if not any(pm == method and rx.match(path) for pm, rx in patterns):
            err(f'{f}: chamada api("{path}") [{method}] sem rota correspondente em app/api.php')
ok(f'Rotas: {len(php_routes)} no PHP; {seen} chamadas api() conferidas')

# ------------------------------------------------------------------ 4. JS
node = shutil.which('node')
if node:
    for f in sorted(glob.glob(ROOT + '/assets/js/*.js') + glob.glob(ROOT + '/dev/*.mjs')):
        r = subprocess.run([node, '--check', f], capture_output=True, text=True)
        if r.returncode: err(f'JS {os.path.relpath(f, ROOT)}: {r.stderr.strip().splitlines()[0] if r.stderr else "erro de sintaxe"}')
    ok('JavaScript: sintaxe conferida com node --check')
else:
    warn('Node não encontrado: sintaxe do JavaScript não foi conferida')

# ------------------------------------------------------------------ 5. segredos e arquivos que não podem ir no pacote
for rel in ('config.php', 'storage/installed.lock'):
    if os.path.exists(os.path.join(ROOT, rel)): err(f'{rel} existe na pasta: remova antes de empacotar/enviar ao GitHub')
ups = [f for f in glob.glob(ROOT + '/uploads/**/*', recursive=True) if os.path.isfile(f) and os.path.basename(f) not in ('.gitkeep', '.htaccess')]
if ups: err(f'uploads/ contém {len(ups)} arquivo(s) de teste: apague antes de empacotar')
logs = [f for f in glob.glob(ROOT + '/storage/logs/*') if os.path.basename(f) != '.gitkeep']
if logs: warn('storage/logs contém logs: apague antes de empacotar')
for rel in ('.htaccess', 'app/.htaccess', 'storage/.htaccess', 'uploads/.htaccess', '.gitignore'):
    if not os.path.isfile(os.path.join(ROOT, rel)): err(f'arquivo obrigatório ausente: {rel}')

print('\n'.join('OK    ' + m for m in oks))
print('\n'.join('AVISO ' + m for m in warnings))
print('\n'.join('ERRO  ' + m for m in errors))
print(f'\nResumo: {len(errors)} erro(s), {len(warnings)} aviso(s)')
sys.exit(1 if errors else 0)
