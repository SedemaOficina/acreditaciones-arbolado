# Pendientes

Generado por `herramientas/generar-pendientes.mjs` desde `docs/pendientes.json` (la fuente: se edita ahí). El
mismo contenido está en el tablero «Pendientes del sistema», donde se marca cada uno y se responde. Cada
pendiente tiene un número fijo que no se reutiliza; al resolverse pasa a «Resueltos» y la decisión se anota en
`docs/DECISIONES.md`.

Actualizado: 16/10/2026. **Bloquea** dice desde cuándo hace falta: *datos reales* = antes del
primer dato real; *SIA* = antes de pasar al SIA; *etapa N* = antes de cerrar esa etapa; *no* = se puede avanzar.

## Dirección de Infraestructura Verde (contenido del trámite)

| # | Pendiente | Recomendación | Bloquea |
|---|---|---|---|
| P02 | Plazo para atender observaciones y para presentarse a la cita | 30 días naturales para atender observaciones y una cita dentro de los 30 días siguientes a la validación, con una sola reprogramación. Al vencer, la solicitud se cierra «concluida sin atender» con su motivo; la persona puede iniciar otra. Mientras, la bandeja de revisión marca la espera en ámbar desde 3 días y en rojo desde 10 (valores de prueba). | datos reales |
| P03 | Uso del comprobante de domicilio: el procedimiento no dice para qué se pide | Retirarlo. Es un dato personal sin uso declarado y nada del trámite depende del domicilio. Si la Dirección lo quiere para notificar, que lo declare así en los lineamientos y en el aviso de privacidad. | datos reales |
| P04 | Check list del cotejo y secciones «Del pago» y «Del curso» del borrador | Pedirlos en una sola solicitud. El check list del cotejo puede salir del propio sistema a partir de la tabla de requisitos de cada curso, así no hay dos listas que mantener. (El Anexo 1 de carreras afines ya no se necesita: la carrera la valida el personal.) | etapa 2 |
| P06 | No admitir una solicitud nueva si la persona ya tiene una del mismo tipo vigente o renovable (R07) | Mantener la regla: con una acreditación vigente o todavía renovable corresponde renovar. Evita dos acreditaciones del mismo tipo para la misma persona. | no |
| P07 | Cómo corregir una calificación mal capturada (hoy el resultado es inapelable y no se modifica) | Distinguir el examen de la captura. El resultado del examen es inapelable; un error de captura se corrige sólo antes de emitir, con el perfil de administración, con motivo y en la bitácora. | etapa 2 |
| P08 | Revisión jurídica de la redacción «el resultado de la evaluación será inapelable» | Enviarla a la Dirección Jurídica junto con la regla de P07, para que la redacción deje claro que lo inapelable es la evaluación y no un error de captura. | datos reales |
| P09 | Lugar de la cita de cotejo y sede del curso: cómo se informa a la persona | Un catálogo de sedes de la Secretaría en la base (nombre, dirección y referencias). Se elige la sede al asignar la cita y al confirmar el grupo, y la persona la ve en «Mis trámites». Mientras, la revisión documental ofrece una sede de prueba; al definir el catálogo se agrega a la base la sede de la cita (hoy sólo guarda la fecha y hora). | etapa 2 |
| P10 | Lugar, días y horario de entrega de acreditaciones | Usar el mismo catálogo de sedes de P09, con días y horario de entrega. Mientras se define, el parámetro de la base lo muestra como pendiente. | datos reales |
| P48 | ¿La credencial se imprime en el lugar de entrega? | Si se imprime ahí (impresora de credenciales), la foto se toma al entregar, como está. Si se imprime antes, la foto debe tomarse en una visita anterior (cotejo o examen) y el requisito cambia de momento. | etapa 2 |
| P49 | Especificación de la foto de la credencial y diseño de la credencial | Definir fondo, encuadre y tamaño de la foto, y los datos impresos: nombre, número, tipo, emisión y vencimiento, más un código QR que abra la verificación pública. Sin CURP ni contacto. | datos reales |
| P57 | Hora de entrada al curso | Confirmar la hora de entrada (hoy se muestra «por confirmar»). Los días del curso son consecutivos (confirmado por Liber, 2026-10-15), como ya los cuenta la base. | datos reales |
| P64 | Motivos frecuentes de observación y quién fija la fecha de la cita | Confirmar los cinco motivos que ofrece la revisión (no se lee completo, está vencido, no corresponde al requisito, falta una página, no coincide con el nombre de la cuenta) y si la fecha de la cita la elige quien revisa (como está) o se toma de un calendario de citas disponibles por sede. | datos reales |

## Liber (formatos y definiciones del sistema)

| # | Pendiente | Recomendación | Bloquea |
|---|---|---|---|
| P11 | Formato del folio de la acreditación (hoy provisional PD-AAAA-NNNN y DT-AAAA-NNNN) | Conservarlo: distingue tipo y año a simple vista, es consecutivo sin huecos y cabe en una credencial. Las migradas de Kobo conservan su número. | datos reales |
| P12 | Formato del número de expediente (hoy provisional EXP-AAAA-NNNN) | Conservarlo, con el año en que se abrió el expediente. Como es uno por persona, el número no cambia aunque haga trámites en otros años. | datos reales |
| P13 | Quién restablece las contraseñas de solicitantes y por qué medio, si el SIA no da correo | El personal de revisión genera una contraseña temporal de un solo uso después de verificar la identidad (CURP e identificación), y la persona la cambia al entrar. La base ya tiene la marca para obligar el cambio. | etapa 3 |
| P14 | Titularidad al activar una cuenta del registro de Kobo: ¿basta CURP coherente con nombre y fecha, más el nombre del registro? | Sí basta para abrir la cuenta, porque nadie llega a un curso sin presentar su identificación oficial en el cotejo. | etapa 3 |
| P15 | Contrastar la CURP con el servicio de consulta de RENAPO | Hacerlo sólo si el SIA ya tiene acceso al servicio. No bloquea: el cotejo presencial ya confirma la identidad. | no |
| P51 | ¿La verificación pública muestra la foto de la credencial? | No por omisión: la verificación pública sólo dice número, nombre, tipo, fechas y vigencia. Si se quiere comprobar el rostro, mejor que el QR de la credencial lleve a la verificación y que quien verifica compare con la credencial física. | no |
| P63 | Verificar los requisitos que aparecen en la página de inicio | Revisar contra los lineamientos la lista de requisitos por acreditación y modalidad que muestra index.html (sale del catálogo apd.requisito y apd.requisito_curso); lo que se corrija se cambia en el catálogo y se refleja en inicio, solicitud y documentos. | datos reales |

## Finanzas y Gaceta Oficial (pago de derechos)

| # | Pendiente | Recomendación | Bloquea |
|---|---|---|---|
| P16 | Monto vigente de cada curso y la publicación de la Gaceta que lo fija (hoy hay montos ficticios) | Pedir a la Dirección o a Finanzas el artículo y los montos vigentes de los cuatro conceptos. El personal los captura en la base con la publicación y la fecha desde la que aplican. | datos reales |
| P17 | Referencia bancaria o línea de captura definitiva (hoy: el folio sin guiones) | Preferir la línea de captura de la Tesorería, que identifica el pago sola. Si no hay forma de generarla desde el sistema, conservar el folio como referencia. | datos reales |
| P18 | Banco, cuenta o CLABE y forma de pago | Que Finanzas lo defina por escrito; el personal lo captura en el parámetro de instrucciones de pago y se muestra con la cita. | datos reales |
| P19 | Concepto exacto de cada derecho (hoy provisional por curso) | Tomarlo textual de la misma publicación que fija el monto (P16), para que el concepto de la persona y el de la factura coincidan. | datos reales |

## Registro de Kobo (migración)

| # | Pendiente | Recomendación | Bloquea |
|---|---|---|---|
| P20 | Formato del registro histórico de Kobo para la migración | Una exportación en CSV o Excel con CURP, nombre, apellidos, tipo, número, fecha de emisión y de vencimiento. Con un archivo de muestra armo la carga y sus validaciones. | etapa 2 |
| P21 | Qué documentos carga en su primera renovación quien viene de Kobo sin archivos | Los de una solicitud nueva sin la parte técnica: identificación, CURP, comprobante de domicilio (si se mantiene, P03) y constancia fiscal. En dictaminador, también estudios y currículum, porque el sistema no tiene nada de esa persona. | etapa 2 |
| P22 | Si Kobo tenía números de expediente físico que deban conservarse | Si existen, se migran a la persona con su número original y no se abre otro. Si no, se abre en su primer cotejo, como a todos. | etapa 2 |

## SIA (preguntas abiertas)

| # | Pendiente | Recomendación | Bloquea |
|---|---|---|---|
| P23 | Servicio de correo institucional para cuentas, contraseñas y avisos | Es la pregunta de más peso para el SIA. Sin correo, el sistema funciona con «Mis trámites» y la recuperación de contraseña por el personal (P13), pero los avisos dependen de que la persona entre. | etapa 3 |
| P24 | Siglas apd libres para esquema, cuenta y ruta | Confirmarlo en la misma reunión con el SIA que P23 a P30; las preguntas ya están redactadas en DECISIONES-SIA. | SIA |
| P25 | Dónde se publica la aplicación y la ruta de su API | Misma reunión con el SIA. | SIA |
| P26 | Límite de subida de la API (se necesitan al menos 5 MB por archivo) | Misma reunión con el SIA. Si el límite es menor, bajar el tamaño máximo es un parámetro de la base. | etapa 3 |
| P27 | Cuentas del personal en acceso, recurso apd, con cinco perfiles | Misma reunión con el SIA. Los perfiles: revisión, cotejo, instructor, emisión y consulta. Mientras, las pantallas del personal entran con un perfil ficticio de revisión documental. | etapa 2 |
| P28 | Espacio para archivos (de 10 a 20 GB al año) y dónde | Misma reunión con el SIA. | etapa 3 |
| P29 | Conexión del examen en línea: cuenta propia o API del módulo | Por la API del módulo, para que la calificación pase por las mismas reglas y la misma bitácora que la captura del instructor. | no |
| P30 | Formato exacto de la contraseña derivada que usa el esquema acceso | Pedirlo al SIA para usar el mismo; hoy los ficticios usan scrypt con los parámetros documentados. | etapa 3 |
| P55 | Cambio de correo en «Mis datos» sin comprobar que el correo nuevo es de la persona | Con servicio de correo (P23), enviar un enlace de confirmación al correo nuevo y avisar al anterior. Sin él, pedir la contraseña actual para guardar el cambio. | etapa 3 |

## Unidad de Transparencia (datos personales)

| # | Pendiente | Recomendación | Bloquea |
|---|---|---|---|
| P31 | Aviso de privacidad de cuenta, solicitud y verificación pública, con sus fundamentos | Enviar a la Unidad de Transparencia los tres textos simplificados que ya están en las pantallas, con la lista de datos y su finalidad (P32). | datos reales |
| P32 | Revisión del inventario de datos personales de los formularios | Te preparo la tabla de datos personales (campo, uso, finalidad, sensible) que sale de los propios formularios, para enviarla con el aviso. | datos reales |
| P50 | Tratamiento de las fotografías en el aviso de privacidad | Declarar las dos fotografías (cuenta y credencial), su finalidad y su conservación. Se usan para que una persona reconozca a otra; no se aplica reconocimiento facial automático. Fundamento: [Art. __, fracc. __]. | datos reales |

## Verificación (lista de cierre del estándar)

| # | Pendiente | Recomendación | Bloquea |
|---|---|---|---|
| P33 | Probar en iPhone y Android reales, con red limitada, y la cámara al cargar documentos | Una sesión de una hora con un iPhone y un Android recorriendo el menú de pruebas. Te preparo la lista de pasos. | etapa 1 |
| P34 | Recorrido sólo con teclado y con lector de pantalla real | En la misma sesión: VoiceOver en el iPhone y TalkBack en el Android; teclado en una computadora. | etapa 1 |
| P35 | Probar en Firefox y Safari, alto contraste e impresión del acuse | En la misma sesión, con una computadora. | etapa 1 |
| P36 | Casilla «Verificado en móvil y en escritorio» con nombre y fecha | La firma quien haga la sesión de P33 a P35; con eso se cierra la etapa 1. | etapa 1 |

## Estándar de formularios (hallazgos para su repositorio)

| # | Pendiente | Recomendación | Bloquea |
|---|---|---|---|
| P37 | combo no acepta el catálogo como {filas, fuente, corte} aunque su documentación lo dice | Reportarlo al repositorio del estándar. Te preparo el texto de los nueve reportes (P37 a P45) en un solo documento. | no |
| P38 | esquema-desde-html.mjs sólo toma el data-si más cercano con condiciones anidadas | Reportarlo; afecta a cualquier formulario con condiciones anidadas. | no |
| P39 | archivos dice «Hasta 1 archivos» | Reportarlo; es un ajuste de texto. | no |
| P40 | numero no valida un step menor que 1 | Reportarlo. | no |
| P41 | No hay forma de marcar en un campo un error que devuelve el servidor | Reportarlo; todos los formularios con servidor lo necesitan (por ejemplo, «esta CURP ya tiene cuenta»). | no |
| P42 | No hay «mostrar contraseña» | Proponerlo como mejora del estándar. | no |
| P43 | No hay validación cruzada de CURP contra nombre y apellidos | Proponer que el estándar adopte las tres cruzadas de este proyecto. | no |
| P44 | Una cruzada no se vuelve a comprobar si cambia el otro dato | Reportarlo; el proyecto lo resolvió por su cuenta y el estándar debería hacerlo en el núcleo. | no |
| P45 | La plantilla de versión del SIA usa valores literales y no pasa el auditor de CSS | Reportarlo y proponer la hoja con tokens que hizo este proyecto. | no |
| P46 | validar.mjs exige en «datos» los campos de archivos que el navegador no manda ahí | Reportarlo al estándar. Mientras, la API pone en «datos» el número de archivos recibidos de cada campo antes de validar (así lo prueba probar-esquemas.mjs). | etapa 3 |
| P47 | El núcleo pone aria-required en el botón de la zona de carga, que no lo admite | Reportarlo al estándar; el proyecto lo quita sólo de ese botón (app/apd.js). | no |
| P52 | Las condiciones no se encadenan entre campos hermanos en el navegador (el servidor sí) | Reportarlo: al evaluar data-si, tratar como no cumplida la condición sobre un campo inactivo. Mientras, envolturas data-si anidadas. | no |
| P56 | Las tarjetas de opción en rejilla confunden en preguntas de una sola respuesta, y la lista no tiene estado deshabilitado | Hacer de opciones-lista la forma por omisión de las preguntas de una sola respuesta, dejar la rejilla para casos con pocas opciones muy visuales y agregar a opciones-lista su estado deshabilitado. | no |
| P61 | El mínimo de un número no puede depender de otra respuesta | Reportarlo y proponer un mínimo declarativo según otra respuesta, que lea también validar.mjs. Mientras, app/solicitud.js cambia el atributo min y la base rechaza con experiencia_insuficiente. | no |
| P65 | El módulo chips sólo sugiere del historial; no admite una lista fija de sugerencias | Proponer en chips una lista fija declarada en el HTML (data-chips-fijos) para respuestas frecuentes conocidas, como los motivos de observación. Mientras, la revisión usa botones propios (.sugerencia) con los tokens del estándar. | no |
| P66 | Tabla: al filtrar se pierde el ritmo de las filas alternadas, y en teléfono la columna de acción muestra su rótulo oculto | Reportarlo: alternar con :nth-child no cuenta las filas ocultas; y una columna cuyo encabezado es sólo para lector de pantalla no debería mostrar su rótulo en la vista de fichas. | no |

## Resueltos

| Tema | Cómo quedó | Fecha |
|---|---|---|
| Factura y RFC | La persona sólo carga su constancia fiscal; el personal captura RFC, razón social y folio fiscal al cargar la factura | 14/10/2026 |
| Expediente físico | Uno por CURP, abierto en el primer cotejo y compartido por todos sus trámites | 14/10/2026 |
| Firma de recibido | Acuse impreso, firmado y escaneado; sin él no se registra la entrega | 14/10/2026 |
| Monto del pago | Configurable por el personal, distinto por curso, con la publicación de la Gaceta y su fecha; quien ya tiene cita conserva el monto que se le indicó. Falta el monto real (P16) | 14/10/2026 |
| Persona sin segundo apellido | Sin pregunta extra: si el segundo apellido se deja vacío, la CURP debe llevar X en su lugar; si la CURP indica que sí hay, se le pide escribirlo | 14/10/2026 |
| CURP que no marcaba error | Al cambiar nombre, apellidos o fecha con la CURP ya escrita, la CURP se vuelve a comprobar al momento | 14/10/2026 |
| Documentos de renovación | Se actualizan los vencidos o no vigentes y los de estudios o experiencia que la persona quiera; constancia fiscal y factura obligatorias | 14/10/2026 |
| Primera pregunta de la solicitud | Sólo se pregunta la acreditación (poda y derribo o dictaminador técnico); si es nueva o renovación lo decide el historial y se informa, no se pregunta | 14/10/2026 |
| Fotografía de la persona | Obligatoria al crear la cuenta; el personal la confirma en el cotejo o toma una nueva ahí; sin ella no se envía la solicitud ni se concluye el cotejo | 14/10/2026 |
| Credencial y comprobante de recepción | Al entregar se toma en el lugar la foto que lleva la credencial y la persona firma el comprobante de recepción; el personal carga los dos antes de registrar la entrega | 14/10/2026 |
| Adscripción | Sí/No, tipo y la pregunta de cada tipo (empresa, dependencia de la Ciudad con Dirección General en la SEDEMA, alcaldía, dependencia federal) | 15/10/2026 |
| Nombre de los archivos | Cada archivo se guarda como TIPO DE DOCUMENTO_NOMBRE COMPLETO; el original se conserva aparte | 15/10/2026 |
| Mayúsculas en la cuenta | Nombre, apellidos y CURP se escriben y guardan en mayúsculas; correo y contraseña no cambian | 15/10/2026 |
| Mis datos | Pantalla para consultar los datos ligados a la CURP y cambiar contacto, adscripción y, mientras no esté confirmada, la fotografía | 15/10/2026 |
| Sexo en datos generales | Se toma de la CURP y se muestra de sólo lectura; no se pregunta aparte | 15/10/2026 |
| Personas independientes | «No, soy independiente» es una respuesta explícita de la adscripción | 15/10/2026 |
| Formato de los documentos | Sólo PDF en lo que carga la persona; las fotografías siguen siendo imagen | 15/10/2026 |
| Enlace para obtener la CURP | gob.mx/curp en el requisito, en la lista de requisitos y en el campo CURP de la cuenta | 15/10/2026 |
| Estilo de las preguntas de opción | Lista con el botón de opción visible, una por renglón (opciones-lista), en todo el sistema | 15/10/2026 |
| Lista de Direcciones Generales de la SEDEMA (P53) | Lista cerrada de seis Direcciones Generales; se quitó «Otra área de la Secretaría» por indicación de Liber | 15/10/2026 |
| Universidades e instituciones educativas en la adscripción (P54) | Tipo «Institución educativa» con la UNAM en la lista y «otra» con su nombre | 15/10/2026 |
| Nombres de los identificadores (P58) | «Folio de la solicitud», «Número de expediente» y «Número de acreditación» en todo el sistema | 15/10/2026 |
| Catálogo de carreras afines (P59) | No habrá catálogo de afines: campo abierto que valida el personal en la revisión documental; el catálogo crece con las carreras aceptadas de manera explícita | 15/10/2026 |
| Reglas del perfil de dictaminador (P60) | Confirmadas por Liber: licenciatura titulada; posgrado cuenta en su área; lo que no cumple se envía y lo decide el personal | 15/10/2026 |
| Experiencia mínima de pasantes (P01) | 5 años, según el apartado académico que dio Liber | 16/10/2026 |
| Constancias de capacitación (P05) | ya no se piden por separado; van entre los comprobantes de experiencia | 16/10/2026 |
| Clasificar carreras en la revisión documental (P62) | en la revisión del dictaminador se clasifica la carrera (afín, disciplina afín o no afín); la base lo registra en la bitácora y recalcula las solicitudes abiertas | 16/10/2026 |
