# Auditoría C · Textos del sitio de acreditaciones (2026-10-17)

**Alcance.** Revisé el texto visible de 89 pantallas y estados. Usé Playwright a 1280 px y a 390 px. Recorrí:

- 5 pantallas públicas;
- 20 casos del «Menú de pruebas», cada uno en «Mis trámites», «Mi perfil» y «Solicitud»;
- todas las pantallas del personal.

Además provoqué unos 60 estados de error y de resultado:

- envíos vacíos;
- `?simular=error|limite|lento`;
- la verificación con varios números;
- la revisión validada, con observaciones y rechazada;
- el cotejo: no se presentó, en pausa, no es la persona y factura;
- los grupos: crear, dar de baja, cancelar y confirmar;
- la asistencia, el pase de lista y el código del examen;
- «Cargar el documento correcto».

También leí el código fuente: `sitio/*.html`, `sitio/app/*.js`, `config-usted.js`, `db/apd/03-apd-reglas.sql` (128 mensajes) y `docs/AVISOS-POR-CORREO.md`.

**Limitaciones.**
- No llegué a enviar la solicitud completa ni al resultado del examen: en el paso 2 el menú no adjunta archivos. Esos textos los leí en el código fuente (`solicitud.html:589-597` y `examen.js:246-256`).
- Durante la auditoría el sitio pasó de la versión 0.39 a la 0.40. Lo renderizado es de la 0.39; las citas de archivo y línea son del código actual.

Los guiones y las capturas de esta revisión no se guardaron en el repositorio. No se modificó nada del repositorio.

---

## 1. Trato: «tú» para la persona solicitante y «usted» para el personal

| Texto actual | Dónde | Problema | Texto propuesto |
|---|---|---|---|
| «Escribe al menos 10 caracteres; van 5.» | revisar (observación de un documento y motivo del rechazo), cotejo («¿Qué no coincide?» y «¿Qué observó?»). Viene del formato `texto` de `formkit/js/validaciones.config.js:331` | Mensaje en tú en una pantalla del personal. `config-usted.js:42` sólo convierte los formatos `fecha`, `hora`, `rfc`, `folio-fiscal` y `numero`. Todo `textarea` usa el formato `texto` (`formkit.core.js:368`), así que **sí se puede cambiar por configuración**. Esto matiza lo que dice P95 | Agregar `'texto'` a la lista de `config-usted.js:42` y ampliar `enUsted` con `Usa → Use` y `Descríbelo con tus palabras → Descríbalo con sus palabras`. Resultado: «Escriba al menos 10 caracteres; van 5.» |
| Dos errores a la vez en el mismo campo: «Antes de seguir, escriba qué debe corregir la persona (al menos 10 caracteres).» y «Escribe al menos 10 caracteres; van 5.» | revisar.html, botón «Listo, ir al siguiente» con texto corto (`revisar.js:350`) | Un mensaje en usted y otro en tú, uno encima del otro | Con la corrección anterior queda uno solo: «Escriba qué debe corregir la persona: al menos 10 caracteres; van 5.» |
| «Faltan por revisar 13 campos para continuar.» / «Falta revisar 1 campo para continuar.» | Todas las pantallas de solicitante (entrar, cuenta, verificar, examen, solicitud, datos, corregir) | El personal ya ve «Para continuar, faltan 4 respuestas.» (P116, resuelto sólo en `config-usted.js:21`). La persona solicitante sigue viendo «campos». Las dos audiencias reciben textos distintos para lo mismo | En las `config-*.js` de solicitante: `resumenUno: 'Para continuar, falta 1 respuesta.'` y `resumenVarios: 'Para continuar, faltan {n} respuestas.'` |
| «Puede trabajar en el arbolado urbano con esta acreditación hasta la fecha de vencimiento.» / «Con esta acreditación no se puede trabajar…» | verificar.html, resultado (`config-verificar.js:50`) | La pantalla habla de tú a quien consulta. «Puede trabajar» se lee como usted dirigido al lector | «Esta persona puede trabajar en el arbolado urbano hasta el 14/09/2027.» / «Esta persona no puede trabajar en el arbolado urbano con esta acreditación.» |
| «Indica qué no coincidió en el cotejo» | `03-apd-reglas.sql:845` (error del personal) | El resto de los mensajes al personal van en usted («Indique», «Registre», «Cargue») | «Indique qué no coincidió en el cotejo.» |
| «Carga la fotografía tomada para la credencial…» / «Carga el comprobante de recepción firmado…» | `03-apd-reglas.sql:614, 616` (entrega, la hace el personal) | Tú en una acción del personal | «Cargue la fotografía…» / «Cargue el comprobante…» |
| «La persona escribe el código en la computadora, en «Entra a tu examen»» | aplicar.html, pasos | Correcto: cita el nombre de la pantalla de la persona. No es un error | — |

Política observada: la persona solicitante va siempre en tú y el personal en usted, salvo lo de esta tabla. Los textos que el personal escribe para que los lea la persona (motivo del rechazo propuesto, «La persona lo leerá tal como lo escriba») van en tú a propósito, y está bien.

## 2. Nombres internos del sistema y jerga

| Texto actual | Dónde | Problema | Texto propuesto |
|---|---|---|---|
| **«null»** como renglón suelto dentro del diálogo | espera.html «¿Crear un grupo combinado con N personas?»; aplicar.html «¿Reponer el código de …?»; cotejo «¿No atender a …?». La causa está en `apd.js:315`: `d.append(…, cfg.irreversible ? … : null, …)` y `Element.append(null)` escribe el texto «null» | Se ve una palabra de programación (confirmado a la vista con `getComputedStyle`) | Filtrar los nulos: `d.append(...[…].filter(Boolean))` |
| «Un grupo nuevo se crea sin confirmar («En integración»)» | `03-apd-reglas.sql:1251`; también `apd.nombre_estado`: `en_integracion → 'En integración'` (l. 45) | El estado interno sale en el mensaje. En pantalla se llama «Por confirmar» | «Un grupo nuevo se crea sin confirmar («Por confirmar»).» y `nombre_estado` → `'Por confirmar'` |
| `nombre_estado`: `concluida_sin_atender → 'Concluida sin atender'` | `03-apd-reglas.sql:43` | En pantalla se llama «Cerrada: no se corrigió a tiempo», o «Cerrada» para el personal | `'Cerrada'` |
| «El curso, el tipo de grupo (específico o combinado)…» | `03-apd-reglas.sql:1276` | En pantalla se dice «De una organización» o «grupo propio», nunca «específico» | «…el tipo de grupo (de una organización o combinado)…» |
| «La fecha de alta y la marca de dato de prueba no se cambian» / «Falta configurar el parámetro %s del sistema» / «La hora simulada sólo existe en una base de pruebas» | `03-apd-reglas.sql:371, 66, 89` | Jerga técnica y una clave interna (`%s` = `tamano_maximo_archivo_bytes`…). Si llegan a pantalla, nadie los entiende | Mensaje genérico para la persona («No se pudo guardar. Intenta de nuevo más tarde.») y el detalle sólo en la bitácora |
| «Curso que corresponde (calculado) · poda_nueva», «dictaminador_nueva», «apd.solicitud.tipo_acreditacion»… | solicitud.html, cajas amarillas `[data-interno]` | Es intencional: dice «Sólo en la versión de prueba». Lo anoto sólo para que se quite al pasar al SIA | — |
| «Los campos con * son obligatorios.» | Todas las pantallas con formulario | «campos» es jerga. Va junto con la decisión de P116 | «Las preguntas con * son obligatorias.» (requiere sobrescribir el texto de la leyenda) |
| «No se reunió el cupo mínimo en el plazo previsto; las personas regresan a la bandeja.» | grupo.html, grupo cancelado (dato de `herramientas/ficticios.mjs:430`) | «bandeja» no es el nombre de ninguna pantalla. Ahí se llama «espera» | «…las personas regresan a la espera con su antigüedad.» |
| «Siguiente en la bandeja: APD-S-2026-00047…» | revisar, resultado (`revisar.js:307`) | Igual: la pantalla se llama «Solicitudes por revisar» | «Siguiente por revisar: APD-S-2026-00047, en espera desde el 08/10/2026.» |
| «Fase 4 de 7: Bandeja y grupos» | Franja «Pantalla:» (`pruebas.js:202`) | Sólo en la versión de prueba, pero repite «bandeja» | «Espera y grupos» |
| «Motivo: La persona desistió del trámite por cambio de empleo.» | tramites.html, caso «cancelada» (dato ficticio) | Le habla en tercera persona a la propia persona. Además, «Cancelada» no dice qué sigue (`apd.js:33`, `sigue: ''`) | Motivo en segunda persona («Cancelaste tu solicitud: cambio de empleo.») y `sigue: 'Puedes iniciar una solicitud nueva cuando quieras.'` |

Atribución: en los textos de solicitante no aparece ninguna Dirección General. «Dirección» sólo sale en pantallas del personal (cotejo, revision), donde está permitido.

## 3. Avisos y confirmaciones: título, «Qué sigue» y acciones encadenadas

| Texto actual | Dónde | Problema | Texto propuesto |
|---|---|---|---|
| «Corrige lo que se indica abajo y vuelve a enviar tu solicitud.» | tramites.html, «Corrige y reenvía» (`apd.js:25`) | Lo que hay que corregir está **arriba**, en el cuadro «Lo que debes corregir» (verificado en captura a 390 px) | «Corrige lo que se indica arriba y vuelve a enviar tu solicitud.» o, mejor, sin ubicación: «Corrige cada documento de la lista y vuelve a enviar tu solicitud.» |
| «Tu cuenta está lista» → 1. «Entra con tu CURP y tu contraseña.» 2. «Inicia tu solicitud y carga tus documentos.» | cuenta.html:326-329 | Al crear la cuenta la sesión ya queda abierta (`config-cuenta.js:69`) y el botón lleva a «Mis trámites». El paso 1 sobra o confunde | 1. «En «Mis trámites», inicia tu solicitud.» 2. «Carga tus documentos en PDF y envíala.» Nota aparte: «La próxima vez entra con tu CURP y tu contraseña.» |
| «En tu cita del 21/10/2026, 10:00 un documento no coincidió con el que cargaste. Cárgalo hoy y regresa con la persona que te atiende para terminar tu cotejo.» | corregir.html, bajada (`corregir.js:24`) | Encadena 2 acciones. «Mis trámites» ya lo muestra como lista numerada | Título «Un documento no coincidió en tu cita del 21/10/2026 a las 10:00»; «Qué sigue»: 1. Carga aquí el documento correcto. 2. Regresa con la persona que te atiende, con el documento impreso. |
| «Sigues en espera de grupo con tu misma antigüedad. La Secretaría te asignará otro y te avisará las fechas.» + justo debajo «Tu cotejo terminó. Qué sigue: 1… 2… 3…» | tramites.html, caso «renov-espera» (`tramites.js:133`) | Dos bloques seguidos dicen lo mismo, uno en párrafo y otro en lista | Dejar sólo el título «Tu grupo se canceló» + «Conservas tu lugar en la espera.» y la lista «Qué sigue» de abajo |
| «Paga antes de tu cita y lleva el comprobante impreso. En la cita la Secretaría verifica tu pago y emite tu factura.» | tramites.html, «Datos para tu pago» (`tramites.js:82`) | Repite los pasos 2 y 3 de «Qué sigue», que está justo arriba. También se muestra con la cita en pausa, cuando la persona ya está en la cita | «En la cita, la Secretaría verifica tu pago y emite tu factura.» Ocultar en pausa |
| «Al terminar el curso presentas el examen en computadora y conoces tu calificación al momento. Si lo apruebas, ese mismo día recoges tu credencial: ahí te toman la fotografía que lleva y firmas el comprobante de recepción.» | index.html, «Cómo es el trámite», paso 5 | Cuatro acciones dentro de un solo punto de la lista | Separar: «5. El último día presentas el examen en computadora y ves tu calificación al momento.» «6. Si apruebas, ese mismo día te toman la foto de tu credencial, la recibes y firmas de recibido.» |
| «El pase de lista registra la asistencia del último día. Versión de prueba: … Abra la pantalla del examen en otra pestaña… Un examen por acreditación… (52 reactivos, 60 minutos)… Pendiente (P74)…» | aplicar.html:61 | Un párrafo con 5 temas distintos | Separar en tres: la regla de asistencia, la nota de prueba y el pendiente P74 |
| «Las citas del día en el Vivero Nezahualcóyotl, por hora. Cuando la persona llegue, búsquela… y presione «Atender».» | citas.html | Dos acciones en un párrafo. Aceptable, prioridad baja | — |
| Con lista «Qué sigue» correcta | revisar con observaciones, cotejo en pausa y terminado, grupo creado, «Acude a tu cita», «En espera de grupo», pausa en tramites, acreditación por recoger, acuse de la solicitud | Bien | — |
| «Validada: cita el 22/10/2026 a las 09:30» + una sola consecuencia | revisar, resultado | Bien: un solo paso | — |
| «10 personas asistieron y 0 faltaron.» | asistencia, al guardar (`asistencia.js:92`) | «0 faltaron» suena raro | Con 0 faltas: «Asistieron las 10 personas.» |
| «5 solicitudes por revisar: 2 de 3 a 9 días.» | revision.html (`revision.js:86`) | No se entiende qué son «2 de 3 a 9 días» | «5 solicitudes por revisar; 2 llevan de 3 a 9 días esperando.» |

## 4. Fechas, horas y dinero

| Texto actual | Dónde | Problema | Texto propuesto |
|---|---|---|---|
| «CREADA EL 17 de octubre de 2026, 11:22 p.m.» | cuenta.html, acuse. La misma rutina sirve a todo acuse del módulo: «Recibida el» de la solicitud y el corregir (`formkit/modulos/acuse/acuse.js:46`, `dateStyle:'long', timeStyle:'short'`) | Formato de 12 horas con «p.m.», fecha larga y **fecha real**, mientras la franja dice «fecha simulada: 14/10/2026» | «14/10/2026, 23:22». Que la página escriba la fecha con `APD.fechaHora`, o pedir al estándar `hour12:false` y DD/MM/AAAA. **Hallazgo nuevo para el estándar** (también `formkit.core.js:643`, hora del borrador) |
| «MONTO FICTICIO DE PRUEBA, vigente desde 2026-07-01. El real lo fija la Gaceta Oficial.» | tramites.html, «Datos para tu pago», visible en cuanto una solicitud se valida en la prueba (`tramites.js:79` muestra `curso.pago_fundamento`; el texto sale de `herramientas/ficticios.mjs:327`) | Fecha ISO, mayúsculas sostenidas y repite «Por confirmar: lo fija la Gaceta Oficial» de la línea de arriba | En `ficticios.mjs`: «Monto ficticio de prueba, vigente desde el 01/07/2026.» En producción, `pago_fundamento` también debe escribirse con DD/MM/AAAA |
| «$1,200.00» | tramites, cotejo | Correcto: $ y separador de miles | — |
| «Día 1 · 13/10 · capturado» | asistencia, pestañas | DD/MM sin año. Aceptable en una pestaña, porque el encabezado lleva el año completo | — |
| «Cita de cotejo: 20/10/2026, 10:00» frente a «Preséntate el 13/10/2026, a las 09:00» | tramites.html | Dos formas de escribir fecha y hora en la misma tarjeta | Unificar: «20/10/2026 a las 10:00» |
| «El archivo pasa del máximo de %s MB» con `round(…,1)` | `03-apd-reglas.sql:420, 1177` | Saldría «5.0 MB»; en pantalla se dice «5 MB» | Redondear sin decimal cuando el número es entero |

No encontré horas con segundos (HH:MM:SS) ni otras fechas ISO a la vista. `config-usted.js:55` ya convierte el límite «anterior al AAAA-MM-DD» (P112) para el personal.

## 5. Vocabulario y nombres de pantalla

| Texto actual | Dónde | Problema | Texto propuesto |
|---|---|---|---|
| «Llenas tu solicitud y cargas tus documentos **en PDF o en foto**.» | index.html:50 | **Contradice** la sección «Requisitos» de la misma página («sólo en PDF») y la solicitud («Si tienes una foto del documento, conviértela a PDF») | «Llenas tu solicitud y cargas tus documentos en PDF (puedes escanearlos con tu teléfono).» |
| Acreditación ↔ credencial: «Recoge tu acreditación en persona» (`apd.js:30`), «La recogiste el 22/09/2026» (`tramites.js:162`), «recoges tu credencial» (index), «Tu credencial se entrega hoy mismo» (examen), «Sigue la entrega de credenciales» (aplicar.html:52), «Viene impreso en la acreditación» y luego «tal como aparece en la credencial» (verificar.html:35 y `config-verificar.js:34`) | Varias | El mismo objeto físico se llama de dos formas. En verificar cambia de nombre entre la ayuda y el error | Regla: «acreditación» es el permiso (número, vigencia) y «credencial» la tarjeta que se recoge. Entonces: «Recoge tu credencial en persona», «Recogiste tu credencial el 22/09/2026» y, en verificar, «Viene impreso en la credencial» |
| «Emitida el / Vence el» (Mis acreditaciones) frente a «Inicio de vigencia / Fin de vigencia» (tarjeta de la solicitud) | tramites.html, caso «acreditada»: **la misma acreditación PD-2026-0006 en la misma pantalla** (`tramites.js:161`) | Dos pares de nombres para las mismas fechas | Usar «Emitida el / Vence el» en los dos lugares |
| «Solicitudes por revisar» (título de la pantalla y `revisar.js:295`) frente a «Revisión documental» (menú y `cotejo.js:298`, «aparece de nuevo en «Revisión documental»») | revisar y cotejo | Dos nombres para la misma pantalla entre comillas latinas | Igualar el menú y el título. Propuesta: el menú dice «Solicitudes por revisar» o el título dice «Revisión documental»; y los dos desenlaces citan el mismo nombre |
| «En espera de un curso» (franja) / «En espera · Poda y derribo · nueva» / «Personas en espera de grupo» / «Ver la espera» / «bandeja» | espera.html, grupos.html, grupo.html | Cinco nombres para la misma lista | «Espera de grupo» en todos: título «Espera de grupo · Poda y derribo · nueva» |
| «Sede» (tramites, grupo asignado) / «Lugar de la cita» / «Lugar del curso» / «Dónde recogerla» | tramites, grupo | «Sede» sólo aparece en un lugar | «Lugar del curso» en tramites, igual que en grupo.html |
| «trámite nuevo, con su pago» (`tramites.js:172-173`) / «solicitud nueva» (`apd.js:31-32`, código sin uso para esos estados) / «inicia una solicitud nueva desde tu cuenta, con su pago de derechos» (`examen.js:255`) | tramites, examen | Tres frases para lo mismo | «Para intentarlo de nuevo, inicia una solicitud nueva; se paga de nuevo.» en todas |
| «27 preguntas · 60 minutos» (fila Examen) frente a «el de poda y derribo se aplica completo, como el cuadernillo vigente (52 reactivos, 60 minutos)» | aplicar.html, misma pantalla | Número distinto (por ser ficticio) y «preguntas» frente a «reactivos» | «… (52 preguntas en el examen real; aquí, 27 preguntas ficticias)» |
| «el área la define» (grupo P91, cotejo y revisar P69) frente a «que fije la Dirección» (revision P02) | personal | Mismo responsable con dos nombres | Un solo nombre: «la Dirección» |
| «Recibimos tu solicitud» (solicitud.html:589), «Encontramos acreditaciones anteriores» (cuenta.html:325), «te sugerimos» (solicitud.html:130), «no podemos recibir más envíos» (`envioLimite` del estándar) | solicitante | Primera persona del plural, cuando el resto atribuye todo a «la Secretaría» | «La Secretaría recibió tu solicitud», «Tienes acreditaciones anteriores con esta CURP», «Al escribir aparecen las carreras ya registradas», `envioLimite`: «Por ahora no se pueden recibir más envíos desde este equipo…» |
| «ABC no está registrada» | verificar con «abc» | Un número con formato inválido se trata como «no registrada» | Validar el formato (PD- o DT-AAAA-NNNN): «Escribe el número como aparece en la credencial. Ejemplo: PD-2026-0001.» |
| «Elige la acreditación. Si es tu primera vez o una renovación lo sabe el sistema por tu historial…» | solicitud.html, paso 1 | Falta la coma y dice «el sistema» | «Elige la acreditación. Si es por primera vez o una renovación, se sabe por tu historial y te lo indicamos al elegir.» (o «…la Secretaría…») |

Mayúsculas de los nombres entre comillas latinas: revisé los 43 nombres distintos y no hay variantes de mayúsculas. «Mis trámites», «Mi perfil», «Aplicar el examen», «Asistencia», «Entra a tu examen» y «Menú de pruebas» son siempre iguales. El único conflicto es «Solicitudes por revisar» frente a «Revisión documental», que ya está arriba.

## 6. Ortografía, erratas, espacios e inglés

| Texto actual | Dónde | Problema | Texto propuesto |
|---|---|---|---|
| «null» | Diálogos de confirmación (ver §2) | Palabra de programación | — |
| «Motivo: Las observaciones no se atendieron en el plazo» | tramites, caso «sin-atender» | Le falta el punto final y repite la línea de arriba («Las observaciones no se atendieron a tiempo») | Quitar el renglón «Motivo» cuando repite lo de arriba |
| «Pendiente: plazo de revisión» | solicitud.html:599, acuse | Le falta el punto final y el número de pendiente | «Pendiente (P02): plazo de la revisión.» |
| Mensajes de `03-apd-reglas.sql` | 128 mensajes | Ninguno lleva punto final, y en pantalla todos los avisos lo llevan | Agregar el punto en la base, o que el backend lo agregue |
| «Es su primera inasistencia: se le da una cita nueva, una sola vez.» + «Asígnele una cita nueva, una sola vez.» | cotejo, «No se presentó» | «una sola vez» repetido en dos renglones seguidos | Dejar sólo el segundo |
| «Ninguna elegida» (contador) + «Ninguna persona elegida.» | espera.html | Repetido | Dejar uno solo |

Política de tildes que observé: «sólo» adverbio, con tilde, en los 165 casos; «solo» adjetivo, sin tilde («un solo PDF», «un solo uso», «el examen se envía solo»). Es consistente. No encontré dobles espacios, dobles puntos ni palabras en inglés a la vista (aparte de «null»).

## 7. Marcas «Pendiente (Pxx)»

| Texto actual | Dónde | Problema | Texto propuesto |
|---|---|---|---|
| «¿Olvidaste tu contraseña? Pendiente: definir quién atiende la recuperación del acceso y por qué medio.» | entrar.html:54 | **P13 ya está resuelto** (2026-10-17: enlace de un solo uso por correo, aviso C1) y la marca no lleva número | «¿Olvidaste tu contraseña? Te enviaremos un enlace a tu correo. Pendiente (P23): servicio de correo.» |
| «Pendiente: las pantallas de citas de cotejo, grupos, calificación y entrega.» | revision.html:75 (bloque «Revisadas en esta prueba», visible tras revisar algo) | Desactualizado: citas, grupos, asistencia y aplicar ya existen | «Pendiente: la pantalla de emisión y entrega (P10).» |
| «Pendiente: banco, cuenta y forma de pago.» | `tramites.js:80` | Sin número | «Pendiente (P18): banco, cuenta y forma de pago.» |
| «Pendiente: días y horario de entrega.» | `tramites.js:167` | Sin número | «Pendiente (P10): días y horario de entrega.» |
| «Pendiente: la pantalla de emisión y entrega es el siguiente bloque.» | aplicar.html:52 | Sin número | «Pendiente (P10): …» |
| «Fundamento: [Art. __, fracc. __]. Pendiente: lo completa la Unidad de Transparencia.» | cuenta.html:342, solicitud.html:617 | Sin número | «Pendiente (P31): …» |
| «Por confirmar: texto oficial del concepto de pago.» / «lo fija la Gaceta Oficial.» / «formato de la referencia de pago.» / «dirección y referencias para llegar.» | tramites, cotejo (`apd.js:335`) | Sin número | Agregar P19, P16, P17 y P68 |
| «Pendiente: plazos de la revisión documental que fije la Dirección (P02).» | revision.html:71 | Formato distinto a «Pendiente (P69): …» | «Pendiente (P02): plazos de la revisión documental.» |
| «Pendiente (P69)», «(P74)», «(P79)» ×3, «(P91)», «(P92)» | citas, aplicar, cotejo, entrar, grupo, grupos | Los números existen y están abiertos; los textos coinciden con su título | — |
| Comentario «sin redondear hacia arriba (P86)» | `examen-servidor.js:23, 130` (no visible) | P86 es «Actualizar al estándar 1.1.0»; el redondeo es **P88** | Cambiar a P88 |

## 8. Avisos por correo (`docs/AVISOS-POR-CORREO.md`)

| Texto actual | Dónde | Problema | Texto propuesto |
|---|---|---|---|
| A0 aparece después de A1; «A3 bis» | Líneas 52-56 | Numeración desordenada | Renumerar A1 a A7 en el orden del tiempo |
| «Acreditación entregada» (A1) frente a «recoge su credencial» (G4) | Líneas 46 y 52 | Acreditación y credencial para la misma entrega | «Credencial entregada» |
| «(P13, resuelto con P23)» | Línea 15 | Correcto | — |
| «En la versión de prueba cada aviso de esta lista se muestra en «Mis trámites»» | Líneas 5 y 80 | El resultado del examen (G4), el recordatorio de un día antes (T1 y G3) y los de vigencia (A0 a A5) no se ven en «Mis trámites» | «…los avisos de cambio de estado se muestran en «Mis trámites»; los recordatorios no.» |

---

## Top-15: lo que más confunde a una persona sin formación técnica

1. **«null» suelto en los diálogos de confirmación**: crear grupo, reponer código y no atender a la persona (`apd.js:315`).
2. **«Corrige lo que se indica abajo»**, cuando lo que hay que corregir está arriba (`apd.js:25`).
3. **El inicio dice «en PDF o en foto»** y el resto del sitio dice «sólo en PDF» (index.html:50).
4. **Acuse con «11:22 p.m.», fecha larga y fecha real** cuando la franja dice que la fecha simulada es el 14/10/2026 (`acuse.js:46`).
5. **«MONTO FICTICIO DE PRUEBA, vigente desde 2026-07-01»**: fecha ISO y mayúsculas sostenidas en los datos de pago (`ficticios.mjs:327`, `tramites.js:79`).
6. **«¿Olvidaste tu contraseña? Pendiente: definir quién…»**, cuando ya se decidió (P13 resuelto).
7. **Acreditación ↔ credencial** usadas para lo mismo, incluso en la misma pantalla de verificar.
8. **«Emitida/Vence» frente a «Inicio/Fin de vigencia»** para la misma acreditación en «Mis trámites».
9. **«Faltan por revisar 13 campos»** en las pantallas de solicitante; el personal ya ve «faltan N respuestas».
10. **«Escribe al menos 10 caracteres»** en tú en revisar y cotejo, junto a un error en usted. Se arregla agregando `texto` a `config-usted.js`.
11. **«Tu cuenta está lista» → «1. Entra con tu CURP y tu contraseña»**, cuando ya entró.
12. **«Cancelada» sin qué sigue** y con «La persona desistió…» en tercera persona.
13. **«bandeja» / «espera» / «En espera de un curso»** y «Solicitudes por revisar» / «Revisión documental»: nombres de lugar que cambian.
14. **«5 solicitudes por revisar: 2 de 3 a 9 días.»**: no se entiende.
15. **Mensajes de la base con estados internos** («En integración», «Concluida sin atender», «específico») y jerga («marca de dato de prueba», «parámetro %s del sistema»).

### Hallazgos nuevos para el estándar (con número por asignar)

- **Acuse y borrador**: el módulo `acuse` (`acuse.js:46`) y `formkit.core.js:643` escriben la fecha con `dateStyle:'long'` y `timeStyle:'short'`, lo que da 12 horas con «p.m.» en es-MX. No hay forma de pedir DD/MM/AAAA y 24 horas desde la configuración.
- **P95, precisión**: el formato `texto` sí se puede sobrescribir en `FORMKIT_CONFIG.formatos`. Lo único que no se puede es el mensaje de `minlength` en inputs sin formato (`formkit.core.js:373`).
