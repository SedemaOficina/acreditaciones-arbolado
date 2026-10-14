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
function caso(nombre, form, datos, espera, archivos = []) {
  const r = validaPayload({ datos, archivos, meta }, esquema[form]);
  const campos = r.errores.map((e) => e.campo);
  const ok = espera === true ? r.ok : !r.ok && espera.every((c) => campos.includes(c)) && campos.every((c) => espera.includes(c));
  console.log(`${ok ? 'BIEN' : 'MAL '}  ${nombre}${ok ? '' : ` → ${JSON.stringify([...new Set(campos)])}`}`);
  if (!ok) fallas++;
}

const cuenta = { nombre: 'Nadia', primer_apellido: 'Ejemplo', curp: 'XAXX991230MNEXXX08', correo: 'nadia@ejemplo.local', correo2: 'nadia@ejemplo.local', telefono: '5500000077', contrasena: 'una frase larga de prueba', contrasena2: 'una frase larga de prueba', aviso: 'si', humano: 'si' };
caso('Cuenta completa se acepta', 'cuenta', cuenta, true);
caso('Cuenta: CURP con dígito incorrecto y correo sin confirmar se rechazan', 'cuenta', { ...cuenta, curp: 'XAXX991230MNEXXX01', correo2: 'otra@ejemplo.local' }, ['curp', 'correo2']);
caso('Cuenta: contraseña corta se rechaza', 'cuenta', { ...cuenta, contrasena: 'corta', contrasena2: 'corta' }, ['contrasena', 'contrasena2']);
caso('Cuenta: sin aviso de privacidad se rechaza', 'cuenta', { ...cuenta, aviso: '' }, ['aviso']);

// Solicitud: lo obligatorio depende del trámite elegido, con una sola condición por bloque
const docs = (t, lista) => Object.fromEntries(lista.map((r) => [`doc_${t}_${r}`, `${r}.pdf`]));
const base = { aviso: 'si', humano: 'si' };
const podaNueva = ['identificacion_oficial', 'curp', 'comprobante_domicilio', 'constancia_situacion_fiscal'];
caso('Solicitud poda nueva con sus 4 documentos se acepta', 'solicitud', { ...base, tramite: 'poda_nueva', ...docs('poda_nueva', podaNueva) }, true, podaNueva.map((r) => pdf(`doc_poda_nueva_${r}`)));
caso('Solicitud poda nueva sin documentos pide sólo los de poda nueva', 'solicitud', { ...base, tramite: 'poda_nueva' }, podaNueva.map((r) => `doc_poda_nueva_${r}`));
caso('Solicitud dictaminador nueva sin perfil ni documentos pide perfil y sus 8 documentos', 'solicitud', { ...base, tramite: 'dictaminador_nueva' },
  ['perfil_academico', 'carrera', 'anios_experiencia', ...['identificacion_oficial', 'curp', 'comprobante_domicilio', 'constancia_situacion_fiscal', 'comprobante_estudios', 'curriculum_vitae', 'comprobantes_experiencia', 'constancias_capacitacion'].map((r) => `doc_dictaminador_nueva_${r}`)]);
caso('Solicitud poda renovación pide sólo la constancia de situación fiscal (lo demás es «si aplica»)', 'solicitud', { ...base, tramite: 'poda_renovacion', anterior: 'PD-2025-K106' }, ['doc_poda_renovacion_constancia_situacion_fiscal']);
caso('Solicitud con trámite que no existe se rechaza', 'solicitud', { ...base, tramite: 'poda_otra' }, ['tramite']);
caso('Experiencia fuera de rango se rechaza', 'solicitud', { ...base, tramite: 'dictaminador_renovacion', anterior: 'DT-2025-K109', perfil_academico: 'titulo', carrera: 'Biología', anios_experiencia: '80', doc_dictaminador_renovacion_constancia_situacion_fiscal: 'c.pdf' }, ['anios_experiencia'], [pdf('doc_dictaminador_renovacion_constancia_situacion_fiscal')]);

caso('Entrar con CURP y contraseña se acepta', 'entrar', { curp: 'XAXX991230MNEXXX08', contrasena: 'x' }, true);
caso('Verificar con número válido se acepta', 'verificar', { numero: 'PD-2026-0001' }, true);
caso('Verificar sin número se rechaza', 'verificar', {}, ['numero']);

console.log(fallas ? `\n${fallas} caso(s) fallido(s).` : '\nTodos los casos correctos.');
process.exit(fallas ? 1 : 0);
