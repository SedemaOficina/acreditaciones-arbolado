# Modelo de datos · esquema `apd`

> Archivo generado por herramientas/generar-esquema.mjs desde db/esquema.json. No se edita a mano.

Las reglas que la base impone además de estas restricciones (estados, cupos, vigencia, folios, bitácora)
están en `db/apd/03-apd-reglas.sql` y se describen en `docs/REGLAS.md`.

## Tablas

- [`parametro`](#parametro) — Valores que gobiernan reglas del sistema y que la administración puede cambiar sin programar. Cada cambio queda en la bitácora.
- [`curso`](#curso) — Los cuatro cursos: tipo de acreditación por modalidad. Guarda duración, asistencia mínima, calificación mínima y cupos vigentes; un grupo copia los cupos al crearse.
- [`requisito`](#requisito) — Catálogo de requisitos. Un requisito es un documento que se carga o un registro que el sistema comprueba en su propio padrón.
- [`requisito_curso`](#requisito_curso) — Qué requisitos pide cada curso, en qué orden. Editable: agregar o quitar un documento no requiere programar.
- [`organizacion`](#organizacion) — Catálogo de organizaciones de procedencia (empresas, alcaldías, dependencias, instituciones). Sirve para agrupar la demanda; no inscribe ni paga.
- [`solicitante`](#solicitante) — Cuenta de la persona solicitante. Una por CURP. La contraseña se guarda derivada con scrypt (parámetros de acceso), nunca en claro. Las personas del padrón migrado quedan sin activar hasta que se registran con su CURP.
- [`sesion_solicitante`](#sesion_solicitante) — Sesiones de las personas solicitantes. Sólo se guarda el resumen sha256 del testigo, nunca el testigo.
- [`acreditacion`](#acreditacion) — Padrón de acreditaciones emitidas, del sistema o migradas de Kobo o papel. Su estado de vigencia no se guarda: lo calcula apd.estado_acreditacion() con la fecha del día.
- [`solicitud`](#solicitud) — Un trámite: una persona, un curso. Sus cambios de estado los valida la base y quedan en la bitácora.
- [`revision`](#revision) — Cada ronda de revisión documental en línea, con su resultado. Permite contar cuántas vueltas dio un expediente.
- [`documento`](#documento) — Archivos cargados por requisito. El archivo vive en el almacén, fuera de lo publicado; aquí sólo su clave. Una nueva carga no borra la anterior: la marca como no vigente.
- [`grupo`](#grupo) — Grupo de un curso. Copia los cupos del curso al crearse. Sólo se confirma con el cupo mínimo y nunca pasa del máximo.
- [`inscripcion`](#inscripcion) — Una solicitud en un grupo. No se borra: una baja o una cancelación la deja inactiva y la solicitud regresa a la bandeja con su antigüedad.
- [`asistencia`](#asistencia) — Asistencia por día de curso, capturada por el instructor.
- [`examen`](#examen) — Calificación del examen final, capturada por el instructor. Sólo se admite con la asistencia mínima.
- [`folio_contador`](#folio_contador) — Último número asignado por serie y año. Lo usa sólo la base al asignar folios.

## parametro

Valores que gobiernan reglas del sistema y que la administración puede cambiar sin programar. Cada cambio queda en la bitácora.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `clave` | `text` | Sí | Nombre del parámetro |
| `valor` | `text` | Sí | Valor como texto; la regla que lo usa lo convierte |
| `descripcion` | `text` | Sí | Qué regla gobierna y en qué unidad |
| `actualizado_en` | `timestamptz` | Sí | Último cambio (por omisión: `now()`) |

Restricciones e índices:

- `CONSTRAINT parametro_pk PRIMARY KEY (clave)`

## curso

Los cuatro cursos: tipo de acreditación por modalidad. Guarda duración, asistencia mínima, calificación mínima y cupos vigentes; un grupo copia los cupos al crearse.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `tipo_acreditacion` | `text` | Sí | poda o dictaminador |
| `modalidad` | `text` | Sí | nueva o renovacion |
| `nombre` | `text` | Sí | Nombre visible del curso |
| `dias_duracion` | `smallint` | Sí | Días de curso |
| `dias_minimos_asistencia` | `smallint` | Sí | Días de asistencia necesarios para tener derecho a examen (en días, no en porcentaje) |
| `calificacion_minima` | `numeric(3,1)` | Sí | Calificación mínima aprobatoria, de 0 a 10 |
| `cupo_minimo` | `smallint` | Sí | Personas necesarias para confirmar un grupo |
| `cupo_maximo` | `smallint` | Sí | Personas máximas en un grupo |
| `activo` | `boolean` | Sí | Si se pueden abrir grupos de este curso (por omisión: `true`) |
| `actualizado_en` | `timestamptz` | Sí | Último cambio (por omisión: `now()`) |

Restricciones e índices:

- `CONSTRAINT curso_pk PRIMARY KEY (tipo_acreditacion, modalidad)`
- `CONSTRAINT curso_tipo_ck CHECK (tipo_acreditacion IN ('poda', 'dictaminador'))`
- `CONSTRAINT curso_modalidad_ck CHECK (modalidad IN ('nueva', 'renovacion'))`
- `CONSTRAINT curso_dias_ck CHECK (dias_duracion BETWEEN 1 AND 15 AND dias_minimos_asistencia BETWEEN 1 AND dias_duracion)`
- `CONSTRAINT curso_calificacion_ck CHECK (calificacion_minima BETWEEN 0 AND 10)`
- `CONSTRAINT curso_cupo_ck CHECK (cupo_minimo >= 1 AND cupo_minimo <= cupo_maximo)`

## requisito

Catálogo de requisitos. Un requisito es un documento que se carga o un registro que el sistema comprueba en su propio padrón.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `clave` | `text` | Sí | Identificador corto |
| `nombre` | `text` | Sí | Nombre visible |
| `descripcion` | `text` | Sí | Características que debe cumplir (por omisión: `''`) |
| `forma` | `text` | Sí | documento: se carga un archivo; registro: el sistema lo comprueba en el padrón |
| `momento` | `text` | Sí | en_linea: se carga al solicitar; cotejo: se presenta en la cita |
| `activo` | `boolean` | Sí | Si se pide en solicitudes nuevas (por omisión: `true`) |

Restricciones e índices:

- `CONSTRAINT requisito_pk PRIMARY KEY (clave)`
- `CONSTRAINT requisito_forma_ck CHECK (forma IN ('documento', 'registro'))`
- `CONSTRAINT requisito_momento_ck CHECK (momento IN ('en_linea', 'cotejo'))`

## requisito_curso

Qué requisitos pide cada curso, en qué orden. Editable: agregar o quitar un documento no requiere programar.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `tipo_acreditacion` | `text` | Sí | Curso |
| `modalidad` | `text` | Sí | Curso |
| `requisito` | `text` | Sí | Requisito |
| `orden` | `smallint` | Sí | Orden en que se muestra |
| `obligatorio` | `boolean` | Sí | Si falta, la solicitud no se puede enviar. Los no obligatorios dependen del caso (por ejemplo, constancias de capacitación sólo para carrera técnica) y los valora quien revisa (por omisión: `true`) |
| `nota` | `text` | Sí | Indicación particular de este curso para el requisito (por omisión: `''`) |

Restricciones e índices:

- `CONSTRAINT requisito_curso_pk PRIMARY KEY (tipo_acreditacion, modalidad, requisito)`
- `CONSTRAINT requisito_curso_curso_fk FOREIGN KEY (tipo_acreditacion, modalidad) REFERENCES apd.curso (tipo_acreditacion, modalidad)`
- `CONSTRAINT requisito_curso_requisito_fk FOREIGN KEY (requisito) REFERENCES apd.requisito (clave)`

## organizacion

Catálogo de organizaciones de procedencia (empresas, alcaldías, dependencias, instituciones). Sirve para agrupar la demanda; no inscribe ni paga.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | `uuid` | Sí | Identificador interno (por omisión: `gen_random_uuid()`) |
| `tipo` | `text` | Sí | empresa, alcaldia, dependencia_publica, institucion_academica u otra |
| `nombre` | `text` | Sí | Nombre oficial |
| `nombre_normalizado` | `text` | Sí | Nombre sin acentos, en minúsculas y sin espacios dobles; lo calcula la base y evita duplicados como «CFE» y «C.F.E.» |
| `activa` | `boolean` | Sí | Si aparece al solicitar (por omisión: `true`) |
| `es_ficticio` | `boolean` | Sí | Dato de prueba (por omisión: `false`) |

Restricciones e índices:

- `CONSTRAINT organizacion_pk PRIMARY KEY (id)`
- `CONSTRAINT organizacion_tipo_ck CHECK (tipo IN ('empresa', 'alcaldia', 'dependencia_publica', 'institucion_academica', 'otra'))`
- `CONSTRAINT organizacion_nombre_uk UNIQUE (nombre_normalizado)`

## solicitante

Cuenta de la persona solicitante. Una por CURP. La contraseña se guarda derivada con scrypt (parámetros de acceso), nunca en claro. Las personas del padrón migrado quedan sin activar hasta que se registran con su CURP.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | `uuid` | Sí | Identificador interno (por omisión: `gen_random_uuid()`) |
| `curp` | `text` | Sí | CURP en mayúsculas; identificador único de la cuenta |
| `nombre` | `text` | Sí | Nombre(s) |
| `primer_apellido` | `text` | Sí | Primer apellido |
| `segundo_apellido` | `text` | No | Segundo apellido, si lo hay |
| `correo` | `text` | Sí | Correo de contacto, en minúsculas |
| `telefono` | `text` | Sí | Teléfono de contacto, 10 dígitos |
| `contrasena_hash` | `text` | No | scrypt N=2^14, r=8, p=1, base64url. Vacía sólo en cuentas sin activar |
| `estado` | `text` | Sí | activa, bloqueada, inactiva o sin_activar (persona del padrón migrado que aún no crea su contraseña) (por omisión: `'activa'`) |
| `intentos_fallidos` | `smallint` | Sí | Intentos de entrada fallidos seguidos (por omisión: `0`) |
| `bloqueada_hasta` | `timestamptz` | No | Fin del bloqueo por intentos |
| `debe_cambiar_contrasena` | `boolean` | Sí | Tiene una contraseña temporal de un solo uso (por omisión: `false`) |
| `creada_en` | `timestamptz` | Sí | Alta de la cuenta (por omisión: `now()`) |
| `es_ficticio` | `boolean` | Sí | Dato de prueba (por omisión: `false`) |

Restricciones e índices:

- `CONSTRAINT solicitante_pk PRIMARY KEY (id)`
- `CONSTRAINT solicitante_curp_uk UNIQUE (curp)`
- `CONSTRAINT solicitante_curp_ck CHECK (curp ~ '^[A-Z][AEIOUX][A-Z]{2}[0-9]{6}[HMX][A-Z]{5}[0-9A-Z][0-9]$')`
- `CONSTRAINT solicitante_correo_ck CHECK (correo = lower(correo) AND correo ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')`
- `CONSTRAINT solicitante_telefono_ck CHECK (telefono ~ '^[0-9]{10}$')`
- `CONSTRAINT solicitante_estado_ck CHECK (estado IN ('activa', 'bloqueada', 'inactiva', 'sin_activar'))`
- `CONSTRAINT solicitante_contrasena_ck CHECK ((estado = 'sin_activar') = (contrasena_hash IS NULL))`
- `CREATE INDEX solicitante_apellidos ON apd.solicitante (primer_apellido, segundo_apellido, nombre)`

## sesion_solicitante

Sesiones de las personas solicitantes. Sólo se guarda el resumen sha256 del testigo, nunca el testigo.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | `uuid` | Sí | Identificador interno (por omisión: `gen_random_uuid()`) |
| `solicitante_id` | `uuid` | Sí | Cuenta |
| `testigo_sha256` | `text` | Sí | Resumen sha256 del testigo de 32 bytes |
| `creada_en` | `timestamptz` | Sí | Inicio (por omisión: `now()`) |
| `vence_en` | `timestamptz` | Sí | Vencimiento |
| `cerrada_en` | `timestamptz` | No | Cierre: salida, cambio de contraseña o desactivación |

Restricciones e índices:

- `CONSTRAINT sesion_solicitante_pk PRIMARY KEY (id)`
- `CONSTRAINT sesion_solicitante_testigo_uk UNIQUE (testigo_sha256)`
- `CONSTRAINT sesion_solicitante_solicitante_fk FOREIGN KEY (solicitante_id) REFERENCES apd.solicitante (id)`
- `CREATE INDEX sesion_solicitante_solicitante ON apd.sesion_solicitante (solicitante_id)`

## acreditacion

Padrón de acreditaciones emitidas, del sistema o migradas de Kobo o papel. Su estado de vigencia no se guarda: lo calcula apd.estado_acreditacion() con la fecha del día.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | `uuid` | Sí | Identificador interno (por omisión: `gen_random_uuid()`) |
| `numero` | `text` | Sí | Número impreso en la credencial; lo asigna la base si no se migra |
| `solicitante_id` | `uuid` | Sí | Titular |
| `tipo_acreditacion` | `text` | Sí | poda o dictaminador |
| `solicitud_id` | `uuid` | No | Solicitud que la originó; vacía si se migró |
| `emitida_en` | `date` | Sí | Fecha de emisión (Ciudad de México) |
| `vence_en` | `date` | Sí | Último día de vigencia: un año después de la emisión, menos un día. Lo calcula la base |
| `entregada_en` | `date` | No | Entrega en persona |
| `origen` | `text` | Sí | sistema, kobo o papel (por omisión: `'sistema'`) |
| `folio_origen` | `text` | No | Folio en el sistema de origen, para las migradas |
| `es_ficticio` | `boolean` | Sí | Dato de prueba (por omisión: `false`) |

Restricciones e índices:

- `CONSTRAINT acreditacion_pk PRIMARY KEY (id)`
- `CONSTRAINT acreditacion_numero_uk UNIQUE (numero)`
- `CONSTRAINT acreditacion_solicitante_fk FOREIGN KEY (solicitante_id) REFERENCES apd.solicitante (id)`
- `CONSTRAINT acreditacion_tipo_ck CHECK (tipo_acreditacion IN ('poda', 'dictaminador'))`
- `CONSTRAINT acreditacion_origen_ck CHECK (origen IN ('sistema', 'kobo', 'papel'))`
- `CONSTRAINT acreditacion_origen_solicitud_ck CHECK ((origen = 'sistema') = (solicitud_id IS NOT NULL))`
- `CONSTRAINT acreditacion_fechas_ck CHECK (vence_en > emitida_en AND (entregada_en IS NULL OR entregada_en >= emitida_en))`
- `CREATE INDEX acreditacion_titular ON apd.acreditacion (solicitante_id, tipo_acreditacion, vence_en DESC)`
- `CREATE INDEX acreditacion_vence ON apd.acreditacion (vence_en)`

## solicitud

Un trámite: una persona, un curso. Sus cambios de estado los valida la base y quedan en la bitácora.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | `uuid` | Sí | Identificador interno (por omisión: `gen_random_uuid()`) |
| `folio` | `text` | Sí | Folio público; lo asigna la base (APD-S-AAAA-NNNNN) |
| `solicitante_id` | `uuid` | Sí | Persona solicitante |
| `tipo_acreditacion` | `text` | Sí | Curso solicitado |
| `modalidad` | `text` | Sí | Curso solicitado |
| `organizacion_id` | `uuid` | No | Organización de procedencia; vacía para particulares |
| `acreditacion_anterior_id` | `uuid` | No | Acreditación que se renueva; obligatoria en renovación |
| `rfc_factura` | `text` | No | RFC a quien se factura el pago de derechos (persona física o moral) |
| `razon_social_factura` | `text` | No | Nombre o razón social a quien se factura |
| `perfil_academico` | `text` | No | Sólo dictaminador: titulo, pasante, creditos_100 o tecnica. Determina la experiencia mínima |
| `carrera` | `text` | No | Sólo dictaminador: carrera o formación declarada |
| `anios_experiencia` | `numeric(4,1)` | No | Sólo dictaminador: años de experiencia en manejo de arbolado declarados; los documentos los comprueban |
| `estado` | `text` | Sí | Ver apd.transicion_solicitud() (por omisión: `'borrador'`) |
| `estado_desde` | `timestamptz` | Sí | Desde cuándo está en el estado actual; lo pone la base (por omisión: `now()`) |
| `enviada_en` | `timestamptz` | No | Primer envío a revisión; lo pone la base |
| `cita_en` | `timestamptz` | No | Cita para el cotejo presencial |
| `lista_para_curso_en` | `timestamptz` | No | Inicio de la espera de grupo; no cambia si un grupo se cancela, para conservar la antigüedad |
| `motivo_cierre` | `text` | No | Motivo de cancelación o conclusión sin atender |
| `folio_origen` | `text` | No | Folio en Kobo, para las migradas |
| `creada_en` | `timestamptz` | Sí | Alta (por omisión: `now()`) |
| `es_ficticio` | `boolean` | Sí | Dato de prueba (por omisión: `false`) |

Restricciones e índices:

- `CONSTRAINT solicitud_pk PRIMARY KEY (id)`
- `CONSTRAINT solicitud_folio_uk UNIQUE (folio)`
- `CONSTRAINT solicitud_solicitante_fk FOREIGN KEY (solicitante_id) REFERENCES apd.solicitante (id)`
- `CONSTRAINT solicitud_curso_fk FOREIGN KEY (tipo_acreditacion, modalidad) REFERENCES apd.curso (tipo_acreditacion, modalidad)`
- `CONSTRAINT solicitud_organizacion_fk FOREIGN KEY (organizacion_id) REFERENCES apd.organizacion (id)`
- `CONSTRAINT solicitud_anterior_fk FOREIGN KEY (acreditacion_anterior_id) REFERENCES apd.acreditacion (id)`
- `CONSTRAINT solicitud_estado_ck CHECK (estado IN ('borrador', 'enviada', 'con_observaciones', 'validada_en_linea', 'lista_para_curso', 'inscrita', 'aprobada', 'acreditada', 'no_acreditada', 'sin_derecho_examen', 'cancelada', 'concluida_sin_atender'))`
- `CONSTRAINT solicitud_renovacion_ck CHECK ((modalidad = 'renovacion') = (acreditacion_anterior_id IS NOT NULL))`
- `CONSTRAINT solicitud_rfc_ck CHECK (rfc_factura IS NULL OR rfc_factura ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$')`
- `CONSTRAINT solicitud_perfil_ck CHECK (perfil_academico IS NULL OR perfil_academico IN ('titulo', 'pasante', 'creditos_100', 'tecnica'))`
- `CONSTRAINT solicitud_perfil_tipo_ck CHECK (tipo_acreditacion = 'dictaminador' OR (perfil_academico IS NULL AND carrera IS NULL AND anios_experiencia IS NULL))`
- `CONSTRAINT solicitud_experiencia_ck CHECK (anios_experiencia IS NULL OR anios_experiencia BETWEEN 0 AND 70)`
- `CONSTRAINT solicitud_cierre_ck CHECK (estado NOT IN ('cancelada', 'concluida_sin_atender') OR length(trim(coalesce(motivo_cierre, ''))) > 0)`
- `CREATE UNIQUE INDEX solicitud_una_activa ON apd.solicitud (solicitante_id, tipo_acreditacion) WHERE estado NOT IN ('acreditada', 'no_acreditada', 'sin_derecho_examen', 'cancelada', 'concluida_sin_atender')`
- `CREATE INDEX solicitud_bandeja ON apd.solicitud (tipo_acreditacion, modalidad, estado, lista_para_curso_en)`
- `CREATE INDEX solicitud_organizacion ON apd.solicitud (organizacion_id)`
- `CREATE INDEX solicitud_anterior ON apd.solicitud (acreditacion_anterior_id)`

## revision

Cada ronda de revisión documental en línea, con su resultado. Permite contar cuántas vueltas dio un expediente.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | `uuid` | Sí | Identificador interno (por omisión: `gen_random_uuid()`) |
| `solicitud_id` | `uuid` | Sí | Solicitud revisada |
| `resultado` | `text` | Sí | con_observaciones o validada |
| `observacion_general` | `text` | Sí | Indicaciones para la persona solicitante (por omisión: `''`) |
| `revisor` | `text` | Sí | Cuenta del personal (acceso) |
| `revisada_en` | `timestamptz` | Sí | Fecha de la revisión (por omisión: `now()`) |

Restricciones e índices:

- `CONSTRAINT revision_pk PRIMARY KEY (id)`
- `CONSTRAINT revision_solicitud_fk FOREIGN KEY (solicitud_id) REFERENCES apd.solicitud (id)`
- `CONSTRAINT revision_resultado_ck CHECK (resultado IN ('con_observaciones', 'validada'))`
- `CREATE INDEX revision_solicitud ON apd.revision (solicitud_id, revisada_en)`

## documento

Archivos cargados por requisito. El archivo vive en el almacén, fuera de lo publicado; aquí sólo su clave. Una nueva carga no borra la anterior: la marca como no vigente.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | `uuid` | Sí | Identificador interno (por omisión: `gen_random_uuid()`) |
| `solicitud_id` | `uuid` | Sí | Solicitud |
| `requisito` | `text` | Sí | Requisito que atiende |
| `archivo_clave` | `text` | Sí | Clave exacta en el almacén, con sello propio |
| `nombre_original` | `text` | Sí | Nombre con que se cargó |
| `tipo_mime` | `text` | Sí | application/pdf, image/jpeg o image/png |
| `tamano_bytes` | `integer` | Sí | Tamaño; el máximo lo fija el parámetro tamano_maximo_archivo_bytes |
| `sha256` | `text` | Sí | Suma del archivo, para comprobar el almacén |
| `estado` | `text` | Sí | pendiente, aceptado o con_observacion (por omisión: `'pendiente'`) |
| `observacion` | `text` | Sí | Qué corregir (por omisión: `''`) |
| `vigente` | `boolean` | Sí | Es la última carga de ese requisito (por omisión: `true`) |
| `cargado_en` | `timestamptz` | Sí | Carga (por omisión: `now()`) |
| `revisado_por` | `text` | No | Cuenta del personal (acceso) |
| `revisado_en` | `timestamptz` | No | Revisión |

Restricciones e índices:

- `CONSTRAINT documento_pk PRIMARY KEY (id)`
- `CONSTRAINT documento_archivo_uk UNIQUE (archivo_clave)`
- `CONSTRAINT documento_solicitud_fk FOREIGN KEY (solicitud_id) REFERENCES apd.solicitud (id)`
- `CONSTRAINT documento_requisito_fk FOREIGN KEY (requisito) REFERENCES apd.requisito (clave)`
- `CONSTRAINT documento_mime_ck CHECK (tipo_mime IN ('application/pdf', 'image/jpeg', 'image/png'))`
- `CONSTRAINT documento_tamano_ck CHECK (tamano_bytes > 0)`
- `CONSTRAINT documento_sha256_ck CHECK (sha256 ~ '^[0-9a-f]{64}$')`
- `CONSTRAINT documento_estado_ck CHECK (estado IN ('pendiente', 'aceptado', 'con_observacion'))`
- `CONSTRAINT documento_observacion_ck CHECK (estado <> 'con_observacion' OR length(trim(observacion)) > 0)`
- `CREATE UNIQUE INDEX documento_uno_vigente ON apd.documento (solicitud_id, requisito) WHERE vigente`

## grupo

Grupo de un curso. Copia los cupos del curso al crearse. Sólo se confirma con el cupo mínimo y nunca pasa del máximo.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | `uuid` | Sí | Identificador interno (por omisión: `gen_random_uuid()`) |
| `folio` | `text` | Sí | Folio del grupo; lo asigna la base (APD-G-AAAA-NNN) |
| `tipo_acreditacion` | `text` | Sí | Curso |
| `modalidad` | `text` | Sí | Curso |
| `integracion` | `text` | Sí | especifico (una organización) o combinado |
| `organizacion_id` | `uuid` | No | Organización, sólo en grupos específicos |
| `cupo_minimo` | `smallint` | Sí | Copiado del curso al crearse; lo pone la base |
| `cupo_maximo` | `smallint` | Sí | Copiado del curso al crearse; lo pone la base |
| `instructor` | `text` | No | Cuenta del instructor (acceso); obligatoria para confirmar |
| `sede` | `text` | No | Instalación de la Secretaría; obligatoria para confirmar |
| `fecha_inicio` | `date` | No | Primer día; obligatoria para confirmar |
| `estado` | `text` | Sí | en_integracion, confirmado, en_curso, concluido o cancelado (por omisión: `'en_integracion'`) |
| `estado_desde` | `timestamptz` | Sí | Desde cuándo; lo pone la base (por omisión: `now()`) |
| `motivo_cancelacion` | `text` | No | Obligatorio al cancelar |
| `creado_en` | `timestamptz` | Sí | Alta (por omisión: `now()`) |
| `es_ficticio` | `boolean` | Sí | Dato de prueba (por omisión: `false`) |

Restricciones e índices:

- `CONSTRAINT grupo_pk PRIMARY KEY (id)`
- `CONSTRAINT grupo_folio_uk UNIQUE (folio)`
- `CONSTRAINT grupo_curso_fk FOREIGN KEY (tipo_acreditacion, modalidad) REFERENCES apd.curso (tipo_acreditacion, modalidad)`
- `CONSTRAINT grupo_organizacion_fk FOREIGN KEY (organizacion_id) REFERENCES apd.organizacion (id)`
- `CONSTRAINT grupo_integracion_ck CHECK (integracion IN ('especifico', 'combinado'))`
- `CONSTRAINT grupo_especifico_ck CHECK ((integracion = 'especifico') = (organizacion_id IS NOT NULL))`
- `CONSTRAINT grupo_cupo_ck CHECK (cupo_minimo >= 1 AND cupo_minimo <= cupo_maximo)`
- `CONSTRAINT grupo_estado_ck CHECK (estado IN ('en_integracion', 'confirmado', 'en_curso', 'concluido', 'cancelado'))`
- `CONSTRAINT grupo_confirmado_ck CHECK (estado IN ('en_integracion', 'cancelado') OR (instructor IS NOT NULL AND sede IS NOT NULL AND fecha_inicio IS NOT NULL))`
- `CONSTRAINT grupo_cancelado_ck CHECK (estado <> 'cancelado' OR length(trim(coalesce(motivo_cancelacion, ''))) > 0)`
- `CREATE INDEX grupo_curso_estado ON apd.grupo (tipo_acreditacion, modalidad, estado)`

## inscripcion

Una solicitud en un grupo. No se borra: una baja o una cancelación la deja inactiva y la solicitud regresa a la bandeja con su antigüedad.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | `uuid` | Sí | Identificador interno (por omisión: `gen_random_uuid()`) |
| `solicitud_id` | `uuid` | Sí | Solicitud |
| `grupo_id` | `uuid` | Sí | Grupo |
| `activa` | `boolean` | Sí | Sigue en el grupo (por omisión: `true`) |
| `inscrita_en` | `timestamptz` | Sí | Alta en el grupo (por omisión: `now()`) |
| `baja_en` | `timestamptz` | No | Baja o cancelación del grupo |
| `motivo_baja` | `text` | No | Por qué salió del grupo |

Restricciones e índices:

- `CONSTRAINT inscripcion_pk PRIMARY KEY (id)`
- `CONSTRAINT inscripcion_solicitud_fk FOREIGN KEY (solicitud_id) REFERENCES apd.solicitud (id)`
- `CONSTRAINT inscripcion_grupo_fk FOREIGN KEY (grupo_id) REFERENCES apd.grupo (id)`
- `CONSTRAINT inscripcion_baja_ck CHECK (activa = (baja_en IS NULL))`
- `CREATE UNIQUE INDEX inscripcion_una_activa ON apd.inscripcion (solicitud_id) WHERE activa`
- `CREATE INDEX inscripcion_grupo ON apd.inscripcion (grupo_id) WHERE activa`

## asistencia

Asistencia por día de curso, capturada por el instructor.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `inscripcion_id` | `uuid` | Sí | Inscripción |
| `dia` | `smallint` | Sí | Día del curso, desde 1 |
| `asistio` | `boolean` | Sí | Asistió ese día |
| `capturada_por` | `text` | Sí | Cuenta del instructor (acceso) |
| `capturada_en` | `timestamptz` | Sí | Captura (por omisión: `now()`) |

Restricciones e índices:

- `CONSTRAINT asistencia_pk PRIMARY KEY (inscripcion_id, dia)`
- `CONSTRAINT asistencia_inscripcion_fk FOREIGN KEY (inscripcion_id) REFERENCES apd.inscripcion (id)`
- `CONSTRAINT asistencia_dia_ck CHECK (dia >= 1)`

## examen

Calificación del examen final, capturada por el instructor. Sólo se admite con la asistencia mínima.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `inscripcion_id` | `uuid` | Sí | Inscripción |
| `presentado_en` | `date` | Sí | Fecha del examen |
| `calificacion` | `numeric(3,1)` | Sí | De 0.0 a 10.0 |
| `capturado_por` | `text` | Sí | Cuenta del instructor (acceso) |
| `capturado_en` | `timestamptz` | Sí | Captura (por omisión: `now()`) |

Restricciones e índices:

- `CONSTRAINT examen_pk PRIMARY KEY (inscripcion_id)`
- `CONSTRAINT examen_inscripcion_fk FOREIGN KEY (inscripcion_id) REFERENCES apd.inscripcion (id)`
- `CONSTRAINT examen_calificacion_ck CHECK (calificacion BETWEEN 0 AND 10)`

## folio_contador

Último número asignado por serie y año. Lo usa sólo la base al asignar folios.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `serie` | `text` | Sí | S (solicitud), G (grupo), PD (acreditación de poda), DT (acreditación de dictaminador) |
| `anio` | `smallint` | Sí | Año |
| `ultimo` | `integer` | Sí | Último número asignado (por omisión: `0`) |

Restricciones e índices:

- `CONSTRAINT folio_contador_pk PRIMARY KEY (serie, anio)`

## Llaves entre tablas que se agregan al final

- acreditacion y solicitud se refieren mutuamente (la renovación apunta a la acreditación anterior; la acreditación apunta a la solicitud que la originó): esta llave se agrega cuando ya existen las dos tablas.
  `ALTER TABLE apd.acreditacion ADD CONSTRAINT acreditacion_solicitud_fk FOREIGN KEY (solicitud_id) REFERENCES apd.solicitud (id)`
- Una solicitud origina a lo más una acreditación.
  `CREATE UNIQUE INDEX acreditacion_solicitud_uk ON apd.acreditacion (solicitud_id) WHERE solicitud_id IS NOT NULL`
