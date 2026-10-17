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
    const req = Object.fromEntries(datos.requisito.map((r) => [r.clave, r]));
    const pausa = s.cotejo_pausa;
    const docs = datos.documento.filter((d) => d.solicitud_id === s.id && d.vigente);
    $('[data-bajada]').textContent = `En tu cita del ${APD.fechaHora(s.cita_en)} ${pausa.docs.length === 1 ? 'un documento no coincidió' : 'algunos documentos no coincidieron'} con ${pausa.docs.length === 1 ? 'el' : 'los'} que cargaste. Cárgalo hoy y regresa con la persona que te atiende para terminar tu cotejo.`;
    for (const k of pausa.docs) {
      const d = docs.find((x) => x.requisito === k);
      const ayuda = $(`[data-diferencia="${k}"]`, form);
      if (ayuda) ayuda.textContent = d && d.observacion ? `No coincidió: ${d.observacion}` : 'No coincidió con el que llevaste.';
    }
    for (const input of form.querySelectorAll('[data-auxiliar] input')) {
      const k = input.name.replace(/^cargar_/, '');
      input.value = pausa.docs.includes(k) ? 'si' : 'no';
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const boton = $('[data-accion="enviar"]', form);
    boton.textContent = pausa.docs.length === 1 ? 'Cargar el documento' : 'Cargar los documentos';
    form.hidden = false;
    $('[data-cargando]').hidden = true;

    FormKit.iniciar(form, {
      enviar(payload, { signal }) {
        return new Promise((ok, mal) => {
          const t = setTimeout(() => {
            const A = typeof APD_ARCHIVOS_PRUEBA !== 'undefined' ? APD_ARCHIVOS_PRUEBA : null;
            const archivos = (payload.archivos || []).filter((a) => a.campo.startsWith('doc_') && a.blob);
            const en = new Date().toISOString();
            Promise.all(archivos.map((a) => (A ? A.guardaDocumento(s.folio, a.campo.slice(4), a, { en, motivo: 'cotejo', cargado_por: persona.correo || 'persona' }).catch(() => {}) : null)))
              .then(() => ok({ n: archivos.length }));
          }, 400);
          signal.addEventListener('abort', () => { clearTimeout(t); mal(new Error('plazo')); });
        });
      },
      alEnviar() {
        form.hidden = true;
        $('[data-hecho-texto]').textContent = `Regresa con la persona que te atiende en el ${APD.sede(datos).nombre}, con el documento impreso, para terminar tu cotejo.`;
        const hecho = $('[data-hecho]');
        hecho.hidden = false;
        hecho.focus();
        hecho.scrollIntoView({ block: 'start' });
      }
    });
  }).catch(() => falla('No se pudo cargar tu información. Intenta de nuevo más tarde.'));
}());
