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
  function espera(desde, corte) {
    const n = dias(desde, corte);
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
    pendiente: { texto: 'Por atender', tono: '' },
    en_pausa: { texto: 'En pausa · esperando el documento', tono: 'pend' },
    documento_nuevo: { texto: 'Documento cargado · retomar', tono: 'pend' },
    atendida: { texto: 'Atendida', tono: 'ok' },
    no_se_presento: { texto: 'No se presentó · cita nueva', tono: '' },
    cerrada: { texto: 'No se presentó · solicitud cerrada', tono: 'error' },
    sin_pago: { texto: 'Sin pago · cita nueva', tono: '' },
    con_observaciones: { texto: 'Regresó con observaciones', tono: 'pend' },
    no_es_la_persona: { texto: 'No era la persona · cuenta bloqueada', tono: 'error' }
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

  /* Cabecera de sesión del personal */
  function pintaSesion(contenedor, actual) {
    if (!contenedor) return;
    const salir = el('a', { class: 'btn-enlace', href: 'index.html', texto: 'Salir' });
    contenedor.replaceChildren(
      el('p', { class: 'sesion-nombre' }, [document.createTextNode(`${REVISORA.nombre} `), APD.estado(`Perfil: ${REVISORA.perfil.toLowerCase()}`)]),
      el('nav', { class: 'sesion-enlaces', 'aria-label': 'Secciones del personal' }, [
        el('a', { class: 'btn-enlace', href: 'revision.html', 'aria-current': actual === 'revision' ? 'page' : null, texto: 'Revisión documental' }),
        el('a', { class: 'btn-enlace', href: 'citas.html', 'aria-current': actual === 'citas' ? 'page' : null, texto: 'Citas de cotejo' }),
        salir
      ])
    );
  }

  /* Versión de prueba: los datos ficticios más lo que se envió en este navegador (app/archivos-prueba.js), con la misma
     forma que la base. Una solicitud nueva entra como enviada, con su persona y sus documentos; un reenvío de una
     solicitud ficticia la vuelve a poner en revisión con los documentos corregidos como carga vigente. */
  /* Lo registrado en este navegador durante la prueba ya viene en los datos (APD.cargar → APD_ARCHIVOS_PRUEBA.mezcla) */
  function datosConPrueba(datos) { return Promise.resolve(datos); }

  global.APD_PERSONAL = { datosConPrueba, REVISORA, UMBRAL, historial, revisiones, guardaRevision, cotejos, guardaCotejo, SITUACION, citas, cargadosEnPausa, diaDe, horaDe, siguienteExpediente, dias, espera, vuelta, corregidos, senales, pintaSesion };
}(window));
