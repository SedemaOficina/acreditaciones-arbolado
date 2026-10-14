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
  activo                     boolean       NOT NULL DEFAULT true,
  actualizado_en             timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT curso_pk PRIMARY KEY (tipo_acreditacion, modalidad),
  CONSTRAINT curso_tipo_ck CHECK (tipo_acreditacion IN ('poda', 'dictaminador')),
  CONSTRAINT curso_modalidad_ck CHECK (modalidad IN ('nueva', 'renovacion')),
  CONSTRAINT curso_dias_ck CHECK (dias_duracion BETWEEN 1 AND 15 AND dias_minimos_asistencia BETWEEN 1 AND dias_duracion),
  CONSTRAINT curso_calificacion_ck CHECK (calificacion_minima BETWEEN 0 AND 10),
  CONSTRAINT curso_cupo_ck CHECK (cupo_minimo >= 1 AND cupo_minimo <= cupo_maximo)
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
COMMENT ON COLUMN apd.curso.activo IS 'Si se pueden abrir grupos de este curso';
COMMENT ON COLUMN apd.curso.actualizado_en IS 'Último cambio';

CREATE TABLE apd.requisito (
  clave                      text          NOT NULL,
  nombre                     text          NOT NULL,
  descripcion                text          NOT NULL DEFAULT '',
  forma                      text          NOT NULL,
  momento                    text          NOT NULL,
  activo                     boolean       NOT NULL DEFAULT true,
  CONSTRAINT requisito_pk PRIMARY KEY (clave),
  CONSTRAINT requisito_forma_ck CHECK (forma IN ('documento', 'registro')),
  CONSTRAINT requisito_momento_ck CHECK (momento IN ('en_linea', 'cotejo'))
);
COMMENT ON TABLE apd.requisito IS 'Catálogo de requisitos. Un requisito es un documento que se carga o un registro que el sistema comprueba en su propio padrón.';
COMMENT ON COLUMN apd.requisito.clave IS 'Identificador corto';
COMMENT ON COLUMN apd.requisito.nombre IS 'Nombre visible';
COMMENT ON COLUMN apd.requisito.descripcion IS 'Características que debe cumplir';
COMMENT ON COLUMN apd.requisito.forma IS 'documento: se carga un archivo; registro: el sistema lo comprueba en el padrón';
COMMENT ON COLUMN apd.requisito.momento IS 'en_linea: lo carga la persona al solicitar; cotejo: lo carga el personal de la Secretaría en la cita presencial';
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
COMMENT ON TABLE apd.requisito_curso IS 'Qué requisitos pide cada curso, en qué orden. Editable: agregar o quitar un documento no requiere programar.';
COMMENT ON COLUMN apd.requisito_curso.tipo_acreditacion IS 'Curso';
COMMENT ON COLUMN apd.requisito_curso.modalidad IS 'Curso';
COMMENT ON COLUMN apd.requisito_curso.requisito IS 'Requisito';
COMMENT ON COLUMN apd.requisito_curso.orden IS 'Orden en que se muestra';
COMMENT ON COLUMN apd.requisito_curso.obligatorio IS 'Si falta, la solicitud no se puede enviar. Los no obligatorios dependen del caso (por ejemplo, constancias de capacitación sólo para carrera técnica) y los valora quien revisa';
COMMENT ON COLUMN apd.requisito_curso.nota IS 'Indicación particular de este curso para el requisito';

CREATE TABLE apd.organizacion (
  id                         uuid          NOT NULL DEFAULT gen_random_uuid(),
  tipo                       text          NOT NULL,
  nombre                     text          NOT NULL,
  nombre_normalizado         text          NOT NULL,
  activa                     boolean       NOT NULL DEFAULT true,
  es_ficticio                boolean       NOT NULL DEFAULT false,
  CONSTRAINT organizacion_pk PRIMARY KEY (id),
  CONSTRAINT organizacion_tipo_ck CHECK (tipo IN ('empresa', 'alcaldia', 'dependencia_publica', 'institucion_academica', 'otra')),
  CONSTRAINT organizacion_nombre_uk UNIQUE (nombre_normalizado)
);
COMMENT ON TABLE apd.organizacion IS 'Catálogo de organizaciones de procedencia (empresas, alcaldías, dependencias, instituciones). Sirve para agrupar la demanda; no inscribe ni paga.';
COMMENT ON COLUMN apd.organizacion.id IS 'Identificador interno';
COMMENT ON COLUMN apd.organizacion.tipo IS 'empresa, alcaldia, dependencia_publica, institucion_academica u otra';
COMMENT ON COLUMN apd.organizacion.nombre IS 'Nombre oficial';
COMMENT ON COLUMN apd.organizacion.nombre_normalizado IS 'Nombre sin acentos, en minúsculas y sin espacios dobles; lo calcula la base y evita duplicados como «CFE» y «C.F.E.»';
COMMENT ON COLUMN apd.organizacion.activa IS 'Si aparece al solicitar';
COMMENT ON COLUMN apd.organizacion.es_ficticio IS 'Dato de prueba';

CREATE TABLE apd.solicitante (
  id                         uuid          NOT NULL DEFAULT gen_random_uuid(),
  curp                       text          NOT NULL,
  nombre                     text          NOT NULL,
  primer_apellido            text          NOT NULL,
  segundo_apellido           text          NULL,
  correo                     text          NOT NULL,
  telefono                   text          NOT NULL,
  contrasena_hash            text          NULL,
  estado                     text          NOT NULL DEFAULT 'activa',
  intentos_fallidos          smallint      NOT NULL DEFAULT 0,
  bloqueada_hasta            timestamptz   NULL,
  debe_cambiar_contrasena    boolean       NOT NULL DEFAULT false,
  creada_en                  timestamptz   NOT NULL DEFAULT now(),
  es_ficticio                boolean       NOT NULL DEFAULT false,
  CONSTRAINT solicitante_pk PRIMARY KEY (id),
  CONSTRAINT solicitante_curp_uk UNIQUE (curp),
  CONSTRAINT solicitante_curp_ck CHECK (curp ~ '^[A-Z][AEIOUX][A-Z]{2}[0-9]{6}[HMX][A-Z]{5}[0-9A-Z][0-9]$'),
  CONSTRAINT solicitante_correo_ck CHECK (correo = lower(correo) AND correo ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  CONSTRAINT solicitante_telefono_ck CHECK (telefono ~ '^[0-9]{10}$'),
  CONSTRAINT solicitante_estado_ck CHECK (estado IN ('activa', 'bloqueada', 'inactiva', 'sin_activar')),
  CONSTRAINT solicitante_contrasena_ck CHECK ((estado = 'sin_activar') = (contrasena_hash IS NULL))
);
CREATE INDEX solicitante_apellidos ON apd.solicitante (primer_apellido, segundo_apellido, nombre);
COMMENT ON TABLE apd.solicitante IS 'Cuenta de la persona solicitante. Una por CURP. La contraseña se guarda derivada con scrypt (parámetros de acceso), nunca en claro. Las personas del padrón migrado quedan sin activar hasta que se registran con su CURP.';
COMMENT ON COLUMN apd.solicitante.id IS 'Identificador interno';
COMMENT ON COLUMN apd.solicitante.curp IS 'CURP en mayúsculas; identificador único de la cuenta';
COMMENT ON COLUMN apd.solicitante.nombre IS 'Nombre(s)';
COMMENT ON COLUMN apd.solicitante.primer_apellido IS 'Primer apellido';
COMMENT ON COLUMN apd.solicitante.segundo_apellido IS 'Segundo apellido, si lo hay';
COMMENT ON COLUMN apd.solicitante.correo IS 'Correo de contacto, en minúsculas';
COMMENT ON COLUMN apd.solicitante.telefono IS 'Teléfono de contacto, 10 dígitos';
COMMENT ON COLUMN apd.solicitante.contrasena_hash IS 'scrypt N=2^14, r=8, p=1, base64url. Vacía sólo en cuentas sin activar';
COMMENT ON COLUMN apd.solicitante.estado IS 'activa, bloqueada, inactiva o sin_activar (persona del padrón migrado que aún no crea su contraseña)';
COMMENT ON COLUMN apd.solicitante.intentos_fallidos IS 'Intentos de entrada fallidos seguidos';
COMMENT ON COLUMN apd.solicitante.bloqueada_hasta IS 'Fin del bloqueo por intentos';
COMMENT ON COLUMN apd.solicitante.debe_cambiar_contrasena IS 'Tiene una contraseña temporal de un solo uso';
COMMENT ON COLUMN apd.solicitante.creada_en IS 'Alta de la cuenta';
COMMENT ON COLUMN apd.solicitante.es_ficticio IS 'Dato de prueba';

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
  origen                     text          NOT NULL DEFAULT 'sistema',
  folio_origen               text          NULL,
  es_ficticio                boolean       NOT NULL DEFAULT false,
  CONSTRAINT acreditacion_pk PRIMARY KEY (id),
  CONSTRAINT acreditacion_numero_uk UNIQUE (numero),
  CONSTRAINT acreditacion_solicitante_fk FOREIGN KEY (solicitante_id) REFERENCES apd.solicitante (id),
  CONSTRAINT acreditacion_tipo_ck CHECK (tipo_acreditacion IN ('poda', 'dictaminador')),
  CONSTRAINT acreditacion_origen_ck CHECK (origen IN ('sistema', 'kobo', 'papel')),
  CONSTRAINT acreditacion_origen_solicitud_ck CHECK ((origen = 'sistema') = (solicitud_id IS NOT NULL)),
  CONSTRAINT acreditacion_fechas_ck CHECK (vence_en > emitida_en AND (entregada_en IS NULL OR entregada_en >= emitida_en))
);
CREATE INDEX acreditacion_titular ON apd.acreditacion (solicitante_id, tipo_acreditacion, vence_en DESC);
CREATE INDEX acreditacion_vence ON apd.acreditacion (vence_en);
COMMENT ON TABLE apd.acreditacion IS 'Padrón de acreditaciones emitidas, del sistema o migradas de Kobo o papel. Su estado de vigencia no se guarda: lo calcula apd.estado_acreditacion() con la fecha del día.';
COMMENT ON COLUMN apd.acreditacion.id IS 'Identificador interno';
COMMENT ON COLUMN apd.acreditacion.numero IS 'Número impreso en la credencial; lo asigna la base si no se migra. Formato provisional: Liber lo definirá';
COMMENT ON COLUMN apd.acreditacion.solicitante_id IS 'Titular';
COMMENT ON COLUMN apd.acreditacion.tipo_acreditacion IS 'poda o dictaminador';
COMMENT ON COLUMN apd.acreditacion.solicitud_id IS 'Solicitud que la originó; vacía si se migró';
COMMENT ON COLUMN apd.acreditacion.emitida_en IS 'Fecha de emisión (Ciudad de México)';
COMMENT ON COLUMN apd.acreditacion.vence_en IS 'Último día de vigencia: un año después de la emisión, menos un día. Lo calcula la base';
COMMENT ON COLUMN apd.acreditacion.entregada_en IS 'Entrega en persona';
COMMENT ON COLUMN apd.acreditacion.origen IS 'sistema, kobo o papel';
COMMENT ON COLUMN apd.acreditacion.folio_origen IS 'Folio en el sistema de origen, para las migradas';
COMMENT ON COLUMN apd.acreditacion.es_ficticio IS 'Dato de prueba';

CREATE TABLE apd.solicitud (
  id                         uuid          NOT NULL DEFAULT gen_random_uuid(),
  folio                      text          NOT NULL,
  numero_expediente          text          NULL,
  solicitante_id             uuid          NOT NULL,
  tipo_acreditacion          text          NOT NULL,
  modalidad                  text          NOT NULL,
  organizacion_id            uuid          NULL,
  acreditacion_anterior_id   uuid          NULL,
  perfil_academico           text          NULL,
  carrera                    text          NULL,
  anios_experiencia          numeric(4,1)  NULL,
  estado                     text          NOT NULL DEFAULT 'borrador',
  estado_desde               timestamptz   NOT NULL DEFAULT now(),
  enviada_en                 timestamptz   NULL,
  cita_en                    timestamptz   NULL,
  lista_para_curso_en        timestamptz   NULL,
  motivo_cierre              text          NULL,
  folio_origen               text          NULL,
  creada_en                  timestamptz   NOT NULL DEFAULT now(),
  es_ficticio                boolean       NOT NULL DEFAULT false,
  CONSTRAINT solicitud_pk PRIMARY KEY (id),
  CONSTRAINT solicitud_folio_uk UNIQUE (folio),
  CONSTRAINT solicitud_expediente_uk UNIQUE (numero_expediente),
  CONSTRAINT solicitud_expediente_ck CHECK (estado NOT IN ('lista_para_curso', 'inscrita', 'aprobada', 'acreditada', 'no_acreditada', 'sin_derecho_examen') OR numero_expediente IS NOT NULL),
  CONSTRAINT solicitud_solicitante_fk FOREIGN KEY (solicitante_id) REFERENCES apd.solicitante (id),
  CONSTRAINT solicitud_curso_fk FOREIGN KEY (tipo_acreditacion, modalidad) REFERENCES apd.curso (tipo_acreditacion, modalidad),
  CONSTRAINT solicitud_organizacion_fk FOREIGN KEY (organizacion_id) REFERENCES apd.organizacion (id),
  CONSTRAINT solicitud_anterior_fk FOREIGN KEY (acreditacion_anterior_id) REFERENCES apd.acreditacion (id),
  CONSTRAINT solicitud_estado_ck CHECK (estado IN ('borrador', 'enviada', 'con_observaciones', 'validada_en_linea', 'lista_para_curso', 'inscrita', 'aprobada', 'acreditada', 'no_acreditada', 'sin_derecho_examen', 'cancelada', 'concluida_sin_atender')),
  CONSTRAINT solicitud_renovacion_ck CHECK ((modalidad = 'renovacion') = (acreditacion_anterior_id IS NOT NULL)),
  CONSTRAINT solicitud_perfil_ck CHECK (perfil_academico IS NULL OR perfil_academico IN ('titulo', 'pasante', 'creditos_100', 'tecnica')),
  CONSTRAINT solicitud_perfil_tipo_ck CHECK (tipo_acreditacion = 'dictaminador' OR (perfil_academico IS NULL AND carrera IS NULL AND anios_experiencia IS NULL)),
  CONSTRAINT solicitud_experiencia_ck CHECK (anios_experiencia IS NULL OR anios_experiencia BETWEEN 0 AND 70),
  CONSTRAINT solicitud_cierre_ck CHECK (estado NOT IN ('cancelada', 'concluida_sin_atender') OR length(trim(coalesce(motivo_cierre, ''))) > 0)
);
CREATE UNIQUE INDEX solicitud_una_activa ON apd.solicitud (solicitante_id, tipo_acreditacion) WHERE estado NOT IN ('acreditada', 'no_acreditada', 'sin_derecho_examen', 'cancelada', 'concluida_sin_atender');
CREATE INDEX solicitud_bandeja ON apd.solicitud (tipo_acreditacion, modalidad, estado, lista_para_curso_en);
CREATE INDEX solicitud_organizacion ON apd.solicitud (organizacion_id);
CREATE INDEX solicitud_anterior ON apd.solicitud (acreditacion_anterior_id);
COMMENT ON TABLE apd.solicitud IS 'Un trámite: una persona, un curso. Sus cambios de estado los valida la base y quedan en la bitácora.';
COMMENT ON COLUMN apd.solicitud.id IS 'Identificador interno';
COMMENT ON COLUMN apd.solicitud.folio IS 'Folio público; lo asigna la base (APD-S-AAAA-NNNNN)';
COMMENT ON COLUMN apd.solicitud.numero_expediente IS 'Número del expediente físico. Lo asigna la base al concluir el cotejo presencial, consecutivo por año y sin huecos. Formato provisional EXP-AAAA-NNNN';
COMMENT ON COLUMN apd.solicitud.solicitante_id IS 'Persona solicitante';
COMMENT ON COLUMN apd.solicitud.tipo_acreditacion IS 'Curso solicitado';
COMMENT ON COLUMN apd.solicitud.modalidad IS 'Curso solicitado';
COMMENT ON COLUMN apd.solicitud.organizacion_id IS 'Organización de procedencia; vacía para particulares';
COMMENT ON COLUMN apd.solicitud.acreditacion_anterior_id IS 'Acreditación que se renueva; obligatoria en renovación';
COMMENT ON COLUMN apd.solicitud.perfil_academico IS 'Sólo dictaminador: titulo, pasante, creditos_100 o tecnica. Determina la experiencia mínima';
COMMENT ON COLUMN apd.solicitud.carrera IS 'Sólo dictaminador: carrera o formación declarada';
COMMENT ON COLUMN apd.solicitud.anios_experiencia IS 'Sólo dictaminador: años de experiencia en manejo de arbolado declarados; los documentos los comprueban';
COMMENT ON COLUMN apd.solicitud.estado IS 'Ver apd.transicion_solicitud()';
COMMENT ON COLUMN apd.solicitud.estado_desde IS 'Desde cuándo está en el estado actual; lo pone la base';
COMMENT ON COLUMN apd.solicitud.enviada_en IS 'Primer envío a revisión; lo pone la base';
COMMENT ON COLUMN apd.solicitud.cita_en IS 'Cita para el cotejo presencial';
COMMENT ON COLUMN apd.solicitud.lista_para_curso_en IS 'Inicio de la espera de grupo; no cambia si un grupo se cancela, para conservar la antigüedad';
COMMENT ON COLUMN apd.solicitud.motivo_cierre IS 'Motivo de cancelación o conclusión sin atender';
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
  CONSTRAINT revision_resultado_ck CHECK (resultado IN ('con_observaciones', 'validada'))
);
CREATE INDEX revision_solicitud ON apd.revision (solicitud_id, revisada_en);
COMMENT ON TABLE apd.revision IS 'Cada ronda de revisión documental en línea, con su resultado. Permite contar cuántas vueltas dio un expediente.';
COMMENT ON COLUMN apd.revision.id IS 'Identificador interno';
COMMENT ON COLUMN apd.revision.solicitud_id IS 'Solicitud revisada';
COMMENT ON COLUMN apd.revision.resultado IS 'con_observaciones o validada';
COMMENT ON COLUMN apd.revision.observacion_general IS 'Indicaciones para la persona solicitante';
COMMENT ON COLUMN apd.revision.revisor IS 'Cuenta del personal (acceso)';
COMMENT ON COLUMN apd.revision.revisada_en IS 'Fecha de la revisión';

CREATE TABLE apd.documento (
  id                         uuid          NOT NULL DEFAULT gen_random_uuid(),
  solicitud_id               uuid          NOT NULL,
  requisito                  text          NOT NULL,
  archivo_clave              text          NOT NULL,
  nombre_original            text          NOT NULL,
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
  CONSTRAINT documento_mime_ck CHECK (tipo_mime IN ('application/pdf', 'image/jpeg', 'image/png', 'application/xml')),
  CONSTRAINT documento_tamano_ck CHECK (tamano_bytes > 0),
  CONSTRAINT documento_sha256_ck CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT documento_estado_ck CHECK (estado IN ('pendiente', 'aceptado', 'con_observacion')),
  CONSTRAINT documento_observacion_ck CHECK (estado <> 'con_observacion' OR length(trim(observacion)) > 0)
);
CREATE UNIQUE INDEX documento_uno_vigente ON apd.documento (solicitud_id, requisito) WHERE vigente;
COMMENT ON TABLE apd.documento IS 'Archivos cargados por requisito. El archivo vive en el almacén, fuera de lo publicado; aquí sólo su clave. Una nueva carga no borra la anterior: la marca como no vigente.';
COMMENT ON COLUMN apd.documento.id IS 'Identificador interno';
COMMENT ON COLUMN apd.documento.solicitud_id IS 'Solicitud';
COMMENT ON COLUMN apd.documento.requisito IS 'Requisito que atiende';
COMMENT ON COLUMN apd.documento.archivo_clave IS 'Clave exacta en el almacén, con sello propio';
COMMENT ON COLUMN apd.documento.nombre_original IS 'Nombre con que se cargó';
COMMENT ON COLUMN apd.documento.tipo_mime IS 'application/pdf, image/jpeg, image/png o application/xml (el XML de la factura)';
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
  CONSTRAINT grupo_confirmado_ck CHECK (estado IN ('en_integracion', 'cancelado') OR (instructor IS NOT NULL AND sede IS NOT NULL AND fecha_inicio IS NOT NULL)),
  CONSTRAINT grupo_cancelado_ck CHECK (estado <> 'cancelado' OR length(trim(coalesce(motivo_cancelacion, ''))) > 0)
);
CREATE INDEX grupo_curso_estado ON apd.grupo (tipo_acreditacion, modalidad, estado);
COMMENT ON TABLE apd.grupo IS 'Grupo de un curso. Copia los cupos del curso al crearse. Sólo se confirma con el cupo mínimo y nunca pasa del máximo.';
COMMENT ON COLUMN apd.grupo.id IS 'Identificador interno';
COMMENT ON COLUMN apd.grupo.folio IS 'Folio del grupo; lo asigna la base (APD-G-AAAA-NNN)';
COMMENT ON COLUMN apd.grupo.tipo_acreditacion IS 'Curso';
COMMENT ON COLUMN apd.grupo.modalidad IS 'Curso';
COMMENT ON COLUMN apd.grupo.integracion IS 'especifico (una organización) o combinado';
COMMENT ON COLUMN apd.grupo.organizacion_id IS 'Organización, sólo en grupos específicos';
COMMENT ON COLUMN apd.grupo.cupo_minimo IS 'Copiado del curso al crearse; lo pone la base';
COMMENT ON COLUMN apd.grupo.cupo_maximo IS 'Copiado del curso al crearse; lo pone la base';
COMMENT ON COLUMN apd.grupo.instructor IS 'Cuenta del instructor responsable (acceso); obligatoria para confirmar. Puede cambiar hasta concluir el grupo';
COMMENT ON COLUMN apd.grupo.sede IS 'Instalación de la Secretaría; obligatoria para confirmar';
COMMENT ON COLUMN apd.grupo.fecha_inicio IS 'Primer día; obligatoria para confirmar';
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
COMMENT ON TABLE apd.asistencia IS 'Asistencia por día de curso, capturada por el instructor.';
COMMENT ON COLUMN apd.asistencia.inscripcion_id IS 'Inscripción';
COMMENT ON COLUMN apd.asistencia.dia IS 'Día del curso, desde 1';
COMMENT ON COLUMN apd.asistencia.asistio IS 'Asistió ese día';
COMMENT ON COLUMN apd.asistencia.capturada_por IS 'Cuenta del instructor (acceso)';
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
COMMENT ON COLUMN apd.examen.capturado_por IS 'Cuenta del instructor (acceso) o del sistema de examen en línea';
COMMENT ON COLUMN apd.examen.origen IS 'captura: la registra el instructor; examen_web: llega del sistema de examen en salón de cómputo que se conectará después (R36)';
COMMENT ON COLUMN apd.examen.capturado_en IS 'Captura';

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
