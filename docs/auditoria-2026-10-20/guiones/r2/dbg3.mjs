import { navegador, contexto, BASE, espera } from './comun.mjs';
const nav = await navegador();
for (const v of ['tableta', 'tableta']) {
  const c = await contexto(nav, v); const p = await c.newPage();
  await p.goto(BASE + 'revision.html', { waitUntil: 'networkidle' }); await espera(800);
  const info = await p.evaluate(() => { const b = document.querySelector('.menu-pruebas-boton'); if (!b) return 'sin botón'; const r = b.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + r.height / 2; const e = document.elementFromPoint(x, y); return { r: [r.left, r.top, r.width, r.height].map(Math.round), arriba: e && (e.tagName + '.' + e.className).slice(0, 80), mismo: e === b || b.contains(e), alto: innerHeight, ancho: innerWidth }; });
  let click; try { await p.click('.menu-pruebas-boton', { timeout: 5000 }); click = 'ok ' + await p.locator('dialog[open]').count(); } catch (e) { click = e.message.split('\n').filter((l) => /intercept|visible|stable|retry/.test(l)).slice(0, 3).join(' / '); }
  console.log(JSON.stringify(info), click);
  await p.screenshot({ path: '/home/claude/trabajo/evidencia-2026-10-20/r2/capturas/b1/dbg-revision-tableta.png' });
  await c.close();
}
await nav.close();
