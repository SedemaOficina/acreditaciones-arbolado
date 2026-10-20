// ri · Indicador de foco recortado por el marco de la tabla (div.tabla-marco con overflow) en «Solicitudes por revisar»
// a 1024×768: captura de cerca del botón «Revisar» enfocado con Tab y mide qué lados del contorno quedan fuera del marco.
import { chromium } from 'playwright';
const BASE = (process.argv[2] || 'http://localhost:8906/').replace(/\/?$/, '/');
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
for (const [w, h] of [[1024, 768], [1280, 720], [1440, 900]]) for (let ronda = 1; ronda <= 2; ronda++) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, locale: 'es-MX', timezoneId: 'America/Mexico_City' });
  const pg = await ctx.newPage();
  await pg.goto(BASE + 'revision.html', { waitUntil: 'networkidle' }); await pg.waitForTimeout(600);
  for (let k = 0; k < 60; k++) { await pg.keyboard.press('Tab'); if (await pg.evaluate(() => /Revisar la solicitud/.test(document.activeElement.getAttribute('aria-label') || ''))) break; }
  const m = await pg.evaluate(() => {
    const a = document.activeElement; const r = a.getBoundingClientRect(); const cs = getComputedStyle(a);
    const ext = parseFloat(cs.outlineWidth) + parseFloat(cs.outlineOffset);
    const marco = a.closest('.tabla-marco'); const c = marco.getBoundingClientRect(); const mc = getComputedStyle(marco);
    return { boton: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)], contorno: ext, marco: [Math.round(c.left), Math.round(c.top), Math.round(c.right), Math.round(c.bottom)], overflow: mc.overflowX + '/' + mc.overflowY,
      fuera: { izq: Math.max(0, c.left - (r.left - ext)), der: Math.max(0, r.right + ext - c.right), arr: Math.max(0, c.top - (r.top - ext)), aba: Math.max(0, r.bottom + ext - c.bottom) }, desborda: marco.scrollWidth > marco.clientWidth };
  });
  console.log(`${w}x${h} ronda ${ronda}`, JSON.stringify(m));
  if (ronda === 1) { const r = m.boton; await pg.screenshot({ path: `capturas/recorte-tabla-${w}x${h}.png`, clip: { x: Math.max(0, r[0] - 40), y: Math.max(0, r[1] - 30), width: r[2] - r[0] + 80, height: Math.min(h - Math.max(0, r[1] - 30), r[3] - r[1] + 60) } }); }
  await ctx.close();
}
await b.close();
