// CONSTRUYE sitio/ para publicarlo: copia el Estándar de formularios del SIA (sin editarlo), la versión,
// los datos ficticios y los catálogos, y genera el paso de documentos de la solicitud desde el catálogo de
// requisitos de la base (una sola fuente: db/apd/04-apd-catalogos.sql → datos/ficticios.json).
//
// Uso: node herramientas/construir-sitio.mjs <ruta-al-clon-de-estandar-formularios>
//
// Lo que escribe es generado y no se edita a mano: sitio/formkit/, sitio/datos/, sitio/VERSION,
// sitio/app/version-visible.*, y el bloque entre los marcadores «documentos» de sitio/solicitud.html.

import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const estandar = process.argv[2];
if (!estandar || !existsSync(join(estandar, 'codigo/manifiesto.json'))) {
  console.error('Uso: node herramientas/construir-sitio.mjs <ruta-al-clon-de-estandar-formularios>');
  process.exit(2);
}
const sitio = join(raiz, 'sitio');

// 1 · Estándar: núcleo y sólo los módulos que usa el sitio, en su forma original
const MODULOS = ['opciones', 'combo', 'otro', 'identificadores', 'pasos', 'archivos', 'revision', 'acuse', 'modal', 'copiar', 'tooltip', 'acordeon'];
const destino = join(sitio, 'formkit');
rmSync(destino, { recursive: true, force: true });
for (const d of ['css', 'js', 'fuentes', 'iconos', 'imagenes']) cpSync(join(estandar, 'codigo', d), join(destino, d), { recursive: true });
for (const m of MODULOS) cpSync(join(estandar, 'codigo/modulos', m), join(destino, 'modulos', m), { recursive: true });
const cambios = readFileSync(join(estandar, 'CHANGELOG.md'), 'utf8').match(/^## ([0-9.]+) · ([0-9-]+)/m);
writeFileSync(join(destino, 'LEEME.md'), `# Estándar de formularios del SIA (copia)

Copia sin cambios de \`SedemaOficina/estandar-formularios\`, versión ${cambios ? cambios[1] + ' del ' + cambios[2] : '[sin identificar]'}.
La genera \`herramientas/construir-sitio.mjs\`. No se edita aquí: un cambio al estándar se hace en su repositorio.
Módulos copiados: ${MODULOS.join(', ')}.
`);

// 2 · Versión (una sola fuente: VERSION en la raíz) y su distintivo
const version = readFileSync(join(raiz, 'VERSION'), 'utf8').trim();
writeFileSync(join(sitio, 'VERSION'), version + '\n');
mkdirSync(join(sitio, 'app'), { recursive: true });
const plantillaVersion = join(raiz, 'herramientas/plantillas/version');
cpSync(join(plantillaVersion, 'version-visible.js'), join(sitio, 'app/version-visible.js'));
// La hoja de la plantilla usa valores literales; aquí va su equivalente con los tokens del estándar
cpSync(join(plantillaVersion, 'version-visible.formkit.css'), join(sitio, 'app/version-visible.css'));
// El ?v= de cada archivo propio sale de VERSION: se reescribe en todas las páginas
const paginas = ['index.html', 'cuenta.html', 'entrar.html', 'tramites.html', 'solicitud.html', 'datos.html', 'verificar.html'];
for (const p of paginas) {
  const ruta = join(sitio, p);
  const html = readFileSync(ruta, 'utf8').replace(/\?v=[0-9.]+/g, `?v=${version}`);
  writeFileSync(ruta, html);
}

// 3 · Datos ficticios y catálogos para el formulario
const datos = JSON.parse(readFileSync(join(raiz, 'datos/ficticios.json'), 'utf8'));
mkdirSync(join(sitio, 'datos'), { recursive: true });
cpSync(join(raiz, 'datos/ficticios.json'), join(sitio, 'datos/ficticios.json'));
// Catálogo cerrado de alcaldías (las 16 del catálogo inicial de la base, con clave). Arreglo simple: el módulo combo
// 1.0.0 sólo lee arreglos (su docs/06 dice que también acepta {filas, fuente, corte, es_ficticio}, pero combo.js
// no lo implementa; reportado al estándar, P37).
const alcaldias = datos.organizacion.filter((o) => o.activa && o.tipo === 'alcaldia' && o.clave).map((o) => o.nombre).sort((a, b) => a.localeCompare(b, 'es'));
writeFileSync(join(sitio, 'datos/catalogos.js'), `/* Generado por herramientas/construir-sitio.mjs desde datos/ficticios.json. No se edita a mano.
   Alcaldías de la Ciudad de México. Fuente: catálogo inicial de apd.organizacion (db/apd/04-apd-catalogos.sql),
   corte ${datos.fecha_corte}. En producción lo sirve la base. */
window.FORMKIT_CATALOGOS = Object.assign(window.FORMKIT_CATALOGOS || {}, {
  alcaldias: ${JSON.stringify(alcaldias)}
});
`);

// 4 · Paso de documentos: un grupo por curso, un campo por requisito que carga la persona
// Las marcas internas del catálogo («[pendiente] …») son para la Secretaría, no para la persona; el mismo
// criterio que APD.limpia en sitio/app/apd.js
const limpia = (t) => String(t || '').replace(/\s*\[pendiente[^\]]*\][^.]*\.?/gi, '').trim();
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const requisito = Object.fromEntries(datos.requisito.map((r) => [r.clave, r]));
// Formatos de cada requisito, de la base (los que carga la persona: sólo PDF, decisión 2026-10-15)
const EXT = { 'application/pdf': ['pdf'], 'image/jpeg': ['jpg', 'jpeg'], 'image/png': ['png'] };
const extensionesDe = (r) => (r.formatos || ['application/pdf']).flatMap((m) => EXT[m] || []).join(',');
// Dónde obtener el documento (p. ej. la CURP en gob.mx): se abre en otra pestaña y lo dice
const enlaceDe = (r) => (r.enlace ? ` <a href="${esc(r.enlace)}" target="_blank" rel="noopener">${esc(r.enlace_texto)}<span class="solo-lector"> (se abre en otra pestaña)</span></a>.` : '');
const cursos = [['poda', 'nueva'], ['poda', 'renovacion'], ['dictaminador', 'nueva'], ['dictaminador', 'renovacion']];
const bloques = [];
for (const [tipo, modalidad] of cursos) {
  const filas = datos.requisito_curso
    .filter((rc) => rc.tipo_acreditacion === tipo && rc.modalidad === modalidad && requisito[rc.requisito].forma === 'documento' && requisito[rc.requisito].momento === 'en_linea')
    .sort((a, b) => a.orden - b.orden);
  const campos = filas.map((rc) => {
    const r = requisito[rc.requisito];
    const nombre = `doc_${tipo}_${modalidad}_${rc.requisito}`;
    const nota = limpia(rc.nota) ? ` ${limpia(rc.nota)}` : '';
    return `          <div class="campo" data-campo="${nombre}"${rc.obligatorio ? ' data-requerido' : ''} data-max="1" data-extensiones="${extensionesDe(r)}" data-mb="5"
               data-uso="Comprobar el requisito «${esc(r.nombre)}» del trámite." data-finalidad="Revisar que la persona cumple los requisitos de la acreditación." data-sensible>
            <span class="etiqueta" id="et-${nombre}">${esc(r.nombre)}${rc.obligatorio ? '' : ' (si aplica)'}</span>
            <p class="ayuda" id="ay-${nombre}">${esc(limpia(r.descripcion))}${esc(nota)}${enlaceDe(r)}</p>
            <div data-archivos>
              <button type="button" class="zona-carga" aria-describedby="ay-${nombre}">
                <svg class="icono" aria-hidden="true"><use href="#i-adjunto"></use></svg>
                <span class="zona-carga-texto">Elegir archivo</span>
                <span class="zona-carga-limite" data-limite-texto></span>
              </button>
              <!-- autocomplete off: es un archivo; el navegador no tiene nada que proponer. -->
              <input type="file" hidden autocomplete="off">
              <div data-rechazos></div>
              <ul class="lista-arch"></ul>
            </div>
          </div>`;
  });
  // Una sola condición por bloque (sin anidar): el esquema del servidor sólo lee el data-si más cercano
  bloques.push(`        <div data-si="tramite=${tipo}_${modalidad}">
${campos.join('\n')}
        </div>`);
}
const ruta = join(sitio, 'solicitud.html');
const html = readFileSync(ruta, 'utf8');
const inicio = '<!-- documentos:inicio (generado por herramientas/construir-sitio.mjs; no se edita a mano) -->';
const fin = '<!-- documentos:fin -->';
const a = html.indexOf(inicio), b = html.indexOf(fin);
if (a < 0 || b < 0) { console.error('Faltan los marcadores de documentos en sitio/solicitud.html'); process.exit(1); }
writeFileSync(ruta, html.slice(0, a + inicio.length) + '\n' + bloques.join('\n') + '\n        ' + html.slice(b));

// 5 · Adscripción: un solo fragmento (herramientas/plantillas/adscripcion.html) en «Crea tu cuenta» y en «Mis datos»
const fragmento = readFileSync(join(raiz, 'herramientas/plantillas/adscripcion.html'), 'utf8').trimEnd();
for (const p of ['cuenta.html', 'datos.html']) {
  const r = join(sitio, p);
  const h = readFileSync(r, 'utf8');
  const ini = h.match(/^( *)<!-- adscripcion:inicio[^>]*-->/m);
  const fin2 = h.indexOf('<!-- adscripcion:fin -->');
  if (!ini || fin2 < 0) { console.error(`Faltan los marcadores de adscripción en sitio/${p}`); process.exit(1); }
  const sangria = ini[1];
  const dentro = fragmento.split('\n').map((l) => (l ? sangria + l : l)).join('\n');
  writeFileSync(r, h.slice(0, ini.index + ini[0].length) + '\n' + dentro + '\n' + sangria + h.slice(fin2));
}

console.log(`sitio/ construido · versión ${version} · estándar ${cambios ? cambios[1] : '?'} · ${alcaldias.length} alcaldías · ${bloques.length} grupos de documentos`);
