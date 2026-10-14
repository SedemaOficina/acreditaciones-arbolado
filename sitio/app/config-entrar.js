/* =========================================================
   config-entrar.js · Ajustes del formulario «Entra a tu cuenta»

   SIMULACIÓN: compara con los datos ficticios y una contraseña común de
   prueba. No protege nada. En la etapa 3 se sustituye por POST /apd/sesion:
   el servidor compara contra la contraseña derivada, aplica el bloqueo por
   intentos fallidos (columnas intentos_fallidos y bloqueada_hasta) y abre
   una sesión con cookie segura. El mensaje de error nunca dice cuál de los
   dos datos falló.
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
          const { curp, contrasena } = payload.datos;
          const p = datos.solicitante.find((x) => x.curp === curp);
          if (p && p.estado === 'sin_activar') {
            return mal({ mensaje: 'Esta CURP tiene acreditaciones anteriores, pero todavía no tiene cuenta. Crea tu cuenta con ella para verlas.' });
          }
          if (!p || contrasena !== APD.CONTRASENA_FICTICIA) {
            return mal({ mensaje: 'La CURP o la contraseña no coinciden. Revisa ambas e intenta de nuevo.' });
          }
          APD.guardaSesion({ id: p.id });
          ok({ ok: true });
        }).catch(mal);
      }, modo === 'lento' ? 20000 : 400);
      signal.addEventListener('abort', () => { clearTimeout(t); mal(new Error('plazo')); });
    });
  },
  alEnviar() {
    const volver = new URLSearchParams(location.search).get('volver');
    // Sólo se vuelve a pantallas propias del sitio
    location.href = /^[a-z]+\.html$/.test(volver || '') ? volver : 'tramites.html';
  },
  alFallar(error, form) {
    const aviso = form.querySelector('[data-estado-envio] .aviso-texto');
    if (error && error.mensaje && aviso) aviso.textContent = error.mensaje;
  }
};
