# Auditoría de seguimiento 20/10/2026 · r2 · B1 (barrido de pantallas) y B6 (teléfono y continuidad)

Sistema de Acreditaciones de Poda y Dictaminación, versión de prueba 0.61 + PR #5 (`d58c611`), estándar de formularios
1.5.1. Revisión en solo lectura sobre la copia `<copia del revisor r2>`, servida en el puerto 8902. No se editó
ningún archivo del proyecto (`git status` de la copia: solo `node_modules`, que ya estaba enlazado). Todo lo de esta
auditoría está en `docs/auditoria-2026-10-20/ (r2) `.

**Resultado en una línea:** B1 **no aprobada** (criterio: 0 hallazgos; hay 6 nuevos del proyecto y 2 del componente
compartido); B6 con 4 hallazgos nuevos, ninguno pierde información de forma definitiva.

**Totales de hallazgos nuevos del proyecto: 0 críticos · 0 altos · 3 medios · 7 bajos · 0 informativos**, más **2 fallas
del componente compartido** (bajas, sección 4). Los 2 avisos ya conocidos de `auditar-sitio` **siguen** (sección 3).
Además, el barrido encontró que la medición de desborde de `auditar-sitio.mjs` no ve el desborde en la emulación de
teléfono (B1-06).

---

## 1. Qué hice

### Método

| Paso | Herramienta (en `guiones/`) | Qué hace |
|---|---|---|
| Línea base | `herramientas/auditar-sitio.mjs` del proyecto, sin cambios | 60 pantallas, 201 botones. Salida: `linea-base-auditar-sitio/` |
| B1 · descubrir | `b1-descubrir.mjs` | Toma los 40 casos del menú de pruebas (`casos-prueba.js`, calculados por el propio sitio), más cada cita, cada solicitud por revisar y cada grupo, y sigue todos los enlaces internos con la misma sesión, hasta 3 saltos. Revisa cada enlace (también `?folio=`, `?curso=`, `?semana=`, `?volver=` y `#ancla`): respuesta HTTP, a dónde lleva, si el destino dice «No se encontró», «No se pudo cargar», `undefined` o `NaN`, y si el ancla existe. Lo mismo con el escenario de volumen (`DATOS=volumen`) |
| B1 · revisar | `b1-revisar.mjs` (amplía `auditar-sitio.mjs`; conserva todas sus revisiones) | En cada estado y cada tamaño: consola y página, 4xx/5xx y peticiones fallidas, ids repetidos, ARIA a ids inexistentes, anclas rotas, desborde horizontal (con el elemento culpable), texto recortado, **texto que se sale de su caja aunque no se recorte** (nuevo), encimados, objetivos de menos de 24 × 24 px (WCAG 2.5.8) y de menos de 44 px de alto (aviso del estándar), `hidden` que se ve, **foco tapado por un elemento fijo o pegajoso recorriendo la página con Tab** (WCAG 2.2, 2.4.11; nuevo), **contenido que queda bajo un elemento fijo al final de la página** (nuevo) y **cada botón presionado** sobre el estado recién preparado (si no hace nada, o si no se puede presionar y por qué) |
| B1 · estados con acciones | dentro de `b1-revisar.mjs` | 21 estados que requieren pasos: menú de pruebas abierto (4 pantallas), formularios enviados vacíos (4), verificar con resultado, crear cuenta llena y su acuse, pasos 2 y 3 de la solicitud llenos, acuse de la solicitud, «Editar» en «Mi perfil», y el examen de la persona: código escrito, «¿eres tú?», instrucciones, pregunta, revisión y resultado |
| B1 · tabla | `b1-tabla.mjs` | Junta los 7 tamaños, separa los artefactos de la prueba (con su motivo) y escribe `b1/tabla-b1.md` |
| B1 · desborde | `b1-desborde.mjs` | Desborde horizontal medido contra el ancho del documento (`clientWidth`) en los 7 tamaños y 183 estados sin acciones (ver B1-06) |
| B1 · repetir | `b1-repro.mjs` | Cada hallazgo de B1, dos veces, en contextos nuevos: `b1/repro.json` |
| B6 | `b6.mjs` | 18 escenarios, cada uno dos veces en un contexto nuevo: `b6/b6.json` |

### Tamaños (todos con Chromium 1194, `timezoneId: America/Mexico_City`, `locale: es-MX`)

| Clave | Viewport | Notas |
|---|---|---|
| tel360 | 360 × 780 | táctil, móvil, DPR 3 |
| tel390 | 390 × 844 | táctil, móvil, DPR 3 |
| tel430 | 430 × 932 | táctil, móvil, DPR 3 |
| telH | 844 × 390 | teléfono horizontal, táctil, móvil |
| tableta | 768 × 1024 | táctil, móvil, DPR 2 |
| escritorio | 1440 × 900 | |
| zoom200 | 720 × 450, DPR 2 | **Zoom al 200 %**: se usó la primera opción del encargo. Un escritorio de 1440 × 900 con el navegador al 200 % deja 720 × 450 px CSS y dibuja con densidad 2; así responden igual las consultas de medios y el desplazamiento, cosa que el zoom CSS no reproduce |

### Pantallas, estados y perfiles

204 estados por tamaño, en las 21 pantallas: 160 con los datos ficticios, 23 con el escenario de volumen (65 por revisar,
40 citas en un día, 112 en espera, grupos de 25) en las pantallas del personal, y 21 con acciones. Perfiles: público sin
sesión, persona nueva, podador en cada estado del trámite (borrador, enviada, reenviada, con observaciones, cita, cita
nueva por inasistencia o sin pago, pausa, pausa vencida, en espera, grupo cancelado, grupo por confirmar, grupo
confirmado, aprobada, por recoger, acreditada, por vencer, renovación enviada y en espera, vencida no renovable, no
acreditada, sin derecho a examen, cerrada por inasistencias, por no corregir y cancelada), dictaminador (observaciones,
perfil dudoso, rechazado, renovación, poda vencida), registro anterior (dos casos), personal de revisión y cotejo,
instructor, quien aplica el examen y la persona en el examen. «Mi perfil» se recorrió con 6 personas y sus 3 `?volver=`;
«Programar» con ?semana=, con 3 semanas por juego de datos.

### Número de pruebas

- Enlaces: **1,307** con los ficticios (108 distintos) y **842** con volumen (202 distintos); 10 recursos (PDF) y 3
  enlaces externos.
- Barrido: **1,427 estados-tamaño** (204 × 7, menos 1 que no se pudo preparar en tableta, ver C-02), **3,999 botones
  presionados** (cada botón distinto de cada pantalla, en cada tamaño; 212 días del calendario con `aria-disabled` se
  contaron aparte) y **31,434 paradas de Tab** revisadas para el foco tapado.
- Desborde medido contra el documento: 183 estados × 7 tamaños = 1,281 cargas.
- Reproducciones de B1: 8 casos × 2.
- B6: 18 escenarios × 2 = 36 corridas, 0 fallas de la prueba en la corrida final, y las dos rondas de cada escenario
  dieron lo mismo.

### Lo que no se usó

Firefox y WebKit no están (la red bloqueó su descarga). No hay lector de pantalla real ni teléfono real. El sitio
publicado en GitHub Pages no se pudo consultar (el proxy respondió 403).

---

## 2. Hallazgos (de más a menos graves)

| Gravedad | Cantidad | Claves |
|---|---|---|
| Crítica | 0 | — |
| Alta | 0 | — |
| Media | 3 | B1-01, B6-01, B6-02 |
| Baja | 7 | B1-02, B1-03, B1-04, B1-05, B1-06, B6-03, B6-04 |
| Informativa | 0 | — |
| Componente compartido (bajas) | 2 | C-01, C-02 (sección 4) |

### B1-01 · En «Grupos», el foco del teclado queda oculto por completo bajo la barra del planeador
- **Gravedad:** Media · **Esfuerzo:** S
- **Dónde:** `grupos.html` (y `espera.html`, que redirige ahí), lista «En espera», perfil personal; en escritorio 1440 × 900,
  tableta 768 × 1024 y teléfono horizontal 844 × 390 (desde 760 px de ancho la barra es pegajosa: `app/apd.css:579`,
  `.plan-barra { position: sticky; bottom: 0 }`).
- **Qué pasa:** se espera que el control que recibe el foco se vea (WCAG 2.2, 2.4.11, nivel AA: no debe quedar oculto por
  completo). Al recorrer la lista con Tab, las casillas de las personas y de «Elegir a las N personas de…» quedan **100 %
  debajo** de la barra «Ninguna elegida / Al curso… / Al grupo sin fecha… / A un curso nuevo…». El navegador no desplaza la
  página porque el control sí está dentro de la ventana, sólo que tapado.
- **Cuántas:** con los ficticios, 1 casilla en cada vuelta de Tab (MARTA MUESTRA FICTICIO). Con el volumen real (66 en
  espera de poda nueva), **44 de 120 pulsaciones de Tab** dejaron el foco oculto por completo; el barrido contó 198 casos en
  escritorio, 316 en teléfono horizontal y 158 en tableta (las pantallas de Grupos y `espera.html`, con los dos juegos de
  datos); a 720 × 450 (zoom 200 %) y en vertical la barra no es pegajosa y no pasa. Con volumen, la barra mide unos 310 px:
  a 1440 × 900, al abrir la pantalla, de la lista sólo se ven unos 55 px.
- **Consecuencia:** quien usa el teclado (el personal, en computadora) marca a personas que no ve; puede agregar a un grupo a
  quien no quería.
- **Cómo se reproduce:** `grupos.html?curso=poda-nueva` a 1440 × 900 con el escenario de volumen; Tab desde el principio.
- **Evidencia:** `b1/repro.json` («B1-01»), `capturas/b1/repro-B1-01-escritorio-volumen.png` (el foco está en «BRUNO ENSAYO
  FICTICIO», que no se ve), `repro-B1-01-escritorio-ficticios.png`, `repro-B1-01-tableta-ficticios.png`,
  `repro-B1-01-telH-ficticios.png`; en el barrido, `capturas/b1/escritorio/075-foco-1.png`.
- **Reproducido:** 2 de 2 (cuatro tamaños o juegos de datos en cada ronda).
- **Causa probable:** barra pegajosa al pie sin `scroll-padding-bottom` ni ajuste del desplazamiento al enfocar.
- **Corrección propuesta:** al enfocar un control de la lista que quede bajo la barra, desplazarlo arriba de ella
  (`scrollIntoView({ block: 'center' })` en `focusin` si se intersecta con `.plan-barra`), o dar a la página un
  `scroll-padding-bottom` igual a la altura de la barra (medida con `ResizeObserver`). Si la barra pasa de un tercio de la
  ventana, que deje de ser pegajosa.
- **Listo cuando:** una prueba recorre con Tab `grupos.html?curso=poda-nueva` con volumen a 1440 × 900, 768 × 1024 y 844 ×
  390 y obtiene 0 controles tapados al 99 % o más (la función `tabTapados` de `guiones/b1-repro.mjs`).
- **Estado:** Abierto. No está en PENDIENTES ni en las auditorías del 17 al 19/10 (búsqueda de «plan-barra», «2.4.11» y
  «foco tapado» en `docs/`).

### B6-01 · Si la sesión caduca a la mitad, la persona lee «Tu sesión se cerró en otra pestaña» y «No se guardó nada»
- **Gravedad:** Media · **Esfuerzo:** S
- **Dónde:** `app/apd.js:272-281` (`sesionCambio`), que usan la solicitud (`app/config-solicitud.js:135`), «Mi perfil»
  (`app/config-datos.js:27`) y «Cargar el documento correcto» (`app/corregir.js:59`). Persona, teléfono 390 × 844.
- **Qué pasa:** con una sola pestaña abierta, se borra `apd.sesion` (lo mismo que verá la persona cuando su sesión caduque
  en el SIA) y se presiona «Enviar solicitud», «Guardar cambios» o «Cargar el documento». Se espera un mensaje que diga que
  la sesión terminó y que lo capturado sigue ahí. Se observa, en las tres pantallas: «**Tu sesión se cerró en otra
  pestaña.** En otra pestaña se salió de tu cuenta. **No se guardó nada.** Vuelve a entrar con tu cuenta».
- **Lo que se pierde:** nada. Al volver a entrar por el enlace (`entrar.html?volver=solicitud.html`) aparece la franja del
  borrador y «Recuperar borrador» devuelve el paso «Revisión», los datos y los 4 documentos.
- **Consecuencia:** el mensaje es falso (no hubo otra pestaña) y alarma (sugiere que alguien más salió de la cuenta);
  «No se guardó nada» invita a empezar de cero lo que sí está guardado en el dispositivo. Heurística 9 de Nielsen
  (diagnosticar el error).
- **Cómo se reproduce:** `guiones/b6.mjs`, escenarios 4a, 4b y 4c.
- **Evidencia:** `b6/b6.json` (4a, 4b, 4c), `capturas/b6/4a-sesion-caducada-r1.png`, `4a-tras-volver-a-entrar-r1.png`,
  `4b-perfil-sesion-caducada-r1.png`, `4c-corregir-sesion-caducada-r1.png`.
- **Reproducido:** 2 de 2 en cada pantalla.
- **Causa probable:** `sesionCambio` sólo distingue «otra cuenta» de «sin sesión» y supone que la falta de sesión viene de
  otra pestaña.
- **Corrección propuesta:** sin sesión: «Tu sesión terminó. No se envió nada, pero lo que capturaste sigue en este
  dispositivo: vuelve a entrar y continúa.» Reservar «en otra pestaña» para cuando sí hay otra cuenta. En la etapa 3, la
  respuesta 401 de la API usa el mismo texto.
- **Listo cuando:** la prueba 4a de `b6.mjs` lee «terminó» y no lee «otra pestaña» ni «No se guardó nada».
- **Estado:** Abierto. La decisión del 19/10 (DECISIONES, bloque 2) fijó los textos para el caso de dos pestañas; el caso
  de la sesión que caduca no está registrado.

### B6-02 · «Crea tu cuenta» pierde todo, foto incluida, al recargar o con «Atrás», sin avisar
- **Gravedad:** Media · **Esfuerzo:** M
- **Dónde:** `cuenta.html` (`app/cuenta.js`, `app/config-cuenta.js`), persona sin cuenta, teléfono 390 × 844.
- **Qué pasa:** con el formulario lleno (nombre, apellidos, fecha, CURP, dos correos, teléfono, dos contraseñas, fotografía
  y adscripción): al recargar, todos los campos quedan vacíos y la foto desaparece; «Atrás» lleva a la página anterior sin
  preguntar, y «Adelante» devuelve el formulario vacío. No hay franja de borrador ni aviso antes de salir. Se espera, como en
  la solicitud, que avise antes de salir con cambios y que conserve al menos lo que no es sensible.
- **Consecuencia:** la persona vuelve a capturar 11 datos y a tomar la foto. En un teléfono, el gesto de «Atrás» es fácil de
  hacer sin querer. Ver también la hipótesis H1 (el navegador puede recargar la página al volver de la cámara). Heurística 5
  (prevención de errores).
- **Cómo se reproduce:** `guiones/b6.mjs`, escenario 5b.
- **Evidencia:** `b6/b6.json` (5b: `lleno` con CURP y 1 foto; `trasRecargar` vacío, 0 fotos, sin franja; `trasAdelante`
  vacío), `capturas/b6/5b-cuenta-tras-adelante-r1.png`. En el código: `cuenta.html:48` no tiene `data-borrador` y ni
  `cuenta.js` ni `config-cuenta.js` registran `beforeunload` (0 coincidencias).
- **Reproducido:** 2 de 2.
- **Causa probable:** la cuenta no usa el borrador del núcleo ni el aviso antes de salir que sí tienen la solicitud,
  la revisión, el cotejo, la asistencia y «Programar».
- **Corrección propuesta:** ver «Para decidir» 1.
- **Listo cuando:** con la cuenta llena, recargar ofrece recuperar los datos no sensibles (sin contraseñas ni foto, que el
  estándar excluye con `data-sensible`), y «Atrás» con cambios pregunta antes de salir.
- **Estado:** Decide el dueño.

### B1-02 · En un grupo cancelado se ve una barra de cupo vacía y sin texto
- **Gravedad:** Baja · **Esfuerzo:** S
- **Dónde:** `grupo.html?folio=APD-G-2026-002` (grupo cancelado), personal, en los 7 tamaños; `app/apd.css:290`.
- **Qué pasa:** la página marca `[data-cupo]` con `hidden` (no aplica en un grupo cancelado), pero `.cupo { display: grid }`
  le gana a la regla `[hidden] { display: none }` del estándar (`formkit/css/nucleo.css:399`, que tiene la misma
  especificidad y se carga antes). Se ve una barra gris de 12 px de alto, de lado a lado, sin texto.
- **Consecuencia:** una barra de cupo vacía en un grupo cancelado sugiere «0 personas» o un error de carga.
- **Evidencia:** `b1/repro.json` («B1-02»: `hidden: true`, `display: grid`, 12 × 1294 px en escritorio y 12 × 324 en
  teléfono), `capturas/b1/repro-B1-02-escritorio.png`, `repro-B1-02-tel390.png`.
- **Reproducido:** 2 de 2.
- **Causa probable:** la convención del estándar (`nucleo.css:398`: el estado lo da el atributo, nunca la clase) no se
  respetó en `.cupo`.
- **Corrección propuesta:** `.cupo:not([hidden]) { display: grid; … }`.
- **Listo cuando:** la revisión «marcado hidden pero visible» de `auditar-sitio.mjs` incluye `grupo.html?folio=` de un grupo
  cancelado y da 0.
- **Estado:** Abierto. `auditar-sitio` no lo veía porque no recorre grupos cancelados.

### B1-03 · El botón «Menú de pruebas» tapa en parte los controles enfocados cerca del pie
- **Gravedad:** Baja · **Esfuerzo:** S
- **Dónde:** botón fijo `.menu-pruebas-boton` (`app/apd.css:71`), en casi todas las pantallas; ejemplos reproducidos:
  «Mes siguiente» en `programar.html` a 390 px (72 % tapado), cada «Revisar la solicitud…» de la bandeja con volumen a 1440
  px (54 %), «Siguiente» del examen en teléfono horizontal (56 %), la pestaña «Paso 3 de 3: Revisión» de la solicitud a 844
  × 390 y a 720 × 450 (encimados al abrir la página), «Atender la cita…» en citas con volumen.
- **Qué pasa:** el foco no queda oculto por completo (pasa WCAG 2.4.11, AA), pero sí en parte (2.4.12, AAA). Es la misma
  causa del aviso conocido de `auditar-sitio` en `revisar-dictaminador` (sección 3), que aparece en muchas más pantallas.
- **Consecuencia:** al revisar la prueba con teclado o en teléfono horizontal, la última fila visible queda medio tapada.
  Sólo en la versión de prueba: el menú se quita en la etapa 3.
- **Evidencia:** `b1/repro.json` («B1-03»), `b1/tabla-b1.md` (tipo «foco tapado en parte»), capturas `*-foco-*.png` en
  `capturas/b1/<tamaño>/`.
- **Reproducido:** 2 de 2.
- **Corrección propuesta:** dar al `<body>` un relleno inferior igual a la altura del botón más su margen y un
  `scroll-padding-bottom` del mismo valor mientras el menú exista.
- **Listo cuando:** el recorrido con Tab de `b1-repro.mjs` («B1-03») da 0 controles tapados más del 25 % por el menú.
- **Estado:** Abierto (amplía el aviso conocido de `auditar-sitio`).

### B1-04 · «Corregir otro día» mide 40.8 px de alto; el estándar pide 44
- **Gravedad:** Baja · **Esfuerzo:** S
- **Dónde:** `asistencia.html?folio=…` (instructor), en todos los tamaños; `app/apd.css:390` (`.asis-otro-dia > summary`).
- **Qué pasa:** el objetivo mide 132 × 40.8 px. Cumple WCAG 2.5.8 (24 px) pero no el mínimo del estándar
  (`--objetivo-min: 44px`), que el propio proyecto sí aplica a otro `summary` (`app/apd.css:350`, material de estudio).
- **Evidencia:** `b1/repro.json` («B1-04»); en el barrido, aviso «menos de 44 px» en los 14 estados de asistencia con folio.
- **Reproducido:** 2 de 2.
- **Corrección propuesta:** `min-height: var(--objetivo-min)` en `.asis-otro-dia > summary`.
- **Listo cuando:** `auditar-sitio` recorre asistencia con folio y no da «control de menos de 44 px de alto».
- **Estado:** Abierto.

### B1-05 · Asistencia a 360 px: el aviso «Ya no puede faltar» se encima con el botón «Asistió»
- **Gravedad:** Baja · **Esfuerzo:** S
- **Dónde:** `asistencia.html?folio=APD-G-2026-003` (instructor), fila de una persona que ya faltó un día; teléfono de
  360 px (también, apenas, a 390 px).
- **Qué pasa:** la columna del nombre mide 136 px (de 89 a 225) y los botones empiezan en 192 px: el nombre y el aviso
  «Ya no puede faltar» invaden 33 px la columna de «Asistió». El aviso queda **33 × 6 px encima del borde del botón**; a
  390 px, 3 × 6 px. El texto del nombre se parte antes y no choca, pero su caja sí.
- **Consecuencia:** un aviso importante (la persona ya no puede faltar) monta sobre el botón que el instructor va a tocar;
  en un teléfono chico el toque puede caer en el borde equivocado.
- **Evidencia:** `b1/repro.json` («B1-05»), `capturas/b1/repro-B1-05-tel360.png`; en el barrido, «encimado» en 6
  estados de asistencia a 360 px (`b1/tabla-b1.md`).
- **Reproducido:** 2 de 2.
- **Causa probable:** en la rejilla de la fila, la columna del nombre no se encoge (falta `min-width: 0` o una columna
  `minmax(0, 1fr)`) y el aviso no se parte en renglones a ese ancho.
- **Corrección propuesta:** que la columna del nombre sea `minmax(0, 1fr)` y que los botones bajen al renglón siguiente
  por debajo de unos 380 px.
- **Listo cuando:** la revisión de encimados de `auditar-sitio` a 360 px en `asistencia.html?folio=` da 0.
- **Estado:** Abierto.

### B1-06 · La revisión de desborde de `auditar-sitio.mjs` no ve el desborde en el teléfono emulado
- **Gravedad:** Baja · **Esfuerzo:** S
- **Dónde:** `herramientas/auditar-sitio.mjs` (revisión `de.scrollWidth > window.innerWidth + 1`, vista «telefono» con
  `isMobile: true`).
- **Qué pasa:** en la emulación de teléfono, cuando el contenido es más ancho que la pantalla, el navegador agranda la
  ventana de diseño y `innerWidth` crece con él: en la bandeja a 768 px, `innerWidth` = 891 y `scrollWidth` = 891, así que
  la prueba dice «sin desborde» aunque el documento mide 891 en una pantalla de 768 (`clientWidth`). Así se le escapó
  C-02. A 390 px no hay hoy ningún desborde que se esté escapando (`b1-desborde.mjs`: 0 de 183).
- **Consecuencia:** una prueba en verde que no mide lo que dice; un desborde futuro en teléfono pasaría sin aviso.
- **Evidencia:** `b1/repro.json` («C-02»: `documento 891, ancho 768, innerWidth 891`), `guiones/b1-desborde.mjs`.
- **Reproducido:** 2 de 2.
- **Corrección propuesta:** comparar con `document.documentElement.clientWidth` (o `visualViewport.width`), y añadir a la
  vista de teléfono un tamaño de tableta (768) y uno horizontal (844 × 390).
- **Listo cuando:** `auditar-sitio` marca el desborde de C-02 mientras no se corrija.
- **Estado:** Abierto (falla de la prueba del proyecto, no del sitio).

### B6-03 · Después de «Recuperar borrador», la primera vez que se presiona «Atrás» no pasa nada
- **Gravedad:** Baja · **Esfuerzo:** S
- **Dónde:** `solicitud.html` (persona), `app/solicitud.js:317`.
- **Qué pasa:** con la solicitud en «Documentos», se recarga y se presiona «Recuperar borrador» (vuelve a «Documentos» con
  sus 2 documentos). «Atrás» lleva a «Trámite» y el siguiente «Atrás» **se queda en «Trámite»**; hasta el tercero se llega a
  «Mis trámites». Antes de recargar, «Atrás» y «Adelante» recorren los pasos sin pasos muertos.
- **Causa probable:** al cargar, `historial()` hace `history.replaceState({ apdPaso: 0 })` sobre la entrada del paso en que
  estaba la persona; al recuperar, se agrega otra entrada. Quedan dos entradas seguidas del paso 0.
- **Consecuencia:** una pulsación sin efecto; la persona puede creer que el botón no funciona y salir de la página.
- **Evidencia:** `b6/b6.json` (5a: `historial` pasa de 4 a 5; «Atrás 1» y «Atrás 2» en «Trámite»; «Atrás 3» en
  `tramites.html`), `capturas/b6/5a-tras-recuperar-r1.png`.
- **Reproducido:** 2 de 2.
- **Corrección propuesta:** al cargar, conservar el `apdPaso` de `history.state` si ya existe, o reemplazar (no agregar) la
  entrada al recuperar el borrador.
- **Listo cuando:** en la prueba 5a, cada «Atrás» cambia de paso o de página.
- **Estado:** Abierto. La auditoría del 18/10 (F1, «Navegación de la solicitud») probó «Atrás» y la recuperación por
  separado, con el borrador propio que se quitó en la 0.60 (P148); esta combinación es nueva.

### B6-04 · El distintivo de versión no dice qué código está corriendo
- **Gravedad:** Baja · **Esfuerzo:** S
- **Dónde:** `app/version-visible.js:29-34`; todas las pantallas.
- **Qué pasa:** el distintivo lee el archivo `VERSION` una vez, al abrir la página, y aparte de los scripts.
  - Pestaña abierta y se publica la 0.62: el distintivo sigue en «0.61» y nada avisa (correcto para lo que está corriendo,
    pero la persona no sabe que hay versión nueva).
  - Al recargar: «Versión de prueba 0.62», el borrador se recupera completo (paso «Documentos» y sus 2 documentos) y no se
    pierde nada. Bien.
  - HTML y scripts de la 0.61 (por ejemplo, en la caché del navegador) con `VERSION` nuevo: el distintivo dice
    «**0.62**» mientras corren **7 scripts con `?v=0.61`**.
- **Consecuencia:** quien reporta una falla puede citar una versión que no es la que tenía; la regla del proyecto es que la
  versión en pantalla identifique lo que se usa.
- **Evidencia:** `b6/b6.json` (7: `htmlViejoConVersionNueva: { distintivo: "Versión de prueba 0.62", scripts: 7 }`),
  `capturas/b6/7-tras-recargar-version-nueva-r1.png`.
- **Reproducido:** 2 de 2.
- **Estado:** Decide el dueño («Para decidir» 2). Que GitHub Pages sirva HTML en caché después de publicar es la hipótesis H2.

---

## 3. Verificado sin hallazgos

**Los 2 avisos conocidos de `auditar-sitio` siguen igual** (línea base: 60 pantallas, 201 botones, 2 avisos):
- encimado de «Abrir en otra pestaña» del visor con «Menú de pruebas» en `revisar-dictaminador`, escritorio (el barrido lo
  vio en las 3 solicitudes por revisar con visor, a 1440 px: misma causa que B1-03);
- «Ir al contenido» en `corregir-observaciones`: con el teclado no lleva al contenido.

**B1:**
- **Enlaces:** 0 rotos de 2,149 (1,307 ficticios y 842 con volumen; 310 distintos), incluidos los `?folio=` de la bandeja,
  la agenda, los grupos y «Mis trámites», los `?semana=`, los `?volver=` y las anclas. 10 PDF responden 200. Los 3 enlaces
  externos (mapa del trámite en claude.ai, sitio de la Secretaría y consulta de la CURP) no se pudieron abrir desde aquí; el
  del mapa ya está registrado como D3-02.
- **Consola y red:** 0 errores, 0 advertencias, 0 respuestas 4xx/5xx y 0 peticiones fallidas en los 1,427
  estados-tamaño.
- **Desborde horizontal (medido contra el documento):** 0 en 360, 390, 430, 1440 y 720 × 450; sólo la bandeja de
  revisión a 768 y 844 px (C-02).
- **Texto recortado, ids repetidos, ARIA a ids que no existen, anclas rotas, contenido bajo un elemento fijo al final de
  la página:** 0.
- **Objetivos de menos de 24 × 24 px:** 0.
- **Botones:** 3,999 presionados; los que no cambiaron nada o no se dejaron presionar son artefactos explicados en la
  tabla de abajo, salvo «Menú de pruebas» en la bandeja en tableta (C-02).
- **Escenario de volumen:** revisión (65), citas (40 en un día), grupos (112 en espera), «Programar», ficha del grupo,
  asistencia y aplicar, sin hallazgos distintos de B1-01 a B1-05 y C-02.

**Artefactos de la prueba (se descartaron, con su motivo):**

| Lo que marcó el guion | Por qué no es falla |
|---|---|
| Días del calendario de «Programar» que «no se pueden presionar» | Tienen `aria-disabled="true"` a propósito y explican por qué no se puede empezar ese día (`app/programar.js:148`). Desde la corrección del guion se cuentan aparte |
| Nombres de archivo y textos del repaso del examen «fuera de su caja» | Recorte con puntos suspensivos a propósito (`text-overflow: ellipsis`) |
| Encimados con el menú de pruebas abierto | Es un diálogo modal: lo de abajo está inerte |
| «Menú de pruebas» «fuera» del pie (`revision.html` en horizontal) | El botón es fijo (`position: fixed`): está en el código del pie pero no dentro de su caja; lo que sí molesta de él está en B1-03 |
| «Entrar», «Verificar» y los pasos sin efecto en un formulario ya enviado vacío | El formulario ya muestra los mismos errores; con la página recién cargada sí responden |

**B6:**
- **Sin conexión no aplica (confirmado):** en 5 pantallas, `navigator.serviceWorker.getRegistrations()` = 0, sin
  `<link rel="manifest">` y `caches.keys()` = 0; en el código no hay `serviceWorker` ni manifiesto (la única mención de
  «manifest» está dentro de pdf.js, en su lector de XFA). Sin red, una pantalla ya visitada carga desde la caché del
  navegador y dice «No se pudo cargar tu información. Intenta de nuevo más tarde.»; una nunca visitada da el error del
  navegador (`ERR_INTERNET_DISCONNECTED`). Es lo esperado sin caché propia.
- **Teléfono horizontal (844 × 390):** crear cuenta con una foto real, solicitud de punta a punta con 4 PDF reales, corregir
  y reenviar, cargar el documento correcto, «Mis trámites» y el examen completo terminan bien, sin desborde ni errores, las 2
  veces. Lo único: C-01 (la barra de pasos ocupa 34 % de la altura).
- **Cámara y ubicación:** en teléfono se ofrece «Tomar fotografía» (`<input type="file" accept="image/*" capture="user">`);
  en escritorio no. Con los permisos negados, abrir la cámara no pide permiso del navegador (no usa `getUserMedia`) y, si la
  persona cancela, no se agrega nada, no sale error y el foco se queda en el botón. 0 llamadas a la cámara (`getUserMedia`)
  y 0 a la ubicación (`geolocation`) en todos los recorridos de B6.
- **Fotografía sin ubicación (P127 sigue resuelto):** se cargó un JPG con GPS y modelo de teléfono en EXIF; lo guardado
  pesa 9,525 bytes y no lleva ni «Exif» ni «GPS».
- **Carga sin red:** con la red caída a la mitad de los documentos, se cargan los 4, la solicitud se envía y al volver la red
  está en «Mis trámites»: en la prueba nada viaja por la red (los archivos van al navegador). Con el envío «Lento» y la red
  caída, sale «El envío tardó demasiado y se detuvo. Lo que capturaste sigue aquí; intenta de nuevo.» y el botón queda
  «Enviando…» deshabilitado mientras tanto. En el material del personal, un PDF de 375 KB se agrega sin red sin error.
- **Recargar y «Atrás» en la solicitud:** «Atrás» y «Adelante» recorren los pasos con los datos y los documentos; al
  recargar aparece la franja y «Recuperar borrador» trae paso, datos y documentos. Lo único: B6-03.
- **Dos pestañas:** con la misma solicitud nueva en dos pestañas, la que guarda al último gana el borrador y la otra no se
  entera; después de enviar en una, la otra sigue mostrando el formulario, pero «Solicitud» ya dice «Ya tienes un trámite en
  curso (folio …)» y no ofrece el borrador viejo. Es la misma familia que F1 1 a 4 y P160 (ya decididas); no lo cuento como
  nuevo.
- **Versión nueva:** al recargar se ve la nueva y no se pierde nada (la versión del borrador es fija, `config-solicitud.js:50`).
  Lo único: B6-04.

---

## 4. Fallas del componente compartido (estándar de formularios 1.5.1)

### C-01 · La barra de pasos pegajosa ocupa un tercio de la pantalla en poca altura
- **Gravedad:** Baja · **Esfuerzo:** S (en el estándar)
- **Dónde:** `sitio/formkit/modulos/pasos/pasos.css:18-26` (`.barra-fija { position: sticky; top: 0 }`); la única adaptación
  es por ancho (`:123`, desde 760 px), ninguna por altura. **Sin clave** (no está entre P152–P158, P166, P171).
- **Qué pasa:** en «Documentos» de la solicitud, ya desplazada, la barra mide 133 px en 844 × 390 (**34 %** de la altura) y
  141 px en 720 × 450 (zoom 200 %, **31 %**); en vertical, 17 % (390 × 844) y 15 % (1440 × 900). En el proyecto lleva
  además el recordatorio «Estás solicitando: …» (`solicitud.html:65-68`), que le suma unos 45 px.
- **Consecuencia:** en horizontal o con zoom, la persona lee el formulario en 257 px de alto. WCAG 1.4.10 (reflujo) no se
  incumple, pero su documento de comprensión advierte de los encabezados fijos en poca altura.
- **Evidencia:** `b1/repro.json` («C-01»), `capturas/b1/repro-C-01-telH.png`, `capturas/b6/1x-tras-continuar-telH.png`.
- **Reproducido:** 2 de 2.
- **Corrección propuesta (en el estándar):** `@media (max-height: 500px) { .barra-fija { position: static } }`, o
  compactarla (sólo «Paso 2 de 3 · Documentos»). Registrar un Pnn para el estándar.

### C-02 · Bandeja de revisión: un texto «solo-lector» se escapa de la tabla y desborda la página a 768 y 844 px
- **Gravedad:** Baja · **Esfuerzo:** S
- **Dónde:** `revision.html` (personal), en tableta 768 × 1024 y teléfono horizontal 844 × 390, con los ficticios y con
  volumen. Componente: `sitio/formkit/modulos/tabla/tabla.css:13` (`.tabla-marco { overflow-x: auto }`, sin
  `position: relative`) y la clase `.solo-lector` del núcleo (posición absoluta). **Sin clave.**
- **Qué pasa:** el encabezado de la columna de acciones es `<th scope="col"><span class="solo-lector">Acción</span></th>`
  (el contrato del estándar). Desde 760 px la tabla es tabla y se desplaza dentro de su marco, pero el `span` absoluto toma
  como referencia la página, no el marco, y queda fuera de él: el documento mide **891 px en 768** (sobran 123; con volumen,
  134) y **895 en 844** (sobran 51). En la tableta, además, el botón fijo «Menú de pruebas» queda a la derecha, fuera de la
  vista (de 757 a 879 px en una pantalla de 768) y no se pudo presionar: es el único estado que no se preparó en el barrido.
- **Consecuencia:** en una tableta la bandeja se puede arrastrar de lado a un margen vacío, o el navegador la muestra
  alejada para que quepa.
- **Evidencia:** `b1/repro.json` («C-02»), `b1/desborde-tableta.json`, `b1/desborde-telH.json`,
  `capturas/b1/desborde/tableta-*.png`, `capturas/b1/repro-C-02-tableta-desplazada.png`.
- **Reproducido:** 2 de 2.
- **Corrección propuesta (en el estándar):** `.tabla-marco { position: relative }` (o `.solo-lector` con `clip-path` y sin
  posición absoluta). Registrar un Pnn para el estándar; en el proyecto no hace falta solución provisional si la bandeja no
  se usa en tableta.

---

## 5. Para decidir (Liber)

| # | Pregunta | Opciones y costo | Recomendación |
|---|---|---|---|
| 1 | ¿Qué hace «Crea tu cuenta» si la persona recarga o sale con datos capturados? (B6-02) | (a) Sólo avisar antes de salir con cambios (`beforeunload`, como la solicitud): S. (b) Borrador del núcleo (`data-borrador`) de los campos no sensibles; contraseñas y foto no se guardan (el estándar las excluye): M. (c) Las dos: M | **(c)**. Antes: «Atrás» o recargar borra todo sin avisar. Después: «Atrás» pregunta «¿Salir sin crear tu cuenta?» y, al volver, una franja ofrece «Recuperar lo que escribiste (sin contraseña ni fotografía)» |
| 2 | ¿Cómo sabe la persona qué versión está usando? (B6-04) | (a) Escribir la versión en el HTML al construir (`<meta name="sia-version">`) y que el distintivo muestre esa: S. (b) Además, comparar con `VERSION` cada cierto tiempo y avisar «Hay una versión nueva: recarga la página» sin perder el borrador: M. (c) Dejarlo así | **(a)** ahora y **(b)** en la etapa 3, cuando la API cambie su contrato con las versiones |
| 3 | Barra del planeador en «Grupos» (B1-01) | (a) Desplazar el control enfocado arriba de la barra: S. (b) Que la barra deje de ser pegajosa cuando mide más de un tercio de la ventana: S. (c) Las dos: S | **(c)**. Antes: con 66 en espera, a 1440 × 900 se ven 55 px de la lista y el foco desaparece bajo la barra. Después: la lista ocupa la ventana y la barra queda al final cuando es alta |
| 4 | Texto de la sesión que terminó (B6-01) | El texto propuesto en B6-01 u otro de Liber | El de B6-01 |

---

## 6. No verificable desde aquí, hipótesis y no confirmado

**No verificable desde aquí:**
- Firefox y WebKit (Safari del iPhone): no se pudieron instalar. Se verifica con P35, en equipos reales.
- Cámara negada en un teléfono real: aquí la cámara se abre con `capture` (la abre el sistema, no el navegador); cómo se
  comporta Android o iOS con el permiso negado sólo se ve en el equipo.
- Lector de pantalla real (los anuncios de la franja del borrador y del rechazo por sesión).
- Una carga interrumpida de verdad: en la prueba los documentos no viajan por la red. Cuando la API reciba los archivos
  (etapa 3) hay que repetir 3a y 3b contra ella, con la red cortada a la mitad de un PDF de 5 MB.
- Las cabeceras de caché de GitHub Pages: el proxy de esta sesión rechazó la consulta (403).

**Hipótesis (no comprobadas):**
- **H1.** En teléfonos Android con poca memoria, abrir la cámara desde el navegador puede hacer que el sistema cierre la
  pestaña y la recargue al volver. Con B6-02, la persona perdería la cuenta capturada justo al tomarse la foto. Se
  comprueba en un teléfono de gama baja.
- **H2.** GitHub Pages sirve los archivos con caché de unos minutos; justo después de publicar, una recarga puede traer HTML y
  scripts viejos con un `VERSION` nuevo (el caso que B6-04 reprodujo con `route`).
- **H3.** Con el envío «Lento» se agota el tiempo de 15 s y la pantalla dice que se detuvo; con la API, el servidor pudo
  haber recibido la solicitud de todos modos, y al reintentar la persona chocaría con «Ya tienes un trámite en curso». Va
  con el contrato de la API (P159).

**No confirmado:** en tableta, el enlace «Retomar la cita de CARLA MODELO EJEMPLO» de la agenda quedó 28 % fuera de la
ventana al enfocarlo con Tab (1 corrida, en 2 estados de `citas.html`); no lo repetí dos veces y no se cuenta. Todo lo
reportado como hallazgo salió 2 de 2.

**Falla de la prueba, no del sistema:** además de B1-06 (que es del proyecto), el primer arranque del barrido se interrumpió (lo detuve para corregir el guion);
el estado `programar.html?curso=poda-renovacion` con volumen y el acuse de la solicitud se repitieron completos en los
tamaños afectados. Al principio, la solicitud de B6 no avanzaba porque el guion no llenaba los estudios ni usaba el
trámite calculado (`poda_renovacion` para esa persona); se corrigió el guion, no hubo falla del sitio.

---

## 7. Pruebas que conviene dejar permanentes

| Prueba | Dónde | Serie |
|---|---|---|
| Recorrido con Tab que mide el foco tapado por elementos fijos o pegajosos (`tabTapados`), en Grupos con volumen a 1440, 768 y 844 × 390 | `guiones/b1-repro.mjs` → `probar-volumen.mjs` | Cada cambio de interfaz |
| «hidden que se ve» también en el grupo cancelado, asistencia con folio y los estados con acciones | `guiones/b1-revisar.mjs` → ampliar `ESTADOS` de `auditar-sitio.mjs` | Cada cambio |
| Barrido en 7 tamaños (360, 390, 430, 844 × 390, 768 × 1024, 1440 × 900 y 720 × 450 a densidad 2) | `guiones/b1-revisar.mjs` + `b1-tabla.mjs` | Cada versión |
| Descubrimiento de estados desde los casos del menú y revisión de cada enlace con `?folio=` y `#` | `guiones/b1-descubrir.mjs` | Cada versión |
| Desborde medido contra `clientWidth` (no `innerWidth`) en teléfono, tableta y horizontal | `guiones/b1-desborde.mjs` → corregir `auditar-sitio.mjs` (B1-06) | Cada cambio |
| Encimados de la fila de asistencia a 360 px y barra de cupo en un grupo cancelado | `guiones/b1-repro.mjs` B1-02, B1-05 | Cada cambio |
| Sesión que caduca a la mitad (solicitud, perfil y documento correcto): mensaje y recuperación | `guiones/b6.mjs` 4a–4c | Cada cambio de la solicitud |
| Recargar, «Atrás» y «Adelante» con el borrador recuperado | `guiones/b6.mjs` 5a | Cada cambio de la solicitud |
| Recargar y «Atrás» en «Crea tu cuenta» | `guiones/b6.mjs` 5b | Al corregir B6-02 |
| Versión nueva con la pestaña abierta (`route` de `VERSION` y de `?v=`) | `guiones/b6.mjs` 7 | Cada versión |
| Sin service worker, sin manifiesto, 0 llamadas a cámara y ubicación, foto sin EXIF | `guiones/b6.mjs` 0, 1a, 2 | Cada versión |

---

## Anexo · Archivos de evidencia

- `linea-base-auditar-sitio/hallazgos.json` y `.log`: la línea base.
- `b1/estados-ficticios.json`, `b1/estados-volumen.json`, `b1/enlaces-*.json`: estados y enlaces descubiertos.
- `b1/avance-<tamaño>.jsonl`: cada estado revisado, con sus hallazgos y botones presionados; `b1/resultado-<tamaño>.json`.
- `b1/tabla-b1.md` y `.json`: **la tabla por pantalla, estado, ancho y perfil**, con su captura.
- `b1/repro.json`, `b6/b6.json`: las dos rondas de cada hallazgo y de cada escenario.
- `capturas/b1/<tamaño>/`: captura de página completa de cada estado con hallazgo y del foco tapado; `capturas/b1/repro-*`;
  `capturas/b6/`.
- `archivos/foto-con-gps.jpg`: la foto de prueba (dibujo, con GPS y modelo inventados en el EXIF).
- `guiones/`: todos los guiones, para repetirse en la próxima auditoría (`BASE=http://localhost:<puerto>/`).
