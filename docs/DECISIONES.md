# Registro de decisiones

Toda regla del sistema sale de aquí. Si una petición contradice una decisión registrada, se advierte antes de
ejecutarla y, si se acepta, se anota la nueva con su fecha sin borrar la anterior.

Insumo de origen: `docs/insumos-lineamientos-borrador.txt` (borrador de lineamientos de la Dirección de
Infraestructura Verde). **Cuando una decisión de este registro contradice el borrador, manda este registro y
el borrador debe actualizarse** (sección «Lo que hay que corregir en los lineamientos»).

## Alcance

| Fecha | Decisión | Quién |
|---|---|---|
| 2026-10-14 | El sistema sustituye a Kobo ToolBox por completo: la carga de la persona solicitante y el seguimiento interno | Liber Saltijeral |
| 2026-10-14 | El trámite es siempre individual. Pertenecer a una organización es un atributo de la solicitud que sirve para agrupar la demanda; las organizaciones no inscriben a su personal, no pagan en conjunto y no tienen enlace con cuenta | Liber Saltijeral |
| 2026-10-14 | Volumen esperado: 1,000 solicitudes al año | Liber Saltijeral |

## Cuentas

| Fecha | Decisión | Quién |
|---|---|---|
| 2026-10-14 | Las personas solicitantes siempre tienen cuenta propia, que crean ellas mismas | Liber Saltijeral |
| 2026-10-14 | La CURP es el identificador único de la cuenta: no hay dos cuentas con la misma CURP. La Secretaría puede corregir la CURP de una cuenta, con motivo en la bitácora | Liber Saltijeral |
| 2026-10-14 | Instructores: personal de la Secretaría; capturan asistencia por día y calificación | Liber Saltijeral |
| — | Quién restablece las contraseñas si el SIA no da correo | **Pendiente** |

## Cursos y grupos

| Fecha | Decisión | Quién |
|---|---|---|
| 2026-10-14 | Cuatro cursos: poda y derribo (nueva), poda y derribo (renovación), dictaminador (nueva), dictaminador (renovación). Nunca se mezclan en un grupo | Liber Saltijeral |
| 2026-10-14 | Duración: poda y derribo, 3 días; dictaminador, 5 días. La misma para el curso de renovación de cada tipo | Liber Saltijeral |
| 2026-10-14 | Cupo mínimo 10 y máximo 25, para todos los cursos, editables por la administración. Cada grupo copia los cupos vigentes al crearse | Liber Saltijeral |
| 2026-10-14 | **Ningún grupo abre con menos del mínimo.** Sin excepción | Liber Saltijeral |
| 2026-10-14 | Los grupos pueden ser específicos (una organización) o combinados | Liber Saltijeral |
| 2026-10-14 | Los cursos se imparten en instalaciones de la Secretaría; no hay sede externa | Liber Saltijeral |
| 2026-10-14 | Alerta de prioridad a los 31 días de espera sin grupo. En los cursos de renovación, la bandeja ordena por fecha de vencimiento | Liber Saltijeral |
| 2026-10-14 | Asistencia mínima para examen: dictaminador, 4 de 5 días. Poda: **pendiente de la Dirección**; provisionalmente 3 de 3. Se guarda en días, no en porcentaje | Liber Saltijeral |
| — | Calificación mínima: 7.0 poda, 9.0 dictaminador (del borrador; no se ha cuestionado) | Insumo |

## Vigencia y renovación

| Fecha | Decisión | Quién |
|---|---|---|
| 2026-10-14 | Vigencia de un año a partir de la emisión, sin efecto retroactivo: la acreditación renovada cuenta su año desde su propia emisión | Insumo, confirmado |
| 2026-10-14 | Ventana de renovación: desde 30 días naturales antes del vencimiento hasta un año después. Pasado el año, la persona tramita como nueva. Aplica igual a poda y a dictaminador | Liber Saltijeral |
| 2026-10-14 | En ningún momento se opera sin acreditación vigente. La verificación pública sólo dice «Vigente» o «No vigente» | Liber Saltijeral |
| 2026-10-14 | Renovación de poda vencida: mismos requisitos que la renovación por vencer | Liber Saltijeral |
| 2026-10-14 | Toda renovación de dictaminador actualiza los comprobantes de estudios y de experiencia | Liber Saltijeral |
| 2026-10-14 | Para tramitar dictaminador (nueva o renovación) se exige acreditación de poda vigente al momento del trámite | Liber Saltijeral |
| — | Si la acreditación de poda vence durante la vigencia de la de dictaminador: ¿la de dictaminador queda «No vigente»? Provisionalmente **sí** (parámetro `dictaminador_sigue_a_poda`) | **Pendiente** |

## Lo que hay que corregir en los lineamientos

| # | En el borrador | Corrección |
|---|---|---|
| 1 | Renovación «15 días antes del término» | Desde 30 días naturales antes y hasta un año después del vencimiento |
| 2 | Pasantes: 5 años de experiencia en la tabla y 2 en las disposiciones específicas | Una sola regla. **Pendiente de la Dirección** |
| 3 | Carrera técnica: las disposiciones piden constancias de capacitación que la tabla no incluye | Agregarlas a la tabla |
| 4 | Requisito 12 de dictaminador, «Acreditación del curso, 9.0», entre los requisitos de inscripción | Quitarlo: es el resultado del examen |
| 5 | Numeración de la tabla de dictaminador salta del 2 al 4 | Renumerar |
| 6 | El cotejo compara contra lo «adjuntado por correo» | Contra lo cargado en la plataforma |
| 7 | 80 % de asistencia en un curso de 3 días | Expresar la asistencia mínima en días |
| 8 | Renovación «mediante escrito libre dirigido al Titular» | Solicitud en la plataforma |
| 9 | Sin plazos para atender observaciones ni para presentarse a la cita | Fijarlos. **Pendiente de la Dirección** |
| 10 | La consecuencia de no renovar a tiempo está truncada | Pasado un año del vencimiento se tramita como nueva |
| 11 | «El resultado de la evaluación será inapelable» | Validar con la Dirección Jurídica antes de publicar |
| 12 | Faltan el check list (anexo), el Anexo 1 de carreras afines, el concepto y monto del derecho, y las secciones «Del pago» y «Del curso» | Pedirlos a la Dirección |
| 13 | El comprobante de domicilio no tiene uso declarado en el procedimiento | Justificar su uso o retirarlo |

## Pendientes que no bloquean las etapas con datos ficticios

1. Datos personales y aviso de privacidad (antes del primer dato real).
2. Restablecimiento de contraseñas: responsable y procedimiento.
3. Correo institucional: pregunta al SIA.
4. Asistencia mínima en poda.
5. `dictaminador_sigue_a_poda`.
6. Formato del registro histórico de Kobo, para la migración.
7. Plazos para atender observaciones y para presentarse a la cita.
