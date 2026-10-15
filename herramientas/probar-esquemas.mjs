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
for (const f of ['cuenta', 'datos', 'entrar', 'solicitud', 'verificar']) {
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
// El navegador no manda los campos de archivos en `datos` (el módulo los declara fuera de datos), pero
// validar.mjs exige un valor en `datos` para un campo obligatorio de archivos. Como lo hará la API: lo que
// venga en `datos` para esos campos se descarta y se pone el número de archivos recibidos de cada uno.
function conArchivos(form, datos, archivos) {
  const d = { ...datos };
  for (const [n, c] of Object.entries(esquema[form].campos || {})) if (c.tipo === 'archivos') delete d[n];
  for (const a of archivos) d[a.campo] = String(archivos.filter((x) => x.campo === a.campo).length);
  return d;
}
// El catálogo cerrado de alcaldías, como lo tendrá la API (el mismo que genera construir-sitio.mjs)
const catalogos = { alcaldias: JSON.parse(readFileSync(join(raiz, 'datos/ficticios.json'), 'utf8')).organizacion.filter((o) => o.tipo === 'alcaldia' && o.clave).map((o) => o.nombre) };
function caso(nombre, form, datos, espera, archivos = []) {
  const r = validaPayload({ datos: conArchivos(form, comoServidor(form, datos), archivos), archivos, meta }, esquema[form], { config, catalogos });
  const campos = r.errores.map((e) => e.campo);
  const ok = espera === true ? r.ok : !r.ok && espera.every((c) => campos.includes(c)) && campos.every((c) => espera.includes(c));
  console.log(`${ok ? 'BIEN' : 'MAL '}  ${nombre}${ok ? '' : ` → ${JSON.stringify([...new Set(campos)])}`}`);
  if (!ok) fallas++;
}

const ALFABETO = '0123456789ABCDEFGHIJKLMNÑOPQRSTUVWXYZ';
const conDigito = (b) => { let s = 0; for (let i = 0; i < 17; i++) s += ALFABETO.indexOf(b[i]) * (18 - i); return b + String((10 - (s % 10)) % 10); };
const curpNadia = conDigito(globalThis.APD_CURP.prefijo({ nombre: 'Nadia', primer: 'Ejemplo', segundo: 'Simulado' }, '1999-12-30', 'M', 'NE') + '0');
const cuenta = { nombre: 'Nadia', primer_apellido: 'Ejemplo', segundo_apellido: 'Simulado', fecha_nacimiento: '1999-12-30', curp: curpNadia, correo: 'nadia@ejemplo.local', correo2: 'nadia@ejemplo.local', telefono: '5500000077', contrasena: 'una frase larga de prueba', contrasena2: 'una frase larga de prueba', adscrito: 'no', aviso: 'si', humano: 'si' };
const foto = (nombre = 'foto.jpg', type = 'image/jpeg') => [{ nombre, size: 180000, type, campo: 'foto' }];
caso('Cuenta completa con su fotografía se acepta', 'cuenta', cuenta, true, foto());
caso('Cuenta sin fotografía de frente se rechaza', 'cuenta', cuenta, ['foto']);
caso('Cuenta con la fotografía en PDF se rechaza', 'cuenta', cuenta, ['foto'], foto('foto.pdf', 'application/pdf'));
caso('Cuenta: CURP con dígito incorrecto y correo sin confirmar se rechazan', 'cuenta', { ...cuenta, curp: curpNadia.slice(0, 17) + ((Number(curpNadia[17]) + 1) % 10), correo2: 'otra@ejemplo.local' }, ['curp', 'correo2'], foto());
caso('Cuenta: una CURP ajena (de otro nombre) se rechaza', 'cuenta', { ...cuenta, nombre: 'Pedro', primer_apellido: 'López' }, ['curp'], foto());
caso('Cuenta: otro segundo apellido se rechaza', 'cuenta', { ...cuenta, segundo_apellido: 'Muestra' }, ['curp'], foto());
const curpUriel = conDigito(globalThis.APD_CURP.prefijo({ nombre: 'Uriel', primer: 'Ejemplo', segundo: '' }, '1988-04-09', 'H', 'NE') + '0');
caso('Cuenta sin segundo apellido se acepta', 'cuenta', { ...cuenta, nombre: 'Uriel', segundo_apellido: '', fecha_nacimiento: '1988-04-09', curp: curpUriel }, true, foto());
caso('Cuenta: dejar vacío el segundo apellido con una CURP que sí lo tiene se rechaza', 'cuenta', { ...cuenta, segundo_apellido: '' }, ['curp'], foto());
caso('Cuenta: el campo auxiliar enviado por el navegador no cuenta (lo calcula el servidor)', 'cuenta', { ...cuenta, segundo_apellido: '', sin_segundo_apellido: '' }, ['curp'], foto());
caso('Cuenta: otra fecha de nacimiento se rechaza', 'cuenta', { ...cuenta, fecha_nacimiento: '1999-12-31' }, ['curp'], foto());
caso('Cuenta: sin fecha de nacimiento se rechaza', 'cuenta', { ...cuenta, fecha_nacimiento: '' }, ['fecha_nacimiento'], foto());
caso('Cuenta: contraseña corta se rechaza', 'cuenta', { ...cuenta, contrasena: 'corta', contrasena2: 'corta' }, ['contrasena', 'contrasena2'], foto());
caso('Cuenta: sin aviso de privacidad se rechaza', 'cuenta', { ...cuenta, aviso: '' }, ['aviso'], foto());

// Solicitud: lo obligatorio depende del trámite elegido, con una sola condición por bloque
const docs = (t, lista) => Object.fromEntries(lista.map((r) => [`doc_${t}_${r}`, `${r}.pdf`]));
const base = { aviso: 'si', humano: 'si' };
const podaNueva = ['identificacion_oficial', 'curp', 'comprobante_domicilio', 'constancia_situacion_fiscal'];
caso('Solicitud poda nueva con sus 4 documentos se acepta', 'solicitud', { ...base, tipo: 'poda', ...docs('poda_nueva', podaNueva) }, true, podaNueva.map((r) => pdf(`doc_poda_nueva_${r}`)));
caso('Solicitud con un documento en JPG se rechaza: sólo PDF', 'solicitud', { ...base, tipo: 'poda', ...docs('poda_nueva', podaNueva) }, ['doc_poda_nueva_curp'],
  podaNueva.map((r) => (r === 'curp' ? { nombre: 'curp.jpg', size: 200000, type: 'image/jpeg', campo: 'doc_poda_nueva_curp' } : pdf(`doc_poda_nueva_${r}`))));
caso('Solicitud poda nueva sin documentos pide sólo los de poda nueva', 'solicitud', { ...base, tipo: 'poda' }, podaNueva.map((r) => `doc_poda_nueva_${r}`));
caso('Solicitud dictaminador nueva sin perfil ni documentos pide perfil y sus 8 documentos', 'solicitud', { ...base, tipo: 'dictaminador' },
  ['perfil_academico', 'carrera', 'anios_experiencia', ...['identificacion_oficial', 'curp', 'comprobante_domicilio', 'constancia_situacion_fiscal', 'comprobante_estudios', 'curriculum_vitae', 'comprobantes_experiencia', 'constancias_capacitacion'].map((r) => `doc_dictaminador_nueva_${r}`)]);
caso('Solicitud poda renovación pide sólo la constancia de situación fiscal (lo demás es «si aplica»)', 'solicitud', { ...base, tipo: 'poda', _modalidad: 'renovacion', anterior: 'PD-2025-K106' }, ['doc_poda_renovacion_constancia_situacion_fiscal']);
caso('Solicitud con una acreditación que no existe se rechaza', 'solicitud', { ...base, tipo: 'otra' }, ['tipo']);
caso('Experiencia fuera de rango se rechaza', 'solicitud', { ...base, tipo: 'dictaminador', _modalidad: 'renovacion', anterior: 'DT-2025-K109', perfil_academico: 'titulo', carrera: 'Biología', anios_experiencia: '80', doc_dictaminador_renovacion_constancia_situacion_fiscal: 'c.pdf' }, ['anios_experiencia'], [pdf('doc_dictaminador_renovacion_constancia_situacion_fiscal')]);

// Adscripción (en la cuenta y en «Mis datos»): según el tipo, su pregunta; lo que depende de una respuesta se oculta con ella
const conFoto = foto();
const cta = (extra) => ({ ...cuenta, ...extra });
caso('Cuenta: sin decir si trabaja para alguien se rechaza', 'cuenta', cta({ adscrito: '' }), ['adscrito'], conFoto);
caso('Cuenta: adscrita sin decir el tipo se rechaza', 'cuenta', cta({ adscrito: 'si' }), ['tipo_adscripcion'], conFoto);
caso('Cuenta: empresa sin nombre se rechaza', 'cuenta', cta({ adscrito: 'si', tipo_adscripcion: 'privada' }), ['empresa_nombre'], conFoto);
caso('Cuenta: empresa con su nombre se acepta', 'cuenta', cta({ adscrito: 'si', tipo_adscripcion: 'privada', empresa_nombre: 'Jardines Ejemplo del Norte, S.A. de C.V.' }), true, conFoto);
caso('Cuenta: SEDEMA sin su Dirección General se rechaza', 'cuenta', cta({ adscrito: 'si', tipo_adscripcion: 'dependencia_cdmx', dependencia_cdmx: 'sedema' }), ['direccion_sedema'], conFoto);
caso('Cuenta: SEDEMA con su Dirección General se acepta', 'cuenta', cta({ adscrito: 'si', tipo_adscripcion: 'dependencia_cdmx', dependencia_cdmx: 'sedema', direccion_sedema: 'dgcorenadr' }), true, conFoto);
caso('Cuenta: otra dependencia de la Ciudad sin su nombre se rechaza', 'cuenta', cta({ adscrito: 'si', tipo_adscripcion: 'dependencia_cdmx', dependencia_cdmx: 'otro' }), ['dependencia_cdmx_otra'], conFoto);
caso('Cuenta: una alcaldía fuera del catálogo se rechaza', 'cuenta', cta({ adscrito: 'si', tipo_adscripcion: 'alcaldia', alcaldia: 'Alcaldía Inventada' }), ['alcaldia'], conFoto);
caso('Cuenta: una alcaldía del catálogo se acepta, escrita sin acentos', 'cuenta', cta({ adscrito: 'si', tipo_adscripcion: 'alcaldia', alcaldia: 'tlahuac' }), true, conFoto);
caso('Cuenta: independiente, lo que dependía de la adscripción no cuenta (se descarta)', 'cuenta', cta({ adscrito: 'no', tipo_adscripcion: 'alcaldia', alcaldia: 'Inventada' }), true, conFoto);
const misDatos = { correo: 'nadia@ejemplo.local', correo2: 'nadia@ejemplo.local', telefono: '5500000077', adscrito: 'si', tipo_adscripcion: 'dependencia_federal', dependencia_federal: 'cfe' };
caso('Mis datos: cambio de adscripción a CFE se acepta, sin fotografía nueva', 'datos', misDatos, true);
caso('Mis datos: otra dependencia federal sin su nombre se rechaza', 'datos', { ...misDatos, dependencia_federal: 'otro' }, ['dependencia_federal_otra']);
caso('Mis datos: la CURP o el nombre no se cambian aquí (campo no declarado)', 'datos', { ...misDatos, curp: curpNadia }, ['curp']);

caso('Entrar con CURP y contraseña se acepta', 'entrar', { curp: curpNadia, contrasena: 'x' }, true);
caso('Verificar con número válido se acepta', 'verificar', { numero: 'PD-2026-0001' }, true);
caso('Verificar sin número se rechaza', 'verificar', {}, ['numero']);

console.log(fallas ? `\n${fallas} caso(s) fallido(s).` : '\nTodos los casos correctos.');
process.exit(fallas ? 1 : 0);
