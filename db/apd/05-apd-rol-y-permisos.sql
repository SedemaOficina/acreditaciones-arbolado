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

ALTER ROLE apd_api SET search_path = apd, public;
REVOKE CREATE ON SCHEMA public FROM apd_api;
GRANT USAGE ON SCHEMA apd TO apd_api;

-- Configuración editable desde la administración (sólo los valores, nunca las claves)
GRANT SELECT ON apd.parametro TO apd_api;
GRANT UPDATE (valor) ON apd.parametro TO apd_api;
GRANT SELECT ON apd.curso TO apd_api;
GRANT UPDATE (nombre, dias_duracion, dias_minimos_asistencia, calificacion_minima, cupo_minimo, cupo_maximo, activo,
              pago_concepto, pago_monto, pago_fundamento, pago_vigente_desde)
  ON apd.curso TO apd_api;
GRANT SELECT, INSERT ON apd.requisito TO apd_api;
GRANT UPDATE (nombre, descripcion, enlace, enlace_texto, nombre_archivo, formatos, activo) ON apd.requisito TO apd_api;
GRANT SELECT, INSERT, DELETE ON apd.requisito_curso TO apd_api;
GRANT UPDATE (orden, obligatorio, nota) ON apd.requisito_curso TO apd_api;
GRANT SELECT, INSERT ON apd.organizacion TO apd_api;
GRANT UPDATE (tipo, nombre, activa) ON apd.organizacion TO apd_api;

-- Cuentas y sesiones de solicitantes
GRANT SELECT, INSERT ON apd.solicitante TO apd_api;
GRANT UPDATE (curp, nombre, primer_apellido, segundo_apellido, correo, telefono, adscripcion, organizacion_id, contrasena_hash, estado,
              intentos_fallidos, bloqueada_hasta, debe_cambiar_contrasena) ON apd.solicitante TO apd_api;
GRANT SELECT, INSERT, DELETE ON apd.sesion_solicitante TO apd_api;
GRANT UPDATE (cerrada_en) ON apd.sesion_solicitante TO apd_api;
-- Fotografía de frente: no se borra; la confirmación sólo cambia estado (y la sustitución, vigente)
GRANT SELECT, INSERT ON apd.fotografia TO apd_api;
GRANT UPDATE (estado, vigente) ON apd.fotografia TO apd_api;

-- Trámite
GRANT SELECT, INSERT ON apd.solicitud TO apd_api;
GRANT UPDATE (tipo_acreditacion, modalidad, acreditacion_anterior_id,
              factura_rfc, factura_razon_social, factura_folio_fiscal,
              perfil_academico, carrera, anios_experiencia, estado, cita_en, motivo_cierre)
  ON apd.solicitud TO apd_api;
GRANT SELECT, INSERT ON apd.revision TO apd_api;
GRANT SELECT, INSERT ON apd.documento TO apd_api;
GRANT UPDATE (estado, observacion, revisado_por, vigente) ON apd.documento TO apd_api;

-- Cursos
GRANT SELECT, INSERT ON apd.grupo TO apd_api;
GRANT UPDATE (instructor, sede, fecha_inicio, estado, motivo_cancelacion) ON apd.grupo TO apd_api;
GRANT SELECT, INSERT ON apd.inscripcion TO apd_api;
GRANT UPDATE (activa, motivo_baja) ON apd.inscripcion TO apd_api;
GRANT SELECT, INSERT ON apd.asistencia TO apd_api;
GRANT UPDATE (asistio, capturada_por) ON apd.asistencia TO apd_api;
GRANT SELECT, INSERT ON apd.examen TO apd_api;

-- Padrón: se emite y se registra la entrega; nada más
GRANT SELECT, INSERT ON apd.acreditacion TO apd_api;
GRANT UPDATE (entregada_en) ON apd.acreditacion TO apd_api;

-- Consultas
GRANT SELECT ON apd.verificacion_publica, apd.bandeja_demanda, apd.vencidas_en_espera TO apd_api;

-- La bitácora: sólo leerla y agregarle renglones
GRANT SELECT, INSERT ON apd.bitacora TO apd_api;
GRANT SELECT ON apd.migraciones TO apd_api;

-- Los folios sólo por la función, que corre con los permisos de quien instala
REVOKE ALL ON FUNCTION apd.siguiente_folio(text, smallint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION apd.siguiente_folio(text, smallint) TO apd_api;
REVOKE ALL ON FUNCTION apd.asignar_expediente(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION apd.asignar_expediente(uuid) TO apd_api;

INSERT INTO apd.migraciones (version, nombre)
VALUES (1, 'Instalación')
ON CONFLICT (version) DO NOTHING;

/*
  VERIFICACIÓN · conectado COMO apd_api, no como quien administra la base
  (herramientas/probar-base.sh la corre completa en una base desechable)

  Debe funcionar:
      SELECT count(*) FROM apd.bitacora;
      SELECT count(*) FROM apd.bandeja_demanda;
      SELECT has_table_privilege('apd.bitacora', 'INSERT');      -- t

  Debe fallar (permiso denegado o regla); si alguna pasa, la cuenta quedó abierta de más:
      UPDATE apd.bitacora SET detalle = 'x';
      DELETE FROM apd.bitacora;
      DELETE FROM apd.solicitud;
      DELETE FROM apd.acreditacion;
      UPDATE apd.acreditacion SET vence_en = vence_en + 30;
      UPDATE apd.folio_contador SET ultimo = 0;
      UPDATE apd.parametro SET clave = 'x';
      CREATE TABLE apd.otra (x int);
      CREATE TABLE public.otra (x int);
      INSERT INTO apd.migraciones VALUES (2, 'x');

  Y el control global, que debe dar 0: ningún permiso directo fuera de su esquema
      SELECT count(*) FROM information_schema.role_table_grants
       WHERE grantee = 'apd_api' AND table_schema <> 'apd';
*/
