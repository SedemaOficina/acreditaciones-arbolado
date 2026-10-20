// D4 · Peso de la primera carga de cada pantalla (auditoría 20/10/2026, r5). Repetible.
// Para cada una de las 21 pantallas, en un contexto nuevo (sin caché), registra con CDP cada respuesta: bytes
// transferidos (encodedDataLength), bytes sin comprimir (archivo en disco) y una estimación con gzip -6 y brotli -11
// de cada archivo de texto (el servidor de prueba no comprime). Clasifica: propio, propio solo de prueba, estándar,
// vendor/pdf.js, fuentes, imágenes, datos/ficticios.json. Espera a que la red quede quieta 1.5 s.
//   node d4-peso.mjs [ficticios|volumen]  → d4-peso-<escenario>.json y .md
import { chromium } from '/home/claude/trabajo/aud20-r5/node_modules/playwright/index.mjs';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { gzipSync, brotliCompressSync, constants } from 'node:zlib';
import { join } from 'node:path';
import { PAGINAS, BASE, CHROMIUM, RAIZ, EVID, sesionInit, volumen } from './comun.mjs';

const ESC = process.argv[2] || 'ficticios';
const PRUEBA = /app\/(archivos-prueba|casos-prueba|pruebas|version-visible)\.js|datos\/(ficticios\.json|examen-ficticio\.js|catalogos\.js)|^VERSION$/;
const TEXTO = /\.(html|css|js|mjs|json|svg|txt)$|VERSION$/;
const comp = new Map();
function compresion(ruta) {
  if (comp.has(ruta)) return comp.get(ruta);
  const f = join(RAIZ, 'sitio', ruta);
  let r = { disco: 0, gzip: 0, br: 0 };
  if (existsSync(f)) {
    const b = readFileSync(f);
    r = TEXTO.test(ruta)
      ? { disco: b.length, gzip: gzipSync(b, { level: 6 }).length, br: brotliCompressSync(b, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } }).length }
      : { disco: b.length, gzip: b.length, br: b.length };
  }
  comp.set(ruta, r);
  return r;
}
const clase = (ruta, tipo) => {
  if (/datos\/ficticios\.json/.test(ruta)) return 'ficticios.json';
  if (/^vendor\//.test(ruta)) return 'vendor/pdf.js';
  if (/\.woff2?$|\.ttf$|\.pfb$/.test(ruta) || tipo === 'Font') return 'fuentes';
  if (/\.(png|jpe?g|svg|webp|gif)$/.test(ruta) || tipo === 'Image') return 'imágenes';
  if (/^formkit\//.test(ruta)) return 'estándar';
  if (PRUEBA.test(ruta)) return 'propio (solo prueba)';
  return 'propio';
};

const vol = ESC === 'volumen' ? volumen() : null;
const nav = await chromium.launch({ executablePath: CHROMIUM });
const res = [];
for (const [nombre, publico, ruta, sesion] of PAGINAS) {
  for (const [tam, vista] of [['telefono', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }], ['escritorio', { viewport: { width: 1280, height: 900 } }]]) {
    const ctx = await nav.newContext({ ...vista, locale: 'es-MX', timezoneId: 'America/Mexico_City' });
    if (sesion) await ctx.addInitScript(sesionInit, sesion);
    if (vol) await ctx.route('**/datos/ficticios.json*', (r) => r.fulfill({ body: vol.cuerpo, contentType: 'application/json' }));
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    const pet = new Map();
    cdp.on('Network.responseReceived', (e) => { pet.set(e.requestId, { url: e.response.url, tipo: e.type, estado: e.response.status, mime: e.response.mimeType, transf: 0, dec: 0 }); });
    cdp.on('Network.dataReceived', (e) => { const p = pet.get(e.requestId); if (p) p.dec += e.dataLength; });
    cdp.on('Network.loadingFinished', (e) => { const p = pet.get(e.requestId); if (p) p.transf = e.encodedDataLength; });
    const workers = [];
    page.on('worker', (w) => workers.push(w.url()));
    await page.goto(BASE + ruta, { waitUntil: 'load' });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    const filas = [];
    for (const p of pet.values()) {
      if (!p.url.startsWith(BASE)) { filas.push({ ruta: p.url, clase: 'externo', transf: p.transf, disco: p.dec, gzip: p.dec, br: p.dec }); continue; }
      const r = decodeURIComponent(new URL(p.url).pathname.slice(1)) || 'index.html';
      const c = compresion(r);
      // Con el escenario de volumen, ficticios.json lo sirve la ruta (su tamaño es el del escenario)
      const disco = /ficticios\.json/.test(r) && vol ? vol.cuerpo.length : c.disco || p.dec;
      const gz = /ficticios\.json/.test(r) && vol ? gzipSync(vol.cuerpo, { level: 6 }).length : c.gzip || p.dec;
      const br = /ficticios\.json/.test(r) && vol ? brotliCompressSync(vol.cuerpo).length : c.br || p.dec;
      filas.push({ ruta: r, clase: clase(r, p.tipo), estado: p.estado, transf: p.transf, disco, gzip: gz, br });
    }
    // Los workers (pdf.worker.min.mjs del visor) no salen en la sesión CDP de la página: se agregan con su tamaño en disco
    for (const w of workers) { if (!w.startsWith(BASE)) continue; const r = new URL(w).pathname.slice(1); const c = compresion(r); filas.push({ ruta: r + ' (worker)', clase: clase(r, 'Script'), estado: 200, transf: c.disco, disco: c.disco, gzip: c.gzip, br: c.br }); }
    const suma = (k, f = () => true) => filas.filter(f).reduce((a, x) => a + (x[k] || 0), 0);
    const porClase = {};
    for (const f of filas) { const c = (porClase[f.clase] ||= { n: 0, transf: 0, disco: 0, gzip: 0, br: 0 }); c.n++; for (const k of ['transf', 'disco', 'gzip', 'br']) c[k] += f[k] || 0; }
    res.push({ pantalla: nombre, publico, tam, url: page.url().replace(BASE, ''), peticiones: filas.length, transf: suma('transf'), disco: suma('disco'), gzip: suma('gzip'), br: suma('br'),
      sinPrueba: { disco: suma('disco', (f) => f.clase !== 'propio (solo prueba)' && f.clase !== 'ficticios.json'), gzip: suma('gzip', (f) => f.clase !== 'propio (solo prueba)' && f.clase !== 'ficticios.json'), br: suma('br', (f) => f.clase !== 'propio (solo prueba)' && f.clase !== 'ficticios.json') },
      porClase, filas });
    await ctx.close();
  }
}
await nav.close();
writeFileSync(join(EVID, `d4-peso-${ESC}.json`), JSON.stringify(res, null, 1));
const kb = (n) => (n / 1024).toFixed(1);
let md = `# D4 · Peso de la primera carga (${ESC})\n\nKB = 1024 bytes. «Sin comprimir» = bytes del archivo; «gzip» y «br» = estimación (cada archivo de texto comprimido por separado; binarios sin cambio). «Sin prueba» quita lo que solo existe en la versión de prueba (ficticios.json, archivos-prueba, casos-prueba, pruebas, version-visible, catalogos y examen ficticios, VERSION).\n\n`;
md += '| Pantalla | Ancho | Peticiones | Transferido (servidor de prueba) | Sin comprimir | gzip | brotli | Sin prueba: sin comprimir | Sin prueba: gzip | Sin prueba: brotli |\n|---|---|---|---|---|---|---|---|---|---|\n';
for (const r of res) md += `| ${r.pantalla} | ${r.tam} | ${r.peticiones} | ${kb(r.transf)} | ${kb(r.disco)} | ${kb(r.gzip)} | ${kb(r.br)} | ${kb(r.sinPrueba.disco)} | ${kb(r.sinPrueba.gzip)} | ${kb(r.sinPrueba.br)} |\n`;
md += '\n## Por clase (teléfono)\n\n| Pantalla | ' + ['propio', 'propio (solo prueba)', 'estándar', 'vendor/pdf.js', 'fuentes', 'imágenes', 'ficticios.json', 'externo'].join(' | ') + ' |\n|---|---|---|---|---|---|---|---|---|\n';
for (const r of res.filter((x) => x.tam === 'telefono')) md += `| ${r.pantalla} | ` + ['propio', 'propio (solo prueba)', 'estándar', 'vendor/pdf.js', 'fuentes', 'imágenes', 'ficticios.json', 'externo'].map((c) => (r.porClase[c] ? `${r.porClase[c].n} · ${kb(r.porClase[c].disco)} (${kb(r.porClase[c].gzip)} gz)` : '—')).join(' | ') + ' |\n';
writeFileSync(join(EVID, `d4-peso-${ESC}.md`), md);
console.log(md);
