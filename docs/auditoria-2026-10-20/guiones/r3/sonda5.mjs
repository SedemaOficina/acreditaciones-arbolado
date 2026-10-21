import { navegador, contexto, BASE } from './lib.mjs';
import { registroDeFoco, activo } from './teclado-lib.mjs';
const nav = await navegador();
const { c } = await contexto(nav, { ancho: 1440, alto: 900, vol: true });
await c.addInitScript(registroDeFoco);
const p = await c.newPage();
await p.goto(BASE + 'grupos.html?curso=poda-nueva', { waitUntil: 'networkidle' });
for (let i = 0; i < 40; i++) {
  await p.keyboard.press('Tab'); await p.waitForTimeout(120);
  const r = await p.evaluate(() => { const a = document.activeElement; const m = window.__r3mide(a); const bar = document.querySelector('.plan-barra'); const bb = bar.getBoundingClientRect(); const lista = a.closest('.plan-lista, [data-espera], .plan-espera'); return `${m.el.slice(0,60)} y=${Math.round(a.getBoundingClientRect().top)}..${Math.round(a.getBoundingClientRect().bottom)} barra=${Math.round(bb.top)}..${Math.round(bb.bottom)} tapado=${m.tapado} ${m.tapadoPor||''} ind=${m.indicador.slice(0,30)} scroll=${scrollY}`; });
  console.log(i, r);
  if (i === 12) await p.screenshot({ path: '../capturas/grupos-vol-foco-1440.png' });
}
await nav.close();
