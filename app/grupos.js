/* grupos.js · «Grupos» (personal, etapa 2; maqueta aprobada y decisiones del 2026-10-17).
   La espera de cada uno de los cuatro cursos (cuántas personas, prioritarias, renovaciones ya vencidas y si alcanza
   para un grupo) y los grupos, de los que están en curso a los cerrados. Un grupo nuevo se arma desde la espera de su
   curso (espera.html); cada grupo se abre en grupo.html. Lee los datos ficticios y lo registrado en la prueba
   (APD.cargar); en la etapa 3 los da la API del personal. */
(function () {
  'use strict';
  const { el, estado, fecha } = APD;
  const P = APD_PERSONAL;
  const $ = (s) => document.querySelector(s);
  const plural = (n, uno, varios) => (n === 1 ? `1 ${uno}` : `${n} ${varios}`);

  APD.cargar().then((datos) => {
    P.pintaSesion($('[data-sesion-personal]'), 'grupos');
    const curso0 = datos.curso[0] || {};
    $('[data-cupo-min]').textContent = curso0.cupo_minimo;
    $('[data-cupo-max]').textContent = curso0.cupo_maximo;
    const todos = P.grupos(datos);

    /* La espera de cada curso */
    $('[data-cursos]').replaceChildren(...P.CURSOS.map(([t, m]) => {
      const c = APD.curso(datos, t, m);
      const lista = P.enEspera(datos, t, m);
      const prioritarias = lista.filter((x) => x.prioritaria).length;
      const vencidas = lista.filter((x) => x.vencida).length;
      const falta = c.cupo_minimo - lista.length;
      // Todos los grupos del curso que reciben personas, no sólo el primero que se arma (auditoría de tareas, M7)
      const receptores = todos.filter((x) => x.g.tipo_acreditacion === t && x.g.modalidad === m && x.recibe);
      const abierto = receptores.length > 0;
      const nombre = P.nombreCurso(t, m);
      const avisos = [];
      if (prioritarias) avisos.push(el('p', {}, [estado(`${plural(prioritarias, 'espera', 'esperan')} ${APD.parametro(datos, 'dias_alerta_espera')} días o más`, 'pend')]));
      if (vencidas) avisos.push(el('p', {}, [estado(`${plural(vencidas, 'persona', 'personas')} con la acreditación vencida: no ${vencidas === 1 ? 'puede' : 'pueden'} ejercerla mientras ${vencidas === 1 ? 'espera' : 'esperan'}`, 'error')]));
      const situacion = !lista.length ? 'Nadie en espera.'
        : falta <= 0 ? (() => {
          // Cuántos grupos nuevos alcanzan, no sólo «alcanza» (con 6 o con 100 se leía igual)
          const nuevos = Math.floor(lista.length / c.cupo_maximo) + (lista.length % c.cupo_maximo >= c.cupo_minimo ? 1 : 0);
          return `Alcanza para ${nuevos === 1 ? 'un grupo nuevo' : `${nuevos} grupos nuevos`} de hasta ${c.cupo_maximo}.`;
        })()
          : `${falta === 1 ? 'Falta 1' : `Faltan ${falta}`} para el mínimo de ${c.cupo_minimo}.`;
      // Los grupos que reciben personas, con de quién son y cuánto les falta: con la espera se completan
      const enArmado = receptores.length ? el('ul', { class: 'curso-receptores' }, receptores.map((x) => {
        const falta = x.g.cupo_minimo - x.n;
        const quien = x.g.integracion === 'especifico' ? `sólo ${x.integracion.replace('De una organización · ', '')}` : 'combinado';
        const como = x.g.estado === 'confirmado' ? `confirmado, caben ${x.lugar} hasta el ${APD.fecha(APD.sumaDias(x.g.fecha_inicio, -1))}`
          : falta > 0 ? `por confirmar, le ${falta === 1 ? 'falta 1' : `faltan ${falta}`} para el mínimo` : 'por confirmar';
        return el('li', { texto: `${x.g.folio} · ${quien} · ${x.n} de ${x.g.cupo_maximo} · ${como}` });
      })) : null;
      return el('li', { class: 'curso' }, [
        el('h4', { class: 'curso-nombre', texto: nombre }),
        el('p', { class: 'curso-cifra' }, [document.createTextNode(String(lista.length)), el('span', { texto: ' en espera' })]),
        ...avisos,
        el('p', { class: 'texto-gris', texto: situacion }),
        enArmado ? el('p', { class: 'curso-receptores-titulo', texto: receptores.length === 1 ? 'Grupo que recibe personas:' : 'Grupos que reciben personas:' }) : null,
        enArmado,
        lista.length || abierto
          ? el('a', { class: 'btn btn-secundario btn-chico', href: `espera.html?curso=${P.claveCurso(t, m)}`, 'aria-label': `Ver la espera de ${nombre}`, texto: 'Ver la espera' })
          : null
      ]);
    }));

    /* Los grupos */
    $('[data-filas]').replaceChildren(...todos.map((x) => {
      const g = x.g;
      const abrir = ['en_integracion', 'confirmado'].includes(g.estado) ? 'Abrir' : 'Ver';
      return el('tr', { 'data-grupo': g.folio, class: ['concluido', 'cancelado'].includes(g.estado) ? 'fila-hecha' : null }, [
        el('td', {}, [el('span', { class: 'mono', texto: g.folio })]),
        el('td', { texto: x.nombre }),
        el('td', { texto: x.integracion }),
        el('td', { texto: g.estado === 'cancelado' ? '' : P.cupoTexto(x) }),
        el('td', { texto: g.fecha_inicio ? fecha(g.fecha_inicio) : g.estado === 'cancelado' ? '' : 'Sin fecha' }),
        el('td', { texto: g.instructor ? P.nombreInstructor(g.instructor) : g.estado === 'cancelado' ? '' : 'Sin asignar' }),
        el('td', {}, [estado(x.situacion.texto, x.situacion.tono)]),
        el('td', {}, [el('a', { class: 'btn btn-secundario btn-chico', href: `grupo.html?folio=${encodeURIComponent(g.folio)}`, 'aria-label': `${abrir} el grupo ${g.folio}`, texto: abrir })])
      ]);
    }));
    // En teléfono cada celda muestra su encabezado (data-etiqueta). El módulo tabla del estándar lo hace sólo cuando la
    // página tiene un formulario que lo inicie; esta no tiene (hallazgo P110): se pone aquí igual que el módulo.
    const ths = Array.from(document.querySelectorAll('[data-tabla] thead th'));
    for (const tr of document.querySelectorAll('[data-filas] tr')) {
      Array.from(tr.children).forEach((td, i) => {
        if (!ths[i]) return;
        const visible = ths[i].cloneNode(true);
        for (const s of visible.querySelectorAll('.solo-lector')) s.remove();
        td.dataset.etiqueta = ths[i].textContent.trim();
        if (!visible.textContent.trim()) td.dataset.etiquetaOculta = '';
      });
    }
    const activos = todos.filter((x) => ['en_integracion', 'confirmado', 'en_curso'].includes(x.g.estado)).length;
    $('[data-cuenta]').textContent = `${plural(todos.length, 'grupo', 'grupos')}: ${plural(activos, 'activo', 'activos')} (por confirmar, confirmados o en curso).`;
  }).catch(() => {
    $('[data-cuenta]').textContent = 'No se pudieron cargar los grupos. Intente de nuevo más tarde.';
  });
}());
