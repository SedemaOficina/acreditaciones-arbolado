# Auditoría de seguimiento del 20/10/2026 · Revisor independiente (ri)

**Frente:** accesibilidad del foco y de los elementos fijos o pegajosos en las pantallas de la persona solicitante y del
personal, contra WCAG 2.2 AA: 2.4.11 Foco no oculto (mínimo), 2.4.7 Foco visible, 2.4.3 Orden del foco (y gestión del
foco) y 4.1.3 Mensajes de estado.

**Versión revisada:** 0.61 + PR #5, commit `d58c611`, en mi copia `<copia del revisor ri>` (solo lectura; no se
editó nada del proyecto). Estándar de formularios 1.5.1 en `sitio/formkit/`.

**Resumen en una línea:** el foco nunca pierde su indicador (0 de 12 020 paradas), pero en «Grupos» la barra pegajosa de
elegidas **tapa por completo** la casilla enfocada en 52 a 73 de las 75 casillas con el escenario de volumen en computadora
(falla 2.4.11 AA); además, tres botones de navegación y la franja del borrador pierden el foco al deshabilitarse u
ocultarse, y hay mensajes que se anuncian dos veces.

---

## 1. Qué hice

**Método.** Tres guiones de Playwright con Chromium 1194 (`/opt/pw-browsers/chromium-1194`), zona horaria
`America/Mexico_City`, sitio servido en mi puerto 8906, cada prueba en un contexto nuevo del navegador:

1. **Recorrido con Tab (2.4.11 y 2.4.7)** — `foco-recorrido.mjs`. En cada pantalla se pulsa Tab desde el principio hasta
   volver al primer elemento (vuelta completa). En cada parada se mide:
   - si el elemento enfocado queda tapado por algo con `position: fixed` o `sticky`: 35 puntos (rejilla de 7 × 5, que
     incluye el centro y las cuatro esquinas) con `document.elementFromPoint`; a los elementos fijos se les fuerza
     `pointer-events: auto` sólo durante la medición, para que cuenten también los que lo tienen en `none`. «Oculta total»
     = los 35 puntos caen en un elemento fijo; «parcial» = al menos uno. También se guarda la intersección geométrica
     (área y fracción) con cada elemento fijo y qué hay encima en el centro y en cada esquina;
   - si hay indicador de foco (contorno o sombra en el elemento o, para las entradas invisibles que cubren una tarjeta,
     en su envoltura con `:has(:focus-visible)`), si el elemento es invisible y si un ancestro con `overflow` recorta el
     indicador;
   - la parte del elemento que queda fuera de la ventana.
   Con `TECLA=Shift+Tab` recorre hacia atrás (para las barras pegajosas de arriba).
2. **Gestión del foco y mensajes (2.4.3 y 4.1.3)** — `gestion-foco.mjs`. 21 escenarios sólo con teclado (Tab, Enter,
   Espacio, Escape, flechas): abrir y cerrar diálogos, recuperar y descartar el borrador, enviar con errores, recibir un
   resultado, agregar y quitar personas, cambiar de día y de mes, ver un documento. Después de cada paso registra a dónde
   fue el foco (y si quedó en `<body>` o fuera de la ventana) y cada cambio de texto en las regiones vivas (`aria-live`,
   `role` status/alert/log, `<output>`), con el texto propio de cada región, sin el de las regiones anidadas.
   `compara-rondas.mjs` compara las dos rondas.
3. **Inventario de regiones vivas** — `inventario-vivas.mjs`: las regiones de las 21 pantallas después de cargar y de
   dónde vienen (HTML de la página, `app/` o `formkit/`).

Guiones de apoyo: `resumen-recorrido.mjs`, `compara-recorridos.mjs`, `plan-barra.mjs` (alto de la barra de «Grupos»),
`programar-resumen.mjs` (resumen pegajoso de «Programar»), `barra-pasos.mjs` (barra de pasos del estándar),
`recorte-tabla.mjs` (contorno recortado en la tabla), `foco-examen.mjs` (pantalla de la pregunta del examen).

**Pantallas y estados (28):** persona — inicio, crear cuenta, entrar, verificar, material, «Mis trámites» en cuatro
situaciones, solicitud nueva, borrador y corrección con observaciones, «Mi perfil», corregir, examen (entrada y
pregunta); personal — bandeja de revisión, revisar (poda y dictaminador), citas, cotejo, «Grupos», «Programar», ficha de
grupo (en integración, en curso y el de 25 personas), asistencia (grupo de 8 y de 25), aplicar (sin folio y con el grupo
de 25), material del personal. `espera.html` sólo redirige a «Grupos».

**Tamaños:** 1440×900, 1280×720, 1024×768 y 390×844 (este último con `isMobile` y `hasTouch`).

**Datos:** `datos/ficticios.json` y el escenario de volumen (`herramientas/escenario-volumen.mjs`, servido con
`context.route` como en `probar-volumen.mjs`: 65 por revisar, citas del día con 54 paradas de teclado, 66 en espera de
poda nueva en «Grupos», grupos de 25). Con volumen recorrí las pantallas del personal (las de la persona no cambian con
el volumen).

**Número de pruebas:**

| Prueba | Cantidad |
|---|---|
| Recorridos con Tab o Shift+Tab (pantalla × tamaño × datos × pasada) | 408 recorridos, 12 020 paradas medidas |
| Recorridos de la pregunta del examen (adelante y atrás) | 8 recorridos, 584 paradas |
| Escenarios de gestión del foco (dos rondas cada uno) | 62 ejecuciones, 248 pasos |
| Inventario de regiones vivas | 21 pantallas |

**Reproducción.** Cada recorrido corrió en **dos pasadas independientes** (contextos nuevos): las 128 combinaciones
comparables dieron las mismas cifras de paradas, de ocultas total y de ocultas parcialmente (`compara-recorridos.mjs`:
«iguales 128 · distintas 0»). Cada escenario de gestión del foco corrió en dos rondas, con el mismo destino del foco y
el mismo número de anuncios en todos los pasos (`compara-rondas.mjs`, ninguna línea «DIFIERE»).

**Herramientas que no hubo:** Firefox y WebKit (la red bloqueó su descarga) y un lector de pantalla real. Lo que depende
de cómo lee un lector de pantalla va en la sección 6.

**Evidencia** (todo en `docs/auditoria-2026-10-20/ (ri) `): `salidas/*.json` (cada parada y cada paso),
`salidas/*.log`, `salidas/tabla-recorrido.md` (tabla completa por pantalla, tamaño y datos) y `capturas/`.
`node_modules` es un enlace a `../../aud20-ri/node_modules` para poder correr los guiones desde aquí.

---

## 2. Hallazgos del proyecto (sitio/app y páginas), de más a menos graves

**Totales:** Alta 1 · Media 1 · Baja 8 · Informativa 2 (12). Fallas del estándar, aparte, en la sección 4 (3).

### RI-01 · «Grupos»: la barra de elegidas tapa por completo la casilla enfocada
- **Gravedad:** Alta · **Esfuerzo:** S a M
- **Dónde:** `grupos.html` (planeador), personal, en 1024, 1280 y 1440 px. La barra es `.plan-barra` con
  `position: sticky; bottom: 0` a partir de 760 px (`sitio/app/apd.css:579`; marcado en `sitio/grupos.html:58-62`).
  No hay `scroll-padding-bottom` que la compense.
- **Qué pasa.** Lo esperado (2.4.11 AA): el elemento enfocado no queda completamente oculto por contenido de la página.
  Lo observado: al recorrer con Tab la lista de personas en espera, la barra (cuenta de elegidas y un botón por cada grupo
  que recibe) mide 312 a 364 px, entre el 35 % y el 47 % de la ventana. El navegador no desplaza la página porque la
  casilla está «dentro» de la ventana, aunque esté debajo de la barra.

  | Datos | Tamaño | Alto de la barra | Casillas enfocadas | Completamente debajo de la barra |
  |---|---|---|---|---|
  | volumen | 1440×900 | 312 px (35 %) | 75 | 52 |
  | volumen | 1280×720 | 312 px (43 %) | 75 | 73 |
  | volumen | 1024×768 | 364 px (47 %) | 75 | 72 |
  | ficticios | 1440×900 | 150 px (17 %) | 7 | 2 |
  | ficticios | 1280×720 | 150 px (21 %) | 7 | 3 |
  | ficticios | 1024×768 | 202 px (26 %) | 7 | 5 |
  | ambos | 390×844 | barra no pegajosa | — | 0 |

  En el recorrido completo de la pantalla (119 paradas con volumen) quedan ocultas por completo 56 (1440), 75 (1280) y
  75 (1024) paradas; hacia atrás (Shift+Tab), 17 (1280) y 20 (1024).
- **Consecuencia:** quien usa teclado no ve qué persona marca ni si la marcó. Con 66 personas en espera de un curso,
  elegir a quiénes se agregan a un grupo (flujo principal del personal) se hace a ciegas en las tres computadoras.
- **Cómo se reproduce:** entrar a `grupos.html?curso=poda-nueva` con el escenario de volumen en 1280×720; pulsar Tab
  hasta las casillas de «En espera»; la casilla enfocada y su contorno no se ven, la barra ocupa la parte de abajo.
- **Evidencia:** `node plan-barra.mjs http://localhost:8906/ volumen` (tabla de arriba, dos rondas iguales);
  `salidas/recorrido-volumen-1.json` y `-2.json` (estado «S grupos»: los 35 puntos de cada parada caen en
  `div.plan-barra`, intersección 100 %); capturas `capturas/volumen-S_grupos-1280x720-parada16.png` y
  `capturas/volumen-S_grupos-1440x900-parada17.png` (la casilla enfocada está debajo de la barra; sobre la barra sólo se
  ve una fila de la lista).
- **Reproducido:** 2 de 2 (dos pasadas del recorrido y dos rondas de `plan-barra.mjs`, cifras idénticas).
- **Causa probable:** barra pegajosa alta sin reserva de espacio para el desplazamiento por foco.
- **Corrección propuesta** (ver «Para decidir», D1): reservar el alto real de la barra con `scroll-padding-bottom`
  (una variable que `grupos.js` actualiza con un `ResizeObserver` sobre la barra) y, cuando la barra ocupe más de un
  cuarto de la ventana, que deje de ser pegajosa o que muestre los destinos en una sola fila compacta.
  Antes: casilla enfocada debajo de la barra. Después: al enfocar una casilla, la página se desplaza y la casilla queda
  justo encima de la barra.
- **Listo cuando:** `foco-recorrido.mjs` con volumen en 1024×768, 1280×720 y 1440×900 da 0 paradas ocultas por
  completo en «S grupos», también con `TECLA=Shift+Tab`; y `plan-barra.mjs` da 0 casillas debajo de la barra.
- **Estado:** Abierto (nuevo: no aparece en PENDIENTES ni en las auditorías; la auditoría de tareas M4 del 17/10 creó la
  barra fija).

### RI-02 · Tres botones de navegación pierden el foco al deshabilitarse
- **Gravedad:** Media · **Esfuerzo:** S
- **Dónde:** «Citas de cotejo», «Día anterior» y «Día siguiente» (`sitio/app/citas.js:131-132`); «Programar un curso»,
  «Mes anterior» y «Mes siguiente» (`sitio/app/programar.js:158-159`). Personal, 1280×720 (el código no depende del
  ancho).
- **Qué pasa.** Lo esperado (2.4.3): el foco sigue en un lugar con sentido después de usar el botón. Lo observado: al
  llegar al último día con citas (o al mes actual o al último mes permitido) la página pone `disabled` al botón que
  tiene el foco, y el foco cae a `<body>`. El siguiente Tab sigue desde ahí, pero un lector de pantalla pierde el lugar
  y no dice nada del botón.
  - Citas, ficticios: 3.ª pulsación de «Día siguiente» → foco en `<body>`. Volumen: 8.ª pulsación → `<body>`.
  - Programar: «Mes anterior» desde noviembre → octubre (mes actual) → `<body>`; «Mes siguiente» 12 veces → `<body>`.
- **Consecuencia:** quien usa teclado o lector de pantalla queda «en ningún lado» al final de la agenda o del calendario.
- **Cómo se reproduce:** `citas.html`, Tab hasta «Día siguiente», Enter hasta que ya no haya más días;
  `document.activeElement` es `<body>`.
- **Evidencia:** `node gestion-foco.mjs http://localhost:8906/ salidas/gestion-1.json "citas-dias"` (pasos 3 y 8:
  «foco → BODY») y `salidas/gestion-2.json`, escenario `programar-limites` (pasos 1 y 14: «BODY»).
- **Reproducido:** 2 de 2 en cada caso (ficticios y volumen).
- **Causa probable:** `boton.disabled = …` sobre el botón enfocado.
- **Corrección propuesta:** usar `aria-disabled="true"` (el botón conserva el foco, se ve inactivo y el clic no hace
  nada, como ya hace `programar.js:421` con los botones de envío), o mover el foco al otro botón o al título del día.
- **Listo cuando:** en los escenarios `citas-dias`, `citas-dias-volumen` y `programar-limites`, ningún paso deja el foco
  en `<body>`.
- **Estado:** Abierto (nuevo).

### RI-03 · El mismo mensaje se anuncia dos veces, desde dos regiones vivas
- **Gravedad:** Baja · **Esfuerzo:** S
- **Dónde:**
  - Solicitud de la persona, al recuperar o descartar el borrador: `p[data-borrador-recuperado]` tiene `role="status"`
    (`sitio/solicitud.html:63`) y la página lo usa como `visible` de `FormKit.anuncia`
    (`sitio/app/solicitud.js:382` y `:389`), que además escribe en la región de anuncios del estándar. Teléfono y
    escritorio.
  - Revisión documental, al decidir el último documento: `p[data-resumen]` tiene `role="status"`
    (`sitio/revisar.html:349`) y `sitio/app/revisar.js:458` anuncia ese mismo texto con `FormKit.anuncia`.
- **Qué pasa.** Lo esperado (4.1.3, y la decisión del 17/10 «anuncio para lector de pantalla, que también se ve»): un
  mensaje, un anuncio. Lo observado, en el mismo instante:
  - «Borrador recuperado en este dispositivo.» en `p[data-borrador-recuperado][role=status]` y en
    `div[data-anuncios][aria-live=polite]`; igual con «Se descartó el borrador.».
  - «Los 4 documentos están revisados. Elija abajo cómo termina la revisión.» en `p[data-resumen][role=status]` y en
    `div[data-anuncios]`.
- **Consecuencia:** quien usa lector de pantalla oye la misma frase dos veces seguidas.
- **Evidencia:** `salidas/gestion-1.log` (escenarios `borrador-recuperar` y `borrador-descartar`, paso 3 o 4: dos
  anuncios con el mismo texto) y `salidas/gestion-2.log` (`revisar-completo`, paso 4, en 1280, 1440 y 390).
- **Reproducido:** 2 de 2 en cada caso.
- **Causa probable:** un elemento que ya es región viva se pasa como `visible` a `FormKit.anuncia`, o se anuncia el
  texto de una región viva.
- **Corrección propuesta:** quitar `role="status"` de `data-borrador-recuperado` (lo anuncia `FormKit.anuncia`) y quitar
  la llamada de `revisar.js:458` (ya lo anuncia `data-resumen`), o al revés, una sola vía por mensaje.
- **Listo cuando:** el observador de `gestion-foco.mjs` no registra el mismo texto en dos regiones dentro de un mismo
  paso, en ninguno de los escenarios.
- **Estado:** Abierto (nuevo).

### RI-04 · Varias regiones vivas hablan a la vez por una sola acción
- **Gravedad:** Baja · **Esfuerzo:** S a M
- **Dónde y cuántos anuncios por acción** (contados por el observador, dos rondas iguales):

  | Acción | Anuncios | Regiones |
  |---|---|---|
  | Revisar: decidir «aceptado» en un documento | 3 (4 en el primero) | `data-resumen` (status), anuncios «Siguiente documento: …», «Hoja 1 de N» del visor (y el «Hoja 1 de N» del documento anterior) |
  | Citas: «Día siguiente» o «Día anterior» | 2 | `h3[data-dia][aria-live]` y `p[data-cuenta][role=status]` (`sitio/citas.html:49` y `:55`) |
  | Citas: escribir «ana» en «Buscar una cita» (3 teclas) | 4 | `data-dia` + un anuncio de la cuenta por cada tecla (`sitio/app/citas.js:149`, sin espera); en la bandeja, 7 teclas dan 1 anuncio |
  | Grupos: volver después de agregar personas | 3 | aviso del desenlace (status, con foco), `data-cuenta` y `data-elegidas` («Ninguna elegida») |
  | Asistencia: volver después de guardar | 3 | aviso «Asistencia … guardada» (status, con foco), aviso «Falta capturar el día 2» (`role=alert`, ver RI-09) y `data-totales` |

- **Consecuencia:** con lector de pantalla, los mensajes se encolan o se interrumpen; en la búsqueda de citas se oye una
  cifra distinta por cada letra.
- **Evidencia:** `salidas/gestion-1.log` y `salidas/gestion-2.log` (escenarios `revisar-avance`, `revisar-completo`,
  `citas-dias`, `citas-dias-volumen`, `revision-buscar-volumen`, `grupos-agregar`, `asistencia-volumen`).
- **Reproducido:** 2 de 2.
- **Causa probable:** cada parte que cambia tiene su propia región viva; la búsqueda de citas repinta en cada tecla.
- **Corrección propuesta:** en Citas, que el título del día deje de ser región viva y la cuenta diga también el día
  («Martes 20 de octubre: 2 citas…»), y que la búsqueda anuncie después de una pausa, como la bandeja; en Grupos, no
  repintar `data-elegidas` al cargar; en Revisar, ver RS-03.
- **Listo cuando:** cada uno de esos pasos registra un anuncio, y escribir 3 letras en la búsqueda de citas registra uno.
- **Estado:** Abierto (nuevo). La parte del visor es del estándar (RS-03).

### RI-05 · El botón «Menú de pruebas» tapa en parte el elemento enfocado al pie de la ventana
- **Gravedad:** Baja · **Esfuerzo:** S
- **Dónde:** botón fijo `.menu-pruebas-boton` (`sitio/app/apd.css:71`, sólo en la versión de prueba), en todas las
  pantallas y tamaños; no hay `scroll-padding-bottom` que lo compense.
- **Qué pasa.** Al avanzar con Tab, el navegador deja cada elemento nuevo justo en el borde de abajo, donde está el
  botón. Ninguna parada queda oculta por completo (2.4.11 AA se cumple), pero quedan tapadas en parte (2.4.12, AAA):
  225 paradas en la primera pasada de los 172 recorridos hacia adelante (`salidas/tabla-recorrido.md`); con volumen, en la bandeja 17 a 24 de 78 por
  tamaño, en citas 9 a 14 de 54. Los casos más tapados: en `aplicar.html?folio=APD-G-2026-020` a 390 px, los botones
  «no llegó» de tres personas, 40 % (14 de 35 puntos); en «Crea tu cuenta» a 390 px, el campo «Confirma tu contraseña».
- **Consecuencia:** el botón o el campo enfocado se ve a medias; en la versión de producción el botón no existe.
- **Evidencia:** `capturas/ficticios-S_revision-1280x720-parada13.png`, `capturas/ficticios-P_cuenta-390x844-parada20.png`,
  `capturas/volumen-S_aplicar_020-390x844-parada31.png`; `node resumen-recorrido.mjs salidas/recorrido-*-1.json`.
- **Reproducido:** 2 de 2 (pasadas idénticas).
- **Relación con lo registrado:** la auditoría del 18/10 aceptó que el botón «puede quedar sobre el pie del visor al
  desplazarse», y `auditar-sitio.mjs` tiene el aviso conocido del enlace del visor en `revisar-dictaminador`. Esto es más
  amplio (todas las pantallas, con el teclado), por eso va aparte y en «Para decidir» (D2).
- **Corrección propuesta:** `html:has(.menu-pruebas-boton) { scroll-padding-bottom: calc(var(--objetivo-min) + 2 * var(--e-3)); }`
  en `app/apd.css` (como ya se hizo en «Asistencia» al mover el botón a la izquierda).
- **Listo cuando:** `foco-recorrido.mjs` da 0 paradas tapadas en parte por `.menu-pruebas-boton`.
- **Estado:** Decide el dueño (D2).

### RI-06 · Revisar: la página se desplaza al siguiente documento y deja el foco atrás, fuera de la ventana
- **Gravedad:** Baja · **Esfuerzo:** S
- **Dónde:** `sitio/app/revisar.js:449-465` (`avanza`: `scrollIntoView` sin mover el foco), personal.
- **Qué pasa.** Al marcar «aceptado» con Espacio, la página muestra el siguiente documento (o el resultado), pero el
  foco sigue en la opción ya contestada. En 390×844 la opción queda fuera de la ventana en las 4 decisiones (hasta
  93 px por arriba); en 1280×720 y 1440×900, en la última (48 y 29 px por arriba). El siguiente Tab sí va al campo
  correcto («Fecha de la cita»).
- **Consecuencia:** por un momento no se ve dónde está el foco; el lector de pantalla se queda en el documento anterior
  mientras la vista muestra otro.
- **Evidencia:** `salidas/gestion-2.json` y `salidas/gestion-4.json`, escenario `revisar-completo` («[fuera de la
  ventana]», `top` negativo; después «Tab → input#cita_fecha»).
- **Reproducido:** 2 de 2 en los tres tamaños.
- **Corrección propuesta:** llevar el foco al título del documento que se muestra (o al de «Cómo termina la revisión»)
  con `tabindex="-1"` y `preventScroll`, o no desplazar cuando la decisión se tomó con teclado.
- **Listo cuando:** en `revisar-completo`, ningún paso deja el foco fuera de la ventana.
- **Estado:** Abierto (nuevo).

### RI-07 · Programar: «Así quedaría» es más alto que la ventana y su botón principal no se ve completo
- **Gravedad:** Baja · **Esfuerzo:** S
- **Dónde:** `.prog-resumen { position: sticky }` en ≥1024 px (`sitio/app/apd.css:587`), personal.
- **Qué pasa.** Con volumen en 1280×720 el resumen mide 856 px para una ventana de 720: al enfocar «Crear y confirmar el
  grupo», 12 px del botón (23 %) quedan debajo del borde y no se pueden mostrar mientras el resumen está pegado (con
  ficticios, 8 %). En 1440×900 (750 px) y 1024×768 se ve completo.
- **Evidencia:** `node programar-resumen.mjs http://localhost:8906/ volumen` («dentro: false», `bottom 732` con
  `alto 720`), captura `capturas/programar-resumen-volumen-1280x720.png`.
- **Reproducido:** 2 de 2.
- **Corrección propuesta:** que el resumen sea pegajoso sólo si cabe (`@media (min-height: …)` o `max-height:
  calc(100dvh - …)` con desplazamiento propio).
- **Listo cuando:** en 1280×720 con volumen, «Crear y confirmar el grupo» enfocado queda dentro de la ventana.
- **Estado:** Abierto (nuevo).

### RI-08 · Visor en teléfono: al cerrarlo, el foco vuelve a un botón que dice «En el visor»
- **Gravedad:** Baja · **Esfuerzo:** S
- **Dónde:** `sitio/app/revisar.js:280` y `sitio/app/cotejo.js:299`, a 390 px.
- **Qué pasa.** Abrir «Ver documento» lleva el foco a «Cerrar» del visor; Escape lo devuelve al botón de origen (bien),
  pero el botón sigue diciendo «En el visor: Identificación oficial» aunque el visor ya se cerró.
- **Evidencia:** `salidas/gestion-3.log` (escenario `visor-telefono`, paso 2), dos rondas.
- **Reproducido:** 2 de 2.
- **Corrección propuesta:** en teléfono, al cerrar el visor, devolver el texto a «Ver documento» y quitar
  `aria-current`.
- **Listo cuando:** después de Escape, el botón enfocado dice «Ver documento».
- **Estado:** Abierto (nuevo).

### RI-09 · Asistencia: el aviso «Falta capturar el día N» es una alerta que suena en cada carga
- **Gravedad:** Baja · **Esfuerzo:** S
- **Dónde:** `sitio/app/asistencia.js:103` (`FormKit.aviso` con tono «bloqueo», que el estándar pinta con
  `role="alert"`).
- **Qué pasa.** El aviso es permanente mientras falte el día, pero se crea como alerta en cada carga de la página. Al
  volver de «Guardar la asistencia», la alerta (asertiva) aparece al mismo tiempo que la confirmación enfocada «Asistencia
  del día 3 guardada» y puede cortarla.
- **Evidencia:** `salidas/gestion-1.log`, escenario `asistencia-volumen`, pasos 3 y 4 («nueva div[role=alert]» al
  cargar).
- **Reproducido:** 2 de 2.
- **Corrección propuesta:** tono «advertencia» (sin rol) para el aviso que ya estaba; alerta sólo cuando aparece por una
  acción.
- **Listo cuando:** al cargar `asistencia.html` no se registra ninguna región `role=alert` nueva.
- **Estado:** Abierto (nuevo). Ver también la nota del estándar en RS-03.

### RI-11 · Los diálogos de «Dar de baja» y «Cancelar el grupo» abren con el foco en el motivo, no en «Volver sin cambios»
- **Gravedad:** Baja · **Esfuerzo:** S
- **Dónde:** `sitio/grupo.html:130-165` (diálogos nativos; el navegador enfoca el primer control, el `textarea` del
  motivo); en `sitio/app/aplicar.js:261` «Suspender» lo hace a propósito.
- **Qué pasa.** La decisión del 17/10 (`docs/DECISIONES.md:215`) dice que la confirmación abre con «Volver sin cambios»
  con el foco y cita estos dos botones. Lo observado: foco en `textarea#motivo-baja` y `textarea#motivo-cancelar`.
  Escape devuelve el foco al botón que abrió el diálogo y enviar sin motivo lleva el foco al resumen de errores (bien).
- **Evidencia:** `salidas/gestion-1.log`, `grupo-baja` y `grupo-cancelar`, paso 1, dos rondas.
- **Reproducido:** 2 de 2.
- **Estado:** Decide el dueño (D3).

### RI-10 · Los valores internos del menú de pruebas son regiones vivas
- **Gravedad:** Informativa · **Esfuerzo:** S
- **Dónde:** `sitio/app/pruebas.js:44` agrega `<output class="interno-valor">`; `<output>` tiene rol `status` implícito.
- **Qué pasa.** Al cargar la solicitud se anuncian «(vacío)» y «poda_renovacion»; cambian cada vez que la persona
  responde. Sólo en la versión de prueba.
- **Evidencia:** `salidas/gestion-1.log`, `borrador-recuperar`, paso 2.
- **Corrección propuesta:** `aria-live="off"` en esos `output`, o un `<span>`.
- **Estado:** Abierto (nuevo, sólo prueba).

### RI-12 · Tabla de la bandeja a 1024 px: el botón «Revisar» y su contorno quedan recortados por el marco de la tabla
- **Gravedad:** Informativa · **Esfuerzo:** S
- **Dónde:** `revision.html`, 1024×768; `div.tabla-marco` con `overflow: auto` y la tabla más ancha que el marco.
- **Qué pasa.** El botón enfocado sale 6 px del marco y su contorno 11 px por la derecha (los otros tres lados se ven):
  65 de 78 paradas con volumen y 5 de 18 con ficticios. 2.4.7 se cumple (el indicador se ve).
- **Evidencia:** `node recorte-tabla.mjs` («der: 10.9», «desborda: true» en 1024; 0 en 1280 y 1440), dos rondas.
- **Estado:** Abierto (nuevo); puede ir con el ajuste de anchos de las tablas.

---

## 3. Verificado sin hallazgos

- **2.4.7 Foco visible:** en las 12 020 paradas de los 408 recorridos y en las 584 del examen, todas tuvieron indicador
  (contorno de 3 px `#1A73C7` separado 2 px, o en la envoltura con `:has(:focus-visible)` para las opciones y la
  asistencia); 0 paradas en elementos invisibles (sin tamaño, con `visibility: hidden` o transparentes sin envoltura
  que pinte el indicador).
- **2.4.11 sin ocultas por completo** en todas las pantallas fuera de «Grupos»: bandeja (78 paradas con volumen), citas
  (54), programar (94), asistencia del grupo de 25 (39), aplicar con 25 (54), revisar, cotejo, ficha del grupo, material,
  y todas las de la persona en los cuatro tamaños.
- **Examen:** la barra pegajosa de arriba (`.examen-barra`) no tapa el foco en ninguna de las 584 paradas, hacia
  adelante ni hacia atrás, en los cuatro tamaños (sólo el botón de pruebas tapa en parte «Siguiente» a 1024 y 390 px,
  RI-05).
- **Barras pegajosas de arriba hacia atrás (Shift+Tab):** ninguna parada oculta por completo en solicitud, revisar,
  cotejo, programar, bandeja y citas.
- **Menú de pruebas:** al abrirlo con Enter el foco entra al diálogo («Cerrar»); con Escape o con «Cerrar» vuelve al
  botón (1280 y 390, 2 de 2).
- **Diálogos de baja y de cancelación:** Escape devuelve el foco al botón que los abrió; enviar sin motivo lleva el foco
  al resumen de errores dentro del diálogo (un anuncio); al terminar, la ficha recargada enfoca el aviso del desenlace.
- **Enviar con errores:** «Entrar», paso 1 de la solicitud, revisión documental y diálogos: el foco va al resumen de
  errores (`role=alert`), con un solo anuncio del resumen.
- **Recibir un resultado:** «Verificar una acreditación» (la sección del resultado recibe el foco y se anuncia una vez,
  también con un número inexistente), revisión documental (título del resultado), «Mi perfil» (título de la sección y
  «Se guardó tu contacto»), «Grupos» al agregar y «Asistencia» al guardar (aviso del desenlace enfocado).
- **Agregar personas sin elegir a nadie:** el foco va al aviso de error, un anuncio. Elegir una persona anuncia «1
  elegida» una vez.
- **Programar:** cambiar de mes anuncia el mes una vez y el foco se queda en el botón (salvo en los límites, RI-02);
  elegir un día con Enter deja el foco en el día y anuncia la semana elegida una vez.
- **Bandeja:** la búsqueda anuncia una vez después de escribir (7 teclas, 1 anuncio).
- **Inventario de regiones vivas** (`salidas/inventario-vivas.log`): las regiones de estado de las 21 pantallas están
  en el HTML desde la carga (los avisos y el resumen de errores del estándar se crean con su rol). En los 21 escenarios,
  cada desenlace que apareció después de una acción llegó a una región viva o recibió el foco.

---

## 4. Fallas del componente compartido (estándar 1.5.1, `sitio/formkit/`)

**Totales:** Media 1 · Baja 2.

### RS-01 · Recuperar o descartar el borrador deja el foco en `<body>`
- **Gravedad:** Media · **Esfuerzo:** S
- **Dónde:** `sitio/formkit/js/formkit.core.js:754` («recuperar»: `franja.hidden = true`) y `:756` («descartar-si»: igual),
  con el botón enfocado dentro de la franja. Persona, solicitud, 390×844 y 1280×720.
- **Qué pasa.** Lo esperado (2.4.3): después de recuperar, el foco va al formulario (o al aviso «Borrador recuperado»);
  después de descartar, al principio del formulario. Lo observado: `document.activeElement` es `<body>` en los dos
  casos; el siguiente Tab va a «Paso 1 de 3». («Empezar de nuevo» sí lleva el foco a «Conservar», `:755`.)
- **Consecuencia:** la persona, casi siempre en teléfono, pierde su lugar justo al retomar su solicitud.
- **Evidencia:** `salidas/gestion-1.log`, `borrador-recuperar` (paso 3) y `borrador-descartar` (paso 4), en los dos
  tamaños.
- **Reproducido:** 2 de 2.
- **Propuesta para el estándar:** antes de ocultar la franja, mover el foco al primer campo del paso actual o al aviso
  de borrador recuperado (`tabindex="-1"`).
- **Listo cuando:** en esos escenarios el foco no queda en `<body>`.
- **Estado:** Falla del componente compartido, sin clave (no está entre P152–P158, P166, P171; P148 trata de lo que
  guarda el borrador, no del foco).

### RS-02 · La barra de pasos pegajosa mide más de lo que reserva `scroll-padding-top` en teléfono
- **Gravedad:** Baja · **Esfuerzo:** S
- **Dónde:** `.barra-fija` (`sitio/formkit/modulos/pasos/pasos.css:19`) contra `--alto-barra-fija-movil: 112px`
  (`sitio/formkit/css/tokens.css:144`, aplicado en `sitio/formkit/css/base.css:18`).
- **Qué pasa.** En la corrección de una solicitud a 390 px la barra mide 141 px (los nombres de los pasos ocupan más
  renglones), 29 px más que la reserva. Al recorrer hacia atrás, «Cambiar este archivo» queda tapado en 60 % (21 de 35
  puntos) y la zona de carga en 20 %. No hay ocultas por completo (AA se cumple). En computadora la barra mide 133 px y
  la reserva es de 150 px.
- **Evidencia:** `node barra-pasos.mjs` (dos rondas iguales); `salidas/atras-ficticios-1.json` y `-2.json`,
  «P solicitud-observaciones» 390×844.
- **Propuesta para el estándar:** que el módulo pasos mida su barra y fije `scroll-padding-top` con ese alto, en lugar
  de un valor fijo.
- **Estado:** Falla del componente compartido, sin clave.

### RS-03 · El visor anuncia su zoom y su número de hojas cada vez que carga un documento
- **Gravedad:** Baja · **Esfuerzo:** S
- **Dónde:** `sitio/formkit/modulos/visor/visor.js:29` (`output.visor-zoom` con `aria-live`) y `:35`
  (`p.visor-pagina` con `aria-live`).
- **Qué pasa.** En teléfono, al abrir un documento se anuncian a la vez «100 %», «Cargando el documento…» y «Hoja 1 de
  2»; en computadora, cada decisión de la revisión suma «Hoja 1 de N» a los anuncios de la página (RI-04).
- **Evidencia:** `salidas/gestion-3.log` (`visor-telefono`), `salidas/gestion-2.log` (`revisar-completo`).
- **Propuesta para el estándar:** anunciar el zoom sólo cuando la persona lo cambia y el número de hojas dentro de un
  solo anuncio al terminar de cargar («Identificación oficial, 2 hojas»).
- **Estado:** Falla del componente compartido, sin clave.

**Nota sobre el estándar (no es un hallazgo aparte):** `FormKit.aviso` da el rol según el tono (`bloqueo` → `alert`,
`ok` → `status`; `formkit.core.js:128-133`) y no permite pintar un aviso de bloqueo que ya estaba sin volver a
anunciarlo. Por eso el proyecto no puede evitar RI-09 sin cambiar el tono.

---

## 5. Para decidir

**D1 · Cómo quitar el tapado de la barra de «Grupos» (RI-01).**
- (a) Reservar el alto real de la barra con `scroll-padding-bottom`, actualizado con un `ResizeObserver` (S). La barra
  se queda igual; el teclado deja la casilla encima de la barra. Con 1280×720 el área visible de la lista sigue siendo
  de unos 400 px.
- (b) Barra compacta: la cuenta de elegidas y un solo «Agregar a…» que abre la lista de grupos (M). Cambia la pantalla.
  Antes: hasta 6 botones apilados (312–364 px). Después: una franja de unos 70 px.
- (c) Que la barra deje de ser pegajosa cuando mida más de un cuarto de la ventana (`@media (max-height: …)` o una clase
  que pone `grupos.js`) (S).
- **Recomendación:** (a) ahora y (c) como respaldo; (b) si el personal lo pide en la prueba con usuarios.

**D2 · Botón «Menú de pruebas» sobre el foco (RI-05).** Aceptarlo como parte de lo aceptado el 18/10 (sólo existe en la
prueba) o agregar el `scroll-padding-bottom` de una línea. **Recomendación:** agregarlo (S), porque la prueba con
usuarios se hará con el botón visible.

**D3 · Foco inicial de los diálogos con motivo (RI-11).** (a) Dejarlo en el motivo, que es lo primero que hay que hacer
y Enter en un `textarea` no envía nada, y anotar la excepción en DECISIONES; (b) cumplir la decisión del 17/10 con
`autofocus` en «Volver sin cambios». **Recomendación:** (a), anotando la excepción con fecha.

**D4 · Botones de navegación en el límite (RI-02).** (a) `aria-disabled` y el botón conserva el foco; (b) `disabled` y
mover el foco al otro botón. **Recomendación:** (a), es lo que ya usa `programar.js:421`.

---

## 6. No verificable desde aquí, hipótesis y no confirmado

**No verificable desde aquí**
- Cómo se oyen realmente los anuncios dobles y múltiples (RI-03, RI-04, RS-03) en NVDA, JAWS, VoiceOver o TalkBack: no
  hay lector de pantalla real (P34 sigue abierto: recorrido con lector en iPhone y Android).
- Firefox y Safari (WebKit): no se pudieron instalar. El desplazamiento por foco y `scroll-padding` varían entre
  navegadores.
- El teclado virtual del teléfono reduce la ventana y puede tapar el campo enfocado; Playwright no lo simula.
- Ampliación al 200 % y 400 %: no se midió; es probable que RI-01, RI-05 y RS-02 empeoren (la barra y el botón crecen).

**Hipótesis (no comprobadas)**
- Doble lectura al mover el foco a un elemento que también es región viva: avisos con `foco: true` y rol
  (`formkit.core.js:152`), el resumen de errores con `role=alert` y foco (`:591` y `:619`), y el resultado, que enfoca su
  título y además lo anuncia (`sitio/formkit/modulos/resultado/resultado.js:111-112`). El observador ve un solo cambio
  de región, pero algunos lectores leen el foco y la región.
- En «Grupos» con el ratón, la lista visible a 1440×900 al cargar es de una fila (el resto queda debajo de la barra hasta
  desplazarse); no es una falla de teclado, pero puede confundir.

**No confirmado**
- Ninguno: todo lo reportado salió 2 de 2.

**No revisado en este frente:** P153 (el módulo de archivos manda el foco a `<body>` al volver a pintar la lista): no lo
repetí; sigue registrado. El orden visual contra el orden del DOM (2.4.3 en sentido estricto) sólo lo vi en los
recorridos, sin medirlo pantalla por pantalla.

---

## 7. Pruebas que conviene dejar permanentes

1. **Foco no oculto** (en `probar-volumen.mjs`): recorrer con Tab «Grupos», la bandeja y las citas con volumen en 1024,
   1280 y 1440 px y fallar si alguna parada queda oculta por completo por un elemento fijo o pegajoso (la función `mide`
   de `foco-recorrido.mjs`). Hoy fallaría en «Grupos» (RI-01).
2. **El foco nunca cae en `<body>` después de una acción** (en `probar-sitio.mjs`): «Día siguiente» hasta el final,
   «Mes anterior» y «Mes siguiente» hasta los límites, recuperar y descartar el borrador.
3. **Un mensaje, un anuncio:** el observador de regiones vivas de `gestion-foco.mjs` en los recorridos existentes; falla
   si el mismo texto aparece en dos regiones en el mismo paso o si una acción produce más de dos anuncios.
4. **Búsqueda con pausa:** escribir 3 letras en «Buscar una cita» produce un anuncio.
5. **Reserva de las barras pegajosas:** alto real de `.barra-fija` ≤ `scroll-padding-top` en 390 px (para el estándar) y
   de `.plan-barra` ≤ `scroll-padding-bottom` (para el proyecto).

**Cómo repetir todo** (con el sitio servido en el puerto 8906, desde esta carpeta):

```sh
node foco-recorrido.mjs http://localhost:8906/ ficticios 1440x900,1280x720,1024x768,390x844 salidas/recorrido-ficticios-1.json
node foco-recorrido.mjs http://localhost:8906/ volumen 1440x900,1280x720,1024x768,390x844 salidas/recorrido-volumen-1.json "^S "
TECLA=Shift+Tab node foco-recorrido.mjs http://localhost:8906/ volumen 1280x720 salidas/atras-volumen.json "S grupos"
RONDAS=2 node gestion-foco.mjs http://localhost:8906/ salidas/gestion.json
node compara-rondas.mjs salidas/gestion.json
node resumen-recorrido.mjs salidas/recorrido-*.json
node plan-barra.mjs http://localhost:8906/ volumen
node inventario-vivas.mjs http://localhost:8906/
```
