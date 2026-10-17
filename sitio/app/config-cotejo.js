/* =========================================================
   config-cotejo.js · Ajustes del formulario «Atender una cita de cotejo» (personal, etapa 2)

   Se carga ANTES que el núcleo. Sólo lo que cambia respecto de validaciones.config.js:
     · el formato propio «folio-fiscal» (app/folio-fiscal.js) para el folio de la factura;
     · archivos: 5 MB (parámetro tamano_maximo_archivo_bytes de la base); la factura, en PDF (apd.requisito
       factura_pago). En la cita no se toma otra fotografía (decisión 2026-10-17, Liber).

   En la etapa 3 la API del personal recibe el cotejo, vuelve a calcular los campos auxiliares con la base
   (cita en pausa, inasistencias anteriores, documentos cargados) y revalida todo con codigo/servidor/validar.mjs
   y el esquema derivado de cotejo.html (herramientas/probar-esquemas.mjs).
   ========================================================= */
window.FORMKIT_CONFIG = {
  formatos: window.APD_FORMATOS,
  archivos: { mb: 5, max: 1 }
};
