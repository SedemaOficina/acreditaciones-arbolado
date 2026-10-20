# Auditoría de seguimiento 20/10/2026 · r4 · Tareas, heurísticas, carga y estados (C1 a C4)

Versión de prueba 0.61 más PR #5 (commit `d58c611`), estándar de formularios 1.5.1. Copia `<copia del revisor r4>`,
servida en el puerto 8904. Solo lectura: `git status` de la copia, sin cambios al inicio y al final (sólo el enlace
`node_modules` que trae la copia).

## 1. Qué hice

**Método.**

- **C1, tareas del personal.** Una ficha por pantalla con la pregunta de trabajo, si la pantalla la contesta, los pasos
  y lo que hay que recordar. Cada regla de `docs/REGLAS.md` y `docs/DECISIONES.md` se buscó en la pantalla donde se
  aplica. Todo con el escenario de volumen: 65 por revisar, 41 citas hoy, 112 en espera (66 de poda nueva), grupos de 25.
- **C2, heurísticas de Nielsen** y convenciones de formularios y bandejas. Las 9 pantallas de la persona y las 12 del
  personal, en 390 × 844 y 1440 × 900 (algunas también en 1280 × 900 y 1280 × 720). La matriz de impacto y esfuerzo
  está en la sección 2.5.
- **C3, carga.** 11 tareas recorridas de punta a punta con un guion. En cada estado de la pantalla se cuentan:
  - las palabras visibles, sin la franja ni el menú de pruebas y sin lo que está dentro de un `<details>` cerrado;
  - los campos (un grupo de opciones cuenta como uno), los botones y los enlaces;
  - el alto del documento entre el alto de la ventana.

  Se corrió dos veces en 390 × 844 y una vez en 1440 × 900, como referencia del personal.
- **C4, matriz de estados.** Filtros, búsqueda, día, curso, personas elegidas, semana y persona, cada uno frente a
  «Atrás», recargar, abrir la misma dirección en otro contexto, dos pestañas y cambiar de persona en el menú de pruebas
  con una pantalla abierta.

**Pruebas.**

- Barrido: 37 estados de pantalla en cada tamaño (16 del personal con volumen y 21 de la persona), 74 capturas
  completas y su texto.
- 26 capturas de la primera ventana.
- C3: 13 recorridos × 3 corridas.
- C4: 7 casos × 2 repeticiones, más 1 de la agenda × 2.
- C1: 7 comprobaciones × 2. C2: 2 comprobaciones × 2, más la barra × 3 tamaños × 2.
- Cada hallazgo de comportamiento se reprodujo 2 de 2 en contextos nuevos.
- Línea base: `herramientas/probar-volumen.mjs` contra mi copia, 68 de 68 (`salidas/linea-base-volumen.txt`).

**Herramientas.** Node 22.22, Playwright 1.63 y Chromium 1194 (`/opt/pw-browsers/chromium`), zona
America/Mexico_City. Firefox y WebKit no están disponibles. No hay lector de pantalla real.

**Guiones** (en `guiones/`, se pueden repetir):

| Guion | Qué hace |
|---|---|
| `comun.mjs` | Arnés y medición |
| `barrido.mjs` | Barrido de pantallas |
| `ventanas.mjs` | Capturas de la primera ventana |
| `c1-verifica.mjs` y `c1-renovacion.mjs` | Comprobaciones de las fichas de C1 |
| `c2-barra-planeador.mjs`, `c2-espera-alto.mjs` y `c2-verifica.mjs` | Comprobaciones de C2 |
| `c3-carga.mjs` | Carga por tarea; con `ANCHO=esc`, en escritorio |
| `c3-programar-lista.mjs` | Alto de la lista de «Programar» |
| `c4-estados.mjs` y `c4-citas-pausa.mjs` | Matriz de estados |

Salidas en `salidas/` y capturas en `capturas/` (273 archivos).

**Lo que ya estaba registrado y no se repite.** Leí `AUDITORIA-2026-10-19`, `AUDITORIA-INTEGRAL-2026-10-17` (y su
`A-pantallas-de-la-persona`), `AUDITORIA-TAREAS-2026-10-17` (y `reglas-vs-pantallas`), `AUDITORIA-2026-10-18`, la de
«romperlo», `PENDIENTES.md`, `DECISIONES.md` y `REGLAS.md`. Lo que sigue igual va en la sección 2.6 con su clave.

## 2. Hallazgos

**Totales nuevos: 0 críticos · 0 altos · 6 medios · 14 bajos · 1 informativo.** Además, 1 falla del componente
compartido (sección 4) y 6 registrados que siguen igual (sección 2.6).

### 2.1 Medios

**C1-01 · El planeador ya no dice cuántas personas son prioritarias ni cuántos grupos alcanzan** · Media · S
- **Dónde:** `grupos.html?curso=poda-nueva`, perfil «revisión y cotejo» (arma grupos), 1440 y 390. `app/grupos.js` (planeador desde `f9dd50b`).
- **Qué pasa:**
  - **Esperado:** decir «N esperan 31 días o más» y «Alcanza para N grupos nuevos de hasta 25». Son las correcciones M7 y «31 días o más» de la auditoría de tareas del 17/10, que estaban en `e4fedb3:sitio/app/grupos.js:32` y `:38-40`.
  - **Observado:** el resumen dice sólo «66 personas en espera · 9 grupos activos (por confirmar, confirmados o en curso)». Las 38 prioritarias se marcan una por una en la lista.
- **Consecuencia:** para saber cuántas personas pasan del plazo de prioridad, hay que contar 38 etiquetas en una lista de 66. Para saber cuántos grupos abrir, hay que dividir a mano. Es regresión de dos correcciones de la auditoría de tareas: el planeador del 18/10 las sustituyó.
- **Cómo se reproduce:** abrir `grupos.html?curso=poda-nueva` con el escenario de volumen y buscar «días o más» o «grupos nuevos».
- **Evidencia:** `salidas/c1-verifica.json` (a): `diceCuantasPrioritarias: false`, `diceGruposQueAlcanzan: false`, 66 en espera y 38 prioritarias. Captura `capturas/ventana-grupos-esc.png`.
- **Reproducido:** 2 de 2.
- **Causa probable:** el rediseño en planeador (`f9dd50b`) no trasladó esas dos cifras a la cabeza del curso.
- **Corrección propuesta:**

  | | Cabeza del curso |
  |---|---|
  | Antes | «Poda y derribo · nueva: 66 personas en espera · 9 grupos activos…» |
  | Después | «66 en espera · 38 esperan 31 días o más · alcanzan para 2 grupos nuevos de 25 (además de los 5 que reciben personas)» |

  En el botón de cada curso, junto a «12 vencidas», va «N prioritarias».
- **Listo cuando:** `probar-volumen` lee en el planeador «38 esperan 31 días o más» y «alcanzan para N grupos».
- **Estado:** Abierto (regresión de M7 y de la baja «31 días o más», que el 17/10 se dieron por corregidas).

**C1-02 · «Aplicar el examen» pide comparar a la persona con una fotografía de 48 × 60 px, sin forma de ampliarla** · Media · S
- **Dónde:** `aplicar.html?folio=APD-G-2026-020`, perfil instructor (aplica el examen), 1440 y 390. `app/examen.css:54` (`.examen-foto-lista { width: var(--e-9) }`, 48 px) y `app/aplicar.js:133-134`.
- **Qué pasa:**
  - **Esperado:** el paso 1 de la propia pantalla dice «compare a cada persona con su fotografía y con su identificación oficial», y DECISIONES (17/10, l. 180) dice que la fotografía tiene que verse clara porque quien aplica la usa para confirmar la identidad.
  - **Observado:** la fotografía mide 48 × 60 px en 1440 × 900. No es enlace ni botón, el cursor es normal y un clic no abre nada.
- **Consecuencia:** la comprobación de identidad antes de dar el código del examen se hace con una miniatura. Si se suplanta a alguien, se emite una acreditación a otra persona.
- **Cómo se reproduce:** abrir la dirección indicada, medir `.examen-foto-lista` y hacer clic en ella.
- **Evidencia:** `salidas/c1-verifica.json` (d): `ancho 48, alto 60, esEnlaceOBoton false, trasClic.dialogoAbierto 0`. Captura `capturas/c1-d-aplicar-fila-foto.png`.
- **Reproducido:** 2 de 2.
- **Causa probable:** se reutilizó el tamaño de la lista para la tarea de comparar rostros.
- **Corrección propuesta:**

  | | Fotografía en el pase de lista |
  |---|---|
  | Antes | Miniatura de 48 px |
  | Después | Miniatura de 96 px. Al tocarla, o con «Ver fotografía», se abre a unos 320 px junto al nombre, con «Presente» y «No llegó» al lado, para decidir sin cerrarla |

  Ver «Para decidir» 4.
- **Listo cuando:** una prueba mide la fotografía en 96 px o más y el clic abre la ampliada con los dos botones.
- **Estado:** Abierto.

**C1-03 · En renovación, «primero quien vence antes» no se cumple: los bloques de organización adelantan a quien sigue vigente** · Media · S
- **Dónde:** `grupos.html?curso=poda-renovacion`, quien arma los grupos, 1440. Los bloques de `app/personal.js:365-377` (`bloquesEspera`: el bloque ocupa el lugar de su primera persona) contra el encabezado de `app/grupos.js:171`. La propuesta de «Programar» (`lasQueMasEsperan`, bloques completos) tiene el mismo efecto.
- **Qué pasa:**
  - **Esperado:** el encabezado dice «primero quien vence antes» y DECISIONES:156 dice que en renovación la bandeja ordena por fecha de vencimiento.
  - **Observado:** el bloque de Iztapalapa va primero (5 personas). Cuatro de ellas siguen vigentes (vencen del 19 al 31/10) y quedan por encima de 9 personas con la acreditación ya vencida (23/07, 24/07, 31/07…), que no pueden trabajar mientras esperan.
- **Consecuencia:** en «Programar», la propuesta de hasta 25 toma bloques completos y deja fuera antes a quien ya no puede trabajar. La regla visible no corresponde al orden que se ve.
- **Cómo se reproduce:** abrir el planeador de renovación con volumen y leer las 8 primeras personas.
- **Evidencia:** `salidas/c1-renovacion.json`: «OFELIA… Vencida el 22/07 · RAQUEL… vence el 19/10 · … · WILFRIDO… vence el 31/10 · ZACARIAS… Vencida el 23/07…».
- **Reproducido:** 2 de 2.
- **Causa probable:** chocan dos decisiones: DECISIONES:156 (orden por vencimiento en renovación) y :183 (bloques por adscripción en el lugar de quien más espera).
- **Corrección propuesta:** «Para decidir» 1.

  | | Planeador de renovación |
  |---|---|
  | Antes | Bloque «Iztapalapa · 5» arriba, con vigentes al 31/10 |
  | Después | En renovación, primero quienes ya vencieron (por fecha); la organización como etiqueta en cada persona, o bloques ordenados por su vencimiento más antiguo y, dentro, las vencidas primero |

- **Listo cuando:** una prueba con volumen comprueba que ninguna persona vigente aparece antes que una vencida en el planeador de renovación, y que la propuesta de «Programar» las respeta.
- **Estado:** Decide el dueño.

**C2-01 · En el planeador, la barra fija de «elegidas» tapa el 35 % de la ventana aunque no haya nadie elegido, y propone un destino como botón principal** · Media · S
- **Dónde:** `grupos.html` desde 760 px. `app/apd.css:579` (`.plan-barra { position: sticky; bottom: 0 }`) y `[data-destinos]`.
- **Qué pasa:**
  - **Esperado** (Nielsen 8, diseño minimalista; 1, visibilidad): ver la lista de 66 personas. La barra sólo debería pesar cuando hay elegidas.
  - **Observado:**

    | Ventana | Alto de la barra | Parte de la ventana | Personas visibles | Personas tapadas |
    |---|---|---|---|---|
    | 1440 × 900 | 312 px | 35 % | 8 | 5 |
    | 1280 × 900 | 312 px | 35 % | 7 | 4 |
    | 1280 × 720 | 312 px | 43 % | 5 | 4 |

    Al abrir en 1440 × 900 sólo se ven unos 58 px de la lista. La barra tiene 6 botones de destino y el primero, «Al curso del 26 al 30 de octubre (1 de 25)», es rojo relleno (`.btn-primario`) con «Ninguna elegida». Un clic da «No se agregó a nadie».
- **Consecuencia:** la tarea principal del planeador (ver quién espera y elegir) se hace en un tercio de la pantalla, y el botón principal invita a una acción que no se puede hacer.
- **Cómo se reproduce:** abrir el planeador de poda nueva con volumen y desplazarse a la mitad de la lista.
- **Evidencia:** `salidas/c2-barra-planeador.json`, `salidas/c2-verifica.json` (planeadorPrimario). Capturas `capturas/c2-barra-planeador-1280x720.png` y `capturas/ventana-grupos-esc.png`.
- **Reproducido:** 2 de 2 en cada tamaño.
- **Causa probable:** la corrección M4 (barra que acompaña el desplazamiento) se hizo con los destinos dentro de la barra.
- **Corrección propuesta:**

  | | Barra de elegidas |
  |---|---|
  | Antes | Barra fija de 312 px con 6 destinos, siempre |
  | Después | Sin elegidas, una línea de unos 48 px: «Ninguna elegida · marque personas para agregarlas a un grupo». Con elegidas: «7 elegidas · caben 22 en APD-G-2026-021 · Elegir destino ▾», y los destinos se despliegan. Ningún destino es principal mientras no haya elegidas |

- **Listo cuando:** una prueba en 1280 × 720 mide la barra sin elegidas en 15 % o menos de la ventana y 0 `.btn-primario` en `[data-destinos]` con «Ninguna elegida».
- **Estado:** Abierto.

**C2-02 · «Mis trámites» con grupo: cuándo y a qué hora presentarse queda debajo de «Qué sigue», fuera de la primera pantalla del teléfono** · Media · S
- **Dónde:** `tramites.html`, persona del caso «Con grupo confirmado», 390 × 844 (en 1440 también va después de los pasos).
- **Qué pasa:**
  - **Esperado** (Nielsen 4, consistencia; 1, visibilidad): igual que con la cita, que ya va arriba en un recuadro («Cita de cotejo 20/10/2026, 10:00», a 569 px). Es lo que pidió la auditoría del 17/10 (A, punto 10) para la cita.
  - **Observado:** con grupo, primero «Tu curso dura 5 días» y los 4 pasos de «Qué sigue». La fecha y la hora («Tu curso empezó el 13/10/2026, a las 09:00») quedan a 1,092 a 1,108 px y el lugar del examen más abajo. La primera pantalla del teléfono termina a los 844 px.
- **Consecuencia:** la persona tiene que desplazarse para saber cuándo y a qué hora se presenta, que es la pregunta principal en ese momento del trámite. Para la cita y para el grupo, el mismo dato tiene lugares distintos.
- **Cómo se reproduce:** entrar con el caso «Con grupo confirmado» en 390 × 844.
- **Evidencia:** `salidas/c3-carga-tel-r1.json` y `-r2.json` (mis-tramites-grupo: `fechaY 1108`, ventana 844; mis-tramites-cita: `citaY 569`). Captura `capturas/c3-mis-tramites-grupo-1-tel-r1.png`.
- **Reproducido:** 2 de 2.
- **Causa probable:** los pasos de «Qué sigue» que agregó la alta 11 del 17/10 se pusieron antes de los datos.
- **Corrección propuesta:**

  | | Ficha con grupo |
  |---|---|
  | Antes | Etiqueta · «Tu curso dura 5 días» · Qué sigue (4 pasos) · fechas |
  | Después | Etiqueta · recuadro «Tu curso: del 13 al 17/10/2026, a las 09:00 · Aula de capacitación del Vivero · examen el 17/10 en el PILARES» · Qué sigue |

- **Listo cuando:** una prueba en 390 × 844 encuentra la fecha y la hora del grupo arriba de 844 px.
- **Estado:** Abierto.

**C4-01 · Bandeja de revisión: los filtros se pierden al volver con «Atrás» y al recargar** · Media · S
- **Dónde:** `revision.html`, perfil «revisión y cotejo», 390 y 1440. `app/revision.js:75-97`: los filtros no van en la dirección y los `<select>` tienen `autocomplete="off"`.
- **Qué pasa:**
  - **Esperado** (convención de bandejas de trabajo; Nielsen 3 y 6): igual que «Citas», que conserva el día en `?dia=` (corrección B8 del 18/10). Al volver de una revisión, la bandeja sigue con el filtro.
  - **Observado:** con «Dictaminador técnico» y «Renovaciones», la bandeja muestra 6 de 65. Se abre una solicitud y se regresa con «Atrás»: los filtros quedan en «Todas» y se ven las 65. Lo mismo al recargar.
- **Consecuencia:** quien revisa por tipo tiene que volver a poner los filtros después de cada solicitud: 6 veces en este ejemplo, 2 selecciones cada vez. Además puede tomar por error una solicitud de otro tipo.
- **Cómo se reproduce:** el caso A de `guiones/c4-estados.mjs`.
- **Evidencia:** `salidas/c4-estados.json` (A-bandeja-tel y A-bandeja-esc): `con.visibles 6`, `atras.tipo ""`, `atras.visibles 65`, `recarga.tipo ""`. Captura `capturas/c4-A-bandeja-filtrada-tel.png`.
- **Reproducido:** 2 de 2 en cada tamaño.
- **Causa probable:** el estado de los filtros vive sólo en el formulario.
- **Corrección propuesta:**

  | | Dirección de la bandeja |
  |---|---|
  | Antes | `revision.html` |
  | Después | `revision.html?tipo=dictaminador&modalidad=renovacion`, con `history.replaceState` como en «Citas». Al cargar, los filtros se leen de la dirección |

- **Listo cuando:** filtrar, abrir una solicitud y volver con «Atrás» muestra las mismas 6, y recargar también.
- **Estado:** Abierto.

### 2.2 Bajos

| Clave | Dónde | Qué pasa (esperado contra observado) | Evidencia y reproducción | Corrección propuesta (antes → después) | Listo cuando |
|---|---|---|---|---|---|
| **C1-04** | `revisar.html` de una reenviada (APD-S-2026-00047), 1440. `revisar.html:52` | Lo que se observó antes («El comprobante de domicilio tiene más de tres meses…») está sólo en el plegado «Revisiones anteriores», cerrado al abrir. Junto al documento corregido sólo dice «Corregido para esta revisión». Para comprobar que se corrigió lo pedido, quien revisa abre el plegado, lo lee, lo recuerda y regresa al documento | `salidas/c1-verifica.json` (c): `plegadoAbierto false`, `laTrae false`. Captura `c1-c-reenviada.png`. 2 de 2 | Debajo de «Corregido para esta revisión» va «Se le pidió: …» con el texto de la vuelta anterior | El bloque del documento corregido contiene el texto de su observación anterior |
| **C1-05** | `asistencia.html?folio=APD-G-2026-024`, instructor, 390. `app/asistencia.js:104` | El aviso «Falta capturar el día 2 (13/10)» dice «Ábralo en «Corregir otro día»», que está plegado a 1,945 px (con 8 personas; con 25 queda más abajo). El aviso no trae ni enlace ni botón | `salidas/c1-verifica.json` (e): `avisoY 718`, `corregirY 1945`, `avisoTieneEnlace 0`, plegado. 2 de 2 | En el aviso, un botón «Capturar el día 2» que abre `?dia=2` | El aviso tiene un enlace a `asistencia.html?folio=…&dia=2` |
| **C1-06** | `aplicar.html?folio=APD-G-2026-020`, quien aplica el examen | «Otros grupos en curso» enlaza al grupo 006 con el texto «Poda nueva · del 10 al 14 de octubre (examen el 14/10/2026)», igual al nombre del grupo en pantalla (020). Los dos presentan hoy y no se distinguen | `salidas/c1-verifica.json` (d, `otros` y `titulo`). 2 de 2 | Antes: «Poda nueva · del 10 al 14 de octubre (examen el 14/10/2026)». Después: «… · APD-G-2026-006 · 5 personas» cuando dos nombres coinciden | No hay dos enlaces o títulos con el mismo texto en la pantalla. Se liga con P149 |
| **C1-07** | `citas.html` y `cotejo.html` al cierre del día, 1440 | No hay filtro por situación ni forma de registrar juntas a quienes no se presentaron. Cada inasistencia toma 6 acciones (Atender, «No se presentó», fecha, hora, Registrar y volver a la agenda) entre 41 filas | Recorrido de `c3-carga.mjs` (registrar-cotejo) y lectura de `app/citas.js`. Se cuentan las acciones, no hay comportamiento que reproducir | Ver «Para decidir» 2 | Hay un filtro «Por atender» en la agenda, o la acción en bloque |
| **C4-02** | `revision.html`, 390 y 1440 | La cuenta filtrada dice «Se muestran 6 de 65 solicitudes: 2 con 10 días o más…», sin decir qué filtros. En teléfono los filtros están plegados bajo «Filtrar (2 activos)» | `salidas/c4-estados.json` (A, `con.cuenta` y `con.boton`). 2 de 2 | Antes: «Se muestran 6 de 65 solicitudes». Después: «6 de 65 · dictaminador técnico, renovaciones · Quitar filtros» | La cuenta nombra cada filtro activo |
| **C4-03** | `citas.html`, 1440 | La búsqueda («APD-S-2026-0057», 10 citas en todos los días) se pierde con «Atrás» desde el cotejo y al recargar. El día sí se conserva | `salidas/c4-estados.json` (B, `atras.buscar ""`). 2 de 2 | `?q=` en la dirección, como `?dia=` | Buscar, atender y volver con «Atrás» conserva la búsqueda |
| **C4-04** | `grupos.html?curso=poda-renovacion`, 1440 | Con 3 personas elegidas, «Atrás» desde la ficha de un grupo las conserva, pero al recargar o en otra pestaña queda «Ninguna elegida» | `salidas/c4-estados.json` (C). 2 de 2 | Guardar las elegidas por curso en `sessionStorage`, o avisar al salir con personas elegidas | Recargar conserva las elegidas |
| **C4-05** | `revision.html` en dos pestañas, 1440 | Después de validar APD-S-2026-00533 en la pestaña B, la A sigue diciendo «65 solicitudes por revisar…» y muestra la fila, aun al volver a ella. Al abrirla dice «Ya registró la revisión», que es correcto. «Citas de cotejo» sí se actualiza sola (`APD.alCambiar`, `app/citas.js:150`); la bandeja no | `salidas/c4-estados.json` (E). Captura `c4-E-revisada-en-otra-pestana.png`. 2 de 2 | `APD.alCambiar` también en la bandeja (y en el planeador) | Al volver a la pestaña, la cuenta dice 64 y la fila ya no está |
| **C4-06** | `tramites.html` en dos pestañas, 390 | Con la pestaña A en «Mis trámites» de ROSA, en la B se entra como SERGIO con el menú de pruebas. Al volver a la A sigue diciendo ROSA, con sus solicitudes. Su enlace «Corrige…» abre una página con la cabecera de SERGIO y «No encontramos la solicitud APD-S-2026-00041 entre tus trámites». No se muestra nada de otra persona | `salidas/c4-estados.json` (F). Captura `c4-F-enlace-de-X-con-sesion-Y.png`. 2 de 2 | Al volver a la pestaña (`APD.alCambiar`), si cambió la sesión: «Tu sesión cambió en otra pestaña», el mismo texto que ya usan la solicitud y «Mi perfil» | La pestaña vieja muestra el aviso al recibir el foco |
| **C4-07** | `grupo.html?folio=APD-G-2026-020` (en curso, día 5), 1440 | La lista «Personas del grupo» dice «Situación: Inscrita» a las 25. El concentrado de la misma ficha marca 4 «Sin derecho» | `salidas/c1-verifica.json` (h). 2 de 2 | En la lista, la situación de cada persona: «Sin derecho a examen» a esas 4 | La situación de la lista y la del concentrado coinciden |
| **C4-08** | `citas.html` (hoy, volumen), 1440 | El encabezado dice «41 citas: 41 por atender.», pero una fila dice «En pausa · esperando el documento» | `salidas/c4-citas-pausa.json`. 2 de 2 | Antes: «41 citas: 41 por atender». Después: «41 citas: 40 por atender, 1 en pausa» | El desglose suma igual que las situaciones de las filas |
| **C3-01** | `programar.html?curso=poda-nueva`, 390 y 1440 | «¿Quiénes van?» lista a las 66 personas con su casilla (25 marcadas). La lista ocupa 6,738 de 10,493 px en teléfono (64 %) y 5,183 de 7,490 en escritorio (69 %). La pantalla tiene 79 campos | `salidas/c3-programar-lista.json` y `salidas/c3-carga-tel-r1.json` (programar). 2 de 2 | Antes: 66 filas, 12.4 pantallas en teléfono y 8.3 en escritorio. Después: las 25 propuestas, y «Cambiar a quiénes van (41 más en espera)» plegado. Se estiman 7.5 y 4.7 pantallas y unos 27 campos (cálculo proporcional, sección 6) | La lista abre con las propuestas y el resto plegado |
| **C3-02** | `solicitud.html`, paso 2 (y «Cargar el documento correcto») | «Formato admitido: PDF. Un archivo de hasta 5 MB.» se repite en cada documento: 4 veces en poda y 7 en dictaminador (36 y 63 palabras). La bajada del paso ya lo dice | Capturas `c3-solicitud-poda-4-tel-r1.png` y `c3-solicitud-dictaminador-4-tel-r1.png` | Antes: 9 palabras por documento. Después: «PDF, hasta 5 MB» con `mensajes.archLimiteUno` del proyecto (el estándar lo permite, `formkit/modulos/archivos/archivos.js:319`) | 4 palabras o menos por zona de carga |
| **C3-03** | `solicitud.html`, paso 3 | «No soy un programa automático» se vuelve a pedir en cada solicitud, con la sesión ya abierta. Ya se marcó al crear la cuenta y la página tiene una trampa oculta (`data-trampa`, como `entrar.html:49`) | `solicitud.html:606`. Captura `c3-solicitud-poda-6-tel-r1.png` | Quitarla de la solicitud: 1 control y 13 palabras menos. Ver «Para decidir» 3 | El paso 3 tiene 3 casillas, no 4 |

### 2.3 Informativo

- **C3-04.** En «Aplicar el examen», el pase de lista de 21 personas con derecho son 21 clics, uno por persona: la lista
  se vuelve a pintar después de cada uno. Ocupa 12.8 pantallas en teléfono y 8.7 en escritorio. Es lo que se diseñó:
  cada «Presente» es una comprobación de identidad. Sólo cuenta como carga. Quedó un atajo «todas presentes» en el menú
  de pruebas, que no existe en producción.

### 2.4 Fichas de C1: una por pantalla del personal (escenario de volumen)

| Pantalla y perfil | Pregunta de trabajo | ¿La pantalla la contesta? | Pasos para contestarla | Lo que hay que recordar | Hallazgos |
|---|---|---|---|---|---|
| Solicitudes por revisar · revisión y cotejo | ¿Cuál reviso ahora y cuántas se me están atrasando? | Sí: van por antigüedad; arriba, «65 solicitudes por revisar: 26 con 10 días o más y 22 de 3 a 9 días» | 0 para la siguiente; 2 selecciones para filtrar | Los filtros, cada vez que vuelve de una solicitud | C4-01, C4-02, C4-05; ya registrado: sin filtro por espera |
| Revisar una solicitud · revisión y cotejo | ¿Cumple? ¿Qué le pido corregir? ¿Qué día le doy la cita? | Sí: visor, decisión por documento; la fecha de la cita dice el rango (del … al …) y la carga del día y la hora | 1 por documento, 2 para la cita y Registrar | En 2.ª vuelta, qué se había observado | C1-04 |
| Citas de cotejo · revisión y cotejo | ¿A quién atiendo ahora y quién no vino? | En parte: por hora, con situación, aviso de días atrasados y búsqueda en todos los días. No distingue una 2.ª cita ni la de falta de pago | 1 por cita; 6 por inasistencia al cerrar el día | Quién viene por segunda vez (si falta, se cierra) | C1-07, C4-03, C4-08; ya registrado: 2.ª cita |
| Atender una cita · revisión y cotejo | ¿Es la persona? ¿Coincide lo que trae? ¿Pagó? | Sí: muestra cada pregunta sólo cuando hace falta; dice la 2.ª inasistencia, la pausa vencida y que el expediente se abre al terminar | 13 acciones con factura | Nada | — |
| Grupos (planeador) · quien arma grupos (P92) | ¿Cuántos grupos abro, con quiénes y cuándo, para que nadie espere de más? | En parte: lista, semanas y «su grupo» de cada organización. No dice cuántas son prioritarias ni cuántos grupos alcanzan. En renovación, el orden no es el que anuncia | Contar 38 etiquetas; dividir 66 entre 25 | Cuántas prioritarias hay; las elegidas, si recarga | C1-01, C1-03, C2-01, C4-04 |
| Programar un curso · quien arma grupos | ¿Qué semana, con quién y quiénes van? | Sí: calendario con 7 días y un año, instructor «libre esas fechas», propuesta de 25 | 5 acciones | Nada; la semana, el instructor y la hora sobreviven a la recarga | C3-01 |
| Ficha del grupo · quien arma grupos | ¿Cómo va este grupo y qué le falta? | Sí: «18 de 25 personas. Recibe personas hasta el 25/10/2026; quedan 7 lugares»; en curso, el concentrado | 0 | Nada | C4-07 |
| Asistencia · instructor | ¿Quién vino hoy y quién está en riesgo? | Sí: tira de días, «Ya no puede faltar», resumen junto a «Guardar», «Marcar a todas «Asistió»» y aviso del día sin capturar | 3 acciones por día | Dónde se captura el día que faltó | C1-05 |
| Aplicar el examen · quien aplica | ¿Es la persona? ¿A quién le falta código? ¿Cómo va el examen? | En parte: cuenta («25 inscritas, 21 con derecho…»), avance y reposición. La comparación de identidad se hace con una miniatura | 1 por persona (21) | Cuál de los dos grupos «del 10 al 14 de octubre» es cuál | C1-02, C1-06, C3-04 |
| Material de estudio (personal) · quien administra el material | ¿Qué ve hoy el público y está al día? | Sí: «3 documentos: 3 publicados», con fecha de carga, vigencia y páginas de cada uno | 0 | Nada | — |
| En espera (`espera.html`) | — | Sólo lleva a Grupos con el mismo curso o grupo (verificado en `probar-volumen`) | — | — | — |

**Reglas, visibles donde se aplican.** Salvo lo anotado en C1-03, C1-07 y lo ya registrado, las reglas comprobadas se
ven donde se aplican:

| Regla | Dónde se ve |
|---|---|
| Plazos de color de la bandeja | Cuenta y leyenda |
| Mínimo de 10 caracteres de una observación | Ayuda |
| Rango de la fecha de la cita (desde mañana, hasta 6 meses) | Ayuda |
| Carga de citas del día y la hora | Al fijar la cita |
| 2.ª inasistencia | Al atenderla |
| Pausa vencida | Agenda y cotejo |
| Expediente al terminar | Cotejo |
| Mínimo 5, máximo 25 | Pie de Grupos y cada grupo |
| 7 días de anticipación y 1 año | Calendario |
| Instructor ocupado | Lista de instructores |
| «Su grupo» de una organización | Bloque y «Programar» |
| Hasta cuándo recibe un grupo confirmado | Ficha |
| 4 de 5 días | Asistencia y aplicar |
| Día sin capturar | Asistencia y aplicar |
| Examen el último día | Aplicar |
| Calificación mínima | Aplicar |

### 2.5 Matriz de impacto y esfuerzo (C2 y C4; también C1 y C3)

| | Esfuerzo S (≤ 2 h) | Esfuerzo M (≤ 1 día) |
|---|---|---|
| **Impacto alto** (tarea principal, riesgo de error o de trámite) | C1-02 foto de 48 px · C1-03 orden de renovación · C4-01 filtros perdidos · C2-02 fecha del grupo bajo el pliegue · C1-01 cifras perdidas del planeador · C2-01 barra fija | — |
| **Impacto medio** (pasos y memoria de más) | C1-04 observación anterior · C1-05 enlace al día faltante · C4-02 cuenta sin filtros · C3-02 formato repetido · C3-03 casilla de robot | C3-01 lista de 66 en «Programar» · C1-07 cierre del día |
| **Impacto bajo** (acabado y casos raros) | C1-06 nombres iguales · C4-03 búsqueda de citas · C4-04 elegidas al recargar · C4-05 bandeja vieja · C4-06 pestaña vieja · C4-07 situación contra concentrado · C4-08 pausa contada como por atender · FC-01 «Abre cada bloque» | — |

Heurística de Nielsen por hallazgo:

| Hallazgo | Heurística |
|---|---|
| C2-01 | 8 (minimalista) y 5 (prevención de errores: principal sin elegidas) |
| C2-02 | 4 (consistencia) y 1 (visibilidad) |
| C4-01 y C4-03 | 3 (control y libertad) y 6 (reconocer antes que recordar) |
| C4-02 | 1 (visibilidad del estado) |
| C4-05 y C4-06 | 1 (visibilidad del estado) |
| C4-07 y C4-08 | 4 (consistencia) |
| C1-02 | 2 (relación con el mundo real: la tarea es comparar un rostro) |
| C1-04 | 6 (reconocer antes que recordar) |
| C1-05 | 7 (eficiencia) y 6 |
| C1-06 | 4 |
| C3-01, C3-02 y C3-03 | 8 |
| FC-01 | 4 |

### 2.6 Ya registrados que siguen igual (no se cuentan como nuevos)

| Clave | Qué | Estado comprobado hoy |
|---|---|---|
| AUDITORIA-TAREAS 17/10, `reglas-vs-pantallas` §3 (fila «Cita nueva una sola vez» y «por falta de pago», PARCIAL) | La agenda no distingue una 2.ª cita (si falta, la solicitud se cierra) ni la de falta de pago | **Sigue**, 2 de 2: APD-S-2026-00050 y APD-S-2026-00051 se ven «Por atender», como cualquier otra (`salidas/c1-verifica.json` b; capturas `c1-b-agenda-*.png`). Propuesta del 17/10: «2.ª cita · si no viene se cierra» |
| `reglas-vs-pantallas` §1 (filtro «Espera: en rojo / en ámbar») y M8 | La bandeja cuenta las atrasadas (corregido) pero no deja filtrarlas | **Sigue**: los 3 filtros son acreditación, nueva o renovación y vuelta |
| `reglas-vs-pantallas` §3 y P69 | La agenda no cuenta las citas por hora | **Sigue**: «41 citas: 41 por atender», sin subtotal por hora |
| P122 (M11) | Dos revisoras pueden abrir la misma solicitud | Etapa 3; en la prueba, la segunda ve «Ya registró la revisión» (C4 E) |
| P132 | No hay contacto de la Secretaría en las pantallas de la persona | Sigue |
| P144 | «Paga los derechos» en «Mis trámites» (debe ser «cuota») | Sigue (captura `c3-mis-tramites-cita-1-tel-r1.png`) |

Aceptado por el dueño y no se reporta: la bandeja de 31.6 pantallas en teléfono (pantallas del personal «para
computadora», DECISIONES 17/10, l. 23); «Confirma tu correo» (DECISIONES:89); el borrador de la solicitud por persona;
la marca de prioritaria a los 31 días.

## 3. Verificado sin hallazgos

- **Sin desborde horizontal** en los 74 estados del barrido (390 y 1440) ni en las tareas de C3, y **0 errores de consola**.
- **`probar-volumen`:** 68 de 68 contra mi copia. Siguen corregidos A1, A2, A3, A5, M1, M2, M3, M4, M5, M6, M8, M9 y M10 de la auditoría de tareas.
- **«Mis trámites» con cita:** la cita va arriba, a 569 px en teléfono. Corrige el «a 1,400 px» del 17/10.
- **«Citas»:** el día se conserva con «Atrás», al recargar y al abrir la dirección en otro contexto. La búsqueda dice «Resultados en todos los días» y pone la fecha en la columna (2 de 2).
- **«Programar»:** semana (`?semana=`), instructor, hora y las 23 personas marcadas sobreviven a la recarga (B5-02 corregido, 2 de 2).
- **Dos pestañas:** abrir en la A una solicitud ya revisada en la B dice «Ya registró la revisión…» y no deja revisarla otra vez (2 de 2).
- **Cambio de persona:** un enlace viejo nunca muestra la solicitud de otra persona (2 de 2).
- **Asistencia:** `?dia=` abre ese día («Corregir el día 1 de 5»). Sin `?dia=`, abre el día de hoy (2 de 2).
- **Reglas visibles:** las de la tabla de la sección 2.4.
- **Carga de las tareas cortas:** verificar (2 estados, 155 palabras, 1.9 pantallas) y entrar (90 palabras, 1.5 pantallas). Sin propuesta.

**Tabla de carga por tarea (C3, 390 × 844, corrida 1; la 2 es igual con ±5 palabras).** Las palabras son la suma de los
estados que la persona lee. «Desplazamiento» es la suma de alto entre ventana de esos estados.

| Tarea | Pantallas | Estados | Palabras | Campos · botones · enlaces | Desplazamiento | Acciones | Escritorio 1440 (desplazamiento) |
|---|---|---|---|---|---|---|---|
| Crear cuenta (desde el inicio) | 2 | 4 | 1,190 | 30 · 10 · 17 | 14.0 | 16 | 10.1 |
| Solicitud nueva de poda | 2 | 7 | 1,376 | 8 · 49 · 33 | 18.6 | 13 | 14.5 |
| Solicitud de dictaminador | 2 | 7 | 1,944 | 12 · 61 · 33 | 24.3 | 19 | 18.4 |
| Corregir observaciones (1 documento) | 2 | 5 | 1,231 | 4 · 33 · 31 | 15.0 | 7 | 11.8 |
| Consultar «Mis trámites» (cita / grupo / por vencer) | 1 | 1 | 204 / 207 / 97 | 0 · 1 · 3–5 | 2.9 / 2.7 / 2.0 | 0 | 2.2 / 2.0 / 1.7 |
| Verificar una acreditación (desde el inicio) | 2 | 3 | 526 | 2 · 2 · 10 | 6.3 | 3 | 4.8 |
| Revisar una solicitud (bandeja de 65) | 2 | 5 | 2,239 | 19 · 18 · 101 | 47.9 (bandeja 31.6) | 8 | 16.8 |
| Registrar un cotejo (agenda de 41) | 2 | 6 | 2,602 | 29 · 21 · 84 | 41.0 (agenda 16.1) | 13 | 22.7 |
| Programar un grupo | 3 | 4 | 3,159 | 233 · 80 · 51 | 41.1 | 5 | 25.1 |
| Capturar asistencia (8 personas) | 1 | 4 | 1,347 | 24 · 6 · 32 | 11.0 | 3 | 7.8 |
| Aplicar el examen (25 inscritas, 21 con derecho) | 1 | 3 | 1,704 | 0 · 86 · 24 | 26.3 | 22 a 26 | 8.7 |

Detalle por estado: `salidas/c3-detalle-tel.txt` y `salidas/c3-carga-*.json`. Capturas `capturas/c3-*`. Lo que sobra va
en C3-01, C3-02, C3-03 y C2-02.

## 4. Fallas del componente compartido (estándar 1.5.1)

**FC-01 · El módulo de revisión pinta los bloques abiertos y la plantilla del estándar dice «Abre cada bloque»** · Baja · S · sin clave
- **Dónde:** el módulo abre cada bloque (`formkit/modulos/revision/revision.js:39`, `det.open = true`). La plantilla del estándar dice «Abre cada bloque para ver lo que capturaste» (`estandares-sia-151/formularios/codigo/plantillas/por-pasos.html:294`, y la guía visual `guia-visual/artefacto.html:5772`). El proyecto lo copió en `solicitud.html:590`.
- **Qué pasa:** en el paso 3 de la solicitud, los bloques «Trámite» y «Documentos» ya están abiertos (flecha hacia arriba). El texto pide abrirlos (Nielsen 4).
- **Evidencia:** capturas `c3-solicitud-poda-6-tel-r1.png` y `c3-solicitud-dictaminador-6-tel-r1.png`.
- **Corrección:** en el estándar, «Revisa lo que capturaste; «Editar» te lleva al campo». En el proyecto, el mismo cambio en `solicitud.html:590`.
- **Estado:** falla del componente compartido. Registrar un Pnn para el estándar.

Siguen sin cambio, sin efecto nuevo en estas cuatro auditorías: P152 a P158, P166 y P171.

## 5. Para decidir

| # | Pregunta | Opciones y costo | Recomendación |
|---|---|---|---|
| 1 | Orden de la espera de renovación (C1-03): chocan DECISIONES:156 (por vencimiento) y :183 (bloques por organización) | (a) En renovación, sin bloques: orden estricto por vencimiento y la organización como etiqueta, S. (b) Bloques ordenados por el vencimiento más antiguo de cada uno y, dentro, primero las vencidas; la propuesta de «Programar» toma primero a las vencidas aunque parta un bloque, S. (c) Dejarlo y cambiar el encabezado a «agrupadas por organización», S | **(b):** conserva los grupos por organización y no deja esperando a quien ya no puede trabajar |
| 2 | Cierre del día de citas (C1-07) | (a) Filtro «Por atender» en la agenda, S. (b) «Registrar inasistencias del día»: lista con casillas, la cita nueva propuesta y una confirmación, M. (c) Nada | **(a) ahora** y (b) con P69 (horarios), en la etapa 3 |
| 3 | «No soy un programa automático» en la solicitud (C3-03) | (a) Quitarla de la solicitud (hay sesión) y dejarla en la cuenta, S. (b) Quitarla de las dos y confiar en la trampa más el límite de intentos del servidor, S. (c) Dejarla | **(a)** |
| 4 | Fotografía en el pase de lista (C1-02) | (a) Miniatura de 96 px y ampliación a unos 320 px con «Presente» y «No llegó» al lado, S. (b) Columna de fotografía más ancha en escritorio, sin ampliación, S | **(a):** sirve igual en el teléfono del instructor |

## 6. No verificable desde aquí, hipótesis y no confirmado

- **No verificable:**
  - Firefox y WebKit (la red bloqueó su descarga).
  - Lector de pantalla real y recorrido sólo con teclado (P34).
  - Teléfonos reales (P33).
  - Si 48 px bastan con una fotografía real del PILARES y una identificación en la mano. Se recomienda probarlo en la sesión de P33 a P35.
- **Hipótesis:**
  - En monitores de 1366 × 768, frecuentes en oficinas de gobierno, la barra de C2-01 ocuparía unos 41 % de la ventana (312 entre 768). No se midió en ese tamaño.
  - Las cifras «después» de C3-01 se estimaron en proporción a la lista: 25 de 66 filas. No hay prototipo que las mida.
  - Cuántas inasistencias hay en un día real (C1-07): depende de la operación.
- **No confirmado:** nada. Todos los hallazgos de comportamiento salieron 2 de 2.
- **Falla de la prueba, no del sistema:**
  - En una corrida de C3, «revisar» falló porque se marcó una casilla mientras la página avanzaba al siguiente documento. Se corrigió con reintentos y las corridas siguientes salieron bien.
  - En otra, «Aplicar el examen» falló porque la lista se vuelve a pintar después de cada «Presente». Se corrigió releyendo el botón.

  Sólo cuentan las corridas completas.
- **Límite del método:** el conteo de palabras toma el texto visible en la página completa, no sólo la primera ventana. El contenido de un `<details>` cerrado se excluyó: Chromium le da tamaño aunque no se vea, lo que en la primera corrida inflaba el inicio a 1,560 palabras; la cifra corregida es 371.

## 7. Pruebas que conviene dejar permanentes

| Prueba | Base | Serie |
|---|---|---|
| Filtros de la bandeja y búsqueda de citas en la dirección; «Atrás» y recarga los conservan (C4-01, C4-03) | `guiones/c4-estados.mjs` (A y B) | Cada cambio |
| El planeador dice cuántas prioritarias y cuántos grupos alcanzan (C1-01) | `guiones/c1-verifica.mjs` (a), a `probar-volumen` | Cada cambio |
| En renovación, ninguna vigente antes que una vencida, en el planeador y en la propuesta de «Programar» (C1-03) | `guiones/c1-renovacion.mjs` | Cada cambio |
| Barra del planeador sin elegidas en 15 % o menos de la ventana en 1280 × 720, sin botón principal (C2-01) | `guiones/c2-barra-planeador.mjs` | Cada cambio |
| «Mis trámites»: la fecha de la cita y la del grupo en la primera pantalla del teléfono (C2-02) | `guiones/c3-carga.mjs` (`posicion`) | Cada cambio |
| Fotografía del pase de lista de 96 px o más y ampliable (C1-02) | `guiones/c1-verifica.mjs` (d) | Cada versión |
| Encabezado de la agenda igual a la suma de las situaciones de sus filas (C4-08) | `guiones/c4-citas-pausa.mjs` | Cada versión |
| Presupuesto de carga por tarea: falla si una tarea sube más de 10 % de palabras, controles o desplazamiento contra la tabla de la sección 3 | `guiones/c3-carga.mjs` | Cada versión |
