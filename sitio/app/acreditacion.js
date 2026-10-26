/* acreditacion.js · Ficha de una acreditación (personal; sesión de trabajo del 23/10/2026). ?numero=PD-…
   Su situación y su titular; «Cancelar acreditación» (P120) para los instructores y la Dirección (perfiles del parámetro
   perfiles_cancelan_acreditacion, P27), con motivo y fundamento en un diálogo de confirmación; y la reposición de su
   credencial (P140): revisar el acta y, con el acta aceptada, entregar la credencial repuesta con la factura de la cuota.
   La base vuelve a aplicar todo (apd.acreditacion_cambio, apd.acreditacion_cancelada, apd.reposicion_cambio); en la prueba,
   app/archivos-prueba.js (aplicaAcreditaciones). El perfil de la prueba llega en ?perfil= (lo pone el menú de pruebas). */
(function () {
  'use strict';
  const { el, estado, fechaCorta } = APD;
  const P = APD_PERSONAL;
  const $ = (s, r) => (r || document).querySelector(s);
  const params = new URLSearchParams(location.search);
  const numero = params.get('numero') || '';
  const perfil = P.perfilDePrueba();
  const quien = P.quienEs(perfil);
  const conPerfil = perfil !== 'revision_cotejo' ? `&perfil=${perfil}` : '';
  const aqui = (hecho) => `acreditacion.html?numero=${encodeURIComponent(numero)}${conPerfil}${hecho ? `&hecho=${hecho}` : ''}`;
  const MOTIVO = { perdida: 'Pérdida', robo: 'Robo' };
  const ORIGEN = { sistema: 'Emitida en este sistema', kobo: 'Registro anterior de la Secretaría (Kobo)', papel: 'Registro anterior de la Secretaría (papel)' };

  /* Aviso de lo que se acaba de hacer (llega en la dirección tras guardar aquí) */
  function avisoHecho() {
    const textos = {
      cancelada: ['info', 'Acreditación cancelada', '«Verificar» ya la muestra como «Cancelada», sin el motivo. La persona la ve cancelada en «Mis trámites», con el motivo y el fundamento.'],
      acta_aceptada: ['ok', 'Acta aceptada', 'La persona ve en «Mis trámites» cuánto pagar y dónde recoger su credencial.'],
      con_observaciones: ['ok', 'Observaciones del acta registradas', 'La persona ve en «Mis trámites» qué corregir y carga el acta corregida.'],
      repuesta: ['ok', 'Credencial repuesta', 'Se registró la entrega con la factura de la cuota. La acreditación conserva su número y su vigencia.']
    };
    const t = textos[params.get('hecho')];
    if (!t) return;
    APD.pintaAviso($('[data-hecho]'), t[0], t[1], t[2], true);
    params.delete('hecho');
    history.replaceState(null, '', `${location.pathname}?${params.toString()}`);
  }
  /* Un cambio que la base no aplicó (bloque 2): el aviso del formulario lo dice, con el enlace para ver la ficha como está */
  const noSeHizo = (titulo, motivo) => APD.rechazo(titulo, `${motivo.charAt(0).toLocaleUpperCase('es-MX')}${motivo.slice(1)}. Lo que escribió sigue aquí.`,
    { href: aqui(), texto: 'Ver la acreditación como está ahora' }, 'conflicto');
  const noGuardo = (titulo) => APD.noGuardo(titulo, 'el registro de prueba', 'usted');
  /* Guarda un evento, comprueba después que la base lo aplicó y, si no, lo retira y lo dice (nunca un éxito falso) */
  function guarda(evento, aplicado, titulo) {
    const A = typeof APD_ARCHIVOS_PRUEBA !== 'undefined' ? APD_ARCHIVOS_PRUEBA : null;
    const ev = A && A.guardaEventoAcreditacion(Object.assign({ numero, por: quien.usuario, perfil }, evento));
    if (!ev) return Promise.reject(noGuardo(titulo));
    return APD.cargar().then((d2) => {
      const motivo = aplicado(d2);
      if (!motivo) return d2;
      A.retiraEventoAcreditacion(ev.en);
      return Promise.reject(noSeHizo(titulo, motivo));
    });
  }
  const deAhora = (d) => d.acreditacion.find((x) => x.numero === numero);
  const vigente = (d, a) => ['vigente', 'por_vencer'].includes(APD.situacion(d, a));

  APD.cargar().then((datos) => {
    P.pintaSesion($('[data-sesion-personal]'), 'acreditaciones', perfil);
    $('[data-volver]').href = `acreditaciones.html${perfil !== 'revision_cotejo' ? `?perfil=${perfil}` : ''}`;
    const a = deAhora(datos);
    if (!a) { $('[data-bajada]').textContent = `No se encontró la acreditación ${numero}. Vuelva a «Acreditaciones».`; return; }
    avisoHecho();
    const p = datos.solicitante.find((x) => x.id === a.solicitante_id) || {};
    const sit = APD.situacion(datos, a);
    document.title = `${a.numero} · Personal · Acreditaciones de arbolado urbano`;
    $('#t-acreditacion').textContent = `Acreditación ${a.numero}`;
    $('[data-bajada]').replaceChildren(APD.lineaDatos([APD.TIPOS[a.tipo_acreditacion], APD.nombreCompleto(p)]));
    const v = APD.vigencia(sit, { personal: true });
    $('[data-situacion]').replaceChildren(estado(v.texto, v.tono));
    $('[data-datos]').replaceChildren(APD.datosLista([
      ['Titular', APD.nombreCompleto(p)],
      ['CURP', p.curp || ''],
      ['Acreditación', APD.TIPOS[a.tipo_acreditacion]],
      ['Número de acreditación', a.numero],
      ['Emitida el', fechaCorta(a.emitida_en)],
      ['Vence el', fechaCorta(a.vence_en)],
      ['Origen', ORIGEN[a.origen] || a.origen],
      ['Credencial entregada el', a.origen === 'sistema' ? (a.entregada_en ? fechaCorta(a.entregada_en) : 'Todavía no se entrega') : '']
    ]));

    /* Cancelada: cuándo, quién, el motivo y el fundamento */
    if (a.cancelada_en) {
      $('[data-cancelacion]').replaceChildren(el('h3', { class: 'titulo-bloque', texto: 'Cancelación' }), APD.datosLista([
        ['Cancelada el', fechaCorta(a.cancelada_en, { hora: true })],
        ['Canceló', P.nombreDeCuenta(a.cancelada_por)],
        ['Motivo', a.cancelacion_motivo],
        ['Fundamento', a.cancelacion_fundamento]
      ]));
    }

    /* Cancelar (P120): sólo de una vigente, sólo instructores y directivos (perfiles_cancelan_acreditacion; P201) */
    const acciones = [];
    let cancelar = null;
    const abierta = APD.reposicionAbierta(datos, a);
    const renovacion = datos.solicitud.find((s) => s.acreditacion_anterior_id === a.id && s.modalidad === 'renovacion'
      && ['borrador', 'enviada', 'con_observaciones', 'validada_en_linea', 'lista_para_curso', 'inscrita'].includes(s.estado));
    if (!a.cancelada_en && vigente(datos, a)) {
      if (APD.perfilesCancelan(datos).includes(perfil)) {
        cancelar = el('button', { type: 'button', class: 'btn btn-peligro-contorno', texto: 'Cancelar acreditación' });
        cancelar.addEventListener('click', () => {
          $('[data-cancelar-titulo]').textContent = `¿Cancelar la acreditación ${a.numero} de ${APD.nombreCompleto(p)}?`;
          $('[data-cancelar-de]').replaceChildren(...['Deja de estar vigente hoy: con ella ya no se puede trabajar en el arbolado urbano.',
            '«Verificar» la muestra como «Cancelada», sin el motivo.',
            'La persona la ve cancelada en «Mis trámites», con el motivo y el fundamento, y ya no puede renovarla.',
            renovacion ? `Su renovación en trámite (folio ${renovacion.folio}) se cancela.` : '',
            abierta ? 'La reposición de su credencial que está en trámite se cancela.' : ''].filter(Boolean).map((t) => el('li', { texto: t })));
          $('#dlg-cancelar').showModal();
        });
        acciones.push(cancelar);
      } else {
        acciones.push(el('p', { class: 'texto-gris', texto: 'Sólo los instructores y los directivos pueden cancelar una acreditación.' }));
      }
    }
    $('[data-acciones]').replaceChildren(...acciones);
    $('[data-acciones]').hidden = !acciones.length;

    /* Dialogo de cancelación: formulario del estándar con motivo y fundamento; el foco inicial va al motivo (primer control
       del diálogo, como en los de baja y cancelación de un grupo: excepción del 20/10/2026) */
    const formC = $('#cancelar');
    const dlg = $('#dlg-cancelar');
    const instC = FormKit.iniciar(formC, {
      enviar(payload) {
        return APD.cargar().then((d1) => {
          const a1 = deAhora(d1);
          if (!a1 || a1.cancelada_en) return Promise.reject(noSeHizo('No se canceló la acreditación', 'ya estaba cancelada'));
          if (!vigente(d1, a1)) return Promise.reject(noSeHizo('No se canceló la acreditación', 'ya no está vigente'));
          return guarda({ tipo: 'cancelar', motivo: payload.datos.motivo, fundamento: payload.datos.fundamento },
            (d2) => (APD.situacion(d2, deAhora(d2)) === 'cancelada' ? null : 'la base no la canceló'), 'No se canceló la acreditación');
        });
      },
      alEnviar() { location.href = aqui('cancelada'); },
      alFallar(err) { if (APD.muestraRechazo(err, formC)) return; const t = $('[data-estado-envio] .aviso-texto', formC); if (err && err.mensaje && t) t.textContent = err.mensaje; }
    });
    dlg.addEventListener('close', () => { formC.reset(); instC.ctx.limpia('motivo'); instC.ctx.limpia('fundamento'); if (cancelar && cancelar.isConnected) cancelar.focus(); });

    /* Reposición de la credencial (P140): la abierta o, si no hay, la última */
    const r = abierta || APD.reposicionesDe(datos, a)[0];
    if (!r) return;
    $('[data-reposicion]').hidden = false;
    $('[data-reposicion-situacion]').replaceChildren(APD.estadoReposicion(r, true));
    const verActa = el('a', { class: 'btn-enlace', href: 'datos/documentos/acta_reposicion.pdf', target: '_blank', rel: 'noopener', 'data-ver-acta': '' }, [
      document.createTextNode('Ver el acta'), el('span', { class: 'solo-lector', texto: ` ${FormKit.config.mensajes.enlaceNuevaPestana}` }), APD.icono('externo', 'icono icono-sm')]);
    const A = typeof APD_ARCHIVOS_PRUEBA !== 'undefined' ? APD_ARCHIVOS_PRUEBA : null;
    // El acta cargada en este navegador se abre de aquí; la de los ficticios es un PDF ficticio, el mismo para todas
    if (A && r.acta_en) {
      A.documentos(`reposicion:${a.numero}`).then((docs) => {
        const doc = docs.find((x) => x.cargado_en === r.acta_en && x.blob);
        if (doc) verActa.href = URL.createObjectURL(doc.blob);
      });
    }
    $('[data-reposicion-datos]').replaceChildren(APD.datosLista([
      ['Pedida el', fechaCorta(r.solicitada_en, { hora: true })],
      ['Motivo', MOTIVO[r.motivo] || r.motivo],
      ['Acta', r.acta_nombre_archivo || r.acta_nombre_original || 'Acta'],
      ['Observaciones del acta', r.estado === 'con_observaciones' ? r.observacion : ''],
      ['Acta revisada el', r.revisada_en ? fechaCorta(r.revisada_en, { hora: true }) : ''],
      ['Cuota de reposición indicada', r.pago_monto != null ? APD.moneda(r.pago_monto) : r.estado === 'acta_aceptada' ? 'Sin monto vigente' : ''],
      ['Credencial repuesta el', r.repuesta_en ? fechaCorta(r.repuesta_en) : ''],
      ['Factura', r.estado === 'repuesta' ? `${r.factura_rfc} · ${r.factura_razon_social} · ${r.factura_folio_fiscal}` : ''],
      ['Cancelada', r.estado === 'cancelada' ? r.observacion : '']
    ]), el('p', {}, [verActa]),
    el('p', { class: 'ayuda', texto: r.acta_en ? 'Versión de prueba: el acta cargada en este navegador.' : 'Versión de prueba: acta ficticia, la misma para todas las reposiciones.' }),
    r.estado === 'con_observaciones' ? el('p', { class: 'texto-gris', texto: 'Esperando el acta corregida de la persona.' }) : '');

    /* Revisar el acta */
    const formA = $('#acta');
    // El directivo sólo consulta la reposición: no revisa el acta ni entrega (P201)
    if (r.estado === 'solicitada' && vigente(datos, a) && !P.soloConsultaReposicion(perfil)) {
      formA.hidden = false;
      FormKit.iniciar(formA, {
        enviar(payload) {
          const decision = payload.datos.decision;
          return APD.cargar().then((d1) => {
            const r1 = APD.reposicionAbierta(d1, deAhora(d1));
            if (!r1 || r1.estado !== 'solicitada') return Promise.reject(noSeHizo('No se registró la revisión del acta', 'el acta ya se revisó o la reposición cambió'));
            return guarda({ tipo: 'acta', resultado: decision, observacion: payload.datos.observacion || '' },
              (d2) => { const r2 = APD.reposicionAbierta(d2, deAhora(d2)); return r2 && r2.estado === decision ? null : 'la base no la registró'; }, 'No se registró la revisión del acta');
          }).then(() => decision);
        },
        alEnviar(decision) { location.href = aqui(decision); },
        alFallar(err) { if (APD.muestraRechazo(err, formA)) return; const t = $('[data-estado-envio] .aviso-texto', formA); if (err && err.mensaje && t) t.textContent = err.mensaje; }
      });
    }

    /* Entregar la credencial repuesta, con la factura de la cuota */
    const formE = $('#entrega');
    if (r.estado === 'acta_aceptada' && vigente(datos, a) && !P.soloConsultaReposicion(perfil)) {
      formE.hidden = false;
      FormKit.iniciar(formE, {
        enviar(payload) {
          const f = payload.datos;
          const folio = String(f.factura_folio_fiscal || '').trim().toUpperCase();
          return APD.cargar().then((d1) => {
            const r1 = APD.reposicionAbierta(d1, deAhora(d1));
            if (!r1 || r1.estado !== 'acta_aceptada') return Promise.reject(noSeHizo('No se registró la entrega', 'la reposición cambió'));
            // Un folio fiscal no se repite, tampoco con el de una solicitud (la base: folio_fiscal_repetido)
            if (d1.solicitud.some((s) => s.factura_folio_fiscal === folio) || (d1.reposicion || []).some((x) => x.factura_folio_fiscal === folio)) {
              return Promise.reject({ errores: [{ campo: 'factura_folio_fiscal', mensaje: 'Ese folio fiscal ya está registrado: revise la factura.' }] });
            }
            return guarda({ tipo: 'repuesta', factura_rfc: f.factura_rfc, factura_razon_social: f.factura_razon_social, factura_folio_fiscal: folio },
              (d2) => (APD.reposicionesDe(d2, deAhora(d2))[0].estado === 'repuesta' ? null : 'la base no la registró'), 'No se registró la entrega');
          });
        },
        alEnviar() { location.href = aqui('repuesta'); },
        alFallar(err) { if (APD.muestraRechazo(err, formE)) return; const t = $('[data-estado-envio] .aviso-texto', formE); if (err && err.mensaje && t) t.textContent = err.mensaje; }
      });
    }
  }).catch(() => { $('[data-bajada]').textContent = 'No se pudo cargar la acreditación. Intente de nuevo más tarde.'; });
}());
