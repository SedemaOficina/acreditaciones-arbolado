/* =========================================================
   personal.js · Lo común de las pantallas del personal de la Secretaría (etapa 2)

   A las personas del personal se les habla de usted (decisión 2026-10-16).

   ACCESO SIMULADO: en la versión de prueba no hay cuentas del personal. Las
   pantallas entran con un perfil ficticio de revisión documental; los demás
   perfiles (cotejo, instructor, emisión, consulta) se simulan cuando existan
   sus pantallas (P27). En la etapa 3 lo sustituye el acceso del SIA.

   Las decisiones que se registran en una prueba sólo se recuerdan en esta
   pestaña (sessionStorage), para que la bandeja muestre lo que ya se revisó.
   ========================================================= */
(function (global) {
  'use strict';
  const { el } = APD;
  const CLAVE = 'apd.personal.revisiones';

  /* Perfil ficticio de quien revisa (no es una persona real) */
  const REVISORA = { usuario: 'revision.prueba', nombre: 'María Ejemplo Revisora', perfil: 'Revisión documental' };

  /* Plazos de la bandeja: días de espera desde que la solicitud llegó a revisión.
     Pendiente (P02): los fija la Dirección; mientras, estos valores de prueba. */
  const UMBRAL = { ambar: 3, rojo: 10 };

  function revisiones() { try { return JSON.parse(global.sessionStorage.getItem(CLAVE) || '{}'); } catch (e) { return {}; } }
  function guardaRevision(folio, registro) {
    const r = revisiones();
    r[folio] = registro;
    try { global.sessionStorage.setItem(CLAVE, JSON.stringify(r)); return true; } catch (e) { return false; }
  }

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

  /* Cabecera de sesión del personal */
  function pintaSesion(contenedor, actual) {
    if (!contenedor) return;
    const salir = el('a', { class: 'btn-enlace', href: 'index.html', texto: 'Salir' });
    contenedor.replaceChildren(
      el('p', { class: 'sesion-nombre' }, [document.createTextNode(`${REVISORA.nombre} `), APD.estado(`Perfil: ${REVISORA.perfil.toLowerCase()}`)]),
      el('nav', { class: 'sesion-enlaces', 'aria-label': 'Secciones del personal' }, [
        el('a', { class: 'btn-enlace', href: 'revision.html', 'aria-current': actual === 'revision' ? 'page' : null, texto: 'Revisión documental' }),
        salir
      ])
    );
  }

  /* Versión de prueba: los datos ficticios más lo que se envió en este navegador (app/archivos-prueba.js), con la misma
     forma que la base. Una solicitud nueva entra como enviada, con su persona y sus documentos; un reenvío de una
     solicitud ficticia la vuelve a poner en revisión con los documentos corregidos como carga vigente. */
  function datosConPrueba(datos) {
    if (typeof APD_ARCHIVOS_PRUEBA === 'undefined') return Promise.resolve(datos);
    return APD_ARCHIVOS_PRUEBA.solicitudes().then((registros) => Promise.all(registros.map((r) =>
      APD_ARCHIVOS_PRUEBA.documentos(r.folio).then((docs) => ({ r, docs }))))).then((lista) => {
      if (!lista.length) return datos;
      const d = Object.assign({}, datos, { solicitud: datos.solicitud.slice(), solicitante: datos.solicitante.slice(), documento: datos.documento.slice() });
      // La prueba vive en una fecha simulada (fecha_corte): lo enviado hoy de verdad cuenta como enviado ese día, para que
      // la espera no salga negativa (decisión 2026-10-17)
      const tope = `${datos.fecha_corte}T19:00:00-06:00`;
      const alCorte = (iso) => (iso && new Date(iso) > new Date(tope) ? new Date(tope).toISOString() : iso);
      for (const { r: original, docs } of lista) {
        const r = Object.assign({}, original, { estado_desde: alCorte(original.estado_desde), enviada_en: alCorte(original.enviada_en) });
        let s = d.solicitud.find((x) => x.folio === r.folio);
        if (s) {
          s = Object.assign({}, s, { estado: 'enviada', estado_desde: r.estado_desde, de_prueba: true });
          d.solicitud[d.solicitud.findIndex((x) => x.folio === r.folio)] = s;
        } else {
          const persona = d.solicitante.find((x) => x.id && x.id === r.persona.id) || Object.assign({ id: `prueba:${r.folio}` }, r.persona);
          if (!d.solicitante.includes(persona)) d.solicitante.push(persona);
          const perfil = r.tipo_acreditacion === 'dictaminador' ? APD.perfilAcademico(datos, r.nivel_estudios, r.estatus_estudios, r.carrera) : null;
          s = { id: `prueba:${r.folio}`, folio: r.folio, solicitante_id: persona.id, estado: 'enviada', estado_desde: r.estado_desde,
            enviada_en: r.enviada_en, creada_en: r.enviada_en, tipo_acreditacion: r.tipo_acreditacion, modalidad: r.modalidad,
            nivel_estudios: r.nivel_estudios, carrera: r.carrera, carrera_tecnica: r.carrera_tecnica || null, estatus_estudios: r.estatus_estudios, anios_experiencia: r.anios_experiencia,
            perfil_academico: perfil ? perfil.perfil : null, experiencia_minima: perfil ? perfil.minimo : null,
            adscripcion: r.persona.adscripcion, organizacion_id: r.persona.organizacion_id, organizacion_nombre: r.persona.organizacion_nombre,
            acreditacion_anterior_id: null, de_prueba: true };
          d.solicitud.push(s);
        }
        for (const a of docs) {
          d.documento = d.documento.map((x) => (x.solicitud_id === s.id && x.requisito === a.requisito && x.vigente ? Object.assign({}, x, { vigente: false }) : x));
          d.documento.push({ solicitud_id: s.id, requisito: a.requisito, vigente: true, estado: 'pendiente', cargado_en: alCorte(a.cargado_en),
            nombre_original: a.nombre_original, tamano_bytes: a.tamano_bytes, tipo_mime: a.tipo_mime, blob: a.blob });
        }
      }
      return d;
    }).catch(() => datos);
  }

  global.APD_PERSONAL = { datosConPrueba, REVISORA, UMBRAL, revisiones, guardaRevision, dias, espera, vuelta, corregidos, senales, pintaSesion };
}(window));
