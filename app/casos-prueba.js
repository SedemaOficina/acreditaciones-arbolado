/* casos-prueba.js · Casos de prueba con nombre (sólo en la versión de prueba)

   Una lista única de «para qué sirve entrar con esta persona», agrupada por etapa del trámite, que usa el menú
   de pruebas en «Entrar como» y, en «Entrar», para llenar CURP y contraseña. Cada caso busca en los datos
   ficticios la primera persona que lo cumple (sin repetir persona entre casos); si ninguna lo cumple, el caso no
   se ofrece. Así la lista se mantiene sola cuando cambian los ficticios (herramientas/ficticios.mjs).

   Se carga en el navegador y en Node (herramientas/probar-sitio.mjs comprueba que todos los casos encuentran
   persona). Se quita en la etapa 3 junto con el acceso simulado. */
(function (global) {
  'use strict';
  const A = () => global.APD;

  /* [clave, texto, qué se puede probar, condición(persona, solicitud más reciente, acreditaciones, datos)] */
  const GRUPOS = [
    ['Sin trámite', [
      ['nueva', 'Persona nueva, sin trámites', 'Hacer una solicitud desde cero.', null],
      ['no-renovable', 'Poda vencida hace más de un año', 'Ver que ya no se renueva: se tramita como solicitud nueva.',
        (p, s, acs, d) => acs.some((a) => A().situacion(d, a) === 'vencida_no_renovable')]
    ]],
    ['Solicitud en curso', [
      ['borrador', 'Borrador sin enviar', 'Retomar una solicitud guardada.', (p, s) => s && s.estado === 'borrador'],
      ['enviada', 'Enviada, en revisión documental', 'Ver qué ve la persona mientras se revisa.',
        (p, s, acs, d) => s && s.estado === 'enviada' && s.modalidad !== 'renovacion' && s.tipo_acreditacion === 'poda' && vueltas(d, s) === 0],
      ['reenviada', 'Reenviada con correcciones (2.ª vuelta)', 'Ver la solicitud que vuelve a revisión con lo corregido.',
        (p, s, acs, d) => s && s.estado === 'enviada' && vueltas(d, s) > 0],
      ['obs-poda', 'Poda y derribo · con observaciones', 'Corregir los documentos observados y reenviar.',
        (p, s) => s && s.estado === 'con_observaciones' && s.tipo_acreditacion === 'poda'],
      ['obs-dict', 'Dictaminador técnico · con observaciones', 'Corregir lo observado de una solicitud de dictaminador.',
        (p, s) => s && s.estado === 'con_observaciones' && s.tipo_acreditacion === 'dictaminador'],
      ['perfil', 'Dictaminador que podría no cumplir el perfil, en revisión', 'Ver el aviso de perfil; en la revisión, decidir con el comprobante de estudios.',
        (p, s) => s && s.estado === 'enviada' && s.perfil_academico === 'no_cumple'],
      ['cita', 'Cita de cotejo asignada', 'Ver la fecha, la sede y los datos de pago.', (p, s) => s && s.estado === 'validada_en_linea'],
      ['espera', 'En espera de grupo', 'Ver qué sigue después del cotejo.',
        (p, s) => s && s.estado === 'lista_para_curso' && s.modalidad !== 'renovacion'],
      ['grupo', 'Con grupo asignado', 'Ver las fechas del curso y la asistencia.', (p, s) => s && s.estado === 'inscrita']
    ]],
    ['Renovación', [
      ['renov-enviada', 'Renovación enviada, en revisión', 'Ver una renovación mientras se revisa.',
        (p, s) => s && s.modalidad === 'renovacion' && s.estado === 'enviada'],
      ['renov-espera', 'Renovación en espera de grupo', 'Ver una renovación ya cotejada.',
        (p, s) => s && s.modalidad === 'renovacion' && s.estado === 'lista_para_curso' && s.tipo_acreditacion === 'poda'],
      ['dict-renov', 'Renovación de dictaminador', 'Ver la renovación de dictaminador con la poda vigente.',
        (p, s) => s && s.modalidad === 'renovacion' && s.tipo_acreditacion === 'dictaminador']
    ]],
    ['Solicitud terminada', [
      ['acreditada', 'Acreditación emitida', 'Ver cuándo y dónde recogerla.', (p, s) => s && s.estado === 'acreditada'],
      ['no-acreditada', 'No acreditada (calificación menor a la mínima)', 'Ver el resultado del examen.', (p, s) => s && s.estado === 'no_acreditada'],
      ['sin-examen', 'Sin derecho a examen (asistencia insuficiente)', 'Ver el resultado por asistencia.', (p, s) => s && s.estado === 'sin_derecho_examen'],
      ['rechazada', 'Dictaminador rechazado por perfil', 'Leer el motivo del rechazo.', (p, s) => s && s.estado === 'rechazada'],
      ['cancelada', 'Cancelada por la persona', 'Ver una solicitud cancelada.', (p, s) => s && s.estado === 'cancelada'],
      ['sin-atender', 'Concluida sin atender las observaciones', 'Ver el cierre por plazo.', (p, s) => s && s.estado === 'concluida_sin_atender']
    ]]
  ];
  const PERSONAL = ['personal', 'Revisión documental — María Ejemplo Revisora', 'Revisar las solicitudes enviadas.'];

  function vueltas(d, s) { return d.revision.filter((r) => r.solicitud_id === s.id).length; }

  /* → [{ grupo, casos: [{ clave, texto, prueba, persona }] }]; «persona» falta en «nueva» y en el personal */
  function lista(datos) {
    const usadas = new Set();
    const activas = datos.solicitante.filter((x) => x.estado === 'activa');
    const grupos = GRUPOS.map(([grupo, casos]) => ({ grupo, casos: casos.map(([clave, texto, prueba, cumple]) => {
      if (!cumple) return { clave, texto, prueba };
      const sirve = (x) => cumple(x, A().solicitudesDe(datos, x)[0], A().acreditacionesDe(datos, x), datos);
      // De preferencia una persona que no se use en otro caso; si sólo hay una, se repite
      const p = activas.find((x) => !usadas.has(x.id) && sirve(x)) || activas.find(sirve);
      if (!p) return null;
      usadas.add(p.id);
      return { clave, texto, prueba, persona: p };
    }).filter(Boolean) })).filter((g) => g.casos.length);
    grupos.push({ grupo: 'Personal de la Secretaría', casos: [{ clave: PERSONAL[0], texto: PERSONAL[1], prueba: PERSONAL[2] }] });
    return grupos;
  }
  /* Personas del registro anterior, todavía sin cuenta (p. ej., poda vigente sin trámite, o dictaminador con la poda
     vencida): se prueban creando la cuenta con su CURP */
  function migradas(datos) { return datos.solicitante.filter((x) => x.estado === 'sin_activar'); }

  global.APD_CASOS_PRUEBA = { lista, migradas, claves: () => GRUPOS.flatMap(([, c]) => c.map(([k]) => k)).concat(PERSONAL[0]) };
}(typeof window !== 'undefined' ? window : globalThis));
