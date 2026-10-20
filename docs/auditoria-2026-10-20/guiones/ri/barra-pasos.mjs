// ri · Barra de pasos pegajosa del estándar (.barra-fija, pasos.css) contra el scroll-padding-top que reserva base.css /
// nucleo.css (--alto-barra-fija-movil / --alto-barra-fija): alto real de la barra en cada ancho, en la corrección de una
// solicitud con observaciones. Uso: node barra-pasos.mjs <BASE>
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const BASE = (process.argv[2] || 'http://localhost:8906/').replace(/\/?$/, '/');
const d = JSON.parse(readFileSync('/home/claude/trabajo/aud20-ri/sitio/datos/ficticios.json'));
const obs = d.solicitud.find((x) => x.estado === 'con_observaciones' && d.solicitante.find((p) => p.id === x.solicitante_id && p.estado === 'activa'));
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
for (const [w, h] of [[390, 844], [1024, 768], [1280, 720], [1440, 900]]) for (let ronda = 1; ronda <= 2; ronda++) {
  const movil = w < 600;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, isMobile: movil, hasTouch: movil, locale: 'es-MX', timezoneId: 'America/Mexico_City' });
  await ctx.addInitScript((id) => localStorage.setItem('apd.sesion', JSON.stringify({ id })), obs.solicitante_id);
  const pg = await ctx.newPage();
  await pg.goto(`${BASE}solicitud.html?folio=${obs.folio}`, { waitUntil: 'networkidle' }); await pg.waitForTimeout(800);
  await pg.evaluate(() => window.scrollTo(0, 600)); await pg.waitForTimeout(200);
  const m = await pg.evaluate(() => { const bf = document.querySelector('.barra-fija'); const r = bf.getBoundingClientRect(); const cs = getComputedStyle(document.documentElement); return { barraAlto: Math.round(r.height), barraTop: Math.round(r.top), scrollPaddingTop: cs.scrollPaddingTop, margenInferior: getComputedStyle(bf).marginBottom }; });
  console.log(`${w}x${h} ronda ${ronda}: ${JSON.stringify(m)}`);
  await ctx.close();
}
await b.close();
