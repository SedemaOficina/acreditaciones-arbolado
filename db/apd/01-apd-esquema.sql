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

-- Identificadores: la base rechaza lo mismo que rechaza el formulario (y su validación en el servidor), con las
-- reglas del Estándar de formularios del SIA (validaciones.config.js). Así un dato que entra sin pasar por el
-- formulario (la migración, el backend o una carga a mano) no queda guardado con algo que el formulario rechazaría
-- después, al editar el perfil o renovar (hallazgo A1-01, auditoría 2026-10-19). herramientas/probar-reglas.mjs
-- cruza los dos validadores con los mismos valores.

-- ¿Existe ese día? (31 de abril no, 29 de febrero sólo en año bisiesto)
CREATE FUNCTION apd.es_fecha_real(a integer, m integer, d integer) RETURNS boolean
  LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS $$
BEGIN
  IF a IS NULL OR m IS NULL OR d IS NULL OR m NOT BETWEEN 1 AND 12 OR d < 1 THEN RETURN false; END IF;
  RETURN d <= extract(day FROM make_date(a, m, 1) + interval '1 month' - interval '1 day');
END $$;

-- CURP: las cinco capas del formato «curp» del estándar: estructura, fecha real de nacimiento (el siglo lo da el
-- carácter 17: dígito, 1900; letra, 2000), fecha no futura (en la Ciudad de México), clave de entidad de nacimiento y
-- dígito verificador. Un formato correcto no prueba que la CURP exista: eso lo contrasta, si se decide, el servicio
-- oficial de consulta (pregunta abierta en docs/DECISIONES.md). STABLE y no IMMUTABLE: «no futura» depende del día.
CREATE FUNCTION apd.curp_valida(c text) RETURNS boolean LANGUAGE plpgsql STABLE PARALLEL SAFE AS $$
DECLARE nacimiento date;
BEGIN
  IF c IS NULL OR c !~ '^[A-Z][AEIOUX][A-Z]{2}[0-9]{6}[HMX][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[0-9A-Z][0-9]$' THEN RETURN false; END IF;
  IF NOT apd.es_fecha_real(CASE WHEN substr(c, 17, 1) ~ '[0-9]' THEN 1900 ELSE 2000 END + substr(c, 5, 2)::integer,
                           substr(c, 7, 2)::integer, substr(c, 9, 2)::integer) THEN
    RETURN false;
  END IF;
  nacimiento := make_date(CASE WHEN substr(c, 17, 1) ~ '[0-9]' THEN 1900 ELSE 2000 END + substr(c, 5, 2)::integer,
                          substr(c, 7, 2)::integer, substr(c, 9, 2)::integer);
  IF nacimiento > (now() AT TIME ZONE 'America/Mexico_City')::date THEN RETURN false; END IF;
  IF NOT substr(c, 12, 2) = ANY (ARRAY['AS','BC','BS','CC','CL','CM','CS','CH','DF','DG','GT','GR','HG','JC','MC','MN',
                                       'MS','NT','NL','OC','PL','QT','QR','SP','SL','SR','TC','TS','TL','VZ','YN','ZS','NE']) THEN
    RETURN false;
  END IF;
  RETURN right(c, 1) = ((10 - (SELECT sum((strpos('0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ', substr(c, i, 1)) - 1) * (19 - i))
                                 FROM generate_series(1, 17) AS i) % 10) % 10)::text;
END $$;
COMMENT ON FUNCTION apd.curp_valida(text) IS 'Estructura, fecha real y no futura, entidad y dígito verificador de la CURP, con las mismas reglas que el Estándar de formularios del SIA.';

-- Fecha de nacimiento que dice la CURP (posiciones 5 a 10, AAMMDD; el siglo, del carácter 17 como en curp_valida). La
-- cuenta no guarda otra fecha de nacimiento: la mayoría de edad (P138, sesión del 23/10/2026) se calcula con ésta.
CREATE FUNCTION apd.curp_nacimiento(c text) RETURNS date LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT CASE WHEN c ~ '^[A-Z]{4}[0-9]{6}' AND length(c) = 18
                   AND apd.es_fecha_real(CASE WHEN substr(c, 17, 1) ~ '[0-9]' THEN 1900 ELSE 2000 END + substr(c, 5, 2)::integer,
                                         substr(c, 7, 2)::integer, substr(c, 9, 2)::integer)
              THEN make_date(CASE WHEN substr(c, 17, 1) ~ '[0-9]' THEN 1900 ELSE 2000 END + substr(c, 5, 2)::integer,
                             substr(c, 7, 2)::integer, substr(c, 9, 2)::integer) END
$$;
COMMENT ON FUNCTION apd.curp_nacimiento(text) IS 'Fecha de nacimiento que codifica la CURP (AAMMDD y el siglo del carácter 17); NULL si no se puede leer.';

-- RFC: estructura (3 o 4 letras, con Ñ y &, seis dígitos y homoclave) y fecha real, en el siglo 1900 o 2000, como el
-- formato «rfc» del estándar
CREATE FUNCTION apd.rfc_valido(r text) RETURNS boolean LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS $$
DECLARE aa integer; mm integer; dd integer;
BEGIN
  IF r IS NULL OR r !~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$' THEN RETURN false; END IF;
  aa := substr(r, length(r) - 8, 2)::integer;
  mm := substr(r, length(r) - 6, 2)::integer;
  dd := substr(r, length(r) - 4, 2)::integer;
  RETURN apd.es_fecha_real(2000 + aa, mm, dd) OR apd.es_fecha_real(1900 + aa, mm, dd);
END $$;
COMMENT ON FUNCTION apd.rfc_valido(text) IS 'Estructura y fecha real del RFC, con las mismas reglas que el Estándar de formularios del SIA.';

-- Correo: en minúsculas, a lo más 120 caracteres, una sola arroba y un dominio que termina en dos letras o más, como
-- el formato «correo» del estándar
CREATE FUNCTION apd.correo_valido(c text) RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT c IS NOT NULL AND c = lower(c) AND length(c) <= 120 AND c ~ '^[^@\s]+@[^\s@]+\.[^\s@.]{2,}$'
$$;
COMMENT ON FUNCTION apd.correo_valido(text) IS 'Largo, arroba y terminación del dominio del correo, con las mismas reglas que el Estándar de formularios del SIA.';

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
