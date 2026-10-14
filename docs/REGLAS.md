# Reglas que impone la base

Lo que debe valer siempre vive en la base (`db/apd/03-apd-reglas.sql`), no en la pantalla: así se cumple
aunque alguien escriba sin pasar por la aplicación o por la carga masiva. Cada regla sale de
`docs/DECISIONES.md`. Este documento las resume; el código manda si hubiera diferencia.

## Solicitud

Transiciones admitidas (cualquier otra se rechaza con `transicion_invalida`):

| Desde | Hacia |
|---|---|
| `borrador` | `enviada`, `cancelada` |
| `enviada` | `con_observaciones`, `validada_en_linea`, `cancelada` |
| `con_observaciones` | `enviada`, `cancelada`, `concluida_sin_atender` |
| `validada_en_linea` | `lista_para_curso`, `con_observaciones` (el cotejo no coincide), `cancelada`, `concluida_sin_atender` |
| `lista_para_curso` | `inscrita`, `cancelada` |
| `inscrita` | `lista_para_curso` (baja o grupo cancelado), `aprobada`, `no_acreditada`, `sin_derecho_examen`, `cancelada` |
| `aprobada` | `acreditada` |

| Paso | Lo mueve | La base exige |
|---|---|---|
| Alta | Persona solicitante | Elegibilidad (abajo). Una sola solicitud activa por persona y tipo de acreditación |
| → enviada | Persona solicitante | Elegibilidad otra vez; documentos obligatorios en línea; perfil académico si es dictaminador |
| → con_observaciones / validada_en_linea | Revisión (con una revisión registrada) | Para validar: todos los documentos aceptados y la cita asignada |
| → lista_para_curso | Cotejo | A quién se factura el pago. Arranca la espera de grupo |
| → inscrita | Al inscribir en un grupo | Ver «Grupos» |
| → aprobada / no_acreditada | Al capturar el examen | El resultado sale de la calificación contra el mínimo del curso |
| → sin_derecho_examen | Al concluir el grupo | Asistencia por debajo del mínimo |
| → acreditada | Al emitir la acreditación | Solicitud aprobada; si es dictaminador, poda vigente ese día |
| → cancelada / concluida_sin_atender | Persona o personal | Motivo. Si estaba en un grupo, sale de él |

**Elegibilidad** (al crear y al enviar):
- Dictaminador: acreditación de poda vigente ese día.
- Renovación: la acreditación más reciente de ese tipo, desde 30 días naturales antes de su vencimiento y
  hasta un año después.
- Nueva: no se admite si la persona ya tiene una de ese tipo vigente o todavía renovable.

## Vigencia de una acreditación

No se guarda: se calcula con la fecha del día (`apd.estado_acreditacion`, `apd.acreditacion_vigente`).

| Estado | Cuándo | ¿Opera? |
|---|---|---|
| `vigente` | De la emisión a 31 días antes del vencimiento | Sí |
| `por_vencer` | Últimos 30 días naturales, día del vencimiento incluido | Sí, y ya puede renovar |
| `vencida_renovable` | Hasta un año después del vencimiento | **No** |
| `vencida_no_renovable` | Después | **No**; tramita como nueva |

- Vence el día anterior al aniversario de la emisión. La renovada cuenta su año desde su propia emisión.
- Dictaminador: además, deja de operar si su acreditación de poda no está vigente (parámetro
  `dictaminador_sigue_a_poda`, provisionalmente «si»).
- La verificación pública (`apd.verificacion_publica`) sólo muestra número, nombre, tipo, fechas y «Vigente»
  o «No vigente».

## Grupos

| Paso | La base exige |
|---|---|
| Alta | Curso activo. Copia los cupos vigentes del curso (hoy 10 a 25) |
| Inscribir | Grupo en integración o confirmado; solicitud en espera, del mismo curso y, si el grupo es específico, de la misma organización; cupo máximo (el grupo se bloquea mientras se cuenta) |
| → confirmado | Cupo mínimo, instructor, sede y fecha de inicio. **Sin excepción** |
| → en_curso | Cupo mínimo y que haya llegado la fecha de inicio |
| → concluido | Nadie con asistencia suficiente sin calificación. Quien no alcanzó la asistencia queda sin derecho a examen |
| → cancelado | Motivo. Las personas regresan a la bandeja con su antigüedad original |

Asistencia: por día, nunca de un día que no ha ocurrido. Examen: sólo con la asistencia mínima del curso.

## Siempre

- **Folios** los asigna la base: `APD-S-AAAA-NNNNN` (solicitud), `APD-G-AAAA-NNN` (grupo), `PD-AAAA-NNNN` y
  `DT-AAAA-NNNN` (acreditaciones emitidas en el sistema; las migradas conservan el suyo). [pendiente]
  confirmar el formato de número con la Dirección.
- **Bitácora**: cada alta y cambio de estado queda con quién, cuándo y desde dónde. No se edita ni se borra,
  ni siquiera por la administración.
- **Nada se borra** salvo sesiones vencidas y requisitos de un curso. Un documento nuevo sustituye al
  anterior sin borrarlo.
- **La hora** sale de `apd.ahora()`. Sólo en una base de pruebas se puede simular; en producción, simularla
  es un error. Qué base es lo dice `apd.entorno()`, que sólo quien administra la base puede reemplazar.
- **Errores**: cada regla incumplida trae un mensaje para la persona y un código (`HINT apd:<codigo>`) para
  que el backend responda `{ codigo, mensaje }`.

## Cómo se prueba

`herramientas/probar-base.sh` instala todo en una base desechable, carga los expedientes ficticios como la
cuenta del servicio (pasando por cada regla) y corre `herramientas/probar-reglas.mjs`: 54 casos con fechas
movidas, cupos, permisos y bitácora.
