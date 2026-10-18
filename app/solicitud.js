/* solicitud.js · Lo que el formulario de solicitud ajusta según la persona (se carga después del núcleo
   y los módulos del estándar):
     · qué acreditación puede pedir hoy (APD.opciones, mismo criterio que la base); si no puede, la opción
       queda deshabilitada con su motivo. Si es nueva o renovación no se pregunta: se informa y se guarda en
       el campo auxiliar «tramite», del que dependen los documentos;
     · la acreditación que se renueva (sólo lectura);
     · la adscripción con la que se enviará (es de la persona; se cambia en «Mi perfil»);
     · al continuar un borrador o corregir observaciones (?folio=…): la acreditación fija, lo que hay que corregir arriba de los documentos, y los documentos ya aceptados dejan de
       ser obligatorios;
     · en la revisión, el nombre con que se guarda cada documento (TIPO DE DOCUMENTO_NOMBRE COMPLETO; lo pone la
       base al cargarlos, apd.nombre_de_archivo) y, debajo, el archivo que subió;
     · estudios (poda y dictaminador); en dictaminador, con nivel, carrera y situación, la experiencia que se le pide (APD.perfilAcademico,
       mismo cálculo que la base). Fija el mínimo del campo de experiencia y advierte si podría no cumplir el perfil
       (se envía igual: lo revisa el personal).
   La base vuelve a comprobar todo al enviar. */
(function () {
  'use strict';
  const { el } = APD;
  const form = document.getElementById('formulario');
  const radios = (nombre) => Array.from(form.querySelectorAll(`input[name="${nombre}"]`));
  const avisa = (control) => APD.avisa(control);

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
  }

  /* Nombres con que se guardan los archivos (decisión 2026-10-15, ajustada por Liber): el sistema renombra solo y no
     se avisa al cargar; en su revisión, la persona ve el nombre nuevo de cada documento y, debajo, el archivo que subió
     (el personal sólo ve el nombre nuevo, 2026-10-17). El tipo
     de documento viene en data-nombre-archivo de cada campo (apd.requisito.nombre_archivo). */
  const archivoDe = (campo) => { const a = campo && campo.querySelector('.arch:not([data-estado="error"]) .arch-nombre'); return a ? a.textContent : ''; };
  function revisionConNombres(persona) {
    const nuevos = [];
    for (const b of form.querySelectorAll('[data-revision-lista] [data-editar^="doc_"]')) {
      const campo = form.querySelector(`[data-campo="${b.dataset.editar}"]`);
      const original = archivoDe(campo);
      if (!campo || !campo.dataset.nombreArchivo || !original) continue;
      const nuevo = APD.nombreDeArchivo(campo.dataset.nombreArchivo, persona, original);
      nuevos.push(nuevo);
      const val = b.parentElement.firstElementChild;
      val.replaceChildren(el('span', { class: 'rev-archivo-nuevo', texto: nuevo }), el('span', { class: 'rev-archivo-original', texto: `Archivo que subiste: ${original}` }));
    }
    const resumen = nuevos.length && form.querySelector('[data-revision-lista] [data-editar^="doc_"]').closest('.rev-bloque').querySelector('.rev-resumen');
    if (resumen) resumen.textContent = nuevos.length === 1 ? nuevos[0] : `${nuevos.length} documentos`;
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
  function yaNoObligatorio(campo, texto) {
    campo.removeAttribute('data-requerido');
    const etq = campo.querySelector('.etiqueta');
    if (etq) for (const x of etq.querySelectorAll('.marca-oblig, .solo-lector')) x.remove();
    const ayuda = campo.querySelector('.ayuda');
    if (ayuda) ayuda.prepend(el('strong', { texto: `${texto} ` }));
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

  function nueva(datos, persona) {
    const op = APD.opciones(datos, persona, []);
    const disponibles = ['poda', 'dictaminador'].filter((t) => op[t].disponible);
    if (!disponibles.length) return sinOpciones(['poda', 'dictaminador'].map((t) => `${APD.TIPOS[t]}: ${op[t].motivo}`));

    // Sólo se deshabilita lo que de verdad no se puede pedir hoy, con su motivo
    for (const r of radios('tipo')) {
      if (op[r.value].disponible) continue;
      r.disabled = true;
      const desc = form.querySelector(`[data-desc-tipo="${r.value}"]`);
      if (desc) desc.textContent = op[r.value].motivo;
    }
    const alCambiar = () => {
      const r = radios('tipo').find((x) => x.checked);
      if (!r) return ponTramite('', '', '', datos);
      ponTramite(r.value, op[r.value].modalidad, op[r.value].anterior, datos);
    };
    for (const r of radios('tipo')) r.addEventListener('change', alCambiar);

    const pedido = new URLSearchParams(location.search).get('tipo');
    const inicial = disponibles.includes(pedido) ? pedido : disponibles.length === 1 ? disponibles[0] : null;
    if (inicial) { const r = radios('tipo').find((x) => x.value === inicial); r.checked = true; avisa(r); }
    alCambiar();
  }

  function continua(datos, persona, folio) {
    const s = APD.solicitudesDe(datos, persona).find((x) => x.folio === folio);
    if (!s || !['borrador', 'con_observaciones'].includes(s.estado)) {
      return sinOpciones([`No encontramos la solicitud ${folio} entre tus trámites, o ya no se puede modificar.`]);
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
    const obs = docs.filter((d) => d.estado === 'con_observacion');
    for (const d of docs) {
      const campo = form.querySelector(`[data-campo="doc_${s.tipo_acreditacion}_${s.modalidad}_${d.requisito}"]`);
      if (!campo || d.estado === 'con_observacion') continue;
      yaNoObligatorio(campo, d.estado === 'aceptado' ? 'Ya lo cargaste y fue aceptado; no tienes que volver a subirlo.' : 'Ya lo cargaste; súbelo de nuevo sólo si quieres reemplazarlo.');
    }
    if (obs.length) {
      document.querySelector('[data-observaciones-lista]').replaceChildren(...obs.map((d) => el('li', { texto: `${req[d.requisito] || d.requisito}: ${d.observacion}` })));
      document.querySelector('[data-observaciones]').hidden = false;
      // Desde el paso 1 se sabe qué hay que corregir y dónde (auditoría 2026-10-17)
      const bajada = document.querySelector('[data-bajada-tramite]');
      if (bajada) bajada.textContent = `Corriges la solicitud ${s.folio}: ${obs.length === 1 ? 'tienes 1 observación' : `tienes ${obs.length} observaciones`} en «Documentos» (paso 2). La acreditación ya no cambia.`;
    }
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
    if (folio) continua(datos, persona, folio); else nueva(datos, persona);
    experiencia(datos);
  }).catch(() => sinOpciones(['No se pudo cargar tu información. Intenta de nuevo más tarde.']));
}());
