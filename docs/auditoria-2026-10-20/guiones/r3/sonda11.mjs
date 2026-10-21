import { navegador, contexto, BASE } from './lib.mjs';
const nav = await navegador();
const tam = {};
for (const [u, ses] of [['index.html'], ['cuenta.html'], ['tramites.html', 'c5f9d9aa-c874-46d3-a037-9d273f6aa2e5'], ['solicitud.html?tipo=poda', '7cfb2a2d-d797-42d4-a53c-94758ea964a9'], ['verificar.html'], ['examen.html'], ['material.html']]) {
  const { c } = await contexto(nav, { ancho: 390, sesion: ses }); const p = await c.newPage(); await p.goto(BASE + u, { waitUntil: 'networkidle' });
  const r = await p.evaluate(() => { const out = {}; const w = document.createTreeWalker(document.querySelector('main') || document.body, NodeFilter.SHOW_TEXT); for (let n = w.nextNode(); n; n = w.nextNode()) { const t = n.textContent.trim(); if (!t) continue; const el = n.parentElement; if (!el.checkVisibility() || el.closest('.solo-lector')) continue; const f = getComputedStyle(el).fontSize; const k = f; out[k] = out[k] || { chars: 0, ej: new Set() }; out[k].chars += t.length; if (out[k].ej.size < 4) out[k].ej.add(`.${el.className.split(' ')[0]}`); } for (const k in out) out[k].ej = [...out[k].ej].join(' '); return out; });
  console.log(u, JSON.stringify(r));
  await c.close();
}
await nav.close();
