// C2 · Comprobaciones puntuales de heurísticas (2 repeticiones, contexto nuevo cada vez)
import { contexto, ir, guarda, cierra, ESC, TEL } from './comun.mjs';
import { readFileSync } from 'node:fs';
const casos = JSON.parse(readFileSync('/home/claude/trabajo/evidencia-2026-10-20/r4/salidas/casos.json', 'utf8'));
const R = {};
for (const rep of [1, 2]) {
  // Planeador: con «Ninguna elegida», ¿hay un botón primario de destino?
  {
    const ctx = await contexto({ vp: ESC, vol: true }); const pg = await ctx.newPage();
    await ir(pg, 'grupos.html?curso=poda-nueva', '.plan-persona', 800);
    const r = await pg.evaluate(() => ({ elegidas: document.querySelector('[data-elegidas]').textContent, primarios: [...document.querySelectorAll('[data-destinos] .btn-primario')].map((b) => b.textContent.trim()), destinos: document.querySelectorAll('[data-destinos] .btn').length }));
    await pg.locator('[data-destinos] .btn-primario').first().click(); await pg.waitForTimeout(500);
    r.trasClic = (await pg.$eval('[data-barra]', (b) => b.innerText)).replace(/\s+/g, ' ').slice(0, 200);
    (R.planeadorPrimario ||= {})[`r${rep}`] = r; await ctx.close();
  }
  // Solicitud, paso 3: «Abre cada bloque…» ¿los bloques ya están abiertos?
  {
    const c = casos.find((x) => x.clave === 'por-vencer');
    const ctx = await contexto({ vp: TEL, sesion: c.persona }); const pg = await ctx.newPage();
    await ir(pg, 'tramites.html', '[data-acreditaciones] .ficha', 800);
    await pg.locator('[data-acreditaciones] a', { hasText: 'Renovar' }).first().click();
    await pg.waitForSelector('section[data-paso]:not([hidden])'); await pg.waitForTimeout(400);
    if (await pg.isVisible('#nivel_estudios') && !(await pg.inputValue('#nivel_estudios'))) await pg.selectOption('#nivel_estudios', 'preparatoria');
    for (let i = 0; i < 2; i++) { await pg.click('section[data-paso]:not([hidden]) [data-accion="siguiente"]'); await pg.waitForTimeout(500); }
    const r = await pg.evaluate(() => {
      const paso = document.querySelector('section[data-paso]:not([hidden])');
      const bajada = paso.querySelector('.bajada') ? paso.querySelector('.bajada').textContent.trim().slice(0, 60) : null;
      const bloques = [...paso.querySelectorAll('details')];
      const exp = [...paso.querySelectorAll('[aria-expanded]')];
      return { bajada, details: bloques.length, abiertos: bloques.filter((d) => d.open).length, ariaExpanded: exp.map((e) => e.getAttribute('aria-expanded')) };
    });
    (R.revisionBloques ||= {})[`r${rep}`] = r; await ctx.close();
  }
}
guarda('c2-verifica.json', R); console.log(JSON.stringify(R, null, 1)); await cierra();
