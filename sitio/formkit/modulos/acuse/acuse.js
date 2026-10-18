/* =========================================================
   acuse.js · Módulo «acuse» · nivel RECOMENDADO

   Pantalla de acuse al terminar: marca de recibido, folio copiable, fecha,
   «qué sigue» como secuencia y, si el servidor lo da, descarga del acuse.
   El foco va al título del acuse y se anuncia; el borrador ya lo borró el
   núcleo. También muestra la pantalla de límite de envíos (data-limite).

   Contrato HTML (fuera del <form>):
     <section class="tarjeta acuse" data-acuse hidden>
       <div class="acuse-marca" aria-hidden="true">…icono ok…</div>
       <h2 class="titulo-paso" tabindex="-1">Recibimos tu información</h2>
       <div class="acuse-datos">
         <div class="acuse-dato"><span class="acuse-etq">Folio</span>
           <div class="acuse-fila"><span class="acuse-valor" id="folio" data-acuse-folio></span>
             <button type="button" class="btn-enlace" data-copiar="#folio">Copiar folio</button></div></div>
         <div class="acuse-dato"><span class="acuse-etq">Recibido el</span><span data-acuse-fecha></span></div>
       </div>
       <ol class="secuencia">…</ol>
       <a class="btn btn-secundario" data-acuse-descarga hidden download>Descargar acuse (PDF)</a>
     </section>
   La respuesta del servidor debe traer {folio, fecha} y opcionalmente
   {acuseUrl, acusePeso}.
   ========================================================= */
(function () {
  'use strict';
  FormKit.registra('acuse', {
    selector: '[data-acuse]',
    fueraDelFormulario: true,
    iniciar(form, ctx) {
      const { $, cfg, anuncia, opciones } = ctx;
      const sec = $('[data-acuse]');
      const limite = $('[data-limite]');
      if (!sec) return;

      function muestraSolo(destino) {
        for (const s of [form, sec, limite]) if (s) s.hidden = s !== destino;
        const h = $('.titulo-paso', destino);
        if (h) { h.tabIndex = -1; h.focus(); anuncia(h.textContent); }
      }

      function pinta(respuesta) {
        const folio = $('[data-acuse-folio]', sec);
        if (folio) folio.textContent = respuesta.folio || '';
        const fecha = $('[data-acuse-fecha]', sec);
        if (fecha) fecha.textContent = respuesta.fecha ? new Date(respuesta.fecha).toLocaleString(cfg.idioma, { dateStyle: 'long', timeStyle: 'short', timeZone: cfg.fechas.zonaHoraria }) : '';
        const desc = $('[data-acuse-descarga]', sec);
        if (desc) {
          desc.hidden = !respuesta.acuseUrl;
          if (respuesta.acuseUrl) { desc.href = respuesta.acuseUrl; desc.download = respuesta.acuseNombre || `acuse-${respuesta.folio || ''}.pdf`; if (respuesta.acusePeso) { const peso = $('[data-acuse-peso]', desc); if (peso) peso.textContent = respuesta.acusePeso; } }
        }
        muestraSolo(sec);
      }

      /* Si la página define alEnviar o alFallar, se respeta y se encadena. Se
         lee al enviar, no al iniciar: así vale también el que la página pase
         después en otra llamada a FormKit.iniciar. */
      const dePagina = (k) => (ctx.opcionesPagina || {})[k];
      opciones.alEnviar = (r, f) => { const previo = dePagina('alEnviar'); if (previo) previo(r, f); pinta(r); };
      opciones.alFallar = (e, f) => { const previo = dePagina('alFallar'); if (previo) previo(e, f); if (e && e.limite && limite) muestraSolo(limite); };

      /* «Volver» desde la pantalla de límite devuelve al formulario donde estaba. */
      if (limite) limite.addEventListener('click', (e) => { if (e.target.closest('[data-accion="reintentar"]')) muestraSolo(form); });

      FormKit.acuse = { pinta, muestraSolo };
    }
  });
}());
