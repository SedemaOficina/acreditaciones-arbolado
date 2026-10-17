-- REGLAS DEL ESQUEMA apd. Lo corre quien administra la base, dentro de instalar.sql, después de las tablas.
--
-- Aquí vive lo que debe valer siempre, aunque alguien escriba sin pasar por la aplicación (guía SIA,
-- sección 3): folios, vigencia, estados de la solicitud y del grupo, cupos, asistencia y examen, y la
-- bitácora de cada cambio. Cada regla cita la decisión de docs/DECISIONES.md de donde sale.
--
-- Errores. Toda regla incumplida se levanta con apd.error(codigo, mensaje): el mensaje es para la persona,
-- en español; el código viaja en HINT con el prefijo «apd:» para que el backend responda { codigo, mensaje }.
--
-- Contexto de quien escribe. El backend lo declara al inicio de cada transacción:
--   SELECT set_config('apd.usuario', '<cuenta>', true), set_config('apd.usuario_tipo', 'personal', true),
--          set_config('apd.procedencia', '<dirección>', true);
-- y, cuando una regla pide motivo, set_config('apd.motivo', '<texto>', true).

-- ───────────────────────────── Utilidades ─────────────────────────────

CREATE FUNCTION apd.error(codigo text, mensaje text) RETURNS void
  LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = mensaje, HINT = 'apd:' || codigo;
END $$;
COMMENT ON FUNCTION apd.error(text, text) IS 'Levanta una regla incumplida con su código para el backend (HINT apd:<codigo>).';

CREATE FUNCTION apd.contexto(nombre text) RETURNS text
  LANGUAGE sql STABLE AS $$ SELECT coalesce(current_setting('apd.' || nombre, true), '') $$;

CREATE FUNCTION apd.parametro_texto(p_clave text) RETURNS text
  LANGUAGE plpgsql STABLE AS $$
DECLARE v text;
BEGIN
  SELECT valor INTO v FROM apd.parametro WHERE clave = p_clave;
  IF v IS NULL THEN
    PERFORM apd.error('parametro_inexistente', format('Falta el parámetro %s en apd.parametro', p_clave));
  END IF;
  RETURN v;
END $$;

-- La hora del sistema. En una base de pruebas se puede simular (apd.ahora_simulado) para probar plazos y
-- vigencias con fechas movidas, como pide la guía (sección 8). Si la base es de producción, simular es un
-- error, no algo que se ignore en silencio.
--
-- Qué base es lo dice apd.entorno(), que se instala devolviendo «produccion». Sólo quien administra la base
-- puede reemplazarla (la cuenta del servicio no es dueña de funciones), y sólo una base de pruebas lo hace
-- (herramientas/probar-base.sh). Por eso no es un parámetro de la tabla: la aplicación podría cambiarlo.
CREATE FUNCTION apd.entorno() RETURNS text
  LANGUAGE sql STABLE AS $$ SELECT 'produccion'::text $$;

CREATE FUNCTION apd.ahora() RETURNS timestamptz
  LANGUAGE plpgsql STABLE AS $$
DECLARE simulado text := apd.contexto('ahora_simulado');
BEGIN
  IF simulado = '' THEN
    RETURN now();
  END IF;
  IF apd.entorno() <> 'pruebas' THEN
    PERFORM apd.error('simulacion_prohibida', 'La hora simulada sólo existe en una base de pruebas');
  END IF;
  RETURN simulado::timestamptz;
END $$;
COMMENT ON FUNCTION apd.ahora() IS 'now(), o la hora simulada en el entorno de pruebas. Todas las reglas usan esta y no now().';

-- El día en la Ciudad de México, sin importar la zona horaria del servidor (norma 4.5: una columna, un formato).
CREATE FUNCTION apd.hoy() RETURNS date
  LANGUAGE sql STABLE AS $$ SELECT (apd.ahora() AT TIME ZONE 'America/Mexico_City')::date $$;

CREATE FUNCTION apd.registrar(p_accion text, p_entidad text, p_entidad_id text, p_detalle text DEFAULT '')
  RETURNS void LANGUAGE plpgsql AS $$
DECLARE tipo text := apd.contexto('usuario_tipo');
BEGIN
  INSERT INTO apd.bitacora (fecha, usuario, usuario_tipo, procedencia, accion, entidad, entidad_id, detalle)
  VALUES (apd.ahora(), apd.contexto('usuario'), CASE WHEN tipo = '' THEN 'sistema' ELSE tipo END,
          apd.contexto('procedencia'), p_accion, p_entidad, p_entidad_id, coalesce(p_detalle, ''));
END $$;

-- Nombre comparable: sin acentos, minúsculas, sin puntuación y sin espacios dobles («C.F.E.» = «CFE»).
CREATE FUNCTION apd.normalizar(t text) RETURNS text
  LANGUAGE sql IMMUTABLE AS $$
  SELECT trim(regexp_replace(regexp_replace(
           lower(translate(t, 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')),
           '[^a-z0-9 ]', '', 'g'), '\s+', ' ', 'g'))
$$;

-- Folios y números de expediente: un contador por serie y año, avanzado en un solo paso para que dos altas simultáneas nunca
-- reciban el mismo número. SECURITY DEFINER: la cuenta del servicio no toca folio_contador directamente.
CREATE FUNCTION apd.siguiente_folio(p_serie text, p_anio smallint) RETURNS integer
  LANGUAGE sql SECURITY DEFINER SET search_path = apd, pg_temp AS $$
  INSERT INTO apd.folio_contador AS f (serie, anio, ultimo) VALUES (p_serie, p_anio, 1)
  ON CONFLICT (serie, anio) DO UPDATE SET ultimo = f.ultimo + 1
  RETURNING ultimo
$$;

-- ───────────────────────────── Parámetros y cursos ─────────────────────────────
-- Editables por la administración (decisión: cupos 10–25 editables). Cada cambio, a la bitácora.

CREATE FUNCTION apd.parametro_cambio() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.actualizado_en := apd.ahora();
  IF NEW.valor IS DISTINCT FROM OLD.valor THEN
    PERFORM apd.registrar('cambio_parametro', 'parametro', NEW.clave, format('%s → %s', OLD.valor, NEW.valor));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER parametro_cambio BEFORE UPDATE ON apd.parametro
  FOR EACH ROW EXECUTE FUNCTION apd.parametro_cambio();

CREATE FUNCTION apd.curso_cambio() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.actualizado_en := apd.ahora();
  -- Costo del curso (decisión 2026-10-14): lo actualiza el personal cuando la Gaceta Oficial publica uno
  -- nuevo; cada curso tiene el suyo. Queda en la bitácora con la publicación que lo fija. Las solicitudes que
  -- ya tienen cita conservan el monto que se les indicó (apd.solicitud.pago_monto).
  IF (NEW.pago_monto, NEW.pago_fundamento, NEW.pago_vigente_desde)
     IS DISTINCT FROM (OLD.pago_monto, OLD.pago_fundamento, OLD.pago_vigente_desde) THEN
    IF apd.contexto('usuario_tipo') <> 'personal' THEN
      PERFORM apd.error('monto_de_personal', 'El costo del curso lo actualiza el personal de la Secretaría');
    END IF;
    PERFORM apd.registrar('cambio_monto', 'curso', NEW.tipo_acreditacion || '/' || NEW.modalidad,
      format('%s → %s desde %s. %s', coalesce(OLD.pago_monto::text, 'sin monto'), coalesce(NEW.pago_monto::text, 'sin monto'),
             coalesce(NEW.pago_vigente_desde::text, '—'), coalesce(NEW.pago_fundamento, '')));
  END IF;
  PERFORM apd.registrar('cambio_curso', 'curso', NEW.tipo_acreditacion || '/' || NEW.modalidad,
    format('duración %s→%s; asistencia %s→%s; calificación %s→%s; cupo %s-%s→%s-%s; activo %s→%s',
      OLD.dias_duracion, NEW.dias_duracion, OLD.dias_minimos_asistencia, NEW.dias_minimos_asistencia,
      OLD.calificacion_minima, NEW.calificacion_minima, OLD.cupo_minimo, OLD.cupo_maximo,
      NEW.cupo_minimo, NEW.cupo_maximo, OLD.activo, NEW.activo));
  RETURN NEW;
END $$;
CREATE TRIGGER curso_cambio BEFORE UPDATE ON apd.curso
  FOR EACH ROW EXECUTE FUNCTION apd.curso_cambio();

-- ───────────────────────────── Organizaciones ─────────────────────────────

CREATE FUNCTION apd.organizacion_normalizar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.nombre := regexp_replace(trim(NEW.nombre), '\s+', ' ', 'g');
  NEW.nombre_normalizado := apd.normalizar(NEW.nombre);
  IF NEW.nombre_normalizado = '' THEN
    PERFORM apd.error('organizacion_sin_nombre', 'La organización necesita un nombre');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER organizacion_normalizar BEFORE INSERT OR UPDATE OF nombre ON apd.organizacion
  FOR EACH ROW EXECUTE FUNCTION apd.organizacion_normalizar();

-- ───────────────────────────── Carreras y perfil del dictaminador ─────────────────────────────

CREATE FUNCTION apd.carrera_normalizar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.nombre := regexp_replace(trim(NEW.nombre), '\s+', ' ', 'g');
  NEW.nombre_normalizado := apd.normalizar(NEW.nombre);
  IF NEW.nombre_normalizado = '' THEN
    PERFORM apd.error('carrera_sin_nombre', 'La carrera necesita un nombre');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER carrera_normalizar BEFORE INSERT OR UPDATE OF nombre ON apd.carrera
  FOR EACH ROW EXECUTE FUNCTION apd.carrera_normalizar();

-- La Secretaría clasifica en la revisión documental las carreras que escriben las personas (P62, decisión 2026-10-15):
-- sólo el personal, y queda en la bitácora. Al clasificarla, las solicitudes abiertas con esa carrera recalculan su
-- perfil y su experiencia mínima; las aceptadas (principal, afín o disciplina afín) se sugieren desde entonces.
CREATE FUNCTION apd.carrera_clasificar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.grupo IS DISTINCT FROM OLD.grupo AND apd.contexto('usuario_tipo') <> 'personal' THEN
    PERFORM apd.error('clasificacion_sin_permiso', 'Sólo el personal de la Secretaría clasifica las carreras');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER carrera_clasificar BEFORE UPDATE OF grupo ON apd.carrera
  FOR EACH ROW EXECUTE FUNCTION apd.carrera_clasificar();

CREATE FUNCTION apd.carrera_clasificada() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.grupo IS DISTINCT FROM OLD.grupo THEN
    PERFORM apd.registrar('clasificar', 'carrera', NEW.id::text,
      format('%s: %s → %s', NEW.nombre, coalesce(OLD.grupo, 'sin clasificar'), coalesce(NEW.grupo, 'sin clasificar')));
    UPDATE apd.solicitud SET carrera = carrera
     WHERE carrera_id = NEW.id AND estado IN ('borrador', 'enviada', 'con_observaciones');
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER carrera_clasificada AFTER UPDATE OF grupo ON apd.carrera
  FOR EACH ROW EXECUTE FUNCTION apd.carrera_clasificada();

-- Perfil académico del dictaminador según los lineamientos (decisión 2026-10-15, Liber):
--   a) licenciatura titulada en Biología, Ingeniería Forestal, Ingeniería Agrónoma o carrera afín → 2 años;
--   c) carta de pasante, carrera técnica o disciplina afín → 5 años.
-- «Con licenciatura» es titulada; concluida sin título es carta de pasante. Un posgrado (maestría o doctorado, aun en
-- curso) cuenta como licenciatura titulada en su área, aunque la licenciatura sea de otra (p. ej. Química con
-- maestría en Ciencias Forestales: 2 años) (confirmado por Liber, 2026-10-15). Hasta preparatoria, o licenciatura en
-- curso o trunca: «no_cumple», que no impide enviar; lo resuelve el personal en la revisión documental.
-- Una carrera sin clasificar deja el perfil «por_clasificar»: lo resuelve la Secretaría en la revisión documental.
CREATE FUNCTION apd.perfil_academico(p_nivel text, p_estatus text, p_grupo text) RETURNS text
  LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN p_nivel IS NULL THEN NULL
    WHEN p_nivel IN ('ninguna', 'preescolar', 'primaria', 'secundaria', 'preparatoria') THEN 'no_cumple'
    WHEN p_nivel = 'tecnica' THEN 'tecnica'
    WHEN p_estatus IS NULL THEN NULL
    WHEN p_nivel = 'licenciatura' AND p_estatus IN ('en_curso', 'trunco') THEN 'no_cumple'
    WHEN p_grupo IS NULL THEN 'por_clasificar'
    WHEN p_grupo = 'no_afin' THEN 'no_cumple'
    WHEN p_nivel = 'licenciatura' AND p_estatus = 'concluido' THEN 'pasante'
    WHEN p_grupo IN ('principal', 'afin') THEN 'licenciatura_afin'
    ELSE 'disciplina_afin'
  END
$$;
CREATE FUNCTION apd.experiencia_minima(p_perfil text) RETURNS numeric
  LANGUAGE sql IMMUTABLE AS $$
  -- Sólo la licenciatura (o posgrado) en carrera principal o afín baja a 2 años; todo lo demás, incluido lo que decide el
  -- personal (por clasificar o no cumple), pide 5 (decisión 2026-10-15, Liber)
  SELECT CASE WHEN p_perfil IS NULL THEN NULL WHEN p_perfil = 'licenciatura_afin' THEN 2 ELSE 5 END::numeric
$$;

-- La base completa los estudios (poda y dictaminador, decisión 2026-10-15): liga la carrera al catálogo (si la escrita
-- no existe, la agrega sin grupo) y, en dictaminador, calcula perfil y experiencia mínima. Lo que no corresponde se
-- descarta: carrera y situación de los estudios sólo con licenciatura, maestría o doctorado (decisión 2026-10-15); el
-- nombre de la carrera técnica, sólo con carrera técnica y sin catálogo (decisión 2026-10-17).
-- Se recalcula en cada cambio, así que una carrera que la Secretaría clasifica después se refleja.
CREATE FUNCTION apd.solicitud_perfil() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c apd.carrera;
BEGIN
  IF NEW.nivel_estudios IS NULL OR NEW.nivel_estudios NOT IN ('licenciatura', 'maestria', 'doctorado') THEN
    NEW.carrera := NULL; NEW.estatus_estudios := NULL;
  END IF;
  IF NEW.nivel_estudios IS DISTINCT FROM 'tecnica' THEN NEW.carrera_tecnica := NULL; END IF;
  NEW.carrera_tecnica := nullif(regexp_replace(trim(coalesce(NEW.carrera_tecnica, '')), '\s+', ' ', 'g'), '');
  NEW.carrera := nullif(regexp_replace(trim(coalesce(NEW.carrera, '')), '\s+', ' ', 'g'), '');
  NEW.carrera_id := NULL;
  IF NEW.carrera IS NOT NULL THEN
    SELECT * INTO c FROM apd.carrera WHERE nombre_normalizado = apd.normalizar(NEW.carrera);
    IF c.id IS NULL THEN
      INSERT INTO apd.carrera (nombre, es_ficticio) VALUES (NEW.carrera, NEW.es_ficticio) RETURNING * INTO c;
    END IF;
    NEW.carrera_id := c.id;
  END IF;
  IF NEW.tipo_acreditacion <> 'dictaminador' THEN
    NEW.perfil_academico := NULL; NEW.experiencia_minima := NULL;
    RETURN NEW;
  END IF;
  NEW.perfil_academico := apd.perfil_academico(NEW.nivel_estudios, NEW.estatus_estudios, c.grupo);
  NEW.experiencia_minima := apd.experiencia_minima(NEW.perfil_academico);
  RETURN NEW;
END $$;
CREATE TRIGGER solicitud_perfil BEFORE INSERT OR UPDATE ON apd.solicitud
  FOR EACH ROW EXECUTE FUNCTION apd.solicitud_perfil();

-- La institución es del tipo de adscripción que la persona eligió (decisiones 2026-10-15). La adscripción es de
-- la persona (la cambia en «Mis datos»); cada solicitud guarda una copia al darse de alta y al enviarse.
CREATE FUNCTION apd.comprobar_adscripcion(p_adscripcion text, p_organizacion uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p_organizacion IS NOT NULL
     AND (SELECT o.tipo FROM apd.organizacion o WHERE o.id = p_organizacion) IS DISTINCT FROM p_adscripcion THEN
    PERFORM apd.error('adscripcion_no_coincide', 'La institución elegida no es del tipo de adscripción indicado');
  END IF;
END $$;

-- ───────────────────────────── Cuentas de solicitantes ─────────────────────────────

-- Expediente físico: uno por persona (por CURP), para todos sus trámites (decisión 2026-10-14, Liber).
-- Se abre al concluir su primer cotejo presencial, cuando llegan los documentos en papel; los trámites
-- siguientes usan el mismo número. SECURITY DEFINER: la cuenta del servicio no escribe el número.
CREATE FUNCTION apd.asignar_expediente(p_solicitante uuid) RETURNS text
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = apd, pg_temp AS $$
DECLARE
  n text;
  anio smallint := extract(year FROM apd.hoy())::smallint;
BEGIN
  SELECT numero_expediente INTO n FROM apd.solicitante WHERE id = p_solicitante FOR UPDATE;
  IF n IS NULL THEN
    n := 'EXP-' || anio || '-' || lpad(apd.siguiente_folio('E', anio)::text, 4, '0');
    UPDATE apd.solicitante SET numero_expediente = n WHERE id = p_solicitante;
    PERFORM apd.registrar('expediente', 'solicitante', p_solicitante::text, 'Abre el expediente ' || n);
  END IF;
  RETURN n;
END $$;

-- Nombre y apellidos en mayúsculas (decisión 2026-10-15, Liber), con acentos, diéresis y Ñ también en una base
-- cuyo idioma no las conozca (upper() depende de la configuración regional del servidor). Espacios repetidos fuera.
CREATE FUNCTION apd.mayusculas(t text) RETURNS text
  LANGUAGE sql IMMUTABLE AS $f$
  SELECT nullif(upper(translate(regexp_replace(trim(t), '\s+', ' ', 'g'), 'áéíóúüñàèìòù', 'ÁÉÍÓÚÜÑÀÈÌÒÙ')), '')
$f$;

-- Nombre con que se guarda un archivo (decisión 2026-10-15, Liber): TIPO DE DOCUMENTO_NOMBRE COMPLETO.ext,
-- p. ej. CURP_JUAN RAMIREZ OSORIO.pdf. Mayúsculas sin acentos (la Ñ se conserva) y sin caracteres que un
-- sistema de archivos no admite. Se fija al cargar: si después se corrige el nombre, el archivo conserva el suyo.
CREATE FUNCTION apd.nombre_de_archivo(p_tipo text, p_persona uuid, p_mime text) RETURNS text
  LANGUAGE sql STABLE AS $f$
  SELECT regexp_replace(
           translate(upper(p_tipo || '_' || concat_ws(' ', s.nombre, s.primer_apellido, s.segundo_apellido)),
                     'ÁÉÍÓÚÜÀÈÌÒÙáéíóúüñ', 'AEIOUUAEIOUAEIOUUÑ'),
           '[\\/:*?"<>|]', '', 'g')
         || CASE p_mime WHEN 'application/pdf' THEN '.pdf' WHEN 'image/png' THEN '.png' ELSE '.jpg' END
    FROM apd.solicitante s WHERE s.id = p_persona
$f$;

CREATE FUNCTION apd.solicitante_alta() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.nombre := apd.mayusculas(NEW.nombre);
  NEW.primer_apellido := apd.mayusculas(NEW.primer_apellido);
  NEW.segundo_apellido := apd.mayusculas(NEW.segundo_apellido);
  NEW.curp := upper(trim(NEW.curp));
  NEW.correo := lower(trim(NEW.correo));
  PERFORM apd.comprobar_adscripcion(NEW.adscripcion, NEW.organizacion_id);
  NEW.creada_en := apd.ahora();
  NEW.numero_expediente := NULL;  -- se abre en el primer cotejo
  RETURN NEW;
END $$;
CREATE TRIGGER solicitante_alta BEFORE INSERT ON apd.solicitante
  FOR EACH ROW EXECUTE FUNCTION apd.solicitante_alta();

-- La CURP identifica la cuenta. La Secretaría puede corregirla, con motivo en la bitácora (decisión de
-- cuentas, 2026-10-14). Quien solicita no la cambia: si se equivocó, lo pide a la Secretaría.
CREATE FUNCTION apd.solicitante_cambio() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.nombre := apd.mayusculas(NEW.nombre);
  NEW.primer_apellido := apd.mayusculas(NEW.primer_apellido);
  NEW.segundo_apellido := apd.mayusculas(NEW.segundo_apellido);
  NEW.curp := upper(trim(NEW.curp));
  NEW.correo := lower(trim(NEW.correo));
  IF NEW.creada_en IS DISTINCT FROM OLD.creada_en OR NEW.es_ficticio IS DISTINCT FROM OLD.es_ficticio THEN
    PERFORM apd.error('campo_inmutable', 'La fecha de alta y la marca de dato de prueba no se cambian');
  END IF;
  IF (NEW.adscripcion, NEW.organizacion_id) IS DISTINCT FROM (OLD.adscripcion, OLD.organizacion_id) THEN
    PERFORM apd.comprobar_adscripcion(NEW.adscripcion, NEW.organizacion_id);
    PERFORM apd.registrar('adscripcion', 'solicitante', NEW.id::text,
      concat_ws(' → ', coalesce(OLD.adscripcion, 'sin dato'), concat_ws(': ', NEW.adscripcion,
        (SELECT o.nombre FROM apd.organizacion o WHERE o.id = NEW.organizacion_id))));
  END IF;
  IF OLD.numero_expediente IS NOT NULL AND NEW.numero_expediente IS DISTINCT FROM OLD.numero_expediente THEN
    PERFORM apd.error('expediente_fijo', 'El número de expediente no cambia');
  END IF;
  IF NEW.curp <> OLD.curp THEN
    IF apd.contexto('usuario_tipo') <> 'personal' OR apd.contexto('motivo') = '' THEN
      PERFORM apd.error('curp_sin_motivo', 'Sólo la Secretaría corrige una CURP, y con motivo');
    END IF;
    PERFORM apd.registrar('correccion_curp', 'solicitante', NEW.id::text,
      format('%s → %s. Motivo: %s', OLD.curp, NEW.curp, apd.contexto('motivo')));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER solicitante_cambio BEFORE UPDATE ON apd.solicitante
  FOR EACH ROW EXECUTE FUNCTION apd.solicitante_cambio();

-- Fotografía de frente de la persona (decisión 2026-10-14, Liber): obligatoria al crear la cuenta; sirve
-- para reconocerla en el cotejo, el curso y el examen. La persona la cambia mientras nadie la haya
-- confirmado; en el cotejo el personal la confirma contra la identificación oficial o toma una nueva, que
-- queda confirmada al cargarse. Una carga nueva sustituye a la anterior sin borrarla.
CREATE FUNCTION apd.fotografia_alta() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE de_personal boolean := apd.contexto('usuario_tipo') = 'personal';
BEGIN
  IF NOT de_personal AND EXISTS (SELECT 1 FROM apd.fotografia f
                                  WHERE f.solicitante_id = NEW.solicitante_id AND f.vigente AND f.estado = 'confirmada') THEN
    PERFORM apd.error('foto_confirmada', 'La Secretaría ya confirmó tu fotografía; si hay que cambiarla, se toma en tu próxima cita');
  END IF;
  IF NEW.tamano_bytes > apd.parametro_texto('tamano_maximo_archivo_bytes')::integer THEN
    PERFORM apd.error('archivo_grande', format('El archivo pasa del máximo de %s MB',
      round(apd.parametro_texto('tamano_maximo_archivo_bytes')::numeric / 1048576, 1)));
  END IF;
  UPDATE apd.fotografia SET vigente = false WHERE solicitante_id = NEW.solicitante_id AND vigente;
  NEW.vigente := true;
  NEW.nombre_archivo := apd.nombre_de_archivo('FOTOGRAFIA', NEW.solicitante_id, NEW.tipo_mime);
  NEW.cargada_en := apd.ahora();
  NEW.cargada_por := apd.contexto('usuario');
  IF de_personal THEN
    -- La toma el personal en la cita, frente a la persona: queda confirmada
    NEW.origen := 'cotejo';
    NEW.estado := 'confirmada';
    NEW.confirmada_por := NEW.cargada_por;
    NEW.confirmada_en := NEW.cargada_en;
  ELSE
    NEW.origen := 'en_linea';
    NEW.estado := 'pendiente';
    NEW.confirmada_por := NULL;
    NEW.confirmada_en := NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER fotografia_alta BEFORE INSERT ON apd.fotografia
  FOR EACH ROW EXECUTE FUNCTION apd.fotografia_alta();

CREATE FUNCTION apd.fotografia_cambio() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.solicitante_id, NEW.archivo_clave, NEW.nombre_archivo, NEW.tipo_mime, NEW.tamano_bytes, NEW.sha256, NEW.origen,
      NEW.cargada_en, NEW.cargada_por)
     IS DISTINCT FROM
     (OLD.solicitante_id, OLD.archivo_clave, OLD.nombre_archivo, OLD.tipo_mime, OLD.tamano_bytes, OLD.sha256, OLD.origen,
      OLD.cargada_en, OLD.cargada_por) THEN
    PERFORM apd.error('foto_inmutable', 'Una fotografía cargada no se modifica: se carga una nueva');
  END IF;
  IF NEW.vigente AND NOT OLD.vigente THEN
    PERFORM apd.error('foto_inmutable', 'Una fotografía sustituida no vuelve a ser la vigente');
  END IF;
  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    IF OLD.estado = 'confirmada' THEN
      PERFORM apd.error('foto_confirmada', 'Una fotografía confirmada no se desconfirma: se toma una nueva');
    END IF;
    IF NOT OLD.vigente THEN
      PERFORM apd.error('foto_sustituida', 'Sólo se confirma la fotografía vigente');
    END IF;
    IF apd.contexto('usuario_tipo') <> 'personal' OR apd.contexto('usuario') = '' THEN
      PERFORM apd.error('foto_de_personal', 'La fotografía la confirma el personal de la Secretaría, en persona');
    END IF;
    NEW.confirmada_por := apd.contexto('usuario');
    NEW.confirmada_en := apd.ahora();
    PERFORM apd.registrar('foto_confirmada', 'solicitante', NEW.solicitante_id::text, 'Fotografía confirmada en persona');
  ELSIF (NEW.confirmada_por, NEW.confirmada_en) IS DISTINCT FROM (OLD.confirmada_por, OLD.confirmada_en) THEN
    PERFORM apd.error('foto_inmutable', 'La confirmación de la fotografía no se edita');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER fotografia_cambio BEFORE UPDATE ON apd.fotografia
  FOR EACH ROW EXECUTE FUNCTION apd.fotografia_cambio();

-- ───────────────────────────── Vigencia de acreditaciones ─────────────────────────────
-- Decisiones de vigencia y renovación (2026-10-14):
--   · un año desde la emisión, sin efecto retroactivo; el último día vigente es el anterior al aniversario;
--   · ventana de renovación: desde dias_antes_renovacion (30 naturales) antes del vencimiento hasta
--     meses_despues_renovacion (12) después; pasado eso, se tramita como nueva;
--   · nadie opera sin acreditación vigente: el estado se CALCULA con la fecha, nunca se guarda.

CREATE FUNCTION apd.estado_acreditacion(p_id uuid, p_fecha date DEFAULT NULL) RETURNS text
  LANGUAGE plpgsql STABLE AS $$
DECLARE
  a      apd.acreditacion;
  f      date := coalesce(p_fecha, apd.hoy());
  antes  integer := apd.parametro_texto('dias_antes_renovacion')::integer;
  meses  integer := apd.parametro_texto('meses_despues_renovacion')::integer;
BEGIN
  SELECT * INTO a FROM apd.acreditacion WHERE id = p_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  IF f < a.emitida_en THEN RETURN 'no_emitida'; END IF;
  IF f < a.vence_en - antes THEN RETURN 'vigente'; END IF;
  IF f <= a.vence_en THEN RETURN 'por_vencer'; END IF;
  IF f <= a.vence_en + make_interval(months => meses) THEN RETURN 'vencida_renovable'; END IF;
  RETURN 'vencida_no_renovable';
END $$;
COMMENT ON FUNCTION apd.estado_acreditacion(uuid, date) IS
  'vigente, por_vencer (ya se puede renovar), vencida_renovable, vencida_no_renovable (tramita como nueva) o no_emitida. Sólo por fechas; para saber si puede operar, apd.acreditacion_vigente().';

-- ¿Tiene la persona una acreditación de poda vigente ese día?
CREATE FUNCTION apd.poda_vigente(p_solicitante uuid, p_fecha date DEFAULT NULL) RETURNS boolean
  LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM apd.acreditacion
     WHERE solicitante_id = p_solicitante AND tipo_acreditacion = 'poda'
       AND coalesce(p_fecha, apd.hoy()) BETWEEN emitida_en AND vence_en)
$$;

-- ¿Puede operar con esta acreditación ese día? Sólo cuentan sus propias fechas. La de dictaminador
-- sigue vigente hasta su fecha aunque la de poda venza antes (corrección R43, 2026-10-14): la poda
-- vigente se exige sólo al iniciar la solicitud.
CREATE FUNCTION apd.acreditacion_vigente(p_id uuid, p_fecha date DEFAULT NULL) RETURNS boolean
  LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM apd.acreditacion
                  WHERE id = p_id AND coalesce(p_fecha, apd.hoy()) BETWEEN emitida_en AND vence_en)
$$;

-- Lo único que ve el público al verificar: sin CURP, sin contacto, sin domicilio; «Vigente» o «No vigente».
-- Nunca «en renovación» ni «en trámite», que alguien podría leer como permiso para operar.
CREATE VIEW apd.verificacion_publica AS
  SELECT a.numero,
         concat_ws(' ', s.nombre, s.primer_apellido, s.segundo_apellido) AS nombre,
         CASE a.tipo_acreditacion WHEN 'poda' THEN 'Poda y derribo' ELSE 'Dictaminador técnico' END AS tipo,
         a.emitida_en,
         a.vence_en,
         CASE WHEN apd.acreditacion_vigente(a.id) THEN 'Vigente' ELSE 'No vigente' END AS situacion
    FROM apd.acreditacion a
    JOIN apd.solicitante s ON s.id = a.solicitante_id;
COMMENT ON VIEW apd.verificacion_publica IS 'Consulta pública por número de acreditación: sólo nombre, tipo, fechas y «Vigente»/«No vigente».';

-- ───────────────────────────── Acreditaciones ─────────────────────────────

CREATE FUNCTION apd.acreditacion_alta() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s apd.solicitud;
BEGIN
  IF NEW.emitida_en IS NULL THEN NEW.emitida_en := apd.hoy(); END IF;
  NEW.vence_en := (NEW.emitida_en + interval '1 year' - interval '1 day')::date;
  IF NEW.entregada_en IS NOT NULL AND NEW.origen = 'sistema' THEN
    PERFORM apd.error('entrega_al_emitir', 'La entrega se registra después de emitir, cuando la persona la recoge');
  END IF;

  IF NEW.origen = 'sistema' THEN
    SELECT * INTO s FROM apd.solicitud WHERE id = NEW.solicitud_id FOR UPDATE;
    IF s.estado <> 'aprobada' THEN
      PERFORM apd.error('solicitud_no_aprobada', 'Sólo se emite la acreditación de una solicitud aprobada');
    END IF;
    IF s.solicitante_id <> NEW.solicitante_id OR s.tipo_acreditacion <> NEW.tipo_acreditacion THEN
      PERFORM apd.error('acreditacion_no_corresponde', 'La acreditación no corresponde a la persona o al tipo de la solicitud');
    END IF;
    IF NEW.emitida_en <> apd.hoy() THEN
      PERFORM apd.error('emision_con_otra_fecha', 'La acreditación se emite con la fecha del día');
    END IF;
    -- La poda vigente del dictaminador ya se comprobó al iniciar la solicitud; aquí no se repite (R39).
    -- El número es provisional: Liber definirá el formato del folio de la acreditación [pendiente].
    NEW.numero := (CASE NEW.tipo_acreditacion WHEN 'poda' THEN 'PD' ELSE 'DT' END) || '-'
      || extract(year FROM NEW.emitida_en)::text || '-'
      || lpad(apd.siguiente_folio(CASE NEW.tipo_acreditacion WHEN 'poda' THEN 'PD' ELSE 'DT' END,
                                  extract(year FROM NEW.emitida_en)::smallint)::text, 4, '0');
  ELSIF coalesce(trim(NEW.numero), '') = '' THEN
    PERFORM apd.error('migrada_sin_numero', 'Una acreditación migrada conserva el número que ya tenía');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER acreditacion_alta BEFORE INSERT ON apd.acreditacion
  FOR EACH ROW EXECUTE FUNCTION apd.acreditacion_alta();

CREATE FUNCTION apd.acreditacion_emitida() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM apd.registrar(CASE WHEN NEW.origen = 'sistema' THEN 'emision' ELSE 'migracion' END,
    'acreditacion', NEW.id::text,
    format('%s · %s · vigente del %s al %s', NEW.numero, NEW.tipo_acreditacion, NEW.emitida_en, NEW.vence_en));
  IF NEW.origen = 'sistema' THEN
    UPDATE apd.solicitud SET estado = 'acreditada' WHERE id = NEW.solicitud_id;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER acreditacion_emitida AFTER INSERT ON apd.acreditacion
  FOR EACH ROW EXECUTE FUNCTION apd.acreditacion_emitida();

-- Una acreditación emitida no se edita: sólo se registra, una vez, la entrega.
CREATE FUNCTION apd.acreditacion_cambio() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE falta text;
BEGIN
  IF (NEW.numero, NEW.solicitante_id, NEW.tipo_acreditacion, NEW.solicitud_id, NEW.emitida_en, NEW.vence_en,
      NEW.origen, NEW.folio_origen, NEW.es_ficticio)
     IS DISTINCT FROM
     (OLD.numero, OLD.solicitante_id, OLD.tipo_acreditacion, OLD.solicitud_id, OLD.emitida_en, OLD.vence_en,
      OLD.origen, OLD.folio_origen, OLD.es_ficticio) THEN
    PERFORM apd.error('acreditacion_inmutable', 'Una acreditación emitida no se modifica; sólo se registra su entrega');
  END IF;
  IF OLD.entregada_en IS NOT NULL AND NEW.entregada_en IS DISTINCT FROM OLD.entregada_en THEN
    PERFORM apd.error('entrega_ya_registrada', 'La entrega ya está registrada');
  END IF;
  IF NEW.entregada_en IS NOT NULL AND OLD.entregada_en IS NULL THEN
    IF NEW.entregada_en > apd.hoy() THEN
      PERFORM apd.error('entrega_futura', 'La entrega no puede registrarse con fecha futura');
    END IF;
    -- Al entregar (decisiones 2026-10-14): se toma en el lugar la fotografía que lleva la credencial y la
    -- persona firma el comprobante de recepción que imprime el sistema; el personal carga los dos antes de
    -- marcar la entrega. Las migradas se entregaron fuera del sistema.
    IF NEW.origen = 'sistema' THEN
      SELECT rc.requisito INTO falta
        FROM apd.solicitud s
        JOIN apd.requisito_curso rc ON rc.tipo_acreditacion = s.tipo_acreditacion AND rc.modalidad = s.modalidad
        JOIN apd.requisito r ON r.clave = rc.requisito
       WHERE s.id = NEW.solicitud_id AND rc.obligatorio AND r.forma = 'documento' AND r.momento = 'entrega'
         AND NOT EXISTS (SELECT 1 FROM apd.documento d WHERE d.solicitud_id = s.id AND d.requisito = rc.requisito AND d.vigente)
       ORDER BY rc.orden LIMIT 1;
      IF falta = 'foto_credencial' THEN
        PERFORM apd.error('sin_foto_credencial', 'Carga la fotografía tomada para la credencial antes de registrar la entrega');
      ELSIF falta IS NOT NULL THEN
        PERFORM apd.error('sin_acuse_entrega', 'Carga el comprobante de recepción firmado antes de registrar la entrega');
      END IF;
    END IF;
    PERFORM apd.registrar('entrega', 'acreditacion', NEW.id::text, format('%s entregada el %s', NEW.numero, NEW.entregada_en));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER acreditacion_cambio BEFORE UPDATE ON apd.acreditacion
  FOR EACH ROW EXECUTE FUNCTION apd.acreditacion_cambio();

-- ───────────────────────────── Solicitudes ─────────────────────────────

CREATE FUNCTION apd.solicitud_alta() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE anio smallint := extract(year FROM apd.hoy())::smallint;
BEGIN
  IF NEW.estado <> 'borrador' THEN
    PERFORM apd.error('alta_fuera_de_borrador', 'Una solicitud nace como borrador');
  END IF;
  PERFORM apd.comprobar_elegibilidad(NEW);
  -- Copia de la adscripción de la persona (se vuelve a copiar al enviar)
  SELECT p.adscripcion, p.organizacion_id INTO NEW.adscripcion, NEW.organizacion_id
    FROM apd.solicitante p WHERE p.id = NEW.solicitante_id;
  NEW.folio := 'APD-S-' || anio || '-' || lpad(apd.siguiente_folio('S', anio)::text, 5, '0');
  NEW.creada_en := apd.ahora();
  NEW.estado_desde := NEW.creada_en;
  NEW.enviada_en := NULL;
  NEW.lista_para_curso_en := NULL;
  NEW.pago_referencia := NULL;
  NEW.pago_monto := NULL;
  RETURN NEW;
END $$;
CREATE TRIGGER solicitud_alta BEFORE INSERT ON apd.solicitud
  FOR EACH ROW EXECUTE FUNCTION apd.solicitud_alta();

CREATE FUNCTION apd.solicitud_alta_registrar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM apd.registrar('alta', 'solicitud', NEW.id::text,
    format('%s · %s %s', NEW.folio, NEW.tipo_acreditacion, NEW.modalidad));
  RETURN NULL;
END $$;
CREATE TRIGGER solicitud_alta_registrar AFTER INSERT ON apd.solicitud
  FOR EACH ROW EXECUTE FUNCTION apd.solicitud_alta_registrar();

-- ¿Puede esta persona tramitar este curso hoy? Se comprueba al iniciar la solicitud y, si en borrador
-- cambia el curso o la acreditación a renovar, otra vez en ese momento. No se vuelve a comprobar al enviar
-- ni al emitir (corrección R05 y R39, 2026-10-14).
CREATE FUNCTION apd.comprobar_elegibilidad(s apd.solicitud) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  previa  record;
  estado_anterior text;
  hoy date := apd.hoy();
BEGIN
  -- Dictaminador: poda vigente al iniciar la solicitud
  IF s.tipo_acreditacion = 'dictaminador' AND NOT apd.poda_vigente(s.solicitante_id, hoy) THEN
    PERFORM apd.error('sin_poda_vigente', 'Para tramitar la acreditación de dictaminador necesitas la de poda y derribo vigente');
  END IF;

  IF s.modalidad = 'renovacion' THEN
    -- La acreditación más reciente de ese tipo, dentro de su ventana
    SELECT a.solicitante_id, a.tipo_acreditacion, a.emitida_en, a.vence_en INTO previa
      FROM apd.acreditacion a WHERE a.id = s.acreditacion_anterior_id;
    IF previa.solicitante_id <> s.solicitante_id OR previa.tipo_acreditacion <> s.tipo_acreditacion THEN
      PERFORM apd.error('anterior_no_corresponde', 'La acreditación a renovar no es tuya o no es de este tipo');
    END IF;
    IF EXISTS (SELECT 1 FROM apd.acreditacion a
                WHERE a.solicitante_id = s.solicitante_id AND a.tipo_acreditacion = s.tipo_acreditacion
                  AND a.emitida_en > previa.emitida_en) THEN
      PERFORM apd.error('anterior_no_es_la_ultima', 'Sólo se renueva la acreditación más reciente');
    END IF;
    estado_anterior := apd.estado_acreditacion(s.acreditacion_anterior_id, hoy);
    IF estado_anterior = 'vigente' THEN
      PERFORM apd.error('renovacion_anticipada', format(
        'Tu acreditación todavía no entra en periodo de renovación: podrás renovarla desde el %s',
        to_char(previa.vence_en - apd.parametro_texto('dias_antes_renovacion')::integer, 'DD/MM/YYYY')));
    ELSIF estado_anterior = 'vencida_no_renovable' THEN
      PERFORM apd.error('renovacion_vencida', 'Tu acreditación venció hace más de un año: debes tramitarla como solicitud nueva');
    END IF;
  ELSE
    -- Nueva: no si ya tiene una de ese tipo vigente o todavía renovable (deducido de «pasado el año se
    -- tramita como nueva»; [pendiente] confirmar con Liber)
    IF EXISTS (SELECT 1 FROM apd.acreditacion a
                WHERE a.solicitante_id = s.solicitante_id AND a.tipo_acreditacion = s.tipo_acreditacion
                  AND apd.estado_acreditacion(a.id, hoy) IN ('vigente', 'por_vencer', 'vencida_renovable')) THEN
      PERFORM apd.error('debe_renovar', 'Ya tienes una acreditación de este tipo vigente o en periodo de renovación: tramita una renovación');
    END IF;
  END IF;
END $$;

-- Al enviar: perfil y documentos obligatorios que se cargan en línea
CREATE FUNCTION apd.comprobar_envio(s apd.solicitud) RETURNS void LANGUAGE plpgsql AS $$
DECLARE faltan text; perfil text;
BEGIN
  -- Estudios: en los dos tipos, el nivel; con licenciatura o posgrado, la carrera y su situación; con carrera técnica,
  -- cuál (decisión 2026-10-17)
  IF s.nivel_estudios IS NULL
     OR (s.nivel_estudios IN ('licenciatura', 'maestria', 'doctorado')
         AND (coalesce(trim(s.carrera), '') = '' OR s.estatus_estudios IS NULL))
     OR (s.nivel_estudios = 'tecnica' AND coalesce(trim(s.carrera_tecnica), '') = '') THEN
    PERFORM apd.error('faltan_estudios', 'Indica tu último nivel de estudios; si es licenciatura o posgrado, tu carrera y su situación; si es carrera técnica, cuál');
  END IF;
  IF s.tipo_acreditacion = 'dictaminador' THEN
    IF s.anios_experiencia IS NULL THEN
      PERFORM apd.error('falta_perfil', 'Indica tus años de experiencia en manejo de arbolado');
    END IF;
    -- Se calcula aquí, no se lee de la columna: el disparador del perfil corre después que el de cambio
    perfil := apd.perfil_academico(s.nivel_estudios, s.estatus_estudios,
                (SELECT grupo FROM apd.carrera WHERE nombre_normalizado = apd.normalizar(s.carrera)));
    -- Un perfil que no cumple (hasta preparatoria, licenciatura en curso o trunca, carrera no afín) SÍ se envía: lo
    -- revisa y decide el personal en la revisión documental (decisión 2026-10-15, Liber)
    IF s.anios_experiencia < apd.experiencia_minima(perfil) THEN
      PERFORM apd.error('experiencia_insuficiente', format('Tu perfil pide al menos %s años de experiencia en manejo de arbolado', apd.experiencia_minima(perfil)));
    END IF;
  END IF;
  SELECT string_agg(r.nombre, ', ' ORDER BY rc.orden) INTO faltan
    FROM apd.requisito_curso rc JOIN apd.requisito r ON r.clave = rc.requisito
   WHERE rc.tipo_acreditacion = s.tipo_acreditacion AND rc.modalidad = s.modalidad
     AND rc.obligatorio AND r.forma = 'documento' AND r.momento = 'en_linea'
     AND NOT EXISTS (SELECT 1 FROM apd.documento d
                      WHERE d.solicitud_id = s.id AND d.requisito = rc.requisito AND d.vigente);
  IF faltan IS NOT NULL THEN
    PERFORM apd.error('faltan_documentos', 'Faltan documentos: ' || faltan);
  END IF;
END $$;

-- Máquina de estados de la solicitud. Cada transición se comprueba contra los datos, no contra quién la
-- pide: «inscrita» exige una inscripción activa, «aprobada» un examen aprobatorio, etcétera.
CREATE FUNCTION apd.solicitud_cambio() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  permitidas text[];
  ultima     text;
  curso      apd.curso;
  ins        apd.inscripcion;
  cal        numeric;
  dias       integer;
BEGIN
  IF NEW.folio <> OLD.folio OR NEW.solicitante_id <> OLD.solicitante_id OR NEW.creada_en <> OLD.creada_en
     OR NEW.es_ficticio <> OLD.es_ficticio THEN
    PERFORM apd.error('campo_inmutable', 'El folio, la persona y la fecha de alta de una solicitud no se cambian');
  END IF;
  IF OLD.estado NOT IN ('borrador', 'con_observaciones')
     AND (NEW.tipo_acreditacion, NEW.modalidad, NEW.acreditacion_anterior_id, NEW.adscripcion, NEW.organizacion_id,
          NEW.nivel_estudios, NEW.carrera, NEW.carrera_tecnica, NEW.estatus_estudios, NEW.anios_experiencia)
         IS DISTINCT FROM
         (OLD.tipo_acreditacion, OLD.modalidad, OLD.acreditacion_anterior_id, OLD.adscripcion, OLD.organizacion_id,
          OLD.nivel_estudios, OLD.carrera, OLD.carrera_tecnica, OLD.estatus_estudios, OLD.anios_experiencia) THEN
    PERFORM apd.error('solicitud_cerrada', 'Los datos de la solicitud sólo se cambian en borrador o con observaciones');
  END IF;
  IF OLD.estado <> 'borrador' AND (NEW.tipo_acreditacion, NEW.modalidad) IS DISTINCT FROM (OLD.tipo_acreditacion, OLD.modalidad) THEN
    PERFORM apd.error('curso_fijo', 'El curso de una solicitud enviada no cambia: cancélala y crea otra');
  END IF;
  -- Cambiar en borrador el curso o la acreditación a renovar es como iniciar de nuevo
  IF (NEW.tipo_acreditacion, NEW.modalidad, NEW.acreditacion_anterior_id)
     IS DISTINCT FROM (OLD.tipo_acreditacion, OLD.modalidad, OLD.acreditacion_anterior_id) THEN
    PERFORM apd.comprobar_elegibilidad(NEW);
  END IF;
  -- Quien manda las fechas de control y la referencia de pago es la base
  NEW.pago_referencia := OLD.pago_referencia;
  NEW.pago_monto := OLD.pago_monto;
  -- Los datos de la factura los captura el personal en la cita, antes de concluir el cotejo (R20)
  IF (NEW.factura_rfc, NEW.factura_razon_social, NEW.factura_folio_fiscal)
     IS DISTINCT FROM (OLD.factura_rfc, OLD.factura_razon_social, OLD.factura_folio_fiscal) THEN
    IF OLD.estado <> 'validada_en_linea' OR apd.contexto('usuario_tipo') <> 'personal' THEN
      PERFORM apd.error('factura_fuera_de_turno', 'Los datos de la factura los captura el personal de la Secretaría en la cita');
    END IF;
    NEW.factura_rfc := upper(trim(NEW.factura_rfc));
    NEW.factura_folio_fiscal := upper(trim(NEW.factura_folio_fiscal));
  END IF;
  NEW.enviada_en := OLD.enviada_en;
  NEW.lista_para_curso_en := OLD.lista_para_curso_en;
  NEW.estado_desde := OLD.estado_desde;

  IF NEW.estado = OLD.estado THEN RETURN NEW; END IF;

  permitidas := CASE OLD.estado
    WHEN 'borrador'          THEN ARRAY['enviada', 'cancelada']
    WHEN 'enviada'           THEN ARRAY['con_observaciones', 'validada_en_linea', 'rechazada', 'cancelada']
    WHEN 'con_observaciones' THEN ARRAY['enviada', 'cancelada', 'concluida_sin_atender']
    WHEN 'validada_en_linea' THEN ARRAY['lista_para_curso', 'con_observaciones', 'cancelada', 'concluida_sin_atender']
    WHEN 'lista_para_curso'  THEN ARRAY['inscrita', 'cancelada']
    WHEN 'inscrita'          THEN ARRAY['lista_para_curso', 'aprobada', 'no_acreditada', 'sin_derecho_examen', 'cancelada']
    WHEN 'aprobada'          THEN ARRAY['acreditada']
    ELSE ARRAY[]::text[]
  END;
  IF NOT NEW.estado = ANY (permitidas) THEN
    PERFORM apd.error('transicion_invalida', format('Una solicitud no pasa de «%s» a «%s»', OLD.estado, NEW.estado));
  END IF;

  -- La revisión que corresponde a este turno: registrada desde que la solicitud llegó a su estado actual
  SELECT r.resultado INTO ultima FROM apd.revision r
   WHERE r.solicitud_id = NEW.id AND r.revisada_en >= OLD.estado_desde
   ORDER BY r.revisada_en DESC LIMIT 1;
  SELECT * INTO curso FROM apd.curso c WHERE c.tipo_acreditacion = NEW.tipo_acreditacion AND c.modalidad = NEW.modalidad;
  SELECT * INTO ins FROM apd.inscripcion i WHERE i.solicitud_id = NEW.id AND i.activa;

  CASE NEW.estado
    WHEN 'enviada' THEN
      PERFORM apd.comprobar_envio(NEW);
      -- Sin fotografía de frente no hay a quién reconocer en la cita (decisión 2026-10-14)
      IF NOT EXISTS (SELECT 1 FROM apd.fotografia f WHERE f.solicitante_id = NEW.solicitante_id AND f.vigente) THEN
        PERFORM apd.error('sin_fotografia', 'Carga tu fotografía de frente antes de enviar la solicitud');
      END IF;
      -- La solicitud se va con la adscripción que la persona tiene hoy en «Mis datos»
      SELECT p.adscripcion, p.organizacion_id INTO NEW.adscripcion, NEW.organizacion_id
        FROM apd.solicitante p WHERE p.id = NEW.solicitante_id;
      IF NEW.adscripcion IS NULL THEN
        PERFORM apd.error('sin_adscripcion', 'Indica en «Mis datos» si trabajas para alguna empresa, institución o dependencia');
      END IF;
      IF NEW.enviada_en IS NULL THEN NEW.enviada_en := apd.ahora(); END IF;
    WHEN 'con_observaciones' THEN
      IF OLD.estado = 'enviada' AND ultima IS DISTINCT FROM 'con_observaciones' THEN
        PERFORM apd.error('sin_revision', 'Las observaciones se emiten con una revisión');
      END IF;
      IF OLD.estado = 'validada_en_linea' AND apd.contexto('motivo') = '' THEN
        PERFORM apd.error('cotejo_sin_motivo', 'Indica qué no coincidió en el cotejo');
      END IF;
    WHEN 'validada_en_linea' THEN
      IF ultima IS DISTINCT FROM 'validada' THEN
        PERFORM apd.error('sin_revision', 'La validación se registra con una revisión');
      END IF;
      IF EXISTS (SELECT 1 FROM apd.documento d WHERE d.solicitud_id = NEW.id AND d.vigente AND d.estado <> 'aceptado') THEN
        PERFORM apd.error('documentos_sin_aceptar', 'Para validar, todos los documentos deben estar aceptados');
      END IF;
      IF NEW.cita_en IS NULL THEN
        PERFORM apd.error('sin_cita', 'Para validar hay que asignar la cita de cotejo');
      END IF;
      -- Dictaminador: el perfil tiene que estar resuelto. Se calcula aquí porque el disparador del perfil corre
      -- después que éste. Con la carrera sin clasificar, primero se clasifica; si no cumple, se rechaza o se regresa
      -- con observaciones cuando el comprobante muestra otro grado (decisión 2026-10-16, Liber).
      IF NEW.tipo_acreditacion = 'dictaminador' THEN
        CASE apd.perfil_academico(NEW.nivel_estudios, NEW.estatus_estudios,
               (SELECT grupo FROM apd.carrera WHERE nombre_normalizado = apd.normalizar(NEW.carrera)))
          WHEN 'por_clasificar' THEN
            PERFORM apd.error('carrera_sin_clasificar', 'Clasifique la carrera antes de validar la solicitud');
          WHEN 'no_cumple' THEN
            PERFORM apd.error('perfil_no_cumple', 'El perfil no cumple: rechace la solicitud o regrésela con observaciones');
          ELSE NULL;
        END CASE;
      END IF;
      -- Con la cita, la persona recibe los datos para pagar: concepto y monto del curso, y su referencia.
      -- Formato provisional (folio sin guiones) [pendiente: referencia o línea de captura que defina Finanzas].
      IF NEW.pago_referencia IS NULL THEN NEW.pago_referencia := replace(NEW.folio, '-', ''); END IF;
      -- El monto que se le indica es el vigente hoy para su curso; si después cambia, el suyo no
      IF NEW.pago_monto IS NULL THEN NEW.pago_monto := curso.pago_monto; END IF;
    WHEN 'lista_para_curso' THEN
      IF OLD.estado = 'inscrita' AND ins.id IS NOT NULL THEN
        PERFORM apd.error('sigue_inscrita', 'La solicitud regresa a la bandeja sólo al darla de baja del grupo');
      END IF;
      -- Sin factura no hay bandeja, y sin bandeja no hay grupo ni fecha de curso
      IF OLD.estado = 'validada_en_linea' AND EXISTS (
           SELECT 1 FROM apd.requisito_curso rc JOIN apd.requisito r ON r.clave = rc.requisito
            WHERE rc.tipo_acreditacion = NEW.tipo_acreditacion AND rc.modalidad = NEW.modalidad
              AND rc.obligatorio AND r.forma = 'documento' AND r.momento = 'cotejo'
              AND NOT EXISTS (SELECT 1 FROM apd.documento d
                               WHERE d.solicitud_id = NEW.id AND d.requisito = rc.requisito AND d.vigente)) THEN
        PERFORM apd.error('sin_factura', 'Carga la factura del pago de derechos para concluir el cotejo');
      END IF;
      IF OLD.estado = 'validada_en_linea' AND (coalesce(NEW.factura_rfc, '') = '' OR coalesce(trim(NEW.factura_razon_social), '') = ''
                                              OR coalesce(NEW.factura_folio_fiscal, '') = '') THEN
        PERFORM apd.error('sin_datos_factura', 'Captura el RFC, el nombre o razón social y el folio fiscal de la factura');
      END IF;
      -- En el cotejo el personal confirma que la fotografía es de quien se presentó, o toma una nueva
      IF OLD.estado = 'validada_en_linea' AND NOT EXISTS (
           SELECT 1 FROM apd.fotografia f WHERE f.solicitante_id = NEW.solicitante_id AND f.vigente AND f.estado = 'confirmada') THEN
        PERFORM apd.error('foto_sin_confirmar', 'Confirma que la fotografía corresponde a la persona, o tómale una nueva, para concluir el cotejo');
      END IF;
      -- El expediente físico es de la persona: se abre en su primer cotejo y lo usan todos sus trámites
      IF OLD.estado = 'validada_en_linea' THEN PERFORM apd.asignar_expediente(NEW.solicitante_id); END IF;
      -- La espera empieza la primera vez; si regresa de un grupo, conserva su antigüedad
      IF NEW.lista_para_curso_en IS NULL THEN NEW.lista_para_curso_en := apd.ahora(); END IF;
    WHEN 'inscrita' THEN
      IF ins.id IS NULL THEN
        PERFORM apd.error('sin_inscripcion', 'Una solicitud queda inscrita al darla de alta en un grupo');
      END IF;
    WHEN 'aprobada', 'no_acreditada' THEN
      SELECT e.calificacion INTO cal FROM apd.examen e WHERE e.inscripcion_id = ins.id;
      IF cal IS NULL THEN
        PERFORM apd.error('sin_examen', 'El resultado sale de la calificación del examen');
      END IF;
      IF (NEW.estado = 'aprobada') <> (cal >= curso.calificacion_minima) THEN
        PERFORM apd.error('resultado_no_corresponde', 'El resultado no corresponde a la calificación');
      END IF;
    WHEN 'sin_derecho_examen' THEN
      SELECT count(*) INTO dias FROM apd.asistencia a WHERE a.inscripcion_id = ins.id AND a.asistio;
      IF ins.id IS NULL OR dias >= curso.dias_minimos_asistencia THEN
        PERFORM apd.error('con_derecho_examen', 'La persona tiene la asistencia mínima: le corresponde examen');
      END IF;
    WHEN 'acreditada' THEN
      IF NOT EXISTS (SELECT 1 FROM apd.acreditacion a WHERE a.solicitud_id = NEW.id) THEN
        PERFORM apd.error('sin_acreditacion', 'Una solicitud queda acreditada al emitir la acreditación');
      END IF;
    WHEN 'rechazada' THEN
      -- Sólo con una revisión de rechazo, y sólo por perfil de dictaminador que no cumple (decisión 2026-10-16, Liber):
      -- carrera no afín, o estudios que el comprobante confirma por debajo de lo que pide el lineamiento
      IF ultima IS DISTINCT FROM 'rechazada' THEN
        PERFORM apd.error('sin_revision', 'El rechazo se registra con una revisión');
      END IF;
      IF NEW.tipo_acreditacion <> 'dictaminador'
         OR apd.perfil_academico(NEW.nivel_estudios, NEW.estatus_estudios,
              (SELECT grupo FROM apd.carrera WHERE nombre_normalizado = apd.normalizar(NEW.carrera))) IS DISTINCT FROM 'no_cumple' THEN
        PERFORM apd.error('rechazo_sin_causa', 'Sólo se rechaza una solicitud de dictaminador cuyo perfil no cumple');
      END IF;
    WHEN 'cancelada', 'concluida_sin_atender' THEN
      NULL; -- el motivo lo exige la restricción solicitud_cierre_ck
    ELSE
      NULL;
  END CASE;

  NEW.estado_desde := apd.ahora();
  RETURN NEW;
END $$;
CREATE TRIGGER solicitud_cambio BEFORE UPDATE ON apd.solicitud
  FOR EACH ROW EXECUTE FUNCTION apd.solicitud_cambio();

CREATE FUNCTION apd.solicitud_cambio_registrar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.estado <> OLD.estado THEN
    PERFORM apd.registrar('estado', 'solicitud', NEW.id::text,
      concat_ws(' · ', format('%s → %s', OLD.estado, NEW.estado), nullif(NEW.motivo_cierre, ''), nullif(apd.contexto('motivo'), '')));
    -- Al cancelar estando en un grupo, la persona sale del grupo
    IF NEW.estado IN ('cancelada') THEN
      UPDATE apd.inscripcion SET activa = false, motivo_baja = 'Solicitud cancelada: ' || NEW.motivo_cierre
       WHERE solicitud_id = NEW.id AND activa;
    END IF;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER solicitud_cambio_registrar AFTER UPDATE ON apd.solicitud
  FOR EACH ROW EXECUTE FUNCTION apd.solicitud_cambio_registrar();

-- ───────────────────────────── Revisión y documentos ─────────────────────────────

CREATE FUNCTION apd.revision_alta() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (SELECT estado FROM apd.solicitud WHERE id = NEW.solicitud_id) <> 'enviada' THEN
    PERFORM apd.error('revision_fuera_de_turno', 'Sólo se revisa una solicitud enviada');
  END IF;
  IF NEW.resultado = 'con_observaciones' AND trim(NEW.observacion_general) = ''
     AND NOT EXISTS (SELECT 1 FROM apd.documento d WHERE d.solicitud_id = NEW.solicitud_id AND d.vigente AND d.estado = 'con_observacion') THEN
    PERFORM apd.error('observaciones_vacias', 'Indica qué debe corregirse');
  END IF;
  IF NEW.resultado = 'rechazada' AND trim(NEW.observacion_general) = '' THEN
    PERFORM apd.error('rechazo_sin_motivo', 'Escriba el motivo del rechazo: la persona lo leerá');
  END IF;
  NEW.revisada_en := apd.ahora();
  RETURN NEW;
END $$;
CREATE TRIGGER revision_alta BEFORE INSERT ON apd.revision
  FOR EACH ROW EXECUTE FUNCTION apd.revision_alta();

-- La revisión mueve la solicitud: así no queda una revisión sin efecto ni un estado sin revisión.
CREATE FUNCTION apd.revision_aplicar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE apd.solicitud
     SET estado = CASE NEW.resultado WHEN 'validada' THEN 'validada_en_linea' WHEN 'rechazada' THEN 'rechazada'
                                     ELSE 'con_observaciones' END,
         motivo_cierre = CASE NEW.resultado WHEN 'rechazada' THEN NEW.observacion_general ELSE motivo_cierre END
   WHERE id = NEW.solicitud_id;
  RETURN NULL;
END $$;
CREATE TRIGGER revision_aplicar AFTER INSERT ON apd.revision
  FOR EACH ROW EXECUTE FUNCTION apd.revision_aplicar();

-- Dos momentos de carga: en línea, la persona solicitante (en borrador o para atender observaciones); en
-- la cita presencial, el personal de la Secretaría carga lo que se genera ahí, como la factura del pago.
CREATE FUNCTION apd.documento_alta() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  s apd.solicitud;
  momento text;
  formatos text[];
BEGIN
  SELECT * INTO s FROM apd.solicitud WHERE id = NEW.solicitud_id;
  SELECT r.momento, r.formatos INTO momento, formatos FROM apd.requisito_curso rc JOIN apd.requisito r ON r.clave = rc.requisito
   WHERE rc.tipo_acreditacion = s.tipo_acreditacion AND rc.modalidad = s.modalidad
     AND rc.requisito = NEW.requisito AND r.forma = 'documento';
  IF momento IS NULL THEN
    PERFORM apd.error('requisito_ajeno', 'Ese documento no se pide para este curso');
  END IF;
  IF momento = 'en_linea' AND s.estado NOT IN ('borrador', 'con_observaciones') THEN
    PERFORM apd.error('carga_fuera_de_turno', 'Sólo se cargan documentos en borrador o para atender observaciones');
  END IF;
  IF momento = 'cotejo' AND s.estado <> 'validada_en_linea' THEN
    PERFORM apd.error('carga_fuera_de_turno', 'Este documento se carga en la cita presencial');
  END IF;
  -- El comprobante de recepción y la foto de la credencial se cargan cuando la acreditación está emitida
  -- y todavía no se entrega
  IF momento = 'entrega' AND (s.estado <> 'acreditada' OR NOT EXISTS (
       SELECT 1 FROM apd.acreditacion a WHERE a.solicitud_id = s.id AND a.entregada_en IS NULL)) THEN
    PERFORM apd.error('carga_fuera_de_turno', 'Este documento se carga al entregar la acreditación');
  END IF;
  -- Una fotografía sólo se admite como imagen
  IF NOT NEW.tipo_mime = ANY (formatos) THEN
    PERFORM apd.error('formato_no_admitido', 'Ese tipo de archivo no se admite para este documento');
  END IF;
  IF momento IN ('cotejo', 'entrega') AND apd.contexto('usuario_tipo') <> 'personal' THEN
    PERFORM apd.error('carga_de_personal', 'Este documento lo carga el personal de la Secretaría');
  END IF;
  IF NEW.tamano_bytes > apd.parametro_texto('tamano_maximo_archivo_bytes')::integer THEN
    PERFORM apd.error('archivo_grande', format('El archivo pasa del máximo de %s MB',
      round(apd.parametro_texto('tamano_maximo_archivo_bytes')::numeric / 1048576, 1)));
  END IF;
  -- Se guarda como TIPO DE DOCUMENTO_NOMBRE COMPLETO.ext, sin importar cómo lo nombró quien lo cargó
  NEW.nombre_archivo := apd.nombre_de_archivo(
    (SELECT coalesce(r.nombre_archivo, translate(upper(r.nombre), 'ÁÉÍÓÚÜ', 'AEIOUU')) FROM apd.requisito r WHERE r.clave = NEW.requisito),
    s.solicitante_id, NEW.tipo_mime);
  -- La carga nueva sustituye a la anterior sin borrarla
  UPDATE apd.documento SET vigente = false WHERE solicitud_id = NEW.solicitud_id AND requisito = NEW.requisito AND vigente;
  NEW.vigente := true;
  NEW.observacion := '';
  NEW.cargado_en := apd.ahora();
  NEW.cargado_por := apd.contexto('usuario');
  -- Lo que carga el personal (cita y entrega) ya está revisado; lo que carga la persona espera revisión
  IF momento IN ('cotejo', 'entrega') THEN
    NEW.estado := 'aceptado';
    NEW.revisado_por := NEW.cargado_por;
    NEW.revisado_en := NEW.cargado_en;
  ELSE
    NEW.estado := 'pendiente';
    NEW.revisado_por := NULL;
    NEW.revisado_en := NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER documento_alta BEFORE INSERT ON apd.documento
  FOR EACH ROW EXECUTE FUNCTION apd.documento_alta();

CREATE FUNCTION apd.documento_cambio() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.solicitud_id, NEW.requisito, NEW.archivo_clave, NEW.nombre_original, NEW.nombre_archivo, NEW.tipo_mime,
      NEW.tamano_bytes, NEW.sha256, NEW.cargado_en)
     IS DISTINCT FROM
     (OLD.solicitud_id, OLD.requisito, OLD.archivo_clave, OLD.nombre_original, OLD.nombre_archivo, OLD.tipo_mime,
      OLD.tamano_bytes, OLD.sha256, OLD.cargado_en) THEN
    PERFORM apd.error('documento_inmutable', 'Un documento cargado no se modifica: se carga uno nuevo');
  END IF;
  IF NEW.vigente AND NOT OLD.vigente THEN
    PERFORM apd.error('documento_inmutable', 'Una carga sustituida no vuelve a ser la vigente');
  END IF;
  IF (NEW.estado, NEW.observacion) IS DISTINCT FROM (OLD.estado, OLD.observacion) THEN
    IF NOT OLD.vigente THEN
      PERFORM apd.error('documento_sustituido', 'Sólo se revisa la carga vigente');
    END IF;
    IF (SELECT estado FROM apd.solicitud WHERE id = NEW.solicitud_id) <> 'enviada' THEN
      PERFORM apd.error('revision_fuera_de_turno', 'Sólo se revisan documentos de una solicitud enviada');
    END IF;
    IF coalesce(NEW.revisado_por, '') = '' THEN
      PERFORM apd.error('revision_sin_responsable', 'La revisión de un documento registra quién la hizo');
    END IF;
    NEW.revisado_en := apd.ahora();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER documento_cambio BEFORE UPDATE ON apd.documento
  FOR EACH ROW EXECUTE FUNCTION apd.documento_cambio();

-- ───────────────────────────── Grupos ─────────────────────────────
-- Decisiones de cursos y grupos (2026-10-14): cupo 10–25 copiado al crear; ningún grupo abre con menos
-- del mínimo; grupos específicos (una organización) o combinados; los cuatro cursos no se mezclan.

CREATE FUNCTION apd.grupo_alta() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  c apd.curso;
  anio smallint := extract(year FROM apd.hoy())::smallint;
BEGIN
  SELECT * INTO c FROM apd.curso WHERE tipo_acreditacion = NEW.tipo_acreditacion AND modalidad = NEW.modalidad;
  IF NOT c.activo THEN
    PERFORM apd.error('curso_inactivo', 'Este curso no está abriendo grupos');
  END IF;
  IF NEW.estado <> 'en_integracion' THEN
    PERFORM apd.error('alta_fuera_de_integracion', 'Un grupo nace en integración');
  END IF;
  NEW.cupo_minimo := c.cupo_minimo;
  NEW.cupo_maximo := c.cupo_maximo;
  -- Todos los cursos son en la sede única (Vivero Nezahualcóyotl, decisión 2026-10-16), salvo que se indique otra
  NEW.sede := coalesce(nullif(trim(NEW.sede), ''), apd.parametro_texto('sede'));
  NEW.folio := 'APD-G-' || anio || '-' || lpad(apd.siguiente_folio('G', anio)::text, 3, '0');
  NEW.creado_en := apd.ahora();
  NEW.estado_desde := NEW.creado_en;
  RETURN NEW;
END $$;
CREATE TRIGGER grupo_alta BEFORE INSERT ON apd.grupo
  FOR EACH ROW EXECUTE FUNCTION apd.grupo_alta();

CREATE FUNCTION apd.grupo_cambio() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  permitidas text[];
  inscritos  integer;
  pendientes text;
BEGIN
  IF (NEW.folio, NEW.tipo_acreditacion, NEW.modalidad, NEW.integracion, NEW.organizacion_id, NEW.cupo_minimo,
      NEW.cupo_maximo, NEW.creado_en, NEW.es_ficticio)
     IS DISTINCT FROM
     (OLD.folio, OLD.tipo_acreditacion, OLD.modalidad, OLD.integracion, OLD.organizacion_id, OLD.cupo_minimo,
      OLD.cupo_maximo, OLD.creado_en, OLD.es_ficticio) THEN
    PERFORM apd.error('campo_inmutable', 'El curso, la integración y los cupos de un grupo no cambian después de crearlo');
  END IF;
  IF OLD.estado IN ('en_curso', 'concluido', 'cancelado')
     AND (NEW.sede, NEW.fecha_inicio) IS DISTINCT FROM (OLD.sede, OLD.fecha_inicio) THEN
    PERFORM apd.error('grupo_cerrado', 'La sede y la fecha no cambian una vez iniciado el curso');
  END IF;
  -- El instructor puede variar, también durante el curso (corrección R26); cada día queda quién capturó
  -- la asistencia. Sólo no cambia con el grupo concluido o cancelado.
  IF NEW.instructor IS DISTINCT FROM OLD.instructor THEN
    IF OLD.estado IN ('concluido', 'cancelado') THEN
      PERFORM apd.error('grupo_cerrado', 'El instructor no cambia en un grupo concluido o cancelado');
    END IF;
    IF NEW.instructor IS NULL AND OLD.estado <> 'en_integracion' THEN
      PERFORM apd.error('sin_instructor', 'Un grupo confirmado siempre tiene instructor');
    END IF;
    PERFORM apd.registrar('cambio_instructor', 'grupo', NEW.id::text,
      format('%s → %s', coalesce(OLD.instructor, 'sin instructor'), coalesce(NEW.instructor, 'sin instructor')));
  END IF;
  NEW.estado_desde := OLD.estado_desde;
  IF NEW.estado = OLD.estado THEN RETURN NEW; END IF;

  permitidas := CASE OLD.estado
    WHEN 'en_integracion' THEN ARRAY['confirmado', 'cancelado']
    WHEN 'confirmado'     THEN ARRAY['en_curso', 'en_integracion', 'cancelado']
    WHEN 'en_curso'       THEN ARRAY['concluido', 'cancelado']
    ELSE ARRAY[]::text[]
  END;
  IF NOT NEW.estado = ANY (permitidas) THEN
    PERFORM apd.error('transicion_invalida', format('Un grupo no pasa de «%s» a «%s»', OLD.estado, NEW.estado));
  END IF;

  SELECT count(*) INTO inscritos FROM apd.inscripcion WHERE grupo_id = NEW.id AND activa;

  IF NEW.estado IN ('confirmado', 'en_curso') AND inscritos < NEW.cupo_minimo THEN
    PERFORM apd.error('cupo_minimo', format('El grupo tiene %s personas y necesita al menos %s', inscritos, NEW.cupo_minimo));
  END IF;
  IF NEW.estado = 'en_curso' AND apd.hoy() < NEW.fecha_inicio THEN
    PERFORM apd.error('antes_de_inicio', 'El curso inicia el ' || to_char(NEW.fecha_inicio, 'DD/MM/YYYY'));
  END IF;
  IF NEW.estado = 'concluido' THEN
    -- Al concluir, nadie queda sin resultado: o tiene examen, o se le marca sin derecho a examen.
    SELECT string_agg(s.folio, ', ') INTO pendientes
      FROM apd.inscripcion i
      JOIN apd.solicitud s ON s.id = i.solicitud_id
      JOIN apd.curso c ON c.tipo_acreditacion = NEW.tipo_acreditacion AND c.modalidad = NEW.modalidad
     WHERE i.grupo_id = NEW.id AND i.activa
       AND NOT EXISTS (SELECT 1 FROM apd.examen e WHERE e.inscripcion_id = i.id)
       AND (SELECT count(*) FROM apd.asistencia a WHERE a.inscripcion_id = i.id AND a.asistio) >= c.dias_minimos_asistencia;
    IF pendientes IS NOT NULL THEN
      PERFORM apd.error('faltan_calificaciones', 'Falta capturar la calificación de: ' || pendientes);
    END IF;
  END IF;
  IF NEW.estado = 'cancelado' AND coalesce(trim(NEW.motivo_cancelacion), '') = '' THEN
    PERFORM apd.error('cancelacion_sin_motivo', 'Indica el motivo de la cancelación');
  END IF;
  NEW.estado_desde := apd.ahora();
  RETURN NEW;
END $$;
CREATE TRIGGER grupo_cambio BEFORE UPDATE ON apd.grupo
  FOR EACH ROW EXECUTE FUNCTION apd.grupo_cambio();

CREATE FUNCTION apd.grupo_cambio_aplicar() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r record;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM apd.registrar('alta', 'grupo', NEW.id::text,
      format('%s · %s %s · %s · cupo %s-%s', NEW.folio, NEW.tipo_acreditacion, NEW.modalidad, NEW.integracion, NEW.cupo_minimo, NEW.cupo_maximo));
    RETURN NULL;
  END IF;
  IF NEW.estado = OLD.estado THEN RETURN NULL; END IF;
  PERFORM apd.registrar('estado', 'grupo', NEW.id::text,
    concat_ws(' · ', format('%s → %s', OLD.estado, NEW.estado), nullif(NEW.motivo_cancelacion, '')));
  IF NEW.estado = 'cancelado' THEN
    -- Las personas regresan a la bandeja con su antigüedad original (lista_para_curso_en no cambia)
    UPDATE apd.inscripcion SET activa = false, motivo_baja = 'Grupo cancelado: ' || NEW.motivo_cancelacion
     WHERE grupo_id = NEW.id AND activa;
  ELSIF NEW.estado = 'concluido' THEN
    FOR r IN SELECT i.solicitud_id FROM apd.inscripcion i
              WHERE i.grupo_id = NEW.id AND i.activa
                AND NOT EXISTS (SELECT 1 FROM apd.examen e WHERE e.inscripcion_id = i.id) LOOP
      UPDATE apd.solicitud SET estado = 'sin_derecho_examen' WHERE id = r.solicitud_id;
    END LOOP;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER grupo_cambio_aplicar AFTER INSERT OR UPDATE ON apd.grupo
  FOR EACH ROW EXECUTE FUNCTION apd.grupo_cambio_aplicar();

-- ───────────────────────────── Inscripciones ─────────────────────────────

CREATE FUNCTION apd.inscripcion_alta() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  g apd.grupo;
  s apd.solicitud;
  inscritos integer;
BEGIN
  -- El grupo se bloquea mientras se cuenta: dos personas del personal no pueden pasar del cupo a la vez
  SELECT * INTO g FROM apd.grupo WHERE id = NEW.grupo_id FOR UPDATE;
  SELECT * INTO s FROM apd.solicitud WHERE id = NEW.solicitud_id FOR UPDATE;
  IF g.estado NOT IN ('en_integracion', 'confirmado') THEN
    PERFORM apd.error('grupo_cerrado', 'El grupo ya no recibe personas');
  END IF;
  IF s.estado <> 'lista_para_curso' THEN
    PERFORM apd.error('solicitud_no_lista', format('La solicitud %s no está en espera de grupo', s.folio));
  END IF;
  IF (s.tipo_acreditacion, s.modalidad) <> (g.tipo_acreditacion, g.modalidad) THEN
    PERFORM apd.error('otro_curso', format('La solicitud %s es de otro curso', s.folio));
  END IF;
  IF g.integracion = 'especifico' AND s.organizacion_id IS DISTINCT FROM g.organizacion_id THEN
    PERFORM apd.error('otra_organizacion', format('La solicitud %s no es de la organización del grupo', s.folio));
  END IF;
  SELECT count(*) INTO inscritos FROM apd.inscripcion WHERE grupo_id = g.id AND activa;
  IF inscritos >= g.cupo_maximo THEN
    PERFORM apd.error('cupo_maximo', format('El grupo está lleno: %s de %s', inscritos, g.cupo_maximo));
  END IF;
  NEW.activa := true;
  NEW.baja_en := NULL;
  NEW.motivo_baja := NULL;
  NEW.inscrita_en := apd.ahora();
  RETURN NEW;
END $$;
CREATE TRIGGER inscripcion_alta BEFORE INSERT ON apd.inscripcion
  FOR EACH ROW EXECUTE FUNCTION apd.inscripcion_alta();

CREATE FUNCTION apd.inscripcion_cambio() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.solicitud_id, NEW.grupo_id, NEW.inscrita_en) IS DISTINCT FROM (OLD.solicitud_id, OLD.grupo_id, OLD.inscrita_en)
     OR (NEW.activa AND NOT OLD.activa) OR (NOT OLD.activa AND NEW.motivo_baja IS DISTINCT FROM OLD.motivo_baja) THEN
    PERFORM apd.error('inscripcion_inmutable', 'Una inscripción sólo cambia para darla de baja');
  END IF;
  IF OLD.activa AND NOT NEW.activa THEN
    IF coalesce(trim(NEW.motivo_baja), '') = '' THEN
      PERFORM apd.error('baja_sin_motivo', 'Indica el motivo de la baja');
    END IF;
    IF EXISTS (SELECT 1 FROM apd.examen WHERE inscripcion_id = NEW.id) THEN
      PERFORM apd.error('baja_con_examen', 'No se da de baja a quien ya presentó examen');
    END IF;
    NEW.baja_en := apd.ahora();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER inscripcion_cambio BEFORE UPDATE ON apd.inscripcion
  FOR EACH ROW EXECUTE FUNCTION apd.inscripcion_cambio();

CREATE FUNCTION apd.inscripcion_aplicar() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE folio_grupo text := (SELECT folio FROM apd.grupo WHERE id = NEW.grupo_id);
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE apd.solicitud SET estado = 'inscrita' WHERE id = NEW.solicitud_id;
    PERFORM apd.registrar('inscripcion', 'solicitud', NEW.solicitud_id::text, 'Grupo ' || folio_grupo);
  ELSIF OLD.activa AND NOT NEW.activa THEN
    -- Regresa a la bandeja salvo que la baja venga de cancelar la propia solicitud
    UPDATE apd.solicitud SET estado = 'lista_para_curso' WHERE id = NEW.solicitud_id AND estado = 'inscrita';
    PERFORM apd.registrar('baja', 'solicitud', NEW.solicitud_id::text, format('Grupo %s · %s', folio_grupo, NEW.motivo_baja));
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER inscripcion_aplicar AFTER INSERT OR UPDATE ON apd.inscripcion
  FOR EACH ROW EXECUTE FUNCTION apd.inscripcion_aplicar();

-- ───────────────────────────── Asistencia y examen ─────────────────────────────

CREATE FUNCTION apd.asistencia_captura() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  g apd.grupo;
  c apd.curso;
  activa boolean;
BEGIN
  SELECT gr.* INTO g FROM apd.inscripcion i JOIN apd.grupo gr ON gr.id = i.grupo_id WHERE i.id = NEW.inscripcion_id;
  SELECT i.activa INTO activa FROM apd.inscripcion i WHERE i.id = NEW.inscripcion_id;
  SELECT * INTO c FROM apd.curso WHERE tipo_acreditacion = g.tipo_acreditacion AND modalidad = g.modalidad;
  IF NOT activa THEN
    PERFORM apd.error('inscripcion_inactiva', 'La persona ya no está en el grupo');
  END IF;
  IF g.estado <> 'en_curso' THEN
    PERFORM apd.error('grupo_no_en_curso', 'La asistencia se captura mientras el curso está en marcha');
  END IF;
  IF NEW.dia > c.dias_duracion THEN
    PERFORM apd.error('dia_inexistente', format('El curso dura %s días', c.dias_duracion));
  END IF;
  IF EXISTS (SELECT 1 FROM apd.examen WHERE inscripcion_id = NEW.inscripcion_id) THEN
    PERFORM apd.error('asistencia_cerrada', 'Con el examen capturado, la asistencia ya no cambia');
  END IF;
  IF g.fecha_inicio + (NEW.dia - 1) > apd.hoy() THEN
    PERFORM apd.error('dia_futuro', 'No se captura asistencia de un día que no ha ocurrido');
  END IF;
  NEW.capturada_en := apd.ahora();
  RETURN NEW;
END $$;
CREATE TRIGGER asistencia_captura BEFORE INSERT OR UPDATE ON apd.asistencia
  FOR EACH ROW EXECUTE FUNCTION apd.asistencia_captura();

CREATE FUNCTION apd.examen_captura() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  g apd.grupo;
  c apd.curso;
  activa boolean;
  asistidos integer;
BEGIN
  SELECT gr.* INTO g FROM apd.inscripcion i JOIN apd.grupo gr ON gr.id = i.grupo_id WHERE i.id = NEW.inscripcion_id;
  SELECT i.activa INTO activa FROM apd.inscripcion i WHERE i.id = NEW.inscripcion_id;
  SELECT * INTO c FROM apd.curso WHERE tipo_acreditacion = g.tipo_acreditacion AND modalidad = g.modalidad;
  IF NOT activa THEN
    PERFORM apd.error('inscripcion_inactiva', 'La persona ya no está en el grupo');
  END IF;
  IF g.estado <> 'en_curso' THEN
    PERFORM apd.error('grupo_no_en_curso', 'La calificación se captura mientras el curso está en marcha');
  END IF;
  SELECT count(*) INTO asistidos FROM apd.asistencia WHERE inscripcion_id = NEW.inscripcion_id AND asistio;
  IF asistidos < c.dias_minimos_asistencia THEN
    PERFORM apd.error('sin_derecho_examen', format('Asistió %s de %s días; se necesitan %s para tener derecho a examen',
      asistidos, c.dias_duracion, c.dias_minimos_asistencia));
  END IF;
  IF NEW.presentado_en > apd.hoy() OR NEW.presentado_en < g.fecha_inicio THEN
    PERFORM apd.error('fecha_examen', 'La fecha del examen debe estar entre el inicio del curso y hoy');
  END IF;
  NEW.capturado_en := apd.ahora();
  RETURN NEW;
END $$;
CREATE TRIGGER examen_captura BEFORE INSERT ON apd.examen
  FOR EACH ROW EXECUTE FUNCTION apd.examen_captura();

CREATE FUNCTION apd.examen_aplicar() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  sol uuid;
  minima numeric;
BEGIN
  SELECT i.solicitud_id, c.calificacion_minima INTO sol, minima
    FROM apd.inscripcion i JOIN apd.grupo g ON g.id = i.grupo_id
    JOIN apd.curso c ON c.tipo_acreditacion = g.tipo_acreditacion AND c.modalidad = g.modalidad
   WHERE i.id = NEW.inscripcion_id;
  PERFORM apd.registrar('examen', 'solicitud', sol::text, format('Calificación %s (mínima %s)', NEW.calificacion, minima));
  UPDATE apd.solicitud SET estado = CASE WHEN NEW.calificacion >= minima THEN 'aprobada' ELSE 'no_acreditada' END
   WHERE id = sol;
  RETURN NULL;
END $$;
CREATE TRIGGER examen_aplicar AFTER INSERT ON apd.examen
  FOR EACH ROW EXECUTE FUNCTION apd.examen_aplicar();

-- ───────────────────────────── Bandeja de demanda e indicador ─────────────────────────────
-- Decisiones (2026-10-14): alerta de prioridad a los dias_alerta_espera (31) días; en renovación, la
-- bandeja ordena por vencimiento de la acreditación anterior. El orden lo da la consulta del backend
-- (ORDER BY prioridad DESC, orden_sugerido); aquí van los datos para ordenar y filtrar.

CREATE VIEW apd.bandeja_demanda AS
  SELECT s.id AS solicitud_id,
         s.folio,
         s.tipo_acreditacion,
         s.modalidad,
         concat_ws(' ', p.nombre, p.primer_apellido, p.segundo_apellido) AS nombre,
         o.id AS organizacion_id,
         coalesce(o.nombre, CASE s.adscripcion WHEN 'independiente' THEN 'Independiente' ELSE 'Sin adscripción' END) AS organizacion,
         coalesce(o.tipo, s.adscripcion, 'sin_adscripcion') AS organizacion_tipo,
         s.lista_para_curso_en,
         apd.hoy() - (s.lista_para_curso_en AT TIME ZONE 'America/Mexico_City')::date AS dias_espera,
         a.vence_en AS vence_anterior,
         CASE WHEN a.id IS NULL THEN NULL ELSE a.vence_en - apd.hoy() END AS dias_para_vencer,
         (apd.hoy() - (s.lista_para_curso_en AT TIME ZONE 'America/Mexico_City')::date)
           >= apd.parametro_texto('dias_alerta_espera')::integer AS prioridad,
         CASE WHEN s.modalidad = 'renovacion' THEN a.vence_en
              ELSE (s.lista_para_curso_en AT TIME ZONE 'America/Mexico_City')::date END AS orden_sugerido,
         s.es_ficticio
    FROM apd.solicitud s
    JOIN apd.solicitante p ON p.id = s.solicitante_id
    LEFT JOIN apd.organizacion o ON o.id = s.organizacion_id
    LEFT JOIN apd.acreditacion a ON a.id = s.acreditacion_anterior_id
   WHERE s.estado = 'lista_para_curso';
COMMENT ON VIEW apd.bandeja_demanda IS 'Personas en espera de grupo, con días de espera, prioridad (alerta) y, en renovación, días para el vencimiento.';

-- Indicador permanente (decisión 2026-10-14): personas cuya acreditación venció mientras esperan grupo.
CREATE VIEW apd.vencidas_en_espera AS
  SELECT b.* FROM apd.bandeja_demanda b WHERE b.modalidad = 'renovacion' AND b.dias_para_vencer < 0;
COMMENT ON VIEW apd.vencidas_en_espera IS 'Renovaciones en espera de grupo con la acreditación anterior ya vencida: no pueden operar mientras esperan.';
