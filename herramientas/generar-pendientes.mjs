// PENDIENTES · una sola fuente (docs/pendientes.json) para dos salidas:
//   · docs/PENDIENTES.md            — el registro en el repositorio;
//   · docs/tablero-pendientes.html  — la página del tablero (artefacto «Pendientes del sistema»), donde Liber
//                                     marca cada pendiente y responde; sus marcas viven en el guardado del
//                                     artefacto y se aplican aquí al pedirlo.
// Uso: node herramientas/generar-pendientes.mjs [--verificar]
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const datos = JSON.parse(readFileSync(join(raiz, 'docs/pendientes.json'), 'utf8'));
const fecha = (iso) => iso.split('-').reverse().join('/');
const celda = (t) => String(t).replace(/\|/g, '\\|');

// Comprobaciones: números únicos y consecutivos, grupo conocido
const ids = datos.pendientes.map((p) => p.id);
if (new Set(ids).size !== ids.length) throw new Error('Hay números de pendiente repetidos');
const grupos = new Set(datos.grupos.map((g) => g.id));
for (const p of datos.pendientes) if (!grupos.has(p.grupo)) throw new Error(`${p.id}: grupo desconocido ${p.grupo}`);
// Resueltos: el que lleva «(Pnn)» en el título tiene ese mismo número en «id»; ningún número se repite ni sigue abierto
const resueltos = new Set();
for (const r of datos.resueltos) {
  const m = r.titulo.match(/\((P\d+)\)/);
  if (m && r.id !== m[1]) throw new Error(`Resuelto «${r.titulo}»: falta "id": "${m[1]}" o no coincide (${r.id})`);
  if (r.id === undefined) continue;
  if (!/^P\d+$/.test(r.id)) throw new Error(`Resuelto «${r.titulo}»: id inválido ${r.id}`);
  if (resueltos.has(r.id)) throw new Error(`${r.id} está dos veces entre los resueltos`);
  if (ids.includes(r.id)) throw new Error(`${r.id} está a la vez entre los pendientes y los resueltos`);
  resueltos.add(r.id);
}

let md = `# Pendientes

Generado por \`herramientas/generar-pendientes.mjs\` desde \`docs/pendientes.json\` (la fuente: se edita ahí). El
mismo contenido está en el tablero «Pendientes del sistema», donde se marca cada uno y se responde. Cada
pendiente tiene un número fijo que no se reutiliza; al resolverse pasa a «Resueltos» y la decisión se anota en
\`docs/DECISIONES.md\`. P106 a P108 no existen: se renumeraron como P110 a P112 (17/10/2026).
La columna **Lineamientos** dice qué artículo del anteproyecto de lineamientos toca el pendiente
(el texto vive fuera de este repositorio público; ver «Lineamientos» en \`docs/DECISIONES.md\`).

Actualizado: ${fecha(datos.actualizado)}. **Bloquea** dice desde cuándo hace falta: *datos reales* = antes del
primer dato real; *lanzamiento* = antes de abrir el sistema al público; *SIA* = antes de pasar al SIA; *etapa N* =
antes de cerrar esa etapa; *no* = se puede avanzar.
`;
for (const g of datos.grupos) {
  const lista = datos.pendientes.filter((p) => p.grupo === g.id);
  if (!lista.length) continue;
  md += `\n## ${g.nombre} (${g.nota})\n\n| # | Pendiente | Recomendación | Lineamientos | Bloquea |\n|---|---|---|---|---|\n`;
  for (const p of lista) md += `| ${p.id} | ${celda(p.titulo)} | ${celda(p.recomendacion)} | ${celda(p.lineamientos || '—')} | ${p.bloquea} |\n`;
}
md += `\n## Resueltos\n\n| Tema | Cómo quedó | Fecha |\n|---|---|---|\n`;
for (const r of datos.resueltos) md += `| ${celda(r.titulo)} | ${celda(r.como)} | ${fecha(r.fecha)} |\n`;

const plantilla = readFileSync(join(raiz, 'herramientas/plantillas/pendientes/tablero.html'), 'utf8');
if (!plantilla.includes('/*DATOS*/null')) throw new Error('La plantilla del tablero no tiene el marcador /*DATOS*/null');
const html = plantilla.replace('/*DATOS*/null', JSON.stringify(datos).replace(/</g, '\\u003c'));

const salidas = [['docs/PENDIENTES.md', md], ['docs/tablero-pendientes.html', html]];
if (process.argv.includes('--verificar')) {
  const viejas = salidas.filter(([r, t]) => readFileSync(join(raiz, r), 'utf8') !== t).map(([r]) => r);
  if (viejas.length) { console.error('Desactualizados: ' + viejas.join(', ')); process.exit(1); }
  console.log('Pendientes al día.');
} else {
  for (const [r, t] of salidas) writeFileSync(join(raiz, r), t);
  console.log(`${datos.pendientes.length} pendientes y ${datos.resueltos.length} resueltos → ${salidas.map(([r]) => r).join(', ')}`);
}
