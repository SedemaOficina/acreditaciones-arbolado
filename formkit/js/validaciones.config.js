/* =========================================================
   validaciones.config.js · Estándar de formularios del SIA (SEDEMA)

   ÚNICO lugar donde viven los patrones, las longitudes, los límites, los
   mensajes y las validaciones cruzadas. formkit.core.js los lee en el
   navegador; codigo/servidor/validar.mjs los lee en Node para la segunda
   validación obligatoria. Así el navegador y el servidor no pueden decir
   cosas distintas (FRM-11).

   Reglas de redacción de cada validador:
     · normaliza(v) devuelve el dato limpio que se valida Y se conserva;
     · valida(v, a) recibe el dato ya normalizado y los atributos del campo
       (min, max, step, minlength, maxlength…) y devuelve '' o el mensaje;
     · el mensaje dice qué pasó y qué hacer, con ejemplo cuando ayuda;
     · se rechaza sólo lo inválido con certeza (FRM-26): una validación
       estricta excluye a personas reales.

   Es un script sin dependencias que expone la configuración como global
   (globalThis.FORMKIT_VALIDACIONES) en el navegador y en Node, y además
   como módulo CommonJS cuando se carga con require.
   ========================================================= */
(function (raiz, fabrica) {
  const cfg = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = cfg;
  raiz.FORMKIT_VALIDACIONES = cfg;
}(typeof globalThis !== 'undefined' ? globalThis : (typeof self !== 'undefined' ? self : this), function () {
  'use strict';

  /* ---------- Utilidades compartidas ---------- */
  const recorta = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
  const soloDigitos = (v) => String(v ?? '').replace(/\D/g, '');
  /* Formatos de archivo para leerlos: en mayúsculas y sin repetir JPEG (jpg y jpeg son el mismo). */
  const formatosArchivo = (exts) => [...new Set((exts || []).map((e) => String(e).trim().toUpperCase()).map((e) => (e === 'JPG' ? 'JPEG' : e)))].join(', ');
  const sinAcentos = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const esFechaReal = (a, m, d) => { const f = new Date(Date.UTC(a, m - 1, d)); return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d; };

  /* Fecha escrita como día/mes/año (formato «fecha-dma»): 23/07/1985,
     23-07-1985, 23.07.1985, 23 07 1985 o 23071985; también AAAA-MM-DD, que es
     lo que pone el autocompletado del navegador. */
  function partesDma(v) {
    const t = String(v || '').trim();
    let m = t.match(/^(\d{1,2})\s*[/.\- ]\s*(\d{1,2})\s*[/.\- ]\s*(\d{4})$/) || t.match(/^(\d{2})(\d{2})(\d{4})$/);
    if (m) return { d: Number(m[1]), m: Number(m[2]), a: Number(m[3]) };
    m = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? { d: Number(m[3]), m: Number(m[2]), a: Number(m[1]) } : null;
  }
  const dosCifras = (n) => String(n).padStart(2, '0');
  /* «23/07/1985» → «1985-07-23»; '' si no es una fecha real. */
  const isoDeDma = (v) => { const p = partesDma(v); return p && esFechaReal(p.a, p.m, p.d) ? `${p.a}-${dosCifras(p.m)}-${dosCifras(p.d)}` : ''; };
  /* «1985-07-23» → «23/07/1985». */
  const dmaDeIso = (iso) => { const m = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? `${m[3]}/${m[2]}/${m[1]}` : ''; };
  /* Escritura guiada, sin calendario: al completar el día pasa al mes y al
     completar el mes pasa al año, poniendo las diagonales. Un primer dígito
     que no puede empezar un día de dos cifras (4 a 9) o un mes (2 a 9) se
     completa con cero: «4» → «04/». Una diagonal, punto, guion o espacio tras
     un solo dígito también lo cierra: «3/» → «03/». */
  function guiaFechaDma(texto) {
    const seg = ['', '', ''];
    const cerrado = [false, false];
    let i = 0;
    for (const c of String(texto)) {
      if (/\d/.test(c)) {
        if (i < 2 && cerrado[i]) i++;
        if (i === 2) { if (seg[2].length < 4) seg[2] += c; continue; }
        seg[i] += c;
        if (seg[i].length === 1 && Number(c) > (i === 0 ? 3 : 1)) seg[i] = `0${c}`;
        if (seg[i].length === 2) cerrado[i] = true;
      } else if (/[/.\- ]/.test(c) && i < 2 && seg[i].length === 1) {
        seg[i] = `0${seg[i]}`; cerrado[i] = true;
      }
    }
    return seg[0] + (cerrado[0] ? '/' : '') + seg[1] + (cerrado[1] ? '/' : '') + seg[2];
  }
  const hoyISO = () => {
    /* La fecha de «hoy» se toma en la zona horaria de la Ciudad de México,
       no en la del dispositivo: una persona que captura desde otro huso no
       debe ver una fecha distinta a la del acuse. */
    const p = new Intl.DateTimeFormat('en-CA', { timeZone: CONFIG.fechas.zonaHoraria, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const g = (t) => p.find((x) => x.type === t).value;
    return `${g('year')}-${g('month')}-${g('day')}`;
  };
  const ahoraHM = () => {
    const p = new Intl.DateTimeFormat('es-MX', { timeZone: CONFIG.fechas.zonaHoraria, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const g = (t) => p.find((x) => x.type === t).value;
    return `${g('hour')}:${g('minute')}`;
  };
  const edadEn = (nacISO, refISO) => {
    const [a, m, d] = nacISO.split('-').map(Number); const [ra, rm, rd] = refISO.split('-').map(Number);
    let e = ra - a; if (rm < m || (rm === m && rd < d)) e--; return e;
  };
  const plantilla = (t, v = {}) => String(t).replace(/\{(\w+)\}/g, (_, k) => (v[k] ?? ''));

  /* ---------- Texto legible: forma, no sentido ----------
     Rechaza el tecleo al azar; no juzga ortografía ni contenido. Los umbrales
     de ESTA prueba se publican; los de la protección en servidor, no. */
  const TEXTO_LEGIBLE = { minPalabras: 6, minLetras: 25, vocalMin: 0.28, vocalMax: 0.68, repeticion: 4, palabraMax: 24, sinVocalDesde: 5 };
  function pareceTexto(x) {
    const L = TEXTO_LEGIBLE;
    x = String(x || '').trim();
    const palabras = x.split(/\s+/).filter((p) => p.length > 1);
    if (palabras.length < L.minPalabras) return false;
    const letras = x.toLowerCase().replace(/[^a-záéíóúüñ]/g, '');
    if (letras.length < L.minLetras) return false;
    const proporcion = (letras.match(/[aeiouáéíóúü]/g) || []).length / letras.length;
    if (proporcion < L.vocalMin || proporcion > L.vocalMax) return false;
    if (new RegExp(`(.)\\1{${L.repeticion - 1},}`).test(x)) return false;
    if (palabras.some((p) => p.length > L.palabraMax)) return false;
    return !palabras.some((p) => { const s = p.toLowerCase().replace(/[^a-záéíóúüñ]/g, ''); return s.length >= L.sinVocalDesde && !/[aeiouáéíóúü]/.test(s); });
  }

  /* ---------- CURP ----------
     Estructura de referencia, A CONFIRMAR en la documentación oficial del
     emisor (RENAPO) antes de liberar un formulario que la exija [Fuente: __]:
       1-4 iniciales · 5-10 fecha AAMMDD · 11 sexo · 12-13 entidad ·
       14-16 consonantes internas · 17 diferenciador de siglo (dígito hasta
       1999, letra desde 2000) · 18 dígito verificador.
     Un formato correcto no prueba que exista ni que sea de la persona. */
  const CURP = {
    largo: 18,
    re: /^[A-Z][AEIOUX][A-Z]{2}\d{6}[HMX][A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[0-9A-Z]\d$/,
    sexos: ['H', 'M', 'X'],
    entidades: ['AS', 'BC', 'BS', 'CC', 'CL', 'CM', 'CS', 'CH', 'DF', 'DG', 'GT', 'GR', 'HG', 'JC', 'MC', 'MN', 'MS', 'NT', 'NL', 'OC', 'PL', 'QT', 'QR', 'SP', 'SL', 'SR', 'TC', 'TS', 'TL', 'VZ', 'YN', 'ZS', 'NE'],
    verificarDigito: true,
    alfabeto: '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ'
  };
  function fechaDeCurp(curp) {
    const aa = Number(curp.slice(4, 6)), mm = Number(curp.slice(6, 8)), dd = Number(curp.slice(8, 10));
    const siglo = /\d/.test(curp[16]) ? 1900 : 2000;
    const a = siglo + aa;
    return esFechaReal(a, mm, dd) ? `${a}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}` : '';
  }
  function digitoCurp(curp) {
    let suma = 0;
    for (let i = 0; i < 17; i++) suma += CURP.alfabeto.indexOf(curp[i]) * (18 - i);
    return String((10 - (suma % 10)) % 10);
  }

  /* ---------- CURP contra nombre y apellidos ----------
     Reglas de formación de las letras, simplificadas, A CONFIRMAR con el
     instructivo del emisor (RENAPO) [Fuente: __]:
       1 inicial del primer apellido · 2 su primera vocal interna ·
       3 inicial del segundo apellido (X si no hay) · 4 inicial del nombre ·
       14, 15 y 16 primera consonante interna del primer apellido, del segundo
       (X si no hay) y del nombre.
     Se omiten las partículas (DE, DEL, LA, LOS, Y, MC, VAN…); en un nombre
     compuesto que empieza con MARÍA o JOSÉ cuenta el segundo; la Ñ cuenta
     como X; si las cuatro primeras letras forman una palabra altisonante, la
     segunda cambia por X.
     Límite: comprueba que la CURP y el nombre sean coherentes entre sí, no
     que la CURP exista ni que sea de quien la escribe. */
  const CURP_NOMBRE = {
    particulas: ['DA', 'DAS', 'DE', 'DEL', 'DER', 'DI', 'DIE', 'DD', 'EL', 'LA', 'LAS', 'LE', 'LES', 'LOS', 'MAC', 'MC', 'VAN', 'VON', 'Y'],
    nombresComunes: ['MARIA', 'MA', 'MX', 'M', 'JOSE', 'J'],
    altisonantes: ['BACA', 'BAKA', 'BUEI', 'BUEY', 'CACA', 'CACO', 'CAGA', 'CAGO', 'CAKA', 'CAKO', 'COGE', 'COGI',
      'COJA', 'COJE', 'COJI', 'COJO', 'COLA', 'CULO', 'FALO', 'FETO', 'GETA', 'GUEI', 'GUEY', 'JETA', 'JOTO', 'KACA', 'KACO',
      'KAGA', 'KAGO', 'KAKA', 'KAKO', 'KOGE', 'KOGI', 'KOJA', 'KOJE', 'KOJI', 'KOJO', 'KOLA', 'KULO', 'LILO', 'LOCA', 'LOCO',
      'LOKA', 'LOKO', 'MAME', 'MAMO', 'MEAR', 'MEAS', 'MEON', 'MIAR', 'MION', 'MOCO', 'MOKO', 'MULA', 'MULO', 'NACA', 'NACO',
      'PEDA', 'PEDO', 'PENE', 'PIPI', 'PITO', 'POPO', 'PUTA', 'PUTO', 'QULO', 'RATA', 'ROBA', 'ROBE', 'ROBO', 'RUIN', 'SENO',
      'TETA', 'VACA', 'VAGA', 'VAGO', 'VAKA', 'VUEI', 'VUEY', 'WUEI', 'WUEY'],
    vocales: 'AEIOU'
  };
  /* Mayúsculas y sin acentos (la Ñ se conserva para tratarla aparte); sólo letras y espacios. */
  function letrasDeNombre(t) {
    return String(t || '').toUpperCase()
      .replace(/Ñ/g, '\u0001').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\u0001/g, 'Ñ')
      .replace(/[^A-ZÑ ]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  /* La palabra que cuenta: la primera que no es partícula; en el nombre, la que sigue a MARÍA o JOSÉ. */
  function palabraDeCurp(t, esNombre) {
    let p = letrasDeNombre(t).split(' ').filter((w) => w && !CURP_NOMBRE.particulas.includes(w));
    if (esNombre && p.length > 1 && CURP_NOMBRE.nombresComunes.includes(p[0])) p = p.slice(1);
    return p[0] || '';
  }
  const letraDeCurp = (c) => (!c || c === 'Ñ' ? 'X' : c);
  const vocalInterna = (p) => letraDeCurp([...p.slice(1)].find((c) => CURP_NOMBRE.vocales.includes(c)));
  const consonanteInterna = (p) => letraDeCurp([...p.slice(1)].find((c) => !CURP_NOMBRE.vocales.includes(c)));
  /* Las letras que la CURP debe tener según el nombre; null si falta el nombre o el primer apellido. */
  function letrasDeCurp({ nombre, primer, segundo }) {
    const n = palabraDeCurp(nombre, true), a1 = palabraDeCurp(primer), a2 = palabraDeCurp(segundo);
    if (!n || !a1) return null;
    return {
      p1: letraDeCurp(a1[0]), p2: vocalInterna(a1), p3: a2 ? letraDeCurp(a2[0]) : 'X', p4: letraDeCurp(n[0]),
      p14: consonanteInterna(a1), p15: a2 ? consonanteInterna(a2) : 'X', p16: consonanteInterna(n)
    };
  }
  /* Las 16 primeras posiciones de una CURP coherente con los datos (sin diferenciador ni dígito): para armar datos ficticios de prueba. */
  function prefijoCurp(datos, fechaISO, sexo, entidad) {
    const e = letrasDeCurp(datos);
    let cuatro = e.p1 + e.p2 + e.p3 + e.p4;
    if (CURP_NOMBRE.altisonantes.includes(cuatro)) cuatro = `${cuatro[0]}X${cuatro.slice(2)}`;
    return cuatro + fechaISO.slice(2, 4) + fechaISO.slice(5, 7) + fechaISO.slice(8, 10) + sexo + entidad + e.p14 + e.p15 + e.p16;
  }

  /* ---------- Formatos por tipo de dato ---------- */
  /* Cada formato y cada cruzada reciben la configuración del formulario
     (cfg: la base fusionada con FORMKIT_CONFIG en el navegador; la del
     servidor en validar.mjs). Sus textos viven en cfg.mensajes, así que un
     formulario los cambia sin tocar este archivo (por ejemplo, a «usted»), y
     sus límites (ámbito, CURP) se leen de cfg, no de la base. */
  const FORMATOS = {
    nombre: {
      descripcion: 'Nombre o apellido de persona',
      inputmode: 'text', autocomplete: 'given-name',
      normaliza: (v) => recorta(v),
      valida: (v, a = {}, cfg = CONFIG) => {
        const M = cfg.mensajes;
        if (!/^[\p{L}\p{M}' .\-]+$/u.test(v)) return M.fmtNombre;
        if (v.length > (a.maxlength || 80)) return plantilla(M.fmtNombreLargo, { max: a.maxlength || 80 });
        return '';
      }
    },
    correo: {
      descripcion: 'Correo electrónico',
      inputmode: 'email', autocomplete: 'email',
      dominiosFrecuentes: ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com', 'live.com.mx', 'hotmail.es'],
      normaliza: (v) => recorta(v).toLowerCase().replace(/\s/g, ''),
      valida: (v, a = {}, cfg = CONFIG) => {
        const M = cfg.mensajes;
        if (v.length > (a.maxlength || 120)) return plantilla(M.fmtCorreoLargo, { max: a.maxlength || 120 });
        const partes = v.split('@');
        if (partes.length !== 2 || !partes[0] || !partes[1]) return M.fmtCorreoArroba;
        if (!/^[^\s@]+\.[^\s@.]{2,}$/.test(partes[1])) return M.fmtCorreoDominio;
        return '';
      },
      /* Sugerencia sin bloqueo para errores de dedo frecuentes («gmial.com»). */
      sugiere: (v, cfg = CONFIG) => {
        const dom = (v.split('@')[1] || '').toLowerCase();
        if (!dom || FORMATOS.correo.dominiosFrecuentes.includes(dom)) return '';
        const cerca = FORMATOS.correo.dominiosFrecuentes.find((d) => distancia(d, dom) === 1);
        return cerca ? plantilla(cfg.mensajes.fmtCorreoSugerencia, { correo: `${v.split('@')[0]}@${cerca}` }) : '';
      }
    },
    telefono: {
      descripcion: 'Teléfono de México: diez dígitos',
      inputmode: 'tel', autocomplete: 'tel-national',
      /* Se aceptan espacios, guiones y paréntesis al escribir; un prefijo
         +52 o 52 se retira. La regla de diez dígitos es la de México y debe
         confirmarse con el plan de numeración vigente [Fuente: __]. */
      normaliza: (v) => { let d = soloDigitos(String(v).replace(/^\s*\+?52\s*/, '')); if (d.length === 12 && d.startsWith('52')) d = d.slice(2); return d; },
      valida: (v, a = {}, cfg = CONFIG) => (/^\d{10}$/.test(v) ? '' : cfg.mensajes.fmtTelefono)
    },
    cp: {
      descripcion: 'Código postal: cinco dígitos, se conserva como texto',
      inputmode: 'numeric', autocomplete: 'postal-code',
      normaliza: (v) => soloDigitos(v),
      /* Con data-ambito="nacional" en el campo se acepta cualquier código del
         país (domicilio fuera de la Ciudad); si no, sólo los del ámbito. */
      valida: (v, a = {}, cfg = CONFIG) => {
        if (!/^\d{5}$/.test(v)) return cfg.mensajes.fmtCp;
        const am = a.ambito === 'nacional' ? null : cfg.ambito && cfg.ambito.cp;
        if (am && (v < am.min || v > am.max)) return am.mensaje;
        return '';
      }
    },
    curp: {
      descripcion: 'CURP: 18 caracteres',
      inputmode: 'text', autocomplete: 'off',
      normaliza: (v) => sinAcentos(recorta(v)).toUpperCase().replace(/\s/g, ''),
      valida: (v, a = {}, cfg = CONFIG) => {
        const M = cfg.mensajes, C = cfg.curp || CURP;
        if (v.length !== C.largo) return plantilla(M.fmtCurpLargo, { largo: C.largo, n: v.length });
        if (!C.re.test(v)) return M.fmtCurpEstructura;
        if (!fechaDeCurp(v)) return M.fmtCurpFecha;
        if (fechaDeCurp(v) > hoyISO()) return M.fmtCurpFutura;
        if (!C.entidades.includes(v.slice(11, 13))) return M.fmtCurpEntidad;
        if (C.verificarDigito && digitoCurp(v) !== v[17]) return M.fmtCurpDigito;
        return '';
      },
      /* Datos derivables para mostrarlos en solo lectura (minimización). */
      deriva: (v) => ({ fechaNacimiento: fechaDeCurp(v), sexo: v[10], entidad: v.slice(11, 13) })
    },
    rfc: {
      descripcion: 'RFC: 12 caracteres (persona moral) o 13 (persona física). Estructura a confirmar con el emisor [Fuente: __]',
      inputmode: 'text', autocomplete: 'off',
      normaliza: (v) => sinAcentos(recorta(v)).toUpperCase().replace(/[\s-]/g, ''),
      valida: (v, a = {}, cfg = CONFIG) => {
        if (!/^([A-ZÑ&]{3,4})(\d{6})([A-Z0-9]{3})$/.test(v)) return cfg.mensajes.fmtRfc;
        const aa = Number(v.slice(-9, -7)), mm = Number(v.slice(-7, -5)), dd = Number(v.slice(-5, -3));
        if (!esFechaReal(2000 + aa, mm, dd) && !esFechaReal(1900 + aa, mm, dd)) return cfg.mensajes.fmtRfcFecha;
        return '';
      }
    },
    numero: {
      descripcion: 'Número entero o decimal con mínimo, máximo y paso configurables en el campo',
      inputmode: 'decimal', autocomplete: 'off',
      normaliza: (v) => recorta(v).replace(/\s/g, '').replace(',', '.'),
      valida: (v, a = {}, cfg = CONFIG) => {
        const M = cfg.mensajes;
        if (!/^-?\d+(\.\d+)?$/.test(v)) return M.fmtNumero;
        const n = Number(v);
        /* El paso cuenta desde el mínimo, como en HTML; con tolerancia de redondeo para pasos decimales. */
        const paso = a.step && a.step !== 'any' ? Number(a.step) : 0;
        if (paso > 0) {
          const k = (n - (a.min !== undefined && a.min !== '' ? Number(a.min) : 0)) / paso;
          if (Math.abs(k - Math.round(k)) > 1e-9) return paso === 1 ? M.fmtNumeroEntero : plantilla(M.fmtNumeroPaso, { paso: a.step });
        }
        if (a.min !== undefined && a.min !== '' && n < Number(a.min)) return plantilla(M.fmtNumeroMin, { min: a.min });
        if (a.max !== undefined && a.max !== '' && n > Number(a.max)) return plantilla(M.fmtNumeroMax, { max: a.max });
        return '';
      }
    },
    fecha: {
      descripcion: 'Fecha real en formato AAAA-MM-DD con límites configurables',
      inputmode: 'numeric', autocomplete: 'off',
      normaliza: (v) => recorta(v),
      valida: (v, a = {}, cfg = CONFIG) => {
        const M = cfg.mensajes;
        const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m || !esFechaReal(Number(m[1]), Number(m[2]), Number(m[3]))) return M.fmtFecha;
        if (a.max && v > a.max) return a.max === hoyISO() ? M.fmtFechaFutura : plantilla(M.fmtFechaMax, { fecha: dmaDeIso(a.max) || a.max });
        if (a.min && v < a.min) return plantilla(M.fmtFechaMin, { fecha: dmaDeIso(a.min) || a.min });
        return '';
      }
    },
    'fecha-dma': {
      descripcion: 'Fecha real escrita como día/mes/año (DD/MM/AAAA), sin calendario; para la fecha de nacimiento',
      inputmode: 'numeric', autocomplete: 'off',
      normaliza: (v) => { const iso = isoDeDma(v); return iso ? dmaDeIso(iso) : recorta(v); },
      valida: (v, a = {}, cfg = CONFIG) => {
        const M = cfg.mensajes;
        const iso = isoDeDma(v);
        if (!iso) return M.fmtFechaDma;
        if (Number(iso.slice(0, 4)) < 1900) return M.fmtFechaDmaAnio;
        /* En el navegador llega data-no-futura; en el servidor, max ya resuelto a hoy. */
        const max = a.max || (a.noFutura !== undefined ? hoyISO() : '');
        if (max && iso > max) return max === hoyISO() ? M.fmtFechaFutura : plantilla(M.fmtFechaMax, { fecha: dmaDeIso(max) });
        if (a.min && iso < a.min) return plantilla(M.fmtFechaMin, { fecha: dmaDeIso(a.min) });
        return '';
      }
    },
    hora: {
      descripcion: 'Hora en formato de 24 horas',
      inputmode: 'numeric', autocomplete: 'off',
      normaliza: (v) => recorta(v),
      valida: (v, a = {}, cfg = CONFIG) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? '' : cfg.mensajes.fmtHora)
    },
    texto: {
      descripcion: 'Texto libre con longitud mínima y máxima; neutraliza marcado y caracteres de control',
      inputmode: 'text', autocomplete: 'off',
      normaliza: (v) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim(),
      valida: (v, a = {}, cfg = CONFIG) => {
        const M = cfg.mensajes;
        if (a.minlength && v.length < Number(a.minlength)) return plantilla(M.fmtTextoMin, { min: a.minlength, n: v.length });
        if (a.maxlength && v.length > Number(a.maxlength)) return plantilla(M.fmtTextoMax, { max: a.maxlength, n: v.length });
        if (a.legible !== undefined && !pareceTexto(v)) return M.fmtTextoLegible;
        return '';
      }
    },
    coordenadas: {
      descripcion: 'Latitud y longitud dentro del rectángulo envolvente configurado',
      inputmode: 'decimal', autocomplete: 'off',
      normaliza: (v) => recorta(v).replace(/\s/g, ''),
      valida: (v, a = {}, cfg = CONFIG) => {
        const m = v.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
        if (!m) return cfg.mensajes.fmtCoordenadas;
        const lat = Number(m[1]), lon = Number(m[2]);
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return cfg.mensajes.fmtCoordenadasRango;
        const b = cfg.ambito && cfg.ambito.coordenadas;
        if (b && (lat < b.latMin || lat > b.latMax || lon < b.lonMin || lon > b.lonMax)) return b.mensaje;
        return '';
      }
    },
    folio: {
      descripcion: 'Folio o clave alfanumérica con guiones',
      inputmode: 'text', autocomplete: 'off',
      normaliza: (v) => recorta(v).toUpperCase().replace(/\s/g, ''),
      valida: (v, a = {}, cfg = CONFIG) => (/^[A-Z0-9][A-Z0-9-]{2,}$/.test(v) && v.length <= (a.maxlength || 40) ? '' : cfg.mensajes.fmtFolio)
    },
    /* Folio fiscal (UUID) de una factura: 32 dígitos hexadecimales en grupos
       8-4-4-4-12, 36 caracteres. Se acepta en minúsculas y sin guiones, y se
       guarda en mayúsculas con ellos. Comprueba la forma, no que la factura exista. */
    'folio-fiscal': {
      descripcion: 'Folio fiscal (UUID) de una factura: 32 dígitos hexadecimales en grupos 8-4-4-4-12',
      inputmode: 'text', autocomplete: 'off',
      normaliza: (v) => {
        const t = recorta(v).toUpperCase().replace(/\s/g, '');
        const solo = t.replace(/-/g, '');
        return /^[0-9A-F]{32}$/.test(solo) ? `${solo.slice(0, 8)}-${solo.slice(8, 12)}-${solo.slice(12, 16)}-${solo.slice(16, 20)}-${solo.slice(20)}` : t;
      },
      valida: (v, a = {}, cfg = CONFIG) => (/^[0-9A-F]{8}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{12}$/.test(v) ? '' : cfg.mensajes.fmtFolioFiscal)
    },
    contrasena: {
      descripcion: 'Contraseña: sin límite máximo restrictivo ni bloqueo del pegado',
      inputmode: 'text', autocomplete: 'new-password',
      normaliza: (v) => String(v ?? ''),
      valida: (v, a = {}, cfg = CONFIG) => {
        const min = Number(a.minlength || 12);
        if (v.length < min) return plantilla(cfg.mensajes.fmtContrasenaMin, { min });
        if (a.maxlength && v.length > Number(a.maxlength)) return plantilla(cfg.mensajes.fmtContrasenaMax, { max: a.maxlength });
        return '';
      }
    }
  };

  /* Distancia de edición acotada a 1 para sugerir dominios de correo. */
  function distancia(a, b) {
    if (a === b) return 0;
    if (Math.abs(a.length - b.length) > 1) return 2;
    let i = 0, j = 0, d = 0;
    while (i < a.length && j < b.length) {
      if (a[i] === b[j]) { i++; j++; continue; }
      d++; if (d > 1) return 2;
      if (a.length > b.length) i++; else if (b.length > a.length) j++; else { if (a[i + 1] === b[j] && a[i] === b[j + 1]) { i += 2; j += 2; } else { i++; j++; } }
    }
    return d + (a.length - i) + (b.length - j);
  }

  /* ---------- Validaciones cruzadas ----------
     Reciben los valores ya normalizados de los campos que relacionan y
     devuelven '' o el mensaje. Nunca corren hasta que ambos campos tengan
     valor y hayan pasado su validación individual. `bloquea` indica si por
     omisión impide continuar; el campo puede degradarlo a advertencia. */
  const CRUZADAS = {
    'curp-fecha': {
      descripcion: 'La fecha de nacimiento coincide con la contenida en la CURP',
      campos: ['curp', 'fecha'], bloquea: true,
      /* La fecha puede venir como AAAA-MM-DD (formato «fecha») o DD/MM/AAAA («fecha-dma»). */
      valida: ({ curp, fecha }, a = {}, cfg = CONFIG) => (fechaDeCurp(curp) === (isoDeDma(fecha) || fecha) ? '' : cfg.mensajes.czCurpFecha)
    },
    'curp-sexo': {
      descripcion: 'El sexo declarado coincide con la posición 11 de la CURP',
      campos: ['curp', 'sexo'], bloquea: false,
      valida: ({ curp, sexo }, a = {}, cfg = CONFIG) => (!sexo || curp[10] === String(sexo).toUpperCase()[0] ? '' : cfg.mensajes.czCurpSexo)
    },
    'curp-entidad': {
      descripcion: 'La entidad de nacimiento coincide con las posiciones 12 y 13 de la CURP',
      campos: ['curp', 'entidad'], bloquea: false,
      valida: ({ curp, entidad }, a = {}, cfg = CONFIG) => (!entidad || curp.slice(11, 13) === String(entidad).toUpperCase() ? '' : cfg.mensajes.czCurpEntidad)
    },
    /* La CURP y el nombre son coherentes (no prueba que la CURP exista). */
    'curp-nombre': {
      descripcion: 'Las letras de la CURP corresponden al nombre y al primer apellido (posiciones 1, 2, 4, 14 y 16)',
      campos: ['curp', 'nombre', 'primer'], bloquea: true,
      valida: ({ curp, nombre, primer }, a = {}, cfg = CONFIG) => {
        const e = letrasDeCurp({ nombre, primer, segundo: '' });
        if (!e) return '';
        /* La posición 3 viene de la propia CURP: así se reconoce la palabra altisonante sin pedir el segundo apellido. */
        const p2 = CURP_NOMBRE.altisonantes.includes(e.p1 + e.p2 + curp[2] + e.p4) ? 'X' : e.p2;
        return curp[0] === e.p1 && curp[1] === p2 && curp[3] === e.p4 && curp[13] === e.p14 && curp[15] === e.p16 ? '' : cfg.mensajes.curpNombre;
      }
    },
    /* El segundo apellido es opcional: sin él, la CURP lleva X en las posiciones 3 y 15. */
    'curp-segundo-apellido': {
      descripcion: 'Las letras de la CURP corresponden al segundo apellido (posiciones 3 y 15); sin segundo apellido, la CURP lleva X en las dos',
      campos: ['curp', 'segundo'], opcionales: ['segundo'], bloquea: true,
      valida: ({ curp, segundo }, a = {}, cfg = CONFIG) => {
        const a2 = palabraDeCurp(segundo);
        if (!a2) return curp[2] === 'X' && curp[14] === 'X' ? '' : cfg.mensajes.curpSinSegundo;
        return curp[2] === letraDeCurp(a2[0]) && curp[14] === consonanteInterna(a2) ? '' : cfg.mensajes.curpNombre;
      }
    },
    'rango-fechas': {
      descripcion: 'La fecha final no es anterior a la inicial',
      campos: ['inicio', 'fin'], bloquea: true,
      valida: ({ inicio, fin }, a = {}, cfg = CONFIG) => (fin >= inicio ? '' : cfg.mensajes.czRangoFechas)
    },
    'rango-horas': {
      descripcion: 'La hora final es posterior a la inicial cuando es el mismo día',
      campos: ['inicio', 'fin'], bloquea: true,
      valida: ({ inicio, fin }, a = {}, cfg = CONFIG) => (fin > inicio ? '' : cfg.mensajes.czRangoHoras)
    },
    'igual': {
      descripcion: 'Confirmación idéntica al original (correo, contraseña)',
      campos: ['original', 'confirmacion'], bloquea: true,
      valida: ({ original, confirmacion }, a = {}, cfg = CONFIG) => (original === confirmacion ? '' : cfg.mensajes.czIgual)
    },
    'edad': {
      descripcion: 'Edad calculada dentro de la mínima y máxima que exige el formulario',
      campos: ['fecha'], bloquea: true,
      valida: ({ fecha }, a = {}, cfg = CONFIG) => {
        const e = edadEn(fecha, hoyISO());
        if (a.edadMin !== undefined && e < Number(a.edadMin)) return plantilla(cfg.mensajes.edadMinima, { edad: a.edadMin });
        if (a.edadMax !== undefined && e > Number(a.edadMax)) return plantilla(cfg.mensajes.edadMaxima, { edad: a.edadMax });
        return '';
      }
    },
    'cp-colonia': {
      descripcion: 'El código postal pertenece a la alcaldía y colonia elegidas (advertencia, no bloqueo)',
      campos: ['cp', 'colonia'], bloquea: false,
      valida: ({ cp, colonia }, a = {}, cfg = CONFIG) => {
        const cat = a.catalogo || [];
        if (!cat.length) return '';
        const ok = cat.some((fila) => fila.cp === cp && fila.colonia === colonia);
        return ok ? '' : cfg.mensajes.czCpColonia;
      }
    }
  };

  /* «curp-fecha-dma»: el mismo cruce, con el nombre que usan los proyectos con fecha día/mes/año. */
  CRUZADAS['curp-fecha-dma'] = { ...CRUZADAS['curp-fecha'], descripcion: 'La fecha de nacimiento (día/mes/año) coincide con la contenida en la CURP' };

  /* ---------- Archivos ---------- */
  const ARCHIVOS = {
    extensiones: ['jpg', 'jpeg', 'png', 'pdf'],
    mb: 8,                 /* máximo por archivo, medido después de optimizar */
    mbTotal: 25,
    max: 5,
    minBytes: 1,           /* un archivo vacío se rechaza */
    /* Firmas (primeros bytes) por tipo real: la extensión se falsifica.
       El servidor repite esta comprobación. */
    firmas: {
      jpg: [[0xFF, 0xD8, 0xFF]], jpeg: [[0xFF, 0xD8, 0xFF]],
      png: [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
      pdf: [[0x25, 0x50, 0x44, 0x46]],
      webp: [[0x52, 0x49, 0x46, 0x46]],
      gif: [[0x47, 0x49, 0x46, 0x38]],
      heic: [[0x00, 0x00, 0x00]] /* HEIC lleva «ftyp» en el byte 4; se comprueba aparte */
    },
    optimiza: { tipos: ['jpg', 'jpeg', 'png', 'webp'], lado: 2048, calidad: 0.82 },
    imagen: { anchoMin: 320, altoMin: 240 },
    conservarExif: false,  /* decisión C6: la ubicación de la foto viaja sólo si el formulario la pide y la persona lo sabe */
    nombreMax: 120
  };

  /* ---------- Configuración ---------- */
  const CONFIG = {
    version: '1.4.1',
    idioma: 'es-MX',
    fechas: { zonaHoraria: 'America/Mexico_City' },
    /* Ámbito territorial. `cp` restringe el rango; `coordenadas` el
       rectángulo envolvente. Un formulario de alcance nacional pone null. */
    ambito: {
      cp: { min: '01000', max: '16999', mensaje: 'Ese código postal no es de la Ciudad de México: los de la Ciudad van del 01000 al 16999.' },
      coordenadas: { latMin: 19.05, latMax: 19.6, lonMin: -99.37, lonMax: -98.94, mensaje: 'El punto queda fuera de la Ciudad de México. Revisa las coordenadas.' }
    },
    textoLegible: TEXTO_LEGIBLE,
    curp: CURP,
    formatos: FORMATOS,
    cruzadas: CRUZADAS,
    archivos: ARCHIVOS,
    borrador: { ttlDias: 14, retardoMs: 600, visibleMs: 2500 },
    envio: { timeoutMs: 15000 },
    anuncios: { retardoMs: 50 },
    combo: { maxResultados: 8 },
    chips: { max: 5, clave: 'sia-chips' },
    /* Visor de documentos: dónde está pdf.js (vacío: vendor/pdfjs-dist/ junto
       al paquete), desde qué ancho queda fijo junto a lo que se revisa en lugar
       de abrirse a pantalla completa, y la espera para repintar al cambiar el tamaño. */
    visor: { pdfjs: '', fijoDesde: '(min-width: 1024px)', retardoMs: 250 },
    mensajes: {
      prefijoError: 'Error:',
      obligatorioTexto: 'Completa «{etiqueta}».',
      obligatorioOpcion: 'Elige una opción en «{etiqueta}».',
      obligatorioCasilla: 'Marca la casilla «{etiqueta}» para continuar.',
      obligatorioArchivos: 'Adjunta al menos un archivo en «{etiqueta}».',
      obligatorioOtro: 'Escribe cuál es la otra opción en «{etiqueta}».',
      minimoOpciones: 'Elige al menos {min} opciones en «{etiqueta}».',
      maximoOpciones: 'Elige como máximo {max} opciones en «{etiqueta}».',
      soloLista: 'Elige una opción de la lista en «{etiqueta}».',
      repiteOpcion: '«{texto}» ya está en la lista: elige esa opción.',
      edadMinima: 'Se requiere una edad mínima de {edad} años. Si la persona tiene menos, su madre, padre o tutor debe llenar el formulario.',
      edadMaxima: 'La edad máxima es de {edad} años.',
      curpNombre: 'La CURP no corresponde con el nombre y los apellidos que escribiste. Escríbelos tal como aparecen en tu CURP.',
      curpSinSegundo: 'Tu CURP indica que tienes segundo apellido. Escríbelo tal como aparece en tu CURP.',
      /* Formatos (fmt…) y cruzadas (cz…): un formulario que habla de usted los cambia aquí. */
      fmtNombre: 'Escribe sólo letras, espacios, apóstrofe, guion o punto. Ejemplo: María José',
      fmtNombreLargo: 'El nombre es demasiado largo: usa hasta {max} caracteres.',
      fmtCorreoLargo: 'El correo es demasiado largo: usa hasta {max} caracteres.',
      fmtCorreoArroba: 'El correo necesita una sola arroba, con texto antes y después. Ejemplo: nombre@dominio.mx',
      fmtCorreoDominio: 'Revisa el dominio después de la arroba: debe llevar un punto. Ejemplo: nombre@dominio.mx',
      fmtCorreoSugerencia: '¿Quisiste escribir {correo}?',
      fmtTelefono: 'Escribe 10 dígitos, sin lada internacional. Ejemplo: 5512345678',
      fmtCp: 'El código postal lleva 5 dígitos. Ejemplo: 01000',
      fmtCurpLargo: 'La CURP tiene {largo} caracteres; escribiste {n}.',
      fmtCurpEstructura: 'La CURP no tiene la estructura esperada. Revísala tal como aparece en tu documento.',
      fmtCurpFecha: 'La fecha dentro de la CURP (posiciones 5 a 10) no es una fecha real. Revísala.',
      fmtCurpFutura: 'La fecha de nacimiento dentro de la CURP está en el futuro. Revísala.',
      fmtCurpEntidad: 'La entidad de nacimiento dentro de la CURP (posiciones 12 y 13) no corresponde a ninguna clave. Revísala.',
      fmtCurpDigito: 'El último carácter de la CURP no coincide con el resto. Revisa que la hayas copiado completa y sin cambiar letras por números.',
      fmtRfc: 'El RFC lleva 3 o 4 letras, 6 dígitos de fecha y 3 caracteres finales. Ejemplo: XAXX010101000',
      fmtRfcFecha: 'La fecha dentro del RFC no es una fecha real. Revísala.',
      fmtNumero: 'Escribe sólo números; para decimales usa punto. Ejemplo: 12.5',
      fmtNumeroEntero: 'Escribe un número entero, sin decimales.',
      fmtNumeroPaso: 'Usa múltiplos de {paso}.',
      fmtNumeroMin: 'El valor mínimo es {min}.',
      fmtNumeroMax: 'El valor máximo es {max}.',
      fmtFecha: 'Escribe una fecha real con el formato AAAA-MM-DD. Ejemplo: 2026-03-15',
      fmtFechaDma: 'Escribe una fecha real como día/mes/año. Ejemplo: 23/07/1985',
      fmtFechaDmaAnio: 'Revisa el año: escribe los cuatro dígitos, de 1900 en adelante. Ejemplo: 1985',
      fmtFechaFutura: 'La fecha no puede ser posterior a hoy.',
      fmtFechaMax: 'La fecha no puede ser posterior al {fecha}.',
      fmtFechaMin: 'La fecha no puede ser anterior al {fecha}.',
      fmtHora: 'Escribe la hora en formato de 24 horas, HH:MM. Ejemplo: 14:30',
      fmtTextoMin: 'Escribe al menos {min} caracteres; van {n}.',
      fmtTextoMax: 'Usa hasta {max} caracteres; van {n}.',
      fmtTextoLegible: 'Descríbelo con tus palabras, en una o dos frases completas.',
      fmtCoordenadas: 'Escribe latitud y longitud separadas por coma. Ejemplo: 19.4326,-99.1332',
      fmtCoordenadasRango: 'Las coordenadas están fuera de rango: la latitud va de -90 a 90 y la longitud de -180 a 180.',
      fmtFolio: 'Escribe el folio tal como aparece en tu acuse, con letras, números y guiones.',
      fmtFolioFiscal: 'El folio fiscal tiene 36 caracteres: números y letras de la A a la F, en grupos de 8, 4, 4, 4 y 12 separados por guiones. Cópialo como aparece en la factura.',
      fmtContrasenaMin: 'La contraseña necesita al menos {min} caracteres. Una frase larga es más segura que una palabra con símbolos.',
      fmtContrasenaMax: 'La contraseña admite hasta {max} caracteres.',
      czCurpFecha: 'La fecha de nacimiento no coincide con la CURP. Revisa que ambos datos estén correctos.',
      czCurpSexo: 'El sexo indicado no coincide con el de la CURP. Revisa ambos datos.',
      czCurpEntidad: 'La entidad de nacimiento no coincide con la de la CURP. Revisa ambos datos.',
      czRangoFechas: 'La fecha final no puede ser anterior a la fecha inicial.',
      czRangoHoras: 'La hora final debe ser posterior a la hora inicial.',
      czIgual: 'Los dos valores no coinciden. Escríbelos igual en ambos campos.',
      czCpColonia: 'El código postal no corresponde a la colonia elegida según el catálogo. Revisa ambos datos; puedes continuar si estás seguro.',
      minimoCaracteres: 'Escribe al menos {min} caracteres en «{etiqueta}»; van {n}.',
      maximoCaracteres: 'Usa hasta {max} caracteres en «{etiqueta}».',
      advertencia: 'Advertencia:',
      resumenUno: 'Para continuar, revisa 1 respuesta.',
      resumenVarios: 'Para continuar, revisa {n} respuestas.',
      resumenServidorUno: 'No se pudo enviar: revisa 1 respuesta.',
      resumenServidorVarios: 'No se pudo enviar: revisa {n} respuestas.',
      resumenContexto: '{contexto}: {mensaje}',
      confirmaTitulo: '¿Confirmas?',
      confirmaSi: 'Confirmar',
      confirmaNo: 'Volver sin cambios',
      confirmaConsecuencias: 'Qué pasará:',
      confirmaIrreversible: 'No se puede deshacer.',
      resultadoHora: 'Quedó guardado a las {hora}',
      resultadoFechaHora: 'Quedó guardado el {fecha} a las {hora}',
      resultadoMotivo: 'Motivo',
      resultadoQueSigue: 'Qué sigue',
      descargaPreparando: 'Preparando el archivo…',
      descargaLista: 'Descarga iniciada.',
      descargaError: 'No se pudo preparar el archivo. Intenta de nuevo.',
      pasoAnuncio: 'Paso {n} de {total}: {titulo}.',
      pasoTexto: 'Paso {n} de {total}',
      pasoHecho: 'completado',
      pasoError: 'con errores',
      palabraObligatorio: 'obligatorio',
      contrasenaMostrar: 'Mostrar',
      contrasenaOcultar: 'Ocultar',
      contrasenaLector: ': {etiqueta}',
      palabraSi: 'Sí',
      palabraNo: 'No',
      sinValor: 'No indicado',
      editar: 'Editar',
      hoy: 'Hoy',
      ahora: 'Ahora',
      copiado: 'Copiado al portapapeles.',
      copiarFallo: 'No se pudo copiar. Selecciona el texto y cópialo a mano.',
      compartirFallo: 'Tu navegador no permite compartir desde aquí. Copia el enlace.',
      borradorGuardado: 'Borrador guardado en este dispositivo.',
      enviando: 'Enviando…',
      envioError: 'No se pudo enviar. Lo que capturaste sigue aquí; intenta de nuevo.',
      envioTimeout: 'El envío tardó demasiado y se detuvo. Lo que capturaste sigue aquí; intenta de nuevo.',
      envioLimite: 'Por ahora no podemos recibir más envíos desde este dispositivo. Lo que capturaste no se perdió; intenta más tarde.',
      archOptimizando: 'Optimizando…',
      archOptimizada: '{peso} · optimizada',
      archPeso: '{peso}',
      archQuitar: 'Quitar archivo {nombre}',
      archRechazoTitulo: 'No se agregó «{nombre}»:',
      archRechazoMax: 'sólo se admiten {max} archivos.',
      archRechazoMaxUno: 'sólo se admite un archivo.',
      archRechazoTipo: 'ese tipo de archivo no se admite. Los formatos son {formatos}.',
      archRechazoFirma: 'el contenido del archivo no corresponde a su extensión. Elige el archivo original.',
      archRechazoPeso: 'pesa {peso} y el máximo es {mb} MB. Reduce su tamaño o elige otro.',
      archRechazoTotal: 'con él se superan los {mb} MB en total.',
      archRechazoVacio: 'el archivo está vacío.',
      archRechazoDuplicado: 'ya adjuntaste ese mismo archivo.',
      archRechazoDimension: 'la imagen es demasiado pequeña (mínimo {ancho} × {alto} píxeles).',
      archRechazoOptimizada: 'aun optimizada pesa {peso} y el máximo es {mb} MB.',
      archLimite: '{admitidos}: {formatos}. Hasta {max} archivos de {mb} MB cada uno.',
      archLimiteUno: '{admitidos}: {formatos}. Un archivo de hasta {mb} MB.',
      archFormatos: 'Formatos admitidos',
      archFormato: 'Formato admitido',
      archLleno: 'Ya adjuntaste los {max} archivos. Para cambiar uno, quítalo.',
      archLlenoUno: 'Ya adjuntaste el archivo. Para cambiarlo, quítalo.',
      archAgregado: 'Se agregó {nombre}.',
      archQuitado: 'Se quitó {nombre}.',
      archReintentar: 'Reintentar',
      comboUno: 'Un resultado disponible.',
      comboVarios: '{n} resultados disponibles.',
      comboNinguno: 'Sin resultados para «{texto}».',
      comboLibre: 'No está en la lista: se guarda como lo escribiste.',
      tablaOrdenada: 'Ordenado por {columna}, {sentido}.',
      tablaAscendente: 'ascendente',
      tablaDescendente: 'descendente',
      cascadaEspera: 'Primero elige {padre}.',
      cascadaReiniciada: 'Se reinició «{etiqueta}» porque cambió «{padre}».',
      cascadaSinCatalogo: 'No se pudo cargar la lista; escribe el dato a mano.',
      paginacionRango: 'Mostrando {desde}–{hasta} de {total}',
      paginacionPagina: 'Página {n} de {total}',
      paginacionAnuncio: 'Página {n} de {total} cargada.',
      filaQuitar: 'Quitar fila {n}',
      filaAgregar: 'Agregar otro',
      filaConfirma: '¿Quitar esta fila? Tiene datos capturados.',
      repetibleMin: 'Agrega al menos {min} elementos en «{etiqueta}».',
      repetibleMax: 'Como máximo se admiten {max} elementos en «{etiqueta}».',
      mapaSinPunto: 'Sin punto marcado.',
      mapaPunto: 'Punto marcado: {lat}, {lon}.',
      mapaFuera: 'El punto queda fuera del ámbito. Muévelo o escribe la dirección.',
      chipsBorrar: 'Borrar historial',
      chipsQuitar: 'Quitar {texto} de las sugerencias',
      chipsFijos: 'Respuestas frecuentes para {etiqueta}',
      chipsFijosContexto: '{nombre}, {contexto}',
      chipsFijosOrden: '{n} de {total}',
      chipsAgregado: 'Agregado: {texto}',
      visorCargando: 'Cargando el documento…',
      visorError: 'No se pudo mostrar el documento aquí. Ábrelo en otra pestaña con el enlace de arriba.',
      visorNavegador: 'Se muestra con el visor del navegador. Si no lo ves completo, ábrelo en otra pestaña con el enlace de arriba.',
      visorHoja: 'Hoja {n} de {total}',
      sesionExpira: 'Tu sesión terminará en {min} minutos. Guarda o continúa para mantenerla.'
    }
  };

  return Object.assign(CONFIG, { pareceTexto, fechaDeCurp, digitoCurp, letrasDeCurp, prefijoCurp, isoDeDma, dmaDeIso, guiaFechaDma, hoyISO, ahoraHM, edadEn, plantilla, recorta, soloDigitos, distancia, formatosArchivo });
}));
