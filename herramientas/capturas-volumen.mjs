// Capturas de las pantallas del personal con el escenario de volumen real (volumen.json servido en lugar de ficticios.json)
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

// Uso: node herramientas/capturas-volumen.mjs <carpeta con volumen.json> (con el sitio servido en el puerto 8765)
// volumen.json lo genera herramientas/escenario-volumen.mjs.
const DIR = process.argv[2] || '.';
const CAP = join(DIR, 'capturas');
mkdirSync(CAP, { recursive: true });
const datos = readFileSync(join(DIR, 'volumen.json'));
const d = JSON.parse(datos);
const BASE = 'http://localhost:8765/';
const enviada = d.solicitud.filter((s) => s.estado === 'enviada' && s.folio >= 'APD-S-2026-00500')[0].folio;
const cita = d.solicitud.filter((s) => s.estado === 'validada_en_linea' && s.cita_en && s.cita_en.startsWith(d.fecha_corte) && s.folio >= 'APD-S-2026-00500')[0].folio;
const PANTALLAS = [
  ['revision', 'revision.html'], ['revisar', `revisar.html?folio=${enviada}`], ['citas', 'citas.html'], ['cotejo', `cotejo.html?folio=${cita}`],
  ['grupos', 'grupos.html'], ['grupos-poda-renov', 'grupos.html?curso=poda-renovacion'], ['programar-poda-nueva', 'programar.html?curso=poda-nueva'],
  ['grupo-confirmado', 'grupo.html?folio=APD-G-2026-023'], ['grupo-integracion', 'grupo.html?folio=APD-G-2026-022'], ['grupo-en-curso', 'grupo.html?folio=APD-G-2026-020'],
  ['asistencia', 'asistencia.html?folio=APD-G-2026-020'], ['aplicar', 'aplicar.html']
];
const navegador = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
for (const [tam, vp] of [['telefono', { width: 390, height: 844 }], ['escritorio', { width: 1280, height: 900 }]]) {
  const ctx = await navegador.newContext({ viewport: vp, locale: 'es-MX', timezoneId: 'America/Mexico_City' });
  await ctx.route('**/datos/ficticios.json*', (r) => r.fulfill({ body: datos, contentType: 'application/json' }));
  const p = await ctx.newPage();
  const errores = [];
  p.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  p.on('pageerror', (e) => errores.push(String(e)));
  for (const [nombre, url] of PANTALLAS) {
    await p.goto(BASE + url);
    await p.waitForTimeout(1500);
    const alto = await p.evaluate(() => document.documentElement.scrollHeight);
    await p.screenshot({ path: join(CAP, `${nombre}-${tam}.png`), fullPage: true });
    console.log(`${tam} ${nombre}: alto ${alto}px (${(alto / vp.height).toFixed(1)} pantallas)${errores.length ? ' · errores: ' + errores.splice(0).join(' | ').slice(0, 200) : ''}`);
  }
  await ctx.close();
}
await navegador.close();
console.log('revisar', enviada, 'cotejo', cita);
