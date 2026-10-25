/* =========================================================
   pestanas.js · Módulo «pestanas» · nivel OPCIONAL

   Pestañas (patrón ARIA tabs): una lista de botones con role="tab" y un
   panel por pestaña. Teclado: flechas izquierda/derecha mueven y activan,
   Inicio/Fin saltan a los extremos; sólo la pestaña activa está en el orden
   de tabulación (tabindex rotatorio). CUÁNDO: vistas alternativas del mismo
   contenido (consulta interna, ayuda). CUÁNDO NO: para dividir un
   formulario en partes que deben llenarse todas —eso son pasos—, porque lo
   que está en una pestaña no activa pasa inadvertido.

   Contrato HTML:
     <div class="pestanas" data-pestanas>
       <div class="pestanas-lista" role="tablist" aria-label="Vistas">
         <button type="button" class="pestana" role="tab" id="p1" aria-controls="panel1" aria-selected="true">Datos</button>
         <button type="button" class="pestana" role="tab" id="p2" aria-controls="panel2" aria-selected="false" tabindex="-1">Historial</button>
       </div>
       <div class="pestanas-panel" role="tabpanel" id="panel1" aria-labelledby="p1" tabindex="0">…</div>
       <div class="pestanas-panel" role="tabpanel" id="panel2" aria-labelledby="p2" tabindex="0" hidden>…</div>
     </div>
   ========================================================= */
(function () {
  'use strict';
  FormKit.registra('pestanas', {
    selector: '[data-pestanas]',
    fueraDelFormulario: true,
    iniciar(form, ctx) {
      const { $$, anuncia } = ctx;
      for (const cont of $$('[data-pestanas]')) {
        if (cont.dataset.listo !== undefined) continue; /* ya iniciado por otro formulario de la página */
        cont.dataset.listo = '';
        const tabs = $$('[role="tab"]', cont);
        const activa = (tab, foco = true) => {
          for (const t of tabs) {
            const es = t === tab;
            t.setAttribute('aria-selected', String(es));
            t.tabIndex = es ? 0 : -1;
            const panel = document.getElementById(t.getAttribute('aria-controls'));
            if (panel) panel.hidden = !es;
          }
          if (foco) tab.focus();
          anuncia(FormKit.utilidades.plantilla(FormKit.config.mensajes.pestanaAnuncio, { nombre: tab.textContent.trim() }));
        };
        cont.addEventListener('click', (e) => { const t = e.target.closest('[role="tab"]'); if (t && tabs.includes(t)) activa(t, false); });
        cont.addEventListener('keydown', (e) => {
          const t = e.target.closest('[role="tab"]');
          if (!t) return;
          const i = tabs.indexOf(t);
          const mapa = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 };
          if (!(e.key in mapa)) return;
          e.preventDefault();
          activa(tabs[(mapa[e.key] + tabs.length) % tabs.length]);
        });
        const inicial = tabs.find((t) => t.getAttribute('aria-selected') === 'true') || tabs[0];
        if (inicial) activa(inicial, false);
      }
    }
  });
}());
