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
    // Las horas del curso, como H:MM (parámetros curso_hora_entrada y curso_hora_salida, P91)
    for (const nodo of document.querySelectorAll('[data-param-texto]')) {
      const v = APD.parametroTexto(datos, nodo.dataset.paramTexto);
      if (v) nodo.textContent = v.replace(/^0(\d):/, '$1:');
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
          const cuando = { cotejo: ' Se entrega en la cita de cotejo.', entrega: ' Se hace al recoger tu credencial.' }[r.momento] || '';
          const nota = APD.limpia(rc.nota) ? ` ${APD.limpia(rc.nota)}` : '';
          return el('li', {}, [
            el('strong', { texto: r.nombre + (rc.obligatorio ? '' : ' (si aplica)') }),
            document.createTextNode(`. ${APD.limpia(r.descripcion)}${nota}${cuando}`),
            // Dónde obtenerlo (p. ej. la CURP en gob.mx), en otra pestaña
            r.enlace ? document.createTextNode(' ') : null,
            r.enlace ? el('a', { href: r.enlace, target: '_blank', rel: 'noopener' }, [document.createTextNode(r.enlace_texto), el('span', { class: 'solo-lector', texto: ' (se abre en otra pestaña)' })]) : null,
            r.enlace ? document.createTextNode('.') : null
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

  /* Con la sesión abierta (B12): en lugar de «Crea tu cuenta» y «Entra», «Mis trámites» */
  function conSesion(datos) {
    const p = APD.personaDeSesion(datos);
    const cuenta = document.querySelector('.menu-inicio a[href="cuenta.html"]');
    const entrar = document.querySelector('.menu-inicio a[href="entrar.html"]');
    if (!p || !cuenta || !entrar) return;
    cuenta.replaceWith(el('a', { class: 'menu-opcion', href: 'tramites.html' }, [
      el('span', { class: 'menu-opcion-titulo', texto: 'Mis trámites' }),
      el('span', { class: 'menu-opcion-texto', texto: `Entraste como ${APD.nombreCompleto(p)}. Consulta en qué va tu trámite o inicia uno.` })
    ]));
    entrar.remove();
  }

  APD.cargar().then((datos) => { conSesion(datos); pinta(datos); }).catch(() => {
    const caja = document.querySelector('[data-requisitos]');
    if (caja) caja.replaceChildren(el('p', { class: 'vacio', texto: 'No se pudieron cargar los requisitos. Intenta de nuevo más tarde.' }));
  });
}());
