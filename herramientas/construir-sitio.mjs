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
const MODULOS = ['opciones', 'combo', 'otro', 'identificadores', 'pasos', 'archivos', 'revision', 'acuse', 'modal', 'copiar', 'tooltip', 'acordeon', 'tabla'];
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
const paginas = ['index.html', 'cuenta.html', 'entrar.html', 'tramites.html', 'solicitud.html', 'datos.html', 'verificar.html', 'revision.html', 'revisar.html'];
for (const p of paginas) {
  const ruta = join(sitio, p);
  const html = readFileSync(ruta, 'utf8').replace(/\?v=[0-9.]+/g, `?v=${version}`);
  writeFileSync(ruta, html);
}

// 2b · Visor de documentos de la revisión (decisión 2026-10-16): pdf.js, copiado del paquete fijado en package.json
// (sin CDN). Sólo lo que usa el visor: la biblioteca, su trabajador y las fuentes estándar de los PDF.
const pdfjs = join(raiz, 'node_modules/pdfjs-dist');
if (!existsSync(pdfjs)) { console.error('Falta pdfjs-dist: corre npm install'); process.exit(1); }
const vendor = join(sitio, 'vendor/pdfjs');
rmSync(vendor, { recursive: true, force: true });
mkdirSync(vendor, { recursive: true });
for (const f of ['pdf.min.mjs', 'pdf.worker.min.mjs']) cpSync(join(pdfjs, 'build', f), join(vendor, f));
cpSync(join(pdfjs, 'standard_fonts'), join(vendor, 'standard_fonts'), { recursive: true });
cpSync(join(pdfjs, 'LICENSE'), join(vendor, 'LICENSE'));
const versionPdfjs = JSON.parse(readFileSync(join(pdfjs, 'package.json'), 'utf8')).version;
writeFileSync(join(vendor, 'LEEME.md'), `# pdf.js ${versionPdfjs} (copia)

Copia sin cambios de \`pdfjs-dist@${versionPdfjs}\` (Mozilla, licencia Apache 2.0, ver LICENSE). La genera
\`herramientas/construir-sitio.mjs\` desde node_modules; no se edita aquí. La usa \`app/visor.js\` para mostrar todas las
hojas de un documento en la revisión documental.
`);

// 3 · Datos ficticios y catálogos para el formulario
const datos = JSON.parse(readFileSync(join(raiz, 'datos/ficticios.json'), 'utf8'));
mkdirSync(join(sitio, 'datos'), { recursive: true });
cpSync(join(raiz, 'datos/ficticios.json'), join(sitio, 'datos/ficticios.json'));
// Documentos ficticios de varias hojas para el visor (herramientas/documentos-ficticios.py)
rmSync(join(sitio, 'datos/documentos'), { recursive: true, force: true });
cpSync(join(raiz, 'datos/documentos'), join(sitio, 'datos/documentos'), { recursive: true });
// Las 16 alcaldías (catálogo inicial de la base, con clave), en orden alfabético: van como opciones de la lista
// desplegable del fragmento de adscripción (abajo). Empresas ya registradas (tipo privada): catálogo del combo abierto.
// Arreglo simple: el módulo combo 1.0.0 sólo lee arreglos (P37).
const alcaldias = datos.organizacion.filter((o) => o.activa && o.tipo === 'alcaldia' && o.clave).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
const empresas = datos.organizacion.filter((o) => o.activa && o.tipo === 'privada').map((o) => o.nombre).sort((a, b) => a.localeCompare(b, 'es'));
// Carreras (apd.carrera): combo abierto que sugiere sólo las aceptadas de manera explícita por la Secretaría
// (principal, afín o disciplina afín); las escritas por las personas sin clasificar no se sugieren
const carreras = datos.carrera.filter((c) => c.activa && ['principal', 'afin', 'disciplina_afin'].includes(c.grupo))
  .map((c) => c.nombre).sort((a, b) => a.localeCompare(b, 'es'));
writeFileSync(join(sitio, 'datos/catalogos.js'), `/* Generado por herramientas/construir-sitio.mjs desde datos/ficticios.json. No se edita a mano.
   Empresas, consultorías y particulares ya registrados (apd.organizacion, tipo privada; FICTICIOS) y carreras
   (apd.carrera), corte
   ${datos.fecha_corte}. En producción lo sirve la base. */
window.FORMKIT_CATALOGOS = Object.assign(window.FORMKIT_CATALOGOS || {}, {
  empresas: ${JSON.stringify(empresas)},
  carreras: ${JSON.stringify(carreras)}
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
    return `          <div class="campo" data-campo="${nombre}"${rc.obligatorio ? ' data-requerido' : ''} data-max="1" data-extensiones="${extensionesDe(r)}" data-mb="5" data-nombre-archivo="${esc(r.nombre_archivo || limpia(r.nombre).toUpperCase())}"
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

// 4b · Revisión documental del personal (etapa 2): un bloque por requisito que se carga en línea, en el orden del
// catálogo. Se revisa sólo si la solicitud lo tiene cargado y no se rechaza por perfil: lo dice revisar_<requisito>,
// que calculan la página y el servidor (una sola condición por campo, P38).
// Motivos frecuentes de observación (decisión 2026-10-16; la Dirección puede ajustarlos).
const MOTIVOS = ['No se lee completo', 'Está vencido', 'No corresponde al requisito', 'Falta una página', 'No coincide con el nombre de la cuenta'];
const enLinea = [...new Map(datos.requisito_curso
  .filter((rc) => requisito[rc.requisito].forma === 'documento' && requisito[rc.requisito].momento === 'en_linea')
  .sort((x, y) => x.orden - y.orden)
  .map((rc) => [rc.requisito, requisito[rc.requisito]])).values()];
const revisionDocs = enLinea.map((r) => {
  const k = r.clave;
  return `        <div data-si="revisar_${k}=si">
          <article class="doc-revision" data-doc="${k}">
            <div class="doc-cabeza">
              <h4 class="doc-titulo">${esc(r.nombre)}</h4>
              <span class="estado" data-doc-estado>Por revisar</span>
            </div>
            <p class="doc-archivo" data-doc-archivo></p>
            <p><button type="button" class="btn-enlace doc-ver" data-ver="${k}">Ver documento<span class="solo-lector">: ${esc(r.nombre)}</span></button></p>
            <fieldset class="grupo" data-campo="decision_${k}" data-requerido data-uso="Registrar si «${esc(r.nombre)}» cumple el requisito (apd.documento.estado).">
              <legend class="etiqueta">¿El documento cumple?</legend>
              <!-- autocomplete off: decisión de quien revisa; el navegador no tiene un valor que proponer. -->
              <div class="opciones-lista opciones-en-linea">
                <label class="opcion-fila"><input class="opcion-fila-input" type="radio" name="decision_${k}" autocomplete="off" value="aceptado"><span><span class="opcion-nombre">Sí, aceptarlo</span></span></label>
                <label class="opcion-fila"><input class="opcion-fila-input" type="radio" name="decision_${k}" autocomplete="off" value="con_observacion"><span><span class="opcion-nombre">No, observarlo</span></span></label>
              </div>
            </fieldset>
            <div class="campo" data-campo="observacion_${k}" data-requerido data-si="decision_${k}=con_observacion" data-uso="Decirle a la persona qué debe corregir de «${esc(r.nombre)}»; se le muestra tal cual (apd.documento.observacion).">
              <label class="etiqueta" for="observacion_${k}">¿Qué debe corregir la persona?</label>
              <p class="ayuda" id="ay-observacion_${k}">Puede elegir un motivo frecuente y completarlo. La persona lo leerá tal como lo escriba.</p>
              <div class="sugerencias" role="group" aria-label="Motivos frecuentes para ${esc(r.nombre)}">
${MOTIVOS.map((m) => `                <button type="button" class="sugerencia" data-sugerencia="${esc(m)}">${esc(m)}</button>`).join('\n')}
              </div>
              <!-- autocomplete off: texto de quien revisa; el navegador no tiene un valor que proponer. -->
              <textarea class="control" id="observacion_${k}" name="observacion_${k}" rows="3" minlength="10" maxlength="400" autocomplete="off"></textarea>
            </div>
          </article>
        </div>`;
});
const auxiliares = enLinea.map((r) => `      <div class="solo-lector" aria-hidden="true" data-campo="revisar_${r.clave}" data-auxiliar data-uso="Pedir la revisión de «${esc(r.nombre)}» sólo si está cargado y la solicitud no se rechaza por perfil; lo calculan la página y el servidor."><input type="hidden" id="revisar_${r.clave}" name="revisar_${r.clave}" value="no"></div>`);
{
  const r = join(sitio, 'revisar.html');
  let h = readFileSync(r, 'utf8');
  for (const [marca, contenido] of [['revision-documentos', revisionDocs.join('\n')], ['revision-auxiliares', auxiliares.join('\n')]]) {
    const ini = h.match(new RegExp(`^( *)<!-- ${marca}:inicio[^>]*-->`, 'm'));
    const f = h.indexOf(`<!-- ${marca}:fin -->`);
    if (!ini || f < 0) { console.error(`Faltan los marcadores ${marca} en sitio/revisar.html`); process.exit(1); }
    h = h.slice(0, ini.index + ini[0].length) + '\n' + contenido + '\n' + ini[1] + h.slice(f);
  }
  writeFileSync(r, h);
}

// 5 · Adscripción: un solo fragmento (herramientas/plantillas/adscripcion.html) en «Crea tu cuenta» y en «Mis datos»
const fragmento = readFileSync(join(raiz, 'herramientas/plantillas/adscripcion.html'), 'utf8').trimEnd()
  .replace(/^( *)<!-- alcaldias:opciones -->$/m, (_, s) => alcaldias.map((o) => `${s}<option value="${esc(o.clave)}">${esc(o.nombre)}</option>`).join('\n'));
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

console.log(`sitio/ construido · versión ${version} · estándar ${cambios ? cambios[1] : '?'} · ${alcaldias.length} alcaldías · ${bloques.length} grupos de documentos · ${enLinea.length} documentos en la revisión`);
