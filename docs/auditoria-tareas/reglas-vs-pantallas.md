# Reglas contra pantallas del personal · «cada regla, visible donde se aplica»

Revisión del 17/10/2026 sobre la versión de prueba 0.38. Lo revisé leyendo el código de las nueve pantallas del
personal (HTML y JS), `app/personal.js`, `app/apd.js`, `app/archivos-prueba.js`, `app/examen-grupo.js` y las reglas de
la base (`db/apd/03-apd-reglas.sql`, `04-apd-catalogos.sql`, `02-apd-tablas.sql`), contra `docs/DECISIONES.md`,
`docs/ETAPA-2-PANTALLAS.md` (§2, 2a a 2d) y `docs/REGLAS.md`. No abrí las pantallas en el navegador: cada afirmación
sale del código citado.

Clasificación:

- **VISIBLE**: la pantalla muestra la condición o la cifra en el momento de decidir.
- **PARCIAL**: se muestra, pero hay que contar, calcular, recordar la regla o abrir otra pantalla.
- **OCULTA**: no se muestra; el personal la descubre sólo con un error después de actuar, o la base la aplica sin que
  la pantalla avise.
- **NO APLICA**: la regla no se decide en esa pantalla, o todavía está pendiente y no hay nada que mostrar.

Volúmenes de referencia para juzgar el riesgo: 1,000 solicitudes al año (DECISIONES:16), unas 100 personas en espera,
40 citas en un día y grupos de 25.

---

## 1. Solicitudes por revisar (`revision.html`, `app/revision.js`)

| Regla (fuente) | Dónde se aplica | Qué ve hoy el personal | Clasificación | Propuesta concreta |
|---|---|---|---|---|
| De la que más espera a la más reciente (DECISIONES:65) | Orden de la bandeja | Orden por antigüedad, columnas «Llegó a revisión» y «Espera» (revision.js:43-55; personal.js:136-139) | VISIBLE | Por confirmar con Liber: una reenviada cuenta su espera desde el reenvío (`estado_desde`), así que pasa al final de la fila aunque lleve semanas en el trámite. Si no es lo que se quiere, mostrar también «en trámite desde» |
| Espera en ámbar desde 3 días y en rojo desde 10 (DECISIONES:69; personal.js:28) | Cada fila | Etiqueta de color por fila y leyenda al pie (revision.html:71; revision.js:47,55) | PARCIAL | Con 100 en la bandeja hay que recorrerla para saber cuántas están en rojo. Agregar al resumen «12 en rojo (10 días o más) · 30 en ámbar» y un filtro «Espera: en rojo / en ámbar» |
| Carrera por clasificar y perfil que podría no cumplir (DECISIONES:66-67) | Columna «A revisar con atención» | Señales en la fila (personal.js:71-79) | VISIBLE | — |
| Reenviada y documentos corregidos (DECISIONES:65) | Columnas «Vuelta» y señales | «2.ª (reenviada)», «N documentos corregidos» (personal.js:60-69,75-76) | VISIBLE | — |
| Plazos de la revisión documental (P02) | — | Aviso «Pendiente» (revision.html:71) | NO APLICA (pendiente) | Cuando la Dirección los fije, la bandeja tiene que decir cuántas vencen hoy |

## 2. Revisar una solicitud (`revisar.html`, `app/revisar.js`)

| Regla (fuente) | Dónde se aplica | Qué ve hoy el personal | Clasificación | Propuesta concreta |
|---|---|---|---|---|
| Clasificar carrera: afín 2 años, disciplina afín 5, no afín se rechaza (DECISIONES:61,66; ETAPA-2 §2) | Perfil del dictaminador | Cada opción dice sus años y su consecuencia (revisar.html:83-85); la experiencia que se pide se recalcula al elegir (revisar.js:226-230) | VISIBLE | — |
| Perfil que no cumple, opción C (DECISIONES:67) | Perfil | Pregunta con sus dos consecuencias (revisar.html:98-99); al elegir «otro grado», la página marca la observación del comprobante (revisar.js:187-198) | VISIBLE | — |
| Sólo se rechaza por perfil y el rechazo se confirma (DECISIONES:68) | Resultado | El botón cambia según el resultado y rechazar pide confirmación (revisar.js:39-44,312-322) | VISIBLE | — |
| Experiencia mínima comprobable: 2 o 5 años (DECISIONES:53,61) | Documento «Comprobantes de experiencia» | El perfil (arriba) dice «Experiencia declarada» y «Experiencia que se pide» (revisar.js:135-140), pero el bloque del documento, que es donde se decide al ver el PDF en el visor de la derecha, no repite los años (revisar.html:266-288) | PARCIAL | En la cabeza del documento: «Debe comprobar al menos 5 años · declaró 6». Si la clasificación cambia el mínimo, que cambie también ahí. Agregar el motivo frecuente «No alcanza los años que pide su perfil» |
| En renovación sólo la constancia fiscal es obligatoria (DECISIONES:91,192) | Documentos | Ayuda específica de renovación (revisar.js:106-108) | VISIBLE | — |
| Poda vigente al iniciar; no se vuelve a comprobar (DECISIONES:193) | Datos de la persona | Muestra la acreditación de poda más reciente con «vigente hasta el…», sin comprobar que siga vigente (revisar.js:86-87,100) | NO APLICA (la regla no se decide aquí) | Cambiar la etiqueta a «vence el…» o «venció el…» para no afirmar una vigencia que la pantalla no comprueba (ver hallazgo D7) |
| Para validar: todos los documentos aceptados y la cita (REGLAS:25) | Resultado | «3 de 5 documentos revisados · 1 con observación» y el botón cambia (revisar.js:232-238) | VISIBLE | — |
| La cita se elige desde el día siguiente (DECISIONES:69) | Fecha de la cita | El calendario no deja elegir hoy (`min`, revisar.js:261-262), pero ningún texto lo dice (revisar.html:302-305) | PARCIAL | Ayuda: «Desde mañana, 18/10/2026» |
| Cuántas citas caben por horario (P69, pendiente; ETAPA-2 §4) | Fecha y hora de la cita | Nada: se elige día y hora sin ver cuántas citas hay ya (revisar.html:302-326) | OCULTA (regla pendiente) | Aunque P69 no fije el cupo, mostrar junto a la hora cuántas citas tiene ya ese horario y ese día («09:00 · 6 citas»; «18/10: 37 citas»), a partir de las citas abiertas. Con 40 citas al día es lo que más se va a necesitar |
| Sede única (DECISIONES:71) | Resultado | «La cita es en el Vivero Nezahualcóyotl» (revisar.html:329) | VISIBLE | — |
| Motivo del rechazo obligatorio, la persona lo lee (REGLAS:26) | Resultado | Motivo propuesto ya escrito (revisar.js:207-214) | VISIBLE | — |
| Observación de al menos 10 caracteres (revisar.html: `minlength="10"`) | Cada documento observado | La ayuda no dice el mínimo; sale como error al presionar «Listo, ir al siguiente» o al enviar (revisar.js:347-351) | PARCIAL (bajo riesgo) | Contador «0 de 10 caracteres mínimos» o decirlo en la ayuda |

## 3. Citas de cotejo (`citas.html`, `app/citas.js`)

| Regla (fuente) | Dónde se aplica | Qué ve hoy el personal | Clasificación | Propuesta concreta |
|---|---|---|---|---|
| Situación de cada cita (DECISIONES:129) | Agenda | Etiqueta por fila: por atender, en pausa, documento cargado, atendida, etc. (citas.js:35-47; personal.js:84-96) | VISIBLE | — |
| Cita nueva una sola vez; a la segunda inasistencia se cierra (DECISIONES:124) | Agenda del día | Nada distingue una segunda cita de una primera; sólo se sabe al abrirla (cotejo.js:110-115) | PARCIAL | Etiqueta en la fila: «2.ª cita · si no viene se cierra». Con 40 citas, quien registra las inasistencias al final del día tiene que saber cuáles cierran la solicitud |
| Cita nueva por falta de pago (DECISIONES:125) | Agenda | Igual: no se distingue | PARCIAL | Etiqueta «Cita por falta de pago · trae el comprobante» |
| Con una cita abierta no se asigna otra; hay que registrar lo que pasó (DECISIONES:129; REGLAS:29, `cita_abierta`) | Agenda | Abre en hoy o en el siguiente día con citas (citas.js:30); las citas de días anteriores que siguen «Por atender» no se señalan en ningún lado | OCULTA | Aviso arriba: «Hay 3 citas de días anteriores sin registrar: márquelas (¿se presentó?)», con enlace a cada una. Si nadie registra la inasistencia, la persona no recibe su cita nueva ni se aplica la regla de la segunda inasistencia |
| La pausa sólo dura el día de la cita (DECISIONES:130) | Agenda | Una pausa de un día anterior sigue con «Retomar» en su día (citas.js:37-39; personal.js:112-115); no dice que venció | OCULTA | En la fila: «Pausa vencida · regresa con observaciones esta noche» sin botón «Retomar». En el día de la pausa: «En pausa · vence hoy» |
| Cuántas citas por horario (P69) | Agenda | Total del día y cuántas atendidas (citas.js:78-81); no por hora | PARCIAL (regla pendiente) | Subtítulo por hora con su número («09:00 · 6») |

## 4. Atender una cita de cotejo (`cotejo.html`, `app/cotejo.js`)

| Regla (fuente) | Dónde se aplica | Qué ve hoy el personal | Clasificación | Propuesta concreta |
|---|---|---|---|---|
| Inasistencia: cita nueva una vez; a la segunda se cierra (DECISIONES:124; parámetro `inasistencias_cotejo_maximas` = 2, 04-apd-catalogos.sql:21) | Llegada y resultado | Aviso «Es su segunda cita» (cotejo.js:110-115), texto del resultado y botón rojo con confirmación (cotejo.js:172,200-201,321-322) | VISIBLE, con dos fallas | (a) El umbral está escrito fijo en la página (`inasistencias >= 1`, cotejo.js:172), no se lee del parámetro. (b) La prueba reinicia la cuenta al volver a validar (archivos-prueba.js:294) y la base cuenta todas las inasistencias de la solicitud (03-apd-reglas.sql:1066): la pantalla puede decir «primera inasistencia, cita nueva» y la base cerrar la solicitud. (c) Si la cita anterior fue por falta de pago, el aviso sólo dice eso y no que ya hubo una inasistencia (cotejo.js:111-113). Ver D1 y D2 |
| No es la persona: no se atiende y la cuenta se bloquea (DECISIONES:127) | Identidad | La opción dice su consecuencia (cotejo.html:108) y se confirma (cotejo.js:323-324) | VISIBLE | — |
| La fotografía que se confirma es la de la cuenta; no se toma otra (DECISIONES:38) | Identidad | Ayuda del bloque (cotejo.html:100) | VISIBLE | — |
| Documento que no coincide: pausa si lo consigue hoy, si no, observaciones (DECISIONES:126) | Documentos | Pregunta con las dos consecuencias (cotejo.html:294-298) | VISIBLE | — |
| La pausa sólo dura ese día (DECISIONES:130; base `pausa_vencida`, 03-apd-reglas.sql:1037-1043) | Al retomar | «Cotejo en pausa desde las 11:30», sin fecha (cotejo.js:102); la página no compara con hoy | OCULTA | «En pausa desde el 16/10 a las 11:30 · venció: sólo puede regresarla con observaciones», y ofrecer sólo esa salida |
| Sin comprobante de pago: otra cita con el mismo monto (DECISIONES:115,125) | Pago | «Monto que se le indicó» y textos del resultado (cotejo.js:143-148,199,206-208) | VISIBLE | — |
| Factura obligatoria con RFC, razón social y folio fiscal (DECISIONES:113,118,120) | Factura | Campos obligatorios con su ayuda (cotejo.html:322-356) | VISIBLE | — |
| Un folio fiscal no se repite (DECISIONES:120, R20) | Folio fiscal | Ni la pantalla ni el esquema lo comprueban; la base sólo tiene una restricción única sin mensaje propio (02-apd-tablas.sql:344) | OCULTA | Que la API responda `{campo: 'factura_folio_fiscal', mensaje: 'Ese folio fiscal ya está en la solicitud APD-S-…'}` y se vea junto al campo; agregar el código en la base (ver D6) |
| Expediente: uno por persona, consecutivo (DECISIONES:123) | Resultado | Dice el número que se abrirá o al que se agrega (cotejo.js:69,94,194) | VISIBLE | — |
| Cita nueva desde mañana (y cupo por horario, P69) | Cita nueva | Igual que en la revisión: `min` sin texto y sin ver cuántas citas hay (cotejo.js:244; cotejo.html:367-380) | PARCIAL / OCULTA | Las mismas propuestas de la revisión |
| Al retomar, sólo el documento que no coincidió (DECISIONES:126) | Documentos | Lo dice y marca «Cargado de nuevo hoy» / «Todavía no carga el nuevo» (cotejo.js:98-109,129-139) | VISIBLE | — |

## 5. Grupos (`grupos.html`, `app/grupos.js`)

| Regla (fuente) | Dónde se aplica | Qué ve hoy el personal | Clasificación | Propuesta concreta |
|---|---|---|---|---|
| Los cuatro cursos nunca se mezclan (DECISIONES:137) | Espera por curso | Una tarjeta por curso (grupos.js:21-48) | VISIBLE | — |
| Mínimo 5 y máximo 25, editables (DECISIONES:141) | Resumen | Texto general con los cupos del primer curso para los cuatro (grupos.js:15-17); por curso, «Faltan N para el mínimo» (grupos.js:32-34) | VISIBLE | Tomar los cupos de cada curso: si la administración cambia uno, el texto general queda mal |
| Prioridad a los 31 días de espera (DECISIONES:155; `dias_alerta_espera`) | Tarjeta del curso | «N esperan más de 31 días» (grupos.js:30), aunque cuenta desde 31 (personal.js:183) | VISIBLE (texto inexacto) | «N esperan 31 días o más» (ver D3) |
| Renovaciones con la acreditación vencida (DECISIONES:189) | Tarjeta del curso | «N personas con la acreditación vencida…» (grupos.js:31) | VISIBLE | Agregar las que vencen en los próximos 30 días: son las que hay que meter primero para que no lleguen a vencer |
| Cuántos grupos salen de la espera (mínimo 5, máximo 25) | Tarjeta del curso | «Alcanza para un grupo nuevo» igual con 6 que con 100 personas (grupos.js:33) | PARCIAL | «100 en espera: alcanza para 4 grupos de 25» |
| Grupos que todavía reciben personas (DECISIONES:145) | Tarjeta del curso | Sólo el primer grupo «por confirmar» del curso (grupos.js:27,36-37); los confirmados con lugar y los demás por confirmar no se mencionan | PARCIAL | Listar todos los que reciben: «APD-G-…-004 · por confirmar · 3 de 25 · de CFE»; «APD-G-…-002 · confirmado · 20 de 25 · recibe hasta el 23/10» |
| Grupo propio sólo con 5 de la misma organización (DECISIONES:143-144,181) | Tarjeta del curso | Nada; se ve hasta abrir la espera | PARCIAL (bajo riesgo: la espera ya lo resuelve) | «Alcanzan para grupo propio: CFE (12), Alcaldía Tlalpan (6)» |

## 6. En espera de un curso (`espera.html`, `app/espera.js`)

| Regla (fuente) | Dónde se aplica | Qué ve hoy el personal | Clasificación | Propuesta concreta |
|---|---|---|---|---|
| Grupo de una organización sólo con su gente y al menos 5 (DECISIONES:143-144,181) | Bloques por adscripción | Bloque por organización con cuántas son y si alcanzan (espera.js:48-72) | VISIBLE (corregido hoy) | — |
| Renovación ordenada por vencimiento (DECISIONES:155) | Orden y columna | Columna «Vence», marca de vencida (espera.js:28,81) | VISIBLE | Agregar los días que faltan («vence en 9 días»), como ya se hace para la persona (DECISIONES:89) |
| Prioridad a los 31 días (DECISIONES:155) | Filas | «· prioritaria» en la espera y cuenta arriba (espera.js:33-36,76) | VISIBLE | — |
| Un grupo recibe hasta 25 (DECISIONES:141) | Al elegir | «27 personas elegidas.» sin decir cuántas caben (espera.js:113-116); el error sale al presionar (espera.js:123-124) | OCULTA hasta actuar | «27 elegidas · un grupo recibe 25: quite 2». Pasa al elegir un bloque completo con «elegir a todas» (p. ej. 30 de CFE) |
| Un grupo de una organización sólo admite a su organización (DECISIONES:143; base `otra_organizacion`) | Botones «Agregar al grupo…» | El botón dice sólo folio y cupo (espera.js:142); de quién es el grupo se sabe al fallar (espera.js:125-128) | OCULTA hasta actuar | Texto del botón: «Agregar al grupo APD-G-…-004 · sólo CFE · 3 de 25». Desactivarlo (con su motivo) si la elección incluye a otras organizaciones |
| A un grupo confirmado se agrega hasta el día anterior al inicio (DECISIONES:145) | Botones «Agregar al grupo…» | No dice si el grupo está confirmado ni hasta cuándo recibe (espera.js:142) | PARCIAL | «· confirmado · inicia el 24/10 · recibe hasta el 23/10» |
| Si una organización no llega a 5, va a un grupo combinado (DECISIONES:144) | Diálogo «Crear un grupo» | El bloque lo dice (espera.js:64), pero el diálogo deja elegir «Sólo de esa organización» con 3 personas sin advertir (espera.html, diálogo `dlg-crear`; espera.js:171-176) | PARCIAL | En la opción «Sólo de CFE»: «Hay 3 de CFE en espera; el grupo no se podrá confirmar hasta tener 5 de CFE». Si no hay más en espera, sugerir combinado |
| Ya hay un grupo de esa organización armándose | Bloque | El bloque no lo dice; hay que leer los botones | PARCIAL | En la cabeza del bloque: «Ya hay un grupo de CFE por confirmar: APD-G-…-004 (3 de 25)» |
| Mínimo para confirmar (DECISIONES:142) | Al elegir | Lo dice la confirmación del combinado (espera.js:180), no la cuenta de elegidas | PARCIAL (bajo riesgo) | «3 elegidas · faltan 2 para el mínimo de 5» |

## 7. Un grupo (`grupo.html`, `app/grupo.js`)

| Regla (fuente) | Dónde se aplica | Qué ve hoy el personal | Clasificación | Propuesta concreta |
|---|---|---|---|---|
| Ningún grupo abre con menos del mínimo (DECISIONES:142) | Confirmar | «Faltan N personas…» y el formulario se oculta (grupo.js:155-161) | VISIBLE | — |
| Empieza al menos 7 días después de confirmar (DECISIONES:146) | Primer día | Fecha mínima, «desde el …» y días del curso (grupo.js:162-176) | VISIBLE | — |
| Días consecutivos; 5 o 1 día (DECISIONES:50,139) | Primer día | «del … al …» (grupo.js:172) | VISIBLE | — |
| Hora de entrada de lista cerrada (DECISIONES:147) | Hora | Lista (grupo.html:76-88) | VISIBLE | — |
| Se agrega hasta el día anterior al inicio (DECISIONES:145) | Acciones de un grupo confirmado | Botón «Agregar personas…» sin la fecha límite; el día del inicio dice «El curso ya empezó» (grupo.js:126-134) | PARCIAL | «Recibe personas hasta el 23/10 (quedan 4 lugares)» |
| Grupo de una organización: sólo se agrega su gente (DECISIONES:143) | Botón «Agregar personas de la espera (N en espera)» | N cuenta a todas las organizaciones (grupo.js:127-128) y la espera que se abre muestra todos los bloques (espera.js:32,105-106) | PARCIAL (cifra engañosa) | «3 de CFE en espera»; al abrir la espera desde ese grupo, mostrar sólo el bloque de su organización |
| Baja que deja al grupo bajo el mínimo: regresa a integración (DECISIONES:149) | Dar de baja | La confirmación lo dice (grupo.js:107-111) | VISIBLE | — |
| Baja y cancelación con motivo (ETAPA-2 §2c) | Diálogos | Motivo obligatorio con ejemplo (grupo.html:114-134) | VISIBLE | — |
| El instructor puede cambiar, también durante el curso (DECISIONES:31) | — | No hay pantalla para cambiarlo (ETAPA-2 §4) | NO APLICA (falta la pantalla) | — |
| Renovación: los vencimientos de quienes están en el grupo (DECISIONES:155,189) | Lista de personas | No hay columna «Vence» en el grupo | PARCIAL (bajo riesgo) | Columna «Vence» en los grupos de renovación, para elegir el primer día |
| El examen es el último día (DECISIONES:96,167) | Acciones en curso | «Aplicar el examen» sólo ese día (grupo.js:137), pero el enlace no lleva el folio del grupo | PARCIAL | Ver la sección 9 |

## 8. Asistencia (`asistencia.html`, `app/asistencia.js`)

| Regla (fuente) | Dónde se aplica | Qué ve hoy el personal | Clasificación | Propuesta concreta |
|---|---|---|---|---|
| Sólo de los días que ya ocurrieron (DECISIONES:150; base `dia_futuro`) | Botones por día | Días futuros desactivados (asistencia.js:72) | VISIBLE | — |
| El último día se registra al pasar lista (P94) | Botones | Texto propio (asistencia.js:45-47) | VISIBLE | — |
| Asistencia mínima 4 de 5; quién ya no puede faltar (DECISIONES:157-158) | Cada persona | «Ya no puede faltar otro día» / «Ya no tiene derecho a examen» y el mínimo en la bajada (asistencia.js:41,89-97) | VISIBLE | — |
| Un día sin capturar no cuenta como asistido (base: el examen exige `asistio` registrado, 03-apd-reglas.sql:1499-1502) | Botones por día | Sólo dice «capturado» en los días completos (asistencia.js:69-71); un día que ya pasó sin capturar, o capturado a medias, se ve igual que cualquier otro; las faltas de cada persona cuentan sólo las marcadas (asistencia.js:91) | OCULTA | «Día 2 · 15/10 · sin capturar» en ámbar y, arriba, «Falta capturar el día 2: sin él nadie llega a 4 de 5». Con 25 personas y 4 días, un día olvidado deja al grupo entero sin examen. Ver D4 |
| Todas marcadas para guardar (ETAPA-2 §1) | Guardar | Lo dice la ayuda; el error señala las filas (asistencia.js:118-120,161-166) | VISIBLE | — |
| Se corrige mientras siga el curso y no haya examen (ETAPA-2 §2c; base `asistencia_cerrada`, 03-apd-reglas.sql:1471-1472) | Corregir un día | La ayuda dice sólo «mientras siga el curso» (asistencia.html:51); el último día se puede editar a quien ya presentó examen | OCULTA (bajo riesgo) | Bloquear la fila de quien ya presentó examen: «Presentó examen: su asistencia ya no cambia» |

## 9. Aplicar el examen (`aplicar.html`, `app/aplicar.js`)

| Regla (fuente) | Dónde se aplica | Qué ve hoy el personal | Clasificación | Propuesta concreta |
|---|---|---|---|---|
| Derecho a examen con la asistencia mínima (DECISIONES:157-158,167) | Pase de lista | «3 de 4 días anteriores», «Sin derecho a examen · necesita 4 de 5», sin botones para quien no tiene derecho (aplicar.js:75,79-80) | VISIBLE (con cuenta simulada, D4) | Que la cuenta use la misma regla que la base y diga si hay días sin capturar |
| El examen es el último día (DECISIONES:96,167; ETAPA-2 §1) | Toda la pantalla | Abre el primer grupo en curso, sea o no del instructor y sea o no su último día (aplicar.js:33); muestra la fecha del examen pero no la compara con hoy (aplicar.js:41) | PARCIAL | Abrir el grupo del enlace (`?folio=`) o elegir entre los grupos del instructor; si hoy no es el último día: «Hoy es el día 3 de 5; el examen es el 24/10» sin pase de lista. Ver D5 |
| Calificación mínima 7.0 / 8.0 (DECISIONES:162) | Avance | En los datos del examen y en cada resultado (aplicar.js:43,107) | VISIBLE | — |
| La calificación no se modifica (DECISIONES:164) | Final | Aviso al terminar todas (aplicar.html:52) | VISIBLE | — |
| Un código en una sola computadora; reposición; suspensión con motivo (DECISIONES:166,169,173) | Avance y acciones | Intentos en otra computadora, «Código nuevo: el anterior ya no sirve», confirmación y motivo (aplicar.js:94-96,111-118,174-183) | VISIBLE | — |

---

## Donde la documentación y el código no dicen lo mismo

| # | Qué | Evidencia | Efecto |
|---|---|---|---|
| D1 | El tope de inasistencias está escrito fijo en la página | cotejo.js:172 (`inasistencias >= 1`) contra el parámetro `inasistencias_cotejo_maximas` (04-apd-catalogos.sql:21; ETAPA-2 §2a) | Si la administración cambia el parámetro, la pantalla anuncia el cierre en otra vuelta que la base |
| D2 | La cuenta de inasistencias se reinicia en la prueba y no en la base | archivos-prueba.js:294 la pone en 0 al volver a validar; la base cuenta todas las inasistencias de la solicitud (03-apd-reglas.sql:1066). La decisión (DECISIONES:124) no dice si se reinicia tras una revisión | Caso: no se presenta, después viene y un documento no coincide, se corrige, se valida otra vez y no se presenta: la pantalla dice «primera inasistencia, cita nueva» y la base cierra la solicitud. Liber tiene que decidir cuál vale |
| D3 | «Más de 31 días» contra «desde los 31» | grupos.js:30 y ETAPA-2:15 dicen «más de 31»; personal.js:183 cuenta desde 31 (`n >= alerta`), como DECISIONES:155 y espera.js:29 | Texto inexacto por un día |
| D4 | Días sin capturar: la prueba los cuenta como asistidos, la base como no asistidos | examen-grupo.js:46-50 (documentado como simulación; aplicar.html:61); base 03-apd-reglas.sql:1499-1502 | En la prueba nunca se ve el problema que sí ocurrirá con la base; la pantalla de asistencia no avisa de días sin capturar |
| D5 | El examen «el último día» no lo exige nadie | DECISIONES:96,167 y ETAPA-2 §1; la base acepta un examen en cualquier día entre el inicio y hoy (03-apd-reglas.sql:1504-1505); aplicar.js no compara la fecha | Se puede pasar lista y generar códigos el día 2 |
| D6 | El folio fiscal repetido no trae mensaje | REGLAS:121-122 dice que cada regla incumplida trae mensaje y código; el folio sólo tiene una restricción única (02-apd-tablas.sql:344), sin `apd.error` | El personal recibiría un error genérico de la base |
| D7 | «Vigente hasta» sin comprobar la vigencia | revisar.js:86-87,100 toma la acreditación de poda más reciente y escribe «vigente hasta el …» aunque ya haya vencido | Puede hacer pensar que se debe rechazar o que sí está vigente; la regla dice que no se vuelve a comprobar (DECISIONES:193) |
| D8 | Los cupos del texto de «Grupos» salen del primer curso | grupos.js:15-17 contra DECISIONES:141 («editables por la administración») | Si un curso cambia de cupo, el texto general miente para los demás |

---

## Las 10 que más probablemente causen un error o un conteo a mano

1. **Días de asistencia sin capturar** (Asistencia; D4). Nada dice que un día pasado quedó sin capturar o a medias, y
   la base lo cuenta como falta al dar el derecho a examen. Con 25 personas y 4 días, un día olvidado deja a todo el
   grupo sin examen y se descubre en el salón de cómputo. *Propuesta:* «Día 2 · sin capturar» en ámbar y un aviso
   arriba con lo que pasa si no se captura.
2. **Asignar la cita sin ver la agenda** (Revisar y Cotejo; P69). Quien valida elige día y hora sin saber cuántas citas
   hay ya. Con 40 citas al día se amontonan en las 09:00. *Propuesta:* junto a cada hora, cuántas citas tiene ya; junto
   a la fecha, el total del día.
3. **Citas de días anteriores sin registrar** (Citas). La agenda abre en hoy y no señala citas pasadas que siguen «por
   atender». Si nadie registra la inasistencia, la persona no recibe su cita nueva y la regla de la segunda inasistencia
   no se aplica. *Propuesta:* aviso «N citas de días anteriores sin registrar», con enlace a cada una.
4. **Segunda inasistencia** (Citas y Cotejo; D1, D2). La agenda no distingue las segundas citas. En el cotejo el tope
   está escrito fijo, la prueba reinicia la cuenta y la base no, así que la pantalla puede ofrecer «cita nueva» cuando
   la base va a cerrar la solicitud. *Propuesta:* etiqueta «2.ª cita · si no viene se cierra» en la agenda; leer el
   parámetro; decidir si la cuenta se reinicia tras una revisión.
5. **Agregar a un grupo de una organización** (Grupo y Espera). El botón dice «(100 en espera)» aunque sólo 3 sean de
   esa organización, la espera muestra a todas y el error sale al presionar. *Propuesta:* contar sólo a las de su
   organización y, al llegar desde ese grupo, mostrar sólo su bloque; en los botones de la espera, «sólo CFE».
6. **Crear un grupo propio que nunca se va a confirmar** (Espera). El diálogo deja crear un grupo «sólo de CFE» con 3
   personas sin recordar que necesita 5 de CFE; el grupo queda detenido mientras esas personas podrían ir a uno
   combinado. *Propuesta:* aviso en la opción con cuántas hay en espera de esa organización.
7. **Elegir más de 25** (Espera). La cuenta de elegidas no dice cuántas caben; con «elegir a todas» en un bloque de 30
   el personal se entera al fallar. *Propuesta:* «27 elegidas · un grupo recibe 25: quite 2».
8. **Pausa vencida** (Citas y Cotejo). Una pausa de otro día sigue con «Retomar» y la página dice sólo la hora; la base
   rechaza cualquier cierre que no sea regresarla con observaciones. *Propuesta:* «Pausa vencida» en la agenda y, en el
   cotejo, sólo la salida permitida.
9. **Aplicar el examen en el grupo o el día equivocado** (Aplicar; D5). La pantalla abre el primer grupo en curso, no el
   del enlace ni el del instructor, y no compara la fecha del examen con hoy; la base tampoco lo exige. Con dos o más
   grupos en curso a la vez se puede pasar lista en el grupo equivocado. *Propuesta:* abrir por folio, elegir entre los
   grupos propios y bloquear el pase de lista si hoy no es el último día.
10. **Resumen de «Grupos» que no dice cuántos grupos ni cuáles reciben** (Grupos). «Alcanza para un grupo nuevo» vale lo
    mismo para 6 que para 100 personas, y sólo se menciona un grupo por confirmar (ni los demás ni los confirmados con
    lugar), así que se pueden abrir grupos de más. *Propuesta:* «alcanza para 4 grupos de 25» y la lista de grupos que
    reciben, con lugares y fecha límite.

Le siguen, con menos riesgo: la bandeja de revisión sin cuántas están en rojo o en ámbar; los años de experiencia que
no se repiten en el bloque de «Comprobantes de experiencia»; el folio fiscal repetido sin mensaje (D6); la fecha límite
para agregar personas a un grupo confirmado; y las renovaciones por vencer que no se cuentan en «Grupos».

## Reglas pendientes que hoy no se pueden mostrar

P02 (plazos de la revisión y de las observaciones), P69 (días, horario y cupo de las citas), P91 (horarios del curso),
P94 (asistencia del último día) y P92 (quién arma los grupos). Para P69 conviene mostrar desde ya cuántas citas hay en
cada horario (punto 2), aunque todavía no exista un tope.
