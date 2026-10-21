// D4 · Tiempo hasta que cada pantalla es usable, con red y procesador lentos (CDP), primera carga sin caché.
// Métricas (desde el inicio de la navegación, en ms):
//   FCP  primer contenido pintado;  carga  evento load;
//   usable  último cambio del DOM antes de 1.5 s de calma (con la red quieta), o el fin de la última tarea larga si es
//           posterior: es cuando la pantalla terminó de pintar sus datos y deja de estar ocupada;
//   TBT  suma de lo que exceden 50 ms las tareas largas (tiempo bloqueado: la pantalla no responde).
// Uso: node d4-tiempos.mjs <escenario: ficticios|volumen> <red: 3g|4g|sin> <cpu: 1|4|6> [pantallas,separadas] [repeticiones] [base]
import { chromium } from '/home/claude/trabajo/aud20-r5/node_modules/playwright/index.mjs';
import { appendFileSync } from 'node:fs';
import { PAGINAS, BASE as BASE0, CHROMIUM, EVID, sesionInit, volumen } from './comun.mjs';

const [ESC = 'ficticios', RED = '4g', CPU = '4', SOLO = '', REP = '1', BASEARG = ''] = process.argv.slice(2);
const BASE = BASEARG || BASE0;
// Perfiles de red de Chrome DevTools / Lighthouse (valores ya ajustados como los aplica DevTools):
//   3G lento («Slow 3G»): latencia 2000 ms, 400 kbit/s de bajada y de subida.
//   4G lento («Slow 4G», el perfil móvil de Lighthouse): latencia 562.5 ms (RTT 150 × 3.75), 1474.56 kbit/s de bajada, 675 kbit/s de subida.
const REDES = {
  '3g': { offline: false, latency: 2000, downloadThroughput: 50000, uploadThroughput: 50000, connectionType: 'cellular3g' },
  '4g': { offline: false, latency: 562.5, downloadThroughput: 1474.56 * 1000 / 8, uploadThroughput: 675 * 1000 / 8, connectionType: 'cellular4g' },
  sin: null
};
const vol = ESC === 'volumen' ? volumen() : null;
const lista = PAGINAS.filter((p) => !SOLO || SOLO.split(',').includes(p[0]));
const nav = await chromium.launch({ executablePath: CHROMIUM });
const sonda = () => {
  window.__t = { muts: 0, ultimo: 0, largas: [], lcp: 0 };
  new MutationObserver(() => { window.__t.muts++; window.__t.ultimo = performance.now(); }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__t.largas.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true }); } catch (e) { /* */ }
  try { new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__t.lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch (e) { /* */ }
};
for (let rep = 1; rep <= Number(REP); rep++) {
  for (const [nombre, publico, ruta, sesion] of lista) {
    const movil = publico === 'persona';
    const ctx = await nav.newContext({ viewport: movil ? { width: 390, height: 844 } : { width: 1280, height: 900 }, isMobile: movil, hasTouch: movil, timezoneId: 'America/Mexico_City', locale: 'es-MX' });
    if (sesion) await ctx.addInitScript(sesionInit, sesion);
    await ctx.addInitScript(sonda);
    // Volumen y compresión los da servidor-r5.mjs según cabeceras (así pasan por la red simulada, como en la realidad)
    // (por prefijo de la dirección: /vol/ y /gz/; con cabeceras extra Chromium no precargaba los scripts)
    const PRE = `${vol ? 'vol/' : ''}${({ gzip: 'gz/', br: 'br/', gzs: 'gzs/' })[process.env.COMPRIMIR] || ''}`;
    const page = await ctx.newPage();
    // Calibración: el equipo es compartido; se mide un cálculo fijo sin freno antes de cada carga (ms) y la carga del equipo
    await page.goto('about:blank');
    const calib = await page.evaluate(() => { const t = performance.now(); let x = 0; for (let i = 0; i < 3e7; i++) x += i % 7; return Math.round(performance.now() - t) + (x < 0 ? 1 : 0); });
    const cargaEquipo = (await import('node:os')).loadavg()[0].toFixed(1);
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    if (REDES[RED]) await cdp.send('Network.emulateNetworkConditions', REDES[RED]);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(CPU) });
    const t0 = Date.now();
    let error = '';
    try {
      await page.goto(BASE + PRE + ruta, { waitUntil: 'load', timeout: 240000 });
      await page.waitForLoadState('networkidle', { timeout: 240000 });
      // calma: 1.5 s sin cambios en el DOM
      for (let i = 0; i < 60; i++) {
        const a = await page.evaluate(() => window.__t.muts);
        await page.waitForTimeout(1500);
        if ((await page.evaluate(() => window.__t.muts)) === a) break;
      }
    } catch (e) { error = String(e.message || e).split('\n')[0]; }
    const m = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] || {};
      const fcp = (performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime || 0;
      const largas = window.__t.largas;
      const finLarga = largas.reduce((a, [s, d]) => Math.max(a, s + d), 0);
      const tbt = largas.reduce((a, [, d]) => a + Math.max(0, d - 50), 0);
      const txt = document.body ? document.body.innerText : '';
      return { fcp: Math.round(fcp), lcp: Math.round(window.__t.lcp), dcl: Math.round(nav.domContentLoadedEventEnd || 0), carga: Math.round(nav.loadEventEnd || 0),
        usable: Math.round(Math.max(window.__t.ultimo, finLarga)), tbt: Math.round(tbt), largas: largas.length, maxLarga: Math.round(Math.max(0, ...largas.map((x) => x[1]))),
        fallo: /No se pudo cargar|Cargando/.test(txt.slice(0, 4000)) ? (txt.match(/(No se pudo cargar[^\n]*|Cargando[^\n]*)/) || [''])[0] : '' };
    }).catch((e) => ({ error: String(e) }));
    const fila = { esc: ESC, comp: process.env.COMPRIMIR || 'no', red: RED, cpu: Number(CPU), rep: Number(process.env.REPN || rep), pantalla: nombre, ancho: movil ? 390 : 1280, calib, cargaEquipo, ...m, pared: Date.now() - t0, error };
    console.log(JSON.stringify(fila));
    appendFileSync(`${EVID}/d4-tiempos.jsonl`, JSON.stringify(fila) + '\n');
    await ctx.close();
  }
}
await nav.close();
