// FORMAS DE ESCRIBIR FECHAS Y HORAS en lo que muestra el sitio (auditoría de seguimiento 2026-10-20, C5-01).
// Decisión de Liber del 20/10/2026 (auditoría, sección 8, puntos 16 b y 17 b; docs/DECISIONES.md):
//   · fecha larga para lo que se recuerda: «martes 20 de octubre de 2026», «martes 20 de octubre de 2026 a las 10:00»
//     (APD.fechaLarga; con mayúscula inicial sólo cuando empieza el renglón, como el encabezado de la agenda);
//   · dd/mm/aaaa en tablas y datos: «20/10/2026», «20/10/2026 10:00» (APD.fechaCorta);
//   · el acuse conserva la fecha larga del estándar (FormKit.utilidades.fechaHora): «20 de octubre de 2026, 18:05»
//     (P184: el estándar escribe coma en lugar de «a las»; se acepta también «a las» para cuando lo corrija);
//   · el nombre de un grupo («Poda nueva · del 13 al 17 de octubre», decisión 18/10) no cuenta como fecha suelta.
// Cualquier otra forma («20/10/2026, 10:00», «el 20/10/2026 a las 10:00», «martes 20/10/2026», «17/10» sin año,
// «13 de octubre» sin año ni día…) es una falla.
//
// Uso: import { clasifica, PERMITIDAS } from './formatos-fecha.mjs'
//   clasifica(renglon, { acuse }) → [{ forma, texto, permitida }]; acuse = el renglón está dentro del acuse del estándar.
// Lo usan la parte «fechas» de herramientas/probar-sitio.mjs y el detector de la evidencia del bloque 6.

const MES = 'enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre';
const DIA = 'lunes|martes|miércoles|jueves|viernes|sábado|domingo';
const DIA_MAYUSCULA = 'Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo';

export const PERMITIDAS = {
  larga: 'larga «martes 20 de octubre de 2026»',
  largaHora: 'larga con hora «martes 20 de octubre de 2026 a las 10:00»',
  corta: 'corta «20/10/2026»',
  cortaHora: 'corta con hora «20/10/2026 10:00»',
  acuse: 'acuse del estándar «20 de octubre de 2026, 18:05» (decisión 17 b)',
  grupo: 'nombre del grupo «del 13 al 17 de octubre» (decisión 18/10)'
};

// El orden importa: cada forma reconocida se cambia por una marca y lo que queda se revisa después
const RECONOCIDAS = [
  // Nombre del grupo: rango sin día de la semana ni diagonales (sólo lo arma APD.nombreGrupo)
  ['grupo', new RegExp(`\\b[Dd]el \\d{1,2}( de (${MES}))?( de \\d{4})? al \\d{1,2} de (${MES})( de \\d{4})?\\b(?! a las)`, 'g')],
  // Nombre de un grupo de un solo día: «Poda renovación · 3 de noviembre», «Al curso 3 de noviembre», «(3 de noviembre, APD-G-…»
  ['grupo', new RegExp(`(?<=(nueva|renovación) · |[Aa]l curso |\\()\\d{1,2} de (${MES})( de \\d{4})?\\b(?! de \\d{4})(?=$| ·|,? APD-G-|\\)|[.:;]| ·)`, 'g')],
  ['acuseFuera', new RegExp(`(?<!(${DIA}|${DIA_MAYUSCULA}) )\\b\\d{1,2} de (${MES}) de \\d{4}(,| a las) \\d{2}:\\d{2}\\b`, 'g')],
  ['largaHora', new RegExp(`(?:\\b(${DIA})|^(${DIA_MAYUSCULA})) \\d{1,2} de (${MES}) de \\d{4} a las \\d{2}:\\d{2}\\b`, 'g')],
  ['larga', new RegExp(`(?:\\b(${DIA})|^(${DIA_MAYUSCULA})) \\d{1,2} de (${MES}) de \\d{4}\\b`, 'g')],
  ['cortaHora', /(?<![\d/])\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}\b/g],
  ['corta', /(?<![\d/])\d{2}\/\d{2}\/\d{4}(?![\d/])/g]
];
// Uniones prohibidas alrededor de una forma reconocida (la marca es «⟦forma⟧»)
const MAL_UNIDAS = [
  ['día de la semana delante de dd/mm/aaaa («martes 20/10/2026»)', new RegExp(`\\b(${DIA})\\b,? ⟦corta(Hora)?⟧`, 'i')],
  ['dd/mm/aaaa con coma o «a las» antes de la hora («20/10/2026, 10:00», «20/10/2026 a las 10:00»)', /⟦corta⟧(,? a las|,) \d{1,2}:\d{2}/],
  ['fecha larga con coma antes de la hora («martes 20 de octubre de 2026, 10:00»)', /⟦larga⟧,? \d{1,2}:\d{2}/],
  ['día de la semana en mayúscula a media oración', new RegExp(`(?<!^)\\b(${DIA_MAYUSCULA}) \\d{1,2} de (${MES})`)],
  ['día de la semana con coma («miércoles, 14 de octubre de 2026»)', new RegExp(`\\b(${DIA}), \\d{1,2} de (${MES})`, 'i')]
];
// Lo que queda y parece una fecha: otra forma
const RESTOS = [
  ['dd/mm sin año («17/10»)', /(?<![\d/])\d{1,2}\/\d{1,2}(?![\d/])/],
  ['fecha con otra separación («2026-10-20», «20-10-2026», «20.10.2026»)', /\b(\d{4}-\d{2}-\d{2}|\d{2}[-.]\d{2}[-.]\d{4})\b/],
  ['día y mes en palabras sin día de la semana o sin año («13 de octubre», «13 de octubre de 2026»)', new RegExp(`\\b\\d{1,2} de (${MES})\\b`, 'i')],
  ['día de la semana con número («sábado 17», «Lunes 2»)', new RegExp(`\\b(${DIA})\\b,? \\d`, 'i')]
];

/* Formas de fecha de un renglón. Devuelve cada forma encontrada con su ejemplo y si está permitida. */
export function clasifica(renglon, { acuse = false } = {}) {
  const r = [];
  let resto = String(renglon || '');
  for (const [forma, rx] of RECONOCIDAS) {
    resto = resto.replace(rx, (m) => {
      const f = forma === 'acuseFuera' ? 'acuse' : forma;
      const permitida = f === 'acuse' ? acuse : true;
      r.push({ forma: permitida ? f : 'acuse fuera del acuse', texto: m, permitida });
      return `⟦${f}⟧`;
    });
  }
  for (const [forma, rx] of MAL_UNIDAS) { const m = resto.match(rx); if (m) r.push({ forma, texto: renglon, permitida: false }); }
  const limpio = resto.replace(/⟦[a-zA-Z]+⟧/g, '§');
  for (const [forma, rx] of RESTOS) { const m = limpio.match(rx); if (m) r.push({ forma, texto: renglon, permitida: false }); }
  return r;
}

/* Las formas fuera de lo decidido en una lista de renglones { texto, acuse } → [{ forma, texto }] */
export function fueraDeLoDecidido(renglones) {
  const malas = [];
  for (const { texto, acuse } of renglones) for (const x of clasifica(texto, { acuse })) if (!x.permitida) malas.push({ forma: x.forma, texto });
  return malas;
}

/* Prueba del propio clasificador: lo decidido pasa y cada forma vieja de C5-01 se detecta */
export const CASOS_CLASIFICADOR = [
  ['Acude a tu cita el martes 20 de octubre de 2026 a las 10:00 con tus documentos.', true],
  ['Miércoles 14 de octubre de 2026', true],
  ['Hoy es miércoles 14 de octubre de 2026. Elija el curso.', true],
  ['Vence el 05/11/2026', true],
  ['1.ª revisión · 14/10/2026 18:00', true],
  ['Poda nueva · del 13 al 17 de octubre · Iztapalapa', true],
  ['Poda renovación · 3 de noviembre', true],
  ['Esta semana · 19/10/2026 al 25/10/2026', true],
  ['Cita de cotejo 20/10/2026, 10:00', false],
  ['Acude a tu cita el 20/10/2026 a las 10:00', false],
  ['Tu curso empezó el 13/10/2026, a las 09:00', false],
  ['Miércoles, 14 de octubre de 2026', false],
  ['Lunes 2 de noviembre al viernes 6 de noviembre', false],
  ['examen el sábado 17/10 en el PILARES', false],
  ['Falta capturar el día 2 (13/10)', false],
  ['Desde el miércoles 21/10/2026: 7 días después de hoy', false],
  ['Recibida el 14 de octubre de 2026, 18:00', false],
  ['El viernes 6 de noviembre, en el salón de cómputo', false]
];
