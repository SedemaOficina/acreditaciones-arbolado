-- CATÁLOGOS INICIALES DEL ESQUEMA apd. Lo corre quien administra la base, dentro de instalar.sql.
-- Cada valor sale de docs/DECISIONES.md; lo marcado [pendiente] se confirma con la Dirección de
-- Infraestructura Verde antes del primer dato real. Después de instalar, se cambian desde la administración
-- del sistema (con bitácora), no reinstalando.

INSERT INTO apd.parametro (clave, valor, descripcion) VALUES
  ('dias_antes_renovacion', '30',
   'Días naturales antes del vencimiento desde los que se puede renovar (decisión 2026-10-14).'),
  ('meses_despues_renovacion', '12',
   'Meses después del vencimiento durante los que todavía se renueva; pasado ese plazo se tramita como nueva (decisión 2026-10-14).'),
  ('dias_alerta_espera', '15',
   'Días de espera sin grupo a partir de los que la solicitud se marca como prioritaria: la Secretaría asigna grupo en 15 días si se completa el cupo mínimo (P143, sesión de trabajo del 23/10/2026; antes 31).'),
  ('tamano_maximo_archivo_bytes', '5242880',
   'Tamaño máximo de cada documento cargado: 5 MB (corrección de Liber al mapa, R12, 2026-10-14).'),
  ('tamano_maximo_material_bytes', '31457280',
   'Tamaño máximo de cada PDF de material de estudio: 30 MB (el manual de poda publicado pesa 11.7 MB; decisión 2026-10-18).'),
  ('pago_instrucciones', '[pendiente] Banco, cuenta o CLABE y forma de pago: los define la Secretaría de Administración y Finanzas.',
   'Cómo pagar los derechos; se muestra a la persona con su cita y su referencia (decisión 2026-10-14).'),
  ('entrega_lugar', '[pendiente] Si no puedes quedarte el día del examen: días y horario para recoger tu credencial en el Vivero (P10).',
   'Cuándo se recoge la acreditación emitida (el lugar es la sede); se muestra a la persona (decisión 2026-10-14).'),
  ('dias_anticipacion_grupo', '7',
   'Días mínimos entre confirmar un grupo y el primer día del curso, para que la persona se entere y se organice (decisión 2026-10-17, Liber).'),
  ('dias_habiles_cita', '20',
   'Días hábiles (de lunes a viernes) dentro de los que se da la cita de cotejo: al validar la solicitud y al dar una cita nueva, del siguiente día hábil a este número de días hábiles después (P205, decisión de Liber del 26/10/2026, como dicen los lineamientos; P02). Sustituye al límite de 6 meses (meses_adelanto_cita).'),
  ('dias_habiles_revision', '10',
   'Días hábiles que tiene la Secretaría para la revisión documental de una solicitud enviada; se le dice a la persona con su fecha (P02, sesión de trabajo del 23/10/2026; P199).'),
  ('dias_habiles_correccion', '20',
   'Días hábiles que tiene la persona para atender las observaciones de la revisión; «Mis trámites» le dice hasta cuándo (P02, sesión de trabajo del 23/10/2026; P199). Todavía no hay tarea que cierre sola la solicitud al vencer (P23).'),
  ('inasistencias_cotejo_maximas', '2',
   'Inasistencias a la cita de cotejo con las que la solicitud se cierra como concluida sin atender: a la primera se da una cita nueva, una sola vez (decisión 2026-10-17, Liber).'),
  ('sede', 'Vivero Nezahualcóyotl',
   'Lugar único de la cita de cotejo, del curso y de la entrega de acreditaciones (decisión 2026-10-16, Liber).'),
  ('sede_direccion', 'Canal de Chalco s/n, colonia Ciénega Grande, Alcaldía Xochimilco [pendiente: referencias para llegar (puerta de acceso y transporte)].',
   'Dirección de la sede (confirmada por Liber el 2026-10-23) y referencias para llegar; se muestra a la persona con la cita, el grupo y la entrega. Lo marcado [pendiente] no se muestra: la pantalla dice que faltan las referencias.'),
  ('sede_mapa', '19.2893657,-99.075447',
   'Ubicación de la sede en el mapa: «latitud,longitud» en grados decimales (la que confirmó Liber con su enlace de Google Maps). De aquí salen el mapa de Google y el enlace «Abrir en Google Maps» de «Mis trámites»; vacía, no se muestra mapa (decisión 2026-10-23, Liber).'),
  ('intentos_maximos', '5',
   'Intentos de entrada fallidos seguidos con los que la cuenta se bloquea (D-07, auditoría 2026-10-19) [pendiente: confirmar con el esquema acceso del SIA].'),
  ('edad_minima', '18',
   'Años cumplidos que necesita la persona, el día de su solicitud, para las dos acreditaciones; se calculan con la fecha de nacimiento de su CURP (P138, sesión de trabajo del 23/10/2026).'),
  ('anios_poda_dictaminador', '2',
   'Años consecutivos con la acreditación de poda y derribo que se necesitan para solicitar por primera vez la de dictaminador; una renovación dentro de la ventana de renovación tardía (meses_despues_renovacion) no corta la cuenta (sesión de trabajo del 23/10/2026).'),
  ('grupos_simultaneos_maximo', '2',
   'Grupos que puede haber al mismo tiempo, de cualquier curso (P149, sesión de trabajo del 23/10/2026).'),
  ('cita_hora_desde', '09:30',
   'Primera hora de las citas de cotejo, de lunes a viernes (P69, sesión de trabajo del 23/10/2026).'),
  ('cita_hora_hasta', '14:30',
   'Última hora de las citas de cotejo, de lunes a viernes (P69, sesión de trabajo del 23/10/2026).'),
  ('curso_hora_entrada', '09:00',
   'Hora de entrada del curso, todos los días; la primera que se puede elegir para un grupo (P91, sesión de trabajo del 23/10/2026).'),
  ('curso_hora_salida', '15:00',
   'Hora de salida del curso, todos los días; se muestra a la persona con su grupo (P91, sesión de trabajo del 23/10/2026).'),
  ('informes_horario', 'de lunes a viernes, de 9:00 a 15:00',
   'Horario de informes de la Secretaría para aclaraciones del trámite; se muestra a la persona donde se le pide acudir o comunicarse. El teléfono y el correo están pendientes (P132, sesión de trabajo del 23/10/2026).'),
  ('perfiles_cancelan_acreditacion', 'instructor,directivo',
   'Perfiles del personal (acceso del SIA, P27) que pueden cancelar una acreditación vigente, separados por coma: los instructores y los directivos (P120, sesión de trabajo del 23/10/2026). El perfil «directivo» es distinto de la administración del sistema, que ya no cancela (P201, decisión de Liber del 26/10/2026).'),
  ('perfiles_grupos_solo_lectura', 'directivo',
   'Perfiles del personal (acceso del SIA, P27) que consultan los grupos sin crearlos, cambiarlos, confirmarlos ni inscribir, separados por coma: el directivo (P201, respuesta de Liber del 26/10/2026).'),
  ('perfiles_asignan_instructor', 'capacitacion,administracion',
   'Perfiles del personal (acceso del SIA, P27) que asignan o cambian la persona instructora de un grupo y lo confirman, separados por coma: el área de Instructores y Capacitación (capacitación) y la Dirección (administración), que ya podía hacerlo todo. Quien arma los grupos (revisión y cotejo) ya no lo hace (ajustes del equipo, 25/10/2026).'),
  ('oportunidades_correccion', '2',
   'Veces que la persona puede corregir las observaciones de la revisión en línea. Si en la revisión de la última corrección siguen las observaciones, la solicitud se cierra («Se agotaron las oportunidades de corrección») y la persona puede iniciar una nueva. Que el cotejo regrese la solicitud con observaciones no cuenta (ajustes del equipo, 25/10/2026).'),
  ('minutos_bloqueo', '15',
   'Minutos que dura el bloqueo de la entrada al llegar a intentos_maximos; más intentos no lo alargan (D-07, auditoría 2026-10-19) [pendiente: confirmar con el esquema acceso del SIA].');

-- Cupos 5–25 iguales para los cuatro cursos (corrección R23 y R24, 2026-10-14; antes 10–25).
-- Duración (corrección R31): 5 días la primera vez y 1 día la renovación, en poda y en dictaminador.
-- Asistencia mínima, en días (decisión R33): 4 de 5 en los cursos nuevos y 1 de 1 en renovación.
-- Calificación mínima (segunda corrección R34, 2026-10-14): 7.0 poda, 8.0 dictaminador.
-- Pago de derechos: concepto provisional y monto vacío hasta confirmarlos con la Gaceta Oficial [pendiente].
INSERT INTO apd.curso (tipo_acreditacion, modalidad, nombre, dias_duracion, dias_minimos_asistencia, calificacion_minima, cupo_minimo, cupo_maximo, pago_concepto, pago_monto) VALUES
  ('poda',         'nueva',      'Poda y derribo · solicitud nueva',      5, 4, 7.0, 5, 25, 'Acreditación de poda y derribo de arbolado urbano', NULL),
  ('poda',         'renovacion', 'Poda y derribo · renovación',           1, 1, 7.0, 5, 25, 'Renovación de la acreditación de poda y derribo de arbolado urbano', NULL),
  ('dictaminador', 'nueva',      'Dictaminador técnico · solicitud nueva', 5, 4, 8.0, 5, 25, 'Acreditación de dictaminador técnico de arbolado urbano', NULL),
  ('dictaminador', 'renovacion', 'Dictaminador técnico · renovación',      1, 1, 8.0, 5, 25, 'Renovación de la acreditación de dictaminador técnico de arbolado urbano', NULL);

-- Cuota de reposición de la credencial (P140, sesión de trabajo del 23/10/2026): configurable porque cambia cada año. El
-- monto vigente lo confirma Finanzas [pendiente P140]; vacío hasta capturarlo con la publicación que lo fija.
INSERT INTO apd.cuota (clave, concepto, monto) VALUES
  ('reposicion_credencial', 'Reposición de la credencial de acreditación', NULL);

INSERT INTO apd.requisito (clave, nombre, descripcion, forma, momento) VALUES
  ('identificacion_oficial', 'Identificación oficial',
   'Vigente y con fotografía: credencial para votar, pasaporte, cartilla militar o cédula profesional.', 'documento', 'en_linea'),
  ('curp', 'Clave Única de Registro de Población (CURP)',
   'En formato actualizado.', 'documento', 'en_linea'),
  ('comprobante_domicilio', 'Comprobante de domicilio',
   'De luz, agua, telefonía o internet, con antigüedad no mayor a tres meses.', 'documento', 'en_linea'),
  -- La de la persona solicitante, reciente (sesión de trabajo del 23/10/2026, P196): de ella se toman nombre, régimen y
  -- domicilio fiscal para la factura. Cuántos días de antigüedad se aceptan está pendiente (P196): mientras, «del mes en
  -- curso», sin número en la base.
  ('constancia_situacion_fiscal', 'Constancia de situación fiscal',
   'Tuya, como persona solicitante, emitida en el mes en curso. De ella se toman tu nombre, tu régimen y tu domicilio fiscal para la factura del pago. [pendiente P196: cuántos días de antigüedad se aceptan]', 'documento', 'en_linea'),
  ('factura_pago', 'Factura del pago de derechos',
   'La emite la Secretaría en la cita presencial, después de verificar el pago. Su personal carga el PDF y captura RFC, nombre o razón social y folio fiscal. Sin factura no se asigna curso. Concepto y monto del derecho conforme a la Gaceta Oficial [pendiente].', 'documento', 'cotejo'),
  ('poda_anterior', 'Acreditación de poda y derribo a renovar',
   'El sistema la comprueba en su padrón.', 'registro', 'en_linea'),
  ('poda_vigente', 'Acreditación de poda y derribo vigente',
   'El sistema comprueba en su padrón que esté vigente al iniciar la solicitud.', 'registro', 'en_linea'),
  ('dictaminador_anterior', 'Acreditación de dictaminador a renovar',
   'El sistema la comprueba en su padrón.', 'registro', 'en_linea'),
  ('comprobante_estudios', 'Comprobante de estudios',
   'Según la situación de tus estudios: título o cédula profesional (titulado); carta de pasante o constancia de 100 % de créditos (concluido); certificado o título de carrera técnica. Si son varios documentos, escanéalos todos en un solo PDF.', 'documento', 'en_linea'),
  ('curriculum_vitae', 'Currículum vitae',
   'Actualizado, que demuestre la experiencia en manejo de arbolado de acuerdo con el perfil académico.', 'documento', 'en_linea'),
  ('comprobantes_experiencia', 'Comprobantes de experiencia',
   'Constancias laborales, contratos, informes técnicos, actas, registros o constancias de capacitación que acrediten la experiencia en manejo de arbolado urbano. Escanea todos tus comprobantes en un solo PDF.', 'documento', 'en_linea'),
  ('acuse_entrega', 'Comprobante de recepción firmado',
   'El sistema lo imprime al entregar la credencial; la persona lo firma y el personal carga el PDF escaneado.', 'documento', 'entrega');

-- Fotografía de la credencial (decisión 2026-10-14, Liber): se toma en el lugar al entregar y es la que
-- se imprime en la credencial. Sólo imagen. No sustituye a la fotografía de la cuenta (apd.fotografia).
INSERT INTO apd.requisito (clave, nombre, descripcion, forma, momento, formatos) VALUES
  ('foto_credencial', 'Fotografía de la credencial',
   'La toma el personal de la Secretaría en el lugar de entrega; es la que se imprime en la credencial. [pendiente] fondo, tamaño y encuadre.',
   'documento', 'entrega', ARRAY['image/jpeg', 'image/png']);

-- Qué pide cada curso (corrección R46, confirmada por Liber el 2026-10-14): en una renovación sólo es
-- obligatorio lo que cambia en cada trámite (la constancia fiscal y la factura del pago); se actualizan los
-- documentos vencidos o que ya no estén vigentes, y los de estudios o experiencia que la persona quiera. Lo demás se carga sólo si la persona lo
-- actualizó o si ya no está vigente (R46): si ya se le acreditó una vez, la Secretaría ya lo revisó. [pendiente] confirmar con Liber que
-- también aplica a identificación, CURP y domicilio, y qué pasa con quien viene de Kobo sin archivos.
INSERT INTO apd.requisito_curso (tipo_acreditacion, modalidad, requisito, orden, obligatorio, nota) VALUES
  ('poda', 'nueva',      'identificacion_oficial',      1, true, ''),
  ('poda', 'nueva',      'curp',                        2, true, ''),
  ('poda', 'nueva',      'comprobante_domicilio',       3, true, ''),
  ('poda', 'nueva',      'constancia_situacion_fiscal', 4, true, ''),
  ('poda', 'nueva',      'factura_pago',                5, true, ''),
  ('poda', 'renovacion', 'identificacion_oficial',      1, false, 'Sólo si cambió o ya no está vigente.'),
  ('poda', 'renovacion', 'curp',                        2, false, 'Sólo si cambió o ya no está vigente.'),
  ('poda', 'renovacion', 'comprobante_domicilio',       3, false, 'Sólo si cambió o ya no está vigente.'),
  ('poda', 'renovacion', 'constancia_situacion_fiscal', 4, true,  ''),
  ('poda', 'renovacion', 'factura_pago',                5, true,  ''),
  ('poda', 'renovacion', 'poda_anterior',               6, true,  ''),
  ('dictaminador', 'nueva',      'identificacion_oficial',      1, true,  ''),
  ('dictaminador', 'nueva',      'curp',                        2, true,  ''),
  ('dictaminador', 'nueva',      'comprobante_domicilio',       3, true,  ''),
  ('dictaminador', 'nueva',      'constancia_situacion_fiscal', 4, true,  ''),
  ('dictaminador', 'nueva',      'factura_pago',                5, true,  ''),
  -- Y durante al menos dos años consecutivos (sesión de trabajo del 23/10/2026; parámetro anios_poda_dictaminador)
  ('dictaminador', 'nueva',      'poda_vigente',                6, true,  'Y durante al menos dos años consecutivos.'),
  ('dictaminador', 'nueva',      'comprobante_estudios',        7, true,  ''),
  ('dictaminador', 'nueva',      'curriculum_vitae',            8, true,  ''),
  ('dictaminador', 'nueva',      'comprobantes_experiencia',    9, true,  'Dos años con licenciatura titulada en Biología, Ingeniería Forestal, Ingeniería Agrónoma o carrera afín; cinco con carta de pasante, carrera técnica o disciplina afín.'),
  ('dictaminador', 'renovacion', 'identificacion_oficial',      1, false, 'Sólo si cambió o ya no está vigente.'),
  ('dictaminador', 'renovacion', 'curp',                        2, false, 'Sólo si cambió o ya no está vigente.'),
  ('dictaminador', 'renovacion', 'comprobante_domicilio',       3, false, 'Sólo si cambió o ya no está vigente.'),
  ('dictaminador', 'renovacion', 'constancia_situacion_fiscal', 4, true,  ''),
  ('dictaminador', 'renovacion', 'factura_pago',                5, true,  ''),
  ('dictaminador', 'renovacion', 'poda_vigente',                6, true,  ''),
  ('dictaminador', 'renovacion', 'dictaminador_anterior',       7, true,  ''),
  ('dictaminador', 'renovacion', 'comprobante_estudios',        8, false, 'Sólo si actualizaste tus estudios.'),
  ('dictaminador', 'renovacion', 'curriculum_vitae',            9, false, 'Sólo si actualizaste tu experiencia.'),
  ('dictaminador', 'renovacion', 'comprobantes_experiencia',   10, false, 'Sólo si actualizaste tu experiencia.'),
  -- Al entregar (decisiones 2026-10-14): fotografía para la credencial, tomada en el lugar, y firma de recibido
  ('poda', 'nueva',              'foto_credencial',            89, true,  ''),
  ('poda', 'renovacion',         'foto_credencial',            89, true,  ''),
  ('dictaminador', 'nueva',      'foto_credencial',            89, true,  ''),
  ('dictaminador', 'renovacion', 'foto_credencial',            89, true,  ''),
  ('poda', 'nueva',              'acuse_entrega',              90, true,  ''),
  ('poda', 'renovacion',         'acuse_entrega',              90, true,  ''),
  ('dictaminador', 'nueva',      'acuse_entrega',              90, true,  ''),
  ('dictaminador', 'renovacion', 'acuse_entrega',              90, true,  '');

-- Desde aquí, agregar, quitar o cambiar un requisito de un curso queda en la bitácora (E2-04; la función está en
-- 03-apd-reglas.sql). Se crea después del catálogo inicial para que la instalación no llene la bitácora.
CREATE TRIGGER requisito_curso_registrar AFTER INSERT OR UPDATE OR DELETE ON apd.requisito_curso
  FOR EACH ROW EXECUTE FUNCTION apd.requisito_curso_registrar();

-- Instituciones que el formulario ofrece por nombre (decisión 2026-10-15, Liber): las dependencias de la Ciudad
-- y federales de la lista, y las 16 alcaldías de la Ciudad de México. Las demás las agrega la base cuando una
-- persona escribe un nombre nuevo («Otra» o el nombre de su empresa). La clave es la que manda el formulario. En la
-- SEDEMA se registra la Dirección General (sedema_<siglas>), de una lista cerrada.
INSERT INTO apd.organizacion (tipo, clave, nombre) VALUES
  ('dependencia_cdmx',    'sobse',  'Secretaría de Obras y Servicios (SOBSE)'),
  ('dependencia_cdmx',    'sedema', 'Secretaría del Medio Ambiente (SEDEMA)'),
  ('dependencia_cdmx',    'sedema_dgeira', 'SEDEMA · Dirección General de Evaluación de Impacto y Regulación Ambiental (DGEIRA)'),
  ('dependencia_cdmx',    'sedema_dgzcfs', 'SEDEMA · Dirección General de Zoológicos y Conservación de la Fauna Silvestre (DGZCFS)'),
  ('dependencia_cdmx',    'sedema_dgsanpava', 'SEDEMA · Dirección General del Sistema de Áreas Naturales Protegidas y Áreas de Valor Ambiental (DGSANPAVA)'),
  ('dependencia_cdmx',    'sedema_dgcpca', 'SEDEMA · Dirección General de Coordinación de Políticas y Cultura Ambiental (DGCPCA)'),
  ('dependencia_cdmx',    'sedema_dgiva', 'SEDEMA · Dirección General de Vigilancia Ambiental (DGIVA)'),
  ('dependencia_cdmx',    'sedema_dgcorenadr', 'SEDEMA · Dirección General de la Comisión de Recursos Naturales y Desarrollo Rural (DGCORENADR)'),
  ('dependencia_cdmx',    'paot',   'Procuraduría Ambiental y del Ordenamiento Territorial (PAOT)'),
  ('dependencia_federal', 'cfe',    'Comisión Federal de Electricidad (CFE)'),
  ('educativa',           'unam',   'Universidad Nacional Autónoma de México (UNAM)'),
  ('educativa',           'chapingo', 'Universidad Autónoma Chapingo'),   -- sesión de trabajo del 23/10/2026
  ('alcaldia', 'alvaro_obregon',      'Álvaro Obregón'),
  ('alcaldia', 'azcapotzalco',        'Azcapotzalco'),
  ('alcaldia', 'benito_juarez',       'Benito Juárez'),
  ('alcaldia', 'coyoacan',            'Coyoacán'),
  ('alcaldia', 'cuajimalpa',          'Cuajimalpa de Morelos'),
  ('alcaldia', 'cuauhtemoc',          'Cuauhtémoc'),
  ('alcaldia', 'gustavo_a_madero',    'Gustavo A. Madero'),
  ('alcaldia', 'iztacalco',           'Iztacalco'),
  ('alcaldia', 'iztapalapa',          'Iztapalapa'),
  ('alcaldia', 'magdalena_contreras', 'La Magdalena Contreras'),
  ('alcaldia', 'miguel_hidalgo',      'Miguel Hidalgo'),
  ('alcaldia', 'milpa_alta',          'Milpa Alta'),
  ('alcaldia', 'tlahuac',             'Tláhuac'),
  ('alcaldia', 'tlalpan',             'Tlalpan'),
  ('alcaldia', 'venustiano_carranza', 'Venustiano Carranza'),
  ('alcaldia', 'xochimilco',          'Xochimilco');

-- Carreras para la pregunta «¿Qué carrera estudiaste?» (decisión 2026-10-15, Liber). No hay catálogo de carreras afines:
-- la carrera es un campo abierto y el personal la valida en la revisión documental. El catálogo empieza con las que
-- nombran los lineamientos («principal»; Agronomía es la misma carrera que Ingeniería Agrónoma) y crece con las que la
-- Secretaría acepta de manera explícita (afin o disciplina_afin). Sólo las aceptadas se sugieren al escribir; las
-- escritas por las personas entran sin grupo hasta que se clasifican.
INSERT INTO apd.carrera (nombre, grupo) VALUES
  ('Biología',                         'principal'),
  ('Ingeniería Forestal',              'principal'),
  ('Ingeniería Agrónoma',              'principal'),
  ('Agronomía',                        'principal'),
  ('Ciencias Forestales',              'afin');      -- posgrado afín (ejemplo de Liber, 2026-10-15)

-- Cómo se nombra el archivo guardado de cada documento (decisión 2026-10-15, Liber): TIPO DE DOCUMENTO_NOMBRE
-- COMPLETO, p. ej. CURP_ANA EJEMPLO MUESTRA.pdf. Un requisito nuevo sin este dato usa su nombre en mayúsculas.
UPDATE apd.requisito SET nombre_archivo = v.nombre_archivo
  FROM (VALUES ('identificacion_oficial',      'IDENTIFICACION OFICIAL'),
               ('curp',                        'CURP'),
               ('comprobante_domicilio',       'COMPROBANTE DE DOMICILIO'),
               ('constancia_situacion_fiscal', 'CONSTANCIA DE SITUACION FISCAL'),
               ('factura_pago',                'FACTURA'),
               ('comprobante_estudios',        'COMPROBANTE DE ESTUDIOS'),
               ('curriculum_vitae',            'CURRICULUM VITAE'),
               ('comprobantes_experiencia',    'COMPROBANTES DE EXPERIENCIA'),
               ('foto_credencial',             'FOTOGRAFIA CREDENCIAL'),
               ('acuse_entrega',               'COMPROBANTE DE RECEPCION')) AS v (clave, nombre_archivo)
 WHERE apd.requisito.clave = v.clave;

-- Los documentos que carga la persona al solicitar, sólo en PDF (decisión 2026-10-15, Liber). Las fotografías siguen
-- siendo imagen y la factura y el comprobante de recepción ya eran PDF.
UPDATE apd.requisito SET formatos = ARRAY['application/pdf'] WHERE forma = 'documento' AND momento = 'en_linea';
UPDATE apd.requisito SET formatos = ARRAY['application/pdf'] WHERE clave IN ('factura_pago', 'acuse_entrega');

-- Dónde se obtiene un documento (decisión 2026-10-15, Liber): la CURP se consulta y descarga en gob.mx.
UPDATE apd.requisito SET enlace = 'https://www.gob.mx/curp/', enlace_texto = 'Consulta y descarga tu CURP en gob.mx'
 WHERE clave = 'curp';
-- La constancia de situación fiscal se genera en el portal del SAT (decisión de Liber, 25/10/2026): para quien no la tiene.
UPDATE apd.requisito SET enlace = 'https://www.gob.mx/sat/articulos/genera-tu-constancia-de-situacion-fiscal-csf',
       enlace_texto = 'Cómo generar tu constancia de situación fiscal en el SAT'
 WHERE clave = 'constancia_situacion_fiscal';
