# Auditoría A · Pantallas de la persona solicitante

Fecha: 17/10/2026 (fecha simulada de la prueba: 14/10/2026). Versión de prueba 0.39. Repositorio sin cambios (sólo lectura).

**Cómo se hizo.** Tres métodos, como en la auditoría del personal:
1. Una pregunta de trabajo por pantalla, desde la persona solicitante.
2. Cada regla que la persona debe cumplir: ¿se dice antes de actuar o sólo con un error después?
3. Situaciones reales en el navegador (Chromium, 390 × 844 táctil y 1280 × 900): los 20 casos del menú de pruebas en «Mis trámites»; una persona construida con cuatro trámites, nombre de 80 caracteres y empresa de 100 caracteres; un dictaminador por vencer con la poda vencida; una cuenta del registro de Kobo activada; renovación con una observación; cita en pausa, cita nueva sin pago y cita nueva por no presentarse; grupo que regresa a integración tras una baja; solicitud de dictaminador completa con archivos JPG y de 6 MB; cuenta con errores; verificación con varios números; examen completo.

Capturas y resultados: carpeta `capturas-A/` junto a este archivo (`tramites-*.png`, `solicitud-*.png`, `cuenta-*.png`, `verificar-*.png`, `examen-*.png`, `grupo-*.png`, `*.json`). Guiones: `a-comun.mjs`, `a-tramites.mjs`, `a-solicitud.mjs`, `a-otras.mjs`, `a-cuenta2.mjs`, `a-grupo.mjs`.

Resultado general: **ninguna pantalla desborda a lo ancho** en teléfono ni en escritorio y no hubo errores de consola en ningún recorrido. Los problemas son de contenido: lo que la persona necesita saber no está, está abajo de todo o le dice que haga algo que no debe.

---

## 1. Inicio (`index.html`, `app/inicio.js`)

Pregunta: «¿Qué necesito y cuánto tarda?»

| Pregunta o regla | Qué ve hoy | Problema | Propuesta |
|---|---|---|---|
| Formato de los documentos | Paso 2 del trámite: «cargas tus documentos en PDF o en foto» (`index.html:50`); 20 renglones abajo: «sólo en PDF» (`index.html:70`) | Se contradice. La foto se rechaza al cargarla (decisión 2026-10-15, `DECISIONES.md:21`). Quien prepara fotos desde el teléfono lo descubre en el paso 2 de la solicitud | «Cargas tus documentos en PDF (si sólo tienes foto, conviértela con el escáner de tu teléfono)» |
| Si no apruebas, pagas otra vez | No se dice | Regla (`DECISIONES.md:160`) que la persona sólo conoce después de reprobar | Una línea en «Cómo es el trámite»: «Si no apruebas el examen o faltas más de lo permitido, haces un trámite nuevo con su pago» |
| Plazo para corregir y para ir a la cita | No se dice (P02 pendiente) | La solicitud se cierra si no se corrige a tiempo o si falta dos veces a la cita, y la persona no lo sabe de antemano | Mientras P02 no se decida, decirlo con el plazo en amarillo «por confirmar» |
| Requisitos de cada curso | Lista con textos para el personal: «Su personal carga el PDF y captura RFC, nombre o razón social y folio fiscal… Concepto y monto del derecho conforme a la Gaceta Oficial Se entrega en la cita de cotejo» (texto de `apd.requisito.descripcion`, pintado en `inicio.js:30-37`) | Habla del trabajo interno; la factura, la foto de la credencial y el comprobante de recepción aparecen como «requisitos» aunque la persona no los entrega. Falta un punto: `APD.limpia` (`apd.js:181`) borra «[pendiente].» y deja «…Gaceta Oficial Se entrega» | Separar «lo que cargas» de «lo que pasa en la cita y al recoger»; un texto para la persona por requisito |
| Monto | «Pago de derechos: $1,200.00» sin marca (`inicio.js:44`) | En «Mis trámites» el mismo monto va en amarillo «por confirmar»; aquí parece definitivo | La misma marca amarilla |
| Ventana de renovación | «desde 30 días antes… hasta 12 meses después» (`index.html:60`), y que sin vigencia no se trabaja aunque la renovación esté en trámite (`:63`) | Bien | — |

## 2. Crear tu cuenta (`cuenta.html`, `app/cuenta.js`, `app/config-cuenta.js`)

Pregunta: «¿Qué necesito para crear mi cuenta y por qué no me deja?»

| Pregunta o regla | Qué ve hoy | Problema | Propuesta |
|---|---|---|---|
| Si tuve acreditación en el registro anterior, mi nombre debe ser idéntico al de ese registro | Nada antes. Después de llenar todo, con fotografía y contraseña: «Tu nombre no coincide con el registro anterior de la Secretaría para esta CURP. Acude a la Secretaría para aclararlo.» (`config-cuenta.js:51-53`). Probado: un segundo apellido con una letra distinta pasa la comprobación de la CURP (sólo usa inicial y consonante) y luego se rechaza | La persona queda **bloqueada** por un error de captura del registro anterior, sin saber qué escribir ni a dónde acudir (no hay dirección ni teléfono). La regla es una propuesta (`DECISIONES.md:99`, R03) | Decir antes, en «Tus datos»: «Si ya tuviste una acreditación, escribe tu nombre como en ese registro». Al rechazar, mostrar cómo quedó escrito en el registro (sólo las letras que difieren no; basta «revisa tu segundo apellido») o dar un medio de contacto. Confirmar R03 con Liber |
| Fotografía: tamaño mínimo | La ayuda (`cuenta.html:100`) dice formato, rostro, luz. El mínimo de 320 × 240 píxeles sólo aparece como error (`validaciones.config.js:499`). Probado con 300 × 400: «la imagen es demasiado pequeña» y el resumen dice «Adjunta al menos un archivo» aunque sí se adjuntó | Regla que sólo se ve después; el resumen confunde | Agregar a la ayuda «de al menos 320 × 240 píxeles» (o «no la recortes demasiado») |
| «Ya hay una cuenta con esta CURP… si no recuerdas tu contraseña, pide ayuda a la Secretaría» (`config-cuenta.js:42`) | — | La recuperación ya está decidida: enlace por correo (`DECISIONES.md:100`, P13 resuelto) | Enlace «Recupera tu contraseña» |
| Correo de otra cuenta | Error junto al campo correo (probado) | Bien | — |
| Acuse | «Creada el 17 de octubre de 2026, 11:27 p.m.»; paso 1: «Entra con tu CURP y tu contraseña» | La hora sale en 12 horas con «p.m.» (formato del módulo `acuse.js:46`), contra la decisión de 24 horas (`apd.js:72`, bitácora). La persona ya quedó con la sesión abierta | Fecha corta y 24 horas; quitar el paso 1 |
| Resumen de errores | «Faltan por revisar 13 campos para continuar» | Contra `DECISIONES.md:214` («faltan 13 respuestas», no «campos»). En el personal ya está aplicado (`config-usted.js:21-22`), en la persona no | Mismo `mensajes.resumenUno/resumenVarios` en las pantallas de la persona |

## 3. Entrar (`entrar.html`, `app/config-entrar.js`)

Pregunta: «¿Qué hago si olvidé mi contraseña?»

| Pregunta o regla | Qué ve hoy | Problema | Propuesta |
|---|---|---|---|
| Olvidé mi contraseña | «Pendiente: definir quién atiende la recuperación del acceso y por qué medio» (`entrar.html:54`) | Ya está decidido (correo, aviso C1; `PENDIENTES.md:196`) | «¿Olvidaste tu contraseña? Te enviamos un enlace a tu correo» (simulado en la prueba) |
| Cuenta bloqueada | «Pendiente (P79): a quién acudir para aclararlo» (`config-entrar.js:43`) | Número interno de pendiente en texto para la persona | Texto en amarillo sin el número |
| CURP del registro anterior sin cuenta | Mensaje claro: «Crea tu cuenta con ella» | Bien | — |

## 4. Mis trámites (`tramites.html`, `app/tramites.js`)

Preguntas: «¿Qué tengo que hacer ahora y cuándo?», «¿Qué corrijo y hasta cuándo?», «¿Cuándo vence mi acreditación y desde cuándo renuevo?»

| Pregunta o regla | Qué ve hoy | Problema | Propuesta |
|---|---|---|---|
| Grupo que regresa a integración tras una baja | Probado: grupo confirmado para el 26/10 a las 08:00, una baja lo deja con 4; la base lo regresa a integración «con su fecha como propuesta» (`DECISIONES.md:150`). La persona que sigue en el grupo ve «Con grupo asignado · **Preséntate el 26/10/2026, a las 08:00**» (`tramites.js:91-97` no mira `grupo.estado`) | Se presentará a un curso que ya no está confirmado: pierde el día de trabajo y el viaje | Si el grupo no está confirmado: «Tu grupo todavía no está confirmado; la fecha puede cambiar. Te avisamos cuando se confirme» |
| Me dieron de baja del grupo | Probado: la persona dada de baja ve «En espera de grupo · Tu cotejo terminó», sin decir que salió de su grupo (`tramites.js:133` sólo avisa si el grupo se canceló) | No sabe que ya no tiene fechas; el catálogo de avisos lo pide (G2, «baja», indispensable) | Aviso «Saliste del grupo APD-G-…: {motivo}. Sigues en espera con tu misma antigüedad» |
| Cita nueva por no traer el comprobante | «Paga los derechos con los mismos datos: el monto es el mismo» (`tramites.js:129`) | Quien **ya pagó** y olvidó el comprobante lee que debe pagar otra vez | «Si ya pagaste, lleva el comprobante de ese pago. Si no has pagado, paga con estos datos» |
| Cita nueva por no presentarse, o nueva cita después de observaciones del cotejo | Se repiten los pasos de siempre: «Paga los derechos e imprime tu comprobante» y el bloque «Datos para tu pago» (`apd.js:26`, `tramites.js:66-85`), sin mirar si ya hubo una cita | Mismo riesgo de pagar dos veces | En una segunda cita: «Si ya pagaste, lleva el mismo comprobante» |
| ¿Hasta cuándo corrijo? | «Corrige y reenvía» con la lista de observaciones; ningún plazo (`tramites.js:140-147`, `apd.js:25`). Existe el cierre «Cerrada: no se corrigió a tiempo» | La solicitud se cierra por un plazo que nunca se le dijo (P02; el aviso S2 pide «hasta cuándo») | Mostrar «Corrige antes del …»; mientras P02 no se decida, el renglón en amarillo «por confirmar» |
| ¿Qué llevo al curso y al examen? | Con grupo: fechas, hora, sede y «necesitas asistir al menos 4 para presentar el examen» (`tramites.js:97`) | No dice que el examen es el último día, en el salón de cómputo del PILARES, con calificación mínima 7.0/8.0, ni que **debe llevar su identificación oficial**: el código del examen se da después de comprobarla (`DECISIONES.md:167-168`) y la credencial se entrega ese día | Pasos: «Lleva tu identificación oficial todos los días; el último día presentas el examen en computadora (mínimo 7.0); si apruebas, te quedas a recoger tu credencial» |
| ¿Cuándo es mi cita? | Probado en teléfono: la fecha de la cita está en el 4.º dato, abajo del bloque de pago, a unos 1,400 px del inicio (`tramites.js:52`, `:59`; captura `tramites-cita-tel.png`) | Lo más importante queda al final | Primer renglón de la ficha: «Tu cita: lunes 20/10/2026, 10:00 · Vivero Nezahualcóyotl» (con día de la semana) |
| ¿Y si no puedo ir a la cita? | Nada antes de la primera cita. Sólo después de faltar: «Si tampoco te presentas, tu solicitud se cierra» (`tramites.js:130`) | La consecuencia de faltar dos veces y la forma de cambiar la cita no están a la vista; no hay medio de contacto | «Si no puedes ir, avisa a la Secretaría antes (medio por definir). Si faltas dos veces, la solicitud se cierra» |
| Renovación de dictaminador con la poda vencida | Probado: dictaminador «Vigente · por vencer, faltan 22 días», sin botón «Renovar» y **sin explicación**; la poda vencida sí tiene «Renovar» (`tramites.js:37` sólo muestra el motivo si está «vigente»; `apd.js:204`). «Iniciar una solicitud» tampoco aparece | La persona no sabe por qué no puede renovar ni que primero debe renovar la poda | Mostrar el motivo siempre que no esté disponible: «Para renovarla necesitas la de poda y derribo vigente: renueva primero esa» |
| Renovación en curso con la acreditación por vencer | Probado: «Faltan 10 días» y la renovación «En revisión documental»; nada más | No dice que el día que venza ya no puede trabajar aunque la renovación siga (está sólo en el inicio, `index.html:63`) | En la ficha de la acreditación: «Tu renovación está en trámite (folio …). Desde el 25/10 no puedes trabajar hasta que se emita la nueva» |
| Orden de las solicitudes | Probado con cuatro trámites: la rechazada (más reciente) sale arriba de la renovación en curso (`apd.js:168` ordena sólo por fecha de alta) | Contra `DECISIONES.md:213` («primero las solicitudes en curso») | Ordenar: en curso, luego terminadas |
| Ya aprobé: ¿dónde recojo? | «Recoge tu credencial hoy mismo, en la sede, antes de irte» (`tramites.js:171`) | Se sigue leyendo al día siguiente y en adelante, cuando ya no es «hoy»; quien no pudo quedarse no sabe qué hacer (P10) | Fecha del examen en el texto («el 17/10/2026») y la alternativa en amarillo «por confirmar» |
| Observaciones: dónde están | «Lo que debes corregir» va arriba y el texto debajo dice «Corrige lo que se indica **abajo**» (`apd.js:25`, orden en `tramites.js:200-201`) | Contradice la posición | «Corrige lo que se indica arriba» o mover la frase |
| Cita en pausa | Con la cita en pausa se siguen mostrando «Datos para tu pago» y «Paga antes de tu cita» (`tramites.js:66`) antes de «Lo que no coincidió» | La persona está en la cita: el bloque de pago estorba y empuja lo que debe cargar | En pausa, ocultar el bloque de pago |
| Grupo en curso | «Preséntate el 13/10/2026» con fecha simulada 14/10 | Fecha pasada en imperativo | «Tu curso empezó el 13/10 y termina el 17/10» |
| Acreditaciones viejas | Una acreditación de 2023 sale como «No vigente · Venció hace 958 días» sin contexto | Ruido con varias acreditaciones | Agruparlas en «Anteriores» plegado |
| Nombres y empresas largos | Nombre de 80 caracteres y empresa de 100: se parten bien, sin desborde (capturas `tramites-multi-*`) | Bien | — |

## 5. Solicitud (`solicitud.html`, `app/solicitud.js`, `app/config-solicitud.js`)

Pregunta: «¿Puedo pedir la de dictaminador y qué me falta para enviar?»

| Pregunta o regla | Qué ve hoy | Problema | Propuesta |
|---|---|---|---|
| Barra de avance (pasos 1-2-3) | En teléfono y escritorio la barra sale apilada en vertical, con números «2» y «3» rojos sueltos a la izquierda y líneas verticales (capturas `zoom-pasos-tel.png`, `zoom-pasos-esc.png`) | `apd.css:331-350` define `.pasos` y `.pasos-item` para «Qué sigue» y choca con las mismas clases del módulo `pasos` del estándar (`formkit/modulos/pasos/pasos.js:48-51`) | Renombrar las clases propias (p. ej. `.sigue-pasos`); anotar en el estándar que sus clases no llevan prefijo |
| Documento observado en una renovación | Probado: renovación con la identificación observada («vencida; carga una vigente»). El campo sigue opcional «(si aplica)» y la solicitud **se reenvía sin cargarla** («Recibimos tu solicitud») (`solicitud.js:140-144` sólo quita lo obligatorio a lo aceptado; `solicitud.html:247` sin `data-requerido`). La base tampoco lo exige (`03-apd-reglas.sql:729-737` sólo mira los obligatorios) | Otra vuelta de revisión segura; el plazo para corregir corre | En `continua()`, hacer obligatorio todo documento con observación; en la base, rechazar el envío con un documento vigente «con_observacion» |
| Experiencia mínima | Antes de escribir: «Se piden al menos cinco años: la Secretaría revisará tu carrera…»; con 3: «Error: El valor mínimo es 5.» | Bien que se diga antes. El error no dice de qué | «Con tu perfil se piden al menos 5 años» |
| PDF y 5 MB | Dicho antes en la bajada y en cada campo. JPG: «ese tipo de archivo no se admite. Los formatos son PDF». 6 MB: «pesa 6.0 MB y el máximo es 5 MB» | Bien | — |
| Guardar y seguir después | No hay borrador: el formulario no tiene `data-borrador` (`solicitud.html:50`) y la solicitud sólo se crea al enviar (`config-solicitud.js:26-32`) | En el teléfono, con 7 PDF, cualquier interrupción hace perder todo. «Continuar solicitud» sólo existe para los borradores ficticios | Guardar como borrador al pasar del paso 1 (en la etapa 3, en la base) |
| Renovación de dictaminador | Pide otra vez nivel, carrera, situación y años, con el mismo mínimo (`solicitud.html:148-160`; base `03-apd-reglas.sql:716-727`) | Para alguien del registro anterior con carrera «por clasificar» pide 5 años y puede quedar bloqueado para renovar, aunque `DECISIONES.md:193` dice que en la renovación los documentos «no limitan la emisión» | Confirmar con Liber si en la renovación aplica el mínimo |
| Renovación de quien viene de Kobo sin archivos | Identificación, CURP y domicilio «Sólo si cambió o ya no está vigente» | La Secretaría no tiene esos documentos del registro anterior; la persona no lo sabe y el cotejo no tiene contra qué comparar | Confirmar con Liber; si se piden, decirlo: «La Secretaría no tiene tus documentos del registro anterior: cárgalos» |
| «Te corresponde una solicitud nueva: es tu primera vez o tu acreditación anterior venció hace más de un año» | Sale también a quien le rechazaron la de dictaminador hace dos semanas | Texto que no corresponde a su caso | «Te corresponde una solicitud nueva. Curso de 5 días» |
| Resumen de errores | «Faltan por revisar 7 campos para continuar» | Igual que en la cuenta (`DECISIONES.md:214`) | Igual que en la cuenta |
| Acuse | «Pendiente: plazo de revisión» (`solicitud.html:599`) | Correcto como pendiente | — |

## 6. Cargar el documento correcto (`corregir.html`, `app/corregir.js`)

Pregunta: «¿Qué cargo y qué hago después?» — Probado: dice qué no coincidió, pide sólo ese documento, y al cargar da tres pasos (imprimir, regresar con quien atiende, termina el cotejo). Sin problemas.

## 7. Mi perfil (`datos.html`, `app/datos.js`)

Pregunta: «¿Mis datos están bien y cómo los cambio?»

| Pregunta o regla | Qué ve hoy | Problema | Propuesta |
|---|---|---|---|
| Datos de identidad mal | «Si alguno está mal, pide a la Secretaría que lo corrija» (`datos.html:79`) | No hay forma de contactar a la Secretaría en ninguna pantalla (lo mismo en `solicitud.html:83`, `apd.js:394`, `config-cuenta.js:42,53`) | Un medio de contacto único en el pie de las pantallas de la persona |
| Fotografía ya confirmada | «Fotografía confirmada el 13/10/2026», sin opción de cambiarla | Bien por decisión; falta decir qué hacer si cambió su aspecto (P100) | Cuando se decida P100 |
| Adscripción | «Tus solicitudes se envían con la adscripción que tengas ese día; las que ya enviaste conservan la suya» | Bien | — |

## 8. Verificar una acreditación (`verificar.html`, `app/config-verificar.js`)

Pregunta (de quien contrata): «¿Esta persona puede trabajar?»

| Pregunta o regla | Qué ve hoy | Problema | Propuesta |
|---|---|---|---|
| Número con espacios | Probado «PD 2026 0001»: se quitan los espacios y responde «PD20260001 no está registrada… **esta persona no tiene una acreditación de la Secretaría**» (`config-verificar.js:16` busca el texto exacto) | Falso negativo con acusación; minúsculas sí funcionan | Normalizar también a «PD-2026-0001» (insertar guiones) antes de buscar; suavizar el texto: «No encontramos ese número» |
| Vigente, por vencer, vencida | «Vigente hasta el …», «Faltan N días», «No vigente · Venció hace N días»; el dictaminador sigue vigente con la poda vencida | Bien, conforme a `REGLAS.md:53-56` | — |

## 9. Examen (`examen.html`, `app/examen.js`)

Pregunta: «¿Cuánto tiempo tengo, cuánto necesito y qué pasa si repruebo?»

| Pregunta o regla | Qué ve hoy | Problema | Propuesta |
|---|---|---|---|
| Reglas antes de empezar | 27 preguntas, 60 minutos, mínimo 7.0, el tiempo no se detiene, cada respuesta se guarda (`examen.html:72-79`) | Bien | — |
| Si repruebo | Sólo después: «Para intentarlo de nuevo, inicia una solicitud nueva desde tu cuenta, con su pago de derechos» (`examen.js:255`) | La consecuencia (nuevo pago) no está en las instrucciones ni antes | Agregarla a «Antes de empezar» |
| Código mal escrito | Error claro junto al campo, con ejemplo | Bien | — |
| Caso con tablas en teléfono | Las tablas se leen como fichas; la pregunta queda a ~1,700 px (captura `examen-caso-tel.png`) | Aceptable: el examen es en computadoras del salón | — |

---

## Lista por prioridad

**Alta** (puede perder el trámite, pagar dos veces, perder la cita o el curso, o quedar bloqueada sin salida)

1. Grupo que regresa a integración: la persona sigue viendo «Preséntate el 26/10, a las 08:00» como si estuviera confirmado — `tramites.js:91-97` (probado).
2. Cita nueva sin comprobante: «Paga los derechos… el monto es el mismo» a quien quizá ya pagó — `tramites.js:129`; y en cualquier segunda cita se repite «Paga los derechos» — `apd.js:26`, `tramites.js:66-85` (probado).
3. Sin plazo para corregir observaciones, aunque la solicitud se cierra por no corregir a tiempo — `tramites.js:140-147`, `apd.js:25`, P02.
4. Con grupo asignado no se dice que hay que llevar identificación oficial (sin ella no hay código de examen), ni que el examen es el último día con mínimo 7.0/8.0 — `tramites.js:97`, `DECISIONES.md:167-168`.
5. Cuenta del registro anterior: un nombre que no coincide letra por letra bloquea la cuenta después de llenar todo, sin decirlo antes ni dar contacto — `config-cuenta.js:51-53` (probado).

**Media**

6. La barra de pasos de la solicitud sale rota (vertical, con números sueltos) por choque de clases — `apd.css:331-350` contra `formkit/modulos/pasos` (probado).
7. Documento observado en una renovación: se reenvía sin corregirlo — `solicitud.js:140-144`, `03-apd-reglas.sql:729-737` (probado).
8. Dictaminador por vencer con la poda vencida: sin «Renovar» y sin explicación — `tramites.js:37` (probado).
9. Baja de un grupo: la persona no se entera — `tramites.js:133` (probado).
10. La fecha de la cita está al final de la ficha — `tramites.js:52,59` (probado).
11. No se dice antes qué pasa si falta a la cita ni cómo cambiarla; no hay medio de contacto con la Secretaría en ninguna pantalla.
12. Inicio: «cargas tus documentos en PDF o en foto» — `index.html:50`.
13. Olvidé mi contraseña: sigue «Pendiente», aunque ya está decidido — `entrar.html:54`.
14. Verificación con espacios: «esta persona no tiene una acreditación» — `config-verificar.js:16` (probado).
15. Sin borrador: lo capturado en el teléfono se pierde si se interrumpe — `solicitud.html:50`.
16. Renovación en curso con la acreditación por vencer: no se advierte que al vencer ya no puede trabajar — `tramites.js:26-39`.
17. «Recoge tu credencial hoy mismo» se queda para siempre — `tramites.js:171`.
18. Regla «si repruebas, pagas otra vez» sólo se ve después — `index.html`, `examen.html:72-79`.
19. Orden de «Mis solicitudes»: una terminada puede ir arriba de una en curso — `apd.js:168` (probado).
20. Por confirmar con Liber: mínimo de experiencia en la renovación de dictaminador, y documentos de quien viene de Kobo sin archivos.

**Baja**

21. «Corrige lo que se indica abajo» con la lista arriba — `apd.js:25`.
22. Tamaño mínimo de la fotografía (320 × 240) sólo como error; el resumen dice «Adjunta al menos un archivo» — `cuenta.html:100`, `validaciones.config.js:499` (probado).
23. Resumen de errores dice «campos», no «respuestas» — mensajes del estándar sin ajustar en la persona (sí en `config-usted.js:21-22`).
24. Acuse en 12 horas («11:27 p.m.») y con la fecha real, no la simulada — `formkit/modulos/acuse/acuse.js:46`.
25. Acuse de la cuenta: «Entra con tu CURP y tu contraseña» con la sesión ya abierta.
26. Inicio: textos de los requisitos para el personal y punto perdido («Gaceta Oficial Se entrega») — `inicio.js:30-37`, `apd.js:181`.
27. Monto sin marca «por confirmar» en el inicio — `inicio.js:44`.
28. Cita en pausa con el bloque de pago todavía visible — `tramites.js:66`.
29. «Preséntate el» con fecha pasada en un curso ya empezado — `tramites.js:95`.
30. Acreditaciones viejas sin agrupar; «Te corresponde una solicitud nueva: es tu primera vez…» a quien no es su primera vez — `solicitud.js:91`.
31. Error de experiencia «El valor mínimo es 5» sin decir de qué.

---

## Desacuerdos entre documentos y código (reglas de la persona)

| Documento | Dice | Código | Dice / hace |
|---|---|---|---|
| `DECISIONES.md:21` | Documentos sólo en PDF | `index.html:50` | «en PDF o en foto» |
| `DECISIONES.md:100`, `PENDIENTES.md:196`, `ETAPA-1-PANTALLAS.md` §8 bis | Contraseña: enlace por correo (P13 resuelto) | `entrar.html:54`, `config-cuenta.js:42` | «Pendiente: definir quién atiende…», «pide ayuda a la Secretaría» |
| `DECISIONES.md:213` | Primero las solicitudes en curso | `apd.js:168` | Orden sólo por fecha de alta |
| `DECISIONES.md:214` | «Para continuar, faltan 3 respuestas», no «campos» | Pantallas de la persona | «Faltan por revisar N campos» (sólo el personal lo tiene, `config-usted.js:21-22`) |
| `DECISIONES.md:150` | El grupo que regresa a integración conserva su fecha **como propuesta** | `tramites.js:91-97` | La muestra como fecha confirmada |
| `AVISOS-POR-CORREO.md` (intro, S2, G2) | En la prueba cada aviso se ve en «Mis trámites»: plazo para corregir; baja o cambio de grupo | `tramites.js` | Sin plazo; sólo avisa el grupo cancelado (`:133`) |
| `ETAPA-1-PANTALLAS.md` §4 | En la corrección, la obligatoriedad la decide `apd.comprobar_envio` «(sólo lo observado)» | `03-apd-reglas.sql:729-737` | Sólo exige los obligatorios del curso; un observado opcional no se exige |
| `ETAPA-1-PANTALLAS.md` §1 | `validada_en_linea` se lee «Cita asignada» | `apd.js:26` | La persona lee «Acude a tu cita» («Cita asignada» es del personal) |
| `REGLAS.md:49` | «Por vencer»: últimos 30 días, vencimiento incluido | `03-apd-reglas.sql:496-497`, `apd.js:197` | Desde 30 días antes del vencimiento, es decir 31 días con el del vencimiento (el texto del inicio, «desde 30 días antes», coincide con el código) |
| `REGLAS.md:34` | Paso a «cancelada»: la mueve la persona o el personal | Pantallas de la persona | No hay forma de cancelar una solicitud propia |
| Bitácora (bloque de horas) y `apd.js:72` | Horas en 24 horas en todo el sistema | `acuse.js:46` (cuenta y solicitud) | «11:27 p.m.» |
| `DECISIONES.md:99` | Activar una cuenta de Kobo exige el nombre del registro: **propuesta**, no confirmada | `config-cuenta.js:51-53` | Se aplica letra por letra, incluido el segundo apellido |

## Nombres internos que llegan a la persona

- No se encontró ningún nombre de estado de la base en los 20 casos probados ni en los construidos. Riesgo latente: si llega un estado sin texto, se muestra la clave tal cual (`apd.js:239`, `tramites.js:50`).
- «Pendiente (P79)» con número de pendiente: `config-entrar.js:43`.
- Requisitos del inicio escritos para el personal («Su personal carga el PDF y captura RFC…», «El sistema la comprueba en su padrón», «el personal carga el PDF escaneado»): textos de `apd.requisito.descripcion` pintados en `inicio.js:30-37`.
- Los recuadros amarillos de datos internos (`dictaminador_nueva`, `por_clasificar`, `apd.solicitud…`) sólo salen en la versión de prueba, como se decidió.

## Datos personales

No se encontró nada que parezca dato real: correos `@ejemplo.local`, teléfonos `00000000NN`. Las CURP de `sitio/datos/ficticios.json` tienen forma de CURP real derivada de nombres ficticios con entidad «NE»; `ETAPA-1-PANTALLAS.md` (§5, punto 2) dice que pasaron a la forma `XAXX…NEXXX0d`, lo que ya no coincide con el archivo. No se copian valores aquí.
