// C5 · Documentos generados: acuse de «Crea tu cuenta» y de la solicitud, y lo que «Mis trámites» dice del mismo envío.
// Usa el menú de pruebas («Llenar con datos ficticios»). Contexto nuevo cada vez; corre dos veces (regla 3).
//   node c5-acuses.mjs → c5-acuses.json y capturas/c5-acuse-*.png
import { chromium } from '/home/claude/trabajo/aud20-r5/node_modules/playwright/index.mjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { BASE, CHROMIUM, EVID } from './comun.mjs';
mkdirSync(`${EVID}/capturas`, { recursive: true });
const nav = await chromium.launch({ executablePath: CHROMIUM });
const salida = [];
const menu = async (p, texto) => {
  await p.click('.menu-pruebas-boton');
  await p.click(`dialog >> text="${texto}"`);
  await p.waitForTimeout(400);
  await p.evaluate(() => { for (const d of document.querySelectorAll('dialog[open]')) d.close(); });
};
for (let vuelta = 1; vuelta <= 2; vuelta++) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, timezoneId: 'America/Mexico_City', locale: 'es-MX' });
  const p = await ctx.newPage();
  p.on('dialog', (d) => d.accept().catch(() => {}));
  await p.goto(BASE + 'cuenta.html'); await p.waitForSelector('.menu-pruebas-boton');
  await menu(p, 'Llenar con datos ficticios');
  await p.waitForTimeout(800);
  await p.click('[data-accion="enviar"]');
  await p.waitForSelector('[data-acuse]:not([hidden]), .acuse:not([hidden])', { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(500);
  const acuseCuenta = await p.evaluate(() => { const a = document.querySelector('[data-acuse]:not([hidden])') || document.querySelector('.acuse'); return a ? a.innerText : `(sin acuse) ${document.body.innerText.slice(0, 600)}`; });
  if (vuelta === 1) await p.screenshot({ path: `${EVID}/capturas/c5-acuse-cuenta.png`, fullPage: true });
  // Solicitud: llenar cada paso y continuar hasta enviar
  await p.goto(BASE + 'solicitud.html'); await p.waitForSelector('.menu-pruebas-boton');
  for (let i = 0; i < 8; i++) {
    await menu(p, 'Llenar con datos ficticios');
    await p.waitForTimeout(700);
    const enviar = p.locator('section[data-paso]:not([hidden]) [data-accion="enviar"]');
    if (await enviar.count()) { await enviar.click(); break; }
    await p.locator('section[data-paso]:not([hidden]) [data-accion="siguiente"]').click();
    await p.waitForTimeout(500);
  }
  await p.waitForSelector('[data-acuse]:not([hidden])', { timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(500);
  const acuseSol = await p.evaluate(() => { const a = document.querySelector('[data-acuse]:not([hidden])'); return a ? a.innerText : `(sin acuse) ${(document.querySelector('section[data-paso]:not([hidden])') || document.body).innerText.slice(0, 800)}`; });
  if (vuelta === 1) await p.screenshot({ path: `${EVID}/capturas/c5-acuse-solicitud.png`, fullPage: true });
  await p.goto(BASE + 'tramites.html'); await p.waitForLoadState('networkidle'); await p.waitForTimeout(600);
  const tram = await p.evaluate(() => document.querySelector('main').innerText);
  if (vuelta === 1) await p.screenshot({ path: `${EVID}/capturas/c5-tramites-tras-enviar.png`, fullPage: true });
  salida.push({ vuelta, acuseCuenta, acuseSol, tramites: tram });
  await ctx.close();
}
await nav.close();
writeFileSync(`${EVID}/c5-acuses.json`, JSON.stringify(salida, null, 1));
for (const s of salida) {
  console.log(`== vuelta ${s.vuelta}\n-- acuse cuenta:\n${s.acuseCuenta}\n-- acuse solicitud:\n${s.acuseSol}\n-- tramites (fechas):\n${(s.tramites.match(/.*\d{2}\/\d{2}\/\d{4}.*/g) || []).join('\n')}`);
}
