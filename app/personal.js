/* =========================================================
   personal.js · Lo común de las pantallas del personal de la Secretaría (etapa 2)

   A las personas del personal se les habla de usted (decisión 2026-10-16).

   ACCESO SIMULADO: en la versión de prueba no hay cuentas del personal. Las
   pantallas entran con un perfil ficticio: «revisión y cotejo» (la misma
   persona revisa en línea, atiende las citas de cotejo, arma los grupos y sube
   el material de estudio; decisión 2026-10-17, P27 y P92) o «instructor»
   (asistencia y examen, INSTRUCTORA). Los perfiles de emisión y consulta se
   simulan cuando existan sus pantallas. En la etapa 3 lo sustituye el acceso
   del SIA.

   Las decisiones que se registran en una prueba sólo se recuerdan en este
   navegador (localStorage, con las claves de APD_ARCHIVOS_PRUEBA.CLAVES):
   revisiones («apd.personal.revisiones») y citas de cotejo atendidas
   («apd.personal.cotejos»), una lista por folio, en orden; grupos y asistencia
   («apd.personal.grupos», una lista de eventos); el pase de lista y los
   exámenes los guarda el servidor simulado (app/examen-servidor.js).
   APD.cargar las aplica a los datos (app/archivos-prueba.js, mezcla).
   ========================================================= */
(function (global) {
  'use strict';
  const { el, estado } = APD;
  const A = global.APD_ARCHIVOS_PRUEBA;
  const CLAVE = A.CLAVES.revisiones;
  const COTEJOS = A.CLAVES.cotejos;

  /* Perfil ficticio de quien revisa y coteja (no es una persona real) */
  const REVISORA = { usuario: 'revision.prueba', nombre: 'María Ejemplo Revisora', perfil: 'Revisión y cotejo' };

  /* Plazos de la bandeja: días de espera desde que la solicitud llegó a revisión.
     Pendiente (P02): los fija la Dirección; mientras, estos valores de prueba. */
  const UMBRAL = { ambar: 3, rojo: 10 };

  /* Cada folio guarda su lista de revisiones (una solicitud puede revisarse varias veces: reenvíos, regreso del cotejo).
     Lo guardado antes de 0.27 era una sola revisión por folio: se lee como lista de una. */
  function historial() { return A.listaPorFolio(CLAVE); }
  /* La última revisión de cada folio */
  function revisiones() { return Object.fromEntries(Object.entries(historial()).map(([f, l]) => [f, l[l.length - 1]])); }
  function agrega(clave, folio, registro) {
    const t = A.listaPorFolio(clave);
    t[folio] = (t[folio] || []).concat([registro]);
    try { global.localStorage.setItem(clave, JSON.stringify(t)); return true; } catch (e) { return false; }
  }
  function guardaRevision(folio, registro) { return agrega(CLAVE, folio, registro); }
  /* Citas de cotejo atendidas en la prueba: { resultado, datos, en, cita_en, expediente, atendio } por folio */
  function guardaCotejo(folio, registro) { return agrega(COTEJOS, folio, registro); }

  /* Días naturales entre dos fechas ISO, en hora de la Ciudad de México */
  function dias(desde, hasta) {
    const d = (iso) => new Date(`${String(iso).slice(0, 10)}T12:00:00-06:00`);
    const local = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
    return Math.round((d(local(hasta)) - d(local(desde))) / 86400000);
  }
  /* Días de espera, nunca negativos: en la prueba, lo enviado en este navegador lleva la fecha real, que puede ser
     posterior a la fecha simulada (se veía «-1 días») */
  function espera(desde, corte) {
    const n = Math.max(0, dias(desde, corte));
    return { n, texto: n === 0 ? 'Hoy' : n === 1 ? '1 día' : `${n} días`, tono: n >= UMBRAL.rojo ? 'error' : n >= UMBRAL.ambar ? 'pend' : '' };
  }
  const ORDINAL = ['', '1.ª', '2.ª', '3.ª', '4.ª', '5.ª', '6.ª'];
  function vuelta(datos, s) {
    const n = datos.revision.filter((r) => r.solicitud_id === s.id).length + 1;
    return { n, texto: n > 1 ? `${ORDINAL[n] || n + '.ª'} (reenviada)` : '1.ª' };
  }
  /* Documentos cargados de nuevo desde la última revisión: lo que la persona corrigió */
  function corregidos(datos, s) {
    const ult = datos.revision.filter((r) => r.solicitud_id === s.id).map((r) => r.revisada_en).sort().pop();
    if (!ult) return [];
    return datos.documento.filter((d) => d.solicitud_id === s.id && d.vigente && d.cargado_en > ult);
  }
  /* Lo que conviene revisar con atención */
  function senales(datos, s) {
    const lista = [];
    if (s.perfil_academico === 'por_clasificar') lista.push(['Carrera por clasificar', 'pend']);
    if (s.perfil_academico === 'no_cumple') lista.push(['Podría no cumplir el perfil', 'pend']);
    const c = corregidos(datos, s).length;
    if (c) lista.push([c === 1 ? '1 documento corregido' : `${c} documentos corregidos`, '']);
    if (datos.documento.some((d) => d.solicitud_id === s.id && d.vigente && d.blob)) lista.push(['Archivos cargados en este navegador', 'ok']);
    return lista;
  }

  /* ----- Citas de cotejo (decisiones 2026-10-17) -----
     Las por atender son las solicitudes validadas con su cita; una cita en pausa espera el documento correcto que la
     persona carga el mismo día. Las ya atendidas quedan como registro de la cita (apd.cita), con lo que pasó. */
  const SITUACION = {
    // Familias de etiqueta (propuesta «Avisos y confirmaciones», 2026-10-17): pend = le toca a usted, marcha = le toca a
    // otra parte, ok = logro, error = cerrada sin acreditación
    pendiente: { texto: 'Por atender', tono: 'pend' },
    en_pausa: { texto: 'En pausa · esperando el documento', tono: 'marcha' },
    documento_nuevo: { texto: 'Documento cargado · retomar', tono: 'pend' },
    // Días anteriores que nadie registró (auditoría de tareas, A3 y M6)
    sin_registrar: { texto: 'Sin registrar · el día ya pasó', tono: 'pend' },
    pausa_vencida: { texto: 'Pausa vencida · regresa con observaciones', tono: 'cerrado' },
    atendida: { texto: 'Atendida', tono: 'ok' },
    no_se_presento: { texto: 'No se presentó · cita nueva', tono: 'pend' },
    cerrada: { texto: 'No se presentó · solicitud cerrada', tono: 'error' },
    sin_pago: { texto: 'Sin pago · cita nueva', tono: 'pend' },
    con_observaciones: { texto: 'Regresó con observaciones', tono: 'marcha' },
    no_es_la_persona: { texto: 'No era la persona · cuenta bloqueada', tono: 'error' }
  };
  /* Documentos que la persona cargó después de que su cita quedó en pausa */
  function cargadosEnPausa(datos, s) {
    const pausa = s.cotejo_pausa;
    if (!pausa) return [];
    return datos.documento.filter((d) => d.solicitud_id === s.id && d.vigente && pausa.docs.includes(d.requisito) && APD.cargadoTras(d, pausa));
  }
  /* Todas las citas (apd.cita): las abiertas se atienden; las cerradas quedan como registro de su día */
  function citas(datos) {
    const persona = Object.fromEntries(datos.solicitante.map((p) => [p.id, p]));
    const porId = Object.fromEntries(datos.solicitud.map((s) => [s.id, s]));
    const lista = [];
    for (const c of datos.cita || []) {
      const s = porId[c.solicitud_id];
      if (!s) continue;
      const p = persona[s.solicitante_id];
      const abierta = ['pendiente', 'en_pausa'].includes(c.resultado);
      // Una cita abierta sólo se atiende con la solicitud validada y la cuenta activa
      if (abierta && (s.estado !== 'validada_en_linea' || !p || p.estado === 'bloqueada')) continue;
      // Una cita abierta de un día que ya pasó: si nadie registró nada, queda «sin registrar» (sin eso la persona no
      // recibe cita nueva ni cuenta su inasistencia); una pausa sólo dura el día de la cita (la base la rechaza después)
      const atrasada = abierta && diaDe(c.programada_en) < APD.hoy(datos);
      const situacion = atrasada ? (c.resultado === 'en_pausa' ? 'pausa_vencida' : 'sin_registrar')
        : c.resultado === 'en_pausa' ? (cargadosEnPausa(datos, s).length ? 'documento_nuevo' : 'en_pausa')
          : c.resultado === 'no_se_presento' && (c.cierra || (s.estado === 'concluida_sin_atender' && s.estado_desde <= (c.atendida_en || ''))) ? 'cerrada'
            : c.resultado;
      lista.push({ s, p, en: c.programada_en, situacion, cita: c, pendiente: abierta && situacion !== 'pausa_vencida', atrasada });
    }
    return lista.sort((a, b) => String(a.en).localeCompare(String(b.en)) || Number(b.pendiente) - Number(a.pendiente));
  }
  /* Citas por atender ese día y a esa hora: se muestran al fijar una cita (auditoría de tareas, M5). El cupo por
     horario lo define el área (P69); mientras, se dice cuántas hay. */
  function cargaCitas(datos, dia, hora) {
    const abiertas = citas(datos).filter((c) => c.pendiente && diaDe(c.en) === dia);
    return { dia: abiertas.length, hora: hora ? abiertas.filter((c) => horaDe(c.en) === hora).length : null };
  }
  function pintaCargaCitas(datos, caja) {
    const f = document.getElementById('cita_fecha');
    const h = document.getElementById('cita_hora');
    const pinta = () => {
      // La fecha se escribe día/mes/año (campo «fecha-dma» del estándar, D9): se lleva a AAAA-MM-DD
      const V = global.FORMKIT_VALIDACIONES;
      const dia = (V && V.isoDeDma && V.isoDeDma(f.value)) || f.value;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dia)) { caja.hidden = true; return; }
      const n = cargaCitas(datos, dia, h.value);
      caja.textContent = `Ese día ya hay ${n.dia === 1 ? '1 cita' : `${n.dia} citas`}${h.value ? `; ${n.hora} a las ${h.value}` : ''}.`;
      caja.hidden = false;
    };
    f.addEventListener('input', pinta);
    f.addEventListener('change', pinta);
    h.addEventListener('change', pinta);
    pinta();
  }
  /* Día de una cita (AAAA-MM-DD) y su hora (HH:MM), en hora de la Ciudad de México */
  const diaDe = APD.diaDe;
  const horaDe = (iso) => new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Mexico_City' });
  /* Número de expediente que se abriría hoy: consecutivo por año y sin huecos, como apd.asignar_expediente.
     Formato provisional EXP-AAAA-NNNN. */
  function siguienteExpediente(datos) {
    const anio = String(datos.fecha_corte).slice(0, 4);
    const n = datos.solicitante.map((p) => String(p.numero_expediente || '').match(new RegExp(`^EXP-${anio}-(\\d+)$`)))
      .filter(Boolean).map((m) => Number(m[1]));
    return `EXP-${anio}-${String((n.length ? Math.max(...n) : 0) + 1).padStart(4, '0')}`;
  }

  /* Solicitudes por revisar, en el orden de la bandeja: lo enviado en este navegador primero (para encontrarlo), luego
     de la que más espera a la más reciente. La usan la bandeja y «Revisar la siguiente». */
  function porRevisar(datos) {
    return datos.solicitud.filter((s) => s.estado === 'enviada')
      .sort((a, b) => Number(Boolean(b.de_prueba)) - Number(Boolean(a.de_prueba)) || a.estado_desde.localeCompare(b.estado_desde));
  }

  /* ----- Grupos (maqueta aprobada y decisiones del 2026-10-17) -----
     La espera de cada curso, los grupos y su situación. Quién arma los grupos está por decidir (P92): mientras, el mismo
     perfil «revisión y cotejo». Lo hecho en la prueba se guarda en «apd.personal.grupos» (una lista de eventos, en
     orden) y APD.cargar lo aplica como la base (app/archivos-prueba.js, aplicaGrupos). */
  const GRUPOS = A.CLAVES.grupos;
  /* Instructores ficticios (cuentas del acceso del SIA en la etapa 3, perfil «instructor», P27) */
  const INSTRUCTORES = [
    { usuario: 'instructor.ficticio', nombre: 'Laura Ejemplo Instructora' },
    { usuario: 'instructor2.ficticio', nombre: 'Instructor Ejemplo Dos' }
  ];
  const INSTRUCTORA = Object.assign({ perfil: 'Instructor' }, INSTRUCTORES[0]);
  const nombreInstructor = (u) => (INSTRUCTORES.find((i) => i.usuario === u) || {}).nombre || u || '';
  function guardaGrupo(evento) {
    const lista = A.eventosGrupos().concat([Object.assign({ en: new Date().toISOString() }, evento)]);
    try { global.localStorage.setItem(GRUPOS, JSON.stringify(lista)); return Promise.resolve(true); } catch (e) { return Promise.reject(new Error('almacenamiento')); }
  }

  const CURSOS = [['poda', 'nueva'], ['poda', 'renovacion'], ['dictaminador', 'nueva'], ['dictaminador', 'renovacion']];
  const claveCurso = (t, m) => `${t}-${m}`;
  const deClave = (k) => CURSOS.find(([t, m]) => claveCurso(t, m) === k) || null;
  const nombreCurso = (t, m) => `${APD.TIPOS[t]} · ${m === 'renovacion' ? 'renovación' : 'nueva'}`;
  const INTEGRACION = { especifico: 'De una organización', combinado: 'Combinado' };

  /* Adscripción con la que se envió la solicitud (copia de la de la cuenta) */
  function organizacionDe(datos, s) {
    if (!s.organizacion_id) return s.adscripcion && s.adscripcion !== 'independiente' && s.organizacion_nombre ? s.organizacion_nombre : 'Independiente';
    const o = datos.organizacion.find((x) => x.id === s.organizacion_id);
    return o ? o.nombre : s.organizacion_nombre || 'Independiente';
  }

  /* Personas en espera de grupo de un curso: de la que más espera a la más reciente; desde dias_alerta_espera días es
     prioritaria. En renovación, por la fecha en que vence su acreditación (decisión 2026-10-14). */
  function enEspera(datos, tipo, modalidad) {
    const hoy = APD.hoy(datos);
    const alerta = APD.parametro(datos, 'dias_alerta_espera') || 31;
    const persona = Object.fromEntries(datos.solicitante.map((p) => [p.id, p]));
    const lista = datos.solicitud.filter((s) => s.estado === 'lista_para_curso' && s.tipo_acreditacion === tipo && s.modalidad === modalidad).map((s) => {
      const desde = s.lista_para_curso_en || s.estado_desde;
      const n = Math.max(0, dias(desde, hoy));
      const ant = s.acreditacion_anterior_id ? datos.acreditacion.find((a) => a.id === s.acreditacion_anterior_id) : null;
      const vence = ant ? ant.vence_en : null;
      return { s, p: persona[s.solicitante_id] || {}, organizacion: organizacionDe(datos, s), desde, dias: n, prioritaria: n >= alerta,
        vence, vencida: vence ? vence < hoy : false };
    });
    return lista.sort((a, b) => (modalidad === 'renovacion' && a.vence && b.vence ? a.vence.localeCompare(b.vence) : 0)
      || String(a.desde).localeCompare(String(b.desde)) || a.s.folio.localeCompare(b.s.folio));
  }

  /* Un grupo con su curso, sus personas y su situación */
  const SITUACION_GRUPO = {
    en_integracion: { texto: 'Por confirmar', tono: 'pend' },
    confirmado: { texto: 'Confirmado', tono: 'ok' },
    en_curso: { texto: 'En curso', tono: 'marcha' },
    concluido: { texto: 'Concluido', tono: 'cerrado' },
    cancelado: { texto: 'Cancelado', tono: 'cerrado' }
  };
  function grupo(datos, g) {
    const c = APD.curso(datos, g.tipo_acreditacion, g.modalidad);
    const inscritas = datos.inscripcion.filter((i) => i.grupo_id === g.id && i.activa);
    const hoy = APD.hoy(datos);
    const ultimo = g.fecha_inicio && c ? APD.sumaDias(g.fecha_inicio, c.dias_duracion - 1) : null;
    const dia = g.estado === 'en_curso' && g.fecha_inicio ? Math.min(dias(g.fecha_inicio, hoy) + 1, c.dias_duracion) : null;
    const sit = SITUACION_GRUPO[g.estado] || { texto: g.estado, tono: '' };
    const texto = dia ? `${sit.texto} · día ${dia} de ${c.dias_duracion}` : sit.texto;
    // Recibe personas en integración o, confirmado, hasta el día anterior al inicio, sin pasar del máximo
    const recibe = (g.estado === 'en_integracion' || (g.estado === 'confirmado' && hoy < g.fecha_inicio)) && inscritas.length < g.cupo_maximo;
    const org = g.organizacion_id ? datos.organizacion.find((o) => o.id === g.organizacion_id) : null;
    return { g, c, inscritas, n: inscritas.length, ultimo, dia, situacion: { texto, tono: sit.tono }, recibe, lugar: g.cupo_maximo - inscritas.length,
      integracion: g.integracion === 'especifico' ? `${INTEGRACION.especifico} · ${org ? org.nombre : ''}` : INTEGRACION.combinado,
      nombre: nombreCurso(g.tipo_acreditacion, g.modalidad), calculado: APD.nombreGrupo(g, datos) };
  }
  const ORDEN_GRUPO = { en_curso: 0, confirmado: 1, en_integracion: 2, concluido: 3, cancelado: 4 };
  function grupos(datos) {
    return datos.grupo.map((g) => grupo(datos, g))
      .sort((a, b) => ORDEN_GRUPO[a.g.estado] - ORDEN_GRUPO[b.g.estado] || String(b.g.folio).localeCompare(String(a.g.folio)));
  }
  /* Folio que la base le daría al siguiente grupo del año (APD-G-AAAA-NNN) */
  function siguienteFolioGrupo(datos) {
    const anio = String(APD.hoy(datos)).slice(0, 4);
    const n = datos.grupo.map((g) => String(g.folio).match(new RegExp(`^APD-G-${anio}-(\\d+)$`))).filter(Boolean).map((m) => Number(m[1]));
    return `APD-G-${anio}-${String((n.length ? Math.max(...n) : 0) + 1).padStart(3, '0')}`;
  }
  /* Texto del cupo: «4 de 25 · falta 1 para el mínimo de 5» */
  function cupoTexto(x) {
    const falta = x.g.cupo_minimo - x.n;
    return falta > 0 ? `${x.n} de ${x.g.cupo_maximo} · ${falta === 1 ? 'falta 1' : `faltan ${falta}`} para el mínimo de ${x.g.cupo_minimo}` : `${x.n} de ${x.g.cupo_maximo}`;
  }

  /* ----- Planear los cursos (propuestas A, B y D aprobadas por Liber el 2026-10-18) -----
     Lo que comparten «Grupos» (planeador por curso), «Programar un curso» y «Mis grupos de hoy». */
  /* Horas de entrada: la misma lista cerrada de 24 horas que la ficha del grupo (grupo.html). Horarios de prueba: los
     define el área (P91). */
  const HORAS = ['07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00'];
  /* Lunes de la semana de una fecha (las semanas van de lunes a domingo) */
  function lunesDe(iso) {
    const d = new Date(`${String(iso).slice(0, 10)}T12:00:00-06:00`);
    return APD.sumaDias(String(iso).slice(0, 10), -((d.getUTCDay() + 6) % 7));
  }
  /* Primer día en que puede empezar un curso que se confirma hoy: dias_anticipacion_grupo días después (R25) */
  const primerDiaPosible = (datos) => APD.sumaDias(APD.hoy(datos), APD.parametro(datos, 'dias_anticipacion_grupo') || 7);
  /* Días inhábiles del calendario oficial: [por confirmar]. Mientras la Secretaría no los publique no se inventan; el
     lugar queda listo (parámetro dias_inhabiles de la base, AAAA-MM-DD separados por coma, cuando exista). */
  function diasInhabiles(datos) {
    const p = (datos.parametro || []).find((x) => x.clave === 'dias_inhabiles');
    return p ? String(p.valor || '').split(',').map((s) => s.trim()).filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s)) : [];
  }
  /* Los grupos de un curso que ocupan alguna de esas fechas (sin los cancelados ni los concluidos) */
  const ACTIVOS = ['en_integracion', 'confirmado', 'en_curso'];
  const traslapa = (a1, a2, b1, b2) => a1 <= b2 && b1 <= a2;
  function choques(datos, tipo, modalidad, desde, hasta, exceptoId) {
    return datos.grupo.filter((g) => g.id !== exceptoId && g.tipo_acreditacion === tipo && g.modalidad === modalidad && ACTIVOS.includes(g.estado)
      && g.fecha_inicio && traslapa(desde, hasta, g.fecha_inicio, APD.ultimoDia(datos, g)));
  }
  /* Los grupos que ese instructor da en esas fechas, de cualquier curso */
  function ocupado(datos, usuario, desde, hasta, exceptoId) {
    return datos.grupo.filter((g) => g.id !== exceptoId && g.instructor === usuario && ACTIVOS.includes(g.estado)
      && g.fecha_inicio && traslapa(desde, hasta, g.fecha_inicio, APD.ultimoDia(datos, g)));
  }
  /* ¿Puede empezar ahí un curso? → null o la razón (para el calendario y para el error del formulario) */
  function razonNoInicio(datos, tipo, modalidad, inicio, exceptoId) {
    const c = APD.curso(datos, tipo, modalidad);
    const fin = APD.sumaDias(inicio, c.dias_duracion - 1);
    const anticipacion = APD.parametro(datos, 'dias_anticipacion_grupo') || 7;
    if (inicio < primerDiaPosible(datos)) return { clave: 'anticipacion', texto: `faltan menos de ${anticipacion} días: el curso empieza al menos ${anticipacion} días después de confirmarlo` };
    const otro = choques(datos, tipo, modalidad, inicio, fin, exceptoId)[0];
    if (otro) return { clave: 'otro_curso', texto: `ya hay un curso de ${APD.cursoCorto(tipo, modalidad).toLowerCase()} esas fechas (${APD.nombreGrupo(otro, datos, { sinCurso: true }).toLowerCase()}, ${otro.folio})`, grupo: otro };
    const inhabiles = diasInhabiles(datos);
    const dia = inhabiles.find((d) => d >= inicio && d <= fin);
    if (dia) return { clave: 'inhabil', texto: `el ${APD.diaMes(dia)} es día inhábil [por confirmar con el calendario oficial]` };
    return null;
  }
  /* Bloques de la espera (propuesta A): las personas de una misma organización van juntas, en un bloque que ocupa el
     lugar de quien más espera de ellas; las demás (independientes o solas de su organización), una por una, en su orden. */
  function bloquesEspera(lista) {
    const cuenta = {};
    for (const x of lista) if (x.s.organizacion_id) cuenta[x.s.organizacion_id] = (cuenta[x.s.organizacion_id] || 0) + 1;
    const bloques = [];
    for (const x of lista) {
      const org = x.s.organizacion_id;
      if (org && cuenta[org] > 1) {
        let b = bloques.find((y) => y.clave === org);
        if (!b) { b = { clave: org, nombre: x.organizacion, junta: true, xs: [] }; bloques.push(b); }
        b.xs.push(x);
      } else bloques.push({ clave: `sola:${x.s.folio}`, nombre: x.organizacion, junta: false, xs: [x] });
    }
    return bloques;
  }
  /* Las que más esperan, hasta n lugares: por bloques completos, para que una organización no se separe; un bloque que no
     cabe se salta y sigue el siguiente. filtro (opcional) deja sólo a quien puede ir (un grupo de una organización). */
  function lasQueMasEsperan(lista, n, filtro) {
    const candidatas = filtro ? lista.filter(filtro) : lista;
    // En un grupo de una organización, o si todas las que esperan son de la misma, no hay a quién no separar: se toman
    // una por una, en su orden (auditoría «intentar romperlo», F3 M4: un bloque de 13 no cabía en 2 lugares y no se
    // proponía a nadie)
    const orgs = new Set(candidatas.map((x) => x.s.organizacion_id || null));
    if (filtro || (orgs.size === 1 && !orgs.has(null))) return candidatas.slice(0, Math.max(0, n));
    const elegidas = [];
    for (const b of bloquesEspera(candidatas)) {
      if (elegidas.length >= n) break;
      if (elegidas.length + b.xs.length <= n) elegidas.push(...b.xs);
    }
    return elegidas;
  }
  /* Situación de un grupo en una fecha: «Día 2 de 5», «Examen hoy» (en curso), o null */
  function diaDelCurso(datos, g) {
    if (g.estado !== 'en_curso' || !g.fecha_inicio) return null;
    const c = APD.curso(datos, g.tipo_acreditacion, g.modalidad);
    const n = dias(g.fecha_inicio, APD.hoy(datos)) + 1;
    if (n < 1 || n > c.dias_duracion) return null;
    return { n, de: c.dias_duracion, examen: n === c.dias_duracion, texto: n === c.dias_duracion ? (c.dias_duracion > 1 ? `Día ${n} de ${n} · examen hoy` : 'Curso y examen hoy') : `Día ${n} de ${c.dias_duracion}` };
  }
  /* «Mis grupos de hoy» del instructor: sus grupos en curso con clase o examen hoy; y los próximos (confirmados o por
     confirmar con fecha) */
  function gruposDeHoy(datos, usuario) {
    return datos.grupo.filter((g) => g.instructor === usuario && diaDelCurso(datos, g))
      .sort((a, b) => String(a.fecha_inicio).localeCompare(String(b.fecha_inicio)) || String(a.folio).localeCompare(String(b.folio)));
  }
  function proximosDe(datos, usuario) {
    const hoy = APD.hoy(datos);
    return datos.grupo.filter((g) => g.instructor === usuario && ['confirmado', 'en_integracion'].includes(g.estado) && g.fecha_inicio && g.fecha_inicio > hoy)
      .sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio));
  }
  /* Pinta «Mis grupos de hoy» y «Próximos» (asistencia.html y aplicar.html sin ?folio=): una tarjeta por grupo con su
     nombre calculado, folio, lugar, hora, personas y la acción del día: «Pasar asistencia» un día de curso, «Pasar lista y
     aplicar» el día del examen. */
  function pintaMisGrupos(contenedor, datos, usuario) {
    const sede = APD.sede(datos).nombre;
    const tarjeta = (g, i) => {
      const x = grupo(datos, g);
      const d = diaDelCurso(datos, g);
      const idN = `mio-${i}`;
      const lugar = d.examen ? 'Salón de cómputo del PILARES' : `Aula de capacitación del ${sede}`;
      const href = d.examen ? `aplicar.html?folio=${encodeURIComponent(g.folio)}` : `asistencia.html?folio=${encodeURIComponent(g.folio)}`;
      return el('li', { class: 'hoy-grupo' }, [
        el('div', { class: 'hoy-grupo-cabeza' }, [
          el('h3', { class: 'hoy-grupo-nombre', id: idN }, [APD.grupoTitulo(g, datos)]),
          estado(d.examen ? 'Examen hoy' : d.texto, d.examen ? 'pend' : 'marcha')
        ]),
        el('p', { class: 'hoy-grupo-datos' }, APD.meta([lugar, APD.hhmm(g.hora_entrada), APD.plural(x.n, 'persona', 'personas')])),
        el('a', { class: 'btn btn-primario hoy-grupo-accion', href, 'aria-describedby': idN }, [
          document.createTextNode(d.examen ? 'Pasar lista y aplicar' : 'Pasar asistencia'), APD.icono('flecha-der')])
      ]);
    };
    const hoyL = gruposDeHoy(datos, usuario);
    const prox = proximosDe(datos, usuario);
    const partes = [];
    partes.push(hoyL.length ? el('ul', { class: 'hoy-grupos' }, hoyL.map(tarjeta)) : el('p', { texto: 'Hoy no tiene grupos con clase ni examen.' }));
    partes.push(el('h3', { class: 'titulo-bloque', texto: 'Próximos' }));
    partes.push(prox.length ? el('ul', { class: 'hoy-proximos' }, prox.map((g) => el('li', {}, [APD.grupoTitulo(g, datos),
      el('span', { class: 'hoy-proximo-estado', texto: g.estado === 'confirmado' ? `Confirmado · entrada ${APD.hhmm(g.hora_entrada)}` : 'Por confirmar' })])))
      : el('p', { class: 'texto-gris', texto: 'No tiene otros grupos programados.' }));
    contenedor.replaceChildren(...partes);
    return hoyL;
  }

  /* Cabecera de sesión del personal. El perfil «instructor» sólo ve sus grupos (asistencia y examen). */
  function pintaSesion(contenedor, actual, perfil) {
    if (!contenedor) return;
    const salir = el('a', { class: 'btn-enlace', href: 'index.html', texto: 'Salir' });
    const quien = perfil === 'instructor' ? INSTRUCTORA : REVISORA;
    const enlace = (href, clave, texto) => el('a', { class: 'btn-enlace', href, 'aria-current': actual === clave ? 'page' : null, texto });
    const enlaces = perfil === 'instructor'
      ? [enlace('asistencia.html', 'asistencia', 'Asistencia'), enlace('aplicar.html', 'aplicar', 'Aplicar el examen')]
      : [enlace('revision.html', 'revision', 'Revisión documental'), enlace('citas.html', 'citas', 'Citas de cotejo'), enlace('grupos.html', 'grupos', 'Grupos'),
        enlace('material-personal.html', 'material', 'Material de estudio')];
    contenedor.replaceChildren(
      // El perfil no es un estado (auditoría 2026-10-18, B11 y D6): va como texto, no como etiqueta de estado
      el('p', { class: 'sesion-nombre' }, [document.createTextNode(quien.nombre), el('span', { class: 'sesion-perfil', texto: `Perfil: ${quien.perfil.toLowerCase()}` })]),
      el('nav', { class: 'sesion-enlaces', 'aria-label': 'Secciones del personal' }, enlaces.concat([salir]))
    );
  }

  /* Concentrado de asistencia del grupo (pedido de Liber, 2026-10-18): una fila por persona y una columna por día, con
     los días asistidos y si conserva el derecho a examen. La captura sigue siendo por día («Asistencia»); esto es la
     vista de conjunto, en la ficha del grupo (en curso o concluido). El último día es el del examen:
     su asistencia es el pase de lista del salón de cómputo. Sólo cuenta como falta lo marcado «Faltó»; un día que ya
     pasó sin capturar se señala aparte («Sin capturar»), como en la captura.
     marco: el [data-tabla] con [data-conc-encabezado], [data-conc-filas] y [data-conc-leyenda].
     El pase de lista ya viene en datos.asistencia (en la prueba lo aplica APD.cargar; en el SIA, apd.asistencia). */
  function pintaConcentrado(marco, datos, x) {
    const { g, c } = x;
    if (!marco || !c || !g.fecha_inicio) return;
    const hoy = APD.hoy(datos);
    const ultimo = c.dias_duracion;
    const permitidas = c.dias_duracion - c.dias_minimos_asistencia;
    const fechaDia = (n) => APD.sumaDias(g.fecha_inicio, n - 1);
    const registro = (insId, n) => {
      const a = datos.asistencia.find((r) => r.inscripcion_id === insId && r.dia === n);
      return a ? a.asistio : null;
    };
    const $$ = (s) => marco.querySelector(s);
    const dias = Array.from({ length: ultimo }, (_, k) => k + 1);
    $$('[data-conc-encabezado]').replaceChildren(...['Persona', ...dias.map((n) => `${APD.fecha(fechaDia(n)).slice(0, 5)}${n === ultimo && ultimo > 1 ? ' · examen' : ''}`), 'Días', 'Examen']
      .map((t) => el('th', { scope: 'col', texto: t })));
    const persona = Object.fromEntries(datos.solicitante.map((p) => [p.id, p]));
    const sols = Object.fromEntries(datos.solicitud.map((s) => [s.id, s]));
    const inscritas = g.estado === 'cancelado' ? [] : x.inscritas;
    const filas = inscritas.map((i) => {
      const s = sols[i.solicitud_id] || {};
      const quien = APD.nombreCompleto(persona[s.solicitante_id] || {});
      let asistidos = 0;
      let faltas = 0;
      // Ficha compacta (propuesta A, 2026-10-18): ✓ y ✗ con su texto para el lector; sólo «Sin derecho» lleva color
      const marca = (simbolo, texto, clase) => el('td', { class: clase }, [el('span', { 'aria-hidden': 'true', texto: simbolo }), el('span', { class: 'solo-lector', texto })]);
      const celdas = dias.map((n) => {
        const r = registro(i.id, n);
        const examen = n === ultimo && ultimo > 1;
        if (r === true) { asistidos += 1; return marca('✓', examen ? 'Presente' : 'Asistió', 'conc-si'); }
        if (r === false) { if (!examen) faltas += 1; return marca('✗', examen ? 'No llegó' : 'Faltó', 'conc-no'); }
        const f = fechaDia(n);
        if (f < hoy) return el('td', {}, [el('span', { class: 'conc-hueco', texto: 'Sin capturar' })]);
        return el('td', { class: 'texto-gris', texto: f === hoy ? 'Hoy' : '—' });
      });
      const sinDerecho = faltas > permitidas;
      const derecho = el('span', { class: sinDerecho ? 'conc-sin-derecho' : 'texto-gris',
        texto: sinDerecho ? 'Sin derecho' : registro(i.id, ultimo) === true ? 'Lo presentó' : faltas === permitidas && faltas ? 'Ya no puede faltar' : 'Con derecho' });
      return el('tr', {}, [el('td', { texto: quien }), ...celdas, el('td', { class: 'sin-corte', texto: `${asistidos} de ${ultimo}` }), el('td', {}, [derecho])]);
    });
    $$('[data-conc-filas]').replaceChildren(...filas);
    const leyenda = $$('[data-conc-leyenda]');
    if (leyenda) leyenda.textContent = `Asistencia del grupo ${g.folio} por persona y por día`;
    const vacia = marco.querySelector('[data-conc-vacia]');
    if (vacia) vacia.hidden = filas.length > 0;
    marco.dispatchEvent(new CustomEvent('formkit:tabla'));
  }

  global.APD_PERSONAL = { HORAS, lunesDe, primerDiaPosible, diasInhabiles, choques, ocupado, razonNoInicio, bloquesEspera, lasQueMasEsperan,
    diaDelCurso, gruposDeHoy, proximosDe, pintaMisGrupos, porRevisar, REVISORA, INSTRUCTORA, nombreInstructor, guardaGrupo, CURSOS, claveCurso, deClave,
    nombreCurso, organizacionDe, enEspera, grupo, grupos, siguienteFolioGrupo, cupoTexto, UMBRAL, revisiones, guardaRevision, guardaCotejo, SITUACION, citas, cargadosEnPausa, diaDe, horaDe, siguienteExpediente, pintaCargaCitas, espera, vuelta, corregidos, senales, pintaSesion, pintaConcentrado };
}(window));
