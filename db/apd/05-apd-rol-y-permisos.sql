-- LA CUENTA DEL SERVICIO · apd_api, con lo mínimo para operar. Lo corre quien administra la base, al final
-- de instalar.sql, y anota la versión 1 del esquema.
--
-- La cuenta se crea SIN contraseña. Después, fuera de este guion:
--   1. quien administra la base le pone contraseña de forma interactiva (\password apd_api en psql),
--      para que no quede en ningún registro;
--   2. se habilita su entrada cifrada, sólo desde el servidor de aplicaciones;
--   3. se anotan APD_DB_USER y APD_DB_PASS en el archivo de entorno del backend;
--   4. y sólo entonces se despliega el backend con el módulo: sin sus variables, el backend no arranca.
-- La contraseña nunca va en este guion ni en el repositorio.
--
-- Este proyecto no lee territorio (decisión 4): la cuenta NO recibe territorio_lectura.
-- Nada se borra salvo lo que el sistema permite borrar: sesiones vencidas y requisitos de un curso.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'apd_api') THEN
    CREATE ROLE apd_api LOGIN INHERIT
      NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
      CONNECTION LIMIT 20;
  END IF;
END $$;

-- Sin public en su search_path (D-10, auditoría 2026-10-19): nada que alguien cree en public se resuelve antes que lo de
-- apd (pg_temp, al final, por la misma razón). En PostgreSQL 13 y 14, PUBLIC puede crear en el esquema public por
-- omisión: ahí, quien administra la base debe correr antes REVOKE CREATE ON SCHEMA public FROM PUBLIC (docs/REGLAS.md,
-- «Permisos»); este guion lo avisa abajo si no se ha hecho.
ALTER ROLE apd_api SET search_path = apd, pg_temp;
REVOKE CREATE ON SCHEMA public FROM apd_api;
DO $$
BEGIN
  IF has_schema_privilege('public', 'public', 'CREATE') THEN
    RAISE WARNING 'PUBLIC puede crear objetos en el esquema public (PostgreSQL < 15): corra REVOKE CREATE ON SCHEMA public FROM PUBLIC antes de usar la base (docs/REGLAS.md, «Permisos»)';
  END IF;
END $$;
GRANT USAGE ON SCHEMA apd TO apd_api;

-- Configuración editable desde la administración (sólo los valores, nunca las claves)
GRANT SELECT ON apd.parametro TO apd_api;
GRANT UPDATE (valor) ON apd.parametro TO apd_api;
GRANT SELECT ON apd.curso TO apd_api;
GRANT SELECT ON apd.cuota TO apd_api;
GRANT UPDATE (concepto, monto, fundamento, vigente_desde) ON apd.cuota TO apd_api;
GRANT UPDATE (nombre, dias_duracion, dias_minimos_asistencia, calificacion_minima, cupo_minimo, cupo_maximo, activo,
              pago_concepto, pago_monto, pago_fundamento, pago_vigente_desde)
  ON apd.curso TO apd_api;
GRANT SELECT, INSERT ON apd.requisito TO apd_api;
GRANT UPDATE (nombre, descripcion, enlace, enlace_texto, nombre_archivo, formatos, activo) ON apd.requisito TO apd_api;
GRANT SELECT, INSERT, DELETE ON apd.requisito_curso TO apd_api;
GRANT UPDATE (orden, obligatorio, nota) ON apd.requisito_curso TO apd_api;
GRANT SELECT, INSERT ON apd.organizacion TO apd_api;
GRANT SELECT, INSERT ON apd.carrera TO apd_api;
GRANT UPDATE (nombre, grupo, activa) ON apd.carrera TO apd_api;
GRANT UPDATE (tipo, nombre, activa) ON apd.organizacion TO apd_api;

-- Cuentas y sesiones de solicitantes
GRANT SELECT, INSERT ON apd.solicitante TO apd_api;
GRANT UPDATE (curp, nombre, primer_apellido, segundo_apellido, correo, telefono, adscripcion, organizacion_id, contrasena_hash, estado,
              intentos_fallidos, bloqueada_hasta, bloqueo_motivo, debe_cambiar_contrasena) ON apd.solicitante TO apd_api;
GRANT SELECT, INSERT, DELETE ON apd.sesion_solicitante TO apd_api;
GRANT UPDATE (cerrada_en) ON apd.sesion_solicitante TO apd_api;
-- Fotografía de frente: no se borra; la confirmación sólo cambia estado (y la sustitución, vigente)
GRANT SELECT, INSERT ON apd.fotografia TO apd_api;
GRANT UPDATE (estado, vigente) ON apd.fotografia TO apd_api;

-- Trámite
GRANT SELECT, INSERT ON apd.solicitud TO apd_api;
GRANT UPDATE (tipo_acreditacion, modalidad, acreditacion_anterior_id,
              factura_rfc, factura_razon_social, factura_folio_fiscal,
              nivel_estudios, carrera, carrera_tecnica, estatus_estudios, anios_experiencia, estado, cita_en, motivo_cierre)
  ON apd.solicitud TO apd_api;
GRANT SELECT, INSERT ON apd.revision TO apd_api;
-- Citas de cotejo: las crea la base al asignar la cita; el personal registra lo que pasó (nunca se borran)
GRANT SELECT, INSERT ON apd.cita TO apd_api;
GRANT UPDATE (resultado, observacion) ON apd.cita TO apd_api;
GRANT SELECT, INSERT ON apd.documento TO apd_api;
GRANT UPDATE (estado, observacion, revisado_por, vigente) ON apd.documento TO apd_api;
-- Material de estudio: el archivo no se modifica (se carga uno nuevo); el personal cambia sus datos y su publicación
GRANT SELECT, INSERT ON apd.material_estudio TO apd_api;
GRANT UPDATE (titulo, descripcion, edicion, tipo_acreditacion, temas, orden, publicado, vigente) ON apd.material_estudio TO apd_api;

-- Cursos
GRANT SELECT, INSERT ON apd.grupo TO apd_api;
GRANT UPDATE (instructor, sede, fecha_inicio, hora_entrada, estado, motivo_cancelacion) ON apd.grupo TO apd_api;
GRANT SELECT, INSERT ON apd.inscripcion TO apd_api;
GRANT UPDATE (activa, motivo_baja) ON apd.inscripcion TO apd_api;
GRANT SELECT, INSERT ON apd.asistencia TO apd_api;
GRANT UPDATE (asistio, capturada_por) ON apd.asistencia TO apd_api;
GRANT SELECT, INSERT ON apd.examen TO apd_api;

-- Padrón: se emite, se registra la entrega y se cancela con motivo y fundamento (P120; el día y quién los pone la base);
-- nada más
GRANT SELECT, INSERT ON apd.acreditacion TO apd_api;
GRANT UPDATE (entregada_en, cancelacion_motivo, cancelacion_fundamento) ON apd.acreditacion TO apd_api;
-- Reposición de la credencial (P140): la pide la persona con su acta; el personal la revisa y la entrega con la factura.
-- Nunca se borra
GRANT SELECT, INSERT ON apd.reposicion TO apd_api;
GRANT UPDATE (estado, observacion, motivo, acta_archivo_clave, acta_nombre_original, acta_tipo_mime, acta_tamano_bytes, acta_sha256,
              factura_rfc, factura_razon_social, factura_folio_fiscal) ON apd.reposicion TO apd_api;

-- Avisos por teléfono del registro asistido (decisión 2026-10-25): los crea la base (apd.avisar_por_telefono, SECURITY
-- DEFINER); el personal sólo registra el resultado (quién y cuándo los pone la base). Nunca se borran
GRANT SELECT ON apd.aviso_telefono TO apd_api;
GRANT UPDATE (resultado) ON apd.aviso_telefono TO apd_api;

-- Consultas
GRANT SELECT ON apd.verificacion_publica, apd.bandeja_demanda, apd.vencidas_en_espera, apd.material_publico, apd.avisos_telefono_pendientes TO apd_api;

-- La bitácora: sólo leerla. Los renglones los escriben las reglas por apd.registrar (SECURITY DEFINER, sólo desde un
-- disparador), con la fecha y el contexto que impone apd.bitacora_alta (D-13 y E2-06, auditoría 2026-10-19)
GRANT SELECT ON apd.bitacora TO apd_api;
GRANT SELECT ON apd.migraciones TO apd_api;

-- Folios y expedientes: ni el contador ni sus funciones (decisión 6, 2026-10-19; E2-07). Los piden sólo las reglas que
-- dan de alta solicitudes, grupos y acreditaciones y la que concluye el cotejo, que corren con los permisos de quien
-- instala (SECURITY DEFINER, search_path fijo)
REVOKE ALL ON FUNCTION apd.siguiente_folio(text, smallint) FROM PUBLIC;
REVOKE ALL ON FUNCTION apd.asignar_expediente(uuid) FROM PUBLIC;

INSERT INTO apd.migraciones (version, nombre)
VALUES (1, 'Instalación')
ON CONFLICT (version) DO NOTHING;

/*
  VERIFICACIÓN · conectado COMO apd_api, no como quien administra la base
  (herramientas/probar-base.sh la corre completa en una base desechable)

  Debe funcionar:
      SELECT count(*) FROM apd.bitacora;
      SELECT count(*) FROM apd.bandeja_demanda;
      SHOW search_path;                                           -- apd, pg_temp

  Debe fallar (permiso denegado o regla); si alguna pasa, la cuenta quedó abierta de más:
      UPDATE apd.bitacora SET detalle = 'x';
      DELETE FROM apd.bitacora;
      INSERT INTO apd.bitacora (accion, entidad, entidad_id) VALUES ('x', 'x', 'x');
      SELECT apd.registrar('x', 'x', 'x');
      SELECT apd.avisar_por_telefono(gen_random_uuid(), NULL, 'S2');
      INSERT INTO apd.aviso_telefono (solicitante_id, aviso) VALUES (gen_random_uuid(), 'S2');
      SELECT apd.siguiente_folio('PD', 2026::smallint);
      SELECT apd.asignar_expediente(gen_random_uuid());
      DELETE FROM apd.solicitud;
      DELETE FROM apd.acreditacion;
      UPDATE apd.acreditacion SET vence_en = vence_en + 30;
      UPDATE apd.folio_contador SET ultimo = 0;
      UPDATE apd.parametro SET clave = 'x';
      CREATE TABLE apd.otra (x int);
      CREATE TABLE public.otra (x int);         -- en PostgreSQL 13-14, sólo después del REVOKE de «Permisos»
      INSERT INTO apd.migraciones VALUES (2, 'x');

  Y el control global, que debe dar 0: ningún permiso directo fuera de su esquema
      SELECT count(*) FROM information_schema.role_table_grants
       WHERE grantee = 'apd_api' AND table_schema <> 'apd';
*/
