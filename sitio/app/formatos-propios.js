/* formatos-propios.js · Formatos propios del proyecto (contrato de formatos del Estándar de formularios del SIA)

   El estándar no trae estos formatos, así que el proyecto los declara aquí y los usan el navegador
   (FORMKIT_CONFIG.formatos = window.APD_FORMATOS) y el servidor (validaPayload con la misma configuración,
   herramientas/probar-esquemas.mjs). Mismo patrón que app/codigo-examen.js.

     · «carrera»: el nombre de una carrera escrito por la persona (combo libre o texto). Lleva al menos dos letras y sólo
       letras, números, espacios y la puntuación de un nombre; «🌳🌳🌳» o «...» no son una carrera (auditoría «intentar
       romperlo», 18/10/2026, F1 12). Una carrera escrita que no está en el catálogo entra a él «por clasificar».
     · «numero-acreditacion»: el número impreso en la credencial (PD-2026-0001, DT-2025-K109). Se acepta con o sin
       guiones, en minúsculas o con espacios, y se guarda con sus guiones (F1 10: «DT2025K109» daba un «no acreditado»
       falso). El mensaje habla de la credencial, no de un folio o un acuse. */
(function (global) {
  'use strict';
  const FORMATOS = {
    carrera: {
      descripcion: 'Nombre de una carrera: al menos dos letras; letras, números, espacios y puntuación de un nombre',
      inputmode: 'text', autocomplete: 'off',
      normaliza: (v) => String(v ?? '').replace(/\s+/g, ' ').trim(),
      valida: (v) => {
        const letras = (String(v).match(/\p{L}/gu) || []).length;
        return letras >= 2 && /^[\p{L}\p{M}0-9 .,;:()'’/&\-–]+$/u.test(v) ? '' : 'Escribe el nombre de la carrera con letras. Ejemplo: Ingeniería Forestal';
      }
    },
    'numero-acreditacion': {
      descripcion: 'Número de acreditación: PD o DT, el año y el consecutivo, separados por guiones',
      inputmode: 'text', autocomplete: 'off',
      normaliza: (v) => {
        const t = String(v ?? '').toUpperCase().replace(/[\s\-–—_.]/g, '');
        const m = t.match(/^(PD|DT)(\d{4})([A-Z0-9]+)$/);
        return m ? `${m[1]}-${m[2]}-${m[3]}` : String(v ?? '').trim().toUpperCase();
      },
      valida: (v) => (/^(PD|DT)-\d{4}-[A-Z0-9]{1,10}$/.test(v) ? '' : 'Escribe el número como aparece en la credencial, por ejemplo PD-2026-0001.')
    }
  };
  global.APD_FORMATOS = Object.assign(global.APD_FORMATOS || {}, FORMATOS);
}(typeof window !== 'undefined' ? window : globalThis));
