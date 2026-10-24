/* corregir.js · «Cargar el documento correcto» (persona solicitante, etapa 2).

   Cuando en el cotejo un documento no coincide con el que la persona cargó y ella puede conseguir el correcto ese
   mismo día (en un café internet o en su teléfono), la cita queda en pausa (decisión 2026-10-17, Liber). Aquí lo
   carga; el personal ve en sus citas «Documento cargado · retomar» y retoma el cotejo de ese documento.
   Se pide sólo lo que no coincidió: cargar_<requisito>, que calculan la página y el servidor. */
(function () {
  'use strict';
  const form = document.getElementById('formulario');
  const $ = (s, raiz) => (raiz || document).querySelector(s);
  const folio = new URLSearchParams(location.search).get('folio') || '';
  const falla = (texto) => { $('[data-cargando]').textContent = texto; };

  APD.cargar().then((datos) => {
    const persona = APD.requiereSesion(datos);
    if (!persona) return;
    APD.pintaSesion($('[data-sesion]'), persona);
    const s = APD.solicitudesDe(datos, persona).find((x) => x.folio === folio);
    if (!s || s.estado !== 'validada_en_linea' || !s.cotejo_pausa) {
      return falla(`Tu solicitud ${folio} no tiene una cita en pausa: no hay documentos por cargar aquí. Revisa «Mis trámites».`);
    }
    // La pausa sólo dura el día de la cita (auditoría integral, alta 6): después ya no se carga aquí
    if (APD.pausaVencida(datos, s)) {
      return falla(`La pausa de tu cita del ${APD.fechaCorta(s.cotejo_pausa.cita_en || s.cita_en)} venció: sólo duraba ese día. La Secretaría regresa tu solicitud con observaciones; cuando la veas así en «Mis trámites», corrige ahí el documento y reenvía tu solicitud.`);
    }
    const pausa = s.cotejo_pausa;
    const docs = datos.documento.filter((d) => d.solicitud_id === s.id && d.vigente);
    // Ya cargó lo que no coincidió (al volver a entrar después de cargarlo): no se vuelve a pedir
    if (pausa.docs.length && pausa.docs.every((k) => docs.some((d) => d.requisito === k && APD.cargadoTras(d, pausa)))) {
      $('[data-cargando]').hidden = true;
      FormKit.resultado($('[data-hecho]'), { tono: 'ok', titulo: pausa.docs.length === 1 ? 'Ya cargaste el documento correcto' : 'Ya cargaste los documentos correctos',
        pasos: ['Imprime lo que cargaste.', `Regresa con la persona que te atiende en el ${APD.sede(datos).nombre}.`, 'Ahí termina tu cotejo.'] });
      return;
    }
    $('[data-bajada]').textContent = `En tu cita del ${APD.fechaLarga(s.cita_en, { hora: true })} ${pausa.docs.length === 1 ? 'un documento no coincidió' : 'algunos documentos no coincidieron'} con ${pausa.docs.length === 1 ? 'el' : 'los'} que cargaste. Cárgalo hoy y regresa con la persona que te atiende para terminar tu cotejo.`;
    for (const k of pausa.docs) {
      const d = docs.find((x) => x.requisito === k);
      const ayuda = $(`[data-diferencia="${k}"]`, form);
      // De tú y con minúscula después de los dos puntos (auditoría 2026-10-18, D11)
      if (ayuda) ayuda.classList.add('con-renglones');
      if (ayuda) ayuda.textContent = d && d.observacion ? APD.observacionDe('No coincidió', d.observacion) : 'No coincidió con el que llevaste.';
    }
    for (const input of form.querySelectorAll('input[data-auxiliar]')) {
      const k = input.name.replace(/^cargar_/, '');
      input.value = pausa.docs.includes(k) ? 'si' : 'no';
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    const boton = $('[data-accion="enviar"]', form);
    boton.textContent = pausa.docs.length === 1 ? 'Cargar el documento' : 'Cargar los documentos';
    form.hidden = false;
    $('[data-cargando]').hidden = true;

    FormKit.iniciar(form, {
      enviar(payload, { signal }) {
        return new Promise((ok, mal) => {
          const t = setTimeout(() => APD.cargar().then((ahora) => {
            // Justo antes de guardar (auditoría «intentar romperlo», bloque 2): la sesión sigue siendo la de quien abrió la
            // página y la cita sigue en pausa ese día (la base: carga_fuera_de_turno)
            // Esta página no tiene borrador: al volver a entrar, el documento se carga otra vez (B6-01)
            const sesion = APD.sesionCambio(`No se cargó nada: vuelve a entrar y carga otra vez ${pausa.docs.length === 1 ? 'tu documento' : 'tus documentos'}.`);
            if (sesion) return mal(sesion);
            const s2 = ahora.solicitud.find((x) => x.folio === s.folio);
            if (!s2 || s2.solicitante_id !== persona.id || s2.estado !== 'validada_en_linea' || !s2.cotejo_pausa || APD.pausaVencida(ahora, s2)) {
              return mal(APD.rechazo('Ya no se puede cargar aquí', 'Tu cita ya no está en pausa: se registró en la Secretaría mientras tenías abierta esta página. No se guardó nada; revisa en «Mis trámites» lo que sigue.',
                { href: 'tramites.html', texto: 'Ir a «Mis trámites»' }, 'carga_fuera_de_turno'));
            }
            const A = typeof APD_ARCHIVOS_PRUEBA !== 'undefined' ? APD_ARCHIVOS_PRUEBA : null;
            const archivos = (payload.archivos || []).filter((a) => a.campo.startsWith('doc_') && a.blob);
            const en = new Date().toISOString();
            // Si el navegador no guarda el documento (almacenamiento bloqueado o lleno), se dice: decía «Listo» y el personal
            // no tenía nada que retomar (auditoría «intentar romperlo», F4 A4). Lo que sí quedó se quita: o todos o ninguno.
            if (!A) return mal(APD.noGuardo('No se cargó tu documento', 'tu documento de prueba'));
            return Promise.allSettled(archivos.map((a) => A.guardaDocumento(s.folio, a.campo.slice(4), a, { en, motivo: 'cotejo', cargado_por: persona.correo || 'persona' })))
              .then((r) => {
                if (r.every((x) => x.status === 'fulfilled')) return ok({ n: archivos.length });
                const quita = archivos.filter((a, i) => r[i].status === 'fulfilled').map((a) => A.quitaDocumento(s.folio, a.campo.slice(4), en).catch(() => {}));
                return Promise.all(quita).then(() => mal(APD.noGuardo(archivos.length === 1 ? 'No se cargó tu documento' : 'No se cargaron tus documentos', archivos.length === 1 ? 'tu documento de prueba' : 'tus documentos de prueba')));
              });
          }).catch(mal), 400);
          signal.addEventListener('abort', () => { clearTimeout(t); mal(new Error('plazo')); });
        });
      },
      alFallar(e) { APD.muestraRechazo(e, form); },
      alEnviar() {
        form.hidden = true;
        // Es una corrección, no una solicitud nueva (sesión de trabajo del 23/10/2026, nuevo 6): lo dice el título y los
        // pasos son los de la corrección: quien te atiende revisa lo que corregiste y ahí sigue tu cotejo
        FormKit.resultado($('[data-hecho]'), { tono: 'ok', titulo: 'Recibimos la corrección de tus documentos',
          pasos: [pausa.docs.length === 1 ? 'Imprime el documento que corregiste.' : 'Imprime los documentos que corregiste.',
            `Regresa hoy con la persona que te atiende en el ${APD.sede(datos).nombre}: revisa lo que corregiste contra el impreso.`,
            'Si coincide, ahí mismo termina tu cotejo y quedas en espera de grupo del curso.'] });
      }
    });
  }).catch(() => falla('No se pudo cargar tu información. Intenta de nuevo más tarde.'));
}());
