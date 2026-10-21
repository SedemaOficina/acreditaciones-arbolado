// D4 · Lo que se vuelve a descargar al pasar de una pantalla a otra (caché del navegador activa, como en la realidad).
// Recorrido de la persona: inicio → entrar → mis trámites → mi perfil → mis trámites. Y del personal: bandeja → revisar → bandeja.
import { chromium } from '/home/claude/trabajo/aud20-r5/node_modules/playwright/index.mjs';
import { writeFileSync } from 'node:fs';
import { PAGINAS, BASE, CHROMIUM, EVID, sesionInit } from './comun.mjs';
const ruta = (n) => PAGINAS.find((p) => p[0] === n)[2];
const sesion = PAGINAS.find((p) => p[0] === 'tramites')[3];
const nav = await chromium.launch({ executablePath: CHROMIUM });
const salida = [];
for (const [nombre, pasos, ses] of [['persona', ['index', 'entrar', 'tramites', 'datos', 'tramites'], sesion], ['personal', ['revision', 'revisar', 'revision', 'citas']]]) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'America/Mexico_City' });
  if (ses) await ctx.addInitScript(sesionInit, ses);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Network.enable');
  let bytes = 0, red = 0, cache = 0, json = 0;
  cdp.on('Network.loadingFinished', (e) => { bytes += e.encodedDataLength; });
  cdp.on('Network.requestServedFromCache', () => { cache++; });
  cdp.on('Network.responseReceived', (e) => { if (!e.response.fromDiskCache && !e.response.fromMemoryCache && e.response.url.startsWith('http')) red++; if (/ficticios\.json/.test(e.response.url) && !e.response.fromDiskCache) json++; });
  for (const p of pasos) {
    bytes = 0; red = 0; cache = 0; json = 0;
    await page.goto(BASE + ruta(p)); await page.waitForLoadState('networkidle'); await page.waitForTimeout(800);
    const fila = `${nombre} · ${p}: ${(bytes / 1024).toFixed(1)} KB por la red, ${red} respuestas de la red, ${cache} desde caché, ficticios.json descargado ${json} vez`;
    console.log(fila); salida.push(fila);
  }
  await ctx.close();
}
await nav.close();
writeFileSync(`${EVID}/d4-segunda-visita.txt`, salida.join('\n') + '\n');
