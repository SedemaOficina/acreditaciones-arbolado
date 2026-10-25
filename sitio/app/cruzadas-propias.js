/* cruzadas-propias.js · Validaciones cruzadas propias del proyecto (contrato de cruzadas del Estándar de formularios del SIA)

   El estándar no trae ésta, así que el proyecto la declara aquí y la usan el navegador (FORMKIT_CONFIG.cruzadas, en la
   configuración de la página) y el servidor (validaPayload con la misma configuración, herramientas/probar-esquemas.mjs).
   Mismo patrón que app/formatos-propios.js.

     · «curp-mayoria-edad»: la persona tiene la edad mínima (parámetro edad_minima, 18; P138) según la fecha de nacimiento de
       su CURP. Registro asistido (decisión 2026-10-25): el personal comprueba la mayoría de edad al registrar a la persona,
       como la base (menor_de_edad). Falla del estándar: su cruzada «edad» no lee la fecha día/mes/año (fecha-dma) que la
       página toma de la CURP, así que se usa la CURP misma. La edad mínima va en data-edad-minima de la CURP; el día de
       referencia, en APD_CRUZADAS_HOY (la fecha simulada de la prueba) o, si no hay, el de hoy en la Ciudad de México. */
(function (global) {
  'use strict';
  const CRUZADAS = {
    'curp-mayoria-edad': {
      descripcion: 'La persona tiene la edad mínima según la fecha de nacimiento de su CURP',
      campos: ['curp'], bloquea: true,
      valida: ({ curp }, a = {}) => {
        const V = global.FORMKIT_VALIDACIONES;
        const nacimiento = V && V.fechaDeCurp ? V.fechaDeCurp(curp) : '';
        if (!nacimiento) return '';
        const minima = Number(a.edadMinima || 18);
        const hoy = global.APD_CRUZADAS_HOY || (V && V.hoyISO ? V.hoyISO() : new Date().toISOString().slice(0, 10));
        return V.edadEn(nacimiento, hoy) >= minima ? ''
          : `Según su CURP, la persona todavía no tiene ${minima} años cumplidos: no se puede registrar ni solicitar una acreditación.`;
      }
    }
  };
  global.APD_CRUZADAS = Object.assign(global.APD_CRUZADAS || {}, CRUZADAS);
}(typeof window !== 'undefined' ? window : globalThis));
