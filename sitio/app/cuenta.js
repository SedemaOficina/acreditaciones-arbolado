/* cuenta.js · Ayudas del formulario «Crea tu cuenta»:

   Con la sesión abierta (al recargar el acuse o al volver a esta pantalla), arriba se dice con quién se entró y se lleva
   a «Mis trámites»; quien va a crear la cuenta de otra persona puede salir antes (auditoría 2026-10-18, B12).

   Nombre, apellidos y CURP se escriben en mayúsculas al momento (decisión 2026-10-15), conservando la posición del
   cursor. Correo y contraseña no se tocan: el correo se guarda en minúsculas y la contraseña distingue mayúsculas.
   La base vuelve a ponerlos en mayúsculas al guardar (apd.mayusculas).

   Lo escrito se guarda en este dispositivo y se ofrece al volver; salir o recargar con algo escrito se advierte
   (auditoría 2026-10-20, B6-02).

   Por pasos (decisión de Liber del 24/10/2026; módulo «pasos» del Estándar 1.5.1): quién eres, cómo te avisamos, tu
   fotografía, tu contraseña y «Revisa y crea», que pinta aquí el resumen (sin la contraseña) con «Cambiar» en cada dato.
   La fecha de nacimiento y el sexo se toman de la CURP (data-deriva): ya no se escriben.

   Desde el estándar 1.1.0 ya no hace falta: el campo auxiliar sin_segundo_apellido (curp-segundo-apellido acepta el
   segundo apellido vacío, P43) ni volver a comprobar la CURP cuando cambia el nombre o la fecha (P44). */
(function () {
  'use strict';
  const form = document.getElementById('formulario');
  if (!form) return;

  const conSesion = document.querySelector('[data-con-sesion]');
  if (conSesion) {
    APD.cargar().then((datos) => {
      const p = APD.personaDeSesion(datos);
      // Sólo al llegar: el acuse de la cuenta recién creada ya lleva a «Mis trámites»
      if (!p || !document.querySelector('[data-acuse]').hidden) return;
      conSesion.querySelector('[data-con-sesion-nombre]').textContent = APD.nombreCompleto(p);
      conSesion.hidden = false;
    }).catch(() => { /* sin datos: el formulario sigue disponible */ });
    conSesion.querySelector('[data-salir-crear]').addEventListener('click', () => {
      APD.cierraSesion();
      conSesion.hidden = true;
      const h = form.querySelector('[data-paso]:not([hidden]) .titulo-paso');
      h.tabIndex = -1;
      h.focus();
    });
  }

  /* ----- Lo escrito en este dispositivo (auditoría 2026-10-20, B6-02; decisión 6 de Liber: «avisar y recuperar») -----
     Es el borrador del núcleo (data-borrador en cuenta.html) con su franja, como la solicitud. El núcleo deja fuera los
     campos con data-sensible (FRM-43), que aquí son casi todos: Liber decidió recuperar lo escrito salvo la contraseña y
     la fotografía, así que los de identidad y contacto van aparte, con los ganchos del estándar (estadoBorrador y
     restauraBorrador). Excepción a FRM-43 por registrar. La contraseña, su confirmación y la fotografía (y cualquier
     archivo: no hay proveedor de archivos) nunca se guardan. El borrador empieza con el primer gesto de la persona, se
     borra al crear la cuenta (el núcleo) y con «Empezar de nuevo». Las casillas del final se vuelven a marcar. */
  const RECUPERABLES = ['nombre', 'primer_apellido', 'segundo_apellido', 'curp', 'correo', 'correo2', 'telefono', 'empresa_nombre'];
  const control = (n) => form.querySelector(`[data-campo="${n}"] input`);
  const estadoAnterior = FormKit.ganchos.estadoBorrador;
  FormKit.ganchos.estadoBorrador = (f) => {
    const previo = estadoAnterior ? estadoAnterior(f) : {};
    if (f !== form) return previo;
    const escrito = {};
    for (const n of RECUPERABLES) { const c = control(n); if (c && c.value) escrito[n] = c.value; }
    return { ...previo, cuenta: escrito };
  };
  const notaBorrador = document.querySelector('[data-borrador-recuperado]');
  const restauraAnterior = FormKit.ganchos.restauraBorrador;
  FormKit.ganchos.restauraBorrador = (f, b) => {
    if (restauraAnterior) restauraAnterior(f, b);
    if (f !== form) return;
    for (const [n, v] of Object.entries((b && b.cuenta) || {})) { const c = RECUPERABLES.includes(n) && control(n); if (c) c.value = v; }
    // La fecha de nacimiento y el sexo se vuelven a tomar de la CURP (módulo identificadores)
    const curp = control('curp');
    if (curp && curp.value) curp.dispatchEvent(new Event('input', { bubbles: true }));
    for (const n of ['aviso', 'humano']) for (const c of form.querySelectorAll(`input[name="${n}"]`)) c.checked = false;
    // Después del anuncio del núcleo, que así queda sustituido: se dice una vez, con lo que falta poner otra vez
    setTimeout(() => FormKit.anuncia(`${FormKit.config.mensajes.borradorRecuperado} Pon otra vez tu fotografía y tu contraseña.`, { visible: notaBorrador }), 0);
  };
  /* Falla del estándar, registrada como P179 (RS-01, como en la solicitud): al recuperar o descartar, el núcleo oculta
     la franja con el botón enfocado y el foco cae en <body>. Mientras, el foco va al primer campo del paso en que se
     quedó (el borrador recuerda el paso). */
  const franja = document.querySelector('[data-franja-borrador]');
  if (franja) {
    franja.addEventListener('click', (e) => {
      const a = e.target.closest('[data-borrador="recuperar"], [data-borrador="descartar-si"]');
      if (!a) return;
      if (a.dataset.borrador === 'descartar-si') FormKit.anuncia('Se descartó lo que habías escrito.', { visible: notaBorrador });
      setTimeout(() => { const c = form.querySelector('[data-paso]:not([hidden]) input:not([type="hidden"]):not([readonly])'); if (c) c.focus(); }, 0);
    });
  }
  /* Recargar o salir con algo escrito (sin crear la cuenta) lo advierte el navegador, como la solicitud y la asistencia.
     Se mira lo que hay en el formulario (también lo que llenó el «Menú de pruebas»); con la cuenta creada, ya no. */
  const hayCaptura = () => [...form.querySelectorAll('input, select, textarea')].some((c) => {
    if (c.closest('[data-trampa]') || c.readOnly || c.type === 'hidden') return false;
    if (c.type === 'radio' || c.type === 'checkbox') return c.checked;
    if (c.type === 'file') return false;
    return Boolean(c.value);
  }) || Boolean(form.querySelector('[data-campo="foto"] .lista-arch li'));
  window.addEventListener('beforeunload', (e) => { if (!form.hidden && hayCaptura()) { e.preventDefault(); e.returnValue = ''; } });

  const MAYUSCULAS = ['nombre', 'primer_apellido', 'segundo_apellido', 'curp'];
  form.addEventListener('input', (e) => {
    const c = e.target;
    if (!MAYUSCULAS.includes(c.id)) return;
    const alto = c.value.toLocaleUpperCase('es-MX');
    if (alto === c.value) return;
    const [ini, fin] = [c.selectionStart, c.selectionEnd];
    c.value = alto;
    if (ini !== null && document.activeElement === c) c.setSelectionRange(ini, fin);
  });

  /* ----- «Revisa y crea»: el resumen antes de crear la cuenta -----
     Lo que escribió, por paso, con «Cambiar», que lleva al campo (data-editar: lo atiende el módulo «pasos»). La
     contraseña no se muestra: sólo que ya está escrita. No es el módulo «revision» del estándar porque ése mostraría la
     contraseña tal cual. */
  const resumen = form.querySelector('[data-resumen-cuenta]');
  const valor = (id) => { const c = document.getElementById(id); return c ? c.value.trim() : ''; };
  function cambiar(campo, que) {
    return APD.el('button', { type: 'button', class: 'btn-enlace', 'data-editar': campo }, ['Cambiar', APD.el('span', { class: 'solo-lector', texto: `: ${que}` })]);
  }
  function dato(que, texto, campo) {
    return [que, APD.el('span', { class: 'resumen-cuenta-valor' }, [APD.el('span', { texto: texto || 'Sin escribir' }), cambiar(campo, que)])];
  }
  function pintaResumen() {
    if (form.dataset.formkit !== 'listo') { setTimeout(pintaResumen, 0); return; } // al recuperar el borrador durante el arranque
    const ctx = FormKit.iniciar(form).ctx;
    const paso2 = form.querySelector('[data-paso][data-titulo="Cómo te avisamos"]');
    const adscripcion = [...paso2.querySelectorAll('[data-campo]')].map((e) => e.dataset.campo)
      .filter((n) => !['correo', 'correo2', 'telefono'].includes(n) && ctx.activo(n) && ctx.textoDeValor(n)).map((n) => ctx.textoDeValor(n));
    const foto = form.querySelector('[data-campo="foto"] .lista-arch li[data-estado="listo"]');
    resumen.replaceChildren(APD.datosLista([
      dato('Nombre', [valor('nombre'), valor('primer_apellido'), valor('segundo_apellido')].filter(Boolean).join(' '), 'nombre'),
      dato('CURP', valor('curp'), 'curp'),
      dato('Fecha de nacimiento', valor('fecha_nacimiento'), 'curp'),
      dato('Correo electrónico', valor('correo'), 'correo'),
      dato('Teléfono', valor('telefono'), 'telefono'),
      dato('Adscripción', adscripcion.join(' · '), 'adscrito'),
      dato('Fotografía', foto ? 'Lista' : '', 'foto'),
      dato('Contraseña', valor('contrasena') ? 'Ya la escribiste (no se muestra)' : '', 'contrasena')
    ]));
  }
  if (resumen) form.addEventListener('formkit:paso', (e) => { if (e.detail.paso.contains(resumen)) pintaResumen(); });
}());
