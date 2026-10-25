// Exporta los expedientes ficticios de una base de pruebas a datos/ficticios.json, con las mismas tablas y
// los mismos nombres de campo que la base (norma 3: sustituirlos por la base real es cambiar el origen).
// Lo usa la interfaz mientras no hay backend (etapas 1 y 2).
// La bitácora (apd.bitacora) va aparte, en datos/bitacora-ficticia.json: ninguna pantalla la lee y era un tercio del
// archivo que descarga cada pantalla (auditoría 2026-10-20, D4-01). Se sigue exportando para revisarla y para comprobar
// que regenerar no la cambia; construir-sitio.mjs no la copia al sitio.
//
// La exportación se hace con la fecha simulada del corte de los ficticios, para que regenerarla otro día
// produzca exactamente el mismo archivo. Nunca exporta contraseñas (ni su resumen) ni sesiones.
//
// Uso: node herramientas/exportar-ficticios.mjs <base_de_prueba>

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CORTE } from './corte-ficticios.mjs';

const base = process.argv[2];
if (!base || !base.includes('prueba')) {
  console.error('Uso: node herramientas/exportar-ficticios.mjs <base_de_prueba>');
  process.exit(2);
}
const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');

// tabla → orden estable de los renglones
const TABLAS = {
  parametro: 'clave',
  curso: 'tipo_acreditacion, modalidad',
  cuota: 'clave',
  requisito: 'clave',
  requisito_curso: 'tipo_acreditacion, modalidad, orden',
  organizacion: 'nombre',
  carrera: 'nombre',
  solicitante: 'curp',
  fotografia: 'solicitante_id, cargada_en',
  acreditacion: 'numero',
  reposicion: 'acreditacion_id, solicitada_en',
  solicitud: 'folio',
  revision: 'solicitud_id, revisada_en',
  cita: 'solicitud_id, programada_en',
  documento: 'solicitud_id, requisito, cargado_en',
  grupo: 'folio',
  inscripcion: 'grupo_id, solicitud_id, inscrita_en',
  asistencia: 'inscripcion_id, dia',
  examen: 'inscripcion_id',
  material_estudio: 'orden, clave, cargado_en',
  // Avisos por teléfono del registro asistido (decisión 2026-10-25): la pantalla del personal los lista y los marca
  aviso_telefono: 'creado_en, solicitante_id, aviso',
  bitacora: 'fecha, accion, entidad_id'
};
// Se omiten la contraseña (nunca sale) y las fechas de instalación de los catálogos (cambian en cada carga)
const OMITIR = { solicitante: ['contrasena_hash'], parametro: ['actualizado_en'], curso: ['actualizado_en'], cuota: ['actualizado_en'] };

const partes = Object.entries(TABLAS).map(([tabla, orden]) => {
  const fila = OMITIR[tabla] ? `to_jsonb(t) - ${OMITIR[tabla].map((c) => `'${c}'`).join(' - ')}` : 'to_jsonb(t)';
  // id de la bitácora: aleatorio en cada carga; se omite para que el archivo no cambie sin motivo
  // (lo mismo el de las citas, que crea la base al asignarlas)
  const filaFinal = ['bitacora', 'cita'].includes(tabla) ? `${fila} - 'id'` : fila;
  return `'${tabla}', (SELECT coalesce(jsonb_agg(${filaFinal} ORDER BY ${orden}), '[]') FROM apd.${tabla} t)`;
});
partes.push(`'estado_acreditacion', (SELECT jsonb_object_agg(a.numero, apd.estado_acreditacion(a.id)) FROM apd.acreditacion a)`);
partes.push(`'verificacion_publica', (SELECT jsonb_agg(to_jsonb(v) ORDER BY numero) FROM apd.verificacion_publica v)`);
partes.push(`'bandeja_demanda', (SELECT jsonb_agg(to_jsonb(b) ORDER BY tipo_acreditacion, modalidad, prioridad DESC, orden_sugerido, folio) FROM apd.bandeja_demanda b)`);

const consulta = `
SET TimeZone = 'America/Mexico_City';
SELECT set_config('apd.ahora_simulado', '${CORTE} 20:00:00-06', false);
SELECT jsonb_pretty(jsonb_build_object(${partes.join(',\n  ')}));`;

const r = spawnSync('psql', ['-X', '-q', '-At', '-d', base, '-U', 'apd_api', '-v', 'ON_ERROR_STOP=1'], { input: consulta, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
if (r.status !== 0) {
  console.error(r.stderr);
  process.exit(1);
}
const salida = r.stdout.split('\n');
let json = JSON.parse(salida.slice(salida.findIndex((l) => l.startsWith('{'))).join('\n'));
// Los catálogos (organizaciones y carreras), el material de estudio y los avisos por teléfono toman un id aleatorio al instalarse: se sustituye,
// en todo el archivo, por uno derivado de lo que los distingue, para que regenerar no cambie el archivo sin motivo
// (auditoría 2026-10-17; el material, auditoría 2026-10-19, A3-01: si su id cambia, un «Ocultar» hecho en el navegador
// de prueba se pierde al republicar)
const uuidDe = (texto) => { const h = createHash('md5').update(texto).digest('hex'); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`; };
const LLAVE = {
  organizacion: (f) => f.nombre_normalizado || f.nombre,
  carrera: (f) => f.nombre_normalizado || f.nombre,
  material_estudio: (f) => `${f.clave}:${f.archivo_clave}`, // archivo_clave es único (material_estudio_archivo_uk)
  // Los crea la base con cada cambio (id aleatorio): persona, aviso y momento lo distinguen; un «se le avisó» guardado en el
  // navegador de prueba no se pierde al regenerar
  aviso_telefono: (f) => `${f.solicitante_id}:${f.aviso}:${f.solicitud_id}:${f.creado_en}`
};
let texto = JSON.stringify(json);
for (const [tabla, llave] of Object.entries(LLAVE)) {
  for (const fila of json[tabla]) texto = texto.split(`"${fila.id}"`).join(`"${uuidDe(`${tabla}:${llave(fila)}`)}"`);
}
json = JSON.parse(texto);
const archivo = {
  aviso: 'DATOS FICTICIOS. Generados por herramientas/probar-base.sh desde herramientas/ficticios.mjs, pasando por todas las reglas de la base. No se editan a mano. Ninguna persona, CURP, correo, teléfono ni organización es real.',
  fecha_corte: CORTE,
  esquema: 'apd',
  ...json
};
// La bitácora, en su archivo (D4-01)
const { bitacora, ...tablas } = archivo;
writeFileSync(join(raiz, 'datos/ficticios.json'), JSON.stringify(tablas, null, 1) + '\n');
writeFileSync(join(raiz, 'datos/bitacora-ficticia.json'), JSON.stringify({ aviso: archivo.aviso, fecha_corte: CORTE, esquema: 'apd', bitacora }, null, 1) + '\n');
const resumen = Object.entries(tablas).filter(([, v]) => Array.isArray(v)).map(([k, v]) => `${k} ${v.length}`).join(' · ');
console.log(`datos/ficticios.json: ${resumen}`);
console.log(`datos/bitacora-ficticia.json: bitacora ${bitacora.length}`);
