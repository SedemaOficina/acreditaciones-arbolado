import { navegador, contexto, BASE, espera } from './comun.mjs';
const nav = await navegador();
for (const r of [1, 2]) for (const v of ['tel360', 'tel390']) {
  const c = await contexto(nav, v); const p = await c.newPage();
  await p.goto(BASE + 'asistencia.html?folio=APD-G-2026-003', { waitUntil: 'networkidle' }); await espera(700);
  const x = await p.evaluate(() => { const n = [...document.querySelectorAll('p.asis-nombre')].find((e) => /ANA MUESTRA/.test(e.innerText)); const fila = n.closest('.asistencia-fila, li, tr, div'); const spans = [...fila.querySelectorAll('span')].filter((s) => /Asisti/.test(s.innerText)); const a = n.getBoundingClientRect(); const out = spans.map((s) => { const b = s.getBoundingClientRect(); return { w: Math.round(Math.min(a.right, b.right) - Math.max(a.left, b.left)), h: Math.round(Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)), span: [b.left, b.top, b.width, b.height].map(Math.round) }; }); n.scrollIntoView({ block: 'center' }); return { nombre: [a.left, a.top, a.width, a.height].map(Math.round), out, fila: fila.className }; });
  console.log(r, v, JSON.stringify(x));
  if (r === 1) await p.screenshot({ path: `/home/claude/trabajo/evidencia-2026-10-20/r2/capturas/b1/repro-B1-06-${v}.png` });
  await c.close();
}
await nav.close();
