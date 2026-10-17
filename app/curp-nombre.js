/* =========================================================
   curp-nombre.js · La CURP corresponde al nombre que se escribe

   Validaciones cruzadas PROPIAS del proyecto, con el mismo contrato que las
   del Estándar de formularios del SIA (validaciones.config.js): reciben los
   valores normalizados y devuelven '' o el mensaje. Se suman a la
   configuración con FORMKIT_CONFIG.cruzadas en el navegador y con
   validaPayload(…, { config }) en el servidor, así que la regla es una sola.

   Qué comprueba (reglas de formación de la CURP de RENAPO, simplificadas):
     · posiciones 1, 2 y 4: inicial y primera vocal interna del primer
       apellido, e inicial del nombre;
     · posiciones 14 y 16: primera consonante interna del primer apellido y
       del nombre;
     · posiciones 3 y 15: inicial y primera consonante interna del segundo
       apellido; si no lo escribe, la CURP debe tener X en ambas (el campo
       auxiliar sin_segundo_apellido lo indica; no se pregunta).
   Se omiten partículas (DE, DEL, LA, LOS, Y, MC, VAN…); en nombres
   compuestos que empiezan con MARÍA o JOSÉ se usa el segundo; la Ñ cuenta
   como X; las palabras altisonantes de cuatro letras cambian su segunda
   letra por X. La fecha de nacimiento la compara la cruzada «curp-fecha-dma» (app/fecha-dma.js)
   del estándar.

   Límite: comprueba que los datos sean coherentes entre sí, no que la CURP
   exista ni que sea de quien la escribe. Eso lo da la consulta a RENAPO
   [pendiente] y, siempre, la identificación oficial en el cotejo presencial.

   Se carga como script en el navegador (antes de config-cuenta.js) y con
   import() en Node: no tiene dependencias.
   ========================================================= */
(function (global) {
  'use strict';

  const PARTICULAS = ['DA', 'DAS', 'DE', 'DEL', 'DER', 'DI', 'DIE', 'DD', 'EL', 'LA', 'LAS', 'LE', 'LES', 'LOS', 'MAC', 'MC', 'VAN', 'VON', 'Y'];
  const NOMBRES_COMUNES = ['MARIA', 'MA', 'MX', 'M', 'JOSE', 'J'];
  const ALTISONANTES = ['BACA', 'BAKA', 'BUEI', 'BUEY', 'CACA', 'CACO', 'CAGA', 'CAGO', 'CAKA', 'CAKO', 'COGE', 'COGI',
    'COJA', 'COJE', 'COJI', 'COJO', 'COLA', 'CULO', 'FALO', 'FETO', 'GETA', 'GUEI', 'GUEY', 'JETA', 'JOTO', 'KACA', 'KACO',
    'KAGA', 'KAGO', 'KAKA', 'KAKO', 'KOGE', 'KOGI', 'KOJA', 'KOJE', 'KOJI', 'KOJO', 'KOLA', 'KULO', 'LILO', 'LOCA', 'LOCO',
    'LOKA', 'LOKO', 'MAME', 'MAMO', 'MEAR', 'MEAS', 'MEON', 'MIAR', 'MION', 'MOCO', 'MOKO', 'MULA', 'MULO', 'NACA', 'NACO',
    'PEDA', 'PEDO', 'PENE', 'PIPI', 'PITO', 'POPO', 'PUTA', 'PUTO', 'QULO', 'RATA', 'ROBA', 'ROBE', 'ROBO', 'RUIN', 'SENO',
    'TETA', 'VACA', 'VAGA', 'VAGO', 'VAKA', 'VUEI', 'VUEY', 'WUEI', 'WUEY'];
  const VOCALES = 'AEIOU';

  /* Mayúsculas, sin acentos (la Ñ se conserva para tratarla aparte), sólo letras y espacios. */
  function limpia(t) {
    return String(t || '').toUpperCase()
      .replace(/Ñ/g, '\u0001').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\u0001/g, 'Ñ')
      .replace(/[^A-ZÑ ]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  /* La palabra que cuenta: la primera que no es partícula. */
  function palabra(t, esNombre) {
    let p = limpia(t).split(' ').filter((x) => x && !PARTICULAS.includes(x));
    if (esNombre && p.length > 1 && NOMBRES_COMUNES.includes(p[0])) p = p.slice(1);
    return p[0] || '';
  }
  const x = (c) => (!c || c === 'Ñ' ? 'X' : c);
  const vocalInterna = (p) => x([...p.slice(1)].find((c) => VOCALES.includes(c)));
  const consonanteInterna = (p) => x([...p.slice(1)].find((c) => !VOCALES.includes(c)));

  /* Las letras que la CURP debe tener según el nombre (null = no se puede saber). */
  function esperado({ nombre, primer, segundo }) {
    const n = palabra(nombre, true), a1 = palabra(primer), a2 = palabra(segundo);
    if (!n || !a1) return null;
    return {
      p1: x(a1[0]), p2: vocalInterna(a1), p3: a2 ? x(a2[0]) : 'X', p4: x(n[0]),
      p14: consonanteInterna(a1), p15: a2 ? consonanteInterna(a2) : 'X', p16: consonanteInterna(n)
    };
  }
  /* Las 16 primeras posiciones sin homoclave ni dígito (útil para generar datos ficticios). */
  function prefijo(datos, fechaISO, sexo, entidad) {
    const e = esperado(datos);
    let cuatro = e.p1 + e.p2 + e.p3 + e.p4;
    if (ALTISONANTES.includes(cuatro)) cuatro = cuatro[0] + 'X' + cuatro.slice(2);
    return cuatro + fechaISO.slice(2, 4) + fechaISO.slice(5, 7) + fechaISO.slice(8, 10) + sexo + entidad + e.p14 + e.p15 + e.p16;
  }

  const MENSAJE = 'La CURP no corresponde con el nombre y los apellidos que escribiste. Escríbelos tal como aparecen en tu CURP.';
  const CRUZADAS = {
    'curp-nombre': {
      descripcion: 'Iniciales y consonantes del nombre y del primer apellido coinciden con la CURP (posiciones 1, 2, 4, 14 y 16)',
      campos: ['curp', 'nombre', 'primer'], bloquea: true,
      valida: ({ curp, nombre, primer }) => {
        const e = esperado({ nombre, primer, segundo: '' });
        if (!e) return '';
        const cuatro = e.p1 + e.p2 + curp[2] + e.p4;
        const p2 = ALTISONANTES.includes(cuatro) ? 'X' : e.p2;
        return curp[0] === e.p1 && curp[1] === p2 && curp[3] === e.p4 && curp[13] === e.p14 && curp[15] === e.p16 ? '' : MENSAJE;
      }
    },
    'curp-segundo-apellido': {
      descripcion: 'Inicial y consonante del segundo apellido coinciden con la CURP (posiciones 3 y 15)',
      campos: ['curp', 'segundo'], bloquea: true,
      valida: ({ curp, segundo }) => {
        const a2 = palabra(segundo);
        if (!a2) return '';
        return curp[2] === x(a2[0]) && curp[14] === consonanteInterna(a2) ? '' : MENSAJE;
      }
    }
    ,
    'curp-sin-segundo-apellido': {
      descripcion: 'Sin segundo apellido escrito, la CURP lleva X en las posiciones 3 y 15',
      campos: ['curp', 'sin'], bloquea: true,
      valida: ({ curp, sin }) => (sin !== 'si' || (curp[2] === 'X' && curp[14] === 'X') ? ''
        : 'Tu CURP indica que tienes segundo apellido. Escríbelo tal como aparece en tu CURP.')
    }
  };

  global.APD_CURP = { esperado, prefijo, limpia };
  global.APD_CRUZADAS = Object.assign(global.APD_CRUZADAS || {}, CRUZADAS);
}(typeof window !== 'undefined' ? window : globalThis));
