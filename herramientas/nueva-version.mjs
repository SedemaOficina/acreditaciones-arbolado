// NUEVA VERSIÓN DE PRUEBA (decisión 2026-10-15, Liber): cada publicación sube el número, 0.N → 0.N+1, para saber
// en pantalla si se está viendo la última. Lo llama herramientas/publicar-sitio.sh antes de publicar:
//   · VERSION (raíz) y sitio/VERSION: el número nuevo (lo pinta version-visible.js: «Versión de prueba 0.N»);
//   · el ?v= de los archivos propios en cada página (no el de formkit/, que lleva la versión del estándar), para que el
//     navegador no use una copia vieja;
//   · docs/VERSIONES.md: número, fecha y hora (Ciudad de México) y qué cambió (el último commit).
// Al pasar al SIA la versión es 1 y deja de usarse este guion.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const actual = readFileSync(join(raiz, 'VERSION'), 'utf8').trim();
const m = actual.match(/^0\.(\d+)$/);
if (!m) { console.error(`VERSION no es de prueba (0.N): ${actual}`); process.exit(1); }
const nueva = `0.${Number(m[1]) + 1}`;

writeFileSync(join(raiz, 'VERSION'), nueva + '\n');
writeFileSync(join(raiz, 'sitio/VERSION'), nueva + '\n');
for (const p of readdirSync(join(raiz, 'sitio')).filter((f) => f.endsWith('.html'))) {
  const ruta = join(raiz, 'sitio', p);
  // Sólo los archivos propios: los del estándar (formkit/…) llevan la versión del estándar (construir-sitio.mjs)
  writeFileSync(ruta, readFileSync(ruta, 'utf8').replace(/((?:href|src)="(?!formkit\/)[^"?]+)\?v=[0-9.]+"/g, `$1?v=${nueva}"`));
}

const cuando = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City', dateStyle: 'short', timeStyle: 'short' });
const que = execFileSync('git', ['log', '-1', '--format=%s'], { cwd: raiz, encoding: 'utf8' }).trim();
const bitacora = join(raiz, 'docs/VERSIONES.md');
const cabeza = '# Versiones de prueba publicadas\n\nCada publicación en GitHub Pages (y en el artefacto de prueba) sube el número. Lo genera `herramientas/nueva-version.mjs`; no se edita a mano. Al pasar al SIA, la versión es 1.\n\n| Versión | Publicada | Qué cambió |\n|---|---|---|\n';
const previas = existsSync(bitacora) ? readFileSync(bitacora, 'utf8').split('\n').filter((l) => /^\| 0\.\d+ \|/.test(l)) : [];
writeFileSync(bitacora, cabeza + [`| ${nueva} | ${cuando} | ${que.replace(/\|/g, '/')} |`, ...previas].join('\n') + '\n');
console.log(`Versión de prueba ${nueva}`);
