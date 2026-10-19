/* =========================================================
   tabla.js · Módulo «tabla» · nivel OPCIONAL

   Tabla de consulta y tabla de captura. Lo que el CSS no puede hacer solo:
     · en teléfono cada celda muestra su encabezado (data-etiqueta) para que
       la tabla se lea como tarjetas apiladas; el módulo lo copia de <th>;
     · orden accesible por columna: botones en <th> con aria-sort;
     · estados vacío, de carga y de error con mensajes útiles;
     · acciones por fila con nombre accesible que identifica la fila.
   La tabla de captura (filas editables) es el módulo «repetibles» con la
   clase .tabla-captura: aquí sólo se le da forma.

   Se inicia solo al cargar la página, haya o no formulario (una página de
   pura consulta también lo usa). Cuando la página pinta o vuelve a pintar
   filas o encabezados, avisa con el evento formkit:tabla en el [data-tabla]:
   el módulo vuelve a leer los encabezados y a preparar las celdas.

   Contrato HTML:
     <div class="tabla-marco" data-tabla data-clave="folio">
       <table class="tabla"><caption class="tabla-titulo">Solicitudes</caption>
         <thead><tr><th scope="col" data-ordenable>Folio</th>…<th scope="col">Acciones</th></tr></thead>
         <tbody><tr data-folio="EJ-123"><td><span class="mono">EJ-123</span></td>…<td><button type="button" class="btn-icono" data-accion-fila="ver">…</button></td></tr></tbody>
       </table>
       <p class="tabla-vacia" data-tabla-vacia hidden>No hay resultados con esos filtros.</p>
       <p data-tabla-cargando hidden>Cargando…</p>
       <div class="aviso aviso-bloqueo" data-tabla-error tabindex="-1" hidden>…<div class="aviso-texto"></div></div>
     </div>
   Una celda con data-etiqueta escrito en el HTML conserva ese rótulo. El
   contenido de cada celda va en .tabla-valor (lo pone el módulo). En
   computadora no se parten botones, folios (.mono) ni etiquetas, y la
   columna de acciones (encabezado sólo para el lector) toma el ancho de sus
   botones. Desde código: FormKit.tabla.inicia() para tablas agregadas
   después y FormKit.tabla.estado(marco, 'cargando' | 'error' | '', texto).
   ========================================================= */
(function () {
  'use strict';
  const { $, $$, plantilla } = FormKit.utilidades;
  /* Un encabezado cuyo texto es sólo para el lector de pantalla (.solo-lector) no se muestra en teléfono. */
  const soloLector = (th) => { const c = th.cloneNode(true); for (const s of $$('.solo-lector', c)) s.remove(); return !c.textContent.trim(); };
  const textoDe = (th) => th.textContent.replace(/\s+/g, ' ').trim();

  function prepara(marco) {
    const tabla = $('table', marco);
    if (!tabla) return;
    const M = FormKit.config.mensajes;
    const clave = marco.dataset.clave;
    const ths = () => $$('thead th', tabla);

    /* Rótulos de las celdas, leídos de los encabezados actuales cada vez: si la
       página los pinta después (un encabezado calculado), se actualizan. Los
       que puso el módulo llevan data-etiqueta-auto; los del HTML no se tocan. */
    function etiquetaCeldas() {
      const encabezados = ths();
      for (const tr of $$('tbody tr', tabla)) $$('td', tr).forEach((td, i) => {
        /* El contenido de la celda va junto en .tabla-valor: en teléfono es la columna del valor. */
        if (!(td.children.length === 1 && td.firstElementChild.classList.contains('tabla-valor') && td.childNodes.length === 1)) {
          const valor = document.createElement('div');
          valor.className = 'tabla-valor';
          valor.append(...td.childNodes);
          td.appendChild(valor);
        }
        const th = encabezados[i];
        if (!th || (td.dataset.etiqueta !== undefined && td.dataset.etiquetaAuto === undefined)) return;
        td.dataset.etiqueta = textoDe(th);
        td.dataset.etiquetaAuto = '';
        td.toggleAttribute('data-etiqueta-oculta', soloLector(th));
      });
      /* Acciones por fila: «Ver», no basta; «Ver solicitud 123» sí. */
      for (const tr of $$('tbody tr', tabla)) {
        const id = clave ? (tr.dataset[clave] || ($$('td', tr)[encabezados.findIndex((t) => textoDe(t).toLowerCase() === clave)] || {}).textContent) : '';
        for (const b of $$('[data-accion-fila]', tr)) if (!b.getAttribute('aria-label')) b.setAttribute('aria-label', `${b.textContent.trim() || b.dataset.accionFila} ${id || ''}`.trim());
      }
      const vacio = $('[data-tabla-vacia]', marco);
      if (vacio) vacio.hidden = $$('tbody tr', tabla).length > 0;
    }

    /* Orden por columna: botón dentro del th, aria-sort en el th. Un
       encabezado que todavía no tiene texto se prepara cuando lo tenga. */
    function preparaOrden() {
      ths().forEach((th, i) => {
        if (!th.hasAttribute('data-ordenable') || $('.tabla-orden', th)) return;
        const texto = textoDe(th);
        if (!texto) return;
        th.textContent = '';
        const b = document.createElement('button'); b.type = 'button'; b.className = 'tabla-orden';
        b.append(document.createTextNode(texto), FormKit.icono('abajo', 'icono icono-sm tabla-orden-icono'));
        th.appendChild(b);
        th.setAttribute('aria-sort', 'none');
        b.addEventListener('click', () => {
          const asc = th.getAttribute('aria-sort') !== 'ascending';
          for (const o of ths()) o.setAttribute('aria-sort', o === th ? (asc ? 'ascending' : 'descending') : 'none');
          const filas = $$('tbody tr', tabla);
          const val = (tr) => { const td = $$('td', tr)[i]; const t = td ? td.textContent.trim() : ''; const n = Number(t.replace(/[^\d.-]/g, '')); return t && !Number.isNaN(n) && /^[\d.,\s$-]+$/.test(t) ? n : t.toLowerCase(); };
          filas.sort((a, b2) => { const x = val(a), y = val(b2); return (x > y ? 1 : x < y ? -1 : 0) * (asc ? 1 : -1); });
          const tb = $('tbody', tabla); for (const f of filas) tb.appendChild(f);
          FormKit.anuncia(plantilla(M.tablaOrdenada, { columna: texto, sentido: asc ? M.tablaAscendente : M.tablaDescendente }));
        });
      });
    }

    const repinta = () => { preparaOrden(); etiquetaCeldas(); };
    repinta();
    marco.addEventListener('formkit:tabla', repinta);
  }

  /* Una sola vez por tabla, desde la carga o desde el primer formulario que la vea. */
  function iniciaTablas() {
    for (const marco of $$('[data-tabla]')) {
      if (marco.dataset.listo !== undefined) continue;
      marco.dataset.listo = '';
      prepara(marco);
    }
  }

  FormKit.tabla = Object.assign(FormKit.tabla || {}, {
    /* Estados de carga y error: el contenido se oculta y se anuncia qué pasa. */
    estado(m, estado, texto) {
      const car = $('[data-tabla-cargando]', m), err = $('[data-tabla-error]', m), t = $('table', m);
      if (car) car.hidden = estado !== 'cargando';
      if (err) { err.hidden = estado !== 'error'; if (texto) $('.aviso-texto', err).textContent = texto; }
      if (t) t.toggleAttribute('aria-busy', estado === 'cargando');
      if (estado === 'error' && err) err.focus();
    },
    /* Para tablas que la página agrega después de cargar. */
    inicia: iniciaTablas
  });
  FormKit.registra('tabla', { selector: '[data-tabla]', fueraDelFormulario: true, iniciar: iniciaTablas });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciaTablas); else iniciaTablas();
}());
