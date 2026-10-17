/* =========================================================
   config-entrar.js · Ajustes del formulario «Entra a tu cuenta»

   SIMULACIÓN: compara con los datos ficticios y una contraseña común de
   prueba; las cuentas creadas en la prueba, con la suya (resumen guardado
   en este navegador, app/archivos-prueba.js). No protege nada. En la etapa 3 se sustituye por POST /apd/sesion:
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
          const falla = () => mal({ mensaje: 'La CURP o la contraseña no coinciden. Revisa ambas e intenta de nuevo.' });
          if (!p) return falla();
          // Una cuenta creada en la prueba entra con la contraseña que se le puso (se compara su resumen); las
          // ficticias, con la contraseña común de prueba
          const P = typeof APD_ARCHIVOS_PRUEBA !== 'undefined' ? APD_ARCHIVOS_PRUEBA : null;
          (P ? P.cuenta(curp) : Promise.resolve(null)).then((c) => (c ? P.contrasenaValida(c, contrasena) : contrasena === APD.CONTRASENA_FICTICIA))
            .then((bien) => {
              if (!bien) return falla();
              // Cuenta bloqueada en el cotejo: no era la persona de la fotografía (decisión 2026-10-17). Sólo se dice
              // a quien ya dio la contraseña correcta. Pendiente (P79): cómo se comunica con la Dirección.
              if (p.estado === 'bloqueada') {
                return mal({ mensaje: 'Tu cuenta está bloqueada mientras la Secretaría aclara tu identidad, que no se pudo confirmar en tu cita de cotejo.' });
              }
              APD.guardaSesion({ id: p.id });
              ok({ ok: true });
            });
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
