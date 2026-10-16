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

   Contrato HTML:
     <div class="tabla-marco" data-tabla data-clave="folio">
       <table class="tabla"><caption class="tabla-titulo">Solicitudes</caption>
         <thead><tr><th scope="col" data-ordenable>Folio</th>…<th scope="col">Acciones</th></tr></thead>
         <tbody>…<td><button type="button" class="btn-icono" data-accion-fila="ver">…</button></td></tr></tbody>
       </table>
       <p class="tabla-vacia" data-tabla-vacia hidden>No hay resultados con esos filtros.</p>
     </div>
   ========================================================= */
(function () {
  'use strict';
  FormKit.registra('tabla', {
    selector: '[data-tabla]',
    fueraDelFormulario: true,
    iniciar(form, ctx) {
      const { $, $$, anuncia, icono } = ctx;
      for (const marco of $$('[data-tabla]')) {
        const tabla = $('table', marco);
        if (!tabla || marco.dataset.listo !== undefined) continue; /* ya iniciada por otro formulario de la página */
        marco.dataset.listo = '';
        const ths = $$('thead th', tabla);
        const clave = marco.dataset.clave;

        function etiquetaCeldas() {
          for (const tr of $$('tbody tr', tabla)) $$('td', tr).forEach((td, i) => { if (ths[i] && !td.dataset.etiqueta) td.dataset.etiqueta = ths[i].textContent.trim(); });
          /* Acciones por fila: «Ver», no basta; «Ver solicitud 123» sí. */
          for (const tr of $$('tbody tr', tabla)) {
            const id = clave ? (tr.dataset[clave] || ($$('td', tr)[ths.findIndex((t) => t.textContent.trim().toLowerCase() === clave)] || {}).textContent) : '';
            for (const b of $$('[data-accion-fila]', tr)) if (!b.getAttribute('aria-label')) b.setAttribute('aria-label', `${b.textContent.trim() || b.dataset.accionFila} ${id || ''}`.trim());
          }
          const vacio = $('[data-tabla-vacia]', marco);
          if (vacio) vacio.hidden = $$('tbody tr', tabla).length > 0;
        }

        /* Orden por columna: botón dentro del th, aria-sort en el th. */
        ths.forEach((th, i) => {
          if (!th.hasAttribute('data-ordenable')) return;
          const texto = th.textContent.trim();
          th.textContent = '';
          const b = document.createElement('button'); b.type = 'button'; b.className = 'tabla-orden';
          b.append(document.createTextNode(texto), icono('abajo', 'icono icono-sm tabla-orden-icono'));
          th.appendChild(b);
          th.setAttribute('aria-sort', 'none');
          b.addEventListener('click', () => {
            const asc = th.getAttribute('aria-sort') !== 'ascending';
            for (const o of ths) o.setAttribute('aria-sort', o === th ? (asc ? 'ascending' : 'descending') : 'none');
            const filas = $$('tbody tr', tabla);
            const val = (tr) => { const td = $$('td', tr)[i]; const t = td ? td.textContent.trim() : ''; const n = Number(t.replace(/[^\d.-]/g, '')); return t && !Number.isNaN(n) && /^[\d.,\s$-]+$/.test(t) ? n : t.toLowerCase(); };
            filas.sort((a, b2) => { const x = val(a), y = val(b2); return (x > y ? 1 : x < y ? -1 : 0) * (asc ? 1 : -1); });
            const tb = $('tbody', tabla); for (const f of filas) tb.appendChild(f);
            anuncia(`Ordenado por ${texto}, ${asc ? 'ascendente' : 'descendente'}.`);
          });
        });

        etiquetaCeldas();
        marco.addEventListener('formkit:tabla', etiquetaCeldas);
        FormKit.tabla = Object.assign(FormKit.tabla || {}, {
          /* Estados de carga y error: el contenido se oculta y se anuncia qué pasa. */
          estado(m, estado, texto) {
            const car = $('[data-tabla-cargando]', m), err = $('[data-tabla-error]', m), t = $('table', m);
            if (car) car.hidden = estado !== 'cargando';
            if (err) { err.hidden = estado !== 'error'; if (texto) $('.aviso-texto', err).textContent = texto; }
            if (t) t.toggleAttribute('aria-busy', estado === 'cargando');
            if (estado === 'error' && err) err.focus();
          }
        });
      }
    }
  });
}());
