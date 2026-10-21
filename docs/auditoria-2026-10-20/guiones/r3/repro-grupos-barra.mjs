// B4 · Reproducción: en «Grupos» (computadora), la barra fija de «Ninguna elegida» y los botones de grupo tapa por
// completo la casilla enfocada de quien espera (2.4.11 Foco no oculto, mínimo). Contexto nuevo en cada corrida.
// Uso: node repro-grupos-barra.mjs <corrida>   → ../repro-grupos-barra-<corrida>.json y capturas
import { navegador, contexto, BASE, guarda } from './lib.mjs';
import { registroDeFoco } from './teclado-lib.mjs';

const corrida = process.argv[2] || '1';
const nav = await navegador();
const R = [];
for (const [ancho, alto, vol] of [[1440, 900, true], [1280, 800, true], [1024, 768, true], [1440, 900, false], [1366, 768, false], [390, 844, true]]) {
  const { c } = await contexto(nav, { ancho, alto, vol });
  await c.addInitScript(registroDeFoco);
  const p = await c.newPage();
  await p.goto(BASE + 'grupos.html?curso=poda-nueva', { waitUntil: 'networkidle' }); await p.waitForTimeout(300);
  const barra = await p.evaluate(() => { const b = document.querySelector('.plan-barra'); const r = b.getBoundingClientRect(); return { pos: getComputedStyle(b).position, alto: Math.round(r.height), top: Math.round(r.top) }; });
  let casillas = 0, total = 0, parcial = 0, captura = false;
  for (let i = 0; i < 120; i++) {
    await p.keyboard.press('Tab'); await p.waitForTimeout(90);
    const m = await p.evaluate(() => { const a = document.activeElement; return a.classList.contains('plan-casilla') ? window.__r3mide(a) : null; });
    if (!m) { if (casillas > 0 && await p.evaluate(() => !document.activeElement.closest('.plan-espera, [data-espera], .plan-lista') && !document.activeElement.classList.contains('plan-casilla'))) break; continue; }
    casillas++;
    if (m.tapado === 'TOTAL') total++; else if (m.tapado === 'parcial') parcial++;
    if (m.tapado === 'TOTAL' && !captura) { captura = true; await p.screenshot({ path: `../capturas/grupos-barra-tapa-foco-${ancho}x${alto}${vol ? '-vol' : ''}-${corrida}.png` }); }
  }
  R.push({ ancho, alto, volumen: vol, barra, casillas, tapadasTotal: total, tapadasParcial: parcial });
  console.log(JSON.stringify(R[R.length - 1]));
  await c.close();
}
guarda(`repro-grupos-barra-${corrida}.json`, R);
await nav.close();
