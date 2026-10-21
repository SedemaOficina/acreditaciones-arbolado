// Servidor estático de r5 para D4 (sólo lectura de sitio/): igual que python -m http.server (sin Cache-Control, con
// Last-Modified), pero con HTTP/1.1 y, si la petición trae la cabecera «x-r5-comprimir: gzip» o «br», comprime los
// archivos de texto como lo haría el servidor del SIA. Así se mide lo mismo con y sin compresión en el mismo servidor.
//   node servidor-r5.mjs 8905 /home/claude/trabajo/aud20-r5/sitio
import { createServer } from 'node:http';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import { join, extname, normalize } from 'node:path';

const [, , PUERTO = '8905', RAIZ = '/home/claude/trabajo/aud20-r5/sitio'] = process.argv;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.pdf': 'application/pdf', '.woff2': 'font/woff2',
  '.ttf': 'font/ttf', '.pfb': 'application/octet-stream', '.txt': 'text/plain; charset=utf-8', '': 'application/octet-stream' };
const TEXTO = /\.(html|css|js|mjs|json|svg|txt)$|VERSION$/;
const cache = new Map();
createServer((req, res) => {
  let ruta = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  // Prefijos de la dirección (en vez de cabeceras, que en Chromium apagan el escáner de precarga y falsean la medida):
  //   /vol/… datos del escenario de volumen · /gz/… o /br/… comprime los archivos de texto
  let pref = { vol: false, modo: '' };
  //   /gzs/… comprime todo menos el HTML (control de la medida)
  for (;;) {
    const m = ruta.match(/^\/(vol|gzs|gz|br)(\/.*)$/); if (!m) break;
    if (m[1] === 'vol') pref.vol = true; else if (m[1] === 'gzs') { pref.modo = 'gzip'; pref.sinHtml = true; } else pref.modo = m[1] === 'gz' ? 'gzip' : 'br';
    ruta = m[2];
  }
  if (ruta.endsWith('/')) ruta += 'index.html';
  let f = normalize(join(RAIZ, ruta));
  // Escenario de volumen: con «x-r5-volumen: 1» los datos ficticios son los del escenario (volumen.json de r5)
  if ((pref.vol || req.headers['x-r5-volumen']) && ruta === '/datos/ficticios.json') f = '/home/claude/trabajo/evidencia-2026-10-20/r5/volumen.json';
  if ((!f.startsWith(RAIZ) && !f.endsWith('/r5/volumen.json')) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); res.end('404'); return; }
  const st = statSync(f);
  const modo = pref.modo || req.headers['x-r5-comprimir'];
  let cuerpo = readFileSync(f);
  const cab = { 'Content-Type': TIPOS[extname(f)] || TIPOS[''], 'Last-Modified': st.mtime.toUTCString() };
  if (modo && TEXTO.test(f) && !(pref.sinHtml && f.endsWith('.html'))) {
    const k = `${modo}:${f}`;
    if (!cache.has(k)) cache.set(k, modo === 'br' ? brotliCompressSync(cuerpo, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }) : gzipSync(cuerpo, { level: 6 }));
    cuerpo = cache.get(k); cab['Content-Encoding'] = modo === 'br' ? 'br' : 'gzip'; cab.Vary = 'Accept-Encoding';
  }
  cab['Content-Length'] = cuerpo.length;
  res.writeHead(200, cab); res.end(req.method === 'HEAD' ? undefined : cuerpo);
}).listen(Number(PUERTO), () => console.log(`r5 sirve ${RAIZ} en ${PUERTO}`));
