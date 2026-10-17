/* folio-fiscal.js · Formato propio «folio-fiscal» (contrato de formatos del Estándar de formularios del SIA)

   El folio fiscal de una factura (CFDI) es un identificador de 32 dígitos hexadecimales en cinco grupos separados
   por guiones (8-4-4-4-12): 36 caracteres. Es el mismo cálculo que la restricción solicitud_factura_folio_ck de la
   base. El estándar no trae este formato (sólo «folio», para folios de trámite), así que el proyecto lo declara aquí
   y lo usan el navegador y el servidor (herramientas/probar-esquemas.mjs).

   Se escribe como aparece en la factura; se acepta en minúsculas y sin guiones, y se guarda en mayúsculas con ellos. */
(function (global) {
  'use strict';
  const FORMATOS = {
    'folio-fiscal': {
      descripcion: 'Folio fiscal (UUID) de una factura: 32 dígitos hexadecimales en grupos 8-4-4-4-12',
      inputmode: 'text', autocomplete: 'off',
      normaliza: (v) => {
        const t = String(v ?? '').trim().toUpperCase().replace(/[\s]/g, '');
        const solo = t.replace(/-/g, '');
        return /^[0-9A-F]{32}$/.test(solo) ? `${solo.slice(0, 8)}-${solo.slice(8, 12)}-${solo.slice(12, 16)}-${solo.slice(16, 20)}-${solo.slice(20)}` : t;
      },
      valida: (v) => (/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/.test(v) ? ''
        : 'El folio fiscal tiene 36 caracteres: números y letras de la A a la F, en grupos de 8, 4, 4, 4 y 12 separados por guiones. Cópielo como aparece en la factura.')
    }
  };
  global.APD_FORMATOS = Object.assign(global.APD_FORMATOS || {}, FORMATOS);
}(typeof window !== 'undefined' ? window : globalThis));
