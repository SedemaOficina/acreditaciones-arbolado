/* cuenta.js · Dos ayudas del formulario «Crea tu cuenta»:

   Con la sesión abierta (al recargar el acuse o al volver a esta pantalla), arriba se dice con quién se entró y se lleva
   a «Mis trámites»; quien va a crear la cuenta de otra persona puede salir antes (auditoría 2026-10-18, B12).

   Nombre, apellidos y CURP se escriben en mayúsculas al momento (decisión 2026-10-15), conservando la posición del
   cursor. Correo y contraseña no se tocan: el correo se guarda en minúsculas y la contraseña distingue mayúsculas.
   La base vuelve a ponerlos en mayúsculas al guardar (apd.mayusculas).

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
      const h = form.querySelector('.titulo-paso');
      h.tabIndex = -1;
      h.focus();
    });
  }

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
}());
