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
| Alta | Persona solicitante | Elegibilidad (abajo). Una sola solicitud activa por persona y tipo de acreditación (`solicitud_activa`, con el folio de la que está en curso; el índice `solicitud_una_activa` queda como última defensa si dos altas llegan a la vez; auditoría «intentar romperlo», bloque 2) |
| → enviada | Persona solicitante | Documentos obligatorios en línea; estudios en los dos tipos (nivel; con licenciatura o posgrado, la carrera; con licenciatura, además, su situación —con posgrado se asume titulada—: `faltan_estudios`); en dictaminador nueva, la experiencia mínima de su perfil (`experiencia_insuficiente`; un perfil que no cumple sí se envía y lo revisa el personal; la renovación no vuelve a pedir la experiencia); en la primera renovación de quien viene de Kobo sin archivos en el sistema, todos los documentos, como una nueva (`faltan_documentos_kobo`); fotografía de frente de la persona; adscripción de la persona, que se copia a la solicitud. La elegibilidad no se vuelve a comprobar |
| → con_observaciones / validada_en_linea | Revisión (con una revisión registrada) | Para validar: todos los documentos aceptados y la cita asignada; en dictaminador, la carrera clasificada (`carrera_sin_clasificar`) y un perfil que cumple (`perfil_no_cumple`). Las observaciones necesitan un texto general o un documento observado. Una sola revisión por vuelta: si otra persona del personal ya la registró, la segunda se rechaza (`revision_ya_registrada`; ver «Dos personas a la vez») |
| → rechazada | Revisión (revisión con resultado `rechazada`) | Sólo dictaminador cuyo perfil no cumple (`rechazo_sin_causa`): carrera clasificada como no afín, o estudios que el comprobante confirma por debajo del lineamiento. Motivo obligatorio (`rechazo_sin_motivo`), que se copia a `motivo_cierre`. Es final: la persona puede iniciar otra solicitud |
| Clasificar una carrera | Personal (`apd.carrera.grupo`) | Sólo el personal (`clasificacion_sin_permiso`); queda en la bitácora y las solicitudes abiertas con esa carrera recalculan perfil y experiencia mínima |
| → lista_para_curso | Cotejo | La factura del pago en PDF, cargada por el personal, con RFC, nombre o razón social y folio fiscal capturados, y la fotografía de la cuenta confirmada por el personal (en la cita no se toma otra, decisión 2026-10-17). Abre el expediente de la persona si es su primer cotejo (uno por CURP) y arranca la espera de grupo. Sin factura no hay grupo ni fecha. Además, todos los documentos en línea coincidieron (`documentos_sin_cotejar`) y la cita quedó atendida (`cotejo_sin_cita`). El folio fiscal no se repite en dos solicitudes (`folio_fiscal_repetido`) |
| Cita de cotejo (`apd.cita`) | Personal | La crea la base al validar o al cambiar la cita (el cambio queda en la bitácora); con una cita abierta no se asigna otra (`cita_abierta`), y sólo el personal la asigna (`cita_de_personal`). Se cierra una vez (`cita_cerrada`): atendida, en pausa (con un documento marcado como no coincidente, `cotejo_sin_documento`; sólo ese día, `pausa_vencida`), con observaciones (la solicitud regresa), sin pago, no se presentó (a la segunda, la solicitud se cierra: `inasistencias_cotejo_maximas`) o no era la persona (la cuenta queda bloqueada; sólo la Secretaría la bloquea o desbloquea, `bloqueo_de_personal`). Si la solicitud se cancela con la cita abierta, la base la cierra como `cancelada`, con el motivo (decisión 8, 2026-10-19); nadie la marca así a mano (`cita_sin_cancelacion`). En pausa la persona sólo carga el documento que no coincidió. `apd.cerrar_pausas_vencidas()` regresa con observaciones las pausas de días anteriores. Lo que pasó en una cita se registra su día, no antes (`cita_futura`), y una cita se asigna hasta `meses_adelanto_cita` meses adelante (`cita_lejana`; auditoría «intentar romperlo», 2026-10-18), de lunes a viernes (`cita_en_fin_de_semana`) y de `cita_hora_desde` a `cita_hora_hasta` (9:30 a 14:30; `cita_fuera_de_horario`; P69, sesión de trabajo del 23/10/2026) |
| → inscrita | Al inscribir en un grupo | Ver «Grupos» |
| → aprobada / no_acreditada | Al capturar el examen | El resultado sale de la calificación contra el mínimo del curso |
| → sin_derecho_examen | Al concluir el grupo | Asistencia por debajo del mínimo |
| → acreditada | Al emitir la acreditación | Solicitud aprobada; se emite con la fecha del día |
| → cancelada / concluida_sin_atender | Persona o personal | Motivo. Si estaba en un grupo, sale de él. Al cancelar, su cita de cotejo abierta (por atender o en pausa) queda `cancelada`, con el motivo (decisión 8, 2026-10-19) |

**Elegibilidad** (al iniciar la solicitud, y otra vez sólo si en borrador cambia el curso o la acreditación a renovar):
- Las dos acreditaciones: `edad_minima` (18) años cumplidos ese día, con la fecha de nacimiento de la CURP
  (`apd.curp_nacimiento`; `menor_de_edad`; P138, sesión de trabajo del 23/10/2026).
- Dictaminador: acreditación de poda vigente ese día.
- Dictaminador por primera vez: la de poda durante al menos `anios_poda_dictaminador` (2) años consecutivos
  (`poda_menos_de_dos_anios`; sesión de trabajo del 23/10/2026). `apd.poda_continua_desde(persona, día)` parte de la poda
  vigente y va hacia atrás: la anterior cuenta si la siguiente se emitió a más tardar `meses_despues_renovacion` (12)
  meses después de su vencimiento (la ventana de renovación tardía); si no, ahí hay un corte y la cuenta empieza en la
  siguiente. La renovación de dictaminador sigue pidiendo sólo la poda vigente (P197: definición por confirmar).
- Renovación: la acreditación más reciente de ese tipo, desde 30 días naturales antes de su vencimiento y
  hasta un año después.
- Nueva: no se admite si la persona ya tiene una de ese tipo vigente o todavía renovable.

## Vigencia de una acreditación

No se guarda: se calcula con la fecha del día (`apd.estado_acreditacion`, `apd.acreditacion_vigente`).

| Estado | Cuándo | ¿Opera? |
|---|---|---|
| `vigente` | De la emisión a 31 días antes del vencimiento | Sí |
| `por_vencer` | Los 30 días naturales antes del vencimiento y el día del vencimiento (31 días; parámetro `dias_antes_renovacion` = 30) | Sí, y ya puede renovar |
| `vencida_renovable` | Hasta un año después del vencimiento | **No** |
| `vencida_no_renovable` | Después | **No**; tramita como nueva |
| `cancelada` | Desde el día de su cancelación (P120, sesión de trabajo del 23/10/2026) | **No**; no se renueva |

- Vence el día anterior al aniversario de la emisión. La renovada cuenta su año desde su propia emisión.
- Dictaminador: sigue vigente hasta su propia fecha aunque la de poda venza antes.
- La verificación pública (`apd.verificacion_publica`) sólo muestra número, nombre, tipo, fechas y «Vigente»,
  «No vigente» o «Cancelada» (con el día de la cancelación, sin el motivo ni el fundamento).

## Cancelación de una acreditación (P120, sesión de trabajo del 23/10/2026)

- La registran los instructores y la Dirección: el backend declara el perfil del personal (`apd.perfil`) y la base sólo
  admite los del parámetro `perfiles_cancelan_acreditacion` (`instructor,administracion`, P27). La persona solicitante y
  los demás perfiles reciben `cancelacion_sin_permiso`.
- Sólo de una acreditación vigente ese día (`cancelacion_no_vigente`), con motivo de al menos 10 caracteres
  (`cancelacion_sin_motivo`) y fundamento (`cancelacion_sin_fundamento`; mientras la Dirección Jurídica fija las causas,
  «[Art. __, fracc. __]»). La base pone el día y quién (`cancelada_en`, `cancelada_por`: la cuenta del servicio no los
  escribe); no se cambia ni se deshace (`acreditacion_ya_cancelada`) y queda en la bitácora con el motivo y el fundamento.
- Una cancelada no es vigente desde ese día (`apd.cancelada_al`), no se renueva (`renovacion_cancelada`), no sirve de
  requisito (la poda del dictaminador: `sin_poda_vigente`), corta la cuenta de los dos años de poda
  (`apd.poda_continua_desde`) y no se entrega (`entrega_de_cancelada`). Al cancelarla, la base cancela su reposición
  abierta y sus renovaciones en trámite, con el motivo; si la renovación ya estaba aprobada, no se emite
  (`renovacion_de_cancelada`). No impide una solicitud nueva: si y cuándo se puede volver a pedir lo fija la Dirección
  Jurídica (P120).

## Reposición de la credencial (P140, sesión de trabajo del 23/10/2026)

| Paso (`apd.reposicion.estado`) | Quién | Qué pide la base |
|---|---|---|
| → `solicitada` | La persona titular (`reposicion_de_la_persona`) | Acreditación vigente (`reposicion_no_vigente`), credencial ya entregada si es del sistema (`reposicion_sin_entrega`), una sola abierta (`reposicion_en_curso`; índice `reposicion_una_abierta`), acta PDF, JPG o PNG de hasta 5 MB (`archivo_grande`). La base nombra el acta (ACTA DE PERDIDA O ROBO_NOMBRE.ext) |
| `solicitada` → `con_observaciones` | Personal (`reposicion_de_personal`) | Qué corregir, al menos 10 caracteres (`observaciones_vacias`) |
| `con_observaciones` → `solicitada` | La persona | Otra acta (`acta_sin_cambio`); la bitácora conserva la anterior. El acta no cambia en otro paso (`acta_fuera_de_turno`) |
| `solicitada` → `acta_aceptada` | Personal | Fija el monto de la cuota vigente ese día (`apd.cuota`, clave `reposicion_credencial`); un cambio posterior no lo altera |
| `acta_aceptada` → `repuesta` | Personal, en el Vivero | La factura de la cuota: RFC válido, nombre y folio fiscal que no se repite con otra reposición ni con una solicitud (`sin_factura`, `folio_fiscal_repetido`; la factura no se captura en otro paso: `factura_fuera_de_turno`). La base pone el día y quién. La acreditación no cambia: mismo número, emisión y vigencia |
| abierta → `cancelada` | Cualquiera, con motivo (`reposicion_sin_motivo`); la base, al cancelar la acreditación | — |

Otro cambio de paso es `transicion_reposicion`; el motivo (pérdida o robo) sólo cambia al corregir el acta. La cuota la
cambia sólo el personal (`cuota_de_personal`), con su publicación y su fecha de inicio (`cuota_monto_ck`), y queda en la
bitácora.

## Grupos

Sede única (decisión 2026-10-16): un grupo nuevo toma la sede del parámetro `sede` (Vivero Nezahualcóyotl) si no se indica otra; la cita de cotejo también es ahí; el examen, en el salón de cómputo del PILARES Vivero Nezahualcóyotl, dentro del mismo predio; la entrega de la credencial, en la oficina del Vivero (decisión 2026-10-18).

| Paso | La base exige |
|---|---|
| Alta | Curso activo. Copia los cupos vigentes del curso (hoy 5 a 25) |
| Primer día | A lo más 12 meses después de hoy, ese día incluido (`apd.hoy() + interval '12 months'`, el mismo cálculo que la pantalla; `inicio_muy_lejano`, decisión 3, 2026-10-19), al crear el grupo y en cada cambio de fecha. Ningún día del curso en sábado ni domingo: el de 5 días va de lunes a viernes (`curso_en_fin_de_semana`; P150 y P151). Como máximo `grupos_simultaneos_maximo` (2) grupos al mismo tiempo, de cualquier curso, contando los activos con fecha (por confirmar, confirmados y en curso; `grupos_simultaneos`, P149), con un candado de la transacción para que dos que programan a la vez no dejen tres. Hora de entrada entre `curso_hora_entrada` (09:00) y antes de `curso_hora_salida` (15:00) (`hora_fuera_de_horario`, P91). Lo revisa `apd.comprobar_fechas_grupo` (sesión de trabajo del 23/10/2026) |
| Inscribir | Grupo en integración o confirmado; solicitud en espera, del mismo curso y, si el grupo es específico, de la misma organización; cupo máximo (el grupo se bloquea mientras se cuenta) |
| Baja | Motivo (`baja_sin_motivo`); no a quien ya presentó examen (`baja_con_examen`). El grupo se bloquea mientras se da: si un grupo confirmado queda por debajo del mínimo, regresa a integración |
| → confirmado | Cupo mínimo, instructor, sede y fecha de inicio. **Sin excepción** |
| → en_curso | Cupo mínimo y que haya llegado la fecha de inicio |
| → concluido | Nadie con asistencia suficiente sin calificación. Quien no alcanzó la asistencia queda sin derecho a examen |
| → cancelado | Motivo. Las personas regresan a la bandeja con su antigüedad original |

Cursos: 5 días los nuevos (de lunes a viernes; el quinto, de repaso de conocimientos y examen final) y 1 día las
renovaciones, de 9:00 a 15:00. El instructor puede cambiar hasta concluir el grupo, con
constancia en la bitácora; sede y fecha no cambian una vez iniciado. Cada cambio de primer día, hora de entrada o sede
queda en la bitácora con lo que había.

Asistencia: por día, nunca de un día que no ha ocurrido; la del último día se registra al pasar lista en el examen
(P94); la captura el personal con su cuenta (`captura_de_personal`) y quien capturó lo pone la base; una corrección queda
en la bitácora con el valor anterior. Examen: el último día del curso (`fecha_examen`), con el pase de lista de ese día
(`sin_pase_de_lista`) y la asistencia mínima del curso, capturado por el personal o el examen en línea, a su nombre;
calificación mínima 7.0 en poda y 8.0 en dictaminador. Una calificación registrada no se modifica
(resultado inapelable). Cada calificación guarda su origen: captura del instructor o examen en línea.

## Días hábiles y espera de grupo (sesión de trabajo del 23/10/2026)

- Sábados y domingos son inhábiles (P150): `apd.es_habil(día)`; los plazos en días hábiles se cuentan con
  `apd.suma_dias_habiles(desde, n)` y `apd.dias_habiles_entre(desde, hasta)`, sin ellos. El calendario de festivos de la
  Gaceta está pendiente (P150) y se agrega en `apd.es_habil`.
- La espera de grupo es prioritaria desde `dias_alerta_espera` (15) días (P143: la Secretaría asigna grupo en 15 días si se
  completa el cupo mínimo).
- En la espera sólo se agrupan en bloque las instituciones de gobierno local y federal (`apd.es_gobierno(tipo)`:
  `dependencia_cdmx`, `alcaldia` y `dependencia_federal` del catálogo `apd.organizacion`); `apd.bandeja_demanda` trae
  `es_gobierno` y `bloque` (su organización, o vacío). Las demás adscripciones van una por una en el orden general.
- En poda no se pregunta ni se guarda la situación de la licenciatura (`estatus_estudios`); en dictaminador sí, porque
  define el perfil.

## Siempre

- **Folios** los asigna la base: `APD-S-AAAA-NNNNN` (solicitud), `EXP-AAAA-NNNN` (expediente físico de la persona,
  en su primer cotejo; uno por CURP), referencia de pago (provisional: el folio sin guiones, al validar con cita), `APD-G-AAAA-NNN` (grupo), `PD-AAAA-NNNN` y
  `DT-AAAA-NNNN` (acreditaciones emitidas en el sistema; las migradas conservan el suyo). El de la
  acreditación es provisional: Liber definirá su formato. Los pide sólo la base, al dar de alta: la cuenta del servicio
  no puede llamar `apd.siguiente_folio` ni `apd.asignar_expediente` (decisión 6, 2026-10-19).
- **Acreditaciones migradas** (registro anterior: Kobo o papel; D-01): las da de alta sólo la carga de migración
  (`usuario_tipo = 'migracion'`, `migracion_sin_permiso`), con su fecha de emisión, que no puede ser posterior a hoy
  (`migrada_futura`), y su número original, que nunca tiene la forma de la serie del sistema (`migrada_con_serie`; además,
  la restricción `acreditacion_numero_serie_ck`): así una migrada no choca con la siguiente emisión ni detiene la serie.
- **Nombre y apellidos** se guardan en mayúsculas (`apd.mayusculas`: con acentos, diéresis y Ñ aunque el
  servidor no tenga configuración regional en español), sin espacios de más; el correo, en minúsculas.
- **CURP, RFC y correo**: la base rechaza lo mismo que el formulario, con las reglas del Estándar de formularios del
  SIA (A1-01, auditoría 2026-10-19). CURP (`apd.curp_valida`): estructura, fecha de nacimiento real y no futura (el siglo
  lo da el carácter 17: dígito, 1900; letra, 2000), clave de entidad y dígito verificador. RFC de la factura
  (`apd.rfc_valido`): estructura, con Ñ y &, y fecha real. Correo (`apd.correo_valido`): en minúsculas, hasta 120
  caracteres y un dominio que termina en dos letras o más. `probar-reglas.mjs` cruza los dos validadores con los mismos valores.
- **Bitácora**: cada alta y cambio de estado queda con quién, cuándo y desde dónde, y también cada decisión que cambia un
  trámite (E2-04, auditoría 2026-10-19): aceptar u observar un documento (con quién lo había decidido), asignar o cambiar la
  cita, lo que la persona corrige de sus estudios después de enviar, corregir una asistencia (con el valor anterior), cambiar
  el primer día, la hora o la sede de un grupo, cambiar el estado de una cuenta, poner o quitar un bloqueo por intentos y
  agregar, quitar o cambiar un requisito de un curso. No se edita ni se borra (tampoco la administración, mientras no
  apague sus disparadores; ver «Respaldo»). La escriben sólo las reglas: la cuenta del servicio no tiene INSERT sobre ella,
  `apd.registrar` corre con los permisos de quien instala y sólo desde un disparador (`bitacora_directa`), y la fecha, la
  cuenta, el tipo y la procedencia de cada renglón los pone la base con el contexto de la transacción (D-13).
- **Entrada con contraseña** (D-07): `apd.anotar_intento(curp)` suma un intento fallido en un solo paso y, al llegar a
  `intentos_maximos` (parámetro, 5), bloquea la entrada `minutos_bloqueo` minutos (parámetro, 15); más intentos no alargan
  el bloqueo y uno después de un bloqueo vencido empieza de nuevo. `apd.acceso_correcto(curp)` rechaza la entrada con un
  bloqueo vigente (`cuenta_bloqueada_intentos`) y, si no, vuelve el contador a 0. Poner o quitar un bloqueo vigente queda
  en la bitácora.
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
  titulada en su área aunque la licenciatura sea de otra (p. ej. Química con maestría en Ciencias Forestales: 2 años). La situación del grado sólo se pregunta con licenciatura (decisión 2026-10-18). Hasta preparatoria, licenciatura en curso o trunca, o carrera no afín: «no cumple», que no impide enviar: lo decide el personal en la revisión documental. Lo que decide el personal (por clasificar o no cumple) pide 5 años. En poda se guardan nivel, carrera y situación, sin perfil (no hay estudios mínimos). Una carrera
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
- **Material de estudio** (`apd.material_estudio`, decisión 2026-10-18): lo carga y lo cambia sólo el personal
  (`carga_de_personal`); sólo PDF, hasta 30 MB (parámetro `tamano_maximo_material_bytes`); una carga vigente por documento
  (`material_estudio_vigente_uk`); el archivo cargado no se modifica (`documento_inmutable`); reemplazar no borra el
  archivo anterior y conserva si estaba publicado; el público lo ve en `apd.material_publico` (sólo lo publicado y
  vigente).
- **Nada se borra** salvo sesiones vencidas y requisitos de un curso. Un documento nuevo sustituye al
  anterior sin borrarlo.
- **La hora** sale de `apd.ahora()`. Sólo en una base de pruebas se puede simular; en producción, simularla
  es un error. Qué base es lo dice `apd.entorno()`, que sólo quien administra la base puede reemplazar.
- **Errores**: cada regla incumplida trae un mensaje para la persona y un código (`HINT apd:<codigo>`) para
  que el backend responda `{ codigo, mensaje }`.

## Dos personas a la vez (decisión 4, 2026-10-19)

Cada regla que consulta otra fila la bloquea (`FOR UPDATE`) antes de mirarla, así que la segunda transacción espera a la
primera, ve lo que hizo y, si ya no corresponde, recibe el error de su regla con su código:

| Quién bloquea | Qué | Para que no pase |
|---|---|---|
| La revisión (`revision_alta`) y la decisión sobre un documento (`documento_cambio`) | La solicitud | Dos revisiones en la misma vuelta, una revisión que regresa una solicitud ya validada, observaciones sin nada que corregir (`revision_ya_registrada`, `observaciones_vacias`) |
| La baja de una inscripción (`inscripcion_cambio`) | El grupo | Un grupo confirmado por debajo del mínimo (`cupo_minimo`, o el grupo regresa a integración) |
| La inscripción (`inscripcion_alta`) | El grupo y la solicitud | Pasar del cupo máximo; la misma solicitud en dos grupos |
| Fijar o cambiar la fecha de un grupo (`apd.comprobar_fechas_grupo`, sesión de trabajo del 23/10/2026) | Un candado de la transacción (`pg_advisory_xact_lock`) | Tres grupos al mismo tiempo cuando dos personas programan a la vez (`grupos_simultaneos`, P149) |
| La asistencia (`asistencia_captura`) y el examen (`examen_captura`) | La inscripción | Examen de quien se dio de baja o sin el pase de lista del día del examen (`baja_con_examen`, `inscripcion_inactiva`, `asistencia_cerrada`, `sin_pase_de_lista`) |
| Pedir y cambiar una reposición (`reposicion_alta`, `reposicion_cambio`; sesión de trabajo del 23/10/2026) | La acreditación | Dos reposiciones abiertas de la misma credencial (`reposicion_en_curso`); una credencial repuesta después de cancelada su acreditación (la cancelación cancela la reposición abierta) |

`herramientas/probar-concurrencia.sh` lo comprueba con dos conexiones de la cuenta del servicio a la vez (24 escenarios).

Para el backend: si una transacción de revisión cambia la cita antes que los documentos y otra decide un documento al
mismo tiempo, PostgreSQL puede encontrar un interbloqueo y abortar una de las dos (`40P01`, sin código `apd:`); la base
queda bien, pero la persona del personal debe recibir «La solicitud cambió: recargue». Se evita empezando cada
transacción que decide sobre una solicitud con `SELECT 1 FROM apd.solicitud WHERE id = $1 FOR UPDATE`, o reintentándola
una vez ante `40P01`.

## Permisos

La cuenta del servicio (`apd_api`) tiene lo mínimo para operar (`05-apd-rol-y-permisos.sql`): no borra salvo sesiones y
requisitos de un curso, no escribe la bitácora, no pide folios ni abre expedientes, no crea objetos y su `search_path` es
`apd, pg_temp`, sin `public` (D-10): nada que alguien cree en `public` se resuelve antes que lo del esquema.

**En PostgreSQL 13 y 14**, PUBLIC puede crear objetos en el esquema `public` por omisión (desde la 15 ya no). Ahí, quien
administra la base debe correr, antes de usarla, `REVOKE CREATE ON SCHEMA public FROM PUBLIC;` (si el SIA lo acepta para
toda la base; si no, exigir PostgreSQL 15 o mayor). La instalación lo avisa (WARNING) si no se ha hecho.

## Respaldo (decisión 5, 2026-10-19)

1. El respaldo se toma con `pg_dump -Fc` (formato propio, no texto editable) y, al tomarlo, se calcula su huella
   (`sha256sum respaldo.dump > respaldo.dump.sha256`).
2. **La huella se guarda aparte del respaldo**: en otro lugar y con otro responsable que el respaldo mismo. Quien pueda
   cambiar el respaldo no debe poder cambiar su huella.
3. Antes de restaurar se comprueba la huella (`sha256sum -c`): si no coincide, el respaldo no se usa.
4. **Restauración de prueba, una vez al mes**: el respaldo más reciente se restaura en otra base (nunca sobre la de
   producción), con `pg_restore --exit-on-error`, y se comprueba que cada tabla tiene los mismos renglones que la original
   en el momento del respaldo, que la huella de la bitácora es la misma, que los disparadores siguen activos y que
   `probar-reglas.mjs` pasa completo sobre la restaurada. El resultado se anota en la bitácora del proyecto.
5. `herramientas/probar-base.sh` hace todo esto en cada corrida (paso 7), con la huella en otra carpeta.

La cadena de huellas dentro de la bitácora, para notar un renglón alterado aun sin respaldo, queda para antes de usar datos
reales (decisión 5). Mientras, quien es dueño del esquema puede apagar los disparadores de la bitácora: esa cuenta no debe
ser de uso diario y sus cambios de estructura deben quedar registrados en el servidor (`log_statement = 'ddl'`).

## Cómo se prueba

`herramientas/probar-base.sh` instala todo en una base desechable, carga los expedientes ficticios como la
cuenta del servicio (pasando por cada regla) y corre `herramientas/probar-reglas.mjs`: casos con fechas movidas,
cupos, permisos y bitácora, un caso por cada regla con código (salvo las anotadas en el guion, con su porqué) y el
cruce de CURP, RFC y correo con el validador del formulario; después, `herramientas/probar-concurrencia.sh` (dos
conexiones a la vez) y el respaldo con su restauración de prueba (resultados de la última corrida:
`docs/BITACORA-PROYECTO.md`).

Las pantallas se prueban aparte (`herramientas/probar-sitio.mjs`, `herramientas/probar-esquemas.mjs` y
`herramientas/probar-examen.mjs`); ver `docs/ETAPA-1-PANTALLAS.md` y `docs/ETAPA-2-PANTALLAS.md`.

**Un correo, una cuenta** (decisión 2026-10-17): al crear una cuenta, activar una del registro anterior o cambiar el
correo, la base rechaza el de otra cuenta activa (`correo_registrado`; índice `solicitante_correo_uk`, sólo entre cuentas
que no están `sin_activar`). La pantalla lo marca en el campo de correo.

**Grupos** (decisiones 2026-10-17): un grupo combinado admite cualquier mezcla de organizaciones e independientes; se
confirma con al menos 7 días de anticipación al primer día (`anticipacion`, parámetro `dias_anticipacion_grupo`); a un
grupo confirmado se agregan personas hasta el día anterior al inicio (`grupo_por_iniciar`), sin pasar del máximo.

