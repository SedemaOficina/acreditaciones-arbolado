// EXPEDIENTES FICTICIOS · genera el guion SQL que recorre el trámite completo, paso a paso y con fechas
// simuladas, como lo haría la aplicación: conectado como apd_api y pasando por todas las reglas de la base.
// Si un dato ficticio viola una regla, la carga falla: los ficticios también prueban la base.
//
// Uso (lo llama herramientas/probar-base.sh):
//   node herramientas/ficticios.mjs > guion.sql
//
// Reglas de los datos ficticios (norma 3 de construir-sistema-nuevo):
//   · inequívocamente falsos y legibles: apellidos Ejemplo, Muestra, Prueba…; correo @ejemplo.local;
//     teléfono de ceros; CURP formadas del nombre ficticio, con entidad NE y homoclave 0 (válidas en formato y coherentes con el nombre); organizaciones «de Prueba»;
//   · todos los estados de la solicitud, del grupo y de la vigencia, al menos una vez;
//   · casos incómodos: nombre larguísimo, nombres repetidos, sin segundo apellido, calificación justo en el
//     mínimo, asistencia insuficiente, grupo cancelado, renovación vencida esperando grupo, dictaminador con
//     la poda vencida.
// Fecha de corte de los ficticios: CORTE, en corte-ficticios.mjs. Identificadores deterministas, para que
// regenerar no cambie los datos.

import { createHash, scryptSync } from 'node:crypto';
import { CORTE } from './corte-ficticios.mjs';
await import('../sitio/formkit/js/validaciones.config.js'); // la regla nombre ↔ CURP del estándar (prefijoCurp), para formar las CURP ficticias

const CORTE_MIGRACION = '2026-07-01';
const sql = [];
const emitir = (s) => sql.push(s.trim().endsWith(';') ? s : s + ';');
const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);

function uuid(clave) {
  const h = createHash('sha1').update('apd-ficticio:' + clave).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

// Contraseña de todas las cuentas ficticias: «Prueba-ficticia-2026». scrypt N=2^14, r=8, p=1 (parámetros de acceso).
// [pendiente] copiar el formato exacto de la cadena que usa el esquema acceso del SIA.
function hashContrasena(clave) {
  const sal = createHash('sha256').update('sal:' + clave).digest().subarray(0, 16);
  const h = scryptSync('Prueba-ficticia-2026', sal, 32, { N: 16384, r: 8, p: 1 });
  return `scrypt$16384$8$1$${sal.toString('base64url')}$${h.toString('base64url')}`;
}

// ── Contexto: cuándo y quién ─────────────────────────────────────────────
function en(fecha, hora = '10:00') {
  emitir(`SELECT set_config('apd.ahora_simulado', ${q(`${fecha} ${hora}:00-06`)}, false)`);
}
function como(usuario, tipo) {
  emitir(`SELECT set_config('apd.usuario', ${q(usuario)}, false), set_config('apd.usuario_tipo', ${q(tipo)}, false), set_config('apd.procedencia', '192.0.2.10', false)`);
}
const REVISION = 'revision.ficticia';
const COTEJO = 'cotejo.ficticio';
const EMISION = 'emision.ficticia';
const INSTRUCTOR = 'instructor.ficticio';

// ── Instituciones de adscripción ─────────────────────────────────────────
// Las empresas son ficticias y se agregan aquí; alcaldía y dependencias son del catálogo inicial (04), por su clave.
const ORG = {
  norte:    { tipo: 'privada', nombre: 'Jardines Ejemplo del Norte, S.A. de C.V.' },
  paisajes: { tipo: 'privada', nombre: 'Podas y Paisajes Muestra, Sociedad Cooperativa de Producción de Servicios Ambientales Urbanos' },
  oriente:  { tipo: 'alcaldia', clave: 'iztapalapa', nombre: 'Iztapalapa' },
  energia:  { tipo: 'dependencia_federal', clave: 'cfe', nombre: 'Comisión Federal de Electricidad (CFE)' },
  uni:      { tipo: 'dependencia_cdmx', clave: 'sedema_dgcorenadr', nombre: 'SEDEMA · Dirección General de la Comisión de Recursos Naturales y Desarrollo Rural (DGCORENADR)' }
};
const orgId = (k) => (ORG[k].clave ? `(SELECT id FROM apd.organizacion WHERE clave = ${q(ORG[k].clave)})` : q(uuid('org:' + k)));

// ── Personas ─────────────────────────────────────────────────────────────
const NOMBRES = ['Ana', 'Bruno', 'Carla', 'Diego', 'Elena', 'Fabián', 'Gloria', 'Héctor', 'Irene', 'Jorge', 'Karla',
  'Luis', 'Marta', 'Néstor', 'Olga', 'Pablo', 'Rosa', 'Sergio', 'Teresa', 'Ulises', 'Valeria', 'Wendy', 'Ximena',
  'Yolanda', 'Zacarías'];
const APELLIDOS = ['Ejemplo', 'Muestra', 'Prueba', 'Ficticio', 'Modelo', 'Simulado'];
let consecutivo = 0;
// Dígito verificador de la CURP, como en el Estándar de formularios del SIA
const ALFABETO_CURP = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
function conDigito(base17) {
  let suma = 0;
  for (let i = 0; i < 17; i++) suma += ALFABETO_CURP.indexOf(base17[i]) * (18 - i);
  return base17 + String((10 - (suma % 10)) % 10);
}

function persona(clave, opciones = {}) {
  const n = consecutivo++;
  const sexo = opciones.sexo || (n % 2 ? 'H' : 'M');
  const p = {
    clave,
    id: uuid('persona:' + clave),
    nombre: opciones.nombre || NOMBRES[n % NOMBRES.length],
    primer: opciones.primer || APELLIDOS[n % APELLIDOS.length],
    segundo: opciones.segundo === null ? null : opciones.segundo || APELLIDOS[(n + 2) % APELLIDOS.length],
    curp: null, // se forma abajo, del nombre ficticio
    correo: `persona${String(n + 1).padStart(2, '0')}@ejemplo.local`,
    telefono: `00000000${String(n + 1).padStart(2, '0')}`
  };
  // CURP ficticia que pasa las mismas reglas que una real: se forma del nombre ficticio como lo haría
  // RENAPO (prefijoCurp del estándar, la misma regla del formulario), con fecha de nacimiento ficticia,
  // entidad NE (nacida en el extranjero), homoclave 0 y dígito verificador (apd.curp_valida).
  p.nacimiento = `19${String(70 + (n % 30)).padStart(2, '0')}-${String((n % 12) + 1).padStart(2, '0')}-${String((n % 27) + 1).padStart(2, '0')}`;
  p.curp = conDigito(globalThis.FORMKIT_VALIDACIONES.prefijoCurp({ nombre: p.nombre, primer: p.primer, segundo: p.segundo }, p.nacimiento, sexo, 'NE') + '0');
  return p;
}

function alta(p, fecha) {
  en(fecha, '09:00');
  como(p.correo, 'solicitante');
  // Al crear la cuenta indica su adscripción; independiente hasta que una solicitud diga otra (ver solicitud())
  emitir(`INSERT INTO apd.solicitante (id, curp, nombre, primer_apellido, segundo_apellido, correo, telefono, adscripcion, contrasena_hash, es_ficticio)
  VALUES (${q(p.id)}, ${q(p.curp)}, ${q(p.nombre)}, ${q(p.primer)}, ${q(p.segundo)}, ${q(p.correo)}, ${q(p.telefono)}, 'independiente', ${q(hashContrasena(p.clave))}, true)`);
  fotografia(p);
}
// Fotografía de frente, obligatoria al crear la cuenta (la carga la persona; se confirma en el cotejo)
function fotografia(p, version = 1) {
  emitir(`INSERT INTO apd.fotografia (id, solicitante_id, archivo_clave, tipo_mime, tamano_bytes, sha256)
  VALUES (${q(uuid(`foto:${p.id}:${version}`))}, ${q(p.id)}, ${q(`ficticio/personas/${p.id}/foto-${version}.jpg`)}, 'image/jpeg', 184320,
    encode(sha256(convert_to(${q(p.id + 'foto' + version)}, 'UTF8')), 'hex'))`);
}

// Persona del padrón migrado: existe sin contraseña hasta que se registra con su CURP
function altaMigrada(p) {
  p.sinActivar = true;
  en(CORTE_MIGRACION, '06:30');
  como('migracion-kobo', 'migracion');
  emitir(`INSERT INTO apd.solicitante (id, curp, nombre, primer_apellido, segundo_apellido, correo, telefono, estado, es_ficticio)
  VALUES (${q(p.id)}, ${q(p.curp)}, ${q(p.nombre)}, ${q(p.primer)}, ${q(p.segundo)}, ${q(p.correo)}, ${q(p.telefono)}, 'sin_activar', true)`);
}
function activar(p, fecha) {
  en(fecha, '08:45');
  como(p.correo, 'solicitante');
  emitir(`UPDATE apd.solicitante SET contrasena_hash = ${q(hashContrasena(p.clave))}, estado = 'activa', adscripcion = 'independiente' WHERE id = ${q(p.id)}`);
  fotografia(p); // el formulario de la cuenta la pide también a quien viene del padrón
  p.sinActivar = false;
}

// Acreditaciones del registro anterior (Kobo), con su número original
let numeroKobo = 100;
function migrar(p, tipo, emitida) {
  const id = uuid(`acred-kobo:${p.clave}:${tipo}:${emitida}`);
  const pref = tipo === 'poda' ? 'PD' : 'DT';
  en(CORTE_MIGRACION, '07:00');
  como('migracion-kobo', 'migracion');
  emitir(`INSERT INTO apd.acreditacion (id, numero, solicitante_id, tipo_acreditacion, emitida_en, origen, folio_origen, es_ficticio)
  VALUES (${q(id)}, ${q(`${pref}-${emitida.slice(0, 4)}-K${numeroKobo}`)}, ${q(p.id)}, ${q(tipo)}, ${q(emitida)}, 'kobo', ${q('KOBO-' + numeroKobo)}, true)`);
  numeroKobo++;
  return id;
}

// ── Solicitudes ──────────────────────────────────────────────────────────
function solicitud(clave, p, tipo, modalidad, opciones = {}) {
  const s = { clave, id: uuid('solicitud:' + clave), persona: p, tipo, modalidad, ...opciones };
  if (p.sinActivar) activar(p, opciones.fecha); // la persona del padrón crea su contraseña al solicitar
  en(opciones.fecha, '09:30');
  como(p.correo, 'solicitante');
  // Perfil del dictaminador: nivel, carrera y estatus; la base calcula el perfil y la experiencia mínima
  // En poda se pregunta el nivel y, desde licenciatura, la carrera (dato del padrón); se reparte entre niveles comunes
  const NIVELES_PODA = ['secundaria', 'preparatoria', 'tecnica', 'licenciatura'];
  const nivelPoda = opciones.nivel || NIVELES_PODA[[...clave].reduce((n, ch) => n + ch.charCodeAt(0), 0) % NIVELES_PODA.length];
  const perfil = tipo === 'dictaminador'
    ? { nivel: opciones.nivel || 'licenciatura', carrera: opciones.carrera || 'Biología', estatus: opciones.estatus || 'titulado', anios: opciones.anios ?? 4 }
    : { nivel: nivelPoda, carrera: nivelPoda === 'licenciatura' ? (opciones.carrera || 'Arquitectura de Paisaje') : null, estatus: nivelPoda === 'licenciatura' ? 'titulado' : null, anios: null };
  // Con carrera técnica, su nombre escrito, sin catálogo (decisión 2026-10-17); nombres ficticios de ejemplo
  perfil.tecnica = perfil.nivel === 'tecnica' ? (opciones.tecnica || (tipo === 'dictaminador' ? 'Técnico forestal' : 'Técnico en jardinería')) : null;
  // La adscripción es de la persona («Mi perfil»); la solicitud la copia
  if (opciones.org) emitir(`UPDATE apd.solicitante SET adscripcion = ${q(ORG[opciones.org].tipo)}, organizacion_id = ${orgId(opciones.org)} WHERE id = ${q(p.id)}`);
  emitir(`INSERT INTO apd.solicitud (id, solicitante_id, tipo_acreditacion, modalidad, acreditacion_anterior_id,
    nivel_estudios, carrera, carrera_tecnica, estatus_estudios, anios_experiencia, es_ficticio)
  VALUES (${q(s.id)}, ${q(p.id)}, ${q(tipo)}, ${q(modalidad)},
    ${q(opciones.anterior)}, ${q(perfil.nivel)}, ${q(perfil.carrera)}, ${q(perfil.tecnica)}, ${q(perfil.estatus)}, ${perfil.anios ?? 'NULL'}, true)`);
  // Documentos obligatorios que se cargan en línea, tomados del catálogo de la base (fuente única)
  emitir(`INSERT INTO apd.documento (id, solicitud_id, requisito, archivo_clave, nombre_original, tipo_mime, tamano_bytes, sha256)
  SELECT md5('doc' || ${q(s.id)} || rc.requisito)::uuid, ${q(s.id)}, rc.requisito,
         'ficticio/' || ${q(s.id)} || '/' || rc.requisito || '-' || substr(md5(${q(s.id)} || rc.requisito), 1, 10) || '.pdf',
         rc.requisito || '.pdf', 'application/pdf',
         180000 + ('x' || substr(md5(${q(s.id)} || rc.requisito), 1, 5))::bit(20)::int,
         encode(sha256(convert_to(${q(s.id)} || rc.requisito, 'UTF8')), 'hex')
    FROM apd.requisito_curso rc JOIN apd.requisito r ON r.clave = rc.requisito
   WHERE rc.tipo_acreditacion = ${q(tipo)} AND rc.modalidad = ${q(modalidad)} AND rc.obligatorio
     AND r.forma = 'documento' AND r.momento = 'en_linea'`);
  return s;
}

function enviar(s, fecha, hora = '11:00') {
  en(fecha, hora);
  como(s.persona.correo, 'solicitante');
  emitir(`UPDATE apd.solicitud SET estado = 'enviada' WHERE id = ${q(s.id)}`);
}

function observar(s, fecha, requisito, texto) {
  en(fecha, '12:00');
  como(REVISION, 'personal');
  emitir(`UPDATE apd.documento SET estado = 'aceptado', revisado_por = ${q(REVISION)} WHERE solicitud_id = ${q(s.id)} AND vigente AND requisito <> ${q(requisito)}`);
  emitir(`UPDATE apd.documento SET estado = 'con_observacion', observacion = ${q(texto)}, revisado_por = ${q(REVISION)} WHERE solicitud_id = ${q(s.id)} AND vigente AND requisito = ${q(requisito)}`);
  emitir(`INSERT INTO apd.revision (id, solicitud_id, resultado, observacion_general, revisor) VALUES (${q(uuid(`rev:${s.id}:${fecha}`))}, ${q(s.id)}, 'con_observaciones', ${q(texto)}, ${q(REVISION)})`);
}

function recargar(s, fecha, requisito) {
  en(fecha, '18:00');
  como(s.persona.correo, 'solicitante');
  emitir(`INSERT INTO apd.documento (id, solicitud_id, requisito, archivo_clave, nombre_original, tipo_mime, tamano_bytes, sha256)
  VALUES (${q(uuid(`doc2:${s.id}:${requisito}`))}, ${q(s.id)}, ${q(requisito)}, ${q(`ficticio/${s.id}/${requisito}-v2.pdf`)}, ${q(requisito + '-corregido.pdf')}, 'application/pdf', 642118,
    encode(sha256(convert_to(${q(s.id + requisito + 'v2')}, 'UTF8')), 'hex'))`);
}

function validar(s, fecha, cita) {
  en(fecha, '13:00');
  como(REVISION, 'personal');
  emitir(`UPDATE apd.documento SET estado = 'aceptado', revisado_por = ${q(REVISION)} WHERE solicitud_id = ${q(s.id)} AND vigente AND estado <> 'aceptado'`);
  emitir(`UPDATE apd.solicitud SET cita_en = ${q(cita + ' 10:00:00-06')} WHERE id = ${q(s.id)}`);
  emitir(`INSERT INTO apd.revision (id, solicitud_id, resultado, revisor) VALUES (${q(uuid(`rev:${s.id}:${fecha}`))}, ${q(s.id)}, 'validada', ${q(REVISION)})`);
}

// Rechazo por perfil de dictaminador que no cumple, con su motivo (decisión 2026-10-16)
function rechazar(s, fecha, texto) {
  en(fecha, '13:30');
  como(REVISION, 'personal');
  emitir(`INSERT INTO apd.revision (id, solicitud_id, resultado, observacion_general, revisor) VALUES (${q(uuid(`rev:${s.id}:${fecha}`))}, ${q(s.id)}, 'rechazada', ${q(texto)}, ${q(REVISION)})`);
}

function cotejar(s, fecha) {
  en(fecha, '10:30');
  como(COTEJO, 'personal');
  // En la cita se verifica el pago, la Secretaría emite la factura y su personal carga el PDF y captura
  // RFC, nombre o razón social y folio fiscal (a la organización, o a la propia persona con RFC genérico)
  emitir(`INSERT INTO apd.documento (id, solicitud_id, requisito, archivo_clave, nombre_original, tipo_mime, tamano_bytes, sha256)
  VALUES (${q(uuid(`factura:${s.id}`))}, ${q(s.id)}, 'factura_pago', ${q(`ficticio/${s.id}/factura.pdf`)}, 'factura.pdf', 'application/pdf', 84211,
    encode(sha256(convert_to(${q(s.id + 'factura')}, 'UTF8')), 'hex'))`);
  const rfc = s.org ? `EJE0101${Object.keys(ORG).indexOf(s.org) + 10}AB1` : 'XAXX010101000';
  const razon = s.org ? ORG[s.org].nombre : `${s.persona.nombre} ${s.persona.primer}`;
  const h = createHash('md5').update('folio-fiscal:' + s.id).digest('hex').toUpperCase();
  const folio = `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
  // Frente a la persona y su identificación, el personal confirma su fotografía (una vez por persona)
  emitir(`UPDATE apd.fotografia SET estado = 'confirmada' WHERE solicitante_id = ${q(s.persona.id)} AND vigente AND estado = 'pendiente'`);
  // Todo coincidió y el pago está verificado: la cita queda atendida (decisiones 2026-10-17)
  emitir(`UPDATE apd.cita SET resultado = 'atendida' WHERE solicitud_id = ${q(s.id)} AND resultado = 'pendiente'`);
  emitir(`UPDATE apd.solicitud SET factura_rfc = ${q(rfc)}, factura_razon_social = ${q(razon)}, factura_folio_fiscal = ${q(folio)},
    estado = 'lista_para_curso' WHERE id = ${q(s.id)}`);
}

// El recorrido completo hasta quedar en espera de grupo
function hastaLista(s, f) {
  enviar(s, f.envio);
  if (f.observacion) {
    observar(s, f.observacion.fecha, f.observacion.requisito, f.observacion.texto);
    recargar(s, f.observacion.recarga, f.observacion.requisito);
    enviar(s, f.observacion.recarga, '19:00');
  }
  validar(s, f.validacion, f.cita);
  cotejar(s, f.cita);
}

// ── Grupos ───────────────────────────────────────────────────────────────
function grupo(clave, tipo, modalidad, fecha, org = null) {
  const g = { clave, id: uuid('grupo:' + clave) };
  en(fecha, '09:00');
  como(COTEJO, 'personal');
  emitir(`INSERT INTO apd.grupo (id, tipo_acreditacion, modalidad, integracion, organizacion_id, es_ficticio)
  VALUES (${q(g.id)}, ${q(tipo)}, ${q(modalidad)}, ${org ? "'especifico'" : "'combinado'"}, ${org ? orgId(org) : 'NULL'}, true)`);
  return g;
}
function inscribir(g, lista, fecha) {
  en(fecha, '12:00');
  como(COTEJO, 'personal');
  for (const s of lista) emitir(`INSERT INTO apd.inscripcion (id, solicitud_id, grupo_id) VALUES (${q(uuid(`insc:${g.id}:${s.id}`))}, ${q(s.id)}, ${q(g.id)})`);
}
function programar(g, fecha, inicio) {
  en(fecha, '16:00');
  como(COTEJO, 'personal');
  emitir(`UPDATE apd.grupo SET instructor = ${q(INSTRUCTOR)}, fecha_inicio = ${q(inicio)}, hora_entrada = '09:00' WHERE id = ${q(g.id)}`);
  emitir(`UPDATE apd.grupo SET estado = 'confirmado' WHERE id = ${q(g.id)}`);
}
function estadoGrupo(g, fecha, estado, motivo = null) {
  en(fecha, '08:30');
  como(INSTRUCTOR, 'personal');
  emitir(`UPDATE apd.grupo SET estado = ${q(estado)}${motivo ? `, motivo_cancelacion = ${q(motivo)}` : ''} WHERE id = ${q(g.id)}`);
}
const inscripcionDe = (s) => `(SELECT id FROM apd.inscripcion WHERE solicitud_id = ${q(s.id)} AND activa)`;
function asistencia(lista, dia, fecha, faltan = []) {
  en(fecha, '18:30');
  como(INSTRUCTOR, 'personal');
  for (const s of lista) {
    emitir(`INSERT INTO apd.asistencia (inscripcion_id, dia, asistio, capturada_por) VALUES (${inscripcionDe(s)}, ${dia}, ${faltan.includes(s) ? 'false' : 'true'}, ${q(INSTRUCTOR)})`);
  }
}
function examen(s, fecha, calificacion) {
  en(fecha, '19:00');
  como(INSTRUCTOR, 'personal');
  emitir(`INSERT INTO apd.examen (inscripcion_id, presentado_en, calificacion, capturado_por) VALUES (${inscripcionDe(s)}, ${q(fecha)}, ${calificacion}, ${q(INSTRUCTOR)})`);
}
function emitirAcreditacion(s, fecha) {
  en(fecha, '11:00');
  como(EMISION, 'personal');
  s.acreditacion = uuid('acred:' + s.clave);
  emitir(`INSERT INTO apd.acreditacion (id, solicitante_id, tipo_acreditacion, solicitud_id, es_ficticio)
  VALUES (${q(s.acreditacion)}, ${q(s.persona.id)}, ${q(s.tipo)}, ${q(s.id)}, true)`);
}
function entregar(s, fecha) {
  en(fecha, '12:00');
  como(EMISION, 'personal');
  // En el lugar: fotografía para la credencial; luego firma de recibido (el personal carga el comprobante
  // firmado y escaneado) y después marca la entrega
  emitir(`INSERT INTO apd.documento (id, solicitud_id, requisito, archivo_clave, nombre_original, tipo_mime, tamano_bytes, sha256)
  VALUES (${q(uuid(`foto-credencial:${s.id}`))}, ${q(s.id)}, 'foto_credencial', ${q(`ficticio/${s.id}/foto-credencial.jpg`)}, 'foto-credencial.jpg', 'image/jpeg', 210400,
    encode(sha256(convert_to(${q(s.id + 'foto-credencial')}, 'UTF8')), 'hex'))`);
  emitir(`INSERT INTO apd.documento (id, solicitud_id, requisito, archivo_clave, nombre_original, tipo_mime, tamano_bytes, sha256)
  VALUES (${q(uuid(`acuse:${s.id}`))}, ${q(s.id)}, 'acuse_entrega', ${q(`ficticio/${s.id}/acuse-entrega.pdf`)}, 'acuse-entrega.pdf', 'application/pdf', 152300,
    encode(sha256(convert_to(${q(s.id + 'acuse')}, 'UTF8')), 'hex'))`);
  emitir(`UPDATE apd.acreditacion SET entregada_en = ${q(fecha)} WHERE id = ${q(s.acreditacion)}`);
}
function cerrar(s, fecha, estado, motivo, quien = COTEJO) {
  en(fecha, '17:00');
  como(quien, quien.includes('@') ? 'solicitante' : 'personal');
  emitir(`UPDATE apd.solicitud SET estado = ${q(estado)}, motivo_cierre = ${q(motivo)} WHERE id = ${q(s.id)}`);
}

// ═════════════════════════════ EL GUION ═════════════════════════════

emitir(`-- Expedientes ficticios generados por herramientas/ficticios.mjs. Corte: ${CORTE}. No se edita a mano.`);
en('2026-07-01', '06:00');
como('migracion-kobo', 'migracion');
for (const [clave, o] of Object.entries(ORG)) {
  if (o.clave) continue; // del catálogo inicial
  emitir(`INSERT INTO apd.organizacion (id, tipo, nombre, es_ficticio) VALUES (${q(uuid('org:' + clave))}, ${q(o.tipo)}, ${q(o.nombre)}, true)`);
}

// 0 · Costo de cada curso, capturado por el personal como lo haría al publicarse en la Gaceta Oficial.
//     MONTOS FICTICIOS: los reales los fija la Gaceta. Distintos por curso. Al final del guion sube el de poda
//     nueva y quien ya tenía cita conserva el monto que se le indicó.
const ADMINISTRACION = 'administracion.ficticia';
function costo(tipo, modalidad, monto, desde) {
  en(desde, '08:00');
  como(ADMINISTRACION, 'personal');
  emitir(`UPDATE apd.curso SET pago_monto = ${monto}, pago_vigente_desde = ${q(desde)},
    pago_fundamento = 'MONTO FICTICIO DE PRUEBA, vigente desde ${desde}. El real lo fija la Gaceta Oficial.'
    WHERE tipo_acreditacion = ${q(tipo)} AND modalidad = ${q(modalidad)}`);
}
costo('poda', 'nueva', 1200, '2026-07-01');
costo('poda', 'renovacion', 800, '2026-07-01');
costo('dictaminador', 'nueva', 1800, '2026-07-01');
costo('dictaminador', 'renovacion', 1000, '2026-07-01');

// 1 · Grupo de poda (nueva) combinado y concluido en septiembre: aprobados, uno reprobado, uno sin derecho a examen
const g1 = [];
const orgsG1 = ['norte', null, 'paisajes', null, 'energia', 'norte', null, 'uni', null, 'paisajes'];
for (let i = 0; i < 10; i++) {
  const p = i === 3
    ? persona('g1-' + i, { nombre: 'María de los Ángeles Guadalupe', primer: 'Ejemplo-Muestra', segundo: 'de la Prueba y Ficticio' })
    : i === 6 ? persona('g1-' + i, { nombre: 'Juan', primer: 'Ejemplo', segundo: 'Muestra', sexo: 'H' })
    : persona('g1-' + i);
  alta(p, '2026-08-03');
  const s = solicitud('g1-' + i, p, 'poda', 'nueva', { fecha: '2026-08-03', org: orgsG1[i] });
  hastaLista(s, {
    envio: '2026-08-04',
    observacion: i === 2 || i === 7
      ? { fecha: '2026-08-06', requisito: i === 2 ? 'comprobante_domicilio' : 'identificacion_oficial',
          texto: i === 2 ? 'El comprobante tiene más de tres meses de antigüedad.' : 'La identificación está vencida; carga una vigente.',
          recarga: '2026-08-09' }
      : null,
    validacion: '2026-08-12',
    cita: '2026-08-18'
  });
  g1.push(s);
}
const G1 = grupo('g1', 'poda', 'nueva', '2026-08-20');
inscribir(G1, g1, '2026-08-20');
programar(G1, '2026-08-26', '2026-09-07');
estadoGrupo(G1, '2026-09-07', 'en_curso');
// Curso de cinco días (lunes a viernes). Una persona falta dos días: 3 de 5, sin derecho a examen.
asistencia(g1, 1, '2026-09-07');
asistencia(g1, 2, '2026-09-08', [g1[9]]);
asistencia(g1, 3, '2026-09-09', [g1[9]]);
asistencia(g1, 4, '2026-09-10', [g1[4]]);
asistencia(g1, 5, '2026-09-11');
// Mínimo 7.0 en poda: una aprueba justo con 7.0 y otra reprueba con 6.8
const calificaciones = [8.5, 9.6, 7.0, 8.4, 6.8, 9.0, 8.2, 8.8, 9.2];
for (let i = 0; i < 9; i++) examen(g1[i], '2026-09-11', calificaciones[i]);
estadoGrupo(G1, '2026-09-12', 'concluido');
for (const i of [0, 1, 2, 3, 5, 6, 7, 8]) emitirAcreditacion(g1[i], '2026-09-15');
for (const i of [0, 1, 2, 5, 6, 8]) entregar(g1[i], '2026-09-22');

// 2 · Padrón migrado de Kobo: renovaciones en todas las situaciones y dictaminadores
const vigenteSola = persona('padron-vigente');          // poda vigente, sin trámite
altaMigrada(vigenteSola);
migrar(vigenteSola, 'poda', '2025-11-20');

const porVencerEnviada = persona('renov-por-vencer');    // vence el 24/10: renovación enviada, por revisar
altaMigrada(porVencerEnviada);
const a1 = migrar(porVencerEnviada, 'poda', '2025-10-25');

const vencidaEspera = persona('renov-vencida-espera', { segundo: null }); // venció en julio: espera grupo desde el 1/09
altaMigrada(vencidaEspera);
const a2 = migrar(vencidaEspera, 'poda', '2025-08-01');

const renovB = persona('renov-b');                       // vence el 30/10
altaMigrada(renovB);
const a3 = migrar(renovB, 'poda', '2025-10-31');

const renovC = persona('renov-c', { nombre: 'Juan', primer: 'Ejemplo', segundo: 'Muestra', sexo: 'H' }); // nombre repetido
altaMigrada(renovC);
const a4 = migrar(renovC, 'poda', '2025-11-06');

const noRenovable = persona('vencida-no-renovable');     // venció hace más de un año: tramita como nueva
altaMigrada(noRenovable);
migrar(noRenovable, 'poda', '2024-05-10');

const dictSinPoda = persona('dictaminador-sin-poda');    // dictaminador vigente por fechas, pero su poda venció
altaMigrada(dictSinPoda);
migrar(dictSinPoda, 'poda', '2025-06-01');
migrar(dictSinPoda, 'dictaminador', '2026-01-10');

const dictRenov = persona('dictaminador-renov');         // dictaminador por vencer, con poda vigente
altaMigrada(dictRenov);
migrar(dictRenov, 'poda', '2026-02-15');
const a5 = migrar(dictRenov, 'dictaminador', '2025-10-30');

const dictNuevo1 = persona('dictaminador-nuevo-1');
altaMigrada(dictNuevo1);
migrar(dictNuevo1, 'poda', '2026-03-02');
const dictNuevo2 = persona('dictaminador-nuevo-2');
altaMigrada(dictNuevo2);
migrar(dictNuevo2, 'poda', '2026-04-20');
const dictObs = persona('dictaminador-observado');
altaMigrada(dictObs);
migrar(dictObs, 'poda', '2026-05-11');

// Renovación vencida, en espera desde el 1 de septiembre: prioridad y «vencida en espera»
const sVencida = solicitud('renov-vencida', vencidaEspera, 'poda', 'renovacion', { fecha: '2026-08-25', anterior: a2 });
hastaLista(sVencida, { envio: '2026-08-25', validacion: '2026-08-27', cita: '2026-09-01' });

// Dos renovaciones por vencer que estuvieron en un grupo que se canceló: regresan con su antigüedad
const sRenovB = solicitud('renov-b', renovB, 'poda', 'renovacion', { fecha: '2026-10-01', anterior: a3, org: 'oriente' });
hastaLista(sRenovB, { envio: '2026-10-01', validacion: '2026-10-02', cita: '2026-10-05' });
const sRenovC = solicitud('renov-c', renovC, 'poda', 'renovacion', { fecha: '2026-10-07', anterior: a4 });
hastaLista(sRenovC, { envio: '2026-10-07', validacion: '2026-10-07', cita: '2026-10-08' });
const G3 = grupo('g3', 'poda', 'renovacion', '2026-10-08');
inscribir(G3, [sVencida, sRenovB, sRenovC], '2026-10-09');
estadoGrupo(G3, '2026-10-12', 'cancelado', 'No se reunió el cupo mínimo en el plazo previsto; las personas regresan a la bandeja.');

// Renovación por vencer, enviada y sin revisar
const sPorVencer = solicitud('renov-por-vencer', porVencerEnviada, 'poda', 'renovacion', { fecha: '2026-10-12', anterior: a1, org: 'energia' });
enviar(sPorVencer, '2026-10-12');

// Vencida hace más de un año: borrador de solicitud nueva
solicitud('vencida-no-renovable', noRenovable, 'poda', 'nueva', { fecha: '2026-10-13' });

// Dictaminadores
const sDict1 = solicitud('dict-nuevo-1', dictNuevo1, 'dictaminador', 'nueva', { fecha: '2026-09-14', org: 'uni', carrera: 'Ingeniería Forestal', anios: 3 });
hastaLista(sDict1, { envio: '2026-09-14', validacion: '2026-09-17', cita: '2026-09-23' });
const sDict2 = solicitud('dict-nuevo-2', dictNuevo2, 'dictaminador', 'nueva', { fecha: '2026-10-05', nivel: 'tecnica', anios: 7 });
hastaLista(sDict2, { envio: '2026-10-05', validacion: '2026-10-07', cita: '2026-10-09' });
const sDictR = solicitud('dict-renov', dictRenov, 'dictaminador', 'renovacion', { fecha: '2026-10-01', anterior: a5, anios: 6, carrera: 'Agronomía' });
hastaLista(sDictR, { envio: '2026-10-01', validacion: '2026-10-02', cita: '2026-10-06' });
const sDictObs = solicitud('dict-observado', dictObs, 'dictaminador', 'nueva', { fecha: '2026-10-06', estatus: 'concluido', carrera: 'Biología', anios: 5.5 });
enviar(sDictObs, '2026-10-06');
observar(sDictObs, '2026-10-08', 'comprobantes_experiencia', 'Las constancias no indican el periodo ni las funciones realizadas en manejo de arbolado.');
// Un aprobado del grupo de septiembre ya pide dictaminador (tiene la poda que acaba de recibir)
const sDictG1 = solicitud('dict-g1', g1[1].persona, 'dictaminador', 'nueva', { fecha: '2026-10-10', nivel: 'maestria', carrera: 'Ingeniería Ambiental', anios: 5 });
enviar(sDictG1, '2026-10-10');

// 3 · Grupo de poda específico de una alcaldía, en curso (cinco días desde el 13/10): día 1 capturado, una falta
const g4 = [];
for (let i = 0; i < 11; i++) {
  const p = persona('g4-' + i);
  alta(p, '2026-09-21');
  const s = solicitud('g4-' + i, p, 'poda', 'nueva', { fecha: '2026-09-21', org: 'oriente' });
  hastaLista(s, { envio: '2026-09-22', validacion: '2026-09-25', cita: '2026-09-30' });
  g4.push(s);
}
const G4 = grupo('g4', 'poda', 'nueva', '2026-10-01', 'oriente');
inscribir(G4, g4.slice(0, 10), '2026-10-01');
programar(G4, '2026-10-02', '2026-10-13');
estadoGrupo(G4, '2026-10-13', 'en_curso');
asistencia(g4.slice(0, 10), 1, '2026-10-13', [g4[4]]);
// El undécimo de la alcaldía queda en la bandeja: el grupo específico se llenó con diez por fecha de cita

// 4 · Grupo combinado de poda en integración, por debajo del mínimo (4 de 5); dos más siguen en la bandeja
const g2 = [];
const orgsG2 = [null, 'paisajes', 'norte', null, 'energia', null];
for (let i = 0; i < 6; i++) {
  const p = persona('g2-' + i);
  alta(p, '2026-09-28');
  const s = solicitud('g2-' + i, p, 'poda', 'nueva', { fecha: '2026-09-28', org: orgsG2[i] });
  hastaLista(s, { envio: '2026-09-28', validacion: '2026-10-01', cita: '2026-10-06' });
  g2.push(s);
}
const G2 = grupo('g2', 'poda', 'nueva', '2026-10-07');
inscribir(G2, g2.slice(0, 4), '2026-10-07');

// 5 · Bandeja de poda nueva: una particular esperando desde agosto (prioridad) y dos de una empresa
const espera = persona('espera-larga');
alta(espera, '2026-08-05');
const sEspera = solicitud('espera-larga', espera, 'poda', 'nueva', { fecha: '2026-08-05' });
hastaLista(sEspera, { envio: '2026-08-06', validacion: '2026-08-10', cita: '2026-08-21' });
for (let i = 0; i < 2; i++) {
  const p = persona('norte-' + i);
  alta(p, '2026-10-05');
  const s = solicitud('norte-' + i, p, 'poda', 'nueva', { fecha: '2026-10-05', org: 'norte' });
  hastaLista(s, { envio: '2026-10-05', validacion: '2026-10-08', cita: '2026-10-13' });
}

// 6 · Etapas tempranas y cierres
const obs = persona('con-observaciones');
alta(obs, '2026-10-02');
const sObs = solicitud('con-observaciones', obs, 'poda', 'nueva', { fecha: '2026-10-02', org: 'paisajes' });
enviar(sObs, '2026-10-02');
observar(sObs, '2026-10-06', 'constancia_situacion_fiscal', 'La constancia de situación fiscal no está actualizada.');

const cita = persona('cita-asignada-1');
alta(cita, '2026-10-06');
const sCita = solicitud('cita-1', cita, 'poda', 'nueva', { fecha: '2026-10-06' });
enviar(sCita, '2026-10-06');
validar(sCita, '2026-10-09', '2026-10-20');
const cita2 = persona('cita-asignada-2');
alta(cita2, '2026-10-07');
const sCita2 = solicitud('cita-2', cita2, 'poda', 'nueva', { fecha: '2026-10-07', org: 'energia' });
enviar(sCita2, '2026-10-07');
validar(sCita2, '2026-10-12', '2026-10-21');

const recien = persona('recien-enviada');
alta(recien, '2026-10-14');
const sRecien = solicitud('recien-enviada', recien, 'poda', 'nueva', { fecha: '2026-10-14' });
enviar(sRecien, '2026-10-14');

const desiste = persona('cancelada');
alta(desiste, '2026-09-01');
const sDesiste = solicitud('cancelada', desiste, 'poda', 'nueva', { fecha: '2026-09-01' });
enviar(sDesiste, '2026-09-01');
validar(sDesiste, '2026-09-03', '2026-09-08');
cerrar(sDesiste, '2026-09-05', 'cancelada', 'La persona desistió del trámite por cambio de empleo.', desiste.correo);

const abandono = persona('sin-atender');
alta(abandono, '2026-07-20');
const sAbandono = solicitud('sin-atender', abandono, 'poda', 'nueva', { fecha: '2026-07-20' });
enviar(sAbandono, '2026-07-21');
observar(sAbandono, '2026-07-23', 'identificacion_oficial', 'La imagen de la identificación no es legible.');
cerrar(sAbandono, '2026-09-23', 'concluida_sin_atender', 'Las observaciones no se atendieron en el plazo [pendiente: plazo de la Dirección].');

// 7 · Bandeja de revisión documental (etapa 2): una reenviada con su corrección y un dictaminador con licenciatura trunca
const reenvia = persona('reenviada');
alta(reenvia, '2026-10-01');
const sReenvia = solicitud('reenviada', reenvia, 'poda', 'nueva', { fecha: '2026-10-01', org: 'norte' });
enviar(sReenvia, '2026-10-01');
observar(sReenvia, '2026-10-05', 'comprobante_domicilio', 'El comprobante de domicilio tiene más de tres meses de antigüedad.');
recargar(sReenvia, '2026-10-08', 'comprobante_domicilio');
enviar(sReenvia, '2026-10-08', '19:00');

const dictTrunca = persona('dictaminador-trunca');
altaMigrada(dictTrunca);
migrar(dictTrunca, 'poda', '2026-02-16');
const sDictTrunca = solicitud('dict-trunca', dictTrunca, 'dictaminador', 'nueva', { fecha: '2026-10-13', estatus: 'trunco', carrera: 'Biología', anios: 6 });
enviar(sDictTrunca, '2026-10-13');

const dictRechazo = persona('dictaminador-rechazado');
altaMigrada(dictRechazo);
migrar(dictRechazo, 'poda', '2026-01-19');
const sDictRechazo = solicitud('dict-rechazado', dictRechazo, 'dictaminador', 'nueva', { fecha: '2026-10-02', nivel: 'preparatoria', anios: 9 });
enviar(sDictRechazo, '2026-10-02');
rechazar(sDictRechazo, '2026-10-07', 'Tu comprobante de estudios confirma la preparatoria como último grado. Para la acreditación de dictaminador técnico se requiere al menos carrera técnica, carta de pasante o licenciatura. Puedes iniciar una solicitud nueva si cuentas con otro grado de estudios.');

en(CORTE, '20:00');
emitir(`SELECT set_config('apd.ahora_simulado', '', false)`);

process.stdout.write(sql.join('\n') + '\n');

// Actualización de costo (ficticia) en la fecha de corte: la poda nueva sube. Quien ya tiene cita conserva el
// monto que se le indicó; quien se valide desde hoy recibe el nuevo.
costo('poda', 'nueva', 1250, CORTE);
