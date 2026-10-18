/* cuenta.js · Una ayuda del formulario «Crea tu cuenta»:

   Nombre, apellidos y CURP se escriben en mayúsculas al momento (decisión 2026-10-15), conservando la posición del
   cursor. Correo y contraseña no se tocan: el correo se guarda en minúsculas y la contraseña distingue mayúsculas.
   La base vuelve a ponerlos en mayúsculas al guardar (apd.mayusculas).

   Desde el estándar 1.1.0 ya no hace falta: el campo auxiliar sin_segundo_apellido (curp-segundo-apellido acepta el
   segundo apellido vacío, P43) ni volver a comprobar la CURP cuando cambia el nombre o la fecha (P44). */
(function () {
  'use strict';
  const form = document.getElementById('formulario');
  if (!form) return;

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
}());
