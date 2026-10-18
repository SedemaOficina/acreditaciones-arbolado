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
        ['Para vencer', APD.textoVence(APD.diasParaVencer(datos, a.vence_en))],
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
    } else if (!o.disponible && a.tipo_acreditacion === 'dictaminador' && /poda y derribo/.test(o.motivo || '') && ['por_vencer', 'vencida_renovable'].includes(sit)) {
      // Dictaminador por renovar con la poda vencida (R43 y R05): se dice por qué no aparece «Renovar» y qué hacer
      ficha.append(el('p', { class: 'ficha-sigue', texto: 'Para renovarla necesitas tener vigente tu acreditación de poda y derribo: renueva primero la de poda.' }));
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
    const pares = [['Folio de la solicitud', s.folio], ['Fecha en que enviaste la solicitud', fechaHora(s.enviada_en)]];
    const extra = [];
    const c = APD.curso(datos, s.tipo_acreditacion, s.modalidad);

    const lugar = APD.sede(datos);
    // Dónde: la sede única; mientras no se confirme la dirección, se marca en amarillo
    const sedeTexto = (nombre) => [lugar.direccion ? `${nombre}, ${lugar.direccion}` : nombre, lugar.direccion ? null : 'dirección y referencias para llegar.'];
    if (s.estado === 'validada_en_linea' && s.cita_en) pares.push(['Cita de cotejo', fechaHora(s.cita_en)], ['Lugar de la cita', ...sedeTexto(lugar.nombre)]);
    // El expediente físico es de la persona y lo comparten todos sus trámites; se abre en el primer cotejo
    if (persona.numero_expediente && !['borrador', 'enviada', 'con_observaciones', 'validada_en_linea', 'cancelada', 'concluida_sin_atender', 'rechazada'].includes(s.estado)) {
      pares.push(['Número de expediente', persona.numero_expediente]);
    }

    // Con la cita, los datos para pagar: el comprobante se presenta en la cita y ahí se emite la factura. En una cita
    // nueva (no se presentó o no llevó el comprobante) la persona pudo haber pagado ya: los datos se repiten para quien
    // no ha pagado, con la advertencia de no pagar dos veces (auditoría integral, alta 3)
    const citaNueva = s.estado === 'validada_en_linea' && s.cita_motivo && s.cita_anterior;
    // En una cita en pausa la persona ya está en su cita: los datos de pago ya no van
    if (s.estado === 'validada_en_linea' && c && !s.cotejo_pausa) {
      // El monto que se le indicó al darle la cita; si entonces aún no había, el vigente de su curso
      const importe = s.pago_monto != null ? s.pago_monto : c.pago_monto;
      const monto = importe != null ? Number(importe).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : null;
      const instrucciones = (datos.parametro.find((x) => x.clave === 'pago_instrucciones') || {}).valor || '';
      extra.push(el('div', { class: 'aviso' }, [
        el('div', { class: 'aviso-texto aviso-pila' }, [
          el('p', {}, [el('strong', { texto: citaNueva ? 'Datos para tu pago, si todavía no pagas' : 'Datos para tu pago' })]),
          citaNueva ? el('p', { texto: 'Si ya pagaste, no pagues otra vez: lleva el comprobante de ese pago.' }) : null,
          APD.datosLista([
            ['Concepto', c.pago_concepto, 'texto oficial del concepto de pago.'],
            ['Monto', monto || 'Sin monto', 'lo fija la Gaceta Oficial.'],
            ['Referencia', s.pago_referencia, 'formato de la referencia de pago.']
          ]),
          s.pago_monto == null && c.pago_fundamento ? el('p', { class: 'texto-gris', texto: c.pago_fundamento }) : null,
          APD.limpia(instrucciones) ? el('p', { texto: APD.limpia(instrucciones) }) : el('p', { class: 'pendiente', texto: 'Pendiente: banco, cuenta y forma de pago.' }),
          citaNueva ? null : el('p', { texto: 'Paga antes de tu cita y lleva el comprobante impreso. En la cita la Secretaría verifica tu pago y emite tu factura.' }),
          el('p', { texto: 'Lleva también tu identificación oficial: con ella se confirma que la fotografía de tu cuenta es tuya.' })
        ])
      ]));
    }

    // Con grupo: lo que la persona necesita para asistir (cuándo se presenta, cuándo termina y dónde).
    // Los días del curso son consecutivos, como los cuenta la base al capturar asistencia (fecha_inicio + día - 1).
    // Terminado el curso (aprobada, acreditada…), la sede y las fechas del curso ya no se muestran.
    const g = grupoDe(datos, s);
    // La fecha sólo se da con el grupo confirmado: uno que regresó a «por confirmar» (una baja lo dejó bajo el mínimo)
    // conserva su fecha como propuesta, pero ya no es segura (auditoría integral, alta 2)
    if (g && g.grupo && s.estado === 'inscrita') {
      if (g.grupo.fecha_inicio && ['confirmado', 'en_curso'].includes(g.grupo.estado)) {
        const ultimo = c ? sumaDias(g.grupo.fecha_inicio, c.dias_duracion - 1) : null;
        // Hora de entrada del grupo (la misma todos los días); la de salida la define el área (P91)
        pares.unshift(g.grupo.hora_entrada ? ['Preséntate el', `${fecha(g.grupo.fecha_inicio)}, a las ${APD.hhmm(g.grupo.hora_entrada)}`] : ['Preséntate el', fecha(g.grupo.fecha_inicio), 'hora de entrada.'], ['El curso termina el', ultimo && fecha(ultimo)], ['Lugar del curso', ...sedeTexto(g.grupo.sede)]);
        pares.push(['Grupo', g.grupo.folio]);
        // Lo que necesita para no perder el examen: asistencia, identificación, cuándo es y la calificación (alta 11)
        if (c) {
          const unDia = c.dias_duracion === 1;
          sigue = { texto: `Tu curso dura ${c.dias_duracion} ${unDia ? 'día' : 'días'}.`, pasos: [
            unDia ? 'Asiste al curso completo: sin esa asistencia no puedes presentar el examen.' : `Asiste al menos ${c.dias_minimos_asistencia} de los ${c.dias_duracion} días: con menos no puedes presentar el examen.`,
            `${unDia ? 'Al terminar el curso' : 'El último día'} presentas el examen en computadora, en el salón de cómputo del PILARES Vivero Nezahualcóyotl.`,
            'Lleva tu identificación oficial: sin ella no te dan tu código para el examen.',
            `Para aprobar necesitas al menos ${Number(c.calificacion_minima).toFixed(1)}. Si apruebas, ese mismo día recoges tu credencial en la oficina del Vivero.`
          ] };
        }
      } else {
        pares.push(['Grupo', g.grupo.folio]);
        sigue = g.grupo.fecha_inicio
          ? 'Tu grupo todavía no está confirmado: la fecha que tenía puede cambiar. La Secretaría te avisará el primer día y la hora cuando se confirme.'
          : 'Ya tienes grupo, pero todavía no está confirmado. La Secretaría te avisará la fecha y la sede cuando se confirme.';
      }
    }

    // Cita de cotejo en pausa (decisión 2026-10-17): un documento no coincidió y la persona puede cargar hoy el correcto
    const req = Object.fromEntries(datos.requisito.map((r) => [r.clave, r.nombre]));
    const vencida = APD.pausaVencida(datos, s);
    if (vencida) {
      // La pausa sólo dura el día de la cita: ya no se carga aquí (auditoría integral, alta 6)
      sigue = { texto: `La pausa de tu cita del ${fecha(s.cotejo_pausa.cita_en || s.cita_en)} venció: sólo duraba ese día.`, pasos: ['La Secretaría regresa tu solicitud con observaciones.', 'Cuando la veas así, corrige el documento que no coincidió y reenvía tu solicitud.', 'Después de revisarla otra vez, recibes una cita nueva.'] };
    } else if (s.estado === 'validada_en_linea' && s.cotejo_pausa) {
      const pausa = s.cotejo_pausa;
      const vigentes = datos.documento.filter((d) => d.solicitud_id === s.id && d.vigente && pausa.docs.includes(d.requisito));
      const cargados = vigentes.filter((d) => APD.cargadoTras(d, pausa));
      sigue = cargados.length === pausa.docs.length
        ? { texto: 'Ya cargaste el documento correcto.', pasos: ['Imprímelo.', `Regresa con la persona que te atiende en el ${lugar.nombre}.`, 'Ahí termina tu cotejo.'] }
        : { texto: 'Tu cita de cotejo está en pausa: un documento no coincidió con el que cargaste.', pasos: ['Consigue hoy el documento correcto.', 'Cárgalo aquí, en «Mis trámites».', 'Regresa con la persona que te atiende, con el documento impreso.'] };
      if (cargados.length < pausa.docs.length) {
        extra.push(el('div', { class: 'aviso aviso-advertencia' }, [
          el('div', { class: 'aviso-texto' }, [
            el('p', {}, [el('strong', { texto: 'Lo que no coincidió en tu cita:' })]),
            el('ul', { class: 'lista-obs' }, vigentes.filter((d) => !cargados.includes(d)).map((d) => el('li', { texto: `${req[d.requisito] || d.requisito}: ${d.observacion || 'no coincide con el que llevaste.'}` })))
          ])
        ]));
      }
    }
    // Lo que cambió va arriba de la ficha, antes de los datos (propuesta «Avisos y confirmaciones», 2026-10-17): cita
    // nueva por no presentarse o por no traer el comprobante de pago, observaciones del cotejo, grupo cancelado
    const cambio = [];
    if (citaNueva) {
      // Sin pago, el aviso ya trae sus pasos; no se repiten abajo
      if (s.cita_motivo === 'sin_pago') sigue = '';
      else sigue = { pasos: ['Imprime los mismos documentos que cargaste.', 'Si ya pagaste, lleva el comprobante de ese pago; si no, paga con los datos de abajo.', 'Acude a tu cita nueva con tus documentos y tu comprobante.'] };
      cambio.push(s.cita_motivo === 'sin_pago'
        ? APD.aviso('pend', 'No presentaste tu comprobante de pago', { texto: `Tu cita nueva es el ${fechaHora(s.cita_en)}.`, pasos: ['Si ya pagaste, imprime el comprobante de ese pago: no pagues otra vez.', 'Si todavía no pagas, paga con los datos de abajo e imprime tu comprobante.', 'Acude a tu cita nueva con el comprobante y tus documentos impresos.'] })
        : APD.aviso('pend', `No te presentaste a tu cita del ${fecha(s.cita_anterior)}`, `Tu cita nueva es el ${fechaHora(s.cita_en)}. Si tampoco te presentas, tu solicitud se cierra.`));
    }
    const ultimaIns = datos.inscripcion.filter((i) => i.solicitud_id === s.id).pop();
    if (s.estado === 'lista_para_curso' && ultimaIns && !ultimaIns.activa && /^Grupo cancelado/.test(ultimaIns.motivo_baja || '')) {
      cambio.push(APD.aviso('pend', 'Tu grupo se canceló', 'Sigues en espera de grupo con tu misma antigüedad. La Secretaría te asignará otro y te avisará las fechas.'));
    }
    const porInasistencia = APD.cerradaPorInasistencia(s);
    if (porInasistencia) {
      sigue = 'No te presentaste a tu cita de cotejo por segunda vez y tu solicitud se cerró. Puedes iniciar una solicitud nueva.';
    }

    if (s.estado === 'con_observaciones') {
      const obs = datos.documento.filter((d) => d.solicitud_id === s.id && d.vigente && d.estado === 'con_observacion' && d.observacion);
      const enCotejo = obs.some((d) => d.en_cotejo);
      if (obs.length) {
        cambio.push(APD.aviso('pend', enCotejo ? 'En tu cita de cotejo esto no coincidió con lo que cargaste' : 'Lo que debes corregir', '',
          [el('ul', { class: 'lista-obs' }, obs.map((d) => el('li', { texto: `${req[d.requisito] || d.requisito}: ${d.observacion}` })))]));
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
        // Los mismos rótulos que en «Mis acreditaciones» (auditoría integral, textos: vocabulario)
        pares.unshift(['Número de acreditación', a.numero], ['Emitida el', fecha(a.emitida_en)], ['Vence el', fecha(a.vence_en)]);
        if (a.entregada_en) sigue = `Recogiste tu credencial el ${fecha(a.entregada_en)}.`;
        else {
          const entrega = (datos.parametro.find((x) => x.clave === 'entrega_lugar') || {}).valor || '';
          sigue = { texto: `Tu acreditación se emitió el ${fecha(a.emitida_en)}; tu credencial te espera.`, pasos: ['Recógela en persona, con tu identificación oficial.', 'Ahí te toman la fotografía que lleva tu credencial.', 'Al recibirla, firmas el comprobante de recepción.'] };
          pares.push(['Dónde recogerla', ...sedeTexto(`Oficina del ${lugar.nombre}`)]); // decisión 2026-10-18
          extra.push(APD.limpia(entrega) ? el('p', { texto: APD.limpia(entrega) }) : el('p', { class: 'pendiente', texto: 'Pendiente: días y horario de entrega.' }));
        }
      }
    }
    // La credencial se entrega en la oficina del Vivero, después del examen (decisión 2026-10-18); «hoy mismo» sólo el día
    // del examen (auditoría integral, media)
    const delDia = APD.diaDe(s.estado_desde) === APD.hoy(datos) || (s.estado_desde || '').slice(0, 10) === APD.hoy(datos);
    if (s.estado === 'aprobada') sigue = { texto: 'Aprobaste el examen.', pasos: [delDia ? 'Recoge tu credencial hoy mismo, en la oficina del Vivero, antes de irte.' : 'Recoge tu credencial en la oficina del Vivero.', 'Ahí te toman la fotografía que lleva tu credencial.', 'Al recibirla, firmas el comprobante de recepción.'] };
    if (s.estado === 'no_acreditada') sigue = 'No alcanzaste la calificación mínima. Para obtener la acreditación haces un trámite nuevo, con su pago.';
    if (s.estado === 'sin_derecho_examen') sigue = 'No alcanzaste la asistencia mínima. Para obtener la acreditación haces un trámite nuevo, con su pago.';
    // El motivo es un párrafo: va a todo el ancho, como aviso, después de los datos (auditoría 2026-10-17)
    // Cerrada sin atender (por inasistencia o por plazo), el motivo de la base ya lo dice el texto de arriba
    const motivo = s.motivo_cierre && s.estado !== 'concluida_sin_atender' ? el('div', { class: 'aviso' }, [el('div', { class: 'aviso-texto aviso-pila' }, [
      el('p', {}, [el('strong', { texto: s.estado === 'rechazada' ? 'Motivo del rechazo' : 'Motivo' })]),
      el('p', { texto: APD.limpia(s.motivo_cierre) })])]) : null;

    const acciones = [];
    if (s.estado === 'validada_en_linea' && s.cotejo_pausa && !vencida) {
      const pausa = s.cotejo_pausa;
      const faltan = pausa.docs.filter((k) => !datos.documento.some((d) => d.solicitud_id === s.id && d.vigente && d.requisito === k && APD.cargadoTras(d, pausa)));
      if (faltan.length) acciones.push(el('a', { class: 'btn btn-primario', href: `corregir.html?folio=${encodeURIComponent(s.folio)}`, texto: faltan.length === 1 ? 'Cargar el documento' : 'Cargar los documentos' }));
    }
    if (['borrador', 'con_observaciones'].includes(s.estado)) {
      // La acción que toca hacer en ese estado: botón principal (auditoría 2026-10-17)
      acciones.push(el('a', { class: 'btn btn-primario', href: `solicitud.html?folio=${encodeURIComponent(s.folio)}`, texto: s.estado === 'borrador' ? 'Continuar solicitud' : 'Corregir y reenviar' }));
    }

    // Etiqueta por familia, con icono; la cita nueva y el cierre por inasistencia dicen lo que pasó
    const etiqueta = vencida ? estado('La pausa venció', 'marcha')
      : s.estado === 'validada_en_linea' && s.cotejo_pausa ? estado('Cita en pausa: carga el documento', 'pend')
      : s.estado === 'validada_en_linea' && s.cita_motivo ? estado('Acude a tu cita nueva', 'pend')
        : porInasistencia ? estado('Cerrada: no te presentaste', 'error')
          : s.estado === 'inscrita' && g && g.grupo && g.grupo.estado === 'en_integracion' ? estado('Grupo por confirmar', 'marcha')
          : APD.estadoSolicitud(s);
    return el('article', { class: 'ficha' }, [
      el('div', { class: 'ficha-cabeza' }, [
        el('h4', { class: 'ficha-titulo', texto: `${APD.TIPOS[s.tipo_acreditacion]} · ${APD.MODALIDADES[s.modalidad].toLowerCase()}` }),
        etiqueta
      ]),
      ...cambio,
      sigue ? (typeof sigue === 'string' ? el('p', { class: 'ficha-sigue', texto: sigue }) : el('div', { class: 'ficha-sigue' }, APD.sigueEn(sigue))) : null,
      ...extra,
      datosLista(pares),
      motivo,
      acciones.length ? el('div', { class: 'ficha-acciones' }, acciones) : null
    ]);
  }

  APD.cargar().then((datos) => {
    const persona = APD.requiereSesion(datos);
    if (!persona) return;
    APD.pintaSesion(document.querySelector('[data-sesion]'), persona);
    // datos ya trae lo enviado en este navegador durante la prueba (APD.cargar)
    const op = APD.opciones(datos, persona, []);

    const acs = APD.acreditacionesDe(datos, persona);
    document.querySelector('[data-acreditaciones]').replaceChildren(...(acs.length
      ? acs.map((a) => fichaAcreditacion(datos, a, op))
      : [el('p', { class: 'vacio', texto: 'Todavía no tienes acreditaciones.' })]));

    // En curso: las que todavía avanzan, y la acreditada cuya credencial no se ha recogido (aún hay un paso).
    // Anteriores: las terminadas (cerradas, rechazadas, no acreditadas o con la credencial ya entregada).
    const sols = APD.solicitudesDe(datos, persona);
    const terminada = (s) => APD.FINALES.includes(s.estado)
      && !(s.estado === 'acreditada' && !((datos.acreditacion.find((a) => a.solicitud_id === s.id) || {}).entregada_en));
    const enCurso = sols.filter((s) => !terminada(s));
    const anteriores = sols.filter(terminada);
    document.querySelector('[data-solicitudes]').replaceChildren(...(enCurso.length
      ? enCurso.map((s) => fichaSolicitud(datos, s, persona))
      : [el('p', { class: 'vacio', texto: sols.length ? 'No tienes solicitudes en curso.' : 'Todavía no tienes solicitudes.' })]));
    document.querySelector('[data-anteriores-seccion]').hidden = !anteriores.length;
    document.querySelector('[data-anteriores]').replaceChildren(...anteriores.map((s) => fichaSolicitud(datos, s, persona)));

    // Una sola acción principal: iniciar una solicitud nueva, si hay algo que se pueda pedir como nueva
    const puedeNueva = ['poda', 'dictaminador'].some((t) => op[t].disponible && op[t].modalidad === 'nueva');
    document.querySelector('[data-nueva]').hidden = !puedeNueva;
    document.querySelector('[data-cargando]').textContent = 'Aquí ves tus acreditaciones y en qué va cada solicitud.';
  }).catch(() => {
    document.querySelector('[data-cargando]').textContent = 'No se pudo cargar tu información. Intenta de nuevo más tarde.';
  });
}());
