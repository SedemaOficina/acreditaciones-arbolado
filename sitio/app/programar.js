/* programar.js · Redirección (2026-10-24). «Programar un curso» pasó a ser el paso a paso de «Grupos» (opción B1 de la
   maqueta «Grupos: propuestas de rediseño», decisión de Liber del 24/10/2026: un solo camino para armar un grupo). Esta
   dirección se conserva para los enlaces guardados y lleva a grupos.html con lo que traía:
     · ?curso=poda-nueva → el mismo curso (paso 2, la semana);
     · &semana=AAAA-MM-DD → esa semana elegida, con su mes en el calendario (paso 2);
     · &personas=folio1,folio2 → esas personas marcadas (paso 3, quiénes van);
     · ?grupo=APD-G-… («Elegir semana» o «Cambiar la semana» de un grupo que ya existe) → ese grupo en el paso 2.
   «Grupos» revisa todo como siempre (un curso o una semana que no se puede se dice ahí). Sin JavaScript, el enlace de la
   página lleva a «Grupos». */
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const destino = new URLSearchParams();
  for (const k of ['grupo', 'curso', 'semana', 'personas']) if (params.get(k)) destino.set(k, params.get(k));
  if (destino.get('grupo')) destino.delete('curso');
  if (/^\d{4}-\d{2}-\d{2}$/.test(destino.get('semana') || '')) destino.set('mes', destino.get('semana').slice(0, 7));
  if (destino.get('grupo') || destino.get('curso')) destino.set('paso', destino.get('personas') ? '3' : '2');
  const url = `grupos.html${destino.toString() ? `?${destino.toString()}` : ''}`;
  const enlace = document.querySelector('[data-ir]');
  if (enlace) enlace.href = url;
  location.replace(url);
}());
