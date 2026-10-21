import { navegador, contexto, BASE } from './lib.mjs';
import { registroDeFoco } from './teclado-lib.mjs';
const nav = await navegador();
for (const [u, ses] of [['tramites.html', '253fd074-d2f6-4839-a31c-c71883650dd1'], ['grupo.html?folio=APD-G-2026-003', null], ['material.html', null], ['verificar.html', null]]) {
  const { c } = await contexto(nav, { ancho: 1440, alto: 900, sesion: ses }); await c.addInitScript(registroDeFoco);
  const p = await c.newPage(); await p.goto(BASE + u, { waitUntil: 'networkidle' });
  const out = [];
  for (let i = 0; i < 14; i++) { await p.keyboard.press('Tab'); await p.waitForTimeout(250); out.push(await p.evaluate(() => { const m = window.__r3mide(document.activeElement); return `${m.el.slice(0, 45)} ${m.indicador.slice(0, 25)} fv=${document.activeElement.matches(':focus-visible')}`; })); }
  for (let i = 0; i < 8; i++) { await p.keyboard.press('Shift+Tab'); await p.waitForTimeout(250); out.push('⇧ ' + await p.evaluate(() => { const m = window.__r3mide(document.activeElement); return `${m.el.slice(0, 45)} ${m.indicador.slice(0, 25)} dentro=${m.dentro}`; })); }
  console.log(u, '\n  ' + out.join('\n  '));
  await c.close();
}
await nav.close();
