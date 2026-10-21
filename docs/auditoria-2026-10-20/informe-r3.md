# B4 · Accesibilidad completa (WCAG 2.2 A y AA) · revisor r3 · 20/10/2026

Sistema de Acreditaciones de Poda y Dictaminación, versión de prueba 0.61 + PR #5, commit `d58c611`, estándar de
formularios 1.5.1. Copia `<copia del revisor r3>`, servida en el puerto 8903. Solo lectura: `git status` de la
copia al final no muestra cambios (solo `node_modules`, enlazado). Referencia: WCAG 2.2 niveles A y AA; donde se
menciona AAA es sólo como contexto.

**En una frase:** axe no encuentra nada en ningún estado (más de 1,000 corridas), y todos los flujos se pueden hacer
con el teclado. Pero en «Grupos», en computadora, la barra fija de abajo tapa por completo la casilla enfocada de quien
espera: de 56 a 75 de cada 75 con el escenario de volumen. Además, la franja del borrador recuperado deja el foco en
la nada.

**Totales: 9 hallazgos nuevos: 0 críticos, 1 alto, 1 medio, 5 bajos y 2 informativos.** Dos son fallas del componente
compartido (B4-02 y parte de B4-03 y B4-04), sin clave todavía.

---

## 1. Qué hice

**Herramientas:** Node 22, Playwright 1.63, Chromium 1194 (`/opt/pw-browsers/chromium`), axe-core 4.13 del estándar,
`timezoneId America/Mexico_City`, `reducedMotion: 'reduce'`. axe se inyecta con `page.evaluate(textoDeAxe)` y corre
después de esperar a que terminen las animaciones (`document.getAnimations()`), con las etiquetas `wcag2a`, `wcag2aa`,
`wcag21a`, `wcag21aa`, `wcag22a`, `wcag22aa` y `best-practice`. Visión simulada con
`Emulation.setEmulatedVisionDeficiency` de Chromium. Árbol de accesibilidad con `Accessibility.getFullAXTree` (CDP) y
`locator.ariaSnapshot()`, porque en Playwright 1.63 ya no existe `page.accessibility.snapshot`. Colores forzados con
`emulateMedia({ forcedColors: 'active' })`.

**Línea base:** `SOLO=accesibilidad probar-sitio`: 72 de 72 bien (36 estados × 2 anchos), `linea-base-axe.log`.

**Lo que se probó:**

| Frente | Cómo | Número |
|---|---|---|
| axe al cargar, en estados que probar-sitio no cubre | Las 21 pantallas sin sesión. «Mis trámites» y «Mi perfil» de cada uno de los 30 casos del menú de pruebas. Solicitud en borrador, con observaciones (poda y dictaminador), renovación y nueva. Corregir en 4 casos. Revisar las 5 enviadas. Cotejo de las 6 citas. Grupo en sus 5 estados, asistencia y aplicar de cada grupo en curso o concluido. Grupos de los 4 cursos. Verificar con número inexistente. 10 pantallas del personal con el escenario de volumen | 128 estados × 390 y 1440 px = **256 corridas, 0 violaciones** (`axe-estados.json`) |
| axe después de presionar cada botón | En 32 estados, cada botón visible sobre la página recién cargada. Dentro de cada diálogo que se abre, cada uno de sus botones (confirmaciones, visor, menú de pruebas, aviso de privacidad, franja del borrador) | **298** estados a 390 px y **395** a 1440 px, **0 violaciones** (`axe-botones-390.json`, `axe-botones-1440.json`) |
| axe en los resultados de cada flujo | Acuse de la cuenta y de la solicitud, cada paso de la solicitud, corregir, validada, con observaciones, rechazada y su confirmación, cotejo terminado, grupo confirmado, asistencia guardada y sin marcar, código del examen, «¿Eres tú?», instrucciones, pregunta, revisión, confirmación de envío, resultado del examen, franja del borrador, «Entrar» con error, «Verificar» vigente e inexistente, «Mi perfil» guardado | unas 45 corridas a 390 y 1440 px, **0 violaciones** |
| Teclado: barrido | Tab de principio a fin (hasta volver a «Ir al contenido») y 40 Mayús+Tab, en 32 estados (8 con volumen). Por cada foco: indicador, contraste del anillo, si algo fijo lo tapa (5 puntos con `elementFromPoint`), si queda fuera de la ventana, trampas | 32 × 2 anchos, unos 2,900 focos (`teclado-barrido-*.json`) |
| Teclado: flujos | Crear cuenta: sólo Tab, flechas, Espacio y Enter, la foto con Enter en «Elegir fotografía», el aviso de privacidad y la contraseña pegada con Control+V. Solicitud nueva con 4 documentos y corregir: sólo Tab. Revisar: validar, observar con chip de motivo y rechazar con su confirmación. Cotejo completo con factura, programar con el calendario de flechas, asistencia, pase de lista y examen completo de 10 preguntas. Franja del borrador, «Mi perfil», «Entrar» y «Verificar» | cada flujo a 390 y 1440 px (`teclado-*.json`, `*.log`) |
| Estructura y nombres | Idioma, título, encabezados en orden, nombres repetidos, controles sin nombre, enlaces genéricos, tablas, regiones vivas, letra, reflow a 320 px y espaciado de texto (1.4.12, hoja creada con `CSSStyleSheet`, que la política de contenido permite) | 30 estados × 390, 1440 y 320 px (`estructura.json`) |
| Color | Protanopia, deuteranopia, tritanopia y acromatopsia, en etiquetas de estado, bandeja con volumen (ámbar y rojo), citas, planeador con volumen, calendario, asistencia, aplicar y ficha del grupo | 10 pantallas × 5 visiones × 2 anchos = 100 capturas (`capturas/color-*`, `color.json`) |
| Lector de pantalla | **No hay lector real** (P34 sigue pendiente). En su lugar: árbol de accesibilidad de 16 pantallas de los flujos principales (`arbol/*.yml`) y registro de lo que cambia en las regiones vivas durante los flujos | — |

**Reproducción:** cada hallazgo de comportamiento se repitió desde un contexto nuevo del navegador, al menos 2 veces,
con guiones `repro-*.mjs`.

**No disponible:** Firefox y WebKit (la red bloqueó su descarga), lector de pantalla real, teléfonos reales.

## 2. Hallazgos

### B4-01 · En «Grupos», la barra fija tapa la casilla enfocada de quien espera · Alta · S

- **Dónde:** `grupos.html` en computadora (desde 760 px de ancho), perfil revisión y cotejo, columna «En espera».
  `app/apd.css:579`: `.plan-barra { position: sticky; bottom: 0; … }`, sin `scroll-padding-bottom` que la compense
  (en `formkit/css/base.css:18` y `nucleo.css:427` solo hay `scroll-padding-top`).
- **Qué pasa:** con Tab por la lista, el navegador desplaza la casilla enfocada hasta el borde de abajo de la ventana.
  Ahí queda debajo de la barra «Ninguna elegida», con un botón por cada grupo que recibe. La casilla no se ve, ni
  tampoco el nombre de la persona. Lo esperado es que el foco nunca quede oculto por completo (WCAG 2.4.11, AA).
  Lo observado, casillas tapadas por completo:

  | Ventana | Datos | Alto de la barra | Casillas | Tapadas por completo | En parte |
  |---|---|---|---|---|---|
  | 1440 × 900 | volumen | 312 px | 75 | **56** | 6 |
  | 1280 × 800 | volumen | 312 px | 75 | **61** | 0 |
  | 1024 × 768 | volumen | 364 px | 75 | **75** | 0 |
  | 1440 × 900 | ficticios | 150 px | 7 | 2 | 0 |
  | 1366 × 768 | ficticios | 150 px | 7 | 3 | 0 |
  | 390 × 844 | volumen | (no fija) | 75 | 0 | 0 |

- **Consecuencia:** quien arma grupos con el teclado marca o desmarca a una persona que no ve. Con 66 personas en
  espera, casi toda la lista queda a ciegas. Además, la barra ocupa entre el 35 % y el 47 % del alto de la ventana.
- **Cómo se reproduce:** abrir `grupos.html?curso=poda-nueva` con el escenario de volumen a 1440 × 900 y presionar
  Tab desde arriba. Desde el 15.º Tab la casilla enfocada queda bajo la barra.
- **Evidencia:** `guiones/repro-grupos-barra.mjs`, `repro-grupos-barra-1.json` y `-2.json`, idénticos.
  `capturas/grupos-barra-tapa-foco-1440x900-vol-1.png`: el foco está en la segunda casilla y no se ve nada.
- **Reproducido:** 2 de 2, en las 5 ventanas de computadora.
- **Causa probable:** barra pegada abajo, alta por los botones de cada grupo (que se envuelven en varios renglones),
  sin reservar ese espacio al desplazar el foco.
- **Corrección propuesta (cambia la pantalla, para aprobar):**
  - Antes: la barra pegada abajo mide 312 px con volumen y tapa la lista.
  - Después, opción A (S): mientras la barra está fija, `html { scroll-padding-bottom: <alto de la barra> }`,
    calculado con un `ResizeObserver` sobre `.plan-barra`. Así el foco se detiene encima de la barra.
  - Opción B (M): una barra compacta de un renglón («3 elegidas · Agregar a… ▾», con un menú o una lista de
    destinos que se abre), de unos 60 px.
  - Recomendación: A ya, y B si el área la aprueba.
- **Listo cuando:** `repro-grupos-barra.mjs` da 0 casillas tapadas, por completo o en parte, en las 6 ventanas. Se
  agrega como prueba de `probar-volumen`.
- **Estado:** Abierto.

### B4-02 · Al recuperar o descartar el borrador, el foco se va al inicio de la página · Media · S · Falla del componente compartido

- **Dónde:** `solicitud.html`, la franja «Recuperar borrador / Empezar de nuevo», perfil solicitante, 390 y 1440 px.
  `sitio/formkit/js/formkit.core.js:754` (`recuperar`: `franja.hidden = true` sin mover el foco) y `:756`
  (`descartar-si`, igual).
- **Qué pasa:** con Enter en «Recuperar borrador», la franja se oculta con el botón enfocado y el foco cae en `<body>`.
  Igual con «Descartar borrador». Lo esperado es que el foco vaya al primer campo o al título del paso.
- **Consecuencia:** quien usa el teclado tiene que empezar de nuevo desde «Ir al contenido» (8 Tabs hasta el
  formulario). Con lector de pantalla, se queda sin saber dónde está. Además, «Borrador recuperado en este dispositivo»
  se anuncia 2 veces seguidas, y el aviso de modalidad también.
- **Cómo se reproduce:** con una sesión, abrir la solicitud, elegir un nivel de estudios, escribir una carrera, recargar,
  y con el teclado dar Enter en «Recuperar borrador».
- **Evidencia:** `guiones/franja-borrador.mjs`; `franja-borrador-390-1.json`, `-390-2.json` y `-1440-2.json`:
  «Enter en «recuperar» → foco body» y «Enter en «descartar-si» → foco body». El paso intermedio sí está bien:
  «Empezar de nuevo» lleva el foco a «Conservar».
- **Reproducido:** 2 de 2 en cada ancho.
- **Causa:** el núcleo oculta la franja sin decidir a dónde va el foco.
- **Corrección propuesta (en el estándar):** después de ocultar la franja, enfocar el título del paso actual (con
  `tabindex="-1"`, como ya hace «Siguiente») o el primer campo, y anunciar una sola vez. Mientras, el proyecto puede
  hacerlo con un gancho, como hizo con P153.
- **Listo cuando:** una prueba recupera y descarta con Enter y comprueba que `document.activeElement` está dentro del
  formulario y que el anuncio sale una sola vez.
- **Estado:** Falla del componente compartido, sin clave (pariente de P153, que es el foco al cargar un archivo).

### B4-03 · Las regiones vivas repiten el mismo mensaje en cada tecla o cambio · Baja · S

- **Dónde y qué pasa:**
  - **Programar un curso**, calendario (`app/programar.js:129`): cada flecha dentro del mismo mes vuelve a escribir
    «Noviembre de 2026» en `#cal-mes` (`aria-live="polite"`). Fueron 5 anuncios en 5 teclas, en los dos anchos y en
    las dos corridas (`repro-calendario-anuncios-1.json` y `-2.json`). Un lector diría el mes además del día en cada
    flecha.
  - **Cotejo** (`app/cotejo.js:272`, `[data-resumen]` con `role="status"`): «Todo coincide y el pago está verificado.
    Al terminar, se abre su expediente físico…» (unas 30 palabras) se escribe de nuevo con cada respuesta. Se
    registraron 3 repeticiones seguidas al llenar la factura, a 1440 y 390 px (`teclado-personal-*.json`).
  - **Solicitud**: «Borrador guardado en este dispositivo.» se anuncia con cada cambio. En el paso de documentos se
    anunció 5 veces, intercalado con «Se agregó …pdf» (`teclado-solicitud-390-1.json` y `-1440-1.json`).
    Es del núcleo: `formkit.core.js:710`.
  - **Asistencia**: al guardar el día 2, el foco va al aviso «Asistencia del día 2 guardada» y, al mismo tiempo, la
    región de totales anuncia «0 asistieron · 0 faltaron · 10 sin marcar». Es el día 3, al que pasa la pantalla, pero
    suena como si no se hubiera guardado nada.
- **Consecuencia:** ruido para quien usa lector de pantalla: el mensaje importante se pierde entre repeticiones (WCAG
  4.1.3 se cumple; es un problema de uso).
- **Reproducido:** 2 de 2 en cada caso.
- **Corrección:** escribir en la región solo si el texto cambió (`if (n.textContent !== t)`). En el calendario, solo
  al cambiar de mes. En el borrador del núcleo, anunciar solo la primera vez y después dejarlo solo visible. En
  asistencia, no anunciar los totales del día nuevo hasta que se marque a alguien.
- **Listo cuando:** con el registro de anuncios (`teclado-lib.mjs`, `registroDeAnuncios`), 5 flechas en el mismo mes
  dan 0 anuncios del mes, y el resumen del cotejo no se repite con el mismo texto.
- **Estado:** Abierto. El borrador es falla del componente compartido, sin clave. Si un lector de verdad lo dice dos
  veces se confirma en P34.

### B4-04 · En teléfono, buena parte del texto va a 13 y 14 px · Baja · S · Falla del componente compartido (para decidir)

- **Dónde:** tokens del estándar, `sitio/formkit/css/tokens.css:97` (`--t-sm:13px; --t-md:14px`), `.ayuda`
  (`nucleo.css:39`, 13 px), `.secuencia-item` («Qué sigue», `nucleo.css:307`, 14 px) y `.bajada` (`base.css:114`,
  14 px).
- **Qué pasa:** el encargo pide el cuerpo a 16 px en teléfono. A 390 px, contando los caracteres visibles de `main`:

  | Pantalla | 16 px | 14 px | 13 px |
  |---|---|---|---|
  | «Crea tu cuenta» | 437 | 472 | **1,005** (ayudas) |
  | Solicitud | 306 | 348 | **1,051** |
  | «Mis trámites» | 113 | 569 («Qué sigue», etiquetas) | 231 (etiquetas de estado) |

  Nada queda por debajo de 12 px. Lo único de 12 px son las marcas «Por confirmar» del prototipo, que no van a
  producción. WCAG no fija un tamaño mínimo, así que no es incumplimiento AA.
- **Consecuencia:** las ayudas que explican cada documento y «Qué sigue» son lo que más lee la persona en el teléfono,
  y van en la letra más chica.
- **Evidencia:** `guiones/sonda11.mjs` (salida en este informe) y `estructura.json` (letra mínima, 12 px en los tres
  anchos).
- **Estado:** Para decidir (sección 5). Falla del componente compartido, sin clave.

### B4-05 · La sección actual de la cabecera del personal se distingue sólo por el color · Baja · S

- **Dónde:** cabecera del personal, en todas sus pantallas. `app/apd.css:154`:
  `.sesion-enlaces a[aria-current="page"] { font-weight: var(--peso-fuerte); color: var(--guinda); }`.
- **Qué pasa:** la sección actual va en guinda (`rgb(157,33,72)`) y en peso 700. Las demás van en azul
  (`rgb(26,86,168)`) y en peso 600, y todas subrayadas. En escala de grises y en protanopia las cinco se ven iguales
  (`capturas/enlace-actual-gris-1440.png`). En colores forzados también se pierde. Lector de pantalla: sí lo sabe
  (`aria-current="page"`).
- **Referencia:** WCAG 1.4.1. Se considera Baja porque el título h2 de la pantalla también dice dónde se está.
- **Reproducido:** 2 de 2 (`color.mjs` y `sonda6.mjs`, estilos calculados).
- **Corrección:** quitar el subrayado a la sección actual y ponerle una línea inferior gruesa (o un borde), o no hacerla
  enlace.
- **Listo cuando:** el enlace con `aria-current` tiene un rasgo que no es color: subrayado distinto, borde o
  `text-decoration: none` con borde inferior. Se comprueba con estilos calculados.
- **Estado:** Abierto.

### B4-06 · Con el espaciado de texto aumentado, a 320 px, tres pantallas se desbordan a lo ancho · Baja · S

- **Dónde:** `revisar.html` (341 px de ancho en una ventana de 320), `cotejo.html` (375 px) y `grupos.html` (348 px).
  Lo que se sale son el título del paso con el folio en `.mono` sin corte («Poda y derribo · solicitud nueva»,
  `APD-S-2026-00044`), las líneas de datos del cotejo y el nombre y los datos del grupo.
- **Qué pasa:** con el marcador de 1.4.12 (interlineado 1.5, letras 0.12 em, palabras 0.16 em, párrafos 2 em) a 320
  px, aparece desplazamiento horizontal. Sin el marcador, las 30 pantallas pasan el reflow a 320 px (1.4.10), y con el
  marcador a 390 px no hay desborde. No se pierde texto (no hay recorte), pero hay que desplazarse a lo ancho.
- **Evidencia:** `estructura.json` (marcas «ESPACIADO»), `guiones/sonda2.mjs` y
  `capturas/espaciado-320-revisar.png`, `-cotejo.png` y `-grupos.png`.
- **Reproducido:** 2 de 2 (`estructura.mjs` y `sonda2.mjs`).
- **Corrección:** permitir el corte del folio (`overflow-wrap:anywhere` en `.titulo-paso .mono`) y que las líneas de
  datos se envuelvan.
- **Listo cuando:** con el marcador a 320 px, `scrollWidth ≤ 321` en las tres pantallas.
- **Estado:** Abierto.

### B4-07 · Enlaces con el mismo nombre que llevan a lugares distintos · Baja · S

- **Dónde:**
  - «Grupos»: «Programar un curso esta semana» ×5 y «Elegir semana» ×3. Con volumen, «Ver a las personas de Poda
    nueva · del 10 al 14 de octubre» ×2: son dos grupos distintos, APD-G-2026-020 y -006, con el mismo nombre, y el
    enlace no lleva el folio.
  - «Material de estudio»: «Abrir el documento (se abre en otra pestaña)» ×3 y «Descargar» ×3.
- **Qué pasa:** el contexto (el encabezado de la semana o de la tarjeta, que sí lleva el folio) los distingue, así que
  cumplen 2.4.4 (AA). Pero en la lista de enlaces de un lector salen iguales (2.4.9, AAA).
- **Evidencia:** `estructura.json` (campo `arbol.repetidos`) y `arbol/grupos.yml`.
- **Reproducido:** 2 de 2 (390 y 1440 px).
- **Corrección:** agregar la semana o el folio al nombre («Programar un curso la semana del 19 al 25 de octubre»;
  «Ver a las personas del grupo APD-G-2026-020»; «Descargar la Norma NADF-001»), por ejemplo con texto `.solo-lector`.
- **Listo cuando:** en el árbol de accesibilidad no hay dos enlaces con el mismo nombre y distinto destino.
- **Estado:** Abierto.

### B4-08 · El título de la pestaña no dice qué solicitud, cita o grupo se tiene abierto · Informativa · S

- **Dónde:** `revisar.html` («Revisar una solicitud · Personal · …»), `cotejo.html` («Atender una cita de cotejo · …»)
  y `aplicar.html` («Aplicar el examen · …»), con cualquier folio. `grupo.html` y `asistencia.html` sí lo dicen
  («Poda nueva · del 13 al 17 de octubre · Iztapalapa · APD-G-2026-003 · …»).
- **Qué pasa:** cumple 2.4.2, porque el título dice el propósito. Pero con varias pestañas de revisión abiertas no se
  distinguen.
- **Evidencia:** `axe-estados.json`, campo `titulo` de las 5 revisiones y las 6 citas.
- **Corrección:** «APD-S-2026-00044 · Revisar una solicitud · Personal · …».

### B4-09 · Lo propio de la versión de prueba estorba al teclado y al lector · Informativa · S

- **Qué pasa:**
  - El botón fijo «Menú de pruebas» tapa en parte el control enfocado en el barrido y en el flujo de la cuenta: «Confirma tu correo» y
    «Sexo» en la cuenta a 390 px; «Revisar la solicitud …» en la bandeja a 390 y 1440 px; «Abrir el documento»;
    «Retomar la cita»; «Atender la cita»; «Mes siguiente». Nunca por completo, así que cumple 2.4.11.
  - Las cajas de dato interno (`output.interno-valor`) son regiones vivas implícitas y anuncian códigos como
    «dictaminador_nueva».
- **Estado:** Ya aceptado en parte el 18/10 (`AUDITORIA-2026-10-18.md:65-67`, solo para el pie del visor). Se va con
  el menú al pasar al SIA. No se cuenta como hallazgo de producción.

### Totales por gravedad

| Gravedad | Cuántos | Claves |
|---|---|---|
| Crítica | 0 | — |
| Alta | 1 | B4-01 |
| Media | 1 | B4-02 |
| Baja | 5 | B4-03, B4-04, B4-05, B4-06, B4-07 |
| Informativa | 2 | B4-08, B4-09 |

## 3. Verificado sin hallazgos

- **axe (WCAG 2.0, 2.1 y 2.2 A y AA, más buenas prácticas):** 0 violaciones en las 256 corridas al cargar, en las 693
  corridas después de presionar un botón y en las unas 45 corridas de resultados de flujos. Incluye los 30 casos del
  menú de pruebas, las listas vacías, los resultados de cada decisión, las confirmaciones, el visor, el menú de pruebas
  y la franja del borrador, a 390 y 1440 px, y con volumen.
- **Sin trampas de teclado:** en los 64 barridos el foco siempre vuelve a «Ir al contenido». Las «trampas» que marcó
  el guion en «Grupos» eran 5 enlaces seguidos con el mismo nombre (B4-07), no una trampa.
- **«Ir al contenido»** es el primer Tab en todas las pantallas. Se ve (0 a 49 px) y lleva al contenido. «Corregir» ya
  está aceptado el 18/10.
- **Foco visible:** anillo de 3 px `#1A73C7` a 2 px de distancia, con un contraste de 4.86:1 contra el fondo, en todos
  los focos medidos con la página quieta. Las marcas «sin indicador» del barrido rápido no se repitieron al medir a
  250 ms (`sonda7.mjs`): son del guion. En colores forzados el anillo se ve (`capturas/alto-contraste-*.png`).
- **Foco tras cada acción:**
  - Error al enviar: al resumen de errores, y su enlace lleva al campo (cuenta, entrar, solicitud, corregir).
  - «Siguiente»: al título del paso.
  - Acuses y resultados: al título del resultado (cuenta, solicitud, corregir, validada, con observaciones,
    rechazada, cotejo terminado, grupo confirmado, «Mi perfil»).
  - Asistencia: al aviso. «Verificar»: al resultado.
  - Confirmaciones: abren con el foco en «Volver sin cambios»; Escape las cierra y devuelve el foco al botón que las
    abrió.
  - Visor: en teléfono es modal, encierra el Tab y Escape devuelve el foco al botón. En computadora es un panel y el
    foco se queda en el botón, así que el siguiente Tab va a decidir ese documento.
  - Aviso de privacidad: Escape devuelve el foco.
  - Después de cargar un archivo el foco queda en «Quitar …»: la solución provisional de P153 funciona.
- **Flujos completos sólo con teclado:** crear cuenta, solicitud con 4 documentos, corregir, validar, observar (con
  chip de motivo), rechazar, cotejo completo con factura, programar con el calendario (flechas, Inicio, Fin, RePág y
  AvPág), asistencia, pase de lista y examen de 10 preguntas. Enter abre el selector de archivos 20 de 20 veces
  (`sonda4.mjs`) y 4 de 4 en «Corregir» (`sonda8.mjs`).
- **Examen:** el reloj no está en una región viva (0 anuncios del reloj en 5 s). Avisa a los 15, 5 y 1 minutos en
  `role="status"`. La barra fija del examen no tapó ningún foco con Mayús+Tab. El tiempo se dice antes de empezar
  («10 preguntas · 60 minutos»). 2.2.1: el límite del examen es esencial; el tiempo adicional por falla es P89.
- **Autenticación accesible (3.3.8):** la contraseña se puede pegar (Control+V, 25 de 25 caracteres en los dos campos).
  Tiene `autocomplete` `new-password` y `current-password`. No hay prueba cognitiva: «No soy un programa automático» es
  una casilla, y la trampa para programas está oculta al lector (`aria-hidden`, `tabindex="-1"`).
- **Entrada redundante (3.3.7):** la solicitud no vuelve a pedir lo de la cuenta. La renovación trae la acreditación
  anterior llenada y la cuenta del registro anterior trae la CURP.
- **Arrastrar (2.5.7):** la carga de archivos acepta arrastrar, pero siempre con el botón «Elegir». No hay deslizadores.
- **Tamaño del objetivo (2.5.8):** la regla `target-size` de axe pasa en todos los estados.
- **Reflow a 320 px (1.4.10):** sin desborde en los 30 estados medidos (sin el marcador de espaciado).
- **Idioma** `es-MX` en las 21 páginas. **Títulos** distintos por pantalla, y por grupo en la ficha y en asistencia.
  **Un solo h1 y sin saltos de nivel** en los 30 estados. **Tablas** con `th` en todas. **Sin controles sin nombre** en
  el árbol de accesibilidad. **Sin enlaces «aquí»**.
- **Movimiento reducido:** el estándar anula las animaciones. La única animación infinita es el giro mientras carga un
  archivo, y con movimiento reducido da una sola vuelta.
- **El color no es la única señal:**
  - Las cinco familias de estado llevan cada una su icono (`#i-ok`, `#i-alerta`, `#i-reloj`, `#i-error`) y su palabra.
  - La antigüedad de la bandeja dice los días con número e icono; el ámbar y el rojo se distinguen por el icono.
  - Los días que no se pueden del calendario llevan borde punteado y la razón en su nombre.
  - La asistencia dice «Asistió» y «Faltó» con palabra, y la leyenda tiene iconos.
  - Revisado en las cinco visiones (`capturas/color-*`).
- **Ayuda consistente (3.2.6):** no aplica todavía, porque no hay un medio de ayuda (P132).
- **Lo ya registrado sigue igual:** P171 está rodeada (`role="region"` en las hojas del visor; axe en 0). P153 está
  rodeada (el foco va a «Quitar»). P34 sigue pendiente.

## 4. Fallas del componente compartido

| Falla | Archivo:línea del estándar 1.5.1 | Clave |
|---|---|---|
| Al recuperar o descartar el borrador, el foco cae en `<body>`, y «Borrador recuperado» se anuncia dos veces (B4-02) | `formkit/js/formkit.core.js:754`, `:756` | Sin clave (pariente de P153) |
| «Borrador guardado en este dispositivo» se anuncia con cada cambio (B4-03) | `formkit/js/formkit.core.js:710` | Sin clave |
| Ayudas a 13 px y bajada y «Qué sigue» a 14 px en teléfono (B4-04) | `formkit/css/tokens.css:97`, `nucleo.css:39`, `:307`, `base.css:114` | Sin clave, para decidir |

Ninguna repite P152 a P158, P166 ni P171.

## 5. Para decidir (Liber)

| # | Pregunta | Opciones y costo | Recomendación |
|---|---|---|---|
| 1 | ¿Cómo se arregla la barra de «Grupos» (B4-01)? | (a) Reservar su alto al desplazar el foco: S, no cambia lo que se ve. (b) Barra compacta de un renglón con «Agregar a… ▾»: M, cambia la pantalla. (c) Barra no fija, al final de la lista: S, pero hay que bajar hasta ella | **(a) ya y (b) con el área** |
| 2 | ¿Letra mínima en teléfono para ayudas y «Qué sigue» (B4-04)? | (a) Subir en el estándar `--t-sm` a 14 px y `--t-md` a 16 px en teléfono: S en el estándar, revisar alturas. (b) Solo en el proyecto, para `.ayuda` y `.secuencia-item`: S, pero se aparta del estándar. (c) Dejarlo: WCAG no lo exige | **(a)**, registrando un Pnn para el estándar |
| 3 | ¿Las fallas del núcleo (B4-02 y el borrador de B4-03) van al estándar o se rodean? | (a) Registrar los Pnn y rodear en `app/apd.js` con un gancho: S. (b) Solo registrar | **(a)** para B4-02 (foco perdido); **(b)** para el anuncio repetido |

## 6. No verificable desde aquí, hipótesis y no confirmado

- **No verificable:**
  - Lector de pantalla real (NVDA, VoiceOver, TalkBack). Si de verdad repite el mes del calendario o el resumen del
    cotejo, y cómo lee las casillas de «En espera» (en el árbol, el nombre de la persona aparece dos veces: como nombre
    de la casilla y como texto). Se verifica con P34.
  - Firefox y Safari (P35).
  - Teléfonos reales, zoom del sistema y el teclado en pantalla sobre las barras fijas (P33).
- **Hipótesis:** en el selector de archivos real del sistema operativo, el foco puede volver sin anillo visible a
  «Quitar …», según cómo cada navegador aplique `:focus-visible` después de un diálogo del sistema. En Chromium sin
  ventana el registro de 80 ms no vio el anillo en 1 carga («Crea tu cuenta», 390 px, corrida 2) y sí en todas las demás.
- **No confirmado:**
  - «Sin indicador» y «fuera de la ventana» en focos sueltos del barrido rápido (80 ms) y en opciones enfocadas con
    `focus()`: no se repitieron a 250 ms ni con Tab real. Es falla de la prueba.
  - Dos veces el conductor de teclado no abrió el selector de archivos (cuenta a 1440 px, corrida 2; corregir a
    390 px). Aislado, Enter lo abre 24 de 24: falla de la prueba.
- **Falla de la prueba, no del sistema:**
  - El primer `teclado-revisar` decía que el foco del visor quedaba lejos de la decisión, porque usaba `focus()` sobre
    el documento que ya estaba en el visor. Con Tab real, el foco se queda en el botón y la decisión está al siguiente
    Tab (`repro-visor-escritorio-1.json` y `-2.json`).
  - En el resultado del examen, el texto oculto «Se acabó el tiempo» salió en la descripción del guion, que usa
    `textContent`. En pantalla no se ve (`capturas/teclado-examen-resultado-1440-1.png`).

## 7. Pruebas que conviene dejar permanentes

| Prueba | Guion (en `guiones/`) | Serie |
|---|---|---|
| Foco no tapado por barras fijas: casillas de «En espera» con volumen en 4 ventanas de computadora; 0 tapadas | `repro-grupos-barra.mjs` (a `probar-volumen`) | Cada cambio |
| axe al cargar en los 128 estados nuevos (cada caso del menú, cada variante de revisar, cotejo, grupo y volumen) | `axe-estados.mjs` | Cada versión |
| axe después de cada botón y de cada botón de cada diálogo | `axe-botones.mjs` | Cada versión |
| `probar-examen.mjs:481` corre axe sin `wcag22a` ni `wcag22aa`, y `probar-sitio.mjs:3549` sin `wcag21a`; agregarlas (hoy dan 0) | — | Cada cambio |
| Foco tras cada acción y región viva sin repeticiones (franja del borrador, calendario, cotejo) | `franja-borrador.mjs`, `repro-calendario-anuncios.mjs`, `teclado-lib.mjs` (`registroDeAnuncios`) | Cada cambio |
| Barrido de teclado: sin trampas, «Ir al contenido» primero, foco dentro de la ventana | `teclado-barrido.mjs` | Cada versión |
| Flujos sólo con teclado (cuenta, solicitud, revisar, personal, examen) | `teclado-*.mjs` | Cada versión |
| Espaciado de texto (1.4.12) y reflow a 320 px | `estructura.mjs` | Cada versión |
| Visión simulada y colores forzados (capturas para revisar a ojo) | `color.mjs`, `alto-contraste.mjs` | Cada cambio grande de interfaz |

Todo se repite con `BASE=http://localhost:<puerto>/ node guiones/<guion>.mjs`. Las rutas de la copia y de axe se
cambian con las variables `COPIA` y `AXE`.
