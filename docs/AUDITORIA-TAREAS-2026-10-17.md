# Auditoría de tareas de las pantallas del personal · 2026-10-17

Pedido de Liber después del caso de «En espera» (la pantalla obligaba a contar a mano quiénes eran de cada
organización): revisar las nueve pantallas del personal con tres métodos y entregar los hallazgos **antes de cambiar
nada**.

1. **Una pregunta de trabajo por pantalla.** Si para contestarla hay que contar, buscar o recordar, la pantalla está mal
   pensada.
2. **Cada regla, visible donde se aplica.** Cada regla del registro de decisiones, de `docs/REGLAS.md` y de la base,
   contra lo que ve el personal en el momento de aplicarla (detalle: `docs/auditoria-tareas/reglas-vs-pantallas.md`).
3. **Volúmenes reales.** Escenario de prueba con 65 solicitudes por revisar, 40 citas en un día (y 30 más en la semana),
   112 personas en espera (66 de poda nueva, en 13 adscripciones), un grupo de 25 en su último día y 8 grupos. Se sirve en
   lugar de `datos/ficticios.json` sólo durante la prueba (`herramientas/escenario-volumen.mjs` y
   `herramientas/capturas-volumen.mjs`, antes en `docs/auditoria-tareas/`); no cambia los datos ficticios del sitio.

Alto de las páginas en teléfono con ese volumen: bandeja de revisión 33 pantallas, «En espera» de poda nueva 20, citas
16, grupo en curso 9, asistencia 8.

Cada hallazgo se comprobó leyendo el código; los que dependen de la base, contra `db/apd/03-apd-reglas.sql`.

## Alta: pueden cambiar el resultado de un trámite

| # | Pantalla | Qué pasa | Evidencia | Propuesta |
|---|---|---|---|---|
| A1 | Asistencia | Un día pasado que nadie capturó, o que quedó a medias, se ve igual que cualquier otro. La base lo cuenta como falta al decidir quién tiene derecho a examen; la prueba lo cuenta como asistido, así que nunca se ve el problema. Un día olvidado deja sin examen a un grupo completo | `asistencia.js:69-71`, `examen-grupo.js:46-50`, `03-apd-reglas.sql:1499-1502` | Marcar en rojo «Día 2 · sin capturar» y avisar arriba «Falta capturar el día 2: sin eso, nadie lo tiene como asistido»; en «Aplicar el examen», no permitir pasar lista con días sin capturar |
| A2 | Aplicar el examen | Abre el primer grupo en curso, no el que presenta examen hoy; no hay forma de elegir. Con dos grupos en curso mostró el que presenta el 17/10 en lugar del que presenta hoy. Ni la pantalla ni la base exigen que el examen sea el último día | `aplicar.js:34`, `examen-grupo.js:27`, `03-apd-reglas.sql:1504` | Abrir el grupo cuyo último día es hoy (o el del enlace); si hay varios, elegir; si no es su último día, decirlo y no generar códigos |
| A3 | Citas de cotejo | Una cita de un día anterior que nadie registró sigue «Por atender» y la agenda abre en hoy: no se ve. Si no se registra que la persona no se presentó, no recibe cita nueva y la regla de la segunda inasistencia nunca se aplica | `citas.js:30` | Aviso arriba: «3 citas de días anteriores sin registrar» con enlace; marcarlas como atrasadas |
| A4 | Cotejo | La segunda inasistencia: la pantalla fija el límite en el código (`inasistencias >= 1`) en lugar de leer el parámetro (2). La prueba reinicia la cuenta cuando la solicitud se vuelve a validar; la base cuenta todas las inasistencias de la solicitud. La pantalla puede ofrecer «cita nueva» y la base cerrar la solicitud | `cotejo.js:172`, `archivos-prueba.js:294`, `03-apd-reglas.sql:1066` | **Decisión de Liber:** ¿la cuenta se reinicia cuando la solicitud se valida otra vez? Luego, leer el parámetro y alinear prueba y base |
| A5 | Grupo, «Mis trámites» | La hora de entrada que viene de la base («09:00:00») sale con segundos en el grupo y en «Mis trámites» («a las 09:00:00»), y al volver a confirmar la lista de horas queda vacía | `grupo.js:72`, `grupo.js:168`, `tramites.js:95` | Mostrar y preseleccionar HH:MM |

## Media: hay que contar, recordar o aprender por el error

| # | Pantalla | Qué pasa | Evidencia | Propuesta |
|---|---|---|---|---|
| M1 | Grupo de una organización → «En espera» | «Agregar personas de la espera (66 en espera)» cuenta a todo el curso, y la espera que abre muestra a todas las adscripciones; sólo al presionar dice que no son de esa organización | `grupo.js:127-128`, `espera.js:80-83` | Contar y mostrar sólo a las de esa organización («7 de Iztapalapa en espera») |
| M2 | En espera | Los botones dicen sólo folio y cupo («Agregar al grupo APD-G-2026-021 (3 de 25)»); no dicen que el 021 es sólo de Jardines y el 023 sólo de Iztapalapa | `espera.js` (acciones) | Poner el destino dentro del bloque de su organización y, en los botones, de quién es el grupo |
| M3 | En espera | El bloque de Jardines dice «Alcanza para un grupo propio» aunque ya hay un grupo de Jardines por confirmar al que le faltan 2; invita a crear un segundo. Crear un grupo «sólo de esa organización» con menos de 5 se permite sin aviso, contra la decisión de que esas personas van a un combinado | `espera.js` (bloques), `espera.js:171-176` | En el bloque: «Su grupo APD-G-2026-021 recibe a 22 más; le faltan 2 para el mínimo»; avisar en el diálogo si son menos de 5 |
| M4 | En espera | La cuenta de elegidas no dice cuántas caben; el límite se descubre con el error. En teléfono los botones están al final de 20 pantallas | `espera.js:113-124` | «7 elegidas · caben 22 en el APD-G-2026-021» en una barra que acompaña el desplazamiento |
| M5 | Revisar una solicitud | Al fijar la cita no se ve cuántas hay ese día y a esa hora (40 en el día, 4 por media hora); se descubre en otra pantalla | `revisar.html:302-326`, `cotejo.js:244` | Junto a la fecha y la hora: «Ese día: 38 citas · a las 09:00: 4». Útil aunque el cupo por horario siga pendiente (P69) |
| M6 | Citas → Cotejo | Una pausa vencida sigue con «Retomar» y el cotejo sólo muestra la hora de la pausa, no el día; la base la rechaza | `cotejo.js:102`, `03-apd-reglas.sql:1042` | Marcar «Pausa vencida» y quitar «Retomar»; mostrar fecha y hora |
| M7 | Grupos | La tarjeta de cada curso menciona un solo grupo que se está armando (había tres) y ninguno confirmado con lugares; «Alcanza para un grupo nuevo» se lee igual con 6 que con 100 | `grupos.js:27`, `grupos.js:33` | Listar todos los grupos que reciben personas, con lugares; decir cuántos grupos completos alcanzan |
| M8 | Bandeja de revisión | El contador dice «Se muestran las 65 solicitudes»; no dice cuántas pasan de 10 días (rojo) o de 3 (ámbar). La explicación de los colores está debajo de las 65 filas | `revision.html:71` | «65 por revisar · 38 con 10 días o más · 12 con 3 a 9» arriba |
| M9 | Asistencia | Sin resumen: hay que recorrer 25 filas para saber quién ya no tiene derecho a examen o ya no puede faltar («Aplicar el examen» sí lo resume) | `asistencia.js:94` | Resumen arriba |
| M10 | Grupo confirmado | No dice hasta cuándo recibe personas (el día anterior al inicio) | `grupo.js:126` | «Recibe personas hasta el 25/10/2026 · 7 lugares» |
| M11 | Bandeja de revisión | Dos revisoras pueden abrir y decidir la misma solicitud; no se ve quién la tiene abierta | `revision.js`, `revisar.js` | Etapa 3: marcar «La está revisando …» y avisar si otra persona ya la decidió |

## Baja

- «Esperan más de 31 días» (`grupos.js:30`) cuando la regla marca desde los 31 (`personal.js:183`).
- En la revisión de un dictaminador, «Poda y derribo: vigente hasta …» sin comprobar que siga vigente (`revisar.js:100`).
- El encabezado de «Grupos» toma el cupo del primer curso para los cuatro (`grupos.js:15-17`); hoy coinciden.
- Un folio fiscal repetido sólo lo detiene una restricción de la base, sin mensaje propio (`02-apd-tablas.sql:344`), aunque
  `docs/REGLAS.md` pide que cada regla tenga uno.
- Los años de experiencia requeridos no se repiten junto a «Comprobantes de experiencia» en la revisión.
- Los grupos de renovación no muestran cuándo vence la acreditación de cada persona.
- El mínimo de 10 caracteres de una observación no se dice antes de escribirla.
- Con volumen real, 38 de 66 personas son «prioritarias»: la marca pierde fuerza.

## Reglas pendientes sin nada que mostrar todavía

P02 (plazos), P69 (horarios de cita), P91 (horario del curso), P92 (quién arma los grupos) y P94 (asistencia del último
día). Para P69 se recomienda mostrar ya cuántas citas hay por hora (M5).

## Estado (versión de prueba 0.39, bloque 59)

Liber aprobó corregir («adelante corrige»). Prueba nueva con el escenario de volumen: `npm run volumen`
(`herramientas/probar-volumen.mjs`, 50 comprobaciones, 25 en teléfono y 25 en escritorio).

| # | Estado |
|---|---|
| A1 | Corregido: el día pasado sin capturar sale «sin capturar» en rojo y con aviso arriba; «Aplicar el examen» avisa que faltan días (en la prueba se siguen contando como asistidos, con el aviso; en el sistema no deja pasar lista) |
| A2 | Corregido: abre el grupo del enlace o el que presenta hoy; lista los otros grupos en curso con la fecha de su examen; si no es el día, lo dice (en el sistema no genera códigos) |
| A3 | Corregido: aviso «N citas de días anteriores están sin registrar» con un botón por día; la cita sale «Sin registrar · el día ya pasó» |
| A4 | Pendiente de decisión (P123). Mientras, la pantalla cuenta como la base: todas las inasistencias de la solicitud, con el parámetro y sin reiniciar al validar de nuevo |
| A5 | Corregido: hora de entrada HH:MM en el grupo y en «Mis trámites», y preseleccionada al volver a confirmar |
| M1 | Corregido: el grupo de una organización cuenta sólo a su gente y la espera que abre muestra sólo su bloque |
| M2 | Corregido: cada botón dice de quién es el grupo («sólo Iztapalapa», «combinado») |
| M3 | Corregido: el bloque de una organización con grupo propio dice «Su grupo …: 3 de 25, le faltan 2»; el diálogo avisa si son menos del mínimo o si ya tiene su grupo |
| M4 | Corregido: barra fija con la cuenta de elegidas y un enlace a los botones; la cuenta dice cuántas caben |
| M5 | Corregido: al fijar la cita (revisión y cotejo) se ve cuántas hay ese día y a esa hora |
| M6 | Corregido: la pausa vencida sale «Pausa vencida», sin «Retomar»; el cotejo no la retoma y dice la fecha |
| M7 | Corregido: la tarjeta lista todos los grupos que reciben personas y cuántos grupos nuevos alcanzan |
| M8 | Corregido: «65 solicitudes por revisar: 38 con 10 días o más y 12 de 3 a 9 días» |
| M9 | Corregido: resumen arriba de la asistencia, con lo marcado al momento |
| M10 | Corregido: «Recibe personas hasta el …; quedan N lugares» |
| M11 | Pendiente para la etapa 3 (P122) |
| Bajos | Corregidos: «31 días o más»; «vencida el …» en la revisión de un dictaminador; mínimo de 10 caracteres dicho en la ayuda; folio fiscal repetido con su mensaje (`folio_fiscal_repetido`, caso en `probar-reglas`). Sin cambio: el encabezado de «Grupos» con el cupo del primer curso (hoy son iguales), los años de experiencia junto a sus comprobantes (ya están en el perfil de la revisión), la columna «Vence» en grupos de renovación y la marca de prioritaria (es la regla de 31 días) |

Además: en teléfono, la situación de un bloque de «En espera» ensanchaba la tabla; ya se parte en líneas (comprobado).

