/* tramites.js · «Mis trámites»: acreditaciones con su situación de vigencia y solicitudes con su estado,
   qué sigue y los datos que la persona necesita (cita, expediente, grupo, observaciones, resultado).
   Lee los datos ficticios exportados por la base; en la etapa 3 los da GET /apd/mis-tramites. */
(function () {
  'use strict';
  const { el, estado, datosLista, fecha, fechaHora, sumaDias } = APD;
  const ORDINAL = { 2: 'Segunda', 3: 'Tercera', 4: 'Cuarta', 5: 'Quinta' };
  /* «a, b y c» */
  const comoLista = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}` : xs[0] || '');
  /* La acción que toca hacer con una acreditación: renovarla (auditoría 2026-10-18, D26: esa tarjeta va primero) */
  const porRenovar = (datos, a, op) => {
    const o = op[a.tipo_acreditacion];
    const ultima = APD.acreditacionesDe(datos, { id: a.solicitante_id }).find((x) => x.tipo_acreditacion === a.tipo_acreditacion) === a;
    return ultima && o.disponible && o.modalidad === 'renovacion';
  };

  function fichaAcreditacion(datos, a, op) {
    const sit = APD.situacion(datos, a);
    const v = APD.VIGENCIA[sit];
    const ficha = el('article', { class: 'ficha' }, [
      el('div', { class: 'ficha-cabeza' }, [
        el('h4', { class: 'ficha-titulo', texto: APD.TIPOS[a.tipo_acreditacion] }),
        estado(v.texto, v.tono)
      ]),
      // El número con su rótulo, como en la tarjeta de la solicitud; el vencimiento con el rótulo según el caso (D10, D25)
      datosLista([
        ['Número de acreditación', a.numero],
        ['Emitida el', fecha(a.emitida_en)],
        ...APD.vencimiento(datos, a.vence_en),
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
        // Es la acción que toca: botón principal (D26)
        el('a', { class: 'btn btn-primario', href: `solicitud.html?tipo=${a.tipo_acreditacion}`, texto: 'Renovar' })
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
    // La cita (fecha, hora y lugar) va al principio de la ficha, antes de los datos de pago (auditoría 2026-10-18, D4)
    const cita = s.estado === 'validada_en_linea' && s.cita_en
      ? el('div', { class: 'ficha-cita' }, [datosLista([['Cita de cotejo', fechaHora(s.cita_en)], ['Lugar de la cita', ...sedeTexto(lugar.nombre)]])]) : null;
    const acudeEl = s.cita_en ? `el ${fecha(s.cita_en)} a las ${APD.hora(s.cita_en)}` : '';
    if (s.estado === 'validada_en_linea' && s.cita_en && !s.cotejo_pausa) {
      sigue = { pasos: ['Imprime los mismos documentos que cargaste.', 'Paga los derechos e imprime tu comprobante de pago.', `Acude a tu cita ${acudeEl} con tus documentos y tu comprobante.`] };
    }
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
        const entrada = g.grupo.hora_entrada ? `, a las ${APD.hhmm(g.grupo.hora_entrada)}` : '';
        const sinHora = g.grupo.hora_entrada ? null : 'hora de entrada.';
        // Con el curso ya empezado no se dice «Preséntate el …» (día pasado): en qué día va y cuándo es el examen
        // (auditoría 2026-10-18, D13). Los días son consecutivos, como los cuenta la base.
        const hoy = APD.hoy(datos);
        const dia = Math.round((new Date(`${hoy}T12:00:00-06:00`) - new Date(`${g.grupo.fecha_inicio}T12:00:00-06:00`)) / 86400000) + 1;
        const empezo = dia >= 1;
        const examen = ultimo ? `${fecha(ultimo)}, en el salón de cómputo del PILARES Vivero Nezahualcóyotl` : '';
        pares.unshift(...(empezo
          ? [['Tu curso empezó el', `${fecha(g.grupo.fecha_inicio)}${entrada}`, sinHora],
            c && dia <= c.dias_duracion ? ['Hoy es el día', `${dia} de ${c.dias_duracion}`] : ['El curso termina el', ultimo && fecha(ultimo)]]
          : [['Preséntate el', `${fecha(g.grupo.fecha_inicio)}${entrada}`, sinHora], ['El curso termina el', ultimo && fecha(ultimo)]]),
        ['Examen', examen], ['Lugar del curso', ...sedeTexto(g.grupo.sede)]);
        // Confirmado: el grupo por su nombre (curso y fechas) con el folio en chico (propuesta D, 2026-10-18). Por confirmar,
        // sólo el folio: la fecha propuesta todavía no es segura
        pares.push(['Grupo', APD.grupoTitulo(g.grupo, datos)]);
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

    // En espera de curso o con grupo: el material para preparar el examen, a libro cerrado (decisión 2026-10-18)
    if (['lista_para_curso', 'inscrita'].includes(s.estado)) {
      extra.push(el('p', { class: 'ficha-material' }, [
        document.createTextNode('El examen es a libro cerrado. Prepáralo con el '),
        el('a', { href: `material.html?curso=${encodeURIComponent(s.tipo_acreditacion)}&desde=tramites`, texto: 'material de estudio' }),
        document.createTextNode(' de la Secretaría.')
      ]));
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
            el('ul', { class: 'lista-obs' }, vigentes.filter((d) => !cargados.includes(d)).map((d) => el('li', { texto: APD.observacionDe(req[d.requisito] || d.requisito, d.observacion || 'no coincide con el que llevaste.') })))
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
      else sigue = { pasos: ['Imprime los mismos documentos que cargaste.', 'Si ya pagaste, lleva el comprobante de ese pago; si no, paga con los datos de abajo.', `Acude a tu cita nueva ${acudeEl} con tus documentos y tu comprobante.`] };
      cambio.push(s.cita_motivo === 'sin_pago'
        ? APD.aviso('pend', 'No presentaste tu comprobante de pago', { texto: `Tu cita nueva es el ${fechaHora(s.cita_en)}.`, pasos: ['Si ya pagaste, imprime el comprobante de ese pago: no pagues otra vez.', 'Si todavía no pagas, paga con los datos de abajo e imprime tu comprobante.', `Acude a tu cita nueva ${acudeEl} con el comprobante y tus documentos impresos.`] })
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
      // Regresó desde el cotejo (C 3.2): la cita con resultado «con_observaciones», posterior a la última revisión, como
      // lo deja la base (apd.cita); la marca en_cotejo del documento queda como respaldo de la prueba
      const ultimaRev = datos.revision.filter((r) => r.solicitud_id === s.id).map((r) => r.revisada_en || '').sort().pop() || '';
      const desdeCita = (datos.cita || []).some((c) => c.solicitud_id === s.id && c.resultado === 'con_observaciones'
        && new Date(c.atendida_en || c.programada_en) > new Date(ultimaRev || 0));
      const enCotejo = desdeCita || obs.some((d) => d.en_cotejo);
      if (obs.length) {
        cambio.push(APD.aviso('pend', enCotejo ? 'En tu cita de cotejo esto no coincidió con lo que cargaste' : 'Lo que debes corregir', '',
          [el('ul', { class: 'lista-obs' }, obs.map((d) => el('li', { texto: APD.observacionDe(req[d.requisito] || d.requisito, d.observacion) })))]));
      }
      // El plazo con su fecha (auditoría 2026-10-18, D3). La regla del plazo todavía no está en la base (P02: propuesta de
      // 20 días hábiles): se dice cuándo llegaron las observaciones y la fecha límite queda marcada por confirmar.
      sigue = { texto: `Recibiste las observaciones el ${fecha(s.estado_desde)}. Hay un plazo para corregir: si no reenvías tu solicitud a tiempo, se cierra.`,
        pasos: APD.ESTADOS.con_observaciones.sigue.pasos };
      pares.unshift(['Corrige antes del', 'Fecha por definir', 'el plazo para atender observaciones (P02).']);
    }
    // En revisión (D12): qué sigue, el plazo pendiente y, si es otra vuelta, qué corrigió
    if (s.estado === 'enviada') {
      const vueltas = datos.revision.filter((r) => r.solicitud_id === s.id).length;
      const corregidos = [...new Set(datos.documento.filter((d) => d.solicitud_id === s.id && !d.vigente && d.estado === 'con_observacion').map((d) => d.requisito))]
        .filter((k) => datos.documento.some((d) => d.solicitud_id === s.id && d.vigente && d.requisito === k))
        .map((k) => (req[k] || k).toLocaleLowerCase('es-MX'));
      if (vueltas) {
        const n = vueltas + 1;
        sigue = Object.assign({}, sigue, { texto: `${ORDINAL[n] || `${n}.ª`} revisión${corregidos.length ? `: corregiste ${comoLista(corregidos)}` : ''}. ${sigue.texto}` });
      }
      extra.push(el('p', { class: 'pendiente', texto: 'Pendiente (P02): plazo de la revisión.' }));
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
        // Emisión y vencimiento ya están en su tarjeta, en «Mis acreditaciones» (D25): aquí sólo el número que las liga
        pares.unshift(['Número de acreditación', a.numero]);
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
    // El día de la Ciudad de México, no los 10 primeros caracteres del texto: con una hora en UTC («…T01:30:00Z») esos
    // son el día siguiente (auditoría 2026-10-19, B8-02). APD.diaDe también acepta una fecha sola (AAAA-MM-DD).
    const delDia = APD.diaDe(s.estado_desde) === APD.hoy(datos);
    if (s.estado === 'aprobada') sigue = { texto: 'Aprobaste el examen.', pasos: [delDia ? 'Recoge tu credencial hoy mismo, en la oficina del Vivero, antes de irte.' : 'Recoge tu credencial en la oficina del Vivero.', 'Ahí te toman la fotografía que lleva tu credencial.', 'Al recibirla, firmas el comprobante de recepción.'] };
    if (s.estado === 'no_acreditada') sigue = 'No alcanzaste la calificación mínima. Para obtener la acreditación haces un trámite nuevo, con su pago.';
    if (s.estado === 'sin_derecho_examen') sigue = 'No alcanzaste la asistencia mínima. Para obtener la acreditación haces un trámite nuevo, con su pago.';
    // El motivo es un párrafo: va a todo el ancho, como aviso, después de los datos (auditoría 2026-10-17)
    // Cerrada sin atender (por inasistencia o por plazo), el motivo de la base ya lo dice el texto de arriba
    const motivo = s.motivo_cierre && s.estado !== 'concluida_sin_atender' ? el('div', { class: 'aviso' }, [el('div', { class: 'aviso-texto aviso-pila' }, [
      el('p', {}, [el('strong', { texto: s.estado === 'rechazada' ? 'Motivo del rechazo' : s.estado === 'cancelada' ? 'Motivo de la cancelación' : 'Motivo' })]),
      el('p', { texto: APD.paraTi(s.motivo_cierre) })])]) : null;

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
      : s.estado === 'validada_en_linea' && s.cotejo_pausa
        // Con lo que no coincidió ya cargado, la etiqueta no pide cargarlo otra vez
        ? (s.cotejo_pausa.docs.every((k) => datos.documento.some((d) => d.solicitud_id === s.id && d.vigente && d.requisito === k && APD.cargadoTras(d, s.cotejo_pausa)))
          ? estado('Cita en pausa: documento cargado', 'marcha') : estado('Cita en pausa: carga el documento', 'pend'))
      : s.estado === 'validada_en_linea' && s.cita_motivo ? estado('Acude a tu cita nueva', 'pend')
        : porInasistencia ? estado('Cerrada: no te presentaste', 'error')
          : s.estado === 'inscrita' && g && g.grupo && g.grupo.estado === 'en_integracion' ? estado('Grupo por confirmar', 'marcha')
          : APD.estadoSolicitud(s);
    return el('article', { class: 'ficha' }, [
      el('div', { class: 'ficha-cabeza' }, [
        el('h4', { class: 'ficha-titulo', texto: `${APD.TIPOS[s.tipo_acreditacion]} · ${APD.MODALIDADES[s.modalidad].toLowerCase()}` }),
        etiqueta
      ]),
      cita,
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
      ? acs.slice().sort((x, y) => Number(porRenovar(datos, y, op)) - Number(porRenovar(datos, x, op))).map((a) => fichaAcreditacion(datos, a, op))
      : [el('p', { class: 'vacio', texto: 'Todavía no tienes acreditaciones.' })]));

    // En curso: las que todavía avanzan, y la acreditada cuya credencial no se ha recogido (aún hay un paso).
    // Anteriores: las terminadas (cerradas, rechazadas, no acreditadas o con la credencial ya entregada).
    const sols = APD.solicitudesDe(datos, persona);
    const terminada = (s) => APD.FINALES.includes(s.estado)
      && !(s.estado === 'acreditada' && !((datos.acreditacion.find((a) => a.solicitud_id === s.id) || {}).entregada_en));
    const enCurso = sols.filter((s) => !terminada(s));
    const anteriores = sols.filter(terminada);
    // Una sola acción principal: iniciar una solicitud nueva, si hay algo que se pueda pedir como nueva
    const puedeNueva = ['poda', 'dictaminador'].some((t) => op[t].disponible && op[t].modalidad === 'nueva');
    // Un solo texto para «sin solicitudes en curso», con la guía de cómo empezar si se puede (D14)
    document.querySelector('[data-solicitudes]').replaceChildren(...(enCurso.length
      ? enCurso.map((s) => fichaSolicitud(datos, s, persona))
      : [el('p', { class: 'vacio', texto: `No tienes solicitudes en curso.${puedeNueva ? ' Para empezar, presiona «Iniciar una solicitud».' : ''}` })]));
    document.querySelector('[data-anteriores-seccion]').hidden = !anteriores.length;
    document.querySelector('[data-anteriores]').replaceChildren(...anteriores.map((s) => fichaSolicitud(datos, s, persona)));

    document.querySelector('[data-nueva]').hidden = !puedeNueva;
    document.querySelector('[data-cargando]').textContent = 'Aquí ves tus acreditaciones y en qué va cada solicitud.';
  }).catch(() => {
    document.querySelector('[data-cargando]').textContent = 'No se pudo cargar tu información. Intenta de nuevo más tarde.';
  });
}());
