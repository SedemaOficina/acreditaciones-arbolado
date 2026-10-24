/* datos.js · «Mi perfil» (decisiones 2026-10-15 y 2026-10-17; se carga después del núcleo y los módulos)

   Primero se ve lo que la persona tiene registrado, escrito: fotografía, nombre, datos de identidad (sólo lectura: los
   corrige la Secretaría), contacto y adscripción. Cada parte que es suya de mantener tiene «Editar», que abre sus
   preguntas en su propio formulario del estándar (form-contacto, form-adscripcion, form-foto: data-formkit="manual").
   Sólo se edita una parte a la vez; «Cancelar» la cierra sin guardar. Al guardar, la vista se actualiza y lo dice.
   La fotografía se cambia sólo mientras la Secretaría no la haya confirmado. En la versión de prueba se muestra la que
   se cargó al crear la cuenta o al cambiarla aquí (guardada sólo en este navegador, app/archivos-prueba.js); de las
   personas ficticias no hay imagen y se ven sus iniciales.
   «?volver=solicitud.html?folio=…» ofrece regresar a la misma solicitud, con su folio, y el enlace de arriba lo dice
   («Volver a tu solicitud»; auditoría 2026-10-18, B6). */
(function () {
  'use strict';
  const { el } = APD;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const avisa = (c) => APD.avisa(c);
  const SECCIONES = ['foto', 'contacto', 'adscripcion'];
  const formDe = (k) => document.getElementById(`form-${k}`);

  // Regreso: sólo a una pantalla de este sitio, con su consulta; el rótulo dice a dónde lleva (B6)
  const volverA = APD.destinoPropio(new URLSearchParams(location.search).get('volver'));
  const aSolicitud = /^solicitud\.html/.test(volverA);
  const textoVolver = aSolicitud ? 'Volver a tu solicitud' : volverA ? 'Volver' : '';
  if (volverA) {
    for (const a of $$('[data-volver]')) {
      a.setAttribute('href', volverA);
      const t = Array.from(a.childNodes).find((n) => n.nodeType === 3 && n.textContent.trim());
      if (t) t.textContent = textoVolver;
    }
  }

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
      if (['unam', 'chapingo'].includes(clave)) marca('institucion_educativa', clave);
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
    // El día en la hora de la Ciudad de México, no en UTC (auditoría 2026-10-18, C 5.2); por confirmar es «en marcha»:
    // se confirma en la cita, no le toca hacer nada antes (D6)
    $('[data-foto-estado]').replaceChildren(confirmada
      ? APD.estado(`Fotografía confirmada el ${APD.fechaCorta(f.confirmada_en)}`, 'ok')
      : APD.estado('Fotografía por confirmar en tu cita de cotejo', 'marcha'));
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
  const SEXO = { H: 'Hombre', M: 'Mujer', X: 'No binario' };
  function pinta(datos, p) {
    APD.pintaSesion($('[data-sesion]'), p);
    $('[data-perfil-nombre]').textContent = APD.nombreCompleto(p);
    const curp = p.curp || '';
    $('[data-identidad]').replaceChildren(APD.datosLista([
      ['CURP', curp],
      ['Fecha de nacimiento', curp ? APD.fechaCorta(nacimientoDe(curp)) : ''],
      // El sexo se ve como un dato más, tomado de la CURP (decisión 2026-10-18; ya no en el recuadro de dato interno).
      // Sin el número de expediente: es de la carpeta física y se ve en «Mis trámites» (decisión 2026-10-18)
      ['Sexo', SEXO[p.sexo || curp[10]] || '']
    ]));
    $('[data-vista="contacto"]').replaceChildren(APD.datosLista([
      ['Correo electrónico', p.correo || 'Sin registrar'],
      ['Teléfono', p.telefono || 'Sin registrar']
    ]));
    // Rótulo y valor, como los demás datos de «Mi perfil» (2026-10-18)
    const ads = APD.adscripcionPares(datos, p);
    $('[data-vista="adscripcion"]').replaceChildren(ads.length ? APD.datosLista(ads)
      : el('p', { class: 'perfil-valor', texto: 'Sin indicar. Presiona «Editar» para decir si trabajas para alguien.' }));
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
    const extra = volverA ? [el('p', {}, [el('a', { href: volverA, texto: textoVolver })])] : [];
    // La caja ya es el aviso (div.aviso-ok con role=status): FormKit.aviso lo pinta ahí, con su icono, y lo muestra
    FormKit.aviso(caja, { tono: 'ok', titulo, texto: [texto].concat(extra) });
    caja.hidden = false;
  }

  APD.cargar().then((datos) => {
    const p = APD.requiereSesion(datos);
    if (!p) return;
    // Lo último guardado: «Editar» propone esto, no lo de la primera carga (auditoría «intentar romperlo», F1 6: el correo
    // y la adscripción regresaban en silencio a los anteriores)
    let actuales = datos;
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
          APD.cargar().then((d) => {
            // Se cierra con los datos ya leídos: «Editar» vuelve a aparecer con lo recién guardado
            actuales = d;
            cierra(k);
            pinta(d, APD.personaDeSesion(d));
            guardado(k, TEXTOS[k]);
            const h = k === 'foto' ? $('#t-perfil') : $(`#t-${k}`);
            h.tabIndex = -1; h.focus();
          });
        },
        alFallar(error) {
          // La sesión cambió en otra pestaña: su mensaje con el enlace para volver a entrar (bloque 2)
          if (APD.muestraRechazo(error, f)) return;
          const aviso = $('[data-estado-envio] .aviso-texto', f);
          if (error && error.mensaje && aviso) aviso.textContent = error.mensaje;
        }
      });
      for (const b of $$(`[data-editar="${k}"]`)) b.addEventListener('click', () => abre(k, actuales));
      $('[data-cancelar]', f).addEventListener('click', () => cierra(k, true));
    }
  }).catch(() => {
    $('[data-perfil-nombre]').textContent = 'No se pudieron cargar tus datos. Intenta de nuevo más tarde.';
  });
}());
