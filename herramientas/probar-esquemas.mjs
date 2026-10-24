// SEGUNDA VALIDACIÓN (servidor): regenera el esquema de cada formulario desde su HTML con la herramienta del
// Estándar de formularios del SIA y comprueba con su validar.mjs que el servidor acepta lo correcto y rechaza
// lo incorrecto, con las mismas reglas que el navegador.
//
// Uso: node herramientas/probar-esquemas.mjs <ruta-a-estandares-sia/formularios>
// Escribe db/esquemas-formularios/<formulario>.json (generados; no se editan a mano).

import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const estandar = process.argv[2];
if (!estandar) { console.error('Uso: node herramientas/probar-esquemas.mjs <ruta-a-estandares-sia/formularios>'); process.exit(2); }
const { validaPayload } = await import(pathToFileURL(join(estandar, 'codigo/servidor/validar.mjs')).href);
// Las cruzadas CURP ↔ nombre, apellidos y fecha, y los formatos fecha-dma y folio-fiscal, son del estándar desde la
// 1.1.0–1.3.0: ya no se suman reglas propias. Sí se suman el formato del código de examen (examen en línea) y la
// regla del perfil del dictaminador (mínimo de experiencia, limitesSegun).
await import(pathToFileURL(join(raiz, 'sitio/app/codigo-examen.js')).href);
// Formatos propios «carrera» y «numero-acreditacion» (auditoría «intentar romperlo» 2026-10-18, F1 10 y 12)
await import(pathToFileURL(join(raiz, 'sitio/app/formatos-propios.js')).href);
await import(pathToFileURL(join(raiz, 'sitio/app/perfil-academico.js')).href);
// Textos de usted de las pantallas del personal (desde la 1.3.2 todos viven en «mensajes», P95): el servidor los recibe
// igual, con validaPayload(…, { mensajes })
await import(pathToFileURL(join(raiz, 'sitio/app/mensajes-usted.js')).href);
const PERSONAL = new Set(['revisar', 'cotejo', 'examen-suspender', 'grupo-crear', 'grupo-confirmar', 'grupo-baja', 'grupo-cancelar', 'material',
  'acreditacion-cancelar', 'reposicion-acta', 'reposicion-entrega']);
let ultimo = null;
const cfgEstandar = globalThis.FORMKIT_VALIDACIONES;
const config = { ...cfgEstandar, formatos: { ...cfgEstandar.formatos, ...globalThis.APD_FORMATOS } };

const salida = join(raiz, 'db/esquemas-formularios');
mkdirSync(salida, { recursive: true });
const esquema = {};
// La reposición de la credencial (persona; P140, sesión de trabajo del 23/10/2026)
for (const f of ['cuenta', 'entrar', 'solicitud', 'verificar', 'revisar', 'cotejo', 'corregir', 'reposicion']) {
  execFileSync('node', [join(estandar, 'herramientas/esquema-desde-html.mjs'), join(raiz, 'sitio', `${f}.html`), join(salida, `${f}.json`)]);
  esquema[f] = JSON.parse(readFileSync(join(salida, `${f}.json`), 'utf8'));
}
// «Mi perfil» tiene un formulario por parte (contacto, adscripción, fotografía): cada uno con su esquema, como
// cada parte se guarda por separado en la API
const perfilHtml = readFileSync(join(raiz, 'sitio/datos.html'), 'utf8');
const temporal = mkdtempSync(join(tmpdir(), 'perfil-'));
for (const parte of ['contacto', 'adscripcion', 'foto']) {
  const m = perfilHtml.match(new RegExp(`<form id="form-${parte}"[\\s\\S]*?</form>`));
  const html = join(temporal, `${parte}.html`);
  writeFileSync(html, `<!DOCTYPE html><html lang="es-MX"><body>${m[0]}</body></html>`);
  execFileSync('node', [join(estandar, 'herramientas/esquema-desde-html.mjs'), html, join(salida, `perfil-${parte}.json`)]);
  esquema[`perfil-${parte}`] = JSON.parse(readFileSync(join(salida, `perfil-${parte}.json`), 'utf8'));
}
rmSync(join(salida, 'datos.json'), { force: true });
// Examen en línea (entrar con su código; suspender un examen): páginas de un solo formulario, que la herramienta del
// estándar lee completas (desde la 1.3.3 sólo cuenta lo que está dentro del <form>, P90).
for (const [archivo, nombre] of [['examen.html', 'examen-entrar'], ['aplicar.html', 'examen-suspender']]) {
  execFileSync('node', [join(estandar, 'herramientas/esquema-desde-html.mjs'), join(raiz, 'sitio', archivo), join(salida, `${nombre}.json`)]);
  esquema[nombre] = JSON.parse(readFileSync(join(salida, `${nombre}.json`), 'utf8'));
}
// Un grupo (bloque 53): confirmar, dar de baja y cancelar están en la misma página; se toma cada formulario por su id. La
// base revisa además cupos, anticipación, curso y organización (apd.grupo_cambio, apd.inscripcion_alta).
// Crear un grupo (bloque 74): desde el 24/10/2026, el paso a paso de «Grupos» (grupos.html, formulario «armar»; antes
// «Programar un curso», programar.html, formulario «programar»): el curso (paso 1, de la lista de los cuatro), el primer
// día (paso 2, de la semana elegida), el tipo de grupo (paso 3) y la hora y el instructor (paso 4), que son obligatorios
// sólo para confirmar (la API y la base lo exigen: datos_para_confirmar; «Por asignar» deja el instructor vacío, P92).
// Elegir a las personas es una acción sobre una lista (apd.inscripcion_alta). Programar un grupo que ya existe usa
// grupo-confirmar.
// Material de estudio del personal (auditoría 2026-10-18, A 8.7): un solo formulario para agregar, editar y reemplazar;
// «modo» lo calcula la API por la ruta (alta o cambio), como aquí el caso con `_modo`.
for (const [archivo, id, nombre] of [['grupos.html', 'armar', 'grupo-crear'], ['grupo.html', 'confirmar', 'grupo-confirmar'], ['grupo.html', 'baja', 'grupo-baja'], ['grupo.html', 'cancelar', 'grupo-cancelar'],
  ['material-personal.html', 'form-material', 'material'],
  // Ficha de una acreditación (sesión de trabajo del 23/10/2026): cancelarla (P120), revisar el acta y entregar la credencial
  // repuesta (P140). La base revisa además el perfil, la vigencia y el paso de la reposición (apd.acreditacion_cambio,
  // apd.reposicion_cambio).
  ['acreditacion.html', 'cancelar', 'acreditacion-cancelar'], ['acreditacion.html', 'acta', 'reposicion-acta'], ['acreditacion.html', 'entrega', 'reposicion-entrega']]) {
  const m = readFileSync(join(raiz, 'sitio', archivo), 'utf8').match(new RegExp(`<form id="${id}"[\\s\\S]*?</form>`));
  const html = join(temporal, `${nombre}.html`);
  writeFileSync(html, `<!DOCTYPE html><html lang="es-MX"><body>${m[0]}</body></html>`);
  execFileSync('node', [join(estandar, 'herramientas/esquema-desde-html.mjs'), html, join(salida, `${nombre}.json`)]);
  esquema[nombre] = JSON.parse(readFileSync(join(salida, `${nombre}.json`), 'utf8'));
}

let fallas = 0;
const meta = { trampa: '', ms_en_formulario: 90000, idempotencia: 'prueba' };
const pdf = (n) => ({ nombre: `${n}.pdf`, size: 200000, type: 'application/pdf', campo: n });
// Como lo hará la API: los datos que calcula la página (data-auxiliar) no se reciben; el servidor los calcula con
// validaPayload(…, { auxiliares }) (estándar 1.1.0). `calcula` devuelve todos los de un formulario a partir de lo
// recibido y del contexto que tendrá la API en la base (el caso lo indica en claves que empiezan con «_»):
//   · solicitud: tramite = tipo + modalidad; la modalidad la decide la base por el historial (`_modalidad`); la situación
//     de la licenciatura sólo se pregunta en dictaminador (pedir_situacion; sesión de trabajo del 23/10/2026).
function calcula(form, d, ctx) {
  d = { ...d, ...ctx };
  if (form === 'solicitud') {
    return { tramite: d.tipo ? `${d.tipo}_${d._modalidad || 'nueva'}` : '',
      pedir_situacion: d.tipo === 'dictaminador' && d.nivel_estudios === 'licenciatura' ? 'si' : 'no' };
  }
  // Revisión documental del personal (etapa 2): el servidor calcula los auxiliares con la base (perfil de la
  // solicitud y documentos cargados) y con las decisiones recibidas, igual que app/revisar.js. El caso indica
  // el perfil en `_perfil` y los documentos cargados en `_cargados`.
  if (form === 'revisar') {
    const perfil = d._perfil || 'no_aplica';
    const cargados = d._cargados || [];
    const rechazo = (perfil === 'por_clasificar' && d.clasificacion === 'no_afin') || (perfil === 'no_cumple' && d.comprobante_confirma === 'si');
    d.perfil_revision = perfil;
    // Aceptados en una revisión anterior (`_previos`): no se vuelven a decidir, salvo que llegue su decisión (reabierto)
    const previos = d._previos || [];
    const decide = (k) => !previos.includes(k) || d[`decision_${k}`] !== undefined;
    for (const k of REQUISITOS_EN_LINEA) {
      d[`revisar_${k}`] = !rechazo && cargados.includes(k) ? 'si' : 'no';
      d[`decidir_${k}`] = !rechazo && cargados.includes(k) && decide(k) ? 'si' : 'no';
    }
    const decisiones = cargados.map((k) => (decide(k) ? d[`decision_${k}`] : 'aceptado'));
    const perfilListo = perfil === 'por_clasificar' ? Boolean(d.clasificacion) : perfil === 'no_cumple' ? Boolean(d.comprobante_confirma) : true;
    d.resultado = rechazo ? 'rechazada' : decisiones.includes('con_observacion') ? 'con_observaciones' : decisiones.every(Boolean) && perfilListo ? 'validada' : '';
  }
  // Cotejo presencial (personal): el servidor calcula los auxiliares con la cita (en pausa o no, inasistencias
  // anteriores) y los documentos cargados, igual que app/cotejo.js. El caso indica los documentos cargados en
  // `_cargados`, los que quedaron en pausa en `_pausa` y las inasistencias anteriores en `_inasistencias`.
  if (form === 'cotejo') {
    const cargados = d._cargados || [];
    const pausa = d._pausa || null;
    const inasistencias = d._inasistencias || 0;
    const presente = pausa ? 'si' : d.se_presento;
    const ident = pausa ? 'misma' : d.identidad;
    const conDocs = presente === 'si' && ident !== 'no_es';
    const aCotejar = cargados.filter((k) => !pausa || pausa.includes(k));
    const noCoinciden = aCotejar.filter((k) => d[`coincide_${k}`] === 'no').length;
    d.pedir_llegada = pausa ? 'no' : 'si';
    d.pedir_identidad = presente === 'si' && !pausa ? 'si' : 'no';
    d.pedir_documentos = conDocs ? 'si' : 'no';
    for (const k of REQUISITOS_EN_LINEA) d[`cotejar_${k}`] = conDocs && aCotejar.includes(k) ? 'si' : 'no';
    d.pedir_hoy = conDocs && noCoinciden ? 'si' : 'no';
    d.pedir_pago = conDocs && !noCoinciden ? 'si' : 'no';
    d.pedir_factura = conDocs && !noCoinciden && d.pago === 'si' ? 'si' : 'no';
    d.resultado = presente === 'no' ? (inasistencias >= 1 ? 'cerrar' : 'no_se_presento')
      : presente !== 'si' ? '' : ident === 'no_es' ? 'no_es_la_persona'
        : noCoinciden ? ({ si: 'pausa', no: 'con_observaciones' }[d.hoy_documento] || '') : ({ si: 'terminado', no: 'otra_cita' }[d.pago] || '');
  }
  // Material de estudio: agregar (nuevo), editar sus datos o reemplazar su archivo; lo decide la ruta de la API (`_modo`)
  if (form === 'material') d.modo = d._modo || 'nuevo';
  // Corrección del mismo día (persona): sólo los documentos que quedaron en pausa (`_pausa`)
  if (form === 'corregir') {
    const pausa = d._pausa || [];
    for (const k of REQUISITOS_EN_LINEA) d[`cargar_${k}`] = pausa.includes(k) ? 'si' : 'no';
  }
  return d; // las claves que no son datos calculados del esquema no se leen
}
const auxiliaresDe = (form, ctx) => Object.fromEntries(Object.entries(esquema[form].campos || {})
  .filter(([, c]) => c.tipo === 'auxiliar').map(([n]) => [n, (datos) => calcula(form, datos, ctx)[n]]));
// El mínimo de experiencia según el perfil (data-min-segun="experiencia"), con la misma regla de la página
const limitesSegun = { experiencia: (r) => globalThis.APD_PERFIL_ACADEMICO.minimoExperiencia(ficticiosPerfil, r) };
const REQUISITOS_EN_LINEA = ['identificacion_oficial', 'curp', 'comprobante_domicilio', 'constancia_situacion_fiscal', 'comprobante_estudios', 'curriculum_vitae', 'comprobantes_experiencia'];
// El catálogo cerrado de alcaldías, como lo tendrá la API (el mismo que genera construir-sitio.mjs)
const orgs = JSON.parse(readFileSync(join(raiz, 'datos/ficticios.json'), 'utf8')).organizacion;
const ficticios = JSON.parse(readFileSync(join(raiz, 'datos/ficticios.json'), 'utf8'));
const catalogos = { empresas: { filas: orgs.filter((o) => o.tipo === 'privada').map((o) => o.nombre), fuente: 'apd.organizacion', es_ficticio: true }, carreras: { filas: ficticios.carrera.map((c) => c.nombre), fuente: 'apd.carrera', es_ficticio: true } };
const ficticiosPerfil = ficticios;
// Los archivos llegan sólo en payload.archivos: desde la 1.1.0 el servidor ya no necesita su número en `datos` (P46).
function caso(nombre, form, datos, espera, archivos = []) {
  const ctx = Object.fromEntries(Object.entries(datos).filter(([k]) => k.startsWith('_')));
  const recibido = Object.fromEntries(Object.entries(datos).filter(([k, v]) => !k.startsWith('_') && v !== undefined
    && !(esquema[form].campos[k] && esquema[form].campos[k].tipo === 'archivos')));
  const r = validaPayload({ datos: recibido, archivos, meta }, esquema[form], { config, catalogos, auxiliares: auxiliaresDe(form, ctx), limitesSegun,
    mensajes: PERSONAL.has(form) ? globalThis.APD_MENSAJES_USTED : undefined });
  ultimo = r;
  const campos = r.errores.map((e) => e.campo);
  const ok = espera === true ? r.ok : !r.ok && espera.every((c) => campos.includes(c)) && campos.every((c) => espera.includes(c));
  console.log(`${ok ? 'BIEN' : 'MAL '}  ${nombre}${ok ? '' : ` → ${JSON.stringify([...new Set(campos)])}`}`);
  if (!ok) fallas++;
}

const ALFABETO = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
const conDigito = (b) => { let s = 0; for (let i = 0; i < 17; i++) s += ALFABETO.indexOf(b[i]) * (18 - i); return b + String((10 - (s % 10)) % 10); };
const curpNadia = conDigito(globalThis.FORMKIT_VALIDACIONES.prefijoCurp({ nombre: 'Nadia', primer: 'Ejemplo', segundo: 'Simulado' }, '1999-12-30', 'M', 'NE') + '0');
const cuenta = { nombre: 'Nadia', primer_apellido: 'Ejemplo', segundo_apellido: 'Simulado', fecha_nacimiento: '30/12/1999', curp: curpNadia, correo: 'nadia@ejemplo.local', correo2: 'nadia@ejemplo.local', telefono: '5500000077', contrasena: 'una frase larga de prueba', contrasena2: 'una frase larga de prueba', adscrito: 'no', aviso: 'si', humano: 'si' };
const foto = (nombre = 'foto.jpg', type = 'image/jpeg') => [{ nombre, size: 180000, type, campo: 'foto' }];
caso('Cuenta completa con su fotografía se acepta', 'cuenta', cuenta, true, foto());
caso('Cuenta sin fotografía de frente se rechaza', 'cuenta', cuenta, ['foto']);
caso('Cuenta con la fotografía en PDF se rechaza', 'cuenta', cuenta, ['foto'], foto('foto.pdf', 'application/pdf'));
caso('Cuenta: CURP con dígito incorrecto y correo sin confirmar se rechazan', 'cuenta', { ...cuenta, curp: curpNadia.slice(0, 17) + ((Number(curpNadia[17]) + 1) % 10), correo2: 'otra@ejemplo.local' }, ['curp', 'correo2'], foto());
caso('Cuenta: una CURP ajena (de otro nombre) se rechaza', 'cuenta', { ...cuenta, nombre: 'Pedro', primer_apellido: 'López' }, ['curp'], foto());
caso('Cuenta: otro segundo apellido se rechaza', 'cuenta', { ...cuenta, segundo_apellido: 'Muestra' }, ['curp'], foto());
const curpUriel = conDigito(globalThis.FORMKIT_VALIDACIONES.prefijoCurp({ nombre: 'Uriel', primer: 'Ejemplo', segundo: '' }, '1988-04-09', 'H', 'NE') + '0');
caso('Cuenta sin segundo apellido se acepta', 'cuenta', { ...cuenta, nombre: 'Uriel', segundo_apellido: '', fecha_nacimiento: '09/04/1988', curp: curpUriel }, true, foto());
caso('Cuenta: dejar vacío el segundo apellido con una CURP que sí lo tiene se rechaza', 'cuenta', { ...cuenta, segundo_apellido: '' }, ['curp'], foto());
caso('Cuenta: otra fecha de nacimiento se rechaza', 'cuenta', { ...cuenta, fecha_nacimiento: '31/12/1999' }, ['curp'], foto());
caso('Cuenta: sin fecha de nacimiento se rechaza', 'cuenta', { ...cuenta, fecha_nacimiento: '' }, ['fecha_nacimiento'], foto());
caso('Cuenta: contraseña corta se rechaza', 'cuenta', { ...cuenta, contrasena: 'corta', contrasena2: 'corta' }, ['contrasena', 'contrasena2'], foto());
caso('Cuenta: sin aviso de privacidad se rechaza', 'cuenta', { ...cuenta, aviso: '' }, ['aviso'], foto());

// Solicitud: lo obligatorio depende del trámite elegido, con una sola condición por bloque
const docs = (t, lista) => Object.fromEntries(lista.map((r) => [`doc_${t}_${r}`, `${r}.pdf`]));
// «No soy un programa automático» ya no va en la solicitud: se marca al crear la cuenta (decisión 13 a, auditoría
// 2026-10-20, C3-03)
const base = { protesta: 'si', aviso: 'si', nivel_estudios: 'preparatoria' };
const podaNueva = ['identificacion_oficial', 'curp', 'comprobante_domicilio', 'constancia_situacion_fiscal'];
caso('Solicitud poda nueva con sus 4 documentos se acepta', 'solicitud', { ...base, tipo: 'poda', ...docs('poda_nueva', podaNueva) }, true, podaNueva.map((r) => pdf(`doc_poda_nueva_${r}`)));
caso('Solicitud con un documento en JPG se rechaza: sólo PDF', 'solicitud', { ...base, tipo: 'poda', ...docs('poda_nueva', podaNueva) }, ['doc_poda_nueva_curp'],
  podaNueva.map((r) => (r === 'curp' ? { nombre: 'curp.jpg', size: 200000, type: 'image/jpeg', campo: 'doc_poda_nueva_curp' } : pdf(`doc_poda_nueva_${r}`))));
caso('Solicitud poda nueva sin documentos pide sólo los de poda nueva', 'solicitud', { ...base, tipo: 'poda' }, podaNueva.map((r) => `doc_poda_nueva_${r}`));
caso('Solicitud dictaminador nueva sin perfil ni documentos pide perfil y sus 7 documentos', 'solicitud', { ...base, nivel_estudios: undefined, tipo: 'dictaminador' },
  ['nivel_estudios', 'anios_experiencia', ...['identificacion_oficial', 'curp', 'comprobante_domicilio', 'constancia_situacion_fiscal', 'comprobante_estudios', 'curriculum_vitae', 'comprobantes_experiencia'].map((r) => `doc_dictaminador_nueva_${r}`)]);
caso('Solicitud poda renovación pide sólo la constancia de situación fiscal (lo demás es «si aplica»)', 'solicitud', { ...base, tipo: 'poda', _modalidad: 'renovacion', anterior: 'PD-2025-K106' }, ['doc_poda_renovacion_constancia_situacion_fiscal']);
// Perfil del dictaminador: carrera y situación sólo desde licenciatura
const dictRenov = { ...base, tipo: 'dictaminador', _modalidad: 'renovacion', anterior: 'DT-2025-K109', anios_experiencia: '3', doc_dictaminador_renovacion_constancia_situacion_fiscal: 'c.pdf' };
const csf = [pdf('doc_dictaminador_renovacion_constancia_situacion_fiscal')];
// La experiencia sólo se pide en la primera vez (decisión 2026-10-18): sus casos van con dictaminador nueva
const dictSiete = ['identificacion_oficial', 'curp', 'comprobante_domicilio', 'constancia_situacion_fiscal', 'comprobante_estudios', 'curriculum_vitae', 'comprobantes_experiencia'];
const dictNueva = { ...base, tipo: 'dictaminador', ...docs('dictaminador_nueva', dictSiete) };
const sieteDocs = dictSiete.map((r) => pdf(`doc_dictaminador_nueva_${r}`));
caso('Perfil: licenciatura pide carrera y situación de los estudios', 'solicitud', { ...dictRenov, nivel_estudios: 'licenciatura' }, ['carrera', 'estatus_estudios'], csf);
caso('Perfil: carrera técnica pide cuál, no la carrera ni la situación', 'solicitud', { ...dictRenov, nivel_estudios: 'tecnica', anios_experiencia: '5' }, ['carrera_tecnica'], csf);
caso('Perfil: carrera técnica escrita, sin catálogo, con cinco años se acepta', 'solicitud', { ...dictRenov, nivel_estudios: 'tecnica', carrera_tecnica: 'Técnico forestal', anios_experiencia: '5' }, true, csf);
// Mínimo de experiencia según el perfil (data-min-segun, estándar 1.1.0, P61): el servidor lo calcula con la misma regla
caso('Experiencia: con carrera técnica, tres años se rechazan (se piden cinco)', 'solicitud', { ...dictNueva, nivel_estudios: 'tecnica', carrera_tecnica: 'Técnico forestal', anios_experiencia: '3' }, ['anios_experiencia'], sieteDocs);
caso('Experiencia: titulada en Biología, dos años se aceptan', 'solicitud', { ...dictNueva, nivel_estudios: 'licenciatura', carrera: 'Biología', estatus_estudios: 'titulado', anios_experiencia: '2' }, true, sieteDocs);
caso('Experiencia fuera de rango se rechaza', 'solicitud', { ...dictNueva, nivel_estudios: 'licenciatura', carrera: 'Biología', estatus_estudios: 'titulado', anios_experiencia: '80' }, ['anios_experiencia'], sieteDocs);
// Un dato que calcula la página no se recibe: si el navegador lo manda, el envío se rechaza (estándar 1.1.0)
caso('Solicitud: el curso calculado enviado por el navegador se rechaza', 'solicitud', { ...dictRenov, nivel_estudios: 'tecnica', carrera_tecnica: 'Técnico forestal', anios_experiencia: '5', tramite: 'poda_nueva' }, ['tramite'], csf);
// En poda no se pregunta la situación de la licenciatura (sesión de trabajo del 23/10/2026): sólo la carrera
caso('Poda: licenciatura pide la carrera, no su situación (sesión del 23/10)', 'solicitud', { ...base, tipo: 'poda', _modalidad: 'renovacion', anterior: 'PD-2025-K106', nivel_estudios: 'licenciatura', doc_poda_renovacion_constancia_situacion_fiscal: 'c.pdf' }, ['carrera'], [pdf('doc_poda_renovacion_constancia_situacion_fiscal')]);
caso('Poda: con licenciatura y su carrera se acepta sin la situación (sesión del 23/10)', 'solicitud', { ...base, tipo: 'poda', _modalidad: 'renovacion', anterior: 'PD-2025-K106', nivel_estudios: 'licenciatura', carrera: 'Biología', doc_poda_renovacion_constancia_situacion_fiscal: 'c.pdf' }, true, [pdf('doc_poda_renovacion_constancia_situacion_fiscal')]);
caso('Dictaminador: licenciatura sigue pidiendo su situación (sesión del 23/10)', 'solicitud', { ...dictNueva, nivel_estudios: 'licenciatura', carrera: 'Biología', anios_experiencia: '5' }, ['estatus_estudios'], sieteDocs);
caso('Poda: sin nivel de estudios se rechaza', 'solicitud', { ...base, nivel_estudios: undefined, tipo: 'poda', _modalidad: 'renovacion', anterior: 'PD-2025-K106', doc_poda_renovacion_constancia_situacion_fiscal: 'c.pdf' }, ['nivel_estudios'], [pdf('doc_poda_renovacion_constancia_situacion_fiscal')]);
caso('Posgrado: no se pregunta la situación del grado (se asume la licenciatura titulada)', 'solicitud', { ...dictRenov, nivel_estudios: 'doctorado', carrera: 'Biología', anios_experiencia: '2' }, true, csf);
caso('Perfil: una carrera que no está en la lista se acepta (la clasifica la Secretaría)', 'solicitud', { ...dictRenov, nivel_estudios: 'maestria', carrera: 'Gestión Ambiental Urbana', estatus_estudios: 'en_curso', anios_experiencia: '5' }, true, csf);
caso('Perfil: un nivel que no existe se rechaza', 'solicitud', { ...dictRenov, nivel_estudios: 'posdoctorado' }, ['nivel_estudios'], csf);
caso('Solicitud sin la declaración bajo protesta de decir verdad se rechaza', 'solicitud', { ...base, protesta: undefined, tipo: 'poda', _modalidad: 'renovacion', anterior: 'PD-2025-K106', doc_poda_renovacion_constancia_situacion_fiscal: 'c.pdf' }, ['protesta'], [pdf('doc_poda_renovacion_constancia_situacion_fiscal')]);
caso('Solicitud con una acreditación que no existe se rechaza', 'solicitud', { ...base, tipo: 'otra' }, ['tipo']);
caso('Renovación de dictaminador: no vuelve a pedir los años de experiencia', 'solicitud', { ...dictRenov, nivel_estudios: 'tecnica', carrera_tecnica: 'Técnico forestal', anios_experiencia: '' }, true, csf);

// Adscripción (en la cuenta y en «Mi perfil»): según el tipo, su pregunta; lo que depende de una respuesta se oculta con ella
const conFoto = foto();
const cta = (extra) => ({ ...cuenta, ...extra });
caso('Cuenta: sin decir si trabaja para alguien se rechaza', 'cuenta', cta({ adscrito: '' }), ['adscrito'], conFoto);
caso('Cuenta: adscrita sin decir el tipo se rechaza', 'cuenta', cta({ adscrito: 'si' }), ['tipo_adscripcion'], conFoto);
caso('Cuenta: empresa sin nombre se rechaza', 'cuenta', cta({ adscrito: 'si', tipo_adscripcion: 'privada' }), ['empresa_nombre'], conFoto);
caso('Cuenta: empresa con su nombre se acepta', 'cuenta', cta({ adscrito: 'si', tipo_adscripcion: 'privada', empresa_nombre: 'Jardines Ejemplo del Norte, S.A. de C.V.' }), true, conFoto);
caso('Cuenta: SEDEMA sin su Dirección General se rechaza', 'cuenta', cta({ adscrito: 'si', tipo_adscripcion: 'dependencia_cdmx', dependencia_cdmx: 'sedema' }), ['direccion_sedema'], conFoto);
caso('Cuenta: SEDEMA con su Dirección General se acepta', 'cuenta', cta({ adscrito: 'si', tipo_adscripcion: 'dependencia_cdmx', dependencia_cdmx: 'sedema', direccion_sedema: 'dgcorenadr' }), true, conFoto);
caso('Cuenta: otra dependencia de la Ciudad sin su nombre se rechaza', 'cuenta', cta({ adscrito: 'si', tipo_adscripcion: 'dependencia_cdmx', dependencia_cdmx: 'otro' }), ['dependencia_cdmx_otra'], conFoto);
caso('Cuenta: una alcaldía fuera del catálogo se rechaza', 'cuenta', cta({ adscrito: 'si', tipo_adscripcion: 'alcaldia', alcaldia: 'Alcaldía Inventada' }), ['alcaldia'], conFoto);
caso('Cuenta: una alcaldía de la lista se acepta', 'cuenta', cta({ adscrito: 'si', tipo_adscripcion: 'alcaldia', alcaldia: 'tlahuac' }), true, conFoto);
caso('Cuenta: institución educativa sin decir cuál se rechaza', 'cuenta', cta({ adscrito: 'si', tipo_adscripcion: 'educativa' }), ['institucion_educativa'], conFoto);
caso('Cuenta: UNAM se acepta', 'cuenta', cta({ adscrito: 'si', tipo_adscripcion: 'educativa', institucion_educativa: 'unam' }), true, conFoto);
caso('Cuenta: Universidad Autónoma Chapingo se acepta (sesión del 23/10)', 'cuenta', cta({ adscrito: 'si', tipo_adscripcion: 'educativa', institucion_educativa: 'chapingo' }), true, conFoto);
caso('Cuenta: otra institución educativa sin su nombre se rechaza', 'cuenta', cta({ adscrito: 'si', tipo_adscripcion: 'educativa', institucion_educativa: 'otro' }), ['institucion_educativa_otra'], conFoto);
caso('Cuenta: la Dirección General «otro» ya no existe y se rechaza', 'cuenta', cta({ adscrito: 'si', tipo_adscripcion: 'dependencia_cdmx', dependencia_cdmx: 'sedema', direccion_sedema: 'otro' }), ['direccion_sedema'], conFoto);
caso('Cuenta: independiente, lo que dependía de la adscripción no cuenta (se descarta)', 'cuenta', cta({ adscrito: 'no', tipo_adscripcion: 'alcaldia', alcaldia: 'Inventada' }), true, conFoto);
const contacto = { correo: 'nadia@ejemplo.local', correo2: 'nadia@ejemplo.local', telefono: '5500000077' };
const adscripcion = { adscrito: 'si', tipo_adscripcion: 'dependencia_federal', dependencia_federal: 'cfe' };
caso('Mi perfil: contacto completo se acepta', 'perfil-contacto', contacto, true);
caso('Mi perfil: correo y confirmación distintos se rechazan', 'perfil-contacto', { ...contacto, correo2: 'otra@ejemplo.local' }, ['correo2']);
caso('Mi perfil: cambio de adscripción a CFE se acepta', 'perfil-adscripcion', adscripcion, true);
caso('Mi perfil: otra dependencia federal sin su nombre se rechaza', 'perfil-adscripcion', { ...adscripcion, dependencia_federal: 'otro' }, ['dependencia_federal_otra']);
caso('Mi perfil: la CURP o el nombre no se cambian aquí (campo no declarado)', 'perfil-contacto', { ...contacto, curp: curpNadia }, ['curp']);
caso('Mi perfil: cambiar la fotografía pide la fotografía', 'perfil-foto', {}, ['foto']);
caso('Mi perfil: una fotografía JPG se acepta', 'perfil-foto', {}, true, foto());

// Revisión documental (personal): validar, observar o rechazar, con lo que cada resultado pide
const PODA = ['identificacion_oficial', 'curp', 'comprobante_domicilio', 'constancia_situacion_fiscal'];
const DICT = REQUISITOS_EN_LINEA;
const acepta = (lista) => Object.fromEntries(lista.map((k) => [`decision_${k}`, 'aceptado']));
// La fecha de la cita se escribe día/mes/año (formato «fecha-dma», auditoría 2026-10-18, D9)
const cita = { cita_fecha: '21/10/2026', cita_hora: '10:00' };
caso('Revisión: poda con todo aceptado y su cita se valida', 'revisar', { _cargados: PODA, ...acepta(PODA), ...cita }, true);
caso('Revisión: validar sin cita se rechaza', 'revisar', { _cargados: PODA, ...acepta(PODA) }, ['cita_fecha', 'cita_hora']);
caso('Revisión: una fecha de cita que no existe se rechaza', 'revisar', { _cargados: PODA, ...acepta(PODA), ...cita, cita_fecha: '31/02/2026' }, ['cita_fecha']);
{
  const m = (ultimo.errores.find((e) => e.campo === 'cita_fecha') || {}).mensaje || '';
  const ok = /día\/mes\/año/.test(m) && !/\bEscribe\b/.test(m);
  console.log(`${ok ? 'BIEN' : 'MAL '}  Revisión: el servidor pide la fecha como día/mes/año y en usted${ok ? '' : ` → ${m}`}`);
  if (!ok) fallas++;
}
caso('Revisión: una hora que no existe se rechaza', 'revisar', { _cargados: PODA, ...acepta(PODA), ...cita, cita_hora: '25:00' }, ['cita_hora']);
caso('Revisión: una hora fuera de la lista de horarios se rechaza', 'revisar', { _cargados: PODA, ...acepta(PODA), ...cita, cita_hora: '10:15' }, ['cita_hora']);
caso('Revisión: un documento sin decidir se rechaza', 'revisar', { _cargados: PODA, ...acepta(PODA.slice(1)) }, ['decision_identificacion_oficial']);
// 2.ª vuelta (2026-10-18): lo aceptado antes no se vuelve a decidir; sólo lo corregido
caso('Revisión, 2.ª vuelta: con lo corregido aceptado se valida sin volver a decidir lo aceptado antes', 'revisar', { _cargados: PODA, _previos: PODA.slice(1), ...acepta(PODA.slice(0, 1)), ...cita }, true);
caso('Revisión, 2.ª vuelta: lo corregido sigue pidiendo su decisión', 'revisar', { _cargados: PODA, _previos: PODA.slice(1), ...cita }, [`decision_${PODA[0]}`]);
caso('Revisión: observar un documento sin decir qué corregir se rechaza', 'revisar', { _cargados: PODA, ...acepta(PODA), decision_curp: 'con_observacion' }, ['observacion_curp']);
caso('Revisión: con una observación no se pide la cita', 'revisar', { _cargados: PODA, ...acepta(PODA), decision_curp: 'con_observacion', observacion_curp: 'No se lee completo.' }, true);
caso('Revisión: un documento que no está cargado no se revisa (renovación)', 'revisar', { _cargados: ['constancia_situacion_fiscal'], ...acepta(['constancia_situacion_fiscal']), ...cita }, true);
caso('Revisión: carrera por clasificar sin clasificar se rechaza', 'revisar', { _perfil: 'por_clasificar', _cargados: DICT, ...acepta(DICT), ...cita }, ['clasificacion']);
caso('Revisión: carrera afín con todo aceptado se valida', 'revisar', { _perfil: 'por_clasificar', _cargados: DICT, clasificacion: 'afin', ...acepta(DICT), ...cita }, true);
caso('Revisión: carrera no afín se rechaza sin revisar documentos, pero con motivo', 'revisar', { _perfil: 'por_clasificar', _cargados: DICT, clasificacion: 'no_afin' }, ['motivo_rechazo']);
caso('Revisión: carrera no afín con su motivo se rechaza', 'revisar', { _perfil: 'por_clasificar', _cargados: DICT, clasificacion: 'no_afin', motivo_rechazo: 'La carrera no es afín al manejo del arbolado.' }, true);
caso('Revisión: perfil que no cumple sin decidir con el comprobante se rechaza', 'revisar', { _perfil: 'no_cumple', _cargados: DICT, ...acepta(DICT), ...cita }, ['comprobante_confirma']);
caso('Revisión: el comprobante muestra otro grado → se observa el comprobante', 'revisar', { _perfil: 'no_cumple', _cargados: DICT, comprobante_confirma: 'no', ...acepta(DICT), decision_comprobante_estudios: 'con_observacion', observacion_comprobante_estudios: 'Su comprobante muestra carta de pasante.' }, true);
caso('Revisión: una clasificación que no existe se rechaza', 'revisar', { _perfil: 'por_clasificar', _cargados: DICT, clasificacion: 'principal', ...acepta(DICT), ...cita }, ['clasificacion']);

// Cotejo presencial (personal, decisiones 2026-10-17)
const coinciden = (lista) => Object.fromEntries(lista.map((k) => [`coincide_${k}`, 'si']));
const factura = { factura_rfc: 'XAXX010101000', factura_razon_social: 'Persona Ejemplo Ficticia', factura_folio_fiscal: '6F1C2D3E-4A5B-4C6D-8E7F-9A0B1C2D3E4F' };
const conFactura = [pdf('factura_pago')];
const llega = { _cargados: PODA, se_presento: 'si', identidad: 'misma' };
caso('Cotejo: todo coincide, pago y factura → terminado', 'cotejo', { ...llega, ...coinciden(PODA), pago: 'si', ...factura }, true, conFactura);
caso('Cotejo: terminado sin la factura ni sus datos se rechaza', 'cotejo', { ...llega, ...coinciden(PODA), pago: 'si' }, ['factura_pago', 'factura_rfc', 'factura_razon_social', 'factura_folio_fiscal']);
caso('Cotejo: un folio fiscal mal escrito y un RFC que no existe se rechazan', 'cotejo', { ...llega, ...coinciden(PODA), pago: 'si', ...factura, factura_rfc: 'XAXX019901000', factura_folio_fiscal: '6F1C2D3E-4A5B' }, ['factura_rfc', 'factura_folio_fiscal'], conFactura);
{
  const m = (ultimo.errores.find((e) => e.campo === 'factura_folio_fiscal') || {}).mensaje || '';
  const ok = /Cópielo/.test(m) && !/Cópialo/.test(m);
  console.log(`${ok ? 'BIEN' : 'MAL '}  Cotejo: el servidor responde el folio fiscal mal escrito en usted${ok ? '' : ` → ${m}`}`);
  if (!ok) fallas++;
}
// RFC con espacios o guiones (F2 M2): el largo se mide ya normalizado
caso('Cotejo: el RFC con espacios y guiones se acepta (se normaliza)', 'cotejo', { ...llega, ...coinciden(PODA), pago: 'si', ...factura, factura_rfc: 'XAXX-010101 000' }, true, conFactura);
caso('Cotejo: un RFC de 14 caracteres se rechaza', 'cotejo', { ...llega, ...coinciden(PODA), pago: 'si', ...factura, factura_rfc: 'MUPA800101AB12' }, ['factura_rfc'], conFactura);
// P129 (estándar 1.4.2): el RFC conserva la Ñ también en el servidor, aunque llegue descompuesta (N + tilde combinante)
caso('Cotejo: un RFC con Ñ se acepta', 'cotejo', { ...llega, ...coinciden(PODA), pago: 'si', ...factura, factura_rfc: 'muño800101ab1' }, true, conFactura);
{
  const conEnie = JSON.stringify(ultimo.datos || ultimo.limpios || ultimo.valores || {}).includes('MUÑO800101AB1');
  caso('Cotejo: un RFC con la Ñ descompuesta se acepta', 'cotejo', { ...llega, ...coinciden(PODA), pago: 'si', ...factura, factura_rfc: 'MUN\u0303O800101AB1' }, true, conFactura);
  const descompuesta = JSON.stringify(ultimo.datos || ultimo.limpios || ultimo.valores || {}).includes('MUÑO800101AB1');
  console.log(`${conEnie && descompuesta ? 'BIEN' : 'MAL '}  Cotejo: el servidor guarda el RFC con su Ñ (MUÑO800101AB1), no con N`);
  if (!(conEnie && descompuesta)) fallas++;
}
caso('Cotejo: el folio fiscal en minúsculas y sin guiones se acepta (se normaliza)', 'cotejo', { ...llega, ...coinciden(PODA), pago: 'si', ...factura, factura_folio_fiscal: '6f1c2d3e4a5b4c6d8e7f9a0b1c2d3e4f' }, true, conFactura);
caso('Cotejo: un documento sin cotejar se rechaza', 'cotejo', { ...llega, ...coinciden(PODA.slice(1)), pago: 'si', ...factura }, ['coincide_identificacion_oficial'], conFactura);
caso('Cotejo: sin pago no se pide factura, pero sí la cita nueva', 'cotejo', { ...llega, ...coinciden(PODA), pago: 'no' }, ['cita_fecha', 'cita_hora']);
caso('Cotejo: sin pago con su cita nueva se acepta', 'cotejo', { ...llega, ...coinciden(PODA), pago: 'no', ...cita }, true);
caso('Cotejo: un documento que no coincide pide qué no coincide y si lo trae hoy (no el pago)', 'cotejo', { ...llega, ...coinciden(PODA), coincide_curp: 'no' }, ['diferencia_curp', 'hoy_documento']);
caso('Cotejo: en pausa con lo que no coincide se acepta', 'cotejo', { ...llega, ...coinciden(PODA), coincide_curp: 'no', diferencia_curp: 'Trae otra versión de la CURP.', hoy_documento: 'si' }, true);
caso('Cotejo: retomado, sólo se coteja lo que quedó en pausa', 'cotejo', { _cargados: PODA, _pausa: ['curp'], coincide_curp: 'si', pago: 'si', ...factura }, true, conFactura);
caso('Cotejo: retomado, no se pregunta otra vez la llegada ni la identidad', 'cotejo', { _cargados: PODA, _pausa: ['curp'], pago: 'si', ...factura }, ['coincide_curp'], conFactura);
caso('Cotejo: no se presentó por primera vez pide la cita nueva', 'cotejo', { _cargados: PODA, se_presento: 'no' }, ['cita_fecha', 'cita_hora']);
caso('Cotejo: a la segunda inasistencia se cierra sin cita nueva', 'cotejo', { _cargados: PODA, _inasistencias: 1, se_presento: 'no' }, true);
caso('Cotejo: en la cita no se toma otra fotografía (la opción no existe)', 'cotejo', { ...llega, identidad: 'otra_foto', ...coinciden(PODA), pago: 'si', ...factura }, ['identidad'], conFactura);
caso('Cotejo: no es la persona pide la nota para la Dirección y no los documentos', 'cotejo', { _cargados: PODA, se_presento: 'si', identidad: 'no_es' }, ['nota_identidad']);
caso('Cotejo: no es la persona, con su nota, se acepta', 'cotejo', { _cargados: PODA, se_presento: 'si', identidad: 'no_es', nota_identidad: 'La identificación muestra a otra persona.' }, true);
caso('Corrección del mismo día: pide sólo el documento en pausa', 'corregir', { _pausa: ['curp'] }, ['doc_curp']);
caso('Corrección del mismo día: con el documento se acepta', 'corregir', { _pausa: ['curp'] }, true, [pdf('doc_curp')]);
caso('Corrección del mismo día: un documento que no quedó en pausa no se recibe', 'corregir', { _pausa: ['curp'] }, ['doc_curp', 'doc_identificacion_oficial'], [pdf('doc_identificacion_oficial')]);

caso('Entrar con CURP y contraseña se acepta', 'entrar', { curp: curpNadia, contrasena: 'x' }, true);
caso('Verificar con número válido se acepta', 'verificar', { numero: 'PD-2026-0001' }, true);
caso('Verificar sin número se rechaza', 'verificar', {}, ['numero']);
// Con o sin guiones, en minúsculas o con espacios (F1 10): se normaliza a PD-2026-0001
caso('Verificar: el número sin guiones y en minúsculas se acepta (se normaliza)', 'verificar', { numero: 'dt2025k109' }, true);
caso('Verificar: un número con un carácter que no va se rechaza, con el mensaje de la credencial', 'verificar', { numero: 'PD-2026-00$1' }, ['numero']);
{
  const m = (ultimo.errores.find((e) => e.campo === 'numero') || {}).mensaje || '';
  const bien = /credencial/.test(m) && !/acuse|folio/.test(m);
  console.log(`${bien ? 'BIEN' : 'MAL '}  Verificar: el mensaje habla de la credencial («${m}»)`);
  if (!bien) fallas++;
}
// La carrera escrita lleva letras (F1 12): «🌳🌳🌳» o «...» no son una carrera
caso('Solicitud: una carrera de sólo emojis se rechaza', 'solicitud', { ...base, tipo: 'poda', nivel_estudios: 'licenciatura', carrera: '🌳🌳🌳', estatus_estudios: 'titulado', ...docs('poda_nueva', podaNueva) }, ['carrera'], podaNueva.map((r) => pdf(`doc_poda_nueva_${r}`)));
caso('Solicitud: una carrera técnica de sólo puntos se rechaza', 'solicitud', { ...base, tipo: 'poda', nivel_estudios: 'tecnica', carrera_tecnica: '...', ...docs('poda_nueva', podaNueva) }, ['carrera_tecnica'], podaNueva.map((r) => pdf(`doc_poda_nueva_${r}`)));
caso('Solicitud: una carrera escrita que no está en el catálogo se acepta', 'solicitud', { ...base, tipo: 'poda', nivel_estudios: 'licenciatura', carrera: 'Ingeniería en Ciencias Ambientales (UAM)', estatus_estudios: 'titulado', ...docs('poda_nueva', podaNueva) }, true, podaNueva.map((r) => pdf(`doc_poda_nueva_${r}`)));

// Examen en línea (decisiones 2026-10-17, P78): el código es de un solo uso; el servidor revisa además que exista
caso('Examen: un código bien escrito se acepta', 'examen-entrar', { codigo: 'K7MP-3XQ9' }, true);
caso('Examen: el código en minúsculas y sin guion se acepta (se normaliza)', 'examen-entrar', { codigo: 'k7mp3xq9' }, true);
caso('Examen: un código con letras que se confunden (O, I, 0, 1) se rechaza', 'examen-entrar', { codigo: 'K7MO-3XQ1' }, ['codigo']);
caso('Examen: sin código se rechaza', 'examen-entrar', {}, ['codigo']);
caso('Examen: suspender sin motivo se rechaza', 'examen-suspender', {}, ['motivo']);
caso('Examen: suspender con su motivo se acepta', 'examen-suspender', { motivo: 'Consultó su teléfono durante el examen.' }, true);
caso('Grupo: armar un grupo sin curso, tipo de grupo ni primer día se rechaza', 'grupo-crear', {}, ['curso', 'integracion', 'fecha_inicio']);
caso('Grupo: armar un grupo combinado con su curso y su primer día se acepta (por confirmar)', 'grupo-crear', { curso: 'poda-nueva', integracion: 'combinado', fecha_inicio: '02/11/2026' }, true);
caso('Grupo: otra integración se rechaza', 'grupo-crear', { curso: 'poda-nueva', integracion: 'mixto', fecha_inicio: '02/11/2026' }, ['integracion']);
caso('Grupo: un curso fuera de los cuatro se rechaza', 'grupo-crear', { curso: 'poda-intensivo', integracion: 'combinado', fecha_inicio: '02/11/2026' }, ['curso']);
caso('Grupo: armar con hora e instructor de la lista se acepta (crear y confirmar)', 'grupo-crear', { curso: 'dictaminador-renovacion', integracion: 'especifico', fecha_inicio: '02/11/2026', hora_entrada: '09:00', instructor: 'instructor.ficticio' }, true);
caso('Grupo: armar con una hora fuera de la lista se rechaza', 'grupo-crear', { curso: 'poda-nueva', integracion: 'combinado', fecha_inicio: '02/11/2026', hora_entrada: '09:15' }, ['hora_entrada']);
caso('Grupo: armar con un instructor fuera de la lista se rechaza', 'grupo-crear', { curso: 'poda-nueva', integracion: 'combinado', fecha_inicio: '02/11/2026', instructor: 'otra.persona' }, ['instructor']);
const confirma = { fecha_inicio: '26/10/2026', hora_entrada: '09:00', instructor: 'instructor.ficticio' };
caso('Grupo: confirmar con primer día, hora e instructor se acepta', 'grupo-confirmar', confirma, true);
caso('Grupo: confirmar sin hora de entrada ni instructor se rechaza', 'grupo-confirmar', { fecha_inicio: '26/10/2026' }, ['hora_entrada', 'instructor']);
caso('Grupo: una hora de entrada fuera de la lista se rechaza', 'grupo-confirmar', { ...confirma, hora_entrada: '09:15' }, ['hora_entrada']);
caso('Grupo: dar de baja sin motivo se rechaza', 'grupo-baja', {}, ['motivo']);
caso('Grupo: dar de baja con motivo se acepta', 'grupo-baja', { motivo: 'Pidió cambiar de fecha por trabajo.' }, true);
caso('Grupo: cancelar sin motivo se rechaza', 'grupo-cancelar', {}, ['motivo']);
caso('Grupo: cancelar con motivo se acepta', 'grupo-cancelar', { motivo: 'No se reunió el cupo mínimo en el plazo previsto.' }, true);

// Material de estudio (personal): alta con su PDF, edición de datos sin archivo, reemplazo sólo con el archivo
const material = { titulo: 'Manual técnico de poda', edicion: 'Primera edición, 2026', descripcion: 'La guía de la Secretaría sobre técnicas de poda.', para: 'ambas', publicar: 'si' };
const pdfMaterial = [{ nombre: 'manual.pdf', size: 2000000, type: 'application/pdf', campo: 'archivo' }];
caso('Material: agregar con sus datos y su PDF se acepta', 'material', { _modo: 'nuevo', ...material }, true, pdfMaterial);
caso('Material: agregar sin archivo ni nombre se rechaza', 'material', { _modo: 'nuevo', ...material, titulo: '' }, ['titulo', 'archivo']);
caso('Material: un archivo que no es PDF se rechaza', 'material', { _modo: 'nuevo', ...material }, ['archivo'], [{ nombre: 'manual.docx', size: 20000, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', campo: 'archivo' }]);
caso('Material: «para» fuera de la lista se rechaza', 'material', { _modo: 'nuevo', ...material, para: 'todas' }, ['para'], pdfMaterial);
caso('Material: editar los datos no pide el archivo', 'material', { _modo: 'editar', titulo: material.titulo, edicion: material.edicion, descripcion: material.descripcion, para: 'poda' }, true);
caso('Material: reemplazar pide sólo el archivo', 'material', { _modo: 'reemplazar' }, ['archivo']);
caso('Material: reemplazar con el PDF se acepta', 'material', { _modo: 'reemplazar' }, true, pdfMaterial);

// Cancelación de una acreditación (P120) y reposición de la credencial (P140), sesión de trabajo del 23/10/2026
caso('Cancelación: sin motivo ni fundamento se rechaza', 'acreditacion-cancelar', {}, ['motivo', 'fundamento']);
caso('Cancelación: un motivo de menos de 10 caracteres se rechaza', 'acreditacion-cancelar', { motivo: 'Corto', fundamento: '[Art. __, fracc. __]' }, ['motivo']);
caso('Cancelación: con motivo y fundamento se acepta', 'acreditacion-cancelar', { motivo: 'Se documentó un derribo sin autorización.', fundamento: 'Lineamientos, [Art. __, fracc. __]' }, true);
const acta = [{ nombre: 'acta.pdf', size: 200000, type: 'application/pdf', campo: 'acta' }];
caso('Reposición: sin motivo ni acta se rechaza', 'reposicion', {}, ['motivo', 'acta']);
caso('Reposición: con motivo y el acta en PDF se acepta', 'reposicion', { motivo: 'perdida' }, true, acta);
caso('Reposición: el acta en foto (JPG) se acepta', 'reposicion', { motivo: 'robo' }, true, [{ nombre: 'acta.jpg', size: 900000, type: 'image/jpeg', campo: 'acta' }]);
caso('Reposición: un acta en Word se rechaza', 'reposicion', { motivo: 'robo' }, ['acta'], [{ nombre: 'acta.docx', size: 20000, type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', campo: 'acta' }]);
caso('Reposición: un acta de más de 5 MB se rechaza', 'reposicion', { motivo: 'robo' }, ['acta'], [{ nombre: 'acta.pdf', size: 6 * 1048576, type: 'application/pdf', campo: 'acta' }]);
caso('Reposición: un motivo fuera de la lista se rechaza', 'reposicion', { motivo: 'extravio' }, ['motivo'], acta);
caso('Reposición: aceptar el acta se acepta', 'reposicion-acta', { decision: 'acta_aceptada' }, true);
caso('Reposición: observar el acta sin decir qué corregir se rechaza', 'reposicion-acta', { decision: 'con_observaciones' }, ['observacion']);
caso('Reposición: observar el acta con lo que debe corregir se acepta', 'reposicion-acta', { decision: 'con_observaciones', observacion: 'Falta la hoja de firmas del acta.' }, true);
caso('Reposición: entregar sin factura se rechaza', 'reposicion-entrega', {}, ['factura_rfc', 'factura_razon_social', 'factura_folio_fiscal']);
caso('Reposición: entregar con la factura se acepta', 'reposicion-entrega', { factura_rfc: 'EJEM760707AB1', factura_razon_social: 'PERSONA EJEMPLO', factura_folio_fiscal: '0A1B2C3D-4E5F-4A6B-8C7D-9E0F1A2B3C4D' }, true);
caso('Reposición: un folio fiscal mal escrito se rechaza', 'reposicion-entrega', { factura_rfc: 'EJEM760707AB1', factura_razon_social: 'PERSONA EJEMPLO', factura_folio_fiscal: '12345' }, ['factura_folio_fiscal']);

console.log(fallas ? `\n${fallas} caso(s) fallido(s).` : '\nTodos los casos correctos.');
process.exit(fallas ? 1 : 0);
