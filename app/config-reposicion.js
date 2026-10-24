/* =========================================================
   config-reposicion.js · Ajustes del formulario «Reposición de tu credencial» (P140, sesión de trabajo del 23/10/2026)

   Se carga ANTES que el núcleo. Sólo lo que cambia respecto de validaciones.config.js: el acta, de hasta 5 MB
   (parámetro tamano_maximo_archivo_bytes de la base), en PDF o en foto (JPG o PNG, apd.reposicion_mime_ck), una sola.

   El envío es una SIMULACIÓN (app/reposicion.js): guarda el acta sólo en este navegador. En la etapa 3 la API la sube
   al almacén y la base da de alta la reposición (apd.reposicion_alta) o, con observaciones, cambia el acta
   (apd.reposicion_cambio); revalida con el esquema derivado de reposicion.html (herramientas/probar-esquemas.mjs).
   ========================================================= */
window.FORMKIT_CONFIG = {
  archivos: { mb: 5, extensiones: ['pdf', 'jpg', 'jpeg', 'png'], max: 1 },
  // Como en «Cargar el documento correcto»: «pesa 5.0 MB y el máximo es 5 MB» parecía que sí cabía (F4 B6)
  mensajes: { archRechazoPeso: 'pasa del máximo de {mb} MB (pesa {peso}). Reduce su tamaño o elige otro.' }
};
