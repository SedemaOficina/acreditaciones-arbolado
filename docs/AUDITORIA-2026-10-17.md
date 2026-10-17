# Auditoría completa · 17/10/2026

Revisión completa antes de seguir con la etapa 2 (pedida por Liber): funcionamiento de todas las pantallas, diseño en
teléfono y escritorio, código y archivos sin uso, pruebas, pendientes, mapa del trámite y documentación. Versión de
prueba 0.33 → 0.34, Estándar de formularios del SIA 1.3.1.

## Resultado

| Revisión | Cómo | Resultado |
|---|---|---|
| Recorrido de todas las pantallas | `herramientas/auditar-sitio.mjs` (nueva, `npm run auditar`): 20 estados × teléfono y escritorio | Sin errores de consola, recursos que no cargan, enlaces o anclas rotos, ids repetidos ni referencias ARIA rotas; sin desborde horizontal ni textos recortados; ningún objetivo táctil menor de 24 px ni control menor de 44 px |
| Botones | Cada botón visible se presiona en una página recién cargada y se comprueba que algo cambie | 117 botones presionados: todos hacen algo. «Ir al contenido» se probó con el teclado |
| Elementos encimados | Comparación de las cajas visibles, recortadas por sus contenedores | Uno real (lista del combo abierta al retomar un borrador), corregido. Queda el botón flotante «Menú de pruebas» sobre el contenido, propio de la versión de prueba |
| Diseño, a ojo | Revisión independiente de las 40 capturas | 52 observaciones (3 altas, 12 medias, 37 bajas): corregidas las altas y las medias que dependían del proyecto; tres van al estándar (P102 a P104) |
| Pruebas | Base, esquemas, sitio con axe, examen con axe | 160 de 160 · 93 de 93 · 452 de 452 · 54 de 54 |
| Estilos y campos | `auditor-css` y `auditar-campos` del estándar | 0 hallazgos · 8 formularios correctos |
| Pendientes, mapa y documentación | Revisión independiente contra el código y la base | 55 hallazgos (11 altos), corregidos salvo los que piden decisión |
| Privacidad | Búsqueda de datos reales en el repositorio y el mapa | Sin datos personales reales |

## Lo que se corrigió

**Funcionamiento**
- La lista del combo de carreras quedaba abierta al retomar un borrador y tapaba la pregunta siguiente: el combo del
  estándar abre su lista con cualquier cambio, aunque la persona no esté en el campo. `APD.avisa` la cierra (hallazgo P99
  para el estándar).
- El dato interno «Curso que corresponde» dejó de verse en la versión de prueba al pasar al estándar 1.3.1; se repuso y
  ahora lo cubre una prueba.
- Dos archivos usaban el mismo nombre global `APD_PERFIL` («Mi perfil» y la regla del perfil académico); la regla pasó a
  `APD_PERFIL_ACADEMICO`.
- En computadora, el botón «Menú de pruebas» tapaba la parte de abajo del visor fijo: el visor termina arriba del botón.
- «Mis trámites» decía que la persona vería después cuándo recoger su credencial; ahora dice que la recoge el mismo día
  del examen.
- Los catálogos de empresas y carreras vuelven a llevar su fuente, corte y aviso de ficticios (`{filas, fuente, corte,
  es_ficticio}`, P37).

**Base de datos**
- Mensajes y comentarios que todavía decían que en la cita se toma otra fotografía; mensajes al personal en tú pasados a
  usted; «Mis datos» → «Mi perfil»; cupo 5–25 en un comentario; ejemplo de nombre de archivo con nombre ficticio.
- La exportación de los ficticios cambiaba los ids de organizaciones y carreras en cada corrida: ahora son estables.

**Código y archivos sin uso**
- Se quitaron dos reglas CSS sin uso, las dos hojas viejas del distintivo de versión, cuatro capturas que ya no genera
  ninguna prueba y una comprobación que ya no medía nada (campo `sin_segundo_apellido`).
- No hay funciones definidas sin usar ni archivos del sitio sin referencia. Las maquetas se conservan: son el registro de
  diseño de cada pantalla aprobada.

**Pendientes, mapa y documentación**
- Pendientes: P78, P13 y P101 resueltos (el 17/10 Liber aprobó el funcionamiento del examen); P57 se unió a P91 y P48 a
  P10; textos actualizados de P02, P04, P07, P10, P27, P55 y P79; P15 pasa al SIA. Nuevos: P99, P102, P103 y P104 para
  el estándar, y P100 (cómo se actualiza una fotografía confirmada). El tablero ya distingue «antes del lanzamiento».
- Mapa: reglas de grupos del 17/10 (mezcla libre, 7 días de anticipación, agregar hasta el día anterior), envío (R57),
  lanzamiento con correo, entrega el mismo día, fotografía, P94 como pendiente, encabezado y ciclos.
- Documentación: LEEME, DECISIONES (decisiones sustituidas tachadas, correcciones a los lineamientos), REGLAS,
  DECISIONES-SIA, ETAPA-1, ETAPA-2 y AVISOS-POR-CORREO al día.

## Lo que queda para decidir

- **P100** · cómo se actualiza una fotografía ya confirmada (recomendación: al iniciar una renovación).
- **P94** · dónde se registra la asistencia del último día.
- **Correo personal en el historial del repositorio público:** 9 commits llevan tu correo personal como autor. Pediste
  quitarlo; reescribir el historial publicado requiere tu permiso explícito en la sesión (el sistema lo detuvo como
  acción destructiva). Mientras, el otro chat sigue firmando con ese correo: hay que cambiar su configuración.

## Revisión visual: lo corregido y lo que queda

**Corregido**
- Caja vacía bajo «Verificar» (el atributo `hidden` no surtía efecto).
- Flecha del desplegable de estudios fuera de su caja.
- Encabezado y pie alineados con el contenido; un solo ancho para todas las pantallas del personal (P102).
- El pie llega al fondo en páginas cortas y el distintivo de versión ya no tapa su texto.
- Tablas: la línea de cada fila llega bajo la columna de acciones y botones y texto se alinean al centro (P103).
- «Aplicar el examen»: sin celda «—» sin título.
- «Mis trámites»: datos de pago separados entre sí; «Corregir y reenviar» como botón principal; motivo del rechazo en un
  aviso a todo el ancho; los datos se alinean arriba.
- Corrección de observaciones: el paso 1 dice cuántas observaciones hay y dónde.
- Revisión y cotejo en teléfono: la etiqueta de estado ya no queda pegada a la fotografía.
- Folios y códigos de ejemplo que se partían; doble espacio en la etiqueta de la CURP.
- Textos que el personal propone a la persona (rechazo, corregir el grado) pasan a tú.

**Queda, de prioridad baja o del estándar**
- En teléfono, los elementos fijos (distintivo de versión y «Menú de pruebas») tapan una franja del contenido mientras se
  desplaza la página; es el diseño del distintivo del estándar.
- En teléfono, en las tablas apiladas el valor baja de renglón según su largo (P104, estándar).
- El espacio que el estándar reserva para los mensajes de error deja huecos entre campos (intencional: evita saltos).
- Menores: el enlace activo de la barra de sesión de la persona, el asterisco que queda solo al final de una etiqueta
  larga, la raya de sección corta en «Mi perfil», dos estilos para los folios.

