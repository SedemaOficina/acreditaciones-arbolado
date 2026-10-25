-- REGISTRO ASISTIDO DEL ESQUEMA apd · personas que no saben leer ni escribir (decisión 2026-10-25, Liber). Lo corre quien
-- administra la base, dentro de instalar.sql, después de 03-apd-reglas.sql (usa sus utilidades: apd.error, apd.contexto,
-- apd.registrar, apd.ahora) y antes de los catálogos.
--
-- Lo hace el personal de revisión y cotejo en el Vivero, con la persona presente (los perfiles del parámetro
-- perfiles_registro_asistido; P27):
--   · registra la cuenta: activa y SIN contraseña (no puede entrar sola), con el teléfono obligatorio y el correo opcional;
--     la base anota quién la registró y cuándo (registro_asistido_por, registro_asistido_en);
--   · antes de registrarla le lee el aviso de privacidad y marca que lo aceptó; antes de cada envío de su solicitud (y al
--     cargar por ella un documento sin que siga un envío) le lee lo capturado y marca que lo aceptó. El backend declara la
--     marca en el contexto de la transacción, como el motivo:
--       SELECT set_config('apd.lectura_aceptada', 'aviso_privacidad' | 'lo_capturado', true);
--     sin ella la base no registra ni envía (sin_lectura), y la marca queda en la bitácora con la cuenta del personal
--     (apd.usuario) y la hora de la base;
--   · captura su solicitud (capturada_por) y carga sus documentos, también los corregidos, en la ventanilla;
--   · la persona puede activar después su cuenta con su CURP, su correo y su contraseña (la API usa el mismo camino que las
--     cuentas del registro de Kobo: compara la CURP y el nombre); hasta entonces nadie abre una sesión con esa cuenta
--     (apd.sesion_sin_contrasena) y cada cambio que a otra persona le llegaría por correo deja un aviso por teléfono
--     pendiente (apd.aviso_telefono, catálogo de docs/AVISOS-POR-CORREO.md), que el personal marca con su resultado.
--
-- Va en su propio archivo y con disparadores propios, sin cambiar las reglas de 03: en una misma tabla y un mismo
-- momento, PostgreSQL corre los disparadores por orden de nombre, y los de aquí se llaman de modo que corren después de
-- los de 03 (solicitante_alta → solicitante_asistida; solicitante_cambio → solicitante_cambio_asistida; …).

-- ───────────────────────────── Utilidades ─────────────────────────────

-- Sólo los perfiles de perfiles_registro_asistido (revisión y cotejo), del personal y con su cuenta declarada
CREATE FUNCTION apd.comprobar_perfil_asistido(p_mensaje text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF apd.contexto('usuario_tipo') <> 'personal' OR apd.contexto('usuario') = ''
     OR NOT apd.contexto('perfil') = ANY (string_to_array(replace(apd.parametro_texto('perfiles_registro_asistido'), ' ', ''), ',')) THEN
    PERFORM apd.error('registro_asistido_sin_permiso', p_mensaje);
  END IF;
END $$;
COMMENT ON FUNCTION apd.comprobar_perfil_asistido(text) IS 'Registro asistido: rechaza (registro_asistido_sin_permiso) a quien no es del personal con un perfil de perfiles_registro_asistido.';

-- La marca de lectura que declaró el personal en esta transacción
CREATE FUNCTION apd.comprobar_lectura(p_marca text, p_mensaje text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF apd.contexto('lectura_aceptada') IS DISTINCT FROM p_marca THEN
    PERFORM apd.error('sin_lectura', p_mensaje);
  END IF;
END $$;

-- ¿Es una cuenta del registro asistido? ¿Y todavía sin activar (sin contraseña, avisos por teléfono)?
CREATE FUNCTION apd.es_asistida(p_solicitante uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM apd.solicitante p WHERE p.id = p_solicitante AND p.registro_asistido_en IS NOT NULL)
$$;
CREATE FUNCTION apd.asistida_sin_activar(p_solicitante uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM apd.solicitante p WHERE p.id = p_solicitante AND p.registro_asistido_en IS NOT NULL AND p.activada_en IS NULL)
$$;
COMMENT ON FUNCTION apd.asistida_sin_activar(uuid) IS 'Cuenta del registro asistido que la persona todavía no activa: sin contraseña y con los avisos por teléfono.';

-- Una fecha y hora en los datos de un aviso: ISO 8601 en UTC, igual sea cual sea la zona de la sesión que la escribe
CREATE FUNCTION apd.iso(t timestamptz) RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT to_char(t AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
$$;

-- ───────────────────────────── La cuenta ─────────────────────────────

-- Alta. La registra el personal sin contraseña: es el registro asistido (perfil, lectura del aviso de privacidad y
-- mayoría de edad con la fecha de la CURP, como la solicitud). Con contraseña, el alta sigue como antes (la de la persona
-- o la de una prueba); la constraint solicitante_contrasena_ck impide una cuenta activa sin contraseña que no sea del
-- registro asistido. Quién y cuándo los pone la base.
CREATE FUNCTION apd.solicitante_asistida() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE edad integer;
BEGIN
  NEW.registro_asistido_por := NULL;
  NEW.registro_asistido_en := NULL;
  NEW.activada_en := NULL;
  IF apd.contexto('usuario_tipo') = 'personal' AND NEW.contrasena_hash IS NULL THEN
    PERFORM apd.comprobar_perfil_asistido('Sólo el personal de revisión y cotejo registra a una persona en el Vivero (registro asistido)');
    IF NEW.estado <> 'activa' THEN
      PERFORM apd.error('asistida_no_activa', 'La cuenta del registro asistido queda activa y sin contraseña: la persona la activa después, si alguien la ayuda');
    END IF;
    edad := apd.parametro_texto('edad_minima')::integer;
    IF apd.curp_nacimiento(NEW.curp) + make_interval(years => edad) > apd.hoy() THEN
      PERFORM apd.error('menor_de_edad', format('Según su CURP, la persona todavía no tiene %s años cumplidos: no se puede registrar', edad));
    END IF;
    PERFORM apd.comprobar_lectura('aviso_privacidad', 'Lea a la persona el aviso de privacidad y marque que lo aceptó antes de registrarla');
    NEW.registro_asistido_por := apd.contexto('usuario');
    NEW.registro_asistido_en := apd.ahora();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER solicitante_asistida BEFORE INSERT ON apd.solicitante
  FOR EACH ROW EXECUTE FUNCTION apd.solicitante_asistida();

-- Cambios. Quién la registró, cuándo y cuándo se activó no cambian. La activación (la contraseña de una cuenta del
-- registro asistido que no la tenía) la hace la persona, con su correo; la base pone la hora.
CREATE FUNCTION apd.solicitante_cambio_asistida() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.registro_asistido_por, NEW.registro_asistido_en, NEW.activada_en)
     IS DISTINCT FROM (OLD.registro_asistido_por, OLD.registro_asistido_en, OLD.activada_en) THEN
    PERFORM apd.error('registro_asistido_fijo', 'Quién registró la cuenta en el Vivero, cuándo y cuándo la activó la persona los pone la base y no cambian');
  END IF;
  IF OLD.registro_asistido_en IS NOT NULL AND OLD.activada_en IS NULL AND NEW.contrasena_hash IS NOT NULL THEN
    IF apd.contexto('usuario_tipo') <> 'solicitante' THEN
      PERFORM apd.error('activacion_de_persona', 'La cuenta del registro asistido la activa la persona, con su CURP, su correo y su contraseña');
    END IF;
    IF NEW.correo IS NULL THEN
      PERFORM apd.error('activacion_sin_correo', 'Para activar tu cuenta escribe tu correo');
    END IF;
    NEW.activada_en := apd.ahora();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER solicitante_cambio_asistida BEFORE UPDATE ON apd.solicitante
  FOR EACH ROW EXECUTE FUNCTION apd.solicitante_cambio_asistida();

-- A la bitácora: la marca del aviso de privacidad (con la cuenta del personal que se lo leyó) y la activación. Y el aviso
-- por teléfono de una cuenta bloqueada por identidad (T3).
CREATE FUNCTION apd.solicitante_asistida_registrar() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.registro_asistido_en IS NOT NULL THEN
      PERFORM apd.registrar('lectura_aviso_privacidad', 'solicitante', NEW.id::text,
        'Registro asistido en el Vivero: se le leyó el aviso de privacidad y lo aceptó');
    END IF;
    RETURN NULL;
  END IF;
  IF NEW.activada_en IS NOT NULL AND OLD.activada_en IS NULL THEN
    PERFORM apd.registrar('activacion', 'solicitante', NEW.id::text, 'La persona activó en línea su cuenta del registro asistido');
  END IF;
  IF NEW.bloqueo_motivo = 'identidad' AND OLD.bloqueo_motivo IS DISTINCT FROM 'identidad' THEN
    PERFORM apd.avisar_por_telefono(NEW.id, NULL, 'T3');
  END IF;
  RETURN NULL;
END $$;

-- Sin contraseña no hay sesión: la cuenta del registro asistido sin activar (y la del padrón migrado) no entra sola
CREATE FUNCTION apd.sesion_sin_contrasena() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM apd.solicitante p WHERE p.id = NEW.solicitante_id AND p.contrasena_hash IS NULL) THEN
    PERFORM apd.error('cuenta_sin_contrasena', 'Esta cuenta todavía no tiene contraseña: actívala con tu CURP, tu correo y una contraseña');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sesion_sin_contrasena BEFORE INSERT ON apd.sesion_solicitante
  FOR EACH ROW EXECUTE FUNCTION apd.sesion_sin_contrasena();

-- La fotografía que toma o carga el personal al registrar a la persona: no la confirma el registro (queda pendiente,
-- origen registro_asistido); la confirma el cotejo contra la identificación oficial, como la que carga cualquier persona.
-- Después de confirmada, una carga del personal vuelve a ser la del cotejo (03, P100).
CREATE FUNCTION apd.fotografia_asistida() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF apd.contexto('usuario_tipo') = 'personal' AND apd.es_asistida(NEW.solicitante_id)
     AND NOT EXISTS (SELECT 1 FROM apd.fotografia f WHERE f.solicitante_id = NEW.solicitante_id AND f.estado = 'confirmada') THEN
    PERFORM apd.comprobar_perfil_asistido('Sólo el personal de revisión y cotejo carga la fotografía de una persona del registro asistido');
    NEW.origen := 'registro_asistido';
    NEW.estado := 'pendiente';
    NEW.confirmada_por := NULL;
    NEW.confirmada_en := NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER fotografia_asistida BEFORE INSERT ON apd.fotografia
  FOR EACH ROW EXECUTE FUNCTION apd.fotografia_asistida();

-- ───────────────────────────── La solicitud y sus documentos ─────────────────────────────

-- Alta: la que da de alta el personal para una persona del registro asistido guarda quién la capturó (con su perfil)
CREATE FUNCTION apd.solicitud_asistida() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.capturada_por := NULL;
  IF apd.contexto('usuario_tipo') = 'personal' AND apd.es_asistida(NEW.solicitante_id) THEN
    PERFORM apd.comprobar_perfil_asistido('Sólo el personal de revisión y cotejo captura la solicitud de una persona del registro asistido');
    NEW.capturada_por := apd.contexto('usuario');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER solicitud_asistida BEFORE INSERT ON apd.solicitud
  FOR EACH ROW EXECUTE FUNCTION apd.solicitud_asistida();

-- Envío (y reenvío con lo corregido) que hace el personal por la persona: con su perfil y con la marca «se le leyó lo
-- capturado y lo aceptó», que queda en la bitácora. Quién la capturó no cambia.
CREATE FUNCTION apd.solicitud_cambio_asistida() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.capturada_por IS DISTINCT FROM OLD.capturada_por THEN
    PERFORM apd.error('registro_asistido_fijo', 'Quién capturó la solicitud lo pone la base y no cambia');
  END IF;
  IF NEW.estado = 'enviada' AND OLD.estado <> 'enviada' AND apd.contexto('usuario_tipo') = 'personal' AND apd.es_asistida(NEW.solicitante_id) THEN
    PERFORM apd.comprobar_perfil_asistido('Sólo el personal de revisión y cotejo envía la solicitud de una persona del registro asistido');
    PERFORM apd.comprobar_lectura('lo_capturado', 'Lea a la persona lo capturado y marque que lo aceptó antes de enviar su solicitud');
    PERFORM apd.registrar('lectura_lo_capturado', 'solicitud', NEW.id::text,
      CASE OLD.estado WHEN 'borrador' THEN 'Se le leyó lo capturado y lo aceptó · envío de la solicitud'
                      ELSE 'Se le leyó lo capturado y lo aceptó · reenvío con lo corregido' END);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER solicitud_cambio_asistida BEFORE UPDATE ON apd.solicitud
  FOR EACH ROW EXECUTE FUNCTION apd.solicitud_cambio_asistida();

-- Documentos en línea que carga el personal por una persona del registro asistido: con su perfil. Si no sigue un envío
-- (el documento que no coincidió en una cita en pausa), con la marca de lectura en ese momento.
CREATE FUNCTION apd.documento_asistido() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s apd.solicitud;
BEGIN
  IF apd.contexto('usuario_tipo') <> 'personal' THEN RETURN NEW; END IF;
  SELECT * INTO s FROM apd.solicitud WHERE id = NEW.solicitud_id;
  IF NOT apd.es_asistida(s.solicitante_id)
     OR (SELECT r.momento FROM apd.requisito r WHERE r.clave = NEW.requisito) IS DISTINCT FROM 'en_linea' THEN
    RETURN NEW;
  END IF;
  PERFORM apd.comprobar_perfil_asistido('Sólo el personal de revisión y cotejo carga los documentos de una persona del registro asistido');
  IF s.estado = 'validada_en_linea' THEN
    PERFORM apd.comprobar_lectura('lo_capturado', 'Lea a la persona lo que carga por ella y marque que lo aceptó');
    PERFORM apd.registrar('lectura_lo_capturado', 'solicitud', s.id::text,
      format('Se le leyó lo capturado y lo aceptó · documento %s cargado en la ventanilla', NEW.requisito));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER documento_asistido BEFORE INSERT ON apd.documento
  FOR EACH ROW EXECUTE FUNCTION apd.documento_asistido();

-- ───────────────────────────── Avisos por teléfono ─────────────────────────────
-- Cada cambio que a otra persona le llegaría por correo (catálogo docs/AVISOS-POR-CORREO.md) deja, para la cuenta del
-- registro asistido todavía sin activar, un aviso pendiente con los datos para decirlo. Sólo los cambios del trámite: los
-- recordatorios por fecha (un día antes de la cita o del curso, el vencimiento) los manda la tarea diaria de los correos,
-- que todavía no existe (P23; para el teléfono, P207). Lo que se le dice lo arma la pantalla con estos datos.

-- Lo llaman sólo las reglas (pg_trigger_depth() > 0); escribe con los permisos de quien instala: la cuenta del servicio no
-- tiene INSERT sobre apd.aviso_telefono
CREATE FUNCTION apd.avisar_por_telefono(p_solicitante uuid, p_solicitud uuid, p_aviso text, p_datos jsonb DEFAULT '{}'::jsonb)
  RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = apd, pg_temp AS $$
BEGIN
  IF pg_trigger_depth() = 0 THEN
    PERFORM apd.error('aviso_directo', 'Los avisos por teléfono los crea la base con cada cambio del trámite');
  END IF;
  IF apd.asistida_sin_activar(p_solicitante) THEN
    INSERT INTO apd.aviso_telefono (solicitante_id, solicitud_id, aviso, datos)
    VALUES (p_solicitante, p_solicitud, p_aviso, coalesce(p_datos, '{}'::jsonb));
  END IF;
END $$;

CREATE FUNCTION apd.aviso_telefono_alta() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.creado_en := apd.ahora();
  NEW.resultado := NULL;
  NEW.atendido_por := NULL;
  NEW.atendido_en := NULL;
  RETURN NEW;
END $$;
CREATE TRIGGER aviso_telefono_alta BEFORE INSERT ON apd.aviso_telefono
  FOR EACH ROW EXECUTE FUNCTION apd.aviso_telefono_alta();

-- El personal de revisión y cotejo llama y registra el resultado, una sola vez: se le avisó o no contestó. Quién y cuándo
-- los pone la base; queda en la bitácora.
CREATE FUNCTION apd.aviso_telefono_cambio() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.solicitante_id, NEW.solicitud_id, NEW.aviso, NEW.datos, NEW.creado_en)
     IS DISTINCT FROM (OLD.solicitante_id, OLD.solicitud_id, OLD.aviso, OLD.datos, OLD.creado_en) THEN
    PERFORM apd.error('aviso_inmutable', 'Un aviso por teléfono no se modifica: sólo se registra su resultado');
  END IF;
  IF OLD.resultado IS NOT NULL THEN
    PERFORM apd.error('aviso_atendido', format('Este aviso ya tiene su resultado: lo registró %s', OLD.atendido_por));
  END IF;
  IF NEW.resultado IS NULL THEN
    PERFORM apd.error('aviso_sin_resultado', 'Indique si se le avisó o si no contestó');
  END IF;
  PERFORM apd.comprobar_perfil_asistido('Sólo el personal de revisión y cotejo registra los avisos por teléfono');
  NEW.atendido_por := apd.contexto('usuario');
  NEW.atendido_en := apd.ahora();
  PERFORM apd.registrar('aviso_telefono', 'solicitante', NEW.solicitante_id::text,
    format('Aviso %s por teléfono: %s', NEW.aviso, CASE NEW.resultado WHEN 'se_le_aviso' THEN 'se le avisó' ELSE 'no contestó' END));
  RETURN NEW;
END $$;
CREATE TRIGGER aviso_telefono_cambio BEFORE UPDATE ON apd.aviso_telefono
  FOR EACH ROW EXECUTE FUNCTION apd.aviso_telefono_cambio();

-- La solicitud: revisión (S2, S5, S6), plazo para corregir (S4), cotejo (T2), grupo (G1, G2) y examen (G4)
CREATE FUNCTION apd.solicitud_telefono() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  d jsonb := jsonb_build_object('folio', NEW.folio, 'tipo_acreditacion', NEW.tipo_acreditacion, 'modalidad', NEW.modalidad);
  g apd.grupo;
  ultima text;
BEGIN
  IF NEW.estado IS DISTINCT FROM OLD.estado THEN
    IF OLD.estado = 'enviada' AND NEW.estado = 'con_observaciones' THEN
      PERFORM apd.avisar_por_telefono(NEW.solicitante_id, NEW.id, 'S2', d);
    ELSIF OLD.estado = 'con_observaciones' AND NEW.estado = 'concluida_sin_atender' THEN
      PERFORM apd.avisar_por_telefono(NEW.solicitante_id, NEW.id, 'S4', d);
    ELSIF NEW.estado = 'validada_en_linea' THEN
      PERFORM apd.avisar_por_telefono(NEW.solicitante_id, NEW.id, 'S5', d || jsonb_build_object('cita_en', apd.iso(NEW.cita_en),
        'pago_monto', NEW.pago_monto, 'pago_referencia', NEW.pago_referencia,
        'pago_concepto', (SELECT c.pago_concepto FROM apd.curso c WHERE c.tipo_acreditacion = NEW.tipo_acreditacion AND c.modalidad = NEW.modalidad)));
    ELSIF NEW.estado = 'rechazada' THEN
      PERFORM apd.avisar_por_telefono(NEW.solicitante_id, NEW.id, 'S6', d || jsonb_build_object('motivo', NEW.motivo_cierre));
    ELSIF OLD.estado = 'validada_en_linea' THEN
      -- Resultado de la cita: terminó el cotejo, regresó con observaciones o se cerró por la segunda inasistencia
      PERFORM apd.avisar_por_telefono(NEW.solicitante_id, NEW.id, 'T2', d || jsonb_build_object('resultado',
        CASE NEW.estado WHEN 'lista_para_curso' THEN 'atendida' WHEN 'con_observaciones' THEN 'con_observaciones'
                        WHEN 'concluida_sin_atender' THEN 'cerrada' ELSE NEW.estado END,
        'expediente', (SELECT p.numero_expediente FROM apd.solicitante p WHERE p.id = NEW.solicitante_id)));
    ELSIF OLD.estado = 'inscrita' AND NEW.estado = 'lista_para_curso' THEN
      SELECT gr.* INTO g FROM apd.inscripcion i JOIN apd.grupo gr ON gr.id = i.grupo_id
       WHERE i.solicitud_id = NEW.id ORDER BY i.baja_en DESC NULLS LAST LIMIT 1;
      PERFORM apd.avisar_por_telefono(NEW.solicitante_id, NEW.id, 'G2', d || jsonb_build_object('resultado', 'baja', 'grupo', g.folio,
        'motivo', (SELECT i.motivo_baja FROM apd.inscripcion i WHERE i.solicitud_id = NEW.id ORDER BY i.baja_en DESC NULLS LAST LIMIT 1)));
    ELSIF NEW.estado = 'inscrita' THEN
      -- A un grupo ya confirmado; si está en integración, el aviso sale al confirmarlo (apd.grupo_telefono)
      SELECT gr.* INTO g FROM apd.inscripcion i JOIN apd.grupo gr ON gr.id = i.grupo_id WHERE i.solicitud_id = NEW.id AND i.activa;
      IF g.estado IN ('confirmado', 'en_curso') THEN
        PERFORM apd.avisar_por_telefono(NEW.solicitante_id, NEW.id, 'G1', d || jsonb_build_object('grupo', g.folio,
          'fecha_inicio', g.fecha_inicio, 'hora_entrada', to_char(g.hora_entrada, 'HH24:MI')));
      END IF;
    ELSIF NEW.estado IN ('aprobada', 'no_acreditada', 'sin_derecho_examen') THEN
      PERFORM apd.avisar_por_telefono(NEW.solicitante_id, NEW.id, 'G4', d || jsonb_build_object('resultado', NEW.estado,
        'calificacion', (SELECT e.calificacion FROM apd.inscripcion i JOIN apd.examen e ON e.inscripcion_id = i.id
                          WHERE i.solicitud_id = NEW.id AND i.activa),
        'minima', (SELECT c.calificacion_minima FROM apd.curso c WHERE c.tipo_acreditacion = NEW.tipo_acreditacion AND c.modalidad = NEW.modalidad)));
    END IF;
  ELSIF NEW.estado = 'validada_en_linea' AND OLD.cita_en IS NOT NULL AND NEW.cita_en IS DISTINCT FROM OLD.cita_en THEN
    -- Cita nueva después de no presentarse o de no traer el pago (T2)
    SELECT c.resultado INTO ultima FROM apd.cita c
     WHERE c.solicitud_id = NEW.id AND c.resultado IN ('no_se_presento', 'sin_pago') ORDER BY c.atendida_en DESC LIMIT 1;
    PERFORM apd.avisar_por_telefono(NEW.solicitante_id, NEW.id, 'T2', d || jsonb_build_object('resultado', 'cita_nueva',
      'cita_en', apd.iso(NEW.cita_en), 'motivo', ultima));
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER solicitud_telefono AFTER UPDATE ON apd.solicitud
  FOR EACH ROW EXECUTE FUNCTION apd.solicitud_telefono();

-- La cita en pausa: qué documento traer ese mismo día (T2)
CREATE FUNCTION apd.cita_telefono() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE s apd.solicitud;
BEGIN
  IF NEW.resultado = 'en_pausa' AND OLD.resultado IS DISTINCT FROM 'en_pausa' THEN
    SELECT * INTO s FROM apd.solicitud WHERE id = NEW.solicitud_id;
    PERFORM apd.avisar_por_telefono(s.solicitante_id, s.id, 'T2', jsonb_build_object('folio', s.folio, 'tipo_acreditacion', s.tipo_acreditacion,
      'modalidad', s.modalidad, 'resultado', 'en_pausa', 'observacion', NEW.observacion));
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER cita_telefono AFTER UPDATE ON apd.cita
  FOR EACH ROW EXECUTE FUNCTION apd.cita_telefono();

-- El grupo: confirmado (G1); ya confirmado, cambia su fecha o su hora, o regresa a integración por una baja (G2). La
-- cancelación y la baja llegan por la solicitud (inscrita → lista_para_curso).
CREATE FUNCTION apd.grupo_telefono() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  aviso text;
  d jsonb;
  r record;
BEGIN
  IF OLD.estado = 'en_integracion' AND NEW.estado = 'confirmado' THEN
    aviso := 'G1'; d := jsonb_build_object('resultado', 'confirmado');
  ELSIF OLD.estado = 'confirmado' AND NEW.estado = 'en_integracion' THEN
    aviso := 'G2'; d := jsonb_build_object('resultado', 'por_confirmar');
  ELSIF OLD.estado = 'confirmado' AND NEW.estado = 'confirmado'
        AND (NEW.fecha_inicio, NEW.hora_entrada, NEW.sede) IS DISTINCT FROM (OLD.fecha_inicio, OLD.hora_entrada, OLD.sede) THEN
    aviso := 'G2'; d := jsonb_build_object('resultado', 'cambio');
  ELSE
    RETURN NULL;
  END IF;
  d := d || jsonb_build_object('grupo', NEW.folio, 'fecha_inicio', NEW.fecha_inicio, 'hora_entrada', to_char(NEW.hora_entrada, 'HH24:MI'));
  FOR r IN SELECT s.id, s.solicitante_id, s.folio, s.tipo_acreditacion, s.modalidad FROM apd.inscripcion i JOIN apd.solicitud s ON s.id = i.solicitud_id
            WHERE i.grupo_id = NEW.id AND i.activa ORDER BY s.folio LOOP
    PERFORM apd.avisar_por_telefono(r.solicitante_id, r.id, aviso,
      d || jsonb_build_object('folio', r.folio, 'tipo_acreditacion', r.tipo_acreditacion, 'modalidad', r.modalidad));
  END LOOP;
  RETURN NULL;
END $$;
CREATE TRIGGER grupo_telefono AFTER UPDATE ON apd.grupo
  FOR EACH ROW EXECUTE FUNCTION apd.grupo_telefono();

-- La acreditación: entregada (A1) o cancelada (A6)
CREATE FUNCTION apd.acreditacion_telefono() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.entregada_en IS NOT NULL AND OLD.entregada_en IS NULL THEN
    PERFORM apd.avisar_por_telefono(NEW.solicitante_id, NEW.solicitud_id, 'A1', jsonb_build_object('numero', NEW.numero,
      'tipo_acreditacion', NEW.tipo_acreditacion, 'vence_en', NEW.vence_en));
  END IF;
  IF NEW.cancelada_en IS NOT NULL AND OLD.cancelada_en IS NULL THEN
    PERFORM apd.avisar_por_telefono(NEW.solicitante_id, NEW.solicitud_id, 'A6', jsonb_build_object('numero', NEW.numero,
      'tipo_acreditacion', NEW.tipo_acreditacion, 'motivo', NEW.cancelacion_motivo));
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER acreditacion_telefono AFTER UPDATE ON apd.acreditacion
  FOR EACH ROW EXECUTE FUNCTION apd.acreditacion_telefono();

-- La reposición de la credencial: el acta con observaciones, aceptada o la credencial repuesta (A7)
CREATE FUNCTION apd.reposicion_telefono() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a apd.acreditacion;
BEGIN
  IF NEW.estado IS DISTINCT FROM OLD.estado AND NEW.estado IN ('con_observaciones', 'acta_aceptada', 'repuesta') THEN
    SELECT * INTO a FROM apd.acreditacion WHERE id = NEW.acreditacion_id;
    PERFORM apd.avisar_por_telefono(a.solicitante_id, a.solicitud_id, 'A7', jsonb_build_object('numero', a.numero,
      'tipo_acreditacion', a.tipo_acreditacion, 'resultado', NEW.estado, 'observacion', nullif(NEW.observacion, ''), 'pago_monto', NEW.pago_monto));
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER reposicion_telefono AFTER UPDATE ON apd.reposicion
  FOR EACH ROW EXECUTE FUNCTION apd.reposicion_telefono();

-- Al final: el registro de la cuenta usa apd.avisar_por_telefono (T3), que ya existe
CREATE TRIGGER solicitante_asistida_registrar AFTER INSERT OR UPDATE ON apd.solicitante
  FOR EACH ROW EXECUTE FUNCTION apd.solicitante_asistida_registrar();

-- Lo que el personal ve en «Avisos por teléfono pendientes»: el aviso con el nombre y el teléfono de la persona, del más
-- antiguo al más reciente
CREATE VIEW apd.avisos_telefono_pendientes AS
  SELECT a.id, a.aviso, a.datos, a.creado_en, a.solicitud_id, a.solicitante_id,
         p.nombre, p.primer_apellido, p.segundo_apellido, p.telefono
    FROM apd.aviso_telefono a JOIN apd.solicitante p ON p.id = a.solicitante_id
   WHERE a.resultado IS NULL;
COMMENT ON VIEW apd.avisos_telefono_pendientes IS 'Avisos por teléfono del registro asistido que nadie ha registrado, con el nombre y el teléfono de la persona.';
