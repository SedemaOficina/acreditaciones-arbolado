// Resume las salidas de foco-recorrido.mjs: por pantalla y tamaño, paradas, ocultas total y parcialmente y qué las tapa.
// Uso: node resumen-recorrido.mjs salidas/recorrido-*.json
import { readFileSync } from 'node:fs';
const filas = [];
for (const f of process.argv.slice(2)) for (const r of JSON.parse(readFileSync(f, 'utf8'))) {
  const quien = {};
  for (const p of r.paradas) if (p.total || p.parcial) for (const q of p.porQuien) { const k = q.replace(/ ×\d+$/, '').replace(/«.*»/, '').trim(); quien[k] = (quien[k] || 0) + 1; }
  filas.push({ datos: r.datos, tam: r.tam, estado: r.estado, paradas: r.paradas.length, totales: r.paradas.filter((p) => p.total).length, parciales: r.paradas.filter((p) => p.parcial).length, sinInd: r.paradas.filter((p) => !p.indicador).length, recortado: r.paradas.filter((p) => p.recortado).length, quien, error: r.error || '' });
}
const fmt = process.env.FORMATO || 'tabla';
if (fmt === 'md') {
  console.log('| Datos | Tamaño | Pantalla | Paradas | Ocultas total | Ocultas parcial | Qué las tapa (paradas) |');
  console.log('|---|---|---|---|---|---|---|');
  for (const x of filas) console.log(`| ${x.datos} | ${x.tam} | ${x.estado} | ${x.paradas} | ${x.totales} | ${x.parciales} | ${Object.entries(x.quien).map(([k, n]) => `${k}: ${n}`).join('; ')} |`);
} else for (const x of filas) if (x.totales || x.parciales || x.error) console.log(`${x.datos} ${x.tam} ${x.estado.padEnd(26)} ${x.paradas} tot ${x.totales} par ${x.parciales} ${JSON.stringify(x.quien)} ${x.error}`);
const t = filas.reduce((a, x) => ({ p: a.p + x.paradas, t: a.t + x.totales, q: a.q + x.parciales }), { p: 0, t: 0, q: 0 });
console.log(`\nRecorridos: ${filas.length} · paradas: ${t.p} · ocultas total: ${t.t} · ocultas parcialmente: ${t.q}`);
