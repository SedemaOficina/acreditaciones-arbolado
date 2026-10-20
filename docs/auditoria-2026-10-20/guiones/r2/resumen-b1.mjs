// Resume los avances de b1-revisar.mjs: por tipo y por detalle (sin repetir), por tamaño
import { readFileSync, readdirSync } from 'node:fs';
const dir = '/home/claude/trabajo/evidencia-2026-10-20/r2/b1/';
const filtro = process.argv[2] ? new RegExp(process.argv[2]) : null;
for (const f of readdirSync(dir).filter((x) => x.startsWith('avance-'))) {
  const filas = readFileSync(dir + f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const tipos = {};
  for (const r of filas) for (const h of r.hallazgos) { if (filtro && !filtro.test(h.tipo)) continue; const k = h.tipo; (tipos[k] = tipos[k] || new Map()); const d = h.detalle.replace(/\(\d+×\d+ px\)/, '').replace(/\d+ %/, 'N %'); const e = tipos[k].get(d) || []; e.push(r.nombre); tipos[k].set(d, e); }
  console.log(`\n=== ${f}: ${filas.length} estados, ${filas.reduce((n, r) => n + (r.clics || []).length, 0)} botones`);
  for (const [t, m] of Object.entries(tipos)) { console.log(` -- ${t}: ${[...m.values()].reduce((n, l) => n + l.length, 0)}`); for (const [d, l] of m) console.log(`    [${l.length}] ${d.slice(0, 220)}  ← ${[...new Set(l)].slice(0, 3).join(' | ')}`); }
}
