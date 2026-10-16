/* fecha-dma.js · Formato propio «fecha-dma»: fecha escrita como día/mes/año (decisión 2026-10-16, Liber)

   La fecha de nacimiento se escribe sin abrir calendario. El formato «fecha» del estándar pide AAAA-MM-DD, que no es
   como se escribe una fecha en México; éste acepta 23/07/1985, 23-07-1985, 23.07.1985 o 23071985, y la deja como
   23/07/1985. Debe ser una fecha real y, con data-no-futura, no posterior a hoy (hora de la Ciudad de México).
   La cruzada «curp-fecha-dma» la compara con la fecha dentro de la CURP, como la «curp-fecha» del estándar.
   Se carga en el navegador y en Node (probar-esquemas.mjs), igual que curp-nombre.js. Hallazgo para el estándar: P70. */
(function (global) {
  'use strict';
  const esReal = (a, m, d) => { const f = new Date(Date.UTC(a, m - 1, d)); return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d; };
  const dos = (n) => String(n).padStart(2, '0');
  function hoy() {
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const v = (t) => p.find((x) => x.type === t).value;
    return `${v('year')}-${v('month')}-${v('day')}`;
  }
  /* «23/7/1985» → { d: 23, m: 7, a: 1985 }; también con guiones, puntos, espacios o los ocho dígitos juntos */
  function partes(v) {
    const t = String(v || '').trim();
    let m = t.match(/^(\d{1,2})\s*[/.\- ]\s*(\d{1,2})\s*[/.\- ]\s*(\d{4})$/);
    if (!m) m = t.match(/^(\d{2})(\d{2})(\d{4})$/);
    return m ? { d: Number(m[1]), m: Number(m[2]), a: Number(m[3]) } : null;
  }
  const iso = (p) => `${p.a}-${dos(p.m)}-${dos(p.d)}`;

  const FORMATOS = {
    'fecha-dma': {
      descripcion: 'Fecha real escrita como día/mes/año (DD/MM/AAAA)',
      inputmode: 'numeric', autocomplete: 'off',
      normaliza: (v) => { const p = partes(v); return p ? `${dos(p.d)}/${dos(p.m)}/${p.a}` : String(v || '').trim(); },
      valida: (v, a = {}) => {
        const p = partes(v);
        if (!p || !esReal(p.a, p.m, p.d)) return 'Escribe una fecha real como día/mes/año. Ejemplo: 23/07/1985';
        // En el navegador llega data-no-futura; en el servidor, max ya resuelto a hoy (esquema-desde-html)
        const limite = a.max || (a.noFutura !== undefined ? hoy() : '');
        if (limite && iso(p) > limite) return 'La fecha no puede ser posterior a hoy.';
        if (p.a < 1900) return 'Revisa el año: escribe los cuatro dígitos. Ejemplo: 1985';
        return '';
      }
    }
  };

  /* Fecha dentro de la CURP (posiciones 5 a 10; la 17 dice el siglo), como fechaDeCurp del estándar */
  function deCurp(curp) {
    const c = String(curp || '');
    const aa = Number(c.slice(4, 6)), mm = Number(c.slice(6, 8)), dd = Number(c.slice(8, 10));
    const a = (/\d/.test(c[16]) ? 1900 : 2000) + aa;
    return esReal(a, mm, dd) ? `${a}-${dos(mm)}-${dos(dd)}` : '';
  }
  const CRUZADAS = {
    'curp-fecha-dma': {
      descripcion: 'La fecha de nacimiento (día/mes/año) coincide con la contenida en la CURP',
      campos: ['curp', 'fecha'], bloquea: true,
      valida: ({ curp, fecha }) => {
        const p = partes(fecha);
        return p && deCurp(curp) === iso(p) ? '' : 'La fecha de nacimiento no coincide con la CURP. Revisa que ambos datos estén correctos.';
      }
    }
  };

  global.APD_FECHA = { partes, iso };
  global.APD_FORMATOS = Object.assign(global.APD_FORMATOS || {}, FORMATOS);
  global.APD_CRUZADAS = Object.assign(global.APD_CRUZADAS || {}, CRUZADAS);
}(typeof window !== 'undefined' ? window : globalThis));
