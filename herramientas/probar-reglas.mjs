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

const FOTO_DOC = (sol, mime = 'image/jpeg') =>
  `INSERT INTO apd.documento (solicitud_id, requisito, archivo_clave, nombre_original, tipo_mime, tamano_bytes, sha256)
   VALUES (${sol}, 'foto_credencial', 'prueba/' || gen_random_uuid(), 'f.jpg', '${mime}', 1000, repeat('b', 64));`;
const FOTO = (persona, mime = 'image/jpeg') =>
  `INSERT INTO apd.fotografia (solicitante_id, archivo_clave, tipo_mime, tamano_bytes, sha256)
   VALUES (${persona}, 'prueba/' || gen_random_uuid(), '${mime}', 1000, repeat('c', 64));`;
const COTEJO_PERSONA = `(SELECT solicitante_id FROM apd.solicitud WHERE estado = 'validada_en_linea' ORDER BY folio LIMIT 1)`;
// Una persona nueva sin fotografía, con una solicitud de poda nueva y todos sus documentos en línea
const SIN_FOTO = `
     INSERT INTO apd.solicitante (id, curp, nombre, primer_apellido, correo, telefono, contrasena_hash, es_ficticio)
     VALUES ('00000000-0000-4000-a000-000000000011', 'XAXX991231HNEXXX09', 'Caso', 'Prueba', 'caso@ejemplo.local', '0000000099', 'x', true);
     INSERT INTO apd.solicitud (id, solicitante_id, tipo_acreditacion, modalidad)
     VALUES ('00000000-0000-4000-a000-000000000012', '00000000-0000-4000-a000-000000000011', 'poda', 'nueva');
     INSERT INTO apd.documento (solicitud_id, requisito, archivo_clave, nombre_original, tipo_mime, tamano_bytes, sha256)
     SELECT '00000000-0000-4000-a000-000000000012', rc.requisito, 'prueba/' || gen_random_uuid(), 'x.pdf', 'application/pdf', 1000, repeat('a', 64)
       FROM apd.requisito_curso rc JOIN apd.requisito r ON r.clave = rc.requisito
      WHERE rc.tipo_acreditacion = 'poda' AND rc.modalidad = 'nueva' AND rc.obligatorio AND r.forma = 'documento' AND r.momento = 'en_linea';`;

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
     VALUES ('00000000-0000-4000-a000-000000000001', 'XAXX991231HNEXXX09', 'Caso', 'Prueba', 'caso@ejemplo.local', '0000000099', 'x', true);
     INSERT INTO apd.solicitud (id, solicitante_id, tipo_acreditacion, modalidad)
     VALUES ('00000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000001', 'poda', 'nueva');
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
  ['Un folio fiscal no se repite en dos solicitudes', { sqlstate: '23505' }, null, `
     UPDATE apd.solicitud SET factura_folio_fiscal = (SELECT factura_folio_fiscal FROM apd.solicitud WHERE factura_folio_fiscal IS NOT NULL LIMIT 1)
      WHERE id = (SELECT id FROM apd.solicitud WHERE estado = 'validada_en_linea' ORDER BY folio LIMIT 1);`],
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
  ['Con factura, sus datos y la foto tomada en el cotejo entra a la bandeja y la persona recibe su expediente consecutivo', 'ok', null, `
     ${DOC_PEQUENO("(SELECT id FROM apd.solicitud WHERE estado = 'validada_en_linea' ORDER BY folio LIMIT 1)", 'factura_pago')}
     ${FOTO(COTEJO_PERSONA)}
     DO $$ BEGIN ASSERT (SELECT origen = 'cotejo' AND estado = 'confirmada' FROM apd.fotografia
                          WHERE solicitante_id = ${COTEJO_PERSONA} AND vigente); END $$;
     CREATE TEMP TABLE s AS SELECT id, solicitante_id FROM apd.solicitud WHERE estado = 'validada_en_linea' ORDER BY folio LIMIT 1;
     DO $$ BEGIN ASSERT (SELECT numero_expediente IS NULL FROM apd.solicitante WHERE id = (SELECT solicitante_id FROM s)); END $$;
     UPDATE apd.solicitud SET factura_rfc = 'xaxx010101000', factura_razon_social = 'Persona de prueba',
       factura_folio_fiscal = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', estado = 'lista_para_curso' WHERE id = (SELECT id FROM s);
     DO $$ BEGIN
       ASSERT (SELECT numero_expediente FROM apd.solicitante WHERE id = (SELECT solicitante_id FROM s))
            = (SELECT 'EXP-2026-' || lpad((count(*))::text, 4, '0') FROM apd.solicitante WHERE numero_expediente IS NOT NULL);
       ASSERT (SELECT factura_rfc = 'XAXX010101000' AND factura_folio_fiscal = 'AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE' FROM apd.solicitud WHERE id = (SELECT id FROM s));
       ASSERT (SELECT cargado_por = 'prueba.automatica' AND estado = 'aceptado' FROM apd.documento
                WHERE solicitud_id = (SELECT id FROM s) AND requisito = 'factura_pago' AND vigente);
     END $$;`],
  ['Un segundo trámite de la misma persona usa su mismo expediente', 'ok', null, `
     CREATE TEMP TABLE p AS SELECT s.solicitante_id, pe.numero_expediente
       FROM apd.solicitud s JOIN apd.solicitante pe ON pe.id = s.solicitante_id
      WHERE s.estado = 'acreditada' AND s.tipo_acreditacion = 'poda'
        AND NOT EXISTS (SELECT 1 FROM apd.solicitud x WHERE x.solicitante_id = s.solicitante_id AND x.tipo_acreditacion = 'dictaminador')
      ORDER BY s.folio LIMIT 1;
     CREATE TEMP TABLE c AS SELECT count(*) AS n FROM apd.solicitante WHERE numero_expediente IS NOT NULL;
     INSERT INTO apd.solicitud (id, solicitante_id, tipo_acreditacion, modalidad, perfil_academico, carrera, anios_experiencia)
     VALUES ('00000000-0000-4000-a000-000000000009', (SELECT solicitante_id FROM p), 'dictaminador', 'nueva', 'titulo', 'Biología', 3);
     SELECT apd.asignar_expediente((SELECT solicitante_id FROM p));
     DO $$ BEGIN
       ASSERT (SELECT numero_expediente FROM apd.solicitante WHERE id = (SELECT solicitante_id FROM p)) = (SELECT numero_expediente FROM p);
       ASSERT (SELECT count(*) FROM apd.solicitante WHERE numero_expediente IS NOT NULL) = (SELECT n FROM c);
     END $$;`],
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
       ASSERT (SELECT count(*) FROM antes) = 4;
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
  ['No se concluye un grupo con calificaciones pendientes', { codigo: 'faltan_calificaciones' }, '2026-10-17 20:00', `
     INSERT INTO apd.asistencia (inscripcion_id, dia, asistio, capturada_por)
     SELECT i.id, d, true, 'i' FROM apd.inscripcion i, generate_series(2, 5) d WHERE i.grupo_id = ${GRUPO_EN_CURSO} AND i.activa;
     UPDATE apd.grupo SET estado = 'concluido' WHERE id = ${GRUPO_EN_CURSO};`],
  ['Recorrido completo: cinco días, examen, conclusión, emisión y verificación', 'ok', '2026-10-17 20:00', `
     CREATE TEMP TABLE g AS SELECT ${GRUPO_EN_CURSO} AS id; -- el grupo deja de estar «en curso» a la mitad del caso
     -- quien faltó el día 1 falta también el día 2: 3 de 5, sin derecho a examen; los demás asisten todo
     INSERT INTO apd.asistencia (inscripcion_id, dia, asistio, capturada_por)
     SELECT i.id, d, NOT (d = 2 AND EXISTS (SELECT 1 FROM apd.asistencia a WHERE a.inscripcion_id = i.id AND NOT a.asistio)), 'otro.instructor'
       FROM apd.inscripcion i, generate_series(2, 5) d WHERE i.grupo_id = (SELECT id FROM g) AND i.activa;
     INSERT INTO apd.examen (inscripcion_id, presentado_en, calificacion, capturado_por)
     SELECT i.id, '2026-10-17', 8, 'i' FROM apd.inscripcion i
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
       ASSERT (SELECT bool_and(situacion = 'Vigente' AND vence_en = '2027-10-16') FROM apd.verificacion_publica
                WHERE emitida_en = '2026-10-17');
     END $$;`],
  ['Con 7.0 se aprueba poda; con 6.9 no (R34)', 'ok', '2026-10-17 20:00', `
     CREATE TEMP TABLE g AS SELECT ${GRUPO_EN_CURSO} AS id;
     INSERT INTO apd.asistencia (inscripcion_id, dia, asistio, capturada_por)
     SELECT i.id, d, true, 'i' FROM apd.inscripcion i, generate_series(2, 5) d WHERE i.grupo_id = (SELECT id FROM g) AND i.activa;
     CREATE TEMP TABLE dos AS SELECT i.id, row_number() OVER (ORDER BY i.id) AS n FROM apd.inscripcion i
      WHERE i.grupo_id = (SELECT id FROM g) AND i.activa
        AND (SELECT count(*) FROM apd.asistencia a WHERE a.inscripcion_id = i.id AND a.asistio) = 5 LIMIT 2;
     INSERT INTO apd.examen (inscripcion_id, presentado_en, calificacion, capturado_por, origen)
     SELECT id, '2026-10-17', CASE n WHEN 1 THEN 7.0 ELSE 6.9 END, 'sistema-examen', 'examen_web' FROM dos;
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
     INSERT INTO apd.solicitante (curp, nombre, primer_apellido, correo, telefono, contrasena_hash)
     SELECT curp, 'Otra', 'Persona', 'otra@ejemplo.local', '0000000098', 'x' FROM apd.solicitante LIMIT 1;`],
  ['Una CURP con formato inválido se rechaza', { sqlstate: '23514' }, null, `
     INSERT INTO apd.solicitante (curp, nombre, primer_apellido, correo, telefono, contrasena_hash)
     VALUES ('ABC123', 'Otra', 'Persona', 'otra@ejemplo.local', '0000000098', 'x');`],
  ['Una CURP con dígito verificador incorrecto se rechaza, igual que en el formulario', { sqlstate: '23514' }, null, `
     INSERT INTO apd.solicitante (curp, nombre, primer_apellido, correo, telefono, contrasena_hash)
     VALUES ('XAXX991231HNEXXX01', 'Otra', 'Persona', 'otra@ejemplo.local', '0000000098', 'x');`],
  ['La persona no corrige su propia CURP', { codigo: 'curp_sin_motivo' }, null, `
     SELECT set_config('apd.usuario_tipo', 'solicitante', true);
     UPDATE apd.solicitante SET curp = 'XAXX991230HNEXXX08' WHERE id = ${PERSONA_VIGENTE};`],
  ['La Secretaría corrige una CURP con motivo, y queda en la bitácora', 'ok', null, `
     SELECT set_config('apd.motivo', 'Error de captura comprobado con la identificación', true);
     UPDATE apd.solicitante SET curp = 'XAXX991230HNEXXX08' WHERE id = ${PERSONA_VIGENTE};
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
