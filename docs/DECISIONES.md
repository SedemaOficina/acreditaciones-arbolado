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
| 2026-10-15 | Datos internos: lo que calcula el sistema y se guarda en la base (~~el sexo tomado de la CURP,~~ el curso que corresponde; el sexo sí lo ve la persona, de sólo lectura, desde el 2026-10-18) no lo ve la persona. Lo que no se guarda (p. ej. «sin segundo apellido») no se muestra ni en prueba. En la versión de prueba se muestra en amarillo, con una nota de que en producción no se ve; al pasar al SIA queda oculto | Liber Saltijeral |
| 2026-10-15 | Cada publicación de la versión de prueba sube su número (0.2, 0.3…), visible abajo de cada pantalla, para saber si se ve la última. El historial con fecha y cambio está en docs/VERSIONES.md | Liber Saltijeral |
| 2026-10-15 | Las preguntas de opción se muestran como lista, una opción por renglón y con el botón de opción visible (variante `opciones-lista` del estándar), en lugar de tarjetas en rejilla, que confundían. Aplica a todo el sistema, también al Sí/No. Se eligió entre cuatro estilos | Liber Saltijeral |
| 2026-10-15 | Los documentos que carga la persona se aceptan sólo en PDF (antes también JPG y PNG). Las fotografías siguen siendo imagen. A quien tenga una foto del documento se le sugiere convertirla con el escáner de su teléfono | Liber Saltijeral |
| 2026-10-15 | El requisito de la CURP y el campo de CURP de la cuenta llevan el enlace oficial para obtenerla: https://www.gob.mx/curp/ | Liber Saltijeral |
| 2026-10-17 | **Pantallas del personal «para computadora»**: revisión documental, citas, cotejo, grupos, espera, grupo y aplicar el examen se diseñan y se revisan primero en escritorio; en teléfono sólo se cuida que funcionen (sin desborde, todo alcanzable), sin pulir su apariencia. No se bloquea el teléfono: una computadora con la pantalla ampliada se ve igual de angosta y el estándar pide que todo funcione en ambos. Siguen cuidadas en los dos tamaños: todas las pantallas de la persona solicitante, el examen y la asistencia (el instructor la captura en el aula) | Liber Saltijeral |

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
| ~~2026-10-14~~ | ~~En la cita de cotejo el personal confirma, contra la identificación oficial, que la fotografía es de quien se presentó; si no se parece o no sirve, le toma una nueva ahí, que queda confirmada. Sin fotografía confirmada no se concluye el cotejo. Ya confirmada, la persona no la cambia: se toma otra en su próxima cita. La solicitud no se regresa con observaciones por la fotografía (propuesta de Claude)~~ Sustituida | Propuesta |
| 2026-10-17 | En la cita de cotejo el personal confirma, contra la identificación oficial, que la fotografía de la cuenta es de quien se presentó, o detiene la cita si no es la persona. **En la cita no se toma otra fotografía**: la que confirma es la de la cuenta; la de la credencial se toma al entregarla | Liber Saltijeral |
| 2026-10-17 | El sistema no se lanza hasta que el SIA tenga servicio de correo transaccional: los avisos a la persona (cita, resultado de la cita, observaciones, grupo, renovación) van por correo (docs/AVISOS-POR-CORREO.md, P23). No se construyen sustitutos como un comprobante imprimible de la cita | Liber Saltijeral |
| 2026-10-17 | **Un correo, una cuenta**: además de la CURP, el correo no se repite entre cuentas activas, al crearla y al cambiarlo en «Mi perfil». Las personas del registro anterior que aún no crean su cuenta no cuentan: su correo del padrón puede ser viejo o compartido | Liber Saltijeral |
| 2026-10-15 | En «Crea tu cuenta», nombre, apellidos y CURP se escriben en mayúsculas al momento, aunque la persona los teclee en minúsculas, y así se guardan (con acentos, diéresis y Ñ). El correo se guarda en minúsculas y la contraseña tal como se escribe, porque distingue mayúsculas | Liber Saltijeral |
| 2026-10-15 | «Mis datos» (hoy «Mi perfil», 2026-10-17): la persona consulta sus datos ligados a la CURP (nombre, CURP, fecha de nacimiento —el expediente ya no, 2026-10-18—; sólo los corrige la Secretaría; el sexo se ve como dato de sólo lectura, 2026-10-18) y cambia correo, teléfono, adscripción y, mientras no esté confirmada, su fotografía | Liber Saltijeral |
| 2026-10-15 | El sexo forma parte de los datos generales. Se toma de la CURP (posición 11) y se muestra de sólo lectura, como pide el Estándar de formularios; no se pregunta aparte. Se sustituyó el 2026-10-18 («el sexo es dato interno») y esa sustitución se rectificó el mismo día: vigente otra vez (ver «Decisiones del 2026-10-18») | Liber Saltijeral / estándar |
| 2026-10-15 | La adscripción es de la persona, no de la solicitud: se pide al crear la cuenta y se cambia en «Mis datos». Cada solicitud guarda la que la persona tenía al enviarla (y al reenviarla con correcciones). «No, soy independiente» es una respuesta explícita | Liber Saltijeral |
| 2026-10-15 | Adscripción: sexto tipo «Institución educativa», con la UNAM en la lista y «otra» con su nombre. El nombre de la empresa se elige de las ya registradas (autocompletado) o se escribe uno nuevo. La Dirección General de la SEDEMA es una lista cerrada (sin «otra área»). La alcaldía se elige de una lista con las 16, en orden alfabético. La segunda contraseña dice «Confirma tu contraseña» | Liber Saltijeral |
| 2026-10-15 | «Mis solicitudes» muestra en cada estado sólo lo que le sirve a la persona: «En revisión documental» mientras se revisan sus documentos; con grupo, cuándo presentarse, cuándo termina el curso (días consecutivos, como los cuenta la base) y dónde; con la acreditación emitida, su folio e inicio y fin de vigencia, sin sede, duración, asistencia ni calificación. Concepto, monto, referencia de pago y hora de entrada se marcan en amarillo «por confirmar» hasta tenerlos | Liber Saltijeral |
| ~~2026-10-15~~ | ~~El nombre con que se guarda cada archivo se ve sólo en la versión de prueba~~ Sustituida | Liber Saltijeral |
| ~~2026-10-15~~ | ~~El nombre con que se guarda cada documento se ve bajo cada archivo cargado~~ Sustituida: sólo en la revisión. El renombrado lo hace la base al registrar el documento; la persona no renombra nada | Liber Saltijeral |
| 2026-10-15 | Identificadores: «Folio de la solicitud» (cada trámite), «Número de expediente» (la persona) y «Número de acreditación» (la credencial). «Fecha en que enviaste la solicitud» en lugar de «Enviada el» | Liber Saltijeral |
| 2026-10-15 | El curso es siempre en días consecutivos | Liber Saltijeral |
| 2026-10-15 | Perfil del dictaminador en tres preguntas, como el formulario de Kobo: último nivel de estudios; desde licenciatura, qué carrera (catálogo cgo_carreras con autocompletado, admite carreras nuevas) y su situación (en curso, trunco, concluido, titulado). Según los lineamientos, licenciatura titulada en Biología, Ingeniería Forestal, Ingeniería Agrónoma o carrera afín pide 2 años de experiencia; carta de pasante, carrera técnica o disciplina afín, 5. La base calcula el perfil y el mínimo; la carrera que no está clasificada la clasifica la Secretaría en la revisión documental | Liber Saltijeral |
| ~~2026-10-15~~ | ~~Los estudios se preguntan en las dos acreditaciones: último nivel y, desde licenciatura, la carrera. En poda son dato del padrón; en dictaminador, requisito, y además se pide la situación del último grado indicado (en curso, trunco, concluido, titulado), también en carrera técnica~~ Sustituida (2026-10-18): la situación se pide sólo con licenciatura | Liber Saltijeral |
| 2026-10-15 | Estudios (ajuste de Liber): el nivel se elige de una lista desplegable; carrera y situación del grado se preguntan sólo con licenciatura, maestría o doctorado, y son obligatorias en poda y en dictaminador. En poda no hay estudios mínimos: es dato estadístico. En dictaminador rige el apartado académico de los lineamientos: licenciatura en Biología, Ing. Forestal, Ing. Agrónomo o carrera afín con 2 años de experiencia laboral comprobable; carta de pasante, carrera técnica o disciplina afín con 5; en ambos casos, acreditación de poda vigente | Liber Saltijeral |
| 2026-10-15 | No habrá catálogo de carreras afines: la carrera es un campo abierto que el personal valida en la revisión documental. El catálogo de carreras crece con las que la Secretaría acepta de manera explícita, y sólo esas se sugieren al escribir | Liber Saltijeral |
| 2026-10-15 | La solicitud lleva una casilla obligatoria de declaración bajo protesta de decir verdad: la información es auténtica, completa y corresponde a la situación real; la información falsa puede ocasionar la cancelación del trámite. Va antes del aviso de privacidad, en mayúsculas y minúsculas | Liber Saltijeral |
| 2026-10-15 | En los documentos no se avisa del renombrado: lo hace el sistema. El nombre nuevo se muestra sólo en la revisión, con el archivo que subió la persona debajo | Liber Saltijeral |
| 2026-10-17 | En la revisión del personal cada documento muestra sólo el nombre con que se guarda y su tamaño, sin el nombre del archivo original: no le sirve a quien revisa y puede traer datos ajenos al trámite. El original queda en la base (`apd.documento.nombre_original`) para aclaraciones; la persona lo sigue viendo en la revisión de su solicitud | Liber Saltijeral |
| 2026-10-15 | En poda no se piden años de experiencia ni estudios mínimos | Liber Saltijeral |
| 2026-10-15 | Se quita el requisito «Constancias de capacitación especializada» del dictaminador: basta con los comprobantes de experiencia (las constancias de capacitación pueden ir entre ellos). En comprobante de estudios y comprobantes de experiencia se indica escanear todos los documentos en un solo PDF | Liber Saltijeral |
| ~~2026-10-15~~ | ~~Supuestos del perfil por confirmar (P60)~~ Confirmados y ajustados abajo | Propuesta |
| 2026-10-15 | Cuando el perfil lo decide el personal (carrera por clasificar o perfil que no cumple), la experiencia mínima es de 5 años: sólo la licenciatura o el posgrado en carrera principal o afín baja a 2 | Liber Saltijeral |
| 2026-10-15 | Perfil del dictaminador, confirmado: «con licenciatura» es titulada, y concluida sin título equivale a carta de pasante (5 años). Un posgrado cuenta como licenciatura titulada, aunque esté en curso, y vale el área del posgrado aunque la licenciatura sea de otra (p. ej. Química con maestría o doctorado en Ciencias Forestales: 2 años). Con preparatoria o menos, o licenciatura en curso o trunca, la solicitud sí se envía: la revisa y decide el personal | Liber Saltijeral |
| 2026-10-16 | Estilo de los formularios: secciones con título; datos hermanos en una fila en escritorio (nombre y apellidos en tres columnas; fecha de nacimiento y CURP, correo y confirmación, contraseña y confirmación en dos); una ayuda por bloque cuando aplica a todos sus campos; respuestas cortas en línea (Sí/No, acreditación, situación de los estudios); anchos según el dato; «Entrar» en una tarjeta angosta. En teléfono, una columna. Las diferencias con el estándar quedan como segunda tanda de hallazgos (S2-1 a S2-4) | Liber Saltijeral |
| 2026-10-16 | Pantallas del personal: se les habla de usted; se construyen primero como maqueta y, aprobada, en el sitio. La primera es la revisión documental (bandeja y revisión de una solicitud) | Liber Saltijeral |
| 2026-10-16 | Bandeja de revisión: de la que más espera a la más reciente; búsqueda por nombre, CURP, folio de la solicitud o número de expediente; filtros por acreditación, nueva o renovación y vuelta de revisión; en teléfono, los filtros plegados bajo «Filtrar». La columna se llama «Folio de la solicitud» | Liber Saltijeral |
| 2026-10-16 | Carrera clasificada como «no afín» en la revisión: la solicitud **se rechaza** (no regresa con observaciones), con motivo obligatorio que la persona lee tal cual; puede iniciar una solicitud nueva | Liber Saltijeral |
| 2026-10-16 | Perfil declarado que no cumple (hasta preparatoria, licenciatura en curso o trunca) — opción C: quien revisa lo decide con el comprobante de estudios; si lo confirma, se rechaza; si muestra otro grado, se observa el comprobante para que la persona corrija su grado y se recalcula la experiencia mínima | Liber Saltijeral |
| 2026-10-16 | Sólo se rechaza por perfil de dictaminador que no cumple; cualquier otro problema se observa. El rechazo se confirma antes de registrarse | Propuesta de Claude, en la maqueta aprobada |
| 2026-10-16 | Por omisión hasta que la Dirección diga otra cosa: motivos frecuentes de observación (no se lee completo, está vencido, no corresponde al requisito, falta una página, no coincide con el nombre de la cuenta); la fecha de la cita la elige quien revisa, desde el día siguiente; la espera se marca en ámbar desde 3 días y en rojo desde 10 (P02); ~~una sede de prueba (P09)~~ Sustituida por la sede única (2026-10-16) | Propuesta de Claude |
| 2026-10-16 | Visor de documentos en la revisión: muestra todas las hojas del PDF, con contador de hoja, acercar, ajustar al ancho, girar y abrir en otra pestaña. El módulo del personal se usará casi siempre en computadora: ahí el visor queda fijo a la derecha, junto a las decisiones, y abre de entrada el primer documento (el comprobante de estudios si hay que decidir el perfil); en pantalla chica se abre a pantalla completa. pdf.js va copiado en el sitio (sin CDN) | Liber Saltijeral |
| 2026-10-16 | Sede única: la cita de cotejo, el curso y la entrega de acreditaciones son siempre en el Vivero Nezahualcóyotl. No se elige lugar al asignar la cita; el grupo toma la sede solo (parámetros `sede` y `sede_direccion`). Falta la dirección con referencias para llegar | Liber Saltijeral |
| 2026-10-16 | En la revisión, al aceptar un documento se pasa al siguiente sin decidir: en computadora el visor lo muestra y la lista lo trae a la vista; con todo decidido, la página baja al resultado. Al observar no avanza, porque hay que escribir qué corregir | Liber Saltijeral |
| 2026-10-16 | Versión de prueba sin servidor: los archivos que se cargan al enviar o reenviar una solicitud se guardan sólo en ese navegador (IndexedDB) y la revisión del personal los muestra en el visor; la solicitud llega a la bandeja señalada «Archivos cargados en este navegador». El menú de pruebas los borra. Se quita al pasar al SIA | Liber Saltijeral |
| 2026-10-16 | Fecha de nacimiento: se escribe como día/mes/año (23/07/1985), sin calendario. Acepta también guiones, puntos o los ocho dígitos juntos y la deja como 23/07/1985; debe ser una fecha real, no posterior a hoy, y coincidir con la CURP | Liber Saltijeral |
| 2026-10-16 | Comprobante de domicilio: al emitir los lineamientos no se pide, porque no se utiliza. Mientras la norma vigente lo exija, el sistema lo sigue pidiendo (P03) | Liber Saltijeral |
| 2026-10-16 | Fecha de nacimiento: escritura guiada como la del campo de fecha del navegador, pero sin calendario: al completar el día pasa al mes y al completar el mes pasa al año, con las diagonales solas; muestra «dd/mm/aaaa» en el campo | Liber Saltijeral |
| 2026-10-16 | Menú de pruebas en cinco bloques, siempre en el mismo orden: estás como, en esta pantalla (sólo lo que aplica), ~~entrar como (casos de prueba con nombre, agrupados por etapa, con el personal incluido)~~, ir a otra pantalla (agrupadas por quién la usa) y ajustes de la prueba (obligatorias, lo guardado, empezar de cero). La caja de personas de ejemplo de «Entrar» se quita: todo lo de prueba queda en el menú. Bloque «Entrar como» sustituido (2026-10-18) por los dos pasos «¿Quién?» / «¿En qué momento?» (ver «Decisiones del 2026-10-18») | Liber Saltijeral, en la maqueta aprobada |
| 2026-10-17 | Direcciones Generales de la SEDEMA, en este orden: DGSANPAVA, DGCORENADR, DGEIRA, DGIVA, DGCPCA, DGZCFS | Liber Saltijeral |
| 2026-10-17 | Carrera técnica: sin catálogo, pero se pide cuál (texto libre, obligatorio) en poda y en dictaminador; se guarda en apd.solicitud.carrera_tecnica y no entra al catálogo de carreras | Liber Saltijeral |
| 2026-10-17 | «¿Qué carrera estudiaste?»: la ayuda sólo dice «Al escribir te sugerimos las ya registradas» | Liber Saltijeral |
| 2026-10-17 | «Mis datos» se llama «Mi perfil»: primero se ve lo registrado, escrito (fotografía, nombre, identidad, contacto, adscripción); cada parte que la persona mantiene tiene «Editar», que abre sus preguntas; una parte a la vez. La fotografía se ve en el perfil con «Cambiar fotografía» mientras no esté confirmada | Liber Saltijeral |
| 2026-10-17 | Versión de prueba: la fotografía que se carga al crear la cuenta o al cambiarla se guarda sólo en ese navegador y se ve en «Mi perfil»; las personas ficticias se ven con sus iniciales | Liber Saltijeral |
| 2026-10-17 | Carga de archivos: con el archivo ya cargado se oculta «Elegir archivo» (vuelve al quitarlo) y el archivo se ve en verde; con un solo archivo el límite dice «Un archivo de hasta 5 MB» | Liber Saltijeral |
| 2026-10-17 | Botones: ninguno pegado a la orilla de su caja (comprobación automática en todas las capturas); en la revisión antes de enviar, «Editar» siempre arriba a la derecha del dato | Liber Saltijeral |
| 2026-10-17 | Bandeja del personal en la prueba: lo enviado en ese navegador va primero y cuenta como enviado en la fecha simulada (sin espera negativa). Sigue siendo sólo de ese navegador: lo enviado en otro equipo o navegador no aparece | Liber Saltijeral |
| 2026-10-17 | Contraseña: botón «Mostrar» / «Ocultar» dentro del campo, en «Crear cuenta» (contraseña y confirmación) y en «Entrar»; al enviar se vuelve a ocultar | Liber Saltijeral |
| 2026-10-17 | «Mi perfil», adscripción: un renglón directo, «Eres independiente.» o «Alcaldía: Tlalpan.», a todo lo ancho | Liber Saltijeral |
| 2026-10-17 | «Confirma tu correo» se queda como en el estándar: sin sugerencia del navegador (autocomplete="off"), para que el correo se vuelva a escribir y se detecte un error de dedo | Liber Saltijeral |
| 2026-10-17 | Cada acreditación dice siempre cuántos días faltan para vencer («Faltan 145 días», «Vence hoy», «Venció hace 12 días»), calculado con el día de hoy: en «Mis trámites» y en la verificación pública. En la versión de prueba, «hoy» es la fecha simulada de la franja amarilla | Liber Saltijeral |
| 2026-10-17 | Versión de prueba: todo el recorrido se guarda en el navegador y sobrevive a recargar, otra pestaña o cerrarlo: la sesión, las cuentas creadas (se entra con su propia contraseña; sólo se guarda su resumen), la fotografía, las solicitudes con sus documentos, los cambios de «Mi perfil» y las revisiones del personal. Todas las pantallas lo ven, también la bandeja y la revisión del personal, que muestra la fotografía de la persona. Otro navegador u otro equipo no lo ven | Liber Saltijeral |
| 2026-10-17 | En la revisión de una renovación se aclara que sólo la constancia de situación fiscal es obligatoria y que los demás documentos aparecen sólo si la persona los actualizó | Propuesta de Claude, por la duda de Liber |
| 2026-10-17 | En la revisión, al observar un documento no se avanza solo (hay que escribir qué corregir): bajo la observación, «Listo, ir al siguiente» lleva al siguiente documento sin decidir, y no avanza si la observación está vacía | Liber Saltijeral |
| 2026-10-17 | Al registrar la revisión, el visor se cierra y la confirmación queda arriba, a la vista | Liber Saltijeral |
| 2026-10-17 | Versión de prueba: el resultado de la revisión llega a la persona en «Mis trámites» (con observaciones y qué corregir, validada con su cita, o rechazada con su motivo); si la reenvía, vuelve a la bandeja como reenviada. Las revisadas salen de la bandeja y se listan en «Revisadas en esta prueba» mientras no existan las pantallas de ~~citas de cotejo,~~ grupos, calificación y entrega (las de citas y cotejo ya existen) | Liber Saltijeral |
| ~~2026-10-17~~ | ~~La fotografía que carga la persona sólo sirve para identificar su perfil y para comprobar en la cita de cotejo que es la misma persona. La de la credencial se toma el día que se entrega~~ Sustituida: también la usa quien aplica el examen para confirmar que es la persona y tomarle asistencia (2026-10-17, «Cursos y grupos») | Liber Saltijeral |
| 2026-10-17 | La credencial se entrega el mismo día del examen: el examen es en computadora y la calificación sale al momento, así que quien aprueba la recoge ese día (P10) | Liber Saltijeral |
| 2026-10-17 | Versión de prueba: siempre a la vista, bajo la franja amarilla, la pantalla, la fase del trámite (en «Mis trámites», la de la solicitud de la persona) y el enlace al mapa del trámite, «quién hace qué, fase por fase». No va en el menú de pruebas | Liber Saltijeral |
| ~~2026-10-14~~ | ~~Para activar una cuenta del registro de Kobo, el nombre escrito debe ser el del registro; si no coincide, la persona acude a la Secretaría (propuesta de Claude, en el mapa como R03)~~ Sustituida (2026-10-18, P14) | Propuesta |
| ~~—~~ | ~~Quién restablece las contraseñas si el SIA no da correo~~ Sustituida por la decisión de lanzamiento con correo (2026-10-17): la contraseña se restablece con un enlace de un solo uso enviado por correo (aviso C1); P13 resuelto | ~~**Pendiente**~~ |

## Requisitos

| Fecha | Decisión | Quién |
|---|---|---|
| 2026-10-15 | Cada archivo cargado se guarda con el nombre TIPO DE DOCUMENTO_NOMBRE COMPLETO DEL INTERESADO (p. ej. CURP_ANA EJEMPLO MUESTRA.pdf), sin importar cómo lo nombró la persona; el nombre original se conserva aparte. Mayúsculas sin acentos; la Ñ se conserva. Igual para la fotografía (FOTOGRAFIA_…) y los documentos que carga el personal (FACTURA_…, COMPROBANTE DE RECEPCION_…) | Liber Saltijeral |
| ~~2026-10-14~~ | ~~Las constancias de capacitación sólo se piden para dictaminador, y ahí son obligatorias en la solicitud nueva (mapa, R11). [pendiente] confirmar que también aplican a quien tiene título~~ Sustituida (2026-10-15): se quitó el requisito; las constancias pueden ir entre los comprobantes de experiencia | Liber Saltijeral |

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
| 2026-10-17 | Si la persona no se presenta a la cita: se marca y se le da una cita nueva una sola vez; si tampoco se presenta a la segunda, la solicitud se cierra como «concluida sin atender» (plazo: P02) | Liber Saltijeral |
| 2026-10-17 | Si no trae el comprobante de pago: no se termina el cotejo; se le da otra cita y conserva el monto que se le indicó | Liber Saltijeral |
| 2026-10-17 | Si un documento no coincide con lo que cargó, la persona tiene oportunidad de conseguir el correcto ese mismo día (un café internet, su teléfono): la cita queda en pausa, ella carga el documento desde «Mis trámites» y el personal retoma el cotejo de ese documento. Si no puede ese día, la solicitud regresa con observaciones y, tras una nueva revisión, recibe otra cita | Liber Saltijeral |
| 2026-10-17 | Si no es la persona de la fotografía ni de la identificación: no se atiende la cita, se avisa a la Dirección y la cuenta queda bloqueada hasta aclararlo | Liber Saltijeral |
| 2026-10-17 | La misma persona del personal revisa en línea y atiende las citas de cotejo: un solo perfil «revisión y cotejo» (P27) | Liber Saltijeral |
| 2026-10-17 | Cada cita de cotejo queda registrada en la base (apd.cita) con lo que pasó: atendida, en pausa, con observaciones, sin pago, no se presentó o no era la persona. La base la crea al validar o al cambiar la cita; con una cita abierta no se asigna otra | Construcción |
| 2026-10-17 | La pausa sólo dura el día de la cita; en pausa, la persona sólo carga el documento que no coincidió («Cargar el documento correcto», desde «Mis trámites»). La que no se retoma ese día regresa con observaciones (tarea nocturna, P80) | Construcción |
| 2026-10-17 | Cuenta bloqueada por identidad: sólo la Secretaría la bloquea o la desbloquea; al entrar, la persona sólo ve el aviso después de dar su contraseña correcta (aviso a la Dirección: P79) | Construcción |

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
| 2026-10-17 | Un grupo combinado admite cualquier mezcla: por ejemplo, 20 personas de CFE, 3 de una alcaldía y 1 independiente. Si una organización no llega a 5, sus personas van a un grupo combinado | Liber Saltijeral |
| 2026-10-17 | A un grupo confirmado se le agregan personas hasta el día anterior al inicio del curso, sin pasar de 25 | Liber Saltijeral |
| 2026-10-17 | El curso empieza al menos 7 días después de confirmar el grupo (parámetro `dias_anticipacion_grupo`), para que la persona se entere y se organice | Liber Saltijeral |
| 2026-10-17 | Las horas (cita de cotejo y entrada del curso) se eligen de una lista cerrada de 24 horas (HH:MM), sin texto libre. Mientras el área define los horarios, la lista es de prueba: citas de 09:00 a 14:00 y entrada de 07:00 a 10:00, cada 30 minutos (P69, P91) | Liber Saltijeral |
| 2026-10-17 | Un grupo se confirma con primer día, hora de entrada (la misma todos los días, `apd.grupo.hora_entrada`) e instructor; la sede es la única | Construcción (maqueta aprobada) |
| 2026-10-17 | Si una baja deja a un grupo confirmado por debajo del mínimo, el grupo regresa a integración y conserva su fecha, hora e instructor como propuesta; se vuelve a confirmar al completarse. Lo hace la base | Propuesta de Claude |
| 2026-10-17 | La asistencia la captura el instructor día por día, sólo de los días que ya ocurrieron, y se puede corregir mientras el curso siga. El último día se registra al pasar lista en el salón de cómputo (P94, ~~por decidir: opción recomendada mientras tanto~~ decidido el 2026-10-18) | Construcción (maqueta aprobada) |
| 2026-10-15 | Adscripción (en la cuenta y en «Mis datos», ver Cuentas) en lugar de «Organización con la que trabajas»: primero «¿Trabajas para alguna empresa, institución o dependencia?» (Sí/No); si sí, el tipo: empresa, consultoría o particular (persona moral o física); dependencia del Gobierno de la Ciudad de México; alcaldía; dependencia del Gobierno Federal. Según el tipo: nombre o razón social como en su constancia de situación fiscal; SOBSE, SEDEMA, PAOT u otra; una de las 16 alcaldías; CFE u otra. Todas obligatorias | Liber Saltijeral |
| ~~2026-10-15~~ | ~~Si es la SEDEMA, se pregunta la Dirección General: DGEIRA, DGZCFS, DGSANPAVA, DGCPCA, DGIVA o DGCORENADR. Se agregó «Otra área de la Secretaría» con su nombre, para que nadie quede sin opción (propuesta de Claude)~~ Sustituida: lista cerrada, sin «otra área» (2026-10-15, P53); orden de las Direcciones Generales: 2026-10-17 (ver Cuentas) | Liber Saltijeral / Propuesta |
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
| 2026-10-17 | Lugares dentro de la sede única: el curso se imparte en el aula de capacitación del Vivero Nezahualcóyotl y el examen en línea se presenta en el salón de cómputo del PILARES Vivero Nezahualcóyotl, a unos metros, dentro del mismo predio (Canal de Chalco s/n, colonia Ciénega Grande, Alcaldía Xochimilco). La sede sigue siendo una sola (P09) | Liber Saltijeral |
| 2026-10-17 | Examen en línea, prototipo (bloque 46, pedido por Liber): la persona entra sin su cuenta, sólo con un código de un solo uso de 8 caracteres (XXXX-XXXX, sin caracteres que se confunden en papel: 0/O, 1/I/L, 2/Z, 5/S, 8/B) que genera quien aplica el examen después de comprobar su identificación oficial. Un código perdido se repone: el anterior deja de servir y el examen sigue igual (P78) | Propuesta de Claude, aprobada por Liber (bloque 49) |
| 2026-10-17 | El día del examen, el instructor pasa lista en el salón de cómputo: ve la fotografía de cada persona (la confirmada en el cotejo), la compara con ella y con su identificación oficial, y la marca «Presente» o «No llegó». «Presente» genera su código; quien llega tarde se marca presente después. A quien ni asistiendo ese día alcanza el mínimo no se le pasa lista (sin derecho a examen). La asistencia de los días anteriores la captura el instructor en el aula. ~~Que «Presente» registre también la asistencia del último día está por confirmar (P94)~~ «Presente» registra también la asistencia del último día (P94, 2026-10-18) | Liber Saltijeral (asistencia del último día: P94) |
| 2026-10-17 | La persona entra con el código y no con su cuenta: el código sólo existe si el instructor la vio presente, en una computadora compartida del PILARES no se escribe ninguna contraseña ni se abre la cuenta con sus datos personales, y no depende de recuperar contraseñas olvidadas (P13, P23). La pantalla «¿Eres tú?» muestra su nombre y su fotografía para que el instructor la reconozca al pasar | Liber Saltijeral (con la explicación de Claude) |
| 2026-10-17 | Un código se usa en una sola computadora a la vez: si ya está abierto en otra, no entra y se le avisa al instructor. Si la computadora falla, en unos segundos la persona sigue en otra con el mismo código | Propuesta de Claude, aprobada por Liber |
| 2026-10-17 | Una pregunta por pantalla, con mapa de preguntas, marca «para revisar» y revisión antes de enviar (con confirmación). El orden de las preguntas y de sus opciones es distinto para cada persona y no cambia si vuelve a entrar. Cada respuesta se guarda en el servidor al elegirla: quien cambia de computadora sigue con el mismo código, sus respuestas y el tiempo que le queda | Liber Saltijeral (aprobado el 2026-10-17, P101) |
| 2026-10-17 | El tiempo corre desde «Empezar» y lo lleva el servidor; al agotarse, el examen se envía con lo contestado y ya no acepta respuestas. Una pregunta sin contestar cuenta como incorrecta | Liber Saltijeral (aprobado el 2026-10-17, P101) |
| 2026-10-17 | La calificación la calcula el servidor: aciertos entre preguntas por 10, con un decimal y sin redondear hacia arriba (P88). La persona la ve al enviar; queda en apd.examen con origen examen_web y no se modifica | Liber Saltijeral (aprobado el 2026-10-17, P101) |
| 2026-10-17 | Quien aplica sigue el avance al momento, puede suspender un examen con motivo (la persona lo lee en su pantalla y lo contestado no se califica) e imprimir los códigos en papeletas. Salir de la ventana del examen no lo bloquea: se le cuenta a quien aplica | Liber Saltijeral (aprobado el 2026-10-17, P101) |
| 2026-10-17 | Poda y derribo tiene un solo examen, igual para solicitud nueva y renovación. Se captura en el banco de reactivos (P74) | Liber Saltijeral |
| 2026-10-17 | Dictaminador técnico también tiene un solo examen, igual para solicitud nueva y renovación | Liber Saltijeral |
| 2026-10-17 | El cuadernillo «EVALUACION_PODADORES_2025» es el único vigente de poda y derribo: 52 reactivos (40 de opción múltiple y 3 ejercicios de valoración y restitución) en 60 minutos; se aplica completo. Lo del cuadernillo anterior se descarta | Liber Saltijeral |
| 2026-10-18 | En los ejercicios de restitución económica el enunciado fija un valor por unidad ($113.14) y no se actualiza cada año: se evalúa el cálculo. Las correcciones de formato del cuadernillo las hace la Oficina; el área técnica revisa el fondo | Liber Saltijeral |
| 2026-10-17 | El banco real de reactivos, con su clave, nunca entra al repositorio público: el prototipo usa preguntas ficticias sobre el propio trámite y la página nunca recibe la respuesta correcta (P85) | Liber Saltijeral / Propuesta |
| 2026-10-17 | La fotografía de la cuenta tiene que verse clara: el día del examen, quien lo aplica la usa para confirmar que es la persona y tomarle asistencia. Así lo dice la ayuda en «Crea tu cuenta» y al cambiarla en «Mi perfil» | Liber Saltijeral |
| ~~2026-10-17~~ | ~~El sitio usa el Estándar de formularios del SIA 1.3.1 (`SedemaOficina/estandares-sia`, carpeta `formularios/`) y quita las soluciones provisionales que el estándar ya resolvió (P37–P47, P52, P56, P61, P65–P67, P70–P73, P81, P82, P86, P87)~~ Sustituida (2026-10-18): estándar 1.4.1 (ver «Decisiones del 2026-10-18») | Instrucción del proyecto |
| 2026-10-17 | En las pantallas del personal los textos del estándar se ven en usted (~~`app/config-usted.js`~~ `app/mensajes-usted.js` desde el 2026-10-18, sin editar `formkit/`); en las de la persona solicitante, en tú, como el estándar | Instrucción del proyecto |
| 2026-10-17 | La espera de un curso se muestra **agrupada por adscripción**: cada bloque dice cuántas personas son, si alcanzan para un grupo propio y permite elegirlas a todas. Los bloques van en el orden de quien más espera en cada uno; dentro, el mismo orden de antigüedad | Liber Saltijeral |

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
| 2026-10-14 | Avisos: la persona ve en «Mis trámites» su resultado (aprobada o no, con asistencia y calificación) y, ya emitida, que su acreditación está lista para recoger, con lugar y horario. El aviso por correo depende del servicio del SIA. ~~Lugar y horario de entrega: **pendientes**~~ Sustituida: la entrega es el mismo día del examen (2026-10-17, ver Cuentas); quien no pueda quedarse: P10 | Liber Saltijeral |
| 2026-10-14 | La acreditación se emite con la fecha del día de emisión, no del curso ni del examen. Liber definirá el formato del folio; el actual (PD-AAAA-NNNN, DT-AAAA-NNNN) es provisional (mapa, R38) | Liber Saltijeral |

## Avisos y confirmaciones

Propuesta «Avisos y confirmaciones del trámite» (revisión de 131 momentos de las pantallas), aprobada por Liber el
2026-10-17 y aplicada en la versión de prueba 0.37. Donde el estándar de formularios se queda corto, el proyecto lo
resuelve en `app/apd.js` y `app/apd.css` y lo anota como hallazgo (P113 a P118). Desde el 2026-10-18 (estándar 1.4.1),
P113 a P119 están resueltos en el estándar; en el proyecto sólo quedan las desviaciones P126 a P131, P134 y P135.

| Fecha | Decisión | Quién |
|---|---|---|
| 2026-10-17 | Cada mensaje responde dos preguntas: **qué pasó** (en el título, con el resultado: «Validada», «Rechazada por perfil», «Cotejo terminado») y **qué sigue** (en el texto, con quién actúa y cuándo). Ningún mensaje usa el nombre interno de un estado | Liber Saltijeral |
| 2026-10-17 | Cinco tipos de mensaje, cada uno con su forma: desenlace de una acción (recuadro con tono, título, «Quedó guardado a las HH:MM · quien» y el motivo citado), confirmación antes de actuar, error junto al campo, aviso de la pantalla (con título) y anuncio para lector de pantalla, que **también se ve** | Liber Saltijeral |
| 2026-10-17 | Confirmación antes de actuar sólo cuando la acción tiene consecuencias para otra persona o no se deshace: título en pregunta, lista de lo que pasará, «No se puede deshacer» cuando aplica, «Volver sin cambios» con el foco y un botón que repite el verbo («Sí, dar de baja», «Sí, cancelar el grupo»), rojo relleno si es de peligro | Liber Saltijeral |
| 2026-10-17 | Etiquetas de estado en cinco familias, siempre con icono además del color: hecho (palomita), te toca actuar (alerta), en marcha (reloj), cerrado sin éxito (equis) y terminado (fin). Para la persona, la etiqueta dice qué hacer («Corrige y reenvía», «Acude a tu cita»); para el personal, la situación («Con observaciones», «Cita asignada») | Liber Saltijeral |
| 2026-10-17 | «Mis trámites» muestra primero las solicitudes en curso y, arriba de su ficha, lo que cambió (cita nueva, grupo cancelado, observaciones) | Liber Saltijeral |
| 2026-10-17 | El resumen de errores habla de respuestas y nombra el documento al que pertenece cada una («Para continuar, faltan 3 respuestas»), no de «campos» | Liber Saltijeral |
| 2026-10-17 | Cuando lo que sigue son dos o más acciones en orden, va en **pasos numerados** bajo «Qué sigue», no encadenado en un párrafo: el texto dice el hecho y cada paso, quién hace qué (desenlaces del personal, avisos y «Mis trámites») | Liber Saltijeral |

## Decisiones del 2026-10-18 (preguntas de la auditoría integral)

| Fecha | Decisión | Quién |
|---|---|---|
| 2026-10-18 | **Último día del curso (P94):** su asistencia se registra al pasar lista en el examen, en el salón de cómputo: quien aplica el examen marca «Presente» y eso cuenta como asistencia de ese día. El instructor no lo captura en el aula | Liber Saltijeral |
| 2026-10-18 | **Inasistencias a la cita de cotejo (P123):** se cuentan todas las de la solicitud, aunque regrese con observaciones y se valide otra vez; a la segunda, la solicitud se cierra | Liber Saltijeral |
| 2026-10-18 | **Activar una cuenta del registro anterior (P14):** la CURP debe coincidir con el registro y el nombre se compara sin acentos, admitiendo una letra distinta; la identidad se confirma en el cotejo con la identificación oficial | Liber Saltijeral |
| 2026-10-18 | ~~El sexo tomado de la CURP es un dato interno: la persona no lo ve~~ Rectificado el mismo día: la persona **sí ve** su sexo, tomado de la CURP y de sólo lectura, en «Crea tu cuenta» y en «Mi perfil», como un dato más; lo que no quiere es el recuadro amarillo de «dato interno» | Liber Saltijeral |
| 2026-10-18 | La situación del grado (en curso, trunco, concluido, titulado) se pregunta **sólo con licenciatura**. Con maestría o doctorado se asume la licenciatura titulada y no se pregunta | Liber Saltijeral |
| 2026-10-18 | La renovación de dictaminador técnico **no vuelve a pedir los años de experiencia**: ya se comprobaron en la primera vez | Liber Saltijeral |
| 2026-10-18 | Quien viene del registro anterior (Kobo) sin archivos, en su primera renovación en el sistema **carga todos los documentos, como una solicitud nueva**, porque la Secretaría no tiene copia | Liber Saltijeral |
| 2026-10-18 | La credencial se entrega **en la oficina del Vivero Nezahualcóyotl**, después del examen (no en el salón de cómputo del PILARES) | Liber Saltijeral |
| 2026-10-18 | La guía del SIA (`docs/GUIA-PROYECTOS-SIA.md`) se queda en este repositorio como está | Liber Saltijeral |
| 2026-10-18 | «Mi perfil» ya no muestra el número de expediente: identifica la carpeta física, no a la persona, y ya se ve en «Mis trámites» desde el primer cotejo | Liber Saltijeral |
| 2026-10-18 | La adscripción se muestra con rótulo y valor, cada dato en su renglón («Tipo», «Nombre o razón social», «Alcaldía», «Dependencia», «Dirección General»), en «Mi perfil», en la solicitud y en las fichas del personal; ya no como «Tipo: nombre.» en un solo renglón en negritas | Liber Saltijeral |
| 2026-10-18 | Texto de «Mi perfil» sobre la adscripción: «Puedes cambiarla cuando quieras: tus siguientes solicitudes se envían con la nueva. Las que ya enviaste se quedan con la adscripción que tenías al enviarlas.» | Liber Saltijeral |
| 2026-10-18 | «Mis trámites» en tres bloques: «Solicitudes en curso» (incluye la acreditada con la credencial por recoger), «Mis acreditaciones» y «Solicitudes anteriores» (las terminadas; sólo si hay) | Liber Saltijeral |
| 2026-10-18 | La persona ve «En espera de curso»; el personal sigue viendo «En espera de grupo», porque con esa lista arma los grupos | Liber Saltijeral |
| 2026-10-18 | Menú de pruebas en dos pasos: «¿Quién?» (persona nueva, podador, dictaminador, del registro anterior sin cuenta, personal de la Secretaría) y «¿En qué momento?» (los casos de ese perfil por etapa). Los datos ficticios traen una persona para cada situación que se puede ver | Liber Saltijeral |
| 2026-10-18 | El instructor es quien aplica el examen: en el personal, sus dos papeles son «asistencia» y «aplicar el examen» | Liber Saltijeral |
| 2026-10-18 | En toda la plataforma, los datos se muestran como ficha (opción B): cada dato en su renglón con una línea fina entre renglones, el rótulo en una columna (gris claro, sin negritas) y el dato en otra (tinta, peso medio); en teléfono, el rótulo arriba del dato. Las ayudas van en gris claro, bajo el título de su sección y separadas de los datos. (Sustituye a los rótulos en versalitas de la versión 0.46) | Liber Saltijeral |
| 2026-10-18 | En una 2.ª revisión (o siguientes) sólo se decide lo que la persona corrigió: lo aceptado antes y sin cambios se ve como «Aceptado antes» y cuenta como aceptado; quien revisa puede reabrirlo | Liber Saltijeral |
| 2026-10-18 | En el cotejo, la ayuda del folio fiscal dice que también se llama UUID (Identificador Universalmente Único) | Liber Saltijeral |
| 2026-10-18 | Las bajadas y las líneas de datos (folio · fechas · revisión) usan todo el ancho de su tarjeta y cada dato queda completo en su renglón; se quita el límite de 70 caracteres del estándar en el proyecto (hallazgo P134) | Liber Saltijeral |
| 2026-10-18 | Los motivos frecuentes (chips) no se parten dentro de la píldora: si no caben, pasan completos al renglón siguiente; al pasar el cursor sólo cambia el borde, para no parecer elegidos (hallazgo P135) | Liber Saltijeral |
| 2026-10-18 | La asistencia se sigue capturando por día; además, «Asistencia» y la ficha del grupo (en curso o concluido) muestran el concentrado: una fila por persona, una columna por día (el último, el pase de lista del examen), días asistidos y si conserva el derecho a examen (en «Asistencia», sustituida por la fila siguiente: el concentrado queda sólo en la ficha del grupo) | Liber Saltijeral |
| 2026-10-18 | «Asistencia» con la propuesta A: una sola lista, la del día; por persona, fotografía, nombre, tira de puntos con los días del curso y los botones «Asistió» / «Faltó»; etiqueta sólo con riesgo («Ya no puede faltar», «Sin derecho a examen»); lo marcado se resume junto a «Guardar»; corregir otro día va en «Corregir otro día». Se quitan los botones por día y el concentrado de esa pantalla; la vista de conjunto queda en la ficha del grupo, con ✓ y ✗ y sólo «Sin derecho» en color (sustituye a la fila anterior en lo que toca a «Asistencia») | Liber Saltijeral |
| 2026-10-18 | En la tira de días de «Asistencia»: ✓ verde asistió y ✗ rojo faltó; sin días por venir ni marca del examen (la tira llega hasta el día en pantalla). En la versión de prueba se puede recorrer el curso completo, también los días que aún no llegan («simulado»), y el día del examen lleva a «Aplicar el examen» | Liber Saltijeral |
| 2026-10-18 | En la versión de prueba, guardar la asistencia de un día lleva al día siguiente del curso; en el SIA, guardar se queda en el día, porque los días que no han pasado no se capturan | Liber Saltijeral |
| ~~2026-10-18~~ | ~~El material de estudio del examen son dos documentos de la Secretaría: la norma ambiental aplicable y el manual de poda (versión vigente y enlace por confirmar, P136)~~ Sustituida el mismo día por la de los tres documentos que se suben al sistema (más abajo) | Liber Saltijeral |
| 2026-10-18 | El examen es a libro cerrado: el material se consulta antes, nunca durante el examen | Liber Saltijeral |
| 2026-10-18 | El material de estudio son tres documentos de la Secretaría que se suben al sistema (no enlaces): la Norma Ambiental NADF-001-RNAT-2015, el Manual técnico de poda (2023) y la Ley Ambiental de la Ciudad de México (texto vigente, última reforma del 23/07/2026) | Liber Saltijeral |
| 2026-10-18 | Página pública «Material de estudio», sin cuenta, enlazada desde el inicio y desde «Mis trámites» (en espera de curso o con grupo); el personal sube, reemplaza, publica u oculta los documentos en su propia pantalla; sólo PDF, hasta 30 MB (parámetro tamano_maximo_material_bytes); reemplazar no borra el archivo anterior | Liber Saltijeral |
| 2026-10-18 | Orden de trabajo: primero la actualización al Estándar de formularios 1.4.1 y después las correcciones de la auditoría integral | Liber Saltijeral |
| 2026-10-18 | El sitio usa el Estándar de formularios del SIA **1.4.1** y quita las soluciones provisionales que el estándar ya resolvió (P90, P95–P99, P102–P104, P110–P119). Las desviaciones que quedan son hallazgos nuevos: P126–P131 | Instrucción del proyecto |
| 2026-10-18 | Los textos del estándar en usted para el personal van en `app/mensajes-usted.js` (`FORMKIT_CONFIG.mensajes`, y al servidor con `validaPayload(…, { mensajes })`); se quitó `app/config-usted.js` | Instrucción del proyecto |
| 2026-10-18 | Etiquetas de estado en las cinco familias del estándar: hecho (verde), te toca actuar (ámbar, también un borrador sin enviar), en marcha (azul), cerrado sin éxito (rojo) y terminado (gris). Los desenlaces del personal usan el módulo «resultado» y las confirmaciones, `FormKit.confirma` con sus consecuencias | Instrucción del proyecto |

## Lineamientos

La Ley Ambiental de la Ciudad de México (art. 111, párrafo segundo) ordena a la Secretaría emitir los lineamientos para
obtener la acreditación como dictaminador técnico de arbolado y para la supervisión y ejecución de los trabajos de poda,
derribo, trasplante y restitución de árboles; el Octavo Transitorio fija el plazo de los del dictaminador (180 días hábiles). La
NADF-001-RNAT-2015 (5.1) prevé los lineamientos de las acreditaciones correspondientes. El
anteproyecto («Lineamientos para tramitar y obtener las acreditaciones de poda y derribo y de dictaminador técnico de
arbolado en la Ciudad de México», versión de trabajo 0.4, 72 artículos, 11 capítulos, 8 transitorios y 4 anexos) **no
se guarda en este repositorio porque es público**: vive en el Proyecto de Claude del sistema, en
`claude/LINEAMIENTOS-acreditaciones.md` (cruce y regla) y `claude/lineamientos/` (fuente para regenerar el Word).

**Regla de mantenimiento.** Toda decisión o pendiente que toque el trámite (requisitos, plazos, perfiles, curso,
evaluación, vigencia, renovación, pago, credencial, padrón, sanciones, notificaciones o datos personales) actualiza en
el mismo bloque el artículo del anteproyecto, su versión de trabajo y el campo `lineamientos` del pendiente en
`docs/pendientes.json`. Lo que decidan los lineamientos y cambie el sistema se registra como pendiente nuevo.

| Fecha | Decisión | Quién |
|---|---|---|
| 2026-10-18 | Alcance: los lineamientos regulan sólo poda y derribo y dictaminador técnico; el supervisor (NADF, 5.9) queda fuera por ahora, porque ni la Ley ni la norma lo desarrollan | Liber Saltijeral |
| 2026-10-18 | Dictaminar con la de poda vencida (P133): la de dictaminador conserva su vigencia y la persona debe renovar la de poda; para renovar la de dictaminador necesita la de poda vigente | Liber Saltijeral |
| 2026-10-18 | El anteproyecto incluye un capítulo completo de suspensión y revocación (P120), con valores propuestos para revisión jurídica | Liber Saltijeral |
| 2026-10-18 | El anteproyecto se trabaja en Word con la identidad de la Secretaría; en el repositorio sólo van el cruce (campo `lineamientos`) y los pendientes que abre (P137 a P144) | Liber Saltijeral |
| 2026-10-18 | El documento previo del equipo (fundamentos, obligaciones, prohibiciones, causas de suspensión y cancelación) se incorporó al anteproyecto; no se tomaron el comprobante de domicilio, el escrito libre, los 15 días, el 80 % ni el 9.0 | Liber Saltijeral |

### Lo que hay que corregir en el borrador del área (ya aplicado en el anteproyecto)

| # | En el borrador | Corrección |
|---|---|---|
| 1 | Renovación «15 días antes del término» | Desde 30 días naturales antes y hasta un año después del vencimiento |
| 2 | Pasantes: 5 años de experiencia en la tabla y 2 en las disposiciones específicas | Una sola regla: 5 años (resuelto, P01) |
| 3 | Carrera técnica: las disposiciones piden constancias de capacitación que la tabla no incluye | Quitar las constancias como requisito aparte: van entre los comprobantes de experiencia (2026-10-15) |
| 4 | Requisito 12 de dictaminador, «Acreditación del curso, 9.0», entre los requisitos de inscripción | Quitarlo: es el resultado del examen |
| 5 | Numeración de la tabla de dictaminador salta del 2 al 4 | Renumerar |
| 6 | El cotejo compara contra lo «adjuntado por correo» | Contra lo cargado en la plataforma |
| 7 | 80 % de asistencia | Expresar la asistencia mínima en días; cursos de 5 días (nuevos) y 1 día (renovación) |
| 8 | Renovación «mediante escrito libre dirigido al Titular» | Solicitud en la plataforma |
| 9 | Sin plazos para atender observaciones ni para presentarse a la cita | Fijarlos. **Pendiente de la Dirección** |
| 10 | La consecuencia de no renovar a tiempo está truncada | Pasado un año del vencimiento se tramita como nueva |
| 11 | «El resultado de la evaluación será inapelable» | Liber lo mantiene (mapa, R37). Recomendación: que la Dirección Jurídica revise la redacción antes de publicar |
| 12 | Faltan el check list (anexo), el concepto y monto del derecho, y las secciones «Del pago» y «Del curso» | Pedirlos a la Dirección (P04). El Anexo 1 de carreras afines ya no hace falta: la carrera la valida el personal en la revisión (P59) |
| 13 | El comprobante de domicilio no tiene uso declarado en el procedimiento | **No pedirlo** (decisión de Liber): no se utiliza. Hoy la norma lo exige y el sistema lo sigue pidiendo hasta que se publiquen los lineamientos (P03) |
| 14 | Calificación mínima de dictaminador: 9.0 | 8.0 (poda se queda en 7.0) |
| 15 | Renovación de dictaminador pide comprobante de estudios y currículum | Sólo si se actualizaron |
| 16 | Expediente por solicitud o sin regla | Un expediente por persona (CURP) para todos sus trámites, abierto en su primer cotejo |
| 17 | Sin datos de pago antes de la cita | Al asignar la cita se dan concepto, monto y referencia; el comprobante se presenta en el cotejo |
| 18 | La entrega no deja constancia | Acuse de entrega firmado por la persona, escaneado y cargado por la Secretaría |
| 19 | Quien no aprueba el examen: sin regla | Trámite nuevo completo, incluido el pago de derechos |
| 20 | No se menciona la fotografía de la persona ni la credencial | Fotografía de frente al crear la cuenta, confirmada en el cotejo (ahí no se toma otra); credencial con fotografía tomada al entregarla, y comprobante de recepción firmado |
| 21 | La fecha del examen, el instructor y la calificación se registran «en el formulario de Kobo Toolbox» | Examen en línea en el salón de cómputo del PILARES Vivero Nezahualcóyotl; la calificación la registra el sistema y la fecha y el instructor quedan en el grupo |
| 22 | Con calificación favorable, se notifica por correo «la fecha en que deberá acudir» para la formalización | La credencial se entrega el mismo día del examen (P10) |
| 23 | La fecha y hora de la cita se asignan «a través del correo electrónico» | Por correo y en «Mis trámites» (P23) |
| 24 | Sin regla si la persona no se presenta a la cita | Se le da una cita nueva una sola vez; a la segunda inasistencia la solicitud se cierra como «concluida sin atender» |

## Pendientes

Todos los pendientes, con número fijo, responsable y desde cuándo bloquean, están en `docs/PENDIENTES.md`.
