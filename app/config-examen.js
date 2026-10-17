/* =========================================================
   config-examen.js · Ajustes del formulario «Entra a tu examen» (examen.html) y del de suspender un examen
   (aplicar.html)

   Se carga ANTES que el núcleo. Sólo lo que cambia respecto de validaciones.config.js: el formato propio
   «codigo-examen» (app/codigo-examen.js).

   En la etapa 3 la API del módulo recibe el código, lo vuelve a validar con codigo/servidor/validar.mjs y el
   esquema derivado de examen.html, y responde con el examen sin la clave de respuestas (P29, P85). Sus errores
   ({errores: [{campo, mensaje}]}) se pintan junto al campo.
   ========================================================= */
window.FORMKIT_CONFIG = {
  formatos: window.APD_FORMATOS
};
