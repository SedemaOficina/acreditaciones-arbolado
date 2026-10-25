/* asistido.js · «Registro asistido» del personal (decisión de Liber del 25/10/2026): la cuenta de una persona que no sabe
   leer ni escribir, con ella presente, por pasos como «Crea tu cuenta» (aviso de privacidad, datos, fotografía y
   confirmar). Al registrarla sigue directo a capturar su solicitud (app/config-asistido.js).

     · Cabecera del personal (perfil de revisión y cotejo, el único que registra: parámetro perfiles_registro_asistido).
     · Nombre, apellidos y CURP en mayúsculas al momento, como «Crea tu cuenta».
     · La mayoría de edad se comprueba con la CURP (cruzada propia «curp-mayoria-edad»), con la edad del parámetro
       edad_minima y, en la prueba, la fecha simulada.
     · La fotografía: cargada o tomada con la cámara de la computadora. El estándar sólo ofrece la cámara del teléfono
       (input con capture); la de la computadora se rodea aquí: la vista previa con getUserMedia y, al tomarla, la imagen
       entra al mismo campo como un archivo elegido, para que el módulo «archivos» le aplique sus reglas (tipo, tamaño,
       recodificación sin EXIF ni ubicación).
     · «Confirmar» pinta el resumen con «Cambiar» en cada dato (data-editar, módulo «pasos»). */
(function () {
  'use strict';
  const form = document.getElementById('formulario');
  if (!form) return;
  const { el } = APD;

  APD.cargar().then((datos) => {
    if (window.APD_PERSONAL) APD_PERSONAL.pintaSesion(document.querySelector('[data-sesion-personal]'), 'asistido');
    // La edad mínima del parámetro y, en la prueba, el día simulado (la base: apd.hoy)
    const edad = APD.parametro(datos, 'edad_minima') || 18;
    form.querySelector('[data-campo="curp"]').dataset.edadMinima = String(edad);
    for (const x of document.querySelectorAll('[data-edad-minima]:not([data-campo])')) x.textContent = String(edad);
    window.APD_CRUZADAS_HOY = APD.hoy(datos);
  }).catch(() => { /* sin datos: el formulario sigue disponible; la API vuelve a comprobar todo */ });

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
  // Salir o recargar con algo capturado (sin registrar) lo advierte el navegador, como «Crea tu cuenta»
  const hayCaptura = () => [...form.querySelectorAll('input, select, textarea')].some((c) => {
    if (c.readOnly || c.type === 'hidden' || c.type === 'file') return false;
    if (c.type === 'radio' || c.type === 'checkbox') return c.checked;
    return Boolean(c.value);
  }) || Boolean(form.querySelector('[data-campo="foto"] .lista-arch li'));
  let registrando = false;
  form.addEventListener('submit', () => { registrando = true; });
  window.addEventListener('beforeunload', (e) => { if (!registrando && !form.hidden && hayCaptura()) { e.preventDefault(); e.returnValue = ''; } });

  /* ----- La cámara de la computadora (falla del estándar: sólo trae la del teléfono) ----- */
  const panel = form.querySelector('[data-camara-panel]');
  const vista = form.querySelector('[data-camara-vista]');
  const abrir = form.querySelector('[data-camara-abrir]');
  const aviso = form.querySelector('[data-camara-aviso]');
  let flujo = null;
  function cierraCamara(devuelveFoco) {
    if (flujo) for (const t of flujo.getTracks()) t.stop();
    flujo = null;
    vista.srcObject = null;
    panel.hidden = true;
    if (devuelveFoco) abrir.focus();
  }
  abrir.addEventListener('click', () => {
    aviso.replaceChildren();
    if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
      APD.pintaAviso(aviso, 'pend', 'Esta computadora no deja usar la cámara', 'Cargue una fotografía con «Cargar una fotografía».', true);
      return;
    }
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false }).then((f) => {
      flujo = f;
      vista.srcObject = f;
      panel.hidden = false;
      form.querySelector('[data-camara-tomar]').focus();
    }).catch(() => APD.pintaAviso(aviso, 'pend', 'No se pudo usar la cámara', 'Revise que la computadora tenga cámara y que el navegador tenga permiso de usarla, o cargue una fotografía.', true));
  });
  form.querySelector('[data-camara-cerrar]').addEventListener('click', () => cierraCamara(true));
  form.querySelector('[data-camara-tomar]').addEventListener('click', () => {
    const ancho = vista.videoWidth || 640;
    const alto = vista.videoHeight || 480;
    const lienzo = document.createElement('canvas');
    lienzo.width = ancho;
    lienzo.height = alto;
    lienzo.getContext('2d').drawImage(vista, 0, 0, ancho, alto);
    lienzo.toBlob((blob) => {
      if (!blob) { APD.pintaAviso(aviso, 'pend', 'No se pudo tomar la fotografía', 'Intente otra vez o cargue una fotografía.', true); return; }
      // La imagen entra al campo como un archivo elegido: el módulo «archivos» aplica sus reglas y la muestra en su lista
      const entrada = form.querySelector('[data-campo="foto"] [data-archivos] > input[type="file"]:not([data-entrada-camara])');
      const dt = new DataTransfer();
      dt.items.add(new File([blob], 'fotografia-camara.jpg', { type: 'image/jpeg' }));
      entrada.files = dt.files;
      entrada.dispatchEvent(new Event('change', { bubbles: true }));
      cierraCamara(false);
      const zona = form.querySelector('[data-campo="foto"] .zona-carga');
      if (zona) zona.focus();
    }, 'image/jpeg', 0.92);
  });
  form.addEventListener('formkit:paso', (e) => { if (!e.detail.paso.contains(panel)) cierraCamara(false); });

  /* ----- «Confirmar»: el resumen antes de registrar ----- */
  const resumen = form.querySelector('[data-resumen-asistido]');
  const valor = (id) => { const c = document.getElementById(id); return c ? c.value.trim() : ''; };
  const cambiar = (campo, que) => el('button', { type: 'button', class: 'btn-enlace', 'data-editar': campo }, ['Cambiar', el('span', { class: 'solo-lector', texto: `: ${que}` })]);
  const dato = (que, texto, campo) => [que, el('span', { class: 'resumen-cuenta-valor' }, [el('span', { texto: texto || 'Sin capturar' }), cambiar(campo, que)])];
  function pintaResumen() {
    if (form.dataset.formkit !== 'listo') { setTimeout(pintaResumen, 0); return; }
    const ctx = FormKit.iniciar(form).ctx;
    const paso = form.querySelector('[data-paso][data-titulo="Datos"]');
    const adscripcion = [...paso.querySelectorAll('[data-campo]')].map((x) => x.dataset.campo)
      .filter((n) => !['nombre', 'primer_apellido', 'segundo_apellido', 'curp', 'fecha_nacimiento', 'sexo', 'correo', 'telefono'].includes(n) && ctx.activo(n) && ctx.textoDeValor(n))
      .map((n) => ctx.textoDeValor(n));
    const foto = form.querySelector('[data-campo="foto"] .lista-arch li[data-estado="listo"]');
    resumen.replaceChildren(APD.datosLista([
      dato('Aviso de privacidad', form.querySelector('input[name="aviso_leido"]').checked ? 'Se le leyó y lo aceptó' : '', 'aviso_leido'),
      dato('Nombre', [valor('nombre'), valor('primer_apellido'), valor('segundo_apellido')].filter(Boolean).join(' '), 'nombre'),
      dato('CURP', valor('curp'), 'curp'),
      dato('Fecha de nacimiento', valor('fecha_nacimiento'), 'curp'),
      dato('Teléfono', APD.telefonoTexto(valor('telefono')), 'telefono'),
      dato('Correo electrónico', valor('correo') || 'No tiene (es opcional)', 'correo'),
      dato('Adscripción', adscripcion.join(' · '), 'adscrito'),
      dato('Fotografía', foto ? 'Lista' : '', 'foto')
    ]));
  }
  form.addEventListener('formkit:paso', (e) => { if (e.detail.paso.contains(resumen)) pintaResumen(); });
}());
