# Auditoría de seguimiento del 20/10/2026 · pantallas, accesibilidad, textos y peso

Sistema de Acreditaciones de Poda y Dictaminación. Versión de prueba 0.61 más el PR #5, commit `d58c611` (rama `main`),
con el Estándar de formularios del SIA 1.5.1. Es la última parte de la auditoría del 19/10/2026
(`docs/AUDITORIA-2026-10-19.md`): las auditorías que el dueño pospuso hasta tener el estándar al día (A6, B1, B4
completa, B6, C1 a C6 y D4). Se auditó en solo lectura: las huellas de los 254 archivos del proyecto son iguales antes y
después, y las seis copias de los revisores quedaron sin cambios. Detalle de cada hallazgo, con pasos, evidencia y
guiones para repetirlo: `docs/auditoria-2026-10-20/informe-r1.md` a `informe-r5.md` e `informe-ri.md`.

## 1. Veredicto

| Etapa | Veredicto | Por qué |
|---|---|---|
| En cada cambio (A6) | **Lista con reservas** | 11,418 textos medidos; sólo 2 pares bajo 4.5:1, ambos del marcador de posición que no colorea el estándar (A6-01) |
| En cada versión (B1, B4, B6) | **No lista** | 1 alto abierto: en «Grupos», en computadora, la barra fija tapa la casilla enfocada (B4-01; WCAG 2.4.11). Esfuerzo S |
| Al terminar pantallas (C1 a C6) | **Lista con reservas** | Sin altos en C1 ni en C5. 13 medios de tareas, estados, sistema visual y textos |
| Antes de mostrar al área (B1, C1, C5) | **No lista** | El mismo alto B4-01 aparece en el barrido de «Grupos». Con él corregido, queda «Lista con reservas» |
| Antes de cerrar la etapa (D4, B4 con lector) | **No lista** | No hay presupuesto de peso (se propone en «Para decidir» 15) ni sesión con lector de pantalla real (P34) |

## 2. Resumen ejecutivo

Cinco revisores en paralelo y uno independiente recorrieron las 21 pantallas en 7 tamaños, con los 40 casos del menú
de pruebas y con volúmenes reales (65 solicitudes por revisar, 40 citas en un día, 112 personas en espera): 1,427
combinaciones de pantalla y tamaño, 3,999 botones presionados, más de 1,000 corridas de axe, 43,454 paradas de teclado,
11,418 textos medidos y 129 estados de texto. **No hay hallazgos críticos.** Hay **1 alto**, 16 medios, 45 bajos y 5
informativos del proyecto, y 13 fallas del estándar compartido sin clave todavía.

El único alto lo encontraron tres revisores por separado: en «Grupos», a partir de 760 px de ancho, la barra fija de
«elegidas» mide de 312 a 364 px (35 a 47 % de la ventana) y, con volumen real, tapa por completo la casilla en la que
está el teclado en 47 a 73 de cada 75. Quien usa teclado no ve a quién está eligiendo. Se corrige reservando su alto
(S).

Los medios se agrupan en cinco temas: (1) el planeador perdió dos datos que se habían corregido el 17/10 (cuántas
personas son prioritarias y cuántos grupos alcanzan) y su barra estorba también con ratón; (2) mensajes que dicen algo
falso o se pierden: «Tu sesión se cerró en otra pestaña. No se guardó nada» cuando la sesión sólo caducó y todo está
guardado, y «Crea tu cuenta» pierde los 11 datos y la foto al recargar; (3) el sistema visual: hasta 6 botones
principales a la vez, cuatro colores para «elegido» y lo elegido invisible en alto contraste; (4) fechas escritas de 14
formas; (5) peso: cada pantalla descarga completo el archivo de datos de prueba (760 KB, sin caché) y los scripts se
cargan uno tras otro.

Lo que salió bien: axe sin violaciones en más de 1,000 corridas; todos los flujos se pueden hacer sólo con teclado,
examen incluido, sin trampas de foco; 0 enlaces rotos en 2,149; 0 errores de consola y 0 respuestas 4xx o 5xx; un solo
trato por público (0 textos de usted en las pantallas de la persona); 0 nombres internos a la vista; ningún desborde
horizontal fuera de dos casos del estándar; todo el texto que colorea el proyecto cumple contraste; la foto se guarda
sin ubicación.

## 3. Cobertura

| Auditoría | Estado | Cómo se hizo | Hallazgos (A · M · B · I) | Calificación | Qué faltó |
|---|---|---|---|---|---|
| A6 Estilos y contraste | Hecha | 67 estados × 2 anchos; texto, bordes, íconos y foco medidos sobre el fondo real compuesto; `contraste.mjs` y `auditor-css.mjs` del estándar; colores forzados | 0 · 0 · 3 · 0 | 4 | — |
| B1 Barrido | Hecha | 204 estados × 7 tamaños (360, 390 y 430 px; 844×390; 768×1024; 1440×900; zoom 200 %); 3,999 botones; 31,434 paradas de Tab; 2,149 enlaces | (el alto, en B4) · 0 · 5 · 0 | 3 | Firefox y WebKit |
| B4 Accesibilidad | Hecha | axe WCAG 2.2 A y AA en 256 cargas, 693 botones y 45 resultados, a 390 y 1440; teclado en 9 flujos; foco en 12,020 paradas (independiente); regiones vivas; daltonismo simulado; árbol de accesibilidad de 16 pantallas | 1 · 1 · 10 · 3 | 3 | Lector de pantalla real (P34) |
| B6 Teléfono y continuidad | Hecha | Horizontal, cámara y ubicación, red caída, sesión caducada, recarga, «Atrás», dos pestañas, versión nueva con la página abierta. Sin conexión: no aplica (sin service worker ni caché) | 0 · 2 · 2 · 0 | 3 | Teléfono real (P33) |
| C1 Tareas del personal | Hecha | Ficha por pantalla con volumen real | 0 · 3 · 4 · 0 | 3 | — |
| C2 UX heurística | Hecha | Nielsen en teléfono y escritorio; matriz de impacto y esfuerzo | 0 · 2 · 0 · 0 | 3 | Prueba con personas (H) |
| C3 Carga | Hecha | 11 tareas medidas en 390×844 | 0 · 0 · 3 · 1 | 4 | — |
| C4 Matriz de estados | Hecha | Filtros, «Atrás», recarga, enlace compartido, dos pestañas, cambio de persona | 0 · 1 · 7 · 0 | 3 | — |
| C5 Textos | Hecha | 129 estados, mensajes de reglas y de la base, avisos por correo, acuses; glosario | 0 · 1 · 3 · 0 | 4 | Correos reales (P23) |
| C6 Sistema visual | Hecha | Inventario de 39 aspectos de botón, etiquetas, avisos, letra y espaciado, contra el estándar 1.5.1 | 0 · 4 · 6 · 0 | 3 | — |
| D4 Peso y velocidad | Hecha | Peso por pantalla con y sin gzip; 3G y 4G lentos con procesador 4× y 6×; volumen | 0 · 2 · 2 · 1 | 3 | Presupuesto del dueño; teléfono real |

## 4. Las 10 de mayor prioridad

| # | Clave | Gravedad | Esfuerzo | Qué |
|---|---|---|---|---|
| 1 | B4-01 | Alta | S | «Grupos»: la barra fija tapa la casilla enfocada (2.4.11) |
| 2 | B6-01 | Media | S | «Tu sesión se cerró en otra pestaña. No se guardó nada» cuando la sesión caducó y todo sigue guardado |
| 3 | C1-01 | Media | S | El planeador ya no dice cuántas son prioritarias ni cuántos grupos alcanzan (regresión del 17/10) |
| 4 | RI-02 | Media | S | «Día anterior/siguiente» y «Mes anterior/siguiente» se deshabilitan con el foco encima y el foco se pierde |
| 5 | C4-01 | Media | S | Los filtros de la bandeja de revisión se pierden con «Atrás» y al recargar |
| 6 | C2-02 | Media | S | «Mis trámites»: la fecha y hora del curso quedan a unos 1,100 px, debajo de «Qué sigue» |
| 7 | D4-01 | Media | S | El archivo de datos de prueba (760 KB; 2.26 MB con volumen) se descarga completo y sin caché en cada pantalla |
| 8 | C6-01 | Media | S | Con alto contraste no se ve lo elegido en «Asistencia», «Grupos» y el calendario |
| 9 | C1-02 | Media | S | El pase de lista compara a la persona con una foto de 48 × 60 px que no se amplía |
| 10 | B6-02 | Media | M | «Crea tu cuenta» pierde los 11 datos y la foto al recargar, sin avisar |

## 5. Hallazgos

Totales del proyecto: **1 alto, 16 medios, 45 bajos y 5 informativos** (duplicados entre revisores unidos). Todos los de
comportamiento se reprodujeron 2 de 2 en contextos nuevos. El alto lo reprodujo además el auditor principal (2 de 2,
`d58c611`, 1440×900 con volumen: 47 de 66 casillas de persona quedan dentro de la barra).

### 5.1 Alto

**B4-01 · «Grupos»: la barra fija de elegidas tapa la casilla enfocada** · Alta · S · B4 y B1 · antes de mostrar al área.
`sitio/app/apd.css:579` (`.plan-barra { position: sticky; bottom: 0 }` desde 760 px). La barra mide 312 a 364 px. Con
volumen, la casilla enfocada queda oculta por completo en 52 de 75 (1440×900), 73 (1280×720) y 72 a 75 (1024×768).
WCAG 2.2 2.4.11 (AA). Encontrado por r2 (B1-01), r3 (B4-01) y el revisor independiente (RI-01), cada uno por su lado.
Corrección: reservar el alto real de la barra (`scroll-padding-bottom` actualizado al cambiar su tamaño) y, como
respaldo, que deje de ser fija cuando mida más de un cuarto de la ventana. Listo cuando: una prueba recorre con Tab las
casillas del planeador con volumen a 1440, 1280 y 1024 y ninguna queda tapada. Ver C2-01 y «Para decidir» 1.

### 5.2 Medios (16)

| Clave | Dónde | Qué pasa | Corrección propuesta | Detalle |
|---|---|---|---|---|
| B6-01 | Solicitud, «Mi perfil», «Cargar el documento correcto»; `app/apd.js:276-279` | Sin sesión (caducada), dice «Tu sesión se cerró en otra pestaña… No se guardó nada». Es falso: no hubo otra pestaña y el borrador y los 4 documentos se recuperan | «Tu sesión terminó. No se envió nada, pero lo que capturaste sigue en este dispositivo: vuelve a entrar y continúa»; «otra pestaña» sólo cuando hay otra cuenta | r2 |
| B6-02 | «Crea tu cuenta» | Recargar o «Atrás» borra los 11 datos y la foto sin avisar | Para decidir 6 | r2 |
| C1-01 | Planeador de «Grupos» | Ya no dice cuántas son prioritarias (38 de 66) ni cuántos grupos alcanzan; regresión de M7 y de «31 días o más» del 17/10, perdidos en el rediseño del 18/10 | Volver a mostrar las dos cifras arriba de la lista | r4 |
| C1-02 | «Aplicar el examen» | La foto con que se confirma la identidad mide 48 × 60 px y no se amplía | Para decidir 14 | r4 |
| C1-03 | Espera de renovación (planeador y «Programar») | «Primero quien vence antes» no se cumple: los bloques por organización adelantan a personas vigentes sobre 9 ya vencidas. Chocan DECISIONES:156 y :183 | Para decidir 11 | r4 |
| C2-01 | Planeador, ≥ 760 px | La barra de elegidas ocupa 35 a 47 % de la ventana aunque no haya nadie elegido, con un botón principal por destino | Junto con B4-01 y C6-02 (Para decidir 1 y 2) | r4 |
| C2-02 | «Mis trámites» con grupo, 390 | Cuándo y a qué hora presentarse queda a unos 1,100 px, debajo de «Qué sigue»; la cita va arriba (569 px) | Fecha, hora y lugar del curso en la tarjeta, como la cita | r4 |
| C4-01 | Bandeja de revisión | Los filtros se pierden con «Atrás» y al recargar | Guardarlos en la dirección (`?estado=&tipo=…`), como `?dia=` en «Citas» | r4 |
| C5-01 | 21 pantallas | Fechas y horas escritas de 14 formas, hasta 5 en una pantalla («20/10/2026, 10:00» y «el 20/10/2026 a las 10:00» en la misma tarjeta) | Para decidir 16 | r5 |
| C6-01 | «Asistencia», «Grupos», persona elegida, calendario | Con colores forzados (alto contraste) no se ve lo elegido; en «Asistencia» no se sabe si se marcó «Asistió» o «Faltó». Relacionado con P35 | Borde o marca visible en `forced-colors` | r1 |
| C6-02 | «Grupos» (5 a 6), «Programar» (3), «Mis grupos de hoy» (2 a 4) | Varios botones principales a la vez; el estándar pide uno por pantalla (la regla de P164) | Para decidir 2 | r1 |
| C6-03 | Varias | Lo elegido tiene cuatro colores (azul del estándar, guinda, guinda claro, verde o rojo); el guinda claro es también el de las filas alternas | Un solo tratamiento: el del estándar | r1 |
| C6-04 | Bandeja de revisión | A los 10 días o más se usa la etiqueta «cerrado sin éxito» (roja, con equis): con volumen, 26 rojas de 65. El dueño fijó el rojo el 16/10, no la familia ni el ícono | Para decidir 3 | r1 |
| D4-01 | 21 pantallas; `app/apd.js:80` | Cada pantalla descarga completo `datos/ficticios.json` (760 KB; 2.26 MB con volumen) con `cache: 'no-store'`: 57 a 60 % de la primera carga; un tercio es la bitácora, que ninguna pantalla lee. 20.8 s en 3G lento | Sacar la bitácora del archivo de la prueba y permitir la caché por versión (`?v=`); en el SIA, la API entrega sólo lo de cada pantalla | r5 |
| D4-02 | 21 pantallas | Con el HTML comprimido, los 10 a 20 scripts del final se piden uno tras otro: «Inicio» queda usable a los 27.6 s en 3G lento en lugar de 13.0 s | Para decidir 18 | r5 |
| RI-02 | `app/citas.js:131-132`, `app/programar.js:158-159` | «Día anterior/siguiente» y «Mes anterior/siguiente» se deshabilitan con el foco encima y el foco cae en `<body>` (2.4.3) | `aria-disabled` y conservar el foco, como `programar.js:421` | ri |

### 5.3 Bajos (45) e informativos (5)

| Auditoría | Claves | Resumen | Detalle |
|---|---|---|---|
| A6 | A6-01, A6-02, A6-03 | Marcador de posición a 4.41 y 4.23:1 (lo deja sin color el estándar); días del calendario delimitados con `--linea` (1.35:1); hojas del proyecto sin la estructura del estándar y medidas literales | r1 |
| C6 | C6-05 a C6-10 | Mismo concepto en colores distintos y dorado como señal; seis aspectos de plegable y `.plegable-titulo` redefinida; 39 aspectos de botón (22 del proyecto, `btn-chico` 440 veces); 4 avisos sin ícono; «Faltó» igual al botón de peligro; letra de 10.2 px y pesos que la fuente no trae | r1 |
| B1 | B1-02 a B1-06 | Barra de cupo vacía en un grupo cancelado (`.cupo{display:grid}` gana a `[hidden]`); botón «Menú de pruebas» tapa en parte el foco (también RI-05 y B4-09); «Corregir otro día» de 40.8 px; encimado de 33×6 px en asistencia a 360; `auditar-sitio.mjs` no ve el desborde en teléfono emulado | r2, r3, ri |
| B6 | B6-03, B6-04 | Tras «Recuperar borrador», el primer «Atrás» no hace nada; el distintivo de versión lee `VERSION` aparte del código | r2 |
| B4 | B4-03 a B4-07 | Regiones vivas que repiten o se encimen (calendario, cotejo, revisar, citas, borrador; también RI-03 y RI-04); ayudas a 13 px y «Qué sigue» a 14 px en teléfono (tokens del estándar); sección actual de la cabecera sólo por color; espaciado de texto a 320 px desborda revisar, cotejo y grupos (21 a 55 px); enlaces con el mismo nombre a lugares distintos | r3, ri |
| B4 (ind.) | RI-06 a RI-09, RI-11 | Revisar deja el foco fuera de la ventana tras decidir; resumen de «Programar» más alto que la ventana a 1280×720; visor en teléfono: el botón sigue diciendo «En el visor»; «Falta capturar el día N» es una alerta en cada carga; diálogos de baja y cancelación abren en el motivo, contra la decisión del 17/10 | ri |
| C1 | C1-04 a C1-07 | La observación anterior de una reenviada queda plegada; el aviso de día sin capturar no trae enlace; dos grupos con el mismo nombre en «Otros grupos en curso»; las inasistencias del día se registran una por una (6 acciones cada una) | r4 |
| C4 | C4-02 a C4-08 | La cuenta filtrada no dice qué filtros; búsqueda de citas y elegidas del planeador no persisten; una pestaña no se entera de lo hecho en otra (bandeja, cambio de persona); «Inscrita» a quien ya no tiene derecho; «41 por atender» con una en pausa | r4 |
| C3 | C3-01 a C3-03 | «Programar» lista a las 66 en espera para proponer 25 (64 % del alto en teléfono); «Formato admitido: PDF…» repetido en cada documento; «No soy un programa automático» se vuelve a pedir con la sesión abierta | r4 |
| C5 | C5-02 a C5-04 | «En espera de curso» y «en espera de grupo» en la misma tarjeta; una etiqueta de tú en las pantallas del personal (sólo prueba); «Vencida el» y «vence el» en la misma lista y dos «:» seguidos | r5 |
| D4 | D4-03, D4-04 | `VERSION` se pide dos veces por pantalla; la búsqueda de «Citas» con volumen tarda 472 a 568 ms por tecla con procesador 4× | r5 |
| Informativos | B4-08, C3-04, D4-05, RI-10, RI-12 | Títulos de pestaña sin folio; pase de lista de 21 clics (diseñado así); `espera.html` carga todo antes de redirigir; salidas del menú de pruebas como regiones vivas; contorno de foco recortado en la bandeja a 1024 px | r3, r4, r5, ri |

### 5.4 Ya registrados que siguen igual

P34 y P35 (lector de pantalla y Firefox/Safari, sin hacer); P69 (horarios de cita); P122; P132; P144 («pago de derechos»
→ «cuota»: 0 cambios); P152 a P158, P166 y P171 (estándar). De 27 hallazgos de textos anteriores, 14 corregidos y 13
siguen igual o en parte (detalle en `informe-r5.md`, 2.3). La agenda sigue sin distinguir una segunda cita (auditoría
de tareas del 17/10, §3). Los 2 avisos conocidos de `auditar-sitio` siguen.

## 6. Verificado sin hallazgos

axe: 0 violaciones en más de 1,000 corridas (256 cargas, 693 después de cada botón y de cada botón de cada diálogo, 45
resultados), a 390 y 1440. Teclado: los 9 flujos principales completos, examen incluido; sin trampas; anillo de foco
4.86:1; foco al resumen de errores y a los resultados; las 12,020 paradas con indicador visible; fuera de «Grupos»,
ninguna parada oculta por completo. Reflow a 320 px sin espaciado extra. El color nunca es la única señal en etiquetas,
bandeja, calendario y asistencia. Se puede pegar la contraseña; el reloj del examen no se anuncia cada segundo.
Barrido: 0 errores de consola, 0 respuestas 4xx o 5xx, 0 enlaces rotos en 2,149. Contraste: los 31 pares que colorea el
proyecto cumplen (el más bajo 4.60:1); 8,165 bordes, 927 íconos y 2,483 focos sin pendientes. Textos: un solo trato por
público; 0 «null», «undefined» o estados internos; un solo formato de montos; folio, expediente y acreditación con el
mismo nombre en todo el sistema. Teléfono: horizontal sin pérdidas; la cámara se abre con `capture="user"` y la foto se
guarda sin ubicación (P127 sigue resuelto); con red caída y con versión nueva no se pierde nada. Volumen: `probar-volumen`
68 de 68; el personal con volumen queda usable en 1.2 a 3.2 s.

## 7. Contradicciones entre documentos y datos atrasados

| Tema | Fuente 1 | Fuente 2 |
|---|---|---|
| Orden de la espera de renovación | DECISIONES:156 (por vencimiento) | DECISIONES:183 (bloques por organización) — C1-03 |
| Foco inicial de los diálogos con motivo | Decisión del 17/10 (foco en «Volver sin cambios») | `grupo.js` abre en el motivo — RI-11 |
| Cifras del planeador | Corrección M7 y «31 días o más» del 17/10 (AUDITORIA-TAREAS) | Planeador del 18/10 sin esas cifras — C1-01 |
| «a las» en la fecha del acuse | CHANGELOG del estándar 1.4.2 (P128) | Chromium 141 escribe una coma |

## 8. Para decidir (dueño)

Liber decidió los 19 puntos el 20/10/2026 (última columna). Difieren de la recomendación el 16 y el 17 (fechas).

| # | Pregunta | Opciones (costo) | Recomendación | Decisión de Liber (20/10/2026) |
|---|---|---|---|---|
| 1 | Barra de «Grupos» (B4-01, C2-01) | (a) Reservar su alto, sin cambio visible (S); (b) barra compacta de un renglón con «Agregar a… ▾» (M); (c) que deje de ser fija si mide más de ¼ de la ventana (S) | (a) y (c) ahora; (b) con el área | (a) y (c): arreglo sin cambio visible |
| 2 | Botones principales en «Grupos», «Programar» y «Mis grupos de hoy» (C6-02) | Un principal por pantalla y los demás secundarios (M), decidido junto con P164 | Con P164 | Uno principal por pantalla, junto con P164 |
| 3 | Espera de 10 días o más en la bandeja (C6-04) | (a) Rojo con la familia «te toca actuar» y el texto «18 días · atrasada» (S); (b) dejarlo y registrar la excepción | (a) | (a) rojo de «atender» con «N días · atrasada» |
| 4 | Botones de «Asistencia» (C6-09, C6-03) | (a) Opción corta Sí/No del estándar (S); (b) verde y rojo con ✓ y ✗ y contorno en alto contraste (S) | (a) | (a) Sí/No del estándar |
| 5 | Opción deshabilitada con su motivo dentro (r1, informativo) | (a) Dejarla (el motivo se lee a 2.08:1); (b) motivo como ayuda fuera de la opción, a contraste normal (S) | (b) | (b) motivo fuera de la opción |
| 6 | «Crea tu cuenta» al recargar o salir (B6-02) | (a) Avisar antes de salir (S); (b) borrador sin contraseña ni foto (M); (c) las dos (M) | (c) | (c) avisar y recuperar (sin contraseña ni foto) |
| 7 | Versión en pantalla (B6-04) | (a) Escribirla en el HTML al construir (S); (b) además avisar «hay una versión nueva» (M, etapa 3) | (a) ahora, (b) en la etapa 3 | (a) versión escrita en la página; el aviso, en la etapa 3 |
| 8 | Texto de la sesión que terminó (B6-01) | El propuesto en 5.2 u otro | El propuesto | El propuesto |
| 9 | Letra mínima en teléfono (B4-04) | (a) Subir en el estándar ayudas a 14 px y bajadas a 16 px (S, Pnn); (b) sólo en el proyecto; (c) dejarlo | (a) | (a) pedirlo al estándar (Pnn) |
| 10 | Fallas del núcleo del estándar (foco del borrador) | (a) Registrar el Pnn y rodear en `apd.js` (S); (b) sólo registrar | (a) para el foco | (a) rodear y reportar las que afectan a la persona |
| 11 | Orden de la espera de renovación (C1-03) | (a) Sin bloques, por vencimiento; (b) bloques ordenados por su vencimiento más antiguo y, dentro, primero las vencidas (S); (c) cambiar el encabezado | (b) | (b) bloques por vencimiento, primero las vencidas |
| 12 | Cierre del día de citas (C1-07) | (a) Filtro «Por atender» (S); (b) «Registrar inasistencias del día» en lote (M) | (a) ahora, (b) con P69 | (a) filtro «Por atender» ahora; el lote, con P69 |
| 13 | «No soy un programa automático» en la solicitud (C3-03) | (a) Quitarla de la solicitud y dejarla en la cuenta (S); (b) quitarla de las dos; (c) dejarla | (a) | (a) quitarla de la solicitud |
| 14 | Foto en el pase de lista (C1-02) | (a) Miniatura de 96 px que se amplía a unos 320 px (S); (b) columna más ancha en escritorio (S) | (a) | (a) miniatura que se amplía |
| 15 | Presupuesto de peso y velocidad (D4) | (a) Estricto: ≤ 200 KB y ≤ 20 peticiones, usable ≤ 5 s en 4G lento (L); (b) intermedio: persona ≤ 300 KB comprimidos y ≤ 40 peticiones, usable ≤ 8 s en 4G lento con procesador 4× y ≤ 20 s en 3G lento con 6×; personal ≤ 3 s con volumen y respuesta ≤ 200 ms | (b) | (b) intermedio |
| 16 | Formato de fechas y horas (C5-01) | (a) dd/mm/aaaa y «a las HH:MM» en todo (M); (b) fecha larga para lo que hay que recordar y dd/mm/aaaa en tablas (M) | (a) | **(b) fecha larga para lo que se recuerda (cita, curso, examen) y 20/10/2026 en tablas y datos** |
| 17 | Fecha del acuse (estándar) | (a) Pedir al estándar el estilo de fecha y, mientras, escribirla con `APD.fechaHora` (S); (b) aceptar la fecha larga en los acuses | (a) | **(b) se queda la fecha larga en el acuse**; se pide al estándar «a las» en lugar de la coma |
| 18 | Scripts al final del cuerpo (D4-02) | (a) `defer` en `<head>` en las 21 páginas (S); (b) un paquete por pantalla al entregar (M); (c) medir antes en teléfono real (P33) | (c) y luego (a) | (c) medir en teléfono real (P33) y luego (a) |
| 19 | Foco inicial de los diálogos con motivo (RI-11) | (a) Dejarlo en el motivo y registrar la excepción; (b) cumplir la decisión del 17/10 | (a) | (a) foco en el motivo; se registra la excepción a la decisión del 17/10 |

## 9. Fallas del componente compartido (estándar 1.5.1), sin clave todavía

| Clave propuesta | Falla | Dónde | Reportó |
|---|---|---|---|
| FC-1 | El marcador de posición no tiene color: queda el del navegador (4.41 y 4.23:1) | `nucleo.css`; `pares-contraste.json` | r1 |
| FC-2 | Usa Roboto 600, peso que la fuente no trae | `nucleo.css:204-216, 341`; `estado.css:23`; `tabla.css:27` | r1 |
| FC-3 | `auditor-css.mjs` con rutas se salta 4 reglas (A09, A13, A15, A16) | `herramientas/auditor-css.mjs` | r1 |
| FC-4 | Con movimiento reducido, todas las transiciones siguen activas a 0.01 ms (informativa) | `nucleo.css:439-443` | r1 |
| C-01 | La barra de pasos pegajosa ocupa 31 a 34 % del alto en teléfono horizontal y con zoom | módulo pasos | r2 |
| C-02 | En la bandeja, un `.solo-lector` absoluto se escapa de `.tabla-marco` y desborda la página (891 px en 768) | módulo tabla | r2 |
| RS-01 | Recuperar o descartar el borrador deja el foco en `<body>` (también B4-02) | `formkit.core.js:754, 756` | r3, ri |
| RS-02 | A 390 px la barra de pasos mide 141 px y `scroll-padding-top` reserva 112 | módulo pasos | ri |
| RS-03 | El visor anuncia el zoom y «Hoja 1 de N» cada vez que carga | módulo visor | ri |
| B4-04 | Ayudas a 13 px y bajadas a 14 px en teléfono (tokens) | `tokens.css` | r3 |
| FC-01 | El módulo de revisión pinta los bloques abiertos y la plantilla dice «Abre cada bloque» | `revision.js:39`; `plantillas/por-pasos.html:294` | r4 |
| F-fecha | `fechaHora` sólo escribe fecha larga; el CHANGELOG promete «a las» y Chromium escribe coma | `formkit.core.js` | r5 |
| F-envio | `envioLimite` habla en primera persona del plural | `validaciones.config.js` | r5 |

## 10. No verificable desde aquí, hipótesis y no confirmado

- **No verificable:** Firefox y WebKit (la red bloqueó su descarga; P35); lector de pantalla real (P34); teléfono real
  y su teclado virtual (P33); ampliación al 400 %; cabeceras reales de GitHub Pages (el proxy respondió 403); carga
  contra la API (etapa 3).
- **Hipótesis:** D4-02 se midió en la red simulada de Chromium; confirmarlo en un teléfono real. Los tiempos que dependen
  del procesador son cota superior: la máquina estaba compartida (carga media 8.2 con 2 procesadores). Hipótesis H1 a H3
  de r2 en su informe, sección 6.
- **No confirmado:** ninguno; todo lo reportado salió 2 de 2.

## 11. Plan de corrección en bloques

| Bloque | Qué va junto | Prueba que lo cierra | Versión |
|---|---|---|---|
| 1. Foco y accesibilidad (S) | B4-01 (con 1a y 1c), RI-02, rodeo de RS-01, B4-03/RI-03/RI-04, RI-06, RI-08, RI-09, B1-03 (`scroll-padding` del menú de pruebas), B4-05, B4-06, B4-07, A6-01 (rodeo del marcador) | Recorridos de foco de `guiones/ri` sin paradas ocultas en «Grupos»; regiones vivas con un anuncio por acción; axe sin cambios | 0.62 |
| 2. Mensajes y continuidad (S) | B6-01, B6-03, B6-04 (7a), B1-02, B1-04, B1-05, C5-02 a C5-04, D4-03 | `guiones/r2/b6.mjs` 4a lee «terminó»; barrido de `guiones/r2` sin hallazgos en esos estados | 0.62 |
| 3. Tareas y estados del personal (S a M) | C1-01, C1-04 a C1-06, C2-02, C4-01 a C4-08; lo decidido de C1-02, C1-03, C1-07, C3-01 a C3-03 | `guiones/r4` (c1, c4) con las cifras y los estados esperados | 0.63 |
| 4. Sistema visual (M) | C6-01 a C6-10, A6-02, A6-03, lo decidido en 2 a 5 | `guiones/r1/medir.mjs` y `colores-forzados.mjs` sin pendientes; inventario de botones dentro del estándar | 0.63 |
| 5. Peso (S a M) | D4-01, D4-04 y, tras P33, D4-02 | `guiones/r5/d4-peso.mjs` y `d4-tiempos.mjs` dentro del presupuesto decidido | 0.64 |
| 6. Fechas (M) | C5-01 con lo decidido en 16 y 17 | Detector de formatos de `guiones/r5` con un solo formato | 0.64 |
| 7. Estándar | Registrar las 13 fallas de la sección 9 como pendientes del grupo «Estándar» | Pendientes con número | junto con el 1 |

**Propuestas que cambian pantalla** (requieren aprobación, con su antes y después en los informes de r1, r2 y r4):
barra compacta de «Grupos» (1b), jerarquía de botones (2), espera en la bandeja (3), «Asistencia» (4), opción
deshabilitada (5), borrador de «Crea tu cuenta» (6), foto del pase de lista (14), fechas (16), «Programar» con la
lista plegada (C3-01).

## 12. Pruebas nuevas que deben quedar permanentes

| Prueba | Serie | Origen |
|---|---|---|
| Foco no oculto en el planeador con volumen, a 1440, 1280 y 1024 | Cada cambio (`probar-volumen`) | `guiones/ri/foco-recorrido.mjs` |
| Gestión del foco: borrador, botones en el límite, diálogos, resultados | Cada cambio (`probar-sitio`) | `guiones/ri/gestion-foco.mjs` |
| Un anuncio por acción en las regiones vivas | Cada versión | `guiones/ri/inventario-vivas.mjs` |
| Contraste medido sobre el fondo real y colores forzados | Cada versión | `guiones/r1/medir.mjs`, `colores-forzados.mjs` |
| Desborde con `scrollWidth > clientWidth` en el teléfono emulado (corrige `auditar-sitio`) | Cada cambio | `guiones/r2/b1-desborde.mjs` |
| Sesión caducada y continuidad | Cada versión | `guiones/r2/b6.mjs` |
| Cifras del planeador y estados persistentes (filtros, búsqueda) | Cada cambio | `guiones/r4` |
| Detector de formatos de fecha y de trato | Cada versión | `guiones/r5/c5-*.mjs` |
| Peso por pantalla contra el presupuesto | Antes de entregar | `guiones/r5/d4-peso.mjs` |

## 13. Criterios de salida

| Momento | Criterio | Cumple | Razón |
|---|---|---|---|
| En cada cambio | A6 sin pendientes | No | 2 pares del marcador de posición (estándar) |
| En cada versión | 0 críticos y 0 altos | No | B4-01 |
| Al terminar pantallas | Sin altos en C1 ni C5 | Sí | — |
| Antes de mostrar al área | Sin altos (B1, C1, C5) | No | B4-01 en el barrido de «Grupos» |
| Antes de cerrar la etapa | Dentro del presupuesto de peso; B4 con lector | No | Sin presupuesto; P34 |

## 14. Calendario

B1 y B4 (axe y foco) en cada versión, con los guiones de esta carpeta; A6 en cada cambio de estilos; C1 a C6 al
terminar las pantallas de la etapa 2 y tras cambios grandes de interfaz; D4 antes de entregar al SIA y con el presupuesto
decidido; B4 con lector de pantalla y B8 en Firefox y Safari en la sesión de P33 a P36.

## 15. Método

- **Revisores:** r1 (A6, C6), r2 (B1, B6), r3 (B4), r4 (C1 a C4), r5 (C5, D4) y un revisor independiente (foco y
  elementos fijos, sin ver el trabajo de los demás) por el alto de B4. Cada uno con su copia en `d58c611` y su puerto.
  Instrucciones comunes: `docs/auditoria-2026-10-20/encargo-comun.md`.
- **Navegador:** Chromium 1194 (Playwright 1.63.0), `timezoneId` de la Ciudad de México, `locale` es-MX. Anchos: 320,
  360, 390, 430, 768, 1024, 1280, 1440, 844×390 y zoom al 200 % (720×450 con densidad 2). axe-core 4.13.0 del estándar.
- **Volumen:** `herramientas/escenario-volumen.mjs`.
- **Pruebas:** 1,427 combinaciones de pantalla y tamaño; 3,999 botones; 43,454 paradas de Tab (31,434 de r2 y 12,020 de
  ri); más de 1,000 corridas de axe; 11,418 textos medidos; 129 estados de texto.
- **Línea base:** la verificación de GitHub sobre `d58c611` (base y sitio, en verde); `probar-volumen` 68 de 68.
- **Huellas:** 254 archivos, «Sin cambios» (`docs/auditoria-2026-10-20/huellas-antes.json` y `huellas-despues.json`).
- **Evidencia:** informes de cada revisor y guiones en `docs/auditoria-2026-10-20/`; capturas y salidas completas
  (unos 650 MB) fuera del repositorio.

## 16. Qué sigue

Decidir los puntos de la sección 8 y corregir el bloque 1, que cierra el único alto con esfuerzo S y deja la versión
lista para mostrar al área; después, los bloques 2 y 3. Antes de cerrar la etapa: fijar el presupuesto de peso y hacer
la sesión con teléfonos, Firefox, Safari y lector de pantalla (P33 a P36).
