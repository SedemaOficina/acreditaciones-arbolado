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
