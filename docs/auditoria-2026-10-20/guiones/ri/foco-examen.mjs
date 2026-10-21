// ri · Examen en el salón (examen.html): recorre con Tab hacia adelante y con Shift+Tab hacia atrás la pantalla de la
// pregunta y la de revisión, y mide con la misma función de foco-recorrido.mjs si la barra pegajosa del examen
// (.examen-barra, position:sticky; top:0) o el botón del menú de pruebas tapan el elemento enfocado.
// Pasa lista en aplicar.html?folio=APD-G-2026-003 (mismo contexto) para obtener un código, como probar-examen.mjs.
// Uso: node foco-examen.mjs <BASE>
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const BASE = (process.argv[2] || 'http://localhost:8906/').replace(/\/?$/, '/');
const fuente = readFileSync(new URL('./foco-recorrido.mjs', import.meta.url), 'utf8');
const MIDE = fuente.slice(fuente.indexOf('function mide() {'), fuente.indexOf('\nfunction candidatosFijos'));
const CAND = fuente.slice(fuente.indexOf('function candidatosFijos() {'), fuente.indexOf('\nconst navegador'));
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const salida = [];
for (const [w, h] of [[1440, 900], [1280, 720], [1024, 768], [390, 844]]) for (let ronda = 1; ronda <= 2; ronda++) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, locale: 'es-MX', timezoneId: 'America/Mexico_City' });
  const ap = await ctx.newPage();
  await ap.goto(`${BASE}aplicar.html?folio=APD-G-2026-003`, { waitUntil: 'networkidle' });
  const boton = ap.locator('[data-accion="presente"]', { hasText: /^Presente$/ }).first();
  const ins = await boton.getAttribute('data-ins');
  await boton.click();
  await ap.waitForSelector(`tr[data-ins="${ins}"] .examen-codigo`);
  const codigo = (await ap.textContent(`tr[data-ins="${ins}"] .examen-codigo`)).trim();
  const ex = await ctx.newPage();
  await ex.goto(`${BASE}examen.html`, { waitUntil: 'networkidle' });
  await ex.fill('#codigo', codigo);
  await ex.click('#entrar [data-accion="enviar"]');
  await ex.waitForSelector('[data-vista="confirmar"]:not([hidden])');
  await ex.click('[data-ir-vista="instrucciones"]');
  await ex.waitForSelector('[data-vista="instrucciones"]:not([hidden])');
  await ex.click('[data-empezar]');
  await ex.waitForSelector('[data-vista="pregunta"]:not([hidden])');
  await ex.waitForTimeout(500);
  await ex.evaluate(`window.__riMide = ${MIDE}; window.__riCand = ${CAND};`);
  await ex.evaluate(() => window.__riCand());
  const reg = { tam: `${w}x${h}`, ronda, paradas: [] };
  for (const [dir, tecla] of [['adelante', 'Tab'], ['atrás', 'Shift+Tab']]) {
    for (let k = 0; k < 40; k++) {
      await ex.keyboard.press(tecla);
      const m = await ex.evaluate(async () => { await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); return window.__riMide(); });
      if (m.cuerpo) continue;
      m.dir = dir;
      reg.paradas.push(m);
      if (m.total || m.parcial) { if (!reg.cap && ronda === 1) { reg.cap = `examen-${w}x${h}-${dir}-${k}.png`; await ex.screenshot({ path: `capturas/${reg.cap}` }); } }
    }
  }
  const t = reg.paradas.filter((p) => p.total).length, q = reg.paradas.filter((p) => p.parcial).length;
  const quien = [...new Set(reg.paradas.filter((p) => p.total || p.parcial).flatMap((p) => p.porQuien.map((x) => x.replace(/«.*»/, '').replace(/ ×\d+/, ''))))];
  console.log(`${w}x${h} ronda ${ronda}: paradas ${reg.paradas.length} · ocultas total ${t} · parcial ${q} · ${quien.join('; ')} · fijos: ${(await ex.evaluate(() => window.__riFijos.map((x) => x.className))).join(', ')}`);
  for (const p of reg.paradas.filter((x) => x.total || x.parcial).slice(0, 4)) console.log(`   ${p.dir} ${p.el} ${JSON.stringify(p.rect)} ${p.tapadosFijo}/${p.puntos}`);
  salida.push(reg);
  await ctx.close();
}
await b.close();
writeFileSync('salidas/foco-examen.json', JSON.stringify(salida, null, 1));
