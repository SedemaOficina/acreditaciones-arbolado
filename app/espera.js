/* espera.js · Redirección (2026-10-18). «En espera» de un curso pasó a «Grupos», el planeador por curso (propuesta A,
   aprobada por Liber): a la izquierda quién espera, a la derecha las próximas semanas. Esta dirección se conserva para
   los enlaces guardados y lleva a grupos.html con el mismo curso (?curso=) y, si se llegó desde la ficha de un grupo
   para completarlo, con ese grupo (?grupo=). Sin JavaScript, el enlace de la página lleva a «Grupos». */
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const destino = new URLSearchParams();
  for (const k of ['curso', 'grupo']) if (params.get(k)) destino.set(k, params.get(k));
  const url = `grupos.html${destino.toString() ? `?${destino.toString()}` : ''}`;
  const enlace = document.querySelector('[data-ir]');
  if (enlace) enlace.href = url;
  location.replace(url);
}());
