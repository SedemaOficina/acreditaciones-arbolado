/* inicio.js · Página de inicio: requisitos, plazos y duraciones salen del catálogo de la base
   (datos/ficticios.json), no se escriben a mano en la página. */
(function () {
  'use strict';
  const { el } = APD;

  function pinta(datos) {
    for (const nodo of document.querySelectorAll('[data-param]')) {
      const v = APD.parametro(datos, nodo.dataset.param);
      if (v !== null) nodo.textContent = String(v);
    }
    const nueva = APD.curso(datos, 'poda', 'nueva');
    const renov = APD.curso(datos, 'poda', 'renovacion');
    const dur = document.querySelector('[data-duraciones]');
    if (dur && nueva && renov) {
      const dias = (n) => `${n} ${n === 1 ? 'día' : 'días'}`;
      dur.textContent = `de ${dias(nueva.dias_duracion)} la primera vez y de ${dias(renov.dias_duracion)} la renovación`;
    }

    const requisito = Object.fromEntries(datos.requisito.map((r) => [r.clave, r]));
    const caja = document.querySelector('[data-requisitos]');
    const bloques = [];
    for (const tipo of ['poda', 'dictaminador']) {
      for (const modalidad of ['nueva', 'renovacion']) {
        const c = APD.curso(datos, tipo, modalidad);
        const filas = datos.requisito_curso
          .filter((rc) => rc.tipo_acreditacion === tipo && rc.modalidad === modalidad && requisito[rc.requisito].activo)
          .sort((a, b) => a.orden - b.orden);
        const lista = el('ul', { class: 'lista-obs' }, filas.map((rc) => {
          const r = requisito[rc.requisito];
          const cuando = r.momento === 'cotejo' ? ' Se entrega en la cita de cotejo.' : '';
          const nota = APD.limpia(rc.nota) ? ` ${APD.limpia(rc.nota)}` : '';
          return el('li', {}, [
            el('strong', { texto: r.nombre + (rc.obligatorio ? '' : ' (si aplica)') }),
            document.createTextNode(`. ${APD.limpia(r.descripcion)}${nota}${cuando}`)
          ]);
        }));
        const curso = c ? el('p', { class: 'texto-gris', texto: `Curso de ${c.dias_duracion} ${c.dias_duracion === 1 ? 'día' : 'días'}; asistencia mínima de ${c.dias_minimos_asistencia} ${c.dias_minimos_asistencia === 1 ? 'día' : 'días'}; calificación mínima del examen: ${Number(c.calificacion_minima).toFixed(1)}. Pago de derechos: ${c.pago_monto != null ? Number(c.pago_monto).toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) : 'pendiente de la Gaceta Oficial'}.` }) : null;
        bloques.push(el('details', { class: 'plegable' }, [
          el('summary', { class: 'plegable-titulo', texto: `${APD.TIPOS[tipo]} · ${APD.MODALIDADES[modalidad].toLowerCase()}` }),
          el('div', { class: 'plegable-cuerpo' }, [lista, curso])
        ]));
      }
    }
    caja.replaceChildren(...bloques);
  }

  APD.cargar().then(pinta).catch(() => {
    const caja = document.querySelector('[data-requisitos]');
    if (caja) caja.replaceChildren(el('p', { class: 'vacio', texto: 'No se pudieron cargar los requisitos. Intenta de nuevo más tarde.' }));
  });
}());
