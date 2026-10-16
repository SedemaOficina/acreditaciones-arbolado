/* tramites.js · «Mis trámites»: acreditaciones con su situación de vigencia y solicitudes con su estado,
   qué sigue y los datos que la persona necesita (cita, expediente, grupo, observaciones, resultado).
   Lee los datos ficticios exportados por la base; en la etapa 3 los da GET /apd/mis-tramites. */
(function () {
  'use strict';
  const { el, estado, datosLista, fecha, fechaHora, sumaDias } = APD;

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

  function fichaSolicitud(datos, s, persona) {
    const e = APD.ESTADOS[s.estado] || { texto: s.estado, tono: '', sigue: '' };
    let sigue = e.sigue;
    const pares = [['Folio de la solicitud', s.folio], ['Enviada el', fechaHora(s.enviada_en)]];
    const extra = [];
    const c = APD.curso(datos, s.tipo_acreditacion, s.modalidad);

    if (s.estado === 'validada_en_linea' && s.cita_en) pares.push(['Cita de cotejo', fechaHora(s.cita_en)]);
    // El expediente físico es de la persona y lo comparten todos sus trámites; se abre en el primer cotejo
    if (persona.numero_expediente && !['borrador', 'enviada', 'con_observaciones', 'validada_en_linea', 'cancelada', 'concluida_sin_atender'].includes(s.estado)) {
      pares.push(['Expediente', persona.numero_expediente]);
    }

    // Con la cita, los datos para pagar: el comprobante se presenta en la cita y ahí se emite la factura
    if (s.estado === 'validada_en_linea' && c) {
      // El monto que se le indicó al darle la cita; si entonces aún no había, el vigente de su curso
      const importe = s.pago_monto != null ? s.pago_monto : c.pago_monto;
      const monto = importe != null ? Number(importe).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : null;
      const instrucciones = (datos.parametro.find((x) => x.clave === 'pago_instrucciones') || {}).valor || '';
      extra.push(el('div', { class: 'aviso' }, [
        el('div', { class: 'aviso-texto' }, [
          el('p', {}, [el('strong', { texto: 'Datos para tu pago' })]),
          APD.datosLista([
            ['Concepto', c.pago_concepto, 'texto oficial del concepto de pago.'],
            ['Monto', monto || 'Sin monto', 'lo fija la Gaceta Oficial.'],
            ['Referencia', s.pago_referencia, 'formato de la referencia de pago.']
          ]),
          s.pago_monto == null && c.pago_fundamento ? el('p', { class: 'texto-gris', texto: c.pago_fundamento }) : null,
          APD.limpia(instrucciones) ? el('p', { texto: APD.limpia(instrucciones) }) : el('p', { class: 'pendiente', texto: 'Pendiente: banco, cuenta y forma de pago.' }),
          el('p', { texto: 'Paga antes de tu cita y lleva el comprobante impreso. En la cita la Secretaría verifica tu pago y emite tu factura.' }),
          el('p', { texto: 'Lleva también tu identificación oficial: con ella se confirma que la fotografía de tu cuenta es tuya. Si no se ve bien, ahí te toman otra.' })
        ])
      ]));
    }

    // Con grupo: lo que la persona necesita para asistir (cuándo se presenta, cuándo termina y dónde).
    // Los días del curso son consecutivos, como los cuenta la base al capturar asistencia (fecha_inicio + día - 1).
    // Terminado el curso (aprobada, acreditada…), la sede y las fechas del curso ya no se muestran.
    const g = grupoDe(datos, s);
    if (g && g.grupo && s.estado === 'inscrita') {
      if (g.grupo.fecha_inicio) {
        const ultimo = c ? sumaDias(g.grupo.fecha_inicio, c.dias_duracion - 1) : null;
        pares.unshift(['Preséntate el', fecha(g.grupo.fecha_inicio), 'hora de entrada.'], ['El curso termina el', ultimo && fecha(ultimo)], ['Sede', g.grupo.sede]);
        pares.push(['Grupo', g.grupo.folio]);
        sigue = c ? `Tu curso dura ${c.dias_duracion} ${c.dias_duracion === 1 ? 'día' : 'días'}; necesitas asistir al menos ${c.dias_minimos_asistencia} para presentar el examen.` : sigue;
      } else {
        pares.push(['Grupo', g.grupo.folio]);
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
    // El resultado del curso se muestra mientras es lo último que pasó; con la acreditación emitida ya no aporta
    if (ins && c && ['aprobada', 'no_acreditada', 'sin_derecho_examen'].includes(s.estado)) {
      const dias = datos.asistencia.filter((a) => a.inscripcion_id === ins.id && a.asistio).length;
      pares.push(['Asistencia', `${dias} de ${c.dias_duracion} ${c.dias_duracion === 1 ? 'día' : 'días'} (mínimo ${c.dias_minimos_asistencia})`]);
      const ex = datos.examen.find((x) => x.inscripcion_id === ins.id);
      if (ex) pares.push(['Calificación', `${Number(ex.calificacion).toFixed(1)} (mínima ${Number(c.calificacion_minima).toFixed(1)})`]);
    }
    if (s.estado === 'acreditada') {
      const a = datos.acreditacion.find((x) => x.solicitud_id === s.id);
      if (a) {
        // Lo que importa de una acreditación emitida: su número y su vigencia; va primero
        pares.unshift(['Folio de la acreditación', a.numero], ['Inicio de vigencia', fecha(a.emitida_en)], ['Fin de vigencia', fecha(a.vence_en)]);
        if (a.entregada_en) sigue = `La recogiste el ${fecha(a.entregada_en)}.`;
        else {
          const lugar = (datos.parametro.find((x) => x.clave === 'entrega_lugar') || {}).valor || '';
          sigue = `Tu acreditación está lista desde el ${fecha(a.emitida_en)}. Recógela en persona con tu identificación oficial. Ahí te toman la fotografía que lleva tu credencial y, al recibirla, firmas el comprobante de recepción.`;
          extra.push(APD.limpia(lugar) ? el('p', { texto: APD.limpia(lugar) }) : el('p', { class: 'pendiente', texto: 'Pendiente: lugar, días y horario de entrega.' }));
        }
      }
    }
    if (s.estado === 'aprobada') sigue = 'Aprobaste el examen. La Secretaría emite tu acreditación; aquí verás cuándo puedes recogerla.';
    if (s.estado === 'no_acreditada') sigue = 'No alcanzaste la calificación mínima. Para obtener la acreditación haces un trámite nuevo, con su pago.';
    if (s.estado === 'sin_derecho_examen') sigue = 'No alcanzaste la asistencia mínima. Para obtener la acreditación haces un trámite nuevo, con su pago.';
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

    // Lo reenviado en esta pestaña (simulación) aparece como «En revisión documental»
    const reenviadas = sesion.reenviadas || [];
    const sols = extras.concat(APD.solicitudesDe(datos, persona)
      .map((s) => (reenviadas.includes(s.folio) ? Object.assign({}, s, { estado: 'enviada' }) : s)));
    document.querySelector('[data-solicitudes]').replaceChildren(...(sols.length
      ? sols.map((s) => fichaSolicitud(datos, s, persona))
      : [el('p', { class: 'vacio', texto: 'Todavía no tienes solicitudes.' })]));

    // Una sola acción principal: iniciar una solicitud nueva, si hay algo que se pueda pedir como nueva
    const puedeNueva = ['poda', 'dictaminador'].some((t) => op[t].disponible && op[t].modalidad === 'nueva');
    document.querySelector('[data-nueva]').hidden = !puedeNueva;
    document.querySelector('[data-cargando]').textContent = 'Aquí ves tus acreditaciones y en qué va cada solicitud.';
  }).catch(() => {
    document.querySelector('[data-cargando]').textContent = 'No se pudo cargar tu información. Intenta de nuevo más tarde.';
  });
}());
