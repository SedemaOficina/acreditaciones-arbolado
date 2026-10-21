// C2: cuánto de la ventana ocupa la barra fija «elegidas + destinos» del planeador (escenario de volumen), 2 repeticiones
import { contexto, ir, captura, cierra, guarda } from './comun.mjs';
const out = [];
for (const vp of [{ width: 1440, height: 900 }, { width: 1280, height: 900 }, { width: 1280, height: 720 }]) {
  for (let rep = 1; rep <= 2; rep++) {
    const ctx = await contexto({ vp, vol: true });
    const pg = await ctx.newPage();
    await ir(pg, 'grupos.html?curso=poda-nueva', '.plan-persona', 900);
    // Desplazar hasta la mitad de la lista y medir
    await pg.evaluate(() => { const l = document.querySelectorAll('.plan-persona'); l[30].scrollIntoView({ block: 'center' }); });
    await pg.waitForTimeout(300);
    const r = await pg.evaluate(() => {
      const b = document.querySelector('[data-barra]').getBoundingClientRect();
      const filas = [...document.querySelectorAll('.plan-persona')].filter((p) => { const x = p.getBoundingClientRect(); return x.bottom > 0 && x.top < b.top; }).length;
      const tapadas = [...document.querySelectorAll('.plan-persona')].filter((p) => { const x = p.getBoundingClientRect(); return x.top >= b.top && x.top < innerHeight; }).length;
      return { altoBarra: Math.round(b.height), fraccion: +(b.height / innerHeight).toFixed(2), botones: document.querySelectorAll('[data-destinos] .btn, [data-destinos] a').length, personasVisibles: filas, personasTapadas: tapadas };
    });
    out.push({ vp: `${vp.width}x${vp.height}`, rep, ...r });
    if (rep === 1) await captura(pg, `c2-barra-planeador-${vp.width}x${vp.height}`, false);
    await ctx.close();
  }
}
guarda('c2-barra-planeador.json', out); console.log(JSON.stringify(out)); await cierra();
