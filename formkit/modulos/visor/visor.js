/* =========================================================
   visor.js · Módulo «visor» · nivel OPCIONAL

   Visor de documentos para quien revisa lo que se cargó: muestra TODAS las
   hojas de un PDF, una debajo de otra, con contador de hoja, acercar y
   alejar, ajustar al ancho, girar y abrir en otra pestaña; también muestra
   imágenes (JPEG, PNG). En computadora (FORMKIT_CONFIG.visor.fijoDesde,
   1024 px) queda fijo junto a lo que se revisa, para decidir viendo el
   documento; en pantallas más chicas se abre a pantalla completa como
   diálogo (Escape cierra y el foco vuelve al botón que lo abrió).

   Usa pdf.js (vendor/pdfjs-dist, sin CDN) y lo carga sólo al abrir el
   primer PDF. Si no se puede cargar (por ejemplo, la página se abrió con
   doble clic, sin servidor), muestra el documento con el visor del
   navegador y lo dice.

   Contrato HTML (el visor va junto a lo que se revisa, en .visor-area):
     <div class="visor-area">
       <div>… <button type="button" class="btn-enlace" data-visor-url="docs/ine.pdf"
                 data-visor-titulo="Identificación oficial" data-visor-archivo="ine.pdf">Ver documento</button> …</div>
       <dialog class="visor" data-visor aria-labelledby="visor-titulo">
         <div class="visor-cabeza">
           <div class="visor-nombre"><h3 class="visor-titulo" id="visor-titulo" data-visor-titulo>Documento</h3>
             <p class="visor-archivo mono" data-visor-archivo></p></div>
           <button type="button" class="btn-enlace visor-cerrar" data-visor-accion="cerrar">Cerrar</button>
         </div>
         <div class="visor-barra" role="toolbar" aria-label="Herramientas del visor">
           <button type="button" class="btn btn-secundario" data-visor-accion="alejar" aria-label="Alejar"><span class="visor-paso" aria-hidden="true">−</span></button>
           <output class="visor-zoom" data-visor-zoom aria-live="polite">100 %</output>
           <button type="button" class="btn btn-secundario" data-visor-accion="acercar" aria-label="Acercar"><span class="visor-paso" aria-hidden="true">+</span></button>
           <button type="button" class="btn btn-secundario" data-visor-accion="ajustar">Ajustar al ancho</button>
           <button type="button" class="btn btn-secundario" data-visor-accion="girar">Girar</button>
           <a class="btn-enlace visor-abrir" data-visor-abrir href="#" target="_blank" rel="noopener">Abrir en otra pestaña …</a>
         </div>
         <p class="visor-pagina" data-visor-pagina aria-live="polite"></p>
         <p class="aviso visor-aviso" data-visor-aviso hidden></p>
         <div class="visor-hojas" data-visor-hojas tabindex="0" aria-label="Hojas del documento"></div>
         <p class="visor-nota" data-visor-nota hidden></p>
       </dialog>
     </div>
   Desde código: FormKit.visor.abre({ url, titulo, archivo, tipo, nota }, boton).
   Para una imagen sin extensión en la dirección (blob:), data-visor-tipo="image/png".
   Tomado del sistema de acreditaciones (P67).
   ========================================================= */
(function (global) {
  'use strict';
  /* Acercamientos: la hoja de estilos da el ancho de cada uno (data-zoom), sin estilos en línea. */
  const ZOOMS = [0.5, 0.75, 1, 1.25, 1.5, 2, 3];
  const AJUSTAR = 2; /* 100 %: la hoja al ancho del visor */
  /* La carpeta de pdf.js va junto al paquete: se deduce de dónde se cargó este
     archivo (codigo/modulos/visor/visor.js o dist/formkit.js). */
  const src = document.currentScript && document.currentScript.src;
  const raiz = src && src.match(/^(.*\/)(?:codigo\/modulos\/visor\/visor|dist\/formkit)\.js(?:\?.*)?$/);
  const PDFJS_JUNTO = raiz ? `${raiz[1]}vendor/pdfjs-dist/` : '';

  let listo = false;
  let pdfjs = null;
  let d, hojas, aviso, contador, ancho, cfg, M;
  let estado = { doc: null, imagen: false, url: '', zoom: AJUSTAR, giro: 0, tarea: 0 };
  let origen = null;
  let observador = null;

  const base = () => { const r = cfg.visor.pdfjs || PDFJS_JUNTO || 'vendor/pdfjs-dist/'; return new URL(r.endsWith('/') ? r : `${r}/`, document.baseURI).href; };
  const di = (texto) => { aviso.textContent = texto; aviso.hidden = !texto; };
  const hoja = (n, total) => FormKit.utilidades.plantilla(M.visorHoja, { n, total });
  const esImagen = (tipo, nombre) => /^image\//.test(tipo || '') || /\.(jpe?g|png|webp|gif)(\?.*)?$/i.test(nombre || '');

  function carga() {
    if (pdfjs) return Promise.resolve(pdfjs);
    return import(new URL('pdf.min.mjs', base()).href).then((m) => {
      m.GlobalWorkerOptions.workerSrc = new URL('pdf.worker.min.mjs', base()).href;
      pdfjs = m;
      return m;
    });
  }

  /* Pinta todas las hojas al ancho disponible por el acercamiento elegido. */
  async function pinta() {
    const tarea = ++estado.tarea;
    const factor = ZOOMS[estado.zoom];
    d.querySelector('[data-visor-zoom]').textContent = `${Math.round(factor * 100)} %`;
    if (estado.imagen) {
      hojas.dataset.zoom = String(Math.round(factor * 100));
      const img = hojas.querySelector('img');
      if (img) img.dataset.giro = String(estado.giro);
      return;
    }
    const doc = estado.doc;
    if (!doc) return;
    const disponible = Math.max(hojas.clientWidth - 2 * parseFloat(getComputedStyle(hojas).paddingLeft || 0), 1);
    const dpr = global.devicePixelRatio || 1;
    const figuras = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const pagina = await doc.getPage(n);
      if (tarea !== estado.tarea) return; /* llegó otro documento u otro acercamiento */
      const giro = (pagina.rotate + estado.giro) % 360;
      const medida = pagina.getViewport({ scale: 1, rotation: giro });
      const vista = pagina.getViewport({ scale: ((disponible * factor) / medida.width) * dpr, rotation: giro });
      const lienzo = document.createElement('canvas');
      lienzo.width = Math.floor(vista.width);
      lienzo.height = Math.floor(vista.height);
      lienzo.className = 'visor-lienzo';
      lienzo.setAttribute('role', 'img');
      lienzo.setAttribute('aria-label', hoja(n, doc.numPages));
      const fig = document.createElement('figure');
      fig.className = 'visor-hoja-pdf';
      fig.dataset.hoja = String(n);
      const pie = document.createElement('figcaption');
      pie.className = 'visor-pie';
      pie.textContent = hoja(n, doc.numPages);
      fig.append(lienzo, pie);
      figuras.push(fig);
      await pagina.render({ canvasContext: lienzo.getContext('2d'), viewport: vista }).promise;
    }
    if (tarea !== estado.tarea) return;
    hojas.replaceChildren(...figuras);
    hojas.dataset.zoom = String(Math.round(factor * 100));
    observa();
  }

  /* Contador: la hoja que más se ve. */
  function observa() {
    if (observador) observador.disconnect();
    const visibles = new Map();
    observador = new IntersectionObserver((entradas) => {
      if (!estado.doc) return;
      for (const e of entradas) visibles.set(e.target.dataset.hoja, e.intersectionRatio);
      const [h] = [...visibles.entries()].sort((a, b) => b[1] - a[1])[0] || ['1'];
      contador.textContent = hoja(h, estado.doc.numPages);
    }, { root: hojas, threshold: [0, 0.25, 0.5, 0.75, 1] });
    for (const f of hojas.querySelectorAll('figure')) observador.observe(f);
    contador.textContent = hoja(1, estado.doc.numPages);
  }

  /* En computadora queda abierto junto a lo que se revisa sin quitarle el foco a quien revisa (show() lo movería). */
  function abreDialogo() {
    if (ancho.matches) { if (!d.open) d.setAttribute('open', ''); } else if (!d.open) d.showModal();
  }

  /* Si pdf.js no se pudo cargar, el documento se muestra con el visor del navegador. */
  function enNavegador(url, titulo) {
    const marco = document.createElement('iframe');
    marco.className = 'visor-marco';
    marco.src = url;
    marco.title = titulo;
    hojas.replaceChildren(marco);
    di(M.visorNavegador);
  }

  async function abre({ url, titulo = 'Documento', archivo = '', tipo = '', nota = '' }, boton) {
    if (!prepara()) return;
    origen = boton || null;
    d.querySelector('[data-visor-titulo]').textContent = titulo;
    d.querySelector('[data-visor-archivo]').textContent = archivo;
    d.querySelector('[data-visor-abrir]').href = url;
    const n = d.querySelector('[data-visor-nota]');
    if (n) { n.textContent = nota; n.hidden = !nota; }
    abreDialogo();
    if (url === estado.url && (estado.doc || estado.imagen)) return;
    if (observador) observador.disconnect();
    estado = { doc: null, imagen: false, url, zoom: AJUSTAR, giro: 0, tarea: estado.tarea + 1 };
    hojas.replaceChildren();
    contador.textContent = '';
    if (esImagen(tipo, archivo || url)) {
      estado.imagen = true;
      const img = document.createElement('img');
      img.className = 'visor-lienzo visor-imagen';
      img.alt = titulo;
      img.src = url;
      hojas.replaceChildren(img);
      di('');
      pinta();
      return;
    }
    di(M.visorCargando);
    let m;
    try { m = await carga(); } catch (e) { if (estado.url === url) enNavegador(url, titulo); return; }
    try {
      const doc = await m.getDocument({ url, standardFontDataUrl: new URL('standard_fonts/', base()).href, isEvalSupported: false }).promise;
      if (estado.url !== url) return;
      estado.doc = doc;
      di('');
      await pinta();
    } catch (e) {
      if (estado.url === url) di(M.visorError);
    }
  }

  function prepara() {
    if (listo) return Boolean(d);
    listo = true;
    d = document.querySelector('[data-visor]');
    if (!d) return false;
    cfg = FormKit.config;
    M = cfg.mensajes;
    hojas = d.querySelector('[data-visor-hojas]');
    aviso = d.querySelector('[data-visor-aviso]');
    contador = d.querySelector('[data-visor-pagina]');
    ancho = global.matchMedia(cfg.visor.fijoDesde);

    /* Botones que abren un documento, en cualquier parte de la página. */
    document.addEventListener('click', (e) => {
      const b = e.target.closest('[data-visor-url]');
      if (!b) return;
      e.preventDefault();
      abre({ url: b.dataset.visorUrl, titulo: b.dataset.visorTitulo || b.textContent.trim(), archivo: b.dataset.visorArchivo || '', tipo: b.dataset.visorTipo || '' }, b);
    });
    /* Barra del visor. */
    d.addEventListener('click', (e) => {
      const b = e.target.closest('[data-visor-accion]');
      if (!b) return;
      const a = b.dataset.visorAccion;
      if (a === 'cerrar') { d.close(); return; }
      if (!estado.doc && !estado.imagen) return;
      if (a === 'acercar') estado.zoom = Math.min(estado.zoom + 1, ZOOMS.length - 1);
      if (a === 'alejar') estado.zoom = Math.max(estado.zoom - 1, 0);
      if (a === 'ajustar') estado.zoom = AJUSTAR;
      if (a === 'girar') estado.giro = (estado.giro + 90) % 360;
      pinta();
    });
    d.addEventListener('close', () => { if (origen && origen.focus) origen.focus(); });
    /* Al pasar de computadora a pantalla chica (o al revés), el visor cambia de forma. */
    ancho.addEventListener('change', () => { if (d.open) { d.close(); abreDialogo(); } });
    let espera = 0;
    global.addEventListener('resize', () => { clearTimeout(espera); espera = setTimeout(() => { if (d.open && estado.doc) pinta(); }, cfg.visor.retardoMs); });
    return true;
  }

  FormKit.registra('visor', { selector: '[data-visor],[data-visor-url]', fueraDelFormulario: true, iniciar() { prepara(); } });
  document.addEventListener('DOMContentLoaded', prepara);
  FormKit.visor = { abre, enComputadora: () => prepara() && ancho.matches };
}(window));
