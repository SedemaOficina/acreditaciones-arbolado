// D4 · Control: ¿la red simulada de Chrome cobra los bytes comprimidos o los descomprimidos? Mide ficticios.json y apd.js
// (Resource Timing) en index.html con 3G lento, procesador sin freno, sin y con gzip. Dos vueltas.
import { chromium } from '/home/claude/trabajo/aud20-r5/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
import { BASE, CHROMIUM, EVID } from './comun.mjs';
const nav = await chromium.launch({ executablePath: CHROMIUM });
const out = [];
for (const v of [1, 2]) for (const comp of ['', 'gzip']) {
  const ctx = await nav.newContext(comp ? { extraHTTPHeaders: { 'x-r5-comprimir': comp } } : {});
  const p = await ctx.newPage(); const cdp = await ctx.newCDPSession(p);
  await cdp.send('Network.enable'); await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 2000, downloadThroughput: 50000, uploadThroughput: 50000 });
  await p.goto(BASE + 'index.html'); await p.waitForLoadState('networkidle');
  const r = await p.evaluate(() => performance.getEntriesByType('resource').filter((e) => /ficticios|apd\.js|pdf|nucleo/.test(e.name)).map((e) => ({ n: e.name.split('/').pop(), ms: Math.round(e.responseEnd - e.requestStart), descarga: Math.round(e.responseEnd - e.responseStart), transf: e.transferSize, cuerpo: e.encodedBodySize, dec: e.decodedBodySize })));
  const fila = `vuelta ${v} ${comp || 'sin comprimir'}: ` + r.map((x) => `${x.n} ${x.ms} ms (descarga ${x.descarga} ms, ${x.cuerpo} B en la red, ${x.dec} B)`).join(' · ');
  console.log(fila); out.push(fila); await ctx.close();
}
await nav.close(); writeFileSync(`${EVID}/d4-sonda-gzip.txt`, out.join('\n') + '\n');
