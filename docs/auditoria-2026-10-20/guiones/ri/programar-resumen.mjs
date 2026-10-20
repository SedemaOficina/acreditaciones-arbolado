// ri · Programar un curso: el resumen pegajoso («Así quedaría», position:sticky en ≥1024 px) y sus botones de envío.
// Mide el alto del resumen contra la ventana y si «Crear y confirmar» y «Guardar sin confirmar» caben en la ventana
// cuando reciben el foco con Tab. Uso: node programar-resumen.mjs <BASE> [ficticios|volumen]
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
for (const [w, h] of [[1440, 900], [1280, 720], [1024, 768]]) {
  for (let ronda = 1; ronda <= 2; ronda++) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, locale: 'es-MX', timezoneId: 'America/Mexico_City' });
    await ctx.route('**/datos/ficticios.json*', (r) => r.fulfill({ body: cuerpo, contentType: 'application/json' }));
    const pg = await ctx.newPage();
    await pg.goto(BASE + 'programar.html?curso=poda-nueva', { waitUntil: 'networkidle' }); await pg.waitForTimeout(800);
    const res = [];
    for (let k = 0; k < 400; k++) {
      await pg.keyboard.press('Tab');
      const m = await pg.evaluate(() => {
        const a = document.activeElement; if (!a || !a.matches('[data-programar]')) return null;
        const r = a.getBoundingClientRect(); const s = a.closest('.prog-resumen'); const sr = s && s.getBoundingClientRect();
        return { boton: a.textContent.trim(), top: Math.round(r.top), bottom: Math.round(r.bottom), alto: innerHeight, dentro: r.top >= 0 && r.bottom <= innerHeight, resumen: sr ? { pos: getComputedStyle(s).position, top: Math.round(sr.top), alto: Math.round(sr.height) } : null, scrollY: Math.round(scrollY), maxScroll: document.documentElement.scrollHeight - innerHeight };
      });
      if (m) res.push(m);
      if (res.length === 2) break;
    }
    if (ronda === 1) await pg.screenshot({ path: join('capturas', `programar-resumen-${DATOS}-${w}x${h}.png`) });
    console.log(`${DATOS} ${w}x${h} ronda ${ronda}:`, JSON.stringify(res));
    await ctx.close();
  }
}
await b.close();
