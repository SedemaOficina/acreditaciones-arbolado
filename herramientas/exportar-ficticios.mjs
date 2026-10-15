// Exporta los expedientes ficticios de una base de pruebas a datos/ficticios.json, con las mismas tablas y
// los mismos nombres de campo que la base (norma 3: sustituirlos por la base real es cambiar el origen).
// Lo usa la interfaz mientras no hay backend (etapas 1 y 2).
//
// La exportación se hace con la fecha simulada del corte de los ficticios, para que regenerarla otro día
// produzca exactamente el mismo archivo. Nunca exporta contraseñas (ni su resumen) ni sesiones.
//
// Uso: node herramientas/exportar-ficticios.mjs <base_de_prueba>

import { spawnSync } from 'node:child_process';
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
  requisito: 'clave',
  requisito_curso: 'tipo_acreditacion, modalidad, orden',
  organizacion: 'nombre',
  solicitante: 'curp',
  fotografia: 'solicitante_id, cargada_en',
  acreditacion: 'numero',
  solicitud: 'folio',
  revision: 'solicitud_id, revisada_en',
  documento: 'solicitud_id, requisito, cargado_en',
  grupo: 'folio',
  inscripcion: 'grupo_id, solicitud_id, inscrita_en',
  asistencia: 'inscripcion_id, dia',
  examen: 'inscripcion_id',
  bitacora: 'fecha, accion, entidad_id'
};
// Se omiten la contraseña (nunca sale) y las fechas de instalación de los catálogos (cambian en cada carga)
const OMITIR = { solicitante: ['contrasena_hash'], parametro: ['actualizado_en'], curso: ['actualizado_en'] };

const partes = Object.entries(TABLAS).map(([tabla, orden]) => {
  const fila = OMITIR[tabla] ? `to_jsonb(t) - ${OMITIR[tabla].map((c) => `'${c}'`).join(' - ')}` : 'to_jsonb(t)';
  // id de la bitácora: aleatorio en cada carga; se omite para que el archivo no cambie sin motivo
  const filaFinal = tabla === 'bitacora' ? `${fila} - 'id'` : fila;
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
const json = JSON.parse(salida.slice(salida.findIndex((l) => l.startsWith('{'))).join('\n'));
const archivo = {
  aviso: 'DATOS FICTICIOS. Generados por herramientas/probar-base.sh desde herramientas/ficticios.mjs, pasando por todas las reglas de la base. No se editan a mano. Ninguna persona, CURP, correo, teléfono ni organización es real.',
  fecha_corte: CORTE,
  esquema: 'apd',
  ...json
};
writeFileSync(join(raiz, 'datos/ficticios.json'), JSON.stringify(archivo, null, 1) + '\n');
const resumen = Object.entries(json).filter(([, v]) => Array.isArray(v)).map(([k, v]) => `${k} ${v.length}`).join(' · ');
console.log(`datos/ficticios.json: ${resumen}`);
