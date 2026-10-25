# Modelo de datos · esquema `apd`

> Archivo generado por herramientas/generar-esquema.mjs desde db/esquema.json. No se edita a mano.

Las reglas que la base impone además de estas restricciones (estados, cupos, vigencia, folios, bitácora)
están en `db/apd/03-apd-reglas.sql` y se describen en `docs/REGLAS.md`.

## Tablas

- [`parametro`](#parametro) — Valores que gobiernan reglas del sistema y que la administración puede cambiar sin programar. Cada cambio queda en la bitácora.
- [`curso`](#curso) — Los cuatro cursos: tipo de acreditación por modalidad. Guarda duración, asistencia mínima, calificación mínima y cupos vigentes; un grupo copia los cupos al crearse.
- [`cuota`](#cuota) — Cuotas que no son de un curso: hoy, la reposición de la credencial (P140, sesión de trabajo del 23/10/2026). Como el pago de cada curso: el monto lo actualiza el personal con la publicación que lo fija y desde cuándo aplica (cambia cada año); cada cambio queda en la bitácora.
- [`requisito`](#requisito) — Catálogo de requisitos. Un requisito es un documento que se carga o un registro que el sistema comprueba en su propio padrón.
- [`requisito_curso`](#requisito_curso) — Qué requisitos pide cada curso, en qué orden. Editable: agregar o quitar un documento no requiere programar.
- [`organizacion`](#organizacion) — Catálogo de instituciones de adscripción: empresas, consultorías o particulares; dependencias de la Ciudad de México; alcaldías; dependencias federales; instituciones educativas. Sirve para agrupar la demanda; no inscribe ni paga. Las 16 alcaldías y las dependencias que el formulario ofrece por nombre (SOBSE, SEDEMA y sus Direcciones Generales, PAOT, CFE, UNAM) vienen en el catálogo inicial con su clave; las demás las agrega la base cuando una persona escribe un nombre nuevo.
- [`carrera`](#carrera) — Catálogo de carreras para la pregunta «¿Qué carrera estudiaste?». No hay catálogo de carreras afines (decisión 2026-10-15, Liber): la carrera es un campo abierto que el personal valida en la revisión documental. Empieza con las que nombran los lineamientos (principal) y crece con las que la Secretaría acepta de manera explícita. El grupo decide la experiencia mínima del dictaminador: principal y afín, dos años con licenciatura; disciplina afín, cinco; no afín, no cumple. Las que escribe una persona entran sin grupo; sólo las aceptadas se sugieren al escribir.
- [`solicitante`](#solicitante) — Cuenta de la persona solicitante. Una por CURP, con su fotografía de frente (apd.fotografia) y con un solo expediente físico para todos sus trámites. La contraseña se guarda derivada con scrypt (parámetros de acceso), nunca en claro. Las personas del padrón migrado quedan sin activar hasta que se registran con su CURP. Registro asistido (decisión 2026-10-25, Liber): a quien no sabe leer ni escribir lo registra en el Vivero el personal de revisión y cotejo, con la persona presente; la cuenta queda activa y sin contraseña (no puede entrar sola), con el teléfono obligatorio y el correo opcional, hasta que la persona la activa con su CURP, su correo y su contraseña.
- [`fotografia`](#fotografia) — Fotografía de frente de la persona, para reconocerla en la cita de cotejo y en el curso; quien aplica el examen la usa para confirmar su identidad y su asistencia, por eso debe verse clara. La carga ella al crear su cuenta; en el cotejo el personal confirma que corresponde a quien se presenta (en la cita no se toma otra). No es la foto de la credencial: esa se toma al entregar la acreditación y se guarda como documento de la solicitud. El archivo vive en el almacén, fuera de lo publicado; aquí sólo su clave. Una nueva carga no borra la anterior: la marca como no vigente.
- [`sesion_solicitante`](#sesion_solicitante) — Sesiones de las personas solicitantes. Sólo se guarda el resumen sha256 del testigo, nunca el testigo.
- [`acreditacion`](#acreditacion) — Padrón de acreditaciones emitidas, del sistema o migradas de Kobo o papel. Su estado de vigencia no se guarda: lo calcula apd.estado_acreditacion() con la fecha del día. Una cancelada (P120, sesión de trabajo del 23/10/2026) lo está desde su cancelada_en: ya no es vigente, no se renueva ni sirve de requisito. La credencial se repone sin cambiar la acreditación (apd.reposicion).
- [`reposicion`](#reposicion) — Reposición de la credencial de una acreditación vigente por pérdida o robo (P140, sesión de trabajo del 23/10/2026). La persona la pide desde «Mis trámites» con el acta que levantó; el personal revisa el acta (la acepta o le pone observaciones), y en el Vivero valida la factura de la cuota de reposición y entrega la credencial repuesta. La acreditación no cambia: mismo número, misma emisión y misma vigencia. El acta vive en el almacén, fuera de lo publicado; aquí sólo su clave. Sus cambios de estado los valida la base y quedan en la bitácora.
- [`solicitud`](#solicitud) — Un trámite: una persona, un curso. El expediente físico es de la persona (apd.solicitante.numero_expediente), no del trámite. Sus cambios de estado los valida la base y quedan en la bitácora.
- [`revision`](#revision) — Cada ronda de revisión documental en línea, con su resultado. Permite contar cuántas vueltas dio un expediente.
- [`cita`](#cita) — Cada cita de cotejo presencial y lo que pasó en ella (decisiones 2026-10-17, Liber). La crea la base al validar la solicitud o al cambiar su cita; la cierra el personal: atendida, en pausa (un documento no coincidió y la persona trae el correcto ese mismo día), con observaciones, sin pago, no se presentó o no era la persona. Si la solicitud se cancela con la cita abierta, la base la cierra como cancelada, con el motivo (decisión 8, 2026-10-19). La solicitud guarda en cita_en la cita vigente.
- [`documento`](#documento) — Archivos cargados por requisito. El archivo vive en el almacén, fuera de lo publicado; aquí sólo su clave. Una nueva carga no borra la anterior: la marca como no vigente.
- [`grupo`](#grupo) — Grupo de un curso. Copia los cupos del curso al crearse. Sólo se confirma con el cupo mínimo y nunca pasa del máximo.
- [`inscripcion`](#inscripcion) — Una solicitud en un grupo. No se borra: una baja o una cancelación la deja inactiva y la solicitud regresa a la bandeja con su antigüedad.
- [`asistencia`](#asistencia) — Asistencia por día de curso, capturada por el instructor; la del último día se registra al pasar lista en el examen (P94).
- [`examen`](#examen) — Calificación del examen final: la captura el instructor o llega del sistema de examen en línea. Sólo se admite con la asistencia mínima, y una vez registrada no se modifica (el resultado es inapelable).
- [`material_estudio`](#material_estudio) — Documentos de la Secretaría para preparar el examen (decisión 2026-10-18, Liber): los sube el personal y, publicados, los ve cualquiera en «Material de estudio», sin cuenta. El examen es a libro cerrado: se estudian antes. El archivo vive en el almacén; aquí sólo su clave. Una carga nueva del mismo documento no borra la anterior: la marca como no vigente.
- [`aviso_telefono`](#aviso_telefono) — Avisos por teléfono a las personas del registro asistido (decisión 2026-10-25, Liber): cada cambio del trámite que a otra persona le llegaría por correo (catálogo docs/AVISOS-POR-CORREO.md) deja aquí, mientras la persona no activa su cuenta, un aviso pendiente para el personal de revisión y cotejo, que llama y registra el resultado. Lo crea sólo la base; no se borra.
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

## cuota

Cuotas que no son de un curso: hoy, la reposición de la credencial (P140, sesión de trabajo del 23/10/2026). Como el pago de cada curso: el monto lo actualiza el personal con la publicación que lo fija y desde cuándo aplica (cambia cada año); cada cambio queda en la bitácora.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `clave` | `text` | Sí | Qué se cobra: reposicion_credencial |
| `concepto` | `text` | Sí | Concepto que se muestra a la persona |
| `monto` | `numeric(10,2)` | No | Monto en pesos. Vacío mientras no se capture |
| `fundamento` | `text` | No | Publicación que fija el monto vigente (fecha y número). Obligatorio si hay monto |
| `vigente_desde` | `date` | No | Desde cuándo aplica el monto vigente. Obligatorio si hay monto |
| `actualizado_en` | `timestamptz` | Sí | Último cambio (por omisión: `now()`) |

Restricciones e índices:

- `CONSTRAINT cuota_pk PRIMARY KEY (clave)`
- `CONSTRAINT cuota_monto_ck CHECK (monto IS NULL OR (monto > 0 AND coalesce(trim(fundamento), '') <> '' AND vigente_desde IS NOT NULL))`

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
- `CREATE INDEX requisito_curso_requisito ON apd.requisito_curso (requisito)`

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

Cuenta de la persona solicitante. Una por CURP, con su fotografía de frente (apd.fotografia) y con un solo expediente físico para todos sus trámites. La contraseña se guarda derivada con scrypt (parámetros de acceso), nunca en claro. Las personas del padrón migrado quedan sin activar hasta que se registran con su CURP. Registro asistido (decisión 2026-10-25, Liber): a quien no sabe leer ni escribir lo registra en el Vivero el personal de revisión y cotejo, con la persona presente; la cuenta queda activa y sin contraseña (no puede entrar sola), con el teléfono obligatorio y el correo opcional, hasta que la persona la activa con su CURP, su correo y su contraseña.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | `uuid` | Sí | Identificador interno (por omisión: `gen_random_uuid()`) |
| `curp` | `text` | Sí | CURP en mayúsculas; identificador único de la cuenta |
| `nombre` | `text` | Sí | Nombre(s) |
| `primer_apellido` | `text` | Sí | Primer apellido |
| `segundo_apellido` | `text` | No | Segundo apellido, si lo hay |
| `sexo` | `text GENERATED ALWAYS AS (substr(curp, 11, 1)) STORED` | Sí | H, M o X: se toma de la posición 11 de la CURP (no se pide aparte); para la estadística de la población acreditada |
| `adscripcion` | `text` | No | Adscripción vigente de la persona: independiente, privada, dependencia_cdmx, alcaldia, dependencia_federal o educativa. La captura al crear su cuenta y la cambia en «Mi perfos»; vacía sólo en cuentas del padrón migrado sin activar |
| `organizacion_id` | `uuid` | No | Institución de adscripción vigente, del catálogo y de su mismo tipo; vacía si es independiente |
| `correo` | `text` | No | Correo de contacto, en minúsculas. No se repite entre cuentas activas: un correo, una cuenta (decisión 2026-10-17, Liber); el del registro anterior sin activar no cuenta. Vacío sólo en una cuenta del registro asistido que la persona todavía no activa (decisión 2026-10-25): es opcional al registrarla y obligatorio al activarla; si existe, tampoco se repite |
| `telefono` | `text` | Sí | Teléfono de contacto, 10 dígitos. En el registro asistido es el medio de los avisos (apd.aviso_telefono) |
| `numero_expediente` | `text` | No | Expediente físico de la persona: uno por CURP, para todos sus trámites. Lo asigna la base al concluir su primer cotejo presencial, consecutivo por año y sin huecos. Formato provisional EXP-AAAA-NNNN |
| `contrasena_hash` | `text` | No | scrypt N=2^14, r=8, p=1, base64url. Vacía sólo en cuentas sin activar del padrón migrado y en las del registro asistido que la persona todavía no activa: sin contraseña no se abre sesión (apd.sesion_sin_contrasena) |
| `estado` | `text` | Sí | activa, bloqueada, inactiva o sin_activar (persona del padrón migrado que aún no crea su contraseña) (por omisión: `'activa'`) |
| `intentos_fallidos` | `smallint` | Sí | Intentos de entrada fallidos seguidos. Lo lleva apd.anotar_intento(); el acceso correcto lo vuelve a 0 (apd.acceso_correcto) (por omisión: `0`) |
| `bloqueada_hasta` | `timestamptz` | No | Fin del bloqueo por intentos: lo pone la base al llegar a intentos_maximos, por minutos_bloqueo minutos (parámetros); poner o quitar un bloqueo queda en la bitácora |
| `bloqueo_motivo` | `text` | No | identidad: en su cita de cotejo no era la persona de la fotografía ni de la identificación; la cuenta queda bloqueada sin fecha de fin hasta que la Dirección lo aclare (decisión 2026-10-17, Liber). Lo pone la base |
| `debe_cambiar_contrasena` | `boolean` | Sí | Tiene una contraseña temporal de un solo uso (por omisión: `false`) |
| `registro_asistido_por` | `text` | No | Registro asistido (decisión 2026-10-25): cuenta del personal de revisión y cotejo (acceso) que registró la cuenta con la persona presente, después de leerle el aviso de privacidad (la marca queda en la bitácora). Vacía si la creó la persona o viene del padrón migrado. La pone la base |
| `registro_asistido_en` | `timestamptz` | No | Registro asistido: cuándo la registró el personal. La pone la base |
| `activada_en` | `timestamptz` | No | Registro asistido: cuándo la persona activó su cuenta en línea con su CURP, su correo y su contraseña. Vacía mientras no la activa: hasta entonces no hay nada que ver en línea y los avisos van por teléfono. La pone la base |
| `creada_en` | `timestamptz` | Sí | Alta de la cuenta (por omisión: `now()`) |
| `es_ficticio` | `boolean` | Sí | Dato de prueba (por omisión: `false`) |

Restricciones e índices:

- `CONSTRAINT solicitante_pk PRIMARY KEY (id)`
- `CONSTRAINT solicitante_curp_uk UNIQUE (curp)`
- `CONSTRAINT solicitante_expediente_uk UNIQUE (numero_expediente)`
- `CONSTRAINT solicitante_curp_ck CHECK (apd.curp_valida(curp))`
- `CONSTRAINT solicitante_correo_ck CHECK (correo IS NULL OR apd.correo_valido(correo))`
- `CONSTRAINT solicitante_correo_obligatorio_ck CHECK (correo IS NOT NULL OR (registro_asistido_en IS NOT NULL AND activada_en IS NULL))`
- `CONSTRAINT solicitante_telefono_ck CHECK (telefono ~ '^[0-9]{10}$')`
- `CONSTRAINT solicitante_organizacion_fk FOREIGN KEY (organizacion_id) REFERENCES apd.organizacion (id)`
- `CONSTRAINT solicitante_adscripcion_ck CHECK (adscripcion IN ('independiente', 'privada', 'dependencia_cdmx', 'alcaldia', 'dependencia_federal', 'educativa'))`
- `CONSTRAINT solicitante_adscripcion_organizacion_ck CHECK ((organizacion_id IS NULL) = (adscripcion IS NULL OR adscripcion = 'independiente'))`
- `CONSTRAINT solicitante_adscripcion_activa_ck CHECK (estado = 'sin_activar' OR adscripcion IS NOT NULL)`
- `CONSTRAINT solicitante_estado_ck CHECK (estado IN ('activa', 'bloqueada', 'inactiva', 'sin_activar'))`
- `CONSTRAINT solicitante_bloqueo_ck CHECK (bloqueo_motivo IS NULL OR (bloqueo_motivo = 'identidad' AND estado = 'bloqueada'))`
- `CONSTRAINT solicitante_contrasena_ck CHECK ((contrasena_hash IS NULL) = (estado = 'sin_activar' OR (registro_asistido_en IS NOT NULL AND activada_en IS NULL)))`
- `CONSTRAINT solicitante_asistido_ck CHECK ((registro_asistido_por IS NULL) = (registro_asistido_en IS NULL) AND (activada_en IS NULL OR registro_asistido_en IS NOT NULL) AND (registro_asistido_en IS NULL OR estado <> 'sin_activar'))`
- `CREATE INDEX solicitante_apellidos ON apd.solicitante (primer_apellido, segundo_apellido, nombre)`
- `CREATE UNIQUE INDEX solicitante_correo_uk ON apd.solicitante (correo) WHERE estado <> 'sin_activar'`
- `CREATE INDEX solicitante_organizacion ON apd.solicitante (organizacion_id)`

## fotografia

Fotografía de frente de la persona, para reconocerla en la cita de cotejo y en el curso; quien aplica el examen la usa para confirmar su identidad y su asistencia, por eso debe verse clara. La carga ella al crear su cuenta; en el cotejo el personal confirma que corresponde a quien se presenta (en la cita no se toma otra). No es la foto de la credencial: esa se toma al entregar la acreditación y se guarda como documento de la solicitud. El archivo vive en el almacén, fuera de lo publicado; aquí sólo su clave. Una nueva carga no borra la anterior: la marca como no vigente.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | `uuid` | Sí | Identificador interno (por omisión: `gen_random_uuid()`) |
| `solicitante_id` | `uuid` | Sí | Persona |
| `archivo_clave` | `text` | Sí | Clave exacta en el almacén, con sello propio |
| `tipo_mime` | `text` | Sí | image/jpeg o image/png |
| `tamano_bytes` | `integer` | Sí | Tamaño; el máximo lo fija el parámetro tamano_maximo_archivo_bytes |
| `sha256` | `text` | Sí | Suma del archivo, para comprobar el almacén |
| `nombre_archivo` | `text` | Sí | Nombre con que se guarda y se descarga: FOTOGRAFIA_NOMBRE COMPLETO.ext. Lo pone la base al cargarla (por omisión: `''`) |
| `origen` | `text` | Sí | en_linea: la cargó la persona; cotejo: la cargó el personal frente a ella (hoy sin pantalla: cómo se actualiza una fotografía confirmada, P100); registro_asistido: la tomó o cargó el personal al registrar a la persona en el Vivero (decisión 2026-10-25); queda pendiente hasta que el cotejo la confirma contra la identificación oficial. Lo pone la base |
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
- `CONSTRAINT fotografia_origen_ck CHECK (origen IN ('en_linea', 'cotejo', 'registro_asistido'))`
- `CONSTRAINT fotografia_estado_ck CHECK (estado IN ('pendiente', 'confirmada'))`
- `CONSTRAINT fotografia_confirmada_ck CHECK ((estado = 'confirmada') = (confirmada_por IS NOT NULL AND confirmada_en IS NOT NULL))`
- `CREATE UNIQUE INDEX fotografia_una_vigente ON apd.fotografia (solicitante_id) WHERE vigente`
- `CREATE INDEX fotografia_solicitante ON apd.fotografia (solicitante_id, cargada_en)`

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

Padrón de acreditaciones emitidas, del sistema o migradas de Kobo o papel. Su estado de vigencia no se guarda: lo calcula apd.estado_acreditacion() con la fecha del día. Una cancelada (P120, sesión de trabajo del 23/10/2026) lo está desde su cancelada_en: ya no es vigente, no se renueva ni sirve de requisito. La credencial se repone sin cambiar la acreditación (apd.reposicion).

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | `uuid` | Sí | Identificador interno (por omisión: `gen_random_uuid()`) |
| `numero` | `text` | Sí | Número impreso en la credencial; lo asigna la base si no se migra (serie PD-AAAA-NNNN o DT-AAAA-NNNN, formato provisional: Liber lo definirá). Una migrada conserva el suyo, que nunca tiene la forma de la serie del sistema, para que no choque con una emisión |
| `solicitante_id` | `uuid` | Sí | Titular |
| `tipo_acreditacion` | `text` | Sí | poda o dictaminador |
| `solicitud_id` | `uuid` | No | Solicitud que la originó; vacía si se migró |
| `emitida_en` | `date` | Sí | Fecha de emisión (Ciudad de México) |
| `vence_en` | `date` | Sí | Último día de vigencia: un año después de la emisión, menos un día. Lo calcula la base |
| `entregada_en` | `date` | No | Entrega en persona |
| `cancelada_en` | `timestamptz` | No | Cancelación de la acreditación (P120): desde ese día no es vigente. La pone la base al registrar el motivo y el fundamento |
| `cancelacion_motivo` | `text` | No | Por qué se canceló, al menos 10 caracteres. Lo lee la persona en «Mis trámites»; «Verificar» no lo muestra |
| `cancelacion_fundamento` | `text` | No | Fundamento de la cancelación: lineamientos y artículo, mientras los fije la Dirección Jurídica escrito como «[Art. __, fracc. __]» (P120) |
| `cancelada_por` | `text` | No | Cuenta del personal que la canceló (acceso), con perfil instructor o administración (parámetro perfiles_cancelan_acreditacion). La pone la base |
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
- `CONSTRAINT acreditacion_numero_serie_ck CHECK ((origen = 'sistema') = (numero ~ '^(PD|DT)-[0-9]{4}-[0-9]{4}$'))`
- `CONSTRAINT acreditacion_cancelacion_ck CHECK ((cancelada_en IS NULL) = (cancelada_por IS NULL) AND (cancelada_en IS NULL) = (cancelacion_motivo IS NULL) AND (cancelada_en IS NULL) = (cancelacion_fundamento IS NULL))`
- `CREATE INDEX acreditacion_titular ON apd.acreditacion (solicitante_id, tipo_acreditacion, vence_en DESC)`
- `CREATE INDEX acreditacion_vence ON apd.acreditacion (vence_en)`

## reposicion

Reposición de la credencial de una acreditación vigente por pérdida o robo (P140, sesión de trabajo del 23/10/2026). La persona la pide desde «Mis trámites» con el acta que levantó; el personal revisa el acta (la acepta o le pone observaciones), y en el Vivero valida la factura de la cuota de reposición y entrega la credencial repuesta. La acreditación no cambia: mismo número, misma emisión y misma vigencia. El acta vive en el almacén, fuera de lo publicado; aquí sólo su clave. Sus cambios de estado los valida la base y quedan en la bitácora.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | `uuid` | Sí | Identificador interno (por omisión: `gen_random_uuid()`) |
| `acreditacion_id` | `uuid` | Sí | Acreditación cuya credencial se repone |
| `motivo` | `text` | Sí | perdida o robo |
| `acta_archivo_clave` | `text` | Sí | Clave exacta del acta en el almacén, con sello propio. Al corregir, la nueva sustituye a la anterior (la bitácora conserva la anterior) |
| `acta_nombre_original` | `text` | Sí | Nombre con que se cargó |
| `acta_nombre_archivo` | `text` | Sí | Nombre con que se guarda y se descarga: ACTA DE PERDIDA O ROBO_NOMBRE COMPLETO.ext. Lo pone la base (por omisión: `''`) |
| `acta_tipo_mime` | `text` | Sí | application/pdf, image/jpeg o image/png |
| `acta_tamano_bytes` | `integer` | Sí | Tamaño; el máximo lo fija el parámetro tamano_maximo_archivo_bytes |
| `acta_sha256` | `text` | Sí | Suma del archivo, para comprobar el almacén |
| `estado` | `text` | Sí | solicitada (el acta está en revisión), con_observaciones (la persona carga otra acta), acta_aceptada (paga la cuota y recoge la credencial en el Vivero), repuesta o cancelada. Ver apd.reposicion_cambio() (por omisión: `'solicitada'`) |
| `estado_desde` | `timestamptz` | Sí | Desde cuándo está en el estado actual; lo pone la base (por omisión: `now()`) |
| `observacion` | `text` | Sí | Con observaciones: qué corregir del acta (lo ve la persona). Cancelada: por qué (por omisión: `''`) |
| `solicitada_en` | `timestamptz` | Sí | Cuándo la pidió la persona; lo pone la base (por omisión: `now()`) |
| `revisada_por` | `text` | No | Cuenta del personal que revisó el acta (acceso). Lo pone la base |
| `revisada_en` | `timestamptz` | No | Revisión del acta. Lo pone la base |
| `pago_monto` | `numeric(10,2)` | No | Monto de la cuota que se le indicó a la persona al aceptar su acta: el vigente ese día (apd.cuota). Un cambio posterior no lo altera. Lo pone la base |
| `factura_rfc` | `text` | No | RFC de la factura de la cuota; lo captura el personal en el Vivero al entregar la credencial |
| `factura_razon_social` | `text` | No | Nombre o razón social de la factura; lo captura el personal al entregar |
| `factura_folio_fiscal` | `text` | No | Folio fiscal (UUID) de la factura; no se repite con el de otra reposición ni el de una solicitud |
| `repuesta_en` | `date` | No | Entrega de la credencial repuesta (Ciudad de México). Lo pone la base |
| `repuesta_por` | `text` | No | Cuenta del personal que la entregó. Lo pone la base |
| `es_ficticio` | `boolean` | Sí | Dato de prueba (por omisión: `false`) |

Restricciones e índices:

- `CONSTRAINT reposicion_pk PRIMARY KEY (id)`
- `CONSTRAINT reposicion_acreditacion_fk FOREIGN KEY (acreditacion_id) REFERENCES apd.acreditacion (id)`
- `CONSTRAINT reposicion_acta_uk UNIQUE (acta_archivo_clave)`
- `CONSTRAINT reposicion_motivo_ck CHECK (motivo IN ('perdida', 'robo'))`
- `CONSTRAINT reposicion_estado_ck CHECK (estado IN ('solicitada', 'con_observaciones', 'acta_aceptada', 'repuesta', 'cancelada'))`
- `CONSTRAINT reposicion_mime_ck CHECK (acta_tipo_mime IN ('application/pdf', 'image/jpeg', 'image/png'))`
- `CONSTRAINT reposicion_tamano_ck CHECK (acta_tamano_bytes > 0)`
- `CONSTRAINT reposicion_sha256_ck CHECK (acta_sha256 ~ '^[0-9a-f]{64}$')`
- `CONSTRAINT reposicion_observacion_ck CHECK (estado NOT IN ('con_observaciones', 'cancelada') OR length(trim(observacion)) > 0)`
- `CONSTRAINT reposicion_factura_rfc_ck CHECK (factura_rfc IS NULL OR apd.rfc_valido(factura_rfc))`
- `CONSTRAINT reposicion_folio_fiscal_ck CHECK (factura_folio_fiscal IS NULL OR factura_folio_fiscal ~ '^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$')`
- `CONSTRAINT reposicion_repuesta_ck CHECK ((estado = 'repuesta') = (repuesta_en IS NOT NULL AND repuesta_por IS NOT NULL AND factura_rfc IS NOT NULL AND coalesce(trim(factura_razon_social), '') <> '' AND factura_folio_fiscal IS NOT NULL))`
- `CONSTRAINT reposicion_revisada_ck CHECK (estado IN ('solicitada', 'cancelada') OR (revisada_por IS NOT NULL AND revisada_en IS NOT NULL))`
- `CREATE UNIQUE INDEX reposicion_una_abierta ON apd.reposicion (acreditacion_id) WHERE estado IN ('solicitada', 'con_observaciones', 'acta_aceptada')`
- `CREATE UNIQUE INDEX reposicion_folio_fiscal_uk ON apd.reposicion (factura_folio_fiscal) WHERE factura_folio_fiscal IS NOT NULL`
- `CREATE INDEX reposicion_acreditacion ON apd.reposicion (acreditacion_id, solicitada_en)`

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
| `carrera_tecnica` | `text` | No | Con carrera técnica, en poda y en dictaminador: el nombre de la carrera técnica, escrito; sin catálogo (decisión 2026-10-17, Liber) |
| `estatus_estudios` | `text` | No | Sólo en dictaminador con licenciatura (en poda no se pregunta ni se guarda: sesión de trabajo del 23/10/2026): situación de ese grado (en_curso, trunco, concluido —carta de pasante o 100 % de créditos— o titulado). Con posgrado no se pregunta: se asume la licenciatura titulada (decisión 2026-10-18) |
| `perfil_academico` | `text` | No | Lo calcula la base con nivel, estatus y grupo de la carrera (apd.perfil_academico): licenciatura_afin, disciplina_afin, pasante, tecnica, por_clasificar o no_cumple. No impide enviar: el personal lo revisa en la revisión documental |
| `experiencia_minima` | `numeric(3,1)` | No | Años de experiencia que pide el perfil; la calcula la base: 2 con licenciatura o posgrado en carrera principal o afín; 5 en todo lo demás, también cuando lo decide el personal (por clasificar o no cumple) |
| `anios_experiencia` | `numeric(4,1)` | No | Sólo dictaminador: años de experiencia en manejo de arbolado declarados; los documentos los comprueban |
| `estado` | `text` | Sí | Ver apd.transicion_solicitud() (por omisión: `'borrador'`) |
| `estado_desde` | `timestamptz` | Sí | Desde cuándo está en el estado actual; lo pone la base (por omisión: `now()`) |
| `enviada_en` | `timestamptz` | No | Primer envío a revisión; lo pone la base |
| `cita_en` | `timestamptz` | No | Cita para el cotejo presencial |
| `pago_monto` | `numeric(10,2)` | No | Monto que se le indicó a la persona al darle su cita: el vigente en ese momento. Un cambio de costo posterior no lo altera. Vacío si aún no había monto capturado |
| `pago_referencia` | `text` | No | Referencia del pago de derechos que se da a la persona con su cita. La asigna la base al validar en línea. Formato provisional (folio sin guiones) hasta definir con Finanzas la referencia o línea de captura |
| `lista_para_curso_en` | `timestamptz` | No | Inicio de la espera de grupo; no cambia si un grupo se cancela, para conservar la antigüedad |
| `motivo_cierre` | `text` | No | Motivo de cancelación, conclusión sin atender o rechazo |
| `capturada_por` | `text` | No | Registro asistido (decisión 2026-10-25): cuenta del personal de revisión y cotejo (acceso) que capturó la solicitud con la persona presente; cada envío lleva la marca «Se le leyó lo capturado y lo aceptó» en la bitácora. Vacía si la capturó la persona. La pone la base al darla de alta y no cambia |
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
- `CONSTRAINT solicitud_estado_ck CHECK (estado IN ('borrador', 'enviada', 'con_observaciones', 'validada_en_linea', 'lista_para_curso', 'inscrita', 'aprobada', 'acreditada', 'no_acreditada', 'sin_derecho_examen', 'cancelada', 'concluida_sin_atender', 'rechazada'))`
- `CONSTRAINT solicitud_renovacion_ck CHECK ((modalidad = 'renovacion') = (acreditacion_anterior_id IS NOT NULL))`
- `CONSTRAINT solicitud_factura_folio_uk UNIQUE (factura_folio_fiscal)`
- `CONSTRAINT solicitud_factura_rfc_ck CHECK (factura_rfc IS NULL OR apd.rfc_valido(factura_rfc))`
- `CONSTRAINT solicitud_factura_folio_ck CHECK (factura_folio_fiscal IS NULL OR factura_folio_fiscal ~ '^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$')`
- `CONSTRAINT solicitud_nivel_ck CHECK (nivel_estudios IN ('ninguna', 'preescolar', 'primaria', 'secundaria', 'preparatoria', 'tecnica', 'licenciatura', 'maestria', 'doctorado'))`
- `CONSTRAINT solicitud_estatus_ck CHECK (estatus_estudios IN ('en_curso', 'trunco', 'concluido', 'titulado'))`
- `CONSTRAINT solicitud_carrera_fk FOREIGN KEY (carrera_id) REFERENCES apd.carrera (id)`
- `CONSTRAINT solicitud_perfil_ck CHECK (perfil_academico IN ('licenciatura_afin', 'disciplina_afin', 'pasante', 'tecnica', 'por_clasificar', 'no_cumple'))`
- `CONSTRAINT solicitud_perfil_tipo_ck CHECK (tipo_acreditacion = 'dictaminador' OR (perfil_academico IS NULL AND anios_experiencia IS NULL))`
- `CONSTRAINT solicitud_experiencia_ck CHECK (anios_experiencia IS NULL OR anios_experiencia BETWEEN 0 AND 70)`
- `CONSTRAINT solicitud_cierre_ck CHECK (estado NOT IN ('cancelada', 'concluida_sin_atender', 'rechazada') OR length(trim(coalesce(motivo_cierre, ''))) > 0)`
- `CREATE UNIQUE INDEX solicitud_una_activa ON apd.solicitud (solicitante_id, tipo_acreditacion) WHERE estado NOT IN ('acreditada', 'no_acreditada', 'sin_derecho_examen', 'cancelada', 'concluida_sin_atender', 'rechazada')`
- `CREATE INDEX solicitud_bandeja ON apd.solicitud (tipo_acreditacion, modalidad, estado, lista_para_curso_en)`
- `CREATE INDEX solicitud_organizacion ON apd.solicitud (organizacion_id)`
- `CREATE INDEX solicitud_anterior ON apd.solicitud (acreditacion_anterior_id)`
- `CREATE INDEX solicitud_revision ON apd.solicitud (estado, estado_desde)`
- `CREATE INDEX solicitud_persona ON apd.solicitud (solicitante_id, creada_en)`
- `CREATE INDEX solicitud_carrera ON apd.solicitud (carrera_id)`

## revision

Cada ronda de revisión documental en línea, con su resultado. Permite contar cuántas vueltas dio un expediente.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | `uuid` | Sí | Identificador interno (por omisión: `gen_random_uuid()`) |
| `solicitud_id` | `uuid` | Sí | Solicitud revisada |
| `resultado` | `text` | Sí | con_observaciones, validada o rechazada (perfil que no cumple) |
| `observacion_general` | `text` | Sí | Indicaciones para la persona solicitante; en un rechazo, el motivo (obligatorio) (por omisión: `''`) |
| `revisor` | `text` | Sí | Cuenta del personal (acceso) |
| `revisada_en` | `timestamptz` | Sí | Fecha de la revisión (por omisión: `now()`) |

Restricciones e índices:

- `CONSTRAINT revision_pk PRIMARY KEY (id)`
- `CONSTRAINT revision_solicitud_fk FOREIGN KEY (solicitud_id) REFERENCES apd.solicitud (id)`
- `CONSTRAINT revision_resultado_ck CHECK (resultado IN ('con_observaciones', 'validada', 'rechazada'))`
- `CREATE INDEX revision_solicitud ON apd.revision (solicitud_id, revisada_en)`

## cita

Cada cita de cotejo presencial y lo que pasó en ella (decisiones 2026-10-17, Liber). La crea la base al validar la solicitud o al cambiar su cita; la cierra el personal: atendida, en pausa (un documento no coincidió y la persona trae el correcto ese mismo día), con observaciones, sin pago, no se presentó o no era la persona. Si la solicitud se cancela con la cita abierta, la base la cierra como cancelada, con el motivo (decisión 8, 2026-10-19). La solicitud guarda en cita_en la cita vigente.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | `uuid` | Sí | Identificador interno (por omisión: `gen_random_uuid()`) |
| `solicitud_id` | `uuid` | Sí | Solicitud |
| `programada_en` | `timestamptz` | Sí | Día y hora de la cita (la cita_en de la solicitud al crearla) |
| `resultado` | `text` | Sí | pendiente, en_pausa, atendida, con_observaciones, sin_pago, no_se_presento, no_es_la_persona o cancelada (la solicitud se canceló con la cita abierta; lo pone la base) (por omisión: `'pendiente'`) |
| `observacion` | `text` | Sí | En pausa o con observaciones: qué no coincidió (lo ve la persona). Si no era la persona: lo que observó el personal (lo lee la Dirección, no la persona). Cancelada: el motivo de la cancelación de la solicitud (por omisión: `''`) |
| `pausada_en` | `timestamptz` | No | Cuándo quedó en pausa; la pausa sólo dura ese día. Lo pone la base |
| `atendida_por` | `text` | No | Cuenta del personal que la cerró (acceso). Lo pone la base |
| `atendida_en` | `timestamptz` | No | Cuándo se cerró. Lo pone la base |
| `creada_en` | `timestamptz` | Sí | Alta. Lo pone la base (por omisión: `now()`) |

Restricciones e índices:

- `CONSTRAINT cita_pk PRIMARY KEY (id)`
- `CONSTRAINT cita_solicitud_fk FOREIGN KEY (solicitud_id) REFERENCES apd.solicitud (id)`
- `CONSTRAINT cita_resultado_ck CHECK (resultado IN ('pendiente', 'en_pausa', 'atendida', 'con_observaciones', 'sin_pago', 'no_se_presento', 'no_es_la_persona', 'cancelada'))`
- `CONSTRAINT cita_cerrada_ck CHECK ((resultado IN ('pendiente', 'en_pausa')) = (atendida_en IS NULL))`
- `CONSTRAINT cita_pausa_ck CHECK (resultado <> 'en_pausa' OR pausada_en IS NOT NULL)`
- `CONSTRAINT cita_observacion_ck CHECK (resultado NOT IN ('en_pausa', 'con_observaciones', 'no_es_la_persona', 'cancelada') OR length(trim(observacion)) > 0)`
- `CREATE UNIQUE INDEX cita_una_abierta ON apd.cita (solicitud_id) WHERE resultado IN ('pendiente', 'en_pausa')`
- `CREATE INDEX cita_agenda ON apd.cita (programada_en)`
- `CREATE INDEX cita_solicitud ON apd.cita (solicitud_id, programada_en)`

## documento

Archivos cargados por requisito. El archivo vive en el almacén, fuera de lo publicado; aquí sólo su clave. Una nueva carga no borra la anterior: la marca como no vigente.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | `uuid` | Sí | Identificador interno (por omisión: `gen_random_uuid()`) |
| `solicitud_id` | `uuid` | Sí | Solicitud |
| `requisito` | `text` | Sí | Requisito que atiende |
| `archivo_clave` | `text` | Sí | Clave exacta en el almacén, con sello propio |
| `nombre_original` | `text` | Sí | Nombre con que se cargó |
| `nombre_archivo` | `text` | Sí | Nombre con que se guarda y se descarga: TIPO DE DOCUMENTO_NOMBRE COMPLETO.ext (por ejemplo CURP_ANA EJEMPLO MUESTRA.pdf). Lo pone la base al cargarlo (por omisión: `''`) |
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
- `CREATE INDEX documento_solicitud ON apd.documento (solicitud_id, cargado_en)`
- `CREATE INDEX documento_requisito ON apd.documento (requisito)`

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
| `hora_entrada` | `time` | No | Hora de entrada del curso, la misma todos los días; obligatoria para confirmar. El curso es de 9:00 a 15:00 (P91, sesión de trabajo del 23/10/2026): entre curso_hora_entrada y antes de curso_hora_salida; la salida no se guarda por grupo |
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
- `CONSTRAINT grupo_confirmado_ck CHECK (estado IN ('en_integracion', 'cancelado') OR (instructor IS NOT NULL AND sede IS NOT NULL AND fecha_inicio IS NOT NULL AND hora_entrada IS NOT NULL))`
- `CONSTRAINT grupo_cancelado_ck CHECK (estado <> 'cancelado' OR length(trim(coalesce(motivo_cancelacion, ''))) > 0)`
- `CREATE INDEX grupo_curso_estado ON apd.grupo (tipo_acreditacion, modalidad, estado)`
- `CREATE INDEX grupo_organizacion ON apd.grupo (organizacion_id)`

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
- `CREATE INDEX inscripcion_grupo_historial ON apd.inscripcion (grupo_id, inscrita_en)`
- `CREATE INDEX inscripcion_solicitud ON apd.inscripcion (solicitud_id, inscrita_en)`

## asistencia

Asistencia por día de curso, capturada por el instructor; la del último día se registra al pasar lista en el examen (P94).

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `inscripcion_id` | `uuid` | Sí | Inscripción |
| `dia` | `smallint` | Sí | Día del curso, desde 1 |
| `asistio` | `boolean` | Sí | Asistió ese día |
| `capturada_por` | `text` | Sí | Cuenta del personal que capturó (acceso). Lo pone la base: la cuenta de la sesión (apd.usuario) |
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
| `capturado_por` | `text` | Sí | Cuenta del instructor (acceso) o del sistema de examen en línea. Lo pone la base: la cuenta de la sesión (apd.usuario) |
| `origen` | `text` | Sí | captura: la registra el instructor; examen_web: la registra el examen en línea del salón de cómputo del PILARES (R36; prototipo en la versión de prueba) (por omisión: `'captura'`) |
| `capturado_en` | `timestamptz` | Sí | Captura (por omisión: `now()`) |

Restricciones e índices:

- `CONSTRAINT examen_pk PRIMARY KEY (inscripcion_id)`
- `CONSTRAINT examen_origen_ck CHECK (origen IN ('captura', 'examen_web'))`
- `CONSTRAINT examen_inscripcion_fk FOREIGN KEY (inscripcion_id) REFERENCES apd.inscripcion (id)`
- `CONSTRAINT examen_calificacion_ck CHECK (calificacion BETWEEN 0 AND 10)`

## material_estudio

Documentos de la Secretaría para preparar el examen (decisión 2026-10-18, Liber): los sube el personal y, publicados, los ve cualquiera en «Material de estudio», sin cuenta. El examen es a libro cerrado: se estudian antes. El archivo vive en el almacén; aquí sólo su clave. Una carga nueva del mismo documento no borra la anterior: la marca como no vigente.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | `uuid` | Sí | Identificador interno (por omisión: `gen_random_uuid()`) |
| `clave` | `text` | Sí | Documento al que pertenece la carga; se conserva al reemplazar el archivo (por ejemplo norma_poda) |
| `titulo` | `text` | Sí | Nombre del documento como lo lee la persona |
| `descripcion` | `text` | Sí | Para qué le sirve a quien estudia |
| `edicion` | `text` | Sí | Versión o fecha de publicación, como la dice el documento (por ejemplo: texto vigente, última reforma publicada el 23/07/2026) |
| `tipo_acreditacion` | `text` | No | poda o dictaminador; vacío: sirve para las dos acreditaciones |
| `temas` | `jsonb` | Sí | Apartados que conviene estudiar: [{titulo, pagina, tipo_acreditacion?}]; la página es la del archivo PDF (por omisión: `'[]'::jsonb`) |
| `orden` | `smallint` | Sí | Orden en la lista (por omisión: `0`) |
| `publicado` | `boolean` | Sí | Se ve en «Material de estudio» (por omisión: `false`) |
| `archivo_clave` | `text` | Sí | Clave exacta en el almacén, con sello propio |
| `nombre_archivo` | `text` | Sí | Nombre con que se descarga |
| `tipo_mime` | `text` | Sí | application/pdf |
| `tamano_bytes` | `integer` | Sí | Tamaño; el máximo lo fija el parámetro tamano_maximo_material_bytes |
| `sha256` | `text` | Sí | Suma del archivo, para comprobar el almacén |
| `paginas` | `integer` | Sí | Número de páginas del PDF |
| `vigente` | `boolean` | Sí | Es la última carga de ese documento (por omisión: `true`) |
| `cargado_en` | `timestamptz` | Sí | Carga (por omisión: `now()`) |
| `cargado_por` | `text` | Sí | Cuenta del personal que lo cargó; lo pone la base (por omisión: `''`) |
| `actualizado_en` | `timestamptz` | No | Último cambio de sus datos o de su publicación; lo pone la base |
| `actualizado_por` | `text` | No | Cuenta del personal del último cambio; lo pone la base |

Restricciones e índices:

- `CONSTRAINT material_estudio_pk PRIMARY KEY (id)`
- `CONSTRAINT material_estudio_archivo_uk UNIQUE (archivo_clave)`
- `CONSTRAINT material_estudio_clave_ck CHECK (clave ~ '^[a-z0-9_]{3,40}$')`
- `CONSTRAINT material_estudio_titulo_ck CHECK (length(trim(titulo)) BETWEEN 3 AND 200)`
- `CONSTRAINT material_estudio_descripcion_ck CHECK (length(trim(descripcion)) BETWEEN 10 AND 400)`
- `CONSTRAINT material_estudio_edicion_ck CHECK (length(trim(edicion)) BETWEEN 3 AND 200)`
- `CONSTRAINT material_estudio_tipo_ck CHECK (tipo_acreditacion IS NULL OR tipo_acreditacion IN ('poda', 'dictaminador'))`
- `CONSTRAINT material_estudio_temas_ck CHECK (jsonb_typeof(temas) = 'array')`
- `CONSTRAINT material_estudio_mime_ck CHECK (tipo_mime = 'application/pdf')`
- `CONSTRAINT material_estudio_tamano_ck CHECK (tamano_bytes > 0)`
- `CONSTRAINT material_estudio_sha256_ck CHECK (sha256 ~ '^[0-9a-f]{64}$')`
- `CONSTRAINT material_estudio_paginas_ck CHECK (paginas > 0)`

## aviso_telefono

Avisos por teléfono a las personas del registro asistido (decisión 2026-10-25, Liber): cada cambio del trámite que a otra persona le llegaría por correo (catálogo docs/AVISOS-POR-CORREO.md) deja aquí, mientras la persona no activa su cuenta, un aviso pendiente para el personal de revisión y cotejo, que llama y registra el resultado. Lo crea sólo la base; no se borra.

| Campo | Tipo | Obligatorio | Descripción |
|---|---|---|---|
| `id` | `uuid` | Sí | Identificador interno (por omisión: `gen_random_uuid()`) |
| `solicitante_id` | `uuid` | Sí | Persona a quien se llama |
| `solicitud_id` | `uuid` | No | Solicitud del aviso; vacía si es de la cuenta o de una acreditación sin solicitud del sistema |
| `aviso` | `text` | Sí | Clave del catálogo de avisos (docs/AVISOS-POR-CORREO.md): S2, S4, S5, S6, T2, T3, G1, G2, G4, A1, A6 o A7 |
| `datos` | `jsonb` | Sí | Lo que el aviso necesita para decirse (folio, cita, monto y referencia de pago, grupo, calificación, motivo…), como estaba al crearse; la pantalla arma con ellos el texto que se le dice a la persona (por omisión: `'{}'::jsonb`) |
| `creado_en` | `timestamptz` | Sí | Cuándo pasó el cambio. Lo pone la base (por omisión: `now()`) |
| `resultado` | `text` | No | Vacío: pendiente. se_le_aviso o no_contesto: lo registra el personal al llamar, una sola vez |
| `atendido_por` | `text` | No | Cuenta del personal que llamó (acceso). La pone la base |
| `atendido_en` | `timestamptz` | No | Cuándo se registró el resultado. La pone la base |

Restricciones e índices:

- `CONSTRAINT aviso_telefono_pk PRIMARY KEY (id)`
- `CONSTRAINT aviso_telefono_solicitante_fk FOREIGN KEY (solicitante_id) REFERENCES apd.solicitante (id)`
- `CONSTRAINT aviso_telefono_solicitud_fk FOREIGN KEY (solicitud_id) REFERENCES apd.solicitud (id)`
- `CONSTRAINT aviso_telefono_aviso_ck CHECK (aviso IN ('S2', 'S4', 'S5', 'S6', 'T2', 'T3', 'G1', 'G2', 'G4', 'A1', 'A6', 'A7'))`
- `CONSTRAINT aviso_telefono_datos_ck CHECK (jsonb_typeof(datos) = 'object')`
- `CONSTRAINT aviso_telefono_resultado_ck CHECK (resultado IN ('se_le_aviso', 'no_contesto'))`
- `CONSTRAINT aviso_telefono_atendido_ck CHECK ((resultado IS NULL) = (atendido_por IS NULL) AND (resultado IS NULL) = (atendido_en IS NULL))`
- `CREATE INDEX aviso_telefono_pendientes ON apd.aviso_telefono (creado_en) WHERE resultado IS NULL`
- `CREATE INDEX aviso_telefono_solicitante ON apd.aviso_telefono (solicitante_id, creado_en)`
- `CREATE INDEX aviso_telefono_solicitud ON apd.aviso_telefono (solicitud_id)`

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
- Cada documento de estudio tiene a lo más una carga vigente.
  `CREATE UNIQUE INDEX material_estudio_vigente_uk ON apd.material_estudio (clave) WHERE vigente`
