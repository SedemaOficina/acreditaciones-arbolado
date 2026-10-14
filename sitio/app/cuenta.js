/* cuenta.js · Vuelve a comprobar la CURP cuando cambia un dato con el que se compara.

   El núcleo del estándar valida las cruzadas al salir del campo que las declara (aquí, la CURP) y sólo
   repite la comprobación si ese campo ya mostraba un error de cruzada. Si la persona escribe primero la
   CURP y después corrige o cambia su nombre, apellidos o fecha, la discrepancia no se vería hasta enviar.
   Esto le avisa en el momento: al salir de esos campos (o al cambiar la fecha o la respuesta sobre el
   segundo apellido), si la CURP ya tiene valor, se le pide al núcleo que la valide de nuevo como si la
   persona saliera de ella. Hallazgo reportado al estándar. */
(function () {
  'use strict';
  const form = document.getElementById('formulario');
  const curp = document.getElementById('curp');
  if (!form || !curp) return;
  const RELACIONADOS = ['nombre', 'primer_apellido', 'segundo_apellido', 'tiene_segundo_apellido', 'fecha_nacimiento'];
  const revalida = (e) => {
    const campo = e.target.closest('[data-campo]');
    if (!campo || !RELACIONADOS.includes(campo.dataset.campo) || !curp.value.trim()) return;
    curp.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  };
  form.addEventListener('focusout', (e) => { if (e.target !== curp) revalida(e); });
  form.addEventListener('change', revalida);
}());
