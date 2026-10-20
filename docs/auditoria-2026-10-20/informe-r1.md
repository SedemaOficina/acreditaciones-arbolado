# Auditoría de seguimiento 20/10/2026 · Revisor r1 · A6 Estilos y contraste · C6 Sistema visual

Sistema de Acreditaciones de Poda y Dictaminación, versión de prueba 0.61 + PR #5 (commit `d58c611`), estándar de
formularios 1.5.1 en `sitio/formkit/`. Revisión en solo lectura: la copia `aud20-r1` quedó sin cambios (`git status`
sólo muestra el enlace `node_modules` que ya estaba). Todo lo de esta carpeta se puede volver a correr.

## Resumen

| Gravedad | A6 | C6 | Total |
|---|---|---|---|
| Crítica | 0 | 0 | 0 |
| Alta | 0 | 0 | 0 |
| Media | 0 | 4 | 4 |
| Baja | 3 | 6 | 9 |
| **Total** | 3 | 10 | **13** |

Más 3 fallas del componente compartido nuevas (FC-1 a FC-3, sin clave todavía) y 1 informativa (FC-4).

- **A6, criterio «0 pendientes»: no aprobada por 2 pares.** De 11,418 mediciones de texto (85 pares distintos), 2
  pares quedan bajo 4.5:1 y los dos son el **marcador de posición** (placeholder) que pinta el navegador porque el
  estándar no le da color (A6-01, FC-1). Todo el texto que colorea el proyecto cumple (31 pares; el más bajo, 4.60:1).
  Bordes, íconos y anillo de foco: 0 pendientes en 8,165 + 927 + 2,483 mediciones.
- **C6:** lo más importante es que **cuatro piezas propias del proyecto pierden el estado elegido en alto contraste**
  (C6-01: en «Asistencia» no se ve si se marcó «Asistió» o «Faltó»), que «Grupos» muestra **hasta 6 controles con
  relleno guinda** a la vez cuando el estándar pide uno (C6-02) y que **lo elegido tiene cuatro colores** distintos
  (C6-03).

---

## 1. Qué hice

**Método.** Un guion de Playwright (`medir.mjs`) abre cada estado en un contexto nuevo del navegador (Chromium 1194,
zona `America/Mexico_City`, movimiento reducido), hace la acción del estado y mide dentro de la página:

- **Texto** (nodos de texto propios, valores de campos, `::before`/`::after` y `::placeholder`): color contra el
  **fondo compuesto real** (se suman los fondos de todos los ancestros con su transparencia y se aplica la opacidad del
  primer ancestro que la tenga), razón WCAG y mínimo (4.5:1; 3:1 si mide 24 px o más, o 18.66 px en negritas).
- **Líneas**: cada borde visible (lado por lado), las sombras interiores usadas como filete, los contornos permanentes,
  y el límite de cada control sin borde (su fondo contra el de afuera). Se clasifican: control de captura (campo,
  casilla), botón, o separador/decoración.
- **Íconos SVG** (color heredado contra el fondo de afuera) y **gráficos sin texto** (barras de cupo, lugares, muestras
  de leyenda).
- **Anillo de foco**: se recorre cada pantalla con Tab (hasta 160 paradas o hasta volver al primero); de cada elemento
  enfocado, o del ancestro que pinta el anillo, se lee el contorno y se compara con el fondo de afuera. Se espera a que
  terminen las transiciones antes de leer (ver FC-4).
- **Origen** de cada color: se apagan `app/apd.css` y `app/examen.css` en la misma página y se vuelve a leer; si cambia,
  lo pone el proyecto; si no, el estándar. Es una aproximación (en 1 caso, el `summary` de «Corregir otro día», dio
  «estándar» y la regla es del proyecto, `apd.css:390`); los hallazgos citan la línea del CSS leída a mano.
- **Inventario C6**: cada botón y todo lo que parece botón (enlace con fondo o borde, `summary`, opción de asistencia)
  con su fondo compuesto, color, borde, radio, alto, peso, tamaño y familia; cada etiqueta de estado (texto, familia,
  ícono); cada aviso y desenlace (clase, tono, ícono, título); tamaños de letra y espacios usados.

**Estados medidos: 67, a 390 px (teléfono, táctil) y 1440 px (escritorio) = 134 por corrida, dos corridas idénticas.**
Las 21 pantallas: `index` (sin y con sesión), `cuenta` (vacía, con errores, con el menú de pruebas abierto), `entrar`
(vacía, con errores), `tramites` con una persona en **cada uno** de los 13 estados de solicitud que hay en los ficticios
(todas las familias de etiqueta), `datos`, `solicitud` (nueva, con errores, borrador, con observaciones), `corregir`
(y con errores), `verificar` (vacía, con errores, vigente, no vigente, no existe), `material`, `revision` (ficticios y
**volumen**: 65 por revisar), `revisar` (con errores, rechazo por perfil, observación con chip de motivo frecuente
elegido, visor abierto), `citas` (y volumen: 40 citas), `cotejo` (cita del día, cita futura, con errores, factura),
`grupos` (poda nueva, renovación, volumen con personas elegidas), `espera` (redirige), `programar` (con curso, sin
curso, sin personas: aviso de bloqueo), `grupo` (en integración, en curso, cancelar con confirmación), `asistencia`
(mis grupos de hoy, grupo, guardar sin marcar, con «Asistió» y «Faltó» marcados, volumen), `aplicar` (hoy y grupo),
`examen` (entrar, con errores, pregunta contestada con el mapa abierto), `material-personal`.

**Además:**

| Prueba | Archivo | Resultado |
|---|---|---|
| Tabla de contraste del estándar 1.5.1 (`contraste.mjs`) | `contraste-estandar.txt` | 76 pares, 0 fallas. `tokens.css` de la copia es idéntico al del estándar |
| Auditor de CSS del estándar sobre las dos hojas, como lo corre el proyecto (por ruta) | `auditor-css-proyecto.txt` | 0 hallazgos |
| El mismo auditor en **modo paquete** con las hojas del proyecto (configuración del estándar apuntada al sitio) | `auditor-css-paquete.txt`, `auditor-paquete/` | 21 hallazgos (ver A6-03) |
| Clases declaradas en `apd.css`/`examen.css` que ningún HTML ni JS nombra | `clases-sin-uso.mjs` → `.txt` | 321 clases; 0 sin uso (2 se arman por concatenación) |
| Pares de color propios del proyecto que pueden no aparecer en los estados (cursor encima, tonos del reloj, inhábil) | `pares-proyecto-estaticos.txt` | 24 pares calculados con `contraste.mjs` |
| Pesos y tamaños de letra fuera de lo que trae el estándar | `letras-raras.mjs` → `.txt` | ver C6-10 |
| Colores forzados (alto contraste de Windows, emulado), dos corridas | `colores-forzados.mjs` → `-1.txt`, `-2.txt`, `capturas/forzados-*.png` | ver C6-01 |
| Estilos que pone el JavaScript del proyecto | búsqueda de `.style.`, `style=`, `setProperty`, colores literales en `app/*.js` | sólo `grupo.js:74` (ancho de la barra de cupo); ningún color |

Capturas de página completa de los 134 estados en `capturas/<estado>-<ancho>.png`. Tablas completas en `resumen.md`
(salida de `analizar.mjs medicion-1.json medicion-2.json`).

**Límites.** Sólo Chromium: Firefox y WebKit no están disponibles (la red bloqueó su descarga). Sin lector de pantalla
real. Los colores forzados se emularon en Chromium, no en Windows. No se instaló nada.

---

## 2. Hallazgos (de más a menos graves)

### C6-01 · Con alto contraste no se ve lo elegido en cuatro piezas propias del proyecto
- **Gravedad:** Media · **Esfuerzo:** S
- **Dónde:** «Asistencia» (`apd.css:379-385`, `.asis-opcion`), «Grupos» (`apd.css:429` `.plan-curso[aria-pressed]`,
  `apd.css:453` `.plan-persona:has(:checked)`), «Programar un curso» (`apd.css:547-548` `.cal-dia[data-rango]`); personal
  en computadora, 1440 px.
- **Qué pasa:** el estándar avisa lo elegido también en colores forzados (`opciones.css:111`, contorno `Highlight`). Las
  piezas propias sólo lo dicen con el color de fondo y del borde, que el modo de alto contraste reemplaza. Esperado: lo
  elegido se distingue de lo no elegido. Observado (estilos calculados, `colores-forzados-1.txt`):
  elegido y no elegido quedan **idénticos** (fondo blanco, texto negro, borde negro de 1 px) en las cuatro piezas; la
  opción del estándar (`.opcion-fila`) sí cambia (contorno de 3 px).
- **Consecuencia:** quien pasa lista con alto contraste no ve si marcó «Asistió» o «Faltó» (el botón de opción real es
  invisible, `opacity: 0`, `apd.css:380`); en «Grupos» no ve qué curso está viendo; en el calendario, los días del curso
  elegido entre «inicia» y «examen» no se marcan.
- **Cómo se reproduce:** `node colores-forzados.mjs http://localhost:8901/` con el sitio servido.
- **Evidencia:** `colores-forzados-1.txt`, `colores-forzados-2.txt` (iguales), `capturas/forzados-asistencia.png`
  («Asistió» elegido se ve como sin elegir).
- **Reproducido:** 2 de 2.
- **Causa probable:** las reglas del proyecto no tienen su adaptación `@media (forced-colors: active)`; sólo
  `examen.css:85-87` la tiene (para el número de la pregunta actual).
- **Corrección propuesta:** en `apd.css`, dentro de `@media (forced-colors: active)`: contorno `var(--b-3) solid Highlight`
  para `.asis-opcion:has(:checked)`, `.plan-curso[aria-pressed="true"]`, `.plan-persona:has(:checked)` y
  `.cal-dia[data-rango]` (como `opciones.css:111`). Mejor aún, ver C6-03.
- **Listo cuando:** una prueba con `forcedColors: 'active'` compara los estilos calculados de lo elegido y lo no elegido
  en las cuatro piezas y encuentra diferencia.
- **Estado:** Abierto. Relacionado con P35 («Probar … alto contraste»), que sigue abierto: esto es un caso concreto que
  ya se puede corregir sin esperar esa sesión.

### C6-02 · Hasta 6 controles con relleno guinda a la vez; el estándar pide un botón principal por pantalla
- **Gravedad:** Media · **Esfuerzo:** M (la corrección cambia la pantalla: propuesta abajo)
- **Dónde:** «Grupos» (390 y 1440 px), «Programar un curso», «Mis grupos de hoy» (`asistencia.html` y `aplicar.html`
  sin folio). Estándar: `docs/02-guia-de-estilo.md` §7 «El botón principal es guinda relleno, uno por pantalla».
- **Qué pasa (medido en las dos corridas, `resumen.md`, «Controles con relleno guinda»):**

  | Pantalla | Rellenos guinda visibles | Cuáles |
  |---|---|---|
  | Grupos (ficticios) | 5 | «Programar un curso» (`btn-primario`), el curso elegido (`plan-curso[aria-pressed=true]`, `apd.css:429`, igual de relleno que el principal), «Al curso del 26 al 30 de octubre», «Completar con las 4 que más esperan», «Completar con la que más espera» (`btn-chico btn-primario`) |
  | Grupos (volumen, 66 en espera) | 6 | lo mismo y un «Completar con…» más por cada grupo por confirmar |
  | Grupos, renovación | 3 | «Programar un curso», curso elegido, «A un curso nuevo…» |
  | Programar un curso | 3 | días «inicia» y «examen» del calendario (`apd.css:548`) y «Crear y confirmar el grupo» |
  | Mis grupos de hoy | 2 (volumen: 4) | un «Pasar lista y aplicar» / «Pasar asistencia» por tarjeta |

- **Consecuencia:** la acción principal no se distingue; el curso elegido parece un botón que hay que pulsar.
- **Cómo se reproduce:** `node medir.mjs` y `node analizar.mjs medicion-1.json`; o abrir `grupos.html` a 1440 px
  (`capturas/grupos-1440.png`).
- **Reproducido:** 2 de 2.
- **Causa probable:** la maqueta del planeador (DECISIONES 2026-10-18, propuesta A) fijó qué botones hay, no su jerarquía.
- **Corrección propuesta (antes → después):** en «Grupos», «Programar un curso» sigue relleno; los cursos pasan al
  aspecto de elegido del estándar (fondo azul claro, borde azul, palomita; o el módulo `pestanas`); «Al curso…»,
  «Completar con…» pasan a secundario. En el calendario, «inicia» y «examen» con fondo guinda claro y borde guinda de
  2 px. En «Mis grupos de hoy», secundario en cada tarjeta, o principal sólo en la del grupo con examen hoy.
- **Listo cuando:** en cada estado de `medir.mjs` hay como máximo 1 control con fondo `#9D2148` (sin contar «Ir al
  contenido»).
- **Estado:** Decide el dueño. Es la misma regla de P164 («Mis trámites» con dos botones principales), en otras
  pantallas.

### C6-03 · Lo elegido o lo actual tiene cuatro tratamientos de color; el guinda claro significa dos cosas
- **Gravedad:** Media · **Esfuerzo:** M
- **Dónde:** estándar `02-guia-de-estilo.md` §1 (`--azul`: «estado seleccionado»; `--azul-cl`: «fondo de lo
  seleccionado»; `--guinda-cl`: «filas alternas de tabla, leyenda de obligatorios, número de la secuencia») y §7
  («Seleccionado: fondo azul claro, sombra interior, palomita»).
- **Qué pasa (inventario de botones, `resumen.md`, aspectos 4, 19, 23, 25, 29, 35, 36, 38 y la tabla de líneas):**

  | Tratamiento | Dónde | Regla |
  |---|---|---|
  | Azul claro + borde azul (estándar) | opciones de los formularios, chips, pregunta contestada del examen | `opciones.css:88`, `examen.css:70` |
  | Guinda relleno, texto blanco | curso elegido en «Grupos»; días «inicia»/«examen» | `apd.css:429`, `apd.css:548` |
  | Guinda claro + borde guinda | persona elegida en «Grupos»; días del curso en el calendario | `apd.css:453`, `apd.css:547` |
  | Borde o texto guinda | documento abierto en el visor («En el visor», botón secundario con borde guinda); enlace de la sección actual; pregunta actual del examen (sombra interior guinda) | `apd.css:186`, `apd.css:154`, `examen.css:72` |
  | Verde o rojo relleno, texto blanco | «Asistió» / «Faltó» elegidos | `apd.css:382-383` |

  El guinda claro (`#F7F1F3`) es a la vez la fila alterna de las tablas del estándar y la persona elegida.
- **Consecuencia:** la misma idea (lo que elegí) se aprende cuatro veces; en «Grupos» lo elegido (guinda) y la acción
  principal (guinda) se confunden (C6-02).
- **Cómo se reproduce / Evidencia:** `resumen.md` (aspectos de botón), `capturas/grupos-elegidas-volumen-1440.png`,
  `capturas/asistencia-marcada-390.png`, `capturas/programar-390.png`.
- **Reproducido:** 2 de 2.
- **Causa probable:** piezas hechas antes de que el estándar tuviera estos módulos, o a partir de maquetas aprobadas sin
  regla de color de lo elegido.
- **Corrección propuesta:** lo elegido con el tratamiento del estándar (azul claro, borde azul, palomita) en `plan-curso`,
  `plan-persona` y los días del calendario; lo «actual» (sección, documento en el visor, pregunta actual) con
  `aria-current` y subrayado o borde, sin relleno. «Asistió»/«Faltó»: ver C6-09.
- **Listo cuando:** una prueba recorre los elementos con `aria-pressed="true"`, `:checked` dentro de una tarjeta o
  `[data-rango]` y todos tienen fondo `#EEF3FA` y borde `#1A56A8`.
- **Estado:** Decide el dueño (cambia pantallas aprobadas).

### C6-04 · La espera de la bandeja usa la familia «cerrado sin éxito» (rojo, ícono de error) y «N días» cae en tres familias
- **Gravedad:** Media · **Esfuerzo:** S
- **Dónde:** «Solicitudes por revisar» (`revision.html`), `personal.js:37` y `:81` (`tono: n >= 10 ? 'error' : n >= 3 ?
  'pend' : ''`), módulo `estado` del estándar.
- **Qué pasa:** la etiqueta de espera «10 días» … «20 días» sale como `estado-rechazo` con el ícono de error (la misma de
  «Rechazada», «No acreditada», «Sin derecho a examen»); «3 días» a «9 días», como «te toca actuar»; «Hoy», «1 día»,
  «2 días», como «en marcha». El estándar (`02-guia-de-estilo.md` §7): «Rojo (error), cerrado sin éxito: rechazado,
  cancelado, vencido … el rojo no se usa para “En revisión”». Con el escenario de volumen (65 por revisar): 26 etiquetas de espera rojas con equis, 22 ámbar y 17 azules, igual a
  390 y 1440 px.
- **Consecuencia:** en la bandeja, una solicitud atrasada se ve con la misma etiqueta que una rechazada.
- **Evidencia:** `resumen.md`, «Mismo texto con familias distintas: «N días» → estado-atencion / estado-proceso /
  estado-rechazo»; `capturas/revision-volumen-1440.png`.
- **Reproducido:** 2 de 2.
- **Causa probable:** la decisión del 16/10 (ámbar desde 3 días y rojo desde 10, P02) es anterior al módulo de
  etiquetas (18/10); al pasar al módulo, el rojo se tradujo a la familia «rechazo».
- **Corrección propuesta:** ver «Para decidir», punto 1.
- **Listo cuando:** ninguna etiqueta de espera usa `estado-rechazo` (o la decisión queda registrada como excepción).
- **Estado:** Decide el dueño (DECISIONES 2026-10-16 fijó el rojo; no fijó la familia ni el ícono).

### A6-01 · El marcador de posición de dos campos queda bajo 4.5:1
- **Gravedad:** Baja · **Esfuerzo:** S
- **Dónde:** «Crea tu cuenta» (`cuenta.html:112`, «Sexo», de solo lectura: «Se llena con tu CURP»; `cuenta.html:88`,
  «Fecha de nacimiento», con error: «dd/mm/aaaa»), 390 y 1440 px. Los mismos `dd/mm/aaaa` están en `revisar.html:362`,
  `programar.html:86`, `grupo.html:94`, `cotejo.html:398`.
- **Qué pasa:** el estándar no da color al `::placeholder`; Chromium usa `#757575`. Medido: **4.41:1** sobre el fondo de
  solo lectura (`#F9FAFB`) y **4.23:1** sobre el fondo de error (`#FDF3F2`); sobre blanco, 4.61:1. Mínimo 4.5:1 (WCAG
  1.4.3). En Firefox el marcador va con opacidad y el valor cambia (no verificado aquí).
- **Consecuencia:** baja: los dos textos repiten su ayuda («Se toma de tu CURP», «Escribe día, mes y año…»), así que no
  se pierde información; pero no cumple la medición y depende del navegador.
- **Cómo se reproduce:** `medir.mjs`, estados `cuenta` y `cuenta-errores`.
- **Evidencia:** `resumen.md`, tabla de texto, dos filas «Pendiente de decisión»; `axe` no mide marcadores, por eso no
  salía en `probar-sitio`.
- **Reproducido:** 2 de 2.
- **Causa probable:** FC-1.
- **Corrección propuesta:** en el estándar (FC-1). Mientras, el proyecto no necesita rodearlo: el texto se repite en la
  ayuda.
- **Listo cuando:** el color del marcador sobre `--solo-lectura-bg` y `--error-bg` da 4.5:1 o más en `medir.mjs`.
- **Estado:** Falla del componente compartido (FC-1).

### A6-02 · Los días del calendario se delimitan con `--linea` (1.35:1), que el estándar reserva para separar
- **Gravedad:** Baja · **Esfuerzo:** S
- **Dónde:** «Programar un curso», `apd.css:538` (`.cal-dia { border: var(--b-1) solid var(--linea) }`); 100 días
  medidos por estado.
- **Qué pasa:** `tokens.css:62`: «`--linea` separa; NUNCA delimita un control (1.35:1)»; para delimitar un control está
  `--borde` (3.43:1). El día disponible es un botón con borde `#DCDEE0` sobre blanco (1.35:1); el no disponible, borde
  discontinuo `--borde` sobre gris. No es una falla de WCAG 1.4.11 (el número identifica el botón y el día no disponible
  está inactivo), por eso queda Baja, pero contradice la regla del estándar y el día disponible se ve más tenue que el
  que no se puede elegir (`capturas/programar-390.png`).
- **Relacionado, informativo:** las barras de cupo usan colores bajo 3:1 (lugar libre `#DCDEE0` sobre blanco, 1.35:1;
  relleno dorado sobre la pista, 2.25:1, `apd.css:291-292, 488`). Llevan `aria-hidden` y el mismo dato en texto
  («3 de 25 · faltan 2…»), así que WCAG no las exige.
- **Reproducido:** 2 de 2.
- **Corrección propuesta:** `.cal-dia { border-color: var(--borde) }` (3.43:1).
- **Listo cuando:** ningún botón tiene borde `--linea` (prueba sobre la tabla de líneas de `medir.mjs`).
- **Estado:** Abierto.

### A6-03 · Las hojas del proyecto no siguen la estructura del estándar y el auditor, como lo corre el proyecto, no lo ve
- **Gravedad:** Baja · **Esfuerzo:** M
- **Dónde:** `sitio/app/apd.css`, `sitio/app/examen.css`.
- **Qué pasa:** con el auditor del estándar en modo paquete (`auditor-css-paquete.txt`):
  - A13 ×2: ninguna de las dos hojas declara bloques (`/* @bloque … */`); `apd.css` dice «Orden: componentes → estados →
    adaptaciones» (línea 10) pero tiene 480 líneas de componentes después de «Adaptaciones» (línea 107) y 15 `@media`
    repartidos entre los componentes (49, 98, 109, 160, 214, 223, 246, 254, 277, 332, 567, 578, 584 …); en `examen.css`
    las reglas del resultado (100-113) van después de «Impresión».
  - A15 ×1: `apd.css:262` redefine el token `--ancho-contenido` fuera de `tokens.css`.
  - A09 ×2 (falsa alarma): `.asis-opcion-si`/`-no` se arman en `asistencia.js:217`; el estándar pide declararlas como
    clases dinámicas.
  - Medidas literales fuera de los tokens (el auditor no revisa `grid-template-columns` ni multiplicadores): `13rem`
    (`apd.css:50`), `7rem` (575), `9rem` (580), `90vh` (72), `100dvh` (254, 264), `* 1.6` (193, 262), `* 1.5` (198),
    `* 1.4` (247), `* 1.25` (298), `* .85` (543), `4 / 5` (198), `* 2` (`examen.css:46`).
  - Con la ruta de las hojas (como lo corre el proyecto) el resultado es 0 hallazgos: ese modo se salta A09, A13, A15 y
    A16 (FC-3).
- **Consecuencia:** una regla nueva puede quedar en el lugar equivocado y ganar o perder sin que nada avise (lo que el
  auditor existe para impedir).
- **Reproducido:** 2 de 2 (resultado determinista).
- **Corrección propuesta:** marcar bloques y juntar los `@media` al final de cada hoja; quitar la redefinición o pedir al
  estándar un token para la página amplia; pasar las medidas a tokens o a múltiplos de tokens.
- **Listo cuando:** `auditor-paquete/` (o su equivalente en `herramientas/`) da 0 errores sobre las hojas del proyecto.
- **Estado:** Abierto.

### C6-05 · La misma cosa con colores distintos, y el dorado usado como señal
- **Gravedad:** Baja · **Esfuerzo:** S
- **Qué pasa:**
  - «No vigente»: ámbar «te toca actuar» si es renovable y gris «terminado» si no (`apd.js:51-52`, decisión de la
    auditoría del 18/10, D6), y rojo con equis en «Verificar» (`config-verificar.js:54`, `.verificacion[data-tono=error]`).
    Mismo texto, tres colores; la diferencia entre los dos primeros sólo la dicen el color y el ícono.
  - Lugares ocupados del grupo: guinda en «Grupos» (`apd.css:489`) y dorado en la ficha del grupo (`apd.css:292`).
  - El dorado como señal de estado: el grupo «en integración» se distingue con borde y filete dorados (`apd.css:480`;
    2.78:1 sobre la página, 3.04:1 sobre blanco) y el bloque de una organización con borde dorado discontinuo
    (`apd.css:455`). `tokens.css:55`: dorado «SÓLO filetes y rellenos decorativos».
- **Consecuencia:** quien usa varias pantallas aprende colores que no significan lo mismo.
- **Reproducido:** 2 de 2 (`resumen.md`, etiquetas y gráficos).
- **Corrección propuesta:** textos distintos para «No vigente» renovable y no renovable («Vencida · puedes renovarla» /
  «Vencida»); el cupo con el mismo color en las dos pantallas; el grupo en integración se dice con su etiqueta («Por
  confirmar», ya existe) y el dorado queda como filete.
- **Listo cuando:** ningún texto de etiqueta aparece con dos familias (comprobación de `analizar.mjs`).
- **Estado:** Abierto.

### C6-06 · Seis aspectos para el mismo componente plegable; una clase del estándar redefinida
- **Gravedad:** Baja · **Esfuerzo:** S
- **Qué pasa (inventario, aspectos 13, 18, 24, 27, 30, 37):** los `details/summary` se ven de seis maneras: título del
  estándar `.plegable-titulo` **redefinido** en `apd.css:175` (Cabin 500 en lugar de 700, sin la caja ni la flecha
  guinda del estándar, `acordeon.css`), «Qué estudiar» guinda Roboto (`apd.css:350`), «Cambiar este archivo» azul sin
  subrayado (`apd.css:125`), «Corregir otro día» azul subrayado (`apd.css:390`), «Ver todas las preguntas» azul Cabin
  (`examen.css:33`), «Grupos que ya terminaron» negro Cabin (`apd.css:502`).
- **Consecuencia:** lo que se despliega no se reconoce de una pantalla a otra; la clase del estándar ya no se ve como el
  estándar dice.
- **Reproducido:** 2 de 2.
- **Corrección propuesta:** el módulo `acordeon` tal cual (`details.plegable > summary.plegable-titulo`) donde la sección
  es plegable; donde es un enlace que despliega, un solo aspecto (azul subrayado, como `btn-enlace`).
- **Listo cuando:** todos los `summary` visibles comparten color, peso y familia, o son `.plegable-titulo` sin
  redefinir.
- **Estado:** Abierto.

### C6-07 · 39 aspectos de botón; 22 son del proyecto, incluido un tamaño chico que el estándar no tiene
- **Gravedad:** Baja · **Esfuerzo:** M
- **Qué pasa:** 1,804 botones y cosas con aspecto de botón medidos por corrida, en 39 aspectos (tabla completa en
  `resumen.md`). El estándar trae 7 formas (principal, secundario, peligro relleno, peligro de contorno, atrás, enlace,
  ícono) más las de sus módulos (pasos, zona de carga, chips, mostrar contraseña). El proyecto agrega:

  | Forma propia | Dónde | Regla |
  |---|---|---|
  | `btn-chico` (13 px, 44 px de alto) en primario y secundario: 440 apariciones en 8 pantallas del personal | revision, revisar, citas, cotejo, grupos, datos, aplicar | `apd.css:172` |
  | Secundario con borde y texto guinda («En el visor») | revisar, cotejo | `apd.css:186` |
  | Píldora de curso, normal y elegida | grupos | `apd.css:424-434` |
  | Opción «Asistió»/«Faltó» (borde `--gris-cl`, Roboto 14 px) y sus dos rellenos | asistencia | `apd.css:379-383` |
  | Día del calendario (4 aspectos) | programar | `apd.css:536-548` |
  | Número de pregunta (3 aspectos) | examen | `examen.css:35, 70-72` |
  | Tarjeta-enlace discontinua «Programar desde…» | grupos | `apd.css:493-498` |
  | Tarjeta del menú de inicio | index | `apd.css:16` |
  | Seis `summary` (C6-06) | varias | — |
  | Botón y enlaces en píldora del menú de pruebas (sólo versión de prueba) | todas | `apd.css:71, 91-92` |

  El secundario sale a 51 px y 16 px en unas pantallas y a 44 px y 13 px en otras para el mismo tipo de acción (p. ej.
  «Llenar con su CURP» frente a «Editar contacto»). La opción del estándar para Sí/No (`opciones-en-linea`,
  `opcion-corta`) no se usa en «Asistencia».
- **Consecuencia:** más formas que aprender; un cambio del estándar a los botones no llega a las formas propias.
- **Reproducido:** 2 de 2.
- **Corrección propuesta:** pedir al estándar el tamaño compacto para tablas del personal (o usar `btn-enlace` en las
  celdas) y declarar en el proyecto la lista cerrada de formas propias con su motivo; el resto, del estándar.
- **Listo cuando:** el inventario de `analizar.mjs` no muestra aspectos fuera de una lista declarada.
- **Estado:** Abierto.

### C6-08 · Cuatro avisos hechos a mano no llevan el ícono de su tono
- **Gravedad:** Baja · **Esfuerzo:** S
- **Dónde:** «Mis trámites»: «Datos para tu pago» (`tramites.js:94`), «Motivo del rechazo» y «Motivo de la cancelación»
  (`tramites.js:271`); «Revisar solicitud»: «No hace falta revisar los documentos…» (`revisar.html:125`). También el aviso
  de «Modo de prueba: las preguntas obligatorias están desactivadas» (`pruebas.js:70`, sólo versión de prueba).
- **Qué pasa:** el estándar: «Cada aviso lleva el icono de su tono» (`02-guia-de-estilo.md` §7); `FormKit.aviso` lo
  pone siempre (`formkit.core.js:126-131`). Estos se arman con `div.aviso` a mano y quedan sin ícono; otros avisos a
  mano (`tramites.js:178`, `solicitud.js:154`, `cotejo.html:51`) sí lo llevan. De 25 avisos distintos medidos, 4 no
  tienen ícono (`resumen.md`, «Avisos»).
- **Reproducido:** 2 de 2.
- **Corrección propuesta:** `FormKit.aviso(..., { tono: 'neutro', titulo, texto })` en los cuatro (acepta nodos desde la
  1.4.2, P131).
- **Listo cuando:** todo `.aviso` visible tiene un `svg use` (comprobación en `probar-sitio`).
- **Estado:** Abierto.

### C6-09 · En «Asistencia» el rojo dice tres cosas, y «Faltó» elegido se ve como el botón de peligro
- **Gravedad:** Baja · **Esfuerzo:** S
- **Qué pasa:** en la misma pantalla, rojo = «Faltó» elegido (relleno `--error`, texto blanco: el aspecto exacto de
  `.btn-peligro`, par C42, «el que hace el daño dentro de su confirmación»), = fila sin marcar al guardar
  (`.falta-marcar`, fondo y filete de error, `apd.css:311`) y = «Sin derecho a examen» (etiqueta «cerrado sin éxito»).
  El verde relleno de «Asistió» no existe como botón en el estándar. La decisión del 18/10 (DECISIONES:248) fija ✓
  verde y ✗ rojo **en la tira de días**, no el relleno de los botones.
- **Reproducido:** 2 de 2 (`capturas/asistencia-marcada-390.png`).
- **Corrección propuesta:** ver «Para decidir», punto 2.
- **Estado:** Decide el dueño.

### C6-10 · Letra fuera de la escala y pesos que la tipografía no trae
- **Gravedad:** Baja · **Esfuerzo:** S
- **Qué pasa (`letras-raras.txt`):**
  - «inicia» y «examen» en los días del calendario a **10.2 px** (`apd.css:543`, `calc(var(--t-xs) * .85)`), en
    teléfono; lo más chico del estándar es 12 px (`--t-xs`).
  - La etiqueta «Ya no puede faltar» a 12 px y sin partirse (`apd.css:376`, `.asis-riesgo .estado { white-space: nowrap;
    font-size: var(--t-xs) }`): las demás etiquetas miden 13 px y el estándar las parte desde la 1.4.2 (P126).
  - Pesos que no vienen en las fuentes (el estándar sólo trae Roboto 400/500/700 y Cabin 600/700, regla C12): Cabin 500
    (`.plegable-titulo`, `apd.css:175`), Cabin 400 (`.plan-destino-cupo`, `apd.css:471`, dentro de un botón), Roboto 600
    en piezas del proyecto (`.asis-opcion`, `.asis-nombre`, `summary` de «Qué estudiar», `.plan-barra-cuenta`) y Roboto
    900 (un `strong` dentro de una celda de 600 en «Material de estudio»). El navegador dibuja la fuente más cercana: la
    diferencia que se quiso no se ve.
- **Reproducido:** 2 de 2 (resultado determinista).
- **Corrección propuesta:** `.cal-nota` a `--t-xs` (o el texto bajo la celda); quitar la regla de `.asis-riesgo .estado`
  o registrarla como decisión; pesos sólo de los tokens que corresponden a la familia.
- **Estado:** Abierto.

---

## 3. Verificado sin hallazgos

**Tabla de pares medidos (resumen; la tabla completa, con elementos y pantallas, está en `resumen.md`).**

| Qué | Mediciones (por corrida) | Pares distintos | Cumple | Aceptado | Informativo | Pendiente de decisión |
|---|---|---|---|---|---|---|
| Texto (4.5:1; 3:1 grande) | 11,418 | 85 | 81 | 0 | 2 (opción «Dictaminador técnico» deshabilitada, 2.15 y 2.08:1: WCAG exceptúa lo inactivo) | 2 (marcador, A6-01) |
| Bordes, filetes, límites de controles (3:1) | 8,165 | 238 | 128 | 0 | 110 (separadores `--linea`, filetes dorados, enlaces y casillas nativas sin caja, barras con texto equivalente) | 0 |
| Íconos SVG (3:1) | 927 | 17 | 17 (mínimo 5.99:1) | 0 | 0 | 0 |
| Anillo de foco (3:1, 3 px) | 2,483 paradas | 9 fondos | 9 (`#1A73C7`, 4.36 a 4.86:1) | 0 | 0 | 0 |

Pares del proyecto y del estándar, por separado:

| Par | Pantalla | Texto o línea | Fondo compuesto | Razón | Mínimo | Resultado | Origen |
|---|---|---|---|---|---|---|---|
| Fecha de publicación en fila alterna (`.material-edicion-celda`) | material-personal | `#6B6E70` | `#F7F1F3` | 4.60 | 4.5 | Cumple (el más justo del proyecto) | proyecto |
| Nombre de la organización (`.plan-bloque-nombre`) | grupos, programar | `#8C6C3E` | `#FFFEF8` | 4.80 | 4.5 | Cumple | proyecto |
| Rótulos de datos (`.datos-etq`) sobre página, aviso, error, éxito | varias | `#6B6E70` | `#F4F5F6`…`#FDF3F2` | 4.70 a 5.14 | 4.5 | Cumple | proyecto/estándar |
| ✓ / ✗ / sin capturar de la tira (`.asis-marca`) | asistencia | `#1B6B43` / `#B3261E` / `#8A5200` | blanco o `#FDF3F2` | 5.97 a 6.54 | 4.5 | Cumple | proyecto |
| Persona elegida: organización y días | grupos | `#55585A` | `#F7F1F3` | 6.43 | 4.5 | Cumple | proyecto |
| Botón del menú de pruebas, franja y notas de prueba | todas | `#6B4A00` | `#FFF3CD` | 7.28 | 4.5 | Cumple | proyecto |
| Etiquetas de estado, cinco familias | varias | C45 a C49 | — | 6.41 a 13.01 | 4.5 | Cumple | estándar |
| Avisos de cada tono, resumen de errores | varias | — | — | 6.00 a 13.01 | 4.5 | Cumple | estándar |
| «Asistió»/«Faltó» elegidos | asistencia | `#FFFFFF` | `#1B6B43` / `#B3261E` | 6.50 / 6.54 | 4.5 | Cumple | proyecto |
| Curso y días elegidos | grupos, programar | `#FFFFFF` | `#9D2148` | 7.65 | 4.5 | Cumple | proyecto |
| Borde de opción de asistencia | asistencia | `#6B6E70` | `#FFFFFF` | 5.14 | 3 | Cumple | proyecto |
| Casilla de persona elegida (borde) | grupos | `#878B8E` | `#F7F1F3` | 3.08 | 3 | Cumple (justo) | estándar sobre fondo del proyecto |
| Marcador (placeholder) | cuenta | `#757575` | `#F9FAFB` / `#FDF3F2` | 4.41 / 4.23 | 4.5 | Pendiente (A6-01) | estándar (navegador) |
| Días disponibles del calendario (borde) | programar | `#DCDEE0` | `#FFFFFF` | 1.35 | 3 si delimita | Informativo (A6-02) | proyecto |
| Lugar libre / relleno de cupo | grupos, grupo | `#DCDEE0` / `#B28E5C` | blanco / `#DCDEE0` | 1.35 / 2.25 | — | Informativo (texto equivalente) | proyecto |
| Cursor encima (estático): «Programar desde…», calendario, tarjetas | grupos, programar, index | `#9D2148` | `#F7F1F3` | 6.86 | 4.5 | Cumple | proyecto |

También sin hallazgos:
- **Colores sólo con tokens**: ningún color literal en `apd.css`, `examen.css` ni en el JavaScript del proyecto; el único
  estilo que pone el JavaScript es el ancho de la barra de cupo (`grupo.js:74`). `tokens.css` igual al del estándar 1.5.1.
- **Clases sin uso**: 0 de 321 (las 19 que señaló la auditoría del 19/10, R4-07, ya no están).
- **Espacios**: todos en la escala; los valores fuera de ella son márgenes automáticos de centrado, el relleno de los
  campos del estándar (11 px) y el relleno de 6 px que pone el navegador al número de pregunta (`examen.css:35` no lo
  declara), sin efecto visible.
- **Anillo de foco**: las 2,483 paradas de tabulador tienen el anillo del estándar (3 px, `#1A73C7`), incluidas las
  piezas propias (`.asis-opcion`, `.plan-curso`, `.cal-dia`, `.examen-numero`, `.menu-opcion`, diálogo del menú de
  pruebas).
- **Dos corridas idénticas**: 21 mediciones bajo el mínimo en cada una; ninguna sólo en una (`resumen.md`, final).
  Ningún error de página en los 268 estados.

## 4. Fallas del componente compartido

| Clave | Qué pasa | Archivo:línea del estándar | Clave existente | Propuesta |
|---|---|---|---|---|
| FC-1 | No hay color para el marcador de posición (`::placeholder`): queda el del navegador (`#757575` en Chromium), 4.41:1 sobre `--solo-lectura-bg` y 4.23:1 sobre `--error-bg`. `pares-contraste.json` no tiene el par | `codigo/css/nucleo.css` (no declara `::placeholder`); `herramientas/pares-contraste.json` | Ninguna (nueva) | `.control::placeholder { color: var(--gris-cl); opacity: 1 }` (4.91:1 y 4.71:1) y los dos pares en la tabla |
| FC-2 | El estándar usa `--peso-semi` (600) con Roboto, peso que no trae (C12: Roboto 400/500/700): `.btn-enlace`, `.contrasena-ver`, `.estado`, `.tabla-valor` | `nucleo.css:204-216, 341`; `modulos/estado/estado.css:23`; `modulos/tabla/tabla.css:27` | Ninguna (nueva) | 500 o 700 en Roboto, o declarar Roboto 600 |
| FC-3 | `auditor-css.mjs` con rutas (la forma de auditar las hojas de un proyecto) se salta A09, A13, A15 y A16; en modo paquete, A15 da por hecho `codigo/css/tokens.css`. Un proyecto no puede pasar su CSS por las mismas reglas | `herramientas/auditor-css.mjs:351-356, 365-448, 398` | Ninguna (nueva) | Opción `--config <archivo>` para auditar las hojas de un proyecto con su `tokens.css` y sus archivos de uso |
| FC-4 (informativa) | Con movimiento reducido, `transition-duration: .01ms !important` en todo y `transition-property` por omisión `all`: cada cambio de estilo pasa por una transición. Invisible para la persona, pero una prueba que lee estilos justo después de un cambio ve valores intermedios (a mí me dio anillos de 0 px hasta esperar las animaciones). Además, el aviso «Cargando el documento…» del visor sale con tono de advertencia (visto en 1 de 2 corridas, por tiempo) | `nucleo.css:439-445`; `js/validaciones.config.js:694` | Ninguna | `transition-property: none` en la misma regla; el aviso de carga en tono neutro |

## 5. Para decidir

1. **Espera en la bandeja (C6-04).** (a) Mantener el rojo a los 10 días pero con la familia «te toca actuar» y un texto
   que lo diga («18 días · atrasada»): S, respeta el módulo; (b) mantenerlo como está y registrar la excepción en
   DECISIONES: 0 h; (c) pedir al estándar una sexta familia «urgente»: L y ajeno. **Recomiendo (a).**
2. **Botones de «Asistencia» (C6-09, C6-03).** (a) Usar la opción corta Sí/No del estándar (azul al elegir, palomita;
   el verde y el rojo quedan sólo en la tira, como dice la decisión del 18/10): S; (b) dejar verde y rojo, con ✓/✗
   dentro del botón y contorno en alto contraste: S. **Recomiendo (a)**: un rojo relleno junto a «Guardar» se lee como
   peligro.
3. **Jerarquía de «Grupos» (C6-02).** La propuesta de antes y después está en el hallazgo. Costo: M. **Recomiendo**
   decidirla junto con P164, porque es la misma regla.
4. **Opción deshabilitada con su motivo dentro (informativo).** «Dictaminador técnico» deshabilitado muestra su motivo
   («Necesitas tener vigente tu acreditación de poda…») a 2.08:1 porque toda la opción se atenúa al 45 %. WCAG lo
   permite; el estándar dice que «el hijo deshabilitado explica por qué». (a) Dejarlo; (b) poner el motivo como ayuda
   fuera de la opción, a contraste normal: S. **Recomiendo (b)**, porque es justo lo que la persona necesita leer.

## 6. No verificable desde aquí, hipótesis y no confirmado

- **No verificable:** Firefox y Safari (el marcador y los pesos sintéticos cambian entre navegadores; P35); alto
  contraste real de Windows (aquí, emulado); impresión de papeletas; lectores de pantalla.
- **Hipótesis:** en Firefox el marcador (con opacidad) quedaría aún más claro que en Chromium, por debajo de 4.23:1.
- **No confirmado:** ninguno; el aviso «Cargando el documento…» con tono de advertencia salió en 1 de 2 corridas por
  tiempo de carga (FC-4).

## 7. Pruebas que conviene dejar permanentes

1. `medir.mjs` + `analizar.mjs` como paso de `probar-sitio` (o una versión corta): falla si algún texto queda bajo su
   mínimo (salvo inactivos), si un control de captura tiene límite bajo 3:1 o si una parada de tabulador no tiene
   anillo de 3:1. Hoy `axe` no mide marcadores, `::before`, bordes ni foco.
2. `colores-forzados.mjs`: lo elegido y lo no elegido deben diferir con `forcedColors: 'active'` en cada pieza propia.
3. Como máximo un control con relleno guinda por estado (sin «Ir al contenido»).
4. Todo `.aviso` visible lleva ícono; ningún texto de etiqueta de estado aparece con dos familias.
5. El auditor de CSS en modo paquete sobre las hojas del proyecto (`auditor-paquete/`), hasta que el estándar dé la
   opción (FC-3).

## Archivos

Todo en `docs/auditoria-2026-10-20/ (r1) `: `medir.mjs`, `analizar.mjs`, `colores-forzados.mjs`,
`letras-raras.mjs`, `clases-sin-uso.mjs`, `auditor-paquete/` (configuración apuntada al sitio), `medicion-1.json`,
`medicion-2.json`, `resumen.md`, `corrida-1.log`, `corrida-2.log`, `colores-forzados-1.txt`, `colores-forzados-2.txt`,
`contraste-estandar.txt`, `auditor-css-proyecto.txt`, `auditor-css-paquete.txt`, `pares-proyecto-estaticos.txt`,
`letras-raras.txt`, `clases-sin-uso.txt`, `capturas/` (134 estados y 5 de colores forzados). Servidor en el puerto
8901 detenido. Para repetir: `python3 -m http.server 8901 --directory sitio` desde la copia y
`node medir.mjs http://localhost:8901/ medicion-1.json`.
