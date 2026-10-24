/* reposicion.js · «Reposición de tu credencial» (persona solicitante; P140, sesión de trabajo del 23/10/2026).

   La persona con su acreditación vigente y su credencial ya entregada pide la reposición por pérdida o robo, con el acta
   que levantó (PDF o foto). La Secretaría revisa el acta: si tiene observaciones, aquí mismo se carga la corregida; si la
   acepta, la persona paga la cuota de reposición y recoge su credencial en el Vivero, donde el personal valida la factura.
   La credencial nueva lleva el mismo número y la misma vigencia. Las mismas reglas que la base (apd.reposicion_alta y
   apd.reposicion_cambio): la página orienta y la base decide. */
(function () {
  'use strict';
  const form = document.getElementById('formulario');
  const $ = (s, raiz) => (raiz || document).querySelector(s);
  const { el, fechaCorta } = APD;
  const numero = new URLSearchParams(location.search).get('numero') || '';
  const falla = (texto) => { $('[data-cargando]').textContent = texto; };
  const MOTIVO = { perdida: 'pérdida', robo: 'robo' };

  APD.cargar().then((datos) => {
    const persona = APD.requiereSesion(datos);
    if (!persona) return;
    APD.pintaSesion($('[data-sesion]'), persona);
    const a = APD.acreditacionesDe(datos, persona).find((x) => x.numero === numero);
    if (!a) return falla(`La acreditación ${numero} no es tuya o no existe. Revisa «Mis trámites».`);
    const abierta = APD.reposicionAbierta(datos, a);
    const corrige = Boolean(abierta && abierta.estado === 'con_observaciones');
    // Lo que la base no admitiría, se dice antes de pedir el acta
    if (!corrige) {
      const no = APD.porQueNoReponer(datos, a);
      if (no === 'en_curso') return falla(`Ya pediste la reposición de tu credencial ${a.numero}: síguela en «Mis trámites».`);
      if (no === 'sin_entrega') return falla('Tu credencial todavía no se te entrega: recógela en la oficina del Vivero. La reposición es para una credencial que ya recibiste y perdiste o te robaron.');
      if (no === 'no_vigente') return falla(`Tu acreditación ${a.numero} no está vigente: su credencial no se repone. Revisa en «Mis trámites» lo que puedes hacer.`);
    }
    const cuota = APD.cuotaReposicion(datos);
    $('[data-acreditacion]').replaceChildren(APD.datosLista([
      ['Acreditación', APD.TIPOS[a.tipo_acreditacion]],
      ['Número de acreditación', a.numero],
      ['Vigente hasta el', fechaCorta(a.vence_en)],
      ['Cuota de reposición', cuota.texto || 'La fija la Secretaría de Administración y Finanzas', cuota.texto ? null : 'el monto vigente.']
    ]), el('p', { class: 'texto-gris', texto: 'Tu credencial nueva lleva el mismo número y la misma vigencia. Pagas la cuota después de que la Secretaría acepte tu acta.' }));
    if (corrige) {
      $('[data-titulo]').textContent = 'Carga tu acta corregida';
      $('[data-bajada]').textContent = `Pediste la reposición de tu credencial el ${fechaCorta(abierta.solicitada_en)} por ${MOTIVO[abierta.motivo] || abierta.motivo}. La Secretaría revisó tu acta y te pide corregir lo que sigue.`;
      const obs = $('[data-observacion]');
      obs.hidden = false;
      FormKit.aviso(obs, { tono: 'advertencia', titulo: 'Qué corregir de tu acta', texto: el('p', { class: 'con-renglones', texto: APD.observacionDe('Tu acta', abierta.observacion) }) });
      const r = form.querySelector(`input[name="motivo"][value="${abierta.motivo}"]`);
      if (r) r.checked = true;
      $('[data-accion="enviar"]', form).textContent = 'Cargar el acta corregida';
    }
    form.hidden = false;
    $('[data-cargando]').hidden = true;

    FormKit.iniciar(form, {
      enviar(payload, { signal }) {
        return new Promise((ok, mal) => {
          const t = setTimeout(() => APD.cargar().then((ahora) => {
            // Justo antes de guardar (como en «Cargar el documento correcto»): la sesión sigue siendo la de quien abrió la
            // página y la reposición sigue en el paso en que estaba (la base: reposicion_en_curso, acta_fuera_de_turno)
            const sesion = APD.sesionCambio('No se guardó nada: vuelve a entrar y carga otra vez tu acta.');
            if (sesion) return mal(sesion);
            const a2 = ahora.acreditacion.find((x) => x.numero === a.numero);
            const r2 = a2 ? APD.reposicionAbierta(ahora, a2) : null;
            const sigue = corrige ? r2 && r2.estado === 'con_observaciones' : a2 && !APD.porQueNoReponer(ahora, a2);
            if (!sigue) {
              return mal(APD.rechazo('Ya no se puede pedir aquí', 'Tu reposición o tu acreditación cambiaron mientras tenías abierta esta página. No se guardó nada; revisa en «Mis trámites» lo que sigue.',
                { href: 'tramites.html', texto: 'Ir a «Mis trámites»' }, corrige ? 'acta_fuera_de_turno' : 'reposicion_en_curso'));
            }
            const A = typeof APD_ARCHIVOS_PRUEBA !== 'undefined' ? APD_ARCHIVOS_PRUEBA : null;
            const archivo = (payload.archivos || []).find((x) => x.campo === 'acta' && x.blob);
            if (!A || !archivo) return mal(APD.noGuardo('No se guardó tu acta', 'tu acta de prueba'));
            const en = new Date().toISOString();
            // El acta en este navegador y, sólo si quedó, el evento; si el evento no se guarda, se quita el acta
            return A.guardaDocumento(`reposicion:${a.numero}`, 'acta_reposicion', archivo, { en, motivo: 'reposicion', cargado_por: persona.correo || 'persona' })
              .then(() => {
                const ev = A.guardaEventoAcreditacion({ tipo: corrige ? 'acta_corregida' : 'reposicion', numero: a.numero, motivo: payload.datos.motivo,
                  acta: { nombre: archivo.nombre, tipo: archivo.tipo, tamano: archivo.size, en }, por: persona.correo || 'persona' });
                if (!ev) return A.quitaDocumento(`reposicion:${a.numero}`, 'acta_reposicion', en).catch(() => {}).then(() => mal(APD.noGuardo('No se guardó tu acta', 'tu acta de prueba')));
                // Como la API: se comprueba que la base lo aplicó
                return APD.cargar().then((d3) => {
                  const r3 = APD.reposicionAbierta(d3, d3.acreditacion.find((x) => x.numero === a.numero));
                  if (r3 && r3.estado === 'solicitada' && r3.acta_en === en) return ok({});
                  A.retiraEventoAcreditacion(ev.en);
                  return A.quitaDocumento(`reposicion:${a.numero}`, 'acta_reposicion', en).catch(() => {}).then(() => mal(APD.rechazo('No se guardó tu acta',
                    'La Secretaría no la pudo registrar: revisa en «Mis trámites» en qué va tu reposición.', { href: 'tramites.html', texto: 'Ir a «Mis trámites»' }, 'reposicion_en_curso')));
                });
              }, () => mal(APD.noGuardo('No se guardó tu acta', 'tu acta de prueba')));
          }).catch(mal), 400);
          signal.addEventListener('abort', () => { clearTimeout(t); mal(new Error('plazo')); });
        });
      },
      alFallar(e) { APD.muestraRechazo(e, form); },
      alEnviar() {
        form.hidden = true;
        FormKit.resultado($('[data-hecho]'), { tono: 'ok', titulo: corrige ? 'Recibimos tu acta corregida' : 'Recibimos tu solicitud de reposición',
          pasos: ['La Secretaría revisa tu acta.', 'Te indica en «Mis trámites» si debes corregir algo o, si está completa, cuánto pagar.',
            `Pagas la cuota de reposición y recoges tu credencial en la oficina del ${APD.sede(datos).nombre}, con el mismo número y la misma vigencia.`] });
      }
    });
  }).catch(() => falla('No se pudo cargar tu información. Intenta de nuevo más tarde.'));
}());
