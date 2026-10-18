/* codigo-examen.js · Formato propio «codigo-examen» (contrato de formatos del Estándar de formularios del SIA)

   El código de examen lo genera el sistema para una persona y un examen, y se lo entrega impreso quien aplica el
   examen (decisión 2026-10-17, P78). Son 8 caracteres en dos grupos de 4 separados por guion (K7MP-2XQ9), con un
   alfabeto sin caracteres que se confunden al leerlos en papel (sin 0/O, 1/I/L, 2/Z, 5/S, 8/B). El estándar no trae
   este formato, así que el proyecto lo declara aquí y lo usan el navegador y el servidor.

   Se acepta en minúsculas, sin guion o con espacios, y se guarda en mayúsculas con el guion. */
(function (global) {
  'use strict';
  const ALFABETO = 'ACDEFGHJKMNPQRTUVWXY34679';
  const RE = new RegExp(`^[${ALFABETO}]{4}-[${ALFABETO}]{4}$`);
  const FORMATOS = {
    'codigo-examen': {
      descripcion: 'Código de examen: 8 caracteres en dos grupos de 4, separados por guion',
      inputmode: 'text', autocomplete: 'off',
      normaliza: (v) => {
        const t = String(v ?? '').toUpperCase().replace(/[\s-]/g, '');
        return t.length === 8 ? `${t.slice(0, 4)}-${t.slice(4)}` : String(v ?? '').trim().toUpperCase();
      },
      valida: (v) => (RE.test(v) ? '' : 'El código tiene 8 letras y números, en dos grupos de 4. Escríbelo como aparece en tu papel. Ejemplo: K7MP-3XQ9')
    }
  };
  global.APD_FORMATOS = Object.assign(global.APD_FORMATOS || {}, FORMATOS);
  global.APD_CODIGO_EXAMEN = { ALFABETO, RE };
}(typeof window !== 'undefined' ? window : globalThis));
