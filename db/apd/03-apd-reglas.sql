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
-- y, cuando una regla pide motivo, set_config('apd.motivo', '<texto>', true). Para el personal declara además su perfil del
-- acceso del SIA (P27: revision_cotejo, instructor, capacitacion, emision, consulta, directivo o administracion) con
-- set_config('apd.perfil', '<perfil>', true): lo piden las reglas reservadas a ciertos perfiles (la cancelación, P120; asignar
-- la persona instructora y confirmar un grupo, del perfil capacitacion: ajustes del equipo, 25/10/2026).

-- ───────────────────────────── Utilidades ─────────────────────────────

CREATE FUNCTION apd.error(codigo text, mensaje text) RETURNS void
  LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = mensaje, HINT = 'apd:' || codigo;
END $$;
COMMENT ON FUNCTION apd.error(text, text) IS 'Levanta una regla incumplida con su código para el backend (HINT apd:<codigo>).';

CREATE FUNCTION apd.contexto(nombre text) RETURNS text
  LANGUAGE sql STABLE AS $$ SELECT coalesce(current_setting('apd.' || nombre, true), '') $$;

-- Nombre de un estado como lo lee el personal en pantalla (los de la solicitud, como APD.ESTADOS en sitio/app/apd.js):
-- los mensajes de error no muestran la clave interna (revisión de textos, 2026-10-17).
CREATE FUNCTION apd.nombre_estado(p_estado text) RETURNS text
  LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE p_estado
    WHEN 'borrador' THEN 'Borrador'
    WHEN 'enviada' THEN 'En revisión documental'
    WHEN 'con_observaciones' THEN 'Con observaciones'
    WHEN 'validada_en_linea' THEN 'Cita asignada'
    WHEN 'lista_para_curso' THEN 'En espera de grupo'
    WHEN 'inscrita' THEN 'Con grupo asignado'
    WHEN 'aprobada' THEN 'Aprobada'
    WHEN 'acreditada' THEN 'Acreditación emitida'
    WHEN 'no_acreditada' THEN 'No acreditada'
    WHEN 'sin_derecho_examen' THEN 'Sin derecho a examen'
    WHEN 'cancelada' THEN 'Cancelada'
    WHEN 'concluida_sin_atender' THEN 'Concluida sin atender'
    WHEN 'rechazada' THEN 'Rechazada'
    WHEN 'en_integracion' THEN 'En integración'
    WHEN 'confirmado' THEN 'Confirmado'
    WHEN 'en_curso' THEN 'En curso'
    WHEN 'concluido' THEN 'Concluido'
    WHEN 'cancelado' THEN 'Cancelado'
    WHEN 'pendiente' THEN 'Por atender'
    WHEN 'en_pausa' THEN 'En pausa'
    WHEN 'atendida' THEN 'Atendida'
    WHEN 'sin_pago' THEN 'Sin pago'
    WHEN 'no_se_presento' THEN 'No se presentó'
    WHEN 'no_es_la_persona' THEN 'No era la persona'
    WHEN 'solicitada' THEN 'Acta en revisión'
    WHEN 'acta_aceptada' THEN 'Acta aceptada'
    WHEN 'repuesta' THEN 'Credencial repuesta'
    ELSE p_estado
  END $$;
COMMENT ON FUNCTION apd.nombre_estado(text) IS 'Nombre en pantalla de un estado de solicitud, grupo, cita o reposición, para los mensajes de error.';

CREATE FUNCTION apd.parametro_texto(p_clave text) RETURNS text
  LANGUAGE plpgsql STABLE AS $$
DECLARE v text;
BEGIN
  SELECT valor INTO v FROM apd.parametro WHERE clave = p_clave;
  IF v IS NULL THEN
    PERFORM apd.error('parametro_inexistente', format('Falta configurar el parámetro %s del sistema', p_clave));
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

-- La bitácora la escriben sólo las reglas (D-13 y E2-06, auditoría 2026-10-19): la cuenta del servicio no tiene INSERT
-- sobre apd.bitacora (05-apd-rol-y-permisos.sql). Esta función escribe con los permisos de quien instala (SECURITY
-- DEFINER, con search_path fijo) y sólo cuando la llama un disparador (pg_trigger_depth() > 0): nadie la llama directo
-- para fabricar renglones. Quién, cuándo y desde dónde no son parámetros: los pone apd.bitacora_alta.
CREATE FUNCTION apd.registrar(p_accion text, p_entidad text, p_entidad_id text, p_detalle text DEFAULT '')
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = apd, pg_temp AS $$
BEGIN
  IF pg_trigger_depth() = 0 THEN
    PERFORM apd.error('bitacora_directa', 'La bitácora sólo la escriben las reglas de la base');
  END IF;
  INSERT INTO apd.bitacora (accion, entidad, entidad_id, detalle)
  VALUES (p_accion, p_entidad, p_entidad_id, coalesce(p_detalle, ''));
END $$;

-- Cada renglón nuevo de la bitácora lleva la fecha de la base y quién y desde dónde según el contexto de la transacción,
-- aunque quien inserta (también la administración) mande otra cosa
CREATE FUNCTION apd.bitacora_alta() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE tipo text := apd.contexto('usuario_tipo');
BEGIN
  NEW.id := gen_random_uuid();
  NEW.fecha := apd.ahora();
  NEW.usuario := apd.contexto('usuario');
  NEW.usuario_tipo := CASE WHEN tipo = '' THEN 'sistema' ELSE tipo END;
  NEW.procedencia := apd.contexto('procedencia');
  RETURN NEW;
END $$;
CREATE TRIGGER bitacora_alta BEFORE INSERT ON apd.bitacora
  FOR EACH ROW EXECUTE FUNCTION apd.bitacora_alta();

-- Nombre comparable: sin acentos, minúsculas, sin puntuación y sin espacios dobles («C.F.E.» = «CFE»).
CREATE FUNCTION apd.normalizar(t text) RETURNS text
  LANGUAGE sql IMMUTABLE AS $$
  SELECT trim(regexp_replace(regexp_replace(
           lower(translate(t, 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')),
           '[^a-z0-9 ]', '', 'g'), '\s+', ' ', 'g'))
$$;

-- Folios y números de expediente: un contador por serie y año, avanzado en un solo paso para que dos altas simultáneas nunca
-- reciban el mismo número. SECURITY DEFINER: la cuenta del servicio no toca folio_contador directamente, y tampoco puede
-- llamar esta función (decisión 6, 2026-10-19: sin EXECUTE): la llaman sólo las reglas que dan de alta solicitudes, grupos
-- y acreditaciones, que corren con los permisos de quien instala (SECURITY DEFINER, search_path fijo).
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

-- Cuotas que no son de un curso (la reposición de la credencial, P140, sesión de trabajo del 23/10/2026): como el costo
-- de cada curso, el monto lo actualiza el personal con la publicación que lo fija y desde cuándo aplica (cambia cada año);
-- queda en la bitácora. Una reposición con el acta ya aceptada conserva el monto que se le indicó (apd.reposicion.pago_monto).
CREATE FUNCTION apd.cuota_cambio() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.actualizado_en := apd.ahora();
  IF (NEW.concepto, NEW.monto, NEW.fundamento, NEW.vigente_desde) IS DISTINCT FROM (OLD.concepto, OLD.monto, OLD.fundamento, OLD.vigente_desde) THEN
    IF apd.contexto('usuario_tipo') <> 'personal' THEN
      PERFORM apd.error('cuota_de_personal', 'La cuota la actualiza el personal de la Secretaría');
    END IF;
    PERFORM apd.registrar('cambio_monto', 'cuota', NEW.clave,
      format('%s → %s desde %s. %s', coalesce(OLD.monto::text, 'sin monto'), coalesce(NEW.monto::text, 'sin monto'),
             coalesce(NEW.vigente_desde::text, '—'), coalesce(NEW.fundamento, '')));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER cuota_cambio BEFORE UPDATE ON apd.cuota
  FOR EACH ROW EXECUTE FUNCTION apd.cuota_cambio();

-- Qué pide cada curso (apd.requisito_curso): agregar, quitar o cambiar un requisito cambia lo que se exige a cada
-- solicitud, así que queda en la bitácora con lo que había (E2-04, auditoría 2026-10-19). El disparador se crea en
-- 04-apd-catalogos.sql, después del catálogo inicial, para que la instalación no llene la bitácora.
CREATE FUNCTION apd.requisito_curso_registrar() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r apd.requisito_curso := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
BEGIN
  PERFORM apd.registrar(CASE TG_OP WHEN 'INSERT' THEN 'requisito_agregado' WHEN 'DELETE' THEN 'requisito_quitado' ELSE 'requisito_cambiado' END,
    'curso', r.tipo_acreditacion || '/' || r.modalidad,
    CASE TG_OP
      WHEN 'INSERT' THEN format('%s · orden %s · %s', NEW.requisito, NEW.orden, CASE WHEN NEW.obligatorio THEN 'obligatorio' ELSE 'si aplica' END)
      WHEN 'DELETE' THEN format('%s · orden %s · %s', OLD.requisito, OLD.orden, CASE WHEN OLD.obligatorio THEN 'obligatorio' ELSE 'si aplica' END)
      ELSE concat_ws('; ', NEW.requisito,
        CASE WHEN NEW.orden IS DISTINCT FROM OLD.orden THEN format('orden %s → %s', OLD.orden, NEW.orden) END,
        CASE WHEN NEW.obligatorio IS DISTINCT FROM OLD.obligatorio THEN format('obligatorio %s → %s', OLD.obligatorio, NEW.obligatorio) END,
        CASE WHEN NEW.nota IS DISTINCT FROM OLD.nota THEN format('nota «%s» → «%s»', OLD.nota, NEW.nota) END)
    END);
  RETURN NULL;
END $$;

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
    -- La situación del grado sólo se pregunta con licenciatura; con posgrado se asume titulada (decisión 2026-10-18)
    WHEN p_nivel = 'licenciatura' AND p_estatus IS NULL THEN NULL
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
    NEW.carrera := NULL;
  END IF;
  -- La situación del grado, sólo con licenciatura: con maestría o doctorado se asume la licenciatura titulada (2026-10-18).
  -- En poda no se pregunta (sesión de trabajo del 23/10/2026): sólo en dictaminador, donde define el perfil.
  IF NEW.nivel_estudios IS DISTINCT FROM 'licenciatura' OR NEW.tipo_acreditacion <> 'dictaminador' THEN NEW.estatus_estudios := NULL; END IF;
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
-- la persona (la cambia en «Mi perfil»); cada solicitud guarda una copia al darse de alta y al enviarse.
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
    PERFORM apd.registrar('expediente', 'solicitante', p_solicitante::text, 'Se abre el expediente físico ' || n);
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
-- p. ej. CURP_ANA EJEMPLO MUESTRA.pdf. Mayúsculas sin acentos (la Ñ se conserva) y sin caracteres que un
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

-- Un correo, una cuenta (decisión 2026-10-17, Liber): además de la CURP, el correo no se repite entre cuentas
-- activas. Las personas del registro anterior que aún no crean su cuenta no cuentan: su correo puede ser viejo o
-- compartido; al activarla escriben el suyo. El índice solicitante_correo_uk lo garantiza; esta regla da el mensaje.
CREATE FUNCTION apd.comprobar_correo(p apd.solicitante) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF p.estado <> 'sin_activar' AND EXISTS (
       SELECT 1 FROM apd.solicitante o WHERE o.correo = p.correo AND o.id <> p.id AND o.estado <> 'sin_activar') THEN
    PERFORM apd.error('correo_registrado', 'Este correo ya está registrado en otra cuenta');
  END IF;
END $$;

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
  PERFORM apd.comprobar_correo(NEW);
  RETURN NEW;
END $$;
CREATE TRIGGER solicitante_alta BEFORE INSERT ON apd.solicitante
  FOR EACH ROW EXECUTE FUNCTION apd.solicitante_alta();

-- La CURP identifica la cuenta. La Secretaría puede corregirla, con motivo en la bitácora (decisión de
-- cuentas, 2026-10-14). Quien solicita no la cambia: si se equivocó, lo pide a la Secretaría.
CREATE FUNCTION apd.solicitante_cambio() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  cambio_estado text := CASE WHEN NEW.estado IS DISTINCT FROM OLD.estado THEN format('%s → %s', OLD.estado, NEW.estado) END;
  bloqueo_antes boolean;
  bloqueo_despues boolean;
BEGIN
  -- Bloqueo por intentos fallidos (D-07, auditoría 2026-10-19): al llegar a intentos_maximos, la base bloquea la entrada
  -- minutos_bloqueo minutos (parámetros); mientras dura, más intentos no lo alargan. Poner o quitar un bloqueo vigente, y
  -- cada cambio de estado de la cuenta, quedan en la bitácora (E2-04), en un solo renglón por cambio.
  IF NEW.intentos_fallidos > OLD.intentos_fallidos
     AND NEW.intentos_fallidos >= apd.parametro_texto('intentos_maximos')::integer
     AND (NEW.bloqueada_hasta IS NULL OR NEW.bloqueada_hasta <= apd.ahora()) THEN
    NEW.bloqueada_hasta := apd.ahora() + make_interval(mins => apd.parametro_texto('minutos_bloqueo')::integer);
  END IF;
  bloqueo_antes := OLD.bloqueada_hasta IS NOT NULL AND OLD.bloqueada_hasta > apd.ahora();
  bloqueo_despues := NEW.bloqueada_hasta IS NOT NULL AND NEW.bloqueada_hasta > apd.ahora();
  IF bloqueo_despues AND NEW.bloqueada_hasta IS DISTINCT FROM OLD.bloqueada_hasta THEN
    PERFORM apd.registrar('bloqueo_intentos', 'solicitante', NEW.id::text,
      concat_ws(' · ', format('Entrada bloqueada hasta el %s tras %s intentos fallidos',
                              to_char(NEW.bloqueada_hasta AT TIME ZONE 'America/Mexico_City', 'DD/MM/YYYY HH24:MI'), NEW.intentos_fallidos),
                cambio_estado));
    cambio_estado := NULL;
  ELSIF bloqueo_antes AND NOT bloqueo_despues THEN
    PERFORM apd.registrar('desbloqueo_intentos', 'solicitante', NEW.id::text,
      concat_ws(' · ', format('Se quita el bloqueo por intentos que duraba hasta el %s (intentos: %s → %s)',
                              to_char(OLD.bloqueada_hasta AT TIME ZONE 'America/Mexico_City', 'DD/MM/YYYY HH24:MI'),
                              OLD.intentos_fallidos, NEW.intentos_fallidos),
                cambio_estado, nullif(apd.contexto('motivo'), '')));
    cambio_estado := NULL;
  END IF;
  NEW.nombre := apd.mayusculas(NEW.nombre);
  NEW.primer_apellido := apd.mayusculas(NEW.primer_apellido);
  NEW.segundo_apellido := apd.mayusculas(NEW.segundo_apellido);
  NEW.curp := upper(trim(NEW.curp));
  NEW.correo := lower(trim(NEW.correo));
  IF NEW.correo IS DISTINCT FROM OLD.correo OR (OLD.estado = 'sin_activar' AND NEW.estado <> 'sin_activar') THEN
    PERFORM apd.comprobar_correo(NEW);
  END IF;
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
  -- Bloqueo por identidad (cita de cotejo con otra persona, decisión 2026-10-17): lo pone y lo quita la Secretaría
  IF NEW.bloqueo_motivo IS DISTINCT FROM OLD.bloqueo_motivo THEN
    IF apd.contexto('usuario_tipo') <> 'personal' THEN
      PERFORM apd.error('bloqueo_de_personal', 'Sólo la Secretaría bloquea o desbloquea una cuenta por identidad');
    END IF;
    PERFORM apd.registrar('bloqueo', 'solicitante', NEW.id::text,
      concat_ws(' · ', coalesce(NEW.bloqueo_motivo, 'desbloqueo'), cambio_estado, nullif(apd.contexto('motivo'), '')));
    cambio_estado := NULL;
  END IF;
  IF cambio_estado IS NOT NULL THEN
    PERFORM apd.registrar('estado', 'solicitante', NEW.id::text, concat_ws(' · ', cambio_estado, nullif(apd.contexto('motivo'), '')));
  END IF;
  IF OLD.bloqueo_motivo IS NOT NULL AND NEW.bloqueo_motivo IS NOT NULL AND NEW.estado <> 'bloqueada' THEN
    PERFORM apd.error('bloqueo_por_identidad', 'La cuenta sigue bloqueada mientras la Secretaría aclara la identidad de la persona');
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

-- Entrada con CURP y contraseña (D-07). El backend, al comprobar la contraseña, llama una de las dos:
--   · apd.anotar_intento(curp) si no coincide: suma el intento en un solo paso (UPDATE … RETURNING, sin carreras entre
--     dos intentos simultáneos) y devuelve los intentos y hasta cuándo queda bloqueada (NULL si no lo está). Un bloqueo
--     ya vencido empieza la cuenta de nuevo. Una CURP sin cuenta no devuelve nada (el backend da el mensaje general);
--   · apd.acceso_correcto(curp) si coincide: con un bloqueo vigente la rechaza (cuenta_bloqueada_intentos) aunque la
--     contraseña sea correcta; si no, vuelve el contador a 0.
CREATE FUNCTION apd.anotar_intento(p_curp text) RETURNS TABLE (intentos integer, bloqueada_hasta timestamptz)
  LANGUAGE sql AS $$
  UPDATE apd.solicitante s
     SET intentos_fallidos = CASE WHEN s.bloqueada_hasta IS NOT NULL AND s.bloqueada_hasta <= apd.ahora() THEN 1
                                  ELSE least(s.intentos_fallidos + 1, 32000) END,
         bloqueada_hasta = CASE WHEN s.bloqueada_hasta <= apd.ahora() THEN NULL ELSE s.bloqueada_hasta END
   WHERE s.curp = upper(trim(p_curp))
  RETURNING s.intentos_fallidos::integer, s.bloqueada_hasta
$$;
COMMENT ON FUNCTION apd.anotar_intento(text) IS 'Suma un intento de entrada fallido y bloquea al llegar a intentos_maximos (parámetros). Devuelve intentos y fin del bloqueo.';

CREATE FUNCTION apd.acceso_correcto(p_curp text) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE hasta timestamptz;
BEGIN
  SELECT s.bloqueada_hasta INTO hasta FROM apd.solicitante s WHERE s.curp = upper(trim(p_curp)) FOR UPDATE;
  IF NOT FOUND THEN RETURN false; END IF;
  IF hasta > apd.ahora() THEN
    PERFORM apd.error('cuenta_bloqueada_intentos', format(
      'Por seguridad, tu cuenta está bloqueada por varios intentos fallidos. Vuelve a intentarlo después de las %s',
      to_char(hasta AT TIME ZONE 'America/Mexico_City', 'HH24:MI')));
  END IF;
  UPDATE apd.solicitante s SET intentos_fallidos = 0, bloqueada_hasta = NULL
   WHERE s.curp = upper(trim(p_curp)) AND (s.intentos_fallidos <> 0 OR s.bloqueada_hasta IS NOT NULL);
  RETURN true;
END $$;
COMMENT ON FUNCTION apd.acceso_correcto(text) IS 'Entrada correcta: rechaza si hay un bloqueo por intentos vigente; si no, vuelve el contador a 0.';

-- Fotografía de frente de la persona (decisión 2026-10-14, Liber): obligatoria al crear la cuenta; sirve
-- para reconocerla en el cotejo y el curso, y quien aplica el examen la usa para confirmar su identidad y
-- su asistencia (por eso debe verse clara). La persona la cambia mientras nadie la haya confirmado; en el
-- cotejo el personal la confirma contra la identificación oficial y en la cita no se toma otra (decisión
-- 2026-10-17). La carga del personal (origen cotejo, queda confirmada) se conserva en la base para el caso
-- de actualizar una fotografía ya confirmada, que está por decidir (P100); hoy ninguna pantalla la usa.
-- Una carga nueva sustituye a la anterior sin borrarla.
CREATE FUNCTION apd.fotografia_alta() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE de_personal boolean := apd.contexto('usuario_tipo') = 'personal';
BEGIN
  IF NOT de_personal AND EXISTS (SELECT 1 FROM apd.fotografia f
                                  WHERE f.solicitante_id = NEW.solicitante_id AND f.vigente AND f.estado = 'confirmada') THEN
    PERFORM apd.error('foto_confirmada', 'La Secretaría ya confirmó tu fotografía; ya no se puede cambiar desde tu perfil');
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
    -- La carga el personal frente a la persona: queda confirmada (hoy sin pantalla; P100)
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
      PERFORM apd.error('foto_confirmada', 'Una fotografía confirmada no se desconfirma');
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
--   · nadie opera sin acreditación vigente: el estado se CALCULA con la fecha, nunca se guarda;
--   · una cancelada (P120, sesión de trabajo del 23/10/2026) lo está desde el día de su cancelación: no es vigente, no se
--     renueva y no sirve de requisito (la poda del dictaminador, la cuenta de los dos años).

-- ¿Estaba cancelada ese día? (el día de la cancelación, en la Ciudad de México, ya cuenta)
CREATE FUNCTION apd.cancelada_al(p_cancelada_en timestamptz, p_fecha date) RETURNS boolean
  LANGUAGE sql IMMUTABLE AS $$
  SELECT p_cancelada_en IS NOT NULL AND (p_cancelada_en AT TIME ZONE 'America/Mexico_City')::date <= p_fecha
$$;

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
  IF apd.cancelada_al(a.cancelada_en, f) THEN RETURN 'cancelada'; END IF;
  IF f < a.vence_en - antes THEN RETURN 'vigente'; END IF;
  IF f <= a.vence_en THEN RETURN 'por_vencer'; END IF;
  IF f <= a.vence_en + make_interval(months => meses) THEN RETURN 'vencida_renovable'; END IF;
  RETURN 'vencida_no_renovable';
END $$;
COMMENT ON FUNCTION apd.estado_acreditacion(uuid, date) IS
  'vigente, por_vencer (ya se puede renovar), vencida_renovable, vencida_no_renovable (tramita como nueva), cancelada (P120) o no_emitida. Por fechas y cancelación; para saber si puede operar, apd.acreditacion_vigente().';

-- ¿Tiene la persona una acreditación de poda vigente ese día?
CREATE FUNCTION apd.poda_vigente(p_solicitante uuid, p_fecha date DEFAULT NULL) RETURNS boolean
  LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM apd.acreditacion
     WHERE solicitante_id = p_solicitante AND tipo_acreditacion = 'poda'
       AND coalesce(p_fecha, apd.hoy()) BETWEEN emitida_en AND vence_en
       AND NOT apd.cancelada_al(cancelada_en, coalesce(p_fecha, apd.hoy())))
$$;

-- Desde cuándo tiene la persona la acreditación de poda sin interrupción, hasta ese día (sesión de trabajo del 23/10/2026:
-- para pedir la de dictaminador hacen falta 2 años consecutivos). Se parte de la acreditación de poda vigente ese día y
-- se va hacia atrás: la anterior cuenta si la siguiente se emitió a más tardar meses_despues_renovacion meses después de
-- su vencimiento (la misma ventana de renovación tardía en la que todavía se renueva; pasada ésa, se tramita como nueva y
-- la cuenta empieza de nuevo). Una cancelada (P120) corta la cuenta: si es la de ese día, no hay poda vigente; si es una
-- anterior, la cadena empieza después de ella. Devuelve la emisión de la primera de esa cadena, o NULL si ese día no tiene
-- la poda vigente.
CREATE FUNCTION apd.poda_continua_desde(p_solicitante uuid, p_fecha date DEFAULT NULL) RETURNS date
  LANGUAGE plpgsql STABLE AS $$
DECLARE
  f date := coalesce(p_fecha, apd.hoy());
  meses integer := apd.parametro_texto('meses_despues_renovacion')::integer;
  desde date;
  a record;
BEGIN
  FOR a IN SELECT emitida_en, vence_en, cancelada_en FROM apd.acreditacion
            WHERE solicitante_id = p_solicitante AND tipo_acreditacion = 'poda' AND emitida_en <= f
            ORDER BY emitida_en DESC LOOP
    IF apd.cancelada_al(a.cancelada_en, f) THEN
      IF desde IS NULL THEN RETURN NULL; END IF;        -- la de ese día está cancelada: no hay poda vigente
      EXIT;                                             -- una cancelada corta la cuenta
    END IF;
    IF desde IS NULL THEN
      IF f > a.vence_en THEN RETURN NULL; END IF;       -- la más reciente ya no está vigente
      desde := a.emitida_en;
    ELSIF desde <= (a.vence_en + make_interval(months => meses))::date THEN
      desde := least(desde, a.emitida_en);              -- sin corte: se renovó dentro de la ventana
    ELSE
      EXIT;                                             -- corte: se renovó después de la ventana
    END IF;
  END LOOP;
  RETURN desde;
END $$;
COMMENT ON FUNCTION apd.poda_continua_desde(uuid, date) IS
  'Emisión de la primera acreditación de poda de la cadena sin cortes que llega a ese día (renovaciones dentro de la ventana de renovación tardía; una cancelada corta); NULL sin poda vigente.';

-- ¿Puede operar con esta acreditación ese día? Sólo cuentan sus propias fechas y su cancelación. La de dictaminador
-- sigue vigente hasta su fecha aunque la de poda venza antes (corrección R43, 2026-10-14): la poda
-- vigente se exige sólo al iniciar la solicitud.
CREATE FUNCTION apd.acreditacion_vigente(p_id uuid, p_fecha date DEFAULT NULL) RETURNS boolean
  LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM apd.acreditacion
                  WHERE id = p_id AND coalesce(p_fecha, apd.hoy()) BETWEEN emitida_en AND vence_en
                    AND NOT apd.cancelada_al(cancelada_en, coalesce(p_fecha, apd.hoy())))
$$;

-- Lo único que ve el público al verificar: sin CURP, sin contacto, sin domicilio; «Vigente», «No vigente» o «Cancelada»
-- (P120, con el día de la cancelación y sin el motivo ni el fundamento). Nunca «en renovación» ni «en trámite», que
-- alguien podría leer como permiso para operar.
CREATE VIEW apd.verificacion_publica AS
  SELECT a.numero,
         concat_ws(' ', s.nombre, s.primer_apellido, s.segundo_apellido) AS nombre,
         CASE a.tipo_acreditacion WHEN 'poda' THEN 'Poda y derribo' ELSE 'Dictaminador técnico' END AS tipo,
         a.emitida_en,
         a.vence_en,
         CASE WHEN apd.cancelada_al(a.cancelada_en, apd.hoy()) THEN 'Cancelada'
              WHEN apd.acreditacion_vigente(a.id) THEN 'Vigente' ELSE 'No vigente' END AS situacion,
         CASE WHEN apd.cancelada_al(a.cancelada_en, apd.hoy()) THEN (a.cancelada_en AT TIME ZONE 'America/Mexico_City')::date END AS cancelada_el
    FROM apd.acreditacion a
    JOIN apd.solicitante s ON s.id = a.solicitante_id;
COMMENT ON VIEW apd.verificacion_publica IS 'Consulta pública por número de acreditación: sólo nombre, tipo, fechas y «Vigente»/«No vigente»/«Cancelada» (con su día, sin motivo).';

-- ───────────────────────────── Acreditaciones ─────────────────────────────

-- SECURITY DEFINER (con search_path fijo): pide el número de la serie a apd.siguiente_folio, que la cuenta del servicio
-- no puede llamar directo (decisión 6, 2026-10-19).
CREATE FUNCTION apd.acreditacion_alta() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = apd, pg_temp AS $$
DECLARE s apd.solicitud;
BEGIN
  -- Una acreditación migrada (registro anterior: Kobo o papel) sólo la da de alta la carga de migración, con su fecha
  -- de emisión real (no futura) y su número original, que nunca tiene la forma de la serie del sistema: así no choca con
  -- una emisión y no detiene la serie (D-01, auditoría 2026-10-19)
  IF NEW.origen <> 'sistema' THEN
    IF apd.contexto('usuario_tipo') <> 'migracion' THEN
      PERFORM apd.error('migracion_sin_permiso', 'Una acreditación del registro anterior sólo la da de alta la carga de migración');
    END IF;
    IF NEW.emitida_en IS NULL OR NEW.emitida_en > apd.hoy() THEN
      PERFORM apd.error('migrada_futura', 'Una acreditación migrada conserva su fecha de emisión, que no puede ser posterior a hoy');
    END IF;
    IF NEW.numero ~ '^(PD|DT)-[0-9]{4}-[0-9]{4}$' THEN
      PERFORM apd.error('migrada_con_serie', 'El número de una acreditación migrada no puede tener la forma de la serie del sistema (PD-AAAA-NNNN o DT-AAAA-NNNN)');
    END IF;
  END IF;
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
    -- La renovación de una acreditación que se canceló mientras se tramitaba no se emite (P120): la cancelación cierra
    -- los trámites abiertos que la renuevan (apd.acreditacion_cancelada); éste es el de una solicitud ya aprobada
    IF s.modalidad = 'renovacion' AND EXISTS (SELECT 1 FROM apd.acreditacion x WHERE x.id = s.acreditacion_anterior_id AND x.cancelada_en IS NOT NULL) THEN
      PERFORM apd.error('renovacion_de_cancelada', 'La acreditación que se renovaba fue cancelada: no se emite la renovación');
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

-- Una acreditación emitida no se edita: sólo se registra, una vez, la entrega, y se cancela, una vez (P120).
CREATE FUNCTION apd.acreditacion_cambio() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE falta text;
BEGIN
  -- Cancelación (P120, sesión de trabajo del 23/10/2026): la registran instructores y directivos (los perfiles del
  -- parámetro perfiles_cancelan_acreditacion, P27; el perfil «directivo» es distinto de la administración del sistema, que
  -- ya no cancela: P201, decisión de Liber del 26/10/2026), con motivo y fundamento; sólo de una acreditación vigente ese día. La
  -- base pone el día y quién; ya no se deshace ni se cambia.
  IF (NEW.cancelada_en, NEW.cancelada_por, NEW.cancelacion_motivo, NEW.cancelacion_fundamento)
     IS DISTINCT FROM (OLD.cancelada_en, OLD.cancelada_por, OLD.cancelacion_motivo, OLD.cancelacion_fundamento) THEN
    IF OLD.cancelada_en IS NOT NULL THEN
      PERFORM apd.error('acreditacion_ya_cancelada', format('La acreditación %s ya está cancelada: la cancelación no se cambia', OLD.numero));
    END IF;
    IF apd.contexto('usuario_tipo') <> 'personal' OR apd.contexto('usuario') = ''
       OR NOT apd.contexto('perfil') = ANY (string_to_array(replace(apd.parametro_texto('perfiles_cancelan_acreditacion'), ' ', ''), ',')) THEN
      PERFORM apd.error('cancelacion_sin_permiso', 'Sólo los instructores y los directivos pueden cancelar una acreditación');
    END IF;
    IF length(trim(coalesce(NEW.cancelacion_motivo, ''))) < 10 THEN
      PERFORM apd.error('cancelacion_sin_motivo', 'Escriba el motivo de la cancelación (al menos 10 caracteres)');
    END IF;
    IF trim(coalesce(NEW.cancelacion_fundamento, '')) = '' THEN
      PERFORM apd.error('cancelacion_sin_fundamento', 'Escriba el fundamento de la cancelación');
    END IF;
    IF NOT apd.acreditacion_vigente(OLD.id) THEN
      PERFORM apd.error('cancelacion_no_vigente', format('Sólo se cancela una acreditación vigente: la %s ya no lo está', OLD.numero));
    END IF;
    NEW.cancelacion_motivo := trim(NEW.cancelacion_motivo);
    NEW.cancelacion_fundamento := trim(NEW.cancelacion_fundamento);
    NEW.cancelada_en := apd.ahora();
    NEW.cancelada_por := apd.contexto('usuario');
  END IF;
  IF (NEW.numero, NEW.solicitante_id, NEW.tipo_acreditacion, NEW.solicitud_id, NEW.emitida_en, NEW.vence_en,
      NEW.origen, NEW.folio_origen, NEW.es_ficticio)
     IS DISTINCT FROM
     (OLD.numero, OLD.solicitante_id, OLD.tipo_acreditacion, OLD.solicitud_id, OLD.emitida_en, OLD.vence_en,
      OLD.origen, OLD.folio_origen, OLD.es_ficticio) THEN
    PERFORM apd.error('acreditacion_inmutable', 'Una acreditación emitida no se modifica; sólo se registra su entrega o su cancelación');
  END IF;
  IF OLD.entregada_en IS NOT NULL AND NEW.entregada_en IS DISTINCT FROM OLD.entregada_en THEN
    PERFORM apd.error('entrega_ya_registrada', 'La entrega ya está registrada');
  END IF;
  IF NEW.entregada_en IS NOT NULL AND OLD.entregada_en IS NULL THEN
    IF OLD.cancelada_en IS NOT NULL THEN
      PERFORM apd.error('entrega_de_cancelada', 'Una acreditación cancelada no se entrega');
    END IF;
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
        PERFORM apd.error('sin_foto_credencial', 'Cargue la fotografía tomada para la credencial antes de registrar la entrega');
      ELSIF falta IS NOT NULL THEN
        PERFORM apd.error('sin_acuse_entrega', 'Cargue el comprobante de recepción firmado antes de registrar la entrega');
      END IF;
    END IF;
    PERFORM apd.registrar('entrega', 'acreditacion', NEW.id::text, format('%s entregada el %s', NEW.numero, NEW.entregada_en));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER acreditacion_cambio BEFORE UPDATE ON apd.acreditacion
  FOR EACH ROW EXECUTE FUNCTION apd.acreditacion_cambio();

-- Lo que sigue a una cancelación (P120): queda en la bitácora con el motivo y el fundamento; la reposición abierta de su
-- credencial se cancela (ya no hay credencial que reponer) y los trámites abiertos que la renuevan se cancelan con el motivo
-- (una cancelada no se renueva; si la solicitud ya está aprobada, la emisión la rechaza: renovacion_de_cancelada).
CREATE FUNCTION apd.acreditacion_cancelada() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.cancelada_en IS NULL AND NEW.cancelada_en IS NOT NULL THEN
    PERFORM apd.registrar('cancelacion', 'acreditacion', NEW.id::text,
      format('%s cancelada · motivo: %s · fundamento: %s', NEW.numero, NEW.cancelacion_motivo, NEW.cancelacion_fundamento));
    UPDATE apd.reposicion SET estado = 'cancelada', observacion = 'La acreditación se canceló.'
     WHERE acreditacion_id = NEW.id AND estado IN ('solicitada', 'con_observaciones', 'acta_aceptada');
    UPDATE apd.solicitud SET estado = 'cancelada', motivo_cierre = format('La acreditación %s que se renovaba fue cancelada.', NEW.numero)
     WHERE acreditacion_anterior_id = NEW.id AND modalidad = 'renovacion'
       AND estado NOT IN ('aprobada', 'acreditada', 'no_acreditada', 'sin_derecho_examen', 'cancelada', 'concluida_sin_atender', 'rechazada');
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER acreditacion_cancelada AFTER UPDATE ON apd.acreditacion
  FOR EACH ROW EXECUTE FUNCTION apd.acreditacion_cancelada();

-- ───────────────────────────── Reposición de la credencial ─────────────────────────────
-- P140, sesión de trabajo del 23/10/2026: la persona con su acreditación vigente pide la reposición de la credencial por
-- pérdida o robo, con el acta que levantó; el personal revisa el acta (la acepta o le pone observaciones y la persona
-- carga otra); con el acta aceptada, la persona paga la cuota de reposición (apd.cuota) y en el Vivero el personal valida
-- la factura y le entrega la credencial repuesta. La acreditación no cambia: mismo número, misma emisión, misma vigencia.
--   solicitada → acta_aceptada | con_observaciones (personal) → (con observaciones) solicitada, con otra acta (la persona)
--   acta_aceptada → repuesta (personal, con la factura) · cualquiera abierta → cancelada (con motivo; la base, si se
--   cancela la acreditación)
CREATE FUNCTION apd.reposicion_alta() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a apd.acreditacion;
BEGIN
  IF apd.contexto('usuario_tipo') <> 'solicitante' THEN
    PERFORM apd.error('reposicion_de_la_persona', 'La reposición la pide la persona titular desde «Mis trámites»');
  END IF;
  SELECT * INTO a FROM apd.acreditacion WHERE id = NEW.acreditacion_id FOR UPDATE;
  IF NOT apd.acreditacion_vigente(a.id) THEN
    PERFORM apd.error('reposicion_no_vigente', 'Sólo se repone la credencial de una acreditación vigente');
  END IF;
  -- Una credencial del sistema que todavía no se recoge no se repone: se recoge (las migradas se entregaron fuera de él)
  IF a.origen = 'sistema' AND a.entregada_en IS NULL THEN
    PERFORM apd.error('reposicion_sin_entrega', 'Tu credencial todavía no se te entrega: recógela en el Vivero');
  END IF;
  IF EXISTS (SELECT 1 FROM apd.reposicion r WHERE r.acreditacion_id = a.id AND r.estado IN ('solicitada', 'con_observaciones', 'acta_aceptada')) THEN
    PERFORM apd.error('reposicion_en_curso', 'Ya pediste la reposición de esta credencial: síguela en «Mis trámites»');
  END IF;
  IF NEW.acta_tamano_bytes > apd.parametro_texto('tamano_maximo_archivo_bytes')::integer THEN
    PERFORM apd.error('archivo_grande', format('El acta pesa más de %s MB', apd.parametro_texto('tamano_maximo_archivo_bytes')::integer / 1048576));
  END IF;
  NEW.estado := 'solicitada';
  NEW.observacion := '';
  NEW.solicitada_en := apd.ahora();
  NEW.estado_desde := NEW.solicitada_en;
  NEW.revisada_por := NULL; NEW.revisada_en := NULL; NEW.pago_monto := NULL;
  NEW.factura_rfc := NULL; NEW.factura_razon_social := NULL; NEW.factura_folio_fiscal := NULL;
  NEW.repuesta_en := NULL; NEW.repuesta_por := NULL;
  NEW.acta_nombre_archivo := apd.nombre_de_archivo('ACTA DE PERDIDA O ROBO', a.solicitante_id, NEW.acta_tipo_mime);
  RETURN NEW;
END $$;
CREATE TRIGGER reposicion_alta BEFORE INSERT ON apd.reposicion
  FOR EACH ROW EXECUTE FUNCTION apd.reposicion_alta();

CREATE FUNCTION apd.reposicion_cambio() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  tipo text := apd.contexto('usuario_tipo');
  acta_cambia boolean := (NEW.acta_archivo_clave, NEW.acta_nombre_original, NEW.acta_tipo_mime, NEW.acta_tamano_bytes, NEW.acta_sha256)
                         IS DISTINCT FROM (OLD.acta_archivo_clave, OLD.acta_nombre_original, OLD.acta_tipo_mime, OLD.acta_tamano_bytes, OLD.acta_sha256);
  c apd.cuota;
BEGIN
  IF (NEW.id, NEW.acreditacion_id, NEW.solicitada_en, NEW.es_ficticio) IS DISTINCT FROM (OLD.id, OLD.acreditacion_id, OLD.solicitada_en, OLD.es_ficticio)
     OR NEW.motivo IS DISTINCT FROM OLD.motivo AND NOT (OLD.estado = 'con_observaciones' AND NEW.estado = 'solicitada') THEN
    PERFORM apd.error('campo_inmutable', 'La acreditación, el motivo y la fecha de la reposición no se cambian');
  END IF;
  -- Lo pone la base
  NEW.estado_desde := OLD.estado_desde; NEW.revisada_por := OLD.revisada_por; NEW.revisada_en := OLD.revisada_en;
  NEW.pago_monto := OLD.pago_monto; NEW.repuesta_en := OLD.repuesta_en; NEW.repuesta_por := OLD.repuesta_por;
  NEW.acta_nombre_archivo := OLD.acta_nombre_archivo;
  -- Candado sobre la acreditación (decisión 4 del 19/10/2026): una cancelación al mismo tiempo espera a este cambio, o
  -- éste a ella, y la regla ve lo que hizo la otra (escenarios 5b y 5c de probar-concurrencia.sh)
  PERFORM 1 FROM apd.acreditacion WHERE id = NEW.acreditacion_id FOR UPDATE;
  IF NEW.estado <> OLD.estado AND NOT (OLD.estado, NEW.estado) IN (('solicitada', 'acta_aceptada'), ('solicitada', 'con_observaciones'), ('con_observaciones', 'solicitada'),
                                      ('acta_aceptada', 'repuesta'), ('solicitada', 'cancelada'), ('con_observaciones', 'cancelada'), ('acta_aceptada', 'cancelada')) THEN
    PERFORM apd.error('transicion_reposicion', format('Este cambio no está permitido: una reposición «%s» no puede pasar a «%s»',
      apd.nombre_estado(OLD.estado), apd.nombre_estado(NEW.estado)));
  END IF;
  -- El acta sólo cambia cuando la persona la corrige; la factura, sólo al entregar la credencial
  IF acta_cambia AND NOT (OLD.estado = 'con_observaciones' AND NEW.estado = 'solicitada') THEN
    PERFORM apd.error('acta_fuera_de_turno', 'El acta sólo se cambia cuando tiene observaciones por corregir');
  END IF;
  IF (NEW.factura_rfc, NEW.factura_razon_social, NEW.factura_folio_fiscal) IS DISTINCT FROM (OLD.factura_rfc, OLD.factura_razon_social, OLD.factura_folio_fiscal)
     AND NOT (OLD.estado = 'acta_aceptada' AND NEW.estado = 'repuesta') THEN
    PERFORM apd.error('factura_fuera_de_turno', 'Los datos de la factura se capturan al entregar la credencial repuesta');
  END IF;
  IF NEW.estado = OLD.estado THEN
    IF NEW.observacion IS DISTINCT FROM OLD.observacion THEN
      PERFORM apd.error('transicion_reposicion', 'La observación se escribe al revisar el acta');
    END IF;
    RETURN NEW;
  END IF;
  CASE NEW.estado
    WHEN 'acta_aceptada', 'con_observaciones' THEN
      IF tipo <> 'personal' OR apd.contexto('usuario') = '' THEN
        PERFORM apd.error('reposicion_de_personal', 'El acta la revisa el personal de la Secretaría');
      END IF;
      IF NOT apd.acreditacion_vigente(NEW.acreditacion_id) THEN
        PERFORM apd.error('reposicion_no_vigente', 'Sólo se repone la credencial de una acreditación vigente');
      END IF;
      IF NEW.estado = 'con_observaciones' AND length(trim(NEW.observacion)) < 10 THEN
        PERFORM apd.error('observaciones_vacias', 'Escriba qué debe corregir la persona en su acta (al menos 10 caracteres)');
      END IF;
      IF NEW.estado = 'acta_aceptada' THEN
        NEW.observacion := '';
        -- El monto que se le indica: el vigente hoy; un cambio posterior no lo altera
        SELECT * INTO c FROM apd.cuota WHERE clave = 'reposicion_credencial';
        NEW.pago_monto := CASE WHEN c.vigente_desde <= apd.hoy() THEN c.monto END;
      END IF;
      NEW.revisada_por := apd.contexto('usuario');
      NEW.revisada_en := apd.ahora();
    WHEN 'solicitada' THEN
      IF tipo <> 'solicitante' THEN
        PERFORM apd.error('reposicion_de_la_persona', 'El acta corregida la carga la persona titular desde «Mis trámites»');
      END IF;
      IF NOT acta_cambia OR NEW.acta_archivo_clave IS NOT DISTINCT FROM OLD.acta_archivo_clave THEN
        PERFORM apd.error('acta_sin_cambio', 'Carga el acta corregida');
      END IF;
      IF NEW.acta_tamano_bytes > apd.parametro_texto('tamano_maximo_archivo_bytes')::integer THEN
        PERFORM apd.error('archivo_grande', format('El acta pesa más de %s MB', apd.parametro_texto('tamano_maximo_archivo_bytes')::integer / 1048576));
      END IF;
      NEW.observacion := '';
      NEW.acta_nombre_archivo := apd.nombre_de_archivo('ACTA DE PERDIDA O ROBO', (SELECT solicitante_id FROM apd.acreditacion WHERE id = NEW.acreditacion_id), NEW.acta_tipo_mime);
    WHEN 'repuesta' THEN
      IF tipo <> 'personal' OR apd.contexto('usuario') = '' THEN
        PERFORM apd.error('reposicion_de_personal', 'La credencial repuesta la entrega el personal de la Secretaría');
      END IF;
      IF NOT apd.acreditacion_vigente(NEW.acreditacion_id) THEN
        PERFORM apd.error('reposicion_no_vigente', 'Sólo se repone la credencial de una acreditación vigente');
      END IF;
      NEW.factura_rfc := upper(trim(NEW.factura_rfc));
      NEW.factura_razon_social := trim(NEW.factura_razon_social);
      NEW.factura_folio_fiscal := upper(trim(NEW.factura_folio_fiscal));
      IF NEW.factura_rfc IS NULL OR NEW.factura_razon_social IS NULL OR NEW.factura_razon_social = '' OR NEW.factura_folio_fiscal IS NULL THEN
        PERFORM apd.error('sin_factura', 'Capture el RFC, el nombre o razón social y el folio fiscal de la factura de la cuota');
      END IF;
      -- Un folio fiscal no se repite, tampoco con el de una solicitud
      IF EXISTS (SELECT 1 FROM apd.solicitud WHERE factura_folio_fiscal = NEW.factura_folio_fiscal)
         OR EXISTS (SELECT 1 FROM apd.reposicion WHERE factura_folio_fiscal = NEW.factura_folio_fiscal AND id <> NEW.id) THEN
        PERFORM apd.error('folio_fiscal_repetido', 'Ese folio fiscal ya está registrado: revise la factura');
      END IF;
      NEW.repuesta_en := apd.hoy();
      NEW.repuesta_por := apd.contexto('usuario');
    WHEN 'cancelada' THEN
      IF length(trim(NEW.observacion)) = 0 THEN
        PERFORM apd.error('reposicion_sin_motivo', 'Diga por qué se cancela la reposición');
      END IF;
  END CASE;
  NEW.estado_desde := apd.ahora();
  RETURN NEW;
END $$;
CREATE TRIGGER reposicion_cambio BEFORE UPDATE ON apd.reposicion
  FOR EACH ROW EXECUTE FUNCTION apd.reposicion_cambio();

CREATE FUNCTION apd.reposicion_registrar() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE n text := (SELECT numero FROM apd.acreditacion WHERE id = NEW.acreditacion_id);
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM apd.registrar('reposicion', 'acreditacion', NEW.acreditacion_id::text,
      format('%s · reposición pedida por %s · acta %s (%s)', n, CASE NEW.motivo WHEN 'robo' THEN 'robo' ELSE 'pérdida' END, NEW.acta_archivo_clave, NEW.acta_sha256));
  ELSIF NEW.estado <> OLD.estado OR NEW.acta_archivo_clave <> OLD.acta_archivo_clave THEN
    PERFORM apd.registrar('reposicion', 'acreditacion', NEW.acreditacion_id::text,
      concat_ws(' · ', n, format('reposición %s → %s', OLD.estado, NEW.estado),
        CASE WHEN NEW.acta_archivo_clave <> OLD.acta_archivo_clave THEN format('acta %s (%s) en lugar de %s (%s)', NEW.acta_archivo_clave, NEW.acta_sha256, OLD.acta_archivo_clave, OLD.acta_sha256) END,
        nullif(NEW.observacion, ''),
        CASE WHEN NEW.estado = 'acta_aceptada' THEN format('cuota %s', coalesce(NEW.pago_monto::text, 'sin monto')) END,
        CASE WHEN NEW.estado = 'repuesta' THEN format('factura %s · %s · %s; credencial repuesta el %s, mismo número y vigencia', NEW.factura_rfc, NEW.factura_razon_social, NEW.factura_folio_fiscal, NEW.repuesta_en) END));
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER reposicion_registrar AFTER INSERT OR UPDATE ON apd.reposicion
  FOR EACH ROW EXECUTE FUNCTION apd.reposicion_registrar();

-- ───────────────────────────── Solicitudes ─────────────────────────────

-- SECURITY DEFINER (con search_path fijo): el folio sale de apd.siguiente_folio, que la cuenta del servicio no puede
-- llamar directo (decisión 6, 2026-10-19)
CREATE FUNCTION apd.solicitud_alta() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = apd, pg_temp AS $$
DECLARE
  anio smallint := extract(year FROM apd.hoy())::smallint;
  en_curso text;
BEGIN
  IF NEW.estado <> 'borrador' THEN
    PERFORM apd.error('alta_fuera_de_borrador', 'Una solicitud nace como borrador');
  END IF;
  PERFORM apd.comprobar_elegibilidad(NEW);
  -- Una sola solicitud activa por persona y tipo de acreditación, con su código y su mensaje (auditoría «intentar
  -- romperlo» 2026-10-18, bloque 2, F1 3: dos pestañas enviaban dos solicitudes de poda). El índice único
  -- solicitud_una_activa sigue como última defensa si dos altas llegan al mismo tiempo (23505); la API responde a los dos
  -- con este mismo mensaje. Va después de la elegibilidad: quien no puede tramitar esa acreditación lo sabe primero.
  SELECT s.folio INTO en_curso FROM apd.solicitud s
   WHERE s.solicitante_id = NEW.solicitante_id AND s.tipo_acreditacion = NEW.tipo_acreditacion
     AND s.estado NOT IN ('acreditada', 'no_acreditada', 'sin_derecho_examen', 'cancelada', 'concluida_sin_atender', 'rechazada')
   LIMIT 1;
  IF en_curso IS NOT NULL THEN
    PERFORM apd.error('solicitud_activa', format('Ya tienes un trámite en curso de esta acreditación (folio %s)', en_curso));
  END IF;
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
  -- Mayoría de edad para las dos acreditaciones (P138, sesión de trabajo del 23/10/2026): edad_minima años cumplidos el día
  -- de la solicitud, con la fecha de nacimiento de la CURP
  IF (apd.curp_nacimiento((SELECT curp FROM apd.solicitante WHERE id = s.solicitante_id))
        + make_interval(years => apd.parametro_texto('edad_minima')::integer))::date > hoy THEN
    PERFORM apd.error('menor_de_edad', format('Para solicitar una acreditación necesitas tener %s años cumplidos: según tu CURP, todavía no los tienes',
      apd.parametro_texto('edad_minima')));
  END IF;
  -- Dictaminador: poda vigente al iniciar la solicitud
  IF s.tipo_acreditacion = 'dictaminador' AND NOT apd.poda_vigente(s.solicitante_id, hoy) THEN
    PERFORM apd.error('sin_poda_vigente', 'Para tramitar la acreditación de dictaminador necesitas la de poda y derribo vigente');
  END IF;
  -- Dictaminador por primera vez: la acreditación de poda y derribo durante al menos anios_poda_dictaminador años
  -- consecutivos (sesión de trabajo del 23/10/2026; apd.poda_continua_desde). La renovación de dictaminador sigue pidiendo
  -- sólo la poda vigente.
  IF s.tipo_acreditacion = 'dictaminador' AND s.modalidad = 'nueva'
     AND apd.poda_continua_desde(s.solicitante_id, hoy) > (hoy - make_interval(years => apd.parametro_texto('anios_poda_dictaminador')::integer))::date THEN
    PERFORM apd.error('poda_menos_de_dos_anios', format(
      'Para la acreditación de dictaminador necesitas tener la de poda y derribo durante al menos %s años consecutivos: tienes la tuya sin interrupción desde el %s, así que podrás solicitarla a partir del %s',
      apd.parametro_texto('anios_poda_dictaminador'),
      to_char(apd.poda_continua_desde(s.solicitante_id, hoy), 'DD/MM/YYYY'),
      to_char((apd.poda_continua_desde(s.solicitante_id, hoy) + make_interval(years => apd.parametro_texto('anios_poda_dictaminador')::integer))::date, 'DD/MM/YYYY')));
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
    ELSIF estado_anterior = 'cancelada' THEN
      -- Una cancelada no se renueva (P120). Si puede volver a solicitarla como nueva y cuándo lo fija la Dirección Jurídica
      -- (lineamientos, Cap. X): mientras, una cancelada no impide una solicitud nueva
      PERFORM apd.error('renovacion_cancelada', 'Tu acreditación fue cancelada: no se puede renovar');
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
  -- Estudios: en los dos tipos, el nivel; con licenciatura o posgrado, la carrera; en dictaminador con licenciatura,
  -- además, su situación (con posgrado se asume titulada, 2026-10-18; en poda no se pregunta, sesión del 23/10/2026); con
  -- carrera técnica, cuál (decisión 2026-10-17)
  IF s.nivel_estudios IS NULL
     OR (s.nivel_estudios IN ('licenciatura', 'maestria', 'doctorado') AND coalesce(trim(s.carrera), '') = '')
     OR (s.tipo_acreditacion = 'dictaminador' AND s.nivel_estudios = 'licenciatura' AND s.estatus_estudios IS NULL)
     OR (s.nivel_estudios = 'tecnica' AND coalesce(trim(s.carrera_tecnica), '') = '') THEN
    PERFORM apd.error('faltan_estudios', CASE WHEN s.tipo_acreditacion = 'dictaminador'
      THEN 'Indica tu último nivel de estudios; si es licenciatura o posgrado, tu carrera (y, con licenciatura, su situación); si es carrera técnica, cuál'
      ELSE 'Indica tu último nivel de estudios; si es licenciatura o posgrado, tu carrera; si es carrera técnica, cuál' END);
  END IF;
  -- La experiencia se comprueba en la primera vez; la renovación no la vuelve a pedir (decisión 2026-10-18)
  IF s.tipo_acreditacion = 'dictaminador' AND s.modalidad = 'nueva' THEN
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
  -- Quien viene del registro anterior (Kobo), que no guardó archivos, en su primera renovación en el sistema carga todos
  -- los documentos, como una solicitud nueva (decisión 2026-10-18): los «si aplica» se vuelven obligatorios
  IF s.modalidad = 'renovacion'
     AND (SELECT origen FROM apd.acreditacion WHERE id = s.acreditacion_anterior_id) = 'kobo'
     AND NOT EXISTS (SELECT 1 FROM apd.documento d JOIN apd.solicitud o ON o.id = d.solicitud_id
                      WHERE o.solicitante_id = s.solicitante_id AND o.id <> s.id) THEN
    SELECT string_agg(r.nombre, ', ' ORDER BY rc.orden) INTO faltan
      FROM apd.requisito_curso rc JOIN apd.requisito r ON r.clave = rc.requisito
     WHERE rc.tipo_acreditacion = s.tipo_acreditacion AND rc.modalidad = s.modalidad
       AND r.forma = 'documento' AND r.momento = 'en_linea'
       AND NOT EXISTS (SELECT 1 FROM apd.documento d
                        WHERE d.solicitud_id = s.id AND d.requisito = rc.requisito AND d.vigente);
    IF faltan IS NOT NULL THEN
      PERFORM apd.error('faltan_documentos_kobo', 'Tu acreditación viene del registro anterior, que no guardó tus documentos: en esta primera renovación cárgalos todos. Faltan: ' || faltan);
    END IF;
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
    PERFORM apd.error('solicitud_cerrada', 'Los datos de la solicitud sólo se pueden cambiar mientras es borrador o cuando tiene observaciones por corregir');
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
    -- Un folio fiscal no se repite: con su mensaje, no sólo la restricción única (auditoría de tareas 2026-10-17)
    IF NEW.factura_folio_fiscal IS NOT NULL AND EXISTS (
         SELECT 1 FROM apd.solicitud WHERE factura_folio_fiscal = NEW.factura_folio_fiscal AND id <> NEW.id) THEN
      PERFORM apd.error('folio_fiscal_repetido', 'Ese folio fiscal ya está registrado en otra solicitud: revise la factura');
    END IF;
  END IF;
  NEW.enviada_en := OLD.enviada_en;
  NEW.lista_para_curso_en := OLD.lista_para_curso_en;
  NEW.estado_desde := OLD.estado_desde;
  -- La cita de cotejo la asigna el personal. Con la solicitud ya validada, sólo se cambia cuando la cita vigente
  -- se cerró sin cotejo: la persona no se presentó o no trajo el pago (decisiones 2026-10-17)
  IF NEW.cita_en IS DISTINCT FROM OLD.cita_en THEN
    IF apd.contexto('usuario_tipo') <> 'personal' THEN
      PERFORM apd.error('cita_de_personal', 'La cita de cotejo la asigna la Secretaría');
    END IF;
    IF OLD.estado = 'validada_en_linea' AND EXISTS (
         SELECT 1 FROM apd.cita c WHERE c.solicitud_id = NEW.id AND c.resultado IN ('pendiente', 'en_pausa')) THEN
      PERFORM apd.error('cita_abierta', 'Registre primero lo que pasó en la cita actual');
    END IF;
    -- La cita, dentro de los dias_habiles_cita días hábiles siguientes a la validación o al día en que se da la cita nueva:
    -- del siguiente día hábil al último del plazo (P205, decisión de Liber del 26/10/2026; sustituye al límite de 6 meses,
    -- meses_adelanto_cita, que venía de la auditoría «intentar romperlo» 2026-10-18, F2 M4: se aceptaba el 31/12/9999).
    IF NEW.cita_en IS NOT NULL AND ((NEW.cita_en AT TIME ZONE 'America/Mexico_City')::date <= apd.hoy()
         OR (NEW.cita_en AT TIME ZONE 'America/Mexico_City')::date > apd.suma_dias_habiles(apd.hoy(), apd.parametro_texto('dias_habiles_cita')::integer)) THEN
      PERFORM apd.error('cita_fuera_de_plazo', format('La cita de cotejo se da dentro de los %s días hábiles siguientes: del %s al %s',
        apd.parametro_texto('dias_habiles_cita'), to_char(apd.suma_dias_habiles(apd.hoy(), 1), 'DD/MM/YYYY'),
        to_char(apd.suma_dias_habiles(apd.hoy(), apd.parametro_texto('dias_habiles_cita')::integer), 'DD/MM/YYYY')));
    END IF;
    -- Las citas de cotejo son de lunes a viernes, de cita_hora_desde a cita_hora_hasta (sesión de trabajo del 23/10/2026:
    -- 9:30 a 14:30, P69; sábados y domingos inhábiles, P150)
    IF NEW.cita_en IS NOT NULL AND NOT apd.es_habil((NEW.cita_en AT TIME ZONE 'America/Mexico_City')::date) THEN
      PERFORM apd.error('cita_en_fin_de_semana', 'Las citas de cotejo son de lunes a viernes: elija otro día');
    END IF;
    IF NEW.cita_en IS NOT NULL AND ((NEW.cita_en AT TIME ZONE 'America/Mexico_City')::time < apd.parametro_texto('cita_hora_desde')::time
         OR (NEW.cita_en AT TIME ZONE 'America/Mexico_City')::time > apd.parametro_texto('cita_hora_hasta')::time) THEN
      PERFORM apd.error('cita_fuera_de_horario', format('Las citas de cotejo son de %s a %s', apd.parametro_texto('cita_hora_desde'), apd.parametro_texto('cita_hora_hasta')));
    END IF;
  END IF;

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
    PERFORM apd.error('transicion_invalida', format('Este cambio no está permitido: una solicitud «%s» no puede pasar a «%s»', apd.nombre_estado(OLD.estado), apd.nombre_estado(NEW.estado)));
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
      -- La solicitud se va con la adscripción que la persona tiene hoy en «Mi perfil»
      SELECT p.adscripcion, p.organizacion_id INTO NEW.adscripcion, NEW.organizacion_id
        FROM apd.solicitante p WHERE p.id = NEW.solicitante_id;
      IF NEW.adscripcion IS NULL THEN
        PERFORM apd.error('sin_adscripcion', 'Indica en «Mi perfil» si trabajas para alguna empresa, institución o dependencia');
      END IF;
      IF NEW.enviada_en IS NULL THEN NEW.enviada_en := apd.ahora(); END IF;
    WHEN 'con_observaciones' THEN
      IF OLD.estado = 'enviada' AND ultima IS DISTINCT FROM 'con_observaciones' THEN
        PERFORM apd.error('sin_revision', 'Para enviar observaciones, registre la revisión de la solicitud');
      END IF;
      -- Máximo de oportunidades para corregir (ajustes del equipo, 25/10/2026): si la revisión de la última corrección
      -- vuelve a tener observaciones, la solicitud ya no regresa a la persona: se cierra como concluida sin atender, con
      -- su motivo, y la persona puede iniciar otra de inmediato. Lo hace la base, no quien revisa: así no hay una tercera
      -- vuelta aunque alguien escriba sin pasar por la aplicación. El cotejo con observaciones no cuenta (no es una
      -- revisión: apd.correcciones_usadas).
      IF OLD.estado = 'enviada' AND apd.oportunidades_agotadas(NEW.id) THEN
        NEW.estado := 'concluida_sin_atender';
        NEW.motivo_cierre := 'Se agotaron las oportunidades de corrección';
      END IF;
      IF OLD.estado = 'validada_en_linea' AND apd.contexto('motivo') = '' THEN
        PERFORM apd.error('cotejo_sin_motivo', 'Indique qué no coincidió en el cotejo');
      END IF;
    WHEN 'validada_en_linea' THEN
      IF ultima IS DISTINCT FROM 'validada' THEN
        PERFORM apd.error('sin_revision', 'Para validar la solicitud, registre su revisión');
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
        PERFORM apd.error('sigue_inscrita', 'La solicitud vuelve a la espera de grupo sólo si se da de baja del grupo');
      END IF;
      -- Sin factura no hay bandeja, y sin bandeja no hay grupo ni fecha de curso
      IF OLD.estado = 'validada_en_linea' AND EXISTS (
           SELECT 1 FROM apd.requisito_curso rc JOIN apd.requisito r ON r.clave = rc.requisito
            WHERE rc.tipo_acreditacion = NEW.tipo_acreditacion AND rc.modalidad = NEW.modalidad
              AND rc.obligatorio AND r.forma = 'documento' AND r.momento = 'cotejo'
              AND NOT EXISTS (SELECT 1 FROM apd.documento d
                               WHERE d.solicitud_id = NEW.id AND d.requisito = rc.requisito AND d.vigente)) THEN
        PERFORM apd.error('sin_factura', 'Cargue la factura del pago de derechos para concluir el cotejo');
      END IF;
      IF OLD.estado = 'validada_en_linea' AND (coalesce(NEW.factura_rfc, '') = '' OR coalesce(trim(NEW.factura_razon_social), '') = ''
                                              OR coalesce(NEW.factura_folio_fiscal, '') = '') THEN
        PERFORM apd.error('sin_datos_factura', 'Capture el RFC, el nombre o razón social y el folio fiscal de la factura');
      END IF;
      -- En el cotejo el personal confirma que la fotografía es de quien se presentó (en la cita no se toma otra)
      IF OLD.estado = 'validada_en_linea' AND NOT EXISTS (
           SELECT 1 FROM apd.fotografia f WHERE f.solicitante_id = NEW.solicitante_id AND f.vigente AND f.estado = 'confirmada') THEN
        PERFORM apd.error('foto_sin_confirmar', 'Confirme que la fotografía de la cuenta corresponde a la persona para concluir el cotejo');
      END IF;
      -- Todos los documentos en línea coincidieron con los que trajo la persona, y la cita quedó atendida
      IF OLD.estado = 'validada_en_linea' AND EXISTS (
           SELECT 1 FROM apd.documento d WHERE d.solicitud_id = NEW.id AND d.vigente AND d.estado <> 'aceptado') THEN
        PERFORM apd.error('documentos_sin_cotejar', 'Todos los documentos deben coincidir con los que trae la persona');
      END IF;
      IF OLD.estado = 'validada_en_linea' AND NOT EXISTS (
           SELECT 1 FROM apd.cita c WHERE c.solicitud_id = NEW.id AND c.resultado = 'atendida' AND c.atendida_en >= OLD.estado_desde) THEN
        PERFORM apd.error('cotejo_sin_cita', 'Registre la cita de cotejo como atendida para concluir el cotejo');
      END IF;
      -- El expediente físico es de la persona: se abre en su primer cotejo y lo usan todos sus trámites (lo abre
      -- apd.solicitud_expediente, después de este disparador)
      -- La espera empieza la primera vez; si regresa de un grupo, conserva su antigüedad
      IF NEW.lista_para_curso_en IS NULL THEN NEW.lista_para_curso_en := apd.ahora(); END IF;
    WHEN 'inscrita' THEN
      IF ins.id IS NULL THEN
        PERFORM apd.error('sin_inscripcion', 'La solicitud queda con grupo asignado sólo al agregarla a un grupo');
      END IF;
    WHEN 'aprobada', 'no_acreditada' THEN
      SELECT e.calificacion INTO cal FROM apd.examen e WHERE e.inscripcion_id = ins.id;
      IF cal IS NULL THEN
        PERFORM apd.error('sin_examen', 'El resultado se registra a partir de la calificación del examen');
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
        PERFORM apd.error('sin_acreditacion', 'La solicitud queda como acreditada sólo al emitir la acreditación');
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
DECLARE estudios text[] := ARRAY[]::text[];
BEGIN
  -- La cita que asigna o cambia el personal, y lo que la persona corrige de sus estudios después de enviar (E2-04,
  -- auditoría 2026-10-19): sin esto no se reconstruye quién movió la cita ni qué cambió entre dos envíos
  IF NEW.cita_en IS DISTINCT FROM OLD.cita_en THEN
    PERFORM apd.registrar('cita_asignada', 'solicitud', NEW.id::text,
      format('%s → %s', coalesce(to_char(OLD.cita_en AT TIME ZONE 'America/Mexico_City', 'DD/MM/YYYY HH24:MI'), 'sin cita'),
                        coalesce(to_char(NEW.cita_en AT TIME ZONE 'America/Mexico_City', 'DD/MM/YYYY HH24:MI'), 'sin cita')));
  END IF;
  IF OLD.estado <> 'borrador' THEN
    IF NEW.nivel_estudios IS DISTINCT FROM OLD.nivel_estudios THEN
      estudios := estudios || format('nivel %s → %s', coalesce(OLD.nivel_estudios, '—'), coalesce(NEW.nivel_estudios, '—')); END IF;
    IF NEW.carrera IS DISTINCT FROM OLD.carrera THEN
      estudios := estudios || format('carrera %s → %s', coalesce(OLD.carrera, '—'), coalesce(NEW.carrera, '—')); END IF;
    IF NEW.carrera_tecnica IS DISTINCT FROM OLD.carrera_tecnica THEN
      estudios := estudios || format('carrera técnica %s → %s', coalesce(OLD.carrera_tecnica, '—'), coalesce(NEW.carrera_tecnica, '—')); END IF;
    IF NEW.estatus_estudios IS DISTINCT FROM OLD.estatus_estudios THEN
      estudios := estudios || format('situación %s → %s', coalesce(OLD.estatus_estudios, '—'), coalesce(NEW.estatus_estudios, '—')); END IF;
    IF NEW.anios_experiencia IS DISTINCT FROM OLD.anios_experiencia THEN
      estudios := estudios || format('experiencia %s → %s', coalesce(OLD.anios_experiencia::text, '—'), coalesce(NEW.anios_experiencia::text, '—')); END IF;
    IF cardinality(estudios) > 0 THEN
      PERFORM apd.registrar('estudios', 'solicitud', NEW.id::text, array_to_string(estudios, '; '));
    END IF;
  END IF;
  IF NEW.estado <> OLD.estado THEN
    PERFORM apd.registrar('estado', 'solicitud', NEW.id::text,
      concat_ws(' · ', format('%s → %s', OLD.estado, NEW.estado), nullif(NEW.motivo_cierre, ''), nullif(apd.contexto('motivo'), '')));
    IF NEW.estado IN ('cancelada') THEN
      -- Al cancelar estando en un grupo, la persona sale del grupo
      UPDATE apd.inscripcion SET activa = false, motivo_baja = 'Solicitud cancelada: ' || NEW.motivo_cierre
       WHERE solicitud_id = NEW.id AND activa;
      -- …y su cita de cotejo abierta (por atender o en pausa) se cierra como «cancelada», con el motivo (decisión 8,
      -- 2026-10-19; hallazgo A2-01): no queda abierta para siempre ni cuenta en la agenda ni en el cupo por horario
      UPDATE apd.cita SET resultado = 'cancelada', observacion = 'Solicitud cancelada: ' || NEW.motivo_cierre
       WHERE solicitud_id = NEW.id AND resultado IN ('pendiente', 'en_pausa');
    END IF;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER solicitud_cambio_registrar AFTER UPDATE ON apd.solicitud
  FOR EACH ROW EXECUTE FUNCTION apd.solicitud_cambio_registrar();

-- El expediente físico es de la persona: se abre al concluir su primer cotejo (validada → lista para curso) y lo usan
-- todos sus trámites. SECURITY DEFINER (con search_path fijo): apd.asignar_expediente no la puede llamar directo la
-- cuenta del servicio (decisión 6, 2026-10-19); se abre sólo por esta regla.
CREATE FUNCTION apd.solicitud_expediente() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = apd, pg_temp AS $$
BEGIN
  IF OLD.estado = 'validada_en_linea' AND NEW.estado = 'lista_para_curso' THEN
    PERFORM apd.asignar_expediente(NEW.solicitante_id);
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER solicitud_expediente AFTER UPDATE ON apd.solicitud
  FOR EACH ROW EXECUTE FUNCTION apd.solicitud_expediente();

-- ───────────────────────────── Citas de cotejo ─────────────────────────────
-- Decisiones 2026-10-17 (Liber). Cada cita queda registrada con lo que pasó en ella:
--   · no se presentó: se le da una cita nueva, una sola vez; a la segunda inasistencia
--     (parámetro inasistencias_cotejo_maximas) la solicitud se cierra como «concluida sin atender»;
--   · sin pago: no se concluye el cotejo; se le da otra cita y conserva el monto que se le indicó;
--   · en pausa: un documento no coincidió y la persona consigue el correcto ese mismo día; lo carga en
--     línea y el personal retoma el cotejo. La pausa sólo dura ese día;
--   · con observaciones: un documento no coincidió y no lo trae ese día: regresa a la persona;
--   · no era la persona: no se atiende, se avisa a la Dirección y la cuenta queda bloqueada;
--   · atendida: todo coincidió y el pago está verificado; la solicitud pasa a la bandeja de grupos.

-- Al validar la solicitud, o al cambiar su cita, nace la cita pendiente
CREATE FUNCTION apd.solicitud_cita() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.estado = 'validada_en_linea' AND NEW.cita_en IS NOT NULL
     AND (OLD.estado <> 'validada_en_linea' OR NEW.cita_en IS DISTINCT FROM OLD.cita_en) THEN
    INSERT INTO apd.cita (solicitud_id, programada_en) VALUES (NEW.id, NEW.cita_en);
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER solicitud_cita AFTER UPDATE ON apd.solicitud
  FOR EACH ROW EXECUTE FUNCTION apd.solicitud_cita();

CREATE FUNCTION apd.cita_alta() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s apd.solicitud;
BEGIN
  SELECT * INTO s FROM apd.solicitud WHERE id = NEW.solicitud_id;
  IF s.estado <> 'validada_en_linea' OR s.cita_en IS DISTINCT FROM NEW.programada_en THEN
    PERFORM apd.error('cita_fuera_de_turno', 'Una cita de cotejo sólo se crea al asignarla a una solicitud con sus documentos validados');
  END IF;
  NEW.resultado := 'pendiente';
  NEW.observacion := '';
  NEW.pausada_en := NULL;
  NEW.atendida_por := NULL;
  NEW.atendida_en := NULL;
  NEW.creada_en := apd.ahora();
  RETURN NEW;
END $$;
CREATE TRIGGER cita_alta BEFORE INSERT ON apd.cita
  FOR EACH ROW EXECUTE FUNCTION apd.cita_alta();

CREATE FUNCTION apd.cita_cambio() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  dia_pausa date;
BEGIN
  IF (NEW.solicitud_id, NEW.programada_en, NEW.creada_en) IS DISTINCT FROM (OLD.solicitud_id, OLD.programada_en, OLD.creada_en) THEN
    PERFORM apd.error('campo_inmutable', 'La solicitud y la fecha de una cita no cambian: se asigna una cita nueva');
  END IF;
  -- «Cancelada» no lo registra nadie: lo pone la base cuando la solicitud se cancela con la cita abierta (decisión 8,
  -- 2026-10-19), la cancele la persona o el personal
  IF NEW.resultado = 'cancelada' AND OLD.resultado IS DISTINCT FROM 'cancelada' THEN
    IF OLD.resultado NOT IN ('pendiente', 'en_pausa') THEN
      PERFORM apd.error('cita_cerrada', 'Esta cita ya se cerró');
    END IF;
    IF (SELECT estado FROM apd.solicitud WHERE id = NEW.solicitud_id) <> 'cancelada' THEN
      PERFORM apd.error('cita_sin_cancelacion', 'Una cita queda como cancelada sólo al cancelar su solicitud');
    END IF;
    NEW.pausada_en := OLD.pausada_en;
    NEW.atendida_por := apd.contexto('usuario');
    NEW.atendida_en := apd.ahora();
    RETURN NEW;
  END IF;
  IF apd.contexto('usuario_tipo') <> 'personal' THEN
    PERFORM apd.error('cita_de_personal', 'Lo que pasó en la cita lo registra la Secretaría');
  END IF;
  IF OLD.resultado NOT IN ('pendiente', 'en_pausa') THEN
    PERFORM apd.error('cita_cerrada', 'Esta cita ya se cerró');
  END IF;
  IF NEW.resultado = OLD.resultado THEN
    NEW.pausada_en := OLD.pausada_en;
    NEW.atendida_por := OLD.atendida_por;
    NEW.atendida_en := OLD.atendida_en;
    RETURN NEW;
  END IF;
  -- Lo que pasó en una cita se registra su día, no antes: ni la inasistencia ni el cotejo de una cita que todavía no
  -- llega (auditoría «intentar romperlo» 2026-10-18, F2 A6: se cerraba una solicitud por no presentarse a una cita futura)
  IF (OLD.programada_en AT TIME ZONE 'America/Mexico_City')::date > apd.hoy() THEN
    PERFORM apd.error('cita_futura', format('La cita es el %s: lo que pasó en ella se registra ese día',
      to_char((OLD.programada_en AT TIME ZONE 'America/Mexico_City')::date, 'DD/MM/YYYY')));
  END IF;
  IF NEW.resultado = 'pendiente'
     OR (OLD.resultado = 'en_pausa' AND NEW.resultado IN ('no_se_presento', 'no_es_la_persona')) THEN
    PERFORM apd.error('cita_transicion', format('Este cambio no está permitido: una cita «%s» no puede pasar a «%s»', apd.nombre_estado(OLD.resultado), apd.nombre_estado(NEW.resultado)));
  END IF;
  -- Lo que no coincidió queda marcado en el documento (la persona lo ve) antes de pausar o regresar
  IF NEW.resultado IN ('en_pausa', 'con_observaciones') AND NOT EXISTS (
       SELECT 1 FROM apd.documento d WHERE d.solicitud_id = NEW.solicitud_id AND d.vigente AND d.estado = 'con_observacion') THEN
    PERFORM apd.error('cotejo_sin_documento', 'Marque qué documento no coincide y qué no coincide');
  END IF;
  IF NEW.resultado = 'en_pausa' THEN
    NEW.pausada_en := apd.ahora();
    RETURN NEW;
  END IF;
  -- La pausa sólo dura el día de la cita: al día siguiente sólo se regresa con observaciones
  IF OLD.resultado = 'en_pausa' AND NEW.resultado <> 'con_observaciones' THEN
    dia_pausa := (OLD.pausada_en AT TIME ZONE 'America/Mexico_City')::date;
    IF (apd.ahora() AT TIME ZONE 'America/Mexico_City')::date <> dia_pausa THEN
      PERFORM apd.error('pausa_vencida', 'La pausa sólo dura el día de la cita: regrese la solicitud con observaciones');
    END IF;
  END IF;
  NEW.pausada_en := OLD.pausada_en;
  NEW.atendida_por := apd.contexto('usuario');
  NEW.atendida_en := apd.ahora();
  RETURN NEW;
END $$;
CREATE TRIGGER cita_cambio BEFORE UPDATE ON apd.cita
  FOR EACH ROW EXECUTE FUNCTION apd.cita_cambio();

-- Lo que la cita mueve: la solicitud (con observaciones o cerrada) o la cuenta (bloqueada)
CREATE FUNCTION apd.cita_aplicar() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  inasistencias integer;
BEGIN
  IF NEW.resultado = OLD.resultado THEN RETURN NULL; END IF;
  PERFORM apd.registrar('cita', 'solicitud', NEW.solicitud_id::text,
    concat_ws(' · ', format('%s → %s', OLD.resultado, NEW.resultado), nullif(NEW.observacion, '')));
  CASE NEW.resultado
    WHEN 'con_observaciones' THEN
      PERFORM set_config('apd.motivo', 'Cotejo: ' || NEW.observacion, true);
      UPDATE apd.solicitud SET estado = 'con_observaciones' WHERE id = NEW.solicitud_id;
    WHEN 'no_se_presento' THEN
      SELECT count(*) INTO inasistencias FROM apd.cita WHERE solicitud_id = NEW.solicitud_id AND resultado = 'no_se_presento';
      IF inasistencias >= apd.parametro_texto('inasistencias_cotejo_maximas')::integer THEN
        UPDATE apd.solicitud SET estado = 'concluida_sin_atender',
               motivo_cierre = format('No se presentó a su cita de cotejo %s veces.', inasistencias)
         WHERE id = NEW.solicitud_id;
      END IF;
    WHEN 'no_es_la_persona' THEN
      UPDATE apd.solicitante SET estado = 'bloqueada', bloqueo_motivo = 'identidad'
       WHERE id = (SELECT solicitante_id FROM apd.solicitud WHERE id = NEW.solicitud_id);
    ELSE
      NULL;
  END CASE;
  RETURN NULL;
END $$;
CREATE TRIGGER cita_aplicar AFTER UPDATE ON apd.cita
  FOR EACH ROW EXECUTE FUNCTION apd.cita_aplicar();

-- Una pausa que no se retomó el día de la cita regresa la solicitud con observaciones. La corre una tarea
-- programada cada noche [pendiente: quién la programa en el SIA]; devuelve cuántas cerró.
CREATE FUNCTION apd.cerrar_pausas_vencidas() RETURNS integer LANGUAGE plpgsql AS $$
DECLARE
  c record;
  n integer := 0;
BEGIN
  FOR c IN SELECT id FROM apd.cita
            WHERE resultado = 'en_pausa'
              AND (pausada_en AT TIME ZONE 'America/Mexico_City')::date < (apd.ahora() AT TIME ZONE 'America/Mexico_City')::date LOOP
    UPDATE apd.cita SET resultado = 'con_observaciones' WHERE id = c.id;
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

-- ───────────────────────────── Revisión y documentos ─────────────────────────────

-- Dos personas del personal que deciden a la vez la misma solicitud (E2-01, RI-03 y RI-06, auditoría 2026-10-19; decisión 4):
-- la revisión y la decisión sobre un documento bloquean la solicitud (FOR UPDATE) antes de mirar su estado, así que la
-- segunda espera a la primera y ve lo que hizo. Si la solicitud ya no está en su turno porque otra persona registró la
-- revisión de esta vuelta (desde que llegó a su estado actual), el error lo dice con su propio código.
CREATE FUNCTION apd.fuera_de_turno(s apd.solicitud, mensaje text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM apd.revision r WHERE r.solicitud_id = s.id AND r.revisada_en >= s.estado_desde) THEN
    PERFORM apd.error('revision_ya_registrada',
      format('Otra persona del personal ya registró la revisión de esta solicitud («%s»): recargue para ver lo que decidió',
             apd.nombre_estado(s.estado)));
  END IF;
  PERFORM apd.error('revision_fuera_de_turno', mensaje);
END $$;

CREATE FUNCTION apd.revision_alta() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s apd.solicitud;
BEGIN
  SELECT * INTO s FROM apd.solicitud WHERE id = NEW.solicitud_id FOR UPDATE;
  IF s.estado <> 'enviada' THEN
    PERFORM apd.fuera_de_turno(s, 'Sólo se revisa una solicitud enviada');
  END IF;
  IF NEW.resultado = 'con_observaciones' AND trim(NEW.observacion_general) = ''
     AND NOT EXISTS (SELECT 1 FROM apd.documento d WHERE d.solicitud_id = NEW.solicitud_id AND d.vigente AND d.estado = 'con_observacion') THEN
    PERFORM apd.error('observaciones_vacias', 'Indique qué debe corregir la persona');
  END IF;
  IF NEW.resultado = 'rechazada' AND trim(NEW.observacion_general) = '' THEN
    PERFORM apd.error('rechazo_sin_motivo', 'Escriba el motivo del rechazo: la persona lo leerá');
  END IF;
  NEW.revisada_en := apd.ahora();
  RETURN NEW;
END $$;
CREATE TRIGGER revision_alta BEFORE INSERT ON apd.revision
  FOR EACH ROW EXECUTE FUNCTION apd.revision_alta();

-- Máximo de oportunidades para corregir (ajustes del equipo, 25/10/2026): cada revisión en línea con observaciones da una
-- oportunidad para corregir. Si la revisión de la última corrección vuelve a tener observaciones, la solicitud se cierra
-- como concluida sin atender, con su motivo; la persona puede iniciar otra de inmediato (no ha pagado). Que el cotejo regrese
-- la solicitud con observaciones (un documento que no coincide) no cuenta: queda en apd.cita, no en apd.revision.
CREATE FUNCTION apd.correcciones_usadas(p_solicitud uuid) RETURNS integer LANGUAGE sql STABLE AS $$
  SELECT count(*)::integer FROM apd.revision r WHERE r.solicitud_id = p_solicitud AND r.resultado = 'con_observaciones'
$$;
COMMENT ON FUNCTION apd.correcciones_usadas(uuid) IS 'Revisiones en línea con observaciones de una solicitud: las oportunidades para corregir que ya recibió (parámetro oportunidades_correccion). El cotejo con observaciones no cuenta.';
CREATE FUNCTION apd.oportunidades_agotadas(p_solicitud uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT apd.correcciones_usadas(p_solicitud) > apd.parametro_texto('oportunidades_correccion')::integer
$$;
COMMENT ON FUNCTION apd.oportunidades_agotadas(uuid) IS 'Las observaciones de la revisión en línea pasan de oportunidades_correccion: la solicitud se cierra en lugar de regresar a la persona.';

-- La revisión mueve la solicitud: así no queda una revisión sin efecto ni un estado sin revisión. Con observaciones después
-- de la última oportunidad para corregir, apd.solicitud_cambio la cierra en lugar de regresarla (25/10/2026); esta revisión
-- ya cuenta (disparador AFTER INSERT).
CREATE FUNCTION apd.revision_aplicar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE apd.solicitud
     SET estado = CASE NEW.resultado WHEN 'validada' THEN 'validada_en_linea' WHEN 'rechazada' THEN 'rechazada'
                                     ELSE 'con_observaciones' END,
         motivo_cierre = CASE NEW.resultado WHEN 'rechazada' THEN NEW.observacion_general ELSE motivo_cierre END
   WHERE id = NEW.solicitud_id AND estado = 'enviada';
  -- Con la solicitud bloqueada en revision_alta no debería pasar; si pasa, la revisión no queda sin efecto
  IF NOT FOUND THEN
    PERFORM apd.error('revision_ya_registrada', 'Otra persona del personal ya registró la revisión de esta solicitud: recargue para ver lo que decidió');
  END IF;
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
  -- …o, con la cita de cotejo en pausa, el documento que no coincidió (decisión 2026-10-17)
  IF momento = 'en_linea' AND s.estado NOT IN ('borrador', 'con_observaciones')
     AND NOT (s.estado = 'validada_en_linea'
              AND EXISTS (SELECT 1 FROM apd.cita c WHERE c.solicitud_id = s.id AND c.resultado = 'en_pausa')
              AND EXISTS (SELECT 1 FROM apd.documento d WHERE d.solicitud_id = s.id AND d.requisito = NEW.requisito
                            AND d.vigente AND d.estado = 'con_observacion')) THEN
    PERFORM apd.error('carga_fuera_de_turno', 'Sólo se cargan documentos en borrador, para atender observaciones o el que no coincidió en tu cita');
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
DECLARE s apd.solicitud;
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
  IF (NEW.estado, NEW.observacion, NEW.revisado_por) IS DISTINCT FROM (OLD.estado, OLD.observacion, OLD.revisado_por) THEN
    IF NOT OLD.vigente THEN
      PERFORM apd.error('documento_sustituido', 'Sólo se revisa la carga vigente');
    END IF;
    -- La solicitud se bloquea mientras se decide el documento (decisión 4, 2026-10-19): una revisión simultánea espera
    SELECT * INTO s FROM apd.solicitud WHERE id = NEW.solicitud_id FOR UPDATE;
    -- En revisión documental, o en el cotejo con la cita abierta: lo que coincide o no con lo que trae la persona
    IF s.estado <> 'enviada'
       AND NOT (s.estado = 'validada_en_linea'
                AND EXISTS (SELECT 1 FROM apd.cita c WHERE c.solicitud_id = NEW.solicitud_id AND c.resultado IN ('pendiente', 'en_pausa'))) THEN
      PERFORM apd.fuera_de_turno(s, 'Sólo se revisan documentos de una solicitud enviada o en su cita de cotejo');
    END IF;
    IF coalesce(NEW.revisado_por, '') = '' THEN
      PERFORM apd.error('revision_sin_responsable', 'La revisión de un documento registra quién la hizo');
    END IF;
    NEW.revisado_en := apd.ahora();
    -- Cada decisión sobre un documento queda en la bitácora, con lo que había antes (E2-04): revisado_por se sobrescribe
    IF (NEW.estado, NEW.observacion) IS DISTINCT FROM (OLD.estado, OLD.observacion) THEN
      PERFORM apd.registrar('documento', 'solicitud', NEW.solicitud_id::text,
        concat_ws(' · ', format('%s: %s → %s', NEW.requisito, OLD.estado, NEW.estado), nullif(NEW.observacion, ''),
                  CASE WHEN OLD.revisado_por IS NOT NULL THEN 'antes lo decidió ' || OLD.revisado_por END));
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER documento_cambio BEFORE UPDATE ON apd.documento
  FOR EACH ROW EXECUTE FUNCTION apd.documento_cambio();

-- ───────────────────────────── Grupos ─────────────────────────────
-- Decisiones de cursos y grupos (2026-10-14): cupo 5–25 copiado al crear; ningún grupo abre con menos
-- del mínimo; grupos específicos (una organización) o combinados; los cuatro cursos no se mezclan.

-- El primer día de un curso es, a lo más, dentro de un año (decisión 3, 2026-10-19): una fecha pegada como AAAA-MM-DD que
-- la pantalla entiende como el año 6110, o un 2099 escrito de más, no confirma un grupo que no puede empezar (RI-04)
CREATE FUNCTION apd.comprobar_inicio_grupo(p_inicio date) RETURNS void LANGUAGE plpgsql AS $$
DECLARE tope date := (apd.hoy() + interval '12 months')::date;  -- el mismo cálculo que la pantalla, ese día incluido
BEGIN
  IF p_inicio > tope THEN
    PERFORM apd.error('inicio_muy_lejano', format('El primer día del curso puede ser, a lo más, dentro de 12 meses: a más tardar el %s',
      to_char(tope, 'DD/MM/YYYY')));
  END IF;
END $$;

-- Días hábiles (sesión de trabajo del 23/10/2026, P150 y P151): sábados y domingos no se trabaja ni hay cursos. El
-- calendario oficial de días festivos (P150) todavía no existe: cuando la Secretaría lo publique, se agrega aquí.
CREATE FUNCTION apd.es_habil(p_dia date) RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT extract(isodow FROM p_dia) < 6
$$;
COMMENT ON FUNCTION apd.es_habil(date) IS 'De lunes a viernes (sábados y domingos inhábiles, P150); sin calendario de festivos todavía.';
-- Plazos en días hábiles: el día que resulta de sumar n días hábiles a una fecha (sin contar sábados ni domingos), y
-- cuántos días hábiles hay después de una fecha hasta otra, ésta incluida
CREATE FUNCTION apd.suma_dias_habiles(p_desde date, p_dias integer) RETURNS date LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE AS $$
DECLARE d date := p_desde; n integer := 0;
BEGIN
  WHILE n < p_dias LOOP
    d := d + 1;
    IF apd.es_habil(d) THEN n := n + 1; END IF;
  END LOOP;
  RETURN d;
END $$;
CREATE FUNCTION apd.dias_habiles_entre(p_desde date, p_hasta date) RETURNS integer LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT count(*)::integer FROM generate_series(p_desde + 1, p_hasta, interval '1 day') g WHERE apd.es_habil(g::date)
$$;
COMMENT ON FUNCTION apd.suma_dias_habiles(date, integer) IS 'Fecha que resulta de sumar n días hábiles (lunes a viernes) a otra.';
COMMENT ON FUNCTION apd.dias_habiles_entre(date, date) IS 'Días hábiles (lunes a viernes) después de la primera fecha y hasta la segunda, inclusive.';

-- Las fechas de un grupo (sesión de trabajo del 23/10/2026): ningún día del curso cae en sábado ni domingo (el de 5 días
-- va de lunes a viernes, P151); como máximo grupos_simultaneos_maximo grupos al mismo tiempo, de cualquier curso, contando
-- los que tienen fecha y siguen activos (en integración con fecha propuesta, confirmados y en curso; P149); y la hora de
-- entrada dentro del horario del curso (curso_hora_entrada a curso_hora_salida, P91). Un candado de la transacción hace
-- que dos personas que programan a la vez no dejen tres grupos en las mismas fechas.
CREATE FUNCTION apd.comprobar_fechas_grupo(g apd.grupo) RETURNS void LANGUAGE plpgsql AS $$
DECLARE
  duracion smallint;
  fin date;
  maximo integer := apd.parametro_texto('grupos_simultaneos_maximo')::integer;
  ocupados integer;
  dia date;
  otros text;
BEGIN
  IF g.fecha_inicio IS NULL THEN RETURN; END IF;
  SELECT c.dias_duracion INTO duracion FROM apd.curso c WHERE c.tipo_acreditacion = g.tipo_acreditacion AND c.modalidad = g.modalidad;
  fin := g.fecha_inicio + duracion - 1;
  SELECT min(d::date) INTO dia FROM generate_series(g.fecha_inicio, fin, interval '1 day') d WHERE NOT apd.es_habil(d::date);
  IF dia IS NOT NULL THEN
    PERFORM apd.error('curso_en_fin_de_semana', CASE WHEN duracion > 1
      THEN format('El curso de %s días va de lunes a viernes: el primer día debe ser un lunes (el %s cae en %s)', duracion,
                  to_char(dia, 'DD/MM/YYYY'), CASE extract(isodow FROM dia) WHEN 6 THEN 'sábado' ELSE 'domingo' END)
      ELSE format('No hay cursos en sábado ni domingo: el %s no se puede', to_char(dia, 'DD/MM/YYYY')) END);
  END IF;
  IF g.hora_entrada IS NOT NULL AND (g.hora_entrada < apd.parametro_texto('curso_hora_entrada')::time
       OR g.hora_entrada >= apd.parametro_texto('curso_hora_salida')::time) THEN
    PERFORM apd.error('hora_fuera_de_horario', format('El curso es de %s a %s: la hora de entrada va en ese horario',
      apd.parametro_texto('curso_hora_entrada'), apd.parametro_texto('curso_hora_salida')));
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('apd.grupo.fechas'));
  -- El día más ocupado del curso: cuántos otros grupos activos tienen clase ese día
  SELECT max(n) INTO ocupados FROM (
    SELECT d, count(o.id) AS n
      FROM generate_series(g.fecha_inicio, fin, interval '1 day') d
      JOIN apd.grupo o ON o.id <> g.id AND o.estado IN ('en_integracion', 'confirmado', 'en_curso') AND o.fecha_inicio IS NOT NULL
       AND d::date BETWEEN o.fecha_inicio
                       AND o.fecha_inicio + (SELECT c.dias_duracion FROM apd.curso c WHERE c.tipo_acreditacion = o.tipo_acreditacion AND c.modalidad = o.modalidad) - 1
     GROUP BY d) x;
  IF coalesce(ocupados, 0) >= maximo THEN
    SELECT string_agg(o.folio, ', ' ORDER BY o.folio) INTO otros FROM apd.grupo o
     WHERE o.id <> g.id AND o.estado IN ('en_integracion', 'confirmado', 'en_curso') AND o.fecha_inicio IS NOT NULL
       AND o.fecha_inicio <= fin
       AND o.fecha_inicio + (SELECT c.dias_duracion FROM apd.curso c WHERE c.tipo_acreditacion = o.tipo_acreditacion AND c.modalidad = o.modalidad) - 1 >= g.fecha_inicio;
    PERFORM apd.error('grupos_simultaneos', format('Puede haber como máximo %s grupos al mismo tiempo y en esas fechas ya hay %s (%s): elija otra semana',
      maximo, ocupados, otros));
  END IF;
END $$;

-- La persona instructora la asigna o la cambia, y el grupo lo confirma, el área de Instructores y Capacitación (perfil
-- «capacitación») o la Dirección (administración), que ya podía hacerlo todo: los perfiles del parámetro
-- perfiles_asignan_instructor. Quien arma los grupos (revisión y cotejo) ya no lo hace (ajustes del equipo, 25/10/2026).
CREATE FUNCTION apd.asigna_instructor() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT apd.contexto('usuario_tipo') = 'personal'
     AND apd.contexto('perfil') = ANY (string_to_array(replace(apd.parametro_texto('perfiles_asignan_instructor'), ' ', ''), ','))
$$;
COMMENT ON FUNCTION apd.asigna_instructor() IS 'Quien escribe es del personal con un perfil de perfiles_asignan_instructor (capacitación o administración): asigna o cambia la persona instructora y confirma grupos.';

-- SECURITY DEFINER (con search_path fijo): el folio sale de apd.siguiente_folio (decisión 6, 2026-10-19)
CREATE FUNCTION apd.grupo_alta() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = apd, pg_temp AS $$
DECLARE
  c apd.curso;
  anio smallint := extract(year FROM apd.hoy())::smallint;
BEGIN
  SELECT * INTO c FROM apd.curso WHERE tipo_acreditacion = NEW.tipo_acreditacion AND modalidad = NEW.modalidad;
  IF NOT c.activo THEN
    PERFORM apd.error('curso_inactivo', 'Este curso no está abriendo grupos');
  END IF;
  -- El grupo propio de una organización, sólo para instituciones de gobierno: dependencias de la Ciudad, Alcaldías y
  -- dependencias federales (apd.es_gobierno). Las demás personas van a grupos combinados; no se pide oficio: el personal
  -- arma el grupo (ajustes del equipo, 25/10/2026)
  IF NEW.integracion = 'especifico'
     AND NOT apd.es_gobierno((SELECT o.tipo FROM apd.organizacion o WHERE o.id = NEW.organizacion_id)) THEN
    PERFORM apd.error('grupo_propio_sin_gobierno', 'Sólo las instituciones de gobierno (dependencias de la Ciudad, Alcaldías y dependencias federales) tienen grupo propio: empresas, consultorías, particulares, instituciones educativas e independientes van a grupos combinados');
  END IF;
  -- Quien arma el grupo lo crea sin persona instructora: la asigna el área de Instructores y Capacitación
  IF NEW.instructor IS NOT NULL AND NOT apd.asigna_instructor() THEN
    PERFORM apd.error('instructor_sin_permiso', 'La persona instructora la asigna el área de Instructores y Capacitación: cree el grupo sin ella');
  END IF;
  IF NEW.estado <> 'en_integracion' THEN
    PERFORM apd.error('alta_fuera_de_integracion', 'Un grupo nuevo se crea sin confirmar («En integración»)');
  END IF;
  PERFORM apd.comprobar_inicio_grupo(NEW.fecha_inicio);
  PERFORM apd.comprobar_fechas_grupo(NEW);
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
    PERFORM apd.error('campo_inmutable', 'El curso, el tipo de grupo (específico o combinado) y los cupos no cambian después de crearlo');
  END IF;
  IF OLD.estado IN ('en_curso', 'concluido', 'cancelado')
     AND (NEW.sede, NEW.fecha_inicio, NEW.hora_entrada) IS DISTINCT FROM (OLD.sede, OLD.fecha_inicio, OLD.hora_entrada) THEN
    PERFORM apd.error('grupo_cerrado', 'La sede, la fecha y la hora de entrada no cambian una vez iniciado el curso');
  END IF;
  -- El instructor puede variar, también durante el curso (corrección R26); cada día queda quién capturó
  -- la asistencia. Sólo no cambia con el grupo concluido o cancelado.
  IF NEW.instructor IS DISTINCT FROM OLD.instructor THEN
    -- Lo asigna o lo cambia sólo el área de Instructores y Capacitación (o la Dirección), también durante el curso
    -- (ajustes del equipo, 25/10/2026)
    IF NOT apd.asigna_instructor() THEN
      PERFORM apd.error('instructor_sin_permiso', 'La persona instructora la asigna o la cambia el área de Instructores y Capacitación');
    END IF;
    IF OLD.estado IN ('concluido', 'cancelado') THEN
      PERFORM apd.error('grupo_cerrado', 'El instructor no cambia en un grupo concluido o cancelado');
    END IF;
    IF NEW.instructor IS NULL AND OLD.estado <> 'en_integracion' THEN
      PERFORM apd.error('sin_instructor', 'Un grupo confirmado siempre tiene instructor');
    END IF;
    PERFORM apd.registrar('cambio_instructor', 'grupo', NEW.id::text,
      format('%s → %s', coalesce(OLD.instructor, 'sin instructor'), coalesce(NEW.instructor, 'sin instructor')));
  END IF;
  -- Primer día, hora de entrada y sede: con el tope de un año, y cada cambio en la bitácora con lo que había (E2-04)
  IF NEW.fecha_inicio IS DISTINCT FROM OLD.fecha_inicio THEN
    PERFORM apd.comprobar_inicio_grupo(NEW.fecha_inicio);
  END IF;
  -- Fines de semana, grupos al mismo tiempo y horario (sesión del 23/10/2026): al fijar o cambiar la fecha o la hora
  IF (NEW.fecha_inicio, NEW.hora_entrada) IS DISTINCT FROM (OLD.fecha_inicio, OLD.hora_entrada)
     AND NEW.estado IN ('en_integracion', 'confirmado') THEN
    PERFORM apd.comprobar_fechas_grupo(NEW);
  END IF;
  IF (NEW.fecha_inicio, NEW.hora_entrada, NEW.sede) IS DISTINCT FROM (OLD.fecha_inicio, OLD.hora_entrada, OLD.sede) THEN
    PERFORM apd.registrar('cambio_programacion', 'grupo', NEW.id::text, concat_ws('; ',
      CASE WHEN NEW.fecha_inicio IS DISTINCT FROM OLD.fecha_inicio THEN format('primer día %s → %s',
        coalesce(to_char(OLD.fecha_inicio, 'DD/MM/YYYY'), 'sin fecha'), coalesce(to_char(NEW.fecha_inicio, 'DD/MM/YYYY'), 'sin fecha')) END,
      CASE WHEN NEW.hora_entrada IS DISTINCT FROM OLD.hora_entrada THEN format('hora %s → %s',
        coalesce(to_char(OLD.hora_entrada, 'HH24:MI'), 'sin hora'), coalesce(to_char(NEW.hora_entrada, 'HH24:MI'), 'sin hora')) END,
      CASE WHEN NEW.sede IS DISTINCT FROM OLD.sede THEN format('sede %s → %s', coalesce(OLD.sede, 'sin sede'), coalesce(NEW.sede, 'sin sede')) END));
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
    PERFORM apd.error('transicion_invalida', format('Este cambio no está permitido: un grupo «%s» no puede pasar a «%s»', apd.nombre_estado(OLD.estado), apd.nombre_estado(NEW.estado)));
  END IF;

  -- Confirmar el grupo es del área de Instructores y Capacitación (o de la Dirección): cotejo ya no confirma (ajustes del
  -- equipo, 25/10/2026). Que una baja lo regrese a integración lo hace la base, con quien da la baja.
  IF NEW.estado = 'confirmado' AND OLD.estado = 'en_integracion' AND NOT apd.asigna_instructor() THEN
    PERFORM apd.error('confirmacion_sin_permiso', 'El grupo lo confirma el área de Instructores y Capacitación');
  END IF;

  SELECT count(*) INTO inscritos FROM apd.inscripcion WHERE grupo_id = NEW.id AND activa;

  -- Para confirmar: primer día, hora de entrada (P91) e instructor; la sede es la única (decisión 2026-10-16)
  IF NEW.estado = 'confirmado' AND (NEW.fecha_inicio IS NULL OR NEW.hora_entrada IS NULL OR NEW.instructor IS NULL) THEN
    PERFORM apd.error('datos_para_confirmar', 'Para confirmar el grupo indique el primer día, la hora de entrada y el instructor');
  END IF;
  -- Anticipación (decisión 2026-10-17, Liber): el curso empieza al menos dias_anticipacion_grupo días después de confirmar,
  -- para que la persona se entere y se organice
  IF NEW.estado = 'confirmado' AND OLD.estado = 'en_integracion'
     AND NEW.fecha_inicio < apd.hoy() + apd.parametro_texto('dias_anticipacion_grupo')::integer THEN
    PERFORM apd.error('anticipacion', format('El curso debe empezar al menos %s días después de confirmar el grupo',
      apd.parametro_texto('dias_anticipacion_grupo')));
  END IF;
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
    PERFORM apd.error('cancelacion_sin_motivo', 'Indique el motivo de la cancelación');
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
  -- A un grupo confirmado se agregan personas hasta el día anterior al inicio (decisión 2026-10-17, Liber)
  IF g.estado = 'confirmado' AND apd.hoy() >= g.fecha_inicio THEN
    PERFORM apd.error('grupo_por_iniciar', 'A un grupo confirmado se agregan personas hasta el día anterior al inicio del curso');
  END IF;
  IF s.estado <> 'lista_para_curso' THEN
    PERFORM apd.error('solicitud_no_lista', format('La solicitud %s no se puede agregar: sólo se agregan solicitudes con el cotejo terminado y sin grupo', s.folio));
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
  -- El grupo se bloquea antes de dar la baja (decisión 4, 2026-10-19; E2-02 y RI-01): una confirmación o una segunda baja
  -- simultánea espera, y la que llega después cuenta a las personas que de verdad quedan. Sin esto, el grupo quedaba
  -- confirmado por debajo del mínimo. La inscripción misma ya está bloqueada por la sentencia que la cambia, así que un
  -- examen o una asistencia que se capturan a la vez también esperan (E2-03).
  PERFORM 1 FROM apd.grupo WHERE id = NEW.grupo_id FOR UPDATE;
  IF (NEW.solicitud_id, NEW.grupo_id, NEW.inscrita_en) IS DISTINCT FROM (OLD.solicitud_id, OLD.grupo_id, OLD.inscrita_en)
     OR (NEW.activa AND NOT OLD.activa) OR (NOT OLD.activa AND NEW.motivo_baja IS DISTINCT FROM OLD.motivo_baja) THEN
    PERFORM apd.error('inscripcion_inmutable', 'La inscripción a un grupo sólo se modifica para dar de baja a la persona');
  END IF;
  IF OLD.activa AND NOT NEW.activa THEN
    IF coalesce(trim(NEW.motivo_baja), '') = '' THEN
      PERFORM apd.error('baja_sin_motivo', 'Indique el motivo de la baja');
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
    -- Un grupo confirmado que queda por debajo del mínimo regresa a integración (conserva fecha, hora e instructor
    -- como propuesta) y se vuelve a confirmar al completarse (propuesta de Claude, bloque 53)
    UPDATE apd.grupo g SET estado = 'en_integracion'
     WHERE g.id = NEW.grupo_id AND g.estado = 'confirmado'
       AND (SELECT count(*) FROM apd.inscripcion i WHERE i.grupo_id = g.id AND i.activa) < g.cupo_minimo;
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
  sol uuid;
BEGIN
  -- La inscripción se bloquea mientras se comprueba (decisión 4, 2026-10-19; E2-03): un examen o una baja simultáneos
  -- esperan, y esta captura ve lo que hicieron
  SELECT i.activa, i.solicitud_id INTO activa, sol FROM apd.inscripcion i WHERE i.id = NEW.inscripcion_id FOR UPDATE;
  SELECT gr.* INTO g FROM apd.inscripcion i JOIN apd.grupo gr ON gr.id = i.grupo_id WHERE i.id = NEW.inscripcion_id;
  -- La asistencia la captura el personal (instructor), a su propio nombre: quien capturó lo pone la base con la cuenta de
  -- la sesión (D-06, en lo que se puede en la base)
  IF apd.contexto('usuario_tipo') <> 'personal' OR apd.contexto('usuario') = '' THEN
    PERFORM apd.error('captura_de_personal', 'La asistencia la captura el personal de la Secretaría con su cuenta');
  END IF;
  NEW.capturada_por := apd.contexto('usuario');
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
  -- Una corrección de asistencia queda en la bitácora con el valor anterior (E2-04)
  IF TG_OP = 'UPDATE' AND (NEW.asistio IS DISTINCT FROM OLD.asistio OR NEW.dia IS DISTINCT FROM OLD.dia
                           OR NEW.inscripcion_id IS DISTINCT FROM OLD.inscripcion_id) THEN
    IF (NEW.dia, NEW.inscripcion_id) IS DISTINCT FROM (OLD.dia, OLD.inscripcion_id) THEN
      PERFORM apd.error('campo_inmutable', 'El día y la persona de una asistencia no cambian');
    END IF;
    PERFORM apd.registrar('asistencia', 'solicitud', sol::text,
      format('Día %s: %s → %s (antes capturó %s)', NEW.dia, CASE WHEN OLD.asistio THEN 'asistió' ELSE 'faltó' END,
             CASE WHEN NEW.asistio THEN 'asistió' ELSE 'faltó' END, OLD.capturada_por));
  END IF;
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
  -- La inscripción se bloquea mientras se comprueba (decisión 4, 2026-10-19; E2-03 y RI-02): una baja o una corrección de
  -- asistencia simultáneas esperan, y la que llega después ve el examen
  SELECT i.activa INTO activa FROM apd.inscripcion i WHERE i.id = NEW.inscripcion_id FOR UPDATE;
  SELECT gr.* INTO g FROM apd.inscripcion i JOIN apd.grupo gr ON gr.id = i.grupo_id WHERE i.id = NEW.inscripcion_id;
  -- La calificación la captura el personal o el examen en línea, a su propio nombre (D-06, en lo que se puede en la base)
  IF apd.contexto('usuario_tipo') NOT IN ('personal', 'sistema') OR apd.contexto('usuario') = '' THEN
    PERFORM apd.error('captura_de_personal', 'La calificación la captura el personal de la Secretaría con su cuenta');
  END IF;
  NEW.capturado_por := apd.contexto('usuario');
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
  -- El examen es el último día del curso, en el salón de cómputo (R36), y la asistencia de ese día se registra al
  -- pasar lista ahí, antes de dar el código (P94, decisión 2026-10-18): sin ese pase de lista no hay examen
  IF NEW.presentado_en <> g.fecha_inicio + (c.dias_duracion - 1) THEN
    PERFORM apd.error('fecha_examen', format('El examen se presenta el último día del curso (%s)', to_char(g.fecha_inicio + (c.dias_duracion - 1), 'DD/MM/YYYY')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM apd.asistencia WHERE inscripcion_id = NEW.inscripcion_id AND dia = c.dias_duracion AND asistio) THEN
    PERFORM apd.error('sin_pase_de_lista', 'Sin el pase de lista del día del examen no hay examen: primero se registra su asistencia de ese día');
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

-- ───────────────────────────── Material de estudio ─────────────────────────────
-- Decisión 2026-10-18 (Liber): los documentos para preparar el examen (la norma ambiental, la Ley Ambiental y el
-- manual de poda) los sube el personal; publicados, los ve cualquiera, sin cuenta. Sólo PDF. Una carga nueva del
-- mismo documento sustituye a la anterior sin borrarla y conserva si estaba publicado.

CREATE FUNCTION apd.material_alta() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  anterior apd.material_estudio;
BEGIN
  IF apd.contexto('usuario_tipo') <> 'personal' THEN
    PERFORM apd.error('carga_de_personal', 'El material de estudio lo carga el personal de la Secretaría');
  END IF;
  IF NEW.tipo_mime <> 'application/pdf' THEN
    PERFORM apd.error('formato_no_admitido', 'El material de estudio se carga en PDF');
  END IF;
  IF NEW.tamano_bytes > apd.parametro_texto('tamano_maximo_material_bytes')::integer THEN
    PERFORM apd.error('archivo_grande', format('El archivo pasa del máximo de %s MB',
      round(apd.parametro_texto('tamano_maximo_material_bytes')::numeric / 1048576, 1)));
  END IF;
  SELECT * INTO anterior FROM apd.material_estudio WHERE clave = NEW.clave AND vigente;
  IF FOUND THEN
    UPDATE apd.material_estudio SET vigente = false WHERE id = anterior.id;
    NEW.publicado := anterior.publicado;
    PERFORM apd.registrar('material_reemplazado', 'material_estudio', NEW.clave, format('%s → %s', anterior.nombre_archivo, NEW.nombre_archivo));
  ELSE
    PERFORM apd.registrar('material_agregado', 'material_estudio', NEW.clave, NEW.titulo);
  END IF;
  NEW.vigente := true;
  NEW.cargado_en := apd.ahora();
  NEW.cargado_por := apd.contexto('usuario');
  NEW.actualizado_en := NULL;
  NEW.actualizado_por := NULL;
  RETURN NEW;
END $$;
CREATE TRIGGER material_alta BEFORE INSERT ON apd.material_estudio
  FOR EACH ROW EXECUTE FUNCTION apd.material_alta();

CREATE FUNCTION apd.material_cambio() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.id, NEW.clave, NEW.archivo_clave, NEW.nombre_archivo, NEW.tipo_mime, NEW.tamano_bytes, NEW.sha256, NEW.paginas,
      NEW.cargado_en, NEW.cargado_por)
     IS DISTINCT FROM
     (OLD.id, OLD.clave, OLD.archivo_clave, OLD.nombre_archivo, OLD.tipo_mime, OLD.tamano_bytes, OLD.sha256, OLD.paginas,
      OLD.cargado_en, OLD.cargado_por) THEN
    PERFORM apd.error('documento_inmutable', 'Un archivo cargado no se modifica: se carga uno nuevo');
  END IF;
  IF NEW.vigente AND NOT OLD.vigente THEN
    PERFORM apd.error('documento_inmutable', 'Una carga sustituida no vuelve a ser la vigente');
  END IF;
  -- La sustitución (vigente → false) la hace la carga nueva; lo demás lo cambia el personal
  IF (NEW.titulo, NEW.descripcion, NEW.edicion, NEW.tipo_acreditacion, NEW.temas, NEW.orden, NEW.publicado)
     IS DISTINCT FROM
     (OLD.titulo, OLD.descripcion, OLD.edicion, OLD.tipo_acreditacion, OLD.temas, OLD.orden, OLD.publicado) THEN
    IF NOT OLD.vigente THEN
      PERFORM apd.error('documento_sustituido', 'Sólo se cambia la carga vigente');
    END IF;
    IF apd.contexto('usuario_tipo') <> 'personal' THEN
      PERFORM apd.error('carga_de_personal', 'El material de estudio lo cambia el personal de la Secretaría');
    END IF;
    NEW.actualizado_en := apd.ahora();
    NEW.actualizado_por := apd.contexto('usuario');
    IF NEW.publicado IS DISTINCT FROM OLD.publicado THEN
      PERFORM apd.registrar(CASE WHEN NEW.publicado THEN 'material_publicado' ELSE 'material_oculto' END, 'material_estudio', NEW.clave, NEW.titulo);
    ELSE
      PERFORM apd.registrar('material_editado', 'material_estudio', NEW.clave, NEW.titulo);
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER material_cambio BEFORE UPDATE ON apd.material_estudio
  FOR EACH ROW EXECUTE FUNCTION apd.material_cambio();

-- Lo que ve cualquiera en «Material de estudio»: sólo lo publicado y vigente
CREATE VIEW apd.material_publico AS
  SELECT m.id, m.clave, m.titulo, m.descripcion, m.edicion, m.tipo_acreditacion, m.temas, m.orden,
         m.nombre_archivo, m.archivo_clave, m.tamano_bytes, m.paginas, m.cargado_en
    FROM apd.material_estudio m
   WHERE m.vigente AND m.publicado;
COMMENT ON VIEW apd.material_publico IS 'Material de estudio publicado y vigente, para la página pública (sin cuenta).';

-- ¿Es una institución de gobierno local (dependencias de la Ciudad de México y alcaldías) o federal? Sale del tipo de la
-- organización en el catálogo (apd.organizacion.tipo): no hace falta otro dato (sesión de trabajo del 23/10/2026).
CREATE FUNCTION apd.es_gobierno(p_tipo text) RETURNS boolean LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT coalesce(p_tipo IN ('dependencia_cdmx', 'alcaldia', 'dependencia_federal'), false)
$$;
COMMENT ON FUNCTION apd.es_gobierno(text) IS 'Gobierno local (dependencia_cdmx, alcaldia) o federal (dependencia_federal): las únicas adscripciones que se agrupan en bloque en la espera y que tienen grupo propio (ajustes del equipo, 25/10/2026).';

CREATE VIEW apd.bandeja_demanda AS
  SELECT s.id AS solicitud_id,
         s.folio,
         s.tipo_acreditacion,
         s.modalidad,
         concat_ws(' ', p.nombre, p.primer_apellido, p.segundo_apellido) AS nombre,
         o.id AS organizacion_id,
         coalesce(o.nombre, CASE s.adscripcion WHEN 'independiente' THEN 'Independiente' ELSE 'Sin adscripción' END) AS organizacion,
         coalesce(o.tipo, s.adscripcion, 'sin_adscripcion') AS organizacion_tipo,
         -- Sólo las instituciones de gobierno local y federal se agrupan en bloque en la espera (sesión de trabajo del
         -- 23/10/2026): las demás van una por una en el orden general. El bloque es su organización; sin bloque, NULL.
         apd.es_gobierno(o.tipo) AS es_gobierno,
         CASE WHEN apd.es_gobierno(o.tipo) THEN o.id END AS bloque,
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
COMMENT ON VIEW apd.bandeja_demanda IS 'Personas en espera de grupo, con días de espera, prioridad (alerta desde dias_alerta_espera), bloque (sólo gobierno local y federal) y, en renovación, días para el vencimiento.';

-- Indicador permanente (decisión 2026-10-14): personas cuya acreditación venció mientras esperan grupo.
CREATE VIEW apd.vencidas_en_espera AS
  SELECT b.* FROM apd.bandeja_demanda b WHERE b.modalidad = 'renovacion' AND b.dias_para_vencer < 0;
COMMENT ON VIEW apd.vencidas_en_espera IS 'Renovaciones en espera de grupo con la acreditación anterior ya vencida: no pueden operar mientras esperan.';
