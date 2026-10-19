/* =========================================================
   config-corregir.js · Ajustes del formulario «Cargar el documento correcto»

   Se carga ANTES que el núcleo. Sólo lo que cambia respecto de validaciones.config.js: archivos de 5 MB
   (parámetro tamano_maximo_archivo_bytes de la base), sólo PDF (apd.requisito.formatos) y uno por documento.

   El envío es una SIMULACIÓN (app/corregir.js): guarda el archivo sólo en este navegador. En la etapa 3 la API
   lo sube como documento de la solicitud; la base lo admite mientras la cita esté en pausa y sólo para los
   documentos que no coincidieron (decisión 2026-10-17), y revalida con el esquema derivado de corregir.html.
   ========================================================= */
window.FORMKIT_CONFIG = {
  archivos: { mb: 5, extensiones: ['pdf'], max: 1 },
  // «pesa 5.0 MB y el máximo es 5 MB» parecía que sí cabía (redondeo del estándar; auditoría «intentar romperlo», F4 B6)
  mensajes: { archRechazoPeso: 'pasa del máximo de {mb} MB (pesa {peso}). Reduce su tamaño o elige otro.' }
};
