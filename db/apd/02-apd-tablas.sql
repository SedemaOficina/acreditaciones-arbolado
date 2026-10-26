-- TABLAS DEL ESQUEMA apd · Sistema de Acreditaciones de Poda y Dictaminación.
-- Archivo generado por herramientas/generar-esquema.mjs desde db/esquema.json. No se edita a mano.
-- Lo corre quien administra la base, dentro de instalar.sql, después de 01-apd-esquema.sql.

CREATE TABLE apd.parametro (
  clave                      text          NOT NULL,
  valor                      text          NOT NULL,
  descripcion                text          NOT NULL,
  actualizado_en             timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT parametro_pk PRIMARY KEY (clave)
);
COMMENT ON TABLE apd.parametro IS 'Valores que gobiernan reglas del sistema y que la administración puede cambiar sin programar. Cada cambio queda en la bitácora.';
COMMENT ON COLUMN apd.parametro.clave IS 'Nombre del parámetro';
COMMENT ON COLUMN apd.parametro.valor IS 'Valor como texto; la regla que lo usa lo convierte';
COMMENT ON COLUMN apd.parametro.descripcion IS 'Qué regla gobierna y en qué unidad';
COMMENT ON COLUMN apd.parametro.actualizado_en IS 'Último cambio';

CREATE TABLE apd.curso (
  tipo_acreditacion          text          NOT NULL,
  modalidad                  text          NOT NULL,
  nombre                     text          NOT NULL,
  dias_duracion              smallint      NOT NULL,
  dias_minimos_asistencia    smallint      NOT NULL,
  calificacion_minima        numeric(3,1)  NOT NULL,
  cupo_minimo                smallint      NOT NULL,
  cupo_maximo                smallint      NOT NULL,
  pago_concepto              text          NOT NULL,
  pago_monto                 numeric(10,2) NULL,
  pago_fundamento            text          NULL,
  pago_vigente_desde         date          NULL,
  activo                     boolean       NOT NULL DEFAULT true,
  actualizado_en             timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT curso_pk PRIMARY KEY (tipo_acreditacion, modalidad),
  CONSTRAINT curso_tipo_ck CHECK (tipo_acreditacion IN ('poda', 'dictaminador')),
  CONSTRAINT curso_modalidad_ck CHECK (modalidad IN ('nueva', 'renovacion')),
  CONSTRAINT curso_dias_ck CHECK (dias_duracion BETWEEN 1 AND 15 AND dias_minimos_asistencia BETWEEN 1 AND dias_duracion),
  CONSTRAINT curso_calificacion_ck CHECK (calificacion_minima BETWEEN 0 AND 10),
  CONSTRAINT curso_cupo_ck CHECK (cupo_minimo >= 1 AND cupo_minimo <= cupo_maximo),
  CONSTRAINT curso_pago_ck CHECK (pago_monto IS NULL OR (pago_monto > 0 AND coalesce(trim(pago_fundamento), '') <> '' AND pago_vigente_desde IS NOT NULL))
);
COMMENT ON TABLE apd.curso IS 'Los cuatro cursos: tipo de acreditación por modalidad. Guarda duración, asistencia mínima, calificación mínima y cupos vigentes; un grupo copia los cupos al crearse.';
COMMENT ON COLUMN apd.curso.tipo_acreditacion IS 'poda o dictaminador';
COMMENT ON COLUMN apd.curso.modalidad IS 'nueva o renovacion';
COMMENT ON COLUMN apd.curso.nombre IS 'Nombre visible del curso';
COMMENT ON COLUMN apd.curso.dias_duracion IS 'Días de curso';
COMMENT ON COLUMN apd.curso.dias_minimos_asistencia IS 'Días de asistencia necesarios para tener derecho a examen (en días, no en porcentaje)';
COMMENT ON COLUMN apd.curso.calificacion_minima IS 'Calificación mínima aprobatoria, de 0 a 10';
COMMENT ON COLUMN apd.curso.cupo_minimo IS 'Personas necesarias para confirmar un grupo';
COMMENT ON COLUMN apd.curso.cupo_maximo IS 'Personas máximas en un grupo';
COMMENT ON COLUMN apd.curso.pago_concepto IS 'Concepto del pago de derechos que se muestra a la persona al asignarle la cita de cotejo';
COMMENT ON COLUMN apd.curso.pago_monto IS 'Monto del pago de derechos de este curso, en pesos. Distinto por curso. Lo actualiza el personal cuando la Gaceta Oficial publica un costo nuevo. Vacío mientras no se capture';
COMMENT ON COLUMN apd.curso.pago_fundamento IS 'Publicación de la Gaceta Oficial que fija el monto vigente (fecha y número). Obligatorio si hay monto';
COMMENT ON COLUMN apd.curso.pago_vigente_desde IS 'Desde cuándo aplica el monto vigente. Obligatorio si hay monto';
COMMENT ON COLUMN apd.curso.activo IS 'Si se pueden abrir grupos de este curso';
COMMENT ON COLUMN apd.curso.actualizado_en IS 'Último cambio';

CREATE TABLE apd.cuota (
  clave                      text          NOT NULL,
  concepto                   text          NOT NULL,
  monto                      numeric(10,2) NULL,
  fundamento                 text          NULL,
  vigente_desde              date          NULL,
  actualizado_en             timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT cuota_pk PRIMARY KEY (clave),
  CONSTRAINT cuota_monto_ck CHECK (monto IS NULL OR (monto > 0 AND coalesce(trim(fundamento), '') <> '' AND vigente_desde IS NOT NULL))
);
COMMENT ON TABLE apd.cuota IS 'Cuotas que no son de un curso: hoy, la reposición de la credencial (P140, sesión de trabajo del 23/10/2026). Como el pago de cada curso: el monto lo actualiza el personal con la publicación que lo fija y desde cuándo aplica (cambia cada año); cada cambio queda en la bitácora.';
COMMENT ON COLUMN apd.cuota.clave IS 'Qué se cobra: reposicion_credencial';
COMMENT ON COLUMN apd.cuota.concepto IS 'Concepto que se muestra a la persona';
COMMENT ON COLUMN apd.cuota.monto IS 'Monto en pesos. Vacío mientras no se capture';
COMMENT ON COLUMN apd.cuota.fundamento IS 'Publicación que fija el monto vigente (fecha y número). Obligatorio si hay monto';
COMMENT ON COLUMN apd.cuota.vigente_desde IS 'Desde cuándo aplica el monto vigente. Obligatorio si hay monto';
COMMENT ON COLUMN apd.cuota.actualizado_en IS 'Último cambio';

CREATE TABLE apd.requisito (
  clave                      text          NOT NULL,
  nombre                     text          NOT NULL,
  descripcion                text          NOT NULL DEFAULT '',
  forma                      text          NOT NULL,
  momento                    text          NOT NULL,
  enlace                     text          NULL,
  enlace_texto               text          NULL,
  nombre_archivo             text          NULL,
  formatos                   text[]        NOT NULL DEFAULT ARRAY['application/pdf', 'image/jpeg', 'image/png']::text[],
  activo                     boolean       NOT NULL DEFAULT true,
  CONSTRAINT requisito_pk PRIMARY KEY (clave),
  CONSTRAINT requisito_forma_ck CHECK (forma IN ('documento', 'registro')),
  CONSTRAINT requisito_momento_ck CHECK (momento IN ('en_linea', 'cotejo', 'entrega')),
  CONSTRAINT requisito_enlace_ck CHECK ((enlace IS NULL) = (enlace_texto IS NULL) AND (enlace IS NULL OR enlace ~ '^https://')),
  CONSTRAINT requisito_nombre_archivo_ck CHECK (nombre_archivo IS NULL OR nombre_archivo ~ '^[A-Z0-9Ñ ]+$'),
  CONSTRAINT requisito_formatos_ck CHECK (cardinality(formatos) > 0 AND formatos <@ ARRAY['application/pdf', 'image/jpeg', 'image/png']::text[])
);
COMMENT ON TABLE apd.requisito IS 'Catálogo de requisitos. Un requisito es un documento que se carga o un registro que el sistema comprueba en su propio padrón.';
COMMENT ON COLUMN apd.requisito.clave IS 'Identificador corto';
COMMENT ON COLUMN apd.requisito.nombre IS 'Nombre visible';
COMMENT ON COLUMN apd.requisito.descripcion IS 'Características que debe cumplir';
COMMENT ON COLUMN apd.requisito.forma IS 'documento: se carga un archivo; registro: el sistema lo comprueba en el padrón';
COMMENT ON COLUMN apd.requisito.momento IS 'en_linea: lo carga la persona al solicitar; cotejo: lo carga el personal de la Secretaría en la cita presencial; entrega: lo carga el personal al entregar la acreditación (comprobante de recepción firmado y fotografía de la credencial)';
COMMENT ON COLUMN apd.requisito.enlace IS 'Dirección oficial donde la persona obtiene el documento (por ejemplo, la CURP en gob.mx); se muestra con el requisito';
COMMENT ON COLUMN apd.requisito.enlace_texto IS 'Texto del enlace';
COMMENT ON COLUMN apd.requisito.nombre_archivo IS 'Tipo de documento con que se nombra el archivo guardado (por ejemplo CURP o IDENTIFICACION OFICIAL), en mayúsculas y sin acentos; si está vacío se usa el nombre del requisito';
COMMENT ON COLUMN apd.requisito.formatos IS 'Tipos de archivo que admite: PDF, JPG o PNG; una fotografía sólo admite imagen';
COMMENT ON COLUMN apd.requisito.activo IS 'Si se pide en solicitudes nuevas';

CREATE TABLE apd.requisito_curso (
  tipo_acreditacion          text          NOT NULL,
  modalidad                  text          NOT NULL,
  requisito                  text          NOT NULL,
  orden                      smallint      NOT NULL,
  obligatorio                boolean       NOT NULL DEFAULT true,
  nota                       text          NOT NULL DEFAULT '',
  CONSTRAINT requisito_curso_pk PRIMARY KEY (tipo_acreditacion, modalidad, requisito),
  CONSTRAINT requisito_curso_curso_fk FOREIGN KEY (tipo_acreditacion, modalidad) REFERENCES apd.curso (tipo_acreditacion, modalidad),
  CONSTRAINT requisito_curso_requisito_fk FOREIGN KEY (requisito) REFERENCES apd.requisito (clave)
);
CREATE INDEX requisito_curso_requisito ON apd.requisito_curso (requisito);
COMMENT ON TABLE apd.requisito_curso IS 'Qué requisitos pide cada curso, en qué orden. Editable: agregar o quitar un documento no requiere programar.';
COMMENT ON COLUMN apd.requisito_curso.tipo_acreditacion IS 'Curso';
COMMENT ON COLUMN apd.requisito_curso.modalidad IS 'Curso';
COMMENT ON COLUMN apd.requisito_curso.requisito IS 'Requisito';
COMMENT ON COLUMN apd.requisito_curso.orden IS 'Orden en que se muestra';
COMMENT ON COLUMN apd.requisito_curso.obligatorio IS 'Si falta, la solicitud no se puede enviar. Los no obligatorios dependen del caso (por ejemplo, los que sólo se actualizan en una renovación) y los valora quien revisa';
COMMENT ON COLUMN apd.requisito_curso.nota IS 'Indicación particular de este curso para el requisito';

CREATE TABLE apd.organizacion (
  id                         uuid          NOT NULL DEFAULT gen_random_uuid(),
  tipo                       text          NOT NULL,
  clave                      text          NULL,
  nombre                     text          NOT NULL,
  nombre_normalizado         text          NOT NULL,
  activa                     boolean       NOT NULL DEFAULT true,
  es_ficticio                boolean       NOT NULL DEFAULT false,
  CONSTRAINT organizacion_pk PRIMARY KEY (id),
  CONSTRAINT organizacion_tipo_ck CHECK (tipo IN ('privada', 'dependencia_cdmx', 'alcaldia', 'dependencia_federal', 'educativa')),
  CONSTRAINT organizacion_clave_uk UNIQUE (clave),
  CONSTRAINT organizacion_nombre_uk UNIQUE (nombre_normalizado)
);
COMMENT ON TABLE apd.organizacion IS 'Catálogo de instituciones de adscripción: empresas, consultorías o particulares; dependencias de la Ciudad de México; alcaldías; dependencias federales; instituciones educativas. Sirve para agrupar la demanda; no inscribe ni paga. Las 16 alcaldías y las dependencias que el formulario ofrece por nombre (SOBSE, SEDEMA y sus Direcciones Generales, PAOT, CFE, UNAM) vienen en el catálogo inicial con su clave; las demás las agrega la base cuando una persona escribe un nombre nuevo.';
COMMENT ON COLUMN apd.organizacion.id IS 'Identificador interno';
COMMENT ON COLUMN apd.organizacion.tipo IS 'privada (persona moral o física: empresa, consultoría o particular), dependencia_cdmx, alcaldia, dependencia_federal o educativa';
COMMENT ON COLUMN apd.organizacion.clave IS 'Clave estable de las que el formulario ofrece como opción (sobse, sedema, paot, cfe, una por alcaldía); vacía en las que se agregan escritas';
COMMENT ON COLUMN apd.organizacion.nombre IS 'Nombre oficial';
COMMENT ON COLUMN apd.organizacion.nombre_normalizado IS 'Nombre sin acentos, en minúsculas y sin espacios dobles; lo calcula la base y evita duplicados como «CFE» y «C.F.E.»';
COMMENT ON COLUMN apd.organizacion.activa IS 'Si aparece al solicitar';
COMMENT ON COLUMN apd.organizacion.es_ficticio IS 'Dato de prueba';

CREATE TABLE apd.carrera (
  id                         uuid          NOT NULL DEFAULT gen_random_uuid(),
  nombre                     text          NOT NULL,
  nombre_normalizado         text          NOT NULL,
  grupo                      text          NULL,
  activa                     boolean       NOT NULL DEFAULT true,
  es_ficticio                boolean       NOT NULL DEFAULT false,
  CONSTRAINT carrera_pk PRIMARY KEY (id),
  CONSTRAINT carrera_grupo_ck CHECK (grupo IN ('principal', 'afin', 'disciplina_afin', 'no_afin')),
  CONSTRAINT carrera_nombre_uk UNIQUE (nombre_normalizado)
);
COMMENT ON TABLE apd.carrera IS 'Catálogo de carreras para la pregunta «¿Qué carrera estudiaste?». No hay catálogo de carreras afines (decisión 2026-10-15, Liber): la carrera es un campo abierto que el personal valida en la revisión documental. Empieza con las que nombran los lineamientos (principal) y crece con las que la Secretaría acepta de manera explícita. El grupo decide la experiencia mínima del dictaminador: principal y afín, dos años con licenciatura; disciplina afín, cinco; no afín, no cumple. Las que escribe una persona entran sin grupo; sólo las aceptadas se sugieren al escribir.';
COMMENT ON COLUMN apd.carrera.id IS 'Identificador interno';
COMMENT ON COLUMN apd.carrera.nombre IS 'Nombre de la carrera';
COMMENT ON COLUMN apd.carrera.nombre_normalizado IS 'Nombre sin acentos, en minúsculas y sin puntuación; lo calcula la base y evita duplicados';
COMMENT ON COLUMN apd.carrera.grupo IS 'principal, afin, disciplina_afin o no_afin; vacío mientras la Secretaría no la clasifica';
COMMENT ON COLUMN apd.carrera.activa IS 'Si aparece en la lista al solicitar';
COMMENT ON COLUMN apd.carrera.es_ficticio IS 'Dato de prueba';

CREATE TABLE apd.solicitante (
  id                         uuid          NOT NULL DEFAULT gen_random_uuid(),
  curp                       text          NOT NULL,
  nombre                     text          NOT NULL,
  primer_apellido            text          NOT NULL,
  segundo_apellido           text          NULL,
  sexo                       text GENERATED ALWAYS AS (substr(curp, 11, 1)) STORED NOT NULL,
  adscripcion                text          NULL,
  organizacion_id            uuid          NULL,
  correo                     text          NOT NULL,
  telefono                   text          NOT NULL,
  numero_expediente          text          NULL,
  contrasena_hash            text          NULL,
  estado                     text          NOT NULL DEFAULT 'activa',
  intentos_fallidos          smallint      NOT NULL DEFAULT 0,
  bloqueada_hasta            timestamptz   NULL,
  bloqueo_motivo             text          NULL,
  debe_cambiar_contrasena    boolean       NOT NULL DEFAULT false,
  creada_en                  timestamptz   NOT NULL DEFAULT now(),
  es_ficticio                boolean       NOT NULL DEFAULT false,
  CONSTRAINT solicitante_pk PRIMARY KEY (id),
  CONSTRAINT solicitante_curp_uk UNIQUE (curp),
  CONSTRAINT solicitante_expediente_uk UNIQUE (numero_expediente),
  CONSTRAINT solicitante_curp_ck CHECK (apd.curp_valida(curp)),
  CONSTRAINT solicitante_correo_ck CHECK (apd.correo_valido(correo)),
  CONSTRAINT solicitante_telefono_ck CHECK (telefono ~ '^[0-9]{10}$'),
  CONSTRAINT solicitante_organizacion_fk FOREIGN KEY (organizacion_id) REFERENCES apd.organizacion (id),
  CONSTRAINT solicitante_adscripcion_ck CHECK (adscripcion IN ('independiente', 'privada', 'dependencia_cdmx', 'alcaldia', 'dependencia_federal', 'educativa')),
  CONSTRAINT solicitante_adscripcion_organizacion_ck CHECK ((organizacion_id IS NULL) = (adscripcion IS NULL OR adscripcion = 'independiente')),
  CONSTRAINT solicitante_adscripcion_activa_ck CHECK (estado = 'sin_activar' OR adscripcion IS NOT NULL),
  CONSTRAINT solicitante_estado_ck CHECK (estado IN ('activa', 'bloqueada', 'inactiva', 'sin_activar')),
  CONSTRAINT solicitante_bloqueo_ck CHECK (bloqueo_motivo IS NULL OR (bloqueo_motivo = 'identidad' AND estado = 'bloqueada')),
  CONSTRAINT solicitante_contrasena_ck CHECK ((estado = 'sin_activar') = (contrasena_hash IS NULL))
);
CREATE INDEX solicitante_apellidos ON apd.solicitante (primer_apellido, segundo_apellido, nombre);
CREATE UNIQUE INDEX solicitante_correo_uk ON apd.solicitante (correo) WHERE estado <> 'sin_activar';
CREATE INDEX solicitante_organizacion ON apd.solicitante (organizacion_id);
COMMENT ON TABLE apd.solicitante IS 'Cuenta de la persona solicitante. Una por CURP, con su fotografía de frente (apd.fotografia) y con un solo expediente físico para todos sus trámites. La contraseña se guarda derivada con scrypt (parámetros de acceso), nunca en claro. Las personas del padrón migrado quedan sin activar hasta que se registran con su CURP.';
COMMENT ON COLUMN apd.solicitante.id IS 'Identificador interno';
COMMENT ON COLUMN apd.solicitante.curp IS 'CURP en mayúsculas; identificador único de la cuenta';
COMMENT ON COLUMN apd.solicitante.nombre IS 'Nombre(s)';
COMMENT ON COLUMN apd.solicitante.primer_apellido IS 'Primer apellido';
COMMENT ON COLUMN apd.solicitante.segundo_apellido IS 'Segundo apellido, si lo hay';
COMMENT ON COLUMN apd.solicitante.sexo IS 'H, M o X: se toma de la posición 11 de la CURP (no se pide aparte); para la estadística de la población acreditada';
COMMENT ON COLUMN apd.solicitante.adscripcion IS 'Adscripción vigente de la persona: independiente, privada, dependencia_cdmx, alcaldia, dependencia_federal o educativa. La captura al crear su cuenta y la cambia en «Mi perfos»; vacía sólo en cuentas del padrón migrado sin activar';
COMMENT ON COLUMN apd.solicitante.organizacion_id IS 'Institución de adscripción vigente, del catálogo y de su mismo tipo; vacía si es independiente';
COMMENT ON COLUMN apd.solicitante.correo IS 'Correo de contacto, en minúsculas. No se repite entre cuentas activas: un correo, una cuenta (decisión 2026-10-17, Liber); el del registro anterior sin activar no cuenta';
COMMENT ON COLUMN apd.solicitante.telefono IS 'Teléfono de contacto, 10 dígitos';
COMMENT ON COLUMN apd.solicitante.numero_expediente IS 'Expediente físico de la persona: uno por CURP, para todos sus trámites. Lo asigna la base al concluir su primer cotejo presencial, consecutivo por año y sin huecos. Formato provisional EXP-AAAA-NNNN';
COMMENT ON COLUMN apd.solicitante.contrasena_hash IS 'scrypt N=2^14, r=8, p=1, base64url. Vacía sólo en cuentas sin activar';
COMMENT ON COLUMN apd.solicitante.estado IS 'activa, bloqueada, inactiva o sin_activar (persona del padrón migrado que aún no crea su contraseña)';
COMMENT ON COLUMN apd.solicitante.intentos_fallidos IS 'Intentos de entrada fallidos seguidos. Lo lleva apd.anotar_intento(); el acceso correcto lo vuelve a 0 (apd.acceso_correcto)';
COMMENT ON COLUMN apd.solicitante.bloqueada_hasta IS 'Fin del bloqueo por intentos: lo pone la base al llegar a intentos_maximos, por minutos_bloqueo minutos (parámetros); poner o quitar un bloqueo queda en la bitácora';
COMMENT ON COLUMN apd.solicitante.bloqueo_motivo IS 'identidad: en su cita de cotejo no era la persona de la fotografía ni de la identificación; la cuenta queda bloqueada sin fecha de fin hasta que la Dirección lo aclare (decisión 2026-10-17, Liber). Lo pone la base';
COMMENT ON COLUMN apd.solicitante.debe_cambiar_contrasena IS 'Tiene una contraseña temporal de un solo uso';
COMMENT ON COLUMN apd.solicitante.creada_en IS 'Alta de la cuenta';
COMMENT ON COLUMN apd.solicitante.es_ficticio IS 'Dato de prueba';

CREATE TABLE apd.fotografia (
  id                         uuid          NOT NULL DEFAULT gen_random_uuid(),
  solicitante_id             uuid          NOT NULL,
  archivo_clave              text          NOT NULL,
  tipo_mime                  text          NOT NULL,
  tamano_bytes               integer       NOT NULL,
  sha256                     text          NOT NULL,
  nombre_archivo             text          NOT NULL DEFAULT '',
  origen                     text          NOT NULL,
  estado                     text          NOT NULL DEFAULT 'pendiente',
  vigente                    boolean       NOT NULL DEFAULT true,
  cargada_en                 timestamptz   NOT NULL DEFAULT now(),
  cargada_por                text          NOT NULL DEFAULT '',
  confirmada_por             text          NULL,
  confirmada_en              timestamptz   NULL,
  CONSTRAINT fotografia_pk PRIMARY KEY (id),
  CONSTRAINT fotografia_archivo_uk UNIQUE (archivo_clave),
  CONSTRAINT fotografia_solicitante_fk FOREIGN KEY (solicitante_id) REFERENCES apd.solicitante (id),
  CONSTRAINT fotografia_mime_ck CHECK (tipo_mime IN ('image/jpeg', 'image/png')),
  CONSTRAINT fotografia_tamano_ck CHECK (tamano_bytes > 0),
  CONSTRAINT fotografia_sha256_ck CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT fotografia_origen_ck CHECK (origen IN ('en_linea', 'cotejo')),
  CONSTRAINT fotografia_estado_ck CHECK (estado IN ('pendiente', 'confirmada')),
  CONSTRAINT fotografia_confirmada_ck CHECK ((estado = 'confirmada') = (confirmada_por IS NOT NULL AND confirmada_en IS NOT NULL))
);
CREATE UNIQUE INDEX fotografia_una_vigente ON apd.fotografia (solicitante_id) WHERE vigente;
CREATE INDEX fotografia_solicitante ON apd.fotografia (solicitante_id, cargada_en);
COMMENT ON TABLE apd.fotografia IS 'Fotografía de frente de la persona, para reconocerla en la cita de cotejo y en el curso; quien aplica el examen la usa para confirmar su identidad y su asistencia, por eso debe verse clara. La carga ella al crear su cuenta; en el cotejo el personal confirma que corresponde a quien se presenta (en la cita no se toma otra). No es la foto de la credencial: esa se toma al entregar la acreditación y se guarda como documento de la solicitud. El archivo vive en el almacén, fuera de lo publicado; aquí sólo su clave. Una nueva carga no borra la anterior: la marca como no vigente.';
COMMENT ON COLUMN apd.fotografia.id IS 'Identificador interno';
COMMENT ON COLUMN apd.fotografia.solicitante_id IS 'Persona';
COMMENT ON COLUMN apd.fotografia.archivo_clave IS 'Clave exacta en el almacén, con sello propio';
COMMENT ON COLUMN apd.fotografia.tipo_mime IS 'image/jpeg o image/png';
COMMENT ON COLUMN apd.fotografia.tamano_bytes IS 'Tamaño; el máximo lo fija el parámetro tamano_maximo_archivo_bytes';
COMMENT ON COLUMN apd.fotografia.sha256 IS 'Suma del archivo, para comprobar el almacén';
COMMENT ON COLUMN apd.fotografia.nombre_archivo IS 'Nombre con que se guarda y se descarga: FOTOGRAFIA_NOMBRE COMPLETO.ext. Lo pone la base al cargarla';
COMMENT ON COLUMN apd.fotografia.origen IS 'en_linea: la cargó la persona; cotejo: la cargó el personal frente a ella (hoy sin pantalla: cómo se actualiza una fotografía confirmada, P100). Lo pone la base';
COMMENT ON COLUMN apd.fotografia.estado IS 'pendiente: aún no la confirma nadie; confirmada: el personal comprobó en persona, contra la identificación oficial, que corresponde a quien se presentó';
COMMENT ON COLUMN apd.fotografia.vigente IS 'Es la última fotografía de la persona';
COMMENT ON COLUMN apd.fotografia.cargada_en IS 'Carga';
COMMENT ON COLUMN apd.fotografia.cargada_por IS 'Quién la cargó: la persona o la cuenta del personal; lo pone la base';
COMMENT ON COLUMN apd.fotografia.confirmada_por IS 'Cuenta del personal que la confirmó (acceso)';
COMMENT ON COLUMN apd.fotografia.confirmada_en IS 'Confirmación';

CREATE TABLE apd.sesion_solicitante (
  id                         uuid          NOT NULL DEFAULT gen_random_uuid(),
  solicitante_id             uuid          NOT NULL,
  testigo_sha256             text          NOT NULL,
  creada_en                  timestamptz   NOT NULL DEFAULT now(),
  vence_en                   timestamptz   NOT NULL,
  cerrada_en                 timestamptz   NULL,
  CONSTRAINT sesion_solicitante_pk PRIMARY KEY (id),
  CONSTRAINT sesion_solicitante_testigo_uk UNIQUE (testigo_sha256),
  CONSTRAINT sesion_solicitante_solicitante_fk FOREIGN KEY (solicitante_id) REFERENCES apd.solicitante (id)
);
CREATE INDEX sesion_solicitante_solicitante ON apd.sesion_solicitante (solicitante_id);
COMMENT ON TABLE apd.sesion_solicitante IS 'Sesiones de las personas solicitantes. Sólo se guarda el resumen sha256 del testigo, nunca el testigo.';
COMMENT ON COLUMN apd.sesion_solicitante.id IS 'Identificador interno';
COMMENT ON COLUMN apd.sesion_solicitante.solicitante_id IS 'Cuenta';
COMMENT ON COLUMN apd.sesion_solicitante.testigo_sha256 IS 'Resumen sha256 del testigo de 32 bytes';
COMMENT ON COLUMN apd.sesion_solicitante.creada_en IS 'Inicio';
COMMENT ON COLUMN apd.sesion_solicitante.vence_en IS 'Vencimiento';
COMMENT ON COLUMN apd.sesion_solicitante.cerrada_en IS 'Cierre: salida, cambio de contraseña o desactivación';

CREATE TABLE apd.acreditacion (
  id                         uuid          NOT NULL DEFAULT gen_random_uuid(),
  numero                     text          NOT NULL,
  solicitante_id             uuid          NOT NULL,
  tipo_acreditacion          text          NOT NULL,
  solicitud_id               uuid          NULL,
  emitida_en                 date          NOT NULL,
  vence_en                   date          NOT NULL,
  entregada_en               date          NULL,
  cancelada_en               timestamptz   NULL,
  cancelacion_motivo         text          NULL,
  cancelacion_fundamento     text          NULL,
  cancelada_por              text          NULL,
  origen                     text          NOT NULL DEFAULT 'sistema',
  folio_origen               text          NULL,
  es_ficticio                boolean       NOT NULL DEFAULT false,
  CONSTRAINT acreditacion_pk PRIMARY KEY (id),
  CONSTRAINT acreditacion_numero_uk UNIQUE (numero),
  CONSTRAINT acreditacion_solicitante_fk FOREIGN KEY (solicitante_id) REFERENCES apd.solicitante (id),
  CONSTRAINT acreditacion_tipo_ck CHECK (tipo_acreditacion IN ('poda', 'dictaminador')),
  CONSTRAINT acreditacion_origen_ck CHECK (origen IN ('sistema', 'kobo', 'papel')),
  CONSTRAINT acreditacion_origen_solicitud_ck CHECK ((origen = 'sistema') = (solicitud_id IS NOT NULL)),
  CONSTRAINT acreditacion_fechas_ck CHECK (vence_en > emitida_en AND (entregada_en IS NULL OR entregada_en >= emitida_en)),
  CONSTRAINT acreditacion_numero_serie_ck CHECK ((origen = 'sistema') = (numero ~ '^(PD|DT)-[0-9]{4}-[0-9]{4}$')),
  CONSTRAINT acreditacion_cancelacion_ck CHECK ((cancelada_en IS NULL) = (cancelada_por IS NULL) AND (cancelada_en IS NULL) = (cancelacion_motivo IS NULL) AND (cancelada_en IS NULL) = (cancelacion_fundamento IS NULL))
);
CREATE INDEX acreditacion_titular ON apd.acreditacion (solicitante_id, tipo_acreditacion, vence_en DESC);
CREATE INDEX acreditacion_vence ON apd.acreditacion (vence_en);
COMMENT ON TABLE apd.acreditacion IS 'Padrón de acreditaciones emitidas, del sistema o migradas de Kobo o papel. Su estado de vigencia no se guarda: lo calcula apd.estado_acreditacion() con la fecha del día. Una cancelada (P120, sesión de trabajo del 23/10/2026) lo está desde su cancelada_en: ya no es vigente, no se renueva ni sirve de requisito. La credencial se repone sin cambiar la acreditación (apd.reposicion).';
COMMENT ON COLUMN apd.acreditacion.id IS 'Identificador interno';
COMMENT ON COLUMN apd.acreditacion.numero IS 'Número impreso en la credencial; lo asigna la base si no se migra (serie PD-AAAA-NNNN o DT-AAAA-NNNN, formato provisional: Liber lo definirá). Una migrada conserva el suyo, que nunca tiene la forma de la serie del sistema, para que no choque con una emisión';
COMMENT ON COLUMN apd.acreditacion.solicitante_id IS 'Titular';
COMMENT ON COLUMN apd.acreditacion.tipo_acreditacion IS 'poda o dictaminador';
COMMENT ON COLUMN apd.acreditacion.solicitud_id IS 'Solicitud que la originó; vacía si se migró';
COMMENT ON COLUMN apd.acreditacion.emitida_en IS 'Fecha de emisión (Ciudad de México)';
COMMENT ON COLUMN apd.acreditacion.vence_en IS 'Último día de vigencia: un año después de la emisión, menos un día. Lo calcula la base';
COMMENT ON COLUMN apd.acreditacion.entregada_en IS 'Entrega en persona';
COMMENT ON COLUMN apd.acreditacion.cancelada_en IS 'Cancelación de la acreditación (P120): desde ese día no es vigente. La pone la base al registrar el motivo y el fundamento';
COMMENT ON COLUMN apd.acreditacion.cancelacion_motivo IS 'Por qué se canceló, al menos 10 caracteres. Lo lee la persona en «Mis trámites»; «Verificar» no lo muestra';
COMMENT ON COLUMN apd.acreditacion.cancelacion_fundamento IS 'Fundamento de la cancelación: lineamientos y artículo, mientras los fije la Dirección Jurídica escrito como «[Art. __, fracc. __]» (P120)';
COMMENT ON COLUMN apd.acreditacion.cancelada_por IS 'Cuenta del personal que la canceló (acceso), con perfil instructor o administración (parámetro perfiles_cancelan_acreditacion). La pone la base';
COMMENT ON COLUMN apd.acreditacion.origen IS 'sistema, kobo o papel';
COMMENT ON COLUMN apd.acreditacion.folio_origen IS 'Folio en el sistema de origen, para las migradas';
COMMENT ON COLUMN apd.acreditacion.es_ficticio IS 'Dato de prueba';

CREATE TABLE apd.reposicion (
  id                         uuid          NOT NULL DEFAULT gen_random_uuid(),
  acreditacion_id            uuid          NOT NULL,
  motivo                     text          NOT NULL,
  acta_archivo_clave         text          NOT NULL,
  acta_nombre_original       text          NOT NULL,
  acta_nombre_archivo        text          NOT NULL DEFAULT '',
  acta_tipo_mime             text          NOT NULL,
  acta_tamano_bytes          integer       NOT NULL,
  acta_sha256                text          NOT NULL,
  estado                     text          NOT NULL DEFAULT 'solicitada',
  estado_desde               timestamptz   NOT NULL DEFAULT now(),
  observacion                text          NOT NULL DEFAULT '',
  solicitada_en              timestamptz   NOT NULL DEFAULT now(),
  revisada_por               text          NULL,
  revisada_en                timestamptz   NULL,
  pago_monto                 numeric(10,2) NULL,
  factura_rfc                text          NULL,
  factura_razon_social       text          NULL,
  factura_folio_fiscal       text          NULL,
  repuesta_en                date          NULL,
  repuesta_por               text          NULL,
  es_ficticio                boolean       NOT NULL DEFAULT false,
  CONSTRAINT reposicion_pk PRIMARY KEY (id),
  CONSTRAINT reposicion_acreditacion_fk FOREIGN KEY (acreditacion_id) REFERENCES apd.acreditacion (id),
  CONSTRAINT reposicion_acta_uk UNIQUE (acta_archivo_clave),
  CONSTRAINT reposicion_motivo_ck CHECK (motivo IN ('perdida', 'robo')),
  CONSTRAINT reposicion_estado_ck CHECK (estado IN ('solicitada', 'con_observaciones', 'acta_aceptada', 'repuesta', 'cancelada')),
  CONSTRAINT reposicion_mime_ck CHECK (acta_tipo_mime IN ('application/pdf', 'image/jpeg', 'image/png')),
  CONSTRAINT reposicion_tamano_ck CHECK (acta_tamano_bytes > 0),
  CONSTRAINT reposicion_sha256_ck CHECK (acta_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT reposicion_observacion_ck CHECK (estado NOT IN ('con_observaciones', 'cancelada') OR length(trim(observacion)) > 0),
  CONSTRAINT reposicion_factura_rfc_ck CHECK (factura_rfc IS NULL OR apd.rfc_valido(factura_rfc)),
  CONSTRAINT reposicion_folio_fiscal_ck CHECK (factura_folio_fiscal IS NULL OR factura_folio_fiscal ~ '^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$'),
  CONSTRAINT reposicion_repuesta_ck CHECK ((estado = 'repuesta') = (repuesta_en IS NOT NULL AND repuesta_por IS NOT NULL AND factura_rfc IS NOT NULL AND coalesce(trim(factura_razon_social), '') <> '' AND factura_folio_fiscal IS NOT NULL)),
  CONSTRAINT reposicion_revisada_ck CHECK (estado IN ('solicitada', 'cancelada') OR (revisada_por IS NOT NULL AND revisada_en IS NOT NULL))
);
CREATE UNIQUE INDEX reposicion_una_abierta ON apd.reposicion (acreditacion_id) WHERE estado IN ('solicitada', 'con_observaciones', 'acta_aceptada');
CREATE UNIQUE INDEX reposicion_folio_fiscal_uk ON apd.reposicion (factura_folio_fiscal) WHERE factura_folio_fiscal IS NOT NULL;
CREATE INDEX reposicion_acreditacion ON apd.reposicion (acreditacion_id, solicitada_en);
COMMENT ON TABLE apd.reposicion IS 'Reposición de la credencial de una acreditación vigente por pérdida o robo (P140, sesión de trabajo del 23/10/2026). La persona la pide desde «Mis trámites» con el acta que levantó; el personal revisa el acta (la acepta o le pone observaciones), y en el Vivero valida la factura de la cuota de reposición y entrega la credencial repuesta. La acreditación no cambia: mismo número, misma emisión y misma vigencia. El acta vive en el almacén, fuera de lo publicado; aquí sólo su clave. Sus cambios de estado los valida la base y quedan en la bitácora.';
COMMENT ON COLUMN apd.reposicion.id IS 'Identificador interno';
COMMENT ON COLUMN apd.reposicion.acreditacion_id IS 'Acreditación cuya credencial se repone';
COMMENT ON COLUMN apd.reposicion.motivo IS 'perdida o robo';
COMMENT ON COLUMN apd.reposicion.acta_archivo_clave IS 'Clave exacta del acta en el almacén, con sello propio. Al corregir, la nueva sustituye a la anterior (la bitácora conserva la anterior)';
COMMENT ON COLUMN apd.reposicion.acta_nombre_original IS 'Nombre con que se cargó';
COMMENT ON COLUMN apd.reposicion.acta_nombre_archivo IS 'Nombre con que se guarda y se descarga: ACTA DE PERDIDA O ROBO_NOMBRE COMPLETO.ext. Lo pone la base';
COMMENT ON COLUMN apd.reposicion.acta_tipo_mime IS 'application/pdf, image/jpeg o image/png';
COMMENT ON COLUMN apd.reposicion.acta_tamano_bytes IS 'Tamaño; el máximo lo fija el parámetro tamano_maximo_archivo_bytes';
COMMENT ON COLUMN apd.reposicion.acta_sha256 IS 'Suma del archivo, para comprobar el almacén';
COMMENT ON COLUMN apd.reposicion.estado IS 'solicitada (el acta está en revisión), con_observaciones (la persona carga otra acta), acta_aceptada (paga la cuota y recoge la credencial en el Vivero), repuesta o cancelada. Ver apd.reposicion_cambio()';
COMMENT ON COLUMN apd.reposicion.estado_desde IS 'Desde cuándo está en el estado actual; lo pone la base';
COMMENT ON COLUMN apd.reposicion.observacion IS 'Con observaciones: qué corregir del acta (lo ve la persona). Cancelada: por qué';
COMMENT ON COLUMN apd.reposicion.solicitada_en IS 'Cuándo la pidió la persona; lo pone la base';
COMMENT ON COLUMN apd.reposicion.revisada_por IS 'Cuenta del personal que revisó el acta (acceso). Lo pone la base';
COMMENT ON COLUMN apd.reposicion.revisada_en IS 'Revisión del acta. Lo pone la base';
COMMENT ON COLUMN apd.reposicion.pago_monto IS 'Monto de la cuota que se le indicó a la persona al aceptar su acta: el vigente ese día (apd.cuota). Un cambio posterior no lo altera. Lo pone la base';
COMMENT ON COLUMN apd.reposicion.factura_rfc IS 'RFC de la factura de la cuota; lo captura el personal en el Vivero al entregar la credencial';
COMMENT ON COLUMN apd.reposicion.factura_razon_social IS 'Nombre o razón social de la factura; lo captura el personal al entregar';
COMMENT ON COLUMN apd.reposicion.factura_folio_fiscal IS 'Folio fiscal (UUID) de la factura; no se repite con el de otra reposición ni el de una solicitud';
COMMENT ON COLUMN apd.reposicion.repuesta_en IS 'Entrega de la credencial repuesta (Ciudad de México). Lo pone la base';
COMMENT ON COLUMN apd.reposicion.repuesta_por IS 'Cuenta del personal que la entregó. Lo pone la base';
COMMENT ON COLUMN apd.reposicion.es_ficticio IS 'Dato de prueba';

CREATE TABLE apd.solicitud (
  id                         uuid          NOT NULL DEFAULT gen_random_uuid(),
  folio                      text          NOT NULL,
  solicitante_id             uuid          NOT NULL,
  tipo_acreditacion          text          NOT NULL,
  modalidad                  text          NOT NULL,
  adscripcion                text          NULL,
  organizacion_id            uuid          NULL,
  acreditacion_anterior_id   uuid          NULL,
  factura_rfc                text          NULL,
  factura_razon_social       text          NULL,
  factura_folio_fiscal       text          NULL,
  nivel_estudios             text          NULL,
  carrera                    text          NULL,
  carrera_id                 uuid          NULL,
  carrera_tecnica            text          NULL,
  estatus_estudios           text          NULL,
  perfil_academico           text          NULL,
  experiencia_minima         numeric(3,1)  NULL,
  anios_experiencia          numeric(4,1)  NULL,
  estado                     text          NOT NULL DEFAULT 'borrador',
  estado_desde               timestamptz   NOT NULL DEFAULT now(),
  enviada_en                 timestamptz   NULL,
  cita_en                    timestamptz   NULL,
  pago_monto                 numeric(10,2) NULL,
  pago_referencia            text          NULL,
  lista_para_curso_en        timestamptz   NULL,
  motivo_cierre              text          NULL,
  folio_origen               text          NULL,
  creada_en                  timestamptz   NOT NULL DEFAULT now(),
  es_ficticio                boolean       NOT NULL DEFAULT false,
  CONSTRAINT solicitud_pk PRIMARY KEY (id),
  CONSTRAINT solicitud_folio_uk UNIQUE (folio),
  CONSTRAINT solicitud_pago_referencia_uk UNIQUE (pago_referencia),
  CONSTRAINT solicitud_pago_referencia_ck CHECK (estado NOT IN ('validada_en_linea', 'lista_para_curso', 'inscrita', 'aprobada', 'acreditada', 'no_acreditada', 'sin_derecho_examen') OR pago_referencia IS NOT NULL),
  CONSTRAINT solicitud_solicitante_fk FOREIGN KEY (solicitante_id) REFERENCES apd.solicitante (id),
  CONSTRAINT solicitud_curso_fk FOREIGN KEY (tipo_acreditacion, modalidad) REFERENCES apd.curso (tipo_acreditacion, modalidad),
  CONSTRAINT solicitud_organizacion_fk FOREIGN KEY (organizacion_id) REFERENCES apd.organizacion (id),
  CONSTRAINT solicitud_adscripcion_ck CHECK (adscripcion IN ('independiente', 'privada', 'dependencia_cdmx', 'alcaldia', 'dependencia_federal', 'educativa')),
  CONSTRAINT solicitud_adscripcion_organizacion_ck CHECK ((organizacion_id IS NULL) = (adscripcion IS NULL OR adscripcion = 'independiente')),
  CONSTRAINT solicitud_anterior_fk FOREIGN KEY (acreditacion_anterior_id) REFERENCES apd.acreditacion (id),
  CONSTRAINT solicitud_estado_ck CHECK (estado IN ('borrador', 'enviada', 'con_observaciones', 'validada_en_linea', 'lista_para_curso', 'inscrita', 'aprobada', 'acreditada', 'no_acreditada', 'sin_derecho_examen', 'cancelada', 'concluida_sin_atender', 'rechazada')),
  CONSTRAINT solicitud_renovacion_ck CHECK ((modalidad = 'renovacion') = (acreditacion_anterior_id IS NOT NULL)),
  CONSTRAINT solicitud_factura_folio_uk UNIQUE (factura_folio_fiscal),
  CONSTRAINT solicitud_factura_rfc_ck CHECK (factura_rfc IS NULL OR apd.rfc_valido(factura_rfc)),
  CONSTRAINT solicitud_factura_folio_ck CHECK (factura_folio_fiscal IS NULL OR factura_folio_fiscal ~ '^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$'),
  CONSTRAINT solicitud_nivel_ck CHECK (nivel_estudios IN ('ninguna', 'preescolar', 'primaria', 'secundaria', 'preparatoria', 'tecnica', 'licenciatura', 'maestria', 'doctorado')),
  CONSTRAINT solicitud_estatus_ck CHECK (estatus_estudios IN ('en_curso', 'trunco', 'concluido', 'titulado')),
  CONSTRAINT solicitud_carrera_fk FOREIGN KEY (carrera_id) REFERENCES apd.carrera (id),
  CONSTRAINT solicitud_perfil_ck CHECK (perfil_academico IN ('licenciatura_afin', 'disciplina_afin', 'pasante', 'tecnica', 'por_clasificar', 'no_cumple')),
  CONSTRAINT solicitud_perfil_tipo_ck CHECK (tipo_acreditacion = 'dictaminador' OR (perfil_academico IS NULL AND anios_experiencia IS NULL)),
  CONSTRAINT solicitud_experiencia_ck CHECK (anios_experiencia IS NULL OR anios_experiencia BETWEEN 0 AND 70),
  CONSTRAINT solicitud_cierre_ck CHECK (estado NOT IN ('cancelada', 'concluida_sin_atender', 'rechazada') OR length(trim(coalesce(motivo_cierre, ''))) > 0)
);
CREATE UNIQUE INDEX solicitud_una_activa ON apd.solicitud (solicitante_id, tipo_acreditacion) WHERE estado NOT IN ('acreditada', 'no_acreditada', 'sin_derecho_examen', 'cancelada', 'concluida_sin_atender', 'rechazada');
CREATE INDEX solicitud_bandeja ON apd.solicitud (tipo_acreditacion, modalidad, estado, lista_para_curso_en);
CREATE INDEX solicitud_organizacion ON apd.solicitud (organizacion_id);
CREATE INDEX solicitud_anterior ON apd.solicitud (acreditacion_anterior_id);
CREATE INDEX solicitud_revision ON apd.solicitud (estado, estado_desde);
CREATE INDEX solicitud_persona ON apd.solicitud (solicitante_id, creada_en);
CREATE INDEX solicitud_carrera ON apd.solicitud (carrera_id);
COMMENT ON TABLE apd.solicitud IS 'Un trámite: una persona, un curso. El expediente físico es de la persona (apd.solicitante.numero_expediente), no del trámite. Sus cambios de estado los valida la base y quedan en la bitácora.';
COMMENT ON COLUMN apd.solicitud.id IS 'Identificador interno';
COMMENT ON COLUMN apd.solicitud.folio IS 'Folio público; lo asigna la base (APD-S-AAAA-NNNNN)';
COMMENT ON COLUMN apd.solicitud.solicitante_id IS 'Persona solicitante';
COMMENT ON COLUMN apd.solicitud.tipo_acreditacion IS 'Curso solicitado';
COMMENT ON COLUMN apd.solicitud.modalidad IS 'Curso solicitado';
COMMENT ON COLUMN apd.solicitud.adscripcion IS 'Adscripción que la persona tenía al enviar la solicitud (copia de la de su cuenta; la pone la base en el alta y en cada envío): independiente, privada, dependencia_cdmx, alcaldia, dependencia_federal o educativa';
COMMENT ON COLUMN apd.solicitud.organizacion_id IS 'Institución de adscripción al enviar (copia de la de su cuenta); vacía si es independiente';
COMMENT ON COLUMN apd.solicitud.acreditacion_anterior_id IS 'Acreditación que se renueva; obligatoria en renovación';
COMMENT ON COLUMN apd.solicitud.factura_rfc IS 'RFC a cuyo favor se emitió la factura del pago; lo captura el personal en el cotejo';
COMMENT ON COLUMN apd.solicitud.factura_razon_social IS 'Nombre o razón social a cuyo favor se emitió la factura; lo captura el personal en el cotejo';
COMMENT ON COLUMN apd.solicitud.factura_folio_fiscal IS 'Folio fiscal (UUID) de la factura, para seguimiento; lo captura el personal en el cotejo';
COMMENT ON COLUMN apd.solicitud.nivel_estudios IS 'Último nivel o grado de estudios, en poda y en dictaminador (ninguna, preescolar, primaria, secundaria, preparatoria, tecnica, licenciatura, maestria, doctorado). En poda es dato del padrón; en dictaminador, requisito';
COMMENT ON COLUMN apd.solicitud.carrera IS 'Con licenciatura o posgrado, en poda y en dictaminador: la carrera que estudió, elegida del catálogo o escrita';
COMMENT ON COLUMN apd.solicitud.carrera_id IS 'Carrera en el catálogo apd.carrera; la pone la base (si la escrita no existe, la agrega sin grupo)';
COMMENT ON COLUMN apd.solicitud.carrera_tecnica IS 'Con carrera técnica, en poda y en dictaminador: el nombre de la carrera técnica, escrito; sin catálogo (decisión 2026-10-17, Liber)';
COMMENT ON COLUMN apd.solicitud.estatus_estudios IS 'Sólo en dictaminador con licenciatura (en poda no se pregunta ni se guarda: sesión de trabajo del 23/10/2026): situación de ese grado (en_curso, trunco, concluido —carta de pasante o 100 % de créditos— o titulado). Con posgrado no se pregunta: se asume la licenciatura titulada (decisión 2026-10-18)';
COMMENT ON COLUMN apd.solicitud.perfil_academico IS 'Lo calcula la base con nivel, estatus y grupo de la carrera (apd.perfil_academico): licenciatura_afin, disciplina_afin, pasante, tecnica, por_clasificar o no_cumple. No impide enviar: el personal lo revisa en la revisión documental';
COMMENT ON COLUMN apd.solicitud.experiencia_minima IS 'Años de experiencia que pide el perfil; la calcula la base: 2 con licenciatura o posgrado en carrera principal o afín; 5 en todo lo demás, también cuando lo decide el personal (por clasificar o no cumple)';
COMMENT ON COLUMN apd.solicitud.anios_experiencia IS 'Sólo dictaminador: años de experiencia en manejo de arbolado declarados; los documentos los comprueban';
COMMENT ON COLUMN apd.solicitud.estado IS 'Ver apd.transicion_solicitud()';
COMMENT ON COLUMN apd.solicitud.estado_desde IS 'Desde cuándo está en el estado actual; lo pone la base';
COMMENT ON COLUMN apd.solicitud.enviada_en IS 'Primer envío a revisión; lo pone la base';
COMMENT ON COLUMN apd.solicitud.cita_en IS 'Cita para el cotejo presencial';
COMMENT ON COLUMN apd.solicitud.pago_monto IS 'Monto que se le indicó a la persona al darle su cita: el vigente en ese momento. Un cambio de costo posterior no lo altera. Vacío si aún no había monto capturado';
COMMENT ON COLUMN apd.solicitud.pago_referencia IS 'Referencia del pago de derechos que se da a la persona con su cita. La asigna la base al validar en línea. Formato provisional (folio sin guiones) hasta definir con Finanzas la referencia o línea de captura';
COMMENT ON COLUMN apd.solicitud.lista_para_curso_en IS 'Inicio de la espera de grupo; no cambia si un grupo se cancela, para conservar la antigüedad';
COMMENT ON COLUMN apd.solicitud.motivo_cierre IS 'Motivo de cancelación, conclusión sin atender (también «Se agotaron las oportunidades de corrección», 25/10/2026) o rechazo';
COMMENT ON COLUMN apd.solicitud.folio_origen IS 'Folio en Kobo, para las migradas';
COMMENT ON COLUMN apd.solicitud.creada_en IS 'Alta';
COMMENT ON COLUMN apd.solicitud.es_ficticio IS 'Dato de prueba';

CREATE TABLE apd.revision (
  id                         uuid          NOT NULL DEFAULT gen_random_uuid(),
  solicitud_id               uuid          NOT NULL,
  resultado                  text          NOT NULL,
  observacion_general        text          NOT NULL DEFAULT '',
  revisor                    text          NOT NULL,
  revisada_en                timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT revision_pk PRIMARY KEY (id),
  CONSTRAINT revision_solicitud_fk FOREIGN KEY (solicitud_id) REFERENCES apd.solicitud (id),
  CONSTRAINT revision_resultado_ck CHECK (resultado IN ('con_observaciones', 'validada', 'rechazada'))
);
CREATE INDEX revision_solicitud ON apd.revision (solicitud_id, revisada_en);
COMMENT ON TABLE apd.revision IS 'Cada ronda de revisión documental en línea, con su resultado. Permite contar cuántas vueltas dio un expediente.';
COMMENT ON COLUMN apd.revision.id IS 'Identificador interno';
COMMENT ON COLUMN apd.revision.solicitud_id IS 'Solicitud revisada';
COMMENT ON COLUMN apd.revision.resultado IS 'con_observaciones, validada o rechazada (perfil que no cumple)';
COMMENT ON COLUMN apd.revision.observacion_general IS 'Indicaciones para la persona solicitante; en un rechazo, el motivo (obligatorio)';
COMMENT ON COLUMN apd.revision.revisor IS 'Cuenta del personal (acceso)';
COMMENT ON COLUMN apd.revision.revisada_en IS 'Fecha de la revisión';

CREATE TABLE apd.cita (
  id                         uuid          NOT NULL DEFAULT gen_random_uuid(),
  solicitud_id               uuid          NOT NULL,
  programada_en              timestamptz   NOT NULL,
  resultado                  text          NOT NULL DEFAULT 'pendiente',
  observacion                text          NOT NULL DEFAULT '',
  pausada_en                 timestamptz   NULL,
  atendida_por               text          NULL,
  atendida_en                timestamptz   NULL,
  creada_en                  timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT cita_pk PRIMARY KEY (id),
  CONSTRAINT cita_solicitud_fk FOREIGN KEY (solicitud_id) REFERENCES apd.solicitud (id),
  CONSTRAINT cita_resultado_ck CHECK (resultado IN ('pendiente', 'en_pausa', 'atendida', 'con_observaciones', 'sin_pago', 'no_se_presento', 'no_es_la_persona', 'cancelada')),
  CONSTRAINT cita_cerrada_ck CHECK ((resultado IN ('pendiente', 'en_pausa')) = (atendida_en IS NULL)),
  CONSTRAINT cita_pausa_ck CHECK (resultado <> 'en_pausa' OR pausada_en IS NOT NULL),
  CONSTRAINT cita_observacion_ck CHECK (resultado NOT IN ('en_pausa', 'con_observaciones', 'no_es_la_persona', 'cancelada') OR length(trim(observacion)) > 0)
);
CREATE UNIQUE INDEX cita_una_abierta ON apd.cita (solicitud_id) WHERE resultado IN ('pendiente', 'en_pausa');
CREATE INDEX cita_agenda ON apd.cita (programada_en);
CREATE INDEX cita_solicitud ON apd.cita (solicitud_id, programada_en);
COMMENT ON TABLE apd.cita IS 'Cada cita de cotejo presencial y lo que pasó en ella (decisiones 2026-10-17, Liber). La crea la base al validar la solicitud o al cambiar su cita; la cierra el personal: atendida, en pausa (un documento no coincidió y la persona trae el correcto ese mismo día), con observaciones, sin pago, no se presentó o no era la persona. Si la solicitud se cancela con la cita abierta, la base la cierra como cancelada, con el motivo (decisión 8, 2026-10-19). La solicitud guarda en cita_en la cita vigente.';
COMMENT ON COLUMN apd.cita.id IS 'Identificador interno';
COMMENT ON COLUMN apd.cita.solicitud_id IS 'Solicitud';
COMMENT ON COLUMN apd.cita.programada_en IS 'Día y hora de la cita (la cita_en de la solicitud al crearla)';
COMMENT ON COLUMN apd.cita.resultado IS 'pendiente, en_pausa, atendida, con_observaciones, sin_pago, no_se_presento, no_es_la_persona o cancelada (la solicitud se canceló con la cita abierta; lo pone la base)';
COMMENT ON COLUMN apd.cita.observacion IS 'En pausa o con observaciones: qué no coincidió (lo ve la persona). Si no era la persona: lo que observó el personal (lo lee la Dirección, no la persona). Cancelada: el motivo de la cancelación de la solicitud';
COMMENT ON COLUMN apd.cita.pausada_en IS 'Cuándo quedó en pausa; la pausa sólo dura ese día. Lo pone la base';
COMMENT ON COLUMN apd.cita.atendida_por IS 'Cuenta del personal que la cerró (acceso). Lo pone la base';
COMMENT ON COLUMN apd.cita.atendida_en IS 'Cuándo se cerró. Lo pone la base';
COMMENT ON COLUMN apd.cita.creada_en IS 'Alta. Lo pone la base';

CREATE TABLE apd.documento (
  id                         uuid          NOT NULL DEFAULT gen_random_uuid(),
  solicitud_id               uuid          NOT NULL,
  requisito                  text          NOT NULL,
  archivo_clave              text          NOT NULL,
  nombre_original            text          NOT NULL,
  nombre_archivo             text          NOT NULL DEFAULT '',
  tipo_mime                  text          NOT NULL,
  tamano_bytes               integer       NOT NULL,
  sha256                     text          NOT NULL,
  estado                     text          NOT NULL DEFAULT 'pendiente',
  observacion                text          NOT NULL DEFAULT '',
  vigente                    boolean       NOT NULL DEFAULT true,
  cargado_en                 timestamptz   NOT NULL DEFAULT now(),
  cargado_por                text          NOT NULL DEFAULT '',
  revisado_por               text          NULL,
  revisado_en                timestamptz   NULL,
  CONSTRAINT documento_pk PRIMARY KEY (id),
  CONSTRAINT documento_archivo_uk UNIQUE (archivo_clave),
  CONSTRAINT documento_solicitud_fk FOREIGN KEY (solicitud_id) REFERENCES apd.solicitud (id),
  CONSTRAINT documento_requisito_fk FOREIGN KEY (requisito) REFERENCES apd.requisito (clave),
  CONSTRAINT documento_mime_ck CHECK (tipo_mime IN ('application/pdf', 'image/jpeg', 'image/png')),
  CONSTRAINT documento_tamano_ck CHECK (tamano_bytes > 0),
  CONSTRAINT documento_sha256_ck CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT documento_estado_ck CHECK (estado IN ('pendiente', 'aceptado', 'con_observacion')),
  CONSTRAINT documento_observacion_ck CHECK (estado <> 'con_observacion' OR length(trim(observacion)) > 0)
);
CREATE UNIQUE INDEX documento_uno_vigente ON apd.documento (solicitud_id, requisito) WHERE vigente;
CREATE INDEX documento_solicitud ON apd.documento (solicitud_id, cargado_en);
CREATE INDEX documento_requisito ON apd.documento (requisito);
COMMENT ON TABLE apd.documento IS 'Archivos cargados por requisito. El archivo vive en el almacén, fuera de lo publicado; aquí sólo su clave. Una nueva carga no borra la anterior: la marca como no vigente.';
COMMENT ON COLUMN apd.documento.id IS 'Identificador interno';
COMMENT ON COLUMN apd.documento.solicitud_id IS 'Solicitud';
COMMENT ON COLUMN apd.documento.requisito IS 'Requisito que atiende';
COMMENT ON COLUMN apd.documento.archivo_clave IS 'Clave exacta en el almacén, con sello propio';
COMMENT ON COLUMN apd.documento.nombre_original IS 'Nombre con que se cargó';
COMMENT ON COLUMN apd.documento.nombre_archivo IS 'Nombre con que se guarda y se descarga: TIPO DE DOCUMENTO_NOMBRE COMPLETO.ext (por ejemplo CURP_ANA EJEMPLO MUESTRA.pdf). Lo pone la base al cargarlo';
COMMENT ON COLUMN apd.documento.tipo_mime IS 'application/pdf, image/jpeg o image/png';
COMMENT ON COLUMN apd.documento.tamano_bytes IS 'Tamaño; el máximo lo fija el parámetro tamano_maximo_archivo_bytes';
COMMENT ON COLUMN apd.documento.sha256 IS 'Suma del archivo, para comprobar el almacén';
COMMENT ON COLUMN apd.documento.estado IS 'pendiente, aceptado o con_observacion';
COMMENT ON COLUMN apd.documento.observacion IS 'Qué corregir';
COMMENT ON COLUMN apd.documento.vigente IS 'Es la última carga de ese requisito';
COMMENT ON COLUMN apd.documento.cargado_en IS 'Carga';
COMMENT ON COLUMN apd.documento.cargado_por IS 'Quién lo cargó: la persona solicitante o la cuenta del personal; lo pone la base';
COMMENT ON COLUMN apd.documento.revisado_por IS 'Cuenta del personal (acceso)';
COMMENT ON COLUMN apd.documento.revisado_en IS 'Revisión';

CREATE TABLE apd.grupo (
  id                         uuid          NOT NULL DEFAULT gen_random_uuid(),
  folio                      text          NOT NULL,
  tipo_acreditacion          text          NOT NULL,
  modalidad                  text          NOT NULL,
  integracion                text          NOT NULL,
  organizacion_id            uuid          NULL,
  cupo_minimo                smallint      NOT NULL,
  cupo_maximo                smallint      NOT NULL,
  instructor                 text          NULL,
  sede                       text          NULL,
  fecha_inicio               date          NULL,
  hora_entrada               time          NULL,
  estado                     text          NOT NULL DEFAULT 'en_integracion',
  estado_desde               timestamptz   NOT NULL DEFAULT now(),
  motivo_cancelacion         text          NULL,
  creado_en                  timestamptz   NOT NULL DEFAULT now(),
  es_ficticio                boolean       NOT NULL DEFAULT false,
  CONSTRAINT grupo_pk PRIMARY KEY (id),
  CONSTRAINT grupo_folio_uk UNIQUE (folio),
  CONSTRAINT grupo_curso_fk FOREIGN KEY (tipo_acreditacion, modalidad) REFERENCES apd.curso (tipo_acreditacion, modalidad),
  CONSTRAINT grupo_organizacion_fk FOREIGN KEY (organizacion_id) REFERENCES apd.organizacion (id),
  CONSTRAINT grupo_integracion_ck CHECK (integracion IN ('especifico', 'combinado')),
  CONSTRAINT grupo_especifico_ck CHECK ((integracion = 'especifico') = (organizacion_id IS NOT NULL)),
  CONSTRAINT grupo_cupo_ck CHECK (cupo_minimo >= 1 AND cupo_minimo <= cupo_maximo),
  CONSTRAINT grupo_estado_ck CHECK (estado IN ('en_integracion', 'confirmado', 'en_curso', 'concluido', 'cancelado')),
  CONSTRAINT grupo_confirmado_ck CHECK (estado IN ('en_integracion', 'cancelado') OR (instructor IS NOT NULL AND sede IS NOT NULL AND fecha_inicio IS NOT NULL AND hora_entrada IS NOT NULL)),
  CONSTRAINT grupo_cancelado_ck CHECK (estado <> 'cancelado' OR length(trim(coalesce(motivo_cancelacion, ''))) > 0)
);
CREATE INDEX grupo_curso_estado ON apd.grupo (tipo_acreditacion, modalidad, estado);
CREATE INDEX grupo_organizacion ON apd.grupo (organizacion_id);
COMMENT ON TABLE apd.grupo IS 'Grupo de un curso. Copia los cupos del curso al crearse. Sólo se confirma con el cupo mínimo y nunca pasa del máximo.';
COMMENT ON COLUMN apd.grupo.id IS 'Identificador interno';
COMMENT ON COLUMN apd.grupo.folio IS 'Folio del grupo; lo asigna la base (APD-G-AAAA-NNN)';
COMMENT ON COLUMN apd.grupo.tipo_acreditacion IS 'Curso';
COMMENT ON COLUMN apd.grupo.modalidad IS 'Curso';
COMMENT ON COLUMN apd.grupo.integracion IS 'especifico (una organización; sólo instituciones de gobierno: dependencias de la Ciudad, Alcaldías y dependencias federales, ajustes del equipo del 25/10/2026) o combinado';
COMMENT ON COLUMN apd.grupo.organizacion_id IS 'Organización, sólo en grupos específicos';
COMMENT ON COLUMN apd.grupo.cupo_minimo IS 'Copiado del curso al crearse; lo pone la base';
COMMENT ON COLUMN apd.grupo.cupo_maximo IS 'Copiado del curso al crearse; lo pone la base';
COMMENT ON COLUMN apd.grupo.instructor IS 'Cuenta del instructor responsable (acceso); obligatoria para confirmar. La asigna o la cambia, hasta concluir el grupo, el área de Instructores y Capacitación (perfiles de perfiles_asignan_instructor, ajustes del equipo del 25/10/2026)';
COMMENT ON COLUMN apd.grupo.sede IS 'Instalación de la Secretaría; obligatoria para confirmar';
COMMENT ON COLUMN apd.grupo.fecha_inicio IS 'Primer día; obligatoria para confirmar';
COMMENT ON COLUMN apd.grupo.hora_entrada IS 'Hora de entrada del curso, la misma todos los días; obligatoria para confirmar. El curso es de 9:00 a 15:00 (P91, sesión de trabajo del 23/10/2026): entre curso_hora_entrada y antes de curso_hora_salida; la salida no se guarda por grupo';
COMMENT ON COLUMN apd.grupo.estado IS 'en_integracion, confirmado, en_curso, concluido o cancelado';
COMMENT ON COLUMN apd.grupo.estado_desde IS 'Desde cuándo; lo pone la base';
COMMENT ON COLUMN apd.grupo.motivo_cancelacion IS 'Obligatorio al cancelar';
COMMENT ON COLUMN apd.grupo.creado_en IS 'Alta';
COMMENT ON COLUMN apd.grupo.es_ficticio IS 'Dato de prueba';

CREATE TABLE apd.inscripcion (
  id                         uuid          NOT NULL DEFAULT gen_random_uuid(),
  solicitud_id               uuid          NOT NULL,
  grupo_id                   uuid          NOT NULL,
  activa                     boolean       NOT NULL DEFAULT true,
  inscrita_en                timestamptz   NOT NULL DEFAULT now(),
  baja_en                    timestamptz   NULL,
  motivo_baja                text          NULL,
  CONSTRAINT inscripcion_pk PRIMARY KEY (id),
  CONSTRAINT inscripcion_solicitud_fk FOREIGN KEY (solicitud_id) REFERENCES apd.solicitud (id),
  CONSTRAINT inscripcion_grupo_fk FOREIGN KEY (grupo_id) REFERENCES apd.grupo (id),
  CONSTRAINT inscripcion_baja_ck CHECK (activa = (baja_en IS NULL))
);
CREATE UNIQUE INDEX inscripcion_una_activa ON apd.inscripcion (solicitud_id) WHERE activa;
CREATE INDEX inscripcion_grupo ON apd.inscripcion (grupo_id) WHERE activa;
CREATE INDEX inscripcion_grupo_historial ON apd.inscripcion (grupo_id, inscrita_en);
CREATE INDEX inscripcion_solicitud ON apd.inscripcion (solicitud_id, inscrita_en);
COMMENT ON TABLE apd.inscripcion IS 'Una solicitud en un grupo. No se borra: una baja o una cancelación la deja inactiva y la solicitud regresa a la bandeja con su antigüedad.';
COMMENT ON COLUMN apd.inscripcion.id IS 'Identificador interno';
COMMENT ON COLUMN apd.inscripcion.solicitud_id IS 'Solicitud';
COMMENT ON COLUMN apd.inscripcion.grupo_id IS 'Grupo';
COMMENT ON COLUMN apd.inscripcion.activa IS 'Sigue en el grupo';
COMMENT ON COLUMN apd.inscripcion.inscrita_en IS 'Alta en el grupo';
COMMENT ON COLUMN apd.inscripcion.baja_en IS 'Baja o cancelación del grupo';
COMMENT ON COLUMN apd.inscripcion.motivo_baja IS 'Por qué salió del grupo';

CREATE TABLE apd.asistencia (
  inscripcion_id             uuid          NOT NULL,
  dia                        smallint      NOT NULL,
  asistio                    boolean       NOT NULL,
  capturada_por              text          NOT NULL,
  capturada_en               timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT asistencia_pk PRIMARY KEY (inscripcion_id, dia),
  CONSTRAINT asistencia_inscripcion_fk FOREIGN KEY (inscripcion_id) REFERENCES apd.inscripcion (id),
  CONSTRAINT asistencia_dia_ck CHECK (dia >= 1)
);
COMMENT ON TABLE apd.asistencia IS 'Asistencia por día de curso, capturada por el instructor; la del último día se registra al pasar lista en el examen (P94).';
COMMENT ON COLUMN apd.asistencia.inscripcion_id IS 'Inscripción';
COMMENT ON COLUMN apd.asistencia.dia IS 'Día del curso, desde 1';
COMMENT ON COLUMN apd.asistencia.asistio IS 'Asistió ese día';
COMMENT ON COLUMN apd.asistencia.capturada_por IS 'Cuenta del personal que capturó (acceso). Lo pone la base: la cuenta de la sesión (apd.usuario)';
COMMENT ON COLUMN apd.asistencia.capturada_en IS 'Captura';

CREATE TABLE apd.examen (
  inscripcion_id             uuid          NOT NULL,
  presentado_en              date          NOT NULL,
  calificacion               numeric(3,1)  NOT NULL,
  capturado_por              text          NOT NULL,
  origen                     text          NOT NULL DEFAULT 'captura',
  capturado_en               timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT examen_pk PRIMARY KEY (inscripcion_id),
  CONSTRAINT examen_origen_ck CHECK (origen IN ('captura', 'examen_web')),
  CONSTRAINT examen_inscripcion_fk FOREIGN KEY (inscripcion_id) REFERENCES apd.inscripcion (id),
  CONSTRAINT examen_calificacion_ck CHECK (calificacion BETWEEN 0 AND 10)
);
COMMENT ON TABLE apd.examen IS 'Calificación del examen final: la captura el instructor o llega del sistema de examen en línea. Sólo se admite con la asistencia mínima, y una vez registrada no se modifica (el resultado es inapelable).';
COMMENT ON COLUMN apd.examen.inscripcion_id IS 'Inscripción';
COMMENT ON COLUMN apd.examen.presentado_en IS 'Fecha del examen';
COMMENT ON COLUMN apd.examen.calificacion IS 'De 0.0 a 10.0';
COMMENT ON COLUMN apd.examen.capturado_por IS 'Cuenta del instructor (acceso) o del sistema de examen en línea. Lo pone la base: la cuenta de la sesión (apd.usuario)';
COMMENT ON COLUMN apd.examen.origen IS 'captura: la registra el instructor; examen_web: la registra el examen en línea del salón de cómputo del PILARES (R36; prototipo en la versión de prueba)';
COMMENT ON COLUMN apd.examen.capturado_en IS 'Captura';

CREATE TABLE apd.material_estudio (
  id                         uuid          NOT NULL DEFAULT gen_random_uuid(),
  clave                      text          NOT NULL,
  titulo                     text          NOT NULL,
  descripcion                text          NOT NULL,
  edicion                    text          NOT NULL,
  tipo_acreditacion          text          NULL,
  temas                      jsonb         NOT NULL DEFAULT '[]'::jsonb,
  orden                      smallint      NOT NULL DEFAULT 0,
  publicado                  boolean       NOT NULL DEFAULT false,
  archivo_clave              text          NOT NULL,
  nombre_archivo             text          NOT NULL,
  tipo_mime                  text          NOT NULL,
  tamano_bytes               integer       NOT NULL,
  sha256                     text          NOT NULL,
  paginas                    integer       NOT NULL,
  vigente                    boolean       NOT NULL DEFAULT true,
  cargado_en                 timestamptz   NOT NULL DEFAULT now(),
  cargado_por                text          NOT NULL DEFAULT '',
  actualizado_en             timestamptz   NULL,
  actualizado_por            text          NULL,
  CONSTRAINT material_estudio_pk PRIMARY KEY (id),
  CONSTRAINT material_estudio_archivo_uk UNIQUE (archivo_clave),
  CONSTRAINT material_estudio_clave_ck CHECK (clave ~ '^[a-z0-9_]{3,40}$'),
  CONSTRAINT material_estudio_titulo_ck CHECK (length(trim(titulo)) BETWEEN 3 AND 200),
  CONSTRAINT material_estudio_descripcion_ck CHECK (length(trim(descripcion)) BETWEEN 10 AND 400),
  CONSTRAINT material_estudio_edicion_ck CHECK (length(trim(edicion)) BETWEEN 3 AND 200),
  CONSTRAINT material_estudio_tipo_ck CHECK (tipo_acreditacion IS NULL OR tipo_acreditacion IN ('poda', 'dictaminador')),
  CONSTRAINT material_estudio_temas_ck CHECK (jsonb_typeof(temas) = 'array'),
  CONSTRAINT material_estudio_mime_ck CHECK (tipo_mime = 'application/pdf'),
  CONSTRAINT material_estudio_tamano_ck CHECK (tamano_bytes > 0),
  CONSTRAINT material_estudio_sha256_ck CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT material_estudio_paginas_ck CHECK (paginas > 0)
);
COMMENT ON TABLE apd.material_estudio IS 'Documentos de la Secretaría para preparar el examen (decisión 2026-10-18, Liber): los sube el personal y, publicados, los ve cualquiera en «Material de estudio», sin cuenta. El examen es a libro cerrado: se estudian antes. El archivo vive en el almacén; aquí sólo su clave. Una carga nueva del mismo documento no borra la anterior: la marca como no vigente.';
COMMENT ON COLUMN apd.material_estudio.id IS 'Identificador interno';
COMMENT ON COLUMN apd.material_estudio.clave IS 'Documento al que pertenece la carga; se conserva al reemplazar el archivo (por ejemplo norma_poda)';
COMMENT ON COLUMN apd.material_estudio.titulo IS 'Nombre del documento como lo lee la persona';
COMMENT ON COLUMN apd.material_estudio.descripcion IS 'Para qué le sirve a quien estudia';
COMMENT ON COLUMN apd.material_estudio.edicion IS 'Versión o fecha de publicación, como la dice el documento (por ejemplo: texto vigente, última reforma publicada el 23/07/2026)';
COMMENT ON COLUMN apd.material_estudio.tipo_acreditacion IS 'poda o dictaminador; vacío: sirve para las dos acreditaciones';
COMMENT ON COLUMN apd.material_estudio.temas IS 'Apartados que conviene estudiar: [{titulo, pagina, tipo_acreditacion?}]; la página es la del archivo PDF';
COMMENT ON COLUMN apd.material_estudio.orden IS 'Orden en la lista';
COMMENT ON COLUMN apd.material_estudio.publicado IS 'Se ve en «Material de estudio»';
COMMENT ON COLUMN apd.material_estudio.archivo_clave IS 'Clave exacta en el almacén, con sello propio';
COMMENT ON COLUMN apd.material_estudio.nombre_archivo IS 'Nombre con que se descarga';
COMMENT ON COLUMN apd.material_estudio.tipo_mime IS 'application/pdf';
COMMENT ON COLUMN apd.material_estudio.tamano_bytes IS 'Tamaño; el máximo lo fija el parámetro tamano_maximo_material_bytes';
COMMENT ON COLUMN apd.material_estudio.sha256 IS 'Suma del archivo, para comprobar el almacén';
COMMENT ON COLUMN apd.material_estudio.paginas IS 'Número de páginas del PDF';
COMMENT ON COLUMN apd.material_estudio.vigente IS 'Es la última carga de ese documento';
COMMENT ON COLUMN apd.material_estudio.cargado_en IS 'Carga';
COMMENT ON COLUMN apd.material_estudio.cargado_por IS 'Cuenta del personal que lo cargó; lo pone la base';
COMMENT ON COLUMN apd.material_estudio.actualizado_en IS 'Último cambio de sus datos o de su publicación; lo pone la base';
COMMENT ON COLUMN apd.material_estudio.actualizado_por IS 'Cuenta del personal del último cambio; lo pone la base';

CREATE TABLE apd.folio_contador (
  serie                      text          NOT NULL,
  anio                       smallint      NOT NULL,
  ultimo                     integer       NOT NULL DEFAULT 0,
  CONSTRAINT folio_contador_pk PRIMARY KEY (serie, anio)
);
COMMENT ON TABLE apd.folio_contador IS 'Último número asignado por serie y año. Lo usa sólo la base al asignar folios.';
COMMENT ON COLUMN apd.folio_contador.serie IS 'S (solicitud), E (expediente físico), G (grupo), PD (acreditación de poda), DT (acreditación de dictaminador)';
COMMENT ON COLUMN apd.folio_contador.anio IS 'Año';
COMMENT ON COLUMN apd.folio_contador.ultimo IS 'Último número asignado';

-- acreditacion y solicitud se refieren mutuamente (la renovación apunta a la acreditación anterior; la acreditación apunta a la solicitud que la originó): esta llave se agrega cuando ya existen las dos tablas.
ALTER TABLE apd.acreditacion ADD CONSTRAINT acreditacion_solicitud_fk FOREIGN KEY (solicitud_id) REFERENCES apd.solicitud (id);

-- Una solicitud origina a lo más una acreditación.
CREATE UNIQUE INDEX acreditacion_solicitud_uk ON apd.acreditacion (solicitud_id) WHERE solicitud_id IS NOT NULL;

-- Cada documento de estudio tiene a lo más una carga vigente.
CREATE UNIQUE INDEX material_estudio_vigente_uk ON apd.material_estudio (clave) WHERE vigente;
