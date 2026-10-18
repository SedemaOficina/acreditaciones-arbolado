# Etapa 2 · Pantallas del personal de la Secretaría

Se les habla de usted. Cada pantalla se muestra primero como maqueta (`maquetas/`) y, aprobada, se construye en el
sitio con sus pruebas (decisiones del 2026-10-16). Acceso simulado mientras no haya cuentas del personal (P27).

## 1. Pantallas

| Pantalla | Archivo | Qué hace |
|---|---|---|
| Solicitudes por revisar | `sitio/revision.html` · `app/revision.js` | Bandeja de las solicitudes enviadas, de la que más espera a la más reciente. Búsqueda por nombre, CURP, folio de la solicitud o número de expediente; filtros por acreditación, nueva o renovación y vuelta de revisión (plegados en teléfono bajo «Filtrar»). Señala carrera por clasificar, perfil que podría no cumplir y documentos corregidos |
| Revisar una solicitud | `sitio/revisar.html?folio=…` · `app/revisar.js` | Datos de la persona y de la solicitud, revisiones anteriores, perfil del dictaminador, documentos (aceptar u observar, con motivos frecuentes) y resultado: validar con cita, enviar observaciones o rechazar (con confirmación) |
| Citas de cotejo | `sitio/citas.html` · `app/citas.js` | Agenda del día por hora (sede única), con la situación de cada cita: por atender, en pausa, documento cargado (retomar), atendida con su expediente, no se presentó, sin pago, regresó con observaciones, no era la persona. Día anterior y siguiente con citas; la búsqueda (nombre, CURP, folio o expediente) busca en todos los días |
| Atender una cita de cotejo | `sitio/cotejo.html?folio=…` · `app/cotejo.js` | Llegada; identidad (es la persona de la fotografía o no); cotejo de cada documento contra lo que cargó (visor); pago; factura. Resultado: terminar (abre el expediente), pausa, regresar con observaciones, otra cita (sin pago o primera inasistencia), cerrar (segunda inasistencia) o no atender (no es la persona). Retomar una pausa coteja sólo lo que no coincidió |
| Cargar el documento correcto (persona) | `sitio/corregir.html?folio=…` · `app/corregir.js` | Con la cita en pausa, la persona carga ese mismo día el documento que no coincidió; se pide sólo ése |
| Grupos | `sitio/grupos.html` · `app/grupos.js` | La espera de cada uno de los cuatro cursos (cuántas personas, cuántas esperan más de 31 días, renovaciones con la acreditación vencida, si alcanza para un grupo y el grupo que se está armando) y los grupos, de los que están en curso a los cerrados, con integración, cupo, inicio, instructor y situación |
| En espera de un curso | `sitio/espera.html?curso=…` · `app/espera.js` | Personas en espera de un curso, de la que más espera a la más reciente (en renovación, por la fecha en que vence su acreditación). Se eligen y se agregan a un grupo que recibe personas, o se crea un grupo nuevo con ellas: específico (si todas son de la misma organización) o combinado |
| Un grupo | `sitio/grupo.html?folio=…` · `app/grupo.js` | Situación, cupo y personas. En integración: agregar de la espera, dar de baja (con motivo), confirmar con primer día (7 días de anticipación), hora de entrada (lista cerrada de 24 horas) e instructor, o cancelar (con motivo). Confirmado: agregar hasta el día anterior al inicio y dar de baja; si queda por debajo del mínimo regresa a integración con su fecha. En curso: asistencia y examen |
| Asistencia (instructor) | `sitio/asistencia.html` · `app/asistencia.js` | Perfil simulado «instructor». Un botón por día: se capturan los días que ya pasaron, del primero al penúltimo, y se corrigen mientras el curso siga; «Asistió» o «Faltó» a cada persona, con su fotografía; no se guarda con alguien sin marcar. Avisa a quién ya no puede faltar y a quién ya no le alcanza para el examen. El último día se registra al pasar lista en el examen (P94) |
| Aplicar el examen | `sitio/aplicar.html` · `app/aplicar.js` | Quien aplica el examen (perfil simulado «instructor»): grupo en curso con fecha (último día) y lugar (salón de cómputo del PILARES), personas con su asistencia y derecho a examen, pase de lista con la fotografía de cada persona («Presente» genera su código; «No llegó»; «Llegó: marcar presente»), avance al momento (sin empezar, contestando con cuántas lleva y el tiempo, calificación al enviar, suspendido, veces que salió de la ventana), reponer un código, suspender con motivo e imprimir papeletas con los códigos |
| Examen en línea (persona) | `sitio/examen.html` · `app/examen.js` | En las computadoras del salón, sin cuenta: entrar con el código → ¿eres tú? → instrucciones → una pregunta por pantalla (reloj, avance, mapa de preguntas, marcar para revisar) → revisar y enviar → calificación y qué sigue. Una recarga o el cambio de computadora vuelven al examen con lo contestado. Las preguntas de un caso (enunciado y tablas compartidos, como los ejercicios de valoración del examen de poda) salen juntas y en orden, con el caso arriba de cada una |
| Lo común del examen | `app/examen-servidor.js` · `app/examen-grupo.js` · `app/codigo-examen.js` · `datos/examen-ficticio.js` | Servidor simulado del examen (códigos, orden por persona, respuestas, tiempo, calificación, suspensión, reposición), quién presenta el examen de un grupo, formato propio del código y banco ficticio (24 preguntas sobre el propio trámite; el real nunca entra al repositorio, P85) |
| Lo común | `app/personal.js` | Perfil ficticio «revisión y cotejo», cabecera del personal, espera y vuelta de cada solicitud, citas de cotejo y su situación, siguiente expediente, decisiones de la prueba en el navegador |

En el menú de pruebas, «Entrar como» → «Personal de la Secretaría» lleva a la bandeja; también está en «Ir a otra pantalla».

## 2. Reglas de la revisión

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

- Pase de lista en el salón de cómputo: fotografía de cada persona, «Presente» (genera su código; hoy el prototipo
  también registra la asistencia del último día, por confirmar: P94) o «No llegó» (si llega después, se marca presente). Sin derecho a examen: no se le pasa lista.
- La persona entra sólo con su código de un solo uso (P78, aprobado por Liber en el bloque 49), no con su cuenta; «¿Eres tú?» muestra su nombre y su
  fotografía. Un código perdido se repone; el anterior deja de servir y el examen sigue igual. Un código se abre en una
  sola computadora a la vez; el intento en otra se le cuenta a quien aplica.
- Orden de preguntas y opciones distinto por persona y fijo para ella. Cada respuesta se guarda al elegirla; se puede
  cambiar hasta enviar. El tiempo corre desde «Empezar» en el servidor; al agotarse se envía lo contestado. Una
  pregunta sin contestar cuenta como incorrecta.
- Calificación del servidor: aciertos / preguntas × 10, un decimal, sin redondear hacia arriba (P88). Queda en
  `apd.examen` con origen `examen_web` y no se modifica (R37).
- Suspender pide motivo (la persona lo lee). Salir de la ventana no bloquea; se le cuenta a quien aplica.
- Parámetros de prueba: 12 preguntas, 60 minutos (P74). Tiempo adicional por fallas: P89.
- Construido sin maqueta previa porque Liber pidió el prototipo funcional; Liber aprobó su funcionamiento el 2026-10-17 (P101).
- En la etapa 3 hacen falta en la base: el banco de reactivos (sin exponer la clave), los códigos con su orden y
  tiempo, y las respuestas con su hora; la API del módulo hace lo que hoy simula `app/examen-servidor.js` (P29).

## 2c. Reglas de grupos y asistencia (maqueta aprobada y decisiones del 2026-10-17)

- Los cuatro cursos nunca se mezclan. Un grupo nace en integración; se confirma con al menos 5 personas (ningún grupo
  abre con menos), con primer día al menos 7 días después de confirmar (`dias_anticipacion_grupo`), hora de entrada
  (`apd.grupo.hora_entrada`, la misma todos los días; P91) e instructor. Recibe hasta 25.
- Específico (una organización) o combinado (cualquier mezcla de organizaciones e independientes). Si una organización
  no llega a 5, sus personas van a un grupo combinado.
- A un grupo confirmado se agregan personas hasta el día anterior al inicio, sin pasar de 25.
- Dar de baja y cancelar piden motivo; las personas regresan a la espera con su antigüedad. Si una baja deja a un grupo
  confirmado por debajo del mínimo, regresa a integración y conserva su fecha, hora e instructor como propuesta (propuesta
  de Claude, bloque 53; la base lo hace sola).
- Asistencia: la captura el instructor, día por día, sólo de los días que ya ocurrieron; se corrige mientras el curso
  siga y no haya examen. El último día se registra al pasar lista en el salón de cómputo, no en el aula (P94, por
  decidir; opción recomendada), para no capturarlo dos veces.
- Quién arma los grupos: P92 (hoy, el perfil de revisión y cotejo). Horarios: P91.
- La base lo vuelve a aplicar: `apd.grupo_cambio`, `apd.inscripcion_alta`, `apd.inscripcion_cambio`, `apd.asistencia_captura`.
  En la prueba, lo hecho se guarda en el navegador («apd.personal.grupos») y `app/archivos-prueba.js` lo aplica como la base.

## 2d. Avisos y confirmaciones (decisión del 2026-10-17, versión 0.37)

- Desenlace de cada acción del personal (`APD.pintaDesenlace`): revisión (validada, con observaciones, rechazada por
  perfil), cotejo (terminado, en pausa, con observaciones, otra cita, no se presentó, cerrado, no es la persona) y
  corrección. Lleva tono, icono, título con el resultado, hora y quién, motivo citado y, en la revisión, «Revisar la
  siguiente» con la que sigue en la bandeja.
- Confirmación (`APD.confirma`) en rechazar por perfil, cerrar la solicitud, no es la persona, dar de baja, cancelar un
  grupo, crear un grupo combinado, reponer un código, suspender y enviar el examen.
- Avisos con título (`APD.aviso`, `APD.pintaAviso`) en grupos, asistencia, espera, aplicar el examen, datos, verificar,
  entrar y «Mis trámites»; el error de una acción sin elegir o sin marcar se ve junto a los botones y señala en rojo las
  filas que faltan.
- Etiquetas por familia (`APD.estado`, `APD.estadoSolicitud`, `APD.nombrePersonal`) en todas las bandejas y fichas.
- Examen: «Aprobaste» / «No aprobaste» con icono, calificación y mínimo; el aviso del último minuto se ve junto al reloj.

## 2 bis. Visor de documentos

El módulo `visor` del estándar (desde la 1.2.0, P67; antes `app/visor.js`, del que salió) muestra todas las hojas del PDF
con pdf.js 4.10.38 del propio estándar (copiado en `vendor/pdfjs-dist/`, sin CDN; ruta en `FORMKIT_CONFIG.visor.pdfjs`): contador de hoja,
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
(documento cargado y sin rechazo por perfil) y `resultado`; el servidor los calcula con `validaPayload(…, { auxiliares })`.
Los motivos frecuentes de cada observación son `data-chips-fijos` (módulo `chips`, P65). Los textos del estándar se
ven en usted (`app/config-usted.js`). Los siete bloques de documentos se
generan del catálogo de requisitos en `herramientas/construir-sitio.mjs` (marcadores `revision-documentos` y
`revision-auxiliares`). Módulos del estándar: `opciones`, `modal` (`FormKit.confirma` para rechazar), `chips`, `visor` y `tabla`
(bandeja). El esquema del servidor es `db/esquemas-formularios/revisar.json`; `herramientas/probar-esquemas.mjs` lo
prueba con el cálculo de los auxiliares que hará la API (14 casos).

El cotejo sigue el mismo patrón: auxiliares `pedir_llegada`, `pedir_identidad`, `pedir_documentos`, `cotejar_<requisito>`,
`pedir_hoy`, `pedir_pago`, `pedir_factura` y `resultado`; bloques generados entre los marcadores `cotejo-documentos` y
`cotejo-auxiliares` (y `corregir-*` para la corrección de la persona). Formato `folio-fiscal` del
estándar (1.3.0, P82). Esquemas `cotejo.json` y `corregir.json` (19 casos). El examen tiene dos formularios del estándar: «Entra a tu examen» (formato propio `codigo-examen`, `app/codigo-examen.js`) y «Suspender el examen» (diálogo en `aplicar.html`); esquemas `examen-entrar.json` y `examen-suspender.json` (6 casos). Las condiciones van en `div[data-si]`; desde la 1.3.0
la herramienta del esquema las lee en cualquier etiqueta (P81) y los `div` se quedan.

Grupos: cuatro formularios del estándar en `espera.html` y `grupo.html`, que arrancan a mano después de pintar la página
(`data-formkit="manual"`): crear un grupo (específico o combinado), confirmar (primer día, hora de entrada de una lista
cerrada e instructor), dar de baja y cancelar (motivo). Esquemas `grupo-crear.json`, `grupo-confirmar.json`,
`grupo-baja.json` y `grupo-cancelar.json` (10 casos). Elegir personas de la espera y capturar la asistencia son
acciones sobre listas, no formularios de datos: la base las revisa (`apd.inscripcion_alta`, `apd.asistencia_captura`).

## 4. Lo que falta

- Cuentas y perfiles del personal en el SIA (P27); plazos de la espera (P02); dirección del Vivero Nezahualcóyotl (P68);
  motivos frecuentes y quién fija la fecha (P64).
- Visor de documentos: en la prueba muestra el archivo cargado en el navegador o un PDF ficticio por requisito; en la etapa 3 la API entrega el archivo de cada solicitud.
- Siguiente pantalla: emisión y entrega el mismo día (P10). Grupos: cambiar el instructor de un grupo confirmado o en
  curso (la base ya lo permite), quién arma los grupos (P92) y horarios (P91). Examen: tablas en la base y API (etapa 3), banco real (P74), regla con la práctica (P83), redondeo (P88) y tiempo adicional (P89).
- Cotejo: aviso a la Dirección y desbloqueo (P79); tarea nocturna de pausas vencidas (P80); días, horario y cupo de citas (P69).
- Hallazgos del estándar abiertos: P90 (esquema con controles fuera del formulario), P95 (mensajes de formatos fuera de
  «mensajes»), P96 (ruta de pdf.js), P97 (nombre del grupo de chips), P98 (dos «Mostrar» con el mismo nombre) y P99 (el
  combo abre su lista cuando la página llena el campo).
