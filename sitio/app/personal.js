/* =========================================================
   personal.js · Lo común de las pantallas del personal de la Secretaría (etapa 2)

   A las personas del personal se les habla de usted (decisión 2026-10-16).

   ACCESO SIMULADO: en la versión de prueba no hay cuentas del personal. Las
   pantallas entran con un perfil ficticio de «revisión y cotejo»: la misma
   persona revisa en línea y atiende las citas de cotejo (decisión 2026-10-17,
   P27). Los demás perfiles (instructor, emisión, consulta) se simulan cuando
   existan sus pantallas. En la etapa 3 lo sustituye el acceso del SIA.

   Las decisiones que se registran en una prueba sólo se recuerdan en este
   navegador (localStorage): revisiones en «apd.personal.revisiones» y citas de
   cotejo atendidas en «apd.personal.cotejos», una lista por folio, en orden.
   APD.cargar las aplica a los datos (app/archivos-prueba.js, mezcla).
   ========================================================= */
(function (global) {
  'use strict';
  const { el } = APD;
  const CLAVE = 'apd.personal.revisiones';
  const COTEJOS = 'apd.personal.cotejos';

  /* Perfil ficticio de quien revisa y coteja (no es una persona real) */
  const REVISORA = { usuario: 'revision.prueba', nombre: 'María Ejemplo Revisora', perfil: 'Revisión y cotejo' };

  /* Plazos de la bandeja: días de espera desde que la solicitud llegó a revisión.
     Pendiente (P02): los fija la Dirección; mientras, estos valores de prueba. */
  const UMBRAL = { ambar: 3, rojo: 10 };

  /* Cada folio guarda su lista de revisiones (una solicitud puede revisarse varias veces: reenvíos, regreso del cotejo).
     Lo guardado antes de 0.27 era una sola revisión por folio: se lee como lista de una. */
  const lee = (clave) => { try { return JSON.parse(global.localStorage.getItem(clave) || '{}'); } catch (e) { return {}; } };
  const comoLista = (t) => Object.fromEntries(Object.entries(t).map(([f, v]) => [f, Array.isArray(v) ? v : [v]]));
  function historial() { return comoLista(lee(CLAVE)); }
  /* La última revisión de cada folio */
  function revisiones() { return Object.fromEntries(Object.entries(historial()).map(([f, l]) => [f, l[l.length - 1]])); }
  function agrega(clave, folio, registro) {
    const t = comoLista(lee(clave));
    t[folio] = (t[folio] || []).concat([registro]);
    try { global.localStorage.setItem(clave, JSON.stringify(t)); return true; } catch (e) { return false; }
  }
  function guardaRevision(folio, registro) { return agrega(CLAVE, folio, registro); }
  /* Citas de cotejo atendidas en la prueba: { resultado, datos, en, cita_en, expediente, atendio } por folio */
  function cotejos() { return comoLista(lee(COTEJOS)); }
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
    if (s.perfil_academico === 'no_cumple') lista.push(['Podría no cumplir el perfil', 'error']);
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
    atendida: { texto: 'Atendida', tono: 'ok' },
    no_se_presento: { texto: 'No se presentó · cita nueva', tono: 'pend', icono: 'fecha' },
    cerrada: { texto: 'No se presentó · solicitud cerrada', tono: 'error' },
    sin_pago: { texto: 'Sin pago · cita nueva', tono: 'pend', icono: 'fecha' },
    con_observaciones: { texto: 'Regresó con observaciones', tono: 'marcha' },
    no_es_la_persona: { texto: 'No era la persona · cuenta bloqueada', tono: 'error', icono: 'candado' }
  };
  /* Documentos que la persona cargó después de que su cita quedó en pausa */
  function cargadosEnPausa(datos, s) {
    const pausa = s.cotejo_pausa;
    if (!pausa) return [];
    return datos.documento.filter((d) => d.solicitud_id === s.id && d.vigente && pausa.docs.includes(d.requisito) && d.cargado_real && d.cargado_real > pausa.real);
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
      const situacion = c.resultado === 'en_pausa' ? (cargadosEnPausa(datos, s).length ? 'documento_nuevo' : 'en_pausa')
        : c.resultado === 'no_se_presento' && (c.cierra || (s.estado === 'concluida_sin_atender' && s.estado_desde <= (c.atendida_en || ''))) ? 'cerrada'
          : c.resultado;
      lista.push({ s, p, en: c.programada_en, situacion, cita: c, pendiente: abierta });
    }
    return lista.sort((a, b) => String(a.en).localeCompare(String(b.en)) || Number(b.pendiente) - Number(a.pendiente));
  }
  /* Día de una cita (AAAA-MM-DD) y su hora (HH:MM), en hora de la Ciudad de México */
  const diaDe = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' });
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
  const GRUPOS = 'apd.personal.grupos';
  /* Instructores ficticios (cuentas del acceso del SIA en la etapa 3, perfil «instructor», P27) */
  const INSTRUCTORES = [
    { usuario: 'instructor.ficticio', nombre: 'Laura Ejemplo Instructora' },
    { usuario: 'instructor2.ficticio', nombre: 'Instructor Ejemplo Dos' }
  ];
  const INSTRUCTORA = Object.assign({ perfil: 'Instructor' }, INSTRUCTORES[0]);
  const nombreInstructor = (u) => (INSTRUCTORES.find((i) => i.usuario === u) || {}).nombre || u || '';
  function eventosGrupos() { try { const v = JSON.parse(global.localStorage.getItem(GRUPOS) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }
  function guardaGrupo(evento) {
    const lista = eventosGrupos().concat([Object.assign({ en: new Date().toISOString() }, evento)]);
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
      integracion: g.integracion === 'especifico' ? `De una organización · ${org ? org.nombre : ''}` : 'Combinado',
      nombre: nombreCurso(g.tipo_acreditacion, g.modalidad) };
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

  /* Cabecera de sesión del personal. El perfil «instructor» sólo ve sus grupos (asistencia y examen). */
  function pintaSesion(contenedor, actual, perfil) {
    if (!contenedor) return;
    const salir = el('a', { class: 'btn-enlace', href: 'index.html', texto: 'Salir' });
    const quien = perfil === 'instructor' ? INSTRUCTORA : REVISORA;
    const enlace = (href, clave, texto) => el('a', { class: 'btn-enlace', href, 'aria-current': actual === clave ? 'page' : null, texto });
    const enlaces = perfil === 'instructor'
      ? [enlace('asistencia.html', 'asistencia', 'Asistencia'), enlace('aplicar.html', 'aplicar', 'Aplicar el examen')]
      : [enlace('revision.html', 'revision', 'Revisión documental'), enlace('citas.html', 'citas', 'Citas de cotejo'), enlace('grupos.html', 'grupos', 'Grupos')];
    contenedor.replaceChildren(
      el('p', { class: 'sesion-nombre' }, [document.createTextNode(`${quien.nombre} `), APD.estado(`Perfil: ${quien.perfil.toLowerCase()}`)]),
      el('nav', { class: 'sesion-enlaces', 'aria-label': 'Secciones del personal' }, enlaces.concat([salir]))
    );
  }

  /* Versión de prueba: los datos ficticios más lo que se envió en este navegador (app/archivos-prueba.js), con la misma
     forma que la base. Una solicitud nueva entra como enviada, con su persona y sus documentos; un reenvío de una
     solicitud ficticia la vuelve a poner en revisión con los documentos corregidos como carga vigente. */
  /* Lo registrado en este navegador durante la prueba ya viene en los datos (APD.cargar → APD_ARCHIVOS_PRUEBA.mezcla) */
  function datosConPrueba(datos) { return Promise.resolve(datos); }

  global.APD_PERSONAL = { datosConPrueba, porRevisar, REVISORA, INSTRUCTORES, INSTRUCTORA, nombreInstructor, eventosGrupos, guardaGrupo, CURSOS, claveCurso, deClave,
    nombreCurso, INTEGRACION, organizacionDe, enEspera, SITUACION_GRUPO, grupo, grupos, siguienteFolioGrupo, cupoTexto, UMBRAL, historial, revisiones, guardaRevision, cotejos, guardaCotejo, SITUACION, citas, cargadosEnPausa, diaDe, horaDe, siguienteExpediente, dias, espera, vuelta, corregidos, senales, pintaSesion };
}(window));
