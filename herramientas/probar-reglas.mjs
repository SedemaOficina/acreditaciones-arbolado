// PRUEBAS DE REGLAS Y PERMISOS de la base apd, sobre una base de pruebas ya cargada con los ficticios.
// Cada caso corre en su propia transacción que se deshace al final (ROLLBACK): ningún caso afecta a otro.
// Casi todos corren COMO apd_api, la cuenta del servicio: los huecos se esconden en el perfil de menos
// privilegios, no en el de administración (norma 7.5).
//
// Uso: node herramientas/probar-reglas.mjs <base>   (con PGHOST, PGPORT y PGUSER de administración)
//
// Un caso espera:
//   · 'ok'                    — corre sin error (las afirmaciones van con ASSERT dentro de un DO);
//   · { codigo: 'x' }         — una regla de la base, apd.error('x', …);
//   · { sqlstate: '42501' }   — un error de PostgreSQL: 42501 permiso, 23505 duplicado, 23514 restricción.

import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const base = process.argv[2];
if (!base || !base.includes('prueba')) {
  console.error('Uso: node herramientas/probar-reglas.mjs <base_de_prueba>');
  process.exit(2);
}

// Atajos de consulta: los casos buscan los datos por su situación, no por folio
const PERSONA_VIGENTE = `(SELECT solicitante_id FROM apd.acreditacion WHERE numero = 'PD-2025-K100')`;
const ACRED_POR_VENCER = `(SELECT id FROM apd.acreditacion WHERE numero = 'PD-2025-K101')`;
const ACRED_NO_RENOVABLE = `(SELECT id FROM apd.acreditacion WHERE numero = 'PD-2024-K105')`;
const PERSONA_NO_RENOVABLE = `(SELECT solicitante_id FROM apd.acreditacion WHERE numero = 'PD-2024-K105')`;
const DICT_SIN_PODA = `(SELECT id FROM apd.acreditacion WHERE numero = 'DT-2026-K107')`;
// El grupo en integración de los ficticios originales, por su folio: fijo aunque el caso le cambie la fecha o el estado
// (el de «grupo-por-confirmar» también está en integración, con fecha propuesta)
const GRUPO_INTEGRACION = `(SELECT id FROM apd.grupo WHERE folio = 'APD-G-2026-004')`;
// El grupo de la alcaldía (APD-G-2026-003), en curso desde el lunes 12/10: hay otro en curso, el del caso «aprobó», sin concluir
const GRUPO_EN_CURSO = `(SELECT id FROM apd.grupo WHERE folio = 'APD-G-2026-003')`;
const BORRADOR = `(SELECT id FROM apd.solicitud WHERE estado = 'borrador' LIMIT 1)`;
const ENVIADA = `(SELECT id FROM apd.solicitud WHERE estado = 'enviada' ORDER BY folio LIMIT 1)`;
const DICT_OBS = `(SELECT id FROM apd.solicitud WHERE estado = 'con_observaciones' AND tipo_acreditacion = 'dictaminador' ORDER BY folio LIMIT 1)`;
const POR_CLASIFICAR = `(SELECT id FROM apd.solicitud WHERE estado = 'enviada' AND perfil_academico = 'por_clasificar' ORDER BY folio LIMIT 1)`;
const PODA_ENVIADA = `(SELECT id FROM apd.solicitud WHERE estado = 'enviada' AND tipo_acreditacion = 'poda' ORDER BY folio LIMIT 1)`;
// Deja la solicitud lista para validar: documentos aceptados y cita
const LISTA_PARA_VALIDAR = (sol) => `
     UPDATE apd.documento SET estado = 'aceptado', revisado_por = 'prueba.automatica' WHERE solicitud_id = ${sol} AND vigente;
     UPDATE apd.solicitud SET cita_en = '2026-10-21 10:00-06' WHERE id = ${sol};`;
// La solicitud de dictaminador con observaciones, corregida a licenciatura trunca y reenviada por la persona
const TRUNCA_ENVIADA = `
     SELECT set_config('apd.usuario_tipo', 'solicitante', true);
     UPDATE apd.solicitud SET nivel_estudios = 'licenciatura', estatus_estudios = 'trunco', carrera = 'Biología' WHERE id = ${DICT_OBS};
     UPDATE apd.solicitud SET estado = 'enviada' WHERE id = ${DICT_OBS};
     SELECT set_config('apd.usuario_tipo', 'personal', true);
     CREATE TEMP TABLE caso AS SELECT id FROM apd.solicitud WHERE estado = 'enviada' AND perfil_academico = 'no_cumple' ORDER BY folio LIMIT 1;`;
const LISTA_DICT = `(SELECT solicitud_id FROM apd.bandeja_demanda WHERE tipo_acreditacion = 'dictaminador' ORDER BY folio LIMIT 1)`;
const DOC_PEQUENO = (sol, req, tam = 1000) =>
  `INSERT INTO apd.documento (solicitud_id, requisito, archivo_clave, nombre_original, tipo_mime, tamano_bytes, sha256)
   VALUES (${sol}, '${req}', 'prueba/' || gen_random_uuid(), 'x.pdf', 'application/pdf', ${tam}, repeat('a', 64));`;

const FOTO_DOC = (sol, mime = 'image/jpeg') =>
  `INSERT INTO apd.documento (solicitud_id, requisito, archivo_clave, nombre_original, tipo_mime, tamano_bytes, sha256)
   VALUES (${sol}, 'foto_credencial', 'prueba/' || gen_random_uuid(), 'f.jpg', '${mime}', 1000, repeat('b', 64));`;
const FOTO = (persona, mime = 'image/jpeg') =>
  `INSERT INTO apd.fotografia (solicitante_id, archivo_clave, tipo_mime, tamano_bytes, sha256)
   VALUES (${persona}, 'prueba/' || gen_random_uuid(), '${mime}', 1000, repeat('c', 64));`;
// Cita de cotejo: la primera solicitud validada (su cita es el 20/10/2026 a las 10:00)
// La solicitud con cita de los ficticios originales (enviada desde el 06/10); los casos del menú de pruebas, enviados
// antes, ya traen otras citas. Fija: no depende de lo que el caso le haga a la cita.
const CITA_SOL = `(SELECT id FROM apd.solicitud WHERE estado = 'validada_en_linea' AND enviada_en >= '2026-10-06' ORDER BY folio LIMIT 1)`;
// Lo que pasó en una cita se registra su día (cita_futura): los casos que la atienden corren el día de la cita
const DIA_CITA = '2026-10-20 10:30';
const NO_SE_PRESENTO = `UPDATE apd.cita SET resultado = 'no_se_presento' WHERE solicitud_id = ${CITA_SOL} AND resultado = 'pendiente';`;
// La CURP no coincide y la persona la trae ese día: se marca el documento y la cita queda en pausa
const PAUSA_CURP = `
     UPDATE apd.documento SET estado = 'con_observacion', observacion = 'Trae otra versión de la CURP.', revisado_por = 'prueba.automatica'
      WHERE solicitud_id = ${CITA_SOL} AND requisito = 'curp' AND vigente;
     UPDATE apd.cita SET resultado = 'en_pausa', observacion = 'CURP: trae otra versión.' WHERE solicitud_id = ${CITA_SOL} AND resultado = 'pendiente';`;
const COTEJO_PERSONA = `(SELECT solicitante_id FROM apd.solicitud WHERE estado = 'validada_en_linea' ORDER BY folio LIMIT 1)`;
// Una persona nueva sin fotografía, con una solicitud de poda nueva y todos sus documentos en línea
const SIN_FOTO = `
     INSERT INTO apd.solicitante (id, curp, nombre, primer_apellido, correo, telefono, adscripcion, contrasena_hash, es_ficticio)
     VALUES ('00000000-0000-4000-a000-000000000011', 'XAXX991231HNEXXX09', 'Caso', 'Prueba', 'caso@ejemplo.local', '0000000099', 'independiente', 'x', true);
     INSERT INTO apd.solicitud (id, solicitante_id, tipo_acreditacion, modalidad, nivel_estudios)
     VALUES ('00000000-0000-4000-a000-000000000012', '00000000-0000-4000-a000-000000000011', 'poda', 'nueva', 'preparatoria');
     INSERT INTO apd.documento (solicitud_id, requisito, archivo_clave, nombre_original, tipo_mime, tamano_bytes, sha256)
     SELECT '00000000-0000-4000-a000-000000000012', rc.requisito, 'prueba/' || gen_random_uuid(), 'x.pdf', 'application/pdf', 1000, repeat('a', 64)
       FROM apd.requisito_curso rc JOIN apd.requisito r ON r.clave = rc.requisito
      WHERE rc.tipo_acreditacion = 'poda' AND rc.modalidad = 'nueva' AND rc.obligatorio AND r.forma = 'documento' AND r.momento = 'en_linea';`;

const MATERIAL_NUEVO = (clave, mime = 'application/pdf', tam = 1000) =>
  `INSERT INTO apd.material_estudio (clave, titulo, descripcion, edicion, archivo_clave, nombre_archivo, tipo_mime, tamano_bytes, sha256, paginas)
   VALUES ('${clave}', 'Documento de prueba', 'Para probar las reglas del material de estudio.', 'Edición de prueba',
           'prueba/' || gen_random_uuid(), 'prueba.pdf', '${mime}', ${tam}, repeat('d', 64), 3);`;

// ── Para los casos de las correcciones del 19/10/2026 ──
const q = (v) => `'${String(v).replace(/'/g, "''")}'`;
// CURP de 17 caracteres + su dígito verificador, como el Estándar (para probar sólo la fecha)
const ALFABETO_CURP = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
const curpCon = (b) => { let s = 0; for (let i = 0; i < 17; i++) s += ALFABETO_CURP.indexOf(b[i]) * (18 - i); return b + String((10 - (s % 10)) % 10); };
const S44 = `(SELECT id FROM apd.solicitud WHERE folio = 'APD-S-2026-00044')`;
const G5 = `(SELECT id FROM apd.grupo WHERE folio = 'APD-G-2026-005')`;
// La inscripción activa de APD-S-2026-00021 (grupo de la alcaldía, en curso desde el lunes 12/10, con los días 1 y 2
// capturados; antes del 23/10/2026 empezaba el martes 13) y su asistencia de los días 3 a 5
const INS21 = `(SELECT i.id FROM apd.inscripcion i JOIN apd.solicitud s ON s.id = i.solicitud_id WHERE s.folio = 'APD-S-2026-00021' AND i.activa)`;
const ASISTE21 = `INSERT INTO apd.asistencia (inscripcion_id, dia, asistio, capturada_por) SELECT ${INS21}, d, true, 'x' FROM generate_series(3, 5) d;`;
const SIN_ACRED = `(SELECT s.id FROM apd.solicitante s WHERE NOT EXISTS (SELECT 1 FROM apd.acreditacion a WHERE a.solicitante_id = s.id) ORDER BY s.curp LIMIT 1)`;
const ACTIVA = `(SELECT id FROM apd.solicitante WHERE estado = 'activa' ORDER BY curp LIMIT 1)`;
const COMO = (tipo, usuario = 'prueba.automatica') => `SELECT set_config('apd.usuario', '${usuario}', true), set_config('apd.usuario_tipo', '${tipo}', true);`;
// ── Cancelación (P120) y reposición (P140), sesión de trabajo del 23/10/2026 ──
// Perfil del personal en el acceso del SIA (P27), como lo declara el backend
const PERFIL = (perfil) => `SELECT set_config('apd.perfil', '${perfil}', true);`;
// PD-2025-K100: poda vigente del registro anterior, sin trámite (vence el 19/11/2026)
const ACRED_VIGENTE = `(SELECT id FROM apd.acreditacion WHERE numero = 'PD-2025-K100')`;
const ACRED_CANCELADA = `(SELECT id FROM apd.acreditacion WHERE cancelada_en IS NOT NULL ORDER BY numero LIMIT 1)`;
// La acreditación de la reposición ficticia en ese paso
const REPOS = (estado) => `(SELECT acreditacion_id FROM apd.reposicion WHERE estado = '${estado}' ORDER BY solicitada_en LIMIT 1)`;
const REPOSICION = (acred, tam = 1000) =>
  `INSERT INTO apd.reposicion (acreditacion_id, motivo, acta_archivo_clave, acta_nombre_original, acta_tipo_mime, acta_tamano_bytes, acta_sha256)
   VALUES (${acred}, 'perdida', 'prueba/' || gen_random_uuid(), 'acta.pdf', 'application/pdf', ${tam}, repeat('f', 64));`;
// Bitácora: cuántos renglones deja una acción (E2-04)
const B0 = `CREATE TEMP TABLE b0 AS SELECT count(*) AS n FROM apd.bitacora;`;
const MAS = (n, accion) => `DO $$ BEGIN ASSERT (SELECT count(*) FROM apd.bitacora) = (SELECT n FROM b0) + ${n};${accion ? ` ASSERT EXISTS (SELECT 1 FROM apd.bitacora WHERE accion = '${accion}' AND usuario = 'prueba.automatica');` : ''} END $$;`;
// Cinco intentos de entrada fallidos de la primera cuenta activa (D-07), con lo que devolvió cada uno
const INTENTOS5 = `CREATE TEMP TABLE r (n integer, intentos integer, bloqueada_hasta timestamptz);
     DO $$ BEGIN FOR k IN 1..5 LOOP
       INSERT INTO r SELECT k, a.* FROM apd.anotar_intento((SELECT curp FROM apd.solicitante WHERE estado = 'activa' ORDER BY curp LIMIT 1)) a;
     END LOOP; END $$;`;

// ── Registro asistido (decisión 2026-10-25, Liber): personas que no saben leer ni escribir ──
// Las cuatro cuentas ficticias del registro asistido, por su nombre (apellido Supuesto): con observaciones (AMALIA), en
// revisión (BENITO), con su cita (CIRILO) y ya activada por la persona (DOLORES)
const ASIS = (nombre) => `(SELECT id FROM apd.solicitante WHERE registro_asistido_en IS NOT NULL AND nombre = '${nombre}')`;
const SOL_DE = (persona) => `(SELECT id FROM apd.solicitud WHERE solicitante_id = ${persona} ORDER BY folio DESC LIMIT 1)`;
const LECTURA = (marca) => `SELECT set_config('apd.lectura_aceptada', '${marca}', true);`;
const CURP_ASIS = curpCon('SUEX800101HNESPJ0');
const CURP_ASIS2 = curpCon('SUEX810202MNESPJ0');
const CURP_MENOR = curpCon('SUEX100101HNESPJA');
const ID_ASIS = '00000000-0000-4000-a000-000000000031';
// El alta de una cuenta del registro asistido, sin contraseña (lo de antes, contexto y marca, lo pone cada caso)
const ALTA_ASIS = (curp = CURP_ASIS, extra = {}) => {
  const c = { id: ID_ASIS, correo: null, estado: 'activa', ...extra };
  return `INSERT INTO apd.solicitante (id, curp, nombre, primer_apellido, correo, telefono, adscripcion, estado, es_ficticio)
     VALUES ('${c.id}', '${curp}', 'Caso', 'Supuesto', ${c.correo ? `'${c.correo}'` : 'NULL'}, '0000000098', 'independiente', '${c.estado}', true);`;
};
// Una persona del registro asistido con su fotografía y su solicitud de poda nueva, con todos sus documentos en línea,
// capturados por el personal de revisión y cotejo
const ASISTIDA_CON_SOLICITUD = `
     ${PERFIL('revision_cotejo')} ${LECTURA('aviso_privacidad')}
     ${ALTA_ASIS()}
     ${FOTO(`'${ID_ASIS}'`)}
     INSERT INTO apd.solicitud (id, solicitante_id, tipo_acreditacion, modalidad, nivel_estudios)
     VALUES ('00000000-0000-4000-a000-000000000032', '${ID_ASIS}', 'poda', 'nueva', 'primaria');
     INSERT INTO apd.documento (solicitud_id, requisito, archivo_clave, nombre_original, tipo_mime, tamano_bytes, sha256)
     SELECT '00000000-0000-4000-a000-000000000032', rc.requisito, 'prueba/' || gen_random_uuid(), 'x.pdf', 'application/pdf', 1000, repeat('a', 64)
       FROM apd.requisito_curso rc JOIN apd.requisito r ON r.clave = rc.requisito
      WHERE rc.tipo_acreditacion = 'poda' AND rc.modalidad = 'nueva' AND rc.obligatorio AND r.forma = 'documento' AND r.momento = 'en_linea';
     ${LECTURA('')}`;
const SOL_ASIS = `'00000000-0000-4000-a000-000000000032'`;
const SESION = (persona) => `INSERT INTO apd.sesion_solicitante (solicitante_id, testigo_sha256, vence_en) VALUES (${persona}, encode(sha256(gen_random_uuid()::text::bytea), 'hex'), now() + interval '1 hour');`;
const AVISOS = (persona, aviso) => `(SELECT count(*) FROM apd.aviso_telefono WHERE solicitante_id = ${persona}${aviso ? ` AND aviso = '${aviso}'` : ''})`;
// CIRILO, el día de su cita (21/10/2026): cotejo terminado, como lo hace cotejar() en los ficticios
const COTEJO_CIRILO = `
     INSERT INTO apd.documento (solicitud_id, requisito, archivo_clave, nombre_original, tipo_mime, tamano_bytes, sha256)
     VALUES (${SOL_DE(ASIS('CIRILO'))}, 'factura_pago', 'prueba/' || gen_random_uuid(), 'factura.pdf', 'application/pdf', 1000, repeat('e', 64));
     UPDATE apd.fotografia SET estado = 'confirmada' WHERE solicitante_id = ${ASIS('CIRILO')} AND vigente;
     UPDATE apd.cita SET resultado = 'atendida' WHERE solicitud_id = ${SOL_DE(ASIS('CIRILO'))} AND resultado = 'pendiente';
     UPDATE apd.solicitud SET factura_rfc = 'SUPC750101AB1', factura_razon_social = 'CIRILO SUPUESTO PRUEBA',
       factura_folio_fiscal = 'ABCDEF01-2345-4678-9ABC-DEF0123456AA', estado = 'lista_para_curso' WHERE id = ${SOL_DE(ASIS('CIRILO'))};`;

const casos = [
  // ── Vigencia con fechas movidas (PD-2025-K101 se emitió el 25/10/2025 y vence el 24/10/2026) ──
  ['Vigente el día anterior a la ventana', 'ok', null, `DO $$ BEGIN
     ASSERT apd.estado_acreditacion(${ACRED_POR_VENCER}, '2026-09-23') = 'vigente'; END $$;`],
  ['Se puede renovar desde 30 días naturales antes del vencimiento', 'ok', null, `DO $$ BEGIN
     ASSERT apd.estado_acreditacion(${ACRED_POR_VENCER}, '2026-09-24') = 'por_vencer'; END $$;`],
  ['El día del vencimiento todavía es vigente y opera', 'ok', null, `DO $$ BEGIN
     ASSERT apd.estado_acreditacion(${ACRED_POR_VENCER}, '2026-10-24') = 'por_vencer';
     ASSERT apd.acreditacion_vigente(${ACRED_POR_VENCER}, '2026-10-24'); END $$;`],
  ['Al día siguiente del vencimiento ya no opera, pero se renueva', 'ok', null, `DO $$ BEGIN
     ASSERT apd.estado_acreditacion(${ACRED_POR_VENCER}, '2026-10-25') = 'vencida_renovable';
     ASSERT NOT apd.acreditacion_vigente(${ACRED_POR_VENCER}, '2026-10-25'); END $$;`],
  ['Se renueva hasta un año después del vencimiento, inclusive', 'ok', null, `DO $$ BEGIN
     ASSERT apd.estado_acreditacion(${ACRED_POR_VENCER}, '2027-10-24') = 'vencida_renovable';
     ASSERT apd.estado_acreditacion(${ACRED_POR_VENCER}, '2027-10-25') = 'vencida_no_renovable'; END $$;`],
  ['La verificación pública dice «No vigente» al día siguiente del vencimiento', 'ok', '2026-10-25 09:00', `DO $$ BEGIN
     ASSERT (SELECT situacion FROM apd.verificacion_publica WHERE numero = 'PD-2025-K101') = 'No vigente'; END $$;`],
  ['La verificación pública no expone CURP ni contacto', 'ok', null, `DO $$ BEGIN
     ASSERT (SELECT array_agg(column_name::text ORDER BY ordinal_position) FROM information_schema.columns
              WHERE table_schema = 'apd' AND table_name = 'verificacion_publica')
            = ARRAY['numero', 'nombre', 'tipo', 'emitida_en', 'vence_en', 'situacion', 'cancelada_el']; END $$;`],
  ['El dictaminador sigue vigente hasta su fecha aunque su poda haya vencido (R43)', 'ok', null, `DO $$ BEGIN
     ASSERT apd.acreditacion_vigente(${DICT_SIN_PODA});
     ASSERT (SELECT situacion FROM apd.verificacion_publica WHERE numero = 'DT-2026-K107') = 'Vigente'; END $$;`],

  // ── Elegibilidad al tramitar ──
  ['Renovar antes de la ventana se rechaza', { codigo: 'renovacion_anticipada' }, '2026-10-14 10:00', `
     INSERT INTO apd.solicitud (solicitante_id, tipo_acreditacion, modalidad, acreditacion_anterior_id)
     VALUES (${PERSONA_VIGENTE}, 'poda', 'renovacion', (SELECT id FROM apd.acreditacion WHERE numero = 'PD-2025-K100'));`],
  ['La misma renovación se acepta desde el primer día de la ventana', 'ok', '2026-10-20 10:00', `
     INSERT INTO apd.solicitud (solicitante_id, tipo_acreditacion, modalidad, acreditacion_anterior_id)
     VALUES (${PERSONA_VIGENTE}, 'poda', 'renovacion', (SELECT id FROM apd.acreditacion WHERE numero = 'PD-2025-K100'));`],
  ['Primera renovación de quien viene de Kobo: sin todos los documentos no se envía (decisión 2026-10-18)', { codigo: 'faltan_documentos_kobo' }, '2026-10-20 10:00', `
     INSERT INTO apd.solicitud (solicitante_id, tipo_acreditacion, modalidad, acreditacion_anterior_id, nivel_estudios)
     VALUES (${PERSONA_VIGENTE}, 'poda', 'renovacion', (SELECT id FROM apd.acreditacion WHERE numero = 'PD-2025-K100'), 'preparatoria');
     CREATE TEMP TABLE s AS SELECT id FROM apd.solicitud
      WHERE acreditacion_anterior_id = (SELECT id FROM apd.acreditacion WHERE numero = 'PD-2025-K100') AND estado = 'borrador';
     ${DOC_PEQUENO('(SELECT id FROM s)', 'constancia_situacion_fiscal')}
     UPDATE apd.solicitud SET estado = 'enviada' WHERE id = (SELECT id FROM s);`],
  ['Renovar una vencida hace más de un año se rechaza: va como nueva', { codigo: 'renovacion_vencida' }, null, `
     INSERT INTO apd.solicitud (solicitante_id, tipo_acreditacion, modalidad, acreditacion_anterior_id)
     VALUES (${PERSONA_NO_RENOVABLE}, 'poda', 'renovacion', ${ACRED_NO_RENOVABLE});`],
  ['Pedir una nueva teniendo una vigente se rechaza: debe renovar', { codigo: 'debe_renovar' }, null, `
     INSERT INTO apd.solicitud (solicitante_id, tipo_acreditacion, modalidad) VALUES (${PERSONA_VIGENTE}, 'poda', 'nueva');`],
  ['Dictaminador sin poda vigente se rechaza', { codigo: 'sin_poda_vigente' }, null, `
     INSERT INTO apd.solicitud (solicitante_id, tipo_acreditacion, modalidad, nivel_estudios, carrera, estatus_estudios, anios_experiencia)
     VALUES (${PERSONA_NO_RENOVABLE}, 'dictaminador', 'nueva', 'licenciatura', 'Biología', 'titulado', 3);`],
  // Con su código y su mensaje (bloque 2 de la auditoría «intentar romperlo», F1 3); el índice único queda como última defensa
  ['Una persona no tiene dos solicitudes activas del mismo tipo', { codigo: 'solicitud_activa' }, null, `
     INSERT INTO apd.solicitud (solicitante_id, tipo_acreditacion, modalidad)
     SELECT solicitante_id, 'poda', 'nueva' FROM apd.solicitud WHERE id = ${BORRADOR};`],
  ['No se envía con documentos faltantes', { codigo: 'faltan_documentos' }, null, `
     INSERT INTO apd.solicitante (id, curp, nombre, primer_apellido, correo, telefono, adscripcion, contrasena_hash, es_ficticio)
     VALUES ('00000000-0000-4000-a000-000000000001', 'XAXX991231HNEXXX09', 'Caso', 'Prueba', 'caso@ejemplo.local', '0000000099', 'independiente', 'x', true);
     INSERT INTO apd.solicitud (id, solicitante_id, tipo_acreditacion, modalidad, nivel_estudios)
     VALUES ('00000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000001', 'poda', 'nueva', 'preparatoria');
     UPDATE apd.solicitud SET estado = 'enviada' WHERE id = '00000000-0000-4000-a000-000000000002';`],
  ['Sin factura no se concluye el cotejo ni se asigna curso', { codigo: 'sin_factura' }, null, `
     UPDATE apd.solicitud SET estado = 'lista_para_curso' WHERE id = (SELECT id FROM apd.solicitud WHERE estado = 'validada_en_linea' ORDER BY folio LIMIT 1);`],
  ['La persona solicitante no carga la factura: la carga el personal', { codigo: 'carga_de_personal' }, null, `
     SELECT set_config('apd.usuario_tipo', 'solicitante', true);
     ${DOC_PEQUENO("(SELECT id FROM apd.solicitud WHERE estado = 'validada_en_linea' ORDER BY folio LIMIT 1)", 'factura_pago')}`],
  ['Sólo se aceptan los formatos del requisito (PDF, JPG o PNG)', { codigo: 'formato_no_admitido' }, null, `
     INSERT INTO apd.documento (solicitud_id, requisito, archivo_clave, nombre_original, tipo_mime, tamano_bytes, sha256)
     VALUES ((SELECT id FROM apd.solicitud WHERE estado = 'validada_en_linea' ORDER BY folio LIMIT 1), 'factura_pago', 'prueba/x', 'x.xml', 'application/xml', 1000, repeat('a', 64));`],
  ['Sin RFC, razón social y folio fiscal no se concluye el cotejo', { codigo: 'sin_datos_factura' }, null, `
     ${DOC_PEQUENO("(SELECT id FROM apd.solicitud WHERE estado = 'validada_en_linea' ORDER BY folio LIMIT 1)", 'factura_pago')}
     UPDATE apd.solicitud SET estado = 'lista_para_curso' WHERE id = (SELECT id FROM apd.solicitud WHERE estado = 'validada_en_linea' ORDER BY folio LIMIT 1);`],
  ['La persona solicitante no captura los datos de la factura', { codigo: 'factura_fuera_de_turno' }, null, `
     SELECT set_config('apd.usuario_tipo', 'solicitante', true);
     UPDATE apd.solicitud SET factura_rfc = 'XAXX010101000' WHERE id = (SELECT id FROM apd.solicitud WHERE estado = 'validada_en_linea' ORDER BY folio LIMIT 1);`],
  ['Un folio fiscal no se repite en dos solicitudes', { codigo: 'folio_fiscal_repetido' }, null, `
     UPDATE apd.solicitud SET factura_folio_fiscal = (SELECT factura_folio_fiscal FROM apd.solicitud WHERE factura_folio_fiscal IS NOT NULL LIMIT 1)
      WHERE id = (SELECT id FROM apd.solicitud WHERE estado = 'validada_en_linea' ORDER BY folio LIMIT 1);`],
  ['Nombre y apellidos se guardan en mayúsculas, con acentos y Ñ', 'ok', null, `
     INSERT INTO apd.solicitante (id, curp, nombre, primer_apellido, segundo_apellido, correo, telefono, adscripcion, contrasena_hash, es_ficticio)
     VALUES ('00000000-0000-4000-a000-000000000021', 'XAXX991231HNEXXX09', '  maría   josé ', 'peña', 'güemes', 'Caso@Ejemplo.local', '0000000099', 'independiente', 'x', true);
     DO $$ BEGIN ASSERT (SELECT (nombre, primer_apellido, segundo_apellido, correo) = ('MARÍA JOSÉ', 'PEÑA', 'GÜEMES', 'caso@ejemplo.local')
                          FROM apd.solicitante WHERE id = '00000000-0000-4000-a000-000000000021'); END $$;
     UPDATE apd.solicitante SET segundo_apellido = '' WHERE id = '00000000-0000-4000-a000-000000000021';
     DO $$ BEGIN ASSERT (SELECT segundo_apellido IS NULL FROM apd.solicitante WHERE id = '00000000-0000-4000-a000-000000000021'); END $$;`],
  ['Cada archivo se guarda como TIPO DE DOCUMENTO_NOMBRE COMPLETO, sin acentos y con Ñ', 'ok', null, `
     INSERT INTO apd.solicitante (id, curp, nombre, primer_apellido, segundo_apellido, correo, telefono, adscripcion, contrasena_hash, es_ficticio)
     VALUES ('00000000-0000-4000-a000-000000000031', 'XAXX991231HNEXXX09', 'maría josé', 'peña', 'güemes', 'caso@ejemplo.local', '0000000099', 'independiente', 'x', true);
     INSERT INTO apd.solicitud (id, solicitante_id, tipo_acreditacion, modalidad, nivel_estudios)
     VALUES ('00000000-0000-4000-a000-000000000032', '00000000-0000-4000-a000-000000000031', 'poda', 'nueva', 'preparatoria');
     INSERT INTO apd.documento (solicitud_id, requisito, archivo_clave, nombre_original, tipo_mime, tamano_bytes, sha256)
     VALUES ('00000000-0000-4000-a000-000000000032', 'curp', 'prueba/curp', 'escaneo 0042 final.PDF', 'application/pdf', 1000, repeat('a', 64)),
            ('00000000-0000-4000-a000-000000000032', 'identificacion_oficial', 'prueba/ine', 'INE escaneada.pdf', 'application/pdf', 1000, repeat('a', 64));
     ${FOTO("'00000000-0000-4000-a000-000000000031'", 'image/png')}
     DO $$ BEGIN
       ASSERT (SELECT nombre_archivo FROM apd.documento WHERE archivo_clave = 'prueba/curp') = 'CURP_MARIA JOSE PEÑA GUEMES.pdf';
       ASSERT (SELECT nombre_archivo FROM apd.documento WHERE archivo_clave = 'prueba/ine') = 'IDENTIFICACION OFICIAL_MARIA JOSE PEÑA GUEMES.pdf';
       ASSERT (SELECT nombre_original FROM apd.documento WHERE archivo_clave = 'prueba/curp') = 'escaneo 0042 final.PDF';
       ASSERT (SELECT nombre_archivo FROM apd.fotografia WHERE solicitante_id = '00000000-0000-4000-a000-000000000031') = 'FOTOGRAFIA_MARIA JOSE PEÑA GUEMES.png';
     END $$;`],
  ['Los documentos que carga la persona sólo se aceptan en PDF', { codigo: 'formato_no_admitido' }, null, `
     INSERT INTO apd.documento (solicitud_id, requisito, archivo_clave, nombre_original, tipo_mime, tamano_bytes, sha256)
     VALUES (${BORRADOR}, 'curp', 'prueba/foto-curp', 'curp.jpg', 'image/jpeg', 1000, repeat('a', 64));`],
  ['La CURP trae el enlace oficial para obtenerla', 'ok', null, `DO $$ BEGIN
     ASSERT (SELECT enlace = 'https://www.gob.mx/curp/' FROM apd.requisito WHERE clave = 'curp'); END $$;`],
  ['El nombre con que se guardó un archivo no se cambia', { sqlstate: '42501' }, null, `
     UPDATE apd.documento SET nombre_archivo = 'otro.pdf' WHERE solicitud_id = ${BORRADOR};`],
  // ── Fotografía de frente de la persona (decisión 2026-10-14) ──
  ['Sin fotografía de frente no se envía la solicitud', { codigo: 'sin_fotografia' }, null, `${SIN_FOTO}
     SELECT set_config('apd.usuario_tipo', 'solicitante', true);
     UPDATE apd.solicitud SET estado = 'enviada' WHERE id = '00000000-0000-4000-a000-000000000012';`],
  ['Con su fotografía la solicitud se envía y la foto queda por confirmar', 'ok', null, `${SIN_FOTO}
     SELECT set_config('apd.usuario_tipo', 'solicitante', true);
     ${FOTO("'00000000-0000-4000-a000-000000000011'")}
     UPDATE apd.solicitud SET estado = 'enviada' WHERE id = '00000000-0000-4000-a000-000000000012';
     DO $$ BEGIN ASSERT (SELECT origen = 'en_linea' AND estado = 'pendiente' AND confirmada_por IS NULL FROM apd.fotografia
                          WHERE solicitante_id = '00000000-0000-4000-a000-000000000011' AND vigente); END $$;`],
  ['La fotografía sólo se admite como imagen', { sqlstate: '23514' }, null, FOTO(COTEJO_PERSONA, 'application/pdf')],
  ['Mientras nadie la confirma, la persona cambia su foto y la anterior queda guardada', 'ok', null, `
     SELECT set_config('apd.usuario_tipo', 'solicitante', true);
     ${FOTO(COTEJO_PERSONA)}
     DO $$ BEGIN
       ASSERT (SELECT count(*) FROM apd.fotografia WHERE solicitante_id = ${COTEJO_PERSONA} AND vigente) = 1;
       ASSERT (SELECT count(*) FROM apd.fotografia WHERE solicitante_id = ${COTEJO_PERSONA} AND NOT vigente) >= 1;
     END $$;`],
  ['La persona no confirma su propia fotografía', { codigo: 'foto_de_personal' }, null, `
     SELECT set_config('apd.usuario_tipo', 'solicitante', true);
     UPDATE apd.fotografia SET estado = 'confirmada' WHERE solicitante_id = ${COTEJO_PERSONA} AND vigente;`],
  ['Una fotografía no se cambia: se carga otra', { sqlstate: '42501' }, null, `
     UPDATE apd.fotografia SET archivo_clave = 'otra' WHERE solicitante_id = ${COTEJO_PERSONA} AND vigente;`],
  ['Sin fotografía confirmada no se concluye el cotejo', { codigo: 'foto_sin_confirmar' }, null, `
     ${DOC_PEQUENO("(SELECT id FROM apd.solicitud WHERE estado = 'validada_en_linea' ORDER BY folio LIMIT 1)", 'factura_pago')}
     UPDATE apd.solicitud SET factura_rfc = 'XAXX010101000', factura_razon_social = 'Persona de prueba',
       factura_folio_fiscal = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', estado = 'lista_para_curso'
      WHERE id = (SELECT id FROM apd.solicitud WHERE estado = 'validada_en_linea' ORDER BY folio LIMIT 1);`],
  ['Confirmada en el cotejo, la persona ya no cambia su foto', { codigo: 'foto_confirmada' }, null, `
     UPDATE apd.fotografia SET estado = 'confirmada' WHERE solicitante_id = ${COTEJO_PERSONA} AND vigente;
     DO $$ BEGIN ASSERT (SELECT confirmada_por = 'prueba.automatica' AND confirmada_en IS NOT NULL FROM apd.fotografia
                          WHERE solicitante_id = ${COTEJO_PERSONA} AND vigente); END $$;
     SELECT set_config('apd.usuario_tipo', 'solicitante', true);
     ${FOTO(COTEJO_PERSONA)}`],
  ['Con factura, sus datos y la foto tomada en el cotejo entra a la bandeja y la persona recibe su expediente consecutivo', 'ok', DIA_CITA, `
     ${DOC_PEQUENO("(SELECT id FROM apd.solicitud WHERE estado = 'validada_en_linea' ORDER BY folio LIMIT 1)", 'factura_pago')}
     ${FOTO(COTEJO_PERSONA)}
     DO $$ BEGIN ASSERT (SELECT origen = 'cotejo' AND estado = 'confirmada' FROM apd.fotografia
                          WHERE solicitante_id = ${COTEJO_PERSONA} AND vigente); END $$;
     CREATE TEMP TABLE s AS SELECT id, solicitante_id FROM apd.solicitud WHERE estado = 'validada_en_linea' ORDER BY folio LIMIT 1;
     DO $$ BEGIN ASSERT (SELECT numero_expediente IS NULL FROM apd.solicitante WHERE id = (SELECT solicitante_id FROM s)); END $$;
     UPDATE apd.cita SET resultado = 'atendida' WHERE solicitud_id = (SELECT id FROM s) AND resultado = 'pendiente';
     UPDATE apd.solicitud SET factura_rfc = 'xaxx010101000', factura_razon_social = 'Persona de prueba',
       factura_folio_fiscal = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', estado = 'lista_para_curso' WHERE id = (SELECT id FROM s);
     DO $$ BEGIN
       ASSERT (SELECT numero_expediente FROM apd.solicitante WHERE id = (SELECT solicitante_id FROM s))
            = (SELECT 'EXP-2026-' || lpad((count(*))::text, 4, '0') FROM apd.solicitante WHERE numero_expediente IS NOT NULL);
       ASSERT (SELECT factura_rfc = 'XAXX010101000' AND factura_folio_fiscal = 'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE' FROM apd.solicitud WHERE id = (SELECT id FROM s));
       ASSERT (SELECT cargado_por = 'prueba.automatica' AND estado = 'aceptado' FROM apd.documento
                WHERE solicitud_id = (SELECT id FROM s) AND requisito = 'factura_pago' AND vigente);
     END $$;`],
  // ── Un correo, una cuenta (decisión 2026-10-17) ──
  ['Una cuenta nueva con el correo de otra cuenta activa se rechaza', { codigo: 'correo_registrado' }, null, `
     INSERT INTO apd.solicitante (curp, nombre, primer_apellido, correo, telefono, adscripcion, contrasena_hash, es_ficticio)
     VALUES ('XAXX991231HNEXXX09', 'Caso', 'Prueba', (SELECT correo FROM apd.solicitante WHERE estado = 'activa' ORDER BY curp LIMIT 1),
             '0000000099', 'independiente', 'x', true);`],
  ['El correo se compara sin importar mayúsculas', { codigo: 'correo_registrado' }, null, `
     INSERT INTO apd.solicitante (curp, nombre, primer_apellido, correo, telefono, adscripcion, contrasena_hash, es_ficticio)
     VALUES ('XAXX991231HNEXXX09', 'Caso', 'Prueba', upper((SELECT correo FROM apd.solicitante WHERE estado = 'activa' ORDER BY curp LIMIT 1)),
             '0000000099', 'independiente', 'x', true);`],
  ['Cambiar el correo al de otra cuenta activa se rechaza', { codigo: 'correo_registrado' }, null, `
     UPDATE apd.solicitante SET correo = (SELECT correo FROM apd.solicitante WHERE estado = 'activa' ORDER BY curp LIMIT 1)
      WHERE id = (SELECT id FROM apd.solicitante WHERE estado = 'activa' ORDER BY curp OFFSET 1 LIMIT 1);`],
  ['Activar una cuenta del registro anterior con el correo de otra cuenta activa se rechaza', { codigo: 'correo_registrado' }, null, `
     UPDATE apd.solicitante SET estado = 'activa', contrasena_hash = 'x',
            correo = (SELECT correo FROM apd.solicitante WHERE estado = 'activa' ORDER BY curp LIMIT 1)
      WHERE id = (SELECT id FROM apd.solicitante WHERE estado = 'sin_activar' ORDER BY curp LIMIT 1);`],
  ['Dos personas del registro anterior sin activar pueden compartir correo', 'ok', null, `
     UPDATE apd.solicitante SET correo = (SELECT correo FROM apd.solicitante WHERE estado = 'sin_activar' ORDER BY curp LIMIT 1)
      WHERE id = (SELECT id FROM apd.solicitante WHERE estado = 'sin_activar' ORDER BY curp OFFSET 1 LIMIT 1);`],
  // ── Citas de cotejo (decisiones 2026-10-17) ──
  ['Al validar, la base crea la cita pendiente en la fecha asignada', 'ok', null, `DO $$ BEGIN
     ASSERT (SELECT count(*) FROM apd.solicitud s WHERE s.estado = 'validada_en_linea'
              AND NOT EXISTS (SELECT 1 FROM apd.cita c WHERE c.solicitud_id = s.id AND c.resultado IN ('pendiente', 'en_pausa') AND c.programada_en = s.cita_en)) = 0; END $$;`],
  ['Primera inasistencia: se le da una cita nueva', 'ok', DIA_CITA, `
     ${NO_SE_PRESENTO}
     UPDATE apd.solicitud SET cita_en = '2026-10-28 10:00-06' WHERE id = ${CITA_SOL};
     DO $$ BEGIN
       ASSERT (SELECT estado FROM apd.solicitud WHERE id = ${CITA_SOL}) = 'validada_en_linea';
       ASSERT (SELECT count(*) FROM apd.cita WHERE solicitud_id = ${CITA_SOL} AND resultado = 'pendiente' AND programada_en = '2026-10-28 10:00-06') = 1;
     END $$;`],
  ['Segunda inasistencia: la solicitud se cierra como concluida sin atender', 'ok', DIA_CITA, `
     CREATE TEMP TABLE s AS SELECT ${CITA_SOL} AS id;
     ${NO_SE_PRESENTO}
     UPDATE apd.solicitud SET cita_en = '2026-10-28 10:00-06' WHERE id = (SELECT id FROM s);
     SELECT set_config('apd.ahora_simulado', '2026-10-28 18:00:00-06', true);
     UPDATE apd.cita SET resultado = 'no_se_presento' WHERE solicitud_id = (SELECT id FROM s) AND resultado = 'pendiente';
     DO $$ BEGIN ASSERT (SELECT estado = 'concluida_sin_atender' AND motivo_cierre LIKE 'No se presentó a su cita de cotejo 2 veces%' FROM apd.solicitud WHERE id = (SELECT id FROM s)); END $$;`],
  ['Con la cita abierta no se cambia la cita', { codigo: 'cita_abierta' }, null, `
     UPDATE apd.solicitud SET cita_en = '2026-10-28 10:00-06' WHERE id = ${CITA_SOL};`],
  ['La persona no cambia su cita', { codigo: 'cita_de_personal' }, DIA_CITA, `
     ${NO_SE_PRESENTO}
     SELECT set_config('apd.usuario_tipo', 'solicitante', true);
     UPDATE apd.solicitud SET cita_en = '2026-10-28 10:00-06' WHERE id = ${CITA_SOL};`],
  ['Sin pago: otra cita, con el mismo monto', 'ok', DIA_CITA, `
     CREATE TEMP TABLE s AS SELECT id, pago_monto, pago_referencia FROM apd.solicitud WHERE id = ${CITA_SOL};
     UPDATE apd.cita SET resultado = 'sin_pago' WHERE solicitud_id = (SELECT id FROM s) AND resultado = 'pendiente';
     UPDATE apd.solicitud SET cita_en = '2026-10-28 10:00-06' WHERE id = (SELECT id FROM s);
     DO $$ BEGIN ASSERT (SELECT x.pago_monto IS NOT DISTINCT FROM s.pago_monto AND x.pago_referencia = s.pago_referencia
                          FROM apd.solicitud x JOIN s ON s.id = x.id); END $$;`],
  ['La persona no registra lo que pasó en su cita', { codigo: 'cita_de_personal' }, null, `
     SELECT set_config('apd.usuario_tipo', 'solicitante', true);
     UPDATE apd.cita SET resultado = 'atendida' WHERE solicitud_id = ${CITA_SOL} AND resultado = 'pendiente';`],
  ['Pausar sin marcar qué documento no coincide se rechaza', { codigo: 'cotejo_sin_documento' }, DIA_CITA, `
     UPDATE apd.cita SET resultado = 'en_pausa', observacion = 'La CURP no coincide.' WHERE solicitud_id = ${CITA_SOL} AND resultado = 'pendiente';`],
  ['En pausa, la persona carga el mismo día el documento que no coincidió y el cotejo se retoma', 'ok', '2026-10-20 10:30', `
     CREATE TEMP TABLE s AS SELECT ${CITA_SOL} AS id;
     ${PAUSA_CURP}
     SELECT set_config('apd.usuario_tipo', 'solicitante', true);
     ${DOC_PEQUENO('(SELECT id FROM s)', 'curp')}
     SELECT set_config('apd.usuario_tipo', 'personal', true);
     UPDATE apd.documento SET estado = 'aceptado', revisado_por = 'prueba.automatica' WHERE solicitud_id = (SELECT id FROM s) AND requisito = 'curp' AND vigente;
     UPDATE apd.cita SET resultado = 'atendida' WHERE solicitud_id = (SELECT id FROM s) AND resultado = 'en_pausa';
     DO $$ BEGIN ASSERT (SELECT count(*) FROM apd.documento WHERE solicitud_id = (SELECT id FROM s) AND requisito = 'curp') = 2;
                  ASSERT (SELECT atendida_por = 'prueba.automatica' AND pausada_en IS NOT NULL FROM apd.cita WHERE solicitud_id = (SELECT id FROM s) AND resultado = 'atendida'); END $$;`],
  ['En pausa, sólo se carga el documento que no coincidió', { codigo: 'carga_fuera_de_turno' }, '2026-10-20 10:30', `
     ${PAUSA_CURP}
     SELECT set_config('apd.usuario_tipo', 'solicitante', true);
     ${DOC_PEQUENO(CITA_SOL, 'identificacion_oficial')}`],
  ['La pausa no se retoma al día siguiente', { codigo: 'pausa_vencida' }, '2026-10-20 10:30', `
     ${PAUSA_CURP}
     SELECT set_config('apd.ahora_simulado', '2026-10-21 10:00:00-06', true);
     UPDATE apd.cita SET resultado = 'atendida' WHERE solicitud_id = ${CITA_SOL} AND resultado = 'en_pausa';`],
  ['Una pausa que no se retomó el día de la cita regresa con observaciones', 'ok', '2026-10-20 10:30', `
     CREATE TEMP TABLE s AS SELECT ${CITA_SOL} AS id;
     ${PAUSA_CURP}
     SELECT set_config('apd.ahora_simulado', '2026-10-21 08:00:00-06', true);
     -- también cierra la pausa vencida de los casos de prueba («pausa-vencida»)
     DO $$ BEGIN ASSERT apd.cerrar_pausas_vencidas() >= 1;
                  ASSERT (SELECT estado FROM apd.solicitud WHERE id = (SELECT id FROM s)) = 'con_observaciones'; END $$;`],
  ['Un documento que no coincide y no se trae hoy regresa con observaciones', 'ok', DIA_CITA, `
     CREATE TEMP TABLE s AS SELECT ${CITA_SOL} AS id;
     UPDATE apd.documento SET estado = 'con_observacion', observacion = 'El original tiene otra fecha.', revisado_por = 'prueba.automatica'
      WHERE solicitud_id = (SELECT id FROM s) AND requisito = 'curp' AND vigente;
     UPDATE apd.cita SET resultado = 'con_observaciones', observacion = 'CURP: el original tiene otra fecha.' WHERE solicitud_id = (SELECT id FROM s) AND resultado = 'pendiente';
     DO $$ BEGIN ASSERT (SELECT estado FROM apd.solicitud WHERE id = (SELECT id FROM s)) = 'con_observaciones'; END $$;`],
  ['No era la persona: no se atiende y la cuenta queda bloqueada', 'ok', DIA_CITA, `
     CREATE TEMP TABLE s AS SELECT id, solicitante_id FROM apd.solicitud WHERE id = ${CITA_SOL};
     UPDATE apd.cita SET resultado = 'no_es_la_persona', observacion = 'La identificación es de otra persona.' WHERE solicitud_id = (SELECT id FROM s) AND resultado = 'pendiente';
     DO $$ BEGIN ASSERT (SELECT estado = 'bloqueada' AND bloqueo_motivo = 'identidad' FROM apd.solicitante WHERE id = (SELECT solicitante_id FROM s)); END $$;`],
  ['No era la persona: sin lo que observó se rechaza', { sqlstate: '23514' }, DIA_CITA, `
     UPDATE apd.cita SET resultado = 'no_es_la_persona' WHERE solicitud_id = ${CITA_SOL} AND resultado = 'pendiente';`],
  ['La persona no se desbloquea a sí misma', { codigo: 'bloqueo_de_personal' }, DIA_CITA, `
     UPDATE apd.cita SET resultado = 'no_es_la_persona', observacion = 'La identificación es de otra persona.' WHERE solicitud_id = ${CITA_SOL} AND resultado = 'pendiente';
     SELECT set_config('apd.usuario_tipo', 'solicitante', true);
     UPDATE apd.solicitante SET bloqueo_motivo = NULL, estado = 'activa' WHERE id = (SELECT solicitante_id FROM apd.solicitud WHERE id = ${CITA_SOL});`],
  ['Bloqueada por identidad, la cuenta no se reactiva sin quitar el bloqueo', { codigo: 'bloqueo_por_identidad' }, DIA_CITA, `
     UPDATE apd.cita SET resultado = 'no_es_la_persona', observacion = 'La identificación es de otra persona.' WHERE solicitud_id = ${CITA_SOL} AND resultado = 'pendiente';
     UPDATE apd.solicitante SET estado = 'activa' WHERE id = (SELECT solicitante_id FROM apd.solicitud WHERE id = ${CITA_SOL});`],
  ['Una cita cerrada no se reabre', { codigo: 'cita_cerrada' }, DIA_CITA, `
     ${NO_SE_PRESENTO}
     UPDATE apd.cita SET resultado = 'atendida' WHERE solicitud_id = ${CITA_SOL} AND resultado = 'no_se_presento';`],
  ['Sin la cita atendida no se concluye el cotejo', { codigo: 'cotejo_sin_cita' }, null, `
     CREATE TEMP TABLE s AS SELECT id, solicitante_id FROM apd.solicitud WHERE id = ${CITA_SOL};
     ${DOC_PEQUENO('(SELECT id FROM s)', 'factura_pago')}
     UPDATE apd.fotografia SET estado = 'confirmada' WHERE solicitante_id = (SELECT solicitante_id FROM s) AND vigente AND estado = 'pendiente';
     UPDATE apd.solicitud SET factura_rfc = 'XAXX010101000', factura_razon_social = 'Persona de prueba',
       factura_folio_fiscal = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', estado = 'lista_para_curso' WHERE id = (SELECT id FROM s);`],
  ['La cuenta no borra citas', { sqlstate: '42501' }, null, `DELETE FROM apd.cita;`],
  ['La cuenta no cambia la fecha de una cita: se asigna otra', { sqlstate: '42501' }, null, `UPDATE apd.cita SET programada_en = now();`],
  // Como administración: la cuenta del servicio ya no llama asignar_expediente (decisión 6, 2026-10-19); lo abre la regla del cotejo
  // Su segundo trámite es la renovación de su poda (la de dictaminador ya no: pide 2 años de poda, sesión del 23/10/2026)
  ['Un segundo trámite de la misma persona usa su mismo expediente', 'ok', '2027-09-01 10:00', `
     CREATE TEMP TABLE p AS SELECT s.solicitante_id, pe.numero_expediente, a.id AS acreditacion
       FROM apd.solicitud s JOIN apd.solicitante pe ON pe.id = s.solicitante_id JOIN apd.acreditacion a ON a.solicitud_id = s.id
      WHERE s.estado = 'acreditada' AND s.tipo_acreditacion = 'poda'
      ORDER BY s.folio LIMIT 1;
     CREATE TEMP TABLE c AS SELECT count(*) AS n FROM apd.solicitante WHERE numero_expediente IS NOT NULL;
     INSERT INTO apd.solicitud (id, solicitante_id, tipo_acreditacion, modalidad, acreditacion_anterior_id, nivel_estudios)
     VALUES ('00000000-0000-4000-a000-000000000009', (SELECT solicitante_id FROM p), 'poda', 'renovacion', (SELECT acreditacion FROM p), 'preparatoria');
     SELECT apd.asignar_expediente((SELECT solicitante_id FROM p));
     DO $$ BEGIN
       ASSERT (SELECT numero_expediente FROM apd.solicitante WHERE id = (SELECT solicitante_id FROM p)) = (SELECT numero_expediente FROM p);
       ASSERT (SELECT count(*) FROM apd.solicitante WHERE numero_expediente IS NOT NULL) = (SELECT n FROM c);
     END $$;`, 'admin'],
  ['El número de expediente no se cambia', { sqlstate: '42501' }, null, `
     UPDATE apd.solicitante SET numero_expediente = 'X' WHERE numero_expediente IS NOT NULL;`],
  ['Al validar con cita, la solicitud recibe su referencia de pago', 'ok', null, `DO $$ BEGIN
     ASSERT NOT EXISTS (SELECT 1 FROM apd.solicitud WHERE estado = 'validada_en_linea' AND pago_referencia IS NULL);
     ASSERT (SELECT bool_and(pago_referencia = replace(folio, '-', '')) FROM apd.solicitud WHERE pago_referencia IS NOT NULL);
     ASSERT NOT EXISTS (SELECT 1 FROM apd.solicitud WHERE estado IN ('borrador', 'enviada') AND pago_referencia IS NOT NULL); END $$;`],
  ['Cada curso tiene su propio costo', 'ok', null, `DO $$ BEGIN
     ASSERT (SELECT count(DISTINCT pago_monto) FROM apd.curso) = 4; END $$;`],
  ['El personal actualiza el costo con la publicación que lo fija, y queda en la bitácora', 'ok', null, `
     SELECT set_config('apd.usuario_tipo', 'personal', true);
     UPDATE apd.curso SET pago_monto = 2000, pago_vigente_desde = apd.hoy(), pago_fundamento = 'Gaceta de prueba'
      WHERE tipo_acreditacion = 'dictaminador' AND modalidad = 'nueva';
     DO $$ BEGIN ASSERT EXISTS (SELECT 1 FROM apd.bitacora WHERE accion = 'cambio_monto' AND detalle LIKE '%→ 2000.00%Gaceta de prueba%'); END $$;`],
  ['Un costo sin la publicación que lo fija se rechaza', { sqlstate: '23514' }, null, `
     SELECT set_config('apd.usuario_tipo', 'personal', true);
     UPDATE apd.curso SET pago_monto = 2000, pago_fundamento = '' WHERE tipo_acreditacion = 'poda' AND modalidad = 'nueva';`],
  ['La persona solicitante no cambia el costo', { codigo: 'monto_de_personal' }, null, `
     SELECT set_config('apd.usuario_tipo', 'solicitante', true);
     UPDATE apd.curso SET pago_monto = 1 WHERE tipo_acreditacion = 'poda' AND modalidad = 'nueva';`],
  ['Quien ya tiene cita conserva el monto que se le indicó, aunque cambie el costo', 'ok', null, `
     SELECT set_config('apd.usuario_tipo', 'personal', true);
     CREATE TEMP TABLE antes AS SELECT id, pago_monto FROM apd.solicitud WHERE pago_monto IS NOT NULL;
     UPDATE apd.curso SET pago_monto = pago_monto + 500;
     DO $$ BEGIN
       ASSERT NOT EXISTS (SELECT 1 FROM apd.solicitud s JOIN antes a ON a.id = s.id WHERE s.pago_monto <> a.pago_monto);
       ASSERT EXISTS (SELECT 1 FROM apd.solicitud s JOIN apd.curso c USING (tipo_acreditacion, modalidad)
                       WHERE s.estado = 'validada_en_linea' AND s.pago_monto <> c.pago_monto);
     END $$;`],
  ['La referencia de pago no la escribe la cuenta del servicio', { sqlstate: '42501' }, null, `
     UPDATE apd.solicitud SET pago_referencia = 'X' WHERE estado = 'validada_en_linea';`],
  ['Un salto de estado no previsto se rechaza', { codigo: 'transicion_invalida' }, null, `
     UPDATE apd.solicitud SET estado = 'aprobada' WHERE id = ${BORRADOR};`],
  ['El folio no se cambia', { sqlstate: '42501' }, null, `
     UPDATE apd.solicitud SET folio = 'X' WHERE id = ${BORRADOR};`],

  // ── Documentos ──
  ['Un archivo de más de 5 MB se rechaza', { codigo: 'archivo_grande' }, null,
     DOC_PEQUENO(BORRADOR, 'curp', 5242881)],
  ['Un archivo de 5 MB exactos se acepta', 'ok', null,
     DOC_PEQUENO(BORRADOR, 'curp', 5242880)],
  ['No se cargan documentos en una solicitud enviada', { codigo: 'carga_fuera_de_turno' }, null,
     DOC_PEQUENO(ENVIADA, 'curp')],
  ['La revisión de un documento registra quién la hizo', { codigo: 'revision_sin_responsable' }, null, `
     UPDATE apd.documento SET estado = 'aceptado' WHERE solicitud_id = ${ENVIADA} AND vigente;`],

  // ── Grupos y cupos ──
  ['Un grupo no se confirma por debajo del mínimo (4 de 5)', { codigo: 'cupo_minimo' }, null, `
     UPDATE apd.grupo SET instructor = 'i', sede = 's', fecha_inicio = '2026-11-02', hora_entrada = '09:00' WHERE id = ${GRUPO_INTEGRACION};
     UPDATE apd.grupo SET estado = 'confirmado' WHERE id = ${GRUPO_INTEGRACION};`],
  ['Un grupo nuevo copia los cupos vigentes del curso, y nunca pasa del máximo', { codigo: 'cupo_maximo' }, null, `
     UPDATE apd.curso SET cupo_minimo = 1, cupo_maximo = 2 WHERE tipo_acreditacion = 'poda' AND modalidad = 'nueva';
     INSERT INTO apd.grupo (id, tipo_acreditacion, modalidad, integracion) VALUES ('00000000-0000-4000-a000-000000000010', 'poda', 'nueva', 'combinado');
     DO $$ BEGIN ASSERT (SELECT cupo_maximo FROM apd.grupo WHERE id = '00000000-0000-4000-a000-000000000010') = 2; END $$;
     INSERT INTO apd.inscripcion (solicitud_id, grupo_id) SELECT solicitud_id, '00000000-0000-4000-a000-000000000010'
       FROM apd.bandeja_demanda WHERE tipo_acreditacion = 'poda' AND modalidad = 'nueva' ORDER BY folio LIMIT 3;`],
  ['Un grupo nuevo es en la sede única, el Vivero Nezahualcóyotl (decisión 2026-10-16)', 'ok', null, `
     INSERT INTO apd.grupo (id, tipo_acreditacion, modalidad, integracion) VALUES ('00000000-0000-4000-a000-000000000013', 'poda', 'nueva', 'combinado');
     DO $$ BEGIN ASSERT (SELECT sede FROM apd.grupo WHERE id = '00000000-0000-4000-a000-000000000013') = 'Vivero Nezahualcóyotl'; END $$;`],
  ['Los cupos de un grupo creado no cambian', { sqlstate: '42501' }, null, `
     UPDATE apd.grupo SET cupo_minimo = 1 WHERE id = ${GRUPO_INTEGRACION};`],
  ['No se inscribe a alguien de otro curso', { codigo: 'otro_curso' }, null, `
     INSERT INTO apd.inscripcion (solicitud_id, grupo_id) VALUES (${LISTA_DICT}, ${GRUPO_INTEGRACION});`],
  ['Un grupo específico sólo admite a su organización', { codigo: 'otra_organizacion' }, null, `
     INSERT INTO apd.grupo (id, tipo_acreditacion, modalidad, integracion, organizacion_id)
     VALUES ('00000000-0000-4000-a000-000000000011', 'poda', 'nueva', 'especifico', (SELECT id FROM apd.organizacion WHERE clave = 'iztapalapa'));
     INSERT INTO apd.inscripcion (solicitud_id, grupo_id)
     SELECT solicitud_id, '00000000-0000-4000-a000-000000000011' FROM apd.bandeja_demanda
      WHERE tipo_acreditacion = 'poda' AND modalidad = 'nueva' AND organizacion LIKE 'Jardines%' LIMIT 1;`],
  ['Un grupo en curso ya no recibe personas', { codigo: 'grupo_cerrado' }, null, `
     INSERT INTO apd.inscripcion (solicitud_id, grupo_id)
     SELECT solicitud_id, ${GRUPO_EN_CURSO} FROM apd.bandeja_demanda WHERE tipo_acreditacion = 'poda' AND modalidad = 'nueva' LIMIT 1;`],
  ['Al cancelar un grupo, las personas regresan a la bandeja con su antigüedad', 'ok', null, `
     CREATE TEMP TABLE antes AS SELECT s.id, s.lista_para_curso_en FROM apd.solicitud s
       JOIN apd.inscripcion i ON i.solicitud_id = s.id AND i.activa WHERE i.grupo_id = ${GRUPO_INTEGRACION};
     UPDATE apd.grupo SET estado = 'cancelado', motivo_cancelacion = 'Prueba' WHERE id = ${GRUPO_INTEGRACION};
     DO $$ BEGIN
       ASSERT (SELECT count(*) FROM antes) = 4;
       ASSERT NOT EXISTS (SELECT 1 FROM antes a JOIN apd.solicitud s ON s.id = a.id
                           WHERE s.estado <> 'lista_para_curso' OR s.lista_para_curso_en <> a.lista_para_curso_en);
     END $$;`],
  // Decisiones 2026-10-17 (Liber): grupos combinados con cualquier mezcla; 7 días de anticipación; agregar personas a un
  // grupo confirmado hasta el día anterior al inicio
  ['Un grupo combinado admite cualquier mezcla de organizaciones e independientes', 'ok', '2026-10-20 10:00', `
     INSERT INTO apd.inscripcion (solicitud_id, grupo_id)
     SELECT solicitud_id, ${GRUPO_INTEGRACION} FROM apd.bandeja_demanda
      WHERE tipo_acreditacion = 'poda' AND modalidad = 'nueva' AND organizacion IN ('Independiente', 'Comisión Federal de Electricidad (CFE)')
         OR (tipo_acreditacion = 'poda' AND modalidad = 'nueva' AND organizacion LIKE 'Jardines%');
     DO $$ BEGIN ASSERT (SELECT count(DISTINCT coalesce(s.organizacion_id::text, 'independiente')) FROM apd.inscripcion i
                          JOIN apd.solicitud s ON s.id = i.solicitud_id WHERE i.grupo_id = ${GRUPO_INTEGRACION} AND i.activa) >= 3; END $$;`],
  ['Un grupo no se confirma con menos de 7 días de anticipación', { codigo: 'anticipacion' }, '2026-10-20 10:00', `
     INSERT INTO apd.inscripcion (solicitud_id, grupo_id)
     SELECT solicitud_id, ${GRUPO_INTEGRACION} FROM apd.bandeja_demanda WHERE tipo_acreditacion = 'poda' AND modalidad = 'nueva' ORDER BY folio LIMIT 1;
     UPDATE apd.grupo SET instructor = 'i', fecha_inicio = '2026-10-26', hora_entrada = '09:00' WHERE id = ${GRUPO_INTEGRACION};
     UPDATE apd.grupo SET estado = 'confirmado' WHERE id = ${GRUPO_INTEGRACION};`],
  ['Con 5 personas y 7 días de anticipación el grupo se confirma, y recibe personas hasta el día anterior', 'ok', '2026-10-20 10:00', `
     CREATE TEMP TABLE g AS SELECT ${GRUPO_INTEGRACION} AS id;
     INSERT INTO apd.inscripcion (solicitud_id, grupo_id)
     SELECT solicitud_id, (SELECT id FROM g) FROM apd.bandeja_demanda WHERE tipo_acreditacion = 'poda' AND modalidad = 'nueva' ORDER BY folio LIMIT 1;
     UPDATE apd.grupo SET instructor = 'i', fecha_inicio = '2026-11-02', hora_entrada = '09:00' WHERE id = (SELECT id FROM g);
     UPDATE apd.grupo SET estado = 'confirmado' WHERE id = (SELECT id FROM g);
     SELECT set_config('apd.ahora_simulado', '2026-11-01 18:00:00-06', true);
     INSERT INTO apd.inscripcion (solicitud_id, grupo_id)
     SELECT solicitud_id, (SELECT id FROM g) FROM apd.bandeja_demanda WHERE tipo_acreditacion = 'poda' AND modalidad = 'nueva' ORDER BY folio LIMIT 1;`],
  ['El día que empieza el curso ya no se agregan personas al grupo confirmado', { codigo: 'grupo_por_iniciar' }, '2026-10-20 10:00', `
     CREATE TEMP TABLE g AS SELECT ${GRUPO_INTEGRACION} AS id;
     INSERT INTO apd.inscripcion (solicitud_id, grupo_id)
     SELECT solicitud_id, (SELECT id FROM g) FROM apd.bandeja_demanda WHERE tipo_acreditacion = 'poda' AND modalidad = 'nueva' ORDER BY folio LIMIT 1;
     UPDATE apd.grupo SET instructor = 'i', fecha_inicio = '2026-11-02', hora_entrada = '09:00' WHERE id = (SELECT id FROM g);
     UPDATE apd.grupo SET estado = 'confirmado' WHERE id = (SELECT id FROM g);
     SELECT set_config('apd.ahora_simulado', '2026-11-02 08:00:00-06', true);
     INSERT INTO apd.inscripcion (solicitud_id, grupo_id)
     SELECT solicitud_id, (SELECT id FROM g) FROM apd.bandeja_demanda WHERE tipo_acreditacion = 'poda' AND modalidad = 'nueva' ORDER BY folio LIMIT 1;`],
  ['Un grupo no se confirma sin hora de entrada (P91)', { codigo: 'datos_para_confirmar' }, '2026-10-20 10:00', `
     INSERT INTO apd.inscripcion (solicitud_id, grupo_id)
     SELECT solicitud_id, ${GRUPO_INTEGRACION} FROM apd.bandeja_demanda WHERE tipo_acreditacion = 'poda' AND modalidad = 'nueva' ORDER BY folio LIMIT 1;
     UPDATE apd.grupo SET instructor = 'i', fecha_inicio = '2026-11-02' WHERE id = ${GRUPO_INTEGRACION};
     UPDATE apd.grupo SET estado = 'confirmado' WHERE id = ${GRUPO_INTEGRACION};`],
  ['Una baja que deja al grupo confirmado por debajo del mínimo lo regresa a integración, con su fecha', 'ok', '2026-10-20 10:00', `
     CREATE TEMP TABLE g AS SELECT ${GRUPO_INTEGRACION} AS id;
     INSERT INTO apd.inscripcion (solicitud_id, grupo_id)
     SELECT solicitud_id, (SELECT id FROM g) FROM apd.bandeja_demanda WHERE tipo_acreditacion = 'poda' AND modalidad = 'nueva' ORDER BY folio LIMIT 1;
     UPDATE apd.grupo SET instructor = 'i', fecha_inicio = '2026-11-02', hora_entrada = '09:00' WHERE id = (SELECT id FROM g);
     UPDATE apd.grupo SET estado = 'confirmado' WHERE id = (SELECT id FROM g);
     UPDATE apd.inscripcion SET activa = false, motivo_baja = 'Prueba' WHERE id = (SELECT id FROM apd.inscripcion WHERE grupo_id = (SELECT id FROM g) AND activa LIMIT 1);
     DO $$ BEGIN
       ASSERT (SELECT estado FROM apd.grupo WHERE id = (SELECT id FROM g)) = 'en_integracion';
       ASSERT (SELECT fecha_inicio FROM apd.grupo WHERE id = (SELECT id FROM g)) = '2026-11-02';
     END $$;`],
  ['Cancelar un grupo exige motivo', { codigo: 'cancelacion_sin_motivo' }, null, `
     UPDATE apd.grupo SET estado = 'cancelado' WHERE id = ${GRUPO_INTEGRACION};`],

  // ── Asistencia y examen (grupo en curso desde el lunes 12/10; una persona faltó el día 1) ──
  ['No se captura asistencia de un día que no ha ocurrido', { codigo: 'dia_futuro' }, '2026-10-14 10:00', `
     INSERT INTO apd.asistencia (inscripcion_id, dia, asistio, capturada_por)
     SELECT id, 4, true, 'i' FROM apd.inscripcion WHERE grupo_id = ${GRUPO_EN_CURSO} AND activa LIMIT 1;`],
  ['Sin la asistencia mínima no hay examen', { codigo: 'sin_derecho_examen' }, '2026-10-15 19:00', `
     INSERT INTO apd.examen (inscripcion_id, presentado_en, calificacion, capturado_por)
     SELECT i.id, '2026-10-15', 9, 'i' FROM apd.inscripcion i
      WHERE i.grupo_id = ${GRUPO_EN_CURSO} AND i.activa
        AND EXISTS (SELECT 1 FROM apd.asistencia a WHERE a.inscripcion_id = i.id AND NOT a.asistio) LIMIT 1;`],
  ['Sin el pase de lista del día del examen no hay examen (P94)', { codigo: 'sin_pase_de_lista' }, '2026-10-16 20:00', `
     INSERT INTO apd.asistencia (inscripcion_id, dia, asistio, capturada_por)
     SELECT i.id, d, true, 'i' FROM apd.inscripcion i, generate_series(3, 4) d WHERE i.grupo_id = ${GRUPO_EN_CURSO} AND i.activa;
     INSERT INTO apd.examen (inscripcion_id, presentado_en, calificacion, capturado_por)
     SELECT i.id, '2026-10-16', 9, 'i' FROM apd.inscripcion i
      WHERE i.grupo_id = ${GRUPO_EN_CURSO} AND i.activa
        AND (SELECT count(*) FROM apd.asistencia a WHERE a.inscripcion_id = i.id AND a.asistio) = 4 LIMIT 1;`],
  ['El examen se presenta el último día del curso', { codigo: 'fecha_examen' }, '2026-10-16 20:00', `
     INSERT INTO apd.asistencia (inscripcion_id, dia, asistio, capturada_por)
     SELECT i.id, d, true, 'i' FROM apd.inscripcion i, generate_series(3, 5) d WHERE i.grupo_id = ${GRUPO_EN_CURSO} AND i.activa;
     INSERT INTO apd.examen (inscripcion_id, presentado_en, calificacion, capturado_por)
     SELECT i.id, '2026-10-15', 9, 'i' FROM apd.inscripcion i
      WHERE i.grupo_id = ${GRUPO_EN_CURSO} AND i.activa
        AND (SELECT count(*) FROM apd.asistencia a WHERE a.inscripcion_id = i.id AND a.asistio) = 5 LIMIT 1;`],
  ['No se concluye un grupo con calificaciones pendientes', { codigo: 'faltan_calificaciones' }, '2026-10-16 20:00', `
     INSERT INTO apd.asistencia (inscripcion_id, dia, asistio, capturada_por)
     SELECT i.id, d, true, 'i' FROM apd.inscripcion i, generate_series(3, 5) d WHERE i.grupo_id = ${GRUPO_EN_CURSO} AND i.activa;
     UPDATE apd.grupo SET estado = 'concluido' WHERE id = ${GRUPO_EN_CURSO};`],
  ['Recorrido completo: cinco días, examen, conclusión, emisión y verificación', 'ok', '2026-10-16 20:00', `
     CREATE TEMP TABLE g AS SELECT ${GRUPO_EN_CURSO} AS id; -- el grupo deja de estar «en curso» a la mitad del caso
     -- quien faltó el día 1 falta también el día 2: 3 de 5, sin derecho a examen; los demás asisten todo
     INSERT INTO apd.asistencia (inscripcion_id, dia, asistio, capturada_por)
     SELECT i.id, d, NOT (d = 3 AND EXISTS (SELECT 1 FROM apd.asistencia a WHERE a.inscripcion_id = i.id AND NOT a.asistio)), 'otro.instructor'
       FROM apd.inscripcion i, generate_series(3, 5) d WHERE i.grupo_id = (SELECT id FROM g) AND i.activa;
     INSERT INTO apd.examen (inscripcion_id, presentado_en, calificacion, capturado_por)
     SELECT i.id, '2026-10-16', 8, 'i' FROM apd.inscripcion i
      WHERE i.grupo_id = (SELECT id FROM g) AND i.activa
        AND (SELECT count(*) FROM apd.asistencia a WHERE a.inscripcion_id = i.id AND a.asistio) >= 4;
     UPDATE apd.grupo SET estado = 'concluido' WHERE id = (SELECT id FROM g);
     INSERT INTO apd.acreditacion (solicitante_id, tipo_acreditacion, solicitud_id)
     SELECT solicitante_id, 'poda', id FROM apd.solicitud WHERE estado = 'aprobada';
     DO $$ BEGIN
       ASSERT (SELECT count(*) FROM apd.solicitud s JOIN apd.inscripcion i ON i.solicitud_id = s.id
                WHERE i.grupo_id = (SELECT id FROM g) AND s.estado = 'acreditada') = 9;
       ASSERT (SELECT count(*) FROM apd.solicitud s JOIN apd.inscripcion i ON i.solicitud_id = s.id
                WHERE i.grupo_id = (SELECT id FROM g) AND s.estado = 'sin_derecho_examen') = 1;
       ASSERT (SELECT bool_and(situacion = 'Vigente' AND vence_en = '2027-10-15') FROM apd.verificacion_publica
                WHERE emitida_en = '2026-10-16');
     END $$;`],
  ['Con 7.0 se aprueba poda; con 6.9 no (R34)', 'ok', '2026-10-16 20:00', `
     CREATE TEMP TABLE g AS SELECT ${GRUPO_EN_CURSO} AS id;
     INSERT INTO apd.asistencia (inscripcion_id, dia, asistio, capturada_por)
     SELECT i.id, d, true, 'i' FROM apd.inscripcion i, generate_series(3, 5) d WHERE i.grupo_id = (SELECT id FROM g) AND i.activa;
     CREATE TEMP TABLE dos AS SELECT i.id, row_number() OVER (ORDER BY i.id) AS n FROM apd.inscripcion i
      WHERE i.grupo_id = (SELECT id FROM g) AND i.activa
        AND (SELECT count(*) FROM apd.asistencia a WHERE a.inscripcion_id = i.id AND a.asistio) = 5 LIMIT 2;
     INSERT INTO apd.examen (inscripcion_id, presentado_en, calificacion, capturado_por, origen)
     SELECT id, '2026-10-16', CASE n WHEN 1 THEN 7.0 ELSE 6.9 END, 'sistema-examen', 'examen_web' FROM dos;
     DO $$ BEGIN
       ASSERT (SELECT s.estado FROM apd.solicitud s JOIN apd.inscripcion i ON i.solicitud_id = s.id JOIN dos ON dos.id = i.id WHERE n = 1) = 'aprobada';
       ASSERT (SELECT s.estado FROM apd.solicitud s JOIN apd.inscripcion i ON i.solicitud_id = s.id JOIN dos ON dos.id = i.id WHERE n = 2) = 'no_acreditada';
     END $$;`],
  ['Una calificación registrada no se modifica (resultado inapelable)', { sqlstate: '42501' }, null, `
     UPDATE apd.examen SET calificacion = 10;`],
  ['El instructor puede cambiar durante el curso y queda en la bitácora (R26)', 'ok', null, `
     UPDATE apd.grupo SET instructor = 'instructor.suplente' WHERE id = ${GRUPO_EN_CURSO};
     DO $$ BEGIN ASSERT EXISTS (SELECT 1 FROM apd.bitacora WHERE accion = 'cambio_instructor' AND detalle LIKE '%instructor.suplente'); END $$;`],
  ['La sede no cambia con el curso iniciado', { codigo: 'grupo_cerrado' }, null, `
     UPDATE apd.grupo SET sede = 'Otra' WHERE id = ${GRUPO_EN_CURSO};`],
  ['Cupo de 5 a 25 en los cuatro cursos (R23 y R24)', 'ok', null, `DO $$ BEGIN
     ASSERT (SELECT bool_and(cupo_minimo = 5 AND cupo_maximo = 25) FROM apd.curso); END $$;`],
  ['El curso de renovación dura un día', 'ok', null, `DO $$ BEGIN
     ASSERT (SELECT bool_and(dias_duracion = 1 AND dias_minimos_asistencia = 1) FROM apd.curso WHERE modalidad = 'renovacion');
     ASSERT (SELECT bool_and(dias_duracion = 5) FROM apd.curso WHERE modalidad = 'nueva'); END $$;`],
  ['En una renovación sólo son obligatorios la constancia fiscal y el pago (R46)', 'ok', null, `DO $$ BEGIN
     ASSERT (SELECT array_agg(requisito ORDER BY requisito) FROM apd.requisito_curso rc JOIN apd.requisito r ON r.clave = rc.requisito
              WHERE modalidad = 'renovacion' AND tipo_acreditacion = 'dictaminador' AND obligatorio AND forma = 'documento'
                AND momento IN ('en_linea', 'cotejo'))
            = ARRAY['constancia_situacion_fiscal', 'factura_pago']; END $$;`],
  ['La poda vigente se exige al iniciar, no al enviar (R05)', 'ok', '2027-06-01 10:00', `
     -- La solicitud de dictaminador con observaciones se inició con poda vigente (vence el 10/05/2027).
     -- Se reenvía el 1/06/2027, con la poda ya vencida: el envío se acepta.
     CREATE TEMP TABLE s AS SELECT id FROM apd.solicitud WHERE estado = 'con_observaciones' AND tipo_acreditacion = 'dictaminador';
     DO $$ BEGIN ASSERT NOT apd.poda_vigente((SELECT solicitante_id FROM apd.solicitud WHERE id = (SELECT id FROM s))); END $$;
     ${DOC_PEQUENO('(SELECT id FROM s)', 'comprobantes_experiencia')}
     UPDATE apd.solicitud SET estado = 'enviada' WHERE id = (SELECT id FROM s);`],
  ['No se emite la acreditación de una solicitud no aprobada', { codigo: 'solicitud_no_aprobada' }, null, `
     INSERT INTO apd.acreditacion (solicitante_id, tipo_acreditacion, solicitud_id)
     SELECT solicitante_id, 'poda', id FROM apd.solicitud WHERE id = ${BORRADOR};`],
  ['Una acreditación emitida no se modifica', { sqlstate: '42501' }, null, `
     UPDATE apd.acreditacion SET vence_en = vence_en + 30 WHERE numero = 'PD-2026-0001';`],
  ['Sin la fotografía de la credencial no se registra la entrega', { codigo: 'sin_foto_credencial' }, null, `
     UPDATE apd.acreditacion SET entregada_en = apd.hoy() WHERE origen = 'sistema' AND entregada_en IS NULL AND numero LIKE 'PD-2026-%';`],
  ['La fotografía de la credencial sólo se admite como imagen', { codigo: 'formato_no_admitido' }, null,
     FOTO_DOC("(SELECT solicitud_id FROM apd.acreditacion WHERE origen = 'sistema' AND entregada_en IS NULL LIMIT 1)", 'application/pdf')],
  ['Con la foto pero sin comprobante de recepción firmado no se registra la entrega', { codigo: 'sin_acuse_entrega' }, null, `
     CREATE TEMP TABLE a AS SELECT id, solicitud_id FROM apd.acreditacion WHERE origen = 'sistema' AND entregada_en IS NULL LIMIT 1;
     ${FOTO_DOC("(SELECT solicitud_id FROM a)")}
     UPDATE apd.acreditacion SET entregada_en = apd.hoy() WHERE id = (SELECT id FROM a);`],
  ['La persona solicitante no carga el comprobante de recepción', { codigo: 'carga_de_personal' }, null, `
     SELECT set_config('apd.usuario_tipo', 'solicitante', true);
     ${DOC_PEQUENO("(SELECT solicitud_id FROM apd.acreditacion WHERE origen = 'sistema' AND entregada_en IS NULL LIMIT 1)", 'acuse_entrega')}`],
  ['Con la foto de la credencial y el comprobante firmado se registra la entrega', 'ok', null, `
     CREATE TEMP TABLE a AS SELECT id, solicitud_id FROM apd.acreditacion WHERE origen = 'sistema' AND entregada_en IS NULL LIMIT 1;
     ${FOTO_DOC("(SELECT solicitud_id FROM a)")}
     ${DOC_PEQUENO("(SELECT solicitud_id FROM a)", 'acuse_entrega')}
     UPDATE apd.acreditacion SET entregada_en = apd.hoy() WHERE id = (SELECT id FROM a);
     DO $$ BEGIN ASSERT (SELECT entregada_en IS NOT NULL FROM apd.acreditacion WHERE id = (SELECT id FROM a)); END $$;`],
  ['La entrega se registra una sola vez', { codigo: 'entrega_ya_registrada' }, null, `
     UPDATE apd.acreditacion SET entregada_en = '2026-10-01' WHERE entregada_en IS NOT NULL AND numero LIKE 'PD-2026-%';`],

  // ── Cuentas ──
  ['No hay dos cuentas con la misma CURP', { sqlstate: '23505' }, null, `
     INSERT INTO apd.solicitante (curp, nombre, primer_apellido, correo, telefono, adscripcion, contrasena_hash)
     SELECT curp, 'Otra', 'Persona', 'otra@ejemplo.local', '0000000098', 'independiente', 'x' FROM apd.solicitante LIMIT 1;`],
  ['Una CURP con formato inválido se rechaza', { sqlstate: '23514' }, null, `
     INSERT INTO apd.solicitante (curp, nombre, primer_apellido, correo, telefono, adscripcion, contrasena_hash)
     VALUES ('ABC123', 'Otra', 'Persona', 'otra@ejemplo.local', '0000000098', 'independiente', 'x');`],
  ['Una CURP con dígito verificador incorrecto se rechaza, igual que en el formulario', { sqlstate: '23514' }, null, `
     INSERT INTO apd.solicitante (curp, nombre, primer_apellido, correo, telefono, adscripcion, contrasena_hash)
     VALUES ('XAXX991231HNEXXX01', 'Otra', 'Persona', 'otra@ejemplo.local', '0000000098', 'independiente', 'x');`],
  ['La persona no corrige su propia CURP', { codigo: 'curp_sin_motivo' }, null, `
     SELECT set_config('apd.usuario_tipo', 'solicitante', true);
     UPDATE apd.solicitante SET curp = 'XAXX991230HNEXXX08' WHERE id = ${PERSONA_VIGENTE};`],
  ['La Secretaría corrige una CURP con motivo, y queda en la bitácora', 'ok', null, `
     SELECT set_config('apd.motivo', 'Error de captura comprobado con la identificación', true);
     UPDATE apd.solicitante SET curp = 'XAXX991230HNEXXX08' WHERE id = ${PERSONA_VIGENTE};
     DO $$ BEGIN ASSERT EXISTS (SELECT 1 FROM apd.bitacora WHERE accion = 'correccion_curp' AND detalle LIKE '%Error de captura%'); END $$;`],
  ['La institución es del tipo de adscripción elegido', { codigo: 'adscripcion_no_coincide' }, null, `
     UPDATE apd.solicitante SET adscripcion = 'alcaldia', organizacion_id = (SELECT id FROM apd.organizacion WHERE clave = 'cfe') WHERE id = ${PERSONA_VIGENTE};`],
  ['Quien dice estar adscrita lleva su institución; la independiente no', { sqlstate: '23514' }, null, `
     UPDATE apd.solicitante SET adscripcion = 'privada', organizacion_id = NULL WHERE id = ${PERSONA_VIGENTE};`],
  ['La persona cambia su adscripción en «Mi perfil» y queda en la bitácora', 'ok', null, `
     SELECT set_config('apd.usuario_tipo', 'solicitante', true);
     UPDATE apd.solicitante SET adscripcion = 'alcaldia', organizacion_id = (SELECT id FROM apd.organizacion WHERE clave = 'tlalpan') WHERE id = ${PERSONA_VIGENTE};
     DO $$ BEGIN ASSERT EXISTS (SELECT 1 FROM apd.bitacora WHERE accion = 'adscripcion' AND detalle LIKE '%alcaldia: Tlalpan'); END $$;`],
  // Perfil del dictaminador (decisión 2026-10-15): nivel, carrera y estatus; la base calcula perfil y experiencia mínima
  ['Licenciatura titulada en una carrera principal pide 2 años (la carrera se liga al catálogo)', 'ok', null, `
     UPDATE apd.solicitud SET nivel_estudios = 'licenciatura', estatus_estudios = 'titulado', carrera = 'biologia' WHERE id = ${DICT_OBS};
     DO $$ BEGIN ASSERT (SELECT perfil_academico = 'licenciatura_afin' AND experiencia_minima = 2
                                AND carrera_id = (SELECT id FROM apd.carrera WHERE nombre = 'Biología')
                           FROM apd.solicitud WHERE estado = 'con_observaciones' AND tipo_acreditacion = 'dictaminador' ORDER BY folio LIMIT 1); END $$;`],
  ['Con carta de pasante se piden 5 años: con menos no se envía', { codigo: 'experiencia_insuficiente' }, null, `
     UPDATE apd.solicitud SET nivel_estudios = 'licenciatura', estatus_estudios = 'concluido', carrera = 'Biología', anios_experiencia = 3 WHERE id = ${DICT_OBS};
     UPDATE apd.solicitud SET estado = 'enviada' WHERE id = ${DICT_OBS};`],
  ['Licenciatura trunca queda «no cumple», pero se envía: la revisa el personal', 'ok', null, `
     UPDATE apd.solicitud SET nivel_estudios = 'licenciatura', estatus_estudios = 'trunco', carrera = 'Biología' WHERE id = ${DICT_OBS};
     UPDATE apd.solicitud SET estado = 'enviada' WHERE id = ${DICT_OBS};
     DO $$ BEGIN ASSERT (SELECT perfil_academico = 'no_cumple' AND estado = 'enviada' FROM apd.solicitud WHERE folio =
       (SELECT folio FROM apd.solicitud WHERE tipo_acreditacion = 'dictaminador' AND perfil_academico = 'no_cumple' ORDER BY folio LIMIT 1)); END $$;`],
  ['Licenciatura no afín con maestría en un área afín pide 2 años', 'ok', null, `
     UPDATE apd.solicitud SET nivel_estudios = 'maestria', estatus_estudios = 'titulado', carrera = 'Ciencias Forestales' WHERE id = ${DICT_OBS};
     DO $$ BEGIN ASSERT (SELECT perfil_academico = 'licenciatura_afin' AND experiencia_minima = 2
                           FROM apd.solicitud WHERE estado = 'con_observaciones' AND tipo_acreditacion = 'dictaminador' ORDER BY folio LIMIT 1); END $$;`],
  ['Con preparatoria no se guardan carrera ni situación, y no cumple el perfil', 'ok', null, `
     UPDATE apd.solicitud SET nivel_estudios = 'preparatoria', estatus_estudios = 'titulado', carrera = 'Biología' WHERE id = ${DICT_OBS};
     DO $$ BEGIN ASSERT (SELECT carrera IS NULL AND estatus_estudios IS NULL AND perfil_academico = 'no_cumple' AND experiencia_minima = 5
                           FROM apd.solicitud WHERE estado = 'con_observaciones' AND tipo_acreditacion = 'dictaminador' ORDER BY folio LIMIT 1); END $$;`],
  ['Poda: se guardan nivel y carrera, sin la situación de la licenciatura (sesión del 23/10/2026) ni perfil', 'ok', null, `
     UPDATE apd.solicitud SET nivel_estudios = 'licenciatura', carrera = 'Biología', estatus_estudios = 'titulado' WHERE id = ${BORRADOR};
     DO $$ BEGIN ASSERT (SELECT nivel_estudios = 'licenciatura' AND carrera = 'Biología' AND carrera_id IS NOT NULL
                                AND estatus_estudios IS NULL AND perfil_academico IS NULL
                           FROM apd.solicitud WHERE estado = 'borrador' LIMIT 1); END $$;`],
  ['Con licenciatura, sin la situación de los estudios no se envía', { codigo: 'faltan_estudios' }, null, `
     UPDATE apd.solicitud SET nivel_estudios = 'licenciatura', carrera = 'Biología', estatus_estudios = NULL WHERE id = ${DICT_OBS};
     UPDATE apd.solicitud SET estado = 'enviada' WHERE id = ${DICT_OBS};`],
  ['Sin nivel de estudios no se envía (poda y dictaminador)', { codigo: 'faltan_estudios' }, null, `
     UPDATE apd.solicitud SET nivel_estudios = NULL WHERE id = ${DICT_OBS};
     UPDATE apd.solicitud SET estado = 'enviada' WHERE id = ${DICT_OBS};`],
  ['Con carrera técnica, sin decir cuál no se envía', { codigo: 'faltan_estudios' }, null, `
     UPDATE apd.solicitud SET nivel_estudios = 'tecnica', carrera_tecnica = '  ' WHERE id = ${DICT_OBS};
     UPDATE apd.solicitud SET estado = 'enviada' WHERE id = ${DICT_OBS};`],
  ['La carrera técnica se escribe sin catálogo y se descarta con otro nivel', 'ok', null, `
     UPDATE apd.solicitud SET nivel_estudios = 'tecnica', carrera_tecnica = 'Técnico  en jardinería' WHERE id = ${DICT_OBS};
     DO $$ BEGIN ASSERT (SELECT carrera_tecnica = 'Técnico en jardinería' AND carrera IS NULL AND carrera_id IS NULL
                           FROM apd.solicitud WHERE estado = 'con_observaciones' AND tipo_acreditacion = 'dictaminador' ORDER BY folio LIMIT 1); END $$;
     DO $$ BEGIN ASSERT NOT EXISTS (SELECT 1 FROM apd.carrera WHERE nombre ILIKE 'Técnico%'); END $$;
     UPDATE apd.solicitud SET nivel_estudios = 'preparatoria' WHERE id = ${DICT_OBS};
     DO $$ BEGIN ASSERT (SELECT carrera_tecnica IS NULL
                           FROM apd.solicitud WHERE estado = 'con_observaciones' AND tipo_acreditacion = 'dictaminador' ORDER BY folio LIMIT 1); END $$;`],
  ['Carrera técnica pide 5 años', 'ok', null, `
     UPDATE apd.solicitud SET nivel_estudios = 'tecnica', carrera_tecnica = 'Técnico forestal' WHERE id = ${DICT_OBS};
     DO $$ BEGIN ASSERT (SELECT perfil_academico = 'tecnica' AND experiencia_minima = 5
                           FROM apd.solicitud WHERE estado = 'con_observaciones' AND tipo_acreditacion = 'dictaminador' ORDER BY folio LIMIT 1); END $$;`],
  ['Una carrera escrita nueva se agrega sin grupo; al clasificarla la Secretaría, el perfil se actualiza', 'ok', null, `
     UPDATE apd.solicitud SET nivel_estudios = 'licenciatura', estatus_estudios = 'titulado', carrera = 'Gestión  Ambiental Urbana' WHERE id = ${DICT_OBS};
     DO $$ BEGIN ASSERT (SELECT s.perfil_academico = 'por_clasificar' AND s.experiencia_minima = 5 AND c.grupo IS NULL AND c.nombre = 'Gestión Ambiental Urbana'
                           FROM apd.solicitud s JOIN apd.carrera c ON c.id = s.carrera_id
                          WHERE s.estado = 'con_observaciones' AND s.tipo_acreditacion = 'dictaminador' ORDER BY s.folio LIMIT 1); END $$;
     UPDATE apd.carrera SET grupo = 'disciplina_afin' WHERE nombre = 'Gestión Ambiental Urbana';
     UPDATE apd.solicitud SET anios_experiencia = anios_experiencia WHERE id = ${DICT_OBS};
     DO $$ BEGIN ASSERT (SELECT perfil_academico = 'disciplina_afin' AND experiencia_minima = 5
                           FROM apd.solicitud WHERE estado = 'con_observaciones' AND tipo_acreditacion = 'dictaminador' ORDER BY folio LIMIT 1); END $$;`],
  ['Un posgrado cuenta como licenciatura titulada en su carrera', 'ok', null, `
     UPDATE apd.solicitud SET nivel_estudios = 'maestria', estatus_estudios = 'en_curso', carrera = 'Ingeniería Forestal' WHERE id = ${DICT_OBS};
     DO $$ BEGIN ASSERT (SELECT perfil_academico = 'licenciatura_afin' AND experiencia_minima = 2
                           FROM apd.solicitud WHERE estado = 'con_observaciones' AND tipo_acreditacion = 'dictaminador' ORDER BY folio LIMIT 1); END $$;`],
  // Revisión documental del dictaminador (decisiones 2026-10-16): clasificar la carrera, validar, rechazar
  ['Con la carrera sin clasificar no se valida', { codigo: 'carrera_sin_clasificar' }, null, `${LISTA_PARA_VALIDAR(POR_CLASIFICAR)}
     INSERT INTO apd.revision (solicitud_id, resultado, revisor) VALUES (${POR_CLASIFICAR}, 'validada', 'prueba.automatica');`],
  ['La persona solicitante no clasifica carreras', { codigo: 'clasificacion_sin_permiso' }, null, `
     SELECT set_config('apd.usuario_tipo', 'solicitante', true);
     UPDATE apd.carrera SET grupo = 'afin' WHERE nombre = 'Ingeniería Ambiental';`],
  ['Al clasificar la carrera como afín, la solicitud pide 2 años, se valida y queda en la bitácora', 'ok', null, `
     CREATE TEMP TABLE caso AS SELECT ${POR_CLASIFICAR} AS id;
     UPDATE apd.carrera SET grupo = 'afin' WHERE nombre = 'Ingeniería Ambiental';
     DO $$ BEGIN
       ASSERT (SELECT perfil_academico = 'licenciatura_afin' AND experiencia_minima = 2 FROM apd.solicitud WHERE id = (SELECT id FROM caso));
       ASSERT EXISTS (SELECT 1 FROM apd.bitacora WHERE accion = 'clasificar' AND detalle = 'Ingeniería Ambiental: sin clasificar → afin'); END $$;
     ${LISTA_PARA_VALIDAR('(SELECT id FROM caso)')}
     INSERT INTO apd.revision (solicitud_id, resultado, revisor) SELECT id, 'validada', 'prueba.automatica' FROM caso;
     DO $$ BEGIN ASSERT (SELECT estado = 'validada_en_linea' FROM apd.solicitud WHERE id = (SELECT id FROM caso)); END $$;`],
  ['Carrera clasificada como no afín: se rechaza con su motivo, que lee la persona', 'ok', null, `
     CREATE TEMP TABLE caso AS SELECT ${POR_CLASIFICAR} AS id;
     UPDATE apd.carrera SET grupo = 'no_afin' WHERE nombre = 'Ingeniería Ambiental';
     INSERT INTO apd.revision (solicitud_id, resultado, observacion_general, revisor)
       SELECT id, 'rechazada', 'La carrera no es afín al manejo del arbolado.', 'prueba.automatica' FROM caso;
     DO $$ BEGIN
       ASSERT (SELECT estado = 'rechazada' AND motivo_cierre = 'La carrera no es afín al manejo del arbolado.' FROM apd.solicitud WHERE id = (SELECT id FROM caso));
       ASSERT EXISTS (SELECT 1 FROM apd.bitacora WHERE accion = 'estado' AND detalle LIKE 'enviada → rechazada%'); END $$;`],
  ['Un rechazo sin motivo no se registra', { codigo: 'rechazo_sin_motivo' }, null, `
     UPDATE apd.carrera SET grupo = 'no_afin' WHERE nombre = 'Ingeniería Ambiental';
     INSERT INTO apd.revision (solicitud_id, resultado, revisor) VALUES (${POR_CLASIFICAR}, 'rechazada', 'prueba.automatica');`],
  ['Una solicitud cuyo perfil cumple no se rechaza', { codigo: 'rechazo_sin_causa' }, null, `
     INSERT INTO apd.revision (solicitud_id, resultado, observacion_general, revisor) VALUES (${PODA_ENVIADA}, 'rechazada', 'x', 'prueba.automatica');`],
  ['Con la carrera sin clasificar tampoco se rechaza: primero se clasifica', { codigo: 'rechazo_sin_causa' }, null, `
     INSERT INTO apd.revision (solicitud_id, resultado, observacion_general, revisor) VALUES (${POR_CLASIFICAR}, 'rechazada', 'x', 'prueba.automatica');`],
  ['Licenciatura trunca confirmada por el comprobante: no se valida', { codigo: 'perfil_no_cumple' }, null, `${TRUNCA_ENVIADA}
     ${LISTA_PARA_VALIDAR('(SELECT id FROM caso)')}
     INSERT INTO apd.revision (solicitud_id, resultado, revisor) SELECT id, 'validada', 'prueba.automatica' FROM caso;`],
  ['Licenciatura trunca confirmada por el comprobante: se rechaza, y la persona puede iniciar otra solicitud', 'ok', null, `${TRUNCA_ENVIADA}
     INSERT INTO apd.revision (solicitud_id, resultado, observacion_general, revisor)
       SELECT id, 'rechazada', 'El comprobante confirma que la licenciatura no se concluyó.', 'prueba.automatica' FROM caso;
     SELECT set_config('apd.usuario_tipo', 'solicitante', true);
     INSERT INTO apd.solicitud (solicitante_id, tipo_acreditacion, modalidad)
       SELECT solicitante_id, 'dictaminador', 'nueva' FROM apd.solicitud WHERE id = (SELECT id FROM caso);`],
  ['El comprobante muestra otro grado: regresa con observaciones y la persona corrige sus estudios', 'ok', null, `${TRUNCA_ENVIADA}
     UPDATE apd.documento SET estado = 'con_observacion', observacion = 'Su comprobante es una carta de pasante: corrija la situación de sus estudios.',
            revisado_por = 'prueba.automatica' WHERE solicitud_id = (SELECT id FROM caso) AND requisito = 'comprobante_estudios' AND vigente;
     INSERT INTO apd.revision (solicitud_id, resultado, revisor) SELECT id, 'con_observaciones', 'prueba.automatica' FROM caso;
     SELECT set_config('apd.usuario_tipo', 'solicitante', true);
     UPDATE apd.solicitud SET estatus_estudios = 'concluido' WHERE id = (SELECT id FROM caso);
     DO $$ BEGIN ASSERT (SELECT estado = 'con_observaciones' AND perfil_academico = 'pasante' AND experiencia_minima = 5
                           FROM apd.solicitud WHERE id = (SELECT id FROM caso)); END $$;`],
  ['Una persona de la UNAM queda adscrita a una institución educativa', 'ok', null, `
     UPDATE apd.solicitante SET adscripcion = 'educativa', organizacion_id = (SELECT id FROM apd.organizacion WHERE clave = 'unam') WHERE id = ${PERSONA_VIGENTE};`],
  ['Una institución educativa nueva se registra con su tipo', 'ok', null, `
     INSERT INTO apd.organizacion (tipo, nombre) VALUES ('educativa', 'Universidad Ejemplo del Valle');`],
  ['El sexo se toma de la CURP', 'ok', null, `DO $$ BEGIN
     ASSERT (SELECT bool_and(sexo = substr(curp, 11, 1)) FROM apd.solicitante); END $$;`],
  ['La solicitud se envía con la adscripción que la persona tiene ese día, y la conserva', 'ok', null, `${SIN_FOTO}
     SELECT set_config('apd.usuario_tipo', 'solicitante', true);
     ${FOTO("'00000000-0000-4000-a000-000000000011'")}
     UPDATE apd.solicitante SET adscripcion = 'alcaldia', organizacion_id = (SELECT id FROM apd.organizacion WHERE clave = 'tlalpan') WHERE id = '00000000-0000-4000-a000-000000000011';
     UPDATE apd.solicitud SET estado = 'enviada' WHERE id = '00000000-0000-4000-a000-000000000012';
     UPDATE apd.solicitante SET adscripcion = 'independiente', organizacion_id = NULL WHERE id = '00000000-0000-4000-a000-000000000011';
     DO $$ BEGIN ASSERT (SELECT adscripcion = 'alcaldia' FROM apd.solicitud WHERE id = '00000000-0000-4000-a000-000000000012'); END $$;`],
  ['La adscripción de una solicitud no se cambia a mano: es copia de la de la persona', { sqlstate: '42501' }, null, `
     UPDATE apd.solicitud SET adscripcion = 'independiente' WHERE id = ${BORRADOR};`],
  ['Una cuenta activa siempre tiene adscripción (también «independiente»)', { sqlstate: '23514' }, null, `
     UPDATE apd.solicitante SET adscripcion = NULL WHERE id = (SELECT id FROM apd.solicitante WHERE estado = 'activa' ORDER BY curp LIMIT 1);`],
  ['La misma institución escrita distinto no se duplica', { sqlstate: '23505' }, null, `
     INSERT INTO apd.organizacion (tipo, nombre) VALUES ('dependencia_federal', 'COMISION federal  de ELECTRICIDAD (cfe).');`],

  // ── Permisos de la cuenta del servicio y bitácora ──
  ['La cuenta no edita la bitácora', { sqlstate: '42501' }, null, `UPDATE apd.bitacora SET detalle = 'x';`],
  ['La cuenta no borra la bitácora', { sqlstate: '42501' }, null, `DELETE FROM apd.bitacora;`],
  ['La cuenta no borra solicitudes', { sqlstate: '42501' }, null, `DELETE FROM apd.solicitud;`],
  ['La cuenta no borra acreditaciones', { sqlstate: '42501' }, null, `DELETE FROM apd.acreditacion;`],
  ['La cuenta no toca los folios', { sqlstate: '42501' }, null, `UPDATE apd.folio_contador SET ultimo = 0;`],
  ['La cuenta no crea tablas en su esquema', { sqlstate: '42501' }, null, `CREATE TABLE apd.otra (x int);`],
  ['La cuenta no crea tablas en public', { sqlstate: '42501' }, null, `CREATE TABLE public.otra (x int);`],
  ['La cuenta no anota migraciones', { sqlstate: '42501' }, null, `INSERT INTO apd.migraciones VALUES (2, 'x');`],
  ['La cuenta no cambia qué base es (no puede simular la fecha en producción)', { sqlstate: '42501' }, null, `
     CREATE OR REPLACE FUNCTION apd.entorno() RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'pruebas'::text $$;`],
  // ── Material de estudio (decisión 2026-10-18) ──
  ['El material de estudio publicado se ve sin cuenta: tres documentos vigentes', 'ok', null, `DO $$ BEGIN
     ASSERT (SELECT count(*) FROM apd.material_publico) = 3; END $$;`],
  ['Una persona solicitante no sube material de estudio', { codigo: 'carga_de_personal' }, null, `
     SELECT set_config('apd.usuario_tipo', 'solicitante', true);
     ${MATERIAL_NUEVO('prueba_material')}`],
  ['El material de estudio sólo se carga en PDF', { codigo: 'formato_no_admitido' }, null, MATERIAL_NUEVO('prueba_material', 'image/jpeg')],
  ['El material de estudio no pasa del máximo de 30 MB', { codigo: 'archivo_grande' }, null, MATERIAL_NUEVO('prueba_material', 'application/pdf', 40000000)],
  ['Reemplazar el archivo deja la carga anterior sin borrar y conserva la publicación', 'ok', null, `
     ${MATERIAL_NUEVO('norma_poda')}
     DO $$ BEGIN
       ASSERT (SELECT count(*) FROM apd.material_estudio WHERE clave = 'norma_poda') = 2;
       ASSERT (SELECT count(*) FROM apd.material_estudio WHERE clave = 'norma_poda' AND vigente) = 1;
       ASSERT (SELECT publicado FROM apd.material_estudio WHERE clave = 'norma_poda' AND vigente);
       ASSERT (SELECT nombre_archivo FROM apd.material_publico WHERE clave = 'norma_poda') = 'prueba.pdf';
       ASSERT EXISTS (SELECT 1 FROM apd.bitacora WHERE accion = 'material_reemplazado' AND entidad_id = 'norma_poda'); END $$;`],
  ['La cuenta no cambia el archivo de un material cargado (no tiene permiso sobre esas columnas)', { sqlstate: '42501' }, null, `
     UPDATE apd.material_estudio SET sha256 = repeat('e', 64) WHERE clave = 'manual_poda' AND vigente;`],
  ['Ni la administración cambia el archivo de un material cargado', { codigo: 'documento_inmutable' }, null, `
     SELECT set_config('apd.usuario_tipo', 'personal', true);
     UPDATE apd.material_estudio SET sha256 = repeat('e', 64) WHERE clave = 'manual_poda' AND vigente;`, 'admin'],
  ['Ocultar un documento lo quita de la página pública y deja constancia', 'ok', null, `
     UPDATE apd.material_estudio SET publicado = false WHERE clave = 'ley_ambiental' AND vigente;
     DO $$ BEGIN
       ASSERT NOT EXISTS (SELECT 1 FROM apd.material_publico WHERE clave = 'ley_ambiental');
       ASSERT (SELECT actualizado_por FROM apd.material_estudio WHERE clave = 'ley_ambiental' AND vigente) = 'prueba.automatica';
       ASSERT EXISTS (SELECT 1 FROM apd.bitacora WHERE accion = 'material_oculto' AND entidad_id = 'ley_ambiental'); END $$;`],
  ['Ningún permiso directo fuera de su esquema', 'ok', null, `DO $$ BEGIN
     ASSERT (SELECT count(*) FROM information_schema.role_table_grants WHERE grantee = 'apd_api' AND table_schema <> 'apd') = 0; END $$;`],
  ['Cada cambio de estado deja constancia en la bitácora', 'ok', null, `DO $$ BEGIN
     ASSERT (SELECT count(*) FROM apd.solicitud s WHERE s.estado <> 'borrador'
              AND NOT EXISTS (SELECT 1 FROM apd.bitacora b WHERE b.entidad_id = s.id::text AND b.accion = 'estado')) = 0; END $$;`],
  ['Ni la administración edita la bitácora', { codigo: null, mensaje: 'no se edita ni se borra' }, null,
     `UPDATE apd.bitacora SET detalle = 'x';`, 'admin'],
  // Auditoría «intentar romperlo» 2026-10-18, F2 A6 y M4
  ['Una cita que todavía no llega no se registra: ni la inasistencia', { codigo: 'cita_futura' }, '2026-10-14 18:00', `
     ${NO_SE_PRESENTO}`],
  ['Una cita que todavía no llega no se atiende antes de su día', { codigo: 'cita_futura' }, '2026-10-19 09:00', `
     UPDATE apd.cita SET resultado = 'no_es_la_persona', observacion = 'La identificación es de otra persona.' WHERE solicitud_id = ${CITA_SOL} AND resultado = 'pendiente';`],
  ['El día de la cita sí se registra la inasistencia', 'ok', '2026-10-20 18:00', `
     ${NO_SE_PRESENTO}
     DO $$ BEGIN ASSERT EXISTS (SELECT 1 FROM apd.cita WHERE solicitud_id = ${CITA_SOL} AND resultado = 'no_se_presento'); END $$;`],
  ['Una cita a más de meses_adelanto_cita meses se rechaza', { codigo: 'cita_lejana' }, DIA_CITA, `
     ${NO_SE_PRESENTO}
     UPDATE apd.solicitud SET cita_en = '2027-04-21 10:00-06' WHERE id = ${CITA_SOL};`],
  ['Una cita hasta meses_adelanto_cita meses adelante se acepta', 'ok', DIA_CITA, `
     ${NO_SE_PRESENTO}
     UPDATE apd.solicitud SET cita_en = '2027-04-20 10:00-06' WHERE id = ${CITA_SOL};`],
  ['En una base de producción, simular la fecha es un error', { codigo: 'simulacion_prohibida' }, '2026-10-20 10:00', `
     CREATE OR REPLACE FUNCTION apd.entorno() RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'produccion'::text $$;
     SELECT apd.hoy();`, 'admin'],

  // ═══════════════ Correcciones de la auditoría del 19/10/2026 (bloque 2, base) ═══════════════
  // ── E2-04 · Cada decisión que cambia un trámite deja su renglón en la bitácora (las 11 acciones de r3/base-5) ──
  ['Bitácora · aceptar un documento en la revisión deja un renglón (E2-04)', 'ok', null, `${B0}
     UPDATE apd.documento SET estado = 'aceptado', revisado_por = 'prueba.automatica' WHERE solicitud_id = ${S44} AND requisito = 'curp' AND vigente;
     ${MAS(1, 'documento')}`],
  ['Bitácora · observar un documento deja un renglón (E2-04)', 'ok', null, `${B0}
     UPDATE apd.documento SET estado = 'con_observacion', observacion = 'Ilegible', revisado_por = 'prueba.automatica' WHERE solicitud_id = ${S44} AND requisito = 'curp' AND vigente;
     ${MAS(1, 'documento')}`],
  ['Bitácora · corregir la asistencia de un día deja un renglón con el valor anterior (E2-04)', 'ok', '2026-10-14 10:00', `${B0}
     UPDATE apd.asistencia SET asistio = false, capturada_por = 'prueba.automatica' WHERE dia = 1 AND inscripcion_id = ${INS21};
     ${MAS(1, 'asistencia')}
     DO $$ BEGIN ASSERT EXISTS (SELECT 1 FROM apd.bitacora WHERE accion = 'asistencia' AND usuario = 'prueba.automatica' AND detalle LIKE 'Día 1: % → faltó%'); END $$;`],
  ['Bitácora · mover la fecha y la hora de un grupo por confirmar deja un renglón (E2-04)', 'ok', '2026-10-14 10:00', `${B0}
     UPDATE apd.grupo SET fecha_inicio = '2026-11-30', hora_entrada = '10:00' WHERE id = ${GRUPO_INTEGRACION};
     ${MAS(1, 'cambio_programacion')}`],
  ['Bitácora · cambiar la cita de una solicitud deja un renglón (E2-04)', 'ok', null, `${B0}
     UPDATE apd.solicitud SET cita_en = '2026-11-02 10:00-06' WHERE id = ${S44};
     ${MAS(1, 'cita_asignada')}`],
  ['Bitácora · lo que la persona corrige de sus estudios después de enviar deja un renglón (E2-04)', 'ok', null, `${B0}
     SELECT set_config('apd.usuario_tipo', 'solicitante', true);
     UPDATE apd.solicitud SET nivel_estudios = 'maestria', carrera = 'Ciencias Forestales', anios_experiencia = 7 WHERE id = ${DICT_OBS};
     ${MAS(1, 'estudios')}`],
  ['Bitácora · quitar un requisito de un curso deja un renglón (E2-04)', 'ok', null, `${B0}
     DELETE FROM apd.requisito_curso WHERE ctid = (SELECT ctid FROM apd.requisito_curso WHERE NOT obligatorio LIMIT 1);
     ${MAS(1, 'requisito_quitado')}`],
  ['Bitácora · hacer opcional un requisito obligatorio deja un renglón (E2-04)', 'ok', null, `${B0}
     UPDATE apd.requisito_curso SET obligatorio = false WHERE ctid = (SELECT ctid FROM apd.requisito_curso WHERE obligatorio LIMIT 1);
     ${MAS(1, 'requisito_cambiado')}`],
  ['Bitácora · bloquear una cuenta por intentos deja un renglón (E2-04)', 'ok', null, `${B0}
     UPDATE apd.solicitante SET estado = 'bloqueada', bloqueada_hasta = now() + interval '15 minutes', intentos_fallidos = 5
      WHERE id = (SELECT solicitante_id FROM apd.solicitud WHERE id = ${S44});
     ${MAS(1, 'bloqueo_intentos')}`],
  ['Bitácora · dar de baja una cuenta deja un renglón (E2-04)', 'ok', null, `${B0}
     UPDATE apd.solicitante SET estado = 'inactiva' WHERE id = (SELECT solicitante_id FROM apd.solicitud WHERE id = ${S44});
     ${MAS(1, 'estado')}`],
  ['Bitácora · validar en línea deja un renglón por cada decisión: 4 documentos, la cita y el estado (E2-04)', 'ok', null, `${B0}
     UPDATE apd.documento SET estado = 'aceptado', revisado_por = 'prueba.automatica' WHERE solicitud_id = ${S44} AND vigente;
     UPDATE apd.solicitud SET cita_en = '2026-10-21 10:00-06' WHERE id = ${S44};
     INSERT INTO apd.revision (solicitud_id, resultado, revisor) VALUES (${S44}, 'validada', 'prueba.automatica');
     ${MAS(6)}`],

  // ── D-13 y E2-06 · La bitácora la escriben sólo las reglas ──
  ['La cuenta del servicio no escribe renglones de bitácora directo (D-13)', { sqlstate: '42501' }, null, `
     INSERT INTO apd.bitacora (accion, entidad, entidad_id, detalle) VALUES ('emision', 'acreditacion', 'x', 'renglón directo');`],
  ['Ni llamando apd.registrar fuera de una regla (D-13)', { codigo: 'bitacora_directa' }, null, `
     SELECT apd.registrar('estado', 'solicitud', 'x', 'renglón directo');`],
  ['Si se permite, la fecha y la cuenta no se pueden escoger (D-13)', 'ok', null, `
     DO $$ BEGIN
       BEGIN
         INSERT INTO apd.bitacora (fecha, usuario, usuario_tipo, accion, entidad, entidad_id, detalle)
         VALUES ('2025-01-01 09:00-06', 'otra.persona', 'migracion', 'emision', 'acreditacion', 'x', 'renglón inventado');
       EXCEPTION WHEN insufficient_privilege OR raise_exception THEN RETURN; END;
       ASSERT NOT EXISTS (SELECT 1 FROM apd.bitacora WHERE detalle = 'renglón inventado' AND (fecha < now() - interval '1 minute' OR usuario = 'otra.persona'));
     END $$;`],
  ['Aun la administración: fecha, cuenta, tipo y procedencia de un renglón los pone la base (D-13)', 'ok', '2026-10-14 10:00', `
     SELECT set_config('apd.procedencia', '192.0.2.99', true);
     INSERT INTO apd.bitacora (fecha, usuario, usuario_tipo, procedencia, accion, entidad, entidad_id, detalle)
     VALUES ('2025-01-01 09:00-06', 'otra.persona', 'migracion', '10.0.0.1', 'emision', 'acreditacion', 'x', 'renglón inventado');
     DO $$ BEGIN ASSERT (SELECT (fecha, usuario, usuario_tipo, procedencia) = ('2026-10-14 10:00-06'::timestamptz, 'prueba.automatica', 'personal', '192.0.2.99')
                          FROM apd.bitacora WHERE detalle = 'renglón inventado'); END $$;`, 'admin'],
  ['apd.registrar corre con search_path fijo y los permisos de quien instala', 'ok', null, `DO $$ BEGIN
     ASSERT (SELECT prosecdef AND proconfig @> ARRAY['search_path=apd, pg_temp'] FROM pg_proc WHERE oid = 'apd.registrar(text, text, text, text)'::regprocedure); END $$;`],
  ['Toda función del esquema que corre con los permisos de quien instala tiene search_path fijo', 'ok', null, `DO $$ BEGIN
     ASSERT NOT EXISTS (SELECT 1 FROM pg_proc WHERE pronamespace = 'apd'::regnamespace AND prosecdef
                         AND NOT coalesce(proconfig @> ARRAY['search_path=apd, pg_temp'], false));
     -- 8 desde el registro asistido (25/10/2026): apd.avisar_por_telefono escribe los avisos por teléfono
     ASSERT (SELECT count(*) FROM pg_proc WHERE pronamespace = 'apd'::regnamespace AND prosecdef) = 8; END $$;`],

  // ── E2-07 · Decisión 6: la cuenta del servicio no pide folios ni abre expedientes directamente ──
  ['La cuenta del servicio no pide folios directamente (E2-07)', { sqlstate: '42501' }, null, `SELECT apd.siguiente_folio('PD', 2026::smallint);`],
  ['La cuenta del servicio no abre expedientes directamente (E2-07)', { sqlstate: '42501' }, null, `
     SELECT apd.asignar_expediente((SELECT id FROM apd.solicitante WHERE numero_expediente IS NULL AND estado = 'activa' ORDER BY curp LIMIT 1));`],
  ['Las altas siguen recibiendo su folio sin huecos: solicitud y grupo (E2-07)', 'ok', '2026-10-14 10:00', `
     INSERT INTO apd.grupo (id, tipo_acreditacion, modalidad, integracion) VALUES ('00000000-0000-4000-a000-000000000051', 'poda', 'nueva', 'combinado');
     DO $$ BEGIN ASSERT (SELECT folio FROM apd.grupo WHERE id = '00000000-0000-4000-a000-000000000051')
                      = 'APD-G-2026-' || lpad((SELECT count(*) FROM apd.grupo WHERE folio LIKE 'APD-G-2026-%')::text, 3, '0'); END $$;`],

  // ── Decisión 3 · El primer día de un curso: a lo más dentro de un año ──
  ['El primer día de un grupo no pasa de 12 meses desde hoy: con hoy 14/10/2026, el 15/10/2027 se rechaza (decisión 3)', { codigo: 'inicio_muy_lejano' }, '2026-10-14 10:00', `
     UPDATE apd.grupo SET fecha_inicio = '2027-10-15' WHERE id = ${GRUPO_INTEGRACION};`],
  // Con un lunes justo a los 12 meses: el curso de 5 días empieza en lunes (sesión del 23/10/2026)
  ['El primer día puede ser justo a los 12 meses: con hoy 18/10/2026, el lunes 18/10/2027 pasa (decisión 3)', 'ok', '2026-10-18 10:00', `
     UPDATE apd.grupo SET fecha_inicio = '2027-10-18' WHERE id = ${GRUPO_INTEGRACION};`],
  ['Un grupo nuevo con el primer día en el año 6110 (fecha pegada) se rechaza (decisión 3)', { codigo: 'inicio_muy_lejano' }, '2026-10-14 10:00', `
     INSERT INTO apd.grupo (tipo_acreditacion, modalidad, integracion, fecha_inicio) VALUES ('poda', 'nueva', 'combinado', '6110-02-20');`],

  // ── A2-01 · Decisión 8: al cancelar, la cita abierta queda «cancelada» ──
  ['Al cancelar con la cita por atender, la cita queda «cancelada» con el motivo y en la bitácora (decisión 8)', 'ok', null, `
     CREATE TEMP TABLE s AS SELECT ${CITA_SOL} AS id;
     UPDATE apd.solicitud SET estado = 'cancelada', motivo_cierre = 'La persona desistió.' WHERE id = (SELECT id FROM s);
     DO $$ BEGIN
       ASSERT NOT EXISTS (SELECT 1 FROM apd.cita WHERE solicitud_id = (SELECT id FROM s) AND resultado IN ('pendiente', 'en_pausa'));
       ASSERT (SELECT observacion = 'Solicitud cancelada: La persona desistió.' AND atendida_en IS NOT NULL FROM apd.cita
                WHERE solicitud_id = (SELECT id FROM s) AND resultado = 'cancelada');
       ASSERT EXISTS (SELECT 1 FROM apd.bitacora WHERE entidad_id = (SELECT id FROM s)::text AND accion = 'cita' AND detalle LIKE 'pendiente → cancelada%');
     END $$;`],
  ['También la cita en pausa, aunque cancele la persona (decisión 8)', 'ok', '2026-10-20 10:30', `
     CREATE TEMP TABLE s AS SELECT ${CITA_SOL} AS id;
     ${PAUSA_CURP}
     SELECT set_config('apd.usuario_tipo', 'solicitante', true);
     UPDATE apd.solicitud SET estado = 'cancelada', motivo_cierre = 'Ya no puede asistir.' WHERE id = (SELECT id FROM s);
     DO $$ BEGIN ASSERT (SELECT resultado = 'cancelada' AND pausada_en IS NOT NULL FROM apd.cita
                          WHERE solicitud_id = (SELECT id FROM s) ORDER BY creada_en DESC LIMIT 1); END $$;`],
  ['APD-S-2026-00045 (cancelada) tiene su cita «cancelada», con el motivo (decisión 8)', 'ok', null, `DO $$ BEGIN
     ASSERT (SELECT bool_and(c.resultado = 'cancelada' AND c.observacion LIKE 'Solicitud cancelada: %') FROM apd.cita c
              JOIN apd.solicitud s ON s.id = c.solicitud_id WHERE s.folio = 'APD-S-2026-00045'); END $$;`],
  ['Ninguna cita queda abierta en una solicitud sin cita asignada (A2-01)', 'ok', null, `DO $$ BEGIN
     ASSERT NOT EXISTS (SELECT 1 FROM apd.cita c JOIN apd.solicitud s ON s.id = c.solicitud_id
                         WHERE c.resultado IN ('pendiente', 'en_pausa') AND s.estado <> 'validada_en_linea'); END $$;`],
  ['Una cita no se marca «cancelada» a mano (decisión 8)', { codigo: 'cita_sin_cancelacion' }, null, `
     UPDATE apd.cita SET resultado = 'cancelada', observacion = 'x' WHERE solicitud_id = ${CITA_SOL} AND resultado = 'pendiente';`],

  // ── D-01 · Acreditaciones migradas (pruebas 1 a 4 de r2 y la restricción) ──
  ['D-01 · Una sesión de solicitante no da de alta una acreditación migrada', { codigo: 'migracion_sin_permiso' }, null, `
     ${COMO('solicitante')}
     INSERT INTO apd.acreditacion (numero, solicitante_id, tipo_acreditacion, emitida_en, origen)
     VALUES ('PD-2025-K900', ${SIN_ACRED}, 'poda', '2025-12-01', 'kobo');`],
  ['D-01 · El personal tampoco: la migración es sólo de la cuenta de migración', { codigo: 'migracion_sin_permiso' }, null, `
     INSERT INTO apd.acreditacion (numero, solicitante_id, tipo_acreditacion, emitida_en, origen)
     VALUES ('PD-2025-K901', ${SIN_ACRED}, 'poda', '2025-12-01', 'papel');`],
  ['D-01 · Una migrada no usa la serie del sistema (PD-AAAA-NNNN): chocaría con la siguiente emisión', { codigo: 'migrada_con_serie' }, null, `
     ${COMO('migracion')}
     INSERT INTO apd.acreditacion (numero, solicitante_id, tipo_acreditacion, emitida_en, origen)
     VALUES ('PD-2026-0009', ${SIN_ACRED}, 'poda', '2026-10-01', 'kobo');`],
  ['D-01 · Una migrada no se emite en el futuro', { codigo: 'migrada_futura' }, '2026-10-17 10:00', `
     ${COMO('migracion')}
     INSERT INTO apd.acreditacion (numero, solicitante_id, tipo_acreditacion, emitida_en, origen)
     VALUES ('PD-2026-K902', ${SIN_ACRED}, 'dictaminador', '2026-12-01', 'kobo');`],
  ['D-01 · La carga de migración da de alta una con su número original y su fecha', 'ok', '2026-10-17 10:00', `
     ${COMO('migracion')}
     INSERT INTO apd.acreditacion (numero, solicitante_id, tipo_acreditacion, emitida_en, origen)
     VALUES ('PD-2025-K903', ${SIN_ACRED}, 'poda', '2025-12-01', 'kobo');
     DO $$ BEGIN ASSERT (SELECT vence_en = '2026-11-30' FROM apd.acreditacion WHERE numero = 'PD-2025-K903'); END $$;`],
  ['D-01 · Aun sin disparadores (administración), una migrada con la forma de la serie la rechaza la restricción', { sqlstate: '23514' }, null, `
     SET LOCAL session_replication_role = replica;
     INSERT INTO apd.acreditacion (numero, solicitante_id, tipo_acreditacion, emitida_en, vence_en, origen)
     VALUES ('PD-2026-0009', ${SIN_ACRED}, 'poda', '2026-10-01', '2027-09-30', 'kobo');`, 'admin'],
  ['Una migrada sin número se rechaza', { codigo: 'migrada_sin_numero' }, null, `
     ${COMO('migracion')}
     INSERT INTO apd.acreditacion (numero, solicitante_id, tipo_acreditacion, emitida_en, origen)
     VALUES ('  ', ${SIN_ACRED}, 'poda', '2025-12-01', 'kobo');`],

  // ── D-07 · Bloqueo por intentos fallidos ──
  ['D-07 · Existe el parámetro del número de intentos y del tiempo de bloqueo', 'ok', null, `DO $$ BEGIN
     ASSERT (SELECT count(*) FROM apd.parametro WHERE clave ~ '(intento|bloqueo)') >= 2;
     ASSERT (SELECT valor FROM apd.parametro WHERE clave = 'intentos_maximos') = '5';
     ASSERT (SELECT valor FROM apd.parametro WHERE clave = 'minutos_bloqueo') = '15'; END $$;`],
  ['D-07 · Al llegar al máximo de intentos la base pone bloqueada_hasta', 'ok', null, `
     ${COMO('sistema')}
     UPDATE apd.solicitante SET intentos_fallidos = 5 WHERE id = ${ACTIVA};
     DO $$ BEGIN ASSERT (SELECT bloqueada_hasta > apd.ahora() FROM apd.solicitante WHERE id = (SELECT id FROM apd.solicitante WHERE estado = 'activa' ORDER BY curp LIMIT 1)); END $$;`],
  ['D-07 · Quitar un bloqueo vigente deja constancia en la bitácora', 'ok', null, `
     ${COMO('sistema')}
     UPDATE apd.solicitante SET intentos_fallidos = 5, bloqueada_hasta = now() + interval '15 minutes' WHERE id = ${ACTIVA};
     UPDATE apd.solicitante SET intentos_fallidos = 0, bloqueada_hasta = NULL WHERE id = ${ACTIVA};
     DO $$ BEGIN ASSERT EXISTS (SELECT 1 FROM apd.bitacora WHERE entidad_id = (SELECT id::text FROM apd.solicitante WHERE estado = 'activa' ORDER BY curp LIMIT 1)
                                 AND accion = 'desbloqueo_intentos'); END $$;`],
  ['D-07 · Cinco intentos fallidos con apd.anotar_intento bloquean la entrada 15 minutos', 'ok', '2026-10-14 10:00', `
     ${COMO('sistema')}
     ${INTENTOS5}
     DO $$ BEGIN
       ASSERT (SELECT intentos FROM r WHERE n = 4) = 4 AND (SELECT bloqueada_hasta FROM r WHERE n = 4) IS NULL;
       ASSERT (SELECT intentos FROM r WHERE n = 5) = 5;
       ASSERT (SELECT bloqueada_hasta FROM r WHERE n = 5) = '2026-10-14 10:15-06';
       ASSERT EXISTS (SELECT 1 FROM apd.bitacora WHERE accion = 'bloqueo_intentos' AND usuario = 'prueba.automatica');
     END $$;`],
  ['D-07 · Más intentos durante el bloqueo no lo alargan', 'ok', '2026-10-14 10:00', `
     ${COMO('sistema')}
     ${INTENTOS5}
     SELECT set_config('apd.ahora_simulado', '2026-10-14 10:10:00-06', true);
     DO $$ BEGIN ASSERT (SELECT bloqueada_hasta FROM apd.anotar_intento((SELECT curp FROM apd.solicitante WHERE estado = 'activa' ORDER BY curp LIMIT 1)))
                      = '2026-10-14 10:15-06'; END $$;`],
  ['D-07 · Con el bloqueo vigente, ni la contraseña correcta entra', { codigo: 'cuenta_bloqueada_intentos' }, '2026-10-14 10:00', `
     ${COMO('sistema')}
     ${INTENTOS5}
     SELECT apd.acceso_correcto((SELECT curp FROM apd.solicitante WHERE id = ${ACTIVA}));`],
  ['D-07 · Pasado el bloqueo, el acceso correcto vuelve el contador a 0', 'ok', '2026-10-14 10:00', `
     ${COMO('sistema')}
     ${INTENTOS5}
     SELECT set_config('apd.ahora_simulado', '2026-10-14 10:16:00-06', true);
     DO $$ BEGIN ASSERT apd.acceso_correcto((SELECT curp FROM apd.solicitante WHERE estado = 'activa' ORDER BY curp LIMIT 1));
                  ASSERT (SELECT intentos_fallidos = 0 AND bloqueada_hasta IS NULL FROM apd.solicitante WHERE estado = 'activa' ORDER BY curp LIMIT 1); END $$;`],
  ['D-07 · Un intento después de un bloqueo vencido empieza la cuenta de nuevo', 'ok', '2026-10-14 10:00', `
     ${COMO('sistema')}
     ${INTENTOS5}
     SELECT set_config('apd.ahora_simulado', '2026-10-14 10:20:00-06', true);
     DO $$ BEGIN ASSERT (SELECT intentos = 1 AND bloqueada_hasta IS NULL FROM apd.anotar_intento((SELECT curp FROM apd.solicitante WHERE estado = 'activa' ORDER BY curp LIMIT 1))); END $$;`],
  ['D-07 · Un intento con una CURP sin cuenta no devuelve nada', 'ok', null, `DO $$ BEGIN
     ASSERT NOT EXISTS (SELECT 1 FROM apd.anotar_intento('XAXX991231HNEXXX09')); END $$;`],

  // ── D-10 · public fuera del search_path de la cuenta ──
  ['D-10 · El search_path de apd_api no incluye public', 'ok', null, `DO $$ BEGIN
     ASSERT current_setting('search_path') !~ 'public'; END $$;`],
  // La prueba 13 de r2 concede CREATE a PUBLIC (como PostgreSQL 13-14 de fábrica) y espera 42501: eso sólo se cumple con
  // el REVOKE que hace la administración (docs/REGLAS.md, «Permisos»). Aquí se comprueba que en esta base nadie puede crear en public.
  ['D-10 · Ni la cuenta ni PUBLIC pueden crear en public (en PostgreSQL 13-14, tras el REVOKE de REGLAS.md)', 'ok', null, `DO $$ BEGIN
     ASSERT NOT has_schema_privilege('apd_api', 'public', 'CREATE');
     ASSERT NOT has_schema_privilege('public', 'public', 'CREATE'); END $$;`, 'admin'],

  // ── D-06 · Lo que se puede en la base: quién captura asistencia y examen ──
  // Pendiente (D-06, fuera de la base): la pertenencia de la fila a la persona de la sesión (contexto apd.solicitante_id o
  // RLS) y que las tablas con datos de personas tengan seguridad por renglón; se resuelve con el backend en la etapa 3.
  ['D-06 · La asistencia la captura una sesión de personal, no de solicitante', { codigo: 'captura_de_personal' }, '2026-10-14 10:00', `
     ${COMO('solicitante', 'instructor.ficticio')}
     INSERT INTO apd.asistencia (inscripcion_id, dia, asistio, capturada_por)
     SELECT i.id, 3, true, 'otra.persona' FROM apd.inscripcion i JOIN apd.grupo g ON g.id = i.grupo_id
      WHERE g.estado = 'en_curso' AND i.activa
        AND NOT EXISTS (SELECT 1 FROM apd.asistencia a WHERE a.inscripcion_id = i.id AND a.dia = 3) LIMIT 1;`],
  ['D-06 · Quien captura la asistencia queda como la cuenta de la sesión (capturada_por = apd.usuario)', 'ok', '2026-10-14 10:00', `
     ${COMO('personal', 'instructor.ficticio')}
     INSERT INTO apd.asistencia (inscripcion_id, dia, asistio, capturada_por)
     SELECT i.id, 3, true, 'otra.persona' FROM apd.inscripcion i JOIN apd.grupo g ON g.id = i.grupo_id
      WHERE g.estado = 'en_curso' AND i.activa
        AND NOT EXISTS (SELECT 1 FROM apd.asistencia a WHERE a.inscripcion_id = i.id AND a.dia = 3) LIMIT 1;
     DO $$ BEGIN ASSERT NOT EXISTS (SELECT 1 FROM apd.asistencia WHERE capturada_por = 'otra.persona'); END $$;`],
  ['D-06 · La calificación la captura una sesión de personal, a su propio nombre', { codigo: 'captura_de_personal' }, '2026-10-16 10:00', `
     ${ASISTE21}
     SELECT set_config('apd.usuario_tipo', 'solicitante', true);
     INSERT INTO apd.examen (inscripcion_id, presentado_en, calificacion, capturado_por) VALUES (${INS21}, '2026-10-16', 9, 'otra.persona');`],
  ['D-06 · Quien captura la calificación queda como la cuenta de la sesión', 'ok', '2026-10-16 10:00', `
     ${ASISTE21}
     INSERT INTO apd.examen (inscripcion_id, presentado_en, calificacion, capturado_por) VALUES (${INS21}, '2026-10-16', 9, 'otra.persona');
     DO $$ BEGIN ASSERT (SELECT capturado_por FROM apd.examen WHERE calificacion = 9 AND presentado_en = '2026-10-16') = 'prueba.automatica'; END $$;`],

  // ── E2-01 a E2-03 en secuencia (con dos conexiones: herramientas/probar-concurrencia.sh) ──
  ['Una segunda revisión de la misma vuelta se rechaza: ya la registró otra persona (E2-01)', { codigo: 'revision_ya_registrada' }, null, `
     ${LISTA_PARA_VALIDAR(S44)}
     INSERT INTO apd.revision (solicitud_id, resultado, revisor) VALUES (${S44}, 'validada', 'prueba.automatica');
     INSERT INTO apd.revision (solicitud_id, resultado, observacion_general, revisor) VALUES (${S44}, 'con_observaciones', 'Otra revisión.', 'otra.revisora');`],
  ['Un documento ya decidido en esta vuelta no se vuelve a revisar (E2-01)', { codigo: 'revision_ya_registrada' }, null, `
     INSERT INTO apd.revision (solicitud_id, resultado, observacion_general, revisor) VALUES (${S44}, 'con_observaciones', 'Corrige la CURP.', 'prueba.automatica');
     UPDATE apd.documento SET estado = 'aceptado', revisado_por = 'otra.revisora' WHERE solicitud_id = ${S44} AND requisito = 'curp' AND vigente;`],
  ['Una solicitud que no está enviada no se revisa', { codigo: 'revision_fuera_de_turno' }, null, `
     INSERT INTO apd.revision (solicitud_id, resultado, revisor) VALUES (${BORRADOR}, 'validada', 'prueba.automatica');`],
  ['Los documentos de una solicitud en espera de grupo ya no se revisan', { codigo: 'revision_fuera_de_turno' }, null, `
     UPDATE apd.documento SET estado = 'con_observacion', observacion = 'x', revisado_por = 'prueba.automatica'
      WHERE ctid = (SELECT d.ctid FROM apd.documento d JOIN apd.solicitud s ON s.id = d.solicitud_id
                     WHERE s.estado = 'lista_para_curso' AND d.vigente ORDER BY s.folio LIMIT 1);`],
  ['Las observaciones necesitan un texto general o un documento observado', { codigo: 'observaciones_vacias' }, null, `
     INSERT INTO apd.revision (solicitud_id, resultado, revisor) VALUES (${S44}, 'con_observaciones', 'prueba.automatica');`],
  ['No se da de baja a quien ya presentó examen (E2-03)', { codigo: 'baja_con_examen' }, '2026-10-16 10:00', `
     ${ASISTE21}
     INSERT INTO apd.examen (inscripcion_id, presentado_en, calificacion, capturado_por) VALUES (${INS21}, '2026-10-16', 9, 'x');
     UPDATE apd.inscripcion SET activa = false, motivo_baja = 'Baja solicitada' WHERE id = (SELECT inscripcion_id FROM apd.examen WHERE calificacion = 9 AND presentado_en = '2026-10-16');`],
  ['Con el examen capturado, la asistencia ya no cambia (E2-03)', { codigo: 'asistencia_cerrada' }, '2026-10-16 10:00', `
     ${ASISTE21}
     INSERT INTO apd.examen (inscripcion_id, presentado_en, calificacion, capturado_por) VALUES (${INS21}, '2026-10-16', 9, 'x');
     UPDATE apd.asistencia SET asistio = false WHERE dia = 5 AND inscripcion_id = (SELECT inscripcion_id FROM apd.examen WHERE calificacion = 9 AND presentado_en = '2026-10-16');`],
  ['Una inscripción dada de baja no recibe calificación', { codigo: 'inscripcion_inactiva' }, '2026-10-16 10:00', `
     ${ASISTE21}
     CREATE TEMP TABLE i AS SELECT ${INS21} AS id;
     UPDATE apd.inscripcion SET activa = false, motivo_baja = 'Baja solicitada' WHERE id = (SELECT id FROM i);
     INSERT INTO apd.examen (inscripcion_id, presentado_en, calificacion, capturado_por) VALUES ((SELECT id FROM i), '2026-10-16', 9, 'x');`],
  ['Una baja necesita motivo', { codigo: 'baja_sin_motivo' }, null, `
     UPDATE apd.inscripcion SET activa = false WHERE id = (SELECT id FROM apd.inscripcion WHERE grupo_id = ${GRUPO_INTEGRACION} AND activa LIMIT 1);`],
  ['Una inscripción dada de baja no se reactiva', { codigo: 'inscripcion_inmutable' }, null, `
     UPDATE apd.inscripcion SET activa = true WHERE ctid = (SELECT ctid FROM apd.inscripcion WHERE NOT activa LIMIT 1);`],

  // ── A1-03 · Un caso por cada regla con código que no tenía ninguno ──
  ['Ni la administración cambia la marca de dato de prueba de una cuenta', { codigo: 'campo_inmutable' }, null, `
     UPDATE apd.solicitante SET es_ficticio = false WHERE id = ${ACTIVA};`, 'admin'],
  ['Ni la administración cambia el número de expediente', { codigo: 'expediente_fijo' }, null, `
     UPDATE apd.solicitante SET numero_expediente = 'EXP-2026-9999' WHERE id = (SELECT id FROM apd.solicitante WHERE numero_expediente IS NOT NULL ORDER BY curp LIMIT 1);`, 'admin'],
  ['Ni la administración modifica una acreditación emitida', { codigo: 'acreditacion_inmutable' }, null, `
     UPDATE apd.acreditacion SET vence_en = vence_en + 30 WHERE numero = 'PD-2026-0001';`, 'admin'],
  ['Para pasar a observaciones hay que registrar la revisión', { codigo: 'sin_revision' }, null, `
     UPDATE apd.solicitud SET estado = 'con_observaciones' WHERE id = ${S44};`],
  ['Validar sin todos los documentos aceptados se rechaza', { codigo: 'documentos_sin_aceptar' }, null, `
     UPDATE apd.solicitud SET cita_en = '2026-10-21 10:00-06' WHERE id = ${S44};
     INSERT INTO apd.revision (solicitud_id, resultado, revisor) VALUES (${S44}, 'validada', 'prueba.automatica');`],
  ['Validar sin cita de cotejo se rechaza', { codigo: 'sin_cita' }, null, `
     UPDATE apd.documento SET estado = 'aceptado', revisado_por = 'prueba.automatica' WHERE solicitud_id = ${S44} AND vigente;
     INSERT INTO apd.revision (solicitud_id, resultado, revisor) VALUES (${S44}, 'validada', 'prueba.automatica');`],
  ['Cambiar los estudios de una solicitud enviada se rechaza', { codigo: 'solicitud_cerrada' }, null, `
     UPDATE apd.solicitud SET nivel_estudios = 'secundaria' WHERE id = ${S44};`],
  ['El curso de una solicitud enviada no cambia', { codigo: 'curso_fijo' }, null, `
     SELECT set_config('apd.usuario_tipo', 'solicitante', true);
     UPDATE apd.solicitud SET modalidad = 'renovacion' WHERE id = ${DICT_OBS};`],
  ['Dictaminador nueva sin años de experiencia no se envía', { codigo: 'falta_perfil' }, null, `
     SELECT set_config('apd.usuario_tipo', 'solicitante', true);
     UPDATE apd.solicitud SET anios_experiencia = NULL WHERE id = ${DICT_OBS};
     UPDATE apd.solicitud SET estado = 'enviada' WHERE id = ${DICT_OBS};`],
  ['Una solicitud nace como borrador', { codigo: 'alta_fuera_de_borrador' }, null, `
     INSERT INTO apd.solicitud (solicitante_id, tipo_acreditacion, modalidad, estado) VALUES (${SIN_ACRED}, 'poda', 'nueva', 'enviada');`],
  ['La acreditación a renovar es de la persona', { codigo: 'anterior_no_corresponde' }, '2026-10-20 10:00', `
     INSERT INTO apd.solicitud (solicitante_id, tipo_acreditacion, modalidad, acreditacion_anterior_id)
     VALUES (${PERSONA_VIGENTE}, 'poda', 'renovacion', ${ACRED_POR_VENCER});`],
  ['Sólo se renueva la acreditación más reciente', { codigo: 'anterior_no_es_la_ultima' }, '2026-10-20 10:00', `
     ${COMO('migracion')}
     INSERT INTO apd.acreditacion (id, numero, solicitante_id, tipo_acreditacion, emitida_en, origen)
     VALUES ('00000000-0000-4000-a000-000000000052', 'PD-2024-K999', ${PERSONA_VIGENTE}, 'poda', '2024-11-20', 'kobo');
     ${COMO('solicitante')}
     INSERT INTO apd.solicitud (solicitante_id, tipo_acreditacion, modalidad, acreditacion_anterior_id)
     VALUES (${PERSONA_VIGENTE}, 'poda', 'renovacion', '00000000-0000-4000-a000-000000000052');`],
  ['Con la cita validada, pasar a observaciones exige decir qué no coincidió', { codigo: 'cotejo_sin_motivo' }, null, `
     UPDATE apd.solicitud SET estado = 'con_observaciones' WHERE id = ${CITA_SOL};`],
  ['Una cita sólo nace al asignarla a una solicitud validada', { codigo: 'cita_fuera_de_turno' }, null, `
     INSERT INTO apd.cita (solicitud_id, programada_en) VALUES (${S44}, '2026-10-21 10:00-06');`],
  ['Una cita en pausa no regresa a «Por atender»', { codigo: 'cita_transicion' }, '2026-10-20 10:30', `
     ${PAUSA_CURP}
     UPDATE apd.cita SET resultado = 'pendiente' WHERE solicitud_id = ${CITA_SOL} AND resultado = 'en_pausa';`],
  ['Con un documento que no coincidió no se concluye el cotejo', { codigo: 'documentos_sin_cotejar' }, '2026-10-20 10:30', `
     CREATE TEMP TABLE s AS SELECT id, solicitante_id FROM apd.solicitud WHERE id = ${CITA_SOL};
     ${DOC_PEQUENO('(SELECT id FROM s)', 'factura_pago')}
     UPDATE apd.fotografia SET estado = 'confirmada' WHERE solicitante_id = (SELECT solicitante_id FROM s) AND vigente AND estado = 'pendiente';
     UPDATE apd.documento SET estado = 'con_observacion', observacion = 'No coincide.', revisado_por = 'prueba.automatica'
      WHERE solicitud_id = (SELECT id FROM s) AND requisito = 'curp' AND vigente;
     UPDATE apd.cita SET resultado = 'atendida' WHERE solicitud_id = (SELECT id FROM s) AND resultado = 'pendiente';
     UPDATE apd.solicitud SET factura_rfc = 'XAXX010101000', factura_razon_social = 'Persona de prueba',
       factura_folio_fiscal = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', estado = 'lista_para_curso' WHERE id = (SELECT id FROM s);`],
  ['Sólo con una inscripción activa la solicitud queda con grupo', { codigo: 'sin_inscripcion' }, null, `
     UPDATE apd.solicitud SET estado = 'inscrita' WHERE id = (SELECT solicitud_id FROM apd.bandeja_demanda ORDER BY folio LIMIT 1);`],
  ['Quien sigue en su grupo no regresa a la espera', { codigo: 'sigue_inscrita' }, null, `
     UPDATE apd.solicitud SET estado = 'lista_para_curso' WHERE id = (SELECT id FROM apd.solicitud WHERE folio = 'APD-S-2026-00021');`],
  ['Sin calificación no hay resultado', { codigo: 'sin_examen' }, null, `
     UPDATE apd.solicitud SET estado = 'aprobada' WHERE id = (SELECT id FROM apd.solicitud WHERE folio = 'APD-S-2026-00021');`],
  ['El resultado sale de la calificación', { codigo: 'resultado_no_corresponde' }, '2026-10-16 10:00', `
     ${ASISTE21}
     SET LOCAL session_replication_role = replica;
     INSERT INTO apd.examen (inscripcion_id, presentado_en, calificacion, capturado_por) VALUES (${INS21}, '2026-10-16', 9, 'x');
     SET LOCAL session_replication_role = origin;
     UPDATE apd.solicitud SET estado = 'no_acreditada' WHERE id = (SELECT id FROM apd.solicitud WHERE folio = 'APD-S-2026-00021');`, 'admin'],
  ['Con la asistencia mínima no se marca «sin derecho a examen»', { codigo: 'con_derecho_examen' }, '2026-10-16 10:00', `
     ${ASISTE21}
     UPDATE apd.solicitud SET estado = 'sin_derecho_examen' WHERE id = (SELECT id FROM apd.solicitud WHERE folio = 'APD-S-2026-00021');`],
  ['Sin acreditación emitida la solicitud no queda como acreditada', { codigo: 'sin_acreditacion' }, null, `
     UPDATE apd.solicitud SET estado = 'acreditada' WHERE id = (SELECT id FROM apd.solicitud WHERE estado = 'aprobada' ORDER BY folio LIMIT 1);`],
  ['La acreditación corresponde a la persona de la solicitud', { codigo: 'acreditacion_no_corresponde' }, '2026-10-16 10:00', `
     INSERT INTO apd.acreditacion (solicitante_id, tipo_acreditacion, solicitud_id)
     SELECT ${SIN_ACRED}, 'poda', id FROM apd.solicitud WHERE estado = 'aprobada' ORDER BY folio LIMIT 1;`],
  ['La acreditación se emite con la fecha del día', { codigo: 'emision_con_otra_fecha' }, '2026-10-16 10:00', `
     INSERT INTO apd.acreditacion (solicitante_id, tipo_acreditacion, solicitud_id, emitida_en)
     SELECT solicitante_id, 'poda', id, '2026-01-01' FROM apd.solicitud WHERE estado = 'aprobada' ORDER BY folio LIMIT 1;`],
  ['La entrega no se registra al emitir', { codigo: 'entrega_al_emitir' }, '2026-10-16 10:00', `
     INSERT INTO apd.acreditacion (solicitante_id, tipo_acreditacion, solicitud_id, entregada_en)
     SELECT solicitante_id, 'poda', id, '2026-10-16' FROM apd.solicitud WHERE estado = 'aprobada' ORDER BY folio LIMIT 1;`],
  ['La entrega no se registra con fecha futura', { codigo: 'entrega_futura' }, null, `
     UPDATE apd.acreditacion SET entregada_en = apd.hoy() + 5 WHERE origen = 'sistema' AND entregada_en IS NULL AND numero LIKE 'PD-2026-%';`],
  ['Un curso inactivo no abre grupos', { codigo: 'curso_inactivo' }, null, `
     UPDATE apd.curso SET activo = false WHERE tipo_acreditacion = 'poda' AND modalidad = 'nueva';
     INSERT INTO apd.grupo (tipo_acreditacion, modalidad, integracion) VALUES ('poda', 'nueva', 'combinado');`],
  ['Un grupo nuevo nace en integración', { codigo: 'alta_fuera_de_integracion' }, null, `
     INSERT INTO apd.grupo (tipo_acreditacion, modalidad, integracion, estado) VALUES ('poda', 'nueva', 'combinado', 'confirmado');`],
  ['Un grupo confirmado siempre tiene instructor', { codigo: 'sin_instructor' }, null, `
     UPDATE apd.grupo SET instructor = NULL WHERE id = ${GRUPO_EN_CURSO};`],
  ['El curso no empieza antes de su primer día', { codigo: 'antes_de_inicio' }, '2026-10-14 10:00', `
     INSERT INTO apd.inscripcion (solicitud_id, grupo_id) SELECT id, ${G5} FROM apd.solicitud
      WHERE folio IN ('APD-S-2026-00037', 'APD-S-2026-00038', 'APD-S-2026-00031', 'APD-S-2026-00036');
     UPDATE apd.grupo SET estado = 'confirmado' WHERE id = ${G5};
     UPDATE apd.grupo SET estado = 'en_curso' WHERE id = ${G5};`],
  ['Sólo se agregan solicitudes en espera de grupo', { codigo: 'solicitud_no_lista' }, null, `
     INSERT INTO apd.inscripcion (solicitud_id, grupo_id) VALUES (${BORRADOR}, ${GRUPO_INTEGRACION});`],
  ['La asistencia se captura mientras el curso está en marcha', { codigo: 'grupo_no_en_curso' }, '2026-10-14 10:00', `
     INSERT INTO apd.asistencia (inscripcion_id, dia, asistio, capturada_por)
     SELECT id, 1, true, 'x' FROM apd.inscripcion WHERE grupo_id = ${G5} AND activa LIMIT 1;`],
  ['No se captura asistencia de un día que el curso no tiene', { codigo: 'dia_inexistente' }, '2026-10-20 10:00', `
     INSERT INTO apd.asistencia (inscripcion_id, dia, asistio, capturada_por) VALUES (${INS21}, 6, true, 'x');`],
  ['Ese documento no se pide para ese curso', { codigo: 'requisito_ajeno' }, null, DOC_PEQUENO(BORRADOR, 'comprobante_estudios')],
  ['Una carga sustituida no se revisa', { codigo: 'documento_sustituido' }, null, `
     UPDATE apd.documento SET estado = 'aceptado', revisado_por = 'prueba.automatica'
      WHERE ctid = (SELECT ctid FROM apd.documento WHERE NOT vigente ORDER BY cargado_en LIMIT 1);`],
  ['Una fotografía sustituida no vuelve a ser la vigente', { codigo: 'foto_inmutable' }, null, `
     SELECT set_config('apd.usuario_tipo', 'solicitante', true);
     ${FOTO(COTEJO_PERSONA)}
     UPDATE apd.fotografia SET vigente = true WHERE solicitante_id = ${COTEJO_PERSONA} AND NOT vigente;`],
  ['Sólo se confirma la fotografía vigente', { codigo: 'foto_sustituida' }, null, `
     SELECT set_config('apd.usuario_tipo', 'solicitante', true);
     ${FOTO(COTEJO_PERSONA)}
     SELECT set_config('apd.usuario_tipo', 'personal', true);
     UPDATE apd.fotografia SET estado = 'confirmada' WHERE solicitante_id = ${COTEJO_PERSONA} AND NOT vigente AND estado = 'pendiente';`],
  ['Una institución necesita nombre', { codigo: 'organizacion_sin_nombre' }, null, `
     INSERT INTO apd.organizacion (tipo, nombre) VALUES ('privada', ' ... ');`],
  ['Una carrera necesita nombre', { codigo: 'carrera_sin_nombre' }, null, `
     INSERT INTO apd.carrera (nombre) VALUES (' -- ');`],
  ['Un parámetro que falta da su propio error', { codigo: 'parametro_inexistente' }, null, `
     SELECT apd.parametro_texto('no_existe');`],

  // ── A1-01 · La base rechaza lo mismo que el formulario (además del cruce de abajo) ──
  ['CURP con fecha imposible: la base la rechaza (A1-01)', { sqlstate: '23514' }, null, `
     SELECT set_config('apd.motivo', 'Prueba', true);
     UPDATE apd.solicitante SET curp = ${q(curpCon('EEMJ761307HNEJSN0'))} WHERE id = ${ACTIVA};`],
  ['CURP con nacimiento en el futuro: la base la rechaza (A1-01)', { sqlstate: '23514' }, null, `
     INSERT INTO apd.solicitante (curp, nombre, primer_apellido, correo, telefono, adscripcion, contrasena_hash, es_ficticio)
     VALUES (${q(curpCon('EEMJ300707HNEJSNA'))}, 'Caso', 'Prueba', 'caso@ejemplo.local', '0000000099', 'independiente', 'x', true);`],
  ['Correo de más de 120 caracteres: la base lo rechaza (A1-01)', { sqlstate: '23514' }, null, `
     UPDATE apd.solicitante SET correo = repeat('a', 120) || '@ejemplo.mx' WHERE id = ${ACTIVA};`],
  ['Correo con terminación de una letra: la base lo rechaza (A1-01)', { sqlstate: '23514' }, null, `
     UPDATE apd.solicitante SET correo = 'persona@ejemplo.c' WHERE id = ${ACTIVA};`],
  ['RFC con fecha imposible: la base lo rechaza (A1-01)', { sqlstate: '23514' }, null, `
     UPDATE apd.solicitud SET factura_rfc = 'EJE011310AB1' WHERE id = ${CITA_SOL};`],
  ['RFC con Ñ: la base lo conserva (P129)', 'ok', null, `
     UPDATE apd.solicitud SET factura_rfc = 'ÑEJE010110AB1' WHERE id = ${CITA_SOL};
     DO $$ BEGIN ASSERT (SELECT factura_rfc FROM apd.solicitud WHERE factura_rfc LIKE 'Ñ%') = 'ÑEJE010110AB1'; END $$;`],

  // ── Sesión de trabajo del 23/10/2026 (parte A) ──
  // Mayoría de edad (P138): 18 años cumplidos el día de la solicitud, con la fecha de nacimiento de la CURP
  ['Mayoría de edad: quien cumple 18 años mañana no solicita hoy (P138)', { codigo: 'menor_de_edad' }, '2026-10-14 10:00', `
     INSERT INTO apd.solicitante (id, curp, nombre, primer_apellido, correo, telefono, adscripcion, contrasena_hash, es_ficticio)
     VALUES ('00000000-0000-4000-a000-000000000231', ${q(curpCon('EEMJ081015HNEJSNA'))}, 'Caso', 'Prueba', 'caso@ejemplo.local', '0000000099', 'independiente', 'x', true);
     INSERT INTO apd.solicitud (solicitante_id, tipo_acreditacion, modalidad, nivel_estudios)
     VALUES ('00000000-0000-4000-a000-000000000231', 'poda', 'nueva', 'preparatoria');`],
  ['Mayoría de edad: quien cumple 18 años hoy sí solicita (P138)', 'ok', '2026-10-14 10:00', `
     INSERT INTO apd.solicitante (id, curp, nombre, primer_apellido, correo, telefono, adscripcion, contrasena_hash, es_ficticio)
     VALUES ('00000000-0000-4000-a000-000000000232', ${q(curpCon('EEMJ081014HNEJSNA'))}, 'Caso', 'Prueba', 'caso@ejemplo.local', '0000000099', 'independiente', 'x', true);
     INSERT INTO apd.solicitud (solicitante_id, tipo_acreditacion, modalidad, nivel_estudios)
     VALUES ('00000000-0000-4000-a000-000000000232', 'poda', 'nueva', 'preparatoria');
     DO $$ BEGIN ASSERT apd.curp_nacimiento(${q(curpCon('EEMJ081014HNEJSNA'))}) = '2008-10-14';
       ASSERT apd.curp_nacimiento(${q(curpCon('EEMJ760707HNEJSN0'))}) = '1976-07-07'; END $$;`],
  ['Todas las personas ficticias son mayores de edad (P138)', 'ok', null, `DO $$ BEGIN
     ASSERT NOT EXISTS (SELECT 1 FROM apd.solicitante WHERE (apd.curp_nacimiento(curp) + interval '18 years')::date > apd.hoy()); END $$;`],
  // Dictaminador por primera vez: la poda durante al menos 2 años consecutivos
  ['Dictaminador: con la poda 2 años o más sin corte, se solicita (sesión del 23/10)', 'ok', '2026-10-14 10:00', `
     INSERT INTO apd.solicitud (solicitante_id, tipo_acreditacion, modalidad, nivel_estudios, carrera, estatus_estudios, anios_experiencia)
     VALUES ((SELECT solicitante_id FROM apd.acreditacion WHERE tipo_acreditacion = 'poda' AND emitida_en = '2024-06-01'), 'dictaminador', 'nueva', 'licenciatura', 'Biología', 'titulado', 3);
     DO $$ BEGIN ASSERT apd.poda_continua_desde((SELECT solicitante_id FROM apd.acreditacion WHERE tipo_acreditacion = 'poda' AND emitida_en = '2024-06-01')) = '2024-06-01'; END $$;`],
  ['Dictaminador: con la poda desde hace menos de 2 años no se solicita (sesión del 23/10)', { codigo: 'poda_menos_de_dos_anios' }, '2026-10-14 10:00', `
     INSERT INTO apd.solicitud (solicitante_id, tipo_acreditacion, modalidad, nivel_estudios, carrera, estatus_estudios, anios_experiencia)
     VALUES ((SELECT solicitante_id FROM apd.acreditacion WHERE origen = 'sistema' AND emitida_en = '2026-09-15' ORDER BY numero LIMIT 1), 'dictaminador', 'nueva', 'licenciatura', 'Biología', 'titulado', 3);`],
  ['Dictaminador: un corte (renovó fuera de la ventana) vuelve a empezar la cuenta (sesión del 23/10)', { codigo: 'poda_menos_de_dos_anios' }, '2026-10-14 10:00', `
     DO $$ BEGIN ASSERT apd.poda_continua_desde((SELECT solicitante_id FROM apd.acreditacion WHERE emitida_en = '2023-03-06')) = '2025-05-05'; END $$;
     INSERT INTO apd.solicitud (solicitante_id, tipo_acreditacion, modalidad, nivel_estudios, carrera, estatus_estudios, anios_experiencia)
     VALUES ((SELECT solicitante_id FROM apd.acreditacion WHERE emitida_en = '2023-03-06'), 'dictaminador', 'nueva', 'licenciatura', 'Biología', 'titulado', 3);`],
  ['Dictaminador: renovar dentro de la ventana de renovación tardía no corta la cuenta (sesión del 23/10)', 'ok', '2026-10-14 10:00', `
     SELECT set_config('apd.usuario_tipo', 'migracion', true);
     CREATE TEMP TABLE p AS SELECT ${SIN_ACRED} AS id;
     INSERT INTO apd.acreditacion (numero, solicitante_id, tipo_acreditacion, emitida_en, origen)
     VALUES ('PD-2023-K950', (SELECT id FROM p), 'poda', '2023-09-04', 'kobo'), ('PD-2025-K951', (SELECT id FROM p), 'poda', '2025-08-25', 'kobo'),
            ('PD-2026-K952', (SELECT id FROM p), 'poda', '2026-08-24', 'kobo');
     DO $$ BEGIN ASSERT apd.poda_continua_desde((SELECT id FROM p)) = '2023-09-04';
       ASSERT apd.poda_continua_desde((SELECT id FROM p), '2025-08-20') IS NULL; END $$;`],
  // En poda no se pregunta la situación de la licenciatura: la base no la guarda; en dictaminador sigue
  ['Poda: la situación de la licenciatura no se guarda ni se pide (sesión del 23/10)', 'ok', null, `
     INSERT INTO apd.solicitante (id, curp, nombre, primer_apellido, correo, telefono, adscripcion, contrasena_hash, es_ficticio)
     VALUES ('00000000-0000-4000-a000-000000000233', 'XAXX991231HNEXXX09', 'Caso', 'Prueba', 'caso@ejemplo.local', '0000000099', 'independiente', 'x', true);
     INSERT INTO apd.solicitud (id, solicitante_id, tipo_acreditacion, modalidad, nivel_estudios, carrera, estatus_estudios)
     VALUES ('00000000-0000-4000-a000-000000000234', '00000000-0000-4000-a000-000000000233', 'poda', 'nueva', 'licenciatura', 'Arquitectura de Paisaje', 'trunco');
     DO $$ BEGIN ASSERT (SELECT estatus_estudios IS NULL AND carrera = 'Arquitectura de Paisaje' FROM apd.solicitud WHERE id = '00000000-0000-4000-a000-000000000234');
       ASSERT NOT EXISTS (SELECT 1 FROM apd.solicitud WHERE tipo_acreditacion = 'poda' AND estatus_estudios IS NOT NULL); END $$;
     INSERT INTO apd.documento (solicitud_id, requisito, archivo_clave, nombre_original, tipo_mime, tamano_bytes, sha256)
     SELECT '00000000-0000-4000-a000-000000000234', rc.requisito, 'prueba/' || gen_random_uuid(), 'x.pdf', 'application/pdf', 1000, repeat('a', 64)
       FROM apd.requisito_curso rc JOIN apd.requisito r ON r.clave = rc.requisito
      WHERE rc.tipo_acreditacion = 'poda' AND rc.modalidad = 'nueva' AND rc.obligatorio AND r.forma = 'documento' AND r.momento = 'en_linea';
     ${FOTO("'00000000-0000-4000-a000-000000000233'")}
     SELECT set_config('apd.usuario_tipo', 'solicitante', true);
     UPDATE apd.solicitud SET estado = 'enviada' WHERE id = '00000000-0000-4000-a000-000000000234';`],
  // Fines de semana (P150, P151): ni cursos ni citas en sábado o domingo; plazos en días hábiles
  ['Curso de 5 días que empieza en martes (cae en sábado) se rechaza (P151)', { codigo: 'curso_en_fin_de_semana' }, '2026-10-14 10:00', `
     UPDATE apd.grupo SET fecha_inicio = '2026-10-27' WHERE id = ${GRUPO_INTEGRACION};`],
  ['Curso de 5 días que empieza en lunes se acepta; el de renovación (1 día), cualquier día de lunes a viernes (P151)', 'ok', '2026-10-14 10:00', `
     UPDATE apd.grupo SET fecha_inicio = '2026-11-02' WHERE id = ${GRUPO_INTEGRACION};
     INSERT INTO apd.grupo (tipo_acreditacion, modalidad, integracion, fecha_inicio) VALUES ('poda', 'renovacion', 'combinado', '2026-11-04');`],
  ['Curso de renovación en sábado se rechaza (P151)', { codigo: 'curso_en_fin_de_semana' }, '2026-10-14 10:00', `
     INSERT INTO apd.grupo (tipo_acreditacion, modalidad, integracion, fecha_inicio) VALUES ('poda', 'renovacion', 'combinado', '2026-11-07');`],
  ['Hora de entrada fuera del horario del curso (9:00 a 15:00) se rechaza (P91)', { codigo: 'hora_fuera_de_horario' }, '2026-10-14 10:00', `
     UPDATE apd.grupo SET fecha_inicio = '2026-11-02', hora_entrada = '08:00' WHERE id = ${GRUPO_INTEGRACION};`],
  ['Cita de cotejo en sábado se rechaza (P150)', { codigo: 'cita_en_fin_de_semana' }, null, `
     UPDATE apd.solicitud SET cita_en = '2026-10-24 10:00-06' WHERE id = ${ENVIADA};`],
  ['Cita de cotejo a las 15:00 se rechaza: son de 9:30 a 14:30 (P69)', { codigo: 'cita_fuera_de_horario' }, null, `
     UPDATE apd.solicitud SET cita_en = '2026-10-23 15:00-06' WHERE id = ${ENVIADA};`],
  ['Cita de cotejo a las 9:30 y a las 14:30 de un viernes se aceptan (P69)', 'ok', null, `
     UPDATE apd.solicitud SET cita_en = '2026-10-23 09:30-06' WHERE id = ${ENVIADA};
     UPDATE apd.solicitud SET cita_en = '2026-10-23 14:30-06' WHERE id = ${ENVIADA};`],
  ['Plazos en días hábiles: no cuentan sábados ni domingos (P150)', 'ok', null, `DO $$ BEGIN
     ASSERT apd.suma_dias_habiles('2026-10-14', 10) = '2026-10-28';
     ASSERT apd.suma_dias_habiles('2026-10-16', 1) = '2026-10-19';
     ASSERT apd.dias_habiles_entre('2026-10-16', '2026-10-19') = 1;
     ASSERT NOT EXISTS (SELECT 1 FROM apd.grupo g JOIN apd.curso c USING (tipo_acreditacion, modalidad), generate_series(g.fecha_inicio, g.fecha_inicio + c.dias_duracion - 1, interval '1 day') d
                         WHERE g.fecha_inicio IS NOT NULL AND NOT apd.es_habil(d::date));
     ASSERT NOT EXISTS (SELECT 1 FROM apd.cita WHERE NOT apd.es_habil((programada_en AT TIME ZONE 'America/Mexico_City')::date)); END $$;`],
  // Grupos al mismo tiempo (P149): como máximo 2, de cualquier curso
  ['Un segundo grupo en la misma semana se acepta; un tercero no (P149)', { codigo: 'grupos_simultaneos' }, '2026-10-14 10:00', `
     INSERT INTO apd.grupo (tipo_acreditacion, modalidad, integracion, fecha_inicio) VALUES ('dictaminador', 'nueva', 'combinado', '2026-10-26');
     INSERT INTO apd.grupo (tipo_acreditacion, modalidad, integracion, fecha_inicio) VALUES ('poda', 'renovacion', 'combinado', '2026-10-28');`],
  ['Dos grupos al mismo tiempo sí, y uno que no se encima con los dos también (P149)', 'ok', '2026-10-14 10:00', `
     INSERT INTO apd.grupo (tipo_acreditacion, modalidad, integracion, fecha_inicio) VALUES ('poda', 'renovacion', 'combinado', '2026-10-28');
     INSERT INTO apd.grupo (tipo_acreditacion, modalidad, integracion, fecha_inicio) VALUES ('poda', 'renovacion', 'combinado', '2026-11-03');
     DO $$ BEGIN ASSERT (SELECT valor FROM apd.parametro WHERE clave = 'grupos_simultaneos_maximo') = '2'; END $$;`],
  // Espera de grupo: 15 días (P143) y bloques sólo de gobierno local y federal
  ['La espera es prioritaria desde 15 días (P143)', 'ok', null, `DO $$ BEGIN
     ASSERT (SELECT valor FROM apd.parametro WHERE clave = 'dias_alerta_espera') = '15';
     ASSERT NOT EXISTS (SELECT 1 FROM apd.bandeja_demanda WHERE prioridad <> (dias_espera >= 15)); END $$;`],
  ['En la espera sólo se agrupan en bloque las instituciones de gobierno local y federal (sesión del 23/10)', 'ok', null, `DO $$ BEGIN
     ASSERT EXISTS (SELECT 1 FROM apd.bandeja_demanda WHERE organizacion_tipo = 'privada');
     ASSERT NOT EXISTS (SELECT 1 FROM apd.bandeja_demanda WHERE organizacion_tipo NOT IN ('dependencia_cdmx', 'alcaldia', 'dependencia_federal') AND bloque IS NOT NULL);
     ASSERT NOT EXISTS (SELECT 1 FROM apd.bandeja_demanda WHERE organizacion_tipo IN ('dependencia_cdmx', 'alcaldia', 'dependencia_federal') AND bloque IS DISTINCT FROM organizacion_id);
     ASSERT apd.es_gobierno('alcaldia') AND apd.es_gobierno('dependencia_federal') AND apd.es_gobierno('dependencia_cdmx');
     ASSERT NOT apd.es_gobierno('privada') AND NOT apd.es_gobierno('educativa') AND NOT apd.es_gobierno(NULL); END $$;`],
  // Catálogo
  ['La Universidad Autónoma Chapingo está en las instituciones educativas (sesión del 23/10)', 'ok', null, `DO $$ BEGIN
     ASSERT (SELECT tipo FROM apd.organizacion WHERE clave = 'chapingo' AND activa) = 'educativa'; END $$;`],
  ['Constancia de situación fiscal de la persona solicitante y comprobante de domicilio sin marca de provisional (P196, P03)', 'ok', null, `DO $$ BEGIN
     ASSERT (SELECT nombre FROM apd.requisito WHERE clave = 'constancia_situacion_fiscal') = 'Constancia de situación fiscal';
     ASSERT (SELECT descripcion LIKE 'Tuya, como persona solicitante%régimen%domicilio fiscal%[pendiente P196%' FROM apd.requisito WHERE clave = 'constancia_situacion_fiscal');
     ASSERT (SELECT descripcion NOT LIKE '%pendiente%' AND activo FROM apd.requisito WHERE clave = 'comprobante_domicilio');
     ASSERT (SELECT bool_and(obligatorio) FROM apd.requisito_curso WHERE requisito = 'comprobante_domicilio' AND modalidad = 'nueva'); END $$;`],
  // Montos (P16): cada concepto con su monto, su publicación y su fecha de inicio, editable sin programar
  ['Cada curso tiene su monto con la publicación que lo fija y desde cuándo aplica (P16)', 'ok', null, `DO $$ BEGIN
     ASSERT (SELECT count(*) FROM apd.curso WHERE pago_monto > 0 AND coalesce(trim(pago_fundamento), '') <> '' AND pago_vigente_desde IS NOT NULL) = 4; END $$;`],

  // ── Cancelación de una acreditación (P120, sesión de trabajo del 23/10/2026): instructores y directivos, con motivo y
  //    fundamento; una cancelada no es vigente, no se renueva ni sirve de requisito ──
  ['Cancelación: un instructor cancela una acreditación vigente con motivo y fundamento; la base pone quién y cuándo, y queda en la bitácora (P120)', 'ok', '2026-10-14 12:00', `
     ${PERFIL('instructor')} ${B0}
     UPDATE apd.acreditacion SET cancelacion_motivo = '  Motivo de la prueba automática.  ', cancelacion_fundamento = '[Art. __, fracc. __]' WHERE id = ${ACRED_VIGENTE};
     DO $$ BEGIN
       ASSERT (SELECT cancelada_por = 'prueba.automatica' AND cancelada_en = '2026-10-14 12:00-06' AND cancelacion_motivo = 'Motivo de la prueba automática.'
                 FROM apd.acreditacion WHERE id = ${ACRED_VIGENTE});
       ASSERT apd.estado_acreditacion(${ACRED_VIGENTE}) = 'cancelada' AND NOT apd.acreditacion_vigente(${ACRED_VIGENTE});
       ASSERT apd.acreditacion_vigente(${ACRED_VIGENTE}, '2026-10-13') AND apd.estado_acreditacion(${ACRED_VIGENTE}, '2026-10-13') = 'vigente';
     END $$; ${MAS(1, 'cancelacion')}`],
  ['Cancelación: la Dirección (perfil administración) también cancela (P120)', 'ok', '2026-10-14 12:00', `
     ${PERFIL('administracion')}
     UPDATE apd.acreditacion SET cancelacion_motivo = 'Motivo de la prueba automática.', cancelacion_fundamento = '[Art. __, fracc. __]' WHERE id = ${ACRED_VIGENTE};`],
  ['Cancelación: un perfil sin permiso (revisión y cotejo) no cancela (P120, P27)', { codigo: 'cancelacion_sin_permiso' }, '2026-10-14 12:00', `
     ${PERFIL('revision_cotejo')}
     UPDATE apd.acreditacion SET cancelacion_motivo = 'Motivo de la prueba automática.', cancelacion_fundamento = '[Art. __, fracc. __]' WHERE id = ${ACRED_VIGENTE};`],
  ['Cancelación: el personal sin perfil declarado no cancela (P120)', { codigo: 'cancelacion_sin_permiso' }, '2026-10-14 12:00', `
     UPDATE apd.acreditacion SET cancelacion_motivo = 'Motivo de la prueba automática.', cancelacion_fundamento = '[Art. __, fracc. __]' WHERE id = ${ACRED_VIGENTE};`],
  ['Cancelación: la persona solicitante no cancela, aunque declare un perfil (P120)', { codigo: 'cancelacion_sin_permiso' }, '2026-10-14 12:00', `
     ${COMO('solicitante', 'persona@ejemplo.local')} ${PERFIL('instructor')}
     UPDATE apd.acreditacion SET cancelacion_motivo = 'Motivo de la prueba automática.', cancelacion_fundamento = '[Art. __, fracc. __]' WHERE id = ${ACRED_VIGENTE};`],
  ['Cancelación sin motivo (menos de 10 caracteres) se rechaza (P120)', { codigo: 'cancelacion_sin_motivo' }, '2026-10-14 12:00', `
     ${PERFIL('instructor')}
     UPDATE apd.acreditacion SET cancelacion_motivo = 'Corto', cancelacion_fundamento = '[Art. __, fracc. __]' WHERE id = ${ACRED_VIGENTE};`],
  ['Cancelación sin fundamento se rechaza (P120)', { codigo: 'cancelacion_sin_fundamento' }, '2026-10-14 12:00', `
     ${PERFIL('instructor')}
     UPDATE apd.acreditacion SET cancelacion_motivo = 'Motivo de la prueba automática.', cancelacion_fundamento = '  ' WHERE id = ${ACRED_VIGENTE};`],
  ['Cancelación de una acreditación vencida se rechaza: sólo se cancela una vigente (P120)', { codigo: 'cancelacion_no_vigente' }, '2026-10-14 12:00', `
     ${PERFIL('instructor')}
     UPDATE apd.acreditacion SET cancelacion_motivo = 'Motivo de la prueba automática.', cancelacion_fundamento = '[Art. __, fracc. __]' WHERE id = ${ACRED_NO_RENOVABLE};`],
  ['Una cancelación no se cambia ni se deshace (P120)', { codigo: 'acreditacion_ya_cancelada' }, '2026-10-14 12:00', `
     ${PERFIL('administracion')}
     UPDATE apd.acreditacion SET cancelacion_motivo = NULL, cancelacion_fundamento = NULL WHERE id = ${ACRED_CANCELADA};`],
  ['La fecha y quién canceló no los escribe la cuenta del servicio (P120)', { sqlstate: '42501' }, null, `
     UPDATE apd.acreditacion SET cancelada_en = now(), cancelada_por = 'otra' WHERE id = ${ACRED_VIGENTE};`],
  ['La ficticia cancelada: «Verificar» dice «Cancelada» con su día y sin el motivo ni el fundamento (P120)', 'ok', '2026-10-14 12:00', `DO $$ BEGIN
     ASSERT (SELECT situacion = 'Cancelada' AND cancelada_el = '2026-10-08' FROM apd.verificacion_publica WHERE numero = (SELECT numero FROM apd.acreditacion WHERE id = ${ACRED_CANCELADA}));
     ASSERT NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'apd' AND table_name = 'verificacion_publica'
                         AND (column_name LIKE '%motivo%' OR column_name LIKE '%fundamento%' OR column_name LIKE '%por'));
     ASSERT (SELECT count(*) FROM apd.verificacion_publica WHERE situacion = 'Cancelada') = (SELECT count(*) FROM apd.acreditacion WHERE cancelada_en IS NOT NULL);
     ASSERT (SELECT cancelada_por = 'instructor.ficticio' FROM apd.acreditacion WHERE id = ${ACRED_CANCELADA}); END $$;`],
  ['No se renueva una cancelada, aunque esté en su ventana de renovación (P120)', { codigo: 'renovacion_cancelada' }, '2026-10-14 12:00', `
     ${COMO('solicitante', 'persona@ejemplo.local')}
     INSERT INTO apd.solicitud (solicitante_id, tipo_acreditacion, modalidad, acreditacion_anterior_id)
     VALUES ((SELECT solicitante_id FROM apd.acreditacion WHERE id = ${ACRED_CANCELADA}), 'poda', 'renovacion', ${ACRED_CANCELADA});`],
  ['Una cancelada no impide una solicitud nueva (si y cuándo puede volver a pedirla lo fija la Dirección Jurídica, P120)', 'ok', '2026-10-14 12:00', `
     ${COMO('solicitante', 'persona@ejemplo.local')}
     INSERT INTO apd.solicitud (solicitante_id, tipo_acreditacion, modalidad, nivel_estudios)
     VALUES ((SELECT solicitante_id FROM apd.acreditacion WHERE id = ${ACRED_CANCELADA}), 'poda', 'nueva', 'preparatoria');`],
  ['Una poda cancelada no sirve de requisito para la de dictaminador (P120)', { codigo: 'sin_poda_vigente' }, '2026-10-14 12:00', `
     ${COMO('solicitante', 'persona@ejemplo.local')}
     INSERT INTO apd.solicitud (solicitante_id, tipo_acreditacion, modalidad, nivel_estudios)
     VALUES ((SELECT solicitante_id FROM apd.acreditacion WHERE id = ${ACRED_CANCELADA}), 'dictaminador', 'nueva', 'licenciatura');`],
  ['Una cancelada corta la cuenta de los dos años de poda para pedir la de dictaminador (P120, sesión del 23/10)', 'ok', '2026-10-14 12:00', `
     CREATE TEMP TABLE p AS SELECT solicitante_id AS id FROM apd.acreditacion WHERE tipo_acreditacion = 'poda' AND emitida_en = '2025-05-18' ORDER BY numero LIMIT 1;
     DO $$ BEGIN ASSERT apd.poda_continua_desde((SELECT id FROM p)) = '2024-05-18'; END $$;
     -- La del 18/05/2025 se cancela mientras estaba vigente (01/06/2025); la de 2026 sigue vigente
     SELECT set_config('apd.ahora_simulado', '2025-06-01 10:00-06', true); ${PERFIL('instructor')}
     UPDATE apd.acreditacion SET cancelacion_motivo = 'Motivo de la prueba automática.', cancelacion_fundamento = '[Art. __, fracc. __]'
      WHERE solicitante_id = (SELECT id FROM p) AND emitida_en = '2025-05-18';
     SELECT set_config('apd.ahora_simulado', '2026-10-14 12:00-06', true);
     DO $$ BEGIN
       ASSERT apd.poda_vigente((SELECT id FROM p));
       ASSERT apd.poda_continua_desde((SELECT id FROM p)) = '2026-05-18';
       ASSERT apd.poda_continua_desde((SELECT id FROM p), '2025-05-20') = '2024-05-18'; END $$;`],
  ['Con una cancelada en la cadena, la de dictaminador no se pide hasta juntar dos años después de ella (P120, sesión del 23/10)', { codigo: 'poda_menos_de_dos_anios' }, '2026-10-14 12:00', `
     CREATE TEMP TABLE p AS SELECT solicitante_id AS id FROM apd.acreditacion WHERE tipo_acreditacion = 'poda' AND emitida_en = '2026-06-01' ORDER BY numero LIMIT 1;
     SELECT set_config('apd.ahora_simulado', '2025-07-01 10:00-06', true); ${PERFIL('instructor')}
     UPDATE apd.acreditacion SET cancelacion_motivo = 'Motivo de la prueba automática.', cancelacion_fundamento = '[Art. __, fracc. __]'
      WHERE solicitante_id = (SELECT id FROM p) AND emitida_en = '2025-06-01';
     SELECT set_config('apd.ahora_simulado', '2026-10-14 12:00-06', true); ${COMO('solicitante', 'persona@ejemplo.local')}
     INSERT INTO apd.solicitud (solicitante_id, tipo_acreditacion, modalidad, nivel_estudios) VALUES ((SELECT id FROM p), 'dictaminador', 'nueva', 'licenciatura');`],
  ['La cancelación cierra la renovación que estaba en trámite, con el motivo (P120)', 'ok', '2026-10-14 12:00', `
     ${PERFIL('instructor')}
     UPDATE apd.acreditacion SET cancelacion_motivo = 'Motivo de la prueba automática.', cancelacion_fundamento = '[Art. __, fracc. __]' WHERE id = ${ACRED_POR_VENCER};
     DO $$ BEGIN
       ASSERT (SELECT bool_and(estado = 'cancelada' AND motivo_cierre LIKE '%que se renovaba fue cancelada.') FROM apd.solicitud WHERE acreditacion_anterior_id = ${ACRED_POR_VENCER});
       ASSERT EXISTS (SELECT 1 FROM apd.solicitud WHERE acreditacion_anterior_id = ${ACRED_POR_VENCER}); END $$;`],
  ['No se emite la renovación aprobada de una acreditación que se canceló (P120)', { codigo: 'renovacion_de_cancelada' }, '2026-10-14 12:00', `
     SET LOCAL session_replication_role = replica;
     UPDATE apd.solicitud SET estado = 'aprobada' WHERE id = (SELECT id FROM apd.solicitud WHERE modalidad = 'renovacion' AND estado = 'lista_para_curso' AND tipo_acreditacion = 'dictaminador' ORDER BY folio LIMIT 1);
     UPDATE apd.acreditacion SET cancelada_en = now(), cancelada_por = 'x', cancelacion_motivo = 'Motivo de la prueba.', cancelacion_fundamento = 'x'
      WHERE id = (SELECT acreditacion_anterior_id FROM apd.solicitud WHERE modalidad = 'renovacion' AND estado = 'aprobada' AND tipo_acreditacion = 'dictaminador');
     SET LOCAL session_replication_role = origin;
     INSERT INTO apd.acreditacion (solicitante_id, tipo_acreditacion, solicitud_id)
     SELECT solicitante_id, 'dictaminador', id FROM apd.solicitud WHERE modalidad = 'renovacion' AND estado = 'aprobada' AND tipo_acreditacion = 'dictaminador';`, 'admin'],
  ['Una acreditación cancelada no se entrega (P120)', { codigo: 'entrega_de_cancelada' }, '2026-10-14 12:00', `
     CREATE TEMP TABLE a AS SELECT id FROM apd.acreditacion WHERE origen = 'sistema' AND entregada_en IS NULL ORDER BY numero LIMIT 1;
     ${PERFIL('instructor')}
     UPDATE apd.acreditacion SET cancelacion_motivo = 'Motivo de la prueba automática.', cancelacion_fundamento = '[Art. __, fracc. __]' WHERE id = (SELECT id FROM a);
     ${FOTO_DOC(`(SELECT solicitud_id FROM apd.acreditacion WHERE id = (SELECT id FROM a))`)}
     UPDATE apd.acreditacion SET entregada_en = '2026-10-14' WHERE id = (SELECT id FROM a);`],
  ['Pueden cancelar los perfiles instructor y administración (parámetro editable, P120)', 'ok', null, `DO $$ BEGIN
     ASSERT (SELECT valor FROM apd.parametro WHERE clave = 'perfiles_cancelan_acreditacion') = 'instructor,administracion'; END $$;`],

  // ── Reposición de la credencial (P140, sesión de trabajo del 23/10/2026) ──
  ['Reposición: la persona pide la de su credencial vigente con el acta; la base pone el estado, el nombre del acta y la bitácora (P140)', 'ok', '2026-10-14 12:00', `
     ${COMO('solicitante', 'persona@ejemplo.local')} ${B0}
     ${REPOSICION(ACRED_VIGENTE)}
     DO $$ BEGIN
       ASSERT (SELECT estado = 'solicitada' AND acta_nombre_archivo LIKE 'ACTA DE PERDIDA O ROBO\\_%.pdf' AND solicitada_en = '2026-10-14 12:00-06' AND revisada_por IS NULL
                 FROM apd.reposicion WHERE acreditacion_id = ${ACRED_VIGENTE});
       ASSERT (SELECT count(*) FROM apd.bitacora) = (SELECT n FROM b0) + 1; END $$;`],
  ['Reposición: el personal no la pide por la persona (P140)', { codigo: 'reposicion_de_la_persona' }, '2026-10-14 12:00', REPOSICION(ACRED_VIGENTE)],
  ['Reposición de la credencial de una acreditación cancelada se rechaza (P140)', { codigo: 'reposicion_no_vigente' }, '2026-10-14 12:00', `
     ${COMO('solicitante', 'persona@ejemplo.local')} ${REPOSICION(ACRED_CANCELADA)}`],
  ['Reposición de una credencial del sistema que todavía no se entrega se rechaza (P140)', { codigo: 'reposicion_sin_entrega' }, '2026-10-14 12:00', `
     ${COMO('solicitante', 'persona@ejemplo.local')} ${REPOSICION(`(SELECT id FROM apd.acreditacion WHERE origen = 'sistema' AND entregada_en IS NULL ORDER BY numero LIMIT 1)`)}`],
  ['Reposición: una sola abierta por credencial (P140)', { codigo: 'reposicion_en_curso' }, '2026-10-14 12:00', `
     ${COMO('solicitante', 'persona@ejemplo.local')} ${REPOSICION(REPOS('solicitada'))}`],
  ['Reposición: un acta de más de 5 MB se rechaza (P140)', { codigo: 'archivo_grande' }, '2026-10-14 12:00', `
     ${COMO('solicitante', 'persona@ejemplo.local')} ${REPOSICION(ACRED_VIGENTE, 5242881)}`],
  ['Reposición: el personal acepta el acta y se fija la cuota vigente; un cambio de cuota posterior no la altera (P140)', 'ok', '2026-10-14 12:00', `
     ${PERFIL('revision_cotejo')}
     CREATE TEMP TABLE a AS SELECT ${REPOS('solicitada')} AS id;
     UPDATE apd.reposicion SET estado = 'acta_aceptada' WHERE acreditacion_id = (SELECT id FROM a);
     UPDATE apd.cuota SET monto = 95.00, vigente_desde = '2026-10-14', fundamento = 'Publicación de prueba.' WHERE clave = 'reposicion_credencial';
     DO $$ BEGIN
       ASSERT (SELECT pago_monto = 88.00 AND revisada_por = 'prueba.automatica' AND revisada_en = '2026-10-14 12:00-06' FROM apd.reposicion WHERE acreditacion_id = (SELECT id FROM a));
       ASSERT EXISTS (SELECT 1 FROM apd.bitacora WHERE accion = 'cambio_monto' AND entidad = 'cuota' AND detalle LIKE '88.00 → 95.00%'); END $$;`],
  ['Reposición: la persona no revisa su propia acta (P140)', { codigo: 'reposicion_de_personal' }, '2026-10-14 12:00', `
     ${COMO('solicitante', 'persona@ejemplo.local')}
     UPDATE apd.reposicion SET estado = 'acta_aceptada' WHERE acreditacion_id = ${REPOS('solicitada')};`],
  ['Reposición: observar el acta sin decir qué corregir se rechaza (P140)', { codigo: 'observaciones_vacias' }, '2026-10-14 12:00', `
     UPDATE apd.reposicion SET estado = 'con_observaciones', observacion = 'Corrige' WHERE acreditacion_id = ${REPOS('solicitada')};`],
  ['Reposición: con observaciones, la persona carga otra acta y vuelve a revisión; la bitácora conserva la anterior (P140)', 'ok', '2026-10-14 12:00', `
     ${COMO('solicitante', 'persona@ejemplo.local')}
     CREATE TEMP TABLE antes AS SELECT acta_archivo_clave FROM apd.reposicion WHERE estado = 'con_observaciones';
     UPDATE apd.reposicion SET estado = 'solicitada', motivo = 'robo', acta_archivo_clave = 'prueba/acta-corregida.pdf', acta_nombre_original = 'acta2.pdf', acta_sha256 = repeat('e', 64)
      WHERE estado = 'con_observaciones';
     DO $$ BEGIN
       ASSERT (SELECT observacion = '' FROM apd.reposicion WHERE acta_archivo_clave = 'prueba/acta-corregida.pdf');
       ASSERT EXISTS (SELECT 1 FROM apd.bitacora WHERE accion = 'reposicion' AND detalle LIKE '%con_observaciones → solicitada%en lugar de ' || (SELECT acta_archivo_clave FROM antes) || '%'); END $$;`],
  ['Reposición: volver a revisión sin cargar otra acta se rechaza (P140)', { codigo: 'acta_sin_cambio' }, '2026-10-14 12:00', `
     ${COMO('solicitante', 'persona@ejemplo.local')}
     UPDATE apd.reposicion SET estado = 'solicitada' WHERE estado = 'con_observaciones';`],
  ['Reposición: el acta no se cambia si no tiene observaciones (P140)', { codigo: 'acta_fuera_de_turno' }, '2026-10-14 12:00', `
     ${COMO('solicitante', 'persona@ejemplo.local')}
     UPDATE apd.reposicion SET acta_archivo_clave = 'prueba/otra.pdf' WHERE acreditacion_id = ${REPOS('solicitada')};`],
  ['Reposición: credencial repuesta con la factura; la acreditación conserva número, emisión y vigencia (P140)', 'ok', '2026-10-14 12:00', `
     CREATE TEMP TABLE a0 AS SELECT a.* FROM apd.acreditacion a WHERE id = ${REPOS('acta_aceptada')};
     CREATE TEMP TABLE n0 AS SELECT count(*) AS n FROM apd.acreditacion;
     UPDATE apd.reposicion SET estado = 'repuesta', factura_rfc = 'ejem760707ab1', factura_razon_social = ' PERSONA EJEMPLO ',
       factura_folio_fiscal = 'abcdef01-2345-4678-9abc-def012345678' WHERE estado = 'acta_aceptada';
     DO $$ BEGIN
       ASSERT (SELECT repuesta_en = '2026-10-14' AND repuesta_por = 'prueba.automatica' AND factura_rfc = 'EJEM760707AB1' AND factura_folio_fiscal = 'ABCDEF01-2345-4678-9ABC-DEF012345678'
                 FROM apd.reposicion WHERE acreditacion_id = (SELECT id FROM a0) AND estado = 'repuesta');
       ASSERT (SELECT (a.numero, a.emitida_en, a.vence_en, a.entregada_en, a.solicitud_id) IS NOT DISTINCT FROM (a0.numero, a0.emitida_en, a0.vence_en, a0.entregada_en, a0.solicitud_id)
                 FROM apd.acreditacion a, a0 WHERE a.id = a0.id);
       ASSERT (SELECT count(*) FROM apd.acreditacion) = (SELECT n FROM n0);
       ASSERT apd.estado_acreditacion((SELECT id FROM a0)) = 'vigente';
       ASSERT EXISTS (SELECT 1 FROM apd.bitacora WHERE accion = 'reposicion' AND entidad_id = (SELECT id FROM a0)::text AND detalle LIKE '%mismo número y vigencia'); END $$;`],
  ['Reposición: sin los datos de la factura no se marca repuesta (P140)', { codigo: 'sin_factura' }, '2026-10-14 12:00', `
     UPDATE apd.reposicion SET estado = 'repuesta', factura_rfc = 'EJEM760707AB1' WHERE estado = 'acta_aceptada';`],
  ['Reposición: el folio fiscal de una solicitud no se repite en una reposición (P140)', { codigo: 'folio_fiscal_repetido' }, '2026-10-14 12:00', `
     UPDATE apd.reposicion SET estado = 'repuesta', factura_rfc = 'EJEM760707AB1', factura_razon_social = 'PERSONA EJEMPLO',
       factura_folio_fiscal = (SELECT factura_folio_fiscal FROM apd.solicitud WHERE factura_folio_fiscal IS NOT NULL ORDER BY folio LIMIT 1) WHERE estado = 'acta_aceptada';`],
  ['Reposición: la factura no se captura antes de aceptar el acta (P140)', { codigo: 'factura_fuera_de_turno' }, '2026-10-14 12:00', `
     UPDATE apd.reposicion SET factura_rfc = 'EJEM760707AB1' WHERE acreditacion_id = ${REPOS('solicitada')};`],
  ['Reposición: del acta en revisión no se pasa directo a repuesta (P140)', { codigo: 'transicion_reposicion' }, '2026-10-14 12:00', `
     UPDATE apd.reposicion SET estado = 'repuesta', factura_rfc = 'EJEM760707AB1', factura_razon_social = 'PERSONA EJEMPLO',
       factura_folio_fiscal = 'ABCDEF01-2345-4678-9ABC-DEF012345678' WHERE acreditacion_id = ${REPOS('solicitada')};`],
  ['Reposición: una repuesta ya no cambia de estado (P140)', { codigo: 'transicion_reposicion' }, '2026-10-14 12:00', `
     UPDATE apd.reposicion SET estado = 'cancelada', observacion = 'Motivo de la prueba.' WHERE estado = 'repuesta';`],
  ['Reposición: cancelarla sin decir por qué se rechaza (P140)', { codigo: 'reposicion_sin_motivo' }, '2026-10-14 12:00', `
     ${COMO('solicitante', 'persona@ejemplo.local')}
     UPDATE apd.reposicion SET estado = 'cancelada' WHERE acreditacion_id = ${REPOS('solicitada')};`],
  ['Reposición: el motivo (pérdida o robo) sólo cambia al corregir el acta (P140)', { codigo: 'campo_inmutable' }, '2026-10-14 12:00', `
     UPDATE apd.reposicion SET motivo = 'robo' WHERE acreditacion_id = ${REPOS('solicitada')};`],
  ['Reposición: la acreditación y la fecha de la solicitud no las escribe la cuenta del servicio (P140)', { sqlstate: '42501' }, '2026-10-14 12:00', `
     UPDATE apd.reposicion SET acreditacion_id = ${ACRED_VIGENTE}, solicitada_en = now() WHERE acreditacion_id = ${REPOS('solicitada')};`],
  ['Reposición: nadie la borra (P140)', { sqlstate: '42501' }, null, `DELETE FROM apd.reposicion;`],
  ['Cancelar la acreditación cancela la reposición abierta de su credencial (P120, P140)', 'ok', '2026-10-14 12:00', `
     CREATE TEMP TABLE a AS SELECT ${REPOS('acta_aceptada')} AS id;
     ${PERFIL('instructor')}
     UPDATE apd.acreditacion SET cancelacion_motivo = 'Motivo de la prueba automática.', cancelacion_fundamento = '[Art. __, fracc. __]' WHERE id = (SELECT id FROM a);
     DO $$ BEGIN ASSERT (SELECT estado = 'cancelada' AND observacion = 'La acreditación se canceló.' FROM apd.reposicion WHERE acreditacion_id = (SELECT id FROM a)); END $$;`],
  ['Cuota de reposición: la persona no la cambia (P140)', { codigo: 'cuota_de_personal' }, null, `
     ${COMO('solicitante', 'persona@ejemplo.local')}
     UPDATE apd.cuota SET monto = 1 WHERE clave = 'reposicion_credencial';`],
  ['Cuota de reposición: un monto sin la publicación que lo fija se rechaza (P140)', { sqlstate: '23514' }, null, `
     UPDATE apd.cuota SET monto = 90, fundamento = NULL WHERE clave = 'reposicion_credencial';`],
  ['Cuota de reposición: monto ficticio de $88.00 con su publicación, su fecha y la marca de confirmarlo con Finanzas (P140)', 'ok', null, `DO $$ BEGIN
     ASSERT (SELECT monto = 88.00 AND vigente_desde = '2026-07-01' AND fundamento LIKE '%No. 1548 del 14/02/2025%[pendiente P140%Finanzas]%' FROM apd.cuota WHERE clave = 'reposicion_credencial');
     ASSERT (SELECT array_agg(estado ORDER BY estado) FROM apd.reposicion) = ARRAY['acta_aceptada', 'con_observaciones', 'repuesta', 'solicitada']; END $$;`],

  // ── Registro asistido (decisión 2026-10-25, Liber): la cuenta ──
  ['Registro asistido: el personal de revisión y cotejo registra a la persona activa, sin contraseña ni correo; la base pone quién y cuándo, y la marca del aviso de privacidad queda en la bitácora', 'ok', '2026-10-14 10:00', `
     ${PERFIL('revision_cotejo')} ${LECTURA('aviso_privacidad')} ${B0}
     ${ALTA_ASIS()}
     DO $$ BEGIN
       ASSERT (SELECT estado = 'activa' AND contrasena_hash IS NULL AND correo IS NULL AND telefono = '0000000098' AND activada_en IS NULL
                 AND registro_asistido_por = 'prueba.automatica' AND registro_asistido_en = '2026-10-14 10:00-06' FROM apd.solicitante WHERE id = '${ID_ASIS}');
       ASSERT EXISTS (SELECT 1 FROM apd.bitacora WHERE accion = 'lectura_aviso_privacidad' AND entidad_id = '${ID_ASIS}' AND usuario = 'prueba.automatica'
                        AND fecha = '2026-10-14 10:00-06' AND detalle LIKE '%se le leyó el aviso de privacidad y lo aceptó'); END $$;
     ${MAS(1, 'lectura_aviso_privacidad')}`],
  ['Registro asistido: otro perfil (instructor) no registra cuentas', { codigo: 'registro_asistido_sin_permiso' }, '2026-10-14 10:00', `
     ${PERFIL('instructor')} ${LECTURA('aviso_privacidad')} ${ALTA_ASIS()}`],
  ['Registro asistido: el personal sin perfil declarado no registra cuentas', { codigo: 'registro_asistido_sin_permiso' }, '2026-10-14 10:00', `
     ${LECTURA('aviso_privacidad')} ${ALTA_ASIS()}`],
  ['Registro asistido: sin la marca de que se le leyó el aviso de privacidad no se registra', { codigo: 'sin_lectura' }, '2026-10-14 10:00', `
     ${PERFIL('revision_cotejo')} ${ALTA_ASIS()}`],
  ['Registro asistido: la marca de otra lectura no sirve para registrar', { codigo: 'sin_lectura' }, '2026-10-14 10:00', `
     ${PERFIL('revision_cotejo')} ${LECTURA('lo_capturado')} ${ALTA_ASIS()}`],
  ['Registro asistido: una persona menor de edad según su CURP no se registra', { codigo: 'menor_de_edad' }, '2026-10-14 10:00', `
     ${PERFIL('revision_cotejo')} ${LECTURA('aviso_privacidad')} ${ALTA_ASIS(CURP_MENOR)}`],
  ['Registro asistido: la cuenta queda activa, no bloqueada ni inactiva', { codigo: 'asistida_no_activa' }, '2026-10-14 10:00', `
     ${PERFIL('revision_cotejo')} ${LECTURA('aviso_privacidad')} ${ALTA_ASIS(CURP_ASIS, { estado: 'inactiva' })}`],
  ['Una cuenta activa sin contraseña que no es del registro asistido se sigue rechazando (solicitante_contrasena_ck)', { sqlstate: '23514' }, '2026-10-14 10:00', `
     ${COMO('solicitante', 'persona@ejemplo.local')} ${ALTA_ASIS(CURP_ASIS, { correo: 'caso-asistido@ejemplo.local' })}`],
  ['Una cuenta que no es del registro asistido sigue necesitando correo (solicitante_correo_obligatorio_ck)', { sqlstate: '23514' }, '2026-10-14 10:00', `
     ${COMO('solicitante', 'persona@ejemplo.local')}
     INSERT INTO apd.solicitante (curp, nombre, primer_apellido, correo, telefono, adscripcion, contrasena_hash, es_ficticio)
     VALUES ('${CURP_ASIS}', 'Caso', 'Supuesto', NULL, '0000000098', 'independiente', 'x', true);`],
  ['Registro asistido: el correo es opcional, pero si se da no puede ser el de otra cuenta activa', { codigo: 'correo_registrado' }, '2026-10-14 10:00', `
     ${PERFIL('revision_cotejo')} ${LECTURA('aviso_privacidad')}
     INSERT INTO apd.solicitante (curp, nombre, primer_apellido, correo, telefono, adscripcion, es_ficticio)
     VALUES ('${CURP_ASIS}', 'Caso', 'Supuesto', (SELECT correo FROM apd.solicitante WHERE estado = 'activa' AND correo IS NOT NULL ORDER BY curp LIMIT 1), '0000000098', 'independiente', true);`],
  ['Registro asistido: dos cuentas sin correo no chocan con el índice único del correo', 'ok', '2026-10-14 10:00', `
     ${PERFIL('revision_cotejo')} ${LECTURA('aviso_privacidad')}
     ${ALTA_ASIS()}
     ${ALTA_ASIS(CURP_ASIS2, { id: '00000000-0000-4000-a000-000000000033' })}
     DO $$ BEGIN ASSERT (SELECT count(*) FROM apd.solicitante WHERE correo IS NULL AND registro_asistido_en IS NOT NULL) >= 4; END $$;`],
  ['Registro asistido: sin contraseña no se abre una sesión (no puede entrar sola)', { codigo: 'cuenta_sin_contrasena' }, null, SESION(ASIS('AMALIA'))],
  ['Registro asistido: la persona activa después su cuenta con su correo y su contraseña; la base pone cuándo, lo anota y ya puede entrar', 'ok', '2026-10-14 18:00', `
     ${COMO('solicitante', 'amalia@ejemplo.local')} ${B0}
     UPDATE apd.solicitante SET correo = 'nueva-asistida@ejemplo.local', contrasena_hash = 'x' WHERE id = ${ASIS('AMALIA')};
     DO $$ BEGIN
       ASSERT (SELECT activada_en = '2026-10-14 18:00-06' AND registro_asistido_por = 'revision.ficticia' FROM apd.solicitante WHERE nombre = 'AMALIA' AND registro_asistido_en IS NOT NULL);
       ASSERT EXISTS (SELECT 1 FROM apd.bitacora WHERE accion = 'activacion' AND usuario = 'amalia@ejemplo.local'); END $$;
     ${SESION(ASIS('AMALIA'))}`],
  ['Registro asistido: activar la cuenta sin correo se rechaza', { codigo: 'activacion_sin_correo' }, '2026-10-14 18:00', `
     ${COMO('solicitante', 'benito@ejemplo.local')}
     UPDATE apd.solicitante SET contrasena_hash = 'x' WHERE id = ${ASIS('BENITO')};`],
  ['Registro asistido: el personal no pone la contraseña por la persona', { codigo: 'activacion_de_persona' }, '2026-10-14 18:00', `
     ${PERFIL('revision_cotejo')}
     UPDATE apd.solicitante SET correo = 'benito@ejemplo.local', contrasena_hash = 'x' WHERE id = ${ASIS('BENITO')};`],
  ['Registro asistido: quién registró la cuenta y cuándo no los escribe la cuenta del servicio', { sqlstate: '42501' }, null, `
     UPDATE apd.solicitante SET registro_asistido_por = 'otra.cuenta' WHERE id = ${ASIS('BENITO')};`],
  ['Registro asistido: quién registró la cuenta, cuándo y cuándo se activó no cambian ni para quien administra la base', { codigo: 'registro_asistido_fijo' }, null, `
     UPDATE apd.solicitante SET activada_en = now() WHERE id = ${ASIS('BENITO')};`, 'administracion'],
  ['Registro asistido: la fotografía que toma el personal al registrar queda pendiente hasta el cotejo', 'ok', '2026-10-14 10:00', `
     ${PERFIL('revision_cotejo')} ${FOTO(ASIS('BENITO'))}
     DO $$ BEGIN ASSERT (SELECT origen = 'registro_asistido' AND estado = 'pendiente' AND confirmada_por IS NULL AND cargada_por = 'prueba.automatica'
                           FROM apd.fotografia WHERE solicitante_id = (SELECT id FROM apd.solicitante WHERE nombre = 'BENITO' AND registro_asistido_en IS NOT NULL) AND vigente); END $$;`],
  ['Registro asistido: otro perfil no carga su fotografía', { codigo: 'registro_asistido_sin_permiso' }, '2026-10-14 10:00', `
     ${PERFIL('instructor')} ${FOTO(ASIS('BENITO'))}`],

  // ── Registro asistido: la solicitud y sus documentos ──
  ['Registro asistido: la solicitud que captura el personal guarda quién la capturó; al enviarla con la marca de lectura queda enviada y la marca en la bitácora', 'ok', '2026-10-14 10:30', `
     ${ASISTIDA_CON_SOLICITUD}
     DO $$ BEGIN ASSERT (SELECT capturada_por = 'prueba.automatica' AND estado = 'borrador' FROM apd.solicitud WHERE id = ${SOL_ASIS}); END $$;
     ${LECTURA('lo_capturado')} ${B0}
     UPDATE apd.solicitud SET estado = 'enviada' WHERE id = ${SOL_ASIS};
     DO $$ BEGIN
       ASSERT (SELECT estado = 'enviada' AND enviada_en = '2026-10-14 10:30-06' AND capturada_por = 'prueba.automatica' FROM apd.solicitud WHERE id = ${SOL_ASIS});
       ASSERT EXISTS (SELECT 1 FROM apd.bitacora WHERE accion = 'lectura_lo_capturado' AND entidad_id = ${SOL_ASIS} AND usuario = 'prueba.automatica'
                        AND detalle = 'Se le leyó lo capturado y lo aceptó · envío de la solicitud');
       ASSERT EXISTS (SELECT 1 FROM apd.solicitud s WHERE s.id = ${SOL_ASIS} AND s.estado = 'enviada'); END $$;`],
  ['Registro asistido: sin la marca «se le leyó lo capturado» no se envía', { codigo: 'sin_lectura' }, '2026-10-14 10:30', `
     ${ASISTIDA_CON_SOLICITUD}
     UPDATE apd.solicitud SET estado = 'enviada' WHERE id = ${SOL_ASIS};`],
  ['Registro asistido: otro perfil no envía la solicitud por la persona', { codigo: 'registro_asistido_sin_permiso' }, '2026-10-14 10:30', `
     ${ASISTIDA_CON_SOLICITUD}
     ${PERFIL('instructor')} ${LECTURA('lo_capturado')}
     UPDATE apd.solicitud SET estado = 'enviada' WHERE id = ${SOL_ASIS};`],
  ['Registro asistido: otro perfil no captura la solicitud', { codigo: 'registro_asistido_sin_permiso' }, '2026-10-14 10:30', `
     ${PERFIL('revision_cotejo')} ${LECTURA('aviso_privacidad')} ${ALTA_ASIS()}
     ${PERFIL('instructor')}
     INSERT INTO apd.solicitud (solicitante_id, tipo_acreditacion, modalidad, nivel_estudios) VALUES ('${ID_ASIS}', 'poda', 'nueva', 'primaria');`],
  ['Registro asistido: quién capturó la solicitud no lo escribe la cuenta del servicio', { sqlstate: '42501' }, null, `
     UPDATE apd.solicitud SET capturada_por = 'otra.cuenta' WHERE id = ${SOL_DE(ASIS('BENITO'))};`],
  ['Registro asistido: quién capturó la solicitud no cambia ni para quien administra la base', { codigo: 'registro_asistido_fijo' }, null, `
     UPDATE apd.solicitud SET capturada_por = 'otra.cuenta' WHERE id = ${SOL_DE(ASIS('BENITO'))};`, 'administracion'],
  ['Registro asistido: en la ventanilla, el personal carga el documento corregido y reenvía con la marca de lectura; queda en la bitácora', 'ok', '2026-10-14 11:00', `
     ${PERFIL('revision_cotejo')}
     ${DOC_PEQUENO(SOL_DE(ASIS('AMALIA')), 'comprobante_domicilio')}
     ${LECTURA('lo_capturado')}
     UPDATE apd.solicitud SET estado = 'enviada' WHERE id = ${SOL_DE(ASIS('AMALIA'))};
     DO $$ BEGIN
       ASSERT (SELECT estado = 'enviada' FROM apd.solicitud WHERE id = ${SOL_DE(ASIS('AMALIA'))});
       ASSERT (SELECT cargado_por = 'prueba.automatica' AND estado = 'pendiente' FROM apd.documento WHERE solicitud_id = ${SOL_DE(ASIS('AMALIA'))} AND requisito = 'comprobante_domicilio' AND vigente);
       ASSERT EXISTS (SELECT 1 FROM apd.bitacora WHERE accion = 'lectura_lo_capturado' AND entidad_id = ${SOL_DE(ASIS('AMALIA'))}::text
                        AND detalle = 'Se le leyó lo capturado y lo aceptó · reenvío con lo corregido'); END $$;`],
  ['Registro asistido: otro perfil no carga los documentos de la persona', { codigo: 'registro_asistido_sin_permiso' }, '2026-10-14 11:00', `
     ${PERFIL('instructor')} ${DOC_PEQUENO(SOL_DE(ASIS('AMALIA')), 'comprobante_domicilio')}`],
  ['Registro asistido: con su cita en pausa, el documento que carga el personal pide la marca de lectura', { codigo: 'sin_lectura' }, '2026-10-21 10:40', `
     UPDATE apd.documento SET estado = 'con_observacion', observacion = 'Trae otra versión de la CURP.', revisado_por = 'prueba.automatica'
      WHERE solicitud_id = ${SOL_DE(ASIS('CIRILO'))} AND requisito = 'curp' AND vigente;
     UPDATE apd.cita SET resultado = 'en_pausa', observacion = 'CURP: trae otra versión.' WHERE solicitud_id = ${SOL_DE(ASIS('CIRILO'))} AND resultado = 'pendiente';
     ${PERFIL('revision_cotejo')} ${DOC_PEQUENO(SOL_DE(ASIS('CIRILO')), 'curp')}`],
  ['Registro asistido: con su cita en pausa, queda el aviso por teléfono de qué traer (T2) y el documento se carga con la marca de lectura', 'ok', '2026-10-21 10:40', `
     UPDATE apd.documento SET estado = 'con_observacion', observacion = 'Trae otra versión de la CURP.', revisado_por = 'prueba.automatica'
      WHERE solicitud_id = ${SOL_DE(ASIS('CIRILO'))} AND requisito = 'curp' AND vigente;
     UPDATE apd.cita SET resultado = 'en_pausa', observacion = 'CURP: trae otra versión.' WHERE solicitud_id = ${SOL_DE(ASIS('CIRILO'))} AND resultado = 'pendiente';
     DO $$ BEGIN ASSERT (SELECT datos->>'resultado' = 'en_pausa' AND datos->>'observacion' = 'CURP: trae otra versión.' AND resultado IS NULL
                           FROM apd.aviso_telefono WHERE solicitante_id = ${ASIS('CIRILO')} AND aviso = 'T2'); END $$;
     ${PERFIL('revision_cotejo')} ${LECTURA('lo_capturado')} ${DOC_PEQUENO(SOL_DE(ASIS('CIRILO')), 'curp')}
     DO $$ BEGIN ASSERT EXISTS (SELECT 1 FROM apd.bitacora WHERE accion = 'lectura_lo_capturado' AND detalle LIKE '%documento curp cargado en la ventanilla'); END $$;`],

  // ── Registro asistido: avisos por teléfono ──
  ['Avisos por teléfono: con observaciones queda el aviso pendiente (S2) y al validar, el de la cita con los datos para pagar (S5)', 'ok', '2026-10-14 12:00', `
     DO $$ BEGIN ASSERT (SELECT count(*) = 1 FROM apd.aviso_telefono WHERE solicitante_id = ${ASIS('AMALIA')} AND aviso = 'S2' AND resultado IS NULL); END $$;
     ${LISTA_PARA_VALIDAR(SOL_DE(ASIS('BENITO')))}
     INSERT INTO apd.revision (solicitud_id, resultado, revisor) VALUES (${SOL_DE(ASIS('BENITO'))}, 'validada', 'prueba.automatica');
     DO $$ BEGIN ASSERT (SELECT datos->>'cita_en' = '2026-10-21T16:00:00Z' AND (datos->>'pago_monto')::numeric > 0 AND datos->>'pago_referencia' LIKE 'APDS2026%'
                                AND creado_en = '2026-10-14 12:00-06' AND resultado IS NULL
                           FROM apd.aviso_telefono WHERE solicitante_id = ${ASIS('BENITO')} AND aviso = 'S5'); END $$;`],
  ['Avisos por teléfono: el cotejo terminado (T2), el grupo confirmado (G1) y la baja del grupo (G2) también dejan su aviso', 'ok', '2026-10-21 10:30', `
     ${COTEJO_CIRILO}
     DO $$ BEGIN ASSERT (SELECT datos->>'resultado' = 'atendida' AND datos->>'expediente' LIKE 'EXP-2026-%' FROM apd.aviso_telefono WHERE solicitante_id = ${ASIS('CIRILO')} AND aviso = 'T2'); END $$;
     INSERT INTO apd.inscripcion (solicitud_id, grupo_id) VALUES (${SOL_DE(ASIS('CIRILO'))}, ${GRUPO_INTEGRACION});
     DO $$ BEGIN ASSERT ${AVISOS(ASIS('CIRILO'), 'G1')} = 0; END $$;
     UPDATE apd.grupo SET instructor = 'instructor.ficticio', fecha_inicio = '2026-11-02', hora_entrada = '09:00' WHERE id = ${GRUPO_INTEGRACION};
     UPDATE apd.grupo SET estado = 'confirmado' WHERE id = ${GRUPO_INTEGRACION};
     DO $$ BEGIN ASSERT (SELECT datos->>'fecha_inicio' = '2026-11-02' AND datos->>'hora_entrada' = '09:00' AND datos->>'grupo' = 'APD-G-2026-004'
                           FROM apd.aviso_telefono WHERE solicitante_id = ${ASIS('CIRILO')} AND aviso = 'G1'); END $$;
     UPDATE apd.inscripcion SET activa = false, motivo_baja = 'La persona pidió cambiar de grupo.' WHERE solicitud_id = ${SOL_DE(ASIS('CIRILO'))} AND activa;
     DO $$ BEGIN ASSERT (SELECT datos->>'resultado' = 'baja' AND datos->>'motivo' = 'La persona pidió cambiar de grupo.' FROM apd.aviso_telefono WHERE solicitante_id = ${ASIS('CIRILO')} AND aviso = 'G2'); END $$;`],
  ['Avisos por teléfono: la cuenta bloqueada por identidad deja su aviso (T3)', 'ok', '2026-10-14 12:00', `
     SELECT set_config('apd.motivo', 'Prueba automática del bloqueo por identidad.', true);
     UPDATE apd.solicitante SET estado = 'bloqueada', bloqueo_motivo = 'identidad' WHERE id = ${ASIS('BENITO')};
     DO $$ BEGIN ASSERT ${AVISOS(ASIS('BENITO'), 'T3')} = 1; END $$;`],
  ['Avisos por teléfono: ni la cuenta ya activada ni la de quien no es del registro asistido reciben avisos por teléfono', 'ok', '2026-10-14 12:00', `
     CREATE TEMP TABLE a0 AS SELECT count(*) AS n FROM apd.aviso_telefono;
     CREATE TEMP TABLE e AS SELECT ${ENVIADA} AS id;
     UPDATE apd.documento SET estado = 'con_observacion', observacion = 'Observación de la prueba automática.', revisado_por = 'prueba.automatica'
      WHERE solicitud_id = (SELECT id FROM e) AND vigente AND requisito = 'curp';
     INSERT INTO apd.revision (solicitud_id, resultado, observacion_general, revisor) VALUES ((SELECT id FROM e), 'con_observaciones', 'Observación de la prueba automática.', 'prueba.automatica');
     ${COMO('solicitante', 'persona-asistida@ejemplo.local')}
     ${DOC_PEQUENO(SOL_DE(ASIS('DOLORES')), 'identificacion_oficial')}
     UPDATE apd.solicitud SET estado = 'enviada' WHERE id = ${SOL_DE(ASIS('DOLORES'))};
     ${COMO('personal')}
     UPDATE apd.documento SET estado = 'con_observacion', observacion = 'Sigue vencida la identificación.', revisado_por = 'prueba.automatica'
      WHERE solicitud_id = ${SOL_DE(ASIS('DOLORES'))} AND vigente AND requisito = 'identificacion_oficial';
     INSERT INTO apd.revision (solicitud_id, resultado, observacion_general, revisor) VALUES (${SOL_DE(ASIS('DOLORES'))}, 'con_observaciones', 'Sigue vencida la identificación.', 'prueba.automatica');
     DO $$ BEGIN
       ASSERT (SELECT estado FROM apd.solicitud WHERE id = (SELECT id FROM e)) = 'con_observaciones';
       ASSERT (SELECT estado FROM apd.solicitud WHERE id = ${SOL_DE(ASIS('DOLORES'))}) = 'con_observaciones';
       ASSERT (SELECT count(*) FROM apd.aviso_telefono) = (SELECT n FROM a0); END $$;`],
  ['Avisos por teléfono: el personal de revisión y cotejo registra «se le avisó»; la base pone quién y cuándo, y lo anota en la bitácora', 'ok', '2026-10-14 16:00', `
     ${PERFIL('revision_cotejo')} ${B0}
     UPDATE apd.aviso_telefono SET resultado = 'se_le_aviso' WHERE solicitante_id = ${ASIS('AMALIA')} AND resultado IS NULL;
     DO $$ BEGIN ASSERT (SELECT atendido_por = 'prueba.automatica' AND atendido_en = '2026-10-14 16:00-06' FROM apd.aviso_telefono WHERE solicitante_id = ${ASIS('AMALIA')} AND aviso = 'S2'); END $$;
     ${MAS(1, 'aviso_telefono')}`],
  ['Avisos por teléfono: «no contestó» también se registra', 'ok', '2026-10-14 16:00', `
     ${PERFIL('revision_cotejo')}
     UPDATE apd.aviso_telefono SET resultado = 'no_contesto' WHERE solicitante_id = ${ASIS('AMALIA')} AND resultado IS NULL;
     DO $$ BEGIN ASSERT NOT EXISTS (SELECT 1 FROM apd.avisos_telefono_pendientes WHERE solicitante_id = ${ASIS('AMALIA')});
       ASSERT EXISTS (SELECT 1 FROM apd.bitacora WHERE accion = 'aviso_telefono' AND detalle = 'Aviso S2 por teléfono: no contestó'); END $$;`],
  ['Avisos por teléfono: otro perfil no los registra', { codigo: 'registro_asistido_sin_permiso' }, '2026-10-14 16:00', `
     ${PERFIL('instructor')}
     UPDATE apd.aviso_telefono SET resultado = 'se_le_aviso' WHERE solicitante_id = ${ASIS('AMALIA')} AND resultado IS NULL;`],
  ['Avisos por teléfono: un aviso que ya tiene su resultado no cambia', { codigo: 'aviso_atendido' }, '2026-10-14 16:00', `
     ${PERFIL('revision_cotejo')}
     UPDATE apd.aviso_telefono SET resultado = 'no_contesto' WHERE solicitante_id = ${ASIS('CIRILO')} AND aviso = 'S5';`],
  ['Avisos por teléfono: sin resultado no se registra', { codigo: 'aviso_sin_resultado' }, '2026-10-14 16:00', `
     ${PERFIL('revision_cotejo')}
     UPDATE apd.aviso_telefono SET resultado = NULL WHERE solicitante_id = ${ASIS('AMALIA')} AND resultado IS NULL;`],
  ['Avisos por teléfono: el resultado es «se le avisó» o «no contestó»', { sqlstate: '23514' }, '2026-10-14 16:00', `
     ${PERFIL('revision_cotejo')}
     UPDATE apd.aviso_telefono SET resultado = 'mas_tarde' WHERE solicitante_id = ${ASIS('AMALIA')} AND resultado IS NULL;`],
  ['Avisos por teléfono: la cuenta del servicio no los crea', { sqlstate: '42501' }, null, `
     INSERT INTO apd.aviso_telefono (solicitante_id, aviso) VALUES (${ASIS('AMALIA')}, 'S2');`],
  ['Avisos por teléfono: tampoco llamando directo a la función que los escribe', { codigo: 'aviso_directo' }, null, `
     SELECT apd.avisar_por_telefono(${ASIS('AMALIA')}, NULL, 'S2');`],
  ['Avisos por teléfono: nadie los borra', { sqlstate: '42501' }, null, `DELETE FROM apd.aviso_telefono;`],
  ['Avisos por teléfono: lo que dice un aviso no lo cambia la cuenta del servicio', { sqlstate: '42501' }, null, `
     UPDATE apd.aviso_telefono SET aviso = 'S4' WHERE solicitante_id = ${ASIS('AMALIA')};`],
  ['Avisos por teléfono: lo que dice un aviso no cambia ni para quien administra la base', { codigo: 'aviso_inmutable' }, null, `
     UPDATE apd.aviso_telefono SET aviso = 'S4' WHERE solicitante_id = ${ASIS('AMALIA')};`, 'administracion'],
  ['Avisos por teléfono: la lista de pendientes trae el nombre y el teléfono de la persona; las ya atendidas no salen', 'ok', null, `DO $$ BEGIN
     ASSERT (SELECT nombre = 'AMALIA' AND telefono ~ '^[0-9]{10}$' AND aviso = 'S2' FROM apd.avisos_telefono_pendientes WHERE solicitante_id = ${ASIS('AMALIA')});
     ASSERT NOT EXISTS (SELECT 1 FROM apd.avisos_telefono_pendientes WHERE solicitante_id IN (${ASIS('CIRILO')}, ${ASIS('DOLORES')})); END $$;`]
];

let fallas = 0;
for (const [nombre, espera, fecha, cuerpo, quien = 'apd_api'] of casos) {
  const guion = [
    '\\set ON_ERROR_STOP on',
    '\\set VERBOSITY verbose',
    'BEGIN;',
    `SELECT set_config('apd.usuario', 'prueba.automatica', true), set_config('apd.usuario_tipo', 'personal', true)${fecha ? `, set_config('apd.ahora_simulado', '${fecha}:00-06', true)` : ''};`,
    cuerpo,
    'ROLLBACK;'
  ].join('\n');
  const args = ['-X', '-q', '-d', base];
  if (quien === 'apd_api') args.push('-U', 'apd_api');
  const r = spawnSync('psql', args, { input: guion, encoding: 'utf8' });
  const err = r.stderr || '';
  const estado = (err.match(/ERROR:\s+([0-9A-Z]{5}):/) || [])[1];
  const codigo = (err.match(/HINT:\s+apd:(\w+)/) || [])[1];
  let bien;
  if (espera === 'ok') bien = r.status === 0 && !estado;
  else if (espera.codigo) bien = codigo === espera.codigo;
  else if (espera.sqlstate) bien = estado === espera.sqlstate;
  else if (espera.mensaje) bien = err.includes(espera.mensaje);
  if (!bien) fallas++;
  const esperado = espera === 'ok' ? 'sin error' : espera.codigo || espera.sqlstate || espera.mensaje;
  console.log(`${bien ? 'BIEN ' : 'FALLA'} ${nombre}${bien ? '' : `\n      esperaba: ${esperado}\n      obtuvo:   ${(err.split('\n').find((l) => l.startsWith('ERROR')) || 'sin error').trim()}${codigo ? ' [' + codigo + ']' : ''}`}`);
}
let total = casos.length;
const informa = (bien, nombre, detalle = '') => {
  total++;
  if (!bien) fallas++;
  console.log(`${bien ? 'BIEN ' : 'FALLA'} ${nombre}${bien || !detalle ? '' : `\n      ${detalle}`}`);
};

// ── A1-01 · La base rechaza lo mismo que el formulario: el validador del Estándar (el mismo del formulario y de su
// validación en el servidor, validaciones.config.js) contra las funciones que usan las restricciones de la base ──
await import('../sitio/formkit/js/validaciones.config.js');
const FORMATOS = globalThis.FORMKIT_VALIDACIONES.FORMATOS || globalThis.FORMKIT_VALIDACIONES.formatos;
const BASE_DE = { curp: 'apd.curp_valida', rfc: 'apd.rfc_valido', correo: 'apd.correo_valido' };
const cruces = [
  ['curp', 'CURP correcta', curpCon('EEMJ760707HNEJSN0')],
  ['curp', 'CURP con mes 13 (fecha imposible)', curpCon('EEMJ761307HNEJSN0')],
  ['curp', 'CURP con 30 de febrero', curpCon('EEMJ760230HNEJSN0')],
  ['curp', 'CURP del 29 de febrero de un año bisiesto (1976)', curpCon('EEMJ760229HNEJSN0')],
  ['curp', 'CURP del 29 de febrero de un año no bisiesto (1977)', curpCon('EEMJ770229HNEJSN0')],
  ['curp', 'CURP con nacimiento en el futuro (2030: carácter 17 letra)', curpCon('EEMJ300707HNEJSNA')],
  ['curp', 'CURP del siglo 2000 (2005: carácter 17 letra)', curpCon('EEMJ050707HNEJSNA')],
  ['curp', 'CURP con dígito verificador equivocado', curpCon('EEMJ760707HNEJSN0').slice(0, 17) + '9'],
  ['rfc', 'RFC con fecha imposible (mes 13)', 'EJE011310AB1'],
  ['rfc', 'RFC con Ñ', 'ÑEJE010110AB1'],
  ['rfc', 'RFC de persona física', 'EJEM760707AB1'],
  ['rfc', 'RFC del 29 de febrero de 2000', 'EJE000229AB1'],
  ['correo', 'correo con dominio de una letra final', 'a@b.c'],
  ['correo', 'correo de 130 caracteres', 'a'.repeat(119) + '@ejemplo.mx'],
  ['correo', 'correo de 120 caracteres exactos', 'a'.repeat(109) + '@ejemplo.mx'],
  ['correo', 'correo con dos letras al final', 'persona@ejemplo.mx'],
  ['correo', 'correo sin arroba', 'persona.ejemplo.mx']
];
const consulta = cruces.map(([fmt, , crudo], i) => {
  const f = FORMATOS[fmt];
  const v = f.normaliza ? f.normaliza(crudo) : crudo;
  cruces[i].push(v);
  return `SELECT ${i}, ${BASE_DE[fmt]}(${q(v)});`;
}).join('\n');
const rc = spawnSync('psql', ['-X', '-q', '-At', '-F', '|', '-d', base, '-U', 'apd_api', '-v', 'ON_ERROR_STOP=1'], { input: consulta, encoding: 'utf8' });
const enBase = Object.fromEntries((rc.stdout || '').trim().split('\n').filter(Boolean).map((l) => l.split('|')));
for (const [i, [fmt, nombre, , v]] of cruces.entries()) {
  const form = FORMATOS[fmt].valida(v, fmt === 'correo' ? { maxlength: 120 } : {}) ? 'rechaza' : 'acepta';
  const bd = enBase[i] === 't' ? 'acepta' : enBase[i] === 'f' ? 'rechaza' : `sin respuesta (${(rc.stderr || '').trim().slice(0, 80)})`;
  informa(form === bd, `Cruce formulario ↔ base (A1-01) · ${nombre}: el formulario ${form}`, `la base ${bd}`);
}
// …y las restricciones de la base usan esas mismas funciones
const rd = spawnSync('psql', ['-X', '-q', '-At', '-d', base, '-c',
  `SELECT string_agg(pg_get_constraintdef(oid), ' ') FROM pg_constraint WHERE conname IN ('solicitante_curp_ck', 'solicitante_correo_ck', 'solicitud_factura_rfc_ck')`], { encoding: 'utf8' });
informa(['curp_valida(', 'correo_valido(', 'rfc_valido('].every((f) => (rd.stdout || '').includes(f)),
  'Las restricciones de CURP, correo y RFC usan las funciones del cruce', (rd.stdout || rd.stderr || '').trim().slice(0, 200));

// ── A1-03 · Cada regla con código tiene un caso que la provoca. Las que todavía no lo tienen se anotan aquí con su
// porqué; una regla nueva sin caso hace fallar la prueba. Cuentan también los casos de probar-concurrencia.sh. ──
const SIN_CASO_ANOTADAS = {
  sin_adscripcion: 'defensiva: una cuenta activa siempre tiene adscripción (solicitante_adscripcion_activa_ck), así que no se alcanza'
};
// También las del registro asistido, en su archivo (decisión 2026-10-25)
const reglas = readFileSync(new URL('../db/apd/03-apd-reglas.sql', import.meta.url), 'utf8')
  + readFileSync(new URL('../db/apd/03b-apd-registro-asistido.sql', import.meta.url), 'utf8');
const concurrencia = readFileSync(new URL('./probar-concurrencia.sh', import.meta.url), 'utf8');
const codigos = [...new Set([...reglas.matchAll(/apd\.error\('([a-z_]+)'/g)].map((m) => m[1]))].sort();
const conCaso = new Set(casos.filter(([, e]) => e && e.codigo).map(([, e]) => e.codigo));
for (const m of concurrencia.matchAll(/^verifica "[^"]*" "?([a-z_|]+)"?/gm)) m[1].split('|').forEach((c) => conCaso.add(c));
const sinCaso = codigos.filter((c) => !conCaso.has(c));
const nuevosSinCaso = sinCaso.filter((c) => !(c in SIN_CASO_ANOTADAS));
const yaConCaso = Object.keys(SIN_CASO_ANOTADAS).filter((c) => conCaso.has(c) || !codigos.includes(c));
informa(!nuevosSinCaso.length && !yaConCaso.length,
  `Cada regla con código tiene un caso (${codigos.length} códigos; sin caso, anotados: ${sinCaso.length ? sinCaso.join(', ') : 'ninguno'})`,
  [nuevosSinCaso.length ? `sin caso y sin anotar: ${nuevosSinCaso.join(', ')}` : '', yaConCaso.length ? `ya no van en SIN_CASO_ANOTADAS: ${yaConCaso.join(', ')}` : ''].filter(Boolean).join('; '));

console.log(`\n${total - fallas} de ${total} casos correctos.`);
process.exit(fallas ? 1 : 0);
