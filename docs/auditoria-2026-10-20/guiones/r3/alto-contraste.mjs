// B4 · Colores forzados (alto contraste de Windows, emulado por Chromium): capturas y si el anillo de foco y las
// etiquetas de estado conservan un borde visible. Uso: node alto-contraste.mjs
import { navegador, contexto, BASE } from './lib.mjs';
const nav = await navegador();
for (const [n, u, s, vol] of [['revision', 'revision.html', null, true], ['tramites', 'tramites.html', 'c5f9d9aa-c874-46d3-a037-9d273f6aa2e5'], ['programar', 'programar.html?curso=poda-nueva'], ['cuenta', 'cuenta.html'], ['asistencia', 'asistencia.html?folio=APD-G-2026-003']]) {
  const { c } = await contexto(nav, { ancho: 1440, alto: 900, sesion: s, vol }); const p = await c.newPage();
  await p.emulateMedia({ forcedColors: 'active', colorScheme: 'dark' });
  await p.goto(BASE + u, { waitUntil: 'networkidle' }); await p.waitForTimeout(300);
  for (let i = 0; i < 6; i++) await p.keyboard.press('Tab');
  const r = await p.evaluate(() => { const a = document.activeElement; const cs = getComputedStyle(a); const e = document.querySelector('.estado'); const ce = e && getComputedStyle(e); return { foco: `${a.tagName} outline ${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor}`, estado: e ? `borde ${ce.borderStyle} ${ce.borderWidth}` : 'sin etiquetas', forzado: matchMedia('(forced-colors: active)').matches }; });
  console.log(n, JSON.stringify(r));
  await p.screenshot({ path: `../capturas/alto-contraste-${n}-1440.png` });
  await c.close();
}
await nav.close();
