# Registro de decisiones

Toda regla del sistema sale de aquí. Si una petición contradice una decisión registrada, se advierte antes de
ejecutarla y, si se acepta, se anota la nueva con su fecha sin borrar la anterior.

Insumo de origen: `docs/insumos-lineamientos-borrador.txt` (borrador de lineamientos de la Dirección de
Infraestructura Verde). **Cuando una decisión de este registro contradice el borrador, manda este registro y
el borrador debe actualizarse** (sección «Lo que hay que corregir en los lineamientos»).

## Alcance

| Fecha | Decisión | Quién |
|---|---|---|
| 2026-10-14 | El sistema sustituye a Kobo ToolBox por completo: la carga de la persona solicitante y el seguimiento interno | Liber Saltijeral |
| 2026-10-14 | El trámite es siempre individual. Pertenecer a una organización es un atributo de la solicitud que sirve para agrupar la demanda; las organizaciones no inscriben a su personal, no pagan en conjunto y no tienen enlace con cuenta | Liber Saltijeral |
| 2026-10-14 | Volumen esperado: 1,000 solicitudes al año | Liber Saltijeral |
| 2026-10-14 | Documentos de hasta 5 MB cada uno (antes 2 MB) (mapa, R12) | Liber Saltijeral |
| 2026-10-15 | Datos internos: lo que calcula el sistema y se guarda en la base (el sexo tomado de la CURP, el curso que corresponde) no lo ve la persona. Lo que no se guarda (p. ej. «sin segundo apellido») no se muestra ni en prueba. En la versión de prueba se muestra en amarillo, con una nota de que en producción no se ve; al pasar al SIA queda oculto | Liber Saltijeral |
| 2026-10-15 | Cada publicación de la versión de prueba sube su número (0.2, 0.3…), visible abajo de cada pantalla, para saber si se ve la última. El historial con fecha y cambio está en docs/VERSIONES.md | Liber Saltijeral |
| 2026-10-15 | Las preguntas de opción se muestran como lista, una opción por renglón y con el botón de opción visible (variante `opciones-lista` del estándar), en lugar de tarjetas en rejilla, que confundían. Aplica a todo el sistema, también al Sí/No. Se eligió entre cuatro estilos | Liber Saltijeral |
| 2026-10-15 | Los documentos que carga la persona se aceptan sólo en PDF (antes también JPG y PNG). Las fotografías siguen siendo imagen. A quien tenga una foto del documento se le sugiere convertirla con el escáner de su teléfono | Liber Saltijeral |
| 2026-10-15 | El requisito de la CURP y el campo de CURP de la cuenta llevan el enlace oficial para obtenerla: https://www.gob.mx/curp/ | Liber Saltijeral |

## Cuentas

| Fecha | Decisión | Quién |
|---|---|---|
| 2026-10-14 | Las personas solicitantes siempre tienen cuenta propia, que crean ellas mismas | Liber Saltijeral |
| 2026-10-14 | La CURP es el identificador único de la cuenta: no hay dos cuentas con la misma CURP. La Secretaría puede corregir la CURP de una cuenta, con motivo en la bitácora, después de verificarla contra el documento de CURP cargado (mapa, R02) | Liber Saltijeral |
| 2026-10-14 | Instructores: personal de la Secretaría; capturan asistencia por día y calificación | Liber Saltijeral |
| 2026-10-14 | El instructor de un grupo puede variar, también durante el curso; cada día queda quién capturó la asistencia (mapa, R26) | Liber Saltijeral |
| 2026-10-14 | Al crear la cuenta se pide la fecha de nacimiento y el sistema comprueba que la CURP corresponda al nombre, a los apellidos y a esa fecha, además de su dígito verificador, para evitar CURP ajenas. Comprueba coherencia, no identidad: la identidad la confirma la identificación oficial en el cotejo. La fecha no se guarda aparte (ya está en la CURP) | Liber Saltijeral |
| ~~2026-10-14~~ | ~~La cuenta pregunta «¿Tienes segundo apellido?»~~ Sustituida | Liber Saltijeral |
| 2026-10-14 | No se pregunta si hay segundo apellido: si se deja vacío, la CURP debe llevar X en su lugar (si la CURP indica que sí hay, se pide escribirlo). Nadie queda sin comprobar ni atrapado. La CURP se vuelve a comprobar al momento si se cambia el nombre, los apellidos o la fecha después de escribirla | Liber Saltijeral |
| 2026-10-14 | La solicitud pregunta sólo la acreditación (poda y derribo o dictaminador técnico). Si es nueva o renovación lo decide el historial de la persona y se le informa; no se pregunta. Sólo se deshabilita lo que no puede pedir, con su motivo | Liber Saltijeral |
| 2026-10-14 | Al crear la cuenta se pide una fotografía de frente, obligatoria (JPG o PNG, hasta 5 MB; en el teléfono puede tomarse con la cámara frontal). Sirve para reconocer a la persona en el cotejo, el curso y el examen. Se pide también a quien activa una cuenta del registro de Kobo. Sin fotografía no se envía una solicitud. Mientras nadie la confirma, la persona puede cambiarla; las anteriores se conservan | Liber Saltijeral |
| 2026-10-14 | En la cita de cotejo el personal confirma, contra la identificación oficial, que la fotografía es de quien se presentó; si no se parece o no sirve, le toma una nueva ahí, que queda confirmada. Sin fotografía confirmada no se concluye el cotejo. Ya confirmada, la persona no la cambia: se toma otra en su próxima cita. La solicitud no se regresa con observaciones por la fotografía (propuesta de Claude) | Propuesta |
| 2026-10-15 | En «Crea tu cuenta», nombre, apellidos y CURP se escriben en mayúsculas al momento, aunque la persona los teclee en minúsculas, y así se guardan (con acentos, diéresis y Ñ). El correo se guarda en minúsculas y la contraseña tal como se escribe, porque distingue mayúsculas | Liber Saltijeral |
| 2026-10-15 | «Mis datos»: la persona consulta sus datos ligados a la CURP (nombre, CURP, fecha de nacimiento, sexo, expediente; sólo los corrige la Secretaría) y cambia correo, teléfono, adscripción y, mientras no esté confirmada, su fotografía | Liber Saltijeral |
| 2026-10-15 | El sexo forma parte de los datos generales. Se toma de la CURP (posición 11) y se muestra de sólo lectura, como pide el Estándar de formularios; no se pregunta aparte | Liber Saltijeral / estándar |
| 2026-10-15 | La adscripción es de la persona, no de la solicitud: se pide al crear la cuenta y se cambia en «Mis datos». Cada solicitud guarda la que la persona tenía al enviarla (y al reenviarla con correcciones). «No, soy independiente» es una respuesta explícita | Liber Saltijeral |
| 2026-10-15 | Adscripción: sexto tipo «Institución educativa», con la UNAM en la lista y «otra» con su nombre. El nombre de la empresa se elige de las ya registradas (autocompletado) o se escribe uno nuevo. La Dirección General de la SEDEMA es una lista cerrada (sin «otra área»). La alcaldía se elige de una lista con las 16, en orden alfabético. La segunda contraseña dice «Confirma tu contraseña» | Liber Saltijeral |
| 2026-10-15 | «Mis solicitudes» muestra en cada estado sólo lo que le sirve a la persona: «En revisión documental» mientras se revisan sus documentos; con grupo, cuándo presentarse, cuándo termina el curso (días consecutivos, como los cuenta la base) y dónde; con la acreditación emitida, su folio e inicio y fin de vigencia, sin sede, duración, asistencia ni calificación. Concepto, monto, referencia de pago y hora de entrada se marcan en amarillo «por confirmar» hasta tenerlos | Liber Saltijeral |
| ~~2026-10-15~~ | ~~El nombre con que se guarda cada archivo se ve sólo en la versión de prueba~~ Sustituida | Liber Saltijeral |
| 2026-10-15 | La persona ve con qué nombre se guarda cada documento (TIPO_NOMBRE COMPLETO): bajo cada archivo cargado y en la revisión, donde el nombre nuevo va primero y el archivo que subió, debajo. El renombrado lo hace la base al registrar el documento; la persona no renombra nada | Liber Saltijeral |
| 2026-10-15 | Identificadores: «Folio de la solicitud» (cada trámite), «Número de expediente» (la persona) y «Número de acreditación» (la credencial). «Fecha en que enviaste la solicitud» en lugar de «Enviada el» | Liber Saltijeral |
| 2026-10-15 | El curso es siempre en días consecutivos | Liber Saltijeral |
| 2026-10-15 | Perfil del dictaminador en tres preguntas, como el formulario de Kobo: último nivel de estudios; desde licenciatura, qué carrera (catálogo cgo_carreras con autocompletado, admite carreras nuevas) y su situación (en curso, trunco, concluido, titulado). Según los lineamientos, licenciatura titulada en Biología, Ingeniería Forestal, Ingeniería Agrónoma o carrera afín pide 2 años de experiencia; carta de pasante, carrera técnica o disciplina afín, 5. La base calcula el perfil y el mínimo; la carrera que no está clasificada la clasifica la Secretaría en la revisión documental | Liber Saltijeral |
| 2026-10-15 | Supuestos del perfil por confirmar (P60): un posgrado cuenta como licenciatura titulada; con preparatoria o menos, o licenciatura en curso o trunca, la solicitud no se envía | Propuesta |
| 2026-10-14 | Para activar una cuenta del registro de Kobo, el nombre escrito debe ser el del registro; si no coincide, la persona acude a la Secretaría (propuesta de Claude, en el mapa como R03) | Propuesta |
| — | Quién restablece las contraseñas si el SIA no da correo | **Pendiente** |

## Requisitos

| Fecha | Decisión | Quién |
|---|---|---|
| 2026-10-15 | Cada archivo cargado se guarda con el nombre TIPO DE DOCUMENTO_NOMBRE COMPLETO DEL INTERESADO (p. ej. CURP_JUAN RAMIREZ OSORIO.pdf), sin importar cómo lo nombró la persona; el nombre original se conserva aparte. Mayúsculas sin acentos; la Ñ se conserva. Igual para la fotografía (FOTOGRAFIA_…) y los documentos que carga el personal (FACTURA_…, COMPROBANTE DE RECEPCION_…) | Liber Saltijeral |
| 2026-10-14 | Las constancias de capacitación sólo se piden para dictaminador, y ahí son obligatorias en la solicitud nueva (mapa, R11). [pendiente] confirmar que también aplican a quien tiene título | Liber Saltijeral |

## Cotejo presencial

| Fecha | Decisión | Quién |
|---|---|---|
| 2026-10-14 | Se mantiene la cita presencial de cotejo y pago: la Secretaría necesita expedientes físicos. La persona lleva la documentación impresa, se coteja contra lo cargado con el check list y se verifica el pago | Liber Saltijeral |
| 2026-10-14 | La factura es obligatoria siempre que hay pago. En la cita, la Secretaría verifica el pago, emite la factura y su personal la carga en el sistema (sólo PDF). La persona solicitante no la carga | Liber Saltijeral |
| 2026-10-14 | Al validar en línea y asignar la cita, el sistema da a la persona los datos de pago (concepto, monto y referencia bancaria) para que pague y presente el comprobante en el cotejo. Monto, referencia definitiva, banco y forma de pago: **pendientes** (Gaceta Oficial y Finanzas); la referencia provisional es el folio sin guiones | Liber Saltijeral |
| 2026-10-14 | El monto del pago es configurable por el personal y distinto para cada curso (poda nueva, poda renovación, dictaminador nueva, dictaminador renovación). Se captura con la publicación de la Gaceta Oficial que lo fija y desde cuándo aplica; cada cambio queda en la bitácora. Quien ya tiene cita conserva el monto que se le indicó | Liber Saltijeral |
| 2026-10-14 | Hasta que la factura está cargada, la solicitud no entra a la bandeja: no se le puede asignar grupo ni fecha de curso y examen | Liber Saltijeral |
| 2026-10-14 | Cargada la factura, la solicitud entra sola a la bandeja de grupos («en espera de grupo»); el personal arma los grupos desde ahí. No se inscribe sola a un grupo | Liber Saltijeral |
| 2026-10-14 | Confirmado: la persona no captura RFC; sólo carga su constancia de situación fiscal. El personal captura RFC, razón social y folio fiscal al cargar la factura | Liber Saltijeral |
| ~~2026-10-14~~ | ~~El sistema no pide capturar RFC ni razón social~~ Sustituida | — |
| 2026-10-14 | De la factura se carga sólo el PDF, y el personal captura RFC y nombre o razón social a cuyo favor se emitió, y el folio fiscal para seguimiento. Un folio fiscal no se repite (mapa, R20) | Liber Saltijeral |
| 2026-10-14 | En el cotejo la persona presenta los mismos documentos que cargó; si no coinciden, no se da por válido y el trámite no continúa hasta que los corrija (mapa, R19) | Liber Saltijeral |
| ~~2026-10-14~~ | ~~Cada solicitud recibe un número de expediente físico al concluir el cotejo~~ Sustituida | Liber Saltijeral |
| 2026-10-14 | El expediente físico es de la persona: una CURP, un expediente, asociado a uno o más trámites. Se abre en su primer cotejo, consecutivo por año y sin huecos, y los trámites siguientes usan el mismo número. No se registra la ubicación. Formato provisional EXP-AAAA-NNNN | Liber Saltijeral |

## Cursos y grupos

| Fecha | Decisión | Quién |
|---|---|---|
| 2026-10-14 | Cuatro cursos: poda y derribo (nueva), poda y derribo (renovación), dictaminador (nueva), dictaminador (renovación). Nunca se mezclan en un grupo | Liber Saltijeral |
| ~~2026-10-14~~ | ~~Duración: poda y derribo, 3 días; dictaminador, 5 días. La misma para el curso de renovación de cada tipo~~ Sustituida | Liber Saltijeral |
| 2026-10-14 | Duración: 5 días la primera vez y 1 día la renovación, en poda y en dictaminador (mapa, R31) | Liber Saltijeral |
| ~~2026-10-14~~ | ~~Cupo mínimo 10 y máximo 25~~ Sustituida | Liber Saltijeral |
| 2026-10-14 | Cupo mínimo 5 y máximo 25, para los cuatro cursos, editables por la administración. Cada grupo copia los cupos vigentes al crearse (mapa, R23 y R24) | Liber Saltijeral |
| 2026-10-14 | **Ningún grupo abre con menos del mínimo.** Sin excepción | Liber Saltijeral |
| 2026-10-14 | Los grupos pueden ser específicos (una organización) o combinados | Liber Saltijeral |
| 2026-10-15 | Adscripción (en la cuenta y en «Mis datos», ver Cuentas) en lugar de «Organización con la que trabajas»: primero «¿Trabajas para alguna empresa, institución o dependencia?» (Sí/No); si sí, el tipo: empresa, consultoría o particular (persona moral o física); dependencia del Gobierno de la Ciudad de México; alcaldía; dependencia del Gobierno Federal. Según el tipo: nombre o razón social como en su constancia de situación fiscal; SOBSE, SEDEMA, PAOT u otra; una de las 16 alcaldías; CFE u otra. Todas obligatorias | Liber Saltijeral |
| 2026-10-15 | Si es la SEDEMA, se pregunta la Dirección General: DGEIRA, DGZCFS, DGSANPAVA, DGCPCA, DGIVA o DGCORENADR. Se agregó «Otra área de la Secretaría» con su nombre, para que nadie quede sin opción (propuesta de Claude) | Liber Saltijeral / Propuesta |
| 2026-10-15 | Pregunta en tú y sin «adscrito/adscrita», por lenguaje claro y neutro: «¿Trabajas para alguna empresa, institución o dependencia?» (propuesta de Claude) | Propuesta |
| 2026-10-14 | Los cursos se imparten en instalaciones de la Secretaría; no hay sede externa | Liber Saltijeral |
| 2026-10-14 | Alerta de prioridad a los 31 días de espera sin grupo. En los cursos de renovación, la bandeja ordena por fecha de vencimiento | Liber Saltijeral |
| ~~2026-10-14~~ | ~~Asistencia mínima: dictaminador 4 de 5; poda provisionalmente 3 de 3~~ Sustituida al cambiar la duración | Liber Saltijeral |
| 2026-10-14 | Asistencia mínima, en días: 4 de 5 en los cursos nuevos (permite una falta) y 1 de 1 en renovación (mapa, R33) | Liber Saltijeral |
| 2026-10-14 | Sin la asistencia mínima, el sistema no permite el examen (mapa, R35) | Liber Saltijeral |
| 2026-10-14 | Quien no aprueba el examen (o se queda sin derecho a él) hace un trámite nuevo y repite todo el proceso, incluido el pago de derechos | Liber Saltijeral |
| ~~—~~ | ~~Calificación mínima: 7.0 poda, 9.0 dictaminador (del borrador)~~ Sustituida | Insumo |
| ~~2026-10-14~~ | ~~Calificación mínima: 8.0 poda, 9.0 dictaminador~~ Sustituida | Liber Saltijeral |
| 2026-10-14 | Calificación mínima: 7.0 poda, 8.0 dictaminador (mapa, R34, segunda corrección) | Liber Saltijeral |
| 2026-10-14 | Habrá un examen en línea, en salones de cómputo, que registrará la calificación en esta base de forma automática. La base ya distingue el origen de cada calificación (captura o examen en línea) (mapa, R36) | Liber Saltijeral |
| 2026-10-14 | El resultado del examen es inapelable: una calificación registrada no se modifica (mapa, R37) | Liber Saltijeral |

## Vigencia y renovación

| Fecha | Decisión | Quién |
|---|---|---|
| 2026-10-14 | Vigencia de un año a partir de la emisión, sin efecto retroactivo: la acreditación renovada cuenta su año desde su propia emisión | Insumo, confirmado |
| 2026-10-14 | Ventana de renovación: desde 30 días naturales antes del vencimiento hasta un año después. Pasado el año, la persona tramita como nueva. Aplica igual a poda y a dictaminador | Liber Saltijeral |
| 2026-10-14 | En ningún momento se opera sin acreditación vigente. La verificación pública sólo dice «Vigente» o «No vigente» | Liber Saltijeral |
| 2026-10-14 | Renovación de poda vencida: mismos requisitos que la renovación por vencer | Liber Saltijeral |
| ~~2026-10-14~~ | ~~Toda renovación de dictaminador actualiza los comprobantes de estudios y de experiencia~~ Sustituida | Liber Saltijeral |
| 2026-10-14 | En una renovación los documentos se vuelven a cargar sólo si la persona los actualizó o si alguno ya no está vigente; no limitan la emisión, porque ya se revisaron la primera vez. Obligatorios en cada renovación: constancia fiscal (factura) y pago. En poda tampoco es obligatorio actualizar (mapa, R46). Confirmado el 14/10: se actualizan los documentos vencidos o no vigentes, y los de estudios o experiencia que la persona quiera | Liber Saltijeral |
| 2026-10-14 | Para tramitar dictaminador (nueva o renovación) se exige acreditación de poda vigente **al iniciar la solicitud**. No se vuelve a comprobar al enviar ni al emitir (mapa, R05 y R39) | Liber Saltijeral |
| 2026-10-14 | Si la acreditación de poda vence, la de dictaminador sigue vigente hasta su propia fecha (mapa, R43). Se retiró el parámetro `dictaminador_sigue_a_poda` | Liber Saltijeral |
| 2026-10-14 | Firma de recibido: al entregar, el sistema imprime un acuse con folio, la persona lo firma y el personal carga el PDF escaneado; sin acuse no se registra la entrega. Queda en el expediente físico y en el digital | Liber Saltijeral |
| 2026-10-14 | Al emitir una acreditación se entregan a la persona una **credencial** y un **comprobante de recepción** (el acuse firmado de la decisión anterior). En el lugar de entrega se le toma una fotografía, que es la que lleva la credencial; el personal la carga en el sistema (sólo imagen) junto con el comprobante firmado. Sin las dos no se registra la entrega. No sustituye a la fotografía de la cuenta | Liber Saltijeral |
| 2026-10-14 | Avisos: la persona ve en «Mis trámites» su resultado (aprobada o no, con asistencia y calificación) y, ya emitida, que su acreditación está lista para recoger, con lugar y horario. El aviso por correo depende del servicio del SIA. Lugar y horario de entrega: **pendientes** | Liber Saltijeral |
| 2026-10-14 | La acreditación se emite con la fecha del día de emisión, no del curso ni del examen. Liber definirá el formato del folio; el actual (PD-AAAA-NNNN, DT-AAAA-NNNN) es provisional (mapa, R38) | Liber Saltijeral |

## Lo que hay que corregir en los lineamientos

| # | En el borrador | Corrección |
|---|---|---|
| 1 | Renovación «15 días antes del término» | Desde 30 días naturales antes y hasta un año después del vencimiento |
| 2 | Pasantes: 5 años de experiencia en la tabla y 2 en las disposiciones específicas | Una sola regla. **Pendiente de la Dirección** |
| 3 | Carrera técnica: las disposiciones piden constancias de capacitación que la tabla no incluye | Agregarlas a la tabla |
| 4 | Requisito 12 de dictaminador, «Acreditación del curso, 9.0», entre los requisitos de inscripción | Quitarlo: es el resultado del examen |
| 5 | Numeración de la tabla de dictaminador salta del 2 al 4 | Renumerar |
| 6 | El cotejo compara contra lo «adjuntado por correo» | Contra lo cargado en la plataforma |
| 7 | 80 % de asistencia | Expresar la asistencia mínima en días; cursos de 5 días (nuevos) y 1 día (renovación) |
| 14 | Calificación mínima de dictaminador: 9.0 | 8.0 (poda se queda en 7.0) |
| 15 | Renovación de dictaminador pide comprobante de estudios y currículum | Sólo si se actualizaron |
| 8 | Renovación «mediante escrito libre dirigido al Titular» | Solicitud en la plataforma |
| 9 | Sin plazos para atender observaciones ni para presentarse a la cita | Fijarlos. **Pendiente de la Dirección** |
| 10 | La consecuencia de no renovar a tiempo está truncada | Pasado un año del vencimiento se tramita como nueva |
| 11 | «El resultado de la evaluación será inapelable» | Liber lo mantiene (mapa, R37). Recomendación: que la Dirección Jurídica revise la redacción antes de publicar |
| 12 | Faltan el check list (anexo), el Anexo 1 de carreras afines, el concepto y monto del derecho, y las secciones «Del pago» y «Del curso» | Pedirlos a la Dirección |
| 13 | El comprobante de domicilio no tiene uso declarado en el procedimiento | Justificar su uso o retirarlo |
| 16 | Expediente por solicitud o sin regla | Un expediente por persona (CURP) para todos sus trámites, abierto en su primer cotejo |
| 17 | Sin datos de pago antes de la cita | Al asignar la cita se dan concepto, monto y referencia; el comprobante se presenta en el cotejo |
| 18 | La entrega no deja constancia | Acuse de entrega firmado por la persona, escaneado y cargado por la Secretaría |
| 20 | No se menciona la fotografía de la persona ni la credencial | Fotografía de frente al crear la cuenta, confirmada en el cotejo; credencial con fotografía tomada al entregarla, y comprobante de recepción firmado |
| 19 | Quien no aprueba el examen: sin regla | Trámite nuevo completo, incluido el pago de derechos |

## Pendientes

Todos los pendientes, con número fijo, responsable y desde cuándo bloquean, están en `docs/PENDIENTES.md`.
