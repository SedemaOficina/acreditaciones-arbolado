import { navegador, contexto, BASE, espera } from './comun.mjs';
const nav = await navegador();
for (const r of [1, 2]) for (const v of ['tel360', 'tel390', 'tel430']) {
  const c = await contexto(nav, v); const p = await c.newPage();
  await p.goto(BASE + 'asistencia.html?folio=APD-G-2026-003', { waitUntil: 'networkidle' }); await espera(700);
  const x = await p.evaluate(() => {
    const res = [];
    for (const quien of document.querySelectorAll('.asis-quien')) {
      const fila = quien.parentElement;
      const btns = [...fila.querySelectorAll('button')].filter((b) => b.offsetParent);
      for (const el of quien.querySelectorAll('*')) {
        if (!el.offsetParent || (el.children.length && !/Ya no puede/.test(el.innerText))) continue;
        const a = el.getBoundingClientRect();
        for (const b of btns) { const bb = b.getBoundingClientRect(); const w = Math.min(a.right, bb.right) - Math.max(a.left, bb.left); const h = Math.min(a.bottom, bb.bottom) - Math.max(a.top, bb.top); if (w > 1 && h > 1) res.push(`${(el.innerText || el.className).trim().slice(0, 30)} × ${b.innerText.trim()} (${Math.round(w)}×${Math.round(h)})`); }
      }
    }
    return res;
  });
  console.log(r, v, JSON.stringify(x));
  await c.close();
}
await nav.close();
