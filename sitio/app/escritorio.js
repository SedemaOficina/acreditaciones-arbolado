/* =========================================================
   escritorio.js · Acomodo de escritorio (decisión de Liber del 25/10/2026; docs/diseno-escritorio/DIAGNOSTICO.md,
   secciones 4.3, 4.4 y 4.9): lo común del inicio del personal (bandeja), de «Grupos» y de la ficha del grupo.

   Pestañas sólo desde 1024 px. Son las del módulo «pestanas» del estándar 1.5.1 (teclado, anuncio, tabindex rotatorio);
   debajo de 1024 px la lista de pestañas no se ve (app/apd.css, sección «Escritorio», .pestanas-escritorio) y cada panel se muestra
   como antes, uno debajo de otro, con su orden y sus textos de hoy: el teléfono y la tableta no cambian. Aquí sólo se
   ponen y se quitan los atributos de panel (role, aria-labelledby, tabindex, hidden) al cruzar los 1024 px; el panel
   recuerda la etiqueta que tenía (su título) para regresársela en teléfono. Propuesta al estándar E14: «pestañas desde
   un ancho» (data-pestanas-desde).

   Un enlace a algo que está dentro de un panel oculto (un indicador, «Ver los grupos programados», una dirección
   con #ancla) abre primero su pestaña.
   ========================================================= */
(function (global) {
  'use strict';
  const ESCRITORIO = '(min-width: 1024px)';

  /* cont: el [data-pestanas]; alCambiar(tab): después de cambiar de pestaña (también al cargar). Devuelve { activa,
     muestra, escritorio }: activa(tab), muestra(elemento) abre la pestaña que lo contiene, escritorio() si hay pestañas. */
  function pestanas(cont, opciones = {}) {
    const mq = global.matchMedia(ESCRITORIO);
    const tabs = [...cont.querySelectorAll('[role="tab"]')];
    const panelDe = (t) => document.getElementById(t.getAttribute('aria-controls'));
    for (const t of tabs) {
      const p = panelDe(t);
      if (p && p.dataset.etiquetaTelefono === undefined) p.dataset.etiquetaTelefono = p.getAttribute('aria-labelledby') || '';
    }
    const seleccionada = () => tabs.find((t) => t.getAttribute('aria-selected') === 'true') || tabs[0];
    function aplica() {
      const en = mq.matches;
      const sel = seleccionada();
      // El título de un panel que repite su pestaña: en escritorio, sólo para el lector (.solo-lector del estándar)
      for (const h of document.querySelectorAll('.titulo-de-pestana')) h.classList.toggle('solo-lector', en);
      for (const t of tabs) {
        const p = panelDe(t);
        if (!p) continue;
        if (en) {
          p.setAttribute('role', 'tabpanel');
          p.setAttribute('aria-labelledby', t.id);
          p.tabIndex = 0;
          p.hidden = t !== sel;
        } else {
          p.removeAttribute('role');
          p.removeAttribute('tabindex');
          if (p.dataset.etiquetaTelefono) p.setAttribute('aria-labelledby', p.dataset.etiquetaTelefono); else p.removeAttribute('aria-labelledby');
          p.hidden = false;
        }
      }
      if (opciones.alCambiar) opciones.alCambiar(sel, en);
    }
    // El módulo del estándar cambia aria-selected y hidden; aquí se avisa a la página (p. ej. abrir «Ya terminaron»)
    const vigila = new MutationObserver(() => { if (opciones.alCambiar) opciones.alCambiar(seleccionada(), mq.matches); });
    for (const t of tabs) vigila.observe(t, { attributes: true, attributeFilter: ['aria-selected'] });
    mq.addEventListener('change', aplica);
    aplica();

    function activa(tab) {
      if (!tab || !mq.matches || tab.getAttribute('aria-selected') === 'true') return;
      tab.click();
    }
    function muestra(elemento) {
      if (!elemento || !mq.matches) return;
      const t = tabs.find((x) => { const p = panelDe(x); return p && p.contains(elemento); });
      if (t) activa(t);
    }
    // Enlaces a un #ancla de un panel oculto: primero su pestaña, luego el navegador baja al ancla
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[href^="#"]');
      if (!a || a.getAttribute('href').length < 2) return;
      muestra(document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1))));
    });
    const deLaDireccion = () => {
      if (location.hash.length < 2) return;
      const destino = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (!destino || !mq.matches) return;
      const t = tabs.find((x) => { const p = panelDe(x); return p && p.contains(destino) && p.hidden; });
      if (t) { activa(t); destino.scrollIntoView(); }
    };
    global.addEventListener('hashchange', deLaDireccion);
    deLaDireccion();
    return { activa, muestra, escritorio: () => mq.matches, tabs };
  }

  global.APD_ESCRITORIO = { pestanas, ESCRITORIO };
}(window));
