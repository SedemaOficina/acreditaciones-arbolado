/* =========================================================
   paginacion.js · Módulo «paginacion» · nivel OPCIONAL

   Navegación de resultados para listas y tablas extensas (consulta
   interna). Paginación numerada por omisión; «Cargar más» con data-modo=
   "mas". El desplazamiento infinito no se ofrece: perjudica al teclado y
   al pie de página. Requisitos que cumple: contenedor <nav> con etiqueta,
   página actual con aria-current, «Anterior»/«Siguiente» deshabilitados de
   forma explícita, rango visible («Mostrando 21–40 de 312»), selector de
   tamaño de página, anuncio del cambio, foco devuelto al inicio de la lista
   y versión reducida en teléfono («Página X de N»). Los filtros y el orden
   los conserva quien escucha el evento: el módulo sólo dice qué página.

   Contrato HTML:
     <nav class="paginacion" data-paginacion data-total="312" data-pagina="2"
          data-tamano="20" data-tamanos="10,20,50" data-lista="#resultados" aria-label="Páginas de resultados"></nav>
   Evento: el <nav> emite «formkit:pagina» con {pagina, tamano, desde, hasta}.
   FormKit.paginacion(nav, {total, pagina}) actualiza desde fuera.
   ========================================================= */
(function () {
  'use strict';
  function pinta(nav, ctx) {
    const { M, plantilla, anuncia, icono } = ctx;
    const total = Number(nav.dataset.total || 0), tam = Number(nav.dataset.tamano || 20);
    const paginas = Math.max(1, Math.ceil(total / tam));
    const pagina = Math.min(paginas, Math.max(1, Number(nav.dataset.pagina || 1)));
    nav.dataset.pagina = String(pagina);
    const desde = total ? (pagina - 1) * tam + 1 : 0, hasta = Math.min(total, pagina * tam);
    nav.textContent = '';

    const rango = document.createElement('p'); rango.className = 'paginacion-rango'; rango.textContent = plantilla(M.paginacionRango, { desde, hasta, total });
    const lista = document.createElement('ul'); lista.className = 'paginacion-lista';
    const boton = (texto, ir, cfg = {}) => {
      const li = document.createElement('li');
      const b = document.createElement('button'); b.type = 'button'; b.className = `paginacion-btn${cfg.clase ? ` ${cfg.clase}` : ''}`;
      if (cfg.icono) b.append(icono(cfg.icono, 'icono icono-sm'));
      b.append(document.createTextNode(texto));
      if (cfg.actual) { b.setAttribute('aria-current', 'page'); b.setAttribute('aria-label', plantilla(M.paginacionActual, { n: texto })); }
      if (cfg.deshabilitado) { b.setAttribute('aria-disabled', 'true'); } else b.dataset.ir = String(ir);
      if (cfg.etiqueta) b.setAttribute('aria-label', cfg.etiqueta);
      li.appendChild(b); return li;
    };
    lista.appendChild(boton(M.paginacionAnterior, pagina - 1, { deshabilitado: pagina === 1, icono: 'flecha-izq', clase: 'paginacion-prev' }));
    if (nav.dataset.modo !== 'mas') {
      /* Primera, última, la actual y una a cada lado; puntos suspensivos entre huecos. */
      const visibles = new Set([1, paginas, pagina - 1, pagina, pagina + 1].filter((n) => n >= 1 && n <= paginas));
      let previo = 0;
      for (const n of [...visibles].sort((a, b) => a - b)) {
        if (n - previo > 1) { const li = document.createElement('li'); li.className = 'paginacion-salto'; li.setAttribute('aria-hidden', 'true'); li.textContent = '…'; lista.appendChild(li); }
        lista.appendChild(boton(String(n), n, { actual: n === pagina, clase: 'paginacion-num' }));
        previo = n;
      }
    }
    lista.appendChild(boton(nav.dataset.modo === 'mas' ? M.paginacionMas : M.paginacionSiguiente, pagina + 1, { deshabilitado: pagina >= paginas, icono: nav.dataset.modo === 'mas' ? 'mas' : 'flecha-der', clase: 'paginacion-next' }));
    const compacto = document.createElement('p'); compacto.className = 'paginacion-compacto'; compacto.textContent = plantilla(M.paginacionPagina, { n: pagina, total: paginas });

    const sel = document.createElement('label'); sel.className = 'paginacion-tamano';
    const tamanos = (nav.dataset.tamanos || '').split(',').map((s) => Number(s.trim())).filter(Boolean);
    if (tamanos.length) {
      sel.append(document.createTextNode('Por página '));
      const s = document.createElement('select'); s.className = 'control control-select paginacion-select';
      for (const t of tamanos) { const o = document.createElement('option'); o.value = String(t); o.textContent = String(t); o.selected = t === tam; s.appendChild(o); }
      s.addEventListener('change', () => { nav.dataset.tamano = s.value; nav.dataset.pagina = '1'; cambia(nav, ctx); });
      sel.appendChild(s);
    }
    nav.append(rango, lista, compacto, tamanos.length ? sel : document.createTextNode(''));
  }

  function cambia(nav, ctx, foco = false) {
    pinta(nav, ctx);
    const total = Number(nav.dataset.total || 0), tam = Number(nav.dataset.tamano || 20), pagina = Number(nav.dataset.pagina);
    nav.dispatchEvent(new CustomEvent('formkit:pagina', { bubbles: true, detail: { pagina, tamano: tam, desde: (pagina - 1) * tam, hasta: Math.min(total, pagina * tam) } }));
    ctx.anuncia(ctx.plantilla(ctx.M.paginacionAnuncio, { n: pagina, total: Math.max(1, Math.ceil(total / tam)) }));
    if (foco) {
      const lista = nav.dataset.lista && document.querySelector(nav.dataset.lista);
      const destino = lista || nav;
      if (!destino.hasAttribute('tabindex')) destino.tabIndex = -1;
      destino.focus({ preventScroll: false });
    }
  }

  FormKit.registra('paginacion', {
    selector: '[data-paginacion]',
    fueraDelFormulario: true,
    iniciar(form, ctx) {
      for (const nav of ctx.$$('[data-paginacion]')) {
        if (nav.dataset.listo !== undefined) continue; /* ya iniciada por otro formulario de la página */
        nav.dataset.listo = '';
        pinta(nav, ctx);
        nav.addEventListener('click', (e) => { const b = e.target.closest('[data-ir]'); if (!b) return; nav.dataset.pagina = b.dataset.ir; cambia(nav, ctx, true); });
      }
      FormKit.paginacion = (nav, datos = {}) => { Object.assign(nav.dataset, Object.fromEntries(Object.entries(datos).map(([k, v]) => [k, String(v)]))); pinta(nav, ctx); };
    }
  });
}());
