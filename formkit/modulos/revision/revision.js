/* =========================================================
   revision.js · Módulo «revision» · nivel RECOMENDADO

   Pantalla de revisión antes de enviar: un bloque plegable por paso con el
   resumen de una línea y el detalle dentro; cada dato con «Editar», que
   aterriza en el campo (no al inicio del paso). Los identificadores con
   data-enmascara se muestran parcialmente ocultos.

   Contrato HTML (último paso del formulario):
     <section class="tarjeta" data-paso data-revision data-titulo="Revisión" hidden>
       <h2 class="titulo-paso">Revisa antes de enviar</h2>
       <div data-revision-lista></div> …
   Depende de: pasos.js (y de su evento formkit:paso).
   ========================================================= */
(function () {
  'use strict';
  FormKit.registra('revision', {
    selector: '[data-revision]',
    iniciar(form, ctx) {
      const { $, $$, M, envoltura, etiquetaDe, textoDeValor, activo, icono } = ctx;
      const sec = $('[data-revision]', form);
      const dest = $('[data-revision-lista]', sec);
      const pasos = $$('[data-paso]', form);

      function texto(n) {
        const el = envoltura(n);
        const t = textoDeValor(n);
        return el.hasAttribute('data-enmascara') && FormKit.enmascara ? FormKit.enmascara(t) : t;
      }

      function pinta() {
        dest.textContent = '';
        pasos.forEach((p) => {
          if (p === sec) return;
          const nombres = $$('[data-campo]', p).map((e) => e.dataset.campo).filter(activo);
          if (!nombres.length) return;
          const det = document.createElement('details');
          det.className = 'rev-bloque';
          det.open = true;
          const sum = document.createElement('summary');
          sum.className = 'rev-titulo';
          const rot = document.createElement('span'); rot.className = 'rev-rotulo'; rot.textContent = p.dataset.titulo;
          const res = document.createElement('span'); res.className = 'rev-resumen';
          res.textContent = nombres.map(texto).filter(Boolean).slice(0, 2).join(' · ') || M.sinValor;
          sum.append(rot, res, icono('abajo', 'icono rev-flecha'));
          const dl = document.createElement('dl');
          dl.className = 'rev-datos';
          for (const n of nombres) {
            const dt = document.createElement('dt'); dt.className = 'rev-dato-etq'; dt.textContent = etiquetaDe(n);
            const dd = document.createElement('dd'); dd.className = 'rev-dato-valor';
            const val = document.createElement('span'); val.textContent = texto(n) || M.sinValor;
            const ed = document.createElement('button');
            ed.type = 'button'; ed.className = 'btn-enlace'; ed.dataset.editar = n;
            ed.append(icono('editar', 'icono icono-sm'), document.createTextNode(M.editar));
            const oculto = document.createElement('span'); oculto.className = 'solo-lector'; oculto.textContent = ` ${etiquetaDe(n)}`;
            ed.appendChild(oculto);
            dd.append(val, ed);
            dl.append(dt, dd);
          }
          det.append(sum, dl);
          dest.appendChild(det);
        });
      }
      form.addEventListener('formkit:paso', (e) => { if (e.detail.paso === sec) pinta(); });
      FormKit.revision = { pinta };
    }
  });
}());
