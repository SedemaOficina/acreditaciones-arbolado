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
          ok({ numero: payload.datos.numero, fila: fila || null, hoy: APD.hoy(datos) });
        }).catch(mal);
      }, 300);
      signal.addEventListener('abort', () => { clearTimeout(t); mal(new Error('plazo')); });
    });
  },
  alEnviar(r) {
    const { el } = APD;
    const caja = document.querySelector('[data-verificacion]');
    const f = r.fila;
    // El desenlace con su color e icono (propuesta «Avisos y confirmaciones», 2026-10-17): para quien verifica, una
    // acreditación que no existe es una alerta, como una que ya no está vigente
    const situacion = (texto, icono) => el('p', { class: 'verificacion-situacion' }, [APD.icono(icono, 'icono verificacion-icono'), document.createTextNode(texto)]);
    if (!f) {
      caja.setAttribute('data-tono', 'error');
      caja.replaceChildren(
        situacion(`${r.numero} no está registrada`, 'cerrar'),
        el('p', { texto: 'Revisa que el número esté escrito tal como aparece en la credencial. Si es correcto, esta persona no tiene una acreditación de la Secretaría.' })
      );
    } else {
      const vigente = f.situacion === 'Vigente';
      caja.setAttribute('data-tono', vigente ? 'ok' : 'error');
      caja.replaceChildren(
        situacion(vigente ? `Vigente hasta el ${APD.fecha(f.vence_en)}` : 'No vigente', vigente ? 'palomita' : 'cerrar'),
        APD.datosLista([
          ['Nombre', f.nombre],
          ['Acreditación', f.tipo],
          ['Número de acreditación', f.numero],
          ['Emitida el', APD.fecha(f.emitida_en)],
          ['Vence el', APD.fecha(f.vence_en)],
          ['Para vencer', APD.textoVence(APD.diasParaVencer({ fecha_corte: r.hoy }, f.vence_en))]
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
