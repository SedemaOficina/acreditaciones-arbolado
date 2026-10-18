/* =========================================================
   estado.js · Módulo «estado» · nivel OPCIONAL

   Etiquetas de estado de un trámite o un registro («En revisión»,
   «Validada»). Cinco familias según a quién le toca qué, cada una con su
   tono y su icono:
     ok         · verde · palomita · hecho: validado, aprobado, pagado;
     atencion   · ámbar · alerta   · te toca actuar: corregir, completar,
                                     un borrador sin enviar;
     proceso    · azul  · reloj    · en marcha: en revisión, en trámite;
     rechazo    · rojo  · error    · cerrado sin éxito: rechazado,
                                     cancelado, vencido;
     terminado  · gris  · archivo  · terminado: concluido, archivado.
   La palabra dice el estado; el color y el icono sólo lo refuerzan. Un
   sistema no inventa tonos: cada estado suyo cae en una de las cinco.

   Se inicia solo al cargar la página: a la etiqueta que no trae su icono se
   le pone el de su familia. FormKit.estado(el, { tono, texto, anuncia }) la
   cambia después (anuncia: true cuando cambia por una acción de la persona).

   Contrato HTML:
     <span class="estado estado-proceso">En revisión</span>
   ========================================================= */
(function () {
  'use strict';
  const ICONOS = { ok: 'ok', atencion: 'alerta', proceso: 'reloj', rechazo: 'error', terminado: 'archivo' };
  const tonoDe = (el) => Object.keys(ICONOS).find((t) => el.classList.contains(`estado-${t}`));

  function pinta(el) {
    let tono = tonoDe(el);
    if (!tono) {
      console.warn(`FormKit.estado: a «${el.textContent.trim()}» le falta su familia (estado-ok, estado-atencion, estado-proceso, estado-rechazo o estado-terminado); queda como terminado.`);
      tono = 'terminado';
      el.classList.add('estado-terminado');
    }
    const previo = el.querySelector(':scope > .icono');
    const nuevo = FormKit.icono(ICONOS[tono], 'icono icono-sm');
    if (previo) previo.replaceWith(nuevo); else el.prepend(nuevo);
  }

  function estado(el, { tono, texto, anuncia = false } = {}) {
    if (tono && ICONOS[tono]) {
      for (const t of Object.keys(ICONOS)) el.classList.remove(`estado-${t}`);
      el.classList.add(`estado-${tono}`);
    }
    if (texto !== undefined) el.replaceChildren(document.createTextNode(texto));
    el.classList.add('estado');
    pinta(el);
    if (anuncia) FormKit.anuncia(el.textContent.trim());
    return el;
  }

  /* Las que aún no tienen icono; también sirve para etiquetas que la página pinta después. */
  function inicia(cont = document) {
    for (const el of cont.querySelectorAll('.estado')) if (!el.querySelector(':scope > .icono')) pinta(el);
  }

  FormKit.estado = Object.assign(estado, { inicia });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => inicia()); else inicia();
}());
