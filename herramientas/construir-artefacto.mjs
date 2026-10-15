// VERSIÓN DE PRUEBA DENTRO DE CLAUDE: arma, a partir de sitio/, una copia lista para publicarse como artefacto
// (misma página que GitHub Pages, para probar sin salir de Claude).
//   · la página principal del artefacto es un lanzador que abre inicio.html (el artefacto reserva index.html);
//   · index.html se copia como inicio.html y se ajustan los enlaces que lo nombran;
//   · escribe archivos.json con el mapa de archivos para la publicación.
// Uso: node herramientas/construir-artefacto.mjs <carpeta-de-salida>
// Lo generado no se guarda en el repositorio: se reconstruye desde sitio/ cada vez.
import { cpSync, readFileSync, writeFileSync, readdirSync, statSync, rmSync, renameSync } from 'node:fs';
import { dirname, join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const salida = process.argv[2];
if (!salida) { console.error('Uso: node herramientas/construir-artefacto.mjs <carpeta-de-salida>'); process.exit(2); }
rmSync(salida, { recursive: true, force: true });
cpSync(join(raiz, 'sitio'), salida, { recursive: true });
renameSync(join(salida, 'index.html'), join(salida, 'inicio.html'));

const todos = (d) => readdirSync(d).flatMap((n) => { const r = join(d, n); return statSync(r).isDirectory() ? todos(r) : [r]; });
for (const f of todos(salida)) {
  if (f.includes(`${salida}/formkit/`) || !['.html', '.js'].includes(extname(f))) continue;
  const t = readFileSync(f, 'utf8');
  const n = t.replace(/(["'])index\.html\1/g, '$1inicio.html$1');
  if (n !== t) writeFileSync(f, n);
}
const version = readFileSync(join(raiz, 'VERSION'), 'utf8').trim();
writeFileSync(join(salida, 'artefacto.html'), `<title>Acreditaciones de arbolado</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>
:root { --fondo: #FFFEF8; --tinta: #2B2D2E; --guinda: #9D2148; --gris: #55585A; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --fondo: #1C1E20; --tinta: #ECEDEE; --guinda: #E07A9A; --gris: #A9ADB0; color-scheme: dark; } }
:root[data-theme="dark"] { --fondo: #1C1E20; --tinta: #ECEDEE; --guinda: #E07A9A; --gris: #A9ADB0; color-scheme: dark; }
body { background: var(--fondo); color: var(--tinta); font: 16px/1.5 Roboto, system-ui, sans-serif;
  padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); padding-block: 48px; }
main { max-width: 60ch; margin: 0 auto; display: grid; gap: 12px; }
h1 { margin: 0; color: var(--guinda); font: 700 1.6rem/1.2 Cabin, system-ui, sans-serif; }
p { margin: 0; color: var(--gris); }
a { color: var(--guinda); font-weight: 600; }
</style>
<main>
  <h1>Acreditaciones de arbolado urbano</h1>
  <p>Versión de prueba ${version} con datos ficticios. Abriendo la página de inicio…</p>
  <p><a href="inicio.html">Abrir la página de inicio</a></p>
</main>
<script>location.replace('inicio.html');</script>
`);

const lista = [];
for (const f of todos(salida)) {
  const r = relative(salida, f);
  if (['artefacto.html', 'archivos.json', '.nojekyll', 'formkit/LEEME.md'].includes(r)) continue;
  lista.push(r === 'VERSION' ? { path: r, contentType: 'text/plain' } : { path: r });
}
writeFileSync(join(salida, 'archivos.json'), JSON.stringify(lista));
console.log(`${lista.length} archivos en ${salida} (página principal: artefacto.html → inicio.html)`);
