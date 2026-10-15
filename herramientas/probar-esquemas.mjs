// SEGUNDA VALIDACIÓN (servidor): regenera el esquema de cada formulario desde su HTML con la herramienta del
// Estándar de formularios del SIA y comprueba con su validar.mjs que el servidor acepta lo correcto y rechaza
// lo incorrecto, con las mismas reglas que el navegador.
//
// Uso: node herramientas/probar-esquemas.mjs <ruta-al-clon-de-estandar-formularios>
// Escribe db/esquemas-formularios/<formulario>.json (generados; no se editan a mano).

import { execFileSync } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const estandar = process.argv[2];
if (!estandar) { console.error('Uso: node herramientas/probar-esquemas.mjs <ruta-al-clon-de-estandar-formularios>'); process.exit(2); }
const { validaPayload } = await import(pathToFileURL(join(estandar, 'codigo/servidor/validar.mjs')).href);
// Las validaciones cruzadas propias (CURP ↔ nombre) se suman a las del estándar, como en el navegador
await import(pathToFileURL(join(raiz, 'sitio/app/curp-nombre.js')).href);
const cfgEstandar = globalThis.FORMKIT_VALIDACIONES;
const config = { ...cfgEstandar, cruzadas: { ...cfgEstandar.cruzadas, ...globalThis.APD_CRUZADAS } };

const salida = join(raiz, 'db/esquemas-formularios');
mkdirSync(salida, { recursive: true });
const esquema = {};
for (const f of ['cuenta', 'entrar', 'solicitud', 'verificar']) {
  execFileSync('node', [join(estandar, 'herramientas/esquema-desde-html.mjs'), join(raiz, 'sitio', `${f}.html`), join(salida, `${f}.json`)]);
  esquema[f] = JSON.parse(readFileSync(join(salida, `${f}.json`), 'utf8'));
}

let fallas = 0;
const meta = { trampa: '', ms_en_formulario: 90000, idempotencia: 'prueba' };
const pdf = (n) => ({ nombre: `${n}.pdf`, size: 200000, type: 'application/pdf', campo: n });
// Como lo hará la API: los campos auxiliares no se reciben, el servidor los calcula.
//   · cuenta: sin_segundo_apellido = «si» si el segundo apellido viene vacío;
//   · solicitud: tramite = tipo + modalidad; la modalidad la decide la base por el historial (aquí la indica
//     el caso en `_modalidad`).
function comoServidor(form, datos) {
  const d = { ...datos };
  if (form === 'cuenta') {
    delete d.sin_segundo_apellido;
    if (!String(d.segundo_apellido || '').trim()) { delete d.segundo_apellido; d.sin_segundo_apellido = 'si'; }
  }
  if (form === 'solicitud') {
    delete d.tramite;
    if (d.tipo) d.tramite = `${d.tipo}_${d._modalidad || 'nueva'}`;
    delete d._modalidad;
  }
  return d;
}
function caso(nombre, form, datos, espera, archivos = []) {
  const r = validaPayload({ datos: comoServidor(form, datos), archivos, meta }, esquema[form], { config });
  const campos = r.errores.map((e) => e.campo);
  const ok = espera === true ? r.ok : !r.ok && espera.every((c) => campos.includes(c)) && campos.every((c) => espera.includes(c));
  console.log(`${ok ? 'BIEN' : 'MAL '}  ${nombre}${ok ? '' : ` → ${JSON.stringify([...new Set(campos)])}`}`);
  if (!ok) fallas++;
}

const ALFABETO = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
const conDigito = (b) => { let s = 0; for (let i = 0; i < 17; i++) s += ALFABETO.indexOf(b[i]) * (18 - i); return b + String((10 - (s % 10)) % 10); };
const curpNadia = conDigito(globalThis.APD_CURP.prefijo({ nombre: 'Nadia', primer: 'Ejemplo', segundo: 'Simulado' }, '1999-12-30', 'M', 'NE') + '0');
const cuenta = { nombre: 'Nadia', primer_apellido: 'Ejemplo', segundo_apellido: 'Simulado', fecha_nacimiento: '1999-12-30', curp: curpNadia, correo: 'nadia@ejemplo.local', correo2: 'nadia@ejemplo.local', telefono: '5500000077', contrasena: 'una frase larga de prueba', contrasena2: 'una frase larga de prueba', aviso: 'si', humano: 'si' };
caso('Cuenta completa se acepta', 'cuenta', cuenta, true);
caso('Cuenta: CURP con dígito incorrecto y correo sin confirmar se rechazan', 'cuenta', { ...cuenta, curp: curpNadia.slice(0, 17) + ((Number(curpNadia[17]) + 1) % 10), correo2: 'otra@ejemplo.local' }, ['curp', 'correo2']);
caso('Cuenta: una CURP ajena (de otro nombre) se rechaza', 'cuenta', { ...cuenta, nombre: 'Pedro', primer_apellido: 'López' }, ['curp']);
caso('Cuenta: otro segundo apellido se rechaza', 'cuenta', { ...cuenta, segundo_apellido: 'Muestra' }, ['curp']);
const curpUriel = conDigito(globalThis.APD_CURP.prefijo({ nombre: 'Uriel', primer: 'Ejemplo', segundo: '' }, '1988-04-09', 'H', 'NE') + '0');
caso('Cuenta sin segundo apellido se acepta', 'cuenta', { ...cuenta, nombre: 'Uriel', segundo_apellido: '', fecha_nacimiento: '1988-04-09', curp: curpUriel }, true);
caso('Cuenta: dejar vacío el segundo apellido con una CURP que sí lo tiene se rechaza', 'cuenta', { ...cuenta, segundo_apellido: '' }, ['curp']);
caso('Cuenta: el campo auxiliar enviado por el navegador no cuenta (lo calcula el servidor)', 'cuenta', { ...cuenta, segundo_apellido: '', sin_segundo_apellido: '' }, ['curp']);
caso('Cuenta: otra fecha de nacimiento se rechaza', 'cuenta', { ...cuenta, fecha_nacimiento: '1999-12-31' }, ['curp']);
caso('Cuenta: sin fecha de nacimiento se rechaza', 'cuenta', { ...cuenta, fecha_nacimiento: '' }, ['fecha_nacimiento']);
caso('Cuenta: contraseña corta se rechaza', 'cuenta', { ...cuenta, contrasena: 'corta', contrasena2: 'corta' }, ['contrasena', 'contrasena2']);
caso('Cuenta: sin aviso de privacidad se rechaza', 'cuenta', { ...cuenta, aviso: '' }, ['aviso']);

// Solicitud: lo obligatorio depende del trámite elegido, con una sola condición por bloque
const docs = (t, lista) => Object.fromEntries(lista.map((r) => [`doc_${t}_${r}`, `${r}.pdf`]));
const base = { aviso: 'si', humano: 'si' };
const podaNueva = ['identificacion_oficial', 'curp', 'comprobante_domicilio', 'constancia_situacion_fiscal'];
caso('Solicitud poda nueva con sus 4 documentos se acepta', 'solicitud', { ...base, tipo: 'poda', ...docs('poda_nueva', podaNueva) }, true, podaNueva.map((r) => pdf(`doc_poda_nueva_${r}`)));
caso('Solicitud poda nueva sin documentos pide sólo los de poda nueva', 'solicitud', { ...base, tipo: 'poda' }, podaNueva.map((r) => `doc_poda_nueva_${r}`));
caso('Solicitud dictaminador nueva sin perfil ni documentos pide perfil y sus 8 documentos', 'solicitud', { ...base, tipo: 'dictaminador' },
  ['perfil_academico', 'carrera', 'anios_experiencia', ...['identificacion_oficial', 'curp', 'comprobante_domicilio', 'constancia_situacion_fiscal', 'comprobante_estudios', 'curriculum_vitae', 'comprobantes_experiencia', 'constancias_capacitacion'].map((r) => `doc_dictaminador_nueva_${r}`)]);
caso('Solicitud poda renovación pide sólo la constancia de situación fiscal (lo demás es «si aplica»)', 'solicitud', { ...base, tipo: 'poda', _modalidad: 'renovacion', anterior: 'PD-2025-K106' }, ['doc_poda_renovacion_constancia_situacion_fiscal']);
caso('Solicitud con una acreditación que no existe se rechaza', 'solicitud', { ...base, tipo: 'otra' }, ['tipo']);
caso('Experiencia fuera de rango se rechaza', 'solicitud', { ...base, tipo: 'dictaminador', _modalidad: 'renovacion', anterior: 'DT-2025-K109', perfil_academico: 'titulo', carrera: 'Biología', anios_experiencia: '80', doc_dictaminador_renovacion_constancia_situacion_fiscal: 'c.pdf' }, ['anios_experiencia'], [pdf('doc_dictaminador_renovacion_constancia_situacion_fiscal')]);

caso('Entrar con CURP y contraseña se acepta', 'entrar', { curp: curpNadia, contrasena: 'x' }, true);
caso('Verificar con número válido se acepta', 'verificar', { numero: 'PD-2026-0001' }, true);
caso('Verificar sin número se rechaza', 'verificar', {}, ['numero']);

console.log(fallas ? `\n${fallas} caso(s) fallido(s).` : '\nTodos los casos correctos.');
process.exit(fallas ? 1 : 0);
