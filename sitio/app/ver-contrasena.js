/* ver-contrasena.js · Botón «Mostrar» / «Ocultar» en los campos de contraseña (decisión 2026-10-17; hallazgo P73)

   Contrato HTML: el control va dentro de .contrasena-caja con un botón
     <button type="button" class="contrasena-ver" data-ver-contrasena aria-controls="ID" aria-pressed="false">
       <span data-ver-texto>Mostrar</span><span class="solo-lector"> la contraseña</span></button>
   El botón cambia el tipo del control entre password y text, y su texto y aria-pressed. Al enviar el formulario la
   contraseña se vuelve a ocultar, para que el navegador no la guarde ni la muestre como texto. */
(function () {
  'use strict';
  function pon(b, ver) {
    const c = document.getElementById(b.getAttribute('aria-controls'));
    if (!c) return;
    c.type = ver ? 'text' : 'password';
    b.setAttribute('aria-pressed', ver ? 'true' : 'false');
    b.querySelector('[data-ver-texto]').textContent = ver ? 'Ocultar' : 'Mostrar';
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ver-contrasena]');
    if (b) pon(b, b.getAttribute('aria-pressed') !== 'true');
  });
  document.addEventListener('submit', (e) => {
    for (const b of e.target.querySelectorAll('[data-ver-contrasena][aria-pressed="true"]')) pon(b, false);
  }, true);
}());
