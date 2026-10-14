/* solicitud.js · Lo que el formulario de solicitud ajusta según la persona (se carga después del núcleo
   y los módulos del estándar):
     · qué trámite puede hacer hoy —acreditación y modalidad en un solo campo— (APD.opciones, mismo
       criterio que la base); lo que no aplica queda deshabilitado con su motivo, nunca oculto;
     · la acreditación que se renueva (sólo lectura);
     · al continuar un borrador o corregir observaciones (?folio=…): el trámite fijo, lo que
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

  /* Por qué una opción no aplica a la persona (texto junto a la opción deshabilitada). */
  function motivo(o, modalidad) {
    if (!o.disponible) return o.motivo;
    return modalidad === 'nueva'
      ? `Tu acreditación ${o.anterior} está en periodo de renovación: te corresponde renovarla.`
      : 'No tienes una acreditación de este tipo que se pueda renovar.';
  }

  function nueva(datos, persona) {
    const sesion = APD.leeSesion() || {};
    const op = APD.opciones(datos, persona, sesion.solicitudes || []);
    const disponibles = [];
    for (const r of radios('tramite')) {
      const [tipo, modalidad] = r.value.split('_');
      const o = op[tipo];
      const desc = form.querySelector(`[data-desc-tramite="${r.value}"]`);
      if (o.disponible && o.modalidad === modalidad) {
        disponibles.push(r.value);
        if (desc) desc.textContent = o.anterior ? `Renuevas la acreditación ${o.anterior}.` : (tipo === 'dictaminador' ? 'Curso completo. Pide además tu perfil académico y tu experiencia.' : 'Curso completo, para quien la solicita por primera vez.');
      } else {
        r.disabled = true;
        if (desc) desc.textContent = motivo(o, modalidad);
      }
    }
    if (!disponibles.length) return sinOpciones(['poda', 'dictaminador'].map((t) => `${APD.TIPOS[t]}: ${op[t].motivo}`));

    const alCambiar = () => {
      const r = radios('tramite').find((x) => x.checked);
      ponValor('anterior', r ? op[r.value.split('_')[0]].anterior || '' : '');
    };
    for (const r of radios('tramite')) r.addEventListener('change', alCambiar);

    const pedido = new URLSearchParams(location.search).get('tipo');
    const inicial = disponibles.find((v) => v.startsWith(`${pedido}_`)) || (disponibles.length === 1 ? disponibles[0] : null);
    if (inicial) { const r = radios('tramite').find((x) => x.value === inicial); r.checked = true; avisa(r); alCambiar(); }
  }

  function continua(datos, persona, folio) {
    const s = APD.solicitudesDe(datos, persona).find((x) => x.folio === folio);
    if (!s || !['borrador', 'con_observaciones'].includes(s.estado)) {
      return sinOpciones([`No encontramos la solicitud ${folio} entre tus trámites, o ya no se puede modificar.`]);
    }
    document.querySelector('[data-bajada-tramite]').textContent = `Continúas la solicitud ${s.folio}. El trámite ya no cambia.`;
    fija('tramite', `${s.tipo_acreditacion}_${s.modalidad}`);
    const ant = s.acreditacion_anterior_id ? datos.acreditacion.find((a) => a.id === s.acreditacion_anterior_id) : null;
    ponValor('anterior', ant ? ant.numero : '');
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
