/* tramites.js · «Mis trámites»: acreditaciones con su situación de vigencia y solicitudes con su estado,
   qué sigue y los datos que la persona necesita (cita, expediente, grupo, observaciones, resultado).
   Lee los datos ficticios exportados por la base; en la etapa 3 los da GET /apd/mis-tramites. */
(function () {
  'use strict';
  const { el, estado, datosLista, fecha, fechaHora } = APD;

  function fichaAcreditacion(datos, a, op) {
    const sit = APD.situacion(datos, a);
    const v = APD.VIGENCIA[sit];
    const ficha = el('article', { class: 'ficha' }, [
      el('div', { class: 'ficha-cabeza' }, [
        el('h4', { class: 'ficha-titulo', texto: APD.TIPOS[a.tipo_acreditacion] }),
        estado(v.texto, v.tono)
      ]),
      el('p', { class: 'ficha-folio', texto: a.numero }),
      datosLista([
        ['Emitida el', fecha(a.emitida_en)],
        ['Vence el', fecha(a.vence_en)],
        ['Origen', a.origen === 'kobo' ? 'Registro anterior de la Secretaría' : '']
      ])
    ]);
    const ultima = APD.acreditacionesDe(datos, { id: a.solicitante_id }).find((x) => x.tipo_acreditacion === a.tipo_acreditacion) === a;
    if (!ultima) return ficha;
    const o = op[a.tipo_acreditacion];
    if (o.disponible && o.modalidad === 'renovacion') {
      const limite = APD.sumaMeses(a.vence_en, APD.parametro(datos, 'meses_despues_renovacion') || 12);
      ficha.append(el('p', { class: 'ficha-sigue', texto: sit === 'por_vencer'
        ? 'Ya puedes renovarla. Hazlo antes de que venza para no quedarte sin acreditación vigente.'
        : `Ya no está vigente: no puedes trabajar con ella. Puedes renovarla hasta el ${fecha(limite)}.` }));
      ficha.append(el('div', { class: 'ficha-acciones' }, [
        el('a', { class: 'btn btn-secundario', href: `solicitud.html?tipo=${a.tipo_acreditacion}`, texto: 'Renovar' })
      ]));
    } else if (sit === 'vencida_no_renovable') {
      ficha.append(el('p', { class: 'ficha-sigue', texto: 'Venció hace más de un año: para obtenerla de nuevo haces una solicitud nueva.' }));
    } else if (!o.disponible && o.motivo && sit === 'vigente') {
      ficha.append(el('p', { class: 'ficha-sigue texto-gris', texto: o.motivo.replace(/^Tu acreditación \S+ vence el [^.]+\. /, '') }));
    }
    return ficha;
  }

  function grupoDe(datos, s) {
    const ins = datos.inscripcion.find((i) => i.solicitud_id === s.id && i.activa);
    if (!ins) return null;
    return { ins, grupo: datos.grupo.find((g) => g.id === ins.grupo_id) };
  }

  function fichaSolicitud(datos, s) {
    const e = APD.ESTADOS[s.estado] || { texto: s.estado, tono: '', sigue: '' };
    let sigue = e.sigue;
    const pares = [['Folio', s.folio], ['Enviada el', fechaHora(s.enviada_en)]];
    const extra = [];
    const c = APD.curso(datos, s.tipo_acreditacion, s.modalidad);

    if (s.estado === 'validada_en_linea' && s.cita_en) pares.push(['Cita de cotejo', fechaHora(s.cita_en)]);
    if (s.numero_expediente) pares.push(['Expediente', s.numero_expediente]);

    const g = grupoDe(datos, s);
    if (g && g.grupo) {
      pares.push(['Grupo', g.grupo.folio]);
      if (g.grupo.fecha_inicio) {
        pares.push(['Inicia el', fecha(g.grupo.fecha_inicio)]);
        if (c) pares.push(['Duración', `${c.dias_duracion} ${c.dias_duracion === 1 ? 'día' : 'días'}`]);
        pares.push(['Sede', g.grupo.sede]);
      } else if (s.estado === 'inscrita') {
        sigue = 'Tu grupo se está integrando. La Secretaría te avisará la fecha y la sede cuando se confirme.';
      }
    }

    if (s.estado === 'con_observaciones') {
      const obs = datos.documento.filter((d) => d.solicitud_id === s.id && d.estado === 'con_observacion' && d.observacion);
      const req = Object.fromEntries(datos.requisito.map((r) => [r.clave, r.nombre]));
      if (obs.length) {
        extra.push(el('div', { class: 'aviso aviso-advertencia' }, [
          el('div', { class: 'aviso-texto' }, [
            el('p', {}, [el('strong', { texto: 'Lo que debes corregir:' })]),
            el('ul', { class: 'lista-obs' }, obs.map((d) => el('li', { texto: `${req[d.requisito] || d.requisito}: ${d.observacion}` })))
          ])
        ]));
      }
    }

    const ins = datos.inscripcion.filter((i) => i.solicitud_id === s.id).pop();
    if (ins && c && ['aprobada', 'acreditada', 'no_acreditada', 'sin_derecho_examen'].includes(s.estado)) {
      const dias = datos.asistencia.filter((a) => a.inscripcion_id === ins.id && a.asistio).length;
      pares.push(['Asistencia', `${dias} de ${c.dias_duracion} ${c.dias_duracion === 1 ? 'día' : 'días'} (mínimo ${c.dias_minimos_asistencia})`]);
      const ex = datos.examen.find((x) => x.inscripcion_id === ins.id);
      if (ex) pares.push(['Calificación', `${Number(ex.calificacion).toFixed(1)} (mínima ${Number(c.calificacion_minima).toFixed(1)})`]);
    }
    if (s.estado === 'acreditada') {
      const a = datos.acreditacion.find((x) => x.solicitud_id === s.id);
      if (a) { pares.push(['Acreditación', a.numero]); if (a.entregada_en) sigue = `La recogiste el ${fecha(a.entregada_en)}.`; }
    }
    if (s.motivo_cierre) pares.push(['Motivo', APD.limpia(s.motivo_cierre)]);

    const acciones = [];
    if (['borrador', 'con_observaciones'].includes(s.estado)) {
      acciones.push(el('a', { class: 'btn btn-secundario', href: `solicitud.html?folio=${encodeURIComponent(s.folio)}`, texto: s.estado === 'borrador' ? 'Continuar solicitud' : 'Corregir y reenviar' }));
    }

    return el('article', { class: 'ficha' }, [
      el('div', { class: 'ficha-cabeza' }, [
        el('h4', { class: 'ficha-titulo', texto: `${APD.TIPOS[s.tipo_acreditacion]} · ${APD.MODALIDADES[s.modalidad].toLowerCase()}` }),
        estado(e.texto, e.tono)
      ]),
      sigue ? el('p', { class: 'ficha-sigue', texto: sigue }) : null,
      ...extra,
      datosLista(pares),
      acciones.length ? el('div', { class: 'ficha-acciones' }, acciones) : null
    ]);
  }

  APD.cargar().then((datos) => {
    const persona = APD.requiereSesion(datos);
    if (!persona) return;
    APD.pintaSesion(document.querySelector('[data-sesion]'), persona);
    const sesion = APD.leeSesion() || {};
    const extras = sesion.solicitudes || [];
    const op = APD.opciones(datos, persona, extras);

    const acs = APD.acreditacionesDe(datos, persona);
    document.querySelector('[data-acreditaciones]').replaceChildren(...(acs.length
      ? acs.map((a) => fichaAcreditacion(datos, a, op))
      : [el('p', { class: 'vacio', texto: 'Todavía no tienes acreditaciones.' })]));

    // Lo reenviado en esta pestaña (simulación) aparece como «En revisión»
    const reenviadas = sesion.reenviadas || [];
    const sols = extras.concat(APD.solicitudesDe(datos, persona)
      .map((s) => (reenviadas.includes(s.folio) ? Object.assign({}, s, { estado: 'enviada' }) : s)));
    document.querySelector('[data-solicitudes]').replaceChildren(...(sols.length
      ? sols.map((s) => fichaSolicitud(datos, s))
      : [el('p', { class: 'vacio', texto: 'Todavía no tienes solicitudes.' })]));

    // Una sola acción principal: iniciar una solicitud nueva, si hay algo que se pueda pedir como nueva
    const puedeNueva = ['poda', 'dictaminador'].some((t) => op[t].disponible && op[t].modalidad === 'nueva');
    document.querySelector('[data-nueva]').hidden = !puedeNueva;
    document.querySelector('[data-cargando]').textContent = 'Aquí ves tus acreditaciones y en qué va cada solicitud.';
  }).catch(() => {
    document.querySelector('[data-cargando]').textContent = 'No se pudo cargar tu información. Intenta de nuevo más tarde.';
  });
}());
