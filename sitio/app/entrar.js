/* entrar.js · Caja «personas de ejemplo» de la versión de prueba: una persona ficticia por cada situación
   del trámite, para recorrer todas las pantallas. Se quita en la etapa 3 junto con el acceso simulado. */
(function () {
  'use strict';
  const { el } = APD;

  function situacionDe(datos, p) {
    const sols = APD.solicitudesDe(datos, p);
    if (sols.length) {
      const s = sols[0];
      return { clave: `s:${s.estado}`, texto: `${APD.TIPOS[s.tipo_acreditacion]} · ${APD.ESTADOS[s.estado].texto}` };
    }
    const acs = APD.acreditacionesDe(datos, p);
    if (acs.length) {
      const a = acs[0];
      const sit = APD.situacion(datos, a);
      return { clave: `a:${a.tipo_acreditacion}:${sit}`, texto: `${APD.TIPOS[a.tipo_acreditacion]} · ${APD.VIGENCIA[sit].texto}${sit === 'vencida_renovable' ? ' (todavía renovable)' : sit === 'vencida_no_renovable' ? ' (ya no renovable)' : ''}` };
    }
    return null;
  }

  function llena(curp) {
    const pon = (id, valor) => {
      const c = document.getElementById(id);
      c.value = valor;
      c.dispatchEvent(new Event('input', { bubbles: true }));
      c.dispatchEvent(new Event('change', { bubbles: true }));
    };
    pon('curp', curp);
    pon('contrasena', APD.CONTRASENA_FICTICIA);
    document.querySelector('[data-accion="enviar"]').focus();
  }

  APD.cargar().then((datos) => {
    for (const n of document.querySelectorAll('[data-contrasena-ficticia]')) n.textContent = APD.CONTRASENA_FICTICIA;
    const vistas = new Set();
    const filas = [];
    for (const p of datos.solicitante.filter((x) => x.estado === 'activa')) {
      const s = situacionDe(datos, p);
      if (!s || vistas.has(s.clave)) continue;
      vistas.add(s.clave);
      const boton = el('button', { type: 'button', class: 'btn btn-secundario pruebas-boton' }, [
        el('span', { texto: `${APD.nombreCompleto(p)} — ${s.texto}` })
      ]);
      boton.addEventListener('click', () => llena(p.curp));
      filas.push({ orden: s.clave, nodo: el('li', {}, [boton]) });
    }
    filas.sort((a, b) => a.orden.localeCompare(b.orden));
    document.querySelector('[data-ejemplos]').replaceChildren(...filas.map((f) => f.nodo));
    // Padrón migrado sin cuenta: se prueba creando la cuenta con su CURP
    const migradas = datos.solicitante.filter((x) => x.estado === 'sin_activar');
    if (migradas.length) {
      document.querySelector('[data-ejemplos-migradas]').replaceChildren(...migradas.map((p) => {
        const acs = APD.acreditacionesDe(datos, p).map((a) => `${APD.TIPOS[a.tipo_acreditacion]} ${APD.VIGENCIA[APD.situacion(datos, a)].texto.toLowerCase()}`).join('; ');
        return el('li', {}, [el('span', { class: 'mono', texto: p.curp }), document.createTextNode(` — ${acs}`)]);
      }));
      document.querySelector('[data-ejemplos-migradas-caja]').hidden = false;
    }
  }).catch(() => {
    document.querySelector('[data-ejemplos]').replaceChildren(el('li', { class: 'vacio', texto: 'No se pudieron cargar los datos de ejemplo.' }));
  });
}());
