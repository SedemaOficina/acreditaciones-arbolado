// C3 · Cuánto del alto de «Programar» es la lista «¿Quiénes van?» (66 en espera, 25 propuestas), 2 repeticiones
import { contexto, ir, guarda, cierra, ESC, TEL } from './comun.mjs';
const R = {};
for (const rep of [1, 2]) for (const [k, vp] of [['tel', TEL], ['esc', ESC]]) {
  const ctx = await contexto({ vp, vol: true }); const pg = await ctx.newPage();
  await ir(pg, 'programar.html?curso=poda-nueva', '[data-personas] .plan-casilla[value]', 900);
  R[`${k}-r${rep}`] = await pg.evaluate(() => { const l = document.querySelector('[data-personas]'); const c = [...l.querySelectorAll('.plan-casilla[value]')];
    return { altoDoc: document.documentElement.scrollHeight, altoLista: Math.round(l.getBoundingClientRect().height), ventana: innerHeight, casillas: c.length, marcadas: c.filter((x) => x.checked).length, casillasBloque: l.querySelectorAll('input[type=checkbox]:not([value])').length + l.querySelectorAll('.plan-bloque input').length }; });
  await ctx.close();
}
guarda('c3-programar-lista.json', R); console.log(JSON.stringify(R)); await cierra();
