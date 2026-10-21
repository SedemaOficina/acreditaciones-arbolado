// Clases declaradas en app/apd.css y app/examen.css que ningún HTML ni script del sitio nombra.
// Uso: node clases-sin-uso.mjs <raíz del sitio>
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const raiz = process.argv[2];
const hojas = ['app/apd.css', 'app/examen.css'];
const lista = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? lista(p) : [p]; });
const fuentes = [...lista(join(raiz)).filter((f) => /\.(html|js)$/.test(f) && !f.includes('/vendor/'))];
const textos = fuentes.map((f) => ({ f, t: readFileSync(f, 'utf8') }));
const sinUso = [];
let total = 0;
for (const h of hojas) {
  const css = readFileSync(join(raiz, h), 'utf8').replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  const vistas = new Set();
  css.split('\n').forEach((ln, i) => {
    const sel = ln.split('{')[0];
    if (!ln.includes('{')) return;
    for (const m of sel.matchAll(/\.([A-Za-z_][\w-]*)/g)) {
      const c = m[1]; if (vistas.has(c) || /^\d/.test(c)) continue; vistas.add(c); total++;
      const re = new RegExp(`(?<![\\w-])${c.replace(/-/g, '\\-')}(?![\\w-])`);
      const donde = textos.filter((x) => re.test(x.t)).map((x) => x.f.replace(raiz + '/', ''));
      if (!donde.length) sinUso.push(`${h}:${i + 1} .${c}`);
      else if (donde.every((d) => d.startsWith('formkit/'))) sinUso.push(`${h}:${i + 1} .${c} (sólo la nombra el estándar: ${donde.slice(0, 2).join(', ')})`);
    }
  });
}
console.log(`Clases distintas declaradas: ${total}`);
console.log(`Sin uso en HTML ni JS del sitio: ${sinUso.filter((s) => !s.includes('sólo la nombra')).length}`);
for (const s of sinUso) console.log('  ' + s);
