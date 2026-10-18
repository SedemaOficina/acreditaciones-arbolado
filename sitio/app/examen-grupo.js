/* =========================================================
   examen-grupo.js · Quién presenta el examen de un grupo (etapa 2)

   Lo usan la pantalla de quien aplica el examen (aplicar.js), la pantalla del
   examen (examen.js: la fotografía y su menú de pruebas) y «Asistencia»
   (asistencia.js: la fotografía). En la etapa 3 lo da la API
   del personal con las mismas reglas que la base:
     · el examen es el último día del curso (días consecutivos, decisión
       2026-10-15) y se presenta en el salón de cómputo del PILARES, dentro
       del Vivero Nezahualcóyotl (decisión 2026-10-17);
     · tiene derecho a examen quien alcanzó los días mínimos de asistencia
       del curso (R33 y R35);
     · quien ya tiene su calificación (capturada o del examen en línea) no
       vuelve a presentarlo: no se le pasa lista ni se le da código (la base
       lo rechaza: examen_pk y asistencia_cerrada; auditoría 2026-10-18, C 2.5).

   El día del examen el instructor pasa lista en el salón de cómputo: compara a
   cada persona con su fotografía y su identificación oficial y la marca
   presente (eso registra la asistencia de ese día y genera su código) o
   ausente (decisión 2026-10-17, P78).

   VERSIÓN DE PRUEBA: los datos ficticios tienen capturado sólo el primer día
   del grupo en curso. Los días anteriores al examen sin capturar se cuentan
   como asistidos, salvo a quien faltó el primer día, a quien se le simula otra
   falta el día 3 para ver el caso «sin derecho a examen».
   ========================================================= */
(function (global) {
  'use strict';
  const LUGAR = 'Salón de cómputo del PILARES Vivero Nezahualcóyotl';

  function grupos(datos) { return datos.grupo.filter((g) => g.estado === 'en_curso' && g.fecha_inicio); }
  function curso(datos, g) { return APD.curso(datos, g.tipo_acreditacion, g.modalidad); }
  function fechaExamen(datos, g) { return APD.sumaDias(g.fecha_inicio, curso(datos, g).dias_duracion - 1); }

  /* Personas inscritas (activas), en orden alfabético, con su asistencia de los días anteriores al examen y si pueden
     presentarlo: el último día se cuenta al pasar lista en el salón de cómputo (decisión 2026-10-17). Quien ni
     asistiendo hoy llega al mínimo, no tiene derecho a examen y no se le pasa lista. */
  function personas(datos, g) {
    const c = curso(datos, g);
    const anteriores = c.dias_duracion - 1;
    const sols = Object.fromEntries(datos.solicitud.map((s) => [s.id, s]));
    const pers = Object.fromEntries(datos.solicitante.map((p) => [p.id, p]));
    return datos.inscripcion.filter((i) => i.grupo_id === g.id && i.activa).map((i) => {
      const s = sols[i.solicitud_id];
      const examen = (datos.examen || []).find((x) => x.inscripcion_id === i.id) || null;
      const p = pers[s.solicitante_id];
      const capturada = Object.fromEntries(datos.asistencia.filter((a) => a.inscripcion_id === i.id).map((a) => [a.dia, a.asistio]));
      const faltoAntes = Object.values(capturada).includes(false);
      let previos = 0;
      let simulada = false;
      for (let dia = 1; dia <= anteriores; dia++) {
        if (dia in capturada) { if (capturada[dia]) previos += 1; continue; }
        simulada = true;
        if (!(faltoAntes && dia === 3)) previos += 1; // prueba: otra falta simulada para ver el caso sin derecho
      }
      return { inscripcion: i, solicitud: s, persona: p, previos, anteriores, dias: c.dias_duracion, minimo: c.dias_minimos_asistencia,
        puede: previos + 1 >= c.dias_minimos_asistencia, simulada, examen };
    }).sort((a, b) => APD.nombreCompleto(a.persona).localeCompare(APD.nombreCompleto(b.persona), 'es'));
  }

  /* Pasa lista a una persona (asistencia del último día) y, si está presente, genera su código; si ya tenía uno
     vigente, lo devuelve. En la etapa 3 la API registra la asistencia en apd.asistencia y el código en una sola
     transacción. */
  function pasarLista(datos, g, fila, presente, por) {
    if (fila.examen) return Promise.reject(new Error('Ya tiene su calificación: no presenta otro examen.'));
    return APD_EXAMEN_API.pasarLista(fila.inscripcion.id, presente, por).then(() => (presente ? generarPara(datos, g, fila, por) : null));
  }

  /* Genera (o devuelve) el código de una persona con derecho a examen */
  function generarPara(datos, g, fila, por) {
    const c = curso(datos, g);
    return APD_EXAMEN_API.generar({
      inscripcion_id: fila.inscripcion.id, folio: fila.solicitud.folio,
      // curp: sólo para traer su fotografía en la versión de prueba (en el SIA, la API da la imagen); no se muestra
      persona: { nombre: APD.nombreCompleto(fila.persona), expediente: fila.persona.numero_expediente || '', curp: fila.persona.curp },
      grupo: { id: g.id, folio: g.folio, examen_en: fechaExamen(datos, g), lugar: LUGAR },
      tipo: g.tipo_acreditacion, modalidad: g.modalidad, minima: Number(c.calificacion_minima), por
    });
  }

  /* Fotografía de la cuenta (la confirmada en el cotejo). En la versión de prueba: la cargada en este navegador o,
     para las personas ficticias, una silueta dibujada aquí (no es la foto de nadie). Devuelve una URL. */
  const siluetas = {};
  function fotoDe(curp, nombre) {
    const A = global.APD_ARCHIVOS_PRUEBA;
    return (A && curp ? A.foto(curp) : Promise.resolve(null)).then((r) => {
      if (r && r.blob) return URL.createObjectURL(r.blob);
      if (siluetas[curp]) return siluetas[curp];
      const token = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
      const ini = String(nombre || '').split(' ').slice(0, 2).map((x) => x.charAt(0)).join('');
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 150"><rect width="120" height="150" fill="${token('--fondo')}"/>`
        + `<circle cx="60" cy="58" r="28" fill="${token('--gris-cl')}"/><ellipse cx="60" cy="150" rx="50" ry="48" fill="${token('--gris-cl')}"/>`
        + `<text x="60" y="22" font-family="sans-serif" font-size="13" font-weight="700" text-anchor="middle" fill="${token('--guinda')}">${ini}</text>`
        + `<text x="60" y="142" font-family="sans-serif" font-size="9" text-anchor="middle" fill="${token('--blanco')}">Foto ficticia</text></svg>`;
      siluetas[curp] = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      return siluetas[curp];
    });
  }

  global.APD_EXAMEN_GRUPO = { LUGAR, grupos, curso, fechaExamen, personas, pasarLista, fotoDe };
}(window));
