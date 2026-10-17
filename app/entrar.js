/* entrar.js · Versión de prueba: muestra en «Entrar» la contraseña de las personas de ejemplo. Escoger un caso y
   llenar el formulario con él se hace desde el menú de pruebas (app/pruebas.js, app/casos-prueba.js; decisión
   2026-10-16). Se quita en la etapa 3 junto con el acceso simulado. */
(function () {
  'use strict';
  for (const n of document.querySelectorAll('[data-contrasena-ficticia]')) n.textContent = APD.CONTRASENA_FICTICIA;
}());
