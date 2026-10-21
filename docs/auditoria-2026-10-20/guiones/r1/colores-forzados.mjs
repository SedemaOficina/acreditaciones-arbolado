// Con colores forzados (alto contraste de Windows, emulado en Chromium): ¿se distinguen lo elegido y lo marcado
// en las piezas propias del proyecto? Compara los estilos calculados del elemento elegido y del no elegido.
// Uso: node colores-forzados.mjs http://localhost:8901/   (capturas en capturas/forzados-*.png)
import { chromium } from 'playwright';
const BASE = (process.argv[2] || 'http://localhost:8901/').replace(/\/?$/, '/');
const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' });
const CASOS = [
  ['grupos', 'grupos.html', null, '.plan-curso[aria-pressed="true"]', '.plan-curso[aria-pressed="false"]'],
  ['grupos-persona', 'grupos.html', async (p) => { await p.locator('.plan-persona .casilla-input').first().evaluate((e) => e.click()); }, '.plan-persona:has(.casilla-input:checked)', '.plan-persona:not(:has(.casilla-input:checked))'],
  ['programar', 'programar.html?curso=poda-nueva', null, '.cal-dia[data-rango="medio"], .cal-dia[data-rango]:not([data-rango="inicio"]):not([data-rango="fin"])', '.cal-dia:not([data-rango]):not([aria-disabled="true"])'],
  ['asistencia', 'asistencia.html?folio=APD-G-2026-003', async (p) => { await p.locator('.asis-opcion-si .asis-opcion-input:enabled').first().check({ force: true }); }, '.asis-opcion:has(.asis-opcion-input:checked)', '.asis-opcion:not(:has(.asis-opcion-input:checked))'],
  ['revisar-opcion', 'cuenta.html', async (p) => { await p.locator('.opcion-fila-input').first().check({ force: true }); }, '.opcion-fila:has(.opcion-fila-input:checked)', '.opcion-fila:not(:has(.opcion-fila-input:checked))']
];
for (const forzado of ['none', 'active']) {
  for (const [clave, ruta, accion, elegido, otro] of CASOS) {
    const c = await b.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'America/Mexico_City', forcedColors: forzado, reducedMotion: 'reduce' });
    const p = await c.newPage();
    await p.goto(BASE + ruta, { waitUntil: 'networkidle' }); await p.waitForTimeout(400);
    if (accion) await accion(p);
    await p.waitForTimeout(200);
    const r = await p.evaluate(([a, o]) => {
      const lee = (sel) => { const e = document.querySelector(sel); if (!e) return null; const cs = getComputedStyle(e); return [cs.backgroundColor, cs.color, `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`, `${cs.outlineWidth} ${cs.outlineStyle} ${cs.outlineColor}`, cs.boxShadow, cs.fontWeight].join(' · '); };
      return { elegido: lee(a), otro: lee(o) };
    }, [elegido, otro]);
    const igual = r.elegido && r.otro && r.elegido === r.otro;
    console.log(`${forzado.padEnd(6)} ${clave.padEnd(16)} ${igual ? 'IGUAL (no se distingue)' : 'distinto'}\n   elegido: ${r.elegido}\n   otro:    ${r.otro}`);
    if (forzado === 'active') await p.locator(elegido).first().screenshot({ path: `capturas/forzados-${clave}.png` }).catch(() => {});
    await c.close();
  }
}
await b.close();
