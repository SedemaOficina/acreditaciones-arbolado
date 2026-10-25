/* casos-prueba.js · Casos de prueba con nombre (sólo en la versión de prueba)

   El menú de pruebas elige en dos pasos (decisión 2026-10-18): primero «¿Quién?» (persona nueva, podador,
   dictaminador, del registro anterior o personal de la Secretaría) y después «¿En qué momento?», los casos de ese
   perfil agrupados por etapa, cada uno con lo que se puede probar. Cada caso busca en los datos ficticios la primera
   persona que lo cumple (sin repetir persona entre casos); si ninguna lo cumple, el caso no se ofrece. Así la lista se
   mantiene sola cuando cambian los ficticios (herramientas/ficticios.mjs, que trae una persona para cada caso).

   Tipos de caso: con persona (entra con su sesión a «Mis trámites»), «nueva» (crea una cuenta de prueba), del
   registro anterior (abre «Crea tu cuenta» llenada con su CURP) y del personal (abre la pantalla de su papel).

   Se carga en el navegador y en Node (herramientas/probar-sitio.mjs comprueba que todos los casos encuentran
   persona). Se quita en la etapa 3 junto con el acceso simulado. */
(function (global) {
  'use strict';
  const A = () => global.APD;

  /* Ayudas para las condiciones: s = la solicitud más reciente; acs = sus acreditaciones */
  const sit = (d, a) => (a ? A().situacion(d, a) : null);
  const de = (acs, tipo) => acs.find((a) => a.tipo_acreditacion === tipo);
  const activa = (d, p) => A().solicitudesDe(d, p).some((x) => !A().FINALES.includes(x.estado));
  const grupoDe = (d, s) => {
    const i = s && d.inscripcion.find((x) => x.solicitud_id === s.id && x.activa);
    return i ? d.grupo.find((g) => g.id === i.grupo_id) : null;
  };
  const acredDe = (d, s) => (s ? d.acreditacion.find((a) => a.solicitud_id === s.id) : null);
  function vueltas(d, s) { return d.revision.filter((r) => r.solicitud_id === s.id).length; }

  /* [perfil, nombre, [[etapa, [[clave, texto, qué se puede probar, condición(persona, solicitud, acreditaciones, datos)]]]]] */
  const PERFILES = [
    ['nueva', 'Persona nueva', [
      ['Sin cuenta todavía', [
        ['nueva', 'Persona nueva, sin trámites', 'Crear la cuenta paso por paso y hacer una solicitud desde cero.', null]
      ]]
    ]],
    ['poda', 'Podador (poda y derribo)', [
      ['Solicitud en revisión', [
        ['borrador', 'Borrador sin enviar', 'Retomar una solicitud guardada.', (p, s) => s && s.estado === 'borrador'],
        ['enviada', 'Enviada, en revisión documental', 'Ver qué ve la persona mientras se revisa.',
          (p, s, acs, d) => s && s.estado === 'enviada' && s.modalidad !== 'renovacion' && s.tipo_acreditacion === 'poda' && vueltas(d, s) === 0],
        ['reenviada', 'Reenviada con correcciones (2.ª vuelta)', 'Ver la solicitud que vuelve a revisión con lo corregido.',
          (p, s, acs, d) => s && s.estado === 'enviada' && vueltas(d, s) > 0 && !A().revisionDeLaUltima(d, s)],
        // Máximo dos oportunidades para corregir (ajustes del equipo, 25/10/2026)
        ['obs-poda', 'Con observaciones', 'Corregir los documentos con observaciones y reenviar; ver «Te quedan 2 oportunidades para corregir».',
          (p, s, acs, d) => s && s.estado === 'con_observaciones' && s.tipo_acreditacion === 'poda' && !(A().oportunidades(d, s) || {}).ultima],
        ['obs-ultima', 'Con observaciones por segunda vez: su última oportunidad', 'Ver «Esta es tu última oportunidad para corregir» en «Mis trámites» y al corregir.',
          (p, s, acs, d) => s && (A().oportunidades(d, s) || {}).ultima],
        ['reenviada-ultima', 'Reenviada con su segunda corrección', 'Ver la solicitud en su última revisión: si siguen las observaciones, se cierra.',
          (p, s, acs, d) => A().revisionDeLaUltima(d, s)]
      ]],
      ['Cita de cotejo', [
        ['cita', 'Cita de cotejo asignada', 'Ver la fecha, el lugar y los datos de pago.',
          (p, s) => s && s.estado === 'validada_en_linea' && !s.cita_motivo && !s.cotejo_pausa],
        ['cita-inasistencia', 'Cita nueva: no se presentó a la primera', 'Ver el aviso de la cita nueva y que no pague dos veces.',
          (p, s) => s && s.estado === 'validada_en_linea' && s.cita_motivo === 'inasistencia'],
        ['cita-sin-pago', 'Cita nueva: no llevó el comprobante de pago', 'Ver los pasos: si ya pagó, llevar ese comprobante.',
          (p, s) => s && s.estado === 'validada_en_linea' && s.cita_motivo === 'sin_pago'],
        ['cita-pausa', 'Cita en pausa hoy: un documento no coincidió', 'Cargar el documento correcto y ver la cita lista para retomar.',
          (p, s, acs, d) => s && s.cotejo_pausa && !A().pausaVencida(d, s)],
        ['pausa-vencida', 'La pausa venció (era de otro día)', 'Ver que ya no se puede cargar: la solicitud regresa con observaciones.',
          (p, s, acs, d) => s && A().pausaVencida(d, s)]
      ]],
      ['Curso', [
        ['espera', 'En espera de curso', 'Ver qué sigue después del cotejo: que se le asigne un grupo del curso.',
          (p, s, acs, d) => s && s.estado === 'lista_para_curso' && s.modalidad !== 'renovacion' && !/^Grupo cancelado/.test((d.inscripcion.filter((i) => i.solicitud_id === s.id).pop() || {}).motivo_baja || '')],
        ['grupo-cancelado', 'Su grupo se canceló: de vuelta en espera', 'Ver el aviso de grupo cancelado y que conserva su antigüedad.',
          (p, s, acs, d) => s && s.estado === 'lista_para_curso' && /^Grupo cancelado/.test((d.inscripcion.filter((i) => i.solicitud_id === s.id).pop() || {}).motivo_baja || '')],
        ['grupo-por-confirmar', 'Con grupo todavía por confirmar', 'Ver que la fecha propuesta no se da como segura.',
          (p, s, acs, d) => s && s.estado === 'inscrita' && (grupoDe(d, s) || {}).estado === 'en_integracion'],
        ['grupo', 'Con grupo confirmado', 'Ver las fechas del curso, qué llevar y la calificación mínima.',
          (p, s, acs, d) => s && s.estado === 'inscrita' && ['confirmado', 'en_curso'].includes((grupoDe(d, s) || {}).estado)],
        // El grupo del caso va del lunes 5 al viernes 9/10 (sesión de trabajo del 23/10/2026: de lunes a viernes): ya no es «hoy»
        ['aprobada', 'Aprobó el examen', 'Ver que recoge su credencial en la oficina del Vivero.', (p, s) => s && s.estado === 'aprobada']
      ]],
      ['Acreditación', [
        ['por-recoger', 'Acreditación emitida, credencial por recoger', 'Ver cuándo y dónde recogerla.',
          (p, s, acs, d) => s && s.estado === 'acreditada' && !(acredDe(d, s) || {}).entregada_en],
        ['acreditada', 'Acreditación emitida y credencial entregada', 'Ver la acreditación vigente y la solicitud entre las anteriores.',
          (p, s, acs, d) => s && s.estado === 'acreditada' && Boolean((acredDe(d, s) || {}).entregada_en) && !activa(d, p)],
        ['por-vencer', 'Acreditación por vencer, sin trámite', 'Ver «Renovar» y cuántos días faltan.',
          (p, s, acs, d) => sit(d, de(acs, 'poda')) === 'por_vencer' && !activa(d, p)],
        ['renov-enviada', 'Renovación enviada, en revisión', 'Ver una renovación mientras se revisa.',
          (p, s) => s && s.modalidad === 'renovacion' && s.tipo_acreditacion === 'poda' && s.estado === 'enviada'],
        ['renov-espera', 'Renovación con cotejo terminado, en espera de curso', 'Ver una renovación que ya pasó el cotejo.',
          (p, s) => s && s.modalidad === 'renovacion' && s.estado === 'lista_para_curso' && s.tipo_acreditacion === 'poda'],
        ['no-renovable', 'Vencida hace más de un año', 'Ver que ya no se renueva: se tramita como solicitud nueva.',
          (p, s, acs, d) => acs.some((a) => sit(d, a) === 'vencida_no_renovable')],
        // Cancelada por la Secretaría (P120, sesión de trabajo del 23/10/2026)
        ['acred-cancelada', 'Acreditación cancelada por la Secretaría', 'Ver que ya no está vigente, el motivo y el fundamento, y que no aparece «Renovar».',
          (p, s, acs, d) => acs.some((a) => sit(d, a) === 'cancelada')]
      ]],
      /* Reposición de la credencial por pérdida o robo (P140, sesión de trabajo del 23/10/2026) */
      ['Reposición de la credencial', [
        ['repos-puede', 'Credencial vigente: pedir su reposición', 'Pedir la reposición por pérdida o robo, con el acta que levantó.',
          (p, s, acs, d) => !activa(d, p) && acs.some((a) => !A().porQueNoReponer(d, a)) && !acs.some((a) => A().reposicionesDe(d, a).length)],
        ['repos-solicitada', 'Pidió la reposición: acta en revisión', 'Ver que la Secretaría revisa su acta.',
          (p, s, acs, d) => acs.some((a) => (A().reposicionAbierta(d, a) || {}).estado === 'solicitada')],
        ['repos-observada', 'Reposición con observaciones en el acta', 'Ver qué corregir y cargar el acta corregida.',
          (p, s, acs, d) => acs.some((a) => (A().reposicionAbierta(d, a) || {}).estado === 'con_observaciones')],
        ['repos-aceptada', 'Acta aceptada: pagar y recoger la credencial', 'Ver la cuota de reposición y dónde recoger la credencial.',
          (p, s, acs, d) => acs.some((a) => (A().reposicionAbierta(d, a) || {}).estado === 'acta_aceptada')],
        ['repos-repuesta', 'Credencial repuesta', 'Ver la fecha de la reposición: la acreditación conserva su número y su vigencia.',
          (p, s, acs, d) => acs.some((a) => (A().reposicionesDe(d, a)[0] || {}).estado === 'repuesta')]
      ]],
      ['Terminada sin acreditación', [
        ['no-acreditada', 'No acreditada (calificación menor a la mínima)', 'Ver el resultado del examen.', (p, s) => s && s.estado === 'no_acreditada'],
        ['sin-examen', 'Sin derecho a examen (asistencia insuficiente)', 'Ver el resultado por asistencia.', (p, s) => s && s.estado === 'sin_derecho_examen'],
        ['dos-inasistencias', 'Cerrada: no se presentó dos veces a la cita', 'Ver el cierre por inasistencias y que puede iniciar otra.',
          (p, s) => s && A().cerradaPorInasistencia(s)],
        ['sin-atender', 'Cerrada por no corregir a tiempo', 'Ver la solicitud que se cerró porque venció el plazo para corregir.',
          (p, s) => s && s.estado === 'concluida_sin_atender' && !A().cerradaPorInasistencia(s) && !A().cerradaSinOportunidades(s)],
        ['sin-oportunidades', 'Cerrada: se agotaron las oportunidades de corrección', 'Ver el motivo del cierre y una sola acción: «Iniciar una solicitud nueva».',
          (p, s) => A().cerradaSinOportunidades(s)],
        ['cancelada', 'Cancelada por la persona', 'Ver una solicitud cancelada.', (p, s) => s && s.estado === 'cancelada']
      ]]
    ]],
    ['dictaminador', 'Dictaminador técnico', [
      /* Antes de empezar (sesión de trabajo del 23/10/2026): para pedirla por primera vez hace falta la poda durante al menos
         dos años consecutivos (APD.podaContinuaDesde, como apd.poda_continua_desde) */
      ['Antes de empezar: dos años de poda', [
        ['dict-puede', 'Con la poda dos años o más, sin corte', 'Ver que puede iniciar la solicitud de dictaminador.',
          (p, s, acs, d) => !de(acs, 'dictaminador') && !d.solicitud.some((x) => x.solicitante_id === p.id && x.tipo_acreditacion === 'dictaminador') && A().opciones(d, p, []).dictaminador.disponible],
        ['dict-menos-dos', 'Con la poda desde hace menos de dos años', 'Ver por qué todavía no puede pedirla y desde cuándo podrá.',
          (p, s, acs, d) => acs.filter((a) => a.tipo_acreditacion === 'poda').length === 1 && A().opciones(d, p, []).dictaminador.clave === 'dos_anios'],
        ['dict-corte', 'Con un corte en su poda (renovó fuera de plazo)', 'Ver que la cuenta de los dos años empezó otra vez.',
          (p, s, acs, d) => acs.filter((a) => a.tipo_acreditacion === 'poda').length > 1 && A().opciones(d, p, []).dictaminador.clave === 'dos_anios']
      ]],
      ['Solicitud', [
        ['obs-dict', 'Con observaciones', 'Corregir las observaciones de una solicitud de dictaminador.',
          (p, s) => s && s.estado === 'con_observaciones' && s.tipo_acreditacion === 'dictaminador'],
        ['perfil', 'Podría no cumplir el perfil, en revisión', 'Ver el aviso de perfil; en la revisión, decidir con el comprobante de estudios.',
          (p, s) => s && s.estado === 'enviada' && s.perfil_academico === 'no_cumple'],
        ['rechazada', 'Rechazado por perfil', 'Leer el motivo del rechazo.', (p, s) => s && s.estado === 'rechazada']
      ]],
      ['Vigencia y renovación', [
        ['dict-renov', 'Renovación de dictaminador', 'Ver la renovación de dictaminador con la poda vigente (sin años de experiencia).',
          (p, s) => s && s.modalidad === 'renovacion' && s.tipo_acreditacion === 'dictaminador'],
        ['dict-poda-vencida', 'Dictaminador por vencer con la poda vencida', 'Ver por qué no aparece «Renovar»: primero se renueva la de poda (R43).',
          (p, s, acs, d) => ['vigente', 'por_vencer'].includes(sit(d, de(acs, 'dictaminador'))) && ['vencida_renovable', 'vencida_no_renovable'].includes(sit(d, de(acs, 'poda'))) && !activa(d, p)]
      ]]
    ]],
    ['kobo', 'Del registro anterior (Kobo), sin cuenta', [
      ['Activar la cuenta', [
        ['kobo-vigente', 'Con su poda vigente', 'Crear la cuenta con su CURP y ver sus acreditaciones anteriores.',
          (p, s, acs, d) => p.estado === 'sin_activar' && sit(d, de(acs, 'poda')) === 'vigente' && !de(acs, 'dictaminador')],
        ['kobo-renovar', 'Para renovar (primera renovación en el sistema)', 'Crear la cuenta y renovar: carga todos los documentos, como una nueva.',
          (p, s, acs, d) => p.estado === 'sin_activar' && acs.some((a) => ['por_vencer', 'vencida_renovable'].includes(sit(d, a)))]
      ]]
    ]],
    ['personal', 'Personal de la Secretaría', [
      ['Su papel', [
        ['personal', 'Revisión documental', 'Revisar las solicitudes enviadas paso por paso, un documento a la vez: validar con cita, observar o rechazar.', null, 'revision.html'],
        // La revisión de la segunda corrección (ajustes del equipo, 25/10/2026): es la última oportunidad de la persona
        ['personal-ultima-revision', 'Revisión documental: la segunda corrección', 'Revisar la solicitud en su última oportunidad: si algo sigue con observación, «Cerrar la solicitud».', null, 'revisar.html?folio=APD-S-2026-00062'],
        ['personal-citas', 'Citas de cotejo', 'Atender las citas del día paso por paso: ¿es la persona?, documentos originales, pago y factura, resultado (pausa, inasistencia).', null, 'citas.html'],
        // «Grupos» paso a paso (decisión del 24/10/2026): un solo camino para armar un grupo; «Programar un curso» lleva ahí
        ['personal-grupos', 'Grupos: armar un grupo', 'Paso a paso: el curso, la semana en el calendario, quiénes van y crearlo (lo confirma Capacitación); abajo, los grupos programados con lo que les falta.', null, 'grupos.html'],
        ['personal-programar', 'Grupos: darle semana a un grupo', 'Un grupo por confirmar sin semana: elegirla en el calendario y completarlo con las que más esperan.', null, 'grupos.html?grupo=APD-G-2026-004&paso=2'],
        // Perfil «capacitación» (ajustes del equipo, 25/10/2026): asigna la persona instructora y confirma el grupo
        ['personal-capacitacion', 'Capacitación: asignar instructores y confirmar', 'Ver los grupos que esperan persona instructora o confirmación, del más próximo al más lejano; en la ficha, asignarla (sólo las libres esas fechas) y confirmar el grupo cuando tenga el mínimo (complételo antes en «Grupos», con el perfil de revisión y cotejo).', null, 'capacitacion.html?perfil=capacitacion'],
        ['personal-material', 'Material de estudio', 'Subir, reemplazar, publicar u ocultar los documentos para el examen.', null, 'material-personal.html'],
        ['personal-asistencia', 'Instructor: asistencia', 'Capturar la asistencia de cada día del curso.', null, 'asistencia.html'],
        ['personal-examen', 'Instructor: aplicar el examen', 'Pasar lista el último día (cuenta como asistencia) y seguir el examen.', null, 'aplicar.html'],
        // Sesión de trabajo del 23/10/2026: reposición de credenciales (P140) y cancelación por instructores y directivos (P120)
        ['personal-acreditaciones', 'Acreditaciones: reposición de credenciales', 'Revisar el acta y entregar la credencial repuesta con la factura de la cuota.', null, 'acreditaciones.html'],
        ['personal-cancelar-instructor', 'Instructor: cancelar una acreditación', 'Cancelar una acreditación vigente, con motivo y fundamento.', null, 'acreditaciones.html?perfil=instructor'],
        ['personal-cancelar-direccion', 'Dirección: cancelar una acreditación', 'Cancelar una acreditación vigente, con motivo y fundamento (perfil de administración).', null, 'acreditaciones.html?perfil=administracion'],
        // Registro asistido (decisión 2026-10-25): personas que no saben leer ni escribir
        ['personal-asistido', 'Registro asistido', 'Registrar en el Vivero a una persona que no sabe leer ni escribir y capturar su solicitud, con ella presente.', null, 'asistido.html'],
        ['personal-ventanilla', 'Ventanilla', 'Buscar a una persona, decirle en qué va su trámite y cargar por ella lo corregido.', null, 'ventanilla.html']
      ]]
    ]]
  ];

  /* → [{ perfil, perfilTexto, grupo, casos: [{ clave, texto, prueba, persona?, pantalla?, migrada? }] }] */
  function lista(datos) {
    const usadas = new Set();
    // Las del registro asistido que no han activado su cuenta no entran en línea (decisión 2026-10-25): no se «entra como» ellas
    const activas = datos.solicitante.filter((x) => x.estado === 'activa' && !(x.registro_asistido_en && !x.activada_en));
    const sinCuenta = datos.solicitante.filter((x) => x.estado === 'sin_activar');
    const grupos = [];
    for (const [perfil, perfilTexto, etapas] of PERFILES) {
      for (const [grupo, casos] of etapas) {
        const hallados = casos.map(([clave, texto, prueba, cumple, pantalla]) => {
          if (!cumple) return { clave, texto, prueba, pantalla };
          const sirve = (x) => cumple(x, A().solicitudesDe(datos, x)[0], A().acreditacionesDe(datos, x), datos);
          const fuente = perfil === 'kobo' ? sinCuenta : activas;
          // De preferencia una persona que no se use en otro caso; si sólo hay una, se repite
          const p = fuente.find((x) => !usadas.has(x.id) && sirve(x)) || fuente.find(sirve);
          if (!p) return null;
          usadas.add(p.id);
          return perfil === 'kobo' ? { clave, texto, prueba, persona: p, migrada: true } : { clave, texto, prueba, persona: p };
        }).filter(Boolean);
        if (hallados.length) grupos.push({ perfil, perfilTexto, grupo, casos: hallados });
      }
    }
    return grupos;
  }
  /* Personas del registro anterior, todavía sin cuenta: se prueban creando la cuenta con su CURP */
  function migradas(datos) { return datos.solicitante.filter((x) => x.estado === 'sin_activar'); }
  const PERFIL_DE = Object.fromEntries(PERFILES.flatMap(([perfil, , etapas]) => etapas.flatMap(([, casos]) => casos.map(([k]) => [k, perfil]))));

  global.APD_CASOS_PRUEBA = {
    lista, migradas,
    perfiles: () => PERFILES.map(([clave, texto]) => ({ clave, texto })),
    perfilDe: (clave) => PERFIL_DE[clave] || null,
    claves: () => Object.keys(PERFIL_DE)
  };
}(typeof window !== 'undefined' ? window : globalThis));
