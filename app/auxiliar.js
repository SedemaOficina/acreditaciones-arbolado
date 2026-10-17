/* auxiliar.js · Módulo propio «auxiliar» (contrato de módulos del Estándar de formularios, docs/06 §6)

   Un campo auxiliar no es una pregunta: lo calcula la página y sólo existe para que una validación cruzada
   pueda usarlo. El núcleo no lee controles ocultos (input type="hidden"), así que este tipo declara cómo se
   lee su valor. No tiene controles que enfocar ni marcar, no entra al borrador y no se muestra.

   Contrato HTML:
     <div class="solo-lector" aria-hidden="true" data-campo="x" data-auxiliar data-uso="…">
       <input type="hidden" id="x" name="x" value="">
     </div>
   No viaja al servidor (fueraDeDatos): el servidor calcula el mismo valor por su cuenta. */
(function () {
  'use strict';
  const valor = (el) => { const i = el.querySelector('input'); return i ? String(i.value).trim() : ''; };
  FormKit.registra('auxiliar', {
    selector: '[data-auxiliar]',
    tipos: {
      auxiliar: {
        detecta: (el) => el.hasAttribute('data-auxiliar'),
        controles: () => [],
        valorDe: valor,
        textoDe: valor,
        enBorrador: false,
        fueraDeDatos: true // no viaja: el servidor lo calcula
      }
    }
  });
}());
