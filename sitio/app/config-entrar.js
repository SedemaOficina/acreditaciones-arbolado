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
          const falla = () => mal({ titulo: 'No pudiste entrar', mensaje: 'La CURP o la contraseña no coinciden. Revisa ambas e intenta de nuevo.' });
          // Sólo en la versión de prueba (2026-10-17): si la CURP no tiene cuenta en ESTE navegador se dice, porque las
          // cuentas de la prueba no se comparten entre navegadores ni entre direcciones. En el SIA el mensaje es siempre
          // el general, para no revelar qué CURP tienen cuenta.
          if (!p) {
            return mal({ mensaje: 'No hay una cuenta con esta CURP en este navegador. Versión de prueba: cada cuenta se guarda sólo en el navegador y en la dirección donde la creaste (el sitio publicado y la vista dentro de Claude son lugares distintos). Si la creaste en otro lado, créala de nuevo aquí.' });
          }
          // Una cuenta creada en la prueba entra con la contraseña que se le puso (se compara su resumen); las
          // ficticias, con la contraseña común de prueba
          const P = typeof APD_ARCHIVOS_PRUEBA !== 'undefined' ? APD_ARCHIVOS_PRUEBA : null;
          (P ? P.cuenta(curp) : Promise.resolve(null)).then((c) => (c ? P.contrasenaValida(c, contrasena) : contrasena === APD.CONTRASENA_FICTICIA))
            .then((bien) => {
              if (!bien) return falla();
              // Cuenta bloqueada en el cotejo: no era la persona de la fotografía (decisión 2026-10-17). Sólo se dice
              // a quien ya dio la contraseña correcta. Pendiente (P79): cómo se comunica con la Dirección.
              if (p.estado === 'bloqueada') {
                return mal({ titulo: 'Tu cuenta está bloqueada', pendiente: 'Pendiente (P79): a quién acudir para aclararlo.',
                  mensaje: 'En tu cita de cotejo no se pudo confirmar tu identidad. La Secretaría lo está aclarando; mientras, no puedes entrar.' });
              }
              // Si el navegador no deja guardar la sesión, se dice: volvía a «Entrar» sin ningún mensaje (F4 M1)
              if (!APD.guardaSesion({ id: p.id })) return mal({ titulo: 'No pudiste entrar', mensaje: APD.textoNoGuardo('tu sesión de prueba') });
              return ok({ ok: true });
            });
        }).catch(mal);
      }, modo === 'lento' ? 20000 : 400);
      signal.addEventListener('abort', () => { clearTimeout(t); mal(new Error('plazo')); });
    });
  },
  alEnviar() {
    // Sólo se vuelve a pantallas propias del sitio, con su consulta (?folio=, ?tipo=: auditoría 2026-10-18, B7)
    location.href = APD.destinoPropio(new URLSearchParams(location.search).get('volver')) || 'tramites.html';
  },
  alFallar(error, form) {
    // Con título: qué pasó y qué hacer (propuesta «Avisos y confirmaciones», 2026-10-17); la cuenta bloqueada ya no se ve
    // igual que una contraseña equivocada
    const aviso = form.querySelector('[data-estado-envio] .aviso-texto');
    if (!(error && error.mensaje && aviso)) return;
    const { el } = APD;
    aviso.replaceChildren(...[error.titulo ? el('span', { class: 'aviso-titulo', texto: error.titulo }) : null, document.createTextNode(error.mensaje),
      error.pendiente ? el('span', { class: 'aviso-titulo pendiente', texto: error.pendiente }) : null].filter(Boolean));
  }
};
