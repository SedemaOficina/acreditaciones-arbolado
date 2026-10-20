// Busca en las 21 pantallas (sin acciones, 390 y 1440 px) texto con un peso o una familia que el estándar no trae
// (Roboto 400/500/700, Cabin 600/700) o menor de 12 px. Uso: node letras-raras.mjs http://localhost:8901/
import { chromium } from 'playwright';
const BASE = (process.argv[2] || 'http://localhost:8901/').replace(/\/?$/, '/');
const PAGINAS = ['index', 'cuenta', 'entrar', 'tramites', 'datos', 'solicitud', 'corregir', 'verificar', 'material', 'revision', 'revisar', 'citas', 'cotejo', 'grupos', 'espera', 'programar?curso=poda-nueva', 'grupo?folio=APD-G-2026-003', 'asistencia?folio=APD-G-2026-003', 'aplicar?folio=APD-G-2026-003', 'examen', 'material-personal'];
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const vistos = new Map();
for (const ancho of [390, 1440]) {
  const c = await b.newContext({ viewport: { width: ancho, height: 900 }, timezoneId: 'America/Mexico_City' });
  const p = await c.newPage();
  for (const pg of PAGINAS) {
    const [ruta, q] = pg.split('?');
    await p.goto(`${BASE}${ruta}.html${q ? '?' + q : ''}`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(300);
    const r = await p.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll('body *')) {
        if (!el.checkVisibility || !el.checkVisibility()) continue;
        const t = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join('').trim();
        if (!t) continue;
        const cs = getComputedStyle(el); const fam = cs.fontFamily.split(',')[0].replace(/["']/g, ''); const w = +cs.fontWeight; const fs = parseFloat(cs.fontSize);
        const raro = (fam === 'Roboto' && ![400, 500, 700].includes(w)) || (fam === 'Cabin' && ![600, 700].includes(w)) || fs < 12;
        if (raro) out.push(`${fs}px ${w} ${fam} · ${el.tagName.toLowerCase()}.${[...el.classList].join('.')} (padre .${[...el.parentElement.classList].join('.')}) «${t.slice(0, 30)}»`);
      }
      return out;
    });
    for (const x of r) { const k = x.replace(/«.*»/, ''); if (!vistos.has(k)) vistos.set(k, `${x} · ${ruta}@${ancho}`); }
  }
  await c.close();
}
await b.close();
for (const v of [...vistos.values()].sort()) console.log(v);
