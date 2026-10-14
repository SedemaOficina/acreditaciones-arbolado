/* =========================================================
   config-cuenta.js · Ajustes del formulario «Crea tu cuenta»

   Se carga ANTES que el núcleo (contrato del estándar). El envío es una
   SIMULACIÓN sobre los datos ficticios: en la etapa 3 se sustituye por
   POST /apd/cuentas, que vuelve a validar todo con
   codigo/servidor/validar.mjs y el esquema derivado de cuenta.html, guarda
   la contraseña derivada con scrypt y nunca la devuelve.

   Respuestas del servidor que la pantalla ya contempla:
     · CURP con cuenta activa      → rechazo con mensaje (no se crea otra);
     · CURP del padrón migrado     → se activa esa cuenta y se muestra su historial
                                     [Pendiente: cómo se comprueba la titularidad al activar];
     · CURP nueva                  → cuenta nueva.
   ?simular=error | limite | lento muestra cada pantalla de fallo.
   ========================================================= */
window.FORMKIT_CONFIG = {};

window.FORMKIT_OPCIONES = {
  enviar(payload, { signal }) {
    const modo = new URLSearchParams(location.search).get('simular');
    return new Promise((ok, mal) => {
      const t = setTimeout(() => {
        if (modo === 'limite') return mal({ limite: true });
        if (modo === 'error') return mal(new Error('simulado'));
        APD.cargar().then((datos) => {
          const d = payload.datos;
          const existente = datos.solicitante.find((p) => p.curp === d.curp);
          if (existente && existente.estado !== 'sin_activar') {
            return mal({ mensaje: 'Ya hay una cuenta con esta CURP. Entra con ella; si no recuerdas tu contraseña, pide ayuda a la Secretaría.' });
          }
          if (existente) {
            APD.guardaSesion({ id: existente.id });
          } else {
            // Sólo lo necesario para la pantalla (el nombre); nada más se guarda en el navegador.
            APD.guardaSesion({ nueva: { nombre: d.nombre, primer_apellido: d.primer_apellido, segundo_apellido: d.segundo_apellido || null } });
          }
          ok({ folio: d.curp, fecha: new Date().toISOString(), historial: Boolean(existente) });
        }).catch(mal);
      }, modo === 'lento' ? 20000 : 400);
      signal.addEventListener('abort', () => { clearTimeout(t); mal(new Error('plazo')); });
    });
  },
  alEnviar(respuesta) {
    const h = document.querySelector('[data-cuenta-historial]');
    if (h) h.hidden = !respuesta.historial;
  },
  alFallar(error, form) {
    // El núcleo ya mostró el aviso general de fallo; si el servidor dio un motivo, se dice ese.
    const aviso = form.querySelector('[data-estado-envio] .aviso-texto');
    if (error && error.mensaje && aviso) aviso.textContent = error.mensaje;
  }
};
