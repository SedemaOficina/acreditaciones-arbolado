/* =========================================================
   visor.js · Visor de documentos de la revisión documental (decisión 2026-10-16)

   Muestra TODAS las hojas del PDF elegido, una debajo de otra, con contador
   de hoja, acercar y alejar, ajustar al ancho, girar y abrir en otra pestaña.
   En computadora (≥1024 px) queda fijo a la derecha de la revisión, para
   decidir viendo el documento; en pantallas más chicas se abre a pantalla
   completa como diálogo (Escape cierra y el foco vuelve a «Ver documento»).

   Usa pdf.js, copiado al sitio por construir-sitio.mjs (sin CDN), y lo carga
   sólo cuando se abre el primer documento. El estándar de formularios no
   tiene visor de documentos (hallazgo P67).

   Contrato HTML:
     <dialog class="visor" data-visor aria-labelledby="visor-titulo">…</dialog>
   y APD_VISOR.abre({ url, titulo, archivo }, boton).
   ========================================================= */
(function (global) {
  'use strict';
  const BASE = new URL('../vendor/pdfjs/', document.currentScript.src);
  const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
  const ancho = global.matchMedia('(min-width: 1024px)');
  let pdfjs = null;
  let estado = { doc: null, url: '', zoom: 2, giro: 0, tarea: 0 };
  let origen = null;

  const d = document.querySelector('[data-visor]');
  if (!d) return;
  const $ = (s) => d.querySelector(s);
  const hojas = $('[data-visor-hojas]');
  const aviso = $('[data-visor-aviso]');
  const contador = $('[data-visor-pagina]');

  function carga() {
    if (pdfjs) return Promise.resolve(pdfjs);
    return import(new URL('pdf.min.mjs', BASE).href).then((m) => {
      m.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.mjs', BASE).href;
      pdfjs = m;
      return m;
    });
  }
  function di(texto) { aviso.textContent = texto; aviso.hidden = !texto; }

  /* Pinta todas las hojas al ancho disponible por el acercamiento elegido */
  async function pinta() {
    const tarea = ++estado.tarea;
    const doc = estado.doc;
    if (!doc) return;
    const disponible = Math.max(hojas.clientWidth - 2 * parseFloat(getComputedStyle(hojas).paddingLeft || 0), 200);
    const factor = ZOOMS[estado.zoom];
    const dpr = global.devicePixelRatio || 1;
    const figuras = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const pagina = await doc.getPage(n);
      if (tarea !== estado.tarea) return; // llegó otro documento u otro acercamiento
      const base = pagina.getViewport({ scale: 1, rotation: (pagina.rotate + estado.giro) % 360 });
      const escala = (disponible * factor) / base.width;
      const vista = pagina.getViewport({ scale: escala * dpr, rotation: (pagina.rotate + estado.giro) % 360 });
      const lienzo = document.createElement('canvas');
      lienzo.width = Math.floor(vista.width);
      lienzo.height = Math.floor(vista.height);
      lienzo.className = 'visor-lienzo';
      lienzo.setAttribute('role', 'img');
      lienzo.setAttribute('aria-label', `Hoja ${n} de ${doc.numPages}`);
      const fig = document.createElement('figure');
      fig.className = 'visor-hoja-pdf';
      fig.dataset.hoja = String(n);
      const pie = document.createElement('figcaption');
      pie.className = 'visor-pie';
      pie.textContent = `Hoja ${n} de ${doc.numPages}`;
      fig.append(lienzo, pie);
      figuras.push(fig);
      await pagina.render({ canvasContext: lienzo.getContext('2d'), viewport: vista }).promise;
    }
    if (tarea !== estado.tarea) return;
    hojas.replaceChildren(...figuras);
    // El ancho en pantalla lo da la hoja de estilos según el acercamiento (sin estilos en línea)
    hojas.dataset.zoom = String(Math.round(factor * 100));
    $('[data-visor-zoom]').textContent = `${Math.round(factor * 100)} %`;
    observa();
  }

  /* Contador: la hoja que más se ve */
  let observador = null;
  function observa() {
    if (observador) observador.disconnect();
    const visibles = new Map();
    observador = new IntersectionObserver((entradas) => {
      if (!estado.doc) return; // cambió de documento mientras se observaba
      for (const e of entradas) visibles.set(e.target.dataset.hoja, e.intersectionRatio);
      const [hoja] = [...visibles.entries()].sort((a, b) => b[1] - a[1])[0] || ['1'];
      contador.textContent = `Hoja ${hoja} de ${estado.doc.numPages}`;
    }, { root: hojas, threshold: [0, 0.25, 0.5, 0.75, 1] });
    for (const f of hojas.querySelectorAll('figure')) observador.observe(f);
    contador.textContent = `Hoja 1 de ${estado.doc.numPages}`;
  }

  function abreDialogo() {
    // En computadora queda abierto junto a la revisión sin quitarle el foco a quien revisa (show() lo movería)
    if (ancho.matches) { if (!d.open) d.setAttribute('open', ''); }
    else if (!d.open) d.showModal();
  }

  async function abre({ url, titulo, archivo }, boton) {
    origen = boton || null;
    $('[data-visor-titulo]').textContent = titulo;
    $('[data-visor-archivo]').textContent = archivo || '';
    $('[data-visor-abrir]').href = url;
    abreDialogo();
    if (url === estado.url && estado.doc) return;
    if (observador) observador.disconnect();
    estado = { doc: null, url, zoom: 2, giro: 0, tarea: estado.tarea + 1 };
    hojas.replaceChildren();
    contador.textContent = '';
    di('Cargando el documento…');
    try {
      const m = await carga();
      const doc = await m.getDocument({ url, standardFontDataUrl: new URL('standard_fonts/', BASE).href }).promise;
      if (estado.url !== url) return;
      estado.doc = doc;
      di('');
      await pinta();
    } catch (e) {
      di('No se pudo mostrar el documento aquí. Ábralo en otra pestaña con el enlace de arriba.');
    }
  }

  /* Barra del visor */
  d.addEventListener('click', (e) => {
    const b = e.target.closest('[data-visor-accion]');
    if (!b) return;
    const a = b.dataset.visorAccion;
    if (a === 'cerrar') { d.close(); return; }
    if (!estado.doc) return;
    if (a === 'acercar') estado.zoom = Math.min(estado.zoom + 1, ZOOMS.length - 1);
    if (a === 'alejar') estado.zoom = Math.max(estado.zoom - 1, 0);
    if (a === 'ajustar') estado.zoom = 2;
    if (a === 'girar') estado.giro = (estado.giro + 90) % 360;
    pinta();
  });
  d.addEventListener('close', () => { if (origen && origen.focus) origen.focus(); });
  /* Al cambiar de computadora a pantalla chica (o al revés), el visor cambia de forma */
  ancho.addEventListener('change', () => { if (d.open) { d.close(); abreDialogo(); } });
  let espera = 0;
  global.addEventListener('resize', () => { clearTimeout(espera); espera = setTimeout(() => { if (d.open && estado.doc) pinta(); }, 250); });

  global.APD_VISOR = { abre, enComputadora: () => ancho.matches };
}(window));
