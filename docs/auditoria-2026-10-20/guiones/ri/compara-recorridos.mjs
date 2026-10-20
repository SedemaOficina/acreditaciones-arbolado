// ri · Compara dos pasadas de foco-recorrido.mjs (contextos nuevos): por datos, tamaño y pantalla, paradas y ocultas.
// Uso: node compara-recorridos.mjs <pasada1.json...> -- <pasada2.json...>
import { readFileSync } from 'node:fs';
const i = process.argv.indexOf('--');
const lee = (fs) => fs.flatMap((f) => JSON.parse(readFileSync(f, 'utf8')));
const [a, b] = [lee(process.argv.slice(2, i)), lee(process.argv.slice(i + 1))];
const clave = (r) => `${r.datos} ${r.tam} ${r.estado}`;
const res = (r) => ({ p: r.paradas.length, t: r.paradas.filter((x) => x.total).length, q: r.paradas.filter((x) => x.parcial).length });
const mb = new Map(b.map((r) => [clave(r), r]));
let iguales = 0, distintas = 0, sin = 0;
for (const r of a) {
  const o = mb.get(clave(r)); if (!o) { sin++; continue; }
  const x = res(r), y = res(o);
  const ok = x.p === y.p && x.t === y.t && x.q === y.q;
  if (ok) iguales++; else { distintas++; console.log(`DIFIERE ${clave(r)}: ${JSON.stringify(x)} contra ${JSON.stringify(y)}`); }
  if (ok && (x.t || x.q)) console.log(`igual   ${clave(r)}: paradas ${x.p}, total ${x.t}, parcial ${x.q}`);
}
console.log(`\nComparadas ${iguales + distintas} (sin par en la 2.ª pasada: ${sin}) · iguales ${iguales} · distintas ${distintas}`);
