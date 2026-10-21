// D4 · Respuesta a la interacción en las pantallas del personal con el escenario de volumen (y una del examen):
// duración de cada evento (Event Timing: de la entrada a que se pinta lo siguiente) con el procesador 4× y 6× más lento.
// Referencia: INP «bueno» ≤ 200 ms (web.dev). Requiere servidor-r5.mjs (cabecera x-r5-volumen). Dos vueltas.
//   node d4-interaccion.mjs → d4-interaccion.jsonl
import { chromium } from '/home/claude/trabajo/aud20-r5/node_modules/playwright/index.mjs';
import { appendFileSync } from 'node:fs';
import { BASE, CHROMIUM, EVID } from './comun.mjs';

const sonda = () => {
  window.__ev = [];
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__ev.push({ n: e.name, d: e.duration, t: e.startTime }); }).observe({ type: 'event', durationThreshold: 16, buffered: true });
};
const CASOS = [
  ['revision · escribir en «Buscar»', 'revision.html', async (p) => { await p.click('#buscar'); await p.keyboard.type('APD-S-2026-005', { delay: 120 }); }],
  ['citas · escribir en «Buscar»', 'citas.html', async (p) => { await p.click('#buscar'); await p.keyboard.type('MODELO', { delay: 120 }); }],
  ['grupos · elegir a todas las de una organización', 'grupos.html?curso=poda-nueva', async (p) => { await p.locator('input.plan-casilla[aria-label^="Elegir a las"]').first().click(); }],
  ['grupos · elegir una persona', 'grupos.html?curso=poda-nueva', async (p) => { await p.locator('input.plan-casilla:not([aria-label])').nth(3).click(); }],
  ['programar · tocar un día del calendario', 'programar.html?curso=poda-nueva', async (p) => { await p.locator('button[aria-pressed="false"]:not([aria-disabled="true"])').nth(4).click(); }],
  ['asistencia · marcar a todas «Asistió»', 'asistencia.html?folio=APD-G-2026-020', async (p) => { await p.locator('button', { hasText: 'Marcar a todas' }).click(); }],
  ['aplicar · pasar lista (Presente)', 'aplicar.html?folio=APD-G-2026-020', async (p) => { await p.locator('[data-accion="presente"]').first().click(); }]
];
const nav = await chromium.launch({ executablePath: CHROMIUM });
for (const vuelta of [1, 2]) {
  for (const cpu of (process.env.CPUS || '4,6').split(',').map(Number)) {
    for (const [nombre, ruta, accion] of CASOS) {
      const ctx = await nav.newContext({ viewport: { width: 1280, height: 900 }, timezoneId: 'America/Mexico_City', locale: 'es-MX', extraHTTPHeaders: { 'x-r5-volumen': '1' } });
      await ctx.addInitScript(sonda);
      const p = await ctx.newPage();
      p.on('dialog', (d) => d.dismiss().catch(() => {}));
      const cdp = await ctx.newCDPSession(p);
      let fila;
      try {
        await p.goto(BASE + ruta); await p.waitForLoadState('networkidle'); await p.waitForTimeout(800);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpu });
        await p.evaluate(() => { window.__ev = []; });
        await accion(p);
        await p.waitForTimeout(1500);
        const ev = await p.evaluate(() => window.__ev);
        const max = Math.round(Math.max(0, ...ev.map((e) => e.d)));
        fila = { vuelta, cpu, caso: nombre, eventos: ev.length, maxMs: max, p98: Math.round((ev.map((e) => e.d).sort((a, b) => a - b)[Math.floor(ev.length * 0.98)] || 0)) };
      } catch (e) { fila = { vuelta, cpu, caso: nombre, error: String(e.message || e).split('\n')[0] }; }
      console.log(JSON.stringify(fila));
      appendFileSync(`${EVID}/d4-interaccion.jsonl`, JSON.stringify(fila) + '\n');
      await ctx.close();
    }
  }
}
await nav.close();
