/* datos.js · «Mi perfil» (decisiones 2026-10-15 y 2026-10-17; se carga después del núcleo y los módulos)

   Primero se ve lo que la persona tiene registrado, escrito: fotografía, nombre, datos de identidad (sólo lectura: los
   corrige la Secretaría), contacto y adscripción. Cada parte que es suya de mantener tiene «Editar», que abre sus
   preguntas en su propio formulario del estándar (form-contacto, form-adscripcion, form-foto: data-formkit="manual").
   Sólo se edita una parte a la vez; «Cancelar» la cierra sin guardar. Al guardar, la vista se actualiza y lo dice.
   La fotografía se cambia sólo mientras la Secretaría no la haya confirmado. En la versión de prueba se muestra la que
   se cargó al crear la cuenta o al cambiarla aquí (guardada sólo en este navegador, app/archivos-prueba.js); de las
   personas ficticias no hay imagen y se ven sus iniciales.
   «?volver=solicitud.html» ofrece regresar a la solicitud después de guardar. */
(function () {
  'use strict';
  const { el } = APD;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const avisa = (c) => APD.avisa(c);
  const SEXO = { H: 'Hombre', M: 'Mujer', X: 'No binario' };
  const SECCIONES = ['foto', 'contacto', 'adscripcion'];
  const formDe = (k) => document.getElementById(`form-${k}`);

  // Regreso: sólo a una pantalla de este sitio
  const volver = new URLSearchParams(location.search).get('volver');
  const volverA = /^[a-z]+\.html$/.test(volver || '') ? volver : '';
  if (volverA) for (const a of $$('[data-volver]')) a.setAttribute('href', volverA);

  function nacimientoDe(curp) {
    const aa = Number(curp.slice(4, 6));
    const siglo = /\d/.test(curp[16]) ? 1900 : 2000;
    return `${siglo + aa}-${curp.slice(6, 8)}-${curp.slice(8, 10)}`;
  }

  /* ----- Llenar cada formulario con lo vigente (lo inverso de APD.adscripcionDe) ----- */
  function llenaContacto(p) {
    const f = formDe('contacto');
    for (const [id, v] of [['correo', p.correo], ['correo2', p.correo], ['telefono', p.telefono]]) {
      const c = $(`#${id}`, f); c.value = v == null ? '' : String(v); avisa(c);
    }
  }
  function llenaAdscripcion(datos, p) {
    const f = formDe('adscripcion');
    const marca = (nombre, valor) => { const r = $(`input[name="${nombre}"][value="${valor}"]`, f); if (r && !r.checked) { r.checked = true; avisa(r); } };
    const pon = (id, valor) => { const c = $(`#${id}`, f); if (c) { c.value = valor == null ? '' : String(valor); avisa(c); } };
    if (!p.adscripcion) return;
    if (p.adscripcion === 'independiente') { marca('adscrito', 'no'); return; }
    marca('adscrito', 'si');
    marca('tipo_adscripcion', p.adscripcion);
    const org = p.organizacion_id ? datos.organizacion.find((o) => o.id === p.organizacion_id) : null;
    const nombre = org ? org.nombre : (p.organizacion_nombre || '');
    const clave = org && org.clave ? org.clave : '';
    if (p.adscripcion === 'privada') pon('empresa_nombre', nombre);
    else if (p.adscripcion === 'alcaldia') pon('alcaldia', clave);
    else if (p.adscripcion === 'educativa') {
      if (clave === 'unam') marca('institucion_educativa', 'unam');
      else { marca('institucion_educativa', 'otro'); pon('institucion_educativa_otra', nombre); }
    } else if (p.adscripcion === 'dependencia_federal') {
      if (clave === 'cfe') marca('dependencia_federal', 'cfe');
      else { marca('dependencia_federal', 'otro'); pon('dependencia_federal_otra', nombre); }
    } else if (['sobse', 'sedema', 'paot'].includes(clave)) marca('dependencia_cdmx', clave);
    else if (clave.startsWith('sedema_')) { marca('dependencia_cdmx', 'sedema'); marca('direccion_sedema', clave.replace('sedema_', '')); }
    else { marca('dependencia_cdmx', 'otro'); pon('dependencia_cdmx_otra', nombre); }
  }

  /* ----- Vista: lo registrado, escrito ----- */
  let urlFoto = '';
  function pintaFoto(datos, p) {
    const f = datos.fotografia.find((x) => x.solicitante_id === p.id && x.vigente);
    const confirmada = f && f.estado === 'confirmada' && !p.foto_nueva;
    $('[data-foto-estado]').replaceChildren(confirmada
      ? APD.estado(`Fotografía confirmada el ${APD.fecha(String(f.confirmada_en).slice(0, 10))}`, 'ok')
      : APD.estado('Fotografía por confirmar en tu cita de cotejo', 'pend'));
    $('[data-foto-cambio]').hidden = Boolean(confirmada);
    const caja = $('[data-perfil-foto]');
    $('[data-perfil-iniciales]').textContent = `${(p.nombre || '').charAt(0)}${(p.primer_apellido || '').charAt(0)}`;
    const imagen = typeof APD_ARCHIVOS_PRUEBA === 'undefined' ? Promise.resolve(null) : APD_ARCHIVOS_PRUEBA.foto(p.curp);
    imagen.then((r) => {
      const previa = $('img', caja);
      if (previa) previa.remove();
      if (urlFoto) URL.revokeObjectURL(urlFoto);
      urlFoto = '';
      caja.dataset.conImagen = r && r.blob ? 'si' : 'no';
      if (!r || !r.blob) return;
      urlFoto = URL.createObjectURL(r.blob);
      caja.append(el('img', { class: 'perfil-imagen', src: urlFoto, alt: `Tu fotografía: ${APD.nombreCompleto(p)}` }));
    });
  }
  function pinta(datos, p) {
    APD.pintaSesion($('[data-sesion]'), p);
    $('[data-perfil-nombre]').textContent = APD.nombreCompleto(p);
    const curp = p.curp || '';
    $('[data-identidad]').replaceChildren(APD.datosLista([
      ['CURP', curp],
      ['Fecha de nacimiento', curp ? APD.fecha(nacimientoDe(curp)) : ''],
      ['Número de expediente', p.numero_expediente || 'Se asigna en tu primera cita de cotejo']
    ]), // El sexo es dato interno (se toma de la CURP): la persona no lo ve; en la versión de prueba sale en amarillo
    el('div', { 'data-interno': 'Lo calcula el sistema con la CURP (posición 11). Se guarda en la base: apd.solicitante.sexo.' },
      [APD.datosLista([['Sexo', SEXO[p.sexo || curp[10]] || '']])]));
    $('[data-vista="contacto"]').replaceChildren(APD.datosLista([
      ['Correo electrónico', p.correo || 'Sin registrar'],
      ['Teléfono', p.telefono || 'Sin registrar']
    ]));
    // Directo y en un renglón: «Eres independiente.» o «Alcaldía: Tlalpan.» (decisión 2026-10-17)
    $('[data-vista="adscripcion"]').replaceChildren(el('p', { class: 'perfil-valor',
      texto: p.adscripcion === 'independiente' ? 'Eres independiente.' : (APD.adscripcionTexto(datos, p) || 'Sin indicar. Presiona «Editar» para decir si trabajas para alguien.') }));
    pintaFoto(datos, p);
  }

  /* ----- Editar: una parte a la vez ----- */
  function abre(k, datos) {
    for (const otra of SECCIONES) if (otra !== k) cierra(otra);
    const p = APD.personaDeSesion(datos);
    if (k === 'contacto') llenaContacto(p);
    if (k === 'adscripcion') llenaAdscripcion(datos, p);
    const f = formDe(k);
    f.hidden = false;
    const vista = $(`[data-vista="${k}"]`);
    if (vista) vista.hidden = true;
    for (const b of $$(`[data-editar="${k}"]`)) b.hidden = true;
    $(`[data-guardado="${k}"]`).hidden = true;
    const primero = $('input:not([type="hidden"]):not([hidden]), select, button.zona-carga', f);
    if (primero) primero.focus();
  }
  function cierra(k, enfoca) {
    const f = formDe(k);
    if (!f || f.hidden) return;
    f.hidden = true;
    const vista = $(`[data-vista="${k}"]`);
    if (vista) vista.hidden = false;
    for (const b of $$(`[data-editar="${k}"]`)) b.hidden = false;
    if (k === 'foto') { const quita = $('.lista-arch .arch-quitar', f); if (quita) quita.click(); }
    const est = $('[data-estado-envio]', f);
    if (est) est.hidden = true;
    if (enfoca) { const b = $(`[data-editar="${k}"]`); if (b) b.focus(); }
  }
  /* «Hecho»: aviso verde con palomita y título, junto a la sección que se guardó (propuesta «Avisos y confirmaciones»,
     2026-10-17; antes salía sin icono) */
  function guardado(k, [titulo, texto]) {
    const caja = $(`[data-guardado="${k}"]`);
    const extra = volverA ? [el('p', {}, [el('a', { href: volverA, texto: volverA === 'solicitud.html' ? 'Volver a tu solicitud' : 'Volver' })])] : [];
    const a = APD.aviso('ok', titulo, texto, extra);
    caja.replaceChildren(...a.childNodes);
    caja.hidden = false;
  }

  APD.cargar().then((datos) => {
    const p = APD.requiereSesion(datos);
    if (!p) return;
    pinta(datos, p);
    const TEXTOS = {
      contacto: ['Se guardó tu contacto', ''],
      adscripcion: ['Se guardó tu adscripción', 'Tus próximas solicitudes se envían con ella.'],
      foto: ['Se guardó tu nueva fotografía', 'Se confirma en tu cita de cotejo.']
    };
    for (const k of SECCIONES) {
      const f = formDe(k);
      FormKit.iniciar(f, {
        enviar: (payload, ctx) => APD_PERFIL.guarda(k, payload, ctx),
        alEnviar() {
          cierra(k);
          APD.cargar().then((d) => {
            pinta(d, APD.personaDeSesion(d));
            guardado(k, TEXTOS[k]);
            const h = k === 'foto' ? $('#t-perfil') : $(`#t-${k}`);
            h.tabIndex = -1; h.focus();
          });
        },
        alFallar(error) {
          const aviso = $('[data-estado-envio] .aviso-texto', f);
          if (error && error.mensaje && aviso) aviso.textContent = error.mensaje;
        }
      });
      for (const b of $$(`[data-editar="${k}"]`)) b.addEventListener('click', () => abre(k, datos));
      $('[data-cancelar]', f).addEventListener('click', () => cierra(k, true));
    }
  }).catch(() => {
    $('[data-perfil-nombre]').textContent = 'No se pudieron cargar tus datos. Intenta de nuevo más tarde.';
  });
}());
