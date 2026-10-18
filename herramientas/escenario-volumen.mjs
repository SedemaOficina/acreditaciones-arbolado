// Escenario de volumen real para la auditoría de tareas (no toca el repositorio). Lo usa herramientas/probar-volumen.mjs.
// (Antes en docs/auditoria-tareas/; se pasó a herramientas/ el 2026-10-18, auditoría A 8.5.)
// Toma sitio/datos/ficticios.json y le agrega, clonando registros existentes con datos ficticios:
//  · 60 solicitudes en la bandeja de revisión (enviadas en las últimas 3 semanas, de los cuatro cursos)
//  · 40 citas de cotejo el día de corte (09:00 a 14:00) y 30 más en los días siguientes
//  · 100 personas en espera de grupo, repartidas en cuatro cursos y ~18 adscripciones (organizaciones grandes y cola larga)
//  · 1 grupo de 25 personas en su último día (asistencia de los días 1 a 4 capturada, con faltas)
//  · 3 grupos más en integración y confirmados
// Uso: node herramientas/escenario-volumen.mjs <ficticios.json> <salida.json>
import { readFileSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const [, , entrada, salida] = process.argv;
const d = JSON.parse(readFileSync(entrada, 'utf8'));
const corte = d.fecha_corte; // 2026-10-14
let semilla = 7;
const azar = () => { semilla = (semilla * 16807) % 2147483647; return (semilla - 1) / 2147483646; };
const elige = (l) => l[Math.floor(azar() * l.length)];
const dia = (n, hora = '10:00') => { const f = new Date(`${corte}T12:00:00-06:00`); f.setDate(f.getDate() + n); return `${f.toISOString().slice(0, 10)}T${hora}:00-06:00`; };
const soloDia = (n) => dia(n).slice(0, 10);

const NOMBRES = ['ANA', 'BRUNO', 'CARLA', 'DANIEL', 'ELENA', 'FERNANDO', 'GABRIELA', 'HUGO', 'IRMA', 'JORGE', 'KARLA', 'LEONEL', 'MIRIAM', 'NOE', 'OFELIA', 'PEDRO', 'RAQUEL', 'SAUL', 'TERESA', 'URIEL', 'VERONICA', 'WILFRIDO', 'YOLANDA', 'ZACARIAS', 'ROSA MARIA', 'JUAN CARLOS', 'MARIA JOSE', 'JOSE LUIS'];
const APELLIDOS = ['EJEMPLO', 'MUESTRA', 'PRUEBA', 'FICTICIO', 'SIMULADO', 'MODELO', 'ENSAYO', 'MAQUETA'];
let nPersona = 500;
let nFolio = 500;

const org = (nombre) => d.organizacion.find((o) => o.nombre === nombre) || d.organizacion.find((o) => o.nombre.includes(nombre));
// Reparto de adscripciones parecido a la demanda real: pocas organizaciones grandes y una cola larga
const REPARTO = [
  ['Jardines Ejemplo del Norte', 16], ['Iztapalapa', 11], ['Comisión Federal', 8], ['Coyoacán', 6], ['Gustavo A. Madero', 5],
  ['Cuauhtémoc', 4], ['Miguel Hidalgo', 3], ['Benito Juárez', 3], ['Azcapotzalco', 2], ['Iztacalco', 2], ['La Magdalena Contreras', 2],
  ['Cuajimalpa', 1], [null, 37]
];
const bolsa = [];
for (const [n, k] of REPARTO) for (let i = 0; i < k; i++) bolsa.push(n ? org(n) : null);
const otraOrg = () => elige(d.organizacion);

function base(estado, tipo, modalidad) {
  return d.solicitud.find((s) => s.estado === estado && s.tipo_acreditacion === tipo && s.modalidad === modalidad)
    || d.solicitud.find((s) => s.estado === estado && s.tipo_acreditacion === tipo)
    || d.solicitud.find((s) => s.estado === estado);
}

/* Clona una solicitud con su persona, documentos, fotografía y revisiones; devuelve la solicitud nueva */
function clona(b, { estado, tipo, modalidad, o, enviada, desde, extra = {} }) {
  const pb = d.solicitante.find((p) => p.id === b.solicitante_id);
  const n = ++nPersona;
  const p = Object.assign({}, pb, {
    id: randomUUID(), nombre: elige(NOMBRES), primer_apellido: elige(APELLIDOS), segundo_apellido: elige(APELLIDOS),
    correo: `persona${n}@ejemplo.local`, telefono: `000000${String(n).padStart(4, '0')}`,
    curp: `${pb.curp.slice(0, 13)}${String(n % 100).padStart(2, '0')}${pb.curp.slice(15)}`,
    adscripcion: o ? o.tipo : 'independiente', organizacion_id: o ? o.id : null,
    numero_expediente: ['lista_para_curso', 'inscrita'].includes(estado) ? `EXP-2026-${String(n).padStart(4, '0')}` : null
  });
  d.solicitante.push(p);
  const folio = `APD-S-2026-${String(++nFolio).padStart(5, '0')}`;
  const s = Object.assign({}, b, {
    id: randomUUID(), folio, estado, tipo_acreditacion: tipo, modalidad, solicitante_id: p.id,
    adscripcion: o ? o.tipo : 'independiente', organizacion_id: o ? o.id : null, organizacion_nombre: null,
    enviada_en: enviada, creada_en: enviada, estado_desde: desde || enviada, pago_referencia: folio.replace(/-/g, ''),
    cita_en: null, lista_para_curso_en: null, acreditacion_anterior_id: null
  }, extra);
  d.solicitud.push(s);
  for (const doc of d.documento.filter((x) => x.solicitud_id === b.id)) {
    d.documento.push(Object.assign({}, doc, { id: randomUUID(), solicitud_id: s.id,
      nombre_archivo: doc.nombre_archivo.replace(/_[^_]+\.(pdf|jpg|png)$/i, `_${p.nombre} ${p.primer_apellido} ${p.segundo_apellido}.$1`) }));
  }
  const fb = d.fotografia.find((f) => f.solicitante_id === pb.id && f.vigente);
  if (fb) d.fotografia.push(Object.assign({}, fb, { id: randomUUID(), solicitante_id: p.id }));
  for (const r of d.revision.filter((x) => x.solicitud_id === b.id)) d.revision.push(Object.assign({}, r, { id: randomUUID(), solicitud_id: s.id }));
  return s;
}

const cursos = [['poda', 'nueva'], ['poda', 'renovacion'], ['dictaminador', 'nueva'], ['dictaminador', 'renovacion']];
const reparte = (k) => [...Array(k)].map((_, i) => cursos[i % 10 < 6 ? 0 : i % 10 < 8 ? 1 : i % 10 < 9 ? 2 : 3]);

// 1) Bandeja de revisión: 60 enviadas en las últimas 3 semanas (una de cada 6, reenviada)
reparte(60).forEach(([tipo, modalidad], i) => {
  const b = base('enviada', tipo, modalidad);
  const env = dia(-Math.floor(azar() * 21), `${String(8 + Math.floor(azar() * 10)).padStart(2, '0')}:${elige(['00', '15', '30', '45'])}`);
  const s = clona(b, { estado: 'enviada', tipo, modalidad, o: azar() < 0.4 ? otraOrg() : null, enviada: env });
  if (i % 6 === 0) d.revision.push({ id: randomUUID(), revisor: 'revision.ficticia', resultado: 'con_observaciones', revisada_en: dia(-22), solicitud_id: s.id, observacion_general: '' });
});

// 2) Citas: 40 hoy (09:00 a 14:00, cada 30 min) y 30 en los 6 días siguientes
const HORAS = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00'];
for (let i = 0; i < 70; i++) {
  const [tipo, modalidad] = reparte(70)[i];
  const b = base('validada_en_linea', 'poda', 'nueva');
  const en = i < 40 ? dia(0, HORAS[i % HORAS.length]) : dia(1 + (i % 6), HORAS[i % HORAS.length]);
  const s = clona(b, { estado: 'validada_en_linea', tipo, modalidad, o: azar() < 0.4 ? otraOrg() : null, enviada: dia(-12), desde: dia(-5), extra: { cita_en: en } });
  d.cita.push({ creada_en: dia(-5), resultado: 'pendiente', pausada_en: null, atendida_en: null, observacion: '', atendida_por: null, solicitud_id: s.id, programada_en: en });
}

// 3) Espera de grupo: 100 personas en los cuatro cursos, de 0 a 75 días esperando
const enEspera = [];
for (let i = 0; i < 100; i++) {
  const [tipo, modalidad] = reparte(100)[i];
  const b = base('lista_para_curso', tipo, modalidad);
  const lpc = dia(-Math.floor(azar() * 75), '11:00');
  const extra = { lista_para_curso_en: lpc };
  if (modalidad === 'renovacion') {
    const ant = { id: randomUUID(), numero: `${tipo === 'poda' ? 'PD' : 'DT'}-2024-${String(900 + i)}`, origen: 'sistema', vence_en: soloDia(Math.floor(azar() * 120) - 90),
      emitida_en: '2024-10-01', es_ficticio: true, entregada_en: '2024-10-01', folio_origen: null, solicitud_id: null, solicitante_id: null, tipo_acreditacion: tipo };
    d.acreditacion.push(ant);
    extra.acreditacion_anterior_id = ant.id;
  }
  const s = clona(b, { estado: 'lista_para_curso', tipo, modalidad, o: bolsa[Math.floor(azar() * bolsa.length)], enviada: dia(-80), desde: lpc, extra });
  if (extra.acreditacion_anterior_id) d.acreditacion.find((a) => a.id === extra.acreditacion_anterior_id).solicitante_id = s.solicitante_id;
  enEspera.push(s);
}

// 4) Grupo de 25 en su último día (inició hace 4 días); asistencia de los días 1 a 4, con faltas
const g = { id: randomUUID(), sede: 'Vivero Nezahualcóyotl', folio: 'APD-G-2026-020', estado: 'en_curso', creado_en: dia(-20), modalidad: 'nueva', instructor: 'instructor.ficticio',
  cupo_maximo: 25, cupo_minimo: 5, es_ficticio: true, integracion: 'combinado', estado_desde: dia(-4, '08:30'), fecha_inicio: soloDia(-4), hora_entrada: '09:00:00', organizacion_id: null,
  tipo_acreditacion: 'poda', motivo_cancelacion: null };
d.grupo.push(g);
for (let i = 0; i < 25; i++) {
  const s = clona(base('inscrita', 'poda', 'nueva'), { estado: 'inscrita', tipo: 'poda', modalidad: 'nueva', o: bolsa[Math.floor(azar() * bolsa.length)], enviada: dia(-40), desde: dia(-10) });
  const ins = { id: randomUUID(), activa: true, baja_en: null, grupo_id: g.id, inscrita_en: dia(-10), motivo_baja: null, solicitud_id: s.id };
  d.inscripcion.push(ins);
  for (let k = 1; k <= 4; k++) d.asistencia.push({ dia: k, asistio: !(i % 7 === 0 && k <= 2) && !(i % 11 === 0 && k === 3), capturada_en: dia(-5 + k, '18:30'), capturada_por: 'instructor.ficticio', inscripcion_id: ins.id });
}

// 5) Más grupos: uno en integración de Jardines (3), uno combinado en integración (12), uno confirmado de Iztapalapa (18)
function grupoCon(folio, estado, integracion, o, k, fecha) {
  const gg = { id: randomUUID(), sede: 'Vivero Nezahualcóyotl', folio, estado, creado_en: dia(-6), modalidad: 'nueva', instructor: estado === 'confirmado' ? 'instructor2.ficticio' : null,
    cupo_maximo: 25, cupo_minimo: 5, es_ficticio: true, integracion, estado_desde: dia(-3), fecha_inicio: fecha, hora_entrada: fecha ? '09:00:00' : null,
    organizacion_id: o ? o.id : null, tipo_acreditacion: 'poda', motivo_cancelacion: null };
  d.grupo.push(gg);
  for (let i = 0; i < k; i++) {
    const s = clona(base('inscrita', 'poda', 'nueva'), { estado: 'inscrita', tipo: 'poda', modalidad: 'nueva', o: o || bolsa[Math.floor(azar() * bolsa.length)], enviada: dia(-30), desde: dia(-3) });
    d.inscripcion.push({ id: randomUUID(), activa: true, baja_en: null, grupo_id: gg.id, inscrita_en: dia(-3), motivo_baja: null, solicitud_id: s.id });
  }
}
grupoCon('APD-G-2026-021', 'en_integracion', 'especifico', org('Jardines Ejemplo del Norte'), 3, null);
grupoCon('APD-G-2026-022', 'en_integracion', 'combinado', null, 12, null);
grupoCon('APD-G-2026-023', 'confirmado', 'especifico', org('Iztapalapa'), 18, soloDia(12));

// 6) Casos de la auditoría de tareas: un grupo en su día 3 con el día 2 sin capturar (A1), tres citas de hace dos días
//    sin registrar (A3) y una cita en pausa de ayer (M6)
const g2 = { id: randomUUID(), sede: 'Vivero Nezahualcóyotl', folio: 'APD-G-2026-024', estado: 'en_curso', creado_en: dia(-15), modalidad: 'nueva', instructor: 'instructor.ficticio',
  cupo_maximo: 25, cupo_minimo: 5, es_ficticio: true, integracion: 'combinado', estado_desde: dia(-2, '08:30'), fecha_inicio: soloDia(-2), hora_entrada: '09:00:00', organizacion_id: null,
  tipo_acreditacion: 'poda', motivo_cancelacion: null };
d.grupo.push(g2);
for (let i = 0; i < 8; i++) {
  const s = clona(base('inscrita', 'poda', 'nueva'), { estado: 'inscrita', tipo: 'poda', modalidad: 'nueva', o: bolsa[Math.floor(azar() * bolsa.length)], enviada: dia(-30), desde: dia(-6) });
  const ins = { id: randomUUID(), activa: true, baja_en: null, grupo_id: g2.id, inscrita_en: dia(-6), motivo_baja: null, solicitud_id: s.id };
  d.inscripcion.push(ins);
  d.asistencia.push({ dia: 1, asistio: true, capturada_en: dia(-2, '18:30'), capturada_por: 'instructor.ficticio', inscripcion_id: ins.id });
}
for (let i = 0; i < 4; i++) {
  const en = dia(-2, HORAS[i]);
  const s = clona(base('validada_en_linea', 'poda', 'nueva'), { estado: 'validada_en_linea', tipo: 'poda', modalidad: 'nueva', o: null, enviada: dia(-15), desde: dia(-8), extra: { cita_en: en } });
  if (i === 3) {
    s.cita_en = dia(-1, '10:00');
    s.cotejo_pausa = { desde: dia(-1, '10:20'), real: dia(-1, '10:20'), cita_en: s.cita_en, docs: ['curp'] };
    d.cita.push({ creada_en: dia(-8), resultado: 'en_pausa', pausada_en: dia(-1, '10:20'), atendida_en: null, observacion: '', atendida_por: null, solicitud_id: s.id, programada_en: s.cita_en });
  } else {
    d.cita.push({ creada_en: dia(-8), resultado: 'pendiente', pausada_en: null, atendida_en: null, observacion: '', atendida_por: null, solicitud_id: s.id, programada_en: en });
  }
}

writeFileSync(salida, JSON.stringify(d));
const cuenta = (e) => d.solicitud.filter((s) => s.estado === e).length;
console.log(`enviada ${cuenta('enviada')} · validada ${cuenta('validada_en_linea')} · espera ${cuenta('lista_para_curso')} · inscrita ${cuenta('inscrita')} · grupos ${d.grupo.length} · citas hoy ${d.cita.filter((c) => c.programada_en.startsWith(corte) && c.resultado === 'pendiente').length}`);
