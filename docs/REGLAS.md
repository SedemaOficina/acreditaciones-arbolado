# Reglas que impone la base

Lo que debe valer siempre vive en la base (`db/apd/03-apd-reglas.sql`), no en la pantalla: así se cumple
aunque alguien escriba sin pasar por la aplicación o por la carga masiva. Cada regla sale de
`docs/DECISIONES.md`. Este documento las resume; el código manda si hubiera diferencia.

## Solicitud

Transiciones admitidas (cualquier otra se rechaza con `transicion_invalida`):

| Desde | Hacia |
|---|---|
| `borrador` | `enviada`, `cancelada` |
| `enviada` | `con_observaciones`, `validada_en_linea`, `rechazada`, `cancelada` |
| `con_observaciones` | `enviada`, `cancelada`, `concluida_sin_atender` |
| `validada_en_linea` | `lista_para_curso`, `con_observaciones` (el cotejo no coincide), `cancelada`, `concluida_sin_atender` |
| `lista_para_curso` | `inscrita`, `cancelada` |
| `inscrita` | `lista_para_curso` (baja o grupo cancelado), `aprobada`, `no_acreditada`, `sin_derecho_examen`, `cancelada` |
| `aprobada` | `acreditada` |

| Paso | Lo mueve | La base exige |
|---|---|---|
| Alta | Persona solicitante | Elegibilidad (abajo). Una sola solicitud activa por persona y tipo de acreditación |
| → enviada | Persona solicitante | Documentos obligatorios en línea; estudios en los dos tipos (nivel y, con licenciatura o posgrado, carrera y situación: `faltan_estudios`); en dictaminador, la experiencia mínima de su perfil (`experiencia_insuficiente`; un perfil que no cumple sí se envía y lo revisa el personal); fotografía de frente de la persona; adscripción de la persona, que se copia a la solicitud. La elegibilidad no se vuelve a comprobar |
| → con_observaciones / validada_en_linea | Revisión (con una revisión registrada) | Para validar: todos los documentos aceptados y la cita asignada; en dictaminador, la carrera clasificada (`carrera_sin_clasificar`) y un perfil que cumple (`perfil_no_cumple`). Las observaciones necesitan un texto general o un documento observado |
| → rechazada | Revisión (revisión con resultado `rechazada`) | Sólo dictaminador cuyo perfil no cumple (`rechazo_sin_causa`): carrera clasificada como no afín, o estudios que el comprobante confirma por debajo del lineamiento. Motivo obligatorio (`rechazo_sin_motivo`), que se copia a `motivo_cierre`. Es final: la persona puede iniciar otra solicitud |
| Clasificar una carrera | Personal (`apd.carrera.grupo`) | Sólo el personal (`clasificacion_sin_permiso`); queda en la bitácora y las solicitudes abiertas con esa carrera recalculan perfil y experiencia mínima |
| → lista_para_curso | Cotejo | La factura del pago en PDF, cargada por el personal, con RFC, nombre o razón social y folio fiscal capturados, y la fotografía de la cuenta confirmada por el personal (en la cita no se toma otra, decisión 2026-10-17). Abre el expediente de la persona si es su primer cotejo (uno por CURP) y arranca la espera de grupo. Sin factura no hay grupo ni fecha. Además, todos los documentos en línea coincidieron (`documentos_sin_cotejar`) y la cita quedó atendida (`cotejo_sin_cita`) |
| Cita de cotejo (`apd.cita`) | Personal | La crea la base al validar o al cambiar la cita; con una cita abierta no se asigna otra (`cita_abierta`), y sólo el personal la asigna (`cita_de_personal`). Se cierra una vez (`cita_cerrada`): atendida, en pausa (con un documento marcado como no coincidente, `cotejo_sin_documento`; sólo ese día, `pausa_vencida`), con observaciones (la solicitud regresa), sin pago, no se presentó (a la segunda, la solicitud se cierra: `inasistencias_cotejo_maximas`) o no era la persona (la cuenta queda bloqueada; sólo la Secretaría la bloquea o desbloquea, `bloqueo_de_personal`). En pausa la persona sólo carga el documento que no coincidió. `apd.cerrar_pausas_vencidas()` regresa con observaciones las pausas de días anteriores |
| → inscrita | Al inscribir en un grupo | Ver «Grupos» |
| → aprobada / no_acreditada | Al capturar el examen | El resultado sale de la calificación contra el mínimo del curso |
| → sin_derecho_examen | Al concluir el grupo | Asistencia por debajo del mínimo |
| → acreditada | Al emitir la acreditación | Solicitud aprobada; se emite con la fecha del día |
| → cancelada / concluida_sin_atender | Persona o personal | Motivo. Si estaba en un grupo, sale de él |

**Elegibilidad** (al iniciar la solicitud, y otra vez sólo si en borrador cambia el curso o la acreditación a renovar):
- Dictaminador: acreditación de poda vigente ese día.
- Renovación: la acreditación más reciente de ese tipo, desde 30 días naturales antes de su vencimiento y
  hasta un año después.
- Nueva: no se admite si la persona ya tiene una de ese tipo vigente o todavía renovable.

## Vigencia de una acreditación

No se guarda: se calcula con la fecha del día (`apd.estado_acreditacion`, `apd.acreditacion_vigente`).

| Estado | Cuándo | ¿Opera? |
|---|---|---|
| `vigente` | De la emisión a 31 días antes del vencimiento | Sí |
| `por_vencer` | Últimos 30 días naturales, día del vencimiento incluido | Sí, y ya puede renovar |
| `vencida_renovable` | Hasta un año después del vencimiento | **No** |
| `vencida_no_renovable` | Después | **No**; tramita como nueva |

- Vence el día anterior al aniversario de la emisión. La renovada cuenta su año desde su propia emisión.
- Dictaminador: sigue vigente hasta su propia fecha aunque la de poda venza antes.
- La verificación pública (`apd.verificacion_publica`) sólo muestra número, nombre, tipo, fechas y «Vigente»
  o «No vigente».

## Grupos

Sede única (decisión 2026-10-16): un grupo nuevo toma la sede del parámetro `sede` (Vivero Nezahualcóyotl) si no se indica otra; la cita de cotejo también es ahí; el examen y la entrega del mismo día, en el PILARES Vivero Nezahualcóyotl, dentro del mismo predio.

| Paso | La base exige |
|---|---|
| Alta | Curso activo. Copia los cupos vigentes del curso (hoy 5 a 25) |
| Inscribir | Grupo en integración o confirmado; solicitud en espera, del mismo curso y, si el grupo es específico, de la misma organización; cupo máximo (el grupo se bloquea mientras se cuenta) |
| → confirmado | Cupo mínimo, instructor, sede y fecha de inicio. **Sin excepción** |
| → en_curso | Cupo mínimo y que haya llegado la fecha de inicio |
| → concluido | Nadie con asistencia suficiente sin calificación. Quien no alcanzó la asistencia queda sin derecho a examen |
| → cancelado | Motivo. Las personas regresan a la bandeja con su antigüedad original |

Cursos: 5 días los nuevos y 1 día las renovaciones. El instructor puede cambiar hasta concluir el grupo, con
constancia en la bitácora; sede y fecha no cambian una vez iniciado.

Asistencia: por día, nunca de un día que no ha ocurrido. Examen: sólo con la asistencia mínima del curso;
calificación mínima 7.0 en poda y 8.0 en dictaminador. Una calificación registrada no se modifica
(resultado inapelable). Cada calificación guarda su origen: captura del instructor o examen en línea.

## Siempre

- **Folios** los asigna la base: `APD-S-AAAA-NNNNN` (solicitud), `EXP-AAAA-NNNN` (expediente físico de la persona,
  en su primer cotejo; uno por CURP), referencia de pago (provisional: el folio sin guiones, al validar con cita), `APD-G-AAAA-NNN` (grupo), `PD-AAAA-NNNN` y
  `DT-AAAA-NNNN` (acreditaciones emitidas en el sistema; las migradas conservan el suyo). El de la
  acreditación es provisional: Liber definirá su formato.
- **Nombre y apellidos** se guardan en mayúsculas (`apd.mayusculas`: con acentos, diéresis y Ñ aunque el
  servidor no tenga configuración regional en español), sin espacios de más; el correo, en minúsculas.
- **CURP**: estructura, clave de entidad y dígito verificador, con las mismas reglas que el Estándar de
  formularios del SIA (`apd.curp_valida`). La base no acepta una CURP que el formulario rechazaría.
- **Bitácora**: cada alta y cambio de estado queda con quién, cuándo y desde dónde. No se edita ni se borra,
  ni siquiera por la administración.
- **Documentos**: los de la solicitud los carga la persona; los de la cita (la factura en PDF) y los de la
  entrega (la fotografía de la credencial, tomada en el lugar, y el comprobante de recepción firmado) los carga
  el personal y quedan aceptados. Sin los dos no se registra la entrega. Cada requisito dice qué formatos
  admite (`requisito.formatos`): los documentos, sólo PDF; las fotografías, sólo JPG o PNG; hasta 5 MB. Un
  requisito puede llevar el enlace oficial para obtenerlo (`enlace`, `enlace_texto`; hoy, la CURP en gob.mx).
- **Nombre de los archivos** (`apd.nombre_de_archivo`): al cargarse, cada documento y fotografía se guarda como
  `TIPO DE DOCUMENTO_NOMBRE COMPLETO.ext` (el tipo sale de `requisito.nombre_archivo`; si falta, del nombre del
  requisito). El nombre original se conserva en `nombre_original`. Ninguno de los dos se cambia después.
- **Perfil del dictaminador** (`apd.perfil_academico`, `apd.experiencia_minima`): con nivel, situación de los estudios y
  grupo de la carrera (`apd.carrera`) la base calcula el perfil y la experiencia mínima: licenciatura titulada en carrera
  principal o afín, 2 años; carta de pasante, carrera técnica o disciplina afín, 5. Un posgrado cuenta como licenciatura
  titulada en su área aunque la licenciatura sea de otra (p. ej. Química con maestría en Ciencias Forestales: 2 años). Hasta preparatoria, licenciatura en curso o trunca, o carrera no afín: «no cumple», que no impide enviar: lo decide el personal en la revisión documental. Lo que decide el personal (por clasificar o no cumple) pide 5 años. En poda se guardan nivel, carrera y situación, sin perfil (no hay estudios mínimos). Una carrera
  escrita que no está en el catálogo se agrega sin grupo («por clasificar»); al clasificarla, el perfil se recalcula.
- **Adscripción**: es de la persona (`solicitante.adscripcion` y `organizacion_id`); toda cuenta activa la tiene
  (`independiente` incluido) y cada cambio queda en la bitácora. La solicitud la copia al darse de alta y en cada
  envío (`sin_adscripcion` si falta); después no se edita. La institución es del tipo elegido y no hay institución
  si es independiente. Tipos: `independiente`, `privada`, `dependencia_cdmx`, `alcaldia`, `dependencia_federal` y
  `educativa` (UNAM en el catálogo; otras se agregan con su nombre).
- **Sexo**: `solicitante.sexo` se calcula de la CURP (columna generada); no se captura. El catálogo trae las 16 alcaldías, SOBSE, SEDEMA
  con sus Direcciones Generales, PAOT y CFE; los nombres escritos se agregan sin duplicar.
- **Fotografía de la persona** (`apd.fotografia`): una vigente por persona, sólo JPG o PNG. La persona la carga
  al crear su cuenta y la cambia mientras nadie la confirme; en el cotejo la confirma el personal contra la
  identificación (con su usuario y fecha, en la bitácora); en la cita no se toma otra (decisión 2026-10-17). Ya
  confirmada, la persona no la cambia; cómo se actualiza: P100 (la base aún admite que el personal cargue una, con
  origen `cotejo`, sin pantalla que lo use). No se modifica ni se borra: la nueva sustituye a la anterior. Tiene que
  verse clara: el día del examen, quien lo aplica la usa para confirmar que es la persona y tomarle asistencia
  (decisión 2026-10-17).
- **Nada se borra** salvo sesiones vencidas y requisitos de un curso. Un documento nuevo sustituye al
  anterior sin borrarlo.
- **La hora** sale de `apd.ahora()`. Sólo en una base de pruebas se puede simular; en producción, simularla
  es un error. Qué base es lo dice `apd.entorno()`, que sólo quien administra la base puede reemplazar.
- **Errores**: cada regla incumplida trae un mensaje para la persona y un código (`HINT apd:<codigo>`) para
  que el backend responda `{ codigo, mensaje }`.

## Cómo se prueba

`herramientas/probar-base.sh` instala todo en una base desechable, carga los expedientes ficticios como la
cuenta del servicio (pasando por cada regla) y corre `herramientas/probar-reglas.mjs`: 160 casos con fechas
movidas, cupos, permisos y bitácora (resultados de la última corrida: `docs/BITACORA-PROYECTO.md`).

Las pantallas se prueban aparte (`herramientas/probar-sitio.mjs`, `herramientas/probar-esquemas.mjs` y
`herramientas/probar-examen.mjs`); ver `docs/ETAPA-1-PANTALLAS.md` y `docs/ETAPA-2-PANTALLAS.md`.

**Un correo, una cuenta** (decisión 2026-10-17): al crear una cuenta, activar una del registro anterior o cambiar el
correo, la base rechaza el de otra cuenta activa (`correo_registrado`; índice `solicitante_correo_uk`, sólo entre cuentas
que no están `sin_activar`). La pantalla lo marca en el campo de correo.

**Grupos** (decisiones 2026-10-17): un grupo combinado admite cualquier mezcla de organizaciones e independientes; se
confirma con al menos 7 días de anticipación al primer día (`anticipacion`, parámetro `dias_anticipacion_grupo`); a un
grupo confirmado se agregan personas hasta el día anterior al inicio (`grupo_por_iniciar`), sin pasar del máximo.

