// D4 · Cascada de peticiones de una pantalla (3G lento, procesador sin freno), sin y con gzip: inicio y fin de cada recurso.
//   node d4-cascada.mjs <pantalla> → d4-cascada-<pantalla>.txt
import { chromium } from '/home/claude/trabajo/aud20-r5/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
import { BASE, CHROMIUM, EVID, PAGINAS, sesionInit } from './comun.mjs';
const [, , nombre = 'tramites'] = process.argv;
const [, , ruta, sesion] = PAGINAS.find((p) => p[0] === nombre);
const nav = await chromium.launch({ executablePath: CHROMIUM });
const out = [];
for (const comp of (process.env.MODOS || ',gz').split(',')) {
  const ctx = await nav.newContext();
  if (sesion) await ctx.addInitScript(sesionInit, sesion);
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 2000, downloadThroughput: 50000, uploadThroughput: 50000 });
  await p.goto(BASE + (comp ? comp + '/' : '') + ruta); await p.waitForLoadState('networkidle');
  const r = await p.evaluate(() => ({ dcl: Math.round(performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd), rec: performance.getEntriesByType('resource').map((e) => [Math.round(e.startTime), Math.round(e.responseEnd), e.encodedBodySize, e.name.replace(location.origin + '/', '')]) }));
  out.push(`== ${nombre} ${comp || 'sin comprimir'} · DOM listo ${r.dcl} ms`);
  for (const [a, b, n, u] of r.rec.sort((x, y) => x[0] - y[0])) out.push(`${String(a).padStart(6)} → ${String(b).padStart(6)} ms  ${String(n).padStart(7)} B  ${u}`);
  await ctx.close();
}
await nav.close(); writeFileSync(`${EVID}/d4-cascada-${nombre}.txt`, out.join('\n') + '\n'); console.log(out.join('\n'));
