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

  /* Escritura guiada (sólo navegador), como el campo de fecha del navegador pero sin calendario: al completar el
     día pasa al mes y al completar el mes pasa al año, poniendo las diagonales solo. Un primer dígito que no puede
     empezar un día de dos cifras (4 a 9) o un mes (2 a 9) se completa con cero: «4» → «04/». Escribir una diagonal
     (o punto, guion o espacio) tras un solo dígito también lo cierra: «3/» → «03/». Al borrar no se reacomoda nada,
     y si se edita en medio del texto tampoco, para no mover el cursor. */
  function guia(texto) {
    const seg = ['', '', ''];
    const cerrado = [false, false];
    let i = 0;
    for (const c of String(texto)) {
      if (/\d/.test(c)) {
        if (i < 2 && cerrado[i]) i++;
        if (i === 2) { if (seg[2].length < 4) seg[2] += c; continue; }
        seg[i] += c;
        if (seg[i].length === 1 && Number(c) > (i === 0 ? 3 : 1)) seg[i] = '0' + c;
        if (seg[i].length === 2) cerrado[i] = true;
      } else if (/[/.\- ]/.test(c) && i < 2 && seg[i].length === 1) {
        seg[i] = '0' + seg[i]; cerrado[i] = true;
      }
    }
    return seg[0] + (cerrado[0] ? '/' : '') + seg[1] + (cerrado[1] ? '/' : '') + seg[2];
  }
  if (typeof document !== 'undefined' && document.addEventListener) {
    // En captura: el valor queda acomodado antes de que el núcleo del estándar lo lea
    document.addEventListener('input', (e) => {
      const c = e.target;
      if (!c || !c.closest || !c.closest('[data-formato="fecha-dma"]') || c.tagName !== 'INPUT') return;
      if (e.inputType && e.inputType.startsWith('delete')) return;
      if (c.selectionStart !== c.value.length) return;
      const v = guia(c.value);
      if (v !== c.value) { c.value = v; c.setSelectionRange(v.length, v.length); }
    }, true);
  }

  global.APD_FECHA = { partes, iso, guia };
  global.APD_FORMATOS = Object.assign(global.APD_FORMATOS || {}, FORMATOS);
  global.APD_CRUZADAS = Object.assign(global.APD_CRUZADAS || {}, CRUZADAS);
}(typeof window !== 'undefined' ? window : globalThis));
