/* =========================================================
   examen-grupo.js · Quién presenta el examen de un grupo (etapa 2)

   Lo usan la pantalla de quien aplica el examen (aplicar.html) y el menú de
   pruebas de la pantalla del examen (examen.html). En la etapa 3 lo da la API
   del personal con las mismas reglas que la base:
     · el examen es el último día del curso (días consecutivos, decisión
       2026-10-15) y se presenta en el salón de cómputo del PILARES, dentro
       del Vivero Nezahualcóyotl (decisión 2026-10-17);
     · tiene derecho a examen quien alcanzó los días mínimos de asistencia
       del curso (R33 y R35).

   VERSIÓN DE PRUEBA: los datos ficticios tienen capturado sólo el primer día
   del grupo en curso. Los días sin capturar se cuentan como asistidos, salvo
   a quien faltó el primer día, a quien se le simula otra falta el día 3 para
   ver el caso «sin derecho a examen».
   ========================================================= */
(function (global) {
  'use strict';
  const LUGAR = 'Salón de cómputo del PILARES Vivero Nezahualcóyotl';

  function grupos(datos) { return datos.grupo.filter((g) => g.estado === 'en_curso' && g.fecha_inicio); }
  function curso(datos, g) { return APD.curso(datos, g.tipo_acreditacion, g.modalidad); }
  function fechaExamen(datos, g) { return APD.sumaDias(g.fecha_inicio, curso(datos, g).dias_duracion - 1); }

  /* Personas inscritas (activas), con su asistencia y su derecho a examen, en orden alfabético */
  function personas(datos, g) {
    const c = curso(datos, g);
    const sols = Object.fromEntries(datos.solicitud.map((s) => [s.id, s]));
    const pers = Object.fromEntries(datos.solicitante.map((p) => [p.id, p]));
    return datos.inscripcion.filter((i) => i.grupo_id === g.id && i.activa).map((i) => {
      const s = sols[i.solicitud_id];
      const p = pers[s.solicitante_id];
      const capturada = Object.fromEntries(datos.asistencia.filter((a) => a.inscripcion_id === i.id).map((a) => [a.dia, a.asistio]));
      const faltoAntes = Object.values(capturada).includes(false);
      let asistidos = 0;
      let simulada = false;
      for (let dia = 1; dia <= c.dias_duracion; dia++) {
        if (dia in capturada) { if (capturada[dia]) asistidos += 1; continue; }
        simulada = true;
        if (!(faltoAntes && dia === 3)) asistidos += 1; // prueba: otra falta simulada para ver el caso sin derecho
      }
      return { inscripcion: i, solicitud: s, persona: p, asistidos, dias: c.dias_duracion, minimo: c.dias_minimos_asistencia, derecho: asistidos >= c.dias_minimos_asistencia, simulada };
    }).sort((a, b) => APD.nombreCompleto(a.persona).localeCompare(APD.nombreCompleto(b.persona), 'es'));
  }

  /* Genera (o devuelve) el código de una persona con derecho a examen */
  function generarPara(datos, g, fila, por) {
    const c = curso(datos, g);
    return APD_EXAMEN_API.generar({
      inscripcion_id: fila.inscripcion.id, folio: fila.solicitud.folio,
      persona: { nombre: APD.nombreCompleto(fila.persona), expediente: fila.persona.numero_expediente || '' },
      grupo: { id: g.id, folio: g.folio, examen_en: fechaExamen(datos, g), lugar: LUGAR },
      tipo: g.tipo_acreditacion, modalidad: g.modalidad, minima: Number(c.calificacion_minima), por
    });
  }

  global.APD_EXAMEN_GRUPO = { LUGAR, grupos, curso, fechaExamen, personas, generarPara };
}(window));
