# Pendientes

Un solo lugar para todo lo que falta decidir, confirmar o hacer. Cada pendiente tiene un número fijo
(P01, P02…) que no se reutiliza. Cuando se resuelve, pasa a «Resueltos» con la fecha y cómo quedó; la decisión
se anota además en `docs/DECISIONES.md`.

Actualizado: 14/10/2026. Copia de lectura en el proyecto de Claude («SISTEMA DE ACREDITACIONES…»); la fuente es
este archivo del repositorio.

**Bloquea** dice desde qué momento hace falta resolverlo: *datos reales* = antes del primer dato real;
*SIA* = antes de pasar al SIA; *etapa N* = antes de cerrar esa etapa; *no* = se puede avanzar sin él.

## Dirección de Infraestructura Verde (contenido del trámite)

| # | Pendiente | Bloquea | Desde |
|---|---|---|---|
| P01 | Experiencia mínima de pasantes: el borrador dice 5 años en la tabla y 2 en las disposiciones | datos reales | 14/10 |
| P02 | Plazo para atender observaciones y para presentarse a la cita; al vencer, la solicitud se cierra «concluida sin atender» | datos reales | 14/10 |
| P03 | Uso del comprobante de domicilio (el procedimiento no dice para qué se pide): justificarlo o retirarlo | datos reales | 14/10 |
| P04 | Check list del cotejo (anexo), Anexo 1 de carreras afines, secciones «Del pago» y «Del curso» del borrador | etapa 2 | 14/10 |
| P05 | Si las constancias de capacitación se piden también a quien tiene título | datos reales | 14/10 |
| P06 | Confirmar que no se admite una solicitud nueva si la persona ya tiene una del mismo tipo vigente o renovable (propuesta R07) | no | 14/10 |
| P07 | Procedimiento para corregir una calificación mal capturada (hoy el resultado es inapelable y no se modifica) | etapa 2 | 14/10 |
| P08 | Revisión de la Dirección Jurídica a la redacción «el resultado de la evaluación será inapelable» | datos reales | 14/10 |
| P09 | Lugar de la cita de cotejo y sede del curso: cómo se informa a la persona | etapa 2 | 14/10 |
| P10 | Lugar, días y horario de entrega de acreditaciones (parámetro `entrega_lugar`) | datos reales | 14/10 |

## Liber (formatos y definiciones del sistema)

| # | Pendiente | Bloquea | Desde |
|---|---|---|---|
| P11 | Formato del folio de la acreditación (hoy provisional PD-AAAA-NNNN y DT-AAAA-NNNN) | datos reales | 14/10 |
| P12 | Formato del número de expediente (hoy provisional EXP-AAAA-NNNN) | datos reales | 14/10 |
| P13 | Quién restablece las contraseñas de solicitantes y por qué medio, si el SIA no da correo | etapa 3 | 14/10 |
| P14 | Titularidad al activar una cuenta del registro de Kobo: hoy se exige CURP coherente con nombre y fecha, y el nombre del registro. ¿Basta? | etapa 3 | 14/10 |
| P15 | Si se contrasta la CURP con el servicio de consulta de RENAPO (hoy: formato, dígito y coherencia con nombre, apellidos y fecha) | no | 14/10 |

## Finanzas y Gaceta Oficial (pago de derechos)

| # | Pendiente | Bloquea | Desde |
|---|---|---|---|
| P16 | Monto vigente de cada curso (poda nueva, poda renovación, dictaminador nueva, dictaminador renovación) y la publicación de la Gaceta que lo fija. Lo captura el personal; hoy hay montos **ficticios** | datos reales | 14/10 |
| P17 | Referencia bancaria o línea de captura definitiva (hoy provisional: el folio sin guiones) | datos reales | 14/10 |
| P18 | Banco, cuenta o CLABE y forma de pago (parámetro `pago_instrucciones`) | datos reales | 14/10 |
| P19 | Concepto exacto de cada derecho (hoy concepto provisional por curso) | datos reales | 14/10 |

## Registro de Kobo (migración)

| # | Pendiente | Bloquea | Desde |
|---|---|---|---|
| P20 | Formato del registro histórico de Kobo para la migración | etapa 2 | 14/10 |
| P21 | Qué documentos carga en su primera renovación quien viene de Kobo sin archivos en el sistema | etapa 2 | 14/10 |
| P22 | Si Kobo tenía números de expediente físico que deban conservarse | etapa 2 | 14/10 |

## SIA (preguntas abiertas, detalle en `docs/DECISIONES-SIA.md`)

| # | Pendiente | Bloquea | Desde |
|---|---|---|---|
| P23 | **Servicio de correo institucional** para confirmar cuentas, recuperar contraseñas y avisar observaciones, cita, resultado y entrega | etapa 3 | 14/10 |
| P24 | Siglas `apd` libres para esquema, cuenta y ruta | SIA | 14/10 |
| P25 | Dónde se publica la aplicación y la ruta de su API | SIA | 14/10 |
| P26 | Límite de subida de la API (se necesitan al menos 5 MB por archivo) | etapa 3 | 14/10 |
| P27 | Cuentas del personal en `acceso`, recurso `apd`, con cinco perfiles | etapa 2 | 14/10 |
| P28 | Espacio para archivos (de 10 a 20 GB al año) y dónde | etapa 3 | 14/10 |
| P29 | Conexión del examen en línea: cuenta de servicio propia o API del módulo | no | 14/10 |
| P30 | Formato exacto de la contraseña derivada que usa el esquema `acceso`, para usar el mismo | etapa 3 | 14/10 |

## Unidad de Transparencia

| # | Pendiente | Bloquea | Desde |
|---|---|---|---|
| P31 | Aviso de privacidad (cuenta, solicitud, verificación pública) con sus fundamentos; hoy `[Art. __, fracc. __]` | datos reales | 14/10 |
| P32 | Revisión del inventario de datos personales de los formularios | datos reales | 14/10 |

## Verificación (lista de cierre del Estándar de formularios)

| # | Pendiente | Bloquea | Desde |
|---|---|---|---|
| P33 | Probar en iPhone y Android reales, con red limitada; cámara al cargar documentos | etapa 1 | 14/10 |
| P34 | Recorrido sólo con teclado y con lector de pantalla real (NVDA, VoiceOver, TalkBack) | etapa 1 | 14/10 |
| P35 | Probar en Firefox y Safari; alto contraste; impresión del acuse | etapa 1 | 14/10 |
| P36 | Casilla «Verificado en móvil y en escritorio» con nombre y fecha de quien probó | etapa 1 | 14/10 |

## Estándar de formularios (hallazgos para reportar a su repositorio)

| # | Pendiente | Bloquea | Desde |
|---|---|---|---|
| P37 | `combo` no acepta el catálogo como `{filas, fuente, corte}` aunque su documentación lo dice | no | 14/10 |
| P38 | `esquema-desde-html.mjs` sólo toma el `data-si` más cercano cuando hay condiciones anidadas | no | 14/10 |
| P39 | `archivos` dice «Hasta 1 archivos» | no | 14/10 |
| P40 | `numero` no valida un `step` menor que 1 | no | 14/10 |
| P41 | No hay forma de marcar en un campo un error que devuelve el servidor | no | 14/10 |
| P42 | No hay «mostrar contraseña» | no | 14/10 |
| P43 | No hay validación cruzada de CURP contra nombre y apellidos (se hizo en el proyecto) | no | 14/10 |
| P44 | Una cruzada no se vuelve a comprobar si cambia el otro dato y el campo que la declara no tenía error (se resolvió en el proyecto con `app/cuenta.js`) | no | 14/10 |
| P45 | La plantilla de versión del SIA usa valores literales y no pasa el auditor de CSS | no | 14/10 |

## Resueltos

| # | Pendiente | Cómo quedó | Fecha |
|---|---|---|---|
| — | Factura y RFC | La persona sólo carga su constancia fiscal; el personal captura RFC, razón social y folio fiscal al cargar la factura | 14/10 |
| — | Expediente físico | Uno por CURP, abierto en el primer cotejo y compartido por todos sus trámites | 14/10 |
| — | Firma de recibido | Acuse impreso, firmado y escaneado; sin él no se registra la entrega | 14/10 |
| — | Monto del pago | Configurable por el personal, distinto por curso, con la publicación de la Gaceta y su fecha; quien ya tiene cita conserva el monto que se le indicó. Falta el monto real (P16) | 14/10 |
| — | Persona sin segundo apellido | Pregunta «¿Tienes segundo apellido?»; con «No», la CURP debe llevar X en su lugar | 14/10 |
| — | CURP que no marcaba error | Al cambiar nombre, apellidos o fecha con la CURP ya escrita, la CURP se vuelve a comprobar al momento | 14/10 |
| — | Documentos de renovación | Se actualizan los vencidos o no vigentes y los de estudios o experiencia que la persona quiera; constancia fiscal y factura obligatorias | 14/10 |
