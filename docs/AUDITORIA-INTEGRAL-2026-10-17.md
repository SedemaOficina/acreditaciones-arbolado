# Auditoría integral · 2026-10-17 (versión de prueba 0.39–0.41)

Pedido de Liber: «realiza auditoría de todo». Cinco frentes, con hallazgos antes de cambiar nada:

| Frente | Qué se revisó | Detalle |
|---|---|---|
| A. Pantallas de la persona | Las 9 pantallas de quien solicita, con los tres métodos de la auditoría de tareas (pregunta de trabajo, cada regla visible donde se aplica, casos reales), en teléfono y escritorio | `docs/auditoria-integral/A-pantallas-de-la-persona.md` |
| B. Coherencia | Decisiones, reglas, modelo de datos, base, prototipo, pendientes y auditorías anteriores entre sí | `docs/auditoria-integral/B-coherencia.md` |
| C. Textos | 89 pantallas y estados: tú/usted, nombres internos, fechas y horas, vocabulario, pendientes a la vista | `docs/auditoria-integral/C-textos.md` |
| D. Seguridad y datos personales | Repositorio e historial, código del sitio, archivos, base y permisos, privacidad | Informe aparte, **fuera de este repositorio público** (describe puntos débiles de la base); está en los documentos del proyecto |
| E. Pruebas y peso | Todas las pruebas automáticas; peso y tiempo de carga en teléfono con red 3G | Abajo |

**Pruebas automáticas (E):** `probar-sitio` 536 de 536 con axe; `probar-examen` 63; `probar-volumen` todas;
`probar-esquemas` todos; `probar-base` 162; auditor de CSS sin hallazgos; `auditar-campos` 171 campos; el esquema
generado coincide con la base. Peso por pantalla en teléfono con 3G, sin compresión: 420–605 KB; lista en 2.3–3.4 s.
El logotipo pesa 110 KB (3829 px para mostrarse a ~200 px) en todas las pantallas.

**Lo que está bien:** repositorio sin datos personales reales, sin secretos ni datos de infraestructura (151 CURP, todas
del patrón ficticio); sin XSS explotable ni recursos de terceros; archivos validados por su contenido; ningún nombre
interno de estado llega a la persona en los casos probados; política de tildes y comillas consistente; las
correcciones de la auditoría de tareas están en el código.

## Corregido durante la auditoría (errores introducidos en bloques anteriores)

| Versión | Qué |
|---|---|
| 0.40 | La barra de pasos 1-2-3 de la solicitud salía en vertical: los «Qué sigue» de 0.38 usaban el nombre de estilo del módulo de pasos del estándar. Prueba nueva en `probar-sitio` |
| 0.41 | Las ventanas de confirmación (crear grupo, reponer código, no atender) mostraban la palabra «null». Prueba nueva en `probar-volumen`, que además revisa que ninguna pantalla muestre «null», «undefined» o «NaN» |

## Alta: pueden hacer que una persona pierda el trámite, pague dos veces, falte o quede bloqueada

| # | Qué pasa | Dónde | Propuesta |
|---|---|---|---|
| 1 | Lo cargado en la prueba (documentos, fotografía, CURP) queda en el navegador sin caducidad, en una dirección que comparten todos los sitios de SedemaOficina en GitHub Pages. Ninguna pantalla dice «no uses documentos reales» y las páginas se pueden indexar en buscadores | Prototipo | **Liber: borrar lo guardado en sus navegadores.** Caducidad de lo guardado, advertencia visible en cuenta y solicitud, `noindex` en todas las páginas |
| 2 | Si un grupo confirmado vuelve a «por confirmar» (una baja lo deja bajo el mínimo), sus personas siguen viendo «Preséntate el 26/10/2026, a las 08:00» | `tramites.js:91-97` | Mostrar la fecha sólo con el grupo confirmado; si no, «Tu grupo todavía no tiene fecha» |
| 3 | Cita nueva por no traer el comprobante: dice «Paga los derechos con los mismos datos» aunque ya haya pagado; toda segunda cita repite el bloque de pago | `tramites.js:66-85`, `:129`; `apd.js:26` | Decir «Lleva el comprobante del pago que ya hiciste» y mostrar el bloque de pago sólo si no hay pago registrado |
| 4 | El último día del curso: el pase de lista del examen no registra asistencia. Con la base real, todas las renovaciones (curso de un día) y quien faltó un día quedarían sin derecho a examen | `asistencia.js:62`, `03-apd-reglas.sql:1504`; P94 | Que el pase de lista registre la asistencia del último día (opción recomendada de P94) |
| 5 | Con datos reales, una solicitud cerrada por dos inasistencias se leería «Cerrada: no se corrigió a tiempo»: la pantalla usa un dato que sólo inventa la simulación | `tramites.js:136`, `:193` | Distinguir por el motivo de cierre que sí guarda la base; escribir el contrato de la API (los campos que leen las pantallas) |
| 6 | Pausa vencida, lado de la persona: «Mis trámites» y «Cargar el documento» siguen diciendo «cárgalo hoy» | `tramites.js`, `corregir.js` | Igual que en el personal: «La pausa venció; tu solicitud regresa con observaciones» |
| 7 | Activar una cuenta del registro anterior exige el nombre letra por letra; un error de una letra se rechaza al final, con «Acude a la Secretaría» y sin contacto en ninguna pantalla | `config-cuenta.js:51-53`; P14 | Decidir P14; avisar antes de llenar todo; dar un medio de contacto |
| 8 | Nadie pasa un grupo a «en curso» ni a «concluido» (ni pantalla ni simulación); sin eso no hay asistencia, examen ni cierre | Prototipo y base | Pendiente nuevo (P124): quién y cuándo |
| 9 | Seguridad de la base y del SIA: dos hallazgos de prioridad alta y varios medios | Informe aparte, fuera de este repositorio | Corregir antes de instalar la base en el SIA |
| 10 | «Corrige y reenvía» no dice hasta cuándo, pero la solicitud se cierra si no se corrige a tiempo | `tramites.js:140-147`; P02 | Mostrar el plazo cuando se defina; mientras, decir que hay un plazo |
| 11 | Con grupo asignado no se dice que hay que llevar la identificación oficial (sin ella no hay código de examen), que el examen es el último día ni la calificación mínima | `tramites.js:97` | Agregarlo en «Qué sigue» |

## Media

**Pantallas de la persona (A):** en renovación, un documento observado opcional se reenvía sin cambiarlo (la base
tampoco lo impide); un dictaminador con la poda vencida no ve «Renovar» ni el motivo; a quien dan de baja de un grupo no
se le dice; la fecha de la cita queda a 1,400 px en teléfono, debajo del pago, y no hay contacto de la Secretaría;
«Verificar» no encuentra «PD 2026 0001» con espacios; no se guarda borrador de la solicitud; «Recoge tu credencial
hoy mismo» sigue días después; una solicitud terminada puede quedar arriba de una en curso.

**Textos (C):** el inicio dice «en PDF o en foto» (sólo PDF); «Corrige lo que se indica abajo» (está arriba); acuse con
fecha larga, 12 horas y fecha real (viene del estándar); una fecha AAAA-MM-DD en los datos de pago; «Pendiente» ya
resuelto en «Entrar» (P13); mensajes en tú en pantallas del personal («Escribe al menos 10 caracteres») y en tres
mensajes de la base; «Faltan por revisar N campos» en las pantallas de la persona; vocabulario que cambia para lo
mismo (acreditación/credencial, Emitida/Inicio de vigencia, «Solicitudes por revisar»/«Revisión documental»); el
acuse de la cuenta dice «Entra con tu CURP» con la sesión ya abierta; seis marcas «Pendiente» sin número.

**Coherencia (B):** la base acepta una cita en el pasado, un examen que no es el último día y reenviar sin cambiar el
documento observado; no quedan en la base la declaración bajo protesta, el cambio de nombre ni la corrección de la
asistencia; la base tiene 106 códigos de error, `REGLAS.md` documenta 22 y las pruebas cubren 55; decisiones que chocan
entre sí (el grupo que vuelve a integración «conserva su fecha» contra los 7 días de anticipación; sexo visible o
interno; lugar de entrega Vivero o PILARES); error de dedo «Mi perfos» en el esquema.

**Seguridad de la base y del SIA (D, detalle en el informe aparte):** permisos y control de acceso por persona,
bloqueo por intentos, folios consecutivos con verificación pública, compatibilidad de permisos en PostgreSQL 13 y 14,
bitácora, plazos de conservación, manejo de archivos en el servidor y minimización de datos (P31, P32, P50). Además,
`docs/GUIA-PROYECTOS-SIA.md` describe en este repositorio público cómo está armada la infraestructura del SIA:
conviene moverla a un repositorio privado (decisión de Liber).

## Baja

Detalle en cada informe: «abajo» por «arriba», tamaño mínimo de la foto sólo como error, comentarios con números de
pendiente equivocados (P86 por P88), `DECISIONES-SIA.md` con versión 0.33, `REGLAS.md` con 160 casos (son 162),
redondeo de la calificación en la base contra P88, código sin uso (`datosConPrueba`, `INTEGRACION`), dos teléfonos de
prueba con lada 55, contraseñas de prueba sin sal.

## Hallazgos nuevos para el estándar (por registrar)

- La fotografía conserva su ubicación GPS cuando la recodificación no reduce el peso o falla (`archivos.js:171-174`).
- El acuse escribe la fecha larga en 12 horas y con la fecha real (`acuse.js:46`).
- El formato `rfc` cambia la Ñ por N (`validaciones.config.js:34`, `:267`).
- El logotipo del estándar pesa 110 KB a 3829 px para mostrarse a ~200 px.

## Decisiones que necesita Liber

1. P94 (último día del curso) y P123 (inasistencias): dos de los hallazgos altos dependen de ellas.
2. P14: cómo se activa una cuenta del registro anterior sin exigir el nombre letra por letra.
3. El grupo que vuelve a integración «conserva su fecha» contra la regla de 7 días.
4. Contradicciones del registro: sexo visible o interno, situación de estudios en carrera técnica, lugar de entrega.
5. Si la renovación de dictaminador vuelve a pedir los años de experiencia, y qué documentos pide a quien viene del
   registro anterior sin archivos.
6. Mover la guía del SIA a un repositorio privado.
