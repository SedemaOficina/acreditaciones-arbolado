// C2: alto útil de la lista «En espera» del planeador en 1440x900 y 1280x900 y 390x844 (escenario de volumen)
import { contexto, ir, captura, cierra, guarda } from './comun.mjs';
const out = [];
for (const vp of [{ width: 1440, height: 900 }, { width: 1280, height: 900 }, { width: 1280, height: 720 }, { width: 390, height: 844 }]) {
  for (let rep = 1; rep <= 2; rep++) {
    const ctx = await contexto({ vp, vol: true });
    const pg = await ctx.newPage();
    await ir(pg, 'grupos.html?curso=poda-nueva', '.plan-persona', 900);
    const r = await pg.evaluate(() => {
      const per = document.querySelector('.plan-persona');
      let c = per.parentElement; while (c && !(c.scrollHeight > c.clientHeight + 4 && /(auto|scroll)/.test(getComputedStyle(c).overflowY))) c = c.parentElement;
      const box = c ? c.getBoundingClientRect() : null;
      return { contenedor: c ? (c.className || c.tagName) : null, altoVisible: c ? Math.round(c.clientHeight) : null, altoContenido: c ? c.scrollHeight : null,
        top: box ? Math.round(box.top) : null, personas: document.querySelectorAll('.plan-persona').length,
        personasVisibles: c ? [...document.querySelectorAll('.plan-persona')].filter((p) => { const b = p.getBoundingClientRect(); return b.top >= box.top && b.bottom <= box.bottom; }).length : null };
    });
    out.push({ vp: `${vp.width}x${vp.height}`, rep, ...r });
    if (rep === 1) await captura(pg, `c2-espera-alto-${vp.width}x${vp.height}`, false);
    await ctx.close();
  }
}
guarda('c2-espera-alto.json', out); console.log(JSON.stringify(out, null, 1)); await cierra();
