/* ventanilla.js · «Consultar un trámite» del personal de revisión y cotejo (sin registro asistido, decisión de Liber del
   26/10/2026)

   Busca a una persona por CURP, nombre, folio de solicitud o número de expediente, y muestra en qué va cada trámite y qué
   sigue, en lenguaje sencillo y de tú, para decírselo a la persona cuando pregunta en el Vivero o por otro medio (con los
   estados de «Mis trámites», APD.ESTADOS). Es sólo una consulta: el personal no carga nada por la persona; ella corrige y
   envía en línea, con su propia cuenta. Era la ventanilla del registro asistido (25/10/2026), sin las cuentas asistidas,
   los avisos por teléfono ni la captura por el personal. ?buscar=… abre con la búsqueda hecha; ?persona=<id>, con la
   ficha de esa persona. Lee los datos ficticios; en la etapa 3 los da la API del personal. */
(function () {
  'use strict';
  const { el } = APD;
  const $ = (s) => document.querySelector(s);
  const form = document.getElementById('buscar-persona');
  form.addEventListener('submit', (e) => { e.preventDefault(); e.stopImmediatePropagation(); }, true);
  FormKit.iniciar(form, {});
  const entrada = document.getElementById('buscar');
  const norm = APD.normalizaBusqueda;

  function coincide(datos, p, q) {
    if (!q) return false;
    const folios = datos.solicitud.filter((s) => s.solicitante_id === p.id).map((s) => s.folio);
    const campos = [APD.nombreCompleto(p), p.curp, p.numero_expediente, ...folios].map(norm);
    return campos.some((c) => c && c.includes(q));
  }
  function buscar(datos) {
    const q = norm(entrada.value);
    const lista = $('[data-resultados]');
    if (q.length < 3) { APD.escribe($('[data-cuenta]'), 'Escriba al menos 3 caracteres para buscar.'); lista.hidden = true; lista.replaceChildren(); return []; }
    const halladas = datos.solicitante.filter((p) => coincide(datos, p, q)).slice(0, 10);
    APD.escribe($('[data-cuenta]'), halladas.length ? `${APD.plural(halladas.length, 'persona encontrada', 'personas encontradas')}.` : 'Nadie coincide con la búsqueda. Revise lo que escribió.');
    lista.replaceChildren(...halladas.map((p) => {
      const b = el('button', { type: 'button', class: 'btn btn-secundario' }, [document.createTextNode('Ver su trámite'), el('span', { class: 'solo-lector', texto: `: ${APD.nombreCompleto(p)}` })]);
      b.addEventListener('click', () => ficha(datos, p, true));
      return el('li', { class: 'ficha' }, [
        el('div', { class: 'ficha-cabeza' }, [el('h3', { class: 'ficha-titulo', texto: APD.nombreCompleto(p) }), cuentaDe(p)]),
        APD.lineaDatos([p.curp, p.telefono ? `Teléfono ${APD.telefonoTexto(p.telefono)}` : null]),
        el('div', { class: 'ficha-acciones' }, [b])
      ]);
    }));
    lista.hidden = !halladas.length;
    return halladas;
  }
  /* Qué cuenta tiene: en línea, bloqueada o del registro anterior sin activar */
  function cuentaDe(p) {
    if (p.estado === 'sin_activar') return APD.estado('Registro anterior · sin cuenta en línea', 'cerrado');
    if (p.estado === 'bloqueada') return APD.estado('Cuenta bloqueada', 'error');
    return APD.estado('Cuenta en línea', 'ok');
  }

  /* ----- En qué va el trámite y qué sigue, en lenguaje sencillo (de tú, para decírselo a la persona) ----- */
  const nombreDoc = (datos, k) => ((datos.requisito || []).find((r) => r.clave === k) || {}).nombre || k;
  /* Cuánto dura el curso y qué es el último día (ajustes del equipo, 25/10/2026: duración y quinto día), como «Mis trámites» */
  function duracion(datos, s) {
    const c = APD.curso(datos, s.tipo_acreditacion, s.modalidad);
    if (!c) return '';
    return c.dias_duracion > 1 ? ` Son ${c.dias_duracion} días, de lunes a viernes; el día ${c.dias_duracion} es de ${APD.diaFinal(c).toLowerCase()}.`
      : ' Es un solo día y ese mismo día presentas el examen.';
  }
  function plano(x) {
    if (!x) return [];
    if (typeof x === 'string') return [x];
    const o = Array.isArray(x) ? { pasos: x } : x;
    return [o.texto, ...(o.pasos || [])].filter(Boolean);
  }
  function queDecir(datos, s) {
    const e = APD.ESTADOS[s.estado] || {};
    const sede = APD.sede(datos).nombre;
    const obs = (datos.documento || []).filter((x) => x.solicitud_id === s.id && x.vigente && x.estado === 'con_observacion');
    switch (s.estado) {
      case 'borrador': return ['Tu solicitud todavía no se envía: termina de cargar tus documentos y envíala desde «Mis trámites».'];
      case 'enviada': return ['La Secretaría está revisando tus documentos.', 'Si falta algo, te avisamos por correo y lo ves en «Mis trámites»; si todo está completo, te damos una cita de cotejo.'];
      case 'con_observaciones': return [`A tu solicitud le falta corregir ${obs.length === 1 ? 'un documento' : 'algunos documentos'}:`,
        ...obs.map((x) => APD.observacionDe(nombreDoc(datos, x.requisito), APD.paraTi(x.observacion))),
        'Corrígelos en línea, en «Mis trámites», y vuelve a enviar tu solicitud. Hay un plazo para corregir.',
        // Cuántas oportunidades le quedan, o que es la última (ajustes del equipo, 25/10/2026)
        ...(() => { const op = APD.oportunidades(datos, s); return op ? [op.detalle ? `${op.texto} ${op.detalle}` : op.texto] : []; })()];
      case 'concluida_sin_atender':
        if (APD.cerradaSinOportunidades(s)) return ['Tu solicitud se cerró porque, después de tu última oportunidad para corregir, tus documentos siguieron con observaciones.', 'No pagaste nada y puedes iniciar una solicitud nueva en línea.'];
        return plano(e.sigue);
      case 'validada_en_linea': {
        if (s.cotejo_pausa) return [`Tu cita está en pausa: carga hoy en «Mis trámites» el documento que no coincidió (${(s.cotejo_pausa.docs || []).map((k) => nombreDoc(datos, k)).join(', ')}).`];
        const c = APD.curso(datos, s.tipo_acreditacion, s.modalidad) || {};
        const monto = s.pago_monto != null ? s.pago_monto : c.pago_monto;
        return [`Tu cita de cotejo es el ${APD.fechaLarga(s.cita_en, { hora: true })}, en el ${sede}.`,
          'Trae los mismos documentos impresos y tu identificación oficial.',
          monto ? `Paga ${APD.moneda(monto)} con la referencia ${s.pago_referencia} y trae tu comprobante.` : 'Trae el comprobante de tu pago.'];
      }
      case 'inscrita': {
        const i = (datos.inscripcion || []).find((x) => x.solicitud_id === s.id && x.activa);
        const g = i && datos.grupo.find((x) => x.id === i.grupo_id);
        if (g && g.fecha_inicio && g.estado !== 'en_integracion') return [`Tu curso empieza el ${APD.fechaLarga(g.fecha_inicio)} a las ${APD.hhmm(g.hora_entrada)}, en el ${sede}.${duracion(datos, s)}`, 'Llega a tiempo todos los días del curso.'];
        return ['Ya tienes grupo del curso; falta confirmar las fechas. Te avisamos por correo y lo ves en «Mis trámites».'];
      }
      case 'lista_para_curso': return ['Tu cotejo terminó. Estás en espera de un grupo del curso: te avisamos las fechas por correo y en «Mis trámites».'];
      case 'rechazada': return [`Tu solicitud no se aceptó: ${APD.paraTi(s.motivo_cierre)}.`, ...plano(e.sigue).slice(1)];
      default: return plano(e.sigue);
    }
  }

  function tramite(datos, s) {
    return el('article', { class: 'ficha' }, [
      el('div', { class: 'ficha-cabeza' }, [el('h3', { class: 'ficha-titulo', texto: APD.TIPOS[s.tipo_acreditacion] || s.tipo_acreditacion }), APD.estadoSolicitud(s, true)]),
      APD.lineaDatos([s.folio, APD.MODALIDADES[s.modalidad], s.enviada_en ? `Enviada el ${APD.fechaCorta(s.enviada_en)}` : 'Sin enviar']),
      el('div', { class: 'ficha-sigue' }, [el('p', {}, [el('strong', { texto: 'Qué decirle:' })]), ...queDecir(datos, s).map((t) => el('p', { texto: t }))])
    ]);
  }
  function ficha(datos, p, enfoca) {
    const caja = $('[data-ficha]');
    $('[data-ficha-nombre]').textContent = APD.nombreCompleto(p);
    $('[data-ficha-datos]').replaceChildren(el('p', {}, [cuentaDe(p)]), APD.datosLista([
      ['CURP', p.curp], ['Teléfono', APD.telefonoTexto(p.telefono)], ['Correo electrónico', p.correo || ''],
      ['Expediente', p.numero_expediente || '']
    ]));
    const sols = APD.solicitudesDe(datos, p);
    $('[data-ficha-tramites]').replaceChildren(...(sols.length ? sols.map((s) => tramite(datos, s)) : [el('p', { class: 'vacio', texto: 'No tiene solicitudes.' })]));
    caja.hidden = false;
    if (enfoca) $('[data-ficha-nombre]').focus();
  }

  APD.cargar().then((datos) => {
    APD_PERSONAL.pintaSesion($('[data-sesion-personal]'), 'ventanilla');
    const u = new URLSearchParams(location.search);
    if (u.get('buscar')) { entrada.value = u.get('buscar'); APD.avisa(entrada); }
    let ultimos = buscar(datos);
    const porId = u.get('persona') && datos.solicitante.find((p) => p.id === u.get('persona'));
    if (porId) ficha(datos, porId, false);
    else if (ultimos.length === 1 && u.get('buscar')) ficha(datos, ultimos[0], false);
    let t = 0;
    entrada.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => APD.cargar().then((d) => { ultimos = buscar(d); }), 150); });
  }).catch(() => APD.escribe($('[data-cuenta]'), 'No se pudo cargar la información. Recargue la página.'));
}());
