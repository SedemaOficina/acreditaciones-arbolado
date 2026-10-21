// C5 · Inventario de textos EN EL CÓDIGO: lo que solo sale en un caso (avisos, errores, rechazos).
// Extrae cadenas de sitio/app/*.js (con su archivo:línea), los mensajes del estándar (sitio/formkit: validaciones y
// módulos), los mensajes de la base (apd.error en db/apd/03-apd-reglas.sql), los avisos por correo
// (docs/AVISOS-POR-CORREO.md) y los textos fijos de los 21 HTML (incluidos los ocultos).
//   node c5-fuentes.mjs → c5-fuentes.json
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { RAIZ, EVID } from './comun.mjs';

const SITIO = join(RAIZ, 'sitio');
const out = [];
const PERSONAL = /^(personal|revision|revisar|citas|cotejo|grupos|grupo|programar|asistencia|aplicar|material-personal|mensajes-usted|config-cotejo|examen-grupo)\.js$/;
const PERSONA = /^(tramites|solicitud|corregir|cuenta|entrar|datos|inicio|material|config-(solicitud|corregir|cuenta|datos|entrar|verificar)|formatos-propios|perfil-academico)\.js$/;
const EXAMEN = /^(examen|examen-servidor|config-examen|codigo-examen)\.js$/;
const PRUEBA = /^(pruebas|casos-prueba|archivos-prueba|version-visible)\.js$/;
const publicoDe = (f) => (PERSONAL.test(f) ? 'personal' : PERSONA.test(f) ? 'persona' : EXAMEN.test(f) ? 'persona (examen)' : PRUEBA.test(f) ? 'prueba (persona y personal)' : 'compartido');

// Cadenas de un archivo JS: '…', "…" y `…` (las ${…} quedan como «…»), sin comentarios ni expresiones regulares
function cadenas(src) {
  const r = [];
  let i = 0, linea = 1, prev = '';
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === '\n') { linea++; i++; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < n && src[i] !== '\n') i++; continue; }
    if (c === '/' && src[i + 1] === '*') { i += 2; while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') linea++; i++; } i += 2; continue; }
    if (c === '/' && /[(,=:[!&|?{};+\-*%<>~^]$|^$|return$|typeof$/.test(prev)) { // expresión regular
      i++; let clase = false;
      while (i < n) { const d = src[i]; if (d === '\\') { i += 2; continue; } if (d === '[') clase = true; else if (d === ']') clase = false; else if (d === '/' && !clase) break; else if (d === '\n') break; i++; }
      i++; while (/[a-z]/.test(src[i] || '')) i++; prev = 'x'; continue;
    }
    if (c === '"' || c === "'" || c === '`') {
      const ini = linea; let s = ''; i++;
      while (i < n && src[i] !== c) {
        if (src[i] === '\\') { const e = src[i + 1]; s += e === 'n' ? '\n' : e === 'u' ? String.fromCharCode(parseInt(src.slice(i + 2, i + 6), 16)) : e; i += e === 'u' ? 6 : 2; continue; }
        if (c === '`' && src[i] === '$' && src[i + 1] === '{') { let prof = 1; i += 2; while (i < n && prof) { if (src[i] === '{') prof++; else if (src[i] === '}') prof--; else if (src[i] === '\n') linea++; i++; } s += '«…»'; continue; }
        if (src[i] === '\n') linea++;
        s += src[i]; i++;
      }
      i++; r.push({ linea: ini, texto: s }); prev = 'x'; continue;
    }
    if (!/\s/.test(c)) prev = /[\w$]/.test(c) ? (prev + c).slice(-10).replace(/^.*[^\w$]/, '') : c;
    i++;
  }
  return r;
}
// ¿Es texto para personas? Al menos dos palabras con letras y no es un selector, una clase, una ruta o un atributo
const esTexto = (t) => {
  const s = t.trim();
  if (s.length < 4 || !/[a-záéíóúñ]{2,}/i.test(s)) return false;
  if (!/\s/.test(s) && !/[áéíóúñ¿¡]/i.test(s)) return /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+[.:]?$/.test(s) && s.length > 4; // una palabra con mayúscula inicial (botones, rótulos)
  if (/^[.#[\w-]+(\s*[>,+~]\s*|\s+)[.#[\w-]/.test(s) && !/[áéíóúñ]/.test(s) && !/\b(de|la|el|en|y|que|se)\b/.test(s)) return false; // selectores CSS
  if (/^(https?:|\.\/|[\w-]+\.(html|js|json|css|pdf)\b)/.test(s)) return false;
  if (/^[a-z-]+(\s[a-z-]+)*$/.test(s) && !/\b(de|la|el|en|y|que|se|un|una|los|las|del|al|con|por|para|no|su|tu)\b/.test(s)) return false; // listas de clases
  return true;
};

for (const f of readdirSync(join(SITIO, 'app')).filter((x) => x.endsWith('.js'))) {
  const src = readFileSync(join(SITIO, 'app', f), 'utf8');
  for (const { linea, texto } of cadenas(src)) if (esTexto(texto)) out.push({ origen: 'código del sitio', archivo: `sitio/app/${f}`, linea, publico: publicoDe(f), texto: texto.replace(/\s+/g, ' ').trim() });
}
// Estándar: mensajes de validaciones y de módulos (los que se ven en las pantallas)
const formkit = [join(SITIO, 'formkit/js/validaciones.config.js'), join(SITIO, 'formkit/js/formkit.core.js'),
  ...readdirSync(join(SITIO, 'formkit/modulos')).flatMap((m) => readdirSync(join(SITIO, 'formkit/modulos', m)).filter((x) => x.endsWith('.js')).map((x) => join(SITIO, 'formkit/modulos', m, x)))];
for (const p of formkit) {
  const src = readFileSync(p, 'utf8');
  for (const { linea, texto } of cadenas(src)) if (esTexto(texto)) out.push({ origen: 'estándar 1.5.1', archivo: p.replace(RAIZ + '/', ''), linea, publico: 'estándar (tú por omisión)', texto: texto.replace(/\s+/g, ' ').trim() });
}
// Base de datos: apd.error(código, mensaje) — el mensaje es para la persona o el personal según la regla
{
  const p = join(RAIZ, 'db/apd/03-apd-reglas.sql');
  const l = readFileSync(p, 'utf8').split('\n');
  l.forEach((t, k) => {
    const m = t.match(/apd\.error\('([a-z_]+)',\s*(?:format\()?'((?:[^']|'')*)'/);
    if (m) out.push({ origen: 'base de datos', archivo: 'db/apd/03-apd-reglas.sql', linea: k + 1, publico: 'base (persona o personal)', codigo: m[1], texto: m[2].replace(/''/g, "'") });
  });
}
// Avisos por correo
{
  const p = join(RAIZ, 'docs/AVISOS-POR-CORREO.md');
  readFileSync(p, 'utf8').split('\n').forEach((t, k) => { if (/^\|/.test(t) && !/^\|\s*-/.test(t)) out.push({ origen: 'avisos por correo', archivo: 'docs/AVISOS-POR-CORREO.md', linea: k + 1, publico: /personal|Dirección/i.test(t) && !/persona solicitante/i.test(t) ? 'personal' : 'persona', texto: t.replace(/\s+/g, ' ').trim() }); });
}
writeFileSync(join(EVID, 'c5-fuentes.json'), JSON.stringify(out, null, 1));
const cuenta = {};
for (const x of out) cuenta[x.origen] = (cuenta[x.origen] || 0) + 1;
console.log(out.length, 'cadenas', JSON.stringify(cuenta));
