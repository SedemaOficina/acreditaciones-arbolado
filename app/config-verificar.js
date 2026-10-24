/* =========================================================
   config-verificar.js · Verificación pública de una acreditación

   Consulta la vista apd.verificacion_publica (exportada en los datos
   ficticios): nombre, tipo, número, fechas y situación. Nada más de la
   persona se expone. En la etapa 3 la consulta la responde
   GET /apd/verificar/:numero, con límite de consultas por origen.
   ========================================================= */
/* El número se escribe con o sin guiones (formato propio «numero-acreditacion», app/formatos-propios.js) y se compara
   ya normalizado, de los dos lados (auditoría «intentar romperlo», F1 10: sin guiones daba un «no acreditado» falso). */
window.FORMKIT_CONFIG = { formatos: window.APD_FORMATOS };
const numeroComparable = (n) => String(n || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
/* Un resultado anterior no se queda a la vista mientras se escribe otro número ni cuando el nuevo no es válido (F1 9):
   quien verifica podría creer que el número nuevo está vigente. */
document.addEventListener('DOMContentLoaded', () => {
  const caja = document.querySelector('[data-verificacion]');
  const numero = document.getElementById('numero');
  const oculta = () => { if (caja && !caja.hidden) { caja.hidden = true; caja.replaceChildren(); } };
  if (numero) numero.addEventListener('input', oculta);
  const form = numero && numero.form;
  if (form) form.addEventListener('submit', oculta, true);
});

window.FORMKIT_OPCIONES = {
  enviar(payload, { signal }) {
    return new Promise((ok, mal) => {
      const t = setTimeout(() => {
        APD.cargar().then((datos) => {
          const buscado = numeroComparable(payload.datos.numero);
          const fila = datos.verificacion_publica.find((v) => numeroComparable(v.numero) === buscado);
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
    // acreditación que no existe es una alerta. Una que ya venció dice «Vencida» con la familia gris, la misma de «Vencida»
    // en «Mis trámites» (decisión de Liber del 21/10, C6-05 a): antes era «No vigente» en rojo, un tercer color
    const situacion = (texto, icono) => el('p', { class: 'verificacion-situacion' }, [APD.icono(icono, 'icono verificacion-icono'), document.createTextNode(texto)]);
    if (!f) {
      caja.setAttribute('data-tono', 'error');
      caja.replaceChildren(
        situacion(`${r.numero} no está registrada`, 'cerrar'),
        el('p', { texto: 'Revisa que el número esté escrito tal como aparece en la credencial. Si es correcto, esta persona no tiene una acreditación de la Secretaría.' })
      );
    } else if (f.situacion === 'Cancelada') {
      // Cancelada por la Secretaría (P120, sesión de trabajo del 23/10/2026): en gris, como «Vencida», con el día de la
      // cancelación y sin el motivo (la vista pública no lo trae)
      caja.setAttribute('data-tono', 'terminado');
      caja.replaceChildren(
        situacion('Cancelada', 'archivo'),
        APD.datosLista([
          ['Nombre', f.nombre],
          ['Acreditación', f.tipo],
          ['Número de acreditación', f.numero],
          ['Emitida el', APD.fechaCorta(f.emitida_en)],
          ['Cancelada el', APD.fechaCorta(f.cancelada_el)]
        ]),
        el('p', { class: 'texto-gris', texto: 'La Secretaría canceló esta acreditación: con ella no se puede trabajar en el arbolado urbano.' })
      );
    } else {
      const vigente = f.situacion === 'Vigente';
      caja.setAttribute('data-tono', vigente ? 'ok' : 'terminado');
      caja.replaceChildren(
        situacion(vigente ? `Vigente hasta el ${APD.fechaCorta(f.vence_en)}` : f.vence_en < r.hoy ? 'Vencida' : 'No vigente', vigente ? 'palomita' : 'archivo'),
        APD.datosLista([
          ['Nombre', f.nombre],
          ['Acreditación', f.tipo],
          ['Número de acreditación', f.numero],
          ['Emitida el', APD.fechaCorta(f.emitida_en)],
          // Rótulo según el caso: «Vence en» o «Vencida hace» (auditoría 2026-10-18, D10)
          ...APD.vencimiento({ fecha_corte: r.hoy }, f.vence_en)
        ]),
        el('p', { class: 'texto-gris', texto: vigente
          ? 'Esta persona puede trabajar en el arbolado urbano con esta acreditación hasta la fecha de vencimiento.'
          : 'Con esta acreditación no se puede trabajar en el arbolado urbano.' })
      );
    }
    caja.hidden = false;
    caja.focus();
  }
};
