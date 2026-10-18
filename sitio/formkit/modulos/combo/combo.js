/* =========================================================
   combo.js · Módulo «combo» · nivel RECOMENDADO

   Lista desplegable con búsqueda (combobox ARIA 1.2) para catálogos largos:
   filtra al escribir sin acentos, flechas, Inicio/Fin, Enter elige, Escape
   cierra, y anuncia cuántos resultados hay. El select nativo y el datalist
   los pinta cada sistema a su manera; aquí hay una sola lista en todo el
   paquete.

   Contrato HTML (dentro de un [data-campo] con data-formato opcional):
     <div class="combo" data-combo data-catalogo="alcaldias">
       <input class="control" id="alcaldia" name="alcaldia" type="text">
       <ul class="combo-lista" hidden></ul>
     </div>
   El catálogo se toma de window.FORMKIT_CATALOGOS[nombre]: un arreglo de
   cadenas o de objetos {nombre, detalle, valor}, o el objeto documentado
   {filas, fuente, corte, es_ficticio} con ese arreglo en filas. Nunca se escribe a mano en
   el código: viene de la fuente oficial que declara codigo/catalogos.

   Modo (decisión C4): cerrado por omisión (sólo valores del catálogo; la
   vía de escape es la opción «Otro»). Con data-libre acepta lo escrito y lo
   dice con un renglón «No está en la lista: se guarda como lo escribiste».
   El servidor debe conocer el modo para rechazar valores fuera de catálogo.
   ========================================================= */
(function () {
  'use strict';
  FormKit.registra('combo', {
    selector: '[data-combo]',
    tipos: {
      combo: {
        detecta: (el) => !!el.querySelector('[data-combo]'),
        controles: (el) => [el.querySelector('[data-combo] input')],
        valorDe: (el) => { const i = el.querySelector('[data-combo] input'); return i ? i.value.trim() : ''; },
        textoDe: (el) => { const i = el.querySelector('[data-combo] input'); return i ? i.value.trim() : ''; },
        enBorrador: true,
        restaura: (el, v) => { const i = el.querySelector('[data-combo] input'); if (i) i.value = v || ''; },
        valida: (el, v) => {
          const wrap = el.querySelector('[data-combo]');
          if (wrap.hasAttribute('data-libre')) return '';
          const lista = catalogo(wrap);
          const n = FormKit.utilidades.normalizaBusqueda(v);
          return lista.some((o) => FormKit.utilidades.normalizaBusqueda(o.nombre) === n) ? '' : FormKit.config.plantilla(FormKit.config.mensajes.soloLista, { etiqueta: el.querySelector('.etiqueta') ? el.querySelector('.etiqueta').textContent.replace(/\*|\(obligatorio\)/g, '').trim() : el.dataset.campo });
        }
      }
    },
    iniciar(form, ctx) {
      const { $, $$, anuncia, plantilla, M, cfg, normalizaBusqueda, limpia, programaBorrador } = ctx;
      for (const wrap of $$('[data-combo]', form)) {
        const campo = wrap.closest('[data-campo]');
        const n = campo.dataset.campo;
        const entrada = $('input', wrap);
        const lista = $('.combo-lista', wrap);
        const opciones = catalogo(wrap);
        const libre = wrap.hasAttribute('data-libre');
        lista.id = lista.id || ctx.idUnico(`lista-${n}`);
        lista.setAttribute('role', 'listbox');
        const etq = $('.etiqueta', campo);
        if (etq) { etq.id = etq.id || ctx.idUnico(`etq-${n}`); lista.setAttribute('aria-labelledby', etq.id); }
        entrada.setAttribute('role', 'combobox');
        entrada.setAttribute('aria-autocomplete', 'list');
        entrada.setAttribute('aria-expanded', 'false');
        entrada.setAttribute('aria-controls', lista.id);
        entrada.autocomplete = 'off';
        let visibles = [];
        let activa = -1;

        function cierra() { lista.hidden = true; entrada.setAttribute('aria-expanded', 'false'); entrada.removeAttribute('aria-activedescendant'); activa = -1; }
        function marcaActiva(k) {
          $$('[role="option"]', lista).forEach((li, i) => li.setAttribute('aria-selected', String(i === k)));
          activa = k;
          const li = k >= 0 ? $(`#${lista.id}-${k}`) : null;
          if (li) { entrada.setAttribute('aria-activedescendant', li.id); li.scrollIntoView({ block: 'nearest' }); } else entrada.removeAttribute('aria-activedescendant');
        }
        function elige(k) {
          const o = visibles[k];
          if (!o) return;
          entrada.value = o.nombre;
          if (o.valor !== undefined) wrap.dataset.valor = o.valor;
          cierra(); limpia(n); programaBorrador();
          entrada.dispatchEvent(new Event('change', { bubbles: true }));
        }
        function pinta() {
          const q = normalizaBusqueda(entrada.value);
          visibles = opciones.filter((o) => normalizaBusqueda(o.nombre).includes(q)).slice(0, cfg.combo.maxResultados);
          lista.textContent = '';
          visibles.forEach((o, i) => {
            const li = document.createElement('li');
            li.className = 'combo-opcion';
            li.id = `${lista.id}-${i}`;
            li.setAttribute('role', 'option');
            li.setAttribute('aria-selected', 'false');
            const nom = document.createElement('span'); nom.className = 'combo-nombre'; nom.textContent = o.nombre; li.appendChild(nom);
            if (o.detalle) { const d = document.createElement('span'); d.className = 'combo-detalle'; d.textContent = o.detalle; li.appendChild(d); }
            lista.appendChild(li);
          });
          if (!visibles.length || (libre && q && !visibles.some((o) => normalizaBusqueda(o.nombre) === q))) {
            const v = document.createElement('li');
            v.className = 'combo-vacio';
            v.setAttribute('role', 'presentation');
            v.textContent = libre && q ? M.comboLibre : plantilla(M.comboNinguno, { texto: entrada.value });
            lista.appendChild(v);
          }
          lista.hidden = false;
          entrada.setAttribute('aria-expanded', 'true');
          marcaActiva(-1);
          anuncia(visibles.length === 0 ? plantilla(M.comboNinguno, { texto: entrada.value }) : visibles.length === 1 ? M.comboUno : plantilla(M.comboVarios, { n: visibles.length }));
        }

        /* Sólo cuando la persona escribe en el campo (P99): si la página lo llena
           (al retomar un borrador), la lista no se abre ni anuncia ni tapa la
           pregunta siguiente. */
        entrada.addEventListener('input', () => { if (document.activeElement === entrada) pinta(); });
        /* Clic (no foco): al llegar desde el resumen de errores la lista no debe tapar el mensaje. */
        entrada.addEventListener('click', () => { if (lista.hidden) pinta(); });
        entrada.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); if (lista.hidden) pinta(); marcaActiva(Math.min(activa + 1, visibles.length - 1)); }
          else if (e.key === 'ArrowUp' && !lista.hidden) { e.preventDefault(); marcaActiva(Math.max(activa - 1, 0)); }
          else if (e.key === 'Home' && !lista.hidden && activa >= 0) { e.preventDefault(); marcaActiva(0); }
          else if (e.key === 'End' && !lista.hidden && activa >= 0) { e.preventDefault(); marcaActiva(visibles.length - 1); }
          else if (e.key === 'Enter' && !lista.hidden) { e.preventDefault(); if (activa >= 0) elige(activa); else cierra(); }
          else if (e.key === 'Escape' && !lista.hidden) { e.preventDefault(); e.stopPropagation(); cierra(); }
        });
        /* mousedown (no click) para que la entrada no pierda el foco antes de elegir. */
        lista.addEventListener('mousedown', (e) => { e.preventDefault(); const li = e.target.closest('[role="option"]'); if (li) elige(Number(li.id.split('-').pop())); });
        entrada.addEventListener('blur', cierra);
      }
    }
  });

  function catalogo(wrap) {
    const cat = (window.FORMKIT_CATALOGOS || {})[wrap.dataset.catalogo];
    const lista = Array.isArray(cat) ? cat : (cat && Array.isArray(cat.filas) ? cat.filas : []);
    const vistos = new Set();
    return lista.map((o) => (typeof o === 'string' ? { nombre: o } : o)).filter((o) => o && o.nombre && !vistos.has(o.nombre) && vistos.add(o.nombre));
  }
}());
