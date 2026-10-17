// SEGUNDA VALIDACIÓN (servidor): regenera el esquema de cada formulario desde su HTML con la herramienta del
// Estándar de formularios del SIA y comprueba con su validar.mjs que el servidor acepta lo correcto y rechaza
// lo incorrecto, con las mismas reglas que el navegador.
//
// Uso: node herramientas/probar-esquemas.mjs <ruta-al-clon-de-estandar-formularios>
// Escribe db/esquemas-formularios/<formulario>.json (generados; no se editan a mano).

import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const estandar = process.argv[2];
if (!estandar) { console.error('Uso: node herramientas/probar-esquemas.mjs <ruta-al-clon-de-estandar-formularios>'); process.exit(2); }
const { validaPayload } = await import(pathToFileURL(join(estandar, 'codigo/servidor/validar.mjs')).href);
// Las validaciones cruzadas propias (CURP ↔ nombre) se suman a las del estándar, como en el navegador
await import(pathToFileURL(join(raiz, 'sitio/app/curp-nombre.js')).href);
// …y el formato propio de la fecha escrita como día/mes/año, con su cruzada contra la CURP
await import(pathToFileURL(join(raiz, 'sitio/app/fecha-dma.js')).href);
// …y el folio fiscal de la factura (cotejo)
await import(pathToFileURL(join(raiz, 'sitio/app/folio-fiscal.js')).href);
const cfgEstandar = globalThis.FORMKIT_VALIDACIONES;
const config = { ...cfgEstandar, cruzadas: { ...cfgEstandar.cruzadas, ...globalThis.APD_CRUZADAS }, formatos: { ...cfgEstandar.formatos, ...globalThis.APD_FORMATOS } };

const salida = join(raiz, 'db/esquemas-formularios');
mkdirSync(salida, { recursive: true });
const esquema = {};
for (const f of ['cuenta', 'entrar', 'solicitud', 'verificar', 'revisar', 'cotejo', 'corregir']) {
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

let fallas = 0;
const meta = { trampa: '', ms_en_formulario: 90000, idempotencia: 'prueba' };
const pdf = (n) => ({ nombre: `${n}.pdf`, size: 200000, type: 'application/pdf', campo: n });
// Como lo hará la API: los campos auxiliares no se reciben, el servidor los calcula.
//   · cuenta: sin_segundo_apellido = «si» si el segundo apellido viene vacío;
//   · solicitud: tramite = tipo + modalidad; la modalidad la decide la base por el historial (aquí la indica
//     el caso en `_modalidad`).
function comoServidor(form, datos) {
  const d = { ...datos };
  if (form === 'cuenta') {
    delete d.sin_segundo_apellido;
    if (!String(d.segundo_apellido || '').trim()) { delete d.segundo_apellido; d.sin_segundo_apellido = 'si'; }
  }
  if (form === 'solicitud') {
    delete d.tramite;
    if (d.tipo) d.tramite = `${d.tipo}_${d._modalidad || 'nueva'}`;
    delete d._modalidad;
  }
  // Revisión documental del personal (etapa 2): el servidor calcula los auxiliares con la base (perfil de la
  // solicitud y documentos cargados) y con las decisiones recibidas, igual que app/revisar.js. El caso indica
  // el perfil en `_perfil` y los documentos cargados en `_cargados`.
  if (form === 'revisar') {
    const perfil = d._perfil || 'no_aplica';
    const cargados = d._cargados || [];
    delete d._perfil; delete d._cargados;
    const rechazo = (perfil === 'por_clasificar' && d.clasificacion === 'no_afin') || (perfil === 'no_cumple' && d.comprobante_confirma === 'si');
    d.perfil_revision = perfil;
    for (const k of REQUISITOS_EN_LINEA) d[`revisar_${k}`] = !rechazo && cargados.includes(k) ? 'si' : 'no';
    const decisiones = cargados.map((k) => d[`decision_${k}`]);
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
    delete d._cargados; delete d._pausa; delete d._inasistencias;
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
  // Corrección del mismo día (persona): sólo los documentos que quedaron en pausa (`_pausa`)
  if (form === 'corregir') {
    const pausa = d._pausa || [];
    delete d._pausa;
    for (const k of REQUISITOS_EN_LINEA) d[`cargar_${k}`] = pausa.includes(k) ? 'si' : 'no';
  }
  return d;
}
const REQUISITOS_EN_LINEA = ['identificacion_oficial', 'curp', 'comprobante_domicilio', 'constancia_situacion_fiscal', 'comprobante_estudios', 'curriculum_vitae', 'comprobantes_experiencia'];
// El navegador no manda los campos de archivos en `datos` (el módulo los declara fuera de datos), pero
// validar.mjs exige un valor en `datos` para un campo obligatorio de archivos. Como lo hará la API: lo que
// venga en `datos` para esos campos se descarta y se pone el número de archivos recibidos de cada uno.
function conArchivos(form, datos, archivos) {
  const d = { ...datos };
  for (const [n, c] of Object.entries(esquema[form].campos || {})) if (c.tipo === 'archivos') delete d[n];
  for (const a of archivos) d[a.campo] = String(archivos.filter((x) => x.campo === a.campo).length);
  return d;
}
// El catálogo cerrado de alcaldías, como lo tendrá la API (el mismo que genera construir-sitio.mjs)
const orgs = JSON.parse(readFileSync(join(raiz, 'datos/ficticios.json'), 'utf8')).organizacion;
const ficticios = JSON.parse(readFileSync(join(raiz, 'datos/ficticios.json'), 'utf8'));
const catalogos = { empresas: orgs.filter((o) => o.tipo === 'privada').map((o) => o.nombre), carreras: ficticios.carrera.map((c) => c.nombre) };
function caso(nombre, form, datos, espera, archivos = []) {
  const r = validaPayload({ datos: conArchivos(form, comoServidor(form, datos), archivos), archivos, meta }, esquema[form], { config, catalogos });
  const campos = r.errores.map((e) => e.campo);
  const ok = espera === true ? r.ok : !r.ok && espera.every((c) => campos.includes(c)) && campos.every((c) => espera.includes(c));
  console.log(`${ok ? 'BIEN' : 'MAL '}  ${nombre}${ok ? '' : ` → ${JSON.stringify([...new Set(campos)])}`}`);
  if (!ok) fallas++;
}

const ALFABETO = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
const conDigito = (b) => { let s = 0; for (let i = 0; i < 17; i++) s += ALFABETO.indexOf(b[i]) * (18 - i); return b + String((10 - (s % 10)) % 10); };
const curpNadia = conDigito(globalThis.APD_CURP.prefijo({ nombre: 'Nadia', primer: 'Ejemplo', segundo: 'Simulado' }, '1999-12-30', 'M', 'NE') + '0');
const cuenta = { nombre: 'Nadia', primer_apellido: 'Ejemplo', segundo_apellido: 'Simulado', fecha_nacimiento: '30/12/1999', curp: curpNadia, correo: 'nadia@ejemplo.local', correo2: 'nadia@ejemplo.local', telefono: '5500000077', contrasena: 'una frase larga de prueba', contrasena2: 'una frase larga de prueba', adscrito: 'no', aviso: 'si', humano: 'si' };
const foto = (nombre = 'foto.jpg', type = 'image/jpeg') => [{ nombre, size: 180000, type, campo: 'foto' }];
caso('Cuenta completa con su fotografía se acepta', 'cuenta', cuenta, true, foto());
caso('Cuenta sin fotografía de frente se rechaza', 'cuenta', cuenta, ['foto']);
caso('Cuenta con la fotografía en PDF se rechaza', 'cuenta', cuenta, ['foto'], foto('foto.pdf', 'application/pdf'));
caso('Cuenta: CURP con dígito incorrecto y correo sin confirmar se rechazan', 'cuenta', { ...cuenta, curp: curpNadia.slice(0, 17) + ((Number(curpNadia[17]) + 1) % 10), correo2: 'otra@ejemplo.local' }, ['curp', 'correo2'], foto());
caso('Cuenta: una CURP ajena (de otro nombre) se rechaza', 'cuenta', { ...cuenta, nombre: 'Pedro', primer_apellido: 'López' }, ['curp'], foto());
caso('Cuenta: otro segundo apellido se rechaza', 'cuenta', { ...cuenta, segundo_apellido: 'Muestra' }, ['curp'], foto());
const curpUriel = conDigito(globalThis.APD_CURP.prefijo({ nombre: 'Uriel', primer: 'Ejemplo', segundo: '' }, '1988-04-09', 'H', 'NE') + '0');
caso('Cuenta sin segundo apellido se acepta', 'cuenta', { ...cuenta, nombre: 'Uriel', segundo_apellido: '', fecha_nacimiento: '09/04/1988', curp: curpUriel }, true, foto());
caso('Cuenta: dejar vacío el segundo apellido con una CURP que sí lo tiene se rechaza', 'cuenta', { ...cuenta, segundo_apellido: '' }, ['curp'], foto());
caso('Cuenta: el campo auxiliar enviado por el navegador no cuenta (lo calcula el servidor)', 'cuenta', { ...cuenta, segundo_apellido: '', sin_segundo_apellido: '' }, ['curp'], foto());
caso('Cuenta: otra fecha de nacimiento se rechaza', 'cuenta', { ...cuenta, fecha_nacimiento: '31/12/1999' }, ['curp'], foto());
caso('Cuenta: sin fecha de nacimiento se rechaza', 'cuenta', { ...cuenta, fecha_nacimiento: '' }, ['fecha_nacimiento'], foto());
caso('Cuenta: contraseña corta se rechaza', 'cuenta', { ...cuenta, contrasena: 'corta', contrasena2: 'corta' }, ['contrasena', 'contrasena2'], foto());
caso('Cuenta: sin aviso de privacidad se rechaza', 'cuenta', { ...cuenta, aviso: '' }, ['aviso'], foto());

// Solicitud: lo obligatorio depende del trámite elegido, con una sola condición por bloque
const docs = (t, lista) => Object.fromEntries(lista.map((r) => [`doc_${t}_${r}`, `${r}.pdf`]));
const base = { protesta: 'si', aviso: 'si', humano: 'si', nivel_estudios: 'preparatoria' };
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
caso('Perfil: licenciatura pide carrera y situación de los estudios', 'solicitud', { ...dictRenov, nivel_estudios: 'licenciatura' }, ['carrera', 'estatus_estudios'], csf);
caso('Perfil: carrera técnica pide cuál, no la carrera ni la situación', 'solicitud', { ...dictRenov, nivel_estudios: 'tecnica' }, ['carrera_tecnica'], csf);
caso('Perfil: carrera técnica escrita, sin catálogo, se acepta', 'solicitud', { ...dictRenov, nivel_estudios: 'tecnica', carrera_tecnica: 'Técnico forestal' }, true, csf);
caso('Poda: licenciatura pide la carrera y su situación', 'solicitud', { ...base, tipo: 'poda', _modalidad: 'renovacion', anterior: 'PD-2025-K106', nivel_estudios: 'licenciatura', doc_poda_renovacion_constancia_situacion_fiscal: 'c.pdf' }, ['carrera', 'estatus_estudios'], [pdf('doc_poda_renovacion_constancia_situacion_fiscal')]);
caso('Poda: sin nivel de estudios se rechaza', 'solicitud', { ...base, nivel_estudios: undefined, tipo: 'poda', _modalidad: 'renovacion', anterior: 'PD-2025-K106', doc_poda_renovacion_constancia_situacion_fiscal: 'c.pdf' }, ['nivel_estudios'], [pdf('doc_poda_renovacion_constancia_situacion_fiscal')]);
caso('Perfil: una carrera que no está en la lista se acepta (la clasifica la Secretaría)', 'solicitud', { ...dictRenov, nivel_estudios: 'maestria', carrera: 'Gestión Ambiental Urbana', estatus_estudios: 'en_curso' }, true, csf);
caso('Perfil: un nivel que no existe se rechaza', 'solicitud', { ...dictRenov, nivel_estudios: 'posdoctorado' }, ['nivel_estudios'], csf);
caso('Solicitud sin la declaración bajo protesta de decir verdad se rechaza', 'solicitud', { ...base, protesta: undefined, tipo: 'poda', _modalidad: 'renovacion', anterior: 'PD-2025-K106', doc_poda_renovacion_constancia_situacion_fiscal: 'c.pdf' }, ['protesta'], [pdf('doc_poda_renovacion_constancia_situacion_fiscal')]);
caso('Solicitud con una acreditación que no existe se rechaza', 'solicitud', { ...base, tipo: 'otra' }, ['tipo']);
caso('Experiencia fuera de rango se rechaza', 'solicitud', { ...base, tipo: 'dictaminador', _modalidad: 'renovacion', anterior: 'DT-2025-K109', nivel_estudios: 'licenciatura', carrera: 'Biología', estatus_estudios: 'titulado', anios_experiencia: '80', doc_dictaminador_renovacion_constancia_situacion_fiscal: 'c.pdf' }, ['anios_experiencia'], [pdf('doc_dictaminador_renovacion_constancia_situacion_fiscal')]);

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
const cita = { cita_fecha: '2026-10-21', cita_hora: '10:00' };
caso('Revisión: poda con todo aceptado y su cita se valida', 'revisar', { _cargados: PODA, ...acepta(PODA), ...cita }, true);
caso('Revisión: validar sin cita se rechaza', 'revisar', { _cargados: PODA, ...acepta(PODA) }, ['cita_fecha', 'cita_hora']);
caso('Revisión: una hora que no existe se rechaza', 'revisar', { _cargados: PODA, ...acepta(PODA), ...cita, cita_hora: '25:00' }, ['cita_hora']);
caso('Revisión: un documento sin decidir se rechaza', 'revisar', { _cargados: PODA, ...acepta(PODA.slice(1)) }, ['decision_identificacion_oficial']);
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
caso('Cotejo: tomar otra fotografía la pide', 'cotejo', { ...llega, identidad: 'otra_foto', ...coinciden(PODA), pago: 'si', ...factura }, ['foto_nueva'], conFactura);
caso('Cotejo: no es la persona pide la nota para la Dirección y no los documentos', 'cotejo', { _cargados: PODA, se_presento: 'si', identidad: 'no_es' }, ['nota_identidad']);
caso('Cotejo: no es la persona, con su nota, se acepta', 'cotejo', { _cargados: PODA, se_presento: 'si', identidad: 'no_es', nota_identidad: 'La identificación muestra a otra persona.' }, true);
caso('Corrección del mismo día: pide sólo el documento en pausa', 'corregir', { _pausa: ['curp'] }, ['doc_curp']);
caso('Corrección del mismo día: con el documento se acepta', 'corregir', { _pausa: ['curp'] }, true, [pdf('doc_curp')]);
caso('Corrección del mismo día: un documento que no quedó en pausa no se recibe', 'corregir', { _pausa: ['curp'] }, ['doc_curp'], [pdf('doc_identificacion_oficial')]);

caso('Entrar con CURP y contraseña se acepta', 'entrar', { curp: curpNadia, contrasena: 'x' }, true);
caso('Verificar con número válido se acepta', 'verificar', { numero: 'PD-2026-0001' }, true);
caso('Verificar sin número se rechaza', 'verificar', {}, ['numero']);

console.log(fallas ? `\n${fallas} caso(s) fallido(s).` : '\nTodos los casos correctos.');
process.exit(fallas ? 1 : 0);
