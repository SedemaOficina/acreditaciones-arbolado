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
  en el aula del Vivero; el examen, a unos metros). Insumo: el cuadernillo de poda de entonces, ya reemplazado por el
  vigente (bloque 54); el banco con clave queda fuera del repositorio (P85).
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

## 2026-10-17 · Bloque 48 · Decisiones de grupos

- Liber: grupos combinados con cualquier mezcla (20 de CFE, 3 de una alcaldía y 1 independiente); agregar personas a un
  grupo confirmado hasta el día anterior al inicio; el curso empieza al menos 7 días después de confirmar.
- Base: parámetro `dias_anticipacion_grupo` (7), reglas `anticipacion` y `grupo_por_iniciar`. 160 casos de reglas.
- Por preguntar al área: horario del curso (P91) y quién arma los grupos (P92). Maqueta actualizada.

## 2026-10-17 · Bloque 49 · Pase de lista con fotografía en el examen

- Pregunta de Liber: el instructor debe pasar lista y ver las fotos en el salón de cómputo; ¿por qué un código y no la
  cuenta? Se explicó (verificación presencial, computadoras compartidas, contraseñas olvidadas sin correo) y aprobó.
- «Aplicar el examen»: la lista muestra la fotografía de cada persona (ficticias: silueta dibujada en el navegador) y
  la asistencia de los días anteriores; «Presente» registra la asistencia del último día y genera el código en el mismo
  paso; «No llegó» y, si llega, «Llegó: marcar presente». Sin derecho a examen, sin botones. Resumen con cuántas faltan
  por pasar lista y cuántas no llegaron.
- «¿Eres tú?» con la fotografía de la persona.
- Un código en una sola computadora a la vez: cada pantalla avisa que sigue abierta cada 3 segundos; otra computadora
  no entra mientras la primera siga activa (12 segundos) y el intento se le muestra a quien aplica; si la computadora
  falla, se sigue en otra.
- Servidor simulado: un registro por código en el navegador y la señal de pantalla abierta aparte, para que dos
  pestañas no se pisen lo guardado (se detectó en la prueba: una pantalla abierta borraba lo que enviaba otra).
- Pruebas: `probar-examen.mjs` 54 comprobaciones (pase de lista, llegada tarde, foto, código en otra computadora,
  computadora que falla), con axe.


## 2026-10-17 · Bloque 50 · Estándar de formularios 1.3.1

- **El sitio usa el Estándar de formularios del SIA 1.3.1** (`SedemaOficina/estandares-sia`, carpeta `formularios/`;
  antes la copia 1.0.0). `construir-sitio.mjs` copia además los módulos `visor`, `version`, `chips` y `fecha`, y pdf.js
  4.10.38 del propio estándar (`sitio/vendor/pdfjs-dist/`; se quitó `pdfjs-dist` de `package.json`). La hoja del
  distintivo de versión es el módulo `version`.
- Se quitaron las soluciones provisionales: `app/auxiliar.js` (datos calculados como `<input type="hidden" data-auxiliar>`),
  `curp-nombre.js` y el campo `sin_segundo_apellido` (cruzadas `curp-nombre` y `curp-segundo-apellido` del estándar),
  `fecha-dma.js` (formato y escritura guiada del estándar, módulo `fecha`), `folio-fiscal.js`, `archivos-lleno.js`,
  `ver-contrasena.js` (el núcleo pone «Mostrar» dentro del campo), `visor.js` (`FormKit.visor.abre`), `APD.pintaErrores`
  (P86), el ajuste de `aria-required` (P47), el de «Cancelar» en «Mi perfil» (P87), la revalidación de la CURP (P44) y
  las reglas de `apd.css` que ya trae el estándar (P56, P71, P72, P73, S2-1, S2-2 y el visor).
- Mínimo de experiencia según el perfil con `data-min-segun="experiencia"` (P61): la regla pasó a
  `app/perfil-academico.js`, sin navegador, para que la use también el servidor (`limitesSegun`).
- Motivos frecuentes de la revisión con `data-chips-fijos` (P65). Textos del estándar en usted para el personal
  (`app/config-usted.js`): mensajes, visor y los formatos fecha, hora, RFC, número y folio fiscal.
- `probar-esquemas.mjs` sin el relleno de archivos (P46), con `auxiliares` y `limitesSegun`: ahora el servidor también
  rechaza menos experiencia de la que pide el perfil y un dato calculado que mande el navegador. 93 casos.
- Fotografía de la cuenta (Liber): la ayuda dice que tiene que verse clara porque quien aplica el examen la usa para
  confirmar que es la persona y tomarle asistencia.
- Pruebas: `probar-sitio.mjs` 452 de 452 con axe; `probar-examen.mjs` 53 de 53 con axe; `probar-esquemas.mjs` 93 de
  93; `auditor-css` sobre `apd.css`: 0 hallazgos; `auditar-campos`: 8 formularios correctos; guion de ficticios igual al
  anterior. Revisadas en teléfono y escritorio: cuenta (fecha, fotografía, contraseña),
  revisión (motivos frecuentes y visor), cotejo (visor y folio fiscal).
- Hallazgos nuevos para el estándar: P95 (mensajes de formatos y de longitud mínima fuera de «mensajes»), P96 (ruta de
  pdf.js con los módulos en otra carpeta), P97 (nombre del grupo de motivos frecuentes) y P98 (dos «Mostrar» con el
  mismo nombre accesible).

## 2026-10-17 · Bloque 51 · Examen sobre el estándar 1.3.1; «Aplicar el examen» en usted

- `aplicar.html` carga `app/config-usted.js` después de `validaciones.config.js`: los textos del estándar salen en usted
  («Complete «Motivo».»); `examen.html` sigue en tú, porque la usa la persona.
- `probar-examen.mjs` con axe sobre la versión 0.32 (estándar 1.3.1): 54 comprobaciones correctas, sin fallas.


## 2026-10-17 · Bloque 52 · Auditoría completa

Pedida por Liber antes de seguir con la etapa 2. Informe: `docs/AUDITORIA-2026-10-17.md`.
- Herramienta nueva `herramientas/auditar-sitio.mjs` (`npm run auditar`): recorre 20 estados en teléfono y escritorio y
  revisa consola, recursos, enlaces y anclas, ids, referencias ARIA, desborde, textos recortados, elementos encimados,
  objetivos táctiles, controles de menos de 44 px, elementos con `hidden` que se ven, y presiona cada botón visible para
  comprobar que hace algo. Revisión visual independiente de las 40 capturas, y de pendientes, mapa y documentación
  contra el código y la base.
- Corregido en el sitio:
  - combo abierto al retomar un borrador (`APD.avisa`, P99);
  - dato interno del curso calculado, con su prueba;
  - nombre global repetido (`APD_PERFIL_ACADEMICO`);
  - caja vacía en «Verificar» (`.resultado[hidden]`);
  - flecha del desplegable fuera de su caja;
  - encabezado y pie alineados con el contenido, y un solo ancho para las pantallas del personal (P102);
  - pie al fondo en páginas cortas; distintivo de versión sin tapar el pie;
  - línea de las filas de tabla bajo la columna de acciones (P103);
  - celda vacía sin «—» en «Aplicar el examen»;
  - avisos de pago espaciados; «Corregir y reenviar» como acción principal; motivo del rechazo como aviso;
  - recordatorio de observaciones en el paso 1; entrega el mismo día en «Mis trámites»;
  - folios y códigos de ejemplo que no se parten; datos alineados arriba;
  - textos que el personal propone a la persona, en tú; visor arriba del menú de pruebas;
  - catálogos con fuente y corte (P37).
- Base: mensajes de fotografía (en la cita no se toma otra), usted al personal, «Mi perfil», cupo 5–25, ejemplo de
  nombre de archivo ficticio; los ids de catálogos ya no cambian en cada exportación.
- Pendientes:
  - resueltos P13, P78 y P101 (Liber aprobó el funcionamiento del examen); P57 se unió a P91 y P48 a P10;
  - nuevos P99, P102, P103 y P104 (estándar) y P100 (actualizar una fotografía confirmada);
  - el tablero distingue «antes del lanzamiento».
- Mapa: reglas de grupos del 17/10 (R25, R56), envío (R57), lanzamiento con correo, entrega, fotografía, P94; examen
  aprobado (R55).
- Documentación al día: LEEME, DECISIONES, REGLAS, DECISIONES-SIA, ETAPA-1, ETAPA-2, AVISOS-POR-CORREO.
- Sin uso, fuera: dos reglas CSS, dos hojas viejas del distintivo de versión, cuatro capturas viejas, una comprobación
  sin efecto.
- Pendiente de Liber: quitar su correo personal del historial del repositorio público (requiere reescribir el
  historial y su permiso explícito).

## 2026-10-17 · Bloque 53 · Un solo examen de poda

- Liber: el examen de poda y derribo es el mismo para solicitud nueva y renovación; enviará el cuadernillo vigente para
  capturarlo en el banco de reactivos (P74, P84 actualizados).
- Banco ficticio: `examenes.poda` (uno solo) y `examenDe(tipo, modalidad)`, que busca primero el de la modalidad y luego
  el del tipo; lo usan el servidor simulado y «Aplicar el examen». `probar-examen.mjs` sin fallas.

## 2026-10-17 · Bloque 54 · Cuadernillo vigente de poda y ejercicios de caso

- Liber envió el cuadernillo vigente de poda y derribo («EVALUACION_PODADORES_2025»), el único que vale: se borró todo lo
  del cuadernillo anterior (banco, imágenes y archivos de trabajo, fuera del repositorio). Dictaminador también tiene un
  solo examen para nueva y renovación.
- Banco de reactivos (fuera del repositorio, P85): 52 reactivos, 40 de opción múltiple y 3 ejercicios de valoración y
  restitución con 4 reactivos cada uno; 60 minutos. 33 con respuesta marcada en el cuadernillo, 13 propuestos por la
  revisión (por confirmar, P84) y 6 sin clave válida (P105).
- Examen en línea: soporte para casos (enunciado y tablas compartidos por varias preguntas, que salen juntas y en orden;
  la tabla va como datos, no como imagen) y para opciones de orden fijo y de cinco opciones. Banco ficticio con un caso
  (FC1); el examen de poda se aplica completo, como el cuadernillo; dictaminador, un solo examen con valores de prueba.
- `probar-examen.mjs`: el caso va seguido y en orden, opciones de orden fijo, tabla con etiquetas en teléfono y axe en la
  pregunta del caso; 63 comprobaciones, 0 fallas. Auditor de CSS sin hallazgos.

## 2026-10-17 · Bloque 55 · Grupos y asistencia; textos claros para el personal

(Hecho en paralelo a los bloques 53 y 54 del otro chat; los hallazgos se renumeraron P109 a P112 porque P105 ya era del examen.)

- Pantallas nuevas del personal, según la maqueta aprobada (`maquetas/etapa2-grupos/`):
  - «Grupos» (`grupos.html`): la espera de los cuatro cursos (prioritarias, renovaciones con la acreditación vencida,
    si alcanza para un grupo y el grupo que se está armando) y los grupos con tipo, cupo, inicio, instructor y situación;
  - «En espera» de un curso (`espera.html`): elegir personas y agregarlas a un grupo que recibe, o crear un grupo nuevo
    (de una organización o combinado);
  - un grupo (`grupo.html`): personas, dar de baja y cancelar con motivo, confirmar con primer día (7 días de
    anticipación), hora de entrada e instructor;
  - «Asistencia» (`asistencia.html`, perfil simulado «instructor»): un botón por día, «Asistió» o «Faltó» con la
    fotografía de cada persona, corrección mientras el curso siga, aviso de quién ya no puede faltar o ya no tiene
    derecho a examen; el último día se registra al pasar lista en el examen (P94, opción recomendada mientras Liber
    decide). «Aplicar el examen» usa la misma cabecera del instructor.
- En la prueba, lo hecho se guarda en el navegador («apd.personal.grupos») y `app/archivos-prueba.js` lo aplica como la
  base; «Mis trámites» muestra el grupo confirmado con fecha y hora de entrada, y «Aplicar el examen» usa la asistencia
  capturada.
- Base: `apd.grupo.hora_entrada` (obligatoria para confirmar, P91); confirmar exige primer día, hora e instructor
  (`datos_para_confirmar`); una baja que deja a un grupo confirmado por debajo del mínimo lo regresa a integración con su
  fecha (propuesta de Claude). 162 casos de reglas.
- Liber: la hora de la cita de cotejo y la de entrada del curso se eligen de una lista cerrada de 24 horas, sin texto
  libre; los horarios son de prueba hasta que el área los defina (P69, P91). La revisión del personal ya no muestra el
  nombre del archivo original (queda en la base para aclaraciones).
- Liber: los textos no deben usar nombres de estados del sistema («pasa a "En espera de grupo"») sino decir qué pasa y
  qué sigue. Revisión de todos los textos de las pantallas, de los mensajes de la base (nueva `apd.nombre_estado` para
  los cambios no permitidos) y de `docs/AVISOS-POR-CORREO.md`: «expediente físico», «el siguiente paso es asignarle un
  grupo del curso», «Por confirmar» en lugar de «En integración», «De una organización» en lugar de «Específico»,
  «Queda registrado en el sistema» en lugar de «Queda en la bitácora». El inventario de textos (`docs/textos/`) no se
  regeneró: espera las correcciones de Liber.
- Formularios del estándar: crear, confirmar, dar de baja y cancelar (esquemas `grupo-*.json`, 10 casos nuevos; 104 en
  total). Arrancan a mano después de pintar la página (`data-formkit="manual"`), igual que «Suspender el examen».
- Pruebas: `probar-sitio.mjs` 522 de 522 con axe (grupos, espera, grupo, asistencia en teléfono y escritorio);
  `probar-examen.mjs` 53 de 53 con axe; `probar-esquemas.mjs` 104; `probar-base` 162; auditor de CSS sin hallazgos;
  `auditar-campos` 166 campos en 12 archivos; `npm run auditar` 25 estados × 2 tamaños, 138 botones, sólo los dos
  encimados conocidos del menú de pruebas.
- Hallazgos nuevos para el estándar: P110 (el módulo tabla sólo se inicia con un formulario), P111 (un formulario
  iniciado dos veces) y P112 (el límite de una fecha en AAAA-MM-DD).
- Pendientes: P109 (quitar el correo personal de Liber del historial, espera su autorización); P94 y P100 siguen para
  decisión de Liber.

## 2026-10-17 · Bloque 56 · Avisos y confirmaciones

- Liber: las confirmaciones, ventanas, letreros y etiquetas no dejaban claro si algo se aceptó, se rechazó o salió bien,
  en parte porque el estándar no distingue esos casos. Revisión de 131 momentos de todas las pantallas y propuesta
  «Avisos y confirmaciones del trámite»; Liber la aprobó completa («aplica todo») y pidió llevar al estándar lo que sirva.
- `app/apd.js`: `pintaDesenlace`, `confirma`, `aviso`, `pintaAviso`, `estado` con familias e icono, `estadoSolicitud`,
  `nombrePersonal`; la hora se escribe en 24 horas («a.m..» ya no sale). `app/apd.css`: desenlace, confirmación,
  `.btn-peligro` relleno, filas que faltan por marcar, etiqueta «Código nuevo».
- Pantallas: revisar, cotejo, corregir, grupos, espera, grupo, asistencia, aplicar, examen, «Mis trámites», datos,
  verificar y entrar (detalle en `docs/ETAPA-2-PANTALLAS.md`, §2d). La cruzada de la CURP en «Crear cuenta» se ordena
  nombre → segundo apellido → fecha, para que una CURP con otra fecha no dé el mensaje del segundo apellido.
- Pruebas: `probar-sitio.mjs` 526 de 526 con axe; `probar-examen.mjs` 63 de 63 con axe; `probar-esquemas.mjs` sin
  errores; auditor de CSS sin hallazgos; `auditar-campos` 166 campos; `npm run auditar` sólo los dos encimados conocidos
  del menú de pruebas. 234 capturas antes y después revisadas a ojo.
- Hallazgos nuevos para el estándar (también en el documento de fallas del estándar): P113 (no hay pieza de desenlace y
  `FormKit.confirma` no distingue gravedad), P114 (`.btn-peligro` sólo de contorno), P115 (el aviso no tiene título),
  P116 (el resumen de errores habla de «campos» y repite etiquetas sin contexto), P117 (`FormKit.anuncia` permite
  mensajes que no se ven) y P118 (no hay módulo de etiquetas de estado).

## 2026-10-17 · Bloque 57 · «Qué sigue» en pasos; espera agrupada por adscripción

- Liber: los cierres que encadenan varias acciones («Abra el expediente físico… El siguiente paso es asignarle un
  grupo… La persona ve su número…») se leen mejor como pasos numerados. Nuevo `APD.sigueEn` (texto del hecho y lista
  `ol.pasos` bajo «Qué sigue»), que usan `APD.aviso`, `APD.pintaDesenlace` (opción `pasos`) y la ficha de «Mis
  trámites». Aplicado donde había dos o más acciones en orden (detalle en `docs/ETAPA-2-PANTALLAS.md`, §2d). En el
  cotejo terminado se quitó el dato «Siguiente paso», que repetía el paso 2; con la cita sin pago, la ficha ya no repite
  los pasos del aviso.
- Liber: «En espera» agrupada por adscripción. Un bloque por adscripción con su cuenta, «Alcanza para un grupo propio»
  o cuántas faltan, y una casilla para elegirlas a todas (marca intermedia si sólo algunas). La columna «Adscripción»
  pasa a ser el título del bloque. En teléfono el título del bloque no es tarjeta.
- Corrección: la espera salía en «-1 días» con solicitudes enviadas en el navegador, que llevan la fecha real (posterior
  a la simulada). `APD_PERSONAL.espera` y `enEspera` ya no dan días negativos.
- Pruebas: `probar-sitio.mjs` 534 de 534 con axe (8 nuevas: agrupación, cuenta por bloque, casilla del bloque, días no
  negativos, pasos del cotejo terminado y de «Mis trámites»); `probar-examen.mjs` 63 de 63; esquemas sin errores; auditor
  de CSS sin hallazgos; `auditar-campos` 171 campos en 18 archivos; `npm run auditar` sólo los dos encimados conocidos.
- Hallazgo nuevo para el estándar: P119 (la secuencia numerada de «qué sigue» sólo existe dentro del acuse).
- Recomendaciones de mejora: Liber pidió registrar dos como pendientes: P120 (suspensión y revocación de una
  acreditación, para la Dirección con la Dirección Jurídica) y P121 (avisos de renovación por correo a los 90 y 30 días
  y el día que vence; el de 90 días choca con la ventana de renovación de 30 días y queda como preaviso sin enlace
  mientras Liber decide). Los avisos A0 y A3 bis se agregaron como propuesta a `docs/AVISOS-POR-CORREO.md`.


## 2026-10-17 · Bloque 58 · Auditoría de tareas de las pantallas del personal

- Liber pidió revisar las pantallas del personal con tres métodos (una pregunta de trabajo por pantalla, cada regla
  visible donde se aplica y volúmenes reales) y entregar hallazgos antes de cambiar nada. Resultado en
  `docs/AUDITORIA-TAREAS-2026-10-17.md`: 5 de prioridad alta, 11 media y 8 baja, cada uno comprobado en el código.
  Escenario de volumen y guion de capturas en `docs/auditoria-tareas/`. No se cambió código del sitio.
- Decisión que queda para Liber (A4): si la cuenta de inasistencias a la cita de cotejo se reinicia cuando la solicitud
  se vuelve a validar.

## 2026-10-17 · Bloque 59 · Correcciones de la auditoría de tareas

- Liber: «adelante corrige». Corregidos los hallazgos A1, A2, A3, A5 y M1 a M10, y los bajos que no dependían de nada
  (detalle y estado de cada uno en `docs/AUDITORIA-TAREAS-2026-10-17.md`).
- A4: Liber lo deja pendiente (P123). Mientras, la pantalla del cotejo cuenta las inasistencias como la base (todas las de
  la solicitud, con el parámetro `inasistencias_cotejo_maximas`) y la prueba ya no las reinicia al validar de nuevo.
- M11 (dos revisoras con la misma solicitud) queda para la etapa 3 (P122).
- Base: un folio fiscal repetido da `folio_fiscal_repetido` con su mensaje (antes, sólo la restricción única); 162 casos.
- Nueva prueba `herramientas/probar-volumen.mjs` (`npm run volumen`): genera el escenario de volumen (ahora también con un
  grupo con un día sin capturar, tres citas atrasadas y una pausa vencida) y comprueba cada corrección en teléfono y
  escritorio, sin errores ni tablas ensanchadas.
- Pruebas: `probar-sitio.mjs` 534 de 534 con axe; `probar-examen.mjs` 63 de 63; `probar-volumen.mjs` 50 de 50;
  esquemas sin errores; `probar-base` 162; auditor de CSS sin hallazgos; `auditar-campos` 171 campos.
- Liber aceptó declarar las pantallas del personal «para computadora»: primero escritorio; en teléfono sólo que funcionen
  (DECISIONES, Alcance). No se bloquea el teléfono. Asistencia, examen y todas las pantallas de la persona se cuidan en ambos.

## 2026-10-17 · Bloque 60 · Auditoría integral

- Liber: «realiza auditoría de todo». Cinco frentes: pantallas de la persona, coherencia entre documentos, código y base,
  textos, seguridad y datos personales, y pruebas y peso. Resumen priorizado en `docs/AUDITORIA-INTEGRAL-2026-10-17.md`
  (11 hallazgos altos); detalle en `docs/auditoria-integral/`. El informe de seguridad describe puntos débiles de la
  base y no va en este repositorio público: está en los documentos del proyecto.
- Errores míos que la auditoría encontró y se corrigieron de inmediato: la barra de pasos 1-2-3 de la solicitud
  (0.40; los «Qué sigue» de 0.38 usaban el nombre de estilo del módulo de pasos del estándar) y la palabra «null» en las
  ventanas de confirmación (0.41; desde 0.37). Pruebas nuevas para los dos; `probar-volumen` revisa además que ninguna
  pantalla muestre «null», «undefined» o «NaN».
- Aviso a Liber: borrar en sus navegadores lo que cargó con datos reales en la prueba (el sitio comparte dirección con
  los demás sitios de SedemaOficina en GitHub Pages).
- Pendiente nuevo: P124 (quién pasa un grupo a «en curso» y a «concluido»). El resto espera la aprobación de Liber.
- 2026-10-18 · Respuestas de Liber a las preguntas de la auditoría integral (DECISIONES, «Decisiones del 2026-10-18»):
  P94, P123 y P14 resueltos; P125 nuevo (grupo que vuelve a integración y los 7 días). Sigue la actualización al
  estándar de formularios 1.4.1 y después las correcciones de la auditoría.


## 2026-10-18 · Bloque 61 · Estándar de formularios 1.4.1

- Instrucción del proyecto: pasar del estándar 1.3.1 al 1.4.1 y resolver P90, P95–P99, P102–P104 y P110–P119.
  Copia regenerada con los módulos nuevos `resultado` y `estado`.
- Parte A (hasta la 1.3.4): `probar-esquemas` ya no extrae el `<form>` (P90); los textos de usted pasan a
  `app/mensajes-usted.js` y al servidor con `validaPayload(…, { mensajes })`, y se quitó `app/config-usted.js` (P95,
  P112); sin `visor.pdfjs` (P96); `data-chips-etiqueta` con el nombre de cada documento (P97); sin el cierre de la lista
  en `APD.avisa` (P99); sin las reglas propias de cabecera, pie y tabla (P102–P104); «Grupos» sin `data-etiqueta` a
  mano y con `formkit:tabla` al repintar (P110).
- Parte B (1.4.0 y 1.4.1): `FormKit.confirma` con consecuencias en lugar de `APD.confirma`, y el módulo `resultado` en
  lugar de `APD.pintaDesenlace` en la revisión documental, el cotejo y la corrección (P113); `.btn-peligro-contorno` en
  los botones que abren una confirmación (P114); avisos con título (P115); `data-contexto` en cada documento para el
  resumen de errores (P116); etiquetas de estado en las cinco familias del estándar (P118) y «qué sigue» en
  `ol.secuencia` (P119). Cada anuncio ya tenía su texto a la vista (P117).
- Hallazgos nuevos para el estándar: P126 (la etiqueta de estado no se corta y ensancha su tarjeta en teléfono; se
  corrige en `apd.css`) y P131 (`FormKit.aviso` sólo recibe texto: los avisos con pasos o enlaces se siguen armando en
  el proyecto). De la auditoría integral: P127 (EXIF de la fotografía), P128 (hora del acuse en 12 horas), P129 (la Ñ
  del RFC) y P130 (peso del logotipo).
- Pruebas: `probar-sitio` 538 (con axe), `probar-examen` 63, `probar-volumen`, `probar-esquemas` y `probar-base`
  correctas; auditor de CSS sin hallazgos. Una corrida de `probar-sitio` se detuvo por tiempo al dar de baja en un
  grupo; la siguiente pasó completa. Las herramientas de prueba aceptan ya una ruta absoluta para las capturas.
- Documento de fallas del estándar: los diecinueve hallazgos pasan a «Hallazgos resueltos» con su versión; versión del
  estándar que usa el proyecto: 1.4.1.

## 2026-10-18 · Bloque 62 · Correcciones de la auditoría integral

- **Alta 1:** todas las páginas con `noindex`; la franja de prueba dice «usa datos inventados, nunca los tuyos»; aviso
  en «Crea tu cuenta» y en los documentos de la solicitud; lo guardado en el navegador se borra solo a los 7 días sin
  usar la prueba (`APD_ARCHIVOS_PRUEBA.caduca`, antes de leer los datos).
- **«Mis trámites»:** la fecha del curso sólo con el grupo confirmado (alta 2); en una cita nueva, «si ya pagaste, no
  pagues otra vez» (alta 3); el cierre por dos inasistencias se lee del motivo que guarda la base y la prueba escribe
  el mismo (alta 5); la pausa vencida se ve del lado de la persona y «Cargar el documento» ya no deja cargar (alta 6);
  «Corrige y reenvía» dice que hay un plazo y que lo que corrige está arriba (alta 10); con grupo, «Qué sigue» dice que
  lleve la identificación oficial, cuándo es el examen y la calificación mínima (alta 11); credencial en la oficina del
  Vivero; los mismos rótulos de fechas que «Mis acreditaciones»; «Lugar del curso».
- **P94:** la base exige que el examen sea el último día del curso (`fecha_examen`) y que exista el pase de lista de
  ese día (`sin_pase_de_lista`); en la prueba, el pase de lista del examen cuenta como asistencia del último día.
- **P14:** al activar una cuenta del registro anterior, el nombre completo se compara sin acentos y admite una letra
  distinta; el error se marca junto al nombre. Falta un medio de contacto: P132.
- **Decisiones del 18/10:** la situación del grado sólo con licenciatura (formulario, base y perfil); la renovación de
  dictaminador ya no pide los años de experiencia; la primera renovación de quien viene de Kobo sin archivos pide todos
  los documentos (página y base, `faltan_documentos_kobo`; los ficticios se regeneraron con esos documentos). El sexo ya
  era dato interno: sólo se ve en la versión de prueba, con su nota.
- **Textos:** «Las preguntas con * son obligatorias»; inicio «en PDF»; «Entrar» sin el pendiente P13, ya resuelto;
  acuse de la cuenta sin «Entra con tu CURP»; monto de prueba con fecha día/mes/año; tres mensajes de la base al
  personal en usted; sin primera persona del plural en dos textos.
- Copia del sitio reconstruida con los datos ficticios nuevos (documentos de la renovación de Kobo, situación del grado). Corregido en el camino: `APD.cargar` leía el módulo de la prueba antes de que se cargara y las cuentas nuevas
  perdían la sesión (lo encontró `probar-sitio`).
- Pruebas: `probar-sitio` 558 (con axe; 20 nuevas), `probar-examen` 63, `probar-volumen`, `probar-esquemas` (3 casos
  nuevos) y `probar-base` 165 (3 nuevos), todas correctas.

## 2026-10-18 · Bloque 63 · «Mi perfil» y «Mis trámites» más claros

- **«Mi perfil»:** sin el número de expediente (es de la carpeta física y ya se ve en «Mis trámites»); el sexo se ve
  como un dato más, de sólo lectura, también en «Crea tu cuenta» (ya no en el recuadro amarillo de dato interno: así
  lo pidió Liber); la adscripción con rótulo y valor, cada dato en su renglón («Tipo», «Nombre o razón social»,
  «Alcaldía», «Dependencia», «Dirección General»), igual en la solicitud y en las fichas del personal; texto nuevo:
  «Puedes cambiarla cuando quieras: tus siguientes solicitudes se envían con la nueva…».
- **«Mis trámites»** en tres bloques: «Solicitudes en curso», «Mis acreditaciones» y «Solicitudes anteriores» (sólo si
  hay). La etiqueta de la persona dice «En espera de curso»; el personal sigue viendo «En espera de grupo».
- Un dictaminador por renovar con la poda vencida ya ve por qué no aparece «Renovar»: renovar primero la de poda.
- **Cotejo:** la ayuda del folio fiscal dice que también se llama UUID (Identificador Universalmente Único).
- Corregido en el camino: `.seccion` tapaba el atributo `hidden` (regla `.seccion[hidden]`).
- `probar-sitio` deja en la consola el estado del diálogo si «Dar de baja» vuelve a fallar por tiempo (falló dos veces
  en el día y no se ha podido reproducir).
- Pruebas: `probar-sitio` 559 (con axe), `probar-examen`, `probar-volumen` y `probar-esquemas`, correctas.

## 2026-10-18 · Bloque 64 · Menú de pruebas en dos pasos y casos para todo

- **Menú de pruebas:** «¿Quién?» (persona nueva · podador · dictaminador · del registro anterior, sin cuenta · personal
  de la Secretaría) y «¿En qué momento?», con los casos de ese perfil agrupados por etapa y lo que se puede probar. Un
  caso del registro anterior abre «Crea tu cuenta» llenada con su CURP; uno del personal abre la pantalla de su papel
  (revisión documental, citas de cotejo, grupos, instructor: asistencia y aplicar el examen).
- **38 casos** (antes 20). Nuevos en los datos ficticios: cita nueva por no presentarse, cita nueva sin comprobante de
  pago, cita en pausa hoy, pausa vencida, cerrada por dos inasistencias, grupo por confirmar con fecha propuesta,
  aprobó el examen hoy (grupo de cinco que termina en la fecha de corte), por vencer sin trámite, dictaminador por
  vencer con la poda vencida y una persona del registro anterior por renovar.
- **Lo que guarda la base y leen las pantallas:** `APD.cargar` saca de las citas (`apd.cita`) la cita nueva y su
  motivo, la pausa y las inasistencias (parte del contrato de la API de la alta 5).
- «Mis trámites»: «Grupo por confirmar» como etiqueta; en una cita en pausa ya no se muestran los datos de pago.
- **Rótulo contra ayuda (en toda la plataforma):** los rótulos de los datos van en versalitas, más chicos y oscuros; las
  ayudas siguen en minúsculas, gris claro, bajo el título de su sección y separadas de los datos; más aire entre datos.
- Pruebas: `probar-reglas` con referencias fijas (los casos nuevos movían «la primera cita» y «el grupo en
  integración»); `probar-examen` abre el grupo de diez personas por su folio. `probar-sitio` 561 (con axe),
  `probar-examen` 63, `probar-volumen`, `probar-esquemas`, `probar-base` 165, auditor de CSS: correctos.

## 2026-10-18 · Bloque 64 bis · Cuadernillo de poda corregido y cotejado con la norma

- Liber: basta con fijar en el ejercicio el valor de la unidad (no se actualiza cada año) y las cuestiones de formato las
  corrige la Oficina, sin esperar al área técnica. Envió la NADF-001-RNAT-2015 y el Manual Técnico de Poda (2023).
- Versión corregida del cuadernillo (fuera del repositorio, P85): preguntas en negritas y respuesta en rojo, numeración
  1 a 52, opciones a) a d), tablas del Anexo 3 como texto, ilustración de los tres cortes en cuatro imágenes, preguntas
  directas y ortografía; cada cambio, como comentario donde se hizo y en un registro de cambios; hoja de claves.
- Cotejo: 7 respuestas no marcadas están en el texto de la norma; las preguntas 2, 10 y 21 no coinciden con la norma y
  la 32 no se pudo verificar; la Tabla 4 está en UCDMX, no en UMA (P84 y P105 al día).

## 2026-10-18 · Bloque 65 · La 2.ª revisión sólo pide lo corregido

- Liber: en una 2.ª revisión en la que sólo se pidió corregir un documento, no tiene sentido volver a revisar todos.
  Ahora los documentos aceptados en una revisión anterior y sin cambios se ven con «Aceptado antes» y la nota «Se
  aceptó en una revisión anterior y la persona no lo cambió», sin pedir decisión; cuentan como aceptados para validar.
  Quien revisa puede reabrir cualquiera con «Revisarlo de nuevo». El visor abre el primero por decidir.
- La regla del servidor es la misma (`decidir_<requisito>`, auxiliar nuevo): lo aceptado antes no se vuelve a decidir
  salvo que llegue su decisión. Dos casos nuevos en `probar-esquemas`; `probar-sitio` 564 (con axe).

## 2026-10-18 · Bloque 66 · Datos como ficha (opción B)

- Liber: el rótulo y el dato seguían viéndose casi iguales. Se le mostraron tres opciones (página aparte, con la ficha
  de una solicitud) y eligió la B: cada dato en su renglón con una línea fina entre renglones, el rótulo en una
  columna, gris claro y sin negritas, y el dato en otra, en tinta y peso medio; en teléfono, el rótulo arriba del dato.
  Se aplica en todas las pantallas que usan `APD.datosLista` («Mi perfil», «Mis trámites», revisión, cotejo, grupos,
  datos de pago). Quedan fuera de este cambio los rótulos de los formularios, que son del estándar.
- Pruebas: `probar-sitio` 564 (con axe), `probar-examen` 63, `probar-volumen` y auditor de CSS, correctos.

## 2026-10-18 · Bloque 67 · Renglones completos, chips y concentrado de asistencia

- Liber: en varias pantallas la línea bajo el título pasaba al segundo renglón con espacio de sobra («reenviada con
  correcciones…», solicitudes por revisar, citas de cotejo). Causa: el estándar limita `.bajada` y `.ayuda-bloque` a
  70 caracteres. El proyecto quita el límite y arma las líneas de datos con `APD.meta` (cada segmento no se parte; en
  teléfono, cada uno baja completo). Hallazgo del estándar P134.
- Liber: los chips de motivos frecuentes se veían mal. Causa: el estándar los limita a 240 px y los encoge (el motivo
  largo se partía dentro de la píldora) y su paso del cursor es igual a «elegido». El proyecto: `flex-shrink: 0`,
  `max-width: 100%` y el paso del cursor sólo marca el borde. Hallazgo del estándar P135.
- Liber: la asistencia por día tiene sentido porque se pasa lista, pero hace falta verla en conjunto. Nuevo
  `APD_PERSONAL.pintaConcentrado`: tabla con una fila por persona y una columna por día (Asistió / Faltó / Sin
  capturar / Hoy / Por venir; el día del examen, Presente / No llegó), días asistidos y situación ante el examen
  (Con derecho, Ya no puede faltar, Sin derecho, Lo presentó). Está al pie de «Asistencia» y en la ficha del grupo en
  curso o concluido (el registro queda después del curso).
- Pruebas: `probar-sitio` 572 (con axe; nuevas: concentrado tras guardar y en un grupo concluido), `probar-examen` 57,
  `probar-volumen` y auditor de CSS, correctos.

## 2026-10-18 · Bloque 68 · Material de estudio

- Liber: antes del examen debe haber material para estudiar. Recomendación dada (guía por temas, regla de alcance,
  práctica, resultado por tema); Liber decidió el material: la norma ambiental, el manual de poda y la Ley Ambiental,
  documentos de la Secretaría que se suben al sistema, no enlaces; el examen es a libro cerrado.
- Base: tabla `apd.material_estudio` (clave del documento, datos, apartados en `temas` con su página del PDF,
  publicado, archivo en el almacén; una carga vigente por documento), reglas `material_alta` y `material_cambio`
  (sólo personal, sólo PDF, máximo por parámetro `tamano_maximo_material_bytes` = 30 MB, el archivo no se modifica,
  reemplazar conserva la publicación, todo a la bitácora) y vista pública `apd.material_publico`. Siete casos nuevos
  en `probar-reglas`.
- Sitio: `material.html` (pública, tú): los documentos publicados con su edición, abrir y descargar, y «Qué estudiar»
  con enlace a la página del PDF; filtro poda / dictaminador (el dictaminador ve además los formatos de dictamen).
  Enlaces desde el inicio y desde «Mis trámites». `material-personal.html` (usted): agregar, editar datos y
  apartados, reemplazar archivo, publicar y ocultar (con confirmación); las páginas se cuentan con pdf.js y un
  apartado que cita una página inexistente no se guarda.
- Archivos en `sitio/material/`. El manual se publica en una copia optimizada (12 MB en lugar de 18 MB: imágenes
  recomprimidas, mismo texto y páginas) para teléfono y para el artefacto; queda en P136 si se usa el original.
- Apartados por documento: propuesta tomada de los índices (páginas del PDF verificadas); el temario del examen lo
  confirma la Secretaría (P136).
- Pruebas: `probar-base` y `probar-reglas` 173, `probar-sitio` 602 (con axe; 13 nuevas de material), `probar-examen`
  57, `probar-esquemas`, `probar-volumen` y auditor de CSS, correctos.

## 2026-10-18 · Bloque 69 · Asistencia: lista del día (propuesta A)

- Liber: la pantalla de asistencia tenía demasiado (botones por día, avisos por persona, concentrado con etiquetas).
  Se le mostraron la pantalla actual y dos propuestas lado a lado (lienzo «Asistencia: propuestas»); eligió la A.
- «Asistencia»: título con el día («Día 2 de 5 · miércoles 14/10»), regla de faltas permitidas y leyenda de la tira
  de puntos; una fila por persona con fotografía, nombre, puntos (asistió, faltó, hoy, sin capturar, por venir,
  examen; con su texto para el lector de pantalla) y los dos botones; etiqueta sólo con riesgo; «3 asistieron · 1
  faltó · 1 sin marcar» junto a «Guardar»; «Corregir otro día» con los días anteriores (y «Volver al día de hoy»).
  Un día anterior sin capturar se sigue avisando arriba. El día del examen sólo dice que la asistencia se registra
  al pasar lista. Con 10 personas, en teléfono la pantalla pasa de 7 351 px a unos 2 300 px.
- Ficha del grupo: «Asistencia por día» con ✓ (gris) y ✗ (negritas), «Sin capturar» con su texto, y sólo «Sin
  derecho» en color; la falta del día del examen ya no cuenta para el derecho a examen.
- Pruebas: `probar-sitio` 602 (con axe; las de asistencia, actualizadas a la lista del día), `probar-examen` 57,
  `probar-volumen` y auditor de CSS, correctos.


## 2026-10-18 · Bloque 70 · Cruce con el anteproyecto de lineamientos

- Liber pidió trabajar los lineamientos que ordena la Ley Ambiental (art. 111, párrafo segundo: los del dictaminador técnico y los de la supervisión y ejecución de los trabajos; el Octavo Transitorio fija el plazo de los del dictaminador; la NADF-001-RNAT-2015, 5.1, prevé los lineamientos de las acreditaciones correspondientes). Se redactó el anteproyecto (versión de trabajo 0.4) en otro chat del Proyecto; por ser este repositorio público,
  el texto queda fuera y aquí sólo va el cruce (`docs/DECISIONES.md`, «Lineamientos»).
- `docs/pendientes.json`: campo `lineamientos` (qué artículo del anteproyecto toca cada pendiente) en 44 pendientes;
  recomendaciones actualizadas en P02, P03, P04, P11, P16, P19, P49, P100, P120 y P121; P133 resuelto; nuevos P137 a
  P144 (firma, huella y antigüedad en la credencial; mayoría de edad; aceptación de notificaciones electrónicas;
  reposición de la credencial; catálogo público de carreras; baja voluntaria de un grupo; espera máxima de grupo;
  «cuota» en lugar de «pago de derechos»).
- `herramientas/generar-pendientes.mjs` y la plantilla del tablero muestran la columna o el recuadro «Lineamientos».
- Sin cambios en el sitio ni en la base: la versión de prueba sigue en 0.50.

## 2026-10-18 · Bloque 71 · Asistencia: ✓/✗ y recorrido de prueba (0.51 y 0.52)

- Ajuste (Liber): la tira usa ✓ verde y ✗ rojo; se quitan los días por venir y el aro del examen (el punto gris
  parecía otra cosa). En la versión de prueba vuelve el recorrido de todos los días: una franja «Versión de prueba:
  recorrer el curso día por día» con los cinco días (los que aún no llegan se capturan como «simulado»; el del examen
  abre «Aplicar el examen»). `probar-sitio` 604, `probar-volumen` y auditor de CSS, correctos.
- Ajuste (Liber): en la versión de prueba, guardar la asistencia lleva al día siguiente del curso («Sigue el día 3
  (simulado)»); al guardar el penúltimo día, el aviso ofrece ir a «Aplicar el examen». En el SIA, guardar se queda en
  el día. La etiqueta de riesgo va en el renglón de la tira (no alarga la fila; en teléfono, si no cabe, baja completa
  en un renglón) y la franja del recorrido de prueba ya no queda pegada a los botones. `probar-sitio` 606, correctas.

## 2026-10-18 · Bloque 72 · Auditoría completa y correcciones (0.53)

- Liber pidió una auditoría para dejar todo limpio. Cinco frentes revisados por separado y sin cambiar nada
  (código, botones y pasos, datos, interfaz, documentos); después, tres equipos de corrección con archivos asignados
  (datos y prueba; pantallas de la persona; pantallas del personal, herramientas y limpieza). Resumen, lo corregido y
  lo que queda abierto: `docs/AUDITORIA-2026-10-18.md`. Los informes completos, en los documentos del proyecto.
- Lo más importante: persistencia de la versión de prueba (pausa ficticia, revisiones en reenvíos, examen en línea,
  material), borrador e historial en la solicitud, corrección que abre en lo observado, cita al principio de la ficha,
  fechas dd/mm/aaaa del estándar, familias de estado, tablas que ya no parten palabras, código sin uso fuera,
  capturas fuera del historial.
- Pruebas: `probar-sitio` 658 (con axe), `probar-examen` 73, `probar-volumen`, `probar-esquemas` 118, `probar-base` y
  `probar-reglas` 173, auditor de CSS, esquema y pendientes al día, `auditar-sitio` (56 pantallas, 153 botones).


## 2026-10-18 · Bloque 73 · Sin supervisor, examen de prueba de 10 preguntas y calendario en las fechas

- Decisión definitiva de Liber: no habrá perfil ni acreditación de supervisor. Se quitó de las decisiones abiertas y de
  los documentos del proyecto (anteproyecto de lineamientos, registro de reforma de la Norma, banco del examen propuesto).
- Examen en línea: por ahora sólo la interfaz, con 10 preguntas ficticias de opción múltiple; el examen real y su
  página se construyen después. Se quitaron casos, tablas y opciones con imagen del prototipo.
- Fecha de la cita (revisión y cotejo) y primer día del curso: además de escribirla, se elige en el calendario del
  navegador, que la escribe en dd/mm/aaaa (app/apd.js). La fecha de nacimiento sigue sin calendario.
- Pruebas: `probar-sitio` 660 (con axe; incluye el calendario de la cita), `probar-examen` 74, `probar-esquemas`.

## 2026-10-18 · Bloque 74 · Grupos como planeador por curso, «Programar un curso» y nombre calculado del grupo

- Liber aprobó tres propuestas del lienzo «Grupos» (A, B y D); la C (calendario del Vivero con todos los cursos) queda
  para después.
- **A · Planeador por curso** (`grupos.html?curso=…`, `app/grupos.js`): fecha de hoy, «Programar un curso» y los cuatro
  cursos con `aria-pressed` (cuántas esperan, cuántas vencidas; el curso en la dirección). «En espera · N» con las de una
  misma organización juntas y la barra de elegidas (fija en computadora) con un botón por grupo que recibe y «A un curso
  nuevo…». «Próximas semanas»: esta semana y siete más, cada grupo con su cupo de 25 lugares, «Completar con las N que
  más esperan» (por bloques completos de organización), «Confirmar el grupo» (con `FormKit.confirma` si ya tiene fecha
  a tiempo, hora e instructor; si no, en la ficha), «Elegir semana» / «Cambiar la semana» y «Ver a las personas»; la
  semana libre lleva «Programar un curso esta semana» y la que no se puede lo explica en una línea. «Sin fecha» y
  «Grupos que ya terminaron». `espera.html` ya sólo redirige a Grupos con el mismo curso (y `?grupo=`, que sigue
  sirviendo para «Agregar personas de la espera» desde la ficha).
- **B · Programar un curso** (`programar.html`, `app/programar.js`, nueva): calendario accesible del mes (botones con
  `aria-pressed`, razón en el nombre de los días que no se pueden, flechas/Inicio/Fin/RePág/AvPág), el campo «Primer día
  del curso» sincronizado, instructor (libre u ocupado esas fechas) y hora, personas propuestas y tipo de grupo; «Así
  quedaría»; «Crear y confirmar el grupo» dice qué falta y «Guardar sin confirmar» deja la fecha como propuesta. También
  programa un grupo por confirmar que ya existe (`?grupo=`). Evento nuevo de la prueba `proponer` (fecha, hora e
  instructor de un grupo en integración; la base ya lo admite). Días inhábiles: lugar listo (`dias_inhabiles`), sin
  fechas inventadas.
- **D · Nombre calculado** (`APD.nombreGrupo`, `APD.grupoTitulo`, `APD.cursoCorto`, `APD.cursoLargo`): «Poda nueva · del
  13 al 17 de octubre · Iztapalapa», con el folio en chico debajo, en Grupos, la ficha, «Asistencia», «Aplicar el
  examen» (y papeletas) y «Mis trámites» (grupo confirmado). «Asistencia» y «Aplicar el examen» sin `?folio=` abren en
  «Mis grupos de hoy» (`APD_PERSONAL.pintaMisGrupos`) con «Próximos».
- Menú de pruebas: «Programar un curso» en «Ir a otra pantalla» y caso «Personal · Programar un curso»; `auditar-sitio`,
  `capturas-volumen` y `probar-volumen` al día; esquema `grupo-crear.json` ahora del formulario «programar».
- Pruebas: `SOLO=grupos probar-sitio` 172 correctas; `probar-sitio` completo 744 (con axe, incluidas Grupos, Programar,
  Programar con error y «Mis grupos de hoy»); `probar-examen` 74; `probar-esquemas` 120; `probar-volumen` 52; auditor de
  CSS del estándar sin hallazgos en `apd.css` y `examen.css`; `auditar-sitio` 60 pantallas y 201 botones, con los mismos
  3 hallazgos que ya tenía (visor junto al menú de pruebas en revisar y cotejo; «Ir al contenido» en corregir), ninguno
  de las pantallas nuevas.
- Queda por decidir: si dos grupos del mismo curso pueden coincidir en fechas (el calendario no lo deja; la ficha del
  grupo y la base sí).

## 2026-10-18 · Bloque 75 · Auditoría «intentar romperlo» · bloque 1

- Liber aprobó corregir el bloque 1 de la auditoría «intentar romperlo» (`docs/AUDITORIA-2026-10-18-romper.md`): los
  errores de lógica que pasarían al sistema real. Quedan para los bloques 2 (dos pestañas, dos personas, doble clic) y 3
  (guardados que fallan sin avisar) los hallazgos que les tocan. El estándar sigue en la 1.4.1 (`sitio/formkit/` sin
  cambios): lo que es suyo se rodea en `app/` y queda dicho en el código como hallazgo para el estándar.
- **Persona (F1 5 a 13):** el reenvío guarda estudios, experiencia y adscripción corregidos y recalcula el perfil
  (`archivos-prueba.js`, evento «envio»); «Mi perfil» propone lo último guardado; «Empezar de nuevo» y el envío borran los
  documentos del borrador (`borraDocumentos`); un PDF con `/Encrypt` se rechaza al cargarlo y al enviar
  (`APD.pdfConContrasena`); «Verificar» oculta el resultado anterior y acepta el número con o sin guiones (formato propio
  `numero-acreditacion`, `app/formatos-propios.js`); la CURP pegada con espacio ya no se corta (`maxlength` 24 y limpieza
  al pegar); la carrera lleva letras (formato propio `carrera`; el combo libre del estándar no aplicaba `data-formato`:
  `APD.formatoEnCombos`); el foco vuelve al «Quitar» del archivo recién cargado.
- **Revisión y cotejo (F2 A1, A6, A7, M2 a M4, B1 a B3):** lo pegado en una fecha (AAAA-MM-DD, con espacios o guiones),
  una CURP, un RFC o un folio fiscal se limpia antes de la escritura guiada y del `maxlength` (`app/apd.js`, fase de
  captura); la cita de un día que no llega no se atiende ni registra su inasistencia (en la prueba, «Atenderla como si
  fuera su día»; en la agenda, «Ver la cita»); la cita nueva va desde el día siguiente a la perdida y hasta 6 meses
  (parámetro nuevo `meses_adelanto_cita`); al retomar una pausa, «Sí, coincide» queda deshabilitado sin el documento nuevo
  y la página vuelve a leer lo cargado (al volver a ella, por `storage` o por el canal `apd-prueba` de IndexedDB, y al
  registrar); la mezcla no termina un cotejo con un documento que no coincidió; la clasificación de la carrera queda en
  el catálogo y recalcula el perfil; la agenda se actualiza sola; las observaciones conservan nombres propios y
  renglones, y la ayuda ya no promete «tal como lo escriba».
- **Grupos y examen (F3 M3 a M5, M7 a M9, B1 a B9, B11):** el grupo por confirmar lleno se confirma y se le elige semana;
  se completa una por una en un grupo de una organización; «Programar» no propone a otras si las elegidas ya tienen grupo
  y al guardar la dirección pasa a la ficha; textos de fecha propuesta neutros; la asistencia de quien ya presentó el
  examen queda cerrada; con un solo grupo de hoy con examen, «Mis grupos de hoy»; corregir un día anterior vuelve al de
  hoy sin «(simulado)»; `?semana=` imposible se ignora; fecha imposible avisada al momento; el año en «Así quedaría»;
  folio en el aviso de un grupo sin fecha; aviso de un grupo que ya no recibe; las elegidas se conservan por curso;
  «las 5 ya presentaron»; «tiene propuesto»; un código de examen enviado no muestra el resultado en otra computadora; el
  menú de pruebas pasa a la izquierda en «Asistencia».
- **Datos y material (F4 A7, M4 a M7, B1, B2, B4 a B7):** el total del campo de material es el del parámetro (30 MB); un
  reemplazo con menos páginas que los apartados se rechaza (y la página pública no ofrece páginas que no existen);
  apartados repetidos y páginas de cinco cifras; «pasa del máximo de 30 MB»; un examen de otro banco se ignora en todas
  las pantallas (`PREGUNTAS_BANCO`); los archivos del borrador se cuentan como borrador; el acuse con la fecha simulada y
  24 horas (`idioma: 'es-MX-u-hc-h23'`); el menú recuerda el caso elegido y lee `?migrada=`; un material incompleto no se
  muestra.
- Base: reglas `cita_futura` (lo que pasó en una cita se registra su día) y `cita_lejana` (hasta `meses_adelanto_cita`
  meses), parámetro nuevo en `04-apd-catalogos.sql` y en los ficticios exportados. Los casos de reglas que atienden la
  cita del 20/10 ahora corren ese día (`DIA_CITA`); 5 casos nuevos.
- Pruebas: `probar-sitio` 822 (antes 744; nueva sección `romper`, 75, al menos una comprobación por hallazgo); `probar-examen`
  76; `probar-esquemas` 128; `probar-base` y `probar-reglas` 178; auditor de CSS sin hallazgos. Los guiones
  de reproducción de los revisores se volvieron a correr: ya no ocurre ninguno de los hallazgos corregidos (los guiones que
  atendían una cita futura o subían el PDF protegido ahora se detienen ahí, que es la corrección; con la cita «como si
  fuera su día» se confirmaron los demás).
- Decisiones nuevas en `docs/DECISIONES.md` («Decisiones del 2026-10-18 (auditoría «intentar romperlo», bloque 1)»).


## 2026-10-19 · Bloque 76 · Auditoría «intentar romperlo» · bloque 2 (dos pestañas, dos personas a la vez y doble clic)

- Liber aprobó corregir el bloque 2 de `docs/AUDITORIA-2026-10-18-romper.md`. En el sistema la base y la API detienen
  casi todo esto; la versión de prueba ahora se comporta igual: la mezcla aplica a cada evento las reglas de la base en
  el momento en que pasó, cada pantalla vuelve a leer lo guardado justo antes de guardar y, si el cambio ya no procede,
  no lo guarda y lo dice con el mensaje que daría la API; después de guardar comprueba que se aplicó y, si no, lo retira
  y lo dice. Nunca un éxito falso. El estándar sigue en la 1.4.1 (`sitio/formkit/` sin cambios).
- **Común (`app/apd.js`):** `APD.rechazo` (el rechazo de la API: título, texto, enlace, código y errores por campo),
  `APD.muestraRechazo` (lo pinta en el aviso de envío en lugar del «No se pudo enviar» general), `APD.sesionCambio` (la
  sesión con que se abrió la página contra la de ahora) y `APD.ocupa` (un botón propio deshabilitado mientras guarda).
- **Persona (F1 1 a 4):** la solicitud, «Mi perfil» y «Cargar el documento correcto» no guardan si la sesión cambió o se
  cerró en otra pestaña («Tu sesión cambió en otra pestaña…», con «Vuelve a entrar con tu cuenta»); el envío vuelve a
  revisar la elegibilidad (una sola activa por tipo) y que una solicitud que se continúa siga en borrador o con
  observaciones; el folio se calcula al guardar y nunca repite uno que exista. En la mezcla: sin persona no hay
  solicitud; una solicitud nueva no se aplica si la persona tenía otra activa de ese tipo en ese momento o no es
  elegible; un envío nuevo con un folio que ya existe no se toma como reenvío; un reenvío sólo desde borrador o con
  observaciones, y sus archivos van con él (si se rechaza, tampoco quedan). «Mis trámites» no guarda nada.
- **Revisión y cotejo (F2 A2 a A5, M1):** la revisión guarda la vuelta que se abrió (hora real del envío) y la pantalla
  la compara con la de ahora: si la persona reenvió u otra pestaña ya revisó, no se guarda; la bandeja y «Ya registró la
  revisión…» enseñan la revisión que se aplicó (`APD_PERSONAL.revisiones(datos)`). El cotejo guarda la cita y la
  situación de partida (pendiente o en pausa, y la pausa): otra cita, una pausa o una cita cerrada lo detienen, en la
  pantalla y en la mezcla; una cita en pausa no pasa a «no se presentó» ni a «no era la persona». El expediente lo asigna
  la mezcla al terminar, consecutivo, y la pantalla muestra el que quedó (ya no lo anticipa al abrir). Un folio fiscal
  repetido se rechaza junto al campo y en la mezcla.
- **Grupos (F3 A1, M1, M2, M6, B10):** `APD_PERSONAL.guardaGrupoComprobado` (lee, guarda y comprueba; si no se aplicó,
  retira los eventos y rechaza con el motivo). «Programar» calcula el folio al guardar y le da a cada creación un id
  propio; la mezcla ignora un «crear» con un folio que ya existe y lo que lo acompaña. Agregar dice cuántas entraron de
  verdad y quién no, por qué; confirmar, dar de baja y cancelar dicen por qué no se hizo («el grupo tiene 4 personas y
  el mínimo es 5») y conservan lo escrito. Deshabilitados mientras guardan: «Guardar sin confirmar», «Al curso…»,
  «Completar…», «Confirmar el grupo», «Guardar la asistencia», «Publicar», «Ocultar» e «Iniciar el curso hoy».
- **Personal y sesión:** en la prueba no hay sesión del personal que cambie (perfil fijo); queda como contrato de la
  etapa 3 (`docs/ETAPA-2-PANTALLAS.md`, sección 2e).
- **Base:** regla `solicitud_activa` en `apd.solicitud_alta` (con el folio de la que está en curso, después de la
  elegibilidad); el índice `solicitud_una_activa` queda como última defensa. `probar-reglas`: el caso de dos solicitudes
  activas espera ahora ese código.
- **Bloque 3 sin tocar:** con el almacenamiento bloqueado o lleno, el envío de la solicitud sigue como antes (si no se
  pudo guardar, no se comprueba después); la comprobación posterior sólo corre cuando sí se guardó.
- Pruebas: `probar-sitio` 860 (antes 822; sección nueva `romperDos`, 38, `SOLO=romper2`: dos páginas del mismo contexto
  como dos pestañas, una comprobación por hallazgo; las 21 de hallazgos fallan con el código del commit c7281d3 y pasan
  con éste); `probar-examen` 76; `probar-esquemas` 128; `probar-base` y `probar-reglas` 178; auditor de CSS sin hallazgos
  (`apd.css`, `examen.css`). Cambió una comprobación existente: el cotejo ya no anuncia el número de expediente antes de
  terminar. Los guiones de los revisores (f1 t3b, t3c, t10; f2 03, 06, 07, 14; f3 t04, t05, t06, t26) se volvieron a
  correr en una copia (`scratchpad/auditoria-romper-bloque2/`, con `corre.sh`): ya no ocurre ninguno de los hallazgos.
  Los de f2 se adaptaron a «Atenderla como si fuera su día» y a que la pestaña con lo no guardado advierte al salir.
- Decisiones nuevas en `docs/DECISIONES.md` («Decisiones del 2026-10-19 (auditoría «intentar romperlo», bloque 2)»);
  contrato de la API en `docs/ETAPA-2-PANTALLAS.md` (2e); `docs/REGLAS.md` nombra `solicitud_activa`.


## 2026-10-19 · Bloque 77 · Auditoría «intentar romperlo» · bloque 3 (guardados que fallan y registros dañados)

- Liber aprobó corregir el bloque 3 de `docs/AUDITORIA-2026-10-18-romper.md` (F4 A1 a A6, A8, M1 a M3 y B3). Sólo afecta
  a la versión de prueba, que guarda todo en el navegador: con el almacenamiento bloqueado, lleno o en modo privado, las
  pantallas decían «Quedó guardado» o daban acuse y nada quedaba; un solo registro dañado hacía que todas vieran sólo los
  ficticios. Ahora nunca se da por guardado lo que no se guardó, y un registro dañado se salta sin llevarse lo demás. El
  estándar sigue en la 1.4.1 (`sitio/formkit/` sin cambios). Nada de lo hecho en los bloques 1 y 2 se repitió: el bloque
  2 ya evitaba el éxito falso de la revisión y del cotejo, pero con un mensaje equivocado («Otra revisión… al mismo
  tiempo»); ahora dicen que fue el navegador.
- **Común (`app/apd.js`):** `APD.textoNoGuardo(qué, trato)` y `APD.noGuardo(título, qué, trato)` (rechazo con código
  `almacenamiento` para `APD.muestraRechazo`): «Este navegador no permitió guardar … (puede estar en modo privado o con el
  almacenamiento bloqueado o lleno). Prueba / Pruebe en una ventana normal o en otro navegador.», el texto de «Crea tu
  cuenta», que ahora lo usa también. `APD.caducada()`: la marca de que lo guardado caducó (B3).
- **Persona:** la solicitud no da acuse ni folio si no se guardó (A1, `config-solicitud.js`); «Mi perfil» rechaza si no
  guardó el contacto, la adscripción o la fotografía, y la marca de fotografía nueva va después de la fotografía (A8,
  `config-datos.js`); «Cargar el documento correcto» guarda todos los documentos o ninguno (A4, `corregir.js`); «Entrar» y
  «Crea tu cuenta» dicen cuando no se pudo guardar la sesión (M1, `config-entrar.js`, `config-cuenta.js`).
- **Personal:** la revisión (A2, `revisar.js`) y el cotejo (A3, `cotejo.js`: la factura y la cita, o nada) dicen «No se
  guardó…» con el texto del navegador; el material de estudio avisa al ocultar o publicar y el formulario rechaza con
  mensaje, sin promesas sin atender (M2, `material-personal.js` y un aviso nuevo en `material-personal.html`).
- **Examen (A5, M3):** el servidor simulado (`examen-servidor.js`) rechaza con motivo `almacenamiento` si no escribió:
  responder, marcar, empezar, enviar, generar y reponer el código, suspender, pasar lista y el cierre por tiempo (si no se
  guarda, el examen sigue sin tiempo y sin aceptar respuestas). `examen.js` regresa la opción a la guardada y dice «No se
  pudo guardar tu respuesta: levanta la mano…»; si el envío no se guardó, no muestra resultado y se queda en la revisión
  (con el tiempo agotado, el reloj se detiene y «Enviar mis respuestas» lo vuelve a intentar). Avisos nuevos en
  `examen.html` (`data-aviso-falla`). `aplicar.js` muestra el rechazo de «Presente», «No llegó» y «Reponer código».
- **Registros dañados (A6, `archivos-prueba.js`):** la mezcla salta lo que no tiene forma de registro (vacío, sin persona
  en una solicitud de la prueba, sin hora, sin CURP) y aplica cada folio y cada evento de grupos por su cuenta: si uno
  falla, queda como estaba antes de él y siguen los demás. Cuenta los ignorados en `prueba_ignorados` (también en el
  material); el conteo del menú ya no falla con un registro vacío. `pruebas.js` pone bajo la franja un solo aviso («N
  registros guardados no se pudieron leer… «Borrar lo guardado»… los quita») y lo repite en «Guardado en este navegador»;
  «Borrar lo guardado» lo quita. `revision.js` ya no muestra el error junto con la lista.
- **Caducidad (B3):** `APD.cargar` ya no descarta `vencida`: marca la pestaña (sessionStorage, y en memoria si está
  bloqueado) y la primera pantalla a la que se llega dice una vez «Lo guardado en esta prueba se borró. Pasaron más de 7
  días sin usarla…». Estilo nuevo `.aviso-prueba` en `apd.css`.
- **Menú de pruebas:** «Entrar como», la persona nueva y el ajuste de preguntas obligatorias dicen cuando el navegador no
  guardó la sesión o el ajuste.
- Pruebas: `probar-sitio` 899 (antes 860; sección nueva `romperTres`, 39, `SOLO=romper3`: el navegador hostil con los
  scripts de inicio del frente 4 —localStorage que lanza o con cuota llena, sin IndexedDB o lleno, registros vacíos—; las
  22 de hallazgos fallan con el código del commit 2bd8fd9, servido desde una copia con `git archive`, y pasan con éste;
  las otras 17 comprueban que no queden errores ni promesas sin atender); `probar-examen` 76; `probar-esquemas` 128; auditor
  de CSS sin hallazgos (`apd.css`, `examen.css`). La base no cambió (`probar-base` y `probar-reglas` no aplican). Los
  guiones del frente 4 que reproducían estos hallazgos (02, 03, 04, 05, 06, 07, 12 y 13) se volvieron a correr en una copia
  (`scratchpad/auditoria-romper-bloque3/f4/`, con `corre.sh`): ya no ocurre ninguno. La solicitud, la revisión, el cotejo,
  la carga del documento correcto, «Mi perfil», «Entrar», «Crea tu cuenta», el material, el examen y el pase de lista dicen
  que el navegador no lo guardó, también con la cuota llena de verdad; con un registro dañado se siguen viendo la solicitud
  enviada y la revisión válidas; al caducar se dice una vez. Se adaptaron: 04 y la parte de caducidad de 07 (`07b-caduca.mjs`)
  a «Atenderla como si fuera su día» y a que el aviso va fuera de `<main>`, 03 a que la opción vuelve a la guardada y a que
  no hay resultado, y 02 y 12 para leer los avisos nuevos. La parte A de 07 no se volvió a correr (depende del cotejo de una
  cita futura, bloque 1).
- Decisiones nuevas en `docs/DECISIONES.md` («Decisiones del 2026-10-19 (auditoría «intentar romperlo», bloque 3)»);
  hallazgos marcados en `docs/AUDITORIA-2026-10-18-romper.md` («Estado de las correcciones») y en
  `docs/auditoria-romper/F4-datos-navegador.md` («Estado»).

## 2026-10-19 · Bloque 78 · Auditoría profesional (0.55)

- Pedida por Liber. En solo lectura, sobre el commit f58d284: seis revisores en paralelo (pruebas y datos, seguridad,
  robustez e integridad de la base, documentos y código, cotejo normativo, fechas), un revisor independiente para los
  frentes con altos y el auditor principal. Alcance aprobado: lo que no depende del estándar; pantallas, accesibilidad
  y textos, después de actualizar al estándar 1.5.1.
- Resultado: 55 hallazgos nuevos (0 críticos, 5 altos, 16 medios, 29 bajos, 5 informativos). Informe público:
  `docs/AUDITORIA-2026-10-19.md`; la parte sensible (seguridad de la base y cotejo del anteproyecto) está en los
  documentos del Proyecto. Huellas del repositorio iguales antes y después.
- Liber respondió las 15 preguntas (DECISIONES, «Decisiones del 2026-10-19») y aprobó corregir los bloques 1 y 2.
  Pendientes nuevos P162 a P170; P03, P16, P122, P140 y P152 al día.

## 2026-10-19 · Bloque 79 · Correcciones de la auditoría: fechas (bloque 1)

- Fecha pegada o insertada de golpe (AAAA-MM-DD, AAAA/MM/DD, dd-mm-aaaa, dd.mm.aaaa, con espacios) en los cinco campos
  de fecha: `app/apd.js` la deja en dd/mm/aaaa antes de la escritura guiada del estándar (R4-01, F2-A1, solución
  provisional de P152). La fecha de nacimiento también fallaba («1985-07-23» → 19/08/5072).
- Primer día del curso: máximo hoy + 12 meses, ese día incluido, en Programar, la ficha del grupo y `?semana=`
  (decisión 3).
- `sumaMeses` calcula como la base: 29/02/2028 + 12 meses = 28/02/2029 (B8-01, decisión 11). «Recoge tu credencial
  hoy mismo» por el día de la Ciudad de México (B8-02).
- Pruebas: zona horaria fija en `probar-sitio` y `probar-examen`, con una pasada en UTC (B8-03); pasada nueva
  `SOLO=fechas` con 28 comprobaciones (18 fallaban con el código anterior).

## 2026-10-19 · Bloque 80 · Correcciones de la auditoría: base de datos (bloque 2)

- Dos personas a la vez: `FOR UPDATE` en revisión, decisión de documentos, baja, asistencia y examen; código nuevo
  `apd:revision_ya_registrada` (E2-01 a E2-03; decisión 4). `herramientas/probar-concurrencia.sh` (paso 6 de
  `probar-base`): 20 escenarios, antes 3 bien, ahora 20. El arnés del revisor independiente: 291 órdenes, 0 violaciones.
  En algunos órdenes PostgreSQL resuelve un interbloqueo abortando una transacción (40P01): REGLAS dice cómo debe
  responder el backend.
- Tope del primer día del grupo en la base (`inicio_muy_lejano`); cita «cancelada» al cancelar la solicitud (A2-01,
  decisión 8; «Citas de cotejo» la muestra); CURP, RFC y correo con las mismas reglas que el formulario (A1-01).
- Bitácora: registra las 10 acciones que faltaban (E2-04); `apd_api` ya no escribe en ella y fecha, usuario y
  procedencia los pone la base (D-13). `apd_api` ya no pide folios ni abre expedientes directamente (E2-07, decisión 6).
  Acreditaciones migradas sólo con `usuario_tipo = 'migracion'`, fecha no futura y número fuera de la serie (D-01).
  Bloqueo por intentos (`intentos_maximos`, `minutos_bloqueo`, `apd.anotar_intento`; D-07). `search_path` sin
  `public` (D-10). Índices de la bandeja y del historial (D2-01). Respaldo con huella aparte y restauración de prueba:
  paso 7 de `probar-base` (decisión 5).
- `probar-reglas`: 173 → 298 casos; códigos de error sin caso, de 49 a 1 (`sin_adscripcion`, inalcanzable). De las 15
  pruebas de seguridad de la auditoría pasan 12: queda la pertenencia de la fila a la persona (D-06, P163) y la prueba
  de `public` en PostgreSQL 13-14, que se resuelve en la instalación (REGLAS).
- Integrado sobre «intentar romperlo» 1 a 3 (bloques 75 a 77, que se hicieron en paralelo): la fecha pegada queda con
  la solución de esos bloques; pendientes renumerados P162 a P170. Pruebas al cierre: `probar-base` 303 de 303,
  concurrencia 20 de 20, restauración 303 de 303; `probar-esquemas` 128; `probar-sitio` 927 (con axe); `probar-examen`
  79; `probar-volumen` 52; `auditar-sitio` 60 pantallas y 201 botones, sin avisos nuevos. Versión de prueba 0.57.

## 2026-10-19 · Bloque 81 · Correcciones de la auditoría: Grupos y personal (bloque 3)

- «Grupos»: cada organización vuelve a decir «Su grupo APD-G-…: N de 25, le faltan M para el mínimo» (o si alcanzan para
  uno propio); «Programar un curso» avisa y ofrece «Agregarlas a APD-G-…», y crear un segundo grupo de esa organización
  pide confirmación (R4-03, decisión 2). Sección nueva «Su fecha ya pasó»: «Propuesta vencida» con «Elegir otra semana»
  y «Confirmado · no inició» (R4-04, RI-07).
- «Citas de cotejo» desglosa su encabezado: atendidas, no se presentaron, sin pago, pausa vencida y canceladas
  («8 citas: 7 atendidas, 1 no se presentó»; B2-01, decisión 7).
- El instructor sólo abre sus grupos: con un grupo ajeno, también por `?folio=`, «Asistencia» y «Aplicar el examen» dicen
  «Este grupo lo da otra persona» (E1-01, decisión 12).
- «Programar»: sólo repite el folio de `?grupo=` si tiene la forma de un folio (E1-02); avisa antes de salir con cambios
  y guarda la semana en la dirección (B5-02); sin datos no deja botones activos (B5-01, ya corregido en 0.58; prueba
  nueva). Examen sin banco: «No se pudo abrir el examen. Avisa a quien aplica el examen.» (B5-03). Un registro dañado en
  los datos ya no tumba las pantallas de grupos (B5-04). pdf.js con `isEvalSupported: false` en el material (F3-01).
- Limpieza: código y 17 clases CSS sin uso fuera; una sola fila de persona y de bloque de organización para Grupos y
  Programar; `APD.cursoLargo` y `APD.MESES` sin copias; `data-calendario-curso` y la leyenda de anticipación del
  parámetro (R4-07, R4-08, R4-15). Las listas de horas e instructores se quedan en el HTML porque de ahí sale el esquema
  del servidor; una prueba nueva (`SOLO=limpieza`) comprueba que coinciden con `APD_PERSONAL`. La prueba de «Agregar
  personas de la espera» ya pulsa el botón real de la ficha (R4-14).
- Pruebas: `probar-base` 303 de 303, concurrencia 20 de 20, restauración correcta; `probar-esquemas` 128;
  `probar-sitio` 960 (con axe; 33 nuevas); `probar-examen` 79; `probar-volumen` 64 (12 nuevas).

## 2026-10-19 · Bloque 82 · Estándar de formularios 1.5.1 y documentos (bloques 4 y 5 de la auditoría)

- El sitio pasa del Estándar de formularios 1.4.1 al **1.5.1** (decisión de Liber; incluye la 1.4.4 que pedía la
  instrucción del proyecto). Copia regenerada con `construir-sitio`; logotipo de 477 × 96 (27 KB) y el `<img>` de las 21
  páginas con su tamaño real (P130).
- Se quitan las soluciones provisionales que el estándar ya resolvió: en `apd.css`, las reglas de `.estado`,
  `.tabla-bandeja` (`.estado`, `.tabla-valor`, `.mono`, `.btn`, `.btn-enlace`), el `max-width: none` de `.bajada` y
  `.ayuda-bloque` y las de `.chip-fijo` (P126, P134, P135, P145); `APD.aviso`, sustituido por `FormKit.aviso` con pasos
  y enlaces (P131; «Mis trámites», el inicio y «Material de estudio» cargan el núcleo para sus avisos); `APD.meta`,
  sustituido por `.linea-datos` (`APD.lineaDatos`, P134); el idioma `es-MX-u-hc-h23` que forzaba las 24 horas del
  acuse (P128); y el borrador propio de la solicitud: ahora es el del núcleo, que empieza con el primer gesto de la
  persona, con el almacén de la prueba como proveedor de archivos (P148). Lo propio del trámite se queda en
  `solicitud.js`: la franja se ofrece cuando la solicitud está lista, las declaraciones se vuelven a marcar, y al llegar
  los documentos se recalculan el curso, la experiencia y la revisión. Hallazgo de paso: en la 0.59, los documentos
  cargados después de recuperar un borrador no entraban en él (se recuperaban 2 de 4); con el del núcleo, los 4.
- Franja del borrador con los textos de la 1.5.1: «Recuperar borrador» (secundario), «Empezar de nuevo» con el foco en
  «Conservar» y «Descartar borrador». `mensajes-usted.js` ya no define `sesionExpira` (retirado) y pone en usted
  `archRechazoProceso`; los demás textos nuevos que se ven en el personal no se dirigen a nadie.
- Comprobado con la 1.5.1: una foto JPG con GPS en «Crea tu cuenta» se agrega y se guarda recodificada y sin EXIF (en
  la 0.59, una muy comprimida se guardaba con su ubicación) (P127); el RFC con Ñ se conserva en el cotejo y en el
  servidor (con la 1.4.1 se guardaba con N) (P129); el visor y los rótulos de la tabla, sin cambios que hacer (P146,
  P147). P152 sigue sin resolverse en la 1.5.1: la solución de `app/apd.js` se queda y sus pruebas (fechas y
  «romperlo») pasan. Auditor de CSS del estándar sobre `apd.css` y `examen.css`: 0 hallazgos.
- Documentos (bloque 5): P126 a P131, P134, P135 y P145 a P148 resueltos en `pendientes.json`; versión 1.5.1 en LEEME,
  ETAPA-1, ETAPA-2 y DECISIONES (fila nueva; la de la 1.4.1, sustituida); filas del calendario del personal y del
  examen de prueba de 10 preguntas (R4-06); P124 en lugar de P92 (R4-09); «esta semana y siete más» (R4-10);
  `dias_inhabiles`, parámetro previsto que no existe (R4-11); ETAPA-2 al día con el planeador y con los hallazgos del
  estándar abiertos, P152 a P158 y P166 (R4-12); el manual publicado pesa 11.7 MB (D3-01); «por vencer» son 31 días,
  como la base (REGLAS); cada «Anexo 1» dice de qué documento es (G1-03).
- `auditar-sitio` acepta el aviso «¿salir sin guardar?» al recargar una pantalla: desde la 0.59 se detenía en
  «Programar un curso» (ERR_ABORTED).
- Pruebas: `probar-base` 303 de 303, concurrencia 20 de 20, restauración correcta; `probar-esquemas` 131 (3 nuevas);
  `probar-sitio` 1029 (con axe; 69 nuevas, `SOLO=estandar` entre ellas); `probar-examen` 79; `probar-volumen` 64;
  `auditar-sitio` 60 pantallas y 201 botones, con los mismos 2 hallazgos que la 0.59 (un enlace del visor bajo el botón
  del menú de pruebas y «Ir al contenido» en «Corregir»).

## 2026-10-19 · Bloque 83 · Pruebas y repositorio (bloque 6 de la auditoría)

- **Las baterías siguen después de una falla (A1-02).** `probar-sitio` corre cada parte en `parte()` y `probar-volumen`
  en `paso()`: una parte que se detiene cuenta como falla y las demás corren; al final se dice cuántas comprobaciones
  hubo y qué partes se detuvieron. Con una falla provocada al principio de «Programar», la 0.60 corría 667
  comprobaciones del sitio y 0 de volumen; ahora, 1043 y 60.
- **Más cobertura (A1-04).** axe revisa las 36 pantallas a 390 y a 1280 px, con «Cargar el documento correcto» y su
  versión con errores; volumen revisa «Programar» con toda la espera (66 personas, propone 25).
- **Verificación en GitHub (A1-05, decisión 13).** `.github/workflows/pruebas.yml`, en cada push y PR: la base en un
  PostgreSQL 16 desechable (`probar-base` y que los ficticios regenerados sean los guardados) y el sitio con el estándar
  1.5.1 del repositorio público (`sitio/` igual a lo que construye el generador, pendientes y esquemas al día,
  `probar-sitio` con axe, `probar-examen` y `probar-volumen`). Las fallas salen como anotaciones del commit
  (`herramientas/en-github.sh`). No publica.
- **Ficticios estables (A3-01).** El `id` del material de estudio se deriva de su clave y su archivo, como el de los
  catálogos: dos instalaciones dan el mismo `datos/ficticios.json`, y un «Ocultar» hecho en el navegador de prueba ya
  no se pierde al republicar. `probar-base` dice si el archivo cambió respecto al guardado.
- **Política de contenido (B7-01, decisión 9).** `construir-sitio` pone en las 21 páginas, justo después de `charset`,
  la misma CSP estricta (`default-src 'self'`, sin `unsafe-inline` ni `unsafe-eval`; `blob:` para vistas previas y el
  visor; `object-src 'none'`, `base-uri 'none'`) y `referrer` `same-origin`. Prueba nueva `SOLO=csp`: la política en
  las 21, y ninguna violación en las 21 pantallas, el visor de PDF y la foto de la cuenta; en «romperlo 2» una
  violación cuenta como error de consola. En el SIA va como encabezado, con `frame-ancestors 'none'`.
- **Hallazgo de paso, corregido.** Con la CSP, la solicitud abierta en una segunda pestaña se detenía: los datos
  llegaban antes de que el estándar iniciara el formulario y `FormKit.pasos` no existía todavía. Era una carrera real
  (con la API pasaría igual con una respuesta rápida): `APD.cargar` ya no entrega los datos antes de que la página
  termine de cargar. axe se inyecta por el protocolo del navegador, porque la CSP no deja scripts en línea.
- **Licencia (F3-02, decisión 10).** `LICENCIA.md`: «Todos los derechos reservados» mientras la Secretaría decide la
  licencia (P167), con los datos ficticios, la identidad institucional y las licencias de terceros (pdf.js y sus fuentes,
  Roboto, Cabin; Playwright y axe-core sólo en pruebas). `construir-sitio` copia del estándar el manifiesto de lo que
  está en `sitio/vendor` (`MANIFIESTO.json`, con huella sha256); prueba nueva `SOLO=licencias`.
- Pruebas: `probar-base` 303 de 303, concurrencia 20 de 20, restauración correcta, dos instalaciones con el mismo
  archivo; `probar-esquemas` 131; `probar-sitio` 1096 (con axe; 67 nuevas); `probar-examen` 79; `probar-volumen` 68;
  `auditar-sitio` con los mismos 2 hallazgos que la 0.59.

## 2026-10-20 · Bloque 84 · Revisión de accesibilidad estable y visor (P171)

- Publicada la 0.61 (bloque 6). En GitHub, la corrida del commit de fusión del PR #4 falló una vez en axe: contraste de
  una opción recién marcada en «Revisar» (rechazo), medido a media transición de color; la del commit de la 0.61 y las
  anteriores pasaron. axe corre ahora con movimiento reducido (el estándar anula sus transiciones) y después de que
  terminan las animaciones, en `probar-sitio` y en `probar-examen`; cada violación sale con el marcado del elemento.
- Con la pantalla ya asentada, axe vio un hallazgo real del estándar: el visor 1.5.1 arma `div.visor-hojas` con
  `aria-label` y sin rol (aria-prohibited-attr, cotejo con la factura en escritorio). Solución provisional en
  `app/apd.js`: `role="region"` en las páginas con visor. Registrado para el estándar como P171.

## 2026-10-20 · Bloque 85 · Anteproyecto de lineamientos 0.5 (bloque 7 de la auditoría)

- El anteproyecto pasa a la versión de trabajo 0.5. Su texto no está en este repositorio, que es público: vive en el
  Proyecto de Claude (`claude/ANTEPROYECTO-LINEAMIENTOS-v0.5.md` y `claude/lineamientos/`).
- Liber aportó los textos vigentes que faltaban (Ley Orgánica del Poder Ejecutivo, Reglamento Interior, Código Fiscal,
  Código Penal para el Distrito Federal, Ley de Procedimiento Administrativo y la Ley de Protección de Datos Personales
  en Posesión de Sujetos Obligados publicada el 13/07/2026, que abrogó la de 2018). Todas las citas se cotejaron contra
  ellos, con una revisión independiente; ya no quedan huecos «[Art. __]».
- Corregidos G1-06, G1-07 y G1-09 de la auditoría del 19/10. Decisiones de Liber (DECISIONES, Lineamientos): se ratifica
  P133 y se cita sólo el art. 190 del Reglamento Interior.
- Impacto en el sistema: P172 (la notificación electrónica surte efectos cuando la persona confirma su recepción, con un
  máximo de tres días hábiles, y si no, estrado electrónico; art. 82 de la Ley de Procedimiento Administrativo) y, en
  P137, el consentimiento para la huella digital, que es dato sensible. P31, P50 y P139 citan las leyes vigentes. El
  campo `lineamientos` de los pendientes pasa a la versión 0.5 (los números de artículo no cambian).

## 2026-10-20 · Bloque 86 · Auditoría de seguimiento: pantallas, accesibilidad, textos y peso

- Última parte de la auditoría del 19/10 (lo que se pospuso hasta tener el estándar 1.5.1): A6, B1, B4 completa, B6,
  C1 a C6 y D4, sobre `d58c611`. Cinco revisores en paralelo y uno independiente, en solo lectura (huellas sin cambios).
- Resultado (`docs/AUDITORIA-2026-10-20.md`): 0 críticos, 1 alto (B4-01: en «Grupos», la barra fija tapa la casilla
  enfocada), 16 medios, 45 bajos, 5 informativos y 13 fallas del estándar sin clave. axe sin violaciones en más de 1,000
  corridas; todo se puede hacer con teclado; 0 enlaces rotos; un solo trato por público.
- Informes de cada revisor y guiones para repetirla en `docs/auditoria-2026-10-20/`. Nada se corrigió: el plan va en
  bloques y espera las decisiones del dueño.
