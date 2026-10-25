# Etapa 2 · Pantallas del personal de la Secretaría

Se les habla de usted. Cada pantalla se muestra primero como maqueta (`maquetas/`) y, aprobada, se construye en el
sitio con sus pruebas (decisiones del 2026-10-16). Acceso simulado mientras no haya cuentas del personal (P27).

## 1. Pantallas

Pantallas del personal «para computadora» (decisión 2026-10-17): se diseñan y revisan primero en escritorio; en teléfono
sólo se cuida que funcionen. La asistencia y el examen se cuidan en los dos tamaños.

| Pantalla | Archivo | Qué hace |
|---|---|---|
| Solicitudes por revisar | `sitio/revision.html` · `app/revision.js` | Bandeja de las solicitudes enviadas, de la que más espera a la más reciente. Búsqueda por nombre, CURP, folio de la solicitud o número de expediente; filtros por acreditación, nueva o renovación y vuelta de revisión (plegados en teléfono bajo «Filtrar»). Señala carrera por clasificar, perfil que podría no cumplir y documentos corregidos. **Escritorio** (desde 1024 px; acomodo aprobado por Liber el 25/10/2026, DIAGNOSTICO 4.3): arriba, cuatro indicadores que son enlaces («Por revisar» con las atrasadas, «Citas de hoy» con las que faltan por atender, «Avisos por teléfono» pendientes y «En espera de grupo» en cuántos cursos) y, debajo, las pestañas del estándar (módulo `pestanas`) «Solicitudes por revisar (N)» | «Avisos por teléfono (N)» | «Registro asistido»; búsqueda y filtros en una fila, filas compactas de unos 44 px y, desde 1280 px y 700 px de alto, el encabezado de la tabla fijo. Con más de 25, paginación del estándar (módulo `paginacion`) de 25 en 25 (o 50 o 100) en el mismo orden: la página 1 es la de más espera; una búsqueda o un filtro regresa a la página 1. En teléfono y tableta, todo como antes (sin indicadores ni pestañas, las secciones una debajo de otra), salvo la paginación con más de 25 |
| Revisar una solicitud | `sitio/revisar.html?folio=…` · `app/revisar.js` | En la revisión de la segunda corrección (la última oportunidad para corregir, parámetro `oportunidades_correccion`; ajustes del equipo, 25/10/2026), un aviso desde el inicio («Es la revisión de la segunda corrección: la última oportunidad») y, en «Resultado», si algo queda con observación, la acción es «Cerrar la solicitud» (con contorno de peligro, confirmación y el motivo ya escrito, «Se agotaron las oportunidades de corrección»), no regresar con observaciones; si todo está bien, se valida como siempre. Por pasos (decisión de Liber del 24/10/2026; módulo «pasos» del estándar): «Perfil» (sólo dictaminador: carrera, experiencia, «Carrera por clasificar» o perfil que podría no cumplir), un paso por cada documento que trae la solicitud con «¿El documento está bien?» («Sí, está bien» / «No, tiene un problema», con los motivos frecuentes y lo que se le dirá a la persona) y el visor al lado (en teléfono, «Ver documento» a pantalla completa), «Resultado» con el resumen antes de confirmar (validar, enviar observaciones o rechazar, con confirmación) y «Fecha de la cita» sólo si todo está bien (días hábiles, de 9:30 a 14:30, con el calendario). Si se rechaza por el perfil, del perfil se pasa al resultado. Arriba, los datos de la persona y de la solicitud y las revisiones anteriores. En una 2.ª revisión, lo aceptado antes y sin cambios dice «Aceptado antes» en su paso y cuenta como aceptado; se puede reabrir; lo corregido dice qué se le pidió |
| Citas de cotejo | `sitio/citas.html` · `app/citas.js` | Agenda del día por hora (sede única), con la situación de cada cita: por atender, en pausa, documento cargado (retomar), atendida con su expediente, no se presentó, sin pago, regresó con observaciones, no era la persona. Día anterior y siguiente con citas; la búsqueda (nombre, CURP, folio o expediente) busca en todos los días |
| Atender una cita de cotejo | `sitio/cotejo.html?folio=…` · `app/cotejo.js` | Por pasos (decisión de Liber del 24/10/2026): «¿Es la persona?» (si llegó y, con la fotografía de la cuenta, si es ella; «No es la persona» detiene la cita y bloquea la cuenta), «Documentos originales» (cada requisito con «Sí, es igual» / «No es igual», con «Ver lo que cargó» en el visor y, si alguno no es igual, si lo trae hoy), «Pago y factura» (el comprobante por el monto y la referencia; la factura con los datos de la constancia de situación fiscal) y «Resultado» con el resumen: terminar (abre el expediente y pasa a la espera de grupo), pausa del día, regresar con observaciones, otra cita (sin pago o primera inasistencia), cerrar (segunda inasistencia) o no atender (no es la persona). Lo que no hace falta se salta: sin la persona, del primer paso al resultado; con un documento que no es igual, de los originales al resultado. Retomar una pausa empieza en «Documentos originales» y coteja sólo lo que no coincidió |
| Cargar el documento correcto (persona) | `sitio/corregir.html?folio=…` · `app/corregir.js` | Con la cita en pausa, la persona carga ese mismo día el documento que no coincidió; se pide sólo ése |
| Grupos (paso a paso) | `sitio/grupos.html?curso=…&mes=…&semana=…&paso=…` · `app/grupos.js` | Opción B1 de la maqueta «Grupos: propuestas de rediseño» (decisión de Liber del 24/10/2026; sustituye al planeador por curso de la propuesta A y a «Programar un curso» de la B: un solo camino para armar un grupo). En usted. Título «Grupos», la fecha de hoy y el paso a paso «Armar un grupo» con la barra de pasos del estándar (módulo `pasos`, con `aria-current="step"` y el foco al título de cada paso; sin `.barra-fija`, P177) y, debajo, lo elegido hasta ahora (curso · semana · personas). **1. El curso**: los cuatro cursos como opciones del estándar, cada uno con cuántas personas esperan y su nota (prioritarias desde 15 días, P143; vencidas en renovación; «Falta gente para un grupo (mínimo 5)» o para cuántos grupos nuevos alcanza). **2. La semana**: calendario por mes (flechas «Mes anterior» y «Mes siguiente», de este mes a tres más, inactivas con `aria-disabled` en sus límites) con la columna «Semana»: «Libre» con «2 lugares libres» o «1 lugar libre de 2» (botón con `aria-pressed` y nombre completo: «Elegir la semana del 2 al 6 de noviembre de 2026: 2 lugares libres») o «No disponible» con su motivo (ya pasó, ya empezó, faltan menos de 7 días, ya hay 2 grupos, día inhábil); todas las reglas son las de `APD_PERSONAL.razonNoInicio` y `delDia` (P149, P150, P151), como la base. Los grupos se pintan en sus días con el color de su situación (por confirmar, confirmado, en curso, ya terminó; los de otro curso aparte, porque cuentan para el máximo), su folio el primer día y «Examen» el último; sábado y domingo sombreados; «Hoy» marcado; la semana elegida, resaltada con «Nuevo grupo». En teléfono (menos de 760 px) el calendario es una lista de semanas con sus fechas y sus grupos. A la derecha, la semana elegida con su horario (lunes a viernes, 9:00 a 15:00; el viernes del curso de primera vez, repaso de conocimientos y examen final en el PILARES), el «Primer día del curso» (dd/mm/aaaa, de sólo lectura: sale de la semana) y la leyenda. El curso de un día (renovación) elige además el día de la semana (lunes a viernes; el que no se puede dice por qué). Se propone la primera semana que se puede. **3. Quiénes van**: la espera del curso con las que más esperan ya marcadas hasta el cupo (`APD_PERSONAL.lasQueMasEsperan`: prioridad, renovación por vencimiento con vencidas primero, bloques sólo de gobierno local y federal con «Su grupo …» o si alcanzan para uno propio), «n de 25 lugares · se confirma con al menos 5 personas» (se anuncia al marcar o desmarcar), las propuestas a la vista y el resto en «Cambiar a quiénes van (N más en espera)» (C3-01), el tipo de grupo (el grupo propio sólo para instituciones de gobierno: dependencias de la Ciudad, Alcaldías y dependencias federales; con gente de una empresa, consultoría, particular, institución educativa o independiente la opción no se ofrece y una línea dice por qué; no se pide oficio: ajustes del equipo, 25/10/2026) y el aviso «… ya tiene su grupo» con «Agregarlas a APD-G-…». **4. Confirmar**: resumen (grupo con su nombre calculado y el folio que tendrá, curso, semana, horario, lugar, examen final, personas, tipo y «Persona instructora: la asigna el área de Instructores y Capacitación»; la hora de entrada no se elige: el horario, de 9:00 a 15:00 de lunes a viernes, va en el resumen como dato y el grupo toma la hora del parámetro `curso_hora_entrada`, decisión de Liber del 24/10/2026), la línea «La persona instructora la asigna el área de Instructores y Capacitación, que también confirma el grupo» y cómo queda antes de guardarlo («Se crea por confirmar» con lo que le falta). Desde los ajustes del equipo (25/10/2026) quien arma el grupo no elige instructor ni hay «Por asignar», propuesta automática ni «Crear sin confirmar»: «Crear el grupo» siempre lo crea por confirmar, sin persona instructora. Al crear, regresa a «Grupos programados» con un aviso (con «Qué sigue» y la ficha) y la fila del grupo nuevo resaltada («Recién creado»). La dirección guarda el curso, el mes, la semana y el paso: «Atrás» regresa al paso anterior y recargar lo conserva; las elegidas de cada curso, en la pestaña (C4-04, F3 B7). **Grupos programados**: una tabla por curso (módulo `tabla`; folio con enlace a su ficha, semana, personas de 25, situación —en curso con su día, confirmado, por confirmar, sin semana, propuesta vencida, no inició— y lo que le falta: semana, personas y persona instructora, o «Que Capacitación lo confirme») con «Completar con las N que más esperan» (ya no «Confirmar el grupo»: lo confirma Capacitación en la ficha), «Elegir semana»/«Cambiar la semana»/«Elegir otra semana» (abre el paso 2 con ese grupo) y «Agregar personas» (paso 3); «Grupos que ya terminaron», plegado. Con `?grupo=APD-G-…` el paso a paso completa ese grupo (curso y tipo fijos, «Ya están en el grupo (n)»; uno sin semana puede seguir sin ella; uno confirmado sólo recibe personas) y termina en su ficha. **Escritorio** (desde 1024 px; acomodo aprobado por Liber el 25/10/2026, DIAGNOSTICO 4.4): pestañas del estándar «Armar un grupo» | «Grupos programados (N)» | «Ya terminaron (N)» (abierto); al armar, el paso a la izquierda y a la derecha el panel «Tu grupo» (unos 380 px; fijo desde 700 px de alto, nunca más alto que la ventana): curso, semana, horario, tipo de grupo, el cupo con su barra («6 de 25 lugares · se confirma con al menos 5 personas»), «Atrás» y «Siguiente» (o «Crear el grupo»; pulsan los del paso) y las elegidas con «Quitar» (anuncia «n de 25» como al desmarcar). Paso 1, los cuatro cursos en 2 × 2; paso 2, el calendario a lo ancho, con el primer día y la leyenda debajo (la semana elegida y su horario, en el panel); paso 3, la espera como tabla compacta con casilla (Persona · Organización · Espera · Folio; los bloques de una institución de gobierno con su casilla de bloque) y un filtro por organización; paso 4, el resumen en dos columnas. «Ver los grupos programados» no se ve (lo dice la pestaña). En teléfono y tableta, todo como antes |
| En espera de un curso (sin uso) | `sitio/espera.html` · `app/espera.js` | Desde el 18/10/2026 sólo lleva a `grupos.html` con el mismo `?curso=` (y `?grupo=`, que desde el 24/10 abre el paso a paso con ese grupo): la espera está en «Grupos». Se conserva para los enlaces guardados |
| Programar un curso (sin uso) | `sitio/programar.html` · `app/programar.js` | Desde el 24/10/2026 sólo lleva a «Grupos» (decisión de Liber, opción B1) con lo que traía: `?curso=` al paso 2, `&semana=` elegida (con su mes), `&personas=` al paso 3 con ellas marcadas y `?grupo=` («Elegir semana» o «Cambiar la semana» de un grupo que ya existe) al paso 2 con ese grupo. Se conserva para los enlaces guardados, como `espera.html` |
| Un grupo | `sitio/grupo.html?folio=…` · `app/grupo.js` | Se titula con su nombre calculado y el folio en chico. Situación, cupo y personas. En integración, quien arma los grupos: agregar de la espera (Grupos con `?grupo=`), cambiar la semana (en «Grupos»), dar de baja (con motivo) o cancelar (con motivo); «Para confirmar el grupo» dice lo que le falta y que la persona instructora la asigna y el grupo lo confirma el área de Instructores y Capacitación, sin formulario. Con `?perfil=capacitacion` (ajustes del equipo, 25/10/2026): «Persona instructora y confirmación», con la lista de personas instructoras (sólo se eligen las libres esas fechas, `APD_PERSONAL.ocupado`; las demás dicen «tiene otro curso esas fechas»), el horario como dato y, con la semana a 7 días o más y el mínimo, «Asignar y confirmar el grupo» (o «Confirmar el grupo» si ya la tiene) y «Sólo asignar, sin confirmar»; si le falta algo, «Asignar la persona instructora» y lo que le falta; sin semana, que primero la elige quien arma los grupos. Confirmado: agregar hasta el día anterior al inicio y dar de baja; si queda por debajo del mínimo regresa a integración con su fecha y su persona instructora. Confirmado o en curso, Capacitación cambia a la persona instructora («Cambiar la persona instructora»; queda en la bitácora). En curso: asistencia y examen |
| Grupos por asignar y confirmar (Capacitación) | `sitio/capacitacion.html` · `app/capacitacion.js` | Inicio del perfil «capacitación», del área de Instructores y Capacitación (ajustes del equipo, 25/10/2026). En usted. Los grupos que esperan persona instructora o confirmación (en integración), del que empieza antes al más lejano y los que no tienen semana al final, con semana, personas, persona instructora y lo que les falta («Lista para confirmar» cuando tiene todo), cada uno con su acción (asignar, confirmar o ver) en su ficha; abajo, los confirmados y en curso con «Cambiar la persona instructora». En el menú de pruebas: «Personal de la Secretaría» → «Capacitación: asignar instructores y confirmar» |
| Asistencia (instructor) | `sitio/asistencia.html` · `app/asistencia.js` | Perfil simulado «instructor». Sin `?folio=`, «Mis grupos de hoy»: con un solo grupo con clase o examen hoy entra directo; con varios, una tarjeta por grupo (nombre calculado, folio, lugar, hora, personas, «Pasar asistencia» o «Pasar lista y aplicar») y «Próximos». El grupo se nombra por su nombre calculado. Una sola lista, la del día: por persona, fotografía, nombre, tira de días ya ocurridos (✓ asistió, ✗ faltó), «Asistió» / «Faltó» y etiqueta sólo con riesgo («Ya no puede faltar», «Sin derecho a examen»); no se guarda con alguien sin marcar. «Corregir otro día» abre los anteriores. La vista de todos los días está en la ficha del grupo. En la versión de prueba se recorre el curso completo (días «simulado») y guardar pasa al día siguiente. El último día se registra al pasar lista en el examen (P94) |
| Aplicar el examen | `sitio/aplicar.html` · `app/aplicar.js` | Quien aplica el examen (perfil simulado «instructor»). Sin `?folio=`, «Mis grupos de hoy», como en «Asistencia». El grupo (también en las papeletas) se nombra por su nombre calculado con su folio. grupo en curso con fecha (último día) y lugar (salón de cómputo del PILARES), personas con su asistencia y derecho a examen, pase de lista con la fotografía de cada persona («Presente» genera su código; «No llegó»; «Llegó: marcar presente»), avance al momento (sin empezar, contestando con cuántas lleva y el tiempo, calificación al enviar, suspendido, veces que salió de la ventana), reponer un código, suspender con motivo e imprimir papeletas con los códigos |
| Examen en línea (persona) | `sitio/examen.html` · `app/examen.js` | En las computadoras del salón, sin cuenta: entrar con el código → ¿eres tú? → instrucciones → una pregunta por pantalla (reloj, avance, mapa de preguntas, marcar para revisar) → revisar y enviar → calificación y qué sigue. Una recarga o el cambio de computadora vuelven al examen con lo contestado. Por ahora sólo se diseña la interfaz: todas las preguntas son de opción múltiple con cuatro opciones de texto; el examen real y su página se construyen después (decisión de Liber, 18/10/2026) |
| Lo común del examen | `app/examen-servidor.js` · `app/examen-grupo.js` · `app/codigo-examen.js` · `datos/examen-ficticio.js` | Servidor simulado del examen (códigos, orden por persona, respuestas, tiempo, calificación, suspensión, reposición), quién presenta el examen de un grupo, formato propio del código y banco ficticio (10 preguntas de cultura general en los dos exámenes, 60 minutos; el real nunca entra al repositorio, P85) |
| Material de estudio (personal) | `sitio/material-personal.html` · `app/material-personal.js` | Agregar un PDF (hasta 30 MB), editar datos y apartados, reemplazar el archivo (no borra el anterior), publicar u ocultar (ocultar pide confirmación) |
| Acreditaciones (sesión de trabajo del 23/10/2026) | `sitio/acreditaciones.html` · `app/acreditaciones.js` | Pantalla nueva: no había otra del personal que mostrara las acreditaciones de una persona. «Reposiciones por atender» (acta por revisar, por entregar y esperando el acta corregida) y el padrón, con búsqueda por número, nombre o CURP; cada fila abre la ficha. En la prueba, el perfil llega en `?perfil=` (`instructor` o `administracion`; sin él, revisión y cotejo) |
| Una acreditación | `sitio/acreditacion.html?numero=…` · `app/acreditacion.js` | Situación, titular, fechas, origen y entrega. «Cancelar acreditación» (P120) sólo para instructores y la Dirección y sólo si está vigente: diálogo de confirmación con sus consecuencias, motivo (10 caracteres o más) y fundamento, con el foco en el motivo (excepción del 20/10/2026). Cancelada: cuándo, quién, el motivo y el fundamento. Reposición de la credencial (P140): el acta (ver), revisarla (aceptarla u observaciones) y, con el acta aceptada, entregar la credencial repuesta con la factura de la cuota (RFC, nombre y folio fiscal) |
| Reposición de tu credencial (persona) | `sitio/reposicion.html?numero=…` · `app/reposicion.js` | Desde «Mis trámites» («Pedir la reposición de tu credencial»), de tú: qué pasó (pérdida o robo) y el acta (PDF, JPG o PNG de hasta 5 MB, módulo `archivos`); con observaciones, carga el acta corregida. «Mis trámites» muestra cada paso y, con el acta aceptada, la cuota y «Dónde es» |
| Registrar a una persona (registro asistido) | `sitio/asistido.html` · `app/asistido.js` · `app/config-asistido.js` | Decisión de Liber del 25/10/2026, para personas que no saben leer ni escribir; sólo el perfil de revisión y cotejo. En usted. Por pasos (módulo `pasos`): «Antes de empezar» (leerle el aviso de privacidad y marcar que se le leyó), «Sus datos» (nombre, CURP con la revisión de su fecha y de la mayoría de edad, teléfono obligatorio, correo opcional y adscripción, el mismo fragmento de «Crea tu cuenta»), «Su fotografía» (con la cámara de la computadora o un archivo; se agrega sin ubicación) y «Confirmar» con el resumen. Crea la cuenta sin contraseña (con quién y cuándo) y abre la solicitud en modo asistido. Si la CURP ya tiene cuenta, lo dice y lleva a la ventanilla |
| Solicitud capturada por el personal | `sitio/solicitud.html?asistida=…` · `app/solicitud.js` · `app/config-solicitud.js` | El mismo formulario de la persona, sin duplicarlo: un aviso arriba («Usted captura la solicitud de …»), el borrador por persona y, en lugar de la declaración y el aviso de privacidad, «Le leí lo capturado y está de acuerdo». El envío lleva `capturada_por`. Acuse imprimible (folio, fecha con `APD.fechaLarga`, teléfono de la persona y teléfono de informes) |
| Ventanilla | `sitio/ventanilla.html?buscar=…` · `app/ventanilla.js` | Buscar por CURP, nombre o folio. Ficha en lenguaje sencillo, listo para decírselo a la persona: en qué va su trámite, qué sigue, sus avisos por teléfono pendientes y, con observaciones, «Leerle lo que falta» (abre su solicitud en modo asistido, en sus documentos, para cargar lo corregido y reenviarlo con la marca de lectura) |
| Avisos por teléfono | `sitio/revision.html` (sección «Registro asistido») · `app/registro-asistido.js` | Debajo de la bandeja: «Registrar a una persona», «Ventanilla» y la lista de avisos por teléfono pendientes (de la vista `apd.avisos_telefono_pendientes`), cada uno con lo que hay que decirle, de tú, y «Se le avisó» / «No contestó». En «Revisar una solicitud» y «Atender una cita de cotejo», una etiqueta discreta «Registro asistido: avisar por teléfono, …» con su teléfono (sólo mientras no activa su cuenta) |
| Lo común | `app/personal.js` | Perfiles ficticios «revisión y cotejo», «instructor», «capacitación» (Instructores y Capacitación, 25/10/2026) y «administración (Dirección)», cabecera del personal (con «Acreditaciones»), espera y vuelta de cada solicitud, citas de cotejo y su situación, siguiente expediente, decisiones de la prueba en el navegador |

En el menú de pruebas, «¿Quién?» → «Personal de la Secretaría» abre la pantalla de cada papel; también está en «Ir a otra pantalla».

## 2. Reglas de la revisión

- **Máximo dos oportunidades para corregir** (ajustes del equipo, 25/10/2026; parámetro `oportunidades_correccion`): cada
  revisión en línea con observaciones da una oportunidad. Si en la revisión de la segunda corrección siguen las
  observaciones, la solicitud se cierra como «concluida sin atender», con el motivo «Se agotaron las oportunidades de
  corrección» (lo hace la base), y la persona puede iniciar una nueva de inmediato. Que el cotejo regrese la solicitud con
  observaciones no cuenta (P206). La persona ve en «Mis trámites» y al corregir «Te quedan 2 oportunidades para corregir»
  o «Esta es tu última oportunidad para corregir».
- **Carrera por clasificar** (dictaminador): afín (2 años), disciplina afín (5) o no afín → se rechaza.
- **Perfil declarado que no cumple** (hasta preparatoria, licenciatura en curso o trunca), opción C: si el comprobante
  lo confirma, se rechaza; si muestra otro grado, se observa el comprobante de estudios (la página lo marca con un
  texto propuesto) y la persona corrige su grado.
- Si no se rechaza, cada documento cargado se acepta u observa (observar pide qué corregir). Con alguna observación,
  regresa a la persona (mensaje general opcional); con todo aceptado, se valida con fecha y hora de la cita, que siempre
  es en el Vivero Nezahualcóyotl (sede única).
- La base vuelve a aplicar todo: ver `docs/REGLAS.md` («→ rechazada», «Clasificar una carrera»).

## 2a. Reglas del cotejo (decisiones 2026-10-17)

- **No se presenta**: cita nueva una sola vez; a la segunda inasistencia la solicitud se cierra como «concluida sin
  atender» (parámetro `inasistencias_cotejo_maximas`).
- **No es la persona** de la fotografía ni de la identificación: no se atiende, nota para la Dirección y la cuenta queda
  bloqueada (P79).
- **Un documento no coincide**: si la persona consigue el correcto ese día, la cita queda en pausa; lo carga en
  «Mis trámites» y se retoma el cotejo de ese documento. Si no, regresa con observaciones y, tras una nueva revisión,
  recibe otra cita. La pausa vence ese día (P80).
- **Sin comprobante de pago**: otra cita, con el mismo monto.
- **Todo en orden**: fotografía de la cuenta confirmada (en la cita no se toma otra), factura cargada con sus datos, cita atendida → «En
  espera de grupo» y expediente de la persona (si es su primer trámite).
- La base lo vuelve a aplicar: tabla `apd.cita` y sus reglas (`docs/REGLAS.md`, `03-apd-reglas.sql`).

## 2b. Reglas del examen en línea (prototipo, bloque 46)

- Pase de lista en el salón de cómputo: fotografía de cada persona, «Presente» (genera su código y registra la asistencia del último día, P94) o «No llegó» (si llega después, se marca presente). Sin derecho a examen: no se le pasa lista.
- La persona entra sólo con su código de un solo uso (P78, aprobado por Liber en el bloque 49), no con su cuenta; «¿Eres tú?» muestra su nombre y su
  fotografía. Un código perdido se repone; el anterior deja de servir y el examen sigue igual. Un código se abre en una
  sola computadora a la vez; el intento en otra se le cuenta a quien aplica.
- Orden de preguntas y opciones distinto por persona y fijo para ella. Cada respuesta se guarda al elegirla; se puede
  cambiar hasta enviar. El tiempo corre desde «Empezar» en el servidor; al agotarse se envía lo contestado. Una
  pregunta sin contestar cuenta como incorrecta.
- Calificación del servidor: aciertos / preguntas × 10, un decimal, sin redondear hacia arriba (P88). Queda en
  `apd.examen` con origen `examen_web` y no se modifica (R37).
- Suspender pide motivo (la persona lo lee). Salir de la ventana no bloquea; se le cuenta a quien aplica.
- Parámetros de prueba: 10 preguntas ficticias de opción múltiple en los dos exámenes, 60 minutos; el banco real es P74. Tiempo adicional por fallas: P89.
- Construido sin maqueta previa porque Liber pidió el prototipo funcional; Liber aprobó su funcionamiento el 2026-10-17 (P101).
- En la etapa 3 hacen falta en la base: el banco de reactivos (sin exponer la clave), los códigos con su orden y
  tiempo, y las respuestas con su hora; la API del módulo hace lo que hoy simula `app/examen-servidor.js` (P29).
- Sin conexión (ajustes del equipo, 25/10/2026: no perder el avance del examen): si una respuesta o una marca no llega
  al servidor por falta de conexión, se queda en esa computadora (`localStorage`, `apd.examen.pendiente.<código>.<pregunta>`)
  y la persona sigue contestando con una línea tranquila que lo dice. Al volver la conexión (evento `online` y reintentos
  cada 2, 4, 8… hasta 30 segundos) se envía en el orden en que se eligió; lo que el servidor rechaza por sus reglas (se
  acabó el tiempo, examen suspendido o enviado) se descarta. Al volver a entrar con el mismo código en la misma
  computadora (recarga o corte de luz), primero se envía lo pendiente y luego sigue donde se quedó; con un código
  repuesto, lo pendiente del anterior se envía con el nuevo. En otra computadora manda el servidor. «Enviar mis
  respuestas» no se envía con respuestas pendientes: lo explica y reintenta. El tiempo lo lleva el servidor y se detiene
  durante un corte (siguiente punto). En la API, una llamada que no llega responde con motivo `conexion`; en la prueba se
  simula por pestaña (menú de pruebas, «Simular que se va el internet»).
- El reloj se detiene durante un corte (decisión de Liber del 25/10/2026): mientras el examen está en curso, la pantalla
  manda al servidor una señal de vida con su código cada 12 segundos. El servidor cuenta el tiempo sólo mientras recibe
  señales: con más de 30 segundos sin señal deja de contar desde la última y reanuda al llegar la siguiente; al volver, la
  pantalla primero envía lo pendiente y después la señal. Sin conexión, el reloj de la pantalla se detiene y dice «el tiempo
  de tu examen está detenido»; el tiempo que muestra sale siempre de lo que responde el servidor (si a la pantalla se le
  acaba el tiempo pero el servidor lo tuvo detenido, el examen sigue). En «Aplicar el examen», cada persona sin conexión
  aparece como «Sin conexión desde las HH:MM», con el tiempo que lleva detenido, y el resumen del grupo las cuenta; al
  volver, «Estuvo sin conexión N veces; tiempo detenido: …». Cada pausa queda en la bitácora del examen (inicio, fin,
  duración y lo que detuvo). La pausa acumulada por persona tiene un tope de 30 minutos: al pasarlo, el tiempo vuelve a
  correr y quien aplica ve «Pasó el tope… Decida si espera o suspende el examen» (P214). Los tres valores son parámetros;
  en la prueba, `APD_EXAMEN_API.pruebas.parametros` los cambia y `pruebas.adelantar` adelanta el reloj del servidor. El
  contrato para el servidor del SIA está en `docs/EXAMEN-SEB.md`, sección 5.
- Lectura en voz alta (ajustes del equipo, 25/10/2026): «Escuchar la pregunta» lee la pregunta y sus opciones con su
  letra; cada opción tiene su «Escuchar»; «Detener la lectura» la detiene y cambiar de pregunta también. Lee además las
  instrucciones de «Entra a tu examen» y de «Antes de empezar» y la pregunta «¿Eres tú?». Usa `speechSynthesis` con una
  voz `es-MX` o, si no hay, cualquier `es-*`, un poco más despacio (0.85). Sin síntesis de voz o sin voz en español no hay
  botones, y quien aplica ve «Esta computadora no puede leer en voz alta» en la fila de la persona.
- Safe Exam Browser (ajustes del equipo, 25/10/2026): configuración recomendada, lo revisado y lo que hay que verificar en
  el PILARES en `docs/EXAMEN-SEB.md`.

## 2c. Reglas de grupos y asistencia (maqueta aprobada y decisiones del 2026-10-17)

- Los cuatro cursos nunca se mezclan. Un grupo nace en integración; se confirma con al menos 5 personas (ningún grupo
  abre con menos), con primer día al menos 7 días después de confirmar (`dias_anticipacion_grupo`), hora de entrada
  (`apd.grupo.hora_entrada`, la misma todos los días; P91: la del parámetro `curso_hora_entrada`, que no se elige desde
  el 24/10/2026) y persona instructora, que asigna el área de Instructores y Capacitación, que también lo confirma
  (ajustes del equipo, 25/10/2026). Recibe hasta 25.
- Específico (una organización) o combinado (cualquier mezcla de organizaciones e independientes). Desde los ajustes del
  equipo (25/10/2026) el específico, el grupo propio, es sólo de instituciones de gobierno (dependencias de la Ciudad,
  Alcaldías y dependencias federales); empresas, consultorías, particulares, instituciones educativas e independientes van
  siempre a grupos combinados. No se pide oficio: el personal arma el grupo. Si una institución de gobierno no llega a 5,
  sus personas van a un grupo combinado.
- A un grupo confirmado se agregan personas hasta el día anterior al inicio, sin pasar de 25.
- Dar de baja y cancelar piden motivo; las personas regresan a la espera con su antigüedad. Si una baja deja a un grupo
  confirmado por debajo del mínimo, regresa a integración y conserva su fecha, hora e instructor como propuesta (propuesta
  de Claude, bloque 53; la base lo hace sola).
- Asistencia: la captura el instructor, día por día, sólo de los días que ya ocurrieron; se corrige mientras el curso
  siga y no haya examen. El último día se registra al pasar lista en el salón de cómputo, no en el aula (P94, decidido el
  2026-10-18), para no capturarlo dos veces.
- La espera, en el paso 3 de «Grupos» (ya no es una pantalla aparte: `espera.html` sólo redirige), va agrupada por
  adscripción (decisión 2026-10-17): un bloque por organización, alcaldía o dependencia, y otro de independientes, con
  cuántas son, su grupo («Su grupo APD-G-…: N de 25, le faltan M para el mínimo») o si alcanzan para uno propio (sólo
  una organización registrada) y una casilla para elegirlas a todas. Los días de espera nunca salen negativos.
- Con volumen real (auditoría de tareas, 2026-10-17): «Grupos programados» ofrece en cada grupo que recibe personas
  «Agregar personas» (paso 3 con ese grupo; desde el 24/10, en lugar de los botones debajo de la espera del planeador);
  desde un grupo de una organización sólo se ve a su gente; la asistencia señala los días pasados
  sin capturar y resume quién conserva el derecho a examen; «Aplicar el examen» abre el grupo que presenta hoy. Prueba:
  `npm run volumen`.
- «Grupos» paso a paso (decisión del 2026-10-24, opción B1; sustituye al planeador y a «Programar un curso» de las
  propuestas A y B del 18/10): un curso empieza al menos 7 días después de confirmarlo; como máximo 2 grupos al mismo
  tiempo, de cualquier curso (P149: cada semana dice cuántos lugares le quedan); de lunes a viernes (P151); los días
  inhábiles se marcarán cuando la Secretaría publique su calendario (P150). «Completar con las N que más esperan» toma
  bloques de organización completos: si un bloque no cabe, se salta y sigue el siguiente.
- Nombre calculado (`APD.nombreGrupo`, `APD.grupoTitulo`): «Poda nueva · del 13 al 17 de octubre · Iztapalapa»; 1 día,
  «Poda renovación · 3 de noviembre»; sin fecha, «Poda nueva · sin fecha»; el año sólo si no es el actual. Cursos cortos:
  «Poda nueva», «Poda renovación», «Dictaminación nueva», «Dictaminación renovación» (`APD.cursoCorto`); completos:
  «Poda y derribo · nueva», «Dictaminador técnico · renovación» (`APD.cursoLargo`). El folio no cambia y va en chico
  debajo. En «Mis trámites», sólo con el grupo confirmado.
- Quién arma los grupos: el perfil de revisión y cotejo (23/10/2026, P92), que ya no elige instructor ni confirma. La
  persona instructora la asigna o la cambia, también durante el curso, y el grupo lo confirma el área de Instructores y
  Capacitación con su perfil «capacitación» (ajustes del equipo, 25/10/2026; la base: `perfiles_asignan_instructor`, con
  administración, que ya podía hacerlo todo). Sólo las instituciones de gobierno tienen grupo propio
  (`grupo_propio_sin_gobierno`). Horarios: P91.
- La base lo vuelve a aplicar: `apd.grupo_cambio`, `apd.inscripcion_alta`, `apd.inscripcion_cambio`, `apd.asistencia_captura`.
  En la prueba, lo hecho se guarda en el navegador («apd.personal.grupos») y `app/archivos-prueba.js` lo aplica como la base.

## 2d. Avisos y confirmaciones (decisión del 2026-10-17, versión 0.37; con el estándar 1.4.1 desde el 2026-10-18 y la 1.5.1 desde el 2026-10-19)

- Desenlace de cada acción del personal con el módulo `resultado` del estándar (`FormKit.resultado`: tono, título, hora,
  quién, motivo y pasos; P113): revisión (validada, con observaciones, rechazada por perfil), cotejo (terminado, en
  pausa, con observaciones, otra cita, no se presentó, cerrado, no es la persona), corrección y material de estudio. En
  la revisión, «Revisar la siguiente» con la que sigue en la bandeja.
- Confirmación con `FormKit.confirma` (consecuencias, irreversible, `si`; P113-P114) en rechazar por perfil, cerrar la
  solicitud, no es la persona, crear un grupo combinado, reponer un código, enviar el examen y ocultar un documento del
  material de estudio. Dar de baja, cancelar un grupo y suspender un examen usan su propio diálogo, porque piden motivo.
- Avisos con `FormKit.aviso`, también los que llevan pasos o enlaces (estándar 1.4.2, P131; `APD.pintaAviso` sólo vacía
  y muestra el contenedor y traduce el tono del proyecto), en grupos (paso a paso y grupos programados), asistencia,
  aplicar el examen, citas, cotejo, datos, verificar, entrar y «Mis trámites»; el error de una acción sin elegir o sin marcar se ve junto a los
  botones y señala en rojo las filas que faltan.
- Líneas de datos (folio · fechas · revisión) con `.linea-datos` del estándar (1.4.4, P134; `APD.lineaDatos`): en la
  revisión documental, el cotejo, la ficha del grupo, «Asistencia», lo elegido en el paso a paso de «Grupos» y «Mis
  grupos de hoy».
- Etiquetas con `APD.estado`, que delega en `FormKit.estado` (P118), y `APD.estadoSolicitud` y `APD.nombrePersonal`, en
  todas las bandejas y fichas.
- Examen: «Aprobaste» / «No aprobaste» con icono, calificación y mínimo; el aviso del último minuto se ve junto al reloj.
- «Qué sigue» en `ol.secuencia` (`APD.sigueEn`, P119) cuando son dos o más acciones en orden: cotejo terminado, en
  pausa y con observaciones; revisión con observaciones; corregir; grupo creado y grupo que dejó de estar confirmado;
  examen aprobado; y en «Mis trámites», cita asignada, cita sin pago, cita en pausa, espera de grupo, aprobada y
  acreditación lista.

## 2e. Dos pestañas, dos personas a la vez y doble clic: lo que la API de la etapa 3 debe garantizar (bloque 2, 2026-10-19)

La versión de prueba ya se comporta así (`app/archivos-prueba.js` aplica las reglas de la base al mezclar; cada pantalla
vuelve a leer antes de guardar y comprueba después). La API tiene que dar lo mismo, porque la pantalla ya no supone nada:

- **Sesión.** Todo guardado a nombre de la persona lleva la persona que la página espera (`solicitante_id` con que se
  cargó). La API la compara con la de la cookie: sin sesión, 401; otra persona, 409 `sesion_cambio`; en los dos casos no
  guarda nada. Lo mismo el personal con su usuario del SIA (en la prueba no hay sesión del personal que cambie).
- **Versión de lo que se decide.** Cada decisión del personal lleva sobre qué la tomó y la API la rechaza con 409 si ya
  cambió, sin guardar nada:
  - revisión: la solicitud (`estado` y `estado_desde`, o una versión) y los documentos vigentes que se vieron (id de cada
    carga): si la persona reenvió o ya hay otra revisión, 409 `conflicto` («La solicitud cambió desde que la abrió»);
  - cotejo: la cita (`id` o `programada_en`), su resultado de partida (pendiente o en pausa) y, al retomar, `pausada_en`:
    409 `cita_cerrada` o `cita_transicion` (una cita en pausa no pasa a «no se presentó» ni a «no era la persona»);
  - grupos: el grupo y su estado; confirmar vuelve a revisar cupo mínimo, anticipación y datos (`apd.grupo_cambio`).
- **Transiciones.** Las de la base (`docs/REGLAS.md`): un reenvío sólo desde `borrador` o `con_observaciones`
  (`transicion_invalida`); una carga sólo en su turno (`carga_fuera_de_turno`).
- **Unicidad y números que asigna la base.** Una solicitud activa por persona y tipo (`solicitud_activa`; el 23505 del
  índice `solicitud_una_activa`, si dos altas llegan a la vez, se responde con el mismo mensaje); folio de solicitud y de
  grupo (`apd.siguiente_folio`) y número de expediente (`apd.asignar_expediente`, al terminar el cotejo): la API devuelve
  el asignado y la pantalla sólo muestra ése, nunca uno calculado al abrir; folio fiscal único (`folio_fiscal_repetido`,
  422 con `errores: [{ campo: 'factura_folio_fiscal', mensaje }]`, que el núcleo pinta junto al campo).
- **La respuesta es lo que quedó.** La API responde con el estado resultante y la pantalla dice eso, no lo que pidió:
  agregar a un grupo devuelve a quién inscribió y a quién no, con su razón (`solicitud_no_lista`, `cupo_maximo`,
  `otra_organizacion`, `grupo_cerrado`); confirmar devuelve el estado del grupo; el cotejo, el expediente asignado.
- **Doble clic e idempotencia.** Los formularios del estándar mandan `Idempotency-Key` (la misma mientras no se logre
  enviar); los botones propios que guardan también deben mandarla, y la API responde a un repetido con la primera
  respuesta. La pantalla, además, deshabilita el botón mientras guarda (`APD.ocupa`).
- **Forma del rechazo.** `{ codigo, mensaje, errores?: [{ campo, mensaje }] }`; la pantalla lo pinta en su aviso de envío
  con un enlace para volver a abrir lo que cambió (`APD.rechazo` y `APD.muestraRechazo` en la prueba).

## 2 bis. Visor de documentos

El módulo `visor` del estándar (desde la 1.2.0, P67; antes `app/visor.js`, del que salió) muestra todas las hojas del PDF
con pdf.js 4.10.38 del propio estándar (copiado en `vendor/pdfjs-dist/`, sin CDN; el visor lo encuentra solo junto a `formkit/` desde la 1.3.2, P96): contador de hoja,
acercar y alejar, ajustar al ancho, girar y abrir en otra pestaña. En computadora (≥1024 px) queda fijo a la derecha y
abre de entrada el primer documento (el comprobante de estudios si hay que decidir el perfil); en pantalla chica se abre a
pantalla completa. Al aceptar un documento, el visor y la lista pasan al siguiente sin decidir; con todo decidido, la
página baja al resultado. PDF ficticios: `herramientas/documentos-ficticios.py`.

Prueba sin servidor: todo el recorrido se guarda en ese navegador (`app/archivos-prueba.js`: cuentas, fotografías,
solicitudes y documentos en IndexedDB; sesión, cambios de perfil y revisiones en localStorage) y `APD.cargar()` lo suma a
los ficticios en todas las pantallas. Lo enviado en la prueba va primero en la bandeja; la revisión muestra la fotografía
de la persona y el visor el archivo real. Se quita en la etapa 3 junto con el acceso simulado.

## 3. Formulario y servidor

La revisión es un formulario del estándar que arranca a mano (`data-formkit="manual"`) cuando la página ya calculó sus
datos calculados (`<input type="hidden" data-auxiliar>` del estándar 1.1.0): `perfil_revision`, `revisar_<requisito>`
(documento cargado y sin rechazo por perfil), `decidir_<requisito>` (se pide su decisión salvo que se haya aceptado antes y no haya cambiado) y `resultado`; el servidor los calcula con `validaPayload(…, { auxiliares })`.
Los motivos frecuentes de cada observación son `data-chips-fijos` (módulo `chips`, P65). Los textos del estándar se
ven en usted (`app/mensajes-usted.js`, todos en `mensajes` desde la 1.3.2). Los siete bloques de documentos se
generan del catálogo de requisitos en `herramientas/construir-sitio.mjs` (marcadores `revision-documentos` y
`revision-auxiliares`). Módulos del estándar: `opciones`, `modal` (`FormKit.confirma` para rechazar), `chips`, `visor` y `tabla`
(bandeja). El esquema del servidor es `db/esquemas-formularios/revisar.json`; `herramientas/probar-esquemas.mjs` lo
prueba con el cálculo de los auxiliares que hará la API (17 casos).

El cotejo sigue el mismo patrón: auxiliares `pedir_llegada`, `pedir_identidad`, `pedir_documentos`, `cotejar_<requisito>`,
`pedir_hoy`, `pedir_pago`, `pedir_factura` y `resultado`; bloques generados entre los marcadores `cotejo-documentos` y
`cotejo-auxiliares` (y `corregir-*` para la corrección de la persona). Formato `folio-fiscal` del
estándar (1.3.0, P82). Esquemas `cotejo.json` y `corregir.json` (19 casos). El examen tiene dos formularios del estándar: «Entra a tu examen» (formato propio `codigo-examen`, `app/codigo-examen.js`) y «Suspender el examen» (diálogo en `aplicar.html`); esquemas `examen-entrar.json` y `examen-suspender.json` (6 casos). Las condiciones van en `div[data-si]`; desde la 1.3.0
la herramienta del esquema las lee en cualquier etiqueta (P81) y los `div` se quedan.

Grupos: cuatro formularios del estándar en `grupos.html` y `grupo.html`, que arrancan a mano después de pintar la
página (`data-formkit="manual"`): armar un grupo (el paso a paso «armar», desde el 24/10/2026: curso de la lista de los
cuatro, primer día y tipo de grupo; desde los ajustes del equipo del 25/10/2026 sin instructor: un `instructor` enviado se
rechaza como campo no declarado), asignar la persona instructora y confirmar (sólo la persona instructora, de la lista
cerrada: la semana es la que eligió quien armó el grupo y un `fecha_inicio` enviado se rechaza; lo usa el área de
Instructores y Capacitación; la hora de entrada no va en el formulario: la API la toma de `curso_hora_entrada`, decisión
de Liber del 24/10/2026, y rechaza un `hora_entrada` enviado), dar de baja y cancelar (motivo).
Esquemas `grupo-crear.json` (del formulario «armar» de `grupos.html`; antes, desde el bloque 74, del formulario «programar» de `programar.html`),
`grupo-confirmar.json` (asignar o cambiar la persona instructora y confirmar), `grupo-baja.json` y `grupo-cancelar.json`
(17 casos). Lo que guarda «Grupos» son los eventos de siempre (crear, agregar) y `proponer` (primer día y hora de un grupo
por confirmar, que la base ya admite); la ficha de Capacitación guarda `instructor` y `confirmar`, con el perfil, y la
simulación de la base los rechaza sin él. Elegir personas de la espera y capturar la asistencia son
acciones sobre listas, no formularios de datos: la base las revisa (`apd.inscripcion_alta`, `apd.asistencia_captura`).

Cancelación y reposición (sesión de trabajo del 23/10/2026): cuatro formularios del estándar, que arrancan a mano. En
`acreditacion.html`: cancelar (diálogo; motivo y fundamento), revisar el acta (decisión y, con observaciones, qué
corregir) y entregar la credencial repuesta (factura con los formatos `rfc` y `folio-fiscal`); en `reposicion.html`, el de
la persona (motivo y acta). Esquemas `acreditacion-cancelar.json`, `reposicion-acta.json`, `reposicion-entrega.json` y
`reposicion.json` (14 casos). En la prueba, lo registrado va en «apd.acreditaciones» (una lista de eventos) y el acta en
IndexedDB; `app/archivos-prueba.js` (`aplicaAcreditaciones`) lo aplica como la base.

## 4. Lo que falta

- Cancelación: causas, audiencia, notificación y si se puede volver a solicitar (P120, Dirección Jurídica). Reposición:
  monto vigente de la cuota y horario para recogerla (P140, Finanzas).
- Cuentas y perfiles del personal en el SIA (P27); plazos de la espera (P02); dirección del Vivero Nezahualcóyotl (P68);
  motivos frecuentes y quién fija la fecha (P64).
- Visor de documentos: en la prueba muestra el archivo cargado en el navegador o un PDF ficticio por requisito; en la etapa 3 la API entrega el archivo de cada solicitud.
- Siguiente pantalla: emisión y entrega el mismo día (P10). Grupos: horarios (P91). Las cuentas reales del perfil
  «capacitación» van con las demás del personal en el SIA (P27). Examen: tablas en la base y API (etapa 3), banco real (P74), regla con la práctica (P83), redondeo (P88) y tiempo adicional (P89).
- Cotejo: aviso a la Dirección y desbloqueo (P79); tarea nocturna de pausas vencidas (P80); duración y cupo de las citas (P69; el horario, de 9:30 a 14:30 de lunes a viernes, ya está).
- Registro asistido (25/10/2026): recordatorios por fecha por teléfono (P207), persona del padrón de Kobo que no sabe leer
  (P208), qué hacer con «No contestó» (P209), avisos de lo que pasa con la persona presente (P210), la declaración de
  quien no sabe firmar (P211), lo que se vuelve a pedir al activar la cuenta (P212) y la carga en ventanilla de una cita
  en pausa (P213). El teléfono de informes del acuse es P132.
- Hallazgos del estándar abiertos (siguen en la 1.5.1): P152 (fecha pegada como AAAA-MM-DD), P153 (PDF con contraseña y
  foco al cargar), P154 (total de 25 MB con un solo archivo y redondeo del peso), P155 (`maxlength` antes de limpiar lo
  pegado), P156 (el combo libre ignora `data-formato`), P157 (`botonEnviar` sólo bloquea el primer botón), P158 (rechazo
  del servidor sin errores por campo) y P166 (foto enorme leída antes de revisar su peso). Los resolvió la 1.5.1 (o una
  anterior) y el proyecto quitó sus soluciones provisionales: P126 a P131, P134, P135 y P145 a P148.
