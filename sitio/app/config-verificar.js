/* =========================================================
   config-verificar.js · Verificación pública de una acreditación

   Consulta la vista apd.verificacion_publica (exportada en los datos
   ficticios): nombre, tipo, número, fechas y situación. Nada más de la
   persona se expone. En la etapa 3 la consulta la responde
   GET /apd/verificar/:numero, con límite de consultas por origen.
   ========================================================= */
window.FORMKIT_CONFIG = {};

window.FORMKIT_OPCIONES = {
  enviar(payload, { signal }) {
    return new Promise((ok, mal) => {
      const t = setTimeout(() => {
        APD.cargar().then((datos) => {
          const fila = datos.verificacion_publica.find((v) => v.numero === payload.datos.numero);
          ok({ numero: payload.datos.numero, fila: fila || null });
        }).catch(mal);
      }, 300);
      signal.addEventListener('abort', () => { clearTimeout(t); mal(new Error('plazo')); });
    });
  },
  alEnviar(r) {
    const { el } = APD;
    const caja = document.querySelector('[data-resultado]');
    const f = r.fila;
    if (!f) {
      caja.removeAttribute('data-tono');
      caja.replaceChildren(
        el('p', { class: 'resultado-situacion', texto: 'No encontramos esa acreditación' }),
        el('p', { texto: `Revisa que el número ${r.numero} esté escrito tal como aparece impreso. Si es correcto, la acreditación no está registrada en la Secretaría.` })
      );
    } else {
      const vigente = f.situacion === 'Vigente';
      caja.setAttribute('data-tono', vigente ? 'ok' : 'error');
      caja.replaceChildren(
        el('p', { class: 'resultado-situacion', texto: vigente ? 'Vigente' : 'No vigente' }),
        APD.datosLista([
          ['Nombre', f.nombre],
          ['Acreditación', f.tipo],
          ['Número de acreditación', f.numero],
          ['Emitida el', APD.fecha(f.emitida_en)],
          ['Vence el', APD.fecha(f.vence_en)]
        ]),
        el('p', { class: 'texto-gris', texto: vigente
          ? 'Puede trabajar en el arbolado urbano con esta acreditación hasta la fecha de vencimiento.'
          : 'Con esta acreditación no se puede trabajar en el arbolado urbano.' })
      );
    }
    caja.hidden = false;
    caja.focus();
  }
};
