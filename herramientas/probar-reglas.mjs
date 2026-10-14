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
const GRUPO_INTEGRACION = `(SELECT id FROM apd.grupo WHERE estado = 'en_integracion' LIMIT 1)`;
const GRUPO_EN_CURSO = `(SELECT id FROM apd.grupo WHERE estado = 'en_curso' LIMIT 1)`;
const BORRADOR = `(SELECT id FROM apd.solicitud WHERE estado = 'borrador' LIMIT 1)`;
const ENVIADA = `(SELECT id FROM apd.solicitud WHERE estado = 'enviada' ORDER BY folio LIMIT 1)`;
const LISTA_DICT = `(SELECT solicitud_id FROM apd.bandeja_demanda WHERE tipo_acreditacion = 'dictaminador' ORDER BY folio LIMIT 1)`;
const DOC_PEQUENO = (sol, req, tam = 1000) =>
  `INSERT INTO apd.documento (solicitud_id, requisito, archivo_clave, nombre_original, tipo_mime, tamano_bytes, sha256)
   VALUES (${sol}, '${req}', 'prueba/' || gen_random_uuid(), 'x.pdf', 'application/pdf', ${tam}, repeat('a', 64));`;

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
            = ARRAY['numero', 'nombre', 'tipo', 'emitida_en', 'vence_en', 'situacion']; END $$;`],
  ['Dictaminador con la poda vencida: «No vigente» aunque su fecha no haya llegado', 'ok', null, `DO $$ BEGIN
     ASSERT NOT apd.acreditacion_vigente(${DICT_SIN_PODA}); END $$;`],
  ['Con dictaminador_sigue_a_poda = no, el mismo dictaminador sí opera', 'ok', null, `
     UPDATE apd.parametro SET valor = 'no' WHERE clave = 'dictaminador_sigue_a_poda';
     DO $$ BEGIN ASSERT apd.acreditacion_vigente(${DICT_SIN_PODA}); END $$;`],

  // ── Elegibilidad al tramitar ──
  ['Renovar antes de la ventana se rechaza', { codigo: 'renovacion_anticipada' }, '2026-10-14 10:00', `
     INSERT INTO apd.solicitud (solicitante_id, tipo_acreditacion, modalidad, acreditacion_anterior_id)
     VALUES (${PERSONA_VIGENTE}, 'poda', 'renovacion', (SELECT id FROM apd.acreditacion WHERE numero = 'PD-2025-K100'));`],
  ['La misma renovación se acepta desde el primer día de la ventana', 'ok', '2026-10-20 10:00', `
     INSERT INTO apd.solicitud (solicitante_id, tipo_acreditacion, modalidad, acreditacion_anterior_id)
     VALUES (${PERSONA_VIGENTE}, 'poda', 'renovacion', (SELECT id FROM apd.acreditacion WHERE numero = 'PD-2025-K100'));`],
  ['Renovar una vencida hace más de un año se rechaza: va como nueva', { codigo: 'renovacion_vencida' }, null, `
     INSERT INTO apd.solicitud (solicitante_id, tipo_acreditacion, modalidad, acreditacion_anterior_id)
     VALUES (${PERSONA_NO_RENOVABLE}, 'poda', 'renovacion', ${ACRED_NO_RENOVABLE});`],
  ['Pedir una nueva teniendo una vigente se rechaza: debe renovar', { codigo: 'debe_renovar' }, null, `
     INSERT INTO apd.solicitud (solicitante_id, tipo_acreditacion, modalidad) VALUES (${PERSONA_VIGENTE}, 'poda', 'nueva');`],
  ['Dictaminador sin poda vigente se rechaza', { codigo: 'sin_poda_vigente' }, null, `
     INSERT INTO apd.solicitud (solicitante_id, tipo_acreditacion, modalidad, perfil_academico, carrera, anios_experiencia)
     VALUES (${PERSONA_NO_RENOVABLE}, 'dictaminador', 'nueva', 'titulo', 'Biología', 3);`],
  ['Una persona no tiene dos solicitudes activas del mismo tipo', { sqlstate: '23505' }, null, `
     INSERT INTO apd.solicitud (solicitante_id, tipo_acreditacion, modalidad)
     SELECT solicitante_id, 'poda', 'nueva' FROM apd.solicitud WHERE id = ${BORRADOR};`],
  ['No se envía con documentos faltantes', { codigo: 'faltan_documentos' }, null, `
     INSERT INTO apd.solicitante (id, curp, nombre, primer_apellido, correo, telefono, contrasena_hash, es_ficticio)
     VALUES ('00000000-0000-4000-a000-000000000001', 'XAXX991231HPRUEBZ9', 'Caso', 'Prueba', 'caso@ejemplo.local', '0000000099', 'x', true);
     INSERT INTO apd.solicitud (id, solicitante_id, tipo_acreditacion, modalidad)
     VALUES ('00000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000001', 'poda', 'nueva');
     UPDATE apd.solicitud SET estado = 'enviada' WHERE id = '00000000-0000-4000-a000-000000000002';`],
  ['Un salto de estado no previsto se rechaza', { codigo: 'transicion_invalida' }, null, `
     UPDATE apd.solicitud SET estado = 'aprobada' WHERE id = ${BORRADOR};`],
  ['El folio no se cambia', { sqlstate: '42501' }, null, `
     UPDATE apd.solicitud SET folio = 'X' WHERE id = ${BORRADOR};`],

  // ── Documentos ──
  ['Un archivo de más de 2 MB se rechaza', { codigo: 'archivo_grande' }, null,
     DOC_PEQUENO(BORRADOR, 'curp', 2097153)],
  ['No se cargan documentos en una solicitud enviada', { codigo: 'carga_fuera_de_turno' }, null,
     DOC_PEQUENO(ENVIADA, 'curp')],
  ['La revisión de un documento registra quién la hizo', { codigo: 'revision_sin_responsable' }, null, `
     UPDATE apd.documento SET estado = 'aceptado' WHERE solicitud_id = ${ENVIADA} AND vigente;`],

  // ── Grupos y cupos ──
  ['Un grupo no se confirma por debajo del mínimo (6 de 10)', { codigo: 'cupo_minimo' }, null, `
     UPDATE apd.grupo SET instructor = 'i', sede = 's', fecha_inicio = '2026-11-03' WHERE id = ${GRUPO_INTEGRACION};
     UPDATE apd.grupo SET estado = 'confirmado' WHERE id = ${GRUPO_INTEGRACION};`],
  ['Un grupo nuevo copia los cupos vigentes del curso, y nunca pasa del máximo', { codigo: 'cupo_maximo' }, null, `
     UPDATE apd.curso SET cupo_minimo = 1, cupo_maximo = 2 WHERE tipo_acreditacion = 'poda' AND modalidad = 'nueva';
     INSERT INTO apd.grupo (id, tipo_acreditacion, modalidad, integracion) VALUES ('00000000-0000-4000-a000-000000000010', 'poda', 'nueva', 'combinado');
     DO $$ BEGIN ASSERT (SELECT cupo_maximo FROM apd.grupo WHERE id = '00000000-0000-4000-a000-000000000010') = 2; END $$;
     INSERT INTO apd.inscripcion (solicitud_id, grupo_id) SELECT solicitud_id, '00000000-0000-4000-a000-000000000010'
       FROM apd.bandeja_demanda WHERE tipo_acreditacion = 'poda' AND modalidad = 'nueva' ORDER BY folio LIMIT 3;`],
  ['Los cupos de un grupo creado no cambian', { sqlstate: '42501' }, null, `
     UPDATE apd.grupo SET cupo_minimo = 1 WHERE id = ${GRUPO_INTEGRACION};`],
  ['No se inscribe a alguien de otro curso', { codigo: 'otro_curso' }, null, `
     INSERT INTO apd.inscripcion (solicitud_id, grupo_id) VALUES (${LISTA_DICT}, ${GRUPO_INTEGRACION});`],
  ['Un grupo específico sólo admite a su organización', { codigo: 'otra_organizacion' }, null, `
     INSERT INTO apd.grupo (id, tipo_acreditacion, modalidad, integracion, organizacion_id)
     VALUES ('00000000-0000-4000-a000-000000000011', 'poda', 'nueva', 'especifico', (SELECT id FROM apd.organizacion WHERE nombre_normalizado LIKE 'alcaldia de prueba%'));
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
       ASSERT (SELECT count(*) FROM antes) = 6;
       ASSERT NOT EXISTS (SELECT 1 FROM antes a JOIN apd.solicitud s ON s.id = a.id
                           WHERE s.estado <> 'lista_para_curso' OR s.lista_para_curso_en <> a.lista_para_curso_en);
     END $$;`],
  ['Cancelar un grupo exige motivo', { codigo: 'cancelacion_sin_motivo' }, null, `
     UPDATE apd.grupo SET estado = 'cancelado' WHERE id = ${GRUPO_INTEGRACION};`],

  // ── Asistencia y examen (grupo en curso desde el 13/10; una persona faltó el día 1) ──
  ['No se captura asistencia de un día que no ha ocurrido', { codigo: 'dia_futuro' }, '2026-10-14 10:00', `
     INSERT INTO apd.asistencia (inscripcion_id, dia, asistio, capturada_por)
     SELECT id, 3, true, 'i' FROM apd.inscripcion WHERE grupo_id = ${GRUPO_EN_CURSO} AND activa LIMIT 1;`],
  ['Sin la asistencia mínima no hay examen', { codigo: 'sin_derecho_examen' }, '2026-10-15 19:00', `
     INSERT INTO apd.examen (inscripcion_id, presentado_en, calificacion, capturado_por)
     SELECT i.id, '2026-10-15', 9, 'i' FROM apd.inscripcion i
      WHERE i.grupo_id = ${GRUPO_EN_CURSO} AND i.activa
        AND EXISTS (SELECT 1 FROM apd.asistencia a WHERE a.inscripcion_id = i.id AND NOT a.asistio) LIMIT 1;`],
  ['No se concluye un grupo con calificaciones pendientes', { codigo: 'faltan_calificaciones' }, '2026-10-15 20:00', `
     INSERT INTO apd.asistencia (inscripcion_id, dia, asistio, capturada_por)
     SELECT i.id, d, true, 'i' FROM apd.inscripcion i, generate_series(2, 3) d WHERE i.grupo_id = ${GRUPO_EN_CURSO} AND i.activa;
     UPDATE apd.grupo SET estado = 'concluido' WHERE id = ${GRUPO_EN_CURSO};`],
  ['Recorrido completo: examen, conclusión, emisión y verificación', 'ok', '2026-10-15 20:00', `
     CREATE TEMP TABLE g AS SELECT ${GRUPO_EN_CURSO} AS id; -- el grupo deja de estar «en curso» a la mitad del caso
     INSERT INTO apd.asistencia (inscripcion_id, dia, asistio, capturada_por)
     SELECT i.id, d, true, 'i' FROM apd.inscripcion i, generate_series(2, 3) d WHERE i.grupo_id = (SELECT id FROM g) AND i.activa;
     INSERT INTO apd.examen (inscripcion_id, presentado_en, calificacion, capturado_por)
     SELECT i.id, '2026-10-15', 8, 'i' FROM apd.inscripcion i
      WHERE i.grupo_id = (SELECT id FROM g) AND i.activa
        AND (SELECT count(*) FROM apd.asistencia a WHERE a.inscripcion_id = i.id AND a.asistio) = 3;
     UPDATE apd.grupo SET estado = 'concluido' WHERE id = (SELECT id FROM g);
     INSERT INTO apd.acreditacion (solicitante_id, tipo_acreditacion, solicitud_id)
     SELECT solicitante_id, 'poda', id FROM apd.solicitud WHERE estado = 'aprobada';
     DO $$ BEGIN
       ASSERT (SELECT count(*) FROM apd.solicitud s JOIN apd.inscripcion i ON i.solicitud_id = s.id
                WHERE i.grupo_id = (SELECT id FROM g) AND s.estado = 'acreditada') = 9;
       ASSERT (SELECT count(*) FROM apd.solicitud s JOIN apd.inscripcion i ON i.solicitud_id = s.id
                WHERE i.grupo_id = (SELECT id FROM g) AND s.estado = 'sin_derecho_examen') = 1;
       ASSERT (SELECT bool_and(situacion = 'Vigente' AND vence_en = '2027-10-14') FROM apd.verificacion_publica
                WHERE numero LIKE 'PD-2026-%' AND emitida_en = '2026-10-15');
     END $$;`],
  ['No se emite la acreditación de una solicitud no aprobada', { codigo: 'solicitud_no_aprobada' }, null, `
     INSERT INTO apd.acreditacion (solicitante_id, tipo_acreditacion, solicitud_id)
     SELECT solicitante_id, 'poda', id FROM apd.solicitud WHERE id = ${BORRADOR};`],
  ['Una acreditación emitida no se modifica', { sqlstate: '42501' }, null, `
     UPDATE apd.acreditacion SET vence_en = vence_en + 30 WHERE numero = 'PD-2026-0001';`],
  ['La entrega se registra una sola vez', { codigo: 'entrega_ya_registrada' }, null, `
     UPDATE apd.acreditacion SET entregada_en = '2026-10-01' WHERE entregada_en IS NOT NULL AND numero LIKE 'PD-2026-%';`],

  // ── Cuentas ──
  ['No hay dos cuentas con la misma CURP', { sqlstate: '23505' }, null, `
     INSERT INTO apd.solicitante (curp, nombre, primer_apellido, correo, telefono, contrasena_hash)
     SELECT curp, 'Otra', 'Persona', 'otra@ejemplo.local', '0000000098', 'x' FROM apd.solicitante LIMIT 1;`],
  ['Una CURP con formato inválido se rechaza', { sqlstate: '23514' }, null, `
     INSERT INTO apd.solicitante (curp, nombre, primer_apellido, correo, telefono, contrasena_hash)
     VALUES ('ABC123', 'Otra', 'Persona', 'otra@ejemplo.local', '0000000098', 'x');`],
  ['La persona no corrige su propia CURP', { codigo: 'curp_sin_motivo' }, null, `
     SELECT set_config('apd.usuario_tipo', 'solicitante', true);
     UPDATE apd.solicitante SET curp = 'XAXX991231HPRUEBZ8' WHERE id = ${PERSONA_VIGENTE};`],
  ['La Secretaría corrige una CURP con motivo, y queda en la bitácora', 'ok', null, `
     SELECT set_config('apd.motivo', 'Error de captura comprobado con la identificación', true);
     UPDATE apd.solicitante SET curp = 'XAXX991231HPRUEBZ8' WHERE id = ${PERSONA_VIGENTE};
     DO $$ BEGIN ASSERT EXISTS (SELECT 1 FROM apd.bitacora WHERE accion = 'correccion_curp' AND detalle LIKE '%Error de captura%'); END $$;`],
  ['«C.F.E.» y «CFE» son la misma organización', { sqlstate: '23505' }, null, `
     INSERT INTO apd.organizacion (tipo, nombre) VALUES ('dependencia_publica', 'DEPENDENCIA de prueba  de ENERGIA.');`],

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
  ['Ningún permiso directo fuera de su esquema', 'ok', null, `DO $$ BEGIN
     ASSERT (SELECT count(*) FROM information_schema.role_table_grants WHERE grantee = 'apd_api' AND table_schema <> 'apd') = 0; END $$;`],
  ['Cada cambio de estado deja constancia en la bitácora', 'ok', null, `DO $$ BEGIN
     ASSERT (SELECT count(*) FROM apd.solicitud s WHERE s.estado <> 'borrador'
              AND NOT EXISTS (SELECT 1 FROM apd.bitacora b WHERE b.entidad_id = s.id::text AND b.accion = 'estado')) = 0; END $$;`],
  ['Ni la administración edita la bitácora', { codigo: null, mensaje: 'no se edita ni se borra' }, null,
     `UPDATE apd.bitacora SET detalle = 'x';`, 'admin'],
  ['En una base de producción, simular la fecha es un error', { codigo: 'simulacion_prohibida' }, '2026-10-20 10:00', `
     CREATE OR REPLACE FUNCTION apd.entorno() RETURNS text LANGUAGE sql STABLE AS $$ SELECT 'produccion'::text $$;
     SELECT apd.hoy();`, 'admin']
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
console.log(`\n${casos.length - fallas} de ${casos.length} casos correctos.`);
process.exit(fallas ? 1 : 0);
