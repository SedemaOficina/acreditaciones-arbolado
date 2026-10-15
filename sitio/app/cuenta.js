/* cuenta.js · Dos ayudas del formulario «Crea tu cuenta»:

   1. Segundo apellido sin preguntarlo: mantiene el campo auxiliar sin_segundo_apellido en «si» mientras el
      segundo apellido esté vacío. Con eso la validación cruzada «curp-sin-segundo-apellido» comprueba que la
      CURP lleve X en su lugar, y «curp-segundo-apellido» compara el que se escriba. El servidor no recibe
      este dato: lo calcula igual a partir de segundo_apellido.

   2. Vuelve a comprobar la CURP cuando cambia un dato con el que se compara. El núcleo del estándar valida
      las cruzadas al salir del campo que las declara (la CURP) y sólo las repite si ese campo ya mostraba un
      error de cruzada; si la persona escribe primero la CURP y después cambia su nombre, apellidos o fecha,
      la discrepancia no se vería hasta enviar. Hallazgo reportado al estándar (P44).

   3. Nombre, apellidos y CURP se escriben en mayúsculas al momento (decisión 2026-10-15), conservando la
      posición del cursor. Correo y contraseña no se tocan: el correo se guarda en minúsculas y la contraseña
      distingue mayúsculas. La base vuelve a ponerlos en mayúsculas al guardar (apd.mayusculas). */
(function () {
  'use strict';
  const form = document.getElementById('formulario');
  const curp = document.getElementById('curp');
  const segundo = document.getElementById('segundo_apellido');
  const sin = document.getElementById('sin_segundo_apellido');
  if (!form || !curp) return;

  const actualizaSin = () => { if (segundo && sin) sin.value = segundo.value.trim() ? '' : 'si'; };
  actualizaSin();
  if (segundo) segundo.addEventListener('input', actualizaSin);

  const MAYUSCULAS = ['nombre', 'primer_apellido', 'segundo_apellido', 'curp'];
  form.addEventListener('input', (e) => {
    const c = e.target;
    if (!MAYUSCULAS.includes(c.id)) return;
    const alto = c.value.toLocaleUpperCase('es-MX');
    if (alto === c.value) return;
    const [ini, fin] = [c.selectionStart, c.selectionEnd];
    c.value = alto;
    if (ini !== null && document.activeElement === c) c.setSelectionRange(ini, fin);
  });

  const RELACIONADOS = ['nombre', 'primer_apellido', 'segundo_apellido', 'fecha_nacimiento'];
  const revalida = (e) => {
    const campo = e.target.closest('[data-campo]');
    if (!campo || !RELACIONADOS.includes(campo.dataset.campo) || !curp.value.trim()) return;
    actualizaSin();
    curp.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
  };
  form.addEventListener('focusout', (e) => { if (e.target !== curp) revalida(e); });
  form.addEventListener('change', revalida);
}());
