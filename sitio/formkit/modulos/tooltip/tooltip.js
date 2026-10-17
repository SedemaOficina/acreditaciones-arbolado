/* =========================================================
   tooltip.js · Módulo «tooltip» · nivel OPCIONAL

   Ayuda desplegable junto a una etiqueta: un botón «?» con nombre
   accesible que muestra y oculta un texto corto. Se abre con clic o toque y
   con Enter/espacio (no sólo al pasar el cursor, que el dedo no tiene);
   Escape lo cierra; el texto queda enlazado al botón con aria-describedby
   mientras está abierto. CUÁNDO NO: para instrucciones necesarias para
   llenar el campo (van en la ayuda visible), para repetir lo que la ayuda
   visible ya dice (si basta, no hay ícono; auditar-campos D5) ni para
   textos largos.

     <span class="tooltip" data-tooltip>
       <button type="button" class="btn-icono tooltip-btn" aria-expanded="false" aria-label="Ayuda sobre el folio">
         <svg class="icono icono-sm" aria-hidden="true"><use href="#i-ayuda"></use></svg></button>
       <span class="tooltip-texto" role="tooltip" hidden>El folio aparece en la esquina superior de tu acuse.</span>
     </span>
   ========================================================= */
(function () {
  'use strict';
  FormKit.registra('tooltip', {
    selector: '[data-tooltip]',
    fueraDelFormulario: true,
    iniciar(form, ctx) {
      const { $$ } = ctx;
      /* La lista se lee al momento: los tooltips que otro formulario de la
         misma página agregue después también se cierran con Escape o clic fuera. */
      const todos = () => $$('[data-tooltip]');
      for (const t of todos()) {
        const b = t.querySelector('button'); const txt = t.querySelector('.tooltip-texto');
        if (!b || !txt || t.dataset.listo !== undefined) continue;
        t.dataset.listo = '';
        txt.id = txt.id || FormKit.utilidades.idUnico('tt');
        b.addEventListener('click', () => pon(t, txt.hidden));
      }
      function pon(t, abrir) {
        const b = t.querySelector('button'); const txt = t.querySelector('.tooltip-texto');
        if (abrir) for (const o of todos()) if (o !== t) pon(o, false);
        txt.hidden = !abrir;
        b.setAttribute('aria-expanded', String(abrir));
        if (abrir) b.setAttribute('aria-describedby', txt.id); else b.removeAttribute('aria-describedby');
      }
      if (document.documentElement.dataset.tooltipListo !== undefined) return;
      document.documentElement.dataset.tooltipListo = '';
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') for (const t of todos()) if (!t.querySelector('.tooltip-texto').hidden) { pon(t, false); t.querySelector('button').focus(); } });
      document.addEventListener('click', (e) => { if (!e.target.closest('[data-tooltip]')) for (const t of todos()) pon(t, false); });
    }
  });
}());
