/* solicitud.js · Lo que el formulario de solicitud ajusta según la persona (se carga después del núcleo
   y los módulos del estándar):
     · qué acreditación puede pedir hoy (APD.opciones, mismo criterio que la base); si no puede, la opción
       queda deshabilitada con su motivo. Si es nueva o renovación no se pregunta: se informa y se guarda en
       el campo auxiliar «tramite», del que dependen los documentos;
     · la acreditación que se renueva (sólo lectura);
     · al continuar un borrador o corregir observaciones (?folio=…): la acreditación fija, lo que
       hay que corregir arriba de los documentos, y los documentos ya aceptados dejan de ser obligatorios.
   La base vuelve a comprobar todo al enviar. */
(function () {
  'use strict';
  const { el } = APD;
  const form = document.getElementById('formulario');
  const radios = (nombre) => Array.from(form.querySelectorAll(`input[name="${nombre}"]`));
  const avisa = (control) => {
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
  };

  /* Marca una opción y deshabilita las demás (no aplican al caso de la persona). */
  function fija(nombre, valor) {
    for (const r of radios(nombre)) { r.disabled = r.value !== valor; r.checked = r.value === valor; }
    const elegido = radios(nombre).find((r) => r.checked);
    if (elegido) avisa(elegido);
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
  }

  function nueva(datos, persona) {
    const sesion = APD.leeSesion() || {};
    const op = APD.opciones(datos, persona, sesion.solicitudes || []);
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
    const org = s.organizacion_id ? datos.organizacion.find((o) => o.id === s.organizacion_id) : null;
    ponValor('organizacion', org ? org.nombre : '');
    if (s.tipo_acreditacion === 'dictaminador') {
      if (s.perfil_academico) fija('perfil_academico', s.perfil_academico);
      for (const r of radios('perfil_academico')) r.disabled = false;
      ponValor('carrera', s.carrera);
      ponValor('anios_experiencia', s.anios_experiencia);
    }

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
    }
  }

  APD.cargar().then((datos) => {
    const persona = APD.requiereSesion(datos);
    if (!persona) return;
    APD.pintaSesion(document.querySelector('[data-sesion]'), persona);
    const folio = new URLSearchParams(location.search).get('folio');
    if (folio) continua(datos, persona, folio); else nueva(datos, persona);
  }).catch(() => sinOpciones(['No se pudo cargar tu información. Intenta de nuevo más tarde.']));
}());
