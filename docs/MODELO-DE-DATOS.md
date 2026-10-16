# Modelo de datos · esquema `apd`

> Archivo generado por herramientas/generar-esquema.mjs desde db/esquema.json. No se edita a mano.

Las reglas que la base impone además de estas restricciones (estados, cupos, vigencia, folios, bitácora)
están en `db/apd/03-apd-reglas.sql` y se describen en `docs/REGLAS.md`.

## Tablas

- [`parametro`](#parametro) — Valores que gobiernan reglas del sistema y que la administración puede cambiar sin programar. Cada cambio queda en la bitácora.
- [`curso`](#curso) — Los cuatro cursos: tipo de acreditación por modalidad. Guarda duración, asistencia mínima, calificación mínima y cupos vigentes; un grupo copia los cupos al crearse.
- [`requisito`](#requisito) — Catálogo de requisitos. Un requisito es un documento que se carga o un registro que el sistema comprueba en su propio padrón.
- [`requisito_curso`](#requisito_curso) — Qué requisitos pide cada curso, en qué orden. Editable: agregar o quitar un documento no requiere programar.
- [`organizacion`](#organizacion) — Catálogo de instituciones de adscripción: empresas, consultorías o particulares; dependencias de la Ciudad de México; alcaldías; dependencias federales; instituciones educativas. Sirve para agrupar la demanda; no inscribe ni paga. Las 16 alcaldías y las dependencias que el formulario ofrece por nombre (SOBSE, SEDEMA y sus Direcciones Generales, PAOT, CFE, UNAM) vienen en el catálogo inicial con su clave; las demás las agrega la base cuando una persona escribe un nombre nuevo.
- [`carrera`](#carrera) — Catálogo de carreras para la pregunta «¿Qué carrera estudiaste?». No hay catálogo de carreras afines (decisión 2026-10-15, Liber): la carrera es un campo abierto que el personal valida en la revisión documental. Empieza con las que nombran los lineamientos (principal) y crece con las que la Secretaría acepta de manera explícita. El grupo decide la experiencia mínima del dictaminador: principal y afín, dos años con licenciatura; disciplina afín, cinco; no afín, no cumple. Las que escribe una persona entran sin grupo; sólo las aceptadas se sugieren al escribir.
- [`solicitante`](#solicitante) — Cuenta de la persona solicitante. Una por CURP, con su fotografía de frente (apd.fotografia) y con un solo expediente físico para todos sus trámites. La contraseña se guarda derivada con scrypt (parámetros de acceso), nunca en claro. Las personas del padrón migrado quedan sin activar hasta que se registran con su CURP.
- [`fotografia`](#fotografia) — Fotografía de frente de la persona, para reconocerla en la cita de cotejo, en el curso y en el examen. La carga ella al crear su cuenta; en el cotejo el personal confirma que corresponde a quien se presenta o toma una nueva. No es la foto de la credencial: esa se toma al entregar la acreditación y se guarda como documento de la solicitud. El archivo vive en el almacén, fuera de lo publicado; aquí sólo su clave. Una nueva carga no borra la anterior: la marca como no vigente.
- [`sesion_solicitante`](#sesion_solicitante) — Sesiones de las personas solicitantes. Sólo se guarda el resumen sha256 del testigo, nunca el testigo.
- [`acreditacion`](#acreditacion) — Padrón de acreditaciones emitidas, del sistema o migradas de Kobo o papel. Su estado de vigencia no se guarda: lo calcula apd.estado_acreditacion() con la fecha del día.
- [`solicitud`](#solicitud) — Un trámite: una persona, un curso. El expediente físico es de la persona (apd.solicitante.numero_expediente), no del trámite. Sus cambios de estado los valida la base y quedan en la bitácora.
- [`revision`](#revision) — Cada ronda de revisión documental en línea, con su resultado. Permite contar cuántas vueltas dio un expediente.
- [`documento`](#documento) — Archivos cargados por requisito. El archivo vive en el almacén, fuera de lo publicado; aquí sólo su clave. Una nueva carga no borra la anterior: la marca como no vigente.
- [`grupo`](#grupo) — Grupo de un curso. Copia los cupos del curso al crearse. Sólo se confirma con el cupo mínimo y nunca pasa del máximo.
- [`inscripcion`](#inscripcion) — Una solicitud en un grupo. No se borra: una baja o una cancelación la deja inactiva y la solicitud regresa a la bandeja con su antigüedad.
- [`asistencia`](#asistencia) — Asistencia por día de curso, capturada por el instructor.
- [`examen`](#examen) — Calificación del examen final: la captura el instructor o llega del sistema de examen en línea. Sólo se admite con la asistencia mínima, y una vez registrada no se modifica (el resultado es inapelable).
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
| `pago_concepto` | `text` | Sí | Concepto del pago de derechos que se muestra a la persona al asignarle la cita de cotejo |
| `pago_monto` | `numeric(10,2)` | No | Monto del pago de derechos de este curso, en pesos. Distinto por curso. Lo actualiza el personal cuando la Gaceta Oficial publica un costo nuevo. Vacío mientras no se capture |
| `pago_fundamento` | `text` | No | Publicación de la Gaceta Oficial que fija el monto vigente (fecha y número). Obligatorio si hay monto |
| `pago_vigente_desde` | `date` | No | Desde cuándo aplica el monto vigente. Obligatorio si hay monto |
| `activo` | `boolean` | Sí | Si se pueden abrir grupos de este curso (por omisión: `true`) |
| `actualizado_en` | `timestamptz` | Sí | Último cambio (por omisión: `now()`) |

Restricciones e índices:

- `CONSTRAINT curso_pk PRIMARY KEY (tipo_acreditacion, modalidad)`
- `CONSTRAINT curso_tipo_ck CHECK (tipo_acreditacion IN ('poda', 'dictaminador'))`
- `CONSTRAINT curso_modalidad_ck CHECK (modalidad IN ('nueva', 'renovacion'))`
- `CONSTRAINT curso_dias_ck CHECK (dias_duracion BETWEEN 1 AND 15 AND dias_minimos_asistencia BETWEEN 1 AND dias_duracion)`
- `CONSTRAINT curso_calificacion_ck CHECK (calificacion_minima BETWEEN 0 AND 10)`
- `CONSTRAINT curso_cupo_ck CHECK (cupo_minimo >= 1 AND cupo_minimo <= cupo_maximo)`
- `CONSTRAINT curso_pago_ck CHECK (pago_monto IS NULL OR (pago_monto > 0 AND coalesce(trim(pago_fundamento), '') <> '' AND pago_vigente_desde IS NOT NULL))`

## requisito

Catálogo de requisitos. Un requisito es un documento que se carga o un registro que el sistema comprueba en su propio padrón.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `clave` | `text` | Sí | Identificador corto |
| `nombre` | `text` | Sí | Nombre visible |
| `descripcion` | `text` | Sí | Características que debe cumplir (por omisión: `''`) |
| `forma` | `text` | Sí | documento: se carga un archivo; registro: el sistema lo comprueba en el padrón |
| `momento` | `text` | Sí | en_linea: lo carga la persona al solicitar; cotejo: lo carga el personal de la Secretaría en la cita presencial; entrega: lo carga el personal al entregar la acreditación (comprobante de recepción firmado y fotografía de la credencial) |
| `enlace` | `text` | No | Dirección oficial donde la persona obtiene el documento (por ejemplo, la CURP en gob.mx); se muestra con el requisito |
| `enlace_texto` | `text` | No | Texto del enlace |
| `nombre_archivo` | `text` | No | Tipo de documento con que se nombra el archivo guardado (por ejemplo CURP o IDENTIFICACION OFICIAL), en mayúsculas y sin acentos; si está vacío se usa el nombre del requisito |
| `formatos` | `text[]` | Sí | Tipos de archivo que admite: PDF, JPG o PNG; una fotografía sólo admite imagen (por omisión: `ARRAY['application/pdf', 'image/jpeg', 'image/png']::text[]`) |
| `activo` | `boolean` | Sí | Si se pide en solicitudes nuevas (por omisión: `true`) |

Restricciones e índices:

- `CONSTRAINT requisito_pk PRIMARY KEY (clave)`
- `CONSTRAINT requisito_forma_ck CHECK (forma IN ('documento', 'registro'))`
- `CONSTRAINT requisito_momento_ck CHECK (momento IN ('en_linea', 'cotejo', 'entrega'))`
- `CONSTRAINT requisito_enlace_ck CHECK ((enlace IS NULL) = (enlace_texto IS NULL) AND (enlace IS NULL OR enlace ~ '^https://'))`
- `CONSTRAINT requisito_nombre_archivo_ck CHECK (nombre_archivo IS NULL OR nombre_archivo ~ '^[A-Z0-9Ñ ]+$')`
- `CONSTRAINT requisito_formatos_ck CHECK (cardinality(formatos) > 0 AND formatos <@ ARRAY['application/pdf', 'image/jpeg', 'image/png']::text[])`

## requisito_curso

Qué requisitos pide cada curso, en qué orden. Editable: agregar o quitar un documento no requiere programar.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `tipo_acreditacion` | `text` | Sí | Curso |
| `modalidad` | `text` | Sí | Curso |
| `requisito` | `text` | Sí | Requisito |
| `orden` | `smallint` | Sí | Orden en que se muestra |
| `obligatorio` | `boolean` | Sí | Si falta, la solicitud no se puede enviar. Los no obligatorios dependen del caso (por ejemplo, los que sólo se actualizan en una renovación) y los valora quien revisa (por omisión: `true`) |
| `nota` | `text` | Sí | Indicación particular de este curso para el requisito (por omisión: `''`) |

Restricciones e índices:

- `CONSTRAINT requisito_curso_pk PRIMARY KEY (tipo_acreditacion, modalidad, requisito)`
- `CONSTRAINT requisito_curso_curso_fk FOREIGN KEY (tipo_acreditacion, modalidad) REFERENCES apd.curso (tipo_acreditacion, modalidad)`
- `CONSTRAINT requisito_curso_requisito_fk FOREIGN KEY (requisito) REFERENCES apd.requisito (clave)`

## organizacion

Catálogo de instituciones de adscripción: empresas, consultorías o particulares; dependencias de la Ciudad de México; alcaldías; dependencias federales; instituciones educativas. Sirve para agrupar la demanda; no inscribe ni paga. Las 16 alcaldías y las dependencias que el formulario ofrece por nombre (SOBSE, SEDEMA y sus Direcciones Generales, PAOT, CFE, UNAM) vienen en el catálogo inicial con su clave; las demás las agrega la base cuando una persona escribe un nombre nuevo.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | `uuid` | Sí | Identificador interno (por omisión: `gen_random_uuid()`) |
| `tipo` | `text` | Sí | privada (persona moral o física: empresa, consultoría o particular), dependencia_cdmx, alcaldia, dependencia_federal o educativa |
| `clave` | `text` | No | Clave estable de las que el formulario ofrece como opción (sobse, sedema, paot, cfe, una por alcaldía); vacía en las que se agregan escritas |
| `nombre` | `text` | Sí | Nombre oficial |
| `nombre_normalizado` | `text` | Sí | Nombre sin acentos, en minúsculas y sin espacios dobles; lo calcula la base y evita duplicados como «CFE» y «C.F.E.» |
| `activa` | `boolean` | Sí | Si aparece al solicitar (por omisión: `true`) |
| `es_ficticio` | `boolean` | Sí | Dato de prueba (por omisión: `false`) |

Restricciones e índices:

- `CONSTRAINT organizacion_pk PRIMARY KEY (id)`
- `CONSTRAINT organizacion_tipo_ck CHECK (tipo IN ('privada', 'dependencia_cdmx', 'alcaldia', 'dependencia_federal', 'educativa'))`
- `CONSTRAINT organizacion_clave_uk UNIQUE (clave)`
- `CONSTRAINT organizacion_nombre_uk UNIQUE (nombre_normalizado)`

## carrera

Catálogo de carreras para la pregunta «¿Qué carrera estudiaste?». No hay catálogo de carreras afines (decisión 2026-10-15, Liber): la carrera es un campo abierto que el personal valida en la revisión documental. Empieza con las que nombran los lineamientos (principal) y crece con las que la Secretaría acepta de manera explícita. El grupo decide la experiencia mínima del dictaminador: principal y afín, dos años con licenciatura; disciplina afín, cinco; no afín, no cumple. Las que escribe una persona entran sin grupo; sólo las aceptadas se sugieren al escribir.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | `uuid` | Sí | Identificador interno (por omisión: `gen_random_uuid()`) |
| `nombre` | `text` | Sí | Nombre de la carrera |
| `nombre_normalizado` | `text` | Sí | Nombre sin acentos, en minúsculas y sin puntuación; lo calcula la base y evita duplicados |
| `grupo` | `text` | No | principal, afin, disciplina_afin o no_afin; vacío mientras la Secretaría no la clasifica |
| `activa` | `boolean` | Sí | Si aparece en la lista al solicitar (por omisión: `true`) |
| `es_ficticio` | `boolean` | Sí | Dato de prueba (por omisión: `false`) |

Restricciones e índices:

- `CONSTRAINT carrera_pk PRIMARY KEY (id)`
- `CONSTRAINT carrera_grupo_ck CHECK (grupo IN ('principal', 'afin', 'disciplina_afin', 'no_afin'))`
- `CONSTRAINT carrera_nombre_uk UNIQUE (nombre_normalizado)`

## solicitante

Cuenta de la persona solicitante. Una por CURP, con su fotografía de frente (apd.fotografia) y con un solo expediente físico para todos sus trámites. La contraseña se guarda derivada con scrypt (parámetros de acceso), nunca en claro. Las personas del padrón migrado quedan sin activar hasta que se registran con su CURP.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | `uuid` | Sí | Identificador interno (por omisión: `gen_random_uuid()`) |
| `curp` | `text` | Sí | CURP en mayúsculas; identificador único de la cuenta |
| `nombre` | `text` | Sí | Nombre(s) |
| `primer_apellido` | `text` | Sí | Primer apellido |
| `segundo_apellido` | `text` | No | Segundo apellido, si lo hay |
| `sexo` | `text GENERATED ALWAYS AS (substr(curp, 11, 1)) STORED` | Sí | H, M o X: se toma de la posición 11 de la CURP (no se pide aparte); para la estadística de la población acreditada |
| `adscripcion` | `text` | No | Adscripción vigente de la persona: independiente, privada, dependencia_cdmx, alcaldia, dependencia_federal o educativa. La captura al crear su cuenta y la cambia en «Mis datos»; vacía sólo en cuentas del padrón migrado sin activar |
| `organizacion_id` | `uuid` | No | Institución de adscripción vigente, del catálogo y de su mismo tipo; vacía si es independiente |
| `correo` | `text` | Sí | Correo de contacto, en minúsculas |
| `telefono` | `text` | Sí | Teléfono de contacto, 10 dígitos |
| `numero_expediente` | `text` | No | Expediente físico de la persona: uno por CURP, para todos sus trámites. Lo asigna la base al concluir su primer cotejo presencial, consecutivo por año y sin huecos. Formato provisional EXP-AAAA-NNNN |
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
- `CONSTRAINT solicitante_expediente_uk UNIQUE (numero_expediente)`
- `CONSTRAINT solicitante_curp_ck CHECK (apd.curp_valida(curp))`
- `CONSTRAINT solicitante_correo_ck CHECK (correo = lower(correo) AND correo ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')`
- `CONSTRAINT solicitante_telefono_ck CHECK (telefono ~ '^[0-9]{10}$')`
- `CONSTRAINT solicitante_organizacion_fk FOREIGN KEY (organizacion_id) REFERENCES apd.organizacion (id)`
- `CONSTRAINT solicitante_adscripcion_ck CHECK (adscripcion IN ('independiente', 'privada', 'dependencia_cdmx', 'alcaldia', 'dependencia_federal', 'educativa'))`
- `CONSTRAINT solicitante_adscripcion_organizacion_ck CHECK ((organizacion_id IS NULL) = (adscripcion IS NULL OR adscripcion = 'independiente'))`
- `CONSTRAINT solicitante_adscripcion_activa_ck CHECK (estado = 'sin_activar' OR adscripcion IS NOT NULL)`
- `CONSTRAINT solicitante_estado_ck CHECK (estado IN ('activa', 'bloqueada', 'inactiva', 'sin_activar'))`
- `CONSTRAINT solicitante_contrasena_ck CHECK ((estado = 'sin_activar') = (contrasena_hash IS NULL))`
- `CREATE INDEX solicitante_apellidos ON apd.solicitante (primer_apellido, segundo_apellido, nombre)`

## fotografia

Fotografía de frente de la persona, para reconocerla en la cita de cotejo, en el curso y en el examen. La carga ella al crear su cuenta; en el cotejo el personal confirma que corresponde a quien se presenta o toma una nueva. No es la foto de la credencial: esa se toma al entregar la acreditación y se guarda como documento de la solicitud. El archivo vive en el almacén, fuera de lo publicado; aquí sólo su clave. Una nueva carga no borra la anterior: la marca como no vigente.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | `uuid` | Sí | Identificador interno (por omisión: `gen_random_uuid()`) |
| `solicitante_id` | `uuid` | Sí | Persona |
| `archivo_clave` | `text` | Sí | Clave exacta en el almacén, con sello propio |
| `tipo_mime` | `text` | Sí | image/jpeg o image/png |
| `tamano_bytes` | `integer` | Sí | Tamaño; el máximo lo fija el parámetro tamano_maximo_archivo_bytes |
| `sha256` | `text` | Sí | Suma del archivo, para comprobar el almacén |
| `nombre_archivo` | `text` | Sí | Nombre con que se guarda y se descarga: FOTOGRAFIA_NOMBRE COMPLETO.ext. Lo pone la base al cargarla (por omisión: `''`) |
| `origen` | `text` | Sí | en_linea: la cargó la persona; cotejo: la tomó el personal en la cita. Lo pone la base |
| `estado` | `text` | Sí | pendiente: aún no la confirma nadie; confirmada: el personal comprobó en persona, contra la identificación oficial, que corresponde a quien se presentó (por omisión: `'pendiente'`) |
| `vigente` | `boolean` | Sí | Es la última fotografía de la persona (por omisión: `true`) |
| `cargada_en` | `timestamptz` | Sí | Carga (por omisión: `now()`) |
| `cargada_por` | `text` | Sí | Quién la cargó: la persona o la cuenta del personal; lo pone la base (por omisión: `''`) |
| `confirmada_por` | `text` | No | Cuenta del personal que la confirmó (acceso) |
| `confirmada_en` | `timestamptz` | No | Confirmación |

Restricciones e índices:

- `CONSTRAINT fotografia_pk PRIMARY KEY (id)`
- `CONSTRAINT fotografia_archivo_uk UNIQUE (archivo_clave)`
- `CONSTRAINT fotografia_solicitante_fk FOREIGN KEY (solicitante_id) REFERENCES apd.solicitante (id)`
- `CONSTRAINT fotografia_mime_ck CHECK (tipo_mime IN ('image/jpeg', 'image/png'))`
- `CONSTRAINT fotografia_tamano_ck CHECK (tamano_bytes > 0)`
- `CONSTRAINT fotografia_sha256_ck CHECK (sha256 ~ '^[0-9a-f]{64}$')`
- `CONSTRAINT fotografia_origen_ck CHECK (origen IN ('en_linea', 'cotejo'))`
- `CONSTRAINT fotografia_estado_ck CHECK (estado IN ('pendiente', 'confirmada'))`
- `CONSTRAINT fotografia_confirmada_ck CHECK ((estado = 'confirmada') = (confirmada_por IS NOT NULL AND confirmada_en IS NOT NULL))`
- `CREATE UNIQUE INDEX fotografia_una_vigente ON apd.fotografia (solicitante_id) WHERE vigente`

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
| `numero` | `text` | Sí | Número impreso en la credencial; lo asigna la base si no se migra. Formato provisional: Liber lo definirá |
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

Un trámite: una persona, un curso. El expediente físico es de la persona (apd.solicitante.numero_expediente), no del trámite. Sus cambios de estado los valida la base y quedan en la bitácora.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | `uuid` | Sí | Identificador interno (por omisión: `gen_random_uuid()`) |
| `folio` | `text` | Sí | Folio público; lo asigna la base (APD-S-AAAA-NNNNN) |
| `solicitante_id` | `uuid` | Sí | Persona solicitante |
| `tipo_acreditacion` | `text` | Sí | Curso solicitado |
| `modalidad` | `text` | Sí | Curso solicitado |
| `adscripcion` | `text` | No | Adscripción que la persona tenía al enviar la solicitud (copia de la de su cuenta; la pone la base en el alta y en cada envío): independiente, privada, dependencia_cdmx, alcaldia, dependencia_federal o educativa |
| `organizacion_id` | `uuid` | No | Institución de adscripción al enviar (copia de la de su cuenta); vacía si es independiente |
| `acreditacion_anterior_id` | `uuid` | No | Acreditación que se renueva; obligatoria en renovación |
| `factura_rfc` | `text` | No | RFC a cuyo favor se emitió la factura del pago; lo captura el personal en el cotejo |
| `factura_razon_social` | `text` | No | Nombre o razón social a cuyo favor se emitió la factura; lo captura el personal en el cotejo |
| `factura_folio_fiscal` | `text` | No | Folio fiscal (UUID) de la factura, para seguimiento; lo captura el personal en el cotejo |
| `nivel_estudios` | `text` | No | Último nivel o grado de estudios, en poda y en dictaminador (ninguna, preescolar, primaria, secundaria, preparatoria, tecnica, licenciatura, maestria, doctorado). En poda es dato del padrón; en dictaminador, requisito |
| `carrera` | `text` | No | Con licenciatura o posgrado, en poda y en dictaminador: la carrera que estudió, elegida del catálogo o escrita |
| `carrera_id` | `uuid` | No | Carrera en el catálogo apd.carrera; la pone la base (si la escrita no existe, la agrega sin grupo) |
| `estatus_estudios` | `text` | No | Con licenciatura o posgrado, en poda y en dictaminador: situación de ese grado (en_curso, trunco, concluido —carta de pasante o 100 % de créditos— o titulado) |
| `perfil_academico` | `text` | No | Lo calcula la base con nivel, estatus y grupo de la carrera (apd.perfil_academico): licenciatura_afin, disciplina_afin, pasante, tecnica, por_clasificar o no_cumple. No impide enviar: el personal lo revisa en la revisión documental |
| `experiencia_minima` | `numeric(3,1)` | No | Años de experiencia que pide el perfil (2 o 5); la calcula la base. Vacía si el perfil está por clasificar o no cumple |
| `anios_experiencia` | `numeric(4,1)` | No | Sólo dictaminador: años de experiencia en manejo de arbolado declarados; los documentos los comprueban |
| `estado` | `text` | Sí | Ver apd.transicion_solicitud() (por omisión: `'borrador'`) |
| `estado_desde` | `timestamptz` | Sí | Desde cuándo está en el estado actual; lo pone la base (por omisión: `now()`) |
| `enviada_en` | `timestamptz` | No | Primer envío a revisión; lo pone la base |
| `cita_en` | `timestamptz` | No | Cita para el cotejo presencial |
| `pago_monto` | `numeric(10,2)` | No | Monto que se le indicó a la persona al darle su cita: el vigente en ese momento. Un cambio de costo posterior no lo altera. Vacío si aún no había monto capturado |
| `pago_referencia` | `text` | No | Referencia del pago de derechos que se da a la persona con su cita. La asigna la base al validar en línea. Formato provisional (folio sin guiones) hasta definir con Finanzas la referencia o línea de captura |
| `lista_para_curso_en` | `timestamptz` | No | Inicio de la espera de grupo; no cambia si un grupo se cancela, para conservar la antigüedad |
| `motivo_cierre` | `text` | No | Motivo de cancelación o conclusión sin atender |
| `folio_origen` | `text` | No | Folio en Kobo, para las migradas |
| `creada_en` | `timestamptz` | Sí | Alta (por omisión: `now()`) |
| `es_ficticio` | `boolean` | Sí | Dato de prueba (por omisión: `false`) |

Restricciones e índices:

- `CONSTRAINT solicitud_pk PRIMARY KEY (id)`
- `CONSTRAINT solicitud_folio_uk UNIQUE (folio)`
- `CONSTRAINT solicitud_pago_referencia_uk UNIQUE (pago_referencia)`
- `CONSTRAINT solicitud_pago_referencia_ck CHECK (estado NOT IN ('validada_en_linea', 'lista_para_curso', 'inscrita', 'aprobada', 'acreditada', 'no_acreditada', 'sin_derecho_examen') OR pago_referencia IS NOT NULL)`
- `CONSTRAINT solicitud_solicitante_fk FOREIGN KEY (solicitante_id) REFERENCES apd.solicitante (id)`
- `CONSTRAINT solicitud_curso_fk FOREIGN KEY (tipo_acreditacion, modalidad) REFERENCES apd.curso (tipo_acreditacion, modalidad)`
- `CONSTRAINT solicitud_organizacion_fk FOREIGN KEY (organizacion_id) REFERENCES apd.organizacion (id)`
- `CONSTRAINT solicitud_adscripcion_ck CHECK (adscripcion IN ('independiente', 'privada', 'dependencia_cdmx', 'alcaldia', 'dependencia_federal', 'educativa'))`
- `CONSTRAINT solicitud_adscripcion_organizacion_ck CHECK ((organizacion_id IS NULL) = (adscripcion IS NULL OR adscripcion = 'independiente'))`
- `CONSTRAINT solicitud_anterior_fk FOREIGN KEY (acreditacion_anterior_id) REFERENCES apd.acreditacion (id)`
- `CONSTRAINT solicitud_estado_ck CHECK (estado IN ('borrador', 'enviada', 'con_observaciones', 'validada_en_linea', 'lista_para_curso', 'inscrita', 'aprobada', 'acreditada', 'no_acreditada', 'sin_derecho_examen', 'cancelada', 'concluida_sin_atender'))`
- `CONSTRAINT solicitud_renovacion_ck CHECK ((modalidad = 'renovacion') = (acreditacion_anterior_id IS NOT NULL))`
- `CONSTRAINT solicitud_factura_folio_uk UNIQUE (factura_folio_fiscal)`
- `CONSTRAINT solicitud_factura_rfc_ck CHECK (factura_rfc IS NULL OR factura_rfc ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$')`
- `CONSTRAINT solicitud_factura_folio_ck CHECK (factura_folio_fiscal IS NULL OR factura_folio_fiscal ~ '^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$')`
- `CONSTRAINT solicitud_nivel_ck CHECK (nivel_estudios IN ('ninguna', 'preescolar', 'primaria', 'secundaria', 'preparatoria', 'tecnica', 'licenciatura', 'maestria', 'doctorado'))`
- `CONSTRAINT solicitud_estatus_ck CHECK (estatus_estudios IN ('en_curso', 'trunco', 'concluido', 'titulado'))`
- `CONSTRAINT solicitud_carrera_fk FOREIGN KEY (carrera_id) REFERENCES apd.carrera (id)`
- `CONSTRAINT solicitud_perfil_ck CHECK (perfil_academico IN ('licenciatura_afin', 'disciplina_afin', 'pasante', 'tecnica', 'por_clasificar', 'no_cumple'))`
- `CONSTRAINT solicitud_perfil_tipo_ck CHECK (tipo_acreditacion = 'dictaminador' OR (perfil_academico IS NULL AND anios_experiencia IS NULL))`
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
| `nombre_archivo` | `text` | Sí | Nombre con que se guarda y se descarga: TIPO DE DOCUMENTO_NOMBRE COMPLETO.ext (por ejemplo CURP_JUAN RAMIREZ OSORIO.pdf). Lo pone la base al cargarlo (por omisión: `''`) |
| `tipo_mime` | `text` | Sí | application/pdf, image/jpeg o image/png |
| `tamano_bytes` | `integer` | Sí | Tamaño; el máximo lo fija el parámetro tamano_maximo_archivo_bytes |
| `sha256` | `text` | Sí | Suma del archivo, para comprobar el almacén |
| `estado` | `text` | Sí | pendiente, aceptado o con_observacion (por omisión: `'pendiente'`) |
| `observacion` | `text` | Sí | Qué corregir (por omisión: `''`) |
| `vigente` | `boolean` | Sí | Es la última carga de ese requisito (por omisión: `true`) |
| `cargado_en` | `timestamptz` | Sí | Carga (por omisión: `now()`) |
| `cargado_por` | `text` | Sí | Quién lo cargó: la persona solicitante o la cuenta del personal; lo pone la base (por omisión: `''`) |
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
| `instructor` | `text` | No | Cuenta del instructor responsable (acceso); obligatoria para confirmar. Puede cambiar hasta concluir el grupo |
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

Calificación del examen final: la captura el instructor o llega del sistema de examen en línea. Sólo se admite con la asistencia mínima, y una vez registrada no se modifica (el resultado es inapelable).

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `inscripcion_id` | `uuid` | Sí | Inscripción |
| `presentado_en` | `date` | Sí | Fecha del examen |
| `calificacion` | `numeric(3,1)` | Sí | De 0.0 a 10.0 |
| `capturado_por` | `text` | Sí | Cuenta del instructor (acceso) o del sistema de examen en línea |
| `origen` | `text` | Sí | captura: la registra el instructor; examen_web: llega del sistema de examen en salón de cómputo que se conectará después (R36) (por omisión: `'captura'`) |
| `capturado_en` | `timestamptz` | Sí | Captura (por omisión: `now()`) |

Restricciones e índices:

- `CONSTRAINT examen_pk PRIMARY KEY (inscripcion_id)`
- `CONSTRAINT examen_origen_ck CHECK (origen IN ('captura', 'examen_web'))`
- `CONSTRAINT examen_inscripcion_fk FOREIGN KEY (inscripcion_id) REFERENCES apd.inscripcion (id)`
- `CONSTRAINT examen_calificacion_ck CHECK (calificacion BETWEEN 0 AND 10)`

## folio_contador

Último número asignado por serie y año. Lo usa sólo la base al asignar folios.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `serie` | `text` | Sí | S (solicitud), E (expediente físico), G (grupo), PD (acreditación de poda), DT (acreditación de dictaminador) |
| `anio` | `smallint` | Sí | Año |
| `ultimo` | `integer` | Sí | Último número asignado (por omisión: `0`) |

Restricciones e índices:

- `CONSTRAINT folio_contador_pk PRIMARY KEY (serie, anio)`

## Llaves entre tablas que se agregan al final

- acreditacion y solicitud se refieren mutuamente (la renovación apunta a la acreditación anterior; la acreditación apunta a la solicitud que la originó): esta llave se agrega cuando ya existen las dos tablas.
  `ALTER TABLE apd.acreditacion ADD CONSTRAINT acreditacion_solicitud_fk FOREIGN KEY (solicitud_id) REFERENCES apd.solicitud (id)`
- Una solicitud origina a lo más una acreditación.
  `CREATE UNIQUE INDEX acreditacion_solicitud_uk ON apd.acreditacion (solicitud_id) WHERE solicitud_id IS NOT NULL`
