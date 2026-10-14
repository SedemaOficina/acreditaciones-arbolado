-- ESQUEMA apd · Sistema de Acreditaciones de Poda y Dictaminación. Lo corre quien administra la base,
-- dentro de instalar.sql.
--
-- Este proyecto no usa PostGIS ni el esquema territorio: no guarda ubicaciones (decisión 4 de
-- docs/DECISIONES-SIA.md). Por eso la comprobación sólo exige PostgreSQL 13 o mayor (gen_random_uuid).
--
-- Una instalación nunca escribe sobre otra: si el esquema ya está instalado, se detiene sin tocar nada.
-- Los cambios posteriores van como migraciones numeradas, anotadas en apd.migraciones.

DO $$
BEGIN
  IF current_setting('server_version_num')::int < 130000 THEN
    RAISE EXCEPTION 'El esquema apd requiere PostgreSQL 13 o mayor';
  END IF;
  IF to_regclass('apd.migraciones') IS NOT NULL THEN
    RAISE EXCEPTION 'El esquema apd ya está instalado (versión %): los cambios van como migración, no como instalación',
      (SELECT max(version) FROM apd.migraciones);
  END IF;
END $$;

CREATE SCHEMA IF NOT EXISTS apd;
COMMENT ON SCHEMA apd IS 'Sistema de Acreditaciones de Poda y Dictaminación: solicitudes, cursos, grupos y padrón de acreditaciones de arbolado urbano.';

-- Nadie más usa el esquema salvo a quien se le concede en 05-apd-rol-y-permisos.sql
REVOKE ALL ON SCHEMA apd FROM PUBLIC;

-- Qué versiones del esquema están aplicadas. La instalación es la 1; cada migración agrega la suya.
CREATE TABLE apd.migraciones (
  version      integer      NOT NULL,
  nombre       text         NOT NULL,
  aplicada_en  timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT migraciones_pk PRIMARY KEY (version)
);
COMMENT ON TABLE apd.migraciones IS 'Versiones del esquema aplicadas, en orden. La instalación es la 1.';

-- CURP: las mismas tres capas que el Estándar de formularios del SIA (validaciones.config.js, formato
-- «curp»): estructura, clave de entidad de nacimiento y dígito verificador. Así la base no acepta una CURP
-- que el formulario rechazaría, ni al revés. Un formato correcto no prueba que la CURP exista: eso lo
-- contrasta, si se decide, el servicio oficial de consulta (pregunta abierta en docs/DECISIONES.md).
CREATE FUNCTION apd.curp_valida(c text) RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT c ~ '^[A-Z][AEIOUX][A-Z]{2}[0-9]{6}[HMX][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[0-9A-Z][0-9]$'
     AND substr(c, 12, 2) = ANY (ARRAY['AS','BC','BS','CC','CL','CM','CS','CH','DF','DG','GT','GR','HG','JC','MC','MN',
                                       'MS','NT','NL','OC','PL','QT','QR','SP','SL','SR','TC','TS','TL','VZ','YN','ZS','NE'])
     AND right(c, 1) = ((10 - (SELECT sum((strpos('0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ', substr(c, i, 1)) - 1) * (19 - i))
                                 FROM generate_series(1, 17) AS i) % 10) % 10)::text
$$;
COMMENT ON FUNCTION apd.curp_valida(text) IS 'Estructura, entidad y dígito verificador de la CURP, con las mismas reglas que el Estándar de formularios del SIA.';

-- BITÁCORA. Sólo crece: ni la cuenta del servicio ni nadie la edita, la borra o la vacía.
-- Quién, cuándo, qué y desde dónde: el backend lo declara al inicio de cada transacción con
--   SELECT set_config('apd.usuario', '<cuenta>', true), set_config('apd.usuario_tipo', '<tipo>', true),
--          set_config('apd.procedencia', '<dirección>', true);
-- y los disparadores de 03-apd-reglas.sql escriben aquí cada cambio de estado.
CREATE TABLE apd.bitacora (
  id            uuid         NOT NULL DEFAULT gen_random_uuid(),
  fecha         timestamptz  NOT NULL DEFAULT now(),
  usuario       text         NOT NULL DEFAULT '',
  usuario_tipo  text         NOT NULL DEFAULT 'sistema',
  procedencia   text         NOT NULL DEFAULT '',
  accion        text         NOT NULL,
  entidad       text         NOT NULL,
  entidad_id    text         NOT NULL,
  detalle       text         NOT NULL DEFAULT '',
  CONSTRAINT bitacora_pk PRIMARY KEY (id),
  CONSTRAINT bitacora_usuario_tipo_ck CHECK (usuario_tipo IN ('solicitante', 'personal', 'sistema', 'migracion'))
);
CREATE INDEX bitacora_entidad_id ON apd.bitacora (entidad_id);
CREATE INDEX bitacora_fecha ON apd.bitacora (fecha);
COMMENT ON TABLE apd.bitacora IS 'Quién hizo qué, cuándo y desde dónde. No se edita ni se borra: lo impiden sus disparadores.';

CREATE FUNCTION apd.bitacora_inmutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'La bitácora de apd no se edita ni se borra';
END $$;
CREATE TRIGGER bitacora_inmutable BEFORE UPDATE OR DELETE ON apd.bitacora
  FOR EACH ROW EXECUTE FUNCTION apd.bitacora_inmutable();
CREATE TRIGGER bitacora_sin_vaciar BEFORE TRUNCATE ON apd.bitacora
  FOR EACH STATEMENT EXECUTE FUNCTION apd.bitacora_inmutable();
