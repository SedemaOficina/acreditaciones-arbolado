/* datos.js · «Mis datos» (se carga después del núcleo y los módulos):
     · muestra los datos ligados a la CURP (sólo lectura: los corrige la Secretaría), con el sexo tomado de la CURP;
     · llena el formulario con el contacto y la adscripción vigentes (lo inverso de APD.adscripcionDe);
     · ofrece cambiar la fotografía sólo mientras la Secretaría no la haya confirmado;
     · «?volver=solicitud.html» regresa a la solicitud después de guardar. */
(function () {
  'use strict';
  const { el } = APD;
  const form = document.getElementById('formulario');
  const avisa = (c) => { c.dispatchEvent(new Event('input', { bubbles: true })); c.dispatchEvent(new Event('change', { bubbles: true })); };
  const marca = (nombre, valor) => {
    const r = form.querySelector(`input[name="${nombre}"][value="${valor}"]`);
    if (r && !r.checked) { r.checked = true; avisa(r); }
  };
  const pon = (id, valor) => { const c = document.getElementById(id); if (c) { c.value = valor == null ? '' : String(valor); avisa(c); } };
  const SEXO = { H: 'Hombre', M: 'Mujer', X: 'No binario' };

  // Regreso: sólo a una pantalla de este sitio
  const volver = new URLSearchParams(location.search).get('volver');
  if (/^[a-z]+\.html$/.test(volver || '')) for (const a of document.querySelectorAll('[data-volver]')) a.setAttribute('href', volver);

  function nacimientoDe(curp) {
    const aa = Number(curp.slice(4, 6));
    const siglo = /\d/.test(curp[16]) ? 1900 : 2000;
    return `${siglo + aa}-${curp.slice(6, 8)}-${curp.slice(8, 10)}`;
  }

  function ponAdscripcion(datos, p) {
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
    }
    else if (p.adscripcion === 'dependencia_federal') {
      if (clave === 'cfe') marca('dependencia_federal', 'cfe');
      else { marca('dependencia_federal', 'otro'); pon('dependencia_federal_otra', nombre); }
    } else if (['sobse', 'sedema', 'paot'].includes(clave)) marca('dependencia_cdmx', clave);
    else if (clave.startsWith('sedema_')) { marca('dependencia_cdmx', 'sedema'); marca('direccion_sedema', clave.replace('sedema_', '')); }
    else { marca('dependencia_cdmx', 'otro'); pon('dependencia_cdmx_otra', nombre); }
  }

  function pintaFoto(datos, p) {
    const f = datos.fotografia.find((x) => x.solicitante_id === p.id && x.vigente);
    const estado = document.querySelector('[data-foto-estado]');
    const cambio = document.querySelector('[data-foto-cambio]');
    if (f && f.estado === 'confirmada' && !p.foto_nueva) {
      estado.textContent = `La Secretaría confirmó tu fotografía el ${APD.fecha(String(f.confirmada_en).slice(0, 10))}. Si necesitas cambiarla, te toman otra en tu próxima cita.`;
      cambio.hidden = true;
    } else {
      estado.textContent = 'Tu fotografía está por confirmarse en tu cita de cotejo. Mientras tanto puedes cambiarla.';
      cambio.hidden = false;
    }
  }

  APD.cargar().then((datos) => {
    const p = APD.requiereSesion(datos);
    if (!p) return;
    APD.pintaSesion(document.querySelector('[data-sesion]'), p);
    const curp = p.curp || '';
    document.querySelector('[data-identidad]').replaceChildren(APD.datosLista([
      ['Nombre', APD.nombreCompleto(p)],
      ['CURP', curp],
      ['Fecha de nacimiento', curp ? APD.fecha(nacimientoDe(curp)) : ''],
      ['Expediente', p.numero_expediente || '']
    ]), // El sexo es dato interno (se toma de la CURP): la persona no lo ve; en la versión de prueba sale en amarillo
    el('div', { 'data-interno': 'Lo calcula el sistema con la CURP (posición 11). Se guarda en la base: apd.solicitante.sexo.' },
      [APD.datosLista([['Sexo', SEXO[p.sexo || curp[10]] || '']])]));
    pon('correo', p.correo); pon('correo2', p.correo); pon('telefono', p.telefono);
    ponAdscripcion(datos, p);
    pintaFoto(datos, p);
  }).catch(() => {
    document.querySelector('[data-identidad]').replaceChildren(el('p', { class: 'vacio', texto: 'No se pudieron cargar tus datos. Intenta de nuevo más tarde.' }));
  });
}());
