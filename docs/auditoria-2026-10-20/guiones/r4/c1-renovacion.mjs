// C1 · Planeador de renovación: ¿cada persona dice cuándo vence o venció, y el orden es por vencimiento? (2 repeticiones)
import { contexto, ir, guarda, cierra, ESC } from './comun.mjs';
const R = {};
for (const rep of [1, 2]) {
  const ctx = await contexto({ vp: ESC, vol: true }); const pg = await ctx.newPage();
  await ir(pg, 'grupos.html?curso=poda-renovacion', '.plan-persona', 800);
  R[`r${rep}`] = await pg.$$eval('.plan-persona', (l) => l.slice(0, 8).map((x) => x.innerText.replace(/\s+/g, ' ').trim()));
  R[`r${rep}cabeza`] = await pg.$eval('main', (m) => (m.innerText.match(/Poda y derribo · renovación: [^\n]*/) || [''])[0]);
  await ctx.close();
}
guarda('c1-renovacion.json', R); console.log(JSON.stringify(R, null, 1)); await cierra();
