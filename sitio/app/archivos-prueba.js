/* =========================================================
   archivos-prueba.js · Lo que se registra en la versión de prueba, guardado en este navegador
   (decisiones 2026-10-16 y 2026-10-17)

   Para recorrer el trámite completo sin servidor, todo lo que se hace en la prueba queda guardado en ESTE navegador
   y sobrevive a recargar, abrir otra pestaña o cerrar el navegador:
     · cuentas creadas (IndexedDB «cuentas», por CURP), con la contraseña sólo como resumen SHA-256;
     · fotografías de perfil (IndexedDB «fotos», por CURP);
     · solicitudes enviadas o reenviadas y sus documentos (IndexedDB «solicitudes» y «documentos»);
     · cambios hechos en «Mi perfil» (localStorage «apd.perfiles»);
     · revisiones del personal (localStorage «apd.personal.revisiones») y citas de cotejo atendidas
       («apd.personal.cotejos»): la persona ve el resultado.
   APD.cargar() los suma a los datos ficticios con mezcla(), así que todas las pantallas —«Mis trámites», «Mi
   perfil», la bandeja y la revisión del personal— ven lo mismo. Nada sale de la computadora; «Borrar lo guardado» y
   «Empezar de cero» (menú de pruebas) lo quitan. Otro navegador u otro equipo no lo ven.

   En la etapa 3 este archivo se quita: todo lo guarda y lo entrega la API.
   ========================================================= */
(function (global) {
  'use strict';
  const BASE = 'apd-prueba';
  const DOCS = 'documentos';
  const SOLS = 'solicitudes';
  const FOTOS = 'fotos';
  const CUENTAS = 'cuentas';
  const PERFILES = 'apd.perfiles';
  let abierta = null;

  function abre() {
    if (abierta) return abierta;
    abierta = new Promise((ok, mal) => {
      let r;
      try { r = global.indexedDB.open(BASE, 3); } catch (e) { mal(e); return; }
      r.onupgradeneeded = () => {
        const db = r.result;
        if (!db.objectStoreNames.contains(DOCS)) db.createObjectStore(DOCS, { keyPath: 'clave' }).createIndex('folio', 'folio');
        if (!db.objectStoreNames.contains(SOLS)) db.createObjectStore(SOLS, { keyPath: 'folio' });
        if (!db.objectStoreNames.contains(FOTOS)) db.createObjectStore(FOTOS, { keyPath: 'curp' });
        if (!db.objectStoreNames.contains(CUENTAS)) db.createObjectStore(CUENTAS, { keyPath: 'curp' });
      };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => mal(r.error);
    });
    return abierta;
  }
  function tx(almacen, modo, accion) {
    return abre().then((db) => new Promise((ok, mal) => {
      const t = db.transaction(almacen, modo);
      const res = accion(t.objectStore(almacen));
      t.oncomplete = () => ok(res && 'result' in res ? res.result : undefined);
      t.onerror = () => mal(t.error);
      t.onabort = () => mal(t.error);
    }));
  }

  /* ----- Solicitudes y documentos ----- */
  /* Guarda la solicitud (resumen para la bandeja) y sus archivos: [{ requisito, blob, nombre, tipo, size }] */
  function guardaEnvio(solicitud, archivos) {
    const ahora = new Date().toISOString();
    return tx(SOLS, 'readwrite', (s) => s.put(Object.assign({}, solicitud, { guardada_en: ahora })))
      .then(() => tx(DOCS, 'readwrite', (s) => {
        for (const a of archivos) {
          s.put({ clave: `${solicitud.folio}|${a.requisito}`, folio: solicitud.folio, requisito: a.requisito, blob: a.blob,
            nombre_original: a.nombre, tipo_mime: a.tipo, tamano_bytes: a.size, cargado_en: ahora });
        }
      }));
  }
  /* Un documento suelto, con historial (no sustituye la carga anterior en el almacén): la corrección de un documento
     que no coincidió en el cotejo, o la factura que carga el personal. extra: { estado, cargado_por, motivo } */
  function guardaDocumento(folio, requisito, a, extra) {
    const { en, ...resto } = extra || {};
    const ahora = en || new Date().toISOString();
    return tx(DOCS, 'readwrite', (s) => s.put(Object.assign({ clave: `${folio}|${requisito}|${ahora}`, folio, requisito, blob: a.blob,
      nombre_original: a.nombre, tipo_mime: a.tipo, tamano_bytes: a.size, cargado_en: ahora }, resto)));
  }
  function solicitudes() { return tx(SOLS, 'readonly', (s) => s.getAll()).catch(() => []); }
  function documentos(folio) { return tx(DOCS, 'readonly', (s) => s.index('folio').getAll(folio)).catch(() => []); }

  /* ----- Fotografía de la persona: { blob, nombre, tipo } por CURP ----- */
  function guardaFoto(curp, a) {
    return tx(FOTOS, 'readwrite', (s) => s.put({ curp, blob: a.blob, nombre_original: a.nombre, tipo_mime: a.tipo, cargada_en: new Date().toISOString() }));
  }
  function foto(curp) { return curp ? tx(FOTOS, 'readonly', (s) => s.get(curp)).catch(() => null) : Promise.resolve(null); }
  function fotos() { return tx(FOTOS, 'readonly', (s) => s.count()).catch(() => 0); }

  /* ----- Cuentas creadas en la prueba ----- */
  /* La contraseña nunca se guarda: sólo su resumen SHA-256, para poder entrar otra vez con ella en este navegador. */
  function resumen(texto) {
    const datos = new TextEncoder().encode(String(texto));
    return global.crypto.subtle.digest('SHA-256', datos)
      .then((b) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, '0')).join(''));
  }
  /* cuenta: { curp, id, persona: {…datos de la persona…}, contrasena } → se guarda con el resumen */
  function guardaCuenta({ curp, id, persona, contrasena }) {
    return resumen(contrasena).then((r) => tx(CUENTAS, 'readwrite', (s) => s.put({ curp, id, persona, resumen: r, creada_en: new Date().toISOString() })));
  }
  function cuentas() { return tx(CUENTAS, 'readonly', (s) => s.getAll()).catch(() => []); }
  function cuenta(curp) { return curp ? tx(CUENTAS, 'readonly', (s) => s.get(curp)).catch(() => null) : Promise.resolve(null); }
  function contrasenaValida(c, contrasena) { return c ? resumen(contrasena).then((r) => r === c.resumen) : Promise.resolve(false); }

  /* ----- Cambios de «Mi perfil» (contacto, adscripción, fotografía nueva), por persona ----- */
  const leePerfiles = () => { try { return JSON.parse(global.localStorage.getItem(PERFILES) || '{}'); } catch (e) { return {}; } };
  /* Revisiones del personal en la prueba: las guarda app/personal.js (guardaRevision) en «apd.personal.revisiones» */
  const leeRevisiones = () => { try { return JSON.parse(global.localStorage.getItem('apd.personal.revisiones') || '{}'); } catch (e) { return {}; } };
  function guardaPerfil(id, cambios) {
    const t = leePerfiles();
    t[id] = Object.assign({}, t[id], cambios);
    try { global.localStorage.setItem(PERFILES, JSON.stringify(t)); return true; } catch (e) { return false; }
  }

  function borraTodo() {
    for (const k of [PERFILES, 'apd.personal.revisiones', 'apd.personal.cotejos']) {
      try { global.localStorage.removeItem(k); } catch (e) { /* sin almacenamiento */ }
    }
    return Promise.all([SOLS, DOCS, FOTOS, CUENTAS].map((a) => tx(a, 'readwrite', (s) => s.clear())));
  }
  function cuenta_() { return Promise.all([solicitudes(), fotos(), cuentas()]).then(([s, f, c]) => ({ envios: s.length, fotos: f, cuentas: c.length })); }

  /* ----- Mezcla: lo guardado en la prueba, encima de los datos ficticios (lo llama APD.cargar) ----- */
  /* Todo lo que pasó con una solicitud en la prueba se aplica en el orden en que pasó, como lo dejaría la base
     (decisión 2026-10-17): cargas de documentos, envíos y reenvíos, revisiones y citas de cotejo. Así una solicitud
     puede dar todas las vueltas: observada, reenviada, validada, en pausa en el cotejo, corregida el mismo día,
     regresada con observaciones desde el cotejo, sin presentarse, con el cotejo terminado… */
  const leeCotejos = () => { try { return JSON.parse(global.localStorage.getItem('apd.personal.cotejos') || '{}'); } catch (e) { return {}; } };
  const comoLista = (t) => Object.fromEntries(Object.entries(t).map(([f, v]) => [f, Array.isArray(v) ? v : [v]]));
  const ORDEN_TIPO = { doc: 0, envio: 1, revision: 2, cotejo: 3 };
  // Resultado de la pantalla de cotejo → resultado de la cita en la base (apd.cita.resultado)
  const EN_LA_BASE = { terminado: 'atendida', pausa: 'en_pausa', con_observaciones: 'con_observaciones', otra_cita: 'sin_pago',
    no_se_presento: 'no_se_presento', cerrar: 'no_se_presento', no_es_la_persona: 'no_es_la_persona' };

  function mezcla(datos) {
    return Promise.all([cuentas(), solicitudes()]).then(([listaCuentas, registros]) => {
      const revisiones = comoLista(leeRevisiones());
      const cotejos = comoLista(leeCotejos());
      const folios = [...new Set([...registros.map((r) => r.folio), ...Object.keys(revisiones), ...Object.keys(cotejos)])];
      return Promise.all(folios.map((f) => documentos(f).then((docs) => [f, docs])))
        .then((pares) => ({ listaCuentas, registros, revisiones, cotejos, docsDe: Object.fromEntries(pares) }));
    }).then(({ listaCuentas, registros, revisiones, cotejos, docsDe }) => {
      const perfiles = leePerfiles();
      if (!listaCuentas.length && !registros.length && !Object.keys(perfiles).length && !Object.keys(revisiones).length && !Object.keys(cotejos).length) return datos;
      const d = Object.assign({}, datos, { solicitud: datos.solicitud.slice(), solicitante: datos.solicitante.slice(), documento: datos.documento.slice(),
        revision: datos.revision.slice(), fotografia: datos.fotografia.slice(), cita: (datos.cita || []).slice() });
      // Cuentas: una del registro anterior queda activa; una nueva se agrega como persona de la prueba
      for (const c of listaCuentas) {
        const i = d.solicitante.findIndex((x) => x.curp === c.curp);
        if (i >= 0) d.solicitante[i] = Object.assign({}, d.solicitante[i], c.persona, { id: d.solicitante[i].id, estado: 'activa' });
        else d.solicitante.push(Object.assign({ numero_expediente: null }, c.persona, { id: c.id, curp: c.curp, estado: 'activa', creada_en: c.creada_en, de_prueba: true }));
      }
      // Cambios de «Mi perfil»
      d.solicitante = d.solicitante.map((p) => (perfiles[p.id] ? Object.assign({}, p, perfiles[p.id]) : p));
      // La prueba vive en una fecha simulada (fecha_corte): lo hecho hoy de verdad cuenta como hecho ese día, para que la
      // espera no salga negativa (decisión 2026-10-17). Se comprime el tiempo real (un día, unos 15 minutos) para que se
      // conserve el orden entre envío, revisión, cotejo y reenvío.
      const tope = new Date(`${datos.fecha_corte}T19:00:00-06:00`).getTime();
      const alCorte = (iso) => (iso && new Date(iso).getTime() > tope ? new Date(tope - (Date.now() - new Date(iso).getTime()) / 100).toISOString() : iso);
      const registroDe = Object.fromEntries(registros.map((r) => [r.folio, r]));
      const persona = (id) => d.solicitante.findIndex((x) => x.id === id);
      const cambiaPersona = (id, cambios) => { const i = persona(id); if (i >= 0) d.solicitante[i] = Object.assign({}, d.solicitante[i], cambios); };
      const citaEn = (fecha, hora) => `${fecha}T${hora || '09:00'}:00-06:00`;

      for (const folio of Object.keys(docsDe)) {
        const r = registroDe[folio];
        let i = d.solicitud.findIndex((x) => x.folio === folio);
        if (i < 0 && !r) continue; // una revisión o un cotejo de una solicitud que ya no existe
        if (i < 0) {
          // Solicitud nueva de la prueba: entra enviada (su primer envío); un reenvío posterior es el evento «envio»
          let p = d.solicitante.find((x) => x.id === r.persona.id) || d.solicitante.find((x) => x.curp === r.persona.curp);
          if (!p) { p = Object.assign({ id: `prueba:${r.persona.curp || r.folio}`, estado: 'activa', de_prueba: true }, r.persona); d.solicitante.push(p); }
          const perfil = r.tipo_acreditacion === 'dictaminador' ? global.APD.perfilAcademico(datos, r.nivel_estudios, r.estatus_estudios, r.carrera) : null;
          d.solicitud.push({ id: `prueba:${r.folio}`, folio: r.folio, solicitante_id: p.id, estado: 'enviada', estado_desde: alCorte(r.enviada_en),
            enviada_en: alCorte(r.enviada_en), creada_en: alCorte(r.enviada_en), tipo_acreditacion: r.tipo_acreditacion, modalidad: r.modalidad,
            nivel_estudios: r.nivel_estudios, carrera: r.carrera, carrera_tecnica: r.carrera_tecnica || null, estatus_estudios: r.estatus_estudios,
            anios_experiencia: r.anios_experiencia, perfil_academico: perfil ? perfil.perfil : null, experiencia_minima: perfil ? perfil.minimo : null,
            adscripcion: r.persona.adscripcion, organizacion_id: r.persona.organizacion_id, organizacion_nombre: r.persona.organizacion_nombre,
            acreditacion_anterior_id: r.acreditacion_anterior_id || null, pago_referencia: r.folio.replace(/-/g, ''), de_prueba: true });
          i = d.solicitud.length - 1;
        }
        const id = d.solicitud[i].id;
        let s = d.solicitud[i];
        const pon = (cambios) => { s = Object.assign({}, s, cambios); d.solicitud[i] = s; };
        const docsVigentes = () => d.documento.filter((x) => x.solicitud_id === id && x.vigente);
        const marcaDoc = (k, cambios) => { d.documento = d.documento.map((x) => (x.solicitud_id === id && x.vigente && x.requisito === k ? Object.assign({}, x, cambios) : x)); };

        const eventos = [
          ...(docsDe[folio] || []).map((a) => ({ tipo: 'doc', en: a.cargado_en, a })),
          ...(r ? [{ tipo: 'envio', en: r.guardada_en, r }] : []),
          ...(revisiones[folio] || []).map((rev) => ({ tipo: 'revision', en: rev.en, rev })),
          ...(cotejos[folio] || []).map((c) => ({ tipo: 'cotejo', en: c.en, c }))
        ].filter((e) => e.en).sort((x, y) => String(x.en).localeCompare(String(y.en)) || ORDEN_TIPO[x.tipo] - ORDEN_TIPO[y.tipo]);

        let pausa = null; // datos del cotejo en pausa (identidad, fotografía), para cuando se retome
        for (const e of eventos) {
          if (e.tipo === 'doc') {
            const a = e.a;
            d.documento = d.documento.map((x) => (x.solicitud_id === id && x.requisito === a.requisito && x.vigente ? Object.assign({}, x, { vigente: false }) : x));
            d.documento.push({ solicitud_id: id, requisito: a.requisito, vigente: true, estado: a.estado || 'pendiente', observacion: '',
              cargado_en: alCorte(a.cargado_en), cargado_real: a.cargado_en, cargado_por: a.cargado_por || 'persona', motivo: a.motivo || null,
              nombre_original: a.nombre_original, tamano_bytes: a.tamano_bytes, tipo_mime: a.tipo_mime, blob: a.blob, de_prueba: true });
          } else if (e.tipo === 'envio') {
            // Envío o reenvío: vuelve a revisión documental
            pon({ estado: 'enviada', estado_desde: alCorte(e.r.estado_desde || e.en), de_prueba: true, cotejo_pausa: null });
          } else if (e.tipo === 'revision') {
            // Revisión del personal: la persona ve el resultado en «Mis trámites» como lo dejaría la base
            const rev = e.rev;
            const rd = rev.datos || {};
            const RESULTADO = { validada: 'validada_en_linea', con_observaciones: 'con_observaciones', rechazada: 'rechazada' };
            if (s.estado !== 'enviada' || !RESULTADO[rev.resultado]) continue;
            d.revision.push({ solicitud_id: id, revisor: rev.revisor, resultado: rev.resultado, revisada_en: alCorte(rev.en), observacion_general: rd.mensaje_general || rd.motivo_rechazo || '', de_prueba: true });
            for (const x of docsVigentes()) {
              const dec = rd[`decision_${x.requisito}`];
              if (dec) marcaDoc(x.requisito, { estado: dec, observacion: dec === 'con_observacion' ? rd[`observacion_${x.requisito}`] || '' : '', revisado_en: alCorte(rev.en) });
            }
            pon({ estado: RESULTADO[rev.resultado], estado_desde: alCorte(rev.en),
              cita_en: rev.resultado === 'validada' && rd.cita_fecha ? citaEn(rd.cita_fecha, rd.cita_hora) : s.cita_en,
              inasistencias: rev.resultado === 'validada' ? 0 : s.inasistencias,
              motivo_cierre: rev.resultado === 'rechazada' ? rd.motivo_rechazo || null : s.motivo_cierre });
            // Al validar, la base crea la cita pendiente (apd.solicitud_cita)
            if (rev.resultado === 'validada' && s.cita_en) abreCita(s.cita_en);
          } else if (e.tipo === 'cotejo') {
            aplicaCotejo(e.c);
          }
        }

        /* Citas de cotejo (apd.cita, decisiones 2026-10-17): la abierta (pendiente o en pausa) se cierra con lo que pasó;
           una cita nueva nace pendiente. Mismo vocabulario que la base. */
        function abreCita(en) {
          d.cita.push({ solicitud_id: id, programada_en: en, resultado: 'pendiente', observacion: '', creada_en: s.estado_desde, de_prueba: true });
        }
        function aplicaCotejo(c) {
          if (s.estado !== 'validada_en_linea') return;
          const cd = c.datos || {};
          const en = alCorte(c.en);
          const abierta = d.cita.findIndex((x) => x.solicitud_id === id && ['pendiente', 'en_pausa'].includes(x.resultado));
          const cierre = { resultado: EN_LA_BASE[c.resultado], atendida_por: c.atendio, cierra: c.resultado === 'cerrar', de_prueba: true,
            observacion: cd.nota_identidad || '', pausada_en: c.resultado === 'pausa' ? en : undefined, atendida_en: c.resultado === 'pausa' ? null : en };
          if (cierre.pausada_en === undefined) delete cierre.pausada_en;
          if (abierta >= 0) d.cita[abierta] = Object.assign({}, d.cita[abierta], cierre);
          else d.cita.push(Object.assign({ solicitud_id: id, programada_en: c.cita_en }, cierre));
          const noCoinciden = Object.keys(cd).filter((k) => k.startsWith('coincide_') && cd[k] === 'no').map((k) => k.slice(9));
          const observa = () => { for (const k of noCoinciden) marcaDoc(k, { estado: 'con_observacion', observacion: cd[`diferencia_${k}`] || '', revisado_en: en, en_cotejo: true }); };
          switch (c.resultado) {
            case 'terminado': {
              const p = d.solicitante[persona(s.solicitante_id)] || {};
              cambiaPersona(s.solicitante_id, { numero_expediente: p.numero_expediente || c.expediente || null });
              // La fotografía de su cuenta queda confirmada (en la cita no se toma otra, decisión 2026-10-17)
              const f = d.fotografia.find((x) => x.solicitante_id === s.solicitante_id && x.vigente);
              if (f) d.fotografia = d.fotografia.map((x) => (x === f ? Object.assign({}, x, { estado: 'confirmada', confirmada_en: en, confirmada_por: c.atendio }) : x));
              else d.fotografia.push({ solicitante_id: s.solicitante_id, vigente: true, origen: 'en_linea', estado: 'confirmada', confirmada_en: en, confirmada_por: c.atendio, de_prueba: true });
              cambiaPersona(s.solicitante_id, { foto_nueva: false });
              pon({ estado: 'lista_para_curso', estado_desde: en, lista_para_curso_en: s.lista_para_curso_en || en, cotejo_pausa: null,
                factura_rfc: cd.factura_rfc || null, factura_razon_social: cd.factura_razon_social || null, factura_folio_fiscal: cd.factura_folio_fiscal || null });
              break;
            }
            case 'pausa':
              observa();
              pausa = { identidad: cd.identidad || (pausa && pausa.identidad) };
              pon({ cotejo_pausa: { desde: en, real: c.en, cita_en: c.cita_en, docs: noCoinciden } });
              break;
            case 'con_observaciones':
              observa();
              d.revision.push({ solicitud_id: id, revisor: c.atendio, resultado: 'con_observaciones', revisada_en: en, observacion_general: '', en_cotejo: true, de_prueba: true });
              pon({ estado: 'con_observaciones', estado_desde: en, cotejo_pausa: null });
              break;
            case 'no_se_presento':
              pon({ inasistencias: (s.inasistencias || 0) + 1, cita_anterior: c.cita_en, cita_motivo: 'inasistencia', cita_en: citaEn(cd.cita_fecha, cd.cita_hora) });
              abreCita(s.cita_en);
              break;
            case 'otra_cita':
              pon({ cita_anterior: c.cita_en, cita_motivo: 'sin_pago', cita_en: citaEn(cd.cita_fecha, cd.cita_hora), cotejo_pausa: null });
              abreCita(s.cita_en);
              break;
            case 'cerrar':
              pon({ estado: 'concluida_sin_atender', estado_desde: en, inasistencias: (s.inasistencias || 0) + 1, cierre_por: 'inasistencia',
                motivo_cierre: 'No se presentó a su cita de cotejo por segunda vez.' });
              break;
            case 'no_es_la_persona':
              // No se atiende la cita; se avisa a la Dirección y la cuenta queda bloqueada hasta aclararlo
              cambiaPersona(s.solicitante_id, { estado: 'bloqueada', bloqueo_motivo: 'identidad' });
              pon({ cotejo_bloqueado: true });
              break;
            default:
              break;
          }
        }
      }
      return d;
    }).catch((e) => {
      // Si algo de lo guardado no se puede aplicar, se ven los ficticios solos; queda el aviso en la consola
      if (global.console) global.console.warn('Versión de prueba: no se pudo aplicar lo guardado en este navegador.', e);
      return datos;
    });
  }

  global.APD_ARCHIVOS_PRUEBA = {
    guardaEnvio, guardaDocumento, solicitudes, documentos, guardaFoto, foto, fotos,
    guardaCuenta, cuentas, cuenta, contrasenaValida, guardaPerfil, borraTodo, guardado: cuenta_, mezcla
  };
}(window));
