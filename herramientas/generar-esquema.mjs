// Genera, a partir de db/esquema.json (fuente única del modelo de datos):
//   - db/apd/02-apd-tablas.sql   (tablas, restricciones, índices y comentarios)
//   - docs/MODELO-DE-DATOS.md    (la misma información, para leer)
//
// Uso:
//   node herramientas/generar-esquema.mjs              escribe los dos archivos
//   node herramientas/generar-esquema.mjs --verificar  sólo comprueba que estén al día (sale con 1 si no)
//
// Los archivos generados no se editan a mano: se cambia el diccionario y se vuelve a generar.
// Sin dependencias: sólo Node.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const diccionario = JSON.parse(readFileSync(join(raiz, 'db/esquema.json'), 'utf8'));
const esquema = diccionario.esquema;

const AVISO = 'Archivo generado por herramientas/generar-esquema.mjs desde db/esquema.json. No se edita a mano.';

function literal(texto) {
  return "'" + String(texto).replace(/'/g, "''") + "'";
}

function generarSql() {
  const lineas = [
    `-- TABLAS DEL ESQUEMA ${esquema} · ${diccionario.proyecto}.`,
    `-- ${AVISO}`,
    '-- Lo corre quien administra la base, dentro de instalar.sql, después de 01-apd-esquema.sql.',
    ''
  ];
  for (const t of diccionario.tablas) {
    const cuerpo = [
      ...t.columnas.map((c) => {
        let def = `  ${c.nombre.padEnd(26)} ${c.tipo.padEnd(13)} ${c.nulo ? 'NULL' : 'NOT NULL'}`;
        if (c.defecto !== undefined) def += ` DEFAULT ${c.defecto}`;
        return def;
      }),
      ...(t.restricciones || []).map((r) => `  ${r}`)
    ];
    lineas.push(`CREATE TABLE ${esquema}.${t.nombre} (`, cuerpo.join(',\n'), ');');
    for (const i of t.indices || []) lineas.push(`${i};`);
    lineas.push(`COMMENT ON TABLE ${esquema}.${t.nombre} IS ${literal(t.descripcion)};`);
    for (const c of t.columnas) {
      lineas.push(`COMMENT ON COLUMN ${esquema}.${t.nombre}.${c.nombre} IS ${literal(c.descripcion)};`);
    }
    lineas.push('');
  }
  for (const a of diccionario.alteraciones || []) {
    lineas.push(`-- ${a.porque}`, `${a.sql};`, '');
  }
  return lineas.join('\n');
}

function generarMd() {
  const lineas = [
    `# Modelo de datos · esquema \`${esquema}\``,
    '',
    `> ${AVISO}`,
    '',
    'Las reglas que la base impone además de estas restricciones (estados, cupos, vigencia, folios, bitácora)',
    'están en `db/apd/03-apd-reglas.sql` y se describen en `docs/REGLAS.md`.',
    '',
    '## Tablas',
    ''
  ];
  for (const t of diccionario.tablas) lineas.push(`- [\`${t.nombre}\`](#${t.nombre}) — ${t.descripcion}`);
  lineas.push('');
  for (const t of diccionario.tablas) {
    lineas.push(`## ${t.nombre}`, '', t.descripcion, '', '| Campo | Tipo | Obligatorio | Descripción |', '|---|---|---|---|');
    for (const c of t.columnas) {
      const desc = c.descripcion.replace(/\|/g, '\\|') + (c.defecto !== undefined ? ` (por omisión: \`${c.defecto}\`)` : '');
      lineas.push(`| \`${c.nombre}\` | \`${c.tipo}\` | ${c.nulo ? 'No' : 'Sí'} | ${desc} |`);
    }
    lineas.push('');
    const extras = [...(t.restricciones || []), ...(t.indices || [])];
    if (extras.length) {
      lineas.push('Restricciones e índices:', '', ...extras.map((r) => `- \`${r.replace(/`/g, '')}\``), '');
    }
  }
  if ((diccionario.alteraciones || []).length) {
    lineas.push('## Llaves entre tablas que se agregan al final', '');
    for (const a of diccionario.alteraciones) lineas.push(`- ${a.porque}`, `  \`${a.sql}\``);
    lineas.push('');
  }
  return lineas.join('\n');
}

const salidas = [
  [join(raiz, 'db/apd/02-apd-tablas.sql'), generarSql()],
  [join(raiz, 'docs/MODELO-DE-DATOS.md'), generarMd()]
];

if (process.argv.includes('--verificar')) {
  const atrasados = salidas.filter(([ruta, texto]) => !existsSync(ruta) || readFileSync(ruta, 'utf8') !== texto);
  for (const [ruta] of atrasados) console.error(`Desactualizado: ${ruta}. Corre node herramientas/generar-esquema.mjs`);
  process.exit(atrasados.length ? 1 : 0);
}
for (const [ruta, texto] of salidas) {
  writeFileSync(ruta, texto);
  console.log(`Escrito ${ruta.replace(raiz + '/', '')}`);
}
