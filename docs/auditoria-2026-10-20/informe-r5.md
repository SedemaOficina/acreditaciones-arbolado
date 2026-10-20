# Auditoría de seguimiento 20/10/2026 · r5 · C5 Textos y D4 Peso y velocidad

Versión de prueba 0.61 + PR #5 (commit `d58c611`), estándar de formularios 1.5.1. Revisor r5, en solo lectura, sobre la
copia `<copia del revisor r5>`. Todos los guiones y salidas están en esta carpeta
(`docs/auditoria-2026-10-20/ (r5) `) y se pueden repetir en la próxima auditoría.

**Totales: 9 hallazgos nuevos: 0 críticos, 0 altos, 3 medios, 5 bajos y 1 informativo**, más 3 fallas del componente
compartido, ninguna con clave Pnn (2 ya anotadas el 17/10). Además se confirmó el estado de 27 hallazgos de textos ya registrados (sección 2.3): 14
corregidos y 13 que siguen igual o en parte.

---

## 1. Qué hice

### C5 · Textos

| Paso | Cómo | Guion y salida |
|---|---|---|
| Recorrido de pantallas con scripts | Chromium 141 (Playwright 1.63), zona America/Mexico_City, 390 px (persona) y 1280 px (personal). **129 estados de las 21 pantallas**: los **40 casos del menú de pruebas** (cada uno en «Mis trámites»; además la solicitud en borrador y con observaciones, «Cargar el documento correcto» en los casos de cita, «Crea tu cuenta» de los dos casos del registro anterior y «Mi perfil»), las 5 públicas con sus envíos vacíos y con error (contraseña equivocada, verificación vigente, vencida e inexistente), las 12 del personal con datos ficticios (12 «revisar», 8 cotejos, 4 cursos en «Grupos» y en «Programar», los 7 grupos, asistencia y aplicar por grupo, sin folio y con folio inexistente), el **examen completo** (código mal escrito, inexistente, ¿eres tú?, instrucciones, pregunta, revisión, confirmación y resultado) y **20 estados con el escenario de volumen**. Por estado guarda el texto visible, el de los bloques ocultos (`[hidden]`, diálogos cerrados, `<template>`) y los atributos que se leen o se oyen (`aria-label`, `placeholder`, `title`, `alt`, descripción). Excluye el menú de pruebas. 0 errores de página | `c5-recorrido.mjs` → `c5-pantallas.json` (4,346 renglones distintos) |
| Textos que sólo salen en un caso | Cadenas de `sitio/app/*.js` con archivo y línea (incluye `mensajes-usted.js`, `archivos-prueba.js`, `pruebas.js`), del estándar (`formkit/js/validaciones.config.js`, `formkit.core.js` y los 19 módulos), los **145 mensajes de la base** (`apd.error` en `db/apd/03-apd-reglas.sql`) y `docs/AVISOS-POR-CORREO.md` | `c5-fuentes.mjs` → `c5-fuentes.json` (1,871 cadenas) |
| Documentos generados | Acuse de «Crea tu cuenta» y de la solicitud, enviados con «Llenar con datos ficticios», y lo que «Mis trámites» dice del mismo envío; dos vueltas en contexto nuevo | `c5-acuses.mjs` → `c5-acuses.json`, `capturas/c5-acuse-*.png` |
| Detectores | Trato (pronombres, verbos de tú y de usted al inicio de oración), nombres internos (`snake_case`, `camelCase`, `null`/`undefined`/`NaN`, marcadores sin reemplazar, `apd.`), 15 formas de fecha y hora, montos y números, 27 conceptos con sus variantes, tecnicismos, acentos, «sólo/solo», puntuación y tono. **Cada candidato se revisó a mano**: los detectores sólo marcan | `c5-analisis.py` → `c5-detectores.json`, `c5-detectores.md`, `c5-trato.md`; `c5-fechas.py` → `c5-fechas.md` |
| Cobertura del usted | Claves efectivas de `FormKit.config.mensajes` en una pantalla del personal contra `mensajes-usted.js` | `c5-usted-cobertura.mjs` → `c5-usted-cobertura.txt` |
| Reproducción | Cada hallazgo de pantalla, dos vueltas en contexto nuevo, con captura | `c5-repro.mjs` → `c5-repro.txt` (18 de 18 comprobaciones) |

**Qué cubren las herramientas que ya existían y qué no.** `herramientas/inventario-textos.mjs` lee las páginas **sin
ejecutar sus scripts** y sólo 9 pantallas de la persona; `inventario-textos.py` le suma una lista curada a mano de textos
dinámicos, la base y las validaciones del estándar. `docs/textos/` es del 17/10/2026 (commit `fa41f64`): 297 textos de 7
pantallas (sin «Cargar el documento correcto» ni «Material de estudio», que la herramienta ya lista pero no se
regeneraron) y todavía dice «Mis datos». **No cubren** las 12 pantallas del personal, el examen, lo que pintan los
scripts según el caso (salvo la lista curada), los acuses, ni el escenario de volumen. Mis guiones cubren eso; no
reemplazan a los suyos (no escriben `docs/`). **Lo que no cubren los míos:** diálogos de confirmación que sólo se abren
al presionar un botón (los leí en el código), los textos del menú de pruebas (sólo existe en la prueba), los avisos
por correo reales (el documento describe el contenido, no el texto) y el texto que lee un lector de pantalla real
(no hay uno aquí).

### D4 · Peso y velocidad

| Paso | Cómo | Guion y salida |
|---|---|---|
| Peso de la primera carga | Las 21 pantallas a 390 y 1280 px, contexto nuevo sin caché; con CDP se cuenta cada respuesta (también el worker de pdf.js, que no sale en la sesión de la página). Se separa propio, propio sólo de prueba, estándar, pdf.js, fuentes, imágenes y `ficticios.json`. Se estima gzip (nivel 6) y brotli (nivel 11) comprimiendo cada archivo de texto. Con los datos ficticios y con el escenario de volumen | `d4-peso.mjs` → `d4-peso-ficticios.{json,md}`, `d4-peso-volumen.{json,md}`, `d4-peso-resumen.md` |
| Segunda visita | Recorrido de la persona (inicio → entrar → trámites → perfil → trámites) y del personal (bandeja → revisar → bandeja → citas) con caché | `d4-segunda-visita.mjs` → `d4-segunda-visita.txt` |
| Tiempo hasta que es usable | CDP `Network.emulateNetworkConditions` y `Emulation.setCPUThrottlingRate`. **3G lento** = latencia 2,000 ms, 400 kbit/s (perfil «Slow 3G» de DevTools); **4G lento** = 562.5 ms, 1,474.56 / 675 kbit/s (perfil móvil de Lighthouse). Perfiles: persona en teléfono de gama baja (3G lento + procesador 6×), gama media (4G lento + 4×) en las 21 pantallas; personal con volumen sin freno de red (oficina) con 4× y 6×, y con 4G lento + 4×. «Usable» = último cambio del DOM antes de 1.5 s de calma con la red quieta, o el fin de la última tarea larga si es posterior. También primer contenido, DOM listo, tiempo bloqueado (TBT) y tarea más larga. **Dos repeticiones** de cada combinación | `d4-tiempos.mjs`, `d4-correr.sh`, `d4-correr-gzs.sh` → `d4-tiempos.jsonl`, `d4-resumen.py` → `d4-tiempos.md` |
| Con compresión | Servidor propio (`servidor-r5.mjs`, mismo comportamiento que `python -m http.server` pero HTTP/1.1 y gzip por prefijo de la dirección). Control de que la red simulada cobra los bytes comprimidos: `ficticios.json` baja en 20.8 s sin comprimir y en 4.2 s con gzip (`d4-sonda-gzip.txt`) | `servidor-r5.mjs`, `d4-sonda-gzip.mjs`, `d4-cascada.mjs` → `d4-cascada-index.txt`, `d4-cascada-tramites.txt` |
| Interacción con volumen | Event Timing (de la entrada a lo siguiente pintado) en 7 acciones del personal, 4× y 6×, dos vueltas | `d4-interaccion.mjs` → `d4-interaccion.jsonl` |

**Equipo compartido.** La máquina (2 procesadores) la usaban a la vez otros revisores: carga media 8.2 durante las
mediciones. Antes de cada carga se midió un cálculo fijo sin freno (mediana 81 ms, de 49 a 311 ms). Por eso **los
tiempos que dependen del procesador son una cota superior**; los que dependen de la red (3G) varían poco entre
repeticiones (±0.5 s en la mayoría). El servidor de prueba del encargo se cambió por `servidor-r5.mjs` en el mismo
puerto 8905 para las mediciones con compresión; sirve los mismos archivos de `sitio/` sin tocarlos.

**Número de pruebas:** 129 estados de pantalla, 1,871 cadenas de código, 2 × 2 acuses, 18 comprobaciones de
reproducción; 84 cargas para el peso, 9 de segunda visita, 280 cargas cronometradas, 32 interacciones. Firefox y
WebKit no están disponibles (la red bloqueó su descarga). No hay lector de pantalla real.

**Solo lectura:** las huellas de los 254 archivos de la copia se tomaron al empezar (`huellas-antes.txt`) y se
compararon al terminar (`huellas-despues.txt`): sección 8.

---

## 2. Hallazgos

### 2.1 Medios

**D4-01 · Cada pantalla descarga todos los datos ficticios (760 KB), otra vez en cada pantalla, y un tercio es una bitácora que ninguna pantalla lee** · Media · S · prototipo (`sitio/app/apd.js:80`, `sitio/datos/ficticios.json`)
- **Dónde:** las 21 pantallas, también las públicas (inicio, entrar, verificar, material), en teléfono y escritorio.
- **Qué pasa:** `APD.cargar` pide `datos/ficticios.json` con `cache: 'no-store'`. El archivo pesa 760 KB (2.26 MB con el escenario de volumen) y es **el 57 a 60 % de cada primera carga** en teléfono (1.26 a 1.48 MB). Por `no-store` se vuelve a descargar al pasar de una pantalla a otra: 761 a 853 KB por navegación (las demás piezas sí salen de la caché). La tabla `bitacora` (871 filas) es el 34.5 % del archivo y `grep` no encuentra ningún uso en `sitio/app/` ni en el estándar. El archivo creció de 546 KB (17/10, `fa41f64`) a 779 KB (19/10, `ef47a4a`).
- **Esperado:** que cada pantalla reciba sólo lo que usa y que lo que no cambia no se descargue en cada pantalla.
- **Consecuencia:** con 3G lento, sólo ese archivo tarda 20.8 s de los 32 a 43 s que tarda una pantalla de la persona en quedar usable; en una prueba en teléfono real (P33) el tiempo medido no representa al sistema. No llega al SIA (la API lo sustituye), pero distorsiona la prueba y la demostración al área.
- **Cómo se reproduce:** `node d4-peso.mjs ficticios`; `node d4-segunda-visita.mjs`; `node d4-sonda-gzip.mjs`.
- **Evidencia:** `d4-peso-resumen.md` (columna `ficticios.json`), `d4-segunda-visita.txt` («persona · tramites: 761.0 KB por la red… ficticios.json descargado 1 vez» en cada paso), `d4-sonda-gzip.txt`.
- **Reproducido:** 2 de 2 (peso idéntico en las dos corridas y en los dos anchos).
- **Causa probable:** la exportación (`herramientas/exportar-ficticios.mjs`) incluye todas las tablas; `no-store` se puso para que todas las pantallas vean lo último (lo guardado en el navegador se mezcla aparte, en `archivos-prueba.js`).
- **Corrección propuesta:** no exportar `bitacora` al sitio (o en un archivo aparte que nadie pide) y pedir `ficticios.json` con `cache: 'no-cache'` (revalida, no descarga de nuevo si no cambió); lo guardado en el navegador ya se mezcla en cada carga.
- **Listo cuando:** `d4-segunda-visita.mjs` muestra menos de 100 KB por navegación tras la primera y `ficticios.json` sin la tabla `bitacora` (prueba automática: tamaño y lista de tablas).
- **Estado:** Abierto.

**D4-02 · Con el HTML comprimido, los scripts se descargan uno tras otro y la pantalla tarda el doble** · Media · S · las 21 páginas (scripts de bloqueo al final de `<body>`)
- **Dónde:** probado en `index.html` y `tramites.html`, teléfono, 3G lento, procesador sin freno.
- **Qué pasa:** cada página carga de 10 a 20 scripts clásicos al final del `<body>`, sin `defer`. Con el HTML **sin** comprimir, Chromium los pide todos a la vez (escáner de precarga): en `index` empiezan todos a los 2.1 s y el DOM queda listo a los 13.0 s (scripts y datos con gzip). Con el HTML **también** comprimido, como lo serviría un servidor que comprime `text/html` (el comportamiento normal de nginx), cada script se pide hasta que termina el anterior: el DOM queda listo a los 27.6 s. Igual en `tramites`: 12.4 s contra 27.8 s.
- **Consecuencia:** con 2 s de latencia, cada script de más es un viaje de ida y vuelta más; la mejora de comprimir (de 1.3 MB a 0.3 MB) se pierde y la pantalla tarda más que sin comprimir.
- **Cómo se reproduce:** con `servidor-r5.mjs` en 8905, `MODOS=,gz,gzs node d4-cascada.mjs index` y `node d4-cascada.mjs tramites` (`gz` = todo comprimido, `gzs` = todo menos el HTML).
- **Evidencia:** `d4-cascada-index.txt` y `d4-cascada-tramites.txt` (columna de inicio de cada petición: en «gz» cada una empieza al terminar la anterior).
- **Reproducido:** 2 de 2 páginas, cada una dos veces (primero con cabecera y luego con prefijo de dirección: mismo resultado).
- **Causa probable:** el escáner de precarga de Chromium no adelantó los scripts cuando el documento llegó completo de una vez. **Medido en la red simulada de Chromium 141; no comprobado en un teléfono real** (va con P33).
- **Corrección propuesta:** declarar los scripts en `<head>` con `defer` (conserva el orden y corre antes de `DOMContentLoaded`), o un paquete por pantalla en la entrega al SIA. Así el descubrimiento no depende del escáner.
- **Listo cuando:** `d4-cascada.mjs` en modo `gz` muestra todos los scripts pedidos en el primer segundo después del HTML.
- **Estado:** Abierto; confirmar en red real (P33).

**C5-01 · Fechas y horas en 14 formas; hasta 5 en una misma pantalla** · Media · M · 15 pantallas y el acuse
- **Dónde y qué pasa:** el sistema usa día/mes/año y 24 horas (no hay ninguna hora de 12 horas ni con «a. m./p. m.»: 0 de 119 horas). Pero la misma idea se escribe de formas distintas, a veces en la misma tarjeta (tabla completa en `c5-fechas.md`):

  | Forma | Ejemplo | Pantallas | Dónde se arma |
  |---|---|---|---|
  | dd/mm/aaaa (la del sistema) | «Vence el 05/11/2026» | 16 | `APD.fecha` |
  | dd/mm/aaaa, HH:MM | «Cita de cotejo 20/10/2026, 10:00» | 3 | `APD.fechaHora` (`apd.js:169`) |
  | dd/mm/aaaa a las HH:MM | «Acude a tu cita el 20/10/2026 a las 10:00» | 2 | `cotejo.js:337`, `revisar.js:331` |
  | dd/mm/aaaa, a las HH:MM | «Tu curso empezó el 13/10/2026, a las 09:00» | 1 | `tramites.js:121` |
  | d de mes de aaaa, HH:MM | acuse: «Recibida el 14 de octubre de 2026, 18:00» | acuses | estándar (sección 4) |
  | Día, d de mes de aaaa | agenda: «Miércoles, 14 de octubre de 2026» | 1 | `citas.js:18` |
  | Día d de mes al día d de mes | «Lunes 2 de noviembre al viernes 6 de noviembre» | 1 | `programar.js:394` |
  | del dd/mm/aaaa al dd/mm/aaaa | asistencia: «del 13/10/2026 al 17/10/2026» | 4 | `asistencia.js:66`, `grupo.js:206` |
  | día dd/mm (sin año) | «examen el sábado 17/10 en el PILARES» | 3 | `grupos.js:348-361` |
  | dd/mm (sin año) | «Falta capturar el día 2 (13/10)», encabezados de días | 2 | `asistencia.js:21`, `personal.js:510` |
  | del d al d de mes · d al d de mes | nombre del grupo, semanas del planeador | 7 | `APD.rangoFechas` (decisión 18/10, propuesta D) |

  En una misma pantalla: «Mis trámites» 5 formas (la tarjeta de la cita dice «20/10/2026, 10:00» y debajo «el 20/10/2026 a las 10:00»), «Programar» 5 («Desde el miércoles 21/10/2026», «Lunes 2 de noviembre al viernes 6 de noviembre» y «del 2 al 6 de noviembre»), «Asistencia» 5, «Cotejo» 5 y «Grupos» 5. El mismo curso es «del 13 al 17 de octubre» en «Grupos» y «del 13/10/2026 al 17/10/2026» en «Asistencia».
- **Esperado:** un formato de fecha y una sola manera de unir fecha y hora. El nombre del grupo con «del 13 al 17 de octubre» es decisión del dueño (18/10) y no se cuenta como falla.
- **Consecuencia:** la persona y el personal tienen que reconocer la misma fecha en formas distintas; con «17/10» sin año, un curso que cruza de diciembre a enero se presta a error.
- **Ya registrado en parte:** la auditoría integral del 17/10 (`docs/auditoria-integral/C-textos.md`, §4) pidió unificar «20/10/2026, 10:00» y «a las 10:00» en «Mis trámites» y señaló la fecha larga del acuse. **Siguen igual**, y desde entonces aparecieron las formas de «Programar», «Asistencia», la agenda y el planeador (pantallas de la 0.49 en adelante).
- **Cómo se reproduce:** `node c5-repro.mjs` (casos C5-01a a C5-01f); `python3 c5-fechas.py`.
- **Evidencia:** `c5-repro.txt`, `capturas/C5-01a.png` a `C5-01f.png`, `c5-fechas.md`, `c5-fechas-muestra.txt` (lo que da cada función con el mismo instante).
- **Reproducido:** 2 de 2.
- **Causa probable:** cada pantalla arma su texto; `APD.fechaHora` usa la coma de `toLocaleString` y otras pantallas escriben «a las» a mano.
- **Corrección propuesta:** ver «Para decidir» 2. Propuesta: fecha siempre dd/mm/aaaa (con el día de la semana delante cuando ayuda: «martes 20/10/2026»); fecha y hora siempre «20/10/2026 a las 10:00» (`APD.fechaHora` con «a las»); rangos de fechas de un curso con el nombre del grupo (decidido) o «del 13/10/2026 al 17/10/2026», uno solo; sin año sólo en encabezados de columna.
- **Listo cuando:** `c5-fechas.py` (o su versión en `herramientas/`) da, por pantalla, sólo las formas aprobadas.
- **Estado:** Abierto (amplía C-textos §4 del 17/10).

### 2.2 Bajos e informativo

| Clave | Gravedad · esfuerzo | Dónde | Qué pasa (esperado contra observado) | Evidencia · reproducido | Corrección · listo cuando | Estado |
|---|---|---|---|---|---|---|
| **C5-02** | Baja · S | «Mis trámites», caso «Su grupo se canceló», 390 px; `tramites.js:199`, `apd.js:30`; base `03-apd-reglas.sql:36` | La etiqueta del estado dice «En espera de curso» y el aviso de abajo, «Sigues en espera de grupo con tu misma antigüedad». La decisión del 18/10 (`apd.js:29`) es que la persona espera **el curso** y el personal arma **grupos**; la base, en sus mensajes (`apd.nombre_estado`), dice «En espera de grupo». Esperado: un nombre por público | `c5-repro.txt` C5-02, `capturas/C5-02.png` · 2 de 2 | «Sigues en espera de un curso con tu misma antigüedad»; `nombre_estado` con el nombre de cada público o neutro. Listo cuando ninguna pantalla de la persona contiene «espera de grupo» | Abierto |
| **C5-03** | Baja · S | Las 12 pantallas del personal (sólo en la versión de prueba); `pruebas.js:481` | La franja de ubicación de la prueba tiene `aria-label` «Dónde estás en el trámite (versión de prueba)»: de tú en pantallas que hablan de usted. Quien usa lector de pantalla lo oye en cada pantalla | `c5-repro.txt` C5-03 · 2 de 2 | «Ubicación en el trámite (versión de prueba)», neutro. Listo cuando el detector de trato da 0 en `aria-label` del personal | Abierto |
| **C5-04** | Baja · S | «Grupos» y «Programar», lista de quién espera; `personal.js:401`, `grupos.js:348` | En la misma lista, «Vencida el 31/07/2026» (etiqueta, con mayúscula) y «vence el 30/10/2026» (texto, con minúscula). En la semana bloqueada: «El lunes ya no se puede: faltan menos de 7 días: el curso empieza…», dos «:» seguidos | `c5-repro.txt` C5-04, `capturas/C5-04.png` · 2 de 2 | «El lunes ya no se puede (faltan menos de 7 días): …»; «Vence el …» con mayúscula o las dos en minúscula. Listo cuando ningún texto tiene dos «:» en una oración | Abierto |
| **D4-03** | Baja · S | Las 21 pantallas; `pruebas.js:509`, `version-visible.js:29` | Cada pantalla pide `VERSION` **dos veces**, las dos con `no-store` (2 viajes más, 4 s en 3G lento, aunque en paralelo). Los cuatro scripts que sólo existen en la prueba (`archivos-prueba`, `pruebas`, `casos-prueba`, `version-visible`) suman 118 KB (36 KB con gzip) en cada pantalla | `d4-peso-ficticios.json` (filas `VERSION`) · 2 de 2 | Que `pruebas.js` use la versión que ya leyó `version-visible.js`. Listo cuando cada pantalla pide `VERSION` una vez | Abierto |
| **D4-04** | Baja · S | «Citas de cotejo» con el escenario de volumen (40 citas hoy y 30 los días siguientes), 1280 px; `citas.js:111-139`, `:149` | **Buscar tarda en responder:** cada tecla tarda de 472 a 568 ms en pintarse con el procesador 4× más lento, de 368 a 752 ms con 6× y de 120 a 264 ms sin freno; la bandeja de revisión, con 65 solicitudes, responde en 48 a 208 ms. Además, al abrir «Citas» una sola tarea bloquea la página de 482 ms (4×) a 722 ms (6×). Referencia: respuesta «buena» ≤ 200 ms (web.dev, INP) | `d4-interaccion.jsonl`, `d4-tiempos.md` · 2 de 2 con 4× y 6×; intermitente 1 de 2 sin freno | Causa probable: en cada tecla `pinta()` reescribe la hora de todas las filas, cambia la dirección (`history.replaceState`) y pide al módulo tabla que vuelva a leer los encabezados (`formkit:tabla`). Corrección: hacer eso sólo cuando cambia de «día» a «búsqueda» y esperar 150 ms sin teclear antes de filtrar. Listo cuando `d4-interaccion.mjs` da ≤ 200 ms en la búsqueda de «Citas» con 4× | Abierto (equipo compartido: cota superior) |
| **D4-05** | Informativa | `espera.html` | La dirección antigua carga su CSS, fuentes y logotipo y después redirige con JavaScript a `grupos.html`: 40 peticiones y 1.48 MB en lugar de 31 y 1.35 MB. Se conserva para enlaces guardados (decisión 18/10) | `d4-peso-resumen.md` | Ninguna mientras se use poco | — |

### 2.3 Ya registrados: estado al 20/10/2026

De la auditoría de textos del 17/10 (`docs/auditoria-integral/C-textos.md`, sin claves Pnn) y de `docs/PENDIENTES.md`.

| Registrado | Estado hoy | Evidencia |
|---|---|---|
| C-textos §2 «null» en diálogos | **Corregido**: 0 «null», «undefined» o «NaN» en 129 estados | `c5-detectores.md` |
| §3 «Corrige lo que se indica abajo» | **Corregido**: «arriba» (`apd.js:27`) | — |
| §5 «en PDF o en foto» en el inicio | **Corregido** | — |
| §4 «MONTO FICTICIO… 2026-07-01» | **Corregido**: 0 fechas AAAA-MM-DD a la vista | — |
| §7 «¿Olvidaste tu contraseña? Pendiente…» | **Corregido** | — |
| §5 «Emitida/Vence» frente a «Inicio/Fin de vigencia» | **Corregido** | — |
| §1 «Faltan por revisar N campos» (persona) | **Corregido**: no aparece en los envíos vacíos | — |
| §1 «Escribe al menos 10 caracteres» de tú al personal | **Corregido** (`mensajes-usted.js`) | `c5-usted-cobertura.txt` |
| §1 mensajes de la base en tú al personal («Indica…», «Carga…») | **Corregido**: «Indique» (`:1008`), «Cargue» (`:739, 741`) | — |
| §3 acuse de la cuenta «1. Entra con tu CURP» | **Corregido** | `c5-acuses.json` |
| §2 «Cancelada» sin qué sigue y en tercera persona | **Corregido** («Desististe…», «Puedes iniciar…») | — |
| §1 verificar «Puede trabajar» | **Corregido** («Esta persona puede trabajar…») | — |
| §2 «Los campos con * son obligatorios» | **Corregido** («Las preguntas con *…») | — |
| §4 acuse en 12 horas | **Corregido** (P128) | — |
| §4 acuse con la **fecha real** | **En parte**: el de la solicitud ya dice la fecha simulada (14/10/2026, decisión 18/10); el de la cuenta sigue con la real («Creada el 20 de octubre de 2026, 12:19»), así que la persona ve su cuenta creada seis días **después** de su solicitud | `c5-acuses.json`, `capturas/c5-acuse-cuenta.png`, 2 de 2 |
| §4 acuse en **fecha larga** frente a dd/mm/aaaa | **Sigue**: acuse «14 de octubre de 2026, 18:00», «Mis trámites» «14/10/2026, 18:00» para el mismo envío | `c5-acuses.json`, 2 de 2; ver sección 4 |
| §4 dos formas de fecha y hora en la misma tarjeta | **Sigue y se amplió**: C5-01 | `c5-repro.txt` |
| §3 «5 solicitudes por revisar: 2 de 3 a 9 días» | **Sigue** («65 solicitudes…: 26 con 10 días o más y 22 de 3 a 9 días» con volumen) | `c5-pantallas.json` |
| §5 «Solicitudes por revisar» (título) frente a «Revisión documental» (menú) | **Sigue** | — |
| §2 «bandeja» como nombre de lugar | **Sigue** en 4 lugares: «Siguiente en la bandeja» (`revisar.js:383`), «Vuelva a la bandeja» (`revisar.js:59`), la descripción de `revision.html` y el motivo ficticio «regresan a la bandeja» (`ficticios.mjs:435`); más «Fase 4 de 7: Bandeja y grupos» del menú de pruebas | — |
| §5 «Recibimos tu solicitud», «no podemos recibir más envíos» | **Sigue** (`solicitud.html:628`; `envioLimite` del estándar) | — |
| §5 «el área» frente a «la Dirección» | **Sigue** (3 y 3 textos) | — |
| §5 «trámite nuevo, con su pago» frente a «solicitud nueva» | **Sigue**: «Para obtener la acreditación haces un trámite nuevo, con su pago» (no acreditada, sin examen) frente a «Puedes iniciar una solicitud nueva» | — |
| §2 y §6 mensajes de la base: estados internos («En integración», «Concluida sin atender», «específico»), jerga («marca de dato de prueba», «parámetro %s del sistema»), sin punto final, «%s MB» | **Siguen**: 145 de 145 sin punto final; `:45`, `:43`, `:1541`, `:443`, `:66`, `:529` | `c5-fuentes.json` |
| §7 marcas «Pendiente» sin número | **Siguen 5**: «banco, cuenta y forma de pago», «días y horario de entrega», «lo completa la Unidad de Transparencia», «la pantalla de emisión y entrega» (aplicar y bandeja), «el examen real…» | — |
| §8 avisos por correo: A0 después de A1, «A3 bis», «Acreditación entregada», «cada aviso… se muestra en Mis trámites» | **Siguen** | `docs/AVISOS-POR-CORREO.md:46-56` |
| **P144** «pago de derechos» → «cuota» | **Sigue igual**: 0 «cuota»; «Paga los derechos…» (`apd.js:28`, `tramites.js:77`, `examen.js:268`), «Pago de derechos:» (`inicio.js:42`), «factura del pago de derechos» (requisito de la constancia fiscal y base `:1049`), «paga los derechos» (`revisar.js:363`) | `c5-detectores.json` |

---

## 3. Verificado sin hallazgos

**Trato (tabla por pantalla en `c5-trato.md`).** Las 10 pantallas que usa la persona (con el examen) tienen 0 marcas de
usted en 1,136 renglones. En las 11 del personal, los 22 renglones con marca de tú se revisaron uno por uno: son citas de
lo que lee la persona («La persona lo lee… de tú («cargaste»)», «Entra a tu examen», la papeleta del código), verbos en
tercera persona («Conserva el monto», «regresa con observaciones», «Busca en todos los días», «inicia») y el
`aria-label` de C5-03. **Un solo trato por público, salvo C5-03.** Los mensajes de la base van en tú cuando son de la
persona y en usted cuando son del personal. De las 198 claves de mensajes del estándar, `mensajes-usted.js` cambia 64;
las 11 que siguen en tú son de módulos que no carga ninguna pantalla del personal (CURP, repetible, mapa).

**Nombres internos.** 0 estados en bruto, 0 nombres de campo, 0 «null», «undefined», «NaN» o «[object …]» en los 129
estados. Los únicos `snake_case` visibles («poda_nueva», «no_cumple», «apd.solicitud.tipo_acreditacion») están en la
caja amarilla «Sólo en la versión de prueba; en producción no se muestra» de la solicitud: decisión del 15/10.

**Números y montos.** Un solo formato de monto («$1,200.00»), calificación con un decimal («8.5 (mínima 7.0)»), tamaños
con la misma regla en el sitio y el estándar («843 KB», «1.1 MB», 1 MB = 1,024 KB), porcentajes con espacio («100 %»).

**Identificadores (P58).** «Folio de la solicitud», «Número de expediente» y «Número de acreditación» en todas las
pantallas; ninguna variante («número de solicitud», «folio de la acreditación»).

**Ortografía.** 0 faltas en la lista de 120 palabras que suelen perder la tilde; «sólo» adverbio con tilde (89) y
«solo» adjetivo sin ella (13: «un solo PDF», «se envía solo»), como la política registrada; 0 comillas inglesas en
textos (las 20 son selectores del código). Los dobles espacios no se pudieron revisar: los dos inventarios juntan los
espacios al leer.

**Tono.** Los errores dicen qué hacer («Ese código no existe. Revisa que lo escribiste igual que en tu papel»); el prefijo
«Error:» del estándar sigue la técnica de WCAG 3.3.1; 0 exclamaciones; 0 mayúsculas sostenidas fuera de nombres
ficticios y siglas.

**Peso, lo que está bien.** Fuentes con `font-display: swap` (el texto se ve antes de que lleguen); logotipo de 26 KB
(P130 resuelto); pdf.js y su worker sólo se descargan en escritorio en «Revisar» y «Cotejo», donde el visor está fijo y
muestra el primer documento; en teléfono no se descargan al cargar la pantalla; 0 peticiones a otros dominios en las 84
cargas (sólo imágenes `data:`); las piezas con `?v=` salen de la caché en la segunda visita (20 a 27 por pantalla).

---

## 4. Fallas del componente compartido (estándar 1.5.1)

| Falla | Archivo:línea del estándar | Clave |
|---|---|---|
| `FormKit.utilidades.fechaHora` escribe fecha larga con `dateStyle: 'long'` y no se puede pedir día/mes/año: el acuse dice «14 de octubre de 2026, 18:00» mientras el proyecto escribe «14/10/2026, 18:00» para el mismo envío. Además, el CHANGELOG de la 1.4.2 (P128) promete «17 de octubre de 2026 **a las** 23:27» y Chromium 141 escribe «20 de octubre de 2026**,** 18:05»: la unión de fecha y hora depende de los datos de idioma de cada navegador, así que el acuse puede leerse distinto en Safari o Firefox | `sitio/formkit/js/formkit.core.js:46-48`; `formkit/modulos/acuse/acuse.js:54` | **Sin clave** (lo anotó como hallazgo para el estándar la auditoría del 17/10; P128 sólo resolvió las 24 horas). Propuesta: opción `fechas.estilo` (`'corta'` = dd/mm/aaaa) y unir fecha y hora con el texto de `mensajes` («{fecha} a las {hora}») |
| `envioLimite` habla en primera persona del plural («Por ahora no podemos recibir más envíos…»), cuando el resto atribuye a «la Secretaría» | `formkit/js/validaciones.config.js` (`mensajes.envioLimite`) | Sin clave (C-textos §5 del 17/10); se puede cambiar por configuración |
| Las 11 claves de mensajes en tú sin equivalente que el estándar documente para formularios de usted (`curpNombre`, `curpSinSegundo`, `fmtCurpLargo`, `repetibleMin`, `mapa…`) | `validaciones.config.js:544-…` | Sin clave; hoy no afecta al proyecto (ninguna pantalla del personal usa esos módulos) |

---

## 5. Para decidir (Liber)

| # | Pregunta | Opciones y costo | Recomendación |
|---|---|---|---|
| 1 | **Presupuesto de peso y velocidad** (D4; no hay uno fijado) | (a) **Estricto**: persona ≤ 200 KB transferidos por pantalla (comprimido, con los datos de la API), ≤ 20 peticiones, usable ≤ 5 s en 4G lento + 4×. Hoy no se cumple sin quitar fuentes o empaquetar: L. (b) **Intermedio**: persona ≤ 300 KB transferidos y ≤ 40 peticiones (hoy 26 a 45; sin lo de prueba, 19 a 37); usable ≤ 8 s en 4G lento + 4× y ≤ 20 s en 3G lento + 6×; tiempo bloqueado ≤ 300 ms. Personal: ≤ 500 KB sin el visor (pdf.js se mide aparte), con volumen usable ≤ 3 s sin freno de red y 4×, y cada acción ≤ 200 ms. Lo que irá al SIA ya pesa 205 a 257 KB con gzip en las pantallas de la persona (sección 6.1), así que se cumple quitando lo de prueba y con D4-02: S a M. (c) Sin presupuesto, sólo medir en cada versión: S | **(b)**. Razonamiento: las personas entran sobre todo desde el teléfono, muchas con planes de datos limitados y señal 3G o 4G débil en la calle o en el trabajo; lo que más les cuesta no son los megas (300 KB por pantalla son unos 5 MB en todo el trámite) sino **el tiempo de espera**: en 3G lento cada 50 KB es un segundo y cada petición, 2 s de latencia. El presupuesto (b) cabe en lo que ya hay sin la parte de prueba, y Core Web Vitals marca como «bueno» un contenido principal en ≤ 2.5 s y una respuesta en ≤ 200 ms, que sirven de referencia para el personal en red de oficina. Dejar la prueba `d4-peso.mjs` + `d4-tiempos.mjs` como verificación de cada versión |
| 2 | **Formato de fechas y horas** (C5-01) | (a) dd/mm/aaaa en todo, con día de la semana delante cuando ayuda, y «a las HH:MM»; los rangos de un curso, el nombre del grupo (decidido) o «del 13/10/2026 al 17/10/2026», uno solo: M. (b) Fecha larga («martes 20 de octubre de 2026») para lo que la persona tiene que recordar (cita, curso, examen) y dd/mm/aaaa en tablas y datos: M. (c) Dejar como está | **(a)**, porque es la regla del sistema y la que ya usan 16 de 21 pantallas. Lo que cambia la pantalla, antes y después: «Cita de cotejo 20/10/2026, 10:00» → «20/10/2026 a las 10:00»; «examen el sábado 17/10» → «examen el sábado 17/10/2026»; agenda «Miércoles, 14 de octubre de 2026» → «Miércoles 14/10/2026»; programar «Lunes 2 de noviembre al viernes 6 de noviembre» → «Del lunes 02/11/2026 al viernes 06/11/2026» |
| 3 | **Acuse en fecha larga** (sección 4) | (a) Pedir al estándar `fechas.estilo` y, mientras, escribir la fecha del acuse con `APD.fechaHora` en el proyecto: S. (b) Aceptar la fecha larga sólo en los acuses (registrarlo en DECISIONES) | (a) |
| 4 | **Scripts al final del cuerpo** (D4-02) | (a) `defer` en `<head>` en las 21 páginas: S, cambio mecánico, con las baterías como red. (b) Un paquete por pantalla al entregar al SIA: M. (c) Esperar a medir en teléfono real (P33) | **(c) y luego (a)**: medirlo en la sesión de P33 con el HTML comprimido; si se confirma, (a) |

---

## 6. Resultados de D4 (detalle)

### 6.1 Peso de la primera carga

Teléfono (390 px) salvo donde se indica; KB = 1,024 bytes. «Sin lo de prueba» quita `ficticios.json`, los cuatro
scripts que sólo existen en la prueba, `catalogos.js`, `examen-ficticio.js` y `VERSION`: es una estimación de lo que
serviría el SIA **sin los datos de la API**. Tabla completa en `d4-peso-resumen.md`.

| Pantalla | Peticiones | Sin comprimir | gzip | Sin lo de prueba, gzip | Propio | Sólo prueba | Estándar | pdf.js | Fuentes | Logotipo | `ficticios.json` | Con volumen: sin comprimir / gzip |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| index | 26 | 1,264 | 327 | 207 | 121 | 118 | 141 | — | 98 | 26 | 760 | 2,817 / 471 |
| cuenta | 40 | 1,367 | 361 | 241 | 153 | 118 | 211 | — | 98 | 26 | 760 | 2,920 / 505 |
| tramites | 26 | 1,284 | 333 | 213 | 141 | 118 | 141 | — | 98 | 26 | 760 | 2,837 / 477 |
| solicitud | 45 | 1,438 | 378 | 257 | 213 | 118 | 222 | — | 98 | 26 | 760 | 2,991 / 521 |
| verificar | 27 | 1,266 | 329 | 209 | 120 | 118 | 143 | — | 98 | 26 | 760 | 2,819 / 472 |
| revision | 31 | 1,327 | 350 | 230 | 170 | 118 | 155 | — | 98 | 26 | 760 | 2,880 / 493 |
| revisar (1280) | 44 | 3,131 | 873 | 753 | 242 | 118 | 198 | 1,688 | 98 | 26 | 760 | 4,684 / 1,017 |
| cotejo (1280) | 44 | 3,145 | 880 | 760 | 240 | 118 | 215 | 1,688 | 98 | 26 | 760 | 4,698 / 1,024 |
| programar | 36 | 1,382 | 367 | 247 | 207 | 118 | 173 | — | 98 | 26 | 760 | 2,935 / 511 |
| examen | 36 | 1,343 | 354 | 232 | 180 | 121 | 157 | — | 98 | 26 | 760 | 2,896 / 497 |

Rango de las 21 pantallas en teléfono: 26 a 45 peticiones; 1,264 a 1,483 KB sin comprimir; 324 a 429 KB con gzip;
**205 a 309 KB con gzip sin lo de prueba** (193 a 293 KB con brotli). Las fuentes (98 KB, 5 archivos woff2, no se
comprimen más) son la pieza más grande de lo que irá al SIA en las pantallas de la persona. En escritorio, «Revisar» y
«Cotejo» agregan pdf.js: 344 KB + 1,344 KB del worker (≈ 500 KB con gzip). La auditoría del 17/10 midió 420 a 605 KB por
pantalla; la diferencia es casi toda `ficticios.json` (D4-01).

**Segunda visita** (`d4-segunda-visita.txt`): 761 a 853 KB por cada pantalla siguiente, casi todo `ficticios.json`.

### 6.2 Tiempo hasta que la pantalla es usable

Segundos hasta «usable»: mediana de 2 repeticiones (mínimo–máximo). «gzip» = scripts, estilos y datos comprimidos con
el HTML sin comprimir (ver D4-02). Persona a 390 px; personal y examen a 1280 px. Detalle con primer contenido, DOM listo,
tiempo bloqueado y tarea más larga en `d4-tiempos.md`; tabla en `d4-tiempos-compacta.md`.

| Pantalla | 3G lento + 6×, sin comprimir | 3G lento + 6×, gzip | 4G lento + 4×, sin comprimir | 4G lento + 4×, gzip | Volumen, sin freno de red, 4× | Volumen, sin freno, 6× | Volumen, 4G lento + 4×, gzip |
|---|---|---|---|---|---|---|---|
| index | 32.2 (32.2–32.2) | 15.2 (15.2–15.2) | 10.1 (8.9–11.3) | 6.6 (4.4–8.7) | — | — | — |
| cuenta | 37.0 (36.8–37.2) | 19.4 (19.2–19.6) | 10.3 (10.2–10.3) | 5.8 (5.7–5.8) | — | — | — |
| entrar | 34.3 (34.1–34.4) | 16.5 (16.5–16.6) | 12.5 (9.5–15.5) | 10.3 (10.2–10.5) | — | — | — |
| tramites | 43.2 (43.2–43.2) | 30.1 (29.9–30.2) | 12.2 (12.0–12.4) | 8.7 (8.6–8.8) | — | — | — |
| datos | 34.8 (34.8–34.8) | 18.2 (18.0–18.3) | 9.8 (9.7–9.8) | 5.3 (5.2–5.4) | — | — | — |
| solicitud | 40.1 (39.3–40.9) | 21.6 (21.0–22.1) | 11.4 (11.4–11.4) | 6.1 (6.1–6.1) | — | — | — |
| corregir | 33.6 (33.5–33.7) | 17.3 (17.2–17.4) | 9.5 (9.5–9.5) | 4.7 (4.7–4.7) | — | — | — |
| verificar | 37.6 (33.6–41.5) | 20.0 (16.4–23.6) | 15.6 (15.5–15.7) | 10.2 (10.1–10.4) | — | — | — |
| material | 36.6 (32.5–40.8) | 15.3 (15.2–15.3) | 11.5 (11.4–11.7) | 8.7 (8.5–8.8) | — | — | — |
| revision | — | — | 10.1 (10.1–10.1) | 8.4 (5.2–11.5) | 1.4 (1.3–1.5) | 2.5 (2.1–2.9) | 6.5 (6.5–6.5) |
| revisar | — | — | 12.6 (11.5–13.7) | 8.3 (8.2–8.4) | 2.8 (2.3–3.2) | 3.1 (2.5–3.7) | 9.3 (9.3–9.4) |
| citas | — | — | 10.6 (10.1–11.0) | 5.4 (5.4–5.4) | 1.8 (1.5–2.2) | 2.5 (2.4–2.5) | 6.5 (6.4–6.5) |
| cotejo | — | — | 15.3 (15.0–15.6) | 8.1 (8.0–8.2) | 2.1 (2.1–2.2) | 3.2 (3.1–3.3) | 9.2 (9.1–9.3) |
| grupos | — | — | 10.6 (10.5–10.6) | 7.2 (7.2–7.2) | 1.7 (1.6–1.8) | 2.3 (2.1–2.5) | 6.5 (6.5–6.6) |
| espera | — | — | 14.1 (12.1–16.2) | 6.8 (6.1–7.4) | 1.5 (1.4–1.6) | 1.8 (1.7–1.9) | 9.6 (6.6–12.7) |
| programar | — | — | 10.8 (10.6–11.0) | 5.8 (5.7–5.9) | 1.4 (1.2–1.6) | 2.3 (1.8–2.8) | 7.0 (6.8–7.3) |
| grupo | — | — | 10.4 (10.3–10.4) | 5.5 (5.5–5.5) | 1.4 (1.3–1.5) | 2.1 (2.0–2.2) | 6.5 (6.5–6.6) |
| asistencia | — | — | 12.8 (10.3–15.3) | 7.9 (4.9–11.0) | 1.4 (1.2–1.6) | 2.0 (1.9–2.1) | 8.6 (5.8–11.4) |
| aplicar | — | — | 16.0 (10.6–21.4) | 5.7 (5.6–5.9) | 1.6 (1.3–1.9) | 1.7 (1.6–1.9) | 6.6 (6.6–6.6) |
| examen | — | — | 10.9 (10.8–11.0) | 5.7 (5.5–5.8) | 1.4 (1.4–1.4) | 1.7 (1.4–1.9) | 6.4 (6.4–6.5) |
| material-personal | — | — | 14.9 (11.0–18.9) | 5.9 (5.8–6.0) | 1.2 (1.0–1.4) | 1.5 (1.4–1.6) | 6.8 (6.7–6.9) |

- **Persona, gama baja (3G lento + 6×):** 32.2 a 43.2 s sin comprimir; **15.2 a 30.1 s con gzip**. El primer contenido
  aparece a los 4.9 a 12.0 s. Sólo `ficticios.json` son 20.8 s sin comprimir (D4-01).
- **Persona, gama media (4G lento + 4×):** 9.5 a 15.6 s sin comprimir; **4.7 a 10.3 s con gzip**.
- **Personal con volumen, red de oficina:** 1.2 a 2.8 s con 4× y 1.5 a 3.2 s con 6×; con 4G lento y gzip, 6.4 a 9.6 s.
  Las cargas con volumen y sin freno de red se hicieron con la cabecera del escenario; sin latencia, el orden de
  descubrimiento de D4-02 no cambia el resultado de forma apreciable.
- **Examen** (computadoras del salón): 1.4 a 1.7 s con volumen y sin freno; 5.7 s con 4G lento + 4× y gzip.
- Contra el presupuesto propuesto («Para decidir» 1, opción b), con gzip y con `ficticios.json` incluido: la persona cumple los 8 s en 4G
  lento en 5 de 9 pantallas («entrar» 10.3, «verificar» 10.2, «tramites» 8.7 y «material» 8.7 no) y los 20 s en 3G
  lento en 7 de 9 («tramites» 30.1 y «solicitud» 21.6 no); el personal cumple los 3 s con 4× en 12 de 12 y con 6× en
  10 de 12 («revisar» 3.1 y «cotejo» 3.2 no).

### 6.3 Interacción del personal con volumen

Duración de la respuesta (Event Timing, de la acción a lo siguiente pintado), la peor de cada acción; escenario de
volumen, 1280 px, sin freno de red. Referencia: ≤ 200 ms «bueno» (INP, web.dev). `d4-interaccion.jsonl`.

| Acción | 1× (vuelta 1 / 2) | 4× | 6× |
|---|---|---|---|
| «Citas de cotejo»: escribir en «Buscar» (cada tecla) | 264 / 120 ms | 568 / 472 ms | 752 / 368 ms |
| Bandeja: escribir en «Buscar» | 56 / 48 ms | 128 / 160 ms | 120 / 208 ms |
| «Grupos»: elegir a todas las de una organización | — | 48 / 40 ms | 64 / 64 ms |
| «Grupos»: elegir una persona | — | 48 / 72 ms | 48 / 192 ms |
| «Programar»: tocar un día del calendario | — | 72 / 88 ms | 128 / 104 ms |
| «Asistencia»: marcar a todas «Asistió» (25 personas) | — | 104 / 176 ms | 96 / 200 ms |
| «Aplicar»: pasar lista (Presente) | — | 32 / 24 ms | 88 / 128 ms |

Sólo la búsqueda de «Citas de cotejo» pasa de 200 ms, en las 4 corridas con 4× y 6× y en 1 de 2 sin freno (D4-04).

---

## 7. No verificable desde aquí, hipótesis y no confirmado

- **No verificable:** Firefox y Safari (la unión de fecha y hora del acuse puede cambiar: sección 4); un teléfono real
  con red real (D4-02 se midió en la red simulada de Chromium: va con P33); un lector de pantalla real (C5-03); el peso
  de las respuestas de la API del SIA (sustituyen a `ficticios.json`); si GitHub Pages sirve con gzip (normalmente sí:
  entonces lo transferido en la prueba publicada se acerca a la columna «gzip», pero el HTML comprimido activaría D4-02).
- **Hipótesis:** que el HTML comprimido apague el escáner de precarga también en un teléfono real (D4-02); que los
  tiempos de procesador sin el resto de los revisores en el equipo sean entre 20 y 40 % menores (la calibración varió de
  49 a 311 ms).
- **Falla de la medida, no del sistema:** la primera tanda con compresión puso la compresión en una cabecera; se
  descartó al ver la cascada secuencial y se repitió con prefijo de dirección y con el HTML sin comprimir (`gzs`). Las
  filas «gzip» de `d4-tiempos-matriz.jsonl` son de esa tanda y no se usan en las conclusiones.
- **No confirmado:** ninguno.

## 8. Pruebas que conviene dejar permanentes

| Prueba | Para qué | Serie |
|---|---|---|
| `c5-recorrido.mjs` + `c5-analisis.py` (sustituye la parte estática de `inventario-textos.mjs`) | Inventario de textos con scripts en las 21 pantallas y los casos del menú, y detectores de trato, nombres internos y fechas | Cada versión |
| `c5-fechas.py` con la lista de formas aprobadas | Que cada pantalla use sólo los formatos aprobados (C5-01) | Cada cambio de interfaz |
| `c5-usted-cobertura.mjs` | Que ninguna clave del estándar quede en tú en las pantallas del personal al actualizar el estándar | Cada actualización del estándar |
| `c5-acuses.mjs` | Acuse de cuenta y de solicitud contra «Mis trámites» (fecha, formato) | Cada versión |
| `d4-peso.mjs` con el presupuesto que se decida («Para decidir» 1) | Peso y peticiones por pantalla, con y sin lo de prueba | Cada versión |
| `d4-tiempos.mjs` (perfiles 3G lento + 6× y 4G lento + 4×) y `d4-cascada.mjs` | Tiempo usable y descubrimiento de scripts con el HTML comprimido | Antes de mostrar al área y antes de entregar al SIA |
| `d4-segunda-visita.mjs` | Que lo que no cambia no se descargue en cada pantalla | Cada versión |

**Huellas al terminar:** los 254 archivos de la copia son idénticos antes y después (`diff huellas-antes.txt huellas-despues.txt`: sin diferencias). `git status`: sólo `node_modules` (enlace del encargo).
