/* =========================================================
   registro-asistido.js · Registro asistido: personas que no saben leer ni escribir (decisión de Liber del 25/10/2026)

   El personal de revisión y cotejo registra a la persona en el Vivero, con ella presente: su cuenta (asistido.html), su
   solicitud (solicitud.html?asistida=…) y su seguimiento en la ventanilla (ventanilla.html). Mientras la persona no
   activa su cuenta, cada cambio que a otra persona le llegaría por correo deja un aviso por teléfono pendiente
   (apd.aviso_telefono; catálogo de docs/AVISOS-POR-CORREO.md). Aquí está lo común:
     · los avisos por teléfono pendientes, con lo que se le dice a la persona (de tú, listo para decirlo) y su registro
       («se le avisó» o «no contestó»), para la lista del inicio del personal ([data-asistido-inicio], revision.html);
     · la etiqueta discreta «Registro asistido: avisar por teléfono, …» de «Revisar una solicitud» y «Cita de cotejo»
       ([data-asistido-etiqueta]);
     · en qué va un trámite y qué sigue, en lenguaje sencillo, para la ventanilla.

   Versión de prueba: los avisos vienen de la base (datos.aviso_telefono, en los ficticios) y, para lo hecho en este
   navegador, la página los deduce de cómo quedó cada solicitud, como los crearía la base (03b-apd-registro-asistido.sql).
   Lo que registra el personal se guarda en «apd.personal.avisos_telefono» (APD_ARCHIVOS_PRUEBA.CLAVES.avisosTelefono).
   En la etapa 3 los da la vista apd.avisos_telefono_pendientes y se registran con la API.
   ========================================================= */
(function (global) {
  'use strict';
  const { el } = APD;
  const A = global.APD_ARCHIVOS_PRUEBA;
  const CLAVE = A && A.CLAVES.avisosTelefono ? A.CLAVES.avisosTelefono : 'apd.personal.avisos_telefono';
  const quien = () => (global.APD_PERSONAL ? global.APD_PERSONAL.REVISORA : { usuario: 'revision.prueba', nombre: 'María Ejemplo Revisora' });

  /* ----- Lo registrado en esta prueba: { [id del aviso]: { resultado, por, en } } ----- */
  function marcas() {
    try { const v = JSON.parse(global.localStorage.getItem(CLAVE) || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch (e) { return {}; }
  }
  /* Registra el resultado una sola vez (la base: aviso_atendido). Devuelve 'ok', 'ya' (ya tenía resultado) o 'sin_guardar' */
  function registra(id, resultado) {
    const t = marcas();
    if (t[id]) return 'ya';
    t[id] = { resultado, por: quien().usuario, en: new Date().toISOString() };
    try { global.localStorage.setItem(CLAVE, JSON.stringify(t)); } catch (e) { return 'sin_guardar'; }
    if (A && A.avisaCambio) A.avisaCambio();
    return 'ok';
  }

  /* ----- Los avisos por teléfono ----- */
  const ms = (x) => new Date(x).getTime();
  const iguales = (a, b) => Math.abs(ms(a) - ms(b)) < 1000;
  /* El aviso que dejaría la base con la situación de ahora de una solicitud (lo hecho en este navegador). null si no toca. */
  function deduce(datos, s) {
    const base = { folio: s.folio, tipo_acreditacion: s.tipo_acreditacion, modalidad: s.modalidad };
    const citas = (datos.cita || []).filter((c) => c.solicitud_id === s.id);
    const cerradaAhi = (resultado) => citas.some((c) => c.resultado === resultado && c.atendida_en && iguales(c.atendida_en, s.estado_desde));
    switch (s.estado) {
      case 'con_observaciones':
        return cerradaAhi('con_observaciones') ? { aviso: 'T2', momento: s.estado_desde, datos: { ...base, resultado: 'con_observaciones' } }
          : { aviso: 'S2', momento: s.estado_desde, datos: base };
      case 'validada_en_linea': {
        if (s.cotejo_pausa) return { aviso: 'T2', momento: s.cotejo_pausa.desde, datos: { ...base, resultado: 'en_pausa', observacion: (citas.find((c) => c.resultado === 'en_pausa') || {}).observacion || '' } };
        if (s.cita_motivo) {
          const abierta = citas.filter((c) => c.resultado === 'pendiente').sort((a, b) => String(a.creada_en).localeCompare(String(b.creada_en))).pop();
          return abierta ? { aviso: 'T2', momento: abierta.creada_en, datos: { ...base, resultado: 'cita_nueva', cita_en: s.cita_en, motivo: s.cita_motivo === 'sin_pago' ? 'sin_pago' : 'no_se_presento' } } : null;
        }
        const c = APD.curso(datos, s.tipo_acreditacion, s.modalidad) || {};
        return { aviso: 'S5', momento: s.estado_desde, datos: { ...base, cita_en: s.cita_en, pago_monto: s.pago_monto != null ? s.pago_monto : c.pago_monto, pago_referencia: s.pago_referencia, pago_concepto: c.pago_concepto } };
      }
      case 'concluida_sin_atender':
        return APD.cerradaPorInasistencia(s) ? { aviso: 'T2', momento: s.estado_desde, datos: { ...base, resultado: 'cerrada' } } : { aviso: 'S4', momento: s.estado_desde, datos: base };
      case 'rechazada': return { aviso: 'S6', momento: s.estado_desde, datos: { ...base, motivo: s.motivo_cierre } };
      case 'lista_para_curso': {
        const baja = (datos.inscripcion || []).filter((i) => i.solicitud_id === s.id && !i.activa && i.baja_en).sort((a, b) => String(a.baja_en).localeCompare(String(b.baja_en))).pop();
        if (baja && ms(baja.baja_en) >= ms(s.estado_desde) - 1000) {
          const g = datos.grupo.find((x) => x.id === baja.grupo_id) || {};
          return { aviso: 'G2', momento: s.estado_desde, datos: { ...base, resultado: 'baja', grupo: g.folio, motivo: baja.motivo_baja } };
        }
        const p = datos.solicitante.find((x) => x.id === s.solicitante_id) || {};
        return { aviso: 'T2', momento: s.estado_desde, datos: { ...base, resultado: 'atendida', expediente: p.numero_expediente } };
      }
      case 'inscrita': {
        const i = (datos.inscripcion || []).find((x) => x.solicitud_id === s.id && x.activa);
        const g = i && datos.grupo.find((x) => x.id === i.grupo_id);
        if (!g || g.estado !== 'confirmado') return null;
        const momento = ms(g.estado_desde) > ms(s.estado_desde) ? g.estado_desde : s.estado_desde;
        return { aviso: 'G1', momento, datos: { ...base, grupo: g.folio, fecha_inicio: g.fecha_inicio, hora_entrada: APD.hhmm(g.hora_entrada) } };
      }
      case 'aprobada': case 'no_acreditada': case 'sin_derecho_examen': {
        const i = (datos.inscripcion || []).find((x) => x.solicitud_id === s.id && x.activa);
        const e = i && (datos.examen || []).find((x) => x.inscripcion_id === i.id);
        const c = APD.curso(datos, s.tipo_acreditacion, s.modalidad) || {};
        return { aviso: 'G4', momento: s.estado_desde, datos: { ...base, resultado: s.estado, calificacion: e ? e.calificacion : null, minima: c.calificacion_minima } };
      }
      default: return null;
    }
  }
  /* Todos los avisos (de la base y los de lo hecho en esta prueba), con lo registrado en esta prueba */
  function avisos(datos) {
    const persona = Object.fromEntries(datos.solicitante.map((p) => [p.id, p]));
    const lista = (datos.aviso_telefono || []).map((a) => Object.assign({}, a));
    for (const s of datos.solicitud) {
      const p = persona[s.solicitante_id];
      if (!APD.asistidaSinActivar(p)) continue;
      const d = deduce(datos, s);
      if (!d || !d.momento || ms(d.momento) < ms(p.registro_asistido_en)) continue;
      if (lista.some((a) => a.solicitud_id === s.id && a.aviso === d.aviso && iguales(a.creado_en, d.momento))) continue;
      lista.push({ id: `prueba-tel:${s.id}:${d.aviso}:${ms(d.momento)}`, solicitante_id: p.id, solicitud_id: s.id, aviso: d.aviso,
        datos: d.datos, creado_en: d.momento, resultado: null, de_prueba: true });
    }
    const m = marcas();
    return lista.map((a) => (!a.resultado && m[a.id] ? Object.assign({}, a, { resultado: m[a.id].resultado, atendido_por: m[a.id].por, atendido_en: m[a.id].en }) : a))
      .sort((a, b) => ms(a.creado_en) - ms(b.creado_en));
  }
  const pendientes = (datos) => avisos(datos).filter((a) => !a.resultado);

  /* ----- Lo que se le dice por teléfono, de tú (catálogo de docs/AVISOS-POR-CORREO.md) ----- */
  const TITULO = {
    S2: 'Solicitud con observaciones', S4: 'Cerrada por no corregir a tiempo', S5: 'Cita de cotejo', S6: 'Solicitud rechazada',
    T2: 'Resultado de la cita de cotejo', T3: 'Cuenta bloqueada por identidad', G1: 'Grupo asignado', G2: 'Cambio en su grupo',
    G4: 'Resultado del examen', A1: 'Acreditación entregada', A6: 'Acreditación cancelada', A7: 'Reposición de la credencial'
  };
  function lugar(datos) {
    const s = APD.sede(datos);
    const horario = APD.parametroTexto(datos, 'informes_horario') || 'de lunes a viernes, de 9:00 a 15:00';
    return `en la ventanilla del ${s.nombre}, ${horario}`;
  }
  const nombreDoc = (datos, k) => ((datos.requisito || []).find((r) => r.clave === k) || {}).nombre || k;
  function texto(datos, a) {
    const d = a.datos || {};
    const folio = d.folio ? `tu solicitud ${d.folio}` : 'tu trámite';
    const Folio = d.folio ? `Tu solicitud ${d.folio}` : 'Tu trámite';
    const cuando = (iso) => APD.fechaLarga(iso, { hora: true });
    switch (a.aviso) {
      case 'S2': {
        const docs = (datos.documento || []).filter((x) => x.solicitud_id === a.solicitud_id && x.vigente && x.estado === 'con_observacion').map((x) => nombreDoc(datos, x.requisito));
        return `A ${folio} le falta corregir algo${docs.length ? `: ${docs.join(', ')}` : ''}. Ven ${lugar(datos)}, para que te digamos qué falta y lo corrijamos contigo. Hay un plazo para corregir.`;
      }
      case 'S4': return `${Folio} se cerró porque las correcciones no se hicieron a tiempo. Si quieres, puedes iniciar una nueva ${lugar(datos)}.`;
      case 'S5': {
        const pago = d.pago_monto ? `el comprobante del pago de ${APD.moneda(d.pago_monto)} con la referencia ${d.pago_referencia}` : 'el comprobante de tu pago (el monto y la referencia te los damos en la ventanilla)';
        return `Tus documentos están completos. Tu cita de cotejo es el ${cuando(d.cita_en)}, en el ${APD.sede(datos).nombre}. Lleva los mismos documentos impresos, tu identificación oficial y ${pago}.`;
      }
      case 'S6': return `${Folio} no se aceptó: ${APD.paraTi(d.motivo) || 'tu perfil no cumple los requisitos'}. Si tienes dudas, ven ${lugar(datos)}.`;
      case 'T2':
        switch (d.resultado) {
          case 'atendida': return `Tu cotejo terminó${d.expediente ? `; tu expediente es el ${d.expediente}` : ''}. Sigue que la Secretaría te asigne un grupo del curso: te avisamos por teléfono las fechas.`;
          case 'en_pausa': return `En tu cita faltó un documento${d.observacion ? `: ${APD.paraTi(d.observacion)}` : ''}. Tráelo hoy mismo ${lugar(datos)} para terminar tu cotejo.`;
          case 'con_observaciones': return `En tu cita, un documento no coincidió con el que se cargó. Ven ${lugar(datos)} para corregirlo contigo.`;
          case 'cita_nueva': return `${d.motivo === 'sin_pago' ? 'Como no llevaste el comprobante de pago, te' : 'Como no llegaste a tu cita, te'} dimos una cita nueva: el ${cuando(d.cita_en)}, en el ${APD.sede(datos).nombre}.`;
          case 'cerrada': return `${Folio} se cerró porque no llegaste dos veces a tu cita de cotejo. Puedes iniciar una nueva ${lugar(datos)}.`;
          default: return `Hay un cambio en ${folio}. Ven ${lugar(datos)} para decírtelo.`;
        }
      case 'T3': return `Tu cuenta está bloqueada mientras la Secretaría aclara lo que pasó en tu cita de cotejo. Ven ${lugar(datos)} para aclararlo.`;
      case 'G1': return `Ya tienes grupo del curso: empieza el ${APD.fechaLarga(d.fecha_inicio)} a las ${d.hora_entrada || APD.parametroTexto(datos, 'curso_hora_entrada')}, en el ${APD.sede(datos).nombre}. Llega a tiempo todos los días del curso.`;
      case 'G2':
        if (d.resultado === 'baja') return `Ya no estás en el grupo ${d.grupo || ''}${d.motivo ? `: ${APD.paraTi(d.motivo)}` : ''}. Sigues en espera de un curso con tu misma antigüedad; te avisamos las fechas.`;
        if (d.resultado === 'por_confirmar') return 'Tu grupo todavía no se confirma: faltan personas. Te avisamos por teléfono cuando tenga fechas.';
        return `Tu curso cambió: ahora empieza el ${APD.fechaLarga(d.fecha_inicio)} a las ${d.hora_entrada}.`;
      case 'G4':
        if (d.resultado === 'aprobada') return `Aprobaste el examen${d.calificacion != null ? ` con ${d.calificacion}` : ''}. Recoge tu credencial en el ${APD.sede(datos).nombre}.`;
        if (d.resultado === 'no_acreditada') return `No alcanzaste la calificación mínima${d.minima != null ? ` de ${d.minima}` : ''}${d.calificacion != null ? `: sacaste ${d.calificacion}` : ''}. Puedes iniciar una solicitud nueva ${lugar(datos)}.`;
        return `No alcanzaste la asistencia mínima del curso, así que no tuviste derecho a examen. Puedes iniciar una solicitud nueva ${lugar(datos)}.`;
      case 'A1': return `Se te entregó tu acreditación ${d.numero}, vigente hasta el ${APD.fechaLarga(d.vence_en)}.`;
      case 'A6': return `La Secretaría canceló tu acreditación ${d.numero}${d.motivo ? `: ${APD.paraTi(d.motivo)}` : ''}. Ya no puedes trabajar con ella. Ven ${lugar(datos)} si tienes dudas.`;
      case 'A7': return d.resultado === 'con_observaciones' ? `Tu acta para reponer la credencial ${d.numero} tiene observaciones. Ven ${lugar(datos)} para corregirla.`
        : d.resultado === 'acta_aceptada' ? `Se aceptó tu acta: paga la cuota y recoge tu credencial ${d.numero} en el ${APD.sede(datos).nombre}.`
          : `Tu credencial ${d.numero} ya se repuso, con el mismo número y la misma vigencia.`;
      default: return `Hay un cambio en ${folio}. Ven ${lugar(datos)} para decírtelo.`;
    }
  }

  /* ----- Lista del inicio del personal ----- */
  function tarjeta(datos, a, alRegistrar) {
    const p = datos.solicitante.find((x) => x.id === a.solicitante_id) || {};
    const s = a.solicitud_id ? datos.solicitud.find((x) => x.id === a.solicitud_id) : null;
    const nombre = APD.nombreCompleto(p);
    const boton = (etq, resultado) => {
      const b = el('button', { type: 'button', class: resultado === 'se_le_aviso' ? 'btn btn-primario' : 'btn btn-secundario' },
        [document.createTextNode(etq), el('span', { class: 'solo-lector', texto: `: ${nombre}, ${TITULO[a.aviso] || a.aviso}` })]);
      b.addEventListener('click', () => alRegistrar(a, resultado, nombre));
      return b;
    };
    return el('li', { class: 'ficha', 'data-aviso': a.id }, [
      el('div', { class: 'ficha-cabeza' }, [
        el('h4', { class: 'ficha-titulo', texto: nombre }),
        el('a', { class: 'btn-enlace', href: `tel:${p.telefono}` }, [document.createTextNode(APD.telefonoTexto(p.telefono)), el('span', { class: 'solo-lector', texto: `: llamar a ${nombre}` })])
      ]),
      APD.lineaDatos([TITULO[a.aviso] || a.aviso, s ? `Solicitud ${s.folio}` : null, `Desde el ${APD.fechaCorta(a.creado_en, { hora: true })}`]),
      el('p', { class: 'ficha-sigue' }, [el('strong', { texto: 'Qué decirle: ' }), document.createTextNode(`Hola, te llamamos de la Secretaría del Medio Ambiente. ${texto(datos, a)}`)]),
      el('div', { class: 'ficha-acciones' }, [boton('Se le avisó', 'se_le_aviso'), boton('No contestó', 'no_contesto')])
    ]);
  }
  function pintaInicio(caja) {
    const lista = caja.querySelector('[data-avisos-lista]');
    const cuenta = caja.querySelector('[data-avisos-cuenta]');
    const resultado = caja.querySelector('[data-avisos-resultado]');
    function pinta(datos) {
      const pend = pendientes(datos);
      APD.escribe(cuenta, pend.length ? `${APD.plural(pend.length, 'aviso pendiente', 'avisos pendientes')}, del más antiguo al más reciente.` : 'No hay avisos por teléfono pendientes.');
      lista.replaceChildren(...pend.map((a) => tarjeta(datos, a, registrar)));
      lista.hidden = !pend.length;
    }
    function registrar(a, res, nombre) {
      // Se vuelve a leer antes de guardar: si otra pestaña ya lo registró, se dice (la base: aviso_atendido)
      APD.cargar().then((datos) => {
        const actual = avisos(datos).find((x) => x.id === a.id);
        const r = !actual || actual.resultado ? 'ya' : registra(a.id, res);
        const sigue = () => {
          const h = lista.querySelector('.ficha-titulo') || caja.querySelector('#t-avisos-tel');
          if (h) { h.tabIndex = -1; h.focus(); }
        };
        if (r === 'sin_guardar') { APD.pintaAviso(resultado, 'error', 'No se registró', APD.textoNoGuardo('el aviso', 'usted'), true); return; }
        return APD.cargar().then((d2) => {
          pinta(d2);
          if (r === 'ya') APD.pintaAviso(resultado, 'info', 'Ya estaba registrado', `Otra persona del personal ya registró el aviso de ${nombre}.`);
          else APD.pintaAviso(resultado, 'ok', res === 'se_le_aviso' ? 'Se registró que se le avisó' : 'Se registró que no contestó',
            res === 'se_le_aviso' ? `${nombre}: aviso hecho.` : `${nombre} no contestó. Lo que se le iba a decir se le dice cuando vaya a la ventanilla.`);
          sigue();
        });
      });
    }
    APD.cargar().then(pinta).catch(() => APD.escribe(cuenta, 'No se pudieron cargar los avisos. Recargue la página.'));
    if (A && A.alCambiar) A.alCambiar(() => APD.cargar().then(pinta));
  }

  /* ----- Etiqueta en «Revisar una solicitud» y «Cita de cotejo» ----- */
  function pintaEtiqueta(caja) {
    const folio = new URLSearchParams(global.location.search).get('folio');
    APD.cargar().then((datos) => {
      const s = datos.solicitud.find((x) => x.folio === folio);
      const p = s && datos.solicitante.find((x) => x.id === s.solicitante_id);
      if (!APD.asistidaSinActivar(p)) return;
      caja.replaceChildren(APD.estado(`Registro asistido: avisar por teléfono, ${APD.telefonoTexto(p.telefono)}`, 'marcha'));
      caja.hidden = false;
    }).catch(() => {});
  }

  /* ----- Ventanilla: en qué va el trámite y qué sigue, en lenguaje sencillo (de tú, para decírselo) ----- */
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
      case 'borrador': return ['Tu solicitud todavía no se envía: falta terminar de capturarla contigo.'];
      case 'enviada': return ['La Secretaría está revisando tus documentos.', 'Si falta algo, te avisamos por teléfono y lo corregimos aquí contigo; si todo está bien, te damos una cita de cotejo.'];
      case 'con_observaciones': return [`A tu solicitud le falta corregir ${obs.length === 1 ? 'un documento' : 'algunos documentos'}:`,
        ...obs.map((x) => APD.observacionDe(nombreDoc(datos, x.requisito), APD.paraTi(x.observacion))), 'Lo corregimos aquí contigo. Hay un plazo para corregir.'];
      case 'validada_en_linea': {
        if (s.cotejo_pausa) return [`Tu cita está en pausa: trae hoy el documento que faltó (${(s.cotejo_pausa.docs || []).map((k) => nombreDoc(datos, k)).join(', ')}).`];
        const c = APD.curso(datos, s.tipo_acreditacion, s.modalidad) || {};
        const monto = s.pago_monto != null ? s.pago_monto : c.pago_monto;
        return [`Tu cita de cotejo es el ${APD.fechaLarga(s.cita_en, { hora: true })}, en el ${sede}.`,
          'Trae los mismos documentos impresos y tu identificación oficial.',
          monto ? `Paga ${APD.moneda(monto)} con la referencia ${s.pago_referencia} y trae tu comprobante.` : 'Trae el comprobante de tu pago.'];
      }
      case 'inscrita': {
        const i = (datos.inscripcion || []).find((x) => x.solicitud_id === s.id && x.activa);
        const g = i && datos.grupo.find((x) => x.id === i.grupo_id);
        if (g && g.fecha_inicio && g.estado !== 'en_integracion') return [`Tu curso empieza el ${APD.fechaLarga(g.fecha_inicio)} a las ${APD.hhmm(g.hora_entrada)}, en el ${sede}.`, 'Llega a tiempo todos los días del curso.'];
        return ['Ya tienes grupo del curso; falta confirmar las fechas. Te avisamos por teléfono.'];
      }
      case 'lista_para_curso': return ['Tu cotejo terminó. Estás en espera de un grupo del curso: te avisamos por teléfono las fechas.'];
      case 'rechazada': return [`Tu solicitud no se aceptó: ${APD.paraTi(s.motivo_cierre)}.`, ...plano(e.sigue).slice(1)];
      default: return plano(e.sigue);
    }
  }

  /* La persona del registro asistido cuya solicitud captura el personal (solicitud.html?asistida=…) */
  const personaAsistida = (datos, id) => datos.solicitante.find((x) => x.id === id && APD.esAsistida(x) && x.estado === 'activa') || null;

  global.APD_ASISTIDO = { avisos, pendientes, texto, TITULO, registra, marcas, queDecir, personaAsistida, lugar };

  // Arranque en las páginas que lo piden
  const inicio = global.document.querySelector('[data-asistido-inicio]');
  if (inicio) pintaInicio(inicio);
  const etiqueta = global.document.querySelector('[data-asistido-etiqueta]');
  if (etiqueta) pintaEtiqueta(etiqueta);
}(window));
