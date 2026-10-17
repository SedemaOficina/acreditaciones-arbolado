/* =========================================================
   config-cotejo.js · Ajustes del formulario «Atender una cita de cotejo» (personal, etapa 2)

   Se carga ANTES que el núcleo. Sólo lo que cambia respecto de validaciones.config.js:
     · el folio de la factura usa el formato «folio-fiscal» del estándar (1.3.0, P82); sus textos en usted, en
       app/config-usted.js, que se carga después de este archivo;
     · archivos: 5 MB (parámetro tamano_maximo_archivo_bytes de la base); la factura, en PDF (apd.requisito
       factura_pago). En la cita no se toma otra fotografía (decisión 2026-10-17, Liber).

   En la etapa 3 la API del personal recibe el cotejo, vuelve a calcular los campos auxiliares con la base
   (cita en pausa, inasistencias anteriores, documentos cargados) y revalida todo con codigo/servidor/validar.mjs
   y el esquema derivado de cotejo.html (herramientas/probar-esquemas.mjs).
   ========================================================= */
window.FORMKIT_CONFIG = {
  archivos: { mb: 5, max: 1 }
};
