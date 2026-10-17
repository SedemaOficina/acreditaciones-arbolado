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
  const sinAcentos = (v) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const esFechaReal = (a, m, d) => { const f = new Date(Date.UTC(a, m - 1, d)); return f.getUTCFullYear() === a && f.getUTCMonth() === m - 1 && f.getUTCDate() === d; };
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

  /* ---------- Formatos por tipo de dato ---------- */
  const FORMATOS = {
    nombre: {
      descripcion: 'Nombre o apellido de persona',
      inputmode: 'text', autocomplete: 'given-name',
      normaliza: (v) => recorta(v),
      valida: (v, a = {}) => {
        if (!/^[\p{L}\p{M}' .\-]+$/u.test(v)) return 'Escribe sólo letras, espacios, apóstrofe, guion o punto. Ejemplo: María José';
        if (v.length > (a.maxlength || 80)) return `El nombre es demasiado largo: usa hasta ${a.maxlength || 80} caracteres.`;
        return '';
      }
    },
    correo: {
      descripcion: 'Correo electrónico',
      inputmode: 'email', autocomplete: 'email',
      dominiosFrecuentes: ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com', 'live.com.mx', 'hotmail.es'],
      normaliza: (v) => recorta(v).toLowerCase().replace(/\s/g, ''),
      valida: (v, a = {}) => {
        if (v.length > (a.maxlength || 120)) return `El correo es demasiado largo: usa hasta ${a.maxlength || 120} caracteres.`;
        const partes = v.split('@');
        if (partes.length !== 2 || !partes[0] || !partes[1]) return 'El correo necesita una sola arroba, con texto antes y después. Ejemplo: nombre@dominio.mx';
        if (!/^[^\s@]+\.[^\s@.]{2,}$/.test(partes[1])) return 'Revisa el dominio después de la arroba: debe llevar un punto. Ejemplo: nombre@dominio.mx';
        return '';
      },
      /* Sugerencia sin bloqueo para errores de dedo frecuentes («gmial.com»). */
      sugiere: (v) => {
        const dom = (v.split('@')[1] || '').toLowerCase();
        if (!dom || FORMATOS.correo.dominiosFrecuentes.includes(dom)) return '';
        const cerca = FORMATOS.correo.dominiosFrecuentes.find((d) => distancia(d, dom) === 1);
        return cerca ? `¿Quisiste escribir ${v.split('@')[0]}@${cerca}?` : '';
      }
    },
    telefono: {
      descripcion: 'Teléfono de México: diez dígitos',
      inputmode: 'tel', autocomplete: 'tel-national',
      /* Se aceptan espacios, guiones y paréntesis al escribir; un prefijo
         +52 o 52 se retira. La regla de diez dígitos es la de México y debe
         confirmarse con el plan de numeración vigente [Fuente: __]. */
      normaliza: (v) => { let d = soloDigitos(String(v).replace(/^\s*\+?52\s*/, '')); if (d.length === 12 && d.startsWith('52')) d = d.slice(2); return d; },
      valida: (v) => (/^\d{10}$/.test(v) ? '' : 'Escribe 10 dígitos, sin lada internacional. Ejemplo: 5512345678')
    },
    cp: {
      descripcion: 'Código postal: cinco dígitos, se conserva como texto',
      inputmode: 'numeric', autocomplete: 'postal-code',
      normaliza: (v) => soloDigitos(v),
      valida: (v) => {
        if (!/^\d{5}$/.test(v)) return 'El código postal lleva 5 dígitos. Ejemplo: 01000';
        const am = CONFIG.ambito.cp;
        if (am && (v < am.min || v > am.max)) return am.mensaje;
        return '';
      }
    },
    curp: {
      descripcion: 'CURP: 18 caracteres',
      inputmode: 'text', autocomplete: 'off',
      normaliza: (v) => sinAcentos(recorta(v)).toUpperCase().replace(/\s/g, ''),
      valida: (v) => {
        if (v.length !== CURP.largo) return `La CURP tiene ${CURP.largo} caracteres; escribiste ${v.length}.`;
        if (!CURP.re.test(v)) return 'La CURP no tiene la estructura esperada. Revísala tal como aparece en tu documento.';
        if (!fechaDeCurp(v)) return 'La fecha dentro de la CURP (posiciones 5 a 10) no es una fecha real. Revísala.';
        if (fechaDeCurp(v) > hoyISO()) return 'La fecha de nacimiento dentro de la CURP está en el futuro. Revísala.';
        if (!CURP.entidades.includes(v.slice(11, 13))) return 'La entidad de nacimiento dentro de la CURP (posiciones 12 y 13) no corresponde a ninguna clave. Revísala.';
        if (CURP.verificarDigito && digitoCurp(v) !== v[17]) return 'El último carácter de la CURP no coincide con el resto. Revisa que la hayas copiado completa y sin cambiar letras por números.';
        return '';
      },
      /* Datos derivables para mostrarlos en solo lectura (minimización). */
      deriva: (v) => ({ fechaNacimiento: fechaDeCurp(v), sexo: v[10], entidad: v.slice(11, 13) })
    },
    rfc: {
      descripcion: 'RFC: 12 caracteres (persona moral) o 13 (persona física). Estructura a confirmar con el emisor [Fuente: __]',
      inputmode: 'text', autocomplete: 'off',
      normaliza: (v) => sinAcentos(recorta(v)).toUpperCase().replace(/[\s-]/g, ''),
      valida: (v) => {
        if (!/^([A-ZÑ&]{3,4})(\d{6})([A-Z0-9]{3})$/.test(v)) return 'El RFC lleva 3 o 4 letras, 6 dígitos de fecha y 3 caracteres finales. Ejemplo: XAXX010101000';
        const aa = Number(v.slice(-9, -7)), mm = Number(v.slice(-7, -5)), dd = Number(v.slice(-5, -3));
        if (!esFechaReal(2000 + aa, mm, dd) && !esFechaReal(1900 + aa, mm, dd)) return 'La fecha dentro del RFC no es una fecha real. Revísala.';
        return '';
      }
    },
    numero: {
      descripcion: 'Número entero o decimal con mínimo, máximo y paso configurables en el campo',
      inputmode: 'decimal', autocomplete: 'off',
      normaliza: (v) => recorta(v).replace(/\s/g, '').replace(',', '.'),
      valida: (v, a = {}) => {
        if (!/^-?\d+(\.\d+)?$/.test(v)) return 'Escribe sólo números; para decimales usa punto. Ejemplo: 12.5';
        const n = Number(v);
        if (a.step && a.step !== 'any' && Number(a.step) >= 1 && !Number.isInteger(n)) return 'Escribe un número entero, sin decimales.';
        if (a.min !== undefined && a.min !== '' && n < Number(a.min)) return `El valor mínimo es ${a.min}.`;
        if (a.max !== undefined && a.max !== '' && n > Number(a.max)) return `El valor máximo es ${a.max}.`;
        return '';
      }
    },
    fecha: {
      descripcion: 'Fecha real en formato AAAA-MM-DD con límites configurables',
      inputmode: 'numeric', autocomplete: 'off',
      normaliza: (v) => recorta(v),
      valida: (v, a = {}) => {
        const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m || !esFechaReal(Number(m[1]), Number(m[2]), Number(m[3]))) return 'Escribe una fecha real con el formato AAAA-MM-DD. Ejemplo: 2026-03-15';
        if (a.max && v > a.max) return a.max === hoyISO() ? 'La fecha no puede ser posterior a hoy.' : `La fecha no puede ser posterior al ${a.max}.`;
        if (a.min && v < a.min) return `La fecha no puede ser anterior al ${a.min}.`;
        return '';
      }
    },
    hora: {
      descripcion: 'Hora en formato de 24 horas',
      inputmode: 'numeric', autocomplete: 'off',
      normaliza: (v) => recorta(v),
      valida: (v) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? '' : 'Escribe la hora en formato de 24 horas, HH:MM. Ejemplo: 14:30')
    },
    texto: {
      descripcion: 'Texto libre con longitud mínima y máxima; neutraliza marcado y caracteres de control',
      inputmode: 'text', autocomplete: 'off',
      normaliza: (v) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim(),
      valida: (v, a = {}) => {
        if (a.minlength && v.length < Number(a.minlength)) return `Escribe al menos ${a.minlength} caracteres; van ${v.length}.`;
        if (a.maxlength && v.length > Number(a.maxlength)) return `Usa hasta ${a.maxlength} caracteres; van ${v.length}.`;
        if (a.legible !== undefined && !pareceTexto(v)) return 'Descríbelo con tus palabras, en una o dos frases completas.';
        return '';
      }
    },
    coordenadas: {
      descripcion: 'Latitud y longitud dentro del rectángulo envolvente configurado',
      inputmode: 'decimal', autocomplete: 'off',
      normaliza: (v) => recorta(v).replace(/\s/g, ''),
      valida: (v) => {
        const m = v.match(/^(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)$/);
        if (!m) return 'Escribe latitud y longitud separadas por coma. Ejemplo: 19.4326,-99.1332';
        const lat = Number(m[1]), lon = Number(m[2]);
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return 'Las coordenadas están fuera de rango: la latitud va de -90 a 90 y la longitud de -180 a 180.';
        const b = CONFIG.ambito.coordenadas;
        if (b && (lat < b.latMin || lat > b.latMax || lon < b.lonMin || lon > b.lonMax)) return b.mensaje;
        return '';
      }
    },
    folio: {
      descripcion: 'Folio o clave alfanumérica con guiones',
      inputmode: 'text', autocomplete: 'off',
      normaliza: (v) => recorta(v).toUpperCase().replace(/\s/g, ''),
      valida: (v, a = {}) => (/^[A-Z0-9][A-Z0-9-]{2,}$/.test(v) && v.length <= (a.maxlength || 40) ? '' : 'Escribe el folio tal como aparece en tu acuse, con letras, números y guiones.')
    },
    contrasena: {
      descripcion: 'Contraseña: sin límite máximo restrictivo ni bloqueo del pegado',
      inputmode: 'text', autocomplete: 'new-password',
      normaliza: (v) => String(v ?? ''),
      valida: (v, a = {}) => {
        const min = Number(a.minlength || 12);
        if (v.length < min) return `La contraseña necesita al menos ${min} caracteres. Una frase larga es más segura que una palabra con símbolos.`;
        if (a.maxlength && v.length > Number(a.maxlength)) return `La contraseña admite hasta ${a.maxlength} caracteres.`;
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
      valida: ({ curp, fecha }) => (fechaDeCurp(curp) === fecha ? '' : 'La fecha de nacimiento no coincide con la CURP. Revisa que ambos datos estén correctos.')
    },
    'curp-sexo': {
      descripcion: 'El sexo declarado coincide con la posición 11 de la CURP',
      campos: ['curp', 'sexo'], bloquea: false,
      valida: ({ curp, sexo }) => (!sexo || curp[10] === String(sexo).toUpperCase()[0] ? '' : 'El sexo indicado no coincide con el de la CURP. Revisa ambos datos.')
    },
    'curp-entidad': {
      descripcion: 'La entidad de nacimiento coincide con las posiciones 12 y 13 de la CURP',
      campos: ['curp', 'entidad'], bloquea: false,
      valida: ({ curp, entidad }) => (!entidad || curp.slice(11, 13) === String(entidad).toUpperCase() ? '' : 'La entidad de nacimiento no coincide con la de la CURP. Revisa ambos datos.')
    },
    'rango-fechas': {
      descripcion: 'La fecha final no es anterior a la inicial',
      campos: ['inicio', 'fin'], bloquea: true,
      valida: ({ inicio, fin }) => (fin >= inicio ? '' : 'La fecha final no puede ser anterior a la fecha inicial.')
    },
    'rango-horas': {
      descripcion: 'La hora final es posterior a la inicial cuando es el mismo día',
      campos: ['inicio', 'fin'], bloquea: true,
      valida: ({ inicio, fin }) => (fin > inicio ? '' : 'La hora final debe ser posterior a la hora inicial.')
    },
    'igual': {
      descripcion: 'Confirmación idéntica al original (correo, contraseña)',
      campos: ['original', 'confirmacion'], bloquea: true,
      valida: ({ original, confirmacion }) => (original === confirmacion ? '' : 'Los dos valores no coinciden. Escríbelos igual en ambos campos.')
    },
    'edad': {
      descripcion: 'Edad calculada dentro de la mínima y máxima del trámite',
      campos: ['fecha'], bloquea: true,
      valida: ({ fecha }, a = {}) => {
        const e = edadEn(fecha, hoyISO());
        if (a.edadMin !== undefined && e < Number(a.edadMin)) return plantilla(CONFIG.mensajes.edadMinima, { edad: a.edadMin });
        if (a.edadMax !== undefined && e > Number(a.edadMax)) return plantilla(CONFIG.mensajes.edadMaxima, { edad: a.edadMax });
        return '';
      }
    },
    'cp-colonia': {
      descripcion: 'El código postal pertenece a la alcaldía y colonia elegidas (advertencia, no bloqueo)',
      campos: ['cp', 'colonia'], bloquea: false,
      valida: ({ cp, colonia }, a = {}) => {
        const cat = a.catalogo || [];
        if (!cat.length) return '';
        const ok = cat.some((fila) => fila.cp === cp && fila.colonia === colonia);
        return ok ? '' : 'El código postal no corresponde a la colonia elegida según el catálogo. Revisa ambos datos; puedes continuar si estás seguro.';
      }
    }
  };

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
    conservarExif: false,  /* decisión C6: la ubicación de la foto viaja sólo si el trámite lo pide y la persona lo sabe */
    nombreMax: 120
  };

  /* ---------- Configuración ---------- */
  const CONFIG = {
    version: '1.0.0',
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
      edadMinima: 'Se requiere una edad mínima de {edad} años. Si la persona es menor, el trámite debe hacerlo su madre, padre o tutor.',
      edadMaxima: 'La edad máxima para este trámite es de {edad} años.',
      advertencia: 'Advertencia:',
      resumenUno: 'Falta revisar 1 campo para continuar.',
      resumenVarios: 'Faltan por revisar {n} campos para continuar.',
      pasoAnuncio: 'Paso {n} de {total}: {titulo}.',
      pasoTexto: 'Paso {n} de {total}',
      pasoHecho: 'completado',
      pasoError: 'con errores',
      palabraObligatorio: 'obligatorio',
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
      archRechazoTipo: 'ese tipo de archivo no se admite. Los formatos son {formatos}.',
      archRechazoFirma: 'el contenido del archivo no corresponde a su extensión. Elige el archivo original.',
      archRechazoPeso: 'pesa {peso} y el máximo es {mb} MB. Reduce su tamaño o elige otro.',
      archRechazoTotal: 'con él se superan los {mb} MB en total.',
      archRechazoVacio: 'el archivo está vacío.',
      archRechazoDuplicado: 'ya adjuntaste ese mismo archivo.',
      archRechazoDimension: 'la imagen es demasiado pequeña (mínimo {ancho} × {alto} píxeles).',
      archRechazoOptimizada: 'aun optimizada pesa {peso} y el máximo es {mb} MB.',
      archLimite: 'Formatos admitidos: {formatos}. Hasta {max} archivos de {mb} MB cada uno.',
      archAgregado: 'Se agregó {nombre}.',
      archQuitado: 'Se quitó {nombre}.',
      archReintentar: 'Reintentar',
      comboUno: 'Un resultado disponible.',
      comboVarios: '{n} resultados disponibles.',
      comboNinguno: 'Sin resultados para «{texto}».',
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
      sesionExpira: 'Tu sesión terminará en {min} minutos. Guarda o continúa para mantenerla.'
    }
  };

  return Object.assign(CONFIG, { pareceTexto, fechaDeCurp, digitoCurp, hoyISO, ahoraHM, edadEn, plantilla, recorta, soloDigitos, distancia });
}));
