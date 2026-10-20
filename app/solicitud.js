/* solicitud.js · Lo que el formulario de solicitud ajusta según la persona (se carga después del núcleo
   y los módulos del estándar):
     · qué acreditación puede pedir hoy (APD.opciones, mismo criterio que la base); si no puede, la opción
       queda deshabilitada con su motivo. Si es nueva o renovación no se pregunta: se informa y se guarda en
       el campo auxiliar «tramite», del que dependen los documentos;
     · la acreditación que se renueva (sólo lectura);
     · la adscripción con la que se enviará (es de la persona; se cambia en «Mi perfil», que regresa a esta misma
       solicitud, con su folio: auditoría 2026-10-18, B6);
     · al continuar un borrador o corregir observaciones (?folio=…): la acreditación fija y, en cada documento, el
       archivo que ya está cargado, con su nombre y «Ver» (D1). Al corregir se abre en «Documentos», con el documento
       observado primero y su observación junto al campo; lo ya aceptado se ve plegado, como aceptado (D2);
     · en la revisión, el nombre con que se guarda cada documento (TIPO DE DOCUMENTO_NOMBRE COMPLETO; lo pone la
       base al cargarlos, apd.nombre_de_archivo) y, debajo, el archivo que subió; el que ya estaba cargado se dice
       «Ya cargado», no «No indicado» (D1);
     · estudios (poda y dictaminador); en dictaminador, con nivel, carrera y situación, la experiencia que se le pide (APD.perfilAcademico,
       mismo cálculo que la base). Fija el mínimo del campo de experiencia y advierte si podría no cumplir el perfil
       (se envía igual: lo revisa el personal);
     · el avance (auditoría 2026-10-18, B2): cada paso entra al historial del navegador («Atrás» regresa al paso
       anterior) y lo capturado se guarda como borrador en este dispositivo, con los documentos (en la versión de prueba,
       en el almacén de la prueba, app/archivos-prueba.js). Al volver, la franja del estándar ofrece seguir donde iba;
     · después de «Editar» en la revisión, «Continuar» regresa directo a la revisión (B13).
   La base vuelve a comprobar todo al enviar. */
(function () {
  'use strict';
  const { el } = APD;
  const form = document.getElementById('formulario');
  const radios = (nombre) => Array.from(form.querySelectorAll(`input[name="${nombre}"]`));
  const avisa = (control) => APD.avisa(control);
  /* Lo que ya está cargado en la solicitud que se continúa, por campo (data-campo) */
  const previos = new Map();

  /* Marca una opción y deshabilita las demás (no aplican al caso de la persona). */
  function fija(nombre, valor) {
    for (const r of radios(nombre)) { r.disabled = r.value !== valor; r.checked = r.value === valor; }
    const elegido = radios(nombre).find((r) => r.checked);
    if (elegido) avisa(elegido);
  }
  /* La adscripción es de la persona («Mi perfil»); aquí sólo se muestra con cuál se enviará. */
  function pintaAdscripcion(datos, persona) {
    // Rótulo y valor, cada dato en su renglón (2026-10-18)
    const pares = APD.adscripcionPares(datos, persona);
    document.querySelector('[data-adscripcion-texto]').replaceChildren(pares.length ? APD.datosLista(pares)
      : el('p', { texto: 'Sin indicar. Antes de enviar, indica en «Mi perfil» si trabajas para alguna empresa, institución o dependencia.' }));
    document.querySelector('[data-adscripcion-info]').classList.toggle('aviso-advertencia', !pares.length);
    // «Mi perfil» regresa a esta misma solicitud, con su folio o su tipo (B6)
    for (const a of document.querySelectorAll('[data-adscripcion-info] a[href^="datos.html"]')) {
      a.setAttribute('href', `datos.html?volver=${encodeURIComponent(`solicitud.html${location.search}`)}`);
    }
  }

  /* Nombres con que se guardan los archivos (decisión 2026-10-15, ajustada por Liber): el sistema renombra solo y no
     se avisa al cargar; en su revisión, la persona ve el nombre nuevo de cada documento y, debajo, el archivo que subió
     (el personal sólo ve el nombre nuevo, 2026-10-17). El tipo
     de documento viene en data-nombre-archivo de cada campo (apd.requisito.nombre_archivo). */
  const archivoDe = (campo) => { const a = campo && campo.querySelector('[data-archivos] .arch:not([data-estado="error"]) .arch-nombre'); return a ? a.textContent : ''; };
  const nombreGuardado = (d, campo, persona) => d.nombre_archivo || APD.nombreDeArchivo(campo.dataset.nombreArchivo || d.requisito.toUpperCase(), persona, d.nombre_original);
  function revisionConNombres(persona) {
    const nombres = [];
    for (const b of form.querySelectorAll('[data-revision-lista] [data-editar^="doc_"]')) {
      const campo = form.querySelector(`[data-campo="${b.dataset.editar}"]`);
      if (!campo || !campo.dataset.nombreArchivo) continue;
      const original = archivoDe(campo);
      const val = b.parentElement.firstElementChild;
      const previo = previos.get(campo.dataset.campo);
      if (original) {
        const nuevo = APD.nombreDeArchivo(campo.dataset.nombreArchivo, persona, original);
        nombres.push(nuevo);
        val.replaceChildren(el('span', { class: 'rev-archivo-nuevo', texto: nuevo }), el('span', { class: 'rev-archivo-original', texto: `Archivo que subiste: ${original}` }));
      } else if (previo && previo.estado !== 'con_observacion') {
        // Lo que ya estaba cargado se envía con la solicitud: se dice así, no «No indicado» (D1)
        const guardado = nombreGuardado(previo, campo, persona);
        nombres.push(guardado);
        val.replaceChildren(el('span', { class: 'rev-archivo-nuevo', texto: `Ya cargado: ${guardado}` }),
          el('span', { class: 'rev-archivo-original', texto: previo.estado === 'aceptado' ? 'La Secretaría ya lo aceptó; no lo vuelves a cargar.' : 'Se envía el que ya cargaste.' }));
      }
    }
    const primero = form.querySelector('[data-revision-lista] [data-editar^="doc_"]');
    const resumen = nombres.length && primero && primero.closest('.rev-bloque').querySelector('.rev-resumen');
    if (resumen) resumen.textContent = nombres.length === 1 ? nombres[0] : `${nombres.length} documentos`;
  }

  function ponValor(id, valor) {
    const c = document.getElementById(id);
    if (!c) return;
    c.value = valor == null ? '' : String(valor);
    avisa(c);
  }
  function sinOpciones(motivos) {
    form.hidden = true;
    document.querySelector('[data-con-formulario]').hidden = true;
    const sec = document.querySelector('[data-sin-opciones]');
    document.querySelector('[data-sin-opciones-motivos]').replaceChildren(...motivos.map((m) => el('li', { texto: m })));
    sec.hidden = false;
    sec.querySelector('.titulo-paso').focus();
  }

  /* Un documento que ya está cargado y no tiene observaciones no se vuelve a pedir. */
  function yaNoObligatorio(campo) {
    campo.removeAttribute('data-requerido');
    const etq = campo.querySelector('.etiqueta');
    if (etq) for (const x of etq.querySelectorAll('.marca-oblig, .solo-lector')) x.remove();
  }

  /* ----- El archivo que ya está cargado (D1), con la forma de la lista del módulo archivos ----- */
  const urls = new Map();
  function urlDe(d) {
    if (!d.blob) return `datos/documentos/${d.requisito}.pdf`; // versión de prueba: el PDF ficticio del requisito
    if (!urls.has(d)) urls.set(d, URL.createObjectURL(d.blob));
    return urls.get(d);
  }
  function tarjetaArchivo(d, campo, persona) {
    const nombre = nombreGuardado(d, campo, persona);
    return el('ul', { class: 'lista-arch arch-previo' }, [el('li', { class: 'arch', 'data-estado': 'listo' }, [
      APD.icono('adjunto', 'icono arch-icono'),
      el('div', { class: 'arch-cuerpo' }, [
        el('span', { class: 'arch-nombre', texto: nombre }),
        el('span', { class: 'arch-estado', texto: [d.cargado_en ? `Cargado el ${APD.fecha(d.cargado_en)}` : '', d.tamano_bytes ? APD.tamano(d.tamano_bytes) : ''].filter(Boolean).join(' · ') })
      ]),
      el('a', { class: 'btn-enlace', href: urlDe(d), target: '_blank', rel: 'noopener' }, [
        document.createTextNode('Ver'), el('span', { class: 'solo-lector', texto: ` ${nombre} (se abre en otra pestaña)` })])
    ])]);
  }
  /* Cargado y sin revisar (borrador): se ve el archivo; elegir otro lo reemplaza */
  function marcaCargado(campo, d, persona) {
    yaNoObligatorio(campo);
    const caja = el('div', { class: 'doc-previo-archivo' }, [el('p', { class: 'doc-previo-titulo', texto: 'Archivo que ya cargaste' }), tarjetaArchivo(d, campo, persona)]);
    const zona = campo.querySelector('[data-archivos]');
    zona.before(caja);
    const texto = zona.querySelector('.zona-carga-texto');
    if (texto) texto.textContent = 'Elegir otro archivo para reemplazarlo';
    // Con un archivo nuevo, el anterior deja de verse aquí: el que se envía es el nuevo
    new MutationObserver(() => { caja.hidden = Boolean(archivoDe(campo)); }).observe(zona.querySelector('.lista-arch'), { childList: true, subtree: true });
  }
  /* Aceptado: plegado, con su etiqueta; cambiarlo es posible, pero no compite con lo observado (D2) */
  function marcaAceptado(campo, d, persona) {
    yaNoObligatorio(campo);
    campo.classList.add('doc-aceptado');
    const etq = campo.querySelector('.etiqueta');
    if (etq) etq.after(el('span', { class: 'doc-aceptado-estado' }, [APD.estado('Aceptado', 'ok')]));
    const zona = campo.querySelector('[data-archivos]');
    const ayuda = campo.querySelector('.ayuda');
    const plegado = el('details', { class: 'doc-reemplazo' }, [el('summary', { class: 'doc-reemplazo-titulo', texto: 'Cambiar este archivo' })]);
    zona.before(tarjetaArchivo(d, campo, persona), plegado);
    plegado.append(...[ayuda, zona].filter(Boolean));
    // Plegado de verdad: lo de dentro no ocupa lugar ni se recorre hasta abrir «Cambiar este archivo»
    const sincroniza = () => { for (const x of [ayuda, zona]) if (x) x.hidden = !plegado.open; };
    plegado.addEventListener('toggle', sincroniza);
    sincroniza();
  }
  /* Con observación: primero, con lo que hay que corregir junto al campo y el archivo que se observó (D2) */
  function marcaObservado(campo, d, persona) {
    campo.classList.add('doc-observado');
    const nombre = nombreGuardado(d, campo, persona);
    const aviso = el('div', { class: 'aviso aviso-advertencia doc-observacion' }, [
      APD.icono('alerta'),
      el('div', { class: 'aviso-texto' }, [
        el('strong', { class: 'aviso-titulo', texto: 'Corrige este documento' }),
        el('p', { class: 'con-renglones', texto: APD.paraTi(d.observacion) || 'Tiene una observación de la Secretaría.' }),
        el('p', { class: 'doc-observacion-archivo' }, [document.createTextNode('El que cargaste: '),
          el('a', { href: urlDe(d), target: '_blank', rel: 'noopener' }, [document.createTextNode(nombre), el('span', { class: 'solo-lector', texto: ' (se abre en otra pestaña)' })])])
      ])
    ]);
    (campo.querySelector('.ayuda') || campo.querySelector('.etiqueta')).after(aviso);
  }

  /* Primera renovación de quien viene del registro anterior (Kobo), que no guardó archivos (decisión 2026-10-18): los
     documentos «si aplica» de su renovación se vuelven obligatorios, como en una solicitud nueva. La base lo vuelve a
     comprobar al enviar (faltan_documentos_kobo). */
  function docsKobo(datos, tipo, modalidad, anterior) {
    const a = modalidad === 'renovacion' ? datos.acreditacion.find((x) => x.numero === anterior) : null;
    const sinArchivos = a && a.origen === 'kobo'
      && !datos.solicitud.some((s) => s.solicitante_id === a.solicitante_id && datos.documento.some((d) => d.solicitud_id === s.id));
    document.querySelector('[data-kobo-docs]').hidden = !sinArchivos;
    if (!sinArchivos) return;
    const M = FormKit.config.mensajes;
    for (const campo of form.querySelectorAll(`[data-si="tramite=${tipo}_renovacion"] [data-campo^="doc_"]`)) {
      if (campo.hasAttribute('data-requerido')) continue;
      campo.setAttribute('data-requerido', '');
      const etq = campo.querySelector('.etiqueta');
      if (etq) {
        for (const n of etq.childNodes) if (n.nodeType === 3) n.textContent = n.textContent.replace(' (si aplica)', '');
        etq.append(el('span', { class: 'marca-oblig', 'aria-hidden': 'true', texto: '*' }), el('span', { class: 'solo-lector', texto: ` (${M.palabraObligatorio})` }));
      }
      const ayuda = campo.querySelector('.ayuda');
      if (ayuda) for (const n of ayuda.childNodes) if (n.nodeType === 3) n.textContent = n.textContent.replace(' Sólo si cambió o ya no está vigente.', '');
    }
  }

  /* El curso que corresponde (tipo + nueva o renovación) va en el campo auxiliar «tramite»: de él dependen
     los documentos. Se informa a la persona; no se le pregunta. */
  function ponTramite(tipo, modalidad, anterior, datos) {
    ponValor('tramite', tipo && modalidad ? `${tipo}_${modalidad}` : '');
    ponValor('anterior', anterior || '');
    const caja = document.querySelector('[data-modalidad-info]');
    if (!tipo || !modalidad) { caja.hidden = true; return; }
    const c = APD.curso(datos, tipo, modalidad);
    const dias = c ? `${c.dias_duracion} ${c.dias_duracion === 1 ? 'día' : 'días'}` : '';
    document.querySelector('[data-modalidad-texto]').textContent = modalidad === 'renovacion'
      ? `Te corresponde la renovación de tu acreditación ${anterior}. Curso de ${dias}.`
      : `Te corresponde una solicitud nueva: es tu primera vez o tu acreditación anterior venció hace más de un año. Curso de ${dias}.`;
    caja.hidden = false;
    docsKobo(datos, tipo, modalidad, anterior);
  }

  let alCambiarTipo = () => {};
  function nueva(datos, persona) {
    const op = APD.opciones(datos, persona, []);
    const disponibles = ['poda', 'dictaminador'].filter((t) => op[t].disponible);
    if (!disponibles.length) { sinOpciones(['poda', 'dictaminador'].map((t) => `${APD.TIPOS[t]}: ${op[t].motivo}`)); return false; }

    // Sólo se deshabilita lo que de verdad no se puede pedir hoy, con su motivo
    for (const r of radios('tipo')) {
      if (op[r.value].disponible) continue;
      r.disabled = true;
      r.checked = false;
      const desc = form.querySelector(`[data-desc-tipo="${r.value}"]`);
      if (desc) desc.textContent = op[r.value].motivo;
    }
    alCambiarTipo = () => {
      const r = radios('tipo').find((x) => x.checked && !x.disabled);
      if (!r) return ponTramite('', '', '', datos);
      ponTramite(r.value, op[r.value].modalidad, op[r.value].anterior, datos);
    };
    for (const r of radios('tipo')) r.addEventListener('change', alCambiarTipo);

    const pedido = new URLSearchParams(location.search).get('tipo');
    const inicial = disponibles.includes(pedido) ? pedido : disponibles.length === 1 ? disponibles[0] : null;
    if (inicial) { const r = radios('tipo').find((x) => x.value === inicial); r.checked = true; avisa(r); }
    alCambiarTipo();
    return true;
  }

  /* Devuelve la solicitud que se continúa, o null si no se puede */
  function continua(datos, persona, folio) {
    const s = APD.solicitudesDe(datos, persona).find((x) => x.folio === folio);
    if (!s || !['borrador', 'con_observaciones'].includes(s.estado)) {
      sinOpciones([`No encontramos la solicitud ${folio} entre tus trámites, o ya no se puede modificar.`]);
      return null;
    }
    document.querySelector('[data-bajada-tramite]').textContent = `Continúas la solicitud ${s.folio}. La acreditación ya no cambia.`;
    fija('tipo', s.tipo_acreditacion);
    const ant = s.acreditacion_anterior_id ? datos.acreditacion.find((a) => a.id === s.acreditacion_anterior_id) : null;
    ponTramite(s.tipo_acreditacion, s.modalidad, ant ? ant.numero : '', datos);
    // Estudios en los dos tipos (nivel; con licenciatura o posgrado, carrera y situación); experiencia, en dictaminador
    ponValor('nivel_estudios', s.nivel_estudios);
    const st = radios('estatus_estudios').find((x) => x.value === s.estatus_estudios);
    if (st) { st.checked = true; avisa(st); }
    ponValor('carrera', s.carrera);
    ponValor('carrera_tecnica', s.carrera_tecnica);
    if (s.tipo_acreditacion === 'dictaminador') ponValor('anios_experiencia', s.anios_experiencia);

    const docs = datos.documento.filter((d) => d.solicitud_id === s.id && d.vigente);
    const req = Object.fromEntries(datos.requisito.map((r) => [r.clave, r.nombre]));
    const observados = [];
    for (const d of docs) {
      const campo = form.querySelector(`[data-campo="doc_${s.tipo_acreditacion}_${s.modalidad}_${d.requisito}"]`);
      if (!campo) continue;
      previos.set(campo.dataset.campo, d);
      if (d.estado === 'con_observacion') { marcaObservado(campo, d, persona); observados.push(campo); }
      else if (d.estado === 'aceptado') marcaAceptado(campo, d, persona);
      else marcaCargado(campo, d, persona);
    }
    // Lo observado va primero en su paso, en el mismo orden entre sí (D2)
    for (const campo of observados.slice().reverse()) campo.parentElement.prepend(campo);
    const obs = docs.filter((d) => d.estado === 'con_observacion');
    if (obs.length) {
      document.querySelector('[data-observaciones-lista]').replaceChildren(...obs.map((d) => {
        const campo = form.querySelector(`[data-campo="doc_${s.tipo_acreditacion}_${s.modalidad}_${d.requisito}"]`);
        const etq = campo && campo.querySelector('.etiqueta');
        const nombre = req[d.requisito] || d.requisito;
        return el('li', {}, [etq && etq.id ? el('a', { href: `#${etq.id}`, texto: nombre }) : document.createTextNode(nombre)]);
      }));
      document.querySelector('[data-observaciones-nota]').textContent = obs.length === 1
        ? 'Va primero, con lo que debes corregir junto al documento. Lo demás ya está aceptado.'
        : 'Van primero, cada uno con lo que debes corregir. Lo demás ya está aceptado.';
      document.querySelector('[data-observaciones]').hidden = false;
      const bajada = document.querySelector('[data-bajada-tramite]');
      if (bajada) bajada.textContent = `Corriges la solicitud ${s.folio}: ${obs.length === 1 ? 'tienes 1 observación' : `tienes ${obs.length} observaciones`} en «Documentos» (paso 2). La acreditación ya no cambia.`;
    }
    return s;
  }

  /* Experiencia mínima según el perfil: el mínimo lo calcula el núcleo con FORMKIT_CONFIG.limitesSegun.experiencia
     (data-min-segun, config-solicitud.js); aquí sólo se ajustan los textos que lo explican. Sin perfil completo, o por
     clasificar, el mínimo queda en 0 y la Secretaría lo revisa. */
  const TEXTO_PERFIL = {
    licenciatura_afin: 'licenciatura titulada en una carrera de las que piden los lineamientos o afín',
    disciplina_afin: 'licenciatura en una disciplina afín', pasante: 'carta de pasante', tecnica: 'carrera técnica',
    por_clasificar: 'carrera por clasificar: la Secretaría confirma si es afín en la revisión documental', no_cumple: 'podría no cumplir el perfil: lo revisa el personal'
  };
  function experiencia(datos) {
    const valor = (n) => { const r = radios(n).find((x) => x.checked); return r ? r.value : ''; };
    const nivel = document.getElementById('nivel_estudios').value;
    const superior = APD.SUPERIORES.includes(nivel);
    // La indicación de escribir la carrera del posgrado sólo con maestría o doctorado
    document.querySelector('[data-ayuda-posgrado]').hidden = !['maestria', 'doctorado'].includes(nivel);
    const p = APD.perfilAcademico(datos, nivel, superior ? valor('estatus_estudios') : '', superior ? document.getElementById('carrera').value : '');
    document.querySelector('[data-perfil-no-cumple]').hidden = !(p && p.perfil === 'no_cumple');
    const texto = document.querySelector('[data-experiencia-minima]');
    if (!texto.dataset.original) texto.dataset.original = texto.textContent;
    texto.textContent = !p ? texto.dataset.original
      : p.perfil === 'por_clasificar'
        ? 'Se piden al menos cinco años: la Secretaría revisará tu carrera cuando revise tus documentos.'
        : `Con tu perfil se piden al menos ${p.minimo === 2 ? 'dos' : 'cinco'} años.`;
    const interno = document.querySelector('[data-interno-texto]');
    if (interno) interno.dataset.internoTexto = p ? `${p.perfil} (${TEXTO_PERFIL[p.perfil]}) · experiencia mínima: ${p.minimo ? `${p.minimo} años` : '—'}` : '';
  }

  /* ----- Pasos en el historial del navegador (B2): «Atrás» regresa al paso anterior, no saca de la solicitud -----
     Cada entrada lleva su paso (apdPaso) y su lugar en la página (apdN). Al recargar en un paso posterior la página empieza
     en el primero, y la entrada de antes ya era de ese paso: el primer «Atrás» no hacía nada (auditoría 2026-10-20,
     B6-03). Ahora el paso recuperado del borrador ocupa la misma entrada (no agrega otra) y, si la entrada de antes
     muestra el mismo paso que ya se ve, «Atrás» la pasa de largo. */
  const ESTADO_AL_CARGAR = history.state;
  let entrada = ESTADO_AL_CARGAR;
  let restaurando = false;
  let desdeHistorial = false;
  const ponEntrada = (estado, agrega) => { entrada = estado; history[agrega ? 'pushState' : 'replaceState'](estado, ''); };
  function irSinHistorial(i) {
    desdeHistorial = true;
    try { FormKit.pasos.ir(i); } finally { desdeHistorial = false; }
    ponEntrada({ ...(entrada || {}), apdPaso: FormKit.pasos.actual() }, false);
  }
  function historial() {
    const previo = ESTADO_AL_CARGAR;
    const n = previo && Number.isInteger(previo.apdN) ? previo.apdN : 0;
    const repite = Boolean(previo && Number.isInteger(previo.apdPaso) && n > 0 && previo.apdPaso !== FormKit.pasos.actual());
    ponEntrada({ apdPaso: FormKit.pasos.actual(), apdN: n, ...(repite ? { apdRepite: true } : {}) }, false);
    form.addEventListener('formkit:paso', (e) => {
      if (desdeHistorial || (history.state && history.state.apdPaso === e.detail.indice)) return;
      if (restaurando) { ponEntrada({ ...(entrada || {}), apdPaso: e.detail.indice }, false); return; }
      ponEntrada({ apdPaso: e.detail.indice, apdN: (entrada && Number.isInteger(entrada.apdN) ? entrada.apdN : 0) + 1 }, true);
    });
    window.addEventListener('popstate', (e) => {
      // Enviada (acuse a la vista): «Atrás» lleva a «Mis trámites», no a un formulario que ya no se puede enviar
      if (form.hidden) { location.replace('tramites.html'); return; }
      const venia = entrada;
      entrada = e.state;
      // Un salto dentro de la página («Ir al contenido», enlaces #…) también dispara popstate, sin paso: se ignora
      if (!e.state || !Number.isInteger(e.state.apdPaso)) return;
      // La entrada de antes de recargar muestra el mismo paso que ya se ve: «Atrás» sigue a la anterior (B6-03)
      if (venia && venia.apdRepite && e.state.apdN === venia.apdN - 1 && e.state.apdPaso === FormKit.pasos.actual()) { history.back(); return; }
      irSinHistorial(e.state.apdPaso);
    });
  }

  /* ----- «Editar» desde la revisión (B13): «Continuar» regresa a la revisión, sin recorrer los pasos ----- */
  function editarDesdeRevision() {
    let editando = false;
    form.addEventListener('click', (e) => {
      if (e.target.closest('[data-revision] [data-editar]')) { editando = true; return; }
      const sigue = e.target.closest('[data-accion="siguiente"]');
      if (!sigue || !editando) return;
      // Se valida lo de en medio, como al avanzar con la barra: si algo falta, se queda en ese paso con su error
      e.stopPropagation();
      FormKit.pasos.ir(FormKit.pasos.total - 1);
    }, true);
    form.addEventListener('formkit:paso', (e) => {
      const enRevision = e.detail.paso.hasAttribute('data-revision');
      if (enRevision) editando = false;
      for (const b of form.querySelectorAll('[data-paso]:not([data-revision]) [data-accion="siguiente"]')) {
        if (!b.dataset.textoOriginal) b.dataset.textoOriginal = b.textContent;
        b.textContent = editando && !enRevision ? 'Volver a la revisión' : b.dataset.textoOriginal;
      }
    });
  }

  /* ----- Borrador en este dispositivo (B2) -----
     Es el del núcleo (estándar 1.5.0, P148): la clave la pone app/config-solicitud.js en el formulario y los documentos los
     guarda su proveedor de archivos. El núcleo guarda los campos y el paso desde el primer gesto de la persona, así que
     lo que esta página precarga al continuar una solicitud no crea un borrador. Aquí queda lo propio del trámite:
       · la franja se ofrece cuando la solicitud ya está lista para la persona (el núcleo la muestra al iniciar el
         formulario, antes de que lleguen sus datos) y nunca si hoy no puede pedir nada;
       · al recuperarlo, las declaraciones se vuelven a marcar (no se recuperan), un tipo que ya no se puede pedir no queda
         elegido, y cuando llegan los documentos se recalculan el curso, la experiencia y, si iba en ella, la revisión;
       · la recuperación y el descarte se dicen también en pantalla. */
  const franja = document.querySelector('[data-franja-borrador]');
  const notaBorrador = document.querySelector('[data-borrador-recuperado]');
  const DECLARACIONES = ['protesta', 'aviso', 'humano'];
  let solicitudLista = false;
  let franjaEnEspera = false;
  const esperaFranja = () => { if (franja && !franja.hidden && !solicitudLista) { franja.hidden = true; franjaEnEspera = true; } };
  document.addEventListener('DOMContentLoaded', esperaFranja);
  /* Falla del estándar, pendiente por registrar (RS-01; auditoría 2026-10-20, también B4-02): al recuperar o descartar el
     borrador, el núcleo (formkit.core.js, iniciaFranja) oculta la franja con el botón enfocado y el foco cae en <body>.
     Mientras el estándar lo corrige, el foco va al primer campo del paso que queda a la vista (el recuperado, o el primero
     al descartar); lo recuperado se anuncia una vez en la región de anuncios del estándar. */
  function alPrimerCampo() {
    const paso = (FormKit.pasos && FormKit.pasos.elementos && FormKit.pasos.elementos[FormKit.pasos.actual()]) || form;
    const campos = [...paso.querySelectorAll('input:not([type="hidden"]), select, textarea')].filter((c) => !c.disabled && c.checkVisibility());
    const c = campos[0] && campos[0].type === 'radio' ? (campos.find((x) => x.name === campos[0].name && x.checked) || campos[0]) : campos[0];
    if (c) c.focus();
  }
  function borrador(alRecuperar) {
    const { ctx } = FormKit.iniciar(form);
    esperaFranja();
    /* Falla del estándar, pendiente por registrar (auditoría 2026-10-20, B4-03): el núcleo vuelve a escribir «Borrador
       guardado en este dispositivo.» en su indicador (aria-live) con cada cambio, y se anunciaba cada vez (5 veces en el
       paso de documentos). El indicador de la página ya no es región viva: se ve como siempre y se anuncia una sola vez,
       la primera que se guarda. */
    const indicador = document.querySelector('[data-guardado]');
    let guardadoDicho = false;
    if (indicador && ctx.alBorrador) ctx.alBorrador({ escribe() {
      if (guardadoDicho) return;
      // El núcleo avisa antes de pintar el indicador, y lo pinta sólo si de verdad se guardó
      queueMicrotask(() => { if (!guardadoDicho && indicador.hasAttribute('data-visible')) { guardadoDicho = true; FormKit.anuncia(indicador.textContent); } });
    } });
    // La carrera escrita (combo libre) también revisa su formato (auditoría «intentar romperlo», F1 12)
    APD.formatoEnCombos(ctx);
    const anterior = FormKit.ganchos.restauraBorrador;
    FormKit.ganchos.restauraBorrador = (f, b) => {
      // El paso recuperado ocupa la entrada del historial en la que se está (B6-03)
      restaurando = f === form;
      try { if (anterior) anterior(f, b); } finally { restaurando = false; }
      if (f !== form) return;
      for (const n of DECLARACIONES) for (const c of form.querySelectorAll(`input[name="${n}"]`)) c.checked = false;
      // El tipo restaurado vuelve a calcular el curso y sus documentos; uno que ya no se puede pedir no queda elegido
      for (const r of radios('tipo')) if (r.disabled) r.checked = false;
      const r = radios('tipo').find((x) => x.checked);
      if (r) avisa(r);
      FormKit.anuncia(FormKit.config.mensajes.borradorRecuperado, { visible: notaBorrador });
      // Los documentos llegan del proveedor después de restaurar los campos
      setTimeout(() => window.APD_SOLICITUD.borradorArchivos.leyendo().catch(() => {}).then(() => setTimeout(alRecuperar, 50)), 0);
    };
    if (franja) {
      franja.addEventListener('click', (e) => {
        const a = e.target.closest('[data-borrador="recuperar"], [data-borrador="descartar-si"]');
        if (!a) return;
        if (a.dataset.borrador === 'descartar-si') FormKit.anuncia('Se descartó el borrador.', { visible: notaBorrador });
        alPrimerCampo();
      });
    }
    solicitudLista = true;
    if (franjaEnEspera) franja.hidden = false;
  }

  APD.cargar().then((datos) => {
    const persona = APD.requiereSesion(datos);
    if (!persona) return;
    window.APD_SOLICITUD.usaCatalogo(datos);
    for (const ev of ['input', 'change']) {
      form.addEventListener(ev, (e) => {
        if (['nivel_estudios', 'estatus_estudios', 'carrera'].includes(e.target.name)) experiencia(datos);
      });
    }
    APD.pintaSesion(document.querySelector('[data-sesion]'), persona);
    form.addEventListener('formkit:paso', () => revisionConNombres(persona));
    pintaAdscripcion(datos, persona);
    const folio = new URLSearchParams(location.search).get('folio');
    const s = folio ? continua(datos, persona, folio) : null;
    const hayFormulario = folio ? Boolean(s) : nueva(datos, persona);
    experiencia(datos);
    if (!hayFormulario) { esperaFranja(); return; }
    // Corregir y reenviar abre donde está lo que hay que corregir: el paso de documentos (D2)
    if (s && s.estado === 'con_observaciones') irSinHistorial(1);
    historial();
    editarDesdeRevision();
    borrador(() => {
      alCambiarTipo();
      experiencia(datos);
      // Si lo recuperado deja a la persona en la revisión, se vuelve a pintar con lo de ahora
      const actual = FormKit.pasos.elementos[FormKit.pasos.actual()];
      if (actual && actual.hasAttribute('data-revision') && FormKit.revision) { FormKit.revision.pinta(); revisionConNombres(persona); }
      ponEntrada({ ...(entrada || {}), apdPaso: FormKit.pasos.actual() }, false);
      // Si al repintar el paso el campo enfocado desapareció, el foco vuelve al primero del paso (RS-01)
      if (document.activeElement === document.body) alPrimerCampo();
    });
  }).catch((e) => {
    if (window.console) console.error(e);
    sinOpciones(['No se pudo cargar tu información. Intenta de nuevo más tarde.']);
  });
}());
