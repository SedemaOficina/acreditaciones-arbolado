// C4 · Encabezado de la agenda contra la situación de cada fila (escenario de volumen, hoy), 2 repeticiones
import { contexto, ir, guarda, cierra, ESC } from './comun.mjs';
const R = {};
for (const rep of [1, 2]) {
  const ctx = await contexto({ vp: ESC, vol: true }); const pg = await ctx.newPage();
  await ir(pg, 'citas.html', '[data-filas] tr', 800);
  R[`r${rep}`] = await pg.evaluate(() => {
    const filas = [...document.querySelectorAll('[data-filas] tr:not([hidden])')].map((t) => t.innerText);
    const sit = {}; for (const f of filas) { const k = (f.match(/(Por atender|En pausa[^\t\n]*|Atendida[^\t\n]*|Sin registrar[^\t\n]*|No se presentó[^\t\n]*|Sin pago[^\t\n]*|Pausa vencida)/) || ['otra'])[0]; sit[k] = (sit[k] || 0) + 1; }
    return { encabezado: document.querySelector('[data-cuenta]').textContent, filas: filas.length, situaciones: sit };
  });
  await ctx.close();
}
guarda('c4-citas-pausa.json', R); console.log(JSON.stringify(R, null, 1)); await cierra();
