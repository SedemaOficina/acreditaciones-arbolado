// ri · «Grupos» (planeador): alto de la barra pegajosa de elegidas (.plan-barra, app/apd.css:579, sticky bottom en ≥760 px)
// contra la ventana, y cuántas de las casillas de personas en espera quedan debajo de ella al enfocarlas con Tab.
// Uso: node plan-barra.mjs <BASE> [ficticios|volumen]
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const BASE = (process.argv[2] || 'http://localhost:8906/').replace(/\/?$/, '/');
const DATOS = process.argv[3] || 'volumen';
let cuerpo = readFileSync('/home/claude/trabajo/aud20-ri/sitio/datos/ficticios.json');
if (DATOS === 'volumen') { const s = join(mkdtempSync(join(tmpdir(), 'ri-')), 'v.json'); execFileSync('node', ['/home/claude/trabajo/aud20-ri/herramientas/escenario-volumen.mjs', '/home/claude/trabajo/aud20-ri/sitio/datos/ficticios.json', s]); cuerpo = readFileSync(s); }
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
for (const [w, h] of [[1440, 900], [1280, 720], [1024, 768], [390, 844]]) for (let ronda = 1; ronda <= 2; ronda++) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, locale: 'es-MX', timezoneId: 'America/Mexico_City' });
  await ctx.route('**/datos/ficticios.json*', (r) => r.fulfill({ body: cuerpo, contentType: 'application/json' }));
  const pg = await ctx.newPage();
  await pg.goto(BASE + 'grupos.html?curso=poda-nueva', { waitUntil: 'networkidle' }); await pg.waitForTimeout(800);
  const barra = await pg.evaluate(() => { const x = document.querySelector('.plan-barra'); const r = x.getBoundingClientRect(); return { pos: getComputedStyle(x).position, alto: Math.round(r.height), botones: x.querySelectorAll('button, a').length, scrollPaddingBottom: getComputedStyle(document.documentElement).scrollPaddingBottom }; });
  let casillas = 0, debajo = 0;
  for (let k = 0; k < 300; k++) {
    await pg.keyboard.press('Tab');
    const m = await pg.evaluate(() => {
      const a = document.activeElement; if (!a.matches('.plan-casilla')) return a.closest('.plan-barra') ? 'barra' : null;
      const r = a.getBoundingClientRect(); const bb = document.querySelector('.plan-barra').getBoundingClientRect();
      return { tapada: getComputedStyle(document.querySelector('.plan-barra')).position === 'sticky' && r.top >= bb.top && r.bottom <= bb.bottom };
    });
    if (m === 'barra') break;
    if (m) { casillas++; if (m.tapada) debajo++; }
  }
  console.log(`${DATOS} ${w}x${h} ronda ${ronda}: barra ${JSON.stringify(barra)} (${Math.round(barra.alto / h * 100)} % de la ventana) · casillas enfocadas ${casillas} · completamente debajo de la barra ${debajo}`);
  await ctx.close();
}
await b.close();
