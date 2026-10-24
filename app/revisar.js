/* revisar.js · «Revisar una solicitud» (personal, etapa 2).

   Reglas de la revisión (decisiones 2026-10-16; la base las vuelve a aplicar, 03-apd-reglas.sql):
     · Dictaminador con la carrera sin clasificar: se clasifica aquí (P62). No afín → se rechaza.
     · Dictaminador cuyo perfil declarado no cumple (hasta preparatoria, licenciatura en curso o trunca):
       si el comprobante lo confirma → se rechaza; si muestra otro grado → se observa el comprobante de
       estudios para que la persona corrija su grado (opción C).
     · Si no se rechaza: cada documento cargado se acepta u observa. Con alguna observación, la solicitud
       regresa a la persona; con todo aceptado, se valida y se asigna la cita de cotejo.
   Una sola acción principal, cuyo texto cambia con el resultado. Rechazar pide confirmación.

   Campos auxiliares que calcula la página (y el servidor por su cuenta): perfil_revision, resultado y
   revisar_<requisito> (si el documento está cargado y no se rechaza por perfil).

   El registro es una SIMULACIÓN: se recuerda en este navegador. En la etapa 3 lo sustituye la API del
   personal: guarda la clasificación de la carrera (apd.carrera.grupo), el estado y la observación de cada
   documento, la cita, y la revisión (apd.revision), que mueve la solicitud. */
(function () {
  'use strict';
  /* Fechas (decisión 16 b, 20/10/2026): la cita en el resultado (aviso) con fecha larga; los datos, el historial y las
     ayudas, dd/mm/aaaa */
  const { el, fechaLarga, fechaCorta, datosLista } = APD;
  const P = APD_PERSONAL;
  const $ = (s, raiz) => (raiz || document).querySelector(s);
  const $$ = (s, raiz) => Array.from((raiz || document).querySelectorAll(s));
  const form = document.getElementById('formulario');
  const folio = new URLSearchParams(location.search).get('folio') || '';
  /* La bandeja, con los filtros con que se dejó (auditoría 2026-10-20, C4-01; los guarda app/revision.js en esta pestaña) */
  const bandeja = (() => { try { const f = sessionStorage.getItem('apd.bandeja.filtros') || ''; return /^(\?[\w=&-]*)?$/.test(f) ? `revision.html${f}` : 'revision.html'; } catch (e) { return 'revision.html'; } })();
  for (const a of $$('a[href="revision.html"]')) a.href = bandeja;

  const NIVELES = {
    ninguna: 'Sin estudios', preescolar: 'Preescolar', primaria: 'Primaria', secundaria: 'Secundaria', preparatoria: 'Preparatoria o bachillerato',
    tecnica: 'Carrera técnica', licenciatura: 'Licenciatura', maestria: 'Maestría', doctorado: 'Doctorado'
  };
  const ESTATUS = { en_curso: 'en curso', trunco: 'trunco', concluido: 'concluido (pasante)', titulado: 'titulado' };
  const ESTATUS_LIC = { en_curso: 'en curso', trunco: 'trunca', concluido: 'concluida (pasante)', titulado: 'titulada' };
  // Concuerda con el grado: «licenciatura trunca», «maestría titulada», «doctorado titulado»
  const estatusDe = (nivel, estatus) => (['licenciatura', 'maestria'].includes(nivel) ? ESTATUS_LIC : ESTATUS)[estatus] || '';
  const RESULTADOS = {
    validada: { boton: 'Validar y asignar la cita', clase: 'btn-primario' },
    con_observaciones: { boton: 'Enviar observaciones a la persona', clase: 'btn-primario' },
    rechazada: { boton: 'Rechazar la solicitud', clase: 'btn-peligro-contorno' },
    '': { boton: 'Registrar la revisión', clase: 'btn-primario' }
  };

  function ponValor(id, valor) {
    const c = document.getElementById(id);
    if (!c || c.value === valor) return;
    c.value = valor;
    APD.avisa(c);
  }
  // La fecha de la cita se escribe como día/mes/año (formato «fecha-dma» del estándar, auditoría 2026-10-18, D9); se
  // guarda como AAAA-MM-DD
  const isoDe = (dma) => (window.FORMKIT_VALIDACIONES && FORMKIT_VALIDACIONES.isoDeDma(dma)) || dma;
  const elegido = (nombre) => { const r = $(`input[name="${nombre}"]:checked`, form); return r ? r.value : ''; };
  function falla(texto) {
    $('[data-cargando]').textContent = texto;
  }

  APD.cargar().then((datos) => {
    P.pintaSesion($('[data-sesion-personal]'), 'revision');
    const s = datos.solicitud.find((x) => x.folio === folio);
    if (!s) return falla('No se encontró esa solicitud. Vuelva a la bandeja y elíjala de nuevo.');
    // Una solicitud se revisa mientras está enviada: si la persona la reenvió después de una revisión, se revisa otra vez
    // La última revisión que se aplicó (no una que se guardó en otra pestaña y la base no aplicó: F2 M1)
    const ya = P.revisiones(datos)[folio];
    if (s.estado !== 'enviada') {
      const actual = APD.nombrePersonal(s.estado);
      return falla(ya ? `Ya registró la revisión de esta solicitud en esta prueba (${ya.texto}). Su situación actual es «${actual}».`
        : `Esta solicitud no está pendiente de revisión documental. Su situación actual es «${actual}».`);
    }
    const p = datos.solicitante.find((x) => x.id === s.solicitante_id);
    const req = Object.fromEntries(datos.requisito.map((r) => [r.clave, r]));
    const docs = datos.documento.filter((d) => d.solicitud_id === s.id && d.vigente);
    // Aceptados en una revisión anterior y sin cambios: no se vuelven a decidir, salvo que quien revisa los reabra
    // (decisión 2026-10-18: en la 2.ª vuelta sólo se revisa lo que la persona corrigió)
    const previos = new Set(docs.filter((d) => d.estado === 'aceptado').map((d) => d.requisito));
    const reabiertos = new Set();
    // Vueltas anteriores: las revisiones (apd.revision) y los cotejos que regresaron con observaciones (apd.cita con
    // resultado con_observaciones: un documento no coincidió), en orden (auditoría 2026-10-18, C 3.2)
    const anteriores = datos.revision.filter((r) => r.solicitud_id === s.id)
      .concat((datos.cita || []).filter((c) => c.solicitud_id === s.id && c.resultado === 'con_observaciones' && c.atendida_en)
        .map((c) => ({ revisada_en: c.atendida_en, resultado: 'con_observaciones', en_cotejo: true, observacion_general: '' })))
      .sort((a, b) => a.revisada_en.localeCompare(b.revisada_en));
    const corregidos = new Set(P.corregidos(datos, s).map((d) => d.requisito));
    const v = P.vuelta(datos, s);
    /* La vuelta que se abrió (auditoría «intentar romperlo», F2 A2 y M1): su situación, desde cuándo y los documentos que se
       ven. Al registrar se compara con lo guardado de ahora: si otra pestaña ya registró una revisión, o la persona la
       reenvió con otro documento, no se guarda (en la etapa 3, la API responde 409 «La solicitud cambió»). */
    const huella = (dd, sol) => [sol.estado, sol.envio_real || sol.estado_desde, ...dd.documento.filter((x) => x.solicitud_id === sol.id && x.vigente)
      .map((x) => `${x.requisito}|${x.cargado_real || x.cargado_en}|${x.estado}`).sort()].join('~');
    const abierta = huella(datos, s);
    const dict = s.tipo_acreditacion === 'dictaminador';

    /* ----- Cabeza: la solicitud y la persona ----- */
    $('[data-titulo]').textContent = `${APD.TIPOS[s.tipo_acreditacion]} · ${APD.MODALIDADES[s.modalidad].toLowerCase()}`;
    $('[data-bajada]').replaceChildren(APD.lineaDatos([
      [document.createTextNode('Folio de la solicitud '), el('strong', { class: 'mono', texto: s.folio })],
      `enviada el ${fechaCorta(s.enviada_en)}`,
      v.n > 1 ? `reenviada con correcciones el ${fechaCorta(s.estado_desde)}` : null,
      v.n > 1 ? `${v.n}.ª revisión` : 'primera revisión'
    ]));
    $('[data-estado]').replaceChildren(APD.estado('En revisión documental', 'marcha'));
    const podaVigente = datos.acreditacion.filter((a) => a.solicitante_id === p.id && a.tipo_acreditacion === 'poda')
      .sort((a, b) => b.emitida_en.localeCompare(a.emitida_en))[0];
    const anterior = s.acreditacion_anterior_id ? datos.acreditacion.find((a) => a.id === s.acreditacion_anterior_id) : null;
    // Fotografía de la persona: en la prueba, la que cargó en este navegador; si no hay, sus iniciales
    const foto = el('div', { class: 'perfil-foto perfil-foto-chica' }, [el('span', { class: 'perfil-iniciales', 'aria-hidden': 'true', texto: `${(p.nombre || '').charAt(0)}${(p.primer_apellido || '').charAt(0)}` })]);
    if (typeof APD_ARCHIVOS_PRUEBA !== 'undefined') APD_ARCHIVOS_PRUEBA.foto(p.curp).then((r) => {
      if (r && r.blob) foto.append(el('img', { class: 'perfil-imagen', src: URL.createObjectURL(r.blob), alt: `Fotografía de ${APD.nombreCompleto(p)}` }));
    });
    $('[data-persona]').replaceChildren(el('div', { class: 'persona-con-foto' }, [foto, el('div', {}, [datosLista([
      ['Persona', APD.nombreCompleto(p)],
      ['CURP', p.curp],
      ['Número de expediente', p.numero_expediente || 'Todavía no tiene: el expediente físico se abre en su primer cotejo'],
      ...APD.adscripcionPares(datos, s, 'Adscripción'),
      ['Acreditación que renueva', anterior ? `${anterior.numero}, vence el ${fechaCorta(anterior.vence_en)}` : ''],
      // Se comprueba que siga vigente antes de decirlo (auditoría de tareas)
      ['Poda y derribo', dict && podaVigente ? `${podaVigente.numero}, ${APD.diasParaVencer(datos, podaVigente.vence_en) < 0 ? 'vencida el' : 'vigente hasta el'} ${fechaCorta(podaVigente.vence_en)}` : ''],
      ['Último grado de estudios', !dict && s.nivel_estudios ? [NIVELES[s.nivel_estudios], s.carrera || s.carrera_tecnica, estatusDe(s.nivel_estudios, s.estatus_estudios)].filter(Boolean).join(' · ') : ''],
      ['Contacto', `${p.correo} · ${p.telefono}`]
    ])])]));
    // En una renovación sólo la constancia fiscal es obligatoria; lo demás se carga si la persona lo actualizó
    // (decisión 2026-10-14): se dice aquí para que no parezca que faltan documentos
    if (s.modalidad === 'renovacion') {
      $('[data-docs-ayuda]').textContent = 'Es una renovación: sólo la constancia de situación fiscal es obligatoria. Los demás documentos se revisaron en su trámite anterior y aparecen aquí sólo si la persona los actualizó. Abra cada documento y acéptelo, o escriba lo que debe corregir la persona.';
    }
    $('[data-cabeza]').hidden = false;

    /* ----- Revisiones anteriores ----- */
    if (anteriores.length) {
      const nombre = (k) => (req[k] ? req[k].nombre : k);
      $('[data-anteriores-cuenta]').replaceChildren(APD.estado(String(anteriores.length)));
      $('[data-anteriores-lista]').replaceChildren(...anteriores.map((r, i) => {
        // Lo observado en esa vuelta: las cargas que fueron sustituidas después, con su observación
        const obs = datos.documento.filter((d) => d.solicitud_id === s.id && d.estado === 'con_observacion' && d.revisado_en && d.revisado_en <= r.revisada_en && (anteriores[i - 1] ? d.revisado_en > anteriores[i - 1].revisada_en : true));
        return el('div', { class: 'revision-anterior' }, [
          // Una vuelta puede venir del cotejo: un documento que no coincidió con el que trajo la persona
          el('p', {}, [el('strong', { texto: r.en_cotejo ? `Cotejo · ${fechaCorta(r.revisada_en, { hora: true })}` : `${i + 1}.ª revisión · ${fechaCorta(r.revisada_en, { hora: true })}` }),
            document.createTextNode(` · ${r.en_cotejo ? 'regresó con observaciones: un documento no coincidió' : r.resultado === 'validada' ? 'validada, con cita de cotejo' : r.resultado === 'rechazada' ? 'rechazada' : 'con observaciones'}`)]),
          obs.length ? el('ul', { class: 'lista-obs' }, obs.map((d) => el('li', { texto: `${nombre(d.requisito)}: ${d.observacion}${corregidos.has(d.requisito) ? ' — la persona cargó uno nuevo' : ''}` }))) : null,
          r.observacion_general && !obs.some((d) => d.observacion === r.observacion_general) ? el('p', { class: 'texto-gris', texto: `Mensaje general: ${r.observacion_general}` }) : null
        ]);
      }));
      $('[data-anteriores]').hidden = false;
      // En una solicitud reenviada con correcciones, abierto: lo observado antes se ve sin desplegarlo (C1-04)
      if (corregidos.size) $('[data-anteriores]').open = true;
    }

    /* ----- Perfil del dictaminador ----- */
    // Mismo cálculo que la base (apd.perfil_academico); la columna exportada ya lo trae
    const perfil = dict ? s.perfil_academico : null;
    ponValor('perfil_revision', perfil === 'por_clasificar' || perfil === 'no_cumple' ? perfil : dict ? 'cumple' : 'no_aplica');
    if (dict) {
      const declarado = [NIVELES[s.nivel_estudios], estatusDe(s.nivel_estudios, s.estatus_estudios)].filter(Boolean).join(' · ');
      $('[data-perfil-datos]').replaceChildren(datosLista([
        ['Último grado declarado', declarado],
        ['Carrera', s.carrera || s.carrera_tecnica || ''],
        ['Experiencia declarada', s.anios_experiencia != null ? `${Number(s.anios_experiencia)} años` : ''],
        ['Experiencia que se pide', `${Number(s.experiencia_minima)} años${perfil === 'por_clasificar' ? ', mientras la carrera no se clasifique' : ''}`]
      ]));
      const dd = $$('[data-perfil-datos] .datos-valor').pop();
      if (dd) dd.setAttribute('data-minimo', '');
      $('[data-carrera-nombre]').textContent = `«${s.carrera || ''}»`;
      $('[data-no-cumple-motivo]').textContent = ['licenciatura'].includes(s.nivel_estudios)
        ? `declaró una licenciatura ${ESTATUS_LIC[s.estatus_estudios].replace(' (pasante)', '')}, y el lineamiento pide al menos carta de pasante.`
        : `declaró ${(NIVELES[s.nivel_estudios] || '').toLowerCase()} como último grado, y el lineamiento pide al menos carrera técnica, carta de pasante o licenciatura.`;
      $('[data-perfil]').hidden = false;
      $('[data-leyenda-docs]').hidden = true;
    }

    /* ----- Documentos ----- */
    // En la prueba, cada requisito tiene un PDF ficticio de varias hojas (herramientas/documentos-ficticios.py); en la
    // etapa 3 la API entrega el archivo de esta solicitud.
    const archivos = {};
    for (const art of $$('[data-doc]', form)) {
      const k = art.dataset.doc;
      const d = docs.find((x) => x.requisito === k);
      if (!d) continue;
      const nombre = d.nombre_archivo || APD.nombreDeArchivo((req[k] && req[k].nombre_archivo) || k.toUpperCase(), p, d.nombre_original);
      // Un archivo cargado en este navegador (versión de prueba) se ve tal cual; si no, el PDF ficticio del requisito
      archivos[k] = d.blob
        ? { url: URL.createObjectURL(d.blob), tipo: d.blob.type, titulo: req[k] ? req[k].nombre : k, archivo: nombre, nota: 'Versión de prueba: es el archivo que se cargó en este navegador.' }
        : { url: `datos/documentos/${k}.pdf`, titulo: req[k] ? req[k].nombre : k, archivo: nombre, nota: 'Versión de prueba: documento ficticio, el mismo para todas las solicitudes con este requisito.' };
      const peso = d.tamano_bytes >= 1048576 ? `${(d.tamano_bytes / 1048576).toFixed(1)}\u00a0MB` : `${Math.round(d.tamano_bytes / 1024)}\u00a0KB`;
      $('[data-doc-archivo]', art).replaceChildren(...[
        el('span', { class: 'mono', texto: nombre }),
        // Sólo el nombre con que se guarda: el del archivo original no le sirve a quien revisa y puede traer datos ajenos
        // al trámite (decisión de Liber, 2026-10-17); queda en la base (apd.documento.nombre_original) para aclaraciones
        document.createTextNode(` · ${peso}`),
        corregidos.has(k) ? el('span', { class: 'doc-corregido' }, [APD.estado('Corregido para esta revisión', 'pend')]) : null
      ].filter(Boolean));
      /* Lo que se le pidió corregir, a la vista junto al documento corregido: estaba sólo en «Revisiones anteriores»,
         plegado (auditoría 2026-10-20, C1-04). Es la última observación de ese requisito. */
      const pedido = corregidos.has(k) && datos.documento.filter((x) => x.solicitud_id === s.id && x.requisito === k && x.estado === 'con_observacion' && x.observacion)
        .sort((a, b) => String(a.revisado_en).localeCompare(String(b.revisado_en))).pop();
      if (pedido) $('[data-doc-archivo]', art).after(el('p', { class: 'texto-gris', 'data-doc-pedido': '' }, [el('strong', { texto: 'Se le pidió: ' }), document.createTextNode(pedido.observacion)]));
    }
    // El mensaje de rechazo propuesto: la persona lo lee tal cual, por eso le habla de tú (auditoría 2026-10-17)
    const propuesta = () => (elegido('clasificacion') === 'no_afin'
      ? `La carrera ${s.carrera} no es afín al manejo del arbolado, como lo pide el lineamiento para la acreditación de dictaminador técnico. Puedes iniciar una solicitud nueva si cuentas con otro grado de estudios.`
      : `Tu comprobante de estudios confirma ${s.nivel_estudios === 'licenciatura' ? `una licenciatura ${(ESTATUS_LIC[s.estatus_estudios] || '').replace(' (pasante)', '')}` : (NIVELES[s.nivel_estudios] || '').toLowerCase()} como último grado. Para la acreditación de dictaminador técnico se requiere al menos carrera técnica, carta de pasante o licenciatura. Puedes iniciar una solicitud nueva si cuentas con otro grado de estudios.`);

    /* ----- Lo que calcula la página: qué se revisa y el resultado ----- */
    let calculando = false;
    let iniciada = false; // el resumen se anuncia sólo después de pintar la página
    function recalcula() {
      if (calculando) return; // los auxiliares que se ajustan aquí disparan «change»: no se recalcula dentro
      calculando = true;
      try { calcula(); } finally { calculando = false; }
    }
    function calcula() {
      const rechazo = (perfil === 'por_clasificar' && elegido('clasificacion') === 'no_afin') || (perfil === 'no_cumple' && elegido('comprobante_confirma') === 'si');
      // Si el comprobante muestra otro grado, se observa el comprobante de estudios (opción C)
      if (perfil === 'no_cumple' && elegido('comprobante_confirma') === 'no') {
        const obs = $('input[name="decision_comprobante_estudios"][value="con_observacion"]', form);
        if (obs && !obs.checked) {
          obs.checked = true;
          obs.dispatchEvent(new Event('change', { bubbles: true }));
          const t = document.getElementById('observacion_comprobante_estudios');
          if (t && !t.value) {
            t.value = 'Tu comprobante de estudios muestra un grado distinto del que declaraste. Corrige tu último grado de estudios y su situación en la solicitud.';
            t.dispatchEvent(new Event('input', { bubbles: true })); // contador de caracteres
          }
        }
      }
      const cargados = docs.map((d) => d.requisito);
      const decide = (k) => !previos.has(k) || reabiertos.has(k);
      for (const k of $$('[data-doc]', form).map((a) => a.dataset.doc)) {
        const revisa = !rechazo && cargados.includes(k);
        ponValor(`revisar_${k}`, revisa ? 'si' : 'no');
        ponValor(`decidir_${k}`, revisa && decide(k) ? 'si' : 'no');
      }
      // Lo aceptado antes cuenta como aceptado
      const decisiones = cargados.map((k) => (decide(k) ? elegido(`decision_${k}`) : 'aceptado'));
      const observados = decisiones.filter((x) => x === 'con_observacion').length;
      const hechos = decisiones.filter(Boolean).length;
      const perfilListo = perfil === 'por_clasificar' ? Boolean(elegido('clasificacion')) : perfil === 'no_cumple' ? Boolean(elegido('comprobante_confirma')) : true;
      const resultado = rechazo ? 'rechazada' : observados ? 'con_observaciones' : hechos === cargados.length && perfilListo ? 'validada' : '';
      ponValor('resultado', resultado);
      if (resultado === 'rechazada') {
        const m = document.getElementById('motivo_rechazo');
        if (!m.value || m.dataset.propuesta === m.value) {
          m.value = propuesta();
          m.dataset.propuesta = m.value;
          m.dispatchEvent(new Event('input', { bubbles: true })); // contador de caracteres
        }
      }
      // Estado de cada documento, a la vista
      for (const art of $$('[data-doc]', form)) {
        const k = art.dataset.doc;
        const antes = !decide(k);
        $('[data-doc-previo]', art).hidden = !antes;
        art.classList.toggle('doc-aceptado-antes', antes);
        const dec = antes ? 'aceptado' : elegido(`decision_${k}`);
        // Etiqueta con icono de su familia: por revisar y con observación (le toca actuar, auditoría 2026-10-18, D7),
        // aceptado (logro)
        const tono = dec === 'aceptado' ? 'ok' : 'pend';
        $('[data-doc-estado]', art).replaceWith(APD.estado(antes ? 'Aceptado antes' : dec === 'aceptado' ? 'Aceptado' : dec === 'con_observacion' ? 'Con observación' : 'Por revisar', tono));
        $('.doc-cabeza .estado', art).setAttribute('data-doc-estado', '');
      }
      $('[data-docs-rechazo]').hidden = !rechazo;
      $('[data-docs-ayuda]').hidden = rechazo;
      // Experiencia que se pide, según la clasificación elegida
      const dd = $('[data-minimo]');
      if (dd && perfil === 'por_clasificar') {
        const c = elegido('clasificacion');
        dd.textContent = c === 'afin' ? '2 años (carrera afín)' : c === 'disciplina_afin' ? '5 años (disciplina afín)' : c === 'no_afin' ? 'No cumple el perfil: se rechaza' : `${Number(s.experiencia_minima)} años, mientras la carrera no se clasifique`;
      }
      // Lo que antes sólo se anunciaba al lector de pantalla también se ve (hallazgo P117): con todo decidido, lo dice.
      // Un anuncio por acción (auditoría 2026-10-20, RI-03 y RI-04): el resumen no es región viva; cuando cambia por algo
      // que hizo quien revisa se anuncia una vez (al aceptar, junto con el siguiente documento, en avanza)
      const resumen = rechazo ? 'La solicitud se rechaza por el perfil.'
        : hechos === cargados.length && cargados.length
          ? `Los ${cargados.length} documentos están revisados${observados ? `: ${observados} con observación` : ''}. Elija abajo cómo termina la revisión.`
          : `${hechos} de ${cargados.length} documentos revisados${observados ? ` · ${observados} con observación` : ''}.`;
      if ($('[data-resumen]').textContent !== resumen) {
        $('[data-resumen]').textContent = resumen;
        if (iniciada) FormKit.anuncia(resumen);
      }
      const r = RESULTADOS[resultado];
      const boton = $('[data-accion="enviar"]', form);
      if (boton.getAttribute('aria-busy') !== 'true') boton.textContent = r.boton;
      boton.classList.toggle('btn-primario', r.clase === 'btn-primario');
      boton.classList.toggle('btn-peligro-contorno', r.clase === 'btn-peligro-contorno');
    }

    /* Ver documento: en el visor, con todas sus hojas; el documento que se ve queda señalado en la lista y su botón dice
       «En el visor». En computadora, pedir otra vez el que ya está abierto lleva el foco a sus hojas: antes no pasaba
       nada visible (auditoría 2026-10-18, B16). */
    function ver(k, boton) {
      if (!archivos[k] || !global_visor()) return;
      callaVisor(!boton);
      const yaAbierto = boton && $(`[data-doc="${k}"]`, form).hasAttribute('data-viendo') && FormKit.visor.enComputadora() && $('[data-visor]').open;
      for (const a of $$('[data-doc]', form)) {
        const viendo = a.dataset.doc === k;
        a.toggleAttribute('data-viendo', viendo);
        const b = $('[data-ver]', a);
        if (b) { b.toggleAttribute('aria-current', viendo); b.firstChild.textContent = viendo ? 'En el visor' : 'Ver documento'; }
      }
      FormKit.visor.abre(archivos[k], boton);
      if (yaAbierto) {
        const hojas = $('[data-visor-hojas]');
        hojas.scrollIntoView({ block: 'nearest' });
        hojas.focus();
      }
    }
    const global_visor = () => Boolean(window.FormKit && FormKit.visor);
    /* Falla del estándar, registrada como P181 (RS-03): el visor anuncia su acercamiento y «Hoja 1 de N» (aria-live)
       cada vez que carga un documento. Cuando lo abre la página sola (el primero al entrar o el siguiente al aceptar), se
       callan: ya se anuncia «Siguiente documento: …» (RI-04, un anuncio por decisión). Vuelven a anunciarse en cuanto quien
       revisa usa el visor o pide un documento con su botón. */
    const vivasVisor = $$('[data-visor-pagina], [data-visor-zoom]');
    function callaVisor(si) { for (const n of vivasVisor) n.setAttribute('aria-live', si ? 'off' : 'polite'); }
    const visorNodo = $('[data-visor]');
    if (visorNodo) for (const ev of ['pointerdown', 'keydown', 'wheel', 'focusin']) visorNodo.addEventListener(ev, () => callaVisor(false));
    const global_matchMedia = (q) => window.matchMedia(q).matches;
    form.addEventListener('click', (e) => {
      const b = e.target.closest('[data-ver]');
      if (b) ver(b.dataset.ver, b);
    });
    /* Al cerrar el visor (en teléfono es un diálogo; en computadora, con «Cerrar»), ningún botón sigue diciendo «En el
       visor» (auditoría 2026-10-20, RI-08). Si se cerró para volver a abrirse (cambio de tamaño), no se toca. */
    const visorDialogo = $('[data-visor]');
    if (visorDialogo) visorDialogo.addEventListener('close', () => {
      if (visorDialogo.open) return;
      for (const a of $$('[data-doc]', form)) {
        a.removeAttribute('data-viendo');
        const b = $('[data-ver]', a);
        if (b) { b.removeAttribute('aria-current'); b.firstChild.textContent = 'Ver documento'; }
      }
    });

    /* Motivos frecuentes: data-chips-fijos en cada observación (módulo chips del estándar, P65); el motivo se agrega
       al texto, que quien revisa completa. */

    // La cita es en la sede única; se elige el día, desde el siguiente al de hoy (fecha simulada del corte)
    for (const n of $$('[data-sede]')) n.textContent = APD.sede(datos).nombre;
    const manana = APD.sumaDias(datos.fecha_corte, 1);
    // Límites del formato «fecha-dma»: el estándar los lee de data-min y data-max del campo (AAAA-MM-DD) y avisa con la
    // fecha en día/mes/año. Hasta meses_adelanto_cita meses (auditoría «intentar romperlo», F2 M4: se aceptaba el
    // 31/12/9999); sábados y domingos no hay citas (sesión de trabajo del 23/10/2026): P.vigilaDiaCita
    const hasta = APD.sumaMeses(APD.hoy(datos), APD.mesesCita(datos));
    $('[data-campo="cita_fecha"]').dataset.min = manana;
    $('[data-campo="cita_fecha"]').dataset.max = hasta;
    $('[data-cita-desde]').textContent = fechaCorta(manana);
    $('[data-cita-hasta]').textContent = fechaCorta(hasta);
    P.pintaCargaCitas(datos, $('[data-carga-cita]'));

    form.hidden = false;
    $('[data-cargando]').hidden = true;
    const instancia = FormKit.iniciar(form, {
      enviar(payload, { signal }) {
        return new Promise((ok, mal) => {
          const t = setTimeout(() => APD.cargar().then((ahora) => {
            const d = Object.assign({}, payload.datos, payload.datos.cita_fecha ? { cita_fecha: isoDe(payload.datos.cita_fecha) } : {});
            // Las citas de cotejo son de lunes a viernes (sesión de trabajo del 23/10/2026; la base: cita_en_fin_de_semana)
            const finDeSemana = d.cita_fecha ? P.motivoDiaCita(d.cita_fecha) : null;
            if (finDeSemana) return mal({ mensaje: finDeSemana, errores: [{ campo: 'cita_fecha', mensaje: finDeSemana }] });
            const resultado = document.getElementById('resultado').value;
            // Lo guardado de ahora, justo antes de guardar: ¿sigue siendo la vuelta que se abrió?
            const s2 = ahora.solicitud.find((x) => x.folio === folio);
            const otraVez = { href: `revisar.html?folio=${encodeURIComponent(folio)}`, texto: 'Abrir la solicitud otra vez' };
            if (!s2 || s2.estado !== 'enviada') {
              return mal(APD.rechazo('No se guardó su revisión', `Ya se registró otra revisión de esta solicitud (en otra pestaña o por otra persona): ahora está «${s2 ? APD.nombrePersonal(s2.estado) : 'sin datos'}».`,
                { href: bandeja, texto: 'Volver a la bandeja' }, 'revision_fuera_de_turno'));
            }
            if (huella(ahora, s2) !== abierta) {
              return mal(APD.rechazo('No se guardó su revisión', 'La solicitud cambió desde que la abrió: la persona la reenvió o cargó otro documento. Ábrala otra vez para revisar lo de ahora.', otraVez, 'conflicto'));
            }
            const textos = {
              validada: `Validada · cita el ${fechaCorta(d.cita_fecha, { hora: d.cita_hora })}`,
              con_observaciones: 'Con observaciones',
              rechazada: 'Rechazada'
            };
            const en = new Date().toISOString();
            // Si el navegador no la guardó (almacenamiento bloqueado o lleno), se dice: decía «Quedó guardado» y la solicitud
            // seguía en la bandeja (auditoría «intentar romperlo», F4 A2)
            if (!P.guardaRevision(folio, { resultado, texto: textos[resultado], datos: d, revisor: P.REVISORA.usuario, en, desde: s.envio_real || s.estado_desde })) {
              return mal(APD.noGuardo('No se guardó su revisión', 'su revisión de prueba', 'usted'));
            }
            // Y después: la revisión se aplicó (como la respuesta de la API); si no, se retira y se dice, nunca un éxito falso
            return APD.cargar().then((despues) => {
              if (despues.revision.some((r) => r.solicitud_id === s.id && r.registrada_en === en)) return ok({ resultado, d });
              P.retiraRevision(folio, en);
              return mal(APD.rechazo('No se guardó su revisión', 'Otra revisión de esta solicitud se registró al mismo tiempo.', otraVez, 'conflicto'));
            });
          }).catch(mal), 400);
          signal.addEventListener('abort', () => { clearTimeout(t); mal(new Error('plazo')); });
        });
      },
      // La solicitud cambió en otra pestaña: su mensaje y su enlace, en lugar del «No se pudo enviar» general
      // Lo capturado ya no se puede guardar (otra pestaña registró primero): salir o «Abrir … otra vez» no lo advierte
      alFallar(e) { if (APD.muestraRechazo(e, form) && !e.errores) sinGuardar = false; },
      alEnviar({ resultado, d }) {
        const nombre = APD.nombreCompleto(p);
        // Resultado de la decisión con el módulo «resultado» del estándar (1.4.0, P113): título con el desenlace en su
        // familia, «Quedó guardado a las HH:MM · quien», motivo citado y «Qué sigue»; debajo, el botón a la siguiente
        const observados = Object.keys(d).filter((k) => k.startsWith('decision_') && d[k] === 'con_observacion').length;
        const desenlace = {
          // Con su «Qué sigue», como el de observaciones (auditoría 2026-10-18, D21)
          validada: { tono: 'ok', titulo: `Validada: cita el ${fechaLarga(d.cita_fecha, { hora: d.cita_hora })}`,
            texto: `${nombre} ya ve en «Mis trámites» su cita de cotejo en el ${APD.sede(datos).nombre} y los datos para pagar.`,
            pasos: [`${nombre} paga los derechos e imprime su comprobante.`, `Acude a su cita el ${fechaLarga(d.cita_fecha, { hora: d.cita_hora })} con sus documentos y su comprobante.`,
              'En la cita, el personal coteja sus documentos y su pago en «Citas de cotejo».'] },
          con_observaciones: { tono: 'atencion', titulo: `Con observaciones: ${observados === 1 ? '1 documento regresa' : `${observados} documentos regresan`} a la persona`,
            texto: `${nombre} ya ve en «Mis trámites» qué debe corregir.`,
            pasos: [`${nombre} corrige y reenvía su solicitud.`, 'La solicitud vuelve a «Solicitudes por revisar», marcada como reenviada.'] },
          rechazada: { tono: 'rechazo', titulo: 'Rechazada por perfil', motivo: d.motivo_rechazo || '',
            texto: `${nombre} ve este motivo en «Mis trámites» y puede iniciar una solicitud nueva.` }
        }[resultado];
        form.hidden = true;
        sinGuardar = false;
        // La cabecera dice la situación nueva, no «En revisión documental» (auditoría 2026-10-18, D8)
        const nueva = { validada: 'validada_en_linea', con_observaciones: 'con_observaciones', rechazada: 'rechazada' }[resultado];
        $('[data-estado]').replaceChildren(APD.estadoSolicitud({ estado: nueva }, true));
        // El visor se cierra (en computadora queda fijo y empujaba el resultado hasta abajo)
        const visor = $('[data-visor]');
        if (visor && visor.open) visor.close();
        const siguiente = P.porRevisar(datos).find((x) => x.folio !== folio);
        const acciones = $('[data-hecho-acciones]');
        if (siguiente && !acciones.querySelector('[data-siguiente]')) {
          acciones.prepend(el('a', { class: 'btn btn-primario', 'data-siguiente': '', href: `revisar.html?folio=${encodeURIComponent(siguiente.folio)}`, texto: 'Revisar la siguiente' }));
          acciones.before(el('p', { class: 'texto-gris', texto: `Siguiente en la bandeja: ${siguiente.folio}, en espera desde el ${fechaCorta(siguiente.estado_desde)}.` }));
        }
        FormKit.resultado($('[data-hecho]'), Object.assign({ quien: P.REVISORA.nombre }, desenlace));
      }
    });
    // Un sábado o un domingo se dice junto a la fecha de la cita (sesión de trabajo del 23/10/2026)
    P.vigilaDiaCita(form);

    /* Rechazar no tiene vuelta atrás: se confirma antes de enviar (módulo modal del estándar) */
    FormKit.ganchos.submit = (f, enviar) => {
      if (f !== form || document.getElementById('resultado').value !== 'rechazada') return false;
      if (instancia.valida().length) return false; // con errores, el núcleo muestra el resumen
      const boton = $('[data-accion="enviar"]', form);
      FormKit.confirma(boton, {
        titulo: `¿Rechazar la solicitud ${s.folio}?`,
        consecuencias: [`${APD.nombreCompleto(p)} verá el motivo en «Mis trámites».`, 'La solicitud se cierra sin acreditación; la persona puede iniciar una nueva.'],
        irreversible: true, si: 'Sí, rechazar la solicitud', peligro: true
      }).then((si) => { if (si) enviar(); });
      return true;
    };

    // En computadora el visor abre de entrada el primer documento
    // (si hay que decidir el perfil, el comprobante de estudios, que es con lo que se decide)
    const orden = $$('[data-doc]', form).map((x) => x.dataset.doc).filter((k) => archivos[k]);
    // (en la 2.ª vuelta, el primero por decidir: lo aceptado antes no se vuelve a revisar)
    const primero = ['por_clasificar', 'no_cumple'].includes(perfil) && archivos.comprobante_estudios ? 'comprobante_estudios' : orden.find((k) => !previos.has(k)) || orden[0];
    if (primero && global_visor() && FormKit.visor.enComputadora()) ver(primero, null);
    form.addEventListener('change', recalcula);
    form.addEventListener('input', (e) => { if (e.target.type === 'radio') recalcula(); });

    /* Recargar o salir a mitad de la revisión pierde lo decidido: el navegador lo advierte mientras haya algo sin registrar
       (auditoría 2026-10-18, B9). Sólo cuenta lo que hace quien revisa, no lo que llena la página. */
    let sinGuardar = false;
    const marcaCambio = (e) => { if (e.isTrusted && !form.hidden) sinGuardar = true; };
    form.addEventListener('input', marcaCambio);
    form.addEventListener('change', marcaCambio);
    window.addEventListener('beforeunload', (e) => { if (sinGuardar) { e.preventDefault(); e.returnValue = ''; } });

    /* Al aceptar un documento, se pasa al siguiente sin decidir (decisión 2026-10-16): en computadora el visor lo muestra
       y la lista lo trae a la vista; con todo decidido, se va al resultado. Sólo con una decisión de quien revisa (no con
       las que marca la página). Al observar no se avanza solo, porque hay que escribir qué corregir: «Listo, ir al
       siguiente» lleva al siguiente cuando la observación ya está escrita (decisión 2026-10-17). */
    const suave = global_matchMedia('(prefers-reduced-motion: reduce)') ? 'auto' : 'smooth';
    form.addEventListener('change', (e) => {
      const r = e.target;
      if (!e.isTrusted || !r.name || !r.name.startsWith('decision_') || r.value !== 'aceptado') return;
      avanza(r.name.replace('decision_', ''));
    });
    // Reabrir un documento aceptado antes: vuelve a pedir su decisión
    form.addEventListener('click', (e) => {
      const b = e.target.closest('[data-reabrir]');
      if (!b) return;
      reabiertos.add(b.dataset.reabrir);
      recalcula();
      const primero = $(`input[name="decision_${b.dataset.reabrir}"]`, form);
      if (primero) primero.focus();
    });
    form.addEventListener('click', (e) => {
      const b = e.target.closest('[data-seguir]');
      if (!b) return;
      const k = b.dataset.seguir;
      const texto = document.getElementById(`observacion_${k}`);
      if (texto.value.trim().length < 10) {
        // El error se ve junto al campo, no sólo se anuncia (hallazgo P117)
        FormKit.marcaError(`observacion_${k}`, 'Antes de seguir, escriba qué debe corregir la persona (al menos 10 caracteres).');
        texto.focus();
        return;
      }
      avanza(k);
    });
    function avanza(actual) {
      const orden = $$('[data-doc]', form).map((x) => x.dataset.doc).filter((k) => archivos[k] && document.getElementById(`decidir_${k}`).value === 'si');
      const pendiente = (k) => !elegido(`decision_${k}`);
      const i = orden.indexOf(actual);
      const siguiente = orden.slice(i + 1).find(pendiente) || orden.slice(0, i).find(pendiente);
      // El foco va con lo que se muestra: el título del siguiente documento o el del resultado (auditoría 2026-10-20,
      // RI-06: la página se desplazaba y el foco se quedaba en la opción ya contestada, fuera de la ventana). Con todo
      // decidido, «Los N documentos están revisados» ya lo anunció el resumen (RI-03).
      const lleva = (titulo, bloque) => { titulo.tabIndex = -1; titulo.focus({ preventScroll: true }); bloque.scrollIntoView({ behavior: suave, block: 'start' }); };
      if (!siguiente) { lleva($('#t-resultado'), $('#t-resultado')); return; }
      const art = $(`[data-doc="${siguiente}"]`, form);
      if (global_visor() && FormKit.visor.enComputadora()) ver(siguiente, null);
      lleva($('.doc-titulo', art), art);
      FormKit.anuncia(`${$('[data-resumen]').textContent} Siguiente documento: ${archivos[siguiente].titulo}.`);
    }
    recalcula();
    iniciada = true;
  }).catch(() => falla('No se pudo cargar la solicitud. Intente de nuevo más tarde.'));
}());
