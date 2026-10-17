/* =========================================================
   config-cuenta.js · Ajustes del formulario «Crea tu cuenta»

   Se carga ANTES que el núcleo (contrato del estándar). El envío es una
   SIMULACIÓN sobre los datos ficticios: en la etapa 3 se sustituye por
   POST /apd/cuentas, que vuelve a validar todo con
   codigo/servidor/validar.mjs y el esquema derivado de cuenta.html, guarda
   la contraseña derivada con scrypt y nunca la devuelve.

   La CURP ya llegó comprobada contra el nombre, los apellidos y la fecha
   de nacimiento (validaciones cruzadas). Eso prueba coherencia, no
   identidad: la identidad la confirma la identificación oficial en el
   cotejo presencial y, si se decide, la consulta a RENAPO [pendiente].

   Adscripción: la API la convierte con el mismo criterio que APD.adscripcionDe (clave del catálogo o nombre
   escrito) y la guarda en apd.solicitante. El sexo no se recibe: la base lo toma de la CURP.

   Respuestas del servidor que la pantalla ya contempla:
     · CURP con cuenta activa      → rechazo con mensaje (no se crea otra);
     · CURP del padrón migrado     → si el nombre es el del registro, se activa esa cuenta y se
                                     muestra su historial; si no, se rechaza;
     · CURP nueva                  → cuenta nueva.
   ?simular=error | limite | lento muestra cada pantalla de fallo.
   ========================================================= */
/* Validaciones cruzadas propias del proyecto (CURP ↔ nombre y apellidos, de app/curp-nombre.js; CURP ↔ fecha escrita
   como día/mes/año, de app/fecha-dma.js) y el formato fecha-dma: la misma regla que aplica el servidor. */
window.FORMKIT_CONFIG = { cruzadas: window.APD_CRUZADAS, formatos: window.APD_FORMATOS };

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
            // Registro anterior (Kobo): además de la CURP, el nombre debe ser el del registro
            const igual = (a, b) => APD_CURP.limpia(a) === APD_CURP.limpia(b);
            if (!igual(d.nombre, existente.nombre) || !igual(d.primer_apellido, existente.primer_apellido)
                || !igual(d.segundo_apellido || '', existente.segundo_apellido || '')) {
              return mal({ mensaje: 'Tu nombre no coincide con el registro anterior de la Secretaría para esta CURP. Acude a la Secretaría para aclararlo.' });
            }
          }
          // Versión de prueba: la cuenta (con la contraseña sólo como resumen) y la fotografía se guardan en este
          // navegador, para entrar otra vez, verla en «Mi perfil» y en la revisión del personal (app/archivos-prueba.js)
          const id = existente ? existente.id : `prueba:${d.curp}`;
          const persona = Object.assign(existente ? {} : { nombre: d.nombre, primer_apellido: d.primer_apellido, segundo_apellido: d.segundo_apellido || null, sexo: d.curp[10] },
            { correo: d.correo, telefono: d.telefono }, APD.adscripcionDe(datos, d));
          const foto = (payload.archivos || []).find((a) => a.campo === 'foto' && a.blob);
          const P = typeof APD_ARCHIVOS_PRUEBA !== 'undefined' ? APD_ARCHIVOS_PRUEBA : null;
          const guarda = P ? Promise.all([P.guardaCuenta({ curp: d.curp, id, persona, contrasena: d.contrasena }), foto ? P.guardaFoto(d.curp, foto) : null]).catch(() => {}) : Promise.resolve();
          guarda.then(() => {
            APD.guardaSesion({ id });
            ok({ folio: d.curp, fecha: new Date().toISOString(), historial: Boolean(existente) });
          });
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
