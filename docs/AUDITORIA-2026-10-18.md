# Auditoría · 2026-10-18 (versión de prueba 0.52 → 0.53)

Pedido de Liber: «iniciar una auditoría para que quede todo bien limpio, sin código zombie, buena UI, buena UX,
persistencia de datos, pasos bien, que todos los botones funcionen, los documentos actualizados, organización del
proyecto y archivos». Cinco frentes revisados por separado, con hallazgos antes de cambiar nada; después, tres equipos
de corrección con archivos asignados para no pisarse. Los informes completos de cada frente están en los documentos del
proyecto (fuera de este repositorio público, porque uno describe detalles de infraestructura).

| Frente | Qué se revisó | Hallazgos | Estado |
|---|---|---|---|
| A. Código y organización | Funciones, estilos y atributos sin uso, comentarios viejos, duplicación, archivos sin referencia, pruebas que ya no prueban, orden de carga | ~70, ninguno alto | Corregidos casi todos (abajo lo que queda) |
| B. Botones y pasos | Los 39 casos del menú de pruebas en teléfono y escritorio (147 pantallas por tamaño), cada botón, enlaces, caminos de punta a punta, «Atrás» y recargar | 16 (2 altos) | Corregidos todos |
| C. Datos | Todo lo guardado en el navegador, persistencia al recargar, coherencia con el modelo y las reglas de la base, fechas | 4 altos, 6 medios, varios bajos | Corregidos todos los altos y medios |
| D. Interfaz | 61 pantallas y estados en teléfono y escritorio: consistencia, claridad, flujo, textos | 34 del proyecto (4 altos) y 5 del estándar | Corregidos casi todos; los del estándar, rodeados en el proyecto |
| E. Documentos | LEEME, decisiones, reglas, guías de pantallas, pendientes, citas normativas, datos sensibles | 51 (6 altos) | Corregidos todos salvo 4 que decide Liber |

## Lo más grave que se encontró y cómo quedó

| # | Qué pasaba | Cómo quedó |
|---|---|---|
| C1 | El documento que cargaba la persona durante una cita en pausa de un caso ficticio no se aplicaba: el personal seguía viendo «esperando el documento» | Se aplica; la agenda dice «Documento cargado · retomar» y la persona, que ya lo cargó |
| C2 | Desde el segundo reenvío se perdía la revisión intermedia | Se conservan todos los envíos y revisiones; la bandeja cuenta bien («4.ª revisión») |
| C3 | La calificación del examen en línea nunca llegaba al expediente; se podía dar de baja a alguien ya examinado | El examen se registra (origen examen en línea) y la solicitud pasa a aprobada o no acreditada; la baja después del examen ya no se aplica |
| C4, B1 | Editar, ocultar o reemplazar material de estudio borraba lo anterior | Cada cambio se combina con lo guardado; se probó la cadena completa |
| B2 | En la solicitud, «Atrás» o recargar a la mitad perdía lo capturado, documentos incluidos | Cada paso entra al historial del navegador; borrador con campos, paso y documentos en el dispositivo, con «Seguir donde ibas» o «Empezar de nuevo» |
| D1 | El borrador decía «Ya lo cargaste» sin mostrar el archivo, y el resumen, «No indicado» | Cada documento muestra su archivo (nombre, fecha, tamaño, «Ver»); el resumen dice la verdad |
| D2 | «Corregir y reenviar» abría en el paso 1 y lo observado quedaba debajo de lo aceptado | Abre en Documentos, lo observado primero con su observación; lo aceptado, plegado |
| D4 | La fecha y el lugar de la cita iban al final de la ficha | Van al principio, antes del pago, y el paso «Acude a tu cita» lleva la fecha |
| E1 | En las tablas se partían palabras dentro de botones y fechas («Revisa / r») | Rodeado en el proyecto (falla del estándar, anotada) |
| C 2.5 | «Aplicar el examen» daba código y segundo examen a quien ya tenía calificación | Ya no: su fila dice «calificación registrada» |

Además: fechas de la cita y del primer día del curso en dd/mm/aaaa con el campo del estándar; etiquetas de estado con su
familia correcta (persona y personal); la cabecera de «Revisar» cambia al decidir; la agenda recuerda el día; aviso antes
de salir con cambios sin guardar en revisión, cotejo y asistencia; «Mi perfil» desde la solicitud regresa a ella; entrar
desde un enlace sin sesión conserva a dónde iba; distintivos de prueba que ya no tapan contenido; «Lo guardado» del menú
cuenta todo y se borra con una sola lista; fecha simulada también en la cuenta, el pase de lista y el examen; código sin
uso retirado; material de estudio en las listas de herramientas y del menú; capturas de las pruebas fuera del historial
(`.gitignore`); los guiones de la prueba de volumen, de `docs/` a `herramientas/`; esquema del servidor para el
formulario del material.

## Lo que queda abierto

**Para decisión de Liber**

1. Guía de proyectos del SIA (`docs/GUIA-PROYECTOS-SIA.md`): en un repositorio público describe detalles de la
   infraestructura. ¿Se quedan o se quitan de la copia pública? (detalle en los documentos del proyecto).
2. Borrador interno de lineamientos (`docs/insumos-lineamientos-borrador.txt`) publicado en el repositorio: ¿se mueve a
   los documentos del proyecto, junto al anteproyecto?
3. Redacción sobre el supervisor (DECISIONES, lineamientos): la NADF-001-RNAT-2015, numeral 5.9, sí le fija un perfil;
   confirmar la redacción propuesta.
4. Números de regla R01–R57: viven en el mapa del trámite (artefacto privado); propuesta: pasar al repositorio la tabla de
   equivalencias.
5. Quién pasa un grupo a «en curso» en el sistema (la base no lo hace por fecha; en la prueba hay un botón «Iniciar el
   curso hoy (simulado)») — P92.
6. Plazo para corregir observaciones (P02): mientras, «Mis trámites» dice «Fecha por definir».
7. Contacto de la Secretaría para aclaraciones (P132): «Mi perfil» remite a la cita de cotejo.
8. Con la poda por vencer, «Mis trámites» muestra dos botones principales («Iniciar una solicitud» y «Renovar»).
9. Decisiones que tomaron los equipos y conviene confirmar: la lista «Revisadas en esta prueba» de la bandeja se
   conservó; el primer día del curso también pasó a dd/mm/aaaa; un solo esquema del servidor para el material;
   revisión, cotejo y asistencia avisan antes de salir pero no guardan borrador.

**Fallas del estándar (rodeadas en el proyecto cuando se pudo; anotadas en el documento de fallas):** palabras partidas
en tablas (P145), etiqueta de estado que no se parte en modo tarjeta (P126), acuse con fecha larga y reloj de 12 horas
(P128), «Hoja 1 de 2» repetido en el visor (P146), rótulos de tabla en negritas oscuras (P147) y el borrador automático
(`data-borrador`) que guarda también lo que llena la página y no admite archivos (P148).

**Aceptado como está:** en la corrección, la página lleva el foco al paso de documentos al abrir, así que «Ir al
contenido» no es lo primero del teclado; el botón «Menú de pruebas» (sólo en la prueba) puede quedar sobre el pie del
visor al desplazarse.

## Pruebas al cierre

`probar-sitio` 658 de 658 con axe (más `SOLO=persistencia`), `probar-examen` 73, `probar-volumen`, `probar-esquemas`
(118 casos), `probar-base` y `probar-reglas` 173, auditor de CSS sin hallazgos, esquema y pendientes generados al día,
`auditar-sitio` 56 pantallas y 153 botones (sólo lo aceptado arriba).
