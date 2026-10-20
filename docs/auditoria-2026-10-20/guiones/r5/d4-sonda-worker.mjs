// D4 · ¿Qué pide el visor de documentos (pdf.js y su worker) en revisar y cotejo? Peticiones de la página y de sus workers.
import { chromium } from '/home/claude/trabajo/aud20-r5/node_modules/playwright/index.mjs';
import { PAGINAS, BASE, CHROMIUM } from './comun.mjs';
const nav = await chromium.launch({ executablePath: CHROMIUM });
for (const nombre of ['revisar', 'cotejo', 'material-personal']) {
  const [, , ruta] = PAGINAS.find((p) => p[0] === nombre);
  for (const [tam, vp] of [['telefono', { width: 390, height: 844 }], ['escritorio', { width: 1280, height: 900 }]]) {
    const ctx = await nav.newContext({ viewport: vp, timezoneId: 'America/Mexico_City' });
    const vistos = [];
    ctx.on('requestfinished', async (r) => { const s = await r.sizes().catch(() => null); vistos.push([r.url().replace(BASE, ''), s ? s.responseBodySize : '?', r.frame ? 'pagina' : '']); });
    const page = await ctx.newPage();
    page.on('worker', (w) => vistos.push(['WORKER ' + w.url().replace(BASE, ''), '', '']));
    await page.goto(BASE + ruta); await page.waitForLoadState('networkidle'); await page.waitForTimeout(2500);
    const lienzos = await page.evaluate(() => document.querySelectorAll('canvas').length);
    console.log(`== ${nombre} ${tam}: canvas=${lienzos}`);
    for (const v of vistos.filter((v) => /pdf|WORKER|documentos/.test(v[0]))) console.log('   ', v.join('  '));
    await ctx.close();
  }
}
await nav.close();
