// Común a los guiones de r5 (auditoría 20/10/2026, C5 y D4). Solo lectura: no escribe en el proyecto.
// Uso: import { PAGINAS, datos, BASE, CHROMIUM, volumen } from './comun.mjs'
import { readFileSync, mkdtempSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export const RAIZ = process.env.COPIA || '/home/claude/trabajo/aud20-r5';
export const EVID = '/home/claude/trabajo/evidencia-2026-10-20/r5';
export const BASE = (process.env.BASE || 'http://localhost:8905/').replace(/\/?$/, '/');
export const CHROMIUM = process.env.CHROMIUM || '/opt/pw-browsers/chromium';
export const datos = JSON.parse(readFileSync(join(RAIZ, 'sitio/datos/ficticios.json'), 'utf8'));

// Escenario de volumen (65 por revisar, 40 citas, 112 en espera, grupos de 25), generado fuera del proyecto
let _vol = null;
export function volumen() {
  if (_vol) return _vol;
  const sal = join(EVID, 'volumen.json');
  if (!existsSync(sal)) execFileSync('node', [join(RAIZ, 'herramientas/escenario-volumen.mjs'), join(RAIZ, 'sitio/datos/ficticios.json'), sal], { stdio: 'ignore' });
  const cuerpo = readFileSync(sal);
  _vol = { cuerpo, d: JSON.parse(cuerpo) };
  return _vol;
}

const activa = (s) => s && datos.solicitante.find((p) => p.id === s.solicitante_id && p.estado === 'activa');
const conPersona = (f) => { const s = datos.solicitud.find((x) => f(x) && activa(x)); return s ? [s, s.solicitante_id] : [null, null]; };
const [cita, pCita] = conPersona((s) => s.estado === 'validada_en_linea' && !s.cotejo_pausa);
const [pausa, pPausa] = conPersona((s) => s.estado === 'validada_en_linea' && s.cotejo_pausa);
const sinTramite = datos.solicitante.find((p) => p.estado === 'activa' && !datos.solicitud.some((s) => s.solicitante_id === p.id));
const enviada = datos.solicitud.find((s) => s.estado === 'enviada' && s.tipo_acreditacion === 'dictaminador') || datos.solicitud.find((s) => s.estado === 'enviada');
const gInt = datos.grupo.find((g) => g.estado === 'en_integracion');
const gCurso = datos.grupo.find((g) => g.estado === 'en_curso');

// Las 21 pantallas: [archivo, público, ruta, sesión]
export const PAGINAS = [
  ['index', 'persona', 'index.html', null],
  ['cuenta', 'persona', 'cuenta.html', null],
  ['entrar', 'persona', 'entrar.html', null],
  ['tramites', 'persona', 'tramites.html', pCita],
  ['datos', 'persona', 'datos.html', pCita],
  ['solicitud', 'persona', 'solicitud.html', sinTramite && sinTramite.id],
  ['corregir', 'persona', 'corregir.html', pPausa || pCita],
  ['verificar', 'persona', 'verificar.html', null],
  ['material', 'persona', 'material.html', null],
  ['revision', 'personal', 'revision.html', null],
  ['revisar', 'personal', `revisar.html?folio=${enviada.folio}`, null],
  ['citas', 'personal', 'citas.html', null],
  ['cotejo', 'personal', `cotejo.html?folio=${cita.folio}`, null],
  ['grupos', 'personal', 'grupos.html?curso=poda-nueva', null],
  ['espera', 'personal', 'espera.html?curso=poda-nueva', null],
  ['programar', 'personal', 'programar.html?curso=poda-nueva', null],
  ['grupo', 'personal', `grupo.html?folio=${gInt.folio}`, null],
  ['asistencia', 'personal', `asistencia.html?folio=${gCurso.folio}`, null],
  ['aplicar', 'personal', 'aplicar.html', null],
  ['examen', 'persona (examen)', 'examen.html', null],
  ['material-personal', 'personal', 'material-personal.html', null]
];

export const sesionInit = (id) => { try { localStorage.setItem('apd.sesion', JSON.stringify({ id })); } catch (e) { /* sin almacenamiento */ } };
export const tmp = () => mkdtempSync(join(tmpdir(), 'r5-'));
