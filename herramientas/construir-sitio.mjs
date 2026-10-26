// CONSTRUYE sitio/ para publicarlo: copia el Estándar de formularios del SIA (sin editarlo), la versión,
// los datos ficticios y los catálogos, y genera el paso de documentos de la solicitud desde el catálogo de
// requisitos de la base (una sola fuente: db/apd/04-apd-catalogos.sql → datos/ficticios.json).
//
// Uso: node herramientas/construir-sitio.mjs <ruta-a-estandares-sia/formularios>
//   (git clone --depth 1 https://github.com/SedemaOficina/estandares-sia; el estándar vive en su carpeta formularios/)
//
// Lo que escribe es generado y no se edita a mano: sitio/formkit/, sitio/datos/ (con examen-ficticio.js, copiado de datos/), sitio/VERSION,
// sitio/vendor/pdfjs-dist/, sitio/app/version-visible.js, y los bloques entre marcadores de solicitud.html, revisar.html, cotejo.html,
// corregir.html, cuenta.html, datos.html y asistido.html.

import { cpSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const estandar = process.argv[2];
if (!estandar || !existsSync(join(estandar, 'codigo/manifiesto.json'))) {
  console.error('Uso: node herramientas/construir-sitio.mjs <ruta-a-estandares-sia/formularios>');
  process.exit(2);
}
const sitio = join(raiz, 'sitio');

// 1 · Estándar: núcleo y sólo los módulos que usa el sitio, en su forma original
// Desde la 1.2.0: visor de documentos (P67), chips fijos (P65) y fecha día/mes/año (módulo fecha, P70); desde la 1.1.0, el
// distintivo de versión (version, P45); desde la 1.4.0, el resultado de una decisión (resultado, P113) y las etiquetas de
// estado en cinco familias (estado, P118)
const MODULOS = ['opciones', 'combo', 'otro', 'identificadores', 'pasos', 'archivos', 'revision', 'acuse', 'modal', 'copiar', 'tooltip', 'acordeon', 'tabla',
  'visor', 'version', 'chips', 'fecha', 'resultado', 'estado',
  // Acomodo de escritorio (decisión de Liber del 25/10/2026), estándar 1.5.1: pestañas (inicio del personal, «Grupos» y
  // ficha del grupo, sólo desde 1024 px) y paginación (inicio del personal)
  'pestanas', 'paginacion'];
const destino = join(sitio, 'formkit');
rmSync(destino, { recursive: true, force: true });
for (const d of ['css', 'js', 'fuentes', 'iconos', 'imagenes']) cpSync(join(estandar, 'codigo', d), join(destino, d), { recursive: true });
for (const m of MODULOS) cpSync(join(estandar, 'codigo/modulos', m), join(destino, 'modulos', m), { recursive: true });
const cambios = readFileSync(join(estandar, 'CHANGELOG.md'), 'utf8').match(/^## ([0-9.]+) · ([0-9-]+)/m);
writeFileSync(join(destino, 'LEEME.md'), `# Estándar de formularios del SIA (copia)

Copia sin cambios de \`SedemaOficina/estandares-sia\` (carpeta \`formularios/\`), versión ${cambios ? cambios[1] + ' del ' + cambios[2] : '[sin identificar]'}.
La genera \`herramientas/construir-sitio.mjs\`. No se edita aquí: un cambio al estándar se hace en su repositorio.
Módulos copiados: ${MODULOS.join(', ')}.
`);

// 2 · Versión (una sola fuente: VERSION en la raíz) y su distintivo
const version = readFileSync(join(raiz, 'VERSION'), 'utf8').trim();
writeFileSync(join(sitio, 'VERSION'), version + '\n');
mkdirSync(join(sitio, 'app'), { recursive: true });
const plantillaVersion = join(raiz, 'herramientas/plantillas/version');
cpSync(join(plantillaVersion, 'version-visible.js'), join(sitio, 'app/version-visible.js'));
// La hoja del distintivo es el módulo «version» del estándar (formkit/modulos/version/version.css, mismas clases)
// El ?v= de cada archivo propio sale de VERSION; el de los archivos del estándar (formkit/…), de la versión del estándar,
// para que el navegador no use una copia vieja después de cambiar de estándar (auditoría 2026-10-18, A 8.14). Se
// reescribe en TODAS las páginas de sitio/ (A 8.1: la lista escrita a mano había dejado fuera las de material).
const versionEstandar = cambios ? cambios[1] : '0';
// Política de contenido y de referente, la misma en todas las páginas (auditoría 2026-10-19, B7-01; decisión 9 de Liber).
// GitHub Pages no deja poner encabezados: va como etiqueta meta, justo después de charset, antes de cualquier recurso.
// En el SIA se manda como encabezado del servidor web (con frame-ancestors 'none', que en meta no aplica).
//   blob: en img-src, worker-src y connect-src: vistas previas de fotos y documentos, y el visor de PDF.
//   data: en img-src: el icono vacío (href="data:,") y las imágenes que arma el navegador al recodificar fotos.
const CSP = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob: data:; font-src 'self'; "
  + "connect-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'self'";
const META_CSP = `<meta http-equiv="Content-Security-Policy" content="${CSP}">\n<meta name="referrer" content="same-origin">`;
// Excepción documentada (decisión de Liber del 23/10/2026, P68): la página que lleva el mapa de Google de la sede (marcada
// con data-mapa-sede; hoy sólo «Mis trámites») permite ese marco y nada más: frame-src con los dos dominios del mapa sin
// clave (maps.google.com, que puede redirigir a www.google.com). Ni scripts ni estilos de Google: el mapa corre dentro de
// su marco, con su propia política. Las demás páginas siguen con la política estricta (SOLO=csp de probar-sitio).
const CSP_MAPA = `${CSP}; frame-src https://www.google.com https://maps.google.com`;
const META_CSP_MAPA = META_CSP.replace(CSP, CSP_MAPA);
// La versión, escrita en cada página (auditoría 2026-10-20, B6-04 y D4-03; decisión 7a de Liber): el distintivo y el
// menú de pruebas la leen de aquí, así que dicen la versión del código que corre, también sin red o con una copia vieja
// en caché, y la página ya no pide VERSION (lo pedía dos veces). herramientas/nueva-version.mjs la sube al publicar.
const META_VERSION = `<meta name="sia-version" content="${version}">`;
const paginas = readdirSync(sitio).filter((f) => f.endsWith('.html'));
for (const p of paginas) {
  const ruta = join(sitio, p);
  const original = readFileSync(ruta, 'utf8');
  const meta = /\sdata-mapa-sede[\s>]/.test(original) ? META_CSP_MAPA : META_CSP;
  const html = original
    .replace(/((?:href|src)="(?!formkit\/)[^"?]+)\?v=[0-9.]+"/g, `$1?v=${version}"`)
    .replace(/((?:href|src)="formkit\/[^"?]+\.(?:css|js))(?:\?v=[0-9.]+)?"/g, `$1?v=${versionEstandar}"`)
    .replace(/<meta http-equiv="Content-Security-Policy"[^>]*>\n?/g, '').replace(/<meta name="referrer"[^>]*>\n?/g, '')
    .replace(/<meta name="sia-version"[^>]*>\n?/g, '')
    .replace(/<meta charset="utf-8">\n/, `<meta charset="utf-8">\n${meta}\n${META_VERSION}\n`);
  if (!html.includes(meta)) throw new Error(`${p}: no se pudo poner la política de contenido (falta <meta charset="utf-8">)`);
  writeFileSync(ruta, html);
}

// 2b · Visor de documentos (módulo «visor» del estándar, P67): pdf.js 4.10.38 del propio estándar (vendor/pdfjs-dist, sin
// CDN), copiado en sitio/vendor/pdfjs-dist/, junto a sitio/formkit/: desde la 1.3.2 el visor lo busca ahí solo (P96).
const pdfjs = join(estandar, 'vendor/pdfjs-dist');
if (!existsSync(pdfjs)) { console.error('Falta vendor/pdfjs-dist en el estándar'); process.exit(1); }
rmSync(join(sitio, 'vendor'), { recursive: true, force: true });
cpSync(pdfjs, join(sitio, 'vendor/pdfjs-dist'), { recursive: true });
// Licencias de terceros (auditoría 2026-10-19, F3-02): del manifiesto del estándar, sólo lo que se copia aquí, con su
// versión, licencia y huella; LICENCIA.md lo resume
const manifiesto = JSON.parse(readFileSync(join(estandar, 'vendor/MANIFIESTO.json'), 'utf8'));
const copiadas = manifiesto.bibliotecas.filter((b) => b.paquete === 'pdfjs-dist');
if (copiadas.length !== 1) { console.error('El manifiesto del estándar no trae pdfjs-dist'); process.exit(1); }
writeFileSync(join(sitio, 'vendor/MANIFIESTO.json'), JSON.stringify({ origen: `Estándar de formularios del SIA, vendor/MANIFIESTO.json (${manifiesto.origen})`,
  generado: manifiesto.generado, bibliotecas: copiadas }, null, 2) + '\n');

// 3 · Datos ficticios y catálogos para el formulario
const datos = JSON.parse(readFileSync(join(raiz, 'datos/ficticios.json'), 'utf8'));
mkdirSync(join(sitio, 'datos'), { recursive: true });
cpSync(join(raiz, 'datos/ficticios.json'), join(sitio, 'datos/ficticios.json'));
// Banco de reactivos FICTICIO del examen en línea (preguntas sobre el propio trámite; el real nunca entra aquí, P85)
cpSync(join(raiz, 'datos/examen-ficticio.js'), join(sitio, 'datos/examen-ficticio.js'));
// Documentos ficticios de varias hojas para el visor (herramientas/documentos-ficticios.py)
rmSync(join(sitio, 'datos/documentos'), { recursive: true, force: true });
cpSync(join(raiz, 'datos/documentos'), join(sitio, 'datos/documentos'), { recursive: true });
// Las 16 alcaldías (catálogo inicial de la base, con clave), en orden alfabético: van como opciones de la lista
// desplegable del fragmento de adscripción (abajo). Empresas ya registradas (tipo privada): catálogo del combo abierto.
// Cada catálogo con su fuente, corte y aviso de datos ficticios: {filas, fuente, corte, es_ficticio} (estándar 1.1.0, P37).
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
  empresas: { filas: ${JSON.stringify(empresas)}, fuente: 'apd.organizacion (tipo privada)', corte: '${datos.fecha_corte}', es_ficticio: true },
  carreras: { filas: ${JSON.stringify(carreras)}, fuente: 'apd.carrera (principal, afín o disciplina afín)', corte: '${datos.fecha_corte}', es_ficticio: true }
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
// El formato y el tamaño se dicen una vez, en la bajada del paso («Un archivo por documento, sólo en PDF, de hasta
// 5 MB»), y no en cada zona de carga (auditoría 2026-10-20, C3-02: se repetía 4 veces en poda y 7 en dictaminador). La
// frase de cada zona es la pieza [data-limite-texto] del módulo archivos, que la escribe sólo si existe (archivos.js:
// «if (lim)»); el formato y el tamaño los sigue validando el módulo con data-extensiones y data-mb.
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
// Lo que el personal revisa de un documento, además de su nombre (sesión de trabajo del 23/10/2026, P196): la constancia
// de situación fiscal es de la persona solicitante, reciente («del mes en curso» mientras se fija cuántos días de
// antigüedad se aceptan) y de ella salen los datos de la factura. Va en la revisión y en el cotejo.
const NOTA_PERSONAL = {
  constancia_situacion_fiscal: 'Debe ser de la persona solicitante y reciente: del mes en curso <span class="pendiente">[pendiente P196: cuántos días de antigüedad se aceptan]</span>. De ella se toman su nombre, su régimen y su domicilio fiscal para la factura.'
};
const notaPersonal = (k, sangria) => (NOTA_PERSONAL[k] ? `\n${sangria}<p class="ayuda">${NOTA_PERSONAL[k]}</p>` : '');
// «Revisar una solicitud» por pasos (decisión de Liber del 24/10/2026, maqueta «Pantallas por pasos: propuestas»): un paso
// por documento con la pregunta «¿El documento está bien?». La página quita, antes de iniciar el formulario, los pasos de
// los documentos que la solicitud no trae (app/revisar.js): el número de pasos es el de los documentos que pide su
// requisito. Mismos campos y condiciones que antes (decision_<requisito>, observacion_<requisito>): el esquema no cambia.
// En la barra de pasos, el nombre corto: la sigla entre paréntesis si la tiene («CURP»).
const corto = (n) => { const m = String(n).match(/\(([^)]+)\)\s*$/); return m ? m[1] : n; };
const pideDe = (r) => (NOTA_PERSONAL[r.clave] ? NOTA_PERSONAL[r.clave] : `Lo que pide el requisito: ${esc(limpia(r.descripcion))}`);
const revisionDocs = enLinea.map((r) => {
  const k = r.clave;
  return `    <section class="tarjeta" data-paso data-titulo="${esc(corto(r.nombre))}" data-paso-doc="${k}" hidden>
      <article class="doc-revision doc-paso" data-doc="${k}" data-contexto="${esc(r.nombre)}">
        <div class="doc-cabeza">
          <h2 class="titulo-paso doc-titulo" id="t-doc-${k}">${esc(r.nombre)}</h2>
          <span class="estado estado-atencion" data-doc-estado>Por revisar</span>
        </div>
        <p class="leyenda-oblig" data-leyenda hidden>Las preguntas con <span aria-hidden="true">*</span> son obligatorias.</p>
        <p class="doc-archivo" data-doc-archivo></p>
        <p class="ayuda">${pideDe(r)}</p>
        <p class="doc-ver"><button type="button" class="btn btn-secundario btn-chico" data-ver="${k}">Ver documento<span class="solo-lector">: ${esc(r.nombre)}</span></button></p>
        <!-- Si la solicitud se rechaza por el perfil, sus documentos no se revisan (revisar_${k}=no) -->
        <p class="aviso" data-doc-sin-revision hidden><svg class="icono" aria-hidden="true"><use href="#i-info"></use></svg><span class="aviso-texto">No hace falta revisar este documento: la solicitud se rechaza por el perfil.</span></p>
        <div data-si="revisar_${k}=si">
          <!-- Aceptado en una revisión anterior y sin cambios: no se vuelve a decidir, salvo que quien revisa lo reabra (2026-10-18) -->
          <p class="doc-previo" data-doc-previo hidden>Se aceptó en una revisión anterior y la persona no lo cambió: no hace falta revisarlo otra vez. <button type="button" class="btn-enlace" data-reabrir="${k}">Revisarlo de nuevo<span class="solo-lector">: ${esc(r.nombre)}</span></button></p>
          <div data-si="decidir_${k}=si">
          <fieldset class="grupo" data-campo="decision_${k}" data-requerido data-uso="Registrar si «${esc(r.nombre)}» cumple el requisito (apd.documento.estado).">
            <legend class="etiqueta">¿El documento está bien?</legend>
            <!-- autocomplete off: decisión de quien revisa; el navegador no tiene un valor que proponer. -->
            <div class="opciones-lista">
              <label class="opcion-fila"><input class="opcion-fila-input" type="radio" name="decision_${k}" autocomplete="off" value="aceptado"><span><span class="opcion-nombre">Sí, está bien</span></span></label>
              <label class="opcion-fila"><input class="opcion-fila-input" type="radio" name="decision_${k}" autocomplete="off" value="con_observacion"><span><span class="opcion-nombre">No, tiene un problema</span><span class="opcion-desc">Regresa a la persona para que lo corrija.</span></span></label>
            </div>
          </fieldset>
          <div class="campo" data-campo="observacion_${k}" data-requerido data-si="decision_${k}=con_observacion" data-chips-fijos="${MOTIVOS.map(esc).join('|')}" data-chips-etiqueta="${esc(r.nombre)}" data-uso="Decirle a la persona qué debe corregir de «${esc(r.nombre)}»; se le muestra tal cual (apd.documento.observacion).">
            <label class="etiqueta" for="observacion_${k}">¿Qué problema tiene? Lo que le diremos a la persona</label>
            <p class="ayuda" id="ay-observacion_${k}">Elija un motivo frecuente y complételo; al menos 10 caracteres. La persona lo lee con el nombre del documento al inicio y dirigido a ella, de tú («cargaste»); sus renglones se conservan.</p>
            <!-- autocomplete off: texto de quien revisa; el navegador no tiene un valor que proponer. -->
            <textarea class="control" id="observacion_${k}" name="observacion_${k}" rows="3" minlength="10" maxlength="400" autocomplete="off"></textarea>
          </div>
          </div>
        </div>
      </article>
      <div class="acciones">
        <button type="button" class="btn-atras" data-accion="atras"><svg class="icono" aria-hidden="true"><use href="#i-flecha-izq"></use></svg>Atrás</button>
        <button type="button" class="btn btn-primario" data-accion="siguiente">Siguiente documento</button>
      </div>
    </section>`;
});
const auxiliares = enLinea.flatMap((r) => [
  `      <input type="hidden" id="revisar_${r.clave}" name="revisar_${r.clave}" value="no" data-campo="revisar_${r.clave}" data-auxiliar data-uso="Pedir la revisión de «${esc(r.nombre)}» sólo si está cargado y la solicitud no se rechaza por perfil; lo calculan la página y el servidor.">`,
  `      <input type="hidden" id="decidir_${r.clave}" name="decidir_${r.clave}" value="no" data-campo="decidir_${r.clave}" data-auxiliar data-uso="Pedir la decisión sobre «${esc(r.nombre)}» salvo que se haya aceptado en una revisión anterior y no haya cambiado (o que quien revisa lo reabra); lo calculan la página y el servidor.">`
]);
{
  const r = join(sitio, 'revisar.html');
  let h = readFileSync(r, 'utf8');
  for (const [marca, contenido] of [['revision-documentos', revisionDocs.join('\n\n')], ['revision-auxiliares', auxiliares.join('\n')]]) {
    const ini = h.match(new RegExp(`^( *)<!-- ${marca}:inicio[^>]*-->`, 'm'));
    const f = h.indexOf(`<!-- ${marca}:fin -->`);
    if (!ini || f < 0) { console.error(`Faltan los marcadores ${marca} en sitio/revisar.html`); process.exit(1); }
    h = h.slice(0, ini.index + ini[0].length) + '\n' + contenido + '\n' + ini[1] + h.slice(f);
  }
  writeFileSync(r, h);
}

// 4c · Cotejo presencial (etapa 2, decisiones 2026-10-17): un bloque por requisito que se carga en línea. Se coteja si la
// solicitud lo tiene cargado y la persona se presentó y es quien dice ser; al retomar un cotejo en pausa, sólo los que no
// coincidieron. Lo dice cotejar_<requisito>, que calculan la página y el servidor (una sola condición por campo, P38).
// «Cita de cotejo» por pasos (decisión de Liber del 24/10/2026): los documentos van juntos en el paso «Documentos
// originales», cada uno con «Sí, es igual» / «No es igual». Mismos campos que antes (coincide_<requisito>, diferencia_<requisito>).
const cotejoDocs = enLinea.map((r) => {
  const k = r.clave;
  return `      <div data-si="cotejar_${k}=si">
        <article class="doc-revision" data-doc="${k}" data-contexto="${esc(r.nombre)}">
          <div class="doc-cabeza">
            <h3 class="doc-titulo">${esc(r.nombre)}</h3>
            <span class="estado estado-atencion" data-doc-estado>Por cotejar</span>
          </div>
          <p class="doc-archivo" data-doc-archivo></p>${notaPersonal(k, '          ')}
          <p class="doc-ver"><button type="button" class="btn btn-secundario btn-chico" data-ver="${k}">Ver lo que cargó<span class="solo-lector">: ${esc(r.nombre)}</span></button></p>
          <fieldset class="grupo" data-campo="coincide_${k}" data-requerido data-uso="Registrar si «${esc(r.nombre)}» que trae la persona coincide con el que cargó en línea.">
            <legend class="etiqueta">¿El original es igual al que cargó?</legend>
            <!-- autocomplete off: decisión de quien atiende; el navegador no tiene un valor que proponer. -->
            <div class="opciones-lista opciones-en-linea">
              <label class="opcion-fila"><input class="opcion-fila-input" type="radio" name="coincide_${k}" autocomplete="off" value="si"><span><span class="opcion-nombre">Sí, es igual</span></span></label>
              <label class="opcion-fila"><input class="opcion-fila-input" type="radio" name="coincide_${k}" autocomplete="off" value="no"><span><span class="opcion-nombre">No es igual</span></span></label>
            </div>
          </fieldset>
          <div class="campo" data-campo="diferencia_${k}" data-requerido data-si="coincide_${k}=no" data-uso="Decirle a la persona qué no coincidió de «${esc(r.nombre)}»; se le muestra tal cual (apd.documento.observacion).">
            <label class="etiqueta" for="diferencia_${k}">¿Qué no es igual? Lo que le diremos a la persona</label>
            <!-- autocomplete off: texto de quien atiende. -->
            <textarea class="control" id="diferencia_${k}" name="diferencia_${k}" rows="2" minlength="10" maxlength="400" autocomplete="off"></textarea>
          </div>
        </article>
      </div>`;
});
const cotejoAux = enLinea.map((r) => `    <input type="hidden" id="cotejar_${r.clave}" name="cotejar_${r.clave}" value="no" data-campo="cotejar_${r.clave}" data-auxiliar data-uso="Pedir el cotejo de «${esc(r.nombre)}» sólo si está cargado y toca cotejarlo; lo calculan la página y el servidor.">`);
// 4d · Corrección del mismo día (decisión 2026-10-17): la persona carga en «Mis trámites» el documento que no coincidió
// en su cita en pausa. Un campo por requisito; se pide sólo el que quedó en pausa (cargar_<requisito>). El formato y el
// tamaño se dicen una vez, arriba de los documentos (C3-02, como en la solicitud).
const corregirDocs = enLinea.map((r) => {
  const k = r.clave;
  const nombre = `doc_${k}`;
  return `        <div data-si="cargar_${k}=si">
          <div class="campo" data-campo="${nombre}" data-requerido data-max="1" data-extensiones="${extensionesDe(r)}" data-mb="5" data-nombre-archivo="${esc(r.nombre_archivo || limpia(r.nombre).toUpperCase())}"
               data-uso="Sustituir «${esc(r.nombre)}» por el que coincide con el que llevó a su cita." data-finalidad="Revisar que la persona cumple los requisitos de la acreditación." data-sensible>
            <span class="etiqueta" id="et-${nombre}">${esc(r.nombre)}</span>
            <p class="ayuda" id="ay-${nombre}" data-diferencia="${k}"></p>
            <div data-archivos>
              <button type="button" class="zona-carga" aria-describedby="ay-${nombre}">
                <svg class="icono" aria-hidden="true"><use href="#i-adjunto"></use></svg>
                <span class="zona-carga-texto">Elegir archivo</span>
              </button>
              <!-- autocomplete off: es un archivo; el navegador no tiene nada que proponer. -->
              <input type="file" hidden autocomplete="off">
              <div data-rechazos></div>
              <ul class="lista-arch"></ul>
            </div>
          </div>
        </div>`;
});
const corregirAux = enLinea.map((r) => `      <input type="hidden" id="cargar_${r.clave}" name="cargar_${r.clave}" value="no" data-campo="cargar_${r.clave}" data-auxiliar data-uso="Pedir «${esc(r.nombre)}» sólo si no coincidió en la cita en pausa; lo calculan la página y el servidor.">`);
for (const [pagina, marcas] of [['cotejo.html', [['cotejo-documentos', cotejoDocs], ['cotejo-auxiliares', cotejoAux]]],
  ['corregir.html', [['corregir-documentos', corregirDocs], ['corregir-auxiliares', corregirAux]]]]) {
  const r = join(sitio, pagina);
  let h = readFileSync(r, 'utf8');
  for (const [marca, lista] of marcas) {
    const ini = h.match(new RegExp(`^( *)<!-- ${marca}:inicio[^>]*-->`, 'm'));
    const f = h.indexOf(`<!-- ${marca}:fin -->`);
    if (!ini || f < 0) { console.error(`Faltan los marcadores ${marca} en sitio/${pagina}`); process.exit(1); }
    h = h.slice(0, ini.index + ini[0].length) + '\n' + lista.join('\n') + '\n' + ini[1] + h.slice(f);
  }
  writeFileSync(r, h);
}

// 5 · Adscripción: un solo fragmento (herramientas/plantillas/adscripcion.html) en «Crea tu cuenta», en «Mi perfil» y en el
//     registro asistido del personal (decisión 2026-10-25: las mismas preguntas, que se le leen a la persona)
const fragmento = readFileSync(join(raiz, 'herramientas/plantillas/adscripcion.html'), 'utf8').trimEnd()
  .replace(/^( *)<!-- alcaldias:opciones -->$/m, (_, s) => alcaldias.map((o) => `${s}<option value="${esc(o.clave)}">${esc(o.nombre)}</option>`).join('\n'));
for (const p of ['cuenta.html', 'datos.html', 'asistido.html']) {
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
