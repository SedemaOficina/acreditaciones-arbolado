# Bitácora del proyecto

Un renglón por bloque cerrado: qué se hizo, qué se verificó, qué se eliminó y por qué.

## 2026-10-14 · Bloque 1 · Apertura del proyecto (etapa 0)

**Hecho**
- Guía del SIA copiada; nueve decisiones del SIA y registro de decisiones del trámite con la fecha de cada una.
- Modelo de datos en `db/esquema.json` (16 tablas) con generador de SQL y documentación.
- Esquema `apd`: reglas en la base (estados de solicitud y grupo, vigencia calculada, cupos, asistencia,
  examen, folios, bitácora inmutable), catálogos iniciales y cuenta `apd_api` con permisos por columna.
- 47 personas ficticias que recorren el trámite completo como `apd_api`, con fechas simuladas.

**Verificado** en PostgreSQL 16, base desechable:
- Instalación completa en una transacción, sin errores.
- Carga de los ficticios como `apd_api`: cada paso pasó por las reglas.
- 54 de 54 pruebas de reglas y permisos, incluidas fechas movidas en cada límite de vigencia.
- Exportación reproducible: dos corridas producen el mismo `datos/ficticios.json` (misma suma sha256).
- La exportación no contiene contraseñas ni su resumen.

**Decisiones de diseño tomadas en el bloque** (no contradicen decisiones de Liber; se le informan):
- El proyecto no usa PostGIS ni `territorio`: la cuenta no recibe `territorio_lectura` (mínimo privilegio).
- Las personas del padrón de Kobo se migran como cuentas «sin activar», sin contraseña; se activan al
  registrarse con su CURP. [pendiente] cómo se comprueba que quien activa es la titular.
- Qué base es (producción o pruebas) lo dice la función `apd.entorno()`, no un parámetro: la aplicación
  podría cambiar un parámetro y simular la fecha en producción.
- Una solicitud nueva se rechaza si la persona tiene una acreditación del mismo tipo vigente o renovable.
  Deducido de «pasado el año se tramita como nueva». [pendiente] confirmar.
- La corrección de una calificación capturada por error no tiene camino todavía (el examen no se edita).
  [pendiente] definir el procedimiento con constancia.

**Eliminado**: el parámetro `entorno` de la tabla de parámetros, sustituido por `apd.entorno()` (motivo arriba).

## 2026-10-14 · Bloque 2 · Correcciones de la validación del mapa del trámite

Liber marcó 46 de las 48 reglas en el mapa del trámite: 25 correctas, 11 por corregir y 10 con duda.

**Corregido en la base**
- Cursos: 5 días los nuevos y 1 día las renovaciones; asistencia mínima provisional 4 de 5 y 1 de 1.
- Calificación mínima de poda: 8.0 (antes 7.0).
- La poda vigente del dictaminador se exige sólo al iniciar la solicitud; ya no al enviar ni al emitir.
- La acreditación de dictaminador sigue vigente hasta su fecha aunque venza la de poda.
- El instructor puede cambiar durante el curso, con constancia en la bitácora.
- La calificación guarda su origen (captura o examen en línea), para el examen en salón de cómputo.
- Documentos de hasta 5 MB. En renovaciones sólo son obligatorios la constancia fiscal y el pago.

**Verificado**: instalación limpia, ficticios regenerados como `apd_api`, 61 de 61 pruebas.

**Eliminado**: el parámetro `dictaminador_sigue_a_poda` y su lógica (la decisión R43 lo dejó sin uso); la
comprobación de poda vigente al enviar y al emitir.

## 2026-10-14 · Bloque 3 · Cierre de la etapa 0

- Confirmado: se mantiene la cita presencial de cotejo y pago (la Secretaría necesita expedientes físicos).
- Confirmada la asistencia mínima: 4 de 5 y 1 de 1 (ya estaba así en la base; sólo cambia el comentario).
- Sigue pendiente qué documentos carga en su primera renovación quien viene de Kobo sin archivos.
- Etapa 0 cerrada. Los pendientes abiertos no bloquean la etapa 1, que trabaja con datos ficticios.

## 2026-10-14 · Bloque 4 · Factura y número de expediente

- La factura del pago la emite la Secretaría en la cita y la carga su personal.
  La persona solicitante no puede cargarla. Sin factura, la solicitud no entra a la bandeja: no hay grupo ni fecha.
- Número de expediente físico `EXP-AAAA-NNNN` asignado por la base al concluir el cotejo, consecutivo y sin huecos.
- Cada documento registra quién lo cargó.

**Verificado**: 66 de 66 pruebas.

**Eliminado**: los campos `rfc_factura` y `razon_social_factura` (los datos fiscales están en la constancia y en
la factura; capturarlos era duplicar un dato personal sin uso propio) y el requisito «Pago de derechos»,
sustituido por la factura.

## 2026-10-14 · Bloque 5 · Segunda ronda de correcciones del mapa

Diez marcas nuevas de Liber; tres cambian decisiones del mismo día (se registran como sustituidas):
- Cupo de grupos: 5 a 25 (antes 10 a 25).
- Calificación mínima: 7.0 poda y 8.0 dictaminador (antes 8.0 y 9.0).
- Factura: sólo PDF; el personal vuelve a capturar RFC y razón social, más el folio fiscal (único).

Además: constancias de capacitación obligatorias en dictaminador nueva; en renovación se recarga lo que ya no
esté vigente; la corrección de CURP se verifica contra el documento.

**Verificado**: 70 de 70 pruebas.

**Eliminado**: el requisito «Factura (XML)» y el formato XML.

## 2026-10-14 · Bloque 6 · Etapa 1: pantallas de la persona solicitante

- Seis pantallas en `sitio/` con el Estándar de formularios del SIA v1.0.0 (copiado sin cambios): inicio,
  crear cuenta, entrar, mis trámites, solicitud por pasos y verificación pública. Datos ficticios; envío y
  acceso simulados. Detalle, configuración, validación en el servidor y lista de cierre en `docs/ETAPA-1-PANTALLAS.md`.
- La base valida la CURP con las mismas tres capas que el formulario (`apd.curp_valida`); CURP ficticias
  regeneradas en formato válido. Contraseña ficticia de 12 o más caracteres.
- Acreditación y modalidad en un solo campo `tramite`, para que el esquema del servidor aplique las mismas
  condiciones que el navegador.
- Seis hallazgos del estándar documentados para reportarlos a su repositorio.

**Verificado** (emulación en Chromium, 390 y 1280 px): 72 comprobaciones del sitio, axe-core sin hallazgos en
8 pantallas, 46 campos auditados, 13 casos de validación en el servidor, 71 de 71 pruebas de la base.
**Pendiente**: dispositivos y lectores de pantalla reales, Firefox y Safari.

**Eliminado**: los campos separados `tipo` y `modalidad` del formulario (sustituidos por `tramite`); la
contraseña ficticia `Prueba-2026`; las CURP ficticias con clave `PRUEB`.

## 2026-10-14 · Bloque 7 · Observaciones de Liber: expediente, pago, entrega, CURP y menú de pruebas

- **Expediente por persona**: una CURP, un expediente, para todos sus trámites; se abre en el primer cotejo
  (`apd.asignar_expediente`, SECURITY DEFINER). Se retiró de la solicitud.
- **Datos de pago** al validar con cita: concepto y monto por curso (monto pendiente de la Gaceta), referencia
  provisional (folio sin guiones) e instrucciones (pendientes de Finanzas). Se ven en «Mis trámites».
- **Firma de recibido**: requisito «Acuse de entrega firmado» (momento `entrega`), cargado por el personal; sin
  él la base no registra la entrega.
- **Cuenta**: se pide la fecha de nacimiento y la CURP se comprueba contra nombre, apellidos y fecha
  (`sitio/app/curp-nombre.js`, la misma regla en navegador y servidor). Las CURP ficticias se forman ahora del
  nombre ficticio. Activar una cuenta de Kobo exige además el nombre del registro.
- **Avisos**: «Mis trámites» dice el resultado del examen y cuándo y dónde recoger la acreditación.
- **Menú de pruebas** en todas las pantallas (sólo versión 0.N): entrar como cualquier persona ficticia,
  desactivar las obligatorias, llenar con datos ficticios, saltar de paso, simular fallos.
- Confirmados sin cambio: RFC lo captura el personal; factura → bandeja (no inscripción automática); 7/8;
  cupos 5–25; documentos de renovación.
- Mapa del trámite actualizado (versión 6): R01, R03, R18, R20, R21, R35, R40, R46 y la nueva R49.

**Verificado**: 77 de 77 pruebas de la base; 18 casos de validación en el servidor; 86 comprobaciones del sitio
en teléfono y escritorio, con accesibilidad (axe) sin hallazgos.

**Eliminado**: `solicitud.numero_expediente` y su restricción (pasa a `solicitante`); las CURP ficticias `XAXX…`.

## 2026-10-14 · Bloque 8 · Segundo apellido, CURP al momento, costo por curso y documento de pendientes

- **Sin segundo apellido**: la cuenta pregunta «¿Tienes segundo apellido?»; con «No», la CURP debe llevar X en
  las posiciones 3 y 15 (cruzada `curp-sin-segundo-apellido`). Nadie queda atrapado ni sin comprobar.
- **CURP que no marcaba error** (reporte de Liber, con la CURP escrita antes que la fecha): `app/cuenta.js`
  vuelve a validar la CURP al cambiar nombre, apellidos, fecha o la respuesta del segundo apellido.
- **Costo por curso configurable**: `curso.pago_monto` con `pago_fundamento` (publicación de la Gaceta) y
  `pago_vigente_desde`; sólo el personal lo cambia y queda en la bitácora. La solicitud guarda el monto que se
  le indicó al darle cita (`solicitud.pago_monto`). Montos ficticios distintos por curso y un cambio en la
  fecha de corte para mostrar que quien ya tenía cita conserva el suyo.
- **`docs/PENDIENTES.md`**: 45 pendientes numerados por responsable, y los resueltos.

**Verificado**: 82 de 82 pruebas de la base; 21 casos en el servidor; 92 comprobaciones del sitio.

## 2026-10-14 · Bloque 9 · Tablero de pendientes

- Los pendientes pasan a una sola fuente, `docs/pendientes.json`, con una recomendación en cada uno.
  `herramientas/generar-pendientes.mjs` genera `docs/PENDIENTES.md` y la página del tablero.
- Tablero «Pendientes del sistema» (artefacto privado de Liber): por pendiente, «Acepto la recomendación»,
  «Decido otra cosa», «Tengo duda» o «Ya está resuelto», con su respuesta; además, agregar pendientes nuevos.
  Las marcas viven en el guardado del artefacto (`pendientes_marcas`, `pendientes_nuevos`); al aplicarlas se
  actualiza `docs/pendientes.json` y se vuelve a generar todo.

**Verificado**: el tablero sin desborde a 390 y 1280 px, claro y oscuro, sin errores; una escritura, lectura y
borrado de prueba en su guardado.

## 2026-10-14 · Bloque 10 · Menos preguntas: segundo apellido y tipo de trámite

- Se quitó «¿Tienes segundo apellido?»: si el campo queda vacío, la CURP debe llevar X en su lugar. Lo indica
  un campo auxiliar que calcula la página (`sin_segundo_apellido`) y que el servidor calcula por su cuenta.
- La solicitud pregunta sólo la acreditación (poda y derribo o dictaminador técnico). Nueva o renovación se
  informa según el historial. El curso que corresponde va en el campo auxiliar `tramite`.
- Módulo propio `app/auxiliar.js` (contrato de módulos del estándar): el núcleo no lee controles ocultos.

**Verificado**: 21 casos en el servidor; 92 comprobaciones del sitio, accesibilidad sin hallazgos.

**Eliminado**: la pregunta «¿Tienes segundo apellido?» y la cruzada sobre su respuesta; el campo de cuatro
opciones «Trámite».

## 2026-10-14 · Bloque 11 · Versión de prueba dentro de Claude

- `herramientas/construir-artefacto.mjs` arma desde `sitio/` una copia para publicarse como artefacto «Acreditaciones
  de arbolado» (la página principal abre `inicio.html`, porque el artefacto reserva `index.html`). Se vuelve a
  publicar cada vez que se publica GitHub Pages.

## 2026-10-14 · Bloque 12 · Fotografía de la persona y credencial

- «Crea tu cuenta» pide una fotografía de frente, obligatoria (JPG o PNG, 5 MB; en el teléfono abre la cámara
  frontal). Sirve para reconocer a la persona en el cotejo, el curso y el examen.
- Base: tabla `apd.fotografia` (una vigente por persona; las anteriores se conservan). Sin fotografía no se
  envía una solicitud; sin fotografía confirmada por el personal no se concluye el cotejo; en el cotejo el
  personal puede tomar una nueva, que queda confirmada; ya confirmada, la persona no la cambia.
- Entrega: credencial y comprobante de recepción. Nuevo requisito `foto_credencial` (momento «entrega», sólo
  imagen), tomada en el lugar; con el comprobante firmado, condición para registrar la entrega. El requisito
  `acuse_entrega` se llama ahora «Comprobante de recepción firmado».
- Cada requisito declara sus formatos (`apd.requisito.formatos`); la base rechaza un formato no admitido.
- Textos: inicio, aviso de privacidad, cita (llevar identificación para confirmar la fotografía) y entrega.
- Menú de pruebas: «Llenar con datos ficticios» adjunta una fotografía ficticia dibujada en el navegador.
- Dos hallazgos para el estándar: `validar.mjs` y los campos de archivos (P46) y `aria-required` en la zona de
  carga (P47).

**Verificado**: 92 de 92 pruebas de la base; 23 casos en el servidor; 98 comprobaciones del sitio,
accesibilidad sin hallazgos; 50 campos correctos en el auditor.

## 2026-10-15 · Bloque 13 · Mayúsculas en la cuenta

- «Crea tu cuenta» escribe en mayúsculas el nombre, los apellidos y la CURP mientras la persona teclea,
  conservando el cursor (`app/cuenta.js`). Correo y contraseña no cambian.
- La base los guarda igual: `apd.mayusculas()` en el alta y en cada cambio de la persona, con acentos y Ñ
  aunque la configuración regional del servidor no sea española. Los datos ficticios quedan en mayúsculas.
- Documento aparte para corregir el Estándar de formularios: «Fallas del Estándar de formularios del SIA»
  (13 hallazgos, con dónde están, cómo se reproducen y qué corregir).

**Verificado**: 93 de 93 pruebas de la base; 23 casos en el servidor; 102 comprobaciones del sitio,
accesibilidad sin hallazgos.

## 2026-10-15 · Bloque 14 · Adscripción y nombre de los archivos

- «Organización con la que trabajas» se sustituye por la adscripción: Sí/No, tipo (empresa, consultoría o
  particular; dependencia de la Ciudad; alcaldía; dependencia federal) y la pregunta de cada tipo, con
  Dirección General si es la SEDEMA. «Otra» con su nombre en cada lista (módulo `otro` del estándar).
- Base: `solicitud.adscripcion`; `organizacion.tipo` con los cuatro tipos y `organizacion.clave`; catálogo inicial
  con las 16 alcaldías, SOBSE, SEDEMA y sus seis Direcciones Generales, PAOT y CFE. La institución debe ser del
  tipo elegido (`adscripcion_no_coincide`).
- Cada archivo se guarda como TIPO DE DOCUMENTO_NOMBRE COMPLETO.ext (`apd.nombre_de_archivo`), también la
  fotografía; el nombre original se conserva. La pantalla de documentos lo avisa con el nombre de la persona.
- Hallazgo para el estándar: las condiciones no se encadenan entre campos hermanos en el navegador (P52).

**Verificado**: 98 de 98 pruebas de la base; 33 casos en el servidor; 114 comprobaciones del sitio,
accesibilidad sin hallazgos; 59 campos correctos en el auditor.

## 2026-10-15 · Bloque 15 · «Mis datos», sexo y adscripción de la persona

- Pantalla nueva `datos.html` («Mis datos», enlazada en la cabecera de sesión): datos ligados a la CURP de sólo
  lectura y, editables, correo, teléfono, adscripción y la fotografía mientras no esté confirmada.
- La adscripción pasa a la persona: se pide al crear la cuenta y se cambia en «Mis datos»; la solicitud ya no la
  pregunta, muestra con cuál se enviará. «No, soy independiente» es explícito. Un solo fragmento
  (`herramientas/plantillas/adscripcion.html`) lo inserta `construir-sitio.mjs` en las dos pantallas.
- Sexo: se toma de la CURP (campo de sólo lectura en la cuenta; columna generada `solicitante.sexo` en la base).
- Base: `solicitante.adscripcion` y `organizacion_id` (obligatoria en cuentas activas; bitácora en cada cambio);
  la solicitud la copia al alta y al envío y la API ya no la edita.

**Verificado**: 102 de 102 pruebas de la base; 35 casos en el servidor; 131 comprobaciones del sitio,
accesibilidad sin hallazgos (también en «Mis datos»); 74 campos correctos en el auditor.

## 2026-10-15 · Bloque 16 · Documentos sólo en PDF y enlace a la CURP

- Lo que carga la persona en la solicitud se acepta sólo en PDF: `requisito.formatos` en la base, `data-extensiones`
  generado de ahí y la configuración del formulario. La pantalla sugiere convertir una foto con el escáner del
  teléfono. Las fotografías siguen siendo imagen.
- Enlace oficial para obtener la CURP (gob.mx/curp) en el requisito (columnas `enlace` y `enlace_texto`), en la
  lista de requisitos del inicio y en el campo CURP de «Crea tu cuenta»; se abre en otra pestaña y lo dice.

**Verificado**: 104 de 104 pruebas de la base; 36 casos en el servidor; 137 comprobaciones del sitio,
accesibilidad sin hallazgos.

## 2026-10-15 · Bloque 17 · Preguntas de opción como lista

- Se compararon cuatro estilos (tarjetas en rejilla, lista con botón de opción visible, botón de opción clásico
  y lista desplegable) en una página de prueba con los estilos reales. Liber eligió la lista (`opciones-lista` del
  estándar): una opción por renglón, con el círculo visible, en todas las preguntas, también el Sí/No.
- `app/apd.css` agrega el estado deshabilitado que esa variante no trae (P56).

**Verificado**: 137 comprobaciones del sitio, accesibilidad sin hallazgos; auditor de CSS y de campos correctos.

## 2026-10-15 · Bloque 18 · Datos internos y número de versión por publicación

- `data-interno`: el sexo (cuenta y «Mis datos») y los auxiliares `sin_segundo_apellido` y `tramite` no se muestran
  a la persona. En la versión de prueba (`app/pruebas.js` pone `.modo-pruebas`) salen en un recuadro amarillo
  con su nota («en producción no se muestra…») y, los auxiliares, con su valor al momento.
- `herramientas/nueva-version.mjs`, llamado por `publicar-sitio.sh`: sube 0.N → 0.N+1, actualiza el `?v=` de las
  páginas y anota en `docs/VERSIONES.md` el número, la fecha y qué cambió. La 0.2 es la primera con este esquema.

**Verificado**: 141 comprobaciones del sitio (también que en producción el sexo queda oculto), accesibilidad sin
hallazgos; auditor de CSS y de campos correctos.

## 2026-10-15 · Bloque 19 · Sólo los datos internos que se guardan

- «Sin segundo apellido» deja de mostrarse en la versión de prueba: no se guarda en la base. En amarillo quedan sólo
  los calculados que sí se guardan: el sexo y el curso que corresponde.

## 2026-10-15 · Bloque 20 · Adscripción ampliada y fichas de «Mis solicitudes»

- Adscripción: tipo «Institución educativa» (UNAM u otra con su nombre; `educativa` en la base y UNAM en el
  catálogo); el nombre de la empresa es un `combo` con las registradas que admite nombres nuevos; la Dirección General
  de la SEDEMA ya no tiene «otra área»; la alcaldía es una lista desplegable con las 16 en orden alfabético (el valor
  es la clave del catálogo). «Escríbela de nuevo» pasa a «Confirma tu contraseña».
- Documentos: en la versión de prueba, cada archivo cargado dice en amarillo «Se guardará como: CURP_…pdf», el
  mismo cálculo que `apd.nombre_de_archivo`.
- «Mis solicitudes»: «En revisión documental»; «Folio de la solicitud» y «Folio de la acreditación»; con grupo,
  «Preséntate el», «El curso termina el» y sede (sin duración ni folio de grupo al frente); acreditación emitida,
  folio, inicio y fin de vigencia, sin datos del curso; concepto, monto, referencia y hora de entrada «por confirmar»
  en amarillo.

**Verificado**: 106 casos de la base, esquemas del servidor, comprobaciones del sitio y accesibilidad sin hallazgos;
auditor de CSS y de campos correctos.

## 2026-10-15 · Bloque 21 · Perfil del dictaminador, nombres de archivo e identificadores

- Perfil en tres preguntas: último nivel de estudios; desde licenciatura, carrera (combo abierto con `apd.carrera`) y
  situación de los estudios. La base calcula `perfil_academico` y `experiencia_minima` (`apd.perfil_academico`) y, al
  enviar, rechaza `perfil_no_cumple` y `experiencia_insuficiente`. El navegador hace el mismo cálculo
  (`APD.perfilAcademico`): fija el mínimo del campo de experiencia, dice cuántos años se piden y avisa si no cumple. En
  pruebas, el perfil calculado se ve en amarillo.
- Nombres de archivo: la persona ve «Se guardará como: CURP_…pdf» bajo cada archivo y, en la revisión, el nombre nuevo
  con el archivo original debajo (`APD.nombreDeArchivo`, mismo cálculo que `apd.nombre_de_archivo`).
- «Número de expediente», «Número de acreditación» y «Fecha en que enviaste la solicitud».
- Hallazgo del estándar P61 (mínimo que depende de otra respuesta), anotado en el documento de fallas.

**Verificado**: 113 casos de la base, esquemas del servidor, comprobaciones del sitio y accesibilidad sin hallazgos;
auditor de CSS y de campos correctos.

## 2026-10-15 · Bloque 22 · Estudios también en poda

- «Tus estudios» en las dos acreditaciones: nivel y, desde licenciatura, carrera. En dictaminador, además, la situación
  del último grado (también en carrera técnica: en curso o trunca no cumple). La base pide nivel y carrera al enviar
  (`faltan_estudios`) y en poda no guarda situación ni perfil.
- La situación de los estudios tiene una sola condición (tipo = dictaminador): con dos condiciones anidadas el esquema
  del servidor sólo leía la más cercana y la exigía en poda (P38). Con nivel «ninguno», la base la descarta.

**Verificado**: 116 casos de la base, esquemas del servidor, comprobaciones del sitio y accesibilidad sin hallazgos;
auditor de CSS y de campos correctos.

## 2026-10-15 · Bloque 23 · Nivel en lista desplegable y situación del grado en los dos tipos

- El nivel de estudios es una lista desplegable (sin autocompletado). Carrera y situación del grado se preguntan sólo
  con licenciatura, maestría o doctorado, en poda y en dictaminador, y son obligatorias (`faltan_estudios`).
- Carrera técnica vuelve a no pedir situación: cuenta como «carrera técnica» (5 años).
- Ayudas: en poda los estudios son estadísticos; en dictaminador, requisito con la experiencia del apartado académico.

**Verificado**: 116 casos de la base, esquemas del servidor, comprobaciones del sitio y accesibilidad sin hallazgos;
auditor de CSS y de campos correctos.
- Sin catálogo de carreras afines (Liber): la carrera es abierta y la valida el personal; el catálogo inicial trae sólo las
  cuatro que nombran los lineamientos y la lista sugiere sólo las aceptadas. P59 resuelto; P62 (pantalla para
  clasificar carreras) para la etapa 2.
- Sin aviso de renombrado en los documentos (ni la nota ni «Se guardará como»); el nombre nuevo queda sólo en la revisión.
- Casilla obligatoria «Manifiesto bajo protesta de decir verdad…» antes del aviso de privacidad.

## 2026-10-15 · Bloque 24 · Sin constancias de capacitación; un solo PDF por requisito

- Fuera el requisito «Constancias de capacitación especializada» (dictaminador nueva y renovación): basta con los
  comprobantes de experiencia. Dictaminador nueva queda con 7 documentos.
- Comprobante de estudios y comprobantes de experiencia piden escanear todos los documentos en un solo PDF.
- Se quita de la ayuda del nivel de estudios la nota sobre poda y dictaminador.

## 2026-10-15 · Bloque 25 · Reglas del perfil confirmadas

- Posgrado en un área afín cuenta aunque la licenciatura sea de otra: «Ciencias Forestales» entra al catálogo como afín y
  la ayuda de la carrera pide escribir la del posgrado.
- Un perfil que no cumple ya no impide enviar: la base deja de rechazar con `perfil_no_cumple` y el formulario advierte
  (en ámbar) que la Secretaría lo revisará. P60 resuelto.
- Lo que decide el personal (carrera por clasificar o no cumple) pide 5 años de experiencia; sólo carrera principal o
  afín baja a 2. La indicación de escribir la carrera del posgrado sólo aparece con maestría o doctorado.

## 2026-10-15 · Bloque 26 · Inventario de textos para revisión

- `herramientas/inventario-textos.mjs` saca de las páginas (sin ejecutar scripts) cada texto visible con su pantalla,
  sección, tipo y la condición en que aparece; `herramientas/inventario-textos.py` le suma los textos que pintan los
  scripts según perfil y estado (lista curada), los mensajes de la base (`apd.error`) y los del Estándar que el
  sistema usa, y escribe `docs/textos/inventario-textos.xlsx` (hoja «Textos» con columnas para la corrección y el
  estado, y «Cómo revisar» con el avance por pantalla). `npm run textos` lo regenera.
- Primera versión: 528 textos de la versión de prueba 0.11. Señalado: inicio dice «en PDF o en foto» (sólo se acepta
  PDF) y cuatro textos de estado que nunca se muestran.

## 2026-10-16 · Bloque 27 · Estilo de los formularios

- Revisión de estilo de «Crea tu cuenta» con capturas antes y después (artefacto «Revisión de estilo»); aprobada por Liber.
- Cuenta: secciones Tus datos, Contacto, Tu adscripción, Contraseña y Antes de crear tu cuenta; nombre y apellidos en
  `.fila-3`, fecha y CURP en `.fila`; una ayuda por bloque; CURP sin ícono de ayuda; introducción más corta (−13 % de
  alto en escritorio). Adscripción (cuenta y Mis datos): Sí/No en línea. Solicitud: acreditación y situación de los
  estudios en línea; nivel de estudios con ancho medio. Entrar: tarjeta angosta.
- `app/apd.css`: `.ayuda-bloque`, `.opciones-en-linea`, `.control-medio`, `.tarjeta-angosta`, con tokens del estándar.
- Documento de fallas del estándar: sección «Segunda tanda» (P61 y S2-1 a S2-4).

**Verificado**: esquemas del servidor, comprobaciones del sitio y accesibilidad sin hallazgos; auditor de CSS y de
campos correctos.
- Adscripción: las opciones de «¿De qué tipo es?», dependencia de la Ciudad, dependencia federal e institución educativa
  en dos columnas (`.opciones-en-linea`); las preguntas siguen una debajo de otra porque dependen de la anterior. La lista
  de Direcciones Generales queda una por renglón por sus nombres largos.

## 2026-10-16 · Bloque 28 · Etapa 2: revisión documental del personal

- Maqueta aprobada por Liber (artefacto «Maqueta · Revisión documental», `maquetas/etapa2-revision/`) con sus ajustes:
  búsqueda y filtros, «Folio de la solicitud», filtros plegados en teléfono, rechazo de la carrera no afín y opción C.
- Base: estado `rechazada` (solicitud) y resultado `rechazada` (revisión) con motivo obligatorio; sólo por perfil de
  dictaminador que no cumple. No se valida con la carrera sin clasificar ni con un perfil que no cumple. La clasificación
  de carreras es del personal, queda en la bitácora y recalcula las solicitudes abiertas (P62). 10 casos nuevos de
  reglas (127).
- Ficticios: una solicitud reenviada con su corrección, un dictaminador con licenciatura trunca y uno rechazado.
- Sitio: `revision.html` (bandeja, con el módulo tabla del estándar) y `revisar.html` (revisión), en usted, con acceso
  simulado del personal (`app/personal.js`). La revisión es un formulario del estándar: los documentos y sus decisiones se
  generan del catálogo (`construir-sitio.mjs`), con auxiliares `perfil_revision`, `revisar_<requisito>` y `resultado`
  (una sola condición por campo, P38). Rechazar pide confirmación (`FormKit.confirma`). «Mis trámites» muestra la
  solicitud rechazada con su motivo.
- Esquema del servidor de la revisión con 14 casos (61 en total); 265 comprobaciones del sitio, con accesibilidad de
  la bandeja, la revisión, la revisión con errores y el rechazo.

## 2026-10-16 · Bloque 29 · Visor de documentos de la revisión

- Pedido de Liber: ver todas las hojas del documento al revisar; el módulo del personal se usa casi siempre en computadora.
- `app/visor.js` con pdf.js 4.10.38 (`pdfjs-dist` fijado en package.json; `construir-sitio.mjs` copia la biblioteca, su
  trabajador y las fuentes estándar a `sitio/vendor/pdfjs/`, sin CDN). Todas las hojas una debajo de otra, «Hoja N de M»,
  acercar/alejar, ajustar al ancho, girar y abrir en otra pestaña. En computadora (≥1024 px) queda fijo a la derecha y abre
  de entrada el primer documento sin quitar el foco; en pantalla chica es un diálogo a pantalla completa (Escape devuelve
  el foco a «Ver documento»). El documento que se ve se señala en la lista.
- `herramientas/documentos-ficticios.py`: un PDF ficticio por requisito, de 1 a 5 hojas (`datos/documentos/`).
- 273 comprobaciones del sitio (8 nuevas del visor) y accesibilidad con el visor abierto, sin hallazgos.

## 2026-10-16 · Bloque 30 · Sede única: Vivero Nezahualcóyotl

- Decisión de Liber: la cita, el curso y la entrega son siempre en el Vivero Nezahualcóyotl.
- Base: parámetros `sede` y `sede_direccion` (la dirección queda «[pendiente]»); `entrega_lugar` sólo guarda días y horario;
  un grupo nuevo toma la sede sola (caso de reglas nuevo, 128).
- Revisión: se quitó la lista «Lugar de la cita»; la pantalla dice que la cita es en el Vivero. «Mis trámites»: lugar de la
  cita, sede del curso y dónde recoger la acreditación, con la dirección en amarillo «por confirmar».
- Esquema del servidor sin `cita_sede`; 275 comprobaciones del sitio.

## 2026-10-16 · Bloque 31 · Avanzar al siguiente documento al aceptar

- Pedido de Liber: al aceptar un documento, el visor cambia al siguiente. `app/revisar.js` busca el siguiente documento sin
  decidir (y vuelve al principio si quedó alguno atrás), lo abre en el visor en computadora, lo trae a la vista en la lista
  y lo anuncia al lector de pantalla; con todo decidido, baja al resultado. No mueve el foco ni avanza al observar, ni con
  las marcas que pone la página (opción C). Comprobación nueva en el sitio (276).

## 2026-10-16 · Bloque 32 · Documentos reales en la prueba, sin servidor

- Pedido de Liber: cargar un documento real en la prueba y verlo en la revisión aunque no haya servidor.
- `app/archivos-prueba.js` (IndexedDB, sólo en este navegador): al enviar o reenviar una solicitud se guardan sus archivos y
  un resumen (persona, estudios, curso). `APD_PERSONAL.datosConPrueba` los suma a los ficticios con la forma de la base: una
  solicitud nueva entra a la bandeja como enviada; un reenvío vuelve a revisión con lo corregido como carga vigente.
- Revisión: el visor abre el archivo real (enlace del navegador) con su nombre original; la nota dice si es el archivo
  cargado o el ficticio. Solicitud: aviso en el paso de documentos. Menú de pruebas: «Borrar los documentos de prueba».
- Comprobación de punta a punta en teléfono y escritorio: se envía un dictaminador con un PDF de tres hojas, llega a la
  bandeja señalado y el visor lo muestra (280 comprobaciones).

## 2026-10-16 · Bloque 33 · Fecha de nacimiento escrita, sin calendario

- Pedido de Liber: la fecha de nacimiento se escribe sin abrir calendario.
- Formato propio `fecha-dma` (`app/fecha-dma.js`): acepta día/mes/año con `/`, `-`, `.` o espacio, o los ocho dígitos
  juntos, y lo deja como 23/07/1985; exige fecha real, no posterior a hoy (hora de la Ciudad de México) y año desde 1900.
  Cruzada `curp-fecha-dma` contra la fecha de la CURP. Campo de texto con teclado numérico y `autocomplete="bday"`.
- Se carga en el navegador y en Node: el esquema del servidor valida igual. La API (etapa 3) la convierte a fecha
  (`APD_FECHA.iso`) antes de guardarla. Hallazgo del estándar: P70.
- Comprobaciones nuevas: el campo ya no es de calendario, «30121999» queda «30/12/1999», «31/02/1999» se rechaza (286).

## 2026-10-16 · Bloque 34 · Comprobante de domicilio

- Decisión de Liber: al emitir los lineamientos no se pide el comprobante de domicilio (no se utiliza); hoy la norma lo
  exige, así que el sistema lo sigue pidiendo. P03, DECISIONES (corrección 13) y mapa (R13) actualizados.

## 2026-10-16 · Bloque 35 · Fecha de nacimiento con escritura guiada

- Liber: el campo de fecha del navegador estaba bien por cómo se escribía (dd/mm/aaaa, pasando solo al mes y al año);
  lo que sobraba era el calendario.
- `app/fecha-dma.js`: escritura guiada en el navegador. Al completar el día o el mes pone la diagonal y pasa al siguiente;
  un primer dígito que no puede iniciar un día (4 a 9) o un mes (2 a 9) se completa con cero; una diagonal tras un solo
  dígito lo cierra. Al borrar o al editar en medio no reacomoda nada. Funciona igual en teléfono (teclado numérico, sin
  diagonal) y en computadora. El campo muestra «dd/mm/aaaa» como guía; la etiqueta y la ayuda siguen aparte.
- Comprobaciones nuevas: «3012» + «1999» tecleados dan 30/12/1999; «4» da 04/; borrar no reacomoda.

## 2026-10-16 · Bloque 36 · Menú de pruebas reorganizado

- Liber: el menú repetía cosas y confundía. Maqueta (`maquetas/menu-pruebas/`) con lo que confundía y la propuesta;
  aprobada.
- `app/pruebas.js` en cinco bloques: estás como · en esta pantalla · entrar como · ir a otra pantalla · ajustes de la
  prueba. «En esta pantalla» sólo ofrece lo que aplica (la bandeja del personal ya no ofrece llenar ni simular el envío).
- `app/casos-prueba.js`: 20 casos con nombre en cinco grupos, más el personal; cada uno busca su persona en los ficticios.
  Lo usan «Entrar como» y, en «Entrar», «Llenar CURP y contraseña».
- «Entrar» pierde la caja de personas de ejemplo (`app/entrar.js` sólo pone la contraseña). Las CURP del registro anterior
  pasan al menú de «Crear cuenta»: «Llenar con su CURP».
- «Empezar de cero»: cierra la sesión, borra lo guardado en la pestaña (`apd.*`) y en IndexedDB, y lleva al inicio.
- `archivos-prueba.js` y `casos-prueba.js` se cargan en todas las páginas, junto a `pruebas.js`.
- Comprobaciones nuevas: orden de los bloques, todos los casos con persona, entrar con un caso desde «Entrar», el personal
  sin «En esta pantalla», «Empezar de cero», cuenta del registro anterior desde el menú; axe con el menú abierto en tres
  pantallas (311 comprobaciones).

## 2026-10-17 · Bloque 37 · Mi perfil, carrera técnica, carga de archivos y botones

- Direcciones Generales de la SEDEMA en el orden de Liber (fragmento `herramientas/plantillas/adscripcion.html`).
- Carrera técnica: campo `carrera_tecnica` (texto libre, obligatorio con nivel técnico). Base: columna nueva, la regla
  `solicitud_perfil` la limpia y la descarta con otro nivel, `comprobar_envio` la exige, permiso de actualización y
  `solicitud_cerrada` la protegen; no entra a `apd.carrera` (130 casos de reglas). Ficticios con «Técnico en jardinería» y
  «Técnico forestal». Revisión del personal la muestra como carrera.
- Ayuda de «¿Qué carrera estudiaste?»: sólo «Al escribir te sugerimos las ya registradas».
- «Mi perfil» (`datos.html`, `app/datos.js`, `app/config-datos.js`): cabeza con fotografía (o iniciales), nombre y estado de la
  fotografía; datos de identidad de sólo lectura; contacto y adscripción escritos, cada uno con «Editar» que abre su
  formulario (`form-contacto`, `form-adscripcion`, `form-foto`, arranque manual); «Cancelar»; al guardar, la vista se
  actualiza y lo dice. Esquemas del servidor por parte: `perfil-contacto.json`, `perfil-adscripcion.json`, `perfil-foto.json`.
  La fotografía de la cuenta se guarda en IndexedDB (`archivos-prueba.js`, almacén `fotos`) y se ve en el perfil.
- Carga de archivos (`app/archivos-lleno.js`): con el máximo cargado se oculta «Elegir archivo»; «Un archivo de hasta 5 MB».
  Hallazgo P71.
- Botones: comprobación automática de aire en cada captura de `probar-sitio.mjs`; acuses con `.acuse-acciones` y relleno
  lateral; «Editar» parejo en la revisión antes de enviar. Hallazgo P72.
- Bandeja: lo enviado en este navegador va primero y con la fecha simulada.

## 2026-10-17 · Bloque 38 · Mostrar la contraseña

- Pedido de Liber: botón para ver la contraseña. `app/ver-contrasena.js`: «Mostrar» / «Ocultar» dentro del campo
  (aria-pressed, nombre accesible), en «Crear cuenta» y «Entrar»; al enviar se vuelve a ocultar. El envoltorio
  `.contrasena-caja` ocupa el renglón del control para que contraseña y confirmación sigan a la misma altura.
  Hallazgo del estándar: P73. Comprobaciones nuevas en el sitio.
- «Mi perfil»: la adscripción se lee en un renglón a todo lo ancho, directo: «Eres independiente.» o «Alcaldía: Tlalpan.».

## 2026-10-17 · Bloque 39 · Días para vencer y recorrido de prueba guardado en el navegador

- Días para vencer: `APD.hoy`, `APD.diasParaVencer` y `APD.textoVence` (apd.js). «Mis trámites» y la verificación
  pública dicen «Faltan N días», «Vence hoy» o «Venció hace N días». En la prueba, hoy = fecha simulada (fecha_corte);
  con la API, el día real.
- Pedido de Liber: que el recorrido completo de la prueba se guarde aunque sea en el navegador. Antes la sesión y la
  cuenta nueva vivían en la pestaña (sessionStorage) y se perdían al abrir otra.
  - `app/archivos-prueba.js`: almacenes nuevos `cuentas` (por CURP; la contraseña sólo como resumen SHA-256) y cambios de
    perfil (localStorage `apd.perfiles`); `mezcla(datos)` suma cuentas, perfiles, solicitudes y documentos a los ficticios.
  - `APD.cargar()` aplica la mezcla en cada llamada: todas las pantallas ven lo mismo. Sesión y revisiones en localStorage.
  - «Crear cuenta» guarda la cuenta; «Entrar» acepta su propia contraseña; «Mi perfil» guarda por persona; la solicitud
    ya no se guarda en la sesión (folio con lo ya guardado) y conserva la acreditación que renueva.
  - Menú de pruebas: «Persona nueva» crea una cuenta de prueba; «Lo guardado» cuenta cuentas, solicitudes, fotografías y
    revisiones; «Empezar de cero» borra también localStorage.
  - Revisión del personal: fotografía de la persona junto a sus datos; en renovaciones, aviso de que sólo la constancia
    fiscal es obligatoria (duda de Liber: «sólo aparece la constancia»).
- Prueba nueva de punta a punta en otras pestañas: crear cuenta con foto, volver a entrar con su contraseña, enviar con
  documentos reales y verla primero en la bandeja, con sus 4 documentos y su fotografía.

## 2026-10-17 · Bloque 40 · Revisión: seguir después de observar y el resultado llega a la persona

- «Listo, ir al siguiente» bajo cada observación (generado en `construir-sitio.mjs`); `revisar.js` comparte `avanza()` con
  el avance al aceptar; sin observación escrita, enfoca el texto y lo anuncia.
- Al registrar, el visor se cierra y la confirmación se trae a la vista (antes quedaba hasta abajo, debajo del visor).
- `archivos-prueba.js` (`mezcla`) aplica las revisiones guardadas: estado, documentos aceptados u observados con su texto,
  cita o motivo de rechazo, y un registro en `revision` (la vuelta cuenta). Si la persona reenvía después, sigue enviada.
  El tiempo real se comprime al pasar de la fecha simulada para conservar el orden envío → revisión → reenvío.
- Bandeja: sólo lo que está enviado; «Revisadas en esta prueba» con su resultado y su estado actual.
- Prueba de punta a punta ampliada: el personal observa un documento, registra, la revisada sale de la bandeja y la
  persona ve «Con observaciones» con qué corregir (411 comprobaciones).

## 2026-10-17 · Bloque 41 · Ubicarse en el trámite; fotografía y entrega el día del examen

- Menú de pruebas: «Fase N de 7» de la pantalla (en «Mis trámites», según la solicitud de la persona) y enlace al mapa del
  trámite («quién hace qué, fase por fase»), en otra pestaña.
- Decisiones de Liber: la fotografía del perfil sólo identifica y sirve para comprobar en el cotejo que es la misma persona;
  la credencial se entrega el mismo día del examen (calificación al momento en computadora) y ahí se toma su fotografía.
  Inicio, mapa (R34, R40, R51, pasos 14 y 16), P10 y la maqueta de cotejo actualizados.
- Maqueta de cotejo: tabla con el módulo «tabla» del estándar; «¿Es la misma persona de la fotografía?»; quinta propuesta
  para decidir (si no es la persona).

## 2026-10-17 · Bloque 42 · Ubicación siempre a la vista y decisiones del cotejo

- Pedido de Liber: la ubicación no en el menú sino siempre en pantalla. `pruebas.js` pone bajo la franja de la versión de
  prueba «Pantalla · Fase N de 7 · Ver el mapa del trámite» (sólo en la versión de prueba).
- Decisiones del cotejo (aprobadas con la maqueta): inasistencia → una cita nueva, a la segunda se cierra; sin pago → otra
  cita con el mismo monto; documento que no coincide → pausa para cargar el correcto ese día, o con observaciones; no es la
  persona → no se atiende y se bloquea la cuenta; un solo perfil «revisión y cotejo» (P27).

## 2026-10-17 · Bloque 43 · Citas de cotejo

- Personal: «Citas de cotejo» (`citas.html`): agenda por día con su situación, día anterior y siguiente, búsqueda por
  nombre, CURP, folio o expediente en todos los días. «Atender una cita de cotejo» (`cotejo.html`): llegada, identidad y
  fotografía (confirmar, tomar otra o no es la persona), cotejo de cada documento contra lo que cargó (visor a la derecha),
  pago y factura (PDF, RFC, razón social y folio fiscal). La acción principal cambia con el resultado; cerrar la solicitud
  y no atender piden confirmación. Al terminar: expediente y «Atender la siguiente».
- Persona: «Cita en pausa» en «Mis trámites» con lo que no coincidió y «Cargar el documento correcto» (`corregir.html`),
  que pide sólo ese documento; avisos de cita nueva (inasistencia o sin pago) y de cierre por segunda inasistencia; al
  entrar, aviso de cuenta bloqueada.
- Prueba guardada: el recorrido completo en el navegador, en el orden en que pasó (envíos, revisiones, citas,
  correcciones): `archivos-prueba.js` lo aplica como línea de tiempo. Las revisiones guardan su historial (una solicitud
  reenviada se vuelve a revisar). Perfil ficticio «revisión y cotejo».
- Base: tabla `apd.cita`, columna `solicitante.bloqueo_motivo`, parámetro `inasistencias_cotejo_maximas`, reglas de la cita
  (pausa del mismo día, inasistencias, bloqueo), carga en pausa y `apd.cerrar_pausas_vencidas()`. 151 casos de reglas.
- Formato propio `folio-fiscal` (UUID de la factura). Esquemas `cotejo.json` y `corregir.json` con 19 casos.
- Hallazgo del estándar: `esquema-desde-html` sólo lee condiciones en `div[data-si]`; en una `section` el servidor no
  la ve (se envolvieron en `div`).
- Pendientes nuevos: P79 (aviso a la Dirección y desbloqueo) y P80 (tarea nocturna de pausas).
- Correcciones: la persona al azar del menú de pruebas nacida desde 2000 llevaba un dígito en la posición 17 de su CURP
  (ahora una letra; la prueba fallaba de vez en cuando); si lo guardado en el navegador no se puede aplicar, queda un aviso
  en la consola y las pruebas lo detectan.


## 2026-10-17 · Bloque 44 · «Mi contraseña está mal» en la prueba

- Reporte de Liber: creó su cuenta y al entrar le dijo que la CURP o la contraseña no coinciden. El código funciona (se
  reprodujo crear y entrar con una contraseña de 12 dígitos en el mismo navegador): las cuentas de la prueba se guardan
  sólo en el navegador y la dirección donde se crean, y el sitio publicado y la vista dentro de Claude son lugares
  distintos.
- Entrar (sólo en la prueba): si la CURP no tiene cuenta en ese navegador, lo dice y explica por qué; con contraseña
  equivocada el mensaje sigue siendo el general (en el SIA siempre es el general).
- Crear cuenta: si el navegador no deja guardarla (modo privado, almacenamiento bloqueado), lo avisa en lugar de dar la
  cuenta por creada.

## 2026-10-17 · Bloque 45 · Un correo, una cuenta; sin fotografía nueva en la cita; avisos por correo

- Pedido de Liber: el correo no se repite. «Crear cuenta» y «Mi perfil» rechazan el de otra cuenta activa y lo marcan en
  el campo (APD.correoEnUso, APD.pintaErrores); la base, con `apd.comprobar_correo` (`correo_registrado`) y el índice
  `solicitante_correo_uk`. Las personas de prueba tienen cada una su correo ficticio. 156 casos de reglas.
- Pedido de Liber: en el cotejo se quita «Es la misma persona, pero no se le reconoce en la fotografía» (tomar otra
  fotografía). Quedan «Sí, es la misma persona» y «No es la persona». «Mis trámites» ya no dice que ahí le toman otra.
- Liber descubrió que sin correo transaccional la única forma de enterarse de la cita es entrar a su perfil: catálogo de
  avisos en `docs/AVISOS-POR-CORREO.md` (incluido el resultado de la cita), ligado a P23.
- «Mi perfil»: «Cancelar» después de un envío fallido no respondía al primer clic (el aviso del núcleo se ocultaba y el
  botón subía): P87. Pendiente P86: actualizar al estándar 1.1.0, que pinta los errores del servidor.

## 2026-10-17 · Bloque 46 · Prototipo del examen en línea (PILARES)

- Pedido de Liber: prototipo del examen en línea para el salón de cómputo del PILARES Vivero Nezahualcóyotl (el curso,
  en el aula del Vivero; el examen, a unos metros). Insumo: el cuadernillo vigente de renovación de poda (40 preguntas,
  60 minutos) y su hoja de respuestas con la evaluación práctica; su banco con clave queda fuera del repositorio (P85).
- Persona (`examen.html`, sin cuenta): código de un solo uso → ¿eres tú? → instrucciones → una pregunta por pantalla con
  reloj, avance, mapa y marca para revisar → revisar y enviar (confirmación) → calificación y qué sigue (aprobado: la
  credencial ese día; no aprobado: solicitud nueva). Recargar o cambiar de computadora vuelve al examen; tiempo agotado
  envía solo; suspensión y código repuesto se ven al momento.
- Quien aplica (`aplicar.html`, perfil simulado «instructor»): asistencia y derecho a examen, generar códigos, avance al
  momento, reponer código, suspender con motivo (formulario del estándar en un diálogo) e imprimir papeletas.
- Servidor simulado (`app/examen-servidor.js`) con las reglas de la API: orden por persona con semilla, respuestas al
  elegirlas, tiempo en el servidor, calificación sin redondear hacia arriba, la página sin la clave. Banco ficticio de
  24 preguntas sobre el propio trámite, con opciones de largo parecido y una pregunta con imágenes.
- Menú de pruebas: acciones propias por pantalla (`window.APD_PRUEBAS_AQUI`): usar el código de alguien del grupo,
  contestar todas bien o para no aprobar, dejar 1 minuto; generar todos los códigos y simular que todos envían. Cuenta y
  borra los códigos de examen guardados.
- Pruebas: `herramientas/probar-examen.mjs` (45 comprobaciones en teléfono y escritorio, con axe); `probar-sitio`
  sin cambios en sus resultados; esquemas `examen-entrar.json` y `examen-suspender.json` con 6 casos (generados con
  `estandares-sia/formularios`; el resto de los esquemas sigue con su versión). Auditor de CSS del estándar sin
  hallazgos en `app/examen.css`.
- Pendientes nuevos: P88 (redondeo), P89 (tiempo adicional por fallas), P90 (hallazgo de `esquema-desde-html`); P78
  construido, por aprobar.

## 2026-10-17 · Bloque 47 · Lanzamiento con correo; maqueta de grupos y asistencia

- Decisión de Liber: el sistema no se lanza hasta tener servicio de correo transaccional (P23 bloquea el lanzamiento); no
  se construye el comprobante imprimible de la cita.
- Maqueta `maquetas/etapa2-grupos/` (artefacto «Maqueta · Grupos y asistencia»): espera por curso con prioridad y
  vencidas, personas en espera con selección para un grupo, armar y confirmar un grupo (mínimo 5, máximo 25, fecha,
  hora de entrada, instructor, lugar fijo), asistencia por día del instructor. Cinco puntos para decidir.
